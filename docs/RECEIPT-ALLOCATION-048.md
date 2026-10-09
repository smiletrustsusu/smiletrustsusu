# Server-allocated collection receipts: migration 048

Migration `supabase/migrations/048_server_receipt_allocation.sql` builds on 047. **It has not been applied to production.** It refuses to run without 046 and 047. Rollback: `supabase/rollbacks/048_server_receipt_allocation.rollback.sql`.

Tests: `tests/migration-048-receipt-allocation.test.js` (live-shaped 001–045 → 046 → 047 → legacy receipts → 048, real concurrent connections, re-runs, rollback and re-apply) and `tests/authoritative-writes.test.js` (client, R1–R10).

## What changes

- **Server allocates the receipt.** For every signed-in (JWT) caller, `record_collection_from_client` ignores the device's `receipt_no` / `payment_no` and allocates `PREFIX-00000001` in the same transaction as the collection and its ledger credit, so both carry the same number. The reply is `{ status, collection_id, receipt_no, business_id }`.
- **Prefix** comes from `branches.collector_code` of the member's branch in the database (uppercased A–Z/0–9, at most 12 characters; `RCP` when empty), never from the payload.
- **Counter**: one row per business in `receipt_sequences`, locked by the upsert until the transaction ends, so concurrent devices are serialized and never get the same number (no `max()+1`). Numbers already used by a collection are skipped. A rolled-back write releases its number; a committed duplicate-submission race can leave a gap. Numbers are never reused.
- **Idempotency**: an existing idempotency key returns `duplicate` with the original `collection_id` and `receipt_no` and allocates nothing. Two connections racing with the same key end with one collection and one ledger credit; the loser answers `duplicate` with the winner's receipt.
- **Seeding**: 048 gives every business a counter at or above the highest numeric suffix (1–12 digits, `PREFIX-123` form) already used by a collection or ledger entry. Other formats are tolerated and left alone. Counters are only raised; no receipt is renumbered. Re-running 048 is safe.
- **Kept receipts**: trusted sessions (service role, direct database session) and the owner-only `import_snapshot_batch` keep the receipt numbers they carry and raise the counter past them.
- **Unchanged**: the 047 public wrapper (business scope, live active staff, amounts, collector assignment, actor from the session), RLS, grants, posted-row immutability and both unique constraints on `collections`.
- **Internal only**: `st_internal_allocate_receipt_no`, `st_receipt_prefix`, `st_receipt_suffix` and `st_internal_record_collection_from_client` are not executable by `anon` or `authenticated` (re-running 046 keeps it that way).

## Client (same release)

In database mode (relational sync on) a new collection has no receipt number. Until the server confirms it, the device shows only `PENDING-<id>`, labelled "Pending reference — not a receipt". It is not posted, printed, sent by SMS or written to the ledger. On confirmation (new or duplicate) the device requires `receipt_no`, adopts it, then posts the local ledger entry, audit, notifications/SMS, success screen and print with that number. A reply without a usable receipt is treated as unconfirmed and stays held. Offline collections stay held under their pending reference and are confirmed with the same idempotency key on reconnect. Legacy (non-database) mode is unchanged.

## Deployment order

1. Back up; apply 048 in the SQL editor (one transaction).
2. Deploy the matching client. **After 048 is applied, APK, Electron and web builds older than this release must not be distributed or used for normal production operations.**

The new client requires 048: against a server without it, the reply carries no receipt, so the collection stays held (unconfirmed) and nothing is posted on the device.

## Known limitations

- **Old clients after 048**: unmarked database writes are now denied by the protocol fence below. Old devices can still display or print locally generated numbers; reconcile their queues before upgrading.
- A collection that an older client already posted on the device, and that is later confirmed by this client, keeps the device number on that device until the next database load (local ledger entries are immutable).
- **Re-applying 047 after 048**: 047 can restore pre-048 function behaviour (its import wrapper, so a later owner import would get server receipts instead of keeping historical ones). If 047 is ever re-applied, 048 must be re-applied and verified afterwards. This is a manual step; no migration does it automatically.

## Rollback

The rollback restores the 047-era internal function (device receipts) and import wrapper and drops the allocator. It does not lower counters or change any receipt. A receipt rollback also needs a compatible client that supplies receipts and still declares 048-v1. Do not distribute an original unmarked old build; the write fence remains enabled.

Removing the fence itself is a separate emergency step that needs its own approval: `supabase/rollbacks/048_write_protocol_fence.emergency-removal.sql` drops only the fence triggers and function; re-applying 048 reinstalls them.

