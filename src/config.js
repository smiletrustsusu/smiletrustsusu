import { BUSINESS_ID_KEY, CLOUD_KEY_STORAGE, SYNC_TOKEN_STORAGE, SYNC_URL_KEY } from "./constants.js";

/** Only public, non-secret settings may be read from the distributed config.json. */
export const CLIENT_CONFIG_ALLOWED_KEYS = Object.freeze([
  "supabaseUrl",
  "supabaseAnonKey",
  "businessId",
  "localBackupUrl",
  "allowDeveloperLogin",
  "productionMode",
  "unifiedCloud",
  "relationalSync",
  "postgresSourceOfTruth",
  "encryptOfflineQueue",
  "supabaseAuthEnabled",
  "staffLoginFunction"
]);

/** Device-only slot for a legacy snapshot access key that existed before staff sessions. */
export const LEGACY_SYNC_KEY_STORAGE = "smile_trust_legacy_sync_access_key";

let appConfig = {};

export function pickClientConfig(raw = {}) {
  const clean = {};
  CLIENT_CONFIG_ALLOWED_KEYS.forEach((key) => {
    if (raw && Object.prototype.hasOwnProperty.call(raw, key)) clean[key] = raw[key];
  });
  return clean;
}

export function getAppConfig() {
  return appConfig;
}

export async function loadAppConfig() {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (response.ok) appConfig = pickClientConfig(await response.json());
  } catch {
    appConfig = {};
  }
  return appConfig;
}

/**
 * Move a legacy access key out of synced settings into a device-only slot so it never
 * travels in snapshots again; it stays available to decrypt older offline queue items.
 */
export function captureLegacySyncKey(state) {
  const legacy = String(state?.settings?.syncAccessKey || "").trim();
  if (legacy && typeof localStorage !== "undefined" && !localStorage.getItem(LEGACY_SYNC_KEY_STORAGE)) {
    localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, legacy);
  }
  if (state?.settings && "syncAccessKey" in state.settings) delete state.settings.syncAccessKey;
  return legacy;
}

export function legacySyncAccessKey() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(LEGACY_SYNC_KEY_STORAGE) || "";
}

export function resolveBusinessId(state) {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(BUSINESS_ID_KEY) : "";
  const fromState = state?.settings?.businessId;
  const fromConfig = appConfig.businessId;
  const id = stored || fromState || fromConfig;
  if (id) return id;
  const generated = `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof localStorage !== "undefined") localStorage.setItem(BUSINESS_ID_KEY, generated);
  return generated;
}

export function resolvedSupabaseUrl(state) {
  const storage = typeof localStorage !== "undefined" ? localStorage.getItem(SYNC_URL_KEY) : "";
  return (
    state?.settings?.cloudUrl ||
    storage ||
    appConfig.supabaseUrl ||
    ""
  ).replace(/\/$/, "");
}

export function resolvedSupabaseKey(state) {
  const storage = typeof localStorage !== "undefined" ? localStorage.getItem(CLOUD_KEY_STORAGE) : "";
  return state?.settings?.cloudKey || storage || appConfig.supabaseAnonKey || "";
}

export function resolvedLocalBackupUrl(state) {
  const configured = state?.settings?.localBackupUrl || appConfig.localBackupUrl || "";
  if (configured) return configured.replace(/\/$/, "");
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) return "http://localhost:8787";
  return "";
}

/** Legacy snapshot key held by devices installed before staff sessions; never read from config. */
export function resolvedSyncAccessKey(state) {
  return legacySyncAccessKey() || state?.settings?.syncAccessKey || "";
}

export function resolvedSyncToken(state) {
  const storage = typeof localStorage !== "undefined" ? localStorage.getItem(SYNC_TOKEN_STORAGE) : "";
  return state?.settings?.syncToken || storage || "";
}

export function persistCloudSettings(state, { cloudUrl, cloudKey, localBackupUrl, syncToken, businessId }) {
  if (cloudUrl !== undefined) {
    const clean = String(cloudUrl || "").trim().replace(/\/$/, "");
    state.settings.cloudUrl = clean;
    if (typeof localStorage !== "undefined") {
      if (clean) localStorage.setItem(SYNC_URL_KEY, clean);
      else localStorage.removeItem(SYNC_URL_KEY);
    }
  }
  if (cloudKey !== undefined) {
    const clean = String(cloudKey || "").trim();
    state.settings.cloudKey = clean;
    if (typeof localStorage !== "undefined") {
      if (clean) localStorage.setItem(CLOUD_KEY_STORAGE, clean);
      else localStorage.removeItem(CLOUD_KEY_STORAGE);
    }
  }
  if (localBackupUrl !== undefined) {
    state.settings.localBackupUrl = String(localBackupUrl || "").trim().replace(/\/$/, "");
  }
  if (syncToken !== undefined) {
    const clean = String(syncToken || "").trim();
    state.settings.syncToken = clean;
    if (typeof localStorage !== "undefined") {
      if (clean) localStorage.setItem(SYNC_TOKEN_STORAGE, clean);
      else localStorage.removeItem(SYNC_TOKEN_STORAGE);
    }
  }
  if (businessId !== undefined) {
    const clean = String(businessId || "").trim();
    if (clean) {
      state.settings.businessId = clean;
      if (typeof localStorage !== "undefined") localStorage.setItem(BUSINESS_ID_KEY, clean);
    }
  }
}

export function unifiedCloudEnabled(state, config = appConfig) {
  if (config.unifiedCloud === false) return false;
  return Boolean(resolvedSupabaseUrl(state) && resolvedSupabaseKey(state));
}

export function applyUnifiedCloudDefaults(state, config = appConfig) {
  const url = (
    state?.settings?.cloudUrl ||
    config.supabaseUrl ||
    ""
  ).replace(/\/$/, "");
  const key = state?.settings?.cloudKey || config.supabaseAnonKey || "";
  if (!url || !key) return state;

  persistCloudSettings(state, {
    cloudUrl: url,
    cloudKey: key,
    businessId: config.businessId || resolveBusinessId(state)
  });

  if (config.unifiedCloud === false) return state;

  state.settings.cloudMode = "supabase";
  state.settings.relationalSync = true;
  state.settings.postgresSourceOfTruth = true;
  state.settings.unifiedCloud = true;
  if (config.businessId) {
    state.settings.businessId = config.businessId;
    if (typeof localStorage !== "undefined") localStorage.setItem(BUSINESS_ID_KEY, config.businessId);
  }
  return state;
}

export function getSyncMode(state) {
  const mode = state?.settings?.cloudMode || "auto";
  const supabaseUrl = resolvedSupabaseUrl(state);
  const localUrl = resolvedLocalBackupUrl(state);
  if (mode === "supabase") return supabaseUrl ? "supabase" : "none";
  if (mode === "local") return localUrl ? "local" : "none";
  if (/supabase\.co/i.test(supabaseUrl)) return "supabase";
  if (localUrl) return "local";
  if (supabaseUrl) return "supabase";
  return "none";
}
