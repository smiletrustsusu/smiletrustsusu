import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReceiptNo,
  buildIdempotencyKey,
  isDuplicateIdempotencyKey
} from "../src/core/receipts.js";

test("receipt numbers are sequential and prefixed", () => {
  const state = { settings: { lastReceiptSequence: 0 } };
  const first = buildReceiptNo(state, "c13");
  const second = buildReceiptNo(state, "c13");
  assert.match(first, /^C13-\d{8}$/);
  assert.notEqual(first, second);
  assert.equal(state.settings.lastReceiptSequence, 2);
});

test("duplicate idempotency keys are detected", () => {
  const state = {
    collections: [{ idempotencyKey: "abc-123" }],
    offlineQueue: []
  };
  assert.equal(isDuplicateIdempotencyKey(state, "abc-123"), true);
  assert.equal(isDuplicateIdempotencyKey(state, "new-key"), false);
});

test("idempotency keys can be built from device context", () => {
  const key = buildIdempotencyKey({ deviceId: "dev1", clientId: "col1", timestamp: "2026-09-02T10:00:00Z" });
  assert.match(key, /dev1:col1:2026-09-02T10:00:00Z/);
});
