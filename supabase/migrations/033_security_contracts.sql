-- Module 22 security operations and interface contracts. Additive only.

create table if not exists risk_scores (
  id text primary key,
  business_id text,
  subject_type text,
  subject_id text,
  score integer,
  level text,
  signals jsonb,
  created_at timestamptz default now()
);

create table if not exists security_incidents (
  id text primary key,
  business_id text,
  title text,
  severity text,
  status text,
  subject_id text,
  created_at timestamptz default now()
);

create table if not exists fraud_cases (
  id text primary key,
  business_id text,
  subject_id text,
  reason text,
  status text,
  created_at timestamptz default now()
);

create table if not exists threat_signals (
  id text primary key,
  business_id text,
  type text,
  subject_id text,
  created_at timestamptz default now()
);

create table if not exists security_investigations (
  id text primary key,
  business_id text,
  fraud_id text,
  note text,
  created_at timestamptz default now()
);

create table if not exists domain_events (
  id text primary key,
  business_id text,
  name text,
  module_id integer,
  payload jsonb,
  correlation_id text,
  created_at timestamptz default now()
);

create table if not exists contract_invocations (
  id text primary key,
  business_id text,
  contract_id text,
  from_module integer,
  target_module integer,
  version text,
  status text,
  duration_ms integer,
  created_at timestamptz default now()
);

create table if not exists contract_versions (
  id text primary key,
  business_id text,
  contract_id text,
  version text,
  status text
);
