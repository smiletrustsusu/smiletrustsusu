# ECDM Catalogs (Phase 3 Companion Matrices)

**Parent:** [`enterprise-canonical-domain-model.md`](./enterprise-canonical-domain-model.md)  
**Registry:** `src/core/canonical-domain-registry.js`  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · EMAS · Phase 2 alignment  

---

## 1. Canonical Entity Catalog

| Entity ID | Canonical Name | Domain | Owner Module | Aggregate Root | Primary ID | Classification | Persistence keys |
|-----------|----------------|--------|--------------|----------------|------------|----------------|------------------|
| ENT-ORG-001 | Organization | Organization | 14 | Y | business_id | Internal | settings.businessId, businesses |
| ENT-ORG-002 | Branch | Organization | 5 | Y | branch_id | Internal | branches |
| ENT-ORG-003 | Agent | Organization | 4 | Y | agent_id | Confidential | agents, agentRoutes, agentAttendance, agentVisits, agentLeave |
| ENT-ORG-004 | Role | Organization | 1 | Y | role_id | Internal | roles, users.role |
| ENT-ORG-005 | Permission | Organization | 1 | N | permission_id | Internal | permissions, role_permissions |
| ENT-IDN-001 | User | Identity | 1 | Y | user_id | Confidential | users, app_users, deletedUsers |
| ENT-IDN-002 | Session | Identity | 1 | N | session_id | Confidential | sessions, sessionStorage |
| ENT-IDN-003 | Device | Identity | 15 | N | device_id | Internal | devices |
| ENT-CUS-001 | Customer | Customer Management | 3 | Y | customer_id | Confidential | customers |
| ENT-CUS-002 | Beneficiary | Customer Management | 3 | N | beneficiary_id | Confidential | beneficiaries |
| ENT-SAV-001 | SavingsProduct | Savings/Susu | 6 | Y | product_id | Internal | savingsProducts, savings_products |
| ENT-SAV-002 | SavingsAccount | Savings/Susu | 6 | Y | savings_account_id | Confidential | savingsAccounts, savings_accounts |
| ENT-SAV-003 | Collection | Savings/Susu | 6 | Y | collection_id | Restricted | collections |
| ENT-SAV-004 | CollectionAdjustment | Savings/Susu | 6 | N | adjustment_id | Restricted | collectionAdjustments |
| ENT-SAV-005 | ContributionCycle | Savings/Susu | 6 | N | cycle_ref | Internal | collections.sittingsPaid, customers.sittingsPaid, settings.collectionDays |
| ENT-GRP-001 | SusuGroup | Savings/Susu | 7 | Y | group_id | Internal | groups, susu_groups |
| ENT-GRP-002 | GroupMembership | Savings/Susu | 7 | N | membership_id | Confidential | susu_group_members, customers.groupId |
| ENT-GRP-003 | GroupMeeting | Savings/Susu | 7 | N | meeting_id | Internal | groupMeetings |
| ENT-LON-001 | Loan | Loans | 8 | Y | loan_id | Restricted | loans |
| ENT-LON-002 | LoanRepayment | Loans | 8 | N | repayment_id | Restricted | loan_repayments, transactions, ledgerEntries |
| ENT-WDL-001 | WithdrawalRequest | Savings/Susu | 9 | Y | withdrawal_id | Restricted | withdrawalRequests, withdrawal_requests |
| ENT-FIN-001 | ChartOfAccount | Finance | 10 | Y | coa_id | Internal | chartOfAccounts, chart_of_accounts |
| ENT-FIN-002 | JournalEntry | Finance | 10 | Y | journal_id | Restricted | journalEntries, journal_lines |
| ENT-FIN-003 | LedgerEntry | Finance | 10 | N | ledger_entry_id | Restricted | ledgerEntries, ledger_entries |
| ENT-FIN-004 | CashClosing | Finance | 10 | Y | closing_id | Confidential | closings |
| ENT-FIN-005 | LegacyTransaction | Finance | 10 | N | transaction_id | Restricted | transactions |
| ENT-PAY-001 | PaymentTransaction | Payments | 16 | Y | payment_id | Restricted | paymentTransactions, paymentStatusHistory |
| ENT-PAY-002 | ProviderReference | Payments | 16 | N | provider_reference | Confidential | paymentTransactions.providerRef |
| ENT-WFK-001 | WorkflowDefinition | Workflow | 23 | Y | workflow_id | Internal | workflowDefinitions |
| ENT-WFK-002 | WorkflowInstance | Workflow | 23 | Y | workflow_instance_id | Internal | workflowInstances |
| ENT-WFK-003 | WorkflowTask | Workflow | 23 | N | task_id | Internal | workflowTasks |
| ENT-WFK-004 | WorkflowCase | Workflow | 23 | Y | case_id | Confidential | workflowCases |
| ENT-DOC-001 | ReceiptDocument | Documents | 17 | Y | document_id | Confidential | documentMetadata, receiptMappingHistory, receiptOutcomeHistory |
| ENT-DOC-002 | DigitalRecord | Documents | 26 | Y | record_id | Confidential | digitalRecords, recordMetadata |
| ENT-NTF-001 | Notification | Identity | 12 | Y | notification_id | Confidential | messages, notifications |
| ENT-AUD-001 | AuditEvent | Monitoring | 13 | Y | audit_id | Restricted | audit, audit_log |
| ENT-CFG-001 | SystemSetting | Organization | 14 | Y | config_key | Internal | settings, system_settings, configDrafts |
| ENT-SYN-001 | OfflineQueueItem | Integration | 15 | N | sync_queue_id | Confidential | offlineQueue, sync_queue |
| ENT-SYN-002 | IdempotencyKey | Integration | 15 | N | idempotency_key | Internal | idempotency_keys, idempotencyKeys |
| ENT-JOB-001 | JobDefinition | Monitoring | 18 | Y | job_definition_id | Internal | jobDefinitions |
| ENT-JOB-002 | JobInstance | Monitoring | 18 | Y | job_id | Internal | jobQueue, jobAttempts, jobSchedules |
| ENT-MON-001 | OperationalAlert | Monitoring | 19 | Y | alert_id | Internal | monitorAlerts, alerts |
| ENT-MON-002 | OperationalIncident | Monitoring | 19 | Y | incident_id | Confidential | monitorIncidents, incidents |
| ENT-GWY-001 | ApiClient | Integration | 20 | Y | api_client_id | Confidential | apiClients, gatewayClients |
| ENT-GWY-002 | ApiKey | Integration | 20 | N | api_key_id | Restricted | apiKeys, gatewayKeys |
| ENT-BKP-001 | BackupSet | Platform/Tenant | 21 | Y | backup_set_id | Restricted | backupSets, restoreJobs |
| ENT-SEC-001 | SecurityIncident | Monitoring | 22 | Y | security_incident_id | Restricted | securityIncidents |
| ENT-SEC-002 | FraudCase | Monitoring | 22 | Y | fraud_case_id | Restricted | fraudCases, securityFraudCases |
| ENT-RUL-001 | BusinessRule | Workflow | 24 | Y | rule_id | Internal | ruleDefinitions, decisionTables |
| ENT-RUL-002 | RuleDecision | Workflow | 24 | N | decision_id | Internal | ruleDecisions, decisionResults |
| ENT-XCH-001 | ExchangeDataset | Integration | 25 | Y | import_batch | Confidential | exchangeDatasets, exchangeBatches |
| ENT-BI-001 | MetricDefinition | Reporting/BI | 27 | Y | metric_id | Internal | metricDefinitions, metricDefinitionHistory |
| ENT-BI-002 | KpiDefinition | Reporting/BI | 27 | Y | kpi_id | Internal | kpiDefinitions, biKpis |
| ENT-INT-001 | IntegrationProvider | Integration | 28 | Y | integration_provider_id | Confidential | integrationProviders |
| ENT-INT-002 | IntegrationWebhook | Integration | 28 | N | webhook_id | Confidential | integrationWebhooks, integrationDeliverables |
| ENT-INT-003 | IntegrationMessage | Integration | 28 | N | message_id | Confidential | messageQueues, messageHistory, messageSubscriptions |
| ENT-AI-001 | AiModel | AI | 29 | Y | ai_model_id | Internal | aiModels, aiModelVersions, aiModelDeployments |
| ENT-AI-002 | AiDataset | AI | 29 | Y | ai_dataset_id | Confidential | aiDatasets |
| ENT-AI-003 | AiPrediction | AI | 29 | Y | ai_prediction_id | Confidential | aiPredictionRequests, aiPredictionResults |
| ENT-AI-004 | AiFraudAlert | AI | 29 | Y | ai_fraud_alert_id | Restricted | aiFraudAlerts |
| ENT-AI-005 | AiRecommendation | AI | 29 | N | ai_recommendation_id | Internal | aiRecommendationHistory, aiHumanFeedback |
| ENT-PLT-001 | Tenant | Platform/Tenant | 30 | Y | tenant_id | Confidential | platformTenants, platformTenantConfigurations |
| ENT-PLT-002 | License | Platform/Tenant | 30 | Y | license_id | Confidential | platformLicenses, platformLicenseAssignments |
| ENT-PLT-003 | PlatformEnvironment | Platform/Tenant | 30 | Y | environment_id | Internal | platformEnvironmentRegistry |
| ENT-PLT-004 | FeatureFlagRule | Platform/Tenant | 30 | N | feature_flag_rule_id | Internal | platformFeatureFlagRules |
| ENT-PLT-005 | MaintenanceWindow | Platform/Tenant | 30 | Y | maintenance_window_id | Internal | platformMaintenanceWindows |
| ENT-PLT-006 | DeploymentRecord | Platform/Tenant | 30 | Y | deployment_id | Internal | platformDeploymentHistory, platformDeploymentApprovals |

