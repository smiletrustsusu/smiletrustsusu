# Module 10 — Accounting & General Ledger (Ghana)

The existing Accounting screen remains the live surface: trial balance, income statement, balance sheet, cashbook, bank reconciliation, chart of accounts, and the **Manual Journal** form. This module adds a Ghana-oriented default chart (merged, not replaced), fiscal-year helpers, period close, and tax **calculation and accounting only**.

## Live paths that stay untouched

- Collections still post through `handleCollection` → `postDoubleEntry` (Dr Cash/MoMo/Bank, Cr Customer Savings 1100).
- Withdrawals and loan disbursement/repayment posting are unchanged.
- MoMo wallets still map to system account `account:momo` (chart code **1010**). Codes 1011–1013 (MTN / Telecel / AirtelTigo) are chart accounts for reporting; they are not a new posting path.
- `customerBalance`, interest, and the Cashier GHS 1,000 approval limit are unchanged.
- No GRA filing, e-submission, or statutory tax-return generator exists.

## Ghana defaults (configurable)

| Setting | Default |
|---|---|
| Currency | GHS |
| Fiscal year | 1 January – 31 December |
| Locale / timezone | en-GH / Africa/Accra |
| Taxes | None (Draft/empty). Transactions are not taxed until an **Active** tax is saved. |

Existing businesses keep their current chart names for codes already stored. Missing Ghana codes are **appended** by `ensureChartOfAccounts`.

## Tax configuration boundaries

The engine calculates, posts (when a taxable charge is recorded via `postTaxAccountingEntry`), and reports tax. It does **not** file returns or talk to GRA.

- Percentage and Fixed Amount only in this release.
- Rate changes are versioned in `taxConfigHistory`. Posted `taxAmount` values are never recalculated.
- Only Settings.Edit or Accounting.Edit (Owner, Super Admin, Accountant, etc.) may change tax definitions.

## Period close

`Accounting.ClosePeriod` (Accountant / Owner / Super Admin) can close a date range after:

- trial balance is balanced
- no pending withdrawal requests
- no loans still Pending or Approved
- no pending collection adjustments
- bank rec difference is zero

Manual journals (and the Expenses form) reject dates inside a closed period. Field collections are **not** blocked by period close in this release.

## Untouched

Collections, loans, groups, branding, navigation, EXE/APK sync, double-entry channel mapping, and existing journal rows.
