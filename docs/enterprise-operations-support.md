# Enterprise Operations, Support & Service Management Specification (EOSSMS) — Phase 18

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 18 — Authoritative Operations / Support / Service Management Catalog  
**Status:** Authoritative for Phase 18 service catalog, service desk, incident/problem/request management, knowledge, runbooks, ops KPIs, on-call, offline/sync support procedures, and governance  
**Version:** 1.0.0  
**Date:** 2026-09-15  
**Monitoring / dashboards (consume):** **Phase 13** (`canonical-monitoring-registry.js`, Module 19) — **not redefined**  
**Deployment (consume):** **Phase 14** — **not redefined**  
**BCDR (consume):** **Phase 15** — **not redefined**  
**Testing (consume):** **Phase 16** — **not redefined**  
**Performance (consume):** **Phase 17** — **not redefined**  
**Offline sync engine:** **Module 15** (`sync-ops.js`, `offline-queue.js`) — **not replaced**  
**Monitoring observe engine:** **Module 19** — **not replaced**  
**Backup engine:** **Module 21** — **not replaced**  
**Platform governance:** **Module 30** — **not replaced**  
**Machine registry:** `src/core/canonical-operations-registry.js`  
**SLA / sync helpers:** `src/core/phase18-ops-sla.js`  
**Companion matrices:** [`eossms-catalogs.md`](./eossms-catalogs.md)  
**Schemas:** [`schemas/operations/`](./schemas/operations/)  
**Downstream (consume):** Phase 19 EGCCRMS — [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md) may reference ops tickets for emergency change triggers; does **not** redefine EOSSMS.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EOSSMS |
| Accountable authority (catalog) | Service Owner / Service Desk Manager / Incident Manager / Operations Lead |
| Money posts | **Forbidden** for ops-catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** |
| Nav changes | **None** |
| RBAC rewrite | **None** |
| Phase 13–17 | **Consumed**, not redefined |
| Module 15 / 19 / 21 / 30 | **Referenced**, not replaced |

**Non-regression:** Phases 1–17 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, monitoring, deployment, BCDR, testing, and performance **standards**. Phase 18 defines **operations & support catalogs**, ITIL-aligned processes tailored to multi-branch Susu / collector Android APK, and offline/sync **support procedures** — only.

**Money invariants preserved:** amounts in **integer pesewas**; default interest **15%**; collection cycle **31 days**; cashier float limit **1000**. REST/OpenAPI in this specification means **in-process contract facades** only (no new HTTP servers). Web artifact path remains `prepare:web` → `www/`.

---

## 1. Purpose & scope

### 1.1 Purpose

EOSSMS is the **single authoritative catalog** for enterprise service management, service desk operations, incident/problem/request management, knowledge, operational runbooks, on-call, ops KPIs, and collector offline/sync support guidance for Smile Trust.

### 1.2 In scope

- Service catalog, portfolio, ownership, tiers, lifecycle, readiness  
- Service desk ticket lifecycle, classification, priority/severity, assignment, escalation, resolution, closure, customer communications  
- Incident SLAs (response/resolve) by severity; major incident command & PIR  
- Problem management (RCA, known errors, CAPA, trends)  
- Service request types with approval + fulfillment targets  
- Knowledge lifecycle  
- Operational runbooks (incl. offline/sync)  
- On-call operations  
- Ops KPIs (MTTA, MTTRsp, MTTR, FCR, reopen, problem recurrence, SLA compliance, availability, backlog, CSAT)  
- Governance  
- Cross-reference Modules 1–30 × Phases 1–17  
- Appendices A–C: offline/sync procedures, collector status guidance, decision flows  

### 1.3 Out of scope

- Redefining Phases 13–17 catalogs or Module engines  
- Replacing Module 15 sync, Module 19 monitoring, Module 21 backup, Module 30 platform  
- Next.js/Flutter rewrite, real HTTP servers, new top-level nav  

### 1.4 Input & Dependency Rules

1. **Phase 13 EMOOIS** owns MET/SLO/ALT and dashboard **observe** cadence — EOSSMS **consumes** refresh schedule (device/offline & sync panels **60s**; operational strip **30s**; business volume **5m**).  
2. **Phase 14 EDDIES** owns env/pipeline — runbooks **reference** deploy windows; do not redefine.  
3. **Phase 15 EBCBDRS** owns RPO/RTO — DB recovery / failover runbooks **consume** budgets.  
4. **Phase 16 ETQAVS** owns quality gates — ops does not loosen test thresholds.  
5. **Phase 17 EPSCMS** owns capacity/benchmarks — perf degradation runbook **consumes** RTHR/CAP.  
6. **Module 15** owns offline queue processing (`processSyncQueue`, conflict strategies) — EOSSMS documents **support procedures** only.  
7. Financial sync **never** last-write-wins / client-wins; amounts remain **pesewas**.  

