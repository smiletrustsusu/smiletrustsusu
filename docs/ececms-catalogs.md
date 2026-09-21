# ECECMS Catalogs (Phase 5 Companion Matrices)

**Parent:** [`enterprise-canonical-event-catalog.md`](./enterprise-canonical-event-catalog.md)  
**Registry:** `src/core/canonical-event-registry.js`  
**ECDM:** `src/core/canonical-domain-registry.js`  
**ECSMLS:** `src/core/canonical-state-machine-registry.js`  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · Phases 1–4 alignment  

**Channel reality:** events are **in-process** via `publishDomainEvent` / `state.domainEvents`. Module **20** is in-process. There is **no** live message-bus HTTP server.

**Curated event count:** 79 (validate ok=true)

---

## 1. Event Ownership Matrix

| Event ID | Name | Owner Mod | Producers | Consumers | Type |
|----------|------|-----------|-----------|-----------|------|
| EVT-IDN-001 | UserAuthenticated | 1 | 1 | 13,19,22 | Security |
| EVT-IDN-002 | PasswordChanged | 1 | 1 | 13,22 | Security |
| EVT-IDN-003 | DeviceRegistered | 1 | 1 | 13,22,15 | Security |
| EVT-CUS-001 | CustomerCreated | 3 | 3 | 13,12,27 | Domain |
| EVT-CUS-002 | CustomerUpdated | 3 | 3 | 13,27 | Domain |
| EVT-CUS-003 | CustomerSuspended | 3 | 3 | 13,12,22,19 | Domain |
| EVT-CUS-004 | CustomerClosed | 3 | 3 | 13,12,27 | Domain |
| EVT-ORG-001 | AgentCreated | 4 | 4 | 13,19 | Domain |
| EVT-ORG-002 | AgentSuspended | 4 | 4 | 13,22,19 | Domain |
| EVT-ORG-003 | BranchCreated | 5 | 5 | 13,14 | Domain |
| EVT-SAV-001 | SavingsCollected | 6 | 6 | 13,10,12,17,27 | Domain |
| EVT-SAV-002 | SavingsAdjusted | 6 | 6 | 13,10,22 | Domain |
| EVT-SAV-003 | SavingsCancelled | 6 | 6 | 13,10,19 | Domain |
| EVT-GRP-001 | GroupCreated | 7 | 7 | 13,12 | Domain |
| EVT-GRP-002 | MemberAdded | 7 | 7 | 13,12 | Domain |
| EVT-GRP-003 | ContributionRecorded | 7 | 7 | 13,10,27 | Domain |
| EVT-LON-001 | LoanApproved | 8 | 8 | 13,12,23,27 | Domain |
| EVT-LON-002 | LoanDisbursed | 8 | 8 | 13,10,16,12,17 | Domain |
| EVT-LON-003 | LoanRepaymentReceived | 8 | 8 | 13,10,16,27 | Domain |
| EVT-LON-004 | LoanClosed | 8 | 8 | 13,12,27 | Domain |
| EVT-WDL-001 | WithdrawalRequested | 9 | 9 | 13,23,22 | Domain |
| EVT-WDL-002 | WithdrawalApproved | 9 | 9 | 13,12,16 | Domain |
| EVT-WDL-003 | WithdrawalCompleted | 9 | 9 | 13,10,17,27 | Domain |
| EVT-FIN-001 | JournalPosted | 10 | 10 | 13,27,19 | Domain |
| EVT-FIN-002 | JournalReversed | 10 | 10 | 13,22,19 | Domain |
| EVT-FIN-003 | AccountingPeriodClosed | 10 | 10 | 13,27,30 | Domain |
| EVT-RPT-001 | ReportGenerated | 11 | 11 | 13,12 | Operational |
| EVT-NTF-001 | NotificationQueued | 12 | 12 | 13,19 | Operational |
| EVT-NTF-002 | NotificationDelivered | 12 | 12 | 13,19 | Operational |
| EVT-AUD-001 | AuditRecorded | 13 | 13 | 19,22 | Audit |
| EVT-CFG-001 | ConfigurationChanged | 14 | 14 | 13,19,30 | Platform |
| EVT-CFG-002 | FeatureFlagUpdated | 14 | 14 | 13,19,30 | Platform |
| EVT-SYN-001 | SynchronizationCompleted | 15 | 15 | 13,19 | Operational |
| EVT-SYN-002 | SynchronizationFailed | 15 | 15 | 13,19,22 | Operational |
| EVT-PAY-001 | PaymentCompleted | 16 | 16 | 13,10,12,17,28 | Domain |
| EVT-PAY-002 | PaymentFailed | 16 | 16 | 13,12,19,22 | Domain |
| EVT-PAY-003 | PaymentReversed | 16 | 16 | 13,10,22 | Domain |
| EVT-DOC-001 | ReceiptIssued | 17 | 17 | 13,12 | Domain |
| EVT-DOC-002 | StatementGenerated | 17 | 17 | 13,12 | Domain |
| EVT-DOC-003 | DocumentSigned | 17 | 17 | 13,22 | Domain |
| EVT-JOB-001 | JobCompleted | 18 | 18 | 13,19 | Operational |
| EVT-JOB-002 | JobFailed | 18 | 18 | 13,19,22 | Operational |
| EVT-MON-001 | AlertRaised | 19 | 19 | 13,12,22 | Operational |
| EVT-MON-002 | AlertResolved | 19 | 19 | 13 | Operational |
| EVT-MON-003 | HealthStatusChanged | 19 | 19 | 13,30 | Operational |
| EVT-GWY-001 | ClientRegistered | 20 | 20 | 13,22,28 | Integration |
| EVT-GWY-002 | APIKeyRevoked | 20 | 20 | 13,22,19 | Security |
| EVT-BKP-001 | BackupCompleted | 21 | 21 | 13,19,30 | Operational |
| EVT-BKP-002 | RestoreCompleted | 21 | 21 | 13,19,22,30 | Operational |
| EVT-SEC-001 | FraudDetected | 22 | 22 | 13,19,12,23 | Security |
| EVT-SEC-002 | RiskScoreUpdated | 22 | 22 | 13,19,8 | Security |
| EVT-SEC-003 | SecurityIncidentOpened | 22 | 22 | 13,19,12,30 | Security |
| EVT-SEC-004 | SecurityIncidentClosed | 22 | 22 | 13 | Security |
| EVT-WFK-001 | WorkflowStarted | 23 | 23 | 13,19 | Domain |
| EVT-WFK-002 | WorkflowCompleted | 23 | 23 | 13,19,12 | Domain |
| EVT-WFK-003 | WorkflowFailed | 23 | 23 | 13,19,22 | Domain |
| EVT-WFK-004 | WorkflowCancelled | 23 | 23 | 13,19 | Domain |
| EVT-WFK-005 | WorkflowTaskCompleted | 23 | 23 | 13,19 | Domain |
| EVT-WFK-006 | WorkflowApproved | 23 | 23 | 13,12 | Domain |
| EVT-RUL-001 | RuleEvaluated | 24 | 24 | 13,19,23 | Domain |
| EVT-RUL-002 | RulePublished | 24 | 24 | 13,19,30 | Domain |
| EVT-RUL-003 | RuleApproved | 24 | 24 | 13 | Domain |
| EVT-XCH-001 | ImportCompleted | 25 | 25 | 13,19,28 | Integration |
| EVT-XCH-002 | ExportCompleted | 25 | 25 | 13,19,28 | Integration |
| EVT-REC-001 | RecordUploaded | 26 | 26 | 13,19 | Domain |
| EVT-REC-002 | RecordArchived | 26 | 26 | 13 | Domain |
| EVT-BI-001 | KpiPublished | 27 | 27 | 13,2,19 | Operational |
| EVT-BI-002 | MetricRegistered | 27 | 27 | 13 | Operational |
| EVT-INT-001 | ProviderRegistered | 28 | 28 | 13,19,20 | Integration |
| EVT-INT-002 | WebhookRegistered | 28 | 28 | 13,20 | Integration |
| EVT-INT-003 | IntegrationDispatched | 28 | 28 | 13,19,20 | Integration |
| EVT-AI-001 | PredictionGenerated | 29 | 29 | 13,19,22 | Operational |
| EVT-AI-002 | FraudAlertCreated | 29 | 29 | 13,22,19,12 | Security |
| EVT-AI-003 | ModelDeployed | 29 | 29 | 13,19,30 | Platform |
| EVT-AI-004 | DriftDetected | 29 | 29 | 13,19,22 | Operational |
| EVT-PLT-001 | TenantSuspended | 30 | 30 | 13,19,22,12 | Platform |
| EVT-PLT-002 | FeatureFlagKilled | 30 | 30 | 13,19 | Platform |
| EVT-PLT-003 | MaintenanceStarted | 30 | 30 | 13,19,12 | Platform |
| EVT-PLT-004 | LicenseExpired | 30 | 30 | 13,19,22 | Platform |

