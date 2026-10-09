# Migration 048 — Final Technical Readiness

Local readiness exercise, 8–9 October 2026. Nothing in this document was run against production.
No migration was applied to `qouokiqoepjpoksupskb`, no release was built for distribution or deployed,
no staff account was activated and no production data was read or written by these checks (the only
production-derived input is the user-supplied pre-048 archive, restored into a disposable local container).

**Final decision: READY_WITH_CONDITIONS** (section 13 lists the conditions; none is an unresolved code defect).

---

## 1. Current Git baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD / origin/main | `168f52535d907b4ba9895f0c44a873b981db0b1e` (unchanged; nothing committed or pushed in this exercise) |
| Working tree | 21 modified tracked files, 5 untracked (section 2); none staged |
| CI | `.github/workflows/ci.yml` only (tests, no deploy job). Last green CI: run 37593463140 on `168f525`. **The uncommitted 048 fence/client changes have never run in CI.** |

Concurrent activity: other sessions edited this working tree during the exercise (files modified 09:25–19:22 UTC on
8 October) and also wrote test rows into the disposable behaviour database (section 8). Every result below was
re-checked against the tree as it stood when the result was produced.

## 2. Files modified (uncommitted, preserved as found)

048 write-protocol fence and client compatibility (from earlier local work, not by this exercise):

| File | Change |
|---|---|
| `supabase/migrations/048_server_receipt_allocation.sql` | + `st_guard_client_write_protocol()` and a BEFORE STATEMENT insert/update/delete/truncate trigger `st_client_write_protocol` on every existing public table. Non-trusted requests must send `x-smile-write-protocol: 048-v1`. |
| `supabase/rollbacks/048_server_receipt_allocation.rollback.sql` | Comment only: receipt rollback intentionally keeps the fence. |
| `src/sync/supabase-headers.js` (+ `www/`) | REST headers declare `048-v1`; `protocol: false` option. |
| `src/sync/staff-session.js` (+ `www/`) | Staff-login Edge Function call omits the protocol header (CORS fix, see section 9). |
| `src/sync/authoritative-writes.js` (+ `www/`) | A protocol refusal is classified as *unconfirmed* (item stays held on the device), not as a definitive rejection. |
| `src/sync/cloud.js` (+ `www/`) | Local backup requests declare `048-v1`. |
| `sync-server.js` | Local backup server rejects unmarked `POST /backup` with 409 before touching the file; CORS allows the header. |
| `service-worker.js` (+ `www/`) | Cache `smile-trust-susu-offline-v2` → `smile-trust-susu-offline-048-v1`. |
| `docs/RECEIPT-ALLOCATION-048.md` | Fence documentation. |
| `tests/authoritative-writes.test.js`, `tests/existing-user-client.test.js`, `tests/migration-048-receipt-allocation.test.js`, `tests/security-server-authorization.test.js` | Fixtures declare the protocol; new stale-client tests. |
| `tests/stale-snapshot-recovery.test.js` | One assertion accepts CRLF (`/\r?\nrollback;\r?\n/`, equivalent strength). A whole-file CRLF re-save (and of both `cloud.js` copies) was normalised back to LF before commit. |
| `supabase/rollbacks/048_write_protocol_fence.emergency-removal.sql` | New, reviewed emergency fence removal (section 12), with a database test in `tests/migration-048-receipt-allocation.test.js`. |
| untracked `tests/client-write-protocol.test.js`, `tests/staff-login-cors.test.js` | New tests. |
| untracked `supabase/preflight/048_production_preflight_readonly.sql`, `048_post_migration_readonly.sql` | Read-only preflight / post-check (now include fence checks). |

Excluded and untouched: `supabase/recovery/retire_stale_snapshot_DRY_RUN.sql`, `supabase/recovery/retire_stale_snapshot_WRITE.sql`,
`.tmp-test-out.txt`. `www/config.json` (untracked, local) unchanged, SHA-256 prefix `517BD0E9D713`.
Created by this exercise in the repository: this document only. (A stray 66-byte file created by a mis-parsed local
command, named after the password of an already-deleted disposable container, was removed.)

Secret scan of every changed/untracked file: no keys, JWTs, connection strings or keystore values; the only matches are
negative assertions and dummy fixtures in tests.

## 3. Backup SHA-256

