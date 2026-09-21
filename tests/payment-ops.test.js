import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canPerformOffline } from "../src/core/sync-ops.js";
import {
  ensurePaymentState,
  initiatePayment,
  registerBusinessPayment,
  processPaymentCallback,
  processPaymentQueue,
  createRefund,
  createReversal,
  recordSettlement,
  reconcilePayments,
  signPaymentPayload,
  validatePaymentRequest,
  registerProviderAdapter,
  upsertProvider,
  selectProvider,
  paymentReports,
  exportPaymentCsv,
  assertEngineBoundary,
  FORBIDDEN_CUSTOMER_FIELDS,
  UNSUPPORTED_RESPONSIBILITIES,
  FAILURE_OWNERSHIP,
  transitionPayment,
  cancelPayment,
  canTransitionPayment,
  executeWorkflowStage,
  markAccountingPosted,
  setOwnerHealth,
  failbackStageOwner,
  acquireStageLock,
  STATE_OWNERS,
  WORKFLOW_STAGES
} from "../src/core/payment-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const now = "2026-09-10T12:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", momoWebhookSecret: "whsec-test", loanInterest: 15 },
    collections: [],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    notifications: [],
    notificationTemplates: {}
  };
  ensurePaymentState(state);
  return state;
}

function signedEnvelope(state, body, providerId = "prov-mtn") {
  const timestamp = now;
  return {
    providerId,
    body,
    timestamp,
    signature: signPaymentPayload(state.settings.momoWebhookSecret, body, timestamp),
    reference: body.reference
  };
}

test("payment engine is orchestration only and never stores customer PINs", () => {
  const boundary = assertEngineBoundary();
  assert.equal(boundary.orchestrates, true);
  assert.equal(boundary.storesCustomerPins, false);
  assert.equal(boundary.simulatesProviderApproval, false);
  assert.ok(UNSUPPORTED_RESPONSIBILITIES.includes("Mobile wallet management"));
  assert.ok(FORBIDDEN_CUSTOMER_FIELDS.includes("pin"));
  const state = blank();
  const rejected = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 20,
    paymentReference: "MTN999888",
    customerId: "c-a",
    pin: "1234"
  }, owner, uid, now);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /never request or store/i);
});

test("cash payments complete internally; electronic payments stay pending until the provider callback", () => {
  const state = blank();
  const cash = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 10,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-1"
  }, owner, uid, now);
  assert.equal(cash.ok, true);
  assert.equal(cash.payment.status, "completed");
  assert.equal(cash.payment.transactionStatus, "posted");

  const momo = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 15,
    customerId: "c-a",
    paymentReference: "MTN555666",
    businessType: "collection",
    businessId: "col-2"
  }, owner, uid, now);
  assert.equal(momo.ok, true);
  assert.equal(momo.payment.status, "pending_provider");
  assert.notEqual(momo.payment.status, "completed");
});

test("duplicate initiation and duplicate callbacks cannot create a second business effect", () => {
  const state = blank();
  state.collections.push({
    id: "col-9",
    paymentMethod: "MTN Mobile Money",
    paymentReference: "MTN777888",
    amount: 30,
    customerId: "c-a",
    verificationStatus: "Pending Verification",
    reversed: false
  });
  const first = registerBusinessPayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 30,
    customerId: "c-a",
    paymentReference: "MTN777888",
    businessType: "collection",
    businessId: "col-9"
  }, owner, uid, now);
  const again = registerBusinessPayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 30,
    customerId: "c-a",
    paymentReference: "MTN777888",
    businessType: "collection",
    businessId: "col-9"
  }, owner, uid, now);
  assert.equal(again.duplicate, true);
  assert.equal(again.payment.id, first.payment.id);
  assert.equal(state.paymentTransactions.length, 1);

  const body = { reference: "MTN777888", amount: 30, status: "success" };
  const cb1 = processPaymentCallback(state, signedEnvelope(state, body), { user: owner, uid, now });
  const cb2 = processPaymentCallback(state, signedEnvelope(state, body), { user: owner, uid, now });
  assert.equal(cb1.ok, true);
  assert.equal(cb2.duplicate, true);
  assert.equal(state.collections.filter((item) => item.id === "col-9").length, 1);
  assert.equal(state.collections[0].verificationStatus, "Verified");
  assert.equal(state.paymentTransactions.filter((item) => item.businessId === "col-9").length, 1);
});

