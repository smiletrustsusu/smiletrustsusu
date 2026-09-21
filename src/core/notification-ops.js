/**
 * Central notification dispatch, providers, failover, bulk, and schedules.
 * Financial callers keep using queueNotification; this module never rolls back money.
 */
import { canAction } from "./rbac.js";
import { queueNotification, interpolateTemplate, allNotificationTemplates } from "./notifications.js";
import {
  metricsFromEvents,
  scoreProvider,
  routingEligible,
  HEALTH_FORMULA_VERSION,
  eventsInWindow,
  metricValuesFrom
} from "./provider-health.js";
import { evaluateThresholds, resolveThresholdConfig } from "./provider-thresholds.js";
import { registerJobHandler } from "./job-ops.js";

export const FAILOVER_TRANSITIONS = {
  Queued: ["Provider Selected", "Cancelled"],
  "Provider Selected": ["Sending", "Failed"],
  Sending: ["Awaiting Provider Response", "Failed"],
  "Awaiting Provider Response": ["Delivered", "Failed", "Expired"],
  Failed: ["Retry Scheduled", "Retry Limit Reached"],
  "Retry Scheduled": ["Retrying", "Cancelled", "Expired"],
  Retrying: ["Sending", "Retry Limit Reached"],
  "Retry Limit Reached": ["Provider Marked Degraded", "Permanent Failure"],
  "Provider Marked Degraded": ["Selecting Alternate Provider"],
  "Selecting Alternate Provider": ["Provider Selected", "Permanent Failure"],
  Delivered: [],
  Cancelled: [],
  Expired: [],
  "Permanent Failure": []
};

export const TERMINAL_FAILOVER = ["Delivered", "Cancelled", "Expired", "Permanent Failure"];

export function canFailoverTransition(from, to) {
  return (FAILOVER_TRANSITIONS[from] || []).includes(to);
}

export function transitionFailover(message, to, audit) {
  const from = message.failoverState || "Queued";
  if (!canFailoverTransition(from, to)) {
    if (audit) audit.push({ previous: from, next: to, rejected: true, at: new Date().toISOString() });
    return { error: `Invalid failover transition ${from} → ${to}` };
  }
  message.failoverState = to;
  if (audit) audit.push({ previous: from, next: to, rejected: false, at: new Date().toISOString(), messageId: message.messageId });
  return { ok: true };
}

export function defaultProviders() {
  return [
    { id: "sms-primary", name: "SMS Provider A", channel: "SMS", priority: 1, enabled: true, maintenance: false, maxRetries: 2, timeoutMs: 2000, cost: 0.03, capacity: 100, healthState: "Not Evaluated", consecutiveFailures: 0, displayedScore: null },
    { id: "sms-backup", name: "SMS Provider B", channel: "SMS", priority: 2, enabled: true, maintenance: false, maxRetries: 2, timeoutMs: 2000, cost: 0.04, capacity: 100, healthState: "Not Evaluated", consecutiveFailures: 0, displayedScore: null },
    { id: "wa-primary", name: "WhatsApp Provider A", channel: "WhatsApp", priority: 1, enabled: true, maintenance: false, maxRetries: 2, timeoutMs: 3000, cost: 0.05, capacity: 80, healthState: "Not Evaluated", consecutiveFailures: 0, displayedScore: null },
    { id: "email-smtp", name: "SMTP Server", channel: "Email", priority: 1, enabled: true, maintenance: false, maxRetries: 2, timeoutMs: 4000, cost: 0, capacity: 200, healthState: "Not Evaluated", consecutiveFailures: 0, displayedScore: null },
    { id: "push-primary", name: "Push Provider A", channel: "Push", priority: 1, enabled: true, maintenance: false, maxRetries: 1, timeoutMs: 1500, cost: 0, capacity: 200, healthState: "Not Evaluated", consecutiveFailures: 0, displayedScore: null },
    { id: "inapp-local", name: "In-App Local", channel: "In-App", priority: 1, enabled: true, maintenance: false, maxRetries: 0, timeoutMs: 50, cost: 0, capacity: 1000, healthState: "Healthy", consecutiveFailures: 0, displayedScore: 100 }
  ];
}

export function ensureNotificationProviders(state) {
  state.notificationProviders = state.notificationProviders || [];
  const have = new Set(state.notificationProviders.map((item) => item.id));
  defaultProviders().forEach((provider) => {
    if (!have.has(provider.id)) state.notificationProviders.push({ ...provider, secretMasked: true });
  });
  return state.notificationProviders;
}

