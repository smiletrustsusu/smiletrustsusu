# Enterprise Governance, Change, Configuration & Release Management Specification (EGCCRMS) — Phase 19

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 19 — Authoritative Governance / Change / Configuration / Release Catalog  
**Status:** Authoritative for Phase 19 enterprise governance framework, change management, configuration management (CMDB), release management, version governance, compliance, policy lifecycle, exceptions, and governance workflows  
**Version:** 1.0.0  
**Date:** 2026-09-15  
**Config / policy semantics (consume):** **Phase 8** (`canonical-config-registry.js`) — **not redefined**  
**Deployment / CI/CD (consume):** **Phase 14** — **not redefined**  
**Quality gates / certification (consume):** **Phase 16** — **not redefined**  
**Operations / support (consume):** **Phase 18** — **not redefined**  
**Platform operational config:** **Module 30** — **referenced**, **not replaced**  
**Machine registry:** `src/core/canonical-governance-registry.js`  
**Change / release helpers:** `src/core/phase19-change-release.js`  
**Companion matrices:** [`egccrms-catalogs.md`](./egccrms-catalogs.md)  
**Schemas:** [`schemas/governance/`](./schemas/governance/)  
**Phase 20:** Final **Implementation Blueprint / Specification Baseline** — [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) (EIBPRFBS). Phase 19 remains SoT for change/release/CMDB; Phase 20 integrates by reference and does **not** redefine EGCCRMS.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EGCCRMS |
| Accountable authority (catalog) | Governance Board Chair / CAB Chair / Change Manager / Release Manager |
| Money posts | **Forbidden** for governance-catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** |
| Nav changes | **None** |
| RBAC rewrite | **None** |
| Phase 8 / 14 / 16 / 18 | **Consumed**, not redefined |
| Module 30 | **Referenced**, not replaced |
| Phase 20 | **Downstream** — specification baseline (EIBPRFBS); does not redefine EGCCRMS |

**Non-regression:** Phases 1–18 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, monitoring, deployment, BCDR, testing, performance, and operational **procedures/standards**. Phase 19 defines **governance of change, configuration, and release** of those artifacts — only.

**Money invariants preserved:** amounts in **integer pesewas**; default interest **15%**; collection cycle **31 days**; cashier float limit **1000**. REST/OpenAPI in this specification means **in-process contract facades** only (no new HTTP servers). Web artifact path remains `prepare:web` → `www/`.

---

## 1. Purpose & scope

### 1.1 Purpose

EGCCRMS is the **single authoritative catalog** for enterprise governance structure, change management, configuration management (CMDB), release management, version governance, compliance management, policy & standard lifecycle, exception control, and governance workflows for Smile Trust.

### 1.2 In scope

- Enterprise governance framework (committees, roles, decision rights, escalation, approval hierarchy, cadence, documentation)  
- Change management: Standard / Normal / Emergency × infrastructure / application / database / configuration / security / AI model / reporting — full lifecycle initiation → PIR  
- Configuration management: CI identification, ownership, relationships, versioning, baselines, status accounting, audits, drift detection  
- Release management: planning → closure for Major / Minor / Patch / Hotfix / Emergency  
- Version governance: semver, build numbers, release/artifact IDs, compatibility, deprecation, EOL  
- Compliance management: internal / regulatory / policy / security / operational — evidence, reporting, exceptions  
- Policy & standard lifecycle: Draft → Review → Approved → Published → Superseded → Retired  
- Governance workflows with entry/exit criteria, decision points, evidence, sign-off, escalation  
- Cross-reference Modules 1–30 × Phases 1–18  

### 1.3 Out of scope

- Redefining Phase 8 config semantics, Phase 14 deployment standards, Phase 16 testing/gates, Phase 18 ops procedures  
- Replacing Modules 1–30 engines (especially Module 30 platform admin)  
- Next.js/Flutter rewrite, real HTTP servers, new top-level nav  
- Owning Phase 20 implementation blueprint content (see EIBPRFBS) — Phase 19 only supplies governance inputs  

