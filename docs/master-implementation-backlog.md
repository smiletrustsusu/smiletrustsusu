# Master Implementation Backlog (MIB)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Execution backlog — single source of truth for implementation work  
**Status:** Authoritative for **delivery planning & tracking** (not a rewrite of domain specs)  
**Version:** 1.1.0  
**Date:** 2026-09-17  
**Machine registry:** `src/core/master-backlog-registry.js`  
**Waves:** `src/core/master-backlog-waves.js` · user delivery waves: `src/core/master-backlog-delivery-waves.js`  
**Companion catalogs:** [`mib-catalogs.md`](./mib-catalogs.md) · **Reconciled backlog:** [`backlog/`](./backlog/)  
**Schema:** [`schemas/backlog/backlog-item.schema.json`](./schemas/backlog/backlog-item.schema.json)  
**Upstream baseline:** [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) (Phase 20 EIBPRFBS)  
**Audit (2026-09-17):** [`audit/enterprise-project-audit.md`](./audit/enterprise-project-audit.md) · [`backlog/gap-register-reconciled.md`](./backlog/gap-register-reconciled.md)  
**Execution roadmap (10 delivery waves):** [`enterprise-implementation-roadmap.md`](./enterprise-implementation-roadmap.md) · [`eir-catalogs.md`](./eir-catalogs.md) · `src/core/enterprise-roadmap-registry.js`  
**Development standards (EDSM):** [`enterprise-development-standards.md`](./enterprise-development-standards.md) · [`edsm-catalogs.md`](./edsm-catalogs.md) · `src/core/canonical-standards-registry.js`

---

## 1. Purpose

The Master Implementation Backlog is the **execution SoT** for all implementation work across:

- Program `PRG-0001`
- Enterprise phases `PH-001` … `PH-020` (trace only — specs not redefined)
- Functional modules `MOD-001` … `MOD-030` (engines referenced, not replaced)
- Implementation-order waves 1–20 (Foundation → Production Readiness)
- Epics, features, user stories, technical tasks, and seeded TEST/BUG/RISK/CR/REL items

Phase 20 remains the **published specification baseline**. MIB does **not** redefine Phases 1–20 prose/registries or Modules 1–30 runtime engines.

**Money invariants (normative):** amounts in **integer pesewas**; default interest **15%**; collection cycle **31 days**; cashier float limit **1000**.

**Stack constraints:** no Next.js/Flutter rewrite; no new real HTTP servers; no new top-level nav. Web sync via `npm run prepare:web` → `www/`.

---

## 2. Hierarchy

```
PRG-0001 (Program)
├── PH-001 … PH-020          Phase anchors (spec trace)
├── MOD-001 … MOD-030        Module anchors (engine trace)
├── EPC-* (Wave 1–20)        Cross-cutting implementation streams
│   └── FEAT-*
│       └── USR-* | TASK-*
│           └── SUB-* (optional)
└── EPC-* (per module)       Module core + hardening epics
    └── FEAT-*
        └── USR-* | TASK-*
```

Additional typed items (`TEST`, `BUG`, `RISK`, `CR`, `REL`) attach under the nearest relevant parent (wave, module, or program child).

---

## 3. ID scheme (strict)

| Type | Pattern | Example |
|------|---------|---------|
| Program | `PRG-####` | `PRG-0001` |
| Phase | `PH-###` | `PH-020` |
| Module | `MOD-###` | `MOD-006` |
| Epic | `EPC-######` | `EPC-000001` |
| Feature | `FEAT-######` | `FEAT-000001` |
| User story | `USR-######` | `USR-000001` |
| Technical task | `TASK-######` | `TASK-000001` |
| Subtask | `SUB-######` | `SUB-000001` |
| Test | `TEST-######` | `TEST-000001` |
| Bug | `BUG-######` | `BUG-000001` |
| Risk | `RISK-######` | `RISK-000001` |
| Change request | `CR-######` | `CR-000001` |
| Release | `REL-######` | `REL-000001` |

---

## 4. Status / priority / complexity / points

**Canonical status (preferred):** Completed | Ready | Planned | In Progress | Blocked | Deferred | Cancelled  

