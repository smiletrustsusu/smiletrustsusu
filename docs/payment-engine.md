# Module 16 — Mobile Money & Payment Gateway Integration

The payment engine is the **only** path from Smile Trust to MTN Mobile Money, Telecel Cash, AirtelTigo Money, banks, and future gateways. Collections, withdrawals, loans, and accounting do not call providers directly.

There is no REST/GraphQL API. Live UI remains `app.js`. The existing collection form, cashier GHS **1,000** limit, loan interest **15%**, 31-day cycle, `customerBalance` math, MoMo webhook secret field, and Cash / Mobile Money controls stay as they are. Payment extras sit **below** Collections, Accounting, Settings, and Reports.

## What the engine does

- Validates payment requests (method, amount, GHS, duplicate MoMo references, blacklist, velocity).
- Issues internal payment ids and correlation ids.
- Talks to providers through **plug-in adapters**.
- Ingests signed callbacks (signature, timestamp, idempotency, replay window).
- Records settlements, reconciliation exceptions, refunds, and reversals.
- Retries and fails over when a provider is marked down.
- Writes audit events (G1) and queues notifications **after** a successful internal commit.

Cash still posts on the device immediately. Electronic collections still post the existing collection + ledger pair; verification waits for a provider callback. The engine does **not** post a second ledger line on callback.

## Payment Engine Implementation Boundary & Responsibility Matrix

The payment engine is an orchestration and integration layer.

It is responsible for initiating requests, validating them, tracking state, processing callbacks, enforcing idempotency, maintaining internal financial integrity, recording audit events, coordinating accounting after **internal** confirmation, and reconciling provider files against Smile Trust records.

It is **not** responsible for executing payment transactions inside MTN, Telecel, AirtelTigo, card networks, or bank clearing systems.

### Trust boundary

Android APK, web administration portal, payment engine, business services, accounting engine, audit engine, notification engine, synchronization engine, database, internal APIs.

Guarantees in this document apply only inside that boundary.

### External boundary

MTN Mobile Money, Telecel Cash, AirtelTigo Money, banks, card processors, payment gateways, SMS/email providers, government APIs, and other third parties remain independent. They may retry, delay, reject, send duplicate callbacks, or go offline. The engine must tolerate those behaviours. It cannot control them.

### System responsibilities

| Area | Smile Trust implements |
|---|---|
| Initiation | Validate, generate ids / correlation ids, persist the payment, audit |
| Provider communication | Authenticate, sign, verify responses, retry, timeout, record attempts |
| Callbacks | Signature, timestamp, duplicates, idempotency, status, notify, verify matching collections |
| Accounting | Existing double-entry on the business transaction; compensating **linked** refund/reversal records. No second collection insert from a callback |
| Reconciliation | Compare provider settlements to internal payments, flag exceptions, support approved manual match |

### Provider responsibilities

Customer PIN entry in the MoMo app, executing the wallet transfer, wallet balances, provider reference numbers, settlement into the organisation account, and provider uptime.

Smile Trust adapters **record outbound requests**. They do not run a mobile wallet and they do not simulate provider approval.

### Customer responsibilities

Authorising the payment, keeping a sufficient wallet/bank balance, protecting PINs, and confirming details before authorising.

The app must never request or store Mobile Money PINs, bank passwords, or OTPs.

### Bank responsibilities

Account maintenance, clearing/settlement, banking regulation, and interest on bank accounts. Smile Trust records outcomes and reconciles them.

### Failure ownership

| Failure | Owner |
|---|---|
| Invalid business rules | SMILE TRUST SUSU MANAGEMENT SYSTEM |
| Duplicate internal transaction | SMILE TRUST SUSU MANAGEMENT SYSTEM |
| Incorrect accounting entry | SMILE TRUST SUSU MANAGEMENT SYSTEM |
| Network outage to provider | Shared (retries + provider availability) |
| Provider timeout | External provider, handled by retry |
| Duplicate callback | External behaviour, handled by idempotency |
| Customer enters incorrect PIN | Customer |
| Provider rejects payment | External provider |
| Bank settlement delay | Financial institution |

### Security boundary

