/**
 * Pure staff-credential checks shared by the staff-login Edge Function and its Node tests.
 * Mirrors the app's rules (src/password.js, src/core/totp.js, src/core/mfa.js) using Web Crypto only.
 */

export const MFA_REQUIRED_ROLES = ["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"];
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function hexToBytes(hex) {
  const pairs = String(hex || "").match(/.{1,2}/g) || [];
  return Uint8Array.from(pairs.map((part) => parseInt(part, 16)));
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

export async function verifyTotp(secret, token, { now = Date.now(), window = 1 } = {}) {
  const normalized = String(token || "").replace(/\s/g, "");
  if (!secret || !/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / 30);
  for (let drift = -window; drift <= window; drift += 1) {
    if ((await totpAt(secret, counter + drift)) === normalized) return true;
  }
  return false;
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

/** Same eligibility as the app's findLoginUser: active, not pending, not tombstoned. */
export function findStaffUser(payload, usernameKey) {
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const user = users.find((item) => normalizeUsername(item?.username) === usernameKey);
  if (!user || user.active === false || user.pending) return null;
  const deleted = (payload?.deletedUsers || []).some((item) => item?.userId && item.userId === user.id
    && Date.parse(item.deletedAt || item.createdAt || 0) >= Date.parse(user.updatedAt || user.createdAt || 0));
  if (deleted) return null;
  if (user.role === "Developer" && payload?.settings?.allowDeveloperLogin !== true) return null;
  return user;
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string, error?: string, mfaRequired?: boolean }>}
 */
export async function evaluateStaffLogin({ user, password, mfaCode = "", mfaSecret = "", now = Date.now() }) {
  if (!user) return { ok: false, reason: "unknown_user", error: "Invalid login or inactive account." };
  if (!(await verifyPasswordHash(password, user.passwordHash))) {
    return { ok: false, reason: "bad_password", error: "Invalid login or inactive account." };
  }
  if (MFA_REQUIRED_ROLES.includes(user.role)) {
    const secret = user.mfaSecret || mfaSecret;
    if (user.mfaEnabled && secret) {
      if (!String(mfaCode || "").trim()) {
        return { ok: false, reason: "mfa_required", mfaRequired: true, error: "Enter your MFA code." };
      }
      if (!(await verifyTotp(secret, mfaCode, { now }))) {
        return { ok: false, reason: "bad_mfa", mfaRequired: true, error: "Invalid MFA code" };
      }
    } else if (user.mfaPending) {
      return { ok: false, reason: "mfa_pending", error: "Complete MFA setup in Settings before signing in" };
    }
  }
  return { ok: true };
}

export function isValidBusinessCode(value) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(String(value || ""));
}
