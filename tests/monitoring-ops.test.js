import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canPerformOffline } from "../src/core/sync-ops.js";
import {
  canTransitionIncident,
  componentHealth,
  offlineReadinessScore,
  forbiddenTelemetry,
  maskSensitive,
  linearForecast,
  canCollectWithIntegrity,
  DEFAULT_THRESHOLD_BANDS,
  PLAIN_LANGUAGE_THRESHOLD_RULE,
  severityFromBands,
  validateBands,
  adaptiveIntervalMs,
  dueForCollection
} from "../src/core/monitoring-lifecycle.js";
import {
  ensureMonitoringState,
  collectHealthSnapshot,
  evaluateAlerts,
  acknowledgeAlert,
  escalateUnacknowledgedAlerts,
  transitionAlert,
  validateAlertRule,
  upsertAlertRule,
  collectScheduledMetrics,
  setSamplingMode,
  openIncident,
  transitionIncident,
  startTrace,
  addSpan,
  endTrace,
  recordLog,
  recordDeviceSnapshot,
  bufferOfflineHealthEvent,
  flushOfflineMonitoringQueue,
  requestRemoteDiagnostics,
  canCollectWithDeviceHealth,
  searchLogs,
  monitoringDashboard,
  businessMetrics,
  monitoringReports,
  exportMonitorCsv,
  capacityForecast,
  assertMonitoringBoundary
} from "../src/core/monitoring-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const auditor = { id: "u-aud", role: "Auditor", username: "ama" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-10T19:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31, encryptOfflineQueue: true },
    collections: [{ id: "col-1", date: "2026-09-10", amount: 20 }],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    devices: [{ id: "dev-1", fingerprint: "fp-1", active: true }],
    audit: []
  };
  ensureMonitoringState(state);
  return state;
}

test("monitoring is centralized and never collects private device content", () => {
  const boundary = assertMonitoringBoundary();
  assert.equal(boundary.centralized, true);
  assert.equal(boundary.restApi, false);
  assert.equal(boundary.graphql, false);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.collectsPrivateContent, false);
  assert.equal(canTransitionIncident("detected", "classified"), true);
  assert.equal(canTransitionIncident("closed", "detected"), false);
  assert.equal(componentHealth({ availability: 1, errorPct: 0 }).status, "healthy");
  assert.equal(forbiddenTelemetry({ photos: [], pendingUploads: 1 }).includes("photos"), true);
  assert.equal(maskSensitive({ pin: "1234", ok: true }).pin, "[redacted]");
  assert.equal(linearForecast([{ value: 10 }, { value: 20 }], 1).next > 20, true);
});

test("health snapshot reads existing queues and raises threshold alerts", () => {
  const state = blank();
  state.backgroundJobs = [{ id: "j1", status: "queued" }, { id: "j2", status: "failed" }];
  state.deadLetterQueue = new Array(4).fill(0).map((_, index) => ({ id: `d${index}` }));
  const shot = collectHealthSnapshot(state, {
    uid,
    now,
    user: owner,
    runtime: { storageUsedPct: 92, apiResponseMs: 80, queryDurationMs: 12 }
  });
  assert.equal(shot.ok, true);
  assert.ok(shot.system.score <= 100);
  assert.ok(state.healthChecks.length >= 1);
  assert.ok(state.monitoringMetrics.some((item) => item.name === "queueDepth"));
  assert.equal(monitoringDashboard(state).status.length > 0, true);
  assert.equal(businessMetrics(state, { date: "2026-09-10" }).collectionsToday, 1);
});

test("major payment outage opens an incident and can be tracked to close", () => {
  const state = blank();
  const raised = evaluateAlerts(state, { providersDown: 1 }, { uid, now, user: owner });
  assert.ok(raised.some((item) => item.severity === "critical"));
  assert.ok(state.incidents.length >= 1);
  const incident = state.incidents[0];
  assert.equal(transitionIncident(state, incident.id, "classified", { user: owner, uid, now }).ok, true);
  assert.equal(transitionIncident(state, incident.id, "investigating", { user: owner, uid, now }).ok, true);
  assert.equal(transitionIncident(state, incident.id, "identified", { user: owner, uid, now, rootCause: "provider timeout" }).ok, true);
  assert.equal(transitionIncident(state, incident.id, "resolving", { user: owner, uid, now }).ok, true);
  assert.equal(transitionIncident(state, incident.id, "resolved", { user: owner, uid, now, resolution: "restored" }).ok, true);
  assert.equal(transitionIncident(state, incident.id, "closed", { user: owner, uid, now }).ok, true);
  assert.equal(incident.status, "closed");
  assert.equal(canAction(auditor, "Monitor.View"), true);
  assert.equal(canAction(auditor, "Monitor.Incident"), false);
  assert.equal(canAction(collector, "Monitor.View"), false);
});

