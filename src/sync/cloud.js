import { App } from "../context.js";
import {
  getSyncMode,
  resolvedLocalBackupUrl,
  resolvedSupabaseKey,
  resolvedSupabaseUrl,
  resolvedSyncToken,
  resolvedSyncAccessKey,
  resolveBusinessId
} from "../config.js";
import { CLOUD_SNAPSHOT_TABLE, SESSION_USER_KEY } from "../constants.js";
import { sanitizeStateForCloud, restoreUsersFromCloud } from "./snapshot-security.js";
import { currentUser } from "../core/auth.js";
import { mergeStates, normalizeState, saveStateToStorage } from "../core/state.js";
import { shrinkStateMedia, isStorageQuotaError } from "../core/media-compress.js";

function businessId() {
  return resolveBusinessId(App.state);
}

function cloudUrl() {
  return resolvedSupabaseUrl(App.state);
}

function cloudKey() {
  return resolvedSupabaseKey(App.state);
}

function localBackupUrl() {
  return resolvedLocalBackupUrl(App.state);
}

function syncAccessKey() {
  return resolvedSyncAccessKey(App.state);
}

function syncToken() {
  return resolvedSyncToken(App.state);
}

function localHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = syncToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function cloudHeaders(extra = {}) {
  const key = cloudKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Cloud request timed out");
    throw new Error(error.message || "Cloud request failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function responseError(response, fallback) {
  let details = "";
  try {
    details = await response.text();
  } catch {
    details = "";
  }
  const clean = details ? ` ${details.slice(0, 160)}` : "";
  return new Error(`${fallback} (${response.status})${clean}`);
}

function normalizeSnapshot(raw, savedAt) {
  if (!raw) return null;
  if (raw.payload) return raw;
  return {
    payload: raw.data || raw,
    saved_at: raw.savedAt || raw.saved_at || savedAt || new Date().toISOString()
  };
}

async function latestLocalSnapshot() {
  const base = localBackupUrl();
  if (!base) throw new Error("Local backup URL is not configured");
  const response = await fetchWithTimeout(`${base}/backup`, {
    cache: "no-store",
    headers: localHeaders({ "Cache-Control": "no-cache", Pragma: "no-cache" })
  }, 12000);
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response, "Local backup read failed");
  const payload = await response.json();
  return normalizeSnapshot(payload);
}

async function saveLocalSnapshot(savedAt) {
  const base = localBackupUrl();
  if (!base) throw new Error("Local backup URL is not configured");
  const body = JSON.stringify({
    savedAt,
    data: sanitizeStateForCloud(App.state)
  });
  const response = await fetchWithTimeout(`${base}/backup`, {
    method: "POST",
    cache: "no-store",
    headers: localHeaders({ "Cache-Control": "no-cache", Pragma: "no-cache" }),
    body
  }, 15000);
  if (!response.ok) throw await responseError(response, "Local backup write failed");
}

async function latestSupabaseSnapshot() {
  const url = cloudUrl();
  const key = cloudKey();
  const accessKey = syncAccessKey();
  if (!url || !key) throw new Error("Supabase URL and anon key are required");
  if (!accessKey) throw new Error("Configure syncAccessKey in Settings before using cloud sync");
  const query = `business_id=eq.${encodeURIComponent(businessId())}&access_key=eq.${encodeURIComponent(accessKey)}&select=*&order=saved_at.desc&limit=1`;
  const response = await fetchWithTimeout(`${url}/rest/v1/${CLOUD_SNAPSHOT_TABLE}?${query}`, {
    cache: "no-store",
    headers: cloudHeaders({ "Cache-Control": "no-cache", Pragma: "no-cache" })
  }, 60000);
  if (!response.ok) throw await responseError(response, "Cloud read failed");
  const rows = await response.json();
  return rows?.[0] || null;
}

async function saveSupabaseSnapshot(savedAt) {
  const url = cloudUrl();
  const key = cloudKey();
  const accessKey = syncAccessKey();
  if (!url || !key) throw new Error("Supabase URL and anon key are required");
  if (!accessKey) throw new Error("Configure syncAccessKey in Settings before using cloud sync");
  const payload = sanitizeStateForCloud(App.state);
  const updateBody = JSON.stringify({
    payload,
    saved_by: currentUser()?.username || "system",
    saved_at: savedAt,
    access_key: accessKey
  });
  const insertBody = JSON.stringify({
    business_id: businessId(),
    access_key: accessKey,
    payload,
    saved_by: currentUser()?.username || "system",
    saved_at: savedAt
  });
  const updateUrl = `${url}/rest/v1/${CLOUD_SNAPSHOT_TABLE}?business_id=eq.${encodeURIComponent(businessId())}&access_key=eq.${encodeURIComponent(accessKey)}&select=id`;
  const updateResponse = await fetchWithTimeout(updateUrl, {
    method: "PATCH",
    cache: "no-store",
    headers: cloudHeaders({ Prefer: "return=representation", "Cache-Control": "no-cache", Pragma: "no-cache" }),
    body: updateBody
  }, 60000);
  // PostgREST answers 200 even when no row matched, so only stop if a row was actually updated.
  let updateError;
  if (updateResponse.ok) {
    const updatedRows = await updateResponse.json().catch(() => []);
    if (Array.isArray(updatedRows) && updatedRows.length) return;
    updateError = new Error("Cloud update matched no snapshot row");
  } else {
    updateError = await responseError(updateResponse, "Cloud update failed");
  }
  const insertUrl = `${url}/rest/v1/${CLOUD_SNAPSHOT_TABLE}?on_conflict=business_id`;
  const insertResponse = await fetchWithTimeout(insertUrl, {
    method: "POST",
    cache: "no-store",
    headers: cloudHeaders({ Prefer: "resolution=merge-duplicates,return=minimal", "Cache-Control": "no-cache", Pragma: "no-cache" }),
    body: insertBody
  }, 60000);
  if (!insertResponse.ok) {
    const insertError = await responseError(insertResponse, "Cloud insert failed");
    throw new Error(`${updateError.message}; ${insertError.message}`);
  }
}