---

## 2. Producer–Consumer Matrix (compact)

| Producer module | Event IDs (owned) | Typical consumers |
|-----------------|-------------------|-------------------|
| 1 | EVT-IDN-001, EVT-IDN-002, EVT-IDN-003 | 13, 15, 19, 22 |
| 3 | EVT-CUS-001, EVT-CUS-002, EVT-CUS-003, EVT-CUS-004 | 12, 13, 19, 22, 27 |
| 4 | EVT-ORG-001, EVT-ORG-002 | 13, 19, 22 |
| 5 | EVT-ORG-003 | 13, 14 |
| 6 | EVT-SAV-001, EVT-SAV-002, EVT-SAV-003 | 10, 12, 13, 17, 19, 22, 27 |
| 7 | EVT-GRP-001, EVT-GRP-002, EVT-GRP-003 | 10, 12, 13, 27 |
| 8 | EVT-LON-001, EVT-LON-002, EVT-LON-003, EVT-LON-004 | 10, 12, 13, 16, 17, 23, 27 |
| 9 | EVT-WDL-001, EVT-WDL-002, EVT-WDL-003 | 10, 12, 13, 16, 17, 22, 23, 27 |
| 10 | EVT-FIN-001, EVT-FIN-002, EVT-FIN-003 | 13, 19, 22, 27, 30 |
| 11 | EVT-RPT-001 | 12, 13 |
| 12 | EVT-NTF-001, EVT-NTF-002 | 13, 19 |
| 13 | EVT-AUD-001 | 19, 22 |
| 14 | EVT-CFG-001, EVT-CFG-002 | 13, 19, 30 |
| 15 | EVT-SYN-001, EVT-SYN-002 | 13, 19, 22 |
| 16 | EVT-PAY-001, EVT-PAY-002, EVT-PAY-003 | 10, 12, 13, 17, 19, 22, 28 |
| 17 | EVT-DOC-001, EVT-DOC-002, EVT-DOC-003 | 12, 13, 22 |
| 18 | EVT-JOB-001, EVT-JOB-002 | 13, 19, 22 |
| 19 | EVT-MON-001, EVT-MON-002, EVT-MON-003 | 12, 13, 22, 30 |
| 20 | EVT-GWY-001, EVT-GWY-002 | 13, 19, 22, 28 |
| 21 | EVT-BKP-001, EVT-BKP-002 | 13, 19, 22, 30 |
| 22 | EVT-SEC-001, EVT-SEC-002, EVT-SEC-003, EVT-SEC-004 | 8, 12, 13, 19, 23, 30 |
| 23 | EVT-WFK-001, EVT-WFK-002, EVT-WFK-003, EVT-WFK-004, EVT-WFK-005, EVT-WFK-006 | 12, 13, 19, 22 |
| 24 | EVT-RUL-001, EVT-RUL-002, EVT-RUL-003 | 13, 19, 23, 30 |
| 25 | EVT-XCH-001, EVT-XCH-002 | 13, 19, 28 |
| 26 | EVT-REC-001, EVT-REC-002 | 13, 19 |
| 27 | EVT-BI-001, EVT-BI-002 | 2, 13, 19 |
| 28 | EVT-INT-001, EVT-INT-002, EVT-INT-003 | 13, 19, 20 |
| 29 | EVT-AI-001, EVT-AI-002, EVT-AI-003, EVT-AI-004 | 12, 13, 19, 22, 30 |
| 30 | EVT-PLT-001, EVT-PLT-002, EVT-PLT-003, EVT-PLT-004 | 12, 13, 19, 22 |

