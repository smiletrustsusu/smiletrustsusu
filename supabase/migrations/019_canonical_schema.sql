-- Canonical schema overlays. Additive only.
-- Does not drop localStorage-era tables, does not reset data, does not
-- create a second members or users table. EXE and APK share these names.

create table if not exists public.canonical_schema_meta (
  version text primary key,
  applied_at timestamptz not null default now(),
  notes text not null default ''
);

insert into public.canonical_schema_meta (version, notes)
values ('1.0.0', 'Smile Trust single PostgreSQL model; members=customers; money=pesewas')
on conflict (version) do nothing;

-- ---------------------------------------------------------------------------
-- Compatibility views (prompt names → live tables)
-- ---------------------------------------------------------------------------
create or replace view public.organizations as
  select id, code as organization_code, name, currency, created_at
  from public.businesses;

create or replace view public.members as
  select
    id,
    business_id as organization_id,
    branch_id,
    coalesce(customer_number, account_no) as member_number,
    name,
    phone,
    date_of_birth,
    gender,
    occupation,
    member_status as status,
    created_at
  from public.customers;

comment on view public.members is 'Alias of customers. Do not insert here; write to customers.';
comment on table public.customers is 'Canonical member identity. Human number is customer_number / account_no. UUID is the global id.';
comment on table public.businesses is 'Canonical organization/tenant. One Smile Trust row in production.';
comment on table public.app_users is 'Canonical user identity for Windows and Android. Do not create per-client user tables.';
comment on table public.collections is 'Canonical contribution. Idempotency and receipt uniqueness are enforced.';
comment on table public.ledger_entries is 'Authoritative financial history. Amounts: numeric GHS plus generated amount_pesewas. Do not delete; reverse.';
comment on column public.savings_accounts.balance_pesewas is 'Derived cache. Rebuild from ledger_entries. Never treat as independently editable truth.';

-- ---------------------------------------------------------------------------
-- Optimistic concurrency on shared master data
-- ---------------------------------------------------------------------------
alter table public.customers add column if not exists version integer not null default 1;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.app_users add column if not exists version integer not null default 1;
alter table public.app_users add column if not exists updated_at timestamptz not null default now();
alter table public.branches add column if not exists version integer not null default 1;
alter table public.branches add column if not exists updated_at timestamptz not null default now();
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists last_login_at timestamptz;

create unique index if not exists customers_number_uq
  on public.customers (business_id, lower(customer_number))
  where customer_number is not null and customer_number <> '';

create index if not exists customers_phone_idx
  on public.customers (business_id, phone)
  where phone is not null and phone <> '';

-- ---------------------------------------------------------------------------
-- Data-driven roles and permissions (clients must stop hardcoding eventually)
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  code text not null,
  name text not null,
  description text not null default '',
  is_system_role boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

insert into public.permissions (code, name, module) values
  ('Customer.View', 'View members', 'members'),
  ('Customer.Create', 'Create members', 'members'),
  ('Customer.Edit', 'Update members', 'members'),
  ('Savings.Collect', 'Post contributions', 'contributions'),
  ('Savings.Reverse', 'Reverse contributions', 'contributions'),
  ('Withdrawal.Create', 'Request withdrawals', 'withdrawals'),
  ('Withdrawal.Approve', 'Approve withdrawals', 'withdrawals'),
  ('Withdrawal.Pay', 'Pay withdrawals', 'withdrawals'),
  ('Loan.Create', 'Create loans', 'loans'),
  ('Loan.Approve', 'Approve loans', 'loans'),
  ('Loan.Disburse', 'Disburse loans', 'loans'),
  ('Reports.View', 'View reports', 'reports'),
  ('Reports.Export', 'Export reports', 'reports'),
  ('Audit.View', 'View audit', 'audit'),
  ('Settings.Manage', 'Manage settings', 'settings'),
  ('User.Create', 'Create users', 'users')
on conflict (code) do nothing;

