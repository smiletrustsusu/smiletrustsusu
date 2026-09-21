# Enterprise Implementation Roadmap (EIR)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Execution roadmap — 10 sequential delivery waves  
**Status:** Authoritative for **wave sequencing & gap-closure delivery** (not a rewrite of domain specs)  
**Version:** 1.0.0  
**Date:** 2026-09-15  
**Machine registry:** `src/core/enterprise-roadmap-registry.js`  
**Companion catalogs:** [`eir-catalogs.md`](./eir-catalogs.md) · [`backlog/eir-catalog-aliases.md`](./backlog/eir-catalog-aliases.md) (GAP-022)  
**Schema:** [`schemas/roadmap/implementation-wave.schema.json`](./schemas/roadmap/implementation-wave.schema.json)  
**Backlog SoT (consumed):** [`master-implementation-backlog.md`](./master-implementation-backlog.md) · `src/core/master-backlog-registry.js` · `src/core/master-backlog-waves.js`  
**Upstream baseline:** [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) (Phase 20 EIBPRFBS)

---

## 1. Executive Summary

This roadmap converts the **Master Implementation Backlog (MIB)** into **10 sequential enterprise delivery waves** (WAVE-01 … WAVE-10). It is the **execution sequencing SoT** for gap closure, hardening, and production readiness.

| Principle | Application |
|-----------|-------------|
| Dependency-driven | WAVE-n cannot start until WAVE-(n−1) exit criteria are met |
| Risk-driven | Critical money/sync/readiness risks gated early and re-checked late |
| Incremental | Each wave is independently buildable, testable, and deployable after prerequisites |
| Test-first | Quality gates and test requirements are mandatory exit evidence |
| Production-oriented | WAVE-10 consumes Phase 16/14/19/20 gates — fail closed |
| Scalable | Resource peaks sized for FinTech Susu hardening, not greenfield rewrite |
| Traceable | Every MIB backlog item maps to **exactly one** EIR wave |
| Auditable | `validateEnterpriseRoadmap()` must return **critical = 0** |

**Realism:** Substantial Modules 1–30 code and Phases 1–20 catalogs already exist. Waves **1–8** are largely **Mostly Complete** (gap closure + hardening). Wave **9** is **In Progress**. Wave **10** is **Planned**. Durations reflect **hardening / readiness**, not rebuild-from-zero. Phase 20 publication does **not** mean live production is certified.

**Money invariants (normative):** amounts in **integer pesewas**; default interest **15%**; collection cycle **31 days**; cashier float limit **1000**.

**Stack constraints:** no Next.js/Flutter rewrite; no new real HTTP servers; no new top-level nav. Web sync via `npm run prepare:web` → `www/`.

**Does not redefine** Phases 1–20 prose/registries or Modules 1–30 runtime engines. Does **not** invent a second backlog — MIB IDs are mapped, not duplicated.

---

## 2. Wave Overview Table

| Wave | Name | MIB waves | Status | Duration (weeks) | Focus |
|------|------|-----------|--------|------------------|--------|
| WAVE-01 | Foundation Platform | 1–3 | Mostly Complete | 1–2 | Repo, auth, RBAC, tenant/branch, config, audit |
| WAVE-02 | Database Platform | 4 | Mostly Complete | 1–2 | PG schema, migrations, rollbacks |
| WAVE-03 | Core Services | 5 | Mostly Complete | 1–2 | In-process Auth/Customer/Savings/… APIs |
| WAVE-04 | Offline Platform | 6 | Mostly Complete | 1–2 | Encrypted store, sync, conflict, recovery |
| WAVE-05 | Core Business Modules | 7–9 | Mostly Complete | 2–3 | Customers, savings, collections, receipts |
| WAVE-06 | Windows Desktop EXE | 10 | Mostly Complete | 1–2 | Electron EXE shared-core (alias: Loan Platform) |
| WAVE-07 | Enterprise Analytics & BI | 11 | Mostly Complete | 1–2 | KPI/BI/AI facade (alias: Accounting Platform) |
| WAVE-08 | Release Certification | 12–13 | Mostly Complete | 1–2 | RC1 / Phase 16 gates (alias: Reporting Platform) |
| WAVE-09 | Pilot / UAT / Ops Readiness | 14–17 | Mostly Complete | 2–3 | Pilot pack, UAT, ops readiness (hist. Enterprise Features) |
| WAVE-10 | Prod Deploy / Go-Live / Hypercare | 18–20 | Mostly Complete | 4–6 | Cutover, rollback, hypercare, closure (framework) |

