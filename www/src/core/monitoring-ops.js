/**
 * Module 19 — Monitoring, Observability, Health & Diagnostics.
 * Central operational intelligence. Does not post collections, interest, or ledgers.
 * Android telemetry is buffered offline and flushed through idempotency + sync.
 * No REST/GraphQL. Privacy: no photos, contacts, SMS, calls, mic, camera, or continuous GPS.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { canPerformOffline, enqueueSyncItem, syncDashboard, deviceIsRevoked } from "./sync-ops.js";
import { jobDashboard, registerJobHandler, ensureJobState } from "./job-ops.js";
import { paymentDashboard } from "./payment-ops.js";
import { documentDashboard } from "./document-ops.js";
import { getConfigValue, isFeatureEnabled } from "./system-config.js";
import { queueNotification } from "./notifications.js";
import {
  HEALTH_DOMAINS,
  ALERT_SEVERITIES,
  INCIDENT_STATES,
  DEVICE_OPERATIONAL_STATUSES,
  DEFAULT_ESCALATION,
  DEFAULT_THRESHOLD_BANDS,
  COLLECTION_INTERVALS_MS,
  EVENT_DRIVEN_METRICS,
  METRIC_RETENTION_DAYS,
  canTransitionIncident,
  canTransitionAlert,
  isActiveAlertStatus,
  statusFromScore,
  componentHealth,
  overallHealth,
  offlineReadinessScore,
  canCollectWithIntegrity,
  forbiddenTelemetry,
  maskSensitive,
  linearForecast,
  severityFromBands,
  validateBands,
  inRecoveryInterval,
  dueForCollection,
  adaptiveIntervalMs,
  notificationChannelsFor,
  formatInterval,
  PLAIN_LANGUAGE_THRESHOLD_RULE
} from "./monitoring-lifecycle.js";

export {
  HEALTH_DOMAINS,
  ALERT_SEVERITIES,
  INCIDENT_STATES,
  DEVICE_OPERATIONAL_STATUSES,
  canTransitionIncident,
  statusFromScore,
  componentHealth,
  overallHealth,
  offlineReadinessScore,
  canCollectWithIntegrity,
  maskSensitive,
  linearForecast,
  severityFromBands,
  validateBands,
  dueForCollection,
  adaptiveIntervalMs,
  formatInterval,
  PLAIN_LANGUAGE_THRESHOLD_RULE,
  DEFAULT_THRESHOLD_BANDS,
  COLLECTION_INTERVALS_MS
};

export const MONITOR_SCHEMA_VERSION = "1.0.0";

const MONITOR_ARRAYS = [
  "monitoringServices",
  "healthChecks",
  "healthScores",
  "monitoringMetrics",
  "monitoringAlerts",
  "alertRules",
  "alertHistory",
  "incidents",
  "incidentEvents",
  "traces",
  "traceSpans",
  "logEntries",
  "diagnostics",
  "capacityStatistics",
  "monitoringActivityLogs",
  "androidDevices",
  "deviceHealthSnapshots",
  "deviceConnectivityHistory",
  "offlineHealthEvents",
  "deviceStorageMetrics",
  "synchronizationMetrics",
  "deviceSecurityEvents",
  "applicationCrashReports",
  "offlineMonitoringQueue",
  "deviceAlerts",
  "alertRuleVersions",
  "alertEscalationProfiles",
  "alertSuppressionRules",
  "missedCollections",
  "monitoringConfiguration"
];

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

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedServices() {
  return HEALTH_DOMAINS.filter((item) => item !== "android_device").map((domain) => ({
    id: `svc-${domain}`,
    name: domain.replace(/_/g, " "),
    domain,
    status: "healthy",
    score: 100
  }));
}

function seedAlertRules() {
  return [
    { id: "rule-queue-backlog", name: "Queue backlog", domain: "queue", metric: "queueDepth", op: "gte", threshold: 50, severity: "major", active: true },
    { id: "rule-worker-down", name: "Worker failure", domain: "worker", metric: "staleWorkers", op: "gte", threshold: 1, severity: "major", active: true },
    { id: "rule-payment-down", name: "Payment provider outage", domain: "payment_provider", metric: "providersDown", op: "gte", threshold: 1, severity: "critical", active: true },
    { id: "rule-sync-fail", name: "Synchronization failure", domain: "synchronization", metric: "failed", op: "gte", threshold: 5, severity: "major", active: true },
    { id: "rule-sync-conflict", name: "Sync conflicts", domain: "synchronization", metric: "conflicts", op: "gte", threshold: 3, severity: "warning", active: true },
    { id: "rule-error-rate", name: "High error rate", domain: "api", metric: "errorPct", op: "gte", threshold: 0.05, severity: "major", active: true },
    { id: "rule-storage", name: "Storage capacity", domain: "storage", metric: "storageUsedPct", op: "gte", threshold: 90, severity: "critical", active: true },
    { id: "rule-device-corrupt", name: "Database corruption", domain: "android_device", metric: "integrityFailed", op: "eq", threshold: 1, severity: "critical", active: true },
    { id: "rule-device-backlog", name: "Device sync backlog", domain: "android_device", metric: "pendingUploads", op: "gte", threshold: 50, severity: "major", active: true },
    { id: "rule-device-offline", name: "Long offline duration", domain: "android_device", metric: "offlineHours", op: "gte", threshold: 48, severity: "warning", active: true },
    { id: "rule-security", name: "Security risk", domain: "security", metric: "securityFindings", op: "gte", threshold: 1, severity: "critical", active: true },
    { id: "rule-backup-fail", name: "Backup verification failure", domain: "backup", metric: "backupFailed", op: "gte", threshold: 1, severity: "major", active: true },
    { id: "rule-fraud", name: "Fraud indicator", domain: "security", metric: "fraudDetected", op: "gte", threshold: 1, severity: "major", active: true }
  ];
}

export function ensureMonitoringState(state = {}) {
  MONITOR_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.monitoringServices.length) state.monitoringServices = seedServices();
  if (!state.alertRules.length) state.alertRules = seedAlertRules();
  if (!state.alertEscalationProfiles.length) {
    state.alertEscalationProfiles = Object.entries(DEFAULT_ESCALATION).map(([severity, profile]) => ({
      id: `esc-${severity}`,
      severity,
      ...profile
    }));
  }
  if (!state.monitoringConfiguration.length) {
    state.monitoringConfiguration.push({
      id: "mon-default",
      samplingMode: "healthy",
      maintenanceWindows: [],
      encryptedTelemetry: state.settings?.encryptOfflineQueue !== false,
      collectionIntervals: { ...COLLECTION_INTERVALS_MS },
      retentionDays: { ...METRIC_RETENTION_DAYS }
    });
  }
  ensureJobState(state);
  if (!(state.jobDefinitions || []).some((item) => item.type === "health_snapshot")) {
    state.jobDefinitions.push({
      id: "job-health-snapshot",
      type: "health_snapshot",
      category: "administrative",
      label: "Health Snapshot",
      priority: "high",
      queue: "scheduled",
      parallel: true,
      maxAttempts: 2,
      strategy: "fixed",
      backoffMs: 5000
    });
  }
  return state;
}

function auditMonitor(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "19",
    ...extras
  }, uid);
}

function logActivity(state, action, details, extras = {}, uid) {
  state.monitoringActivityLogs.push({
    id: newId("mal", uid),
    action,
    details,
    userId: extras.userId || "",
    createdAt: nowIso(extras.now)
  });
}

function compare(op, actual, threshold) {
  if (op === "eq") return Number(actual) === Number(threshold);
  if (op === "gt") return Number(actual) > Number(threshold);
  if (op === "gte") return Number(actual) >= Number(threshold);
  if (op === "lt") return Number(actual) < Number(threshold);
  if (op === "lte") return Number(actual) <= Number(threshold);
  return false;
}

export function recordMetric(state, metric = {}, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("met", uid),
    domain: metric.domain || "system",
    name: metric.name,
    value: Number(metric.value || 0),
    unit: metric.unit || "count",
    source: metric.source || "monitoring-engine",
    createdAt: nowIso(now)
  };
  state.monitoringMetrics.push(row);
  if (state.monitoringMetrics.length > 2000) {
    state.monitoringMetrics.splice(0, state.monitoringMetrics.length - 2000);
  }
  return row;
}

export function recordLog(state, entry = {}, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("log", uid),
    level: entry.level || "info",
    service: entry.service || "application",
    message: String(entry.message || ""),
    correlationId: entry.correlationId || "",
    traceId: entry.traceId || "",
    payload: maskSensitive(entry.payload || {}),
    createdAt: nowIso(now)
  };
  state.logEntries.push(row);
  if (state.logEntries.length > 2000) state.logEntries.splice(0, state.logEntries.length - 2000);
  return row;
}

export function startTrace(state, request = {}, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("trc", uid),
    traceId: request.traceId || newId("trace", uid),
    correlationId: request.correlationId || "",
    transactionId: request.transactionId || "",
    path: request.path || "",
    status: "started",
    startedAt: nowIso(now),
    error: ""
  };
  state.traces.push(row);
  return row;
}

export function addSpan(state, traceId, span = {}, uid, now) {
  ensureMonitoringState(state);
  const trace = (state.traces || []).find((item) => item.traceId === traceId || item.id === traceId);
  if (!trace) return { ok: false, error: "Trace not found" };
  trace.status = "running";
  const row = {
    id: newId("spn", uid),
    traceId: trace.traceId,
    service: span.service || "",
    name: span.name || "",
    durationMs: Number(span.durationMs || 0),
    error: span.error || "",
    createdAt: nowIso(now)
  };
  state.traceSpans.push(row);
  return { ok: true, span: row, trace };
}

export function endTrace(state, traceId, { error = "", now } = {}) {
  const trace = (state.traces || []).find((item) => item.traceId === traceId || item.id === traceId);
  if (!trace) return { ok: false, error: "Trace not found" };
  trace.endedAt = nowIso(now);
  trace.durationMs = Date.parse(trace.endedAt) - Date.parse(trace.startedAt || trace.endedAt);
  trace.error = error;
  trace.status = error ? "failed" : "completed";
  return { ok: true, trace };
}

function sampleRuntime(runtime = {}) {
  const storageUsedPct = Number(runtime.storageUsedPct ?? 0);
  return {
    cpuPct: Number(runtime.cpuPct ?? 0),
    memoryMb: Number(runtime.memoryMb ?? 0),
    diskUsedPct: Number(runtime.diskUsedPct ?? storageUsedPct),
    storageUsedPct,
    queryDurationMs: Number(runtime.queryDurationMs ?? 0),
    apiResponseMs: Number(runtime.apiResponseMs ?? 0),
    requestRate: Number(runtime.requestRate ?? 0),
    cacheHitRatio: Number(runtime.cacheHitRatio ?? 1)
  };
}

export function collectHealthSnapshot(state, { uid, now, user, runtime = {}, online = true } = {}) {
  ensureMonitoringState(state);
  if (isFeatureEnabled(state, "enableMonitoringEngine") === false) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  const ts = nowIso(now);
  const jobs = jobDashboard(state);
  const payments = paymentDashboard(state, { date: ts.slice(0, 10) });
  const sync = syncDashboard(state);
  const documents = documentDashboard(state);
  const runtimeSample = sampleRuntime(runtime);
  const paymentTotal = Number(payments.completed || 0) + Number(payments.failed || 0);
  const paymentErrorPct = paymentTotal ? Number(payments.failed || 0) / paymentTotal : 0;
  const syncOpen = Number(sync.pending || 0) + Number(sync.failed || 0);
  const domains = [
    { domain: "queue", ...componentHealth({ errorPct: jobs.queued > 80 ? 0.1 : 0, consecutiveFailures: jobs.failed }) },
    { domain: "worker", ...componentHealth({ consecutiveFailures: Math.max(0, (state.workerNodes || []).filter((item) => item.status === "offline").length) }) },
    { domain: "payment_provider", ...componentHealth({ errorPct: paymentErrorPct, consecutiveFailures: payments.providersDown }) },
    { domain: "synchronization", ...componentHealth({ errorPct: syncOpen ? Number(sync.failed || 0) / Math.max(1, syncOpen) : 0, consecutiveFailures: sync.failed }) },
    { domain: "storage", ...componentHealth({ availability: runtimeSample.storageUsedPct >= 95 ? 0.4 : 1 }) },
    { domain: "database", ...componentHealth({ meanResponseMs: runtimeSample.queryDurationMs }) },
    { domain: "api", ...componentHealth({ meanResponseMs: runtimeSample.apiResponseMs, errorPct: paymentErrorPct }) },
    { domain: "backup", ...componentHealth({ availability: (state.backupPolicies || []).length ? 1 : 0.9 }) },
    { domain: "security", ...componentHealth({ consecutiveFailures: (state.auditAlerts || []).filter((item) => item.open !== false).length }) },
    { domain: "notification_provider", ...componentHealth({ consecutiveFailures: (state.notificationProviders || []).filter((item) => item.status === "down").length }) },
    { domain: "service", ...componentHealth({ availability: online ? 1 : 0.7 }) },
    { domain: "system", ...componentHealth({ availability: online ? 1 : 0.6, meanResponseMs: runtimeSample.apiResponseMs }) }
  ];
  const facts = {
    queueDepth: jobs.queued,
    staleWorkers: (state.workerNodes || []).filter((item) => item.status === "unhealthy" || item.status === "offline").length,
    providersDown: payments.providersDown,
    failed: sync.failed,
    conflicts: sync.conflicts,
    errorPct: paymentErrorPct,
    storageUsedPct: runtimeSample.storageUsedPct,
    integrityFailed: 0,
    pendingUploads: sync.pending,
    offlineHours: 0,
    securityFindings: (state.deviceSecurityEvents || []).filter((item) => item.open !== false).length
  };
  const latestDevice = (state.deviceHealthSnapshots || []).slice(-1)[0];
  if (latestDevice) {
    facts.integrityFailed = latestDevice.integrityFailed ? 1 : 0;
    facts.pendingUploads = Number(latestDevice.pendingUploads || facts.pendingUploads);
    facts.offlineHours = Number(latestDevice.offlineHours || 0);
  }
  domains.forEach((row) => {
    const service = (state.monitoringServices || []).find((item) => item.domain === row.domain);
    if (service) {
      service.status = row.status;
      service.score = row.score;
      service.lastCheckAt = ts;
    }
    state.healthChecks.push({
      id: newId("hc", uid),
      domain: row.domain,
      status: row.status,
      score: row.score,
      createdAt: ts
    });
    state.healthScores.push({
      id: newId("hs", uid),
      domain: row.domain,
      score: row.score,
      availability: row.availability,
      errorPct: row.errorPct,
      meanResponseMs: row.meanResponseMs,
      recoveryRate: row.recoveryRate,
      consecutiveFailures: row.consecutiveFailures,
      createdAt: ts
    });
  });
  [
    ["cpuPct", runtimeSample.cpuPct, "percent"],
    ["memoryMb", runtimeSample.memoryMb, "mb"],
    ["diskUsedPct", runtimeSample.diskUsedPct, "percent"],
    ["queueDepth", jobs.queued, "count"],
    ["workerUtilization", jobs.running, "count"],
    ["syncLatency", sync.pending, "count"],
    ["paymentFailures", payments.failed, "count"],
    ["documentJobs", documents.jobs, "count"]
  ].forEach(([name, value, unit]) => recordMetric(state, { domain: "system", name, value, unit }, uid, now));
  const system = overallHealth(domains);
  evaluateAlerts(state, facts, { uid, now, user });
  recordCapacity(state, { uid, now });
  logActivity(state, "Health snapshot collected", system.status, { userId: user?.id, now }, uid);
  return { ok: true, system, domains, facts, jobs, payments, sync };
}

function configOf(state) {
  return (state.monitoringConfiguration || [])[0] || { samplingMode: "healthy", maintenanceWindows: [] };
}

function inMaintenanceWindow(state, now, domain) {
  const ts = nowMs(now);
  return (configOf(state).maintenanceWindows || []).some((window) => {
    if (window.securityOnly === false && domain === "security") return false;
    const from = Date.parse(window.from || 0);
    const to = Date.parse(window.to || 0);
    return ts >= from && ts <= to && (!window.domain || window.domain === domain);
  });
}

export function evaluateAlerts(state, facts = {}, { uid, now, user, eventDriven = false } = {}) {
  ensureMonitoringState(state);
  const raised = [];
  (state.alertRules || []).filter((rule) => rule.active !== false && rule.status !== "draft" && rule.status !== "retired").forEach((rule) => {
    const actual = facts[rule.metric];
    if (actual == null) return;
    const bands = rule.bands || (rule.useBands ? DEFAULT_THRESHOLD_BANDS[rule.metric] : null);
    let severity = rule.severity;
    let recovered = false;
    if (bands) {
      severity = severityFromBands(bands, actual);
      if (!severity || severity === "normal" || severity === "information") {
        recovered = true;
      }
    } else if (!compare(rule.op, actual, rule.threshold)) {
      return;
    }
    const existing = (state.monitoringAlerts || []).find((item) => item.ruleId === rule.id && isActiveAlertStatus(item.status));
    if (recovered) {
      if (existing && inRecoveryInterval(actual, bands?.recovery || rule.recovery || {})) {
        existing.healthySamples = Number(existing.healthySamples || 0) + 1;
        const needed = Number(bands?.recovery?.recoverySamples || rule.recovery?.recoverySamples || 1);
        if (existing.healthySamples >= needed) {
          existing.status = "resolved";
          existing.resolvedAt = nowIso(now);
          existing.preservedSeverity = existing.severity;
          state.alertHistory.push({ id: newId("ahl", uid), alertId: existing.id, action: "recovered", createdAt: nowIso(now) });
        }
      }
      return;
    }
    if (inMaintenanceWindow(state, now, rule.domain) && rule.domain !== "security" && severity !== "critical") {
      state.alertHistory.push({
        id: newId("ahl", uid),
        alertId: existing?.id || rule.id,
        action: "suppressed_maintenance",
        createdAt: nowIso(now)
      });
      return;
    }
    if (existing) {
      existing.occurrences = Number(existing.occurrences || 1) + 1;
      existing.lastOccurrenceAt = nowIso(now);
      existing.value = actual;
      existing.healthySamples = 0;
      if (severity && severity !== existing.severity) {
        existing.previousSeverity = existing.severity;
        existing.severity = severity;
        state.alertHistory.push({ id: newId("ahl", uid), alertId: existing.id, action: "severity_changed", createdAt: nowIso(now) });
      }
      return;
    }
    const key = `${rule.id}:${rule.metric}`;
    const alert = {
      id: newId("alrt", uid),
      ruleId: rule.id,
      name: rule.name,
      domain: rule.domain,
      severity,
      originalSeverity: severity,
      status: "open",
      value: actual,
      threshold: rule.threshold,
      interval: bands ? (bands.find((band) => band.severity === severity)?.notation || "") : "",
      dedupeKey: key,
      occurrences: 1,
      eventDriven: eventDriven === true || EVENT_DRIVEN_METRICS.includes(rule.metric),
      channels: notificationChannelsFor(severity),
      escalation: DEFAULT_ESCALATION[severity] || DEFAULT_ESCALATION.warning,
      createdAt: nowIso(now)
    };
    state.monitoringAlerts.push(alert);
    state.alertHistory.push({ id: newId("ahl", uid), alertId: alert.id, action: "raised", createdAt: nowIso(now) });
    auditMonitor(state, "Alert raised", `${rule.name} · ${severity}`, user, { entityId: alert.id }, uid);
    if (alert.escalation.createIncident) {
      openIncident(state, {
        title: rule.name,
        severity,
        domain: rule.domain,
        alertId: alert.id
      }, user, uid, now);
    }
    if (["major", "critical"].includes(severity)) {
      queueNotification(state, {
        event: "sync_failed",
        channel: "In-App",
        userId: user?.id || "",
        vars: { name: rule.name, amount: "0.00", receiptNo: alert.id },
        uid,
        idempotencyKey: `${alert.id}:alert`,
        correlationId: alert.id,
        committed: true
      });
    }
    raised.push(alert);
  });
  return raised;
}

export function acknowledgeAlert(state, alertId, { user, uid, now, comment = "" } = {}) {
  ensureMonitoringState(state);
  if (user && !canAction(user, "Monitor.Alert") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot acknowledge alerts" };
  }
  const alert = (state.monitoringAlerts || []).find((item) => item.id === alertId);
  if (!alert) return { ok: false, error: "Alert not found" };
  if (["major", "critical"].includes(alert.severity) && !comment && getConfigValue(state, "monitor.requireAckComment") === true) {
    return { ok: false, error: "A comment is required for major and critical acknowledgements" };
  }
  const moved = transitionAlert(state, alertId, "acknowledged", { user, uid, now, note: comment });
  if (!moved.ok) {
    alert.status = "acknowledged";
    alert.acknowledgedBy = user?.id || "";
    alert.acknowledgedAt = nowIso(now);
    state.alertHistory.push({ id: newId("ahl", uid), alertId, action: "acknowledged", createdAt: nowIso(now) });
    return { ok: true, alert };
  }
  alert.acknowledgedBy = user?.id || "";
  alert.acknowledgedAt = nowIso(now);
  alert.ackComment = comment;
  return moved;
}

export function transitionAlert(state, alertId, nextStatus, { user, uid, now, note = "" } = {}) {
  ensureMonitoringState(state);
  const alert = (state.monitoringAlerts || []).find((item) => item.id === alertId);
  if (!alert) return { ok: false, error: "Alert not found" };
  if (!canTransitionAlert(alert.status, nextStatus)) {
    return { ok: false, error: `Invalid alert transition: ${alert.status} → ${nextStatus}` };
  }
  const from = alert.status;
  alert.status = nextStatus;
  alert.updatedAt = nowIso(now);
  state.alertHistory.push({
    id: newId("ahl", uid),
    alertId,
    action: nextStatus,
    previousState: from,
    note,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  return { ok: true, alert, from, to: nextStatus };
}

export function escalateUnacknowledgedAlerts(state, { uid, now, user } = {}) {
  ensureMonitoringState(state);
  const ts = nowMs(now);
  let escalated = 0;
  (state.monitoringAlerts || []).filter((item) => isActiveAlertStatus(item.status) && !item.acknowledgedAt).forEach((alert) => {
    const profile = DEFAULT_ESCALATION[alert.severity] || DEFAULT_ESCALATION.warning;
    const ageMin = (ts - Date.parse(alert.lastEscalatedAt || alert.createdAt || 0)) / 60000;
    const level = Number(alert.escalationLevel || 0);
    const due = level === 0 ? profile.firstMinutes : profile.secondMinutes;
    if (!due || ageMin < due) return;
    alert.escalationLevel = level + 1;
    alert.lastEscalatedAt = nowIso(now);
    if (canTransitionAlert(alert.status, "escalated")) alert.status = "escalated";
    state.alertHistory.push({ id: newId("ahl", uid), alertId: alert.id, action: "escalated", createdAt: nowIso(now) });
    auditMonitor(state, "Alert escalated", `${alert.name} · level ${alert.escalationLevel}`, user, { entityId: alert.id }, uid);
    escalated += 1;
  });
  return { ok: true, escalated };
}

export function openIncident(state, request = {}, user, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("inc", uid),
    title: request.title || "Incident",
    severity: request.severity || "major",
    domain: request.domain || "system",
    status: "detected",
    alertId: request.alertId || "",
    rootCause: "",
    resolution: "",
    createdBy: user?.id || "system",
    createdAt: nowIso(now)
  };
  state.incidents.push(row);
  state.incidentEvents.push({
    id: newId("iev", uid),
    incidentId: row.id,
    previousState: "",
    newState: "detected",
    note: "opened from monitoring",
    createdAt: nowIso(now)
  });
  auditMonitor(state, "Incident opened", row.title, user, { entityId: row.id }, uid);
  return { ok: true, incident: row };
}

export function transitionIncident(state, incidentId, nextStatus, { user, uid, now, note = "", rootCause = "", resolution = "" } = {}) {
  ensureMonitoringState(state);
  if (user && !canAction(user, "Monitor.Incident") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot manage incidents" };
  }
  const incident = (state.incidents || []).find((item) => item.id === incidentId);
  if (!incident) return { ok: false, error: "Incident not found" };
  if (!canTransitionIncident(incident.status, nextStatus)) {
    return { ok: false, error: `Invalid incident transition: ${incident.status} → ${nextStatus}` };
  }
  const from = incident.status;
  incident.status = nextStatus;
  if (rootCause) incident.rootCause = rootCause;
  if (resolution) incident.resolution = resolution;
  incident.updatedAt = nowIso(now);
  state.incidentEvents.push({
    id: newId("iev", uid),
    incidentId,
    previousState: from,
    newState: nextStatus,
    note,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  auditMonitor(state, "Incident transitioned", `${from} → ${nextStatus}`, user, { entityId: incidentId }, uid);
  return { ok: true, incident };
}

export function recordCapacity(state, { uid, now } = {}) {
  ensureMonitoringState(state);
  const row = {
    id: newId("cap", uid),
    customers: (state.customers || []).length,
    collections: (state.collections || []).length,
    devices: (state.devices || []).length,
    queueItems: (state.offlineQueue || []).length,
    jobs: (state.backgroundJobs || []).length,
    storageBytes: Number(JSON.stringify(state.offlineQueue || []).length),
    createdAt: nowIso(now)
  };
  state.capacityStatistics.push(row);
  return row;
}

export function capacityForecast(state, field = "collections", horizon = 7) {
  ensureMonitoringState(state);
  const points = (state.capacityStatistics || []).map((item) => ({ value: Number(item[field] || 0) }));
  return linearForecast(points, horizon);
}

export function recordDiagnostic(state, item = {}, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("diag", uid),
    kind: item.kind || "generic",
    summary: item.summary || "",
    detail: maskSensitive(item.detail || {}),
    correlationId: item.correlationId || "",
    createdAt: nowIso(now)
  };
  state.diagnostics.push(row);
  return row;
}

export function setDeviceOperationalStatus(device, next) {
  if (!DEVICE_OPERATIONAL_STATUSES.includes(next)) {
    return { ok: false, error: "Unknown operational status" };
  }
  device.operationalStatus = next;
  return { ok: true, device };
}

export function recordDeviceSnapshot(state, snapshot = {}, { user, uid, now, online = true } = {}) {
  ensureMonitoringState(state);
  const banned = forbiddenTelemetry(snapshot);
  if (banned.length) {
    return { ok: false, error: "Privacy policy forbids this telemetry", banned };
  }
  const deviceId = snapshot.deviceId || snapshot.id;
  if (!deviceId) return { ok: false, error: "Device ID is required" };
  if (deviceIsRevoked(state, deviceId)) {
    return { ok: false, error: "This device has been revoked and cannot synchronize" };
  }
  const thresholds = {
    storageWarnPct: Number(getConfigValue(state, "android.storageWarnPct") ?? 15),
    syncBacklogAlert: Number(getConfigValue(state, "android.syncBacklogAlert") ?? 50),
    longOfflineHours: Number(getConfigValue(state, "android.longOfflineHours") ?? 48)
  };
  const readiness = offlineReadinessScore({
    integrityFailed: snapshot.integrityFailed,
    storageFreePct: snapshot.storageFreePct,
    tokenExpired: snapshot.tokenExpired,
    configStale: snapshot.configStale,
    pendingUploads: snapshot.pendingUploads,
    unsupportedVersion: snapshot.unsupportedVersion,
    offlineHours: snapshot.offlineHours,
    revoked: snapshot.revoked,
    disabled: snapshot.disabled
  }, thresholds);
  const overlay = (state.androidDevices || []).find((item) => item.deviceId === deviceId);
  const row = overlay || { id: newId("adev", uid), deviceId };
  if (!overlay) state.androidDevices.push(row);
  row.name = snapshot.deviceName || row.name || "";
  row.model = snapshot.model || row.model || "";
  row.manufacturer = snapshot.manufacturer || row.manufacturer || "";
  row.androidVersion = snapshot.androidVersion || row.androidVersion || "";
  row.appVersion = snapshot.appVersion || row.appVersion || "";
  row.branchId = snapshot.branchId || row.branchId || "";
  row.agentId = snapshot.agentId || row.agentId || "";
  row.readiness = readiness.score;
  row.readinessLabel = readiness.label;
  row.healthScore = readiness.score;
  row.lastSeenAt = nowIso(now);
  const status = snapshot.operationalStatus || (online ? "online" : "offline");
  setDeviceOperationalStatus(row, status);
  const stored = {
    id: newId("dhs", uid),
    deviceId,
    operationalStatus: row.operationalStatus,
    readiness: readiness.score,
    integrityFailed: snapshot.integrityFailed === true,
    storageFreePct: Number(snapshot.storageFreePct ?? 100),
    pendingUploads: Number(snapshot.pendingUploads || 0),
    pendingDownloads: Number(snapshot.pendingDownloads || 0),
    conflictCount: Number(snapshot.conflictCount || 0),
    batteryPct: snapshot.batteryPct == null ? null : Number(snapshot.batteryPct),
    charging: snapshot.charging === true,
    encrypted: snapshot.encrypted !== false,
    appVersion: snapshot.appVersion || "",
    networkType: snapshot.networkType || (online ? "unknown" : "offline"),
    offlineHours: Number(snapshot.offlineHours || 0),
    tokenExpired: snapshot.tokenExpired === true,
    configStale: snapshot.configStale === true,
    unsupportedVersion: snapshot.unsupportedVersion === true,
    rooted: snapshot.rooted === true,
    createdAt: nowIso(now)
  };
  state.deviceHealthSnapshots.push(stored);
  state.deviceStorageMetrics.push({
    id: newId("dst", uid),
    deviceId,
    totalMb: Number(snapshot.storageTotalMb || 0),
    freeMb: Number(snapshot.storageFreeMb || 0),
    databaseMb: Number(snapshot.databaseMb || 0),
    queueMb: Number(snapshot.queueMb || 0),
    createdAt: nowIso(now)
  });
  state.synchronizationMetrics.push({
    id: newId("dsm", uid),
    deviceId,
    pendingUploads: stored.pendingUploads,
    pendingDownloads: stored.pendingDownloads,
    conflicts: stored.conflictCount,
    lastUploadAt: snapshot.lastUploadAt || "",
    lastDownloadAt: snapshot.lastDownloadAt || "",
    createdAt: nowIso(now)
  });
  if (snapshot.networkType || status) {
    const last = (state.deviceConnectivityHistory || []).filter((item) => item.deviceId === deviceId).slice(-1)[0];
    if (!last || last.networkType !== stored.networkType || last.operationalStatus !== stored.operationalStatus) {
      state.deviceConnectivityHistory.push({
        id: newId("dcn", uid),
        deviceId,
        networkType: stored.networkType,
        operationalStatus: stored.operationalStatus,
        createdAt: nowIso(now)
      });
    }
  }
  if (snapshot.crash) {
    state.applicationCrashReports.push({
      id: newId("acr", uid),
      deviceId,
      message: String(snapshot.crash.message || "crash"),
      createdAt: nowIso(now)
    });
  }
  if (snapshot.securityFinding) {
    state.deviceSecurityEvents.push({
      id: newId("dse", uid),
      deviceId,
      finding: snapshot.securityFinding,
      open: true,
      createdAt: nowIso(now)
    });
  }
  if (!online) {
    bufferOfflineHealthEvent(state, { deviceId, type: "snapshot", payload: stored }, uid, now);
  }
  evaluateAlerts(state, {
    integrityFailed: stored.integrityFailed ? 1 : 0,
    pendingUploads: stored.pendingUploads,
    offlineHours: stored.offlineHours,
    securityFindings: snapshot.securityFinding ? 1 : 0
  }, { uid, now, user });
  auditMonitor(state, "Device health snapshot", deviceId, user, { entityId: row.id, deviceId }, uid);
  return { ok: true, device: row, snapshot: stored, readiness };
}

export function bufferOfflineHealthEvent(state, event = {}, uid, now) {
  ensureMonitoringState(state);
  const row = {
    id: newId("ohm", uid),
    deviceId: event.deviceId || "",
    type: event.type || "event",
    payload: maskSensitive(event.payload || {}),
    status: "buffered",
    createdAt: nowIso(now)
  };
  state.offlineMonitoringQueue.push(row);
  state.offlineHealthEvents.push({ ...row, id: newId("ohe", uid) });
  return row;
}

export function flushOfflineMonitoringQueue(state, { user, uid, now, deviceId, online = true } = {}) {
  ensureMonitoringState(state);
  if (online === false) return { ok: true, flushed: 0, deferred: true };
  let flushed = 0;
  (state.offlineMonitoringQueue || []).filter((item) => item.status === "buffered").forEach((item) => {
    const key = `monitor:${item.id}`;
    const gate = beginIdempotentRequest(state, {
      idempotencyKey: key,
      operationType: "monitor.flush",
      fingerprint: { operationType: "monitor.flush", deviceId: item.deviceId, eventId: item.id },
      source: "monitoring-engine",
      userId: user?.id || "",
      now: nowMs(now)
    }, uid);
    if (gate.duplicate) {
      item.status = "flushed";
      flushed += 1;
      return;
    }
    if (!gate.proceed) {
      failIdempotentRequest(state, key, { recoverable: true, error: gate.error, now: nowMs(now) });
      return;
    }
    const queued = enqueueSyncItem(state, {
      kind: "monitoring",
      idempotencyKey: key,
      deviceId: deviceId || item.deviceId,
      payload: { deviceId: item.deviceId, eventId: item.id, type: item.type },
      online: true
    }, uid);
    if (queued.error) {
      failIdempotentRequest(state, key, { recoverable: true, error: queued.error, now: nowMs(now) });
      return;
    }
    item.status = "flushed";
    item.syncId = queued.id;
    completeIdempotentRequest(state, key, {
      transactionId: item.id,
      responsePayload: { flushed: true }
    }, { source: "monitoring-engine", now: nowMs(now) });
    flushed += 1;
  });
  return { ok: true, flushed };
}

export function requestRemoteDiagnostics(state, deviceId, { user, uid, now } = {}) {
  ensureMonitoringState(state);
  if (user && !canAction(user, "Monitor.Diagnose") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot request remote diagnostics" };
  }
  const device = (state.androidDevices || []).find((item) => item.deviceId === deviceId || item.id === deviceId);
  if (!device) return { ok: false, error: "Device not found" };
  const latest = (state.deviceHealthSnapshots || []).filter((item) => item.deviceId === device.deviceId).slice(-1)[0] || {};
  const summary = {
    deviceId: device.deviceId,
    operationalStatus: device.operationalStatus,
    healthScore: device.healthScore,
    readiness: device.readiness,
    appVersion: device.appVersion,
    storageFreePct: latest.storageFreePct,
    pendingUploads: latest.pendingUploads,
    pendingDownloads: latest.pendingDownloads,
    lastSeenAt: device.lastSeenAt,
    batteryPct: latest.batteryPct,
    encrypted: latest.encrypted
  };
  recordDiagnostic(state, { kind: "remote_device", summary: "Device health summary", detail: summary, correlationId: device.deviceId }, uid, now);
  auditMonitor(state, "Remote diagnostics requested", device.deviceId, user, { entityId: device.id, deviceId: device.deviceId }, uid);
  return { ok: true, summary };
}

export function canCollectWithDeviceHealth(state, { deviceId } = {}) {
  ensureMonitoringState(state);
  if (!deviceId) return { ok: true };
  if (deviceIsRevoked(state, deviceId)) {
    return { ok: false, error: "This device has been revoked and cannot record collections" };
  }
  const overlay = (state.androidDevices || []).find((item) => item.deviceId === deviceId || item.id === deviceId);
  const latest = (state.deviceHealthSnapshots || []).filter((item) => item.deviceId === deviceId || item.deviceId === overlay?.deviceId).slice(-1)[0];
  return canCollectWithIntegrity({
    ...latest,
    operationalStatus: overlay?.operationalStatus,
    revoked: overlay?.operationalStatus === "revoked"
  });
}

export function searchLogs(state, query = {}) {
  ensureMonitoringState(state);
  const q = String(query.q || "").trim().toLowerCase();
  return (state.logEntries || []).filter((item) => {
    if (query.level && item.level !== query.level) return false;
    if (query.service && item.service !== query.service) return false;
    if (query.correlationId && item.correlationId !== query.correlationId) return false;
    if (!q) return true;
    return [item.message, item.correlationId, item.service].join(" ").toLowerCase().includes(q);
  });
}

export function monitoringDashboard(state) {
  ensureMonitoringState(state);
  const domains = (state.monitoringServices || []).map((item) => ({ domain: item.domain, score: item.score, status: item.status }));
  const system = overallHealth(domains);
  const openAlerts = (state.monitoringAlerts || []).filter((item) => isActiveAlertStatus(item.status));
  const openIncidents = (state.incidents || []).filter((item) => !["closed", "resolved", "post_review"].includes(item.status));
  return {
    score: system.score,
    status: system.status,
    domains,
    openAlerts: openAlerts.length,
    criticalAlerts: openAlerts.filter((item) => item.severity === "critical").length,
    openIncidents: openIncidents.length,
    devices: (state.androidDevices || []).length,
    offlineDevices: (state.androidDevices || []).filter((item) => item.operationalStatus === "offline").length,
    traces: (state.traces || []).length,
    buffered: (state.offlineMonitoringQueue || []).filter((item) => item.status === "buffered").length
  };
}

export function businessMetrics(state, { date } = {}) {
  const day = date || nowIso().slice(0, 10);
  const collections = (state.collections || []).filter((item) => item.date === day && !item.reversed);
  const payments = paymentDashboard(state, { date: day });
  const sync = syncDashboard(state);
  const paymentTotal = Number(payments.completed || 0) + Number(payments.failed || 0);
  return {
    collectionsToday: collections.length,
    loanDisbursements: (state.loans || []).filter((item) => String(item.disbursedAt || item.date || "").slice(0, 10) === day).length,
    withdrawals: (state.transactions || []).filter((item) => item.type === "Withdrawal" && item.date === day).length,
    newCustomers: (state.customers || []).filter((item) => String(item.createdAt || "").slice(0, 10) === day).length,
    activeAgents: (state.users || []).filter((item) => ["Collector", "FieldSupervisor"].includes(item.role) && item.active !== false).length,
    activeGroups: (state.groups || []).filter((item) => item.active !== false).length,
    activeDevices: (state.devices || []).filter((item) => item.active !== false).length,
    paymentSuccessRate: paymentTotal ? Number(payments.completed || 0) / paymentTotal : 1,
    synchronizationSuccessRate: (Number(sync.applied || 0) + Number(sync.failed || 0)) ? Number(sync.applied || 0) / (Number(sync.applied || 0) + Number(sync.failed || 0)) : 1
  };
}

export function monitoringReports(state, reportId, range = {}) {
  ensureMonitoringState(state);
  const from = range.from || "0000-01-01";
  const to = range.to || "9999-12-31";
  const inRange = (row) => {
    const day = String(row.createdAt || "").slice(0, 10);
    return day >= from && day <= to;
  };
  const table = (columns, rows) => ({ columns, rows, reportId });
  if (reportId === "monitor_health") return table(["domain", "status", "score", "lastCheckAt"], state.monitoringServices || []);
  if (reportId === "monitor_alerts") return table(["createdAt", "name", "severity", "status"], (state.monitoringAlerts || []).filter(inRange));
  if (reportId === "monitor_incidents") return table(["createdAt", "title", "severity", "status"], (state.incidents || []).filter(inRange));
  if (reportId === "monitor_capacity") return table(["createdAt", "customers", "collections", "devices", "queueItems"], (state.capacityStatistics || []).filter(inRange));
  if (reportId === "monitor_devices") return table(["deviceId", "operationalStatus", "healthScore", "appVersion", "lastSeenAt"], state.androidDevices || []);
  if (reportId === "monitor_traces") return table(["startedAt", "path", "status", "durationMs", "correlationId"], (state.traces || []).map((item) => ({ ...item, startedAt: item.startedAt || item.createdAt })).filter((item) => String(item.startedAt || "").slice(0, 10) >= from && String(item.startedAt || "").slice(0, 10) <= to));
  if (reportId === "monitor_security") return table(["createdAt", "deviceId", "finding"], (state.deviceSecurityEvents || []).filter(inRange));
  if (reportId === "monitor_sync") return table(["createdAt", "deviceId", "pendingUploads", "conflicts"], (state.synchronizationMetrics || []).filter(inRange));
  return table(["id"], []);
}

export function exportMonitorCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function validateAlertRule(rule = {}, state = {}) {
  if (!rule.name || !rule.metric || !rule.domain) return { ok: false, error: "Rule name, metric, and domain are required" };
  if (rule.bands) {
    const bands = validateBands(rule.bands);
    if (!bands.ok) return bands;
  } else if (!rule.op || rule.threshold == null) {
    if (!DEFAULT_THRESHOLD_BANDS[rule.metric]) return { ok: false, error: "Threshold or bands are required" };
  }
  const deps = rule.dependsOn || [];
  if (deps.includes(rule.id || rule.code)) return { ok: false, error: "Circular rule dependencies are prohibited" };
  if (deps.some((id) => (state.alertRules || []).find((item) => item.id === id && (item.dependsOn || []).includes(rule.id)))) {
    return { ok: false, error: "Circular rule dependencies are prohibited" };
  }
  return { ok: true };
}

export function upsertAlertRule(state, rule = {}, user, uid, now) {
  ensureMonitoringState(state);
  if (user && !canAction(user, "Monitor.Approve") && !canAction(user, "Settings.Edit") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot configure alert rules" };
  }
  const check = validateAlertRule(rule, state);
  if (!check.ok) return check;
  const existing = (state.alertRules || []).find((item) => item.id === rule.id || (rule.code && item.code === rule.code));
  const next = {
    id: existing?.id || rule.id || newId("rule", uid),
    code: rule.code || existing?.code || rule.name,
    name: rule.name,
    description: rule.description || "",
    domain: rule.domain,
    metric: rule.metric,
    op: rule.op || existing?.op || "gte",
    threshold: rule.threshold ?? existing?.threshold,
    bands: rule.bands || existing?.bands,
    useBands: rule.useBands === true || Boolean(rule.bands),
    severity: rule.severity || existing?.severity || "warning",
    status: rule.status || existing?.status || "draft",
    active: rule.active !== false && (rule.status || existing?.status || "draft") === "active",
    version: Number(existing?.version || 0) + 1,
    dependsOn: rule.dependsOn || [],
    updatedAt: nowIso(now)
  };
  if (existing) {
    state.alertRuleVersions.push({ ...existing, archivedAt: nowIso(now) });
    Object.assign(existing, next);
  } else {
    state.alertRules.push(next);
  }
  auditMonitor(state, "Alert rule saved", next.name, user, { entityId: next.id }, uid);
  return { ok: true, rule: existing || next };
}

export function activateAlertRule(state, ruleId, { user, uid, now } = {}) {
  const rule = (state.alertRules || []).find((item) => item.id === ruleId);
  if (!rule) return { ok: false, error: "Alert rule not found" };
  const check = validateAlertRule(rule, state);
  if (!check.ok) return check;
  rule.status = "active";
  rule.active = true;
  rule.activatedAt = nowIso(now);
  auditMonitor(state, "Alert rule activated", rule.name, user, { entityId: rule.id }, uid);
  return { ok: true, rule };
}

export function collectScheduledMetrics(state, { uid, now, user, category = "high", lastCollected = {}, eventDriven = false, idle = false } = {}) {
  ensureMonitoringState(state);
  const mode = configOf(state).samplingMode || "healthy";
  const interval = adaptiveIntervalMs(COLLECTION_INTERVALS_MS[category] || COLLECTION_INTERVALS_MS.high, { mode, idle });
  if (!dueForCollection(lastCollected[category], interval, now, { eventDriven })) {
    return { ok: true, skipped: true, interval };
  }
  const shot = collectHealthSnapshot(state, { uid, now, user });
  return { ok: true, interval, mode, snapshot: shot };
}

export function recordMissedCollection(state, reason, uid, now) {
  ensureMonitoringState(state);
  const row = { id: newId("miss", uid), reason, createdAt: nowIso(now) };
  state.missedCollections.push(row);
  return row;
}

export function setSamplingMode(state, mode, user, uid, now) {
  ensureMonitoringState(state);
  const config = configOf(state);
  const previous = config.samplingMode;
  config.samplingMode = mode;
  auditMonitor(state, "Adaptive sampling changed", `${previous} → ${mode}`, user, { entityId: config.id }, uid);
  return { ok: true, mode };
}

export function assertMonitoringBoundary() {
  return {
    centralized: true,
    restApi: false,
    graphql: false,
    postsCollections: false,
    collectsPrivateContent: false,
    wrapsExistingHealth: true
  };
}

registerJobHandler("health_snapshot", (state, _job, ctx) => collectHealthSnapshot(state, ctx));
