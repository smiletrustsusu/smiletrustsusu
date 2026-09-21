# Enterprise Canonical Event Catalog & Messaging Specification (ECECMS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 5 — Authoritative Event / Messaging Catalog  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Machine registry:** `src/core/canonical-event-registry.js`  
**Companion matrices:** [`ececms-catalogs.md`](./ececms-catalogs.md)

Cross-references: Phase 1 [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) / [`emas-matrices.md`](./emas-matrices.md); Phase 2 [`enterprise-consistency-review.md`](./enterprise-consistency-review.md) / [`phase2-registers.md`](./phase2-registers.md) / [`enterprise-architecture-review-workflow.md`](./enterprise-architecture-review-workflow.md) / [`enterprise-governance-validation.md`](./enterprise-governance-validation.md); Phase 3 [`enterprise-canonical-domain-model.md`](./enterprise-canonical-domain-model.md) / [`ecdm-catalogs.md`](./ecdm-catalogs.md) / `src/core/canonical-domain-registry.js`; Phase 4 [`enterprise-canonical-state-machines.md`](./enterprise-canonical-state-machines.md) / [`ecsmls-catalogs.md`](./ecsmls-catalogs.md) / `src/core/canonical-state-machine-registry.js`.

This document is the **single authoritative definition of curated domain events** across **Modules 1–30**. Events are **in-process** via `publishDomainEvent` / `state.domainEvents` — **NOT** a live message bus HTTP server. Module **20** is in-process.

---

## 1. Authoritative status & design principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECECMS-P01 | Single catalog | One curated `EVT-*` id per published domain event name |
| ECECMS-P02 | ECDM / ECSMLS binding | Events MAY reference `ENT-*` and `SM-*`; orphans fail validation |
| ECECMS-P03 | Owner exclusivity | Producing module owns the event; consumers subscribe by identifier only |
| ECECMS-P04 | In-process channel | `publishDomainEvent` / `state.domainEvents` — not a networked broker |
| ECECMS-P05 | Module 20 fence | Module **20** remains in-process; no HTTP event ingress |
| ECECMS-P06 | Module 28 routing | Integration Hub may route integration-class events; not money SoR |
| ECECMS-P07 | No money math | Never changes posting, pesewas math, or ledger formulas |
| ECECMS-P08 | No RBAC rewrite | Permissions by identifier only |
| ECECMS-P09 | Delivery honesty | Default **at-least-once**; exactly-once not claimed for SPA channel |
| ECECMS-P10 | Versioning | semver; breaking changes need ADR |

**Project reality (normative):** vanilla JS SPA; Module **20** in-process; integer **pesewas**; Module **29** AI advisory; Module **24** Rule Engine deterministic; Module **30** Platform Admin.

---

## 2. IMPLEMENTATION BOUNDARY

| In scope | Out of scope |
|----------|--------------|
| Curated canonical event catalog (~79 events) | Live Kafka/Rabbit/HTTP event bus |
| Ownership, producers, consumers, topics, delivery | Redefining entities or state machines |
| Links to ECDM / ECSMLS / contracts | Changing money math / RBAC / posting |
| Message contract templates & governance | New business features or navigation |
| Docs + registry + consistency tests | Overriding Phases 1–4 without ADR |

**MUST reference:** Phase 3 entities; Phase 4 machines; `module-contracts` event names; Modules 1–30.

**MUST NOT:** invent a networked event broker; grant Modules 28/29 money mutation authority; redefine APIs (Phase 6) inside ECECMS.

---

## 3. Phase Input & Dependency Rules Specification

### 3.1 Required inputs (consume only)

