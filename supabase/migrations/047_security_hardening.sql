-- 047: Security hardening on top of 046 (blockers B1–B7).
--
--   B1  Staff roles and status change only through owner-controlled, server-checked rules
--       (trigger on app_users, so direct writes and every RPC path are covered).
--   B2  Only management roles write the whole cloud snapshot; collectors submit their own
--       collections through st_submit_collections, validated and merged server-side.
--   B3  Secrets never stay in the stored snapshot (password hashes, MFA/TOTP secrets, tokens,
--       activation/recovery codes, plaintext portal PINs — PINs are hashed into st_portal_pins).
--   B4  Every staff request re-checks the live app_users row (active, role, business), the Auth
--       link and a per-user session cutoff, so old JWTs of deactivated staff stop working.
--   B5  TOTP secrets are writable by the staff-login Edge Function only; MFA resets are
--       owner-controlled and audited.
--   B6  Posted financial rows are append-only; corrections are reversals/approved adjustments.
--   B7  Members with financial history cannot be deleted (close/archive instead); status
--       changes are audited server-side.
--
-- No existing staff row, uuid, role, status or password is changed. Existing snapshots are
-- re-saved once so secrets are removed and posted history is registered (section 9).
-- Idempotent. Requires 046. Apply only as part of the reviewed deployment sequence.

set search_path = public, extensions;

do $$
begin
  if to_regclass('public.st_staff_auth_links') is null
     or to_regprocedure('public.st_tenant_match(uuid)') is null
     or to_regclass('public.smile_trust_cloud_snapshots') is null then
    raise exception '047 requires migration 046 (server-side authorization) to be applied first';
  end if;
end $$;

-- Per-identity session cutoff: tokens issued before it are rejected (B4).
alter table public.st_staff_auth_links
  add column if not exists sessions_not_before timestamptz not null default 'epoch';

-- ---------------------------------------------------------------------------
-- 1) Claim and identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.st_jwt_iat()
returns numeric language plpgsql stable as $$
begin
  return nullif(auth.jwt() ->> 'iat', '')::numeric;
exception when others then
  return null;
end;
$$;

-- app_users.role -> the app role carried in the session claim (same mapping as staff-login).
create or replace function public.st_app_role_from_relational(p_role text)
returns text language sql immutable as $$
  select case p_role when 'Owner' then 'KBA' when 'AssistantManager' then 'Admin' else coalesce(p_role, '') end;
$$;

create or replace function public.st_relational_role_from_app(p_role text)
returns text language sql immutable as $$
  select case p_role when 'KBA' then 'Owner' when 'Admin' then 'AssistantManager' else coalesce(nullif(p_role, ''), 'Collector') end;
$$;

-- Service role, or a direct database session (SQL editor / migrations): no request claims and
-- not connected through PostgREST's authenticator role.
create or replace function public.st_is_trusted_session()
returns boolean language sql stable as $$
  select public.st_is_service_role()
    or (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}') = '{}'
        and session_user::text <> 'authenticator');
$$;

-- Roles that manage the business (all of them require MFA at sign-in).
create or replace function public.st_jwt_is_manager()
returns boolean language sql stable as $$
  select coalesce(public.st_jwt_claim('app_role'), '') in ('SystemOwner', 'KBA', 'Admin', 'ManagingDirector', 'Accountant');
$$;

create or replace function public.st_jwt_is_owner()
returns boolean language sql stable as $$
  select coalesce(public.st_jwt_claim('app_role'), '') in ('SystemOwner', 'KBA');
$$;