Never store customer MoMo PINs, bank passwords, or OTPs. Never bypass provider authentication. Never mark an electronic payment completed unless cash (internal) or a validated provider callback / statement match says so. Provider API secrets belong in System Controls / server config — not hardcoded in the Android APK.

### Data ownership

Internal: payment records, transaction records, accounting entries, audit, internal ids, reconciliation rows.

External (stored as-is, never rewritten): provider transaction references, settlement files, provider status codes, provider timestamps. Identifier module `external_reference` ownership stays with the external system.

### Extension boundary

Add a provider by registering an adapter (`registerProviderAdapter`) and configuration. Savings, loans, accounting, notification, and audit modules should not need code changes for a new gateway.

### Unsupported

Mobile wallet management, bank ledgers, card network switching, telecom billing, FX trading, regulatory settlement systems. Integrate; do not reproduce.

## Lifecycle

Authoritative states, transitions, workflow stages, and named owners are defined in the sections below. Legacy aliases: `initiated` → `created`, `refunded` → `fully_refunded`, `reversed` → `fully_reversed`.

Mapped to the global transaction status model: pending, posted, failed, cancelled, reversed.

## Queue

`pending` → `awaiting_provider` / `callback_pending` → `completed` | `failed` | `retrying` | `dead_letter`. Processing is idempotent. Items stuck in `processing` after timeout are recovered on the next pass.

## Permissions

| Action | Who |
|---|---|
| `Payment.View` | Collectors and up, plus auditor |
| `Payment.Reconcile` | Accountant, branch manager, privileged roles |
| `Payment.Refund` / `Payment.Reverse` | Accountant, branch manager, privileged roles (online unless `offline.allowHighRisk`) |
| `Payment.Provider` | System Owner / Super Admin / Developer |

## Existing behaviour preserved

- Collections still use `handleCollection` and `customerBalance`.
- MoMo duplicate reference checks still run (`verifyMomoPaymentLocally`).
- Channel posting is still `account:momo` / `account:cash` / `account:bank`.
- Printed receipts are still `buildReceiptNo`.
- `postgresSourceOfTruth` stays off unless an operator turns it on.

---

# PAYMENT STATUS STATE MACHINE & TRANSITION RULES

This specification defines the authoritative payment status lifecycle for every payment processed by the SMILE TRUST SUSU MANAGEMENT SYSTEM.

All payment operations shall follow this state machine regardless of payment method or provider.

This applies to:

- Cash Payments
- MTN Mobile Money
- Telecel Cash
- AirtelTigo Money (where available)
- Bank Transfers
- Bank Deposits
- Card Payments (future-ready)
- QR Payments (future-ready)
- Internal Wallet Payments (future-ready)

The Payment Status Model shall integrate with the Global Transaction Status Model while remaining independently managed.

Implemented in `src/core/payment-lifecycle.js`. Status changes go through `transitionPayment` / `applyStatus` only. Historical states are append-only (`payment.statusHistory` and `paymentStatusHistory`). Optimistic concurrency uses `payment.version`.

## Guiding principles

Every payment shall:

- Progress through defined states only.
- Follow deterministic transitions.
- Preserve complete payment history.
- Never overwrite historical states.
- Record every transition in the audit trail.
- Prevent invalid state changes.

Every payment status change shall be timestamped and auditable.

## Payment lifecycle

The standard lifecycle is:

```text
Created
    ↓
Validated
    ↓
Pending Customer Authorization
    ↓
Pending Provider
    ↓
Authorized
    ↓
Processing
    ↓
Completed
```

Cash collections skip customer-authorization and complete internally: `created → validated → pending_provider → processing → completed`.

Electronic methods wait at `pending_provider` until a signed callback. A successful callback walks `authorized → processing → completed`. Adapters must not return `completed` for electronic methods.

Alternative terminal paths:

```text
Created → Validation Failed
Pending Customer Authorization → Cancelled | Expired
Pending Provider → Failed | Expired
Completed → Partially Refunded → Fully Refunded
Completed → Partially Reversed → Fully Reversed
```

Business validation that fails before a payment record is persisted produces no provider request. If a record already exists in `created`, it may move to `validation_failed`.

