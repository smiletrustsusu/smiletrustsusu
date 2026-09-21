# EBCBDRS Catalogs (Phase 15 Companion Matrices)

**Parent:** [`enterprise-business-continuity-dr.md`](./enterprise-business-continuity-dr.md)  
**Registry:** `src/core/canonical-continuity-registry.js`  
**Breach reporting:** `src/core/phase15-breach-reporting.js`  
**Phase 14 policy (consume):** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md), `canonical-deployment-registry.js`  
**Module 21 engine:** [`backup-recovery.md`](./backup-recovery.md), `backup-recovery-ops.js`  
**Module 30 DR governance:** [`platform-administration.md`](./platform-administration.md), `platform-ops.js`  
**Version:** 1.0.0  
**Date:** 2026-09-14  

**Scope:** Business continuity / backup / DR **catalog** only. Consumes Phases 1–14 + Modules 1–30. Does **not** redefine entities, APIs, DB, security, monitoring, deployment, or Phase 14 RPO/RTO **policy**. Does **not** replace Module 21 or Module 30.

**Counts (seed):** services=10, backupPolicies=6, recoveryPlans=10, disasterClasses=5, continuityTests=4, communicationChannels=4

---

## 1. Business Service Registry

| ID | Code | Key | Tier | RPO | RTO | Pri | Phase 14 | Accountable |
|----|------|-----|------|----:|----:|----:|----------|-------------|
| SVC-001 | SVC_DATABASE | database | tier0 | 60 | 240 | 1 | RRT-001 | Data Platform Lead |
| SVC-002 | SVC_APPLICATION | application | tier0 | 60 | 120 | 2 | RRT-002 | Platform Operations Lead |
| SVC-003 | SVC_AUTH | auth | tier0 | 15 | 60 | 1 | RRT-003 | Security Operations Lead |
| SVC-004 | SVC_SYNC | synchronization | tier1 | 30 | 180 | 3 | RRT-004 | Sync Steward |
| SVC-005 | SVC_PAYMENTS | payments | tier0 | 15 | 90 | 2 | RRT-005 | Integration Steward |
| SVC-006 | SVC_MONITORING | monitoring | tier2 | 120 | 240 | 4 | RRT-006 | Platform Operations Lead |
| SVC-007 | SVC_COLLECTIONS | collections | tier1 | 60 | 240 | 2 | RRT-001 | Savings Operations Lead |
| SVC-008 | SVC_LOANS | loans | tier1 | 60 | 240 | 2 | RRT-001 | Credit Operations Lead |
| SVC-009 | SVC_ACCOUNTING | accounting | tier1 | 60 | 240 | 3 | RRT-001 | Finance Controller |
| SVC-010 | SVC_BRANCH_OPS | branch_operations | tier2 | 120 | 480 | 5 | RRT-002 | Branch Network Lead |

---

## 2. Backup Policy Registry

| ID | Code | Type | Schedule hint | Retention days | Engine |
|----|------|------|---------------|---------------:|--------|
| BKP-001 | BKP_FULL_DAILY | full | daily | 30 | Module 21 |
| BKP-002 | BKP_INCREMENTAL | incremental | hourly_business | 14 | Module 21 |
| BKP-003 | BKP_TXN_LOG | transaction_log | continuous_window | 90 | Module 21 |
| BKP-004 | BKP_ANDROID_OFFLINE | android_offline | device_bound | 7 | Module 21 |
| BKP-005 | BKP_APPLICATION_CONFIG | application | on_release_and_daily | 60 | Module 21 |
| BKP-006 | BKP_SNAPSHOT | snapshot | pre_migration_and_weekly | 21 | Module 21 |

---

## 3. Recovery Plan Registry

| ID | Code | Strategy | Services | Failback | Module 30 |
|----|------|----------|----------|----------|-----------|
| RCP-001 | RCP_DATABASE_RESTORE | restore_from_backup_set | SVC-001,007–009 | yes | approve activate |
| RCP-002 | RCP_APP_REDEPLOY | redeploy_artifact | SVC-002,006,010 | yes | deploy/promote |
| RCP-003 | RCP_AUTH_RECOVERY | config_restore | SVC-003 | no | window + audit |
| RCP-004 | RCP_DR_SITE_FAILOVER | site_failover | SVC-001,002 | yes | failover / declare |
| RCP-005 | RCP_SYNC_QUEUE | device_bound_restore | SVC-004 | no | incident metadata |
| RCP-006 | RCP_PAYMENTS_CONTINUITY | provider_config_restore | SVC-005 | no | maintenance if needed |
| RCP-007 | RCP_COLLECTIONS_BC | manual_ops_then_restore | SVC-007 | yes | crisis comms |
| RCP-008 | RCP_LOANS_BC | manual_ops_then_restore | SVC-008 | yes | crisis comms |
| RCP-009 | RCP_ACCOUNTING_BC | restore_and_reconcile | SVC-009 | no | post-restore audit |
| RCP-010 | RCP_BRANCH_MANUAL | manual_playbook | SVC-010 | yes | declare ops mode |

---

## 4. Disaster Classification Registry

