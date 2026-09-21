# EMOOIS Catalogs (Phase 13 Companion Matrices)

**Parent:** [`enterprise-monitoring-observability.md`](./enterprise-monitoring-observability.md)  
**Registry:** `src/core/canonical-monitoring-registry.js`  
**Module 19 engine:** [`monitoring-engine.md`](./monitoring-engine.md), `src/core/monitoring-ops.js`  
**Version:** 1.0.0  
**Date:** 2026-09-14  

**Scope:** Monitoring / observability catalog only. Consumes Phases 1–12 + Modules 1–30. Does **not** redefine entities, APIs, DB schemas, security, AI governance, reporting, money math, or RBAC.

**Reality:** Vanilla JS SPA; in-process Module 20; Capacitor/Electron; localStorage + optional Supabase. Module **19** remains the operational engine.

**Counts (seed):** monitors=12, metrics=18, alerts=14, healthChecks=11, dashboards=8, traces=4, slis=8, slos=6, slas=3

---

## 1. Monitoring Registry

| ID | Code | Name | Domain | Owner | Engine |
|----|------|------|--------|-------|--------|
| MON-001 | SYS_OVERALL_HEALTH | System overall health | system | Platform Operations Lead | Module 19 `overallHealth` |
| MON-002 | API_GATEWAY_HEALTH | In-process API / gateway health | api | API Gateway Steward | Module 19 + Module 20 |
| MON-003 | COLLECTION_DAILY_VOLUME | Collection daily volume observation | business | Savings Operations | Module 19 `businessMetrics` |
| MON-004 | LOAN_REPAYMENT_KPI | Loan repayment KPI observation | business | Loan Operations | Module 19 + Module 27 observe |
| MON-005 | AI_ADVISORY_LATENCY | AI advisory model latency | ai | ML Ops Lead | Module 19 + Module 29 |
| MON-006 | MOMO_PROVIDER_HEALTH | MoMo / payment provider health | payment_provider | Integration Steward | Module 19 + Module 28 |
| MON-007 | SECURITY_FAILED_LOGINS | Failed login monitoring | security | Security Operations | Module 19 + Module 22 |
| MON-008 | DB_BACKUP_VERIFICATION | DB backup verification (governance) | backup | Backup Steward | Module 19 + Module 21 |
| MON-009 | SYNC_PIPELINE_HEALTH | Synchronization pipeline | synchronization | Sync Steward | Module 19 |
| MON-010 | QUEUE_WORKER_HEALTH | Job queue & worker health | queue | Job Engine Steward | Module 19 + Module 18 |
| MON-011 | ANDROID_DEVICE_HEALTH | Android device / offline health | android_device | Mobile Ops Lead | Module 19 |
| MON-012 | STORAGE_CAPACITY | Storage capacity monitor | storage | Platform Operations Lead | Module 19 |

---

## 2. Metric Registry

| ID | Code | Name | Unit | Class | Owner | Related modules |
|----|------|------|------|-------|-------|-----------------|
| MET-001 | API_AVAILABILITY_RATIO | API availability ratio | ratio | high | API Gateway Steward | 19, 20 |
| MET-002 | API_ERROR_PCT | API error percentage | ratio | high | API Gateway Steward | 19, 20 |
| MET-003 | API_LATENCY_P95_MS | API latency p95 | ms | high | API Gateway Steward | 19, 20 |
| MET-004 | COLLECTIONS_TODAY_COUNT | Collections posted today (count) | count | business | Savings Operations | 6, 19, 27 |
| MET-005 | COLLECTION_POST_SUCCESS_RATIO | Collection posting success ratio | ratio | business | Savings Operations | 6, 19 |
| MET-006 | LOAN_REPAYMENT_RATE | Loan repayment rate (observe) | ratio | business | Loan Operations | 8, 19, 27 |
| MET-007 | LOAN_DPD_BUCKET_COUNT | Loans by DPD bucket count | count | business | Loan Operations | 8, 19, 27 |
| MET-008 | AI_INFERENCE_LATENCY_P95_MS | AI advisory inference latency p95 | ms | high | ML Ops Lead | 29, 19 |
| MET-009 | AI_INFERENCE_ERROR_COUNT | AI inference error count | count | high | ML Ops Lead | 29, 19 |
| MET-010 | MOMO_PROVIDER_UP | MoMo provider up flag | bool | critical | Integration Steward | 28, 16, 19 |
| MET-011 | PROVIDERS_DOWN_COUNT | Payment/integration providers down | count | critical | Integration Steward | 28, 16, 19 |
| MET-012 | FAILED_LOGIN_COUNT | Failed login attempts | count | high | Security Operations | 22, 1, 19 |
| MET-013 | SECURITY_FINDINGS_COUNT | Security findings | count | critical | Security Operations | 22, 19 |
| MET-014 | BACKUP_FAILED_FLAG | Backup verification failed | bool | critical | Backup Steward | 21, 19 |
| MET-015 | SYNC_FAILURE_COUNT | Sync failures | count | high | Sync Steward | 19 |
| MET-016 | QUEUE_DEPTH | Job queue depth | count | high | Job Engine Steward | 18, 19 |
| MET-017 | STORAGE_USED_PCT | Storage used percent | ratio | standard | Platform Operations Lead | 19 |
| MET-018 | PLATFORM_HEALTH_SCORE | Platform overall health score | score | critical | Platform Operations Lead | 19, 30 |

