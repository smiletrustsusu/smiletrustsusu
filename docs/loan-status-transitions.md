# Loan status transitions

Existing loan screens, Approve / Disburse buttons, repayment, interest, receipts, and `totalDue` math are unchanged. New loans still start as **Pending**. Approve still goes **Pending → Approved**. Disburse still goes **Approved → Active** (the matrix value `Disbursed` is stored as **Active** so repayment tracking starts immediately).

## What was added

A transition matrix in `src/core/loans-workflow.js`. Any status change outside the matrix is rejected, recorded on the loan (`deniedTransitions` + `statusHistory`), and written to the existing audit log.

Compatibility aliases (existing records are not renamed):

| Stored status | Treated as |
|---|---|
| Pending | Submitted / Pending Approval (Approve still works) |
| Verified | Under Review |
| Settled | Completed (early-settlement engine status; kept) |

## Automatic updates

- Disbursement succeeds → **Active**
- Full repayment → **Completed**
- Approved restructuring → **Restructured** (previous schedules stay in `restructureHistory`)
- Overdue beyond a threshold → **Defaulted** via `evaluateLoanDefault` (not run on every screen render)
- Recovery payment on Defaulted / Written Off → **Recovered**, then **Completed** if the balance is zero

Document checks and maker-checker default **off**, so current disbursement still works.

## Untouched

Collections, groups, receipts, branding, navigation, EXE/APK sync, interest calculation, double-entry amounts, roles, and existing loan data.
