# Wave 3 — Enterprise Backend Services & API Platform

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Wave:** WAVE-03 (MIB wave 5: CORE_APIS · modules 18 / 20 / 28)  
**Status:** Gap closure + platform pack delivered (EIR waveStatus remains **Mostly Complete** — production certification is WAVE-10)  
**Date:** 2026-09-15  
**Stack constraints:** Vanilla JS SPA · Capacitor/Electron · localStorage + optional Supabase · integer **pesewas** · interest **15** · collection days **31** · cashier GHS **1000** · **no** Next.js/Flutter · **no** live REST/GraphQL HTTP server · no new top-level nav

---

## 1. What “REST APIs” means here

Wave 3 delivers an **in-process API platform**:

| Layer | Role |
|-------|------|
| `invokeApi(state, request, ctx)` | Unified gateway (correlation, auth, authz, validation, rate limit, audit, metrics) |
| `src/api/controllers/*` | Thin adapters registering `v1/domain.action` operations |
| `src/core/services/*` | Domain orchestration calling existing `*-ops.js` engines |
| `src/core/repositories/*` | localStorage/state adapters + optional Wave 2 Supabase RPCs |
| OpenAPI 3.1 | Documentation/facade for tools — **not** a Node HTTP listener |

Same pattern as Phase 6 / Module 20: contracts are callable in-process; OpenAPI describes them.

---

## 2. Architecture

```
Client (SPA / Capacitor / Electron)
        │
        ▼
  invokeApi / createApiPlatform().invoke
        │
        ├─ middleware: correlation → auth → authz (RBAC/tenant/branch) → rate limit → validate
        │
        ▼
  controller (v1/customers.register, …)
        │
        ▼
  domain service  ──► existing *-ops / double-entry / auth-session / report-ops / …
        │
        ├─ local repository (state arrays)     ← JS money SoT
        └─ supabase RPC repository (optional)  ← when postgresSourceOfTruth + relationalSync
```

**Anti-duplication:** posting math stays in `collection-ops`, `double-entry`, `loans-workflow`, `accounting-ops`, etc. Wave 3 only orchestrates, authorizes, validates, audits, and optionally dual-writes.

---

## 3. Repository layout

| Path | Role |
|------|------|
| `src/api/gateway.js` | `invokeApi` |
| `src/api/route-registry.js` | Operation catalog + handlers |
| `src/api/versioning.js` | `v1` + deprecation header metadata |
| `src/api/problem-details.js` | RFC 9457-style problem objects |
| `src/api/middleware/*` | auth, authz, validation, rate-limit, audit, correlation |
| `src/api/helpers/*` | pagination, filtering, sorting, cache |
| `src/api/controllers/register-controllers.js` | Domain operation registration |
| `src/api/openapi.js` | OpenAPI 3.1 builder |
| `src/core/services/domain-services.js` | Domain services |
| `src/core/repositories/*` | local + Wave 2 RPC adapters |
| `src/core/wave3-api-ops.js` | Facade (`createApiPlatform`, smoke checklist) |
| `docs/openapi/wave3-api.openapi.json` | Generated OpenAPI document |
| `tests/wave3-backend-api.test.js` | Gateway + security + domain contract tests |

---

## 4. Auth guide

```js
import { createApiPlatform } from "./src/core/wave3-api-ops.js";

const api = createApiPlatform(state, { actor: currentUser, uid, now });

// Public
await api.invoke({
  operationId: "v1/auth.login",
  payload: { username: "john", password: "…" }
});

// Authenticated — pass user on invoke
await api.invoke({
  operationId: "v1/customers.list",
  query: { page: 1, pageSize: 25, sort: "name" }
}, { user: currentUser });
```

- Session actor is required for non-`public` operations (`FND-001` if missing).
- Every protected op runs RBAC (`permission` on the operation) plus tenant/branch checks when scoped.
- `SUPER_ADMIN_FORBIDDEN` (`Owner.Transfer`, `System.Reset`, `Export.All`) remains enforced; SystemOwner=`john` only for those.
- Responses include `X-API-Version`, `X-Correlation-Id`, `X-Request-Id`, optional `Deprecation` / `Sunset`.

---

## 5. Endpoint catalog (domains)

Operations use ids `v1/<domain>.<action>`. Counts are authoritative via `operationCountsByDomain()` after bootstrap.

