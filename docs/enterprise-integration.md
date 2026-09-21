# Module 28 — Enterprise Integration Hub & Third-Party API Gateway

Centralized **in-process** integration platform for SMILE TRUST SUSU MANAGEMENT SYSTEM. All outbound/inbound partner traffic is modeled through this hub. It **extends Module 20** (does not replace it). There is **no** REST/GraphQL HTTP server.

Does **not** post collections, replace `handleCollection`, change loan interest **15**, collection days **31**, cashier GHS **1000**, or `customerBalance`. Does **not** store MoMo PINs or bank passwords. Reuses MoMo webhook secret pattern for HMAC (`settings.momoWebhookSecret`).

Feature flag: `enableEnterpriseIntegration`.

## Architecture

| Layer | Components |
|-------|------------|
| Core Gateway | Router, route registry (`HUB_ROUTE_CATALOG` + Module 20 routes), request/response dispatcher (`hubDispatch`), version manager (uri/header/semver metadata) |
| Integration Engine | Provider registry/resolver/health/failover/config |
| Webhook Engine | Incoming/outgoing, HMAC validator, retry + exponential backoff, DLQ, replay, delivery history |
| Message Integration | Pub/sub + P2P queues, DLQ, ordering, idempotent publish, acks, back-pressure |
| Transformation | JSON↔XML, CSV, field/enum map, currency (pesewas/GHS), datetime, encoding |
| Security | API keys, OAuth2/OIDC/JWT/mTLS **policy models**, HMAC, secret rotation metadata, replay (nonce/timestamp), IP allowlists |
| Traffic | Rate limiter, throttling windows, circuit breaker, timeout, failover/priority hooks |
| Operational | Health/readiness/liveness, Module 19 metrics/logs, correlation IDs, audit publisher |
| Governance | Ownership matrix, deadline templates (`deadline02`), Delivery Dashboard |

### Implementation files

- `src/core/integration-lifecycle.js` — catalogs, milestones, error codes `INT-xxx`
- `src/core/integration-transforms.js` — transform engine
- `src/core/integration-messaging.js` — in-memory broker
- `src/core/integration-delivery.js` — ownership & deadline governance
- `src/core/integration-ops.js` — hub engine
- `src/core/integration-api.js` — contracts + Module 20 gateway handlers
- `src/ui/integration-views.js` — Audit/Reports extras (**no new nav**)
- `supabase/migrations/041_enterprise_integration.sql`
- `tests/integration-ops.test.js`

## API reference (in-process contracts)

All APIs are invoked via `invokeContract` / Module 20 `dispatchGatewayRequest`. GraphQL names are facade fields only.

| Contract | Auth action | Request (summary) | Response | Errors |
|----------|-------------|-------------------|----------|--------|
| `Integration.Client.Register.v1` | `Integration.Client` | `{ name, type, scopes }` | `{ client }` | INT-002 |
| `Integration.Key.Issue.v1` | `Integration.Key` | `{ clientId }` | `{ key }` (+ one-time `plaintextKey`) | INT-002/005 |
| `Integration.OAuth.Register.v1` | `Integration.Client` | `{ name, clientId, clientSecret }` | `{ client }` (secret hashed) | INT-022 |
| `Integration.Provider.Register.v1` | `Integration.Provider` | `{ code, name, category, priority }` | `{ provider }` | INT-010/023 |
| `Integration.Provider.List.v1` | `Integration.View` | filters | `{ rows }` | — |
| `Integration.Webhook.Register.v1` | `Integration.Webhook` | `{ direction, eventType, version }` | `{ webhook }` | INT-002 |
| `Integration.Webhook.Receive.v1` | `Integration.Webhook` | `{ webhookId, body, signature, nonce }` | `{ delivery, postsCollections:false }` | INT-011/012 |
| `Integration.Transform.Run.v1` | `Integration.Transform` | `{ transformId, payload }` | `{ result }` | INT-013 |
| `Integration.Dispatch.v1` | `Integration.Admin` | `{ providerCode\|category, operation, authPolicy, payload }` | `{ response, correlationId, pipeline }` | INT-001…025 |
| `Integration.Health.v1` | `Integration.View` | — | health/readiness/liveness | — |
| `Integration.Usage.v1` | `Integration.View` | pagination | usage rows | — |
| `Integration.Delivery.*` | Admin/View | ownership, milestones, deadline CR | dashboard / deliverable | INT-019…021 |

**Version history:** API `1.0.0` (Module 28 initial). Breaking changes require major version bump.

### Examples

```js
invokeContract(state, "Integration.Dispatch.v1", {
  providerCode: "MTN_MOMO",
  operation: "health",
  authPolicy: "session"
}, { user, uid, now });

dispatchGatewayRequest(state, {
  route: "integration.health",
  version: "v1",
  user
}, { uid, now, user });
```