### 1.4 Input & Dependency Rules

1. **Phase 8 ECPFMS** owns config/policy/feature-flag **semantics** — EGCCRMS **governs change** of those artifacts (CI-012) without redefining values or precedence.  
2. **Phase 14 EDDIES** owns environments, pipelines, artifact promotion — EGCCRMS **consumes** CI/CD for release packaging/scheduling; does **not** redefine deployment standards. Emergency change aligns with Phase 14 **delegation & emergency** patterns.  
3. **Phase 16 ETQAVS** owns quality gates (`QG-001`…`QG-004`), CERT-001 / CERT-002, and `bypassRequires: emergency_exception_approved` — EGCCRMS **consumes** for release readiness; does **not** redefine testing.  
4. **Phase 18 EOSSMS** owns service desk / incident / runbook catalogs — EGCCRMS may reference ops tickets for emergency triggers; does **not** redefine ops.  
5. **Module 30** owns platform administration engines — EGCCRMS references for **operational config governance** metadata; does **not** replace `platform-ops.js`.  
6. Financial / ledger changes must preserve **pesewas**, interest **15**, collection **31** days, cashier **1000**.  

---

## 2. Enterprise governance framework

### 2.1 Structure

| Layer | Body | Authority |
|-------|------|-----------|
| Strategic | Enterprise Governance Board (COMM-001) | Policy, portfolio, escalated exceptions |
| Tactical change | CAB (COMM-002) / ECAB (COMM-003) | Normal / emergency change authorize |
| Release | Release Readiness Board (COMM-004) | Go / no-go; consumes Phase 16 evidence |
| Configuration | Configuration Control Board (COMM-005) | Baselines, drift |
| Policy | Policy Review Board (COMM-006) | Lifecycle of policies/standards/schemas/registries |
| Risk | Compliance & Risk Committee (COMM-007) | Domains, evidence, exceptions |

### 2.2 Roles & decision rights

Roles are seeded in `GOVERNANCE_ROLES` (see catalogs). Exactly **one** `accountableAuthority` per governed artifact. SoD: Accountable ≠ Internal Auditor for production-affecting decisions.

### 2.3 Approval hierarchy

1. Standard change → Change Manager (+ Platform Admin for config)  
2. Normal change → CAB Chair (+ domain approvers)  
3. Emergency change → ECAB + CIO (+ linked approved exception)  
4. Major/Minor release → Release Manager + CAB + CIO + Platform Admin  
5. Hotfix/Emergency release → ECAB + CIO + Release Manager + Phase 16 CERT-002 / exception  

### 2.4 Escalation

CAB defer / reject with residual risk → CIO → Governance Board. Exception expiry or denied emergency → Audit + Governance Board. Drift unresolved → CAB.

### 2.5 Cadence & documentation

| Body | Cadence |
|------|---------|
| Governance Board | Monthly |
| CAB | Weekly |
| ECAB | On demand |
| Release Readiness | Per release |
| Config Control | Biweekly |
| Policy Review | Monthly |
| Compliance & Risk | Quarterly |

Documentation: change requests, CI baselines, release records, exception records, policy versions — schemas under `docs/schemas/governance/`. Catalog sync via `prepare:web` → `www/`.

---

## 3. Change management

### 3.1 Classes

| Class | Use | Board |
|-------|-----|-------|
| **Standard** | Pre-authorized low-risk (config/reporting within Phase 8 bounds) | No CAB |
| **Normal** | Planned change with assessment | CAB |
| **Emergency** | Sev-critical / security / outage recovery | ECAB; Phase 14 emergency + Phase 16 exception |

### 3.2 Domains

`infrastructure` · `application` · `database` · `configuration` · `security` · `ai_model` · `reporting`

