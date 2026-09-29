-- Wave 2 — Database Platform hardening (additive only).
-- Apply AFTER 043_platform_admin.sql. Compatible with Supabase PostgreSQL.
--
-- Normative money: integer pesewas. Defaults: interest 15, collection days 31,
-- cashier float GHS 1000 (= 100000 pesewas). Roles: Admin=Branch Manager,
-- KBA=Super Admin, SystemOwner username convention = john (app-level).
--
-- Posting truth: in-process JS remains primary for SPA/localStorage when
-- postgresSourceOfTruth is off. SQL RPCs below mirror 005 collection posting
-- for optional cloud SoT / sync — they do NOT add balance-update triggers that
-- would double-post against JS.

-- Columns normally added by 003; repeated so this runs on databases where 003 was skipped.
alter table public.businesses add column if not exists legacy_code text;
create unique index if not exists businesses_legacy_code_uq
  on public.businesses (legacy_code) where legacy_code is not null;
alter table public.branches add column if not exists client_id text;
alter table public.app_users add column if not exists client_id text;
alter table public.customers add column if not exists client_id text;
alter table public.devices add column if not exists client_id text;
alter table public.collections add column if not exists client_id text;
alter table public.sync_queue add column if not exists business_code text;
create unique index if not exists branches_client_uq on public.branches (business_id, client_id) where client_id is not null;
create unique index if not exists app_users_client_uq on public.app_users (business_id, client_id) where client_id is not null;
create unique index if not exists customers_client_uq on public.customers (business_id, client_id) where client_id is not null;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Migration / platform metadata framework
-- ---------------------------------------------------------------------------
create table if not exists public.schema_migration_log (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  version_order integer not null,
  direction text not null default 'up'
    check (direction in ('up', 'down')),
  checksum text not null default '',
  applied_by text not null default 'migration',
  notes text not null default '',
  applied_at timestamptz not null default now(),
  unique (filename, direction, applied_at)
);

create index if not exists schema_migration_log_order_idx
  on public.schema_migration_log (version_order, applied_at desc);