**Calendar-relative total (sequential):** ~**16–27 weeks** of gap closure + hardening after WAVE-01 entry.

MIB ↔ EIR mapping table and counts: [`eir-catalogs.md`](./eir-catalogs.md).

---

## 3. Detailed Wave Specifications

### WAVE-01 — Foundation Platform

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-01` |
| **Name** | Foundation Platform |
| **Objectives** | Harden repo/architecture/env, Supabase auth, RBAC, tenant/branch, config, logging, audit, errors, feature flags |
| **Deliverables** | Auth/RBAC/branch verification pack; config/feature-flag/audit smoke; WAVE-01 exit evidence |
| **Scope** | Foundation, Auth & RBAC, Tenant & Branch (MIB 1–3) |
| **Out of scope** | Live prod certification; stack rewrites; Phase/Module redefinition |
| **Dependencies** | None (first wave). Phases 1,2,8,9,10 · Modules 1,5,13,14,23,24,30 |
| **Risks** | EIR-R-001 RBAC drift; EIR-R-002 config EXE/APK mismatch |
| **Required skills** | Platform, Security, Supabase/Auth |
| **Estimated duration** | 1–2 weeks · ~6 person-weeks |
| **Entry criteria** | Phase 20 baseline published; MIB loadable; test harness available |
| **Exit criteria** | MIB waves 1–3 exit met/gap-tracked; audit/error smoke verified; validators critical=0 |
| **Acceptance criteria** | Platform Admin acceptance; money invariants preserved; no silent redefinition |
| **Quality gates** | QG-001, QG-002, Phase 16 in-scope suites, prepare:web clean, security smoke |
| **Test requirements** | Auth/RBAC regression; branch isolation; MIB consistency |
| **Release milestones** | MS-W01-HARDEN, MS-W01-EXIT |
| **Required documentation** | This doc, MIB, EMAS, Phase 20 baseline, `docs/wave1-foundation.md` |
| **Build sequence** | Before: — · After: WAVE-02 · Blocking: — · Parallel: limited platform chores · **Critical path: yes** |
| **Backlog refs** | All MIB items mapped to WAVE-01 (see registry `listBacklogForWave('WAVE-01')`) |
| **Status** | Mostly Complete (foundation pack: `docs/wave1-foundation.md`) |

### WAVE-02 — Database Platform

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-02` |
| **Name** | Database Platform |
| **Objectives** | Align PG schema/constraints/indexes/views/triggers/RPCs/seeds; verify migrations & rollbacks |
| **Deliverables** | Migration/rollback report; money-column integrity checklist; WAVE-02 exit package |
| **Scope** | MIB wave 4 DATABASE · Modules 14,25,30 · Phase 7 |
| **Dependencies** | **Requires WAVE-01 exit** |
| **Risks** | EIR-R-003 migration break on money tables; EIR-R-004 index drift |
| **Required skills** | DBA, Platform, Supabase |
| **Estimated duration** | 1–2 weeks · ~5 person-weeks |
| **Entry criteria** | WAVE-01 exit criteria met; ECDAPS available |
| **Exit criteria** | MIB wave 4 exit met/gaps ticketed; rollback drill documented |
| **Acceptance criteria** | Platform Admin / DBA acceptance; pesewas integrity |
| **Quality gates** | QG-001/002 + migration dry-run + rollback evidence |
| **Test requirements** | Schema consistency; migration/rollback rehearsal |
| **Release milestones** | MS-W02-MIGRATE, MS-W02-EXIT |
| **Build sequence** | Before: WAVE-01 · After: WAVE-03 · **Critical path: yes** |
| **Status** | Mostly Complete |