AI model changes remain **advisory-only** (no auto loan approval). Database/reporting/APK changes that touch money paths must declare money-invariant guards.

### 3.3 Lifecycle (all types)

`initiation → assessment → authorization → planning → implementation → validation → closure → pir`

| Stage | Entry | Exit | Evidence |
|-------|-------|------|----------|
| Initiation | Request logged | Classified CHG-* | Impact draft |
| Assessment | Classification | Risk scored; CIs linked | Impact assessment |
| Authorization | Approvers notified | CAB/ECAB decision | Approvals |
| Planning | Authorized | Window + rollback | Plan |
| Implementation | Window open | Change applied | Implement log |
| Validation | Applied | Success criteria met | Test/ops evidence |
| Closure | Validated | Status closed | Closure record |
| PIR | Closure (if required) | PIR accepted | PIR report |

**Emergency:** PIR **always** required; exception ID mandatory; post-facto Audit review within 5 business days.

### 3.4 Seed change types

See `CHG-001`…`CHG-010` in registry / catalogs. Emergency types (`CHG-008`…`010`) set `phase14EmergencyAlign` and `phase16Bypass = emergency_exception_approved`.

---

## 4. Configuration management

### 4.1 CI identification & ownership

Every CI has unique `CI-###`, category, owner role, exactly one accountable authority, version, baseline ID, status, module/phase refs, and relationship list.

### 4.2 Categories (seed coverage)

Android APK · Web Portal · API · Database · Infrastructure · Certificate · Secret ref · AI model · Report · Pipeline · Monitoring config · Configuration (Phase 8 pack)

### 4.3 Versioning & baselines

Baselines (`BL-*`) frozen by Configuration Control Board. Status accounting: `planned → registered → baselined → in_change → retired`.

### 4.4 Relationships

Example: APK (CI-001) ↔ API (CI-003) ↔ DB (CI-004) ↔ Pipeline (CI-010) ↔ Monitoring (CI-011). Secret refs store **handles only**.

### 4.5 Audits & drift

Periodic CI audits; `compareCiBaseline` helper detects baseline/version drift → GWF-004 disposition. Pipeline CI **consumes** Phase 14; monitoring config **consumes** Phase 13; Phase 8 pack **consumes** config semantics.

---

## 5. Release management

### 5.1 Types

| Type | Semver | Gates (Phase 16 consume) | Cert |
|------|--------|--------------------------|------|
| Major | major | QG-001…004 | CERT-001 |
| Minor | minor | QG-001…004 | CERT-001 |
| Patch | patch | QG-001,002,004 | CERT-001 |
| Hotfix | patch | QG-001,004 | CERT-002 + exception |
| Emergency | patch | QG-001,004 | CERT-002 + exception; Phase 14 emergency |

### 5.2 Lifecycle

`planning → packaging → scheduling → approvals → readiness → prod_authorization → deployment → post_release_validation → rollback_decision → closure`

- **Packaging / scheduling / deployment execution** consume Phase 14 pipelines — not redefined.  
- **Readiness** evaluates Phase 16 gate results (`pass` / `fail` / `exception_approved`) via `evaluateReleaseReadiness`.  
- **Rollback governance:** plan mandatory for all types; decision recorded under Release Manager / ECAB for emergency.  
- **Post-release validation:** required window by type (8–72h); major/minor require explicit post-validation plan before ready.

### 5.3 Production authorization

CIO + Release Manager + Platform Admin (Module 30 metadata). Hotfix/Emergency add ECAB and valid exception (EXC-* aligned to Phase 16).

---

## 6. Version governance

| Rule | Purpose |
|------|---------|
| VER-001 Semver | `MAJOR.MINOR.PATCH` |
| VER-002 Build number | Monotonic per stream |
| VER-003 Release ID | `REL-YYYYMMDD-N` |
| VER-004 Artifact ID | `CI-###@semver+build` |
| VER-005 Compatibility | APK↔API↔DB matrix; breaking ⇒ major |
| VER-006 Deprecation/EOL | ≥90 days deprecate before EOL |

