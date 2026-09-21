/**
 * Wave 4 — Deep Offline & Synchronization Platform engine.
 * Orchestrates encrypted persist/recover, prioritized upload, invokeApi sync ops,
 * conflict hold, exponential backoff retry, progress, and collector decision hooks.
 *
 * Money posting remains Module 15 processSyncQueue / domain applyFn — no parallel rules.
 */

import {
  ensureSyncState,
  processSyncQueue,
  enqueueSyncItem,
  deviceIsRevoked,
  syncDashboard,
  connectivityStatus,
  detectConflicts,
  resolveConflict,
  retrySyncItem
} from "../core/sync-ops.js";
import {
  ensureOfflineFoundationState,
  persistOfflineQueue,
  recoverOfflineQueue
} from "../core/offline-foundation.js";
import { pendingQueueItems } from "./offline-queue.js";
import { prioritizeQueueItems, annotateQueuePriorities, queueItemPriority } from "./sync-priority.js";
import { scheduleQueueRetry, isRetryDue, clearRetrySchedule, classifySyncFailure } from "./sync-retry-policy.js";
import { buildSyncProgressSnapshot, transitionEngineStatus } from "./sync-progress.js";
import { buildConflictGuidance, conflictGuidanceRows } from "./conflict-guidance.js";
import {
  resolveCollectorStatusMessage,
  evaluateOfflineEscalation,
  evaluateEodDecision,
  evaluateDecisionFlow
} from "../core/phase18-ops-sla.js";
import { redactSecrets } from "../core/secure-storage.js";

export const WAVE4_SYNC_ENGINE_VERSION = "1.0.0";
export const WAVE4_WAVE = "WAVE-04";

const OPEN = new Set(["pending", "validating", "uploading", "uploaded", "applying", "retrying"]);

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

export function ensureWave4SyncState(state = {}) {
  ensureSyncState(state);
  ensureOfflineFoundationState(state);
  state.wave4Sync = state.wave4Sync || {
    schemaVersion: WAVE4_SYNC_ENGINE_VERSION,
    mode: "idle",
    autoSyncEnabled: true,
    lastAutoSyncAt: "",
    lastManualSyncAt: "",
    lastProgress: null,
    lastError: "",
    offlineSince: "",
    uploadSeenKeys: {},
    recoveredAt: "",
    backgroundBridge: "js-engine"
  };
  return state;
}

/**
 * Track when the device went offline for escalation thresholds.
 */
export function noteConnectivity(state, { online = true, now } = {}) {
  ensureWave4SyncState(state);
  if (online === false) {
    if (!state.wave4Sync.offlineSince) state.wave4Sync.offlineSince = nowIso(now);
  } else {
    state.wave4Sync.offlineSince = "";
  }
  return state.wave4Sync;
}

export function offlineDurationHours(state, now) {
  ensureWave4SyncState(state);
  const since = state.wave4Sync.offlineSince;
  if (!since) return 0;
  const ms = Math.max(0, nowMs(now) - Date.parse(since));
  return ms / 3600000;
}

/**
 * Idempotent duplicate prevention for upload attempts (in addition to queue key).
 */
export function rememberUploadKey(state, idempotencyKey) {
  ensureWave4SyncState(state);
  const key = String(idempotencyKey || "").toLowerCase();
  if (!key) return false;
  if (state.wave4Sync.uploadSeenKeys[key]) return true;
  state.wave4Sync.uploadSeenKeys[key] = nowIso();
  return false;
}

export function wasUploadSeen(state, idempotencyKey) {
  ensureWave4SyncState(state);
  return Boolean(state.wave4Sync.uploadSeenKeys[String(idempotencyKey || "").toLowerCase()]);
}

function safeProgressLog(details) {
  return redactSecrets(details);
}

/**
 * Persist encrypted queue (Wave 1 foundation) after mutations.
 */
export async function durablePersist(state, opts = {}) {
  ensureWave4SyncState(state);
  annotateQueuePriorities(state);
  return persistOfflineQueue(state, opts);
}

/**
 * Recover encrypted queue and merge by idempotency key.
 */