| Item | Value |
|---|---|
| Path | `C:\Users\kingb\Documents\SMILE TRUST BACKUPS\smile-trust-pre048-2026-10-08.backup` |
| Size | 1,594,337 bytes (matches the reported size) |
| SHA-256 | `B1BFC7C8F2DBF2FEDC5A54B2758B6C58EBF8BAED83CC17ECB521972765F97F66` |
| Archive | custom format, gzip, created 2026-10-08 09:02:46, dumped from PostgreSQL 17.6 by pg_dump 18.6, 3,419 listed TOC entries |
| `pg_restore -l` | exit 0 |

The archive was only read; it was not moved, renamed or overwritten.

## 4. Isolated restore outcome — **RESTORE_PASS_WITH_DOCUMENTED_LIMITATIONS**

Target: a new Docker container from the local image `public.ecr.aws/supabase/postgres:17.6.1.166` (Supabase's own
PostgreSQL 17.6 with managed roles), bound to 127.0.0.1 only, random local password; new empty database
`st_restore_048_20261008144605`. Restored with PostgreSQL 18 `pg_restore` (owners and privileges kept).

`pg_restore` exit 1 with **28 errors, all reviewed**:

| Count | Error | Cause | Application impact |
|---|---|---|---|
| 26 | `role "supabase_realtime_admin" does not exist` on `ALTER ... OWNER` / `GRANT` in schema `realtime` | Managed Supabase Realtime role absent from this image version | None: the realtime objects themselves were created; only their owner/grant differs. No application table, row or function affected. |
| 2 | `CREATE EVENT TRIGGER ensure_rls` refused ("superuser owned event trigger must execute a superuser owned function"), then its `ALTER ... OWNER` | Production has a project-specific event trigger `ensure_rls` → `public.rls_auto_enable()` (auto-enables RLS on new tables). It is **not in the repository migrations**. `postgres` is not a superuser in the image. | Not needed by existing tables (all RLS flags restored). **A disaster restore into a new project must recreate it manually** (see rollback checklist). |

Archive-versus-catalog verification (every TOC entry in schemas `public`, `auth`, `storage`):

| Object class | Present / in archive |
|---|---|
| Tables | 385 / 385 |
| Views | 8 / 8 |
| Sequences | 7 / 7 |
| Functions (by name) | 126 / 126 |
| Constraints (incl. FK) | 633 / 633 |
| Indexes | 241 / 241 |
| Triggers | 29 / 29 |
| RLS policies | 415 / 415 |
| RLS enabled | 374 / 374 |
| Extensions | 4 / 4 |
| Data | 388 COPY blocks, **437 / 437 rows** restored exactly (public 350 blocks / 187 rows, auth 27 / 88, storage 8 / 73). Rows were counted by streaming the archive; no row content was printed or stored. |

Business records (counts only): businesses 1 (`SMILE-TRUST`), branches 1 (with collector code; receipt prefix `ACC`),
staff (`app_users`) 3 — all flagged active, staff auth links 1, customers 1, savings products 1, savings accounts 0,
collections 0, ledger entries 0, receipt counter 0, cloud snapshots 1 (id 2, saved 2026-10-05T10:44:18.728Z),
`auth.users` 1, `auth.mfa_factors` 0. Only one staff member has a cloud login link; AMA and KWAME were not touched.

## 5. Database fingerprint comparison

| Check (read-only preflight on the restored copy) | Result |
|---|---|
| Snapshot id 2 SHA-256 equals last verified checkpoint | PASS |
| Core relational fingerprint | **PASS — `574bd34af336b491bb4ebb76541310c0`, 341 tables, 173 rows** (identical to the historical reference) |
| Preflight verdict | `READY_FOR_048` — 25 PASS, 0 WARN, 0 FAIL |

This shows production matched the reference **as of 2026-10-08 09:02**. It is not evidence about production today;
the live read-only preflight must be repeated immediately before any migration.

## 6. Recovery-test failure investigation

Full suite in the main working tree (sequential, `--test-concurrency=1`): **1,148 tests — 1,136 pass, 12 fail, 0 skipped, 0 todo, 0 cancelled.**

All 12 failures are in `tests/stale-snapshot-recovery.test.js` (TAP 910, 915, 916, 918–924, 926, 927):

- Root cause: test 910 asserts the recovery SQL "ships with the placeholder, never a real fingerprint". The two
  excluded, locally modified files `supabase/recovery/retire_stale_snapshot_{DRY_RUN,WRITE}.sql` contain a pasted
  real fingerprint. The guard tests then stop with *"STOP: the payload fingerprint differs from step A"*, the row is
  not removed, and the later steps cascade (`23505 duplicate key ... smile_trust_cloud_snapshots_business_id_key`,
  `expected 0 rows, actual 1`).
