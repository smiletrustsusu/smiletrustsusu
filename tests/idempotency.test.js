import test from "node:test";
import assert from "node:assert/strict";
import {
  generateIdempotencyKey,
  isValidIdempotencyKey,
  beginIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
  cancelIdempotentRequest,
  expireIdempotencyKeys,
  cleanupExpiredIdempotencyKeys,
  replayIdempotentEvent,
  executeIdempotent,
  idempotencyMetrics,
  EXACTLY_ONCE,
  requestFingerprint
} from "../src/core/idempotency.js";
import { isDuplicateIdempotencyKey } from "../src/core/receipts.js";
import { processMomoCallback, parseMomoWebhookPayload, applyMomoWebhookVerification } from "../src/core/momo-webhook.js";
import { recordAuditEvent, withClassATransaction } from "../src/core/audit-ops.js";
import { queueNotification, defaultNotificationTemplates } from "../src/core/notifications.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

function empty() {
  return { collections: [], notifications: [], notificationTemplates: defaultNotificationTemplates() };
}

test("exactly-once delivery is not advertised outside the trusted boundary", () => {
  assert.equal(EXACTLY_ONCE.persistence, "trusted-boundary");
  assert.equal(EXACTLY_ONCE.businessEffects, "trusted-boundary");
  assert.equal(EXACTLY_ONCE.publication, "at-least-once");
  assert.equal(EXACTLY_ONCE.delivery, "not-guaranteed");
});

test("rejects sequential keys and accepts UUID or composite device keys", () => {
  assert.equal(isValidIdempotencyKey("12345"), false);
  assert.equal(isValidIdempotencyKey(""), false);
  assert.equal(isValidIdempotencyKey(generateIdempotencyKey()), true);
  assert.equal(isValidIdempotencyKey("dev1:col1:2026-09-02T10:00:00Z"), true);
  assert.equal(isValidIdempotencyKey("idem-123-abc"), true);
});

test("client retry returns the original collection and does not post twice", () => {
  const state = empty();
  const key = "retry-collection-key-001";
  const first = executeIdempotent(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 20, date: "2026-09-09" }
  }, () => {
    state.collections.push({ id: "col-1", amount: 20, idempotencyKey: key, customerId: "c1" });
    recordAuditEvent(state, { action: "Collection recorded", details: "Ama", idempotencyKey: `${key}:audit`, transactionId: "col-1" }, uid);
    return { ok: true, transactionId: "col-1", receiptNumber: "RCP-1", responsePayload: { id: "col-1" } };
  }, uid);
  const second = executeIdempotent(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 20, date: "2026-09-09" }
  }, () => {
    state.collections.push({ id: "col-2", amount: 20, idempotencyKey: key });
    return { ok: true, transactionId: "col-2" };
  }, uid);
  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(state.collections.length, 1);
  assert.equal(state.audit.length, 1);
  assert.equal(isDuplicateIdempotencyKey(state, key), true);
});

test("fingerprint mismatch is a conflict", () => {
  const state = empty();
  const key = "conflict-key-aaaaaaaa";
  executeIdempotent(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 20 }
  }, () => ({ ok: true, transactionId: "col-1" }), uid);
  const clash = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 50 }
  }, uid);
  assert.equal(clash.conflict, true);
  assert.match(clash.error, /Conflict/i);
});

test("concurrent processing lock returns 409 and does not run work twice", () => {
  const state = empty();
  const key = "lock-key-aaaaaaaaaaaa";
  const first = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 10 },
    lockMs: 30000,
    now: 1_000_000
  }, uid);
  const second = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 10 },
    now: 1_000_100
  }, uid);
  assert.equal(first.proceed, true);
  assert.equal(second.processing, true);
  assert.equal(second.statusCode, 409);
  assert.equal(second.proceed, false);
});

test("recoverable failure allows retry; permanent failure does not", () => {
  const state = empty();
  const key = "fail-key-aaaaaaaaaaaa";
  beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 10 }
  }, uid);
  failIdempotentRequest(state, key, { recoverable: true, error: "timeout" });
  const retry = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 10 }
  }, uid);
  assert.equal(retry.proceed, true);
  failIdempotentRequest(state, key, { recoverable: false, error: "Customer suspended" });
  const blocked = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 10 }
  }, uid);
  assert.equal(blocked.proceed, false);
  assert.match(blocked.error, /suspended|Permanent/i);
});

test("Class A rollback does not leave a succeeded key", () => {
  const state = { collections: [], audit: [] };
  const key = "classa-key-aaaaaaaaaa";
  beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 20 }
  }, uid);
  const result = withClassATransaction(state, ["collections", "audit"], () => {
    state.collections.push({ id: "col-x", amount: 20 });
    return recordAuditEvent(state, { action: "Collection recorded", details: "x", forcePersistFailure: true }, uid);
  });
  failIdempotentRequest(state, key, { recoverable: true, error: result.error });
  assert.equal(state.collections.length, 0);
  assert.equal(state.idempotencyKeys[0].requestStatus, "failed");
  assert.equal(state.idempotencyKeys[0].failureClass, "recoverable");
});

