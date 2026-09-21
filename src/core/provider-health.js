/**
 * Deterministic provider health scoring (0.00–100.00).
 * Historical stored scores are never recalculated.
 */
import { healthStateFromScore as bandHealthState, nextRecoverableHealthState, THRESHOLD_CONFIG_VERSION } from "./provider-thresholds.js";

export const HEALTH_FORMULA_VERSION = "1.0.0";
export const DEFAULT_WEIGHTS = {
  success: 0.35,
  response: 0.20,
  failure: 0.15,
  timeout: 0.10,
  availability: 0.10,
  queue: 0.05,
  rateLimit: 0.05
};
export const DEFAULT_BASELINE = 75;
export const DEFAULT_MIN_ATTEMPTS = 100;
export const DEFAULT_MIN_HEALTH_CHECKS = 10;
export const DEFAULT_EMA_ALPHA = 0.3;
export const DEFAULT_RECOVERY_CHECKS = 10;
export const DEFAULT_ROUTING_WINDOW_MS = 60 * 60 * 1000;

export function eventsInWindow(events = [], now = Date.now(), windowMs = DEFAULT_ROUTING_WINDOW_MS) {
  const end = Number(now);
  const start = end - Number(windowMs || 0);
  return events.filter((item) => {
    const at = Date.parse(item.endedAt || item.startedAt || item.at || 0);
    return Number.isFinite(at) && at >= start && at <= end;
  });
}

