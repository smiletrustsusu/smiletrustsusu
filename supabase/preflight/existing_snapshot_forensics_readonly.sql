-- READ-ONLY forensic inspection of the existing SMILE-TRUST row in public.smile_trust_cloud_snapshots.
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Paste the whole file into the Supabase SQL Editor and run it. It returns one result set:
-- one row per finding (section, ord, check_name, status, detail), with the verdict first:
--   EXISTING_SNAPSHOT_SECURITY_CONCERN  credentials or credential-shaped values are stored, the legacy
--                                      access key is set, or posted records bypassed the 047 guard
--   EXISTING_SNAPSHOT_APPEARS_STALE     the snapshot disagrees with the relational database
--   EXISTING_SNAPSHOT_ORIGIN_UNCLEAR    the contents agree, but who wrote it, or when, is not corroborated
--   EXISTING_SNAPSHOT_APPEARS_VALID     contents agree with the database and the origin is corroborated
--   EXISTING_SNAPSHOT_NOT_FOUND         there is no SMILE-TRUST row
-- The most severe finding decides (CONCERN, then STALE, then UNCLEAR). The verdict detail names
-- every finding behind it.
--
-- Statuses: PASS = as expected, CONCERN = security problem, STALE = disagrees with the database,
-- UNCLEAR = origin not corroborated, INFO = recorded evidence only.
--
-- Safety:
--   * The first statement makes the transaction read only; the rest is one SELECT. Nothing is
--     written, no schema object is touched, no application function is invoked.
--   * No business record, name, phone, email or free text is returned: only counts, key names
--     (shape-checked), timestamps, the row id, the business key and a recognised staff username.
--   * Credential values are never returned. Secret-looking keys are reported by name and count,
--     credential-shaped values by count only. The legacy access key and the payload are only
--     inspected, never selected for output. The MFA secret column is never read.
--   * saved_at and saved_by are written by the client; server-side timestamps (sign-in attempts,
--     Auth sessions, security events, registered history) are shown to corroborate them.
--   * The last verification known to report no SMILE-TRUST row was the post-047 verification,
--     reported on 2026-10-02 at 16:15 UTC.

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
staff as (
  select u.id, u.client_id, coalesce(u.client_id, u.id::text) as app_id, lower(u.username) as uname, u.username,
         u.role, u.active
  from public.app_users u
  join biz_one b on b.id = u.business_id
),

-- 01 the row ------------------------------------------------------------------------------------
candidates as (
  select s.id, s.business_id, s.saved_by, s.saved_at,
         coalesce(s.access_key, '') <> '' as legacy_key_set,
         s.payload
  from public.smile_trust_cloud_snapshots s
  where upper(btrim(s.business_id)) = 'SMILE-TRUST'
),
snap as (
  select c.*
  from candidates c
  order by c.business_id = 'SMILE-TRUST' desc, c.saved_at desc
  limit 1
),
pl as (
  select case when jsonb_typeof(s.payload) = 'object' then s.payload else '{}'::jsonb end as p,
         jsonb_typeof(s.payload) as ptype,
         pg_column_size(s.payload) as stored_bytes,
         octet_length(s.payload::text) as text_bytes
  from snap s
),
win as (
  select s.saved_at - interval '12 hours' as lo, s.saved_at + interval '10 minutes' as hi,
         s.saved_at - interval '24 hours' as wide_lo, s.saved_at + interval '24 hours' as wide_hi
  from snap s
),

-- 02/03 structure and counts --------------------------------------------------------------------
top_keys as (
  select k.key, jsonb_typeof(pl.p -> k.key) as t,
         case jsonb_typeof(pl.p -> k.key)
           when 'array' then jsonb_array_length(pl.p -> k.key)::text || ' item(s)'
           when 'object' then (select count(*) from jsonb_object_keys(pl.p -> k.key))::text || ' field(s)'
           else jsonb_typeof(pl.p -> k.key) end as shape
  from pl
  cross join lateral jsonb_object_keys(pl.p) as k(key)
),
arr_names (ord, name, label) as (
  values (1, 'users', 'staff (users)'), (2, 'customers', 'members (customers)'), (3, 'groups', 'groups (branches)'),
         (4, 'collections', 'collections'), (5, 'savingsProducts', 'savings products'), (6, 'loans', 'loans'),
         (7, 'transactions', 'transactions'), (8, 'ledgerEntries', 'ledger entries'),
         (9, 'collectionAdjustments', 'collection adjustments'), (10, 'withdrawalRequests', 'withdrawal requests'),
         (11, 'loanRepayments', 'loan repayments'), (12, 'messages', 'messages'), (13, 'closings', 'closings'),
         (14, 'deletedUsers', 'removed-staff history (deletedUsers)'), (15, 'deletedRecords', 'removed-record history (deletedRecords)'),
         (16, 'audit', 'device audit trail (audit)'), (17, 'offlineQueue', 'offline queue')
),
arr_counts as (
  select a.ord, a.name, a.label,
         case when jsonb_typeof(pl.p -> a.name) = 'array' then jsonb_array_length(pl.p -> a.name) end as n,
         coalesce(jsonb_typeof(pl.p -> a.name), 'absent') as t
  from arr_names a
  cross join pl
),
elems as (
  select k.kind, e.value as v, e.ord
  from pl
  cross join lateral unnest(array['users', 'customers', 'groups', 'collections', 'savingsProducts', 'transactions', 'ledgerEntries', 'loans']) as k(kind)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(pl.p -> k.kind) = 'array' then pl.p -> k.kind else '[]'::jsonb end)
    with ordinality as e(value, ord)
),

