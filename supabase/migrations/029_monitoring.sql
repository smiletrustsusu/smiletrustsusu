-- Module 19 monitoring engine and Android device health. Additive only.

create table if not exists monitoring_services (
  id text primary key,
  business_id text,
  name text,
  domain text,
  status text,
  score integer,
  last_check_at timestamptz
);

create table if not exists health_checks (
  id text primary key,
  business_id text,
  domain text,
  status text,
  score integer,
  created_at timestamptz default now()
);

create table if not exists health_scores (
  id text primary key,
  business_id text,
  domain text,
  score integer,
  availability numeric,
  error_pct numeric,
  mean_response_ms numeric,
  recovery_rate numeric,
  consecutive_failures integer,
  created_at timestamptz default now()
);

create table if not exists metrics (
  id text primary key,
  business_id text,
  domain text,
  name text,
  value numeric,
  unit text,
  source text,
  created_at timestamptz default now()
);

create table if not exists alerts (
  id text primary key,
  business_id text,
  rule_id text,
  name text,
  domain text,
  severity text,
  status text,
  value numeric,
  threshold numeric,
  created_at timestamptz default now()
);

create table if not exists alert_rules (
  id text primary key,
  business_id text,
  name text,
  domain text,
  metric text,
  op text,
  threshold numeric,
  severity text,
  active boolean default true
);

create table if not exists alert_history (
  id text primary key,
  business_id text,
  alert_id text,
  action text,
  created_at timestamptz default now()
);

create table if not exists incidents (
  id text primary key,
  business_id text,
  title text,
  severity text,
  domain text,
  status text,
  alert_id text,
  root_cause text,
  resolution text,
  created_at timestamptz default now()
);

create table if not exists incident_events (
  id text primary key,
  business_id text,
  incident_id text,
  previous_state text,
  new_state text,
  note text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists traces (
  id text primary key,
  business_id text,
  trace_id text,
  correlation_id text,
  transaction_id text,
  path text,
  status text,
  duration_ms integer,
  error text,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists log_entries (
  id text primary key,
  business_id text,
  level text,
  service text,
  message text,
  correlation_id text,
  trace_id text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists diagnostics (
  id text primary key,
  business_id text,
  kind text,
  summary text,
  detail jsonb,
  correlation_id text,
  created_at timestamptz default now()
);

create table if not exists capacity_statistics (
  id text primary key,
  business_id text,
  customers integer,
  collections integer,
  devices integer,
  queue_items integer,
  jobs integer,
  storage_bytes bigint,
  created_at timestamptz default now()
);

create table if not exists monitoring_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists android_devices (
  id text primary key,
  business_id text,
  device_id text,
  name text,
  model text,
  manufacturer text,
  android_version text,
  app_version text,
  branch_id text,
  agent_id text,
  operational_status text,
  health_score integer,
  readiness integer,
  last_seen_at timestamptz
);

create table if not exists device_health_snapshots (
  id text primary key,
  business_id text,
  device_id text,
  operational_status text,
  readiness integer,
  integrity_failed boolean,
  storage_free_pct numeric,
  pending_uploads integer,
  battery_pct numeric,
  network_type text,
  created_at timestamptz default now()
);

create table if not exists device_connectivity_history (
  id text primary key,
  business_id text,
  device_id text,
  network_type text,
  operational_status text,
  created_at timestamptz default now()
);

create table if not exists offline_health_events (
  id text primary key,
  business_id text,
  device_id text,
  type text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists device_storage_metrics (
  id text primary key,
  business_id text,
  device_id text,
  total_mb numeric,
  free_mb numeric,
  database_mb numeric,
  queue_mb numeric,
  created_at timestamptz default now()
);

create table if not exists synchronization_metrics (
  id text primary key,
  business_id text,
  device_id text,
  pending_uploads integer,
  pending_downloads integer,
  conflicts integer,
  created_at timestamptz default now()
);

create table if not exists device_security_events (
  id text primary key,
  business_id text,
  device_id text,
  finding text,
  open boolean default true,
  created_at timestamptz default now()
);

create table if not exists application_crash_reports (
  id text primary key,
  business_id text,
  device_id text,
  message text,
  created_at timestamptz default now()
);

create table if not exists offline_monitoring_queue (
  id text primary key,
  business_id text,
  device_id text,
  type text,
  payload jsonb,
  status text,
  created_at timestamptz default now()
);

create table if not exists device_alerts (
  id text primary key,
  business_id text,
  device_id text,
  name text,
  severity text,
  created_at timestamptz default now()
);

create index if not exists idx_alerts_status on alerts (status, severity);
create index if not exists idx_health_checks_domain on health_checks (domain, created_at);
create index if not exists idx_android_devices_status on android_devices (operational_status);
create index if not exists idx_device_snapshots_device on device_health_snapshots (device_id, created_at);
