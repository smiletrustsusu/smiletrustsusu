-- Idempotency key store. Additive; does not replace receipts or audit_log uniqueness.

create table if not exists idempotency_keys (
  id text primary key,
  business_id text,
  idempotency_key text not null,
  operation_type text not null,
  request_fingerprint text,
  correlation_id text,
  request_id text,
  request_status text not null default 'processing',
  response_status text,
  response_payload jsonb,
  transaction_id text,
  journal_id text,
  receipt_number text,
  source text,
  user_id text,
  client_id text,
  failure_class text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  lock_until timestamptz,
  version_number integer default 1,
  unique (business_id, idempotency_key, operation_type)
);

-- 019 already creates idempotency_keys with (key, request_hash, response_body), which makes the
-- create above a no-op; add the 021 columns to that table instead.
alter table public.idempotency_keys
  add column if not exists idempotency_key text,
  add column if not exists operation_type text not null default 'generic',
  add column if not exists request_fingerprint text,
  add column if not exists correlation_id text,
  add column if not exists request_id text,
  add column if not exists request_status text not null default 'processing',
  add column if not exists response_status text,
  add column if not exists response_payload jsonb,
  add column if not exists transaction_id text,
  add column if not exists journal_id text,
  add column if not exists receipt_number text,
  add column if not exists source text,
  add column if not exists client_id text,
  add column if not exists failure_class text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists lock_until timestamptz,
  add column if not exists version_number integer default 1;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'idempotency_keys' and column_name = 'key'
  ) then
    execute 'update public.idempotency_keys set idempotency_key = key where idempotency_key is null';
  end if;
end $$;

create unique index if not exists idempotency_keys_business_key_op_uq
  on public.idempotency_keys (business_id, idempotency_key, operation_type)
  where idempotency_key is not null;

create index if not exists idempotency_keys_key_idx on public.idempotency_keys (idempotency_key);
create index if not exists idempotency_keys_corr_idx on public.idempotency_keys (correlation_id);
create index if not exists idempotency_keys_op_idx on public.idempotency_keys (operation_type);
create index if not exists idempotency_keys_exp_idx on public.idempotency_keys (expires_at);

create table if not exists idempotency_activity_logs (
  id text primary key,
  business_id text,
  idempotency_key text,
  previous_state text,
  new_state text,
  correlation_id text,
  request_fingerprint text,
  user_id text,
  source text,
  resolution text,
  original_transaction_id text,
  duration_ms integer default 0,
  created_at timestamptz default now()
);