| Input | Artifact |
|-------|----------|
| Phase 1 EMAS | `docs/enterprise-master-architecture.md`, `docs/emas-matrices.md` |
| Phase 2 consistency / governance | `docs/enterprise-consistency-review.md`, `docs/phase2-registers.md`, `docs/enterprise-architecture-review-workflow.md`, `docs/enterprise-governance-validation.md` |
| Phase 3 ECDM | `docs/enterprise-canonical-domain-model.md`, `docs/ecdm-catalogs.md`, `src/core/canonical-domain-registry.js` |
| Phase 4 ECSMLS | `docs/enterprise-canonical-state-machines.md`, `docs/ecsmls-catalogs.md`, `src/core/canonical-state-machine-registry.js` |
| Modules 1–30 | Event emitters / `module-contracts.js` kind=`event` |
| Approved global standards | Naming, classification, audit conventions from Phases 1–4 |

### 3.2 Precedence (conflicts)

1. **ADRs / explicit exceptions** (highest)  
2. **EMAS** (Phase 1)  
3. **Phase 2** consistency & governance registers  
4. **ECDM** (Phase 3)  
5. **ECSMLS** (Phase 4)  
6. **Module specs** (Modules 1–30)  
7. **Global standards** (lowest)

**Unresolved conflicts MUST be escalated** via the Architecture Review Workflow. Do **not** resolve implicitly inside ECECMS.

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | Curate events that exist as `CONTRACT_CATALOG` kind=`event` |
| D2 | `entityId` / `stateMachineId` MUST resolve when present |
| D3 | Producers MUST include owning module |
| D4 | Module 28 may route Integration events; 28/29 MUST NOT own money posting |
| D5 | Module 20 remains in-process; no HTTP event server |
| D6 | Phase 6 APIs MAY emit events by identifier only |

### 3.4 Output constraints

| Deliverable | Constraint |
|-------------|------------|
| `docs/enterprise-canonical-event-catalog.md` | Primary ECECMS |
| `docs/ececms-catalogs.md` | Companion matrices only |
| `src/core/canonical-event-registry.js` | Machine-readable catalog |
| `tests/ececms-consistency.test.js` | Invariants |

Outputs MUST NOT redefine APIs, DB schemas, RBAC matrices, or posting formulas.

### 3.5 Prohibited activities

- Create a live message-bus HTTP server or broker  
- Invent events not backed by contracts / documented emitters  
- Change ECDM entities or ECSMLS transitions  
- Modify money math, RBAC forbidden lists, or posting  
- Introduce new business functionality or navigation  
- Override Phases 1–4 without ADR notes  

### 3.6 Traceability requirements

Every event MUST record: id, name, type, owningModule, producers, consumers, deliveryGuarantee, version, topic, classification, payload/metadata schema refs, optional entityId / stateMachineId / triggerTransition.

### 3.7 Validation requirements

| Check | Enforcement |
|-------|-------------|
| Unique `EVT-*` ids and names | `validateEventRegistry()` + tests |
| Count in curated band (40–80) | tests |
| ECDM / ECSMLS refs resolve | registry validator |
| Contract catalog alignment | registry validator |
| Docs include Input & Dependency Rules | tests |

---

## 4. Catalog summary

| Metric | Count |
|--------|-------|
| Curated canonical events | **79** |
| CONTRACT_CATALOG events (full) | 114 |
| Channel | `in-process.domainEvents` |
| Default delivery | at-least-once |
| Registry validation | `validateEventRegistry()` |

Companion compact tables: [`ececms-catalogs.md`](./ececms-catalogs.md).

---

## 5. Event template fields (normative)

| Field | Meaning |
|-------|---------|
| id / name / version | `EVT-*`, contract event name, semver |
| type | Domain / Integration / Operational / Security / Audit / Platform |
| owningModule / producers / consumers | Module ids |
| entityId / stateMachineId / triggerTransition | Optional ECDM / ECSMLS links |
| deliveryGuarantee | at-most-once / at-least-once / exactly-once |
| topic / channel | Logical topic; channel always in-process for v1 |
| classification | Public / Internal / Confidential / Restricted |
| payloadSchemaRef / metadataSchemaRef | Schema identifiers |
| lifecycle | draft / active / deprecated / retired |

