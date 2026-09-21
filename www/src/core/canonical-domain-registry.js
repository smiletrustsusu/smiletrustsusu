/**
 * Phase 3 — Enterprise Canonical Domain Model (ECDM) machine-readable registry.
 * Business entity codes, ownership, aggregates, identifiers, relationships.
 * Does not redefine APIs, schemas, workflows, or posting logic.
 */

export const ECDM_VERSION = "1.0.0";
export const ECDM_STATUS = "Authoritative";

/** Classifications aligned with Phase 2 / AI governance language. */
export const CLASSIFICATIONS = Object.freeze([
  "Public",
  "Internal",
  "Confidential",
  "Restricted"
]);

/**
 * Money / transactional entities — must not be owned by Modules 28, 29, or 30.
 * Module 16 may own payment lifecycle entities; Modules 6–10 own Susu money posting.
 */
export const MONEY_TRANSACTION_ENTITY_CODES = Object.freeze([
  "ENT-SAV-002",
  "ENT-SAV-003",
  "ENT-SAV-004",
  "ENT-GRP-003",
  "ENT-LON-001",
  "ENT-LON-002",
  "ENT-WDL-001",
  "ENT-FIN-002",
  "ENT-FIN-003",
  "ENT-FIN-005",
  "ENT-PAY-001"
]);

const FORBIDDEN_MONEY_OWNERS = Object.freeze([28, 29, 30]);

/**
 * Canonical entity catalog. Persistence keys are logical ownership of
 * localStorage snapshot arrays / optional SQL tables — not a schema redesign.
 */
