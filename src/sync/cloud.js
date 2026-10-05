import { App } from "../context.js";
import {
  getAppConfig,
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
import { ensureFreshAccessToken, getStoredAuthSession } from "./supabase-auth.js";
import { applySubmissionResult, canWriteSnapshot, pendingCollectionSubmissions, submissionBatches } from "./collection-submit.js";
import { supabaseKeyHeaders } from "./supabase-headers.js";
import { backendSyncHeld } from "../core/backend-guard.js";
import {
  buildCanonicalUpdate,
  canonicalSnapshotProblems,
  cloudFormatProblems,
  currentSessionIdentity,
  fetchDatabaseLoad,
  recordsHeldOnDevice,
  relationalIntegrityProblems,
  sameSnapshotContent,
  sessionStaffProblem,
  usableDatabaseLoad
} from "./canonical-snapshot.js";

function storageOrNull() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

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

function cloudHeaders(bearer, extra = {}) {
  return { ...supabaseKeyHeaders(cloudKey(), { bearer }), ...extra };
}

/**
 * Snapshot access is authorized by the signed-in staff member's session. Devices installed before
 * staff sessions may still hold a legacy access key; that path works only until migration 046.
 */
async function snapshotAuth() {
  const url = cloudUrl();
  const key = cloudKey();
  if (!url || !key) throw new Error("Supabase URL and anon key are required");
  const token = await ensureFreshAccessToken(App.state).catch(() => "");
  if (token) return { url, bearer: token, legacyKey: "" };
  const legacyKey = syncAccessKey();
  if (legacyKey && !backendSyncHeld(storageOrNull())) return { url, bearer: "", legacyKey };
  throw new Error("Sign in online to sync with the cloud");
}

function snapshotFilter(legacyKey) {
  const base = `business_id=eq.${encodeURIComponent(businessId())}`;
  return legacyKey ? `${base}&access_key=eq.${encodeURIComponent(legacyKey)}` : base;
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
  const { url, bearer, legacyKey } = await snapshotAuth();
  const query = `${snapshotFilter(legacyKey)}&select=id,business_id,payload,saved_at,saved_by&order=saved_at.desc&limit=1`;
  const response = await fetchWithTimeout(`${url}/rest/v1/${CLOUD_SNAPSHOT_TABLE}?${query}`, {
    cache: "no-store",
    headers: cloudHeaders(bearer, { "Cache-Control": "no-cache", Pragma: "no-cache" })
  }, 60000);
  if (!response.ok) throw await responseError(response, "Cloud read failed");
  const rows = await response.json();
  return rows?.[0] || null;
}

function refuseUpdate(message) {
  const error = syncError(CLOUD_UPDATE_REFUSED, `${message}; nothing was uploaded and this device's data stays here`);
  App.lastCloudSyncError = { code: error.code, message: error.message, at: new Date().toISOString() };
  console.warn(`[cloud] ${error.message}`);
  return error;
}

/**
 * Updates the existing cloud copy only, never from this device's state: the database modules come
 * from a fresh database load, everything else is carried from the cloud copy just read
 * (canonical-snapshot.js). The first copy is never created here: it is made once, deliberately,
 * by a manager through snapshot-bootstrap.js. The update applies only if the row still has the id
 * and saved_at it was read with, so a copy that changed meanwhile is never overwritten.
 */
async function saveSupabaseSnapshot(savedAt, cloudRow) {
  const identity = await currentSessionIdentity(App.state);
  if (!identity) throw refuseUpdate("Sign in online as a manager to update the cloud copy");
  if (!canWriteSnapshot(identity.role)) throw refuseUpdate("Only a manager session may update the cloud copy");
  const configured = getAppConfig().businessId;
  if (identity.businessCode !== businessId() || (configured && configured !== identity.businessCode) || cloudRow?.business_id !== identity.businessCode) {
    throw refuseUpdate("This device, the signed-in account and the cloud copy are not all for the same business");
  }
  if (cloudRow.id === undefined || cloudRow.id === null || !cloudRow.saved_at) {
    throw refuseUpdate("The cloud copy was read without its row id or save time, so a concurrent change could not be detected");
  }
  const formatProblems = cloudFormatProblems(cloudRow.payload);
  if (formatProblems.length) {
    throw refuseUpdate(`The cloud copy is not in the canonical database format (${formatProblems.join("; ")}); run the read-only snapshot checkpoint before syncing`);
  }
  let load;
  try {
    load = await fetchDatabaseLoad(App.state, identity.businessCode);
  } catch (error) {
    throw refuseUpdate(`The database load failed (${error.message})`);
  }
  if (!usableDatabaseLoad(load)) throw refuseUpdate("The database load returned no usable data");
  const integrity = relationalIntegrityProblems(load.snapshot, load.rows);
  if (integrity.length) throw refuseUpdate(`Database integrity check failed: ${integrity.join("; ")}`);
  const staffProblem = sessionStaffProblem(load.snapshot, identity);
  if (staffProblem) throw refuseUpdate(`Cannot update the cloud copy: ${staffProblem}`);

  const context = { database: load.snapshot, cloudPayload: cloudRow.payload, businessCode: identity.businessCode };
  const payload = buildCanonicalUpdate({ ...context, now: savedAt });
  const problems = canonicalSnapshotProblems(payload, context);
  if (problems.length) throw refuseUpdate(`The update failed validation: ${problems.join("; ")}`);
  const held = recordsHeldOnDevice(App.state, payload);
  App.lastCloudSyncReport = { heldOnDevice: held, at: savedAt };
  if (Object.keys(held).length) {
    console.warn(`[cloud] Records on this device that are not in the database or the cloud copy were not uploaded: ${Object.entries(held).map(([key, n]) => `${key} ${n}`).join(", ")}`);
  }
  if (sameSnapshotContent(payload, cloudRow.payload)) return;

  const { url, bearer } = await snapshotAuth();
  if (!bearer) throw refuseUpdate("Sign in online as a manager to update the cloud copy");
  const saver = load.snapshot.users.find((user) => user.id === identity.appUserId);
  const filter = [
    `id=eq.${encodeURIComponent(cloudRow.id)}`,
    `business_id=eq.${encodeURIComponent(identity.businessCode)}`,
    `saved_at=eq.${encodeURIComponent(cloudRow.saved_at)}`
  ].join("&");
  const updateResponse = await fetchWithTimeout(`${url}/rest/v1/${CLOUD_SNAPSHOT_TABLE}?${filter}&select=id`, {
    method: "PATCH",
    cache: "no-store",
    headers: cloudHeaders(bearer, { Prefer: "return=representation", "Cache-Control": "no-cache", Pragma: "no-cache" }),
    body: JSON.stringify({ payload, saved_by: saver.username, saved_at: savedAt })
  }, 60000);
  if (!updateResponse.ok) throw await responseError(updateResponse, "Cloud update failed");
  // PostgREST answers 200 even when no row matched.
  const updatedRows = await updateResponse.json().catch(() => []);
  if (!Array.isArray(updatedRows) || updatedRows.length !== 1) {
    const error = syncError(CLOUD_UPDATE_CONFLICT, "Cloud update matched no snapshot row: the cloud copy changed after it was read, or this session may no longer write it. Nothing was overwritten; sync again to use the latest copy");
    App.lastCloudSyncError = { code: error.code, message: error.message, at: new Date().toISOString() };
    throw error;
  }
}

/** The signed-in staff session's app user, as issued by staff-login (null for legacy-key devices). */
function sessionAppUser() {
  return getStoredAuthSession()?.app_user || null;
}

/** Non-manager sessions upload only their own offline collections, validated by the server. */
async function submitOwnCollections(serverCollectionIds) {
  const { url, bearer } = await snapshotAuth();
  const userId = sessionAppUser()?.id || currentUser()?.id || "";
  const items = pendingCollectionSubmissions(App.state, { userId, serverCollectionIds });
  const totals = { accepted: 0, duplicates: 0, rejected: 0 };
  for (const batch of submissionBatches(items)) {
    const response = await fetchWithTimeout(`${url}/rest/v1/rpc/st_submit_collections`, {
      method: "POST",
      cache: "no-store",
      headers: cloudHeaders(bearer, { "Content-Type": "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" }),
      body: JSON.stringify({ p_business_code: businessId(), p_items: batch })
    }, 60000);
    if (!response.ok) throw await responseError(response, "Collection upload failed");
    const counts = applySubmissionResult(App.state, await response.json());
    Object.keys(totals).forEach((key) => { totals[key] += counts[key]; });
  }
  return totals;
}

export async function latestCloudSnapshot() {
  const mode = getSyncMode(App.state);
  if (mode === "local") return latestLocalSnapshot();
  if (mode === "supabase") return latestSupabaseSnapshot();
  throw new Error("Cloud sync is not configured");
}

export const CLOUD_READ_FAILED = "cloud-read-failed";
export const CLOUD_BOOTSTRAP_REQUIRED = "cloud-bootstrap-required";
export const CLOUD_UPLOADS_PAUSED = "cloud-uploads-paused";
export const CLOUD_UPDATE_REFUSED = "cloud-update-refused";
export const CLOUD_UPDATE_CONFLICT = "cloud-update-conflict";

let uploadsInFlight = 0;

/**
 * Stops every snapshot upload from this page until it is reloaded. Set while the initial cloud
 * snapshot is created so the device-normalized copy (default products, system accounts, device
 * fields) is never written over the database-built copy by a queued or in-flight push.
 */
export function pauseCloudUploads() {
  App.cloudUploadsPaused = true;
  clearTimeout(App.syncTimer);
}

export function resumeCloudUploads() {
  App.cloudUploadsPaused = false;
}

export function cloudUploadsPaused() {
  return App.cloudUploadsPaused === true;
}

export async function waitForCloudUploadsIdle(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (uploadsInFlight > 0) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

function syncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * The three cloud states are never conflated: `{ status: "exists" }`, `{ status: "missing" }`
 * (the read succeeded and found no row), or a thrown CLOUD_READ_FAILED error.
 */
export async function readCloudSnapshotState() {
  let snapshot;
  try {
    snapshot = await latestCloudSnapshot();
  } catch (error) {
    throw syncError(CLOUD_READ_FAILED, `Could not read the cloud copy (${error.message}). Nothing was uploaded and this device's data stays here; check the connection and try again.`);
  }
  return snapshot ? { status: "exists", snapshot } : { status: "missing", snapshot: null };
}

async function saveCloudSnapshot(savedAt, cloudRow) {
  const mode = getSyncMode(App.state);
  if (mode === "local") {
    await saveLocalSnapshot(savedAt);
    return;
  }
  if (mode === "supabase") {
    await saveSupabaseSnapshot(savedAt, cloudRow);
    return;
  }
  throw new Error("Cloud sync is not configured");
}

export function queueCloudBackup(callback) {
  clearTimeout(App.syncTimer);
  App.syncTimer = setTimeout(() => callback(true), 3500);
}

export async function pushCloudBackup(silent = false) {
  if (cloudUploadsPaused()) {
    if (!silent) throw syncError(CLOUD_UPLOADS_PAUSED, "Cloud uploads are paused on this device after the initial cloud snapshot. Close and reopen the app before syncing.");
    return;
  }
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
  uploadsInFlight += 1;
  try {
    const cloud = await readCloudSnapshotState();
    const snapshot = cloud.snapshot;
    const appUser = sessionAppUser();
    const collectorSession = getSyncMode(App.state) === "supabase" && appUser && !canWriteSnapshot(appUser.role);
    if (cloud.status === "missing" && getSyncMode(App.state) === "supabase") {
      throw syncError(CLOUD_BOOTSTRAP_REQUIRED, collectorSession
        ? "This business has no cloud copy yet; collections stay queued on this device until a manager creates the initial cloud snapshot"
        : "No cloud copy exists yet, so nothing was uploaded. A manager must create the initial cloud snapshot from Backup & Restore.");
    }
    const serverCollectionIds = (snapshot?.payload?.collections || []).map((item) => item?.id).filter(Boolean);
    if (snapshot?.payload) {
      const merged = mergeStates(App.state, snapshot.payload);
      merged.users = restoreUsersFromCloud(App.state.users, merged.users);
      App.state = normalizeState(merged);
    }
    await shrinkStateMedia(App.state);
    const savedAt = new Date().toISOString();
    if (collectorSession) {
      await submitOwnCollections(serverCollectionIds);
    } else {
      await saveCloudSnapshot(savedAt, snapshot);
    }
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
    uploadsInFlight -= 1;
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
