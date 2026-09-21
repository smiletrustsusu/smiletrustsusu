/**
 * Wave 1 — Offline foundation: encrypted local cache + sync queue persistence/recovery.
 * Foundation only — no full business sync logic (Wave 4).
 */

import { ensureSyncState } from "./sync-ops.js";
import { pendingQueueItems } from "../sync/offline-queue.js";
import { encryptOfflinePayload, decryptOfflinePayload, wrapQueueEntryForStorage } from "../sync/offline-crypto.js";
import { buildFoundationError } from "./foundation-errors.js";
import { logSync, logError } from "./foundation-logging.js";

export const OFFLINE_FOUNDATION_VERSION = "1.0.0";
export const OFFLINE_QUEUE_STORAGE_KEY = "smile_trust_offline_queue_v1";
export const OFFLINE_CACHE_STORAGE_KEY = "smile_trust_offline_cache_v1";

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function storage() {
  if (typeof offlineStorageOverride !== "undefined" && offlineStorageOverride) {
    return offlineStorageOverride;
  }
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

/** @type {null | Storage} */
let offlineStorageOverride = null;

/** Test/Electron hook — inject a Map-like storage implementing getItem/setItem/removeItem. */
export function setOfflineStorageAdapter(adapter) {
  offlineStorageOverride = adapter || null;
}

export function ensureOfflineFoundationState(state = {}) {
  ensureSyncState(state);
  state.offlineFoundation = state.offlineFoundation || {
    schemaVersion: OFFLINE_FOUNDATION_VERSION,
    lastPersistedAt: "",
    lastRecoveredAt: "",
    lastPersistError: "",
    lastRecoverError: "",
    persistCount: 0,
    recoverCount: 0
  };
  state.offlineLocalCache = state.offlineLocalCache || {};
  return state;
}

/**
 * Snapshot queue items for durable local persistence (optionally encrypted).
 */
export async function persistOfflineQueue(state, {
  secret = "",
  fingerprint = "",
  storageKey = OFFLINE_QUEUE_STORAGE_KEY,
  uid,
  now
} = {}) {
  ensureOfflineFoundationState(state);
  const store = storage();
  if (!store) {
    const err = buildFoundationError("FND-010", { message: "localStorage unavailable for queue persist" });
    state.offlineFoundation.lastPersistError = err.error;
    logError(state, err.error, { code: err.errorCode }, uid, now);
    return err;
  }

  try {
    const items = (state.offlineQueue || []).map((entry) => ({ ...entry }));
    let envelope = {
      v: 1,
      schemaVersion: OFFLINE_FOUNDATION_VERSION,
      savedAt: nowIso(now),
      encrypted: false,
      items
    };

    if (secret && fingerprint) {
      const enc = await encryptOfflinePayload(items, { secret, fingerprint });
      envelope = {
        v: 1,
        schemaVersion: OFFLINE_FOUNDATION_VERSION,
        savedAt: nowIso(now),
        encrypted: enc.encrypted === true,
        items: enc.encrypted ? enc.payload : items
      };
    }

    store.setItem(storageKey, JSON.stringify(envelope));
    state.offlineFoundation.lastPersistedAt = envelope.savedAt;
    state.offlineFoundation.lastPersistError = "";
    state.offlineFoundation.persistCount = Number(state.offlineFoundation.persistCount || 0) + 1;
    logSync(state, "Offline queue persisted", {
      count: items.length,
      encrypted: envelope.encrypted === true
    }, uid, now);
    return { ok: true, count: items.length, encrypted: envelope.encrypted === true, savedAt: envelope.savedAt };
  } catch (err) {
    const out = buildFoundationError("FND-010", { message: err.message || "Queue persist failed" });
    state.offlineFoundation.lastPersistError = out.error;
    logError(state, out.error, { code: out.errorCode }, uid, now);
    return out;
  }
}

/**
 * Recover queue from durable storage into state (idempotent by idempotencyKey).
 */
export async function recoverOfflineQueue(state, {
  secret = "",
  fingerprint = "",
  storageKey = OFFLINE_QUEUE_STORAGE_KEY,
  uid,
  now
} = {}) {
  ensureOfflineFoundationState(state);
  const store = storage();
  if (!store) {
    const err = buildFoundationError("FND-011", { message: "localStorage unavailable for queue recovery" });
    state.offlineFoundation.lastRecoverError = err.error;
    return err;
  }

  try {
    const raw = store.getItem(storageKey);
    if (!raw) {
      state.offlineFoundation.lastRecoveredAt = nowIso(now);
      return { ok: true, recovered: 0, skipped: 0, empty: true };
    }
    const envelope = JSON.parse(raw);
    let items = envelope.items || [];
    if (envelope.encrypted) {
      items = await decryptOfflinePayload(
        { encrypted: true, payload: envelope.items },
        { secret, fingerprint }
      );
    }
    if (!Array.isArray(items)) {
      return buildFoundationError("FND-011", { message: "Recovered queue is not an array" });
    }

    state.offlineQueue = state.offlineQueue || [];
    const existing = new Set(
      state.offlineQueue.map((item) => String(item.idempotencyKey || item.id || "").toLowerCase())
    );
    let recovered = 0;
    let skipped = 0;
    for (const item of items) {
      const key = String(item.idempotencyKey || item.id || "").toLowerCase();
      if (!key || existing.has(key)) {
        skipped += 1;
        continue;
      }
      state.offlineQueue.push({ ...item });
      existing.add(key);
      recovered += 1;
    }
    state.offlineFoundation.lastRecoveredAt = nowIso(now);
    state.offlineFoundation.lastRecoverError = "";
    state.offlineFoundation.recoverCount = Number(state.offlineFoundation.recoverCount || 0) + 1;
    logSync(state, "Offline queue recovered", { recovered, skipped }, uid, now);
    return { ok: true, recovered, skipped, empty: false };
  } catch (err) {
    const out = buildFoundationError("FND-011", { message: err.message || "Queue recovery failed" });
    state.offlineFoundation.lastRecoverError = out.error;
    logError(state, out.error, { code: out.errorCode }, uid, now);
    return out;
  }
}

export async function setEncryptedLocalCache(state, cacheKey, value, {
  secret = "",
  fingerprint = "",
  uid,
  now
} = {}) {
  ensureOfflineFoundationState(state);
  if (!cacheKey) return buildFoundationError("FND-007", { message: "cacheKey required" });
  let stored = value;
  let encrypted = false;
  if (secret && fingerprint) {
    const enc = await encryptOfflinePayload(value, { secret, fingerprint });
    stored = wrapQueueEntryForStorage({ kind: "cache" }, enc).payload;
    encrypted = enc.encrypted === true;
  }
  state.offlineLocalCache[cacheKey] = {
    encrypted,
    value: stored,
    updatedAt: nowIso(now)
  };
  try {
    const store = storage();
    if (store) store.setItem(OFFLINE_CACHE_STORAGE_KEY, JSON.stringify(state.offlineLocalCache));
  } catch {
    /* best effort */
  }
  logSync(state, "Offline cache updated", { cacheKey, encrypted }, uid, now);
  return { ok: true, cacheKey, encrypted };
}

export async function getEncryptedLocalCache(state, cacheKey, { secret = "", fingerprint = "" } = {}) {
  ensureOfflineFoundationState(state);
  const row = state.offlineLocalCache?.[cacheKey];
  if (!row) return { ok: true, value: null };
  if (!row.encrypted) return { ok: true, value: row.value, encrypted: false };
  try {
    const value = await decryptOfflinePayload(
      { encrypted: true, payload: row.value },
      { secret, fingerprint }
    );
    return { ok: true, value, encrypted: true };
  } catch (err) {
    return buildFoundationError("FND-012", { message: err.message || "Cache decrypt failed" });
  }
}

export function offlineFoundationDashboard(state) {
  ensureOfflineFoundationState(state);
  const pending = pendingQueueItems(state).length;
  const total = (state.offlineQueue || []).length;
  return {
    schemaVersion: OFFLINE_FOUNDATION_VERSION,
    pending,
    total,
    cacheKeys: Object.keys(state.offlineLocalCache || {}).length,
    lastPersistedAt: state.offlineFoundation.lastPersistedAt || "",
    lastRecoveredAt: state.offlineFoundation.lastRecoveredAt || "",
    lastPersistError: state.offlineFoundation.lastPersistError || "",
    lastRecoverError: state.offlineFoundation.lastRecoverError || "",
    persistCount: state.offlineFoundation.persistCount || 0,
    recoverCount: state.offlineFoundation.recoverCount || 0
  };
}
