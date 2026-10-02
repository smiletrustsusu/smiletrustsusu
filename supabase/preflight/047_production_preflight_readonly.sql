-- READ-ONLY production preflight, run immediately before applying migration 047.
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Paste the whole file into the Supabase SQL Editor and run it. It returns one result set:
-- one row per check (section, check, status, detail), with the overall verdict in the first row:
--   READY_FOR_047     no check has status FAIL (review every WARN before applying 047)
--   PREFLIGHT_FAILED  at least one FAIL: do not apply 047
--
-- Statuses: PASS = as required, FAIL = blocks 047, WARN = needs a human decision, INFO = recorded
-- for the post-047 comparison.
--
-- Safety:
--   * SELECT only. The first statement makes the transaction read-only, so even a mistake could
--     not write. No INSERT/UPDATE/DELETE/DDL, no mutating RPCs.
--   * Never returns password hashes, TOTP secrets, activation codes or their hashes, Auth emails,
--     tokens or keys. Snapshot secrets are reported by key name and count only.
--   * If it stops with "relation ... does not exist", migration 046 is not applied: PREFLIGHT_FAILED.

set transaction read only;

with
biz as (
  select b.id, b.code
  from public.businesses b
  where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
),
staff as (
  select u.id, u.business_id, coalesce(u.client_id, u.id::text) as app_id, lower(u.username) as uname,
         u.role, u.active,
         case
           when coalesce(u.password_hash, '') = '' then 'none'
           when u.password_hash like 'pbkdf2:%' then 'pbkdf2'
           when u.password_hash like 'kba-%' then 'legacy kba'
           else 'unrecognised'
         end as pw_format
  from public.app_users u
  join biz b on b.id = u.business_id
),
links as (
  select l.app_user_id, l.auth_user_id
  from public.st_staff_auth_links l
  where l.business_code = 'SMILE-TRUST'
),
au as (
  select a.id, a.raw_app_meta_data as meta, a.banned_until
  from auth.users a
),
expected (ord, uname, label, exp_uuid, exp_role, exp_claim_role, activated) as (
  values
    (1, 'john', '04 JOHN', 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid, 'SystemOwner', 'SystemOwner', true),
    (2, 'ama', '13 AMA', '6e6667ac-72ce-4f30-9c8e-2fd838988590'::uuid, 'AssistantManager', 'Admin', false),
    (3, 'kwame', '14 KWAME', '3d156d98-3b4a-4024-8a46-1450df386672'::uuid, 'Collector', 'Collector', false)
),
people as (
  select e.*,
         (select count(*) from staff x where x.uname = e.uname)::int as n_name,
         (select count(*) from public.app_users x where x.id = e.exp_uuid)::int as n_uuid,
         s.id, s.app_id, s.role, s.active, s.pw_format,
         (select count(*) from links l where l.app_user_id = s.app_id)::int as n_links,
         a.id as auth_id, a.meta, a.banned_until,
         (select count(*) from links l where l.auth_user_id = a.id)::int as auth_link_uses,
         (select count(*) from public.user_mfa_secrets m
           where m.business_id = s.business_id and m.user_client_id = s.app_id)::int as mfa_rows,
         coalesce((select bool_or(m.enabled) from public.user_mfa_secrets m
           where m.business_id = s.business_id and m.user_client_id = s.app_id), false) as mfa_enabled,
         (select count(*) from public.st_staff_activation_codes c
           where c.app_user_uuid = s.id and c.used_at is null and c.expires_at > now())::int as codes_open
  from expected e
  left join staff s on s.uname = e.uname and (select count(*) from staff x where x.uname = e.uname) = 1
  left join lateral (
    select l.auth_user_id from links l where l.app_user_id = s.app_id order by l.auth_user_id limit 1
  ) l1 on true
  left join au a on a.id = l1.auth_user_id
),
snap as (
  select s.business_id, s.payload from public.smile_trust_cloud_snapshots s
),
live as (
  select payload from snap where business_id = 'SMILE-TRUST' limit 1
),
-- Posted records exactly as 047 (st_snapshot_financial_rows) will register them.
fin as (
  select k.kind, e ->> 'id' as record_id, coalesce(e ->> 'customerId', '') as customer_id,
         round(public.st_num(e ->> 'amount') * 100)::bigint as amt,
         case when coalesce(e ->> 'amountPesewas', '') = '' then null
              else round(public.st_num(e ->> 'amountPesewas'))::bigint end as amt_field,
         public.st_truthy(e ->> 'reversed') as reversed
  from live
  cross join unnest(array['collections', 'transactions', 'ledgerEntries']) as k(kind)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(live.payload -> k.kind) = 'array' then live.payload -> k.kind else '[]'::jsonb end
  ) as e
  where jsonb_typeof(e) = 'object' and coalesce(e ->> 'id', '') <> ''
),
fin_unnamed as (
  select count(*)::int as n
  from live
  cross join unnest(array['collections', 'transactions', 'ledgerEntries']) as k(kind)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(live.payload -> k.kind) = 'array' then live.payload -> k.kind else '[]'::jsonb end
  ) as e
  where jsonb_typeof(e) <> 'object' or coalesce(e ->> 'id', '') = ''
),
snap_customers as (
  select c ->> 'id' as id,
         coalesce(nullif(c ->> 'memberStatus', ''),
                  case when lower(coalesce(c ->> 'active', 'true')) = 'false' then 'Closed' else 'Active' end) as status
  from live
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(live.payload -> 'customers') = 'array' then live.payload -> 'customers' else '[]'::jsonb end
  ) as c
  where jsonb_typeof(c) = 'object' and coalesce(c ->> 'id', '') <> ''
),
snap_users as (
  select lower(coalesce(u ->> 'username', '')) as uname
  from live
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(live.payload -> 'users') = 'array' then live.payload -> 'users' else '[]'::jsonb end
  ) as u
  where jsonb_typeof(u) = 'object'
),
fin_orphans as (
  select distinct f.kind, f.record_id, f.customer_id
  from fin f
  where f.customer_id <> '' and not exists (select 1 from snap_customers c where c.id = f.customer_id)
),
fin_conflicts as (
  select f.kind, f.record_id
  from fin f
  group by f.kind, f.record_id
  having count(distinct (f.customer_id, f.amt, f.amt_field, f.reversed)) > 1
),
fin_identical_dupes as (
  select f.kind, f.record_id
  from fin f
  group by f.kind, f.record_id
  having count(*) > 1 and count(distinct (f.customer_id, f.amt, f.amt_field, f.reversed)) = 1
),
-- Every object key at any depth of every stored snapshot (values are never read).
snap_keys as (
  select k.key
  from snap s
  cross join lateral jsonb_path_query(s.payload, 'strict $.**') as n(v)
  cross join lateral jsonb_object_keys(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end) as k(key)
),
-- Same key list and suffix rule as public.st_is_secret_key in migration 047.
secret_hits as (
  select key, count(*)::int as n
  from snap_keys
  where lower(key) = any (array[
      'password', 'passwordhash', 'password_hash', 'passwordhint', 'loginpasswordhint', 'pinhash', 'pin_hash',
      'mfasecret', 'mfa_secret', 'mfapendingsecret', 'totpsecret', 'totp_secret', 'otpsecret', 'secret',
      'activationcode', 'activation_code', 'activationcodes',
      'accesstoken', 'access_token', 'refreshtoken', 'refresh_token', 'sessiontoken', 'session_token', 'idtoken', 'id_token',
      'synctoken', 'syncaccesskey', 'cloudkey', 'accesskey', 'access_key', 'momowebhooksecret', 'webhooksecret',
      'recoverycode', 'recoverycodes', 'recovery_codes', 'backupcodes', 'backup_codes',
      'servicerolekey', 'service_role_key', 'servicekey', 'privatekey', 'private_key', 'portalpin', 'portal_pin'
    ])
    or lower(key) ~ '(secret|token|passwordhash|password_hash)$'
  group by key
),
prereq_tables (name) as (
  values ('public.st_staff_auth_links'), ('public.smile_trust_cloud_snapshots'), ('public.st_staff_activation_codes'),
         ('public.st_staff_login_attempts'), ('public.st_portal_pins'), ('public.user_mfa_secrets'), ('auth.users')
),
prereq_functions (schema_name, name) as (
  values ('public', 'st_tenant_match'), ('public', 'st_business_authorized'), ('public', 'st_is_service_role'),
         ('public', 'st_jwt_claim'), ('public', 'st_jwt_business_code'), ('public', 'st_jwt_app_user_id'),
         ('public', 'st_num'), ('public', 'st_truthy'), ('public', 'st_issue_staff_activation'),
         ('public', 'fetch_business_snapshot'), ('auth', 'uid'), ('auth', 'jwt')
),
markers_047 (name, present) as (
  select t.name, to_regclass('public.' || t.name) is not null
  from unnest(array['st_staff_security_events', 'st_member_lifecycle_events', 'st_snapshot_financial_ledger']) as t(name)
  union all
  select 'function ' || f.name, exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = f.name)
  from unnest(array['st_caller_staff_ok', 'st_submit_collections', 'st_upsert_staff_account', 'st_reset_staff_mfa',
                    'st_guard_app_users', 'st_guard_cloud_snapshot', 'st_guard_posted_rows',
                    'st_guard_customer_lifecycle', 'st_is_secret_key']) as f(name)
  union all
  select 'trigger ' || g.name, exists (select 1 from pg_trigger tr where tr.tgname = g.name and not tr.tgisinternal)
  from unnest(array['st_guard_app_users', 'st_guard_cloud_snapshot', 'st_guard_customer_lifecycle',
                    'st_guard_posted_rows', 'st_app_users_session_cutoff']) as g(name)
  union all
  select 'column ' || c.tbl || '.' || c.col, exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public' and ic.table_name = c.tbl and ic.column_name = c.col)
  from (values ('st_staff_auth_links', 'sessions_not_before'), ('user_mfa_secrets', 'last_used_step')) as c(tbl, col)
),
relational_tables (ord, name) as (
  values (1, 'customers'), (2, 'collections'), (3, 'ledger_entries'), (4, 'journal_entries'), (5, 'journal_lines'),
         (6, 'loans'), (7, 'loan_repayments'), (8, 'loan_disbursements'), (9, 'reversals'), (10, 'group_distributions'),
         (11, 'withdrawal_requests'), (12, 'savings_accounts'), (13, 'personal_savings_accounts'), (14, 'expenses'),
         (15, 'audit_log'), (16, 'momo_webhook_events'), (17, 'receipt_sequences'), (18, 'st_portal_pins'),
         (19, 'st_portal_requests'), (20, 'user_mfa_secrets'), (21, 'st_staff_activation_codes')
),
checks (section, ord, check_name, status, detail) as (
  -- 1. Identity
  select '01 identity', 1, 'database', 'INFO', current_database() || ' / ' || split_part(version(), ' on ', 1)
  union all
  select '01 identity', 2, 'project ref', 'INFO',
         'SQL cannot read the project ref: confirm the dashboard URL shows qouokiqoepjpoksupskb before applying 047'
  union all
  select '01 identity', 3, 'SMILE-TRUST business row exactly once',
         case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end,
         (select count(*) from biz)::text || ' matching business row(s)'
  union all
  select '01 identity', 4, 'no reference to the out-of-scope project in stored snapshots',
         case when exists (select 1 from snap where payload::text like '%angoswtgcklnorhlosnf%') then 'FAIL' else 'PASS' end,
         case when exists (select 1 from snap where payload::text like '%angoswtgcklnorhlosnf%')
              then 'a snapshot mentions the out-of-scope project: stop and investigate' else 'none found' end

  -- 2. Migration 046 prerequisites
  union all
  select '02 046 prerequisites', 1, '046 tables present',
         case when bool_and(to_regclass(t.name) is not null) then 'PASS' else 'FAIL' end,
         coalesce('missing: ' || string_agg(t.name, ', ') filter (where to_regclass(t.name) is null),
                  count(*)::text || '/' || count(*)::text || ' present')
  from prereq_tables t
  union all
  select '02 046 prerequisites', 2, '046 functions present',
         case when bool_and(f.present) then 'PASS' else 'FAIL' end,
         coalesce('missing: ' || string_agg(f.schema_name || '.' || f.name, ', ') filter (where not f.present),
                  count(*)::text || '/' || count(*)::text || ' present')
  from (
    select pf.schema_name, pf.name, exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = pf.schema_name and p.proname = pf.name) as present
    from prereq_functions pf
  ) f
  union all
  select '02 046 prerequisites', 3, 'pgcrypto available (047 hashes portal PINs)',
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('extensions', 'public') and p.proname = 'gen_salt') then 'PASS' else 'FAIL' end,
         coalesce((select 'pgcrypto ' || e.extversion || ' in schema ' || n.nspname
                   from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'),
                  'pgcrypto extension not installed')
  union all
  select '02 046 prerequisites', 4, 'snapshot table has row-level security and the 046 policies',
         case when (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.smile_trust_cloud_snapshots'))
                   and (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'smile_trust_cloud_snapshots'
                          and p.policyname in ('st_snapshots_select', 'st_snapshots_insert', 'st_snapshots_update')) = 3
              then 'PASS' else 'FAIL' end,
         'policies: ' || coalesce((select string_agg(p.policyname, ', ' order by p.policyname) from pg_policies p
                                   where p.schemaname = 'public' and p.tablename = 'smile_trust_cloud_snapshots'), 'none')

  -- 3. Migration 047 not applied yet
  union all
  select '03 047 not yet applied', 1, '047 objects absent',
         case when count(*) filter (where m.present) = 0 then 'PASS' else 'FAIL' end,
         case
           when count(*) filter (where m.present) = 0 then 'none of the ' || count(*)::text || ' objects created by 047 exist'
           when count(*) filter (where m.present) = count(*) then 'all ' || count(*)::text
                || ' objects already exist: 047 is applied (re-applying is idempotent but needs separate approval)'
           else '047 is PARTIALLY applied, investigate before anything else. present: '
                || string_agg(m.name, ', ') filter (where m.present)
         end
  from markers_047 m

  -- 4-11, 13, 14. JOHN, AMA, KWAME
  union all
  select p.label, v.ord, v.check_name, v.status, v.detail
  from people p
  cross join lateral (values
    (1, 'exists exactly once', case when p.n_name = 1 then 'PASS' else 'FAIL' end,
        p.n_name::text || ' row(s) with this username in SMILE-TRUST'),
    (2, 'UUID unchanged', case when p.n_uuid = 1 and p.id = p.exp_uuid then 'PASS' else 'FAIL' end,
        case when p.id = p.exp_uuid then p.exp_uuid::text
             else 'expected ' || p.exp_uuid::text || ', found ' || coalesce(p.id::text, 'no single row') end),
    (3, 'role = ' || p.exp_role, case when p.role = p.exp_role then 'PASS' else 'FAIL' end,
        coalesce(p.role, 'no single row')),
    (4, 'active = true',
        case when p.active is true then 'PASS' when p.activated then 'FAIL' else 'WARN' end,
        coalesce(p.active::text, 'no single row')),
    (5, case when p.activated then 'password format = pbkdf2' else 'not activated (no password yet)' end,
        case when p.activated then case when p.pw_format = 'pbkdf2' then 'PASS' else 'FAIL' end
             else case when p.pw_format = 'none' then 'PASS' else 'WARN' end end,
        'password format: ' || coalesce(p.pw_format, 'no single row')
          || case when not p.activated and p.pw_format <> 'none' then ' (recorded state says NOT activated: confirm)' else '' end),
    (6, case when p.activated then 'Auth link exactly one' else 'no Auth link yet' end,
        case when p.activated then case when p.n_links = 1 then 'PASS' else 'FAIL' end
             else case when p.n_links = 0 then 'PASS' else 'WARN' end end,
        p.n_links::text || ' link(s) in st_staff_auth_links'),
    (7, 'open activation codes', case when p.codes_open = 0 then 'PASS' when p.activated then 'WARN' else 'INFO' end,
        p.codes_open::text || ' unused, unexpired code(s)'),
    (8, 'server MFA record',
        case when p.activated and p.mfa_enabled then 'WARN' else 'INFO' end,
        case
          when p.mfa_enabled and p.activated then 'a confirmed server authenticator already exists: after the new staff-login he must use it; if he does not have it, plan an owner MFA reset in the SQL editor first'
          when p.mfa_enabled then 'a confirmed server authenticator exists'
          when p.mfa_rows > 0 then 'an unconfirmed (pending) authenticator row exists'
          else 'none: enrolls in the app after the new staff-login is deployed'
        end)
  ) as v(ord, check_name, status, detail)
  union all
  select p.label, v.ord, v.check_name, v.status, v.detail
  from people p
  cross join lateral (values
    (9, 'Auth user exists', case when p.auth_id is not null then 'PASS' else 'FAIL' end,
        case when p.auth_id is not null then 'linked Auth user found' else 'no linked Auth user' end),
    (10, 'Auth user not banned',
        case when p.auth_id is not null and (p.banned_until is null or p.banned_until < now()) then 'PASS' else 'FAIL' end,
        case when p.auth_id is null then 'no linked Auth user'
             when p.banned_until is null or p.banned_until < now() then 'not banned'
             else 'BANNED until ' || p.banned_until::text end),
    (11, 'Auth claim role = ' || p.exp_claim_role,
        case when p.meta ->> 'app_role' = p.exp_claim_role then 'PASS' else 'FAIL' end,
        coalesce(p.meta ->> 'app_role', 'missing')),
    (12, 'Auth claim business = SMILE-TRUST',
        case when p.meta ->> 'business_code' = 'SMILE-TRUST' then 'PASS' else 'FAIL' end,
        coalesce(p.meta ->> 'business_code', 'missing')),
    (13, 'Auth claim app user = this staff row',
        case when p.meta ->> 'app_user_id' = p.app_id then 'PASS' else 'FAIL' end,
        case when p.meta ->> 'app_user_id' = p.app_id then 'matches' else 'does not match' end),
    (14, 'Auth identity linked to this staff row only',
        case when p.auth_link_uses = 1 then 'PASS' else 'FAIL' end,
        p.auth_link_uses::text || ' link(s) use this Auth identity')
  ) as v(ord, check_name, status, detail)
  where p.activated

  -- 12. Auth counts
  union all
  select '12 auth counts', 1, 'auth.users total', 'INFO', (select count(*) from au)::text
  union all
  select '12 auth counts', 2, 'SMILE-TRUST staff Auth links', 'INFO', (select count(*) from links)::text
  union all
  select '12 auth counts', 3, 'links whose Auth user is missing',
         case when n = 0 then 'PASS' else 'WARN' end, n::text
  from (select count(*)::int as n from links l where not exists (select 1 from au a where a.id = l.auth_user_id)) x
  union all
  select '12 auth counts', 4, 'links whose staff row is missing',
         case when n = 0 then 'PASS' else 'WARN' end, n::text
  from (select count(*)::int as n from links l where not exists (select 1 from staff s where s.app_id = l.app_user_id)) x
  union all
  select '12 auth counts', 5, 'linked Auth users currently banned', 'INFO', count(*)::text
  from links l join au a on a.id = l.auth_user_id where a.banned_until > now()
  union all
  select '12 auth counts', 6, 'Auth users claiming SMILE-TRUST without a staff link', case when count(*) = 0 then 'PASS' else 'WARN' end, count(*)::text
  from au a where a.meta ->> 'business_code' = 'SMILE-TRUST' and not exists (select 1 from links l where l.auth_user_id = a.id)
  union all
  select '12 auth counts', 7, 'staff Auth links for other businesses', 'INFO', count(*)::text
  from public.st_staff_auth_links l where l.business_code <> 'SMILE-TRUST'

  -- 15. Snapshot
  union all
  select '15 snapshot', 1, 'stored snapshot rows', 'INFO',
         count(*)::text || coalesce(' (' || string_agg(business_id, ', ' order by business_id) || ')', '')
  from snap
  union all
  select '15 snapshot', 2, 'SMILE-TRUST snapshot present',
         case when (select count(*) from live) = 1 then 'PASS' else 'WARN' end,
         case when (select count(*) from live) = 1 then 'present'
              else 'missing: collectors cannot submit until a manager device syncs' end
  union all
  select '15 snapshot', 3, 'SMILE-TRUST payload shape',
         case when (select jsonb_typeof(payload) from live) = 'object' or (select count(*) from live) = 0 then 'PASS' else 'WARN' end,
         coalesce((select jsonb_typeof(payload) || ', ' || pg_size_pretty(pg_column_size(payload)::bigint) from live), 'no payload')
  union all
  select '15 snapshot', 4, 'SMILE-TRUST arrays (record counts)', 'INFO',
         coalesce((select string_agg(e.key || '=' || jsonb_array_length(e.value), ', ' order by e.key)
                   from live cross join lateral jsonb_each(case when jsonb_typeof(live.payload) = 'object' then live.payload else '{}'::jsonb end) e
                   where jsonb_typeof(e.value) = 'array'), 'none')
  union all
  select '15 snapshot', 5, 'posted records 047 will register as history', 'INFO',
         count(distinct (f.kind, f.record_id))::text || ' (' || coalesce((
           select string_agg(x.kind || '=' || x.n, ', ' order by x.kind)
           from (select kind, count(distinct record_id)::int as n from fin group by kind) x), 'none') || ')'
  from fin f
  union all
  select '15 snapshot', 6, 'financial entries without an id (047 cannot protect them)',
         case when n = 0 then 'PASS' else 'WARN' end, n::text
  from fin_unnamed

  -- 16. Current policies, grants and functions that 047 replaces or hardens
  union all
  select '16 current security objects', 1, 'client write policies on ledger tables (047 drops them)', 'INFO',
         count(*)::text || coalesce(' (' || string_agg(p.tablename || '.' || p.policyname, ', ' order by p.tablename, p.policyname) || ')', '')
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('collections', 'ledger_entries', 'journal_entries', 'journal_lines', 'loan_repayments',
                        'loan_disbursements', 'audit_log', 'momo_webhook_events', 'receipt_sequences')
    and p.policyname in ('tenant_insert', 'tenant_update', 'tenant_delete')
  union all
  select '16 current security objects', 2, 'signed-in clients may write ledger tables directly (047 revokes)', 'INFO',
         coalesce(string_agg(t.name, ', ' order by t.name), 'none')
  from unnest(array['collections', 'ledger_entries', 'journal_entries', 'journal_lines', 'loan_repayments',
                    'loan_disbursements', 'audit_log', 'momo_webhook_events', 'receipt_sequences']) as t(name)
  where to_regclass('public.' || t.name) is not null
    and (has_table_privilege('authenticated', to_regclass('public.' || t.name), 'INSERT')
         or has_table_privilege('authenticated', to_regclass('public.' || t.name), 'UPDATE')
         or has_table_privilege('authenticated', to_regclass('public.' || t.name), 'DELETE'))
  union all
  select '16 current security objects', 3, 'device MFA upload RPC open to clients (047 revokes)', 'INFO',
         case when to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)') is null then 'function not present'
              when has_function_privilege('authenticated', to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)'), 'EXECUTE')
              then 'yes: signed-in clients can call upsert_user_mfa' else 'no' end
  union all
  select '16 current security objects', 4, 'helpers 047 redefines (046 versions present)',
         case when count(distinct p.proname) = 2 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' order by p.proname), 'none')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('st_business_authorized', 'st_tenant_match')
  union all
  select '16 current security objects', 5, 'existing triggers on tables 047 guards', 'INFO',
         coalesce(string_agg(c.relname || '.' || tr.tgname, ', ' order by c.relname, tr.tgname), 'none')
  from pg_trigger tr
  join pg_class c on c.oid = tr.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not tr.tgisinternal and n.nspname = 'public'
    and c.relname in ('app_users', 'customers', 'smile_trust_cloud_snapshots', 'collections', 'ledger_entries',
                      'journal_entries', 'journal_lines', 'loan_repayments', 'loan_disbursements', 'reversals',
                      'group_distributions', 'audit_log')
  union all
  select '16 current security objects', 6, 'public tables without row-level security',
         case when count(*) = 0 then 'PASS' else 'WARN' end,
         count(*)::text || coalesce(' (' || string_agg(c.relname, ', ' order by c.relname) || ')', '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  -- 17 and 19. Relational financial and related table counts (all businesses)
  union all
  select '17 relational counts', t.ord, t.name, 'INFO',
         case when to_regclass('public.' || t.name) is null then 'table not present'
              else coalesce(nullif((xpath('/table/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.name), false, false, '')))[1]::text, ''), 'unreadable') || ' rows'
         end
  from relational_tables t

  -- 18. Members
  union all
  select '18 members', 1, 'relational members (SMILE-TRUST) by status', 'INFO',
         coalesce(sum(x.n), 0)::text || coalesce(' (' || string_agg(x.member_status || '=' || x.n, ', ' order by x.member_status) || ')', '')
  from (
    select coalesce(c.member_status, 'unset') as member_status, count(*)::int as n
    from public.customers c join biz b on b.id = c.business_id group by 1
  ) x
  union all
  select '18 members', 2, 'snapshot members by status', 'INFO',
         coalesce(sum(x.n), 0)::text || coalesce(' (' || string_agg(x.status || '=' || x.n, ', ' order by x.status) || ')', '')
  from (select status, count(*)::int as n from snap_customers group by status) x

  -- 20. Staff counts
  union all
  select '20 staff counts', 1, 'staff rows (SMILE-TRUST) by role', 'INFO',
         coalesce(sum(x.n), 0)::text || coalesce(' (' || string_agg(x.role || case when x.active then '' else ' inactive' end || '=' || x.n, ', ' order by x.role, x.active desc) || ')', '')
  from (select role, active, count(*)::int as n from staff group by role, active) x
  union all
  select '20 staff counts', 2, 'active Developer accounts (047 refuses their sessions)', case when count(*) = 0 then 'PASS' else 'WARN' end, count(*)::text
  from staff where role = 'Developer' and active
  union all
  select '20 staff counts', 3, 'staff in the SMILE-TRUST snapshot', 'INFO', count(*)::text
  from snap_users

  -- 21. Duplicate staff identities
  union all
  select '21 duplicates', 1, 'duplicate staff usernames', case when count(*) = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || ' username(s) used by more than one staff row'
  from (select uname from staff group by uname having count(*) > 1) x
  union all
  select '21 duplicates', 2, 'duplicate staff app ids', case when count(*) = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || ' app id(s) used by more than one staff row'
  from (select app_id from staff group by app_id having count(*) > 1) x
  union all
  select '21 duplicates', 3, 'staff rows with more than one Auth link', case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (select app_user_id from links group by app_user_id having count(*) > 1) x
  union all
  select '21 duplicates', 4, 'Auth identities linked to more than one staff row', case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (select auth_user_id from public.st_staff_auth_links group by auth_user_id having count(*) > 1) x
  union all
  select '21 duplicates', 5, 'duplicate usernames in the snapshot', case when count(*) = 0 then 'PASS' else 'WARN' end, count(*)::text
  from (select uname from snap_users where uname <> '' group by uname having count(*) > 1) x
  union all
  select '21 duplicates', 6, 'duplicate member ids in the snapshot', case when count(*) = 0 then 'PASS' else 'WARN' end, count(*)::text
  from (select id from snap_customers group by id having count(*) > 1) x

  -- 22. Orphaned financial relationships
  union all
  select '22 orphans', 1, 'snapshot history pointing at a member missing from the snapshot',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) = 0 then 'none'
              else count(*)::text || ' record(s); after 047 every manager sync would be refused until fixed. first: '
                   || (select string_agg(o.kind || ':' || o.record_id || ' -> member ' || o.customer_id, '; ')
                       from (select * from fin_orphans order by kind, record_id limit 5) o) end
  from fin_orphans
  union all
  select '22 orphans', 2, 'snapshot records with one id but conflicting values',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) = 0 then 'none'
              else count(*)::text || ' id(s); after 047 every manager sync would be refused until fixed. first: '
                   || (select string_agg(c.kind || ':' || c.record_id, '; ')
                       from (select * from fin_conflicts order by kind, record_id limit 5) c) end
  from fin_conflicts
  union all
  select '22 orphans', 3, 'snapshot records repeated with identical values', 'INFO', count(*)::text
  from fin_identical_dupes
  union all
  select '22 orphans', 4, 'relational collections without their member or collector',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from public.collections col
  where not exists (select 1 from public.customers c where c.id = col.customer_id)
     or not exists (select 1 from public.app_users u where u.id = col.collector_id)
  union all
  select '22 orphans', 5, 'relational ledger entries pointing at a missing member',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from public.ledger_entries le
  where le.customer_id is not null and not exists (select 1 from public.customers c where c.id = le.customer_id)
  union all
  select '22 orphans', 6, 'relational loans or repayments without their member or loan',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (
    select l.id from public.loans l where not exists (select 1 from public.customers c where c.id = l.customer_id)
    union all
    select r.id from public.loan_repayments r
    where not exists (select 1 from public.loans l where l.id = r.loan_id)
       or not exists (select 1 from public.customers c where c.id = r.customer_id)
  ) x

  -- 23. Sensitive keys in stored snapshots (names and counts only)
  union all
  select '23 snapshot secrets', 1, 'authentication keys stored in snapshots (047 strips them)',
         case when count(*) = 0 then 'PASS' else 'WARN' end,
         case when count(*) = 0 then 'none'
              else sum(n)::text || ' occurrence(s): ' || string_agg(key || ' x' || n, ', ' order by key) end
  from secret_hits
  union all
  select '23 snapshot secrets', 2, 'plaintext member portal PINs (047 moves them to hashed storage)', 'INFO',
         coalesce(sum(n), 0)::text
  from secret_hits where lower(key) in ('portalpin', 'portal_pin')

  -- 24. Members whose history makes them undeletable after 047
  union all
  select '24 members with history', 1, 'snapshot members with posted history', 'INFO',
         count(*)::text || ' member(s); ' || count(*) filter (where c.status <> 'Active')::text || ' of them not Active'
  from snap_customers c
  where exists (select 1 from fin f where f.customer_id = c.id)
  union all
  select '24 members with history', 2, 'relational members (SMILE-TRUST) with collections, ledger entries or loans', 'INFO',
         count(*)::text || ' member(s); ' || count(*) filter (where coalesce(c.member_status, 'Active') <> 'Active' or not c.active)::text
         || ' of them not Active'
  from public.customers c
  join biz b on b.id = c.business_id
  where exists (select 1 from public.collections x where x.customer_id = c.id)
     or exists (select 1 from public.ledger_entries x where x.customer_id = c.id)
     or exists (select 1 from public.loans x where x.customer_id = c.id)
)
select '00 VERDICT' as section, 0 as ord, 'overall' as check_name,
       case when exists (select 1 from checks where status = 'FAIL') then 'PREFLIGHT_FAILED' else 'READY_FOR_047' end as status,
       (select count(*) from checks where status = 'FAIL')::text || ' FAIL, '
       || (select count(*) from checks where status = 'WARN')::text || ' WARN, '
       || (select count(*) from checks where status = 'PASS')::text || ' PASS'
       || coalesce('. failed: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord)
                                    from checks where status = 'FAIL'), '') as detail
union all
select section, ord, check_name, status, detail from checks
order by section, ord;
