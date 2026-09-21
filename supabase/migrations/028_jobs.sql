-- Module 18 scheduler engine. Additive only. PostgreSQL is not exclusive writer.

create table if not exists background_jobs (
  id text primary key,
  business_id text,
  type text,
  definition_id text,
  category text,
  priority text,
  queue text,
  status text,
  version integer default 1,
  payload jsonb,
  correlation_id text,
  idempotency_key text,
  business_key text,
  available_at timestamptz,
  attempts integer default 0,
  max_attempts integer default 3,
  retry_strategy text,
  worker_id text,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  completed_at timestamptz
);

create table if not exists job_definitions (
  id text primary key,
  business_id text,
  type text unique,
  category text,
  label text,
  priority text,
  queue text,
  parallel boolean default false,
  max_attempts integer default 3,
  strategy text,
  backoff_ms integer
);

create table if not exists job_schedules (
  id text primary key,
  business_id text,
  type text,
  cron text,
  frequency text,
  calendar text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  active boolean default true,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists job_queue (
  id text primary key,
  business_id text,
  job_id text,
  queue text,
  priority text,
  status text,
  owner text,
  available_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists job_attempts (
  id text primary key,
  business_id text,
  job_id text,
  attempt integer,
  worker_id text,
  status text,
  error text,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists job_dependencies (
  id text primary key,
  business_id text,
  job_id text,
  job_type text,
  depends_on_job_id text,
  depends_on_type text
);

create table if not exists worker_nodes (
  id text primary key,
  business_id text,
  name text,
  status text,
  hostname text,
  last_heartbeat_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists worker_heartbeats (
  id text primary key,
  business_id text,
  worker_id text,
  created_at timestamptz default now()
);

create table if not exists dead_letter_queue (
  id text primary key,
  business_id text,
  job_id text,
  type text,
  payload jsonb,
  failure_reason text,
  retry_history jsonb,
  correlation_id text,
  idempotency_key text,
  queue_history jsonb,
  created_at timestamptz default now()
);

create table if not exists job_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists scheduler_configuration (
  id text primary key,
  business_id text,
  encrypted_payloads boolean default true,
  stale_lock_ms integer default 30000,
  heartbeat_ms integer default 15000,
  blackout_windows jsonb,
  execution_window jsonb,
  auto_failover boolean default true
);

create table if not exists job_status_history (
  id text primary key,
  business_id text,
  job_id text,
  previous_state text,
  new_state text,
  actor text,
  user_id text,
  reason text,
  created_at timestamptz default now()
);

create table if not exists job_approvals (
  id text primary key,
  business_id text,
  job_id text,
  action text,
  maker_id text,
  checker_id text,
  status text,
  reason text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

create index if not exists idx_background_jobs_status on background_jobs (status, available_at);
create index if not exists idx_background_jobs_type on background_jobs (type);
create index if not exists idx_job_queue_priority on job_queue (priority, available_at);
create index if not exists idx_dead_letter_queue_job on dead_letter_queue (job_id);
