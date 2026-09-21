# Human-gated production checklists (do not auto-approve)

**Purpose:** Actionable runbooks for gaps that require **human** sign-off.  
**Rule:** Never flip evidence JSON `PendingHumanSignOff` → `Approved` or `cert001.certified` → `true` from automation or agent work.

Related: `docs/wave9-pilot-uat.md`, `docs/wave10-production-golive.md`, `docs/release-evidence/*`, **[org-handoff-checklist.md](./org-handoff-checklist.md)** (env vars, signing, git remote, HA who-signs, UAT migrations).

---

## GAP-003 — Wave 9 HA-* (TASK-000181) — Ready / human

Owners flip gates in Wave 9 evidence after real pilot review.

**HG sequence (NORTHRISE MICRO SAVINGS):**
- **HG-01 Business UAT** — **deferred by request**; remains `PendingHumanSignOff` (do not fake approval). Pack ready: [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) · [`wave9-uat-run-sheet.json`](../release-evidence/wave9-uat-run-sheet.json).
- **HG-02 Training Completion** — **prepared**; remains `PendingHumanSignOff` until humans finish training. Pack: [wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md) · [`wave9-training-run-sheet.json`](../release-evidence/wave9-training-run-sheet.json) · in-app Training recorder. Attendance/competency does **not** clear `training_completion_pending` without typed name + `I CONFIRM TRAINING COMPLETION`.
- **HG-03 Financial Reconciliation** — **prepared**; remains `PendingHumanSignOff` until humans finish recon. Pack: [wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md) · [`wave9-recon-run-sheet.json`](../release-evidence/wave9-recon-run-sheet.json) · in-app Financial reconciliation recorder. Never set `claim.productionReconciled: true` from the recorder.
- **HG-04 Security Acceptance** — **prepared**; remains `PendingHumanSignOff` until humans finish security. Pack: [wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md) · [`wave9-security-run-sheet.json`](../release-evidence/wave9-security-run-sheet.json) · in-app Security acceptance recorder. Never auto-approve HA-SEC.
- **HG-05 Executive Sponsor Approval** — **current focus** (HA-EXEC / HA-W9-EXEC). Execute: [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) · [`wave9-executive-run-sheet.json`](../release-evidence/wave9-executive-run-sheet.json) · in-app **Audit / Reports → Executive Sponsor recorder**. Login as **JOHN**; Executive Sponsor records Full Go / Conditional Go / No-Go with typed name + `I CONFIRM EXECUTIVE SPONSOR DECISION`. Full Go while HG-01…04 pending requires **Accept open conditions** + typed condition list. Never auto-approve HA-EXEC. After HG-05 human path → **Wave 10 cutover still blocked** until approvals are real (do not mark Wave 10 Accepted / CERT-001 certified from pack preparation alone).

| Gate | Owner role | Evidence required | Status target |
|------|------------|-------------------|---------------|
| HA-EXEC / HA-W9-EXEC | Executive Sponsor | Pilot go/no-go memo (HG-05) | Approved (or No-Go recorded) |
| HA-PO | Product Owner | UAT business acceptance (HG-01 deferred) | Approved |
| HA-QA | QA Lead | UAT pack 21/21 + defects closed (HG-01 deferred) | Approved |
| HA-SEC | Security Governance | Security acceptance checklist (HG-04 prepared) | Approved |
| HA-RECON / HA-FIN | Finance / Recon | Financial recon sign-off (HG-03 prepared) | Approved |
| HA-AA / HA-RM | Accountable Authority / Release Manager | Readiness attestation | Approved |

**Checklist**
- [ ] Business UAT signed (HG-01) — **deferred**; leave PendingHumanSignOff until humans resume
- [ ] Training completion recorded (HG-02) — **prepared**; leave PendingHumanSignOff until humans sign (0/6 tracks)
- [ ] Financial reconciliation signed (HG-03) — **prepared**; leave PendingHumanSignOff until humans sign (0/8 checklist)
- [ ] Security acceptance signed (HG-04) — **prepared**; leave PendingHumanSignOff until humans sign (0/9 checklist)
- [ ] Executive sponsor signed (HG-05) — **current focus**; execute executive guide + recorder; HA-EXEC PendingHumanSignOff until humans decide
- [ ] Evidence files updated with names, dates, artifact links
- [ ] Wave 10 cutover still blocked until HA-* approvals are real (humans must actually sign)

---

## GAP-015 — MFA proof (TASK-000182) — Ready / human+UAT

- [ ] Enroll MFA for a Manager test account in UAT
- [ ] Challenge path succeeds and fails correctly on wrong TOTP
- [ ] Record screenshots / timestamps in PV or Wave 9 evidence
- [ ] Confirm `user_mfa_secrets` path used (migration 005)

---

## GAP-001 — Live cutover CO-01…CO-13 (TASK-000188) — Blocked

**Blocked until:** GAP-003 Approved + GAP-006 PRODUCTION.md migrations list current (docs done 2026-09-18).

Execute under `docs/wave10-production-golive.md`. For each CO-* step:

- [ ] Owner named
- [ ] Start / end timestamps
- [ ] Success or rollback invoked
- [ ] Evidence path recorded

Do not mark cutover complete in evidence until all 13 are timestamped.

---

## GAP-009 — PV-* business acceptance (TASK-000189) — Blocked

- [ ] Complete PV checks beyond technical smoke PV-001…006
- [ ] Business approvers sign 18/18 (or documented waive with AA)
- [ ] Fill SM-* actuals (not null)

---

## GAP-002 — CERT-001 (TASK-000191) — Blocked

- [ ] Live cutover evidence present
- [ ] Wave 9 HA-* Approved
- [ ] Accountable Authority records certification
- [ ] Only then set `cert001.certified: true` with linkage

---

## GAP-011 — Hypercare HC-001 (TASK-000190) — Blocked

Start **after** cutover: daily reviews, P1–P4 tracking, exit criteria per Wave 10 pack.

---

*human-gates-runbook.md — 2026-09-20 — HG-05 current focus; all HG packs prepared; no fake Approvals; Wave 10 still blocked until real sign-off*
