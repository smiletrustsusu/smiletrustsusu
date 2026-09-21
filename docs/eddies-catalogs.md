# EDDIES Catalogs (Phase 14 Companion Matrices)

**Parent:** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md)  
**Registry:** `src/core/canonical-deployment-registry.js`  
**Recovery governance:** `src/core/phase14-recovery-governance.js`  
**Module 30 operational manager:** [`platform-administration.md`](./platform-administration.md), `src/core/platform-ops.js`  
**Module 21 backup engine:** [`backup-recovery.md`](./backup-recovery.md)  
**Version:** 1.0.0  
**Date:** 2026-09-14  

**Scope:** Deployment / DevOps / infrastructure / environment / RPO-RTO catalog only. Consumes Phases 1–13 + Modules 1–30. Does **not** redefine entities, APIs, DB schemas, security, AI, reporting, monitoring, money math, or RBAC. **Does not replace Module 30.**

**Reality:** Vanilla JS SPA; `prepare:web` → `www/`; Capacitor APK; Electron EXE; optional Supabase migrations; no in-repo k8s HTTP servers (topology is target/canonical).

**Counts (seed):** environments=6, infrastructure=6, pipelines=7, artifacts=6, deployments=5, releases=4, rpoRtoTargets=6

---

## 1. Environment Registry

| ID | Code | Name | Module 30 | Tier | Accountable |
|----|------|------|-----------|------|-------------|
| ENV-001 | DEV | Development | development | development | Platform Engineering Lead |
| ENV-002 | QA | Quality Assurance | testing | qa | QA Lead |
| ENV-003 | UAT | User Acceptance Testing | uat | uat | Business Acceptance Lead |
| ENV-004 | STAGING | Staging | staging | staging | Release Manager |
| ENV-005 | PRODUCTION | Production | production | production | Platform Operations Lead |
| ENV-006 | DR | Disaster Recovery | dr | dr | DR Steward |

Production / DR stabilization: **30 minutes**.

---

## 2. Infrastructure Registry

| ID | Code | Kind | Maps to | Accountable |
|----|------|------|---------|-------------|
| INF-001 | WEB_STATIC_HOST | compute_edge | `prepare:web` → `www/` | Platform Engineering Lead |
| INF-002 | OPTIONAL_SUPABASE | database | `supabase/migrations` | Data Platform Lead |
| INF-003 | ANDROID_DISTRIBUTION | mobile | `build:apk` | Mobile Ops Lead |
| INF-004 | ELECTRON_DESKTOP | desktop | `build:exe` | Desktop Ops Lead |
| INF-005 | CI_RUNNER_POOL | ci | `npm test` + build pipelines | DevOps Lead |
| INF-006 | BACKUP_STORE | storage | Module 21 backups | Backup Steward |

---

## 3. Pipeline Registry

| ID | Code | Kind | Command | Produces |
|----|------|------|---------|----------|
| PIPE-001 | UNIT_TEST | test | `npm test` | — |
| PIPE-002 | PREPARE_WEB | prepare_web | `npm run prepare:web` | ART-001 |
| PIPE-003 | BUILD_ANDROID_APK | build_apk | `npm run build:apk` | ART-002 |
| PIPE-004 | BUILD_ELECTRON_EXE | build_exe | `npm run build:exe` | ART-003 |
| PIPE-005 | SUPABASE_MIGRATE | migrate | ops-governed migrations | ART-004 |
| PIPE-006 | RELEASE_PROMOTE | promote | Module 30 deploy metadata | ART-005 |
| PIPE-007 | BACKUP_VERIFY | verify | Module 21 verify/drill | — |

---

## 4. Artifact Registry

| ID | Code | Kind | Path hint | Pipeline |
|----|------|------|-----------|----------|
| ART-001 | WWW_SPA_BUNDLE | web_bundle | `www/` | PIPE-002 |
| ART-002 | ANDROID_APK | android_apk | android apk outputs | PIPE-003 |
| ART-003 | ELECTRON_EXE | electron_exe | `dist/` | PIPE-004 |
| ART-004 | SQL_MIGRATIONS | sql_migration | `supabase/migrations/` | PIPE-005 |
| ART-005 | EDDIES_DOCS | docs_catalog | `docs/enterprise-deployment-devops.md` | PIPE-006 |
| ART-006 | CONFIG_EXAMPLE | config_template | `config.example.json` | PIPE-002 |

---

## 5. Deployment Registry

| ID | Code | Environment | Artifacts | Strategy | Module 30 |
|----|------|-------------|-----------|----------|-----------|
| DEP-001 | DEPLOY_WEB_PROD | ENV-005 | ART-001 | recreate | executeDeployment |
| DEP-002 | DEPLOY_APK_PROD | ENV-005 | ART-002 | rolling | executeDeployment |
| DEP-003 | DEPLOY_EXE_PROD | ENV-005 | ART-003 | rolling | executeDeployment |
| DEP-004 | DEPLOY_MIGRATE_STAGING | ENV-004 | ART-004 | recreate | planDeployment |
| DEP-005 | DEPLOY_FAILOVER_DR | ENV-006 | ART-001, ART-004 | blue_green | DR + Module 21 |

