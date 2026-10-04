# Controlled recovery of the stale SMILE-TRUST cloud snapshot

**Status: prepared and rehearsed locally. Not executed. Gate 0 (a client blocker) is open. Do not start step C until Gate 0 is closed.**

Project: `qouokiqoepjpoksupskb` only. Project `angoswtgcklnorhlosnf` belongs to another system: never access, inspect, copy from, deploy to, migrate or modify it.

## What this runbook does

The production row `public.smile_trust_cloud_snapshots` for `SMILE-TRUST` is stale. The forensic inspection on 2026-10-04 found:

- the row has id 1, was saved by john at 2026-10-03 13:07:46.196 UTC, and has been rewritten 4 times;
- it uses the old full device-state format and contains no credentials;
- it holds staff 4 and savings products 14, while the database holds staff 3 and savings products 1.

The runbook preserves the row as evidence, retires it with a single guarded removal, and has JOHN create the first authoritative snapshot through the protected Initial Cloud Snapshot workflow. It then verifies the result.

End state:

1. The stale row is preserved as a private local evidence file.
2. The stale row is removed, and nothing else in the database changes.
3. Only the committed web client at commit 11be35b or later is used.
4. The snapshot is built from a fresh database load and contains members 1, staff 3, groups 1, collections 0, savings products 1.
5. The relational tables are unchanged, and the snapshot holds no secrets.

## Artifacts

| File | Purpose | Touches production? |
|---|---|---|
| `supabase/preflight/stale_snapshot_recovery_checkpoint_readonly.sql` | Read-only checkpoint, run at steps A, E and I and in section J | Read only |
| `supabase/preflight/first_snapshot_bootstrap_readonly.sql` | Existing read-only preflight (047 protections, JOHN, AMA, KWAME) | Read only |
| `supabase/preflight/existing_snapshot_forensics_readonly.sql` | Existing read-only forensics, reused at step I | Read only |
| `scripts/recovery/Export-StaleSnapshotEvidence.ps1` | Step B evidence export | Read only |
| `supabase/recovery/retire_stale_snapshot_DRY_RUN.sql` | Step C1 dry run; always rolled back | No (rolled back) |
| `supabase/recovery/retire_stale_snapshot_WRITE.sql` | Step C2 retirement | **PRODUCTION WRITE W1** |
| `scripts/recovery/serve-recovery-client.mjs` | Step F local server for the committed `www/` client | No |
| `tests/stale-snapshot-recovery.test.js` | Local rehearsal of the whole runbook | Local only |

## Production write inventory (K)

Every production write requires the approver to write the exact approval line **immediately before** that step, in the same session. An approval does not carry over to a retry, a later day, or a changed file.

| Id | Step | What is written | Approval line |
|---|---|---|---|
| W1 | C2 | Removal of the one stale snapshot row (id 1) | `APPROVED W1: retire stale snapshot id 1, fingerprint <first 12 chars>` |
| W2 | G | JOHN's sign-in side effects, all expected and excluded from the core fingerprint: a login attempt, an Auth session, the MFA replay counter, and possibly a security event | `APPROVED W2: JOHN signs in to the recovery client` |
| W3 | H | The Initial Cloud Snapshot: one new snapshot row | `APPROVED W3: create initial cloud snapshot 1/3/1/0/1` |
| W4 | J (emergency only) | Re-inserting the stale row from evidence | `APPROVED W4: restore stale snapshot evidence` |

Nothing else in this runbook writes to production. Steps A, B, C1, E and I are read only, or rolled back in the case of C1.

---

## Gate 0: BLOCKER in the 11be35b client (must be closed before step C)

**Problem.** In the 11be35b app, the Initial Cloud Snapshot is not the last write. The app overwrites it about 3.5 seconds later with device-normalised state. The sequence in `createInitialCloudSnapshotFlow` (`app.js`) is:

