-- Module 26 digital records / ECM. Additive only.
-- Module 17 already owns receipt-centric documents / document_versions / document_metadata.

create table if not exists ecm_documents (
  id text primary key,
  business_id text,
  document_number text,
  type text,
  category text,
  owner_entity text,
  owner_id text,
  branch_id text,
  uploaded_by text,
  uploaded_at timestamptz,
  file_name text,
  file_size integer,
  mime_type text,
  storage_location text,
  checksum text,
  version text,
  classification text,
  retention_policy_id text,
  encryption_status text,
  signature_status text,
  status text,
  source_module integer,
  source_id text,
  created_at timestamptz default now()
);

create table if not exists ecm_document_versions (
  id text primary key,
  business_id text,
  record_id text,
  major integer,
  minor integer,
  label text,
  current boolean default false,
  checksum text,
  file_size integer,
  previous_version_id text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists ecm_document_metadata (
  id text primary key,
  business_id text,
  record_id text,
  fields jsonb,
  created_at timestamptz default now()
);

create table if not exists document_tags (
  id text primary key,
  business_id text,
  record_id text,
  tag text,
  created_at timestamptz default now()
);

create table if not exists document_access_logs (
  id text primary key,
  business_id text,
  record_id text,
  action text,
  user_id text,
  branch_id text,
  created_at timestamptz default now()
);

create table if not exists document_retention_policies (
  id text primary key,
  business_id text,
  classification text,
  retain_days integer,
  allow_delete boolean default false,
  auto_archive_days integer,
  updated_at timestamptz default now()
);

create table if not exists document_archives (
  id text primary key,
  business_id text,
  record_id text,
  archived_by text,
  created_at timestamptz default now()
);

create table if not exists document_downloads (
  id text primary key,
  business_id text,
  record_id text,
  token text,
  user_id text,
  expires_at timestamptz,
  used boolean default false,
  created_at timestamptz default now()
);

create table if not exists document_shares (
  id text primary key,
  business_id text,
  record_id text,
  to_user_id text,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists document_legal_holds (
  id text primary key,
  business_id text,
  record_id text,
  reason text,
  status text,
  placed_by text,
  released_by text,
  created_at timestamptz default now(),
  released_at timestamptz
);

create table if not exists document_checksums (
  id text primary key,
  business_id text,
  record_id text,
  version_id text,
  checksum text,
  created_at timestamptz default now()
);

create index if not exists ecm_documents_branch_idx on ecm_documents (branch_id, status);
create index if not exists ecm_documents_owner_idx on ecm_documents (owner_entity, owner_id);
create index if not exists document_tags_record_idx on document_tags (record_id, tag);
create index if not exists document_legal_holds_record_idx on document_legal_holds (record_id, status);
