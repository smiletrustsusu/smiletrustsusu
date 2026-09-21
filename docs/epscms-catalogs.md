# EPSCMS Catalogs (Phase 17 Companion Matrices)

**Parent:** [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md)  
**Registry:** `src/core/canonical-performance-registry.js`  
**Forecast engine:** `src/core/phase17-capacity-forecast.js`  
**Phase 13 (consume):** [`enterprise-monitoring-observability.md`](./enterprise-monitoring-observability.md), `canonical-monitoring-registry.js`  
**Phase 16 (consume):** [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md), `THR-040`…`THR-046`  
**Phase 14 (consume):** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md)  
**Module 19 / 18 / 21 / 29 / 30:** monitoring · jobs · backup · AI · platform — **not replaced**  
**Version:** 1.0.0  
**Date:** 2026-09-15  

**Scope:** Performance / scalability / capacity **catalog** only. Consumes Phases 1–16 + Modules 1–30. Does **not** redefine entities, APIs, DB, security, monitoring, deployment, BCDR, or testing **standards**. Does **not** replace operational engines.

**Counts (seed):** roles=8, metrics=20, capacityEntries=12, benchmarks=10, workloads=9, resourceThresholds=8, forecasts=6, governance=6

**Phase 16 ceilings (consumed):** median ≤300ms · p95 ≤750ms · p99 ≤1500ms · CPU ≤70% · memory ≤75%  
**Phase 13 SLOs (consumed):** SLO-006 API p95 ≤500ms · SLO-005 AI p95 ≤2000ms · SLO-001 availability ≥99.5%

---

## 1. Performance Metric Registry

| ID | Code | Domain | Phase 16 / 13 | Owner |
|----|------|--------|---------------|-------|
| PMET-001 | PERF_API_MEDIAN_MS | latency | THR-040 ≤300 | Performance Architect |
| PMET-002 | PERF_API_P95_MS | latency | THR-041 ≤750; SLO-006 ≤500 | Performance Architect |
| PMET-003 | PERF_API_P99_MS | latency | THR-042 ≤1500 | Performance Architect |
| PMET-004 | PERF_API_TPS | throughput | MET-001 | SRE Lead |
| PMET-005 | PERF_CONCURRENT_USERS | concurrency | — | Capacity Planner |
| PMET-006 | PERF_CPU_UTIL_PCT | utilization | THR-045 ≤70 | Platform Operations Lead |
| PMET-007 | PERF_MEM_UTIL_PCT | utilization | THR-046 ≤75 | Platform Operations Lead |
| PMET-008 | PERF_QUEUE_DEPTH | queue | MON-010 | SRE Lead |
| PMET-009 | PERF_CACHE_HIT_RATIO | cache | — | Performance Architect |
| PMET-010 | PERF_DB_OPS_PER_SEC | database | — | Database Platform Lead |
| PMET-011 | PERF_DB_CONN_UTIL_PCT | database | — | Database Platform Lead |
| PMET-012 | PERF_STORAGE_GROWTH_GB_MO | storage | — | Capacity Planner |
| PMET-013 | PERF_NETWORK_MBPS | network | — | Platform Operations Lead |
| PMET-014 | PERF_AI_INFERENCE_P95_MS | ai | SLO-005 ≤2000 | ML Ops Lead |
| PMET-015 | PERF_SYNC_EVENTS_PER_MIN | sync | MON-009 | SRE Lead |
| PMET-016 | PERF_ERROR_RATE_PCT | throughput | THR-044 ≤0.5 | Performance Architect |
| PMET-017 | PERF_AVAILABILITY_PCT | throughput | THR-043 ≥99.9; SLO-001 ≥99.5 | SRE Lead |
| PMET-018 | PERF_DISK_UTIL_PCT | storage | — | Platform Operations Lead |
| PMET-019 | PERF_IO_WAIT_PCT | utilization | — | Database Platform Lead |
| PMET-020 | PERF_BATCH_JOB_DURATION_MIN | batch | — | SRE Lead |

Exactly **one** `accountableAuthority` per metric.

---

## 2. Workload Profile Registry

| ID | Class | Branches | Users | TPS | Peak× |
|----|-------|---------:|------:|----:|------:|
| WLP-001 | baseline | 1 | 25 | 8 | 1.0 |
| WLP-002 | growth | 15 | 180 | 55 | 1.3 |
| WLP-003 | regional | 65 | 650 | 180 | 1.5 |
| WLP-004 | nationwide | 250 | 2,200 | 550 | 1.8 |
| WLP-005 | peak | 250 | 3,200 | 900 | 2.2 |
| WLP-006 | batch | 250 | 120 | 40 | 1.0 |
| WLP-007 | batch | 250 | 400 | 120 | 1.4 |
| WLP-008 | peak | 250 | 900 | 220 | 1.6 |
| WLP-009 | peak | 250 | 500 | 95 | 1.3 |

