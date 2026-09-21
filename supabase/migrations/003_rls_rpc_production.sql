-- Smile Trust Susu — RLS policies, RPC helpers, production relational sync
-- Run after 001 and 002. Requires pgcrypto from 001.

-- Map text business codes (app localStorage) to UUID businesses
alter table public.businesses add column if not exists legacy_code text;
create unique index if not exists businesses_legacy_code_uq
  on public.businesses (legacy_code) where legacy_code is not null;

-- Client ID mapping columns for migration from localStorage string IDs
alter table public.branches add column if not exists client_id text;
alter table public.app_users add column if not exists client_id text;
alter table public.customers add column if not exists client_id text;
alter table public.devices add column if not exists client_id text;
alter table public.collections add column if not exists client_id text unique;

create unique index if not exists branches_client_uq on public.branches (business_id, client_id) where client_id is not null;
create unique index if not exists app_users_client_uq on public.app_users (business_id, client_id) where client_id is not null;
create unique index if not exists customers_client_uq on public.customers (business_id, client_id) where client_id is not null;

-- Extend sync_queue for business_code lookups during migration
alter table public.sync_queue add column if not exists business_code text;

-- ---------------------------------------------------------------------------
-- RPC: record collection from mobile/desktop client (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.record_collection_from_client(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_business_code text := payload->>'business_code';
  v_idempotency text := payload->>'idempotency_key';
  v_existing uuid;
begin
  if v_idempotency is null or v_idempotency = '' then
    raise exception 'idempotency_key required';
  end if;

  select id into v_business_id from public.businesses
  where legacy_code = v_business_code or code = v_business_code limit 1;

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

  insert into public.sync_queue (business_id, business_code, idempotency_key, payload, status, applied_at)
  values (v_business_id, v_business_code, v_idempotency, payload, 'applied', now())
  on conflict (business_id, idempotency_key) do nothing;

  return jsonb_build_object('status', 'queued', 'business_id', v_business_id);
end;
$$;

grant execute on function public.record_collection_from_client(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Example RLS: tenant isolation via JWT business_id claim
-- Enable after Supabase Auth custom claims hook is configured.
-- ---------------------------------------------------------------------------
-- create policy collections_tenant on public.collections for all
--   using (business_id = (auth.jwt() ->> 'business_id')::uuid)
--   with check (business_id = (auth.jwt() ->> 'business_id')::uuid);

-- ---------------------------------------------------------------------------
-- MoMo duplicate reference guard (server-side)
-- ---------------------------------------------------------------------------
create unique index if not exists collections_momo_ref_uq
  on public.collections (business_id, lower(payment_reference))
  where payment_method = 'Mobile Money' and payment_reference <> '' and reversed = false;