---

## 2. Service management framework

| Concern | Standard |
|---------|----------|
| Catalog | `SVC-*` entries in registry — one owner each |
| Portfolio | platform · business · finance · integration · analytics · security · intelligence · support |
| Tiers | tier1_critical · tier2_core · tier3_supporting · tier4_optional |
| Lifecycle | proposed → chartered → active → deprecated → retired |
| Readiness | production_ready (seed) |
| Ownership | Exactly one `accountableAuthority` per service |

Seed services include Auth, Members, Savings, Collections, Loans, Ledger, **Offline Sync (Module 15)**, MoMo, Receipts, Jobs, Monitoring, API Gateway, Backup/DR, Security Ops, Reporting/BI, AI Advisory, Platform Gov, Service Desk.

---

## 3. Service desk

### 3.1 Ticket lifecycle

`new → classified → assigned → in_progress → (pending_customer|pending_vendor) → resolved → closed` with optional `reopened`.

### 3.2 Classification

| Class | Use |
|-------|-----|
| Incident | Unplanned interruption / degradation |
| Major incident | SEV-001 or multi-branch SEV-002 with command bridge |
| Service request | Standard change / fulfillment (route to SRT-*) |
| Problem candidate | Recurring / unknown underlying cause → Problem Manager |

### 3.3 Priority / severity

Mapped to `SEV-001…004` (critical/high/medium/low). Priority may combine impact × urgency operationally; **SLA clocks** follow severity.

### 3.4 Assignment & escalation

L1 Service Desk → L2 On-Call / Ops → L3 specialist / vendor → Major Incident Manager. Sync escalations also follow **ESC-001…005** (Appendix A).

### 3.5 Resolution & closure

Resolution requires validation steps from linked runbook where applicable. Closure after customer confirmation or policy timeout. Reopen increments OKPI-005.

### 3.6 Customer communications

Cadence by severity (SEV-001: 30m, SEV-002: 60m, SEV-003: 4h, SEV-004: daily). Channels: in-app, SMS, email, voice, branch.

---

## 4. Incident management & SLAs

| ID | Severity | Response | Resolve | Escalate | Major eligible |
|----|----------|---------:|--------:|---------:|:--------------:|
| SEV-001 | critical | 15m | 4h (240m) | 30m | yes |
| SEV-002 | high | 30m | 8h (480m) | 60m | yes |
| SEV-003 | medium | 2h | 24h | 4h | no |
| SEV-004 | low | 8h | 72h | 24h | no |

Helpers: `evaluateIncidentSla` in `phase18-ops-sla.js`.

---

## 5. Major incident management

1. **Declaration:** Incident Manager (or Ops Lead acting) for SEV-001 / multi-branch SEV-002.  
2. **Command:** Single Incident Commander; bridge channel; scribe.  
3. **Communications:** Use KB-004 template; cadence per SEV.  
4. **Technical:** Invoke runbooks (RB-001…012) without replacing Module engines.  
5. **PIR:** Within 5 business days; feed Problem (PRB-*) and CAPA.  

---

## 6. Problem management

| Type | RCA | Known error | CAPA |
|------|:---:|:-----------:|:----:|
| Recurring incident | yes | yes | yes |
| Known error | yes | yes | optional |
| Capacity | yes | yes | yes |
| Sync conflict pattern | yes | yes | yes |
| Security | yes | no | yes |
| Data integrity | yes | no | yes |
| Performance | yes | yes | yes |

Trends reviewed monthly (OKPI-006). Sync conflict patterns **reference** Module 15 strategies — never invent LWW for financial kinds.

---

## 7. Service request management

| ID | Category | Approval | Target |
|----|----------|:--------:|-------:|
| SRT-001 | account | yes | 24h |
| SRT-002 | password_reset | no | 2h |
| SRT-003 | permission | yes | 24h |
| SRT-004 | branch_config | yes | 48h |
| SRT-005 | report | yes | 48h |
| SRT-006 | integration | yes | 72h |
| SRT-007 | training | no | 120h |
| SRT-008 | device | yes | 8h |

Permission requests **fulfill existing roles** — EOSSMS does not rewrite RBAC.

---

## 8. Knowledge management lifecycle

`draft → reviewed → published → archived`. Seed articles: collector offline, sync retry, password reset, major incident comms, EOD reminder, financial conflict (no LWW). Each published article links related runbooks where applicable.

