export function isProtectedPasswordHash(hash) {
  return !hash || hash === "[protected]" || hash === "[local-only]";
}

export function sanitizeStateForCloud(state) {
  const copy = structuredClone(state);
  copy.users = (copy.users || []).map((user) => {
    const safe = { ...user };
    delete safe.password;
    safe.passwordHash = "[protected]";
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
    return { ...remote, passwordHash };
  });
}

export function mergeSanitizedRemoteState(localState, remoteState) {
  const remoteUsers = restoreUsersFromCloud(localState.users, remoteState.users);
  return { ...remoteState, users: remoteUsers };
}
