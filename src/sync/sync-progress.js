/**
 * Wave 4 — Sync progress snapshots and status transitions.
 */

import { ensureSyncState, connectivityStatus, syncDashboard } from "../core/sync-ops.js";
import { getSyncWorkflowStage } from "../core/phase18-ops-sla.js";
import { SYNC_WORKFLOW_STAGES } from "../core/canonical-operations-registry.js";

const OPEN = new Set(["pending", "validating", "uploading", "uploaded", "applying", "retrying"]);

export function countByStatus(queue = []) {
  return queue.reduce((acc, item) => {
    const key = item.status || "pending";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function inferWorkflowStageIndex(state = {}, { online = true } = {}) {
  ensureSyncState(state);
  const meta = state.syncMeta || {};
  const queue = state.offlineQueue || [];
  const statuses = countByStatus(queue);
  const openConflicts = (state.syncConflicts || []).filter((c) => c.status === "open").length;
  if (meta.status === "synchronizing") return 6; // Applying
  if (openConflicts > 0) return 8; // ConflictDetected
  if ((statuses.failed || 0) > 0 || meta.status === "synchronization_failed") return 10; // Failed
  if ((statuses.retrying || 0) > 0) return 11; // Retrying
  if (!online) return 1; // Offline capture continuum ~ Queued
  const pending = queue.filter((i) => OPEN.has(i.status)).length;
  if (pending === 0 && (statuses.applied || 0) > 0) return 12; // Completed
  if (pending > 0) return 3; // Uploading readiness
  return 0;
}

export function buildSyncProgressSnapshot(state = {}, {
  online = true,
  deviceId = "",
  stageIndex = null
} = {}) {
  ensureSyncState(state);
  const queue = state.offlineQueue || [];
  const statuses = countByStatus(queue);
  const pending = queue.filter((i) => OPEN.has(i.status)).length;
  const applied = statuses.applied || 0;
  const failed = (statuses.failed || 0) + (statuses.retrying || 0);
  const conflicts = (state.syncConflicts || []).filter((c) => c.status === "open").length;
  const total = Math.max(1, pending + applied + failed + conflicts);
  const processed = applied;
  const pct = Math.round((processed / total) * 100);
  const idx = stageIndex == null ? inferWorkflowStageIndex(state, { online }) : stageIndex;
  const stage = getSyncWorkflowStage(idx);
  const dash = syncDashboard(state, { deviceId });
  const network = connectivityStatus({
    online,
    synchronizing: state.syncMeta?.status === "synchronizing",
    failed: state.syncMeta?.status === "synchronization_failed"
  });
  return {
    ok: true,
    network,
    pending,
    applied,
    failed,
    conflicts,
    statuses,
    progressPct: Math.min(100, Math.max(0, pct)),
    stageIndex: stage.ok ? stage.stageIndex : idx,
    stage: stage.ok ? stage.stage : (SYNC_WORKFLOW_STAGES[idx] || "Unknown"),
    workflowProgressPct: stage.ok ? stage.progressPct : 0,
    engineStatus: state.syncMeta?.status || "idle",
    lastSyncedAt: state.syncMeta?.lastSyncedAt || state.settings?.lastSyncedAt || "",
    lastLocalSequence: dash.lastLocalSequence || 0,
    lastServerSequence: dash.lastServerSequence || 0,
    encrypted: dash.encrypted !== false,
    activeSessionId: state.syncMeta?.activeSessionId || ""
  };
}

export function transitionEngineStatus(state, nextStatus) {
  ensureSyncState(state);
  const allowed = new Set(["idle", "synchronizing", "synchronization_failed", "offline", "recovering"]);
  const status = allowed.has(nextStatus) ? nextStatus : "idle";
  state.syncMeta.status = status === "offline" || status === "recovering" ? state.syncMeta.status : status;
  if (status === "synchronizing") state.syncMeta.status = "synchronizing";
  if (status === "idle") state.syncMeta.status = "idle";
  if (status === "synchronization_failed") state.syncMeta.status = "synchronization_failed";
  return state.syncMeta.status;
}
