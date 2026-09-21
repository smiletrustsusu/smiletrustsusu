# Enterprise Performance, Scalability & Capacity Management Specification (EPSCMS) — Phase 17

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 17 — Authoritative Performance / Scalability / Capacity Catalog  
**Status:** Authoritative for Phase 17 enterprise performance architecture, workload models, capacity plans, benchmarks, utilization thresholds, forecasts, and governance  
**Version:** 1.0.0  
**Date:** 2026-09-15  
**Monitoring / SLOs (consume):** **Phase 13** (`canonical-monitoring-registry.js`, Module 19) — **not redefined**  
**Performance test thresholds (consume):** **Phase 16** (`THR-040`…`THR-046`) — **not redefined**  
**Deployment / env (consume):** **Phase 14** — **not redefined**  
**BCDR (consume):** **Phase 15** — **not redefined**  
**Monitoring observe engine:** **Module 19** — **not replaced**  
**Job / queue engine:** **Module 18** — **not replaced**  
**Backup engine:** **Module 21** — **not replaced**  
**AI runtime:** **Module 29** — **not replaced**  
**Platform governance:** **Module 30** — **not replaced**  
**Machine registry:** `src/core/canonical-performance-registry.js`  
**Forecast / evaluation helpers:** `src/core/phase17-capacity-forecast.js`  
**Companion matrices:** [`epscms-catalogs.md`](./epscms-catalogs.md)  
**Schemas:** [`schemas/performance/`](./schemas/performance/)  
**Downstream (consume):** Phase 18 EOSSMS — [`enterprise-operations-support.md`](./enterprise-operations-support.md) consumes RTHR/CAP signals in perf degradation runbooks; does **not** redefine EPSCMS. Phase 19 EGCCRMS — [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md) may reference capacity evidence in release governance; does **not** redefine EPSCMS.

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EPSCMS |
| Accountable authority (catalog) | Performance Architect / Capacity Planner / SRE Lead |
| Money posts | **Forbidden** for capacity-catalog actions |
| Collection / loan / ledger rewrite | **Forbidden** |
| Nav changes | **None** |
| RBAC rewrite | **None** |
| Phase 13 | **Metrics / SLIs / SLOs / alerts** — consumed, not redefined |
| Phase 16 | **Perf test thresholds** — consumed, not redefined |
| Module 19 | **Monitoring engine** — referenced, not replaced |

**Non-regression:** Phases 1–16 and Modules 1–30 remain authoritative for entities, APIs, DB schemas, security, monitoring, deployment, BCDR, and testing **standards**. Phase 17 defines **capacity & scalability catalogs**, workload models, benchmark **targets aligned to Phase 16**, utilization bands, and forecasts — only.

**Money invariants preserved:** amounts in **integer pesewas**; default interest **15%**; collection cycle **31 days**; cashier float limit **1000**. REST/OpenAPI in this specification means **in-process contract facades** only (no new HTTP servers). Web artifact path remains `prepare:web` → `www/`.

---

## 1. Purpose & scope

### 1.1 Purpose

EPSCMS is the **single authoritative catalog** for enterprise performance architecture, workload modelling, capacity planning, scalability decisions, performance benchmarks, resource utilization thresholds, capacity forecasting, optimization standards, and performance governance for Smile Trust.

### 1.2 In scope

- Performance architecture dimensions (latency, throughput, concurrency, utilization, queues, cache, DB, storage, network)  
- Workload profiles: single-branch → nationwide + peak/batch scenarios  
- Capacity plans with current / forecast / trigger / max / upgrade strategy  
- Scalability strategy & decision criteria  
- Benchmarks for auth, savings, loans, collections, reports, dashboard, search, sync, AI, batch  
- Resource warning/critical thresholds  
- 12 / 24 / 36 month forecasts  
- Optimization standards & governance  
- Cross-reference Modules 1–30 × Phases 1–16  

### 1.3 Out of scope

- Redefining Phase 13 monitors, metrics, alerts, SLOs, or Module 19 engines  
- Redefining Phase 16 quality gates, sample windows, or `THR-*` pass values  
- Redefining Phase 14 pipelines / envs or Phase 15 RPO/RTO policy  
- Replacing Modules 1–30 operational code  
- Next.js/Flutter, real HTTP servers, new top-level nav  

### 1.4 Input & Dependency Rules