1. It posts the correct database-built snapshot.
2. It runs `state = normalizeState(deviceStateAfterBootstrap(...))` and then calls `saveState()`.
3. `saveState()` always calls `queueCloudBackup()`, which runs `pushCloudBackup(true)` 3500 ms later.
4. The app's `normalizeState` calls:
   - `ensureSavingsProducts`, which appends the 14 default savings products, none of which is the database's `SUSU-DAILY` product;
   - `ensureSystemAccounts`, which adds the `KBA` bootstrap account (`u-superadmin`).
5. The push merges this into the cloud copy and PATCHes it. The snapshot becomes staff 4 and savings products 15, in the device format.

That is the same shape as the stale row: 4 staff, 1 id not in the database, and 14 products that are not in the database. The old client almost certainly produced the stale row the same way.

**Consequence.** Following steps F to I with 11be35b as it is would retire the stale row and then recreate the same kind of stale row within seconds. Step I would fail. There is no reliable manual workaround: the 3.5 s timer starts as the success message appears, and blocking the network also blocks the reads the bootstrap needs.

### Auto-upload audit (4 Oct 2026): `AUTO_UPLOAD_RISK_NOT_CLOSED` for 11be35b

**Creating a row from nothing (0 → 1) is closed in 11be35b.** The only client INSERT into `smile_trust_cloud_snapshots` is `createInitialCloudSnapshot` (`src/sync/snapshot-bootstrap.js`). Every other path ends in `pushCloudBackup` (`src/sync/cloud.js`). That covers startup, login, `saveState` and its 3.5 s timer, the 12 s background merge, portal ingestion, Sync now, manual Back up to cloud and every action handler. `pushCloudBackup` reads the cloud first. If the read fails it refuses with `CLOUD_READ_FAILED`. If the row is missing it refuses with `CLOUD_BOOTSTRAP_REQUIRED`. When the row exists it only PATCHes, and it fails if the PATCH matched nothing. Collectors go through `st_submit_collections`, which updates only. Restore and replace flows only read. The local-mode `/backup` endpoint writes a file and never reaches Supabase. No database function inserts snapshot rows.

**Still open in 11be35b: the new row is overwritten automatically after the bootstrap.** Several things fire after the POST and PATCH device-normalised state over the new row:

- the post-bootstrap `saveState()` timer;
- any autosave timer queued before the POST;
- a push that read the cloud after the POST;
- the background merge, while `localSavePending` is set.

**Prepared fix (local, uncommitted).** It pauses every snapshot upload from the page from the moment the insert is about to be sent until the app is reopened:

- `src/sync/cloud.js`: `pauseCloudUploads` and `cloudUploadsPaused`. `pushCloudBackup` returns before doing anything while paused, including its busy reschedule. It also counts uploads in flight so the bootstrap can wait for them.
- `src/sync/snapshot-bootstrap.js`: after the typed confirmation, it pauses uploads, waits for in-flight uploads to finish, and re-checks that the row is missing. Only then does it make the single-use plain POST. Uploads resume only if the POST was never sent.
- `app.js`: the push wrapper and `queueCloudBackup` do nothing while paused. The bootstrap flow cancels the pending timer and clears `localSavePending`.
- `www/`: an identical mirror of all three files.
- `scripts/recovery/serve-recovery-client.mjs`: refuses to serve a client without the pause.

**What the fix does not change.** After the recovery window, ordinary manager sync works by design. The first ordinary manager upload after the app is reopened writes the device format into the same row (staff 4 including the KBA placeholder, savings products 15). It never adds a second row. The rehearsal shows this explicitly. Step I must therefore pass before any manager client is reopened. Whether ordinary sync should stop uploading device-only defaults is a separate product decision, outside this recovery.

**Old clients are UNSAFE FOR THIS RECOVERY:**

- every APK built before the fix commit;
- every Electron EXE built before the fix commit;
- any browser profile that loaded `:5173` or an older client.