**Totals:** 67 entities · 46 aggregate roots.

---

## 2. Aggregate Root Catalog

| Entity ID | Name | Owner | Purpose |
|-----------|------|-------|---------|
| ENT-ORG-001 | Organization | 14 | Legal/business identity for the Susu operator (Smile Trust). |
| ENT-ORG-002 | Branch | 5 | Operational branch / office scope for customers, agents, and cash. |
| ENT-ORG-003 | Agent | 4 | Field collector/agent profile, routes, attendance (not the login User). |
| ENT-ORG-004 | Role | 1 | RBAC role definition (Admin=Branch Manager, KBA=Super Admin, SystemOwner=john). |
| ENT-IDN-001 | User | 1 | Authenticated application user account. |
| ENT-CUS-001 | Customer | 3 | Susu member / customer master (CRM). |
| ENT-SAV-001 | SavingsProduct | 6 | Personal savings product definition (daily/weekly/flexible contribution expectations). |
| ENT-SAV-002 | SavingsAccount | 6 | Personal Susu/savings account; balance is ledger-derived cache. |
| ENT-SAV-003 | Collection | 6 | Posted individual savings contribution (authoritative money event). |
| ENT-GRP-001 | SusuGroup | 7 | Group Susu circle (state.groups); distinct from Branch though legacy dual-use exists. |
| ENT-LON-001 | Loan | 8 | Customer loan account; live statuses Pending→Approved→Active→Completed (etc.). |
| ENT-WDL-001 | WithdrawalRequest | 9 | Savings redemption / withdrawal request through approval and payout. |
| ENT-FIN-001 | ChartOfAccount | 10 | GL account master. |
| ENT-FIN-002 | JournalEntry | 10 | Accounting journal header with balanced lines. |
| ENT-FIN-004 | CashClosing | 10 | Cashier/branch closing / cash session record. |
| ENT-PAY-001 | PaymentTransaction | 16 | MoMo/provider payment lifecycle record; must not invent a second Susu collection post. |
| ENT-WFK-001 | WorkflowDefinition | 23 | Reusable workflow template/code. |
| ENT-WFK-002 | WorkflowInstance | 23 | Running workflow case instance (does not mutate money directly). |
| ENT-WFK-004 | WorkflowCase | 23 | Case management envelope for approvals/exceptions. |
| ENT-DOC-001 | ReceiptDocument | 17 | Printed/digital receipt or statement issued by Module 17. |
| ENT-DOC-002 | DigitalRecord | 26 | Records-management object (retention, classification) owned by Module 26. |
| ENT-NTF-001 | Notification | 12 | Outbound SMS/WhatsApp/email/in-app notification message. |
| ENT-AUD-001 | AuditEvent | 13 | Immutable compliance audit trail entry. |
| ENT-CFG-001 | SystemSetting | 14 | Runtime configuration (interest 15%, cashier GHS 1000, collectionDays 31, etc.). |
| ENT-JOB-001 | JobDefinition | 18 | Background job type/definition registry. |
| ENT-JOB-002 | JobInstance | 18 | Queued/running/completed job execution. |
| ENT-MON-001 | OperationalAlert | 19 | Health/SLO alert raised by Module 19. |
| ENT-MON-002 | OperationalIncident | 19 | Ops incident record for diagnostics. |
| ENT-GWY-001 | ApiClient | 20 | In-process gateway registered client (not an HTTP server process). |
| ENT-BKP-001 | BackupSet | 21 | Backup/restore set metadata (Module 21). |
| ENT-SEC-001 | SecurityIncident | 22 | Security operations incident (distinct from AI fraud alerts). |
| ENT-SEC-002 | FraudCase | 22 | Security-ops fraud case under Module 22 investigation. |
| ENT-RUL-001 | BusinessRule | 24 | Deterministic rule / decision table (Module 24 authority). |
| ENT-XCH-001 | ExchangeDataset | 25 | Import/export dataset batch metadata (no financial apply). |
| ENT-BI-001 | MetricDefinition | 27 | Enterprise metric schema definition (reference; no posting). |
| ENT-BI-002 | KpiDefinition | 27 | KPI registry entry composed from metrics. |
| ENT-INT-001 | IntegrationProvider | 28 | Partner/provider registry in Integration Hub (extends gateway; no posting). |
| ENT-AI-001 | AiModel | 29 | Advisory ML model registry entry (never owns money mutation). |
| ENT-AI-002 | AiDataset | 29 | Training/inference dataset metadata with classification. |
| ENT-AI-003 | AiPrediction | 29 | Advisory prediction/forecast result. |
| ENT-AI-004 | AiFraudAlert | 29 | Advisory fraud heuristic alert (distinct from Module 22 FraudCase). |
| ENT-PLT-001 | Tenant | 30 | Platform tenant registration (Module 30); does not post Susu money. |
| ENT-PLT-002 | License | 30 | Platform license and assignment. |
| ENT-PLT-003 | PlatformEnvironment | 30 | Deployed environment registry (dev/stage/prod metadata). |
| ENT-PLT-005 | MaintenanceWindow | 30 | Scheduled maintenance / read-only window. |
| ENT-PLT-006 | DeploymentRecord | 30 | Platform deploy plan/approve/execute/rollback metadata. |