### WAVE-03 — Core Services

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-03` |
| **Name** | Core Services |
| **Objectives** | Harden in-process Auth/Customer/Savings/Branch/User/Audit/Notification APIs & gateway facades |
| **Deliverables** | Contract verification pack; facade consistency evidence |
| **Scope** | MIB wave 5 CORE_APIS · Modules 18,20,28 · Phases 6,11 |
| **Dependencies** | **Requires WAVE-01…WAVE-02 exit** (blocking: WAVE-02) |
| **Risks** | EIR-R-005 facade/catalog drift |
| **Required skills** | Integration, Backend, API design |
| **Estimated duration** | 1–2 weeks · ~6 person-weeks |
| **Entry criteria** | WAVE-02 exit criteria met |
| **Exit criteria** | MIB wave 5 exit met; no new HTTP listeners |
| **Acceptance criteria** | CIO / Integration acceptance |
| **Quality gates** | QG-001/002 + API catalog consistency |
| **Test requirements** | API contracts; facade smoke |
| **Release milestones** | MS-W03-API, MS-W03-EXIT |
| **Build sequence** | Before: WAVE-02 · After: WAVE-04 · **Critical path: yes** |
| **Status** | Mostly Complete |

### WAVE-04 — Offline Platform

Delivery pack: `docs/wave4-android-offline.md` (Capacitor + shared SPA sync engine; deep offline/conflict/retry). Status remains Mostly Complete until WAVE-10.

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-04` |
| **Name** | Offline Platform |
| **Objectives** | Encrypted local store, sync queue, conflict, retry, recovery; collector offline safe |
| **Deliverables** | Conflict/recovery evidence; collector offline drill; WAVE-04 exit |
| **Scope** | MIB wave 6 SYNC_ENGINE · Module 15 · Phases 5,14 |
| **Dependencies** | **Requires WAVE-01…WAVE-03 exit** (blocking: WAVE-03) |
| **Risks** | EIR-R-006 double-post on replay; EIR-R-007 conflict policy ambiguity |
| **Required skills** | Platform, Mobile/offline, Domain |
| **Estimated duration** | 1–2 weeks · ~7 person-weeks |
| **Entry criteria** | WAVE-03 exit criteria met |
| **Exit criteria** | MIB wave 6 exit met; offline recovery drill done |
| **Acceptance criteria** | Platform Admin acceptance; money invariants on sync |
| **Quality gates** | QG-001/002 + offline conflict/recovery gate |
| **Test requirements** | Queue/retry; conflict; money offline pack |
| **Release milestones** | MS-W04-SYNC, MS-W04-EXIT |
| **Build sequence** | Before: WAVE-03 · After: WAVE-05 · **Critical path: yes** |
| **Status** | Mostly Complete |

