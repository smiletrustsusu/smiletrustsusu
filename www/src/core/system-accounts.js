/**
 * Default System Owner (JOHN) and Super Administrator / system developer (KBA) bootstrap.
 * Never duplicates existing accounts; never resets a changed password.
 *
 * Isolation: System Owner operates the business and must not enumerate, view, edit,
 * or disable the KBA developer account. Credentials are configured in seed (this module).
 */

export const SYSTEM_OWNER_ID = "u-owner";
export const SUPER_ADMIN_ID = "u-superadmin";
export const LEGACY_SUPER_ADMIN_ID = "u-developer";

export const SYSTEM_OWNER_ROLE = "SystemOwner";
export const SUPER_ADMIN_ROLE = "KBA";

/** Display label when developer identity must stay hidden from the owner. */
export const HIDDEN_DEVELOPER_DIRECTORY_LABEL = "System";

export const DEFAULT_SYSTEM_OWNER = {
  username: "JOHN",
  name: "John",
  password: "7049"
};

export const DEFAULT_SUPER_ADMIN = {
  username: "KBA",
  name: "KBA",
  password: "05491"
};

export function isSystemOwnerUser(user) {
  if (!user) return false;
  return user.role === SYSTEM_OWNER_ROLE || user.systemOwner === true || user.id === SYSTEM_OWNER_ID;
}

export function isSuperAdminUser(user) {
  if (!user || isSystemOwnerUser(user)) return false;
  return user.role === SUPER_ADMIN_ROLE
    || user.id === SUPER_ADMIN_ID
    || (user.id === LEGACY_SUPER_ADMIN_ID && user.role !== "Developer");
}

/**
 * KBA bootstrap / system developer account (not the business System Owner).
 * Owner must never see this row in staff management, pickers, or getUser listings.
 */
export function isSystemDeveloperAccount(user) {
  if (!user || isSystemOwnerUser(user)) return false;
  const username = String(user.username || "").toLowerCase();
  if (user.systemDeveloper === true) return true;
  if (username === "kba") return true;
  if (user.id === SUPER_ADMIN_ID || user.id === LEGACY_SUPER_ADMIN_ID) return true;
  return false;
}

export function isReservedDeveloperUsername(username) {
  return String(username || "").trim().toLowerCase() === "kba";
}

export function isProtectedOwnerAccount(user) {
  return Boolean(user && (user.id === SYSTEM_OWNER_ID || user.undeletable === true || isSystemOwnerUser(user)));
}

export function isDefaultSystemAccount(user) {
  if (!user) return false;
  const username = String(user.username || "").toLowerCase();
  return user.id === SYSTEM_OWNER_ID
    || user.id === SUPER_ADMIN_ID
    || user.id === LEGACY_SUPER_ADMIN_ID
    || username === "john"
    || username === "kba"
    || user.systemDeveloper === true;
}

export function hasOperationalPrivilege(user) {
  return isSystemOwnerUser(user) || isSuperAdminUser(user);
}

export function needsForcedPasswordChange(user) {
  return Boolean(user?.mustChangePassword);
}

export function isDefaultPasswordHash(hash, plainPassword, legacyHashFn) {
  if (!hash || !plainPassword || typeof legacyHashFn !== "function") return false;
  if (hash.startsWith("kba-")) return hash === legacyHashFn(plainPassword);
  return false;
}

/** True when actor may see target in user lists / getUser / pickers / directories. */
export function canActorSeeUserAccount(actor, target) {
  if (!target) return false;
  if (!isSystemDeveloperAccount(target)) return true;
  if (!actor) return false;
  if (actor.id && target.id && actor.id === target.id) return true;
  if (isSystemDeveloperAccount(actor)) return true;
  if (actor.role === "Developer") return true;
  return false;
}

export function listUsersForActor(users = [], actor) {
  return (users || []).filter((user) => canActorSeeUserAccount(actor, user));
}

export function getUserForActor(users = [], userId, actor) {
  if (!userId) return null;
  const user = (users || []).find((item) => item.id === userId) || null;
  if (!user || !canActorSeeUserAccount(actor, user)) return null;
  return user;
}

export function displayUserNameForActor(users = [], userId, actor, fallback = "Unassigned") {
  const user = (users || []).find((item) => item.id === userId);
  if (!user) return fallback;
  if (!canActorSeeUserAccount(actor, user)) return HIDDEN_DEVELOPER_DIRECTORY_LABEL;
  return user.name || fallback;
}

