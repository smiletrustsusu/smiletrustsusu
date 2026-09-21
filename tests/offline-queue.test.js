import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueOfflineOperation
} from "../src/sync/offline-queue.js";
import { isDuplicateIdempotencyKey as dupInState } from "../src/core/receipts.js";

test("offline queue rejects duplicate idempotency keys", () => {
  const state = { offlineQueue: [], collections: [] };
  enqueueOfflineOperation(state, {
    kind: "collection",
    idempotencyKey: "key-1",
    payload: { amount: 10 }
  });
  const again = enqueueOfflineOperation(state, {
    kind: "collection",
    idempotencyKey: "key-1",
    payload: { amount: 10 }
  });
  assert.equal(state.offlineQueue.length, 1);
  assert.equal(again.idempotencyKey, "key-1");
});

test("applied queue item prevents duplicate payment in state check", () => {
  const state = {
    offlineQueue: [{ idempotencyKey: "key-2", status: "applied" }],
    collections: []
  };
  assert.equal(dupInState(state, "key-2"), true);
});
