-- READ-ONLY preflight for the FIRST authoritative cloud snapshot of SMILE-TRUST (the explicit
-- manager-only initial cloud snapshot bootstrap added in commit 11be35b, after migration 047).
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Paste the whole file into the Supabase SQL Editor and run it. It returns one result set:
-- one row per check (section, ord, check_name, status, detail), with the overall verdict first:
--   READY_FOR_INITIAL_SNAPSHOT      no check has status FAIL (review every WARN before bootstrapping)
--   NOT_READY_FOR_INITIAL_SNAPSHOT  at least one FAIL; the verdict detail names each failing check
--
-- Statuses: PASS = as required, FAIL = would make the bootstrap unsafe or make it refuse,
-- WARN = needs a human decision, INFO = recorded for comparison after the bootstrap.
--
-- Safety:
--   * The first statement makes the transaction read only; the rest is one SELECT. Nothing is
--     written, no schema object is touched, no application function is invoked.
--   * The only dynamic SQL is a row count (query_to_xml in table mode) for tables that may not exist.
--   * Never returns password hashes, MFA secrets, activation codes, Auth emails, tokens or keys.
--     Password and MFA columns are only tested for presence; the MFA secret column is never read.

set transaction read only;

with
biz as (
  select b.id
  from public.businesses b
  where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
),
biz_one as (
  select id from biz where (select count(*) from biz) = 1
),

-- 02 migration 047 protections on the snapshot table ------------------------------------------
snap_rel as (
  select c.oid, c.relrowsecurity
  from pg_class c
  where c.oid = to_regclass('public.smile_trust_cloud_snapshots')
),
snap_unique as (
  select count(*)::int as n
  from pg_index i
  join snap_rel r on r.oid = i.indrelid
  join pg_attribute a on a.attrelid = i.indrelid and a.attname = 'business_id'
  where i.indisunique and i.indnkeyatts = 1 and i.indkey[0] = a.attnum and i.indpred is null
),
snap_policies as (
  select p.policyname, p.cmd, p.roles, coalesce(p.qual, '') as qual, coalesce(p.with_check, '') as wc
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'smile_trust_cloud_snapshots'
),
policy_state as (
  select count(*)::int as total,
         count(*) filter (where (policyname, cmd) in (('st_snapshots_select', 'SELECT'), ('st_snapshots_insert', 'INSERT'),
                                                      ('st_snapshots_update', 'UPDATE')))::int as expected,
         count(*) filter (where cmd in ('DELETE', 'ALL'))::int as delete_or_all,
         count(*) filter (where roles <> array['authenticated']::name[])::int as other_roles,
         coalesce(bool_or(policyname = 'st_snapshots_select' and cmd = 'SELECT'
                          and position('st_jwt_business_code()' in qual) > 0 and position('st_caller_staff_ok()' in qual) > 0), false) as select_ok,
         coalesce(bool_or(policyname = 'st_snapshots_insert' and cmd = 'INSERT'
                          and position('st_jwt_business_code()' in wc) > 0 and position('st_jwt_is_manager()' in wc) > 0
                          and position('st_caller_staff_ok()' in wc) > 0), false) as insert_ok,
         coalesce(bool_or(policyname = 'st_snapshots_update' and cmd = 'UPDATE'
                          and position('st_jwt_business_code()' in qual) > 0 and position('st_jwt_is_manager()' in qual) > 0
                          and position('st_caller_staff_ok()' in qual) > 0
                          and position('st_jwt_business_code()' in wc) > 0 and position('st_jwt_is_manager()' in wc) > 0
                          and position('st_caller_staff_ok()' in wc) > 0), false) as update_ok,
         coalesce(string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname), 'none') as summary
  from snap_policies
),
snap_trigger as (
  select t.tgenabled, t.tgtype::int as tgtype, p.proname
  from pg_trigger t
  join snap_rel r on r.oid = t.tgrelid
  left join pg_proc p on p.oid = t.tgfoid
  where t.tgname = 'st_guard_cloud_snapshot' and not t.tgisinternal
),
req_fns (sig) as (
  values ('st_jwt_business_code()'), ('st_jwt_is_manager()'), ('st_caller_staff_ok()'), ('st_tenant_match(uuid)'),
         ('st_assert_business(text)'), ('st_guard_cloud_snapshot()'), ('st_submit_collections(text, jsonb)'),
         ('fetch_business_snapshot(text)'), ('st_internal_fetch_business_snapshot(text)')
),
fns as (
  select f.sig, to_regprocedure('public.' || f.sig) as oid
  from req_fns f
),
fn_src as (
  select f.sig, p.prosrc
  from fns f
  join pg_proc p on p.oid = f.oid
),
fn_grants as (
  select f.sig,
         case when f.oid is null then false else has_function_privilege('authenticated', f.oid, 'EXECUTE') end as auth_exec,
         case when f.oid is null then false else has_function_privilege('anon', f.oid, 'EXECUTE') end as anon_exec
  from fns f
),
read_policies as (
  select p.tablename, count(*)::int as n
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('customers', 'collections') and p.cmd in ('SELECT', 'ALL')
    and (p.roles @> array['authenticated']::name[] or p.roles @> array['public']::name[])
  group by p.tablename
),

