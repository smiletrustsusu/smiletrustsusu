-- READ-ONLY checkpoint for the controlled recovery of the stale SMILE-TRUST cloud snapshot.
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Run it, unchanged, at every checkpoint of docs/recovery/STALE-SNAPSHOT-RECOVERY-RUNBOOK.md
-- (Supabase SQL Editor, or psql). It returns one result set (section, ord, check_name, status,
-- detail), verdict first. The verdict names the recovery phase it found:
--   STALE_SNAPSHOT_READY_TO_RETIRE         exactly the stale row inspected on 2026-10-04 is present,
--                                          and nothing would cascade from its removal
--   STALE_SNAPSHOT_NOT_READY_TO_RETIRE     the stale row is present but a safety check failed
--   SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP   no snapshot row; protections intact; database as expected
--   SNAPSHOT_ABSENT_NOT_READY              no snapshot row, but a safety check failed
--   INITIAL_SNAPSHOT_VERIFIED              one new database-bootstrap snapshot that agrees with the
--                                          database, saved by JOHN, without secrets
--   INITIAL_SNAPSHOT_NOT_VERIFIED_STOP     one new bootstrap-format snapshot that fails a check
--   UNKNOWN_SNAPSHOT_STOP                  one row that is neither the inspected stale row nor a
--                                          bootstrap snapshot (it changed, or another client wrote it)
--   UNEXPECTED_SNAPSHOT_ROWS_STOP          more than one row, other businesses' rows or key variants
--
-- Section 06 prints the CORE RELATIONAL FINGERPRINT: an MD5 over the row count and contents of every
-- public table except the snapshot table and the sign-in / telemetry tables listed in section 07
-- (which legitimately change when JOHN signs in). Columns whose names look like credentials, plus
-- last_login_at, last_used_step and user_mfa_secrets.updated_at, are left out of the digest and never
-- read. Record the value at the first checkpoint: it must be identical at every later checkpoint.
--
-- Statuses: PASS, FAIL, INFO (evidence only), N/A (not applicable to the phase found).
--
-- Safety: the first statement makes the transaction read only; the rest is one SELECT. Nothing is
-- written, no schema object is touched, no application function is invoked. No payload content,
-- business record, name, phone, credential or MFA value is returned: only counts, key names,
-- timestamps, the row id, a recognised staff username and SHA-256 / MD5 fingerprints.

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
  select u.client_id, lower(u.username) as uname, u.role, u.active
  from public.app_users u
  join biz_one b on b.id = u.business_id
),