-- 04/05 agreement with the relational database --------------------------------------------------
db_ids as (
  select 'customers' as kind, c.client_id as id from public.customers c join biz_one b on b.id = c.business_id
  union all
  select 'users', s.client_id from staff s
  union all
  select 'groups', br.client_id from public.branches br join biz_one b on b.id = br.business_id
  union all
  select 'savingsProducts', sp.code from public.savings_products sp join biz_one b on b.id = sp.business_id
  union all
  select 'collections', col.client_id from public.collections col join biz_one b on b.id = col.business_id
),
snap_ids as (
  select e.kind, case when jsonb_typeof(e.v) = 'object' then e.v ->> 'id' end as id
  from elems e
),
id_match as (
  select k.ord, k.kind, k.label,
         (select count(*) from snap_ids s where s.kind = k.kind)::int as snap_n,
         (select count(*) from db_ids d where d.kind = k.kind)::int as db_n,
         (select count(*) from snap_ids s where s.kind = k.kind and coalesce(s.id, '') = '')::int as no_id,
         (select count(*) from (select s.id from snap_ids s where s.kind = k.kind and coalesce(s.id, '') <> ''
                                group by s.id having count(*) > 1) d)::int as dup,
         (select count(*) from snap_ids s
           where s.kind = k.kind and coalesce(s.id, '') <> ''
             and not exists (select 1 from db_ids d where d.kind = k.kind and d.id = s.id))::int as not_in_db,
         (select count(*) from db_ids d
           where d.kind = k.kind and not exists (select 1 from snap_ids s where s.kind = k.kind and s.id = d.id))::int as missing
  from (values (1, 'customers', 'members'), (2, 'users', 'staff'), (3, 'groups', 'groups'), (4, 'collections', 'collections'),
               (5, 'savingsProducts', 'savings products')) as k(ord, kind, label)
),
baseline (kind, expected) as (
  values ('customers', 1), ('users', 3), ('groups', 1), ('collections', 0), ('savingsProducts', 1)
),
user_diff as (
  select count(*) filter (where s.id is not null
                            and coalesce(e.v ->> 'role', '') <> s.role
                            and coalesce(e.v ->> 'role', '') <> case s.role when 'Owner' then 'KBA' when 'AssistantManager' then 'Admin' else s.role end)::int as role_diff,
         count(*) filter (where s.id is not null
                            and lower(coalesce(e.v ->> 'active', 'true')) <> case when s.active then 'true' else 'false' end)::int as active_diff,
         count(*) filter (where s.id is not null and lower(coalesce(e.v ->> 'username', '')) <> s.uname)::int as username_diff
  from elems e
  left join staff s on s.client_id = e.v ->> 'id'
  where e.kind = 'users' and jsonb_typeof(e.v) = 'object'
),
member_diff as (
  select count(*) filter (where c.id is not null
                            and coalesce(nullif(e.v ->> 'memberStatus', ''),
                                         case when lower(coalesce(e.v ->> 'active', 'true')) = 'false' then 'Closed' else 'Active' end)
                                <> coalesce(c.member_status, 'Active'))::int as status_diff,
         count(*) filter (where c.id is not null and coalesce(e.v ->> 'groupId', '') is distinct from coalesce(br.client_id, ''))::int as group_diff,
         count(*) filter (where c.id is not null and coalesce(e.v ->> 'collectorId', '') is distinct from coalesce(au.client_id, ''))::int as collector_diff
  from elems e
  left join public.customers c on c.client_id = e.v ->> 'id' and c.business_id = (select id from biz_one)
  left join public.branches br on br.id = c.branch_id
  left join public.app_users au on au.id = c.collector_id
  where e.kind = 'customers' and jsonb_typeof(e.v) = 'object'
),
db_financial as (
  select
    (select count(*) from public.collections col join biz_one b on b.id = col.business_id)::int as collections,
    case when to_regclass('public.loans') is null then 0
         else (xpath('/table/row/n/text()', query_to_xml('select count(*) as n from public.loans', false, false, '')))[1]::text::int end as loans,
    case when to_regclass('public.ledger_entries') is null then 0
         else (xpath('/table/row/n/text()', query_to_xml('select count(*) as n from public.ledger_entries', false, false, '')))[1]::text::int end as ledger_entries
),
settings_info as (
  select case when jsonb_typeof(pl.p -> 'settings') = 'object' then pl.p -> 'settings' else '{}'::jsonb end as st
  from pl
),