insert into public.roles (id, business_id, code, name)
select gen_random_uuid(), null, v.code, v.name
from (values
  ('SystemOwner', 'System Owner'),
  ('KBA', 'Super Administrator'),
  ('Admin', 'Branch Manager'),
  ('Collector', 'Agent / Collector'),
  ('Accountant', 'Accountant'),
  ('Cashier', 'Cashier'),
  ('Auditor', 'Auditor')
) as v(code, name)
where not exists (select 1 from public.roles r where r.code = v.code and r.business_id is null);

-- ---------------------------------------------------------------------------
-- Sessions, settings, preferences, outbox, idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id, expires_at);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  setting_key text not null,
  setting_value text not null default '',
  value_type text not null default 'string',
  description text not null default '',
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, setting_key)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade unique,
  theme_mode text not null default 'light',
  accent_color text not null default 'emerald',
  language text not null default 'en-GH',
  date_format text not null default 'yyyy-mm-dd',
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid references public.app_users(id),
  device_id uuid references public.devices(id),
  key text not null,
  request_hash text not null default '',
  response_status text not null default 'completed',
  response_body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (business_id, key)
);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists system_events_unpublished_idx
  on public.system_events (created_at)
  where published_at is null;

-- ---------------------------------------------------------------------------
-- Loans (localStorage loans were not in PostgreSQL)
-- ---------------------------------------------------------------------------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  client_id text,
  loan_number text,
  principal_pesewas bigint not null check (principal_pesewas >= 0),
  interest_rate numeric(8,4) not null default 0,
  status text not null default 'Draft',
  disbursed_pesewas bigint not null default 0,
  disbursement_date date,
  maturity_date date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists loans_client_uq
  on public.loans (business_id, client_id)
  where client_id is not null;

create unique index if not exists loans_number_uq
  on public.loans (business_id, lower(loan_number))
  where loan_number is not null and loan_number <> '';

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  loan_id uuid not null references public.loans(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  ledger_id uuid references public.ledger_entries(id) on delete restrict,
  amount_pesewas bigint not null check (amount_pesewas >= 0),
  principal_pesewas bigint not null default 0,
  interest_pesewas bigint not null default 0,
  payment_method text not null default 'Cash',
  reference text not null default '',
  status text not null default 'Posted',
  repayment_date date not null,
  recorded_by uuid references public.app_users(id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.loan_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  ledger_id uuid references public.ledger_entries(id) on delete restrict,
  amount_pesewas bigint not null check (amount_pesewas >= 0),
  payment_method text not null default 'Cash',
  reference text not null default '',
  disbursed_by uuid references public.app_users(id),
  disbursed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal lines (journal_entries.lines jsonb remains for compatibility)
-- ---------------------------------------------------------------------------
create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journal_entries(id) on delete restrict,
  account_code text not null,
  debit_pesewas bigint not null default 0 check (debit_pesewas >= 0),
  credit_pesewas bigint not null default 0 check (credit_pesewas >= 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  check (not (debit_pesewas > 0 and credit_pesewas > 0))
);

create table if not exists public.chart_of_accounts (
  code text primary key,
  name text not null,
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  parent_code text references public.chart_of_accounts(code),
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

insert into public.chart_of_accounts (code, name, account_type) values
  ('1000', 'Cash on Hand', 'ASSET'),
  ('1010', 'Mobile Money Float', 'ASSET'),
  ('1020', 'Bank', 'ASSET'),
  ('2000', 'Member Savings Liability', 'LIABILITY'),
  ('2100', 'Loans Receivable Control', 'ASSET'),
  ('4000', 'Interest Income', 'INCOME'),
  ('5000', 'Operating Expense', 'EXPENSE')
on conflict (code) do nothing;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.sessions enable row level security;
alter table public.system_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.system_events enable row level security;
alter table public.loans enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.loan_disbursements enable row level security;
alter table public.journal_lines enable row level security;
alter table public.chart_of_accounts enable row level security;

-- Financial parent rows are restricted, never cascaded from members/users.
-- journal_lines and loan_repayments use ON DELETE restrict against posted money.
