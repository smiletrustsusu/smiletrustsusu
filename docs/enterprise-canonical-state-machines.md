# Enterprise Canonical State Machine & Lifecycle Specification (ECSMLS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 4 — Authoritative Lifecycle / State Machine Specification  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Machine registry:** `src/core/canonical-state-machine-registry.js`  
**Companion matrices:** [`ecsmls-catalogs.md`](./ecsmls-catalogs.md)

Cross-references: Phase 1 [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) / [`emas-matrices.md`](./emas-matrices.md); Phase 2 [`enterprise-consistency-review.md`](./enterprise-consistency-review.md) / [`phase2-registers.md`](./phase2-registers.md) / [`enterprise-architecture-review-workflow.md`](./enterprise-architecture-review-workflow.md) / [`enterprise-governance-validation.md`](./enterprise-governance-validation.md); Phase 3 [`enterprise-canonical-domain-model.md`](./enterprise-canonical-domain-model.md) / [`ecdm-catalogs.md`](./ecdm-catalogs.md) / `src/core/canonical-domain-registry.js`.

This document is the **single authoritative definition of every entity lifecycle / state machine** across **Modules 1–30**. It is machine-readable for Workflow Engine validation and eliminates duplicate state definitions.

---

## 1. Authoritative status & design principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECSMLS-P01 | Single source | One canonical machine ID (`SM-*`) per lifecycle concern; module `*-lifecycle.js` files are **sources**, not competing authorities |
| ECSMLS-P02 | ECDM binding | Every machine references an ECDM `ENT-*` code; no new business entities |
| ECSMLS-P03 | Owner exclusivity | Transition authority sits with the owning module; consumers validate via registry helpers |
| ECSMLS-P04 | No invented parallels | Transitions must map to live code matrices (loan, payment, workflow, AI, platform, etc.) |
| ECSMLS-P05 | Terminal integrity | Terminal states have no outbound edges except **documented approved recovery** |
| ECSMLS-P06 | Money mutation fence | Money/transaction machines are **not** owned by Modules **28** or **29** |
| ECSMLS-P07 | Advisory AI | Module 29 machines govern advisory artifacts only; Module **24** remains deterministic policy authority |
| ECSMLS-P08 | In-process gateway | Module **20** remains in-process; ECSMLS does not introduce HTTP APIs |
| ECSMLS-P09 | Audit & monitor | Privileged/financial transitions are attributable (Module 13) and observable (Module 19) |
| ECSMLS-P10 | Versioning | Machine definitions version `MAJOR.MINOR.PATCH`; breaking transition removals need ADR |

**Project reality (normative):** vanilla JS SPA; Module **20** in-process gateway; integer **pesewas**; Module **29** AI advisory; Module **24** Rule Engine deterministic; Module **30** Platform Admin.

---

## 2. IMPLEMENTATION BOUNDARY

| In scope | Out of scope |
|----------|--------------|
| Canonical **state machines / lifecycles** for ECDM entities that have statuses | Creating new business entities |
| Allowed / prohibited transitions, terminals, recovery, ownership | Modifying module ownership |
| Registry helpers for Workflow Engine validation | Redefining APIs, schemas, permissions |
| Alignment with existing `src/core/*-lifecycle.js` and workflow matrices | Introducing new business functionality |
| Traceability to Phases 1–3 and Modules 1–30 | Overriding prior governance without ADR notes |
| Docs + registry + consistency tests | Money math / RBAC / posting engine changes; new navigation |

**MUST reference:** Phase 3 entities (`canonical-domain-registry.js`, ECDM docs); owning modules; APIs/events **by identifier only**.

**MUST NOT:** invent parallel conflicting machines; change live posting paths; grant Modules 28/29 money mutation authority.

---

## 3. Phase Input & Dependency Rules Specification

### 3.1 Required inputs (consume only)

