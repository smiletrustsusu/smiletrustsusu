# EIBPRFBS Catalogs (Phase 20 Companion Matrices)

**Parent:** [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md)  
**Registry:** `src/core/canonical-baseline-registry.js`  
**Validation:** `src/core/phase20-baseline-validation.js`  
**Final report:** [`phase20-final-validation-report.md`](./phase20-final-validation-report.md)  
**Upstream:** Phases 1–19 **consumed** · Modules 1–30 **not replaced** · Phase 19 EGCCRMS for ongoing change  
**Version:** 1.0.0  
**Date:** 2026-09-15  

**Counts (seed):** modules=30, phases=19, baselineArtifacts=49, readinessChecks=20, mandatoryReadiness=18, certifications=10, acceptanceTypes=6, finalGovernance=8, implementationStages=16  

**Money invariants:** pesewas · interest 15 · collection days 31 · cashier 1000  
**Phase 16 consume:** QG-001…004 · `emergency_exception_approved`  
**Publication:** specification baseline — **not** live production go-live certification  

---

## 1. Module baseline artifacts (BL-MOD-001…030)

| ID | Module | Title | Authority | Primary doc |
|----|-------:|-------|-----------|-------------|
| BL-MOD-001 | 1 | Authentication & Session | Security Governance Lead | enterprise-master-architecture.md |
| BL-MOD-002 | 2 | Dashboard | Platform Administrator | enterprise-master-architecture.md |
| BL-MOD-003 | 3 | Customer CRM | Platform Administrator | enterprise-master-architecture.md |
| BL-MOD-004 | 4 | Agent & Collector Management | Platform Administrator | agent-management.md |
| BL-MOD-005 | 5 | Branch Management | Platform Administrator | branch-management.md |
| BL-MOD-006 | 6 | Individual Savings Collection | CIO | individual-savings-collection.md |
| BL-MOD-007 | 7 | Group Susu Management | CIO | group-susu-management.md |
| BL-MOD-008 | 8 | Loans | CIO | loan-status-transitions.md |
| BL-MOD-009 | 9 | Withdrawals & Savings Redemption | CIO | withdrawals-savings-redemption.md |
| BL-MOD-010 | 10 | Accounting & General Ledger | CIO | accounting-general-ledger.md |
| BL-MOD-011 | 11 | Reports, Analytics & BI (operational) | Policy Owner | reports-analytics-bi.md |
| BL-MOD-012 | 12 | Notification & Communication | Platform Administrator | notification-communication.md |
| BL-MOD-013 | 13 | Audit Trail & Compliance | Compliance Officer | audit-compliance.md |
| BL-MOD-014 | 14 | System Administration & Configuration | Platform Administrator | system-administration.md |
| BL-MOD-015 | 15 | Offline Synchronization | Platform Administrator | offline-sync.md |
| BL-MOD-016 | 16 | Mobile Money & Payment Gateway | CIO | payment-engine.md |
| BL-MOD-017 | 17 | Receipt, Document & Statement | Platform Administrator | document-engine.md |
| BL-MOD-018 | 18 | Background Jobs, Queue & Scheduler | Platform Administrator | job-engine.md |
| BL-MOD-019 | 19 | Monitoring, Observability, Health | Platform Administrator | monitoring-engine.md |
| BL-MOD-020 | 20 | API Gateway & External Integration | CIO | api-gateway.md |
| BL-MOD-021 | 21 | Backup, Restore, DR & BC | CIO | backup-recovery.md |
| BL-MOD-022 | 22 | Security Operations / Fraud / Risk | Security Governance Lead | security-operations.md |
| BL-MOD-023 | 23 | Workflow Engine & Case Management | Change Manager | workflow-engine.md |
| BL-MOD-024 | 24 | Rule Engine & Decision Management | Compliance Officer | rule-engine.md |
| BL-MOD-025 | 25 | Data Exchange / Import / Export | Platform Administrator | data-exchange.md |
| BL-MOD-026 | 26 | Document & Digital Records | Compliance Officer | digital-records.md |
| BL-MOD-027 | 27 | Enterprise BI, KPI & Schema Registries | Policy Owner | enterprise-bi.md |
| BL-MOD-028 | 28 | Enterprise Integration Hub | CIO | enterprise-integration.md |
| BL-MOD-029 | 29 | Enterprise AI / ML / Predictive | Compliance Officer | enterprise-ai.md |
| BL-MOD-030 | 30 | Enterprise Platform Administration | Platform Administrator | platform-administration.md |

