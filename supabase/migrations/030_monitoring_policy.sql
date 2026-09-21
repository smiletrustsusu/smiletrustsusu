-- Module 19 alert policy, intervals, and rule versioning. Additive only.

create table if not exists alert_rule_versions (
  id text primary key,
  business_id text,
  rule_id text,
  version integer,
  name text,
  metric text,
  configuration jsonb,
  archived_at timestamptz default now()
);

create table if not exists alert_escalation_profiles (
  id text primary key,
  business_id text,
  severity text,
  ack_minutes integer,
  first_minutes integer,
  second_minutes integer,
  create_incident boolean default false,
  channels jsonb
);

create table if not exists alert_suppression_rules (
  id text primary key,
  business_id text,
  domain text,
  from_at timestamptz,
  to_at timestamptz,
  reason text
);

create table if not exists missed_collections (
  id text primary key,
  business_id text,
  reason text,
  created_at timestamptz default now()
);

create table if not exists monitoring_configuration (
  id text primary key,
  business_id text,
  sampling_mode text,
  maintenance_windows jsonb,
  collection_intervals jsonb,
  retention_days jsonb,
  encrypted_telemetry boolean default true
);

alter table if exists alert_rules add column if not exists code text;
alter table if exists alert_rules add column if not exists status text;
alter table if exists alert_rules add column if not exists version integer;
alter table if exists alert_rules add column if not exists bands jsonb;
alter table if exists alerts add column if not exists occurrences integer default 1;
alter table if exists alerts add column if not exists interval_notation text;
alter table if exists alerts add column if not exists original_severity text;