### WAVE-05 — Core Business Modules

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-05` |
| **Name** | Core Business Modules |
| **Objectives** | Customers, savings, daily collections, receipts, passbook, deposits, withdrawals |
| **Deliverables** | Core business regression; receipt/passbook verification |
| **Scope** | MIB waves 7–9 · Modules 3,4,6,7,9,16,17,26 · Phases 3,4,16 |
| **Dependencies** | **Requires WAVE-01…WAVE-04 exit** (blocking: WAVE-04) |
| **Risks** | EIR-R-008 collection day/interest drift; EIR-R-009 cashier float breach |
| **Required skills** | Domain, QA, UI |
| **Estimated duration** | 2–3 weeks · ~12 person-weeks |
| **Entry criteria** | WAVE-04 exit criteria met |
| **Exit criteria** | MIB waves 7–9 exit met; money invariant pack green |
| **Acceptance criteria** | CIO acceptance; pesewas / 15 / 31 / 1000 |
| **Quality gates** | QG-001/002 + money invariant gate |
| **Test requirements** | Collections/savings/withdrawals; receipt smoke; offline replay |
| **Release milestones** | MS-W05-COLLECT, MS-W05-EXIT |
| **Build sequence** | Before: WAVE-04 · After: WAVE-06 · **Critical path: yes** |
| **Status** | Mostly Complete |

### WAVE-06 — Windows Desktop EXE

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-06` |
| **Name** | Windows Desktop EXE |
| **Catalog alias** | Historical EIR name **Loan Platform** (`LOAN_PLATFORM`); MIB wave 10 LOANS / Module 8 remain mapped here |
| **Objectives** | Harden Electron Windows EXE around the shared vanilla JS SPA; preserve Wave 3 `invokeApi` + Wave 4 `runWave4Sync` parity with Web/APK; NSIS+portable packaging; print/export/auto-update scaffolding. Loan deep SM rewrite deferred (Module 8 Mostly Complete). |
| **Deliverables** | Hardened `electron/` main/preload/IPC; shared sync wake hooks; print/export bridges; electron-builder configs; `docs/wave6-windows-exe.md` |
| **Scope** | Electron shell security + packaging · shared SPA `www/` · MIB wave 10 mapping retained |
| **Out of scope** | Electron+Next.js+React rewrite; SQLite business DB; AI auto-approval; loan product deep rewrite |
| **Dependencies** | **Requires WAVE-01…WAVE-05 exit** (blocking: WAVE-05) |
| **Risks** | EIR-R-010 disbursement without approval (loan backlog); EIR-R-011 desktop fork / AI as authority |
| **Required skills** | Desktop/Electron, Domain, QA, Security |
| **Estimated duration** | 1–2 weeks · ~8 person-weeks |
| **Entry criteria** | WAVE-05 exit criteria met; Electron loads `www/` |
| **Exit criteria** | Electron hardening + packaging documented; sync parity tests green; MIB wave 10 exit met or ticketed; no auto-approval path |
| **Acceptance criteria** | CIO acceptance of shared-core EXE (not Next.js); money invariants preserved |
| **Quality gates** | QG-001/002 + IPC allowlist + sync parity + no auto-approval |
| **Test requirements** | IPC allowlist; sync parity; offline queue; builder config; interest 15 surface |
| **Release milestones** | MS-W06-EXE, MS-W06-EXIT |
| **Build sequence** | Before: WAVE-05 · After: WAVE-07 · **Critical path: yes** |
| **Status** | Mostly Complete (`docs/wave6-windows-exe.md`) |

