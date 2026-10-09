-- 048: server-allocated collection receipt numbers.
--
-- Until now record_collection_from_client stored whatever receipt_no the device sent; devices number
-- receipts from a device-local counter, so two devices could produce the same number (the second
-- write then failed on collections_business_id_receipt_no_key) and the number was client-controlled.
--
-- After 048, for every signed-in (JWT) caller the server ignores the device's receipt_no and
-- allocates PREFIX-00000001 from public.receipt_sequences inside the same transaction as the
-- collection and its ledger credit. The prefix comes from the member's branch (branches.collector_code),
-- never from the payload. Only trusted sessions (service role / direct database session) and the
-- owner-only historical import keep the receipt numbers they supply.
--
-- Unchanged: the 047 public wrapper (business scope, active staff, amounts, collector assignment,
-- actor from the session), RLS, grants, posted-row immutability and both unique constraints.
-- Deposits, withdrawals and loan repayments are not changed by this migration.
--
-- Requires 046 and 047. Idempotent. Rollback: supabase/rollbacks/048_server_receipt_allocation.rollback.sql

do $$
begin
  if to_regprocedure('public.st_internal_record_collection_from_client(jsonb)') is null
     or to_regprocedure('public.st_scope_staff_payload(jsonb)') is null
     or to_regprocedure('public.st_internal_import_snapshot_batch(text, jsonb)') is null then
    raise exception 'migration 048 requires migrations 046 and 047';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Helpers
-- ---------------------------------------------------------------------------

-- Numeric suffix of PREFIX-123 style receipts (1–12 digits); null for any other format.
create or replace function public.st_receipt_suffix(p_receipt text)
returns bigint language sql immutable as $$
  select case when coalesce(p_receipt, '') ~ '^[A-Za-z0-9]+-[0-9]{1,12}$'
              then substring(p_receipt from '([0-9]+)$')::bigint end;
$$;

create or replace function public.st_receipt_prefix(p_code text)
returns text language sql immutable as $$
  select coalesce(nullif(left(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), 12), ''), 'RCP');
$$;