Builds older than 11be35b can INSERT the first snapshot from device state as soon as the row is missing, which is how the stale row most likely appeared. Builds from 11be35b without the fix overwrite the new row.

**Gate 0 closes only when all of these hold:**

1. The fix is reviewed and committed.
2. CI is green for that commit.
3. The recovery client is served from that commit, or a reviewed descendant, by `serve-recovery-client.mjs`.
4. Every old client is closed (see "Before you start").
5. Fresh production read-only prechecks (step A) pass on the day.
6. The approver gives explicit approval (W1) immediately before the DELETE.

Record the fix commit hash here. Steps A and B are read only and may run before Gate 0 closes. Steps C onward may not.

### No other device may sync during the window

The window is the time from step C2 until step I passes. The guarantee is operational. It does not weaken any database protection:

- Only an activated manager session can write the snapshot (047 policies). JOHN is the only activated manager; AMA and KWAME stay unactivated, and collectors cannot write it.
- JOHN signs out of, and closes, every other client before C2: phones, desktop EXE, other browsers. They stay closed until I passes. No APK or EXE is distributed.
- Step A records `01 phase` activity counters. Step E must show 0 rows, and step I must show exactly one new row whose PAYLOAD FINGERPRINT does not change over the 10-minute re-check. Any extra write shows up there and means STOP.
- Do not revoke policies, ban users or change Auth to enforce this. Those are production changes outside this runbook.

---

## Before you start

- **Close every old client** that could hold a live JOHN or AMA manager session. An old client with a live session can recreate the row as soon as it is removed. This includes:
  - the browser window or profile that used `http://127.0.0.1:5173` (or `localhost:5173`);
  - any installed Electron EXE;
  - any Android APK;
  - any other device or browser where JOHN or AMA signed in.

  Do not reopen any of them until step I has passed. Do not distribute any APK or EXE.
- **Find the database host.** In the Supabase dashboard for `qouokiqoepjpoksupskb`, open Connect and then Session pooler, and note the host (`aws-0-<region>.pooler.supabase.com`). The user is `postgres.qouokiqoepjpoksupskb`. The password is typed only into psql's own prompt: never into a command line, a file, a chat or this runbook.
- **Who does what:**
  - an operator runs the SQL and scripts;
  - the approver gives W1 to W4;
  - JOHN types his own password and MFA code.

  Nobody else sees, records or stores JOHN's credentials, the MFA secret or any token.
- **Where SQL runs:** the Supabase SQL Editor of `qouokiqoepjpoksupskb`. Check the project ref in the URL before every run. Paste each file whole and unchanged; the only permitted edit is the fingerprint placeholder in C1 and C2.

---

## A. Final read-only pre-removal verification

1. Run `stale_snapshot_recovery_checkpoint_readonly.sql`. The expected result:
   - verdict **`STALE_SNAPSHOT_READY_TO_RETIRE`**, with `0 FAIL` and phase `STALE`;
   - `03 stale identity`: all 5 rows PASS (id 1, saved_by john, saved_at 2026-10-03 13:07:46.196 UTC, staff 4 / members 1 / groups 1 / collections 0 / savings products 14, older format);
   - `05 safety`: all PASS. This covers no secret keys, no credential-shaped values, no history or lifecycle events, RLS, the 3 policies, privileges, the guard, nothing running on removal, and no foreign keys;
   - `06 relational`: the first row PASSes (database members 1, staff 3, groups 1, collections 0, savings products 1).
2. Write down three values:
   - `02 row / PAYLOAD FINGERPRINT`: the 64 hex characters (**P**);
   - `06 relational / CORE RELATIONAL FINGERPRINT`: the 32 hex characters plus the table and row counts (**R**);
   - `01 phase / snapshot table activity counters` (**S**).