---

## 3. Routing Matrix (Module 28)

| Event ID | Topic | Channel | Routing note |
|----------|-------|---------|--------------|
| EVT-IDN-001 | identity.user.authenticated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-IDN-002 | identity.user.password_changed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-IDN-003 | identity.device.registered | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CUS-001 | customer.created | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CUS-002 | customer.updated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CUS-003 | customer.suspended | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CUS-004 | customer.closed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-ORG-001 | agent.created | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-ORG-002 | agent.suspended | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-ORG-003 | branch.created | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SAV-001 | savings.collected | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SAV-002 | savings.adjusted | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SAV-003 | savings.cancelled | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-GRP-001 | group.created | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-GRP-002 | group.member_added | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-GRP-003 | group.contribution_recorded | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-LON-001 | loan.approved | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-LON-002 | loan.disbursed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-LON-003 | loan.repayment_received | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-LON-004 | loan.closed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WDL-001 | withdrawal.requested | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WDL-002 | withdrawal.approved | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WDL-003 | withdrawal.completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-FIN-001 | accounting.journal_posted | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-FIN-002 | accounting.journal_reversed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-FIN-003 | accounting.period_closed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-RPT-001 | reports.generated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-NTF-001 | notification.queued | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-NTF-002 | notification.delivered | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-AUD-001 | audit.recorded | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CFG-001 | config.changed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-CFG-002 | config.feature_flag_updated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SYN-001 | sync.completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SYN-002 | sync.failed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PAY-001 | payment.completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PAY-002 | payment.failed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PAY-003 | payment.reversed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-DOC-001 | document.receipt_issued | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-DOC-002 | document.statement_generated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-DOC-003 | document.signed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-JOB-001 | scheduler.job_completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-JOB-002 | scheduler.job_failed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-MON-001 | monitoring.alert_raised | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-MON-002 | monitoring.alert_resolved | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-MON-003 | monitoring.health_changed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-GWY-001 | gateway.client_registered | in-process.domainEvents | Module 28 may route |
| EVT-GWY-002 | gateway.api_key_revoked | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-BKP-001 | backup.completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-BKP-002 | backup.restore_completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SEC-001 | security.fraud_detected | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SEC-002 | security.risk_score_updated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SEC-003 | security.incident_opened | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-SEC-004 | security.incident_closed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-001 | workflow.started | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-002 | workflow.completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-003 | workflow.failed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-004 | workflow.cancelled | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-005 | workflow.task_completed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-WFK-006 | workflow.approved | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-RUL-001 | rules.evaluated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-RUL-002 | rules.published | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-RUL-003 | rules.approved | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-XCH-001 | exchange.import_completed | in-process.domainEvents | Module 28 may route |
| EVT-XCH-002 | exchange.export_completed | in-process.domainEvents | Module 28 may route |
| EVT-REC-001 | records.uploaded | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-REC-002 | records.archived | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-BI-001 | bi.kpi_published | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-BI-002 | bi.metric_registered | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-INT-001 | integration.provider_registered | in-process.domainEvents | Module 28 may route |
| EVT-INT-002 | integration.webhook_registered | in-process.domainEvents | Module 28 may route |
| EVT-INT-003 | integration.dispatched | in-process.domainEvents | Module 28 may route |
| EVT-AI-001 | ai.prediction_generated | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-AI-002 | ai.fraud_alert_created | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-AI-003 | ai.model_deployed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-AI-004 | ai.drift_detected | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PLT-001 | platform.tenant_suspended | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PLT-002 | platform.feature_flag_killed | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PLT-003 | platform.maintenance_started | in-process.domainEvents | Domain/ops — Hub does not own |
| EVT-PLT-004 | platform.license_expired | in-process.domainEvents | Domain/ops — Hub does not own |