-- The per-business counter row is locked by the upsert until the calling transaction ends, so
-- concurrent allocations are serialized and never return the same number. Numbers already used by
-- a collection (legacy or imported receipts) are skipped. A rolled-back transaction releases its
-- number; a committed duplicate-submission race may leave a gap. Numbers are never reused.
create or replace function public.st_internal_allocate_receipt_no(p_business_id uuid, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text := public.st_receipt_prefix(p_prefix);
  v_next bigint;
  v_candidate text;
begin
  if p_business_id is null then
    raise exception 'business required to allocate a receipt number' using errcode = '22023';
  end if;
  for i in 1..1000 loop
    insert into public.receipt_sequences (business_id, last_value)
    values (p_business_id, 1)
    on conflict (business_id) do update
      set last_value = public.receipt_sequences.last_value + 1
    returning last_value into v_next;
    v_candidate := v_prefix || '-' || lpad(v_next::text, greatest(8, length(v_next::text)), '0');
    if not exists (
      select 1 from public.collections c
      where c.business_id = p_business_id and c.receipt_no = v_candidate
    ) then
      return v_candidate;
    end if;
  end loop;
  raise exception 'no free receipt number found after 1000 attempts' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Counter seeding: every business has a counter at or above the highest numeric suffix already
--    used by a collection or ledger entry. Counters are only ever raised; no receipt is renumbered.
-- ---------------------------------------------------------------------------
do $$
begin
  lock table public.receipt_sequences, public.collections, public.ledger_entries in share row exclusive mode;

  insert into public.receipt_sequences (business_id, last_value)
  select b.id, 0 from public.businesses b
  on conflict (business_id) do nothing;

  update public.receipt_sequences rs
  set last_value = s.max_suffix
  from (
    select r.business_id, max(public.st_receipt_suffix(r.receipt_no)) as max_suffix
    from (
      select business_id, receipt_no from public.collections
      union all
      select business_id, receipt_no from public.ledger_entries where receipt_no is not null
    ) r
    group by r.business_id
  ) s
  where s.business_id = rs.business_id
    and s.max_suffix is not null
    and s.max_suffix > rs.last_value;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Internal collection write (called only by the 047 wrapper public.record_collection_from_client
--    and, through it, by the owner-only historical import).
-- ---------------------------------------------------------------------------
create or replace function public.st_internal_record_collection_from_client(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_business_code text := payload->>'business_code';
  v_idempotency text := payload->>'idempotency_key';
  v_existing uuid;
  v_existing_receipt text;
  v_branch_id uuid;
  v_collector_id uuid;
  v_customer_id uuid;
  v_collection_id uuid;
  v_amount numeric := coalesce((payload->>'amount')::numeric, 0);
  v_supplied_receipt text := nullif(trim(coalesce(payload->>'receipt_no', payload->>'payment_no', '')), '');
  v_keep_supplied boolean := public.st_is_trusted_session()
                             or coalesce(current_setting('smile_trust.receipt_import', true), '') = 'on';
  v_receipt text;
  v_prefix text;
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
    insert into public.receipt_sequences (business_id, last_value) values (v_business_id, 0)
    on conflict (business_id) do nothing;
  end if;

  select id, receipt_no into v_existing, v_existing_receipt from public.collections
  where business_id = v_business_id and idempotency_key = v_idempotency;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'collection_id', v_existing, 'receipt_no', v_existing_receipt,
                              'business_id', v_business_id);
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

  if v_keep_supplied and v_supplied_receipt is not null then
    v_receipt := v_supplied_receipt;
    insert into public.receipt_sequences (business_id, last_value)
    values (v_business_id, coalesce(public.st_receipt_suffix(v_receipt), 0))
    on conflict (business_id) do update
      set last_value = greatest(public.receipt_sequences.last_value, excluded.last_value);
  else
    select b.collector_code into v_prefix
    from public.customers c join public.branches b on b.id = c.branch_id
    where c.id = v_customer_id;
    v_receipt := public.st_internal_allocate_receipt_no(v_business_id, v_prefix);
  end if;

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
  )
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_collection_id;

  -- A concurrent submission with the same idempotency key committed first: answer with its record.
  if v_collection_id is null then
    select id, receipt_no into v_existing, v_existing_receipt from public.collections
    where business_id = v_business_id and idempotency_key = v_idempotency;
    return jsonb_build_object('status', 'duplicate', 'collection_id', v_existing, 'receipt_no', v_existing_receipt,
                              'business_id', v_business_id);
  end if;

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

  return jsonb_build_object('status', 'recorded', 'collection_id', v_collection_id, 'receipt_no', v_receipt,
                            'business_id', v_business_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Owner-only historical import keeps the receipt numbers it carries (047 checks unchanged).
--    The flag is transaction-local and set only here; clients cannot set server settings.
-- ---------------------------------------------------------------------------
create or replace function public.import_snapshot_batch(business_code text, snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.st_assert_business(business_code);
  if not (public.st_is_service_role() or public.st_jwt_is_owner()) then
    raise exception 'only an owner can import a snapshot' using errcode = '42501';
  end if;
  perform set_config('smile_trust.receipt_import', 'on', true);
  v := public.st_internal_import_snapshot_batch(business_code, snapshot);
  perform set_config('smile_trust.receipt_import', '', true);
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Privileges: allocator and helpers are server-internal.
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'st_receipt_suffix(text)', 'st_receipt_prefix(text)', 'st_internal_allocate_receipt_no(uuid, text)',
    'st_internal_record_collection_from_client(jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

comment on function public.st_internal_allocate_receipt_no(uuid, text) is
  'Migration 048: allocates the next collection receipt number for a business (server-internal; not client-callable).';


-- 048 write protocol fence. Headers are compatibility declarations, never authorization.
-- Statement triggers cover RPC SECURITY DEFINER writes, direct REST DML, snapshot writes,
-- deletes and zero-row statements. Missing/unknown headers fail before any mutation.
create or replace function public.st_guard_client_write_protocol()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_headers jsonb;
begin
  if public.st_is_trusted_session() then return null; end if;
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    raise exception 'Update Smile Trust before syncing: unsupported write protocol' using errcode = '42501';
  end;
  if coalesce(v_headers->>'x-smile-write-protocol', '') <> '048-v1' then
    raise exception 'Update Smile Trust before syncing: unsupported write protocol (requires 048-v1)' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.st_guard_client_write_protocol() from public, anon, authenticated;
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop trigger if exists st_client_write_protocol on public.%I', t.tablename);
    execute format('create trigger st_client_write_protocol before insert or update or delete or truncate on public.%I for each statement execute function public.st_guard_client_write_protocol()', t.tablename);
  end loop;
end $$;

notify pgrst, 'reload schema';
