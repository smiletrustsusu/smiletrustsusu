/**
 * staff-login request handler (runtime-agnostic; Deno entry point is index.ts).
 *
 * Verifies a staff member's username/password (and TOTP when enabled) against the server copy of
 * the business snapshot, or against public.app_users when the snapshot has no such user, then
 * issues a per-user Supabase Auth session whose app_metadata carries business_code / app_user_id /
 * app_role. Database policies (migration 046) authorize by those claims.
 *
 * Existing app_users rows that have never had a password are adopted with a one-time activation
 * code (public.st_issue_staff_activation): the member chooses their own password, the row keeps
 * its uuid, and nothing else about it changes. There is no password-reset path here.
 *
 * Server keys are read from the function environment only and never returned.
 */
import {
  activationCodeHash,
  evaluateStaffLogin,
  findStaffUser,
  hashPasswordPbkdf2,
  isPlainUsername,
  isUsablePasswordHash,
  isValidBusinessCode,
  normalizeActivationCode,
  normalizeUsername,
  staffUserFromAppUserRow,
  validateNewStaffPassword
} from "./auth-core.js";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const INVALID_ACTIVATION = "Activation code is invalid or has expired.";

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

function sameHex(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Legacy JWT keys go in both headers; sb_publishable_/sb_secret_ keys only in apikey. */
function keyHeaders(key) {
  return String(key).startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

export function createStaffLoginHandler({ env, fetchImpl = fetch, now = () => Date.now() }) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = env.STAFF_LOGIN_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = env.STAFF_LOGIN_PUBLIC_KEY || env.SUPABASE_ANON_KEY || "";
  const emailDomain = env.STAFF_EMAIL_DOMAIN || "staff.smile-trust.invalid";

  const serviceHeaders = (extra = {}) => ({
    ...keyHeaders(serviceKey),
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

  async function businessUuid(businessCode) {
    const rows = await rest(`businesses?or=(code.eq.${encodeURIComponent(businessCode)},legacy_code.eq.${encodeURIComponent(businessCode)})&select=id&limit=1`);
    return rows?.[0]?.id || "";
  }

  async function serverMfaSecret(businessCode, userId) {
    try {
      const businessId = await businessUuid(businessCode);
      if (!businessId) return "";
      const rows = await rest(`user_mfa_secrets?business_id=eq.${businessId}&user_client_id=eq.${encodeURIComponent(userId)}&enabled=is.true&select=secret&limit=1`);
      return rows?.[0]?.secret || "";
    } catch {
      return "";
    }
  }

  async function loadAppUser(businessCode, usernameKey) {
    if (!isPlainUsername(usernameKey)) return null;
    const businessId = await businessUuid(businessCode);
    if (!businessId) return null;
    const rows = await rest(`app_users?business_id=eq.${businessId}&username=ilike.${encodeURIComponent(usernameKey)}&select=id,client_id,username,name,role,active,password_hash&limit=5`);
    const row = (rows || []).find((item) => normalizeUsername(item?.username) === usernameKey);
    if (!row) return null;
    const user = staffUserFromAppUserRow(row);
    const mfaSecret = await serverMfaSecret(businessCode, user.id);
    return { ...user, mfaEnabled: Boolean(mfaSecret), serverMfaSecret: mfaSecret };
  }

  /**
   * app_users is authoritative when its row has a password hash (migration 046 makes hashes and
   * roles unwritable by staff sessions). Otherwise the snapshot copy is used. A deactivation in
   * either source denies sign-in. Accounts with no usable password anywhere can only be activated.
   * @returns {{ user: object|null, inactiveId?: string, activatable?: object }}
   */
  async function resolveStaffUser(businessCode, usernameKey) {
    const payload = await loadSnapshot(businessCode);
    const listed = (payload?.users || []).find((item) => normalizeUsername(item?.username) === usernameKey);
    const snapshotUser = listed ? findStaffUser(payload, usernameKey) : null;
    if (listed && !snapshotUser) return { user: null, inactiveId: listed.id };
    const appUser = await loadAppUser(businessCode, usernameKey);
    if (appUser && (!appUser.active || appUser.role === "Developer")) return { user: null, inactiveId: appUser.id };
    if (appUser?.passwordHash) return { user: appUser };
    if (snapshotUser && isUsablePasswordHash(snapshotUser.passwordHash)) return { user: snapshotUser };
    if (appUser) return { user: null, activatable: appUser };
    return { user: null };
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

  async function startSession(businessCode, usernameKey, user) {
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
  }

  async function handleLogin(body, businessCode, usernameKey) {
    const password = typeof body?.password === "string" ? body.password : "";
    const mfaCode = String(body?.mfa_code || "");
    if (!password || password.length > 256) return json(400, { error: "Invalid request" });
    const { user, inactiveId } = await resolveStaffUser(businessCode, usernameKey);
    const mfaSecret = user?.serverMfaSecret
      || (user && !user.mfaSecret && user.mfaEnabled ? await serverMfaSecret(businessCode, user.id) : "");
    const verdict = await evaluateStaffLogin({ user, password, mfaCode, mfaSecret, now: now() });
    if (!verdict.ok) {
      if (verdict.reason !== "mfa_required") await recordAttempt(businessCode, usernameKey, false);
      if (!user && inactiveId) await banLinkedUser(businessCode, inactiveId);
      return json(401, { error: verdict.error, mfa_required: Boolean(verdict.mfaRequired) });
    }
    return startSession(businessCode, usernameKey, user);
  }

  async function handleActivation(body, businessCode, usernameKey) {
    const code = normalizeActivationCode(body?.activation_code);
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
    const mfaCode = String(body?.mfa_code || "");
    if (code.length < 8 || code.length > 32) return json(400, { error: "Invalid request" });
    const weak = validateNewStaffPassword(newPassword);
    if (weak) return json(400, { error: weak });

    const { activatable } = await resolveStaffUser(businessCode, usernameKey);
    if (!activatable) {
      await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: INVALID_ACTIVATION });
    }
    const nowIso = new Date(now()).toISOString();
    const codes = await rest(`st_staff_activation_codes?app_user_uuid=eq.${activatable.uuid}&used_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}&select=id,code_hash&order=created_at.desc&limit=5`);
    const expected = await activationCodeHash(activatable.uuid, code);
    const match = (codes || []).find((row) => sameHex(row.code_hash, expected));
    if (!match) {
      await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: INVALID_ACTIVATION });
    }

    const passwordHash = await hashPasswordPbkdf2(newPassword);
    const candidate = { ...activatable, passwordHash };
    const verdict = await evaluateStaffLogin({ user: candidate, password: newPassword, mfaCode, mfaSecret: activatable.serverMfaSecret, now: now() });
    if (!verdict.ok) {
      if (verdict.reason !== "mfa_required") await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: verdict.error, mfa_required: Boolean(verdict.mfaRequired) });
    }

    // Only sets a password where none exists; a concurrent activation or an existing hash wins.
    const updated = await rest(`app_users?id=eq.${activatable.uuid}&or=(password_hash.is.null,password_hash.eq.)`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ password_hash: passwordHash, updated_at: nowIso })
    });
    if (!Array.isArray(updated) || updated.length !== 1) {
      await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: INVALID_ACTIVATION });
    }
    await rest(`st_staff_activation_codes?id=eq.${match.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ used_at: nowIso })
    });
    await rest(`st_staff_activation_codes?app_user_uuid=eq.${activatable.uuid}&used_at=is.null`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ expires_at: nowIso })
    }).catch(() => {});
    return startSession(businessCode, usernameKey, candidate);
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
    const action = String(body?.action || "login");
    if (!isValidBusinessCode(businessCode) || !usernameKey || usernameKey.length > 80 || !["login", "activate"].includes(action)) {
      return json(400, { error: "Invalid request" });
    }

    try {
      if ((await recentFailures(businessCode, usernameKey)) >= MAX_FAILURES) {
        return json(429, { error: "Too many failed sign-in attempts. Try again in 15 minutes." });
      }
      return action === "activate"
        ? await handleActivation(body, businessCode, usernameKey)
        : await handleLogin(body, businessCode, usernameKey);
    } catch {
      return json(503, { error: "Cloud sign-in is temporarily unavailable" });
    }
  };
}