### Standard message contract (envelope)

Align with `api-schema.standardEvent` metadata and `domainEvents.payload` body: eventId, name, version, occurredAt, correlationId, producerModule, actorId, payload, classification.

### Delivery guarantees

| Guarantee | ECECMS meaning (in-process) |
|-----------|------------------------------|
| at-most-once | Best-effort append |
| at-least-once | Default — consumers MUST be idempotent |
| exactly-once | **Not claimed** for SPA channel unless module documents ledger idempotency |

### Routing (Module 28)

Integration Hub may subscribe to Integration-class topics. It **MUST NOT** become SoR for Susu money events.

### Security / Versioning / Lifecycle / Governance

Restricted financial/security payloads minimize fields and require Module 13 audit. Additive fields → MINOR; breaking → MAJOR + ADR. Lifecycle: draft → active → deprecated → retired. Additions need owning steward + architecture review when cross-module consumers expand.

---

## 6. Event catalog by domain

### Identity / Security Auth (IDN)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-IDN-001 | UserAuthenticated | Security | 1 | ENT-IDN-001 | SM-IDN-001 | identity.user.authenticated | at-least-once | Confidential |
| EVT-IDN-002 | PasswordChanged | Security | 1 | ENT-IDN-001 | — | identity.user.password_changed | at-least-once | Restricted |
| EVT-IDN-003 | DeviceRegistered | Security | 1 | ENT-IDN-003 | — | identity.device.registered | at-least-once | Confidential |

### Customer (CUS)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-CUS-001 | CustomerCreated | Domain | 3 | ENT-CUS-001 | SM-CUS-001 | customer.created | at-least-once | Confidential |
| EVT-CUS-002 | CustomerUpdated | Domain | 3 | ENT-CUS-001 | SM-CUS-001 | customer.updated | at-least-once | Confidential |
| EVT-CUS-003 | CustomerSuspended | Domain | 3 | ENT-CUS-001 | SM-CUS-001 | customer.suspended | at-least-once | Confidential |
| EVT-CUS-004 | CustomerClosed | Domain | 3 | ENT-CUS-001 | SM-CUS-001 | customer.closed | at-least-once | Confidential |

### Organization / Agent / Branch (ORG)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-ORG-001 | AgentCreated | Domain | 4 | ENT-ORG-003 | — | agent.created | at-least-once | Confidential |
| EVT-ORG-002 | AgentSuspended | Domain | 4 | ENT-ORG-003 | — | agent.suspended | at-least-once | Confidential |
| EVT-ORG-003 | BranchCreated | Domain | 5 | ENT-ORG-002 | — | branch.created | at-least-once | Internal |

### Savings (SAV)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-SAV-001 | SavingsCollected | Domain | 6 | ENT-SAV-003 | SM-SAV-002 | savings.collected | at-least-once | Restricted |
| EVT-SAV-002 | SavingsAdjusted | Domain | 6 | ENT-SAV-003 | SM-SAV-002 | savings.adjusted | at-least-once | Restricted |
| EVT-SAV-003 | SavingsCancelled | Domain | 6 | ENT-SAV-003 | SM-SAV-002 | savings.cancelled | at-least-once | Restricted |

### Groups / Susu (GRP)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-GRP-001 | GroupCreated | Domain | 7 | ENT-GRP-001 | SM-GRP-001 | group.created | at-least-once | Confidential |
| EVT-GRP-002 | MemberAdded | Domain | 7 | ENT-GRP-002 | SM-GRP-002 | group.member_added | at-least-once | Confidential |
| EVT-GRP-003 | ContributionRecorded | Domain | 7 | ENT-GRP-003 | SM-GRP-003 | group.contribution_recorded | at-least-once | Restricted |

