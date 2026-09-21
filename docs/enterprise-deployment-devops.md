# Enterprise Deployment, DevOps, Infrastructure & Environment Specification (EDDIES) — Phase 14

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 14 — Authoritative Deployment / DevOps / Infrastructure Catalog  
**Status:** Authoritative for Phase 14 catalog & recovery-target governance definitions  
**Version:** 1.0.0  
**Date:** 2026-09-14  
**Owning module (operational manager):** **30** — Platform Administration (`platform-ops.js`, `platform-lifecycle.js`)  
**Backup / restore execution:** **Module 21** (`backup-recovery-ops.js`) — not duplicated  
**Machine registry:** `src/core/canonical-deployment-registry.js`  
**Recovery governance:** `src/core/phase14-recovery-governance.js`  
**Companion matrices:** [`eddies-catalogs.md`](./eddies-catalogs.md)  
**Module companion:** [`platform-administration.md`](./platform-administration.md)  
**Schemas (optional):** [`schemas/deployment/`](./schemas/deployment/)  
**Downstream (consume):** Phase 16 ETQAVS — [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md) quality gates consume env promotion; does **not** redefine EDDIES pipelines. Phase 17 EPSCMS — [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md) uses env evidence for capacity/benchmarks; does **not** redefine EDDIES. Phase 18 EOSSMS — [`enterprise-operations-support.md`](./enterprise-operations-support.md) references deploy windows in runbooks; does **not** redefine EDDIES. Phase 19 EGCCRMS — [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md) consumes CI/CD & emergency patterns for change/release governance; does **not** redefine EDDIES.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EDDIES |
| Accountable authority (catalog) | Platform Operations Lead |
| Money posts | **Forbidden** for deployment catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** |
| Nav changes | **None** |
| RBAC rewrite | **None** — permission identifiers only |
| Module 30 | **Referenced and consumed** as operational manager — **not replaced** |
| Module 21 | **Referenced** for backup/restore execution — **not replaced** |

**Non-regression:** Phases 1–13 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, AI, reporting, and monitoring. Phase 14 **catalogs** deployment, DevOps, infrastructure, environments, and recovery targets only. It does not redefine ECDM entities, ECACIS contracts, ECECMS events, ECSMLS transitions, EMOOIS monitors, money math, or RBAC matrices.

---

## 1. Purpose & scope

### 1.1 Purpose

EDDIES is the **single enterprise catalog** of environments, infrastructure intents, CI/CD pipelines, deployment intents, release artifacts, and RPO/RTO recovery targets for Smile Trust. Runtime environment registry, deployment plan/approve/execute/rollback metadata, maintenance windows, and DR governance continue to execute exclusively through **Module 30**. Backup verification and restore drills continue through **Module 21**.

### 1.2 In scope

- Deployment / DevOps / infrastructure catalog architecture
- Environment registry (Dev → QA → UAT → Staging → Production → DR)
- Pipeline, artifact, deployment, and release registries
- Target/canonical topology mapped to real project artifacts
- RPO/RTO specification, measurement, ownership, and decision rights (appendices)
- Input & Dependency Rules (Phases 1–13, Modules 1–30)

### 1.3 Out of scope

- Redefining entities, APIs, DB schemas, security, AI, BI KPIs, or monitoring SLOs
- Changing collection posting, loan interest **15%**, 31-day cycle, cashier GHS **1,000**, or `customerBalance`
- Replacing Module 30 platform-ops or Module 21 backup-recovery engines
- Standing up real Kubernetes HTTP servers in-repo
- Adding new navigation items

### 1.4 Project reality (honest)

