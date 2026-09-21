-- Reports, analytics, and scheduled output. Additive only.

create table if not exists report_templates (
  id text primary key,
  business_id text,
  name text not null,
  spec jsonb default '{}'::jsonb,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists scheduled_reports (
  id text primary key,
  business_id text,
  report_id text not null,
  frequency text default 'Daily',
  delivery text default 'In-App',
  filters jsonb default '{}'::jsonb,
  user_id text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists report_history (
  id text primary key,
  business_id text,
  report_id text,
  report_name text,
  user_id text,
  branch_id text,
  filters jsonb default '{}'::jsonb,
  format text default 'view',
  row_count integer default 0,
  duration_ms integer default 0,
  version text,
  period_from date,
  period_to date,
  created_at timestamptz default now()
);

create table if not exists saved_filters (
  id text primary key,
  business_id text,
  user_id text,
  report_id text,
  filters jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists dashboard_widgets (
  id text primary key,
  business_id text,
  user_id text,
  widget_id text,
  hidden boolean default false
);

create table if not exists analytics_snapshots (
  id text primary key,
  business_id text,
  snapshot_date date,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists kpi_definitions (
  id text primary key,
  business_id text,
  code text not null,
  formula text,
  weights jsonb,
  updated_at timestamptz default now()
);

create table if not exists report_exports (
  id text primary key,
  business_id text,
  schedule_id text,
  report_id text,
  status text default 'Queued',
  created_at timestamptz default now()
);

create table if not exists report_activity_logs (
  id text primary key,
  business_id text,
  action text,
  report_id text,
  user_id text,
  detail text,
  created_at timestamptz default now()
);

create index if not exists idx_report_history_user on report_history (user_id, created_at);
create index if not exists idx_scheduled_reports_next on scheduled_reports (next_run_at, active);
create unique index if not exists idx_kpi_definitions_code on kpi_definitions (business_id, code);
