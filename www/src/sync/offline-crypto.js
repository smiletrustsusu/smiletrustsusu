/**
 * AES-GCM encryption for offline queue payloads at rest.
 * Key derived from a random per-device secret + device fingerprint (never stored in queue).
 * `secret` may be a list: the first entry encrypts; every entry is tried when decrypting so
 * items queued under the legacy business key stay readable after the key change.
 */
const SALT = "smile-trust-offline-v1";

export const DEVICE_QUEUE_KEY_STORAGE = "smile_trust_offline_queue_key";

function secretList(secret) {
  return (Array.isArray(secret) ? secret : [secret]).map((item) => String(item || "")).filter(Boolean);
}

/** Random per-device secret, created once and kept only in this device's storage. */
export function deviceQueueSecret(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return "";
  let value = storage.getItem(DEVICE_QUEUE_KEY_STORAGE) || "";
  if (!value && globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    storage.setItem(DEVICE_QUEUE_KEY_STORAGE, value);
  }
  return value;
}

async function deriveKey(secret, fingerprint) {
  const material = `${SALT}:${secret}:${fingerprint}`;
  const encoded = new TextEncoder().encode(material);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptOfflinePayload(payload, { secret = "", fingerprint = "" } = {}) {
  const [primary] = secretList(secret);
  if (!primary || !fingerprint || !crypto?.subtle) {
    return { encrypted: false, payload };
  }
  const key = await deriveKey(primary, fingerprint);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    encrypted: true,
    payload: {
      v: 1,
      iv: toBase64(iv),
      data: toBase64(cipher)
    }
  };
}

export async function decryptOfflinePayload(stored, { secret = "", fingerprint = "" } = {}) {
  if (!stored?.encrypted && !stored?.payload?.v) return stored?.payload ?? stored;
  const secrets = secretList(secret);
  if (!secrets.length || !fingerprint || !crypto?.subtle) {
    throw new Error("Cannot decrypt offline queue without device key and device fingerprint");
  }
  const envelope = stored.payload || stored;
  const iv = fromBase64(envelope.iv);
  const cipher = fromBase64(envelope.data);
  let lastError;
  for (const candidate of secrets) {
    try {
      const key = await deriveKey(candidate, fingerprint);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Offline queue decrypt failed");
}

export function wrapQueueEntryForStorage(entry, encryptedPayload) {
  return {
    ...entry,
    payload: encryptedPayload.payload,
    encrypted: encryptedPayload.encrypted === true
  };
}
