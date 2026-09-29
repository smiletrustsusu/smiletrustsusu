-- Module 15 offline synchronization. Additive only.

create table if not exists offline_devices (
  id text primary key,
  business_id text,
  fingerprint text,
  user_id text,
  label text,
  local_sequence integer default 0,
  active boolean default true,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists device_authorizations (
  id text primary key,
  business_id text,
  device_id text,
  fingerprint text,
  user_id text,
  status text default 'authorized',
  revoked_by text,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists sync_sessions (
  id text primary key,
  business_id text,
  device_id text,
  agent_id text,
  mode text,
  status text,
  processed integer default 0,
  applied integer default 0,
  conflicts integer default 0,
  failed integer default 0,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists sync_queue (
  id text primary key,
  business_id text,
  kind text,
  idempotency_key text,
  status text,
  local_sequence integer,
  server_sequence integer,
  correlation_id text,
  aggregate_id text,
  device_id text,
  agent_id text,
  payload jsonb,
  last_error text,
  created_at timestamptz default now()
);

-- compat: table may already exist from an earlier migration (001_financial_core.sql).
alter table public.sync_queue
  add column if not exists kind text,
  add column if not exists local_sequence integer,
  add column if not exists server_sequence integer,
  add column if not exists correlation_id text,
  add column if not exists aggregate_id text,
  add column if not exists agent_id text,
  add column if not exists last_error text;

create table if not exists sync_queue_items (
  id text primary key,
  queue_id text,
  business_id text,
  local_sequence integer,
  depends_on jsonb default '[]'::jsonb,
  payload_hash text
);

create table if not exists sync_conflicts (
  id text primary key,
  business_id text,
  queue_item_id text,
  kind text,
  reasons jsonb default '[]'::jsonb,
  strategy text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists sync_resolutions (
  id text primary key,
  business_id text,
  conflict_id text,
  strategy text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists local_receipts (
  id text primary key,
  business_id text,
  temporary_receipt_no text,
  permanent_receipt_no text,
  transaction_id text,
  device_id text,
  agent_id text,
  created_at timestamptz default now()
);

create table if not exists sync_checkpoints (
  id text primary key,
  business_id text,
  session_id text,
  device_id text,
  last_local_sequence integer,
  last_server_sequence integer,
  status text,
  created_at timestamptz default now()
);

create table if not exists sync_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists sync_versions (
  id text primary key,
  business_id text,
  schema_version text,
  created_at timestamptz default now()
);

create table if not exists offline_configuration (
  id text primary key,
  business_id text,
  encrypted_at_rest boolean default true,
  conflict_strategy text default 'business_rule',
  financial_strategy text default 'business_rule'
);
