# Module 15 — Offline Synchronization & Conflict Resolution

> Wave 4 deep engine: `docs/wave4-android-offline.md` · `src/sync/offline-sync-engine.js`

The existing **Local Backup** / **Cloud Backup** buttons stay live. This module adds a **Synchronization dashboard** below them on the Backup screen.

There is no REST/GraphQL API. Outbound items still use `state.offlineQueue`. Ordered processing is `processSyncQueue` in `src/core/sync-ops.js`. Encryption at rest remains AES-GCM in `src/sync/offline-crypto.js` when **Encrypt offline queue at rest** is checked.

## What stays the same

| Behaviour | Why |
|---|---|
| Collections still post on the device while offline | Agents must issue a receipt in the field. `customerBalance` is unchanged. |
| Printed `receiptNo` from `buildReceiptNo` | Reprint and SMS keep the number the customer already received. |
| Cashier GHS **1,000**, loan interest **15%**, 31-day cycle | Module 14 defaults. |
| Device disable on Settings | Lost phones are still disabled there. Revoked devices also cannot enqueue or flush. |
| Existing Online / Offline pills and **Sync now** | Still work. The pill can show Syncing while an ordered pass runs. |

## Ordering

Device clocks are not used as the sole sort key. Each queued item gets a strictly increasing **local sequence** per device. After a successful apply the engine assigns an immutable **server sequence**. Same savings/loan aggregate is sequential. Unrelated customers may continue when one aggregate is blocked. Declared `dependsOn` links must be applied first. Interrupted runs resume from the last checkpoint without renumbering.

Financial kinds never use last-write-wins or client-wins.

## High-risk while offline

Loan approval, loan disbursement, withdrawal approval, period close, and configuration changes require connectivity unless `offline.allowHighRisk` is enabled. Customer registration offline stays allowed unless `offline.allowCustomerRegistration` is turned off.

## Exactly-once

Duplicate idempotency keys reuse the original queue row. Replay of an applied item does not insert a second collection or journal. External SMS/MoMo delivery is still not exactly-once (Module 13).

## Receipts

Offline collections keep the printed receipt number and store `temporaryReceiptNo`. After sync that maps to `permanentReceiptNo` (`SRV-…`) in `localReceipts` for traceability.

## Identifier standard

Every queued transaction now carries a **primary aggregate** (`CUSTOMER`, `SAVINGS_ACCOUNT`, `LOAN_ACCOUNT`, `GROUP`, …), optional secondary aggregates, typed dependencies (hard / soft / optional), and an aggregate version. Device clocks are still not used for order. Circular hard-dependency graphs are rejected. Same-aggregate locks prevent concurrent writers during a sync pass.

Provider payment references remain **external identifiers**. Module 16 stores them as-is through the payment engine and `linkExternalReference`. They are never rewritten into Smile Trust ids.

Existing Smile Trust ids (`col-…`, `u-owner`, printed `RCP-00000001`) remain valid technical or business identifiers. New optional business numbers use `PREFIX-BRANCH-YEAR-SEQUENCE`. Permanent journal numbers, audit ids, and server receipt numbers are **not** generated on the device.

Offline agents may generate only **delegated** temporary receipts and idempotency keys (seeded, already active). New delegations need maker-checker approval. Historical mappings are never rewritten.

## Permissions

| Action | Who |
|---|---|
| `Sync.View` | Collectors and up, plus auditor (read-only) |
| `Sync.Retry` | Collectors, cashiers, supervisors, branch managers |
| `Sync.Resolve` | Branch managers and privileged roles |
| `Device.Revoke` | Owner / Super Admin / Developer (plus existing Settings disable) |
| `Identifier.View` | Auditor (read-only) and privileged roles |
| `Identifier.Delegate` / `Identifier.Approve` | Owner / Super Admin / Developer; MD may request but not approve |