export function canEditUserAccount(actor, target) {
  if (!actor || !target) return false;
  if (isSystemDeveloperAccount(target) && !isSystemDeveloperAccount(actor) && actor.role !== "Developer") return false;
  if (isProtectedOwnerAccount(target) && !isSystemOwnerUser(actor)) return false;
  if (isDefaultSystemAccount(target)) return false;
  return isSystemOwnerUser(actor) || isSuperAdminUser(actor);
}

export function canDisableUserAccount(actor, target) {
  return canEditUserAccount(actor, target);
}

export function canDeleteUserAccount(actor, target) {
  if (!actor || !target) return false;
  if (isProtectedOwnerAccount(target)) return false;
  if (isSystemDeveloperAccount(target)) return false;
  if (isDefaultSystemAccount(target)) return false;
  return isSystemOwnerUser(actor) || isSuperAdminUser(actor);
}

/**
 * Who may see a staff/collector login password hint on the Staff list (without Edit).
 * System Owner (JOHN) and Super Admin / KBA only — never collectors viewing peers.
 * KBA developer row stays hidden from JOHN via canActorSeeUserAccount.
 */
export function canViewStaffLoginPassword(actor, target) {
  if (!actor || !target) return false;
  if (!canActorSeeUserAccount(actor, target)) return false;
  if (isSystemDeveloperAccount(target) && isSystemOwnerUser(actor)) return false;
  if (isSystemOwnerUser(actor)) return true;
  if (isSuperAdminUser(actor)) return true;
  return false;
}

/** Prefer displayable hint / demo plaintext; never invent hashes as passwords. */
export function staffLoginPasswordDisplay(user) {
  if (!user) return "";
  const hint = String(user.loginPasswordHint || "").trim();
  if (hint) return hint;
  const plain = String(user.password || "").trim();
  if (plain && !plain.startsWith("$") && !plain.startsWith("kba-")) return plain;
  return "";
}

export function setStaffLoginPasswordHint(user, plainPassword) {
  if (!user) return user;
  const value = String(plainPassword || "").trim();
  if (value) user.loginPasswordHint = value;
  return user;
}

export function canTransferOwnership(actor) {
  return isSystemOwnerUser(actor);
}

export function transferSystemOwnership(fromUser, toUser) {
  if (!fromUser || !toUser) return { error: "Both accounts are required" };
  if (!isSystemOwnerUser(fromUser)) return { error: "Only the System Owner can transfer ownership" };
  if (fromUser.id === toUser.id) return { error: "Select a different account" };
  if (isSystemDeveloperAccount(toUser)) return { error: "Cannot transfer ownership to the system developer account" };
  if (!toUser.active || toUser.pending) return { error: "The new owner must be an active staff account" };
  fromUser.systemOwner = false;
  fromUser.role = SUPER_ADMIN_ROLE;
  fromUser.updatedAt = new Date().toISOString();
  toUser.previousRole = toUser.role;
  toUser.systemOwner = true;
  toUser.role = SYSTEM_OWNER_ROLE;
  toUser.active = true;
  toUser.pending = false;
  toUser.updatedAt = new Date().toISOString();
  return { fromUser, toUser };
}

export function findExistingOwner(users = []) {
  return users.find((user) => user.systemOwner === true)
    || users.find((user) => user.role === SYSTEM_OWNER_ROLE)
    || users.find((user) => user.id === SYSTEM_OWNER_ID)
    || users.find((user) => String(user.username || "").toLowerCase() === "john")
    || users.find((user) => user.role === SUPER_ADMIN_ROLE && String(user.username || "").toLowerCase() !== "kba");
}

export function findExistingSuperAdmin(users = [], ownerId = "") {
  return users.find((user) => user.id !== ownerId && String(user.username || "").toLowerCase() === "kba")
    || users.find((user) => user.id === SUPER_ADMIN_ID && user.id !== ownerId)
    || users.find((user) => user.id === LEGACY_SUPER_ADMIN_ID && user.id !== ownerId)
    || users.find((user) => user.id !== ownerId && user.role === SUPER_ADMIN_ROLE && user.systemOwner !== true);
}

