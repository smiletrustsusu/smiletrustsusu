# Enterprise Monitoring, Observability & Operational Intelligence Specification (EMOOIS) — Phase 13

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 13 — Authoritative Monitoring / Observability Catalog  
**Status:** Authoritative for Phase 13 catalog & SLI/SLO/SLA definitions  
**Version:** 1.0.0  
**Date:** 2026-09-14  
**Owning module (operational engine):** **19** — Monitoring, Observability, Health & Diagnostics (`monitoring-ops.js`, `monitoring-lifecycle.js`)  
**Machine registry:** `src/core/canonical-monitoring-registry.js`  
**Companion matrices:** [`emoois-catalogs.md`](./emoois-catalogs.md)  
**Module companion:** [`monitoring-engine.md`](./monitoring-engine.md)  
**Schemas (optional):** [`schemas/monitoring/`](./schemas/monitoring/)  
**Downstream (consume):** Phase 17 EPSCMS — [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md) consumes MET/SLO signals for capacity; does **not** redefine EMOOIS monitors or SLOs. Phase 18 EOSSMS — [`enterprise-operations-support.md`](./enterprise-operations-support.md) consumes dashboard refresh schedule for ops support; does **not** redefine EMOOIS.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EMOOIS |
| Accountable authority | Platform Operations Lead |
| Money posts | **Forbidden** for monitoring catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** — observe only |
| Nav changes | **None** |
| RBAC rewrite | **None** — permission identifiers only |
| Module 19 | **Referenced and consumed** — not replaced |

**Non-regression:** Phases 1–12 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, AI governance, and reporting. Phase 13 **catalogs** monitoring and observability only. It does not redefine ECDM entities, ECACIS contracts, ECECMS events, ECSMLS transitions, EAIADIS capabilities, money math, or RBAC matrices.

---

## 1. Purpose & scope

### 1.1 Purpose

EMOOIS is the **single enterprise catalog** of monitors, metrics, health checks, alerts, traces, dashboards, and SLI/SLO/SLA definitions for Smile Trust. Runtime collection, scoring, alerting, tracing, and Android offline telemetry continue to execute exclusively through **Module 19**.

### 1.2 In scope

- Catalog architecture and observability domains
- Telemetry standards (metrics, logs, traces, correlation)
- Health-check inventory and severity semantics
- Alert / incident linkage (catalog → Module 19 engine)
- Dashboard definitions (observe-only; no new top-level nav)
- SLI / SLO / SLA catalog and governance
- Input & Dependency Rules (Phases 1–12, Modules 1–30)

### 1.3 Out of scope

- Redefining entities, APIs, DB schemas, security models, AI governance, or BI KPI formulas
- Changing collection posting, loan interest **15%**, 31-day cycle, cashier GHS **1,000**, or `customerBalance`
- Replacing Module 19 engine code paths
- Adding REST/GraphQL live servers or new navigation

### 1.4 Project reality (honest)

| Reality | Implication for EMOOIS |
|---------|------------------------|
| Vanilla JS SPA + in-process Module 20 | Telemetry is in-process; OpenAPI/GraphQL remain facades |
| Capacitor / Electron | Android device health + desktop ops share Module 19 |
| localStorage + optional Supabase | Persistence dual; monitoring tables `029`/`030` optional cloud |
| Module 19 operational engine | Catalog points at `monitoring-ops.js`; does not fork it |
| Module 27 BI KPIs | Business KPI formulas stay in BI; EMOOIS may **observe** volumes |
| Module 28 integration health | MoMo/provider health metrics reference Integration Hub |
| Module 29 AI advisory | AI latency / inference metrics are advisory observability only |

---

## 2. Architecture overview

```text
┌─────────────────────────────────────────────────────────────┐
│  Phases 1–12 catalogs (consume) + Modules 1–30 domains      │
└────────────────────────────┬────────────────────────────────┘
                             │ reference only
┌────────────────────────────▼────────────────────────────────┐
│  Phase 13 EMOOIS catalogs + canonical-monitoring-registry   │
│  (monitors, metrics, alerts, HCs, dashboards, SLI/SLO/SLA)  │
└────────────────────────────┬────────────────────────────────┘
                             │ drives configuration intent
┌────────────────────────────▼────────────────────────────────┐
│  Module 19 operational engine                               │
│  monitoring-ops.js · monitoring-lifecycle.js · views extras │
│  health snapshots · alert rules · traces · Android buffer   │
└────────────────────────────┬────────────────────────────────┘
                             │ reads (does not own)
┌────────────────────────────▼────────────────────────────────┐
│  Job (18) · Payment (16) · Sync · Integration (28) ·        │
│  AI inference logs (29) · BI metrics (27) · Security (22)   │
└─────────────────────────────────────────────────────────────┘
```