---

## 3. Relationship Matrix

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

## 4. Ownership Matrix

| Entity ID | Name | Business owner (module) | Technical owner (core) | Lifecycle owner | DB/persistence owner | API/contract owner | Event owner |
|-----------|------|-------------------------|------------------------|-----------------|----------------------|--------------------|-------------|
| ENT-ORG-001 | Organization | 14 | Module 14 cores | 14 | 14 | 14 | 14 |
| ENT-ORG-002 | Branch | 5 | Module 5 cores | 5 | 5 | 5 | 5 |
| ENT-ORG-003 | Agent | 4 | Module 4 cores | 4 | 4 | 4 | 4 |
| ENT-ORG-004 | Role | 1 | Module 1 cores | 1 | 1 | 1 | 1 |
| ENT-ORG-005 | Permission | 1 | Module 1 cores | 1 | 1 | 1 | 1 |
| ENT-IDN-001 | User | 1 | Module 1 cores | 1 | 1 | 1 | 1 |
| ENT-IDN-002 | Session | 1 | Module 1 cores | 1 | 1 | 1 | 1 |
| ENT-IDN-003 | Device | 15 | Module 15 cores | 15 | 15 | 15 | 15 |
| ENT-CUS-001 | Customer | 3 | Module 3 cores | 3 | 3 | 3 | 3 |
| ENT-CUS-002 | Beneficiary | 3 | Module 3 cores | 3 | 3 | 3 | 3 |
| ENT-SAV-001 | SavingsProduct | 6 | Module 6 cores | 6 | 6 | 6 | 6 |
| ENT-SAV-002 | SavingsAccount | 6 | Module 6 cores | 6 | 6 | 6 | 6 |
| ENT-SAV-003 | Collection | 6 | Module 6 cores | 6 | 6 | 6 | 6 |
| ENT-SAV-004 | CollectionAdjustment | 6 | Module 6 cores | 6 | 6 | 6 | 6 |
| ENT-SAV-005 | ContributionCycle | 6 | Module 6 cores | 6 | 6 | 6 | 6 |
| ENT-GRP-001 | SusuGroup | 7 | Module 7 cores | 7 | 7 | 7 | 7 |
| ENT-GRP-002 | GroupMembership | 7 | Module 7 cores | 7 | 7 | 7 | 7 |
| ENT-GRP-003 | GroupMeeting | 7 | Module 7 cores | 7 | 7 | 7 | 7 |
| ENT-LON-001 | Loan | 8 | Module 8 cores | 8 | 8 | 8 | 8 |
| ENT-LON-002 | LoanRepayment | 8 | Module 8 cores | 8 | 8 | 8 | 8 |
| ENT-WDL-001 | WithdrawalRequest | 9 | Module 9 cores | 9 | 9 | 9 | 9 |
| ENT-FIN-001 | ChartOfAccount | 10 | Module 10 cores | 10 | 10 | 10 | 10 |
| ENT-FIN-002 | JournalEntry | 10 | Module 10 cores | 10 | 10 | 10 | 10 |
| ENT-FIN-003 | LedgerEntry | 10 | Module 10 cores | 10 | 10 | 10 | 10 |
| ENT-FIN-004 | CashClosing | 10 | Module 10 cores | 10 | 10 | 10 | 10 |
| ENT-FIN-005 | LegacyTransaction | 10 | Module 10 cores | 10 | 10 | 10 | 10 |
| ENT-PAY-001 | PaymentTransaction | 16 | Module 16 cores | 16 | 16 | 16 | 16 |
| ENT-PAY-002 | ProviderReference | 16 | Module 16 cores | 16 | 16 | 16 | 16 |
| ENT-WFK-001 | WorkflowDefinition | 23 | Module 23 cores | 23 | 23 | 23 | 23 |
| ENT-WFK-002 | WorkflowInstance | 23 | Module 23 cores | 23 | 23 | 23 | 23 |
| ENT-WFK-003 | WorkflowTask | 23 | Module 23 cores | 23 | 23 | 23 | 23 |
| ENT-WFK-004 | WorkflowCase | 23 | Module 23 cores | 23 | 23 | 23 | 23 |
| ENT-DOC-001 | ReceiptDocument | 17 | Module 17 cores | 17 | 17 | 17 | 17 |
| ENT-DOC-002 | DigitalRecord | 26 | Module 26 cores | 26 | 26 | 26 | 26 |
| ENT-NTF-001 | Notification | 12 | Module 12 cores | 12 | 12 | 12 | 12 |
| ENT-AUD-001 | AuditEvent | 13 | Module 13 cores | 13 | 13 | 13 | 13 |
| ENT-CFG-001 | SystemSetting | 14 | Module 14 cores | 14 | 14 | 14 | 14 |
| ENT-SYN-001 | OfflineQueueItem | 15 | Module 15 cores | 15 | 15 | 15 | 15 |
| ENT-SYN-002 | IdempotencyKey | 15 | Module 15 cores | 15 | 15 | 15 | 15 |
| ENT-JOB-001 | JobDefinition | 18 | Module 18 cores | 18 | 18 | 18 | 18 |
| ENT-JOB-002 | JobInstance | 18 | Module 18 cores | 18 | 18 | 18 | 18 |
| ENT-MON-001 | OperationalAlert | 19 | Module 19 cores | 19 | 19 | 19 | 19 |
| ENT-MON-002 | OperationalIncident | 19 | Module 19 cores | 19 | 19 | 19 | 19 |
| ENT-GWY-001 | ApiClient | 20 | Module 20 cores | 20 | 20 | 20 | 20 |
| ENT-GWY-002 | ApiKey | 20 | Module 20 cores | 20 | 20 | 20 | 20 |
| ENT-BKP-001 | BackupSet | 21 | Module 21 cores | 21 | 21 | 21 | 21 |
| ENT-SEC-001 | SecurityIncident | 22 | Module 22 cores | 22 | 22 | 22 | 22 |
| ENT-SEC-002 | FraudCase | 22 | Module 22 cores | 22 | 22 | 22 | 22 |
| ENT-RUL-001 | BusinessRule | 24 | Module 24 cores | 24 | 24 | 24 | 24 |
| ENT-RUL-002 | RuleDecision | 24 | Module 24 cores | 24 | 24 | 24 | 24 |
| ENT-XCH-001 | ExchangeDataset | 25 | Module 25 cores | 25 | 25 | 25 | 25 |
| ENT-BI-001 | MetricDefinition | 27 | Module 27 cores | 27 | 27 | 27 | 27 |
| ENT-BI-002 | KpiDefinition | 27 | Module 27 cores | 27 | 27 | 27 | 27 |
| ENT-INT-001 | IntegrationProvider | 28 | Module 28 cores | 28 | 28 | 28 | 28 |
| ENT-INT-002 | IntegrationWebhook | 28 | Module 28 cores | 28 | 28 | 28 | 28 |
| ENT-INT-003 | IntegrationMessage | 28 | Module 28 cores | 28 | 28 | 28 | 28 |
| ENT-AI-001 | AiModel | 29 | Module 29 cores | 29 | 29 | 29 | 29 |
| ENT-AI-002 | AiDataset | 29 | Module 29 cores | 29 | 29 | 29 | 29 |
| ENT-AI-003 | AiPrediction | 29 | Module 29 cores | 29 | 29 | 29 | 29 |
| ENT-AI-004 | AiFraudAlert | 29 | Module 29 cores | 29 | 29 | 29 | 29 |
| ENT-AI-005 | AiRecommendation | 29 | Module 29 cores | 29 | 29 | 29 | 29 |
| ENT-PLT-001 | Tenant | 30 | Module 30 cores | 30 | 30 | 30 | 30 |
| ENT-PLT-002 | License | 30 | Module 30 cores | 30 | 30 | 30 | 30 |
| ENT-PLT-003 | PlatformEnvironment | 30 | Module 30 cores | 30 | 30 | 30 | 30 |
| ENT-PLT-004 | FeatureFlagRule | 30 | Module 30 cores | 30 | 30 | 30 | 30 |
| ENT-PLT-005 | MaintenanceWindow | 30 | Module 30 cores | 30 | 30 | 30 | 30 |
| ENT-PLT-006 | DeploymentRecord | 30 | Module 30 cores | 30 | 30 | 30 | 30 |

