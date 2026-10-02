/**
 * MFA (TOTP) for privileged roles — Manager/Owner and Assistant Manager.
 */
import { generateTotpSecret, totpUri, verifyTotpCode } from "./totp.js";

export const MFA_REQUIRED_ROLES = ["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"];

export function mfaRequiredForUser(user) {
  return MFA_REQUIRED_ROLES.includes(user?.role);
}

/** How long a privileged user may sign in offline after the server last verified their MFA. */
export const SERVER_MFA_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** markers: { [userId]: ISO time of the last server-verified (password + TOTP) sign-in on this device }. */
export function serverMfaOfflineGraceOk(markers, userId, now = Date.now(), graceMs = SERVER_MFA_OFFLINE_GRACE_MS) {
  const at = Date.parse(markers?.[userId] || "");
  return Number.isFinite(at) && at <= now && now - at <= graceMs;
}

export function userMfaEnabled(user) {
  return Boolean(user?.mfaEnabled && user?.mfaSecret);
}

export function beginMfaSetup(user) {
  const secret = user.mfaSecret || generateTotpSecret();
  user.mfaSecret = secret;
  user.mfaEnabled = false;
  user.mfaPending = true;
  return {
    secret,
    uri: totpUri({ secret, account: user.username || user.name || "user" })
  };
}

export async function confirmMfaSetup(user, token) {
  if (!user?.mfaSecret) return { ok: false, error: "Start MFA setup first" };
  const valid = await verifyTotpCode(user.mfaSecret, token);
  if (!valid) return { ok: false, error: "Invalid verification code" };
  user.mfaEnabled = true;
  user.mfaPending = false;
  user.mfaConfirmedAt = new Date().toISOString();
  return { ok: true };
}

export async function verifyUserMfa(user, token) {
  if (!mfaRequiredForUser(user)) return { ok: true, skipped: true };
  if (!userMfaEnabled(user)) {
    if (user?.mfaPending) return { ok: false, error: "Complete MFA setup in Settings before signing in" };
    return { ok: true, warning: "MFA not enabled yet" };
  }
  const valid = await verifyTotpCode(user.mfaSecret, token);
  return valid ? { ok: true } : { ok: false, error: "Invalid MFA code" };
}

export function disableUserMfa(user) {
  user.mfaEnabled = false;
  user.mfaSecret = "";
  user.mfaPending = false;
  user.mfaConfirmedAt = "";
}
