import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { legacyHash, hashPassword } from "../src/password.js";
import {
  DEFAULT_SUPER_ADMIN,
  DEFAULT_SYSTEM_OWNER,
  HIDDEN_DEVELOPER_DIRECTORY_LABEL,
  SUPER_ADMIN_ID,
  SUPER_ADMIN_ROLE,
  SYSTEM_OWNER_ID,
  SYSTEM_OWNER_ROLE,
  canActorSeeUserAccount,
  canDeleteUserAccount,
  canDisableUserAccount,
  canEditUserAccount,
  canTransferOwnership,
  displayUserNameForActor,
  ensureDefaultSystemAccounts,
  getUserForActor,
  hasUsableLocalLogin,
  isLegacyBootstrapHash,
  isProtectedOwnerAccount,
  isReservedDeveloperUsername,
  isSuperAdminUser,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor,
  needsForcedPasswordChange,
  transferSystemOwnership,
  validateForcedPassword
} from "../src/core/system-accounts.js";
import { ROLE, can, roleLabel } from "../src/core/roles.js";
import {
  createApiPlatform,
  resetApiPlatformForTests
} from "../src/core/wave3-api-ops.js";
import { resetRateLimitWindows } from "../src/api/middleware/rate-limit.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function mockSessionStorage() {
  const map = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

test("creates JOHN and KBA once without any bundled password and with change-password flags", () => {
  const state = { users: [], audit: [] };
  const first = ensureDefaultSystemAccounts(state);
  assert.equal(first.created.length, 2);
  assert.equal(first.owner.passwordHash, "");
  assert.equal(first.admin.passwordHash, "");
  assert.equal(hasUsableLocalLogin(state.users), false);
  assert.equal("password" in DEFAULT_SYSTEM_OWNER, false);
  assert.equal("password" in DEFAULT_SUPER_ADMIN, false);
  assert.equal(first.owner.username, "JOHN");
  assert.equal(first.owner.name, "John");
  assert.equal(first.owner.role, SYSTEM_OWNER_ROLE);
  assert.equal(first.owner.undeletable, true);
  assert.equal(first.owner.mustChangePassword, true);
  assert.equal(first.admin.username, "KBA");
  assert.equal(first.admin.name, "KBA");
  assert.equal(first.admin.role, SUPER_ADMIN_ROLE);
  assert.equal(first.admin.systemDeveloper, true);
  assert.equal(first.admin.mustChangePassword, true);
  assert.ok(!first.owner.password);
  assert.ok(!first.admin.password);
  assert.equal(state.users.filter((user) => String(user.username).toLowerCase() === "john").length, 1);
  assert.equal(state.users.filter((user) => String(user.username).toLowerCase() === "kba").length, 1);

  const firstRunHash = "pbkdf2:120000:aa:bb";
  first.owner.passwordHash = firstRunHash;
  const second = ensureDefaultSystemAccounts(state, {
    ownerPasswordHash: legacyHash("other"),
    superAdminPasswordHash: legacyHash("other")
  });
  assert.equal(second.created.length, 0);
  assert.equal(state.users.length, 2);
  assert.equal(second.owner.passwordHash, firstRunHash);
  assert.equal(hasUsableLocalLogin(state.users), true);
});

test("bootstrap accounts still on a legacy fast hash must change password", () => {
  const state = {
    users: [
      { id: "u-owner", username: "JOHN", role: "SystemOwner", passwordHash: legacyHash("anything"), active: true },
      { id: "u-superadmin", username: "KBA", role: "KBA", passwordHash: legacyHash("anything-else"), active: true }
    ]
  };
  const result = ensureDefaultSystemAccounts(state);
  assert.equal(isLegacyBootstrapHash(result.owner.passwordHash), true);
  assert.equal(result.owner.mustChangePassword, true);
  assert.equal(result.admin.mustChangePassword, true);
});