test("callback signature and replay window are enforced", () => {
  const state = blank();
  const body = { reference: "MTN111222", amount: 5, status: "success" };
  const bad = processPaymentCallback(state, {
    providerId: "prov-mtn",
    body,
    timestamp: now,
    signature: "nope",
    reference: body.reference
  }, { user: owner, uid, now });
  assert.equal(bad.ok, false);
  const stale = processPaymentCallback(state, {
    ...signedEnvelope(state, body),
    timestamp: "2020-01-01T00:00:00.000Z",
    signature: signPaymentPayload(state.settings.momoWebhookSecret, body, "2020-01-01T00:00:00.000Z")
  }, { user: owner, uid, now });
  assert.equal(stale.ok, false);
  assert.match(stale.error, /replay/i);
});

test("refunds and reversals are linked records and never rewrite the original amount", () => {
  const state = blank();
  const started = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 80,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-r"
  }, owner, uid, now);
  const originalAmount = started.payment.amount;
  const originalRef = started.payment.paymentReference;
  const refund = createRefund(state, started.payment.id, { amount: 20, partial: true, reason: "partial", user: owner, uid, now });
  assert.equal(refund.ok, true);
  assert.equal(started.payment.amount, originalAmount);
  assert.equal(started.payment.paymentReference, originalRef);
  assert.equal(refund.originalSnapshot.amount, originalAmount);
  assert.equal(state.paymentRefunds.length, 1);
  assert.equal(started.payment.status, "partially_refunded");
  const full = createRefund(state, started.payment.id, { reason: "full", user: owner, uid, now });
  assert.equal(full.ok, true);
  assert.equal(started.payment.amount, 80);
  assert.equal(started.payment.status, "fully_refunded");
});

test("reversals are linked records and cannot start from a refunded payment", () => {
  const state = blank();
  const started = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 80,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-rev"
  }, owner, uid, now);
  const reversal = createReversal(state, started.payment.id, { reason: "linked", user: owner, uid, now });
  assert.equal(reversal.ok, true);
  assert.equal(started.payment.amount, 80);
  assert.equal(started.payment.status, "fully_reversed");
  assert.equal(state.paymentReversals.length, 1);
  const refundAfter = createRefund(state, started.payment.id, { reason: "nope", user: owner, uid, now });
  assert.equal(refundAfter.ok, false);
});

test("reconciliation matches provider lines and flags amount mismatches", () => {
  const state = blank();
  initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 40,
    customerId: "c-a",
    paymentReference: "MTN404040",
    businessType: "collection",
    businessId: "col-rec"
  }, owner, uid, now);
  const rec = reconcilePayments(state, {
    source: "momo",
    lines: [
      { reference: "MTN404040", amount: 40 },
      { reference: "MTN404040", amount: 41 },
      { reference: "MISSING", amount: 10 }
    ],
    user: owner,
    uid,
    now
  });
  assert.equal(rec.matches.length, 1);
  assert.equal(rec.exceptions.length, 2);
  const settlement = recordSettlement(state, {
    providerId: "prov-mtn",
    grossAmount: 40,
    fees: 1,
    taxes: 0,
    settlementReference: "STL-1"
  }, owner, uid, now);
  assert.equal(settlement.settlement.netSettlement, 39);
});

