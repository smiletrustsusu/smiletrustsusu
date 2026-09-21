/**
 * Module 16 payment status machine, standard flow stages, and named owners.
 * Only this module may decide legal payment status changes.
 */

export const PAYMENT_SCHEMA_LIFECYCLE = "1.1.0";

export const PAYMENT_STATES = [
  "created",
  "validated",
  "pending_customer_authorization",
  "pending_provider",
  "authorized",
  "processing",
  "completed",
  "validation_failed",
  "failed",
  "cancelled",
  "expired",
  "partially_refunded",
  "fully_refunded",
  "partially_reversed",
  "fully_reversed"
];

export const PAYMENT_STATUS_ALIASES = {
  initiated: "created",
  refunded: "fully_refunded",
  reversed: "fully_reversed"
};

export const TERMINAL_PAYMENT_STATES = [
  "validation_failed",
  "failed",
  "cancelled",
  "expired",
  "fully_refunded",
  "fully_reversed"
];

export const PAYMENT_TRANSITION_MATRIX = {
  created: ["validated", "validation_failed", "cancelled"],
  validated: ["pending_customer_authorization", "pending_provider", "cancelled"],
  pending_customer_authorization: ["authorized", "failed", "cancelled", "expired"],
  pending_provider: ["authorized", "processing", "failed", "expired"],
  authorized: ["processing", "failed", "cancelled"],
  processing: ["completed", "failed"],
  completed: ["partially_refunded", "fully_refunded", "partially_reversed", "fully_reversed"],
  partially_refunded: ["fully_refunded"],
  partially_reversed: ["fully_reversed"],
  validation_failed: [],
  failed: [],
  cancelled: [],
  expired: [],
  fully_refunded: [],
  fully_reversed: []
};

export const TRANSACTION_STATUS_MAP = {
  created: "pending",
  initiated: "pending",
  validated: "pending",
  pending_customer_authorization: "pending",
  pending_provider: "pending",
  authorized: "posted",
  processing: "posted",
  completed: "posted",
  validation_failed: "failed",
  failed: "failed",
  cancelled: "cancelled",
  expired: "failed",
  partially_refunded: "reversed",
  fully_refunded: "reversed",
  refunded: "reversed",
  partially_reversed: "reversed",
  fully_reversed: "reversed",
  reversed: "reversed"
};

export const WORKFLOW_STAGES = [
  { id: "receive", name: "Receive Payment Request", owner: "API Gateway", backup: "Application Controller" },
  { id: "authenticate", name: "Authenticate Request", owner: "Authentication Service", backup: "Identity Service" },
  { id: "authorize", name: "Authorize User", owner: "Authorization Service", backup: "Security Service" },
  { id: "validate", name: "Validate Business Rules", owner: "Payment Engine", backup: "Business Rules Engine" },
  { id: "identifiers", name: "Generate Internal Identifiers", owner: "Identifier Service", backup: "Identifier Recovery Service" },
  { id: "correlation", name: "Create Correlation ID", owner: "Workflow Engine", backup: "Process Orchestrator" },
  { id: "idempotency", name: "Register Idempotency Key", owner: "Idempotency Service", backup: "Request Recovery Service" },
  { id: "create_record", name: "Create Payment Record", owner: "Payment Engine", backup: "Transaction Engine" },
  { id: "select_method", name: "Select Payment Method", owner: "Payment Engine", backup: "Configuration Service" },
  { id: "select_provider", name: "Select Provider", owner: "Provider Routing Engine", backup: "Provider Failover Engine" },
  { id: "submit_provider", name: "Submit to Provider", owner: "Provider Adapter", backup: "Provider Retry Engine" },
  { id: "receive_callback", name: "Receive Provider Callback", owner: "Callback Processor", backup: "Callback Recovery Service" },
  { id: "validate_callback", name: "Validate Callback", owner: "Callback Validation Service", backup: "Security Validation Service" },
  { id: "idempotency_check", name: "Perform Idempotency Check", owner: "Idempotency Service", backup: "Transaction Recovery Service" },
  { id: "update_status", name: "Update Payment Status", owner: "Payment Engine", backup: "Workflow Engine" },
  { id: "execute_business", name: "Execute Business Transaction", owner: "Transaction Engine", backup: "Business Recovery Engine" },
  { id: "post_accounting", name: "Post Accounting Entries", owner: "Accounting Engine", backup: "Journal Recovery Service" },
  { id: "create_audit", name: "Create Audit Record", owner: "Audit Engine", backup: "Audit Recovery Service" },
  { id: "generate_receipt", name: "Generate Receipt", owner: "Receipt Service", backup: "Document Service" },
  { id: "queue_notifications", name: "Queue Notifications", owner: "Notification Engine", backup: "Notification Retry Service" },
  { id: "complete_workflow", name: "Complete Workflow", owner: "Workflow Engine", backup: "Transaction Recovery Service" }
];

