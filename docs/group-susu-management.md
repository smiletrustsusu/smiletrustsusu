# Module 7 — Group Susu Management

Susu groups remain `state.susuGroups` with memberships, meetings, collections (`susuGroupId`), and end-of-cycle distributions. This module adds group types, a live meeting wizard, welfare, fines, shares, share-out, and action-level RBAC. It does **not** replace the existing Groups or Meetings screens.

## Screens

- **Susu Groups** — create/edit groups (type, status, venue, financial year, leadership), search/filter, dashboard, members, welfare/shares, share-out preview.
- **Start Meeting** — attendance → contributions → fines/welfare → loan repayments → minutes → close (posts receipts and ledger).
- **Group Meetings** — existing bulk form still records a full meeting in one save.
- **End-of-cycle distribution** — existing approval/payout path stays; share-out adds a calculated payout request.

## Group types

Daily, Weekly, Monthly, VSLA, ROSCA, church, market, farmers, teachers, women's, youth, staff welfare, and custom.

## Status

Active, Pending, Suspended, Closed, Completed. Closed/suspended groups are inactive (soft). Permanent delete remains System Owner only via existing owner rules.

## RBAC

Screen access is still `roles.js`. Actions are gated by `src/core/rbac.js`:

| Action examples | Owner | Super Admin | Collector | Auditor |
|---|---|---|---|---|
| Group.Create | Yes | Yes | No | No |
| Group.Meeting | Yes | Yes | Yes | No |
| Savings.Collect | Yes | Yes | Yes | No |
| Owner.Transfer | Yes | **No** | No | No |
| Audit.View | Yes | Yes | No | Yes |

Approval limits (GHS): Cashier 1,000 · Branch Manager 20,000 · Operations 100,000 · MD / Super Admin / Owner unlimited. Withdrawal approval checks the limit.

Data scope: collectors/coordinators see assigned groups only (`filterSusuGroupsForUser`). Branch roles stay on their branch. Owner sees all.

## Offline

Starting a meeting while offline enqueues `kind: "meeting"` beside collections. Close-meeting collections use the same collection store and sync queue.

## Accounting

Closing a meeting posts `Susu Deposit` double-entry for each contribution. Fines and welfare are stored on the group ledgers. Share purchases increase `shareCapitalPesewas`.

## PostgreSQL

Run `supabase/migrations/012_group_ops.sql` after 001–011.
