-- READ-ONLY verification after migration 047 was applied.
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Paste the whole file into the Supabase SQL Editor and run it. It returns one result set:
-- one row per check (section, check, status, detail), with the overall verdict in the first row:
--   POST_047_VERIFIED  no check has status FAIL (review every WARN)
--   POST_047_FAILED    at least one FAIL: stop, do not deploy staff-login, investigate
--
-- Statuses: PASS = as designed, FAIL = 047 incomplete/unsafe or data lost, WARN = changed since
-- the pre-047 baseline or needs a human decision, INFO = recorded only.
--
-- Safety:
--   * SELECT only. The first statement makes the transaction read-only. No INSERT/UPDATE/DELETE/DDL.
--     The only functions called are pure checks from 047 (st_is_secret_key, st_strip_secret_keys,
--     st_snapshot_history_violation); none of them writes. Objects created by 047 are read through
--     guarded SELECTs, so a partially applied 047 is reported instead of stopping the query.
--   * Never returns password hashes, passwords, activation codes or their hashes, MFA/TOTP secrets,
--     Auth emails, tokens or keys. Snapshot secrets are reported by key name and count only.

set transaction read only;

with
-- Pre-047 production baseline (047_production_preflight_readonly.sql, 2026-10-02).
baseline_counts (name, expected) as (
  -- BASELINE START
  values
    ('customers', 1), ('collections', 0), ('ledger_entries', 0), ('journal_entries', 0), ('journal_lines', 0),
    ('loans', 0), ('loan_repayments', 0), ('loan_disbursements', 0), ('reversals', 0), ('group_distributions', 0),
    ('withdrawal_requests', 0), ('savings_accounts', 0), ('personal_savings_accounts', 0), ('expenses', 0),
    ('audit_log', 2), ('momo_webhook_events', 0), ('receipt_sequences', 1), ('st_portal_pins', 0),
    ('st_portal_requests', 0), ('user_mfa_secrets', 0), ('st_staff_activation_codes', 4)
  -- BASELINE END
),
baseline_staff (role, expected) as (
  values ('SystemOwner', 1), ('AssistantManager', 1), ('Collector', 1)
),
baseline_members (status, expected) as (
  values ('Active', 1)
),
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
  select l.app_user_id, l.auth_user_id, to_jsonb(l) ->> 'sessions_not_before' as not_before
  from public.st_staff_auth_links l
  where l.business_code = 'SMILE-TRUST'
),
au as (
  select a.id, a.raw_app_meta_data as meta, a.banned_until
  from auth.users a
),
expected (ord, uname, label, exp_uuid, exp_role, exp_claim_role, activated) as (
  values
    (1, 'john', '03 JOHN', 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid, 'SystemOwner', 'SystemOwner', true),
    (2, 'ama', '11 AMA', '6e6667ac-72ce-4f30-9c8e-2fd838988590'::uuid, 'AssistantManager', 'Admin', false),
    (3, 'kwame', '12 KWAME', '3d156d98-3b4a-4024-8a46-1450df386672'::uuid, 'Collector', 'Collector', false)
),
people as (
  select e.*,
         (select count(*) from staff x where x.uname = e.uname)::int as n_name,
         (select count(*) from public.app_users x where x.id = e.exp_uuid)::int as n_uuid,
         s.id, s.app_id, s.role, s.active, s.pw_format,
         (select count(*) from links l where l.app_user_id = s.app_id)::int as n_links,
         l1.not_before,
         a.id as auth_id, a.meta, a.banned_until,
         (select count(*) from links l where l.auth_user_id = a.id)::int as auth_link_uses,
         (select count(*) from public.user_mfa_secrets m
           where m.business_id = s.business_id and m.user_client_id = s.app_id)::int as mfa_rows,
         (select count(*) from public.st_staff_activation_codes c
           where c.app_user_uuid = s.id and c.used_at is null and c.expires_at > now())::int as codes_open
  from expected e
  left join staff s on s.uname = e.uname and (select count(*) from staff x where x.uname = e.uname) = 1
  left join lateral (
    select l.auth_user_id, l.not_before from links l where l.app_user_id = s.app_id order by l.auth_user_id limit 1
  ) l1 on true
  left join au a on a.id = l1.auth_user_id
),
-- Every object 047 creates; function signatures exactly as in 047's privilege section.
fn047 (sig, access) as (
  values
    ('st_jwt_iat()', 'authenticated'), ('st_app_role_from_relational(text)', 'authenticated'),
    ('st_relational_role_from_app(text)', 'neither'), ('st_is_trusted_session()', 'neither'),
    ('st_jwt_is_manager()', 'authenticated'), ('st_jwt_is_owner()', 'authenticated'),
    ('st_caller_staff_ok()', 'authenticated'), ('st_guard_app_users()', 'internal'),
    ('st_app_users_session_cutoff()', 'internal'), ('st_upsert_staff_account(text, jsonb)', 'authenticated'),
    ('st_reset_staff_mfa(text, text, text)', 'authenticated'), ('st_is_secret_key(text)', 'neither'),
    ('st_strip_secret_keys(jsonb)', 'neither'), ('st_store_portal_pin(text, text, text, text)', 'internal'),
    ('st_scrub_snapshot_payload(text, jsonb)', 'internal'), ('st_record_pesewas_from_amount(jsonb)', 'neither'),
    ('st_record_pesewas_field(jsonb)', 'neither'), ('st_snapshot_financial_rows(jsonb)', 'neither'),
    ('st_adjustment_allows(jsonb, text, bigint, bigint)', 'neither'),
    ('st_snapshot_history_violation(text, jsonb, boolean)', 'internal'),
    ('st_register_snapshot_history(text, jsonb, text, boolean)', 'internal'), ('st_member_status(jsonb)', 'neither'),
    ('st_check_snapshot_members(text, jsonb, jsonb, text, boolean, text)', 'internal'),
    ('st_guard_cloud_snapshot()', 'internal'), ('st_submit_collections(text, jsonb)', 'authenticated'),
    ('st_scope_staff_payload(jsonb)', 'neither'), ('st_assert_payload_amounts(jsonb)', 'neither'),
    ('st_assert_customer_assignment(text, text)', 'neither'), ('st_guard_posted_rows()', 'internal'),
    ('st_guard_customer_lifecycle()', 'internal')
),
fn_state as (
  select f.sig, f.access, to_regprocedure('public.' || f.sig) as oid
  from fn047 f
),
posted_tables (name) as (
  values ('collections'), ('ledger_entries'), ('journal_entries'), ('journal_lines'), ('loan_repayments'),
         ('loan_disbursements'), ('reversals'), ('group_distributions'), ('audit_log')
),
ledger_tables (name) as (
  values ('collections'), ('ledger_entries'), ('journal_entries'), ('journal_lines'), ('loan_repayments'),
         ('loan_disbursements'), ('audit_log'), ('momo_webhook_events'), ('receipt_sequences')
),
workflow_tables (name) as (
  select t.name
  from unnest(array['loans', 'withdrawal_requests', 'expenses', 'savings_accounts', 'personal_savings_accounts',
                    'savings_products', 'susu_groups', 'susu_group_members', 'group_meetings', 'beneficiaries',
                    'handovers', 'collector_assignments', 'exceptions', 'chart_of_accounts', 'branches',
                    'customers', 'reversals', 'group_distributions']) as t(name)
  where exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t.name and c.column_name = 'business_id' and c.data_type = 'uuid')
),
trg (name, tbl, type_mask) as (
  -- type_mask: pg_trigger.tgtype bits that must be set (1 row, 2 before, 4 insert, 8 delete, 16 update)
  select * from (values
    ('st_guard_app_users', 'app_users', 31),
    ('st_app_users_session_cutoff', 'app_users', 17),
    ('st_guard_cloud_snapshot', 'smile_trust_cloud_snapshots', 23),
    ('st_guard_customer_lifecycle', 'customers', 27)
  ) v(name, tbl, type_mask)
  union all
  select 'st_guard_posted_rows', p.name, 27 from posted_tables p where to_regclass('public.' || p.name) is not null
),
trg_state as (
  select t.name, t.tbl, t.type_mask, tr.tgenabled, tr.tgtype
  from trg t
  left join pg_trigger tr
    on tr.tgname = t.name and tr.tgrelid = to_regclass('public.' || t.tbl) and not tr.tgisinternal
),
objects047 (kind, name, present) as (
  select 'table', t.name, to_regclass('public.' || t.name) is not null
  from unnest(array['st_staff_security_events', 'st_member_lifecycle_events', 'st_snapshot_financial_ledger']) as t(name)
  union all
  select 'index', i.name, to_regclass('public.' || i.name) is not null
  from unnest(array['st_staff_security_events_user', 'st_member_lifecycle_events_customer',
                    'st_snapshot_financial_ledger_customer']) as i(name)
  union all
  select 'function', f.sig, f.oid is not null from fn_state f
  union all
  select 'trigger', t.tbl || '.' || t.name, t.tgtype is not null from trg_state t
  union all
  select 'column', c.tbl || '.' || c.col, exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public' and ic.table_name = c.tbl and ic.column_name = c.col)
  from (values ('st_staff_auth_links', 'sessions_not_before'), ('user_mfa_secrets', 'last_used_step')) as c(tbl, col)
  union all
  select 'policy', 'customers.st_owner_delete', exists (
    select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'customers' and p.policyname = 'st_owner_delete')
  union all
  select 'policy', w.name || '.' || pn.name, exists (
    select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = w.name and p.policyname = pn.name)
  from workflow_tables w cross join (values ('st_manager_insert'), ('st_manager_update')) as pn(name)
),
snap as (
  select s.business_id, s.payload from public.smile_trust_cloud_snapshots s
),
live as (
  select payload from snap where business_id = 'SMILE-TRUST' limit 1
),
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
snap_customers as (
  select c ->> 'id' as id
  from live
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(live.payload -> 'customers') = 'array' then live.payload -> 'customers' else '[]'::jsonb end
  ) as c
  where jsonb_typeof(c) = 'object' and coalesce(c ->> 'id', '') <> ''
),
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
-- Read-only probes of objects that only exist after 047 (NULL when the object is missing).
-- query_to_xml runs in table mode (tableforest = false): the result is always one <table>
-- document, also for zero rows. Table-forest mode returns an empty value for zero rows, which
-- xpath() cannot parse (2200M "Document is empty").
probe_xml as (
  select
    case when to_regclass('public.st_snapshot_financial_ledger') is null then null
         else query_to_xml(format(
           'select count(*) as n from public.st_snapshot_financial_ledger where business_id = %L', 'SMILE-TRUST'),
           false, false, '') end as history_rows,
    case when to_regclass('public.st_snapshot_financial_ledger') is null then null
         else query_to_xml(format(
           'select count(*) as n from public.st_snapshot_financial_ledger l where l.business_id = %L and l.customer_id <> %L'
           || ' and not exists (select 1 from public.smile_trust_cloud_snapshots s'
           || ' cross join lateral jsonb_array_elements(case when jsonb_typeof(s.payload -> %L) = %L then s.payload -> %L else %L::jsonb end) c'
           || ' where s.business_id = l.business_id and c ->> %L = l.customer_id)',
           'SMILE-TRUST', '', 'customers', 'array', 'customers', '[]', 'id'), false, false, '') end as history_missing_members,
    -- Zero rows when no SMILE-TRUST snapshot is stored; nulls = true keeps "no violation" (NULL) distinct.
    case when to_regprocedure('public.st_snapshot_history_violation(text, jsonb, boolean)') is null then null
         else query_to_xml(format(
           'select public.st_snapshot_history_violation(business_id, payload, true) as v from public.smile_trust_cloud_snapshots where business_id = %L',
           'SMILE-TRUST'), true, false, '') end as history_violation,
    case when to_regclass('public.st_staff_security_events') is null then null
         else query_to_xml('select count(*) as n from public.st_staff_security_events', false, false, '') end as security_events,
    case when to_regclass('public.st_member_lifecycle_events') is null then null
         else query_to_xml('select count(*) as n from public.st_member_lifecycle_events', false, false, '') end as lifecycle_events,
    case when to_regprocedure('public.st_is_secret_key(text)') is null or to_regprocedure('public.st_strip_secret_keys(jsonb)') is null then null
         else query_to_xml(
           'select public.st_is_secret_key(''passwordHash'') and public.st_is_secret_key(''mfaSecret'') and public.st_is_secret_key(''refreshToken'')'
           || ' and not public.st_is_secret_key(''amount'')'
           || ' and public.st_strip_secret_keys(''{"users":[{"id":"u","passwordHash":"x","mfaSecret":"y"}],"settings":{"syncToken":"z"}}''::jsonb)'
           || ' = ''{"users":[{"id":"u"}],"settings":{}}''::jsonb as v', true, false, '') end as scrub_probe
),
probe as (
  select
    nullif((xpath('/table/row/n/text()', x.history_rows))[1]::text, '')::int as history_rows,
    nullif((xpath('/table/row/n/text()', x.history_missing_members))[1]::text, '')::int as history_missing_members,
    case
      when x.history_violation is null then null
      when (xpath('count(/table/row)', x.history_violation))[1]::text::int = 0 then 'no snapshot'
      when (xpath('count(/table/row)', x.history_violation))[1]::text::int > 1 then 'several SMILE-TRUST snapshot rows'
      when (xpath('count(/table/row/v[@xsi:nil="true"])', x.history_violation,
                  array[array['xsi', 'http://www.w3.org/2001/XMLSchema-instance']]))[1]::text::int = 1 then 'none'
      else coalesce(nullif((xpath('/table/row/v/text()', x.history_violation))[1]::text, ''), 'empty result from the history check')
    end as history_violation,
    nullif((xpath('/table/row/n/text()', x.security_events))[1]::text, '')::int as security_events,
    nullif((xpath('/table/row/n/text()', x.lifecycle_events))[1]::text, '')::int as lifecycle_events,
    case when x.scrub_probe is null then null
         else coalesce(nullif((xpath('/table/row/v/text()', x.scrub_probe))[1]::text, ''), 'no value') end as scrub_probe
  from probe_xml x
),
fn_defs as (
  select
    pg_get_functiondef(to_regprocedure('public.st_caller_staff_ok()')) as caller_ok,
    pg_get_functiondef(to_regprocedure('public.st_business_authorized(text)')) as business_authorized,
    pg_get_functiondef(to_regprocedure('public.st_tenant_match(uuid)')) as tenant_match,
    pg_get_functiondef(to_regprocedure('public.st_assert_business(text)')) as assert_business,
    pg_get_functiondef(to_regprocedure('public.st_submit_collections(text, jsonb)')) as submit,
    pg_get_functiondef(to_regprocedure('public.st_guard_app_users()')) as guard_users,
    pg_get_functiondef(to_regprocedure('public.st_guard_cloud_snapshot()')) as guard_snapshot,
    pg_get_functiondef(to_regprocedure('public.st_reset_staff_mfa(text, text, text)')) as reset_mfa,
    pg_get_functiondef(to_regprocedure('public.st_guard_customer_lifecycle()')) as guard_customers
),
snap_policies as (
  select p.policyname, p.cmd, coalesce(p.qual, '') as qual, coalesce(p.with_check, '') as with_check
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'smile_trust_cloud_snapshots'
),
relational_counts as (
  select b.name, b.expected,
         case when to_regclass('public.' || b.name) is null then null
              else nullif((xpath('/table/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', b.name), false, false, '')))[1]::text, '')::int
         end as actual
  from baseline_counts b
),
checks (section, ord, check_name, status, detail) as (
  -- 1-2. Every 047 object exists (no partial application)
  select '01 047 objects', 1, 'all objects created by 047 exist',
         case when bool_and(o.present) then 'PASS' else 'FAIL' end,
         case when bool_and(o.present) then count(*)::text || '/' || count(*)::text || ' present'
              else 'missing ' || count(*) filter (where not o.present)::text || '/' || count(*)::text || ': '
                   || string_agg(o.kind || ' ' || o.name, ', ') filter (where not o.present) end
  from objects047 o
  union all
  select '01 047 objects', 2, 'no partial application', case when bool_and(o.present) or not bool_or(o.present) then 'PASS' else 'FAIL' end,
         case when bool_and(o.present) then 'complete'
              when not bool_or(o.present) then '047 does not appear to be applied at all'
              else 'PARTIAL: some 047 objects exist and others do not' end
  from objects047 o
  union all
  select '01 047 objects', 3, '047 functions are not callable by anonymous clients',
         case when count(*) filter (where f.oid is not null and has_function_privilege('anon', f.oid, 'EXECUTE')) = 0 then 'PASS' else 'FAIL' end,
         coalesce('callable by anon: ' || string_agg(f.sig, ', ') filter (where f.oid is not null and has_function_privilege('anon', f.oid, 'EXECUTE')), 'none')
  from fn_state f
  union all
  select '01 047 objects', 4, 'trigger and snapshot internals are not callable by signed-in clients',
         case when count(*) filter (where f.access = 'internal' and f.oid is not null and has_function_privilege('authenticated', f.oid, 'EXECUTE')) = 0
              then 'PASS' else 'FAIL' end,
         coalesce('callable: ' || string_agg(f.sig, ', ') filter (where f.access = 'internal' and f.oid is not null
                  and has_function_privilege('authenticated', f.oid, 'EXECUTE')), 'none')
  from fn_state f
  union all
  select '01 047 objects', 5, 'staff RPCs and policy helpers are callable by signed-in clients',
         case when count(*) filter (where f.access = 'authenticated' and (f.oid is null or not has_function_privilege('authenticated', f.oid, 'EXECUTE'))) = 0
              then 'PASS' else 'FAIL' end,
         coalesce('not callable: ' || string_agg(f.sig, ', ') filter (where f.access = 'authenticated'
                  and (f.oid is null or not has_function_privilege('authenticated', f.oid, 'EXECUTE'))), 'all granted')
  from fn_state f

  -- 3-10. JOHN; 11-12. AMA and KWAME
  union all
  select p.label, v.ord, v.check_name, v.status, v.detail
  from people p
  cross join lateral (values
    (1, 'exists exactly once', case when p.n_name = 1 then 'PASS' else 'FAIL' end,
        p.n_name::text || ' row(s) with this username in SMILE-TRUST'),
    (2, 'UUID unchanged', case when p.n_uuid = 1 and p.id = p.exp_uuid then 'PASS' else 'FAIL' end,
        case when p.id = p.exp_uuid then p.exp_uuid::text
             else 'expected ' || p.exp_uuid::text || ', found ' || coalesce(p.id::text, 'no single row') end),
    (3, 'role = ' || p.exp_role, case when p.role = p.exp_role then 'PASS' else 'FAIL' end, coalesce(p.role, 'no single row')),
    (4, 'active = true', case when p.active is true then 'PASS' else 'FAIL' end, coalesce(p.active::text, 'no single row')),
    (5, case when p.activated then 'password format = pbkdf2' else 'still not activated (no password)' end,
        case when (p.activated and p.pw_format = 'pbkdf2') or (not p.activated and p.pw_format = 'none') then 'PASS' else 'FAIL' end,
        'password format: ' || coalesce(p.pw_format, 'no single row')),
    (6, case when p.activated then 'Auth link exactly one' else 'still no Auth link' end,
        case when (p.activated and p.n_links = 1) or (not p.activated and p.n_links = 0) then 'PASS' else 'FAIL' end,
        p.n_links::text || ' link(s) in st_staff_auth_links'),
    (7, 'server MFA record',
        case when p.activated or p.mfa_rows = 0 then 'INFO' else 'FAIL' end,
        case when p.mfa_rows = 0 then 'none'
             when p.activated then p.mfa_rows::text || ' row(s): an authenticator exists or is pending'
             else p.mfa_rows::text || ' row(s) for an account that is not activated' end),
    (8, 'open activation codes', case when p.codes_open = 0 then 'PASS' when p.activated then 'WARN' else 'INFO' end,
        p.codes_open::text || ' unused, unexpired code(s)')
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
        case when p.meta ->> 'app_role' = p.exp_claim_role then 'PASS' else 'FAIL' end, coalesce(p.meta ->> 'app_role', 'missing')),
    (12, 'Auth claim business = SMILE-TRUST',
        case when p.meta ->> 'business_code' = 'SMILE-TRUST' then 'PASS' else 'FAIL' end, coalesce(p.meta ->> 'business_code', 'missing')),
    (13, 'Auth claim app user = this staff row',
        case when p.meta ->> 'app_user_id' = p.app_id then 'PASS' else 'FAIL' end,
        case when p.meta ->> 'app_user_id' = p.app_id then 'matches' else 'does not match' end),
    (14, 'Auth identity linked to this staff row only',
        case when p.auth_link_uses = 1 then 'PASS' else 'FAIL' end, p.auth_link_uses::text || ' link(s) use this Auth identity'),
    (15, 'session cutoff not moved (existing sessions stay valid)',
        case when p.not_before is null then 'FAIL'
             when p.not_before::timestamptz <= 'epoch'::timestamptz then 'PASS' else 'WARN' end,
        case when p.not_before is null then 'sessions_not_before column missing'
             when p.not_before::timestamptz <= 'epoch'::timestamptz then 'no cutoff set'
             else 'sessions issued before ' || p.not_before || ' are rejected: his role or status was changed' end)
  ) as v(ord, check_name, status, detail)
  where p.activated

  -- 13. Staff counts
  union all
  select '13 staff counts', 1, 'staff by role = baseline (SystemOwner 1, AssistantManager 1, Collector 1)',
         case when bool_and(coalesce(a.n, 0) = coalesce(b.expected, 0)) then 'PASS' else 'FAIL' end,
         string_agg(coalesce(a.role, b.role) || '=' || coalesce(a.n, 0) || case when coalesce(a.n, 0) <> coalesce(b.expected, 0)
                    then ' (baseline ' || coalesce(b.expected, 0) || ')' else '' end, ', ' order by coalesce(a.role, b.role))
  from (select role, count(*)::int as n from staff group by role) a
  full join baseline_staff b on b.role = a.role
  union all
  select '13 staff counts', 2, 'no inactive staff', case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text || ' inactive'
  from staff where active is not true

  -- 14. Members
  union all
  select '14 members', 1, 'members (SMILE-TRUST) by status = baseline (1 Active)',
         case when bool_and(coalesce(a.n, 0) = coalesce(b.expected, 0)) then 'PASS'
              when sum(coalesce(a.n, 0)) < sum(coalesce(b.expected, 0)) then 'FAIL' else 'WARN' end,
         string_agg(coalesce(a.status, b.status) || '=' || coalesce(a.n, 0) || case when coalesce(a.n, 0) <> coalesce(b.expected, 0)
                    then ' (baseline ' || coalesce(b.expected, 0) || ')' else '' end, ', ' order by coalesce(a.status, b.status))
  from (
    select case when not c.active and coalesce(c.member_status, 'Active') = 'Active' then 'Closed'
                else coalesce(c.member_status, 'Active') end as status, count(*)::int as n
    from public.customers c join biz z on z.id = c.business_id group by 1
  ) a
  full join baseline_members b on b.status = a.status

  -- 15-16. Row counts against the baseline
  union all
  select '15 row counts', row_number() over (order by r.name)::int, r.name,
         case when r.actual is null then 'FAIL'
              when r.actual = r.expected then 'PASS'
              when r.actual < r.expected then 'FAIL'
              else 'WARN' end,
         case when r.actual is null then 'table missing'
              when r.actual = r.expected then r.actual::text || ' (baseline ' || r.expected || ')'
              when r.actual < r.expected then r.actual::text || ' (baseline ' || r.expected || '): ROWS MISSING'
              when r.name = 'st_portal_pins' then r.actual::text || ' (baseline ' || r.expected
                   || '): expected only if the snapshot held plaintext member PINs, which 047 moved to hashed storage'
              else r.actual::text || ' (baseline ' || r.expected || '): new rows since the baseline' end
  from relational_counts r
  union all
  -- 047 never deletes snapshot rows (its trigger covers insert/update only, and client deletes are
  -- revoked), so a missing row predates 047 unless the pre-047 preflight reported it present.
  select '16 data retention', 1, 'SMILE-TRUST snapshot still present',
         case when (select count(*) from live) = 1 then 'PASS' else 'WARN' end,
         case when (select count(*) from live) = 1 then 'present'
              else 'no SMILE-TRUST snapshot row; stored snapshot rows: '
                   || coalesce((select string_agg(business_id, ', ' order by business_id) from snap), 'none')
                   || '. If the pre-047 preflight row "15 snapshot / SMILE-TRUST snapshot present" said present, treat this as data loss'
         end
  union all
  select '16 data retention', 2, 'snapshot history registered for every posted record',
         case when pr.history_rows is null then 'FAIL'
              when pr.history_rows = (select count(distinct (kind, record_id)) from fin) then 'PASS' else 'WARN' end,
         coalesce(pr.history_rows::text, 'history table missing') || ' registered, '
           || (select count(distinct (kind, record_id)) from fin)::text || ' posted records in the snapshot'
  from probe pr
  union all
  select '16 data retention', 3, 'staff security events since 047', case when pr.security_events = 0 then 'PASS' when pr.security_events is null then 'FAIL' else 'WARN' end,
         coalesce(pr.security_events::text || ' event(s)' || case when pr.security_events > 0 then ': a staff role, status or MFA changed' else '' end, 'table missing')
  from probe pr
  union all
  select '16 data retention', 4, 'member lifecycle events since 047', case when pr.lifecycle_events = 0 then 'PASS' when pr.lifecycle_events is null then 'FAIL' else 'WARN' end,
         coalesce(pr.lifecycle_events::text || ' event(s)' || case when pr.lifecycle_events > 0 then ': a member status changed or a member was deleted' else '' end, 'table missing')
  from probe pr

  -- 17. app_users security triggers
  union all
  select '17 app_users trigger', t.ord, t.tbl || '.' || t.name || ' exists and is enabled',
         case when t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask then 'PASS' else 'FAIL' end,
         case when t.tgtype is null then 'missing'
              when t.tgenabled not in ('O', 'A') then 'DISABLED'
              when (t.tgtype & t.type_mask) <> t.type_mask then 'fires on the wrong events'
              else 'enabled' end
  from (select row_number() over (order by name)::int as ord, * from trg_state where tbl = 'app_users') t

  -- 18. Role escalation protections
  union all
  select '18 role escalation', 1, 'guard covers insert, update and delete before the write',
         case when (select (tgtype & 31) = 31 from trg_state where name = 'st_guard_app_users') then 'PASS' else 'FAIL' end,
         coalesce((select pg_get_triggerdef(tr.oid) from pg_trigger tr where tr.tgname = 'st_guard_app_users'
                   and tr.tgrelid = 'public.app_users'::regclass), 'missing')
  union all
  select '18 role escalation', 2, 'guard enforces owner-only grants, no self-change, last owner protected, no client password writes',
         case when d.guard_users like '%only the System Owner can grant owner-level roles%'
               and d.guard_users like '%you cannot change your own role, status or username%'
               and d.guard_users like '%the last active System Owner cannot be deactivated or demoted%'
               and d.guard_users like '%password hashes are changed by the staff-login service only%'
               and d.guard_users like '%st_caller_staff_ok()%'
              then 'PASS' else 'FAIL' end,
         case when d.guard_users is null then 'function missing' else 'rules present in st_guard_app_users' end
  from fn_defs d
  union all
  select '18 role escalation', 3, 'guard runs with definer rights',
         case when (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.st_guard_app_users()')) then 'PASS' else 'FAIL' end,
         coalesce((select case when p.prosecdef then 'security definer' else 'security invoker' end
                   from pg_proc p where p.oid = to_regprocedure('public.st_guard_app_users()')), 'missing')

  -- 19. Snapshot writes
  union all
  select '19 snapshot writes', 1, 'only the three 047 snapshot policies exist',
         case when count(*) = 3 and bool_and(sp.policyname in ('st_snapshots_select', 'st_snapshots_insert', 'st_snapshots_update'))
              then 'PASS' else 'FAIL' end,
         coalesce(string_agg(sp.policyname || ' (' || sp.cmd || ')', ', ' order by sp.policyname), 'none')
  from snap_policies sp
  union all
  select '19 snapshot writes', 2, 'insert and update require a manager role and a live staff identity',
         case when (select count(*) from snap_policies sp
                    where (sp.policyname = 'st_snapshots_insert' and sp.cmd = 'INSERT'
                           and sp.with_check like '%st_jwt_is_manager()%' and sp.with_check like '%st_caller_staff_ok()%')
                       or (sp.policyname = 'st_snapshots_update' and sp.cmd = 'UPDATE'
                           and sp.qual like '%st_jwt_is_manager()%' and sp.qual like '%st_caller_staff_ok()%'
                           and sp.with_check like '%st_jwt_is_manager()%' and sp.with_check like '%st_caller_staff_ok()%')) = 2
              then 'PASS' else 'FAIL' end,
         'collectors and other non-manager roles cannot write the snapshot'
  union all
  select '19 snapshot writes', 3, 'reads require a live staff identity',
         case when exists (select 1 from snap_policies sp where sp.policyname = 'st_snapshots_select' and sp.cmd = 'SELECT'
                           and sp.qual like '%st_caller_staff_ok()%') then 'PASS' else 'FAIL' end,
         'deactivated staff cannot read the snapshot'
  union all
  select '19 snapshot writes', 4, 'manager roles are SystemOwner, KBA, Admin, ManagingDirector, Accountant',
         case when pg_get_functiondef(to_regprocedure('public.st_jwt_is_manager()'))
                   like '%''SystemOwner'', ''KBA'', ''Admin'', ''ManagingDirector'', ''Accountant''%' then 'PASS' else 'FAIL' end,
         case when to_regprocedure('public.st_jwt_is_manager()') is null then 'function missing' else 'st_jwt_is_manager' end
  union all
  select '19 snapshot writes', 5, 'row-level security on the snapshot table',
         case when (select c.relrowsecurity from pg_class c where c.oid = 'public.smile_trust_cloud_snapshots'::regclass) then 'PASS' else 'FAIL' end,
         'enabled'

  -- 20. Snapshot delete
  union all
  select '20 snapshot delete', 1, 'no delete or catch-all policy on the snapshot',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(sp.policyname || ' (' || sp.cmd || ')', ', '), 'none')
  from snap_policies sp where sp.cmd in ('DELETE', 'ALL')
  union all
  select '20 snapshot delete', 2, 'signed-in and anonymous clients hold no delete or truncate privilege',
         case when not (has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'DELETE')
                        or has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')
                        or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'DELETE')
                        or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')) then 'PASS' else 'FAIL' end,
         'delete/truncate revoked'

  -- 21. Collector submission RPC
  union all
  select '21 collector submit RPC', 1, 'st_submit_collections exists with definer rights',
         case when (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.st_submit_collections(text, jsonb)')) then 'PASS' else 'FAIL' end,
         case when to_regprocedure('public.st_submit_collections(text, jsonb)') is null then 'missing' else 'present' end
  union all
  select '21 collector submit RPC', 2, 'callable by signed-in staff only (not anonymous)',
         case when to_regprocedure('public.st_submit_collections(text, jsonb)') is not null
               and has_function_privilege('authenticated', to_regprocedure('public.st_submit_collections(text, jsonb)'), 'EXECUTE')
               and not has_function_privilege('anon', to_regprocedure('public.st_submit_collections(text, jsonb)'), 'EXECUTE')
              then 'PASS' else 'FAIL' end,
         'execute: authenticated yes, anon no'
  union all
  select '21 collector submit RPC', 3, 'checks the business, the live staff identity and the batch size',
         case when d.submit like '%st_assert_business(p_business_code)%'
               and d.submit like '%submit between 1 and 200 collections at a time%'
               and d.assert_business like '%st_business_authorized%'
               and d.business_authorized like '%st_caller_staff_ok()%'
              then 'PASS' else 'FAIL' end,
         'st_submit_collections -> st_assert_business -> st_business_authorized -> st_caller_staff_ok'
  from fn_defs d

  -- 22. Staff authority comes from app_users
  union all
  select '22 staff authority', 1, 'live staff check reads app_users and Auth links, never the snapshot',
         case when d.caller_ok like '%public.app_users%' and d.caller_ok like '%public.st_staff_auth_links%'
               and d.caller_ok not like '%smile_trust_cloud_snapshots%' then 'PASS' else 'FAIL' end,
         case when d.caller_ok is null then 'st_caller_staff_ok missing' else 'st_caller_staff_ok' end
  from fn_defs d
  union all
  select '22 staff authority', 2, 'staff-login Edge Function', 'INFO',
         'not deployed yet: until the new staff-login is deployed, sign-in still runs the old code; the database checks above already apply'

  -- 23. Snapshot secret scrubbing
  union all
  select '23 snapshot scrubbing', 1, 'scrub trigger runs before every snapshot insert and update',
         case when t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask then 'PASS' else 'FAIL' end,
         case when t.tgtype is null then 'missing' when t.tgenabled not in ('O', 'A') then 'DISABLED' else 'enabled' end
  from trg_state t where t.name = 'st_guard_cloud_snapshot'
  union all
  select '23 snapshot scrubbing', 2, 'trigger scrubs secrets and protects posted history',
         case when d.guard_snapshot like '%st_scrub_snapshot_payload%' and d.guard_snapshot like '%st_snapshot_history_violation%'
               and d.guard_snapshot like '%st_check_snapshot_members%' then 'PASS' else 'FAIL' end,
         case when d.guard_snapshot is null then 'function missing' else 'st_guard_cloud_snapshot' end
  from fn_defs d
  union all
  select '23 snapshot scrubbing', 3, 'secret-key detection works (pure function probe)',
         case when pr.scrub_probe = 'true' then 'PASS' else 'FAIL' end,
         coalesce('probe returned ' || pr.scrub_probe, 'functions missing')
  from probe pr

  -- 24. Existing snapshot data
  union all
  select '24 snapshot secrets', 1, 'no authentication keys in any stored snapshot',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) = 0 then 'none' else sum(n)::text || ' occurrence(s): ' || string_agg(key || ' x' || n, ', ' order by key) end
  from secret_hits
  union all
  select '24 snapshot secrets', 2, 'no password-hash or private-key text anywhere in stored snapshots',
         case when exists (select 1 from snap where payload::text ~ 'pbkdf2:[0-9]|-----BEGIN [A-Z ]*PRIVATE KEY') then 'FAIL' else 'PASS' end,
         case when exists (select 1 from snap where payload::text ~ 'pbkdf2:[0-9]|-----BEGIN [A-Z ]*PRIVATE KEY')
              then 'hash-like text found (value not shown)' else 'none' end

  -- 25. Live authorization helpers
  union all
  select '25 live authorization', 1, 'live staff check: active, role = claim, Auth link = caller, session cutoff',
         case when d.caller_ok like '%u.active IS TRUE%' or d.caller_ok like '%u.active is true%' then
                case when d.caller_ok ilike '%sessions_not_before%' and d.caller_ok ilike '%auth.uid()%'
                      and d.caller_ok ilike '%st_jwt_iat()%' and d.caller_ok ilike '%st_app_role_from_relational(u.role)%'
                      and d.caller_ok ilike '%Developer%' then 'PASS' else 'FAIL' end
              else 'FAIL' end,
         case when d.caller_ok is null then 'st_caller_staff_ok missing' else 'st_caller_staff_ok' end
  from fn_defs d
  union all
  select '25 live authorization', 2, 'tenant helpers call the live staff check',
         case when d.business_authorized like '%st_caller_staff_ok()%' and d.tenant_match like '%st_caller_staff_ok()%' then 'PASS' else 'FAIL' end,
         'st_business_authorized, st_tenant_match'
  from fn_defs d
  union all
  select '25 live authorization', 3, 'text-keyed tenant policies call the live staff check',
         case when count(*) filter (where coalesce(p.qual, '') not like '%st_caller_staff_ok()%') = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || ' tenant_code_all polic(ies); ' || count(*) filter (where coalesce(p.qual, '') not like '%st_caller_staff_ok()%')::text || ' without it'
  from pg_policies p where p.schemaname = 'public' and p.policyname = 'tenant_code_all'
  union all
  select '25 live authorization', 4, 'session cutoff trigger moves the cutoff on deactivation or role change',
         case when t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask then 'PASS' else 'FAIL' end,
         case when t.tgtype is null then 'missing' when t.tgenabled not in ('O', 'A') then 'DISABLED' else 'enabled (after update)' end
  from trg_state t where t.name = 'st_app_users_session_cutoff'

  -- 26. Financial tables: no direct client writes
  union all
  select '26 financial client writes', 1, 'signed-in and anonymous clients cannot write ledger tables',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce('still writable: ' || string_agg(l.name, ', ' order by l.name), 'none writable')
  from ledger_tables l
  where to_regclass('public.' || l.name) is not null
    and (has_table_privilege('authenticated', to_regclass('public.' || l.name), 'INSERT')
      or has_table_privilege('authenticated', to_regclass('public.' || l.name), 'UPDATE')
      or has_table_privilege('authenticated', to_regclass('public.' || l.name), 'DELETE')
      or has_table_privilege('authenticated', to_regclass('public.' || l.name), 'TRUNCATE')
      or has_table_privilege('anon', to_regclass('public.' || l.name), 'INSERT')
      or has_table_privilege('anon', to_regclass('public.' || l.name), 'UPDATE')
      or has_table_privilege('anon', to_regclass('public.' || l.name), 'DELETE'))
  union all
  select '26 financial client writes', 2, 'no client write policies remain on ledger tables',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(p.tablename || '.' || p.policyname, ', ' order by p.tablename, p.policyname), 'none')
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in (select name from ledger_tables)
    and p.policyname in ('tenant_insert', 'tenant_update', 'tenant_delete')
  union all
  select '26 financial client writes', 3, 'posted-row guard on every financial table',
         case when count(*) filter (where not (t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask)) = 0
              then 'PASS' else 'FAIL' end,
         count(*)::text || ' table(s); problems: ' || coalesce(string_agg(t.tbl, ', ') filter (
           where not (t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask)), 'none')
  from trg_state t where t.name = 'st_guard_posted_rows'
  union all
  select '26 financial client writes', 4, 'workflow tables: manager-only writes, no client deletes (members excepted)',
         case when count(*) filter (where not w.ok) = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || ' table(s); problems: ' || coalesce(string_agg(w.name, ', ') filter (where not w.ok), 'none')
  from (
    select wt.name,
           exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = wt.name and p.policyname = 'st_manager_insert'
                   and coalesce(p.with_check, '') like '%st_jwt_is_manager()%')
           and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = wt.name and p.policyname = 'st_manager_update'
                   and coalesce(p.qual, '') like '%st_jwt_is_manager()%')
           and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = wt.name
                   and p.policyname in ('tenant_insert', 'tenant_update', 'tenant_delete'))
           and (wt.name = 'customers' or not has_table_privilege('authenticated', to_regclass('public.' || wt.name), 'DELETE')) as ok
    from workflow_tables wt
  ) w

  -- 27. Member lifecycle
  union all
  select '27 member lifecycle', 1, 'lifecycle trigger on members is enabled',
         case when t.tgtype is not null and t.tgenabled in ('O', 'A') and (t.tgtype & t.type_mask) = t.type_mask then 'PASS' else 'FAIL' end,
         case when t.tgtype is null then 'missing' when t.tgenabled not in ('O', 'A') then 'DISABLED' else 'enabled (before update or delete)' end
  from trg_state t where t.name = 'st_guard_customer_lifecycle'
  union all
  select '27 member lifecycle', 2, 'members with history cannot be deleted; status changes are role-checked and logged',
         case when d.guard_customers like '%member has financial history and cannot be deleted%'
               and d.guard_customers like '%not allowed to change member status%'
               and d.guard_customers like '%st_member_lifecycle_events%' then 'PASS' else 'FAIL' end,
         case when d.guard_customers is null then 'function missing' else 'st_guard_customer_lifecycle' end
  from fn_defs d
  union all
  select '27 member lifecycle', 3, 'member deletes limited to the System Owner',
         case when exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'customers'
                           and p.policyname = 'st_owner_delete' and p.cmd = 'DELETE' and coalesce(p.qual, '') like '%SystemOwner%')
               and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'customers'
                           and p.cmd in ('DELETE', 'ALL') and p.policyname <> 'st_owner_delete')
              then 'PASS' else 'FAIL' end,
         coalesce((select string_agg(p.policyname, ', ') from pg_policies p where p.schemaname = 'public'
                   and p.tablename = 'customers' and p.cmd in ('DELETE', 'ALL')), 'no delete policy')

  -- 28. MFA objects
  union all
  select '28 MFA objects', 1, 'owner-controlled, audited MFA reset',
         case when d.reset_mfa like '%only an owner can reset MFA%' and d.reset_mfa like '%you cannot reset your own MFA%'
               and d.reset_mfa like '%a reason is required for an MFA reset%' and d.reset_mfa like '%st_staff_security_events%'
               and (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.st_reset_staff_mfa(text, text, text)'))
              then 'PASS' else 'FAIL' end,
         case when d.reset_mfa is null then 'st_reset_staff_mfa missing' else 'st_reset_staff_mfa' end
  from fn_defs d
  union all
  select '28 MFA objects', 2, 'replay protection column and server-only MFA and audit tables',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_mfa_secrets'
                           and column_name = 'last_used_step')
               and not has_table_privilege('authenticated', 'public.user_mfa_secrets', 'SELECT')
               and not has_table_privilege('anon', 'public.user_mfa_secrets', 'SELECT')
               and to_regclass('public.st_staff_security_events') is not null
               and not has_table_privilege('authenticated', to_regclass('public.st_staff_security_events'), 'SELECT')
              then 'PASS' else 'FAIL' end,
         'user_mfa_secrets.last_used_step; MFA secrets and security events unreadable by clients'

  -- 29. upsert_user_mfa
  union all
  select '29 upsert_user_mfa', 1, 'not callable by signed-in or anonymous clients',
         case when to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)') is null then 'PASS'
              when has_function_privilege('authenticated', to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)'), 'EXECUTE')
                or has_function_privilege('anon', to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)'), 'EXECUTE')
              then 'FAIL' else 'PASS' end,
         case when to_regprocedure('public.upsert_user_mfa(text, text, text, boolean)') is null then 'function not present'
              else 'execute revoked' end

  -- 30. Row-level security
  union all
  select '30 RLS', 1, 'every public table has row-level security',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || ' without' || coalesce(': ' || string_agg(c.relname, ', ' order by c.relname), '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select '30 RLS', 2, 'anonymous clients hold no table privileges in public',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         count(*)::text || coalesce(': ' || string_agg(c.relname, ', ' order by c.relname), '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))

  -- 31. Duplicates and orphans
  union all
  select '31 duplicates and orphans', 1, 'duplicate staff usernames or app ids', case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (select uname from staff group by uname having count(*) > 1
        union all select app_id from staff group by app_id having count(*) > 1) x
  union all
  select '31 duplicates and orphans', 2, 'staff rows with more than one Auth link, or Auth identities shared',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (select app_user_id::text from links group by app_user_id having count(*) > 1
        union all select auth_user_id::text from public.st_staff_auth_links group by auth_user_id having count(*) > 1) x
  union all
  select '31 duplicates and orphans', 3, 'Auth links whose staff row or Auth user is missing',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from links l
  where not exists (select 1 from staff s where s.app_id = l.app_user_id)
     or not exists (select 1 from au a where a.id = l.auth_user_id)
  union all
  select '31 duplicates and orphans', 4, 'Auth users claiming SMILE-TRUST without a staff link',
         case when count(*) = 0 then 'PASS' else 'WARN' end, count(*)::text
  from au a where a.meta ->> 'business_code' = 'SMILE-TRUST' and not exists (select 1 from links l where l.auth_user_id = a.id)
  union all
  select '31 duplicates and orphans', 5, 'registered history pointing at a member missing from the snapshot',
         case when pr.history_missing_members = 0 then 'PASS' else 'FAIL' end,
         coalesce(pr.history_missing_members::text || case when pr.history_missing_members > 0
                  then ': every manager sync would be refused until fixed' else '' end, 'history table missing')
  from probe pr
  union all
  select '31 duplicates and orphans', 6, 'the stored snapshot passes the posted-history rules (next manager sync accepted)',
         case when pr.history_violation = 'none' then 'PASS'
              when pr.history_violation = 'no snapshot' then 'INFO'
              else 'FAIL' end,
         case when pr.history_violation is null then 'function missing'
              when pr.history_violation = 'no snapshot' then 'no SMILE-TRUST snapshot stored: nothing to check'
              else pr.history_violation end
  from probe pr
  union all
  select '31 duplicates and orphans', 7, 'relational records without their member, collector or loan',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*)::text
  from (
    select col.id from public.collections col
    where not exists (select 1 from public.customers c where c.id = col.customer_id)
       or not exists (select 1 from public.app_users u where u.id = col.collector_id)
    union all
    select le.id from public.ledger_entries le
    where le.customer_id is not null and not exists (select 1 from public.customers c where c.id = le.customer_id)
    union all
    select l.id from public.loans l where not exists (select 1 from public.customers c where c.id = l.customer_id)
    union all
    select r.id from public.loan_repayments r
    where not exists (select 1 from public.loans l where l.id = r.loan_id)
       or not exists (select 1 from public.customers c where c.id = r.customer_id)
    union all
    select c.id from public.customers c where not exists (select 1 from public.app_users u where u.id = c.collector_id)
  ) x
  union all
  select '31 duplicates and orphans', 8, 'SMILE-TRUST business row exactly once',
         case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end, (select count(*) from biz)::text
)
select '00 VERDICT' as section, 0 as ord, 'overall' as check_name,
       case when exists (select 1 from checks where status = 'FAIL') then 'POST_047_FAILED' else 'POST_047_VERIFIED' end as status,
       (select count(*) from checks where status = 'FAIL')::text || ' FAIL, '
       || (select count(*) from checks where status = 'WARN')::text || ' WARN, '
       || (select count(*) from checks where status = 'PASS')::text || ' PASS'
       || coalesce('. failed: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord)
                                    from checks where status = 'FAIL'), '') as detail
union all
select section, ord, check_name, status, detail from checks
order by section, ord;