---

## 9. Operational runbooks catalog

Each runbook records **preconditions, steps, validation, rollback, success criteria**.

| ID | Name | Offline scenario |
|----|------|:----------------:|
| RB-001 | Application restart | no |
| RB-002 | Database recovery | no |
| RB-003 | Backup verification | no |
| RB-004 | Failover / failback | no |
| RB-005 | Queue recovery | **yes** |
| RB-006 | Certificate renewal | no |
| RB-007 | Security incident response | no |
| RB-008 | Performance degradation | no |
| RB-009 | Scheduled maintenance | no |
| RB-010 | Offline sync recovery | **yes** |
| RB-011 | Sync conflict resolution | **yes** |
| RB-012 | End-of-day collector sync | **yes** |

RB-002/004 **consume** Phase 15 RPO/RTO. RB-008 **consumes** Phase 13 SLO / Phase 17 RTHR. RB-010…012 **reference** Module 15 — do not replace `sync-ops.js`.

---

## 10. On-call operations

- Primary + secondary rotation; handoff checklist.  
- Page on SEV-001/002 and ESC-003/004.  
- Major incident bridge when declared (OGOV-002).  
- Observe Module 19 alerts; dashboard refresh per Phase 13 consume (sync/device **60s**).  

---

## 11. Operational KPIs

| ID | KPI | Formula (summary) | Warn | Crit | Freq | Direction |
|----|-----|-------------------|-----:|-----:|------|-----------|
| OKPI-001 | MTTA | avg(ack − create) | 20m | 45m | daily | lower |
| OKPI-002 | MTTRsp | avg(firstResponse − create) | 30m | 60m | daily | lower |
| OKPI-003 | MTTR | avg(resolve − create) | 480m | 1440m | weekly | lower |
| OKPI-004 | FCR | first-contact resolves / closed | 70% | 55% | weekly | higher |
| OKPI-005 | Reopen rate | reopened / closed | 8% | 15% | weekly | lower |
| OKPI-006 | Problem recurrence | repeat problems / open | 20% | 35% | monthly | lower |
| OKPI-007 | SLA compliance | met / total | 95% | 90% | weekly | higher |
| OKPI-008 | Availability | uptime % (consume SLO-001) | 99.5% | 99.0% | daily | higher |
| OKPI-009 | Backlog | open >7d count | 25 | 50 | daily | lower |
| OKPI-010 | CSAT | avg 1–5 | 4.0 | 3.5 | monthly | higher |

---

## 12. Governance

| ID | Topic | Rule |
|----|-------|------|
| OGOV-001 | Ownership | One accountableAuthority per catalog entry |
| OGOV-002 | Major incident | Declaration + PIR required |
| OGOV-003 | Non-redefine | Phases 13–17 / Modules 15/19/21/30 protected |
| OGOV-004 | Sync escalation | 4h branch · 24h regional · queue>1000 · success<99% |
| OGOV-005 | Money invariants | pesewas · interest 15 · days 31 · cashier 1000; no financial LWW |
| OGOV-006 | On-call | Primary/secondary + handoff |

Audit authority remains separated from accountable authority (SoD).

---

## 13. Cross-reference matrix (Modules 1–30 × Phases 1–17)

| Module / Phase | EOSSMS relationship |
|----------------|---------------------|
| M1 Auth | SVC-001; password/device requests |
| M2 Dashboard | Observe only; no new nav |
| M3 Members | SVC-002 |
| M5–6 Savings/Collections | SVC-003/004; offline collections; pesewas / day 31 / cashier 1000 |
| M7 Ledger | SVC-006; RB-002 |
| M8 Loans | SVC-005; interest 15 via M27 |
| M11 Reporting | SVC-015; SRT-005 |
| M14 Config | SRT-004; no config rewrite |
| **M15 Offline Sync** | **SVC-007; Appendices A–C; RB-010…012 — engine not replaced** |
| M16 MoMo | SVC-008 |
| M17 Receipts | SVC-009; offline receipt mapping |
| M18 Jobs | SVC-010; RB-005 |
| **M19 Monitoring** | **SVC-011; Phase 13 dashboards consumed — not replaced** |
| M20/28 Gateway/Hub | SVC-012; SRT-006 |
| **M21 Backup** | **SVC-013; RB-002/003/004 — not replaced** |
| M22 Security | SVC-014; RB-007 |
| M23 Workflow/Cases | SVC-018 service desk linkage |
| M24/29 Rules/AI | Advisory only; SVC-016 |
| **M30 Platform** | **SVC-017 — not replaced** |
| Phase 9 Security | Consumed |
| Phase 12 AI | Advisory consume |
| Phase 13 Monitoring | **Consumed** (incl. dashboard refresh) |
| Phase 14 Deploy | Consumed by RB-001/006/009 |
| Phase 15 BCDR | Consumed by RB-002/003/004 |
| Phase 16 Testing | Consumed — not loosened |
| Phase 17 Performance | Consumed by RB-008 |