### Loans (LON)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-LON-001 | LoanApproved | Domain | 8 | ENT-LON-001 | SM-LON-001 | loan.approved | at-least-once | Restricted |
| EVT-LON-002 | LoanDisbursed | Domain | 8 | ENT-LON-001 | SM-LON-001 | loan.disbursed | at-least-once | Restricted |
| EVT-LON-003 | LoanRepaymentReceived | Domain | 8 | ENT-LON-002 | SM-LON-001 | loan.repayment_received | at-least-once | Restricted |
| EVT-LON-004 | LoanClosed | Domain | 8 | ENT-LON-001 | SM-LON-001 | loan.closed | at-least-once | Restricted |

### Withdrawals (WDL)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-WDL-001 | WithdrawalRequested | Domain | 9 | ENT-WDL-001 | SM-WDL-001 | withdrawal.requested | at-least-once | Restricted |
| EVT-WDL-002 | WithdrawalApproved | Domain | 9 | ENT-WDL-001 | SM-WDL-001 | withdrawal.approved | at-least-once | Restricted |
| EVT-WDL-003 | WithdrawalCompleted | Domain | 9 | ENT-WDL-001 | SM-WDL-001 | withdrawal.completed | at-least-once | Restricted |

### Accounting / Finance (FIN)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-FIN-001 | JournalPosted | Domain | 10 | ENT-FIN-002 | SM-FIN-001 | accounting.journal_posted | at-least-once | Restricted |
| EVT-FIN-002 | JournalReversed | Domain | 10 | ENT-FIN-002 | SM-FIN-001 | accounting.journal_reversed | at-least-once | Restricted |
| EVT-FIN-003 | AccountingPeriodClosed | Domain | 10 | ENT-FIN-004 | SM-FIN-002 | accounting.period_closed | at-least-once | Internal |

### Reports (RPT)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-RPT-001 | ReportGenerated | Operational | 11 | — | — | reports.generated | at-least-once | Internal |

### Notifications (NTF)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-NTF-001 | NotificationQueued | Operational | 12 | ENT-NTF-001 | — | notification.queued | at-least-once | Internal |
| EVT-NTF-002 | NotificationDelivered | Operational | 12 | ENT-NTF-001 | — | notification.delivered | at-least-once | Internal |

### Audit (AUD)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-AUD-001 | AuditRecorded | Audit | 13 | ENT-AUD-001 | — | audit.recorded | at-least-once | Restricted |

### Configuration (CFG)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-CFG-001 | ConfigurationChanged | Platform | 14 | ENT-CFG-001 | SM-CFG-001 | config.changed | at-least-once | Internal |
| EVT-CFG-002 | FeatureFlagUpdated | Platform | 14 | ENT-CFG-001 | — | config.feature_flag_updated | at-least-once | Internal |

### Synchronization (SYN)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-SYN-001 | SynchronizationCompleted | Operational | 15 | ENT-SYN-001 | SM-SYN-001 | sync.completed | at-least-once | Internal |
| EVT-SYN-002 | SynchronizationFailed | Operational | 15 | ENT-SYN-001 | SM-SYN-001 | sync.failed | at-least-once | Internal |

### Payments (PAY)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-PAY-001 | PaymentCompleted | Domain | 16 | ENT-PAY-001 | SM-PAY-001 | payment.completed | at-least-once | Restricted |
| EVT-PAY-002 | PaymentFailed | Domain | 16 | ENT-PAY-001 | SM-PAY-001 | payment.failed | at-least-once | Restricted |
| EVT-PAY-003 | PaymentReversed | Domain | 16 | ENT-PAY-001 | SM-PAY-001 | payment.reversed | at-least-once | Restricted |

### Documents (DOC)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-DOC-001 | ReceiptIssued | Domain | 17 | ENT-DOC-001 | SM-DOC-001 | document.receipt_issued | at-least-once | Confidential |
| EVT-DOC-002 | StatementGenerated | Domain | 17 | ENT-DOC-001 | — | document.statement_generated | at-least-once | Confidential |
| EVT-DOC-003 | DocumentSigned | Domain | 17 | ENT-DOC-001 | SM-DOC-001 | document.signed | at-least-once | Restricted |

