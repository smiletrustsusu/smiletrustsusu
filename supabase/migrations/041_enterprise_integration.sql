-- Module 28 enterprise integration hub. Additive only.
-- Rollback notes: drop tables in reverse dependency order; no destructive alters to prior modules.
-- Archival: move api_requests/api_responses/webhook_deliveries/message_history older than retention to archive schemas.

create table if not exists api_clients (
  id text primary key,
  business_id text,
  name text not null,
  type text,
  partner_code text,
  scopes jsonb,
  status text not null default 'active',
  created_at timestamptz default now(),
  constraint api_clients_status_chk check (status in ('active', 'suspended', 'retired'))
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.api_clients
  add column if not exists partner_code text;

create table if not exists api_keys (
  id text primary key,
  business_id text,
  client_id text not null references api_clients(id),
  key_hash text not null,
  status text not null default 'active',
  rotated_at timestamptz,
  created_at timestamptz default now(),
  constraint api_keys_status_chk check (status in ('active', 'revoked', 'expired')),
  constraint api_keys_hash_uq unique (key_hash)
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.api_keys
  add column if not exists key_hash text,
  add column if not exists rotated_at timestamptz;

create table if not exists oauth_clients (
  id text primary key,
  business_id text,
  name text not null,
  client_id text not null unique,
  client_secret_hash text not null,
  grant_types jsonb,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists providers (
  id text primary key,
  business_id text,
  code text not null unique,
  name text not null,
  category text not null,
  priority integer not null default 100,
  status text not null,
  version text,
  failover_group text,
  suspended boolean default false,
  health jsonb,
  created_at timestamptz default now(),
  constraint providers_category_chk check (category in (
    'momo', 'bank', 'payment', 'sms', 'email', 'push', 'kyc', 'credit_bureau',
    'government', 'accounting', 'erp', 'crm', 'bi', 'cloud_storage', 'regulatory'
  ))
);

create table if not exists provider_versions (
  id text primary key,
  business_id text,
  provider_id text not null references providers(id),
  version text not null,
  status text,
  created_at timestamptz default now(),
  constraint provider_versions_uq unique (provider_id, version)
);

create table if not exists provider_configurations (
  id text primary key,
  business_id text,
  provider_id text not null references providers(id),
  priority integer,
  timeout_ms integer,
  retry_max integer,
  secrets_meta jsonb,
  created_at timestamptz default now()
);

create table if not exists webhooks (
  id text primary key,
  business_id text,
  direction text not null,
  event_type text not null,
  target text,
  version text,
  status text not null,
  secret_ref text,
  retry_max integer,
  backoff_ms integer,
  created_at timestamptz default now(),
  constraint webhooks_direction_chk check (direction in ('inbound', 'outbound'))
);

create table if not exists webhook_deliveries (
  id text primary key,
  business_id text,
  webhook_id text not null references webhooks(id),
  direction text,
  status text not null,
  payload jsonb,
  attempts integer default 0,
  signature text,
  created_at timestamptz default now(),
  delivered_at timestamptz
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.webhook_deliveries
  add column if not exists webhook_id text,
  add column if not exists direction text,
  add column if not exists payload jsonb,
  add column if not exists signature text,
  add column if not exists delivered_at timestamptz;

create table if not exists api_requests (
  id text primary key,
  business_id text,
  correlation_id text,
  provider_code text,
  operation text,
  version text,
  created_at timestamptz default now()
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.api_requests
  add column if not exists provider_code text,
  add column if not exists operation text;

create table if not exists api_responses (
  id text primary key,
  business_id text,
  request_id text references api_requests(id),
  correlation_id text,
  status integer,
  body jsonb,
  latency_ms integer,
  created_at timestamptz default now()
);

create table if not exists message_queues (
  id text primary key,
  business_id text,
  name text not null unique,
  pattern text,
  status text,
  ordering boolean default true,
  max_depth integer,
  depth integer default 0,
  back_pressure boolean default false,
  created_at timestamptz default now()
);

create table if not exists message_history (
  id text primary key,
  business_id text,
  queue text not null,
  pattern text,
  payload jsonb,
  headers jsonb,
  status text,
  sequence integer,
  attempts integer default 0,
  created_at timestamptz default now(),
  delivered_at timestamptz,
  acked_at timestamptz
);

create table if not exists transformation_definitions (
  id text primary key,
  business_id text,
  code text not null unique,
  name text,
  kind text not null,
  version text not null,
  definition jsonb,
  created_at timestamptz default now()
);

create table if not exists api_rate_limits (
  id text primary key,
  business_id text,
  scope text not null,
  per_minute integer,
  per_hour integer,
  burst integer,
  enabled boolean default true,
  constraint api_rate_limits_scope_uq unique (business_id, scope)
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.api_rate_limits
  add column if not exists enabled boolean default true;

create table if not exists api_usage_statistics (
  id text primary key,
  business_id text,
  kind text,
  provider_code text,
  operation text,
  transform_id text,
  at timestamptz default now()
);

-- compat: table may already exist from an earlier migration (031_api_gateway.sql).
alter table public.api_usage_statistics
  add column if not exists kind text,
  add column if not exists provider_code text,
  add column if not exists operation text,
  add column if not exists transform_id text,
  add column if not exists at timestamptz default now();

create table if not exists integration_deliverables (
  id text primary key,
  business_id text,
  code text not null unique,
  name text not null,
  phase text,
  deadline jsonb not null,
  created_at timestamptz default now()
);

create table if not exists integration_deadline_changes (
  id text primary key,
  business_id text,
  change_request_id text not null unique,
  deliverable_code text not null references integration_deliverables(code),
  previous_deadline timestamptz,
  new_deadline timestamptz,
  justification text,
  requester text,
  approver text,
  status text,
  approval_timestamp timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_api_keys_client on api_keys(client_id);
create index if not exists idx_providers_category on providers(category);
create index if not exists idx_webhooks_event on webhooks(event_type);
create index if not exists idx_webhook_deliveries_webhook on webhook_deliveries(webhook_id);
create index if not exists idx_api_requests_corr on api_requests(correlation_id);
create index if not exists idx_message_history_queue on message_history(queue, status);
create index if not exists idx_api_usage_at on api_usage_statistics(at);
create index if not exists idx_integration_deliverables_code on integration_deliverables(code);

-- Seed stub categories via app ensureIntegrationState; optional SQL seed omitted to avoid env-specific IDs.