| Domain | Examples | Notes |
|--------|----------|-------|
| auth | login, logout, refresh, changePassword, session, registerDevice | Wraps `auth-session-ops` |
| authorization | can, scope, forbidden, checkTenantBranch | RBAC / tenant / branch |
| customers | register, update, get, list, search | CRM helpers; optional `upsert_customer_from_client` |
| savings | balance, statement, collect | Balance via `collection-ops`; collect posts via double-entry |
| collections | record, list, get, daily | Daily collections; optional `record_collection_from_client` |
| loans | apply, get, list, repay, portfolio | `loans-workflow`; optional `record_loan_repayment_from_client` |
| accounting | trialBalance, cashFlow, closePeriod, cashbook | `accounting-ops` + optional cashbook RPC |
| reporting | run, dashboard, analytics | `report-ops` |
| dashboards | summary, kpis | Cached reads; optional `fetch_dashboard_kpis` |
| sync | upload, status, progress, ack | Offline foundation + `enqueue_offline_item` / `ack_sync_queue_item` |
| audit | record, search | `audit-ops` + optional `append_audit_event` |
| notifications | send, schedule, cancel, history | `notification-ops` |
| configuration | get, flags, moneyDefaults | `system-config` |
| monitoring | health, metrics, recordMetric | Module 19 hooks |

---

## 6. Error catalog (RFC 9457-style)

Failures return `{ ok: false, problem, error, correlationId, headers }` where `problem` follows:

```json
{
  "type": "https://smiletrust.local/problems/authorization",
  "title": "Permission denied",
  "status": 403,
  "detail": "You do not have permission for this action.",
  "code": "FND-005",
  "correlationId": "corr-…"
}
```

Mapped foundation codes include `FND-001` (session), `FND-005` (authz / wrong tenant|branch), `FND-006` (super-admin forbidden), `FND-007` (validation), `API-429` (rate limit), `API-404` (unknown operation).

---

## 7. Wave 2 RPC wiring

When `settings.postgresSourceOfTruth === true` **and** `relationalSync === true` **and** Supabase is configured, repositories call:

| Domain | RPC |
|--------|-----|
| customers | `upsert_customer_from_client` |
| collections / savings | `record_collection_from_client`, `record_deposit_from_client` |
| loans | `record_loan_repayment_from_client` |
| accounting | `fetch_cashbook_summary`, `record_eod_snapshot` |
| dashboards | `fetch_dashboard_kpis` |
| sync | `enqueue_offline_item`, `ack_sync_queue_item` |
| audit | `append_audit_event` |

JS posting remains SoT unless that flag pair is enabled. Withdrawals still honor Module 9 approval in JS before any RPC.

---

## 8. Examples

### Register customer

```js
const res = await api.invoke({
  operationId: "v1/customers.register",
  payload: { name: "Ama Mensah", phone: "0244123456", branchId: "br-1" }
}, { user: admin });
```

### Record collection (pesewas)

```js
await api.invoke({
  operationId: "v1/collections.record",
  payload: {
    customerId: "cus-1",
    amountPesewas: 5000,
    date: "2026-09-15",
    paymentMethod: "Cash",
    idempotencyKey: "col-ama-2026-09-15"
  }
}, { user: collector });
```

### Health

```js
await api.invoke({ operationId: "v1/monitoring.health" }, { user: admin });
```

---

## 9. OpenAPI

- Generator: `src/api/openapi.js` → `buildOpenApiDocument()`
- Published file: [`docs/openapi/wave3-api.openapi.json`](./openapi/wave3-api.openapi.json)
- Servers entry is `in-process://smile-trust/invokeApi` (documentation only)

---

## 10. Complete / Partial checklist

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Versioned API gateway (`invokeApi`) | **Complete** |
| 2 | Domain controllers + services + repos | **Complete** |
| 3 | Auth / AuthZ / validation / audit / rate limit | **Complete** |
| 4 | Pagination / filter / sort / cache helpers | **Complete** |
| 5 | OpenAPI 3.1 facade | **Complete** |
| 6 | Wave 2 RPC adapter paths | **Complete** |
| 7 | Monitoring/health wired to Module 19 | **Complete** |
| 8 | Sync upload/status/progress/ack | **Complete** (deep conflict/retry in Wave 4 engine) |
| 9 | Tests | **Complete** (`tests/wave3-backend-api.test.js`) |
| 10 | Docs | **Complete** (this file) |

### Partial (intentionally)

| Item | Why |
|------|-----|
| Full offline conflict engine | **Delivered in Wave 4** — see `docs/wave4-android-offline.md` |
| Live HTTP/GraphQL listeners | Never — architecture constraint |
| Every Module 1–30 contract re-registered as `v1/*` | Core domains for WAVE-03; Phase 6 catalog remains authoritative for full matrix |
| Dual-write under every edge UI path in `app.js` | Facades available; gradual adoption via `invokeApi` |

---

## 11. Self-validation

- [x] No duplicate money/business posting engines  
- [x] Ops authenticated + authorized (tenant/branch where scoped)  
- [x] Audit + monitoring hooks on invoke path  
- [x] OpenAPI present under `docs/openapi/`  
- [x] Wave 2 RPC wiring documented  
- [x] Ready for Wave 4 offline deep sync  
- [x] No commit unless requested  
