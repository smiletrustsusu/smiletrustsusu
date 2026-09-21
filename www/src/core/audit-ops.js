/**
 * Central audit engine for Smile Trust.
 * Only write path: recordAuditEvent. Records are immutable.
 * G1 = atomic persist, G2 = persist + outbox, G3 = at-least-once, G4 = best effort.
 */

export const EVENT_SCHEMA_VERSION = "1.0.0";
export const AUDIT_CATEGORIES = [
  "authentication",
  "user",
  "customer",
  "agent",
  "financial",
  "group",
  "branch",
  "configuration",
  "security",
  "operational"
];
export const AUDIT_SEVERITIES = ["Informational", "Low", "Medium", "High", "Critical"];
export const GUARANTEE_LEVELS = ["G1", "G2", "G3", "G4"];
export const DEFAULT_RETENTION = {
  security: { days: 2555, label: "7 years" },
  financial: { permanent: true, label: "Permanent" },
  operational: { days: 2555, label: "7 years" },
  authentication: { days: 730, label: "2 years" },
  user: { days: 2555, label: "7 years" },
  customer: { days: 2555, label: "7 years" },
  agent: { days: 2555, label: "7 years" },
  group: { days: 2555, label: "7 years" },
  branch: { days: 2555, label: "7 years" },
  configuration: { permanent: true, label: "Permanent" },
  debug: { days: 90, label: "90 days" }
};
export const COMPLIANCE_REPORTS = [
  { id: "user-activity", label: "User Activity Report", category: "" },
  { id: "financial-activity", label: "Financial Activity Report", category: "financial" },
  { id: "login-history", label: "Login History", type: "Login Success" },
  { id: "failed-login", label: "Failed Login Report", type: "Login Failure" },
  { id: "permission-changes", label: "Permission Changes", typeIncludes: "Permission|Role Assigned" },
  { id: "configuration-changes", label: "Configuration Changes", category: "configuration" },
  { id: "data-access", label: "Data Access Report", typeIncludes: "View|Export|Access" },
  { id: "high-risk", label: "High-Risk Activities", severityIn: ["High", "Critical"] },
  { id: "approval-history", label: "Approval History", typeIncludes: "Approval|Approved" },
  { id: "transaction-history", label: "Transaction History", category: "financial" },
  { id: "audit-exception", label: "Audit Exception Report", resultIn: ["Failure", "Exception", "Permission Denied", "Validation Failed"] }
];