-- 03 snapshot state and race evidence ---------------------------------------------------------
snap as (
  select
    (select count(*) from public.smile_trust_cloud_snapshots s where s.business_id = 'SMILE-TRUST')::int as exact_rows,
    (select count(*) from public.smile_trust_cloud_snapshots s
      where s.business_id <> 'SMILE-TRUST' and upper(btrim(s.business_id)) = 'SMILE-TRUST')::int as variant_rows,
    (select count(*) from public.smile_trust_cloud_snapshots s where upper(btrim(s.business_id)) <> 'SMILE-TRUST')::int as other_rows,
    (select count(*) from pg_locks l
      where l.relation = to_regclass('public.smile_trust_cloud_snapshots') and l.pid <> pg_backend_pid())::int as other_locks,
    case when to_regclass('public.st_snapshot_financial_ledger') is null then null
         else (xpath('/table/row/n/text()', query_to_xml(
           'select count(*) as n from public.st_snapshot_financial_ledger where upper(btrim(business_id)) = ''SMILE-TRUST''',
           false, false, '')))[1]::text::int end as history_rows,
    case when to_regclass('public.st_member_lifecycle_events') is null then null
         else (xpath('/table/row/n/text()', query_to_xml(
           'select count(*) as n from public.st_member_lifecycle_events where business_code = ''SMILE-TRUST'' and source = ''snapshot''',
           false, false, '')))[1]::text::int end as snapshot_lifecycle_rows
),

-- 04 relational counts ------------------------------------------------------------------------
staff as (
  select u.id, u.client_id, coalesce(u.client_id, u.id::text) as app_id, lower(u.username) as uname, u.role, u.active,
         coalesce(u.password_hash, '') = '' as no_password,
         coalesce(u.password_hash, '') like 'pbkdf2:%' as pbkdf2_password
  from public.app_users u
  join biz_one b on b.id = u.business_id
),
branch_rows as (
  select br.id, br.client_id
  from public.branches br
  join biz_one b on b.id = br.business_id
),
product_rows as (
  select sp.code
  from public.savings_products sp
  join biz_one b on b.id = sp.business_id
),
members as (
  select c.client_id, c.branch_id, c.collector_id, coalesce(c.member_status, 'Active') as status,
         br.id as br_id, br.business_id as br_biz, br.client_id as br_cid,
         au.id as au_id, au.business_id as au_biz, au.client_id as au_cid, au.active as au_active
  from public.customers c
  join biz_one b on b.id = c.business_id
  left join public.branches br on br.id = c.branch_id
  left join public.app_users au on au.id = c.collector_id
),
member_issues as (
  select count(*)::int as total,
         count(*) filter (where coalesce(client_id, '') = '')::int as no_id,
         count(*) filter (where branch_id is null or br_id is null)::int as no_branch,
         count(*) filter (where br_id is not null and br_biz is distinct from (select id from biz_one))::int as branch_other_biz,
         count(*) filter (where br_id is not null and coalesce(br_cid, '') = '')::int as branch_no_id,
         count(*) filter (where collector_id is null or au_id is null)::int as no_collector,
         count(*) filter (where au_id is not null and au_biz is distinct from (select id from biz_one))::int as collector_other_biz,
         count(*) filter (where au_id is not null and coalesce(au_cid, '') = '')::int as collector_no_id,
         count(*) filter (where au_id is not null and au_active is not true)::int as collector_inactive,
         count(*) filter (where br_id is not null and au_id is not null)::int as loads
  from members
),
member_status as (
  select coalesce(string_agg(status || '=' || n, ', ' order by status), 'none') as summary
  from (select status, count(*)::int as n from members group by status) s
),
cols as (
  select col.client_id, cu.id as cu_id, cu.business_id as cu_biz, cu.client_id as cu_cid,
         br.id as br_id, br.client_id as br_cid, au.id as au_id, au.client_id as au_cid
  from public.collections col
  join biz_one b on b.id = col.business_id
  left join public.customers cu on cu.id = col.customer_id
  left join public.branches br on br.id = col.branch_id
  left join public.app_users au on au.id = col.collector_id
),
col_issues as (
  select count(*)::int as total,
         count(*) filter (where coalesce(client_id, '') = '')::int as no_id,
         count(*) filter (where cu_id is null)::int as no_member,
         count(*) filter (where cu_id is not null and cu_biz is distinct from (select id from biz_one))::int as member_other_biz,
         count(*) filter (where cu_id is not null and coalesce(cu_cid, '') = '')::int as member_no_id,
         count(*) filter (where br_id is null)::int as no_branch,
         count(*) filter (where br_id is not null and coalesce(br_cid, '') = '')::int as branch_no_id,
         count(*) filter (where au_id is null)::int as no_collector,
         count(*) filter (where au_id is not null and coalesce(au_cid, '') = '')::int as collector_no_id,
         count(*) filter (where cu_id is not null and br_id is not null and au_id is not null)::int as loads
  from cols
),
dupes as (
  select
    (select count(*) from (select m.client_id from members m where coalesce(m.client_id, '') <> ''
                           group by m.client_id having count(*) > 1) d)::int as customers,
    (select count(*) from (select s.client_id from staff s where coalesce(s.client_id, '') <> ''
                           group by s.client_id having count(*) > 1) d)::int as app_users,
    (select count(*) from (select r.client_id from branch_rows r where coalesce(r.client_id, '') <> ''
                           group by r.client_id having count(*) > 1) d)::int as branches,
    (select count(*) from (select c.client_id from cols c where coalesce(c.client_id, '') <> ''
                           group by c.client_id having count(*) > 1) d)::int as collections
),
table_names (ord, name) as (
  values (1, 'customers'), (2, 'collections'), (3, 'app_users'), (4, 'branches'), (5, 'savings_products'),
         (6, 'ledger_entries'), (7, 'journal_entries'), (8, 'journal_lines'), (9, 'loans'), (10, 'loan_repayments'),
         (11, 'audit_log'), (12, 'receipt_sequences'), (13, 'st_portal_pins'), (14, 'st_portal_requests'),
         (15, 'user_mfa_secrets'), (16, 'st_staff_auth_links'), (17, 'st_staff_activation_codes'),
         (18, 'st_staff_security_events'), (19, 'st_snapshot_financial_ledger'), (20, 'st_member_lifecycle_events')
),
table_counts as (
  select t.ord, t.name,
         case when to_regclass('public.' || t.name) is null then null
              else (xpath('/table/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.name),
                                                               false, false, '')))[1]::text::int end as n
  from table_names t
),