test("provider outage fails over and crash recovery resumes the queue", () => {
  const state = blank();
  const payment = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Mobile Money",
    amount: 12,
    customerId: "c-a",
    paymentReference: "MTN121212",
    businessType: "collection",
    businessId: "col-fail"
  }, owner, uid, now);
  const health = state.providerHealth.find((item) => item.providerId === "prov-mtn");
  health.status = "down";
  health.consecutiveFailures = 5;
  const queue = state.paymentQueue.find((item) => item.paymentId === payment.payment.id);
  queue.status = "processing";
  queue.processingAt = "2026-09-10T11:00:00.000Z";
  const run = processPaymentQueue(state, { uid, now, user: owner });
  assert.equal(run.recovered, 1);
  assert.equal(payment.payment.providerId, "prov-telecel");
});

test("an electronic adapter cannot complete a payment without provider confirmation", () => {
  const state = blank();
  registerProviderAdapter({
    id: "evil",
    initiate() {
      return { ok: true, status: "completed" };
    }
  });
  upsertProvider(state, {
    id: "prov-evil",
    name: "Evil Gateway",
    methods: ["MTN Mobile Money"],
    plugin: "evil",
    status: "active",
    priority: 0
  }, owner, uid, now);
  const selected = selectProvider(state, "MTN Mobile Money");
  assert.equal(selected.id, "prov-evil");
  const result = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 9,
    customerId: "c-a",
    paymentReference: "MTN090909",
    businessType: "collection",
    businessId: "col-evil"
  }, owner, uid, now);
  assert.equal(result.ok, false);
  assert.match(result.error, /must not simulate provider approval/i);
});

test("concurrent duplicate idempotency keys return the original payment", () => {
  const state = blank();
  const req = {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 7,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-idem",
    idempotencyKey: "pay:collection:col-idem"
  };
  const a = initiatePayment(state, req, owner, uid, now);
  const b = initiatePayment(state, req, owner, uid, now);
  assert.equal(a.ok, true);
  assert.equal(b.duplicate, true);
  assert.equal(state.paymentTransactions.length, 1);
});

test("local MoMo duplicate references are rejected before a provider call", () => {
  const state = blank();
  state.collections.push({
    id: "col-old",
    paymentMethod: "Mobile Money",
    paymentReference: "MTNUSED01",
    reversed: false
  });
  const check = validatePaymentRequest(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 4,
    paymentReference: "MTNUSED01",
    customerId: "c-a"
  });
  assert.equal(check.ok, false);
});

test("failure ownership is classified and refunds are high-risk while offline", () => {
  assert.equal(FAILURE_OWNERSHIP.duplicate_callback.includes("idempotency"), true);
  assert.equal(FAILURE_OWNERSHIP.customer_incorrect_pin, "Customer");
  const state = blank();
  const offline = canPerformOffline(state, "payment.refund", { online: false });
  assert.equal(offline.ok, false);
  assert.equal(canAction({ role: "Collector" }, "Payment.View"), true);
  assert.equal(canAction({ role: "Collector" }, "Payment.Refund"), false);
  assert.equal(canAction({ role: "Auditor" }, "Payment.View"), true);
  assert.equal(canAction({ role: "Accountant" }, "Payment.Reconcile"), true);
});

test("new providers plug in without changing savings or accounting modules", () => {
  const state = blank();
  registerProviderAdapter({
    id: "hubtel",
    initiate() {
      return { ok: true, status: "pending_provider", message: "Hubtel will collect" };
    },
    parseCallback(body) {
      return { ok: true, reference: body.reference, amount: body.amount, status: body.status, providerRef: body.reference };
    }
  });
  const added = upsertProvider(state, {
    id: "prov-hubtel",
    name: "Hubtel",
    methods: ["MTN Mobile Money"],
    plugin: "hubtel",
    status: "active",
    priority: 1
  }, owner, uid, now);
  assert.equal(added.ok, true);
  const report = paymentReports(state, "payments_methods", { from: "2026-01-01", to: "2026-12-31" });
  assert.ok(Array.isArray(report.rows));
  assert.ok(exportPaymentCsv(report).includes("paymentMethod"));
});

test("cash payments walk created → validated → pending_provider → processing → completed", () => {
  const state = blank();
  const cash = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 10,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-hist"
  }, owner, uid, now);
  const trail = (cash.payment.statusHistory || []).map((item) => item.newState);
  assert.deepEqual(trail, ["validated", "pending_provider", "processing", "completed"]);
  assert.equal(canTransitionPayment("failed", "completed"), false);
});