| Input | Artifact |
|-------|----------|
| Phase 1 EMAS | `docs/enterprise-master-architecture.md`, `docs/emas-matrices.md` |
| Phase 2 consistency / governance | `docs/enterprise-consistency-review.md`, `docs/phase2-registers.md`, `docs/enterprise-architecture-review-workflow.md`, `docs/enterprise-governance-validation.md` |
| Phase 3 ECDM | `docs/enterprise-canonical-domain-model.md`, `docs/ecdm-catalogs.md`, `src/core/canonical-domain-registry.js` |
| Modules 1–30 | Module specs / ops / lifecycle sources under `docs/` and `src/core/` |
| Approved global standards | Naming, classification, audit, and governance conventions already ratified in Phases 1–3 |

### 3.2 Precedence (conflicts)

1. **ADRs / explicit exceptions** (highest)  
2. **EMAS** (Phase 1)  
3. **Phase 2** consistency & governance registers  
4. **ECDM** (Phase 3)  
5. **Module specs** (Modules 1–30)  
6. **Global standards** (lowest)

**Unresolved conflicts MUST be escalated** via the Architecture Review Workflow. Do **not** resolve implicitly inside ECSMLS.

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | ECSMLS may only reference entities that exist in ECDM (`ENT-*`) |
| D2 | Owning module for a machine MUST align with ECDM entity ownership (except documented sub-lifecycles on the same entity) |
| D3 | Transition matrices MUST prefer existing lifecycle/workflow source files over new invented graphs |
| D4 | Workflow Engine (Module 23) **consumes** ECSMLS for validation; it does not redefine money posting |
| D5 | Rule Engine (24) remains deterministic authority for policy decisions; AI (29) remains advisory |
| D6 | Platform Admin (30) and Integration Hub (28) govern platform/partner lifecycles only — not Susu ledger mutation |

### 3.4 Output constraints

| Deliverable | Constraint |
|-------------|------------|
| `docs/enterprise-canonical-state-machines.md` | Primary ECSMLS; authoritative narrative + templates |
| `docs/ecsmls-catalogs.md` | Companion matrices only; no new entities |
| `src/core/canonical-state-machine-registry.js` | Machine-readable catalog + validators |
| `tests/ecsmls-consistency.test.js` | Registry/docs invariants |

Outputs MUST NOT redefine APIs, DB schemas, RBAC matrices, or posting formulas.

### 3.5 Prohibited activities

- Create new business entities or change ECDM ownership  
- Modify module ownership or EMAS module boundaries  
- Redefine APIs / schemas / permissions  
- Introduce new business functionality or navigation  
- Override Phase 1–3 governance without ADR notes  
- Assign money/transaction mutation authority to Modules **28** or **29**  
- Invent parallel loan/payment/workflow machines that conflict with live matrices  

### 3.6 Traceability requirements

Every machine MUST record:

| Field | Example |
|-------|---------|
| Source Phase / Module | Phase 3 / Module 8 |
| Owning Entity ID | `ENT-LON-001` |
| Module ID | `8` |
| Source ref | `src/core/loans-workflow.js#LOAN_TRANSITIONS` |
| Workflow / API / Event IDs (where known) | `LoanStatusChanged`, route ids by identifier only |

### 3.7 Validation requirements

| Check | Enforcement |
|-------|-------------|
| Unique `SM-*` IDs | `validateStateMachineRegistry()` + tests |
| Transitions only use defined states | registry validator |
| Terminal outbound only via approved recovery | registry validator |
| `entityId` exists in ECDM | registry validator |
| Required machines present (customer, loan, payment, workflow, AI, platform) | tests |
| Money machines not owned by 28/29 | tests + validator |
| Docs include this Input & Dependency Rules section | tests |

---

## 4. Catalog summary

| Metric | Count |
|--------|-------|
| Canonical state machines | 45 |
| Domains covered | Customer, Savings/Susu, Loans, Payments, Accounting, Workflow, Documents, Jobs, Monitoring/Security, Backup, Rules, Exchange, BI, Integration, AI, Platform, Identity/Org/Config/Sync |
| Registry validation | `validateStateMachineRegistry()` |
| Money entities fenced from 28/29 | via ECDM `MONEY_TRANSACTION_ENTITY_CODES` + ECSMLS ownership checks |