create table if not exists public.wave2_platform_meta (
  key text primary key,
  value_text text not null default '',
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.canonical_schema_meta (version, notes)
values (
  '2.0.0-wave2',
  'Wave 2 database platform: RLS/RPC/view/index/seed/rollback hardening on ECDAPS 001–043'
)
on conflict (version) do nothing;

insert into public.schema_migration_log (filename, version_order, direction, notes)
values (
  '044_wave2_database_platform.sql',
  44,
  'up',
  'Wave 2 platform hardening'
)
on conflict do nothing;

insert into public.wave2_platform_meta (key, value_text, value_json)
values (
  'money_defaults',
  'pesewas',
  jsonb_build_object(
    'currency', 'GHS',
    'loanInterestPercent', 15,
    'collectionDays', 31,
    'cashierLimitGhs', 1000,
    'cashierLimitPesewas', 100000,
    'moneyUnit', 'pesewas'
  )
)
on conflict (key) do update set
  value_text = excluded.value_text,
  value_json = excluded.value_json,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Offline queue cloud metadata (Phase 18 / Wave 4 alignment; JS queue remains SoT locally)
-- ---------------------------------------------------------------------------
create table if not exists public.offline_queue (
  id text primary key,
  business_id text,
  branch_id text,
  device_id text,
  agent_id text,
  kind text not null default 'unknown',
  idempotency_key text,
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'applied', 'failed', 'dead', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  local_sequence integer,
  server_sequence integer,
  correlation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create unique index if not exists offline_queue_idem_uq
  on public.offline_queue (business_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists offline_queue_status_idx
  on public.offline_queue (business_id, status, created_at);

create index if not exists offline_queue_device_idx
  on public.offline_queue (device_id, local_sequence);

-- BCDR drill evidence (extends Module 21 recovery_tests)
create table if not exists public.bcdr_drill_log (
  id text primary key,
  business_id text,
  drill_type text not null default 'backup_restore'
    check (drill_type in ('backup_restore', 'failover', 'rollback', 'rpo_rto')),
  status text not null default 'planned'
    check (status in ('planned', 'running', 'passed', 'failed', 'cancelled')),
  rpo_minutes integer,
  rto_minutes integer,
  production_touched boolean not null default false,
  evidence_ref text not null default '',
  notes text not null default '',
  started_at timestamptz,
  ended_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists bcdr_drill_log_status_idx
  on public.bcdr_drill_log (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) Relationship / constraint hardening (additive; no destructive drops)
-- ---------------------------------------------------------------------------
alter table public.collections
  add column if not exists branch_client_id text;

alter table public.ledger_entries
  add column if not exists idempotency_key text;

create unique index if not exists ledger_idem_uq
  on public.ledger_entries (business_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

-- Money non-negativity where columns exist as plain bigint (skip generated cols)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'collections'
      and column_name = 'amount_pesewas' and is_generated = 'NEVER'
  ) then
    begin
      alter table public.collections
        add constraint collections_amount_pesewas_nonneg check (amount_pesewas is null or amount_pesewas >= 0);
    exception when duplicate_object then null;
    end;
  end if;
end $$;

comment on column public.collections.amount is 'GHS numeric; amount_pesewas is integer pesewas (generated or stored).';
comment on table public.offline_queue is 'Cloud mirror of SPA offline queue metadata. Authoritative local queue remains JS/localStorage until sync.';
comment on table public.schema_migration_log is 'Wave 2 schema apply/rollback ledger (distinct from Module 25 migration_history data-exchange table).';

-- ---------------------------------------------------------------------------
-- 4) Performance indexes (tenant / branch / customer / date / sync / report)
-- ---------------------------------------------------------------------------
create index if not exists collections_branch_date_idx
  on public.collections (business_id, branch_id, collection_date);

create index if not exists collections_customer_date_idx
  on public.collections (customer_id, collection_date desc);

create index if not exists ledger_entry_type_date_idx
  on public.ledger_entries (business_id, entry_type, server_created_at desc);

create index if not exists loans_status_branch_idx
  on public.loans (business_id, status, branch_id);

create index if not exists loan_repayments_loan_date_idx
  on public.loan_repayments (loan_id, repayment_date desc);

create index if not exists audit_log_business_created_idx
  on public.audit_log (business_id, created_at desc);

create index if not exists devices_user_active_idx
  on public.devices (business_id, user_id)
  where active = true;

create index if not exists personal_savings_customer_idx
  on public.personal_savings_accounts (business_id, customer_id);

create index if not exists sync_queue_status_created_idx
  on public.sync_queue (status, created_at)
  where status is not null;

create index if not exists tenants_business_idx
  on public.tenants (business_id)
  where business_id is not null;

create index if not exists app_users_branch_role_idx
  on public.app_users (business_id, branch_id, role)
  where active = true;

-- ---------------------------------------------------------------------------
-- 5) updated_at trigger helper (timestamps only — never mutates balances)
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'branches', 'customers', 'app_users', 'susu_groups', 'loans',
    'wave2_platform_meta', 'offline_queue'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
      execute format(
        'create trigger trg_%s_updated_at before update on public.%I
         for each row execute procedure public.tg_set_updated_at()',
        t, t
      );
    end if;
  end loop;
end $$;

-- Soft audit trail for master-data changes (no money posting)
-- Matches 001_financial_core audit_log: action text, detail text, metadata jsonb
create or replace function public.tg_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.audit_log') is null then
    return coalesce(new, old);
  end if;
  begin
    insert into public.audit_log (business_id, action, detail, metadata, created_at)
    values (
      coalesce(new.business_id, old.business_id),
      tg_op || ':' || tg_table_name,
      coalesce(new.id::text, old.id::text),
      jsonb_build_object('op', tg_op, 'table', tg_table_name),
      now()
    );
  exception when undefined_column or undefined_table then
    null;
  end;
  return coalesce(new, old);
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'business_id'
  ) then
    drop trigger if exists trg_customers_audit on public.customers;
    create trigger trg_customers_audit
      after insert or update or delete on public.customers
      for each row execute procedure public.tg_audit_row_change();

    drop trigger if exists trg_branches_audit on public.branches;
    create trigger trg_branches_audit
      after insert or update or delete on public.branches
      for each row execute procedure public.tg_audit_row_change();
  end if;
exception when others then
  raise notice 'Wave2 audit triggers skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Views (summaries / KPIs) — read-only; no posting
-- ---------------------------------------------------------------------------
create or replace view public.v_branch_collection_daily as
select
  c.business_id,
  c.branch_id,
  c.collection_date,
  count(*)::bigint as collection_count,
  coalesce(sum(c.amount_pesewas), 0)::bigint as total_pesewas,
  count(*) filter (where c.reversed = true)::bigint as reversed_count
from public.collections c
group by c.business_id, c.branch_id, c.collection_date;

create or replace view public.v_customer_balance_summary as
select
  le.business_id,
  le.customer_id,
  coalesce(sum(case when le.direction = 'credit' then le.amount_pesewas else 0 end), 0)::bigint as credit_pesewas,
  coalesce(sum(case when le.direction = 'debit' then le.amount_pesewas else 0 end), 0)::bigint as debit_pesewas,
  coalesce(sum(case when le.direction = 'credit' then le.amount_pesewas else -le.amount_pesewas end), 0)::bigint as net_pesewas
from public.ledger_entries le
where le.customer_id is not null
group by le.business_id, le.customer_id;

create or replace view public.v_loan_portfolio_kpi as
select
  l.business_id,
  l.branch_id,
  l.status,
  count(*)::bigint as loan_count,
  coalesce(sum(l.principal_pesewas), 0)::bigint as principal_pesewas,
  coalesce(sum(l.disbursed_pesewas), 0)::bigint as disbursed_pesewas
from public.loans l
group by l.business_id, l.branch_id, l.status;

create or replace view public.v_cashbook_daily as
select
  le.business_id,
  le.branch_id,
  (le.server_created_at at time zone 'Africa/Accra')::date as book_date,
  le.entry_type,
  le.payment_method,
  coalesce(sum(case when le.direction = 'credit' then le.amount_pesewas else 0 end), 0)::bigint as inflow_pesewas,
  coalesce(sum(case when le.direction = 'debit' then le.amount_pesewas else 0 end), 0)::bigint as outflow_pesewas
from public.ledger_entries le
group by le.business_id, le.branch_id, (le.server_created_at at time zone 'Africa/Accra')::date, le.entry_type, le.payment_method;

create or replace view public.v_dashboard_ops_kpi as
select
  b.id as business_id,
  b.code as business_code,
  (select count(*) from public.customers c where c.business_id = b.id and c.active = true) as active_customers,
  (select count(*) from public.branches br where br.business_id = b.id and br.active = true) as active_branches,
  (select count(*) from public.collections col
     where col.business_id = b.id and col.collection_date = current_date and col.reversed = false) as collections_today,
  (select coalesce(sum(col.amount_pesewas), 0) from public.collections col
     where col.business_id = b.id and col.collection_date = current_date and col.reversed = false) as collection_pesewas_today,
  (select count(*) from public.loans l where l.business_id = b.id and l.status in ('Active', 'Disbursed', 'Outstanding')) as open_loans
from public.businesses b;

comment on view public.v_branch_collection_daily is 'Wave 2 KPI: daily collections by branch (pesewas).';
comment on view public.v_cashbook_daily is 'Wave 2 KPI: cashbook-style ledger rollup; JS cashbook engine remains authoritative for posting.';

-- ---------------------------------------------------------------------------
-- 7) RLS hardening (tenant isolation via JWT business_id)
-- ---------------------------------------------------------------------------
alter table public.schema_migration_log enable row level security;
alter table public.wave2_platform_meta enable row level security;
alter table public.offline_queue enable row level security;
alter table public.bcdr_drill_log enable row level security;