export const STAGE_OWNER_EVENTS = {
  authenticate: { success: "AuthenticationSucceeded", failure: "AuthenticationFailed" },
  validate: { success: "PaymentValidated", failure: "PaymentValidationFailed" },
  create_record: { success: "PaymentCreated", failure: "PaymentCreateFailed" },
  update_status: { success: "PaymentStatusChanged", failure: "PaymentStatusRejected" },
  complete_workflow: { success: "PaymentCompleted", failure: "PaymentWorkflowFailed" },
  post_accounting: { success: "JournalPosted", failure: "AccountingFailed" },
  queue_notifications: { success: "NotificationQueued", failure: "NotificationFailed" }
};

const STATUS_OWNER = "Payment Engine";
const ACCOUNTING_OWNER = "Accounting Engine";
const AUDIT_OWNER = "Audit Engine";
const NOTIFICATION_OWNER = "Notification Engine";

export function canonicalPaymentStatus(status) {
  const raw = String(status || "created");
  return PAYMENT_STATUS_ALIASES[raw] || raw;
}

export function mapPaymentToTransactionStatus(status) {
  return TRANSACTION_STATUS_MAP[canonicalPaymentStatus(status)] || "pending";
}

export function isTerminalPaymentStatus(status) {
  return TERMINAL_PAYMENT_STATES.includes(canonicalPaymentStatus(status));
}

export function allowedNextStates(status) {
  return [...(PAYMENT_TRANSITION_MATRIX[canonicalPaymentStatus(status)] || [])];
}

export function canTransitionPayment(from, to) {
  const next = canonicalPaymentStatus(to);
  return allowedNextStates(from).includes(next);
}

export function workflowStage(stageId) {
  return WORKFLOW_STAGES.find((item) => item.id === stageId) || null;
}

export function stageOwner(stageId) {
  return workflowStage(stageId)?.owner || "";
}

export function stageBackupOwner(stageId) {
  return workflowStage(stageId)?.backup || "";
}

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensurePaymentLifecycleState(state = {}) {
  state.paymentStatusHistory = state.paymentStatusHistory || [];
  state.paymentStageLocks = state.paymentStageLocks || [];
  state.paymentOwnershipEvents = state.paymentOwnershipEvents || [];
  state.paymentWorkflowEvents = state.paymentWorkflowEvents || [];
  state.paymentOwnerHealth = state.paymentOwnerHealth || [];
  WORKFLOW_STAGES.forEach((stage) => {
    if (!state.paymentOwnerHealth.find((item) => item.owner === stage.owner)) {
      state.paymentOwnerHealth.push({
        id: `poh-${stage.owner.replace(/\s+/g, "-").toLowerCase()}`,
        owner: stage.owner,
        status: "healthy",
        consecutiveFailures: 0,
        lastSuccessAt: "",
        errorRate: 0
      });
    }
  });
  return state;
}

export function ownerHealth(state, owner) {
  ensurePaymentLifecycleState(state);
  return state.paymentOwnerHealth.find((item) => item.owner === owner) || { owner, status: "healthy" };
}

export function setOwnerHealth(state, owner, status, now) {
  ensurePaymentLifecycleState(state);
  let row = state.paymentOwnerHealth.find((item) => item.owner === owner);
  if (!row) {
    row = {
      id: `poh-${String(owner).replace(/\s+/g, "-").toLowerCase()}`,
      owner,
      status: "healthy",
      consecutiveFailures: 0
    };
    state.paymentOwnerHealth.push(row);
  }
  row.status = status;
  row.updatedAt = nowIso(now);
  if (status === "healthy") {
    row.consecutiveFailures = 0;
    row.lastSuccessAt = nowIso(now);
  } else {
    row.consecutiveFailures = Number(row.consecutiveFailures || 0) + 1;
  }
  return row;
}

export function isOwnerHealthy(state, owner) {
  const row = ownerHealth(state, owner);
  return !row.status || row.status === "healthy" || row.status === "degraded";
}

