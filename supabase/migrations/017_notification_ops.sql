-- Notification extras. Additive only; existing notifications rows stay.

alter table if exists public.notifications
  add column if not exists message_id text,
  add column if not exists correlation_id text,
  add column if not exists idempotency_key text,
  add column if not exists failover_state text default 'Queued',
  add column if not exists provider_id text default '',
  add column if not exists retry_count integer default 0,
  add column if not exists archived boolean default false,
  add column if not exists deleted boolean default false;

create table if not exists notification_preferences (
  id text primary key,
  business_id text,
  customer_id text,
  language text default 'en',
  preferred_channel text default 'SMS',
  sms boolean default true,
  email boolean default true,
  whatsapp boolean default true,
  push boolean default true,
  promotions boolean default false,
  updated_at timestamptz default now()
);

create table if not exists notification_providers (
  id text primary key,
  business_id text,
  name text,
  channel text,
  priority integer default 1,
  enabled boolean default true,
  maintenance boolean default false,
  max_retries integer default 2,
  timeout_ms integer default 2000,
  cost numeric default 0,
  capacity integer default 100,
  secret_ref text,
  health_state text,
  displayed_score numeric,
  consecutive_failures integer default 0
);

create table if not exists scheduled_notifications (
  id text primary key,
  business_id text,
  event text,
  channel text,
  frequency text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  filters jsonb default '{}'::jsonb,
  vars jsonb default '{}'::jsonb,
  user_id text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists announcements (
  id text primary key,
  business_id text,
  title text,
  body text,
  audience text,
  branch_id text,
  priority text,
  effective_date date,
  expiry_date date,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists delivery_attempts (
  id text primary key,
  business_id text,
  message_id text,
  notification_id text,
  provider_id text,
  channel text,
  attempt_number integer,
  started_at timestamptz,
  ended_at timestamptz,
  response_ms integer,
  outcome text,
  reason text,
  failover boolean default false
);

create table if not exists notification_activity_logs (
  id text primary key,
  business_id text,
  action text,
  message_id text,
  provider_id text,
  result text,
  user_id text,
  created_at timestamptz default now()
);

create unique index if not exists idx_notifications_idempotency
  on public.notifications (idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists idx_delivery_attempts_provider on delivery_attempts (provider_id, ended_at);
create index if not exists idx_notifications_failover on public.notifications (failover_state, created_at);
