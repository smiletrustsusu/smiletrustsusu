-- DRY RUN (always rolled back): retirement of the stale SMILE-TRUST cloud snapshot row.
--
-- Project: qouokiqoepjpoksupskb (SMILE-TRUST) only. Runbook: docs/recovery/STALE-SNAPSHOT-RECOVERY-RUNBOOK.md
-- (step C1). This file is identical to retire_stale_snapshot_WRITE.sql except for c_mode.
--
-- Before running: replace the placeholder value of c_fingerprint (below) with the 64-character
-- PAYLOAD FINGERPRINT from the step A checkpoint (section 02, ord 5). Nothing else may be edited.
--
-- Expected result: the statement FAILS with
--   DRY RUN PASSED: the stale row ... matched every guard ... nothing was changed
-- That error is the success signal: the whole statement, including the trial removal, was rolled
-- back by the raised exception. Any other error means a guard failed: STOP and keep the row.
--
-- Transaction boundary: the single DO statement. Every guard failure, and the dry-run signal,
-- raises an exception, which rolls back everything the statement did. The table is locked against
-- concurrent client writes (reads continue) until the statement ends.

do $retire$
declare
  c_mode        constant text := 'DRY_RUN';
  c_fingerprint constant text := '__PASTE_STEP_A_PAYLOAD_FINGERPRINT__';
  c_saved_at    constant timestamptz := timestamptz '2026-10-03 13:07:46.196+00';
  v_total int;
  v_exact int;
  v_variants int;
  v_row record;
  v_ledger int;
  v_lifecycle int;
  v_fk int;
  v_handlers int;
  v_removed int;
  v_left int;
