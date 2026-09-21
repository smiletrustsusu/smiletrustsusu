-- Smile Trust Susu — production auth, RLS, full relational RPCs, MFA, MoMo webhooks
-- Run AFTER 001, 002, 003, 004. Back up first.

-- ---------------------------------------------------------------------------
-- Business webhook secret + auth email on users
-- ---------------------------------------------------------------------------
alter table public.businesses add column if not exists momo_webhook_secret text;

alter table public.app_users add column if not exists auth_email text;
create unique index if not exists app_users_auth_email_uq
  on public.app_users (business_id, lower(auth_email))
  where auth_email is not null and auth_email <> '';

-- MFA secrets (TOTP)
create table if not exists public.user_mfa_secrets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_client_id text not null,
  secret text not null,
  enabled boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_client_id)
);

alter table public.user_mfa_secrets enable row level security;

-- MoMo provider webhook audit
create table if not exists public.momo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  provider text not null default 'unknown',
  external_reference text not null default '',
  amount numeric(14,2) not null default 0,
  payer_phone text not null default '',
  payload jsonb not null default '{}',
  signature_valid boolean not null default false,
  processed boolean not null default false,
  collection_id uuid references public.collections(id),
  created_at timestamptz not null default now()
);

create index if not exists momo_webhook_ref_idx
  on public.momo_webhook_events (business_id, lower(external_reference));

alter table public.momo_webhook_events enable row level security;

-- RLS on 004 tables
alter table public.savings_products enable row level security;
alter table public.personal_savings_accounts enable row level security;
alter table public.collector_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- JWT helpers
-- ---------------------------------------------------------------------------
create or replace function public.jwt_business_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'business_id', '')::uuid;
$$;

create or replace function public.jwt_app_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', '');
$$;

create or replace function public.resolve_business_id(p_code text)
returns uuid language plpgsql stable as $$
declare v_id uuid;
begin
  select id into v_id from public.businesses
  where legacy_code = p_code or code = p_code limit 1;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Upsert branch / user / customer by client_id
-- ---------------------------------------------------------------------------
create or replace function public.ensure_branch(p_business_id uuid, p_client_id text, p_name text default 'Main Branch')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.branches
  where business_id = p_business_id and client_id = p_client_id;
  if v_id is not null then return v_id; end if;
  insert into public.branches (business_id, name, client_id, active)
  values (p_business_id, coalesce(nullif(p_name, ''), 'Main Branch'), p_client_id, true)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ensure_app_user(
  p_business_id uuid, p_client_id text, p_username text, p_name text, p_role text, p_branch_id uuid default null
) returns uuid language plpgsql as $$
declare v_id uuid;
  v_role text := case p_role
    when 'KBA' then 'Owner'
    when 'Admin' then 'AssistantManager'
    when 'Collector' then 'Collector'
    when 'Auditor' then 'Auditor'
    else coalesce(p_role, 'Collector')
  end;