1. **Phase 13 EMOOIS** owns MET/SLO/ALT definitions — EPSCMS **consumes** them for capacity signals.  
2. **Phase 16 ETQAVS** owns release performance pass/fail (`median ≤300ms`, `p95 ≤750ms`, `p99 ≤1500ms`, CPU ≤70%, memory ≤75%, error ≤0.5%, availability ≥99.9%).  
3. **Operational SLO-006** (`API p95 ≤500ms`) remains Phase 13 — tighter than the Phase 16 release ceiling; capacity plans **aim** to sustain SLO-006 while release gates use Phase 16.  
4. **SLO-005** AI advisory p95 ≤2000ms — consumed for AI capacity/benchmarks; advisory only.  
5. Module 19 records/observes; Module 18 runs jobs; Module 21 backups; Module 29 AI — **not replaced**.  

---

## 2. Performance architecture

Performance is modelled as interacting dimensions. Observation remains Phase 13 / Module 19.

| Dimension | Catalog focus | Phase 13 consume |
|-----------|---------------|------------------|
| Latency | Median / p95 / p99 targets | MET-003, SLO-006, SLO-005 |
| Throughput | TPS / RPS / batch ops | MET-001, API availability |
| Concurrency | Concurrent users / sessions | Capacity CAP-006 |
| Utilization | CPU / memory / disk / IO | Ops RTHR + Phase 16 THR-045/046 |
| Queues | Depth, workers, lag | MON-010 |
| Cache | Hit ratio, fill | PMET-009 / RTHR-008 |
| Database | Ops/sec, connections, growth | CAP-004 / CAP-012 |
| Storage | Primary, object, backup, logs | CAP-003/008/009/010 |
| Network | Branch WAN / sync bandwidth | CAP-005 |

**Architecture principles**

1. Prefer **stateless** app tiers for horizontal scale.  
2. Separate interactive API path from batch/EOD workers (Module 18).  
3. Read-heavy reporting uses replicas before sharding.  
4. AI inference is **advisory** and isolatable (Module 29).  
5. Capacity decisions must preserve money invariants and Phase 16 gateability.

---

## 3. Workload modelling

| ID | Profile | Users | TPS | API/min | Queue/min | DB ops/s | AI/hr | Storage GB/mo |
|----|---------|------:|----:|--------:|----------:|---------:|------:|--------------:|
| WLP-001 | Single-branch | 25 | 8 | 480 | 40 | 35 | 20 | 2.5 |
| WLP-002 | Multi-branch (~15) | 180 | 55 | 3,300 | 280 | 220 | 150 | 28 |
| WLP-003 | Regional (~65) | 650 | 180 | 10,800 | 900 | 750 | 600 | 110 |
| WLP-004 | Nationwide (~250) | 2,200 | 550 | 33,000 | 3,200 | 2,400 | 2,500 | 420 |
| WLP-005 | Peak collection | 3,200 | 900 | 54,000 | 5,500 | 3,800 | 1,800 | 420 |
| WLP-006 | EOD batch | 120 | 40 | 2,400 | 8,000 | 4,500 | 50 | 420 |
| WLP-007 | Month-end | 400 | 120 | 7,200 | 12,000 | 6,000 | 200 | 450 |
| WLP-008 | Loan peaks | 900 | 220 | 13,200 | 1,500 | 1,100 | 4,000 | 420 |
| WLP-009 | Reporting peaks | 500 | 95 | 5,700 | 600 | 2,800 | 100 | 420 |

Peak multipliers (1.0–2.2) apply where `peakMultiplier` is set. Collection peaks respect **31-day** cycle semantics; cashier float **1000**; amounts in **pesewas**.

---

## 4. Capacity planning

Each `CAP-*` entry records: **current**, **12/24/36m forecast**, **scaling trigger %**, **max capacity**, **upgrade strategy**.

| ID | Resource | Current | 12m | 24m | 36m | Trigger | Max | Strategy |
|----|----------|--------:|----:|----:|----:|--------:|----:|----------|
| CAP-001 | CPU (vCPU) | 16 | 24 | 40 | 64 | 70% | 128 | horizontal |
| CAP-002 | Memory (GB) | 64 | 96 | 160 | 256 | 75% | 512 | vertical→horizontal |
| CAP-003 | Storage (TB) | 4 | 8 | 16 | 32 | 80% | 100 | object tiering |
| CAP-004 | DB (GB) | 250 | 520 | 1,100 | 2,300 | 75% | 8,000 | read replicas |
| CAP-005 | Bandwidth (Mbps) | 200 | 400 | 800 | 1,500 | 70% | 5,000 | horizontal |
| CAP-006 | API (RPS) | 200 | 400 | 800 | 1,500 | 70% | 5,000 | stateless replicas |
| CAP-007 | Queue workers | 8 | 16 | 32 | 64 | 70% | 256 | queue workers |
| CAP-008 | Backup (TB) | 12 | 24 | 48 | 96 | 80% | 200 | object tiering |
| CAP-009 | Logs (GB/day) | 15 | 35 | 70 | 140 | 75% | 500 | object tiering |
| CAP-010 | Object (TB) | 6 | 14 | 30 | 60 | 80% | 250 | object tiering |
| CAP-011 | AI infer/s | 5 | 12 | 25 | 50 | 70% | 200 | AI batch offload |
| CAP-012 | DB connections | 100 | 160 | 250 | 400 | 75% | 800 | read replicas |