test("invalid transitions and terminal states are rejected", () => {
  const state = blank();
  const momo = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 11,
    customerId: "c-a",
    paymentReference: "MTN111000",
    businessType: "collection",
    businessId: "col-term"
  }, owner, uid, now);
  assert.equal(momo.payment.status, "pending_provider");
  const failed = processPaymentCallback(state, signedEnvelope(state, { reference: "MTN111000", amount: 11, status: "failed" }), { user: owner, uid, now });
  assert.equal(failed.ok, true);
  assert.equal(momo.payment.status, "failed");
  const illegal = transitionPayment(state, momo.payment, "completed", { user: owner, uid, now });
  assert.equal(illegal.ok, false);
  const cancel = cancelPayment(state, momo.payment.id, { user: owner, uid, now });
  assert.equal(cancel.ok, false);
});

test("callbacks cannot skip the state machine or replay onto a completed payment", () => {
  const state = blank();
  state.collections.push({
    id: "col-cb",
    paymentMethod: "MTN Mobile Money",
    paymentReference: "MTNCB0001",
    amount: 22,
    customerId: "c-a",
    verificationStatus: "Pending Verification",
    reversed: false
  });
  const started = registerBusinessPayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 22,
    customerId: "c-a",
    paymentReference: "MTNCB0001",
    businessType: "collection",
    businessId: "col-cb"
  }, owner, uid, now);
  const body = { reference: "MTNCB0001", amount: 22, status: "success" };
  const first = processPaymentCallback(state, signedEnvelope(state, body), { user: owner, uid, now });
  assert.equal(first.ok, true);
  assert.equal(started.payment.status, "completed");
  const trail = (started.payment.statusHistory || []).map((item) => item.newState);
  assert.ok(trail.includes("authorized"));
  assert.ok(trail.includes("processing"));
  const second = processPaymentCallback(state, signedEnvelope(state, body), { user: owner, uid, now });
  assert.equal(second.duplicate, true);
  assert.equal(started.payment.status, "completed");
});

test("optimistic concurrency rejects a stale payment version", () => {
  const state = blank();
  const cash = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 5,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-ver"
  }, owner, uid, now);
  const stale = transitionPayment(state, cash.payment, "partially_refunded", { user: owner, uid, now, expectedVersion: 1 });
  assert.equal(stale.ok, false);
  assert.match(stale.error, /version/i);
});

test("only the Payment Engine may change payment status; backup owners wait until failover", () => {
  const state = blank();
  const cash = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "Cash",
    amount: 6,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-own"
  }, owner, uid, now);
  const stolen = transitionPayment(state, cash.payment, "partially_refunded", { actor: "Accounting Engine", user: owner, uid, now });
  assert.equal(stolen.ok, false);
  const backup = acquireStageLock(state, "update_status", cash.payment.id, "Workflow Engine", { uid, now });
  assert.equal(backup.ok, false);
  setOwnerHealth(state, "Payment Engine", "unhealthy", now);
  const failover = acquireStageLock(state, "update_status", cash.payment.id, "Workflow Engine", { uid, now, failover: true, reason: "primary_down" });
  assert.equal(failover.ok, true);
  assert.equal(failover.mode, "backup");
  const restored = failbackStageOwner(state, "update_status", cash.payment.id, { uid, now });
  assert.equal(restored.ok, true);
  assert.equal(WORKFLOW_STAGES.every((item) => item.owner && item.backup && item.owner !== item.backup), true);
  assert.equal(STATE_OWNERS.paymentStatus, "Payment Engine");
  const bypass = executeWorkflowStage(state, "post_accounting", "Payment Engine", () => ({ ok: true }), { paymentId: cash.payment.id, uid, now });
  assert.equal(bypass.ok, false);
  const stolenAccounting = markAccountingPosted(state, cash.payment, "Payment Engine");
  assert.equal(stolenAccounting.ok, false);
});

