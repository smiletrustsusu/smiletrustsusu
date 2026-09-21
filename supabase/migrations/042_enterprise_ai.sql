-- Module 29 enterprise AI / ML platform. Additive only.
-- Rollback notes: drop tables in reverse dependency order; no destructive alters to prior modules.
-- Seed stub models/features/datasets via app ensureAiState; optional SQL seed omitted for local-first SPA.

create table if not exists ai_models (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  family text,
  status text not null default 'draft',
  created_by text,
  created_at timestamptz default now(),
  constraint ai_models_code_uq unique (code),
  constraint ai_models_status_chk check (status in ('draft', 'registered', 'approved', 'deployed', 'shadow', 'canary', 'retired', 'rolled_back'))
);

create table if not exists model_versions (
  id text primary key,
  business_id text,
  model_id text not null references ai_models(id),
  version text not null,
  status text not null default 'draft',
  checksum text,
  lineage jsonb,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz default now(),
  constraint model_versions_uq unique (model_id, version),
  constraint model_versions_status_chk check (status in ('draft', 'registered', 'approved', 'deployed', 'shadow', 'canary', 'retired', 'rolled_back'))
);

create table if not exists model_registry (
  id text primary key,
  business_id text,
  model_id text not null references ai_models(id),
  model_version_id text not null references model_versions(id),
  status text not null default 'registered',
  production boolean default false,
  created_at timestamptz default now(),
  constraint model_registry_status_chk check (status in ('registered', 'approved', 'deployed', 'retired', 'rolled_back'))
);

create table if not exists feature_registry (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  dtype text,
  status text not null default 'draft',
  version text,
  quality_score numeric,
  lineage jsonb,
  created_at timestamptz default now(),
  constraint feature_registry_code_uq unique (code),
  constraint feature_registry_status_chk check (status in ('draft', 'registered', 'approved', 'retired'))
);

create table if not exists feature_versions (
  id text primary key,
  business_id text,
  feature_id text not null references feature_registry(id),
  version text not null,
  status text not null default 'draft',
  created_at timestamptz default now(),
  constraint feature_versions_uq unique (feature_id, version)
);

create table if not exists dataset_registry (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  classification text not null,
  status text not null default 'draft',
  checksum text,
  checksum_invalid boolean default false,
  quality_score numeric,
  retention_days integer default 365,
  lineage jsonb,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz default now(),
  constraint dataset_registry_code_uq unique (code),
  constraint dataset_registry_class_chk check (classification in ('Public', 'Internal', 'Confidential', 'Restricted')),
  constraint dataset_registry_status_chk check (status in ('draft', 'registered', 'approved', 'retired'))
);

create table if not exists prediction_requests (
  id text primary key,
  business_id text,
  prediction_id text not null,
  target text,
  model_id text references ai_models(id),
  model_version_id text references model_versions(id),
  features jsonb,
  correlation_id text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists prediction_results (
  id text primary key,
  business_id text,
  request_id text references prediction_requests(id),
  target text,
  score numeric,
  value numeric,
  model_code text,
  model_version text,
  confidence numeric,
  feature_importance jsonb,
  contributing_factors jsonb,
  explanation text,
  correlation_id text,
  advisory boolean default true,
  created_at timestamptz default now()
);

create table if not exists fraud_alerts (
  id text primary key,
  business_id text,
  type text not null,
  severity text not null,
  detail text,
  score numeric,
  status text not null default 'open',
  model_version text,
  correlation_id text,
  mutates_ledger boolean default false,
  created_at timestamptz default now(),
  constraint fraud_alerts_severity_chk check (severity in ('low', 'medium', 'high', 'critical')),
  constraint fraud_alerts_status_chk check (status in ('open', 'acknowledged', 'closed', 'false_positive'))
);

create table if not exists anomaly_events (
  id text primary key,
  business_id text,
  type text not null,
  metric text,
  value numeric,
  threshold numeric,
  severity text,
  status text not null default 'open',
  created_at timestamptz default now()
);

create table if not exists recommendation_history (
  id text primary key,
  business_id text,
  kind text not null,
  title text,
  rationale text,
  priority text,
  status text not null default 'pending',
  decision text not null default 'pending',
  justification text,
  advisory boolean default true,
  posts_money boolean default false,
  auto_approves_loan boolean default false,
  created_by text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz default now(),
  constraint recommendation_decision_chk check (decision in ('pending', 'accepted', 'rejected', 'overridden'))
);

create table if not exists model_training_jobs (
  id text primary key,
  business_id text,
  model_code text,
  dataset_code text,
  status text not null default 'queued',
  validation_status text,
  shadow boolean default false,
  canary boolean default false,
  metadata_only boolean default true,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists model_deployments (
  id text primary key,
  business_id text,
  model_id text not null references ai_models(id),
  model_version_id text not null references model_versions(id),
  environment text not null default 'production',
  status text not null default 'deployed',
  approved_by text,
  deployed_by text,
  deployed_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by text,
  created_at timestamptz default now(),
  constraint model_deployments_status_chk check (status in ('deployed', 'rolled_back', 'retired'))
);

create table if not exists drift_events (
  id text primary key,
  business_id text,
  model_code text,
  metric text,
  baseline numeric,
  current numeric,
  severity text,
  status text not null default 'open',
  created_at timestamptz default now(),
  constraint drift_events_severity_chk check (severity in ('info', 'warning', 'critical'))
);

create table if not exists inference_logs (
  id text primary key,
  business_id text,
  prediction_id text,
  model_version_id text references model_versions(id),
  latency_ms integer,
  correlation_id text,
  created_at timestamptz default now()
);

create table if not exists ai_human_feedback (
  id text primary key,
  business_id text,
  recommendation_id text references recommendation_history(id),
  decision text,
  justification text,
  learning_metadata_only boolean default true,
  created_at timestamptz default now()
);

create table if not exists ai_permission_grants (
  id text primary key,
  business_id text,
  user_id text not null,
  permission_code text not null,
  scope text not null,
  enabled boolean default true,
  granted_by text,
  created_at timestamptz default now(),
  constraint ai_permission_grants_scope_chk check (scope in ('Self', 'Branch', 'Organization', 'Platform'))
);

create index if not exists ai_models_status_idx on ai_models (status);
create index if not exists model_versions_model_idx on model_versions (model_id);
create index if not exists model_registry_prod_idx on model_registry (production);
create index if not exists feature_registry_status_idx on feature_registry (status);
create index if not exists dataset_registry_status_idx on dataset_registry (status, classification);
create index if not exists prediction_results_target_idx on prediction_results (target, created_at);
create index if not exists fraud_alerts_status_idx on fraud_alerts (status, severity);
create index if not exists anomaly_events_status_idx on anomaly_events (status);
create index if not exists recommendation_history_status_idx on recommendation_history (status, decision);
create index if not exists model_deployments_env_idx on model_deployments (environment, status);
create index if not exists drift_events_status_idx on drift_events (status, severity);
create index if not exists inference_logs_corr_idx on inference_logs (correlation_id);
create index if not exists ai_permission_grants_user_idx on ai_permission_grants (user_id, permission_code);
