/**
 * Wave 4 — Retry scheduling with Phase 18 exponential backoff.
 * Never auto-retries conflict_detected or revoked-device failures.
 */

import {
  lookupSyncRetryPolicy,
  nextRetryBackoffSeconds
} from "../core/phase18-ops-sla.js";

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function jitterMs(baseSeconds, jitterPct = 0, random = Math.random) {
  const base = Math.max(0, Number(baseSeconds) || 0) * 1000;
  const pct = Math.max(0, Number(jitterPct) || 0) / 100;
  if (!pct || !base) return base;
  const delta = base * pct;
  return Math.round(base - delta + random() * 2 * delta);
}

export function classifySyncFailure(entry = {}, errorHint = "") {
  const status = String(entry.status || "").toLowerCase();
  const err = String(errorHint || entry.lastError || "").toLowerCase();
  if (status === "conflict_detected" || err.includes("conflict")) return "conflict";
  if (err.includes("revoked") || err.includes("device_revoked")) return "device_revoked";
  if (err.includes("validat") || err.includes("schema")) return "validation";
  if (err.includes("busy") || err.includes("back-pressure") || err.includes("429")) return "server_busy";
  if (err.includes("network") || err.includes("offline") || err.includes("timeout") || status === "retrying" || status === "failed") {
    return "network";
  }
  return "network";
}

export function scheduleQueueRetry(entry, { now, failureClass, attemptIndex, random } = {}) {
  if (!entry) return { ok: false, error: "entry required" };
  const status = String(entry.status || "").toLowerCase();
  const fc = failureClass || classifySyncFailure(entry);
  const lookup = lookupSyncRetryPolicy({
    status: status === "conflict_detected" ? "conflict_detected" : status,
    failureClass: fc === "conflict" ? undefined : fc
  });
  if (!lookup.ok) {
    entry.failureClass = fc;
    entry.nextRetryAt = "";
    return { ok: false, ...lookup, retryAllowed: false };
  }
  const policy = lookup.policy;
  const attempts = Number.isFinite(attemptIndex)
    ? attemptIndex
    : Math.max(0, Number(entry.attempts || 0));
  const backoff = nextRetryBackoffSeconds(policy.id, attempts);
  entry.failureClass = fc;
  entry.retryPolicyId = policy.id;
  if (!backoff.ok || !backoff.retryAllowed) {
    entry.nextRetryAt = "";
    entry.lastBackoffSeconds = null;
    return {
      ok: true,
      retryAllowed: false,
      reason: backoff.reason || "no_auto_retry",
      policy,
      escalateAfterHours: policy.escalateAfterHours
    };
  }
  const delay = jitterMs(backoff.backoffSeconds, policy.jitterPct, random || Math.random);
  const dueAt = new Date(nowMs(now) + delay).toISOString();
  entry.nextRetryAt = dueAt;
  entry.lastBackoffSeconds = backoff.backoffSeconds;
  if (entry.status !== "conflict_detected" && entry.status !== "cancelled") {
    entry.status = "retrying";
  }
  return {
    ok: true,
    retryAllowed: true,
    nextRetryAt: dueAt,
    backoffSeconds: backoff.backoffSeconds,
    policy,
    attemptIndex: backoff.attemptIndex
  };
}

export function isRetryDue(entry, now) {
  if (!entry) return false;
  if (entry.status === "conflict_detected" || entry.status === "cancelled") return false;
  if (!entry.nextRetryAt) return true;
  return Date.parse(entry.nextRetryAt) <= nowMs(now);
}

export function clearRetrySchedule(entry) {
  if (!entry) return;
  entry.nextRetryAt = "";
  entry.lastBackoffSeconds = null;
  entry.failureClass = "";
}
