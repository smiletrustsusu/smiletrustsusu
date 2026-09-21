# EOSSMS Catalogs (Phase 18 Companion Matrices)

**Parent:** [`enterprise-operations-support.md`](./enterprise-operations-support.md)  
**Registry:** `src/core/canonical-operations-registry.js`  
**SLA helpers:** `src/core/phase18-ops-sla.js`  
**Phase 13 (consume):** [`enterprise-monitoring-observability.md`](./enterprise-monitoring-observability.md) — dashboard refresh  
**Phase 14 (consume):** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md)  
**Phase 15 (consume):** [`enterprise-business-continuity-dr.md`](./enterprise-business-continuity-dr.md)  
**Phase 16 (consume):** [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md)  
**Phase 17 (consume):** [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md)  
**Module 15 / 19 / 21 / 30:** sync · monitoring · backup · platform — **not replaced**  
**Version:** 1.0.0  
**Date:** 2026-09-15  

**Scope:** Operations / support / service management **catalog** only. Consumes Phases 1–17 + Modules 1–30. Does **not** redefine entities, APIs, DB, security, monitoring, deployment, BCDR, testing, or performance **standards**. Does **not** replace operational engines.

**Counts (seed):** roles=10, services=18, incidentSlas=4, problems=7, serviceRequests=8, knowledge=6, runbooks=12, offlineRunbooks=4, kpis=10, governance=6, offlineModes=5, syncRetryPolicies=5, escalationThresholds=5, collectorStatuses=6, decisionFlows=7, syncWorkflowStages=13

**Phase 13 dashboard refresh (consumed):** strip 30s · alerts 60s · device/offline 60s · sync health 60s · business volume 5m  
**Sync escalation (aligned):** ≥4h branch · ≥24h regional · queue>1000 · success<99%

---

## 1. Service Catalog Registry

| ID | Code | Tier | Module | Owner |
|----|------|------|-------:|-------|
| SVC-001 | SVC_AUTH_ACCESS | tier1 | 1 | Service Owner |
| SVC-002 | SVC_MEMBER_ONBOARDING | tier2 | 3 | Service Owner |
| SVC-003 | SVC_SAVINGS | tier1 | 5 | Service Owner |
| SVC-004 | SVC_COLLECTIONS | tier1 | 6 | Service Owner |
| SVC-005 | SVC_LOANS | tier1 | 8 | Service Owner |
| SVC-006 | SVC_LEDGER | tier1 | 7 | Service Owner |
| SVC-007 | SVC_OFFLINE_SYNC | tier1 | **15** | Operations Lead |
| SVC-008 | SVC_PAYMENTS_MOMO | tier1 | 16 | Service Owner |
| SVC-009 | SVC_RECEIPTS | tier2 | 17 | Service Owner |
| SVC-010 | SVC_JOBS_QUEUE | tier2 | 18 | Operations Lead |
| SVC-011 | SVC_MONITORING | tier1 | **19** | Operations Lead |
| SVC-012 | SVC_API_GATEWAY | tier2 | 20 | Service Owner |
| SVC-013 | SVC_BACKUP_DR | tier1 | **21** | Operations Lead |
| SVC-014 | SVC_SECURITY_OPS | tier1 | 22 | Incident Manager |
| SVC-015 | SVC_REPORTING_BI | tier2 | 11 | Service Owner |
| SVC-016 | SVC_AI_ADVISORY | tier3 | 29 | Service Owner |
| SVC-017 | SVC_PLATFORM_GOV | tier2 | **30** | Operations Lead |
| SVC-018 | SVC_SERVICE_DESK | tier2 | 23 | Service Desk Manager |

Exactly **one** `accountableAuthority` per service.

---

## 2. Incident Severity / SLA Registry

| ID | Severity | Response | Resolve | Escalate |
|----|----------|---------:|--------:|---------:|
| SEV-001 | critical | 15m | 240m | 30m |
| SEV-002 | high | 30m | 480m | 60m |
| SEV-003 | medium | 120m | 1440m | 240m |
| SEV-004 | low | 480m | 4320m | 1440m |

---

## 3. Problem Type Registry

| ID | Type | RCA | Known error | CAPA |
|----|------|:---:|:-----------:|:----:|
| PRB-001 | recurring_incident | yes | yes | yes |
| PRB-002 | known_error | yes | yes | no |
| PRB-003 | capacity | yes | yes | yes |
| PRB-004 | sync_conflict_pattern | yes | yes | yes |
| PRB-005 | security | yes | no | yes |
| PRB-006 | data_integrity | yes | no | yes |
| PRB-007 | performance | yes | yes | yes |

---

## 4. Service Request Type Registry