All: `enginesNotReplaced=true`, `status=published`, `version=1.0.0`. Money-path modules 6–10,16 set `moneyInvariantGuard=true`.

---

## 2. Phase baseline artifacts (BL-PH-001…019)

| ID | Phase | Acronym | Primary doc | Registry |
|----|------:|---------|-------------|----------|
| BL-PH-001 | 1 | EMAS | enterprise-master-architecture.md | — |
| BL-PH-002 | 2 | ECR | enterprise-consistency-review.md | — |
| BL-PH-003 | 3 | ECDM | enterprise-canonical-domain-model.md | canonical-domain-registry.js |
| BL-PH-004 | 4 | ECSMLS | enterprise-canonical-state-machines.md | canonical-state-machine-registry.js |
| BL-PH-005 | 5 | ECECMS | enterprise-canonical-event-catalog.md | canonical-event-registry.js |
| BL-PH-006 | 6 | ECACIS | enterprise-canonical-api-catalog.md | canonical-api-registry.js |
| BL-PH-007 | 7 | ECDAPS | enterprise-canonical-database-architecture.md | canonical-database-registry.js |
| BL-PH-008 | 8 | ECPFMS | system-administration.md | canonical-config-registry.js |
| BL-PH-009 | 9 | ESCTRL | security-operations.md | — |
| BL-PH-010 | 10 | ESCHEMA | schemas/manifest.json | — |
| BL-PH-011 | 11 | EARW | enterprise-architecture-review-workflow.md | — |
| BL-PH-012 | 12 | EAIADIS | enterprise-ai-automation-decision.md | canonical-ai-registry.js |
| BL-PH-013 | 13 | EMOIS | enterprise-monitoring-observability.md | canonical-monitoring-registry.js |
| BL-PH-014 | 14 | EDDIES | enterprise-deployment-devops.md | canonical-deployment-registry.js |
| BL-PH-015 | 15 | EBCBDRS | enterprise-business-continuity-dr.md | canonical-continuity-registry.js |
| BL-PH-016 | 16 | ETQAVS | enterprise-testing-qa-validation.md | canonical-testing-registry.js |
| BL-PH-017 | 17 | EPSCMS | enterprise-performance-capacity.md | canonical-performance-registry.js |
| BL-PH-018 | 18 | EOSSMS | enterprise-operations-support.md | canonical-operations-registry.js |
| BL-PH-019 | 19 | EGCCRMS | enterprise-governance-change-release.md | canonical-governance-registry.js |

All: `contentNotRedefined=true`, downstream → Phase 20 baseline doc.

---

## 3. Production readiness checks

| ID | Code | Category | Mandatory | Owner |
|----|------|----------|:---------:|-------|
| RDY-001 | FUNC_CORE | functional | yes | Release Manager |
| RDY-002 | FUNC_INTEGRATION | functional | yes | Platform Administrator |
| RDY-003 | SEC_CONTROLS | security | yes | Security Governance Lead |
| RDY-004 | SEC_FRAUD | security | yes | Security Governance Lead |
| RDY-005 | PERF_SLO | performance | yes | CIO |
| RDY-006 | BCDR_RPO_RTO | bcdr | yes | CIO |
| RDY-007 | BCDR_DRILL | bcdr | yes | Release Manager |
| RDY-008 | MON_SLO | monitoring | yes | Platform Administrator |
| RDY-009 | OPS_RUNBOOKS | ops | yes | Change Manager |
| RDY-010 | OPS_ONCALL | ops | yes | Change Manager |
| RDY-011 | SUP_SERVICE_DESK | support | yes | Change Manager |
| RDY-012 | TRAIN_ROLES | training | yes | Platform Administrator |
| RDY-013 | DOCS_BASELINE | docs | yes | Policy Owner |
| RDY-014 | REG_COMPLIANCE | regulatory | yes | Compliance Officer |
| RDY-015 | EXEC_GO_NOGO | executive | yes | Governance Board Chair |
| RDY-016 | FUNC_MONEY_INV | functional | yes | CIO |
| RDY-017 | SEC_EXCEPTION | security | yes | Compliance Officer |
| RDY-018 | PERF_STRESS | performance | no | CIO |
| RDY-019 | MON_DASHBOARDS | monitoring | no | Platform Administrator |
| RDY-020 | TRAIN_HYPERCARE | training | yes | Release Manager |

