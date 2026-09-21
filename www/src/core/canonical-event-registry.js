/**
 * Phase 5 — ECECMS machine-readable event registry.
 * Curated events from module-contracts kind:"event" + publishDomainEvent names.
 * Does not redefine entities, SMs, APIs, money math, RBAC, or posting.
 */
import { getContract, CONTRACT_CATALOG } from "./module-contracts.js";
import { getCanonicalEntity } from "./canonical-domain-registry.js";
import { getStateMachine } from "./canonical-state-machine-registry.js";

export const ECECMS_VERSION = "1.0.0";
export const ECECMS_STATUS = "Authoritative";
export const EVENT_TYPES = Object.freeze(["Domain", "Integration", "Operational", "Security", "Audit", "Platform"]);
export const DELIVERY_GUARANTEES = Object.freeze(["at-most-once", "at-least-once", "exactly-once"]);
export const EVENT_CLASSIFICATIONS = Object.freeze(["Public", "Internal", "Confidential", "Restricted"]);
export const EVENT_LIFECYCLE = Object.freeze(["draft", "active", "deprecated", "retired"]);
export const EVENT_SCHEMA = Object.freeze({
  $id: "ececms.event",
  type: "object",
  required: ["id", "name", "type", "owningModule", "producers", "consumers", "deliveryGuarantee", "version", "topic", "classification", "payloadSchemaRef", "metadataSchemaRef"]
});

const META = "api-schema.standardEvent";
const PAYLOAD = "domainEvents.payload";

