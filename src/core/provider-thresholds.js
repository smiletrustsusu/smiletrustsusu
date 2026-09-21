/**
 * Deterministic threshold semantics for provider health.
 * Historical evaluations keep the threshold version used at calculation time.
 */
export const THRESHOLD_CONFIG_VERSION = "1.0.0";

export const SEVERITY_ORDER = ["Unhealthy", "Critical", "Poor", "Degraded", "Stable", "Healthy"];

export const DEFAULT_HEALTH_BANDS = [
  { state: "Unhealthy", min: 0, max: 20, maxInclusive: false },
  { state: "Critical", min: 20, max: 40, maxInclusive: false },
  { state: "Poor", min: 40, max: 60, maxInclusive: false },
  { state: "Degraded", min: 60, max: 75, maxInclusive: false },
  { state: "Stable", min: 75, max: 90, maxInclusive: false },
  { state: "Healthy", min: 90, max: 100, maxInclusive: true }
];

export const DEFAULT_THRESHOLD_CONFIG = {
  version: THRESHOLD_CONFIG_VERSION,
  hysteresis: 5,
  consecutiveSevere: 3,
  consecutiveRecovery: 3,
  evaluationIntervalMs: 5 * 60 * 1000,
  bands: DEFAULT_HEALTH_BANDS,
  metrics: {
    responseMs: { warning: 1000, critical: 3000, recovery: 800, higherIsBetter: false },
    successRate: { warning: 95, critical: 80, recovery: 97, higherIsBetter: true },
    timeoutRate: { warning: 5, critical: 15, recovery: 2, higherIsBetter: false },
    queueUtilization: { warning: 70, critical: 90, recovery: 50, higherIsBetter: false },
    consecutiveFailures: { warning: 3, critical: 10, recovery: 0, higherIsBetter: false },
    availability: { warning: 99, critical: 95, recovery: 99.5, higherIsBetter: true }
  },
  alerts: {
    alertBelow: 70,
    failoverBelow: 60,
    disableBelow: 20
  },
  effectiveFrom: "1970-01-01T00:00:00.000Z",
  effectiveTo: ""
};

export function inRange(value, min, max, { minInclusive = true, maxInclusive = false } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return false;
  const n = Number(value);
  const lower = minInclusive ? n >= min : n > min;
  const upper = maxInclusive ? n <= max : n < max;
  return lower && upper;
}

export function healthStateFromScore(score, bands = DEFAULT_HEALTH_BANDS) {
  if (score == null || !Number.isFinite(Number(score))) return "Not Evaluated";
  const n = Number(score);
  const match = bands.find((band) => inRange(n, band.min, band.max, { minInclusive: true, maxInclusive: Boolean(band.maxInclusive) }));
  return match?.state || "Not Evaluated";
}

export function severityRank(state) {
  const idx = SEVERITY_ORDER.indexOf(state);
  return idx < 0 ? Number.POSITIVE_INFINITY : idx;
}

export function mostSevere(states = []) {
  return states
    .filter((state) => SEVERITY_ORDER.includes(state))
    .sort((a, b) => severityRank(a) - severityRank(b))[0] || null;
}

export function nextRecoverableHealthState(current) {
  const idx = SEVERITY_ORDER.indexOf(current);
  if (idx < 0 || idx === SEVERITY_ORDER.length - 1) return current;
  return SEVERITY_ORDER[idx + 1];
}

export function isConfigActive(config, at = new Date().toISOString()) {
  if (!config) return false;
  const when = Date.parse(at);
  const from = Date.parse(config.effectiveFrom || "1970-01-01T00:00:00.000Z");
  const to = config.effectiveTo ? Date.parse(config.effectiveTo) : Number.POSITIVE_INFINITY;
  return Number.isFinite(when) && when >= from && when <= to;
}

export function resolveThresholdConfig({ provider, channel, global, at } = {}) {
  const layers = [
    provider ? { ...provider, inheritedFrom: "provider" } : null,
    channel ? { ...channel, inheritedFrom: "channel" } : null,
    global ? { ...global, inheritedFrom: "global" } : null,
    { ...DEFAULT_THRESHOLD_CONFIG, inheritedFrom: "defaults" }
  ].filter(Boolean);
  const active = layers.find((layer) => isConfigActive(layer, at || new Date().toISOString())) || DEFAULT_THRESHOLD_CONFIG;
  return {
    ...DEFAULT_THRESHOLD_CONFIG,
    ...active,
    bands: active.bands || DEFAULT_HEALTH_BANDS,
    metrics: { ...DEFAULT_THRESHOLD_CONFIG.metrics, ...(active.metrics || {}) },
    alerts: { ...DEFAULT_THRESHOLD_CONFIG.alerts, ...(active.alerts || {}) },
    inheritedFrom: active.inheritedFrom || "defaults",
    version: active.version || THRESHOLD_CONFIG_VERSION
  };
}