Fail closed without `pass` or valid `emergency_exception_approved` exception (Phase 16/19).

---

## 4. Enterprise certifications

| ID | Type | Expiry days | Approval roles (seed) |
|----|------|------------:|------------------------|
| CERT-BL-001 | application | 180 | CIO, Release Manager, Platform Administrator |
| CERT-BL-002 | infrastructure | 365 | CIO, Platform Administrator |
| CERT-BL-003 | security | 180 | Security Governance Lead, CIO, Internal Auditor |
| CERT-BL-004 | data | 365 | Policy Owner, Platform Administrator |
| CERT-BL-005 | performance | 180 | CIO, Release Manager |
| CERT-BL-006 | backup | 90 | CIO, Platform Administrator |
| CERT-BL-007 | dr | 180 | CIO, Release Manager, Governance Board Chair |
| CERT-BL-008 | ops | 180 | Change Manager, Platform Administrator |
| CERT-BL-009 | governance | 365 | Governance Board Chair, CAB Chair, Release Manager |
| CERT-BL-010 | compliance | 365 | Compliance Officer, Governance Board Chair |

Each has non-empty `entryCriteria` + `renewalRequired=true`.

---

## 5. Acceptance types

| ID | Type | Owner | Required readiness |
|----|------|-------|--------------------|
| ACC-001 | technical | Release Manager | RDY-001,002,016 |
| ACC-002 | business | CIO | RDY-001,015 |
| ACC-003 | operational | Change Manager | RDY-009,010,011 |
| ACC-004 | security | Security Governance Lead | RDY-003,004,017 |
| ACC-005 | executive | Governance Board Chair | RDY-015,013 |
| ACC-006 | regulatory | Compliance Officer | RDY-014,017 |

---

## 6. Final governance entries

| ID | Code | Cadence | Owner |
|----|------|---------|-------|
| GOV-BL-001 | BASELINE_MAINT | quarterly | Policy Owner |
| GOV-BL-002 | BASELINE_EVOLVE | per_change | Change Manager |
| GOV-BL-003 | COMPAT_MATRIX | per_release | Configuration Manager |
| GOV-BL-004 | DEPRECATION | as_needed | Release Manager |
| GOV-BL-005 | EOL | as_needed | Governance Board Chair |
| GOV-BL-006 | PERIODIC_REVIEW | annual | Governance Board Chair |
| GOV-BL-007 | EXCEPTION_CONTROL | monthly | Compliance Officer |
| GOV-BL-008 | SCHEMA_MANIFEST | per_release | Policy Owner |

All `consumesPhase19=true`.

---

## 7. Implementation stages (STG-001…016)

environment_prep → infra → db → config → security → android → web → migration → integrations → monitoring → ops_readiness → onboarding → training → go_live → hypercare → steady_state  

Each stage: prerequisites, validationPoints, rollback, successCriteria (see registry `IMPLEMENTATION_STAGE_CATALOG`).

---

## 8. Traceability dimensions

requirements · modules · phases · apis · db · security · tests · quality_gates · kpis · risks · controls · policies · schemas · deployment · runbooks  

---

## 9. Helper API (`phase20-baseline-validation.js`)

| Function | Purpose |
|----------|---------|
| `validateEnterpriseBaseline` | Full consistency → `{ ok, critical[], warnings[], summary }` |
| `evaluateProductionReadiness` | Mandatory gate evaluation (fail closed) |
| `evaluateReadinessFailClosed` | Wrapper for gate-missing failure |
| `evaluateCertificationValidity` | Expiry / renewal rules |
| `loadPriorRegistries` | Import continuity / testing / ops / governance / … |
| `checkPhaseDocReferences` | Expected phase doc presence |
| `checkModuleDocReferences` | Expected module doc presence |

---

## 10. Cross-reference notes

- Phase 19 remains SoT for change/release/CMDB/policy after baseline publish.  
- Phase 16 remains SoT for QG/CERT-001/002.  
- Module 30 referenced for platform ops metadata — **not replaced**.  
- Phase 20 schemas under `docs/schemas/baseline/` with `$id` `https://schemas.smiletrust.com/baseline/...`.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 20 EIBPRFBS catalogs |
