# Enterprise Business Continuity, Backup & Disaster Recovery Specification (EBCBDRS) — Phase 15

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 15 — Authoritative Business Continuity / Backup / DR Catalog  
**Status:** Authoritative for Phase 15 continuity operationalization  
**Version:** 1.0.0  
**Date:** 2026-09-14  
**Backup / restore execution engine:** **Module 21** (`backup-recovery-ops.js`, `backup-recovery-lifecycle.js`) — **not replaced**  
**DR / platform governance engine:** **Module 30** (`platform-ops.js`) — **not replaced**  
**Phase 14 RPO/RTO policy:** **Consumed** from `canonical-deployment-registry.js` / `phase14-recovery-governance.js` — **not redefined**  
**Machine registry:** `src/core/canonical-continuity-registry.js`  
**Breach reporting:** `src/core/phase15-breach-reporting.js`  
**Companion matrices:** [`ebcbdrs-catalogs.md`](./ebcbdrs-catalogs.md)  
**Breach schema:** [`schemas/business-continuity/rpo-rto-breach-report.schema.json`](./schemas/business-continuity/rpo-rto-breach-report.schema.json)  
**Downstream (consume):** Phase 16 ETQAVS — [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md) validates RPO/RTO achievement in DR tests; does **not** redefine Phase 15 budgets. Phase 18 EOSSMS — [`enterprise-operations-support.md`](./enterprise-operations-support.md) consumes RPO/RTO in recovery runbooks; does **not** redefine Phase 15 budgets. Phase 19 EGCCRMS — [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md) may govern change of DR-related CIs; does **not** redefine Phase 15 budgets.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EBCBDRS |
| Accountable authority (catalog) | Platform Operations Lead / DR Steward |
| Money posts | **Forbidden** for continuity catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** |
| Nav changes | **None** |
| RBAC rewrite | **None** |
| Module 21 | **Operational backup/restore engine** — referenced, not replaced |
| Module 30 | **DR governance / platform ops** — referenced, not replaced |
| Phase 14 | **RPO/RTO policy & measurement** — consumed, not redefined |

**Non-regression:** Phases 1–14 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, monitoring, deployment, and RPO/RTO **policy**. Phase 15 **implements/operationalizes** continuity catalogs, backup architecture mapping, DR playbooks, failover/failback intent, breach reporting, and crisis communication registries only.

---

## 1. Purpose & scope

### 1.1 Purpose

EBCBDRS is the **enterprise business continuity catalog** that maps Smile Trust business services to Phase 14 recovery targets, Module 21 backup/restore execution, and Module 30 DR governance. It adds measurable breach reporting (severity L0–L4), CAPA rules, and a canonical JSON schema — without inventing a second backup engine or rewriting Phase 14 budgets.

### 1.2 In scope

- Business Impact Analysis (BIA) for continuity tiers  
- Backup architecture mapping to Module 21 types/schedules/retention  
- Disaster recovery & failover/failback playbooks (catalog)  
- Validation, testing, crisis communication, governance  
- Concrete RPO & RTO Target Matrix (aligned to Phase 14)  
- Measurable breach reporting + payload + schema  
- Input & Dependency Rules (Phases 1–14, Modules 1–30)

### 1.3 Out of scope

- Redefining Phase 14 `RRT-*` policy minutes or measurement formulas  
- Replacing Module 21 backup-recovery engines or Module 30 platform-ops  
- New navigation items; money posts; RBAC matrix changes  
- Standing up new infrastructure beyond catalog intents already in EDDIES

### 1.4 Project reality (honest)

| Reality | Implication |
|---------|-------------|
| Vanilla JS SPA + localStorage | Continuity must cover device/local export paths |
| Optional Supabase | DB restore path via migrations + Module 21 sets |
| Capacitor / Electron | APK/EXE redeploy + android_offline backups |
| Module 21 | Sole backup/restore/drill executor |
| Module 30 | Sole DR declaration / failover approval metadata |
| Phase 14 | Sole RPO/RTO **policy** catalog (`RRT-001`…`RRT-006`) |

---

## 2. Architecture overview

