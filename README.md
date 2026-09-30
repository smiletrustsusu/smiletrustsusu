# SMILE TRUST SUSU MANAGEMENT SYSTEM

Modern Ghana susu and personal-savings platform for **money collection agencies**: field agents, branches, groups, loans, accounting, and a member portal — on desktop, browser, and Android.

**Version 3.2.0** — agency platform: full RBAC, savings product catalog, withdrawal pipeline, expenses, accounting, group meetings, notifications, customer portal.

> **Going live with real money?** Read [`PRODUCTION.md`](PRODUCTION.md) first.

## What it covers

| Area | What you get |
| --- | --- |
| **Individual savings** | Daily, weekly, monthly, fixed, target, child education, business, funeral, holiday, emergency, investment |
| **Group susu** | Groups, officers, attendance, meeting collections, fines, welfare, cycle reports |
| **Agents** | Individual only, group only, or both; targets, commission, KYC, GPS collections |
| **Branches** | Unlimited locations with manager, contacts, and branch-filtered reports |
| **Loans** | Application → verify → approve → disburse → schedule → penalties → restructure → early settlement |
| **Withdrawals** | Request → verification → approval → payment → receipt |
| **Accounting** | Double-entry ledger, cashbook, trial balance, P&L, balance sheet, journals, bank rec |
| **Member portal** | Balance, history, statement, loans, withdrawal request, notifications |

The **Android agent app** is the existing Capacitor/offline app (not a separate Flutter rewrite). It already supports offline collections, customer search, receipts, sync, and GPS. A parallel Flutter client would split the ledger and is not required for field operations.

## Roles (configurable permissions)

| Role | Typical access |
| --- | --- |
| System Owner (`JOHN`) | Highest privilege; cannot be deleted; only this account can transfer ownership |
| Super Administrator (`KBA`) | Full operations except ownership transfer and deleting the System Owner |
| Managing Director | Agency-wide operations except permission matrix |
| Branch Manager (`Admin`) | Branch collections, groups, approvals |
| Operations Manager | Agents, groups, collections, exceptions |
| Accountant | Ledger, expenses, withdrawals, loan books |
| Cashier | Cash in/out, handover, paid withdrawals |
| Field Supervisor | Agent performance and field collections |
| Agent / Collector | Assigned customers and groups only |
| Group Coordinator | Meeting collections and group members |
| Customer Service Officer | KYC, withdrawal requests, messages |
| Auditor | Read-only reports and audit trail |
| Member portal | Own balances and requests |

Each collector still has per-screen permission checkboxes. Other roles use the default matrix, which Super Admin can override.

## Quick start

```powershell
copy config.example.json config.json
npm install
node server.js
```

Open `http://localhost:5173`.

**Staff login:** username created under Staff & Collectors. The apps ship with **no default passwords**. On a device connected to the business cloud, staff sign in online once with their own username and password (verified by the `staff-login` Edge Function), after which offline sign-in works on that device. A standalone device with no cloud asks you to create the System Owner (`JOHN`) password on first launch. Passwords are stored as PBKDF2 hashes, never plain text.

**Member portal:** login screen → **Member** → account number + PIN (default PIN = last 4 digits of the member's phone). When the cloud is configured the PIN is checked by the server and the device receives only that member's records.

## Architecture

| Layer | Path |
| --- | --- |
| UI | `app.js` + `src/ui/agency-views.js` |
| RBAC | `src/core/roles.js` |
| Products / KYC / agents | `src/core/savings-products.js`, `customer-kyc.js`, `agents.js` |
| Loans / withdrawals / expenses | `src/core/loans-workflow.js`, `withdrawals-workflow.js`, `expenses.js` |
| Accounting | `src/core/double-entry.js`, `accounting-reports.js` |
| Meetings / notifications / portal | `src/core/group-meetings.js`, `notifications.js`, `customer-portal.js` |
| Sync | `src/sync/` snapshot + PostgreSQL dual-write |
| Database | `supabase/migrations/` including `007_agency_platform.sql` |

Money is stored as **integer pesewas**. Posted collections are **append-only** (reverse, do not edit).

**Development standards:** All future code follows the [Enterprise Development Standards Manual (EDSM)](docs/enterprise-development-standards.md) (`docs/edsm-catalogs.md`, `src/core/canonical-standards-registry.js`). Authoritative delivery is the shared vanilla JS SPA + Capacitor APK + Electron EXE (not Next.js or Compose as primary).

## Database migrations

Run in Supabase SQL editor (backup first):

1. `supabase/rls.sql` (optional: migration 046 creates the snapshot table if it is missing)
2. `001_financial_core.sql` … `006_web_admin_compat.sql`
3. `007_agency_platform.sql` — branches extras, withdrawals, expenses, meetings, notifications, KYC

Then follow [`PRODUCTION.md`](PRODUCTION.md) for Auth, MFA, MoMo webhooks, and production mode.

```powershell
npm run import:relational
npm run sync
```

## Configuration

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "your-anon-key",
  "businessId": "your-business-id",
  "allowDeveloperLogin": false
}
```

`config.json` is bundled into the APK and EXE, so it may only hold public settings. `npm run prepare:web` copies an allowlist of keys into `www/config.json` and refuses to build if a password, sync key, sync token, service-role key or webhook secret would ship. Service-role keys live only in the Supabase Edge Function environment. Never commit `config.json`. See [`docs/SECURITY-CUTOVER.md`](docs/SECURITY-CUTOVER.md).

## Tests

```powershell
npm test
```

## Builds

```powershell
npm run prepare:web
npm run build:exe
npm run build:apk
npm run desktop
```

Collector mobile tabs: Home · Customers · Collect · Groups · More.

After `npm run build:apk`:

`android\app\build\outputs\apk\debug\SMILE TRUST SUSU MANAGEMENT SYSTEM-2.0.7.apk`

## First login

The System Owner (`JOHN`) and Super Administrator (`KBA`) accounts are created on first launch if missing, **without a password**. Nobody can sign in to them until a password is set: through first-run owner setup on a standalone device, or from the business cloud, where existing accounts keep the passwords already set. An account still carrying a legacy bootstrap hash must change its password before reaching the dashboard.