3. Run `first_snapshot_bootstrap_readonly.sql`. Expect `NOT_READY_FOR_INITIAL_SNAPSHOT` with exactly 1 FAIL, the existing-snapshot check, as on 2026-10-04. All `02 047 protections` rows should PASS.
4. Wait at least 10 minutes with every old client closed, then re-run the checkpoint. P and saved_at must be identical, and "changed rows" in S must not have increased. **If P or saved_at changed, or the counter rose, a client is still writing: STOP.** Find and close it, then start again at A.1.

Any other verdict, or any FAIL, means STOP. Do not continue.

## B. Evidence preservation (read only)

**Should the stale row be exported before removal? Yes.** Removal is irreversible, and this row is the only record of what the old client uploaded. That record matters for forensic follow-up and, in the worst case, for the emergency restore in section J. The forensic inspection found no credentials, but the row does contain member records, so the export must stay private and must never be printed.

How the export avoids printing or exposing the payload:

- It runs one read-only transaction (`begin transaction read only` … `rollback`), so nothing in the database changes.
- psql writes the payload straight to a file with `\o`. The console shows only the folder, byte count, top-level key count and SHA-256.
- The folder is created under `%LOCALAPPDATA%\SmileTrustRecoveryEvidence\`, outside the repository and outside OneDrive. Its ACL allows only the current Windows user, and the files are marked read-only.
- The folder and file names start with `STALE-DO-NOT-RESTORE`, and the metadata carries the same warning, so the file cannot be mistaken for an active snapshot.
- The script fails, and marks the folder INVALID or CHANGED, unless the file's SHA-256 equals both the database's own fingerprint and P from step A.

**Rejected alternative:** an archive table or row in production. It would need a schema change (a production write). Anything in `public` is reachable through the API unless it is locked down separately. A second copy of the payload inside the database could also be mistaken for an active snapshot.

Run this command in PowerShell from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recovery\Export-StaleSnapshotEvidence.ps1 `
  -DbHost <session pooler host> -ExpectedFingerprint <P>
```

psql asks for the database password itself. Expected output:

```text
Evidence exported (read-only transaction, nothing changed in the database).
  folder         : C:\Users\<you>\AppData\Local\SmileTrustRecoveryEvidence\STALE-DO-NOT-RESTORE_SMILE-TRUST_snapshot-id1_<UTC stamp>
  payload bytes  : <n>
  top-level keys : <n>
  SHA-256        : <P>
  matches step A : yes
