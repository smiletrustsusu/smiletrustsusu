# Enterprise Canonical Domain Model (ECDM)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 3 — Authoritative Business Entity Specification  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Machine registry:** `src/core/canonical-domain-registry.js`  
**Companion matrices:** [`ecdm-catalogs.md`](./ecdm-catalogs.md)  

Cross-references: [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) (EMAS), [`emas-matrices.md`](./emas-matrices.md), Phase 2 [`enterprise-consistency-review.md`](./enterprise-consistency-review.md) / [`phase2-registers.md`](./phase2-registers.md) / [`enterprise-governance-validation.md`](./enterprise-governance-validation.md).

This document is the **single authoritative definition of every business entity** used across **Modules 1–30**. It eliminates duplicate entity definitions and establishes ownership, relationships, identifiers, and governance.

---

## 1. Hard boundaries

| In scope | Out of scope |
|----------|--------------|
| Canonical **business entities** only | Redefining APIs, DB schemas, workflows, or business logic |
| Ownership, aggregates, IDs, classification, cross-module usage | New functional requirements, new nav |
| Mapping to **actual** Susu platform concepts (`customers`, `collections`, `loans`, `ledgerEntries`, …) | Inventing a separate retail-banking product model |
| Logical persistence ownership (localStorage + optional SQL tables) | Schema redesign or money-math / RBAC / posting changes |
| Alignment with EMAS + Phase 2 | Rewriting Modules 1–30 specs |

**Project reality (normative):** vanilla JS SPA; Module **20** in-process gateway (no HTTP API server); integer **pesewas**; Admin = Branch Manager; KBA = Super Admin; SystemOwner = `john`; Modules **28** Integration Hub, **29** AI (advisory), **30** Platform Admin.

**Explicit non-ownership:** AI entities are **advisory**. Transactional entities (collections, loans, ledger, withdrawals, payments lifecycle) are owned by operational modules (**6–10**, **16**). Modules **28 / 29 / 30** must **not** own mutation of money entities.

**Not entities (configuration):** Cashier float / approval limit (default GHS 1,000), loan interest (15%), collection days (31) live as `SystemSetting` / config keys — not separate business entities.

---

## 2. Authoritative status & principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECDM-P01 | DDD language | One ubiquitous name per concept; aliases (Member→Customer, Contribution→Collection) map to the canonical name |
| ECDM-P02 | Single source of truth | Entity ownership is exclusive; writers are the owning module only |
| ECDM-P03 | Aggregate consistency | Within an aggregate root, invariants are consistent after each owner command |
| ECDM-P04 | Cross-module eventual | Across modules, consistency is via contracts/events; no private dual writes |
| ECDM-P05 | Audit first | Privileged and financial mutations are attributable (Module 13) |
| ECDM-P06 | Versioning | Entity definitions version `MAJOR.MINOR.PATCH`; breaking renames need ADR |
| ECDM-P07 | Naming | `ENT-{DOMAIN}-{NNN}` codes; PascalCase canonical names; persistence keys document reality |
| ECDM-P08 | Classification | Public / Internal / Confidential / Restricted (Phase 2 / AI governance) |
| ECDM-P09 | Money unit | Core engines store **pesewas**; UI may display GHS |
| ECDM-P10 | Advisory AI | Module 29 may recommend; Module 24 remains deterministic policy authority |

**Precedence:** Live posting paths → module contracts → module specs → this ECDM → EMAS organization → optional SQL migrations.

**Relation to `canonical-data-model.md`:** That doc is the PostgreSQL physical/logical table phase. ECDM is the **business entity** SoT. Table names cited here are **references**, not a redesign.

---

## 3. Catalog summary

| Metric | Count |
|--------|-------|
| Canonical entities | 67 |
| Aggregate roots | 46 |
| Relationships | 60 |
| Money/transaction codes guarded | 11 |
| Registry validation | PASS |

### Owning-module distribution

| Module | Name | Entity count |
|--------|------|--------------|
| 1 | Authentication & Session | 4 |
| 3 | Customer CRM | 2 |
| 4 | Agent Management | 1 |
| 5 | Branch Management | 1 |
| 6 | Individual Savings Collection | 5 |
| 7 | Group Susu Management | 3 |
| 8 | Loans | 2 |
| 9 | Withdrawals | 1 |
| 10 | Accounting & GL | 5 |
| 12 | Notification | 1 |
| 13 | Audit | 1 |
| 14 | System Admin & Config | 2 |
| 15 | Offline Sync | 3 |
| 16 | Payments / MoMo | 2 |
| 17 | Receipts & Documents | 1 |
| 18 | Jobs | 2 |
| 19 | Monitoring | 2 |
| 20 | API Gateway | 2 |
| 21 | Backup/DR | 1 |
| 22 | Security Ops | 2 |
| 23 | Workflow | 4 |
| 24 | Rule Engine | 2 |
| 25 | Data Exchange | 1 |
| 26 | Digital Records | 1 |
| 27 | Enterprise BI | 2 |
| 28 | Integration Hub | 3 |
| 29 | AI | 5 |
| 30 | Platform Admin | 6 |

### Domains covered

- **AI** (5): AiModel, AiDataset, AiPrediction, AiFraudAlert, AiRecommendation
- **Customer Management** (2): Customer, Beneficiary
- **Documents** (2): ReceiptDocument, DigitalRecord
- **Finance** (5): ChartOfAccount, JournalEntry, LedgerEntry, CashClosing, LegacyTransaction
- **Identity** (4): User, Session, Device, Notification
- **Integration** (8): OfflineQueueItem, IdempotencyKey, ApiClient, ApiKey, ExchangeDataset, IntegrationProvider, IntegrationWebhook, IntegrationMessage
- **Loans** (2): Loan, LoanRepayment
- **Monitoring** (7): AuditEvent, JobDefinition, JobInstance, OperationalAlert, OperationalIncident, SecurityIncident, FraudCase
- **Organization** (6): Organization, Branch, Agent, Role, Permission, SystemSetting
- **Payments** (2): PaymentTransaction, ProviderReference
- **Platform/Tenant** (7): BackupSet, Tenant, License, PlatformEnvironment, FeatureFlagRule, MaintenanceWindow, DeploymentRecord
- **Reporting/BI** (2): MetricDefinition, KpiDefinition
- **Savings/Susu** (9): SavingsProduct, SavingsAccount, Collection, CollectionAdjustment, ContributionCycle, SusuGroup, GroupMembership, GroupMeeting, WithdrawalRequest
- **Workflow** (6): WorkflowDefinition, WorkflowInstance, WorkflowTask, WorkflowCase, BusinessRule, RuleDecision

---

## 4. Business Entity Catalog

Each entity uses the ECDM definition template. Full compact matrices live in [`ecdm-catalogs.md`](./ecdm-catalogs.md).