---

## 7. Compliance management

| Domain | Cadence | Owner |
|--------|---------|-------|
| Internal | Monthly | Compliance Officer |
| Regulatory | Quarterly | Compliance Officer |
| Policy | Monthly | Policy Owner |
| Security | Monthly | Security Governance Lead |
| Operational | Weekly | Change Manager |

Evidence packs attach to change/release/exception records. Exceptions tracked in `EXCEPTION_REGISTRY` with validity windows; expired exceptions cannot authorize emergency release.

---

## 8. Policy & standard lifecycle

States: **Draft → Review → Approved → Published → Superseded → Retired**

Applies to: policies, standards, procedures, runbooks, specifications, JSON schemas, registries.

Allowed transitions enforced by `evaluatePolicyLifecycleTransition` / `POLICY_TRANSITIONS`. Published artifacts may only move to Superseded or Retired. Seed includes change/release/config policies, emergency exception runbook, EGCCRMS spec, change-request schema, governance registry, money-invariant standard.

---

## 9. Governance workflows

| ID | Workflow | Sign-off |
|----|----------|----------|
| GWF-001 | Normal change authorization | CAB Chair, Change Manager |
| GWF-002 | Emergency / ECAB | ECAB, CIO |
| GWF-003 | Release readiness & prod auth | Release Manager, CIO, Platform Admin |
| GWF-004 | CI baseline & drift | Configuration Manager |
| GWF-005 | Policy lifecycle | Policy Owner, Governance Board |
| GWF-006 | Exception request / expiry | Compliance, ECAB |

Each workflow defines entry/exit criteria, decision points, evidence, sign-off, and escalation roles (see catalogs).

---

## 10. Exception management (Phase 14 / 16 alignment)

- Phase 14 emergency delegation patterns remain authoritative for **who** may act under emergency.  
- Phase 16 `bypassRequires: emergency_exception_approved` and CERT-002 remain authoritative for **gate bypass**.  
- EGCCRMS links both via emergency CHG/REL types and EXC-001 (`phase16Bypass`, `phase14Align`).  
- Helpers: `evaluateExceptionValidity`, `assertEmergencyChangeExceptionAlignment`.

---

## 11. Cross-reference Modules 1–30 × Phases 1–18

Full matrix in registry `CROSS_REF_MATRIX` and [`egccrms-catalogs.md`](./egccrms-catalogs.md). Governance lens only — **engines not replaced**. Module 30 called out for operational config governance reference.

---

## 12. Schemas & machine artifacts

| Artifact | Path |
|----------|------|
| Governance registry | `src/core/canonical-governance-registry.js` |
| Helpers | `src/core/phase19-change-release.js` |
| Change request schema | `docs/schemas/governance/change-request.schema.json` |
| Configuration item schema | `docs/schemas/governance/configuration-item.schema.json` |
| Release record schema | `docs/schemas/governance/release-record.schema.json` |
| Manifest | `docs/schemas/manifest.json` (`phaseCoverage.phase19`) |

Schema `$id` / `$ref` use absolute `https://schemas.smiletrust.com/...`. Draft 2020-12; `additionalProperties: false`.

---

## 13. Validation & non-regression

- Unique IDs/codes; exactly one accountable authority per entry  
- Change class + domain coverage; CI category coverage; release type coverage  
- Policy lifecycle states complete  
- Cross-phase: Phase 8/14/16/18 consumed; Module 30 not replaced  
- Money invariants preserved in DB/reporting/APK-related change types  
- `npm run prepare:web` syncs `src/` → `www/`  
- Phase 20 EIBPRFBS is the **downstream** final specification baseline — does not redefine this phase  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 19 EGCCRMS |
| 1.0.1 | 2026-09-15 | Downstream link to Phase 20 EIBPRFBS |
