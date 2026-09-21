/**
 * AES-GCM encryption for offline queue payloads at rest.
 * Key derived from business sync access key + device fingerprint (never stored in queue).
 */
const SALT = "smile-trust-offline-v1";

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
  if (!secret || !fingerprint || !crypto?.subtle) {
    return { encrypted: false, payload };
  }
  const key = await deriveKey(secret, fingerprint);
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
  if (!secret || !fingerprint || !crypto?.subtle) {
    throw new Error("Cannot decrypt offline queue without sync key and device fingerprint");
  }
  const envelope = stored.payload || stored;
  const key = await deriveKey(secret, fingerprint);
  const iv = fromBase64(envelope.iv);
  const cipher = fromBase64(envelope.data);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function wrapQueueEntryForStorage(entry, encryptedPayload) {
  return {
    ...entry,
    payload: encryptedPayload.payload,
    encrypted: encryptedPayload.encrypted === true
  };
}
