-- Module 21 backup, restore, and disaster recovery. Additive only.

create table if not exists backup_jobs (
  id text primary key,
  business_id text,
  backup_set_id text,
  type text,
  status text,
  created_at timestamptz default now()
);

create table if not exists backup_sets (
  id text primary key,
  business_id text,
  type text,
  source text,
  status text,
  encrypted boolean,
  checksum text,
  verification_status text,
  created_at timestamptz default now()
);

create table if not exists backup_files (
  id text primary key,
  business_id text,
  backup_set_id text,
  name text,
  checksum text,
  encrypted boolean,
  created_at timestamptz default now()
);

create table if not exists backup_verification (
  id text primary key,
  business_id text,
  backup_set_id text,
  status text,
  integrity boolean,
  encryption boolean,
  created_at timestamptz default now()
);

create table if not exists restore_requests (
  id text primary key,
  business_id text,
  backup_set_id text,
  status text,
  mode text,
  requested_by text,
  created_at timestamptz default now()
);

create table if not exists restore_operations (
  id text primary key,
  business_id text,
  restore_id text,
  previous_state text,
  new_state text,
  note text,
  created_at timestamptz default now()
);

create table if not exists disaster_recovery_sites (
  id text primary key,
  business_id text,
  name text,
  role text,
  strategy text,
  status text
);

create table if not exists recovery_tests (
  id text primary key,
  business_id text,
  backup_set_id text,
  status text,
  duration_minutes numeric,
  production_touched boolean default false,
  created_at timestamptz default now()
);

create table if not exists retention_policies (
  id text primary key,
  business_id text,
  daily integer,
  weekly integer,
  monthly integer,
  annual integer
);

-- compat: table may already exist from an earlier migration (022_system_config.sql).
alter table public.retention_policies
  add column if not exists daily integer,
  add column if not exists weekly integer,
  add column if not exists monthly integer,
  add column if not exists annual integer;

create table if not exists backup_storage (
  id text primary key,
  business_id text,
  kind text,
  encrypted boolean,
  used_bytes bigint
);

create table if not exists recovery_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  created_at timestamptz default now()
);
