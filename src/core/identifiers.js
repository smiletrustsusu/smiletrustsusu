/**
 * Global identifier schema, aggregate keys, ownership, lifecycle, and
 * delegation governance. Existing Smile Trust ids (uid prefixes, printed
 * receipts) remain valid; this module standardizes new sync payloads.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { ROLE, isSystemOwner } from "./roles.js";

export const IDENTIFIER_SCHEMA_VERSION = "1.0.0";

export const BUSINESS_PREFIXES = {
  Customer: "CUS",
  Agent: "AGT",
  Group: "GRP",
  SavingsAccount: "SAV",
  Loan: "LON",
  Collection: "COL",
  Withdrawal: "WDL",
  Journal: "JRN",
  Receipt: "RCP",
  Payment: "PAY",
  Expense: "EXP",
  Income: "INC",
  Notification: "NTF",
  Audit: "AUD",
  Branch: "BRH",
  User: "USR",
  Device: "DEV",
  CashSession: "CSS",
  ConfigurationVersion: "CFG",
  TemporaryReceipt: "TMP",
  Workflow: "WKF",
  Task: "TSK",
  Case: "CSE"
};

export const AGGREGATE_TYPES = [
  "CUSTOMER",
  "SAVINGS_ACCOUNT",
  "LOAN_ACCOUNT",
  "GROUP",
  "CASH_SESSION",
  "BRANCH",
  "ACCOUNTING_PERIOD",
  "PRODUCT",
  "USER",
  "DEVICE",
  "JOB",
  "WORKFLOW",
  "CASE",
  "TASK"
];

export const IDENTIFIER_OWNERS = {
  customer_id: "Customer Management Service",
  customer_number: "Customer Number Generator",
  agent_id: "Agent Management Service",
  branch_id: "Branch Management Service",
  savings_account_id: "Savings Module",
  loan_id: "Loan Module",
  group_id: "Group Module",
  transaction_id: "Transaction Engine",
  transaction_number: "Transaction Number Service",
  receipt_number: "Receipt Service",
  temporary_receipt: "Receipt Service",
  journal_number: "Accounting Engine",
  audit_id: "Audit Engine",
  event_id: "Event Bus",
  correlation_id: "Workflow Engine",
  idempotency_key: "API Gateway",
  device_id: "Device Registration Service",
  session_id: "Authentication Service",
  notification_id: "Notification Engine",
  sync_session_id: "Synchronization Engine",
  local_sync_session: "Synchronization Engine",
  import_batch: "Import Service",
  external_reference: "External System",
  payment_id: "Payment Engine",
  provider_reference: "External System",
  document_id: "Document Engine",
  document_number: "Receipt Service",
  job_id: "Scheduler Engine",
  schedule_id: "Scheduler Engine",
  worker_id: "Scheduler Engine",
  dlq_id: "Dead Letter Service",
  monitor_id: "Monitoring Engine",
  alert_id: "Monitoring Engine",
  incident_id: "Monitoring Engine",
  trace_id: "Monitoring Engine",
  api_client_id: "API Gateway",
  api_key_id: "API Gateway",
  api_request_id: "API Gateway",
  webhook_id: "API Gateway",
  webhook_delivery_id: "API Gateway",
  backup_set_id: "Backup Engine",
  restore_id: "Backup Engine",
  recovery_test_id: "Backup Engine",
  dr_site_id: "Backup Engine",
  risk_id: "Security Engine",
  security_incident_id: "Security Engine",
  fraud_case_id: "Security Engine",
  contract_id: "Security Engine",
  workflow_id: "Workflow Engine",
  workflow_instance_id: "Workflow Engine",
  task_id: "Workflow Engine",
  case_id: "Workflow Engine",
  sla_id: "Workflow Engine"
};

export const LIFECYCLE_STATES = ["reserved", "assigned", "active", "archived", "retired"];
export const DEPENDENCY_TYPES = ["hard", "soft", "optional"];
export const DELEGATION_STATES = ["draft", "submitted", "risk_assessment", "pending_approval", "approved", "activated", "rejected", "suspended", "revoked"];
export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_ID_RE = /^[a-z]{1,16}-[a-z0-9._:-]+$/i;
const BUSINESS_ID_RE = /^[A-Z]{2,4}-[A-Z0-9]+-\d{4}-\d{6,}$/;
const RECEIPT_ID_RE = /^[A-Z0-9]{2,12}-\d{6,}$/;
const TEMP_RECEIPT_RE = /^TMP-[A-Z0-9][A-Z0-9.-]*$/i;

const PERMANENT_SERVER_TYPES = new Set(["journal_number", "audit_id", "receipt_number", "transaction_number"]);
const FINANCIAL_NEVER_REUSE = new Set(["transaction_number", "receipt_number", "journal_number", "audit_id"]);

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randHex(n) {
  let out = "";
  while (out.length < n) out += Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return out.slice(0, n);
}

export function generateTechnicalId(now = Date.now()) {
  const hex = Number(now).toString(16).padStart(12, "0").slice(-12);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${randHex(3)}-a${randHex(3)}-${randHex(12)}`;
}

export function isTechnicalId(value) {
  const text = String(value || "");
  return UUID_RE.test(text) || LEGACY_ID_RE.test(text);
}

export function isBusinessId(value) {
  const text = String(value || "").toUpperCase();
  return BUSINESS_ID_RE.test(text) || RECEIPT_ID_RE.test(text) || TEMP_RECEIPT_RE.test(text);
}

export function formatBusinessId(prefix, branch = "HQ", year = new Date().getFullYear(), sequence = 1) {
  const p = String(prefix || "COL").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "COL";
  const b = String(branch || "HQ").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "HQ";
  return `${p}-${b}-${year}-${String(Number(sequence) || 1).padStart(8, "0")}`;
}

export function nextBusinessSequence(state, prefix, branch = "HQ") {
  ensureIdentifierState(state);
  const year = new Date().getFullYear();
  const key = `${prefix}:${branch}:${year}`;
  const current = Number(state.identifierSequences[key] || 0) + 1;
  state.identifierSequences[key] = current;
  return { sequence: current, value: formatBusinessId(prefix, branch, year, current) };
}

export function describePrimaryAggregate(kind, payload = {}) {
  const k = String(kind || "").toLowerCase();
  if (payload.loanId || ["repayment", "disbursement", "loan"].includes(k)) {
    return { type: "LOAN_ACCOUNT", id: payload.loanId || payload.id || "unknown" };
  }
  if (k === "customer") return { type: "CUSTOMER", id: payload.id || payload.customerId || "unknown" };
  if (k === "meeting" || k === "group") return { type: "GROUP", id: payload.susuGroupId || payload.groupId || payload.id || "unknown" };
  if (k === "journal") return { type: "ACCOUNTING_PERIOD", id: payload.periodId || payload.branchId || payload.id || "unknown" };
  if (k === "expense") return { type: "BRANCH", id: payload.branchId || payload.groupId || payload.id || "unknown" };
  if (k === "monitoring" || k === "device_health") {
    return { type: "DEVICE", id: payload.deviceId || payload.id || "unknown" };
  }
  return { type: "SAVINGS_ACCOUNT", id: payload.savingsAccountId || payload.customerId || payload.id || "unknown" };
}

export function describeSecondaryAggregates(kind, payload = {}) {
  const rows = [];
  if (payload.customerId) rows.push({ type: "CUSTOMER", id: payload.customerId });
  if (payload.groupId) rows.push({ type: "BRANCH", id: payload.groupId });
  if (payload.branchId) rows.push({ type: "BRANCH", id: payload.branchId });
  if (payload.userId || payload.collectorId || payload.agentId) {
    rows.push({ type: "USER", id: payload.userId || payload.collectorId || payload.agentId });
  }
  if (payload.deviceId) rows.push({ type: "DEVICE", id: payload.deviceId });
  if (payload.cashSessionId) rows.push({ type: "CASH_SESSION", id: payload.cashSessionId });
  const primary = describePrimaryAggregate(kind, payload);
  return rows.filter((item) => !(item.type === primary.type && item.id === primary.id));
}

export function aggregateKey(type, id) {
  return `${type}:${id}`;
}

export function normalizeDependencies(dependsOn = [], typed = []) {
  const fromIds = (dependsOn || []).map((id) => (typeof id === "string"
    ? { id, type: "hard" }
    : { id: id.id, type: DEPENDENCY_TYPES.includes(id.type) ? id.type : "hard" }));
  const extra = (typed || []).map((item) => ({
    id: item.id || item.transactionId,
    type: DEPENDENCY_TYPES.includes(item.type) ? item.type : "hard"
  }));
  return [...fromIds, ...extra].filter((item) => item.id);
}

export function validateDependencyGraph(items = []) {
  const byId = new Map();
  items.forEach((item) => {
    const id = item.id || item.globalTransactionId;
    if (id) byId.set(id, item);
  });
  const visiting = new Set();
  const visited = new Set();
  const cycle = [];
  function walk(id, stack) {
    if (visiting.has(id)) {
      cycle.push(...stack, id);
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = byId.get(id);
    const deps = normalizeDependencies(node?.dependsOn, node?.dependencies).filter((dep) => dep.type === "hard");
    for (const dep of deps) {
      if (walk(dep.id, [...stack, id])) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const id of byId.keys()) {
    if (walk(id, [])) {
      return { ok: false, error: "Circular dependency detected", cycle };
    }
  }
  return { ok: true };
}

export function currentAggregateVersion(state, type, id) {
  ensureIdentifierState(state);
  const key = aggregateKey(type, id);
  const row = state.aggregateVersions.find((item) => item.key === key);
  return row ? Number(row.version || 1) : 1;
}

export function bumpAggregateVersion(state, type, id, deviceId = "") {
  ensureIdentifierState(state);
  const key = aggregateKey(type, id);
  let row = state.aggregateVersions.find((item) => item.key === key);
  if (!row) {
    row = { id: key, key, type, aggregateId: id, version: 1, updatedByDevice: deviceId };
    state.aggregateVersions.push(row);
  }
  row.version = Number(row.version || 1) + 1;
  row.updatedByDevice = deviceId;
  row.updatedAt = nowIso();
  return row.version;
}

export function acquireAggregateLock(state, type, id, holderId, { ttlMs = 30000, now = Date.now() } = {}) {
  ensureIdentifierState(state);
  const key = aggregateKey(type, id);
  const existing = state.aggregateLocks.find((item) => item.key === key);
  if (existing && existing.holderId !== holderId && Date.parse(existing.lockUntil || 0) > now) {
    return { error: "Aggregate is locked by another operation" };
  }
  const row = existing || { id: key, key, type, aggregateId: id };
  if (!existing) state.aggregateLocks.push(row);
  row.holderId = holderId;
  row.lockUntil = new Date(now + ttlMs).toISOString();
  return { ok: true, lock: row };
}

export function releaseAggregateLock(state, type, id, holderId) {
  const key = aggregateKey(type, id);
  const row = (state.aggregateLocks || []).find((item) => item.key === key);
  if (row && (!holderId || row.holderId === holderId)) {
    row.holderId = "";
    row.lockUntil = "";
  }
  return { ok: true };
}

export function recordIdentifierEvent(state, { type, value, owner, operation, entityId, user, previousState, nextState } = {}, uid) {
  ensureIdentifierState(state);
  const row = {
    id: newId("idlog", uid),
    identifierType: type,
    value,
    owner: owner || IDENTIFIER_OWNERS[type] || "",
    operation,
    entityId: entityId || "",
    previousState: previousState || "",
    nextState: nextState || "",
    userId: user?.id || "",
    createdAt: nowIso()
  };
  state.identifierActivityLogs.push(row);
  recordAuditEvent(state, {
    action: `Identifier ${operation || "event"}`,
    details: `${type} ${value}`,
    userId: user?.id || "",
    username: user?.username,
    category: "configuration",
    guarantee: "G1",
    module: "15",
    entityType: type,
    entityId: value
  }, uid);
  return row;
}

export function assertOwnerCanGenerate(type, component) {
  const owner = IDENTIFIER_OWNERS[type];
  if (!owner) return { error: "Unknown identifier owner" };
  if (component && component !== owner && component !== "system") {
    return { error: "Identifier Ownership Violation", owner };
  }
  return { ok: true, owner };
}

export function ensureIdentifierState(state = {}) {
  state.aggregateVersions = state.aggregateVersions || [];
  state.aggregateLocks = state.aggregateLocks || [];
  state.identifierSequences = state.identifierSequences || {};
  state.identifierRegistry = state.identifierRegistry || [];
  state.identifierActivityLogs = state.identifierActivityLogs || [];
  state.identifierDelegations = state.identifierDelegations || [];
  state.identifierDelegationReviews = state.identifierDelegationReviews || [];
  state.externalReferences = state.externalReferences || [];
  if (!state.identifierDelegations.some((item) => item.id === "del-offline-receipt")) {
    state.identifierDelegations.push({
      id: "del-offline-receipt",
      identifierType: "temporary_receipt",
      owner: IDENTIFIER_OWNERS.temporary_receipt,
      component: "Authorized Android Agent Application",
      status: "activated",
      risk: "High",
      scope: "device",
      requestedBy: "system",
      approvedBy: ["system"],
      createdAt: nowIso(),
      activatedAt: nowIso()
    });
  }
  if (!state.identifierDelegations.some((item) => item.id === "del-idempotency")) {
    state.identifierDelegations.push({
      id: "del-idempotency",
      identifierType: "idempotency_key",
      owner: IDENTIFIER_OWNERS.idempotency_key,
      component: "Android APK",
      status: "activated",
      risk: "Medium",
      scope: "client",
      requestedBy: "system",
      approvedBy: ["system"],
      createdAt: nowIso(),
      activatedAt: nowIso()
    });
  }
  if (!state.identifierDelegations.some((item) => item.id === "del-local-sync")) {
    state.identifierDelegations.push({
      id: "del-local-sync",
      identifierType: "local_sync_session",
      owner: IDENTIFIER_OWNERS.local_sync_session,
      component: "Android Client",
      status: "activated",
      risk: "Medium",
      scope: "device",
      requestedBy: "system",
      approvedBy: ["system"],
      createdAt: nowIso(),
      activatedAt: nowIso()
    });
  }
  return state;
}

export function activeDelegation(state, identifierType, component) {
  ensureIdentifierState(state);
  return (state.identifierDelegations || []).find((item) => (
    item.identifierType === identifierType
    && item.status === "activated"
    && (!component || item.component === component || item.scope === "device" || item.scope === "client")
  ));
}

export function canGenerateDelegated(state, identifierType, { component = "", deviceId = "", online = true } = {}) {
  ensureIdentifierState(state);
  if (PERMANENT_SERVER_TYPES.has(identifierType) && online === false) {
    return { ok: false, error: "Unauthorized Identifier Generation" };
  }
  const delegation = activeDelegation(state, identifierType, component);
  if (!delegation) return { ok: false, error: "Unknown Identifier Owner" };
  if (deviceId) {
    const device = (state.devices || []).find((item) => item.id === deviceId || item.fingerprint === deviceId);
    if (device && device.active === false) return { ok: false, error: "Delegation revoked for this device" };
  }
  return { ok: true, delegation };
}

export function linkExternalReference(state, { system, value, internalId, internalType } = {}, uid) {
  ensureIdentifierState(state);
  const row = {
    id: newId("xref", uid),
    system: system || "external",
    value: String(value || ""),
    internalId: internalId || "",
    internalType: internalType || "",
    createdAt: nowIso()
  };
  state.externalReferences.push(row);
  return row;
}

export function requestDelegation(state, patch, user, uid) {
  ensureIdentifierState(state);
  if (!patch?.identifierType || !IDENTIFIER_OWNERS[patch.identifierType]) return { error: "Unknown identifier type" };
  if (!patch.component || !patch.justification) return { error: "Delegated component and justification are required" };
  const row = {
    id: newId("del", uid),
    identifierType: patch.identifierType,
    owner: IDENTIFIER_OWNERS[patch.identifierType],
    component: patch.component,
    justification: patch.justification,
    scope: patch.scope || "device",
    risk: RISK_LEVELS.includes(patch.risk) ? patch.risk : "High",
    status: "draft",
    startAt: patch.startAt || nowIso(),
    endAt: patch.endAt || "",
    requestedBy: user?.id || "",
    approvedBy: [],
    createdAt: nowIso()
  };
  state.identifierDelegations.push(row);
  recordIdentifierEvent(state, { type: patch.identifierType, value: row.id, operation: "Generate", user, nextState: "draft" }, uid);
  return { ok: true, delegation: row };
}

export function advanceDelegation(state, id, nextStatus, user, uid) {
  ensureIdentifierState(state);
  const row = (state.identifierDelegations || []).find((item) => item.id === id);
  if (!row) return { error: "Delegation not found" };
  const allowed = {
    draft: ["submitted"],
    submitted: ["risk_assessment"],
    risk_assessment: ["pending_approval"],
    pending_approval: ["approved", "rejected"],
    approved: ["activated"],
    activated: ["suspended", "revoked"],
    suspended: ["activated", "revoked"]
  };
  if (!(allowed[row.status] || []).includes(nextStatus)) return { error: "Invalid identifier state" };
  if (nextStatus === "approved") {
    if (row.requestedBy && row.requestedBy === user?.id && !isSystemOwner(user)) {
      return { error: "Maker-checker: a different approver is required" };
    }
    if (row.risk === "High" && !(isSystemOwner(user) || user?.role === ROLE.SUPER_ADMIN || user?.role === ROLE.DEVELOPER)) {
      return { error: "High-risk delegation requires Super Administrator or System Owner" };
    }
    row.approvedBy = [...new Set([...(row.approvedBy || []), user?.id || ""])].filter(Boolean);
    if (row.risk === "Critical" && row.approvedBy.length < 2) {
      row.status = "pending_approval";
      row.updatedAt = nowIso();
      return { ok: true, pending: true, delegation: row };
    }
  }
  const previous = row.status;
  row.status = nextStatus;
  row.updatedAt = nowIso();
  if (nextStatus === "activated") row.activatedAt = nowIso();
  if (nextStatus === "revoked") row.revokedAt = nowIso();
  if (nextStatus === "suspended") row.suspendedAt = nowIso();
  recordIdentifierEvent(state, {
    type: row.identifierType,
    value: row.id,
    operation: nextStatus,
    user,
    previousState: previous,
    nextState: nextStatus
  }, uid);
  return { ok: true, delegation: row };
}

export function createEmergencyDelegation(state, patch, user, uid, { hours = 24 } = {}) {
  const created = requestDelegation(state, { ...patch, risk: patch.risk || "Critical", justification: patch.justification || "Emergency continuity" }, user, uid);
  if (created.error) return created;
  const row = created.delegation;
  row.status = "activated";
  row.emergency = true;
  row.endAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  row.approvedBy = [user?.id || "emergency"];
  row.activatedAt = nowIso();
  recordIdentifierEvent(state, { type: row.identifierType, value: row.id, operation: "Activate", user, nextState: "activated" }, uid);
  return { ok: true, delegation: row };
}

export function expireDelegations(state, now = Date.now()) {
  ensureIdentifierState(state);
  let count = 0;
  (state.identifierDelegations || []).forEach((item) => {
    if (item.status === "activated" && item.endAt && Date.parse(item.endAt) <= now) {
      item.status = "revoked";
      item.revokedAt = nowIso(now);
      count += 1;
    }
  });
  return count;
}

export function registerIdentifier(state, { type, value, entityId, lifecycle = "assigned" } = {}, uid) {
  ensureIdentifierState(state);
  if (FINANCIAL_NEVER_REUSE.has(type) && (state.identifierRegistry || []).some((item) => item.type === type && item.value === value)) {
    return { error: "Identifier already assigned" };
  }
  const row = {
    id: newId("idreg", uid),
    type,
    value,
    entityId: entityId || "",
    lifecycle,
    createdAt: nowIso()
  };
  state.identifierRegistry.push(row);
  return { ok: true, row };
}

export function identifierDashboard(state) {
  ensureIdentifierState(state);
  const dels = state.identifierDelegations || [];
  return {
    schemaVersion: IDENTIFIER_SCHEMA_VERSION,
    prefixes: Object.keys(BUSINESS_PREFIXES).length,
    aggregateTypes: AGGREGATE_TYPES.length,
    activeDelegations: dels.filter((item) => item.status === "activated").length,
    pendingDelegations: dels.filter((item) => ["draft", "submitted", "pending_approval", "approved"].includes(item.status)).length,
    versions: (state.aggregateVersions || []).length,
    externalRefs: (state.externalReferences || []).length
  };
}

export function buildSyncIdentity(kind, payload = {}, extras = {}) {
  const primary = extras.primary || describePrimaryAggregate(kind, payload);
  return {
    primaryAggregateType: primary.type,
    primaryAggregateId: primary.id,
    primaryAggregateVersion: extras.version || 1,
    secondaryAggregates: extras.secondary || describeSecondaryAggregates(kind, payload),
    dependencies: normalizeDependencies(extras.dependsOn, extras.dependencies)
  };
}
