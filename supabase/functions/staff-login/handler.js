/**
 * staff-login request handler (runtime-agnostic; Deno entry point is index.ts).
 *
 * Verifies a staff member's username/password (and TOTP) against public.app_users — the only
 * authority for password, role and active status; the client-written snapshot is never read —
 * then issues a per-user Supabase Auth session whose app_metadata carries business_code /
 * app_user_id / app_role. Database policies (migrations 046/047) authorize by those claims and
 * re-check the live app_users row on every request.
 *
 * Existing app_users rows that have never had a password are adopted with a one-time activation
 * code (public.st_issue_staff_activation): the member chooses their own password, the row keeps
 * its uuid, and nothing else about it changes. There is no password-reset path here.
 *
 * Privileged roles (MFA_REQUIRED_ROLES) receive no session until they have confirmed a TOTP
 * authenticator: action "mfa_enroll_start" (password) stores a pending secret server-side and
 * shows it once; "mfa_enroll_confirm" (password + current code) enables it and signs in. An
 * enabled authenticator can only be removed by an owner (public.st_reset_staff_mfa).
 *
 * Server keys are read from the function environment only and never returned.
 */
import {
  MFA_REQUIRED_ROLES,
  activationCodeHash,
  evaluateStaffLogin,
  generateTotpSecretBase32,
  hashPasswordPbkdf2,
  isPlainUsername,
  isValidBusinessCode,
  normalizeActivationCode,
  normalizeUsername,
  staffUserFromAppUserRow,
  totpMatchStep,
  totpProvisioningUri,
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

  async function businessUuid(businessCode) {
    const rows = await rest(`businesses?or=(code.eq.${encodeURIComponent(businessCode)},legacy_code.eq.${encodeURIComponent(businessCode)})&select=id&limit=1`);
    return rows?.[0]?.id || "";
  }

  /** The user's server-side TOTP row ({ secret, enabled, last_used_step }) or null. Never returned to clients. */
  async function mfaRow(businessId, userId) {
    const rows = await rest(`user_mfa_secrets?business_id=eq.${businessId}&user_client_id=eq.${encodeURIComponent(userId)}&select=secret,enabled,last_used_step,updated_at&limit=1`);
    return rows?.[0] || null;
  }

  async function loadAppUser(businessCode, usernameKey) {
    if (!isPlainUsername(usernameKey)) return null;
    const businessId = await businessUuid(businessCode);
    if (!businessId) return null;
    const rows = await rest(`app_users?business_id=eq.${businessId}&username=ilike.${encodeURIComponent(usernameKey)}&select=id,client_id,username,name,role,active,password_hash&limit=5`);
    const row = (rows || []).find((item) => normalizeUsername(item?.username) === usernameKey);
    if (!row) return null;
    const user = staffUserFromAppUserRow(row);
    const mfa = await mfaRow(businessId, user.id);
    return { ...user, businessId, mfa: mfa?.enabled === true && mfa.secret ? mfa : null, pendingMfa: mfa && mfa.enabled !== true ? mfa : null };
  }

  /**
   * public.app_users is the only source of staff identity, password, role and active status.
   * Accounts with no password can only be activated.
   * @returns {{ user: object|null, inactiveId?: string, activatable?: object }}
   */
  async function resolveStaffUser(businessCode, usernameKey) {
    const appUser = await loadAppUser(businessCode, usernameKey);
    if (!appUser) return { user: null };
    if (!appUser.active || appUser.role === "Developer") return { user: null, inactiveId: appUser.id };
    if (appUser.passwordHash) return { user: appUser };
    return { user: null, activatable: appUser };
  }

  async function securityEvent(businessCode, userId, event, details = {}) {
    await rest("st_staff_security_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ business_code: businessCode, app_user_id: userId, event, actor: userId, details })
    }).catch(() => {});
  }

  /** Atomically records the TOTP step so the same code cannot be used twice. */
  async function claimMfaStep(user, step) {
    const updated = await rest(
      `user_mfa_secrets?business_id=eq.${user.businessId}&user_client_id=eq.${encodeURIComponent(user.id)}&enabled=is.true&or=(last_used_step.is.null,last_used_step.lt.${step})`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ last_used_step: step, updated_at: new Date(now()).toISOString() }) }
    );
    return Array.isArray(updated) && updated.length === 1;
  }

  function verdictResponse(verdict) {
    if (verdict.mfaEnrollmentRequired) return json(403, { error: verdict.error, mfa_enrollment_required: true });
    return json(401, { error: verdict.error, mfa_required: Boolean(verdict.mfaRequired) });
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
    const verdict = await evaluateStaffLogin({
      user, password, mfaCode, mfaSecret: user?.mfa?.secret || "", lastUsedStep: user?.mfa?.last_used_step ?? null, now: now()
    });
    if (!verdict.ok) {
      if (!["mfa_required", "mfa_enrollment_required"].includes(verdict.reason)) await recordAttempt(businessCode, usernameKey, false);
      if (!user && inactiveId) await banLinkedUser(businessCode, inactiveId);
      return verdictResponse(verdict);
    }
    if (verdict.mfaStep != null && !(await claimMfaStep(user, verdict.mfaStep))) {
      await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: "That MFA code was already used. Wait for the next code.", mfa_required: true });
    }
    return startSession(businessCode, usernameKey, user);
  }

  /** Password-verified, privileged, active staff without an enabled authenticator. */
  async function enrollmentCandidate(body, businessCode, usernameKey) {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || password.length > 256) return { response: json(400, { error: "Invalid request" }) };
    const { user } = await resolveStaffUser(businessCode, usernameKey);
    const verdict = await evaluateStaffLogin({ user, password, now: now() });
    if (verdict.reason === "unknown_user" || verdict.reason === "bad_password") {
      await recordAttempt(businessCode, usernameKey, false);
      return { response: json(401, { error: verdict.error }) };
    }
    if (!MFA_REQUIRED_ROLES.includes(user.role)) return { response: json(400, { error: "Two-factor setup is not required for this role." }) };
    if (user.mfa) return { response: json(409, { error: "Two-factor authentication is already set up. Ask the System Owner to reset it if you lost your device." }) };
    return { user };
  }

  async function handleMfaEnrollStart(body, businessCode, usernameKey) {
    const { user, response } = await enrollmentCandidate(body, businessCode, usernameKey);
    if (response) return response;
    const secret = generateTotpSecretBase32();
    await rest("user_mfa_secrets?on_conflict=business_id,user_client_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ business_id: user.businessId, user_client_id: user.id, secret, enabled: false, confirmed_at: null, last_used_step: null, updated_at: new Date(now()).toISOString() })
    });
    await securityEvent(businessCode, user.id, "mfa_enroll_started");
    return json(200, {
      mfa_enrollment_pending: true,
      secret,
      otpauth_uri: totpProvisioningUri(secret, { account: `${user.username}@${businessCode}` })
    });
  }

  async function handleMfaEnrollConfirm(body, businessCode, usernameKey) {
    const { user, response } = await enrollmentCandidate(body, businessCode, usernameKey);
    if (response) return response;
    const pending = user.pendingMfa;
    const step = pending?.secret ? await totpMatchStep(pending.secret, body?.mfa_code, { now: now() }) : -1;
    if (step < 0) {
      await recordAttempt(businessCode, usernameKey, false);
      return json(401, { error: pending ? "Invalid MFA code" : "Start two-factor setup first.", mfa_required: Boolean(pending) });
    }
    const nowIso = new Date(now()).toISOString();
    const enabled = await rest(
      `user_mfa_secrets?business_id=eq.${user.businessId}&user_client_id=eq.${encodeURIComponent(user.id)}&enabled=is.false&updated_at=eq.${encodeURIComponent(pending.updated_at)}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ enabled: true, confirmed_at: nowIso, last_used_step: step, updated_at: nowIso }) }
    );
    if (!Array.isArray(enabled) || enabled.length !== 1) return json(409, { error: "Two-factor setup changed. Start again." });
    await securityEvent(businessCode, user.id, "mfa_enrolled");
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
    const verdict = await evaluateStaffLogin({
      user: candidate, password: newPassword, mfaCode, mfaSecret: activatable.mfa?.secret || "", lastUsedStep: activatable.mfa?.last_used_step ?? null, now: now()
    });
    const needsEnrollment = verdict.reason === "mfa_enrollment_required";
    if (!verdict.ok && !needsEnrollment) {
      if (verdict.reason !== "mfa_required") await recordAttempt(businessCode, usernameKey, false);
      return verdictResponse(verdict);
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
    await securityEvent(businessCode, activatable.id, "activated");
    if (needsEnrollment) return verdictResponse(verdict);
    if (verdict.mfaStep != null && !(await claimMfaStep(activatable, verdict.mfaStep))) {
      return json(401, { error: "That MFA code was already used. Sign in with the next code.", mfa_required: true });
    }
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
    const handlers = {
      login: handleLogin,
      activate: handleActivation,
      mfa_enroll_start: handleMfaEnrollStart,
      mfa_enroll_confirm: handleMfaEnrollConfirm
    };
    if (!isValidBusinessCode(businessCode) || !usernameKey || usernameKey.length > 80 || !Object.hasOwn(handlers, action)) {
      return json(400, { error: "Invalid request" });
    }

    try {
      if ((await recentFailures(businessCode, usernameKey)) >= MAX_FAILURES) {
        return json(429, { error: "Too many failed sign-in attempts. Try again in 15 minutes." });
      }
      return await handlers[action](body, businessCode, usernameKey);
    } catch {
      return json(503, { error: "Cloud sign-in is temporarily unavailable" });
    }
  };
}
