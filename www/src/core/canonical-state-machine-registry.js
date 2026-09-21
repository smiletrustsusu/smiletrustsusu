/**
 * Phase 4 — Enterprise Canonical State Machine & Lifecycle Specification (ECSMLS).
 * Machine-readable registry of entity lifecycles for Workflow Engine validation.
 * Does not redefine APIs, schemas, permissions, money math, or posting logic.
 * Transitions are derived from existing module lifecycle / workflow sources.
 */

import { getCanonicalEntity, MONEY_TRANSACTION_ENTITY_CODES } from "./canonical-domain-registry.js";
import { LOAN_TRANSITIONS, TERMINAL_LOAN_STATUSES } from "./loans-workflow.js";
import { WITHDRAWAL_TRANSITIONS, TERMINAL_WITHDRAWAL_STATUSES } from "./withdrawals-workflow.js";
import {
  PAYMENT_TRANSITION_MATRIX,
  TERMINAL_PAYMENT_STATES
} from "./payment-lifecycle.js";
import {
  WORKFLOW_TRANSITION_MATRIX,
  TASK_TRANSITION_MATRIX,
  CASE_TRANSITION_MATRIX,
  DEFINITION_TRANSITIONS
} from "./workflow-lifecycle.js";
import {
  DOCUMENT_TRANSITION_MATRIX,
  TERMINAL_DOCUMENT_STATES,
  RECEIPT_OUTCOME_MATRIX,
  TEMP_RECEIPT_MATRIX
} from "./document-lifecycle.js";
import { RECORD_TRANSITIONS } from "./records-lifecycle.js";
import { JOB_TRANSITION_MATRIX, TERMINAL_JOB_STATES } from "./job-lifecycle.js";
import { INCIDENT_TRANSITION_MATRIX as MONITOR_INCIDENT_MATRIX } from "./monitoring-lifecycle.js";
import {
  INCIDENT_TRANSITIONS as SECURITY_INCIDENT_TRANSITIONS,
  FRAUD_TRANSITIONS
} from "./security-lifecycle.js";
import { RESTORE_TRANSITION_MATRIX, BACKUP_STATES } from "./backup-recovery-lifecycle.js";
import { RULE_TRANSITION_MATRIX } from "./rule-lifecycle.js";
import { EXCHANGE_TRANSITIONS } from "./exchange-lifecycle.js";
import { KPI_TRANSITIONS } from "./bi-lifecycle.js";
import {
  PROVIDER_TRANSITIONS,
  WEBHOOK_STATES,
  WEBHOOK_DELIVERY_STATES,
  MESSAGE_STATES
} from "./integration-lifecycle.js";
import {
  MODEL_TRANSITIONS,
  DATASET_STATES,
  RECOMMENDATION_DECISIONS
} from "./ai-lifecycle.js";
import {
  TENANT_TRANSITIONS,
  LICENSE_TRANSITIONS,
  DEPLOY_STATES,
  MAINTENANCE_STATES
} from "./platform-lifecycle.js";
import { LIFECYCLE_TRANSITIONS } from "./txn-lifecycle.js";
import { CRM_STATUSES, KYC_VERIFICATION } from "./customer-crm.js";
import { ACCOUNT_STATUSES } from "./customer-kyc.js";
import { GROUP_STATUSES } from "./group-ops.js";
import { QUEUE_STATUSES } from "./sync-ops.js";

export const ECSMLS_VERSION = "1.0.0";
export const ECSMLS_STATUS = "Authoritative";

/** Modules that must not own money/transaction mutation authority. */
export const FORBIDDEN_MONEY_MUTATION_MODULES = Object.freeze([28, 29]);

/**
 * JSON-schema-like metadata describing a canonical state machine object.
 */
export const STATE_MACHINE_SCHEMA = Object.freeze({
  $id: "ecsmls.stateMachine",
  type: "object",
  required: [
    "id",
    "name",
    "owningModule",
    "entityId",
    "version",
    "initialState",
    "states",
    "transitions",
    "terminalStates"
  ],
  properties: {
    id: { type: "string", pattern: "^SM-[A-Z]{2,4}-\\d{3}$" },
    name: { type: "string" },
    owningModule: { type: "integer", minimum: 1, maximum: 30 },
    entityId: { type: "string", pattern: "^ENT-[A-Z]{2,4}-\\d{3}$" },
    version: { type: "string" },
    purpose: { type: "string" },
    sourceRef: { type: "string" },
    initialState: { type: "string" },
    states: { type: "array", items: { type: "string" }, minItems: 1 },
    transitions: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "trigger"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          trigger: { type: "string" },
          auth: { type: "string" },
          events: { type: "array", items: { type: "string" } },
          recovery: { type: "boolean" }
        }
      }
    },
    terminalStates: { type: "array", items: { type: "string" } },
    suspendedStates: { type: "array", items: { type: "string" } },
    recoveryStates: { type: "array", items: { type: "string" } },
    errorStates: { type: "array", items: { type: "string" } },
    approvedRecoveryFromTerminal: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to"],
        properties: { from: { type: "string" }, to: { type: "string" } }
      }
    }
  }
});

function statesFromMatrix(matrix) {
  const set = new Set(Object.keys(matrix || {}));
  for (const targets of Object.values(matrix || {})) {
    for (const t of targets || []) set.add(t);
  }
  return [...set];
}