test("traces and masked logs stay searchable by correlation id", () => {
  const state = blank();
  const trace = startTrace(state, { correlationId: "corr-1", path: "collection.commit" }, uid, now);
  addSpan(state, trace.traceId, { service: "Payment Engine", name: "validate", durationMs: 12 }, uid, now);
  const ended = endTrace(state, trace.traceId, { now: Date.parse(now) + 40 });
  recordLog(state, { level: "info", service: "scheduler", message: "tick", correlationId: "corr-1", payload: { pin: "9999" } }, uid, now);
  assert.equal(ended.trace.status, "completed");
  assert.equal(searchLogs(state, { q: "corr-1" }).length, 1);
  assert.equal(state.logEntries[0].payload.pin, "[redacted]");
});

test("android snapshots score offline readiness and reject private content", () => {
  const state = blank();
  const banned = recordDeviceSnapshot(state, { deviceId: "dev-1", photos: [] }, { user: owner, uid, now, online: true });
  assert.equal(banned.ok, false);
  const ready = recordDeviceSnapshot(state, {
    deviceId: "dev-1",
    deviceName: "Agent phone",
    appVersion: "3.2.0",
    storageFreePct: 40,
    pendingUploads: 2,
    operationalStatus: "online",
    encrypted: true
  }, { user: owner, uid, now, online: true });
  assert.equal(ready.ok, true);
  assert.ok(ready.readiness.score >= 70);
  const limited = recordDeviceSnapshot(state, {
    deviceId: "dev-1",
    storageFreePct: 8,
    pendingUploads: 80,
    tokenExpired: true,
    operationalStatus: "offline",
    offlineHours: 60
  }, { user: owner, uid, now, online: false });
  assert.equal(limited.readiness.label, "Requires Attention");
  assert.equal(state.offlineMonitoringQueue.length >= 1, true);
});

test("offline telemetry flushes through idempotency without a second copy", () => {
  const state = blank();
  bufferOfflineHealthEvent(state, { deviceId: "dev-1", type: "heartbeat", payload: { pendingUploads: 1 } }, uid, now);
  const first = flushOfflineMonitoringQueue(state, { user: owner, uid, now, deviceId: "dev-1", online: true });
  const second = flushOfflineMonitoringQueue(state, { user: owner, uid, now, deviceId: "dev-1", online: true });
  assert.equal(first.flushed, 1);
  assert.equal(second.flushed, 0);
  assert.equal((state.offlineQueue || []).filter((item) => item.kind === "monitoring").length, 1);
  const deferred = flushOfflineMonitoringQueue(state, { user: owner, uid, now, online: false });
  assert.equal(deferred.deferred, true);
});

test("integrity failure blocks collections and remote diagnostics hide balances", () => {
  const state = blank();
  recordDeviceSnapshot(state, {
    deviceId: "dev-1",
    integrityFailed: true,
    operationalStatus: "online"
  }, { user: owner, uid, now, online: true });
  const blocked = canCollectWithDeviceHealth(state, { deviceId: "dev-1" });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /integrity/i);
  assert.equal(canCollectWithIntegrity({ integrityFailed: true }).ok, false);
  const diag = requestRemoteDiagnostics(state, "dev-1", { user: owner, uid, now });
  assert.equal(diag.ok, true);
  assert.equal(diag.summary.pendingUploads != null, true);
  assert.equal(Object.prototype.hasOwnProperty.call(diag.summary, "customerBalance"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(diag.summary, "pin"), false);
  const denied = requestRemoteDiagnostics(state, "dev-1", { user: collector, uid, now });
  assert.equal(denied.ok, false);
});

test("collector cannot acknowledge alerts; reports export health rows", () => {
  const state = blank();
  evaluateAlerts(state, { failed: 6 }, { uid, now, user: owner });
  const alert = state.monitoringAlerts.find((item) => item.status === "open");
  const denied = acknowledgeAlert(state, alert.id, { user: collector, uid, now });
  assert.equal(denied.ok, false);
  const acked = acknowledgeAlert(state, alert.id, { user: owner, uid, now });
  assert.equal(acked.ok, true);
  const report = monitoringReports(state, "monitor_alerts", { from: "2026-09-10", to: "2026-09-10" });
  assert.ok(exportMonitorCsv(report).includes("Synchronization failure"));
  collectHealthSnapshot(state, { uid, now, user: owner });
  collectHealthSnapshot(state, { uid, now: Date.parse(now) + 1000, user: owner });
  assert.equal(Number.isFinite(capacityForecast(state, "collections", 3).next), true);
  assert.equal(canPerformOffline(state, "job.replay", { online: true }).ok, true);
  assert.equal(offlineReadinessScore({ revoked: true }).score, 0);
});

