import test from "node:test";
import assert from "node:assert/strict";
import {
  createWithdrawalRequest,
  advanceWithdrawal,
  nextWithdrawalAction,
  canAdvanceWithdrawal,
  canTransitionWithdrawal,
  WITHDRAWAL_TRANSITIONS,
  WITHDRAWAL_STATUSES
} from "../src/core/withdrawals-workflow.js";
import {
  validateWithdrawalEligibility,
  submitWithdrawalRequest,
  payWithdrawal,
  reverseWithdrawalPayment,
  cancelWithdrawal,
  closeSavingsAccount,
  withdrawalQuote,
  detectMaturedAccounts,
  maturityRedemptionPreview,
  applyQueuedWithdrawal,
  withdrawalDashboard
} from "../src/core/withdrawal-ops.js";
import { acquireLock, restoreRecord, snapshotRecord } from "../src/core/financial-txn.js";
import { PRODUCT_TYPES } from "../src/core/savings-products.js";

const uid = (prefix) => `${prefix}-1`;

test("legacy Requested → Verified → Approved → Paid still works", () => {
  const state = { withdrawalRequests: [] };
  const created = createWithdrawalRequest(state, {
    customerId: "c1",
    amount: 50,
    availableBalance: 80,
    requestedBy: "u-col"
  }, uid);
  assert.equal(created.request.status, "Requested");
  assert.ok(advanceWithdrawal(created.request, "Approved", "u-mgr").error);
  assert.ok(advanceWithdrawal(created.request, "Verified", "u-cso").request);
  assert.equal(nextWithdrawalAction("Verified"), "Approved");
  assert.equal(canAdvanceWithdrawal({ role: "KBA" }, created.request), true);
  advanceWithdrawal(created.request, "Approved", "u-mgr");
  advanceWithdrawal(created.request, "Paid", "u-cash");
  assert.equal(created.request.status, "Paid");
});

test("invalid withdrawal transitions are rejected", () => {
  const request = { status: "Requested", amount: 20, requestedBy: "u1" };
  assert.equal(canTransitionWithdrawal("Requested", "Paid"), false);
  const paidEarly = advanceWithdrawal(request, "Paid", "u-cash");
  assert.match(paidEarly.error, /Cannot move/);
  assert.equal(request.status, "Requested");
  advanceWithdrawal(request, "Verified", "u-cso");
  advanceWithdrawal(request, "Approved", "u-mgr");
  advanceWithdrawal(request, "Paid", "u-cash");
  const editPaid = advanceWithdrawal(request, "Approved", "u-mgr");
  assert.match(editPaid.error, /cannot be edited/);
  assert.equal(request.status, "Paid");
});