export const CANONICAL_ENTITIES = Object.freeze([
  // —— Organization ——
  {
    code: "ENT-ORG-001",
    name: "Organization",
    domain: "Organization",
    purpose: "Legal/business identity for the Susu operator (Smile Trust).",
    owningModuleId: 14,
    aggregateRoot: true,
    primaryIdType: "business_id",
    businessKey: "settings.businessId / businesses.client_id",
    classification: "Internal",
    persistenceKeys: ["settings.businessId", "businesses"],
    version: "1.0.0"
  },
  {
    code: "ENT-ORG-002",
    name: "Branch",
    domain: "Organization",
    purpose: "Operational branch / office scope for customers, agents, and cash.",
    owningModuleId: 5,
    aggregateRoot: true,
    primaryIdType: "branch_id",
    businessKey: "BRH / branch code",
    classification: "Internal",
    persistenceKeys: ["branches"],
    version: "1.0.0"
  },
  {
    code: "ENT-ORG-003",
    name: "Agent",
    domain: "Organization",
    purpose: "Field collector/agent profile, routes, attendance (not the login User).",
    owningModuleId: 4,
    aggregateRoot: true,
    primaryIdType: "agent_id",
    businessKey: "AGT",
    classification: "Confidential",
    persistenceKeys: ["agents", "agentRoutes", "agentAttendance", "agentVisits", "agentLeave"],
    version: "1.0.0"
  },
  {
    code: "ENT-ORG-004",
    name: "Role",
    domain: "Organization",
    purpose: "RBAC role definition (Admin=Branch Manager, KBA=Super Admin, SystemOwner=john).",
    owningModuleId: 1,
    aggregateRoot: true,
    primaryIdType: "role_id",
    businessKey: "role code (Collector, Cashier, Admin, KBA, SystemOwner)",
    classification: "Internal",
    persistenceKeys: ["roles", "users.role"],
    version: "1.0.0"
  },
  {
    code: "ENT-ORG-005",
    name: "Permission",
    domain: "Organization",
    purpose: "Atomic RBAC action grant bound to roles.",
    owningModuleId: 1,
    aggregateRoot: false,
    primaryIdType: "permission_id",
    businessKey: "action string (e.g. Collection.Post)",
    classification: "Internal",
    persistenceKeys: ["permissions", "role_permissions"],
    version: "1.0.0"
  },

  // —— Identity ——
  {
    code: "ENT-IDN-001",
    name: "User",
    domain: "Identity",
    purpose: "Authenticated application user account.",
    owningModuleId: 1,
    aggregateRoot: true,
    primaryIdType: "user_id",
    businessKey: "username (unique)",
    classification: "Confidential",
    persistenceKeys: ["users", "app_users", "deletedUsers"],
    version: "1.0.0"
  },
  {
    code: "ENT-IDN-002",
    name: "Session",
    domain: "Identity",
    purpose: "Logged-in session binding user to device/browser.",
    owningModuleId: 1,
    aggregateRoot: false,
    primaryIdType: "session_id",
    businessKey: "sessionStorage user id",
    classification: "Confidential",
    persistenceKeys: ["sessions", "sessionStorage"],
    version: "1.0.0"
  },
  {
    code: "ENT-IDN-003",
    name: "Device",
    domain: "Identity",
    purpose: "Registered EXE/APK/browser device for sync and audit attribution.",
    owningModuleId: 15,
    aggregateRoot: false,
    primaryIdType: "device_id",
    businessKey: "DEV",
    classification: "Internal",
    persistenceKeys: ["devices"],
    version: "1.0.0"
  },

  // —— Customer ——
  {
    code: "ENT-CUS-001",
    name: "Customer",
    domain: "Customer Management",
    purpose: "Susu member / customer master (CRM).",
    owningModuleId: 3,
    aggregateRoot: true,
    primaryIdType: "customer_id",
    businessKey: "CUS / customer number",
    classification: "Confidential",
    persistenceKeys: ["customers"],
    version: "1.0.0"
  },
  {
    code: "ENT-CUS-002",
    name: "Beneficiary",
    domain: "Customer Management",
    purpose: "Nominee/beneficiary linked to a customer for payout guidance.",
    owningModuleId: 3,
    aggregateRoot: false,
    primaryIdType: "beneficiary_id",
    businessKey: "customerId + nominee identity",
    classification: "Confidential",
    persistenceKeys: ["beneficiaries"],
    version: "1.0.0"
  },

  // —— Savings / Susu ——
  {
    code: "ENT-SAV-001",
    name: "SavingsProduct",
    domain: "Savings/Susu",
    purpose: "Personal savings product definition (daily/weekly/flexible contribution expectations).",
    owningModuleId: 6,
    aggregateRoot: true,
    primaryIdType: "product_id",
    businessKey: "product code",
    classification: "Internal",
    persistenceKeys: ["savingsProducts", "savings_products"],
    version: "1.0.0"
  },
  {
    code: "ENT-SAV-002",
    name: "SavingsAccount",
    domain: "Savings/Susu",
    purpose: "Personal Susu/savings account; balance is ledger-derived cache.",
    owningModuleId: 6,
    aggregateRoot: true,
    primaryIdType: "savings_account_id",
    businessKey: "SAV",
    classification: "Confidential",
    persistenceKeys: ["savingsAccounts", "savings_accounts"],
    version: "1.0.0"
  },
  {
    code: "ENT-SAV-003",
    name: "Collection",
    domain: "Savings/Susu",
    purpose: "Posted individual savings contribution (authoritative money event).",
    owningModuleId: 6,
    aggregateRoot: true,
    primaryIdType: "collection_id",
    businessKey: "COL / receipt_no / idempotency_key",
    classification: "Restricted",
    persistenceKeys: ["collections"],
    version: "1.0.0"
  },
  {
    code: "ENT-SAV-004",
    name: "CollectionAdjustment",
    domain: "Savings/Susu",
    purpose: "Correction/reversal metadata for a posted collection (never silent delete).",
    owningModuleId: 6,
    aggregateRoot: false,
    primaryIdType: "adjustment_id",
    businessKey: "collectionId + adjustment seq",
    classification: "Restricted",
    persistenceKeys: ["collectionAdjustments"],
    version: "1.0.0"
  },
  {
    code: "ENT-SAV-005",
    name: "ContributionCycle",
    domain: "Savings/Susu",
    purpose: "Logical contribution cycle / sitting (default 31-day cycle; sittingsPaid on collections).",
    owningModuleId: 6,
    aggregateRoot: false,
    primaryIdType: "cycle_ref",
    businessKey: "customerId + cycle/sitting number",
    classification: "Internal",
    persistenceKeys: ["collections.sittingsPaid", "customers.sittingsPaid", "settings.collectionDays"],
    version: "1.0.0"
  },

  // —— Group Susu ——
  {
    code: "ENT-GRP-001",
    name: "SusuGroup",
    domain: "Savings/Susu",
    purpose: "Group Susu circle (state.groups); distinct from Branch though legacy dual-use exists.",
    owningModuleId: 7,
    aggregateRoot: true,
    primaryIdType: "group_id",
    businessKey: "GRP",
    classification: "Internal",
    persistenceKeys: ["groups", "susu_groups"],
    version: "1.0.0"
  },
  {
    code: "ENT-GRP-002",
    name: "GroupMembership",
    domain: "Savings/Susu",
    purpose: "Customer membership in a Susu group.",
    owningModuleId: 7,
    aggregateRoot: false,
    primaryIdType: "membership_id",
    businessKey: "groupId + customerId",
    classification: "Confidential",
    persistenceKeys: ["susu_group_members", "customers.groupId"],
    version: "1.0.0"
  },
  {
    code: "ENT-GRP-003",
    name: "GroupMeeting",
    domain: "Savings/Susu",
    purpose: "Scheduled/held group meeting where contributions may be collected.",
    owningModuleId: 7,
    aggregateRoot: false,
    primaryIdType: "meeting_id",
    businessKey: "groupId + meeting date",
    classification: "Internal",
    persistenceKeys: ["groupMeetings"],
    version: "1.0.0"
  },

  // —— Loans ——
  {
    code: "ENT-LON-001",
    name: "Loan",
    domain: "Loans",
    purpose: "Customer loan account; live statuses Pending→Approved→Active→Completed (etc.).",
    owningModuleId: 8,
    aggregateRoot: true,
    primaryIdType: "loan_id",
    businessKey: "LON",
    classification: "Restricted",
    persistenceKeys: ["loans"],
    version: "1.0.0"
  },
  {
    code: "ENT-LON-002",
    name: "LoanRepayment",
    domain: "Loans",
    purpose: "Posted loan repayment event (ledger-backed).",
    owningModuleId: 8,
    aggregateRoot: false,
    primaryIdType: "repayment_id",
    businessKey: "loanId + repayment seq / receipt",
    classification: "Restricted",
    persistenceKeys: ["loan_repayments", "transactions", "ledgerEntries"],
    version: "1.0.0"
  },

  // —— Withdrawals ——
  {
    code: "ENT-WDL-001",
    name: "WithdrawalRequest",
    domain: "Savings/Susu",
    purpose: "Savings redemption / withdrawal request through approval and payout.",
    owningModuleId: 9,
    aggregateRoot: true,
    primaryIdType: "withdrawal_id",
    businessKey: "WDL",
    classification: "Restricted",
    persistenceKeys: ["withdrawalRequests", "withdrawal_requests"],
    version: "1.0.0"
  },

  // —— Finance ——
  {
    code: "ENT-FIN-001",
    name: "ChartOfAccount",
    domain: "Finance",
    purpose: "GL account master.",
    owningModuleId: 10,
    aggregateRoot: true,
    primaryIdType: "coa_id",
    businessKey: "account code",
    classification: "Internal",
    persistenceKeys: ["chartOfAccounts", "chart_of_accounts"],
    version: "1.0.0"
  },
  {
    code: "ENT-FIN-002",
    name: "JournalEntry",
    domain: "Finance",
    purpose: "Accounting journal header with balanced lines.",
    owningModuleId: 10,
    aggregateRoot: true,
    primaryIdType: "journal_id",
    businessKey: "JRN / journal_number",
    classification: "Restricted",
    persistenceKeys: ["journalEntries", "journal_lines"],
    version: "1.0.0"
  },
  {
    code: "ENT-FIN-003",
    name: "LedgerEntry",
    domain: "Finance",
    purpose: "Authoritative double-entry ledger line (pesewas).",
    owningModuleId: 10,
    aggregateRoot: false,
    primaryIdType: "ledger_entry_id",
    businessKey: "journal + line / entry id",
    classification: "Restricted",
    persistenceKeys: ["ledgerEntries", "ledger_entries"],
    version: "1.0.0"
  },
  {
    code: "ENT-FIN-004",
    name: "CashClosing",
    domain: "Finance",
    purpose: "Cashier/branch closing / cash session record.",
    owningModuleId: 10,
    aggregateRoot: true,
    primaryIdType: "closing_id",
    businessKey: "CSS / closing date + branch",
    classification: "Confidential",
    persistenceKeys: ["closings"],
    version: "1.0.0"
  },
  {
    code: "ENT-FIN-005",
    name: "LegacyTransaction",
    domain: "Finance",
    purpose: "Legacy GHS transaction rows used by some UI balance paths; not a second posting owner.",
    owningModuleId: 10,
    aggregateRoot: false,
    primaryIdType: "transaction_id",
    businessKey: "ref / id",
    classification: "Restricted",
    persistenceKeys: ["transactions"],
    version: "1.0.0"
  },

  // —— Payments ——
  {
    code: "ENT-PAY-001",
    name: "PaymentTransaction",
    domain: "Payments",
    purpose: "MoMo/provider payment lifecycle record; must not invent a second Susu collection post.",
    owningModuleId: 16,
    aggregateRoot: true,
    primaryIdType: "payment_id",
    businessKey: "PAY / provider reference",
    classification: "Restricted",
    persistenceKeys: ["paymentTransactions", "paymentStatusHistory"],
    version: "1.0.0"
  },
  {
    code: "ENT-PAY-002",
    name: "ProviderReference",
    domain: "Payments",
    purpose: "External MoMo/SMS provider correlation id (never rewritten).",
    owningModuleId: 16,
    aggregateRoot: false,
    primaryIdType: "provider_reference",
    businessKey: "external system id",
    classification: "Confidential",
    persistenceKeys: ["paymentTransactions.providerRef"],
    version: "1.0.0"
  },

  // —— Workflow ——
  {
    code: "ENT-WFK-001",
    name: "WorkflowDefinition",
    domain: "Workflow",
    purpose: "Reusable workflow template/code.",
    owningModuleId: 23,
    aggregateRoot: true,
    primaryIdType: "workflow_id",
    businessKey: "WKF / workflow code",
    classification: "Internal",
    persistenceKeys: ["workflowDefinitions"],
    version: "1.0.0"
  },
  {
    code: "ENT-WFK-002",
    name: "WorkflowInstance",
    domain: "Workflow",
    purpose: "Running workflow case instance (does not mutate money directly).",
    owningModuleId: 23,
    aggregateRoot: true,
    primaryIdType: "workflow_instance_id",
    businessKey: "instance id",
    classification: "Internal",
    persistenceKeys: ["workflowInstances"],
    version: "1.0.0"
  },
  {
    code: "ENT-WFK-003",
    name: "WorkflowTask",
    domain: "Workflow",
    purpose: "Human/system task within a workflow instance.",
    owningModuleId: 23,
    aggregateRoot: false,
    primaryIdType: "task_id",
    businessKey: "TSK",
    classification: "Internal",
    persistenceKeys: ["workflowTasks"],
    version: "1.0.0"
  },
  {
    code: "ENT-WFK-004",
    name: "WorkflowCase",
    domain: "Workflow",
    purpose: "Case management envelope for approvals/exceptions.",
    owningModuleId: 23,
    aggregateRoot: true,
    primaryIdType: "case_id",
    businessKey: "CSE",
    classification: "Confidential",
    persistenceKeys: ["workflowCases"],
    version: "1.0.0"
  },

  // —— Documents ——
  {
    code: "ENT-DOC-001",
    name: "ReceiptDocument",
    domain: "Documents",
    purpose: "Printed/digital receipt or statement issued by Module 17.",
    owningModuleId: 17,
    aggregateRoot: true,
    primaryIdType: "document_id",
    businessKey: "RCP / receipt_number",
    classification: "Confidential",
    persistenceKeys: ["documentMetadata", "receiptMappingHistory", "receiptOutcomeHistory"],
    version: "1.0.0"
  },
  {
    code: "ENT-DOC-002",
    name: "DigitalRecord",
    domain: "Documents",
    purpose: "Records-management object (retention, classification) owned by Module 26.",
    owningModuleId: 26,
    aggregateRoot: true,
    primaryIdType: "record_id",
    businessKey: "record code",
    classification: "Confidential",
    persistenceKeys: ["digitalRecords", "recordMetadata"],
    version: "1.0.0"
  },

  // —— Notifications / Audit / Config ——
  {
    code: "ENT-NTF-001",
    name: "Notification",
    domain: "Identity",
    purpose: "Outbound SMS/WhatsApp/email/in-app notification message.",
    owningModuleId: 12,
    aggregateRoot: true,
    primaryIdType: "notification_id",
    businessKey: "NTF",
    classification: "Confidential",
    persistenceKeys: ["messages", "notifications"],
    version: "1.0.0"
  },
  {
    code: "ENT-AUD-001",
    name: "AuditEvent",
    domain: "Monitoring",
    purpose: "Immutable compliance audit trail entry.",
    owningModuleId: 13,
    aggregateRoot: true,
    primaryIdType: "audit_id",
    businessKey: "AUD",
    classification: "Restricted",
    persistenceKeys: ["audit", "audit_log"],
    version: "1.0.0"
  },
  {
    code: "ENT-CFG-001",
    name: "SystemSetting",
    domain: "Organization",
    purpose: "Runtime configuration (interest 15%, cashier GHS 1000, collectionDays 31, etc.).",
    owningModuleId: 14,
    aggregateRoot: true,
    primaryIdType: "config_key",
    businessKey: "settings key / CFG version",
    classification: "Internal",
    persistenceKeys: ["settings", "system_settings", "configDrafts"],
    version: "1.0.0"
  },

  // —— Sync ——
  {
    code: "ENT-SYN-001",
    name: "OfflineQueueItem",
    domain: "Integration",
    purpose: "Pending offline write until sync flush; not a second ledger.",
    owningModuleId: 15,
    aggregateRoot: false,
    primaryIdType: "sync_queue_id",
    businessKey: "queue item id",
    classification: "Confidential",
    persistenceKeys: ["offlineQueue", "sync_queue"],
    version: "1.0.0"
  },
  {
    code: "ENT-SYN-002",
    name: "IdempotencyKey",
    domain: "Integration",
    purpose: "Client idempotency token for safe retries (collections, payments).",
    owningModuleId: 15,
    aggregateRoot: false,
    primaryIdType: "idempotency_key",
    businessKey: "idempotency key string",
    classification: "Internal",
    persistenceKeys: ["idempotency_keys", "idempotencyKeys"],
    version: "1.0.0"
  },

  // —— Jobs ——
  {
    code: "ENT-JOB-001",
    name: "JobDefinition",
    domain: "Monitoring",
    purpose: "Background job type/definition registry.",
    owningModuleId: 18,
    aggregateRoot: true,
    primaryIdType: "job_definition_id",
    businessKey: "job type code",
    classification: "Internal",
    persistenceKeys: ["jobDefinitions"],
    version: "1.0.0"
  },
  {
    code: "ENT-JOB-002",
    name: "JobInstance",
    domain: "Monitoring",
    purpose: "Queued/running/completed job execution.",
    owningModuleId: 18,
    aggregateRoot: true,
    primaryIdType: "job_id",
    businessKey: "job instance id",
    classification: "Internal",
    persistenceKeys: ["jobQueue", "jobAttempts", "jobSchedules"],
    version: "1.0.0"
  },

  // —— Monitoring ——
  {
    code: "ENT-MON-001",
    name: "OperationalAlert",
    domain: "Monitoring",
    purpose: "Health/SLO alert raised by Module 19.",
    owningModuleId: 19,
    aggregateRoot: true,
    primaryIdType: "alert_id",
    businessKey: "alert code + time",
    classification: "Internal",
    persistenceKeys: ["monitorAlerts", "alerts"],
    version: "1.0.0"
  },
  {
    code: "ENT-MON-002",
    name: "OperationalIncident",
    domain: "Monitoring",
    purpose: "Ops incident record for diagnostics.",
    owningModuleId: 19,
    aggregateRoot: true,
    primaryIdType: "incident_id",
    businessKey: "incident id",
    classification: "Confidential",
    persistenceKeys: ["monitorIncidents", "incidents"],
    version: "1.0.0"
  },

  // —— Gateway ——
  {
    code: "ENT-GWY-001",
    name: "ApiClient",
    domain: "Integration",
    purpose: "In-process gateway registered client (not an HTTP server process).",
    owningModuleId: 20,
    aggregateRoot: true,
    primaryIdType: "api_client_id",
    businessKey: "client code",
    classification: "Confidential",
    persistenceKeys: ["apiClients", "gatewayClients"],
    version: "1.0.0"
  },
  {
    code: "ENT-GWY-002",
    name: "ApiKey",
    domain: "Integration",
    purpose: "Hashed API key credential for gateway clients.",
    owningModuleId: 20,
    aggregateRoot: false,
    primaryIdType: "api_key_id",
    businessKey: "key id (hash stored)",
    classification: "Restricted",
    persistenceKeys: ["apiKeys", "gatewayKeys"],
    version: "1.0.0"
  },

  // —— Backup / Security ——
  {
    code: "ENT-BKP-001",
    name: "BackupSet",
    domain: "Platform/Tenant",
    purpose: "Backup/restore set metadata (Module 21).",
    owningModuleId: 21,
    aggregateRoot: true,
    primaryIdType: "backup_set_id",
    businessKey: "backup set id",
    classification: "Restricted",
    persistenceKeys: ["backupSets", "restoreJobs"],
    version: "1.0.0"
  },
  {
    code: "ENT-SEC-001",
    name: "SecurityIncident",
    domain: "Monitoring",
    purpose: "Security operations incident (distinct from AI fraud alerts).",
    owningModuleId: 22,
    aggregateRoot: true,
    primaryIdType: "security_incident_id",
    businessKey: "incident id",
    classification: "Restricted",
    persistenceKeys: ["securityIncidents"],
    version: "1.0.0"
  },
  {
    code: "ENT-SEC-002",
    name: "FraudCase",
    domain: "Monitoring",
    purpose: "Security-ops fraud case under Module 22 investigation.",
    owningModuleId: 22,
    aggregateRoot: true,
    primaryIdType: "fraud_case_id",
    businessKey: "fraud case id",
    classification: "Restricted",
    persistenceKeys: ["fraudCases", "securityFraudCases"],
    version: "1.0.0"
  },

  // —— Rules ——
  {
    code: "ENT-RUL-001",
    name: "BusinessRule",
    domain: "Workflow",
    purpose: "Deterministic rule / decision table (Module 24 authority).",
    owningModuleId: 24,
    aggregateRoot: true,
    primaryIdType: "rule_id",
    businessKey: "rule code",
    classification: "Internal",
    persistenceKeys: ["ruleDefinitions", "decisionTables"],
    version: "1.0.0"
  },
  {
    code: "ENT-RUL-002",
    name: "RuleDecision",
    domain: "Workflow",
    purpose: "Side-effect-free evaluation result snapshot.",
    owningModuleId: 24,
    aggregateRoot: false,
    primaryIdType: "decision_id",
    businessKey: "ruleId + evaluation id",
    classification: "Internal",
    persistenceKeys: ["ruleDecisions", "decisionResults"],
    version: "1.0.0"
  },

  // —— Exchange / Records / BI ——
  {
    code: "ENT-XCH-001",
    name: "ExchangeDataset",
    domain: "Integration",
    purpose: "Import/export dataset batch metadata (no financial apply).",
    owningModuleId: 25,
    aggregateRoot: true,
    primaryIdType: "import_batch",
    businessKey: "batch id",
    classification: "Confidential",
    persistenceKeys: ["exchangeDatasets", "exchangeBatches"],
    version: "1.0.0"
  },
  {
    code: "ENT-BI-001",
    name: "MetricDefinition",
    domain: "Reporting/BI",
    purpose: "Enterprise metric schema definition (reference; no posting).",
    owningModuleId: 27,
    aggregateRoot: true,
    primaryIdType: "metric_id",
    businessKey: "metricCode",
    classification: "Internal",
    persistenceKeys: ["metricDefinitions", "metricDefinitionHistory"],
    version: "1.0.0"
  },
  {
    code: "ENT-BI-002",
    name: "KpiDefinition",
    domain: "Reporting/BI",
    purpose: "KPI registry entry composed from metrics.",
    owningModuleId: 27,
    aggregateRoot: true,
    primaryIdType: "kpi_id",
    businessKey: "kpi code",
    classification: "Internal",
    persistenceKeys: ["kpiDefinitions", "biKpis"],
    version: "1.0.0"
  },

  // —— Integration Hub (28) ——
  {
    code: "ENT-INT-001",
    name: "IntegrationProvider",
    domain: "Integration",
    purpose: "Partner/provider registry in Integration Hub (extends gateway; no posting).",
    owningModuleId: 28,
    aggregateRoot: true,
    primaryIdType: "integration_provider_id",
    businessKey: "provider code",
    classification: "Confidential",
    persistenceKeys: ["integrationProviders"],
    version: "1.0.0"
  },
  {
    code: "ENT-INT-002",
    name: "IntegrationWebhook",
    domain: "Integration",
    purpose: "Partner webhook subscription/delivery metadata.",
    owningModuleId: 28,
    aggregateRoot: false,
    primaryIdType: "webhook_id",
    businessKey: "webhook id",
    classification: "Confidential",
    persistenceKeys: ["integrationWebhooks", "integrationDeliverables"],
    version: "1.0.0"
  },
  {
    code: "ENT-INT-003",
    name: "IntegrationMessage",
    domain: "Integration",
    purpose: "Hub message queue item / subscription delivery.",
    owningModuleId: 28,
    aggregateRoot: false,
    primaryIdType: "message_id",
    businessKey: "message id + idempotency",
    classification: "Confidential",
    persistenceKeys: ["messageQueues", "messageHistory", "messageSubscriptions"],
    version: "1.0.0"
  },

  // —— AI (29) advisory ——
  {
    code: "ENT-AI-001",
    name: "AiModel",
    domain: "AI",
    purpose: "Advisory ML model registry entry (never owns money mutation).",
    owningModuleId: 29,
    aggregateRoot: true,
    primaryIdType: "ai_model_id",
    businessKey: "model code / family",
    classification: "Internal",
    persistenceKeys: ["aiModels", "aiModelVersions", "aiModelDeployments"],
    version: "1.0.0"
  },
  {
    code: "ENT-AI-002",
    name: "AiDataset",
    domain: "AI",
    purpose: "Training/inference dataset metadata with classification.",
    owningModuleId: 29,
    aggregateRoot: true,
    primaryIdType: "ai_dataset_id",
    businessKey: "dataset code",
    classification: "Confidential",
    persistenceKeys: ["aiDatasets"],
    version: "1.0.0"
  },
  {
    code: "ENT-AI-003",
    name: "AiPrediction",
    domain: "AI",
    purpose: "Advisory prediction/forecast result.",
    owningModuleId: 29,
    aggregateRoot: true,
    primaryIdType: "ai_prediction_id",
    businessKey: "prediction request/result id",
    classification: "Confidential",
    persistenceKeys: ["aiPredictionRequests", "aiPredictionResults"],
    version: "1.0.0"
  },
  {
    code: "ENT-AI-004",
    name: "AiFraudAlert",
    domain: "AI",
    purpose: "Advisory fraud heuristic alert (distinct from Module 22 FraudCase).",
    owningModuleId: 29,
    aggregateRoot: true,
    primaryIdType: "ai_fraud_alert_id",
    businessKey: "alert id",
    classification: "Restricted",
    persistenceKeys: ["aiFraudAlerts"],
    version: "1.0.0"
  },
  {
    code: "ENT-AI-005",
    name: "AiRecommendation",
    domain: "AI",
    purpose: "Human-reviewed advisory recommendation history.",
    owningModuleId: 29,
    aggregateRoot: false,
    primaryIdType: "ai_recommendation_id",
    businessKey: "recommendation id",
    classification: "Internal",
    persistenceKeys: ["aiRecommendationHistory", "aiHumanFeedback"],
    version: "1.0.0"
  },

  // —— Platform (30) ——
  {
    code: "ENT-PLT-001",
    name: "Tenant",
    domain: "Platform/Tenant",
    purpose: "Platform tenant registration (Module 30); does not post Susu money.",
    owningModuleId: 30,
    aggregateRoot: true,
    primaryIdType: "tenant_id",
    businessKey: "tenant code",
    classification: "Confidential",
    persistenceKeys: ["platformTenants", "platformTenantConfigurations"],
    version: "1.0.0"
  },
  {
    code: "ENT-PLT-002",
    name: "License",
    domain: "Platform/Tenant",
    purpose: "Platform license and assignment.",
    owningModuleId: 30,
    aggregateRoot: true,
    primaryIdType: "license_id",
    businessKey: "license code",
    classification: "Confidential",
    persistenceKeys: ["platformLicenses", "platformLicenseAssignments"],
    version: "1.0.0"
  },
  {
    code: "ENT-PLT-003",
    name: "PlatformEnvironment",
    domain: "Platform/Tenant",
    purpose: "Deployed environment registry (dev/stage/prod metadata).",
    owningModuleId: 30,
    aggregateRoot: true,
    primaryIdType: "environment_id",
    businessKey: "environment code",
    classification: "Internal",
    persistenceKeys: ["platformEnvironmentRegistry"],
    version: "1.0.0"
  },
  {
    code: "ENT-PLT-004",
    name: "FeatureFlagRule",
    domain: "Platform/Tenant",
    purpose: "Platform feature-flag evaluation rule (RACI with Module 14 base flags).",
    owningModuleId: 30,
    aggregateRoot: false,
    primaryIdType: "feature_flag_rule_id",
    businessKey: "flagId + rule id",
    classification: "Internal",
    persistenceKeys: ["platformFeatureFlagRules"],
    version: "1.0.0"
  },
  {
    code: "ENT-PLT-005",
    name: "MaintenanceWindow",
    domain: "Platform/Tenant",
    purpose: "Scheduled maintenance / read-only window.",
    owningModuleId: 30,
    aggregateRoot: true,
    primaryIdType: "maintenance_window_id",
    businessKey: "window id",
    classification: "Internal",
    persistenceKeys: ["platformMaintenanceWindows"],
    version: "1.0.0"
  },
  {
    code: "ENT-PLT-006",
    name: "DeploymentRecord",
    domain: "Platform/Tenant",
    purpose: "Platform deploy plan/approve/execute/rollback metadata.",
    owningModuleId: 30,
    aggregateRoot: true,
    primaryIdType: "deployment_id",
    businessKey: "deployment id + version",
    classification: "Internal",
    persistenceKeys: ["platformDeploymentHistory", "platformDeploymentApprovals"],
    version: "1.0.0"
  }
]);

