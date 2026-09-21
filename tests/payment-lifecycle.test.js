import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_STATES,
  PAYMENT_TRANSITION_MATRIX,
  TERMINAL_PAYMENT_STATES,
  canTransitionPayment,
  transitionPayment,
  executeWorkflowStage,
  setOwnerHealth,
  acquireStageLock,
  failbackStageOwner,
  markAccountingPosted,
  WORKFLOW_STAGES,
  paymentFlowOrder,
  ensurePaymentLifecycleState,
  STATE_OWNERS
} from "../src/core/payment-lifecycle.js";
import {
  ensurePaymentState,
  initiatePayment,
  cancelPayment,
  expirePayment
} from "../src/core/payment-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const now = "2026-09-10T12:00:00.000Z";

function row(status) {
  return {
    id: `pay-${status}`,
    status,
    version: 1,
    amount: 10,
    statusHistory: [],
    correlationId: "corr-1",
    idempotencyKey: "idem-1"
  };
}

test("the transition matrix is exhaustive and rejects every undocumented move", () => {
  const state = ensurePaymentLifecycleState({});
  PAYMENT_STATES.forEach((from) => {
    PAYMENT_STATES.forEach((to) => {
      const listed = (PAYMENT_TRANSITION_MATRIX[from] || []).includes(to);
      assert.equal(canTransitionPayment(from, to), listed, `${from} → ${to}`);
      if (from === to) return;
      const payment = row(from);
      const result = transitionPayment(state, payment, to, { now });
      if (listed) {
        assert.equal(result.ok, true, `allowed ${from} → ${to}`);
        assert.equal(payment.status, to);
        assert.equal(payment.statusHistory[0].previousState, from);
      } else {
        assert.equal(result.ok, false, `rejected ${from} → ${to}`);
        assert.equal(payment.status, from);
      }
    });
  });
  assert.equal(canTransitionPayment("failed", "completed"), false);
  assert.equal(canTransitionPayment("fully_refunded", "completed"), false);
  TERMINAL_PAYMENT_STATES.forEach((status) => {
    assert.equal((PAYMENT_TRANSITION_MATRIX[status] || []).length, 0);
  });
});

test("cancel and expire follow the matrix; terminal payments stay closed", () => {
  const state = ensurePaymentState({
    settings: { currency: "GHS", momoWebhookSecret: "whsec-test", loanInterest: 15 },
    collections: [],
    customers: [{ id: "c-a", name: "Ama", active: true }]
  });
  const created = { id: "pay-open", status: "created", version: 1, amount: 4, statusHistory: [] };
  state.paymentTransactions.push(created);
  const cancelled = cancelPayment(state, created.id, { user: owner, uid, now });
  assert.equal(cancelled.ok, true);
  assert.equal(created.status, "cancelled");
  const stillCancelled = cancelPayment(state, created.id, { user: owner, uid, now });
  assert.equal(stillCancelled.ok, true);
  assert.equal(stillCancelled.noop, true);
  assert.equal(created.status, "cancelled");

  const momo = initiatePayment(state, {
    paymentType: "savings_deposit",
    paymentMethod: "MTN Mobile Money",
    amount: 8,
    customerId: "c-a",
    paymentReference: "MTN888001",
    businessType: "collection",
    businessId: "col-exp"
  }, owner, uid, now);
  assert.equal(momo.payment.status, "pending_provider");
  const expired = expirePayment(state, momo.payment.id, { user: owner, uid, now });
  assert.equal(expired.ok, true);
  assert.equal(momo.payment.status, "expired");
  const stillExpired = expirePayment(state, momo.payment.id, { user: owner, uid, now });
  assert.equal(stillExpired.ok, true);
  assert.equal(stillExpired.noop, true);
  assert.equal(transitionPayment(state, momo.payment, "completed", { now }).ok, false);
});

test("only the Accounting Engine may mark accounting posted", () => {
  const state = ensurePaymentLifecycleState({});
  const payment = row("completed");
  const stolen = markAccountingPosted(state, payment, "Payment Engine");
  assert.equal(stolen.ok, false);
  const posted = markAccountingPosted(state, payment, "Accounting Engine");
  assert.equal(posted.ok, true);
  assert.equal(payment.accountingPosted, true);
  assert.equal(STATE_OWNERS.accountingStatus, "Accounting Engine");
});

test("workflow stages have exclusive primary and backup owners and ordered handoff", () => {
  const ids = paymentFlowOrder();
  assert.deepEqual(ids, WORKFLOW_STAGES.map((item) => item.id));
  assert.equal(WORKFLOW_STAGES.length, 21);
  WORKFLOW_STAGES.forEach((stage) => {
    assert.ok(stage.owner);
    assert.ok(stage.backup);
    assert.notEqual(stage.owner, stage.backup);
  });
  const state = ensurePaymentLifecycleState({});
  const bypass = executeWorkflowStage(state, "update_status", "Accounting Engine", () => ({ ok: true }), { paymentId: "pay-x", now });
  assert.equal(bypass.ok, false);
  const primary = acquireStageLock(state, "update_status", "pay-x", "Payment Engine", { now });
  assert.equal(primary.ok, true);
  const concurrent = acquireStageLock(state, "update_status", "pay-x", "Workflow Engine", { now, failover: true });
  assert.equal(concurrent.ok, false);
  setOwnerHealth(state, "Payment Engine", "unhealthy", now);
  const afterRelease = failbackStageOwner(state, "update_status", "pay-x", { now });
  assert.equal(afterRelease.ok, true);
});
