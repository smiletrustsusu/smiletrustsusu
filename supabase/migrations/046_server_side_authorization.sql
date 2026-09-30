-- 046: Server-side authorization (Production Blocker #1 — client-side / shipped secrets).
--
-- Before this migration the anon key alone could read/write the cloud snapshot, call every
-- security-definer RPC, and read tenant tables whose policies passed when the JWT carried no
-- business claim. After it:
--   * anon has no table access and may only call the member-portal RPCs;
--   * staff use a per-user Supabase Auth session issued by the staff-login Edge Function, whose
--     app_metadata carries business_code / app_user_id / app_role (server-set, not user-editable);
--   * every business-scoped RPC is wrapped with a caller check against that claim;
--   * the member portal verifies PINs server-side and returns only that member's records.
--
-- Schema/privilege changes only: no existing business rows are modified or deleted.
-- Idempotent. Apply only as part of the coordinated cutover in docs/SECURITY-CUTOVER.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1) Claim helpers
-- ---------------------------------------------------------------------------
create or replace function public.st_jwt_claim(p_key text)
returns text language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> p_key, '');
$$;

create or replace function public.st_jwt_business_code()
returns text language sql stable as $$
  select public.st_jwt_claim('business_code');
$$;

create or replace function public.st_jwt_app_user_id()
returns text language sql stable as $$
  select public.st_jwt_claim('app_user_id');
$$;

create or replace function public.st_is_service_role()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function public.jwt_app_role()
returns text language sql stable as $$
  select coalesce(
    public.st_jwt_claim('app_role'),
    nullif(auth.jwt() ->> 'app_role', ''),
    auth.jwt() ->> 'role',
    ''
  );
$$;

create or replace function public.jwt_is_elevated_role()
returns boolean language sql stable as $$
  select public.jwt_app_role() in (
    'Owner', 'KBA', 'SystemOwner', 'Admin', 'AssistantManager', 'Auditor', 'PlatformAdmin'
  );
$$;

create or replace function public.st_business_authorized(p_business_code text)
returns boolean language sql stable as $$
  select coalesce(
    public.st_is_service_role()
      or (coalesce(p_business_code, '') <> '' and public.st_jwt_business_code() = p_business_code),
    false
  );
$$;

create or replace function public.st_assert_business(p_business_code text)
returns void language plpgsql stable as $$
begin
  if not public.st_business_authorized(p_business_code) then
    raise exception 'not authorized for this business' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.st_assert_elevated(p_business_code text)
returns void language plpgsql stable as $$
begin
  perform public.st_assert_business(p_business_code);
  if not public.st_is_service_role() and not public.jwt_is_elevated_role() then
    raise exception 'elevated role required' using errcode = '42501';
  end if;
end;
$$;

-- Tenant match for uuid business_id tables: explicit uuid claim, or the business resolved from
-- the server-set business_code claim. Never true for anon (no claims).
create or replace function public.st_tenant_match(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business_id is not null and (
    p_business_id = public.jwt_business_id()
    or p_business_id = public.resolve_business_id(public.st_jwt_business_code())
  );
$$;

create or replace function public.policy_business_match(b_id uuid)
returns boolean language sql stable as $$
  select public.st_tenant_match(b_id);
$$;

create or replace function public.policy_collector_customer_match(p_collector_id uuid)
returns boolean language sql stable as $$
  select public.jwt_is_elevated_role()
    or (p_collector_id is not null
        and p_collector_id::text = coalesce(public.st_jwt_app_user_id(), auth.jwt() ->> 'sub', ''));
$$;

-- ---------------------------------------------------------------------------
-- 2) Default-deny table access for anon; RLS on every public table
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke all on table public.%I from anon', r.relname);
    if r.relkind in ('r', 'p') then
      execute format('alter table public.%I enable row level security', r.relname);
    elsif r.relkind = 'v' then
      begin
        execute format('alter view public.%I set (security_invoker = true)', r.relname);
      exception when others then
        raise notice 'security_invoker not applied to view %: %', r.relname, sqlerrm;
      end;
    end if;
  end loop;
