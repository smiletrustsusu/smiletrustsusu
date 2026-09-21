-- Module 20 API Gateway. Additive only. No HTTP listener is created by this schema.

create table if not exists api_clients (
  id text primary key,
  business_id text,
  code text,
  name text,
  type text,
  status text,
  scopes jsonb,
  created_at timestamptz default now()
);

create table if not exists api_keys (
  id text primary key,
  business_id text,
  client_id text,
  hash text,
  hint text,
  status text,
  created_at timestamptz default now()
);

create table if not exists api_tokens (
  id text primary key,
  business_id text,
  client_id text,
  user_id text,
  token_hash text,
  status text,
  created_at timestamptz default now()
);

create table if not exists api_versions (
  id text primary key,
  business_id text,
  status text,
  uri text
);

create table if not exists api_requests (
  id text primary key,
  business_id text,
  correlation_id text,
  route text,
  version text,
  status text,
  http integer,
  duration_ms integer,
  client_id text,
  created_at timestamptz default now()
);

create table if not exists api_rate_limits (
  id text primary key,
  business_id text,
  scope text,
  per_minute integer,
  per_hour integer,
  burst integer
);

create table if not exists webhook_subscriptions (
  id text primary key,
  business_id text,
  event text,
  target text,
  version text,
  status text,
  secret_hash text,
  created_at timestamptz default now()
);

create table if not exists webhook_deliveries (
  id text primary key,
  business_id text,
  subscription_id text,
  event text,
  status text,
  attempts integer,
  created_at timestamptz default now()
);

create table if not exists api_usage_statistics (
  id text primary key,
  business_id text,
  client_id text,
  requests integer,
  errors integer,
  created_at timestamptz default now()
);

create table if not exists api_audit_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  created_at timestamptz default now()
);

create table if not exists integration_partners (
  id text primary key,
  business_id text,
  name text,
  type text,
  status text
);
