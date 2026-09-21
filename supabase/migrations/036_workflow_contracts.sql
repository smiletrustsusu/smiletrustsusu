-- Module 23 public workflow contracts and callback registry. Additive only.
-- Does not alter collection, loan, or ledger tables.

create table if not exists workflow_callbacks (
  id text primary key,
  business_id text,
  event text not null,
  endpoint text,
  contract_id text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists workflow_callback_deliveries (
  id text primary key,
  business_id text,
  callback_id text,
  event text,
  endpoint text,
  contract_id text,
  correlation_id text,
  channel text,
  delivered_at timestamptz
);

create index if not exists workflow_callbacks_event_idx on workflow_callbacks (event);
create index if not exists workflow_callback_deliveries_event_idx on workflow_callback_deliveries (event);