-- 01/02 the rows -------------------------------------------------------------------------------
row_counts as (
  select count(*)::int as total,
         count(*) filter (where s.business_id = 'SMILE-TRUST')::int as exact,
         count(*) filter (where upper(btrim(s.business_id)) = 'SMILE-TRUST' and s.business_id <> 'SMILE-TRUST')::int as variants
  from public.smile_trust_cloud_snapshots s
),
snap as (
  select s.id, s.saved_by, s.saved_at, coalesce(s.access_key, '') <> '' as legacy_key_set,
         case when jsonb_typeof(s.payload) = 'object' then s.payload else '{}'::jsonb end as p,
         encode(sha256(convert_to(s.payload::text, 'UTF8')), 'hex') as fp,
         octet_length(s.payload::text) as text_bytes
  from public.smile_trust_cloud_snapshots s
  where s.business_id = 'SMILE-TRUST'
  order by s.id
  limit 1
),
table_activity as (
  select st.n_tup_ins::bigint as ins, st.n_tup_upd::bigint as upd, st.n_tup_del::bigint as del, st.n_live_tup::bigint as live
  from pg_stat_user_tables st
  where st.schemaname = 'public' and st.relname = 'smile_trust_cloud_snapshots'
),
-- saved_by holds either the saver's username or, when the client session carried no username, the
-- saver's app user id (app_users.client_id, the id st_staff_auth_links.app_user_id links to the Auth
-- user). It resolves to a staff member only through exactly one of the two, never both:
--   username   exactly one SMILE-TRUST staff username matches, and no app user anywhere has that id;
--   linked id  no username matches, exactly one app user anywhere has that client_id and it is
--              SMILE-TRUST staff, and exactly one auth link anywhere carries that id, for SMILE-TRUST.
-- Anything else (no match, several matches, both kinds, a missing or extra link) resolves to nobody.
saver_match as (
  select (select count(*) from staff st where st.uname = lower(btrim(s.saved_by)))::int as by_name,
         (select count(*) from staff st where st.client_id = s.saved_by)::int as by_id,
         (select count(*) from public.app_users u where u.client_id = s.saved_by)::int as by_id_anywhere,
         (select count(*) from public.st_staff_auth_links l where l.app_user_id = s.saved_by)::int as links_anywhere,
         (select count(*) from public.st_staff_auth_links l
           where l.app_user_id = s.saved_by and l.business_code = 'SMILE-TRUST')::int as links_here
  from snap s
),
saver_user as (
  select st.uname, st.role, st.active, m.by_name = 1 as via_name
  from snap s
  cross join saver_match m
  join staff st
    on (m.by_name = 1 and m.by_id_anywhere = 0 and st.uname = lower(btrim(s.saved_by)))
    or (m.by_name = 0 and m.by_id = 1 and m.by_id_anywhere = 1 and m.links_anywhere = 1 and m.links_here = 1
        and st.client_id = s.saved_by)
),
saver as (
  select case when s.id is null then null
              when lower(btrim(s.saved_by)) = 'system' then 'system'
              when (select count(*) from saver_user) = 1
                then (select u.uname || ' (staff, ' || u.role || ', ' || case when u.active then 'active' else 'inactive' end || ')'
                             || case when u.via_name then '' else ' through the linked staff id (id not shown)' end
                      from saver_user u)
              when m.by_name + m.by_id_anywhere + m.links_anywhere > 0
                then 'unresolved staff identity: ' || m.by_name || ' username match(es), ' || m.by_id_anywhere
                     || ' app user id match(es), ' || m.links_anywhere || ' auth link(s) (' || length(coalesce(s.saved_by, '')) || ' chars, not shown)'
              else 'unrecognised value (' || length(coalesce(s.saved_by, '')) || ' chars, not shown)' end as label,
         (select count(*) from saver_user) = 1
           and exists (select 1 from saver_user u where u.uname = 'john' and u.role = 'SystemOwner' and u.active) as is_john
  from snap s
  cross join saver_match m
),

-- contents --------------------------------------------------------------------------------------
top_keys as (
  select k.key
  from snap
  cross join lateral jsonb_object_keys(snap.p) as k(key)
),
counts as (
  select
    case when jsonb_typeof(p -> 'customers') = 'array' then jsonb_array_length(p -> 'customers') end as members,
    case when jsonb_typeof(p -> 'users') = 'array' then jsonb_array_length(p -> 'users') end as staff_n,
    case when jsonb_typeof(p -> 'groups') = 'array' then jsonb_array_length(p -> 'groups') end as groups_n,
    case when jsonb_typeof(p -> 'collections') = 'array' then jsonb_array_length(p -> 'collections') end as collections_n,
    case when jsonb_typeof(p -> 'savingsProducts') = 'array' then jsonb_array_length(p -> 'savingsProducts') end as products_n,
    (select count(*) from top_keys)::int as top_n
  from snap
),
elems as (
  select k.kind, e.value as v
  from snap
  cross join lateral unnest(array['users', 'customers', 'groups', 'collections', 'savingsProducts']) as k(kind)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(snap.p -> k.kind) = 'array' then snap.p -> k.kind else '[]'::jsonb end) as e(value)
),
other_modules as (
  select count(*) filter (where jsonb_typeof(snap.p -> m.name) = 'array' and jsonb_array_length(snap.p -> m.name) > 0)::int as non_empty,
         coalesce(string_agg(m.name, ', ' order by m.name)
                    filter (where jsonb_typeof(snap.p -> m.name) = 'array' and jsonb_array_length(snap.p -> m.name) > 0), 'none') as names
  from snap
  cross join unnest(array['loans', 'transactions', 'messages', 'closings', 'deletedUsers', 'deletedRecords', 'audit']) as m(name)
),

