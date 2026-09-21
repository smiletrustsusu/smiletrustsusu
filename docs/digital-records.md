# Module 26 — Enterprise Document & Digital Records Management System

The Digital Records module is the **centralized document repository and records-management platform** for the SMILE TRUST SUSU MANAGEMENT SYSTEM.

It stores uploaded files, metadata, versions, retention, archives, legal holds, and access history. **Module 17 remains the receipt and statement generator.** This module does not issue receipt numbers, change `buildReceiptNo`, post collections, or alter loan interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`.

Generated receipts and statements are **indexed** here as records (source module 17) so search, retention, and legal hold apply without a second printable-document engine.

There is no REST or GraphQL HTTP server. Gateway routes are in-process Module 20 contracts.

## Implementation

- Lifecycle: `src/core/records-lifecycle.js`
- Engine: `src/core/records-ops.js`
- Public contracts: `src/core/records-api.js`
- Extras: `src/ui/records-views.js` under the existing **Audit Log** and **Reports**
- Schema: `supabase/migrations/039_digital_records.sql`
- Tests: `tests/records-ops.test.js`

## Document types

Customer photographs, national IDs, passport photos, signatures, customer/loan/guarantor agreements, savings and withdrawal receipts, payment confirmations, accounting/audit/regulatory reports, workflow attachments, rule artifacts, system PDFs, backup manifests, compliance evidence, staff and branch documents.

## Lifecycle

```text
Uploaded → Validated → Active → Archived → Retired
Active → Superseded (new version)
Active → Deleted (only if retention allows and no legal hold)
Archived → Restored (Active)
```

Only documented transitions are permitted. Previous versions are never overwritten.

## Metadata

Document ID, document number, type, category, owner entity/id, branch, uploaded by/at (UTC), file size, MIME type, storage location, checksum, version, classification, retention policy, encryption status, digital signature status.

## Storage

Configurable provider (`records.storageProvider`): `local`, `network`, `cloud`, or `hybrid`. Content is stored as an encrypted, signed object with checksum verification. Large uploads are rejected above `records.maxFileBytes`.

## Security

- RBAC: `Records.View`, `Upload`, `Download`, `Version`, `Archive`, `Restore`, `Delete`, `Hold`, `Policy`, `Share`, `Admin`
- Branch isolation via `dataScope`
- Encryption-at-rest marker and signed storage objects
- Malware/MIME scan before accept
- Checksum integrity on preview and download
- Time-limited, single-use download links (`records.downloadTtlMs`)
- Configurable watermark on Financial/Restricted previews

## Retention and legal hold

Policies are seeded by classification. Documents under an active legal hold cannot be deleted or retired. Scheduled `records_retention_tick` archives records past `autoArchiveDays` unless held.

## Public contracts

Commands: `Records.Upload.v1`, `Records.Version.v1`, `Records.Compare.v1`, `Records.Rollback.v1`, `Records.Archive.v1`, `Records.Restore.v1`, `Records.Retire.v1`, `Records.Delete.v1`, `Records.Hold.v1`, `Records.ReleaseHold.v1`, `Records.Share.v1`, `Records.Preview.v1`, `Records.Link.v1`, `Records.Download.v1`, `Records.Policy.v1`.

Queries: `Records.Search.v1`, `Records.Get.v1`, `Records.List.v1`, `Records.Statistics.v1`.

Events: `RecordUploaded`, `RecordArchived`, `RecordRestored`, `RecordHeld`, `RecordDeleted`, `RecordSuperseded`.

Error codes: `REC-001` … `REC-012`.

Any module may invoke public Records contracts. Modules must not write ECM tables directly or keep independent file stores.

## Configuration

- Feature flag: `enableDigitalRecords`
- `records.storageProvider` (default `local`)
- `records.maxFileBytes` (default 5,000,000)
- `records.downloadTtlMs` (default 300,000)
- `records.watermarkSensitive` (default true)

Customer KYC uploads via the Customers screen still update `customer.kycDocuments[]` for CRM display and are also **indexed** into this module through `indexCustomerKycDocument`. Module 17 generated receipts are indexed automatically for search, retention, and legal hold.

- Platform documents are managed here; Module 17 still generates receipts.
- Storage, metadata, versioning, retention, archival, and security are centralized.
- Every record is auditable, searchable, versioned, and branch-scoped.
- Legal holds and retention are enforced in the engine.
- Automated tests cover upload, download, versioning, search, security, retention, archive, holds, and backward compatibility.
