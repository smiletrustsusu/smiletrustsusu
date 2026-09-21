/**
 * In-memory financial transaction helpers for the local store.
 * SQL migrations document the equivalent BEGIN/COMMIT and row locks.
 */
export function snapshotRecord(record) {
  return JSON.parse(JSON.stringify(record || {}));
}

export function restoreRecord(target, snapshot) {
  if (!target || !snapshot) return target;
  Object.keys(target).forEach((key) => {
    if (!(key in snapshot)) delete target[key];
  });
  Object.assign(target, snapshot);
  return target;
}

export function acquireLock(record, userId, { ttlMs = 30000, now = Date.now() } = {}) {
  if (!record) return { error: "Record not found" };
  if (record.lockUntil && Date.parse(record.lockUntil) > now && record.lockedBy && record.lockedBy !== userId) {
    return { error: "This record is locked by another user" };
  }
  record.lockedBy = userId || "";
  record.lockUntil = new Date(now + ttlMs).toISOString();
  return { ok: true };
}

export function releaseLock(record) {
  if (!record) return record;
  record.lockedBy = "";
  record.lockUntil = "";
  return record;
}

export function assertOptimisticVersion(record, expectedUpdatedAt) {
  if (expectedUpdatedAt && record?.updatedAt && record.updatedAt !== expectedUpdatedAt) {
    return { error: "This record has changed. Refresh and try again." };
  }
  return { ok: true };
}

export function findByIdempotencyKey(rows = [], key) {
  if (!key) return null;
  const normalized = String(key).toLowerCase();
  return rows.find((item) => String(item.idempotencyKey || "").toLowerCase() === normalized) || null;
}

export function newCorrelationId(prefix = "txn") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