test("threshold bands are left-inclusive and right-exclusive", () => {
  const cpu = DEFAULT_THRESHOLD_BANDS.cpuPct;
  assert.equal(severityFromBands(cpu, 74.999), "normal");
  assert.equal(severityFromBands(cpu, 75), "warning");
  assert.equal(severityFromBands(cpu, 84.999), "warning");
  assert.equal(severityFromBands(cpu, 85), "minor");
  assert.equal(severityFromBands(cpu, 90), "major");
  assert.equal(severityFromBands(cpu, 94.999), "major");
  assert.equal(severityFromBands(cpu, 95), "critical");
  assert.equal(severityFromBands(DEFAULT_THRESHOLD_BANDS.queueDepth, 499), "normal");
  assert.equal(severityFromBands(DEFAULT_THRESHOLD_BANDS.queueDepth, 500), "warning");
  assert.equal(severityFromBands(DEFAULT_THRESHOLD_BANDS.queueDepth, 1000), "minor");
  assert.equal(severityFromBands(DEFAULT_THRESHOLD_BANDS.androidOfflineHours, 24), "major");
  assert.equal(severityFromBands(DEFAULT_THRESHOLD_BANDS.androidOfflineHours, 72), "critical");
  assert.equal(validateBands(cpu).ok, true);
  assert.equal(validateBands([{ severity: "normal", min: 10, max: 5 }]).ok, false);
  assert.match(PLAIN_LANGUAGE_THRESHOLD_RULE, /lower boundary/i);
});

test("band rules deduplicate, recover with hysteresis, and escalate", () => {
  const state = blank();
  upsertAlertRule(state, {
    id: "rule-cpu-band",
    name: "CPU utilization",
    domain: "api",
    metric: "cpuPct",
    useBands: true,
    status: "active",
    active: true
  }, owner, uid, now);
  const first = evaluateAlerts(state, { cpuPct: 91 }, { uid, now, user: owner });
  const again = evaluateAlerts(state, { cpuPct: 93 }, { uid, now, user: owner });
  assert.equal(first[0].severity, "major");
  assert.equal(again.length, 0);
  assert.equal(state.monitoringAlerts.filter((item) => item.ruleId === "rule-cpu-band").length, 1);
  assert.equal(state.monitoringAlerts[state.monitoringAlerts.length - 1].occurrences, 2);
  evaluateAlerts(state, { cpuPct: 60 }, { uid, now, user: owner });
  evaluateAlerts(state, { cpuPct: 60 }, { uid, now, user: owner });
  const cpuAlert = state.monitoringAlerts.find((item) => item.ruleId === "rule-cpu-band");
  assert.equal(cpuAlert.status, "resolved");
  assert.equal(cpuAlert.preservedSeverity, "major");
  evaluateAlerts(state, { cpuPct: 96 }, { uid, now, user: owner });
  const openCpu = state.monitoringAlerts.find((item) => item.ruleId === "rule-cpu-band" && item.status === "open");
  const later = Date.parse(now) + 31 * 60 * 1000;
  const esc = escalateUnacknowledgedAlerts(state, { uid, now: later, user: owner });
  assert.ok(esc.escalated >= 1);
  assert.equal(openCpu.status, "escalated");
  assert.equal(transitionAlert(state, openCpu.id, "acknowledged", { user: owner, uid, now: later }).ok, true);
});

test("sampling intervals, maintenance windows, and invalid rules hold", () => {
  const state = blank();
  const first = collectScheduledMetrics(state, { uid, now, user: owner, category: "high" });
  const second = collectScheduledMetrics(state, { uid, now, user: owner, category: "high", lastCollected: { high: now } });
  assert.equal(first.skipped, undefined);
  assert.equal(second.skipped, true);
  const incident = collectScheduledMetrics(state, { uid, now, user: owner, category: "standard", eventDriven: true });
  assert.equal(incident.ok, true);
  setSamplingMode(state, "incident", owner, uid, now);
  assert.ok(adaptiveIntervalMs(60000, { mode: "incident" }) < 60000);
  assert.ok(adaptiveIntervalMs(60000, { mode: "idle" }) > 60000);
  state.monitoringConfiguration[0].maintenanceWindows = [{ from: "2026-09-10T18:00:00.000Z", to: "2026-09-10T20:00:00.000Z", domain: "queue" }];
  const before = state.monitoringAlerts.length;
  evaluateAlerts(state, { queueDepth: 80 }, { uid, now, user: owner });
  assert.equal(state.monitoringAlerts.length, before);
  assert.equal(validateAlertRule({ name: "x" }).ok, false);
  assert.equal(dueForCollection(now, 60000, Date.parse(now) + 1000), false);
  assert.equal(dueForCollection(now, 60000, Date.parse(now) + 61000), true);
});