export function assertStageActor(state, stageId, actor, { failover = false, approved = false } = {}) {
  const stage = workflowStage(stageId);
  if (!stage) return { ok: false, error: "Unknown workflow stage" };
  if (actor === stage.owner) return { ok: true, owner: stage.owner, mode: "primary" };
  if (actor === stage.backup) {
    const primaryDown = !isOwnerHealthy(state, stage.owner);
    if (!failover && !approved && !primaryDown) {
      return { ok: false, error: "Backup owner cannot run this stage while the primary owner is healthy" };
    }
    return { ok: true, owner: stage.backup, mode: "backup", primary: stage.owner };
  }
  return { ok: false, error: `${actor || "Unknown"} is not the owner of ${stage.name}` };
}

export function acquireStageLock(state, stageId, paymentId, actor, { uid, now, ttlMs = 30000, failover = false, approved = false, reason = "" } = {}) {
  ensurePaymentLifecycleState(state);
  const allowed = assertStageActor(state, stageId, actor, { failover, approved });
  if (!allowed.ok) return allowed;
  const key = `${paymentId || "flow"}:${stageId}`;
  const ts = nowMs(now);
  const existing = state.paymentStageLocks.find((item) => item.key === key);
  if (existing && existing.holder && Date.parse(existing.lockUntil || 0) > ts && existing.holder !== actor) {
    return { ok: false, error: "Stage is locked by another owner" };
  }
  const row = existing || { id: newId("psl", uid), key, stageId, paymentId };
  if (!existing) state.paymentStageLocks.push(row);
  const previous = row.holder || "";
  row.holder = actor;
  row.mode = allowed.mode;
  row.lockUntil = new Date(ts + ttlMs).toISOString();
  if (allowed.mode === "backup" && previous !== actor) {
    state.paymentOwnershipEvents.push({
      id: newId("poe", uid),
      stageId,
      previousOwner: workflowStage(stageId).owner,
      newOwner: actor,
      reason: reason || "failover",
      correlationId: paymentId || "",
      createdAt: nowIso(now)
    });
  }
  return { ok: true, lock: row, mode: allowed.mode };
}

export function releaseStageLock(state, stageId, paymentId, actor) {
  const key = `${paymentId || "flow"}:${stageId}`;
  const row = (state.paymentStageLocks || []).find((item) => item.key === key);
  if (row && (!actor || row.holder === actor)) {
    row.holder = "";
    row.lockUntil = "";
  }
  return { ok: true };
}

export function failbackStageOwner(state, stageId, paymentId, { uid, now } = {}) {
  ensurePaymentLifecycleState(state);
  const stage = workflowStage(stageId);
  if (!stage) return { ok: false, error: "Unknown workflow stage" };
  const key = `${paymentId || "flow"}:${stageId}`;
  const row = state.paymentStageLocks.find((item) => item.key === key);
  const previous = row?.holder || stage.backup;
  if (row) {
    row.holder = "";
    row.lockUntil = "";
    row.mode = "primary";
  }
  setOwnerHealth(state, stage.owner, "healthy", now);
  state.paymentOwnershipEvents.push({
    id: newId("poe", uid),
    stageId,
    previousOwner: previous,
    newOwner: stage.owner,
    reason: "failback",
    correlationId: paymentId || "",
    createdAt: nowIso(now)
  });
  return { ok: true, owner: stage.owner };
}

export function publishWorkflowEvent(state, { type, stageId, paymentId, actor, correlationId, uid, now, ok = true } = {}) {
  ensurePaymentLifecycleState(state);
  const row = {
    id: newId("pwe", uid),
    eventId: newId("evt", uid),
    type: type || (ok ? STAGE_OWNER_EVENTS[stageId]?.success : STAGE_OWNER_EVENTS[stageId]?.failure) || "WorkflowEvent",
    stageId: stageId || "",
    stageOwner: actor || stageOwner(stageId),
    paymentId: paymentId || "",
    correlationId: correlationId || paymentId || "",
    timestamp: nowIso(now),
    eventVersion: "1"
  };
  state.paymentWorkflowEvents.push(row);
  return row;
}

export function executeWorkflowStage(state, stageId, actor, fn, extras = {}) {
  const lock = acquireStageLock(state, stageId, extras.paymentId, actor, extras);
  if (!lock.ok) return lock;
  try {
    const result = typeof fn === "function" ? fn() : { ok: true };
    publishWorkflowEvent(state, {
      type: result?.ok === false ? STAGE_OWNER_EVENTS[stageId]?.failure : STAGE_OWNER_EVENTS[stageId]?.success,
      stageId,
      paymentId: extras.paymentId,
      actor,
      correlationId: extras.correlationId,
      uid: extras.uid,
      now: extras.now,
      ok: result?.ok !== false
    });
    return result && typeof result === "object" ? { ...result, stageId, owner: actor, mode: lock.mode } : { ok: true, stageId, owner: actor };
  } finally {
    releaseStageLock(state, stageId, extras.paymentId, actor);
  }
}

