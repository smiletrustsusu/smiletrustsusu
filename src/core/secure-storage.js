/**
 * Wave 1 — Secure storage & secrets handling helpers.
 * Uses Web Crypto when available; never logs secret values.
 * In-process only — not a network API client rewrite.
 */

import { encryptOfflinePayload, decryptOfflinePayload } from "../sync/offline-crypto.js";
import { buildFoundationError } from "./foundation-errors.js";

export const SECURE_STORAGE_VERSION = "1.0.0";
export const SECURE_STORAGE_PREFIX = "smile_trust_secure_v1:";

const SENSITIVE_KEY_RE = /(password|secret|token|apikey|api_key|refresh|private|pin|credential)/i;

export function isSensitiveKey(key) {
  return SENSITIVE_KEY_RE.test(String(key || ""));
}

export function assertNoPlaintextSecrets(object, path = "payload") {
  if (!object || typeof object !== "object") return { ok: true };
  for (const [key, value] of Object.entries(object)) {
    if (isSensitiveKey(key) && value != null && value !== "" && typeof value === "string") {
      // Allow hashed / redacted forms
      if (String(value).startsWith("pbkdf2:") || String(value).startsWith("kba-") || String(value) === "[REDACTED]") {
        continue;
      }
      return buildFoundationError("FND-013", {
        message: "Plaintext secret refused at " + path + "." + key,
        details: { path: path + "." + key }
      });
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = assertNoPlaintextSecrets(value, path + "." + key);
      if (nested.ok === false) return nested;
    }
  }
  return { ok: true };
}

export function redactSecrets(value, depth = 0) {
  if (depth > 6) return "[Truncated]";
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key)) out[key] = "[REDACTED]";
    else if (val && typeof val === "object") out[key] = redactSecrets(val, depth + 1);
    else out[key] = val;
  }
  return out;
}

function storageAvailable(kind = "local") {
  try {
    const store = kind === "session" ? globalThis.sessionStorage : globalThis.localStorage;
    if (!store) return false;
    const probe = SECURE_STORAGE_PREFIX + "__probe";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a JSON value. Sensitive keys are rejected unless already hashed/redacted
 * or encrypt options are provided.
 */
export async function secureSet(key, value, {
  namespace = "app",
  kind = "local",
  secret = "",
  fingerprint = "",
  allowSensitive = false
} = {}) {
  if (!storageAvailable(kind)) {
    return buildFoundationError("FND-012");
  }
  if (!allowSensitive) {
    const check = assertNoPlaintextSecrets(value);
    if (check.ok === false) return check;
  }
  const store = kind === "session" ? sessionStorage : localStorage;
  const fullKey = SECURE_STORAGE_PREFIX + namespace + ":" + key;
  let body = { v: 1, encrypted: false, value };
  if (secret && fingerprint) {
    const enc = await encryptOfflinePayload(value, { secret, fingerprint });
    body = { v: 1, encrypted: enc.encrypted === true, value: enc.payload };
  }
  try {
    store.setItem(fullKey, JSON.stringify(body));
    return { ok: true, key: fullKey, encrypted: body.encrypted === true };
  } catch (err) {
    return buildFoundationError("FND-012", { message: err.message || "Secure storage write failed" });
  }
}

export async function secureGet(key, {
  namespace = "app",
  kind = "local",
  secret = "",
  fingerprint = ""
} = {}) {
  if (!storageAvailable(kind)) {
    return buildFoundationError("FND-012");
  }
  const store = kind === "session" ? sessionStorage : localStorage;
  const fullKey = SECURE_STORAGE_PREFIX + namespace + ":" + key;
  try {
    const raw = store.getItem(fullKey);
    if (!raw) return { ok: true, value: null };
    const body = JSON.parse(raw);
    if (body.encrypted) {
      const value = await decryptOfflinePayload(
        { encrypted: true, payload: body.value },
        { secret, fingerprint }
      );
      return { ok: true, value, encrypted: true };
    }
    return { ok: true, value: body.value, encrypted: false };
  } catch (err) {
    return buildFoundationError("FND-012", { message: err.message || "Secure storage read failed" });
  }
}

export function secureRemove(key, { namespace = "app", kind = "local" } = {}) {
  if (!storageAvailable(kind)) return buildFoundationError("FND-012");
  const store = kind === "session" ? sessionStorage : localStorage;
  store.removeItem(SECURE_STORAGE_PREFIX + namespace + ":" + key);
  return { ok: true };
}

/**
 * In-process secure API client facade — wraps invokeContract-style callers.
 * Does not open HTTP listeners.
 */
export function createSecureApiClient({ invoke, getToken, onAudit } = {}) {
  return {
    async call(contractName, input = {}, context = {}) {
      if (typeof invoke !== "function") {
        return buildFoundationError("FND-014", { message: "Secure API client invoke missing" });
      }
      const token = typeof getToken === "function" ? getToken() : "";
      const safeInput = redactSecrets(input);
      if (typeof onAudit === "function") {
        onAudit({ contractName, input: safeInput, hasToken: Boolean(token) });
      }
      return invoke(contractName, input, { ...context, accessToken: token || context.accessToken });
    }
  };
}

export function encryptHelper(payload, options) {
  return encryptOfflinePayload(payload, options);
}

export function decryptHelper(stored, options) {
  return decryptOfflinePayload(stored, options);
}