-- B4: the caller's session still belongs to a current, active staff identity.
create or replace function public.st_caller_staff_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_service_role() or exists (
    select 1
    from public.st_staff_auth_links l
    join public.businesses b on (b.code = l.business_code or b.legacy_code = l.business_code)
    join public.app_users u on u.business_id = b.id and coalesce(u.client_id, u.id::text) = l.app_user_id
    where l.business_code = public.st_jwt_business_code()
      and l.app_user_id = public.st_jwt_app_user_id()
      and l.auth_user_id = auth.uid()
      and u.active is true
      and u.role <> 'Developer'
      and public.st_app_role_from_relational(u.role) = coalesce(public.st_jwt_claim('app_role'), '')
      and coalesce(public.st_jwt_iat(), 0) >= floor(extract(epoch from l.sessions_not_before))
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Tables
-- ---------------------------------------------------------------------------
alter table public.user_mfa_secrets add column if not exists last_used_step bigint;

create table if not exists public.st_staff_security_events (
  id bigint generated by default as identity primary key,
  business_code text not null,
  app_user_id text not null,
  event text not null,
  actor text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists st_staff_security_events_user
  on public.st_staff_security_events (business_code, app_user_id, created_at desc);

create table if not exists public.st_member_lifecycle_events (
  id bigint generated by default as identity primary key,
  business_code text not null,
  customer_id text not null,
  source text not null check (source in ('snapshot', 'relational')),
  from_status text not null default '',
  to_status text not null,
  actor text not null default '',
  actor_role text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists st_member_lifecycle_events_customer
  on public.st_member_lifecycle_events (business_code, customer_id, created_at desc);

-- Posted financial records seen in the snapshot (collections, transactions, ledger entries).
create table if not exists public.st_snapshot_financial_ledger (
  business_id text not null,
  kind text not null check (kind in ('collections', 'transactions', 'ledgerEntries')),
  record_id text not null,
  customer_id text not null default '',
  amount_from_amount bigint not null default 0,
  amount_field bigint,
  reversed boolean not null default false,
  first_seen_at timestamptz not null default now(),
  first_seen_by text not null default '',
  changed_at timestamptz,
  primary key (business_id, kind, record_id)
);
create index if not exists st_snapshot_financial_ledger_customer
  on public.st_snapshot_financial_ledger (business_id, customer_id);

do $$
declare t text;
begin
  foreach t in array array['st_staff_security_events', 'st_member_lifecycle_events', 'st_snapshot_financial_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) B4: authorization helpers re-check the live staff identity
-- ---------------------------------------------------------------------------
create or replace function public.st_business_authorized(p_business_code text)
returns boolean language sql stable as $$
  select coalesce(
    public.st_is_service_role()
      or (coalesce(p_business_code, '') <> ''
          and public.st_jwt_business_code() = p_business_code
          and public.st_caller_staff_ok()),
    false
  );
$$;

create or replace function public.st_tenant_match(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business_id is not null
    and (
      p_business_id = public.jwt_business_id()
      or p_business_id = public.resolve_business_id(public.st_jwt_business_code())
    )
    and public.st_caller_staff_ok();
$$;

-- Text business_id / business_code tables: same rule as 046 plus the live staff check.
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
         (%I = public.st_jwt_business_code()
          or %I = public.resolve_business_id(public.st_jwt_business_code())::text)
         and public.st_caller_staff_ok()
       ) with check (
         (%I = public.st_jwt_business_code()
          or %I = public.resolve_business_id(public.st_jwt_business_code())::text)
         and public.st_caller_staff_ok()
       )', r.table_name, r.column_name, r.column_name, r.column_name, r.column_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) B1: staff role / status / identity changes (every write path)
-- ---------------------------------------------------------------------------
create or replace function public.st_guard_app_users()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(public.st_jwt_claim('app_role'), '');
  v_self text := coalesce(public.st_jwt_app_user_id(), '');
  v_owner_roles constant text[] := array['SystemOwner', 'Owner', 'KBA', 'Developer', 'PlatformAdmin'];
  v_protected constant text[] := array['SystemOwner', 'Owner', 'KBA', 'Developer', 'PlatformAdmin',
    'Admin', 'AssistantManager', 'ManagingDirector', 'OperationsManager', 'Accountant', 'Auditor'];
  v_target text;
  v_identity_change boolean;
begin
  if public.st_is_trusted_session() then
    return coalesce(new, old);
  end if;
  if not public.st_caller_staff_ok() then
    raise exception 'not authorized to change staff accounts' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if v_role not in ('SystemOwner', 'KBA') then
      raise exception 'only an owner can delete staff accounts' using errcode = '42501';
    end if;
    if old.role = 'SystemOwner' then
      raise exception 'System Owner accounts cannot be deleted' using errcode = '42501';
    end if;
    if coalesce(old.client_id, old.id::text) = v_self then
      raise exception 'you cannot delete your own account' using errcode = '42501';
    end if;
    if old.role = any(v_owner_roles) and v_role <> 'SystemOwner' then
      raise exception 'only the System Owner can delete owner-level accounts' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if v_role not in ('SystemOwner', 'KBA', 'Admin') then
      raise exception 'not allowed to create staff accounts' using errcode = '42501';
    end if;
    if new.role = any(v_owner_roles) and v_role <> 'SystemOwner' then
      raise exception 'only the System Owner can grant owner-level roles' using errcode = '42501';
    end if;
    if new.role = any(v_protected) and v_role not in ('SystemOwner', 'KBA') then
      raise exception 'only an owner can create manager-level accounts' using errcode = '42501';
    end if;
    if coalesce(new.password_hash, '') <> '' then
      raise exception 'passwords are set through staff activation only' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  v_target := coalesce(old.client_id, old.id::text);
  if new.password_hash is distinct from old.password_hash then
    raise exception 'password hashes are changed by the staff-login service only' using errcode = '42501';
  end if;
  if new.business_id is distinct from old.business_id
     or new.client_id is distinct from old.client_id
     or new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'staff identity columns cannot be changed' using errcode = '42501';
  end if;
  v_identity_change := new.role is distinct from old.role
    or new.active is distinct from old.active
    or lower(new.username) is distinct from lower(old.username);

  if v_target = v_self then
    if v_identity_change then
      raise exception 'you cannot change your own role, status or username' using errcode = '42501';
    end if;
    return new;
  end if;
  if v_role not in ('SystemOwner', 'KBA', 'Admin') then
    raise exception 'not allowed to change staff accounts' using errcode = '42501';
  end if;
  if old.role = 'SystemOwner' and v_role <> 'SystemOwner' then
    raise exception 'only a System Owner can change a System Owner account' using errcode = '42501';
  end if;
  if (old.role = any(v_owner_roles) or new.role = any(v_owner_roles)) and v_role <> 'SystemOwner' then
    raise exception 'only the System Owner can grant or change owner-level roles' using errcode = '42501';
  end if;
  if (old.role = any(v_protected) or new.role = any(v_protected)) and v_role not in ('SystemOwner', 'KBA') then
    raise exception 'only an owner can change manager-level accounts' using errcode = '42501';
  end if;
  if old.role = 'SystemOwner' and old.active
     and (new.active is not true or new.role <> 'SystemOwner')
     and not exists (
       select 1 from public.app_users o
       where o.business_id = old.business_id and o.id <> old.id and o.role = 'SystemOwner' and o.active
     ) then
    raise exception 'the last active System Owner cannot be deactivated or demoted' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists st_guard_app_users on public.app_users;
create trigger st_guard_app_users
  before insert or update or delete on public.app_users
  for each row execute function public.st_guard_app_users();

-- B4: deactivation, role or identity change cuts off every session issued before it.
create or replace function public.st_app_users_session_cutoff()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_codes text[];
  v_link record;
  v_event text;
begin
  if not (
    (new.active is distinct from old.active and new.active is not true)
    or new.role is distinct from old.role
  ) then
    return new;
  end if;
  v_event := case when new.active is not true and old.active then 'staff_deactivated' else 'staff_role_changed' end;
  select array_remove(array[b.code, b.legacy_code], null) into v_codes
  from public.businesses b where b.id = old.business_id;
  for v_link in
    update public.st_staff_auth_links
    set sessions_not_before = now(), updated_at = now()
    where business_code = any(coalesce(v_codes, '{}')) and app_user_id = coalesce(old.client_id, old.id::text)
    returning business_code, app_user_id, auth_user_id
  loop
    insert into public.st_staff_security_events (business_code, app_user_id, event, actor, details)
    values (v_link.business_code, v_link.app_user_id, v_event,
            coalesce(public.st_jwt_app_user_id(), case when public.st_is_service_role() then 'service' else 'database' end),
            jsonb_build_object('from_role', old.role, 'to_role', new.role, 'active', new.active));
    if new.active is not true then
      -- Best effort on Supabase Auth; the database cutoff above applies regardless.
      begin
        execute 'update auth.users set banned_until = now() + interval ''100 years'' where id = $1' using v_link.auth_user_id;
      exception when others then null;
      end;
      begin
        execute 'delete from auth.refresh_tokens where user_id = $1::text' using v_link.auth_user_id;
      exception when others then null;
      end;
      begin
        execute 'delete from auth.sessions where user_id = $1' using v_link.auth_user_id;
      exception when others then null;
      end;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists st_app_users_session_cutoff on public.app_users;
create trigger st_app_users_session_cutoff
  after update on public.app_users
  for each row execute function public.st_app_users_session_cutoff();

-- Staff administration from the app: create/rename/re-role/(de)activate. Never sets passwords;
-- new accounts get one through st_issue_staff_activation. The B1 trigger decides who may do what.
create or replace function public.st_upsert_staff_account(p_business_code text, p_user jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_id text := nullif(trim(coalesce(p_user ->> 'id', '')), '');
  v_username text := nullif(trim(coalesce(p_user ->> 'username', '')), '');
  v_name text := nullif(trim(coalesce(p_user ->> 'name', '')), '');
  v_app_role text := coalesce(nullif(p_user ->> 'role', ''), 'Collector');
  v_active boolean;
  v_row public.app_users%rowtype;
  v_role text;
begin
  perform public.st_assert_business(p_business_code);
  if not (public.st_is_service_role() or coalesce(public.st_jwt_claim('app_role'), '') in ('SystemOwner', 'KBA', 'Admin')) then
    raise exception 'not allowed to manage staff accounts' using errcode = '42501';
  end if;
  if v_id is null or length(v_id) > 120 or v_username is null or lower(v_username) !~ '^[a-z0-9._@-]{1,80}$' then
    raise exception 'a staff id and a plain username are required' using errcode = '22023';
  end if;
  begin
    v_active := nullif(p_user ->> 'active', '')::boolean;
  exception when others then
    raise exception 'active must be true or false' using errcode = '22023';
  end;
  v_business := public.resolve_business_id(p_business_code);
  if v_business is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  select * into v_row from public.app_users where business_id = v_business and client_id = v_id;
  if found then
    v_role := case when public.st_app_role_from_relational(v_row.role) = v_app_role then v_row.role
                   else public.st_relational_role_from_app(v_app_role) end;
    update public.app_users
    set username = v_username,
        name = coalesce(v_name, name),
        role = v_role,
        active = coalesce(v_active, active),
        updated_at = now()
    where id = v_row.id;
    return jsonb_build_object('ok', true, 'id', v_id, 'created', false, 'has_password', coalesce(v_row.password_hash, '') <> '');
  end if;
  insert into public.app_users (business_id, client_id, username, name, role, active)
  values (v_business, v_id, v_username, coalesce(v_name, v_username), public.st_relational_role_from_app(v_app_role), coalesce(v_active, true));
  return jsonb_build_object('ok', true, 'id', v_id, 'created', true, 'has_password', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) B5: MFA secrets are server-only; resets are owner-controlled and audited
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)') is not null then
    revoke execute on function public.upsert_user_mfa(text, text, text, boolean) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.st_reset_staff_mfa(p_business_code text, p_username text, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trusted boolean := public.st_is_trusted_session();
  v_role text := coalesce(public.st_jwt_claim('app_role'), '');
  v_business uuid := public.resolve_business_id(p_business_code);
  v_user public.app_users%rowtype;
  v_target text;
  v_removed int;
begin
  if not v_trusted then
    perform public.st_assert_business(p_business_code);
    if v_role not in ('SystemOwner', 'KBA') then
      raise exception 'only an owner can reset MFA' using errcode = '42501';
    end if;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required for an MFA reset' using errcode = '22023';
  end if;
  if v_business is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  select * into v_user from public.app_users u
  where u.business_id = v_business and lower(u.username) = lower(trim(coalesce(p_username, '')));
  if not found then
    raise exception 'no staff account with that username' using errcode = 'P0002';
  end if;
  v_target := coalesce(v_user.client_id, v_user.id::text);
  if not v_trusted then
    if v_target = coalesce(public.st_jwt_app_user_id(), '') then
      raise exception 'you cannot reset your own MFA' using errcode = '42501';
    end if;
    if v_user.role in ('SystemOwner', 'Owner', 'KBA', 'Developer') and v_role <> 'SystemOwner' then
      raise exception 'only the System Owner can reset an owner''s MFA' using errcode = '42501';
    end if;
  end if;
  delete from public.user_mfa_secrets where business_id = v_business and user_client_id = v_target;
  get diagnostics v_removed = row_count;
  update public.st_staff_auth_links set sessions_not_before = now(), updated_at = now()
  where business_code = p_business_code and app_user_id = v_target;
  insert into public.st_staff_security_events (business_code, app_user_id, event, actor, details)
  values (p_business_code, v_target, 'mfa_reset',
          coalesce(public.st_jwt_app_user_id(), case when public.st_is_service_role() then 'service' else 'database' end),
          jsonb_build_object('reason', left(trim(p_reason), 500), 'had_mfa', v_removed > 0));
  return jsonb_build_object('ok', true, 'username', v_user.username, 'had_mfa', v_removed > 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) B3 + B6 + B7: cloud snapshot scrubbing, posted history and member lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.st_is_secret_key(p_key text)
returns boolean language sql immutable as $$
  select lower(coalesce(p_key, '')) = any (array[
      'password', 'passwordhash', 'password_hash', 'passwordhint', 'loginpasswordhint', 'pinhash', 'pin_hash',
      'mfasecret', 'mfa_secret', 'mfapendingsecret', 'totpsecret', 'totp_secret', 'otpsecret', 'secret',
      'activationcode', 'activation_code', 'activationcodes',
      'accesstoken', 'access_token', 'refreshtoken', 'refresh_token', 'sessiontoken', 'session_token', 'idtoken', 'id_token',
      'synctoken', 'syncaccesskey', 'cloudkey', 'accesskey', 'access_key', 'momowebhooksecret', 'webhooksecret',
      'recoverycode', 'recoverycodes', 'recovery_codes', 'backupcodes', 'backup_codes',
      'servicerolekey', 'service_role_key', 'servicekey', 'privatekey', 'private_key', 'portalpin', 'portal_pin'
    ])
    or lower(coalesce(p_key, '')) ~ '(secret|token|passwordhash|password_hash)$';
$$;

create or replace function public.st_strip_secret_keys(p jsonb)
returns jsonb language plpgsql immutable as $$
begin
  if p is null then
    return null;
  elsif jsonb_typeof(p) = 'object' then
    return coalesce((
      select jsonb_object_agg(e.key,
        case when jsonb_typeof(e.value) in ('object', 'array') then public.st_strip_secret_keys(e.value) else e.value end)
      from jsonb_each(p) e
      where not public.st_is_secret_key(e.key)
    ), '{}'::jsonb);
  elsif jsonb_typeof(p) = 'array' then
    return coalesce((
      select jsonb_agg(
        case when jsonb_typeof(a.value) in ('object', 'array') then public.st_strip_secret_keys(a.value) else a.value end
        order by a.ord)
      from jsonb_array_elements(p) with ordinality a(value, ord)
    ), '[]'::jsonb);
  end if;
  return p;
end;
$$;

-- A staff-set member PIN arrives in plaintext over TLS; only its bcrypt hash is kept.
create or replace function public.st_store_portal_pin(p_business_code text, p_customer_id text, p_pin text, p_set_at text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_set timestamptz;
  v_existing timestamptz;
begin
  if coalesce(p_pin, '') = '' or coalesce(p_customer_id, '') = '' or coalesce(p_business_code, '') = '' then
    return;
  end if;
  begin
    v_set := nullif(p_set_at, '')::timestamptz;
  exception when others then
    v_set := null;
  end;
  select updated_at into v_existing from public.st_portal_pins
  where business_code = p_business_code and customer_id = p_customer_id;
  if found and (v_set is null or v_set <= v_existing) then
    return;
  end if;
  insert into public.st_portal_pins (business_code, customer_id, pin_hash, updated_at)
  values (p_business_code, p_customer_id, crypt(p_pin, gen_salt('bf', 8)), greatest(now(), coalesce(v_set, now())))
  on conflict (business_code, customer_id) do update
    set pin_hash = excluded.pin_hash, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.st_scrub_snapshot_payload(p_business_code text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return p_payload;
  end if;
  if jsonb_typeof(p_payload -> 'customers') = 'array' then
    for c in select value from jsonb_array_elements(p_payload -> 'customers') loop
      if jsonb_typeof(c) = 'object' and coalesce(c ->> 'portalPin', '') <> '' then
        perform public.st_store_portal_pin(p_business_code, c ->> 'id', c ->> 'portalPin', c ->> 'portalPinSetAt');
      end if;
    end loop;
  end if;
  if p_payload::text !~* '"[^"]*(secret|token|password|pin_?hash|activation_?codes?|recovery|backup_?codes|portal_?pin|access_?key|cloudkey|private_?key|service_?key)[^"]*"\s*:' then
    return p_payload;
  end if;
  return public.st_strip_secret_keys(p_payload);
end;
$$;

create or replace function public.st_record_pesewas_from_amount(p_record jsonb)
returns bigint language sql immutable as $$
  select round(public.st_num(p_record ->> 'amount') * 100)::bigint;
$$;

create or replace function public.st_record_pesewas_field(p_record jsonb)
returns bigint language sql immutable as $$
  select case when coalesce(p_record ->> 'amountPesewas', '') = '' then null
              else round(public.st_num(p_record ->> 'amountPesewas'))::bigint end;
$$;

create or replace function public.st_snapshot_financial_rows(p_payload jsonb)
returns table (kind text, record_id text, customer_id text, amount_from_amount bigint, amount_field bigint, reversed boolean)
language sql immutable as $$
  select k.kind, e ->> 'id', coalesce(e ->> 'customerId', ''),
         public.st_record_pesewas_from_amount(e), public.st_record_pesewas_field(e),
         public.st_truthy(e ->> 'reversed')
  from unnest(array['collections', 'transactions', 'ledgerEntries']) as k(kind)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p_payload -> k.kind) = 'array' then p_payload -> k.kind else '[]'::jsonb end
  ) as e
  where jsonb_typeof(e) = 'object' and coalesce(e ->> 'id', '') <> '';
$$;

-- An approved adjustment (src/core/collection-ops.js applyAdjustment) may lower a collection.
create or replace function public.st_adjustment_allows(p_payload jsonb, p_record_id text, p_old bigint, p_new bigint)
returns boolean language sql immutable as $$
  select exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(p_payload -> 'collectionAdjustments') = 'array' then p_payload -> 'collectionAdjustments' else '[]'::jsonb end
    ) a
    where a ->> 'collectionId' = p_record_id
      and a ->> 'status' = 'Approved'
      and coalesce(a ->> 'approvedBy', '') <> ''
      and round(public.st_num(a ->> 'originalAmount') * 100)::bigint = p_old
      and round((public.st_num(a ->> 'originalAmount') - public.st_num(a ->> 'amount')) * 100)::bigint = p_new
      and public.st_num(a ->> 'amount') > 0
  );
$$;

create or replace function public.st_snapshot_history_violation(p_business_code text, p_payload jsonb, p_may_adjust boolean)
returns text language sql stable security definer set search_path = public as $$
  with cur as (select * from public.st_snapshot_financial_rows(p_payload)),
  bad as (
    select l.kind, l.record_id,
      case
        when c.record_id is null then 'cannot be removed'
        when c.customer_id is distinct from l.customer_id then 'cannot move to another member'
        when l.reversed and not c.reversed then 'reversal cannot be undone'
        else 'amount cannot be changed; post a reversal or an approved adjustment'
      end as problem
    from public.st_snapshot_financial_ledger l
    left join cur c on c.kind = l.kind and c.record_id = l.record_id
    where l.business_id = p_business_code
      and (
        c.record_id is null
        or c.customer_id is distinct from l.customer_id
        or (l.reversed and not c.reversed)
        or ((c.amount_from_amount <> l.amount_from_amount
             or (c.amount_field is distinct from l.amount_field and c.amount_field is distinct from c.amount_from_amount))
            and not (p_may_adjust and l.kind = 'collections'
                     and c.amount_from_amount < l.amount_from_amount
                     and (c.amount_field is null or c.amount_field = c.amount_from_amount)
                     and public.st_adjustment_allows(p_payload, l.record_id, l.amount_from_amount, c.amount_from_amount)))
      )
    limit 1
  )
  select format('posted %s record %s %s', kind, record_id, problem) from bad;
$$;

create or replace function public.st_register_snapshot_history(p_business_code text, p_payload jsonb, p_actor text, p_rewrite boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.st_snapshot_financial_ledger as l
    (business_id, kind, record_id, customer_id, amount_from_amount, amount_field, reversed, first_seen_by)
  select distinct on (r.kind, r.record_id)
    p_business_code, r.kind, r.record_id, r.customer_id, r.amount_from_amount, r.amount_field, r.reversed, p_actor
  from public.st_snapshot_financial_rows(p_payload) r
  order by r.kind, r.record_id
  on conflict (business_id, kind, record_id) do update set
    reversed = case when p_rewrite then excluded.reversed else l.reversed or excluded.reversed end,
    customer_id = case when p_rewrite then excluded.customer_id else l.customer_id end,
    amount_from_amount = excluded.amount_from_amount,
    amount_field = excluded.amount_field,
    changed_at = now()
  where l.reversed is distinct from (case when p_rewrite then excluded.reversed else l.reversed or excluded.reversed end)
     or l.amount_from_amount is distinct from excluded.amount_from_amount
     or l.amount_field is distinct from excluded.amount_field
     or (p_rewrite and l.customer_id is distinct from excluded.customer_id);
  if p_rewrite then
    delete from public.st_snapshot_financial_ledger l
    where l.business_id = p_business_code
      and not exists (
        select 1 from public.st_snapshot_financial_rows(p_payload) r
        where r.kind = l.kind and r.record_id = l.record_id
      );
  end if;
end;
$$;

create or replace function public.st_member_status(p_customer jsonb)
returns text language sql immutable as $$
  select coalesce(nullif(p_customer ->> 'memberStatus', ''),
                  case when lower(coalesce(p_customer ->> 'active', 'true')) = 'false' then 'Closed' else 'Active' end);
$$;

-- Members with posted history must stay; deletions and status changes are authorized and logged.
create or replace function public.st_check_snapshot_members(
  p_business_code text, p_old jsonb, p_new jsonb, p_role text, p_trusted boolean, p_actor text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_missing text;
  r record;
begin
  select l.customer_id into v_missing
  from public.st_snapshot_financial_ledger l
  where l.business_id = p_business_code and l.customer_id <> ''
    and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(p_new -> 'customers') = 'array' then p_new -> 'customers' else '[]'::jsonb end) c
      where c ->> 'id' = l.customer_id
    )
  limit 1;
  if v_missing is not null then
    raise exception 'member % has financial history and cannot be deleted; close the member instead', v_missing
      using errcode = '23514';
  end if;
  if p_old is null then
    return;
  end if;
  for r in
    with o as (
      select c ->> 'id' as id, public.st_member_status(c) as status
      from jsonb_array_elements(case when jsonb_typeof(p_old -> 'customers') = 'array' then p_old -> 'customers' else '[]'::jsonb end) c
      where coalesce(c ->> 'id', '') <> ''
    ), n as (
      select c ->> 'id' as id, public.st_member_status(c) as status
      from jsonb_array_elements(case when jsonb_typeof(p_new -> 'customers') = 'array' then p_new -> 'customers' else '[]'::jsonb end) c
      where coalesce(c ->> 'id', '') <> ''
    )
    select distinct o.id, o.status as from_status, coalesce(n.status, 'DELETED') as to_status
    from o left join n on n.id = o.id
    where n.id is null or n.status is distinct from o.status
  loop
    if r.to_status = 'DELETED' then
      if not p_trusted and p_role <> 'SystemOwner' then
        raise exception 'only the System Owner can delete a member record (member %)', r.id using errcode = '42501';
      end if;
    elsif not p_trusted and p_role not in ('SystemOwner', 'KBA', 'Admin', 'ManagingDirector') then
      raise exception 'not allowed to change member status (member %)', r.id using errcode = '42501';
    end if;
    insert into public.st_member_lifecycle_events (business_code, customer_id, source, from_status, to_status, actor, actor_role)
    values (p_business_code, r.id, 'snapshot', r.from_status, r.to_status, p_actor, p_role);
  end loop;
end;
$$;

create or replace function public.st_guard_cloud_snapshot()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_trusted boolean := public.st_is_trusted_session();
  v_rewrite boolean := v_trusted and coalesce(current_setting('smile_trust.allow_history_rewrite', true), '') = 'on';
  v_role text := coalesce(public.st_jwt_claim('app_role'), case when v_trusted then 'trusted' else '' end);
  v_actor text := coalesce(public.st_jwt_app_user_id(), case when public.st_is_service_role() then 'service' else 'database' end);
  v_violation text;
begin
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id and not v_trusted then
    raise exception 'a snapshot cannot move to another business' using errcode = '42501';
  end if;
  new.payload := public.st_scrub_snapshot_payload(new.business_id, new.payload);
  if not v_rewrite then
    v_violation := public.st_snapshot_history_violation(
      new.business_id, new.payload,
      v_trusted or v_role in ('SystemOwner', 'KBA', 'Admin', 'ManagingDirector', 'Accountant'));
    if v_violation is not null then
      raise exception '%', v_violation using errcode = '23514';
    end if;
    perform public.st_check_snapshot_members(
      new.business_id, case when tg_op = 'UPDATE' then old.payload else null end, new.payload, v_role, v_trusted, v_actor);
  end if;
  perform public.st_register_snapshot_history(new.business_id, new.payload, v_actor, v_rewrite);
  return new;
end;
$$;

drop trigger if exists st_guard_cloud_snapshot on public.smile_trust_cloud_snapshots;
create trigger st_guard_cloud_snapshot
  before insert or update on public.smile_trust_cloud_snapshots
  for each row execute function public.st_guard_cloud_snapshot();

-- B2: snapshot reads for active staff; whole-snapshot writes for management roles only.
drop policy if exists st_snapshots_select on public.smile_trust_cloud_snapshots;
drop policy if exists st_snapshots_insert on public.smile_trust_cloud_snapshots;
drop policy if exists st_snapshots_update on public.smile_trust_cloud_snapshots;

create policy st_snapshots_select on public.smile_trust_cloud_snapshots
  for select to authenticated
  using (business_id = public.st_jwt_business_code() and public.st_caller_staff_ok());

create policy st_snapshots_insert on public.smile_trust_cloud_snapshots
  for insert to authenticated
  with check (business_id = public.st_jwt_business_code() and public.st_jwt_is_manager() and public.st_caller_staff_ok());

create policy st_snapshots_update on public.smile_trust_cloud_snapshots
  for update to authenticated
  using (business_id = public.st_jwt_business_code() and public.st_jwt_is_manager() and public.st_caller_staff_ok())
  with check (business_id = public.st_jwt_business_code() and public.st_jwt_is_manager() and public.st_caller_staff_ok());

revoke delete, truncate on public.smile_trust_cloud_snapshots from authenticated;

-- B2: collectors (and any staff) upload their own collections — including ones queued offline —
-- with the collection's own ledger pair and transaction mirror. Validated and merged here.
create or replace function public.st_submit_collections(p_business_code text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller text := coalesce(public.st_jwt_app_user_id(), '');
  v_manager boolean := public.st_is_service_role() or public.st_jwt_is_manager();
  v_snapshot_id bigint;
  v_payload jsonb;
  v_item jsonb;
  v_col jsonb;
  v_id text;
  v_key text;
  v_customer jsonb;
  v_group jsonb;
  v_caller_group text;
  v_assigned text[];
  v_collector text;
  v_pesewas bigint;
  v_method text;
  v_entry jsonb;
  v_entries jsonb;
  v_txs jsonb;
  v_entry_ids text[];
  v_problem text;
  v_col_ids text[];
  v_keys text[];
  v_led_ids text[];
  v_tx_ids text[];
  v_new_cols jsonb := '[]'::jsonb;
  v_new_led jsonb := '[]'::jsonb;
  v_new_tx jsonb := '[]'::jsonb;
  v_accepted jsonb := '[]'::jsonb;
  v_duplicates jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
begin
  perform public.st_assert_business(p_business_code);
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'submit between 1 and 200 collections at a time' using errcode = '22023';
  end if;
  select id, payload into v_snapshot_id, v_payload
  from public.smile_trust_cloud_snapshots where business_id = p_business_code
  for update;
  if v_snapshot_id is null then
    raise exception 'this business has no cloud data yet; a manager must sync first' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(e ->> 'id'), '{}'), coalesce(array_agg(e ->> 'idempotencyKey') filter (where coalesce(e ->> 'idempotencyKey', '') <> ''), '{}')
    into v_col_ids, v_keys
  from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'collections') = 'array' then v_payload -> 'collections' else '[]'::jsonb end) e;
  select coalesce(array_agg(e ->> 'id'), '{}') into v_led_ids
  from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'ledgerEntries') = 'array' then v_payload -> 'ledgerEntries' else '[]'::jsonb end) e;
  select coalesce(array_agg(e ->> 'id'), '{}') into v_tx_ids
  from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'transactions') = 'array' then v_payload -> 'transactions' else '[]'::jsonb end) e;
  select u ->> 'groupId' into v_caller_group
  from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'users') = 'array' then v_payload -> 'users' else '[]'::jsonb end) u
  where u ->> 'id' = v_caller limit 1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_col := case when jsonb_typeof(v_item -> 'collection') = 'object' then v_item -> 'collection' else v_item end;
    v_id := coalesce(v_col ->> 'id', '');
    v_key := coalesce(v_col ->> 'idempotencyKey', '');
    v_problem := null;
    if jsonb_typeof(v_col) is distinct from 'object' or v_id = '' or length(v_id) > 120 then
      v_rejected := v_rejected || jsonb_build_object('id', v_id, 'reason', 'missing collection id');
      continue;
    end if;
    if v_id = any(v_col_ids) or (v_key <> '' and v_key = any(v_keys)) then
      v_duplicates := v_duplicates || to_jsonb(v_id);
      continue;
    end if;

    select c into v_customer
    from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'customers') = 'array' then v_payload -> 'customers' else '[]'::jsonb end) c
    where c ->> 'id' = v_col ->> 'customerId' limit 1;
    select g into v_group
    from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'groups') = 'array' then v_payload -> 'groups' else '[]'::jsonb end) g
    where g ->> 'id' = v_customer ->> 'groupId' limit 1;
    v_assigned := array_remove(array[nullif(v_customer ->> 'collectorId', ''), nullif(v_group ->> 'collectorId', '')], null);
    v_pesewas := public.st_record_pesewas_from_amount(v_col);
    v_method := coalesce(nullif(v_col ->> 'paymentMethod', ''), 'Cash');

    if v_customer is null then
      v_problem := 'unknown member';
    elsif public.st_member_status(v_customer) <> 'Active' then
      v_problem := 'member is not active';
    elsif v_pesewas < 0 or (public.st_record_pesewas_field(v_col) is not null and public.st_record_pesewas_field(v_col) <> v_pesewas) then
      v_problem := 'invalid amount';
    elsif public.st_truthy(v_col ->> 'reversed') then
      v_problem := 'a reversed collection cannot be submitted';
    elsif not v_manager and coalesce(nullif(v_col ->> 'userId', ''), v_caller) <> v_caller then
      v_problem := 'collection was recorded by another staff member';
    elsif not v_manager and cardinality(v_assigned) > 0 and not (v_caller = any(v_assigned))
          and coalesce(v_caller_group, '') <> coalesce(v_customer ->> 'groupId', '') then
      v_problem := 'member is assigned to another collector';
    end if;

    v_collector := case
      when v_manager then coalesce(nullif(v_col ->> 'collectorId', ''), v_caller)
      when nullif(v_col ->> 'collectorId', '') = any(v_assigned || v_caller) then v_col ->> 'collectorId'
      else v_caller end;

    -- The collection's own ledger pair: customer credit + channel debit, same amount and reference.
    v_entries := case when jsonb_typeof(v_item -> 'ledgerEntries') = 'array' then v_item -> 'ledgerEntries' else '[]'::jsonb end;
    v_txs := case when jsonb_typeof(v_item -> 'transactions') = 'array' then v_item -> 'transactions' else '[]'::jsonb end;
    v_entry_ids := '{}';
    if v_problem is null and (jsonb_array_length(v_entries) > 2 or jsonb_array_length(v_txs) > 1) then
      v_problem := 'too many linked records';
    end if;
    if v_problem is null then
      for v_entry in select value from jsonb_array_elements(v_entries) loop
        if coalesce(v_entry ->> 'id', '') = '' or v_entry ->> 'id' = any(v_led_ids) or v_entry ->> 'id' = any(v_entry_ids)
           or v_entry ->> 'referenceId' is distinct from v_id
           or v_entry ->> 'referenceType' is distinct from 'collection'
           or public.st_record_pesewas_from_amount(v_entry) <> v_pesewas
           or public.st_truthy(v_entry ->> 'reversed')
           or not (
             (v_entry ->> 'direction' = 'credit' and v_entry ->> 'account' = 'customer:' || (v_col ->> 'customerId')
              and v_entry ->> 'customerId' = v_col ->> 'customerId')
             or (v_entry ->> 'direction' = 'debit' and coalesce(v_entry ->> 'customerId', '') = ''
                 and v_entry ->> 'account' in ('account:cash', 'account:momo', 'account:bank', 'account:pos'))
           ) then
          v_problem := 'invalid ledger entry';
          exit;
        end if;
        v_entry_ids := v_entry_ids || (v_entry ->> 'id');
      end loop;
    end if;
    if v_problem is null then
      for v_entry in select value from jsonb_array_elements(v_txs) loop
        if coalesce(v_entry ->> 'id', '') = '' or v_entry ->> 'id' = any(v_tx_ids)
           or v_entry ->> 'ref' is distinct from v_id
           or v_entry ->> 'customerId' is distinct from v_col ->> 'customerId'
           or public.st_record_pesewas_from_amount(v_entry) <> v_pesewas
           or public.st_truthy(v_entry ->> 'reversed')
           or coalesce(v_entry ->> 'type', '') <> 'Susu Deposit'
           or not (coalesce(v_entry ->> 'ledgerEntryId', '') = any(v_entry_ids)) then
          v_problem := 'invalid transaction';
          exit;
        end if;
      end loop;
    end if;
    if v_problem is not null then
      v_rejected := v_rejected || jsonb_build_object('id', v_id, 'reason', v_problem);
      continue;
    end if;

    v_col := (v_col - 'reversedAt' - 'reversalId' - 'reversedBy' - 'adjusted' - 'approvedBy') || jsonb_build_object(
      'userId', case when v_manager then coalesce(nullif(v_col ->> 'userId', ''), v_caller) else v_caller end,
      'collectorId', v_collector,
      'groupId', v_customer ->> 'groupId',
      'reversed', false,
      'verificationStatus', case when lower(v_method) = 'cash' then coalesce(nullif(v_col ->> 'verificationStatus', ''), 'Verified') else 'Pending Verification' end,
      'submittedBy', v_caller,
      'serverReceivedAt', now(),
      'syncStatus', 'Synced'
    );
    v_new_cols := v_new_cols || jsonb_build_array(v_col);
    for v_entry in select value from jsonb_array_elements(v_entries) loop
      v_new_led := v_new_led || jsonb_build_array(v_entry || jsonb_build_object(
        'createdBy', case when v_manager then coalesce(nullif(v_entry ->> 'createdBy', ''), v_caller) else v_caller end,
        'collectorId', v_collector, 'groupId', v_customer ->> 'groupId', 'reversed', false));
      v_led_ids := v_led_ids || (v_entry ->> 'id');
    end loop;
    for v_entry in select value from jsonb_array_elements(v_txs) loop
      v_new_tx := v_new_tx || jsonb_build_array(v_entry || jsonb_build_object(
        'userId', case when v_manager then coalesce(nullif(v_entry ->> 'userId', ''), v_caller) else v_caller end,
        'reversed', false, 'immutable', true));
      v_tx_ids := v_tx_ids || (v_entry ->> 'id');
    end loop;
    v_col_ids := v_col_ids || v_id;
    if v_key <> '' then v_keys := v_keys || v_key; end if;
    v_accepted := v_accepted || to_jsonb(v_id);
  end loop;

  if jsonb_array_length(v_new_cols) > 0 then
    v_payload := jsonb_set(v_payload, '{collections}',
      case when jsonb_typeof(v_payload -> 'collections') = 'array' then v_payload -> 'collections' else '[]'::jsonb end || v_new_cols);
    v_payload := jsonb_set(v_payload, '{ledgerEntries}',
      case when jsonb_typeof(v_payload -> 'ledgerEntries') = 'array' then v_payload -> 'ledgerEntries' else '[]'::jsonb end || v_new_led);
    v_payload := jsonb_set(v_payload, '{transactions}',
      case when jsonb_typeof(v_payload -> 'transactions') = 'array' then v_payload -> 'transactions' else '[]'::jsonb end || v_new_tx);
    update public.smile_trust_cloud_snapshots
    set payload = v_payload, saved_at = now(), saved_by = 'staff:' || v_caller
    where id = v_snapshot_id;
  end if;
  return jsonb_build_object('ok', true, 'accepted', v_accepted, 'duplicates', v_duplicates, 'rejected', v_rejected);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) B6: business RPCs derive the actor and role from the session, never from the payload
