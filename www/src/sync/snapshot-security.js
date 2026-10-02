export function isProtectedPasswordHash(hash) {
  return !hash || hash === "[protected]" || hash === "[local-only]";
}

/** Device or server secrets that must never be written into a shared snapshot. */
export const CLOUD_FORBIDDEN_SETTINGS = Object.freeze(["syncAccessKey", "syncToken", "momoWebhookSecret"]);

/**
 * Keys never written to the shared snapshot at any depth: passwords and hashes of any format,
 * TOTP/MFA secrets, activation and recovery codes, session/access/refresh tokens and other keys.
 * Must stay in step with public.st_is_secret_key (migration 047), which strips the same keys on
 * the server. Member portal PINs are the exception: they travel to the server, which stores only
 * a bcrypt hash and removes the plaintext from the snapshot.
 */
export const SNAPSHOT_SECRET_KEYS = Object.freeze([
  "password", "passwordhash", "password_hash", "passwordhint", "loginpasswordhint", "pinhash", "pin_hash",
  "mfasecret", "mfa_secret", "mfapendingsecret", "totpsecret", "totp_secret", "otpsecret", "secret",
  "activationcode", "activation_code", "activationcodes",
  "accesstoken", "access_token", "refreshtoken", "refresh_token", "sessiontoken", "session_token", "idtoken", "id_token",
  "synctoken", "syncaccesskey", "cloudkey", "accesskey", "access_key", "momowebhooksecret", "webhooksecret",
  "recoverycode", "recoverycodes", "recovery_codes", "backupcodes", "backup_codes",
  "servicerolekey", "service_role_key", "servicekey", "privatekey", "private_key"
]);
const SECRET_KEY_SET = new Set(SNAPSHOT_SECRET_KEYS);
const SECRET_KEY_SUFFIX = /(secret|token|passwordhash|password_hash)$/;

export function isSnapshotSecretKey(key) {
  const lower = String(key || "").toLowerCase();
  return SECRET_KEY_SET.has(lower) || SECRET_KEY_SUFFIX.test(lower);
}

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isSnapshotSecretKey(key)) out[key] = stripSecrets(item);
  }
  return out;
}

export function sanitizeStateForCloud(state) {
  const copy = stripSecrets(structuredClone(state));
  copy.users = (copy.users || []).map((user) => ({ ...user, passwordHash: "[protected]" }));
  return copy;
}

const LOCAL_MFA_FIELDS = ["mfaSecret", "mfaEnabled", "mfaPending", "mfaConfirmedAt"];

export function restoreUsersFromCloud(localUsers = [], remoteUsers = []) {
  const localByUsername = new Map(
    localUsers.map((user) => [String(user.username || "").toLowerCase(), user])
  );
  return (remoteUsers || []).map((remote) => {
    const local = localByUsername.get(String(remote.username || "").toLowerCase());
    const passwordHash = isProtectedPasswordHash(remote.passwordHash)
      ? local?.passwordHash || remote.passwordHash
      : remote.passwordHash || local?.passwordHash;
    const restored = { ...remote, passwordHash };
    // Hints never travel through the cloud; keep this device's copy only while it matches the hash.
    const localHint = local?.passwordHash === passwordHash ? local?.loginPasswordHint : "";
    if (localHint) restored.loginPasswordHint = localHint;
    else delete restored.loginPasswordHint;
    // A device-local authenticator never travels through the cloud either.
    if (local && !remote.mfaSecret && local.id === remote.id) {
      LOCAL_MFA_FIELDS.forEach((field) => {
        if (local[field] !== undefined) restored[field] = local[field];
      });
    }
    return restored;
  });
}

export function mergeSanitizedRemoteState(localState, remoteState) {
  const remoteUsers = restoreUsersFromCloud(localState.users, remoteState.users);
  return { ...remoteState, users: remoteUsers };
}
