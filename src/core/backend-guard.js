/**
 * Backend-change guard. When a build targets a different Supabase project or business code than
 * the one this device last synced with, the device's existing data is moved aside under
 * quarantine keys (never read by sync code) and the app starts clean against the new backend.
 * Nothing from the previous backend is uploaded to the new one.
 */
import { BUSINESS_ID_KEY, CLOUD_KEY_STORAGE, LEGACY_ANDROID_STORE_KEY, REMEMBER_LOGIN_KEY, SESSION_USER_KEY, STORE_KEY, SYNC_TOKEN_STORAGE, SYNC_URL_KEY, ANDROID_CLOUD_PRIMARY_KEY } from "../constants.js";

export const BACKEND_IDENTITY_KEY = "smile_trust_backend_identity_v1";
export const BACKEND_QUARANTINE_INDEX_KEY = "smile_trust_backend_quarantine_v1";
export const BACKEND_SYNC_HOLD_KEY = "smile_trust_backend_sync_hold_v1";
export const QUARANTINE_PREFIX = "smile_trust_quarantine";

/** Device data that belongs to the backend it was synced with. Moved, not copied (storage quota). */
export const BACKEND_DATA_KEYS = Object.freeze([
  STORE_KEY,
  LEGACY_ANDROID_STORE_KEY,
  "smile_trust_offline_queue_v1",
  "smile_trust_offline_cache_v1",
  "smile_trust_susu_local_backup_before_replace",
  "smile_trust_legacy_sync_access_key"
]);

/** Connection and session material for the previous backend. Removed. */
export const BACKEND_SESSION_KEYS = Object.freeze([
  SYNC_URL_KEY,
  CLOUD_KEY_STORAGE,
  SYNC_TOKEN_STORAGE,
  BUSINESS_ID_KEY,
  ANDROID_CLOUD_PRIMARY_KEY,
  REMEMBER_LOGIN_KEY,
  "smile_trust_supabase_session",
  "smile_trust_session_started",
  "smile_trust_session_device"
]);

export const BACKEND_SESSION_STORAGE_KEYS = Object.freeze([
  SESSION_USER_KEY,
  "smile_trust_supabase_session",
  "smile_trust_portal_session",
  "smile_trust_portal_customer"
]);

function hostOf(url) {
  try {
    return new URL(String(url || "")).host.toLowerCase();
  } catch {
    return "";
  }
}

export function backendIdentity(url, businessId) {
  const host = hostOf(url);
  if (!host) return null;
  return { host, businessId: String(businessId || "").trim() };
}

export function sameBackend(a, b) {
  if (!a || !b) return true;
  if (a.host !== b.host) return false;
  return !a.businessId || !b.businessId || a.businessId === b.businessId;
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) || "null");
  } catch {
    return null;
  }
}

/** The backend this device last used: the recorded identity, else what its saved data points at. */
export function previousBackendIdentity(storage) {
  const recorded = readJson(storage, BACKEND_IDENTITY_KEY);
  if (recorded?.host) return recorded;
  const saved = readJson(storage, STORE_KEY);
  const url = storage?.getItem(SYNC_URL_KEY) || saved?.settings?.cloudUrl || "";
  const businessId = storage?.getItem(BUSINESS_ID_KEY) || saved?.settings?.businessId || "";
  return backendIdentity(url, businessId);
}

function hasBackendData(storage) {
  return BACKEND_DATA_KEYS.some((key) => storage?.getItem(key));
}

/** Sync with a newly adopted backend waits until a staff member signs in online against it. */
export function holdBackendSync(storage, target, now = new Date().toISOString()) {
  storage?.setItem(BACKEND_SYNC_HOLD_KEY, JSON.stringify({ host: target?.host || "", businessId: target?.businessId || "", since: now }));
}

export function backendSyncHeld(storage) {
  return Boolean(readJson(storage, BACKEND_SYNC_HOLD_KEY));
}

export function releaseBackendSyncHold(storage) {
  storage?.removeItem(BACKEND_SYNC_HOLD_KEY);
}

/** What the login screen shows while sync is held: the new backend and, if any, the set-aside one. */
export function backendTransitionNotice(storage) {
  const hold = readJson(storage, BACKEND_SYNC_HOLD_KEY);
  if (!hold) return null;
  const index = readJson(storage, BACKEND_QUARANTINE_INDEX_KEY);
  const last = Array.isArray(index) ? index.at(-1) : null;
  return { to: { host: hold.host, businessId: hold.businessId }, from: last?.from || null, since: hold.since };
}

/**
 * Run before any sync. `config` is the bundled client config (supabaseUrl, businessId).
 * @returns {{ quarantined: boolean, held?: boolean, blocked?: boolean, from?: object, to?: object, entry?: object }}
 */
export function enforceBackendIdentity({ storage, sessionStore = null, config = {}, now = new Date().toISOString() }) {
  const target = backendIdentity(config.supabaseUrl, config.businessId);
  if (!storage || !target) return { quarantined: false };
  const recorded = readJson(storage, BACKEND_IDENTITY_KEY);
  const previous = previousBackendIdentity(storage);
  if (!previous || sameBackend(previous, target) || !hasBackendData(storage)) {
    const firstUse = !recorded?.host || !sameBackend(recorded, target);
    storage.setItem(BACKEND_IDENTITY_KEY, JSON.stringify(target));
    if (firstUse && !(previous && sameBackend(previous, target) && hasBackendData(storage))) {
      holdBackendSync(storage, target, now);
    }
    return { quarantined: false, held: backendSyncHeld(storage), to: target };
  }
  const stamp = String(now).replace(/[^0-9]/g, "").slice(0, 14);
  const moved = [];
  for (const key of BACKEND_DATA_KEYS) {
    const value = storage.getItem(key);
    if (value == null) continue;
    const quarantineKey = `${QUARANTINE_PREFIX}:${stamp}:${key}`;
    storage.removeItem(key);
    try {
      storage.setItem(quarantineKey, value);
    } catch (error) {
      // Undo so no data is lost; the caller must keep cloud sync off for this device.
      storage.setItem(key, value);
      for (const done of moved) {
        const original = done.slice(`${QUARANTINE_PREFIX}:${stamp}:`.length);
        storage.setItem(original, storage.getItem(done));
        storage.removeItem(done);
      }
      return { quarantined: false, blocked: true, from: previous, to: target, error: error?.message || String(error) };
    }
    moved.push(quarantineKey);
  }
  for (const key of BACKEND_SESSION_KEYS) storage.removeItem(key);
  for (const key of BACKEND_SESSION_STORAGE_KEYS) sessionStore?.removeItem(key);
  const entry = { at: now, from: previous, to: target, keys: moved, noticeShown: false };
  const index = readJson(storage, BACKEND_QUARANTINE_INDEX_KEY);
  storage.setItem(BACKEND_QUARANTINE_INDEX_KEY, JSON.stringify([...(Array.isArray(index) ? index : []), entry]));
  storage.setItem(BACKEND_IDENTITY_KEY, JSON.stringify(target));
  holdBackendSync(storage, target, now);
  return { quarantined: true, held: true, from: previous, to: target, entry };
}

/** Oldest quarantine whose notice has not been shown yet; marks it shown. */
export function takeQuarantineNotice(storage) {
  const index = readJson(storage, BACKEND_QUARANTINE_INDEX_KEY);
  if (!Array.isArray(index)) return null;
  const entry = index.find((item) => !item.noticeShown);
  if (!entry) return null;
  entry.noticeShown = true;
  storage.setItem(BACKEND_QUARANTINE_INDEX_KEY, JSON.stringify(index));
  return entry;
}
