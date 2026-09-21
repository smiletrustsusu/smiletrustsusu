# ETQAVS Catalogs (Phase 16 Companion Matrices)

**Parent:** [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md)  
**Registry:** `src/core/canonical-testing-registry.js`  
**Quality gates engine:** `src/core/phase16-quality-gates.js`  
**Phase 14 (consume):** [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md), `canonical-deployment-registry.js`  
**Phase 15 (consume):** [`enterprise-business-continuity-dr.md`](./enterprise-business-continuity-dr.md), `canonical-continuity-registry.js`  
**Phase 12 AI (consume):** [`enterprise-ai.md`](./enterprise-ai.md) — advisory only  
**Module 19 / 21 / 29 / 30:** monitoring · backup-recovery · AI · platform-ops — **not replaced**  
**Version:** 1.0.0  
**Date:** 2026-09-15  

**Scope:** Testing / QA / validation **catalog** only. Consumes Phases 1–15 + Modules 1–30. Does **not** redefine entities, APIs, DB, security controls, deployment, monitoring, or BCDR **policy**. Does **not** replace operational engines.

**Counts (seed):** roles=10, suites=17, cases=10, qualityGates=4, validations=6, certifications=2, thresholds=44, sampleWindows=13, stressPhases=9, recoveryLimits=12, kpis=10

---

## 1. Quality Gate Registry

| ID | Code | Promotion | Suites (req) | Accountable |
|----|------|-----------|--------------|-------------|
| QG-001 | GATE_DEV_TO_QA | DEV → QA | TSU-001,002 | QA Lead |
| QG-002 | GATE_QA_TO_UAT | QA → UAT | TSU-003,005,006 | QA Lead |
| QG-003 | GATE_UAT_TO_STAGING | UAT → STAGING | TSU-004,007 | Business Acceptance Owner |
| QG-004 | GATE_STAGING_TO_PROD | STAGING → PRODUCTION | TSU-005,006,007,010,011,014 | CIO |

No bypass without approved emergency exception.

---

## 2. Test Suite Registry

| ID | Code | Level | Mandatory | Automation | Owner |
|----|------|-------|-----------|------------|-------|
| TSU-001 | SUITE_UNIT | unit | yes | yes | QA Lead |
| TSU-002 | SUITE_INTEGRATION | integration | yes | yes | Enterprise Test Architect |
| TSU-003 | SUITE_SYSTEM | system | yes | yes | QA Lead |
| TSU-004 | SUITE_UAT | uat | yes | no | Business Acceptance Owner |
| TSU-005 | SUITE_REGRESSION | regression | yes | yes | QA Lead |
| TSU-006 | SUITE_SECURITY | security | yes | yes | Security Operations Lead |
| TSU-007 | SUITE_PERFORMANCE | performance | yes | yes | Performance Test Engineer |
| TSU-008 | SUITE_LOAD | load | yes | yes | Performance Test Engineer |
| TSU-009 | SUITE_STRESS | stress | yes | yes | Performance Test Engineer |
| TSU-010 | SUITE_DR | dr | yes | no | Platform Operations Lead |
| TSU-011 | SUITE_BACKUP_RESTORE | backup_restore | yes | yes | Platform Operations Lead |
| TSU-012 | SUITE_AI_VALIDATION | ai | yes | yes | AI Validation Specialist |
| TSU-013 | SUITE_DATABASE | database | yes | yes | Validation Lead |
| TSU-014 | SUITE_SMOKE | smoke | yes | yes | QA Lead |
| TSU-015 | SUITE_SANITY | sanity | no | yes | QA Lead |
| TSU-016 | SUITE_ACCESSIBILITY | accessibility | no | yes | QA Lead |
| TSU-017 | SUITE_COMPATIBILITY | compatibility | no | yes | QA Lead |

---

## 3. Test Case Registry (seed)

| ID | Suite | Name | Owner |
|----|-------|------|-------|
| TC-001 | TSU-001 | Unit coverage ≥90% line | QA Lead |
| TC-002 | TSU-002 | API contract compliance 100% | Enterprise Test Architect |
| TC-003 | TSU-003 | Offline/online reconciliation 100% | QA Lead |
| TC-004 | TSU-004 | Business sign-off recorded | Business Acceptance Owner |
| TC-005 | TSU-006 | Authorization / no privilege escalation | Security Operations Lead |
| TC-006 | TSU-007 | P95 response ≤750ms | Performance Test Engineer |
| TC-007 | TSU-010 | DR within Phase 15 RTO | Platform Operations Lead |
| TC-008 | TSU-012 | AI advisory only | AI Validation Specialist |
| TC-009 | TSU-003 | Money pesewas / interest 15 / days 31 / cashier 1000 | Validation Lead |
| TC-010 | TSU-011 | Module 21 backup restore 100% | Platform Operations Lead |

---

## 4. Defect Severity & Priority

| Severity | Release rule |
|----------|--------------|
| Critical | 0 Open |
| High | 0 Open unless approved exception |
| Medium | Approved remediation plan required |
| Low | Logged and scheduled |

Priorities: P0_immediate · P1_high · P2_medium · P3_low

---

## 5. Threshold Registry (highlights)