| Reality | Implication for EDDIES |
|---------|------------------------|
| Vanilla JS SPA | Primary shippable web artifact is `www/` via `npm run prepare:web` |
| Capacitor Android APK | Mobile artifact via `build:apk` / `build:apk:release` |
| Electron EXE | Desktop artifact via `build:exe` / `build:portable` |
| `npm test` | Gate pipeline before promote |
| Optional Supabase | Migrations under `supabase/migrations/`; dual persistence with localStorage |
| No real k8s HTTP servers | Topology below is **target/canonical** for cloud+local; mapped to actual scripts/artifacts |
| Module 30 | Environments, deployment metadata, maintenance, DR governance — operational manager |
| Module 21 | Backup/restore/RPO-RTO execution defaults (60m RPO / 240m RTO) |

**Inventory anchors:** `scripts/prepare-web.js`, Capacitor, Electron, `supabase/migrations`, Module 30 deployment metadata (`deployment_history`, `environment_registry`).

---

## 2. Architecture overview

```text
┌─────────────────────────────────────────────────────────────┐
│  Phases 1–13 catalogs (consume) + Modules 1–30 domains      │
└────────────────────────────┬────────────────────────────────┘
                             │ reference only
┌────────────────────────────▼────────────────────────────────┐
│  Phase 14 EDDIES catalogs + canonical-deployment-registry   │
│  envs · infra · pipelines · artifacts · releases · RPO/RTO  │
│  + phase14-recovery-governance (measure / SoD)             │
└────────────────────────────┬────────────────────────────────┘
                             │ drives configuration intent
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ Module 30     │   │ Module 21       │   │ Build artifacts  │
│ platform-ops  │   │ backup-recovery │   │ prepare:web APK  │
│ env/deploy/DR │   │ verify / drills │   │ Electron EXE SQL │
└───────────────┘   └─────────────────┘   └──────────────────┘
```

**Boundary:** EDDIES does not post money, does not invent a second deployment engine, and does not replace Module 30 maintenance or Module 21 restore workflows.

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase / Mod | Artifacts |
|------------:|-----------|
| 1 | `docs/enterprise-master-architecture.md`, `docs/emas-matrices.md` |
| 2 | Consistency / governance / architecture-review workflow docs |
| 3–7 | ECDM, ECSMLS, ECECMS, ECACIS, ECDAPS — soft links only |
| 8–11 | Config, integration, BI, platform catalogs as present |
| 12 | EAIADIS — AI deploy metadata observed; not redefined |
| 13 | EMOOIS — health/SLO observe during stabilization; not redefined |
| Mod 19 | Monitoring health for post-deploy soak |
| Mod 21 | Backup/restore engine & default RPO/RTO |
| Mod 22 | Auth / security ops for auth recovery domain |
| Mod 28 | MoMo / payment integration recovery domain |
| Mod 30 | **Operational manager** — environments, deployment governance, maintenance, DR metadata |

### 3.2 Precedence

1. ADRs / explicit exceptions  
2. EMAS (Phase 1)  
3. Phase 2 consistency & governance  
4. ECDM → ECSMLS → ECECMS → ECACIS → ECDAPS (Phases 3–7)  
5. EAIADIS / EMOOIS (Phases 12–13) for AI & monitoring observe hooks  
6. Module 30 operational manager for environment/deploy runtime  
7. Module 21 for backup/restore execution  
8. EDDIES (this phase) for deployment/infra/RPO-RTO **catalog** only  

### 3.3 Forbidden actions

- Rewriting business posting, RBAC matrices, or money math  
- Replacing `platform-ops.js` or `backup-recovery-ops.js`  
- Claiming live k8s services exist in-repo when they do not  
- Adding top-level navigation  

---

## 4. Environment specification

| ID | Code | Module 30 code | Role |
|----|------|----------------|------|
| ENV-001 | DEV | development | Developer workstations / local debug |
| ENV-002 | QA | testing | Automated + manual QA |
| ENV-003 | UAT | uat | Business acceptance |
| ENV-004 | STAGING | staging | Pre-prod soak & migration dry-run |
| ENV-005 | PRODUCTION | production | Live operations |
| ENV-006 | DR | dr | Disaster recovery site metadata |

