/**
 * Module 19 monitoring state machines, health scoring, alerts, incidents, and Android offline rules.
 * Observability records only. This module does not post money or collect private device content.
 */

export const MONITOR_SCHEMA_LIFECYCLE = "1.0.0";

export const HEALTH_STATUSES = ["healthy", "degraded", "unhealthy", "unknown"];

export const HEALTH_DOMAINS = [
  "system",
  "service",
  "database",
  "queue",
  "worker",
  "api",
  "payment_provider",
  "notification_provider",
  "synchronization",
  "storage",
  "backup",
  "security",
  "android_device"
];

export const ALERT_SEVERITIES = ["information", "warning", "minor", "major", "critical"];

export const INCIDENT_STATES = [
  "detected",
  "classified",
  "investigating",
  "identified",
  "resolving",
  "resolved",
  "post_review",
  "closed"
];

export const INCIDENT_TRANSITION_MATRIX = {
  detected: ["classified", "closed"],
  classified: ["investigating", "closed"],
  investigating: ["identified", "classified"],
  identified: ["resolving", "investigating"],
  resolving: ["resolved", "identified"],
  resolved: ["post_review", "closed"],
  post_review: ["closed"],
  closed: []
};

export const DEVICE_OPERATIONAL_STATUSES = [
  "online",
  "offline",
  "synchronizing",
  "synchronization_failed",
  "synchronization_paused",
  "disabled",
  "revoked"
];

export const TRACE_STATES = ["started", "running", "completed", "failed"];

export const FORBIDDEN_TELEMETRY_KEYS = [
  "photo",
  "photos",
  "contacts",
  "sms",
  "smsContent",
  "callHistory",
  "calls",
  "microphone",
  "camera",
  "recording",
  "personalFiles",
  "gps",
  "continuousLocation",
  "locationStream"
];

export const SENSITIVE_LOG_KEYS = [
  "pin",
  "password",
  "momoPin",
  "otp",
  "secret",
  "token",
  "webhookSecret",
  "accountNumber",
  "cardNumber",
  "ghanaCard",
  "nrc"
];

export const DEFAULT_ESCALATION = {
  information: { ackMinutes: 0, firstMinutes: 0, secondMinutes: 0, createIncident: false, channels: ["dashboard"] },
  warning: { ackMinutes: 240, firstMinutes: 240, secondMinutes: 480, createIncident: false, channels: ["dashboard", "email"] },
  minor: { ackMinutes: 120, firstMinutes: 120, secondMinutes: 240, createIncident: false, channels: ["dashboard", "email", "push"] },
  major: { ackMinutes: 30, firstMinutes: 30, secondMinutes: 60, createIncident: true, channels: ["dashboard", "email", "sms"] },
  critical: { ackMinutes: 15, firstMinutes: 15, secondMinutes: 30, createIncident: true, channels: ["dashboard", "email", "sms", "push", "whatsapp"] }
};

export const ALERT_STATES = [
  "detected",
  "created",
  "open",
  "assigned",
  "acknowledged",
  "investigating",
  "escalated",
  "resolved",
  "reopened",
  "closed"
];

export const ACTIVE_ALERT_STATES = ["detected", "created", "open", "assigned", "acknowledged", "investigating", "escalated", "reopened"];

export const ALERT_TRANSITION_MATRIX = {
  detected: ["created", "open", "closed"],
  created: ["assigned", "acknowledged", "open", "closed"],
  open: ["assigned", "acknowledged", "investigating", "escalated", "resolved", "closed"],
  assigned: ["acknowledged", "escalated", "investigating", "closed"],
  acknowledged: ["investigating", "resolved", "closed"],
  investigating: ["resolved", "escalated", "closed"],
  escalated: ["acknowledged", "investigating", "resolved", "closed"],
  resolved: ["closed", "reopened"],
  reopened: ["assigned", "investigating", "acknowledged"],
  closed: []
};

export const PLAIN_LANGUAGE_THRESHOLD_RULE =
  "Each severity level starts at its lower boundary (including that value) and continues up to—but does not include—its upper boundary, while the highest severity starts at its lower boundary and includes every value above it.";

export const SEVERITY_SEMANTICS = {
  information: { impact: "none", meaning: "Normal operational information requiring no corrective action." },
  warning: { impact: "low", meaning: "May become a problem if left unresolved; financial integrity is not affected." },
  minor: { impact: "limited", meaning: "Localized performance or reliability issue; core financial operations continue." },
  major: { impact: "high", meaning: "Significant degradation of important operations without a complete outage." },
  critical: { impact: "severe", meaning: "Threatens financial integrity, security, compliance, or core availability." }
};