## State definitions

| State | Meaning | Allowed next states |
|---|---|---|
| Created | Request received. No provider communication. | Validated, Validation Failed, Cancelled |
| Validated | Customer, product, amount, limits, fraud, and permission checks passed. | Pending Customer Authorization, Pending Provider, Cancelled |
| Pending Customer Authorization | Customer must approve (MoMo prompt, card auth, bank auth). | Authorized, Cancelled, Expired, Failed |
| Pending Provider | Request submitted to the provider. | Authorized, Processing, Failed, Expired |
| Authorized | Provider confirmed authorization. Funds may be reserved, not settled. | Processing, Failed, Cancelled (if the provider permits voiding) |
| Processing | Callback verification, accounting validation, idempotency, journal preparation. | Completed, Failed |
| Completed | Accepted. Business transaction updated, accounting posted, receipt and notifications issued. Normal successful terminal, except refunds/reversals. | Partially Refunded, Fully Refunded, Partially Reversed, Fully Reversed |
| Validation Failed | Business validation failed before provider processing. Terminal. | — |
| Failed | Processing or provider interaction failed. Capture failure code, reason, provider response, retry eligibility. Terminal unless a **new** payment attempt is started. | — |
| Cancelled | Cancelled before completion. Terminal. No accounting entries. | — |
| Expired | Authorization window elapsed. Terminal. No funds recognized. | — |
| Partially Refunded | Linked refund for part of the completed payment. Original remains immutable. | Fully Refunded |
| Fully Refunded | Refunded in full via linked records. Terminal. Original preserved. | — |
| Partially Reversed | Linked compensating reversal for part of the completed payment. | Fully Reversed |
| Fully Reversed | Complete compensating reversal. Terminal. Original immutable. | — |

## Valid transition matrix

| Current state | Allowed next states |
|---|---|
| Created | Validated, Validation Failed, Cancelled |
| Validated | Pending Customer Authorization, Pending Provider, Cancelled |
| Pending Customer Authorization | Authorized, Failed, Cancelled, Expired |
| Pending Provider | Authorized, Processing, Failed, Expired |
| Authorized | Processing, Failed, Cancelled (provider permitting) |
| Processing | Completed, Failed |
| Completed | Partially Refunded, Fully Refunded, Partially Reversed, Fully Reversed |
| Partially Refunded | Fully Refunded |
| Partially Reversed | Fully Reversed |
| Validation Failed | Final |
| Failed | Final |
| Cancelled | Final |
| Expired | Final |
| Fully Refunded | Final |
| Fully Reversed | Final |

Transitions not listed in this matrix shall be rejected. Failed → Completed is never legal.

## Terminal states

Validation Failed, Failed, Cancelled, Expired, Fully Refunded, Fully Reversed.

Terminal states prohibit further lifecycle transitions except through a new, separately identified payment request where business rules allow.

## Retry rules

Retries are permitted only before reaching a terminal state.

- Reuse the original Idempotency Key where appropriate.
- Preserve the Correlation ID.
- Do not create duplicate accounting entries.
- Record each retry attempt separately.

## Callback rules

Provider callbacks may move a payment only when:

- Signature validation succeeds.
- Idempotency validation succeeds.
- Current state allows the transition.
- Callback timestamp is within configured limits (`payment.callbackWindowSeconds`, default 300).

Duplicate or stale callbacks must be acknowledged safely without altering the payment state.

## Concurrency rules

Only one processing thread may modify a payment at a time.

- Optimistic concurrency control (`payment.version`).
- Aggregate version validation (`expectedVersion`).
- Atomic state updates.

Concurrent updates resulting in version conflicts must be rejected and retried according to policy.

## Accounting rules

Accounting entries shall be posted only when the payment reaches **Completed**. Refunds and reversals create compensating journal entries. The original journal entry must never be edited or deleted. Only the Accounting Engine may set `accountingPosted`.

Cash still posts through the existing collection path. The engine does not post a second ledger line on callback.

## Audit requirements

Every state transition shall record: Payment ID, Previous State, New State, Transition Timestamp, User or System Process, Provider ID (if applicable), Correlation ID, Idempotency Key, Reason Code (if applicable). Audit records must be immutable.

