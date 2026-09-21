import test from "node:test";
import assert from "node:assert/strict";
import { queueNotification, interpolateTemplate, customerAllowsChannel, softDeleteNotification } from "../src/core/notifications.js";
import {
  overallHealthScore,
  failureScore,
  responseScore,
  provisionalAdjustedScore,
  evaluationState,
  eligibleAttempt,
  scoreProvider,
  metricsFromEvents,
  eventsInWindow,
  HEALTH_FORMULA_VERSION
} from "../src/core/provider-health.js";
import {
  healthStateFromScore,
  evaluateThresholds,
  resolveThresholdConfig,
  validateThresholdConfig,
  mostSevere,
  metricLevel,
  applyHysteresis,
  DEFAULT_THRESHOLD_CONFIG,
  THRESHOLD_CONFIG_VERSION
} from "../src/core/provider-thresholds.js";
import {
  canFailoverTransition,
  processNotification,
  processNotificationQueue,
  ensureNotificationProviders,
  queueBulkNotifications,
  scheduleNotification,
  cancelNotification,
  selectProvider
} from "../src/core/notification-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true };

function drainDelivery(state, message, options) {
  let now = options.now || Date.now();
  let result;
  for (let i = 0; i < 12; i += 1) {
    result = processNotification(state, message, { ...options, now });
    if (result.delivered || result.failed || result.error || result.expired || result.skipped) return result;
    now += 120000;
  }
  return result;
}

test("health formulas match the published weights and rounding", () => {
  assert.equal(failureScore(2), 80);
  assert.equal(responseScore(500), 100);
  assert.equal(responseScore(1000), 90);
  assert.equal(responseScore(800), 94);
  assert.equal(overallHealthScore({
    success: 98,
    response: 84,
    failure: 80,
    timeout: 97,
    availability: 99,
    queue: 85,
    rateLimit: 99
  }), 91.9);
  assert.equal(provisionalAdjustedScore(92, 20), 78.4);
  assert.equal(evaluationState({ attempts: 0, healthChecks: 0 }), "Initializing");
  assert.equal(HEALTH_FORMULA_VERSION, "1.0.0");
});

test("zero eligible events are not scored as 100 or 0", () => {
  const metrics = metricsFromEvents([]);
  const scored = scoreProvider(metrics);
  assert.equal(scored.healthScore, null);
  assert.equal(scored.healthState, "Not Evaluated");
  assert.equal(eligibleAttempt({ outcome: "Queued" }), false);
  assert.equal(eligibleAttempt({ outcome: "Delivered" }), true);
});

test("rolling windows exclude events outside the 1-hour routing window", () => {
  const now = Date.parse("2026-09-09T14:30:00.000Z");
  const events = [
    { outcome: "Delivered", endedAt: "2026-09-09T13:30:00.000Z" },
    { outcome: "Failed", endedAt: "2026-09-09T13:29:00.000Z" },
    { outcome: "Delivered", endedAt: "2026-09-09T14:30:00.000Z" }
  ];
  const windowed = eventsInWindow(events, now, 60 * 60 * 1000);
  assert.equal(windowed.length, 2);
});

test("queueNotification is idempotent and respects opt-out without throwing", () => {
  const state = { notifications: [], notificationPreferences: [{ customerId: "c1", sms: false }] };
  const first = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    customerId: "c2",
    vars: { name: "Ama", amount: "10.00", receiptNo: "R1", balance: "10.00" },
    uid,
    idempotencyKey: "col-1"
  });
  const again = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    customerId: "c2",
    vars: { name: "Ama", amount: "10.00", receiptNo: "R1", balance: "10.00" },
    uid,
    idempotencyKey: "col-1"
  });
  assert.equal(again.duplicate, true);
  assert.equal(first.notification.id, again.notification.id);
  assert.equal(state.notifications.length, 1);
  const skipped = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    customerId: "c1",
    vars: { name: "Kofi", amount: "1.00" },
    uid
  });
  assert.equal(skipped.skipped, true);
  assert.equal(customerAllowsChannel({ sms: false }, "SMS"), false);
  assert.match(interpolateTemplate("Hi {{customer_name}}", { name: "Ama" }), /Ama/);
});

test("invalid failover transitions are rejected", () => {
  assert.equal(canFailoverTransition("Queued", "Delivered"), false);
  assert.equal(canFailoverTransition("Queued", "Provider Selected"), true);
  assert.equal(canFailoverTransition("Delivered", "Sending"), false);
});