| ID | Category | Metric | Pass |
|----|----------|--------|------|
| THR-002 | unit | line_coverage | ≥ 90% |
| THR-003 | unit | branch_coverage | ≥ 85% |
| THR-040 | performance | median_api_response_ms | ≤ 300 |
| THR-041 | performance | p95_response_ms | ≤ 750 |
| THR-042 | performance | p99_response_ms | ≤ 1500 |
| THR-060 | security | critical_vulnerabilities | = 0 |
| THR-080 | ai | accuracy | ≥ 95% |
| THR-090 | dr | rpo_achievement | ≤ Phase 14/15 RPO |
| THR-091 | dr | rto_achievement | ≤ Phase 14/15 RTO |
| THR-100 | defect | open_critical_defects | = 0 |

Full set: see `THRESHOLDS` in registry / Appendix A of parent doc.

---

## 6. Sample Size & Window Registry (highlights)

| ID | Category | Min sample | Window |
|----|----------|------------|--------|
| SMP-002 | integration | 1,000 txns | integration cycle |
| SMP-004 | system | 500 sync events | sync cycle |
| SMP-006 | performance | 10,000 requests | 30 min (+5 min warm-up exclude) |
| SMP-007 | load | 100,000 txns | ≥60 min |
| SMP-011 | ai | rolling prod | ≥30 days drift |
| SMP-012 | ai | 10,000 inferences | 30 min |

**Statistical confidence:** 95% / ±5%.

---

## 7. Stress Phase Registry

| ID | Phase | Min–Max (min) | Load |
|----|-------|---------------|------|
| STP-001 | Environment Validation | 5–30 | — |
| STP-002 | Warm-Up | 10–20 | — |
| STP-003 | Baseline | 15–30 | 100% |
| STP-004 | Ramp-Up | 30–60 | 125→175% |
| STP-005 | Sustained Stress | 60–120 | — |
| STP-006 | Peak Load | 30–60 | 200% |
| STP-007 | Failure Observation | 15–60 | stable ≥15 min |
| STP-008 | Recovery | ≥30 | → baseline |
| STP-009 | Stabilization | 30–60 | baseline |

Workload: 100% → 125% → 150% → 175% → 200%.

---

## 8. Recovery Limit Registry

| ID | Scenario | Max minutes |
|----|----------|------------:|
| RLIM-001 | Application Service Restart | 5 |
| RLIM-002 | API Gateway Recovery | 10 |
| RLIM-003 | Background Worker Recovery | 10 |
| RLIM-004 | Database Service Restart | 15 |
| RLIM-005 | Database Failover | 30 |
| RLIM-006 | Backup Restoration Validation | 60 |
| RLIM-007 | Web Admin Portal Recovery | 15 |
| RLIM-008 | Android Backend Recovery | 15 |
| RLIM-009 | Authentication Service Recovery | 15 |
| RLIM-010 | Notification Service Recovery | 30 |
| RLIM-011 | AI Inference Service Recovery | 60 |
| RLIM-012 | Complete DR Exercise | Phase 15 RTO |

**Stabilization:** 30 minutes (Phase 14/15 alignment — not redefined).

---

## 9. Validation & Certification Registry

| ID | Name | Owner |
|----|------|-------|
| VAL-001 | Threshold measurable | Validation Lead |
| VAL-002 | Sample/window validity | Validation Lead |
| VAL-003 | Recovery limits vs Phase 15 RTO | Platform Operations Lead |
| VAL-004 | Evidence integrity | Validation Lead |
| VAL-005 | Exception traceability | CIO |
| VAL-006 | Module 19 monitoring hooks | Platform Operations Lead |
| CERT-001 | Production release certification | CIO |
| CERT-002 | Emergency hotfix certification | CIO |

---

## 10. KPI Registry

| ID | Name | Formula (short) |
|----|------|-----------------|
| KPI-001 | Test Pass Rate | Passed ÷ Total × 100 |
| KPI-002 | Defect Density | Defects ÷ KLOC |
| KPI-003 | Defect Escape Rate | Prod ÷ (Pre+Prod) × 100 |
| KPI-004 | Automation Coverage | Auto Mand ÷ Mand × 100 |
| KPI-005 | MTTV | Σ duration ÷ n |
| KPI-006 | MTTR Defects | Σ resolve ÷ n |
| KPI-007 | Regression Stability | Stable ÷ Total × 100 |
| KPI-008 | Release Quality Index | Weighted 0–100 |
| KPI-009 | Recovery Success Rate | Success ÷ Total × 100 |
| KPI-010 | Recovery Time Compliance | Within ÷ Total × 100 |

---

## 11. Cross-reference — Phases 1–15 / Modules

| Concern | Authority |
|---------|-----------|
| Env promotion DEV→…→PROD | **Phase 14** (consumed by QG-*) |
| RPO/RTO policy & complete DR | **Phase 15** (THR-090/091, RLIM-012) |
| Security controls | **Phase 9** (TSU-006 validates) |
| AI advisory | **Phase 12 / Module 29** |
| Monitoring soak | **Module 19** |
| Backup/restore execute | **Module 21** |
| Platform release/DR metadata | **Module 30** |
| Test strategy / gates / certify | **Phase 16** |

**Money invariants under test:** pesewas · interest 15 · collection days 31 · cashier 1000.