**Boundary:** Module 19 wraps existing health signals; it does not post money and does not invent a second collection path. Integrity failure on Android **blocks new collections** on that device only (existing gate).

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase | Artifacts |
|------:|-----------|
| 1 | `docs/enterprise-master-architecture.md`, `docs/emas-matrices.md` |
| 2 | `docs/enterprise-consistency-review.md`, `docs/phase2-registers.md`, governance/workflow docs |
| 3 | `docs/enterprise-canonical-domain-model.md`, `docs/ecdm-catalogs.md`, `canonical-domain-registry.js` |
| 4 | `docs/enterprise-canonical-state-machines.md`, `docs/ecsmls-catalogs.md` |
| 5 | `docs/enterprise-canonical-event-catalog.md`, `docs/ececms-catalogs.md` — correlation / event envelope |
| 6 | `docs/enterprise-canonical-api-catalog.md`, `docs/ecacis-catalogs.md` — API health observe facades |
| 7 | `docs/enterprise-canonical-database-architecture.md`, `docs/ecdaps-catalogs.md` — DB / backup tables |
| 8–11 | Config, integration, BI, platform admin catalogs as present |
| 12 | `docs/enterprise-ai-automation-decision.md`, `canonical-ai-registry.js` — AI latency observe only |
| Mod 19 | `docs/monitoring-engine.md`, `src/core/monitoring-ops.js`, `monitoring-lifecycle.js` |
| Mod 27–29 | `enterprise-bi.md`, `enterprise-integration.md`, `enterprise-ai.md` |

### 3.2 Precedence

1. ADRs / explicit exceptions  
2. EMAS (Phase 1)  
3. Phase 2 consistency & governance  
4. ECDM → ECSMLS → ECECMS → ECACIS → ECDAPS (Phases 3–7)  
5. Module **19** operational semantics (`monitoring-engine.md`)  
6. Modules 1–30 domain specs  
7. EMOOIS catalog (this phase) — lowest for operational behavior; highest for **catalog ID uniqueness**

Unresolved conflicts escalate via Architecture Review Workflow — **not** by rewriting Module 19 silently.

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | Every catalog monitor/metric/alert/HC/dashboard/SLI/SLO/SLA has **exactly one** owner |
| D2 | Alert catalog entries MUST reference a registered metric id (no orphan alert→metric) |
| D3 | Health checks MUST declare `intervalMs`, `timeoutMs`, and `severity` |
| D4 | Operational runtime remains Module **19**; EMOOIS does not replace `monitoring-ops.js` |
| D5 | Collection posting health is **observe-only** — never changes `handleCollection` / balances |
| D6 | AI metrics are advisory observability; Module **24** remains deterministic authority |
| D7 | MoMo / provider health references Module **28**; does not store MoMo PINs |
| D8 | Correlation / trace IDs: UUID **lowercase**; timestamps **UTC** ISO-8601 (Phases 5 / 10 / 12 alignment) |
| D9 | No new top-level nav; UI extras remain under existing Monitoring / Audit / Reports surfaces |
| D10 | Phases 1–12 artifacts are inputs; EMOOIS must not redefine their entities/APIs/schemas |

---

## 4. Design principles

