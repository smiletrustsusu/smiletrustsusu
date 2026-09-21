-- Customer CRM extensions: contacts, KYC, notes, status history, documents.
-- Existing customers / beneficiaries / savings_accounts tables remain the source of truth.

alter table if exists customers
  add column if not exists membership_number text,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists phone_secondary text,
  add column if not exists postal_address text,
  add column if not exists region text,
  add column if not exists district text,
  add column if not exists town text,
  add column if not exists employer_address text,
  add column if not exists id_type text,
  add column if not exists id_number text,
  add column if not exists id_expiry date,
  add column if not exists category text,
  add column if not exists collection_route text,
  add column if not exists kyc_status text default 'Pending',
  add column if not exists next_of_kin_relationship text,
  add column if not exists next_of_kin_address text,
  add column if not exists next_of_kin_occupation text;

create table if not exists customer_notes (
  id text primary key,
  business_id text,
  customer_id text not null references customers(id) on delete cascade,
  note_type text,
  body text not null,
  user_id text,
  branch_id text,
  created_at timestamptz default now()
);

create table if not exists customer_documents (
  id text primary key,
  business_id text,
  customer_id text not null references customers(id) on delete cascade,
  doc_type text,
  reference text,
  file_name text,
  uploaded_at timestamptz default now()
);

create table if not exists customer_status_history (
  id text primary key,
  business_id text,
  customer_id text not null references customers(id) on delete cascade,
  from_status text,
  to_status text,
  user_id text,
  created_at timestamptz default now()
);

create table if not exists customer_activity_log (
  id text primary key,
  business_id text,
  customer_id text not null references customers(id) on delete cascade,
  action text,
  detail text,
  user_id text,
  created_at timestamptz default now()
);

create index if not exists idx_customers_phone on customers (business_id, phone);
create index if not exists idx_customers_number on customers (business_id, customer_number);
create index if not exists idx_customers_kyc on customers (business_id, kyc_status);
create table if not exists customer_qr_codes (
  id text primary key,
  business_id text,
  customer_id text not null references customers(id) on delete cascade,
  qr_value text not null,
  created_at timestamptz default now()
);

create index if not exists idx_customer_notes_customer on customer_notes (customer_id);
create index if not exists idx_customer_activity_customer on customer_activity_log (customer_id);
create index if not exists idx_customer_qr_customer on customer_qr_codes (customer_id);
create index if not exists idx_customers_id_number on customers (business_id, id_number);
