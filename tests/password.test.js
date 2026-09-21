import test from "node:test";
import assert from "node:assert/strict";
import { legacyHash, hashPassword, verifyPassword } from "../src/password.js";

test("legacy hash verifies old passwords", async () => {
  const hash = legacyHash("test-pass");
  assert.equal(hash.startsWith("kba-"), true);
  assert.equal(await verifyPassword("test-pass", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("pbkdf2 hash verifies new passwords", async () => {
  const hash = await hashPassword("secure-pass");
  assert.equal(hash.startsWith("pbkdf2:"), true);
  assert.equal(await verifyPassword("secure-pass", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("legacy hash upgrades on verify path", async () => {
  const legacy = legacyHash("upgrade-me");
  assert.equal(await verifyPassword("upgrade-me", legacy), true);
  const modern = await hashPassword("upgrade-me");
  assert.notEqual(modern, legacy);
  assert.equal(await verifyPassword("upgrade-me", modern), true);
});
