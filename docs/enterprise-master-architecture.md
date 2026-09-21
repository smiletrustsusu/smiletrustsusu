# Enterprise Master Architecture Specification (EMAS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Authoritative enterprise architecture (Phase 1)  
**Status:** Active  
**Version:** 1.0.0  
**Date:** 2026-09-12  

This document **organizes, governs, and references Modules 1–30**. It does **not** replace detailed module specifications under `docs/`. Implementation detail lives in those specs and in `src/core/*`.

**Phase 20 (final specification baseline):** The published integration of Modules 1–30 + Phases 1–19 is [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) (EIBPRFBS). EMAS remains Phase 1 SoT for architecture organization; Phase 20 does **not** redefine EMAS.

---

## 1. Executive Summary

SMILE TRUST is a **vanilla JavaScript single-page application** (`app.js` live UI) with shared **`src/core/*` engines**, packaged as **Capacitor Android APK** and **Electron Windows EXE**, with **localStorage** as the primary runtime store and **optional Supabase** for cloud snapshots / relational migrations.

There is **no separate REST or GraphQL HTTP server**. Module **20** (API Gateway) and `invokeContract` provide **in-process** contracts. Specs that mention REST/GraphQL paths describe **facade routes and contract names**, not network services.

Money in core engines is **integer pesewas**. Operational defaults include cashier approval limit **GHS 1,000**, loan interest **15%**, and collection cycle **31 days**. Role aliases used in operations: Branch Manager = **`Admin`**, Super Admin = **`KBA`**, System Owner = **`john`** (`SystemOwner`).

Modules **1–30** form a closed major-module set. The latest modules are **28 Integration Hub**, **29 AI** (advisory only; Module **24** Rule Engine remains deterministic authority), and **30 Platform Admin** (final major module). Global Consistency Review / Event Catalog consolidation is a **separate** phase.

---

## 2. Scope

### In scope

- Enterprise layers, module catalog (1–30), ownership boundaries, and cross-module interaction rules.
- Data, security, integration, AI, deployment, observability, and governance models at **architecture** level.
- Traceability from this EMAS to module docs, cores, migrations, and contracts.
- Supporting matrices in [`emas-matrices.md`](./emas-matrices.md).

### Out of scope

- Rewriting Modules 1–30 detailed specs.
- New business functionality, navigation, or features.
- Changing module ownership, public contracts, RBAC forbidden lists, or money math unless a verified conflict is documented (prefer document over change).
- Building a separate HTTP API server or replacing `app.js` UI.

### Authoritative sources (precedence)

1. Live financial posting paths in `app.js` + posting-owner cores (Modules 6–10, 16 where applicable).
2. Module public contracts in `src/core/module-contracts.js` (`CONTRACT_CATALOG`, `MODULE_CONSUME`, `invokeContract`).
3. Module specifications in `docs/*.md`.
4. This EMAS (organization and governance).
5. Optional Supabase migrations (`supabase/migrations/`) when relational persistence is enabled.

---

## 3. Architecture Vision

Deliver a **single-client enterprise Susu platform** where:

1. **Field and office** use the same engines on Android, Web, and Desktop.
2. **Cross-module calls** always go through versioned **contracts** (never private methods, SQL, or undocumented shared mutables).
3. **Financial truth** stays with posting owners; platform, BI, AI, and integration layers **never** invent a second posting path.
4. **Deterministic policy** (Module 24) and **advisory intelligence** (Module 29) remain strictly separated.
5. **Platform Admin** (Module 30) governs tenants, flags, licenses, environments, maintenance, and ops metadata for Modules 1–29 without duplicating their domain logic.

---

## 4. Guiding Principles

Each principle includes Purpose, Scope, Rationale, Exceptions, and Enforcement.

### GP-01 — Contract-first module boundaries

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Keep modules independently evolvable while preserving safety. |
| **Scope** | All Modules 1–30 and any future cross-module call. |
| **Rationale** | Prevents hidden coupling and dual write paths. |
| **Exceptions** | Owner-internal contracts (`ownerInternal: true`) may be invoked only by the owning module (or trusted bootstrap). |
| **Enforcement** | `invokeContract`, `mayConsume`, `MODULE_CONSUME`, contract tests; prohibited paths in `PROHIBITED_PATHS`. |

### GP-02 — In-process gateway, no HTTP API server

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Match deployed product reality (SPA + Capacitor + Electron). |
| **Scope** | Modules 20, 28, and all “REST/GraphQL” facade names. |
| **Rationale** | Network servers are not part of this codebase’s runtime. |
| **Exceptions** | Optional Supabase RPCs / storage; Electron/Capacitor host shells. |
| **Enforcement** | Gateway `inProcess: true` boundaries; docs and EMAS consistency tests. |