export function providerHealthSnapshot(provider, events = [], now = Date.now()) {
  const windowed = eventsInWindow(events.filter((item) => item.providerId === provider.id), now);
  const metrics = metricsFromEvents(windowed, {
    queueSize: provider.queueSize || 0,
    capacity: provider.capacity || 100,
    successfulChecks: provider.successfulChecks || 0,
    totalChecks: provider.totalChecks || 0,
    consecutiveFailures: provider.consecutiveFailures || 0
  });
  const scored = scoreProvider(metrics, { previousDisplayed: provider.displayedScore });
  return { ...scored, providerId: provider.id, channel: provider.channel, windowStart: new Date(now - 3600000).toISOString(), windowEnd: new Date(now).toISOString(), thresholdVersion: scored.thresholdVersion };
}

export function applyProviderThresholdEvaluation(state, provider, now = Date.now()) {
  const events = (state.deliveryAttempts || []).filter((item) => item.providerId === provider.id);
  const snapshot = providerHealthSnapshot(provider, events, now);
  const config = resolveThresholdConfig({
    provider: provider.thresholdConfig,
    channel: (state.notificationThresholds || []).find((item) => item.scope === "channel" && item.channel === provider.channel),
    global: (state.notificationThresholds || []).find((item) => item.scope === "global"),
    at: new Date(now).toISOString()
  });
  const metrics = metricsFromEvents(eventsInWindow(events, now), {
    queueSize: provider.queueSize || 0,
    capacity: provider.capacity || 100,
    successfulChecks: provider.successfulChecks || 0,
    totalChecks: provider.totalChecks || 0,
    consecutiveFailures: provider.consecutiveFailures || 0
  });
  const evaluated = evaluateThresholds({
    score: snapshot.displayedScore,
    previousState: provider.healthState || "Not Evaluated",
    declineStreak: provider.declineStreak || 0,
    recoveryStreak: provider.recoveryStreak || 0,
    pendingState: provider.pendingHealthState || "",
    metricValues: metricValuesFrom(metrics),
    config,
    at: new Date(now).toISOString()
  });
  provider.healthState = evaluated.healthState;
  provider.displayedScore = snapshot.displayedScore;
  provider.declineStreak = evaluated.declineStreak;
  provider.recoveryStreak = evaluated.recoveryStreak;
  provider.pendingHealthState = evaluated.pendingState;
  provider.thresholdVersion = evaluated.thresholdVersion;
  state.notificationActivityLogs = state.notificationActivityLogs || [];
  state.notificationActivityLogs.push({
    id: `${provider.id}-thr-${now}`,
    action: "threshold_evaluation",
    providerId: provider.id,
    ...evaluated.audit
  });
  return evaluated;
}

export function selectProvider(state, channel, { usedIds = [], strategy = "priority", emergency = false, onboarding = false } = {}) {
  const providers = ensureNotificationProviders(state)
    .filter((item) => item.channel === channel)
    .filter((item) => item.enabled && !item.maintenance && !item.disabled)
    .filter((item) => !usedIds.includes(item.id));
  const ranked = providers
    .map((provider) => {
      const events = (state.deliveryAttempts || []).filter((item) => item.providerId === provider.id);
      const health = providerHealthSnapshot(provider, events);
      return { provider, health };
    })
    .filter((row) => routingEligible(row.health.healthState, row.health.evaluationState, { emergency, onboarding: onboarding || row.health.evaluationState !== "Fully Evaluated" && row.health.provisional && row.provider.trialRouting }))
    .sort((a, b) => {
      if (strategy === "lowestCost") return Number(a.provider.cost || 0) - Number(b.provider.cost || 0);
      const scoreA = a.health.displayedScore == null ? -1 : a.health.displayedScore;
      const scoreB = b.health.displayedScore == null ? -1 : b.health.displayedScore;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return Number(a.provider.priority || 99) - Number(b.provider.priority || 99);
    });
  if (!ranked.length) {
    const fallback = providers.sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99))[0];
    return fallback ? { provider: fallback, health: providerHealthSnapshot(fallback, []) } : null;
  }
  return ranked[0];
}

function logAttempt(state, row) {
  state.deliveryAttempts = state.deliveryAttempts || [];
  state.deliveryAttempts.push(row);
  state.notificationActivityLogs = state.notificationActivityLogs || [];
  state.notificationActivityLogs.push({
    id: row.id + "-log",
    action: "delivery_attempt",
    messageId: row.messageId,
    providerId: row.providerId,
    result: row.outcome,
    createdAt: row.endedAt
  });
}