export async function durableRecover(state, opts = {}) {
  ensureWave4SyncState(state);
  transitionEngineStatus(state, "recovering");
  const result = await recoverOfflineQueue(state, opts);
  if (result.ok) {
    state.wave4Sync.recoveredAt = nowIso(opts.now);
    annotateQueuePriorities(state);
  }
  if (state.syncMeta.status === "synchronizing") {
    /* leave */
  } else {
    transitionEngineStatus(state, "idle");
  }
  return result;
}

/**
 * Prepare due items: skip not-yet-due retries; hold conflicts.
 */
export function selectSyncCandidates(state, { deviceId, now } = {}) {
  ensureWave4SyncState(state);
  annotateQueuePriorities(state);
  const open = (state.offlineQueue || []).filter((item) => OPEN.has(item.status));
  const filtered = open.filter((item) => {
    if (deviceId && item.deviceId && item.deviceId !== deviceId) return false;
    if (!isRetryDue(item, now)) return false;
    return true;
  });
  return prioritizeQueueItems(filtered);
}

async function invokeSyncOp(invokeApiFn, state, operationId, payload, ctx) {
  if (typeof invokeApiFn !== "function") return null;
  return invokeApiFn(state, { operationId, payload }, ctx);
}

/**
 * Upload one queue item through Wave 3 sync.upload (in-process), then local apply.
 * Duplicate idempotency keys are short-circuited.
 */
export async function uploadQueueItem(state, entry, {
  invokeApiFn,
  user,
  uid,
  now,
  correlationId
} = {}) {
  ensureWave4SyncState(state);
  if (!entry?.idempotencyKey) return { ok: false, error: "idempotencyKey required" };
  const seen = rememberUploadKey(state, entry.idempotencyKey);
  if (seen && entry.status === "applied") {
    return { ok: true, duplicate: true, item: entry };
  }
  entry.status = "uploading";
  entry.lastAttemptAt = nowIso(now);
  entry.attempts = Number(entry.attempts || 0) + 1;

  let apiResult = null;
  if (invokeApiFn) {
    apiResult = await invokeSyncOp(invokeApiFn, state, "v1/sync.upload", {
      idempotencyKey: entry.idempotencyKey,
      kind: entry.kind,
      payload: entry.payload,
      deviceId: entry.deviceId,
      localSequence: entry.localSequence
    }, { user, uid, now, correlationId });
    if (apiResult && apiResult.ok === false) {
      entry.status = "failed";
      entry.lastError = apiResult.problem?.detail || apiResult.error?.message || "sync.upload failed";
      // Do not log secrets
      safeProgressLog({ op: "sync.upload", id: entry.id, err: entry.lastError });
      return { ok: false, error: entry.lastError, apiResult };
    }
  }
  entry.status = "uploaded";
  return { ok: true, item: entry, apiResult, duplicate: false };
}

export async function ackQueueItem(state, entry, { invokeApiFn, user, uid, now } = {}) {
  if (!entry?.id || typeof invokeApiFn !== "function") return { ok: true, skipped: true };
  const apiResult = await invokeSyncOp(invokeApiFn, state, "v1/sync.ack", {
    itemId: entry.id
  }, { user, uid, now });
  return { ok: apiResult?.ok !== false, apiResult };
}

/**
 * Core sync pass — automatic or manual.
 * applyFn posts money via existing Module 15 path (caller supplies).
 */