**Money posting owners (exclusive):** Modules 6, 7, 8, 9, 10 (+16 payment lifecycle). **Must not write money:** 28, 29, 30 (and BI/exchange/records/rules/workflow for posting).

---

## 5. Identifier Registry

| Entity ID | Primary ID type | Business key / prefix notes |
|-----------|-----------------|-----------------------------|
| ENT-ORG-001 | business_id | settings.businessId / businesses.client_id |
| ENT-ORG-002 | branch_id | BRH / branch code |
| ENT-ORG-003 | agent_id | AGT |
| ENT-ORG-004 | role_id | role code (Collector, Cashier, Admin, KBA, SystemOwner) |
| ENT-ORG-005 | permission_id | action string (e.g. Collection.Post) |
| ENT-IDN-001 | user_id | username (unique) |
| ENT-IDN-002 | session_id | sessionStorage user id |
| ENT-IDN-003 | device_id | DEV |
| ENT-CUS-001 | customer_id | CUS / customer number |
| ENT-CUS-002 | beneficiary_id | customerId + nominee identity |
| ENT-SAV-001 | product_id | product code |
| ENT-SAV-002 | savings_account_id | SAV |
| ENT-SAV-003 | collection_id | COL / receipt_no / idempotency_key |
| ENT-SAV-004 | adjustment_id | collectionId + adjustment seq |
| ENT-SAV-005 | cycle_ref | customerId + cycle/sitting number |
| ENT-GRP-001 | group_id | GRP |
| ENT-GRP-002 | membership_id | groupId + customerId |
| ENT-GRP-003 | meeting_id | groupId + meeting date |
| ENT-LON-001 | loan_id | LON |
| ENT-LON-002 | repayment_id | loanId + repayment seq / receipt |
| ENT-WDL-001 | withdrawal_id | WDL |
| ENT-FIN-001 | coa_id | account code |
| ENT-FIN-002 | journal_id | JRN / journal_number |
| ENT-FIN-003 | ledger_entry_id | journal + line / entry id |
| ENT-FIN-004 | closing_id | CSS / closing date + branch |
| ENT-FIN-005 | transaction_id | ref / id |
| ENT-PAY-001 | payment_id | PAY / provider reference |
| ENT-PAY-002 | provider_reference | external system id |
| ENT-WFK-001 | workflow_id | WKF / workflow code |
| ENT-WFK-002 | workflow_instance_id | instance id |
| ENT-WFK-003 | task_id | TSK |
| ENT-WFK-004 | case_id | CSE |
| ENT-DOC-001 | document_id | RCP / receipt_number |
| ENT-DOC-002 | record_id | record code |
| ENT-NTF-001 | notification_id | NTF |
| ENT-AUD-001 | audit_id | AUD |
| ENT-CFG-001 | config_key | settings key / CFG version |
| ENT-SYN-001 | sync_queue_id | queue item id |
| ENT-SYN-002 | idempotency_key | idempotency key string |
| ENT-JOB-001 | job_definition_id | job type code |
| ENT-JOB-002 | job_id | job instance id |
| ENT-MON-001 | alert_id | alert code + time |
| ENT-MON-002 | incident_id | incident id |
| ENT-GWY-001 | api_client_id | client code |
| ENT-GWY-002 | api_key_id | key id (hash stored) |
| ENT-BKP-001 | backup_set_id | backup set id |
| ENT-SEC-001 | security_incident_id | incident id |
| ENT-SEC-002 | fraud_case_id | fraud case id |
| ENT-RUL-001 | rule_id | rule code |
| ENT-RUL-002 | decision_id | ruleId + evaluation id |
| ENT-XCH-001 | import_batch | batch id |
| ENT-BI-001 | metric_id | metricCode |
| ENT-BI-002 | kpi_id | kpi code |
| ENT-INT-001 | integration_provider_id | provider code |
| ENT-INT-002 | webhook_id | webhook id |
| ENT-INT-003 | message_id | message id + idempotency |
| ENT-AI-001 | ai_model_id | model code / family |
| ENT-AI-002 | ai_dataset_id | dataset code |
| ENT-AI-003 | ai_prediction_id | prediction request/result id |
| ENT-AI-004 | ai_fraud_alert_id | alert id |
| ENT-AI-005 | ai_recommendation_id | recommendation id |
| ENT-PLT-001 | tenant_id | tenant code |
| ENT-PLT-002 | license_id | license code |
| ENT-PLT-003 | environment_id | environment code |
| ENT-PLT-004 | feature_flag_rule_id | flagId + rule id |
| ENT-PLT-005 | maintenance_window_id | window id |
| ENT-PLT-006 | deployment_id | deployment id + version |

