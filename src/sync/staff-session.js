/**
 * Staff cloud session: exchange username/password for a per-user Supabase session issued by the
 * staff-login Edge Function. Cloud sync then runs with that session; the database authorizes it.
 * Offline sign-in against the local PBKDF2 hash keeps working without a network.
 */
import { getAppConfig, resolveBusinessId, resolvedSupabaseKey, resolvedSupabaseUrl } from "../config.js";
import { releaseBackendSyncHold } from "../core/backend-guard.js";
import { clearAuthSession, getStoredAuthSession, storeAuthSession } from "./supabase-auth.js";
import { supabaseKeyHeaders } from "./supabase-headers.js";

export function staffLoginUrl(state) {
  const base = resolvedSupabaseUrl(state);
  const name = getAppConfig().staffLoginFunction || "staff-login";
  return base ? `${base}/functions/v1/${name}` : "";
}

async function callStaffLogin(state, body, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const url = staffLoginUrl(state);
  const key = resolvedSupabaseKey(state);
  if (!url || !key || typeof fetchImpl !== "function") {
    return { ok: false, offline: true, error: "Cloud is not configured" };
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      // The function's CORS allow-list has no write-protocol header; it writes with its own service key.
      headers: supabaseKeyHeaders(key, { protocol: false }),
      body: JSON.stringify({ business_code: resolveBusinessId(state), ...body }),
      signal: controller?.signal
    });
  } catch {
    return { ok: false, offline: true, error: "Cloud sign-in unavailable" };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (response.ok && data.access_token) {
    storeAuthSession({ ...data, app_user: data.app_user || null });
    if (typeof localStorage !== "undefined") releaseBackendSyncHold(localStorage);
    return { ok: true, appUser: data.app_user || null };
  }
  if (response.ok && data.mfa_enrollment_pending && data.secret) {
    // Shown once so the member can add it to an authenticator app; never stored on the device.
    return { ok: false, enrollmentPending: true, secret: String(data.secret), uri: String(data.otpauth_uri || "") };
  }
  if (response.status === 404 || response.status >= 500) {
    return { ok: false, unavailable: true, status: response.status, error: data.error || "Cloud sign-in unavailable" };
  }
  return {
    ok: false,
    denied: [401, 403, 409, 429].includes(response.status),
    status: response.status,
    mfaRequired: Boolean(data.mfa_required),
    mfaEnrollmentRequired: Boolean(data.mfa_enrollment_required),
    error: data.error || "Invalid login or inactive account."
  };
}

/**
 * @returns {Promise<{ ok: boolean, appUser?: object, offline?: boolean, unavailable?: boolean,
 *   denied?: boolean, mfaRequired?: boolean, mfaEnrollmentRequired?: boolean, status?: number, error?: string }>}
 */
export async function staffCloudLogin(state, { username, password, mfaCode = "" }, options = {}) {
  return callStaffLogin(state, {
    username: String(username || "").trim(),
    password: String(password || ""),
    mfa_code: String(mfaCode || "").trim()
  }, options);
}

/**
 * First sign-in for an existing staff account that has never had a password: redeem the one-time
 * activation code from an administrator and choose a password. Same result shape as staffCloudLogin.
 */
export async function staffCloudActivate(state, { username, activationCode, newPassword, mfaCode = "" }, options = {}) {
  return callStaffLogin(state, {
    action: "activate",
    username: String(username || "").trim(),
    activation_code: String(activationCode || "").trim(),
    new_password: String(newPassword || ""),
    mfa_code: String(mfaCode || "").trim()
  }, options);
}

/**
 * Privileged roles must confirm a server-side authenticator before any cloud session.
 * Start: password -> { enrollmentPending, secret, uri } (pending secret kept only on the server).
 */
export async function staffMfaEnrollStart(state, { username, password }, options = {}) {
  return callStaffLogin(state, {
    action: "mfa_enroll_start",
    username: String(username || "").trim(),
    password: String(password || "")
  }, options);
}

/** Confirm: password + current authenticator code -> same result shape as staffCloudLogin. */
export async function staffMfaEnrollConfirm(state, { username, password, mfaCode }, options = {}) {
  return callStaffLogin(state, {
    action: "mfa_enroll_confirm",
    username: String(username || "").trim(),
    password: String(password || ""),
    mfa_code: String(mfaCode || "").trim()
  }, options);
}

/** True when this device holds a refreshable session for the given app user (or any user). */
export function hasStaffCloudSession(userId = "") {
  const session = getStoredAuthSession();
  if (!session?.refresh_token) return false;
  return !userId || !session.app_user?.id || session.app_user.id === userId;
}

export function clearStaffCloudSession() {
  clearAuthSession();
}
