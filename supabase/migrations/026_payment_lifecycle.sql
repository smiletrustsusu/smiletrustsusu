-- Module 16 payment state machine, workflow ownership, and failover. Additive only.

alter table payment_transactions
  add column if not exists version integer default 1,
  add column if not exists accounting_posted boolean default false,
  add column if not exists accounting_status text,
  add column if not exists accounting_owner text,
  add column if not exists updated_at timestamptz;

create table if not exists payment_status_history (
  id text primary key,
  business_id text,
  payment_id text,
  previous_state text,
  new_state text,
  timestamp timestamptz,
  actor text,
  user_id text,
  provider_id text,
  correlation_id text,
  idempotency_key text,
  reason text
);

create table if not exists payment_stage_locks (
  id text primary key,
  business_id text,
  key text,
  stage_id text,
  payment_id text,
  holder text,
  mode text,
  lock_until timestamptz
);

create table if not exists payment_ownership_events (
  id text primary key,
  business_id text,
  stage_id text,
  previous_owner text,
  new_owner text,
  reason text,
  correlation_id text,
  created_at timestamptz default now()
);

create table if not exists payment_workflow_events (
  id text primary key,
  business_id text,
  event_id text,
  type text,
  stage_id text,
  stage_owner text,
  payment_id text,
  correlation_id text,
  timestamp timestamptz,
  event_version text
);

create table if not exists payment_owner_health (
  id text primary key,
  business_id text,
  owner text,
  status text,
  consecutive_failures integer default 0,
  last_success_at timestamptz,
  error_rate numeric,
  updated_at timestamptz
);
