/**
 * Low-level Supabase PostgREST client (no @supabase/supabase-js dependency).
 */
import { resolvedSupabaseKey, resolvedSupabaseUrl, resolvedSyncAccessKey } from "../config.js";
import { getAccessToken } from "./supabase-auth.js";

export function supabaseConfigured(state) {
  const url = resolvedSupabaseUrl(state);
  const key = resolvedSupabaseKey(state);
  return Boolean(url && key && /supabase\.co/i.test(url));
}

export function restHeaders(state, { prefer = "", useUserToken = true } = {}) {
  const key = resolvedSupabaseKey(state);
  const userToken = useUserToken ? getAccessToken() : "";
  const bearer = userToken || key;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json"
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function restFetch(state, path, { method = "GET", body, prefer = "" } = {}) {
  const url = `${resolvedSupabaseUrl(state)}/rest/v1/${path}`;
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
    accessKey: resolvedSyncAccessKey(state),
    businessId: state.settings?.businessId || ""
  };
}
