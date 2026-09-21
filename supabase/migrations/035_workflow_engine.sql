-- Module 23 workflow engine. Additive only. Does not alter collection or ledger tables.

create table if not exists workflow_definitions (
  id text primary key,
  business_id text,
  code text not null,
  name text,
  type text,
  status text,
  version text,
  owner_module integer,
  sla_ms integer,
  steps jsonb,
  created_at timestamptz default now()
);

create table if not exists workflow_versions (
  id text primary key,
  business_id text,
  definition_id text,
  code text,
  version text,
  status text,
  steps jsonb,
  sla_ms integer,
  created_at timestamptz default now()
);

create table if not exists workflow_instances (
  id text primary key,
  business_id text,
  definition_id text,
  version_id text,
  code text,
  status text,
  revision integer,
  subject_id text,
  correlation_id text,
  business_key text,
  started_by text,
  created_at timestamptz default now()
);

create table if not exists workflow_steps (
  id text primary key,
  instance_id text,
  step_id text,
  name text,
  status text,
  created_at timestamptz default now()
);

create table if not exists workflow_transitions (
  id text primary key,
  instance_id text,
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz default now()
);

create table if not exists workflow_variables (
  instance_id text primary key,
  values jsonb
);

create table if not exists workflow_events (
  id text primary key,
  instance_id text,
  type text,
  created_at timestamptz default now()
);

create table if not exists workflow_tasks (
  id text primary key,
  instance_id text,
  step_id text,
  name text,
  status text,
  assignee_id text,
  due_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists workflow_assignments (
  id text primary key,
  task_id text,
  user_id text,
  role text,
  created_at timestamptz default now()
);

create table if not exists workflow_escalations (
  id text primary key,
  task_id text,
  instance_id text,
  reason text,
  level integer,
  created_at timestamptz default now()
);

create table if not exists workflow_slas (
  id text primary key,
  instance_id text,
  started_at timestamptz,
  due_at timestamptz,
  status text,
  escalation_count integer
);

create table if not exists business_cases (
  id text primary key,
  business_id text,
  type text,
  title text,
  status text,
  owner_id text,
  workflow_instance_id text,
  created_at timestamptz default now()
);

create table if not exists case_participants (
  id text primary key,
  case_id text,
  user_id text,
  role text,
  created_at timestamptz default now()
);

create table if not exists case_documents (
  id text primary key,
  case_id text,
  document_id text,
  name text,
  created_at timestamptz default now()
);

create table if not exists workflow_history (
  id text primary key,
  instance_id text,
  action text,
  details text,
  created_at timestamptz default now()
);