## Acceptance criteria

The payment status implementation is complete only when:

- Every payment follows the defined state machine.
- Invalid transitions are rejected.
- Terminal states prevent further processing.
- Refunds and reversals create linked compensating transactions instead of modifying original records.
- Accounting occurs only after successful completion.
- Callback processing respects transition rules and idempotency.
- Concurrency controls prevent conflicting state changes.
- Every transition is fully audited and timestamped.
- Automated tests verify valid transitions, invalid transitions, retries, callbacks, refunds, reversals, concurrency conflicts, and terminal-state enforcement.

---

# STANDARD PAYMENT PROCESSING FLOW

This specification defines the standard end-to-end payment flow for every payment processed by the SMILE TRUST SUSU MANAGEMENT SYSTEM.

The purpose is to ensure that every payment follows a consistent, deterministic, auditable, and secure workflow regardless of the payment method or payment provider.

No payment implementation may bypass this workflow unless explicitly approved through a documented architecture exception.

## Processing principles

Every payment shall:

- Be uniquely identified.
- Be validated before processing.
- Be processed exactly once within the trusted system boundary.
- Be fully auditable.
- Be idempotent.
- Preserve financial integrity.
- Produce deterministic business outcomes.

## Canonical payment flow

```text
Receive Payment Request
            ↓
Authenticate Request
            ↓
Authorize User
            ↓
Validate Business Rules
            ↓
Generate Internal Identifiers
            ↓
Create Correlation ID
            ↓
Register Idempotency Key
            ↓
Create Payment Record
            ↓
Determine Payment Method
            ↓
Route to Payment Provider
            ↓
Await Provider Response / Callback
            ↓
Validate Callback
            ↓
Perform Idempotency Check
            ↓
Update Payment Status
            ↓
Execute Business Transaction
            ↓
Post Accounting Entries
            ↓
Create Audit Records
            ↓
Generate Receipt
            ↓
Send Notifications
            ↓
Complete Workflow
```

Every successful payment shall pass through each applicable stage in order.

### Stage 1 — Receive payment request

Sources: Android APK, Web Administration Portal, Public API, Integration Service, Scheduled Process.

Capture Request ID, Timestamp, Source, Device ID (if applicable), User ID, Branch ID. Reject malformed requests immediately.

### Stage 2 — Authentication

Verify user identity, device registration, API credentials (where applicable), session validity. Unauthenticated requests must not proceed.

### Stage 3 — Authorization

Confirm the caller may initiate the payment type, operate within the assigned branch, process the requested amount, and use the selected payment method. Authorization failures terminate processing.

### Stage 4 — Business validation

Validate that the customer exists and is active, the product is active, the amount is within limits, the collection period is valid, the loan or savings account permits the transaction, required approvals exist, and fraud/velocity checks pass. Validation failures produce no provider interaction.

### Stage 5 — Identifier generation

Create or validate Payment ID, Transaction ID, Correlation ID, Idempotency Key, Reference Number using the Global Standard Identifier Schema.

### Stage 6 — Payment record creation

Persist a payment record in the **Created** state with method, amount, currency, customer, branch, provider (if applicable), and metadata. This record is the authoritative source for the payment lifecycle.

### Stage 7 — Provider routing

Internal payments (for example Cash) proceed to internal processing. External payments select the provider using routing rules, sign the request if required, submit it, and record the interaction.

### Stage 8 — Provider response

Handle immediate synchronous responses, deferred asynchronous callbacks, timeouts, temporary failures, and permanent failures. Provider-specific details must be normalized into the standard payment status model.

### Stage 9 — Callback validation

For asynchronous providers validate signature, source, timestamp, replay protection, idempotency, and provider reference. Invalid callbacks must be rejected and audited.

### Stage 10 — Payment confirmation

Confirm that payment status permits completion, the provider response is valid, and duplicate processing has not occurred. Only confirmed payments may proceed to financial processing.

### Stage 11 — Business execution

Execute the associated business operation (savings contribution, loan repayment, membership fee, group contribution) inside a database transaction.