---

## 14. Acceptance criteria

1. Docs `enterprise-operations-support.md` + `eossms-catalogs.md` with Input & Dependency Rules + Appendices A–C  
2. Registry services/SLAs/problems/requests/knowledge/runbooks/KPIs/governance/offline/sync/collector/decision with list/get/validate  
3. `phase18-ops-sla.js` SLA / retry / escalation / status / EOD helpers  
4. Schemas on disk + valid/invalid examples + manifest SHA-256  
5. Tests green; `prepare:web` after src changes  
6. Phases 13–17 not redefined; Modules 15/19/21/30 not replaced  

---

## Appendix A: Offline & Synchronization Support Procedures

**Engine reference:** Module 15 — `src/core/sync-ops.js`, `src/sync/offline-queue.js`, [`offline-sync.md`](./offline-sync.md). EOSSMS does **not** replace ordering, idempotency, or conflict engines.

### A.1 Modes

| Mode | Meaning | Collector status |
|------|---------|------------------|
| Online | Connected; normal posting | Online |
| Offline | No connectivity; local enqueue allowed | Offline |
| Synchronizing | Ordered sync pass | Synchronizing |
| Recovery | Failure / retry / escalate | SyncFailed |
| ReadOnly | No new financial enqueue | ReadOnly |

### A.2 Transaction handling

- Offline collections allowed per Module 15 (`canPerformOffline`); high-risk ops blocked unless configured.  
- Amounts in **pesewas**; cashier float **1000**; collection cycle **31 days**.  
- Financial kinds **never** LWW / client-wins.  
- Device clocks are not sole ordering key (local sequence + server sequence).  

### A.3 Thirteen-stage sync workflow

1. authorize_device  
2. connectivity_check  
3. queue_snapshot  
4. validate_local  
5. conflict_prescan  
6. upload_batch  
7. server_ack  
8. apply_server  
9. download_deltas  
10. apply_local  
11. checkpoint  
12. reconcile  
13. session_close  

Support progress uses `getSyncWorkflowStage` (catalog helper). Runtime remains `processSyncQueue`.

### A.4 Failure handling & retry policy

| Policy | Max attempts | Backoff (s) | Notes |
|--------|-------------:|-------------|-------|
| RETRY-001 Transient network | 5 | 30…600 | Escalate after 4h |
| RETRY-002 Server busy | 8 | 60…3600 | Back-pressure |
| RETRY-003 Validation | 3 | 0…900 | Non-financial fixable |
| RETRY-004 Conflict hold | 0 | — | Sync.Resolve; no auto retry |
| RETRY-005 Device revoked | 0 | — | SRT-008 re-auth |

### A.5 Conflict resolution

Use Module 15 strategies (`server_wins`, `client_wins`, `merge`, `manual`, `business_rule`). **Financial → business_rule / manual only** — never client_wins or LWW. RB-011.

### A.6 Daily reconciliation

Branch signs daily reconcile after EOD sync (RB-012). Totals must match in pesewas; receipt temporary→permanent mapping intact.

### A.7 Offline runbooks

RB-005 Queue recovery · RB-010 Offline sync recovery · RB-011 Conflict · RB-012 EOD sync.

### A.8 Dashboard metrics (consume Phase 13)

Device/offline panel & sync health panel refresh **every 60 seconds** (Phase 13 consume). Track queueSize, failedCount, successPct, openConflicts, offline duration.

### A.9 Escalation thresholds

| ID | Trigger | Escalate to |
|----|---------|-------------|
| ESC-001 | Offline / unsynced ≥ **4h** | Branch Supervisor |
| ESC-002 | Offline / unsynced ≥ **24h** | Regional Operations |
| ESC-003 | Queue size **> 1000** | Operations Lead |
| ESC-004 | Sync success **< 99%** | Operations Lead |
| ESC-005 | Open conflicts ≥ 25 | Problem Manager |

### A.10 Machine-readable sync metadata fields

`syncEventId`, `deviceId`, `collectorId`, `branchId`, `tenantId`, `queueSize`, `counts` (pending/uploaded/applied/failed/conflicts), `timestamps`, `status`, `retryCount`, `correlationId`, optional `successPct`, `openConflicts`, `currentStage`, `retryPolicyId` — schema: `sync-event.schema.json`.

