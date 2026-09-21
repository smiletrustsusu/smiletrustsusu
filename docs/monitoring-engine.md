# Module 19 — Monitoring, Observability, Health & Diagnostics

The monitoring engine is the **only** path for health checks, metrics, alerts, traces, operational logs, incidents, capacity forecasts, and Android device telemetry in Smile Trust. Collections, withdrawals, loans, payments, documents, and jobs still run as they do today. This module **observes** them. It does not post money and it does not change cashier GHS **1,000**, loan interest **15%**, the 31-day cycle, or `customerBalance`.

There is no REST/GraphQL API. Live UI remains `app.js`. Existing Backup / Cloud Backup / ordered sync / scheduler extras stay in place. Monitoring extras sit **below** them. A compact health strip is appended under the existing dashboard without replacing KPI cards.

## What the engine does

- Samples service, queue, worker, payment, sync, storage, backup, and security health.
- Scores every domain 0–100 and rolls a system score from critical domains.
- Evaluates threshold rules and escalates major/critical alerts into incidents.
- Records structured logs with Correlation IDs and **redacted** secrets.
- Traces request paths across services.
- Forecasts growth from capacity snapshots.
- Monitors authorized Android devices, including prolonged offline operation.

Payment, job, document, and sync dashboards remain the source of operational counts. Monitoring reads them; it does not replace them.

## Health domains

System, service, database, queue, worker, API, payment provider, notification provider, synchronization, storage, backup, security, Android device.

Each check stores status, score, last check time, consecutive failures, and trend inputs (availability, error %, mean response, recovery rate).

## Alerts and incidents

Severities: Information, Warning, Minor, Major, Critical. Major and Critical create incidents. Incident flow:

`detected → classified → investigating → identified → resolving → resolved → closed`

`resolved → post_review → closed` is also allowed. History is append-only.

## Android offline monitoring

Registered devices report identity, operational status (exactly one of online / offline / synchronizing / failed / paused / disabled / revoked), storage, sync backlog, optional battery, and security findings.

Offline readiness (0–100): Fully Ready ≥ 90, Ready ≥ 70, Limited ≥ 50, else Requires Attention.

Telemetry is buffered on the device, encrypted with the same offline-queue flag, and flushed through **idempotency + the sync engine** (`kind: monitoring` on the DEVICE aggregate). Duplicate flushes return the original item.

Integrity failure **blocks new collections** on that device until repair. Revoked devices cannot collect or upload health.

## Privacy

The APK must not collect or transmit photos, contacts, SMS, call history, microphone, camera, unrelated personal files, or continuous GPS. Snapshots that include those keys are rejected. Logs mask PINs, passwords, tokens, and secrets. Remote diagnostics return operational fields only — never balances or PINs.

## Implementation

- Engine: `src/core/monitoring-ops.js`, `src/core/monitoring-lifecycle.js`
- Extras: `src/ui/monitoring-views.js`
- Schema: `supabase/migrations/029_monitoring.sql`, `supabase/migrations/030_monitoring_policy.sql`

## Acceptance

- Modules publish health through this engine.
- Alerts fire on configured thresholds.
- Traces reconstruct a path with correlation IDs.
- Logs are searchable and masked.
- Android health continues offline and flushes once when online.
- Integrity failure blocks collections without changing amount math.
- Automated tests cover scoring, alerting, incidents, traces, privacy, offline flush, integrity block, and RBAC.

## Appendix — refinement sequence

1. **Health statuses** — healthy / degraded / unhealthy / unknown from configurable scoring.
2. **Domain ownership** — Monitoring Engine owns scores; business engines own the underlying queues.
3. **Alert lifecycle** — Detected → Created → Assigned → Acknowledged → Investigating → Resolved → Closed. `open` remains the live created alias. Escalated and Reopened are documented alternatives.
4. **Incident lifecycle** — matrix in `monitoring-lifecycle.js`.
5. **Trace lifecycle** — started → running → completed | failed.
6. **Log privacy** — mask list is exhaustive for secrets; forbidden Android keys are rejected.
7. **Capacity forecast** — linear fit over snapshots.
8. **Android operational status** — exclusive; connectivity history only on change.
9. **Offline buffer** — FIFO, idempotent flush onto DEVICE aggregate.
10. **Collection safety** — integrity/revocation gate only; no second posting path.