export function assertStatusOwner(actor) {
  if (actor && actor !== STATUS_OWNER && actor !== "Workflow Engine") {
    return { ok: false, error: "Only the Payment Engine may update payment status" };
  }
  return { ok: true };
}

export function assertAccountingOwner(actor) {
  if (actor && actor !== ACCOUNTING_OWNER) {
    return { ok: false, error: "Only the Accounting Engine may mark accounting posted" };
  }
  return { ok: true };
}

export function transitionPayment(state, payment, nextStatus, {
  actor = STATUS_OWNER,
  reason = "",
  user,
  uid,
  now,
  expectedVersion,
  providerId = "",
  recordAudit,
  failover = false,
  approved = false
} = {}) {
  if (!payment) return { ok: false, error: "Payment not found" };
  ensurePaymentLifecycleState(state);
  const ownerGate = assertStageActor(state, "update_status", actor, { failover, approved });
  if (!ownerGate.ok) {
    const statusGate = assertStatusOwner(actor);
    return statusGate.ok ? ownerGate : statusGate;
  }
  const from = canonicalPaymentStatus(payment.status);
  const to = canonicalPaymentStatus(nextStatus);
  if (from === to) return { ok: true, payment, noop: true };
  if (!canTransitionPayment(from, to)) {
    return { ok: false, error: `Invalid payment transition: ${from} → ${to}` };
  }
  if (expectedVersion != null && Number(payment.version || 1) !== Number(expectedVersion)) {
    return { ok: false, error: "Payment version conflict" };
  }
  const timestamp = nowIso(now);
  payment.status = to;
  payment.transactionStatus = mapPaymentToTransactionStatus(to);
  payment.version = Number(payment.version || 1) + 1;
  payment.updatedAt = timestamp;
  if (to === "completed") payment.completedAt = payment.completedAt || timestamp;
  if (TERMINAL_PAYMENT_STATES.includes(to) && to !== "fully_refunded" && to !== "fully_reversed") {
    payment.completedAt = payment.completedAt || timestamp;
  }
  const history = {
    id: newId("psh", uid),
    paymentId: payment.id,
    previousState: from,
    newState: to,
    timestamp,
    actor,
    userId: user?.id || "",
    providerId: providerId || payment.providerId || "",
    correlationId: payment.correlationId || "",
    idempotencyKey: payment.idempotencyKey || "",
    reason
  };
  payment.statusHistory = [...(payment.statusHistory || []), { previousState: from, newState: to, timestamp, reason }];
  state.paymentStatusHistory.push(history);
  if (typeof recordAudit === "function") {
    recordAudit({
      action: "Payment status changed",
      details: `${payment.id} · ${from} → ${to}`,
      entityId: payment.id,
      correlationId: payment.correlationId,
      previousState: from,
      nextState: to
    });
  }
  return { ok: true, payment, from, to, history };
}

export function markAccountingPosted(state, payment, actor = ACCOUNTING_OWNER) {
  const gate = assertAccountingOwner(actor);
  if (!gate.ok) return gate;
  if (canonicalPaymentStatus(payment.status) !== "completed" && canonicalPaymentStatus(payment.status) !== "partially_refunded" && canonicalPaymentStatus(payment.status) !== "fully_refunded" && canonicalPaymentStatus(payment.status) !== "partially_reversed" && canonicalPaymentStatus(payment.status) !== "fully_reversed") {
    return { ok: false, error: "Accounting entries shall be posted only when the payment is completed or a compensating refund/reversal is recorded" };
  }
  payment.accountingPosted = true;
  payment.accountingStatus = "posted";
  payment.accountingOwner = ACCOUNTING_OWNER;
  return { ok: true, payment };
}

export const STATE_OWNERS = {
  paymentStatus: STATUS_OWNER,
  accountingStatus: ACCOUNTING_OWNER,
  auditCompletion: AUDIT_OWNER,
  notificationDelivery: NOTIFICATION_OWNER
};

export function paymentFlowOrder() {
  return WORKFLOW_STAGES.map((item) => item.id);
}