Module **28** may route **Integration**-class events only as a hub. Money Domain events remain owned by financial modules (6/8/9/10/16).

---

## 4. Version & Schema Reference Matrix

| Event ID | Version | Lifecycle | Payload schema | Metadata schema |
|----------|---------|-----------|----------------|-----------------|
| EVT-IDN-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-IDN-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-IDN-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CUS-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CUS-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CUS-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CUS-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-ORG-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-ORG-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-ORG-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SAV-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SAV-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SAV-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-GRP-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-GRP-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-GRP-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-LON-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-LON-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-LON-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-LON-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WDL-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WDL-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WDL-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-FIN-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-FIN-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-FIN-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-RPT-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-NTF-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-NTF-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-AUD-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CFG-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-CFG-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SYN-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SYN-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PAY-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PAY-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PAY-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-DOC-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-DOC-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-DOC-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-JOB-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-JOB-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-MON-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-MON-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-MON-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-GWY-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-GWY-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-BKP-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-BKP-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SEC-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SEC-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SEC-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-SEC-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-005 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-WFK-006 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-RUL-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-RUL-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-RUL-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-XCH-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-XCH-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-REC-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-REC-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-BI-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-BI-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-INT-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-INT-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-INT-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-AI-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-AI-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-AI-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-AI-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PLT-001 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PLT-002 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PLT-003 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |
| EVT-PLT-004 | 1.0.0 | active | domainEvents.payload | api-schema.standardEvent |

