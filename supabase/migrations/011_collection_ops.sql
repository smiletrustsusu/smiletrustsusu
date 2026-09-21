-- Individual savings collection extensions. Existing collections remain the source of truth.

alter table if exists public.collections
  drop constraint if exists collections_payment_method_check;

alter table if exists public.collections
  add constraint collections_payment_method_check
  check (payment_method in (
    'Cash',
    'Mobile Money',
    'MTN Mobile Money',
    'Telecel Cash',
    'AirtelTigo Money',
    'Bank Transfer',
    'POS/Card',
    'Cheque'
  ));

alter table if exists public.collections
  add column if not exists savings_product_id text,
  add column if not exists visit_outcome text,
  add column if not exists sync_status text,
  add column if not exists customer_confirmed boolean default false,
  add column if not exists signature text,
  add column if not exists gps_lat text,
  add column if not exists gps_lng text;

alter table if exists public.savings_products
  add column if not exists max_amount_pesewas bigint default 0,
  add column if not exists penalty_pesewas bigint default 0,
  add column if not exists maturity_months integer default 0,
  add column if not exists large_deposit_alert numeric;

alter table if exists public.ledger_entries
  drop constraint if exists ledger_entries_entry_type_check;

alter table if exists public.ledger_entries
  add constraint ledger_entries_entry_type_check
  check (entry_type in (
    'Susu Deposit',
    'Withdrawal',
    'Loan Disbursement',
    'Loan Repayment',
    'Interest Payment',
    'Reversal',
    'Adjustment',
    'Collection Adjustment',
    'Service Charge'
  ));

create table if not exists collection_adjustments (
  id text primary key,
  business_id text,
  collection_id text not null,
  original_amount numeric,
  amount numeric not null,
  reason text not null,
  requested_by text,
  approved_by text,
  status text default 'Pending',
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table if not exists collection_targets (
  id text primary key,
  business_id text,
  agent_id text,
  branch_id text,
  date date,
  amount numeric,
  created_at timestamptz default now()
);

create table if not exists collection_activity_logs (
  id text primary key,
  business_id text,
  collection_id text,
  action text,
  detail text,
  user_id text,
  created_at timestamptz default now()
);

create index if not exists collection_adjustments_status_idx on collection_adjustments (status);
create index if not exists collection_activity_logs_collection_idx on collection_activity_logs (collection_id);
