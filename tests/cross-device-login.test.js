import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeStateForCloud, restoreUsersFromCloud } from "../src/sync/snapshot-security.js";
import { hashPassword, verifyPassword, legacyHash } from "../src/password.js";
import { portalAccountBalance } from "../src/core/customer-portal.js";

globalThis.document ??= { querySelector: () => null };
const memory = new Map();
globalThis.localStorage ??= {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
const { mergeStates } = await import("../src/core/state.js");

test("merge replaces a synced placeholder hash with the real one from the cloud", async () => {
  const strong = await hashPassword("Collector#2026");
  const at = "2026-09-27T10:00:00.000Z";
  const local = { users: [{ id: "u1", username: "Baba", passwordHash: "[protected]", active: true, updatedAt: at }] };
  const remote = { users: [{ id: "u1", username: "Baba", passwordHash: strong, active: true, updatedAt: at }] };
  const merged = mergeStates(local, remote);
  assert.equal(merged.users[0].passwordHash, strong);
});

test("deleting an extra KBA account sticks across merges while core accounts survive", () => {
  const cloud = {
    users: [
      { id: "u-owner", username: "JOHN", role: "SystemOwner" },
      { id: "u-developer", username: "KBA", role: "KBA", createdAt: "2026-09-27T15:27:24.059Z" },
      { id: "x", username: "x", role: "KBA", active: true }
    ],
    deletedUsers: []
  };
  const device = {
    users: [{ id: "u-owner", username: "JOHN", role: "SystemOwner" }, { id: "u-developer", username: "KBA", role: "KBA" }],
    deletedUsers: [
      { id: "d1", userId: "x", username: "x", deletedAt: "2026-09-28T20:51:11.778Z" },
      { id: "d2", userId: "u-superadmin", username: "KBA", deletedAt: "2026-09-20T16:37:24.316Z" }
    ]
  };
  const usernames = mergeStates(device, cloud).users.map((user) => user.username).sort();
  assert.deepEqual(usernames, ["JOHN", "KBA"]);
});

test("cloud snapshot never carries password hashes of any format, plaintext or hints", async () => {
  const strong = await hashPassword("Collector#2026");
  const cloud = sanitizeStateForCloud({
    users: [
      { id: "u1", username: "Baba", role: "Collector", passwordHash: strong, loginPasswordHint: "Collector#2026", password: "Collector#2026" },
      { id: "u2", username: "Old", role: "Collector", passwordHash: legacyHash("1234") }
    ]
  });
  assert.deepEqual(cloud.users.map((user) => user.passwordHash), ["[protected]", "[protected]"]);
  assert.equal(cloud.users[0].loginPasswordHint, undefined);
  assert.equal(cloud.users[0].password, undefined);
  assert.doesNotMatch(JSON.stringify(cloud), /pbkdf2:|Collector#2026/);
});

test("a fresh device cannot verify passwords from the cloud copy; it signs in through the server and keeps its own hash", async () => {
  const strong = await hashPassword("Collector#2026");
  const cloud = sanitizeStateForCloud({ users: [{ id: "u1", username: "Baba", passwordHash: strong, active: true }] });
  const onNewPhone = restoreUsersFromCloud([], cloud.users);
  assert.equal(await verifyPassword("Collector#2026", onNewPhone[0].passwordHash), false, "the new device must use staff-login");
  const deviceHash = await hashPassword("Collector#2026");
  const afterServerSignIn = restoreUsersFromCloud([{ id: "u1", username: "Baba", passwordHash: deviceHash }], cloud.users);
  assert.equal(await verifyPassword("Collector#2026", afterServerSignIn[0].passwordHash), true, "the device's own hash survives later merges");
});

test("a device-local authenticator survives merges with the cloud copy, which never holds it", () => {
  const local = [{ id: "u1", username: "John", role: "SystemOwner", mfaSecret: "LOCALSECRET", mfaEnabled: true, mfaConfirmedAt: "2026-09-01" }];
  const cloud = sanitizeStateForCloud({ users: local });
  assert.equal(cloud.users[0].mfaSecret, undefined);
  const merged = restoreUsersFromCloud(local, cloud.users);
  assert.equal(merged[0].mfaSecret, "LOCALSECRET");
  assert.equal(merged[0].mfaEnabled, true);
});

test("local password hint is dropped once the password changed on another device", async () => {
  const oldHash = await hashPassword("old-pass");
  const newHash = await hashPassword("new-pass");
  const local = [{ username: "Baba", passwordHash: oldHash, loginPasswordHint: "old-pass" }];
  const same = restoreUsersFromCloud(local, [{ username: "Baba", passwordHash: oldHash }]);
  assert.equal(same[0].loginPasswordHint, "old-pass");
  const changed = restoreUsersFromCloud(local, [{ username: "Baba", passwordHash: newHash }]);
  assert.equal(changed[0].passwordHash, newHash);
  assert.equal(changed[0].loginPasswordHint, undefined);
});

test("portal balance subtracts ledger debits recorded with direction", () => {
  const state = {
    ledgerEntries: [
      { customerId: "c1", amount: 3580, direction: "credit", reversed: false },
      { customerId: "c1", amount: 500, direction: "debit", reversed: false },
      { account: "account:cash", amount: 3580, direction: "debit", reversed: false }
    ]
  };
  assert.equal(portalAccountBalance(state, "c1"), 3080);
});