CPU/memory triggers **align** with Phase 16 `THR-045` / `THR-046` (70% / 75%).

---

## 5. Scalability strategy

| Pattern | When to use | Decision criteria |
|---------|-------------|-------------------|
| Horizontal (stateless) | API / web workers | RPS util ≥ trigger OR p95 approaching Phase 16/13 |
| Vertical | Single-node memory/CPU before split | Short-term; prefer horizontal for prod |
| DB read replicas | Reporting / search read load | CAP-004 disk or SLO-006 pressure |
| Partitioning | Hot tables (collections ledger history) | After replicas; no entity rewrite |
| Sharding | Only if nationwide write fan-out exceeds primary | Requires Architecture Review (Phase 11) |
| Queue workers | EOD / sync / notifications | Queue depth util ≥ RTHR-007 |
| Cache expansion | Hit ratio drop + read latency | Before DB scale |
| AI batch offload | Advisory spikes (loan peaks) | SLO-005 burn |
| Object tiering | Backup/log/media growth | CAP-008/009/010 triggers |

**Stateless rule:** session/auth tokens and branch context must not pin sticky compute for scale-out.

---

## 6. Performance benchmarks

Aligned interactive API benchmarks **must not exceed** Phase 16 ceilings (median 300 / p95 750 / p99 1500). Methods: load scripts, transaction mixes, SPA TTI+API, offline replay, advisory inference batches, batch wall-clock.

| ID | Category | Median | p95 | p99 / duration | Pass/fail |
|----|----------|-------:|----:|----------------|-----------|
| BEN-001 | Auth | ≤200ms | ≤500ms | ≤1000ms | + Phase 16 ceiling |
| BEN-002 | Savings | ≤250ms | ≤650ms | ≤1200ms | + Phase 16 ceiling; pesewas |
| BEN-003 | Loans | ≤280ms | ≤700ms | ≤1400ms | + Phase 16; Module 27 formulas |
| BEN-004 | Collections | ≤300ms | ≤750ms | ≤1500ms | **Exact Phase 16** |
| BEN-005 | Reports | ≤2s | ≤8s | ≤15s | Integrity 100% |
| BEN-006 | Dashboard | ≤800ms TTI | ≤2s | ≤3.5s | Fan-out APIs Phase 16 |
| BEN-007 | Search | ≤200ms | ≤600ms | ≤1100ms | + Phase 16 ceiling |
| BEN-008 | Sync | ≤1.5s | ≤5s | ≤10s | 100% reconcile |
| BEN-009 | AI | ≤800ms | ≤2000ms | ≤3500ms | **SLO-005**; advisory only |
| BEN-010 | Batch EOD | — | ≤45m / ≤60m | — | Integrity 100% |

Sample window for interactive API benches: prefer Phase 16 `SMP-006` (10,000 requests / 30 min).

---

## 7. Resource utilization thresholds

| ID | Resource | Warning | Critical | Phase 16 align |
|----|----------|--------:|---------:|----------------|
| RTHR-001 | CPU | 70% | 85% | THR-045 = 70% |
| RTHR-002 | Memory | 75% | 90% | THR-046 = 75% |
| RTHR-003 | Disk | 80% | 90% | — |
| RTHR-004 | IO | 70% | 85% | — |
| RTHR-005 | Network | 70% | 85% | — |
| RTHR-006 | DB connections | 75% | 90% | — |
| RTHR-007 | Queue depth | 70% | 90% | — |
| RTHR-008 | Cache fill | 85% | 95% | — |

Warning → capacity review; Critical → scale action + Module 19 alert path (not redefined here).

---

## 8. Capacity forecasting

| ID | Driver | Baseline → 12 / 24 / 36 | Review |
|----|--------|-------------------------|--------|
| FRC-001 | Branches | 15 → 40 / 120 / 250 | quarterly |
| FRC-002 | Members | 25k → 80k / 220k / 500k | quarterly |
| FRC-003 | Daily txns | 12k → 45k / 140k / 350k | monthly |
| FRC-004 | Storage TB | 4 → 8 / 16 / 32 | quarterly |
| FRC-005 | AI inferences/day | 500 → 4k / 15k / 40k | quarterly |
| FRC-006 | Mobile devices | 80 → 350 / 900 | semi-annual |