export const COLLECTION_INTERVALS_MS = {
  critical: 30 * 1000,
  high: 60 * 1000,
  standard: 5 * 60 * 1000,
  business: 15 * 60 * 1000,
  capacity: 60 * 60 * 1000,
  historical: 24 * 60 * 60 * 1000,
  batchTransmit: 5 * 60 * 1000
};

export const ANDROID_COLLECTION_INTERVALS_MS = {
  connectivityActive: 30 * 1000,
  connectivityBackground: 5 * 60 * 1000,
  offlineReadiness: 5 * 60 * 1000,
  syncQueue: 2 * 60 * 1000,
  storage: 15 * 60 * 1000,
  databaseIntegrity: 24 * 60 * 60 * 1000,
  batteryActive: 10 * 60 * 1000,
  security: 30 * 60 * 1000
};

export const EVENT_DRIVEN_METRICS = [
  "paymentFailure",
  "synchronizationFailure",
  "queueOverflow",
  "securityIncident",
  "applicationCrash",
  "databaseCorruption",
  "authenticationFailure",
  "providerFailure",
  "deviceRevocation",
  "criticalConfigurationChange"
];

export const METRIC_RETENTION_DAYS = {
  highFrequencyRaw: 30,
  hourlyAggregates: 365,
  dailySummaries: 2555
};

export const DEFAULT_THRESHOLD_BANDS = {
  cpuPct: bands([0, 75, 85, 90, 95], { recoveryMax: 70, recoverySamples: 2, window: "5m", aggregation: "average" }),
  memoryPct: bands([0, 75, 85, 90, 95], { recoveryMax: 70, recoverySamples: 2, window: "5m", aggregation: "average" }),
  diskPct: bands([0, 70, 80, 90, 95], { recoveryMax: 75, recoverySamples: 1, window: "15m" }),
  dbPoolPct: bands([0, 70, 80, 90, 95], { recoveryMax: 70, recoverySamples: 1 }),
  apiErrorPct: bands([0, 1, 3, 5, 10], { recoveryMax: 1, recoverySamples: 3, window: "5m", maxInclusiveCritical: true }),
  apiP95Ms: [
    interval("normal", 0, 500),
    interval("warning", 500, 1000),
    interval("minor", 1000, 2000),
    interval("major", 2000, 5000),
    interval("critical", 5000, Infinity)
  ],
  paymentSuccessPct: invertedSuccessBands([99, 98, 95, 90], { recoveryMin: 99, recoverySamples: 2, window: "15m" }),
  syncSuccessPct: invertedSuccessBands([99, 97, 94, 90], { recoveryMin: 99, recoverySamples: 2, window: "30m" }),
  queueDepth: bands([0, 500, 1000, 2000, 5000], { recoveryMax: 500, recoverySamples: 1 }),
  dlqGrowthHour: bands([0, 1, 25, 50, 100], { recoveryMax: 1, recoverySamples: 1, window: "1h" }),
  androidOfflineHours: bands([0, 2, 8, 24, 72], { recoveryMax: 0, recoverySamples: 1 }),
  syncBacklog: bands([0, 100, 250, 500, 1000], { recoveryMax: 100, recoverySamples: 1 }),
  storageRemainingPct: invertedRemainingBands([30, 20, 10, 5], { recoveryMin: 30 }),
  providerHealthScore: invertedSuccessBands([90, 70, 50, 25], { recoveryMin: 90, recoverySamples: 3 }),
  securityEvents15m: bands([0, 1, 5, 10, 20], { recoveryMax: 1, recoverySamples: 1, window: "15m" })
};

function interval(severity, min, max, extras = {}) {
  return {
    severity,
    min,
    max,
    minInclusive: extras.minInclusive !== false,
    maxInclusive: extras.maxInclusive === true,
    notation: formatInterval(min, max, extras.minInclusive !== false, extras.maxInclusive === true)
  };
}

function bands(edges, extras = {}) {
  const [n0, w, mi, ma, cr] = edges;
  const critical = interval("critical", cr, Infinity, { maxInclusive: extras.maxInclusiveCritical === true });
  if (extras.maxInclusiveCritical) {
    critical.max = 100;
    critical.maxInclusive = true;
    critical.notation = formatInterval(cr, 100, true, true);
  }
  const list = [
    interval("normal", n0, w),
    interval("warning", w, mi),
    interval("minor", mi, ma),
    interval("major", ma, cr),
    critical
  ];
  list.recovery = extras;
  return list;
}