```text
┌──────────────────────────────────────────────────────────────┐
│ Phases 1–14 catalogs (consume) + Modules 1–30 domains        │
└────────────────────────────┬─────────────────────────────────┘
                             │ reference only
┌────────────────────────────▼─────────────────────────────────┐
│ Phase 15 EBCBDRS + canonical-continuity-registry             │
│ services · backup policies · recovery plans · disasters      │
│ + phase15-breach-reporting (evaluate / payload / KPIs)       │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│ Module 21                 │   │ Module 30                    │
│ backup-recovery-ops       │   │ platform-ops DR governance   │
│ verify / restore / drills │   │ declare / failover metadata  │
└───────────────────────────┘   └──────────────────────────────┘
                ▲
                │ policy (not redefined)
┌───────────────┴───────────────┐
│ Phase 14 EDDIES RRT-* +       │
│ phase14-recovery-governance   │
└───────────────────────────────┘
```

**Boundary:** EBCBDRS does not post money, does not change posting/RBAC, does not replace Module 21/30, and does not alter Phase 14 RPO/RTO policy numbers.

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase / Mod | Artifacts |
|------------:|-----------|
| 1–2 | EMAS, governance / consistency |
| 3–7 | ECDM, ECSMLS, ECECMS, ECACIS, ECDAPS — soft links |
| 8–11 | Config / integration / BI / platform as present |
| 12–13 | AI / monitoring observe during recovery soak |
| **14** | **EDDIES RPO/RTO targets + measurement/SoD** — authoritative policy |
| Mod 18 | Scheduled backup / verify / recovery_test jobs |
| Mod 19 | Alerts/metrics observe (`backupFailed`, health soak) |
| **Mod 21** | **Backup/restore/DR execution engine** |
| Mod 22 | Auth recovery domain |
| Mod 27–28 | Loan formulas / payments continuity (no rewrite) |
| **Mod 30** | **DR governance, environments, failover approval** |

### 3.2 Precedence

1. ADRs / explicit exceptions  
2. EMAS → Phase 2 governance  
3. ECDM → … → ECDAPS (Phases 3–7)  
4. EAIADIS / EMOOIS (12–13) observe hooks  
5. **Phase 14 EDDIES RPO/RTO policy & measurement**  
6. **Module 21** backup/restore execution  
7. **Module 30** DR / platform governance  
8. **Phase 15 EBCBDRS** continuity catalog & breach reporting only  

### 3.3 Forbidden actions

- Redefining `RRT-*` rpo/rto minutes or Phase 14 formulas  
- Duplicating backup job engines outside Module 21  
- Declaring production disaster/failover outside Module 30 decision rights  
- Money posts, collection/loan/ledger rewrites, new nav, RBAC rewrite  

---

## 4. Business Impact Analysis (BIA)

### 4.1 Continuity tiers

| Tier | Meaning | Examples |
|------|---------|----------|
| tier0_mission_critical | Immediate customer/money path or identity | database, application, auth, payments |
| tier1_business_critical | Core Susu operations | collections, loans, sync, accounting |
| tier2_important | Degraded ops acceptable briefly | monitoring, branch ops |
| tier3_standard | Best-effort | catalog-only support services |

### 4.2 Impact dimensions

| Dimension | Question |
|-----------|----------|
| Confidentiality | Encrypted backups; Android offline device-bound |
| Integrity | Checksum verify before activate (Module 21) |
| Availability | RTO budgets from Phase 14 / service matrix |
| Financial | No silent money posts during restore |
| Regulatory / audit | Breach reports + CAPA + SoD Accountable ≠ Audit |
| Reputation | Crisis communication channels COM-* |

### 4.3 Recovery priority (operational)

1 → auth + database → 2 application / payments / collections / loans → 3 sync / accounting → 4 monitoring → 5 branch manual fallback.

---

# Appendix A — Concrete RPO & RTO Target Matrix

> **Alignment rule:** Technical services `database`, `application`, `auth`, `synchronization`, `payments`, `monitoring` **must match** Phase 14 `RRT-*` `rpoMinutes` / `rtoMinutes`. Business domains that soft-link to `RRT-001`/`RRT-002` inherit those budgets. Phase 15 does **not** invent conflicting policy.

## A.1 Tiers × strictness

| Environment | Enforcement |
|-------------|-------------|
| DEV / QA | Catalog only; relaxed drills |
| UAT / Staging | Rehearse production targets |
| Production / DR | Enforce critical targets; stab **30m** (Phase 14) |

## A.2 Service table (seed)

