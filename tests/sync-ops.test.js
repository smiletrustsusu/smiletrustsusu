import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  ensureSyncState,
  enqueueSyncItem,
  processSyncQueue,
  nextLocalSequence,
  detectConflicts,
  resolveConflict,
  canPerformOffline,
  revokeDevice,
  authorizeDevice,
  lastCheckpoint,
  connectivityStatus,
  issueLocalReceipt,
  promoteReceipt,
  retrySyncItem,
  syncDashboard,
  aggregateIdFor,
  HIGH_RISK_OPS
} from "../src/core/sync-ops.js";
import { enqueueOfflineOperation } from "../src/sync/offline-queue.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };

function blank() {
  return {
    settings: { encryptOfflineQueue: true, loanInterest: 15, currency: "GHS" },
    customers: [{ id: "c-a", name: "Ama", active: true, phone: "024111" }, { id: "c-b", name: "Kofi", active: true, phone: "024222" }],
    collections: [],
    devices: [{ id: "dev-1", fingerprint: "fp-1", active: true, localSequence: 0, label: "Android" }],
    offlineQueue: []
  };
}

function applyOk() {
  return true;
}

test("legacy enqueue still rejects duplicate idempotency keys", () => {
  const state = { offlineQueue: [] };
  enqueueOfflineOperation(state, { kind: "collection", idempotencyKey: "key-1", payload: { amount: 10 } });
  const again = enqueueOfflineOperation(state, { kind: "collection", idempotencyKey: "key-1", payload: { amount: 10 } });
  assert.equal(state.offlineQueue.length, 1);
  assert.equal(again.idempotencyKey, "key-1");
});

test("every offline transaction gets a unique local sequence that never decreases", () => {
  const state = blank();
  const first = enqueueSyncItem(state, { kind: "collection", idempotencyKey: "k1", payload: { customerId: "c-a", id: "col-1" }, deviceId: "dev-1" }, uid);
  const second = enqueueSyncItem(state, { kind: "collection", idempotencyKey: "k2", payload: { customerId: "c-b", id: "col-2" }, deviceId: "dev-1" }, uid);
  assert.equal(first.localSequence, 1);
  assert.equal(second.localSequence, 2);
  assert.equal(nextLocalSequence(state, "dev-1"), 3);
  const dup = enqueueSyncItem(state, { kind: "collection", idempotencyKey: "k1", payload: { customerId: "c-a" }, deviceId: "dev-1" }, uid);
  assert.equal(dup.id, first.id);
  assert.equal(first.localSequence, 1);
});

test("server sequence is assigned only after successful apply", () => {
  const state = blank();
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "k1", payload: { customerId: "c-a", id: "col-1" }, deviceId: "dev-1" }, uid);
  assert.equal(state.offlineQueue[0].serverSequence, null);
  const result = processSyncQueue(state, applyOk, { deviceId: "dev-1", user: owner, uid });
  assert.equal(result.ok, true);
  assert.equal(state.offlineQueue[0].serverSequence, 1);
  assert.equal(state.offlineQueue[0].status, "applied");
});

test("ordering uses local sequence, not device timestamps", () => {
  const state = blank();
  const later = enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "later",
    payload: { customerId: "c-a", id: "col-2" },
    deviceId: "dev-1",
    createdTimestamp: "2026-01-02T00:00:00.000Z"
  }, uid);
  const earlierTs = enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "earlier-ts",
    payload: { customerId: "c-b", id: "col-1" },
    deviceId: "dev-1",
    createdTimestamp: "2026-01-01T00:00:00.000Z"
  }, uid);
  assert.ok(later.localSequence < earlierTs.localSequence);
  const applied = [];
  processSyncQueue(state, (entry) => { applied.push(entry.idempotencyKey); return true; }, { deviceId: "dev-1", uid });
  assert.deepEqual(applied, ["later", "earlier-ts"]);
});

