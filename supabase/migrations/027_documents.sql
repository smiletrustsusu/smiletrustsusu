-- Module 17 document engine. Additive only. PostgreSQL is not exclusive writer.

create table if not exists documents (
  id text primary key,
  business_id text,
  type text,
  category text,
  status text,
  outcome text,
  version integer default 1,
  receipt_no text,
  temporary_receipt_no text,
  permanent_receipt_no text,
  transaction_id text,
  local_transaction_id text,
  correlation_id text,
  idempotency_key text,
  customer_id text,
  agent_id text,
  branch_id text,
  device_id text,
  amount_pesewas bigint,
  payment_method text,
  currency text default 'GHS',
  offline boolean default false,
  signed boolean default false,
  content_hash text,
  created_at timestamptz default now(),
  issued_at timestamptz
);

create table if not exists document_templates (
  id text primary key,
  business_id text,
  type text,
  name text,
  language text,
  theme text,
  published boolean default false,
  version integer default 1,
  header text,
  footer text,
  watermark text,
  body text
);

create table if not exists template_versions (
  id text primary key,
  business_id text,
  template_id text,
  version integer,
  body text,
  header text,
  footer text,
  published boolean default false,
  created_at timestamptz default now()
);

create table if not exists document_versions (
  id text primary key,
  business_id text,
  document_id text,
  version integer,
  content_hash text,
  created_at timestamptz default now()
);

create table if not exists document_metadata (
  id text primary key,
  business_id text,
  document_id text,
  type text,
  customer_id text,
  branch_id text,
  amount_pesewas bigint,
  created_at timestamptz default now()
);

create table if not exists document_signatures (
  id text primary key,
  business_id text,
  document_id text,
  kind text,
  officer_id text,
  hash text,
  created_at timestamptz default now()
);

create table if not exists document_qr_codes (
  id text primary key,
  business_id text,
  document_id text,
  token text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists document_delivery (
  id text primary key,
  business_id text,
  document_id text,
  channel text,
  address text,
  status text,
  created_at timestamptz default now()
);

create table if not exists document_storage (
  id text primary key,
  business_id text,
  document_id text,
  version integer,
  content_hash text,
  encrypted_at_rest boolean default true,
  created_at timestamptz default now()
);

create table if not exists document_categories (
  id text primary key,
  business_id text,
  name text
);

create table if not exists document_activity_logs (
  id text primary key,
  business_id text,
  action text,
  details text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists offline_receipts (
  id text primary key,
  business_id text,
  temporary_receipt_number text,
  local_transaction_id text,
  device_id text,
  agent_id text,
  branch_id text,
  status text,
  created_at timestamptz default now()
);

create table if not exists receipt_reconciliation (
  id text primary key,
  business_id text,
  reconciliation_id text,
  temporary_receipt_number text,
  permanent_receipt_number text,
  server_transaction_id text,
  local_transaction_id text,
  synchronization_session_id text,
  mapping_timestamp timestamptz,
  reconciliation_status text,
  correlation_id text
);

create table if not exists receipt_mapping_history (
  id text primary key,
  business_id text,
  mapping_id text,
  previous_status text,
  new_status text,
  changed_at timestamptz,
  changed_by text
);

create table if not exists receipt_approvals (
  id text primary key,
  business_id text,
  document_id text,
  action text,
  amount_pesewas bigint,
  maker_id text,
  checker_id text,
  status text,
  reason text,
  created_at timestamptz default now(),
  decided_at timestamptz
);
