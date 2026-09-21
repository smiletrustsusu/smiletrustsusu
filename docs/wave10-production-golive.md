# WAVE-10 — Production Deployment, Go-Live, Hypercare & Continuous Improvement

**Status:** Framework + evidence pack delivered (not a live production cutover claim)  
**Date:** 2026-09-16  
**Wave:** WAVE-10 · consumes RC1 (Wave 8) + Wave 9 Conditional/Go · Phases 14, 15, 18, 19, 20  

---

## Catalog alias note

| Field | Value |
|---|---|
| Delivery name | **Production Deployment, Go-Live, Hypercare & Continuous Improvement** (`PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE`) |
| Historical EIR name | Production Readiness (`PRODUCTION_READINESS`) |
| Entry criteria | Wave 8 **RC1 PASS** + Wave 9 **Conditional** or **Go** evidence |
| CERT-001 | Preview until human Accountable Authority approvals + live cutover evidence |

EIR may label WAVE-10 “Production Readiness”; **user Wave 10** is production deploy / go-live / hypercare / closure. This document is the delivery SoT for that focus.

### Framework complete ≠ production live

| Claim | Wave 10 pack |
|---|---|
| Implementation waves 1–10 framework complete | Yes |
| Cutover / rollback / hypercare / closure runbooks | Yes |
| Synthetic `validate:golive` evidence | Yes |
| Live production cutover executed | **No** (human) |
| Executive Sign-Off | **PendingHumanSignOff** (never auto-Approved) |
| CERT-001 certified | **No** until humans record approvals + cutover |
| Financial recon / availability actuals | Targets + methods only; actuals **null / not measured in-repo** |

**Closure statement:** Implementation waves 1–10 framework is complete. Remaining work is **human execution** of pilot sign-offs + real production cutover under these runbooks. The outdated “execute Wave 1” epilogue does not apply — waves are already implemented as packs.

---

## 1. Production Deployment Plan

### 1.1 Objectives

1. Validate a **production** environment that is isolated from pilot/dev.
2. Execute cutover CO-* with owners, timestamps, and concrete rollback.
3. Run production validation PV-* across core domains.
4. Operate hypercare (14 days + 30-day watch) with daily reviews.
5. Complete PIR, CI backlog intake, KT/handover, and project closure artifacts.
6. Keep CERT-001 in **preview** until Accountable Authority approvals are recorded.

### 1.2 Operator timeline

| Phase | Activity | Owner |
|---|---|---|
| G0 | Confirm RC1 PASS + Wave 9 Conditional/Go; freeze change window | Release Manager |
| G1 | Provision/verify PRD-ENV-* (≠ pilot/dev) | DevOps / DBA |
| G2 | Final backup + restore smoke | DBA |
| G3 | Deploy Web/API + clients; flip prod config/flags | DevOps |
| G4 | PV-* production validation | QA Lead |
| G5 | Finance recon spot-check (pesewas) | Finance / Branch Manager |
| G6 | Open traffic; start hypercare war-room | Ops / Incident Manager |
| G7 | Daily hypercare reviews; CI backlog intake | Service Desk / PO |
| G8 | PIR + KT + executive sign-off package | Accountable Authority |

### 1.3 Environment isolation (prod vs pilot/dev)

All `PRD-ENV-*` items require `differsFromPilotDev: true`:

- Dedicated prod infra, DB, storage, secrets
- `invokeApi` / `config.json` **production** profile (Wave 3) — no silent pilot fallback
- Android release signing + EXE update channel for prod
- Prod monitoring/on-call (not pilot channel)
- Prod backup/DR (Phase 15) — pilot drills do not substitute
- Prod tenant/ledger write path; `SUPER_ADMIN_FORBIDDEN` enforced
- Money invariants: **pesewas**, interest **15**, collection days **31**, cashier limit **1000**

---

## 2. Cutover runbook (summary)

Full step registry: `CUTOVER_STEPS` in `src/core/wave10-production-golive-ops.js` (**13 steps**).

Each step records: owner role, `timestampField`, and **rollback criteria**.