Promotion path (catalog): `DEV → QA → UAT|STAGING → PRODUCTION → DR (failover)`.

Production **stabilization period:** **30 minutes** after restore/deploy before RTO end may be declared.

---

## 5. Infrastructure & pipeline specification

### 5.1 Artifact map (reality)

| Artifact | Pipeline | Command / path |
|----------|----------|----------------|
| ART-001 www/ SPA | PIPE-002 | `npm run prepare:web` → `scripts/prepare-web.js` → `www/` |
| ART-002 Android APK | PIPE-003 | `npm run build:apk` |
| ART-003 Electron EXE | PIPE-004 | `npm run build:exe` |
| ART-004 SQL migrations | PIPE-005 | `supabase/migrations/` (ops-governed) |
| Tests gate | PIPE-001 | `npm test` |
| Promote | PIPE-006 | Module 30 plan → approve → execute |

### 5.2 Target topology note

Canonical cloud+local topology is documented in **Appendix A**. It is a **sizing and HA intent** model. In-repo truth remains the SPA/APK/EXE/migration artifacts above; Module 30 holds environment and deployment **metadata**.

---

## 6. Deployment & release governance

Deployment intents (`DEP-*`) and release trains (`REL-*`) are cataloged in the registry. Runtime transitions remain Module 30:

`planned → pending_approval → approved → in_progress → verified|completed|rolled_back`

Strategies (Module 30): `blue_green`, `canary`, `rolling`, `recreate`.

Maker-checker: planner ≠ sole approver for production (existing platform SoD). EDDIES does not alter RBAC.

---

## 7. Recovery objectives (summary)

Critical services **must** have RPO/RTO targets: **database**, **application**, **auth**.  
Defaults align with Module 21 / platform config: **RPO 60 minutes**, **RTO 240 minutes** for production DB unless a tighter measurement budget is declared on the target.

Full tables: Appendices B–E and [`eddies-catalogs.md`](./eddies-catalogs.md).

Measurement helpers: `measureRpo` / `measureRto` in `phase14-recovery-governance.js`.

Example: measured RPO **3 minutes** vs target **5 minutes** → **pass**; measured **10 minutes** vs **5 minutes** → **fail**.

---

## 8. Governance & Module 30 relationship

| Concern | Owner |
|---------|-------|
| EDDIES catalog SoT | `canonical-deployment-registry.js` + this document |
| Operational manager | Module **30** |
| Backup/restore execution | Module **21** |
| Observability during soak | Module **19** (EMOOIS observe) |
| Change control | Architecture Review Workflow; ADR for ID removals |
| Audit | Module 13 / platform audit trails |

**Module 30 is not replaced.** EDDIES catalogs intent; platform-ops remains the operational manager for environments, deployment governance, and maintenance.

---

## 9. Cross-reference summary (Phases 1–13 / Modules 1–30)

| Source | EDDIES use |
|--------|------------|
| Phase 1 EMAS | Platform / ops ownership |
| Phases 3–7 | Entity/table/API soft links for deployable surfaces |
| Phase 13 EMOOIS | Health checks during stabilization window |
| Module 18 | Job schedules for backup_verify / recovery_test |
| Module 19 | Post-deploy health observation |
| Module 21 | Backup/restore engine & default objectives |
| Module 22 | Auth recovery domain |
| Module 28 | Payments / MoMo recovery domain |
| Module 30 | **Operational manager** — required |

Full matrices: [`eddies-catalogs.md`](./eddies-catalogs.md).

---

## 10. Acceptance criteria

1. Docs `enterprise-deployment-devops.md` + `eddies-catalogs.md` exist with Input & Dependency Rules and Appendices A–E  
2. Registry exposes list/get/validate uniqueness + one `accountableAuthority` per target  
3. Env registry includes Dev/QA/UAT/Staging/Production/DR  
4. RPO/RTO present for critical services DB, app, auth  
5. Measurement pass/fail + production stabilization 30m  
6. SoD: Accountable ≠ Audit for same decision  
7. Module 30 referenced as operational manager; not replaced  
8. `tests/eddies-consistency.test.js` + `tests/phase14-recovery-governance.test.js` green under `npm test`  
9. `prepare:web` syncs `src` when registry changes  