export function roundScore(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

export function lerp(x, x0, y0, x1, y1) {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

export function successScore(successful, attempts) {
  if (!attempts) return null;
  return clamp((successful / attempts) * 100);
}

export function responseScore(avgMs) {
  if (avgMs == null || !Number.isFinite(Number(avgMs))) return null;
  const ms = Number(avgMs);
  if (ms <= 500) return 100;
  if (ms <= 1000) return lerp(ms, 500, 100, 1000, 90);
  if (ms <= 2000) return lerp(ms, 1000, 90, 2000, 75);
  if (ms <= 5000) return lerp(ms, 2000, 75, 5000, 50);
  return 20;
}

export function failureScore(consecutiveFailures) {
  return clamp(100 - Number(consecutiveFailures || 0) * 10);
}

export function timeoutScore(timeouts, attempts) {
  if (!attempts) return null;
  return clamp(100 - (timeouts / attempts) * 100);
}

export function availabilityScore(successfulChecks, totalChecks) {
  if (!totalChecks) return null;
  return clamp((successfulChecks / totalChecks) * 100);
}

export function queueScore(queueSize, capacity) {
  if (!capacity) return null;
  return clamp(100 - (queueSize / capacity) * 100);
}

export function rateLimitScore(rateLimitEvents, attempts) {
  if (!attempts) return null;
  return clamp(100 - (rateLimitEvents / attempts) * 100);
}

export function weightedScore(components, weights = DEFAULT_WEIGHTS) {
  const pairs = [
    ["success", components.success],
    ["response", components.response],
    ["failure", components.failure],
    ["timeout", components.timeout],
    ["availability", components.availability],
    ["queue", components.queue],
    ["rateLimit", components.rateLimit]
  ].filter(([, score]) => score != null && Number.isFinite(Number(score)));
  const totalWeight = pairs.reduce((sum, [key]) => sum + Number(weights[key] || 0), 0);
  if (!totalWeight) return null;
  const raw = pairs.reduce((sum, [key, score]) => sum + Number(score) * Number(weights[key] || 0), 0);
  return roundScore(raw / totalWeight);
}

export function overallHealthScore(components, weights = DEFAULT_WEIGHTS) {
  const required = ["success", "response", "failure", "timeout", "availability", "queue", "rateLimit"];
  if (required.some((key) => components[key] == null)) return weightedScore(components, weights);
  return roundScore(
    components.success * weights.success
    + components.response * weights.response
    + components.failure * weights.failure
    + components.timeout * weights.timeout
    + components.availability * weights.availability
    + components.queue * weights.queue
    + components.rateLimit * weights.rateLimit
  );
}

export function smoothScore(current, previous, alpha = DEFAULT_EMA_ALPHA) {
  if (previous == null) return roundScore(current);
  return roundScore(alpha * current + (1 - alpha) * previous);
}

export function healthStateFromScore(score) {
  return bandHealthState(score);
}

export function confidencePercent(attempts, minimum = DEFAULT_MIN_ATTEMPTS) {
  if (!minimum) return 100;
  return roundScore(Math.min(Number(attempts || 0) / minimum, 1) * 100);
}

export function confidenceBand(percent) {
  if (percent >= 100) return "Full";
  if (percent >= 75) return "High";
  if (percent >= 50) return "Moderate";
  if (percent >= 25) return "Low";
  return "Very Low";
}

export function evaluationState({ attempts = 0, healthChecks = 0, inactiveDays = 0, minAttempts = DEFAULT_MIN_ATTEMPTS, minChecks = DEFAULT_MIN_HEALTH_CHECKS, inactivityDays = 30 } = {}) {
  if (inactiveDays >= inactivityDays && attempts === 0) return "Suspended Evaluation";
  if (attempts === 0 && healthChecks === 0) return "Initializing";
  if (attempts < minAttempts || healthChecks < minChecks) return "Insufficient Data";
  return "Fully Evaluated";
}

export function provisionalAdjustedScore(normalized, attempts, { minAttempts = DEFAULT_MIN_ATTEMPTS, baseline = DEFAULT_BASELINE } = {}) {
  const confidence = Math.min(Number(attempts || 0) / minAttempts, 1);
  return roundScore(normalized * confidence + baseline * (1 - confidence));
}

export function eligibleAttempt(event) {
  if (!event) return false;
  if (["Queued", "Scheduled", "Draft", "Cancelled"].includes(event.outcome)) return false;
  if (event.beforeProvider) return false;
  if (event.test && !event.countForHealth) return false;
  return ["Delivered", "Failed", "Timed Out", "Rate Limited", "Provider Rejected", "Accepted"].includes(event.outcome);
}

export function metricsFromEvents(events = [], { queueSize = 0, capacity = 100, successfulChecks = 0, totalChecks = 0, consecutiveFailures = 0 } = {}) {
  const eligible = events.filter(eligibleAttempt);
  const attempts = eligible.length;
  const successful = eligible.filter((item) => item.outcome === "Delivered" || item.outcome === "Accepted").length;
  const timeouts = eligible.filter((item) => item.outcome === "Timed Out").length;
  const rateLimited = eligible.filter((item) => item.outcome === "Rate Limited").length;
  const latency = eligible.filter((item) => Number.isFinite(Number(item.responseMs)));
  const avgMs = latency.length ? latency.reduce((sum, item) => sum + Number(item.responseMs), 0) / latency.length : null;
  return {
    attempts,
    successful,
    timeouts,
    rateLimited,
    avgMs,
    consecutiveFailures,
    successfulChecks,
    totalChecks,
    queueSize,
    capacity,
    components: {
      success: successScore(successful, attempts),
      response: responseScore(avgMs),
      failure: attempts ? failureScore(consecutiveFailures) : null,
      timeout: timeoutScore(timeouts, attempts),
      availability: availabilityScore(successfulChecks, totalChecks),
      queue: queueScore(queueSize, capacity),
      rateLimit: rateLimitScore(rateLimited, attempts)
    }
  };
}

export function scoreProvider(metrics, options = {}) {
  const state = evaluationState({
    attempts: metrics.attempts,
    healthChecks: metrics.totalChecks,
    inactiveDays: options.inactiveDays || 0,
    minAttempts: options.minAttempts || DEFAULT_MIN_ATTEMPTS,
    minChecks: options.minChecks || DEFAULT_MIN_HEALTH_CHECKS
  });
  if (metrics.attempts === 0) {
    return {
      evaluationState: metrics.totalChecks ? "Insufficient Data" : state,
      healthScore: null,
      displayedScore: null,
      healthState: "Not Evaluated",
      confidence: 0,
      confidenceBand: "Very Low",
      provisional: true,
      formulaVersion: HEALTH_FORMULA_VERSION,
      thresholdVersion: THRESHOLD_CONFIG_VERSION
    };
  }
  const normalized = overallHealthScore(metrics.components, options.weights || DEFAULT_WEIGHTS);
  const confidence = confidencePercent(metrics.attempts, options.minAttempts || DEFAULT_MIN_ATTEMPTS);
  const fully = state === "Fully Evaluated";
  const raw = fully ? normalized : provisionalAdjustedScore(normalized, metrics.attempts, options);
  const displayed = smoothScore(raw, options.previousDisplayed, options.alpha);
  return {
    evaluationState: fully ? "Fully Evaluated" : (state === "Initializing" ? "Insufficient Data" : state),
    healthScore: raw,
    displayedScore: displayed,
    healthState: healthStateFromScore(displayed),
    confidence,
    confidenceBand: confidenceBand(confidence),
    provisional: !fully,
    normalizedScore: normalized,
    components: metrics.components,
    formulaVersion: HEALTH_FORMULA_VERSION,
    thresholdVersion: THRESHOLD_CONFIG_VERSION
  };
}

export function nextRecoverableState(current) {
  return nextRecoverableHealthState(current);
}

export function routingEligible(healthState, evaluation, { emergency = false, onboarding = false } = {}) {
  if (evaluation === "Initializing") return false;
  if (evaluation === "Insufficient Data") return onboarding;
  if (healthState === "Healthy" || healthState === "Stable") return true;
  if (healthState === "Degraded") return true;
  if (healthState === "Poor") return emergency;
  if (healthState === "Critical" || healthState === "Unhealthy") return emergency;
  if (healthState === "Not Evaluated") return onboarding;
  return false;
}

export function passesRoutingThresholds(provider = {}, health = {}, options = {}) {
  if (provider.enabled === false || provider.disabled) return { ok: false, reason: "enabled" };
  if (provider.maintenance) return { ok: false, reason: "maintenance" };
  if (!routingEligible(health.healthState, health.evaluationState, options)) return { ok: false, reason: "healthState" };
  if (Number(options.minConfidence || 0) > 0 && Number(health.confidence || 0) < Number(options.minConfidence)) {
    return { ok: false, reason: "confidence" };
  }
  return { ok: true };
}

export function metricValuesFrom(metrics = {}) {
  return {
    responseMs: metrics.avgMs ?? null,
    successRate: metrics.attempts ? (metrics.successful / metrics.attempts) * 100 : null,
    timeoutRate: metrics.attempts ? (metrics.timeouts / metrics.attempts) * 100 : null,
    queueUtilization: metrics.capacity ? (metrics.queueSize / metrics.capacity) * 100 : null,
    consecutiveFailures: metrics.attempts || metrics.consecutiveFailures ? metrics.consecutiveFailures : null,
    availability: metrics.totalChecks ? (metrics.successfulChecks / metrics.totalChecks) * 100 : null
  };
}
