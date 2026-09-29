-- Module 14 system administration. Additive only.

create table if not exists system_settings (
  id text primary key,
  business_id text,
  key text not null,
  value jsonb,
  updated_at timestamptz default now()
);

-- compat: table may already exist from an earlier migration (019_canonical_schema.sql).
alter table public.system_settings
  add column if not exists key text,
  add column if not exists value jsonb;

create table if not exists company_profile (
  id text primary key,
  business_id text,
  company_name text,
  registration_number text,
  tax_id text,
  license_number text,
  logo text,
  address text,
  region text,
  district text,
  telephone text,
  email text,
  website text,
  gps text,
  currency text default 'GHS',
  timezone text default 'Africa/Accra',
  financial_year_start text,
  financial_year_end text,
  working_days jsonb default '[]'::jsonb,
  business_hours text,
  updated_at timestamptz default now()
);

create table if not exists parameter_definitions (
  key text primary key,
  category text,
  label text,
  value_type text,
  default_value jsonb,
  high_risk boolean default false
);

create table if not exists parameter_values (
  id text primary key,
  business_id text,
  key text not null,
  value jsonb,
  status text default 'active',
  updated_at timestamptz default now()
);

create table if not exists feature_flags (
  id text primary key,
  business_id text,
  enabled boolean default true,
  high_risk boolean default false
);

create table if not exists configuration_versions (
  id text primary key,
  business_id text,
  version_number integer not null,
  status text,
  reason text,
  created_by text,
  previous_version integer,
  snapshot jsonb,
  created_at timestamptz default now()
);

create table if not exists configuration_changes (
  id text primary key,
  business_id text,
  key text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists configuration_categories (
  id text primary key,
  name text not null
);

create table if not exists approval_policies (
  id text primary key,
  business_id text,
  role text,
  limit_ghs numeric,
  maker_checker boolean default true
);

create table if not exists security_policies (
  id text primary key,
  business_id text,
  password_min_length integer default 8,
  password_expiry_days integer default 90,
  max_login_attempts integer default 5,
  lock_minutes integer default 15,
  session_timeout_minutes integer default 480
);

create table if not exists business_calendars (
  id text primary key,
  business_id text,
  name text,
  working_days jsonb default '[]'::jsonb,
  holidays jsonb default '[]'::jsonb,
  month_end boolean default true,
  year_end boolean default true
);

create table if not exists backup_policies (
  id text primary key,
  business_id text,
  schedule text default 'daily',
  retention_days integer default 30,
  encrypt boolean default true,
  compress boolean default true,
  verify boolean default true
);

create table if not exists retention_policies (
  id text primary key,
  business_id text,
  category text,
  days integer,
  permanent boolean default false
);

create table if not exists synchronization_policies (
  id text primary key,
  business_id text,
  max_queue_items integer default 500,
  sync_minutes integer default 5,
  conflict_strategy text default 'local-first',
  cache_limit_mb integer default 64
);

create table if not exists configuration_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists configuration_drafts (
  id text primary key,
  business_id text,
  kind text,
  key text,
  value jsonb,
  previous_value jsonb,
  reason text,
  status text default 'pending',
  requested_by text,
  approved_by text,
  rejected_by text,
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table if not exists product_definitions (
  id text primary key,
  business_id text,
  product_kind text,
  code text,
  name text,
  status text default 'active',
  config jsonb default '{}'::jsonb
);