---

## 11. Version history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-14 | Initial Phase 14 EDDIES catalog + recovery appendices |
| 1.0.1 | 2026-09-15 | Cross-link Phase 17 EPSCMS (capacity uses env evidence; does not redefine) |
| 1.0.2 | 2026-09-15 | Cross-link Phase 18 EOSSMS (runbooks reference deploy windows; does not redefine) |
| 1.0.3 | 2026-09-15 | Cross-link Phase 19 EGCCRMS (change/release consumes CI/CD & emergency; does not redefine) |

---

# Appendix A — Deployment Topology & Infrastructure Sizing

## A.1 Logical topology (ASCII) — target/canonical

```text
                     ┌──────────────────────┐
                     │  CI runners (target) │
                     │  npm test            │
                     │  prepare:web         │
                     │  build:apk / exe     │
                     └──────────┬───────────┘
                                │ artifacts
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Static host │      │ Android     │      │ Electron    │
    │ www/ SPA    │      │ APK distro  │      │ EXE distro  │
    └──────┬──────┘      └─────────────┘      └─────────────┘
           │
           ▼
    ┌─────────────────────────────────────────┐
    │ Optional Supabase / Postgres (cloud)    │
    │ ←── migrations ART-004                  │
    └──────────────────┬──────────────────────┘
                       │ async backup (Mod 21)
                       ▼
                ┌──────────────┐
                │ Backup store │──── failover metadata ──▶ DR env (ENV-006)
                └──────────────┘         (Mod 30 + Mod 21)
```

**Local reality:** developer machine runs SPA from disk/`www/`, Capacitor device builds, Electron desktop; persistence may be localStorage-only until optional Supabase is configured.

## A.2 Environment topologies (local → DR)

| Stage | Topology notes |
|-------|----------------|
| Local / DEV | Single workstation; no HA; synthetic data |
| QA | Shared QA host or CI artifacts; anonymized data |
| UAT | Production-like config; masked data; business users |
| Staging | Prod-like sizing intent; migration dry-run; soak |
| Production | Primary site; Module 30 active env; backups on |
| DR | Secondary warm/cold; Module 30 DR metadata; Module 21 restore |

## A.3 Sizing tiers

| Tier | When | Web | DB (optional) | CI | Storage |
|------|------|-----|---------------|----|---------|
| Small | ≤3 branches, pilot | 1 static origin | shared tiny | 1 runner | 50 GB backups |
| Medium | Regional multi-branch | CDN + origin | primary + replica intent | 2–4 runners | 500 GB |
| Large | National scale (target) | multi-origin / CDN | HA primary+standby | runner pool | multi-TB + object lock |

## A.4 Storage / network / HA / scalability

- **Storage:** application artifacts immutable by release id; DB backups per Module 21 retention; Android offline backups device-bound.  
- **Network:** HTTPS for optional cloud; offline-first Capacitor tolerated.  
- **HA:** target active/standby for optional DB; SPA static host multi-origin optional; DR env for site loss.  
- **Scalability:** horizontal static hosting; vertical optional DB; mobile/desktop scale by install base not servers.

## A.5 Performance targets (catalog intent)

| Surface | Target |
|---------|--------|
| `prepare:web` | Completes on CI within org SLA (doc intent) |
| SPA first paint | Observe via Module 19 — not redefined here |
| Migration apply (staging) | Dry-run before production window |
| Backup verify | Module 21 job success; alert on fail (EMOOIS) |

## A.6 Capacity rules

