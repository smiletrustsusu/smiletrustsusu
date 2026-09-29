-- Agent operations: routes, attendance, leave, visits, documents, wallet snapshots.
-- Agents remain rows in public.app_users (role Collector / FieldSupervisor / GroupCoordinator).

alter table if exists public.app_users
  add column if not exists agent_code text,
  add column if not exists employee_number text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists phone_secondary text,
  add column if not exists gps_address text,
  add column if not exists region text,
  add column if not exists district text,
  add column if not exists town text,
  add column if not exists id_type text,
  add column if not exists id_number text,
  add column if not exists id_expiry date,
  add column if not exists date_employed date,
  add column if not exists supervisor_id uuid,
  add column if not exists job_title text,
  add column if not exists employment_type text,
  add column if not exists employment_status text,
  add column if not exists leave_balance numeric default 21,
  add column if not exists gps_enabled boolean default false;

create table if not exists agent_routes (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  area text,
  communities text,
  distance_km numeric,
  estimated_customers integer,
  estimated_minutes integer,
  agent_id uuid references public.app_users(id),
  branch_id uuid references public.branches(id),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by text,
  updated_by text
);

create table if not exists agent_attendance (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.app_users(id),
  branch_id uuid references public.branches(id),
  work_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  hours numeric,
  gps text,
  status text,
  created_at timestamptz default now()
);

create table if not exists agent_leave (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.app_users(id),
  leave_type text,
  days numeric,
  date_from date,
  date_to date,
  reason text,
  status text default 'Pending',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists customer_visit_logs (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  agent_id uuid not null references public.app_users(id),
  visit_date date,
  visit_time text,
  purpose text,
  outcome text,
  notes text,
  gps text,
  created_at timestamptz default now()
);

create table if not exists agent_documents (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.app_users(id),
  doc_type text,
  reference text,
  file_name text,
  uploaded_at timestamptz default now()
);

create table if not exists agent_wallet_entries (
  id text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  agent_id uuid not null references public.app_users(id),
  entry_date date,
  collected numeric,
  cash_on_hand numeric,
  handed numeric,
  expenses numeric,
  commission numeric,
  created_at timestamptz default now()
);

create index if not exists idx_users_agent_code on public.app_users (business_id, agent_code);
create index if not exists idx_users_employee_number on public.app_users (business_id, employee_number);
create index if not exists idx_agent_attendance_agent on agent_attendance (agent_id, work_date);
create index if not exists idx_agent_routes_agent on agent_routes (agent_id);
create index if not exists idx_visit_logs_agent on customer_visit_logs (agent_id, visit_date);
create index if not exists idx_agent_leave_agent on agent_leave (agent_id);
