# Module 13 — Audit Trail, Activity Logging & Compliance

The existing **Audit Log** and **Exceptions & Alerts** panels stay live. This module adds the investigation console **below** those tables: search, timeline, integrity, outbox/DLQ, and watermarked compliance CSV.

Every module writes through `recordAuditEvent` in `src/core/audit-ops.js`. `logAudit(action, details)` in `app.js` is a wrapper so existing callers keep the same two-argument signature. There is no REST/GraphQL API.

Audit rows remain append-only. Edit, delete, and overwrite return an error. Corrections are new events. Cloud merge keeps the first hashed record for a given id.

## Delivery guarantees

| Level | Meaning | Used for |
|---|---|---|
| G1 | Exactly-once persist inside the originating save | Financial, security, configuration, authentication, user/role changes |
| G2 | G1 persist + transactional outbox (at-least-once publish) | Analytics, report, notification-style publication |
| G3 | At-least-once, idempotent consumers | Dashboard/cache/maintenance |
| G4 | Best effort; loss allowed | Debug / diagnostics |

Class A (G1) collection posting takes a length snapshot of `collections`, `ledgerEntries`, and `audit` before write. If audit persist throws, those arrays roll back and `saveState` is not called. Notifications stay after commit (Module 12). A failed SMS never rolls back a posted collection.

Class B / G2–G3 items are written to `auditOutbox` after the audit row exists. `processAuditOutbox` retries with exponential backoff, preserves correlation order, and moves exhausted items to a dead-letter status. Replay checks the original payload hash and never rewrites the event.

## Record shape

Each event stores Audit ID, Event ID, Correlation ID, optional Transaction ID, idempotency key, sequence number, actor fields, category/type/severity, entity references, field-level before/after diffs, device/session metadata, result, schema version, `payloadHash`, `prevHash`, and `hash`.

Legacy rows without a hash are not treated as tampered. New rows chain from the last hashed event.

## Integrity and retention

`verifyAuditIntegrity` walks the hash chain. A break records a Critical security event and an `auditAlerts` row. Retention defaults: security/operational 7 years, login history 2 years, debug 90 days, financial and configuration permanent. Expired rows are copied to `auditArchives` and flagged `archived` — never deleted.

## Access

| Action | Who |
|---|---|
| `Audit.View` | Owner, Super Admin, managers, accountant, auditor |
| `Audit.Export` | Same plus auditor (read-only whitelist) |
| `Audit.Integrity` | Owner, Super Admin, Developer, Managing Director |
| `Audit.Archive` | Owner, Super Admin, Developer |

Collectors have no audit export. Viewing audit is still gated by `canViewAuditReports`. Exports include a confidentiality watermark. Access to the extras is itself audited when reports are exported.

## Exactly-once limits

Exactly-once is guaranteed only **inside the trusted transactional boundary** (app services, validation, approval, accounting, audit, local/relational store, transaction manager, outbox, internal event store).

| Guarantee | Scope |
|---|---|
| Exactly-once persistence | Committed financial, journal, balance, audit, approval, and configuration records |
| Exactly-once business effects | One balance change, one journal, one authoritative audit row per accepted operation |
| Exactly-once processing | Retries may run, but only one committed outcome (idempotency keys) |
| At-least-once publication | Outbox / notifications / sync |
| Exactly-once delivery | **Not guaranteed** for SMS, WhatsApp, email, push, MoMo, banks, or other providers |

A duplicate SMS from a gateway does not create a second collection. A duplicate MoMo callback is ignored after the first verification. Client timeouts return the original receipt. Replay uses Event / Idempotency IDs and never recreates money.

## Idempotency key lifecycle

`src/core/idempotency.js` is the store. Collection keys still come from `buildIdempotencyKey` (device + client + timestamp). Sequential numeric keys are rejected. Valid transitions: created → processing → succeeded | failed | cancelled; succeeded → expired.

| Status | Behaviour |
|---|---|
| Processing | Concurrent submit returns conflict (409 equivalent) |
| Succeeded | Return cached response; no new collection, journal, or audit |
| Failed (recoverable) | Same key may retry |
| Failed (permanent) | New key required |
| Fingerprint mismatch | **Idempotency Key Conflict** |

Retention defaults: financial 365 days, webhooks 90, notifications 30, jobs 7. Cleanup archives keys only; it never deletes collections or audit rows.

Duplicate handling writes `idempotencyActivityLogs` (engine) plus an operational audit line. Investigation console shows hits, prevented duplicates, ignored callbacks, conflicts, replays, and retries.

## Untouched

Audit Log / Exceptions table columns, `customerBalance`, Cashier GHS 1,000 limit, branding, navigation, EXE/APK sync, and `postgresSourceOfTruth`.
