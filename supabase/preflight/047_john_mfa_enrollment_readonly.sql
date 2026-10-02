-- READ-ONLY verification of JOHN's server-side MFA enrollment (after migration 047 and the
-- staff-login deployment that enforces MFA enrollment for privileged roles).
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Paste the whole file into the Supabase SQL Editor and run it. It returns one result set:
-- one row per check (section, check, status, detail), with the overall verdict in the first row:
--   JOHN_MFA_VERIFIED      no check has status FAIL (review every WARN)
--   JOHN_MFA_NOT_VERIFIED  at least one FAIL (before enrollment this is the expected answer)
--
-- Statuses: PASS = as designed, FAIL = not enrolled / unsafe / out of scope, WARN = needs a human
-- decision, INFO = recorded only.
--
-- Safety:
--   * SELECT only. The first statement makes the transaction read-only. No INSERT/UPDATE/DELETE/DDL.
--   * Never returns the TOTP secret, password hashes, activation codes, Auth emails, tokens or keys.
--     The secret is only compared (format, and whether it appears inside any stored log text).

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
           else 'unrecognised'
         end as pw_format
  from public.app_users u
  join biz b on b.id = u.business_id
),
john as (
  select s.*,
         (select count(*) from staff x where x.uname = 'john')::int as n_name
  from staff s
  where s.uname = 'john'
  limit 1
),
john_link as (
  select l.auth_user_id, l.sessions_not_before,
         (select count(*) from public.st_staff_auth_links x
           where x.business_code = 'SMILE-TRUST' and x.app_user_id = j.app_id)::int as n_links
  from john j
  left join public.st_staff_auth_links l
    on l.business_code = 'SMILE-TRUST' and l.app_user_id = j.app_id
  order by l.auth_user_id
  limit 1
),
john_auth as (
  select a.raw_app_meta_data as meta, a.banned_until
  from john_link l
  join auth.users a on a.id = l.auth_user_id
),
mfa as (
  select m.secret, m.enabled, m.confirmed_at, m.last_used_step, m.updated_at
  from public.user_mfa_secrets m
  join john j on j.business_id = m.business_id and m.user_client_id = j.app_id
),
mfa_count as (
  select count(*)::int as n from mfa
),
mfa_stage as (
  select case
           when (select n from mfa_count) = 0 then 'not enrolled'
           when (select n from mfa_count) > 1 then 'duplicate rows'
           when (select enabled from mfa) is true then 'enabled'
           else 'pending (setup started, code not confirmed)'
         end as stage
),
events as (
  select e.event, e.created_at, e.details
  from public.st_staff_security_events e
  join john j on e.app_user_id = j.app_id
  where e.business_code = 'SMILE-TRUST'
),
event_summary as (
  select count(*) filter (where event = 'mfa_enroll_started')::int as started,
         count(*) filter (where event = 'mfa_enrolled')::int as enrolled,
         count(*) filter (where event = 'mfa_reset')::int as resets,
         max(created_at) filter (where event = 'mfa_enroll_started') as last_started,
         max(created_at) filter (where event = 'mfa_enrolled') as last_enrolled,
         max(created_at) filter (where event = 'mfa_reset') as last_reset
  from events
),
secret_leaks as (
  select
    (select count(*) from public.st_staff_security_events e, mfa m
      where length(m.secret) >= 16 and position(m.secret in e.details::text) > 0)::int as in_events,
    (select count(*) from public.audit_log a, mfa m
      where length(m.secret) >= 16 and position(m.secret in to_jsonb(a)::text) > 0)::int as in_audit,
    (select count(*) from public.smile_trust_cloud_snapshots s, mfa m
      where length(m.secret) >= 16 and position(m.secret in s.payload::text) > 0)::int as in_snapshots,
    (select count(*) from public.st_staff_login_attempts t, mfa m
      where length(m.secret) >= 16 and position(m.secret in to_jsonb(t)::text) > 0)::int as in_attempts
),
attempts as (
  select count(*) filter (where succeeded and attempted_at > now() - interval '24 hours')::int as ok_24h,
         count(*) filter (where not succeeded and attempted_at > now() - interval '24 hours')::int as failed_24h,
         count(*) filter (where not succeeded and attempted_at > now() - interval '15 minutes')::int as failed_15m,
         max(attempted_at) filter (where not succeeded and attempted_at > now() - interval '15 minutes') as last_failed
  from public.st_staff_login_attempts
  where business_code = 'SMILE-TRUST' and username_key = 'john'
),
others_mfa as (
  select count(*)::int as n
  from public.user_mfa_secrets m
  join biz b on b.id = m.business_id
  where m.user_client_id is distinct from (select app_id from john)
),
scope_staff (uname, exp_uuid) as (
  values ('ama', '6e6667ac-72ce-4f30-9c8e-2fd838988590'::uuid), ('kwame', '3d156d98-3b4a-4024-8a46-1450df386672'::uuid)
),
scope as (
  select sc.uname, s.id, s.pw_format,
         (select count(*) from public.st_staff_auth_links l
           where l.business_code = 'SMILE-TRUST' and l.app_user_id = s.app_id)::int as n_links
  from scope_staff sc
  left join staff s on s.uname = sc.uname
),
staff_counts as (
  select coalesce(string_agg(role || '=' || n, ', ' order by role), 'none') as summary,
         coalesce(bool_and(n = 1), false) and count(*) = 3
           and bool_or(role = 'SystemOwner') and bool_or(role = 'AssistantManager') and bool_or(role = 'Collector') as matches
  from (select role, count(*)::int as n from staff group by role) r
),
checks (section, ord, check_name, status, detail) as (
  select '01 business', 1, 'SMILE-TRUST business',
         case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end,
         (select count(*) from biz)::text || ' matching business row(s)'

  union all
  select '02 JOHN', 1, 'single app_users row',
         case when (select count(*) from john) = 1 and (select n_name from john) = 1 then 'PASS' else 'FAIL' end,
         coalesce((select n_name from john), 0)::text || ' row(s) named john'
  union all
  select '02 JOHN', 2, 'uuid preserved',
         case when (select id from john) = 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid then 'PASS' else 'FAIL' end,
         case when (select id from john) = 'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid then 'expected uuid' else 'uuid differs or row missing' end
  union all
  select '02 JOHN', 3, 'role and status',
         case when (select role from john) = 'SystemOwner' and (select active from john) is true then 'PASS' else 'FAIL' end,
         coalesce((select role || case when active then ', active' else ', INACTIVE' end from john), 'missing')
  union all
  select '02 JOHN', 4, 'password hash format',
         case when (select pw_format from john) = 'pbkdf2' then 'PASS' else 'FAIL' end,
         coalesce((select pw_format from john), 'missing')

  union all
  select '03 JOHN Auth', 1, 'one Auth link',
         case when coalesce((select n_links from john_link), 0) = 1 then 'PASS' else 'FAIL' end,
         coalesce((select n_links from john_link), 0)::text || ' link(s)'
  union all
  select '03 JOHN Auth', 2, 'session claims',
         case when (select meta ->> 'business_code' from john_auth) = 'SMILE-TRUST'
                and (select meta ->> 'app_user_id' from john_auth) = (select app_id from john)
                and (select meta ->> 'app_role' from john_auth) = 'SystemOwner' then 'PASS' else 'FAIL' end,
         coalesce((select 'business_code=' || coalesce(meta ->> 'business_code', '?') || ', app_role=' || coalesce(meta ->> 'app_role', '?')
                          || ', app_user_id ' || case when meta ->> 'app_user_id' = (select app_id from john) then 'matches' else 'DIFFERS' end
                   from john_auth), 'Auth user missing')
  union all
  select '03 JOHN Auth', 3, 'not banned',
         case when exists (select 1 from john_auth) and coalesce((select banned_until from john_auth) <= now(), true) then 'PASS' else 'FAIL' end,
         case when not exists (select 1 from john_auth) then 'Auth user missing'
              when coalesce((select banned_until from john_auth) <= now(), true) then 'not banned'
              else 'banned until ' || (select banned_until from john_auth)::text end
  union all
  select '03 JOHN Auth', 4, 'session cutoff',
         case when (select sessions_not_before from john_link) = 'epoch'::timestamptz then 'PASS' else 'WARN' end,
         case when (select sessions_not_before from john_link) = 'epoch'::timestamptz then 'unchanged (no MFA reset, deactivation or role change)'
              else 'moved to ' || coalesce((select sessions_not_before from john_link)::text, 'missing')
                   || ' (expected after an MFA reset; sessions issued before it are rejected)' end

  union all
  select '04 MFA', 1, 'enrollment state',
         case when (select stage from mfa_stage) = 'enabled' then 'PASS' else 'FAIL' end,
         (select stage from mfa_stage)
  union all
  select '04 MFA', 2, 'confirmed',
         case when (select n from mfa_count) = 1 and (select confirmed_at from mfa) is not null
                and (select confirmed_at from mfa) <= now() + interval '5 minutes' then 'PASS' else 'FAIL' end,
         case when (select n from mfa_count) <> 1 then 'no single MFA row'
              when (select confirmed_at from mfa) is null then 'confirmed_at is empty'
              else 'confirmed at ' || (select confirmed_at from mfa)::text end
  union all
  select '04 MFA', 3, 'secret format (value not shown)',
         case when (select n from mfa_count) = 1 and (select secret from mfa) ~ '^[A-Z2-7]{32}$' then 'PASS' else 'FAIL' end,
         case when (select n from mfa_count) <> 1 then 'no single MFA row'
              when (select secret from mfa) ~ '^[A-Z2-7]{32}$' then '160-bit base32 secret present'
              else 'unexpected secret format' end
  union all
  select '04 MFA', 4, 'replay marker (last used code step)',
         case when (select n from mfa_count) = 1 and (select last_used_step from mfa) is not null
                and (select last_used_step from mfa) * 30 between extract(epoch from (select confirmed_at from mfa)) - 90
                                                              and extract(epoch from now()) + 90 then 'PASS' else 'FAIL' end,
         case when (select n from mfa_count) <> 1 then 'no single MFA row'
              when (select last_used_step from mfa) is null then 'last_used_step is empty: replay protection has no marker'
              when (select last_used_step from mfa) * 30 > extract(epoch from now()) + 90 then 'last used step is in the future'
              when (select last_used_step from mfa) * 30 < extract(epoch from (select confirmed_at from mfa)) - 90 then 'last used step is older than the confirmation'
              else 'last code used at ' || to_timestamp((select last_used_step from mfa) * 30)::text end

  union all
  select '05 events', 1, 'enrollment started logged',
         case when (select started from event_summary) >= 1 then 'PASS' else 'FAIL' end,
         (select started from event_summary)::text || ' mfa_enroll_started event(s)'
  union all
  select '05 events', 2, 'enrollment confirmed logged',
         case when (select enrolled from event_summary) = 1 then 'PASS'
              when (select enrolled from event_summary) > 1 then 'WARN'
              else 'FAIL' end,
         (select enrolled from event_summary)::text || ' mfa_enrolled event(s)'
           || case when (select enrolled from event_summary) > 1 then ' (re-enrolled; check the reset reasons)' else '' end
  union all
  select '05 events', 3, 'MFA resets',
         case when (select resets from event_summary) = 0 then 'INFO'
              when (select last_reset from event_summary) > coalesce((select last_enrolled from event_summary), '-infinity') then 'FAIL'
              else 'WARN' end,
         (select resets from event_summary)::text || ' mfa_reset event(s)'
           || case when (select last_reset from event_summary) > coalesce((select last_enrolled from event_summary), '-infinity')
                   then ' (the latest reset is after the latest enrollment)' else '' end

  union all
  select '06 secret hygiene', 1, 'secret absent from logs and snapshots',
         case when (select in_events + in_audit + in_snapshots + in_attempts from secret_leaks) = 0 then 'PASS' else 'FAIL' end,
         'security events ' || (select in_events from secret_leaks) || ', audit_log ' || (select in_audit from secret_leaks)
           || ', snapshots ' || (select in_snapshots from secret_leaks) || ', login attempts ' || (select in_attempts from secret_leaks)
  union all
  select '06 secret hygiene', 2, 'clients cannot read MFA secrets',
         case when not has_table_privilege('anon', 'public.user_mfa_secrets', 'SELECT')
                and not has_table_privilege('authenticated', 'public.user_mfa_secrets', 'SELECT') then 'PASS' else 'FAIL' end,
         'anon/authenticated SELECT on user_mfa_secrets'

  union all
  select '07 sign-in', 1, 'attempts in the last 24 hours',
         'INFO',
         (select ok_24h from attempts)::text || ' succeeded, ' || (select failed_24h from attempts)::text || ' failed'
  union all
  select '07 sign-in', 2, 'lockout',
         case when (select failed_15m from attempts) < 5 then 'PASS' else 'WARN' end,
         case when (select failed_15m from attempts) < 5 then (select failed_15m from attempts)::text || ' failure(s) in the last 15 minutes (lockout at 5)'
              else 'locked out until about ' || ((select last_failed from attempts) + interval '15 minutes')::text end

  union all
  select '08 scope', 1, 'no other MFA rows',
         case when (select n from others_mfa) = 0 then 'PASS' else 'WARN' end,
         (select n from others_mfa)::text || ' MFA row(s) for other staff'
  union all
  select '08 scope', 1 + row_number() over (order by sc.uname), upper(sc.uname) || ' still not activated',
         case when sc.id is not null and sc.pw_format = 'none' and sc.n_links = 0 then 'PASS' else 'FAIL' end,
         case when sc.id is null then 'row missing'
              else 'password ' || sc.pw_format || ', ' || sc.n_links || ' Auth link(s)' end
  from scope sc
  union all
  select '08 scope', 4, 'staff roles unchanged',
         case when (select matches from staff_counts) then 'PASS' else 'FAIL' end,
         (select summary from staff_counts)
),
result as (
  select 'VERDICT' as section, 0 as ord, 'overall' as check_name,
         case when exists (select 1 from checks where status = 'FAIL') then 'JOHN_MFA_NOT_VERIFIED' else 'JOHN_MFA_VERIFIED' end as status,
         (select count(*) from checks where status = 'FAIL')::text || ' FAIL, '
           || (select count(*) from checks where status = 'WARN')::text || ' WARN, '
           || (select count(*) from checks where status = 'PASS')::text || ' PASS; MFA stage: ' || (select stage from mfa_stage) as detail
  union all
  select section, ord::int, check_name, status, detail from checks
)
select section, ord, check_name, status, detail
from result
order by section = 'VERDICT' desc, section, ord;
