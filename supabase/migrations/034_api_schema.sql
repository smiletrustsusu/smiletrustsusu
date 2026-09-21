-- Global API request/response schema, header registry, and conditional rules.
-- Additive only. Does not alter collection, loan, or ledger posting tables.

create table if not exists header_property_registry (
  property_name text primary key,
  requirement_code text not null,
  generation_code text not null,
  data_type text not null,
  owner_module text not null,
  mutable boolean default false,
  response_propagation boolean default true,
  schema_version text default '1.0.0',
  effective_date date,
  deprecation_date date
);

create table if not exists conditional_requirement_rules (
  rule_id uuid primary key,
  rule_code text not null,
  schema_version text not null,
  rule_version text not null,
  status text not null,
  property_name text not null,
  requirement_state text not null,
  priority integer not null,
  owner_module text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  description text not null,
  condition jsonb not null
);

create table if not exists header_validations (
  id text primary key,
  business_id text,
  request_id text,
  correlation_id text,
  axis text,
  outcome text,
  errors jsonb,
  applied_rules jsonb,
  substitutions jsonb,
  created_at timestamptz default now()
);

create table if not exists api_schema_versions (
  id text primary key,
  schema_version text not null,
  effective_date date,
  deprecation_date date,
  owning_module text,
  compatible_contract_versions jsonb
);