-- 07 JOHN ---------------------------------------------------------------------------------------
john as (
  select s.*, (select count(*) from staff x where x.uname = 'john')::int as n_name
  from staff s
  where s.uname = 'john'
  limit 1
),
john_link as (
  select l.auth_user_id,
         (select count(*) from public.st_staff_auth_links x
           where x.business_code = 'SMILE-TRUST' and x.app_user_id = j.app_id)::int as n_links
  from john j
  left join public.st_staff_auth_links l on l.business_code = 'SMILE-TRUST' and l.app_user_id = j.app_id
  order by l.auth_user_id
  limit 1
),
john_auth as (
  select a.raw_app_meta_data ->> 'business_code' as claim_business,
         a.raw_app_meta_data ->> 'app_role' as claim_role,
         a.raw_app_meta_data ->> 'app_user_id' as claim_app_user,
         a.banned_until
  from john_link l
  join auth.users a on a.id = l.auth_user_id
),
john_cutoff as (
  select case
           when not exists (select 1 from pg_attribute a
                             where a.attrelid = 'public.st_staff_auth_links'::regclass and a.attname = 'sessions_not_before'
                               and not a.attisdropped) then null
           when not exists (select 1 from john) then 0
           else (xpath('/table/row/n/text()', query_to_xml(format(
             'select count(*) as n from public.st_staff_auth_links where business_code = %L and app_user_id = %L and sessions_not_before > now()',
             'SMILE-TRUST', (select app_id from john)), false, false, '')))[1]::text::int
         end as future_cutoffs
),
john_mfa as (
  select count(*)::int as n,
         count(*) filter (where m.enabled is true)::int as enabled,
         count(*) filter (where m.enabled is true and m.confirmed_at is not null and m.confirmed_at <= now() + interval '5 minutes')::int as confirmed
  from public.user_mfa_secrets m
  join biz_one b on b.id = m.business_id
  join john j on m.user_client_id = j.app_id
),
john_attempts as (
  select count(*) filter (where not succeeded and attempted_at > now() - interval '15 minutes')::int as failed_15m,
         max(attempted_at) filter (where not succeeded and attempted_at > now() - interval '15 minutes') as last_failed
  from public.st_staff_login_attempts
  where business_code = 'SMILE-TRUST' and username_key = 'john'
),

-- 08 AMA and KWAME ----------------------------------------------------------------------------
scope_staff (ord, uname, exp_uuid, exp_role) as (
  values (1, 'ama', '6e6667ac-72ce-4f30-9c8e-2fd838988590'::uuid, 'AssistantManager'),
         (2, 'kwame', '3d156d98-3b4a-4024-8a46-1450df386672'::uuid, 'Collector')
),
scope as (
  select sc.ord, sc.uname, sc.exp_uuid, sc.exp_role,
         (select count(*) from staff s where s.uname = sc.uname)::int as n_rows,
         s.id, s.role, s.active, s.no_password,
         (select count(*) from public.st_staff_auth_links l
           where l.business_code = 'SMILE-TRUST' and l.app_user_id = s.app_id)::int as n_links,
         (select count(*) from public.user_mfa_secrets m
           where m.business_id = (select id from biz_one) and m.user_client_id = s.app_id)::int as n_mfa
  from scope_staff sc
  left join lateral (select * from staff x where x.uname = sc.uname order by x.id limit 1) s on true
),
staff_roles as (
  select coalesce(string_agg(role || '=' || n, ', ' order by role), 'none') as summary,
         coalesce(sum(n), 0)::int as total
  from (select role, count(*)::int as n from staff group by role) r
),

