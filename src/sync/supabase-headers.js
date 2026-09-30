/**
 * Request headers for Supabase. Legacy anon keys are JWTs and may double as the bearer token.
 * New API keys (sb_publishable_...) are not JWTs: they go only in the apikey header, and the
 * Authorization header carries a signed-in user's access token when there is one.
 */
export function isNewApiKey(key) {
  return String(key || "").startsWith("sb_");
}

export function supabaseKeyHeaders(key, { bearer = "", json = true } = {}) {
  const headers = { apikey: key };
  const token = bearer || (isNewApiKey(key) ? "" : key);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}