export function defaultTransport(provider, message) {
  if (provider.channel === "In-App") {
    return { ok: true, outcome: "Delivered", responseMs: 5, providerMessageId: message.id };
  }
  return { ok: true, outcome: "Delivered", responseMs: 40, providerMessageId: `${provider.id}:${message.id}` };
}

function failToPermanent(message, audit) {
  if (message.failoverState === "Selecting Alternate Provider") {
    transitionFailover(message, "Permanent Failure", audit);
  } else {
    if (canFailoverTransition(message.failoverState, "Failed")) transitionFailover(message, "Failed", audit);
    if (canFailoverTransition(message.failoverState, "Retry Limit Reached")) transitionFailover(message, "Retry Limit Reached", audit);
    if (canFailoverTransition(message.failoverState, "Permanent Failure")) transitionFailover(message, "Permanent Failure", audit);
  }
  message.status = "Failed";
}

export function processNotification(state, message, { transport = defaultTransport, now = Date.now(), uid = (p) => `${p}-${now}` } = {}) {
  if (message.processingLock) return { error: "Notification is already being processed" };
  if (TERMINAL_FAILOVER.includes(message.failoverState)) return { skipped: true, reason: "terminal" };
  if (message.expiresAt && Date.parse(message.expiresAt) < now) {
    const audit = message.failoverAudit || (message.failoverAudit = []);
    const target = message.failoverState === "Queued" ? "Cancelled" : "Expired";
    const moved = transitionFailover(message, target, audit);
    if (moved.error) return moved;
    message.status = target === "Cancelled" ? "Cancelled" : "Expired";
    return { expired: true };
  }
  message.processingLock = true;
  const audit = message.failoverAudit || (message.failoverAudit = []);
  const used = message.triedProviders || (message.triedProviders = []);
  try {
    if (message.failoverState === "Queued") transitionFailover(message, "Provider Selected", audit);
    if (message.failoverState === "Retry Scheduled") {
      if (message.nextRetryAt && Date.parse(message.nextRetryAt) > now) return { waiting: true };
      transitionFailover(message, "Retrying", audit);
      transitionFailover(message, "Sending", audit);
    }
    let selected = selectProvider(state, message.channel, { usedIds: used });
    if (!selected) {
      failToPermanent(message, audit);
      return { error: "No eligible provider" };
    }
    if (message.failoverState === "Selecting Alternate Provider") transitionFailover(message, "Provider Selected", audit);
    if (message.failoverState === "Provider Selected") transitionFailover(message, "Sending", audit);
    message.providerId = selected.provider.id;
    const started = now;
    let result;
    try {
      result = transport(selected.provider, message) || {};
    } catch (error) {
      result = { ok: false, outcome: "Failed", reason: error.message, responseMs: 0 };
    }
    const ended = now + Number(result.responseMs || 0);
    const outcome = result.outcome || (result.ok ? "Delivered" : "Failed");
    logAttempt(state, {
      id: uid("att"),
      messageId: message.messageId || message.id,
      notificationId: message.id,
      providerId: selected.provider.id,
      channel: message.channel,
      attemptNumber: (message.retryCount || 0) + 1,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      responseMs: result.responseMs || 0,
      outcome,
      reason: result.reason || "",
      failover: false
    });
    if (message.failoverState === "Sending") transitionFailover(message, "Awaiting Provider Response", audit);
    if (outcome === "Delivered" || outcome === "Accepted") {
      transitionFailover(message, "Delivered", audit);
      message.status = "Sent";
      message.deliveredAt = new Date(ended).toISOString();
      selected.provider.consecutiveFailures = 0;
      selected.provider.lastSuccessAt = message.deliveredAt;
      applyProviderThresholdEvaluation(state, selected.provider, ended);
      return { delivered: true, providerId: selected.provider.id };
    }
    transitionFailover(message, "Failed", audit);
    selected.provider.consecutiveFailures = Number(selected.provider.consecutiveFailures || 0) + 1;
    selected.provider.lastFailureAt = new Date(ended).toISOString();
    applyProviderThresholdEvaluation(state, selected.provider, ended);
    if (result.permanent || result.noFailover) {
      transitionFailover(message, "Retry Limit Reached", audit);
      transitionFailover(message, "Permanent Failure", audit);
      message.status = "Failed";
      return { failed: true, reason: result.reason || "permanent" };
    }
    const maxRetries = Number(selected.provider.maxRetries || 0);
    if ((message.providerRetryCount || 0) < maxRetries) {
      message.providerRetryCount = Number(message.providerRetryCount || 0) + 1;
      message.retryCount = Number(message.retryCount || 0) + 1;
      message.nextRetryAt = new Date(now + retryDelayMs(message.providerRetryCount)).toISOString();
      transitionFailover(message, "Retry Scheduled", audit);
      message.status = "Queued";
      return { retry: true };
    }
    transitionFailover(message, "Retry Limit Reached", audit);
    transitionFailover(message, "Provider Marked Degraded", audit);
    used.push(selected.provider.id);
    transitionFailover(message, "Selecting Alternate Provider", audit);
    message.providerRetryCount = 0;
    const next = selectProvider(state, message.channel, { usedIds: used, emergency: true });
    if (!next) {
      transitionFailover(message, "Permanent Failure", audit);
      message.status = "Failed";
      return { failed: true };
    }
    transitionFailover(message, "Provider Selected", audit);
    message.processingLock = false;
    return processNotification(state, message, { transport, now, uid });
  } finally {
    message.processingLock = false;
  }
}