| ID | Category | Approval | Target hours |
|----|----------|:--------:|-------------:|
| SRT-001 | account | yes | 24 |
| SRT-002 | password_reset | no | 2 |
| SRT-003 | permission | yes | 24 |
| SRT-004 | branch_config | yes | 48 |
| SRT-005 | report | yes | 48 |
| SRT-006 | integration | yes | 72 |
| SRT-007 | training | no | 120 |
| SRT-008 | device | yes | 8 |

---

## 5. Knowledge Registry

| ID | Title | State | Runbooks |
|----|-------|-------|----------|
| KB-001 | Collector offline collection | published | RB-010, RB-011 |
| KB-002 | Retry failed sync | published | RB-010 |
| KB-003 | Password reset | published | — |
| KB-004 | Major incident comms | published | RB-008 |
| KB-005 | EOD sync reminder | published | RB-012 |
| KB-006 | Financial conflict — no LWW | published | RB-011 |

---

## 6. Runbook Registry

| ID | Name | Offline |
|----|------|:-------:|
| RB-001 | Application restart | no |
| RB-002 | Database recovery | no |
| RB-003 | Backup verification | no |
| RB-004 | Failover / failback | no |
| RB-005 | Queue recovery | yes |
| RB-006 | Certificate renewal | no |
| RB-007 | Security IR | no |
| RB-008 | Perf degradation | no |
| RB-009 | Scheduled maintenance | no |
| RB-010 | Offline sync recovery | yes |
| RB-011 | Sync conflict resolution | yes |
| RB-012 | EOD collector sync | yes |

Each entry includes preconditions, steps, validation, rollback, successCriteria in the registry.

---

## 7. Ops KPI Registry

| ID | Code | Warn | Crit | Freq |
|----|------|-----:|-----:|------|
| OKPI-001 | MTTA | 20 | 45 | daily |
| OKPI-002 | MTTRsp | 30 | 60 | daily |
| OKPI-003 | MTTR | 480 | 1440 | weekly |
| OKPI-004 | FCR | 70 | 55 | weekly |
| OKPI-005 | Reopen | 8 | 15 | weekly |
| OKPI-006 | Problem recurrence | 20 | 35 | monthly |
| OKPI-007 | SLA compliance | 95 | 90 | weekly |
| OKPI-008 | Availability | 99.5 | 99.0 | daily |
| OKPI-009 | Backlog | 25 | 50 | daily |
| OKPI-010 | CSAT | 4.0 | 3.5 | monthly |

---

## 8. Offline Modes · Retry · Escalation · Collector Status

### Offline modes (5)

OM-001 Online · OM-002 Offline · OM-003 Synchronizing · OM-004 Recovery · OM-005 ReadOnly

### Retry policies (5)

RETRY-001…005 (network, busy, validation, conflict hold, revoked)

### Escalation (5)

| ID | Threshold | To |
|----|-----------|----|
| ESC-001 | ≥4h offline | Branch Supervisor |
| ESC-002 | ≥24h offline | Regional Operations |
| ESC-003 | queue >1000 | Operations Lead |
| ESC-004 | success <99% | Operations Lead |
| ESC-005 | conflicts ≥25 | Problem Manager |

### Collector statuses (6) — CSM-001…006

Online · Offline · Synchronizing · SyncFailed · ReadOnly · PoorNetwork

### Decision flows (7)

DF-001 start_of_day · DF-002 transaction · DF-003 sync · DF-004 conflict · DF-005 eod · DF-006 device_replacement · DF-007 escalation

---

## 9. Operations Governance Registry

| ID | Topic | Accountable |
|----|-------|-------------|
| OGOV-001 | ownership | Service Owner |
| OGOV-002 | major incident | Incident Manager |
| OGOV-003 | non-redefine | CIO |
| OGOV-004 | sync escalation | Operations Lead |
| OGOV-005 | money invariants | Operations Lead |
| OGOV-006 | on-call | Operations Lead |

---

## 10. Cross-reference (summary)

| Consume / protect | EOSSMS stance |
|-------------------|---------------|
| Phase 13 MET/SLO/dashboards | Consumed — not redefined |
| Phase 14 deploy | Consumed by runbooks |
| Phase 15 RPO/RTO | Consumed by RB-002/004 |
| Phase 16 testing | Consumed — not loosened |
| Phase 17 capacity | Consumed by RB-008 |
| Module 15 sync | Referenced — **not replaced** |
| Module 19 monitoring | Referenced — **not replaced** |
| Module 21 backup | Referenced — **not replaced** |
| Module 30 platform | Referenced — **not replaced** |
| Money invariants | pesewas · interest 15 · days 31 · cashier 1000 |
