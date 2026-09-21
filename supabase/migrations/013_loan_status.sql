-- Loan status history for Smile Trust. Additive only; does not alter existing loan records.

create table if not exists loan_status_history (
  id text primary key,
  business_id text,
  loan_id text not null,
  customer_id text,
  previous_status text,
  new_status text,
  requested_status text,
  user_id text,
  role text,
  branch_id text,
  device text,
  ip_address text,
  reason text,
  approval_reference text,
  rejected boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_loan_status_history_loan on loan_status_history (loan_id, created_at);
create index if not exists idx_loan_status_history_customer on loan_status_history (customer_id, created_at);
