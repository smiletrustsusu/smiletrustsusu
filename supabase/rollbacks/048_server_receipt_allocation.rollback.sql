-- The 048 write-protocol fence intentionally remains installed during receipt rollback.
-- Roll back clients only to a build that still sends 048-v1; removing the fence requires separate review.
-- Rollback for 048_server_receipt_allocation.sql
-- Restores the 047-era internal collection write (device-supplied receipt numbers) and the 047
-- import wrapper, then drops the 048 allocator and helpers.
-- Counters in public.receipt_sequences are NOT lowered and no collection or ledger receipt is
-- changed: receipts allocated while 048 was live stay valid and are never reused.
-- Clients built for 048 send no receipt number; roll the client back together with this file.
-- Run manually in the SQL editor after backing up. Prefer restore from backup for production.

create or replace function public.st_internal_record_collection_from_client(payload jsonb)
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

create or replace function public.import_snapshot_batch(business_code text, snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.st_assert_business(business_code);
  if not (public.st_is_service_role() or public.st_jwt_is_owner()) then
    raise exception 'only an owner can import a snapshot' using errcode = '42501';
  end if;
  return public.st_internal_import_snapshot_batch(business_code, snapshot);
end;
$$;

revoke all on function public.st_internal_record_collection_from_client(jsonb) from public, anon, authenticated;

drop function if exists public.st_internal_allocate_receipt_no(uuid, text);
drop function if exists public.st_receipt_prefix(text);
drop function if exists public.st_receipt_suffix(text);

notify pgrst, 'reload schema';