Companion compact tables: [`ecsmls-catalogs.md`](./ecsmls-catalogs.md).

---

## 5. State Machine Catalog (templates)

### Template fields (normative)

Each machine below uses:

| Field | Meaning |
|-------|---------|
| ID / Name / Version | `SM-*`, display name, semver |
| Owning Module / Entity | Module id + `ENT-*` |
| Purpose | Lifecycle intent |
| Initial / Intermediate / Terminal / Suspended / Recovery / Error | State partitions |
| Allowed / Prohibited | Allowed = matrix edges; Prohibited = any non-edge (unless recovery) |
| Preconditions / Postconditions | Owner validation hooks (referenced, not redefined) |
| Events / Auth | Event & action identifiers only |
| Timeout / Retry / Compensation / Rollback | Where the source module defines them |
| Audit / Monitoring | Modules 13 / 19 |
| Source | Live code / docs reference |

---

### 5.1 Customer

#### SM-CUS-001 CustomerLifecycle

| Field | Value |
|-------|-------|
| Owning Module | **3** Customer CRM |
| Entity | `ENT-CUS-001` |
| Purpose | `memberStatus` lifecycle |
| Initial | `Pending Verification` |
| Intermediate | `Active` |
| Suspended | `Suspended` |
| Terminal | `Deceased` |
| Recovery | `Closed→Active`; `Blacklisted→Suspended\|Closed` |
| Error | (blacklist / close as operational outcomes) |
| Allowed | See matrix in registry / catalogs |
| Prohibited | Any edge not in matrix |
| Preconditions | Actor may change status (`Customer.Update` roles) |
| Postconditions | `active` flag derived; status history + audit |
| Events | (module audit actions) |
| Auth | `Customer.Update` |
| Timeout / Retry | N/A |
| Compensation / Rollback | Status history only; no money |
| Audit / Monitoring | Module 13 |
| Version | 1.0.0 |
| Source | `customer-crm.js#CRM_STATUSES` |

#### SM-CUS-002 CustomerKycVerification

| Field | Value |
|-------|-------|
| Owning Module | 3 |
| Entity | `ENT-CUS-001` (sub-lifecycle) |
| Purpose | KYC verification |
| Initial | `Pending` |
| Intermediate | — |
| Terminal | none exclusive (Verified/Rejected re-openable) |
| Error | `Rejected` |
| Allowed | `Pending↔Verified/Rejected` |
| Auth | `Customer.KYC` |
| Source | `KYC_VERIFICATION` |

---

### 5.2 Savings / Susu

#### SM-SAV-001 SavingsAccountLifecycle — Module **6** · `ENT-SAV-002`

Initial `Active`; suspended `Dormant`/`Suspended`; terminal `Closed`. Source: `ACCOUNT_STATUSES`.

#### SM-SAV-002 CollectionFinancialLifecycle — Module **6** · `ENT-SAV-003`

Shared financial helper matrix (`txn-lifecycle.js`). Initial `Draft`; error `Validation Failed`/`Failed`/`Rejected`; terminal `Cancelled`/`Reversed`. **Does not replace** live collection screen strings; Workflow Engine uses this for helper validation.

#### SM-GRP-001 / SM-GRP-002 / SM-GRP-003 — Module **7**

| ID | Entity | Initial | Terminal | Source |
|----|--------|---------|----------|--------|
| SM-GRP-001 | `ENT-GRP-001` | Pending | Closed, Completed | `GROUP_STATUSES` |
| SM-GRP-002 | `ENT-GRP-002` | Active | Closed, Transferred | group membership |
| SM-GRP-003 | `ENT-GRP-003` | Open | Closed | meetings |

---

### 5.3 Loans

#### SM-LON-001 LoanLifecycle — Module **8** · `ENT-LON-001`

