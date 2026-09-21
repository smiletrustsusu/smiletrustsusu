# Module 6 — Individual Savings Collection

Daily field collection stays on the existing **Collections** screen. This module adds product validation, a faster agent desk, Ghana wallet methods, missed reasons, bulk entry, adjustments, and collection analytics. It does **not** replace receipts, offline sync, reversals, daily closing, or double-entry posting.

## What agents use

- **Collections** — today's target, assigned customers, keypad, swipe, offline badge, collect & receipt.
- **Bulk mode** — market days: tick customers, enter amounts, save many cash receipts at once.
- **Daily Closing** and **Cash Handover** — still the end-of-day cash/MoMo reconciliation.
- **Reports** — collection totals, payment-method split, top customers for the selected period.

## Savings products

Configured under **Savings Products**. Built-in types include daily, weekly, monthly, fixed, target, business, child education, holiday, emergency, investment, funeral, group susu, and a custom product. Each product can set frequency, min/max, fees, interest, penalties, and maturity.

## Payment methods

Cash, MTN Mobile Money, Telecel Cash, AirtelTigo Money, Mobile Money (legacy), Bank Transfer, POS/Card, Cheque. Electronic wallets still require a unique reference.

## Adjustments and reversals

- **Reverse** — existing full reversal + approval workflow.
- **Adjust** — authorized finance users request a partial reduction; System Owner / Super Admin / MD / Branch Manager / Operations / Accountant approve. The original collection is reduced and a balancing ledger entry is posted. Soft change only — collections are never edited in place by collectors.

## Offline

Collections already enqueue when the device is offline. Receipts print locally. Failed uploads retry from the existing sync queue. A sync-complete notification is raised after a successful flush.

## Data (local + sync)

Existing `collections[]` remains authoritative. Added state:

- `collectionAdjustments`
- `collectionActivityLogs`
- `collectionTargets` (optional daily override of the product-based target)

PostgreSQL: run `supabase/migrations/011_collection_ops.sql` after 001–010.

## Permissions

| Action | Who |
|---|---|
| Collect / miss / bulk | Assigned collectors and staff with collection rights |
| Verify electronic payments | Existing verify-payment roles |
| Request reversal | Existing reversal rights |
| Approve adjustment | Finance approvers (`canApproveFinancial`) |
| View all history / analytics | Managers and above |

## Accounting

Deposits still post `Susu Deposit` double-entry to cash or the matching wallet/bank/POS account. Approved adjustments post `Collection Adjustment`. Reversals keep the existing reversal ledger path.