### 2.1 Concrete rollback plan (`RB-PROD-001`)

Triggers: Critical PV failure, material recon imbalance, API/DB red >15 min, P1 storm in early hypercare, Accountable Authority abort.

Steps:

1. Declare rollback (Release Manager + Accountable Authority).
2. **Revert** application release to last-known-good (Web/API/EXE/APK channel pin).
3. **Restore** database from pre-cutover backup verified in CO-02.
4. **Disable** newly enabled feature flags; restore prior config/`invokeApi` profile as required.
5. **Communicate** to branch managers, service desk, and Executive Sponsor.
6. Open problem record; schedule PIR before next promote.

Target RTO: 120 minutes (aligned to Phase 15 guidance; do not claim live restore without drill evidence).

### 2.2 Go-live checklist (operators)

- [ ] RC1 PASS evidence present  
- [ ] Wave 9 Conditional/Go; human gates planned to flip PendingHumanSignOff → Approved  
- [ ] PRD-ENV-* verified live (≠ pilot)  
- [ ] CO-01…CO-11 timestamps recorded  
- [ ] PV-* executed with approvers  
- [ ] Recon spot-check signed  
- [ ] Hypercare started  
- [ ] Executive / Accountable Authority accept (human only)  

---

## 3. Go-live coordination roles

See `GOLIVE_COORDINATION_ROLES`: Executive Sponsor, Accountable Authority, Release Manager, Ops, DevOps, DBA, QA, Finance, Security, Service Desk / Incident Manager.

Human sign-off required for: Executive Sponsor, Accountable Authority, Release Manager, QA, Finance, Security.

---

## 4. Production validation checks

Registry: `PROD_VALIDATION_CHECKS` (**18 checks**) — auth, RBAC, customer, savings, collections, deposits/withdrawals, loans, accounting, reporting, dashboards, notifications, audit, offline sync, devices, API health, DB health, recon, monitoring.

AI remains **advisory only**. No auto-approve of money or security decisions.

---

## 5. Hypercare plan

| Field | Value |
|---|---|
| Duration | **14 days** primary |
| Extended watch | **30 days** |
| Cadence | Daily war-room (business days), then twice-weekly |
| Support | L1 Service Desk → L2 Ops/Branch → L3 DevOps/Eng; Phase 18 escalation |
| Tracking | Service desk + Audit/Reports hypercare board; feed CI backlog |

Daily review template: incidents, MTTA/MTTR, sync success, recon exceptions, flag/rollback watch, exec communication.

**Playbook detail:** use hypercare section in this doc + `HYPERCARE_PLAN` / `HYPERCARE_DAILY_REVIEW_TEMPLATE` in core. Exit when no open P1 from cutover, metrics within target or exception-approved, daily reviews closed, BAU handover accepted.

---

## 6. Post-implementation review (PIR)

Dimensions (`PIR_DIMENSIONS`): cutover vs plan, technical stability, financial controls, people & process, security & compliance, customer/branch impact, lessons & CI backlog.

Template fields per dimension: questions answered, evidence links, actions → CI backlog IDs, owner, due date.

---

## 7. Continuous improvement backlog process

`CI_BACKLOG_PROCESS`:

1. Intake from hypercare, PIR, branch feedback, security, tech debt.  
2. Types: Enhancement, ChangeRequest, TechDebt, Defect, ReleaseCandidate.  
3. Weekly triage (PO + Ops + Engineering).  
4. Schedule via Phase 19 change/release; CERT-002 for production hotfixes.  
5. Never auto-waive Critical money defects.

---

## 8. Knowledge transfer / handover

`KT_CHECKLIST` (8 items): runbooks, KB, monitoring walkthrough, money policy, RBAC/forbidden, offline recovery, hypercare→BAU roster, evidence pack locations.

---

## 9. Success metrics vs enterprise targets

`SUCCESS_METRICS` (**10 metrics**). Targets reference Phase 13 / 17 / 18 (SLO-001, SLO-006, OKPI_AVAILABILITY, OKPI_MTTA, OKPI_MTTR, OKPI_CSAT, sync_success_pct, etc.).