begin
  if c_mode not in ('DRY_RUN', 'WRITE') then
    raise exception 'STOP: c_mode must be DRY_RUN or WRITE';
  end if;
  if c_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'STOP: paste the 64-character lowercase PAYLOAD FINGERPRINT from the step A checkpoint; nothing was changed';
  end if;
  if not exists (select 1 from public.businesses where code = 'SMILE-TRUST' or legacy_code = 'SMILE-TRUST') then
    raise exception 'STOP: business SMILE-TRUST not found; this is not the SMILE-TRUST project';
  end if;

  perform set_config('lock_timeout', '5s', true);
  lock table public.smile_trust_cloud_snapshots in exclusive mode;

  select count(*)::int,
         count(*) filter (where business_id = 'SMILE-TRUST')::int,
         count(*) filter (where upper(btrim(business_id)) = 'SMILE-TRUST' and business_id <> 'SMILE-TRUST')::int
    into v_total, v_exact, v_variants
    from public.smile_trust_cloud_snapshots;
  if v_total <> 1 or v_exact <> 1 or v_variants <> 0 then
    raise exception 'STOP: expected exactly one snapshot row (SMILE-TRUST); found total %, SMILE-TRUST %, variants %; nothing was changed',
      v_total, v_exact, v_variants;
  end if;

  select s.id,
         lower(btrim(coalesce(s.saved_by, ''))) as saved_by,
         date_trunc('milliseconds', s.saved_at) as saved_at,
         coalesce(s.access_key, '') <> '' as legacy_key_set,
         encode(sha256(convert_to(s.payload::text, 'UTF8')), 'hex') as fp,
         case when jsonb_typeof(s.payload -> 'users') = 'array' then jsonb_array_length(s.payload -> 'users') end as staff_n,
         case when jsonb_typeof(s.payload -> 'customers') = 'array' then jsonb_array_length(s.payload -> 'customers') end as members,
         case when jsonb_typeof(s.payload -> 'groups') = 'array' then jsonb_array_length(s.payload -> 'groups') end as groups_n,
         case when jsonb_typeof(s.payload -> 'collections') = 'array' then jsonb_array_length(s.payload -> 'collections') end as collections_n,
         case when jsonb_typeof(s.payload -> 'savingsProducts') = 'array' then jsonb_array_length(s.payload -> 'savingsProducts') end as products_n
    into v_row
    from public.smile_trust_cloud_snapshots s
   where s.business_id = 'SMILE-TRUST'
     for update;

  if v_row.id is distinct from 1::bigint then
    raise exception 'STOP: the row id is %, not 1; nothing was changed', v_row.id;
  end if;
  if v_row.saved_by <> 'john' then
    raise exception 'STOP: saved_by is not john; nothing was changed';
  end if;
  if v_row.saved_at is distinct from c_saved_at then
    raise exception 'STOP: saved_at is %, not 2026-10-03 13:07:46.196 UTC (the row changed since inspection); nothing was changed', v_row.saved_at;
  end if;
  if v_row.legacy_key_set then
    raise exception 'STOP: the legacy access_key column is set; nothing was changed';
  end if;
  if v_row.staff_n is distinct from 4 or v_row.members is distinct from 1 or v_row.groups_n is distinct from 1
     or v_row.collections_n is distinct from 0 or v_row.products_n is distinct from 14 then
    raise exception 'STOP: contents differ from the inspected stale row (staff %, members %, groups %, collections %, savings products %); nothing was changed',
      v_row.staff_n, v_row.members, v_row.groups_n, v_row.collections_n, v_row.products_n;
  end if;
  if v_row.fp <> c_fingerprint then
    raise exception 'STOP: the payload fingerprint differs from step A (the row changed, or the wrong value was pasted); nothing was changed';
  end if;

  select count(*)::int into v_ledger from public.st_snapshot_financial_ledger where upper(btrim(business_id)) = 'SMILE-TRUST';
  select count(*)::int into v_lifecycle from public.st_member_lifecycle_events where upper(btrim(business_code)) = 'SMILE-TRUST';
  if v_ledger <> 0 or v_lifecycle <> 0 then
    raise exception 'STOP: snapshot history exists (posted ledger %, lifecycle events %); nothing was changed', v_ledger, v_lifecycle;
  end if;
  select count(*)::int into v_fk
    from pg_constraint where contype = 'f' and confrelid = 'public.smile_trust_cloud_snapshots'::regclass;
  select count(*)::int into v_handlers
    from pg_trigger where tgrelid = 'public.smile_trust_cloud_snapshots'::regclass and not tgisinternal and (tgtype::int & 40) <> 0;
  if v_fk <> 0 or v_handlers <> 0 then
    raise exception 'STOP: removal would have side effects (foreign keys %, removal handlers %); nothing was changed', v_fk, v_handlers;
  end if;

  delete from public.smile_trust_cloud_snapshots
   where id = 1
     and business_id = 'SMILE-TRUST'
     and lower(btrim(coalesce(saved_by, ''))) = 'john'
     and date_trunc('milliseconds', saved_at) = c_saved_at
     and encode(sha256(convert_to(payload::text, 'UTF8')), 'hex') = c_fingerprint;
  get diagnostics v_removed = row_count;
  if v_removed <> 1 then
    raise exception 'STOP: % row(s) matched the removal guard, expected exactly 1; nothing was changed', v_removed;
  end if;

  select count(*)::int into v_left from public.smile_trust_cloud_snapshots;
  if v_left <> 0 then
    raise exception 'STOP: % snapshot row(s) would remain; nothing was changed', v_left;
  end if;

  if c_mode = 'DRY_RUN' then
    raise exception 'DRY RUN PASSED: the stale row (id 1, fingerprint %) matched every guard and would be removed; this dry run was rolled back and nothing was changed',
      c_fingerprint;
  end if;

  raise notice 'RETIRED: stale snapshot row id 1 (fingerprint %) removed; 0 snapshot rows remain', c_fingerprint;
end
$retire$;

select case when count(*) = 0 then 'RETIRED: 0 snapshot rows remain'
            else 'NOT RETIRED: ' || count(*) || ' snapshot row(s) present' end as result
  from public.smile_trust_cloud_snapshots;
