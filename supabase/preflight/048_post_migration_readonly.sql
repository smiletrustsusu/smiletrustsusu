-- READ-ONLY verification, run immediately after applying migration 048 (commit 168f525).
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST). Never run this against any other project.
-- Before running, paste the three INFO fingerprints and the snapshot SHA-256 from the pre-048
-- preflight (048_production_preflight_readonly.sql, section 06 #1 and #3) into `pre` below. Left
-- as PASTE_..., the comparison rows are reported as INFO instead of PASS/FAIL.
-- Run it as ONE read-only transaction:
--   * psql:          psql -X -1 -v ON_ERROR_STOP=1 -f 048_post_migration_readonly.sql
--   * SQL Editor:    paste the whole file and run it.
-- Verdict (first row): MIGRATION_048_VERIFIED (no FAIL) or MIGRATION_048_NOT_VERIFIED.
-- Returns counts, digests and receipt prefixes only: no member data, payloads or secrets.

set transaction read only;

with
pre (collections_fp, ledger_fp, core_wo_counter_fp, snapshot_sha) as (
  values ('PASTE_COLLECTIONS_FP', 'PASTE_LEDGER_FP', 'PASTE_CORE_WITHOUT_RECEIPT_SEQUENCES_FP', 'PASTE_SNAPSHOT_SHA256')
),
biz as (
  select b.id from public.businesses b where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
),
fn as (
  -- Bodies are compared with line endings normalised: production stores CRLF bodies (SQL Editor).
  select p.oid, p.oid::regprocedure::text as sig, p.proname, md5(replace(p.prosrc, E'\r\n', E'\n')) as h, p.prosrc as src, p.prosecdef
  from pg_proc p where p.pronamespace = 'public'::regnamespace
),
internal as (select src, h, prosecdef from fn where sig = 'st_internal_record_collection_from_client(jsonb)'),
importer as (select src, h from fn where sig = 'import_snapshot_batch(text,jsonb)'),
wrapper as (select src, h from fn where sig = 'record_collection_from_client(jsonb)'),
grants as (
  select string_agg(r.rolname || ' ' || x.what, ', ' order by r.rolname, x.what) as list, count(*)::int as n
  from (values ('anon'), ('authenticated')) r(rolname)
  cross join lateral (
    select 'EXECUTE ' || f.sig as what from fn f
    where f.sig in ('st_internal_allocate_receipt_no(uuid,text)', 'st_receipt_prefix(text)', 'st_receipt_suffix(text)',
                    'st_internal_record_collection_from_client(jsonb)', 'st_internal_import_snapshot_batch(text,jsonb)')
      and has_function_privilege(r.rolname, f.oid, 'execute')
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
uniq_idx as (
  select i.indrelid::regclass::text as tbl,
         (select string_agg(a.attname, ',' order by k.ord) from unnest(i.indkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as cols
  from pg_index i
  where i.indisunique and i.indpred is null
    and i.indrelid in ('public.collections'::regclass, 'public.receipt_sequences'::regclass)
),
suffixes as (
  select r.business_id, max(case when coalesce(r.receipt_no, '') ~ '^[A-Za-z0-9]+-[0-9]{1,12}$'
                                 then substring(r.receipt_no from '([0-9]+)$')::bigint end) as max_suffix,
         count(*) filter (where r.receipt_no ~* '^PENDING-')::int as pending_n
  from (select business_id, receipt_no from public.collections
        union all select business_id, receipt_no from public.ledger_entries where receipt_no is not null) r
  group by r.business_id
),
counters as (
  select b.code, rs.last_value, s.max_suffix, coalesce(s.pending_n, 0) as pending_n
  from public.businesses b
  left join public.receipt_sequences rs on rs.business_id = b.id
  left join suffixes s on s.business_id = b.id
),
receipt_fp as (
  select md5(coalesce((select string_agg(c.id::text || '|' || coalesce(c.receipt_no, ''), ',' order by c.id) from public.collections c), '')) as collections_fp,
         md5(coalesce((select string_agg(l.id::text || '|' || coalesce(l.receipt_no, ''), ',' order by l.id) from public.ledger_entries l), '')) as ledger_fp
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
snap as (
  select (xpath('/table/row/n/text()', x))[1]::text::int as n,
         (xpath('/table/row/id/text()', x))[1]::text as id,
         (xpath('/table/row/sha/text()', x))[1]::text as sha
  from (select case when to_regclass('public.smile_trust_cloud_snapshots') is null then null else query_to_xml(
    'select (select count(*) from public.smile_trust_cloud_snapshots) as n, s.id,
            encode(sha256(convert_to(s.payload::text, ''UTF8'')), ''hex'') as sha
     from public.smile_trust_cloud_snapshots s where s.business_id = ''SMILE-TRUST''', false, false, '') end as x) q
),
compare as (
  select (p.collections_fp like 'PASTE_%') as unset, p.*, r.collections_fp as now_collections, r.ledger_fp as now_ledger,
         f.fp_wo_counter as now_core, s.sha as now_sha
  from pre p, receipt_fp r, core_fp f, snap s
),
fence_fn as (select oid, src, prosecdef from fn where sig = 'st_guard_client_write_protocol()'),
-- tgtype 62 = BEFORE (2) + INSERT (4) + DELETE (8) + UPDATE (16) + TRUNCATE (32), FOR EACH STATEMENT.
fence_missing as (
  select count(*)::int as n, string_agg(c.relname, ', ' order by c.relname) as list, (select count(*)::int from pg_class c2
           where c2.relnamespace = 'public'::regnamespace and c2.relkind in ('r', 'p')) as tables_n
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'st_client_write_protocol'
                    and t.tgenabled = 'O' and t.tgtype = 62 and t.tgfoid = (select oid from fence_fn))
),

checks (section, ord, check_name, status, detail) as (
  select '01 target', 1, 'database and business', case when (select count(*) from biz) = 1 then 'PASS' else 'FAIL' end,
         'database ' || current_database() || ', server ' || current_setting('server_version') || ', SMILE-TRUST businesses ' || (select count(*) from biz)
         || '. Confirm the connection was to project qouokiqoepjpoksupskb.'
  union all
  select '01 target', 2, 'transaction is read only', case when current_setting('transaction_read_only') = 'on' then 'PASS' else 'FAIL' end,
         'transaction_read_only = ' || current_setting('transaction_read_only')

  union all
  select '02 048 applied', 1, 'allocator and helpers exist',
         case when (select count(*) from fn where sig in ('st_internal_allocate_receipt_no(uuid,text)', 'st_receipt_prefix(text)', 'st_receipt_suffix(text)')) = 3 then 'PASS' else 'FAIL' end,
         (select count(*) from fn where sig in ('st_internal_allocate_receipt_no(uuid,text)', 'st_receipt_prefix(text)', 'st_receipt_suffix(text)')) || ' of 3 present; allocator security definer '
         || coalesce((select prosecdef::text from fn where sig = 'st_internal_allocate_receipt_no(uuid,text)'), 'n/a')
  union all
  select '02 048 applied', 2, 'internal collection write is the 048 version',
         case when (select h from internal) = '11d945776ac3decea1f1d9838e8bb30e' then 'PASS'
              when (select src from internal) like '%st_internal_allocate_receipt_no%'
               and (select src from internal) like '%on conflict (business_id, idempotency_key) do nothing%' then 'WARN'
              else 'FAIL' end,
         'body md5 ' || coalesce((select h from internal), 'missing') || ' (repository 048: 11d945776ac3decea1f1d9838e8bb30e)'
  union all
  select '02 048 applied', 3, 'owner-only import keeps historical receipts (048 import wrapper)',
         case when (select h from importer) = 'ac7833b412c82f34bb55a7b8320b7d7f' then 'PASS'
              when (select src from importer) like '%smile_trust.receipt_import%' then 'WARN' else 'FAIL' end,
         'body md5 ' || coalesce((select h from importer), 'missing') || ' (repository 048: ac7833b412c82f34bb55a7b8320b7d7f)'

  union all
  select '03 privileges', 1, 'clients cannot call the allocator, helpers or internal writes, nor write collections, ledger or counters',
         case when g.n = 0 then 'PASS' else 'FAIL' end, coalesce('granted: ' || g.list, 'anon and authenticated hold none of these privileges')
  from grants g

  union all
  select '04 047 intact', 1, '047 public collection wrapper unchanged',
         case when (select h from wrapper) = '4d9bd77a7bdc7ba6a675763cf15f7162' then 'PASS' else 'FAIL' end,
         'body md5 ' || coalesce((select h from wrapper), 'missing') || ' (repository 047: 4d9bd77a7bdc7ba6a675763cf15f7162)'
  union all
  select '04 047 intact', 2, 'posted-row guard trigger on collections', case when (select n from posted_guard) >= 1 then 'PASS' else 'FAIL' end,
         'enabled triggers calling st_guard_posted_rows: ' || (select n from posted_guard)
  union all
  select '04 047 intact', 3, 'row level security on collections, ledger_entries, receipt_sequences', case when r.off_list is null then 'PASS' else 'FAIL' end,
         coalesce('RLS off: ' || r.off_list, 'enabled on all three')
  from rls r
  union all
  select '04 047 intact', 4, 'unique constraints on collections and receipt_sequences',
         case when exists (select 1 from uniq_idx where tbl = 'collections' and cols = 'business_id,receipt_no')
               and exists (select 1 from uniq_idx where tbl = 'collections' and cols = 'business_id,idempotency_key')
               and exists (select 1 from uniq_idx where tbl = 'receipt_sequences' and cols = 'business_id') then 'PASS' else 'FAIL' end,
         'collections (business_id, receipt_no), (business_id, idempotency_key); receipt_sequences (business_id)'

  union all
  select '05 counters', 1, 'business ' || c.code || ': counter covers every historical numeric receipt',
         case when c.last_value is null then 'FAIL' when c.last_value >= coalesce(c.max_suffix, 0) then 'PASS' else 'FAIL' end,
         'counter ' || coalesce(c.last_value::text, 'missing') || ', highest numeric suffix ' || coalesce(c.max_suffix::text, 'none')
  from counters c
  union all
  select '05 counters', 2, 'no PENDING-* reference stored as a receipt',
         case when (select coalesce(sum(pending_n), 0) from counters) = 0 then 'PASS' else 'FAIL' end,
         (select coalesce(sum(pending_n), 0) from counters) || ' found'

  union all
  select '06 unchanged', 1, 'existing collections and their receipts unchanged',
         case when c.unset then 'INFO' when c.now_collections = c.collections_fp then 'PASS' else 'FAIL' end,
         'now ' || c.now_collections || case when c.unset then ' (paste the pre-048 value to compare)' else ', pre ' || c.collections_fp end
  from compare c
  union all
  select '06 unchanged', 2, 'existing ledger entries and their receipts unchanged',
         case when c.unset then 'INFO' when c.now_ledger = c.ledger_fp then 'PASS' else 'FAIL' end,
         'now ' || c.now_ledger || case when c.unset then '' else ', pre ' || c.ledger_fp end
  from compare c
  union all
  select '06 unchanged', 3, 'relational data unchanged apart from receipt_sequences',
         case when c.unset then 'INFO' when c.now_core = c.core_wo_counter_fp then 'PASS' else 'FAIL' end,
         'now ' || c.now_core || case when c.unset then '' else ', pre ' || c.core_wo_counter_fp end
  from compare c
  union all
  select '06 unchanged', 4, 'cloud snapshot unchanged',
         case when c.unset then 'INFO' when c.now_sha = c.snapshot_sha then 'PASS' else 'FAIL' end,
         'now ' || coalesce(c.now_sha, 'no row') || case when c.unset then '' else ', pre ' || c.snapshot_sha end
  from compare c
  union all
  select '06 unchanged', 5, 'core relational fingerprint (changes only if seeding raised a counter)', 'INFO',
         f.fp || ', ' || f.tables_n || ' tables, ' || f.rows_n || ' rows'
  from core_fp f

  union all
  select '07 write fence', 1, 'protocol fence function requires 048-v1 and exempts only trusted sessions',
         case when (select count(*) from fence_fn) = 1 and (select prosecdef from fence_fn)
               and (select src from fence_fn) like '%''048-v1''%' and (select src from fence_fn) like '%st_is_trusted_session()%' then 'PASS' else 'FAIL' end,
         case when (select count(*) from fence_fn) = 1 then 'present, security definer ' || (select prosecdef::text from fence_fn) else 'missing' end
  union all
  select '07 write fence', 2, 'clients cannot execute the fence function directly',
         case when (select count(*) from fence_fn) = 1
               and not has_function_privilege('anon', (select oid from fence_fn), 'execute')
               and not has_function_privilege('authenticated', (select oid from fence_fn), 'execute') then 'PASS' else 'FAIL' end,
         'anon/authenticated EXECUTE revoked'
  union all
  select '07 write fence', 3, 'every public table has the enabled BEFORE STATEMENT insert/update/delete/truncate fence',
         case when m.n = 0 and m.tables_n > 0 then 'PASS' else 'FAIL' end,
         m.tables_n - m.n || ' of ' || m.tables_n || ' tables fenced' || coalesce('; missing: ' || m.list, '')
  from fence_missing m
)
select 'verdict' as section, 0 as ord, 'overall' as check_name,
       case when count(*) filter (where status = 'FAIL') = 0 then 'MIGRATION_048_VERIFIED' else 'MIGRATION_048_NOT_VERIFIED' end as status,
       count(*) filter (where status = 'FAIL') || ' FAIL, ' || count(*) filter (where status = 'WARN') || ' WARN, '
       || count(*) filter (where status = 'PASS') || ' PASS, ' || count(*) filter (where status = 'INFO') || ' INFO'
       || coalesce('; failing: ' || string_agg(section || ' #' || ord, ', ') filter (where status = 'FAIL'), '') as detail
from checks
union all
select * from (select * from checks order by section, ord) c;
