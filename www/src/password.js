import { PBKDF2_ITERATIONS } from "./constants.js";

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  return Uint8Array.from(pairs.map((part) => parseInt(part, 16)));
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

async function derivePbkdf2(password, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePbkdf2(password, salt);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith("kba-")) return legacyHash(password) === storedHash;
  if (!storedHash.startsWith("pbkdf2:")) return false;
  const [, iterationsText, saltHex, hashHex] = storedHash.split(":");
  const iterations = Number(iterationsText || PBKDF2_ITERATIONS);
  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(hashHex);
  const derived = await derivePbkdf2(password, salt, iterations);
  if (derived.length !== expected.length) return false;
  return derived.every((byte, index) => byte === expected[index]);
}

export async function upgradePasswordHash(password, storedHash) {
  if (!(await verifyPassword(password, storedHash))) return storedHash;
  if (storedHash.startsWith("kba-")) return hashPassword(password);
  return storedHash;
}
