# Module 12 — Notification & Communication Management

The existing **Notifications** screen stays live: SMS template editor, queue table, birthday notice, and **Queue notification**. This module adds a communication center **below** that form.

Every module already sends through `queueNotification`. That function is now the only public entry: it interpolates templates, applies customer preferences, stamps Message / Correlation / Idempotency IDs, and **queues after commit**. Dispatch is a separate `processNotificationQueue` step. A failed SMS never reverses a collection, loan, or withdrawal.

There is no REST/GraphQL API and no SMS gateway credentials in the APK. Providers are named, prioritized records (`sms-primary`, `sms-backup`, …). Secrets stay in a server vault reference (`secretMasked`). In-app delivery is local. SMS/WhatsApp/email/push use the failover engine with a pluggable transport (tests inject failures).

## Behaviour

| Topic | Implementation |
|---|---|
| Channels | In-App, SMS, WhatsApp, Email, Push |
| Preferences | SMS/email/WhatsApp/push/promotions; opt-out skips that channel (`skipped`) |
| Idempotency | Same `idempotencyKey` returns the original row |
| Soft delete | Dashboard delete archives; history is kept |
| Failover | Formal state machine; retries then next healthy provider |
| Health score | Exact weighted formulas in `provider-health.js` v1.0.0 |
| Zero volume | `Not Evaluated` / Initializing — never auto-100 or auto-0 |
| Provisional | Baseline 75 + confidence blend until 100 attempts |
| Bulk / schedule / announcements | `Notification.Broadcast` / `Notification.Schedule` |
| Provider override | `Notification.Provider`, audited |

Existing template keys are unchanged so the current editor does not grow by 15 extra events. Extra events (`loan_approved`, `login_alert`, …) live in `EXTRA_NOTIFICATION_TEMPLATES` and are available to the engine and bulk/schedule lists.

## Threshold logic

Score bands are inclusive on the lower bound and exclusive on the upper bound, except **100.00** which is inclusive. A score belongs to exactly one health state.

| Score | Health state |
|---|---|
| 0.00 ≤ score < 20.00 | Unhealthy |
| 20.00 ≤ score < 40.00 | Critical |
| 40.00 ≤ score < 60.00 | Poor |
| 60.00 ≤ score < 75.00 | Degraded |
| 75.00 ≤ score < 90.00 | Stable |
| 90.00 ≤ score ≤ 100.00 | Healthy |

Metric warning/critical/recovery thresholds, hysteresis (default 5 points), and three consecutive evaluations before Poor/Critical/Unhealthy are in `provider-thresholds.js` v1.0.0. Config resolves **provider → channel → global → defaults**. Historical evaluations keep the version recorded at calculation time; later config changes do not rewrite them.

Alerts (`alertBelow` 70, `failoverBelow` 60, `disableBelow` 20) are independent of routing. Recovery advances one health state at a time.

## Untouched

Collection posting, `customerBalance`, withdrawal/loan status strings, Cashier GHS 1,000 limit, branding, navigation, EXE/APK sync.