function invertedSuccessBands(edges, extras = {}) {
  const [normalMin, warnMin, minorMin, majorMin] = edges;
  const list = [
    interval("critical", 0, majorMin),
    interval("major", majorMin, minorMin),
    interval("minor", minorMin, warnMin),
    interval("warning", warnMin, normalMin),
    interval("normal", normalMin, 100.000001, { maxInclusive: true })
  ];
  list.recovery = extras;
  return list;
}

function invertedRemainingBands(edges, extras = {}) {
  const [normalMin, warnMin, minorMin, majorMin] = edges;
  const list = [
    interval("critical", 0, majorMin),
    interval("major", majorMin, minorMin),
    interval("minor", minorMin, warnMin),
    interval("warning", warnMin, normalMin),
    interval("normal", normalMin, Infinity)
  ];
  list.recovery = extras;
  return list;
}

export function metricNumber(value, precision = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number.NaN;
  const factor = 10 ** precision;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function formatInterval(min, max, minInclusive = true, maxInclusive = false) {
  const left = minInclusive ? "[" : "(";
  const right = maxInclusive ? "]" : ")";
  const hi = max === Infinity || max == null ? "+∞" : max;
  return `${left}${min},${hi}${right}`;
}

export function inInterval(value, band = {}) {
  const v = metricNumber(value);
  if (!Number.isFinite(v)) return false;
  const lo = band.min == null ? Number.NEGATIVE_INFINITY : Number(band.min);
  const hi = band.max == null || band.max === Infinity ? Number.POSITIVE_INFINITY : Number(band.max);
  const left = band.minInclusive === false ? v > lo : v >= lo;
  const right = band.maxInclusive === true ? v <= hi : v < hi;
  return left && right;
}

export function severityFromBands(bandList = [], value) {
  const match = (bandList || []).find((band) => inInterval(value, band));
  return match?.severity || null;
}

export function validateBands(bandList = []) {
  if (!bandList.length) return { ok: false, error: "Threshold bands are required" };
  const sorted = [...bandList].sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    const hi = band.max == null || band.max === Infinity ? Number.POSITIVE_INFINITY : Number(band.max);
    const lo = Number(band.min);
    if (!(lo < hi) && !(lo === hi && band.minInclusive !== false && band.maxInclusive === true)) {
      return { ok: false, error: "Inverted or empty interval" };
    }
    if (i === 0) continue;
    const prev = sorted[i - 1];
    const prevHi = prev.max == null || prev.max === Infinity ? Number.POSITIVE_INFINITY : Number(prev.max);
    if (lo < prevHi) return { ok: false, error: "Overlapping intervals" };
    if (lo > prevHi) return { ok: false, error: "Gap between intervals" };
    if (lo === prevHi && prev.maxInclusive === true && band.minInclusive !== false) {
      return { ok: false, error: "Overlapping intervals" };
    }
    if (lo === prevHi && prev.maxInclusive !== true && band.minInclusive === false) {
      return { ok: false, error: "Gap between intervals" };
    }
  }
  return { ok: true };
}

export function inRecoveryInterval(value, recovery = {}) {
  if (recovery.recoveryMax != null) return metricNumber(value) < Number(recovery.recoveryMax);
  if (recovery.recoveryMin != null) return metricNumber(value) >= Number(recovery.recoveryMin);
  if (recovery.min != null || recovery.max != null) return inInterval(value, recovery);
  return false;
}

export function canTransitionAlert(from, to) {
  return (ALERT_TRANSITION_MATRIX[from] || []).includes(to);
}

export function isActiveAlertStatus(status) {
  return ACTIVE_ALERT_STATES.includes(status);
}

export function dueForCollection(lastAt, intervalMs, now, { eventDriven = false } = {}) {
  if (eventDriven) return true;
  if (!lastAt) return true;
  return nowMsValue(now) - nowMsValue(lastAt) >= Number(intervalMs || 0);
}

export function adaptiveIntervalMs(baseMs, { mode = "healthy", idle = false } = {}) {
  const base = Number(baseMs || COLLECTION_INTERVALS_MS.standard);
  if (mode === "incident") return Math.max(5000, Math.round(base / 2));
  if (mode === "high_load") return Math.round(base * 2);
  if (idle || mode === "idle") return Math.round(base * 3);
  return base;
}

export function notificationChannelsFor(severity) {
  return (DEFAULT_ESCALATION[severity] || DEFAULT_ESCALATION.warning).channels || ["dashboard"];
}