-- Core money / ops tables that may lack policies after later migrations
do $$
declare t text;
begin
  foreach t in array array[
    'loans', 'loan_repayments', 'loan_disbursements',
    'journal_lines', 'chart_of_accounts', 'idempotency_keys',
    'system_events', 'sessions', 'roles', 'permissions',
    'role_permissions', 'user_roles', 'system_settings', 'user_preferences'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

create or replace function public.jwt_branch_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'branch_id', '')::uuid;
$$;

create or replace function public.jwt_is_elevated_role()
returns boolean language sql stable as $$
  select public.jwt_app_role() in (
    'Owner', 'KBA', 'SystemOwner', 'Admin', 'AssistantManager', 'Auditor', 'PlatformAdmin'
  );
$$;

create or replace function public.policy_collector_customer_match(p_collector_id uuid)
returns boolean language sql stable as $$
  select
    public.jwt_is_elevated_role()
    or p_collector_id is null
    or p_collector_id::text = coalesce(auth.jwt() ->> 'app_user_id', auth.jwt() ->> 'sub', '')
    or public.jwt_business_id() is null;
$$;

-- Re-apply tenant policies on uuid business_id tables (idempotent)
do $$
declare t text;
begin
  foreach t in array array[
    'branches','app_users','devices','customers','collections',
    'ledger_entries','reversals','handovers','exceptions','audit_log',
    'susu_groups','susu_group_members','group_distributions',
    'savings_products','personal_savings_accounts','collector_assignments',
    'user_mfa_secrets','momo_webhook_events',
    'loans','loan_repayments','idempotency_keys','system_events','system_settings'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'business_id'
        and data_type = 'uuid'
    ) then
      execute format('drop policy if exists tenant_select on public.%I', t);
      execute format('drop policy if exists tenant_insert on public.%I', t);
      execute format('drop policy if exists tenant_update on public.%I', t);
      execute format('drop policy if exists tenant_delete on public.%I', t);
      execute format(
        'create policy tenant_select on public.%I for select using (
           business_id = public.jwt_business_id() or public.jwt_business_id() is null
         )', t);
      execute format(
        'create policy tenant_insert on public.%I for insert with check (
           business_id = public.jwt_business_id() or public.jwt_business_id() is null
         )', t);
      execute format(
        'create policy tenant_update on public.%I for update using (
           business_id = public.jwt_business_id() or public.jwt_business_id() is null
         )', t);
      execute format(
        'create policy tenant_delete on public.%I for delete using (
           public.jwt_is_elevated_role() and (
             business_id = public.jwt_business_id() or public.jwt_business_id() is null
           )
         )', t);
    end if;
  end loop;
exception when others then
  raise notice 'Wave2 RLS uuid loop: %', sqlerrm;
end $$;

-- Collector-scoped read on customers (elevated roles see all in tenant)
drop policy if exists collector_customers_select on public.customers;
create policy collector_customers_select on public.customers
  for select using (
    business_id = public.jwt_business_id()
    or public.jwt_business_id() is null
    or public.policy_collector_customer_match(collector_id)
  );