### WAVE-07 — Enterprise Analytics & BI (alias: Accounting Platform)

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-07` |
| **Name** | Enterprise Analytics & BI (`ANALYTICS_BI`) |
| **Objectives** | Shared-core KPI/BI/AI facade (Modules 11/27/29); AI advisory-only; Accounting deep GL deferred |
| **Deliverables** | Wave 7 facade; Reports/Audit panels; `docs/wave7-analytics-bi.md`; KPI fixture tests |
| **Scope** | MIB wave 11 ACCOUNTING mapping retained · Modules 10,11,27,29 · Phases 3,7,11,12,16 |
| **Dependencies** | **Requires WAVE-01…WAVE-06 exit** (blocking: WAVE-05, WAVE-06) |
| **Risks** | EIR-R-012 unbalanced journals (accounting surface); EIR-R-013 non-pesewas; AI treated as authority |
| **Required skills** | Analytics, Finance, Domain, QA, AI |
| **Estimated duration** | 1–2 weeks · ~8 person-weeks |
| **Entry criteria** | WAVE-06 exit criteria met |
| **Exit criteria** | Analytics facade tested; Module 27 KPI SoT; AI advisory-only; MIB 11 gaps ticketed |
| **Acceptance criteria** | CIO / Policy Owner acceptance; integer pesewas; no Next.js BI rewrite |
| **Quality gates** | QG-001/002 + KPI fixture + AI advisory-only + TB gate (accounting surface) |
| **Test requirements** | KPI fixtures; fraud/AI authz; export masking |
| **Release milestones** | MS-W07-ANALYTICS, MS-W07-EXIT |
| **Build sequence** | Before: WAVE-06 · After: WAVE-08 · **Critical path: yes** |
| **Status** | Mostly Complete (`docs/wave7-analytics-bi.md`) |

### WAVE-08 — Release Certification (alias: Reporting Platform)

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-08` |
| **Name** | Release Certification (`RELEASE_CERTIFICATION`) |
| **Objectives** | RC1 platform certifying Waves 1–7 via Phase 16 ETQAVS; reuse npm test |
| **Deliverables** | `validate:rc`; RC evidence JSON; cross-wave smokes; Audit/Reports panel; `docs/wave8-release-certification.md` |
| **Scope** | MIB waves 12–13 mapping retained · Modules 2,11,27 · Phases 13,16,17 |
| **Dependencies** | **Requires WAVE-01…WAVE-07 exit** (blocking: WAVE-07) |
| **Risks** | EIR-R-014 KPI drift; RC1 confused with CERT-001 |
| **Required skills** | QA, Analytics, UI, DevOps |
| **Estimated duration** | 1–2 weeks · ~6 person-weeks |
| **Entry criteria** | WAVE-07 exit criteria met |
| **Exit criteria** | RC1 evidence PASS (or blockers ticketed); QG-001/002 smoke green |
| **Acceptance criteria** | QA Lead / CIO pilot entry acceptance; **CERT-001 not claimed** |
| **Quality gates** | QG-001/002 + RC1 (critical=0) + critical report smoke |
| **Test requirements** | Cross-wave smoke; Phase 16 evaluation; evidence schema |
| **Release milestones** | MS-W08-RC1, MS-W08-EXIT |
| **Build sequence** | Before: WAVE-07 · After: WAVE-09 · **Critical path: yes** |
| **Status** | Mostly Complete (`docs/wave8-release-certification.md`) |