---

## 3. Alert Registry

| ID | Code | Name | Severity | Metric IDs | Owner | Module 19 rule affinity |
|----|------|------|----------|------------|-------|-------------------------|
| ALT-001 | API_HIGH_ERROR_RATE | High API error rate | major | MET-002 | API Gateway Steward | `rule-error-rate` |
| ALT-002 | API_AVAILABILITY_BREACH | API availability SLO burn | major | MET-001 | API Gateway Steward | api domain |
| ALT-003 | COLLECTION_VOLUME_ANOMALY | Collection daily volume anomaly | warning | MET-004 | Savings Operations | business |
| ALT-004 | COLLECTION_POST_HEALTH | Collection posting health degraded | major | MET-005 | Savings Operations | observe-only |
| ALT-005 | LOAN_REPAYMENT_KPI_DROP | Loan repayment KPI drop | warning | MET-006 | Loan Operations | business |
| ALT-006 | AI_LATENCY_BUDGET | AI advisory latency budget exceeded | warning | MET-008 | ML Ops Lead | ai |
| ALT-007 | MOMO_PROVIDER_OUTAGE | MoMo / payment provider outage | critical | MET-010, MET-011 | Integration Steward | `rule-payment-down` |
| ALT-008 | FAILED_LOGIN_SPIKE | Failed login spike | major | MET-012 | Security Operations | security |
| ALT-009 | SECURITY_FINDING | Security risk finding | critical | MET-013 | Security Operations | `rule-security` |
| ALT-010 | BACKUP_VERIFY_FAIL | Backup verification failure | major | MET-014 | Backup Steward | `rule-backup-fail` |
| ALT-011 | SYNC_FAILURES | Synchronization failures | major | MET-015 | Sync Steward | `rule-sync-fail` |
| ALT-012 | QUEUE_BACKLOG | Queue backlog | major | MET-016 | Job Engine Steward | `rule-queue-backlog` |
| ALT-013 | STORAGE_CRITICAL | Storage capacity critical | critical | MET-017 | Platform Operations Lead | `rule-storage` |
| ALT-014 | PLATFORM_UPTIME_BURN | Platform uptime SLO burn | major | MET-018 | Platform Operations Lead | system |

---

## 4. HealthCheck Registry

| ID | Code | Domain | Interval ms | Timeout ms | Severity | Owner |
|----|------|--------|------------:|-----------:|----------|-------|
| HC-001 | HC_API_GATEWAY | api | 60000 | 5000 | major | API Gateway Steward |
| HC-002 | HC_SYSTEM_SCORE | system | 30000 | 3000 | critical | Platform Operations Lead |
| HC-003 | HC_PAYMENT_MOMO | payment_provider | 30000 | 8000 | critical | Integration Steward |
| HC-004 | HC_INTEGRATION_HUB | service | 60000 | 8000 | major | Integration Steward |
| HC-005 | HC_SYNC_ENGINE | synchronization | 60000 | 5000 | major | Sync Steward |
| HC-006 | HC_QUEUE_WORKER | queue | 60000 | 5000 | major | Job Engine Steward |
| HC-007 | HC_STORAGE | storage | 300000 | 5000 | critical | Platform Operations Lead |
| HC-008 | HC_BACKUP_VERIFY | backup | 3600000 | 30000 | major | Backup Steward |
| HC-009 | HC_SECURITY_AUTH | security | 60000 | 5000 | critical | Security Operations |
| HC-010 | HC_AI_ADVISORY | ai | 300000 | 10000 | warning | ML Ops Lead |
| HC-011 | HC_ANDROID_INTEGRITY | android_device | 86400000 | 15000 | critical | Mobile Ops Lead |