-- Meta tables: authenticated read; elevated write
drop policy if exists wave2_meta_select on public.wave2_platform_meta;
create policy wave2_meta_select on public.wave2_platform_meta
  for select to authenticated using (true);

drop policy if exists wave2_meta_write on public.wave2_platform_meta;
create policy wave2_meta_write on public.wave2_platform_meta
  for all to authenticated
  using (public.jwt_is_elevated_role())
  with check (public.jwt_is_elevated_role());

drop policy if exists schema_mig_select on public.schema_migration_log;
create policy schema_mig_select on public.schema_migration_log
  for select to authenticated using (public.jwt_is_elevated_role() or public.jwt_app_role() = 'Auditor');

drop policy if exists offline_queue_tenant on public.offline_queue;
create policy offline_queue_tenant on public.offline_queue
  for all to authenticated
  using (
    business_id is null
    or business_id = coalesce(public.jwt_business_id()::text, business_id)
    or public.jwt_business_id() is null
  )
  with check (true);

drop policy if exists bcdr_elevated on public.bcdr_drill_log;
create policy bcdr_elevated on public.bcdr_drill_log
  for all to authenticated
  using (public.jwt_is_elevated_role() or public.jwt_app_role() = 'Auditor')
  with check (public.jwt_is_elevated_role());

-- ---------------------------------------------------------------------------
-- 8) RPCs — validation + transactions; align with JS ops contracts
-- ---------------------------------------------------------------------------

