# Module 30 — Enterprise Platform Administration

Governs Modules 1–29 platform operation (tenants, config, flags, licenses, environments, maintenance, deployment metadata, ops center, DR governance).

**Does not duplicate** collections/loan/BI/AI/Integration Hub/Rule Engine business logic or post money. Money remains integer **pesewas**; `customerBalance` in `app.js` is untouched.

## Feature flag

`enablePlatformAdmin` (default **on**) in `system-config.js` `FEATURE_FLAG_CATALOG`.

Flag evaluation extends `system-config`:

- Base enable/disable via existing `featureFlags` / `isFeatureEnabled` (now also honors `killSwitch` and schedule fields on the flag row).
- Gradual %, branch, tenant, kill-switch, and schedule **rules** live in `platformFeatureFlagRules` and are evaluated by `evaluateFeatureFlag` (deterministic hash bucket).

## RBAC

| Action | Typical |
|--------|---------|
| `Platform.View` | Admin (Branch Manager), Auditor, Accountant, Ops |
| `Platform.Tenant` / `Config` / `License` / `Flag` / `Deploy` / `Maintenance` | KBA elevated + SystemOwner |
| `Platform.Admin` | SystemOwner (+ Super Admin via full grant except `SUPER_ADMIN_FORBIDDEN`) |

Collectors: no privileged platform actions. Privileged ops (license revoke, flag kill, emergency maintenance, config publish) are audited.

## Contracts (examples)

`Platform.Tenant.*`, `Platform.Config.*`, `Platform.Flag.*`, `Platform.License.*`, `Platform.Deploy.*`, `Platform.Maintenance.*`, `Platform.Ops.Dashboard.v1`, `Platform.Dr.*`, `Platform.Environment.*`, `Platform.Announcement.*`.

Errors: `PLT-xxx`. Events: `TenantSuspended`, `FeatureFlagKilled`, `MaintenanceStarted`, `LicenseExpired`.

In-process only via Module 20 gateway + `invokeContract` — **no** REST/GraphQL HTTP server.

## UI

Extras under **Audit Log** and **Reports** only (`platform-views.js`). No new top-level nav.

## Files

- `src/core/platform-lifecycle.js`
- `src/core/platform-ops.js`
- `src/core/platform-api.js`
- `src/ui/platform-views.js`
- `supabase/migrations/043_platform_admin.sql`
- `tests/platform-ops.test.js`

## Consolidation

Module 30 is the **final major module**. Global Consistency Review / Event Catalog consolidation is a separate phase.
