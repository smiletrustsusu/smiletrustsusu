-- READ-ONLY production preflight, run immediately before applying migration 048
-- (supabase/migrations/048_server_receipt_allocation.sql, commit 168f525).
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Run it as ONE read-only transaction:
--   * psql:          psql -X -1 -v ON_ERROR_STOP=1 -f 048_production_preflight_readonly.sql
--   * SQL Editor:    paste the whole file and run it.
-- It returns one result set, one row per check (section, ord, check_name, status, detail), with the
-- overall verdict first:
--   READY_FOR_048     no check has status FAIL (review every WARN before applying 048)
--   NOT_READY_FOR_048 at least one FAIL; the verdict detail names each failing check
--
-- Statuses: PASS = as required, FAIL = blocks 048, WARN = needs a human decision, INFO = recorded for
-- the post-048 comparison (supabase/preflight/048_post_migration_readonly.sql).
--
-- Safety:
--   * The first statement makes the transaction read only; the rest is one SELECT. Nothing is
--     written, no schema object is changed, no application function is invoked.
--   * The only dynamic SQL is read-only counting/digesting (query_to_xml) for the relational
--     fingerprint and the snapshot table.
--   * Returns counts, receipt prefixes (branch codes such as ACC/RCP), numeric maxima and digests only:
--     no member names, phone numbers, payment references, payloads, password/MFA data or keys.

set transaction read only;

with
biz as (
  select b.id, b.code from public.businesses b
  where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
),

-- 02 migrations 046/047 present and 048 absent ----------------------------------------------------
fn as (
  -- Bodies are compared with line endings normalised: production stores CRLF bodies (SQL Editor).
  select p.oid, p.oid::regprocedure::text as sig, p.proname, md5(replace(p.prosrc, E'\r\n', E'\n')) as h, p.prosrc as src, p.prosecdef
  from pg_proc p where p.pronamespace = 'public'::regnamespace
),
need_fn (ord, sig) as (
  values (1, 'st_is_service_role()'), (2, 'st_is_trusted_session()'), (3, 'st_jwt_is_owner()'),
         (4, 'st_assert_business(text)'), (5, 'st_scope_staff_payload(jsonb)'),
         (6, 'st_internal_import_snapshot_batch(text,jsonb)'), (7, 'st_internal_record_collection_from_client(jsonb)'),
         (8, 'record_collection_from_client(jsonb)'), (9, 'import_snapshot_batch(text,jsonb)'),
         (10, 'resolve_business_id(text)'), (11, 'next_receipt_no(uuid,text)')
),
missing_fn as (
  select string_agg(n.sig, ', ' order by n.ord) as list, count(*)::int as n
  from need_fn n where not exists (select 1 from fn where fn.sig = n.sig)
),
helper_fn as (
  select (select count(*) from fn where proname = 'ensure_branch' and (select pronargs from pg_proc where oid = fn.oid) = 3)::int as branch3,
         (select count(*) from fn where proname = 'ensure_app_user' and (select pronargs from pg_proc where oid = fn.oid) = 6)::int as user6,
         (select count(*) from fn where proname = 'ensure_customer' and (select pronargs from pg_proc where oid = fn.oid) = 7)::int as cust7
),
wrapper as (select src, h from fn where sig = 'record_collection_from_client(jsonb)'),
internal as (select src, h, prosecdef from fn where sig = 'st_internal_record_collection_from_client(jsonb)'),
importer as (select src, h from fn where sig = 'import_snapshot_batch(text,jsonb)'),
already_048 as (
  select (select count(*) from fn where proname in ('st_internal_allocate_receipt_no', 'st_receipt_prefix', 'st_receipt_suffix'))::int as helpers,
         coalesce((select src like '%st_internal_allocate_receipt_no%' from internal), false) as internal_allocates,
         coalesce((select src like '%smile_trust.receipt_import%' from importer), false) as import_flag
),
grants as (
  select string_agg(r.rolname || ' ' || x.what, ', ' order by r.rolname, x.what) as list, count(*)::int as n
  from (values ('anon'), ('authenticated')) r(rolname)
  cross join lateral (
    select 'EXECUTE st_internal_record_collection_from_client' as what
    where has_function_privilege(r.rolname, 'public.st_internal_record_collection_from_client(jsonb)', 'execute')
    union all select 'EXECUTE st_internal_import_snapshot_batch'
    where has_function_privilege(r.rolname, 'public.st_internal_import_snapshot_batch(text,jsonb)', 'execute')
    union all select 'INSERT collections' where has_table_privilege(r.rolname, 'public.collections', 'insert')
    union all select 'UPDATE collections' where has_table_privilege(r.rolname, 'public.collections', 'update')
    union all select 'DELETE collections' where has_table_privilege(r.rolname, 'public.collections', 'delete')
    union all select 'INSERT ledger_entries' where has_table_privilege(r.rolname, 'public.ledger_entries', 'insert')
    union all select 'UPDATE ledger_entries' where has_table_privilege(r.rolname, 'public.ledger_entries', 'update')
    union all select 'INSERT receipt_sequences' where has_table_privilege(r.rolname, 'public.receipt_sequences', 'insert')
    union all select 'UPDATE receipt_sequences' where has_table_privilege(r.rolname, 'public.receipt_sequences', 'update')
  ) x
),
posted_guard as (
  select count(*)::int as n from pg_trigger t
  where t.tgrelid = 'public.collections'::regclass and not t.tgisinternal and t.tgenabled <> 'D'
    and pg_get_triggerdef(t.oid) ilike '%st_guard_posted_rows%'
),
rls as (
  select string_agg(c.relname, ', ' order by c.relname) filter (where not c.relrowsecurity) as off_list
  from pg_class c
  where c.oid in ('public.collections'::regclass, 'public.ledger_entries'::regclass, 'public.receipt_sequences'::regclass)
),