See also [`identifiers.md`](./identifiers.md) and `BUSINESS_PREFIXES` in `identifiers.js`.

---

## 6. Entity Dependency Matrix (selected)

High-level **depends on** (child → parent / required peer):

| Entity | Depends on |
|--------|------------|
| Customer | Branch, optional SusuGroup |
| SavingsAccount | Customer, SavingsProduct |
| Collection | Customer, Branch; optional Agent, SavingsAccount |
| Loan | Customer |
| LoanRepayment | Loan |
| WithdrawalRequest | Customer; optional SavingsAccount |
| LedgerEntry | JournalEntry; may reference Collection/Loan/Withdrawal |
| PaymentTransaction | optional Customer |
| WorkflowTask | WorkflowInstance → WorkflowDefinition |
| AiPrediction | AiModel; optional AiDataset |
| License | Tenant |
| IntegrationWebhook | IntegrationProvider |
| ApiKey | ApiClient |

Full edges: Relationship Matrix §3.

---

## 7. Entity Lifecycle Catalog

| Entity ID | Lifecycle (summary) | Owner |
|-----------|---------------------|-------|
| ENT-ORG-001 | Active/Inactive or module-specific lifecycle | 14 |
| ENT-ORG-002 | Active/Inactive or module-specific lifecycle | 5 |
| ENT-ORG-003 | Active/Inactive or module-specific lifecycle | 4 |
| ENT-ORG-004 | Active/Inactive or module-specific lifecycle | 1 |
| ENT-ORG-005 | Active/Inactive or module-specific lifecycle | 1 |
| ENT-IDN-001 | Active/Inactive or module-specific lifecycle | 1 |
| ENT-IDN-002 | Created → Active → Expired/Revoked | 1 |
| ENT-IDN-003 | Active/Inactive or module-specific lifecycle | 15 |
| ENT-CUS-001 | Active/Inactive or module-specific lifecycle | 3 |
| ENT-CUS-002 | Active/Inactive or module-specific lifecycle | 3 |
| ENT-SAV-001 | Active/Inactive or module-specific lifecycle | 6 |
| ENT-SAV-002 | Active/Inactive or module-specific lifecycle | 6 |
| ENT-SAV-003 | Initiated → Pending → Validated → Posted → (Reversal) | 6 |
| ENT-SAV-004 | Active/Inactive or module-specific lifecycle | 6 |
| ENT-SAV-005 | Active/Inactive or module-specific lifecycle | 6 |
| ENT-GRP-001 | Active/Inactive or module-specific lifecycle | 7 |
| ENT-GRP-002 | Active/Inactive or module-specific lifecycle | 7 |
| ENT-GRP-003 | Active/Inactive or module-specific lifecycle | 7 |
| ENT-LON-001 | Pending → (Verified) → Approved → Active → Completed | Defaulted/Written Off/Recovered/Restructured | 8 |
| ENT-LON-002 | Active/Inactive or module-specific lifecycle | 8 |
| ENT-WDL-001 | Requested → Verified → Approved → Paid → (Reversed) | 9 |
| ENT-FIN-001 | Active/Inactive or module-specific lifecycle | 10 |
| ENT-FIN-002 | Active/Inactive or module-specific lifecycle | 10 |
| ENT-FIN-003 | Active/Inactive or module-specific lifecycle | 10 |
| ENT-FIN-004 | Active/Inactive or module-specific lifecycle | 10 |
| ENT-FIN-005 | Active/Inactive or module-specific lifecycle | 10 |
| ENT-PAY-001 | payment-lifecycle.js stage machine (Module 16) | 16 |
| ENT-PAY-002 | Active/Inactive or module-specific lifecycle | 16 |
| ENT-WFK-001 | Active/Inactive or module-specific lifecycle | 23 |
| ENT-WFK-002 | Started → Running → Suspended → Completed/Cancelled | 23 |
| ENT-WFK-003 | Active/Inactive or module-specific lifecycle | 23 |
| ENT-WFK-004 | Active/Inactive or module-specific lifecycle | 23 |
| ENT-DOC-001 | Active/Inactive or module-specific lifecycle | 17 |
| ENT-DOC-002 | Active/Inactive or module-specific lifecycle | 26 |
| ENT-NTF-001 | Active/Inactive or module-specific lifecycle | 12 |
| ENT-AUD-001 | Active/Inactive or module-specific lifecycle | 13 |
| ENT-CFG-001 | Active/Inactive or module-specific lifecycle | 14 |
| ENT-SYN-001 | Active/Inactive or module-specific lifecycle | 15 |
| ENT-SYN-002 | Active/Inactive or module-specific lifecycle | 15 |
| ENT-JOB-001 | Active/Inactive or module-specific lifecycle | 18 |
| ENT-JOB-002 | Queued → Running → Succeeded/Failed/DeadLetter | 18 |
| ENT-MON-001 | Active/Inactive or module-specific lifecycle | 19 |
| ENT-MON-002 | Active/Inactive or module-specific lifecycle | 19 |
| ENT-GWY-001 | Active/Inactive or module-specific lifecycle | 20 |
| ENT-GWY-002 | Active/Inactive or module-specific lifecycle | 20 |
| ENT-BKP-001 | Active/Inactive or module-specific lifecycle | 21 |
| ENT-SEC-001 | Active/Inactive or module-specific lifecycle | 22 |
| ENT-SEC-002 | Active/Inactive or module-specific lifecycle | 22 |
| ENT-RUL-001 | Active/Inactive or module-specific lifecycle | 24 |
| ENT-RUL-002 | Active/Inactive or module-specific lifecycle | 24 |
| ENT-XCH-001 | Active/Inactive or module-specific lifecycle | 25 |
| ENT-BI-001 | Active/Inactive or module-specific lifecycle | 27 |
| ENT-BI-002 | Active/Inactive or module-specific lifecycle | 27 |
| ENT-INT-001 | Active/Inactive or module-specific lifecycle | 28 |
| ENT-INT-002 | Active/Inactive or module-specific lifecycle | 28 |
| ENT-INT-003 | Active/Inactive or module-specific lifecycle | 28 |
| ENT-AI-001 | Draft → Approved → Deployed → Retired | 29 |
| ENT-AI-002 | Active/Inactive or module-specific lifecycle | 29 |
| ENT-AI-003 | Active/Inactive or module-specific lifecycle | 29 |
| ENT-AI-004 | Active/Inactive or module-specific lifecycle | 29 |
| ENT-AI-005 | Active/Inactive or module-specific lifecycle | 29 |
| ENT-PLT-001 | Registered → Active → Suspended → Decommissioned | 30 |
| ENT-PLT-002 | Active/Inactive or module-specific lifecycle | 30 |
| ENT-PLT-003 | Active/Inactive or module-specific lifecycle | 30 |
| ENT-PLT-004 | Active/Inactive or module-specific lifecycle | 30 |
| ENT-PLT-005 | Active/Inactive or module-specific lifecycle | 30 |
| ENT-PLT-006 | Active/Inactive or module-specific lifecycle | 30 |