All checks execute via Module 19 `collectHealthSnapshot` / domain scoring — catalog only.

---

## 5. Dashboard Registry

| ID | Code | Name | Owner | Surface |
|----|------|------|-------|---------|
| DASH-001 | DASH_SYSTEM_HEALTH | System health strip | Platform Operations Lead | Module 19 extras (existing dashboard) |
| DASH-002 | DASH_ALERTS_INCIDENTS | Alerts & incidents | Platform Operations Lead | Monitoring extras |
| DASH-003 | DASH_DEVICES_OFFLINE | Devices & offline readiness | Mobile Ops Lead | Monitoring extras |
| DASH-004 | DASH_INTEGRATION_MOMO | Integration & MoMo health | Integration Steward | Reports / Integration extras |
| DASH-005 | DASH_AI_ADVISORY | AI advisory latency | ML Ops Lead | AI / Monitoring extras |
| DASH-006 | DASH_BUSINESS_VOLUME | Business volume observation | Savings Operations | Monitoring business metrics |
| DASH-007 | DASH_SECURITY | Security findings & logins | Security Operations | Monitoring security report |
| DASH-008 | DASH_SYNC_QUEUE | Sync & queue depth | Sync Steward | Monitoring sync report |

**No new top-level navigation.**

---

## 6. Trace / Correlation Standards Registry

| ID | Code | Name | Standard | Owner |
|----|------|------|----------|-------|
| TRC-001 | TRACE_REQUEST_PATH | Request path trace | `traceId` UUID lowercase; spans via Module 19 | Platform Operations Lead |
| TRC-002 | TRACE_CORRELATION_UUID | Operational correlation id | UUID lowercase; UTC timestamps | Platform Operations Lead |
| TRC-003 | TRACE_EVENT_ENVELOPE | ECECMS event correlation | Phase 5 envelope `correlationId` | Event Steward |
| TRC-004 | TRACE_AI_GOVERNANCE_CORR | AI governance correlation | Phase 12 `CORR-*` for envelopes (scope-limited) | ML Ops Lead |

---

## 7. SLI Catalog

| ID | Code | Name | Metric | Window | Owner |
|----|------|------|--------|--------|-------|
| SLI-001 | SLI_API_AVAILABILITY | API availability | MET-001 | 30d | API Gateway Steward |
| SLI-002 | SLI_API_LATENCY_P95 | API latency p95 | MET-003 | 7d | API Gateway Steward |
| SLI-003 | SLI_COLLECTION_POST_HEALTH | Collection posting health | MET-005 | 7d | Savings Operations |
| SLI-004 | SLI_PLATFORM_UPTIME | Platform uptime (health score) | MET-018 | 30d | Platform Operations Lead |
| SLI-005 | SLI_MOMO_PROVIDER | MoMo provider health | MET-010 | 7d | Integration Steward |
| SLI-006 | SLI_AI_LATENCY | AI advisory latency | MET-008 | 7d | ML Ops Lead |
| SLI-007 | SLI_SYNC_SUCCESS | Sync success | MET-015 (inverse) | 7d | Sync Steward |
| SLI-008 | SLI_BACKUP_SUCCESS | Backup verification success | MET-014 (inverse) | 30d | Backup Steward |

---

## 8. SLO Catalog

| ID | Code | Name | SLI | Target | Window | Owner |
|----|------|------|-----|--------|--------|-------|
| SLO-001 | SLO_API_AVAILABILITY | API availability | SLI-001 | ≥ 99.5% | 30d | API Gateway Steward |
| SLO-002 | SLO_COLLECTION_POST_HEALTH | Collection posting health (observe) | SLI-003 | ≥ 99.0% | 7d | Savings Operations |
| SLO-003 | SLO_PLATFORM_UPTIME | Platform uptime | SLI-004 | ≥ 99.0% health-equivalent | 30d | Platform Operations Lead |
| SLO-004 | SLO_MOMO_HEALTH | MoMo provider health | SLI-005 | ≥ 99.0% up checks | 7d | Integration Steward |
| SLO-005 | SLO_AI_LATENCY | AI advisory p95 latency | SLI-006 | ≤ 2000 ms | 7d | ML Ops Lead |
| SLO-006 | SLO_API_LATENCY | API p95 latency | SLI-002 | ≤ 500 ms | 7d | API Gateway Steward |