## Follow-ups (not changed by 048)

These remain separate receipt-hardening follow-ups:

- `record_deposit_from_client`, `record_withdrawal_from_client` and loan repayments still store client-supplied receipt numbers, without a uniqueness constraint.
- Legacy snapshot mode promotes temporary receipts to `SRV-<n>` from a device-local counter (`src/core/sync-ops.js`).
- Document receipts (`src/core/document-ops.js`) still use the device counter.
- `next_receipt_no` (001) remains; clients cannot use it (no write access to `receipt_sequences`).

## Technical debt: parallel embedded-database test stall (not fixed here)

When many embedded-PostgreSQL test files run in parallel (`npm test`, and therefore `validate:rc`), a test process occasionally never exits after its database has stopped. Pre-047 files (`preflight-047-readonly`, `existing-snapshot-forensics-readonly`, `first-snapshot-bootstrap`, `post-migration-047-readonly`) were affected as well as the 048 file. Running with `--test-concurrency=1`, or re-running, completes normally. Fix separately.


## Old-client write protection (048-v1)

048 now installs a BEFORE STATEMENT trigger on every existing public table. Non-trusted requests must carry exactly x-smile-write-protocol: 048-v1. Missing, malformed, older and unknown declarations fail closed with 42501 before table mutation, including SECURITY DEFINER RPCs, snapshot writes and direct REST DML. Reads remain available. The shared Supabase header helper supplies this declaration in web, Electron and Capacitor sources; the service-worker cache is smile-trust-susu-offline-048-v1.

This declaration is a compatibility fence, not attestation of a binary: someone can deliberately forge it. Existing JWT, business scope, active staff, assignment, MFA and RLS protections still apply. Trusted service-role and direct maintenance sessions bypass the fence; old privileged proxies or leaked service keys cannot be blocked by this mechanism. Future public tables need the same trigger. Receipt rollback intentionally retains the fence. Reapplying 047 can still regress import behavior; reapply 048 and verify.

A cache bump cannot disable an already open old page, or change an installed APK/Electron binary. Once 048 is applied those clients' unmarked database writes will be denied, including queued retries. The updated local backup server also rejects unmarked POST /backup requests with 409 before changing the backup file. Old running backup servers must be restarted with the updated source. Local-only operations and old backup server processes remain outside these fences: discontinue old binaries and inspect those queues before upgrading. Do not delete pending device data or assume its locally printed receipt is authoritative.

Release blockers: this change has only local validation; no production migration or deployment was performed. Rebuild and verify APK/Electron distributions and exercise real PostgREST headers/CORS, snapshot and financial writes in isolated UAT before cutover. Do not run prepare:web blindly over excluded local configuration; only the relevant mirrored sources were updated here. The supplied production backup (1,594,337 bytes) passed pg_restore -l, but a full isolated restore remains required evidence. No users were activated.

## Local verification evidence (8 October 2026)

- Initial targeted run: 73/73 passed (authoritative writes, existing clients and 048 allocation).
- Final allocation/fence run: 21/21 passed, including concurrent connections, rollback/reapply, rejected stale requests with unchanged receipt/counter state, stale snapshot UPDATE rejection and unmarked read access.
- Final authorization/portal run: 17/17 passed. Current-client fixtures now declare the protocol; unmarked portal login cannot create a session.
- Backup/header/mirror and cloud-save run: 6/6 passed. Stale backup uploads preserve the existing file. Root and www protocol/cache sources match.
- Broad sequential run: 1,142 tests, 1,124 passed, 18 failed, none skipped. Five missing-protocol fixture failures were corrected and their final 17-test file passed. The remaining thirteen failures came from the untouched stale-recovery files/environment: twelve caused by prefilled recovery fingerprints and their cascades, one by unavailable Get-FileHash in the test PowerShell environment.
- A temporary baseline test copy read the committed recovery SQL templates directly into memory: 20/21 passed; only the Get-FileHash failure remained. The temporary copy was removed, and neither local recovery SQL file was edited. The full suite has not been rerun after fixture correction; it cannot be claimed entirely green with the preserved local recovery files.
- git diff --check passed. Existing recovery edits, preflight files and .tmp-test-out.txt remain in place. Excluded configuration, secrets, installed binaries and production backup were not rewritten. No migration was applied outside disposable local test databases; no deployment, production changes or user activation occurred.

Test logs are retained in the chat workspace as 048-targeted-test.log, 048-database-test.log, 048-authorization-test.log, 048-protocol-test.log, 048-full-test.log and 048-recovery-baseline-test.log.