---

## 6. Release Registry

| ID | Code | Artifacts | Pipelines | Accountable |
|----|------|-----------|-----------|-------------|
| REL-001 | REL_WEB_SPA | ART-001, ART-006 | PIPE-001,002,006 | Release Manager |
| REL-002 | REL_ANDROID | ART-002 | PIPE-001,003,006 | Mobile Ops Lead |
| REL-003 | REL_ELECTRON | ART-003 | PIPE-001,004,006 | Desktop Ops Lead |
| REL-004 | REL_DATA_SCHEMA | ART-004 | PIPE-005,006 | Data Platform Lead |

---

## 7. RPO / RTO Catalog

| ID | Code | Service | RPO | RTO | Priority | Accountable | Audit |
|----|------|---------|----:|----:|---------:|-------------|-------|
| RRT-001 | RPO_RTO_DATABASE | database | 60 | 240 | 1 | Data Platform Lead | Internal Auditor |
| RRT-002 | RPO_RTO_APPLICATION | application | 60 | 120 | 2 | Platform Operations Lead | Internal Auditor |
| RRT-003 | RPO_RTO_AUTH | auth | 15 | 60 | 1 | Security Operations Lead | Internal Auditor |
| RRT-004 | RPO_RTO_SYNC_QUEUE | synchronization | 30 | 180 | 3 | Sync Steward | Internal Auditor |
| RRT-005 | RPO_RTO_PAYMENTS | payments | 15 | 90 | 2 | Integration Steward | Internal Auditor |
| RRT-006 | RPO_RTO_MONITORING | monitoring | 120 | 240 | 4 | Platform Operations Lead | Internal Auditor |

Critical services required: **database**, **application**, **auth**.  
Measurement example budgets use `measurementRpoTargetMinutes` (e.g. 5m) for pass/fail demos: 3m pass, 10m fail.  
Production stabilization: **30m**.

---

## 8. Ownership Matrix (recovery targets)

| Target | Accountable (A) | Responsible (R) | Audit | Review / test |
|--------|-----------------|-----------------|-------|---------------|
| RRT-001 | Data Platform Lead | Backup Steward | Internal Auditor | monthly |
| RRT-002 | Platform Operations Lead | Release Manager | Internal Auditor | quarterly |
| RRT-003 | Security Operations Lead | Platform Engineering Lead | Internal Auditor | monthly |
| RRT-004 | Sync Steward | Mobile Ops Lead | Internal Auditor | quarterly |
| RRT-005 | Integration Steward | Payment Ops Lead | Internal Auditor | monthly |
| RRT-006 | Platform Operations Lead | Monitoring Steward | Internal Auditor | semi_annual |

**SoD:** Accountable ≠ Audit for the same decision (`assertDecisionRightsSoD`).

---

## 9. Cross-reference — Phases 1–13

| Phase | EDDIES consumption |
|------:|-------------------|
| 1 EMAS | Platform / deployment ownership context |
| 2 Governance | Change control / architecture review |
| 3 ECDM | Soft link entities (environment, deployment) |
| 4 ECSMLS | Deployment state machine affinity (Module 30) |
| 5 ECECMS | Platform events (maintenance, deploy) observe |
| 6 ECACIS | Platform.Deploy / Environment API contracts |
| 7 ECDAPS | Tables `environment_registry`, `deployment_history` |
| 8–11 | Config / integration / BI / platform catalogs as present |
| 12 EAIADIS | Model deploy metadata not redefined |
| 13 EMOOIS | Health during stabilization soak |

---

## 10. Cross-reference — Modules 1–30

| Module | Role vs EDDIES |
|-------:|----------------|
| 1 Auth / users | Auth recovery domain consumer |
| 13 Audit | Deployment / recovery audit trails |
| 15 Sync / offline | Sync RPO/RTO domain |
| 16 Payments | Payment path; no money rewrite |
| 18 Jobs | backup_verify / recovery_test schedules |
| 19 Monitoring | Soak / health observe (not replaced) |
| 21 Backup/DR | **Execution engine** for restore (not replaced) |
| 22 Security | Auth / security recovery |
| 27 BI | Not redefined |
| 28 Integration | MoMo / payments recovery |
| 29 AI | Advisory deploy metadata only |
| **30 Platform Admin** | **Operational manager** — environments, deployment governance, maintenance, DR metadata (**not replaced**) |

---

## 11. Decision-rights summary

Exclusive / non-delegable: `approve_production_failover`, `declare_disaster`.  
Exclusive: `approve_rpo_rto_exception`, `accept_recovery_measurement`.  
Delegable: `schedule_recovery_drill`, `execute_backup_verify`, `draft_rpo_rto_change`.

See parent Appendices D–E and `accountableAuthorityMetadataExample()`.
