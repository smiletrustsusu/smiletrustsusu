# MIB Catalogs — Master Implementation Backlog summaries

**Registry:** `src/core/master-backlog-registry.js`  
**Waves:** `src/core/master-backlog-waves.js` · **User delivery:** `src/core/master-backlog-delivery-waves.js`  
**Primary doc:** [`master-implementation-backlog.md`](./master-implementation-backlog.md)  
**Baseline:** [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md)  
**Reconciled backlog:** [`backlog/`](./backlog/)  
**Version:** 1.1.0 · **Date:** 2026-09-17

Counts below match `backlogCountsByType()` / `backlogStatusSummary()` after audit reconciliation.

---

## 1. Counts by type

| Type | Count |
|------|------:|
| PRG | 1 |
| PH | 20 |
| MOD | 30 |
| EPC | 81 |
| FEAT | 187 |
| USR | 180 |
| TASK | 202 |
| SUB | 15 |
| TEST | 7 |
| BUG | 4 |
| RISK | 2 |
| CR | 3 |
| REL | 2 |
| **Total** | **734** |

**Scale targets:** Epics 60–120 ✓ · Features 150–300 ✓ · USR+TASK 200–400 ✓ (382)

**Delta vs 1.0.0 (698):** +36 items (audit reconciliation epic/features + 27 gap items + TEST + Cancelled obsolete).

---

## 2. Status rollup (canonical)

| Status | Count |
|--------|------:|
| Completed | 428 |
| Planned | 271 |
| In Progress | 14 |
| Ready | 7 |
| Blocked | 5 |
| Deferred | 8 |
| Cancelled | 1 |
| **Total** | **734** |

| Bucket | Count | Notes |
|--------|------:|-------|
| Completed (released-like) | 428 | Was ~426 released-like under legacy enums |
| Open (non-Cancelled) | 305 | Includes Ready / Blocked / Planned / Deferred / In Progress |
| Cancelled | 1 | Obsolete Wave restart |
| **Total** | **734** | |

Legacy aliases remain accepted by validators; `buildBacklogItem` normalizes to the canonical set.

---

## 3. Implementation waves (MIB EPC stream 1–20)

| Wave | Code | Title | Priority | Primary modules | Primary phases |
|-----:|------|-------|----------|-----------------|----------------|
| 1 | FOUNDATION | Foundation | Critical | 14, 30 | 1, 2, 10 |
| 2 | AUTH_RBAC | Auth & RBAC | Critical | 1 | 1, 9 |
| 3 | TENANT_BRANCH | Tenant & Branch | Critical | 5, 30 | 3, 8 |
| 4 | DATABASE | Database | Critical | 14, 30 | 7 |
| 5 | CORE_APIS | Core APIs | Critical | 20 | 6 |
| 6 | SYNC_ENGINE | Sync Engine | Critical | 15 | 5, 14 |
| 7 | CUSTOMER | Customer | High | 3 | 3 |
| 8 | SAVINGS | Savings | Critical | 6, 7 | 3, 4, 16 |
| 9 | DAILY_COLLECTIONS | Daily Collections | Critical | 4, 6 | 3, 16 |
| 10 | LOANS | Loans | Critical | 8 | 3, 4, 16 |
| 11 | ACCOUNTING | Accounting | Critical | 10 | 3, 7, 16 |
| 12 | REPORTS | Reports | High | 11, 27 | 13, 17 |
| 13 | DASHBOARDS | Dashboards | High | 2 | 1, 13 |
| 14 | NOTIFICATIONS | Notifications | Medium | 12 | 5, 18 |
| 15 | MONITORING | Monitoring | High | 19 | 13, 18 |
| 16 | SECURITY | Security | Critical | 1, 22 | 9, 16 |
| 17 | AI | AI | Medium | 29 | 12, 16 |
| 18 | TESTING | Testing | Critical | 30 | 16 |
| 19 | DEPLOYMENT | Deployment | Critical | 21, 30 | 14, 15 |
| 20 | PRODUCTION_READINESS | Production Readiness | Critical | 30 | 19, 20 |

Each wave has **1 epic** + **3 features** + **6 USR/TASK** (plus occasional SUB on waves 1,5,9,13,17).

### User delivery waves (1–10)

See [`backlog/wave-execution-plan.md`](./backlog/wave-execution-plan.md). EIR WAVE-01…10 IDs unchanged.

---

## 4. Modules (MOD-001…030)

| ID | Module | Typical status | Owner |
|----|--------|----------------|-------|
| MOD-001 | Authentication & Session | Completed | Security Governance Lead |
| MOD-002 | Dashboard | Completed | Platform Administrator |
| MOD-003 | Customer CRM | Completed | Platform Administrator |
| MOD-004 | Agent & Collector Management | Completed | Platform Administrator |
| MOD-005 | Branch Management | Completed | Platform Administrator |
| MOD-006 | Individual Savings Collection | Completed | CIO |
| MOD-007 | Group Susu Management | Completed | CIO |
| MOD-008 | Loans | Completed | CIO |
| MOD-009 | Withdrawals & Savings Redemption | Completed | CIO |
| MOD-010 | Accounting & General Ledger | Completed | CIO |
| MOD-011 | Reports, Analytics & BI | Completed | Policy Owner |
| MOD-012 | Notification & Communication | Completed | Platform Administrator |
| MOD-013 | Audit Trail & Compliance | Completed | Compliance Officer |
| MOD-014 | System Administration & Configuration | Completed | Platform Administrator |
| MOD-015 | Offline Synchronization | Completed | Platform Administrator |
| MOD-016 | Mobile Money & Payment Gateway | Completed | CIO |
| MOD-017 | Receipt, Document & Statement | Completed | Platform Administrator |
| MOD-018 | Background Jobs, Queue & Scheduler | Completed | Platform Administrator |
| MOD-019 | Monitoring / Observability | Completed | Platform Administrator |
| MOD-020 | API Gateway & External Integration | Completed | CIO |
| MOD-021–030 | Platform / security / AI / program | Completed | (per baseline) |

Module anchors are **Completed** (framework present). Remaining audit gaps are separate TASK/BUG/CR items — see [`backlog/gap-register-reconciled.md`](./backlog/gap-register-reconciled.md).

---

## 5. Audit gap coverage

| Metric | Value |
|--------|------:|
| Gaps GAP-001…027 | 27 |
| Active backlog primaries | 27 |
| Cancelled obsolete | 1 |

Machine map: [`backlog/gap-backlog-map.json`](./backlog/gap-backlog-map.json).

---

## 6. Regeneration

```js
import { backlogCountsByType, backlogStatusSummary, listAuditGapMappings, validateMasterBacklog } from "../src/core/master-backlog-registry.js";
validateMasterBacklog(); // critical must be 0
backlogStatusSummary();
listAuditGapMappings();
```

---

*mib-catalogs.md v1.1.0 — 2026-09-17*