test("same aggregate is processed sequentially; independent customers continue", () => {
  const state = blank();
  state.customers = [{ id: "c-b", name: "Kofi", active: true }];
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "a1", payload: { customerId: "c-a", id: "col-a" }, deviceId: "dev-1" }, uid);
  enqueueSyncItem(state, { kind: "withdrawal", idempotencyKey: "a2", payload: { customerId: "c-a", id: "wd-a" }, deviceId: "dev-1" }, uid);
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "b1", payload: { customerId: "c-b", id: "col-b" }, deviceId: "dev-1" }, uid);
  const result = processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  const a1 = state.offlineQueue.find((item) => item.idempotencyKey === "a1");
  const a2 = state.offlineQueue.find((item) => item.idempotencyKey === "a2");
  const b1 = state.offlineQueue.find((item) => item.idempotencyKey === "b1");
  assert.equal(a1.status, "conflict_detected");
  assert.equal(a2.status, "pending");
  assert.equal(b1.status, "applied");
  assert.equal(result.session.conflicts, 1);
});

test("dependency chain waits until the prerequisite is applied", () => {
  const state = blank();
  const customer = enqueueSyncItem(state, { kind: "customer", idempotencyKey: "cust", payload: { id: "c-new" }, deviceId: "dev-1" }, uid);
  const collection = enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "first-col",
    payload: { customerId: "c-a", id: "col-new" },
    deviceId: "dev-1",
    dependsOn: [customer.id]
  }, uid);
  let allowCustomer = false;
  processSyncQueue(state, (entry) => {
    if (entry.kind === "customer" && !allowCustomer) return false;
    return true;
  }, { deviceId: "dev-1", uid });
  assert.equal(customer.status, "retrying");
  assert.equal(collection.status, "pending");
  allowCustomer = true;
  customer.status = "pending";
  processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  assert.equal(customer.status, "applied");
  assert.equal(collection.status, "applied");
  assert.ok(collection.serverSequence > customer.serverSequence);
});

test("conflict does not reorder dependents; business rule rejects client-wins for money", () => {
  const state = blank();
  state.customers = [];
  const item = enqueueSyncItem(state, { kind: "collection", idempotencyKey: "c1", payload: { customerId: "c-a", id: "col-1" }, deviceId: "dev-1" }, uid);
  processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  assert.equal(item.status, "conflict_detected");
  const conflict = state.syncConflicts[0];
  const rejected = resolveConflict(state, conflict.id, "client_wins", owner, uid);
  assert.match(rejected.error, /last-write-wins|client-wins/i);
  const resolved = resolveConflict(state, conflict.id, "manual", owner, uid);
  assert.equal(resolved.ok, true);
  assert.equal(item.status, "pending");
});

test("replay keeps original sequences and does not duplicate effects", () => {
  const state = blank();
  const posted = [];
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "once", payload: { customerId: "c-a", id: "col-1" }, deviceId: "dev-1" }, uid);
  const seq = state.offlineQueue[0].localSequence;
  processSyncQueue(state, (entry) => { posted.push(entry.payload.id); return true; }, { deviceId: "dev-1", uid });
  processSyncQueue(state, (entry) => { posted.push(entry.payload.id); return true; }, { deviceId: "dev-1", uid });
  assert.deepEqual(posted, ["col-1"]);
  assert.equal(state.offlineQueue[0].localSequence, seq);
  assert.equal(state.offlineQueue[0].serverSequence, 1);
});

test("interrupted sync resumes from checkpoint without renumbering", () => {
  const state = blank();
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "one", payload: { customerId: "c-a", id: "col-1" }, deviceId: "dev-1" }, uid);
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "two", payload: { customerId: "c-b", id: "col-2" }, deviceId: "dev-1" }, uid);
  const first = processSyncQueue(state, applyOk, { deviceId: "dev-1", uid, crashAfter: 1 });
  assert.equal(first.interrupted, true);
  assert.equal(state.offlineQueue[0].localSequence, 1);
  assert.equal(state.offlineQueue[1].localSequence, 2);
  assert.equal(state.offlineQueue[0].status, "applied");
  assert.equal(state.offlineQueue[1].status, "pending");
  assert.equal(lastCheckpoint(state, "dev-1").lastLocalSequence, 1);
  processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  assert.equal(state.offlineQueue[1].status, "applied");
  assert.equal(state.offlineQueue[1].localSequence, 2);
  assert.equal(state.offlineQueue[1].serverSequence, 2);
});

