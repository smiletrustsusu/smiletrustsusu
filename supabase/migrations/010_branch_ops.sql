-- Branch HQ extensions. Existing branches / groups tables remain the source of truth.

alter table if exists branches
  add column if not exists branch_type text,
  add column if not exists date_opened date,
  add column if not exists status text default 'Active',
  add column if not exists phone_alt text,
  add column if not exists district text,
  add column if not exists town text,
  add column if not exists digital_address text,
  add column if not exists assistant_manager_id text,
  add column if not exists supervisor_id text,
  add column if not exists accountant_id text,
  add column if not exists cashier_id text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name text,
  add column if not exists momo_numbers text,
  add column if not exists float_limit numeric,
  add column if not exists opening_time text,
  add column if not exists closing_time text,
  add column if not exists working_days text,
  add column if not exists holidays text,
  add column if not exists emergency_closed boolean default false,
  add column if not exists location_group_id text;

create table if not exists branch_targets (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  monthly_collection numeric,
  loan_recovery numeric,
  customer_acquisition numeric,
  savings_growth numeric,
  expense_limit numeric,
  updated_at timestamptz default now()
);

create table if not exists branch_transfers (
  id text primary key,
  business_id text,
  kind text not null,
  entity_id text,
  from_branch_id text,
  to_branch_id text not null,
  amount numeric,
  reason text,
  status text,
  requested_by text,
  approved_by text,
  created_at timestamptz default now()
);

create table if not exists branch_announcements (
  id text primary key,
  business_id text,
  branch_id text,
  announcement_type text,
  title text not null,
  body text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists branch_calendar (
  id text primary key,
  business_id text,
  branch_id text,
  event_type text,
  title text not null,
  event_date date not null,
  created_at timestamptz default now()
);

create table if not exists branch_documents (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  doc_type text,
  reference text,
  file_name text,
  version integer default 1,
  uploaded_at timestamptz default now()
);

create index if not exists idx_branches_code on branches (business_id, code);
create index if not exists idx_branches_status on branches (business_id, status);
create index if not exists idx_branch_transfers_to on branch_transfers (to_branch_id);
create index if not exists idx_branch_calendar_date on branch_calendar (branch_id, event_date);