---

## 5. Lifecycle Register

| Lifecycle | Count |
|-----------|-------|
| active | 79 |
| deprecated | 0 |
| retired | 0 |
| draft | 0 |

---

## 6. Delivery Guarantee Matrix

| Guarantee | Event count | Meaning |
|-----------|-------------|---------|
| at-most-once | 0 | in-process append semantics |
| at-least-once | 79 | in-process append semantics |
| exactly-once | 0 | in-process append semantics |

---

## 7. Security / Classification Matrix

| Classification | Event count | Handling |
|----------------|-------------|----------|
| Public | 0 | see ECECMS security section |
| Internal | 31 | see ECECMS security section |
| Confidential | 19 | see ECECMS security section |
| Restricted | 29 | see ECECMS security section |

---

## 8. ECDM / ECSMLS Binding Summary

| Bound to entity | Count |
|-----------------|-------|
| With entityId | 78 |
| With stateMachineId | 61 |
| Unbound (ops/platform) | 1 |

---

## 9. Cross-Reference Index (Phases 1–4 & Modules 1–30)

### Phases

| Phase | Artifact | ECECMS use |
|-------|----------|------------|
| 1 EMAS | enterprise-master-architecture.md, emas-matrices.md | Module boundaries; Module 20 in-process |
| 2 | enterprise-consistency-review.md, phase2-registers.md, enterprise-architecture-review-workflow.md, enterprise-governance-validation.md | Ownership / conflict precedence |
| 3 ECDM | enterprise-canonical-domain-model.md, ecdm-catalogs.md, canonical-domain-registry.js | Entity IDs |
| 4 ECSMLS | enterprise-canonical-state-machines.md, ecsmls-catalogs.md, canonical-state-machine-registry.js | SM IDs / triggers |
| 5 ECECMS | This pack | Events |

### Modules (event owners present in curated set)

| Mod | Event IDs |
|-----|-----------|
| 1 | EVT-IDN-001, EVT-IDN-002, EVT-IDN-003 |
| 3 | EVT-CUS-001, EVT-CUS-002, EVT-CUS-003, EVT-CUS-004 |
| 4 | EVT-ORG-001, EVT-ORG-002 |
| 5 | EVT-ORG-003 |
| 6 | EVT-SAV-001, EVT-SAV-002, EVT-SAV-003 |
| 7 | EVT-GRP-001, EVT-GRP-002, EVT-GRP-003 |
| 8 | EVT-LON-001, EVT-LON-002, EVT-LON-003, EVT-LON-004 |
| 9 | EVT-WDL-001, EVT-WDL-002, EVT-WDL-003 |
| 10 | EVT-FIN-001, EVT-FIN-002, EVT-FIN-003 |
| 11 | EVT-RPT-001 |
| 12 | EVT-NTF-001, EVT-NTF-002 |
| 13 | EVT-AUD-001 |
| 14 | EVT-CFG-001, EVT-CFG-002 |
| 15 | EVT-SYN-001, EVT-SYN-002 |
| 16 | EVT-PAY-001, EVT-PAY-002, EVT-PAY-003 |
| 17 | EVT-DOC-001, EVT-DOC-002, EVT-DOC-003 |
| 18 | EVT-JOB-001, EVT-JOB-002 |
| 19 | EVT-MON-001, EVT-MON-002, EVT-MON-003 |
| 20 | EVT-GWY-001, EVT-GWY-002 |
| 21 | EVT-BKP-001, EVT-BKP-002 |
| 22 | EVT-SEC-001, EVT-SEC-002, EVT-SEC-003, EVT-SEC-004 |
| 23 | EVT-WFK-001, EVT-WFK-002, EVT-WFK-003, EVT-WFK-004, EVT-WFK-005, EVT-WFK-006 |
| 24 | EVT-RUL-001, EVT-RUL-002, EVT-RUL-003 |
| 25 | EVT-XCH-001, EVT-XCH-002 |
| 26 | EVT-REC-001, EVT-REC-002 |
| 27 | EVT-BI-001, EVT-BI-002 |
| 28 | EVT-INT-001, EVT-INT-002, EVT-INT-003 |
| 29 | EVT-AI-001, EVT-AI-002, EVT-AI-003, EVT-AI-004 |
| 30 | EVT-PLT-001, EVT-PLT-002, EVT-PLT-003, EVT-PLT-004 |

---

*End of ECECMS catalogs v1.0.0*
