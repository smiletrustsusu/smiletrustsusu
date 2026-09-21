import test from "node:test";
import assert from "node:assert/strict";
import { isValidMomoReference, isDuplicateMomoReference, verifyMomoPaymentLocally } from "../src/core/momo.js";

test("rejects invalid MoMo reference", () => {
  const state = { collections: [] };
  const result = verifyMomoPaymentLocally(state, {
    paymentMethod: "Mobile Money",
    paymentReference: "abc"
  });
  assert.equal(result.ok, false);
});

test("detects duplicate MoMo reference", () => {
  const state = {
    collections: [{
      id: "c1",
      paymentMethod: "Mobile Money",
      paymentReference: "MTN123456",
      reversed: false
    }]
  };
  assert.equal(isDuplicateMomoReference(state, "MTN123456"), true);
  const result = verifyMomoPaymentLocally(state, {
    paymentMethod: "Mobile Money",
    paymentReference: "MTN123456"
  });
  assert.equal(result.ok, false);
});

test("accepts valid unique MoMo reference", () => {
  assert.equal(isValidMomoReference("MTN123456789"), true);
  const state = { collections: [] };
  assert.equal(verifyMomoPaymentLocally(state, {
    paymentMethod: "Mobile Money",
    paymentReference: "MTN123456789"
  }).ok, true);
});

test("GAP-019 parseMomoWebhookPayload converts major-unit GHS to pesewas", async () => {
  const { parseMomoWebhookPayload, normalizeProviderAmountToPesewas, webhookAmountMatchesCollection } =
    await import("../src/core/momo-webhook.js");
  const parsed = parseMomoWebhookPayload({
    reference: "MTN555666777",
    amount: 12.5,
    status: "success"
  });
  assert.equal(parsed.amount, 12.5);
  assert.equal(parsed.amountPesewas, 1250);
  assert.equal(normalizeProviderAmountToPesewas(10), 1000);
  assert.equal(normalizeProviderAmountToPesewas(1000, "pesewas"), 1000);

  const matchOk = webhookAmountMatchesCollection(parsed, {
    amountPesewas: 1250,
    paymentMethod: "Mobile Money"
  });
  assert.equal(matchOk.checked, true);
  assert.equal(matchOk.ok, true);

  const matchBad = webhookAmountMatchesCollection(parsed, { amount: 11 });
  assert.equal(matchBad.checked, true);
  assert.equal(matchBad.ok, false);

  const skip = webhookAmountMatchesCollection(parsed, { paymentMethod: "Mobile Money" });
  assert.equal(skip.checked, false);
  assert.equal(skip.ok, true);
});