SLO-002 **observes** posting health only — does not alter posting logic.

---

## 9. SLA Catalog (governance-level)

| ID | Code | Name | SLO refs | Audience | Owner |
|----|------|------|----------|----------|-------|
| SLA-001 | SLA_PLATFORM_OPS | Platform operational commitment | SLO-001, SLO-003 | Internal ops | Platform Operations Lead |
| SLA-002 | SLA_INTEGRATION_MOMO | Integration / MoMo ops commitment | SLO-004 | Payments / Integration | Integration Steward |
| SLA-003 | SLA_COLLECTION_OBSERVE | Collection channel observe commitment | SLO-002 | Savings ops (observe) | Savings Operations |

---

## 10. Ownership matrix (single owner)

| Owner | Catalog objects |
|-------|-----------------|
| Platform Operations Lead | MON-001, MON-012, MET-017, MET-018, ALT-013, ALT-014, HC-002, HC-007, DASH-001, DASH-002, TRC-001, TRC-002, SLI-004, SLO-003, SLA-001 |
| API Gateway Steward | MON-002, MET-001–003, ALT-001–002, HC-001, SLI-001–002, SLO-001, SLO-006 |
| Savings Operations | MON-003, MET-004–005, ALT-003–004, DASH-006, SLI-003, SLO-002, SLA-003 |
| Loan Operations | MON-004, MET-006–007, ALT-005 |
| ML Ops Lead | MON-005, MET-008–009, ALT-006, HC-010, DASH-005, TRC-004, SLI-006, SLO-005 |
| Integration Steward | MON-006, MET-010–011, ALT-007, HC-003–004, DASH-004, SLI-005, SLO-004, SLA-002 |
| Security Operations | MON-007, MET-012–013, ALT-008–009, HC-009, DASH-007 |
| Backup Steward | MON-008, MET-014, ALT-010, HC-008, SLI-008 |
| Sync Steward | MON-009, MET-015, ALT-011, HC-005, DASH-008, SLI-007 |
| Job Engine Steward | MON-010, MET-016, ALT-012, HC-006 |
| Mobile Ops Lead | MON-011, HC-011, DASH-003 |
| Event Steward | TRC-003 |

---

## 11. Cross-reference — Phases 1–12

| Phase | Artifact | EMOOIS link |
|------:|----------|-------------|
| 1 | EMAS / emas-matrices | Module 19 observability ownership |
| 2 | Consistency / governance | Change control for catalog IDs |
| 3 | ECDM | Soft entity refs only |
| 4 | ECSMLS | Incident/alert lifecycle already in Module 19 |
| 5 | ECECMS | Correlation on event envelopes; TRC-003 |
| 6 | ECACIS | API health observe; facades non-live |
| 7 | ECDAPS | Backup/DB tables; HC-008 governance |
| 8–11 | Config / BI / Integration / Platform | Metrics observe Module 27–28–30 |
| 12 | EAIADIS | AI latency MET-008/009; advisory only |

---

## 12. Cross-reference — Modules 1–30 (esp. 19)

| Module | Role in EMOOIS |
|-------:|----------------|
| 1 | Auth / identity signals for failed logins |
| 6 | Collection volume / posting health observation |
| 8 | Loan repayment KPI observation |
| 13 | Audit of monitoring configuration |
| 16 | Payment provider dashboards read by Module 19 |
| 18 | Queue/worker health + `health_snapshot` job |
| **19** | **Operational engine** — sole runtime for health/alerts/traces |
| 20 | In-process gateway latency/error signals |
| 21 | Backup verification domain |
| 22 | Security findings / incidents |
| 27 | BI KPI formulas remain authoritative; EMOOIS observes |
| 28 | MoMo / integration provider health |
| 29 | AI advisory inference latency |
| 30 | Platform hosting; not catalog owner for AI/monitor IDs |

---

## 13. Input & Dependency Rules (summary)

See parent §3. Normative: D1 single owner; D2 no orphan alert→metric; D3 HC interval/timeout/severity; D4 Module 19 engine not replaced; D5 collection observe-only; D8 UUID lowercase + UTC.