Helpers in `phase17-capacity-forecast.js` interpolate linearly between horizon points and evaluate scaling triggers.

**Growth drivers:** branch expansion, membership, collection-day peaks, loan product uptake, AI advisory adoption, mobile field force, retention/backup policy (Phase 15 / Module 21).

---

## 9. Performance optimization standards

| Area | Standard |
|------|----------|
| SQL | Indexed access paths; avoid N+1; explain plans for collection/loan hot paths; no full scans on day-ledger |
| API | Contract facades stay lean; pagination defaults; payload compression where beneficial |
| Mobile | Offline buffer batching; sync back-pressure; Capacitor APK targets via `www/` |
| Web | SPA code-split discipline; dashboard fan-out budgets; `prepare:web` artifact is test target |
| Cache | Cache-aside for reference data; never cache authoritative balances without invalidation |
| Compression | TLS + HTTP compression for WAN; backup compression via Module 21 |
| Pooling | DB pool sized to CAP-012; reject saturation before crash |
| Async | Non-interactive work → Module 18 queues |
| Batch | EOD/month-end window targets BEN-010; interest **15%** via Module 27 only |

---

## 10. Governance

| ID | Topic | Rule |
|----|-------|------|
| PGOV-001 | Ownership | Exactly one `accountableAuthority` per metric/capacity/benchmark entry |
| PGOV-002 | Approval | CAP max/trigger changes need Capacity Planner + Platform Ops |
| PGOV-003 | Exceptions | Cannot loosen Phase 16 THR-040..046 without Phase 16 change control |
| PGOV-004 | Escalation | Phase 13 SLO burn uses Module 19 routing — not redefined |
| PGOV-005 | Scale decision | PRODUCTION horizontal scale: Platform Ops; emergency: post-facto CIO |
| PGOV-006 | Forecast review | Per `reviewFrequency`; 36m plan refreshed ≥ annually |

Audit authority remains separated from accountable authority (SoD).

---

## 11. Cross-reference matrix (Modules 1–30 × Phases 1–16)

| Module / Phase | EPSCMS relationship |
|----------------|---------------------|
| M1 Auth | BEN-001; concurrency identity |
| M3 Members | Search BEN-007; member growth FRC-002 |
| M5–6 Savings/Collections | WLP-005; BEN-002/004; pesewas / day 31 / cashier 1000 |
| M7 Ledger/DB | CAP-004/012; SQL standards |
| M8 Loans | WLP-008; BEN-003; interest 15 via M27 |
| M11 Reporting | WLP-009; BEN-005 |
| M16 Payments/MoMo | Peak collection observe; Phase 13 SLO-004 consume |
| M18 Jobs | Queue CAP-007; batch WLP-006/007 |
| M19 Monitoring | **Observe engine — not replaced**; metrics/SLOs consumed |
| M20 API gateway | CAP-006; latency PMET-001..003 |
| M21 Backup | CAP-008; storage forecasts; Phase 15 RPO/RTO consumed |
| M22 Security | Auth bench; no RBAC rewrite |
| M24 Rules | AI advisory gating; no auto approval |
| M27 Interest/money math | Formulas authoritative; perf tests must not alter |
| M29 AI | BEN-009; CAP-011; advisory only — not replaced |
| M30 Platform | Scale governance; not replaced |
| Phase 9 Security | Consumed |
| Phase 12 AI | Advisory capabilities consumed |
| Phase 13 Monitoring | **Consumed** MET/SLO |
| Phase 14 Deploy | Env promotion for perf evidence |
| Phase 15 BCDR | Backup capacity linkage |
| Phase 16 Testing | **Consumed** THR-040..046 / SMP-006 |

---

## 12. Acceptance criteria

1. Docs `enterprise-performance-capacity.md` + `epscms-catalogs.md` with Input & Dependency Rules  
2. Registry metrics/capacity/benchmarks/workloads/thresholds/forecasts/governance with list/get/validate  
3. `phase17-capacity-forecast.js` forecast / utilization / benchmark / scaling helpers  
4. Schemas on disk + valid/invalid examples + manifest SHA-256  
5. Tests green; `prepare:web` after src changes  
6. Phases 13/16 not redefined; Module 19 not replaced  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 17 EPSCMS |
| 1.0.1 | 2026-09-15 | Cross-link Phase 18 EOSSMS (ops consumes capacity signals; does not redefine) |
| 1.0.2 | 2026-09-15 | Cross-link Phase 19 EGCCRMS (release governance may reference capacity evidence; does not redefine) |