### WAVE-09 — Pilot Deployment, UAT & Operational Readiness

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-09` |
| **Name** | Pilot Deployment, UAT & Operational Readiness (historical EIR: Enterprise Features) |
| **Objectives** | Pilot plan, UAT pack, ops readiness, training, Go/No-Go over RC1 — not live branch cutover |
| **Deliverables** | `wave9-pilot-uat-ops`; `validate:pilot` evidence; UAT/training docs; Audit/Reports panels |
| **Scope** | MIB waves 14–17 (mapped) · Phases 14–16/18/20 · Pilot isolation + human sign-off gates |
| **Dependencies** | **Requires WAVE-01…WAVE-08 exit / RC1 PASS** (blocking: WAVE-08) |
| **Risks** | EIR-R-015 RPO/RTO; EIR-R-016 AI creep; EIR-R-017 alert fatigue; EIR-R-017B Conditional≠Executive Approved |
| **Required skills** | Ops, QA, Security, DevOps, Training, Product |
| **Estimated duration** | 2–3 weeks · ~10 person-weeks |
| **Entry criteria** | WAVE-08 RC1 PASS |
| **Exit criteria** | Framework evidence Go or Conditional; UAT domains covered; human gates documented for Wave 10 |
| **Acceptance criteria** | QA Lead accepts pack for executive review; **no live certification / fake Executive approval** |
| **Quality gates** | QG-001/002 + RC1 entry + UAT pack + ops readiness + human sign-off gate |
| **Test requirements** | Domain coverage; RC1 gate; Go/No-Go rules; validate:pilot schema |
| **Release milestones** | MS-W09-PILOT, MS-W09-UAT, MS-W09-EXIT |
| **Build sequence** | Before: WAVE-08 · After: WAVE-10 · **Critical path: yes** |
| **Status** | Mostly Complete (framework); live pilot execution remains human |
| **Docs** | `docs/wave9-pilot-uat.md` |

### WAVE-10 — Production Deployment, Go-Live, Hypercare & Continuous Improvement

| Field | Content |
|-------|---------|
| **Identifier** | `WAVE-10` |
| **Name** | Production Deployment, Go-Live, Hypercare & Continuous Improvement |
| **Historical EIR alias** | Production Readiness (`PRODUCTION_READINESS`) |
| **Objectives** | Prod deploy/cutover/rollback; hypercare; PIR/CI/KT; closure — without claiming live cutover until AA approvals |
| **Deliverables** | `wave10-production-golive-ops`; `validate:golive` evidence; cutover/hypercare/closure panels; `docs/wave10-production-golive.md` |
| **Scope** | MIB waves 18–20 · Modules 21,30 · Phases 14,15,16,19,20 · CERT-001 preview vs certified |
| **Dependencies** | **Requires WAVE-01…WAVE-09** + RC1 PASS + Wave 9 Conditional/Go (blocking: WAVE-09) |
| **Risks** | EIR-R-018 go-live before RDY; EIR-R-019 UAT under-scope; EIR-R-020 hotfix without CERT-002; EIR-R-021 framework≠live cutover |
| **Required skills** | QA, DevOps, Security, PO, Governance, Domain, Ops |
| **Estimated duration** | 4–6 weeks · ~24 person-weeks |
| **Entry criteria** | RC1 PASS; Wave 9 Conditional/Go; Phase catalogs; no open Critical without Phase 19 exception |
| **Exit criteria** | `validate:golive` FrameworkReady (hard blockers=0); framework accepted for operator execution; CERT-001 remains preview until humans; EIR validate critical=0 |
| **Acceptance criteria** | Framework accepted for executive review; money invariants; no fabricated Executive Sign-Off |
| **Quality gates** | QG-001..004, CERT-001/002 preview path, Phase 19 authorize, Phase 20 RDY fail-closed, human sign-off for Accepted |
| **Test requirements** | Prod env ≠ pilot/dev; evaluateProductionGoLive; evidence schema; rollback concreteness |
| **Release milestones** | MS-W10-FRAMEWORK, MS-W10-CUTOVER, MS-W10-HYPERCARE, MS-W10-CLOSURE |
| **Build sequence** | Before: WAVE-09 · After: human cutover / steady-state · **Critical path: yes** |
| **Status** | Mostly Complete (framework); live production cutover remains human |
| **Docs** | `docs/wave10-production-golive.md` |

**Closure note:** Implementation waves **1–10 framework is complete**. Remaining work is **human execution** of pilot sign-offs + real production cutover under Wave 10 runbooks. The outdated “execute Wave 1” epilogue does not apply — waves are already implemented as packs. Framework complete ≠ production live.

---

## 4. Dependency Matrix

| Wave | Requires prior exits | Blocks |
|------|----------------------|--------|
| WAVE-01 | — | WAVE-02…10 |
| WAVE-02 | WAVE-01 | WAVE-03…10 |
| WAVE-03 | WAVE-01, WAVE-02 | WAVE-04…10 |
| WAVE-04 | WAVE-01…03 | WAVE-05…10 |
| WAVE-05 | WAVE-01…04 | WAVE-06…10 |
| WAVE-06 | WAVE-01…05 | WAVE-07…10 |
| WAVE-07 | WAVE-01…06 | WAVE-08…10 |
| WAVE-08 | WAVE-01…07 | WAVE-09…10 |
| WAVE-09 | WAVE-01…08 | WAVE-10 |
| WAVE-10 | WAVE-01…09 | Program closeout / hypercare |

Rule: **no wave starts until prior wave exit criteria are met.** Dependencies form a sequential DAG (validated by `validateEnterpriseRoadmap`).

---

## 5. Critical Path Analysis

All ten waves sit on the **critical path** (sequential exits). Parallelism is limited to **within-wave** workstreams (e.g., docs vs. tests) after the prior exit.

```
WAVE-01 → WAVE-02 → WAVE-03 → WAVE-04 → WAVE-05
       → WAVE-06 → WAVE-07 → WAVE-08 → WAVE-09 → WAVE-10