```

Record the folder path. Do not open, copy, upload or attach the file anywhere. If the script prints `STOP`, do not continue to C.

## C. Retirement

### C1. Dry run (rolled back, not a production write)

1. Open `supabase/recovery/retire_stale_snapshot_DRY_RUN.sql`. Replace the single placeholder value of `c_fingerprint` with P, and change nothing else.
2. Run it. The **expected result is an error** that reads:
   `DRY RUN PASSED: the stale row (id 1, fingerprint <P>) matched every guard and would be removed; this dry run was rolled back and nothing was changed`
3. Re-run the checkpoint. The verdict must still be `STALE_SNAPSHOT_READY_TO_RETIRE` with the same P.

Any error starting `STOP:` means a guard failed and nothing changed. Stop and investigate.

### C2. Removal: PRODUCTION WRITE W1

1. Confirm that A, B and C1 passed in this session and that Gate 0 is closed.
2. **The approver writes `APPROVED W1: retire stale snapshot id 1, fingerprint <first 12 chars of P>`.**
3. Open `supabase/recovery/retire_stale_snapshot_WRITE.sql`, replace the placeholder with P, and run it once.
4. The expected result is one row: `RETIRED: 0 snapshot rows remain`.

The statement removes the row only if every guard holds:

- there is exactly one row in the table, and it is the SMILE-TRUST row with no key variants;
- it has id 1, saved_by john and saved_at 2026-10-03 13:07:46.196 UTC, the legacy key is empty, and the contents are 4/1/1/0/14;
- the SHA-256 of the payload equals P;
- there is no posted history and no lifecycle events;
- no foreign keys and nothing runs on removal.

The removal itself repeats the id, business, saved_by, saved_at and fingerprint conditions, and it must affect exactly 1 row.

## D. Transaction boundaries and rollback

- **The checkpoint and the export:** each runs in its own read-only transaction. They cannot write.
- **C1 and C2:** each is one `DO` statement, and therefore one transaction. The statement first locks the snapshot table against concurrent client writes (reads continue), with `lock_timeout` 5 s. Every guard failure raises an exception, and the exception rolls back everything the statement did. C1 always ends by raising `DRY RUN PASSED`, so it always rolls back.
- **If C2 errors:** nothing was removed. Re-run the checkpoint to confirm the row and P, then investigate.
- **If C2 succeeded:** the removal is committed and cannot be undone by a database rollback. The only way back is the evidence file, using the emergency restore in section J (W4). Normally you should not go back. The safe state after C2 is "no snapshot": 11be35b clients cannot create one by autosave, and collectors' work stays queued on their devices.
- **W3:** JOHN's Initial Cloud Snapshot is a single insert. If a row exists the server rejects it, and it never overwrites.

## E. Post-removal read-only verification

1. Run the checkpoint. The expected result:
   - verdict **`SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP`**, with `0 FAIL` and phase `ABSENT`;
   - `01 phase / snapshot rows in the table`: `total 0, SMILE-TRUST 0, case/spacing variants 0`;
   - `02 row / PAYLOAD FINGERPRINT`: `no row`;
   - `06 relational / CORE RELATIONAL FINGERPRINT`: **identical to R**, including the table and row counts;
   - `06 relational / database counts …`: PASS.
2. Run `first_snapshot_bootstrap_readonly.sql`. Expect **`READY_FOR_INITIAL_SNAPSHOT`** with 0 FAIL. Its section 04 shows the expected bootstrap summary of members 1, staff 3, groups 1, collections 0, savings products 1.

If R differs, compare the `06 relational / core table …` rows with the ones saved at A to find which table changed. Then STOP.

## F. Serve the committed client (11be35b or later, with the Gate 0 fix)

Run these commands in PowerShell at the repository root:

```powershell
git fetch --all
git checkout <approved commit, 11be35b or later>     # the Gate 0 fix commit
git merge-base --is-ancestor 11be35b HEAD; if ($LASTEXITCODE -ne 0) { throw "not 11be35b or later" }
git status --short                                   # no changes to www/, src/, app.js, index.html
node scripts/recovery/serve-recovery-client.mjs 5180
```

The server:

- refuses to start unless HEAD contains 11be35b, the served files have no uncommitted changes, the `www/` mirror matches the root sync modules, the client contains the post-bootstrap upload pause, and `www/config.json` points at `qouokiqoepjpoksupskb` without server secrets (the file is checked, never printed);
- serves only `www/`, only on `127.0.0.1`, with `Cache-Control: no-store`;
- withholds `service-worker.js`, so no cached older assets can load.

Do **not** use:

- `node server.js` (it serves the repository root on all interfaces, at the old origin `:5173`);
- `npm run prepare:web`;
- any Android APK;
- any Electron build;
- any previously opened browser profile.

## G. JOHN signs in: PRODUCTION WRITE W2 (sign-in side effects)

1. **The approver writes `APPROVED W2: JOHN signs in to the recovery client`.**
2. Open a brand-new, empty browser profile on the recovery origin, for example:

   ```powershell
   $profileDir = Join-Path $env:TEMP ("st-recovery-profile-" + (Get-Date -Format yyyyMMddHHmmss))
   Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
     -ArgumentList "--user-data-dir=`"$profileDir`"", "--no-first-run", "--disable-extensions", "--inprivate", "http://127.0.0.1:5180/"
   ```

   Chrome works the same way with `--user-data-dir` and `--incognito`. The new profile has no site storage, cache, service worker or saved session from the old client.
