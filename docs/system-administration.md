# Module 14 — System Administration & Configuration

The existing **System Controls** form stays live (business name, currency, loan interest, cloud, production flags). This module adds an **Administration console** below that form.

Runtime lookup is `getConfigValue(state, key)` in `src/core/system-config.js`. Catalog defaults overlay live `state.settings` for keys that already have a settings field (`currency`, `loanInterest`, `collectionDays`, `timezone`, `sessionTimeoutMinutes`), then overlay `parameterValues`. Modules must not invent a second copy of these parameters.

There is no REST/GraphQL API.

## What stays hard-coded on purpose

| Value | Why |
|---|---|
| Cashier approval GHS **1,000** | Default in RBAC and the catalog. Configurable, but the default is not changed. |
| Loan interest **15%** | Existing System Controls default. |
| Collection cycle **31** days | Existing default. |
| Currency **GHS** | Parameter validation rejects a different org currency. |
| `postgresSourceOfTruth` | Still off unless an administrator ticks the existing checkbox. |

## Versioning and maker-checker

Every applied change writes `configuration_versions`, `configuration_changes`, and a Module 13 configuration audit event. High-risk keys (loan interest, cashier limit, password minimum, MFA requirement, loan feature flag) create a **pending draft** unless the actor is the System Owner. A different user with `System.ConfigurationApprove` must approve. Invalid imports are rejected and do not activate.

Rollback restores a previous snapshot without deleting history.

## Feature flags

Flags default **on** so current screens do not disappear. `isFeatureEnabled(state, id)` is the only runtime check. Loan/MoMo/offline behaviour is unchanged while flags remain enabled.

## Products

`productDefinitions` stores savings and loan product catalogs (Daily Susu through Group Loan). Editing them versions configuration. Live collection, loan interest, and `customerBalance` still use the existing savings-product and Settings interest paths so current calculations stay the same.

## Session and passwords

Session TTL uses `settings.sessionTimeoutMinutes` (default 480 = 8 hours). Password minimum uses `security.passwordMinLength` and cannot be set below 8.

## Calendars

Ghana 2026 public holidays are seeded. Custom holidays can be added. `isWorkingDay` excludes weekends (per working-days list) and holidays.

## Permissions

| Action | Who |
|---|---|
| `System.View` | Auditor (read-only) plus privileged roles |
| `System.Configure` / `System.FeatureFlags` | Owner, Super Admin, Developer; MD except security/approve |
| `System.Security` / `System.ConfigurationApprove` | Owner, Super Admin, Developer |
| Existing Settings form | Still Owner / Super Admin / Developer via `canAccessSystemSettings()` |

## Untouched

System Controls fields, Backup screen export/restore buttons, `customerBalance`, branding, navigation, EXE/APK sync.