-- Customer upsert (persistence helper; does not invent account numbers)
create or replace function public.upsert_customer_from_client(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_branch_id uuid;
  v_collector_id uuid;
  v_customer_id uuid;
  v_client_id text := payload->>'customer_client_id';
begin
  if coalesce(v_client_id, '') = '' then
    raise exception 'customer_client_id required';
  end if;
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;
  v_branch_id := public.ensure_branch(
    v_business_id,
    coalesce(payload->>'branch_client_id', 'default'),
    coalesce(payload->>'branch_name', 'Main Branch')
  );
  v_collector_id := public.ensure_app_user(
    v_business_id,
    coalesce(payload->>'collector_client_id', 'system'),
    payload->>'collector_username',
    payload->>'collector_name',
    coalesce(payload->>'collector_role', 'Collector'),
    v_branch_id
  );
  select id into v_customer_id from public.customers
  where business_id = v_business_id and client_id = v_client_id;
  if v_customer_id is null then
    insert into public.customers (
      business_id, branch_id, collector_id, client_id, account_no, name, phone, active
    ) values (
      v_business_id, v_branch_id, v_collector_id, v_client_id,
      coalesce(payload->>'account_no', v_client_id),
      coalesce(payload->>'customer_name', 'Member'),
      coalesce(payload->>'customer_phone', ''),
      coalesce((payload->>'active')::boolean, true)
    ) returning id into v_customer_id;
  else
    update public.customers set
      name = coalesce(nullif(payload->>'customer_name', ''), name),
      phone = coalesce(nullif(payload->>'customer_phone', ''), phone),
      branch_id = v_branch_id,
      collector_id = v_collector_id,
      updated_at = now()
    where id = v_customer_id;
  end if;
  return jsonb_build_object('ok', true, 'customer_id', v_customer_id, 'business_id', v_business_id);
end;
$$;

-- Savings deposit persistence (pesewas). Mirrors collection path when cloud SoT on.
create or replace function public.record_deposit_from_client(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_idempotency text := payload->>'idempotency_key';
  v_existing uuid;
  v_branch_id uuid;
  v_collector_id uuid;
  v_customer_id uuid;
  v_ledger_id uuid;
  v_pesewas bigint := coalesce((payload->>'amount_pesewas')::bigint, round(coalesce((payload->>'amount')::numeric, 0) * 100)::bigint);
  v_amount numeric;
  v_receipt text := coalesce(payload->>'receipt_no', '');
begin
  if coalesce(v_idempotency, '') = '' then
    raise exception 'idempotency_key required';
  end if;
  if v_pesewas is null or v_pesewas < 0 then
    raise exception 'amount_pesewas must be >= 0';
  end if;
  v_amount := (v_pesewas::numeric / 100.0);
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;

  select id into v_existing from public.ledger_entries
  where business_id = v_business_id and idempotency_key = v_idempotency;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'ledger_id', v_existing);
  end if;

  v_branch_id := public.ensure_branch(v_business_id, coalesce(payload->>'branch_client_id', 'default'), payload->>'branch_name');
  v_collector_id := public.ensure_app_user(
    v_business_id, coalesce(payload->>'collector_client_id', 'system'),
    payload->>'collector_username', payload->>'collector_name',
    coalesce(payload->>'collector_role', 'Collector'), v_branch_id
  );
  v_customer_id := public.ensure_customer(
    v_business_id, payload->>'customer_client_id',
    coalesce(payload->>'account_no', payload->>'customer_client_id'),
    coalesce(payload->>'customer_name', 'Member'),
    v_branch_id, v_collector_id, payload->>'customer_phone'
  );

  insert into public.ledger_entries (
    business_id, entry_type, customer_id, branch_id, collector_id,
    amount, direction, reference_type, receipt_no, payment_method,
    payment_reference, created_by, client_created_at, idempotency_key
  ) values (
    v_business_id, 'Susu Deposit', v_customer_id, v_branch_id, v_collector_id,
    v_amount, 'credit', 'deposit', v_receipt,
    coalesce(payload->>'payment_method', 'Cash'),
    coalesce(payload->>'payment_reference', ''),
    v_collector_id, now(), v_idempotency
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'status', 'recorded',
    'ledger_id', v_ledger_id,
    'amount_pesewas', v_pesewas,
    'posting_note', 'Cloud persistence RPC; SPA JS remains SoT when postgresSourceOfTruth is false'
  );
end;
$$;

-- Withdrawal request row + ledger debit (approval workflow still owned by JS Module 9)
create or replace function public.record_withdrawal_from_client(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_idempotency text := payload->>'idempotency_key';
  v_existing uuid;
  v_branch_id uuid;
  v_collector_id uuid;
  v_customer_id uuid;
  v_ledger_id uuid;
  v_pesewas bigint := coalesce((payload->>'amount_pesewas')::bigint, 0);
  v_amount numeric;
begin
  if coalesce(v_idempotency, '') = '' then
    raise exception 'idempotency_key required';
  end if;
  if v_pesewas <= 0 then
    raise exception 'amount_pesewas must be > 0';
  end if;
  -- Soft cashier float guard (GHS 1000 = 100000 pesewas) for teller role
  if coalesce(payload->>'role', '') in ('Cashier', 'Teller') and v_pesewas > 100000 then
    raise exception 'cashier float limit exceeded (100000 pesewas / GHS 1000)';
  end if;
  v_amount := (v_pesewas::numeric / 100.0);
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;
  select id into v_existing from public.ledger_entries
  where business_id = v_business_id and idempotency_key = v_idempotency;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'ledger_id', v_existing);
  end if;

  v_branch_id := public.ensure_branch(v_business_id, coalesce(payload->>'branch_client_id', 'default'), payload->>'branch_name');
  v_collector_id := public.ensure_app_user(
    v_business_id, coalesce(payload->>'actor_client_id', 'system'),
    payload->>'actor_username', payload->>'actor_name',
    coalesce(payload->>'role', 'Cashier'), v_branch_id
  );
  v_customer_id := public.ensure_customer(
    v_business_id, payload->>'customer_client_id',
    coalesce(payload->>'account_no', payload->>'customer_client_id'),
    coalesce(payload->>'customer_name', 'Member'),
    v_branch_id, v_collector_id, payload->>'customer_phone'
  );

  insert into public.ledger_entries (
    business_id, entry_type, customer_id, branch_id, collector_id,
    amount, direction, reference_type, receipt_no, payment_method,
    reason, created_by, client_created_at, idempotency_key
  ) values (
    v_business_id, 'Withdrawal', v_customer_id, v_branch_id, v_collector_id,
    v_amount, 'debit', 'withdrawal', coalesce(payload->>'receipt_no', ''),
    coalesce(payload->>'payment_method', 'Cash'),
    coalesce(payload->>'reason', ''), v_collector_id, now(), v_idempotency
  ) returning id into v_ledger_id;

  return jsonb_build_object('status', 'recorded', 'ledger_id', v_ledger_id, 'amount_pesewas', v_pesewas);
end;
$$;

-- Loan repayment persistence (interest rate default 15% is product-level; not auto-applied here)
create or replace function public.record_loan_repayment_from_client(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_loan_id uuid;
  v_customer_id uuid;
  v_repay_id uuid;
  v_idempotency text := payload->>'idempotency_key';
  v_pesewas bigint := coalesce((payload->>'amount_pesewas')::bigint, 0);
  v_existing uuid;
begin
  if coalesce(v_idempotency, '') = '' then
    raise exception 'idempotency_key required';
  end if;
  if v_pesewas <= 0 then
    raise exception 'amount_pesewas must be > 0';
  end if;
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;
  select id into v_existing from public.loan_repayments
  where business_id = v_business_id and idempotency_key = v_idempotency;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'repayment_id', v_existing);
  end if;

  select id, customer_id into v_loan_id, v_customer_id from public.loans
  where business_id = v_business_id
    and (id::text = payload->>'loan_id' or client_id = payload->>'loan_client_id')
  limit 1;
  if v_loan_id is null then
    raise exception 'loan not found';
  end if;

  insert into public.loan_repayments (
    business_id, loan_id, customer_id, amount_pesewas,
    principal_pesewas, interest_pesewas, payment_method, reference,
    status, repayment_date, idempotency_key
  ) values (
    v_business_id, v_loan_id, v_customer_id, v_pesewas,
    coalesce((payload->>'principal_pesewas')::bigint, v_pesewas),
    coalesce((payload->>'interest_pesewas')::bigint, 0),
    coalesce(payload->>'payment_method', 'Cash'),
    coalesce(payload->>'reference', ''),
    'Posted',
    coalesce((payload->>'repayment_date')::date, current_date),
    v_idempotency
  ) returning id into v_repay_id;

  return jsonb_build_object('status', 'recorded', 'repayment_id', v_repay_id, 'amount_pesewas', v_pesewas);
end;
$$;

-- EOD snapshot (read aggregates → system_events; does not close books in JS)
create or replace function public.record_eod_snapshot(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_event_id uuid;
  v_day date := coalesce((payload->>'business_date')::date, current_date);
  v_summary jsonb;
begin
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;
  select jsonb_build_object(
    'business_date', v_day,
    'collections_pesewas', coalesce(sum(c.amount_pesewas) filter (where c.reversed = false), 0),
    'collection_count', count(*) filter (where c.reversed = false),
    'defaults', (select value_json from public.wave2_platform_meta where key = 'money_defaults')
  )
  into v_summary
  from public.collections c
  where c.business_id = v_business_id and c.collection_date = v_day;

  insert into public.system_events (business_id, event_type, entity_type, entity_id, payload)
  values (v_business_id, 'eod.snapshot', 'business_day', v_day::text, coalesce(v_summary, '{}'::jsonb))
  returning id into v_event_id;

  return jsonb_build_object('ok', true, 'event_id', v_event_id, 'summary', v_summary);
end;
$$;

create or replace function public.fetch_cashbook_summary(p_business_code text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.resolve_business_id(p_business_code);
  v_rows jsonb;
begin
  if v_business_id is null then
    return jsonb_build_object('ok', false, 'error', 'business_not_found');
  end if;
  select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) into v_rows
  from public.v_cashbook_daily v
  where v.business_id = v_business_id
    and v.book_date between coalesce(p_from, current_date - 30) and coalesce(p_to, current_date);
  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

create or replace function public.fetch_dashboard_kpis(p_business_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.resolve_business_id(p_business_code);
  v_row public.v_dashboard_ops_kpi%rowtype;
begin
  if v_business_id is null then
    return jsonb_build_object('ok', false, 'error', 'business_not_found');
  end if;
  select * into v_row from public.v_dashboard_ops_kpi where business_id = v_business_id;
  return jsonb_build_object(
    'ok', true,
    'kpis', to_jsonb(v_row),
    'money_defaults', (select value_json from public.wave2_platform_meta where key = 'money_defaults')
  );
end;
$$;

create or replace function public.ack_sync_queue_item(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', payload->>'queue_id');
  v_status text := coalesce(payload->>'status', 'applied');
begin
  if coalesce(v_id, '') = '' then
    raise exception 'id required';
  end if;
  update public.offline_queue
  set status = v_status,
      last_error = coalesce(payload->>'last_error', last_error),
      server_sequence = coalesce((payload->>'server_sequence')::integer, server_sequence),
      applied_at = case when v_status = 'applied' then now() else applied_at end,
      updated_at = now()
  where id = v_id;
  if found then
    return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status, 'store', 'offline_queue');
  end if;
  -- Best-effort against uuid sync_queue from 001 if present
  begin
    execute $q$
      update public.sync_queue
      set status = $1, applied_at = case when $1 = 'applied' then now() else applied_at end
      where id::text = $2 or idempotency_key = $2
    $q$ using v_status, v_id;
  exception when others then
    null;
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

create or replace function public.append_audit_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_id bigint;
begin
  v_business_id := public.resolve_business_id(payload->>'business_code');
  if v_business_id is null then
    raise exception 'business_code not found';
  end if;
  insert into public.audit_log (business_id, action, detail, metadata, created_at)
  values (
    v_business_id,
    coalesce(payload->>'action', 'unknown'),
    coalesce(payload->>'entity_id', payload->>'detail', ''),
    coalesce(payload->'metadata', payload->'detail', '{}'::jsonb),
    now()
  ) returning id into v_id;
  return jsonb_build_object('ok', true, 'audit_id', v_id);
end;
$$;

create or replace function public.enqueue_offline_item(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', gen_random_uuid()::text);
begin
  insert into public.offline_queue (
    id, business_id, branch_id, device_id, agent_id, kind, idempotency_key,
    status, payload, local_sequence, correlation_id
  ) values (
    v_id,
    payload->>'business_id',
    payload->>'branch_id',
    payload->>'device_id',
    payload->>'agent_id',
    coalesce(payload->>'kind', 'unknown'),
    payload->>'idempotency_key',
    coalesce(payload->>'status', 'pending'),
    coalesce(payload->'payload', '{}'::jsonb),
    (payload->>'local_sequence')::integer,
    payload->>'correlation_id'
  )
  on conflict (id) do update set
    status = excluded.status,
    payload = excluded.payload,
    updated_at = now();
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.upsert_customer_from_client(jsonb) to authenticated;
grant execute on function public.record_deposit_from_client(jsonb) to authenticated;
grant execute on function public.record_withdrawal_from_client(jsonb) to authenticated;
grant execute on function public.record_loan_repayment_from_client(jsonb) to authenticated;
grant execute on function public.record_eod_snapshot(jsonb) to authenticated;
grant execute on function public.fetch_cashbook_summary(text, date, date) to authenticated;
grant execute on function public.fetch_dashboard_kpis(text) to authenticated;
grant execute on function public.ack_sync_queue_item(jsonb) to authenticated;
grant execute on function public.append_audit_event(jsonb) to authenticated;
grant execute on function public.enqueue_offline_item(jsonb) to authenticated;
grant execute on function public.jwt_branch_id() to authenticated, anon;
grant execute on function public.jwt_is_elevated_role() to authenticated, anon;
grant execute on function public.policy_collector_customer_match(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 9) Seeds (idempotent): permissions, role maps, demo tenant/branch/users, products
-- ---------------------------------------------------------------------------
insert into public.permissions (code, name, module) values
  ('Owner.Transfer', 'Transfer system ownership', 'platform'),
  ('System.Reset', 'Reset system data', 'platform'),
  ('Export.All', 'Export all data', 'platform'),
  ('Platform.View', 'View platform admin', 'platform'),
  ('Branch.Manage', 'Manage branches', 'branches'),
  ('Collection.Post', 'Post collections', 'collections'),
  ('Loan.View', 'View loans', 'loans'),
  ('Accounting.View', 'View accounting', 'accounting'),
  ('Sync.Manage', 'Manage sync queue', 'sync'),
  ('Audit.Export', 'Export audit', 'audit')
on conflict (code) do nothing;

-- Ensure system roles exist (codes match app RBAC names)
insert into public.roles (id, business_id, code, name, description, is_system_role)
select gen_random_uuid(), null, v.code, v.name, v.description, true
from (values
  ('SystemOwner', 'System Owner', 'Full platform owner; username convention john'),
  ('KBA', 'Super Administrator', 'Super admin; forbidden Owner.Transfer/System.Reset/Export.All'),
  ('Admin', 'Branch Manager', 'Branch manager (Admin role)'),
  ('Collector', 'Agent / Collector', 'Field collector'),
  ('Accountant', 'Accountant', 'Accounting'),
  ('Cashier', 'Cashier', 'Teller/cashier; float GHS 1000'),
  ('Auditor', 'Auditor', 'Read-focused auditor'),
  ('Teller', 'Teller', 'Alias teller role')
) as v(code, name, description)
where not exists (select 1 from public.roles r where r.code = v.code and r.business_id is null);

-- Grant all non-forbidden permissions to SystemOwner
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'SystemOwner' and r.business_id is null
on conflict do nothing;

-- KBA: all except SUPER_ADMIN_FORBIDDEN
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'KBA' and r.business_id is null
  and p.code not in ('Owner.Transfer', 'System.Reset', 'Export.All')
on conflict do nothing;

-- Admin (Branch Manager)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'Admin' and r.business_id is null
  and p.code in (
    'Customer.View','Customer.Create','Customer.Edit',
    'Savings.Collect','Withdrawal.Create','Withdrawal.Approve','Withdrawal.Pay',
    'Loan.Create','Loan.Approve','Loan.View','Reports.View','Reports.Export',
    'Audit.View','Branch.Manage','Collection.Post','Accounting.View','User.Create'
  )
on conflict do nothing;

-- Collector
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'Collector' and r.business_id is null
  and p.code in ('Customer.View','Savings.Collect','Collection.Post','Loan.View')
on conflict do nothing;

-- Cashier / Teller
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('Cashier', 'Teller') and r.business_id is null
  and p.code in ('Customer.View','Withdrawal.Create','Withdrawal.Pay','Savings.Collect','Collection.Post')
on conflict do nothing;

-- Auditor
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'Auditor' and r.business_id is null
  and p.code in ('Customer.View','Reports.View','Audit.View','Audit.Export','Accounting.View','Loan.View','Platform.View')
on conflict do nothing;

-- Demo business / branch / users / customer / product (idempotent)
insert into public.businesses (id, code, name, currency, legacy_code)
select gen_random_uuid(), 'SMILE-TRUST', 'Smile Trust', 'GHS', 'SMILE-TRUST'
where not exists (select 1 from public.businesses where code = 'SMILE-TRUST' or legacy_code = 'SMILE-TRUST');

insert into public.receipt_sequences (business_id, last_value)
select b.id, 0 from public.businesses b
where b.code = 'SMILE-TRUST'
  and not exists (select 1 from public.receipt_sequences rs where rs.business_id = b.id);

do $$
declare
  v_biz uuid;
  v_branch uuid;
  v_owner uuid;
  v_admin uuid;
  v_collector uuid;
  v_customer uuid;
begin
  select id into v_biz from public.businesses where code = 'SMILE-TRUST' or legacy_code = 'SMILE-TRUST' limit 1;
  if v_biz is null then return; end if;

  select id into v_branch from public.branches where business_id = v_biz and client_id = 'demo-branch-accra';
  if v_branch is null then
    insert into public.branches (business_id, name, client_id, active, collector_code)
    values (v_biz, 'Accra Main', 'demo-branch-accra', true, 'ACC')
    returning id into v_branch;
  end if;

  select id into v_owner from public.app_users where business_id = v_biz and client_id = 'demo-user-john';
  if v_owner is null then
    insert into public.app_users (business_id, username, name, role, branch_id, client_id, active)
    values (v_biz, 'john', 'System Owner', 'Owner', v_branch, 'demo-user-john', true)
    returning id into v_owner;
  end if;

  select id into v_admin from public.app_users where business_id = v_biz and client_id = 'demo-user-ama';
  if v_admin is null then
    insert into public.app_users (business_id, username, name, role, branch_id, client_id, active)
    values (v_biz, 'ama', 'Ama Branch Manager', 'AssistantManager', v_branch, 'demo-user-ama', true)
    returning id into v_admin;
  end if;

  select id into v_collector from public.app_users where business_id = v_biz and client_id = 'demo-user-kwame';
  if v_collector is null then
    insert into public.app_users (business_id, username, name, role, branch_id, client_id, active, collector_code)
    values (v_biz, 'kwame', 'Kwame Collector', 'Collector', v_branch, 'demo-user-kwame', true, 'KW1')
    returning id into v_collector;
  end if;

  select id into v_customer from public.customers where business_id = v_biz and client_id = 'demo-customer-001';
  if v_customer is null then
    insert into public.customers (business_id, branch_id, collector_id, client_id, account_no, name, phone, active)
    values (v_biz, v_branch, v_collector, 'demo-customer-001', 'ST-1001', 'Demo Member', '233200000001', true);
  end if;

  if to_regclass('public.savings_products') is not null then
    insert into public.savings_products (
      business_id, code, name, product_type, collection_type, frequency,
      min_amount_pesewas, default_amount_pesewas, fee_pesewas, active
    )
    select v_biz, 'SUSU-DAILY', 'Daily Susu', 'personal_daily', 'personal', 'Daily',
           100, 500, 0, true
    where not exists (
      select 1 from public.savings_products sp where sp.business_id = v_biz and lower(sp.code) = 'susu-daily'
    );
  end if;

  -- Link demo users to role codes where user_roles exists
  insert into public.user_roles (user_id, role_id)
  select v_owner, r.id from public.roles r where r.code = 'SystemOwner' and r.business_id is null
  on conflict do nothing;
  insert into public.user_roles (user_id, role_id)
  select v_admin, r.id from public.roles r where r.code = 'Admin' and r.business_id is null
  on conflict do nothing;
  insert into public.user_roles (user_id, role_id)
  select v_collector, r.id from public.roles r where r.code = 'Collector' and r.business_id is null
  on conflict do nothing;
end $$;

-- Seed money defaults into system_settings when uuid shape exists
do $$
declare v_biz uuid;
begin
  select id into v_biz from public.businesses where code = 'SMILE-TRUST' limit 1;
  if v_biz is null then return; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'system_settings'
      and column_name = 'setting_key'
  ) then
    insert into public.system_settings (business_id, setting_key, setting_value, value_type, description)
    values
      (v_biz, 'loan.interest_percent', '15', 'number', 'Default loan interest percent'),
      (v_biz, 'collection.days', '31', 'number', 'Default collection cycle days'),
      (v_biz, 'cashier.limit_ghs', '1000', 'number', 'Cashier float limit GHS'),
      (v_biz, 'cashier.limit_pesewas', '100000', 'number', 'Cashier float limit pesewas'),
      (v_biz, 'money.unit', 'pesewas', 'string', 'Canonical money unit')
    on conflict (business_id, setting_key) do update set
      setting_value = excluded.setting_value,
      updated_at = now();
  end if;
end $$;

-- Align tenant_configurations defaults (already seeded in 043; reinforce)
update public.tenant_configurations
set loan_interest_default = 15,
    collection_days_default = 31,
    currency = coalesce(currency, 'GHS'),
    updated_at = now()
where tenant_id = 'tenant-smile-trust';

insert into public.bcdr_drill_log (id, business_id, drill_type, status, notes, created_by)
values (
  'bcdr-seed-lab',
  'SMILE-TRUST',
  'rollback',
  'planned',
  'Lab rollback drill placeholder for Wave 2 exit evidence',
  'system'
)
on conflict (id) do nothing;

insert into public.wave2_platform_meta (key, value_text, value_json)
values (
  'wave2_status',
  'hardened',
  jsonb_build_object(
    'migration', '044_wave2_database_platform.sql',
    'postingAuthority', 'js_primary_sql_optional',
    'rls', 'tenant_jwt',
    'completedAt', now()
  )
)
on conflict (key) do update set
  value_text = excluded.value_text,
  value_json = excluded.value_json,
  updated_at = now();
