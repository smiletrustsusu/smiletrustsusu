-- Smile Trust Susu — relational financial core
-- Run in Supabase SQL editor AFTER backing up existing snapshot data.
-- Requires Supabase Auth for production (see README).

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  currency text not null default 'GHS',
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null,
  collector_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create unique index if not exists branches_collector_code_uq
  on public.branches (business_id, lower(collector_code))
  where collector_code is not null and collector_code <> '';

-- App users (maps to Supabase auth.users.id when using Auth)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  auth_user_id uuid unique,
  username text not null,
  name text not null,
  role text not null check (role in ('Owner', 'AssistantManager', 'Collector')),
  branch_id uuid references public.branches(id),
  collector_code text,
  active boolean not null default true,
  can_verify_handover boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_uq
  on public.app_users (business_id, lower(username));

create unique index if not exists app_users_collector_code_uq
  on public.app_users (business_id, lower(collector_code))
  where collector_code is not null and collector_code <> '';

-- Registered collector devices
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references public.app_users(id) on delete cascade,
  device_fingerprint text not null,
  label text not null default '',
  active boolean not null default true,
  last_seen_at timestamptz,
  registered_at timestamptz not null default now(),
  unique (business_id, device_fingerprint)
);

-- Customers / members
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  collector_id uuid not null references public.app_users(id) on delete restrict,
  account_no text not null,
  name text not null,
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists customers_account_no_uq
  on public.customers (business_id, lower(account_no));

create index if not exists customers_collector_idx on public.customers (collector_id);
create index if not exists customers_branch_idx on public.customers (branch_id);

-- Immutable receipt sequence per business
create table if not exists public.receipt_sequences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  last_value bigint not null default 0
);

-- Collections (payments)
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  collector_id uuid not null references public.app_users(id) on delete restrict,
  receipt_no text not null,
  idempotency_key text not null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('Cash', 'Mobile Money', 'Bank Transfer', 'POS/Card')),
  payment_reference text not null default '',
  verification_status text not null default 'Pending Verification'
    check (verification_status in ('Verified', 'Pending Verification', 'Rejected')),
  collection_date date not null,
  server_created_at timestamptz not null default now(),
  client_created_at timestamptz not null,
  device_id uuid references public.devices(id),
  note text not null default '',
  reversed boolean not null default false,
  unique (business_id, idempotency_key),
  unique (business_id, receipt_no)
);

create index if not exists collections_date_idx on public.collections (business_id, collection_date);
create index if not exists collections_collector_idx on public.collections (collector_id, collection_date);

-- Append-only financial ledger
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'Susu Deposit', 'Withdrawal', 'Loan Disbursement', 'Loan Repayment',
    'Interest Payment', 'Reversal', 'Adjustment'
  )),
  customer_id uuid references public.customers(id),
  branch_id uuid references public.branches(id),
  collector_id uuid references public.app_users(id),
  amount numeric(14,2) not null,
  direction text not null check (direction in ('credit', 'debit')),
  reference_id uuid,
  reference_type text,
  receipt_no text,
  payment_method text not null default '',
  payment_reference text not null default '',
  reason text not null default '',
  created_by uuid references public.app_users(id),
  approved_by uuid references public.app_users(id),
  server_created_at timestamptz not null default now(),
  client_created_at timestamptz not null default now()
);

create index if not exists ledger_customer_idx on public.ledger_entries (customer_id, server_created_at);
create index if not exists ledger_business_date_idx on public.ledger_entries (business_id, server_created_at);

-- Reversals / corrections (never delete ledger rows)
create table if not exists public.reversals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  original_collection_id uuid references public.collections(id),
  original_ledger_id uuid references public.ledger_entries(id),
  reversal_ledger_id uuid not null references public.ledger_entries(id),
  reason text not null,
  requested_by uuid not null references public.app_users(id),
  approved_by uuid references public.app_users(id),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at timestamptz not null default now()
);

-- Daily collector handover / remittance
create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  collector_id uuid not null references public.app_users(id) on delete restrict,
  handover_date date not null,
  expected_cash numeric(14,2) not null default 0,
  declared_cash numeric(14,2) not null default 0,
  counted_cash numeric(14,2),
  momo_total numeric(14,2) not null default 0,
  bank_total numeric(14,2) not null default 0,
  pos_total numeric(14,2) not null default 0,
  status text not null default 'Submitted'
    check (status in ('Draft', 'Submitted', 'Verified', 'Disputed')),
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.app_users(id),
  shortage_reason text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, collector_id, handover_date)
);

-- Operational exceptions
create table if not exists public.exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  exception_type text not null,
  severity text not null default 'warn' check (severity in ('info', 'warn', 'danger')),
  reference_id uuid,
  reference_type text,
  collector_id uuid references public.app_users(id),
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit trail (immutable)
create table if not exists public.audit_log (
  id bigint generated by default as identity primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_id uuid references public.app_users(id),
  action text not null,
  detail text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Offline sync queue (server-side dedup)
create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  device_id uuid references public.devices(id),
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (business_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Helper: next receipt number
-- ---------------------------------------------------------------------------
create or replace function public.next_receipt_no(p_business_id uuid, p_prefix text default 'RCP')
returns text language plpgsql as $$
declare
  v_next bigint;
begin
  insert into public.receipt_sequences (business_id, last_value)
  values (p_business_id, 1)
  on conflict (business_id) do update
    set last_value = public.receipt_sequences.last_value + 1
  returning last_value into v_next;
  return p_prefix || '-' || lpad(v_next::text, 8, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (requires Supabase Auth JWT with business_id claim)
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.app_users enable row level security;
alter table public.devices enable row level security;
alter table public.customers enable row level security;
alter table public.collections enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.reversals enable row level security;
alter table public.handovers enable row level security;
alter table public.exceptions enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_queue enable row level security;

-- Example policy pattern (customize JWT claims in Supabase Auth hooks):
-- create policy "tenant_isolation" on public.customers for all
--   using (business_id = (auth.jwt() ->> 'business_id')::uuid);

-- Keep legacy snapshot table for migration period
-- (existing smile_trust_cloud_snapshots from supabase/rls.sql)