### Scheduler / Jobs (JOB)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-JOB-001 | JobCompleted | Operational | 18 | ENT-JOB-002 | SM-JOB-001 | scheduler.job_completed | at-least-once | Internal |
| EVT-JOB-002 | JobFailed | Operational | 18 | ENT-JOB-002 | SM-JOB-001 | scheduler.job_failed | at-least-once | Internal |

### Monitoring (MON)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-MON-001 | AlertRaised | Operational | 19 | ENT-MON-002 | SM-MON-001 | monitoring.alert_raised | at-least-once | Internal |
| EVT-MON-002 | AlertResolved | Operational | 19 | ENT-MON-002 | SM-MON-001 | monitoring.alert_resolved | at-least-once | Internal |
| EVT-MON-003 | HealthStatusChanged | Operational | 19 | ENT-MON-001 | — | monitoring.health_changed | at-least-once | Internal |

### API Gateway (GWY)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-GWY-001 | ClientRegistered | Integration | 20 | ENT-GWY-001 | — | gateway.client_registered | at-least-once | Confidential |
| EVT-GWY-002 | APIKeyRevoked | Security | 20 | ENT-GWY-002 | — | gateway.api_key_revoked | at-least-once | Restricted |

### Backup / Recovery (BKP)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-BKP-001 | BackupCompleted | Operational | 21 | ENT-BKP-001 | SM-BKP-001 | backup.completed | at-least-once | Restricted |
| EVT-BKP-002 | RestoreCompleted | Operational | 21 | ENT-BKP-001 | SM-BKP-002 | backup.restore_completed | at-least-once | Restricted |

### Security Ops (SEC)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-SEC-001 | FraudDetected | Security | 22 | ENT-SEC-002 | SM-SEC-002 | security.fraud_detected | at-least-once | Restricted |
| EVT-SEC-002 | RiskScoreUpdated | Security | 22 | ENT-SEC-002 | — | security.risk_score_updated | at-least-once | Restricted |
| EVT-SEC-003 | SecurityIncidentOpened | Security | 22 | ENT-SEC-001 | SM-SEC-001 | security.incident_opened | at-least-once | Restricted |
| EVT-SEC-004 | SecurityIncidentClosed | Security | 22 | ENT-SEC-001 | SM-SEC-001 | security.incident_closed | at-least-once | Restricted |

### Workflow (WFK)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-WFK-001 | WorkflowStarted | Domain | 23 | ENT-WFK-002 | SM-WFK-002 | workflow.started | at-least-once | Internal |
| EVT-WFK-002 | WorkflowCompleted | Domain | 23 | ENT-WFK-002 | SM-WFK-002 | workflow.completed | at-least-once | Internal |
| EVT-WFK-003 | WorkflowFailed | Domain | 23 | ENT-WFK-002 | SM-WFK-002 | workflow.failed | at-least-once | Internal |
| EVT-WFK-004 | WorkflowCancelled | Domain | 23 | ENT-WFK-002 | SM-WFK-002 | workflow.cancelled | at-least-once | Internal |
| EVT-WFK-005 | WorkflowTaskCompleted | Domain | 23 | ENT-WFK-003 | SM-WFK-003 | workflow.task_completed | at-least-once | Internal |
| EVT-WFK-006 | WorkflowApproved | Domain | 23 | ENT-WFK-002 | SM-WFK-002 | workflow.approved | at-least-once | Internal |

### Rules (RUL)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-RUL-001 | RuleEvaluated | Domain | 24 | ENT-RUL-001 | SM-RUL-001 | rules.evaluated | at-least-once | Internal |
| EVT-RUL-002 | RulePublished | Domain | 24 | ENT-RUL-001 | SM-RUL-001 | rules.published | at-least-once | Internal |
| EVT-RUL-003 | RuleApproved | Domain | 24 | ENT-RUL-001 | SM-RUL-001 | rules.approved | at-least-once | Internal |

