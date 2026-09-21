# Wave Execution Plan (User Waves 1–10)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**EIR IDs:** WAVE-01…WAVE-10 (stable)  
**User names:** Foundation · Database · Backend · Android · Web · Windows · AI & Analytics · Testing · Pilot · Production  
**Machine map:** `src/core/master-backlog-delivery-waves.js`

**Realism:** Framework packs for Waves 1–10 are **Mostly Complete**. Open work is gap closure + human gates — **not** a reset to Planned.

---

## Wave ↔ EIR ↔ MIB mapping

| User Wave | Name | EIR ID | MIB waves (1–20) | Framework status |
|----------:|------|--------|------------------|------------------|
| 1 | Foundation | WAVE-01 | 1–3 | Mostly Complete |
| 2 | Database | WAVE-02 | 4 | Mostly Complete + schema debt |
| 3 | Backend | WAVE-03 | 5 | Mostly Complete |
| 4 | Android | WAVE-04 | 6 | Mostly Complete + Gradle gap |
| 5 | Web | WAVE-05 | 7–9 | Mostly Complete |
| 6 | Windows | WAVE-06 | 10 | Mostly Complete + signing gap |
| 7 | AI & Analytics | WAVE-07 | 11–13, 17 | Mostly Complete |
| 8 | Testing | WAVE-08 | 18 | Mostly Complete · RC1 PASS |
| 9 | Pilot | WAVE-09 | 14–16 | Conditional · human gates open |
| 10 | Production | WAVE-10 | 19–20 | FrameworkReady · not live certified |

---

## Open audit work by wave (execution order)

### Wave 9 Pilot (start here — Critical)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| TASK-000181 | GAP-003 HA-* human gates | Ready | Release Manager |
| TASK-000182 | GAP-015 MFA proof | Ready | Security Governance Lead |

### Wave 10 / docs (parallel with pilot prep)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| TASK-000183 | GAP-006 PRODUCTION.md 001–044 | **Completed** | Release Manager |
| TASK-000184 | GAP-016 deploy manifests | Completed | Release Manager |

### Wave 2 Database (parallel — High debt)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| BUG-000002 | GAP-005 dual money | In Progress | CIO |
| BUG-000003 | GAP-010 role CHECK | **Completed** (migration file; UAT apply = org) | Security Governance Lead |
| BUG-000004 | GAP-019 MoMo pesewas | In Progress | CIO |

### Wave 4 Android / Wave 6 Windows (parallel packaging)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| TASK-000185 | GAP-004 Android Gradle | In Progress | Platform Administrator |
| TASK-000186 | GAP-008 EXE signing / updates | In Progress | Platform Administrator |
| TASK-000196 | GAP-014 CSP tighten | Planned | Security Governance Lead |

### Wave 1 Foundation (CI hygiene)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| TASK-000192 | GAP-007 CI + VCS | In Progress | Platform Administrator |
| TASK-000193 | GAP-018 www/ guard | Completed | Platform Administrator |
| TASK-000198 | GAP-022 EIR aliases | **Completed** | Platform Administrator |

### Wave 10 Production (after pilot gates)
| ID | Gap | Status | Owner |
|----|-----|--------|-------|
| TASK-000188 | GAP-001 cutover CO-* | Blocked | Release Manager |
| TASK-000189 | GAP-009 PV-* | Blocked | Release Manager |
| TASK-000190 | GAP-011 hypercare | Blocked | Release Manager |
| TASK-000191 | GAP-002 CERT-001 | Blocked | Governance Board Chair |
| TASK-000187 | GAP-012 release artifacts | In Progress | Release Manager |
| TASK-000200 | GAP-024 prod password guard | **Completed** | Security Governance Lead |

### Deferred (post go-live / product)
GAP-013, GAP-017, GAP-021, GAP-025, GAP-026, GAP-027 — see deferred statuses in gap register.  
GAP-023 PWA limits → **Completed** (`docs/backlog/pwa-web-offline-support.md`).

### Org hard stop
When only HA-* / signing / remotes / prod deploy / SQL money rewrite remain → [`blocked-on-org.md`](./blocked-on-org.md). Do not invent busywork.

---

## Parallel opportunities

| Parallel lane | Items |
|---------------|-------|
| Human ops | GAP-003, GAP-015 |
| Data/security schema | GAP-005, GAP-019 (freeze) |
| Channel packaging | GAP-004, GAP-008, GAP-014 |
| DevOps hygiene | GAP-007 |

**Do not parallelize:** GAP-001 cutover before GAP-003; CERT-001 before cutover.

---

*wave-execution-plan.md v1.1.0 — 2026-09-20 — backlog status honesty + blocked-on-org pointer*
