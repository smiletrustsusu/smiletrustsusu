/**
 * Idempotency key lifecycle and exactly-once boundaries.
 * Exactly-once persistence and business effects apply only inside the trusted
 * transactional boundary. External providers are at-least-once / best-effort.
 */

import { payloadHash, recordOperationalLog } from "./audit-ops.js";

export const TRUSTED_BOUNDARY = [
  "Application Services",
  "Domain Services",
  "Validation Engine",
  "Approval Engine",
  "Accounting Engine",
  "Audit Engine",
  "Relational Database",
  "Transaction Manager",
  "Transactional Outbox",
  "Internal Event Store"
];

export const EXTERNAL_SYSTEMS = [
  "SMS gateways",
  "WhatsApp Business providers",
  "Email providers",
  "Push notification services",
  "Mobile Money platforms",
  "Banking APIs",
  "Payment gateways",
  "Government or regulatory APIs",
  "Third-party integrations"
];

export const EXACTLY_ONCE = {
  persistence: "trusted-boundary",
  businessEffects: "trusted-boundary",
  processing: "idempotent-retries",
  publication: "at-least-once",
  delivery: "not-guaranteed"
};

export const KEY_STATUSES = ["created", "received", "processing", "succeeded", "failed", "cancelled", "expired"];

export const RETENTION_DAYS = {
  financial: 365,
  notification: 30,
  job: 7,
  webhook: 90
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPOSITE_RE = /^[a-z0-9._:-]{8,200}$/i;

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${hex().slice(0, 8)}-${hex().slice(0, 4)}-7${hex().slice(1, 4)}-a${hex().slice(1, 4)}-${hex()}${hex().slice(0, 4)}`;
}

export function isValidIdempotencyKey(key) {
  const value = String(key || "").trim();
  if (!value) return false;
  if (/^\d+$/.test(value)) return false;
  if (UUID_RE.test(value)) return true;
  if (value.startsWith("idem-")) return true;
  return COMPOSITE_RE.test(value);
}

export function requestFingerprint(fields = {}) {
  return payloadHash({
    operationType: fields.operationType || "",
    customerId: fields.customerId || "",
    amount: fields.amount ?? "",
    currency: fields.currency || "GHS",
    branchId: fields.branchId || "",
    date: fields.date || "",
    paymentMethod: fields.paymentMethod || "",
    externalReference: fields.externalReference || ""
  });
}

export function retentionDaysFor(operationType = "") {
  if (/notif|sms|email|push|whatsapp/i.test(operationType)) return RETENTION_DAYS.notification;
  if (/job|schedule|background/i.test(operationType)) return RETENTION_DAYS.job;
  if (/webhook|momo|bank|callback/i.test(operationType)) return RETENTION_DAYS.webhook;
  return RETENTION_DAYS.financial;
}

export function ensureIdempotencyState(state = {}) {
  state.idempotencyKeys = state.idempotencyKeys || [];
  state.idempotencyActivityLogs = state.idempotencyActivityLogs || [];
  state.idempotencyArchives = state.idempotencyArchives || [];
  return state;
}

function findKey(state, key, operationType = "") {
  const normalized = String(key || "").toLowerCase();
  return (state.idempotencyKeys || []).find((row) =>
    String(row.idempotencyKey || "").toLowerCase() === normalized
    && (!operationType || row.operationType === operationType)
  ) || null;
}

function logLifecycle(state, row, previousState, extras = {}) {
  ensureIdempotencyState(state);
  const entry = {
    id: extras.id || newId("ikeylog"),
    idempotencyKey: row.idempotencyKey,
    previousState,
    newState: row.requestStatus,
    correlationId: row.correlationId,
    requestFingerprint: row.requestFingerprint,
    userId: extras.userId || row.userId || "",
    source: extras.source || row.source || "",
    resolution: extras.resolution || "",
    originalTransactionId: extras.originalTransactionId || row.transactionId || "",
    durationMs: extras.durationMs || 0,
    createdAt: nowIso(extras.now),
    result: extras.result || row.requestStatus
  };
  state.idempotencyActivityLogs.push(entry);
  recordOperationalLog(state, extras.auditAction || "Idempotency lifecycle", `${row.idempotencyKey} · ${previousState} → ${row.requestStatus}`, {
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    kind: "engine"
  });
}

export function recordDuplicateHit(state, {
  idempotencyKey = "",
  source = "",
  resolution = "Original Returned",
  originalTransactionId = "",
  correlationId = "",
  now
} = {}) {
  ensureIdempotencyState(state);
  logLifecycle(state, {
    idempotencyKey,
    requestStatus: "succeeded",
    correlationId,
    requestFingerprint: "",
    transactionId: originalTransactionId,
    userId: ""
  }, "succeeded", {
    source,
    resolution,
    originalTransactionId,
    auditAction: "Duplicate request prevented",
    now
  });
}

export function beginIdempotentRequest(state, payload = {}, uid) {
  ensureIdempotencyState(state);
  const key = String(payload.idempotencyKey || "").trim();
  if (!isValidIdempotencyKey(key)) {
    return { ok: false, proceed: false, error: "Malformed idempotency key" };
  }
  const operationType = payload.operationType || "unknown";
  const fingerprint = payload.fingerprintHash || requestFingerprint({ ...payload.fingerprint, operationType });
  const now = payload.now || Date.now();
  const existing = findKey(state, key, operationType) || findKey(state, key);
  if (existing) {
    if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
      logLifecycle(state, existing, existing.requestStatus, {
        source: payload.source,
        resolution: "Rejected",
        auditAction: "Idempotency key conflict",
        now
      });
      return {
        ok: false,
        proceed: false,
        conflict: true,
        error: "Idempotency Key Conflict",
        status: existing.requestStatus,
        record: existing
      };
    }
    if (existing.requestStatus === "processing" && Date.parse(existing.lockUntil || 0) > now) {
      recordDuplicateHit(state, {
        idempotencyKey: key,
        source: payload.source,
        resolution: "Ignored",
        originalTransactionId: existing.transactionId,
        correlationId: existing.correlationId,
        now
      });
      return {
        ok: false,
        proceed: false,
        processing: true,
        statusCode: 409,
        error: "Request already processing",
        record: existing
      };
    }
    if (existing.requestStatus === "succeeded") {
      recordDuplicateHit(state, {
        idempotencyKey: key,
        source: payload.source,
        resolution: "Original Returned",
        originalTransactionId: existing.transactionId,
        correlationId: existing.correlationId,
        now
      });
      return {
        ok: true,
        proceed: false,
        duplicate: true,
        status: "succeeded",
        response: existing.responsePayload,
        record: existing
      };
    }
    if (existing.requestStatus === "failed" && existing.failureClass === "permanent") {
      return {
        ok: false,
        proceed: false,
        status: "failed",
        error: existing.errorMessage || "Permanent failure",
        record: existing
      };
    }
    if (existing.requestStatus === "cancelled") {
      return { ok: false, proceed: false, status: "cancelled", error: "Key is closed. Submit a new idempotency key.", record: existing };
    }
    if (existing.requestStatus === "expired") {
      return { ok: false, proceed: false, status: "expired", error: "Idempotency key expired. Submit a new key.", record: existing };
    }
    const previous = existing.requestStatus;
    existing.requestStatus = "processing";
    existing.processingStartedAt = nowIso(now);
    existing.lockUntil = new Date(now + (payload.lockMs || 30000)).toISOString();
    existing.updatedAt = nowIso(now);
    existing.versionNumber = (existing.versionNumber || 1) + 1;
    logLifecycle(state, existing, previous, { source: payload.source, userId: payload.userId, now });
    return { ok: true, proceed: true, record: existing, retry: true };
  }
  const days = retentionDaysFor(operationType);
  const row = {
    id: newId("ikey", uid),
    idempotencyKey: key,
    operationType,
    requestFingerprint: fingerprint,
    correlationId: payload.correlationId || payload.requestId || key,
    requestId: payload.requestId || newId("req", uid),
    requestStatus: "processing",
    responseStatus: "",
    responsePayload: null,
    transactionId: "",
    journalId: "",
    receiptNumber: "",
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    expiresAt: new Date(now + days * 86400000).toISOString(),
    processingStartedAt: nowIso(now),
    processingCompletedAt: "",
    lockUntil: new Date(now + (payload.lockMs || 30000)).toISOString(),
    versionNumber: 1,
    source: payload.source || "",
    userId: payload.userId || "",
    clientId: payload.clientId || "",
    failureClass: "",
    errorMessage: ""
  };
  state.idempotencyKeys.push(row);
  logLifecycle(state, row, "created", { source: payload.source, userId: payload.userId, now });
  return { ok: true, proceed: true, record: row };
}

export function completeIdempotentRequest(state, key, result = {}, extras = {}) {
  ensureIdempotencyState(state);
  const row = findKey(state, key);
  if (!row) return { error: "Idempotency key not found" };
  const previous = row.requestStatus;
  row.requestStatus = "succeeded";
  row.responseStatus = result.responseStatus || 200;
  row.responsePayload = result.responsePayload || result;
  row.transactionId = result.transactionId || row.transactionId;
  row.journalId = result.journalId || "";
  row.receiptNumber = result.receiptNumber || result.receiptNo || "";
  row.processingCompletedAt = nowIso(extras.now);
  row.lockUntil = "";
  row.updatedAt = row.processingCompletedAt;
  row.versionNumber = (row.versionNumber || 1) + 1;
  const started = Date.parse(row.processingStartedAt || 0);
  logLifecycle(state, row, previous, {
    source: extras.source,
    userId: extras.userId,
    durationMs: started ? Date.parse(row.processingCompletedAt) - started : 0,
    now: extras.now
  });
  return { ok: true, record: row };
}

export function failIdempotentRequest(state, key, { recoverable = true, error = "", now } = {}) {
  ensureIdempotencyState(state);
  const row = findKey(state, key);
  if (!row) return { error: "Idempotency key not found" };
  const previous = row.requestStatus;
  row.requestStatus = "failed";
  row.failureClass = recoverable ? "recoverable" : "permanent";
  row.errorMessage = error;
  row.lockUntil = recoverable ? "" : row.lockUntil;
  row.processingCompletedAt = nowIso(now);
  row.updatedAt = row.processingCompletedAt;
  row.versionNumber = (row.versionNumber || 1) + 1;
  logLifecycle(state, row, previous, { result: row.failureClass, now });
  return { ok: true, record: row };
}

export function cancelIdempotentRequest(state, key, extras = {}) {
  ensureIdempotencyState(state);
  const row = findKey(state, key);
  if (!row || row.requestStatus === "succeeded") return { error: "Cannot cancel this key" };
  const previous = row.requestStatus;
  row.requestStatus = "cancelled";
  row.lockUntil = "";
  row.updatedAt = nowIso(extras.now);
  row.versionNumber = (row.versionNumber || 1) + 1;
  logLifecycle(state, row, previous, extras);
  return { ok: true, record: row };
}

export function expireIdempotencyKeys(state, extras = {}) {
  ensureIdempotencyState(state);
  const now = extras.now || Date.now();
  let expired = 0;
  (state.idempotencyKeys || []).forEach((row) => {
    if (row.requestStatus !== "succeeded") return;
    if (Date.parse(row.expiresAt || 0) > now) return;
    const previous = row.requestStatus;
    row.requestStatus = "expired";
    row.updatedAt = nowIso(now);
    expired += 1;
    logLifecycle(state, row, previous, { now });
  });
  return { expired };
}

export function cleanupExpiredIdempotencyKeys(state, extras = {}) {
  ensureIdempotencyState(state);
  expireIdempotencyKeys(state, extras);
  const now = extras.now || Date.now();
  const keep = [];
  let archived = 0;
  (state.idempotencyKeys || []).forEach((row) => {
    if (row.requestStatus === "expired") {
      state.idempotencyArchives.push({ ...row, archivedAt: nowIso(now), readOnly: true });
      archived += 1;
    } else {
      keep.push(row);
    }
  });
  state.idempotencyKeys = keep;
  if (archived) {
    recordOperationalLog(state, "Idempotency cleanup", `${archived} expired key(s) archived`, { kind: "engine" });
  }
  return { archived };
}

export function replayIdempotentEvent(state, eventIdOrKey) {
  ensureIdempotencyState(state);
  const row = (state.idempotencyKeys || []).find((item) =>
    item.idempotencyKey === eventIdOrKey || item.transactionId === eventIdOrKey || item.requestId === eventIdOrKey
  );
  if (!row) return { error: "No processed event for replay" };
  if (row.requestStatus === "succeeded") {
    recordDuplicateHit(state, {
      idempotencyKey: row.idempotencyKey,
      source: "replay",
      resolution: "Original Returned",
      originalTransactionId: row.transactionId,
      correlationId: row.correlationId
    });
    return { ok: true, replay: true, duplicate: true, response: row.responsePayload, record: row };
  }
  return { error: "Event was not a committed success; replay will not recreate it", record: row };
}

export function executeIdempotent(state, spec, work, uid) {
  const gate = beginIdempotentRequest(state, spec, uid);
  if (!gate.proceed) return gate;
  try {
    const result = work();
    if (result && result.ok === false) {
      failIdempotentRequest(state, spec.idempotencyKey, {
        recoverable: result.recoverable !== false,
        error: result.error || "Operation failed"
      });
      return result;
    }
    completeIdempotentRequest(state, spec.idempotencyKey, result || { ok: true });
    return { ok: true, ...(result || {}) };
  } catch (error) {
    failIdempotentRequest(state, spec.idempotencyKey, { recoverable: true, error: error.message });
    return { ok: false, error: error.message, recoverable: true };
  }
}

export function idempotencyMetrics(state = {}) {
  ensureIdempotencyState(state);
  const logs = state.idempotencyActivityLogs || [];
  const keys = state.idempotencyKeys || [];
  return {
    keysCreated: keys.length + (state.idempotencyArchives || []).length,
    duplicateRequestsPrevented: logs.filter((row) => row.resolution === "Original Returned").length,
    cachedResponsesReturned: logs.filter((row) => row.resolution === "Original Returned").length,
    duplicateCallbacksIgnored: logs.filter((row) => /webhook|momo|callback/i.test(row.source || "") && row.resolution).length,
    keyConflicts: logs.filter((row) => row.resolution === "Rejected").length,
    replayOperations: logs.filter((row) => row.source === "replay").length,
    retryOperations: logs.filter((row) => row.previousState === "failed" && row.newState === "processing").length,
    expiredKeys: keys.filter((row) => row.requestStatus === "expired").length + (state.idempotencyArchives || []).length,
    processing: keys.filter((row) => row.requestStatus === "processing").length,
    succeeded: keys.filter((row) => row.requestStatus === "succeeded").length,
    constraintViolations: logs.filter((row) => row.resolution === "Rejected").length,
    exactlyOncePersistence: EXACTLY_ONCE.persistence,
    exactlyOnceDelivery: EXACTLY_ONCE.delivery
  };
}