- Classification: **working-tree baseline mismatch caused by the excluded local files.** Not a product defect, not a fixture defect.
- Evidence: a disposable worktree at `168f525` with every current change copied in **except** the two excluded files
  passes the **same suite 1,148 / 1,148 (0 fail, 0 skipped)**. No assertion was weakened and no test was skipped.
- The previously reported 13th failure (attributed to `Get-FileHash`) does not reproduce now. The only change to that
  file is the CRLF-tolerant `rollback;` assertion, which keeps the same requirement.
- To get a green main tree, either keep the recovery files excluded from test runs or restore their placeholders
  after the recovery work they belong to is finished. Neither was done here (the files are excluded from changes).

## 7. Full test results

| Run | Result |
|---|---|
| Main tree, full suite, sequential | 1,148: **1,136 pass / 12 fail / 0 skip / 0 todo** (section 6) |
| Clean worktree (current changes minus excluded files), full suite, sequential | **1,148 / 1,148 pass**, 0 skip |
| Wave 8 `validate:rc` (worktree, unmodified script) | First attempt stalled in parallel mode (`migration-046-without-rls-sql.test.js`, an unchanged file — the documented parallel embedded-database stall); only that run's own processes were stopped. Second attempt: **pass 1,148, fail 0, skipped 0, RC decision PASS** |
| Wave 9 `wave9:assess` | RC1 PASS, readyForWave9 true, **Go/No-Go = Conditional**: business UAT sign-off, training, financial reconciliation sign-off, executive sponsor and security acceptance pending (human sign-offs) |
| `check:www-sot` | OK, 7/7 sample paths match |
| Isolated restore + 048 rehearsal harness | **58 / 58 checks pass** (sections 4, 5, 8) |
| Real PostgREST v12.2.12 HTTP probe | **14 / 14 pass** (section 9) |
| Commit candidate (after LF normalisation and the fence-removal file + test), clean worktree, full suite, sequential | **1,149 / 1,149 pass**, 0 skip, 0 todo; 048 database file 22/22 |
| Emergency fence removal | Pass on its own clone of the restored copy (section 12) and in the 048 database test file |

## 8. Migration 048 rehearsal results (restored production copy only)

Pristine copy `st_restore_048_…`:

| Step | Result |
|---|---|
| 1 Preflight | `READY_FOR_048` (25 PASS) |
| 2 Apply 048 (`psql -1 -v ON_ERROR_STOP=1`) | exit 0 |
| 3 Post-check (filled with step-1 fingerprints) | `MIGRATION_048_VERIFIED` — 19 PASS, 1 INFO; core fingerprint unchanged `574bd34a…` |
| 4 Rollback | exit 0 |
| 5 Preflight after rollback | `READY_FOR_048` (25 PASS); fence intentionally still on 350/350 public tables |
| 6 Re-apply 048 | exit 0 |
| 7 Post-check | `MIGRATION_048_VERIFIED` — 19 PASS |

Behaviour clone `st_behaviour_048_…` (synthetic UAT branch, 3 collectors, 11 members, legacy receipts `ACC-00000041`,
`UKS-7`, `legacy receipt #9`, ledger `WDL-50`), all through real separate database connections:

| Property | After 048 | After rollback | After re-apply |
|---|---|---|---|
| Counter seeding to highest numeric suffix, no receipt renumbered | 50 ✔ | not lowered ✔ | 9001 (past rollback-period device receipt) ✔ |
| Server receipt, device receipt ignored, one collection + one matching ledger credit | ✔ `ACC-00000051` | 047 behaviour: device receipt kept ✔ | ✔ `ACC-00009002` |
| Lost-response retry after commit returns original receipt, nothing posted twice | ✔ | ✔ | ✔ |
| Failed transaction: nothing posted, number released | ✔ | — | ✔ |
| 24 concurrent collector transactions (2 collectors): 24 distinct consecutive receipts | ✔ | — | ✔ |
| Simultaneous duplicate submission: second waits, gets the first receipt; if the first fails, retry records once | ✔ | — | ✔ |
| Prefix from the member's branch (`UKS`), not the payload | ✔ | — | ✔ |
| Fence: missing / `{}` / malformed / `047` / `999` / `048-V1` refused 42501 with no state change | ✔ | ✔ (fence kept) | ✔ |
| Unmarked direct DML and snapshot writes refused; reads work | ✔ | — | ✔ |
| Declared protocol cannot bypass 047 authorization (other collector's member, wrong business, inactive staff) | ✔ | — | ✔ |
| Clients cannot call allocator / internal write / fence function or move the counter | ✔ | — | ✔ |
| Service-role session (staff-login Edge Function path) not blocked | ✔ | — | ✔ |
| No duplicate receipt in the business, no double ledger credit | ✔ | ✔ | ✔ |

Rollback findings: the rollback restores the 047 internal function and import wrapper and drops the allocator; it
never lowers counters or changes receipts. It deliberately **does not** remove the write fence.

## 9. Old-client compatibility findings

**Server enforcement exists in code but is not in production.** The fence is part of the uncommitted 048 and is
enforced in the database (statement triggers, so it also covers SECURITY DEFINER RPCs, direct REST DML, snapshot
writes and zero-row statements). Until 048 is applied and verified in production, **old clients can still write
through the existing production RPCs — release blocker until then.** No production protection is claimed.

Verified locally:

| Scenario | Finding |
|---|---|
| Missing / unsupported / malformed protocol | Refused 42501 before any write (SQL and real HTTP); counters and receipts unchanged |
| Client attempting to bypass | The header is a compatibility declaration, not authentication: a forged `048-v1` passes the fence but still meets 047 authorization (business scope, active staff, assignment, RLS) — verified. Leaked service-role keys or privileged proxies bypass the fence by design. |
| Real PostgREST (v12.2.12, same version family as Supabase) | Header reaches `request.headers`; CORS preflight from `https://localhost` (browser/Capacitor) and `null` (Electron `file://`) allows `x-smile-write-protocol`; current client headers record; old headers get 403/42501 (anon portal: 401/42501); old direct PATCH 403; old reads 200; service role 200. 14/14. |
| **Defect found and verified fixed** | Adding the protocol header to every request also added it to the staff-login Edge Function call, whose CORS allow-list lacks it: the browser preflight would fail and **cloud staff sign-in would break in web, Capacitor and Electron**. The tree now omits the header for that call (`protocol: false`); `tests/staff-login-cors.test.js` asserts every header sent passes the function's real OPTIONS response. |
| Current client receiving a fence refusal | Item stays held on the device ("update Smile Trust before syncing"), not dropped (test 9b). |
| Network failure / delayed response during write | Classified as unconfirmed; held; retry is idempotent (same receipt). There is no separate "version validation" request: the declaration travels on each write, so there is no cached or delayed version answer to trust. |
| Fresh browser install | New service worker caches `…-048-v1`; code sends `048-v1`. |
| Browser with old cached code / service-worker upgrade | New SW installs with `skipWaiting` + `clients.claim` and deletes old caches; the next load runs new code. |
| Stale open tab / existing logged-in session | Old code keeps running in memory (no reload on `controllerchange`); its writes are unmarked and are refused by the server once 048 is live. A session token alone does not help it. |
| Old Android APK (2026-09-30 build in `android/app/build/outputs`) | Bundles its own assets; Android unregisters the service worker. Cannot be updated by cache bump. Its cloud writes are refused after 048; its local data stays on the device (old code saves locally first and reports the cloud error). |
| Old Electron app (2026-09-30, `dist/`) | `publish: null` — no auto-update channel; must be replaced manually. Unmarked writes refused after 048. Its bundled old `sync-server.js` still accepts unmarked local backup uploads (local only, not financial). |
| `168f525`-era client (never distributed; no deploy pipeline exists) | Would treat the 42501 as definitive and mark a held collection failed. Do not distribute it. |

Residual risks: Supabase's hosted gateway (Kong) CORS and header forwarding were not exercised (no approved UAT
project); future public tables need the fence trigger; old devices may hold unsynced items that must be reconciled
manually before upgrade; locally printed receipts from old devices are not authoritative.

## 10. APK / Electron / Web build results (test artifacts only — not for distribution)

All built in the disposable worktree from `168f525` + current changes (minus excluded files). `www/config.json` is a
local untracked file, so these artifacts contain **no cloud configuration** and are not functionally equivalent to a
production build.

