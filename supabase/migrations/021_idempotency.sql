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
