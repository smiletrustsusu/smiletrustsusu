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

- **Old clients after 048**: the server stays financially safe because it ignores their receipt number (one collection, one ledger credit, server receipt on both, idempotency and uniqueness unchanged). But an old UI may temporarily show, print and message its own locally generated number until it reloads authoritative data from the database. This is why old builds must not be used.
- A collection that an older client already posted on the device, and that is later confirmed by this client, keeps the device number on that device until the next database load (local ledger entries are immutable).
- **Re-applying 047 after 048**: 047 can restore pre-048 function behaviour (its import wrapper, so a later owner import would get server receipts instead of keeping historical ones). If 047 is ever re-applied, 048 must be re-applied and verified afterwards. This is a manual step; no migration does it automatically.

## Rollback

The rollback restores the 047-era internal function (device receipts) and import wrapper and drops the allocator. It does not lower counters or change any receipt. Roll the client back with it: the 048 client sends no receipt number.

## Follow-ups (not changed by 048)

These remain separate receipt-hardening follow-ups:

- `record_deposit_from_client`, `record_withdrawal_from_client` and loan repayments still store client-supplied receipt numbers, without a uniqueness constraint.
- Legacy snapshot mode promotes temporary receipts to `SRV-<n>` from a device-local counter (`src/core/sync-ops.js`).
- Document receipts (`src/core/document-ops.js`) still use the device counter.
- `next_receipt_no` (001) remains; clients cannot use it (no write access to `receipt_sequences`).

## Technical debt: parallel embedded-database test stall (not fixed here)

When many embedded-PostgreSQL test files run in parallel (`npm test`, and therefore `validate:rc`), a test process occasionally never exits after its database has stopped. Pre-047 files (`preflight-047-readonly`, `existing-snapshot-forensics-readonly`, `first-snapshot-bootstrap`, `post-migration-047-readonly`) were affected as well as the 048 file. Running with `--test-concurrency=1`, or re-running, completes normally. Fix separately.