checks (section, ord, check_name, status, detail) as (
  select '01 business', 1, 'exactly one SMILE-TRUST business (code or legacy_code)',
         case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end,
         (select count(*) from biz)::text || ' matching business row(s)'
           || case when (select count(*) from biz) = 1 then '' else ': every scoped check below is empty until this is exactly one' end

  -- 02 migration 047 protections ------------------------------------------------------------
  union all
  select '02 047 protections', 1, 'row-level security enabled on the snapshot table',
         case when (select relrowsecurity from snap_rel) is true then 'PASS' else 'FAIL' end,
         case when not exists (select 1 from snap_rel) then 'smile_trust_cloud_snapshots is missing'
              when (select relrowsecurity from snap_rel) then 'enabled'
              else 'DISABLED: any signed-in client could read or overwrite every snapshot' end
  union all
  select '02 047 protections', 2, 'one snapshot per business (unique business_id)',
         case when (select n from snap_unique) >= 1 then 'PASS' else 'FAIL' end,
         case when (select n from snap_unique) >= 1 then 'unique index on business_id present: a second concurrent first snapshot is rejected'
              else 'NO unique index on business_id: two concurrent bootstraps could both succeed' end
  union all
  select '02 047 protections', 3, 'only the three 047 snapshot policies exist, all for signed-in staff',
         case when (select total from policy_state) = 3 and (select expected from policy_state) = 3
                and (select other_roles from policy_state) = 0 then 'PASS' else 'FAIL' end,
         (select summary from policy_state)
           || case when (select other_roles from policy_state) > 0 then '; a policy applies to a role other than authenticated' else '' end
  union all
  select '02 047 protections', 4, 'first write and later writes require the business, a manager role and a live staff identity',
         case when (select insert_ok and update_ok from policy_state) then 'PASS' else 'FAIL' end,
         'first write ' || case when (select insert_ok from policy_state) then 'ok' else 'MISSING a 047 condition' end
           || ', later writes ' || case when (select update_ok from policy_state) then 'ok' else 'MISSING a 047 condition' end
  union all
  select '02 047 protections', 5, 'reads limited to active linked staff of this business',
         case when (select select_ok from policy_state) then 'PASS' else 'FAIL' end,
         case when (select select_ok from policy_state) then 'st_snapshots_select checks business and staff status'
              else 'st_snapshots_select missing or without the 047 staff check' end
  union all
  select '02 047 protections', 6, 'no row-removal or catch-all policy on the snapshot',
         case when (select delete_or_all from policy_state) = 0 then 'PASS' else 'FAIL' end,
         (select delete_or_all from policy_state)::text || ' row-removal/ALL polic(ies)'
  union all
  select '02 047 protections', 7, 'signed-in staff: read, first write and later writes only (cannot remove rows or empty the table)',
         case when not exists (select 1 from snap_rel) then 'FAIL'
              when has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'SELECT')
                and has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'INSERT')
                and has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                and not has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'DELETE')
                and not has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'TRUNCATE') then 'PASS'
              else 'FAIL' end,
         case when not exists (select 1 from snap_rel) then 'table missing'
              else 'select ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'SELECT')
                || ', first write ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'INSERT')
                || ', later write ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                || ', remove rows ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'DELETE')
                || ', empty table ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')
                || ' (expected true, true, true, false, false)' end
  union all
  select '02 047 protections', 8, 'anonymous clients hold no snapshot privilege',
         case when not exists (select 1 from snap_rel) then 'FAIL'
              when not (has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'SELECT')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'INSERT')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'DELETE')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')) then 'PASS'
              else 'FAIL' end,
         case when not exists (select 1 from snap_rel) then 'table missing'
              when not (has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'SELECT')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'INSERT')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'DELETE')
                     or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')) then 'none'
              else 'anon can reach the snapshot table' end
  union all
  select '02 047 protections', 9, 'snapshot guard trigger exists, is enabled and runs before every new or changed row',
         case when (select count(*) from snap_trigger) = 1
                and (select tgenabled from snap_trigger) in ('O', 'A')
                and (select tgtype & 23 from snap_trigger) = 23
                and (select proname from snap_trigger) = 'st_guard_cloud_snapshot' then 'PASS' else 'FAIL' end,
         case when (select count(*) from snap_trigger) = 0 then 'st_guard_cloud_snapshot trigger MISSING: secrets and posted history would not be guarded'
              when (select tgenabled from snap_trigger) not in ('O', 'A') then 'trigger is DISABLED (tgenabled ' || (select tgenabled::text from snap_trigger) || ')'
              when (select tgtype & 23 from snap_trigger) <> 23 then 'trigger timing/events differ from 047 (tgtype ' || (select tgtype from snap_trigger) || ')'
              when (select proname from snap_trigger) is distinct from 'st_guard_cloud_snapshot' then 'trigger calls an unexpected function'
              else 'enabled, before each new or changed row' end
  union all
  select '02 047 protections', 10, 'required 046/047 functions exist',
         case when (select count(*) from fns where oid is null) = 0 then 'PASS' else 'FAIL' end,
         case when (select count(*) from fns where oid is null) = 0 then (select count(*) from fns)::text || '/' || (select count(*) from fns)::text || ' present'
              else 'missing: ' || (select string_agg(sig, ', ' order by sig) from fns where oid is null) end
  union all
  select '02 047 protections', 11, 'manager check accepts SystemOwner',
         case when coalesce((select position('SystemOwner' in prosrc) > 0 from fn_src where sig = 'st_jwt_is_manager()'), false) then 'PASS' else 'FAIL' end,
         case when coalesce((select position('SystemOwner' in prosrc) > 0 from fn_src where sig = 'st_jwt_is_manager()'), false)
              then 'JOHN''s role is a manager role for snapshot writes' else 'st_jwt_is_manager missing or does not list SystemOwner' end
  union all
  select '02 047 protections', 12, 'fetch_business_snapshot is the 046 guarded wrapper',
         case when coalesce((select position('st_assert_business' in prosrc) > 0 and position('st_internal_fetch_business_snapshot' in prosrc) > 0
                             from fn_src where sig = 'fetch_business_snapshot(text)'), false) then 'PASS' else 'FAIL' end,
         case when coalesce((select position('st_assert_business' in prosrc) > 0 from fn_src where sig = 'fetch_business_snapshot(text)'), false)
              then 'checks the caller''s business before loading' else 'missing or not wrapped: the load is not tied to the caller''s business' end
  union all
  select '02 047 protections', 13, 'signed-in staff can call the load, the collector submit and the policy helpers',
         case when (select bool_and(auth_exec) from fn_grants
                     where sig in ('fetch_business_snapshot(text)', 'st_submit_collections(text, jsonb)', 'st_jwt_business_code()',
                                   'st_jwt_is_manager()', 'st_caller_staff_ok()', 'st_tenant_match(uuid)')) then 'PASS' else 'FAIL' end,
         coalesce('not callable by authenticated: ' || (select string_agg(sig, ', ' order by sig) from fn_grants
                     where not auth_exec and sig in ('fetch_business_snapshot(text)', 'st_submit_collections(text, jsonb)', 'st_jwt_business_code()',
                                                     'st_jwt_is_manager()', 'st_caller_staff_ok()', 'st_tenant_match(uuid)')), 'all callable')
  union all
  select '02 047 protections', 14, 'internal load and guard functions are not client-callable; anonymous clients cannot load or submit',
         case when not (select bool_or(auth_exec or anon_exec) from fn_grants
                         where sig in ('st_internal_fetch_business_snapshot(text)', 'st_guard_cloud_snapshot()'))
                and not (select bool_or(anon_exec) from fn_grants
                          where sig in ('fetch_business_snapshot(text)', 'st_submit_collections(text, jsonb)')) then 'PASS' else 'FAIL' end,
         coalesce('client-callable: ' || (select string_agg(sig || case when anon_exec then ' (anon)' else ' (authenticated)' end, ', ' order by sig)
                     from fn_grants
                     where (sig in ('st_internal_fetch_business_snapshot(text)', 'st_guard_cloud_snapshot()') and (auth_exec or anon_exec))
                        or (sig in ('fetch_business_snapshot(text)', 'st_submit_collections(text, jsonb)') and anon_exec)), 'none')
  union all
  select '02 047 protections', 15, 'bootstrap integrity reads: signed-in staff can read the member and collection id columns',
         case when has_column_privilege('authenticated', 'public.customers', 'client_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.customers', 'branch_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.customers', 'collector_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.collections', 'client_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.collections', 'customer_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.collections', 'branch_id', 'SELECT')
                and has_column_privilege('authenticated', 'public.collections', 'collector_id', 'SELECT')
                and coalesce((select n from read_policies where tablename = 'customers'), 0) > 0
                and coalesce((select n from read_policies where tablename = 'collections'), 0) > 0 then 'PASS' else 'FAIL' end,
         'read policies: customers ' || coalesce((select n from read_policies where tablename = 'customers'), 0)
           || ', collections ' || coalesce((select n from read_policies where tablename = 'collections'), 0)
           || '; without them the bootstrap integrity check sees no rows and refuses'

  -- 03 snapshot state ---------------------------------------------------------------------------
  union all
  select '03 snapshot state', 1, 'no SMILE-TRUST cloud snapshot yet (expected 0)',
         case when (select exact_rows from snap) = 0 then 'PASS' else 'FAIL' end,
         (select exact_rows from snap)::text || ' row(s)'
           || case when (select exact_rows from snap) > 0 then ': a cloud copy already exists; the bootstrap refuses, use normal sync instead' else '' end
  union all
  select '03 snapshot state', 2, 'no snapshot row under a case or spacing variant of SMILE-TRUST',
         case when (select variant_rows from snap) = 0 then 'PASS' else 'FAIL' end,
         (select variant_rows from snap)::text || ' variant row(s)'
           || case when (select variant_rows from snap) > 0 then ': leftover or mistyped business key; resolve it before the first snapshot' else '' end
  union all
  select '03 snapshot state', 3, 'no registered posted history for SMILE-TRUST (expected 0)',
         case when (select history_rows from snap) = 0 then 'PASS' else 'FAIL' end,
         case when (select history_rows from snap) is null then 'st_snapshot_financial_ledger missing: 047 is not applied'
              when (select history_rows from snap) = 0 then 'none'
              else (select history_rows from snap)::text || ' record(s): a snapshot was stored before (or a write is in progress); '
                   || 'the guard would reject a bootstrap that omits them' end
  union all
  select '03 snapshot state', 4, 'no member lifecycle events recorded from a snapshot',
         case when coalesce((select snapshot_lifecycle_rows from snap), 0) = 0 then 'PASS' else 'WARN' end,
         case when (select snapshot_lifecycle_rows from snap) is null then 'st_member_lifecycle_events missing (see 03.3)'
              when (select snapshot_lifecycle_rows from snap) = 0 then 'none'
              else (select snapshot_lifecycle_rows from snap)::text || ' event(s): evidence an earlier snapshot existed; find out where it went' end
  union all
  select '03 snapshot state', 5, 'no other session holds a lock on the snapshot table',
         case when (select other_locks from snap) = 0 then 'PASS' else 'WARN' end,
         (select other_locks from snap)::text || ' lock(s) held by other sessions'
           || case when (select other_locks from snap) > 0 then ': a snapshot write may be in progress; re-run before bootstrapping' else '' end
  union all
  select '03 snapshot state', 6, 'snapshot rows for other businesses in this project',
         case when (select other_rows from snap) = 0 then 'INFO' else 'WARN' end,
         (select other_rows from snap)::text || ' row(s)'
           || case when (select other_rows from snap) > 0 then ': this project should hold SMILE-TRUST only' else '' end

  -- 04 relational counts (record these; compare with the bootstrap confirmation and afterwards) --
  union all
  select '04 counts', 1, 'members (SMILE-TRUST)',
         case when (select total from member_issues) = 1 then 'INFO' else 'WARN' end,
         (select total from member_issues)::text || ' (' || (select summary from member_status) || ')'
           || case when (select total from member_issues) = 1 then '' else '; recorded baseline is 1: confirm the change is expected' end
  union all
  select '04 counts', 2, 'collections (SMILE-TRUST)',
         case when (select total from col_issues) = 0 then 'INFO' else 'WARN' end,
         (select total from col_issues)::text
           || case when (select total from col_issues) = 0 then '' else '; recorded baseline is 0: confirm the change is expected' end
  union all
  select '04 counts', 3, 'staff (SMILE-TRUST app_users)',
         case when (select summary from staff_roles) = 'AssistantManager=1, Collector=1, SystemOwner=1' then 'INFO' else 'WARN' end,
         (select total from staff_roles)::text || ' (' || (select summary from staff_roles) || ')'
           || case when (select summary from staff_roles) = 'AssistantManager=1, Collector=1, SystemOwner=1' then ''
                   else '; recorded baseline is AssistantManager=1, Collector=1, SystemOwner=1' end
  union all
  select '04 counts', 4, 'groups (SMILE-TRUST branches)', 'INFO', (select count(*) from branch_rows)::text
  union all
  select '04 counts', 5, 'savings products (SMILE-TRUST)', 'INFO', (select count(*) from product_rows)::text
  union all
  select '04 counts', 6, 'expected bootstrap confirmation summary',
         'INFO',
         'members ' || (select loads from member_issues) || ', staff ' || (select count(*) from staff)
           || ', groups ' || (select count(*) from branch_rows) || ', collections ' || (select loads from col_issues)
           || ', savings products ' || (select count(*) from product_rows)
  union all
  select '04 counts', 6 + t.ord, 'all rows: ' || t.name, 'INFO', coalesce(t.n::text, 'table not present')
  from table_counts t

  -- 05 missing app ids ----------------------------------------------------------------------------
  union all
  select '05 app ids', 1, 'members with NULL or empty client_id (expected 0)',
         case when (select no_id from member_issues) = 0 then 'PASS' else 'FAIL' end,
         (select no_id from member_issues)::text || ' member(s)'
           || case when (select no_id from member_issues) > 0 then ': they would load without an id; the bootstrap refuses' else '' end
  union all
  select '05 app ids', 2, 'branches (groups) with NULL or empty client_id (expected 0)',
         case when (select count(*) from branch_rows where coalesce(client_id, '') = '') = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from branch_rows where coalesce(client_id, '') = '')::text || ' branch(es)'
           || case when (select count(*) from branch_rows where coalesce(client_id, '') = '') > 0
                   then ': groups and every member in them would load without an id; the bootstrap refuses' else '' end
  union all
  select '05 app ids', 3, 'app_users with NULL or empty client_id (expected 0)',
         case when (select count(*) from staff where coalesce(client_id, '') = '') = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from staff where coalesce(client_id, '') = '')::text || ' staff row(s)'
           || case when (select count(*) from staff where coalesce(client_id, '') = '') > 0
                   then ': staff (and members they collect for) would load without an id; the bootstrap refuses' else '' end
  union all
  select '05 app ids', 4, 'collections with NULL or empty client_id (expected 0)',
         case when (select no_id from col_issues) = 0 then 'PASS' else 'FAIL' end,
         (select no_id from col_issues)::text || ' collection(s)'
           || case when (select no_id from col_issues) > 0 then ': they would load without an id; the bootstrap refuses' else '' end
  union all
  select '05 app ids', 5, 'savings products with an empty code',
         case when (select count(*) from product_rows where coalesce(code, '') = '') = 0 then 'PASS' else 'WARN' end,
         (select count(*) from product_rows where coalesce(code, '') = '')::text || ' product(s)'
  union all
  select '05 app ids', 6, 'duplicate client_id values (expected 0)',
         case when (select customers + app_users + branches + collections from dupes) = 0 then 'PASS' else 'FAIL' end,
         'members ' || (select customers from dupes) || ', staff ' || (select app_users from dupes)
           || ', branches ' || (select branches from dupes) || ', collections ' || (select collections from dupes)
           || case when (select customers + app_users + branches + collections from dupes) > 0
                   then ': records sharing an id would overwrite each other in the snapshot' else '' end

  -- 06 relationships required by the bootstrap integrity check -----------------------------------
  union all
  select '06 relationships', 1, 'every member has a branch of this business with an id',
         case when (select no_branch + branch_other_biz + branch_no_id from member_issues) = 0 then 'PASS' else 'FAIL' end,
         'no branch ' || (select no_branch from member_issues) || ', branch in another business ' || (select branch_other_biz from member_issues)
           || ', branch without id ' || (select branch_no_id from member_issues)
  union all
  select '06 relationships', 2, 'every member has a collector of this business with an id',
         case when (select no_collector + collector_other_biz + collector_no_id from member_issues) = 0 then 'PASS' else 'FAIL' end,
         'no collector ' || (select no_collector from member_issues) || ', collector in another business ' || (select collector_other_biz from member_issues)
           || ', collector without id ' || (select collector_no_id from member_issues)
  union all
  select '06 relationships', 3, 'every member appears in the database load',
         case when (select loads = total from member_issues) then 'PASS' else 'FAIL' end,
         (select loads from member_issues)::text || ' of ' || (select total from member_issues)::text || ' member(s) load'
           || case when (select loads <> total from member_issues) then ': the load joins branch and collector, the rest would be dropped; the bootstrap refuses' else '' end
  union all
  select '06 relationships', 4, 'members assigned to an inactive collector',
         case when (select collector_inactive from member_issues) = 0 then 'PASS' else 'WARN' end,
         (select collector_inactive from member_issues)::text || ' member(s)'
           || case when (select collector_inactive from member_issues) > 0 then ': they load, but nobody can collect for them until reassigned' else '' end
  union all
  select '06 relationships', 5, 'every collection has a member, branch and collector with ids',
         case when (select no_member + member_other_biz + member_no_id + no_branch + branch_no_id + no_collector + collector_no_id from col_issues) = 0
              then 'PASS' else 'FAIL' end,
         'no member ' || (select no_member from col_issues) || ', member in another business ' || (select member_other_biz from col_issues)
           || ', member without id ' || (select member_no_id from col_issues) || ', no branch ' || (select no_branch from col_issues)
           || ', branch without id ' || (select branch_no_id from col_issues) || ', no collector ' || (select no_collector from col_issues)
           || ', collector without id ' || (select collector_no_id from col_issues)
  union all
  select '06 relationships', 6, 'every collection appears in the database load',
         case when (select loads = total from col_issues) then 'PASS' else 'FAIL' end,
         (select loads from col_issues)::text || ' of ' || (select total from col_issues)::text || ' collection(s) load'

  -- 07 JOHN (the manager who will run the bootstrap) --------------------------------------------
  union all
  select '07 JOHN', 1, 'exactly one app_users row',
         case when coalesce((select n_name from john), 0) = 1 then 'PASS' else 'FAIL' end,
         coalesce((select n_name from john), 0)::text || ' row(s) named john'
  union all
  select '07 JOHN', 2, 'UUID unchanged',
         case when (select id from john) = 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid then 'PASS' else 'FAIL' end,
         case when (select id from john) = 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid then 'expected uuid' else 'uuid differs or row missing' end
  union all
  select '07 JOHN', 3, 'role SystemOwner and active',
         case when (select role from john) = 'SystemOwner' and (select active from john) is true then 'PASS' else 'FAIL' end,
         coalesce((select role || case when active then ', active' else ', INACTIVE' end from john), 'missing')
  union all
  select '07 JOHN', 4, 'password set (activated)',
         case when (select pbkdf2_password from john) is true then 'PASS' else 'FAIL' end,
         case when (select pbkdf2_password from john) then 'pbkdf2 password present (value not shown)'
              when (select no_password from john) then 'no password: JOHN cannot sign in'
              else 'missing or unrecognised format' end
  union all
  select '07 JOHN', 5, 'exactly one Auth link',
         case when coalesce((select n_links from john_link), 0) = 1 then 'PASS' else 'FAIL' end,
         coalesce((select n_links from john_link), 0)::text || ' link(s)'
  union all
  select '07 JOHN', 6, 'Auth user exists and is not banned',
         case when exists (select 1 from john_auth) and coalesce((select banned_until from john_auth) <= now(), true) then 'PASS' else 'FAIL' end,
         case when not exists (select 1 from john_auth) then 'Auth user missing'
              when coalesce((select banned_until from john_auth) <= now(), true) then 'not banned'
              else 'banned until ' || (select banned_until from john_auth)::text end
  union all
  select '07 JOHN', 7, 'session claims: SMILE-TRUST, SystemOwner, this staff row',
         case when (select claim_business from john_auth) = 'SMILE-TRUST' and (select claim_role from john_auth) = 'SystemOwner'
                and (select claim_app_user from john_auth) = (select app_id from john) then 'PASS' else 'FAIL' end,
         coalesce((select 'business_code=' || coalesce(claim_business, '?') || ', app_role=' || coalesce(claim_role, '?')
                          || ', app_user_id ' || case when claim_app_user = (select app_id from john) then 'matches' else 'DIFFERS' end
                   from john_auth), 'Auth user missing')
  union all
  select '07 JOHN', 8, 'session cutoff not in the future',
         case when (select future_cutoffs from john_cutoff) = 0 then 'PASS' else 'FAIL' end,
         case when (select future_cutoffs from john_cutoff) is null then 'sessions_not_before missing: 047 is not applied'
              when (select future_cutoffs from john_cutoff) = 0 then 'a fresh sign-in is accepted'
              else 'cutoff is in the future: every session would be rejected until it passes' end
  union all
  select '07 JOHN', 9, 'MFA enabled and confirmed',
         case when (select n from john_mfa) = 1 and (select confirmed from john_mfa) = 1 then 'PASS' else 'FAIL' end,
         case when (select n from john_mfa) = 0 then 'not enrolled: managers must sign in with MFA'
              when (select n from john_mfa) > 1 then 'duplicate MFA rows'
              when (select enabled from john_mfa) = 0 then 'setup started but not confirmed'
              when (select confirmed from john_mfa) = 0 then 'enabled without a valid confirmation time'
              else 'enabled and confirmed (secret not read)' end
  union all
  select '07 JOHN', 10, 'not locked out',
         case when (select failed_15m from john_attempts) < 5 then 'PASS' else 'FAIL' end,
         case when (select failed_15m from john_attempts) < 5
              then (select failed_15m from john_attempts)::text || ' failed sign-in(s) in the last 15 minutes (lockout at 5)'
              else 'locked out until about ' || ((select last_failed from john_attempts) + interval '15 minutes')::text || '; wait and re-run' end

  -- 08 AMA and KWAME stay unchanged and not activated -------------------------------------------
  union all
  select '08 ' || upper(sc.uname), 1, 'exactly one row, UUID unchanged',
         case when sc.n_rows = 1 and sc.id = sc.exp_uuid then 'PASS' else 'FAIL' end,
         sc.n_rows::text || ' row(s), ' || case when sc.id = sc.exp_uuid then 'expected uuid' else 'uuid differs or row missing' end
  from scope sc
  union all
  select '08 ' || upper(sc.uname), 2, 'role ' || sc.exp_role || ' and active (unchanged)',
         case when sc.role = sc.exp_role and sc.active is true then 'PASS' else 'FAIL' end,
         coalesce(sc.role || case when sc.active then ', active' else ', INACTIVE' end, 'missing')
  from scope sc
  union all
  select '08 ' || upper(sc.uname), 3, 'still not activated (no password, no Auth link, no MFA)',
         case when sc.id is not null and sc.no_password and sc.n_links = 0 and sc.n_mfa = 0 then 'PASS' else 'FAIL' end,
         case when sc.id is null then 'row missing'
              else case when sc.no_password then 'no password' else 'PASSWORD SET' end
                   || ', ' || sc.n_links || ' Auth link(s), ' || sc.n_mfa || ' MFA row(s)' end
  from scope sc
),
result as (
  select 'VERDICT' as section, 0 as ord, 'overall' as check_name,
         case when exists (select 1 from checks where status = 'FAIL') then 'NOT_READY_FOR_INITIAL_SNAPSHOT'
              else 'READY_FOR_INITIAL_SNAPSHOT' end as status,
         (select count(*) from checks where status = 'FAIL')::text || ' FAIL, '
           || (select count(*) from checks where status = 'WARN')::text || ' WARN, '
           || (select count(*) from checks where status = 'PASS')::text || ' PASS'
           || coalesce('; failing: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord)
                                          from checks where status = 'FAIL'), '')
           || coalesce('; review: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord)
                                         from checks where status = 'WARN'), '') as detail
  union all
  select section, ord::int, check_name, status, detail from checks
)
select section, ord, check_name, status, detail
from result
order by section = 'VERDICT' desc, section, ord;