| ID | Code | Category | Default severity | Typical plans |
|----|------|----------|------------------|---------------|
| DIS-001 | DIS_SITE_FAILURE | infrastructure | Level3 | RCP-004,001,002 |
| DIS-002 | DIS_DATA_CORRUPTION | data | Level3 | RCP-001,009,005 |
| DIS-003 | DIS_RANSOMWARE | security | Level4 | RCP-001,003,004 |
| DIS-004 | DIS_REGIONAL_OUTAGE | availability | Level2 | RCP-004,010,006 |
| DIS-005 | DIS_DEPENDENCY_FAILURE | dependency | Level2 | RCP-006,003,002 |

---

## 5. Continuity Test Registry

| ID | Code | Engine | Frequency | Pass criteria |
|----|------|--------|-----------|---------------|
| TST-001 | TST_BACKUP_VERIFY | Module 21 verify | monthly | verified |
| TST-002 | TST_RTO_DRILL | Module 21 recovery_test | quarterly | rtoCompliant; non-prod |
| TST-003 | TST_FAILOVER_TABLETOP | Module 30 metadata | semi_annual | checklist + rights |
| TST-004 | TST_ANDROID_OFFLINE | Module 21 android_offline | quarterly | queue restored |

---

## 6. Communication Registry

| ID | Code | Audience | Trigger severities | Owner |
|----|------|----------|--------------------|-------|
| COM-001 | COM_INTERNAL_OPS | ops_engineering | L2–L4 | Platform Operations Lead |
| COM-002 | COM_EXEC_ESCALATION | executive | L3–L4 | SystemOwner |
| COM-003 | COM_BRANCH_NETWORK | branch_staff | L2–L4 | Branch Network Lead |
| COM-004 | COM_AUDIT_NOTICE | audit | L2–L4 | Internal Auditor |

---

## 7. RPO / RTO Operational Matrix

| Service | Policy RPO/RTO | Measurement budgets | Readiness metric | Compliance default |
|---------|----------------|---------------------|------------------|--------------------|
| SVC-001 | 60 / 240 | 5 / 240 | db_backup_verify_pass_rate | not_measured |
| SVC-002 | 60 / 120 | 5 / 120 | last_known_good_release_redeployable | not_measured |
| SVC-003 | 15 / 60 | 5 / 60 | auth_config_restore_ok | not_measured |
| SVC-004 | 30 / 180 | 30 / 180 | android_offline_backup_age_minutes | not_measured |
| SVC-005 | 15 / 90 | 15 / 90 | payment_provider_config_restore_ok | not_measured |
| SVC-006 | 120 / 240 | 120 / 240 | monitoring_buffer_rehydrate_ok | not_measured |
| SVC-007 | 60 / 240 | 60 / 240 | collections_continuity_drill_pass | not_measured |
| SVC-008 | 60 / 240 | 60 / 240 | loan_continuity_drill_pass | not_measured |
| SVC-009 | 60 / 240 | 60 / 240 | journal_restore_reconcile_ok | not_measured |
| SVC-010 | 120 / 480 | 120 / 480 | branch_manual_ops_playbook_ready | not_measured |

**Breach severity bands:** L0 ≤0% · L1 ≤10% · L2 ≤25% · L3 ≤50% · L4 >50% over target. CAPA required L2+.

**Stabilization:** Production / DR **30 minutes** (Phase 14 — not redefined).

---

## 8. Cross-reference — Phases 1–14

| Phase | EBCBDRS consumption |
|------:|---------------------|
| 1 EMAS | Platform ownership context |
| 2 Governance | Change control / exceptions |
| 3 ECDM | Soft-link continuity domains |
| 4 ECSMLS | Restore state affinity (Module 21 matrix) |
| 5 ECECMS | Observe platform/DR events |
| 6 ECACIS | Soft-link platform APIs |
| 7 ECDAPS | Persistence tables soft-link |
| 8–11 | Config / integration / BI / platform as present |
| 12 EAIADIS | Observe only during recovery |
| 13 EMOOIS | Health/backupFailed during soak |
| **14 EDDIES** | **Authoritative RPO/RTO policy + measurement** |

---

## 9. Cross-reference — Modules 1–30

| Module | Role vs EBCBDRS |
|-------:|-----------------|
| 1 Auth / users | Auth continuity consumer |
| 6 Collections | SVC-007 BC |
| 8 Loans | SVC-008 BC |
| 10 Accounting | SVC-009 BC |
| 13 Audit | Evidence / notice |
| 15 Sync | SVC-004 / BKP-004 |
| 16/28 Payments | SVC-005 / RCP-006 |
| 18 Jobs | Schedules backup_verify / recovery_test |
| 19 Monitoring | Observe KPIs / alerts |
| **21 Backup** | **Execution engine — not replaced** |
| 22 Security | Auth recovery |
| 27 Formulas | Unchanged during restore |
| **30 Platform** | **DR governance — not replaced** |
| Others | Soft consumers / no ownership conflict |

---

## 10. Engine boundary summary

| Concern | Owner |
|---------|-------|
| RPO/RTO policy minutes | Phase 14 `RRT-*` |
| Measure pass/fail formulas | Phase 14 `phase14-recovery-governance` |
| Backup create/verify/restore/drill | Module 21 |
| Declare disaster / approve failover | Module 30 |
| Continuity catalogs + breach reports | **Phase 15** |