| ID | Principle | Statement |
|----|-----------|-----------|
| EMOOIS-P01 | Catalog honesty | Seed only monitors aligned to existing Module 19 domains + Modules 16/18/21/22/27/28/29 signals |
| EMOOIS-P02 | Single operational engine | Module 19 is the only health/alert/trace runtime |
| EMOOIS-P03 | Observe money, never post | Collection/loan/payment metrics are telemetry |
| EMOOIS-P04 | Unique IDs | Stable `MON-*`, `MET-*`, `ALT-*`, `HC-*`, `DASH-*`, `SLI-*`, `SLO-*`, `SLA-*`, `TRC-*` |
| EMOOIS-P05 | Single owner | Exactly one accountable owner string per entry |
| EMOOIS-P06 | Dual persistence honesty | localStorage primary; Supabase monitoring migrations optional |
| EMOOIS-P07 | Privacy | No photos/contacts/SMS/mic/camera/continuous GPS; mask secrets |
| EMOOIS-P08 | Correlation standard | Lowercase UUID correlation/trace ids; UTC timestamps |
| EMOOIS-P09 | Facade fence | Phase 6 OpenAPI/GraphQL stay non-live; API “health” is in-process |
| EMOOIS-P10 | Versioning | EMOOIS semver; breaking catalog ID removals need ADR |

---

## 5. Observability domains

Aligned to Module 19 `HEALTH_DOMAINS` plus enterprise extensions cataloged (not forked):

| Domain | Catalog focus | Primary module signals |
|--------|---------------|------------------------|
| Application | SPA / Electron / Capacitor process health | 19, 30 |
| Infrastructure | Storage, queue, worker, capacity | 18, 19 |
| Database | Integrity, backup verification (governance-level) | 19, 21, 7 (ECDAPS) |
| API / Gateway | In-process contract / gateway error %, latency | 20, 19 |
| AI | Advisory model latency / inference errors | 29, 19 |
| Security | Failed logins, security findings, device security | 22, 1, 19 |
| Business | Collection daily volume, loan repayment KPI observation | 6, 8, 27, 19 |
| Integration | MoMo / provider health, webhook delivery | 28, 16, 19 |
| Synchronization | Sync success, conflicts, Android offline | 15/sync, 19 |
| Notification | Provider readiness | 12, 19 |

---

## 6. Telemetry specification

### 6.1 Metric classes & intervals (Module 19 defaults)

| Class | Interval | Transmit |
|-------|----------|----------|
| Critical | 30s | Immediate if online; buffer offline |
| High | 1m | Batch ≤ 5m |
| Standard | 5m | Batch ≤ 5m |
| Business KPIs | 15m or event | Batch |
| Capacity | 1h | Daily rollup |
| Historical | Daily | 30-day trend window |

Retention (engine): raw high-frequency 30d; hourly 1y; daily summaries 7y.

### 6.2 Event-driven metrics

Payment failure, sync failure, queue overflow, security incident, crash, DB corruption, auth failure, provider failure, device revocation, critical config change — bypass polling (Module 19 `EVENT_DRIVEN_METRICS`).

### 6.3 Logs

Structured operational logs via Module 19 `recordLog`. Secrets (PIN, password, token) **masked**. Classification follows ECDM / Phase 5 guidance; Restricted financial payloads minimize fields.

### 6.4 Correlation & tracing (Phases 5 / 10 / 12)

| Field | Standard |
|-------|----------|
| `correlationId` | UUID lowercase (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) for operational request paths; Phase 12 AI governance may also use `CORR-*` for document envelopes — both are valid in their scopes |
| `traceId` | UUID lowercase; one per Module 19 `startTrace` |
| `spanId` | Opaque id minted by engine |
| `occurredAt` / `startedAt` / `endedAt` | UTC ISO-8601 |
| Propagation | In-process Module 20 gateway + domain events (`correlationId` on ECECMS envelope) |

Traces reconstruct paths across service/domain hops; they do not become SoR for money.

---

## 7. Health checks

### 7.1 Semantics

Each catalog health check declares:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | `HC-NNN` |
| `code` | Yes | UPPER_SNAKE |
| `domain` | Yes | Module 19 domain or extension |
| `intervalMs` | Yes | Collection cadence |
| `timeoutMs` | Yes | Fail if exceeded |
| `severity` | Yes | information / warning / minor / major / critical |
| `owner` | Yes | Exactly one |
| `engineRef` | Yes | Typically `monitoring-ops.collectHealthSnapshot` |

Statuses: `healthy` / `degraded` / `unhealthy` / `unknown` (Module 19 scoring 0–100).

### 7.2 Seed themes

API health, queue/worker, payment/MoMo provider, sync, storage, backup verification, security failed-login probe, Android integrity, AI advisory latency probe (observe only).

---

## 8. Alerts & incidents

### 8.1 Catalog → engine

