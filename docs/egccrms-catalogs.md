# EGCCRMS Catalogs (Phase 19 Companion Matrices)

**Parent:** [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md)  
**Registry:** `src/core/canonical-governance-registry.js`  
**Helpers:** `src/core/phase19-change-release.js`  
**Phase 8 (consume):** config/policy semantics — **not redefined**  
**Phase 14 (consume):** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md) — CI/CD & emergency — **not redefined**  
**Phase 16 (consume):** [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md) — QG/CERT — **not redefined**  
**Phase 18 (consume):** [`enterprise-operations-support.md`](./enterprise-operations-support.md) — **not redefined**  
**Module 30:** platform admin — **not replaced**  
**Phase 20:** Final specification baseline — [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) (EIBPRFBS); consumes EGCCRMS — **does not redefine**  
**Version:** 1.0.0  
**Date:** 2026-09-15  

**Scope:** Governance / change / configuration / release **catalog** only. Consumes Phases 1–18 + Modules 1–30. Does **not** redefine entities, APIs, DB, security, monitoring, deployment, BCDR, testing, performance, or ops **standards**. Does **not** replace engines.

**Counts (seed):** roles=12, committees=7, changeTypes=10, changeClasses=3, changeDomains=7, configurationItems=12, ciCategories=12, releaseTypes=5, versionRules=6, policies=8, policyLifecycleStates=6, compliance=5, exceptions=4, workflows=6, crossRefs=30

**Money invariants:** pesewas · interest 15 · collection days 31 · cashier 1000  
**Phase 16 consume:** QG-001…004 · CERT-001 · CERT-002 · `emergency_exception_approved`

---

## 1. Governance Roles

| ID | Title | Accountable Authority |
|----|-------|------------------------|
| ROLE-GOV-BOARD | Governance Board Chair | Governance Board Chair |
| ROLE-CAB-CHAIR | CAB Chair | CAB Chair |
| ROLE-ECAB | Emergency CAB Chair | Emergency CAB Chair |
| ROLE-CHANGE-MGR | Change Manager | Change Manager |
| ROLE-RELEASE-MGR | Release Manager | Release Manager |
| ROLE-CONFIG-MGR | Configuration Manager | Configuration Manager |
| ROLE-POLICY-OWNER | Policy Owner | Policy Owner |
| ROLE-COMPLIANCE | Compliance Officer | Compliance Officer |
| ROLE-CIO | Chief Information Officer | CIO |
| ROLE-PLATFORM-ADMIN | Platform Administrator | Platform Administrator |
| ROLE-SEC-GOV | Security Governance Lead | Security Governance Lead |
| ROLE-AUDIT | Internal Auditor | Internal Auditor |

Exactly **one** `accountableAuthority` per governed artifact.

---

## 2. Committees

| ID | Name | Cadence | Chair |
|----|------|---------|-------|
| COMM-001 | Enterprise Governance Board | monthly | ROLE-GOV-BOARD |
| COMM-002 | Change Advisory Board (CAB) | weekly | ROLE-CAB-CHAIR |
| COMM-003 | Emergency CAB (ECAB) | on_demand | ROLE-ECAB |
| COMM-004 | Release Readiness Board | per_release | ROLE-RELEASE-MGR |
| COMM-005 | Configuration Control Board | biweekly | ROLE-CONFIG-MGR |
| COMM-006 | Policy Review Board | monthly | ROLE-POLICY-OWNER |
| COMM-007 | Compliance & Risk Committee | quarterly | ROLE-COMPLIANCE |

---

## 3. Change Types

| ID | Class | Domain | CAB | ECAB | PIR | Exception |
|----|-------|--------|:---:|:----:|:---:|:---------:|
| CHG-001 | standard | configuration | no | no | no | no |
| CHG-002 | standard | reporting | no | no | no | no |
| CHG-003 | normal | application | yes | no | yes | no |
| CHG-004 | normal | infrastructure | yes | no | yes | no |
| CHG-005 | normal | database | yes | no | yes | no |
| CHG-006 | normal | security | yes | no | yes | no |
| CHG-007 | normal | ai_model | yes | no | yes | no |
| CHG-008 | emergency | application | no | yes | yes | **yes** |
| CHG-009 | emergency | security | no | yes | yes | **yes** |
| CHG-010 | emergency | infrastructure | no | yes | yes | **yes** |

Lifecycle: initiation → assessment → authorization → planning → implementation → validation → closure → pir  

Emergency types align Phase 14 emergency + Phase 16 `emergency_exception_approved`.

---

## 4. Configuration Items (CMDB seed)