## Appendix — metric collection intervals

Defaults (UTC, configurable):

| Class | Interval | Transmit |
|---|---|---|
| Critical (payment, accounting, sync, auth, worker/queue failure) | 30 seconds | Immediate if online; buffer if offline |
| High-priority (queue depth, API, errors, workers, providers) | 1 minute | Batch every 5 minutes |
| Standard (CPU, memory, disk, cache) | 5 minutes | Batch every 5 minutes |
| Business KPIs | 15 minutes, or immediately after a significant event | Batch |
| Capacity | 1 hour | Daily rollup |
| Historical trends | Daily | 30-day window |

Android (battery-aware): connectivity 30s active / 5m background; readiness 5m; sync queue 2m; storage 15m; integrity at startup, after sync, and every 24h; battery 10m while active; security at startup and every 30m. Idle devices slow down unless a critical condition exists.

Event-driven metrics (payment failure, sync failure, crash, corruption, revocation, security) bypass polling. Adaptive modes: healthy (default), high_load (slow low-priority), incident (faster on the affected domain), idle (slower). Missed intervals are recorded; the engine does not invent synthetic points. Raw high-frequency metrics 30 days; hourly 1 year; daily summaries 7 years.

## Appendix — alert lifecycle, thresholds, and escalation

```text
Detected → Created → Assigned → Acknowledged → Investigating → Resolved → Closed
Assigned → Escalated
Resolved → Reopened
```

`open` is the live alias for a newly created alert so existing dashboards keep working.

| Severity | Meaning | Ack target | First / second escalation |
|---|---|---|---|
| Information | No action required | None | None |
| Warning | May become a problem | 4 hours | 4h / 8h |
| Minor | Localized degradation | 2 hours | 2h / 4h |
| Major | Important operations affected | 30 minutes | 30m / 60m |
| Critical | Integrity, security, or availability at risk | 15 minutes | 15m, then every 30m |

Channels: Information dashboard only; Warning + email; Minor + push; Major + SMS; Critical + SMS/push/WhatsApp where configured. Duplicate active conditions update occurrence count. Maintenance windows suppress non-security, non-critical alerts. Recovery does not delete history; original severity is preserved.

## Appendix — numeric boundaries and `[a,b)` notation

Production ranges are **left-inclusive, right-exclusive** unless a metric documents otherwise.

**Plain-language rule:** Each severity starts at its lower boundary (including that value) and continues up to—but does not include—its upper boundary. The highest severity starts at its lower boundary and includes every value above it.

CPU / memory example:

| Severity | Interval | Examples |
|---|---|---|
| Normal | `[0,75)` | 74.999 |
| Warning | `[75,85)` | 75.000, 84.999 |
| Minor | `[85,90)` | 85.000 |
| Major | `[90,95)` | 90.000, 94.999 |
| Critical | `[95,+∞)` | 95.000 |

Queue depth: `[0,500)` normal, `[500,1000)` warning, `[1000,2000)` minor, `[2000,5000)` major, `[5000,+∞)` critical. Exactly 24 hours offline is Major; exactly 72 hours is Critical. Evaluation uses the stored value, not the rounded display. Recovery uses hysteresis (CPU recovers below 70% for consecutive windows). Overlapping, gapped, empty, or inverted intervals cannot be activated.

Alert rules are versioned drafts until validation succeeds (required fields, logical bands, no circular dependencies). Hard-coded alerts are limited to bootstrap rules in `seedAlertRules()`.

## Appendix — Android privacy and remote diagnostics

The APK must not collect photos, contacts, SMS, call history, microphone, camera, unrelated personal files, or continuous GPS. Remote diagnostics return operational fields only — never balances or PINs. Integrity failure blocks new collections on that device; it does not change amount math.