| Platform | Result |
|---|---|
| Web | `prepare:web` ok; `check:www-sot` 7/7; cache `smile-trust-susu-offline-048-v1` in root and `www/` |
| Electron | `electron-builder --win dir` ok (electron 37.10.3, builder 26.8.1). `SmileTrustSusu.exe` 204,521,984 bytes, SHA-256 `EDE02B2E497BCC03509B417740D9561A524D8AA3D69C2809EF32BAB107153362`; `app.asar` SHA-256 `00D23F7DF3881AFAE622089DC052ED7AE81F1D9E608804B93CA67A4EFFD95166`. Asar contains the 048-v1 REST header, staff-login `protocol: false`, refusal-held handling, local-backup header, SW cache 048-v1 and the fenced `sync-server.js`. **Unsigned** (`signAndEditExecutable: false`); no update feed (`publish: null`). NSIS/portable installers not built. |
| Android | Capacitor `appId` `com.kba.susu`, `webDir` `www`, `androidScheme` https. JDK 21.0.12, AGP 8.7.2, Gradle 8.11.1, compile/target SDK 35, min 24. `cap:sync` ok. `assembleDebug` BUILD SUCCESSFUL: `app-debug.apk` 12,339,231 bytes, SHA-256 `0ED52D971C9FE9BA34EB4064205E61436E7DB8DBE3250D3EBE08B1A4EE69DDA6`, package `com.kba.susu`, signed with the **Android Debug** certificate. Assets contain all 048 protections. |
| Android release | Not built: the release keystore (`android/keystore.properties`, never read) exists only in the main tree, and producing a production-signed APK from uncommitted code is not appropriate. Release `versionCode` is still 1 / `versionName` 1.0 — **bump before the 048 release** so old and new installs are distinguishable. A debug-signed APK cannot upgrade a release-signed install. |

## 11. UAT readiness

No approved UAT Supabase project was used. Database-level UAT was executed on the isolated restored copy (section 8);
**UI/device UAT is pending** an approved environment (an isolated project, or a local Supabase stack with the 048
code) and release-candidate builds with that environment's configuration.

Ten test members `UAT-01`…`UAT-10`, collectors `UAT-COL-1` (members 1–5) and `UAT-COL-2` (6–10), one manager.

| # | Case | Expected |
|---|---|---|
| 1 | Register 10 members online (manager) | Each saved once; server ids; audit entries |
| 2 | Assign collectors | Collector sees only own members; cannot record for the other collector's member (42501) |
| 3 | Savings collection, each member | Receipt `ACC-NNNNNNNN` from the server; device shows "Pending reference — not a receipt" until confirmed |
| 4 | Duplicate submission (double tap / two devices same item) | One collection, one ledger credit, same receipt on both |
| 5 | Timeout after commit (cut network after send) | Held as unconfirmed; "Confirm with server" returns the original receipt; no double posting |
| 6 | Offline pending collection | Held offline, not counted in balances; confirmed on reconnect with a server receipt |
| 7 | Collector vs manager permissions | Collector cannot edit/delete posted rows, change counters or call internal functions; manager actions need MFA |
| 8 | Verification status | Collections show verification status as stored; changing it follows existing manager rules (no 049 behaviour) |
| 9 | Rejected payments | Server refusal → "NOT recorded, nothing posted"; protocol refusal → held, not dropped |
| 10 | Ledger reconciliation | Σ collections = Σ collection credits per member; every collection has exactly one credit with the same receipt; no duplicate receipts |
| 11 | Cloud synchronization | Second device sees identical receipts/balances after refresh; snapshot only via authorised path |
| 12 | Audit trail | Actor = signed-in staff, not payload; timestamps; refused writes leave no partial rows |
| 13 | Old-client fence | Install the 2026-09-30 APK/Electron against UAT after 048: writes refused, reads ok, local data retained |

Payment verification (proposed migration 049) is out of scope and was not implemented.

## 12. Rollback readiness checklist (no production rollback executed)

1. **Archive preserved**: keep `smile-trust-pre048-2026-10-08.backup` read-only plus an offline copy; never overwrite.
2. **Hash**: verify SHA-256 `B1BFC7C8…7F66` before any use; `pg_restore -l` exit 0.
3. **Restore instructions**: restore only into a new database/project with PostgreSQL 18 `pg_restore`; expect the 26
   realtime-role ownership errors on non-matching images; recreate `public.rls_auto_enable()` + event trigger
   `ensure_rls` as a superuser-capable role; run the read-only preflight and compare the core fingerprint.
4. **048 receipt rollback**: `supabase/rollbacks/048_server_receipt_allocation.rollback.sql` in one transaction
   (`psql -1 -v ON_ERROR_STOP=1`); then the preflight must say `READY_FOR_048` (rehearsed twice).
5. **Functions/privileges**: rollback restores the 047 internal write and import wrapper and drops allocator/helpers;
   preflight 02 checks bodies and client privileges.