-- 06 credentials ---------------------------------------------------------------------------------
all_keys as (
  select k.key
  from pl
  cross join lateral jsonb_path_query(pl.p, 'strict $.**') as n(v)
  cross join lateral jsonb_object_keys(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end) as k(key)
),
-- Same key list and suffix rule as public.st_is_secret_key in migration 047.
secret_keys as (
  select a.key, count(*)::int as n
  from all_keys a
  where lower(a.key) = any (array[
      'password', 'passwordhash', 'password_hash', 'passwordhint', 'loginpasswordhint', 'pinhash', 'pin_hash',
      'mfasecret', 'mfa_secret', 'mfapendingsecret', 'totpsecret', 'totp_secret', 'otpsecret', 'secret',
      'activationcode', 'activation_code', 'activationcodes',
      'accesstoken', 'access_token', 'refreshtoken', 'refresh_token', 'sessiontoken', 'session_token', 'idtoken', 'id_token',
      'synctoken', 'syncaccesskey', 'cloudkey', 'accesskey', 'access_key', 'momowebhooksecret', 'webhooksecret',
      'recoverycode', 'recoverycodes', 'recovery_codes', 'backupcodes', 'backup_codes',
      'servicerolekey', 'service_role_key', 'servicekey', 'privatekey', 'private_key', 'portalpin', 'portal_pin'
    ])
    or lower(a.key) ~ '(secret|token|passwordhash|password_hash)$'
  group by a.key
),
sensitive_names as (
  select a.key, count(*)::int as n
  from all_keys a
  where lower(a.key) ~ '(pass|pwd|pin|otp|mfa|credential|apikey|api_key|session|cookie|jwt|salt|hash|auth|activation|recovery)'
    and not exists (select 1 from secret_keys s where s.key = a.key)
  group by a.key
),
value_hits as (
  select
    (select count(*) from regexp_matches(x.t, 'pbkdf2:[0-9]+:', 'g'))::int as pbkdf2,
    (select count(*) from regexp_matches(x.t, '\$2[aby]\$[0-9]{2}\$', 'g'))::int as bcrypt,
    (select count(*) from regexp_matches(x.t, 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}', 'g'))::int as jwt,
    (select count(*) from regexp_matches(x.t, 'sb_secret_', 'g'))::int as sb_secret,
    (select count(*) from regexp_matches(x.t, 'otpauth://', 'g'))::int as otpauth,
    (select count(*) from regexp_matches(x.t, '"[A-Z2-7]{32}"', 'g'))::int as totp_shaped,
    (select count(*) from regexp_matches(x.t, 'sb_publishable_', 'g'))::int as sb_publishable
  from (select pl.p::text as t from pl) x
),
posted as (
  select e.kind, e.v ->> 'id' as id
  from elems e
  where e.kind in ('collections', 'transactions', 'ledgerEntries') and jsonb_typeof(e.v) = 'object' and coalesce(e.v ->> 'id', '') <> ''
),
posted_state as (
  select count(*)::int as total,
         count(*) filter (where not exists (
           select 1 from public.st_snapshot_financial_ledger l
           where l.business_id = (select business_id from snap) and l.kind = x.kind and l.record_id = x.id))::int as unregistered
  from posted x
),

-- 07 format ------------------------------------------------------------------------------------
std_top (key) as (
  values ('settings'), ('groups'), ('users'), ('customers'), ('collections'), ('loans'), ('transactions'), ('messages'),
         ('closings'), ('deletedUsers'), ('deletedRecords'), ('audit'), ('savingsProducts'), ('updatedAt')
),
fetch_fields (kind, key) as (
  values ('users', 'id'), ('users', 'username'), ('users', 'name'), ('users', 'role'), ('users', 'groupId'), ('users', 'active'),
         ('users', 'authEmail'),
         ('customers', 'id'), ('customers', 'accountNo'), ('customers', 'name'), ('customers', 'phone'), ('customers', 'groupId'),
         ('customers', 'collectorId'), ('customers', 'active'), ('customers', 'memberStatus'), ('customers', 'accountType'),
         ('groups', 'id'), ('groups', 'name'), ('groups', 'active'), ('groups', 'collectorCode'),
         ('savingsProducts', 'id'), ('savingsProducts', 'code'), ('savingsProducts', 'name'), ('savingsProducts', 'type'),
         ('savingsProducts', 'collectionType'), ('savingsProducts', 'frequency'), ('savingsProducts', 'minAmountPesewas'),
         ('savingsProducts', 'defaultAmountPesewas'), ('savingsProducts', 'active')
),
rec_keys as (
  select e.kind, k.key
  from elems e
  cross join lateral jsonb_object_keys(case when jsonb_typeof(e.v) = 'object' then e.v else '{}'::jsonb end) as k(key)
  where e.kind in ('users', 'customers', 'groups', 'savingsProducts')
),
local_fields as (
  select r.kind, r.key, count(*)::int as n
  from rec_keys r
  where not exists (select 1 from fetch_fields f where f.kind = r.kind and f.key = r.key)
  group by r.kind, r.key
),
format_state as (
  select
    (select count(*) from top_keys t where not exists (select 1 from std_top s where s.key = t.key))::int as extra_top,
    (select count(*) from local_fields)::int as local_field_names,
    (select coalesce(sum(n), 0) from local_fields)::int as local_field_uses,
    exists (select 1 from top_keys where key = 'savingsProducts') as has_products
),

-- 08 origin evidence ---------------------------------------------------------------------------
actor as (
  select s.*
  from staff s
  join snap on lower(btrim(snap.saved_by)) = s.uname
  order by s.id
  limit 1
),
actor_link as (
  select l.auth_user_id
  from public.st_staff_auth_links l
  join actor a on l.business_code = 'SMILE-TRUST' and l.app_user_id = a.app_id
  order by l.auth_user_id
  limit 1
),
actor_logins as (
  select count(*) filter (where t.succeeded)::int as ok,
         count(*) filter (where not t.succeeded)::int as failed,
         max(t.attempted_at) filter (where t.succeeded) as last_ok
  from public.st_staff_login_attempts t
  join actor a on t.username_key = a.uname
  cross join win w
  where t.business_code = 'SMILE-TRUST' and t.attempted_at between w.lo and w.hi
),
all_logins as (
  select coalesce(string_agg(t.username_key || '=' || t.n, ', ' order by t.username_key), 'none') as summary
  from (select t.username_key, count(*)::int as n
        from public.st_staff_login_attempts t cross join win w
        where t.business_code = 'SMILE-TRUST' and t.succeeded and t.attempted_at between w.lo and w.hi
          and t.username_key ~ '^[a-z0-9._-]{1,40}$'
        group by t.username_key) t
),
actor_sessions as (
  select case
           when to_regclass('auth.sessions') is null then null
           when not exists (select 1 from actor_link) then 0
           else (xpath('/table/row/n/text()', query_to_xml(format(
             'select count(*) as n from auth.sessions where user_id = %L and created_at between %L and %L',
             (select auth_user_id from actor_link), (select lo from win), (select hi from win)), false, false, '')))[1]::text::int
         end as n
),
events_near as (
  select e.event, e.created_at, coalesce(s.uname, 'other') as who
  from public.st_staff_security_events e
  cross join win w
  left join staff s on s.app_id = e.app_user_id
  where e.business_code = 'SMILE-TRUST' and e.created_at between w.wide_lo and w.wide_hi
    and e.event ~ '^[A-Za-z0-9_.:-]{1,64}$'
  order by e.created_at
  limit 20
),
audit_near as (
  select coalesce(string_agg(a.action || '=' || a.n, ', ' order by a.action), 'none') as summary,
         coalesce(sum(a.n), 0)::int as total
  from (select l.action, count(*)::int as n
        from public.audit_log l
        join biz_one b on b.id = l.business_id
        cross join win w
        where l.created_at between w.wide_lo and w.wide_hi and l.action ~ '^[A-Za-z0-9_.:-]{1,64}$'
        group by l.action) a
),
history as (
  select count(*)::int as n, min(l.first_seen_at) as first_seen, max(coalesce(l.changed_at, l.first_seen_at)) as last_seen,
         coalesce(string_agg(distinct coalesce(s.uname, case when l.first_seen_by in ('service', 'database') then l.first_seen_by else 'other' end), ', '), 'none') as by_whom
  from public.st_snapshot_financial_ledger l
  left join staff s on s.app_id = l.first_seen_by
  where upper(btrim(l.business_id)) = 'SMILE-TRUST'
),
lifecycle as (
  select count(*)::int as n, min(created_at) as first_at
  from public.st_member_lifecycle_events
  where business_code = 'SMILE-TRUST' and source = 'snapshot'
),
table_stats as (
  select st.n_tup_ins::bigint as ins, st.n_tup_upd::bigint as upd, st.n_tup_del::bigint as del, st.n_live_tup::bigint as live
  from pg_stat_user_tables st
  where st.relid = to_regclass('public.smile_trust_cloud_snapshots')
),
id_seq as (
  select sq.last_value
  from pg_sequences sq
  where sq.schemaname || '.' || sq.sequencename = pg_get_serial_sequence('public.smile_trust_cloud_snapshots', 'id')
),
john_timeline as (
  select l.created_at as linked_at,
         (select m.confirmed_at from public.user_mfa_secrets m join biz_one b on b.id = m.business_id
           where m.user_client_id = j.app_id and m.enabled order by m.confirmed_at desc nulls last limit 1) as mfa_confirmed_at
  from staff j
  left join public.st_staff_auth_links l on l.business_code = 'SMILE-TRUST' and l.app_user_id = j.app_id
  where j.uname = 'john'
  order by l.created_at
  limit 1
),

checks (section, ord, check_name, status, detail) as (
  -- 01 the row
  select '01 row', 1, 'SMILE-TRUST snapshot rows (expected exactly one)',
         case when (select count(*) from candidates) = 1 and (select business_id from snap) = 'SMILE-TRUST' then 'PASS'
              when (select count(*) from candidates) = 0 then 'INFO'
              else 'UNCLEAR' end,
         (select count(*) from candidates where business_id = 'SMILE-TRUST')::text || ' exact, '
           || (select count(*) from candidates where business_id <> 'SMILE-TRUST')::text || ' case/spacing variant(s); '
           || (select count(*) from public.smile_trust_cloud_snapshots)::text || ' row(s) in the table overall'
  union all
  select '01 row', 2, 'row id', 'INFO', coalesce((select id::text from snap), 'no row')
  union all
  select '01 row', 3, 'business_id', 'INFO',
         coalesce((select case when business_id ~ '^[A-Za-z0-9 _-]{1,40}$' then '"' || business_id || '"'
                               else 'unusual value (' || length(business_id) || ' chars, not shown)' end from snap), 'no row')
  union all
  select '01 row', 4, 'saved_at (written by the client)', 'INFO', coalesce((select saved_at::text from snap), 'no row')
  union all
  select '01 row', 5, 'saved_by (written by the client)',
         case when not exists (select 1 from snap) then 'INFO'
              when exists (select 1 from actor) then 'PASS'
              else 'UNCLEAR' end,
         case when not exists (select 1 from snap) then 'no row'
              when exists (select 1 from actor) then (select username || ' (staff, ' || role || case when active then ', active' else ', INACTIVE' end || ')' from actor)
              when lower(btrim((select saved_by from snap))) in ('system', 'service', 'database')
                then lower(btrim((select saved_by from snap))) || ': not a staff member (the old client writes system when no user is signed in)'
              else 'unrecognised value (' || length((select saved_by from snap)) || ' chars, not shown)' end
  union all
  select '01 row', 6, 'legacy access_key column empty',
         case when not exists (select 1 from snap) then 'INFO' when (select legacy_key_set from snap) then 'CONCERN' else 'PASS' end,
         case when not exists (select 1 from snap) then 'no row'
              when (select legacy_key_set from snap) then 'SET: a legacy shared sync key is stored with the row (value not shown)'
              else 'empty' end
  union all
  select '01 row', 7, 'payload size', 'INFO',
         coalesce((select text_bytes::text || ' bytes as JSON text, ' || stored_bytes::text || ' bytes stored' from pl), 'no row')
  union all
  select '01 row', 8, 'payload is a JSON object',
         case when not exists (select 1 from snap) then 'INFO' when (select ptype from pl) = 'object' then 'PASS' else 'STALE' end,
         coalesce((select ptype from pl), 'no row')

  -- 02 top-level keys
  union all
  select '02 top-level keys', (row_number() over (order by t.key))::int,
         case when t.key ~ '^[A-Za-z_][A-Za-z0-9_]{0,63}$' then t.key else '(unusual key, ' || length(t.key) || ' chars)' end,
         'INFO', t.shape
  from top_keys t

  -- 03 counts inside the snapshot
  union all
  select '03 snapshot contents', a.ord, a.label, 'INFO',
         case when a.t = 'absent' then 'absent' when a.n is null then 'present but not a list (' || a.t || ')' else a.n::text end
  from arr_counts a

  -- 04 comparison with the relational database
  union all
  select '04 vs database', m.ord, m.label || ': snapshot vs database',
         case when not exists (select 1 from snap) then 'INFO' when m.snap_n = m.db_n then 'PASS' else 'STALE' end,
         'snapshot ' || m.snap_n || ', database ' || m.db_n || ', recorded baseline ' || b.expected
           || case when m.db_n <> b.expected then ' (the database itself has moved off the baseline)' else '' end
  from id_match m
  join baseline b on b.kind = m.kind
  union all
  select '04 vs database', 6, 'loans, transactions and ledger entries vs database',
         case when not exists (select 1 from snap) then 'INFO'
              when (select coalesce(sum(n), 0) from arr_counts where name in ('loans', 'transactions', 'ledgerEntries')) > 0
                and (select collections + loans + ledger_entries from db_financial) = 0 then 'STALE'
              else 'PASS' end,
         'snapshot loans ' || coalesce((select n from arr_counts where name = 'loans'), 0)
           || ', transactions ' || coalesce((select n from arr_counts where name = 'transactions'), 0)
           || ', ledger entries ' || coalesce((select n from arr_counts where name = 'ledgerEntries'), 0)
           || '; database collections ' || (select collections from db_financial) || ', loans ' || (select loans from db_financial)
           || ', ledger entries ' || (select ledger_entries from db_financial)

  -- 05 record-level agreement (counts only; no record is shown)
  union all
  select '05 records', m.ord, m.label || ': ids agree with the database',
         case when not exists (select 1 from snap) then 'INFO'
              when m.no_id + m.dup + m.not_in_db + m.missing = 0 then 'PASS' else 'STALE' end,
         'in snapshot but not in database ' || m.not_in_db || ', in database but not in snapshot ' || m.missing
           || ', without id ' || m.no_id || ', duplicate ids ' || m.dup
  from id_match m
  union all
  select '05 records', 6, 'staff role, active flag and username agree with the database',
         case when not exists (select 1 from snap) then 'INFO'
              when (select role_diff + active_diff + username_diff from user_diff) = 0 then 'PASS' else 'STALE' end,
         'role differs ' || (select role_diff from user_diff) || ', active differs ' || (select active_diff from user_diff)
           || ', username differs ' || (select username_diff from user_diff)
  union all
  select '05 records', 7, 'member status, group and collector agree with the database',
         case when not exists (select 1 from snap) then 'INFO'
              when (select status_diff + group_diff + collector_diff from member_diff) = 0 then 'PASS' else 'STALE' end,
         'status differs ' || (select status_diff from member_diff) || ', group differs ' || (select group_diff from member_diff)
           || ', collector differs ' || (select collector_diff from member_diff)
  union all
  select '05 records', 8, 'settings.businessId is SMILE-TRUST',
         case when not exists (select 1 from snap) then 'INFO'
              when (select st ->> 'businessId' from settings_info) = 'SMILE-TRUST' then 'PASS'
              when coalesce((select st ->> 'businessId' from settings_info), '') = '' then 'UNCLEAR'
              else 'STALE' end,
         case when not exists (select 1 from snap) then 'no row'
              when coalesce((select st ->> 'businessId' from settings_info), '') = '' then 'not set in the snapshot settings'
              when (select st ->> 'businessId' from settings_info) ~ '^[A-Za-z0-9 _-]{1,40}$' then '"' || (select st ->> 'businessId' from settings_info) || '"'
              else 'unusual value (not shown)' end

  -- 06 credentials (names and counts only)
  union all
  select '06 credentials', 1, 'no secret keys anywhere in the payload (047 key list)',
         case when not exists (select 1 from snap) then 'INFO' when (select count(*) from secret_keys) = 0 then 'PASS' else 'CONCERN' end,
         coalesce((select string_agg(case when key ~ '^[A-Za-z_][A-Za-z0-9_]{0,63}$' then key else '(unusual key)' end || ' x' || n, ', ' order by key)
                   from secret_keys) || ': the 047 guard strips these on every write, so this row was stored without it (values not shown)', 'none')
  union all
  select '06 credentials', 2, 'no credential-shaped values (password hashes, JWTs, server keys, authenticator URIs)',
         case when not exists (select 1 from snap) then 'INFO'
              when (select pbkdf2 + bcrypt + jwt + sb_secret + otpauth from value_hits) = 0 then 'PASS' else 'CONCERN' end,
         (select 'pbkdf2 hashes ' || pbkdf2 || ', bcrypt hashes ' || bcrypt || ', JWTs ' || jwt || ', server secret keys ' || sb_secret
                 || ', otpauth URIs ' || otpauth from value_hits) || ' (counts only)'
  union all
  select '06 credentials', 3, 'no strings shaped like an authenticator (TOTP) secret',
         case when not exists (select 1 from snap) then 'INFO' when (select totp_shaped from value_hits) = 0 then 'PASS' else 'UNCLEAR' end,
         (select totp_shaped from value_hits)::text || ' string(s) of exactly 32 base32 characters (could be an id; values not shown)'
  union all
  select '06 credentials', 4, 'other sensitive-looking key names (review)', 'INFO',
         coalesce((select string_agg(case when key ~ '^[A-Za-z_][A-Za-z0-9_]{0,63}$' then key else '(unusual key)' end || ' x' || n, ', ' order by key)
                   from sensitive_names), 'none')
           || '; publishable client keys ' || coalesce((select sb_publishable from value_hits), 0)
  union all
  select '06 credentials', 5, 'every posted record in the payload is registered by the 047 guard',
         case when not exists (select 1 from snap) then 'INFO' when (select unregistered from posted_state) = 0 then 'PASS' else 'CONCERN' end,
         (select total from posted_state)::text || ' posted record(s), ' || (select unregistered from posted_state)::text || ' unregistered'
           || case when (select unregistered from posted_state) > 0 then ': stored without the 047 guard, or its history was removed' else '' end

  -- 07 format
  union all
  select '07 format', 1, 'structure', 'INFO',
         case when not exists (select 1 from snap) then 'no row'
              when (select extra_top = 0 and local_field_names = 0 and has_products from format_state)
                and (select st ->> 'businessId' from settings_info) = 'SMILE-TRUST'
                then 'matches the database-load bootstrap format of commit 11be35b (database fields only)'
              when (select extra_top = 0 and local_field_names = 0 from format_state)
                then 'database fields only, but not exactly the 11be35b bootstrap shape'
              else 'resembles the older full device-state format: ' || (select extra_top from format_state) || ' extra top-level key(s), '
                   || (select local_field_names from format_state) || ' device-only field name(s) used ' || (select local_field_uses from format_state) || ' time(s)' end
  union all
  select '07 format', 2, 'extra top-level keys (not in the default device state)', 'INFO',
         coalesce((select string_agg(case when t.key ~ '^[A-Za-z_][A-Za-z0-9_]{0,63}$' then t.key else '(unusual key)' end, ', ' order by t.key)
                   from top_keys t where not exists (select 1 from std_top s where s.key = t.key)), 'none')
  union all
  select '07 format', 3, 'device-only fields on staff, member, group and product records (names only)', 'INFO',
         coalesce((select string_agg(kind || '.' || case when key ~ '^[A-Za-z_][A-Za-z0-9_]{0,63}$' then key else '(unusual key)' end || ' x' || n, ', '
                                     order by kind, key) from local_fields), 'none')

  -- 08 origin evidence
  union all
  select '08 origin', 1, 'saved_by is staff of this business with a manager role',
         case when not exists (select 1 from snap) then 'INFO'
              when (select role from actor) in ('SystemOwner', 'Owner', 'KBA', 'Admin', 'AssistantManager', 'ManagingDirector', 'Accountant') then 'PASS'
              else 'UNCLEAR' end,
         case when not exists (select 1 from snap) then 'no row'
              when not exists (select 1 from actor) then 'saved_by does not name a staff member'
              else (select username || ' is ' || role from actor) end
  union all
  select '08 origin', 2, 'saved_at is not in the future',
         case when not exists (select 1 from snap) then 'INFO' when (select saved_at from snap) <= now() + interval '5 minutes' then 'PASS' else 'UNCLEAR' end,
         case when not exists (select 1 from snap) then 'no row'
              when (select saved_at from snap) <= now() + interval '5 minutes' then 'saved ' || date_trunc('minute', now() - (select saved_at from snap))::text || ' ago'
              else 'saved_at is in the future: the writing device''s clock or value is wrong' end
  union all
  select '08 origin', 3, 'saved_at is after the last verification that found no row (2026-10-02 16:15 UTC)',
         case when not exists (select 1 from snap) then 'INFO'
              when (select saved_at from snap) >= '2026-10-02 16:15:00+00'::timestamptz then 'PASS' else 'UNCLEAR' end,
         case when not exists (select 1 from snap) then 'no row'
              when (select saved_at from snap) >= '2026-10-02 16:15:00+00'::timestamptz then 'consistent with the row appearing after that verification'
              else 'saved_at predates a verification that found no row: the client-written timestamp is not trustworthy' end
  union all
  select '08 origin', 4, 'saved_by signed in shortly before saved_at (server-recorded)',
         case when not exists (select 1 from snap) then 'INFO'
              when not exists (select 1 from actor) then 'UNCLEAR'
              when coalesce((select ok from actor_logins), 0) > 0 then 'PASS'
              else 'UNCLEAR' end,
         case when not exists (select 1 from snap) then 'no row'
              when not exists (select 1 from actor) then 'no staff member to check'
              else coalesce((select ok from actor_logins), 0)::text || ' successful and ' || coalesce((select failed from actor_logins), 0)::text
                   || ' failed sign-in(s) from 12 hours before to 10 minutes after saved_at'
                   || coalesce('; last success ' || (select last_ok from actor_logins)::text, '') end
  union all
  select '08 origin', 5, 'all successful staff sign-ins in that window', 'INFO',
         case when not exists (select 1 from snap) then 'no row' else (select summary from all_logins) end
  union all
  select '08 origin', 6, 'Auth sessions for saved_by started in that window', 'INFO',
         case when not exists (select 1 from snap) then 'no row'
              when (select n from actor_sessions) is null then 'auth.sessions not available'
              when not exists (select 1 from actor_link) then 'saved_by has no Auth link'
              else (select n from actor_sessions)::text || ' session(s)' end
  union all
  select '08 origin', 7, 'staff security events within 24 hours of saved_at', 'INFO',
         case when not exists (select 1 from snap) then 'no row'
              else coalesce((select string_agg(event || ' by ' || who || ' at ' || created_at::text, '; ' order by created_at) from events_near), 'none') end
  union all
  select '08 origin', 8, 'business audit_log actions within 24 hours of saved_at', 'INFO',
         case when not exists (select 1 from snap) then 'no row' else (select summary from audit_near) end
  union all
  select '08 origin', 9, 'posted history registered by the 047 guard (server time)', 'INFO',
         (select n::text || ' record(s)' || coalesce(', first seen ' || first_seen::text || ', last changed ' || last_seen::text || ', by ' || by_whom, '') from history)
  union all
  select '08 origin', 10, 'member lifecycle events recorded from a snapshot (server time)', 'INFO',
         (select n::text || ' event(s)' || coalesce(', first at ' || first_at::text, '') from lifecycle)
  union all
  select '08 origin', 11, 'snapshot table activity since statistics were last cleared', 'INFO',
         coalesce((select 'rows written ' || ins || ', rewritten ' || upd || ', removed ' || del || ', live ' || live from table_stats), 'not available')
           || case when coalesce((select upd from table_stats), 0) > 0 then ' (the row has been rewritten after it was first stored)' else '' end
  union all
  select '08 origin', 12, 'row id vs identity sequence', 'INFO',
         case when not exists (select 1 from snap) then 'no row'
              when (select last_value from id_seq) is null then 'row id ' || (select id from snap) || '; sequence value not visible'
              else 'row id ' || (select id from snap) || ', highest id ever issued ' || (select last_value from id_seq)
                   || case when (select last_value from id_seq) > (select id from snap)
                           then ' (later write attempts consumed ids: rejected first writes, conflicts or removed rows)' else '' end end

  -- 09 JOHN timeline (server-recorded)
  union all
  select '09 JOHN timeline', 1, 'Auth link created', 'INFO', coalesce((select linked_at::text from john_timeline), 'none')
  union all
  select '09 JOHN timeline', 2, 'MFA confirmed', 'INFO', coalesce((select mfa_confirmed_at::text from john_timeline), 'none')
  union all
  select '09 JOHN timeline', 3, 'snapshot saved_at relative to JOHN''s MFA confirmation', 'INFO',
         case when not exists (select 1 from snap) then 'no row'
              when (select mfa_confirmed_at from john_timeline) is null then 'JOHN has no confirmed MFA'
              when (select saved_at from snap) >= (select mfa_confirmed_at from john_timeline)
                then 'saved ' || date_trunc('second', (select saved_at from snap) - (select mfa_confirmed_at from john_timeline))::text || ' after MFA confirmation'
              else 'saved ' || date_trunc('second', (select mfa_confirmed_at from john_timeline) - (select saved_at from snap))::text || ' before MFA confirmation' end
),
result as (
  select 'VERDICT' as section, 0 as ord, 'overall' as check_name,
         case when not exists (select 1 from candidates) then 'EXISTING_SNAPSHOT_NOT_FOUND'
              when exists (select 1 from checks where status = 'CONCERN') then 'EXISTING_SNAPSHOT_SECURITY_CONCERN'
              when exists (select 1 from checks where status = 'STALE') then 'EXISTING_SNAPSHOT_APPEARS_STALE'
              when exists (select 1 from checks where status = 'UNCLEAR') then 'EXISTING_SNAPSHOT_ORIGIN_UNCLEAR'
              else 'EXISTING_SNAPSHOT_APPEARS_VALID' end as status,
         (select count(*) from checks where status = 'CONCERN')::text || ' CONCERN, '
           || (select count(*) from checks where status = 'STALE')::text || ' STALE, '
           || (select count(*) from checks where status = 'UNCLEAR')::text || ' UNCLEAR, '
           || (select count(*) from checks where status = 'PASS')::text || ' PASS'
           || coalesce('; concern: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord) from checks where status = 'CONCERN'), '')
           || coalesce('; stale: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord) from checks where status = 'STALE'), '')
           || coalesce('; unclear: ' || (select string_agg(section || ' / ' || check_name, '; ' order by section, ord) from checks where status = 'UNCLEAR'), '') as detail
  union all
  select section, ord::int, check_name, status, coalesce(detail, 'no row') from checks
)
select section, ord, check_name, status, detail
from result
order by section = 'VERDICT' desc, section, ord;
