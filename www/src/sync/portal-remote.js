/**
 * Member portal backed by server RPCs (migration 046). The device never downloads the business
 * snapshot for a member: the server checks the PIN and returns only that member's records.
 */
import { resolveBusinessId, resolvedSupabaseKey, resolvedSupabaseUrl } from "../config.js";
import { restFetch } from "./supabase-rest.js";

export const PORTAL_SESSION_KEY = "smile_trust_portal_session";

function portalStore() {
  return typeof sessionStorage !== "undefined" ? sessionStorage : null;
}

export function portalServerAvailable(state) {
  return Boolean(resolvedSupabaseUrl(state) && resolvedSupabaseKey(state));
}

async function publicRpc(state, name, body, fetchImpl = globalThis.fetch) {
  const key = resolvedSupabaseKey(state);
  let response;
  try {
    response = await fetchImpl(`${resolvedSupabaseUrl(state)}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, offline: true, error: "Portal is offline. Check your internet connection." };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, unavailable: response.status === 404, status: response.status, error: "Portal is temporarily unavailable." };
  }
  return data && typeof data === "object" ? data : { ok: false, error: "Portal is temporarily unavailable." };
}

export function storedPortalSession() {
  try {
    return JSON.parse(portalStore()?.getItem(PORTAL_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function savePortalSession(session) {
  portalStore()?.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
}

export function clearPortalSession() {
  portalStore()?.removeItem(PORTAL_SESSION_KEY);
}

export async function portalServerLogin(state, loginId, pin, { fetchImpl } = {}) {
  const result = await publicRpc(state, "portal_login", {
    p_business_code: resolveBusinessId(state),
    p_login_id: String(loginId || "").trim(),
    p_pin: String(pin || "").trim()
  }, fetchImpl);
  if (result.ok && result.token) {
    savePortalSession({ token: result.token, expires_at: result.expires_at, bundle: result.bundle });
  }
  return result;
}

export async function portalServerRefresh(state, { fetchImpl } = {}) {
  const session = storedPortalSession();
  if (!session?.token) return { ok: false, error: "Session expired. Please sign in again." };
  const result = await publicRpc(state, "portal_refresh", { p_token: session.token }, fetchImpl);
  if (result.ok) savePortalSession({ ...session, expires_at: result.expires_at, bundle: result.bundle });
  else if (!result.offline) clearPortalSession();
  return result;
}

export async function portalServerChangePin(state, currentPin, newPin, { fetchImpl } = {}) {
  const session = storedPortalSession();
  if (!session?.token) return { ok: false, error: "Session expired. Please sign in again." };
  return publicRpc(state, "portal_change_pin", {
    p_token: session.token,
    p_current_pin: String(currentPin || "").trim(),
    p_new_pin: String(newPin || "").trim()
  }, fetchImpl);
}

export async function portalServerRequestWithdrawal(state, amount, reason, { fetchImpl } = {}) {
  const session = storedPortalSession();
  if (!session?.token) return { ok: false, error: "Session expired. Please sign in again." };
  return publicRpc(state, "portal_request_withdrawal", {
    p_token: session.token,
    p_amount: Number(amount),
    p_reason: String(reason || "")
  }, fetchImpl);
}

/** Member-only state for the existing portal renderers. */
export function portalStateFromBundle(bundle = {}) {
  const customer = bundle.customer || null;
  return {
    settings: { ...(bundle.settings || {}) },
    customers: customer ? [customer] : [],
    collections: bundle.collections || [],
    transactions: bundle.transactions || [],
    loans: bundle.loans || [],
    notifications: bundle.notifications || [],
    withdrawalRequests: bundle.withdrawalRequests || [],
    ledgerEntries: bundle.ledgerEntries || []
  };
}

export function portalRequestWithdrawalId(requestId) {
  return `wdr-portal-${requestId}`;
}

/**
 * Staff side: turn pending portal requests into normal withdrawal requests.
 * `createRequest(row, withdrawalId)` returns { error } or a truthy result. Returns ids that are now
 * represented locally; mark them ingested only after the snapshot containing them has uploaded.
 */
export async function ingestPortalRequests(state, createRequest) {
  let rows;
  try {
    rows = await restFetch(state, "rpc/portal_pending_requests", {
      method: "POST",
      body: { p_business_code: resolveBusinessId(state) }
    });
  } catch (error) {
    return { ok: false, error: error.message, ids: [], created: 0 };
  }
  const ids = [];
  let created = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const withdrawalId = portalRequestWithdrawalId(row.id);
    if ((state.withdrawalRequests || []).some((item) => item.id === withdrawalId)) {
      ids.push(row.id);
      continue;
    }
    if (!(state.customers || []).some((item) => item.id === row.customer_id)) continue;
    const result = createRequest(row, withdrawalId);
    if (result && !result.error) {
      created += 1;
      ids.push(row.id);
    }
  }
  return { ok: true, ids, created };
}

export async function markPortalRequestsIngested(state, ids) {
  if (!ids?.length) return { ok: true, ingested: 0 };
  try {
    const result = await restFetch(state, "rpc/portal_mark_requests_ingested", {
      method: "POST",
      body: { p_business_code: resolveBusinessId(state), p_ids: ids }
    });
    return { ok: true, ...(result || {}) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