3. JOHN types his own username, password and MFA code. Everyone else looks away. There is no screen sharing or recording. Decline any offer to save the password. Nobody writes down, pastes or photographs any of it.
4. Do not touch any other screen before step H.

If JOHN cannot sign in, go to section J.

## H. Initial Cloud Snapshot: PRODUCTION WRITE W3

1. JOHN opens the **Backup** page and, in the **Initial Cloud Snapshot** panel, presses **Create Initial Cloud Snapshot**. The app loads the business from the database and shows a confirmation.
2. **Check the confirmation numbers.** They must read exactly `members 1, staff 3, groups 1, collections 0, savings products 1`.
   **If any number differs, press Cancel. STOP.** Nothing is written (see section J).
3. **The approver writes `APPROVED W3: create initial cloud snapshot 1/3/1/0/1`.**
4. JOHN presses OK, types `SMILE-TRUST` exactly, and confirms.
5. The expected message is "Initial cloud snapshot created. Cloud uploads stay paused on this device until the app is reopened."
6. Leave the window idle for 60 seconds, then close the recovery browser window. Do not reopen it, and do not open any other client, until step I has passed: a reopened manager client resumes ordinary sync.

## I. Post-bootstrap verification (read only)

1. Run the checkpoint. The expected result:
   - verdict **`INITIAL_SNAPSHOT_VERIFIED`**, with `0 FAIL` and phase `BOOTSTRAPPED`;
   - `01 phase / snapshot rows in the table`: `total 1, SMILE-TRUST 1, case/spacing variants 0`, so the count went from 0 to 1;
   - `02 row`: row id above 1, saved_by `john (staff, SystemOwner, active)`, format `database-bootstrap format of commit 11be35b`, contents `members 1, staff 3, groups 1, collections 0, savings products 1`;
   - `04 initial snapshot`: all 8 rows PASS. This covers a new row, saved by JOHN, bootstrap format, counts 1/3/1/0/1, counts equal to the database, ids agreeing both ways, every other module empty, and the businessId;
   - `05 safety`: all PASS. This covers no secret keys, no credential-shaped or TOTP-shaped values, no history or lifecycle, and the 047 protections intact;
   - `06 relational / CORE RELATIONAL FINGERPRINT`: **identical to R**.
2. Run `existing_snapshot_forensics_readonly.sql`. Expect **`EXISTING_SNAPSHOT_APPEARS_VALID`**: 0 CONCERN, 0 STALE, 0 UNCLEAR, with `07 format / structure` reading "matches the database-load bootstrap format of commit 11be35b".
3. Run `first_snapshot_bootstrap_readonly.sql`. Every `02 047 protections` row must PASS. The verdict is `NOT_READY_FOR_INITIAL_SNAPSHOT` only because a snapshot now exists, which is expected.
4. Wait 10 minutes and re-run the checkpoint. The new row's PAYLOAD FINGERPRINT must not change, which shows no client overwrote it.

Record the new row id, the new PAYLOAD FINGERPRINT, and R.

---

## J. Recovery and rollback cases

