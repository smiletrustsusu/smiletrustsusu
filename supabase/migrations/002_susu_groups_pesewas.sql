-- Smile Trust Susu — susu groups, pesewas, auditor role extensions
-- Run after 001_financial_core.sql

-- Monetary columns as integer pesewas (nullable migration period)
alter table public.collections
  add column if not exists amount_pesewas bigint
    generated always as (round(amount * 100)::bigint) stored;

alter table public.ledger_entries
  add column if not exists amount_pesewas bigint
    generated always as (round(amount * 100)::bigint) stored;

alter table public.handovers
  add column if not exists expected_cash_pesewas bigint
    generated always as (round(expected_cash * 100)::bigint) stored,
  add column if not exists declared_cash_pesewas bigint
    generated always as (round(declared_cash * 100)::bigint) stored,
  add column if not exists counted_cash_pesewas bigint
    generated always as (round(coalesce(counted_cash, 0) * 100)::bigint) stored;

-- Extend app_users role check for Auditor
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('Owner', 'AssistantManager', 'Collector', 'Auditor'));

-- Susu groups (rotating savings groups distinct from branches)
create table if not exists public.susu_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  collector_id uuid not null references public.app_users(id) on delete restrict,
  code text not null,
  name text not null,
  leader_name text not null default '',
  secretary_name text not null default '',
  committee_notes text not null default '',
  contribution_amount_pesewas bigint not null default 0 check (contribution_amount_pesewas >= 0),
  contribution_frequency text not null default 'Daily'
    check (contribution_frequency in ('Daily', 'Weekly', 'Monthly')),
  meeting_day text not null default '',
  start_date date,
  cycle_length integer not null default 31 check (cycle_length > 0),
  rules text not null default '',
  wallet_pesewas bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists susu_groups_code_uq
  on public.susu_groups (business_id, lower(code));

create index if not exists susu_groups_collector_idx
  on public.susu_groups (collector_id);

-- Group membership
create table if not exists public.susu_group_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  susu_group_id uuid not null references public.susu_groups(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'Active'
    check (status in ('Active', 'Suspended', 'Closed', 'Deceased')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (susu_group_id, customer_id)
);

-- Link collections to susu group when applicable
alter table public.collections
  add column if not exists susu_group_id uuid references public.susu_groups(id);

-- Customer status
alter table public.customers
  add column if not exists member_status text not null default 'Active'
    check (member_status in ('Active', 'Suspended', 'Closed', 'Deceased'));

-- Group distributions (end-of-cycle payouts)
create table if not exists public.group_distributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  susu_group_id uuid not null references public.susu_groups(id) on delete restrict,
  cycle_label text not null,
  total_pesewas bigint not null default 0,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Paid', 'Rejected')),
  approved_by uuid references public.app_users(id),
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

alter table public.susu_groups enable row level security;
alter table public.susu_group_members enable row level security;
alter table public.group_distributions enable row level security;
