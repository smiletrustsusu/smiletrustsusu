/**
 * Low-level Supabase PostgREST client (no @supabase/supabase-js dependency).
 * Protected calls carry the signed-in staff member's JWT; the server authorizes by its claims.
 */
import { resolvedSupabaseKey, resolvedSupabaseUrl } from "../config.js";
import { backendSyncHeld } from "../core/backend-guard.js";
import { ensureFreshAccessToken, getAccessToken } from "./supabase-auth.js";
import { supabaseKeyHeaders } from "./supabase-headers.js";

export function supabaseConfigured(state) {
  const url = resolvedSupabaseUrl(state);
  const key = resolvedSupabaseKey(state);
  return Boolean(url && key && /supabase\.co/i.test(url));
}

export function restHeaders(state, { prefer = "", useUserToken = true } = {}) {
  const key = resolvedSupabaseKey(state);
  const userToken = useUserToken ? getAccessToken() : "";
  const headers = supabaseKeyHeaders(key, { bearer: userToken });
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function restFetch(state, path, { method = "GET", body, prefer = "" } = {}) {
  const url = `${resolvedSupabaseUrl(state)}/rest/v1/${path}`;
  await ensureFreshAccessToken(state).catch(() => "");
  if (!getAccessToken() && backendSyncHeld(typeof localStorage !== "undefined" ? localStorage : null)) {
    throw new Error("Sign in online to start syncing with this server");
  }
  const response = await fetch(url, {
    method,
    headers: restHeaders(state, { prefer }),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text.slice(0, 200)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function tenantHeaders(state) {
  return {
    businessId: state.settings?.businessId || ""
  };
}