function overlapBands(bands) {
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEndTouches = current.maxInclusive ? current.max >= next.min : current.max > next.min;
    if (currentEndTouches) return true;
  }
  return false;
}

export function validateThresholdConfig(config = {}) {
  const errors = [];
  const merged = { ...DEFAULT_THRESHOLD_CONFIG, ...config, metrics: { ...DEFAULT_THRESHOLD_CONFIG.metrics, ...(config.metrics || {}) } };
  if (Number(merged.hysteresis) < 0) errors.push("Hysteresis cannot be less than zero");
  if (Number(merged.consecutiveSevere) < 1) errors.push("Consecutive severe evaluations must be at least 1");
  if (Number(merged.consecutiveRecovery) < 1) errors.push("Consecutive recovery evaluations must be at least 1");
  const bands = merged.bands || DEFAULT_HEALTH_BANDS;
  if (overlapBands(bands)) errors.push("Health score ranges overlap");
  bands.forEach((band) => {
    if (band.max < band.min) errors.push(`${band.state} maximum is less than minimum`);
    if (band.min < 0) errors.push(`${band.state} cannot use a negative bound`);
  });
  Object.entries(merged.metrics).forEach(([name, spec]) => {
    if (!spec) return;
    if (Number(spec.warning) < 0 || Number(spec.critical) < 0) errors.push(`${name} cannot be negative`);
    if (spec.higherIsBetter) {
      if (Number(spec.critical) > Number(spec.warning)) errors.push(`${name} critical must be below or equal to warning`);
      if (Number(spec.recovery) < Number(spec.warning) && !spec.allowInvertedRecovery) {
        errors.push(`${name} recovery threshold is lower than the warning threshold`);
      }
    } else {
      if (Number(spec.critical) < Number(spec.warning)) errors.push(`${name} critical must be above or equal to warning`);
      if (Number(spec.recovery) > Number(spec.warning) && !spec.allowInvertedRecovery) {
        errors.push(`${name} recovery threshold is higher than the warning threshold`);
      }
    }
  });
  const alerts = merged.alerts || {};
  if (Number(alerts.disableBelow) > Number(alerts.failoverBelow)) errors.push("Automatic disable threshold must be below failover");
  if (Number(alerts.failoverBelow) > Number(alerts.alertBelow)) errors.push("Failover threshold must be below the alert threshold");
  return errors.length ? { error: errors[0], errors } : { ok: true, config: merged };
}

export function metricLevel(value, spec = {}) {
  if (value == null || !Number.isFinite(Number(value))) return "Not Available";
  const v = Number(value);
  if (spec.higherIsBetter) {
    if (v <= Number(spec.critical)) return "Critical";
    if (v <= Number(spec.warning)) return "Warning";
    return "Ok";
  }
  if (v >= Number(spec.critical)) return "Critical";
  if (v >= Number(spec.warning)) return "Warning";
  return "Ok";
}

export function metricLevelToState(level) {
  if (level === "Critical") return "Critical";
  if (level === "Warning") return "Degraded";
  return null;
}

export function evaluateMetricThresholds(values = {}, config = DEFAULT_THRESHOLD_CONFIG) {
  const specs = config.metrics || DEFAULT_THRESHOLD_CONFIG.metrics;
  const triggered = [];
  Object.entries(specs).forEach(([name, spec]) => {
    const level = metricLevel(values[name], spec);
    if (level === "Not Available") triggered.push({ metric: name, level, state: null, available: false });
    else triggered.push({ metric: name, level, state: metricLevelToState(level), available: true, value: values[name] });
  });
  const states = triggered.map((item) => item.state).filter(Boolean);
  return { triggered, overall: mostSevere(states), missing: triggered.filter((item) => !item.available).map((item) => item.metric) };
}