test("failed SMS retries then fails over to the backup provider without duplicating the message", () => {
  const state = { notifications: [], notificationProviders: [], deliveryAttempts: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    vars: { name: "Ama", amount: "10.00", receiptNo: "R1", balance: "10.00" },
    uid
  });
  const result = drainDelivery(state, queued.notification, {
    uid,
    now: Date.now(),
    transport: (provider) => provider.id === "sms-primary"
      ? { ok: false, outcome: "Failed", reason: "timeout", responseMs: 30 }
      : { ok: true, outcome: "Delivered", responseMs: 20 }
  });
  assert.equal(result.delivered, true);
  assert.equal(queued.notification.failoverState, "Delivered");
  assert.equal(queued.notification.providerId, "sms-backup");
  assert.equal(state.notifications.length, 1);
  assert.ok(state.deliveryAttempts.length >= 2);
});

test("in-app dispatch never rolls back collections when SMS would fail", () => {
  const state = {
    notifications: [],
    collections: [{ id: "col1", amount: 50, reversed: false }],
    notificationProviders: [],
    deliveryAttempts: []
  };
  queueNotification(state, {
    event: "contribution_received",
    channel: "In-App",
    vars: { name: "Ama", amount: "50.00", receiptNo: "R1", balance: "50.00" },
    uid
  });
  processNotificationQueue(state, {
    uid,
    transport: () => ({ ok: false, outcome: "Failed", reason: "down", responseMs: 5 })
  });
  assert.equal(state.collections[0].amount, 50);
  assert.equal(state.collections[0].reversed, false);
});

test("bulk send and schedules require permission; collector cannot broadcast", () => {
  const state = {
    notifications: [],
    customers: [{ id: "c1", name: "Ama", groupId: "g1", active: true }],
    scheduledNotifications: []
  };
  const collector = { id: "u-col", role: "Collector" };
  assert.match(queueBulkNotifications(state, { event: "meeting_reminder", user: collector, uid }).error, /cannot send bulk/i);
  const scheduled = scheduleNotification(state, { event: "meeting_reminder", channel: "In-App" }, owner, uid);
  assert.ok(scheduled.schedule);
  const bulk = queueBulkNotifications(state, { event: "meeting_reminder", channel: "In-App", user: owner, uid });
  assert.equal(bulk.queued, 1);
});

test("soft delete hides the inbox item but keeps history", () => {
  const state = { notifications: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "In-App",
    vars: { name: "Ama", amount: "1.00" },
    uid
  });
  softDeleteNotification(queued.notification);
  assert.equal(queued.notification.deleted, true);
  assert.equal(state.notifications.length, 1);
});

test("maintenance providers are skipped for new traffic", () => {
  const state = { notificationProviders: [], deliveryAttempts: [] };
  ensureNotificationProviders(state);
  const sms = state.notificationProviders.find((item) => item.id === "sms-primary");
  sms.maintenance = true;
  const selected = selectProvider(state, "SMS");
  assert.notEqual(selected.provider.id, "sms-primary");
});

test("cancel is a terminal failover state", () => {
  const state = { notifications: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    vars: { name: "Ama", amount: "1.00" },
    uid
  });
  const cancelled = cancelNotification(queued.notification, owner);
  assert.equal(cancelled.message.failoverState, "Cancelled");
  const again = processNotification(state, queued.notification, { uid });
  assert.equal(again.skipped, true);
});

test("a locked notification is not processed by a second worker", () => {
  const state = { notifications: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "In-App",
    vars: { name: "Ama", amount: "1.00" },
    uid
  });
  queued.notification.processingLock = true;
  const result = processNotification(state, queued.notification, { uid });
  assert.match(result.error, /already being processed/i);
});

test("permanent validation errors do not fail over", () => {
  const state = { notifications: [], notificationProviders: [], deliveryAttempts: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    vars: { name: "Ama", amount: "1.00", receiptNo: "R1", balance: "1.00" },
    uid
  });
  const result = processNotification(state, queued.notification, {
    uid,
    transport: () => ({ ok: false, outcome: "Failed", reason: "invalid recipient", permanent: true, responseMs: 10 })
  });
  assert.equal(result.failed, true);
  assert.equal(queued.notification.failoverState, "Permanent Failure");
  assert.equal(queued.notification.providerId, "sms-primary");
});

