import test from "node:test";
import assert from "node:assert/strict";
import { generateTotpCode, verifyTotpCode, generateTotpSecret } from "../src/core/totp.js";
import {
  beginMfaSetup,
  confirmMfaSetup,
  verifyUserMfa,
  mfaRequiredForUser
} from "../src/core/mfa.js";
import { applyMomoWebhookVerification, parseMomoWebhookPayload } from "../src/core/momo-webhook.js";

test("TOTP generates and verifies 6-digit code", async () => {
  const secret = generateTotpSecret();
  const code = await generateTotpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(await verifyTotpCode(secret, code), true);
});

test("MFA setup flow enables after valid token", async () => {
  const user = { id: "u1", role: "KBA", username: "JOHN" };
  const { secret } = beginMfaSetup(user);
  const code = await generateTotpCode(secret);
  const result = await confirmMfaSetup(user, code);
  assert.equal(result.ok, true);
  assert.equal(user.mfaEnabled, true);
});

test("verifyUserMfa requires code when enabled", async () => {
  const user = { id: "u1", role: "KBA", mfaEnabled: true, mfaSecret: generateTotpSecret() };
  const code = await generateTotpCode(user.mfaSecret);
  assert.equal((await verifyUserMfa(user, code)).ok, true);
  assert.equal((await verifyUserMfa(user, "000000")).ok, false);
});

test("mfaRequiredForUser includes KBA and Admin", () => {
  assert.equal(mfaRequiredForUser({ role: "SystemOwner" }), true);
  assert.equal(mfaRequiredForUser({ role: "KBA" }), true);
  assert.equal(mfaRequiredForUser({ role: "Collector" }), false);
});

test("MoMo webhook verifies matching collection", () => {
  const state = {
    collections: [{
      id: "c1",
      paymentMethod: "Mobile Money",
      paymentReference: "MM123456",
      verificationStatus: "Pending Verification",
      reversed: false
    }]
  };
  const webhook = parseMomoWebhookPayload({ reference: "mm123456", status: "success" });
  const result = applyMomoWebhookVerification(state, webhook);
  assert.equal(result.ok, true);
  assert.equal(result.collection.verificationStatus, "Verified");
});
