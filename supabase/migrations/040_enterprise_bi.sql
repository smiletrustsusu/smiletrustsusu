-- Module 27 enterprise BI / metric / schema registries. Additive only.

create table if not exists metric_definitions (
  metric_id text primary key,
  business_id text,
  metric_code text not null unique,
  metric_name text not null,
  description text,
  data_type text,
  unit_of_measure text,
  source_module text,
  source_entity text,
  aggregation_method text,
  time_granularity text,
  rounding_policy text,
  missing_data_policy text,
  version text,
  effective_from timestamptz,
  effective_to timestamptz,
  owner_module text,
  tags jsonb,
  labels jsonb,
  custom_aggregation_expression text,
  created_at timestamptz default now()
);

create table if not exists metric_definition_history (
  id text primary key,
  business_id text,
  metric_id text,
  previous_version text,
  new_version text,
  change_description text,
  changed_by text,
  approval_reference text,
  effective_date timestamptz,
  created_at timestamptz default now()
);

create table if not exists kpi_definitions (
  kpi_id text primary key,
  business_id text,
  kpi_code text not null unique,
  kpi_name text not null,
  purpose text,
  formula text,
  input_metrics jsonb,
  aggregation_period text,
  unit_of_measure text,
  rounding_rule text,
  missing_data_policy text,
  owner_module text,
  version text,
  status text,
  effective_from timestamptz,
  created_at timestamptz default now()
);

create table if not exists kpi_definition_history (
  id text primary key,
  business_id text,
  kpi_id text,
  previous_version text,
  new_version text,
  change_description text,
  changed_by text,
  created_at timestamptz default now()
);

create table if not exists kpi_publications (
  id text primary key,
  business_id text,
  kpi_id text,
  version text,
  published_by text,
  created_at timestamptz default now()
);

create table if not exists schema_registry_entries (
  schema_id text primary key,
  business_id text,
  schema_code text not null unique,
  schema_name text not null,
  schema_type text,
  version text,
  status text,
  owner_module text,
  owning_team text,
  approval_reference text,
  effective_from timestamptz,
  effective_to timestamptz,
  compatibility_level text,
  registry_uri text,
  documentation_uri text,
  checksum text,
  published_at_utc timestamptz,
  published_by text,
  labels jsonb,
  tags jsonb,
  definition jsonb,
  created_at timestamptz default now()
);

create table if not exists schema_registry_history (
  id text primary key,
  business_id text,
  schema_id text,
  previous_version text,
  new_version text,
  previous_status text,
  new_status text,
  change_description text,
  approval_reference text,
  changed_by text,
  created_at timestamptz default now()
);

create table if not exists bi_calculation_log (
  id text primary key,
  business_id text,
  kpi_code text,
  formula_version text,
  value numeric,
  unit text,
  inputs jsonb,
  range jsonb,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists metric_definitions_code_idx on metric_definitions (metric_code);
create index if not exists kpi_definitions_code_idx on kpi_definitions (kpi_code, status);
create index if not exists schema_registry_code_idx on schema_registry_entries (schema_code, status);