const ACTION_RULES = [
  { match: /login success|signed in/i, category: "authentication", type: "Login Success", severity: "Informational", guarantee: "G1", module: "1" },
  { match: /login fail|invalid login|inactive account/i, category: "authentication", type: "Login Failure", severity: "Medium", guarantee: "G1", module: "1" },
  { match: /logout|signed out/i, category: "authentication", type: "Logout", severity: "Informational", guarantee: "G1", module: "1" },
  { match: /password changed|password change/i, category: "authentication", type: "Password Change", severity: "High", guarantee: "G1", module: "1" },
  { match: /password reset/i, category: "authentication", type: "Password Reset", severity: "High", guarantee: "G1", module: "1" },
  { match: /mfa enabled/i, category: "authentication", type: "MFA Enabled", severity: "High", guarantee: "G1", module: "1" },
  { match: /mfa disabled/i, category: "authentication", type: "MFA Disabled", severity: "High", guarantee: "G1", module: "1" },
  { match: /session expired/i, category: "authentication", type: "Session Expired", severity: "Low", guarantee: "G1", module: "1" },
  { match: /account locked/i, category: "authentication", type: "Account Locked", severity: "High", guarantee: "G1", module: "1" },
  { match: /user created|default system account created/i, category: "user", type: "User Created", severity: "High", guarantee: "G1", module: "1" },
  { match: /user updated|user edited/i, category: "user", type: "User Updated", severity: "Medium", guarantee: "G1", module: "1" },
  { match: /user disabled/i, category: "user", type: "User Disabled", severity: "High", guarantee: "G1", module: "1" },
  { match: /user activated/i, category: "user", type: "User Activated", severity: "Medium", guarantee: "G1", module: "1" },
  { match: /user deleted/i, category: "user", type: "User Deleted", severity: "High", guarantee: "G1", module: "1" },
  { match: /role assigned/i, category: "user", type: "Role Assigned", severity: "High", guarantee: "G1", module: "1" },
  { match: /permission/i, category: "user", type: "Permission Changed", severity: "High", guarantee: "G1", module: "1" },
  { match: /customer registered|customer created/i, category: "customer", type: "Customer Registered", severity: "Medium", guarantee: "G1", module: "3" },
  { match: /customer updated/i, category: "customer", type: "Customer Updated", severity: "Low", guarantee: "G1", module: "3" },
  { match: /kyc/i, category: "customer", type: "KYC Verified", severity: "Medium", guarantee: "G1", module: "3" },
  { match: /customer suspended/i, category: "customer", type: "Customer Suspended", severity: "High", guarantee: "G1", module: "3" },
  { match: /customer reactivated/i, category: "customer", type: "Customer Reactivated", severity: "Medium", guarantee: "G1", module: "3" },
  { match: /customer merged/i, category: "customer", type: "Customer Merged", severity: "High", guarantee: "G1", module: "3" },
  { match: /customer transferred|member transfer/i, category: "customer", type: "Customer Transferred", severity: "Medium", guarantee: "G1", module: "3" },
  { match: /agent created/i, category: "agent", type: "Agent Created", severity: "Medium", guarantee: "G1", module: "4" },
  { match: /agent assigned/i, category: "agent", type: "Agent Assigned", severity: "Medium", guarantee: "G1", module: "4" },
  { match: /agent transferred/i, category: "agent", type: "Agent Transferred", severity: "Medium", guarantee: "G1", module: "4" },
  { match: /agent suspended/i, category: "agent", type: "Agent Suspended", severity: "High", guarantee: "G1", module: "4" },
  { match: /agent reactivated/i, category: "agent", type: "Agent Reactivated", severity: "Medium", guarantee: "G1", module: "4" },
  { match: /collection recorded|savings collection/i, category: "financial", type: "Savings Collection", severity: "High", guarantee: "G1", module: "6" },
  { match: /withdrawal request/i, category: "financial", type: "Withdrawal Request", severity: "High", guarantee: "G1", module: "9" },
  { match: /withdrawal approv/i, category: "financial", type: "Withdrawal Approval", severity: "High", guarantee: "G1", module: "9" },
  { match: /withdrawal (paid|payment)|paid withdrawal/i, category: "financial", type: "Withdrawal Payment", severity: "High", guarantee: "G1", module: "9" },
  { match: /loan application|loan created/i, category: "financial", type: "Loan Application", severity: "High", guarantee: "G1", module: "8" },
  { match: /loan approv/i, category: "financial", type: "Loan Approval", severity: "High", guarantee: "G1", module: "8" },
  { match: /loan disburs/i, category: "financial", type: "Loan Disbursement", severity: "High", guarantee: "G1", module: "8" },
  { match: /loan repay/i, category: "financial", type: "Loan Repayment", severity: "High", guarantee: "G1", module: "8" },
  { match: /interest post/i, category: "financial", type: "Interest Posting", severity: "High", guarantee: "G1", module: "8" },
  { match: /penalty post/i, category: "financial", type: "Penalty Posting", severity: "High", guarantee: "G1", module: "8" },
  { match: /journal/i, category: "financial", type: "Journal Posting", severity: "High", guarantee: "G1", module: "10" },
  { match: /payment initiated/i, category: "financial", type: "Payment Initiated", severity: "High", guarantee: "G1", module: "16" },
  { match: /payment callback/i, category: "financial", type: "Payment Callback", severity: "High", guarantee: "G1", module: "16" },
  { match: /payment refund/i, category: "financial", type: "Payment Refund", severity: "Critical", guarantee: "G1", module: "16" },
  { match: /payment reversal/i, category: "financial", type: "Payment Reversal", severity: "Critical", guarantee: "G1", module: "16" },
  { match: /payment reconciliation|settlement recorded/i, category: "financial", type: "Payment Settlement", severity: "High", guarantee: "G1", module: "16" },
  { match: /document generated|document issued/i, category: "operational", type: "Document Issued", severity: "Medium", guarantee: "G1", module: "17" },
  { match: /document signed/i, category: "security", type: "Document Signed", severity: "High", guarantee: "G1", module: "17" },
  { match: /offline receipt reconciled|duplicate receipt synchronization/i, category: "financial", type: "Receipt Reconciliation", severity: "High", guarantee: "G1", module: "17" },
  { match: /receipt approval|temporary receipt rejected|temporary receipt cancelled/i, category: "financial", type: "Receipt Authorization", severity: "High", guarantee: "G1", module: "17" },
  { match: /document template/i, category: "configuration", type: "Document Template Changed", severity: "Medium", guarantee: "G1", module: "17" },
  { match: /reversal/i, category: "financial", type: "Reversal", severity: "Critical", guarantee: "G1", module: "6" },
  { match: /adjustment/i, category: "financial", type: "Adjustment", severity: "High", guarantee: "G1", module: "6" },
  { match: /expense/i, category: "financial", type: "Expense Payment", severity: "High", guarantee: "G1", module: "10" },
  { match: /cash transfer/i, category: "financial", type: "Cash Transfer", severity: "High", guarantee: "G1", module: "10" },
  { match: /group created/i, category: "group", type: "Group Created", severity: "Medium", guarantee: "G1", module: "7" },
  { match: /meeting started/i, category: "group", type: "Meeting Started", severity: "Informational", guarantee: "G1", module: "7" },
  { match: /attendance/i, category: "group", type: "Attendance Recorded", severity: "Low", guarantee: "G1", module: "7" },
  { match: /contribution recorded/i, category: "group", type: "Contribution Recorded", severity: "High", guarantee: "G1", module: "7" },
  { match: /share-?out/i, category: "group", type: "Share-Out Completed", severity: "High", guarantee: "G1", module: "7" },
  { match: /branch created/i, category: "branch", type: "Branch Created", severity: "High", guarantee: "G1", module: "5" },
  { match: /branch updated/i, category: "branch", type: "Branch Updated", severity: "Medium", guarantee: "G1", module: "5" },
  { match: /branch closed/i, category: "branch", type: "Branch Closed", severity: "High", guarantee: "G1", module: "5" },
  { match: /branch reopen/i, category: "branch", type: "Branch Reopened", severity: "Medium", guarantee: "G1", module: "5" },
  { match: /system settings|color mode|theme changed/i, category: "configuration", type: "System Settings Changed", severity: "Medium", guarantee: "G1", module: "2" },
  { match: /product/i, category: "configuration", type: "Product Modified", severity: "High", guarantee: "G1", module: "6" },
  { match: /tax/i, category: "configuration", type: "Tax Configuration Changed", severity: "High", guarantee: "G1", module: "10" },
  { match: /threshold/i, category: "configuration", type: "Threshold Changed", severity: "Medium", guarantee: "G1", module: "12" },
  { match: /notification provider/i, category: "configuration", type: "Notification Provider Updated", severity: "Medium", guarantee: "G1", module: "12" },
  { match: /chart of accounts/i, category: "configuration", type: "Chart of Accounts Updated", severity: "High", guarantee: "G1", module: "10" },
  { match: /unauthorized|integrity violation/i, category: "security", type: "Unauthorized Access Attempt", severity: "Critical", guarantee: "G1", module: "13" },
  { match: /permission denied/i, category: "security", type: "Permission Denied", severity: "High", guarantee: "G1", module: "13" },
  { match: /api authentication failure/i, category: "security", type: "API Authentication Failure", severity: "High", guarantee: "G1", module: "1" },
  { match: /suspicious login/i, category: "security", type: "Suspicious Login", severity: "High", guarantee: "G1", module: "1" },
  { match: /multiple failed login/i, category: "security", type: "Multiple Failed Logins", severity: "High", guarantee: "G1", module: "1" },
  { match: /device registration/i, category: "security", type: "Device Registration", severity: "Low", guarantee: "G1", module: "1" },
  { match: /device revocation/i, category: "security", type: "Device Revocation", severity: "Medium", guarantee: "G1", module: "1" },
  { match: /report generated|dashboard refresh|analytics/i, category: "operational", type: "Report Generated", severity: "Informational", guarantee: "G2", module: "11" },
  { match: /notification viewed|cache refresh|debug/i, category: "operational", type: "Operational Event", severity: "Informational", guarantee: "G3", module: "12" }
];

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

