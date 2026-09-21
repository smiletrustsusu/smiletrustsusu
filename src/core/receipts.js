/**
 * Immutable receipt numbering for collections.
 */

export function nextReceiptSequence(state) {
  state.settings = state.settings || {};
  const next = Number(state.settings.lastReceiptSequence || 0) + 1;
  state.settings.lastReceiptSequence = next;
  return next;
}

export function buildReceiptNo(state, collectorCode = "") {
  const seq = nextReceiptSequence(state);
  const prefix = String(collectorCode || "RCP").toUpperCase().replace(/[^A-Z0-9]/g, "") || "RCP";
  return `${prefix}-${String(seq).padStart(8, "0")}`;
}

export function buildIdempotencyKey({ deviceId = "", clientId = "", timestamp = "" } = {}) {
  const parts = [deviceId, clientId, timestamp].filter(Boolean);
  if (parts.length) return parts.join(":");
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isDuplicateIdempotencyKey(state, key) {
  if (!key) return false;
  const normalized = String(key).toLowerCase();
  if ((state.collections || []).some((item) => String(item.idempotencyKey || "").toLowerCase() === normalized)
    || (state.offlineQueue || []).some((item) => String(item.idempotencyKey || "").toLowerCase() === normalized)) {
    return true;
  }
  const stored = (state.idempotencyKeys || []).find((item) => String(item.idempotencyKey || "").toLowerCase() === normalized);
  return Boolean(stored && (stored.requestStatus === "succeeded" || stored.requestStatus === "processing"));
}