begin
  select id into v_id from public.app_users
  where business_id = p_business_id and client_id = p_client_id;
  if v_id is not null then return v_id; end if;
  insert into public.app_users (business_id, username, name, role, branch_id, client_id, active)
  values (p_business_id, coalesce(p_username, p_client_id), coalesce(p_name, p_username), v_role, p_branch_id, p_client_id, true)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ensure_customer(
  p_business_id uuid, p_client_id text, p_account_no text, p_name text,
  p_branch_id uuid, p_collector_id uuid, p_phone text default ''
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.customers
  where business_id = p_business_id and client_id = p_client_id;
  if v_id is not null then return v_id; end if;
  insert into public.customers (business_id, branch_id, collector_id, client_id, account_no, name, phone, active)
  values (p_business_id, p_branch_id, p_collector_id, p_client_id, p_account_no, p_name, coalesce(p_phone, ''), true)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Full collection write (replaces queue-only RPC)
-- ---------------------------------------------------------------------------
create or replace function public.record_collection_from_client(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_business_code text := payload->>'business_code';
  v_idempotency text := payload->>'idempotency_key';
  v_existing uuid;
  v_branch_id uuid;
  v_collector_id uuid;
  v_customer_id uuid;
  v_collection_id uuid;
  v_amount numeric := coalesce((payload->>'amount')::numeric, 0);
  v_receipt text := coalesce(payload->>'receipt_no', payload->>'payment_no', '');
  v_payment_method text := coalesce(payload->>'payment_method', 'Cash');
begin
  if v_idempotency is null or v_idempotency = '' then
    raise exception 'idempotency_key required';
  end if;

  v_business_id := public.resolve_business_id(v_business_code);
  if v_business_id is null then
    insert into public.businesses (code, name, legacy_code)
    values (v_business_code, coalesce(payload->>'business_name', 'Smile Trust'), v_business_code)
    returning id into v_business_id;
    insert into public.receipt_sequences (business_id, last_value) values (v_business_id, 0);
  end if;

  select id into v_existing from public.collections
  where business_id = v_business_id and idempotency_key = v_idempotency;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'collection_id', v_existing);
  end if;

  v_branch_id := public.ensure_branch(v_business_id, coalesce(payload->>'branch_client_id', 'default'), payload->>'branch_name');
  v_collector_id := public.ensure_app_user(
    v_business_id,
    coalesce(payload->>'collector_client_id', 'system'),
    payload->>'collector_username',
    payload->>'collector_name',
    coalesce(payload->>'collector_role', 'Collector'),
    v_branch_id
  );
  v_customer_id := public.ensure_customer(
    v_business_id,
    payload->>'customer_client_id',
    coalesce(payload->>'account_no', payload->>'customer_client_id'),
    coalesce(payload->>'customer_name', 'Member'),
    v_branch_id,
    v_collector_id,
    payload->>'customer_phone'
  );

  insert into public.collections (
    business_id, branch_id, customer_id, collector_id, client_id,
    receipt_no, idempotency_key, amount, payment_method, payment_reference,
    verification_status, collection_date, client_created_at, note, reversed
  ) values (
    v_business_id, v_branch_id, v_customer_id, v_collector_id, payload->>'client_id',
    v_receipt, v_idempotency, v_amount, v_payment_method, coalesce(payload->>'payment_reference', ''),
    coalesce(payload->>'verification_status', 'Verified'),
    coalesce((payload->>'collection_date')::date, current_date),
    coalesce((payload->>'client_created_at')::timestamptz, now()),
    coalesce(payload->>'note', ''), coalesce((payload->>'reversed')::boolean, false)
  ) returning id into v_collection_id;

  if v_amount > 0 and coalesce((payload->>'reversed')::boolean, false) = false then
    insert into public.ledger_entries (
      business_id, entry_type, customer_id, branch_id, collector_id,
      amount, direction, reference_id, reference_type, receipt_no,
      payment_method, payment_reference, created_by, client_created_at
    ) values (
      v_business_id, 'Susu Deposit', v_customer_id, v_branch_id, v_collector_id,
      v_amount, 'credit', v_collection_id, 'collection', v_receipt,
      v_payment_method, coalesce(payload->>'payment_reference', ''), v_collector_id, now()
    );
  end if;

  insert into public.sync_queue (business_id, business_code, idempotency_key, payload, status, applied_at)
  values (v_business_id, v_business_code, v_idempotency, payload, 'applied', now())
  on conflict (business_id, idempotency_key) do nothing;

  return jsonb_build_object('status', 'recorded', 'collection_id', v_collection_id, 'business_id', v_business_id);
end;
$$;

grant execute on function public.record_collection_from_client(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fetch business snapshot for app hydration
-- ---------------------------------------------------------------------------
create or replace function public.fetch_business_snapshot(business_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := public.resolve_business_id(business_code);
  v_result jsonb := '{}'::jsonb;
begin
  if v_business_id is null then
    return jsonb_build_object('groups', '[]'::jsonb, 'customers', '[]'::jsonb, 'collections', '[]'::jsonb);
  end if;

  v_result := jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.client_id, 'name', b.name, 'active', b.active, 'collectorCode', b.collector_code
      )) from public.branches b where b.business_id = v_business_id
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.client_id, 'accountNo', c.account_no, 'name', c.name, 'phone', c.phone,
        'groupId', br.client_id, 'collectorId', au.client_id, 'active', c.active,
        'memberStatus', coalesce(c.member_status, 'Active'), 'accountType', coalesce(c.account_type, 'personal')
      ))
      from public.customers c
      join public.branches br on br.id = c.branch_id
      join public.app_users au on au.id = c.collector_id
      where c.business_id = v_business_id
    ), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', col.client_id, 'customerId', cu.client_id, 'groupId', br.client_id,
        'userId', au.client_id, 'collectorId', au.client_id, 'amount', col.amount,
        'amountPesewas', (col.amount * 100)::bigint, 'date', col.collection_date::text,
        'receiptNo', col.receipt_no, 'idempotencyKey', col.idempotency_key,
        'paymentMethod', col.payment_method, 'paymentReference', col.payment_reference,
        'verificationStatus', col.verification_status, 'reversed', col.reversed,
        'createdAt', col.client_created_at
      ))
      from public.collections col
      join public.customers cu on cu.id = col.customer_id
      join public.branches br on br.id = col.branch_id
      join public.app_users au on au.id = col.collector_id
      where col.business_id = v_business_id
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.client_id, 'username', u.username, 'name', u.name,
        'role', case u.role when 'Owner' then 'KBA' when 'AssistantManager' then 'Admin' else u.role end,
        'groupId', br.client_id, 'active', u.active, 'authEmail', u.auth_email
      ))
      from public.app_users u
      left join public.branches br on br.id = u.branch_id
      where u.business_id = v_business_id
    ), '[]'::jsonb),
    'savingsProducts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sp.code, 'code', sp.code, 'name', sp.name, 'type', sp.product_type,
        'collectionType', sp.collection_type, 'frequency', sp.frequency,
        'minAmountPesewas', sp.min_amount_pesewas, 'defaultAmountPesewas', sp.default_amount_pesewas,
        'active', sp.active
      )) from public.savings_products sp where sp.business_id = v_business_id
    ), '[]'::jsonb)
  );
  return v_result;