### Stage 12 — Accounting

After successful business execution create journal entries, update balances, and record settlement information where applicable. Accounting must succeed before the transaction is committed. Existing collection posting remains the live accounting path; the engine does not insert a second collection or ledger line from a callback.

### Stage 13 — Audit

Create immutable audit records capturing lifecycle events, user actions, provider interactions, status transitions, and accounting references via the centralized Audit Engine.

### Stage 14 — Receipt generation

Generate Receipt Number, Receipt Document, optional QR Code, and a permanent transaction reference. Offline temporary receipts map to permanent receipt numbers after synchronization.

### Stage 15 — Notification

After the transaction commits successfully, queue notifications using the centralized Notification Engine (SMS, WhatsApp, email, push). Notification failures must not roll back the completed payment.

### Stage 16 — Workflow completion

Mark the payment workflow completed. Record Completion Timestamp, Final Payment Status, Transaction Status, Accounting Status, Audit Reference, and Notification Reference (if applicable).

## Failure flow

Failures shall stop processing at the earliest safe point.

- Authentication failure → Stop immediately.
- Authorization failure → Stop immediately.
- Validation failure → No payment record beyond validation state.
- Provider timeout → Apply retry/failover policy.
- Accounting failure before commit → Roll back the business transaction.
- Notification failure after commit → Log and retry without affecting financial records.

## Compensating actions

If a payment has already reached **Completed**, corrections shall be performed only through approved refunds, approved reversals, and compensating journal entries. The original payment record shall remain immutable.

## Monitoring

Track end-to-end processing time, validation/authorization failures, provider response time, callback latency, accounting latency, receipt generation time, notification latency, and overall success rate.

## Acceptance criteria

The standard payment flow is complete only when:

- Every payment follows the canonical processing workflow.
- Authentication, authorization, validation, and identifier generation occur before provider interaction.
- Business execution, accounting, and audit recording occur atomically within the trusted transactional boundary.
- External provider interactions are normalized into the standard payment lifecycle.
- Notifications are dispatched only after successful transaction commit.
- Refunds and reversals follow compensating workflows without modifying original records.
- Failure handling, retries, and monitoring operate consistently across all payment methods.
- Automated tests verify every stage of the workflow, including success, validation failures, provider failures, retries, callbacks, accounting integration, receipt generation, notifications, and recovery.

---

# PAYMENT WORKFLOW STAGE OWNERSHIP & RESPONSIBILITY MATRIX

This specification defines the authoritative owner for every stage of the Standard Payment Processing Flow.

Each workflow stage shall have exactly one owning component responsible for its execution, validation, state transitions, error handling, and audit generation.

Supporting components may assist but shall not assume ownership.

## Governing principles

- Every stage has one authoritative owner.
- Ownership is exclusive.
- Ownership cannot transfer during execution.
- Supporting services communicate through well-defined interfaces.
- Cross-service communication must be auditable.
- Business modules shall never bypass the owning service.

## Stage ownership matrix

| Workflow stage | Primary owner | Supporting components |
|---|---|---|
| Receive Payment Request | API Gateway / Application Controller | Authentication, Logging |
| Authenticate Request | Authentication Service | Device Management |
| Authorize User | Authorization Service | Role & Permission Engine |
| Validate Business Rules | Payment Engine | Customer, Savings, Loan, Product Services |
| Generate Internal Identifiers | Identifier Service | Payment Engine |
| Create Correlation ID | Workflow Engine | Identifier Service |
| Register Idempotency Key | Idempotency Service | API Gateway |
| Create Payment Record | Payment Engine | Database Layer |
| Select Payment Method | Payment Engine | Configuration Service |
| Select Provider | Provider Routing Engine | Provider Health Engine |
| Submit to Provider | Provider Adapter | Payment Engine |
| Receive Provider Callback | Callback Processor | API Gateway |
| Validate Callback | Callback Validation Service | Security Service |
| Perform Idempotency Check | Idempotency Service | Payment Engine |
| Update Payment Status | Payment Engine | State Machine Engine |
| Execute Business Transaction | Business Transaction Engine | Savings, Loan, Group Services |
| Post Accounting Entries | Accounting Engine | General Ledger |
| Create Audit Record | Audit Engine | Event Publisher |
| Generate Receipt | Receipt Service | Document Service |
| Queue Notifications | Notification Engine | Template Engine |
| Complete Workflow | Workflow Engine | Payment Engine |

