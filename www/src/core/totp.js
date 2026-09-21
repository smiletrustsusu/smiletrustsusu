/**
 * RFC 6238 TOTP — Web Crypto (browser + Node 18+).
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const str = String(input || "").replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of str) {
    const val = BASE32.indexOf(char);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function randomBase32(length = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => BASE32[b % 32]).join("");
}

async function hmacSha1(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, message);
  return new Uint8Array(sig);
}

export function generateTotpSecret() {
  return randomBase32(32);
}

export function totpUri({ secret, account, issuer = "Smile Trust" }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

export async function generateTotpCode(secret, { timeStep = 30, digits = 6, now = Date.now() } = {}) {
  const counter = Math.floor(now / 1000 / timeStep);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false);
  const hmac = await hmacSha1(base32Decode(secret), new Uint8Array(buffer));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, "0");
}

export async function verifyTotpCode(secret, token, { window = 1, ...options } = {}) {
  const normalized = String(token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const step = options.timeStep || 30;
  const now = options.now || Date.now();
  for (let drift = -window; drift <= window; drift += 1) {
    const code = await generateTotpCode(secret, { ...options, now: now + drift * step * 1000 });
    if (code === normalized) return true;
  }
  return false;
}
