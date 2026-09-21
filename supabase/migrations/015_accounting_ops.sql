-- Ghana accounting extras. Additive only; existing journals and chart rows stay.

alter table if exists public.journal_entries
  add column if not exists branch_id text default '',
  add column if not exists period_id text default '';

create table if not exists tax_definitions (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  description text default '',
  category text default 'Other',
  method text default 'Percentage',
  rate numeric not null default 0,
  effective_date date,
  expiry_date date,
  status text default 'Draft',
  product_ids jsonb default '[]'::jsonb,
  services jsonb default '[]'::jsonb,
  branch_id text default '',
  liability_account text default '2200',
  income_account text default '4010',
  version integer default 1,
  updated_by text,
  updated_at timestamptz default now()
);

create table if not exists tax_config_history (
  id text primary key,
  business_id text,
  tax_id text,
  previous jsonb,
  next jsonb,
  user_id text,
  role text,
  reason text default '',
  created_at timestamptz default now()
);

create table if not exists accounting_periods (
  id text primary key,
  business_id text,
  period_from date not null,
  period_to date not null,
  status text default 'Open',
  closed_by text,
  reason text default '',
  closed_at timestamptz,
  reopened_by text,
  reopen_reason text default '',
  reopened_at timestamptz
);

create unique index if not exists idx_tax_definitions_code
  on tax_definitions (business_id, code);

create index if not exists idx_tax_history_tax on tax_config_history (tax_id, created_at);
create index if not exists idx_accounting_periods_dates on accounting_periods (period_from, period_to, status);