---

## 8. Entity Classification Register

| Classification | Count | Entity IDs |
|----------------|-------|------------|
| Public | 0 | — |
| Internal | 28 | ENT-ORG-001, ENT-ORG-002, ENT-ORG-004, ENT-ORG-005, ENT-IDN-003, ENT-SAV-001, ENT-SAV-005, ENT-GRP-001, ENT-GRP-003, ENT-FIN-001, ENT-WFK-001, ENT-WFK-002, ENT-WFK-003, ENT-CFG-001, ENT-SYN-002, ENT-JOB-001, ENT-JOB-002, ENT-MON-001, ENT-RUL-001, ENT-RUL-002, ENT-BI-001, ENT-BI-002, ENT-AI-001, ENT-AI-005, ENT-PLT-003, ENT-PLT-004, ENT-PLT-005, ENT-PLT-006 |
| Confidential | 24 | ENT-ORG-003, ENT-IDN-001, ENT-IDN-002, ENT-CUS-001, ENT-CUS-002, ENT-SAV-002, ENT-GRP-002, ENT-FIN-004, ENT-PAY-002, ENT-WFK-004, ENT-DOC-001, ENT-DOC-002, ENT-NTF-001, ENT-SYN-001, ENT-MON-002, ENT-GWY-001, ENT-XCH-001, ENT-INT-001, ENT-INT-002, ENT-INT-003, ENT-AI-002, ENT-AI-003, ENT-PLT-001, ENT-PLT-002 |
| Restricted | 15 | ENT-SAV-003, ENT-SAV-004, ENT-LON-001, ENT-LON-002, ENT-WDL-001, ENT-FIN-002, ENT-FIN-003, ENT-FIN-005, ENT-PAY-001, ENT-AUD-001, ENT-GWY-002, ENT-BKP-001, ENT-SEC-001, ENT-SEC-002, ENT-AI-004 |

