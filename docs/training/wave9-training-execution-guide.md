# Wave 9 Training Execution Guide — NORTHRISE MICRO SAVINGS pilot

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Pilot:** NORTHRISE MICRO SAVINGS  
**Gate:** HG-02 / GAP-003 — Training Completion  
**Status:** Executable **6/6** tracks · Completed **0/6** · Ready for human execution  
**Do not:** deploy production, apply production migrations, fabricate attendance, or mark tracks **Approved/Complete** without typed human names/dates  

Machine SoT: `src/core/wave9-pilot-uat-ops.js` (`TRAINING_TRACKS`) · Run sheet: `docs/release-evidence/wave9-training-run-sheet.json`  
Curriculum reference: [wave9-training-package.md](../wave9-training-package.md)  
In-app recorder: **Audit** or **Reports** → Pilot / UAT panel → **Training execution recorder** (no new top-level nav)

---

## Human-gates context (HG-01 deferred; HG-02 prepared)

| Gate | Topic | Status |
|------|-------|--------|
| **HG-01** | Business UAT (HA-PO / HA-QA) | **Deferred by request** — remains `PendingHumanSignOff`; do not fake approval. UAT pack stays ready under [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md). |
| **HG-02** | Training Completion | **Prepared** — remains `PendingHumanSignOff` until humans finish (this guide ready). |
| **HG-03** | Financial Reconciliation | **Prepared** — remains `PendingHumanSignOff` ([wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md)). |
| **HG-04** | Security Acceptance | **Prepared** — remains `PendingHumanSignOff` ([wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md)). |
| **HG-05** | Executive Sponsor Approval | **Current focus** — [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) |

---

## 1. How to start training today

1. Open the app (local / pilot web after `npm run prepare:web` if needed — **not** production).
2. **Log in as JOHN** (System Owner / facilitator oversight).  
   - JOHN schedules and oversees role tracks; cashiers/collectors/managers attend their tracks.  
   - **KBA** is developer support only — call KBA only if a platform defect blocks training.  
   - **JOHN must never see or manage the KBA account** (owner/developer isolation).
3. Open **Audit** (or **Reports**).
4. Scroll to **Pilot / UAT / Ops Readiness (Wave 9)** → **Training execution recorder (human)**.
5. Optionally click **Reload pilot evidence**, then use the training recorder.
6. Start with **TR-CASHIER** (first track below), or the track scheduled for today's cohort.
7. For each track: run modules/exercises → record **attendance** → record **competency** Pass/Fail → only then **Record track completion** with typed completer name + phrase.  
   - Attendance / competency saves do **not** clear `training_completion_pending`.  
   - Explicit completion requires typed name + `I CONFIRM TRAINING COMPLETION`.  
   - Use **Export for sign-off** to download JSON evidence.  
   - Use **Record HG-02 completion** only when all 6 tracks are completed with real names.

Money invariants (must hold in all money exercises): **pesewas** · interest **15** · collection days **31** · cashier float **1000** GHS.

---

## 2. Roles — who attends / how JOHN participates

| Who | Role in training |
|-----|------------------|
| JOHN | Facilitator oversight / System Owner; records completion; never auto-approves |
| Cashiers | TR-CASHIER attendees |
| Collectors | TR-COLLECTOR attendees |
| Branch Managers | TR-MANAGER attendees |
| Auditor / Compliance | TR-AUDITOR attendees |
| Platform Admin / Ops | TR-ADMIN attendees |
| Executive Sponsor | TR-EXEC briefing attendees |
| KBA | Developer support only — hidden from JOHN |

---

## 3. Recording fields (every track)

| Field | Values |
|-------|--------|
| Attendance | Participant name, optional role, facilitator, date |
| Competency | `pass` \| `fail` \| `blocked` + notes |
| Completer name / status | Human only — stays `PendingHumanSignOff` until explicit completion |
| Explicit completion | Typed name + phrase `I CONFIRM TRAINING COMPLETION` |
| HG-02 gate | Separate path after all tracks complete — same phrase |

**Hard rule:** Never clear `training_completion_pending` from attendance or competency alone.

---

## 4. Track scripts (6 / 6)

### TR-CASHIER — Cashier (4h)
- **Attendees:** Cashiers · **Facilitator:** JOHN or designated trainer
- **Modules:** Login & till · Deposits/withdrawals (pesewas) · Float limit 1000 · Receipts & exceptions
- **Exercises:**
  1. Post 5 deposits and 2 withdrawals on pilot accounts
  2. Attempt a float breach above 1000 GHS; document system response
  3. Complete an EOD till worksheet and escalate a sample variance
