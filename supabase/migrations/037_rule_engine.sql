-- Module 24 enterprise rule engine. Additive only. Does not alter collection or ledger tables.

create table if not exists rule_definitions (
  id text primary key,
  business_id text,
  code text not null,
  name text,
  type text check (type in ('validation','decision','calculation','eligibility','risk','routing','policy','scoring')),
  status text check (status in ('draft','testing','approval','published','deprecated','retired')),
  version text,
  revision integer default 1,
  expression text,
  owner_module integer,
  tests_passed boolean,
  signature text,
  created_at timestamptz default now()
);

create table if not exists rule_versions (
  id text primary key,
  business_id text,
  definition_id text,
  code text,
  version text,
  status text,
  kind text,
  expression text,
  table_body jsonb,
  tree_body jsonb,
  model_body jsonb,
  signature text,
  created_at timestamptz default now()
);

create table if not exists rule_sets (
  id text primary key,
  business_id text,
  name text,
  codes jsonb,
  created_at timestamptz default now()
);

create table if not exists decision_tables (
  id text primary key,
  business_id text,
  definition_id text,
  hit_policy text,
  inputs jsonb,
  rows jsonb,
  created_at timestamptz default now()
);

create table if not exists decision_tree_nodes (
  id text primary key,
  business_id text,
  definition_id text,
  parent_id text,
  condition jsonb,
  outcome text,
  created_at timestamptz default now()
);

create table if not exists scoring_models (
  id text primary key,
  business_id text,
  definition_id text,
  inputs jsonb,
  weights jsonb,
  thresholds jsonb,
  created_at timestamptz default now()
);

create table if not exists rule_parameters (
  id text primary key,
  business_id text,
  definition_id text,
  key text,
  value jsonb
);

create table if not exists rule_tests (
  id text primary key,
  business_id text,
  definition_id text,
  input jsonb,
  expected jsonb,
  required boolean default true
);

create table if not exists simulation_runs (
  id text primary key,
  business_id text,
  code text,
  results jsonb,
  created_at timestamptz default now()
);

create table if not exists rule_execution_history (
  id text primary key,
  business_id text,
  definition_id text,
  version_id text,
  code text,
  result jsonb,
  duration_ms integer,
  created_at timestamptz default now()
);

create table if not exists rule_approvals (
  id text primary key,
  business_id text,
  definition_id text,
  decision text,
  comment text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists rule_dependencies (
  id text primary key,
  business_id text,
  definition_id text,
  depends_on text
);

create table if not exists rule_change_history (
  id text primary key,
  business_id text,
  definition_id text,
  from_status text,
  to_status text,
  reason text,
  user_id text,
  created_at timestamptz default now()
);

create index if not exists rule_definitions_code_idx on rule_definitions (code);
create index if not exists rule_versions_definition_idx on rule_versions (definition_id);
create index if not exists rule_execution_history_code_idx on rule_execution_history (code);
create index if not exists rule_execution_history_created_idx on rule_execution_history (created_at);

create or replace view rule_published_catalog as
  select id, code, name, type, version
  from rule_definitions
  where status = 'published';

-- Rollback (manual): drop view rule_published_catalog; drop tables created above in reverse order.