### GP-03 — Single money model

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Avoid float drift and dual balance calculations. |
| **Scope** | All cores that store or compute money. |
| **Rationale** | Integer pesewas are the core unit; UI may display GHS. |
| **Exceptions** | Legacy GHS numeric fields in live UI/`customerBalance` paths documented in module specs; schema payloads may use decimal **strings**. |
| **Enforcement** | Money tests; module boundary asserts (`moneyUnit: "pesewas"`); config keys for interest/limits. |

### GP-04 — Posting ownership is exclusive

| Aspect | Statement |
|--------|-----------|
| **Purpose** | One authoritative write path for collections, loans, journals, withdrawals. |
| **Scope** | Modules 6–10 primarily; 16 for MoMo payment lifecycle; gateways/AI/BI/exchange must not post. |
| **Rationale** | Dual posting breaks audit and ledger integrity. |
| **Exceptions** | None for production paths. |
| **Enforcement** | `posting: true` / `ownerInternal` on contracts; `postsCollections: false` on platform/AI/integration/BI/exchange/records/rules/workflow boundaries. |

### GP-05 — Deterministic rules ≠ advisory AI

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Keep financial/policy decisions explainable and reproducible. |
| **Scope** | Module 24 vs Module 29. |
| **Rationale** | AI is probabilistic; Rule Engine is authoritative for policy evaluation. |
| **Exceptions** | AI may **recommend**; humans/workflows/rules apply effects. |
| **Enforcement** | Module 29 docs + `assertAiBoundary`; Module 24 side-effect-free evaluation. |

### GP-06 — Observability and audit are first-class

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Every privileged action is attributable and operable. |
| **Scope** | Modules 13 (audit), 19 (monitoring), plus emitters in all modules. |
| **Rationale** | Susu operations require compliance and incident response. |
| **Exceptions** | Best-effort external SMS/MoMo delivery acknowledgements (documented non-exactly-once). |
| **Enforcement** | Audit on commands; metrics/alerts via Module 19; correlation IDs on gateway/schema. |

### GP-07 — Configuration change control

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Protect high-risk parameters (interest, cashier limit, MFA, flags). |
| **Scope** | Modules 14 and 30 (platform flags/tenants/licenses). |
| **Rationale** | Misconfiguration is a financial and security risk. |
| **Exceptions** | System Owner may bypass pending draft for some high-risk keys (Module 14). |
| **Enforcement** | Maker-checker drafts; Platform kill-switch/audit; RBAC actions. |

### GP-08 — Prefer documenting conflicts over silent contract changes

| Aspect | Statement |
|--------|-----------|
| **Purpose** | Preserve stability of public interfaces. |
| **Scope** | EMAS maintainers and ARB. |
| **Rationale** | Contract churn breaks dependents. |
| **Exceptions** | Security defects may require emergency contract tightening with ADR. |
| **Enforcement** | ADR process (§15); conflict log in References. |

---

## 5. System Context

### 5.1 Actors

| Actor | Typical role code | Trust boundary |
|-------|-------------------|----------------|
| Collector / Field agent | `Collector` | Branch-scoped ops; no platform admin |
| Cashier | `Cashier` | Approvals up to GHS 1,000 default |
| Branch Manager | `Admin` | Branch operations & elevated approvals |
| Accountant / Auditor / Ops | various | View/report/audit scoped |
| Super Admin | `KBA` | Elevated platform/dev governance |
| System Owner | `SystemOwner` (`john`) | Highest privilege; config/platform emergencies |
| External partner (MoMo, SMS, webhooks) | N/A | Outside trust; enters via Modules 16/20/28 |

### 5.2 External systems

| System | Interaction | Boundary module |
|--------|-------------|-----------------|
| Mobile money providers | Payments / webhooks | 16, extended by 28 |
| SMS / notification channels | Outbound messages | 12 |
| Supabase (optional) | Snapshots / SQL migrations | Data layer |
| Partner APIs | Hub dispatch / transforms | 28 (extends 20) |

### 5.3 Trust / data / admin / ops boundaries

| Boundary | Description |
|----------|-------------|
| **Trust** | Session + RBAC (`rbac.js`, `roles.js`); gateway auth methods; API keys hashed |
| **Data** | localStorage snapshot authoritative by default; Postgres optional (`postgresSourceOfTruth` false) |
| **Admin** | Module 14 system config; Module 30 tenants/flags/licenses/envs |
| **Ops** | Modules 18–22 (jobs, monitoring, gateway, backup, security); Module 30 ops center / DR governance |

```text
[Android APK | Web | Electron EXE]
        |  app.js UI
        v
[src/core engines + invokeContract]
        |                 \
        v                  v
[localStorage snapshot]  [optional Supabase]
        ^
[external MoMo/SMS/partners via 16/20/28 facades]
```

---

## 6. Enterprise Architecture Overview