/**
 * Directed relationships: from → to with cardinality.
 * Cardinality: "1:1" | "1:N" | "N:1" | "M:N"
 */
export const CANONICAL_RELATIONSHIPS = Object.freeze([
  { from: "ENT-ORG-002", to: "ENT-ORG-001", cardinality: "N:1", kind: "belongs_to" },
  { from: "ENT-ORG-003", to: "ENT-ORG-002", cardinality: "N:1", kind: "assigned_to" },
  { from: "ENT-ORG-003", to: "ENT-IDN-001", cardinality: "0..1:1", kind: "may_link_user" },
  { from: "ENT-ORG-005", to: "ENT-ORG-004", cardinality: "M:N", kind: "granted_via" },
  { from: "ENT-IDN-001", to: "ENT-ORG-004", cardinality: "N:1", kind: "has_role" },
  { from: "ENT-IDN-001", to: "ENT-ORG-002", cardinality: "N:1", kind: "scoped_to" },
  { from: "ENT-IDN-002", to: "ENT-IDN-001", cardinality: "N:1", kind: "belongs_to" },
  { from: "ENT-IDN-002", to: "ENT-IDN-003", cardinality: "N:1", kind: "on_device" },
  { from: "ENT-CUS-001", to: "ENT-ORG-002", cardinality: "N:1", kind: "belongs_to" },
  { from: "ENT-CUS-002", to: "ENT-CUS-001", cardinality: "N:1", kind: "nominee_of" },
  { from: "ENT-SAV-002", to: "ENT-CUS-001", cardinality: "N:1", kind: "owned_by" },
  { from: "ENT-SAV-002", to: "ENT-SAV-001", cardinality: "N:1", kind: "product" },
  { from: "ENT-SAV-003", to: "ENT-CUS-001", cardinality: "N:1", kind: "for_customer" },
  { from: "ENT-SAV-003", to: "ENT-SAV-002", cardinality: "N:0..1", kind: "credits_account" },
  { from: "ENT-SAV-003", to: "ENT-ORG-003", cardinality: "N:0..1", kind: "collected_by" },
  { from: "ENT-SAV-003", to: "ENT-ORG-002", cardinality: "N:1", kind: "at_branch" },
  { from: "ENT-SAV-004", to: "ENT-SAV-003", cardinality: "N:1", kind: "adjusts" },
  { from: "ENT-SAV-005", to: "ENT-CUS-001", cardinality: "N:1", kind: "for_customer" },
  { from: "ENT-GRP-002", to: "ENT-GRP-001", cardinality: "N:1", kind: "member_of" },
  { from: "ENT-GRP-002", to: "ENT-CUS-001", cardinality: "N:1", kind: "customer" },
  { from: "ENT-GRP-003", to: "ENT-GRP-001", cardinality: "N:1", kind: "of_group" },
  { from: "ENT-CUS-001", to: "ENT-GRP-001", cardinality: "N:0..1", kind: "optional_group" },
  { from: "ENT-LON-001", to: "ENT-CUS-001", cardinality: "N:1", kind: "borrower" },
  { from: "ENT-LON-002", to: "ENT-LON-001", cardinality: "N:1", kind: "repays" },
  { from: "ENT-WDL-001", to: "ENT-CUS-001", cardinality: "N:1", kind: "requested_by" },
  { from: "ENT-WDL-001", to: "ENT-SAV-002", cardinality: "N:0..1", kind: "from_account" },
  { from: "ENT-FIN-003", to: "ENT-FIN-002", cardinality: "N:1", kind: "line_of" },
  { from: "ENT-FIN-002", to: "ENT-FIN-001", cardinality: "M:N", kind: "posts_to" },
  { from: "ENT-FIN-003", to: "ENT-SAV-003", cardinality: "0..1:1", kind: "may_post_from" },
  { from: "ENT-FIN-003", to: "ENT-LON-001", cardinality: "0..N:1", kind: "may_post_from" },
  { from: "ENT-FIN-003", to: "ENT-WDL-001", cardinality: "0..N:1", kind: "may_post_from" },
  { from: "ENT-FIN-004", to: "ENT-ORG-002", cardinality: "N:1", kind: "branch_close" },
  { from: "ENT-PAY-001", to: "ENT-CUS-001", cardinality: "N:0..1", kind: "for_customer" },
  { from: "ENT-PAY-002", to: "ENT-PAY-001", cardinality: "1:1", kind: "external_ref" },
  { from: "ENT-WFK-002", to: "ENT-WFK-001", cardinality: "N:1", kind: "instance_of" },
  { from: "ENT-WFK-003", to: "ENT-WFK-002", cardinality: "N:1", kind: "task_of" },
  { from: "ENT-WFK-004", to: "ENT-WFK-002", cardinality: "0..1:1", kind: "case_of" },
  { from: "ENT-DOC-001", to: "ENT-SAV-003", cardinality: "0..1:1", kind: "receipt_for" },
  { from: "ENT-DOC-001", to: "ENT-CUS-001", cardinality: "N:1", kind: "issued_to" },
  { from: "ENT-DOC-002", to: "ENT-DOC-001", cardinality: "0..N:1", kind: "indexes" },
  { from: "ENT-NTF-001", to: "ENT-CUS-001", cardinality: "N:0..1", kind: "to_customer" },
  { from: "ENT-AUD-001", to: "ENT-IDN-001", cardinality: "N:0..1", kind: "actor" },
  { from: "ENT-SYN-001", to: "ENT-IDN-003", cardinality: "N:0..1", kind: "from_device" },
  { from: "ENT-JOB-002", to: "ENT-JOB-001", cardinality: "N:1", kind: "of_type" },
  { from: "ENT-GWY-002", to: "ENT-GWY-001", cardinality: "N:1", kind: "credential_of" },
  { from: "ENT-RUL-002", to: "ENT-RUL-001", cardinality: "N:1", kind: "evaluates" },
  { from: "ENT-BI-002", to: "ENT-BI-001", cardinality: "M:N", kind: "composed_of" },
  { from: "ENT-INT-002", to: "ENT-INT-001", cardinality: "N:1", kind: "for_provider" },
  { from: "ENT-INT-003", to: "ENT-INT-001", cardinality: "N:1", kind: "routed_via" },
  { from: "ENT-INT-001", to: "ENT-GWY-001", cardinality: "N:0..1", kind: "extends_client" },
  { from: "ENT-AI-003", to: "ENT-AI-001", cardinality: "N:1", kind: "produced_by" },
  { from: "ENT-AI-003", to: "ENT-AI-002", cardinality: "N:0..1", kind: "uses_dataset" },
  { from: "ENT-AI-004", to: "ENT-AI-003", cardinality: "0..1:1", kind: "from_prediction" },
  { from: "ENT-AI-005", to: "ENT-AI-003", cardinality: "N:0..1", kind: "from_prediction" },
  { from: "ENT-AI-004", to: "ENT-SEC-002", cardinality: "0..1:0..1", kind: "may_escalate_to" },
  { from: "ENT-PLT-002", to: "ENT-PLT-001", cardinality: "N:1", kind: "assigned_to" },
  { from: "ENT-PLT-004", to: "ENT-PLT-001", cardinality: "N:0..1", kind: "tenant_scoped" },
  { from: "ENT-PLT-005", to: "ENT-PLT-003", cardinality: "N:1", kind: "in_environment" },
  { from: "ENT-PLT-006", to: "ENT-PLT-003", cardinality: "N:1", kind: "targets_env" },
  { from: "ENT-PLT-001", to: "ENT-ORG-001", cardinality: "0..1:1", kind: "may_map_org" }
]);