---

## Appendix B: Collector-Facing Offline Status Guidance

### B.1 Status indicator model (6 statuses)

| Status | Short label | Message (exact catalog text) |
|--------|-------------|------------------------------|
| Online | Online | You are online. Collections sync automatically when queued items remain. |
| Offline | Offline | You are offline. You may still collect (amounts in pesewas). Sync when network returns. Do not turn off the device until End of Day sync. |
| Synchronizing | Syncing | Synchronizing… Please keep the app open. Progress updates as batches upload and apply. |
| SyncFailed | Sync failed | Sync failed. Tap Retry. If it keeps failing, contact your Branch Supervisor. Do not delete the app or clear data. |
| ReadOnly | Read only | This device is read-only. You cannot post new collections. Contact Branch Supervisor. |
| PoorNetwork | Poor network | Network is poor. Prefer completing collections offline, then sync when signal improves. Avoid starting large sync on very weak signal. |

### B.2 Offline info panel fields

Offline: `offlineSince`, `pendingCount`, `queueSize`, `lastSuccessfulSyncAt`, `cashierFloatRemaining`.  
Syncing: `syncProgressPct`, `uploadedCount`, `appliedCount`, `failedCount`, `currentStage`.  
Failed: `lastErrorCode`, `retryCount`, `failedCount`, `queueSize`, `correlationId`.

### B.3 Warning thresholds by offline duration

**1h** warn collector · **4h** Branch Supervisor (ESC-001) · **24h** Regional Ops (ESC-002).

### B.4 Failure guidance

Confirm connectivity → Retry / Sync now → if revoked request SRT-008 → escalate ≥4h. Never delete app or clear data (risk losing offline queue).

### B.5 EOD reminder

KB-005 / RB-012: complete collections, sync to Online, or escalate. Keep device powered until sync or secure-offline path.

### B.6 Accessibility

Each status exposes `accessibilityLabel` (e.g. “Connection status: offline”). Color hints are supplemental — never sole indicator.

---

## Appendix C: Collector Decision Flow

### C.1 Start of day

| Condition | Outcome |
|-----------|---------|
| Device revoked / read-only | device_blocked |
| Offline ≥4h | escalate |
| Offline | work_offline |
| Online | go_online |

### C.2 Transaction

| Condition | Outcome |
|-----------|---------|
| Read-only / revoked | read_only_block |
| Offline + high-risk | block_high_risk |
| Offline | enqueue_offline |
| Online | post_online |

### C.3 Sync

| Condition | Outcome |
|-----------|---------|
| Revoked | escalate |
| Poor network / offline | defer_poor_network |
| Else with pending | start_sync / retry |

### C.4 Conflict

| Condition | Outcome |
|-----------|---------|
| Financial | manual_resolve |
| Non-financial conflict | auto_business_rule |
| Else | hold / open_problem |

### C.5 EOD

| Condition | Outcome |
|-----------|---------|
| Online + pending 0 | sync_complete |
| Online + pending >0 | start_sync |
| Offline ≥24h | open_incident (ESC-002) |
| Offline ≥4h | open_incident (ESC-001) |
| Offline + waive | partial_waive |
| Offline | secure_offline |

### C.6 Device replacement

revoke_old → authorize_new → transfer_queue (if recoverable) → escalate_loss if stolen/lost.

### C.7 Escalation table

See ESC-001…005 (Appendix A.9). Decision node DF-007 outcomes: branch · regional · ops_lead · major_incident.

### C.8 ASCII decision tree summary

```
START_OF_DAY
 ├─ revoked/readonly? → BLOCK
 ├─ offline ≥4h? → ESCALATE (branch+)
 ├─ offline? → WORK_OFFLINE → TRANSACTION(enqueue)
 └─ online? → GO_ONLINE → TRANSACTION(post)

TRANSACTION
 ├─ high-risk & offline? → BLOCK
 └─ else enqueue/post (pesewas; cashier≤1000)

SYNC
 ├─ poor/offline? → DEFER
 └─ Sync now → 13-stage workflow
      ├─ conflict financial? → MANUAL (no LWW)
      ├─ fail retry? → RETRY policy → ESC if 4h/24h/q>1000/<99%
      └─ success → ONLINE

EOD
 ├─ pending & online → SYNC
 ├─ offline ≥4h/24h → INCIDENT + escalate
 └─ else secure / complete reconcile
```

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 18 EOSSMS |
| 1.0.1 | 2026-09-15 | Cross-link Phase 19 EGCCRMS (governance may reference ops for emergency triggers; does not redefine) |