export function applyHysteresis(previousState, candidateState, score, hysteresis = DEFAULT_THRESHOLD_CONFIG.hysteresis, bands = DEFAULT_HEALTH_BANDS) {
  if (!previousState || previousState === "Not Evaluated") return candidateState;
  if (previousState === candidateState) return candidateState;
  const worse = severityRank(candidateState) < severityRank(previousState);
  if (worse) return candidateState;
  const previousBand = bands.find((band) => band.state === previousState);
  const recoveryFloor = previousBand ? previousBand.min + Number(hysteresis || 0) : Number(score);
  if (!Number.isFinite(Number(score)) || Number(score) < recoveryFloor) return previousState;
  return nextRecoverableHealthState(previousState);
}

export function applyConsecutiveEvaluations({
  previousState,
  candidateState,
  declineStreak = 0,
  recoveryStreak = 0,
  pendingState = "",
  consecutiveSevere = 3,
  consecutiveRecovery = 3
} = {}) {
  const severe = ["Poor", "Critical", "Unhealthy"];
  const improving = previousState && SEVERITY_ORDER.includes(previousState) && severityRank(candidateState) > severityRank(previousState);
  const decliningSevere = severe.includes(candidateState) && candidateState !== previousState;
  if (decliningSevere) {
    const streak = pendingState === candidateState ? declineStreak + 1 : 1;
    if (streak < Number(consecutiveSevere || 3) && previousState && previousState !== "Not Evaluated") {
      return { state: previousState, declineStreak: streak, recoveryStreak: 0, pendingState: candidateState, held: true };
    }
    return { state: candidateState, declineStreak: 0, recoveryStreak: 0, pendingState: "", held: false };
  }
  if (improving) {
    const streak = pendingState === candidateState ? recoveryStreak + 1 : 1;
    if (streak < Number(consecutiveRecovery || 3) && previousState !== "Not Evaluated") {
      return { state: previousState, declineStreak: 0, recoveryStreak: streak, pendingState: candidateState, held: true };
    }
    return { state: candidateState, declineStreak: 0, recoveryStreak: 0, pendingState: "", held: false };
  }
  return { state: candidateState, declineStreak: 0, recoveryStreak: 0, pendingState: "", held: false };
}

export function alertActions(score, alerts = DEFAULT_THRESHOLD_CONFIG.alerts) {
  const n = Number(score);
  return {
    alert: Number.isFinite(n) && n < Number(alerts.alertBelow),
    failover: Number.isFinite(n) && n < Number(alerts.failoverBelow),
    disable: Number.isFinite(n) && n < Number(alerts.disableBelow)
  };
}

export function evaluateThresholds({
  score,
  previousState = "Not Evaluated",
  declineStreak = 0,
  recoveryStreak = 0,
  pendingState = "",
  metricValues = {},
  config = DEFAULT_THRESHOLD_CONFIG,
  at = new Date().toISOString()
} = {}) {
  const resolved = { ...DEFAULT_THRESHOLD_CONFIG, ...config, metrics: { ...DEFAULT_THRESHOLD_CONFIG.metrics, ...(config.metrics || {}) }, bands: config.bands || DEFAULT_HEALTH_BANDS };
  const scoreState = healthStateFromScore(score, resolved.bands);
  const metrics = evaluateMetricThresholds(metricValues, resolved);
  const combined = mostSevere([scoreState, metrics.overall].filter(Boolean)) || scoreState;
  const afterHysteresis = applyHysteresis(previousState, combined, score, resolved.hysteresis, resolved.bands);
  const consecutive = applyConsecutiveEvaluations({
    previousState,
    candidateState: afterHysteresis,
    declineStreak,
    recoveryStreak,
    pendingState,
    consecutiveSevere: resolved.consecutiveSevere,
    consecutiveRecovery: resolved.consecutiveRecovery
  });
  const audit = {
    configurationVersion: resolved.version || THRESHOLD_CONFIG_VERSION,
    thresholdSetUsed: resolved.inheritedFrom || "defaults",
    metricValues,
    triggeredThresholds: metrics.triggered,
    evaluationResult: consecutive.state,
    previousState,
    newState: consecutive.state,
    timestamp: at,
    score,
    held: consecutive.held
  };
  return {
    scoreState,
    combinedState: combined,
    healthState: consecutive.state,
    declineStreak: consecutive.declineStreak,
    recoveryStreak: consecutive.recoveryStreak,
    pendingState: consecutive.pendingState,
    metrics,
    alerts: alertActions(score, resolved.alerts),
    missing: metrics.missing,
    thresholdVersion: resolved.version || THRESHOLD_CONFIG_VERSION,
    audit
  };
}

export function routingThresholdOrder() {
  return ["enabled", "maintenance", "healthState", "confidence", "strategy", "priority"];
}