test("eligibility blocks inactive customers, holds, and overdraws", () => {
  const blocked = validateWithdrawalEligibility({
    customer: { active: false, memberStatus: "Closed" },
    amount: 10,
    availableBalance: 100
  });
  assert.equal(blocked.ok, false);
  const hold = validateWithdrawalEligibility({
    customer: { active: true },
    amount: 80,
    availableBalance: 100,
    heldBalance: 40
  });
  assert.equal(hold.ok, false);
  const ok = validateWithdrawalEligibility({
    customer: { active: true },
    amount: 50,
    availableBalance: 100,
    heldBalance: 10
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.usable, 90);
});

test("payment is atomic, idempotent, and cannot run twice", () => {
  const state = { withdrawalRequests: [], withdrawalActivityLogs: [] };
  const created = createWithdrawalRequest(state, {
    customerId: "c1",
    amount: 40,
    availableBalance: 100,
    requestedBy: "u-col"
  }, uid);
  advanceWithdrawal(created.request, "Verified", "u-cso");
  advanceWithdrawal(created.request, "Approved", "u-mgr");
  let posts = 0;
  const first = payWithdrawal(state, created.request, {
    userId: "u-cash",
    availableBalance: 100,
    idempotencyKey: "pay-1",
    postPayment: () => {
      posts += 1;
      return { receiptNo: "wd-1" };
    }
  });
  assert.equal(first.committed, true);
  assert.equal(created.request.status, "Paid");
  assert.equal(created.request.receiptNo, "wd-1");
  const replay = payWithdrawal(state, created.request, {
    userId: "u-cash",
    availableBalance: 100,
    idempotencyKey: "pay-1",
    postPayment: () => {
      posts += 1;
      return { receiptNo: "wd-2" };
    }
  });
  assert.equal(replay.replay, true);
  assert.equal(posts, 1);
  const second = payWithdrawal(state, created.request, {
    userId: "u-cash",
    availableBalance: 100,
    idempotencyKey: "pay-2",
    postPayment: () => {
      posts += 1;
      return { receiptNo: "wd-3" };
    }
  });
  assert.match(second.error, /already been paid|not ready/);
  assert.equal(posts, 1);
});

test("failed posting rolls back the withdrawal status", () => {
  const state = { withdrawalRequests: [] };
  const created = createWithdrawalRequest(state, {
    customerId: "c1",
    amount: 25,
    availableBalance: 80,
    requestedBy: "u-col"
  }, uid);
  advanceWithdrawal(created.request, "Verified", "u-cso");
  advanceWithdrawal(created.request, "Approved", "u-mgr");
  const failed = payWithdrawal(state, created.request, {
    userId: "u-cash",
    availableBalance: 80,
    postPayment: () => ({ error: "Ledger failed" })
  });
  assert.match(failed.error, /Ledger failed/);
  assert.equal(created.request.status, "Approved");
  assert.equal(Boolean(created.request.paidAt), false);
});

test("locking prevents concurrent payment", () => {
  const request = { status: "Approved", amount: 10, lockUntil: new Date(Date.now() + 60000).toISOString(), lockedBy: "u-a" };
  const locked = acquireLock(request, "u-b");
  assert.match(locked.error, /locked/);
});

test("reversal requires a reason and cancelled requests never post", () => {
  const state = { withdrawalRequests: [], withdrawalActivityLogs: [] };
  const created = createWithdrawalRequest(state, {
    customerId: "c1",
    amount: 15,
    availableBalance: 50,
    requestedBy: "u-col"
  }, uid);
  const cancelled = cancelWithdrawal(created.request, { userId: "u-mgr" });
  assert.match(cancelled.error, /Reason is required/);
  assert.ok(cancelWithdrawal(created.request, { userId: "u-mgr", reason: "Customer withdrew request" }).request);
  assert.equal(created.request.status, "Cancelled");
  const paid = { status: "Paid", amount: 15, receiptNo: "wd-9", customerId: "c1" };
  assert.match(reverseWithdrawalPayment(state, paid, { userId: "u-mgr" }).error, /Reason is required/);
  const reversed = reverseWithdrawalPayment(state, paid, {
    userId: "u-mgr",
    reason: "Duplicate payout",
    postReversal: () => ({ ok: true })
  });
  assert.equal(reversed.request.status, "Reversed");
});

test("account closure and matured savings preview", () => {
  const state = { accountClosures: [] };
  const account = { id: "sa-1", status: "Active", balance: 500, maturityDate: "2026-01-01", interestRate: 10, termMonths: 12 };
  assert.match(closeSavingsAccount(state, account, { confirmed: true }).error, /Manager approval/);
  const closed = closeSavingsAccount(state, account, {
    userId: "u-mgr",
    customerId: "c1",
    confirmed: true,
    approved: true,
    reason: "Customer requested"
  });
  assert.equal(closed.account.status, "Closed");
  const matured = detectMaturedAccounts([
    { id: "sa-2", status: "Active", maturityDate: "2026-01-01", type: PRODUCT_TYPES.FIXED_DEPOSIT }
  ], [], { asOfDate: "2026-09-09" });
  assert.equal(matured.length, 1);
  const preview = maturityRedemptionPreview(account, { interestRate: 10, maturityMonths: 12 });
  assert.ok(preview.netAmount >= preview.principal);
});

test("offline queue applies a withdrawal request once", () => {
  const state = { withdrawalRequests: [] };
  const entry = {
    kind: "withdrawal",
    payload: { customerId: "c1", amount: 12, availableBalance: 40, requestedBy: "u-col", idempotencyKey: "off-1" }
  };
  assert.equal(applyQueuedWithdrawal(state, entry, uid), true);
  assert.equal(state.withdrawalRequests.length, 1);
  assert.equal(applyQueuedWithdrawal(state, entry, uid), true);
  assert.equal(state.withdrawalRequests.length, 1);
});

test("dashboard counts pending and paid activity", () => {
  const dash = withdrawalDashboard(
    [{ status: "Requested", amount: 10 }, { status: "Paid", amount: 20, fee: 0, withdrawalType: "Emergency Withdrawal" }],
    [{ type: "Withdrawal", amount: 20, date: "2026-09-09" }],
    { date: "2026-09-09" }
  );
  assert.equal(dash.pendingRequests, 1);
  assert.equal(dash.paidToday, 1);
  assert.equal(dash.emergencyWithdrawals, 1);
  assert.equal(withdrawalQuote({ amount: 100, withdrawalType: "Normal Withdrawal" }).netAmount, 100);
});

test("optimistic snapshot restore leaves the original record", () => {
  const record = { status: "Approved", amount: 5 };
  const snap = snapshotRecord(record);
  record.status = "Paid";
  restoreRecord(record, snap);
  assert.equal(record.status, "Approved");
});

test("every matrix cell is allowed or rejected", () => {
  for (const from of Object.keys(WITHDRAWAL_TRANSITIONS)) {
    for (const to of WITHDRAWAL_STATUSES) {
      const allowed = from === to || (WITHDRAWAL_TRANSITIONS[from] || []).includes(to);
      assert.equal(canTransitionWithdrawal(from, to), allowed, `${from} → ${to}`);
    }
  }
});