| Field | Value |
|-------|-------|
| Purpose | Align with `docs/loan-status-transitions.md` + `loans-workflow.js` |
| Initial | `Pending` (compat; also `Draft`/`Submitted` in matrix) |
| Intermediate | Under Review, Pending Approval, Approved, Ready for Disbursement, Disbursed, Active, Restructured, Recovered |
| Suspended / stress | `Defaulted`, `Written Off` |
| Terminal | `Completed`, `Settled`, `Rejected`, `Cancelled` |
| Recovery | Defaulted→Recovered; Written Off→Recovered; Recovered→Active/Completed |
| Allowed | `LOAN_TRANSITIONS` exactly |
| Prohibited | Any other edge; transitions from terminal |
| Preconditions | Approval limits, documents, maker-checker flags as in `transitionLoanStatus` |
| Postconditions | Status history + deniedTransitions + audit |
| Events | `LoanStatusChanged` |
| Auth | `Loan.Transition` / approve-disburse actions |
| Timeout | Approval expiry handled by txn approval helpers where used |
| Compensation | Restructuring history; settlement/repayment engines unchanged |
| Rollback | Denied transitions leave prior status |
| Audit / Monitoring | 13 / 19 |
| Version | 1.0.0 |
| Source | `loans-workflow.js`, `loan-status-transitions.md` |

---

### 5.4 Withdrawals & Payments

#### SM-WDL-001 WithdrawalRequestLifecycle — Module **9** · `ENT-WDL-001`

Initial `Requested` (compat path). Terminal `Rejected`/`Cancelled`/`Reversed`. Allowed: `WITHDRAWAL_TRANSITIONS`. Auth: withdrawal approve/pay actions.

#### SM-PAY-001 PaymentTransactionLifecycle — Module **16** · `ENT-PAY-001`

| Field | Value |
|-------|-------|
| Initial | `created` |
| Intermediate | validated, pending_*, authorized, processing, completed, partial refund/reverse |
| Terminal | `validation_failed`, `failed`, `cancelled`, `expired`, `fully_refunded`, `fully_reversed` |
| Allowed | `PAYMENT_TRANSITION_MATRIX` |
| Events | `PaymentStatusChanged`, stage events in `STAGE_OWNER_EVENTS` |
| Auth | Payment Engine / `Payment.Transition` |
| Retry | Provider retry stages (Module 16) |
| Compensation | refund/reverse paths from `completed` |
| Source | `payment-lifecycle.js` |

---

### 5.5 Accounting

#### SM-FIN-001 JournalEntryLifecycle — Module **10** · `ENT-FIN-002`

`Draft→Posted→Reversed`; `Draft→Cancelled`. Auth: `Accounting.Post`.

#### SM-FIN-002 AccountingPeriodLifecycle — Module **10** · `ENT-FIN-004`

`Open↔Closed` (re-open is approved recovery for corrections). Auth: `Accounting.ClosePeriod`.

---

### 5.6 Workflow (Module 23)

| ID | Entity | Initial | Terminal | Suspended / Recovery | Source |
|----|--------|---------|----------|----------------------|--------|
| SM-WFK-001 | `ENT-WFK-001` | draft | retired | — | `DEFINITION_TRANSITIONS` |
| SM-WFK-002 | `ENT-WFK-002` | draft | completed, cancelled | suspended, waiting / retrying | `WORKFLOW_TRANSITION_MATRIX` |
| SM-WFK-003 | `ENT-WFK-003` | pending | completed, cancelled | suspended | `TASK_TRANSITION_MATRIX` |
| SM-WFK-004 | `ENT-WFK-004` | open | closed, cancelled | waiting | `CASE_TRANSITION_MATRIX` |

Orchestration only — **does not post** collections, interest, or ledgers.

---

### 5.7 Documents & records

| ID | Entity | Source |
|----|--------|--------|
| SM-DOC-001 | `ENT-DOC-001` | `DOCUMENT_TRANSITION_MATRIX` |
| SM-DOC-002 | `ENT-DOC-001` | `RECEIPT_OUTCOME_MATRIX` |
| SM-DOC-003 | `ENT-DOC-001` | `TEMP_RECEIPT_MATRIX` |
| SM-DOC-004 | `ENT-DOC-002` | `RECORD_TRANSITIONS` (Module 26) |

Receipts are documents, not the financial transaction (Module 17).

