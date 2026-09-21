# Module 17 — Receipt, Document & Statement Management

The document engine is the **only** path that creates official printable documents for Smile Trust. Collections, withdrawals, loans, payments, and accounting still post money the same way. They register a document after the business transaction commits. They do not generate a second receipt number and they do not post a second ledger line.

There is no REST/GraphQL API. Live UI remains `app.js`. Existing collection receipts still use `buildReceiptNo`. Cashier GHS **1,000**, loan interest **15%**, the 31-day cycle, `customerBalance`, and the MoMo webhook secret field stay as they are. Document extras sit **below** Collections, Accounting, Settings, and Reports.

## What the engine does

- Generates receipts, statements, schedules, agreements, certificates, and letters from versioned templates.
- Issues QR verification tokens and optional officer signatures.
- Stores content hashes, versions, delivery history, and metadata.
- Reconciles temporary offline receipts to exactly one permanent server receipt.
- Creates compensating refund/reversal documents instead of editing originals.
- Enforces maker-checker on refund, reversal, supersession, permanent cancellation, and template publication.

Printed collection receipts on the device remain the live customer copy. The engine records them, versions them, and maps offline numbers after sync.

## Document types

Financial: savings collection, withdrawal, loan disbursement, loan repayment, mobile money, payment confirmation, journal voucher, cash transfer, adjustment, refund, reversal.

Customer: account / savings / loan / group statements, contribution history, passbook.

Loan: agreement, repayment schedule, guarantor form, approval letter, closure certificate.

Administrative: branch reports, cash summary, daily collection summary, agent performance, configuration, audit.

Certificates: membership, savings completion, group registration, loan clearance.

## Document lifecycle

`draft → generated → approved (if required) → issued → delivered → archived`

Also: `generated → cancelled`, `issued → superseded`. Signed documents cannot change except to delivered or archived. History is append-only.

## Offline receipt reconciliation & permanent receipt assignment

Temporary receipts are created on authorized Android devices, marked temporary/offline, and keep Local Transaction ID, Device ID, Correlation ID, Idempotency Key, Agent, Branch, and sequence.

After sync:

1. Validate the business transaction.
2. Verify idempotency.
3. Confirm the transaction committed and accounting posted.
4. Issue exactly one permanent receipt.
5. Write an immutable mapping (`temporary → permanent`).
6. Archive the temporary status as reconciled.

Duplicate sync attempts return the original permanent number. Interrupted sync resumes without a second receipt. Existing Module 15 `localReceipts` / `promoteReceipt` mapping (`SRV-…`) remains; the engine records the same 1:1 link.

Temporary receipts are never evidence that accounting has completed.

## Receipt rejection, cancellation & reversal

A receipt is a document of a transaction at the time of issue. It is not the transaction.

- Rejected or cancelled before commit: no permanent financial receipt. Temporary number is never reused.
- Refunds and reversals: new linked documents. Original amount, number, and content hash stay unchanged.
- Partial refunds/reversals cannot exceed the original amount.
- Outcomes: valid, rejected, cancelled, partially/fully refunded, partially/fully reversed, superseded.

## Receipt approval & authorization

Workflow owners are services and roles, not named people. JOHN and KBA receive authority through Authentication & Authorization.

| Action | Agent / Teller | Branch Manager | Accountant | Auditor | Super Admin / Owner |
|---|---|---|---|---|---|
| Generate / deliver | Yes | Yes | Yes | View | Yes |
| Reprint | Own branch | Yes | Yes | Yes | Yes |
| Cancel temporary | Before sync | Yes | Yes | View | Yes |
| Refund / reverse / supersede | No | Approval | Yes (maker-checker) | View | Yes |
| Archive / templates | No | No | No | View | Yes |

Maker and checker must be different users. High-value refunds use configured approval limits (cashier GHS **1,000** remains the live cashier cap). Emergency override is System Owner / Super Admin only, with reason and audit.

## Templates

Company logo, branch branding, header/footer, watermarks, QR, barcodes, placeholders, language, and theme. Edits create a new unpublished version. Publication is maker-checker.

## QR verification

Official documents may include a QR token. Verification returns authenticity, issue date, status, branch, and version only — not PINs, balances beyond policy, or full ledgers.

## Delivery

Download, print, SMS, email, WhatsApp, push. Delivery is queued after commit. Notification failure does not roll back the document or the financial transaction.

## Security

Role-based access, hashed content, optional encryption-at-rest flag aligned with the offline queue, immutable signed documents, watermarking, download permissions, G1 audit. Never store MoMo PINs or bank passwords.

## Implementation

- Engine: `src/core/document-ops.js`, `src/core/document-lifecycle.js`
- Extras: `src/ui/document-views.js`
- Schema: `supabase/migrations/027_documents.sql`

## Acceptance

- Business modules register documents; they do not generate parallel PDFs.
- Every temporary offline receipt maps to at most one permanent number.
- Issued receipts are never edited or deleted.
- QR verification confirms authenticity.
- Maker-checker holds for refund, reversal, supersession, and template publication.
- Automated tests cover generation, versioning, signing, QR, delivery, offline mapping, duplicates, rejection, refunds/reversals, and approvals.
