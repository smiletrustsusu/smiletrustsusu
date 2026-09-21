-- Group susu extensions. Existing susu_groups / group_meetings remain the source of truth.

alter table if exists public.susu_groups
  add column if not exists group_type text,
  add column if not exists status text default 'Active',
  add column if not exists supervisor_id text,
  add column if not exists meeting_time text,
  add column if not exists meeting_venue text,
  add column if not exists collection_frequency text,
  add column if not exists financial_year_start date,
  add column if not exists financial_year_end date,
  add column if not exists chairperson_id text,
  add column if not exists treasurer_name text,
  add column if not exists vice_chairperson_name text,
  add column if not exists committee_members text,
  add column if not exists welfare_pesewas bigint default 0,
  add column if not exists share_capital_pesewas bigint default 0,
  add column if not exists emergency_pesewas bigint default 0;

create table if not exists group_leadership_history (
  id text primary key,
  business_id text,
  susu_group_id text not null,
  previous jsonb,
  next jsonb,
  changed_by text,
  created_at timestamptz default now()
);

create table if not exists group_fines (
  id text primary key,
  business_id text,
  susu_group_id text not null,
  customer_id text,
  amount numeric not null,
  reason text,
  meeting_id text,
  paid boolean default false,
  waived boolean default false,
  created_at timestamptz default now()
);

create table if not exists group_welfare (
  id text primary key,
  business_id text,
  susu_group_id text not null,
  customer_id text,
  amount numeric not null,
  type text,
  direction text default 'in',
  status text default 'Posted',
  created_at timestamptz default now()
);

create table if not exists group_shares (
  id text primary key,
  business_id text,
  susu_group_id text not null,
  customer_id text,
  amount numeric not null,
  type text,
  created_at timestamptz default now()
);

create table if not exists group_share_out (
  id text primary key,
  business_id text,
  susu_group_id text not null,
  cycle_label text,
  status text default 'Pending',
  total numeric,
  member_lines jsonb,
  created_by text,
  approved_by text,
  created_at timestamptz default now()
);

create table if not exists group_announcements (
  id text primary key,
  business_id text,
  susu_group_id text,
  title text not null,
  body text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists group_activity_logs (
  id text primary key,
  business_id text,
  susu_group_id text,
  action text,
  detail text,
  user_id text,
  created_at timestamptz default now()
);

create index if not exists group_fines_group_idx on group_fines (susu_group_id);
create index if not exists group_welfare_group_idx on group_welfare (susu_group_id);
create index if not exists group_shares_group_idx on group_shares (susu_group_id);