---

## 9. Canonical Naming Standard

| Rule | Example |
|------|---------|
| Entity code | `ENT-{DOMAIN}-{NNN}` — `ENT-CUS-001` |
| Domain tokens | ORG, IDN, CUS, SAV, GRP, LON, WDL, FIN, PAY, WFK, DOC, NTF, AUD, CFG, SYN, JOB, MON, GWY, BKP, SEC, RUL, XCH, BI, INT, AI, PLT |
| Canonical name | PascalCase noun — `SavingsAccount`, `WithdrawalRequest` |
| Persistence keys | Document real state keys — `collections`, `ledgerEntries`, `platformTenants` |
| Aliases (non-canonical) | Member→Customer; Contribution→Collection; Organization→businesses/`businessId` |
| Forbidden | Parallel `members`/`organizations`/`users` tables reinventing SoT |

---

## 10. Cross-Reference Index to Modules 1–30

| Module | Name | ECDM entities owned |
|--------|------|---------------------|
| 1 | Authentication & Session | ENT-ORG-004, ENT-ORG-005, ENT-IDN-001, ENT-IDN-002 |
| 2 | Dashboard | —(query/report/cross-cutting; no exclusive entity in v1.0.0) |
| 3 | Customer CRM | ENT-CUS-001, ENT-CUS-002 |
| 4 | Agent Management | ENT-ORG-003 |
| 5 | Branch Management | ENT-ORG-002 |
| 6 | Individual Savings Collection | ENT-SAV-001, ENT-SAV-002, ENT-SAV-003, ENT-SAV-004, ENT-SAV-005 |
| 7 | Group Susu Management | ENT-GRP-001, ENT-GRP-002, ENT-GRP-003 |
| 8 | Loans | ENT-LON-001, ENT-LON-002 |
| 9 | Withdrawals | ENT-WDL-001 |
| 10 | Accounting & GL | ENT-FIN-001, ENT-FIN-002, ENT-FIN-003, ENT-FIN-004, ENT-FIN-005 |
| 11 | Reports (ops) | —(query/report/cross-cutting; no exclusive entity in v1.0.0) |
| 12 | Notification | ENT-NTF-001 |
| 13 | Audit | ENT-AUD-001 |
| 14 | System Admin & Config | ENT-ORG-001, ENT-CFG-001 |
| 15 | Offline Sync | ENT-IDN-003, ENT-SYN-001, ENT-SYN-002 |
| 16 | Payments / MoMo | ENT-PAY-001, ENT-PAY-002 |
| 17 | Receipts & Documents | ENT-DOC-001 |
| 18 | Jobs | ENT-JOB-001, ENT-JOB-002 |
| 19 | Monitoring | ENT-MON-001, ENT-MON-002 |
| 20 | API Gateway | ENT-GWY-001, ENT-GWY-002 |
| 21 | Backup/DR | ENT-BKP-001 |
| 22 | Security Ops | ENT-SEC-001, ENT-SEC-002 |
| 23 | Workflow | ENT-WFK-001, ENT-WFK-002, ENT-WFK-003, ENT-WFK-004 |
| 24 | Rule Engine | ENT-RUL-001, ENT-RUL-002 |
| 25 | Data Exchange | ENT-XCH-001 |
| 26 | Digital Records | ENT-DOC-002 |
| 27 | Enterprise BI | ENT-BI-001, ENT-BI-002 |
| 28 | Integration Hub | ENT-INT-001, ENT-INT-002, ENT-INT-003 |
| 29 | AI | ENT-AI-001, ENT-AI-002, ENT-AI-003, ENT-AI-004, ENT-AI-005 |
| 30 | Platform Admin | ENT-PLT-001, ENT-PLT-002, ENT-PLT-003, ENT-PLT-004, ENT-PLT-005, ENT-PLT-006 |

**Note:** Modules **2** (Dashboard) and **11** (Reports) are query/report surfaces over owned entities; they do not introduce duplicate entity definitions.

---

## 11. Money / advisory boundary checklist

| Check | Status |
|-------|--------|
| Money entities not owned by 28/29/30 | Enforced in registry + tests |
| AI entities advisory only | ENT-AI-* owned by 29; no money codes |
| Integration owns hub metadata only | ENT-INT-* |
| Platform owns tenants/flags/licenses only | ENT-PLT-* |
| EMAS Modules 1–30 referenced | Yes |
| Phase 2 Data Ownership Register aligned | Yes |

---

*End of ECDM Catalogs v1.0.0*