| Service | Tier | RPO | RTO | Priority | Phase 14 |
|---------|------|----:|----:|---------:|----------|
| SVC-001 database | tier0 | 60 | 240 | 1 | RRT-001 |
| SVC-002 application | tier0 | 60 | 120 | 2 | RRT-002 |
| SVC-003 auth | tier0 | 15 | 60 | 1 | RRT-003 |
| SVC-004 sync | tier1 | 30 | 180 | 3 | RRT-004 |
| SVC-005 payments | tier0 | 15 | 90 | 2 | RRT-005 |
| SVC-006 monitoring | tier2 | 120 | 240 | 4 | RRT-006 |
| SVC-007 collections | tier1 | 60 | 240 | 2 | RRT-001 |
| SVC-008 loans | tier1 | 60 | 240 | 2 | RRT-001 |
| SVC-009 accounting | tier1 | 60 | 240 | 3 | RRT-001 |
| SVC-010 branch ops | tier2 | 120 | 480 | 5 | RRT-002 |

## A.3 Database / backup targets

| Target class | Source | Notes |
|--------------|--------|-------|
| DB policy RPO/RTO | Phase 14 RRT-001 + Module 21 defaults 60/240 | Policy unchanged |
| Measurement budgets | `measurementRpoTargetMinutes` etc. from Phase 14 | Used in drills/breach calc |
| Backup policies | BKP-001…BKP-006 | Module 21 types |

## A.4 Recovery priority & readiness metrics

| Priority | Readiness metric examples |
|---------:|---------------------------|
| 1 | `auth_config_restore_ok`, `db_backup_verify_pass_rate` |
| 2 | `last_known_good_release_redeployable`, payment config restore |
| 3–5 | sync age, journal reconcile, branch playbook ready |

## A.5 Compliance states

`compliant` · `at_risk` · `breached` · `exception_approved` · `not_measured`

---

# Appendix B — Measurable RPO & RTO Breach Reporting

## B.1 Breach rules

```text
RPO breached  ⇔  measuredRpoMinutes > targetRpoMinutes
RTO breached  ⇔  measuredRtoMinutes > targetRtoMinutes
Combined      ⇔  RPO breached OR RTO breached
```

Percent over target:

```text
percentOver = 0                         if measured ≤ target
percentOver = (measured − target)/target × 100   otherwise
```

## B.2 Severity L0–L4

| Level | Band | CAPA |
|-------|------|------|
| Level0 | ≤ 0% over (within target) | No |
| Level1 | (0%, 10%] | Optional |
| Level2 | (10%, 25%] | **Required** |
| Level3 | (25%, 50%] | **Required** |
| Level4 | > 50% | **Required** |

Combined severity = max(RPO severity, RTO severity).

## B.3 Data model (logical)

`reportId` (UUID), `incidentId` (`INC-*`), `recoveryTargetId` (`REC-TARGET-*`), `kind`, `service`, `measurement`, `classification`, `timeline`, `governance`, `correctiveActions`, `evidence`, `metadata`.

## B.4 Root causes

`BACKUP_STALE` · `RESTORE_SLOW` · `STABILIZATION_FAILED` · `DEPENDENCY_OUTAGE` · `HUMAN_PROCESS` · `CAPACITY` · `CORRUPTION` · `UNKNOWN`

## B.5 KPIs

| KPI | Definition |
|-----|------------|
| complianceRate | compliant / measured |
| breachRate | breached / measured |
| capaOpen | open CAPA count for L2+ |
| bySeverity | histogram L0–L4 |
| overallCompliance | roll-up state |

## B.6 Escalation

| Severity | Channels |
|----------|----------|
| L2+ | COM-001 internal ops, COM-004 audit |
| L3+ | + COM-002 executive |
| Branch impact | COM-003 |

## B.7 CAPA

Required when severity ≥ Level2. Owner, due date, status (`open`→`completed`), linked evidence.

## B.8 Dashboards / validation / audit

- Module 19 may observe breach KPI gauges (observe only).  
- `validateBreachReportPayload` enforces structure, patterns, timeline order, SoD, CAPA.  
- Audit authority ≠ accountable authority (Phase 14 SoD preserved).

Implementation: `evaluateBreach`, `buildBreachReportPayload`, `validateBreachReportPayload`, `computeComplianceKpis`, `measurementPassFail`.

---

# Appendix C — Breach Reporting Payload

## C.1 Full example

See [`schemas/business-continuity/examples/valid/rpo-rto-breach-report.valid.json`](./schemas/business-continuity/examples/valid/rpo-rto-breach-report.valid.json).

## C.2 Field & conditional rules