test("revoked devices cannot enqueue or synchronize", () => {
  const state = blank();
  authorizeDevice(state, state.devices[0], owner, uid);
  revokeDevice(state, "dev-1", owner, uid);
  const queued = enqueueSyncItem(state, { kind: "collection", idempotencyKey: "x", payload: { customerId: "c-a" }, deviceId: "dev-1" }, uid);
  assert.match(queued.error, /revoked/);
  state.offlineQueue.push({
    id: "q-old",
    kind: "collection",
    idempotencyKey: "old",
    status: "pending",
    localSequence: 1,
    deviceId: "dev-1",
    payload: { customerId: "c-a" }
  });
  const result = processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  assert.match(result.error, /revoked/);
});

test("high-risk actions require connectivity unless configured", () => {
  const state = blank();
  ensureSyncState(state);
  HIGH_RISK_OPS.forEach((op) => {
    assert.equal(canPerformOffline(state, op, { online: false }).ok, false);
    assert.equal(canPerformOffline(state, op, { online: true }).ok, true);
  });
  assert.equal(canPerformOffline(state, "savings.collection", { online: false }).ok, true);
  assert.equal(canPerformOffline(state, "customer.create", { online: false }).ok, true);
});

test("offline receipts map to permanent numbers after sync", () => {
  const state = blank();
  enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "rcp",
    payload: { customerId: "c-a", id: "col-1", receiptNo: "RCP-00000001", temporaryReceiptNo: "RCP-00000001" },
    deviceId: "dev-1"
  }, uid);
  processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  assert.equal(state.localReceipts[0].temporaryReceiptNo, "RCP-00000001");
  assert.match(state.localReceipts[0].permanentReceiptNo, /^SRV-/);
  assert.equal(state.offlineQueue[0].payload.permanentReceiptNo, state.localReceipts[0].permanentReceiptNo);
  const issued = issueLocalReceipt(state, { temporaryReceiptNo: "OFF-9", transactionId: "t9" }, uid);
  assert.equal(promoteReceipt(state, "OFF-9", "SRV-00000009").ok, true);
  assert.equal(issued.permanentReceiptNo, "SRV-00000009");
});

test("large independent batch applies in local sequence order", () => {
  const state = blank();
  state.customers = Array.from({ length: 120 }, (_, i) => ({ id: `c-${i}`, name: `C${i}`, active: true }));
  for (let i = 0; i < 120; i += 1) {
    enqueueSyncItem(state, {
      kind: "collection",
      idempotencyKey: `bulk-${i}`,
      payload: { customerId: `c-${i}`, id: `col-${i}` },
      deviceId: "dev-1"
    }, uid);
  }
  const order = [];
  processSyncQueue(state, (entry) => { order.push(entry.localSequence); return true; }, { deviceId: "dev-1", uid });
  assert.equal(order.length, 120);
  assert.deepEqual(order, Array.from({ length: 120 }, (_, i) => i + 1));
  assert.equal(syncDashboard(state).applied, 120);
});

test("connectivity labels and collector can view the queue", () => {
  assert.equal(connectivityStatus({ online: false }), "offline");
  assert.equal(connectivityStatus({ online: true, synchronizing: true }), "synchronizing");
  assert.equal(connectivityStatus({ online: true, effectiveType: "2g" }), "poor_network");
  assert.equal(canAction({ role: "Collector" }, "Sync.View"), true);
  assert.equal(canAction({ role: "Collector" }, "Sync.Resolve"), false);
  assert.equal(canAction({ role: "Auditor" }, "Sync.View"), true);
  assert.equal(canAction({ role: "Auditor" }, "Sync.Retry"), false);
  assert.equal(aggregateIdFor("collection", { customerId: "c-a" }), "SAVINGS_ACCOUNT:c-a");
});

test("retry is blocked while a conflict is open", () => {
  const state = blank();
  state.customers = [];
  enqueueSyncItem(state, { kind: "collection", idempotencyKey: "z", payload: { customerId: "c-a", id: "col-z" }, deviceId: "dev-1" }, uid);
  processSyncQueue(state, applyOk, { deviceId: "dev-1", uid });
  const blocked = retrySyncItem(state, state.offlineQueue[0].id);
  assert.match(blocked.error, /conflict/i);
});

test("detectConflicts flags a revoked device", () => {
  const state = blank();
  state.devices[0].active = false;
  const reasons = detectConflicts(state, { deviceId: "dev-1", kind: "note", payload: {}, idempotencyKey: "n1" });
  assert.ok(reasons.includes("revoked_device"));
});
