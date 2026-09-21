-- Module 25 enterprise data exchange. Additive only. Does not alter collection or ledger tables.

create table if not exists import_jobs (
  id text primary key,
  business_id text,
  dataset text not null,
  format text,
  status text,
  progress integer default 0,
  processed integer default 0,
  total integer default 0,
  checkpoint integer default 0,
  classification text,
  permission text,
  branch_id text,
  created_by text,
  created_ids jsonb,
  correlation_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists export_jobs (
  id text primary key,
  business_id text,
  dataset text not null,
  format text,
  status text,
  progress integer default 0,
  processed integer default 0,
  total integer default 0,
  classification text,
  permission text,
  branch_id text,
  approval_id text,
  file_size integer default 0,
  created_by text,
  correlation_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists migration_jobs (
  id text primary key,
  business_id text,
  dataset text,
  source text,
  status text,
  result text,
  incremental boolean default false,
  dry_run boolean default false,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists bulk_operations (
  id text primary key,
  business_id text,
  dataset text,
  action text,
  processed integer default 0,
  total integer default 0,
  status text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists mapping_templates (
  id text primary key,
  business_id text,
  name text,
  dataset text,
  fields jsonb,
  updated_at timestamptz default now()
);

create table if not exists validation_errors (
  id text primary key,
  business_id text,
  dataset text,
  row_number integer,
  field text,
  code text,
  message text,
  created_at timestamptz default now()
);

create table if not exists migration_batches (
  id text primary key,
  business_id text,
  job_id text,
  source text,
  count integer,
  dry_run boolean,
  created_at timestamptz default now()
);

create table if not exists reconciliation_results (
  id text primary key,
  business_id text,
  job_id text,
  expected integer,
  actual integer,
  matched boolean,
  created_at timestamptz default now()
);

create table if not exists import_history (
  id text primary key,
  business_id text,
  job_id text,
  dataset text,
  count integer,
  result text,
  created_at timestamptz default now()
);

create table if not exists export_history (
  id text primary key,
  business_id text,
  job_id text,
  user_id text,
  branch_id text,
  permission text,
  classification text,
  export_type text,
  format text,
  record_count integer,
  file_size integer,
  approval_reference text,
  request_timestamp timestamptz,
  completion_timestamp timestamptz,
  result text
);

create table if not exists migration_history (
  id text primary key,
  business_id text,
  job_id text,
  source text,
  result text,
  created_at timestamptz default now()
);

create table if not exists export_permission_grants (
  id text primary key,
  business_id text,
  user_id text,
  permission text,
  scope text,
  status text,
  start_at timestamptz,
  expires_at timestamptz,
  approval_reference text,
  reason text,
  assigned_by text
);

create index if not exists import_jobs_dataset_idx on import_jobs (dataset, status);
create index if not exists export_jobs_dataset_idx on export_jobs (dataset, status);
create index if not exists validation_errors_dataset_idx on validation_errors (dataset);
create index if not exists export_history_user_idx on export_history (user_id, completion_timestamp);
