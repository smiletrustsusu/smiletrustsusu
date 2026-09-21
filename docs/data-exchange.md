# Module 25 — Enterprise Data Exchange, Import, Export & Migration Framework

The Data Exchange Framework is the **centralized platform** for import, export, migration, synchronization, interoperability, and bulk data processing in the SMILE TRUST SUSU MANAGEMENT SYSTEM.

No other module shall implement independent CSV import, Excel import, backup import, migration, or bulk-processing engines. Existing CRM customer import and collection/loan workbook screens remain UI entry points; new processing goes through this module.

It does **not** post collections, change loan interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`. Savings transactions, loan repayments, withdrawals, and journal entries are **validated and staged only**.

There is no REST or GraphQL HTTP server. Gateway routes are in-process Module 20 contracts via `invokeContract`.

## Implementation

- Lifecycle: `src/core/exchange-lifecycle.js`
- Export policy / global matrix: `src/core/export-policy.js`
- Engine: `src/core/exchange-ops.js`
- Public contracts: `src/core/exchange-api.js`
- Extras: `src/ui/exchange-views.js` under the existing **Audit Log** and **Reports**
- Schema: `supabase/migrations/038_data_exchange.sql`
- Tests: `tests/exchange-ops.test.js`

## Supported operations

**Import:** customers, branches, agents, savings accounts/transactions, loan accounts/repayments, withdrawals, accounting charts, journal entries, document metadata, configuration, workflow definitions, rule definitions, payment provider configuration.

**Export:** customer data, savings/loan statements, financial/audit/security/workflow reports, backup metadata, BI datasets, regulatory reports.

**Formats:** CSV, XLSX, JSON, XML, PDF (export only), ZIP. Future formats are pluggable.

**Jobs (Module 18):** `exchange_import`, `exchange_export`, `exchange_migrate`, `exchange_bulk` with pause, resume, retry, cancel, progress, and partial recovery.

Financial integrity: identifier consistency and ownership rules are preserved. Failed validation produces downloadable error reports without writing production financial data.

## Public contracts

Commands: `Exchange.Import.v1`, `Exchange.Export.v1`, `Exchange.Validate.v1`, `Exchange.Migrate.v1`, `Exchange.Bulk.v1`, `Exchange.Map.v1`, `Exchange.Approve.v1`, `Exchange.Rollback.v1`, `Exchange.Control.v1`, `Exchange.RequestPermission.v1`, `Exchange.AdvancePermission.v1`.

Queries: `Exchange.Jobs.v1`, `Exchange.History.v1`, `Exchange.Errors.v1`, `Exchange.Templates.v1`, `Exchange.Statistics.v1`.

Events: `ImportCompleted`, `ExportCompleted`, `MigrationCompleted`, `ValidationFailed`, `ExportDenied`.

Error codes: `EX-001` … `EX-012`.

Any module may invoke public Exchange contracts. Modules must not write `import_*` / `export_*` tables directly.

## Sensitive Data Export Authorization

Every exportable dataset has exactly one classification in the Contract Registry / Data Dictionary (`DATASET_CATALOG`):

| Classification | Examples |
|---------------|----------|
| Public | Published reports, public reference data |
| Internal | Operational dashboards, branch summaries |
| Confidential | Customer records, collector assignments |
| Financial | Savings transactions, loans, accounting journals |
| Restricted | Credentials, security logs, encryption metadata, recovery material |

Dedicated permissions (granted independently):

`Export.Public`, `Export.Internal`, `Export.Customers`, `Export.Savings`, `Export.Loans`, `Export.Accounting`, `Export.Workflows`, `Export.Audit`, `Export.Configuration`, `Export.Backup`, `Export.Security`, `Export.System`, `Export.All`.

Maker-checker approval (Workflow Engine) is required for full customer dumps, complete savings history, multi-branch journals, full audit/security logs, backup archives, encryption metadata, and **Restricted** exports.

Branch filters are enforced server-side from `dataScope`. Client `branchId` is never trusted.

Restricted fields (password hashes, API keys, tokens, recovery keys, MoMo webhook secret, cryptographic material) are never exported in plaintext.

Format policy: Public → CSV/XLSX/JSON/PDF; Internal → CSV/XLSX/JSON; Confidential → encrypted CSV/XLSX/ZIP; Financial → encrypted XLSX/PDF/ZIP; Restricted → encrypted ZIP only.

Quotas: `exchange.maxSyncRecords`, `exchange.maxFileBytes`, `exchange.maxConcurrentJobs`, `exchange.maxScheduledPerUser`. Oversized exports become managed jobs.

Every export records job id, user, branch, permission, classification, type, format, record count, file size, approval reference, timestamps, and result. Audit records are immutable.

## Export Role-to-Permission Assignment

Spec role names map to stored roles:

| Specification role | Stored role |
|--------------------|-------------|
| Platform Administrator | `SystemOwner` |
| System Administrator | `KBA` / `Developer` |
| Organization Administrator | `ManagingDirector` |
| Compliance / Internal / Read-Only Auditor | `Auditor` |
| Finance Manager | `Accountant` |
| Branch Manager | `Admin` |
| Branch Supervisor | `FieldSupervisor` |
| Loan Officer | `FieldSupervisor` |
| Savings Officer | `Cashier` |
| Collector | `Collector` |
| Customer Service Officer | `CustomerService` |
| Reporting Analyst | `OperationsManager` |

Default matrix (least privilege, additive, scoped):

- Collector / Customer Service: `Export.Public` only
- Cashier: Public, Internal, Customers, Savings (branch)
- Branch Manager / Field Supervisor: + Loans (branch)
- Accountant: + Accounting (organization)
- Managing Director / Operations: through Workflows; **not** Audit, Configuration, Backup, Security, System, or All
- Auditor: read-only through Audit and Security; **not** Configuration, Backup, System, or All
- Super Admin: all export permissions **except** `Export.All`
- System Owner: `Export.All`

`Export.All` may be granted to Super Admin only through an emergency authorization approved by the Organization Administrator and recorded in the audit log.

High-risk permissions (`Export.All`, `Backup`, `Security`, `Configuration`, `System`) require administrative approval, maker-checker, immutable audit, and periodic review.

Temporary grants include permission, role, scope, UTC start/expiry, approval reference, reason, and assigner. Expired grants are revoked automatically.

Conflict rules: effective permissions are the union of grants; explicit denies win; scope is always enforced; high-risk permissions are never inferred.

## Export Permission Assignment Workflow & Step Ownership

Assignment workflow states: Draft → Validation → Pending Review → Pending Security → Pending Compliance → Approved → Provisioning → Active → Revoked → Completed.

| Step | Primary owner | Backup |
|------|---------------|--------|
| Request creation | Requesting User | None |
| Validation | Authorization Service | Security Administrator |
| Business review | Branch Manager / Organization Administrator | Branch Supervisor |
| Security review | Security Administrator | Chief Security Officer |
| Compliance review | Compliance Officer | Internal Auditor (recommendation) |
| Final approval | Organization Administrator | Platform Administrator (policy) |
| Provisioning | Authorization Module | System Administrator (recovery) |
| Activation | Authorization Module | — |
| Revocation | Organization Administrator | Security Administrator |
| Audit | Audit Module | — |

Segregation of duties: requester cannot be business/security/compliance/final approver; business reviewer cannot be final approver when dual approval is required.

## Canonical Role–Permission Matrix (global)

The matrix in `export-policy.js` (`CANONICAL_CATEGORY_ACCESS` + `EXPORT_ROLE_MATRIX`) is the single source of truth. No module defines independent role-permission mappings.

Permission identifiers use `<Resource>.<Action>` (for example `Savings.Collect`, `Export.Accounting`).

Categories: Customer, Savings, Loans, Accounting, Workflow, Rules, Reports, Data Exchange, Security, Administration, Audit.

Legend: **✓** full within scope, **✓ (Scoped)** branch/organization limited, **R** read-only.

The matrix is versioned (`ROLE_MATRIX_VERSION`). Built-in roles cannot be modified directly. Custom roles may add explicit permissions without changing built-ins.

Every authorization decision records user, roles, permission, scope, decision, policy version, timestamp, and correlation id.

## Configuration

- Feature flag: `enableDataExchange`
- `exchange.maxSyncRecords` (default 500)
- `exchange.maxFileBytes` (default 2,000,000)
- `exchange.maxConcurrentJobs` (default 3)
- `exchange.maxScheduledPerUser` (default 5)

## Acceptance

- All imports, exports, migrations, and bulk operations are centralized here.
- Every operation is validated before execution and fully audited.
- Jobs support pause, resume, retry, cancellation, and recovery.
- Mapping templates and validation rules are configurable without code changes.
- Financial integrity, identifiers, ownership, and auditability are preserved.
- Export classification, granular permissions, maker-checker, branch isolation, format restrictions, quotas, and sensitive-field protection are enforced.
- Automated tests cover validation, migration, rollback, reconciliation, permissions, SoD, and backward compatibility.