| Rule | Requirement |
|------|-------------|
| IDs | `reportId` UUID; `incidentId` `INC-*`; `recoveryTargetId` `REC-TARGET-*` |
| kind RPO | `measurement.rpo` required |
| kind RTO | `measurement.rto` required |
| kind Combined | both rpo + rto required |
| Severity L2+ | `correctiveActions.length >= 1` |
| Timeline | declared ≥ detected; restored ≥ declared; stabilized ≥ restored; reported ≥ detected |
| SoD | accountableAuthority ≠ auditAuthority |
| additionalProperties | **false** on schema root and `$defs` objects |

Invalid intentional example (documented failures): [`.../invalid/rpo-rto-breach-report.invalid.json`](./schemas/business-continuity/examples/invalid/rpo-rto-breach-report.invalid.json).

---

# Appendix D — Canonical JSON Schema

| Field | Value |
|-------|-------|
| Path | `docs/schemas/business-continuity/rpo-rto-breach-report.schema.json` |
| `$id` | `https://schemas.smiletrust.com/business-continuity/rpo-rto-breach-report.schema.json` |
| Draft | 2020-12 |
| `additionalProperties` | false |
| `$defs` | service, measurement (+ metricMeasurement/clock), classification, timeline, governance, correctiveAction, evidence, metadata |
| `if/then` | CAPA minItems 1 when severity Level2+; kind-specific measurement requirements |
| Manifest | `docs/schemas/manifest.json` includes SHA-256 |

---

## 5. Backup architecture (Module 21 engine)

| Catalog policy | Module 21 type | Role |
|----------------|----------------|------|
| BKP-001 | full | Daily durable set |
| BKP-002 | incremental | Business-hour lag reduction |
| BKP-003 | transaction_log | Audit/journal window |
| BKP-004 | android_offline | Device-bound queue/config |
| BKP-005 | application | Flags/config/templates |
| BKP-006 | snapshot | Pre-migration PIT |

Retention defaults remain Module 21 / platform config. Encryption required on catalog policies. Existing Local/Cloud Backup UI buttons remain; no new nav.

---

## 6. Disaster recovery & failover / failback

| Plan | Intent | Module 21 | Module 30 |
|------|--------|-----------|-----------|
| RCP-001 | DB restore | execute restore | approve activate |
| RCP-002 | App redeploy | config backup if needed | deploy/promote |
| RCP-003 | Auth recovery | application restore | window + audit |
| RCP-004 | Site failover | restore on DR | `approve_production_failover` / `declare_disaster` |
| RCP-005…010 | Domain BC | scoped restore / playbooks | metadata / comms |

**Failback:** Required when `failbackRequired: true` on plan; production failback follows same SoD and 30m stabilization.

Disaster classes: DIS-001 site · DIS-002 corruption · DIS-003 ransomware · DIS-004 regional · DIS-005 dependency.

---

## 7. Validation, testing & crisis communication

| Test | Engine | Frequency |
|------|--------|-----------|
| TST-001 backup verify | Module 21 | monthly |
| TST-002 RTO drill (non-prod) | Module 21 | quarterly |
| TST-003 failover tabletop | Module 30 | semi-annual |
| TST-004 Android offline | Module 21 | quarterly |

Communication registry: COM-001…COM-004 (ops, executive, branch, audit).

---

## 8. Governance

- Catalog accountable roles per SVC/BKP/RCP entry.  
- Exclusive/non-delegable rights remain Phase 14 / Module 30 (`declare_disaster`, `approve_production_failover`).  
- Breach CAPA mandatory L2+.  
- Exceptions to RPO/RTO **policy** still require Phase 14/Module 30 change control — Phase 15 only reports breaches.

---

## 9. Acceptance criteria

1. Docs `enterprise-business-continuity-dr.md` + `ebcbdrs-catalogs.md` with Input & Dependency Rules + appendices A–D  
2. Registry services/backup policies/recovery plans/disaster classes with list/get/validate  
3. Breach reporting evaluate / severity / payload / validate / KPIs  
4. Complete schema on disk + valid/invalid examples + manifest SHA-256  
5. Tests green; `prepare:web` after src changes  
6. Phase 14 not redefined; Modules 21 & 30 not replaced  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-14 | Initial Phase 15 EBCBDRS |
| 1.0.1 | 2026-09-15 | Cross-link Phase 16 ETQAVS (testing consumes RPO/RTO; does not redefine) |
| 1.0.2 | 2026-09-15 | Cross-link Phase 18 EOSSMS (recovery runbooks consume RPO/RTO; does not redefine) |
| 1.0.3 | 2026-09-15 | Cross-link Phase 19 EGCCRMS (may govern DR-related CI change; does not redefine) |