- **Competency checklist:**
  - [ ] Posts without balance errors (pesewas)
  - [ ] Explains float limit 1000
  - [ ] Escalates till variance correctly
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

### TR-COLLECTOR — Collector (4h)
- **Attendees:** Collectors · **Facilitator:** JOHN or designated trainer
- **Modules:** Route sheet · Offline capture · Sync & retry · Collection day (31)
- **Exercises:**
  1. Capture collections offline; confirm queue; reconnect and sync
  2. Force one sync retry; follow Phase 18 escalation if needed
  3. Submit day total and compare to sheet
- **Competency checklist:**
  - [ ] Works offline safely
  - [ ] Recognizes sync escalation
  - [ ] Day totals reconcile
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

### TR-MANAGER — Branch Manager (3h)
- **Attendees:** Branch managers · **Facilitator:** JOHN
- **Modules:** Approvals · EOD oversight · Reports/dashboards · Exceptions
- **Exercises:**
  1. Walk a loan path with **human** approval (AI advisory only)
  2. Review EOD variances and decide next action
  3. Export a daily operational report
- **Competency checklist:**
  - [ ] Does not treat AI as auto-approve
  - [ ] Interprets daily reports
  - [ ] Knows escalation contacts
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

### TR-AUDITOR — Auditor / Compliance (3h)
- **Attendees:** Auditors / compliance · **Facilitator:** JOHN
- **Modules:** Audit search · RBAC · Wave 8/9 evidence panels · Reconciliation procedures
- **Exercises:**
  1. Trace one money event in audit (actor + pesewas amount)
  2. Confirm `SUPER_ADMIN_FORBIDDEN` sample (`System.Reset`)
  3. Complete reconciliation worksheet; leave status PendingHumanSignOff until Finance/PO signs
- **Competency checklist:**
  - [ ] Locates audit evidence
  - [ ] Understands PendingHumanSignOff
  - [ ] Does not claim false production reconciliation
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

### TR-ADMIN — Platform Admin / Ops (5h)
- **Attendees:** Platform admin / ops · **Facilitator:** JOHN (KBA support only if blocked)
- **Modules:** Pilot isolation · Monitoring · Backup/restore slot · `validate:rc` / `validate:pilot` · Service desk + runbooks
- **Exercises:**
  1. Run `npm run validate:pilot` and interpret Conditional vs No-Go
  2. Send a test alert to the **pilot** on-call channel
  3. Walk one offline/sync runbook end-to-end
- **Competency checklist:**
  - [ ] Provisions/checks PE-* isolation
  - [ ] Interprets evidence JSON
  - [ ] Explains Wave 10 human gates
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

### TR-EXEC — Executive Sponsor briefing (1.5h)
- **Attendees:** Executive Sponsor · **Facilitator:** JOHN
- **Modules:** Pilot vs production · Go/No-Go dimensions · Human gates for Wave 10 · Success criteria
- **Exercises:**
  1. Review the Go/No-Go draft report
  2. List open conditions aloud
  3. Confirm understanding that Conditional ≠ Executive Approved
- **Competency checklist:**
  - [ ] Will not treat Conditional as full Go
  - [ ] Understands RC1 ≠ CERT-001
  - [ ] Owns executive sign-off gate
- **Attendance:** ________  **Competency:** ________  **Completer:** ________  **Date:** ________

---

## 5. After tracks

1. Export run sheet JSON from the training recorder (**Export for sign-off**).
2. File defects for any competency `fail` / `blocked` items before re-attempting completion.
3. When all 6 tracks have typed completers, use **Record HG-02 completion** (typed name + `I CONFIRM TRAINING COMPLETION`) — local run sheet only.
4. Humans then update `docs/release-evidence/wave9-pilot-evidence.json` `trainingResults` with the same names/dates (never agent-fabricated).
5. Continue HG-02 checklist in `docs/backlog/human-gates-runbook.md` when humans resume training. Current human-gates focus is **HG-05 Executive Sponsor Approval**.

---

## 6. Related docs

- [wave9-training-package.md](../wave9-training-package.md)
- [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) (HG-01 deferred)
- [wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md) (HG-03 prepared / pending)
- [wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md) (HG-04 prepared / pending)
- [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) (HG-05 current focus)
- [human-gates-runbook.md](../backlog/human-gates-runbook.md)
- [critical-path-report.md](../backlog/critical-path-report.md)
- Run sheet: [wave9-training-run-sheet.json](../release-evidence/wave9-training-run-sheet.json)

*Wave 9 training execution guide — prepared for human pilot execution; no live cutover claim.*