end;
$$;

grant execute on function public.fetch_business_snapshot(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Batch import from localStorage snapshot
-- ---------------------------------------------------------------------------
create or replace function public.import_snapshot_batch(business_code text, snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_group jsonb;
  v_user jsonb;
  v_customer jsonb;
  v_collection jsonb;
  v_branch_id uuid;
  v_imported int := 0;
begin
  v_business_id := public.resolve_business_id(business_code);
  if v_business_id is null then
    insert into public.businesses (code, name, legacy_code)
    values (business_code, coalesce(snapshot->'settings'->>'businessName', 'Smile Trust'), business_code)
    returning id into v_business_id;
    insert into public.receipt_sequences (business_id, last_value) values (v_business_id, 0);
  end if;

  for v_group in select * from jsonb_array_elements(coalesce(snapshot->'groups', '[]'::jsonb)) loop
    perform public.ensure_branch(v_business_id, v_group->>'id', v_group->>'name');
    v_imported := v_imported + 1;
  end loop;

  for v_user in select * from jsonb_array_elements(coalesce(snapshot->'users', '[]'::jsonb)) loop
    v_branch_id := public.ensure_branch(v_business_id, coalesce(v_user->>'groupId', 'default'), 'Branch');
    perform public.ensure_app_user(
      v_business_id, v_user->>'id', v_user->>'username', v_user->>'name',
      coalesce(v_user->>'role', 'Collector'), v_branch_id
    );
    v_imported := v_imported + 1;
  end loop;

  for v_customer in select * from jsonb_array_elements(coalesce(snapshot->'customers', '[]'::jsonb)) loop
    v_branch_id := public.ensure_branch(v_business_id, coalesce(v_customer->>'groupId', 'default'), 'Branch');
    perform public.ensure_customer(
      v_business_id, v_customer->>'id', v_customer->>'accountNo', v_customer->>'name',
      v_branch_id,
      public.ensure_app_user(v_business_id, coalesce(v_customer->>'collectorId', 'system'), null, null, 'Collector', v_branch_id),
      v_customer->>'phone'
    );
    v_imported := v_imported + 1;
  end loop;

  for v_collection in select * from jsonb_array_elements(coalesce(snapshot->'collections', '[]'::jsonb)) loop
    perform public.record_collection_from_client(jsonb_build_object(
      'business_code', business_code,
      'client_id', v_collection->>'id',
      'idempotency_key', coalesce(v_collection->>'idempotencyKey', v_collection->>'id'),
      'receipt_no', coalesce(v_collection->>'receiptNo', v_collection->>'paymentNo'),
      'amount', v_collection->>'amount',
      'payment_method', coalesce(v_collection->>'paymentMethod', 'Cash'),
      'payment_reference', coalesce(v_collection->>'paymentReference', ''),
      'verification_status', coalesce(v_collection->>'verificationStatus', 'Verified'),
      'collection_date', coalesce(v_collection->>'date', current_date::text),
      'client_created_at', coalesce(v_collection->>'createdAt', now()::text),
      'customer_client_id', v_collection->>'customerId',
      'collector_client_id', coalesce(v_collection->>'collectorId', v_collection->>'userId'),
      'branch_client_id', coalesce(v_collection->>'groupId', 'default'),
      'reversed', coalesce(v_collection->>'reversed', 'false')
    ));
    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('status', 'imported', 'business_id', v_business_id, 'records_touched', v_imported);
end;
$$;

grant execute on function public.import_snapshot_batch(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- MFA upsert
-- ---------------------------------------------------------------------------
create or replace function public.upsert_user_mfa(
  business_code text, user_client_id text, secret text, enabled boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business_id uuid := public.resolve_business_id(business_code);
begin
  if v_business_id is null then raise exception 'business not found'; end if;
  insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled, confirmed_at, updated_at)
  values (v_business_id, user_client_id, secret, enabled, case when enabled then now() else null end, now())
  on conflict (business_id, user_client_id) do update set
    secret = excluded.secret, enabled = excluded.enabled,
    confirmed_at = case when excluded.enabled then now() else user_mfa_secrets.confirmed_at end,
    updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_user_mfa(text, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- MoMo webhook recording + auto-verify matching collection
-- ---------------------------------------------------------------------------
create or replace function public.record_momo_webhook(business_code text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := public.resolve_business_id(business_code);
  v_ref text := upper(trim(coalesce(payload->>'reference', payload->>'external_reference', '')));
  v_collection_id uuid;
  v_event_id uuid;
begin
  if v_business_id is null then raise exception 'business not found'; end if;

  insert into public.momo_webhook_events (
    business_id, provider, external_reference, amount, payer_phone, payload, signature_valid, processed
  ) values (
    v_business_id,
    coalesce(payload->>'provider', 'unknown'),
    v_ref,
    coalesce((payload->>'amount')::numeric, 0),
    coalesce(payload->>'phone', ''),
    payload,
    coalesce((payload->>'signature_valid')::boolean, false),
    false
  ) returning id into v_event_id;

  if v_ref <> '' then
    update public.collections c set verification_status = 'Verified'
    where c.business_id = v_business_id
      and c.payment_method = 'Mobile Money'
      and lower(c.payment_reference) = lower(v_ref)
      and c.reversed = false
      and c.verification_status <> 'Verified'
    returning c.id into v_collection_id;

    if v_collection_id is not null then
      update public.momo_webhook_events set processed = true, collection_id = v_collection_id where id = v_event_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'event_id', v_event_id, 'collection_id', v_collection_id);
end;
$$;

grant execute on function public.record_momo_webhook(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies (authenticated JWT with business_id claim)
-- ---------------------------------------------------------------------------
create or replace function public.policy_business_match(b_id uuid)
returns boolean language sql stable as $$
  select b_id = public.jwt_business_id() or public.jwt_business_id() is null;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'branches','app_users','devices','customers','collections',
    'ledger_entries','reversals','handovers','exceptions','audit_log',
    'susu_groups','susu_group_members','group_distributions',
    'savings_products','personal_savings_accounts','collector_assignments',
    'user_mfa_secrets','momo_webhook_events'
  ] loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format(
      'create policy tenant_select on public.%I for select using (business_id = public.jwt_business_id())',
      t
    );
    execute format(
      'create policy tenant_insert on public.%I for insert with check (business_id = public.jwt_business_id())',
      t
    );
    execute format(
      'create policy tenant_update on public.%I for update using (business_id = public.jwt_business_id())',
      t
    );
  end loop;
exception when undefined_column then
  null;
end $$;

comment on function public.fetch_business_snapshot is 'Load relational state for app when postgresSourceOfTruth is enabled';
comment on function public.import_snapshot_batch is 'One-time migration from localStorage JSON snapshot';
comment on function public.record_momo_webhook is 'Server-side MoMo callback — verifies and marks matching collections';