end $$;

revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Tenant policies (authenticated only) on every table with a uuid business_id.
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'business_id' and c.data_type = 'uuid'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.st_tenant_match(business_id))', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.st_tenant_match(business_id))', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.st_tenant_match(business_id)) with check (public.st_tenant_match(business_id))', t);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.jwt_is_elevated_role() and public.st_tenant_match(business_id))', t);
  end loop;
end $$;

-- Text business_id / business_code tables (legacy + offline queue), excluding the snapshot table.
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
      and c.column_name in ('business_id', 'business_code')
      and c.table_name <> 'smile_trust_cloud_snapshots'
      and c.table_name not like 'st\_%'
      and not exists (
        select 1 from information_schema.columns u
        where u.table_schema = 'public' and u.table_name = c.table_name
          and u.column_name = 'business_id' and u.data_type = 'uuid'
      )
  loop
    execute format('drop policy if exists tenant_code_all on public.%I', r.table_name);
    execute format(
      'create policy tenant_code_all on public.%I for all to authenticated using (
         %I = public.st_jwt_business_code()
         or %I = public.resolve_business_id(public.st_jwt_business_code())::text
       ) with check (
         %I = public.st_jwt_business_code()
         or %I = public.resolve_business_id(public.st_jwt_business_code())::text
       )', r.table_name, r.column_name, r.column_name, r.column_name, r.column_name);
  end loop;
end $$;

drop policy if exists offline_queue_tenant on public.offline_queue;

-- TOTP secrets are server-only: written through upsert_user_mfa, read by the staff-login function.
do $$
begin
  if to_regclass('public.user_mfa_secrets') is not null then
    drop policy if exists tenant_select on public.user_mfa_secrets;
    drop policy if exists tenant_insert on public.user_mfa_secrets;
    drop policy if exists tenant_update on public.user_mfa_secrets;
    drop policy if exists tenant_delete on public.user_mfa_secrets;
    revoke all on public.user_mfa_secrets from anon, authenticated;
  end if;
end $$;

drop policy if exists collector_customers_select on public.customers;
create policy collector_customers_select on public.customers
  for select to authenticated
  using (public.st_tenant_match(business_id));

-- ---------------------------------------------------------------------------
-- 3) Cloud snapshot table: per-business staff session only
-- ---------------------------------------------------------------------------
alter table public.smile_trust_cloud_snapshots alter column access_key drop not null;
alter table public.smile_trust_cloud_snapshots alter column access_key set default '';

drop policy if exists "smile_trust_snapshots_select" on public.smile_trust_cloud_snapshots;
drop policy if exists "smile_trust_snapshots_insert" on public.smile_trust_cloud_snapshots;
drop policy if exists "smile_trust_snapshots_update" on public.smile_trust_cloud_snapshots;
drop policy if exists "smile_trust_snapshots_delete" on public.smile_trust_cloud_snapshots;
drop policy if exists st_snapshots_select on public.smile_trust_cloud_snapshots;
drop policy if exists st_snapshots_insert on public.smile_trust_cloud_snapshots;
drop policy if exists st_snapshots_update on public.smile_trust_cloud_snapshots;

revoke all on public.smile_trust_cloud_snapshots from anon;
revoke delete, truncate on public.smile_trust_cloud_snapshots from authenticated;
grant select, insert, update on public.smile_trust_cloud_snapshots to authenticated;

create policy st_snapshots_select on public.smile_trust_cloud_snapshots
  for select to authenticated
  using (business_id = public.st_jwt_business_code());

create policy st_snapshots_insert on public.smile_trust_cloud_snapshots
  for insert to authenticated
  with check (business_id = public.st_jwt_business_code());

create policy st_snapshots_update on public.smile_trust_cloud_snapshots
  for update to authenticated
  using (business_id = public.st_jwt_business_code())
  with check (business_id = public.st_jwt_business_code());