-- agreement with the relational database -------------------------------------------------------
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
db_counts as (
  select count(*) filter (where kind = 'customers')::int as members,
         count(*) filter (where kind = 'users')::int as staff_n,
         count(*) filter (where kind = 'groups')::int as groups_n,
         count(*) filter (where kind = 'collections')::int as collections_n,
         count(*) filter (where kind = 'savingsProducts')::int as products_n
  from db_ids
),
snap_ids as (
  select e.kind, case when jsonb_typeof(e.v) = 'object' then e.v ->> 'id' end as id
  from elems e
),
id_match as (
  select
    (select count(*) from snap_ids s where coalesce(s.id, '') = '')::int as no_id,
    (select count(*) from (select s.kind, s.id from snap_ids s where coalesce(s.id, '') <> '' group by s.kind, s.id having count(*) > 1) d)::int as dup,
    (select count(*) from snap_ids s
      where coalesce(s.id, '') <> '' and not exists (select 1 from db_ids d where d.kind = s.kind and d.id = s.id))::int as not_in_db,
    (select count(*) from db_ids d
      where not exists (select 1 from snap_ids s where s.kind = d.kind and s.id = d.id))::int as missing
),

-- credentials (same key list and suffix rule as public.st_is_secret_key in migration 047) -------
all_keys as (
  select k.key
  from snap
  cross join lateral jsonb_path_query(snap.p, 'strict $.**') as n(v)
  cross join lateral jsonb_object_keys(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end) as k(key)
),
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
value_hits as (
  select
    (select count(*) from regexp_matches(x.t, 'pbkdf2:[0-9]+:', 'g'))::int
      + (select count(*) from regexp_matches(x.t, '\$2[aby]\$[0-9]{2}\$', 'g'))::int
      + (select count(*) from regexp_matches(x.t, 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}', 'g'))::int
      + (select count(*) from regexp_matches(x.t, 'sb_secret_', 'g'))::int
      + (select count(*) from regexp_matches(x.t, 'otpauth://', 'g'))::int as credential_values,
    (select count(*) from regexp_matches(x.t, '"[A-Z2-7]{32}"', 'g'))::int as totp_shaped
  from (select snap.p::text as t from snap) x
),

-- format ---------------------------------------------------------------------------------------
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
format_state as (
  select
    (select count(*) from top_keys t where not exists (select 1 from std_top s where s.key = t.key))::int as extra_top,
    (select count(*) from std_top s where not exists (select 1 from top_keys t where t.key = s.key))::int as missing_top,
    (select count(distinct e.kind || '.' || k.key)
       from elems e
       cross join lateral jsonb_object_keys(case when jsonb_typeof(e.v) = 'object' then e.v else '{}'::jsonb end) as k(key)
      where e.kind <> 'collections'
        and not exists (select 1 from fetch_fields f where f.kind = e.kind and f.key = k.key))::int as device_fields
),

-- phase -----------------------------------------------------------------------------------------
stale_id as (
  select s.id = 1 as id_ok,
         lower(btrim(coalesce(s.saved_by, ''))) = 'john' as by_ok,
         date_trunc('milliseconds', s.saved_at) = timestamptz '2026-10-03 13:07:46.196+00' as at_ok,
         c.staff_n = 4 and c.members = 1 and c.groups_n = 1 and c.collections_n = 0 and c.products_n = 14 as counts_ok,
         (f.extra_top > 0 or f.missing_top > 0 or f.device_fields > 0) as old_format
  from snap s cross join counts c cross join format_state f
),
phase as (
  select case
           when r.total = 0 then 'ABSENT'
           when r.total > 1 or r.exact <> 1 or r.variants > 0 then 'UNEXPECTED'
           when (select id_ok and by_ok and at_ok and counts_ok and old_format from stale_id) then 'STALE'
           when (select s.id > 1 and s.saved_at > timestamptz '2026-10-03 13:07:46.196+00' from snap s)
                and (select extra_top = 0 and missing_top = 0 and device_fields = 0 from format_state) then 'BOOTSTRAPPED'
           else 'OTHER'
         end as ph
  from row_counts r
),

-- protections and cascade safety ----------------------------------------------------------------
snap_rel as (
  select c.oid, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'smile_trust_cloud_snapshots'
),
pols as (
  select count(*)::int as n,
         count(*) filter (where p.polname in ('st_snapshots_select', 'st_snapshots_insert', 'st_snapshots_update'))::int as expected_n,
         count(*) filter (where p.polcmd in ('d', '*'))::int as removal_or_all,
         coalesce(string_agg(p.polname || ':' || p.polcmd::text, ', ' order by p.polname), 'none') as names
  from pg_policy p join snap_rel r on p.polrelid = r.oid
),
trg as (
  select count(*) filter (where p.proname = 'st_guard_cloud_snapshot' and t.tgenabled in ('O', 'A') and (t.tgtype::int & 23) = 23)::int as guard_ok,
         count(*) filter (where (t.tgtype::int & 40) <> 0)::int as on_removal
  from pg_trigger t
  join snap_rel r on t.tgrelid = r.oid
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
),
fk_refs as (
  select count(*)::int as n
  from pg_constraint k join snap_rel r on k.confrelid = r.oid
  where k.contype = 'f'
),
history as (
  select (select count(*) from public.st_snapshot_financial_ledger l where upper(btrim(l.business_id)) = 'SMILE-TRUST')::int as ledger_n,
         (select count(*) from public.st_member_lifecycle_events e where upper(btrim(e.business_code)) = 'SMILE-TRUST')::int as lifecycle_n
),

-- 06/07 relational fingerprint ------------------------------------------------------------------
rel_cols as (
  select c.relname::text as t,
         c.relname::text not in ('smile_trust_cloud_snapshots', 'st_staff_login_attempts', 'st_staff_security_events',
                                 'st_staff_auth_links', 'audit_log', 'sessions', 'st_portal_attempts', 'st_portal_sessions',
                                 'st_portal_requests') as core,
         string_agg(quote_ident(a.attname), ', ' order by a.attnum)
           filter (where not (a.attname ~* '(secret|token|hash|passw|otp|mfa|api_?key|private|signature|^pin|_pin|pin_)'
                              or a.attname in ('last_login_at', 'last_used_step')
                              or (c.relname = 'user_mfa_secrets' and a.attname = 'updated_at'))) as cols
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
  group by c.relname
),
rel_digest as (
  select r.t, r.core,
         (xpath('/table/row/n/text()', x.q))[1]::text::bigint as n,
         (xpath('/table/row/d/text()', x.q))[1]::text as d
  from rel_cols r
  cross join lateral (select query_to_xml(format(
    'select count(*) as n, coalesce(md5(string_agg(x, chr(10) order by x collate "C")), ''none'') as d from (select row(%s)::text as x from public.%I) q',
    coalesce(r.cols, 'null'), r.t), false, false, '') as q) x
),
core_fp as (
  select md5(string_agg(t || ':' || n::text || ':' || d, ',' order by t)) as fp, count(*)::int as tables_n, coalesce(sum(n), 0)::bigint as rows_n
  from rel_digest where core
),

checks (section, ord, check_name, status, detail) as (
  -- 01 phase
  select '01 phase', 1, 'snapshot rows in the table (expected at most one, SMILE-TRUST only)',
         case when r.total > 1 or r.variants > 0 or r.total <> r.exact then 'FAIL' else 'PASS' end,
         'total ' || r.total || ', SMILE-TRUST ' || r.exact || ', case/spacing variants ' || r.variants
  from row_counts r
  union all
  select '01 phase', 2, 'recovery phase found', 'INFO',
         case (select ph from phase)
           when 'ABSENT' then 'no snapshot row'
           when 'STALE' then 'the stale row inspected on 2026-10-04 (id 1, saved by john at 2026-10-03 13:07:46.196 UTC)'
           when 'BOOTSTRAPPED' then 'a new row in the database-bootstrap format'
           when 'OTHER' then 'one row that is neither the inspected stale row nor a database-bootstrap snapshot'
           else 'unexpected rows' end
  union all
  select '01 phase', 3, 'snapshot table activity counters (server statistics; compare between checkpoints)', 'INFO',
         coalesce((select 'new rows ' || ins || ', changed rows ' || upd || ', removed rows ' || del || ', live ' || live from table_activity), 'none')

  -- 02 the row
  union all
  select '02 row', 1, 'row id', 'INFO', coalesce((select id::text from snap), 'no row')
  union all
  select '02 row', 2, 'saved_by (written by the client)', 'INFO', coalesce((select label from saver), 'no row')
  union all
  select '02 row', 3, 'saved_at (written by the client, UTC, milliseconds)', 'INFO',
         coalesce((select to_char(saved_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') from snap), 'no row')
  union all
  select '02 row', 4, 'legacy access_key column empty',
         case when not exists (select 1 from snap) then 'N/A' when (select legacy_key_set from snap) then 'FAIL' else 'PASS' end,
         case when not exists (select 1 from snap) then 'no row' when (select legacy_key_set from snap) then 'set (value not shown)' else 'empty' end
  union all
  select '02 row', 5, 'PAYLOAD FINGERPRINT (SHA-256 of the stored JSON text)', 'INFO', coalesce((select fp from snap), 'no row')
  union all
  select '02 row', 6, 'payload size and top-level keys', 'INFO',
         coalesce((select s.text_bytes || ' bytes as JSON text, ' || c.top_n || ' top-level key(s)' from snap s cross join counts c), 'no row')
  union all
  select '02 row', 7, 'contents: members, staff, groups, collections, savings products', 'INFO',
         coalesce((select 'members ' || coalesce(members::text, 'absent') || ', staff ' || coalesce(staff_n::text, 'absent')
                     || ', groups ' || coalesce(groups_n::text, 'absent') || ', collections ' || coalesce(collections_n::text, 'absent')
                     || ', savings products ' || coalesce(products_n::text, 'absent') from counts), 'no row')
  union all
  select '02 row', 8, 'format', 'INFO',
         coalesce((select case when extra_top = 0 and missing_top = 0 and device_fields = 0
                                 then 'database-bootstrap format of commit 11be35b'
                               else 'older full device-state format: ' || extra_top || ' extra top-level key(s), ' || missing_top
                                    || ' bootstrap key(s) missing, ' || device_fields || ' device-only record field name(s)' end
                   from format_state where exists (select 1 from snap)), 'no row')

  -- 03 stale-row identity (values recorded by the 2026-10-04 forensic inspection)
  union all
  select '03 stale identity', o.ord, o.label,
         case when (select ph from phase) in ('ABSENT', 'UNEXPECTED') then 'N/A'
              when (select ph from phase) = 'BOOTSTRAPPED' then 'INFO'
              when o.ok then 'PASS' else 'FAIL' end,
         case when not exists (select 1 from snap) then 'no row' when o.ok then 'matches' else 'differs' end
  from stale_id s
  cross join lateral (values
    (1, 'row id is 1', s.id_ok),
    (2, 'saved_by is john', s.by_ok),
    (3, 'saved_at is 2026-10-03 13:07:46.196 UTC', s.at_ok),
    (4, 'contents: staff 4, members 1, groups 1, collections 0, savings products 14', s.counts_ok),
    (5, 'older full device-state format', s.old_format)) as o(ord, label, ok)
  union all
  select '03 stale identity', 0, 'stale-row identity', 'N/A', 'no row'
  where not exists (select 1 from snap)

  -- 04 initial snapshot (expected after the protected Initial Cloud Snapshot)
  union all
  select '04 initial snapshot', o.ord, o.label,
         case when (select ph from phase) in ('ABSENT', 'UNEXPECTED') then 'N/A'
              when (select ph from phase) = 'STALE' then 'INFO'
              when o.ok then 'PASS' else 'FAIL' end,
         o.detail
  from (select 1 as one) z
  cross join lateral (values
    (1, 'a new row (id above 1, saved after the stale row)',
        coalesce((select s.id > 1 and s.saved_at > timestamptz '2026-10-03 13:07:46.196+00' from snap s), false),
        coalesce((select 'id ' || id from snap), 'no row')),
    (2, 'saved_by is JOHN (staff, SystemOwner, active)', coalesce((select is_john from saver), false),
        coalesce((select label from saver), 'no row')),
    (3, 'database-bootstrap format: exactly the bootstrap top-level keys, record fields only from the database load',
        coalesce((select extra_top = 0 and missing_top = 0 and device_fields = 0 from format_state where exists (select 1 from snap)), false),
        coalesce((select 'extra top-level keys ' || extra_top || ', missing ' || missing_top || ', device-only record field names ' || device_fields
                  from format_state where exists (select 1 from snap)), 'no row')),
    (4, 'counts are members 1, staff 3, groups 1, collections 0, savings products 1',
        coalesce((select members = 1 and staff_n = 3 and groups_n = 1 and collections_n = 0 and products_n = 1 from counts), false),
        coalesce((select 'members ' || coalesce(members::text, 'absent') || ', staff ' || coalesce(staff_n::text, 'absent')
                    || ', groups ' || coalesce(groups_n::text, 'absent') || ', collections ' || coalesce(collections_n::text, 'absent')
                    || ', savings products ' || coalesce(products_n::text, 'absent') from counts), 'no row')),
    (5, 'counts equal the database now',
        coalesce((select c.members = d.members and c.staff_n = d.staff_n and c.groups_n = d.groups_n and c.collections_n = d.collections_n
                         and c.products_n = d.products_n from counts c cross join db_counts d), false),
        coalesce((select 'snapshot ' || coalesce(c.members::text, '-') || '/' || coalesce(c.staff_n::text, '-') || '/' || coalesce(c.groups_n::text, '-')
                    || '/' || coalesce(c.collections_n::text, '-') || '/' || coalesce(c.products_n::text, '-')
                    || ', database ' || d.members || '/' || d.staff_n || '/' || d.groups_n || '/' || d.collections_n || '/' || d.products_n
                    || ' (members/staff/groups/collections/savings products)' from counts c cross join db_counts d), 'no row')),
    (6, 'record ids agree with the database both ways (members, staff, groups, collections, savings products)',
        coalesce((select no_id = 0 and dup = 0 and not_in_db = 0 and missing = 0 from id_match where exists (select 1 from snap)), false),
        coalesce((select 'in snapshot but not in database ' || not_in_db || ', in database but not in snapshot ' || missing
                    || ', without id ' || no_id || ', duplicate ids ' || dup from id_match where exists (select 1 from snap)), 'no row')),
    (7, 'every other module is empty (loans, transactions, messages, closings, removal histories, device audit)',
        coalesce((select non_empty = 0 from other_modules), false),
        coalesce((select 'non-empty: ' || names from other_modules), 'no row')),
    (8, 'settings.businessId is SMILE-TRUST',
        coalesce((select p -> 'settings' ->> 'businessId' = 'SMILE-TRUST' from snap), false),
        coalesce((select case when p -> 'settings' ->> 'businessId' = 'SMILE-TRUST' then 'SMILE-TRUST' else 'differs' end from snap), 'no row'))
  ) as o(ord, label, ok, detail)

  -- 05 safety: secrets, history, 047 protections, removal side effects
  union all
  select '05 safety', 1, 'no secret keys anywhere in the payload (047 key list)',
         case when not exists (select 1 from snap) then 'N/A' when exists (select 1 from secret_keys) then 'FAIL' else 'PASS' end,
         case when not exists (select 1 from snap) then 'no row'
              else coalesce((select string_agg(case when key ~ '^[A-Za-z0-9_]{1,40}$' then key else '(unusual key)' end || ' x' || n, ', ' order by key)
                             from secret_keys), 'none') end
  union all
  select '05 safety', 2, 'no credential-shaped values (password hashes, JWTs, server keys, authenticator URIs, TOTP-shaped strings)',
         case when not exists (select 1 from snap) then 'N/A'
              when (select credential_values + totp_shaped from value_hits) > 0 then 'FAIL' else 'PASS' end,
         coalesce((select 'credential-shaped ' || credential_values || ', TOTP-shaped ' || totp_shaped || ' (counts only)' from value_hits), 'no row')
  union all
  select '05 safety', 3, 'no posted history registered from snapshots (st_snapshot_financial_ledger)',
         case when ledger_n = 0 then 'PASS' else 'FAIL' end, ledger_n || ' record(s)' from history
  union all
  select '05 safety', 4, 'no member lifecycle events recorded for SMILE-TRUST',
         case when lifecycle_n = 0 then 'PASS' else 'FAIL' end, lifecycle_n || ' event(s)' from history
  union all
  select '05 safety', 5, 'row-level security enabled on the snapshot table',
         case when (select relrowsecurity from snap_rel) then 'PASS' else 'FAIL' end,
         coalesce((select case when relrowsecurity then 'enabled' else 'DISABLED' end from snap_rel), 'snapshot table missing')
  union all
  select '05 safety', 6, 'only the three 047 snapshot policies; none for removal or all commands',
         case when n = 3 and expected_n = 3 and removal_or_all = 0 then 'PASS' else 'FAIL' end, names from pols
  union all
  select '05 safety', 7, 'signed-in staff: read, first write and later write only (no removal or emptying)',
         case when has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'SELECT')
                and has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'INSERT')
                and has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                and not has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'DELETE')
                and not has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'TRUNCATE') then 'PASS' else 'FAIL' end,
         'removal ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'DELETE')
           || ', emptying ' || has_table_privilege('authenticated', 'public.smile_trust_cloud_snapshots', 'TRUNCATE')
  union all
  select '05 safety', 8, 'anonymous clients hold no snapshot privilege',
         case when has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'SELECT')
                or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'INSERT')
                or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'UPDATE')
                or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'DELETE')
                or has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'TRUNCATE') then 'FAIL' else 'PASS' end,
         'checked read, first write, later write, removal, emptying'
  union all
  select '05 safety', 9, 'the 047 guard is enabled and runs before every new or changed row',
         case when guard_ok = 1 then 'PASS' else 'FAIL' end, guard_ok || ' enabled guard(s)' from trg
  union all
  select '05 safety', 10, 'nothing runs on row removal or emptying of the snapshot table',
         case when on_removal = 0 then 'PASS' else 'FAIL' end, on_removal || ' handler(s)' from trg
  union all
  select '05 safety', 11, 'no foreign key references the snapshot table (removal cannot cascade)',
         case when n = 0 then 'PASS' else 'FAIL' end, n || ' reference(s)' from fk_refs

  -- 06 relational database
  union all
  select '06 relational', 1, 'database counts are members 1, staff 3, groups 1, collections 0, savings products 1',
         case when members = 1 and staff_n = 3 and groups_n = 1 and collections_n = 0 and products_n = 1 then 'PASS' else 'FAIL' end,
         'members ' || members || ', staff ' || staff_n || ', groups ' || groups_n || ', collections ' || collections_n
           || ', savings products ' || products_n
  from db_counts
  union all
  select '06 relational', 2, 'CORE RELATIONAL FINGERPRINT (must be identical at every checkpoint)', 'INFO',
         fp || ' (' || tables_n || ' tables, ' || rows_n || ' rows)' from core_fp
  union all
  select '06 relational', (2 + row_number() over (order by t))::int, 'core table ' || t, 'INFO',
         'rows ' || n || ', digest ' || left(d, 12)
  from rel_digest where core and n > 0

  -- 07 sign-in and telemetry tables (excluded from the fingerprint; they change when JOHN signs in)
  union all
  select '07 sign-in tables', (row_number() over (order by t))::int, t, 'INFO', 'rows ' || n
  from rel_digest where not core and t <> 'smile_trust_cloud_snapshots'
),
result as (
  select 'VERDICT' as section, 0 as ord, 'overall' as check_name,
         case p.ph
           when 'UNEXPECTED' then 'UNEXPECTED_SNAPSHOT_ROWS_STOP'
           when 'OTHER' then 'UNKNOWN_SNAPSHOT_STOP'
           when 'STALE' then case when f.n = 0 then 'STALE_SNAPSHOT_READY_TO_RETIRE' else 'STALE_SNAPSHOT_NOT_READY_TO_RETIRE' end
           when 'ABSENT' then case when f.n = 0 then 'SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP' else 'SNAPSHOT_ABSENT_NOT_READY' end
           else case when f.n = 0 then 'INITIAL_SNAPSHOT_VERIFIED' else 'INITIAL_SNAPSHOT_NOT_VERIFIED_STOP' end
         end as status,
         f.n || ' FAIL, ' || (select count(*) from checks where status = 'PASS') || ' PASS; phase ' || p.ph
           || coalesce('; failed: ' || f.names, '') as detail
  from phase p
  cross join (select count(*)::int as n, string_agg(section || ' / ' || check_name, '; ' order by section, ord) as names
              from checks where status = 'FAIL') f
  union all
  select section, ord::int, check_name, status, coalesce(detail, 'no row') from checks
)
select section, ord, check_name, status, detail
from result
order by section = 'VERDICT' desc, section, ord;
