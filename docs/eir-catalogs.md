# EIR Catalogs — Enterprise Implementation Roadmap summaries

**Registry:** `src/core/enterprise-roadmap-registry.js`  
**Primary doc:** [`enterprise-implementation-roadmap.md`](./enterprise-implementation-roadmap.md)  
**Alias SoT (GAP-022):** [`backlog/eir-catalog-aliases.md`](./backlog/eir-catalog-aliases.md)  
**Backlog SoT:** [`master-implementation-backlog.md`](./master-implementation-backlog.md) · `src/core/master-backlog-registry.js`  
**MIB waves (20):** `src/core/master-backlog-waves.js`  
**Baseline:** [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md)  
**Schema:** [`schemas/roadmap/implementation-wave.schema.json`](./schemas/roadmap/implementation-wave.schema.json)  
**Version:** 1.0.0 · **Date:** 2026-09-15

Counts match `waveBacklogCounts()` / `validateEnterpriseRoadmap()` at publication.

---

## 1. Wave catalog summary

| Wave | Code | Name | Status | MIB waves | Duration (wks) | Effort (pw) |
|------|------|------|--------|-----------|----------------|------------:|
| WAVE-01 | FOUNDATION_PLATFORM | Foundation Platform | Mostly Complete | 1–3 | 1–2 | 6 |
| WAVE-02 | DATABASE_PLATFORM | Database Platform | Mostly Complete | 4 | 1–2 | 5 |
| WAVE-03 | CORE_SERVICES | Core Services | Mostly Complete | 5 | 1–2 | 6 |
| WAVE-04 | OFFLINE_PLATFORM | Offline Platform | Mostly Complete | 6 | 1–2 | 7 |
| WAVE-05 | CORE_BUSINESS | Core Business Modules | Mostly Complete | 7–9 | 2–3 | 12 |
| WAVE-06 | WINDOWS_EXE | Windows Desktop EXE (alias: Loan Platform) | Mostly Complete | 10 | 1–2 | 8 |
| WAVE-07 | ANALYTICS_BI | Enterprise Analytics & BI (alias: Accounting Platform) | Mostly Complete | 11 | 1–2 | 8 |
| WAVE-08 | RELEASE_CERTIFICATION | Release Certification (alias: Reporting Platform) | Mostly Complete | 12–13 | 1–2 | 6 |
| WAVE-09 | PILOT_UAT_OPS_READINESS | Pilot / UAT / Ops Readiness (alias: Enterprise Features) | Mostly Complete | 14–17 | 2–3 | 10 |
| WAVE-10 | PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE | Prod Deploy / Go-Live / Hypercare (hist. Production Readiness) | Mostly Complete | 18–20 | 4–6 | 24 |

**Wave count:** 10  
**Calendar total (sequential):** 16–27 weeks (gap closure + hardening)

---

## 2. MIB → EIR mapping (20 → 10)

| MIB # | MIB code | EIR wave |
|------:|----------|----------|
| 1 | FOUNDATION | WAVE-01 |
| 2 | AUTH_RBAC | WAVE-01 |
| 3 | TENANT_BRANCH | WAVE-01 |
| 4 | DATABASE | WAVE-02 |
| 5 | CORE_APIS | WAVE-03 |
| 6 | SYNC_ENGINE | WAVE-04 |
| 7 | CUSTOMER | WAVE-05 |
| 8 | SAVINGS | WAVE-05 |
| 9 | DAILY_COLLECTIONS | WAVE-05 |
| 10 | LOANS | WAVE-06 |
| 11 | ACCOUNTING | WAVE-07 |
| 12 | REPORTS | WAVE-08 |
| 13 | DASHBOARDS | WAVE-08 |
| 14 | NOTIFICATIONS | WAVE-09 |
| 15 | MONITORING | WAVE-09 |
| 16 | SECURITY | WAVE-09 |
| 17 | AI | WAVE-09 |
| 18 | TESTING | WAVE-10 |
| 19 | DEPLOYMENT | WAVE-10 |
| 20 | PRODUCTION_READINESS | WAVE-10 |

