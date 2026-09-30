/**
 * staff-login request handler (runtime-agnostic; Deno entry point is index.ts).
 *
 * Verifies a staff member's username/password (and TOTP when enabled) against the server copy of
 * the business snapshot, then issues a per-user Supabase Auth session whose app_metadata carries
 * business_code / app_user_id / app_role. Database policies (migration 046) authorize by those
 * claims. The service-role key is read from the function environment only and never returned.
 */
import {
  evaluateStaffLogin,
  findStaffUser,
  isValidBusinessCode,
  normalizeUsername
} from "./auth-core.js";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function randomSecret(bytes = 32) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createStaffLoginHandler({ env, fetchImpl = fetch, now = () => Date.now() }) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = env.SUPABASE_ANON_KEY || "";
  const emailDomain = env.STAFF_EMAIL_DOMAIN || "staff.smile-trust.invalid";

  const serviceHeaders = (extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra
  });

  async function rest(path, options = {}) {
    const response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, { ...options, headers: serviceHeaders(options.headers) });
    if (!response.ok) throw new Error(`rest ${path.split("?")[0]} ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function recentFailures(businessCode, usernameKey) {
    const since = new Date(now() - WINDOW_MS).toISOString();
    const rows = await rest(`st_staff_login_attempts?business_code=eq.${encodeURIComponent(businessCode)}&username_key=eq.${encodeURIComponent(usernameKey)}&succeeded=is.false&attempted_at=gte.${encodeURIComponent(since)}&select=id&limit=${MAX_FAILURES}`);
    return Array.isArray(rows) ? rows.length : 0;
  }

  async function recordAttempt(businessCode, usernameKey, succeeded) {
    await rest("st_staff_login_attempts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ business_code: businessCode, username_key: usernameKey, succeeded })
    }).catch(() => {});
  }

  async function loadSnapshot(businessCode) {
    const rows = await rest(`smile_trust_cloud_snapshots?business_id=eq.${encodeURIComponent(businessCode)}&select=payload&order=saved_at.desc&limit=1`);
    return rows?.[0]?.payload || null;
  }

  async function serverMfaSecret(businessCode, userId) {
    try {
      const businesses = await rest(`businesses?or=(code.eq.${encodeURIComponent(businessCode)},legacy_code.eq.${encodeURIComponent(businessCode)})&select=id&limit=1`);
      const businessId = businesses?.[0]?.id;
      if (!businessId) return "";
      const rows = await rest(`user_mfa_secrets?business_id=eq.${businessId}&user_client_id=eq.${encodeURIComponent(userId)}&enabled=is.true&select=secret&limit=1`);
      return rows?.[0]?.secret || "";
    } catch {
      return "";
    }
  }

  async function authAdmin(path, method, body) {
    const response = await fetchImpl(`${baseUrl}/auth/v1/admin/${path}`, {
      method,
      headers: serviceHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  async function ensureAuthUser(businessCode, user, password) {
    const appMetadata = { business_code: businessCode, app_user_id: user.id, app_role: user.role || "" };
    const links = await rest(`st_staff_auth_links?business_code=eq.${encodeURIComponent(businessCode)}&app_user_id=eq.${encodeURIComponent(user.id)}&select=auth_user_id&limit=1`);
    const email = `${(await sha256Hex(`${businessCode}:${user.id}`)).slice(0, 32)}@${emailDomain}`;
    const linked = links?.[0]?.auth_user_id;
    if (linked) {
      const updated = await authAdmin(`users/${linked}`, "PUT", { password, app_metadata: appMetadata, ban_duration: "none" });
      if (updated.ok) return updated.data?.email || email;
      if (updated.status !== 404) throw new Error(`auth update ${updated.status}`);
      await rest(`st_staff_auth_links?business_code=eq.${encodeURIComponent(businessCode)}&app_user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE" });
    }
    const created = await authAdmin("users", "POST", { email, password, email_confirm: true, app_metadata: appMetadata });
    if (!created.ok || !created.data?.id) throw new Error(`auth create ${created.status}`);
    await rest("st_staff_auth_links", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ business_code: businessCode, app_user_id: user.id, auth_user_id: created.data.id, updated_at: new Date(now()).toISOString() })
    });
    return email;
  }

  async function banLinkedUser(businessCode, userId) {
    try {
      const links = await rest(`st_staff_auth_links?business_code=eq.${encodeURIComponent(businessCode)}&app_user_id=eq.${encodeURIComponent(userId)}&select=auth_user_id&limit=1`);
      if (links?.[0]?.auth_user_id) await authAdmin(`users/${links[0].auth_user_id}`, "PUT", { ban_duration: "876000h" });
    } catch { /* best effort */ }
  }

  async function issueSession(email, password) {
    const response = await fetchImpl(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(`token ${response.status}`);
    return data;
  }

  return async function handle(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return json(405, { error: "Method not allowed" });
    if (!baseUrl || !serviceKey || !anonKey) return json(500, { error: "Staff login is not configured on the server" });

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Invalid request" });
    }
    const businessCode = String(body?.business_code || "");
    const usernameKey = normalizeUsername(body?.username);
    const password = typeof body?.password === "string" ? body.password : "";
    const mfaCode = String(body?.mfa_code || "");
    if (!isValidBusinessCode(businessCode) || !usernameKey || usernameKey.length > 80 || !password || password.length > 256) {
      return json(400, { error: "Invalid request" });
    }

    try {
      if ((await recentFailures(businessCode, usernameKey)) >= MAX_FAILURES) {
        return json(429, { error: "Too many failed sign-in attempts. Try again in 15 minutes." });
      }
      const payload = await loadSnapshot(businessCode);
      const user = findStaffUser(payload, usernameKey);
      const mfaSecret = user && !user.mfaSecret && user.mfaEnabled ? await serverMfaSecret(businessCode, user.id) : "";
      const verdict = await evaluateStaffLogin({ user, password, mfaCode, mfaSecret, now: now() });
      if (!verdict.ok) {
        if (verdict.reason !== "mfa_required") await recordAttempt(businessCode, usernameKey, false);
        if (!user && payload) {
          const inactive = (payload.users || []).find((item) => normalizeUsername(item?.username) === usernameKey);
          if (inactive?.id) await banLinkedUser(businessCode, inactive.id);
        }
        return json(401, { error: verdict.error, mfa_required: Boolean(verdict.mfaRequired) });
      }

      let session;
      for (let attempt = 0; attempt < 2 && !session; attempt += 1) {
        const temporary = randomSecret();
        const email = await ensureAuthUser(businessCode, user, temporary);
        session = await issueSession(email, temporary).catch(() => null);
      }
      if (!session) return json(502, { error: "Could not start a cloud session. Try again." });
      await recordAttempt(businessCode, usernameKey, true);
      return json(200, {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type || "bearer",
        app_user: { id: user.id, username: user.username, role: user.role || "" }
      });
    } catch {
      return json(503, { error: "Cloud sign-in is temporarily unavailable" });
    }
  };
}