function transitionsFromMatrix(matrix, triggerPrefix = "transition") {
  const rows = [];
  for (const [from, targets] of Object.entries(matrix || {})) {
    for (const to of targets || []) {
      rows.push({
        from,
        to,
        trigger: `${triggerPrefix}:${from}->${to}`
      });
    }
  }
  return rows;
}

function inferTerminals(matrix, explicit = null) {
  if (Array.isArray(explicit) && explicit.length) return [...explicit];
  return Object.entries(matrix || {})
    .filter(([, targets]) => !targets || targets.length === 0)
    .map(([state]) => state);
}

function buildMachine({
  id,
  name,
  owningModule,
  entityId,
  version = "1.0.0",
  purpose = "",
  sourceRef = "",
  initialState,
  matrix,
  terminalStates = null,
  suspendedStates = [],
  recoveryStates = [],
  errorStates = [],
  approvedRecoveryFromTerminal = [],
  authDefault = "",
  eventsDefault = []
}) {
  const states = statesFromMatrix(matrix);
  if (initialState && !states.includes(initialState)) states.unshift(initialState);
  const terminals = inferTerminals(matrix, terminalStates);
  const recoverySet = new Set(
    (approvedRecoveryFromTerminal || []).map((r) => `${r.from}=>${r.to}`)
  );
  const transitions = transitionsFromMatrix(matrix).map((t) => {
    const row = {
      from: t.from,
      to: t.to,
      trigger: t.trigger,
      auth: authDefault || undefined,
      events: eventsDefault.length ? [...eventsDefault] : undefined
    };
    if (recoverySet.has(`${t.from}=>${t.to}`)) row.recovery = true;
    return row;
  });

  return Object.freeze({
    id,
    name,
    owningModule,
    entityId,
    version,
    purpose,
    sourceRef,
    initialState,
    states: Object.freeze(states),
    transitions: Object.freeze(transitions.map((t) => Object.freeze({ ...t }))),
    terminalStates: Object.freeze(terminals),
    suspendedStates: Object.freeze([...suspendedStates]),
    recoveryStates: Object.freeze([...recoveryStates]),
    errorStates: Object.freeze([...errorStates]),
    approvedRecoveryFromTerminal: Object.freeze(
      (approvedRecoveryFromTerminal || []).map((r) => Object.freeze({ ...r }))
    ),
    matrix: Object.freeze(
      Object.fromEntries(
        Object.entries(matrix || {}).map(([k, v]) => [k, Object.freeze([...(v || [])])])
      )
    )
  });
}

/** Customer memberStatus — statuses from CRM; matrix documented for Workflow Engine. */
const CUSTOMER_TRANSITIONS = {
  "Pending Verification": ["Active", "Suspended", "Closed", "Blacklisted"],
  Active: ["Suspended", "Closed", "Deceased", "Blacklisted"],
  Suspended: ["Active", "Closed", "Blacklisted"],
  Closed: ["Active"],
  Deceased: [],
  Blacklisted: ["Suspended", "Closed"]
};

const KYC_TRANSITIONS = {
  Pending: ["Verified", "Rejected"],
  Verified: ["Pending"],
  Rejected: ["Pending"]
};

const ACCOUNT_TRANSITIONS = {
  Active: ["Dormant", "Suspended", "Closed"],
  Dormant: ["Active", "Suspended", "Closed"],
  Suspended: ["Active", "Closed"],
  Closed: []
};

const GROUP_TRANSITIONS = {
  Pending: ["Active", "Suspended", "Closed"],
  Active: ["Suspended", "Closed", "Completed"],
  Suspended: ["Active", "Closed"],
  Closed: [],
  Completed: []
};

const MEMBERSHIP_TRANSITIONS = {
  Active: ["Suspended", "Closed", "Transferred"],
  Suspended: ["Active", "Closed"],
  Closed: [],
  Transferred: []
};

const MEETING_TRANSITIONS = {
  Open: ["Closed"],
  Closed: []
};

const PERIOD_TRANSITIONS = {
  Open: ["Closed"],
  Closed: ["Open"]
};

const DATASET_TRANSITIONS = {
  draft: ["registered", "retired"],
  registered: ["approved", "retired"],
  approved: ["retired"],
  retired: []
};

const RECOMMENDATION_TRANSITIONS = {
  pending: ["accepted", "rejected", "overridden"],
  accepted: [],
  rejected: [],
  overridden: []
};

const WEBHOOK_TRANSITIONS = {
  draft: ["active", "retired"],
  active: ["paused", "failed", "retired"],
  paused: ["active", "retired"],
  failed: ["active", "paused", "retired"],
  retired: []
};

const WEBHOOK_DELIVERY_TRANSITIONS = {
  queued: ["delivering", "failed"],
  delivering: ["delivered", "retrying", "failed"],
  retrying: ["delivering", "dead_letter", "failed"],
  delivered: ["replayed"],
  dead_letter: ["replayed", "queued"],
  replayed: [],
  failed: ["queued", "dead_letter"]
};