> **WAVE-06 mapping note:** Delivery focus is **Windows Desktop EXE** (`WINDOWS_EXE`). Historical catalog name was Loan Platform. MIB wave 10 LOANS / Module 8 remain mapped to WAVE-06; loan deep SM work stays Mostly Complete / deferred — see `docs/wave6-windows-exe.md`.

> **WAVE-07 mapping note:** Delivery focus is **Enterprise Analytics & BI** (`ANALYTICS_BI`). Historical catalog name was Accounting Platform. MIB wave 11 ACCOUNTING / Module 10 remain mapped; deep CoA/GL rewrite deferred — see `docs/wave7-analytics-bi.md`.

> **WAVE-08 mapping note:** Delivery focus is **Release Certification / RC1** (`RELEASE_CERTIFICATION`). Historical catalog name was Reporting Platform. MIB waves 12–13 remain mapped; reporting/BI polish lives in WAVE-07 — see `docs/wave8-release-certification.md`. Full CERT-001 is WAVE-10.

Items with `wave: null` resolve via module/phase/parent rules in `resolveBacklogItemWave()` (MOD/PH maps + parent walk). Program `PRG-0001` → WAVE-10.

---

## 3. Mapping counts (backlog items per wave)

| Wave | Mapped items |
|------|-------------:|
| WAVE-01 | 148 |
| WAVE-02 | 29 |
| WAVE-03 | 62 |
| WAVE-04 | 28 |
| WAVE-05 | 159 |
| WAVE-06 | 29 |
| WAVE-07 | 62 |
| WAVE-08 | 58 |
| WAVE-09 | 113 |
| WAVE-10 | 46 |
| **Total** | **734** |

Every MIB identifier appears in **exactly one** wave (`validateEnterpriseRoadmap` critical=0). Counts reflect MIB v1.1.0 audit reconciliation (+36 vs 698).

---

## 4. Quality gates (summary)

| Wave band | Gates |
|-----------|-------|
| WAVE-01…08 | QG-001, QG-002, Phase 16 in-scope suites, prepare:web, wave-specific domain gates |
| WAVE-09 | + RC1 entry, UAT pack, ops readiness, Go/No-Go human gates |
| WAVE-10 | QG-001…004, CERT-001/002 preview, Phase 19 authorize, Phase 20 RDY-*, human AA for Accepted |

See `qualityGateMatrix()` and Phase 16 ETQAVS / Phase 14 / Phase 19 docs.

---

## 5. Risks & resources (summary)

- **Risks:** 24 (`EIR-R-001` … `EIR-R-021`) — see primary roadmap §7  
- **Peak roles:** developers 3 · QA 3 · DBA 1 · DevOps 2 · UI/UX 1 · security 2 · PO 1  
- **Money invariants:** pesewas · interest 15 · collection days 31 · cashier 1000  

> **WAVE-10 mapping note:** Delivery focus is **Production Deployment, Go-Live, Hypercare & Continuous Improvement** (`PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE`). Historical catalog name was Production Readiness. MIB waves 18–20 remain mapped — see `docs/wave10-production-golive.md`. Framework complete ≠ production live; CERT-001 stays preview until human Accountable Authority approvals.
---

## 6. Related packages

| Concern | SoT |
|---------|-----|
| Execution backlog items | MIB + `master-backlog-registry.js` |
| Delivery wave sequencing | **EIR + `enterprise-roadmap-registry.js`** |
| Spec baseline | Phase 20 EIBPRFBS |
| Quality gates | Phase 16 |
| Deployment promote | Phase 14 |
| Change/release | Phase 19 |

EIR does **not** redefine Phases 1–20 or replace Modules 1–30 engines, and does **not** invent a second backlog.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-15 | Initial EIR catalogs |


### WAVE-04 delivery note (2026-09-15)

Capacitor + shared-core offline/sync engine delivered — see `docs/wave4-android-offline.md`. Status remains **Mostly Complete** pending WAVE-10 certification / field drill sign-off.
