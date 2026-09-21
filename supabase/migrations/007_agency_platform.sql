-- Smile Trust agency platform: branches extras, withdrawals, expenses, meetings, notifications, KYC.
-- Run after 001–006. Safe to re-run (IF NOT EXISTS).

alter table public.branches
  add column if not exists code text,
  add column if not exists manager_id uuid references public.app_users(id),
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists address text not null default '',
  add column if not exists gps_address text not null default '',
  add column if not exists region text not null default '';

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check check (role in (
    'Owner', 'AssistantManager', 'Collector',
    'KBA', 'Admin', 'ManagingDirector', 'OperationsManager', 'Accountant',
    'Cashier', 'FieldSupervisor', 'GroupCoordinator', 'CustomerService',
    'Auditor', 'Customer', 'Developer'
  ));

alter table public.app_users
  add column if not exists agent_code text,
  add column if not exists national_id text not null default '',
  add column if not exists residential_address text not null default '',
  add column if not exists phone_alt text not null default '',
  add column if not exists emergency_contact_name text not null default '',
  add column if not exists emergency_contact_phone text not null default '',
  add column if not exists employment_status text not null default 'Active',
  add column if not exists commission_type text not null default 'None',
  add column if not exists commission_rate numeric not null default 0,
  add column if not exists daily_target numeric not null default 0,
  add column if not exists personal_collection boolean not null default true,
  add column if not exists group_collection boolean not null default true,
  add column if not exists screen_permissions jsonb not null default '{}'::jsonb;

alter table public.customers
  add column if not exists customer_number text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists occupation text not null default '',
  add column if not exists employer text not null default '',
  add column if not exists gps_address text not null default '',
  add column if not exists residential_address text not null default '',
  add column if not exists national_id text not null default '',
  add column if not exists next_of_kin text not null default '',
  add column if not exists next_of_kin_phone text not null default '',
  add column if not exists signature_data text not null default '',
  add column if not exists portal_pin_hash text,
  add column if not exists dormant boolean not null default false;

create table if not exists public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id text not null,
  branch_id uuid references public.branches(id),
  agent_id uuid references public.app_users(id),
  status text not null default 'Active',
  opened_at timestamptz not null default now(),
  balance_pesewas bigint not null default 0
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  relationship text not null default '',
  phone text not null default '',
  national_id text not null default '',
  share_percent numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid references public.branches(id),
  amount_pesewas bigint not null,
  reason text not null default '',
  status text not null default 'Requested',
  requested_by uuid references public.app_users(id),
  verified_by uuid references public.app_users(id),
  approved_by uuid references public.app_users(id),
  paid_by uuid references public.app_users(id),
  receipt_no text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid references public.branches(id),
  expense_date date not null,
  category text not null,
  amount_pesewas bigint not null,
  vendor text not null default '',
  payment_method text not null default 'Cash',
  reference text not null default '',
  notes text not null default '',
  recorded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_meetings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  susu_group_id uuid not null,
  meeting_date date not null,
  recorded_by uuid references public.app_users(id),
  notes text not null default '',
  totals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid references public.customers(id),
  user_id uuid references public.app_users(id),
  event text not null,
  channel text not null default 'In-App',
  title text not null,
  body text not null,
  status text not null default 'Queued',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  entry_date date not null,
  narration text not null,
  lines jsonb not null,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (business_id, status);
create index if not exists expenses_date_idx on public.expenses (business_id, expense_date);
create index if not exists notifications_customer_idx on public.notifications (customer_id, created_at desc);