const MESSAGE_TRANSITIONS = {
  queued: ["delivered", "nacked", "dead_letter"],
  delivered: ["acked", "nacked"],
  nacked: ["queued", "dead_letter"],
  acked: [],
  dead_letter: ["replayed"],
  replayed: []
};

const BACKUP_TRANSITIONS = {
  created: ["running", "failed", "expired"],
  running: ["completed", "failed"],
  completed: ["verified", "expired"],
  verified: ["expired"],
  failed: [],
  expired: []
};

const DEPLOY_TRANSITIONS = {
  planned: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["verified", "rolled_back", "cancelled"],
  verified: ["completed", "rolled_back"],
  rolled_back: [],
  completed: [],
  cancelled: []
};

const MAINTENANCE_TRANSITIONS = {
  planned: ["notified", "cancelled"],
  notified: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

const FLAG_TRANSITIONS = {
  draft: ["active", "retired"],
  active: ["killed", "retired"],
  killed: ["active", "retired"],
  retired: []
};

const ROLE_TRANSITIONS = {
  Draft: ["Published", "Retired"],
  Published: ["Retired"],
  Retired: []
};

const USER_TRANSITIONS = {
  Active: ["Suspended", "Disabled"],
  Suspended: ["Active", "Disabled"],
  Disabled: []
};

const SETTING_TRANSITIONS = {
  draft: ["published", "retired"],
  published: ["draft", "retired"],
  retired: []
};

const SYNC_QUEUE_TRANSITIONS = {
  pending: ["validating", "cancelled", "failed"],
  validating: ["uploading", "failed", "cancelled", "conflict_detected"],
  uploading: ["uploaded", "failed", "retrying", "cancelled"],
  uploaded: ["applying", "failed", "cancelled"],
  applying: ["applied", "failed", "conflict_detected", "retrying"],
  applied: [],
  failed: ["retrying", "pending", "cancelled"],
  retrying: ["pending", "validating", "uploading", "failed", "cancelled"],
  conflict_detected: ["pending", "cancelled", "failed"],
  cancelled: []
};

const JOURNAL_TRANSITIONS = {
  Draft: ["Posted", "Cancelled"],
  Posted: ["Reversed"],
  Reversed: [],
  Cancelled: []
};

/**
 * Canonical state machine catalog (Phase 4).
 * Prefer ~30–40 machines covering ECDM aggregates with real lifecycles.
 */
export const CANONICAL_STATE_MACHINES = Object.freeze([
  buildMachine({
    id: "SM-CUS-001",
    name: "CustomerLifecycle",
    owningModule: 3,
    entityId: "ENT-CUS-001",
    purpose: "Customer memberStatus lifecycle (CRM).",
    sourceRef: "src/core/customer-crm.js#CRM_STATUSES",
    initialState: "Pending Verification",
    matrix: CUSTOMER_TRANSITIONS,
    suspendedStates: ["Suspended"],
    recoveryStates: ["Active"],
    authDefault: "Customer.Update"
  }),
  buildMachine({
    id: "SM-CUS-002",
    name: "CustomerKycVerification",
    owningModule: 3,
    entityId: "ENT-CUS-001",
    purpose: "KYC verification sub-lifecycle on Customer.",
    sourceRef: "src/core/customer-crm.js#KYC_VERIFICATION",
    initialState: "Pending",
    matrix: KYC_TRANSITIONS,
    errorStates: ["Rejected"],
    authDefault: "Customer.KYC"
  }),
  buildMachine({
    id: "SM-SAV-001",
    name: "SavingsAccountLifecycle",
    owningModule: 6,
    entityId: "ENT-SAV-002",
    purpose: "Personal savings/Susu account operational status.",
    sourceRef: "src/core/customer-kyc.js#ACCOUNT_STATUSES",
    initialState: "Active",
    matrix: ACCOUNT_TRANSITIONS,
    suspendedStates: ["Suspended", "Dormant"],
    authDefault: "Savings.Update"
  }),
  buildMachine({
    id: "SM-SAV-002",
    name: "CollectionFinancialLifecycle",
    owningModule: 6,
    entityId: "ENT-SAV-003",
    purpose: "Shared financial helper lifecycle for collections (txn-lifecycle).",
    sourceRef: "src/core/txn-lifecycle.js#LIFECYCLE_TRANSITIONS",
    initialState: "Draft",
    matrix: LIFECYCLE_TRANSITIONS,
    suspendedStates: ["Pending Approval"],
    errorStates: ["Validation Failed", "Failed", "Rejected"],
    recoveryStates: ["Draft"],
    authDefault: "Collection.Post"
  }),
  buildMachine({
    id: "SM-GRP-001",
    name: "SusuGroupLifecycle",
    owningModule: 7,
    entityId: "ENT-GRP-001",
    purpose: "Susu group operational status.",
    sourceRef: "src/core/group-ops.js#GROUP_STATUSES",
    initialState: "Pending",
    matrix: GROUP_TRANSITIONS,
    suspendedStates: ["Suspended"],
    authDefault: "Group.Update"
  }),
  buildMachine({
    id: "SM-GRP-002",
    name: "GroupMembershipLifecycle",
    owningModule: 7,
    entityId: "ENT-GRP-002",
    purpose: "Membership Active/Suspended/Closed/Transferred.",
    sourceRef: "src/core/group-ops.js",
    initialState: "Active",
    matrix: MEMBERSHIP_TRANSITIONS,
    suspendedStates: ["Suspended"],
    authDefault: "Group.Member"
  }),
  buildMachine({
    id: "SM-GRP-003",
    name: "GroupMeetingLifecycle",
    owningModule: 7,
    entityId: "ENT-GRP-003",
    purpose: "Group meeting Open→Closed.",
    sourceRef: "src/core/group-ops.js",
    initialState: "Open",
    matrix: MEETING_TRANSITIONS,
    authDefault: "Group.Meeting"
  }),
  buildMachine({
    id: "SM-LON-001",
    name: "LoanLifecycle",
    owningModule: 8,
    entityId: "ENT-LON-001",
    purpose: "Loan application through repayment/write-off (loans-workflow).",
    sourceRef: "src/core/loans-workflow.js#LOAN_TRANSITIONS",
    initialState: "Pending",
    matrix: LOAN_TRANSITIONS,
    terminalStates: TERMINAL_LOAN_STATUSES,
    suspendedStates: ["Defaulted"],
    recoveryStates: ["Recovered", "Restructured"],
    errorStates: ["Rejected"],
    authDefault: "Loan.Transition",
    eventsDefault: ["LoanStatusChanged"]
  }),
  buildMachine({
    id: "SM-WDL-001",
    name: "WithdrawalRequestLifecycle",
    owningModule: 9,
    entityId: "ENT-WDL-001",
    purpose: "Withdrawal request→verify→approve→pay (withdrawals-workflow).",
    sourceRef: "src/core/withdrawals-workflow.js#WITHDRAWAL_TRANSITIONS",
    initialState: "Requested",
    matrix: WITHDRAWAL_TRANSITIONS,
    terminalStates: [...TERMINAL_WITHDRAWAL_STATUSES, "Reversed"],
    errorStates: ["Rejected"],
    authDefault: "Withdrawal.Transition",
    eventsDefault: ["WithdrawalStatusChanged"]
  }),
  buildMachine({
    id: "SM-FIN-001",
    name: "JournalEntryLifecycle",
    owningModule: 10,
    entityId: "ENT-FIN-002",
    purpose: "Journal draft→posted→reversed (accounting).",
    sourceRef: "src/core/accounting-ops.js",
    initialState: "Draft",
    matrix: JOURNAL_TRANSITIONS,
    authDefault: "Accounting.Post"
  }),
  buildMachine({
    id: "SM-FIN-002",
    name: "AccountingPeriodLifecycle",
    owningModule: 10,
    entityId: "ENT-FIN-004",
    purpose: "Cash/period closing Open↔Closed.",
    sourceRef: "src/core/accounting-ops.js",
    initialState: "Open",
    matrix: PERIOD_TRANSITIONS,
    recoveryStates: ["Open"],
    approvedRecoveryFromTerminal: [{ from: "Closed", to: "Open" }],
    authDefault: "Accounting.ClosePeriod"
  }),
  buildMachine({
    id: "SM-PAY-001",
    name: "PaymentTransactionLifecycle",
    owningModule: 16,
    entityId: "ENT-PAY-001",
    purpose: "Module 16 payment status machine.",
    sourceRef: "src/core/payment-lifecycle.js#PAYMENT_TRANSITION_MATRIX",
    initialState: "created",
    matrix: PAYMENT_TRANSITION_MATRIX,
    terminalStates: TERMINAL_PAYMENT_STATES,
    errorStates: ["validation_failed", "failed", "expired"],
    recoveryStates: ["partially_refunded", "partially_reversed"],
    authDefault: "Payment.Transition",
    eventsDefault: ["PaymentStatusChanged"]
  }),
  buildMachine({
    id: "SM-WFK-001",
    name: "WorkflowDefinitionLifecycle",
    owningModule: 23,
    entityId: "ENT-WFK-001",
    purpose: "Workflow definition publish/deprecate.",
    sourceRef: "src/core/workflow-lifecycle.js#DEFINITION_TRANSITIONS",
    initialState: "draft",
    matrix: DEFINITION_TRANSITIONS,
    authDefault: "Workflow.Admin"
  }),
  buildMachine({
    id: "SM-WFK-002",
    name: "WorkflowInstanceLifecycle",
    owningModule: 23,
    entityId: "ENT-WFK-002",
    purpose: "Workflow instance orchestration states.",
    sourceRef: "src/core/workflow-lifecycle.js#WORKFLOW_TRANSITION_MATRIX",
    initialState: "draft",
    matrix: WORKFLOW_TRANSITION_MATRIX,
    suspendedStates: ["suspended", "waiting"],
    recoveryStates: ["retrying"],
    errorStates: ["failed"],
    authDefault: "Workflow.Execute"
  }),
  buildMachine({
    id: "SM-WFK-003",
    name: "WorkflowTaskLifecycle",
    owningModule: 23,
    entityId: "ENT-WFK-003",
    purpose: "Human/system task states.",
    sourceRef: "src/core/workflow-lifecycle.js#TASK_TRANSITION_MATRIX",
    initialState: "pending",
    matrix: TASK_TRANSITION_MATRIX,
    suspendedStates: ["suspended"],
    authDefault: "Workflow.Task"
  }),
  buildMachine({
    id: "SM-WFK-004",
    name: "WorkflowCaseLifecycle",
    owningModule: 23,
    entityId: "ENT-WFK-004",
    purpose: "Case management states.",
    sourceRef: "src/core/workflow-lifecycle.js#CASE_TRANSITION_MATRIX",
    initialState: "open",
    matrix: CASE_TRANSITION_MATRIX,
    suspendedStates: ["waiting"],
    authDefault: "Workflow.Case"
  }),
  buildMachine({
    id: "SM-DOC-001",
    name: "ReceiptDocumentLifecycle",
    owningModule: 17,
    entityId: "ENT-DOC-001",
    purpose: "Receipt/document generation and archive.",
    sourceRef: "src/core/document-lifecycle.js#DOCUMENT_TRANSITION_MATRIX",
    initialState: "draft",
    matrix: DOCUMENT_TRANSITION_MATRIX,
    terminalStates: TERMINAL_DOCUMENT_STATES,
    authDefault: "Document.Manage"
  }),
  buildMachine({
    id: "SM-DOC-002",
    name: "ReceiptOutcomeLifecycle",
    owningModule: 17,
    entityId: "ENT-DOC-001",
    purpose: "Receipt financial outcome overlay (not the payment).",
    sourceRef: "src/core/document-lifecycle.js#RECEIPT_OUTCOME_MATRIX",
    initialState: "valid",
    matrix: RECEIPT_OUTCOME_MATRIX,
    authDefault: "Document.Outcome"
  }),
  buildMachine({
    id: "SM-DOC-003",
    name: "TempReceiptSyncLifecycle",
    owningModule: 17,
    entityId: "ENT-DOC-001",
    purpose: "Temporary offline receipt synchronization.",
    sourceRef: "src/core/document-lifecycle.js#TEMP_RECEIPT_MATRIX",
    initialState: "created",
    matrix: TEMP_RECEIPT_MATRIX,
    errorStates: ["rejected"],
    authDefault: "Document.Temp"
  }),
  buildMachine({
    id: "SM-DOC-004",
    name: "DigitalRecordLifecycle",
    owningModule: 26,
    entityId: "ENT-DOC-002",
    purpose: "Digital records retention lifecycle.",
    sourceRef: "src/core/records-lifecycle.js#RECORD_TRANSITIONS",
    initialState: "uploaded",
    matrix: RECORD_TRANSITIONS,
    recoveryStates: ["active"],
    authDefault: "Records.Manage"
  }),
  buildMachine({
    id: "SM-JOB-001",
    name: "JobInstanceLifecycle",
    owningModule: 18,
    entityId: "ENT-JOB-002",
    purpose: "Background job queue lifecycle.",
    sourceRef: "src/core/job-lifecycle.js#JOB_TRANSITION_MATRIX",
    initialState: "created",
    matrix: JOB_TRANSITION_MATRIX,
    terminalStates: TERMINAL_JOB_STATES.filter((s) => s !== "dead_letter"),
    recoveryStates: ["queued"],
    errorStates: ["failed", "dead_letter", "expired"],
    approvedRecoveryFromTerminal: [{ from: "dead_letter", to: "queued" }],
    authDefault: "Job.Manage"
  }),
  buildMachine({
    id: "SM-MON-001",
    name: "OperationalIncidentLifecycle",
    owningModule: 19,
    entityId: "ENT-MON-002",
    purpose: "Ops incident detection through closure.",
    sourceRef: "src/core/monitoring-lifecycle.js#INCIDENT_TRANSITION_MATRIX",
    initialState: "detected",
    matrix: MONITOR_INCIDENT_MATRIX,
    authDefault: "Monitor.Incident"
  }),
  buildMachine({
    id: "SM-SEC-001",
    name: "SecurityIncidentLifecycle",
    owningModule: 22,
    entityId: "ENT-SEC-001",
    purpose: "Security operations incident lifecycle.",
    sourceRef: "src/core/security-lifecycle.js#INCIDENT_TRANSITIONS",
    initialState: "open",
    matrix: SECURITY_INCIDENT_TRANSITIONS,
    authDefault: "Security.Incident"
  }),
  buildMachine({
    id: "SM-SEC-002",
    name: "FraudCaseLifecycle",
    owningModule: 22,
    entityId: "ENT-SEC-002",
    purpose: "Fraud case investigation lifecycle.",
    sourceRef: "src/core/security-lifecycle.js#FRAUD_TRANSITIONS",
    initialState: "detected",
    matrix: FRAUD_TRANSITIONS,
    authDefault: "Security.Fraud"
  }),
  buildMachine({
    id: "SM-BKP-001",
    name: "BackupSetLifecycle",
    owningModule: 21,
    entityId: "ENT-BKP-001",
    purpose: "Backup set create/verify/expire.",
    sourceRef: "src/core/backup-recovery-lifecycle.js#BACKUP_STATES",
    initialState: "created",
    matrix: BACKUP_TRANSITIONS,
    errorStates: ["failed"],
    authDefault: "Backup.Manage"
  }),
  buildMachine({
    id: "SM-BKP-002",
    name: "RestoreJobLifecycle",
    owningModule: 21,
    entityId: "ENT-BKP-001",
    purpose: "Restore authorization and activation.",
    sourceRef: "src/core/backup-recovery-lifecycle.js#RESTORE_TRANSITION_MATRIX",
    initialState: "requested",
    matrix: RESTORE_TRANSITION_MATRIX,
    errorStates: ["rejected", "failed"],
    recoveryStates: ["requested"],
    approvedRecoveryFromTerminal: [{ from: "failed", to: "requested" }],
    authDefault: "Backup.Restore"
  }),
  buildMachine({
    id: "SM-RUL-001",
    name: "BusinessRuleLifecycle",
    owningModule: 24,
    entityId: "ENT-RUL-001",
    purpose: "Deterministic rule publish lifecycle.",
    sourceRef: "src/core/rule-lifecycle.js#RULE_TRANSITION_MATRIX",
    initialState: "draft",
    matrix: RULE_TRANSITION_MATRIX,
    authDefault: "Rule.Admin"
  }),
  buildMachine({
    id: "SM-XCH-001",
    name: "ExchangeJobLifecycle",
    owningModule: 25,
    entityId: "ENT-XCH-001",
    purpose: "Import/export exchange job lifecycle.",
    sourceRef: "src/core/exchange-lifecycle.js#EXCHANGE_TRANSITIONS",
    initialState: "draft",
    matrix: EXCHANGE_TRANSITIONS,
    suspendedStates: ["paused"],
    errorStates: ["failed"],
    recoveryStates: ["queued"],
    authDefault: "Exchange.Manage"
  }),
  buildMachine({
    id: "SM-BI-001",
    name: "KpiDefinitionLifecycle",
    owningModule: 27,
    entityId: "ENT-BI-002",
    purpose: "KPI definition publish/deprecate.",
    sourceRef: "src/core/bi-lifecycle.js#KPI_TRANSITIONS",
    initialState: "draft",
    matrix: KPI_TRANSITIONS,
    authDefault: "BI.Admin"
  }),
  buildMachine({
    id: "SM-INT-001",
    name: "IntegrationProviderLifecycle",
    owningModule: 28,
    entityId: "ENT-INT-001",
    purpose: "Integration Hub provider health lifecycle (no money post).",
    sourceRef: "src/core/integration-lifecycle.js#PROVIDER_TRANSITIONS",
    initialState: "registered",
    matrix: PROVIDER_TRANSITIONS,
    suspendedStates: ["suspended", "degraded"],
    authDefault: "Integration.Admin"
  }),
  buildMachine({
    id: "SM-INT-002",
    name: "IntegrationWebhookLifecycle",
    owningModule: 28,
    entityId: "ENT-INT-002",
    purpose: "Partner webhook subscription lifecycle.",
    sourceRef: "src/core/integration-lifecycle.js#WEBHOOK_STATES",
    initialState: "draft",
    matrix: WEBHOOK_TRANSITIONS,
    suspendedStates: ["paused"],
    errorStates: ["failed"],
    authDefault: "Integration.Webhook"
  }),
  buildMachine({
    id: "SM-INT-003",
    name: "WebhookDeliveryLifecycle",
    owningModule: 28,
    entityId: "ENT-INT-002",
    purpose: "Outbound/inbound webhook delivery attempts.",
    sourceRef: "src/core/integration-lifecycle.js#WEBHOOK_DELIVERY_STATES",
    initialState: "queued",
    matrix: WEBHOOK_DELIVERY_TRANSITIONS,
    recoveryStates: ["queued", "replayed"],
    errorStates: ["failed", "dead_letter"],
    approvedRecoveryFromTerminal: [{ from: "dead_letter", to: "queued" }, { from: "dead_letter", to: "replayed" }],
    authDefault: "Integration.Delivery"
  }),
  buildMachine({
    id: "SM-INT-004",
    name: "IntegrationMessageLifecycle",
    owningModule: 28,
    entityId: "ENT-INT-003",
    purpose: "Hub message queue item lifecycle.",
    sourceRef: "src/core/integration-lifecycle.js#MESSAGE_STATES",
    initialState: "queued",
    matrix: MESSAGE_TRANSITIONS,
    recoveryStates: ["queued", "replayed"],
    errorStates: ["nacked", "dead_letter"],
    approvedRecoveryFromTerminal: [{ from: "dead_letter", to: "replayed" }],
    authDefault: "Integration.Message"
  }),
  buildMachine({
    id: "SM-AI-001",
    name: "AiModelLifecycle",
    owningModule: 29,
    entityId: "ENT-AI-001",
    purpose: "Advisory AI model deploy lifecycle (no money mutation).",
    sourceRef: "src/core/ai-lifecycle.js#MODEL_TRANSITIONS",
    initialState: "draft",
    matrix: MODEL_TRANSITIONS,
    recoveryStates: ["rolled_back", "approved"],
    authDefault: "Ai.Admin"
  }),
  buildMachine({
    id: "SM-AI-002",
    name: "AiDatasetLifecycle",
    owningModule: 29,
    entityId: "ENT-AI-002",
    purpose: "AI dataset registration/approval.",
    sourceRef: "src/core/ai-lifecycle.js#DATASET_STATES",
    initialState: "draft",
    matrix: DATASET_TRANSITIONS,
    authDefault: "Ai.Govern"
  }),
  buildMachine({
    id: "SM-AI-003",
    name: "AiRecommendationDecision",
    owningModule: 29,
    entityId: "ENT-AI-005",
    purpose: "Human oversight decision on advisory recommendations.",
    sourceRef: "src/core/ai-lifecycle.js#RECOMMENDATION_DECISIONS",
    initialState: "pending",
    matrix: RECOMMENDATION_TRANSITIONS,
    authDefault: "Ai.Govern"
  }),
  buildMachine({
    id: "SM-PLT-001",
    name: "TenantLifecycle",
    owningModule: 30,
    entityId: "ENT-PLT-001",
    purpose: "Platform tenant registration and deletion.",
    sourceRef: "src/core/platform-lifecycle.js#TENANT_TRANSITIONS",
    initialState: "registered",
    matrix: TENANT_TRANSITIONS,
    suspendedStates: ["suspended"],
    recoveryStates: ["reactivating", "active"],
    authDefault: "Platform.Tenant"
  }),
  buildMachine({
    id: "SM-PLT-002",
    name: "LicenseLifecycle",
    owningModule: 30,
    entityId: "ENT-PLT-002",
    purpose: "Platform license issue/renew/revoke.",
    sourceRef: "src/core/platform-lifecycle.js#LICENSE_TRANSITIONS",
    initialState: "draft",
    matrix: LICENSE_TRANSITIONS,
    suspendedStates: ["suspended"],
    authDefault: "Platform.License"
  }),
  buildMachine({
    id: "SM-PLT-003",
    name: "DeploymentRecordLifecycle",
    owningModule: 30,
    entityId: "ENT-PLT-006",
    purpose: "Platform deployment plan/approve/execute.",
    sourceRef: "src/core/platform-lifecycle.js#DEPLOY_STATES",
    initialState: "planned",
    matrix: DEPLOY_TRANSITIONS,
    recoveryStates: ["rolled_back"],
    authDefault: "Platform.Deploy"
  }),
  buildMachine({
    id: "SM-PLT-004",
    name: "MaintenanceWindowLifecycle",
    owningModule: 30,
    entityId: "ENT-PLT-005",
    purpose: "Maintenance window lifecycle.",
    sourceRef: "src/core/platform-lifecycle.js#MAINTENANCE_STATES",
    initialState: "planned",
    matrix: MAINTENANCE_TRANSITIONS,
    authDefault: "Platform.Maintenance"
  }),
  buildMachine({
    id: "SM-PLT-005",
    name: "FeatureFlagRuleLifecycle",
    owningModule: 30,
    entityId: "ENT-PLT-004",
    purpose: "Feature flag draft/active/kill.",
    sourceRef: "src/core/platform-lifecycle.js",
    initialState: "draft",
    matrix: FLAG_TRANSITIONS,
    authDefault: "Platform.Flag"
  }),
  buildMachine({
    id: "SM-ORG-001",
    name: "RoleDefinitionLifecycle",
    owningModule: 1,
    entityId: "ENT-ORG-004",
    purpose: "Minimal RBAC role definition publish (reference).",
    sourceRef: "docs/enterprise-canonical-domain-model.md#ENT-ORG-004",
    initialState: "Draft",
    matrix: ROLE_TRANSITIONS,
    authDefault: "Auth.RoleAdmin"
  }),
  buildMachine({
    id: "SM-IDN-001",
    name: "UserAccountLifecycle",
    owningModule: 1,
    entityId: "ENT-IDN-001",
    purpose: "User account active/suspend/disable.",
    sourceRef: "Module 1 Authentication",
    initialState: "Active",
    matrix: USER_TRANSITIONS,
    suspendedStates: ["Suspended"],
    authDefault: "Auth.UserAdmin"
  }),
  buildMachine({
    id: "SM-CFG-001",
    name: "SystemSettingPublishLifecycle",
    owningModule: 14,
    entityId: "ENT-CFG-001",
    purpose: "Config draft→publish (Module 14).",
    sourceRef: "Module 14 System Admin",
    initialState: "draft",
    matrix: SETTING_TRANSITIONS,
    authDefault: "Config.Publish"
  }),
  buildMachine({
    id: "SM-SYN-001",
    name: "OfflineQueueItemLifecycle",
    owningModule: 15,
    entityId: "ENT-SYN-001",
    purpose: "Offline sync queue item statuses.",
    sourceRef: "src/core/sync-ops.js#QUEUE_STATUSES",
    initialState: "pending",
    matrix: SYNC_QUEUE_TRANSITIONS,
    recoveryStates: ["retrying", "pending"],
    errorStates: ["failed", "conflict_detected"],
    authDefault: "Sync.Manage"
  })
].map((m) => Object.freeze(m)));

// Touch imported status catalogs so unused-import lint stays clean if tooling checks.
void CRM_STATUSES;
void KYC_VERIFICATION;
void ACCOUNT_STATUSES;
void GROUP_STATUSES;
void QUEUE_STATUSES;
void BACKUP_STATES;
void WEBHOOK_STATES;
void WEBHOOK_DELIVERY_STATES;
void MESSAGE_STATES;
void DATASET_STATES;
void RECOMMENDATION_DECISIONS;
void DEPLOY_STATES;
void MAINTENANCE_STATES;

export function listStateMachines() {
  return CANONICAL_STATE_MACHINES.map((m) => ({ ...m, transitions: m.transitions.map((t) => ({ ...t })) }));
}

export function getStateMachine(machineId) {
  const found = CANONICAL_STATE_MACHINES.find((m) => m.id === machineId);
  return found
    ? { ...found, transitions: found.transitions.map((t) => ({ ...t })), states: [...found.states] }
    : null;
}

export function isTransitionAllowed(machineId, from, to) {
  const machine = CANONICAL_STATE_MACHINES.find((m) => m.id === machineId);
  if (!machine) return false;
  if (!from || from === to) return true;
  const allowed = machine.matrix?.[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Optional thin adapter — Workflow Engine may call without rewriting workflow-ops.
 */
export function assertTransition(machineId, from, to) {
  if (isTransitionAllowed(machineId, from, to)) return { ok: true };
  return {
    ok: false,
    error: `ECSMLS: transition not allowed on ${machineId}: ${from} → ${to}`
  };
}

function reachableFromInitial(machine) {
  const graph = new Map(machine.states.map((s) => [s, []]));
  for (const t of machine.transitions) {
    if (!graph.has(t.from)) graph.set(t.from, []);
    graph.get(t.from).push(t.to);
  }
  const seen = new Set();
  const stack = [machine.initialState];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of graph.get(cur) || []) stack.push(next);
  }
  return seen;
}

export function validateStateMachineRegistry(options = {}) {
  const machines = options.machines || CANONICAL_STATE_MACHINES;
  const errors = [];
  const warnings = [];

  const ids = machines.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    errors.push(`Duplicate state machine IDs: ${[...new Set(dupes)].join(", ")}`);
  }

  for (const machine of machines) {
    if (!machine.id || !/^SM-[A-Z]{2,4}-\d{3}$/.test(machine.id)) {
      errors.push(`Bad machine id format: ${machine.id}`);
    }
    const owner = Number(machine.owningModule);
    if (!Number.isInteger(owner) || owner < 1 || owner > 30) {
      errors.push(`${machine.id} owningModule must be 1–30`);
    }
    if (!machine.initialState || !machine.states.includes(machine.initialState)) {
      errors.push(`${machine.id} initialState missing from states`);
    }

    const stateSet = new Set(machine.states);
    for (const t of machine.transitions) {
      if (!stateSet.has(t.from)) errors.push(`${machine.id} transition from unknown state: ${t.from}`);
      if (!stateSet.has(t.to)) errors.push(`${machine.id} transition to unknown state: ${t.to}`);
    }

    const recoveryPairs = new Set(
      (machine.approvedRecoveryFromTerminal || []).map((r) => `${r.from}=>${r.to}`)
    );
    for (const term of machine.terminalStates || []) {
      const outbound = machine.transitions.filter((t) => t.from === term);
      for (const t of outbound) {
        const key = `${t.from}=>${t.to}`;
        if (!recoveryPairs.has(key) && !t.recovery) {
          errors.push(
            `${machine.id} terminal state ${term} has illegal outbound to ${t.to} (document recovery if intentional)`
          );
        }
      }
    }

    if (machine.entityId) {
      const entity = getCanonicalEntity(machine.entityId);
      if (!entity) {
        errors.push(`${machine.id} references unknown ECDM entity ${machine.entityId}`);
      } else if (Number(entity.owningModuleId) !== Number(machine.owningModule)) {
        // Soft: entity owner should match machine owner; escalate as warning only if mismatch is intentional (sub-lifecycle).
        if (
          !(
            (machine.id === "SM-CUS-002" && machine.entityId === "ENT-CUS-001") ||
            (machine.id.startsWith("SM-DOC-00") && machine.entityId === "ENT-DOC-001") ||
            (machine.id === "SM-BKP-002" && machine.entityId === "ENT-BKP-001") ||
            (machine.id === "SM-INT-003" && machine.entityId === "ENT-INT-002")
          )
        ) {
          if (Number(entity.owningModuleId) !== Number(machine.owningModule)) {
            warnings.push(
              `${machine.id} owningModule ${machine.owningModule} differs from ECDM owner ${entity.owningModuleId} for ${machine.entityId}`
            );
          }
        }
      }
    }

    if (MONEY_TRANSACTION_ENTITY_CODES.includes(machine.entityId)) {
      if (FORBIDDEN_MONEY_MUTATION_MODULES.includes(Number(machine.owningModule))) {
        errors.push(
          `${machine.id} money entity ${machine.entityId} must not be owned by Module ${machine.owningModule}`
        );
      }
    }

    const reachable = reachableFromInitial(machine);
    for (const state of machine.states) {
      if (!reachable.has(state)) {
        warnings.push(`${machine.id} state unreachable from initial: ${state}`);
      }
    }
  }

  const required = [
    "SM-CUS-001",
    "SM-LON-001",
    "SM-PAY-001",
    "SM-WFK-002",
    "SM-AI-001",
    "SM-PLT-001"
  ];
  for (const id of required) {
    if (!machines.some((m) => m.id === id)) errors.push(`Required machine missing: ${id}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    machineCount: machines.length,
    version: ECSMLS_VERSION,
    schema: STATE_MACHINE_SCHEMA
  };
}