**Legacy aliases (accepted; normalized at write-time):** Not Started → Planned; Released / Code Complete / Ready for Release / Code Review / QA Testing → Completed; UAT → In Progress  

**Priority:** Critical | High | Medium | Low  

**Risk level:** Critical | High | Medium | Low  

**Complexity:** XS | S | M | L | XL  

**Story points (Fibonacci):** 1, 2, 3, 5, 8, 13, 21, 34, 55

### Status realism

Many modules already exist in the codebase. Module anchors and core epics/features are often **Completed**. Gap / hardening / production-readiness items stay **Planned**, **Ready**, **In Progress**, or **Blocked** (human gates). Phase anchors are **Completed** (spec published). Phase 20 publication does **not** mean live production is certified.

### User delivery waves (1–10)

| # | Name | EIR |
|---|------|-----|
| 1 | Foundation | WAVE-01 |
| 2 | Database | WAVE-02 |
| 3 | Backend | WAVE-03 |
| 4 | Android | WAVE-04 |
| 5 | Web | WAVE-05 |
| 6 | Windows | WAVE-06 |
| 7 | AI & Analytics | WAVE-07 |
| 8 | Testing | WAVE-08 |
| 9 | Pilot | WAVE-09 |
| 10 | Production | WAVE-10 |

Items carry `deliveryWave` (1–10) in addition to optional MIB `wave` (1–20).

---

## 5. Implementation order (20 waves)

| # | Wave | Focus |
|---|------|--------|
| 1 | Foundation | Platform foundations, EMAS alignment |
| 2 | Auth & RBAC | Module 1 session/RBAC |
| 3 | Tenant & Branch | Branch/tenant isolation |
| 4 | Database | ECDAPS / schema alignment |
| 5 | Core APIs | Canonical API / gateway facades |
| 6 | Sync Engine | Offline sync (Module 15) |
| 7 | Customer | CRM (Module 3) |
| 8 | Savings | Individual + group susu (6–7) |
| 9 | Daily Collections | Collector flows / 31-day cycle |
| 10 | Loans | Loan lifecycle (Module 8) |
| 11 | Accounting | GL posting (Module 10) |
| 12 | Reports | Operational + BI reports |
| 13 | Dashboards | Module 2 |
| 14 | Notifications | Module 12 |
| 15 | Monitoring | Module 19 / Phase 13 |
| 16 | Security | Modules 1/22 / Phase 9 |
| 17 | AI | Module 29 advisory only |
| 18 | Testing | Phase 16 gates |
| 19 | Deployment | Phase 14/15 |
| 20 | Production Readiness | RDY checks / exec package |

Wave N epics list Wave N−1 as a prerequisite where applicable.

---

## 6. Required fields

Every item carries the full schema (arrays may be `[]`; nullable fields use `null`):

`identifier`, `parentIdentifier`, `module`, `enterprisePhase`, `title`, `description`, `businessObjective`, `businessValue`, `priority`, `riskLevel`, `complexity`, `storyPoints`, `estimatedHours`, `owner`, `team`, `status`, `dependencies` (`prerequisites`, `dependentTasks`, `blockingTasks`, `relatedTasks`, `crossModule`, `crossPhase`), `blockers`, `acceptanceCriteria`, `validationRequirements`, `testCases`, `uiScreens`, `apis`, `databaseTables`, `databaseViews`, `databaseFunctions`, `storedProcedures`, `reports`, `dashboards`, `securityControls`, `auditRequirements`, `offlineSupport`, `synchronizationRequirements`, `performanceRequirements`, `monitoringRequirements`, `documentationReferences`, `relatedEnterprisePhaseReferences`, `relatedModuleReferences`, `version`, `createdDate`, `modifiedDate`

Machine validation: `validateMasterBacklog()` — unique IDs, parent integrity, enum validity, dependency resolution, MOD/PH coverage, exactly one owner per item.

---

## 7. How to use the registry

```js
import {
  PROGRAM,
  listBacklogItems,
  getBacklogItem,
  listByModule,
  listByPhase,
  listByStatus,
  listByWave,
  validateMasterBacklog,
  backlogCountsByType
} from "../src/core/master-backlog-registry.js";

validateMasterBacklog(); // critical must be 0
listByWave(8);           // Savings wave items
listByModule("MOD-006");
```

