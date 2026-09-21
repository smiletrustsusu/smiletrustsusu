/**
 * Phase 18 ops SLA — incident SLA, sync retry, offline escalation,
 * collector status mapping, decision flow / EOD helpers.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P18_OPS_SLA_VERSION,
  PHASE13_DASHBOARD_REFRESH,
  SYNC_WORKFLOW_STAGES,
  evaluateIncidentSla,
  lookupSyncRetryPolicy,
  nextRetryBackoffSeconds,
  evaluateOfflineEscalation,
  resolveCollectorStatusMessage,
  evaluateEodDecision,
  evaluateDecisionFlow,
  getSyncWorkflowStage,
  getDashboardRefreshSchedule
} from "../src/core/phase18-ops-sla.js";

test("phase18 ops sla version and Phase 13 dashboard consume", () => {
  assert.equal(P18_OPS_SLA_VERSION, "1.0.0");
  assert.equal(PHASE13_DASHBOARD_REFRESH.syncHealthPanelSeconds, 60);
  assert.equal(SYNC_WORKFLOW_STAGES.length, 13);
  const dash = getDashboardRefreshSchedule();
  assert.equal(dash.ok, true);
  assert.equal(dash.consumesPhase13, true);
  assert.equal(dash.doesNotRedefine, true);
});

test("evaluateIncidentSla response/resolve met and breached", () => {
  const met = evaluateIncidentSla({
    severity: "critical",
    elapsedResponseMinutes: 10,
    elapsedResolveMinutes: 200,
    resolved: true
  });
  assert.equal(met.ok, true);
  assert.equal(met.slaId, "SEV-001");
  assert.equal(met.responseMet, true);
  assert.equal(met.resolveMet, true);
  assert.equal(met.overall, "met");
  assert.equal(met.majorIncidentEligible, true);

  const breach = evaluateIncidentSla({
    severity: "high",
    elapsedResponseMinutes: 45,
    elapsedResolveMinutes: 500,
    resolved: true
  });
  assert.equal(breach.responseMet, false);
  assert.equal(breach.overall, "breached");

  const escalate = evaluateIncidentSla({
    slaId: "SEV-002",
    elapsedResponseMinutes: 70,
    resolved: false
  });
  assert.equal(escalate.escalateDue, true);
  assert.equal(escalate.responseMet, false);
  assert.equal(escalate.overall, "breached");

  const missing = evaluateIncidentSla({ severity: "unknown" });
  assert.equal(missing.ok, false);
});

test("lookupSyncRetryPolicy and backoff", () => {
  const net = lookupSyncRetryPolicy({ status: "failed", failureClass: "network" });
  assert.equal(net.ok, true);
  assert.equal(net.policy.id, "RETRY-001");
  assert.equal(net.allowsAutoRetry, true);

  const conflict = lookupSyncRetryPolicy({ status: "conflict_detected" });
  assert.equal(conflict.policy.id, "RETRY-004");
  assert.equal(conflict.allowsAutoRetry, false);

  const revoked = lookupSyncRetryPolicy({ failureClass: "device_revoked" });
  assert.equal(revoked.policy.id, "RETRY-005");

  const busy = lookupSyncRetryPolicy({ failureClass: "server_busy" });
  assert.equal(busy.policy.id, "RETRY-002");

  const backoff = nextRetryBackoffSeconds("RETRY-001", 0);
  assert.equal(backoff.retryAllowed, true);
  assert.equal(backoff.backoffSeconds, 30);

  const exhausted = nextRetryBackoffSeconds("RETRY-001", 5);
  assert.equal(exhausted.retryAllowed, false);
  assert.equal(exhausted.reason, "max_attempts_exceeded");

  const hold = nextRetryBackoffSeconds("RETRY-004", 0);
  assert.equal(hold.retryAllowed, false);
});

test("evaluateOfflineEscalation 4h / 24h / queue>1000 / success<99%", () => {
  const branch = evaluateOfflineEscalation({ offlineDurationHours: 4 });
  assert.equal(branch.escalate, true);
  assert.equal(branch.highest.id, "ESC-001");
  assert.equal(branch.highest.escalateTo, "Branch Supervisor");

  const regional = evaluateOfflineEscalation({ offlineDurationHours: 24 });
  assert.equal(regional.highest.id, "ESC-002");
  assert.equal(regional.highest.escalateTo, "Regional Operations");

  const queue = evaluateOfflineEscalation({ queueSize: 1001 });
  assert.ok(queue.triggered.some((t) => t.id === "ESC-003"));

  const success = evaluateOfflineEscalation({ syncSuccessPct: 98.5 });
  assert.ok(success.triggered.some((t) => t.id === "ESC-004"));

  const okBand = evaluateOfflineEscalation({
    offlineDurationHours: 1,
    queueSize: 10,
    syncSuccessPct: 99.5,
    openConflicts: 0
  });
  assert.equal(okBand.escalate, false);
});

test("resolveCollectorStatusMessage covers six statuses", () => {
  const statuses = [
    "Online",
    "Offline",
    "Synchronizing",
    "SyncFailed",
    "ReadOnly",
    "PoorNetwork"
  ];
  for (const status of statuses) {
    const r = resolveCollectorStatusMessage({ status });
    assert.equal(r.ok, true, status);
    assert.equal(r.status, status);
    assert.ok(r.message.length > 10);
    assert.ok(r.accessibilityLabel);
  }

  const fromMode = resolveCollectorStatusMessage({ offlineMode: "Recovery" });
  assert.equal(fromMode.status, "SyncFailed");

  const engineAlias = resolveCollectorStatusMessage({ status: "poor_network" });
  assert.equal(engineAlias.status, "PoorNetwork");

  const offline = resolveCollectorStatusMessage({ status: "Offline" });
  assert.deepEqual(offline.warningThresholdsHours, [1, 4, 24]);
});

test("evaluateEodDecision and decision flows", () => {
  const done = evaluateEodDecision({ online: true, pendingCount: 0 });
  assert.equal(done.outcome, "sync_complete");

  const needSync = evaluateEodDecision({ online: true, pendingCount: 5 });
  assert.equal(needSync.outcome, "start_sync");

  const esc4 = evaluateEodDecision({ online: false, offlineDurationHours: 5, pendingCount: 2 });
  assert.equal(esc4.outcome, "open_incident");
  assert.equal(esc4.escalationId, "ESC-001");

  const esc24 = evaluateEodDecision({ online: false, offlineDurationHours: 30 });
  assert.equal(esc24.escalationId, "ESC-002");

  const sod = evaluateDecisionFlow({ flow: "start_of_day", online: false });
  assert.equal(sod.outcome, "work_offline");
  assert.equal(sod.validOutcome, true);

  const txn = evaluateDecisionFlow({
    flow: "transaction",
    online: false,
    highRisk: true
  });
  assert.equal(txn.outcome, "block_high_risk");

  const sync = evaluateDecisionFlow({
    flow: "sync",
    online: true,
    pendingCount: 10
  });
  assert.equal(sync.outcome, "start_sync");

  const conflict = evaluateDecisionFlow({
    flow: "conflict",
    financial: true,
    conflict: true
  });
  assert.equal(conflict.outcome, "manual_resolve");

  const device = evaluateDecisionFlow({
    flow: "device_replacement",
    deviceLost: true
  });
  assert.equal(device.outcome, "escalate_loss");
});

test("getSyncWorkflowStage 13 stages", () => {
  const first = getSyncWorkflowStage(0);
  assert.equal(first.stage, "authorize_device");
  assert.equal(first.totalStages, 13);

  const last = getSyncWorkflowStage(12);
  assert.equal(last.stage, "session_close");
  assert.equal(last.progressPct, 100);

  const bad = getSyncWorkflowStage(13);
  assert.equal(bad.ok, false);
});
