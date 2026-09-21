# Module 9 — Withdrawals & Savings Redemption

The existing Withdrawals screen, **Record withdrawal** cash-out, **Submit for approval** pipeline, printed withdrawal form, and `Requested → Verified → Approved → Paid` path are unchanged. This module adds eligibility, a status matrix, atomic payment, receipts metadata, and a dashboard around that path.

## Live paths

1. **Field cash-out** — `handleWithdrawal` still posts a `Withdrawal` transaction immediately (collectors / assigned staff).
2. **Approval pipeline** — `Submit for approval` creates `state.withdrawalRequests` with status `Requested`. Advance buttons still move Verified → Approved → Paid.

`Paid` withdrawals cannot be edited or deleted. Corrections use **Reverse**, which marks the request Reversed and reverses the linked ledger pair.

## Compatibility aliases

| Stored status | Treated as |
|---|---|
| Requested | Submitted / Under Verification |
| Verified | Pending Approval |
| Approved | Ready for Payment |

Document checks, loan-clearance policy (`settings.requireClearLoansForWithdrawal`), and offline payment default **off**. Fees default to **0**, so existing amounts do not change.

## Atomic payment (client store)

There is no server SQL transaction in the EXE/APK local store. Payment:

1. Validates authentication/permissions/balance/status (no money movement).
2. Locks the request.
3. Posts the withdrawal + ledger.
4. Marks Paid.
5. On posting failure, restores the request snapshot.

Notifications are queued only after a successful save. Duplicate `idempotencyKey` returns the original Paid result.

## Untouched

Collections, loans, groups, branding, navigation, EXE/APK sync architecture, `customerBalance` formula, cashier approval limit (GHS 1,000), and existing withdrawal rows.