export async function latestCloudSnapshot() {
  const mode = getSyncMode(App.state);
  if (mode === "local") return latestLocalSnapshot();
  if (mode === "supabase") return latestSupabaseSnapshot();
  throw new Error("Cloud sync is not configured");
}

async function saveCloudSnapshot(savedAt) {
  const mode = getSyncMode(App.state);
  if (mode === "local") {
    await saveLocalSnapshot(savedAt);
    return;
  }
  if (mode === "supabase") {
    await saveSupabaseSnapshot(savedAt);
    return;
  }
  throw new Error("Cloud sync is not configured");
}

export function queueCloudBackup(callback) {
  clearTimeout(App.syncTimer);
  App.syncTimer = setTimeout(() => callback(true), 3500);
}

export async function pushCloudBackup(silent = false) {
  if (App.syncBusy) {
    clearTimeout(App.syncTimer);
    App.syncTimer = setTimeout(() => pushCloudBackup(silent), 2000);
    return;
  }
  if (getSyncMode(App.state) === "none") {
    if (!silent) throw new Error("Configure Supabase or a local backup URL in Settings");
    return;
  }
  App.syncBusy = true;
  try {
    const snapshot = await latestCloudSnapshot().catch(() => null);
    if (snapshot?.payload) {
      const merged = mergeStates(App.state, snapshot.payload);
      merged.users = restoreUsersFromCloud(App.state.users, merged.users);
      App.state = normalizeState(merged);
    }
    await shrinkStateMedia(App.state);
    const savedAt = new Date().toISOString();
    await saveCloudSnapshot(savedAt);
    App.state.settings.lastSyncedAt = savedAt;
    App.state.settings.lastBackupAt = savedAt;
    try {
      saveStateToStorage(App.state);
    } catch (error) {
      // Upload already succeeded; the next local save retries with media shrinking.
      if (!isStorageQuotaError(error)) throw error;
    }
    App.localSavePending = false;
    return savedAt;
  } finally {
    App.syncBusy = false;
  }
}

export async function restoreCloudBackupFromCloud(options = {}) {
  const snapshot = await latestCloudSnapshot();
  if (!snapshot?.payload) throw new Error("No cloud backup found");
  if (options.replace) {
    localStorage.setItem("smile_trust_susu_local_backup_before_restore", JSON.stringify(App.state));
    const merged = mergeStates({}, snapshot.payload);
    merged.users = restoreUsersFromCloud(App.state.users, merged.users);
    App.state = normalizeState(merged);
    App.state.settings.lastSyncedAt = snapshot.saved_at || new Date().toISOString();
    App.localSavePending = false;
  } else {
    const merged = mergeStates(App.state, snapshot.payload);
    merged.users = restoreUsersFromCloud(App.state.users, merged.users);
    App.state = normalizeState(merged);
  }
  if (!options.keepSession) {
    sessionStorage.removeItem(SESSION_USER_KEY);
    App.sessionUserId = null;
  }
  if (!options.keepView) App.activeView = "dashboard";
  return snapshot;
}

export async function replaceFromCloud(options = {}) {
  const snapshot = await latestCloudSnapshot();
  if (!snapshot?.payload) throw new Error("No cloud backup found");
  localStorage.setItem("smile_trust_susu_local_backup_before_replace", JSON.stringify(App.state));
  App.state = normalizeState(snapshot.payload);
  App.state.settings.lastSyncedAt = snapshot.saved_at || new Date().toISOString();
  saveStateToStorage(App.state);
  App.localSavePending = false;
  sessionStorage.removeItem(SESSION_USER_KEY);
  App.sessionUserId = null;
  if (!options.keepView) App.activeView = "dashboard";
  return snapshot;
}

export async function connectLoginSync() {
  const notice = document.querySelector("#loginSyncNotice");
  notice.innerHTML = `<div class="notice">Merging cloud data...</div>`;
  try {
    await restoreCloudBackupFromCloud();
    return true;
  } catch (error) {
    notice.innerHTML = `<div class="notice">Could not restore cloud data: ${error.message}</div>`;
    return false;
  }
}

export async function replaceLoginSync() {
  if (!confirm("Replace all data on this device with the cloud copy? This cannot be undone.")) return false;
  const notice = document.querySelector("#loginSyncNotice");
  notice.innerHTML = `<div class="notice">Replacing this device with cloud data...</div>`;
  try {
    await replaceFromCloud();
    return true;
  } catch (error) {
    notice.innerHTML = `<div class="notice">Could not replace from cloud: ${error.message}</div>`;
    return false;
  }
}

export function startAutoCloudSync(refreshFn) {
  clearInterval(App.autoSyncTimer);
  App.autoSyncTimer = setInterval(refreshFn, /Android/i.test(navigator.userAgent) ? 5000 : 12000);
  window.addEventListener("online", refreshFn);
  window.addEventListener("focus", refreshFn);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshFn();
  });
}

export { cloudUrl, cloudKey, localBackupUrl, businessId, getSyncMode };
