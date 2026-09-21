# Module 4 — Agent & Collector Management

Field agents remain **user accounts** with role `Collector` (or Field Supervisor / Group Coordinator). This module adds operations data around those accounts.

## Screens

- **Staff & Collectors** — create the login, password, passport photo, branch, and collection authority.
- **Agents / My Desk** — HQ and supervisors see all agents, analytics, routes, and profiles. Collectors see only their desk (clock in/out, expenses, leave, visits).
- **Agent profile** — customers, groups, rights, attendance, leave, visits, documents, notes, transfer, status.
- Existing **Cash Handover**, **Collections**, **Dashboard**, and **Expenses** screens stay the source of truth for cash and collections.

## Data (local + sync)

Stored on the user record: employee number, KYC, employment, product permissions, notes, documents, activity.

Collections on `state`:

- `agentRoutes`
- `agentAttendance`
- `agentLeave`
- `agentVisits`

PostgreSQL: run `supabase/migrations/009_agent_ops.sql` after 001–008.

## Permissions

| Action | Who |
|---|---|
| Create login | Staff managers (existing Staff screen) |
| View all agents | System Owner, Super Admin, MD, Operations, Branch Manager, Field Supervisor |
| Clock in / field expense / leave request | The agent |
| Approve leave | Supervisors and above |
| Approve expense | Accountant and above |
| Hard-delete staff | Existing owner rules |

## Offline

Collectors already work offline for customers and collections. Clock-in, visits, and expenses save locally and sync with the rest of the snapshot / relational queue.

## Configuration

- Per-agent **GPS tracking** checkbox (optional). When enabled, clock-in and visits capture coordinates if the device allows it.
- Commission type and rate on the staff form drive wallet and KPI commission.

## API / sync

The app uses the existing authenticated snapshot + relational sync. Agent ops collections merge by `id` like other modules. There is no separate public REST surface; authorization is the same session RBAC used by Staff and Collections.

## Future hooks

Biometric attendance, NFC cards, route optimization, and AI scoring can attach to `agentAttendance`, `agentRoutes`, and `agentKpis` without a second agent store.