-- 03 schema objects 048 depends on --------------------------------------------------------------
need_col (ord, tbl, col) as (
  values (1, 'collections', 'business_id'), (2, 'collections', 'branch_id'), (3, 'collections', 'customer_id'),
         (4, 'collections', 'collector_id'), (5, 'collections', 'client_id'), (6, 'collections', 'receipt_no'),
         (7, 'collections', 'idempotency_key'), (8, 'collections', 'amount'), (9, 'collections', 'payment_method'),
         (10, 'collections', 'payment_reference'), (11, 'collections', 'verification_status'),
         (12, 'collections', 'collection_date'), (13, 'collections', 'client_created_at'), (14, 'collections', 'note'),
         (15, 'collections', 'reversed'), (16, 'ledger_entries', 'business_id'), (17, 'ledger_entries', 'entry_type'),
         (18, 'ledger_entries', 'customer_id'), (19, 'ledger_entries', 'branch_id'), (20, 'ledger_entries', 'collector_id'),
         (21, 'ledger_entries', 'amount'), (22, 'ledger_entries', 'direction'), (23, 'ledger_entries', 'reference_id'),
         (24, 'ledger_entries', 'reference_type'), (25, 'ledger_entries', 'receipt_no'),
         (26, 'ledger_entries', 'payment_method'), (27, 'ledger_entries', 'payment_reference'),
         (28, 'ledger_entries', 'created_by'), (29, 'ledger_entries', 'client_created_at'),
         (30, 'receipt_sequences', 'business_id'), (31, 'receipt_sequences', 'last_value'),
         (32, 'businesses', 'id'), (33, 'businesses', 'code'), (34, 'businesses', 'name'), (35, 'businesses', 'legacy_code'),
         (36, 'branches', 'id'), (37, 'branches', 'collector_code'), (38, 'customers', 'id'), (39, 'customers', 'branch_id'),
         (40, 'sync_queue', 'business_id'), (41, 'sync_queue', 'business_code'), (42, 'sync_queue', 'idempotency_key'),
         (43, 'sync_queue', 'payload'), (44, 'sync_queue', 'status'), (45, 'sync_queue', 'applied_at')
),
missing_col as (
  select string_agg(n.tbl || '.' || n.col, ', ' order by n.ord) as list, count(*)::int as n
  from need_col n
  where not exists (
    select 1 from pg_attribute a
    where a.attrelid = to_regclass('public.' || n.tbl) and a.attname = n.col and a.attnum > 0 and not a.attisdropped
  )
),
uniq as (
  select c.conrelid::regclass::text as tbl, pg_get_constraintdef(c.oid) as def
  from pg_constraint c
  where c.contype in ('u', 'p')
    and c.conrelid in ('public.collections'::regclass, 'public.receipt_sequences'::regclass, 'public.sync_queue'::regclass)
),
uniq_idx as (
  select i.indrelid::regclass::text as tbl,
         (select string_agg(a.attname, ',' order by k.ord) from unnest(i.indkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as cols
  from pg_index i
  where i.indisunique and i.indpred is null
    and i.indrelid in ('public.collections'::regclass, 'public.receipt_sequences'::regclass, 'public.sync_queue'::regclass)
),
other_triggers as (
  select string_agg(t.tgrelid::regclass::text || ':' || t.tgname, ', ' order by 1) as list, count(*)::int as n
  from pg_trigger t
  where t.tgrelid in ('public.collections'::regclass, 'public.ledger_entries'::regclass, 'public.receipt_sequences'::regclass)
    and not t.tgisinternal
),

-- 04 receipt inventory (all businesses; aggregates only) ---------------------------------------
receipts as (
  select c.business_id, 'collection' as src, c.receipt_no as r from public.collections c
  union all
  select l.business_id, 'ledger', l.receipt_no from public.ledger_entries l where l.receipt_no is not null
),
classified as (
  select business_id, src, r,
         case when r is null or btrim(r) = '' then 'blank'
              when r ~* '^PENDING-' then 'pending'
              when r ~ '^[A-Za-z0-9]+-[0-9]{1,12}$' then 'standard'
              when r ~ '^[A-Za-z0-9]+-[0-9]{13,}$' then 'long-numeric'
              else 'other' end as kind,
         case when coalesce(r, '') ~ '^[A-Za-z0-9]+-[0-9]{1,12}$' then substring(r from '([0-9]+)$')::bigint end as suffix,
         case when coalesce(r, '') ~ '^[A-Za-z0-9]+-[0-9]+$' then substring(r from '^([A-Za-z0-9]+)-') end as prefix
  from receipts
),
inv_business as (
  select b.code,
         (select count(*) from public.collections c where c.business_id = b.id)::int as collections,
         (select count(*) from public.ledger_entries l where l.business_id = b.id and l.reference_type = 'collection')::int as ledger_collection,
         (select count(*) from public.ledger_entries l where l.business_id = b.id)::int as ledger_all
  from public.businesses b
),
kinds as (
  select src, kind, count(*)::int as n from classified group by src, kind
),
prefixes as (
  select src, coalesce(prefix, '(none)') as prefix, count(*)::int as n, max(suffix) as max_suffix,
         count(*) filter (where kind = 'long-numeric')::int as long_n
  from classified where kind in ('standard', 'long-numeric') group by src, coalesce(prefix, '(none)')
),
dup_receipt as (
  select count(*)::int as n from (select business_id, receipt_no from public.collections group by 1, 2 having count(*) > 1) d
),
dup_idem as (
  select count(*)::int as n from (select business_id, idempotency_key from public.collections group by 1, 2 having count(*) > 1) d
),
credits as (
  select l.reference_id, count(*)::int as n, min(l.receipt_no) as r_min, max(l.receipt_no) as r_max
  from public.ledger_entries l
  where l.reference_type = 'collection' and l.direction = 'credit'
  group by l.reference_id
),
links as (
  select count(*) filter (where cr.reference_id is null and c.amount > 0 and not coalesce(c.reversed, false))::int as uncredited,
         count(*) filter (where cr.n > 1)::int as multi_credit,
         count(*) filter (where cr.n >= 1 and (cr.r_min is distinct from c.receipt_no or cr.r_max is distinct from c.receipt_no))::int as receipt_mismatch
  from public.collections c left join credits cr on cr.reference_id = c.id
),
orphan_credits as (
  select count(*)::int as n from credits cr where not exists (select 1 from public.collections c where c.id = cr.reference_id)
),

-- 05 counter-seed simulation (exactly 048 section 2, computed without writing) -------------------
seed as (
  select b.id, b.code, rs.last_value as current_value,
         (select max(k.suffix) from classified k where k.business_id = b.id) as required_min
  from public.businesses b
  left join public.receipt_sequences rs on rs.business_id = b.id
),
seed2 as (
  select s.*, greatest(coalesce(s.current_value, 0), coalesce(s.required_min, 0)) as proposed
  from seed s
),
first_alloc as (
  select s.code, coalesce(nullif(left(regexp_replace(upper(coalesce(br.collector_code, '')), '[^A-Z0-9]', '', 'g'), 12), ''), 'RCP') as prefix,
         s.proposed + 1 as next_n, s.id
  from seed2 s join public.branches br on br.business_id = s.id
),
first_alloc2 as (
  select distinct f.code, f.prefix, f.next_n,
         f.prefix || '-' || lpad(f.next_n::text, greatest(8, length(f.next_n::text)), '0') as candidate,
         exists (select 1 from public.collections c where c.business_id = f.id
                   and c.receipt_no = f.prefix || '-' || lpad(f.next_n::text, greatest(8, length(f.next_n::text)), '0')) as taken
  from first_alloc f
),

-- 06 snapshot and relational fingerprint (same definitions as the earlier checkpoints) ----------
snap as (
  select (xpath('/table/row/n/text()', x))[1]::text::int as n,
         (xpath('/table/row/id/text()', x))[1]::text as id,
         (xpath('/table/row/saved_at/text()', x))[1]::text as saved_at,
         (xpath('/table/row/sha/text()', x))[1]::text as sha
  from (select case when to_regclass('public.smile_trust_cloud_snapshots') is null then null else query_to_xml(
    'select (select count(*) from public.smile_trust_cloud_snapshots) as n, s.id,
            to_char(s.saved_at at time zone ''UTC'', ''YYYY-MM-DD HH24:MI:SS.MS'') as saved_at,
            encode(sha256(convert_to(s.payload::text, ''UTF8'')), ''hex'') as sha
     from public.smile_trust_cloud_snapshots s where s.business_id = ''SMILE-TRUST''', false, false, '') end as x) q
),
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
  select md5(string_agg(t || ':' || n::text || ':' || d, ',' order by t)) as fp, count(*)::int as tables_n, coalesce(sum(n), 0)::bigint as rows_n,
         md5(string_agg(t || ':' || n::text || ':' || d, ',' order by t) filter (where t <> 'receipt_sequences')) as fp_wo_counter
  from rel_digest where core
),
receipt_fp as (
  select md5(coalesce((select string_agg(c.id::text || '|' || coalesce(c.receipt_no, ''), ',' order by c.id) from public.collections c), '')) as collections_fp,
         md5(coalesce((select string_agg(l.id::text || '|' || coalesce(l.receipt_no, ''), ',' order by l.id) from public.ledger_entries l), '')) as ledger_fp
),

checks (section, ord, check_name, status, detail) as (
  -- 01 target
  select '01 target', 1, 'database and business', case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end,
         'database ' || current_database() || ', server ' || current_setting('server_version') || ', SMILE-TRUST businesses ' || (select count(*) from biz)
         || '. Confirm the connection was to project qouokiqoepjpoksupskb (user postgres.qouokiqoepjpoksupskb or host db.qouokiqoepjpoksupskb.supabase.co).'
  union all
  select '01 target', 2, 'transaction is read only', case when current_setting('transaction_read_only') = 'on' then 'PASS' else 'FAIL' end,
         'transaction_read_only = ' || current_setting('transaction_read_only')

  -- 02 migrations
  union all
  select '02 migrations', 1, '046/047 functions 048 relies on are present', case when m.n = 0 then 'PASS' else 'FAIL' end,
         case when m.n = 0 then 'all ' || (select count(*) from need_fn) || ' present' else 'missing: ' || m.list end
  from missing_fn m
  union all
  select '02 migrations', 2, '048 is NOT already applied',
         case when a.helpers = 0 and not a.internal_allocates and not a.import_flag then 'PASS' else 'FAIL' end,
         '048 helper functions ' || a.helpers || ', internal write allocates ' || a.internal_allocates || ', import receipt flag ' || a.import_flag
  from already_048 a
  union all
  select '02 migrations', 3, '047 public collection wrapper still enforces business, amounts, assignment and staff scope',
         case when (select src from wrapper) ~ 'st_assert_business' and (select src from wrapper) ~ 'st_assert_payload_amounts'
                   and (select src from wrapper) ~ 'st_assert_customer_assignment' and (select src from wrapper) ~ 'st_scope_staff_payload'
              then 'PASS' else 'FAIL' end,
         'wrapper body md5 ' || coalesce((select h from wrapper), 'missing') || ' (repository 047: 4d9bd77a7bdc7ba6a675763cf15f7162)'
  union all
  select '02 migrations', 4, 'internal collection write is the expected pre-048 body',
         case when (select h from internal) = 'ba3a58f91afe847be3e0903984bb778b' then 'PASS'
              when (select src from internal) ~ 'v_receipt text := coalesce\(payload->>''receipt_no''' then 'WARN'
              else 'FAIL' end,
         'body md5 ' || coalesce((select h from internal), 'missing') || ' (repository pre-048: ba3a58f91afe847be3e0903984bb778b); security definer '
         || coalesce((select prosecdef::text from internal), 'n/a')
  union all
  select '02 migrations', 5, 'owner-only import wrapper is the expected 047 body',
         -- 72a1bfde... is the same wrapper as re-created by the 048 rollback (different indentation only).
         case when (select h from importer) in ('2b55453f473e59ea6f829eedf12e5183', '72a1bfdeaba97abfbdb2fb4b19e6388e') then 'PASS'
              when (select src from importer) ~ 'st_jwt_is_owner' then 'WARN' else 'FAIL' end,
         'body md5 ' || coalesce((select h from importer), 'missing') || ' (repository 047: 2b55453f473e59ea6f829eedf12e5183; 048 rollback: 72a1bfdeaba97abfbdb2fb4b19e6388e)'
  union all
  select '02 migrations', 6, 'next_receipt_no exists (left unchanged by 048)', case when exists (select 1 from fn where sig = 'next_receipt_no(uuid,text)') then 'PASS' else 'WARN' end,
         'body md5 ' || coalesce((select h from fn where sig = 'next_receipt_no(uuid,text)'), 'missing') || ' (repository: 077faf1f5c4fb83a9b4f53a3c05e02b1)'
  union all
  select '02 migrations', 7, 'clients cannot call internal writes or write collections, ledger or counters', case when g.n = 0 then 'PASS' else 'FAIL' end,
         case when g.n = 0 then 'anon and authenticated hold none of these privileges' else 'granted: ' || g.list end
  from grants g
  union all
  select '02 migrations', 8, 'posted-row guard trigger on collections (047)', case when (select n from posted_guard) >= 1 then 'PASS' else 'FAIL' end,
         'enabled triggers calling st_guard_posted_rows: ' || (select n from posted_guard)
  union all
  select '02 migrations', 9, 'row level security on collections, ledger_entries, receipt_sequences', case when r.off_list is null then 'PASS' else 'FAIL' end,
         coalesce('RLS off: ' || r.off_list, 'enabled on all three')
  from rls r
  union all
  select '02 migrations', 10, '048 write-protocol fence (absent before 048; a receipt rollback leaves it installed)', 'INFO',
         case when to_regprocedure('public.st_guard_client_write_protocol()') is null then 'fence function absent'
              else 'fence function present' end || ', fenced public tables '
         || (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
             where c.relnamespace = 'public'::regnamespace and t.tgname = 'st_client_write_protocol' and t.tgenabled = 'O')

  -- 03 schema
  union all
  select '03 schema', 1, 'tables and columns 048 reads and writes', case when m.n = 0 then 'PASS' else 'FAIL' end,
         case when m.n = 0 then 'all ' || (select count(*) from need_col) || ' columns present' else 'missing: ' || m.list end
  from missing_col m
  union all
  select '03 schema', 2, 'collections UNIQUE (business_id, receipt_no)',
         case when exists (select 1 from uniq_idx where tbl = 'collections' and cols = 'business_id,receipt_no') then 'PASS' else 'FAIL' end, 'required by 048 collision safety'
  union all
  select '03 schema', 3, 'collections UNIQUE (business_id, idempotency_key)',
         case when exists (select 1 from uniq_idx where tbl = 'collections' and cols = 'business_id,idempotency_key') then 'PASS' else 'FAIL' end,
         'required by 048 "on conflict (business_id, idempotency_key)"'
  union all
  select '03 schema', 4, 'receipt_sequences unique on business_id',
         case when exists (select 1 from uniq_idx where tbl = 'receipt_sequences' and cols = 'business_id') then 'PASS' else 'FAIL' end,
         'required by 048 "on conflict (business_id)"'
  union all
  select '03 schema', 5, 'sync_queue UNIQUE (business_id, idempotency_key)',
         case when exists (select 1 from uniq_idx where tbl = 'sync_queue' and cols = 'business_id,idempotency_key') then 'PASS' else 'FAIL' end,
         'required by the unchanged sync_queue insert'
  union all
  select '03 schema', 6, 'ensure_branch / ensure_app_user / ensure_customer signatures',
         case when h.branch3 = 1 and h.user6 >= 1 and h.cust7 >= 1 then 'PASS' else 'FAIL' end,
         'ensure_branch 3 args ' || h.branch3 || ', ensure_app_user 6 args ' || h.user6 || ', ensure_customer 7 args ' || h.cust7
  from helper_fn h
  union all
  select '03 schema', 7, 'triggers on collections / ledger_entries / receipt_sequences', 'INFO', coalesce(t.n || ': ' || t.list, 'none')
  from other_triggers t

  -- 04 inventory
  union all
  select '04 inventory', 1, 'businesses: collections / collection ledger entries / all ledger entries', 'INFO',
         (select string_agg(code || ' ' || collections || '/' || ledger_collection || '/' || ledger_all, '; ' order by code) from inv_business)
  union all
  select '04 inventory', 2, 'receipt formats (collection and ledger receipts)',
         case when exists (select 1 from kinds where kind = 'pending') then 'FAIL'
              when exists (select 1 from kinds where kind in ('blank', 'other', 'long-numeric')) then 'WARN' else 'PASS' end,
         coalesce((select string_agg(src || ' ' || kind || ' ' || n, ', ' order by src, kind) from kinds), 'no receipts')
         || '. blank/other/long-numeric are left alone by 048 and do not seed the counter; PENDING-* must never be stored'
  union all
  select '04 inventory', 3, 'receipt prefixes (source prefix count max-suffix)', 'INFO',
         coalesce((select string_agg(src || ' ' || prefix || ' ' || n || ' ' || coalesce(max_suffix::text, 'n/a') || case when long_n > 0 then ' (' || long_n || ' long-numeric ignored)' else '' end, '; ' order by src, prefix) from prefixes), 'none')
  union all
  select '04 inventory', 4, 'duplicate receipt numbers within a business (collections)', case when (select n from dup_receipt) = 0 then 'PASS' else 'FAIL' end,
         (select n from dup_receipt) || ' duplicated receipt numbers'
  union all
  select '04 inventory', 5, 'duplicate idempotency keys within a business (collections)', case when (select n from dup_idem) = 0 then 'PASS' else 'FAIL' end,
         (select n from dup_idem) || ' duplicated keys'
  union all
  select '04 inventory', 6, 'collection to ledger credit links',
         case when l.multi_credit > 0 or l.receipt_mismatch > 0 then 'WARN' when l.uncredited > 0 or (select n from orphan_credits) > 0 then 'WARN' else 'PASS' end,
         'uncredited positive collections ' || l.uncredited || ', collections with more than one credit ' || l.multi_credit
         || ', credit receipt differs from collection ' || l.receipt_mismatch || ', credits without a collection ' || (select n from orphan_credits)
  from links l

  -- 05 counter seeding
  union all
  select '05 seeding', 1, 'business ' || s.code || ': current / required minimum / proposed counter',
         case when s.proposed < coalesce(s.current_value, 0) then 'FAIL' else 'PASS' end,
         'current ' || coalesce(s.current_value::text, 'no row (048 creates it at 0)') || ', required ' || coalesce(s.required_min::text, 'none')
         || ', proposed ' || s.proposed || case when coalesce(s.current_value, 0) = s.proposed then ' (unchanged)' else ' (raised)' end
  from seed2 s
  union all
  select '05 seeding', 2, 'first allocatable receipt per branch prefix (048 skips taken numbers anyway)',
         case when exists (select 1 from first_alloc2 where taken) then 'WARN' else 'PASS' end,
         coalesce((select string_agg(code || ' ' || candidate || case when taken then ' TAKEN' else ' free' end, '; ' order by code, prefix) from first_alloc2), 'no branches')

  -- 06 snapshot and fingerprints
  union all
  select '06 snapshot', 1, 'cloud snapshot is the verified post-bootstrap row',
         case when s.n = 1 and s.id = '2' and s.sha = '669b7fa456e0a012ba08abcb9eee48f72a12594154e881bee99d1a67a90079b8' then 'PASS' else 'WARN' end,
         'rows ' || coalesce(s.n::text, 'table missing') || ', id ' || coalesce(s.id, '-') || ', saved_at ' || coalesce(s.saved_at, '-')
         || ' UTC, sha256 ' || coalesce(s.sha, '-') || ' (expected id 2, 2026-10-05 10:44:18.728, 669b7fa4...079b8)'
  from snap s
  union all
  select '06 snapshot', 2, 'core relational fingerprint', case when f.fp = '574bd34af336b491bb4ebb76541310c0' then 'PASS' else 'WARN' end,
         f.fp || ', ' || f.tables_n || ' tables, ' || f.rows_n || ' rows (last verified 574bd34af336b491bb4ebb76541310c0, 341 tables, 173 rows)'
  from core_fp f
  union all
  select '06 snapshot', 3, 'fingerprints for the post-048 comparison', 'INFO',
         'core without receipt_sequences ' || f.fp_wo_counter || '; collections id|receipt ' || r.collections_fp || '; ledger id|receipt ' || r.ledger_fp
  from core_fp f, receipt_fp r
)
select 'verdict' as section, 0 as ord, 'overall' as check_name,
       case when count(*) filter (where status = 'FAIL') = 0 then 'READY_FOR_048' else 'NOT_READY_FOR_048' end as status,
       count(*) filter (where status = 'FAIL') || ' FAIL, ' || count(*) filter (where status = 'WARN') || ' WARN, '
       || count(*) filter (where status = 'PASS') || ' PASS'
       || coalesce('; failing: ' || string_agg(section || ' #' || ord, ', ') filter (where status = 'FAIL'), '') as detail
from checks
union all
select * from (select * from checks order by section, ord) c;