## Providers

Seeded stubs: MoMo (MTN, Vodafone, AirtelTigo), banks (GhIPSS), payment, SMS, email, push, KYC, credit bureau, government, accounting/ERP/CRM, BI, cloud storage, regulatory. Register/version/configure/health/failover/priority/suspend/retire via state — no code change required for config values (`integration.*` parameters).

## Webhooks

Inbound/outbound with HMAC using MoMo webhook secret reference (not PIN storage). Retries with exponential backoff, DLQ, versioning, replay, delivery history. Job handlers: `integration_webhook_retry`, `integration_overdue_scan`.

## Messaging

In-memory queues in state: pub/sub, P2P, DLQ, replay, ordering, idempotent consumers, acks, back-pressure flags. Aligns with Global Event Spec via `module-contracts` domain events.

## Security

- API keys hashed at rest; plaintext returned once
- HMAC signing for webhooks
- OAuth2/OIDC/JWT/mTLS as **in-process policy models** (not real TLS termination)
- IP allowlists, nonce/timestamp replay prevention
- Secret rotation metadata; `encryptedInTransitPolicy` flag
- Forbidden: `momoPin`, `pin`, `bankPassword`, `password`, `cardCvv`

## Observability

Metrics/logs to Module 19: latency, errors, retries, circuit breaker, queue depth, throughput. Correlation IDs on dispatch. Audit Module records governance and operational actions (`module: "28"`).

## Ownership & delivery schedule

In-process governance (not a separate PM tool):

- Roles: **Primary Owner**, **Backup Owner**, **Reviewer**, **Approver**
- Seeded Module 28 deliverables with ownership matrix
- Milestones 1–10 (none skippable): Planned → Requirements Approved → Design Approved → Development Started → Feature Complete → QA Complete → Security Review Complete → Performance Validated → Documentation Complete → Production Released
- Dependencies enforced (e.g. Feature Complete requires Development Started; Production Released requires QA + Security + Perf + Docs)
- Status workflow: Not Started, On Schedule, At Risk, Delayed, Blocked, Completed, Cancelled
- Deadline change control (`deadline02` template): Change Request ID, justification, requester, approver, previous/new deadline, approval timestamp — **immutable once approved**
- Overdue → notifications + Delivery Dashboard
- Immutable audit on ownership/schedule changes

## UI

Under existing **Audit Log** and **Reports** extras only: Gateway dashboard, providers, webhooks, clients/keys, transforms, rate limits, queues, usage analytics, Delivery Dashboard. No new top-level nav.

## Database

Migration `041_enterprise_integration.sql`: `api_clients`, `api_keys`, `oauth_clients`, `providers`, `provider_versions`, `provider_configurations`, `webhooks`, `webhook_deliveries`, `api_requests`, `api_responses`, `message_queues`, `message_history`, `transformation_definitions`, `api_rate_limits`, `api_usage_statistics`, `integration_deliverables`, `integration_deadline_changes` (+ FKs, checks, indexes).

**Rollback:** drop Module 28 tables in reverse dependency order; no alters to Modules 1–27.

**Archival:** age out `api_requests` / `api_responses` / `webhook_deliveries` / `message_history` per retention policy.

## Config (no code changes)

Parameters: `integration.perMinute`, `integration.perHour`, `integration.defaultTimeoutMs`, `integration.retryMax`, `integration.circuitFailureThreshold`, `integration.circuitCoolDownMs`. Routes, provider priorities, queues, and secret rotation intervals are state-driven.

## Deployment / ops

1. Ensure feature flag `enableEnterpriseIntegration` enabled
2. Smoke: `Integration.Health.v1`, dispatch MoMo health, inbound webhook with HMAC
3. Upgrade: additive migration 041; no money-engine changes
4. Rollback: disable feature flag; optional table drop per notes above
5. Alerts: open circuit breakers, queue back-pressure, overdue deliverables (notifications)

## Troubleshooting

| Symptom | Check |
|---------|--------|
| INT-001 | Feature flag disabled |
| INT-008 | Rate limit windows / `integration.perMinute` |
| INT-009 | Circuit breaker cool-down |
| INT-011 | MoMo webhook secret mismatch |
| INT-012 | Reused nonce |
| INT-022 | Attempt to store PIN/password |
| INT-019/020 | Milestone skip or unmet dependency |

## RBAC

`Integration.View`, `Integration.Provider`, `Integration.Webhook`, `Integration.Client`, `Integration.Key`, `Integration.Transform`, `Integration.Admin`.

## DR

Hub state lives in application snapshot/localStorage (+ optional Supabase tables). Restore via Module 21 backup/recovery; re-run health smoke checks. Provider credentials are hashed/referenced — rotate secrets after restore if compromise suspected.

## Version history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-12 | Initial Module 28 hub, ownership/deadline governance, migration 041 |