6. **Receipt sequences**: counters are never lowered; receipts never renumbered; a later re-apply re-seeds above any
   device receipt issued during rollback (rehearsed: 9001).
7. **Write fence**: stays installed after receipt rollback. Emergency removal:
   `supabase/rollbacks/048_write_protocol_fence.emergency-removal.sql` (drops only the fence triggers and the fence
   function; allocator, counters, receipts, grants and 047 authorization unchanged; re-applying 048 reinstalls the
   fence). Tested on a clone of the restored copy (350 triggers removed) and by
   `tests/migration-048-receipt-allocation.test.js`. Needs its own written approval.
8. **Ledger reconciliation** after any rollback: every collection has exactly one credit with the same receipt; no
   duplicate receipts per business; counter ≥ highest numeric suffix.
9. **Client/server compatibility**: after a receipt rollback the clients must still send `048-v1` and supply receipts;
   do not redistribute unmarked old builds. 048-era clients against a pre-048 server get no server receipt.
10. **Release rollback risk**: APK/Electron installs cannot be recalled remotely; web clients follow the SW. Re-applying
    047 later regresses the import wrapper — re-apply and verify 048 afterwards.
11. **Approvals**: written approval from the System Owner for (a) migration, (b) any rollback, (c) fence removal,
    (d) each release distribution; second person to verify hashes and post-checks.

## 13. Remaining blockers and conditions

| # | Item | Type |
|---|---|---|
| 1 | Old clients can write through production RPCs until 048 **with the fence** is applied and verified in production | Release blocker (cleared only by the approved migration + post-check) |
| 2 | Fence, CORS fix and client changes are **uncommitted and have never run in CI**; normalise the CRLF re-save of `tests/stale-snapshot-recovery.test.js`; commit, push (approval required) and get CI green on the exact SHA | Condition |
| 3 | Hosted Supabase gateway behaviour (CORS for `x-smile-write-protocol`, header forwarding) unverified; verify in an approved UAT project, or with a read-only `OPTIONS` request plus the post-migration smoke test | Condition |
| 4 | Old-client mitigation needs human approval: retire 2026-09-30 APK/Electron, reconcile their held/queued items before upgrade, ship replacements | Condition |
| 5 | Signed Android release with bumped versionCode and Electron installers must be built from the approved commit with the approved `www/config.json`; Electron remains unsigned | Condition |
| 6 | Emergency fence-removal script: committed locally with a database test; review before cutover | Condition |
| 7 | Fresh live read-only preflight immediately before migration (production may have changed since 2026-10-08 09:02) | Condition |
| 8 | UI/device UAT (section 11) and Wave 9 human sign-offs | Condition |
| 9 | Main-tree suite has 12 environment failures from the excluded recovery files | Housekeeping |
| 10 | Parallel embedded-database test stall (Wave 8 needed a second attempt) | Known tech debt |

## 14. Production safety confirmation

- No connection was made to `qouokiqoepjpoksupskb` or any other Supabase project; `angoswtgcklnorhlosnf`/NORTHRISE not used.
- Migration 048 was applied only to disposable local databases inside container `st-restore-048-20261008142250`
  (127.0.0.1 only). No `supabase db push`, no Edge Function deployment, no release distributed.
- No production user, balance, receipt, collection, ledger entry or snapshot was modified; AMA/KWAME not activated;
  JOHN's authentication/MFA untouched. The release keystore and `keystore.properties` were not read.
- Backup archive read only. Excluded files and `www/config.json` unchanged. Nothing committed or pushed.
- No credentials, JWTs or member data appear in this report or in the harness output (counts, digests and error classes only).

Local leftovers for reproducibility: container `st-restore-048-20261008142250` (disposable restore target) and
worktree `%TEMP%\st-wt-final` with the test artifacts above; harness scripts and logs in `%TEMP%` (`st-048-*`).
Remove when no longer needed (remove the worktree's `node_modules` junction with `rmdir` first).

## 15. Recommended next action

1. Review and approve the uncommitted 048 fence/client changes (including the staff-login CORS fix), normalise line
   endings, commit, push and confirm CI on the exact SHA.
2. Approve the old-client plan and review the emergency fence-removal script.
3. Run UI UAT in an approved isolated environment, including the hosted-gateway header/CORS check.
4. Then request approval for a live **read-only** preflight; only after it reports `READY_FOR_048` request separate
   approval for the controlled migration, followed immediately by the post-migration check and release of the new builds.

**STOP. Migration 048 has not been applied. No release has been deployed. Awaiting explicit approval.**
