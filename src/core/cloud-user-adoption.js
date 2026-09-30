/**
 * After the staff-login function has verified a username and password on the server, make this
 * device's copy of that user carry the server identity (app_users client id) and a local hash of
 * the password just entered, so offline sign-in keeps working.
 *
 * A device that started clean holds placeholder accounts (for example the default owner "JOHN"
 * with no password). Those are replaced by the server identity instead of creating a second owner.
 * A local account that already has a real password is never overwritten by a different identity.
 */
function isPlaceholderHash(hash) {
  return !hash || hash === "[protected]" || hash === "[local-only]";
}

/**
 * @returns {{ ok: true, user: object, users: object[] } | { ok: false, reason: "missing" | "conflict" }}
 */
export function adoptCloudVerifiedUser(users = [], appUser, { username, passwordHash, now = new Date().toISOString() }) {
  if (!appUser?.id || !passwordHash) return { ok: false, reason: "missing" };
  const key = String(username || appUser.username || "").trim().toLowerCase();
  const sameName = users.filter((user) => String(user?.username || "").toLowerCase() === key);
  const byId = users.find((user) => user?.id === appUser.id);
  const target = byId || sameName[0];
  if (!target) return { ok: false, reason: "missing" };
  const others = sameName.filter((user) => user !== target);
  if (!byId && !isPlaceholderHash(target.passwordHash)) return { ok: false, reason: "conflict" };
  if (others.some((user) => !isPlaceholderHash(user.passwordHash))) return { ok: false, reason: "conflict" };

  if (!byId) {
    target.id = appUser.id;
    if (appUser.role) {
      target.role = appUser.role;
      target.systemOwner = appUser.role === "SystemOwner";
      target.undeletable = target.systemOwner;
    }
  }
  if (!target.role && appUser.role) target.role = appUser.role;
  target.passwordHash = passwordHash;
  target.active = true;
  target.pending = false;
  target.mustChangePassword = false;
  target.updatedAt = now;
  return { ok: true, user: target, users: users.filter((user) => !others.includes(user)) };
}