test("duplicate MoMo callbacks verify once", () => {
  const state = {
    collections: [{
      id: "c1",
      paymentMethod: "Mobile Money",
      paymentReference: "MTN999888",
      verificationStatus: "Pending Verification",
      reversed: false
    }]
  };
  const webhook = parseMomoWebhookPayload({ reference: "mtn999888", status: "success", amount: 20 });
  const first = processMomoCallback(state, webhook, { uid });
  const second = processMomoCallback(state, webhook, { uid });
  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(state.collections[0].verificationStatus, "Verified");
  const metrics = idempotencyMetrics(state);
  assert.ok(metrics.duplicateCallbacksIgnored >= 1 || metrics.duplicateRequestsPrevented >= 1);
});

test("already verified collection is ignored without rewriting money", () => {
  const state = {
    collections: [{
      id: "c1",
      paymentMethod: "Mobile Money",
      paymentReference: "MTN111222",
      verificationStatus: "Verified",
      reversed: false
    }]
  };
  const webhook = parseMomoWebhookPayload({ reference: "MTN111222", status: "success" });
  const result = applyMomoWebhookVerification(state, webhook);
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
});

test("replay returns the original outcome and does not recreate the transaction", () => {
  const state = empty();
  const key = "replay-key-aaaaaaaaaa";
  executeIdempotent(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 15 }
  }, () => {
    state.collections.push({ id: "col-r", amount: 15 });
    return { ok: true, transactionId: "col-r", responsePayload: { id: "col-r" } };
  }, uid);
  const replay = replayIdempotentEvent(state, key);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.response.id, "col-r");
  assert.equal(state.collections.length, 1);
});

test("expiration and cleanup never delete business records", () => {
  const state = empty();
  const key = "expire-key-aaaaaaaaaa";
  executeIdempotent(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 5 },
    now: Date.parse("2020-01-01T00:00:00.000Z")
  }, () => {
    state.collections.push({ id: "col-e", amount: 5 });
    return { ok: true, transactionId: "col-e" };
  }, uid);
  state.idempotencyKeys[0].expiresAt = "2020-02-01T00:00:00.000Z";
  expireIdempotencyKeys(state, { now: Date.parse("2021-01-01T00:00:00.000Z") });
  const cleaned = cleanupExpiredIdempotencyKeys(state, { now: Date.parse("2021-01-01T00:00:00.000Z") });
  assert.equal(cleaned.archived, 1);
  assert.equal(state.collections.length, 1);
  assert.equal(state.idempotencyArchives.length, 1);
});

test("cancelled keys cannot be reused", () => {
  const state = empty();
  const key = "cancel-key-aaaaaaaaaa";
  beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 8 }
  }, uid);
  cancelIdempotentRequest(state, key);
  const again = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 8 }
  }, uid);
  assert.equal(again.proceed, false);
  assert.equal(again.status, "cancelled");
});

test("notification duplicate does not enqueue twice", () => {
  const state = empty();
  const first = queueNotification(state, {
    event: "contribution_received",
    channel: "In-App",
    vars: { name: "Ama", amount: "20.00", receiptNo: "R1", balance: "20.00" },
    uid,
    idempotencyKey: "ntf-dup-key-aaaaaaa"
  });
  const second = queueNotification(state, {
    event: "contribution_received",
    channel: "In-App",
    vars: { name: "Ama", amount: "20.00", receiptNo: "R1", balance: "20.00" },
    uid,
    idempotencyKey: "ntf-dup-key-aaaaaaa"
  });
  assert.equal(second.duplicate, true);
  assert.equal(state.notifications.length, 1);
  assert.equal(first.notification.id, second.notification.id);
});

test("request fingerprints differ when amount changes", () => {
  const a = requestFingerprint({ operationType: "savings.collection", customerId: "c1", amount: 20 });
  const b = requestFingerprint({ operationType: "savings.collection", customerId: "c1", amount: 21 });
  assert.notEqual(a, b);
});

test("completeIdempotentRequest is exported for collection commit", () => {
  const state = empty();
  const key = "complete-key-aaaaaaaa";
  beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "savings.collection",
    fingerprint: { operationType: "savings.collection", customerId: "c1", amount: 1 }
  }, uid);
  const done = completeIdempotentRequest(state, key, { transactionId: "t1", receiptNumber: "R1" });
  assert.equal(done.record.requestStatus, "succeeded");
  assert.equal(done.record.receiptNumber, "R1");
});