function nowMsValue(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  const parsed = Date.parse(now || 0);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function canTransitionIncident(from, to) {
  return (INCIDENT_TRANSITION_MATRIX[from] || []).includes(to);
}

export function statusFromScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value >= 80) return "healthy";
  if (value >= 50) return "degraded";
  return "unhealthy";
}

export function componentHealth({
  availability = 1,
  errorPct = 0,
  consecutiveFailures = 0,
  recoveryRate = 1,
  meanResponseMs = 0,
  latencyBudgetMs = 2000
} = {}) {
  let score = 100;
  score -= Math.min(40, (1 - Number(availability || 0)) * 100);
  score -= Math.min(25, Number(errorPct || 0) * 100);
  score -= Math.min(20, Number(consecutiveFailures || 0) * 5);
  score -= Math.min(10, (1 - Number(recoveryRate || 1)) * 20);
  if (meanResponseMs > latencyBudgetMs) {
    score -= Math.min(15, ((meanResponseMs - latencyBudgetMs) / latencyBudgetMs) * 15);
  }
  const value = Math.max(0, Math.round(score));
  return {
    score: value,
    status: statusFromScore(value),
    availability: Number(availability || 0),
    errorPct: Number(errorPct || 0),
    meanResponseMs: Number(meanResponseMs || 0),
    recoveryRate: Number(recoveryRate || 1),
    consecutiveFailures: Number(consecutiveFailures || 0)
  };
}

export function overallHealth(domains = []) {
  if (!domains.length) return { score: 100, status: "healthy" };
  const critical = domains.filter((item) => ["system", "database", "payment_provider", "synchronization", "security"].includes(item.domain));
  const pool = critical.length ? critical : domains;
  const score = Math.round(pool.reduce((sum, item) => sum + Number(item.score || 0), 0) / pool.length);
  return { score, status: statusFromScore(score) };
}

export function offlineReadinessScore(facts = {}, thresholds = {}) {
  if (facts.revoked || facts.disabled) {
    return { score: 0, label: "Requires Attention", status: "unhealthy" };
  }
  let score = 100;
  if (facts.integrityFailed) score -= 40;
  const storagePct = Number(facts.storageFreePct ?? 100);
  const storageWarn = Number(thresholds.storageWarnPct ?? 15);
  if (storagePct < 5) score -= 30;
  else if (storagePct < storageWarn) score -= 15;
  if (facts.tokenExpired) score -= 15;
  if (facts.configStale) score -= 10;
  if (Number(facts.pendingUploads || 0) > Number(thresholds.syncBacklogAlert ?? 50)) score -= 15;
  if (facts.unsupportedVersion) score -= 20;
  if (Number(facts.offlineHours || 0) > Number(thresholds.longOfflineHours ?? 48)) score -= 10;
  const value = Math.max(0, Math.round(score));
  const label = value >= 90 ? "Fully Ready" : value >= 70 ? "Ready" : value >= 50 ? "Limited Capability" : "Requires Attention";
  return { score: value, label, status: statusFromScore(value) };
}

export function canCollectWithIntegrity(snapshot = {}) {
  if (snapshot.integrityFailed === true) {
    return { ok: false, error: "Device database integrity failed. New collections are blocked until repair." };
  }
  if (snapshot.operationalStatus === "revoked" || snapshot.revoked === true) {
    return { ok: false, error: "This device has been revoked and cannot record collections" };
  }
  return { ok: true };
}

export function forbiddenTelemetry(payload = {}) {
  return Object.keys(payload || {}).filter((key) => FORBIDDEN_TELEMETRY_KEYS.includes(key));
}

export function maskSensitive(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => maskSensitive(item, seen));
  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    if (SENSITIVE_LOG_KEYS.includes(key) || /pin|password|secret|token/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = maskSensitive(item, seen);
    }
  });
  return out;
}

export function linearForecast(points = [], horizon = 7) {
  const rows = (points || []).map((item, index) => ({ x: index, y: Number(item.value ?? item) })).filter((item) => Number.isFinite(item.y));
  if (!rows.length) return { next: 0, slope: 0, horizon };
  if (rows.length === 1) return { next: rows[0].y, slope: 0, horizon };
  const n = rows.length;
  const sumX = rows.reduce((sum, item) => sum + item.x, 0);
  const sumY = rows.reduce((sum, item) => sum + item.y, 0);
  const sumXY = rows.reduce((sum, item) => sum + item.x * item.y, 0);
  const sumXX = rows.reduce((sum, item) => sum + item.x * item.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  const next = intercept + slope * (n - 1 + Number(horizon || 1));
  return { next: Math.max(0, Math.round(next * 100) / 100), slope, horizon };
}