EMOOIS `ALT-*` entries map conceptually to Module 19 `alertRules` metrics/domains. Runtime evaluation remains `evaluateAlerts` / lifecycle transitions:

`Detected → Created → Assigned → Acknowledged → Investigating → Resolved → Closed`  
Major/Critical open incidents: `detected → … → closed` (see `monitoring-lifecycle.js`).

### 8.2 Rules

- Every alert references ≥1 registered metric (`metricIds`)
- Severity bands align with Module 19 `ALERT_SEVERITIES`
- No circular `dependsOn` (engine already enforces)

---

## 9. Dashboards

Catalog dashboards describe **intent** only. Live UI remains existing Monitoring extras under dashboard (Module 19 `monitoring-views.js`) — **no new nav**. BI KPI boards remain Module 11/27.

Seed themes: System health strip, Alerts/incidents, Device/offline, Integration/MoMo, AI advisory latency, Business volume observation, Security findings, Sync.

---

## 10. SLI / SLO / SLA

### 10.1 Definitions

| Term | Meaning in Smile Trust |
|------|------------------------|
| SLI | Quantitative indicator (ratio, latency percentile, count) |
| SLO | Target over a window (e.g. 99.5% API availability / 30d) |
| SLA | External/ops commitment referencing one or more SLOs (governance-level; not a legal rewrite) |

### 10.2 Seed SLOs (observe)

| Theme | Intent |
|-------|--------|
| API availability | In-process gateway/contract success rate |
| Collection posting health | Observe successful vs failed collection posts — **does not change posting** |
| Platform uptime | SPA/Electron/Capacitor overall health score window |
| Integration MoMo health | Provider health checks success |
| AI advisory latency | p95 inference latency budget (advisory path) |

Error budgets and burn alerts are cataloged; enforcement is operational process via Module 19 alerts.

---

## 11. Governance

| Concern | Owner |
|---------|-------|
| EMOOIS catalog SoT | `canonical-monitoring-registry.js` + this document |
| Runtime engine | Module **19** |
| BI formula SoT | Module **27** (EMOOIS observes, does not redefine KPIs) |
| Integration provider SoT | Module **28** |
| AI capability SoT | Module **29** / EAIADIS |
| Change control | Architecture Review Workflow; ADR for breaking ID removals |
| Audit | Module 13 / 19 activity logs |

Segregation: alert rule **activation** requires Monitor.Approve / Settings.Edit / SystemOwner (existing RBAC) — EMOOIS does not alter permission matrices.

---

## 12. Cross-reference summary (Phases 1–12 / Modules 1–30)

| Source | EMOOIS use |
|--------|------------|
| Phase 1 EMAS | Module 19 ownership of observability |
| Phase 3–7 | Entity/table/API/event soft links only |
| Phase 5 / 10 / 12 | Correlation UUID lowercase + UTC timestamps |
| Module 19 | Operational engine — required |
| Modules 16/18/21/22 | Payment, jobs, backup, security signals |
| Module 27 | KPI observation (formulas stay in BI) |
| Module 28 | MoMo / provider health |
| Module 29 | AI latency / advisory inference metrics |
| Module 30 | Platform flags/hosting — not AI/monitor catalog owner |

Full matrices: [`emoois-catalogs.md`](./emoois-catalogs.md).

---

## 13. Acceptance criteria

1. Docs `enterprise-monitoring-observability.md` + `emoois-catalogs.md` exist with Input & Dependency Rules  
2. Registry exposes list/get/validate uniqueness + single-owner helpers  
3. Unique IDs across monitors, metrics, alerts, health checks, dashboards, SLIs, SLOs, SLAs, traces  
4. Alerts reference registered metrics only  
5. Health checks include interval, timeout, severity  
6. Module 19 referenced as operational engine; not replaced  
7. `tests/emoois-consistency.test.js` green under `npm test`  
8. `prepare:web` syncs `src` when registry changes  

---

## 14. Version history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-14 | Initial Phase 13 EMOOIS catalog |
| 1.0.1 | 2026-09-15 | Cross-link Phase 17 EPSCMS (capacity consumes MET/SLO; does not redefine) |
| 1.0.2 | 2026-09-15 | Cross-link Phase 18 EOSSMS (ops consumes dashboard refresh; does not redefine) |
