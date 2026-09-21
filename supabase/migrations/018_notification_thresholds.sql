-- Threshold config versions. Additive only; stored scores are never rewritten.

create table if not exists notification_threshold_configs (
  id text primary key,
  business_id text,
  scope text,
  channel text,
  provider_id text,
  version text,
  hysteresis numeric default 5,
  consecutive_severe integer default 3,
  consecutive_recovery integer default 3,
  evaluation_interval_ms integer default 300000,
  metrics jsonb default '{}'::jsonb,
  alerts jsonb default '{}'::jsonb,
  effective_from timestamptz default now(),
  effective_to timestamptz,
  created_at timestamptz default now()
);

alter table if exists notification_providers
  add column if not exists threshold_version text,
  add column if not exists decline_streak integer default 0,
  add column if not exists recovery_streak integer default 0,
  add column if not exists pending_health_state text;

create index if not exists idx_threshold_configs_scope
  on notification_threshold_configs (scope, channel, provider_id);
