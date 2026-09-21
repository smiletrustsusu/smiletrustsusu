# WAVE-09 — Pilot Deployment, UAT & Operational Readiness

**Status:** Framework + evidence pack delivered (not a live branch cutover claim)  
**Date:** 2026-09-16  
**Wave:** WAVE-09 · consumes RC1 (Wave 8) · Phases 14–20 catalogs  

---

## 1. Architecture decision

Wave 9 is **pilot / UAT / ops readiness**, not a Next.js rewrite and not a claim that a live bank branch has been cut over.

| Field | Value |
|---|---|
| Delivery name | **Pilot Deployment, UAT & Operational Readiness** (`PILOT_UAT_OPS_READINESS`) |
| Historical EIR name | Enterprise Features (`ENTERPRISE_FEATURES`) |
| Entry criterion | Wave 8 **RC1 PASS** (`docs/release-evidence/rc1-evidence.json`) |
| Production CERT-001 | **Deferred to WAVE-10** |

Enterprise notifications/monitoring/AI/BCDR catalogs remain Phase 12–18 sources of truth; Wave 9 executes the pilot pack over Waves 1–8 + RC1.

### Claim boundaries

| Claim | Wave 9 pack |
|---|---|
| Framework ready (checklists, scenarios, scripts, UI) | Yes |
| Synthetic pilot run seeded | Yes |
| Live pilot branch executed | **No** (human) |
| Executive Sponsor approved | **PendingHumanSignOff** |
| Production financially reconciled | **No** (procedures only) |

---

## 2. Pilot Deployment Plan

### 2.1 Objectives

1. Stand up an **isolated** pilot environment (tenant/region/branch/users/devices).
2. Execute mandatory UAT scenarios with evidence and approvers.
3. Confirm operational readiness (service desk, runbooks, monitoring, backup, DR awareness, IR, escalation, KB, on-call).
4. Deliver role training curricula and competency recording.
5. Produce a Go/No-Go recommendation for Wave 10 entry (**Conditional** allowed with listed conditions).

### 2.2 Phases (operator timeline)

| Phase | Activity | Owner |
|---|---|---|
| P0 | Confirm RC1 PASS; freeze pilot build | Platform / QA |
| P1 | Provision pilot env per PE-* checklist | DevOps |
| P2 | Seed users/devices/data; monitoring + backup | DevOps / Ops |
| P3 | Training delivery (TR-* tracks) | Training Lead |
| P4 | UAT execution (UAT-* scenarios) | QA + Branch staff |
| P5 | Ops readiness walkthrough (OR-*) | Ops / Service Desk |
| P6 | Feedback + issue triage | PO / QA |
| P7 | Go/No-Go review (human approvals) | Executive Sponsor |

### 2.3 Isolation from production

All `PE-*` items require `isolationFromProd: true`:

- Dedicated pilot tenant and API profile (`invokeApi` / `config.json` pilot slot)
- Pilot alert routes (not prod on-call)
- Report exports labeled PILOT
- No silent prod ledger write path
- Backup targets isolated

---

## 3. Participant groups & responsibilities

See registry `PILOT_PARTICIPANT_GROUPS` in `src/core/wave9-pilot-uat-ops.js`.

| ID | Group | Human sign-off |
|---|---|---|
| PG-EXEC | Executive Sponsor | Required for full Go |
| PG-PO | Product / Business Owner | Business UAT |
| PG-QA | QA Lead | UAT pack |
| PG-OPS | Operations / Service Desk | — |
| PG-BRANCH | Branch staff | — |
| PG-SEC | Security / Compliance | Security acceptance |
| PG-IT | Platform / DevOps | — |
| PG-TRAIN | Training Lead | — |

---

## 4. UAT scenarios

Full catalog: [wave9-uat-pack.md](./wave9-uat-pack.md) and `UAT_SCENARIOS` in core.

**Execute now (NORTHRISE MICRO SAVINGS):** step-by-step [uat/wave9-uat-execution-guide.md](./uat/wave9-uat-execution-guide.md) · machine run sheet [release-evidence/wave9-uat-run-sheet.json](./release-evidence/wave9-uat-run-sheet.json) · Audit/Reports **UAT execution recorder**. Login as **JOHN**; KBA only if developer support is needed.

Domains covered: auth, customer, savings, collections, deposits/withdrawals, loans, EOD, reports, dashboards, audit, notifications, offline, sync, admin.