1. Production promote requires PIPE-001 green + Module 30 approval.  
2. Production DB changes require staging dry-run (DEP-004 pattern).  
3. DR capacity ≥ production RPO/RTO critical targets.  
4. Do not size for fictional k8s services not present in-repo.

---

# Appendix B — RPO & RTO Specification

## B.1 Service table (critical highlighted)

| Target | Service | RPO (min) | RTO (min) | Priority | Testing |
|--------|---------|----------:|----------:|---------:|---------|
| RRT-001 | database | 60 | 240 | 1 | monthly |
| RRT-002 | application | 60 | 120 | 2 | quarterly |
| RRT-003 | auth | 15 | 60 | 1 | monthly |
| RRT-004 | synchronization | 30 | 180 | 3 | quarterly |
| RRT-005 | payments | 15 | 90 | 2 | monthly |
| RRT-006 | monitoring | 120 | 240 | 4 | semi_annual |

## B.2 Data-domain table

| Domain | Services | Notes |
|--------|----------|-------|
| persistence | database | Module 21 + optional Supabase |
| runtime | application | Redeploy www/APK/EXE |
| identity | auth | Module 22 + session policy |
| offline_queue | synchronization | Encrypted device backup |
| integration | payments | Module 28/16 — no money rewrite |
| telemetry | monitoring | Module 19 buffers |

## B.3 Environment alignment

| Environment | RPO/RTO strictness |
|-------------|-------------------|
| DEV/QA | Relaxed; catalog only |
| UAT/Staging | Rehearse production targets |
| Production/DR | Enforce critical targets; stab 30m |

## B.4 Recovery priority

1 → auth + database → 2 application/payments → 3 sync → 4 monitoring.

## B.5 Backup alignment

Module 21 defaults (`rpoMinutes: 60`, `rtoMinutes: 240`) and `platform.defaults.backup` remain execution sources. EDDIES catalogs tighter **measurement** budgets where declared (`measurementRpoTargetMinutes`).

## B.6 Testing frequency & exceptions

Frequencies per target in registry. Exceptions require Module 30 + accountable authority approval; audit trail mandatory (Appendix D/E).

---

# Appendix C — Recovery Target Measurement Definitions

## C.1 Formulas

**RPO**

```text
measuredRpoMinutes = (recoveryPointAt − lastDurableCommitAt) / 60_000
PASS  ⇔  measuredRpoMinutes ≤ targetRpoMinutes
```

**RTO**

```text
measuredRtoMinutes = (serviceStabilizedAt − incidentDeclaredAt) / 60_000
PASS  ⇔  measuredRtoMinutes ≤ targetRtoMinutes
         AND stabilization period satisfied
```

## C.2 Start / end events

| Metric | Start | End |
|--------|-------|-----|
| RPO | Last durable commit / backup consistency mark | Earliest recoverable consistent point |
| RTO | Incident / disaster declared | Service declared stabilized |

## C.3 Stabilization periods

| Environment | Minutes |
|-------------|--------:|
| development | 0 |
| qa | 5 |
| uat / staging | 15 |
| **production** | **30** |
| dr | 30 |

Stabilization clock starts at `restoreCompletedAt` (or deploy verified). `serviceStabilizedAt` may not precede required soak.

## C.4 Pass / fail examples

| Case | Measured | Target | Result |
|------|---------:|-------:|--------|
| RPO | 3 min | 5 min | **pass** |
| RPO | 10 min | 5 min | **fail** |
| RTO | 90 min | 120 min + 30m stab | pass if stab met |
| RTO | 300 min | 240 min | **fail** |

## C.5 Evidence & time sync

Evidence: backup/set ids, incident ids, health-check pass window, UTC ISO-8601 timestamps, operator id.  
Clock: **UTC**; NTP (or equivalent); document skew &gt; 1s.

## C.6 Reporting metrics

`recovery_measurement_pass`, `recovery_measurement_fail`, `measured_rpo_minutes`, `measured_rto_minutes`, `stabilization_minutes_required` (emitted as governance records; Module 19 may observe).

