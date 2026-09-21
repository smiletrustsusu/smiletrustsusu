# Module 11 — Reports, Analytics & Business Intelligence

The existing Reports screen remains live: Cash In/Out cards, period buttons, Daily Money Received, Member Financial Report, Transaction Ledger, Members Behind, Break/Distribution, Audit Trail, agent/branch extras, and Individual Savings Collection Reports. This module adds a Business Intelligence panel **below** those tables.

There is no REST/GraphQL API in this EXE/APK. Reports run in the client against the unified store. Email delivery queues an in-app/export row; it does not send SMTP. Excel export is CSV that Excel opens. PDF is the existing print layout.

## Source of truth

| Kind | Source |
|---|---|
| Financial (trial balance, P&L, balance sheet, cash flow, cash book, journals, revenue, expenses, savings liability, cash position) | Accounting GL (`ledgerEntries` / `accounting-reports.js`) |
| Operational (registers, attendance, KYC, missed collections) | Business modules |
| Hybrid (branch performance, executive summary, PAR) | Both, labelled separately |

Financial reports **never** recalculate customer or cash balances. They reuse Module 10. Unbalanced trial balance or `Assets ≠ Liabilities + Equity` **rejects** generation and writes a report activity log.

Interest income is GL code **4000**, not loan repayment rows.

## Global terms (entire system)

Savings is a **balance**. A Collection is an operational receipt. A Contribution is a collection into savings/group funds. A Deposit is the accounting credit that follows a posted collection. Withdrawals reduce savings and cash. Loan repayments never increase savings. Only **posted** (non-reversed, non-draft) transactions affect financial reports. Corrections use reversal, not edits.

Live collection/loan/withdrawal screens keep their existing status strings. `src/core/txn-status.js` **derives** the global lifecycle/validation/approval/accounting/payment fields for reporting. `src/core/txn-lifecycle.js` is the shared matrix; it does not replace `handleCollection`.

## Permissions

New actions: `Reports.Print`, `Reports.Schedule`, `Reports.Custom`, `Reports.Executive`, `Reports.Accounting`, `Reports.Audit`.

Collectors see assigned customers only. Branch managers see their branch. Owner / Super Admin / MD / Operations / Accountant / Auditor have organisation (or accounting) scope as today.

## KPI defaults (configurable via `settings.reportKpiWeights`)

Agent: 40% collection, 30% recovery, 20% attendance, 10% satisfaction. PAR threshold: 30 days.

## Untouched

Collection posting, `customerBalance`, loan `totalDue`, Cashier GHS 1,000 limit, Accounting screen, navigation, branding, EXE/APK sync.
