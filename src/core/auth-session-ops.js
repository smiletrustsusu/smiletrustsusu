/**
 * Wave 1 — Auth / session foundation ops.
 * Unifies local session, password lifecycle, optional Supabase auth,
 * multi-device registration hooks, and login-failure audit.
 */

import { hashPassword, verifyPassword } from "../password.js";
import {
  markSessionStarted,
  clearSession,
  sessionExpired,
  ensureActiveSession,
  SESSION_TTL_MS,
  sessionTtlMs
} from "./session.js";
import { recordAuditEvent } from "./audit-ops.js";
import { canAction, SUPER_ADMIN_FORBIDDEN, isForbiddenForSuperAdmin } from "./rbac.js";
import { isSystemOwner, ROLE } from "./roles.js";
import { authorizeDevice, revokeDevice, ensureSyncState } from "./sync-ops.js";
import { getConfigValue } from "./system-config.js";
import { buildFoundationError } from "./foundation-errors.js";
import { logSecurity, logApp } from "./foundation-logging.js";
import { secureSet, secureRemove, redactSecrets } from "./secure-storage.js";
import {
  signInWithPassword as supabaseSignIn,
  signOut as supabaseSignOut,
  getStoredAuthSession,
  storeAuthSession,
  clearAuthSession,
  getAccessToken,
  supabaseAuthConfigured
} from "../sync/supabase-auth.js";

export const AUTH_SESSION_VERSION = "1.0.0";

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function findUser(state, username) {
  const needle = String(username || "").trim().toLowerCase();
  return (state.users || []).find((user) => String(user.username || "").toLowerCase() === needle) || null;
}

