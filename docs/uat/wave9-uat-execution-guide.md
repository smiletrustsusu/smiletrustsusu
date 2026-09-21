# Wave 9 UAT Execution Guide — NORTHRISE MICRO SAVINGS pilot

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Pilot:** NORTHRISE MICRO SAVINGS  
**Gate:** HG-01 / GAP-003 — business UAT (HA-PO / HA-QA)  
**Status:** Executable **21/21** · Business signed **0/21** · **HG-01 deferred by request** (PendingHumanSignOff) · Current human-gates focus: **HG-05 Executive Sponsor Approval**  
**Do not:** deploy production, apply production migrations, or mark HA-* **Approved** without typed human names/dates  

Machine SoT: `src/core/wave9-pilot-uat-ops.js` (`UAT_SCENARIOS`) · Run sheet: `docs/release-evidence/wave9-uat-run-sheet.json`  
In-app recorder: **Audit** or **Reports** → Pilot / UAT panel (no new top-level nav)

---

## Human-gates status (2026-09-20)

**HG-01 (this guide) is deferred by request** — leave UAT `PendingHumanSignOff`; do not fake HA-PO / HA-QA approval.  
**HG-02 Training / HG-03 Recon / HG-04 Security** — prepared; remain `PendingHumanSignOff` until humans complete evidence.  
**Current focus: HG-05 Executive Sponsor Approval** — follow [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) and [`wave9-executive-run-sheet.json`](../release-evidence/wave9-executive-run-sheet.json).  
After HG-05 human path → Wave 10 cutover still blocked until approvals are real.

## 1. How to start UAT today

1. Open the app (local / pilot web after `npm run prepare:web` if needed — **not** production).
2. **Log in as JOHN** (System Owner / business operator).  
   - Use JOHN for all business UAT steps.  
   - **KBA** is developer support only — call KBA only if a defect needs platform help.  
   - **JOHN must never see or manage the KBA account** (owner/developer isolation).
3. Open **Audit** (or **Reports**).
4. Scroll to **Pilot / UAT / Ops Readiness (Wave 9)**.
5. Optionally click **Reload pilot evidence**, then use **UAT execution recorder**.
6. Start with **UAT-AUTH-01** (first scenario below).
7. For each scenario: run steps → set Pass/Fail + notes → **Save result**.  
   - Saving Pass/Fail does **not** approve HA-PO / HA-QA.  
   - Use **Export for sign-off** to download JSON evidence.  
   - Use **Record human approval** only when a real person types their name and the confirmation phrase.

Money invariants (must hold throughout): **pesewas** · interest **15** · collection days **31** · cashier float **1000** GHS.

---

## 2. Roles

| Who | Role in UAT |
|-----|-------------|
| JOHN | Primary executor / owner operator for business UAT |
| Product Owner (HA-PO) | Business acceptance after scenarios pass |
| QA Lead (HA-QA) | Pack completeness + defect gate |
| KBA | Developer support only — hidden from JOHN |

---

## 3. Recording fields (every scenario)

| Field | Values |
|-------|--------|
| Pass/Fail | `pass` \| `fail` \| `blocked` |
| Actual / notes | What you observed |
| Evidence | Screenshot id, export path, ticket |
| Executed by / date | Operator name + date |
| Approver name / status | Human only — stays `PendingHumanSignOff` until explicit sign-off |
| HA-PO / HA-QA | Separate path: typed name + phrase `I CONFIRM HUMAN APPROVAL` |

---

## 4. Scenario scripts (21 / 21)

### UAT-AUTH-01 — Login, session timeout, and role-denied action
- **Domain:** auth · **Tech smoke:** Y (still needs business sign-off)
- **Preconditions:** Pilot users seeded; RBAC matrix loaded
- **Steps:**
  1. Login as cashier (or use a limited role under JOHN’s pilot setup)
  2. Attempt `System.Reset`
  3. Wait for idle timeout / re-auth