export function classifyAuditAction(action = "", extras = {}) {
  const hit = ACTION_RULES.find((rule) => rule.match.test(action));
  const category = extras.category || hit?.category || "operational";
  const guarantee = extras.guarantee || hit?.guarantee || (category === "operational" ? "G3" : "G1");
  return {
    category,
    eventType: extras.eventType || hit?.type || action || "Activity",
    severity: extras.severity || hit?.severity || (category === "financial" || category === "security" ? "High" : "Informational"),
    guarantee,
    deliveryClass: extras.deliveryClass || (guarantee === "G1" || guarantee === "G2" ? "A" : "B"),
    module: extras.module || hit?.module || extras.sourceModule || ""
  };
}

export function canonicalize(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function payloadHash(value) {
  const text = typeof value === "string" ? value : canonicalize(value);
  let h1 = 2166136261;
  let h2 = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 ^= text.charCodeAt(text.length - 1 - i);
    h2 = Math.imul(h2, 16777619);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function fieldDiff(before, after) {
  if (before == null && after == null) return [];
  if (typeof before !== "object" || typeof after !== "object" || !before || !after) {
    if (canonicalize(before) === canonicalize(after)) return [];
    return [{ field: "value", previousValue: before, newValue: after }];
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  keys.forEach((field) => {
    if (canonicalize(before[field]) === canonicalize(after[field])) return;
    changes.push({ field, previousValue: before[field], newValue: after[field] });
  });
  return changes;
}

export function ensureAuditState(state = {}) {
  state.audit = state.audit || [];
  state.auditOutbox = state.auditOutbox || [];
  state.auditArchives = state.auditArchives || [];
  state.auditIntegrityChecks = state.auditIntegrityChecks || [];
  state.auditActivityLogs = state.auditActivityLogs || [];
  state.auditRetentionPolicies = state.auditRetentionPolicies || [];
  state.savedAuditFilters = state.savedAuditFilters || [];
  state.auditAlerts = state.auditAlerts || [];
  state.auditExports = state.auditExports || [];
  if (!state.auditRetentionPolicies.length) {
    state.auditRetentionPolicies = Object.entries(DEFAULT_RETENTION).map(([category, policy]) => ({
      id: `ret-${category}`,
      category,
      days: policy.days || null,
      permanent: Boolean(policy.permanent),
      label: policy.label
    }));
  }
  return state;
}

export function recordOperationalLog(state, action, details = "", extras = {}) {
  ensureAuditState(state);
  state.auditActivityLogs.push({
    id: extras.id || `alog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    details,
    createdAt: nowIso(extras.now),
    kind: "engine",
    ...extras
  });
}

function lastHashed(state) {
  for (let i = (state.audit || []).length - 1; i >= 0; i -= 1) {
    if (state.audit[i]?.hash) return state.audit[i];
  }
  return null;
}

function nextSequence(state, correlationId) {
  return (state.audit || []).filter((row) => row.correlationId === correlationId).length + 1;
}

function findDuplicate(state, eventId, idempotencyKey) {
  return (state.audit || []).find((row) =>
    (eventId && row.eventId === eventId) || (idempotencyKey && row.idempotencyKey === idempotencyKey)
  ) || (state.auditArchives || []).find((row) =>
    (eventId && row.eventId === eventId) || (idempotencyKey && row.idempotencyKey === idempotencyKey)
  );
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordAuditEvent(state, payload = {}, uid) {
  ensureAuditState(state);
  if (payload.forcePersistFailure) {
    const error = new Error("Audit persist failed");
    if ((payload.guarantee || classifyAuditAction(payload.action, payload).guarantee) === "G4") {
      return { ok: false, bestEffort: true, error: error.message };
    }
    throw error;
  }
  const classified = classifyAuditAction(payload.action, payload);
  const eventId = payload.eventId || newId("evt", uid);
  const idempotencyKey = payload.idempotencyKey || "";
  const existing = findDuplicate(state, eventId, idempotencyKey);
  if (existing) {
    recordOperationalLog(state, "Duplicate submission ignored", existing.id, { eventId, idempotencyKey });
    return { ok: true, duplicate: true, event: existing };
  }
  const createdAt = payload.createdAt || nowIso(payload.now);
  const correlationId = payload.correlationId || payload.transactionId || eventId;
  const changes = payload.changes || fieldDiff(payload.previousValue ?? payload.before, payload.newValue ?? payload.after);
  const previous = lastHashed(state);
  const payloadBody = {
    eventId,
    correlationId,
    action: payload.action || classified.eventType,
    details: payload.details || payload.eventDescription || "",
    userId: payload.userId || "",
    createdAt,
    changes
  };
  const row = {
    id: payload.id || newId("audit", uid),
    eventId,
    correlationId,
    transactionId: payload.transactionId || "",
    idempotencyKey: idempotencyKey || eventId,
    sequenceNumber: payload.sequenceNumber || nextSequence(state, correlationId),
    action: payload.action || classified.eventType,
    details: payload.details || payload.eventDescription || "",
    eventDescription: payload.eventDescription || payload.details || "",
    userId: payload.userId || "",
    username: payload.username || "",
    fullName: payload.fullName || "",
    role: payload.role || "",
    branch: payload.branch || payload.branchId || "",
    groupIds: payload.groupIds || (payload.branch ? [payload.branch] : []),
    category: classified.category,
    eventType: classified.eventType,
    sourceModule: classified.module,
    module: classified.module,
    actionPerformed: payload.actionPerformed || payload.action || classified.eventType,
    entityType: payload.entityType || "",
    entityId: payload.entityId || "",
    entityName: payload.entityName || "",
    parentEntity: payload.parentEntity || "",
    previousValue: changes.length ? undefined : payload.previousValue,
    newValue: changes.length ? undefined : payload.newValue,
    changes,
    date: payload.date || new Date(createdAt).toLocaleString(),
    createdAt,
    utcTimestamp: createdAt,
    deviceId: payload.deviceId || "",
    deviceType: payload.deviceType || "",
    applicationVersion: payload.applicationVersion || "",
    operatingSystem: payload.operatingSystem || "",
    ipAddress: payload.ipAddress || "",
    gps: payload.gps || "",
    sessionId: payload.sessionId || "",
    requestId: payload.requestId || "",
    result: payload.result || "Success",
    errorCode: payload.errorCode || "",
    errorMessage: payload.errorMessage || "",
    severity: classified.severity,
    guarantee: classified.guarantee,
    deliveryClass: classified.deliveryClass,
    eventSchemaVersion: payload.eventSchemaVersion || EVENT_SCHEMA_VERSION,
    eventTypeVersion: payload.eventTypeVersion || "1",
    archived: false,
    immutable: true,
    journalRef: payload.journalRef || "",
    approvalRef: payload.approvalRef || ""
  };
  row.prevHash = previous?.hash || "";
  row.payloadHash = payloadHash(payloadBody);
  row.hash = payloadHash({ ...payloadBody, prevHash: row.prevHash, payloadHash: row.payloadHash });
  if (classified.guarantee === "G1" || classified.guarantee === "G2") {
    state.audit.push(row);
  } else if (classified.guarantee === "G3") {
    state.audit.push(row);
  } else {
    try {
      state.audit.push(row);
    } catch {
      return { ok: false, bestEffort: true, error: "Best-effort persist skipped" };
    }
  }
  if (classified.guarantee === "G2" || classified.guarantee === "G3") {
    state.auditOutbox.push({
      id: newId("outbox", uid),
      auditId: row.id,
      eventId: row.eventId,
      correlationId: row.correlationId,
      sequenceNumber: row.sequenceNumber,
      payloadHash: row.payloadHash,
      status: "pending",
      retryCount: 0,
      lastAttempt: "",
      createdAt,
      topic: payload.topic || classified.category
    });
  }
  return { ok: true, event: row };
}

export function mutateAuditEvent() {
  return { ok: false, error: "Audit records are immutable" };
}

export function deleteAuditEvent() {
  return { ok: false, error: "Audit records cannot be deleted" };
}

export function overwriteAuditEvent() {
  return { ok: false, error: "Audit records cannot be overwritten" };
}

export function withClassATransaction(state, keys, work) {
  const snap = Object.fromEntries(keys.map((key) => [key, (state[key] || []).length]));
  try {
    const result = work();
    if (result && result.ok === false) throw new Error(result.error || "Class A persist failed");
    return result || { ok: true };
  } catch (error) {
    keys.forEach((key) => {
      if (Array.isArray(state[key])) state[key].length = snap[key];
    });
    return { ok: false, error: error.message, rolledBack: true };
  }
}

export function searchAudit(state, filters = {}) {
  ensureAuditState(state);
  const hay = [...(state.audit || []), ...(filters.includeArchives ? state.auditArchives || [] : [])];
  const q = String(filters.q || "").toLowerCase();
  return hay.filter((row) => {
    if (row.archived && !filters.includeArchives) return false;
    if (filters.auditId && row.id !== filters.auditId) return false;
    if (filters.eventId && row.eventId !== filters.eventId) return false;
    if (filters.transactionId && row.transactionId !== filters.transactionId && !String(row.details || "").includes(filters.transactionId)) return false;
    if (filters.correlationId && row.correlationId !== filters.correlationId) return false;
    if (filters.userId && row.userId !== filters.userId) return false;
    if (filters.user && ![row.username, row.fullName, row.userId].some((v) => String(v || "").toLowerCase().includes(String(filters.user).toLowerCase()))) return false;
    if (filters.customer && ![row.entityName, row.entityId, row.details].some((v) => String(v || "").toLowerCase().includes(String(filters.customer).toLowerCase()))) return false;
    if (filters.branch && row.branch !== filters.branch && !(row.groupIds || []).includes(filters.branch)) return false;
    if (filters.eventType && row.eventType !== filters.eventType && row.action !== filters.eventType) return false;
    if (filters.severity && row.severity !== filters.severity) return false;
    if (filters.module && String(row.module) !== String(filters.module) && String(row.sourceModule) !== String(filters.module)) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.device && row.deviceId !== filters.device) return false;
    if (filters.ipAddress && row.ipAddress !== filters.ipAddress) return false;
    if (filters.result && row.result !== filters.result) return false;
    if (filters.from && String(row.createdAt || "").slice(0, 10) < filters.from) return false;
    if (filters.to && String(row.createdAt || "").slice(0, 10) > filters.to) return false;
    if (q) {
      const blob = [row.id, row.action, row.details, row.eventType, row.username, row.fullName, row.entityName, row.correlationId, row.transactionId].join(" ").toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function eventPayloadBody(row) {
  return {
    eventId: row.eventId,
    correlationId: row.correlationId,
    action: row.action,
    details: row.details,
    userId: row.userId,
    createdAt: row.createdAt,
    changes: row.changes
  };
}

export function auditTimeline(state, entityType, entityId) {
  return searchAudit(state, { includeArchives: true }).filter((row) => {
    if (row.correlationId && row.correlationId === entityId) return true;
    if (entityType === "user") return row.userId === entityId;
    if (entityType === "transaction") return row.transactionId === entityId;
    return row.entityId === entityId;
  });
}

export function verifyAuditIntegrity(state, uid, extras = {}) {
  ensureAuditState(state);
  const hashed = (state.audit || []).filter((row) => row.hash);
  const breaks = [];
  let prev = "";
  hashed.forEach((row) => {
    const expectedPrev = prev;
    const body = eventPayloadBody(row);
    const expectedHash = payloadHash({ ...body, prevHash: row.prevHash || "", payloadHash: payloadHash(body) });
    if ((row.prevHash || "") !== expectedPrev && expectedPrev) {
      breaks.push({ id: row.id, reason: "chain-break" });
    }
    if (row.hash !== expectedHash) {
      breaks.push({ id: row.id, reason: "payload-mismatch" });
    }
    prev = row.hash;
  });
  const check = {
    id: extras.id || newId("ichk", uid),
    createdAt: nowIso(extras.now),
    hashed: hashed.length,
    breaks: breaks.length,
    ok: breaks.length === 0,
    details: breaks
  };
  state.auditIntegrityChecks.push(check);
  recordOperationalLog(state, "Integrity Verification Completed", check.ok ? "ok" : `${breaks.length} break(s)`, { checkId: check.id });
  if (!check.ok && !extras.skipAlert) {
    recordAuditEvent(state, {
      action: "Integrity violation",
      details: `${breaks.length} unauthorized modification(s) detected`,
      category: "security",
      eventType: "Unauthorized Access Attempt",
      severity: "Critical",
      guarantee: "G1",
      result: "Failure",
      userId: extras.userId || "system"
    }, uid);
    state.auditAlerts.push({
      id: newId("alert", uid),
      severity: "Critical",
      message: "Audit integrity violation",
      createdAt: check.createdAt,
      checkId: check.id
    });
  }
  return check;
}

export function processAuditOutbox(state, options = {}) {
  ensureAuditState(state);
  const now = options.now || Date.now();
  const maxRetries = options.maxRetries ?? 5;
  const transport = options.transport || (() => ({ ok: true }));
  let published = 0;
  let retried = 0;
  let dead = 0;
  const pending = (state.auditOutbox || [])
    .filter((item) => item.status === "pending" || item.status === "retry")
    .sort((a, b) => {
      if (a.correlationId === b.correlationId) return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  recordOperationalLog(state, "Queue Processing Started", `${pending.length} pending`, { now });
  pending.forEach((item) => {
    const delay = Math.min(300000, (2 ** (item.retryCount || 0)) * 1000);
    if (item.lastAttempt && Date.parse(item.lastAttempt) + delay > now && item.retryCount) return;
    item.lastAttempt = nowIso(now);
    item.retryCount = (item.retryCount || 0) + 1;
    const event = (state.audit || []).find((row) => row.id === item.auditId);
    if (event && payloadHash(eventPayloadBody(event)) !== event.payloadHash) {
      item.status = "dead";
      item.failureReason = "payload-hash-mismatch";
      dead += 1;
      recordOperationalLog(state, "Dead Letter Created", item.id, { reason: item.failureReason });
      return;
    }
    const result = transport(item, event);
    if (result?.ok) {
      item.status = "published";
      item.publishedAt = nowIso(now);
      published += 1;
      recordOperationalLog(state, "Retry Succeeded", item.id);
    } else if (item.retryCount >= maxRetries) {
      item.status = "dead";
      item.failureReason = result?.error || "retry-exhausted";
      dead += 1;
      recordOperationalLog(state, "Retry Exhausted", item.id);
      recordOperationalLog(state, "Dead Letter Created", item.id, { reason: item.failureReason, retryCount: item.retryCount, lastAttempt: item.lastAttempt });
    } else {
      item.status = "retry";
      retried += 1;
      recordOperationalLog(state, "Retry Scheduled", item.id, { retryCount: item.retryCount });
    }
  });
  recordOperationalLog(state, "Queue Processing Completed", `published=${published}`);
  return { published, retried, dead };
}

export function replayDeadLetter(state, outboxId, options = {}) {
  ensureAuditState(state);
  const item = (state.auditOutbox || []).find((row) => row.id === outboxId);
  if (!item || item.status !== "dead") return { error: "Dead-letter item not found" };
  const event = (state.audit || []).find((row) => row.id === item.auditId);
  const expected = event ? payloadHash(eventPayloadBody(event)) : "";
  if (!event || expected !== event.payloadHash) return { error: "Original payload failed integrity check" };
  item.status = "pending";
  item.retryCount = 0;
  item.failureReason = "";
  recordOperationalLog(state, "Dead Letter Reprocessed", item.id);
  return processAuditOutbox(state, options);
}

export function archiveExpiredAudit(state, extras = {}) {
  ensureAuditState(state);
  const now = extras.now || Date.now();
  let archived = 0;
  (state.audit || []).forEach((row) => {
    if (row.archived) return;
    const policy = (state.auditRetentionPolicies || []).find((item) => item.category === row.category)
      || DEFAULT_RETENTION[row.category]
      || DEFAULT_RETENTION.operational;
    if (policy.permanent) return;
    const days = policy.days || 2555;
    const age = (now - Date.parse(row.createdAt || 0)) / 86400000;
    if (age < days) return;
    row.archived = true;
    state.auditArchives.push({ ...row, archivedAt: nowIso(now), readOnly: true });
    archived += 1;
  });
  return { archived };
}

export function complianceReport(state, reportId, filters = {}) {
  const spec = COMPLIANCE_REPORTS.find((item) => item.id === reportId);
  if (!spec) return [];
  return searchAudit(state, { ...filters, includeArchives: true }).filter((row) => {
    if (spec.category && row.category !== spec.category) return false;
    if (spec.type && row.eventType !== spec.type) return false;
    if (spec.typeIncludes && !new RegExp(spec.typeIncludes, "i").test(`${row.eventType} ${row.action}`)) return false;
    if (spec.severityIn && !spec.severityIn.includes(row.severity)) return false;
    if (spec.resultIn && !spec.resultIn.includes(row.result)) return false;
    return true;
  });
}

export function complianceCsv(rows, watermark = "") {
  const headers = ["id", "createdAt", "action", "eventType", "category", "severity", "details", "userId", "username", "entityType", "entityId", "correlationId", "transactionId", "result"];
  const lines = [
    watermark ? `# ${watermark}` : "",
    headers.join(","),
    ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, "\"\"")}"`).join(","))
  ].filter(Boolean);
  return lines.join("\n");
}

export function saveAuditFilter(state, name, filters, uid) {
  ensureAuditState(state);
  const row = {
    id: newId("afilter", uid),
    name,
    filters,
    createdAt: nowIso()
  };
  state.savedAuditFilters.push(row);
  return row;
}

export function auditDashboardStats(state) {
  ensureAuditState(state);
  const today = nowIso().slice(0, 10);
  const rows = state.audit || [];
  const outbox = state.auditOutbox || [];
  const lastCheck = [...(state.auditIntegrityChecks || [])].pop();
  return {
    total: rows.length,
    today: rows.filter((row) => String(row.createdAt).slice(0, 10) === today).length,
    financial: rows.filter((row) => row.category === "financial").length,
    security: rows.filter((row) => row.category === "security" || row.category === "authentication").length,
    failedLogins: rows.filter((row) => row.eventType === "Login Failure").length,
    highRisk: rows.filter((row) => row.severity === "High" || row.severity === "Critical").length,
    pendingOutbox: outbox.filter((row) => row.status === "pending" || row.status === "retry").length,
    deadLetters: outbox.filter((row) => row.status === "dead").length,
    published: outbox.filter((row) => row.status === "published").length,
    archives: (state.auditArchives || []).length,
    integrityOk: lastCheck ? lastCheck.ok : true
  };
}

export function auditDeliveryStats(state) {
  const stats = auditDashboardStats(state);
  const logs = state.auditActivityLogs || [];
  return {
    eventsGenerated: stats.total,
    eventsPersisted: stats.total,
    eventsPublished: stats.published,
    pendingOutbox: stats.pendingOutbox,
    deadLetterQueue: stats.deadLetters,
    retries: logs.filter((row) => row.action === "Retry Scheduled").length,
    slo: {
      auditPersistence: 99.99,
      outboxPersistence: 99.99,
      lostEventRateG1G2: 0
    }
  };
}

export function recentFailedLogins(state, username, windowMs = 15 * 60 * 1000, now = Date.now()) {
  return (state.audit || []).filter((row) =>
    row.eventType === "Login Failure"
    && String(row.username || "").toLowerCase() === String(username || "").toLowerCase()
    && now - Date.parse(row.createdAt || 0) <= windowMs
  ).length;
}

export function redactAuditForViewer(row, privileged = false) {
  if (privileged || !row) return row;
  const copy = { ...row };
  if (copy.ipAddress) {
    const parts = String(copy.ipAddress).split(".");
    copy.ipAddress = parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "redacted";
  }
  if (copy.gps) copy.gps = "";
  return copy;
}

export function mergeAuditImmutable(localRows = [], remoteRows = []) {
  const merged = new Map();
  [...localRows, ...remoteRows].forEach((row) => {
    if (!row?.id) return;
    const existing = merged.get(row.id);
    if (!existing) {
      merged.set(row.id, row);
      return;
    }
    merged.set(row.id, existing.hash ? existing : (row.hash ? row : existing));
  });
  return Array.from(merged.values());
}