export function retryDelayMs(attempt) {
  if (attempt <= 1) return 10000;
  if (attempt === 2) return 30000;
  return 60000;
}

export function processNotificationQueue(state, options = {}) {
  const pending = (state.notifications || []).filter((item) =>
    !item.deleted
    && !TERMINAL_FAILOVER.includes(item.failoverState || "Queued")
    && ["Queued", "Retry Scheduled", "Provider Selected", "Selecting Alternate Provider"].includes(item.failoverState || "Queued")
  );
  let delivered = 0;
  let failed = 0;
  pending.forEach((item) => {
    if (item.failoverState === "Queued" || item.failoverState === "Retry Scheduled" || item.failoverState === "Failed") {
      const result = processNotification(state, item, options);
      if (result.delivered) delivered += 1;
      if (result.failed || result.error) failed += 1;
    }
  });
  return { processed: pending.length, delivered, failed };
}

export function cancelNotification(message, user) {
  if (!canAction(user, "Notification.Send") && !canAction(user, "Notification.Broadcast")) {
    return { error: "You cannot cancel notifications" };
  }
  const result = transitionFailover(message, "Cancelled", message.failoverAudit || (message.failoverAudit = []));
  if (result.error) return result;
  message.status = "Cancelled";
  return { message };
}

export function saveNotificationPreference(state, customerId, prefs) {
  state.notificationPreferences = state.notificationPreferences || [];
  const existing = state.notificationPreferences.find((item) => item.customerId === customerId);
  const next = { customerId, ...prefs, updatedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, next);
  else state.notificationPreferences.push(next);
  return { preference: existing || next };
}

export function previewBulkRecipients(state, filters = {}) {
  return (state.customers || []).filter((customer) => {
    if (customer.active === false || customer.memberStatus === "Closed") return false;
    if (filters.branchId && customer.groupId !== filters.branchId && customer.branchId !== filters.branchId) return false;
    if (filters.agentId && customer.collectorId !== filters.agentId) return false;
    if (filters.groupId && customer.susuGroupId !== filters.groupId && customer.groupId !== filters.groupId) return false;
    if (filters.productId && customer.savingsProductId !== filters.productId) return false;
    return true;
  });
}

export function queueBulkNotifications(state, { event, channel = "SMS", filters = {}, vars = {}, user, uid }) {
  if (!canAction(user, "Notification.Broadcast")) return { error: "You cannot send bulk messages" };
  const recipients = previewBulkRecipients(state, filters);
  const batchId = uid("batch");
  const results = recipients.map((customer) => queueNotification(state, {
    event,
    channel,
    customerId: customer.id,
    vars: { ...vars, name: customer.name, customer_name: customer.name, customerNumber: customer.customerNumber || customer.accountNo },
    uid,
    idempotencyKey: `${batchId}:${customer.id}:${event}`,
    committed: true
  }));
  return { batchId, queued: results.filter((item) => item.notification && !item.duplicate).length, skipped: results.filter((item) => item.skipped).length, total: recipients.length };
}

export function scheduleNotification(state, data, user, uid) {
  if (!canAction(user, "Notification.Schedule")) return { error: "You cannot schedule notifications" };
  const templates = allNotificationTemplates(state);
  if (!templates[data.event]) return { error: "Unknown notification event" };
  const row = {
    id: uid("nsch"),
    event: data.event,
    channel: data.channel || "SMS",
    frequency: data.frequency || "Daily",
    nextRunAt: data.nextRunAt || new Date().toISOString(),
    filters: data.filters || {},
    vars: data.vars || {},
    userId: user?.id || "",
    active: true,
    createdAt: new Date().toISOString()
  };
  state.scheduledNotifications = state.scheduledNotifications || [];
  state.scheduledNotifications.push(row);
  return { schedule: row };
}