### ENT-ORG-001 — Organization

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-ORG-001 |
| **Canonical Name** | Organization |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | Legal/business identity for the Susu operator (Smile Trust). |
| **Description** | Maps to platform concept(s): `settings.businessId`, `businesses`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 14 — System Admin & Config |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-ORG-002, ENT-PLT-001 |
| **Relationships** | ← ENT-ORG-002 (N:1 belongs_to); ← ENT-PLT-001 (0..1:1 may_map_org) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 14 |
| **Primary ID** | business_id |
| **Alternate IDs / Business Keys** | settings.businessId / businesses.client_id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 14; persistence: settings.businessId, businesses (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-ORG-002 — Branch

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-ORG-002 |
| **Canonical Name** | Branch |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | Operational branch / office scope for customers, agents, and cash. |
| **Description** | Maps to platform concept(s): `branches`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 5 — Branch Management |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-ORG-003, ENT-IDN-001, ENT-CUS-001, ENT-SAV-003, ENT-FIN-004 |
| **Relationships** | → ENT-ORG-001 (N:1 belongs_to); ← ENT-ORG-003 (N:1 assigned_to); ← ENT-IDN-001 (N:1 scoped_to); ← ENT-CUS-001 (N:1 belongs_to); ← ENT-SAV-003 (N:1 at_branch); ← ENT-FIN-004 (N:1 branch_close) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 5 |
| **Primary ID** | branch_id |
| **Alternate IDs / Business Keys** | BRH / branch code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 5; persistence: branches (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-ORG-003 — Agent

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-ORG-003 |
| **Canonical Name** | Agent |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | Field collector/agent profile, routes, attendance (not the login User). |
| **Description** | Maps to platform concept(s): `agents`, `agentRoutes`, `agentAttendance`, `agentVisits`, `agentLeave`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 4 — Agent Management |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-SAV-003 |
| **Relationships** | → ENT-ORG-002 (N:1 assigned_to); → ENT-IDN-001 (0..1:1 may_link_user); ← ENT-SAV-003 (N:0..1 collected_by) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 4 |
| **Primary ID** | agent_id |
| **Alternate IDs / Business Keys** | AGT |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 4; persistence: agents, agentRoutes, agentAttendance, agentVisits, agentLeave (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-ORG-004 — Role

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-ORG-004 |
| **Canonical Name** | Role |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | RBAC role definition (Admin=Branch Manager, KBA=Super Admin, SystemOwner=john). |
| **Description** | Maps to platform concept(s): `roles`, `users.role`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 1 — Authentication & Session |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-ORG-005, ENT-IDN-001 |
| **Relationships** | ← ENT-ORG-005 (M:N granted_via); ← ENT-IDN-001 (N:1 has_role) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 1 |
| **Primary ID** | role_id |
| **Alternate IDs / Business Keys** | role code (Collector, Cashier, Admin, KBA, SystemOwner) |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 1; persistence: roles, users.role (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-ORG-005 — Permission

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-ORG-005 |
| **Canonical Name** | Permission |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | Atomic RBAC action grant bound to roles. |
| **Description** | Maps to platform concept(s): `permissions`, `role_permissions`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 1 — Authentication & Session |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-ORG-004 (M:N granted_via) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 1 |
| **Primary ID** | permission_id |
| **Alternate IDs / Business Keys** | action string (e.g. Collection.Post) |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 1; persistence: permissions, role_permissions (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-IDN-001 — User

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-IDN-001 |
| **Canonical Name** | User |
| **Version** | 1.0.0 |
| **Domain** | Identity |
| **Purpose** | Authenticated application user account. |
| **Description** | Maps to platform concept(s): `users`, `app_users`, `deletedUsers`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 1 — Authentication & Session |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-ORG-003, ENT-IDN-002, ENT-AUD-001 |
| **Relationships** | ← ENT-ORG-003 (0..1:1 may_link_user); → ENT-ORG-004 (N:1 has_role); → ENT-ORG-002 (N:1 scoped_to); ← ENT-IDN-002 (N:1 belongs_to); ← ENT-AUD-001 (N:0..1 actor) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 1 |
| **Primary ID** | user_id |
| **Alternate IDs / Business Keys** | username (unique) |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 1; persistence: users, app_users, deletedUsers (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-IDN-002 — Session

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-IDN-002 |
| **Canonical Name** | Session |
| **Version** | 1.0.0 |
| **Domain** | Identity |
| **Purpose** | Logged-in session binding user to device/browser. |
| **Description** | Maps to platform concept(s): `sessions`, `sessionStorage`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 1 — Authentication & Session |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-IDN-001 (N:1 belongs_to); → ENT-IDN-003 (N:1 on_device) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 1 |
| **Primary ID** | session_id |
| **Alternate IDs / Business Keys** | sessionStorage user id |
| **State Machine Ref** | Created → Active → Expired/Revoked |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 1; persistence: sessions, sessionStorage (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-IDN-003 — Device

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-IDN-003 |
| **Canonical Name** | Device |
| **Version** | 1.0.0 |
| **Domain** | Identity |
| **Purpose** | Registered EXE/APK/browser device for sync and audit attribution. |
| **Description** | Maps to platform concept(s): `devices`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 15 — Offline Sync |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): ENT-IDN-002, ENT-SYN-001 |
| **Relationships** | ← ENT-IDN-002 (N:1 on_device); ← ENT-SYN-001 (N:0..1 from_device) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 15 |
| **Primary ID** | device_id |
| **Alternate IDs / Business Keys** | DEV |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 15; persistence: devices (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-CUS-001 — Customer

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-CUS-001 |
| **Canonical Name** | Customer |
| **Version** | 1.0.0 |
| **Domain** | Customer Management |
| **Purpose** | Susu member / customer master (CRM). |
| **Description** | Maps to platform concept(s): `customers`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 3 — Customer CRM |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-CUS-002, ENT-SAV-002, ENT-SAV-003, ENT-SAV-005, ENT-GRP-002, ENT-LON-001, ENT-WDL-001, ENT-PAY-001, ENT-DOC-001, ENT-NTF-001 |
| **Relationships** | → ENT-ORG-002 (N:1 belongs_to); ← ENT-CUS-002 (N:1 nominee_of); ← ENT-SAV-002 (N:1 owned_by); ← ENT-SAV-003 (N:1 for_customer); ← ENT-SAV-005 (N:1 for_customer); ← ENT-GRP-002 (N:1 customer); → ENT-GRP-001 (N:0..1 optional_group); ← ENT-LON-001 (N:1 borrower); ← ENT-WDL-001 (N:1 requested_by); ← ENT-PAY-001 (N:0..1 for_customer); ← ENT-DOC-001 (N:1 issued_to); ← ENT-NTF-001 (N:0..1 to_customer) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 3 |
| **Primary ID** | customer_id |
| **Alternate IDs / Business Keys** | CUS / customer number |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 3; persistence: customers (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-CUS-002 — Beneficiary

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-CUS-002 |
| **Canonical Name** | Beneficiary |
| **Version** | 1.0.0 |
| **Domain** | Customer Management |
| **Purpose** | Nominee/beneficiary linked to a customer for payout guidance. |
| **Description** | Maps to platform concept(s): `beneficiaries`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 3 — Customer CRM |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-CUS-001 (N:1 nominee_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 3 |
| **Primary ID** | beneficiary_id |
| **Alternate IDs / Business Keys** | customerId + nominee identity |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 3; persistence: beneficiaries (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SAV-001 — SavingsProduct

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SAV-001 |
| **Canonical Name** | SavingsProduct |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Personal savings product definition (daily/weekly/flexible contribution expectations). |
| **Description** | Maps to platform concept(s): `savingsProducts`, `savings_products`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 6 — Individual Savings Collection |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-SAV-002 |
| **Relationships** | ← ENT-SAV-002 (N:1 product) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 6 |
| **Primary ID** | product_id |
| **Alternate IDs / Business Keys** | product code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 6; persistence: savingsProducts, savings_products (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SAV-002 — SavingsAccount

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SAV-002 |
| **Canonical Name** | SavingsAccount |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Personal Susu/savings account; balance is ledger-derived cache. |
| **Description** | Maps to platform concept(s): `savingsAccounts`, `savings_accounts`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 6; Modules 28/29/30 must not post. |
| **Owning Module** | Module 6 — Individual Savings Collection |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-SAV-003, ENT-WDL-001 |
| **Relationships** | → ENT-CUS-001 (N:1 owned_by); → ENT-SAV-001 (N:1 product); ← ENT-SAV-003 (N:0..1 credits_account); ← ENT-WDL-001 (N:0..1 from_account) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 6 |
| **Primary ID** | savings_account_id |
| **Alternate IDs / Business Keys** | SAV |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 6; persistence: savingsAccounts, savings_accounts (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SAV-003 — Collection

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SAV-003 |
| **Canonical Name** | Collection |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Posted individual savings contribution (authoritative money event). |
| **Description** | Maps to platform concept(s): `collections`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 6; Modules 28/29/30 must not post. |
| **Owning Module** | Module 6 — Individual Savings Collection |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-SAV-004, ENT-FIN-003, ENT-DOC-001 |
| **Relationships** | → ENT-CUS-001 (N:1 for_customer); → ENT-SAV-002 (N:0..1 credits_account); → ENT-ORG-003 (N:0..1 collected_by); → ENT-ORG-002 (N:1 at_branch); ← ENT-SAV-004 (N:1 adjusts); ← ENT-FIN-003 (0..1:1 may_post_from); ← ENT-DOC-001 (0..1:1 receipt_for) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 6 |
| **Primary ID** | collection_id |
| **Alternate IDs / Business Keys** | COL / receipt_no / idempotency_key |
| **State Machine Ref** | Initiated → Pending → Validated → Posted → (Reversal) |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | CollectionPosted / CollectionReversed (Module 6) |
| **Owned APIs / Tables (logical)** | Contracts under Module 6; persistence: collections (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SAV-004 — CollectionAdjustment

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SAV-004 |
| **Canonical Name** | CollectionAdjustment |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Correction/reversal metadata for a posted collection (never silent delete). |
| **Description** | Maps to platform concept(s): `collectionAdjustments`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 6; Modules 28/29/30 must not post. |
| **Owning Module** | Module 6 — Individual Savings Collection |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-SAV-003 (N:1 adjusts) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 6 |
| **Primary ID** | adjustment_id |
| **Alternate IDs / Business Keys** | collectionId + adjustment seq |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 6; persistence: collectionAdjustments (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SAV-005 — ContributionCycle

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SAV-005 |
| **Canonical Name** | ContributionCycle |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Logical contribution cycle / sitting (default 31-day cycle; sittingsPaid on collections). |
| **Description** | Maps to platform concept(s): `collections.sittingsPaid`, `customers.sittingsPaid`, `settings.collectionDays`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 6 — Individual Savings Collection |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-CUS-001 (N:1 for_customer) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 6 |
| **Primary ID** | cycle_ref |
| **Alternate IDs / Business Keys** | customerId + cycle/sitting number |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 6; persistence: collections.sittingsPaid, customers.sittingsPaid, settings.collectionDays (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-GRP-001 — SusuGroup

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-GRP-001 |
| **Canonical Name** | SusuGroup |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Group Susu circle (state.groups); distinct from Branch though legacy dual-use exists. |
| **Description** | Maps to platform concept(s): `groups`, `susu_groups`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 7 — Group Susu Management |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-GRP-002, ENT-GRP-003, ENT-CUS-001 |
| **Relationships** | ← ENT-GRP-002 (N:1 member_of); ← ENT-GRP-003 (N:1 of_group); ← ENT-CUS-001 (N:0..1 optional_group) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 7 |
| **Primary ID** | group_id |
| **Alternate IDs / Business Keys** | GRP |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 7; persistence: groups, susu_groups (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-GRP-002 — GroupMembership

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-GRP-002 |
| **Canonical Name** | GroupMembership |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Customer membership in a Susu group. |
| **Description** | Maps to platform concept(s): `susu_group_members`, `customers.groupId`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 7 — Group Susu Management |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-GRP-001 (N:1 member_of); → ENT-CUS-001 (N:1 customer) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 7 |
| **Primary ID** | membership_id |
| **Alternate IDs / Business Keys** | groupId + customerId |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 7; persistence: susu_group_members, customers.groupId (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-GRP-003 — GroupMeeting

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-GRP-003 |
| **Canonical Name** | GroupMeeting |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Scheduled/held group meeting where contributions may be collected. |
| **Description** | Maps to platform concept(s): `groupMeetings`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 7; Modules 28/29/30 must not post. |
| **Owning Module** | Module 7 — Group Susu Management |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-GRP-001 (N:1 of_group) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 7 |
| **Primary ID** | meeting_id |
| **Alternate IDs / Business Keys** | groupId + meeting date |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 7; persistence: groupMeetings (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-LON-001 — Loan

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-LON-001 |
| **Canonical Name** | Loan |
| **Version** | 1.0.0 |
| **Domain** | Loans |
| **Purpose** | Customer loan account; live statuses Pending→Approved→Active→Completed (etc.). |
| **Description** | Maps to platform concept(s): `loans`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 8; Modules 28/29/30 must not post. |
| **Owning Module** | Module 8 — Loans |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-LON-002, ENT-FIN-003 |
| **Relationships** | → ENT-CUS-001 (N:1 borrower); ← ENT-LON-002 (N:1 repays); ← ENT-FIN-003 (0..N:1 may_post_from) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 8 |
| **Primary ID** | loan_id |
| **Alternate IDs / Business Keys** | LON |
| **State Machine Ref** | Pending → (Verified) → Approved → Active → Completed | Defaulted/Written Off/Recovered/Restructured |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | LoanApproved / LoanDisbursed / LoanCompleted (Module 8) |
| **Owned APIs / Tables (logical)** | Contracts under Module 8; persistence: loans (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-LON-002 — LoanRepayment

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-LON-002 |
| **Canonical Name** | LoanRepayment |
| **Version** | 1.0.0 |
| **Domain** | Loans |
| **Purpose** | Posted loan repayment event (ledger-backed). |
| **Description** | Maps to platform concept(s): `loan_repayments`, `transactions`, `ledgerEntries`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 8; Modules 28/29/30 must not post. |
| **Owning Module** | Module 8 — Loans |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-LON-001 (N:1 repays) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 8 |
| **Primary ID** | repayment_id |
| **Alternate IDs / Business Keys** | loanId + repayment seq / receipt |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 8; persistence: loan_repayments, transactions, ledgerEntries (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-WDL-001 — WithdrawalRequest

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-WDL-001 |
| **Canonical Name** | WithdrawalRequest |
| **Version** | 1.0.0 |
| **Domain** | Savings/Susu |
| **Purpose** | Savings redemption / withdrawal request through approval and payout. |
| **Description** | Maps to platform concept(s): `withdrawalRequests`, `withdrawal_requests`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 9; Modules 28/29/30 must not post. |
| **Owning Module** | Module 9 — Withdrawals |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-FIN-003 |
| **Relationships** | → ENT-CUS-001 (N:1 requested_by); → ENT-SAV-002 (N:0..1 from_account); ← ENT-FIN-003 (0..N:1 may_post_from) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 9 |
| **Primary ID** | withdrawal_id |
| **Alternate IDs / Business Keys** | WDL |
| **State Machine Ref** | Requested → Verified → Approved → Paid → (Reversed) |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | WithdrawalRequested / Approved / Paid / Reversed (Module 9) |
| **Owned APIs / Tables (logical)** | Contracts under Module 9; persistence: withdrawalRequests, withdrawal_requests (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-FIN-001 — ChartOfAccount

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-FIN-001 |
| **Canonical Name** | ChartOfAccount |
| **Version** | 1.0.0 |
| **Domain** | Finance |
| **Purpose** | GL account master. |
| **Description** | Maps to platform concept(s): `chartOfAccounts`, `chart_of_accounts`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 10 — Accounting & GL |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-FIN-002 |
| **Relationships** | ← ENT-FIN-002 (M:N posts_to) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 10 |
| **Primary ID** | coa_id |
| **Alternate IDs / Business Keys** | account code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 10; persistence: chartOfAccounts, chart_of_accounts (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-FIN-002 — JournalEntry

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-FIN-002 |
| **Canonical Name** | JournalEntry |
| **Version** | 1.0.0 |
| **Domain** | Finance |
| **Purpose** | Accounting journal header with balanced lines. |
| **Description** | Maps to platform concept(s): `journalEntries`, `journal_lines`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 10; Modules 28/29/30 must not post. |
| **Owning Module** | Module 10 — Accounting & GL |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-FIN-003 |
| **Relationships** | ← ENT-FIN-003 (N:1 line_of); → ENT-FIN-001 (M:N posts_to) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 10 |
| **Primary ID** | journal_id |
| **Alternate IDs / Business Keys** | JRN / journal_number |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | JournalPosted (Module 10) |
| **Owned APIs / Tables (logical)** | Contracts under Module 10; persistence: journalEntries, journal_lines (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-FIN-003 — LedgerEntry

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-FIN-003 |
| **Canonical Name** | LedgerEntry |
| **Version** | 1.0.0 |
| **Domain** | Finance |
| **Purpose** | Authoritative double-entry ledger line (pesewas). |
| **Description** | Maps to platform concept(s): `ledgerEntries`, `ledger_entries`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 10; Modules 28/29/30 must not post. |
| **Owning Module** | Module 10 — Accounting & GL |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-FIN-002 (N:1 line_of); → ENT-SAV-003 (0..1:1 may_post_from); → ENT-LON-001 (0..N:1 may_post_from); → ENT-WDL-001 (0..N:1 may_post_from) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 10 |
| **Primary ID** | ledger_entry_id |
| **Alternate IDs / Business Keys** | journal + line / entry id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 10; persistence: ledgerEntries, ledger_entries (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-FIN-004 — CashClosing

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-FIN-004 |
| **Canonical Name** | CashClosing |
| **Version** | 1.0.0 |
| **Domain** | Finance |
| **Purpose** | Cashier/branch closing / cash session record. |
| **Description** | Maps to platform concept(s): `closings`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 10 — Accounting & GL |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-ORG-002 (N:1 branch_close) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 10 |
| **Primary ID** | closing_id |
| **Alternate IDs / Business Keys** | CSS / closing date + branch |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 10; persistence: closings (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-FIN-005 — LegacyTransaction

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-FIN-005 |
| **Canonical Name** | LegacyTransaction |
| **Version** | 1.0.0 |
| **Domain** | Finance |
| **Purpose** | Legacy GHS transaction rows used by some UI balance paths; not a second posting owner. |
| **Description** | Maps to platform concept(s): `transactions`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 10; Modules 28/29/30 must not post. |
| **Owning Module** | Module 10 — Accounting & GL |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 10 |
| **Primary ID** | transaction_id |
| **Alternate IDs / Business Keys** | ref / id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 10; persistence: transactions (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PAY-001 — PaymentTransaction

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PAY-001 |
| **Canonical Name** | PaymentTransaction |
| **Version** | 1.0.0 |
| **Domain** | Payments |
| **Purpose** | MoMo/provider payment lifecycle record; must not invent a second Susu collection post. |
| **Description** | Maps to platform concept(s): `paymentTransactions`, `paymentStatusHistory`. Pesewas money where financial. **Transactional money entity** — mutation owned exclusively by Module 16; Modules 28/29/30 must not post. |
| **Owning Module** | Module 16 — Payments / MoMo |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-PAY-002 |
| **Relationships** | → ENT-CUS-001 (N:0..1 for_customer); ← ENT-PAY-002 (1:1 external_ref) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 16 |
| **Primary ID** | payment_id |
| **Alternate IDs / Business Keys** | PAY / provider reference |
| **State Machine Ref** | payment-lifecycle.js stage machine (Module 16) |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Payment* lifecycle events (Module 16) |
| **Owned APIs / Tables (logical)** | Contracts under Module 16; persistence: paymentTransactions, paymentStatusHistory (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PAY-002 — ProviderReference

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PAY-002 |
| **Canonical Name** | ProviderReference |
| **Version** | 1.0.0 |
| **Domain** | Payments |
| **Purpose** | External MoMo/SMS provider correlation id (never rewritten). |
| **Description** | Maps to platform concept(s): `paymentTransactions.providerRef`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 16 — Payments / MoMo |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-PAY-001 (1:1 external_ref) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 16 |
| **Primary ID** | provider_reference |
| **Alternate IDs / Business Keys** | external system id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 16; persistence: paymentTransactions.providerRef (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-WFK-001 — WorkflowDefinition

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-WFK-001 |
| **Canonical Name** | WorkflowDefinition |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Reusable workflow template/code. |
| **Description** | Maps to platform concept(s): `workflowDefinitions`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 23 — Workflow |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-WFK-002 |
| **Relationships** | ← ENT-WFK-002 (N:1 instance_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 23 |
| **Primary ID** | workflow_id |
| **Alternate IDs / Business Keys** | WKF / workflow code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 23; persistence: workflowDefinitions (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-WFK-002 — WorkflowInstance

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-WFK-002 |
| **Canonical Name** | WorkflowInstance |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Running workflow case instance (does not mutate money directly). |
| **Description** | Maps to platform concept(s): `workflowInstances`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 23 — Workflow |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-WFK-003, ENT-WFK-004 |
| **Relationships** | → ENT-WFK-001 (N:1 instance_of); ← ENT-WFK-003 (N:1 task_of); ← ENT-WFK-004 (0..1:1 case_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 23 |
| **Primary ID** | workflow_instance_id |
| **Alternate IDs / Business Keys** | instance id |
| **State Machine Ref** | Started → Running → Suspended → Completed/Cancelled |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 23; persistence: workflowInstances (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-WFK-003 — WorkflowTask

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-WFK-003 |
| **Canonical Name** | WorkflowTask |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Human/system task within a workflow instance. |
| **Description** | Maps to platform concept(s): `workflowTasks`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 23 — Workflow |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-WFK-002 (N:1 task_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 23 |
| **Primary ID** | task_id |
| **Alternate IDs / Business Keys** | TSK |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 23; persistence: workflowTasks (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-WFK-004 — WorkflowCase

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-WFK-004 |
| **Canonical Name** | WorkflowCase |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Case management envelope for approvals/exceptions. |
| **Description** | Maps to platform concept(s): `workflowCases`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 23 — Workflow |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-WFK-002 (0..1:1 case_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 23 |
| **Primary ID** | case_id |
| **Alternate IDs / Business Keys** | CSE |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 23; persistence: workflowCases (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-DOC-001 — ReceiptDocument

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-DOC-001 |
| **Canonical Name** | ReceiptDocument |
| **Version** | 1.0.0 |
| **Domain** | Documents |
| **Purpose** | Printed/digital receipt or statement issued by Module 17. |
| **Description** | Maps to platform concept(s): `documentMetadata`, `receiptMappingHistory`, `receiptOutcomeHistory`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 17 — Receipts & Documents |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-DOC-002 |
| **Relationships** | → ENT-SAV-003 (0..1:1 receipt_for); → ENT-CUS-001 (N:1 issued_to); ← ENT-DOC-002 (0..N:1 indexes) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 17 |
| **Primary ID** | document_id |
| **Alternate IDs / Business Keys** | RCP / receipt_number |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 17; persistence: documentMetadata, receiptMappingHistory, receiptOutcomeHistory (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-DOC-002 — DigitalRecord

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-DOC-002 |
| **Canonical Name** | DigitalRecord |
| **Version** | 1.0.0 |
| **Domain** | Documents |
| **Purpose** | Records-management object (retention, classification) owned by Module 26. |
| **Description** | Maps to platform concept(s): `digitalRecords`, `recordMetadata`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 26 — Digital Records |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-DOC-001 (0..N:1 indexes) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 26 |
| **Primary ID** | record_id |
| **Alternate IDs / Business Keys** | record code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 26; persistence: digitalRecords, recordMetadata (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-NTF-001 — Notification

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-NTF-001 |
| **Canonical Name** | Notification |
| **Version** | 1.0.0 |
| **Domain** | Identity |
| **Purpose** | Outbound SMS/WhatsApp/email/in-app notification message. |
| **Description** | Maps to platform concept(s): `messages`, `notifications`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 12 — Notification |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-CUS-001 (N:0..1 to_customer) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 12 |
| **Primary ID** | notification_id |
| **Alternate IDs / Business Keys** | NTF |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | NotificationDelivered (Module 12) |
| **Owned APIs / Tables (logical)** | Contracts under Module 12; persistence: messages, notifications (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AUD-001 — AuditEvent

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AUD-001 |
| **Canonical Name** | AuditEvent |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Immutable compliance audit trail entry. |
| **Description** | Maps to platform concept(s): `audit`, `audit_log`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 13 — Audit |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-IDN-001 (N:0..1 actor) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 13 |
| **Primary ID** | audit_id |
| **Alternate IDs / Business Keys** | AUD |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | consumes catalog events (Module 13) |
| **Owned APIs / Tables (logical)** | Contracts under Module 13; persistence: audit, audit_log (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-CFG-001 — SystemSetting

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-CFG-001 |
| **Canonical Name** | SystemSetting |
| **Version** | 1.0.0 |
| **Domain** | Organization |
| **Purpose** | Runtime configuration (interest 15%, cashier GHS 1000, collectionDays 31, etc.). |
| **Description** | Maps to platform concept(s): `settings`, `system_settings`, `configDrafts`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 14 — System Admin & Config |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 14 |
| **Primary ID** | config_key |
| **Alternate IDs / Business Keys** | settings key / CFG version |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 14; persistence: settings, system_settings, configDrafts (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SYN-001 — OfflineQueueItem

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SYN-001 |
| **Canonical Name** | OfflineQueueItem |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Pending offline write until sync flush; not a second ledger. |
| **Description** | Maps to platform concept(s): `offlineQueue`, `sync_queue`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 15 — Offline Sync |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-IDN-003 (N:0..1 from_device) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 15 |
| **Primary ID** | sync_queue_id |
| **Alternate IDs / Business Keys** | queue item id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 15; persistence: offlineQueue, sync_queue (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SYN-002 — IdempotencyKey

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SYN-002 |
| **Canonical Name** | IdempotencyKey |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Client idempotency token for safe retries (collections, payments). |
| **Description** | Maps to platform concept(s): `idempotency_keys`, `idempotencyKeys`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 15 — Offline Sync |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 15 |
| **Primary ID** | idempotency_key |
| **Alternate IDs / Business Keys** | idempotency key string |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 15; persistence: idempotency_keys, idempotencyKeys (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-JOB-001 — JobDefinition

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-JOB-001 |
| **Canonical Name** | JobDefinition |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Background job type/definition registry. |
| **Description** | Maps to platform concept(s): `jobDefinitions`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 18 — Jobs |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-JOB-002 |
| **Relationships** | ← ENT-JOB-002 (N:1 of_type) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 18 |
| **Primary ID** | job_definition_id |
| **Alternate IDs / Business Keys** | job type code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 18; persistence: jobDefinitions (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-JOB-002 — JobInstance

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-JOB-002 |
| **Canonical Name** | JobInstance |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Queued/running/completed job execution. |
| **Description** | Maps to platform concept(s): `jobQueue`, `jobAttempts`, `jobSchedules`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 18 — Jobs |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-JOB-001 (N:1 of_type) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 18 |
| **Primary ID** | job_id |
| **Alternate IDs / Business Keys** | job instance id |
| **State Machine Ref** | Queued → Running → Succeeded/Failed/DeadLetter |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 18; persistence: jobQueue, jobAttempts, jobSchedules (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-MON-001 — OperationalAlert

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-MON-001 |
| **Canonical Name** | OperationalAlert |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Health/SLO alert raised by Module 19. |
| **Description** | Maps to platform concept(s): `monitorAlerts`, `alerts`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 19 — Monitoring |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 19 |
| **Primary ID** | alert_id |
| **Alternate IDs / Business Keys** | alert code + time |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 19; persistence: monitorAlerts, alerts (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-MON-002 — OperationalIncident

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-MON-002 |
| **Canonical Name** | OperationalIncident |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Ops incident record for diagnostics. |
| **Description** | Maps to platform concept(s): `monitorIncidents`, `incidents`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 19 — Monitoring |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 19 |
| **Primary ID** | incident_id |
| **Alternate IDs / Business Keys** | incident id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 19; persistence: monitorIncidents, incidents (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-GWY-001 — ApiClient

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-GWY-001 |
| **Canonical Name** | ApiClient |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | In-process gateway registered client (not an HTTP server process). |
| **Description** | Maps to platform concept(s): `apiClients`, `gatewayClients`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 20 — API Gateway |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-GWY-002, ENT-INT-001 |
| **Relationships** | ← ENT-GWY-002 (N:1 credential_of); ← ENT-INT-001 (N:0..1 extends_client) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 20 |
| **Primary ID** | api_client_id |
| **Alternate IDs / Business Keys** | client code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 20; persistence: apiClients, gatewayClients (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-GWY-002 — ApiKey

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-GWY-002 |
| **Canonical Name** | ApiKey |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Hashed API key credential for gateway clients. |
| **Description** | Maps to platform concept(s): `apiKeys`, `gatewayKeys`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 20 — API Gateway |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-GWY-001 (N:1 credential_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 20 |
| **Primary ID** | api_key_id |
| **Alternate IDs / Business Keys** | key id (hash stored) |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 20; persistence: apiKeys, gatewayKeys (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-BKP-001 — BackupSet

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-BKP-001 |
| **Canonical Name** | BackupSet |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Backup/restore set metadata (Module 21). |
| **Description** | Maps to platform concept(s): `backupSets`, `restoreJobs`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 21 — Backup/DR |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 21 |
| **Primary ID** | backup_set_id |
| **Alternate IDs / Business Keys** | backup set id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 21; persistence: backupSets, restoreJobs (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SEC-001 — SecurityIncident

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SEC-001 |
| **Canonical Name** | SecurityIncident |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Security operations incident (distinct from AI fraud alerts). |
| **Description** | Maps to platform concept(s): `securityIncidents`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 22 — Security Ops |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 22 |
| **Primary ID** | security_incident_id |
| **Alternate IDs / Business Keys** | incident id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 22; persistence: securityIncidents (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-SEC-002 — FraudCase

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-SEC-002 |
| **Canonical Name** | FraudCase |
| **Version** | 1.0.0 |
| **Domain** | Monitoring |
| **Purpose** | Security-ops fraud case under Module 22 investigation. |
| **Description** | Maps to platform concept(s): `fraudCases`, `securityFraudCases`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 22 — Security Ops |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-AI-004 |
| **Relationships** | ← ENT-AI-004 (0..1:0..1 may_escalate_to) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 22 |
| **Primary ID** | fraud_case_id |
| **Alternate IDs / Business Keys** | fraud case id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 22; persistence: fraudCases, securityFraudCases (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-RUL-001 — BusinessRule

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-RUL-001 |
| **Canonical Name** | BusinessRule |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Deterministic rule / decision table (Module 24 authority). |
| **Description** | Maps to platform concept(s): `ruleDefinitions`, `decisionTables`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 24 — Rule Engine |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-RUL-002 |
| **Relationships** | ← ENT-RUL-002 (N:1 evaluates) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 24 |
| **Primary ID** | rule_id |
| **Alternate IDs / Business Keys** | rule code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 24; persistence: ruleDefinitions, decisionTables (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-RUL-002 — RuleDecision

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-RUL-002 |
| **Canonical Name** | RuleDecision |
| **Version** | 1.0.0 |
| **Domain** | Workflow |
| **Purpose** | Side-effect-free evaluation result snapshot. |
| **Description** | Maps to platform concept(s): `ruleDecisions`, `decisionResults`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 24 — Rule Engine |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-RUL-001 (N:1 evaluates) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 24 |
| **Primary ID** | decision_id |
| **Alternate IDs / Business Keys** | ruleId + evaluation id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 24; persistence: ruleDecisions, decisionResults (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-XCH-001 — ExchangeDataset

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-XCH-001 |
| **Canonical Name** | ExchangeDataset |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Import/export dataset batch metadata (no financial apply). |
| **Description** | Maps to platform concept(s): `exchangeDatasets`, `exchangeBatches`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 25 — Data Exchange |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | — |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 25 |
| **Primary ID** | import_batch |
| **Alternate IDs / Business Keys** | batch id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 25; persistence: exchangeDatasets, exchangeBatches (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-BI-001 — MetricDefinition

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-BI-001 |
| **Canonical Name** | MetricDefinition |
| **Version** | 1.0.0 |
| **Domain** | Reporting/BI |
| **Purpose** | Enterprise metric schema definition (reference; no posting). |
| **Description** | Maps to platform concept(s): `metricDefinitions`, `metricDefinitionHistory`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 27 — Enterprise BI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-BI-002 |
| **Relationships** | ← ENT-BI-002 (M:N composed_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 27 |
| **Primary ID** | metric_id |
| **Alternate IDs / Business Keys** | metricCode |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 27; persistence: metricDefinitions, metricDefinitionHistory (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-BI-002 — KpiDefinition

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-BI-002 |
| **Canonical Name** | KpiDefinition |
| **Version** | 1.0.0 |
| **Domain** | Reporting/BI |
| **Purpose** | KPI registry entry composed from metrics. |
| **Description** | Maps to platform concept(s): `kpiDefinitions`, `biKpis`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 27 — Enterprise BI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-BI-001 (M:N composed_of) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 27 |
| **Primary ID** | kpi_id |
| **Alternate IDs / Business Keys** | kpi code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 27; persistence: kpiDefinitions, biKpis (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-INT-001 — IntegrationProvider

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-INT-001 |
| **Canonical Name** | IntegrationProvider |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Partner/provider registry in Integration Hub (extends gateway; no posting). |
| **Description** | Maps to platform concept(s): `integrationProviders`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 28 — Integration Hub |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-INT-002, ENT-INT-003 |
| **Relationships** | ← ENT-INT-002 (N:1 for_provider); ← ENT-INT-003 (N:1 routed_via); → ENT-GWY-001 (N:0..1 extends_client) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 28 |
| **Primary ID** | integration_provider_id |
| **Alternate IDs / Business Keys** | provider code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 28; persistence: integrationProviders (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-INT-002 — IntegrationWebhook

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-INT-002 |
| **Canonical Name** | IntegrationWebhook |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Partner webhook subscription/delivery metadata. |
| **Description** | Maps to platform concept(s): `integrationWebhooks`, `integrationDeliverables`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 28 — Integration Hub |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-INT-001 (N:1 for_provider) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 28 |
| **Primary ID** | webhook_id |
| **Alternate IDs / Business Keys** | webhook id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 28; persistence: integrationWebhooks, integrationDeliverables (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-INT-003 — IntegrationMessage

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-INT-003 |
| **Canonical Name** | IntegrationMessage |
| **Version** | 1.0.0 |
| **Domain** | Integration |
| **Purpose** | Hub message queue item / subscription delivery. |
| **Description** | Maps to platform concept(s): `messageQueues`, `messageHistory`, `messageSubscriptions`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 28 — Integration Hub |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-INT-001 (N:1 routed_via) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 28 |
| **Primary ID** | message_id |
| **Alternate IDs / Business Keys** | message id + idempotency |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 28; persistence: messageQueues, messageHistory, messageSubscriptions (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AI-001 — AiModel

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AI-001 |
| **Canonical Name** | AiModel |
| **Version** | 1.0.0 |
| **Domain** | AI |
| **Purpose** | Advisory ML model registry entry (never owns money mutation). |
| **Description** | Maps to platform concept(s): `aiModels`, `aiModelVersions`, `aiModelDeployments`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 29 — AI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-AI-003 |
| **Relationships** | ← ENT-AI-003 (N:1 produced_by) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 29 |
| **Primary ID** | ai_model_id |
| **Alternate IDs / Business Keys** | model code / family |
| **State Machine Ref** | Draft → Approved → Deployed → Retired |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 29; persistence: aiModels, aiModelVersions, aiModelDeployments (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AI-002 — AiDataset

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AI-002 |
| **Canonical Name** | AiDataset |
| **Version** | 1.0.0 |
| **Domain** | AI |
| **Purpose** | Training/inference dataset metadata with classification. |
| **Description** | Maps to platform concept(s): `aiDatasets`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 29 — AI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-AI-003 |
| **Relationships** | ← ENT-AI-003 (N:0..1 uses_dataset) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 29 |
| **Primary ID** | ai_dataset_id |
| **Alternate IDs / Business Keys** | dataset code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 29; persistence: aiDatasets (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AI-003 — AiPrediction

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AI-003 |
| **Canonical Name** | AiPrediction |
| **Version** | 1.0.0 |
| **Domain** | AI |
| **Purpose** | Advisory prediction/forecast result. |
| **Description** | Maps to platform concept(s): `aiPredictionRequests`, `aiPredictionResults`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 29 — AI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-AI-004, ENT-AI-005 |
| **Relationships** | → ENT-AI-001 (N:1 produced_by); → ENT-AI-002 (N:0..1 uses_dataset); ← ENT-AI-004 (0..1:1 from_prediction); ← ENT-AI-005 (N:0..1 from_prediction) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 29 |
| **Primary ID** | ai_prediction_id |
| **Alternate IDs / Business Keys** | prediction request/result id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | AiPredictionProduced (advisory) |
| **Owned APIs / Tables (logical)** | Contracts under Module 29; persistence: aiPredictionRequests, aiPredictionResults (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AI-004 — AiFraudAlert

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AI-004 |
| **Canonical Name** | AiFraudAlert |
| **Version** | 1.0.0 |
| **Domain** | AI |
| **Purpose** | Advisory fraud heuristic alert (distinct from Module 22 FraudCase). |
| **Description** | Maps to platform concept(s): `aiFraudAlerts`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 29 — AI |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-AI-003 (0..1:1 from_prediction); → ENT-SEC-002 (0..1:0..1 may_escalate_to) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 29 |
| **Primary ID** | ai_fraud_alert_id |
| **Alternate IDs / Business Keys** | alert id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Restricted |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | FraudAlertCreated (advisory; distinct from Module 22) |
| **Owned APIs / Tables (logical)** | Contracts under Module 29; persistence: aiFraudAlerts (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-AI-005 — AiRecommendation

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-AI-005 |
| **Canonical Name** | AiRecommendation |
| **Version** | 1.0.0 |
| **Domain** | AI |
| **Purpose** | Human-reviewed advisory recommendation history. |
| **Description** | Maps to platform concept(s): `aiRecommendationHistory`, `aiHumanFeedback`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 29 — AI |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-AI-003 (N:0..1 from_prediction) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 29 |
| **Primary ID** | ai_recommendation_id |
| **Alternate IDs / Business Keys** | recommendation id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 29; persistence: aiRecommendationHistory, aiHumanFeedback (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-001 — Tenant

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-001 |
| **Canonical Name** | Tenant |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Platform tenant registration (Module 30); does not post Susu money. |
| **Description** | Maps to platform concept(s): `platformTenants`, `platformTenantConfigurations`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-PLT-002, ENT-PLT-004 |
| **Relationships** | ← ENT-PLT-002 (N:1 assigned_to); ← ENT-PLT-004 (N:0..1 tenant_scoped); → ENT-ORG-001 (0..1:1 may_map_org) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | tenant_id |
| **Alternate IDs / Business Keys** | tenant code |
| **State Machine Ref** | Registered → Active → Suspended → Decommissioned |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | TenantRegistered / TenantTransitioned |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformTenants, platformTenantConfigurations (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-002 — License

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-002 |
| **Canonical Name** | License |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Platform license and assignment. |
| **Description** | Maps to platform concept(s): `platformLicenses`, `platformLicenseAssignments`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-PLT-001 (N:1 assigned_to) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | license_id |
| **Alternate IDs / Business Keys** | license code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Confidential |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformLicenses, platformLicenseAssignments (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-003 — PlatformEnvironment

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-003 |
| **Canonical Name** | PlatformEnvironment |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Deployed environment registry (dev/stage/prod metadata). |
| **Description** | Maps to platform concept(s): `platformEnvironmentRegistry`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): ENT-PLT-005, ENT-PLT-006 |
| **Relationships** | ← ENT-PLT-005 (N:1 in_environment); ← ENT-PLT-006 (N:1 targets_env) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | environment_id |
| **Alternate IDs / Business Keys** | environment code |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformEnvironmentRegistry (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-004 — FeatureFlagRule

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-004 |
| **Canonical Name** | FeatureFlagRule |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Platform feature-flag evaluation rule (RACI with Module 14 base flags). |
| **Description** | Maps to platform concept(s): `platformFeatureFlagRules`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | No |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-PLT-001 (N:0..1 tenant_scoped) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | feature_flag_rule_id |
| **Alternate IDs / Business Keys** | flagId + rule id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformFeatureFlagRules (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-005 — MaintenanceWindow

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-005 |
| **Canonical Name** | MaintenanceWindow |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Scheduled maintenance / read-only window. |
| **Description** | Maps to platform concept(s): `platformMaintenanceWindows`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-PLT-003 (N:1 in_environment) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | maintenance_window_id |
| **Alternate IDs / Business Keys** | window id |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformMaintenanceWindows (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |

### ENT-PLT-006 — DeploymentRecord

| Field | Value |
|-------|-------|
| **Entity ID** | ENT-PLT-006 |
| **Canonical Name** | DeploymentRecord |
| **Version** | 1.0.0 |
| **Domain** | Platform/Tenant |
| **Purpose** | Platform deploy plan/approve/execute/rollback metadata. |
| **Description** | Maps to platform concept(s): `platformDeploymentHistory`, `platformDeploymentApprovals`. Pesewas money where financial. Non-posting or supporting entity. |
| **Owning Module** | Module 30 — Platform Admin |
| **Aggregate Root** | Yes |
| **Parent / Children** | Related children (incoming): — |
| **Relationships** | → ENT-PLT-003 (N:1 targets_env) |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module 30 |
| **Primary ID** | deployment_id |
| **Alternate IDs / Business Keys** | deployment id + version |
| **State Machine Ref** | Active/Inactive or module lifecycle docs |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | Internal |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | Module-owned domain events via publishDomainEvent |
| **Owned APIs / Tables (logical)** | Contracts under Module 30; persistence: platformDeploymentHistory, platformDeploymentApprovals (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |


---

## 5. Entity relationships

### 5.1 Cardinality legend

| Notation | Meaning |
|----------|---------|
| 1:1 | Exactly one each side |
| 1:N / N:1 | One-to-many |
| M:N | Many-to-many (via join or role_permissions style) |
| 0..1 | Optional |

### 5.2 Aggregates (roots)

Aggregate roots (46): `ENT-ORG-001` Organization; `ENT-ORG-002` Branch; `ENT-ORG-003` Agent; `ENT-ORG-004` Role; `ENT-IDN-001` User; `ENT-CUS-001` Customer; `ENT-SAV-001` SavingsProduct; `ENT-SAV-002` SavingsAccount; `ENT-SAV-003` Collection; `ENT-GRP-001` SusuGroup; `ENT-LON-001` Loan; `ENT-WDL-001` WithdrawalRequest; `ENT-FIN-001` ChartOfAccount; `ENT-FIN-002` JournalEntry; `ENT-FIN-004` CashClosing; `ENT-PAY-001` PaymentTransaction; `ENT-WFK-001` WorkflowDefinition; `ENT-WFK-002` WorkflowInstance; `ENT-WFK-004` WorkflowCase; `ENT-DOC-001` ReceiptDocument; `ENT-DOC-002` DigitalRecord; `ENT-NTF-001` Notification; `ENT-AUD-001` AuditEvent; `ENT-CFG-001` SystemSetting; `ENT-JOB-001` JobDefinition; `ENT-JOB-002` JobInstance; `ENT-MON-001` OperationalAlert; `ENT-MON-002` OperationalIncident; `ENT-GWY-001` ApiClient; `ENT-BKP-001` BackupSet; `ENT-SEC-001` SecurityIncident; `ENT-SEC-002` FraudCase; `ENT-RUL-001` BusinessRule; `ENT-XCH-001` ExchangeDataset; `ENT-BI-001` MetricDefinition; `ENT-BI-002` KpiDefinition; `ENT-INT-001` IntegrationProvider; `ENT-AI-001` AiModel; `ENT-AI-002` AiDataset; `ENT-AI-003` AiPrediction; `ENT-AI-004` AiFraudAlert; `ENT-PLT-001` Tenant; `ENT-PLT-002` License; `ENT-PLT-003` PlatformEnvironment; `ENT-PLT-005` MaintenanceWindow; `ENT-PLT-006` DeploymentRecord.

Children update/delete only through the owning module of the root (or explicit child owner when the child is itself a root). **Cascade delete of posted money is forbidden** — use reversal / tombstone patterns already in the app.

### 5.3 Relationship list

| From | To | Cardinality | Kind |
|------|----|-------------|------|
| ENT-ORG-002 | ENT-ORG-001 | N:1 | belongs_to |
| ENT-ORG-003 | ENT-ORG-002 | N:1 | assigned_to |
| ENT-ORG-003 | ENT-IDN-001 | 0..1:1 | may_link_user |
| ENT-ORG-005 | ENT-ORG-004 | M:N | granted_via |
| ENT-IDN-001 | ENT-ORG-004 | N:1 | has_role |
| ENT-IDN-001 | ENT-ORG-002 | N:1 | scoped_to |
| ENT-IDN-002 | ENT-IDN-001 | N:1 | belongs_to |
| ENT-IDN-002 | ENT-IDN-003 | N:1 | on_device |
| ENT-CUS-001 | ENT-ORG-002 | N:1 | belongs_to |
| ENT-CUS-002 | ENT-CUS-001 | N:1 | nominee_of |
| ENT-SAV-002 | ENT-CUS-001 | N:1 | owned_by |
| ENT-SAV-002 | ENT-SAV-001 | N:1 | product |
| ENT-SAV-003 | ENT-CUS-001 | N:1 | for_customer |
| ENT-SAV-003 | ENT-SAV-002 | N:0..1 | credits_account |
| ENT-SAV-003 | ENT-ORG-003 | N:0..1 | collected_by |
| ENT-SAV-003 | ENT-ORG-002 | N:1 | at_branch |
| ENT-SAV-004 | ENT-SAV-003 | N:1 | adjusts |
| ENT-SAV-005 | ENT-CUS-001 | N:1 | for_customer |
| ENT-GRP-002 | ENT-GRP-001 | N:1 | member_of |
| ENT-GRP-002 | ENT-CUS-001 | N:1 | customer |
| ENT-GRP-003 | ENT-GRP-001 | N:1 | of_group |
| ENT-CUS-001 | ENT-GRP-001 | N:0..1 | optional_group |
| ENT-LON-001 | ENT-CUS-001 | N:1 | borrower |
| ENT-LON-002 | ENT-LON-001 | N:1 | repays |
| ENT-WDL-001 | ENT-CUS-001 | N:1 | requested_by |
| ENT-WDL-001 | ENT-SAV-002 | N:0..1 | from_account |
| ENT-FIN-003 | ENT-FIN-002 | N:1 | line_of |
| ENT-FIN-002 | ENT-FIN-001 | M:N | posts_to |
| ENT-FIN-003 | ENT-SAV-003 | 0..1:1 | may_post_from |
| ENT-FIN-003 | ENT-LON-001 | 0..N:1 | may_post_from |
| ENT-FIN-003 | ENT-WDL-001 | 0..N:1 | may_post_from |
| ENT-FIN-004 | ENT-ORG-002 | N:1 | branch_close |
| ENT-PAY-001 | ENT-CUS-001 | N:0..1 | for_customer |
| ENT-PAY-002 | ENT-PAY-001 | 1:1 | external_ref |
| ENT-WFK-002 | ENT-WFK-001 | N:1 | instance_of |
| ENT-WFK-003 | ENT-WFK-002 | N:1 | task_of |
| ENT-WFK-004 | ENT-WFK-002 | 0..1:1 | case_of |
| ENT-DOC-001 | ENT-SAV-003 | 0..1:1 | receipt_for |
| ENT-DOC-001 | ENT-CUS-001 | N:1 | issued_to |
| ENT-DOC-002 | ENT-DOC-001 | 0..N:1 | indexes |
| ENT-NTF-001 | ENT-CUS-001 | N:0..1 | to_customer |
| ENT-AUD-001 | ENT-IDN-001 | N:0..1 | actor |
| ENT-SYN-001 | ENT-IDN-003 | N:0..1 | from_device |
| ENT-JOB-002 | ENT-JOB-001 | N:1 | of_type |
| ENT-GWY-002 | ENT-GWY-001 | N:1 | credential_of |
| ENT-RUL-002 | ENT-RUL-001 | N:1 | evaluates |
| ENT-BI-002 | ENT-BI-001 | M:N | composed_of |
| ENT-INT-002 | ENT-INT-001 | N:1 | for_provider |
| ENT-INT-003 | ENT-INT-001 | N:1 | routed_via |
| ENT-INT-001 | ENT-GWY-001 | N:0..1 | extends_client |
| ENT-AI-003 | ENT-AI-001 | N:1 | produced_by |
| ENT-AI-003 | ENT-AI-002 | N:0..1 | uses_dataset |
| ENT-AI-004 | ENT-AI-003 | 0..1:1 | from_prediction |
| ENT-AI-005 | ENT-AI-003 | N:0..1 | from_prediction |
| ENT-AI-004 | ENT-SEC-002 | 0..1:0..1 | may_escalate_to |
| ENT-PLT-002 | ENT-PLT-001 | N:1 | assigned_to |
| ENT-PLT-004 | ENT-PLT-001 | N:0..1 | tenant_scoped |
| ENT-PLT-005 | ENT-PLT-003 | N:1 | in_environment |
| ENT-PLT-006 | ENT-PLT-003 | N:1 | targets_env |
| ENT-PLT-001 | ENT-ORG-001 | 0..1:1 | may_map_org |

---

## 6. Identifier standards

Aligned with [`identifiers.md`](./identifiers.md) and `src/core/identifiers.js` — ECDM does **not** invent a second scheme.

| Kind | Rule |
|------|------|
| Technical ID | UUID v7 preferred; legacy `prefix-…` (`cus-`, `col-`, `u-owner`) remain valid |
| Business ID | Prefix catalog (CUS, COL, LON, WDL, RCP, …) |
| Correlation ID | Workflow groups a process; does not replace entity ids |
| Idempotency key | Client-delegated; required for collections |
| External reference | MoMo/SMS ids stored separately, never rewritten |
| Money | Integer pesewas in core; never dual float balances |

Primary ID types in the registry (`primaryIdType`) map to `IDENTIFIER_OWNERS` / `BUSINESS_PREFIXES` where applicable.

---

## 7. Data governance

### 7.1 Classification classes

| Class | Handling | Entity assignments |
|-------|----------|-------------------|
| **Public** | May appear in non-auth marketing surfaces | (none in v1.0.0 — Susu ops data is at least Internal) |
| **Internal** | Authenticated staff | ENT-ORG-001, ENT-ORG-002, ENT-ORG-004, ENT-ORG-005, ENT-IDN-003, ENT-SAV-001, ENT-SAV-005, ENT-GRP-001, ENT-GRP-003, ENT-FIN-001, ENT-WFK-001, ENT-WFK-002, ENT-WFK-003, ENT-CFG-001, ENT-SYN-002, ENT-JOB-001, ENT-JOB-002, ENT-MON-001, ENT-RUL-001, ENT-RUL-002, ENT-BI-001, ENT-BI-002, ENT-AI-001, ENT-AI-005, ENT-PLT-003, ENT-PLT-004, ENT-PLT-005, ENT-PLT-006 |
| **Confidential** | Need-to-know / PII | ENT-ORG-003, ENT-IDN-001, ENT-IDN-002, ENT-CUS-001, ENT-CUS-002, ENT-SAV-002, ENT-GRP-002, ENT-FIN-004, ENT-PAY-002, ENT-WFK-004, ENT-DOC-001, ENT-DOC-002, ENT-NTF-001, ENT-SYN-001, ENT-MON-002, ENT-GWY-001, ENT-XCH-001, ENT-INT-001, ENT-INT-002, ENT-INT-003, ENT-AI-002, ENT-AI-003, ENT-PLT-001, ENT-PLT-002 |
| **Restricted** | Financial / security / AI restricted datasets | ENT-SAV-003, ENT-SAV-004, ENT-LON-001, ENT-LON-002, ENT-WDL-001, ENT-FIN-002, ENT-FIN-003, ENT-FIN-005, ENT-PAY-001, ENT-AUD-001, ENT-GWY-002, ENT-BKP-001, ENT-SEC-001, ENT-SEC-002, ENT-AI-004 |

Allowed classification vocabulary: Public, Internal, Confidential, Restricted.

### 7.2 Retention

- Posted money entities: retain; reverse rather than delete; tombstones via `deletedRecords` where used.
- Audit: append-only.
- AI Restricted datasets: masking; UI requires `Ai.Govern` / `Ai.Admin` / SystemOwner (Module 29 docs).
- Platform tenant deletion: retention policy rows in Module 30.

---

## 8. Versioning policy

| Change type | Version bump | Process |
|-------------|--------------|---------|
| Editorial / clarification | PATCH | Doc + registry comment |
| New optional attribute / relationship | MINOR | Update ECDM + catalogs + registry + tests |
| Rename, owner change, split/merge entity | MAJOR | ADR + Architecture Review Workflow; Phase 2 Change Governance |
| Money owner change | **Forbidden** without ADR + contract tests | Must preserve Modules 6–10 / 16 posting exclusivity |

Entity field `version` starts at `1.0.0` for all catalog rows.

---

## 9. Cross-module usage

| Usage | Modules | Rule |
|-------|---------|------|
| **Own / mutate** | Owning module only | Exclusive write |
| **Read (ops)** | Dependents in `MODULE_CONSUME` / Phase 2 register | Via contracts/queries |
| **Report** | 11, 27 | Query aggregates; do not recalculate foreign balances as SoT |
| **AI** | 29 | Advisory read of features/predictions; **no** posting |
| **Integration** | 28 (extends 20) | Partner dispatch/transform; **no** Susu collection post |
| **Platform** | 30 | Tenants/flags/licenses/envs; **no** domain posting |
| **Exchange / Records** | 25 / 26 | Bulk metadata / retention; no unapproved financial apply |

Money codes: `ENT-SAV-002`, `ENT-SAV-003`, `ENT-SAV-004`, `ENT-GRP-003`, `ENT-LON-001`, `ENT-LON-002`, `ENT-WDL-001`, `ENT-FIN-002`, `ENT-FIN-003`, `ENT-FIN-005`, `ENT-PAY-001`.

---

## 10. Traceability

| Artifact | Role |
|----------|------|
| EMAS | Architecture organization for Modules 1–30 |
| Phase 2 registers | Data ownership / conflicts baseline |
| Module docs under `docs/*.md` | Detailed behavior (unchanged by ECDM) |
| `src/core/*` | Live engines & state keys |
| `canonical-domain-registry.js` | Machine-readable ECDM |
| `tests/ecdm-consistency.test.js` | Invariants |

---

*End of ECDM v1.0.0*