---

### 5.8 Jobs, monitoring, security, backup

| ID | Module | Entity | Notes |
|----|--------|--------|-------|
| SM-JOB-001 | 18 | `ENT-JOB-002` | `dead_letter→queued` approved recovery |
| SM-MON-001 | 19 | `ENT-MON-002` | Operational incident matrix |
| SM-SEC-001 | 22 | `ENT-SEC-001` | Security incident |
| SM-SEC-002 | 22 | `ENT-SEC-002` | Fraud case |
| SM-BKP-001 | 21 | `ENT-BKP-001` | Backup set |
| SM-BKP-002 | 21 | `ENT-BKP-001` | Restore job; `failed→requested` recovery |

---

### 5.9 Rules, exchange, BI

| ID | Module | Entity | Source |
|----|--------|--------|--------|
| SM-RUL-001 | 24 | `ENT-RUL-001` | `RULE_TRANSITION_MATRIX` (deterministic) |
| SM-XCH-001 | 25 | `ENT-XCH-001` | `EXCHANGE_TRANSITIONS` |
| SM-BI-001 | 27 | `ENT-BI-002` | `KPI_TRANSITIONS` |

---

### 5.10 Integration (Module 28) — no money mutation

| ID | Entity | Source |
|----|--------|--------|
| SM-INT-001 | `ENT-INT-001` | `PROVIDER_TRANSITIONS` |
| SM-INT-002 | `ENT-INT-002` | webhook subscription |
| SM-INT-003 | `ENT-INT-002` | delivery attempts; DLQ recovery |
| SM-INT-004 | `ENT-INT-003` | message queue |

---

### 5.11 AI (Module 29) — advisory only

| ID | Entity | Source |
|----|--------|--------|
| SM-AI-001 | `ENT-AI-001` | `MODEL_TRANSITIONS` |
| SM-AI-002 | `ENT-AI-002` | dataset draft→retired |
| SM-AI-003 | `ENT-AI-005` | recommendation pending→accepted/rejected/overridden |

**Boundary:** AI MUST NOT post collections, auto-approve loans/withdrawals, or replace Module 24.

---

### 5.12 Platform (Module 30)

| ID | Entity | Source |
|----|--------|--------|
| SM-PLT-001 | `ENT-PLT-001` | `TENANT_TRANSITIONS` |
| SM-PLT-002 | `ENT-PLT-002` | `LICENSE_TRANSITIONS` |
| SM-PLT-003 | `ENT-PLT-006` | deployment states |
| SM-PLT-004 | `ENT-PLT-005` | maintenance states |
| SM-PLT-005 | `ENT-PLT-004` | feature flag draft/active/kill |

---

### 5.13 Identity / org / config / sync

| ID | Module | Entity | Notes |
|----|--------|--------|-------|
| SM-ORG-001 | 1 | `ENT-ORG-004` | Minimal Draft→Published→Retired |
| SM-IDN-001 | 1 | `ENT-IDN-001` | Active/Suspended/Disabled |
| SM-CFG-001 | 14 | `ENT-CFG-001` | draft/published/retired |
| SM-SYN-001 | 15 | `ENT-SYN-001` | `QUEUE_STATUSES` sync queue |

---

## 6. Transition definitions (normative shape)

Each transition in the registry is:

| Field | Description |
|-------|-------------|
| `from` / `to` | States |
| `trigger` | `transition:{from}->{to}` or module-specific |
| `initiator` | Owning module actor / system (documented in module ops) |
| `validation` | Owner preconditions (limits, KYC, period open, …) |
| `auth` | Action identifier only |
| `events` | Event identifiers only |
| `failure` | Remain in `from`; record denial/history where implemented |
| `rollback` | Compensation path if defined (refund/reverse/restructure) |

Full edge lists: registry `matrix` / [`ecsmls-catalogs.md`](./ecsmls-catalogs.md) Transition Matrix section.

---

## 7. Ownership, terminals, errors, cross-module integration

### 7.1 Ownership

