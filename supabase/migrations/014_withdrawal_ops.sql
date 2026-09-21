-- Withdrawal extras. Additive only; existing withdrawal_requests rows stay.

alter table if exists public.withdrawal_requests
  add column if not exists withdrawal_type text default 'Normal Withdrawal',
  add column if not exists payment_method text default 'Cash',
  add column if not exists payment_reference text default '',
  add column if not exists fee_pesewas bigint default 0,
  add column if not exists net_pesewas bigint,
  add column if not exists idempotency_key text,
  add column if not exists correlation_id text,
  add column if not exists version_number integer default 1,
  add column if not exists updated_at timestamptz default now();

create table if not exists withdrawal_activity_logs (
  id text primary key,
  business_id text,
  withdrawal_id text,
  customer_id text,
  action text,
  detail text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists account_closures (
  id text primary key,
  business_id text,
  account_id text,
  customer_id text,
  reason text,
  closed_by text,
  created_at timestamptz default now()
);

create table if not exists withdrawal_payments (
  id text primary key,
  business_id text,
  withdrawal_id text,
  receipt_no text,
  payment_method text,
  payment_reference text,
  amount_pesewas bigint,
  paid_by text,
  paid_at timestamptz
);

create unique index if not exists idx_withdrawal_idempotency
  on public.withdrawal_requests (idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists idx_withdrawal_activity_wd on withdrawal_activity_logs (withdrawal_id, created_at);
create index if not exists idx_withdrawal_status on public.withdrawal_requests (status, created_at);
