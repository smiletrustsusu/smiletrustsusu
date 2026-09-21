-- Module 16 payment engine. Additive only. PostgreSQL is not exclusive writer.

create table if not exists payment_transactions (
  id text primary key,
  business_id text,
  payment_type text,
  payment_method text,
  amount_pesewas bigint,
  currency text default 'GHS',
  status text,
  transaction_status text,
  customer_id text,
  branch_id text,
  group_id text,
  business_type text,
  business_ref text,
  payment_reference text,
  provider_id text,
  provider_ref text,
  correlation_id text,
  idempotency_key text,
  created_by text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists payment_methods (
  id text primary key,
  business_id text,
  name text,
  enabled boolean default true,
  future_ready boolean default false,
  priority integer
);

create table if not exists payment_providers (
  id text primary key,
  business_id text,
  name text,
  methods jsonb default '[]'::jsonb,
  auth_method text,
  callback_url text,
  timeout_ms integer,
  retry_policy jsonb,
  settlement_rules text,
  currencies jsonb default '["GHS"]'::jsonb,
  status text,
  priority integer,
  plugin text
);

create table if not exists provider_credentials (
  id text primary key,
  business_id text,
  provider_id text,
  key_name text,
  fingerprint text,
  rotated_at timestamptz,
  client_forbidden boolean default true
);

create table if not exists payment_callbacks (
  id text primary key,
  business_id text,
  provider_id text,
  reference text,
  correlation_id text,
  status text,
  signature_ok boolean,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists payment_reconciliation (
  id text primary key,
  business_id text,
  source text,
  matched integer,
  exceptions integer,
  lines jsonb,
  exception_lines jsonb,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists settlements (
  id text primary key,
  business_id text,
  provider_id text,
  gross_amount numeric,
  fees numeric,
  taxes numeric,
  net_settlement numeric,
  settlement_date date,
  settlement_reference text,
  status text,
  created_at timestamptz default now()
);

create table if not exists payment_refunds (
  id text primary key,
  business_id text,
  payment_id text,
  amount_pesewas bigint,
  partial boolean,
  reason text,
  status text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists payment_reversals (
  id text primary key,
  business_id text,
  payment_id text,
  amount_pesewas bigint,
  partial boolean,
  reason text,
  status text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists payment_queue (
  id text primary key,
  business_id text,
  payment_id text,
  status text,
  attempts integer default 0,
  next_attempt_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists payment_attempts (
  id text primary key,
  business_id text,
  payment_id text,
  provider_id text,
  status text,
  message text,
  created_at timestamptz default now()
);

create table if not exists provider_health (
  id text primary key,
  business_id text,
  provider_id text,
  status text,
  consecutive_failures integer default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text
);

create table if not exists payment_limits (
  id text primary key,
  business_id text,
  scope text,
  daily_limit_ghs numeric,
  velocity_per_hour integer,
  high_risk_ghs numeric
);

create table if not exists payment_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  payment_id text,
  owner text,
  created_at timestamptz default now()
);