test("upgrades existing JOHN/KBA accounts without resetting a changed password", () => {
  const changedHash = "pbkdf2:120000:aa:bb";
  const state = {
    users: [
      { id: "u-owner", name: "JOHN", username: "JOHN", role: "KBA", passwordHash: changedHash, active: true },
      { id: "u-developer", name: "kba", username: "kba", role: "Developer", passwordHash: changedHash, active: false }
    ]
  };
  const result = ensureDefaultSystemAccounts(state, {
    ownerPasswordHash: legacyHash("bootstrap-owner"),
    superAdminPasswordHash: legacyHash("bootstrap-admin")
  });
  assert.equal(result.created.length, 0);
  assert.equal(result.owner.role, SYSTEM_OWNER_ROLE);
  assert.equal(result.owner.passwordHash, changedHash);
  assert.notEqual(result.owner.mustChangePassword, true);
  assert.equal(result.admin.role, SUPER_ADMIN_ROLE);
  assert.equal(result.admin.username, "KBA");
  assert.equal(result.admin.systemDeveloper, true);
  assert.equal(result.admin.active, true);
  assert.equal(result.admin.passwordHash, changedHash);
});

test("System Owner cannot be deleted; developer account is never deletable; only owner can transfer", () => {
  const owner = { id: SYSTEM_OWNER_ID, role: SYSTEM_OWNER_ROLE, systemOwner: true, undeletable: true, username: "JOHN" };
  const admin = { id: SUPER_ADMIN_ID, role: SUPER_ADMIN_ROLE, username: "KBA", systemDeveloper: true };
  const staff = { id: "u-staff", role: "Admin", username: "ama", active: true };
  assert.equal(isSystemOwnerUser(owner), true);
  assert.equal(isSuperAdminUser(admin), true);
  assert.equal(isSystemDeveloperAccount(admin), true);
  assert.equal(isProtectedOwnerAccount(owner), true);
  assert.equal(canDeleteUserAccount(admin, owner), false);
  assert.equal(canDeleteUserAccount(owner, admin), false);
  assert.equal(canEditUserAccount(owner, admin), false);
  assert.equal(canDisableUserAccount(owner, admin), false);
  assert.equal(canDeleteUserAccount(admin, staff), true);
  assert.equal(canDeleteUserAccount(owner, staff), true);
  assert.equal(canTransferOwnership(admin), false);
  assert.equal(canTransferOwnership(owner), true);
  const blocked = transferSystemOwnership(owner, admin);
  assert.match(blocked.error || "", /developer/i);
  const moved = transferSystemOwnership(owner, staff);
  assert.equal(moved.error, undefined);
  assert.equal(staff.role, SYSTEM_OWNER_ROLE);
  assert.equal(owner.role, SUPER_ADMIN_ROLE);
  assert.equal(isSystemOwnerUser(staff), true);
  const after = ensureDefaultSystemAccounts({ users: [owner, admin, staff] });
  assert.equal(after.created.length, 0);
  assert.equal(staff.role, SYSTEM_OWNER_ROLE);
  assert.equal(owner.username, "JOHN");
  assert.equal(admin.username, "KBA");
});

test("JOHN cannot see KBA in listUsers / getUser helpers used by UI", () => {
  const owner = {
    id: SYSTEM_OWNER_ID,
    role: SYSTEM_OWNER_ROLE,
    systemOwner: true,
    username: "JOHN",
    name: "John",
    active: true
  };
  const developer = {
    id: SUPER_ADMIN_ID,
    role: SUPER_ADMIN_ROLE,
    username: "KBA",
    name: "KBA",
    systemDeveloper: true,
    active: true
  };
  const staff = { id: "u-staff", role: "Admin", username: "ama", name: "Ama", active: true };
  const users = [owner, developer, staff];

  assert.equal(canActorSeeUserAccount(owner, developer), false);
  assert.equal(canActorSeeUserAccount(developer, owner), true);
  assert.equal(canActorSeeUserAccount(developer, developer), true);

  const ownerList = listUsersForActor(users, owner);
  assert.equal(ownerList.some((u) => String(u.username).toLowerCase() === "kba"), false);
  assert.equal(ownerList.some((u) => u.id === SUPER_ADMIN_ID), false);
  assert.equal(ownerList.some((u) => u.username === "JOHN"), true);
  assert.equal(ownerList.some((u) => u.username === "ama"), true);

  const kbaList = listUsersForActor(users, developer);
  assert.equal(kbaList.some((u) => String(u.username).toLowerCase() === "kba"), true);
  assert.equal(kbaList.some((u) => u.username === "JOHN"), true);

  assert.equal(getUserForActor(users, SUPER_ADMIN_ID, owner), null);
  assert.equal(getUserForActor(users, SUPER_ADMIN_ID, developer)?.username, "KBA");
  assert.equal(getUserForActor(users, "u-staff", owner)?.username, "ama");
  assert.equal(displayUserNameForActor(users, SUPER_ADMIN_ID, owner), HIDDEN_DEVELOPER_DIRECTORY_LABEL);
  assert.equal(displayUserNameForActor(users, SUPER_ADMIN_ID, developer), "KBA");
  assert.equal(isReservedDeveloperUsername("KBA"), true);
  assert.equal(isReservedDeveloperUsername("ama"), false);
});