Only the Primary Owner may transition its stage from one state to another.

## Ownership responsibilities

The Primary Owner of a stage is responsible for executing business logic, validating inputs, managing stage state, recording audit events, returning standardized errors, triggering downstream stages, and enforcing timeout and retry policies where applicable.

Supporting components provide services but must not modify the stage lifecycle directly.

## Handoff rules

Control passes sequentially between stage owners:

```text
Authentication Service
        ↓
Authorization Service
        ↓
Payment Engine
        ↓
Provider Routing Engine
        ↓
Provider Adapter
        ↓
Callback Processor
        ↓
Accounting Engine
        ↓
Audit Engine
        ↓
Notification Engine
```

A stage owner may hand off control only after completing its responsibilities successfully.

## Failure ownership

If a stage fails, the Primary Owner is responsible for recording the failure, returning the correct error status, initiating retries if permitted, preventing invalid downstream execution, and triggering compensating actions where applicable.

Example: if provider submission fails, the Provider Adapter owns the failure. The Accounting Engine must not execute because the payment has not been confirmed.

## State ownership

Only the owning component may modify its stage-specific state.

- Only the Payment Engine updates Payment Status.
- Only the Accounting Engine marks Accounting Status as Posted.
- Only the Audit Engine records Audit Completion.
- Only the Notification Engine updates Notification Delivery Status.

Other services may read these states but shall not modify them directly.

## Event ownership

Each stage owner publishes standardized events upon completion (`AuthenticationSucceeded` / `AuthenticationFailed`, `PaymentValidated` / `PaymentCreated` / `PaymentCompleted`, `JournalPosted` / `AccountingCompleted`, `NotificationQueued` / `NotificationSent` / `NotificationFailed`).

Events must include Event ID, Correlation ID, Transaction ID (where applicable), Stage Owner, Timestamp, and Event Version.

## Security, observability, and testing

Each stage owner shall validate permissions, protect sensitive data, mask confidential information in logs, enforce least-privilege access, and reject unauthorized requests.

Each stage owner shall publish start/end time, duration, success/failure/retry/timeout counts, throughput, and error codes to Monitoring & Diagnostics.

Automated tests shall verify that only the Primary Owner can execute or transition its stage, supporting services cannot bypass ownership, handoffs occur in order, failure handling stays with the owner, unauthorized state modifications are rejected, audit events identify the owning component, and metrics are emitted by the appropriate owner.

## Acceptance criteria

The workflow ownership model is complete only when:

- Every payment workflow stage has exactly one Primary Owner.
- Ownership boundaries are enforced across APIs, background workers, and synchronization processes.
- Supporting components cannot perform owner-only operations.
- Workflow handoffs occur only after successful completion of the owning stage.
- State transitions and event publication are controlled exclusively by the designated owner.
- Failure handling, auditing, and monitoring are the responsibility of the owning component.
- Automated tests verify ownership enforcement, handoff sequencing, unauthorized access prevention, and correct event attribution.

---

# PAYMENT WORKFLOW NAMED OWNERS & BACKUP OWNERSHIP RULES

This specification assigns a Primary Owner and Backup Owner to every payment workflow stage.

Ownership is assigned to **system services/components**, not individual users. Human users (including JOHN or KBA) receive authority through roles and permissions defined in the Authentication & Authorization Module.

Only the Primary Owner may normally execute its assigned stage. The Backup Owner may assume responsibility only under approved failover, maintenance, or disaster recovery conditions.

## Ownership principles

Every workflow stage shall have one Primary Owner, one Backup Owner, one documented responsibility, and one controlled failover path.

The Backup Owner is a standby authority and shall not process the stage while the Primary Owner is healthy.

## Workflow owner matrix