-- ---------------------------------------------------------------------------
create or replace function public.st_scope_staff_payload(p_payload jsonb)
returns jsonb language plpgsql stable as $$
declare
  v jsonb := coalesce(p_payload, '{}'::jsonb) - 'collector_role' - 'role';
begin
  if public.st_is_service_role() or public.st_jwt_is_manager() then
    return v;
  end if;
  v := v - 'collector_username' - 'collector_name' - 'actor_username' - 'actor_name' - 'actor_client_id' - 'active';
  v := v || jsonb_build_object('collector_client_id', public.st_jwt_app_user_id(), 'reversed', 'false');
  if lower(coalesce(nullif(v ->> 'payment_method', ''), 'Cash')) <> 'cash' then
    v := v || jsonb_build_object('verification_status', 'Pending Verification');
  end if;
  return v;
end;
$$;

create or replace function public.st_assert_payload_amounts(p_payload jsonb)
returns void language plpgsql immutable as $$
begin
  if public.st_num(p_payload ->> 'amount') < 0 or public.st_num(p_payload ->> 'amount_pesewas') < 0 then
    raise exception 'amounts cannot be negative' using errcode = '22023';
  end if;
end;
$$;

-- A non-manager may only record against a member that is unassigned or assigned to them.
create or replace function public.st_assert_customer_assignment(p_business_code text, p_customer_client_id text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.st_is_service_role() or public.st_jwt_is_manager() or coalesce(p_customer_client_id, '') = '' then
    return;
  end if;
  if exists (
    select 1 from public.customers c
    join public.app_users u on u.id = c.collector_id
    where c.business_id = public.resolve_business_id(p_business_code)
      and c.client_id = p_customer_client_id
      and u.active and u.role = 'Collector'
      and coalesce(u.client_id, u.id::text) <> coalesce(public.st_jwt_app_user_id(), '')
  ) then
    raise exception 'member is assigned to another collector' using errcode = '42501';
  end if;
end;
$$;

do $wrap$
begin
  if to_regprocedure('public.st_internal_record_collection_from_client(jsonb)') is not null then
    execute $f$
      create or replace function public.record_collection_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      declare v jsonb;
      begin
        perform public.st_assert_business(payload->>'business_code');
        perform public.st_assert_payload_amounts(payload);
        perform public.st_assert_customer_assignment(payload->>'business_code', payload->>'customer_client_id');
        v := public.st_scope_staff_payload(payload);
        return public.st_internal_record_collection_from_client(v);
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_record_deposit_from_client(jsonb)') is not null then
    execute $f$
      create or replace function public.record_deposit_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      declare v jsonb;
      begin
        perform public.st_assert_business(payload->>'business_code');
        perform public.st_assert_payload_amounts(payload);
        perform public.st_assert_customer_assignment(payload->>'business_code', payload->>'customer_client_id');
        v := public.st_scope_staff_payload(payload);
        return public.st_internal_record_deposit_from_client(v);
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_record_withdrawal_from_client(jsonb)') is not null then
    execute $f$
      create or replace function public.record_withdrawal_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      declare
        v_role text := coalesce(public.st_jwt_claim('app_role'), '');
        v jsonb;
      begin
        perform public.st_assert_business(payload->>'business_code');
        perform public.st_assert_payload_amounts(payload);
        if public.st_is_service_role() then
          return public.st_internal_record_withdrawal_from_client(payload);
        end if;
        if not (public.st_jwt_is_manager() or v_role in ('Cashier', 'Teller')) then
          raise exception 'not allowed to record withdrawals' using errcode = '42501';
        end if;
        v := (payload - 'role' - 'actor_username' - 'actor_name' - 'actor_client_id')
             || jsonb_build_object('role', v_role, 'actor_client_id', public.st_jwt_app_user_id());
        return public.st_internal_record_withdrawal_from_client(v);
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_record_loan_repayment_from_client(jsonb)') is not null then
    execute $f$
      create or replace function public.record_loan_repayment_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        perform public.st_assert_payload_amounts(payload);
        return public.st_internal_record_loan_repayment_from_client(payload);
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_upsert_customer_from_client(jsonb)') is not null then
    execute $f$
      create or replace function public.upsert_customer_from_client(payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(payload->>'business_code');
        perform public.st_assert_customer_assignment(payload->>'business_code', payload->>'customer_client_id');
        return public.st_internal_upsert_customer_from_client(public.st_scope_staff_payload(payload));
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_import_snapshot_batch(text, jsonb)') is not null then
    execute $f$
      create or replace function public.import_snapshot_batch(business_code text, snapshot jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(business_code);
        if not (public.st_is_service_role() or public.st_jwt_is_owner()) then
          raise exception 'only an owner can import a snapshot' using errcode = '42501';
        end if;
        return public.st_internal_import_snapshot_batch(business_code, snapshot);
      end $b$;
    $f$;
  end if;

  if to_regprocedure('public.st_internal_record_momo_webhook(text, jsonb)') is not null then
    execute $f$
      create or replace function public.record_momo_webhook(business_code text, payload jsonb)
      returns jsonb language plpgsql security definer set search_path = public as $b$
      begin
        perform public.st_assert_business(business_code);
        if not (public.st_is_service_role() or public.st_jwt_is_manager()) then
          raise exception 'elevated role required' using errcode = '42501';
        end if;
        return public.st_internal_record_momo_webhook(business_code, payload);
      end $b$;
    $f$;
  end if;
end $wrap$;

-- ---------------------------------------------------------------------------
-- 8) B6/B7: relational financial tables
-- ---------------------------------------------------------------------------
-- Posted rows: no client writes at all (security-definer RPCs only), never deleted, and only
-- status columns may change after posting.
create or replace function public.st_guard_posted_rows()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_allowed text[] := coalesce(tg_argv::text[], '{}');
  v_old jsonb;
  v_new jsonb;
  k text;
begin
  if public.st_is_trusted_session() and coalesce(current_setting('smile_trust.allow_history_rewrite', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'posted % rows cannot be deleted; post a reversal instead', tg_table_name using errcode = '23514';
  end if;
  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  -- Generated columns are not yet computed in BEFORE triggers; they derive from guarded columns.
  foreach k in array v_allowed || array['updated_at', 'version'] || coalesce(array(
      select a.attname::text from pg_attribute a
      where a.attrelid = tg_relid and a.attgenerated <> '' and a.attnum > 0 and not a.attisdropped), '{}') loop
    v_old := v_old - k;
    v_new := v_new - k;
  end loop;
  if v_old is distinct from v_new then
    raise exception 'posted % rows are immutable (%); post a reversal or adjustment instead', tg_table_name,
      (select string_agg(n.key, ', ') from jsonb_each(v_new) n where v_old -> n.key is distinct from n.value)
      using errcode = '23514';
  end if;
  if (to_jsonb(old) ? 'reversed') and coalesce((to_jsonb(old) ->> 'reversed')::boolean, false)
     and not coalesce((to_jsonb(new) ->> 'reversed')::boolean, false) then
    raise exception 'a reversal cannot be undone' using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('collections', array['verification_status', 'reversed']),
      ('ledger_entries', array[]::text[]),
      ('journal_entries', array[]::text[]),
      ('journal_lines', array[]::text[]),
      ('loan_repayments', array['status']),
      ('loan_disbursements', array[]::text[]),
      ('reversals', array['status', 'approved_by', 'reversal_ledger_id']),
      ('group_distributions', array['status', 'approved_by']),
      ('audit_log', array[]::text[])
    ) as t(name, allowed)
  loop
    if to_regclass('public.' || r.name) is not null then
      execute format('drop trigger if exists st_guard_posted_rows on public.%I', r.name);
      execute format(
        'create trigger st_guard_posted_rows before update or delete on public.%I for each row execute function public.st_guard_posted_rows(%s)',
        r.name,
        coalesce((select string_agg(quote_literal(a), ', ') from unnest(r.allowed) a), ''));
    end if;
  end loop;
end $$;

-- Client privileges: ledgers are written only through RPCs; workflow tables only by managers.
do $$
declare
  t text;
begin
  foreach t in array array['collections', 'ledger_entries', 'journal_entries', 'journal_lines', 'loan_repayments',
                           'loan_disbursements', 'audit_log', 'momo_webhook_events', 'receipt_sequences'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists tenant_insert on public.%I', t);
      execute format('drop policy if exists tenant_update on public.%I', t);
      execute format('drop policy if exists tenant_delete on public.%I', t);
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;

  foreach t in array array['loans', 'withdrawal_requests', 'expenses', 'savings_accounts', 'personal_savings_accounts',
                           'savings_products', 'susu_groups', 'susu_group_members', 'group_meetings', 'beneficiaries',
                           'handovers', 'collector_assignments', 'exceptions', 'chart_of_accounts', 'branches',
                           'customers', 'reversals', 'group_distributions'] loop
    if to_regclass('public.' || t) is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'business_id' and data_type = 'uuid'
    ) then
      execute format('drop policy if exists tenant_insert on public.%I', t);
      execute format('drop policy if exists tenant_update on public.%I', t);
      execute format('drop policy if exists tenant_delete on public.%I', t);
      execute format('drop policy if exists st_manager_insert on public.%I', t);
      execute format('drop policy if exists st_manager_update on public.%I', t);
      execute format('create policy st_manager_insert on public.%I for insert to authenticated with check (public.st_tenant_match(business_id) and public.st_jwt_is_manager())', t);
      execute format('create policy st_manager_update on public.%I for update to authenticated using (public.st_tenant_match(business_id) and public.st_jwt_is_manager()) with check (public.st_tenant_match(business_id) and public.st_jwt_is_manager())', t);
      execute format('revoke delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Members: only the System Owner may delete, and only a member with no financial history.
drop policy if exists st_owner_delete on public.customers;
create policy st_owner_delete on public.customers
  for delete to authenticated
  using (public.st_tenant_match(business_id) and coalesce(public.st_jwt_claim('app_role'), '') = 'SystemOwner');
grant delete on public.customers to authenticated;

create or replace function public.st_guard_customer_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_trusted boolean := public.st_is_trusted_session();
  v_role text := coalesce(public.st_jwt_claim('app_role'), case when v_trusted then 'trusted' else '' end);
  v_code text;
  t text;
  v_has boolean;
  v_from text;
  v_to text;
begin
  select coalesce(b.legacy_code, b.code) into v_code from public.businesses b where b.id = coalesce(old.business_id, new.business_id);
  if tg_op = 'DELETE' then
    if not (v_trusted and coalesce(current_setting('smile_trust.allow_history_rewrite', true), '') = 'on') then
      foreach t in array array['collections', 'ledger_entries', 'loans', 'loan_repayments', 'withdrawal_requests',
                               'savings_accounts', 'personal_savings_accounts'] loop
        if to_regclass('public.' || t) is not null and exists (
          select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'customer_id'
        ) then
          execute format('select exists (select 1 from public.%I where customer_id = $1)', t) into v_has using old.id;
          if v_has then
            raise exception 'member has financial history and cannot be deleted; close the member instead' using errcode = '23514';
          end if;
        end if;
      end loop;
      if not v_trusted and v_role <> 'SystemOwner' then
        raise exception 'only the System Owner can delete a member record' using errcode = '42501';
      end if;
    end if;
    insert into public.st_member_lifecycle_events (business_code, customer_id, source, from_status, to_status, actor, actor_role)
    values (coalesce(v_code, ''), coalesce(old.client_id, old.id::text), 'relational',
            coalesce(old.member_status, case when old.active then 'Active' else 'Closed' end), 'DELETED',
            coalesce(public.st_jwt_app_user_id(), 'database'), v_role);
    return old;
  end if;
  v_from := coalesce(old.member_status, case when old.active then 'Active' else 'Closed' end);
  v_to := coalesce(new.member_status, case when new.active then 'Active' else 'Closed' end);
  if v_from is distinct from v_to or new.active is distinct from old.active then
    if not v_trusted and v_role not in ('SystemOwner', 'KBA', 'Admin', 'ManagingDirector') then
      raise exception 'not allowed to change member status' using errcode = '42501';
    end if;
    insert into public.st_member_lifecycle_events (business_code, customer_id, source, from_status, to_status, actor, actor_role)
    values (coalesce(v_code, ''), coalesce(new.client_id, new.id::text), 'relational', v_from, v_to,
            coalesce(public.st_jwt_app_user_id(), case when public.st_is_service_role() then 'service' else 'database' end), v_role);
  end if;
  return new;
end;
$$;

drop trigger if exists st_guard_customer_lifecycle on public.customers;
create trigger st_guard_customer_lifecycle
  before update or delete on public.customers
  for each row execute function public.st_guard_customer_lifecycle();

-- ---------------------------------------------------------------------------
-- 9) One-time re-save of existing snapshots: strips secrets, hashes staff-set portal PINs and
--    registers already-posted history (no business record is added, removed or changed).
-- ---------------------------------------------------------------------------
update public.smile_trust_cloud_snapshots set payload = payload;

-- ---------------------------------------------------------------------------
-- 10) Function privileges
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'st_jwt_iat()', 'st_app_role_from_relational(text)', 'st_relational_role_from_app(text)', 'st_is_trusted_session()',
    'st_jwt_is_manager()', 'st_jwt_is_owner()', 'st_caller_staff_ok()', 'st_guard_app_users()', 'st_app_users_session_cutoff()',
    'st_upsert_staff_account(text, jsonb)', 'st_reset_staff_mfa(text, text, text)', 'st_is_secret_key(text)',
    'st_strip_secret_keys(jsonb)', 'st_store_portal_pin(text, text, text, text)', 'st_scrub_snapshot_payload(text, jsonb)',
    'st_record_pesewas_from_amount(jsonb)', 'st_record_pesewas_field(jsonb)', 'st_snapshot_financial_rows(jsonb)',
    'st_adjustment_allows(jsonb, text, bigint, bigint)', 'st_snapshot_history_violation(text, jsonb, boolean)',
    'st_register_snapshot_history(text, jsonb, text, boolean)', 'st_member_status(jsonb)',
    'st_check_snapshot_members(text, jsonb, jsonb, text, boolean, text)', 'st_guard_cloud_snapshot()',
    'st_submit_collections(text, jsonb)', 'st_scope_staff_payload(jsonb)', 'st_assert_payload_amounts(jsonb)',
    'st_assert_customer_assignment(text, text)', 'st_guard_posted_rows()', 'st_guard_customer_lifecycle()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;

  -- Used inside RLS policies and RPC guards evaluated as the signed-in user.
  foreach f in array array[
    'st_jwt_iat()', 'st_app_role_from_relational(text)', 'st_jwt_is_manager()', 'st_jwt_is_owner()', 'st_caller_staff_ok()',
    'st_upsert_staff_account(text, jsonb)', 'st_reset_staff_mfa(text, text, text)', 'st_submit_collections(text, jsonb)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  -- Server-internal: triggers and snapshot plumbing.
  foreach f in array array[
    'st_guard_app_users()', 'st_app_users_session_cutoff()', 'st_store_portal_pin(text, text, text, text)',
    'st_scrub_snapshot_payload(text, jsonb)', 'st_snapshot_history_violation(text, jsonb, boolean)',
    'st_register_snapshot_history(text, jsonb, text, boolean)', 'st_check_snapshot_members(text, jsonb, jsonb, text, boolean, text)',
    'st_guard_cloud_snapshot()', 'st_guard_posted_rows()', 'st_guard_customer_lifecycle()'
  ] loop
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
