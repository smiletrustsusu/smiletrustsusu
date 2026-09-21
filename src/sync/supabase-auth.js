/**
 * Supabase Auth REST API (no @supabase/supabase-js).
 */
import { resolvedSupabaseKey, resolvedSupabaseUrl } from "../config.js";

const SESSION_KEY = "smile_trust_supabase_session";

export function supabaseAuthConfigured(state) {
  return Boolean(resolvedSupabaseUrl(state) && resolvedSupabaseKey(state) && state.settings?.supabaseAuthEnabled);
}

export function getStoredAuthSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function storeAuthSession(session) {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Date.now() + Number(session.expires_in || 3600) * 1000,
    user: session.user || null
  }));
}

export function clearAuthSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getAccessToken() {
  const session = getStoredAuthSession();
  if (!session?.access_token) return "";
  if (session.expires_at && Date.now() > session.expires_at - 60000) return "";
  return session.access_token;
}

export async function signInWithPassword(state, email, password) {
  const url = `${resolvedSupabaseUrl(state)}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: resolvedSupabaseKey(state),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.error_description || data.error || "Auth failed");
  }
  storeAuthSession(data);
  return data;
}

export async function signOut(state) {
  const token = getAccessToken();
  if (token) {
    await fetch(`${resolvedSupabaseUrl(state)}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: resolvedSupabaseKey(state),
        Authorization: `Bearer ${token}`
      }
    }).catch(() => {});
  }
  clearAuthSession();
}

/**
 * Refresh access token using the stored (or provided) refresh_token.
 */
export async function refreshAuthSession(state, refreshToken) {
  const existing = getStoredAuthSession();
  const token = refreshToken || existing?.refresh_token;
  if (!token) throw new Error("No refresh token available");
  const url = `${resolvedSupabaseUrl(state)}/auth/v1/token?grant_type=refresh_token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: resolvedSupabaseKey(state),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: token })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    clearAuthSession();
    throw new Error(data.msg || data.error_description || data.error || "Refresh failed");
  }
  storeAuthSession(data);
  return data;
}

/**
 * Request a password-recovery email via Supabase Auth (optional cloud path).
 */
export async function requestPasswordRecovery(state, email, redirectTo = "") {
  const url = `${resolvedSupabaseUrl(state)}/auth/v1/recover`;
  const body = { email: String(email || "").trim() };
  if (redirectTo) body.redirect_to = redirectTo;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: resolvedSupabaseKey(state),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.error_description || data.error || "Password recovery failed");
  }
  return { ok: true, data };
}

/**
 * Proactively refresh when the access token is within 60s of expiry.
 */
export async function ensureFreshAccessToken(state) {
  const session = getStoredAuthSession();
  if (!session?.access_token) return "";
  if (session.expires_at && Date.now() > session.expires_at - 60000) {
    if (!session.refresh_token) {
      clearAuthSession();
      return "";
    }
    await refreshAuthSession(state, session.refresh_token);
  }
  return getAccessToken();
}

export function mapAppUserFromAuthSession(session, appUsers = []) {
  const authId = session?.user?.id;
  if (!authId) return null;
  return appUsers.find((user) => user.authUserId === authId || user.supabaseUserId === authId) || null;
}