```

**Longest calendar path:** ~16–27 weeks (sum of min/max durations).  
**Highest risk segments:** WAVE-04 (sync money), WAVE-05 (collections invariants), WAVE-09 (pilot/UAT human gates), WAVE-10 (RDY/go-live).  
**Helpers:** `criticalPathWaves()`, `estimateTotalDurationWeeks()` in the registry.

---

## 6. Resource Plan

Peak concurrent roles (from wave `resourceProfile` maxima):

| Role | Peak headcount (indicative) | Primary waves |
|------|----------------------------:|---------------|
| Developers | 3 | WAVE-05, 09, 10 |
| QA | 3 | WAVE-10 |
| DBA | 1 | WAVE-02, 07, 09, 10 |
| DevOps | 2 | WAVE-09, 10 |
| UI/UX | 1 | WAVE-04–06, 08, 10 |
| Security | 2 | WAVE-01, 09, 10 |
| Product Owner | 1 | All waves |

Sizing assumes **hardening teams**, not a full greenfield build. Use `aggregateResourcePlan()` for machine-readable peaks.

---

## 7. Risk Register

| ID | Wave | Level | Title | Mitigation |
|----|------|-------|-------|------------|
| EIR-R-001 | WAVE-01 | High | RBAC drift | Cross-module RBAC contract tests |
| EIR-R-002 | WAVE-01 | Medium | Config EXE/APK mismatch | Unified config via prepare:web |
| EIR-R-003 | WAVE-02 | Critical | Migration break on money tables | Pesewas + rollback drill |
| EIR-R-004 | WAVE-02 | Medium | Index drift | Phase 17 spot-check |
| EIR-R-005 | WAVE-03 | High | Facade/catalog drift | ECACIS consistency |
| EIR-R-006 | WAVE-04 | Critical | Double-post on sync replay | Idempotent keys + money pack |
| EIR-R-007 | WAVE-04 | High | Conflict policy ambiguity | Module 15 + sync-event schema |
| EIR-R-008 | WAVE-05 | Critical | Collection day/interest drift | Enforce 31 / 15 |
| EIR-R-009 | WAVE-05 | High | Cashier float breach | Enforce 1000 |
| EIR-R-010 | WAVE-06 | Critical | Disbursement without approval | State-machine + RBAC |
| EIR-R-011 | WAVE-06 | High | AI as decision authority | Advisory-only |
| EIR-R-012 | WAVE-07 | Critical | Unbalanced journals | Double-entry + TB gate |
| EIR-R-013 | WAVE-07 | High | Non-pesewas rounding | Integer-only amounts |
| EIR-R-014 | WAVE-08 | Medium | KPI drift | BI registry SoT |
| EIR-R-015 | WAVE-09 | High | RPO/RTO unmet | Phase 15 + Module 21 drills |
| EIR-R-016 | WAVE-09 | High | AI posting creep | Advisory + Module 24 rules |
| EIR-R-017 | WAVE-09 | Medium | Alert fatigue | Phase 13 SLO catalogs |
| EIR-R-018 | WAVE-10 | Critical | Go-live before RDY | Fail-closed readiness |
| EIR-R-019 | WAVE-10 | High | UAT under-scope | Role-based UAT + PO sign-off |
| EIR-R-020 | WAVE-10 | High | Hotfix without CERT-002 | Phase 16 hotfix path |

Full list: `listRoadmapRisks()`.

---

## 8. Quality Gate Matrix

| Wave | Status | Representative gates | Entry→Exit rule |
|------|--------|----------------------|-----------------|
| WAVE-01 | Mostly Complete | QG-001/002, security smoke | Start after Phase 20/MIB ready |
| WAVE-02 | Mostly Complete | + migration/rollback | After WAVE-01 exit |
| WAVE-03 | Mostly Complete | + API catalog | After WAVE-02 exit |
| WAVE-04 | Mostly Complete | + offline recovery | After WAVE-03 exit |
| WAVE-05 | Mostly Complete | + money invariants | After WAVE-04 exit |
| WAVE-06 | Mostly Complete | + Electron IPC/sync parity; loan SM deferred | After WAVE-05 exit |
| WAVE-07 | Mostly Complete | + TB / double-entry | After WAVE-06 exit |
| WAVE-08 | Mostly Complete | + critical report smoke | After WAVE-07 exit |
| WAVE-09 | Mostly Complete | + pilot/UAT pack (Conditional Go) | After WAVE-08 RC1 PASS |
| WAVE-10 | Mostly Complete | QG-001..004, CERT-* preview, RDY-*, human AA | After WAVE-09 Conditional/Go + RC1 PASS |

References: Phase **16** ETQAVS quality gates; Phase **14** deployment promote; Phase **19** change/release authorization. Machine view: `qualityGateMatrix()`.

---

## 9. Release Roadmap

| Milestone | Wave | Intent |
|-----------|------|--------|
| MS-W01-EXIT … MS-W08-EXIT | 01–08 | Hardening exits / internal promotes |
| MS-W09-PILOT / MS-W09-UAT / MS-W09-EXIT | 09 | Pilot/UAT/ops readiness (framework) |
| MS-W10-RC | 10 | Release candidate packaging |
| MS-W10-UAT | 10 | Business UAT sign-off |
| MS-W10-PROD | 10 | Production promote (Phase 14/19) |
| MS-W10-HYPERCARE | 10 | Stabilization / hypercare |

Release records consume Phase **19** EGCCRMS; certification consumes Phase **16** CERT-001/002. Specification baseline publication (Phase 20) remains distinct from live go-live certification.

---

## 10. Implementation Timeline

Calendar-relative ranges assume sequential exits and existing codebase maturity:

| Weeks (relative) | Waves | Nature of work |
|------------------|-------|----------------|
| W1–W2 | WAVE-01 | Foundation hardening |
| W2–W4 | WAVE-02 → WAVE-03 | DB + core services |
| W4–W6 | WAVE-04 | Offline / sync drills |
| W6–W9 | WAVE-05 | Core business hardening |
| W9–W11 | WAVE-06 → WAVE-07 | Loans + accounting |
| W11–W13 | WAVE-08 | Reporting / dashboards |
| W13–W17 | WAVE-09 | Pilot / UAT / ops readiness (hist. Enterprise Features) |
| W17–W23 | WAVE-10 | Prod deploy / go-live / hypercare / closure (framework) |

**Total:** approximately **16–27 weeks**. Adjust for staffing; do not treat as greenfield-from-zero unless MIB status flips to Not Started for core engines.

---

## 11. Final Readiness Checklist

- [ ] `validateMasterBacklog()` critical = 0  
- [ ] `validateEnterpriseRoadmap()` critical = 0  
- [ ] Every MIB item mapped to exactly one EIR wave  
- [ ] WAVE-01…WAVE-09 exits evidenced before WAVE-10 entry  
- [ ] WAVE-10 framework pack present (`docs/wave10-production-golive.md`, `validate:golive`)  
- [ ] Money invariants verified (pesewas, 15, 31, 1000)  
- [ ] Phase 16 QG-001..004 for production path  
- [ ] Phase 19 change/release authorization  
- [ ] Phase 20 RDY-* mandatory checks (or approved exceptions)  
- [ ] Wave 9 human sign-offs flipped PendingHumanSignOff → Approved  
- [ ] Live production cutover CO-* + PV-* executed under Wave 10 runbooks (human)  
- [ ] UAT sign-off + hypercare roster  
- [ ] `npm run prepare:web` clean; `npm test` green  
- [ ] No Next.js/Flutter rewrite; no new HTTP servers; no new top-level nav  
- [ ] Modules 1–30 engines not replaced; Phases 1–20 not redefined  
- [ ] **Note:** Implementation waves 1–10 **framework** is complete; remaining work is human pilot sign-offs + real production cutover (not “execute Wave 1” from scratch)  

---

## How to use the registry

```js
import {
  listWaves,
  getWave,
  listBacklogForWave,
  validateEnterpriseRoadmap,
  waveBacklogCounts,
  criticalPathWaves
} from "../src/core/enterprise-roadmap-registry.js";

validateEnterpriseRoadmap(); // critical must be 0
listBacklogForWave("WAVE-05");
```

Consistency tests: `tests/enterprise-roadmap-consistency.test.js`.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Enterprise Implementation Roadmap (10 waves) |