/** Compact enrichment keyed by contract event name. */
const ENRICH = {
  UserAuthenticated: { id: "EVT-IDN-001", type: "Security", entityId: "ENT-IDN-001", stateMachineId: "SM-IDN-001", triggerTransition: "login", consumers: [13, 19, 22], topic: "identity.user.authenticated", classification: "Confidential" },
  PasswordChanged: { id: "EVT-IDN-002", type: "Security", entityId: "ENT-IDN-001", consumers: [13, 22], topic: "identity.user.password_changed", classification: "Restricted" },
  DeviceRegistered: { id: "EVT-IDN-003", type: "Security", entityId: "ENT-IDN-003", consumers: [13, 22, 15], topic: "identity.device.registered", classification: "Confidential" },
  CustomerCreated: { id: "EVT-CUS-001", type: "Domain", entityId: "ENT-CUS-001", stateMachineId: "SM-CUS-001", triggerTransition: "create", consumers: [13, 12, 27], topic: "customer.created", classification: "Confidential" },
  CustomerUpdated: { id: "EVT-CUS-002", type: "Domain", entityId: "ENT-CUS-001", stateMachineId: "SM-CUS-001", consumers: [13, 27], topic: "customer.updated", classification: "Confidential" },
  CustomerSuspended: { id: "EVT-CUS-003", type: "Domain", entityId: "ENT-CUS-001", stateMachineId: "SM-CUS-001", triggerTransition: "suspend", consumers: [13, 12, 22, 19], topic: "customer.suspended", classification: "Confidential" },
  CustomerClosed: { id: "EVT-CUS-004", type: "Domain", entityId: "ENT-CUS-001", stateMachineId: "SM-CUS-001", triggerTransition: "close", consumers: [13, 12, 27], topic: "customer.closed", classification: "Confidential" },
  AgentCreated: { id: "EVT-ORG-001", type: "Domain", entityId: "ENT-ORG-003", consumers: [13, 19], topic: "agent.created", classification: "Confidential" },
  AgentSuspended: { id: "EVT-ORG-002", type: "Domain", entityId: "ENT-ORG-003", consumers: [13, 22, 19], topic: "agent.suspended", classification: "Confidential" },
  BranchCreated: { id: "EVT-ORG-003", type: "Domain", entityId: "ENT-ORG-002", consumers: [13, 14], topic: "branch.created", classification: "Internal" },
  SavingsCollected: { id: "EVT-SAV-001", type: "Domain", entityId: "ENT-SAV-003", stateMachineId: "SM-SAV-002", triggerTransition: "post", consumers: [13, 10, 12, 17, 27], topic: "savings.collected", classification: "Restricted" },
  SavingsAdjusted: { id: "EVT-SAV-002", type: "Domain", entityId: "ENT-SAV-003", stateMachineId: "SM-SAV-002", consumers: [13, 10, 22], topic: "savings.adjusted", classification: "Restricted" },
  SavingsCancelled: { id: "EVT-SAV-003", type: "Domain", entityId: "ENT-SAV-003", stateMachineId: "SM-SAV-002", triggerTransition: "cancel", consumers: [13, 10, 19], topic: "savings.cancelled", classification: "Restricted" },
  GroupCreated: { id: "EVT-GRP-001", type: "Domain", entityId: "ENT-GRP-001", stateMachineId: "SM-GRP-001", triggerTransition: "create", consumers: [13, 12], topic: "group.created", classification: "Confidential" },
  MemberAdded: { id: "EVT-GRP-002", type: "Domain", entityId: "ENT-GRP-002", stateMachineId: "SM-GRP-002", consumers: [13, 12], topic: "group.member_added", classification: "Confidential" },
  ContributionRecorded: { id: "EVT-GRP-003", type: "Domain", entityId: "ENT-GRP-003", stateMachineId: "SM-GRP-003", consumers: [13, 10, 27], topic: "group.contribution_recorded", classification: "Restricted" },
  LoanApproved: { id: "EVT-LON-001", type: "Domain", entityId: "ENT-LON-001", stateMachineId: "SM-LON-001", triggerTransition: "Pending->Approved", consumers: [13, 12, 23, 27], topic: "loan.approved", classification: "Restricted" },
  LoanDisbursed: { id: "EVT-LON-002", type: "Domain", entityId: "ENT-LON-001", stateMachineId: "SM-LON-001", triggerTransition: "Approved->Disbursed", consumers: [13, 10, 16, 12, 17], topic: "loan.disbursed", classification: "Restricted" },
  LoanRepaymentReceived: { id: "EVT-LON-003", type: "Domain", entityId: "ENT-LON-002", stateMachineId: "SM-LON-001", consumers: [13, 10, 16, 27], topic: "loan.repayment_received", classification: "Restricted" },
  LoanClosed: { id: "EVT-LON-004", type: "Domain", entityId: "ENT-LON-001", stateMachineId: "SM-LON-001", triggerTransition: "Active->Completed", consumers: [13, 12, 27], topic: "loan.closed", classification: "Restricted" },
  WithdrawalRequested: { id: "EVT-WDL-001", type: "Domain", entityId: "ENT-WDL-001", stateMachineId: "SM-WDL-001", triggerTransition: "request", consumers: [13, 23, 22], topic: "withdrawal.requested", classification: "Restricted" },
  WithdrawalApproved: { id: "EVT-WDL-002", type: "Domain", entityId: "ENT-WDL-001", stateMachineId: "SM-WDL-001", triggerTransition: "approve", consumers: [13, 12, 16], topic: "withdrawal.approved", classification: "Restricted" },
  WithdrawalCompleted: { id: "EVT-WDL-003", type: "Domain", entityId: "ENT-WDL-001", stateMachineId: "SM-WDL-001", triggerTransition: "execute", consumers: [13, 10, 17, 27], topic: "withdrawal.completed", classification: "Restricted" },
  JournalPosted: { id: "EVT-FIN-001", type: "Domain", entityId: "ENT-FIN-002", stateMachineId: "SM-FIN-001", triggerTransition: "post", consumers: [13, 27, 19], topic: "accounting.journal_posted", classification: "Restricted" },
  JournalReversed: { id: "EVT-FIN-002", type: "Domain", entityId: "ENT-FIN-002", stateMachineId: "SM-FIN-001", triggerTransition: "reverse", consumers: [13, 22, 19], topic: "accounting.journal_reversed", classification: "Restricted" },
  AccountingPeriodClosed: { id: "EVT-FIN-003", type: "Domain", entityId: "ENT-FIN-004", stateMachineId: "SM-FIN-002", triggerTransition: "close", consumers: [13, 27, 30], topic: "accounting.period_closed", classification: "Internal" },
  ReportGenerated: { id: "EVT-RPT-001", type: "Operational", consumers: [13, 12], topic: "reports.generated", classification: "Internal" },
  NotificationQueued: { id: "EVT-NTF-001", type: "Operational", entityId: "ENT-NTF-001", consumers: [13, 19], topic: "notification.queued", classification: "Internal" },
  NotificationDelivered: { id: "EVT-NTF-002", type: "Operational", entityId: "ENT-NTF-001", consumers: [13, 19], topic: "notification.delivered", classification: "Internal" },
  AuditRecorded: { id: "EVT-AUD-001", type: "Audit", entityId: "ENT-AUD-001", consumers: [19, 22], topic: "audit.recorded", classification: "Restricted" },
  ConfigurationChanged: { id: "EVT-CFG-001", type: "Platform", entityId: "ENT-CFG-001", stateMachineId: "SM-CFG-001", consumers: [13, 19, 30], topic: "config.changed", classification: "Internal" },
  FeatureFlagUpdated: { id: "EVT-CFG-002", type: "Platform", entityId: "ENT-CFG-001", consumers: [13, 19, 30], topic: "config.feature_flag_updated", classification: "Internal" },
  SynchronizationCompleted: { id: "EVT-SYN-001", type: "Operational", entityId: "ENT-SYN-001", stateMachineId: "SM-SYN-001", consumers: [13, 19], topic: "sync.completed", classification: "Internal" },
  SynchronizationFailed: { id: "EVT-SYN-002", type: "Operational", entityId: "ENT-SYN-001", stateMachineId: "SM-SYN-001", consumers: [13, 19, 22], topic: "sync.failed", classification: "Internal" },
  PaymentCompleted: { id: "EVT-PAY-001", type: "Domain", entityId: "ENT-PAY-001", stateMachineId: "SM-PAY-001", triggerTransition: "processing->completed", consumers: [13, 10, 12, 17, 28], topic: "payment.completed", classification: "Restricted" },
  PaymentFailed: { id: "EVT-PAY-002", type: "Domain", entityId: "ENT-PAY-001", stateMachineId: "SM-PAY-001", triggerTransition: "->failed", consumers: [13, 12, 19, 22], topic: "payment.failed", classification: "Restricted" },
  PaymentReversed: { id: "EVT-PAY-003", type: "Domain", entityId: "ENT-PAY-001", stateMachineId: "SM-PAY-001", triggerTransition: "completed->fully_reversed", consumers: [13, 10, 22], topic: "payment.reversed", classification: "Restricted" },
  ReceiptIssued: { id: "EVT-DOC-001", type: "Domain", entityId: "ENT-DOC-001", stateMachineId: "SM-DOC-001", consumers: [13, 12], topic: "document.receipt_issued", classification: "Confidential" },
  StatementGenerated: { id: "EVT-DOC-002", type: "Domain", entityId: "ENT-DOC-001", consumers: [13, 12], topic: "document.statement_generated", classification: "Confidential" },
  DocumentSigned: { id: "EVT-DOC-003", type: "Domain", entityId: "ENT-DOC-001", stateMachineId: "SM-DOC-001", consumers: [13, 22], topic: "document.signed", classification: "Restricted" },
  JobCompleted: { id: "EVT-JOB-001", type: "Operational", entityId: "ENT-JOB-002", stateMachineId: "SM-JOB-001", triggerTransition: "->completed", consumers: [13, 19], topic: "scheduler.job_completed", classification: "Internal" },
  JobFailed: { id: "EVT-JOB-002", type: "Operational", entityId: "ENT-JOB-002", stateMachineId: "SM-JOB-001", triggerTransition: "->failed", consumers: [13, 19, 22], topic: "scheduler.job_failed", classification: "Internal" },
  AlertRaised: { id: "EVT-MON-001", type: "Operational", entityId: "ENT-MON-002", stateMachineId: "SM-MON-001", triggerTransition: "detect", consumers: [13, 12, 22], topic: "monitoring.alert_raised", classification: "Internal" },
  AlertResolved: { id: "EVT-MON-002", type: "Operational", entityId: "ENT-MON-002", stateMachineId: "SM-MON-001", triggerTransition: "close", consumers: [13], topic: "monitoring.alert_resolved", classification: "Internal" },
  HealthStatusChanged: { id: "EVT-MON-003", type: "Operational", entityId: "ENT-MON-001", consumers: [13, 30], topic: "monitoring.health_changed", classification: "Internal" },
  ClientRegistered: { id: "EVT-GWY-001", type: "Integration", entityId: "ENT-GWY-001", consumers: [13, 22, 28], topic: "gateway.client_registered", classification: "Confidential" },
  APIKeyRevoked: { id: "EVT-GWY-002", type: "Security", entityId: "ENT-GWY-002", consumers: [13, 22, 19], topic: "gateway.api_key_revoked", classification: "Restricted" },
  BackupCompleted: { id: "EVT-BKP-001", type: "Operational", entityId: "ENT-BKP-001", stateMachineId: "SM-BKP-001", consumers: [13, 19, 30], topic: "backup.completed", classification: "Restricted" },
  RestoreCompleted: { id: "EVT-BKP-002", type: "Operational", entityId: "ENT-BKP-001", stateMachineId: "SM-BKP-002", consumers: [13, 19, 22, 30], topic: "backup.restore_completed", classification: "Restricted" },
  FraudDetected: { id: "EVT-SEC-001", type: "Security", entityId: "ENT-SEC-002", stateMachineId: "SM-SEC-002", triggerTransition: "detect", consumers: [13, 19, 12, 23], topic: "security.fraud_detected", classification: "Restricted", sourceRef: "security-ops.publishDomainEvent" },
  RiskScoreUpdated: { id: "EVT-SEC-002", type: "Security", entityId: "ENT-SEC-002", consumers: [13, 19, 8], topic: "security.risk_score_updated", classification: "Restricted", sourceRef: "security-ops.publishDomainEvent" },
  SecurityIncidentOpened: { id: "EVT-SEC-003", type: "Security", entityId: "ENT-SEC-001", stateMachineId: "SM-SEC-001", triggerTransition: "open", consumers: [13, 19, 12, 30], topic: "security.incident_opened", classification: "Restricted", sourceRef: "security-ops.publishDomainEvent" },
  SecurityIncidentClosed: { id: "EVT-SEC-004", type: "Security", entityId: "ENT-SEC-001", stateMachineId: "SM-SEC-001", triggerTransition: "close", consumers: [13], topic: "security.incident_closed", classification: "Restricted", sourceRef: "security-ops.publishDomainEvent" },
  WorkflowStarted: { id: "EVT-WFK-001", type: "Domain", entityId: "ENT-WFK-002", stateMachineId: "SM-WFK-002", triggerTransition: "start", consumers: [13, 19], topic: "workflow.started", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  WorkflowCompleted: { id: "EVT-WFK-002", type: "Domain", entityId: "ENT-WFK-002", stateMachineId: "SM-WFK-002", triggerTransition: "->completed", consumers: [13, 19, 12], topic: "workflow.completed", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  WorkflowFailed: { id: "EVT-WFK-003", type: "Domain", entityId: "ENT-WFK-002", stateMachineId: "SM-WFK-002", consumers: [13, 19, 22], topic: "workflow.failed", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  WorkflowCancelled: { id: "EVT-WFK-004", type: "Domain", entityId: "ENT-WFK-002", stateMachineId: "SM-WFK-002", triggerTransition: "->cancelled", consumers: [13, 19], topic: "workflow.cancelled", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  WorkflowTaskCompleted: { id: "EVT-WFK-005", type: "Domain", entityId: "ENT-WFK-003", stateMachineId: "SM-WFK-003", triggerTransition: "->completed", consumers: [13, 19], topic: "workflow.task_completed", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  WorkflowApproved: { id: "EVT-WFK-006", type: "Domain", entityId: "ENT-WFK-002", stateMachineId: "SM-WFK-002", consumers: [13, 12], topic: "workflow.approved", classification: "Internal", sourceRef: "workflow-ops.emitWorkflowEvent" },
  RuleEvaluated: { id: "EVT-RUL-001", type: "Domain", entityId: "ENT-RUL-001", stateMachineId: "SM-RUL-001", consumers: [13, 19, 23], topic: "rules.evaluated", classification: "Internal" },
  RulePublished: { id: "EVT-RUL-002", type: "Domain", entityId: "ENT-RUL-001", stateMachineId: "SM-RUL-001", triggerTransition: "publish", consumers: [13, 19, 30], topic: "rules.published", classification: "Internal" },
  RuleApproved: { id: "EVT-RUL-003", type: "Domain", entityId: "ENT-RUL-001", stateMachineId: "SM-RUL-001", consumers: [13], topic: "rules.approved", classification: "Internal" },
  ImportCompleted: { id: "EVT-XCH-001", type: "Integration", entityId: "ENT-XCH-001", stateMachineId: "SM-XCH-001", consumers: [13, 19, 28], topic: "exchange.import_completed", classification: "Confidential" },
  ExportCompleted: { id: "EVT-XCH-002", type: "Integration", entityId: "ENT-XCH-001", stateMachineId: "SM-XCH-001", consumers: [13, 19, 28], topic: "exchange.export_completed", classification: "Confidential" },
  RecordUploaded: { id: "EVT-REC-001", type: "Domain", entityId: "ENT-DOC-002", stateMachineId: "SM-DOC-004", consumers: [13, 19], topic: "records.uploaded", classification: "Confidential" },
  RecordArchived: { id: "EVT-REC-002", type: "Domain", entityId: "ENT-DOC-002", stateMachineId: "SM-DOC-004", triggerTransition: "archive", consumers: [13], topic: "records.archived", classification: "Confidential" },
  KpiPublished: { id: "EVT-BI-001", type: "Operational", entityId: "ENT-BI-002", stateMachineId: "SM-BI-001", triggerTransition: "publish", consumers: [13, 2, 19], topic: "bi.kpi_published", classification: "Internal" },
  MetricRegistered: { id: "EVT-BI-002", type: "Operational", entityId: "ENT-BI-001", consumers: [13], topic: "bi.metric_registered", classification: "Internal" },
  ProviderRegistered: { id: "EVT-INT-001", type: "Integration", entityId: "ENT-INT-001", stateMachineId: "SM-INT-001", triggerTransition: "register", consumers: [13, 19, 20], topic: "integration.provider_registered", classification: "Internal", sourceRef: "integration-ops.emitIntEvent" },
  WebhookRegistered: { id: "EVT-INT-002", type: "Integration", entityId: "ENT-INT-002", stateMachineId: "SM-INT-002", consumers: [13, 20], topic: "integration.webhook_registered", classification: "Internal", sourceRef: "integration-ops.emitIntEvent" },
  IntegrationDispatched: { id: "EVT-INT-003", type: "Integration", entityId: "ENT-INT-003", stateMachineId: "SM-INT-004", consumers: [13, 19, 20], topic: "integration.dispatched", classification: "Confidential", sourceRef: "integration-ops.emitIntEvent" },
  PredictionGenerated: { id: "EVT-AI-001", type: "Operational", entityId: "ENT-AI-003", consumers: [13, 19, 22], topic: "ai.prediction_generated", classification: "Confidential", sourceRef: "ai-ops.emitAiEvent" },
  FraudAlertCreated: { id: "EVT-AI-002", type: "Security", entityId: "ENT-AI-005", consumers: [13, 22, 19, 12], topic: "ai.fraud_alert_created", classification: "Restricted", sourceRef: "ai-ops.emitAiEvent" },
  ModelDeployed: { id: "EVT-AI-003", type: "Platform", entityId: "ENT-AI-001", stateMachineId: "SM-AI-001", triggerTransition: "deploy", consumers: [13, 19, 30], topic: "ai.model_deployed", classification: "Internal", sourceRef: "ai-ops.emitAiEvent" },
  DriftDetected: { id: "EVT-AI-004", type: "Operational", entityId: "ENT-AI-001", stateMachineId: "SM-AI-001", consumers: [13, 19, 22], topic: "ai.drift_detected", classification: "Internal", sourceRef: "ai-ops.emitAiEvent" },
  TenantSuspended: { id: "EVT-PLT-001", type: "Platform", entityId: "ENT-PLT-001", stateMachineId: "SM-PLT-001", triggerTransition: "suspend", consumers: [13, 19, 22, 12], topic: "platform.tenant_suspended", classification: "Restricted", sourceRef: "platform-ops.emitPlatformEvent" },
  FeatureFlagKilled: { id: "EVT-PLT-002", type: "Platform", entityId: "ENT-PLT-004", stateMachineId: "SM-PLT-005", consumers: [13, 19], topic: "platform.feature_flag_killed", classification: "Internal", sourceRef: "platform-ops.emitPlatformEvent" },
  MaintenanceStarted: { id: "EVT-PLT-003", type: "Platform", entityId: "ENT-PLT-005", stateMachineId: "SM-PLT-004", triggerTransition: "start", consumers: [13, 19, 12], topic: "platform.maintenance_started", classification: "Internal", sourceRef: "platform-ops.emitPlatformEvent" },
  LicenseExpired: { id: "EVT-PLT-004", type: "Platform", entityId: "ENT-PLT-002", stateMachineId: "SM-PLT-002", consumers: [13, 19, 22], topic: "platform.license_expired", classification: "Restricted", sourceRef: "platform-ops.emitPlatformEvent" }
};

function buildEvents() {
  const rows = [];
  for (const [name, meta] of Object.entries(ENRICH)) {
    const contract = getContract(name);
    if (!contract || contract.kind !== "event") {
      throw new Error(`ECECMS enrichment references missing event contract: ${name}`);
    }
    rows.push(Object.freeze({
      id: meta.id,
      name,
      type: meta.type,
      owningModule: Number(contract.moduleId),
      entityId: meta.entityId,
      stateMachineId: meta.stateMachineId,
      triggerTransition: meta.triggerTransition,
      producers: [Number(contract.moduleId)],
      consumers: meta.consumers || [13, 19],
      deliveryGuarantee: "at-least-once",
      version: contract.version || "1.0.0",
      topic: meta.topic,
      channel: "in-process.domainEvents",
      classification: meta.classification || "Internal",
      payloadSchemaRef: PAYLOAD,
      metadataSchemaRef: META,
      lifecycle: contract.status === "retired" ? "retired" : "active",
      sourceRef: meta.sourceRef || `module-contracts / ${contract.owner}`
    }));
  }
  return Object.freeze(rows);
}

export const CANONICAL_EVENTS = buildEvents();

export function listCanonicalEvents(filter = {}) {
  let rows = [...CANONICAL_EVENTS];
  if (filter.owningModule != null) rows = rows.filter((e) => Number(e.owningModule) === Number(filter.owningModule));
  if (filter.type) rows = rows.filter((e) => e.type === filter.type);
  if (filter.entityId) rows = rows.filter((e) => e.entityId === filter.entityId);
  if (filter.stateMachineId) rows = rows.filter((e) => e.stateMachineId === filter.stateMachineId);
  return rows;
}

export function getCanonicalEvent(idOrName) {
  const key = String(idOrName || "");
  return CANONICAL_EVENTS.find((e) => e.id === key || e.name === key) || null;
}

export function eventsForEntity(entityId) {
  return CANONICAL_EVENTS.filter((e) => e.entityId === entityId);
}

export function eventsForStateMachine(stateMachineId) {
  return CANONICAL_EVENTS.filter((e) => e.stateMachineId === stateMachineId);
}

export function validateEventRegistry(options = {}) {
  const events = options.events || CANONICAL_EVENTS;
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const names = new Set();

  for (const event of events) {
    if (!event.id || !/^EVT-[A-Z]{2,4}-\d{3}$/.test(event.id)) errors.push(`Invalid event id: ${event.id}`);
    if (ids.has(event.id)) errors.push(`Duplicate event id: ${event.id}`);
    ids.add(event.id);
    if (!event.name) errors.push(`${event.id}: missing name`);
    if (names.has(event.name)) errors.push(`Duplicate event name: ${event.name}`);
    names.add(event.name);
    if (!EVENT_TYPES.includes(event.type)) errors.push(`${event.id}: invalid type ${event.type}`);
    if (!DELIVERY_GUARANTEES.includes(event.deliveryGuarantee)) errors.push(`${event.id}: invalid deliveryGuarantee`);
    if (!EVENT_CLASSIFICATIONS.includes(event.classification)) errors.push(`${event.id}: invalid classification`);
    const owner = Number(event.owningModule);
    if (!Number.isInteger(owner) || owner < 1 || owner > 30) errors.push(`${event.id}: owningModule out of range`);
    if (!Array.isArray(event.producers) || !event.producers.includes(owner)) errors.push(`${event.id}: producers must include owningModule`);
    const contract = getContract(event.name);
    if (!contract) errors.push(`${event.id}: name ${event.name} not in CONTRACT_CATALOG`);
    else if (contract.kind !== "event") errors.push(`${event.id}: contract ${event.name} is kind=${contract.kind}`);
    else if (Number(contract.moduleId) !== owner) errors.push(`${event.id}: owningModule mismatch`);
    if (event.entityId && !getCanonicalEntity(event.entityId)) errors.push(`${event.id}: orphan entityId ${event.entityId}`);
    if (event.stateMachineId) {
      const sm = getStateMachine(event.stateMachineId);
      if (!sm) errors.push(`${event.id}: orphan stateMachineId ${event.stateMachineId}`);
      else if (event.entityId && sm.entityId !== event.entityId) {
        warnings.push(`${event.id}: SM entity ${sm.entityId} != event entity ${event.entityId}`);
      }
    }
    if (!event.topic) errors.push(`${event.id}: missing topic`);
    if (!event.payloadSchemaRef) errors.push(`${event.id}: missing payloadSchemaRef`);
    if (!event.metadataSchemaRef) errors.push(`${event.id}: missing metadataSchemaRef`);
  }

  const catalogEvents = CONTRACT_CATALOG.filter((c) => c.kind === "event");
  const covered = new Set(events.map((e) => e.name));
  const uncovered = catalogEvents.filter((c) => !covered.has(c.id)).map((c) => c.id);
  if (uncovered.length) {
    warnings.push(`CONTRACT_CATALOG has ${uncovered.length} event(s) not in curated ECECMS (by design)`);
  }

  return { ok: errors.length === 0, errors, warnings, eventCount: events.length, version: ECECMS_VERSION, schema: EVENT_SCHEMA };
}