export function runDueNotificationSchedules(state, user, uid, now = new Date().toISOString()) {
  const due = (state.scheduledNotifications || []).filter((item) => item.active && item.nextRunAt <= now);
  due.forEach((item) => {
    queueBulkNotifications(state, {
      event: item.event,
      channel: item.channel,
      filters: item.filters,
      vars: item.vars,
      user: user || { role: "SystemOwner", systemOwner: true, id: item.userId },
      uid
    });
    const days = { Daily: 1, Weekly: 7, Monthly: 30, Annual: 365, "One-Time": 0 }[item.frequency] || 1;
    if (item.frequency === "One-Time") item.active = false;
    else {
      const next = new Date(item.nextRunAt);
      next.setDate(next.getDate() + days);
      item.nextRunAt = next.toISOString();
    }
    item.lastRunAt = now;
  });
  return { ran: due.length };
}

export function createAnnouncement(state, data, user, uid) {
  if (!canAction(user, "Notification.Broadcast")) return { error: "You cannot publish announcements" };
  const row = {
    id: uid("ann"),
    title: String(data.title || "").trim(),
    body: String(data.body || "").trim(),
    audience: data.audience || "All Users",
    branchId: data.branchId || "",
    priority: data.priority || "Normal",
    effectiveDate: data.effectiveDate || new Date().toISOString().slice(0, 10),
    expiryDate: data.expiryDate || "",
    createdBy: user?.id || "",
    createdAt: new Date().toISOString()
  };
  if (!row.title) return { error: "Title is required" };
  state.announcements = state.announcements || [];
  state.announcements.push(row);
  return { announcement: row };
}

export function upsertProvider(state, data, user) {
  if (!canAction(user, "Notification.Provider")) return { error: "You cannot change providers" };
  ensureNotificationProviders(state);
  const existing = state.notificationProviders.find((item) => item.id === data.id);
  if (!existing) return { error: "Provider not found" };
  const previous = { enabled: existing.enabled, priority: existing.priority, maintenance: existing.maintenance };
  if (data.enabled != null) existing.enabled = Boolean(data.enabled);
  if (data.priority != null) existing.priority = Number(data.priority);
  if (data.maintenance != null) existing.maintenance = Boolean(data.maintenance);
  state.notificationActivityLogs = state.notificationActivityLogs || [];
  state.notificationActivityLogs.push({
    id: `${existing.id}-ovr-${Date.now()}`,
    action: "provider_override",
    providerId: existing.id,
    previous,
    next: { enabled: existing.enabled, priority: existing.priority, maintenance: existing.maintenance },
    userId: user?.id || "",
    createdAt: new Date().toISOString()
  });
  return { provider: existing };
}

export function communicationReport(state, { channel = "", from = "", to = "" } = {}) {
  const rows = (state.notifications || []).filter((item) => {
    if (item.deleted) return false;
    if (channel && item.channel !== channel) return false;
    const day = String(item.createdAt || "").slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  const sent = rows.filter((item) => item.status === "Sent" || item.failoverState === "Delivered").length;
  const failed = rows.filter((item) => item.status === "Failed" || item.failoverState === "Permanent Failure").length;
  return {
    total: rows.length,
    sent,
    failed,
    queued: rows.filter((item) => item.status === "Queued").length,
    deliveryRate: rows.length ? Math.round((sent / rows.length) * 100) : 0,
    failureRate: rows.length ? Math.round((failed / rows.length) * 100) : 0,
    byChannel: CHANNEL_COUNTS(rows)
  };
}

function CHANNEL_COUNTS(rows) {
  const map = {};
  rows.forEach((item) => {
    map[item.channel] = (map[item.channel] || 0) + 1;
  });
  return map;
}

export function searchNotifications(state, query = {}) {
  const term = String(query.q || "").trim().toLowerCase();
  return (state.notifications || []).filter((item) => {
    if (item.deleted) return false;
    if (query.channel && item.channel !== query.channel) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.event && item.event !== query.event) return false;
    if (!term) return true;
    return [item.body, item.title, item.customerId, item.id, item.messageId].some((value) => String(value || "").toLowerCase().includes(term));
  });
}

export { interpolateTemplate, HEALTH_FORMULA_VERSION };

function runNotificationJob(state, _job, ctx) {
  runDueNotificationSchedules(state, ctx.user, ctx.uid, typeof ctx.now === "number" ? new Date(ctx.now).toISOString() : ctx.now);
  return { ok: true, orchestrated: true };
}

["sms_queue", "whatsapp_queue", "email_queue", "push_queue", "notification_retry"].forEach((type) => {
  registerJobHandler(type, runNotificationJob);
});
