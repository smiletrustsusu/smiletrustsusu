/**
 * Offline synchronization, conflict detection, and transaction ordering.
 * Uses the existing state.offlineQueue. Financial items never last-write-wins.
 * Device clocks are not used as the sole ordering mechanism.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { enqueueOfflineOperation, pendingQueueItems } from "../sync/offline-queue.js";
import { getConfigValue } from "./system-config.js";
import {
  ensureIdentifierState,
  describePrimaryAggregate,
  aggregateKey,
  currentAggregateVersion,
  bumpAggregateVersion,
  acquireAggregateLock,
  releaseAggregateLock,
  validateDependencyGraph,
  normalizeDependencies,
  buildSyncIdentity,
  canGenerateDelegated
} from "./identifiers.js";

export const SYNC_SCHEMA_VERSION = "1.0.0";

export const QUEUE_STATUSES = [
  "pending",
  "validating",
  "uploading",
  "uploaded",
  "applying",
  "applied",
  "failed",
  "retrying",
  "conflict_detected",
  "cancelled"
];

export const FINANCIAL_KINDS = [
  "collection",
  "repayment",
  "withdrawal",
  "disbursement",
  "expense",
  "journal",
  "adjustment",
  "reversal",
  "transfer",
  "payment"
];

export const HIGH_RISK_OPS = [
  "loan.approve",
  "loan.disburse",
  "withdrawal.approve",
  "accounting.closePeriod",
  "configuration.change",
  "payment.refund",
  "payment.reverse",
  "payment.settle",
  "document.refund",
  "document.reverse",
  "document.cancel",
  "document.supersede",
  "job.replay",
  "job.manual_financial"
];

export const CONFLICT_STRATEGIES = ["server_wins", "client_wins", "merge", "manual", "business_rule"];

const OPEN_STATUSES = new Set(["pending", "validating", "uploading", "uploaded", "applying", "retrying"]);

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isFinancialKind(kind) {
  return FINANCIAL_KINDS.includes(String(kind || "").toLowerCase());
}

export function ensureSyncState(state = {}) {
  state.offlineQueue = state.offlineQueue || [];
  state.devices = state.devices || [];
  state.syncSessions = state.syncSessions || [];
  state.syncConflicts = state.syncConflicts || [];
  state.syncResolutions = state.syncResolutions || [];
  state.localReceipts = state.localReceipts || [];
  state.syncCheckpoints = state.syncCheckpoints || [];
  state.syncActivityLogs = state.syncActivityLogs || [];
  state.syncVersions = state.syncVersions || [];
  state.deviceAuthorizations = state.deviceAuthorizations || [];
  state.offlineConfiguration = state.offlineConfiguration || [];
  state.syncMeta = state.syncMeta || {};
  state.syncMeta.serverSequence = Number(state.syncMeta.serverSequence || 0);
  state.syncMeta.status = state.syncMeta.status || "idle";
  state.syncMeta.schemaVersion = state.syncMeta.schemaVersion || SYNC_SCHEMA_VERSION;
  ensureIdentifierState(state);
  if (!state.offlineConfiguration.length) {
    state.offlineConfiguration.push({
      id: "offline-default",
      encryptedAtRest: state.settings?.encryptOfflineQueue !== false,
      conflictStrategy: "business_rule",
      financialStrategy: "business_rule"
    });
  }
  return state;
}

export function connectivityStatus({ online = true, synchronizing = false, failed = false, effectiveType = "" } = {}) {
  if (synchronizing) return "synchronizing";
  if (failed) return "synchronization_failed";
  if (online === false) return "offline";
  if (effectiveType && ["slow-2g", "2g"].includes(String(effectiveType).toLowerCase())) return "poor_network";
  return "online";
}

export function canPerformOffline(state, operationKind, { online = true } = {}) {
  ensureSyncState(state);
  if (online !== false) return { ok: true };
  if (HIGH_RISK_OPS.includes(operationKind) && getConfigValue(state, "offline.allowHighRisk") !== true) {
    return { ok: false, error: "This action requires an internet connection" };
  }
  if (operationKind === "customer.create" && getConfigValue(state, "offline.allowCustomerRegistration") === false) {
    return { ok: false, error: "Offline customer registration is disabled" };
  }
  return { ok: true };
}

export function deviceIsRevoked(state, deviceId) {
  if (!deviceId) return false;
  const device = (state.devices || []).find((item) => item.id === deviceId || item.fingerprint === deviceId);
  if (device && device.active === false) return true;
  const auth = (state.deviceAuthorizations || []).find((item) => item.deviceId === deviceId || item.fingerprint === deviceId);
  return Boolean(auth && auth.status === "revoked");
}

export function authorizeDevice(state, device, user, uid) {
  ensureSyncState(state);
  if (!device?.id) return { error: "Device is required" };
  device.localSequence = Number(device.localSequence || 0);
  device.authorized = true;
  device.active = device.active !== false;
  const existing = (state.deviceAuthorizations || []).find((item) => item.deviceId === device.id);
  if (existing) {
    existing.status = device.active === false ? "revoked" : "authorized";
    existing.updatedAt = nowIso();
  } else {
    state.deviceAuthorizations.push({
      id: newId("dauth", uid),
      deviceId: device.id,
      fingerprint: device.fingerprint || "",
      userId: device.userId || user?.id || "",
      status: "authorized",
      createdAt: nowIso()
    });
  }
  return { ok: true, device };
}

export function revokeDevice(state, deviceId, user, uid) {
  ensureSyncState(state);
  const device = (state.devices || []).find((item) => item.id === deviceId || item.fingerprint === deviceId);
  if (!device) return { error: "Device not found" };
  device.active = false;
  device.updatedAt = nowIso();
  const auth = (state.deviceAuthorizations || []).find((item) => item.deviceId === device.id);
  if (auth) {
    auth.status = "revoked";
    auth.revokedBy = user?.id || "";
    auth.revokedAt = nowIso();
  } else {
    state.deviceAuthorizations.push({
      id: newId("dauth", uid),
      deviceId: device.id,
      fingerprint: device.fingerprint || "",
      status: "revoked",
      revokedBy: user?.id || "",
      revokedAt: nowIso()
    });
  }
  logSync(state, "Device revoked", device.id, user, uid);
  return { ok: true, device };
}

export function nextLocalSequence(state, deviceId) {
  ensureSyncState(state);
  const device = (state.devices || []).find((item) => item.id === deviceId || item.fingerprint === deviceId);
  if (device) {
    device.localSequence = Number(device.localSequence || 0) + 1;
    return device.localSequence;
  }
  state.syncMeta.localSequences = state.syncMeta.localSequences || {};
  const key = deviceId || "local";
  state.syncMeta.localSequences[key] = Number(state.syncMeta.localSequences[key] || 0) + 1;
  return state.syncMeta.localSequences[key];
}

export function nextServerSequence(state) {
  ensureSyncState(state);
  state.syncMeta.serverSequence = Number(state.syncMeta.serverSequence || 0) + 1;
  return state.syncMeta.serverSequence;
}

export function aggregateIdFor(kind, payload = {}) {
  const primary = describePrimaryAggregate(kind, payload);
  return aggregateKey(primary.type, primary.id);
}

function logSync(state, action, details, user, uid, extras = {}) {
  state.syncActivityLogs.push({
    id: newId("slog", uid),
    action,
    details,
    userId: user?.id || "",
    createdAt: nowIso(extras.now)
  });
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: "operational",
    guarantee: "G1",
    module: "15",
    ...extras
  }, uid);
}

export function issueLocalReceipt(state, { temporaryReceiptNo, transactionId, deviceId, agentId, offline = true } = {}, uid) {
  ensureSyncState(state);
  const row = {
    id: newId("lrcp", uid),
    temporaryReceiptNo: temporaryReceiptNo || `OFF-${Date.now().toString(36)}`,
    permanentReceiptNo: "",
    transactionId: transactionId || "",
    deviceId: deviceId || "",
    agentId: agentId || "",
    offline: offline !== false,
    createdAt: nowIso()
  };
  state.localReceipts.push(row);
  return row;
}

export function promoteReceipt(state, temporaryReceiptNo, permanentReceiptNo) {
  const row = (state.localReceipts || []).find((item) => item.temporaryReceiptNo === temporaryReceiptNo);
  if (!row) return { error: "Receipt mapping not found" };
  if (row.permanentReceiptNo && row.permanentReceiptNo !== permanentReceiptNo) {
    return { ok: true, receipt: row, duplicate: true };
  }
  if (!row.permanentReceiptNo) {
    row.permanentReceiptNo = permanentReceiptNo;
    row.promotedAt = nowIso();
  }
  if (Array.isArray(state.documents)) {
    const document = state.documents.find((item) =>
      item.temporaryReceiptNo === temporaryReceiptNo || item.receiptNo === temporaryReceiptNo
    );
    if (document && !document.permanentReceiptNo) {
      document.permanentReceiptNo = row.permanentReceiptNo;
    }
  }
  return { ok: true, receipt: row };
}

export function enqueueSyncItem(state, operation = {}, uid) {
  ensureSyncState(state);
  const key = String(operation.idempotencyKey || "").toLowerCase();
  if (!key) return { error: "Offline operation requires an idempotency key" };
  const existing = (state.offlineQueue || []).find((item) => String(item.idempotencyKey || "").toLowerCase() === key);
  if (existing) return existing;
  const deviceId = operation.deviceId || "";
  if (deviceId && deviceIsRevoked(state, deviceId)) return { error: "This device has been revoked and cannot synchronize" };
  const maxItems = Number(getConfigValue(state, "offline.maxQueueItems") || 500);
  const openCount = (state.offlineQueue || []).filter((item) => OPEN_STATUSES.has(item.status)).length;
  if (openCount >= maxItems) return { error: "Offline queue is full" };
  const localSequence = operation.localSequence || nextLocalSequence(state, deviceId);
  const payload = operation.payload || {};
  const identity = buildSyncIdentity(operation.kind, payload, {
    dependsOn: operation.dependsOn,
    dependencies: operation.dependencies,
    version: currentAggregateVersion(state, describePrimaryAggregate(operation.kind, payload).type, describePrimaryAggregate(operation.kind, payload).id)
  });
  const graphCheck = validateDependencyGraph([...(state.offlineQueue || []), {
    id: operation.id || operation.globalTransactionId || payload.id,
    dependsOn: operation.dependsOn,
    dependencies: operation.dependencies
  }]);
  if (!graphCheck.ok) return { error: graphCheck.error, cycle: graphCheck.cycle };
  if (operation.kind === "collection" && operation.offline !== false) {
    const allowed = canGenerateDelegated(state, "temporary_receipt", { component: "Authorized Android Agent Application", deviceId, online: operation.online });
    if (operation.requireDelegation && !allowed.ok) return allowed;
  }
  const entry = enqueueOfflineOperation(state, {
    ...operation,
    localSequence,
    serverSequence: null,
    correlationId: operation.correlationId || payload.id || key,
    globalTransactionId: operation.globalTransactionId || operation.id || payload.id,
    aggregateId: operation.aggregateId || aggregateIdFor(operation.kind, payload),
    primaryAggregateType: identity.primaryAggregateType,
    primaryAggregateId: identity.primaryAggregateId,
    primaryAggregateVersion: identity.primaryAggregateVersion,
    secondaryAggregates: identity.secondaryAggregates,
    dependencies: identity.dependencies,
    dependsOn: operation.dependsOn || [],
    branchId: operation.branchId || payload.branchId || "",
    agentId: operation.agentId || payload.userId || payload.collectorId || "",
    deviceId,
    businessDate: operation.businessDate || payload.date || "",
    createdTimestamp: operation.createdTimestamp || nowIso(),
    payloadHash: operation.payloadHash || payloadHash(payload),
    queuePosition: localSequence
  });
  logSync(state, "Offline item queued", `${entry.kind} seq ${localSequence}`, { id: entry.agentId }, uid, {
    entityType: "sync_queue",
    entityId: entry.id
  });
  return entry;
}

export function detectConflicts(state, entry) {
  ensureSyncState(state);
  const reasons = [];
  if (entry.deviceId && deviceIsRevoked(state, entry.deviceId)) reasons.push("revoked_device");
  const payload = entry.payload || {};
  if (entry.kind === "collection" && payload.customerId) {
    const customer = (state.customers || []).find((item) => item.id === payload.customerId);
    if (!customer) {
      reasons.push("deleted_record");
      reasons.push("unknown_aggregate");
    } else if (customer.active === false || customer.memberStatus === "Closed") reasons.push("deleted_record");
  }
  if (entry.kind === "customer" && payload.phone) {
    const dup = (state.customers || []).find((item) => item.phone === payload.phone && item.id !== payload.id);
    if (dup) reasons.push("duplicate_customer");
  }
  if (entry.expectedUpdatedAt && payload.updatedAt && entry.expectedUpdatedAt !== payload.updatedAt) {
    reasons.push("version_mismatch");
  }
  const primaryType = entry.primaryAggregateType || describePrimaryAggregate(entry.kind, payload).type;
  const primaryId = entry.primaryAggregateId || describePrimaryAggregate(entry.kind, payload).id;
  const currentVersion = currentAggregateVersion(state, primaryType, primaryId);
  if (entry.expectedVersion != null && Number(entry.expectedVersion) !== currentVersion) {
    const row = (state.aggregateVersions || []).find((item) => item.key === aggregateKey(primaryType, primaryId));
    if (row?.updatedByDevice && row.updatedByDevice !== entry.deviceId) reasons.push("version_mismatch");
  }
  if ((entry.dependsOn || []).length || (entry.dependencies || []).length) {
    const graph = validateDependencyGraph(state.offlineQueue || []);
    if (!graph.ok && (graph.cycle || []).includes(entry.id)) reasons.push("circular_dependency");
  }
  const hardDeps = normalizeDependencies(entry.dependsOn, entry.dependencies).filter((item) => item.type === "hard");
  hardDeps.forEach((dep) => {
    const found = (state.offlineQueue || []).find((item) => item.id === dep.id || item.correlationId === dep.id || item.globalTransactionId === dep.id);
    if (!found) reasons.push("missing_hard_dependency");
  });
  const sameKeyApplied = (state.offlineQueue || []).find((item) => (
    item.id !== entry.id
    && String(item.idempotencyKey || "").toLowerCase() === String(entry.idempotencyKey || "").toLowerCase()
    && item.status === "applied"
    && item.payloadHash
    && entry.payloadHash
    && item.payloadHash !== entry.payloadHash
  ));
  if (sameKeyApplied) reasons.push("duplicate_collection");
  return [...new Set(reasons)];
}

function findQueuedDependency(state, depId) {
  return (state.offlineQueue || []).find((item) => item.id === depId || item.correlationId === depId || item.globalTransactionId === depId);
}

function dependenciesSatisfied(state, entry) {
  const deps = normalizeDependencies(entry.dependsOn, entry.dependencies).filter((item) => item.type === "hard");
  if (!deps.length) return true;
  return deps.every((dep) => {
    const row = findQueuedDependency(state, dep.id);
    return row && row.status === "applied";
  });
}

function recordConflict(state, entry, reasons, uid) {
  const conflict = {
    id: newId("scfl", uid),
    queueItemId: entry.id,
    kind: entry.kind,
    reasons,
    strategy: isFinancialKind(entry.kind) ? "business_rule" : (getConfigValue(state, "offline.conflictStrategy") || "manual"),
    status: "open",
    createdAt: nowIso()
  };
  state.syncConflicts.push(conflict);
  entry.status = "conflict_detected";
  entry.lastError = reasons.join(", ");
  return conflict;
}

export function resolveConflict(state, conflictId, strategy, user, uid) {
  ensureSyncState(state);
  const conflict = (state.syncConflicts || []).find((item) => item.id === conflictId);
  if (!conflict || conflict.status !== "open") return { error: "Conflict not found" };
  const entry = (state.offlineQueue || []).find((item) => item.id === conflict.queueItemId);
  if (isFinancialKind(entry?.kind) && strategy === "client_wins") {
    return { error: "Financial transactions cannot use client-wins / last-write-wins" };
  }
  const chosen = strategy || conflict.strategy;
  conflict.status = "resolved";
  conflict.resolvedStrategy = chosen;
  conflict.resolvedBy = user?.id || "";
  conflict.resolvedAt = nowIso();
  state.syncResolutions.push({
    id: newId("sres", uid),
    conflictId: conflict.id,
    strategy: chosen,
    userId: user?.id || "",
    createdAt: nowIso()
  });
  if (entry) {
    if (chosen === "server_wins") entry.status = "cancelled";
    else if (chosen === "business_rule" && conflict.reasons?.includes("duplicate_collection")) entry.status = "applied";
    else {
      entry.status = "pending";
      entry.lastError = "";
    }
  }
  logSync(state, "Sync conflict resolved", `${conflict.id} · ${chosen}`, user, uid);
  return { ok: true, conflict, entry };
}

export function lastCheckpoint(state, deviceId) {
  const rows = (state.syncCheckpoints || []).filter((item) => !deviceId || item.deviceId === deviceId);
  return rows[rows.length - 1] || null;
}

function writeCheckpoint(state, session, entry, uid) {
  const row = {
    id: newId("schk", uid),
    sessionId: session.id,
    deviceId: entry.deviceId || session.deviceId || "",
    lastLocalSequence: entry.localSequence,
    lastServerSequence: entry.serverSequence,
    status: "applied",
    createdAt: nowIso()
  };
  state.syncCheckpoints.push(row);
  state.syncMeta.lastCheckpointId = row.id;
  return row;
}

export function beginSyncSession(state, { deviceId, agentId, mode = "incremental" } = {}, uid) {
  ensureSyncState(state);
  const session = {
    id: newId("ssess", uid),
    deviceId: deviceId || "",
    agentId: agentId || "",
    mode,
    status: "running",
    startedAt: nowIso(),
    processed: 0,
    applied: 0,
    conflicts: 0,
    failed: 0
  };
  state.syncSessions.push(session);
  state.syncMeta.status = "synchronizing";
  state.syncMeta.activeSessionId = session.id;
  return session;
}

export function prepareSyncBatch(state, { deviceId } = {}) {
  ensureSyncState(state);
  const checkpoint = lastCheckpoint(state, deviceId);
  return (state.offlineQueue || [])
    .filter((item) => OPEN_STATUSES.has(item.status) || item.status === "conflict_detected")
    .filter((item) => !deviceId || item.deviceId === deviceId || !item.deviceId)
    .slice()
    .sort((a, b) => Number(a.localSequence || 0) - Number(b.localSequence || 0))
    .map((item, index) => ({ item, queuePosition: index + 1, resumeAfter: checkpoint?.lastLocalSequence || 0 }));
}

export function processSyncQueue(state, applyFn, { deviceId, user, uid, now, crashAfter } = {}) {
  ensureSyncState(state);
  if (deviceId && deviceIsRevoked(state, deviceId)) {
    return { error: "This device has been revoked and cannot synchronize", results: [] };
  }
  const session = beginSyncSession(state, { deviceId, agentId: user?.id, mode: "incremental" }, uid);
  const batch = prepareSyncBatch(state, { deviceId });
  const results = [];
  const blockedAggregates = new Set();
  let appliedCount = 0;
  for (const { item } of batch) {
    if (item.status === "conflict_detected") {
      blockedAggregates.add(item.aggregateId);
      continue;
    }
    if (!dependenciesSatisfied(state, item)) continue;
    if (item.aggregateId && blockedAggregates.has(item.aggregateId)) continue;
    const reasons = detectConflicts(state, item);
    if (reasons.length) {
      recordConflict(state, item, reasons, uid);
      blockedAggregates.add(item.aggregateId);
      session.conflicts += 1;
      results.push({ id: item.id, ok: false, conflict: true, reasons });
      continue;
    }
    item.status = "validating";
    const primaryType = item.primaryAggregateType || describePrimaryAggregate(item.kind, item.payload).type;
    const primaryId = item.primaryAggregateId || describePrimaryAggregate(item.kind, item.payload).id;
    const lock = acquireAggregateLock(state, primaryType, primaryId, item.id);
    if (lock.error) {
      item.status = "retrying";
      results.push({ id: item.id, ok: false, retrying: true, error: lock.error });
      continue;
    }
    item.status = "applying";
    item.processingStartedAt = nowIso(now);
    try {
      const applied = applyFn(item);
      if (applied === false) {
        item.status = "retrying";
        item.attempts = Number(item.attempts || 0) + 1;
        blockedAggregates.add(item.aggregateId);
        session.failed += 1;
        releaseAggregateLock(state, primaryType, primaryId, item.id);
        results.push({ id: item.id, ok: false, retrying: true });
        continue;
      }
      item.status = "applied";
      item.appliedAt = nowIso(now);
      item.processingEndedAt = item.appliedAt;
      item.serverSequence = nextServerSequence(state);
      item.appliedOrder = item.serverSequence;
      item.syncSessionId = session.id;
      item.primaryAggregateVersion = bumpAggregateVersion(state, primaryType, primaryId, item.deviceId);
      writeCheckpoint(state, session, item, uid);
      if (item.kind === "collection" && item.payload?.receiptNo) {
        const temp = item.payload.temporaryReceiptNo || item.payload.receiptNo;
        if (!(state.localReceipts || []).some((row) => row.temporaryReceiptNo === temp)) {
          issueLocalReceipt(state, {
            temporaryReceiptNo: temp,
            transactionId: item.payload.id,
            deviceId: item.deviceId,
            agentId: item.agentId
          }, uid);
        }
        promoteReceipt(state, temp, `SRV-${String(item.serverSequence).padStart(8, "0")}`);
        item.payload.permanentReceiptNo = `SRV-${String(item.serverSequence).padStart(8, "0")}`;
        if (Array.isArray(state.receiptReconciliation)
          && !state.receiptReconciliation.some((row) => row.temporaryReceiptNumber === temp)) {
          state.receiptReconciliation.push({
            id: `rrc-${item.id}`,
            temporaryReceiptNumber: temp,
            permanentReceiptNumber: item.payload.permanentReceiptNo,
            localTransactionId: item.payload.id || "",
            serverTransactionId: item.payload.id || "",
            deviceId: item.deviceId || "",
            mappingTimestamp: nowIso(now),
            synchronizationSessionId: session.id,
            reconciliationStatus: "reconciled"
          });
        }
      }
      releaseAggregateLock(state, primaryType, primaryId, item.id);
      appliedCount += 1;
      session.applied += 1;
      session.processed += 1;
      results.push({ id: item.id, ok: true, serverSequence: item.serverSequence, localSequence: item.localSequence });
      if (Number.isFinite(crashAfter) && appliedCount >= crashAfter) {
        session.status = "interrupted";
        state.syncMeta.status = "synchronization_failed";
        return { interrupted: true, session, results };
      }
    } catch (error) {
      item.status = "failed";
      item.lastError = error.message || "Apply failed";
      item.processingEndedAt = nowIso(now);
      blockedAggregates.add(item.aggregateId);
      session.failed += 1;
      releaseAggregateLock(state, primaryType, primaryId, item.id);
      results.push({ id: item.id, ok: false, error: item.lastError });
    }
  }
  session.status = "complete";
  session.endedAt = nowIso(now);
  state.syncMeta.status = "idle";
  state.syncMeta.lastSyncedAt = session.endedAt;
  logSync(state, "Synchronization complete", `applied ${session.applied} · conflicts ${session.conflicts}`, user, uid, {
    entityType: "sync_session",
    entityId: session.id
  });
  return { ok: true, session, results };
}

export function retrySyncItem(state, itemId) {
  const entry = (state.offlineQueue || []).find((item) => item.id === itemId);
  if (!entry) return { error: "Queue item not found" };
  if (entry.status === "applied") return { error: "Already applied" };
  if (entry.status === "conflict_detected") return { error: "Resolve the conflict before retrying" };
  entry.status = "pending";
  entry.lastError = "";
  return { ok: true, entry };
}

export function syncDashboard(state, { deviceId } = {}) {
  ensureSyncState(state);
  const queue = state.offlineQueue || [];
  const pending = queue.filter((item) => OPEN_STATUSES.has(item.status));
  const failed = queue.filter((item) => item.status === "failed" || item.status === "retrying");
  const conflicts = (state.syncConflicts || []).filter((item) => item.status === "open");
  const checkpoint = lastCheckpoint(state, deviceId);
  const bytes = JSON.stringify(queue).length;
  return {
    pending: pending.length,
    failed: failed.length,
    conflicts: conflicts.length,
    applied: queue.filter((item) => item.status === "applied").length,
    lastLocalSequence: checkpoint?.lastLocalSequence || 0,
    lastServerSequence: state.syncMeta.serverSequence || 0,
    storageBytes: bytes,
    encrypted: state.settings?.encryptOfflineQueue !== false,
    status: state.syncMeta.status || "idle",
    sessions: (state.syncSessions || []).length
  };
}

export function pendingUploads(state) {
  return pendingQueueItems(state);
}

export function queueViewerRows(state) {
  ensureSyncState(state);
  return (state.offlineQueue || [])
    .slice()
    .sort((a, b) => Number(a.localSequence || 0) - Number(b.localSequence || 0))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      localSequence: item.localSequence,
      serverSequence: item.serverSequence,
      aggregateId: item.aggregateId,
      primaryAggregateType: item.primaryAggregateType || "",
      lastError: item.lastError || ""
    }));
}
