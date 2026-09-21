-- Module 13 audit extras. Additive only; existing audit_log stays.

alter table if exists public.audit_log
  add column if not exists event_id text,
  add column if not exists correlation_id text,
  add column if not exists transaction_id text,
  add column if not exists idempotency_key text,
  add column if not exists sequence_number integer default 1,
  add column if not exists category text,
  add column if not exists event_type text,
  add column if not exists severity text,
  add column if not exists guarantee text,
  add column if not exists payload_hash text,
  add column if not exists prev_hash text,
  add column if not exists chain_hash text,
  add column if not exists archived boolean default false;

create unique index if not exists audit_log_event_id_idx
  on public.audit_log (event_id)
  where event_id is not null;

create unique index if not exists audit_log_idempotency_idx
  on public.audit_log (business_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create table if not exists audit_event_types (
  id text primary key,
  category text not null,
  event_type text not null,
  severity text default 'Informational',
  guarantee text default 'G1'
);

create table if not exists audit_categories (
  id text primary key,
  name text not null
);

create table if not exists audit_changes (
  id text primary key,
  audit_id text not null,
  field text not null,
  previous_value jsonb,
  new_value jsonb
);

create table if not exists audit_entities (
  id text primary key,
  audit_id text not null,
  entity_type text,
  entity_id text,
  entity_name text,
  parent_entity text
);

create table if not exists audit_sessions (
  id text primary key,
  business_id text,
  user_id text,
  device_id text,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists audit_exports (
  id text primary key,
  business_id text,
  report_id text,
  user_id text,
  row_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists audit_archives (
  id text primary key,
  business_id text,
  source_audit_id text,
  payload jsonb not null,
  payload_hash text,
  archived_at timestamptz default now(),
  read_only boolean default true
);

create table if not exists audit_integrity_checks (
  id text primary key,
  business_id text,
  hashed integer default 0,
  breaks integer default 0,
  ok boolean default true,
  details jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists audit_alerts (
  id text primary key,
  business_id text,
  severity text,
  message text,
  check_id text,
  created_at timestamptz default now()
);

create table if not exists audit_retention_policies (
  id text primary key,
  business_id text,
  category text not null,
  days integer,
  permanent boolean default false,
  label text
);

create table if not exists audit_activity_logs (
  id text primary key,
  business_id text,
  action text not null,
  details text default '',
  kind text default 'engine',
  created_at timestamptz default now()
);

create table if not exists audit_outbox (
  id text primary key,
  business_id text,
  audit_id text,
  event_id text,
  correlation_id text,
  sequence_number integer default 1,
  payload_hash text,
  status text default 'pending',
  retry_count integer default 0,
  failure_reason text,
  last_attempt timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists audit_outbox_status_idx on public.audit_outbox (status, correlation_id, sequence_number);