export async function runSyncPass(state, {
  mode = "manual",
  applyFn,
  invokeApiFn = null,
  deviceId = "",
  user = null,
  uid,
  now,
  online = true,
  secret = "",
  fingerprint = "",
  crashAfter,
  persist = true
} = {}) {
  ensureWave4SyncState(state);
  noteConnectivity(state, { online, now });

  if (deviceId && deviceIsRevoked(state, deviceId)) {
    state.wave4Sync.lastError = "This device has been revoked and cannot synchronize";
    transitionEngineStatus(state, "synchronization_failed");
    return {
      ok: false,
      error: state.wave4Sync.lastError,
      progress: buildSyncProgressSnapshot(state, { online, deviceId }),
      collector: resolveCollectorOfflineUx(state, { online: false, deviceRevoked: true })
    };
  }

  if (persist) {
    await durableRecover(state, { secret, fingerprint, uid, now });
  }

  if (online === false) {
    state.wave4Sync.mode = "idle";
    const progress = buildSyncProgressSnapshot(state, { online: false, deviceId });
    state.wave4Sync.lastProgress = progress;
    if (persist) await durablePersist(state, { secret, fingerprint, uid, now });
    return {
      ok: true,
      deferred: true,
      reason: "offline",
      progress,
      collector: resolveCollectorOfflineUx(state, { online: false, now }),
      escalation: evaluateOfflineEscalation({
        offlineDurationHours: offlineDurationHours(state, now),
        queueSize: progress.pending,
        syncSuccessPct: 100,
        openConflicts: progress.conflicts
      })
    };
  }

  // Hold items that are not due yet — leave retrying with nextRetryAt
  const candidates = selectSyncCandidates(state, { deviceId, now });
  for (const entry of (state.offlineQueue || [])) {
    if (entry.status === "retrying" && !isRetryDue(entry, now)) continue;
    if (OPEN.has(entry.status) && entry.priority == null) {
      entry.priority = queueItemPriority(entry);
    }
  }

  state.wave4Sync.mode = mode === "auto" ? "auto" : "manual";
  transitionEngineStatus(state, "synchronizing");
  if (mode === "auto") state.wave4Sync.lastAutoSyncAt = nowIso(now);
  else state.wave4Sync.lastManualSyncAt = nowIso(now);

  // Pre-upload via invokeApi for due pending items (idempotent)
  const uploadResults = [];
  for (const entry of candidates) {
    if (entry.status === "conflict_detected") continue;
    const up = await uploadQueueItem(state, entry, { invokeApiFn, user, uid, now });
    uploadResults.push({ id: entry.id, ...up });
    if (!up.ok) {
      const scheduled = scheduleQueueRetry(entry, {
        now,
        failureClass: classifySyncFailure(entry, up.error)
      });
      if (!scheduled.retryAllowed) {
        entry.status = entry.status === "conflict_detected" ? entry.status : "failed";
      }
    } else {
      // Return to pending/applying path for processSyncQueue
      if (entry.status === "uploaded") entry.status = "pending";
      clearRetrySchedule(entry);
    }
  }

  const apply = typeof applyFn === "function" ? applyFn : (() => true);
  let result;
  try {
    result = processSyncQueue(state, (entry) => {
      // Skip items waiting on backoff
      if (entry.status === "retrying" && !isRetryDue(entry, now)) return false;
      return apply(entry);
    }, { deviceId, user, uid, now, crashAfter });
  } catch (err) {
    transitionEngineStatus(state, "synchronization_failed");
    state.wave4Sync.lastError = err.message || "Sync pass failed";
    if (persist) await durablePersist(state, { secret, fingerprint, uid, now });
    return {
      ok: false,
      error: state.wave4Sync.lastError,
      progress: buildSyncProgressSnapshot(state, { online, deviceId }),
      collector: resolveCollectorOfflineUx(state, { online, now, failed: true })
    };
  }

  // Schedule retries for failed / retrying rows; ack applied via API
  for (const entry of state.offlineQueue || []) {
    if (entry.status === "applied") {
      clearRetrySchedule(entry);
      await ackQueueItem(state, entry, { invokeApiFn, user, uid, now });
    } else if (entry.status === "failed" || entry.status === "retrying") {
      if (!entry.nextRetryAt) {
        scheduleQueueRetry(entry, {
          now,
          failureClass: classifySyncFailure(entry)
        });
      }
    }
  }

  const progress = buildSyncProgressSnapshot(state, { online, deviceId });
  state.wave4Sync.lastProgress = progress;
  state.wave4Sync.lastError = result?.error || "";
  state.wave4Sync.mode = "idle";
  if (result?.interrupted) transitionEngineStatus(state, "synchronization_failed");
  else if (result?.error) transitionEngineStatus(state, "synchronization_failed");
  else transitionEngineStatus(state, "idle");

  if (persist) await durablePersist(state, { secret, fingerprint, uid, now });

  const appliedCount = (result?.results || []).filter((r) => r.ok).length;
  const successPct = candidates.length
    ? Math.round((appliedCount / candidates.length) * 100)
    : 100;

  return {
    ok: !result?.error,
    interrupted: Boolean(result?.interrupted),
    session: result?.session || null,
    results: result?.results || [],
    uploadResults,
    progress,
    collector: resolveCollectorOfflineUx(state, { online, now }),
    escalation: evaluateOfflineEscalation({
      offlineDurationHours: offlineDurationHours(state, now),
      queueSize: progress.pending,
      syncSuccessPct: successPct,
      openConflicts: progress.conflicts
    }),
    conflicts: conflictGuidanceRows(state)
  };
}