| Workflow stage | Primary owner | Backup owner |
|---|---|---|
| Receive Payment Request | API Gateway | Application Controller |
| Authenticate Request | Authentication Service | Identity Service |
| Authorize User | Authorization Service | Security Service |
| Validate Business Rules | Payment Engine | Business Rules Engine |
| Generate Internal Identifiers | Identifier Service | Identifier Recovery Service |
| Create Correlation ID | Workflow Engine | Process Orchestrator |
| Register Idempotency Key | Idempotency Service | Request Recovery Service |
| Create Payment Record | Payment Engine | Transaction Engine |
| Select Payment Method | Payment Engine | Configuration Service |
| Select Provider | Provider Routing Engine | Provider Failover Engine |
| Submit to Provider | Provider Adapter | Provider Retry Engine |
| Receive Provider Callback | Callback Processor | Callback Recovery Service |
| Validate Callback | Callback Validation Service | Security Validation Service |
| Perform Idempotency Check | Idempotency Service | Transaction Recovery Service |
| Update Payment Status | Payment Engine | Workflow Engine |
| Execute Business Transaction | Transaction Engine | Business Recovery Engine |
| Post Accounting Entries | Accounting Engine | Journal Recovery Service |
| Create Audit Record | Audit Engine | Audit Recovery Service |
| Generate Receipt | Receipt Service | Document Service |
| Queue Notifications | Notification Engine | Notification Retry Service |
| Complete Workflow | Workflow Engine | Transaction Recovery Service |

The Backup Owner shall implement the same business rules and interfaces as the Primary Owner to ensure seamless failover.

Implemented as `WORKFLOW_STAGES` with `acquireStageLock`, `failbackStageOwner`, and `setOwnerHealth`. Ownership locks are durable in `paymentStageLocks`.

## Failover activation rules

A Backup Owner may assume responsibility only when one or more of the following conditions are met:

- Primary service unavailable.
- Primary service declared unhealthy by the Health Monitoring Module.
- Planned maintenance approved by an administrator.
- Disaster recovery procedures activated.
- Automatic failover policy triggered after configured thresholds.

Failover activation must be recorded before processing begins.

## Failback rules

When the Primary Owner becomes healthy again:

- Complete any in-flight work already started by the Backup Owner.
- Prevent duplicate execution during ownership transfer.
- Return new work to the Primary Owner.
- Record the ownership restoration in the audit log.

Failback must not interrupt active financial transactions.

## Ownership locking

Only one owner (Primary or Backup) may control a workflow stage at any given time.

- Acquire an ownership lock before execution.
- Release the lock after successful completion, rollback, or controlled failure.
- Reject concurrent ownership attempts.

Ownership locks must be durable across application restarts.

## Health monitoring

Each Primary Owner shall publish availability, error rate, average response time, queue depth, consecutive failures, last successful execution, and current status (Healthy, Degraded, Unhealthy). The Health Monitoring Module uses these metrics to determine whether Backup activation is permitted.

## Approval rules

Automatic failover may occur only when enabled in system configuration.

Manual failover requires appropriate administrative permission, recording of the reason, audit logging of the approval, and notification to designated administrators where configured.

Emergency overrides shall follow the governance rules defined in the System Administration Module.

## Audit and reporting

Every ownership change shall record Workflow Stage, Previous Owner, New Owner, Failover Reason, Activation Time, Restoration Time (if applicable), Correlation ID, User or System Process, and Approval Reference (if required). Ownership history must be immutable.

Operational reports shall show current stage owners, active backup owners, failover/failback events, ownership duration, service availability, and ownership changes by date and workflow stage, with PDF, Excel, and CSV export.

## Acceptance criteria

The named owner and backup ownership model is complete only when:

- Every payment workflow stage has one Primary Owner and one Backup Owner.
- Backup Owners execute work only under approved failover conditions.
- Ownership locking prevents simultaneous execution by Primary and Backup Owners.
- Automatic and manual failover follow documented activation rules.
- Failback returns control safely without duplicating or interrupting financial transactions.
- All ownership changes are fully audited and reportable.
- Monitoring exposes service health and ownership status for every workflow stage.
- Automated tests verify normal execution, automatic failover, manual failover, failback, ownership locking, concurrent execution prevention, and disaster recovery scenarios.
