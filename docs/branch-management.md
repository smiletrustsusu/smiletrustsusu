# Module 5 — Branch Management

Company **branches** are first-class records in `state.branches`. Collection **locations** (`state.groups`) remain the operational unit used by customers, agents, and collections. Each location is linked with `branchId` / `locationGroupId` (see `ensureBranchesFromLocations`).

You can run one branch or hundreds — the same screens paginate and filter.

## Screens

- **Branches / Locations** — HQ dashboard, register/edit branch, search, ranking, and (for Super Admin) the existing collection-location table.
- **Branch dashboard** — customers, agents, groups, collections, loans, cash, targets, transfers, announcements, calendar, documents, audit.

Branch managers see only their branch. System Owner, Super Admin, MD, Operations, Accountant, and Auditor see all branches.

## Permissions

| Action | Who |
|---|---|
| Create / edit / status | System Owner, Super Admin, MD, Operations, Branch Manager |
| Close a branch | System Owner (when closure approval is on) |
| View dashboards / export | HQ finance and audit roles |
| Location setup | Unchanged Staff / location forms |

## Transfers

Customers, agents, staff, susu groups, and cash (cash stays **Pending** until approved). History is stored in `branchTransfers` with a required reason.

## Offline

Branch records are part of the same snapshot / relational sync as customers and agents. Dashboards read local state, so they work offline and refresh when sync completes.

## Database

Run `supabase/migrations/010_branch_ops.sql` after 001–009.

## Future hooks

Multi-level approval matrices, live maps, and inter-branch GL posting can attach to `branchTransfers`, `branch.settings.approvals`, and `branchDashboard` without a second branch store.