export function listCanonicalEntities() {
  return CANONICAL_ENTITIES.map((e) => ({ ...e }));
}

export function getCanonicalEntity(code) {
  const found = CANONICAL_ENTITIES.find((e) => e.code === code);
  return found ? { ...found } : null;
}

export function listAggregateRoots() {
  return CANONICAL_ENTITIES.filter((e) => e.aggregateRoot).map((e) => ({ ...e }));
}

/**
 * Assert each entity code has exactly one owning module (registry invariant).
 * @throws {Error} if duplicate codes or missing/invalid owners
 */
export function assertSingleOwner(entities = CANONICAL_ENTITIES) {
  const byCode = new Map();
  for (const entity of entities) {
    if (!entity.code) throw new Error("ECDM entity missing code");
    if (byCode.has(entity.code)) {
      throw new Error(`Duplicate ECDM entity code: ${entity.code}`);
    }
    byCode.set(entity.code, entity);
    const owner = Number(entity.owningModuleId);
    if (!Number.isInteger(owner) || owner < 1 || owner > 30) {
      throw new Error(`Invalid owning module for ${entity.code}: ${entity.owningModuleId}`);
    }
  }
  return { ok: true, count: byCode.size };
}

export function validateDomainRegistry(options = {}) {
  const entities = options.entities || CANONICAL_ENTITIES;
  const relationships = options.relationships || CANONICAL_RELATIONSHIPS;
  const errors = [];

  const codes = entities.map((e) => e.code);
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    errors.push(`Duplicate entity codes: ${[...new Set(dupes)].join(", ")}`);
  }

  for (const entity of entities) {
    if (!entity.code || !/^ENT-[A-Z]{2,4}-\d{3}$/.test(entity.code)) {
      errors.push(`Bad entity code format: ${entity.code}`);
    }
    if (!entity.name) errors.push(`Missing name for ${entity.code}`);
    const owner = Number(entity.owningModuleId);
    if (!Number.isInteger(owner) || owner < 1 || owner > 30) {
      errors.push(`${entity.code} must have exactly one owning module in 1–30`);
    }
    if (!CLASSIFICATIONS.includes(entity.classification)) {
      errors.push(`${entity.code} invalid classification: ${entity.classification}`);
    }
  }

  try {
    assertSingleOwner(entities);
  } catch (err) {
    errors.push(err.message);
  }

  const codeSet = new Set(codes);
  for (const rel of relationships) {
    if (!codeSet.has(rel.from)) errors.push(`Orphan relationship from: ${rel.from}`);
    if (!codeSet.has(rel.to)) errors.push(`Orphan relationship to: ${rel.to}`);
  }

  const roots = entities.filter((e) => e.aggregateRoot);
  for (const root of roots) {
    if (!codeSet.has(root.code)) errors.push(`Aggregate root not in catalog: ${root.code}`);
  }

  for (const code of MONEY_TRANSACTION_ENTITY_CODES) {
    const entity = entities.find((e) => e.code === code);
    if (!entity) {
      errors.push(`Money entity missing from catalog: ${code}`);
      continue;
    }
    if (FORBIDDEN_MONEY_OWNERS.includes(Number(entity.owningModuleId))) {
      errors.push(
        `Money/transaction entity ${code} must not be owned by Module ${entity.owningModuleId} (AI/Integration/Platform)`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    entityCount: entities.length,
    aggregateRootCount: roots.length,
    relationshipCount: relationships.length,
    version: ECDM_VERSION
  };
}