| Situation | What it means | What to do |
|---|---|---|
| **Removal succeeded, the bootstrap failed** (an error in H, or the window closed) | Production is in the safe "no snapshot" state. 11be35b clients cannot create one by autosave. | Do not restore the stale row. Keep old clients closed. Re-run E (expect `SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP` and R unchanged). Fix the cause, then repeat F to I with new W2 and W3 approvals. |
| **A different snapshot appears between removal and bootstrap** (checkpoint `UNKNOWN_SNAPSHOT_STOP` or `UNEXPECTED_SNAPSHOT_ROWS_STOP`, or the app says "A cloud copy already exists") | Some client wrote a row. The bootstrap refuses rather than overwrite it. | Do not bootstrap. Do not remove it with the C2 file: that file is pinned to id 1, refuses any other row, and must not be edited ad hoc. Run the forensics file on the new row, identify and close the writer, and preserve it with B. Retiring it needs a new reviewed guarded file keyed to that row's id, saved_at and fingerprint, plus a new W1 approval. |
| **JOHN cannot sign in** | Nothing about the snapshot changes. | Do not reset JOHN's password, MFA or Auth in this runbook. Check that it is the fresh profile on `http://127.0.0.1:5180`. After repeated failures, wait out the login lockout. If it persists, STOP and handle it as a separate approved task. Production stays in the safe "no snapshot" state. |
| **The database load fails** ("The database load failed …" or "Database integrity check failed …") | Nothing was written; the load is read only. | Note the message. Do not retry in a loop. Re-run the checkpoint (expect `SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP`, R unchanged). Any data repair is a separate approved change. Then repeat H. |
| **Confirmation numbers differ from 1/3/1/0/1** | The database or the load is not what was verified. | Press Cancel; nothing is written. Re-run the checkpoint and compare `06 relational` with A. STOP. |
| **The snapshot POST gets 409** (the app shows "Initial cloud snapshot not created: …" after the typed confirmation) | A row with business_id SMILE-TRUST already exists. The unique key rejected the insert and nothing was overwritten. | Do not retry. Re-run the checkpoint and follow the "different snapshot appears" row above. |
| **Post-bootstrap verification fails** | It depends on the failure. | Do not sync or open any other client. Save the checkpoint output. **Secret keys or credential-shaped values found:** treat it as a security incident and retire that row promptly with a new guarded, approved file. **Staff 4, products 15, or older format:** the Gate 0 blocker happened; retire that row the same way, fix the client, and repeat. **R differs:** compare the per-table digests with A to find the table, then STOP. **saved_by not JOHN, or a 047 check fails:** STOP and escalate. |

### Emergency restore of the stale row (W4): only if the approver decides to abort the recovery entirely

This is not recommended, because the row is stale. Restoring it brings back exactly the divergence this runbook removes. It requires W4, an empty table, and the step B evidence file:

```text
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -X -h <session pooler host> -p 5432 -U postgres.qouokiqoepjpoksupskb -d postgres
\set ON_ERROR_STOP on
\set payload `type "<evidence folder>\STALE-DO-NOT-RESTORE_payload.json"`
begin;
select count(*) from public.smile_trust_cloud_snapshots;   -- must be 0, otherwise: rollback;
insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by, saved_at)
  values ('SMILE-TRUST', :'payload'::jsonb, 'john', timestamptz '2026-10-03 13:07:46.196+00');
select id, encode(sha256(convert_to(payload::text, 'UTF8')), 'hex') from public.smile_trust_cloud_snapshots;  -- compare with P
commit;   -- only with W4 given for this run; otherwise: rollback;
```

The restored row gets a new id, and it passes through the 047 guard.

---

## Local validation (rehearsal)

`node --test tests/stale-snapshot-recovery.test.js` rehearses the runbook on a disposable local PostgreSQL. The database is built like production: 001 to 045 without `rls.sql`, then 046 and 047, with JOHN, AMA and KWAME linked and a stale row of the same shape. The rehearsal covers:

- static safety of every artifact;
- step A, including leak checks and checks that the fingerprint ignores sign-in activity;
- step B, the real PowerShell and psql export, verified byte for byte and with the ACL checked;
- every C guard failing closed;
- C1 and C2;
- E;
- the section J cases for a foreign row and the 409 race;
- the auto-upload audit with no snapshot: login, startup, the autosave timer, manual backup, a reload and failed reads all leave 0 rows, and only a fresh load plus the exact typed `SMILE-TRUST` inserts;
- the insert waiting for an in-flight upload;
- G to I through the real client modules, with the checkpoint and forensics verifying the new row;
- after the bootstrap: the queued timer, autosave, manual backup and busy reschedule write nothing, and the row stays byte-for-byte unchanged;
- after reopening: ordinary sync updates the same row in the device format.

It never connects to a remote database.