export function resolveCollectorOfflineUx(state, {
  online = true,
  now,
  failed = false,
  deviceRevoked = false,
  synchronizing = false
} = {}) {
  ensureWave4SyncState(state);
  let status = "Online";
  if (deviceRevoked) status = "ReadOnly";
  else if (failed || state.syncMeta?.status === "synchronization_failed") status = "SyncFailed";
  else if (synchronizing || state.syncMeta?.status === "synchronizing") status = "Synchronizing";
  else if (online === false) status = "Offline";
  else {
    const network = connectivityStatus({
      online,
      synchronizing: false,
      failed: false,
      effectiveType: ""
    });
    if (network === "poor_network") status = "PoorNetwork";
  }
  const msg = resolveCollectorStatusMessage({ status });
  const progress = buildSyncProgressSnapshot(state, { online, deviceId: "" });
  const sod = evaluateDecisionFlow({
    flow: "start_of_day",
    online,
    offlineDurationHours: offlineDurationHours(state, now),
    deviceRevoked,
    readOnly: deviceRevoked
  });
  const eod = evaluateEodDecision({
    pendingCount: progress.pending,
    online,
    offlineDurationHours: offlineDurationHours(state, now)
  });
  return {
    ok: msg.ok !== false,
    status: msg.status || status,
    shortLabel: msg.shortLabel || status,
    message: msg.message || "",
    accessibilityLabel: msg.accessibilityLabel || status,
    colorHint: msg.colorHint || "",
    infoPanelFields: msg.infoPanelFields || [],
    failureGuidance: msg.failureGuidance || null,
    warningThresholdsHours: msg.warningThresholdsHours || null,
    progress,
    startOfDay: sod,
    eod,
    // Never rely on color alone — always expose text fields above.
    notColorAlone: true
  };
}

export function wave4SyncDashboard(state, { online = true, deviceId = "" } = {}) {
  ensureWave4SyncState(state);
  const base = syncDashboard(state, { deviceId });
  const progress = buildSyncProgressSnapshot(state, { online, deviceId });
  const ux = resolveCollectorOfflineUx(state, { online });
  return {
    ...base,
    wave: WAVE4_WAVE,
    engineVersion: WAVE4_SYNC_ENGINE_VERSION,
    progress,
    collectorStatus: {
      status: ux.status,
      shortLabel: ux.shortLabel,
      message: ux.message,
      accessibilityLabel: ux.accessibilityLabel
    },
    autoSyncEnabled: state.wave4Sync.autoSyncEnabled !== false,
    lastAutoSyncAt: state.wave4Sync.lastAutoSyncAt || "",
    lastManualSyncAt: state.wave4Sync.lastManualSyncAt || "",
    offlineSince: state.wave4Sync.offlineSince || "",
    conflictGuidance: conflictGuidanceRows(state),
    pendingItems: pendingQueueItems(state).length
  };
}

export function enqueueWithWave4(state, operation = {}, uid) {
  ensureWave4SyncState(state);
  const entry = enqueueSyncItem(state, {
    ...operation,
    priority: operation.priority ?? queueItemPriority(operation)
  }, uid);
  if (entry && !entry.error) {
    entry.priority = queueItemPriority(entry);
  }
  return entry;
}

export {
  buildConflictGuidance,
  conflictGuidanceRows,
  resolveConflict,
  retrySyncItem,
  detectConflicts,
  prioritizeQueueItems,
  scheduleQueueRetry,
  isRetryDue,
  buildSyncProgressSnapshot
};