| Layer | Responsibility | Primary modules |
|-------|----------------|-----------------|
| **Android / Web / Desktop presentation** | Live UI in `app.js`; limited module views (no new top-level nav for 28–30 beyond existing patterns) | UI + Modules 1–11 screens |
| **Core engines** | Domain logic, money, workflows, rules | `src/core/*` Modules 1–27 |
| **Gateway** | In-process routing, clients, webhooks facade | **20** (+ **28** hub) |
| **Data** | Snapshot state, canonical schema, identifiers, exchange | CDM docs, **15**, **25**, migrations |
| **Integrations** | Provider registry, transforms, delivery, partner dispatch | **28** (extends **16**/**20**) |
| **AI** | Advisory predictions, fraud heuristics, models/governance | **29** (≠ **24**) |
| **Platform Admin** | Tenants, flags, licenses, deploy/maintenance metadata | **30** |

Cross-cutting: **13** Audit, **19** Monitoring, Global API Schema (`api-schema.js`), Identifiers (`identifiers.js`).

---

## 7. Module Catalog (Modules 1–30)

Business owner defaults to **Smile Trust Operations** unless noted. Technical owner defaults to **Platform Engineering** (`src/core` maintainers). **Public interfaces** are summarized; full lists live in `module-contracts.js`.

### Module 1 — Authentication & Session

| Field | Value |
|-------|-------|
| **Purpose** | Login, logout, password, device registration, session validation |
| **Responsibilities** | Authenticate users; expose profile/permissions queries |
| **Ownership boundaries** | Owns auth commands; does not post finance |
| **Dependencies** | Consumes 14, 13, 19 |
| **Dependents** | Most modules (session prerequisite) |
| **Public interfaces** | `Authentication.*`, `User.*`, `Session.Validate.v1` |
| **Events** | `UserAuthenticated`, `UserLoggedOut`, `PasswordChanged`, `DeviceRegistered` |
| **APIs / DB** | Contracts via gateway; users in snapshot / `app_users` target |
| **Security** | Credential handling, session integrity |
| **Cores / docs** | `session.js`, `system-accounts.js`, `roles.js`, `rbac.js` (no dedicated `docs/` module file) |

### Module 2 — Dashboard

| Field | Value |
|-------|-------|
| **Purpose** | Operational KPIs and widgets for home dashboard |
| **Responsibilities** | Query aggregates; no financial posting |
| **Dependencies** | Queries only (`MODULE_CONSUME` = `queries`) |
| **Public interfaces** | `Dashboard.GetSummary.v1`, `Dashboard.GetKPIs.v1`, … |
| **Events** | `DashboardCacheRefreshed` |
| **Cores / docs** | Live UI + `tests/dashboard-analytics.test.js` |

### Module 3 — Customer CRM

| Field | Value |
|-------|-------|
| **Purpose** | Customer lifecycle (create/update/suspend/close) |
| **Dependencies** | 1, 5, 17, 13 |
| **Public interfaces** | `Customer.*` |
| **Events** | `CustomerCreated`, `CustomerUpdated`, `CustomerSuspended`, `CustomerClosed` |
| **DB** | Customers in snapshot; migration `008_customer_crm.sql` |
| **Cores / docs** | CRM paths in app + customer tests (no dedicated module md) |

### Module 4 — Agent & Collector Management

| Field | Value |
|-------|-------|
| **Purpose** | Agents/collectors assignment and status |
| **Doc** | [`agent-management.md`](./agent-management.md) |
| **Dependencies** | 1, 5, 3, 13 |
| **Cores** | `agent-ops`-related paths / app agent screens |

### Module 5 — Branch Management

| Field | Value |
|-------|-------|
| **Purpose** | Branch create/update/activate |
| **Doc** | [`branch-management.md`](./branch-management.md) |
| **Dependencies** | 1, 14 |
| **Cores** | `branch-ops.js` |

### Module 6 — Individual Savings Collection

| Field | Value |
|-------|-------|
| **Purpose** | Collect/adjust/cancel savings (**posting owner**) |
| **Doc** | [`individual-savings-collection.md`](./individual-savings-collection.md) |
| **Dependencies** | 3, 4, 5, 10, 16, 17 |
| **Public interfaces** | `Savings.Collect.v1`, … (`posting: true`, owner-internal) |
| **Events** | `SavingsCollected`, `SavingsAdjusted`, `SavingsCancelled` |
| **Security** | Collection RBAC; idempotency; audit Class A with Module 13 |

### Module 7 — Group Susu Management

| Field | Value |
|-------|-------|
| **Purpose** | Group membership and contributions (**posting**) |
| **Doc** | [`group-susu-management.md`](./group-susu-management.md) |
| **Dependencies** | 3, 10, 16, 17 |
| **Cores** | `group-ops.js` |

### Module 8 — Loans

| Field | Value |
|-------|-------|
| **Purpose** | Loan apply/approve/disburse/repay/close (**posting**) |
| **Doc** | [`loan-status-transitions.md`](./loan-status-transitions.md) |
| **Defaults** | Interest **15%** (config); cycle context **31** days |
| **Dependencies** | 3, 10, 16, 17 |
| **Cores** | `loans-workflow.js`, loan ops in app/core |

### Module 9 — Withdrawals & Savings Redemption

| Field | Value |
|-------|-------|
| **Purpose** | Withdrawal request/approve/execute (**posting**) |
| **Doc** | [`withdrawals-savings-redemption.md`](./withdrawals-savings-redemption.md) |
| **Dependencies** | 3, 10, 16, 17 |
| **Cores** | `withdrawal-ops.js` |

### Module 10 — Accounting & General Ledger

| Field | Value |
|-------|-------|
| **Purpose** | Journal post/reverse, period close, trial balance (**posting**) |
| **Doc** | [`accounting-general-ledger.md`](./accounting-general-ledger.md) |
| **Dependencies** | 6, 7, 8, 9, 16 |
| **Cores** | `accounting-ops.js`, double-entry engines |

### Module 11 — Reports, Analytics & BI (operational)

| Field | Value |
|-------|-------|
| **Purpose** | Live reports panel / report runner |
| **Doc** | [`reports-analytics-bi.md`](./reports-analytics-bi.md) |
| **Dependencies** | Queries only; reuses Module 10 balances (does not recalculate) |
| **Note** | Module **27** adds enterprise metric/KPI/schema registries; does **not** replace Module 11 UI |
| **Cores** | `report-ops.js` |

### Module 12 — Notification & Communication

| Field | Value |
|-------|-------|
| **Purpose** | Send/schedule/cancel notifications |
| **Doc** | [`notification-communication.md`](./notification-communication.md) |
| **Dependencies** | `all` (broad emitter/consumer) |
| **Cores** | `notification-ops.js`, `notifications.js` |

### Module 13 — Audit Trail & Compliance

| Field | Value |
|-------|-------|
| **Purpose** | Immutable activity logging; compliance export/search |
| **Doc** | [`audit-compliance.md`](./audit-compliance.md) |
| **Dependencies** | Events (+ `Audit.Record.v1`) |
| **Cores** | `audit-ops.js` |
| **Security** | Class A transactional coupling with collections where specified |

### Module 14 — System Administration & Configuration

| Field | Value |
|-------|-------|
| **Purpose** | Organization/finance/security parameters & feature flags base |
| **Doc** | [`system-administration.md`](./system-administration.md) |
| **Dependencies** | 19, 18, 22 |
| **Defaults owned** | Loan interest 15, collection days 31, cashier GHS 1000 |
| **Cores** | `system-config.js` |
| **Note** | Module **30** extends flag evaluation (kill-switch, gradual, tenant) without replacing base catalog |

### Module 15 — Offline Synchronization & Conflict Resolution

| Field | Value |
|-------|-------|
| **Purpose** | Offline queue upload/download/conflict resolution |
| **Doc** | [`offline-sync.md`](./offline-sync.md) |
| **Dependencies** | 3, 6, 8, 16, 17 |
| **Cores** | `sync-ops.js`, idempotency |

### Module 16 — Mobile Money & Payment Gateway Integration

| Field | Value |
|-------|-------|
| **Purpose** | Payment initiate/verify/reverse; provider health |
| **Doc** | [`payment-engine.md`](./payment-engine.md) |
| **Dependencies** | 10, 17, 12 |
| **Cores** | `payment-ops.js`, `payment-lifecycle.js`, `momo-webhook.js` |
| **Note** | Module **28** extends partner integration; does not replace MoMo engine |

### Module 17 — Receipt, Document & Statement Management

| Field | Value |
|-------|-------|
| **Purpose** | Receipt/statement generation (numbers, printables) |
| **Doc** | [`document-engine.md`](./document-engine.md) |
| **Dependencies** | 10, 16, 3 |
| **Cores** | `document-ops.js`, `receipts.js` |
| **Note** | Module **26** indexes/archives; does **not** generate receipt numbers |

### Module 18 — Background Jobs, Queue & Scheduler

| Field | Value |
|-------|-------|
| **Purpose** | Enqueue/cancel/retry jobs; shared scheduler |
| **Doc** | [`job-engine.md`](./job-engine.md) |
| **Dependencies** | `all` |
| **Cores** | `job-ops.js`, `job-lifecycle.js` |

### Module 19 — Monitoring, Observability, Health & Diagnostics

| Field | Value |
|-------|-------|
| **Purpose** | Metrics, logs, alerts, health |
| **Doc** | [`monitoring-engine.md`](./monitoring-engine.md) |
| **Dependencies** | `all` |
| **Cores** | `monitoring-ops.js`, `monitoring-lifecycle.js` |

### Module 20 — API Gateway & External Integration Platform

| Field | Value |
|-------|-------|
| **Purpose** | In-process gateway: clients, keys, route dispatch, webhook receive facade |
| **Doc** | [`api-gateway.md`](./api-gateway.md) |
| **Dependencies** | Public contracts only (`MODULE_CONSUME` = `public`) |
| **Public interfaces** | `API.RegisterClient.v1`, `API.RevokeKey.v1`, usage queries |
| **Cores** | `api-gateway-ops.js`, `api-gateway-lifecycle.js`, `api-schema.js` |
| **Security** | Auth methods, rate limits, no second posting path |
| **Related** | [`api-schema.md`](./api-schema.md) — global envelopes/headers |

### Module 21 — Backup, Restore, DR & Business Continuity

| Field | Value |
|-------|-------|
| **Purpose** | Backup/restore/recovery drills |
| **Doc** | [`backup-recovery.md`](./backup-recovery.md) |
| **Dependencies** | Backup rule (+ queries) |
| **Cores** | `backup-recovery-ops.js`, `backup-recovery-lifecycle.js` |
| **Defaults** | RTO 240 min / RPO 60 min (configurable) |

### Module 22 — Security Operations, Fraud Detection & Risk Management

| Field | Value |
|-------|-------|
| **Purpose** | Risk scoring, incidents, fraud investigation |
| **Doc** | [`security-operations.md`](./security-operations.md) |
| **Dependencies** | 13, 19, 1, 16, 15, 23, 24 |
| **Cores** | `security-ops.js`, `security-lifecycle.js` |
| **Boundary** | Does not create alternate collection posting |

### Module 23 — Workflow Engine & Case Management

| Field | Value |
|-------|-------|
| **Purpose** | Process automation, tasks, approvals, cases, SLA |
| **Doc** | [`workflow-engine.md`](./workflow-engine.md) |
| **Dependencies** | `all` |
| **Cores** | `workflow-ops.js`, `workflow-api.js`, `workflow-lifecycle.js` |
| **Boundary** | Does not own business rules or post collections |

### Module 24 — Rule Engine & Decision Management

| Field | Value |
|-------|-------|
| **Purpose** | **Deterministic** rule evaluation, publish, simulate, approve |
| **Doc** | [`rule-engine.md`](./rule-engine.md) |
| **Dependencies** | 13, 18, 19, 20, 23 |
| **Cores** | `rule-ops.js`, `rule-api.js`, `rule-expression.js`, `rule-lifecycle.js`, `rule-slo.js` |
| **Boundary** | Side-effect-free evaluation; **not** replaced by Module 29 |

### Module 25 — Data Exchange, Import, Export & Migration

| Field | Value |
|-------|-------|
| **Purpose** | Import/export/migrate/bulk with policy and jobs |
| **Doc** | [`data-exchange.md`](./data-exchange.md) |
| **Dependencies** | 13, 18, 19, 20, 23, 24 |
| **Cores** | `exchange-ops.js`, `exchange-api.js`, `export-policy.js`, `exchange-lifecycle.js` |
| **Migration** | `038_data_exchange.sql` |
| **Boundary** | `financialApply: false` — does not post journals/collections |

### Module 26 — Document & Digital Records Management

| Field | Value |
|-------|-------|
| **Purpose** | File store, versions, retention, legal hold, search |
| **Doc** | [`digital-records.md`](./digital-records.md) |
| **Dependencies** | 13, 17, 18, 19, 20, 23 |
| **Cores** | `records-ops.js`, `records-api.js`, `records-lifecycle.js` |
| **Migration** | `039_digital_records.sql` |
| **Boundary** | Does not issue receipt numbers (Module 17 owns) |

### Module 27 — Enterprise BI, KPI & Schema Registries

| Field | Value |
|-------|-------|
| **Purpose** | Metric/KPI/schema registries and calculations |
| **Doc** | [`enterprise-bi.md`](./enterprise-bi.md) |
| **Dependencies** | 11, 13, 18, 19, 20, 23, 24 |
| **Cores** | `bi-ops.js`, `bi-api.js`, `bi-lifecycle.js`, `metric-schema.js`, `schema-metadata.js`, `schema-checksum.js` |
| **Migration** | `040_enterprise_bi.sql` |
| **Boundary** | Does not replace Module 11 UI; no posting |

### Module 28 — Enterprise Integration Hub & Third-Party API Gateway

| Field | Value |
|-------|-------|
| **Purpose** | Centralized in-process partner hub (extends Module 20) |
| **Doc** | [`enterprise-integration.md`](./enterprise-integration.md) |
| **Dependencies** | 13, 18, 19, 20, 16, 23, 25 |
| **Cores** | `integration-ops.js`, `integration-api.js`, `integration-delivery.js`, `integration-messaging.js`, `integration-transforms.js`, `integration-lifecycle.js` |
| **Migration** | `041_enterprise_integration.sql` |
| **Events** | `ProviderRegistered`, `IntegrationClientRegistered`, `WebhookRegistered`, `IntegrationDispatched` |
| **Boundary** | Extends — does **not** replace — Module 20; no collection posting |

### Module 29 — Enterprise AI, ML & Predictive Intelligence

| Field | Value |
|-------|-------|
| **Purpose** | Advisory predictions, fraud heuristics, recommendations, models/governance |
| **Doc** | [`enterprise-ai.md`](./enterprise-ai.md) |
| **Dependencies** | 13, 18, 19, 20, 23, **24**, 27 |
| **Cores** | `ai-ops.js`, `ai-api.js`, `ai-governance.js`, `ai-lifecycle.js`, `ai-permission-registry.js` |
| **Migration** | `042_enterprise_ai.sql` |
| **Critical boundary** | **AI does not own transactional posting**; `postsCollections: false`; never replaces Module 24 |
| **Events** | `PredictionGenerated`, `FraudAlertCreated`, `ModelDeployed`, `DriftDetected` |

### Module 30 — Enterprise Platform Administration

| Field | Value |
|-------|-------|
| **Purpose** | Tenants, platform config publish, feature flags (incl. kill-switch), licenses, environments, maintenance, deploy metadata, ops/DR dashboards |
| **Doc** | [`platform-administration.md`](./platform-administration.md) |
| **Dependencies** | Governs config/flags across 1–29; consumes gateway/monitoring/backup patterns; open consume for non-owner-internal 24–30 peers per `mayConsume` |
| **Cores** | `platform-ops.js`, `platform-api.js`, `platform-lifecycle.js`; UI `src/ui/platform-views.js` |
| **Migration** | `043_platform_admin.sql` |
| **Flag** | `enablePlatformAdmin` (default on) |
| **Boundary** | Final major module; does not duplicate 1–29 business logic or post money |
| **Events** | `TenantSuspended`, `FeatureFlagKilled`, `MaintenanceStarted`, `LicenseExpired` |

### Cross-cutting standards (not separate numbered modules)

| Standard | Doc | Core |
|----------|-----|------|
| Canonical data model | [`canonical-data-model.md`](./canonical-data-model.md) | `canonical-schema.js` |
| Identifiers | [`identifiers.md`](./identifiers.md) | `identifiers.js` |
| Global API schema | [`api-schema.md`](./api-schema.md) | `api-schema.js` |

---

## 8. Interaction Architecture

1. **UI → Engine:** `app.js` calls core ops or `invokeContract`.
2. **Cross-module:** Only via `invokeContract({ contractId, fromModule, payload, user, … })`.
3. **Gateway:** `dispatchGatewayRequest` maps facade routes to contracts (Module 20); Module 28 `hubDispatch` may bridge routes without duplicating posting.
4. **Events:** `publishDomainEvent` with owning `moduleId`; Module 13 consumes events.
5. **Jobs:** Module 18 handlers registered by feature modules (backup, exchange, AI drift, platform license expire, etc.).
6. **Forbidden:** direct SQL from clients, private method imports across modules, bypassing gateway for “external” facades, dual posting.

Detailed matrices: [`emas-matrices.md`](./emas-matrices.md) §§ Communication & Dependency.

---

## 9. Data Architecture

| Store | Authority today | Notes |
|-------|-----------------|-------|
| `localStorage` `smile_trust_susu_v1` | **Yes** | Full snapshot |
| Session storage | No | Current user id |
| Supabase snapshots / PG migrations 001–043 | Optional | Not default SoT |
| Offline queue | Staging | Module 15 |

**Money:** integer pesewas in cores; display GHS.  
**IDs:** Global catalog in `identifiers.js` / [`identifiers.md`](./identifiers.md).  
**Exchange:** Module 25 for bulk import/export without financial apply.  
**Records:** Module 26 for document blobs/metadata.  
**BI schemas:** Module 27 registries (checksummed metadata).

---

## 10. Security Architecture

| Control | Owner |
|---------|-------|
| Authentication / session | Module 1 |
| RBAC actions & forbidden lists | `rbac.js` (unchanged by EMAS) |
| Audit | Module 13 |
| Fraud / risk / incidents | Module 22 (+ advisory Module 29) |
| Gateway auth, keys, rate limits | Module 20 / 28 |
| Backup encryption & DR drills | Module 21 / 30 DR verify |
| Config & flag governance | Modules 14 / 30 |
| AI permission registry & SoD | Module 29 governance |

**Roles (aliases):** Branch Manager=`Admin`; Super Admin=`KBA`; SystemOwner=`john`.

---

## 11. Integration Architecture

See Module **28** [`enterprise-integration.md`](./enterprise-integration.md) and Module **20** [`api-gateway.md`](./api-gateway.md).

- Hub **extends** gateway; MoMo remains Module **16**.
- Transforms, webhook deliver/replay, delivery deadlines, provider health.
- Observability to Module **19**; audit with `module: "28"`.
- No REST/GraphQL HTTP server.

---

## 12. AI Architecture

See Module **29** [`enterprise-ai.md`](./enterprise-ai.md).

| Concern | Authority |
|---------|-----------|
| Deterministic policy / decision tables | **Module 24 Rule Engine** |
| Advisory prediction, fraud heuristic, forecast | **Module 29 AI** |
| Human/workflow authorization before financial effect | Modules **23** / posting owners |
| Transactional posting | **Not AI** — explicitly `postsCollections: false` |

---

## 13. Deployment Architecture

| Target | Mechanism |
|--------|-----------|
| Web assets | `npm run prepare:web` → `www/` |
| Android APK | Capacitor (`cap:sync`, `build:apk`) |
| Windows EXE | Electron Builder (`build:exe`) |
| CI/CD | Local/npm scripts; platform deploy metadata in Module 30 (plan/approve/execute/rollback records) |
| Env isolation | Module 30 environments + config; feature flags |
| DR | Module 21 backup/restore + Module 30 DR verify/dashboard; default RTO/RPO from Module 21 |

Same `app.js` + `src/core` engines across targets.

---

## 14. Observability Architecture

See Module **19** [`monitoring-engine.md`](./monitoring-engine.md).

- Metrics, logs, alerts, health/readiness patterns used by gateway, jobs, integration, AI, platform.
- Correlation / trace IDs via Global API Schema.
- Domain audit remains Module **13** (compliance), complementary to ops telemetry.

---

## 15. Governance Model

### Architecture Review Board (ARB)

- **Chair:** System Owner (`john`) or delegate.
- **Members:** KBA technical leads + Operations (Admin) representative.
- **Mandate:** Approve cross-module contract changes, new modules, exceptions to GPs, deprecations.

### Architecture Decision Records (ADRs)

- Store under `docs/adr/` when introduced (not required for this Phase 1 file set).
- EMAS § Architecture decision summary (below) captures current standing decisions.

### Change & deprecation

- Contracts: `draft` → `active` → `deprecated` → `retired` (`CONTRACT_STATUSES`).
- Breaking contract changes require major version and ARB approval.
- Module 30 is the **final major module**; further work is consolidation/quality unless ARB opens a new major module.

### Exceptions

- Documented in ADRs; time-boxed; reviewed.
- EMAS prefers **documenting** verified conflicts over changing live posting/RBAC/money.

---

## 16. Quality Attributes / SLOs

| Attribute | Target (architecture intent) |
|-----------|------------------------------|
| Contract boundary integrity | 100% cross-module calls via `invokeContract` |
| Money correctness | Integer pesewas; interest/limit defaults stable unless config change audited |
| Gateway posture | In-process only; no accidental HTTP API |
| Backup | Configurable RTO ≤ 240 min, RPO ≤ 60 min (Module 21 defaults) |
| Rule evaluation | Side-effect-free; SLOs in `rule-slo.js` / Module 24 docs |
| AI safety | Advisory; no transactional posting; human oversight for financial effect |
| Observability | Privileged actions audited; critical failures alert via Module 19 |

Exact numeric SLOs for latency may be module-specific; EMAS defers to Module 19/24 docs for operational dashboards.

---

## 17. Risk Considerations

| Risk | Mitigation |
|------|------------|
| Dual posting paths | GP-04; contract `posting`/`ownerInternal`; boundary asserts |
| AI treated as authority | GP-05; Module 29 docs; tests assert non-posting |
| localStorage loss | Module 21 backups; optional Supabase snapshot |
| Partner credential leakage | Hub hashes/refs; no MoMo PINs in Module 28 boundary |
| Config drift (interest/cashier) | Module 14 high-risk drafts; Module 30 flag kill-switch |
| Spec vs code drift | EMAS consistency tests; prefer document conflicts |
| `MODULE_CONSUME` incomplete for Module 30 as *from* entry | Documented: `mayConsume` special-case allows peers 24–30; Platform governs via own contracts |

---

## 18. Traceability Model

| Artifact | Traces to |
|----------|-----------|
| EMAS Module Catalog §7 | `docs/*` module specs + `src/core/*` |
| Contracts | `CONTRACT_CATALOG` in `module-contracts.js` |
| Dependencies | `MODULE_CONSUME` + matrices |
| Schema / tables | `supabase/migrations/0xx_*.sql` (esp. 038–043 for 25–30) |
| Tests | `tests/*-ops.test.js`, `tests/emas-consistency.test.js` |
| UI | `app.js` (+ limited `src/ui/*-views.js`) |

Requirement → Module → Contract → Core → Test → Migration (when applicable).

---

## 19. Glossary

| Term | Definition |
|------|------------|
| **EMAS** | Enterprise Master Architecture Specification (this document) |
| **Pesewas** | Integer minor currency unit used in cores (100 pesewas = 1 GHS) |
| **invokeContract** | In-process public interface invocation |
| **Owner-internal** | Contract callable only by owning module |
| **Posting** | Financial write affecting collections/loans/journals/withdrawals |
| **Advisory AI** | Probabilistic output requiring human/workflow before money movement |
| **Rule Engine** | Deterministic decision authority (Module 24) |
| **Gateway** | Module 20 in-process router (not an HTTP server) |
| **Integration Hub** | Module 28 partner extension of gateway |
| **Platform Admin** | Module 30 tenant/flag/license/ops governance |
| **Admin** | Branch Manager role code |
| **KBA** | Super Admin role code |
| **SystemOwner / john** | Highest privilege operator account |

---

## 20. References

### Module specifications

| ID | Doc |
|----|-----|
| 4 | [agent-management.md](./agent-management.md) |
| 5 | [branch-management.md](./branch-management.md) |
| 6 | [individual-savings-collection.md](./individual-savings-collection.md) |
| 7 | [group-susu-management.md](./group-susu-management.md) |
| 8 | [loan-status-transitions.md](./loan-status-transitions.md) |
| 9 | [withdrawals-savings-redemption.md](./withdrawals-savings-redemption.md) |
| 10 | [accounting-general-ledger.md](./accounting-general-ledger.md) |
| 11 | [reports-analytics-bi.md](./reports-analytics-bi.md) |
| 12 | [notification-communication.md](./notification-communication.md) |
| 13 | [audit-compliance.md](./audit-compliance.md) |
| 14 | [system-administration.md](./system-administration.md) |
| 15 | [offline-sync.md](./offline-sync.md) |
| 16 | [payment-engine.md](./payment-engine.md) |
| 17 | [document-engine.md](./document-engine.md) |
| 18 | [job-engine.md](./job-engine.md) |
| 19 | [monitoring-engine.md](./monitoring-engine.md) |
| 20 | [api-gateway.md](./api-gateway.md) |
| 21 | [backup-recovery.md](./backup-recovery.md) |
| 22 | [security-operations.md](./security-operations.md) |
| 23 | [workflow-engine.md](./workflow-engine.md) |
| 24 | [rule-engine.md](./rule-engine.md) |
| 25 | [data-exchange.md](./data-exchange.md) |
| 26 | [digital-records.md](./digital-records.md) |
| 27 | [enterprise-bi.md](./enterprise-bi.md) |
| 28 | [enterprise-integration.md](./enterprise-integration.md) |
| 29 | [enterprise-ai.md](./enterprise-ai.md) |
| 30 | [platform-administration.md](./platform-administration.md) |

### Cross-cutting & matrices

- [canonical-data-model.md](./canonical-data-model.md)
- [identifiers.md](./identifiers.md)
- [api-schema.md](./api-schema.md)
- [emas-matrices.md](./emas-matrices.md) — relationship, dependency, communication, responsibility, standards index, ADR summary, cross-ref

### Code & schema

- `src/core/module-contracts.js` — contracts & consume matrix
- `src/core/*` — engines
- `app.js` — live UI
- `supabase/migrations/` — especially `038`–`043` for Modules 25–30

### Assumptions (mapping clarity)

1. Modules **1–3** lack dedicated `docs/*.md` files; catalog entries are inferred from `CONTRACT_CATALOG`, cores, and tests.
2. Module **8** detailed product behavior spans live loan UI plus [`loan-status-transitions.md`](./loan-status-transitions.md).
3. SQL migration order **038→043** confirms Modules **25→30** naming used in docs titles.
4. Comment in `module-contracts.js` (“modules 1–27”) is stale relative to catalog through **30** — catalog code is authoritative; documented here rather than changing code (GP-08).

### Verified conflicts / notes (document-only)

| Item | Resolution in EMAS |
|------|-------------------|
| Specs saying REST/GraphQL | Interpreted as in-process facades |
| Module 11 vs 27 BI | 11 = live reports UI; 27 = enterprise registries |
| Module 17 vs 26 documents | 17 generates receipts; 26 records/retention |
| Module 20 vs 28 gateway | 28 extends 20 |
| Module 24 vs 29 decisions | 24 deterministic; 29 advisory |
| Stale “1–27” comment in contracts file | Documented; no code change in Phase 1 EMAS |

---

## Architecture decision summary (standing)

| ID | Decision | Status |
|----|----------|--------|
| AD-01 | Vanilla JS SPA + Capacitor + Electron; shared cores | Accepted |
| AD-02 | No standalone REST/GraphQL HTTP server; Module 20 in-process | Accepted |
| AD-03 | localStorage snapshot primary; Supabase optional | Accepted |
| AD-04 | Money: integer pesewas in core | Accepted |
| AD-05 | Cross-module only via versioned contracts | Accepted |
| AD-06 | AI advisory only; Rule Engine deterministic | Accepted |
| AD-07 | Module 30 is final major module | Accepted |
| AD-08 | Prefer document conflicts over silent contract/RBAC/money changes | Accepted |

---

*End of EMAS v1.0.0*
