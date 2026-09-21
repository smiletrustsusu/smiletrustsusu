-- Module 15 identifier schema, aggregates, and delegation. Additive only.

create table if not exists aggregate_versions (
  id text primary key,
  business_id text,
  aggregate_type text,
  aggregate_id text,
  version integer default 1,
  updated_by_device text,
  updated_at timestamptz default now()
);

create table if not exists aggregate_locks (
  id text primary key,
  business_id text,
  aggregate_type text,
  aggregate_id text,
  holder_id text,
  lock_until timestamptz
);

create table if not exists identifier_registry (
  id text primary key,
  business_id text,
  identifier_type text,
  value text,
  entity_id text,
  lifecycle text,
  created_at timestamptz default now()
);

create table if not exists identifier_sequences (
  id text primary key,
  business_id text,
  prefix text,
  branch text,
  year integer,
  sequence integer
);

create table if not exists identifier_delegations (
  id text primary key,
  business_id text,
  identifier_type text,
  owner text,
  component text,
  status text,
  risk text,
  scope text,
  requested_by text,
  approved_by jsonb default '[]'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists identifier_activity_logs (
  id text primary key,
  business_id text,
  identifier_type text,
  value text,
  operation text,
  user_id text,
  previous_state text,
  next_state text,
  created_at timestamptz default now()
);

create table if not exists external_references (
  id text primary key,
  business_id text,
  system text,
  value text,
  internal_id text,
  internal_type text,
  created_at timestamptz default now()
);
