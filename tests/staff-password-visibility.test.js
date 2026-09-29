import test from "node:test";
import assert from "node:assert/strict";
import {
  canViewStaffLoginPassword,
  staffLoginPasswordDisplay,
  setStaffLoginPasswordHint,
  listUsersForActor,
  SYSTEM_OWNER_ID,
  SUPER_ADMIN_ID
} from "../src/core/system-accounts.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("JOHN can view agent loginPasswordHint; collectors cannot", () => {
  const john = { id: SYSTEM_OWNER_ID, role: "SystemOwner", systemOwner: true, username: "JOHN" };
  const collectorPeer = { id: "u-col-a", role: "Collector", username: "ama" };
  const agent = {
    id: "u-col-b",
    role: "Collector",
    username: "kofi",
    passwordHash: "argon-or-kba-hash",
    loginPasswordHint: "TempPass123"
  };
  const kba = { id: SUPER_ADMIN_ID, role: "KBA", username: "KBA", systemDeveloper: true };

  assert.equal(canViewStaffLoginPassword(john, agent), true);
  assert.equal(staffLoginPasswordDisplay(agent), "TempPass123");
  assert.equal(canViewStaffLoginPassword(collectorPeer, agent), false);
  assert.equal(canViewStaffLoginPassword(john, kba), false);
  assert.equal(listUsersForActor([agent, kba], john).some((u) => u.id === SUPER_ADMIN_ID), false);
});

test("setStaffLoginPasswordHint stores displayable password without replacing hash", () => {
  const user = { id: "u1", passwordHash: "keep-hash" };
  setStaffLoginPasswordHint(user, "PlainVisible");
  assert.equal(user.loginPasswordHint, "PlainVisible");
  assert.equal(user.passwordHash, "keep-hash");
  assert.equal(staffLoginPasswordDisplay({ password: "demoPlain" }), "demoPlain");
});

test("Staff table wires password column for owner", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /canViewStaffLoginPassword/);
  assert.match(app, /staffLoginPasswordDisplay/);
  assert.match(app, /loginPasswordHint/);
  assert.match(app, /setStaffLoginPasswordHint/);
});