### Data Exchange (XCH)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-XCH-001 | ImportCompleted | Integration | 25 | ENT-XCH-001 | SM-XCH-001 | exchange.import_completed | at-least-once | Confidential |
| EVT-XCH-002 | ExportCompleted | Integration | 25 | ENT-XCH-001 | SM-XCH-001 | exchange.export_completed | at-least-once | Confidential |

### Records (REC)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-REC-001 | RecordUploaded | Domain | 26 | ENT-DOC-002 | SM-DOC-004 | records.uploaded | at-least-once | Confidential |
| EVT-REC-002 | RecordArchived | Domain | 26 | ENT-DOC-002 | SM-DOC-004 | records.archived | at-least-once | Confidential |

### Business Intelligence (BI)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-BI-001 | KpiPublished | Operational | 27 | ENT-BI-002 | SM-BI-001 | bi.kpi_published | at-least-once | Internal |
| EVT-BI-002 | MetricRegistered | Operational | 27 | ENT-BI-001 | — | bi.metric_registered | at-least-once | Internal |

### Integration Hub (INT)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-INT-001 | ProviderRegistered | Integration | 28 | ENT-INT-001 | SM-INT-001 | integration.provider_registered | at-least-once | Internal |
| EVT-INT-002 | WebhookRegistered | Integration | 28 | ENT-INT-002 | SM-INT-002 | integration.webhook_registered | at-least-once | Internal |
| EVT-INT-003 | IntegrationDispatched | Integration | 28 | ENT-INT-003 | SM-INT-004 | integration.dispatched | at-least-once | Confidential |

### AI Advisory (AI)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-AI-001 | PredictionGenerated | Operational | 29 | ENT-AI-003 | — | ai.prediction_generated | at-least-once | Confidential |
| EVT-AI-002 | FraudAlertCreated | Security | 29 | ENT-AI-005 | — | ai.fraud_alert_created | at-least-once | Restricted |
| EVT-AI-003 | ModelDeployed | Platform | 29 | ENT-AI-001 | SM-AI-001 | ai.model_deployed | at-least-once | Internal |
| EVT-AI-004 | DriftDetected | Operational | 29 | ENT-AI-001 | SM-AI-001 | ai.drift_detected | at-least-once | Internal |

### Platform (PLT)

| ID | Name | Type | Owner Mod | Entity | SM | Topic | Delivery | Class |
|----|------|------|-----------|--------|----|-------|----------|-------|
| EVT-PLT-001 | TenantSuspended | Platform | 30 | ENT-PLT-001 | SM-PLT-001 | platform.tenant_suspended | at-least-once | Restricted |
| EVT-PLT-002 | FeatureFlagKilled | Platform | 30 | ENT-PLT-004 | SM-PLT-005 | platform.feature_flag_killed | at-least-once | Internal |
| EVT-PLT-003 | MaintenanceStarted | Platform | 30 | ENT-PLT-005 | SM-PLT-004 | platform.maintenance_started | at-least-once | Internal |
| EVT-PLT-004 | LicenseExpired | Platform | 30 | ENT-PLT-002 | SM-PLT-002 | platform.license_expired | at-least-once | Restricted |


---

## 7. Cross-reference (Phases 1–4)

| Phase | Artifact | ECECMS use |
|-------|----------|------------|
| 1 EMAS | enterprise-master-architecture.md | Module boundaries / Module 20 in-process |
| 2 | phase2-registers.md / governance | Ownership / conflict precedence |
| 3 ECDM | canonical-domain-registry.js | Entity IDs |
| 4 ECSMLS | canonical-state-machine-registry.js | SM IDs / triggers |
| 5 ECECMS | This pack | Events |

---

*End of ECECMS primary specification v1.0.0*