Consistency tests: `tests/master-backlog-consistency.test.js`.

---

## 8. Ownership model

| Layer | Typical owner |
|-------|----------------|
| Program / Wave 20 | Governance Board Chair |
| Security waves / Mod 1,22 | Security Governance Lead |
| Money modules 6–10,16 | CIO |
| Platform / config / sync | Platform Administrator |
| Compliance / AI / audit | Compliance Officer |
| Releases / QA gates | Release Manager |
| Change / workflow | Change Manager |
| Policy / BI | Policy Owner |

**Rule:** every item has exactly **one** `owner` string (accountable). `team` is the delivery group.

---

## 9. Linkage to Phase 20 baseline

| Concern | SoT |
|---------|-----|
| Published specs (Modules 1–30, Phases 1–19) | Phase 20 EIBPRFBS + prior phase docs |
| Production readiness checks RDY-* | `canonical-baseline-registry.js` |
| **Execution backlog / delivery tracking** | **This MIB + `master-backlog-registry.js`** |
| **Delivery wave sequencing (10 waves)** | **[`enterprise-implementation-roadmap.md`](./enterprise-implementation-roadmap.md) + `enterprise-roadmap-registry.js`** (maps MIB items; does not invent a second backlog) |
| Change/release of baseline itself | Phase 19 EGCCRMS |

Conflicts between backlog intent and published specs → Phase 19 change request; do not silently amend Phase 20 catalogs.

---

## 10. Completeness strategy

A literal dump of every atomic subtask across the enterprise would be unmaintainable. MIB is **hierarchically complete**:

1. Full coverage of program, 20 phases, 30 modules, 20 waves  
2. Epics → features → stories/tasks seeded for execution readiness (not empty stubs)  
3. Compact structured fields over prose novels  
4. Gap items remain open; implemented capability marked Completed  

---

## 11. Audit reconciliation (2026-09-17)

Reconciled against [`audit/enterprise-project-audit.md`](./audit/enterprise-project-audit.md) and 27 gaps in [`audit/gap-register.md`](./audit/gap-register.md).

| Deliverable | Path |
|-------------|------|
| Gap → backlog map | [`backlog/gap-register-reconciled.md`](./backlog/gap-register-reconciled.md) · [`backlog/gap-backlog-map.json`](./backlog/gap-backlog-map.json) |
| Features | [`backlog/reconciled-feature-register.md`](./backlog/reconciled-feature-register.md) |
| Tech debt | [`backlog/technical-debt-register.md`](./backlog/technical-debt-register.md) |
| Security | [`backlog/security-improvement-register.md`](./backlog/security-improvement-register.md) |
| Performance | [`backlog/performance-improvement-register.md`](./backlog/performance-improvement-register.md) |
| Documentation | [`backlog/documentation-improvement-register.md`](./backlog/documentation-improvement-register.md) |
| Testing | [`backlog/testing-improvement-register.md`](./backlog/testing-improvement-register.md) |
| Wave plan | [`backlog/wave-execution-plan.md`](./backlog/wave-execution-plan.md) |
| Critical path | [`backlog/critical-path-report.md`](./backlog/critical-path-report.md) |
| Risks | [`backlog/updated-risk-register.md`](./backlog/updated-risk-register.md) |
| Readiness | [`backlog/release-readiness-dashboard.md`](./backlog/release-readiness-dashboard.md) |

**Rules applied:** no duplicate active work per gap; Waves 1–10 framework packs not reset to Planned; open work emphasizes Critical/High cutover, CERT-001, human gates, Android Gradle, money/RBAC schema, PRODUCTION.md, CI, EXE signing, PV, hypercare.

**Status migration:** see `MIB_STATUS_MIGRATION_NOTE` in `src/core/master-backlog-status.js`.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.1.0 | 2026-09-17 | Audit gap reconciliation; canonical statuses; delivery waves 1–10; docs/backlog/* |
| 1.0.0 | 2026-09-15 | Initial Master Implementation Backlog |