Each scenario records: preconditions, steps, expected, **actual**, **pass/fail**, **evidence**, **approver** (`PendingHumanSignOff` until human).

Technical smoke items already proved by Wave 8 may be auto-marked `TechnicalPassPendingBusinessSignOff`; business sign-off remains human.

### Financial reconciliation

`UAT-RECON-01` provides the validation procedure and worksheet expectations. Automated balance smoke may confirm unit/invariant presence; **do not** mark production reconciled.

---

## 5. Operational readiness

Checks `OR-001`…`OR-010` map to Phase 18 ops + Phase 20 `RDY-*` (service desk, runbooks, monitoring, backup, DR, IR, escalation, KB, on-call, hypercare draft).

---

## 6. Training program outline

See [wave9-training-package.md](./wave9-training-package.md): Cashier, Collector, Branch Manager, Auditor, Platform Admin, Executive briefing — each with modules, exercises, competency checklist.

---

## 7. Migration / data validation checklist

- [ ] Pilot seed/anonymized snapshot loaded (no unapproved prod PII)
- [ ] Money unit = pesewas; interest default 15; collection days 31; cashier float 1000
- [ ] Wave 2 migration roots present for pilot DB profile
- [ ] Device credentials scoped to pilot tenant
- [ ] Sync queue empty or understood before day-1 UAT
- [ ] Backup restore slot scheduled (Phase 15 procedures)

---

## 8. Performance / security validation

| Area | Approach |
|---|---|
| Perf | Reuse Wave 8 in-process harness + Phase 17 thresholds; live load optional later |
| Security | RBAC, `SUPER_ADMIN_FORBIDDEN`, tenant isolation, AI advisory-only |
| Offline/DR | Wave 4 sync + Phase 15 procedure awareness (live DR cert → Wave 10) |
| Accessibility | Wave 8 a11y markers retained on Audit/Reports panels |

---

## 9. Feedback & issue process

1. Capture feedback in Feedback register (severity Critical → Enhancement).
2. Promote defects to Issue register; **open Critical ⇒ No-Go**.
3. PO prioritizes; QA verifies fixes; re-run affected UAT.
4. Enhancements may remain open under Conditional Go.

---

## 10. Go-live readiness review & success criteria

Dimensions `GL-*`: RC1, env isolation, UAT pack, ops, training, issues, recon procedure, executive, security, Wave 10 entry.

**Success (framework):**

- RC1 PASS
- Mandatory UAT scenarios executable & domain-complete
- Ops readiness checklist present
- Training package present
- Evidence JSON written
- Go/No-Go documented with human gates

**Success (live pilot — human):**

- Business UAT signed
- Training completions recorded
- Pilot recon accepted
- Executive Sponsor **Approved**

---

## 11. Go / No-Go process

```
RC1 PASS?
  No  → No-Go
  Yes → Pack complete + no open Critical?
          No  → No-Go
          Yes → Human approvals complete?
                  No  → Conditional (Ready for Executive Review)
                  Yes → Go (Wave 10 still runs CERT-001)
```

Automated assessment writes `docs/release-evidence/wave9-pilot-evidence.json`.  
`npm run validate:pilot` exits **non-zero on No-Go**; Conditional exits 0.

Draft report: [wave9-go-nogo-report.md](./wave9-go-nogo-report.md).

---

## 12. Key files

| Path | Role |
|---|---|
| `src/core/wave9-pilot-uat-ops.js` | Registries + `evaluateGoNoGo` + evidence builder |
| `scripts/wave9-pilot-assess.js` | `validate:pilot` / `wave9:assess` CLI |
| `src/ui/wave9-pilot-views.js` | Audit/Reports panels |
| `docs/wave9-uat-pack.md` | UAT catalog |
| `docs/wave9-training-package.md` | Training curricula |
| `docs/release-evidence/wave9-pilot-evidence.json` | Machine-readable evidence |
| `tests/wave9-pilot-uat.test.js` | Tests |

---

## 13. Operator commands

```powershell
npm run validate:rc
npm run validate:pilot
npm test
npm run prepare:web
```

---

## 14. Ready for Wave 10?

**Conditional** when framework is complete and RC1 PASS, with listed human conditions.  
**No** if Go/No-Go is No-Go.  
**Yes** only when human approvals clear conditions (rare at framework delivery).
