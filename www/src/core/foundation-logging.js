/**
 * Wave 1 — Structured logging categories for foundation platform.
 * Thin adapter over Module 19 monitoring-ops.recordLog.
 */

import { recordLog, recordMetric } from "./monitoring-ops.js";
import { maskSensitive } from "./monitoring-lifecycle.js";

export const FOUNDATION_LOG_VERSION = "1.0.0";

export const LOG_CATEGORIES = Object.freeze([
  "app",
  "api",
  "security",
  "sync",
  "error",
  "performance"
]);

export const LOG_LEVELS = Object.freeze(["debug", "info", "warn", "error", "critical"]);

function normalizeCategory(category) {
  const c = String(category || "app").toLowerCase();
  return LOG_CATEGORIES.includes(c) ? c : "app";
}

function normalizeLevel(level) {
  const l = String(level || "info").toLowerCase();
  return LOG_LEVELS.includes(l) ? l : "info";
}

/**
 * Structured foundation log entry.
 */
export function logFoundation(state, {
  category = "app",
  level = "info",
  message = "",
  correlationId = "",
  traceId = "",
  payload = {},
  service = "foundation"
} = {}, uid, now) {
  const cat = normalizeCategory(category);
  const row = recordLog(state, {
    level: normalizeLevel(level),
    service: service + ":" + cat,
    message,
    correlationId,
    traceId,
    payload: {
      category: cat,
      ...maskSensitive(payload || {})
    }
  }, uid, now);
  if (cat === "performance" && Number.isFinite(Number(payload?.durationMs))) {
    recordMetric(state, {
      domain: "performance",
      name: payload.metricName || "foundation_duration_ms",
      value: Number(payload.durationMs),
      unit: "ms",
      source: "foundation-logging"
    }, uid, now);
  }
  return row;
}

export function logApp(state, message, payload, uid, now) {
  return logFoundation(state, { category: "app", message, payload }, uid, now);
}

export function logApi(state, message, payload, uid, now) {
  return logFoundation(state, { category: "api", message, payload }, uid, now);
}

export function logSecurity(state, message, payload, uid, now) {
  return logFoundation(state, { category: "security", level: "warn", message, payload }, uid, now);
}

export function logSync(state, message, payload, uid, now) {
  return logFoundation(state, { category: "sync", message, payload }, uid, now);
}

export function logError(state, message, payload, uid, now) {
  return logFoundation(state, { category: "error", level: "error", message, payload }, uid, now);
}

export function logPerformance(state, message, payload, uid, now) {
  return logFoundation(state, { category: "performance", message, payload }, uid, now);
}

export function listLogsByCategory(state, category, limit = 100) {
  const want = normalizeCategory(category);
  return (state.logEntries || [])
    .filter((row) => row.payload?.category === want || String(row.service || "").endsWith(":" + want))
    .slice(-limit);
}