| ID | Category | Baseline | Owner |
|----|----------|----------|-------|
| CI-001 | android_apk | BL-APK-2026-09 | Release Manager |
| CI-002 | web_portal | BL-WEB-2026-09 | Release Manager |
| CI-003 | api | BL-API-2026-09 | Configuration Manager |
| CI-004 | database | BL-DB-2026-09 | Configuration Manager |
| CI-005 | infrastructure | BL-INFRA-2026-09 | Platform Administrator |
| CI-006 | certificate | BL-CERT-2026-09 | Security Governance Lead |
| CI-007 | secret_ref | BL-SEC-2026-09 | Security Governance Lead |
| CI-008 | ai_model | BL-AI-2026-09 | Compliance Officer |
| CI-009 | report | BL-RPT-2026-09 | Policy Owner |
| CI-010 | pipeline | BL-PIPE-2026-09 | Release Manager |
| CI-011 | monitoring_config | BL-MON-2026-09 | Configuration Manager |
| CI-012 | configuration | BL-CFG-2026-09 | Platform Administrator |

CI-010 consumes Phase 14 pipelines · CI-011 consumes Phase 13 · CI-012 consumes Phase 8.

---

## 5. Release Types

| ID | Type | Gates | Cert | Exception |
|----|------|-------|------|:---------:|
| REL-001 | major | QG-001…004 | CERT-001 | no |
| REL-002 | minor | QG-001…004 | CERT-001 | no |
| REL-003 | patch | QG-001,002,004 | CERT-001 | no |
| REL-004 | hotfix | QG-001,004 | CERT-002 | **yes** |
| REL-005 | emergency | QG-001,004 | CERT-002 | **yes** |

Lifecycle: planning → packaging → scheduling → approvals → readiness → prod_authorization → deployment → post_release_validation → rollback_decision → closure

---

## 6. Version Rules

| ID | Rule |
|----|------|
| VER-001 | Semver MAJOR.MINOR.PATCH |
| VER-002 | Monotonic build number |
| VER-003 | Release ID REL-YYYYMMDD-N |
| VER-004 | Artifact ID CI-###@semver+build |
| VER-005 | Compatibility matrix |
| VER-006 | Deprecation ≥90 days before EOL |

---

## 7. Policy Catalog & Lifecycle

States: `draft → review → approved → published → superseded → retired`

| ID | Kind | State |
|----|------|-------|
| POL-001 | policy | published |
| POL-002 | standard | published |
| POL-003 | procedure | published |
| POL-004 | runbook | published |
| POL-005 | specification | published |
| POL-006 | json_schema | published |
| POL-007 | registry | published |
| POL-008 | standard (money invariants) | published |

---

## 8. Compliance Domains

| ID | Domain | Cadence |
|----|--------|---------|
| CMP-001 | internal | monthly |
| CMP-002 | regulatory | quarterly |
| CMP-003 | policy | monthly |
| CMP-004 | security | monthly |
| CMP-005 | operational | weekly |

---

## 9. Exception Registry

| ID | State | Align |
|----|-------|-------|
| EXC-001 | approved | Phase 14 + Phase 16 hotfix bypass (valid through 2026-12-31) |
| EXC-002 | approved | Standard window extension |
| EXC-003 | expired | Sample expired fixture |
| EXC-004 | approved | AI model pilot (advisory only) |

---

## 10. Governance Workflows

| ID | Name |
|----|------|
| GWF-001 | Normal change authorization |
| GWF-002 | Emergency change / ECAB |
| GWF-003 | Release readiness & prod authorization |
| GWF-004 | CI baseline & drift disposition |
| GWF-005 | Policy & standard lifecycle |
| GWF-006 | Exception request / expiry |

---

## 11. Cross-reference (Modules 1–30 × Phases)

Every module 1–30 has a governance cross-ref entry. Highlights:

| Module | Related phases (governance lens) | Note |
|-------:|----------------------------------|------|
| 15 | 13, 14, 18 | Sync engine not replaced |
| 19 | 13, 18 | Monitoring engine not replaced |
| 21 | 14, 15 | Backup engine not replaced |
| 29 | 12, 16 | AI advisory; no auto approval |
| **30** | **8, 14, 16, 18, 19** | Platform admin **referenced**, not replaced |

Full list: `CROSS_REF_MATRIX` in registry (length 30).

---

## 12. Helper API (phase19-change-release.js)

| Function | Purpose |
|----------|---------|
| `evaluateChangeClassification` | Resolve Standard/Normal/Emergency type |
| `evaluateApprovalRequirements` | Approvers, CAB/ECAB, exception need |
| `evaluateReleaseReadiness` | Consume Phase 16 gate results |
| `evaluatePolicyLifecycleTransition` | Enforce allowed state moves |
| `evaluateExceptionValidity` | Window + state check |
| `compareCiBaseline` | Drift detect vs baseline |
| `assertEmergencyChangeExceptionAlignment` | Phase 14/16 emergency align |

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 19 EGCCRMS catalogs |
