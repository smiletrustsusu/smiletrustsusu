export function isProtectedPasswordHash(hash) {
  return !hash || hash === "[protected]" || hash === "[local-only]";
}

/** Only salted PBKDF2 hashes may leave the device; legacy fast hashes stay local. */
export function isCloudSafePasswordHash(hash) {
  return typeof hash === "string" && hash.startsWith("pbkdf2:");
}

export function sanitizeStateForCloud(state) {
  const copy = structuredClone(state);
  copy.users = (copy.users || []).map((user) => {
    const safe = { ...user };
    delete safe.password;
    delete safe.loginPasswordHint;
    if (!isCloudSafePasswordHash(safe.passwordHash)) safe.passwordHash = "[protected]";
    return safe;
  });
  return copy;
}

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
    return restored;
  });
}

export function mergeSanitizedRemoteState(localState, remoteState) {
  const remoteUsers = restoreUsersFromCloud(localState.users, remoteState.users);
  return { ...remoteState, users: remoteUsers };
}
