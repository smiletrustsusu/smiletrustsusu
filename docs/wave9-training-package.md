# WAVE-09 — Training Package

Practical role curricula for the pilot. Machine SoT: `TRAINING_TRACKS` in `src/core/wave9-pilot-uat-ops.js`.  
Completion status defaults to **PendingHumanSignOff**.

**Execute now (HG-02):** [wave9-training-execution-guide.md](training/wave9-training-execution-guide.md) · run sheet [`wave9-training-run-sheet.json`](release-evidence/wave9-training-run-sheet.json) · in-app Audit/Reports Training recorder. HG-01 UAT is deferred; do not fabricate completions.

---

## TR-CASHIER — Cashier (4h)

**Modules:** Login & till · Deposits/withdrawals (pesewas) · Float limit 1000 · Receipts & exceptions  

**Exercises:**

1. Post 5 deposits and 2 withdrawals on pilot accounts.
2. Attempt a float breach above 1000 GHS; document system response.
3. Complete an EOD till worksheet and escalate a sample variance.

**Competency checklist:**

- [ ] Posts without balance errors (pesewas)
- [ ] Explains float limit 1000
- [ ] Escalates till variance correctly

---

## TR-COLLECTOR — Collector (4h)

**Modules:** Route sheet · Offline capture · Sync & retry · Collection day (31)  

**Exercises:**

1. Capture collections offline; confirm queue; reconnect and sync.
2. Force one sync retry; follow Phase 18 escalation if needed.
3. Submit day total and compare to sheet.

**Competency checklist:**

- [ ] Works offline safely
- [ ] Recognizes sync escalation
- [ ] Day totals reconcile

---

## TR-MANAGER — Branch Manager (3h)

**Modules:** Approvals · EOD oversight · Reports/dashboards · Exceptions  

**Exercises:**

1. Walk a loan path with **human** approval (AI advisory only).
2. Review EOD variances and decide next action.
3. Export a daily operational report.

**Competency checklist:**

- [ ] Does not treat AI as auto-approve
- [ ] Interprets daily reports
- [ ] Knows escalation contacts

---

## TR-AUDITOR — Auditor / Compliance (3h)

**Modules:** Audit search · RBAC · Wave 8/9 evidence panels · Reconciliation procedures  

**Exercises:**

1. Trace one money event in audit (actor + pesewas amount).
2. Confirm `SUPER_ADMIN_FORBIDDEN` sample (`System.Reset`).
3. Complete reconciliation worksheet; leave status PendingHumanSignOff until Finance/PO signs.

**Competency checklist:**

- [ ] Locates audit evidence
- [ ] Understands PendingHumanSignOff
- [ ] Does not claim false production reconciliation

---

## TR-ADMIN — Platform Admin / Ops (5h)

**Modules:** Pilot isolation · Monitoring · Backup/restore slot · `validate:rc` / `validate:pilot` · Service desk + runbooks  

**Exercises:**

1. Run `npm run validate:pilot` and interpret Conditional vs No-Go.
2. Send a test alert to the **pilot** on-call channel.
3. Walk one offline/sync runbook end-to-end.

**Competency checklist:**

- [ ] Provisions/checks PE-* isolation
- [ ] Interprets evidence JSON
- [ ] Explains Wave 10 human gates

---

## TR-EXEC — Executive Sponsor briefing (1.5h)

**Modules:** Pilot vs production · Go/No-Go dimensions · Human gates for Wave 10 · Success criteria  

**Exercises:**

1. Review the Go/No-Go draft report.
2. List open conditions aloud.
3. Confirm understanding that Conditional ≠ Executive Approved.

**Competency checklist:**

- [ ] Will not treat Conditional as full Go
- [ ] Understands RC1 ≠ CERT-001
- [ ] Owns executive sign-off gate

---

## Attendance / competency recording template

| Date | Track | Participant | Facilitator | Competency pass (Y/N) | Sign-off status |
|---|---|---|---|---|---|
|  |  |  |  |  | PendingHumanSignOff |

Store completed sheets with pilot evidence or ticket links; update `trainingResults` in the pilot run when recording electronically.