| Rule | Statement |
|------|-----------|
| O1 | Only the owning module may authorize a transition |
| O2 | Module 23 may **orchestrate** and **validate** via ECSMLS; it does not become money owner |
| O3 | Modules 28/29/30 must not own `MONEY_TRANSACTION_ENTITY_CODES` mutation machines |

### 7.2 Terminal states

Terminal register: catalogs. Illegal outbound from terminal **fails validation** unless listed in `approvedRecoveryFromTerminal` (e.g. job DLQ replay, restore retry, period re-open).

### 7.3 Error handling

| Pattern | Machines |
|---------|----------|
| Explicit error states | Payment failed/expired; loan Rejected; sync failed/conflict; restore failed |
| Denial without move | Loan/withdrawal `deniedTransitions` |
| Retry / DLQ | Jobs, webhooks, messages, sync |

### 7.4 Cross-module integration

| From | To | Integration |
|------|----|-------------|
| Loan / Withdrawal / Collection | Workflow 23 | Orchestration + approval tasks |
| Payment 16 | Accounting 10 / Documents 17 / Notifications 12 | Post, receipt, notify (owners unchanged) |
| AI 29 | Security 22 | Advisory fraud may escalate to `ENT-SEC-002` |
| Platform 30 | All | Flags/maintenance govern availability — no domain post |
| Sync 15 | Financial owners | Queue applies; financial kinds never last-write-wins |

---

## 8. Governance (versioning, approval, deprecation)

| Change | Version | Approval |
|--------|---------|----------|
| Editorial / clarify docs | PATCH | Doc owners |
| Add optional state with edges from existing non-terminal | MINOR | Module owner + ECSMLS maintainer |
| Remove/rename state or break edge | MAJOR | ADR + Architecture Review Workflow |
| Change money machine owner | **Forbidden** without ADR + contract tests | Must preserve Modules 6–10 / 16 |

Deprecated machines remain readable until consumers migrate; mark `deprecated` in a future minor with replacement ID.

---

## 9. Traceability index (Phases / Modules)

| Machine | Phase source | Module | Entity |
|---------|--------------|--------|--------|
| SM-CUS-* | ECDM Customer | 3 | ENT-CUS-001 |
| SM-SAV-* / SM-GRP-* | ECDM Savings | 6–7 | ENT-SAV-*, ENT-GRP-* |
| SM-LON-001 | ECDM + loan-status docs | 8 | ENT-LON-001 |
| SM-WDL-001 | ECDM | 9 | ENT-WDL-001 |
| SM-FIN-* | ECDM Finance | 10 | ENT-FIN-* |
| SM-PAY-001 | ECDM Payments | 16 | ENT-PAY-001 |
| SM-WFK-* | ECDM Workflow | 23 | ENT-WFK-* |
| SM-DOC-* | ECDM Documents | 17/26 | ENT-DOC-* |
| SM-JOB / SM-MON / SM-SEC / SM-BKP | ECDM Monitoring/Platform | 18–22 | ENT-JOB/MON/SEC/BKP |
| SM-RUL / SM-XCH / SM-BI | ECDM | 24/25/27 | ENT-RUL/XCH/BI |
| SM-INT-* | ECDM Integration | 28 | ENT-INT-* |
| SM-AI-* | ECDM AI | 29 | ENT-AI-* |
| SM-PLT-* | ECDM Platform | 30 | ENT-PLT-* |
| SM-ORG / SM-IDN / SM-CFG / SM-SYN | ECDM Org/Identity | 1/14/15 | ENT-ORG/IDN/CFG/SYN |

EMAS organizes modules; Phase 2 registers ownership conflicts; ECDM binds entities; ECSMLS binds lifecycles.

---

## 10. Workflow Engine adapter

```js
import { isTransitionAllowed, assertTransition } from "../src/core/canonical-state-machine-registry.js";

isTransitionAllowed("SM-LON-001", "Pending", "Approved"); // true
assertTransition("SM-PAY-001", "created", "completed");   // { ok: false, error }
```

Do **not** rewrite `workflow-ops` unless a future tiny import is approved; registry is standalone.

---

*End of ECSMLS v1.0.0*