export function ensureDefaultSystemAccounts(state, {
  ownerPasswordHash,
  superAdminPasswordHash,
  legacyHashFn,
  now = new Date().toISOString()
} = {}) {
  state.users = state.users || [];
  state.audit = state.audit || [];
  const created = [];

  let owner = findExistingOwner(state.users);
  if (owner) {
    if (!owner.id) owner.id = SYSTEM_OWNER_ID;
    if (owner.id === SYSTEM_OWNER_ID || String(owner.username || "").toLowerCase() === "john") {
      owner.username = DEFAULT_SYSTEM_OWNER.username;
      if (!owner.name || owner.name === "JOHN") owner.name = DEFAULT_SYSTEM_OWNER.name;
    }
    owner.role = SYSTEM_OWNER_ROLE;
    owner.systemOwner = true;
    owner.undeletable = true;
    owner.active = true;
    owner.pending = false;
    if (!owner.passwordHash && ownerPasswordHash) owner.passwordHash = ownerPasswordHash;
    if (isDefaultPasswordHash(owner.passwordHash, DEFAULT_SYSTEM_OWNER.password, legacyHashFn)) {
      owner.mustChangePassword = true;
    }
    delete owner.password;
  } else {
    owner = {
      id: SYSTEM_OWNER_ID,
      name: DEFAULT_SYSTEM_OWNER.name,
      username: DEFAULT_SYSTEM_OWNER.username,
      passwordHash: ownerPasswordHash,
      role: SYSTEM_OWNER_ROLE,
      systemOwner: true,
      undeletable: true,
      mustChangePassword: true,
      active: true,
      createdAt: now
    };
    state.users.push(owner);
    created.push({ id: owner.id, username: owner.username, role: owner.role });
  }

  let admin = findExistingSuperAdmin(state.users, owner.id);
  if (admin) {
    if (admin.id !== SUPER_ADMIN_ID && admin.id !== LEGACY_SUPER_ADMIN_ID && String(admin.username || "").toLowerCase() === "kba") {
      admin.id = SUPER_ADMIN_ID;
    }
    if (admin.id === SUPER_ADMIN_ID || admin.id === LEGACY_SUPER_ADMIN_ID || String(admin.username || "").toLowerCase() === "kba") {
      admin.username = DEFAULT_SUPER_ADMIN.username;
      if (!admin.name || admin.name === "kba") admin.name = DEFAULT_SUPER_ADMIN.name;
    }
    admin.role = SUPER_ADMIN_ROLE;
    admin.systemOwner = false;
    admin.systemDeveloper = true;
    admin.active = true;
    admin.pending = false;
    if (!admin.passwordHash && superAdminPasswordHash) admin.passwordHash = superAdminPasswordHash;
    if (isDefaultPasswordHash(admin.passwordHash, DEFAULT_SUPER_ADMIN.password, legacyHashFn)) {
      admin.mustChangePassword = true;
    }
    delete admin.password;
  } else {
    admin = {
      id: SUPER_ADMIN_ID,
      name: DEFAULT_SUPER_ADMIN.name,
      username: DEFAULT_SUPER_ADMIN.username,
      passwordHash: superAdminPasswordHash,
      role: SUPER_ADMIN_ROLE,
      systemOwner: false,
      systemDeveloper: true,
      mustChangePassword: true,
      active: true,
      createdAt: now
    };
    state.users.push(admin);
    created.push({ id: admin.id, username: admin.username, role: admin.role });
  }

  const seen = new Set();
  state.users = state.users.filter((user) => {
    if (user.id === SYSTEM_OWNER_ID) {
      if (seen.has("owner")) return false;
      seen.add("owner");
      return true;
    }
    const username = String(user.username || "").toLowerCase();
    if (username === "kba" || user.id === SUPER_ADMIN_ID || user.id === LEGACY_SUPER_ADMIN_ID) {
      if (seen.has("super")) return false;
      seen.add("super");
      return true;
    }
    return true;
  });

  return { created, owner, admin };
}

export function validateForcedPassword(nextPassword, currentPassword, defaults = [DEFAULT_SYSTEM_OWNER.password, DEFAULT_SUPER_ADMIN.password], policy = {}) {
  const value = String(nextPassword || "");
  const min = Number(policy.minLength) > 0 ? Number(policy.minLength) : 8;
  if (value.length < min) return `New password must be at least ${min} characters`;
  if (value === currentPassword) return "Choose a new password, not the current one";
  if (defaults.includes(value)) return "Do not reuse a default system password";
  return "";
}