-- ---------------------------------------------------------------------------
-- 4) Wrap business-scoped security-definer RPCs with caller checks.
--    The original body is kept as st_internal_<name> (no client access); the public name keeps
--    its signature so existing clients call the guarded version.
-- ---------------------------------------------------------------------------
create or replace function public.st_wrap_rename(p_name text, p_args text)
returns boolean language plpgsql as $$
begin
  if to_regprocedure(format('public.st_internal_%s(%s)', p_name, p_args)) is not null then
    return true;
  end if;
  if to_regprocedure(format('public.%s(%s)', p_name, p_args)) is null then
    return false;
  end if;
  execute format('alter function public.%I(%s) rename to %I', p_name, p_args, 'st_internal_' || p_name);
  return true;
end;
$$;

do $wrap$
begin
  if public.st_wrap_rename('record_collection_from_client', 'jsonb') then
    execute $f$
      create or replace function public.record_collection_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_record_collection_from_client(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('fetch_business_snapshot', 'text') then
    execute $f$
      create or replace function public.fetch_business_snapshot(business_code text)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(business_code);
        return public.st_internal_fetch_business_snapshot(business_code);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('import_snapshot_batch', 'text, jsonb') then
    execute $f$
      create or replace function public.import_snapshot_batch(business_code text, snapshot jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_elevated(business_code);
        return public.st_internal_import_snapshot_batch(business_code, snapshot);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('upsert_user_mfa', 'text, text, text, boolean') then
    -- The 005 body referenced parameters that share column names (ambiguous at runtime).
    execute $f$
      create or replace function public.st_internal_upsert_user_mfa(
        business_code text, user_client_id text, secret text, enabled boolean default false
      ) returns jsonb language plpgsql security definer set search_path = public as $b$
      declare v_business_id uuid := public.resolve_business_id(business_code);
      begin
        if v_business_id is null then raise exception 'business not found'; end if;
        insert into public.user_mfa_secrets as m (business_id, user_client_id, secret, enabled, confirmed_at, updated_at)
        values (
          v_business_id,
          st_internal_upsert_user_mfa.user_client_id,
          st_internal_upsert_user_mfa.secret,
          st_internal_upsert_user_mfa.enabled,
          case when st_internal_upsert_user_mfa.enabled then now() else null end,
          now()
        )
        on conflict on constraint user_mfa_secrets_business_id_user_client_id_key do update set
          secret = excluded.secret,
          enabled = excluded.enabled,
          confirmed_at = case when excluded.enabled then now() else m.confirmed_at end,
          updated_at = now();
        return jsonb_build_object('ok', true);
      end $b$;
    $f$;
    execute $f$
      create or replace function public.upsert_user_mfa(
        business_code text, user_client_id text, secret text, enabled boolean default false
      ) returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(business_code);
        if not public.st_is_service_role()
           and coalesce(public.st_jwt_app_user_id(), '') <> coalesce(user_client_id, '')
           and not public.jwt_is_elevated_role() then
          raise exception 'cannot change another user''s MFA' using errcode = '42501';
        end if;
        return public.st_internal_upsert_user_mfa(business_code, user_client_id, secret, enabled);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('record_momo_webhook', 'text, jsonb') then
    execute $f$
      create or replace function public.record_momo_webhook(business_code text, payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_elevated(business_code);
        return public.st_internal_record_momo_webhook(business_code, payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('list_app_users', 'text') then
    execute $f$
      create or replace function public.list_app_users(p_business_code text)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_elevated(p_business_code);
        return public.st_internal_list_app_users(p_business_code);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('upsert_customer_from_client', 'jsonb') then
    execute $f$
      create or replace function public.upsert_customer_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_upsert_customer_from_client(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('record_deposit_from_client', 'jsonb') then
    execute $f$
      create or replace function public.record_deposit_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_record_deposit_from_client(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('record_withdrawal_from_client', 'jsonb') then
    execute $f$
      create or replace function public.record_withdrawal_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_record_withdrawal_from_client(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('record_loan_repayment_from_client', 'jsonb') then
    execute $f$
      create or replace function public.record_loan_repayment_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_record_loan_repayment_from_client(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('record_eod_snapshot', 'jsonb') then
    execute $f$
      create or replace function public.record_eod_snapshot(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_record_eod_snapshot(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('fetch_cashbook_summary', 'text, date, date') then
    execute $f$
      create or replace function public.fetch_cashbook_summary(p_business_code text, p_from date, p_to date)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(p_business_code);
        return public.st_internal_fetch_cashbook_summary(p_business_code, p_from, p_to);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('fetch_dashboard_kpis', 'text') then
    execute $f$
      create or replace function public.fetch_dashboard_kpis(p_business_code text)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(p_business_code);
        return public.st_internal_fetch_dashboard_kpis(p_business_code);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('append_audit_event', 'jsonb') then
    execute $f$
      create or replace function public.append_audit_event(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        return public.st_internal_append_audit_event(payload);
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('enqueue_offline_item', 'jsonb') then
    execute $f$
      create or replace function public.enqueue_offline_item(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      declare
        v_code text := coalesce(nullif(payload->>'business_code', ''), payload->>'business_id');
      begin
        perform public.st_assert_business(v_code);
        return public.st_internal_enqueue_offline_item(payload || jsonb_build_object('business_id', v_code));
      end $b$;
    $f$;
  end if;

  if public.st_wrap_rename('ack_sync_queue_item', 'jsonb') then
    execute $f$
      create or replace function public.ack_sync_queue_item(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      declare
        v_code text := payload->>'business_code';
        v_id text := coalesce(payload->>'id', payload->>'queue_id');
        v_business uuid;
      begin
        perform public.st_assert_business(v_code);
        v_business := public.resolve_business_id(v_code);
        if exists (
          select 1 from public.offline_queue q
          where q.id = v_id
            and coalesce(q.business_id, '') not in (v_code, coalesce(v_business::text, ''))
        ) then
          raise exception 'queue item belongs to another business' using errcode = '42501';
        end if;
        if exists (
          select 1 from public.sync_queue s
          where (s.id::text = v_id or s.idempotency_key = v_id)
            and s.business_id is distinct from v_business
        ) then
          raise exception 'queue item belongs to another business' using errcode = '42501';
        end if;
        return public.st_internal_ack_sync_queue_item(payload);
      end $b$;
    $f$;
  end if;
end $wrap$;

-- ---------------------------------------------------------------------------
-- 5) Staff login support tables (Edge Function uses the service role; no client access)
-- ---------------------------------------------------------------------------
create table if not exists public.st_staff_auth_links (
  business_code text not null,
  app_user_id text not null,
  auth_user_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_code, app_user_id)
);

create table if not exists public.st_staff_login_attempts (
  id bigint generated by default as identity primary key,
  business_code text not null,
  username_key text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists st_staff_login_attempts_lookup
  on public.st_staff_login_attempts (business_code, username_key, attempted_at desc);

-- ---------------------------------------------------------------------------
-- 6) Member portal: server-verified PIN, member-scoped data, queued requests
-- ---------------------------------------------------------------------------
create table if not exists public.st_portal_pins (
  business_code text not null,
  customer_id text not null,
  pin_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (business_code, customer_id)
);

create table if not exists public.st_portal_sessions (
  token_hash text primary key,
  business_code text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists st_portal_sessions_expiry on public.st_portal_sessions (expires_at);

create table if not exists public.st_portal_attempts (
  id bigint generated by default as identity primary key,
  business_code text not null,
  login_key text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists st_portal_attempts_lookup
  on public.st_portal_attempts (business_code, login_key, attempted_at desc);

create table if not exists public.st_portal_requests (
  id uuid primary key default gen_random_uuid(),
  business_code text not null,
  customer_id text not null,
  request_type text not null default 'withdrawal' check (request_type in ('withdrawal')),
  amount_pesewas bigint not null check (amount_pesewas > 0),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'ingested', 'rejected')),
  created_at timestamptz not null default now(),
  ingested_at timestamptz,
  ingested_by text
);
create index if not exists st_portal_requests_pending
  on public.st_portal_requests (business_code, status, created_at);

do $$
declare t text;
begin
  foreach t in array array[
    'st_staff_auth_links', 'st_staff_login_attempts', 'st_portal_pins',
    'st_portal_sessions', 'st_portal_attempts', 'st_portal_requests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.st_num(p_value text)
returns numeric language plpgsql immutable as $$
begin
  return coalesce(nullif(trim(p_value), '')::numeric, 0);
exception when others then
  return 0;
end;
$$;

create or replace function public.st_truthy(p_value text)
returns boolean language sql immutable as $$
  select lower(coalesce(p_value, '')) in ('true', '1', 'yes');
$$;

create or replace function public.st_snapshot_payload(p_business_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select s.payload from public.smile_trust_cloud_snapshots s
  where s.business_id = p_business_code
  order by s.saved_at desc
  limit 1;
$$;

create or replace function public.st_portal_find_customer(p_payload jsonb, p_login text)
returns jsonb language sql stable as $$
  with needle as (
    select lower(regexp_replace(coalesce(p_login, ''), '\s+', '', 'g')) as id_key,
           regexp_replace(coalesce(p_login, ''), '\D', '', 'g') as digits
  )
  select c from needle, jsonb_array_elements(coalesce(p_payload -> 'customers', '[]'::jsonb)) c
  where needle.id_key <> '' and (
       lower(regexp_replace(coalesce(c ->> 'accountNo', ''), '\s+', '', 'g')) = needle.id_key
    or lower(regexp_replace(coalesce(c ->> 'customerNumber', ''), '\s+', '', 'g')) = needle.id_key
    or (length(needle.digits) >= 9
        and right(regexp_replace(coalesce(c ->> 'phone', ''), '\D', '', 'g'), 9) = right(needle.digits, 9))
  )
  limit 1;
$$;

create or replace function public.st_portal_customer_by_id(p_payload jsonb, p_customer_id text)
returns jsonb language sql stable as $$
  select c from jsonb_array_elements(coalesce(p_payload -> 'customers', '[]'::jsonb)) c
  where c ->> 'id' = p_customer_id
  limit 1;
$$;

-- PIN rule: a PIN the member set through the portal (hashed here) wins unless staff reset the
-- member's PIN later in the app; otherwise the app's rule applies (stored PIN or last 4 phone digits).
create or replace function public.st_portal_pin_ok(p_business_code text, p_customer jsonb, p_pin text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_pin text := trim(coalesce(p_pin, ''));
  v_hash text;
  v_updated timestamptz;
  v_staff_set timestamptz;
  v_phone4 text;
begin
  if v_pin = '' or p_customer is null then
    return false;
  end if;
  select pin_hash, updated_at into v_hash, v_updated
  from public.st_portal_pins
  where business_code = p_business_code and customer_id = p_customer ->> 'id';
  begin
    v_staff_set := nullif(p_customer ->> 'portalPinSetAt', '')::timestamptz;
  exception when others then
    v_staff_set := null;
  end;
  if v_hash is not null and (v_staff_set is null or v_updated >= v_staff_set) then
    return crypt(v_pin, v_hash) = v_hash;
  end if;
  if coalesce(p_customer ->> 'portalPin', '') <> '' and p_customer ->> 'portalPin' = v_pin then
    return true;
  end if;
  v_phone4 := right(regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g'), 4);
  if v_phone4 = '' then v_phone4 := '0000'; end if;
  return v_pin = v_phone4;
end;
$$;

create or replace function public.st_portal_locked(p_business_code text, p_login_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    select count(*) from public.st_portal_attempts
    where business_code = p_business_code and login_key = p_login_key
      and not succeeded and attempted_at > now() - interval '15 minutes'
  ) >= 5
  or (
    select count(*) from public.st_portal_attempts
    where business_code = p_business_code
      and not succeeded and attempted_at > now() - interval '15 minutes'
  ) >= 200;
$$;

create or replace function public.st_portal_rows(p_payload jsonb, p_collection text, p_customer_id text)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(e), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_payload -> p_collection, '[]'::jsonb)) e
  where e ->> 'customerId' = p_customer_id;
$$;

create or replace function public.st_portal_balance_pesewas(p_payload jsonb, p_customer_id text)
returns bigint language plpgsql stable as $$
declare
  v_ledger jsonb := public.st_portal_rows(p_payload, 'ledgerEntries', p_customer_id);
  v_total numeric := 0;
  v_deposits numeric := 0;
  v_withdrawals numeric := 0;
  v_collections numeric := 0;
begin
  if jsonb_array_length(v_ledger) > 0 then
    select coalesce(sum(case coalesce(e ->> 'direction', e ->> 'side', e ->> 'type')
                          when 'credit' then public.st_num(e ->> 'amount')
                          when 'debit' then -public.st_num(e ->> 'amount')
                          else public.st_num(e ->> 'amount') end), 0)
      into v_total
    from jsonb_array_elements(v_ledger) e
    where not public.st_truthy(e ->> 'reversed');
    return round(v_total * 100);
  end if;
  select coalesce(sum(public.st_num(e ->> 'amount')) filter (where e ->> 'type' = 'Susu Deposit'), 0),
         coalesce(sum(public.st_num(e ->> 'amount')) filter (where e ->> 'type' = 'Withdrawal'), 0)
    into v_deposits, v_withdrawals
  from jsonb_array_elements(public.st_portal_rows(p_payload, 'transactions', p_customer_id)) e
  where not public.st_truthy(e ->> 'reversed');
  if v_deposits <> 0 or v_withdrawals <> 0 then
    return round((v_deposits - v_withdrawals) * 100);
  end if;
  select coalesce(sum(public.st_num(e ->> 'amount')), 0) into v_collections
  from jsonb_array_elements(public.st_portal_rows(p_payload, 'collections', p_customer_id)) e
  where not public.st_truthy(e ->> 'reversed');
  return round((v_collections - v_withdrawals) * 100);
end;
$$;

create or replace function public.st_portal_bundle(p_business_code text, p_payload jsonb, p_customer jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_id text := p_customer ->> 'id';
  v_server_pin boolean;
  v_pending jsonb;
begin
  select exists (
    select 1 from public.st_portal_pins
    where business_code = p_business_code and customer_id = v_id
  ) into v_server_pin;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', 'wdr-portal-' || r.id::text,
    'customerId', r.customer_id,
    'amount', round(r.amount_pesewas / 100.0, 2),
    'amountPesewas', r.amount_pesewas,
    'reason', r.reason,
    'status', 'Pending',
    'source', 'portal',
    'date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD'),
    'createdAt', r.created_at
  ) order by r.created_at), '[]'::jsonb)
    into v_pending
  from public.st_portal_requests r
  where r.business_code = p_business_code and r.customer_id = v_id and r.status = 'pending';
  return jsonb_build_object(
    'customer', jsonb_strip_nulls(jsonb_build_object(
      'id', v_id,
      'name', p_customer ->> 'name',
      'accountNo', p_customer ->> 'accountNo',
      'customerNumber', p_customer ->> 'customerNumber',
      'phone', p_customer ->> 'phone',
      'accountType', p_customer ->> 'accountType',
      'memberStatus', p_customer ->> 'memberStatus',
      'active', p_customer -> 'active',
      'groupId', p_customer ->> 'groupId',
      'savingsProductId', p_customer ->> 'savingsProductId',
      'portalPinSource', case when v_server_pin then 'manual' else p_customer ->> 'portalPinSource' end
    )),
    'collections', public.st_portal_rows(p_payload, 'collections', v_id),
    'transactions', public.st_portal_rows(p_payload, 'transactions', v_id),
    'loans', public.st_portal_rows(p_payload, 'loans', v_id),
    'ledgerEntries', public.st_portal_rows(p_payload, 'ledgerEntries', v_id),
    'notifications', public.st_portal_rows(p_payload, 'notifications', v_id),
    'withdrawalRequests', public.st_portal_rows(p_payload, 'withdrawalRequests', v_id) || v_pending,
    'balancePesewas', public.st_portal_balance_pesewas(p_payload, v_id),
    'settings', jsonb_strip_nulls(jsonb_build_object(
      'businessName', p_payload -> 'settings' ->> 'businessName',
      'currency', p_payload -> 'settings' ->> 'currency',
      'theme', p_payload -> 'settings' ->> 'theme',
      'colorMode', p_payload -> 'settings' ->> 'colorMode'
    ))
  );
end;
$$;

create or replace function public.st_portal_session_customer(p_token text)
returns public.st_portal_sessions language sql volatile security definer set search_path = public as $$
  update public.st_portal_sessions
  set expires_at = now() + interval '30 minutes'
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and expires_at > now()
  returning *;
$$;

create or replace function public.portal_login(p_business_code text, p_login_id text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_payload jsonb;
  v_customer jsonb;
  v_login_key text := lower(regexp_replace(coalesce(p_login_id, ''), '\s+', '', 'g'));
  v_token text;
  v_expires timestamptz := now() + interval '30 minutes';
begin
  if coalesce(p_business_code, '') = '' or v_login_key = '' then
    return jsonb_build_object('ok', false, 'error', 'Account number or PIN is incorrect');
  end if;
  if public.st_portal_locked(p_business_code, v_login_key) then
    return jsonb_build_object('ok', false, 'error', 'Too many attempts. Try again in 15 minutes.');
  end if;
  v_payload := public.st_snapshot_payload(p_business_code);
  v_customer := public.st_portal_find_customer(v_payload, p_login_id);
  if v_customer is null or not public.st_portal_pin_ok(p_business_code, v_customer, p_pin) then
    insert into public.st_portal_attempts (business_code, login_key, succeeded)
    values (p_business_code, v_login_key, false);
    return jsonb_build_object('ok', false, 'error', 'Account number or PIN is incorrect');
  end if;
  insert into public.st_portal_attempts (business_code, login_key, succeeded)
  values (p_business_code, v_login_key, true);
  delete from public.st_portal_sessions where expires_at < now() - interval '1 day';
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.st_portal_sessions (token_hash, business_code, customer_id, expires_at)
  values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_business_code, v_customer ->> 'id', v_expires);
  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'bundle', public.st_portal_bundle(p_business_code, v_payload, v_customer)
  );
end;
$$;

create or replace function public.portal_refresh(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_session public.st_portal_sessions;
  v_payload jsonb;
  v_customer jsonb;
begin
  v_session := public.st_portal_session_customer(p_token);
  if v_session.token_hash is null then
    return jsonb_build_object('ok', false, 'error', 'Session expired. Please sign in again.');
  end if;
  v_payload := public.st_snapshot_payload(v_session.business_code);
  v_customer := public.st_portal_customer_by_id(v_payload, v_session.customer_id);
  if v_customer is null then
    return jsonb_build_object('ok', false, 'error', 'Account is no longer available.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'expires_at', v_session.expires_at,
    'bundle', public.st_portal_bundle(v_session.business_code, v_payload, v_customer)
  );
end;
$$;

create or replace function public.portal_change_pin(p_token text, p_current_pin text, p_new_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_session public.st_portal_sessions;
  v_customer jsonb;
  v_key text;
begin
  v_session := public.st_portal_session_customer(p_token);
  if v_session.token_hash is null then
    return jsonb_build_object('ok', false, 'error', 'Session expired. Please sign in again.');
  end if;
  v_key := 'pin-change:' || v_session.customer_id;
  if public.st_portal_locked(v_session.business_code, v_key) then
    return jsonb_build_object('ok', false, 'error', 'Too many attempts. Try again in 15 minutes.');
  end if;
  v_customer := public.st_portal_customer_by_id(public.st_snapshot_payload(v_session.business_code), v_session.customer_id);
  if not public.st_portal_pin_ok(v_session.business_code, v_customer, p_current_pin) then
    insert into public.st_portal_attempts (business_code, login_key, succeeded)
    values (v_session.business_code, v_key, false);
    return jsonb_build_object('ok', false, 'error', 'Current PIN is incorrect');
  end if;
  if coalesce(p_new_pin, '') !~ '^\d{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'PIN must be 4–6 digits');
  end if;
  insert into public.st_portal_pins (business_code, customer_id, pin_hash, updated_at)
  values (v_session.business_code, v_session.customer_id, crypt(p_new_pin, gen_salt('bf', 8)), now())
  on conflict (business_code, customer_id) do update
    set pin_hash = excluded.pin_hash, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_request_withdrawal(p_token text, p_amount numeric, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_session public.st_portal_sessions;
  v_payload jsonb;
  v_customer jsonb;
  v_pesewas bigint;
  v_pending bigint;
  v_open int;
  v_id uuid;
begin
  v_session := public.st_portal_session_customer(p_token);
  if v_session.token_hash is null then
    return jsonb_build_object('ok', false, 'error', 'Session expired. Please sign in again.');
  end if;
  v_payload := public.st_snapshot_payload(v_session.business_code);
  v_customer := public.st_portal_customer_by_id(v_payload, v_session.customer_id);
  if v_customer is null
     or lower(coalesce(v_customer ->> 'active', 'true')) = 'false'
     or v_customer ->> 'memberStatus' = 'Closed' then
    return jsonb_build_object('ok', false, 'error', 'This account cannot request withdrawals');
  end if;
  v_pesewas := round(coalesce(p_amount, 0) * 100);
  if v_pesewas <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Enter a withdrawal amount');
  end if;
  select coalesce(sum(amount_pesewas), 0), count(*) into v_pending, v_open
  from public.st_portal_requests
  where business_code = v_session.business_code and customer_id = v_session.customer_id and status = 'pending';
  if v_open >= 3 then
    return jsonb_build_object('ok', false, 'error', 'You already have pending withdrawal requests');
  end if;
  if v_pesewas + v_pending > public.st_portal_balance_pesewas(v_payload, v_session.customer_id) then
    return jsonb_build_object('ok', false, 'error', 'Amount exceeds available balance');
  end if;
  insert into public.st_portal_requests (business_code, customer_id, amount_pesewas, reason)
  values (v_session.business_code, v_session.customer_id, v_pesewas, left(coalesce(p_reason, ''), 500))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'request_id', v_id);
end;
$$;

-- Staff devices pull pending portal requests into the snapshot, then mark them ingested.
create or replace function public.portal_pending_requests(p_business_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.st_assert_business(p_business_code);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'customer_id', r.customer_id,
      'request_type', r.request_type,
      'amount_pesewas', r.amount_pesewas,
      'reason', r.reason,
      'created_at', r.created_at
    ) order by r.created_at)
    from public.st_portal_requests r
    where r.business_code = p_business_code and r.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_mark_requests_ingested(p_business_code text, p_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_count int;
begin
  perform public.st_assert_business(p_business_code);
  update public.st_portal_requests
  set status = 'ingested', ingested_at = now(), ingested_by = coalesce(public.st_jwt_app_user_id(), 'service')
  where business_code = p_business_code and status = 'pending' and id = any(coalesce(p_ids, '{}'));
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'ingested', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Function privileges: nothing is callable by anon except the portal entry points.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'st\_internal\_%'
           or p.proname in ('st_wrap_rename', 'st_snapshot_payload', 'st_portal_pin_ok', 'st_portal_bundle',
                            'st_portal_session_customer', 'st_portal_locked'))
  loop
    execute format('revoke execute on function %s from authenticated', r.sig);
  end loop;
end $$;

grant execute on function public.portal_login(text, text, text) to anon, authenticated;
grant execute on function public.portal_refresh(text) to anon, authenticated;
grant execute on function public.portal_change_pin(text, text, text) to anon, authenticated;
grant execute on function public.portal_request_withdrawal(text, numeric, text) to anon, authenticated;

notify pgrst, 'reload schema';