test("score bands are inclusive on the lower bound and exclusive on the upper bound", () => {
  assert.equal(healthStateFromScore(0), "Unhealthy");
  assert.equal(healthStateFromScore(19.99), "Unhealthy");
  assert.equal(healthStateFromScore(20), "Critical");
  assert.equal(healthStateFromScore(39.99), "Critical");
  assert.equal(healthStateFromScore(40), "Poor");
  assert.equal(healthStateFromScore(59.99), "Poor");
  assert.equal(healthStateFromScore(60), "Degraded");
  assert.equal(healthStateFromScore(74.99), "Degraded");
  assert.equal(healthStateFromScore(75), "Stable");
  assert.equal(healthStateFromScore(89.99), "Stable");
  assert.equal(healthStateFromScore(90), "Healthy");
  assert.equal(healthStateFromScore(100), "Healthy");
});

test("the most severe metric threshold wins and missing metrics are skipped", () => {
  assert.equal(mostSevere(["Degraded", "Critical", "Warning"]), "Critical");
  assert.equal(metricLevel(null, DEFAULT_THRESHOLD_CONFIG.metrics.responseMs), "Not Available");
  const evaluated = evaluateThresholds({
    score: 91,
    previousState: "Not Evaluated",
    metricValues: { responseMs: 1200, successRate: 50, queueUtilization: 20 }
  });
  assert.equal(evaluated.combinedState, "Critical");
  assert.ok(evaluated.missing.includes("availability"));
});

test("hysteresis keeps Degraded until the recovery floor and recovery advances one state", () => {
  assert.equal(applyHysteresis("Degraded", "Stable", 62, 5), "Degraded");
  assert.equal(applyHysteresis("Degraded", "Healthy", 95, 5), "Stable");
});

test("Poor, Critical, and Unhealthy require three consecutive evaluations", () => {
  let previous = "Healthy";
  let declineStreak = 0;
  let pendingState = "";
  let last;
  for (let i = 0; i < 3; i += 1) {
    last = evaluateThresholds({
      score: 10,
      previousState: previous,
      declineStreak,
      pendingState
    });
    previous = last.healthState;
    declineStreak = last.declineStreak;
    pendingState = last.pendingState;
  }
  assert.equal(last.healthState, "Unhealthy");
  const held = evaluateThresholds({ score: 10, previousState: "Healthy", declineStreak: 0, pendingState: "" });
  assert.equal(held.healthState, "Healthy");
  assert.equal(held.audit.held, true);
});

test("threshold configs inherit provider over channel over global and keep their version", () => {
  const resolved = resolveThresholdConfig({
    provider: { hysteresis: 8, version: "p1", effectiveFrom: "2020-01-01T00:00:00.000Z" },
    channel: { hysteresis: 6, version: "c1", effectiveFrom: "2020-01-01T00:00:00.000Z" },
    global: { hysteresis: 4, version: "g1", effectiveFrom: "2020-01-01T00:00:00.000Z" }
  });
  assert.equal(resolved.hysteresis, 8);
  assert.equal(resolved.inheritedFrom, "provider");
  const expired = resolveThresholdConfig({
    provider: { hysteresis: 8, version: "p1", effectiveFrom: "2020-01-01T00:00:00.000Z", effectiveTo: "2020-12-31T00:00:00.000Z" },
    channel: { hysteresis: 6, version: "c1", effectiveFrom: "2020-01-01T00:00:00.000Z" },
    at: "2026-09-09T00:00:00.000Z"
  });
  assert.equal(expired.hysteresis, 6);
  assert.equal(expired.inheritedFrom, "channel");
  const evaluated = evaluateThresholds({ score: 91, config: { version: "keep-me" } });
  assert.equal(evaluated.thresholdVersion, "keep-me");
  assert.equal(evaluated.audit.configurationVersion, "keep-me");
  assert.equal(THRESHOLD_CONFIG_VERSION, "1.0.0");
});

test("invalid threshold configs are rejected before use", () => {
  const overlap = validateThresholdConfig({
    bands: [
      { state: "Unhealthy", min: 0, max: 30, maxInclusive: true },
      { state: "Critical", min: 20, max: 40, maxInclusive: false }
    ]
  });
  assert.match(overlap.error, /overlap/i);
  const hysteresis = validateThresholdConfig({ hysteresis: -1 });
  assert.match(hysteresis.error, /hysteresis/i);
  assert.equal(validateThresholdConfig(DEFAULT_THRESHOLD_CONFIG).ok, true);
});

test("alert thresholds are independent of failover and disable", () => {
  const evaluated = evaluateThresholds({ score: 65, previousState: "Not Evaluated" });
  assert.equal(evaluated.alerts.alert, true);
  assert.equal(evaluated.alerts.failover, false);
  assert.equal(evaluated.alerts.disable, false);
});