function maxAttempts(state) {
  const n = Number(getConfigValue(state, "security.maxLoginAttempts") ?? state.settings?.maxLoginAttempts ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function lockMinutes(state) {
  const n = Number(getConfigValue(state, "security.lockMinutes") ?? state.settings?.lockMinutes ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

function isLocked(user, now) {
  if (!user?.lockedUntil) return false;
  return Date.parse(user.lockedUntil) > nowMs(now);
}

export function ensureAuthFoundationState(state = {}) {
  state.users = state.users || [];
  state.audit = state.audit || [];
  state.passwordResetTokens = state.passwordResetTokens || [];
  state.authSessions = state.authSessions || [];
  ensureSyncState(state);
  return state;
}

export function listAuthRoles() {
  return Object.freeze({
    SystemOwner: ROLE.SYSTEM_OWNER,
    SuperAdmin: ROLE.SUPER_ADMIN,
    BranchManager: ROLE.BRANCH_MANAGER,
    ManagingDirector: ROLE.MANAGING_DIRECTOR,
    OperationsManager: ROLE.OPERATIONS_MANAGER,
    Accountant: ROLE.ACCOUNTANT,
    Cashier: ROLE.CASHIER,
    FieldSupervisor: ROLE.FIELD_SUPERVISOR,
    Collector: ROLE.COLLECTOR,
    GroupCoordinator: ROLE.GROUP_COORDINATOR,
    CustomerService: ROLE.CUSTOMER_SERVICE,
    Auditor: ROLE.AUDITOR,
    Customer: ROLE.CUSTOMER,
    Developer: ROLE.DEVELOPER,
    legacy: {
      Admin: "Branch Manager",
      KBA: "Super Admin",
      SystemOwnerUsername: "john"
    },
    superAdminForbidden: SUPER_ADMIN_FORBIDDEN.slice()
  });
}

export async function authenticateLocal(state, { username, password, device = null } = {}, uid, now) {
  ensureAuthFoundationState(state);
  const user = findUser(state, username);
  if (!user || user.active === false) {
    recordAuditEvent(state, {
      action: "Login Failure",
      details: "Invalid login for " + String(username || ""),
      category: "authentication",
      guarantee: "G1",
      module: "1"
    }, uid);
    logSecurity(state, "Login failure", { username: String(username || "") }, uid, now);
    return buildFoundationError("FND-002");
  }
  if (isLocked(user, now)) {
    recordAuditEvent(state, {
      action: "Login Failure",
      details: "Account locked for " + user.username,
      userId: user.id,
      username: user.username,
      category: "authentication",
      guarantee: "G1",
      module: "1"
    }, uid);
    return buildFoundationError("FND-003");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= maxAttempts(state)) {
      user.lockedUntil = new Date(nowMs(now) + lockMinutes(state) * 60 * 1000).toISOString();
      recordAuditEvent(state, {
        action: "Account Locked",
        details: "Too many failed logins for " + user.username,
        userId: user.id,
        username: user.username,
        category: "authentication",
        guarantee: "G1",
        module: "1"
      }, uid);
    }
    recordAuditEvent(state, {
      action: "Login Failure",
      details: "Invalid password for " + user.username,
      userId: user.id,
      username: user.username,
      category: "authentication",
      guarantee: "G1",
      module: "1"
    }, uid);
    logSecurity(state, "Login failure", { userId: user.id }, uid, now);
    return buildFoundationError("FND-002");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = "";
  user.lastLoginAt = nowIso(now);

  if (user.mustResetPassword) {
    return buildFoundationError("FND-004", { details: { userId: user.id } });
  }

  markSessionStarted();
  const session = {
    id: "sess-" + (uid ? uid("sess") : Date.now().toString(36)),
    userId: user.id,
    username: user.username,
    role: user.role,
    deviceId: device?.id || device?.deviceId || "",
    startedAt: nowIso(now),
    expiresAt: new Date(nowMs(now) + sessionTtlMs(state.settings || {})).toISOString()
  };
  state.authSessions.push(session);

  if (device && (device.id || device.deviceId)) {
    const deviceId = device.id || device.deviceId;
    state.devices = state.devices || [];
    let row = state.devices.find((item) => item.id === deviceId || item.fingerprint === deviceId);
    if (!row) {
      row = {
        id: deviceId,
        fingerprint: device.fingerprint || deviceId,
        platform: device.platform || "web",
        label: device.label || "device",
        userId: user.id,
        active: true,
        authorized: true,
        localSequence: 0
      };
      state.devices.push(row);
    } else {
      row.userId = user.id;
      row.active = true;
    }
    authorizeDevice(state, row, user, uid);
  }

  recordAuditEvent(state, {
    action: "Login Success",
    details: "Signed in " + user.username,
    userId: user.id,
    username: user.username,
    category: "authentication",
    guarantee: "G1",
    module: "1"
  }, uid);
  logApp(state, "Login success", { userId: user.id, role: user.role }, uid, now);

  return {
    ok: true,
    user: redactSecrets({ ...user, passwordHash: "[REDACTED]" }),
    session,
    ttlMs: sessionTtlMs(state.settings || {})
  };
}

export function logoutLocal(state, { user = null, sessionId = "" } = {}, uid, now) {
  ensureAuthFoundationState(state);
  clearSession();
  if (sessionId) {
    const row = state.authSessions.find((item) => item.id === sessionId);
    if (row) row.endedAt = nowIso(now);
  }
  recordAuditEvent(state, {
    action: "Logout",
    details: "Signed out " + (user?.username || ""),
    userId: user?.id || "",
    username: user?.username || "",
    category: "authentication",
    guarantee: "G1",
    module: "1"
  }, uid);
  return { ok: true };
}

export async function requestPasswordReset(state, { username, actor = null } = {}, uid, now) {
  ensureAuthFoundationState(state);
  const user = findUser(state, username);
  if (!user) {
    // Do not reveal whether the user exists
    return { ok: true, issued: false };
  }
  const token = "prt-" + (uid ? uid("prt") : Math.random().toString(36).slice(2, 10));
  const expiresAt = new Date(nowMs(now) + 30 * 60 * 1000).toISOString();
  state.passwordResetTokens.push({
    id: token,
    userId: user.id,
    username: user.username,
    expiresAt,
    usedAt: "",
    createdBy: actor?.id || "",
    createdAt: nowIso(now)
  });
  recordAuditEvent(state, {
    action: "Password Reset",
    details: "Password reset token issued for " + user.username,
    userId: user.id,
    username: user.username,
    category: "authentication",
    guarantee: "G1",
    module: "1"
  }, uid);
  logSecurity(state, "Password reset requested", { userId: user.id }, uid, now);
  return { ok: true, issued: true, token, expiresAt };
}

export async function completePasswordReset(state, { token, newPassword } = {}, uid, now) {
  ensureAuthFoundationState(state);
  const row = (state.passwordResetTokens || []).find((item) => item.id === token && !item.usedAt);
  if (!row) return buildFoundationError("FND-007", { message: "Invalid or used reset token" });
  if (Date.parse(row.expiresAt) < nowMs(now)) {
    return buildFoundationError("FND-007", { message: "Reset token expired", userMessage: "Reset link expired. Request a new one." });
  }
  const minLen = Number(getConfigValue(state, "security.passwordMinLength") ?? 8);
  if (String(newPassword || "").length < minLen) {
    return buildFoundationError("FND-007", { message: "Password too short", userMessage: "Password does not meet minimum length." });
  }
  const user = (state.users || []).find((item) => item.id === row.userId);
  if (!user) return buildFoundationError("FND-007", { message: "User not found for reset token" });
  user.passwordHash = await hashPassword(newPassword);
  user.mustResetPassword = false;
  user.passwordChangedAt = nowIso(now);
  row.usedAt = nowIso(now);
  recordAuditEvent(state, {
    action: "Password Changed",
    details: "Password reset completed for " + user.username,
    userId: user.id,
    username: user.username,
    category: "authentication",
    guarantee: "G1",
    module: "1"
  }, uid);
  return { ok: true, userId: user.id };
}

export async function changePassword(state, user, { currentPassword, newPassword } = {}, uid, now) {
  ensureAuthFoundationState(state);
  if (!user) return buildFoundationError("FND-001");
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return buildFoundationError("FND-002", { userMessage: "Current password is incorrect." });
  const minLen = Number(getConfigValue(state, "security.passwordMinLength") ?? 8);
  if (String(newPassword || "").length < minLen) {
    return buildFoundationError("FND-007", { message: "Password too short" });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = nowIso(now);
  user.mustResetPassword = false;
  recordAuditEvent(state, {
    action: "Password Changed",
    details: "Password changed for " + user.username,
    userId: user.id,
    username: user.username,
    category: "authentication",
    guarantee: "G1",
    module: "1"
  }, uid);
  return { ok: true };
}

export async function refreshSupabaseSession(state, { refreshToken } = {}) {
  if (!supabaseAuthConfigured(state)) {
    return buildFoundationError("FND-008", { message: "Supabase auth not configured" });
  }
  const { refreshAuthSession } = await import("../sync/supabase-auth.js");
  try {
    const session = await refreshAuthSession(state, refreshToken);
    return { ok: true, session };
  } catch (err) {
    return buildFoundationError("FND-001", { message: err.message || "Refresh failed" });
  }
}

export async function signInSupabase(state, email, password) {
  try {
    const data = await supabaseSignIn(state, email, password);
    return { ok: true, session: data };
  } catch (err) {
    return buildFoundationError("FND-002", { message: err.message || "Auth failed" });
  }
}

export async function signOutSupabase(state) {
  await supabaseSignOut(state);
  return { ok: true };
}

export function sessionStatus(settings) {
  return {
    expired: sessionExpired(settings),
    ttlMs: sessionTtlMs(settings),
    defaultTtlMs: SESSION_TTL_MS,
    supabaseToken: Boolean(getAccessToken()),
    supabaseSession: Boolean(getStoredAuthSession())
  };
}

export function guardSession(onExpired, settings) {
  return ensureActiveSession(onExpired, settings);
}

export function assertActionAllowed(user, action) {
  if (isForbiddenForSuperAdmin(user, action)) {
    return buildFoundationError("FND-006");
  }
  if (!canAction(user, action) && !isSystemOwner(user)) {
    return buildFoundationError("FND-005");
  }
  return { ok: true };
}

export async function rememberSecureSessionMeta(meta = {}) {
  return secureSet("session-meta", redactSecrets(meta), { namespace: "auth", kind: "session" });
}

export async function clearSecureSessionMeta() {
  return secureRemove("session-meta", { namespace: "auth", kind: "session" });
}

export function revokeUserDevice(state, deviceId, user, uid) {
  return revokeDevice(state, deviceId, user, uid);
}

export {
  getStoredAuthSession,
  storeAuthSession,
  clearAuthSession,
  getAccessToken,
  supabaseAuthConfigured
};