Implementation: `measureRpo`, `measureRto`, `assertStabilizationPeriod`, `validateMeasurementRecord`, `reportingMetricsFromMeasurement`.

---

# Appendix D — Recovery Target Ownership & Approval

## D.1 Roles

| Role | Duty |
|------|------|
| Accountable authority | Owns outcome; exactly one per target |
| Responsible party | Executes drills/restores |
| Approving authority | Approves go-live / failover / exceptions |
| Audit authority | Independent review; ≠ Accountable |

## D.2 Ownership matrix (seed)

| Target | Accountable | Responsible | Audit |
|--------|-------------|-------------|-------|
| RRT-001 DB | Data Platform Lead | Backup Steward | Internal Auditor |
| RRT-002 App | Platform Operations Lead | Release Manager | Internal Auditor |
| RRT-003 Auth | Security Operations Lead | Platform Engineering Lead | Internal Auditor |
| RRT-004 Sync | Sync Steward | Mobile Ops Lead | Internal Auditor |
| RRT-005 Payments | Integration Steward | Payment Ops Lead | Internal Auditor |
| RRT-006 Monitoring | Platform Operations Lead | Monitoring Steward | Internal Auditor |

## D.3 Approval workflow / states / criteria

States (catalog): `draft → submitted → reviewed → approved | rejected → active → exception_requested → exception_approved | exception_denied`.

Criteria: unique accountable authority; SoD Accountable ≠ Audit; production changes need SystemOwner or Release Manager per Module 30; measurement evidence attached.

## D.4 Change / exception

RPO/RTO tighten/loosen via change control; Critical exceptions require `exceptionApprovalAuthority` and post-facto audit. Module 30 records deployment/DR metadata; Module 21 executes.

## D.5 Ownership metadata & review frequency

Machine fields: `accountableAuthority`, `responsibleParty`, `auditAuthority`, `testingFrequency`, `owningModule`.  
Review at least annually or on major architecture change; drill frequency per target.

---

# Appendix E — Accountable Authority Decision Rights

## E.1 Exclusive vs non-delegable

| Right | Exclusive | Delegable |
|-------|-----------|-----------|
| approve_production_failover | Yes | **No** |
| declare_disaster | Yes | **No** |
| approve_rpo_rto_exception | Yes | No (catalog) |
| accept_recovery_measurement | Yes | No |
| schedule_recovery_drill | No | Yes |
| execute_backup_verify | No | Yes |
| draft_rpo_rto_change | No | Yes |

## E.2 Boundary matrix

| Decision | Module 30 | Module 21 | EDDIES |
|----------|-----------|-----------|--------|
| Env / deploy metadata | **Owns runtime** | — | Catalogs intent |
| Restore execution | Governance metadata | **Owns execution** | Measures vs targets |
| RPO/RTO catalog IDs | Consumes | Consumes defaults | **Owns catalog** |

## E.3 Delegation & emergency

Delegable rights may assign `delegatedTo` with expiry. Non-delegable rights cannot. Emergency: SystemOwner or DR Steward may invoke declare/failover with **mandatory post-facto audit** within 24h.

## E.4 Machine-readable metadata example

See `accountableAuthorityMetadataExample()` in `phase14-recovery-governance.js`:

```json
{
  "schemaVersion": "1.0.0",
  "roles": {
    "accountableAuthority": "Platform Operations Lead",
    "responsibleParty": "Release Manager",
    "approvingAuthority": "SystemOwner",
    "auditAuthority": "Internal Auditor"
  },
  "decisionRights": {
    "nonDelegable": ["approve_production_failover", "declare_disaster"]
  },
  "sod": "Accountable ≠ Audit for same decision"
}
```

## E.5 SoD rule (hard)

**Accountable authority must not equal Audit authority for the same decision.** Enforced by `assertDecisionRightsSoD`.