test("v1/users.list and v1/users.get hide KBA from System Owner JOHN", async () => {
  mockSessionStorage();
  resetApiPlatformForTests();
  resetRateLimitWindows();
  const passwordHash = await hashPassword("SecretPass1");
  const owner = {
    id: SYSTEM_OWNER_ID,
    username: "JOHN",
    role: SYSTEM_OWNER_ROLE,
    systemOwner: true,
    active: true,
    passwordHash,
    tenantId: "smile-trust"
  };
  const developer = {
    id: SUPER_ADMIN_ID,
    username: "KBA",
    role: SUPER_ADMIN_ROLE,
    systemDeveloper: true,
    active: true,
    passwordHash,
    tenantId: "smile-trust"
  };
  const staff = {
    id: "u-staff",
    username: "ama",
    role: "Admin",
    active: true,
    passwordHash,
    tenantId: "smile-trust",
    branchId: "br-1"
  };
  const state = {
    settings: {
      loanInterest: 15,
      collectionDays: 31,
      currency: "GHS",
      tenantId: "smile-trust",
      businessId: "smile-trust"
    },
    users: [owner, developer, staff],
    audit: [],
    customers: [],
    collections: [],
    loans: [],
    offlineQueue: []
  };
  const api = createApiPlatform(state, { uid: (p) => `${p}-t`, now: "2026-09-19T12:00:00.000Z" });

  const ownerList = await api.invoke(
    { operationId: "v1/users.list", payload: {} },
    { user: owner }
  );
  assert.equal(ownerList.ok, true);
  const ownerUsers = ownerList.data?.users || ownerList.data?.items || [];
  assert.equal(ownerUsers.some((u) => String(u.username).toLowerCase() === "kba"), false);
  assert.equal(ownerUsers.some((u) => u.id === SUPER_ADMIN_ID), false);
  assert.ok(ownerUsers.some((u) => String(u.username).toLowerCase() === "john"));

  const ownerGet = await api.invoke(
    { operationId: "v1/users.get", payload: { id: SUPER_ADMIN_ID } },
    { user: owner }
  );
  assert.equal(ownerGet.ok, false);

  const kbaList = await api.invoke(
    { operationId: "v1/users.list", payload: {} },
    { user: developer }
  );
  assert.equal(kbaList.ok, true);
  const kbaUsers = kbaList.data?.users || kbaList.data?.items || [];
  assert.equal(kbaUsers.some((u) => String(u.username).toLowerCase() === "kba"), true);

  const kbaGet = await api.invoke(
    { operationId: "v1/users.get", payload: { id: SUPER_ADMIN_ID } },
    { user: developer }
  );
  assert.equal(kbaGet.ok, true);
  assert.equal(kbaGet.data?.user?.username, "KBA");
  assert.equal(kbaGet.data?.user?.passwordHash, undefined);
});

test("forced password change rejects defaults and short values", () => {
  assert.equal(validateForcedPassword("1234", "1234"), "New password must be at least 8 characters");
  assert.equal(validateForcedPassword("password1", "password1"), "Choose a new password, not the current one");
  assert.equal(validateForcedPassword("secure-pass", "1234"), "");
  assert.equal(validateForcedPassword("reused-old-pass", "x", ["reused-old-pass"]), "Do not reuse a default system password");
  assert.equal(needsForcedPasswordChange({ mustChangePassword: true }), true);
});

test("System Owner has unrestricted module access", () => {
  assert.equal(roleLabel(ROLE.SYSTEM_OWNER), "System Owner");
  assert.equal(can({ role: ROLE.SYSTEM_OWNER }, "permissions"), true);
  assert.equal(can({ role: ROLE.SYSTEM_OWNER }, "settings"), true);
  assert.equal(can({ role: ROLE.SYSTEM_OWNER }, "audit"), true);
  assert.equal(can({ role: ROLE.SYSTEM_OWNER }, "backup"), true);
});