Full demand vectors (API/min, queue, DB, AI, storage): see registry / parent §3.

---

## 3. Capacity Registry

| ID | Resource | Current | Trigger | Max | Strategy |
|----|----------|--------:|--------:|----:|----------|
| CAP-001 | cpu | 16 vCPU | 70% | 128 | horizontal |
| CAP-002 | memory | 64 GB | 75% | 512 | vertical_then_horizontal |
| CAP-003 | storage | 4 TB | 80% | 100 | object_storage_tiering |
| CAP-004 | database | 250 GB | 75% | 8000 | read_replicas |
| CAP-005 | bandwidth | 200 Mbps | 70% | 5000 | horizontal |
| CAP-006 | api | 200 RPS | 70% | 5000 | stateless_replicas |
| CAP-007 | queue | 8 workers | 70% | 256 | queue_workers |
| CAP-008 | backup | 12 TB | 80% | 200 | object_storage_tiering |
| CAP-009 | log | 15 GB/day | 75% | 500 | object_storage_tiering |
| CAP-010 | object | 6 TB | 80% | 250 | object_storage_tiering |
| CAP-011 | ai | 5 inf/s | 70% | 200 | ai_batch_offload |
| CAP-012 | db_connections | 100 | 75% | 800 | read_replicas |

---

## 4. Benchmark Registry

| ID | Category | Key targets | Phase 16 aligned |
|----|----------|-------------|------------------|
| BEN-001 | auth | med≤200 p95≤500 | yes |
| BEN-002 | savings | med≤250 p95≤650 | yes |
| BEN-003 | loans | med≤280 p95≤700 | yes |
| BEN-004 | collections | med≤300 p95≤750 p99≤1500 | yes (exact) |
| BEN-005 | reports | p95≤8s | no (batch) |
| BEN-006 | dashboard | p95 TTI≤2s | no (page) |
| BEN-007 | search | med≤200 p95≤600 | yes |
| BEN-008 | sync | p95≤5s | no |
| BEN-009 | ai | p95≤2000 (SLO-005) | no (SLO) |
| BEN-010 | batch | ≤45m / ≤60m | no |

---

## 5. Resource Threshold Registry

| ID | Resource | Warning | Critical |
|----|----------|--------:|---------:|
| RTHR-001 | cpu | 70 | 85 |
| RTHR-002 | memory | 75 | 90 |
| RTHR-003 | disk | 80 | 90 |
| RTHR-004 | io | 70 | 85 |
| RTHR-005 | network | 70 | 85 |
| RTHR-006 | db_connections | 75 | 90 |
| RTHR-007 | queue | 70 | 90 |
| RTHR-008 | cache | 85 | 95 |

---

## 6. Forecast Registry

| ID | Driver | 0 → 12 → 24 → 36 | Review |
|----|--------|------------------|--------|
| FRC-001 | branches | 15 / 40 / 120 / 250 | quarterly |
| FRC-002 | members | 25k / 80k / 220k / 500k | quarterly |
| FRC-003 | daily txns | 12k / 45k / 140k / 350k | monthly |
| FRC-004 | storage TB | 4 / 8 / 16 / 32 | quarterly |
| FRC-005 | AI / day | 500 / 4k / 15k / 40k | quarterly |
| FRC-006 | devices | 80 / 350 / 900 | semi-annual |

---

## 7. Performance Governance Registry

| ID | Topic | Accountable |
|----|-------|-------------|
| PGOV-001 | ownership | Performance Architect |
| PGOV-002 | approval (capacity) | Capacity Planner |
| PGOV-003 | exceptions (Phase 16 ceilings) | Performance Test Engineer |
| PGOV-004 | escalation (SLO burn) | SRE Lead |
| PGOV-005 | scale decision | Platform Operations Lead |
| PGOV-006 | forecast review | Capacity Planner |

---

## 8. Cross-reference (summary)

| Consume / protect | EPSCMS stance |
|-------------------|---------------|
| Phase 13 MET/SLO/MON | Consumed — not redefined |
| Phase 16 THR-040..046 | Consumed — not redefined |
| Phase 14 env path | Evidence environments only |
| Phase 15 backup RPO/RTO | Capacity linkage only |
| Module 19 | Not replaced |
| Modules 18/21/29/30 | Not replaced |
| Money invariants | pesewas · interest 15 · days 31 · cashier 1000 |

Full module×phase matrix: parent §11.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial Phase 17 catalogs |
