/**
 * Pure staff-credential checks shared by the staff-login Edge Function and its Node tests.
 * Mirrors the app's rules (src/password.js, src/core/totp.js, src/core/mfa.js) using Web Crypto only.
 */

export const MFA_REQUIRED_ROLES = ["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"];
export const PBKDF2_ITERATIONS = 120000;
export const MIN_STAFF_PASSWORD_LENGTH = 8;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function hexToBytes(hex) {
  const pairs = String(hex || "").match(/.{1,2}/g) || [];
  return Uint8Array.from(pairs.map((part) => parseInt(part, 16)));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Same format as the app's hashPassword (src/password.js): pbkdf2:<iterations>:<salt>:<hash>. */
export async function hashPasswordPbkdf2(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return `pbkdf2:${iterations}:${bytesToHex(salt)}:${bytesToHex(new Uint8Array(bits))}`;
}

/** True when the value is a password hash staff-login can verify (not empty or a placeholder). */
export function isUsablePasswordHash(value) {
  return typeof value === "string" && (value.startsWith("pbkdf2:") || value.startsWith("kba-"));
}

export function normalizeActivationCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Must match public.st_issue_staff_activation (migration 046): sha256("<app_users.id>:<code>"). */
export async function activationCodeHash(appUserUuid, code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${appUserUuid}:${normalizeActivationCode(code)}`));
  return bytesToHex(new Uint8Array(digest));
}

export function validateNewStaffPassword(password) {
  const value = typeof password === "string" ? password : "";
  if (value.length < MIN_STAFF_PASSWORD_LENGTH) return `Password must be at least ${MIN_STAFF_PASSWORD_LENGTH} characters`;
  if (value.length > 256) return "Password is too long";
  return "";
}

/** public.app_users role -> app role, the same mapping as fetch_business_snapshot (migration 005). */
export function appRoleFromRelational(role) {
  if (role === "Owner") return "KBA";
  if (role === "AssistantManager") return "Admin";
  return String(role || "");
}

/**
 * A public.app_users row as a staff-login user. The app identifies users by client_id (what
 * fetch_business_snapshot returns as id); rows without one fall back to their uuid.
 */
export function staffUserFromAppUserRow(row) {
  if (!row?.id) return null;
  return {
    id: String(row.client_id || row.id),
    uuid: String(row.id),
    username: String(row.username || ""),
    name: String(row.name || row.username || ""),
    role: appRoleFromRelational(row.role),
    active: row.active !== false,
    passwordHash: isUsablePasswordHash(row.password_hash) ? row.password_hash : "",
    source: "app_users"
  };
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function legacyHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `kba-${(hash >>> 0).toString(16)}`;
}

export async function verifyPasswordHash(password, storedHash) {
  if (typeof storedHash !== "string" || !storedHash) return false;
  if (storedHash.startsWith("kba-")) return legacyHash(password) === storedHash;
  if (!storedHash.startsWith("pbkdf2:")) return false;
  const [, iterationsText, saltHex, hashHex] = storedHash.split(":");
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5_000_000) return false;
  const expected = hexToBytes(hashHex);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8 || 256
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function base32Decode(input) {
  const str = String(input || "").replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of str) {
    const val = BASE32.indexOf(char);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

async function totpAt(secret, counter) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setUint32(4, counter, false);
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array(buffer)));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** The 30-second time step a valid code belongs to, or -1. Steps let the server refuse replays. */
export async function totpMatchStep(secret, token, { now = Date.now(), window = 1 } = {}) {
  const normalized = String(token || "").replace(/\s/g, "");
  if (!secret || !/^\d{6}$/.test(normalized)) return -1;
  const counter = Math.floor(now / 1000 / 30);
  for (let drift = -window; drift <= window; drift += 1) {
    if ((await totpAt(secret, counter + drift)) === normalized) return counter + drift;
  }
  return -1;
}

export async function verifyTotp(secret, token, options = {}) {
  return (await totpMatchStep(secret, token, options)) >= 0;
}

/** A new random base32 TOTP secret (160 bits, RFC 4226 recommendation). */
export function generateTotpSecretBase32(bytes = 20) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let bits = "";
  for (const byte of raw) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

export function totpProvisioningUri(secret, { issuer = "Smile Trust", account = "" } = {}) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export const MFA_ENROLLMENT_ERROR = "Two-factor authentication is required for your role. Set it up to continue.";

/**
 * Privileged roles (MFA_REQUIRED_ROLES) never get a session without a confirmed server-side TOTP
 * secret: without one the verdict is mfa_enrollment_required. Secrets come only from
 * public.user_mfa_secrets, never from a client snapshot.
 * @returns {Promise<{ ok: boolean, reason?: string, error?: string, mfaRequired?: boolean, mfaEnrollmentRequired?: boolean, mfaStep?: number }>}
 */
export async function evaluateStaffLogin({ user, password, mfaCode = "", mfaSecret = "", lastUsedStep = null, now = Date.now() }) {
  if (!user) return { ok: false, reason: "unknown_user", error: "Invalid login or inactive account." };
  if (!(await verifyPasswordHash(password, user.passwordHash))) {
    return { ok: false, reason: "bad_password", error: "Invalid login or inactive account." };
  }
  if (!MFA_REQUIRED_ROLES.includes(user.role)) return { ok: true };
  if (!mfaSecret) {
    return { ok: false, reason: "mfa_enrollment_required", mfaEnrollmentRequired: true, error: MFA_ENROLLMENT_ERROR };
  }
  if (!String(mfaCode || "").trim()) {
    return { ok: false, reason: "mfa_required", mfaRequired: true, error: "Enter your MFA code." };
  }
  const step = await totpMatchStep(mfaSecret, mfaCode, { now });
  if (step < 0) return { ok: false, reason: "bad_mfa", mfaRequired: true, error: "Invalid MFA code" };
  if (lastUsedStep != null && step <= Number(lastUsedStep)) {
    return { ok: false, reason: "mfa_replay", mfaRequired: true, error: "That MFA code was already used. Wait for the next code." };
  }
  return { ok: true, mfaStep: step };
}

export function isPlainUsername(value) {
  return /^[a-z0-9._@-]{1,80}$/.test(String(value || ""));
}

export function isValidBusinessCode(value) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(String(value || ""));
}