| ID | Metric | Target (summary) | Actual |
|---|---|---|---|
| SM-AVAIL | Availability | ≥99.5% | not measured in-repo |
| SM-SYNC | Sync success | ≥99% | not measured in-repo |
| SM-TXN | Txn accuracy | 100% sample match | not measured in-repo |
| SM-RECON | Recon completion | 100% signed / exception | not measured in-repo |
| SM-INC | P1/P2 incidents | 0 open P1 at exit | not measured in-repo |
| SM-MTTA | MTTA | ≤20 / ≤45 min | not measured in-repo |
| SM-MTTR | MTTR | ≤480 / ≤1440 min | not measured in-repo |
| SM-ADOPT | Adoption | ≥95% devices / 14d | not measured in-repo |
| SM-CSAT | CSAT | ≥4.0 / 5 | not measured in-repo |
| SM-PERF | API p95 | ≤500ms ops | not measured in-repo |

Ops fills `actual` in evidence after measurement — do not invent production numbers in-repo.

---

## 10. `evaluateProductionGoLive()` decisions

| Decision | Meaning |
|---|---|
| **FrameworkReady** | Pack + entry criteria OK; humans still must execute cutover/approvals |
| **AwaitingApprovals** | Framework ready; human gates emphasized |
| **Conditional** | Wave 9 / production conditions remain (or hard blockers present) |
| **Accepted** | Only when Wave 9 human gates + executive/AA approvals **recorded** and live cutover evidenced |

**Blocks full Production Accepted** unless Wave 9 human gates + executive approvals are recorded. Scripts **never** auto-set Executive Sign-Off to Approved.

Entry: RC1 PASS + Wave 9 Conditional/Go present. Human sign-offs must flip `PendingHumanSignOff` → `Approved` before Accepted.

CERT-001 / Phase 20: evidence emits **preview** (`certified: false`) until Accepted path.

---

## 11. Project closure report (framework)

Generated by `generateProjectClosureArtifact()` / included in `wave10-golive-evidence.json`.

- Waves 1–10 **implementation framework** complete  
- Production live: **no** until humans finish runbooks  
- Executive sign-off: PendingHumanSignOff  
- Evidence links: RC1, Wave 9, Wave 10  

---

## 12. Executive sign-off package

Draft: `docs/wave10-executive-signoff-draft.md` (from `validate:golive`). Humans replace PendingHumanSignOff with dated approvals offline; do not commit fabricated Approved statuses.

---

## 13. Evidence & scripts

```text
npm run validate:golive
npm run wave10:assess
```

Writes:

- `docs/release-evidence/wave10-golive-evidence.json`
- `docs/release-evidence/latest-golive-evidence.json`
- `artifacts/wave10/wave10-golive-evidence.json`

Exit **0** for FrameworkReady / Conditional / AwaitingApprovals awaiting humans.  
Exit **non-zero** only on hard blockers (missing RC1, broken pack, Wave 9 entry fail).

UI: Audit / Reports panels — cutover checklist, hypercare board, closure/sign-off (no new top-level nav).

---

## 14. Supporting detail (sibling sections)

### 14.1 Cutover checklist detail

See `CUTOVER_STEPS` CO-01…CO-13 and rollback `RB-PROD-001` above. Timestamp fields must be filled by operators during live cutover (null in synthetic evidence).

### 14.2 Hypercare playbook

1. Open war-room channel; page on-call.  
2. Track P1–P4 on hypercare board.  
3. Run daily review template.  
4. Escalate per Phase 18.  
5. Feed Enhancements/CRs/tech debt into CI process.  
6. Exit to BAU after durationDays + exit criteria.

### 14.3 CI backlog process

See §7 — weekly triage, Phase 19 scheduling, CERT-002 for hotfixes.

---

## Architecture constraints (unchanged)

- Shared SPA + Capacitor + Electron; Wave 3 `invokeApi`; **no Next.js**  
- Money: pesewas; 15 / 31 / 1000  
- `SUPER_ADMIN_FORBIDDEN`  
- AI advisory only  
- No new top-level nav — panels under Audit/Reports  