- **Expected:** Login succeeds; `System.Reset` forbidden; session requires re-auth
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-AUTH-02 — Multi-role switch and audit of privileged actions
- **Domain:** auth
- **Preconditions:** Auditor + admin pilot accounts
- **Steps:** Login as auditor → Open Audit panel → Export audit sample
- **Expected:** Access granted per RBAC; audit events recorded
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-CUST-01 — Register customer and verify KYC fields
- **Domain:** customer
- **Preconditions:** Cashier or customer-officer role
- **Steps:** Create customer → Capture required ID fields → Save and reopen
- **Expected:** Customer persisted; incomplete KYC blocked
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-CUST-02 — Search / update without corrupting balances
- **Domain:** customer
- **Preconditions:** Existing pilot customer with savings
- **Steps:** Search by name/phone → Update contact → Confirm balances unchanged
- **Expected:** Profile updated; ledger balances identical (pesewas)
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-SAVE-01 — Open savings product and post contribution
- **Domain:** savings
- **Preconditions:** Savings product configured; customer enrolled
- **Steps:** Open account → Post contribution in pesewas → View statement
- **Expected:** Balance increases by posted pesewas; interest policy remains 15% default
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-COLL-01 — Collector day cycle (31-day awareness)
- **Domain:** collections
- **Preconditions:** Collector route assigned; collection day calendar
- **Steps:** Open collection sheet → Record collections → Submit day total
- **Expected:** Day totals reconcile; collection cycle days = 31 documented
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-COLL-02 — Cashier float limit 1000 GHS enforced
- **Domain:** collections
- **Preconditions:** Cashier float tracking enabled
- **Steps:** Attempt float breach above 1000 → Attempt allowed amount
- **Expected:** Breach blocked or escalated; allowed post succeeds
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-TXN-01 — Deposit and withdrawal with receipt
- **Domain:** deposits_withdrawals
- **Preconditions:** Active savings account
- **Steps:** Deposit → Withdraw within balance → Print/export receipt
- **Expected:** Balances correct in pesewas; receipt references transaction ids
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-TXN-02 — Insufficient funds blocked
- **Domain:** deposits_withdrawals
- **Preconditions:** Known low-balance account
- **Steps:** Attempt withdrawal exceeding balance
- **Expected:** Transaction rejected; no partial ledger corruption
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-LOAN-01 — AI advisory does not auto-approve
- **Domain:** loans
- **Preconditions:** Loan product available; AI advisory module present
- **Steps:** Create loan application → Request AI advisory → Attempt approve without human
- **Expected:** Advisory shown; no autonomous approve; human approval required
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-LOAN-02 — Disbursement and repayment schedule
- **Domain:** loans
- **Preconditions:** Approved loan application
- **Steps:** Disburse → View schedule → Post one repayment
- **Expected:** Schedule generated; repayment reduces outstanding correctly
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-EOD-01 — EOD close and till reconciliation procedure
- **Domain:** eod
- **Preconditions:** Day transactions posted; cashier till open
- **Steps:** Run EOD checklist → Compare till vs system → Close day
- **Expected:** EOD status recorded; variance procedure available if mismatch
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-RECON-01 — Financial reconciliation procedure (no false prod claim)
- **Domain:** eod
- **Preconditions:** EOD closed; pilot ledger export available
- **Steps:**
  1. Export trial balance / account balances
  2. Compare to till + collection sheets
  3. Document variances
  4. Keep sign-off `PendingHumanSignOff` until business owner approves
- **Expected:** Worksheet completed; never auto-claimed as production reconciled
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-RPT-01 — Operational reports export
- **Domain:** reports · **Tech smoke:** Y
- **Preconditions:** Reports.View permission
- **Steps:** Open Reports → Export collections / savings summary
- **Expected:** Export succeeds; PILOT label or tenant id in metadata when configured
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-DASH-01 — Wave 7 analytics KPI dashboard
- **Domain:** dashboards · **Tech smoke:** Y
- **Preconditions:** Analytics panel access
- **Steps:** Open Audit/Reports analytics → Verify KPI tiles
- **Expected:** KPIs render; no posting side effects
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-AUD-01 — Audit trail for money-moving action
- **Domain:** audit
- **Preconditions:** Recent deposit posted
- **Steps:** Locate audit events for transaction → Verify actor + amount
- **Expected:** Immutable audit row; amount in pesewas
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-NOTIF-01 — Pilot alert channel smoke
- **Domain:** notifications
- **Preconditions:** Pilot alert route configured
- **Steps:** Trigger test alert → Confirm receipt on pilot channel
- **Expected:** Alert received; not routed to production on-call
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-OFF-01 — Offline capture (Capacitor path)
- **Domain:** offline · **Tech smoke:** Y
- **Preconditions:** Wave 4 sync engine; device offline
- **Steps:** Capture collection offline → Queue visible → Reconnect
- **Expected:** Queue retained; no financial LWW corruption on sync
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-SYNC-01 — Sync conflict / retry / recovery
- **Domain:** sync · **Tech smoke:** Y
- **Preconditions:** Offline queue with pending items
- **Steps:** Force sync → Simulate retry → Confirm recovery runbook path
- **Expected:** Sync completes or escalates per Phase 18; balances consistent
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-ADM-01 — Admin portal search + ops monitoring
- **Domain:** admin · **Tech smoke:** Y
- **Preconditions:** Admin role
- **Steps:** Global search → Open ops monitoring under Audit/Reports
- **Expected:** Scoped search results; no new top-level nav required
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

### UAT-ADM-02 — Wave 8 RC panel visible
- **Domain:** admin · **Tech smoke:** Y
- **Preconditions:** Audit.View or Reports.View
- **Steps:** Open Release Certification panel → Confirm last RC decision surface
- **Expected:** Panel renders; RC1 PASS visible when evidence loaded
- **Pass/Fail:** ________  **Approver:** ________  **Date:** ________

---

## 5. After scenarios

1. Export run sheet JSON from the UAT recorder (**Export for sign-off**).
2. File defects for any `fail` / `blocked` items (Critical/High must be zero before HA-QA).
3. Product Owner and QA Lead use **Record human approval** (typed name + `I CONFIRM HUMAN APPROVAL`) — this updates the local run sheet only.
4. Humans then update `docs/release-evidence/wave9-pilot-evidence.json` gates with the same names/dates (never agent-fabricated).
5. Continue HG-01 checklist in `docs/backlog/human-gates-runbook.md`.

---

## 6. Related docs

- [wave9-pilot-uat.md](../wave9-pilot-uat.md)
- [wave9-uat-pack.md](../wave9-uat-pack.md)
- [human-gates-runbook.md](../backlog/human-gates-runbook.md)
- [critical-path-report.md](../backlog/critical-path-report.md)
- Run sheet: [wave9-uat-run-sheet.json](../release-evidence/wave9-uat-run-sheet.json)

*Wave 9 UAT execution guide — prepared for human pilot execution; no live cutover claim.*
