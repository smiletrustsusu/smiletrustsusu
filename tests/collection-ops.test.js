import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAdjustment,
  collectionAnalytics,
  collectionCustomerCard,
  collectionDesk,
  createAdjustmentRequest,
  customerBalanceBreakdown,
  exportCollectionRows,
  filterCollections,
  fraudAlerts,
  isLargeDeposit,
  isWalletMethod,
  logCollectionActivity,
  missedCollectionRows,
  validateBulkDrafts,
  validateCollectionDraft
} from "../src/core/collection-ops.js";
import { verifyMomoPaymentLocally } from "../src/core/momo.js";

const uid = (prefix) => `${prefix}-1`;

test("rejects inactive customers, future dates, and product min/max", () => {
  const product = { minAmountPesewas: 500, maxAmountPesewas: 20000 };
  assert.match(validateCollectionDraft({
    customer: { active: false, accountNo: "A1" },
    amount: 10,
    date: "2026-09-08",
    today: "2026-09-08"
  }), /not active/);
  assert.match(validateCollectionDraft({
    customer: { active: true, accountNo: "A1" },
    amount: 10,
    date: "2026-09-09",
    today: "2026-09-08"
  }), /future/);
  assert.match(validateCollectionDraft({
    customer: { active: true, accountNo: "A1" },
    product,
    amount: 2,
    date: "2026-09-08",
    today: "2026-09-08"
  }), /Minimum/);
  assert.equal(validateCollectionDraft({
    customer: { active: true, accountNo: "A1" },
    product,
    amount: 10,
    date: "2026-09-08",
    today: "2026-09-08"
  }), "");
});

test("wallet methods require MoMo-style references", () => {
  assert.equal(isWalletMethod("MTN Mobile Money"), true);
  const state = { collections: [] };
  assert.equal(verifyMomoPaymentLocally(state, {
    paymentMethod: "MTN Mobile Money",
    paymentReference: "abc"
  }).ok, false);
  assert.equal(verifyMomoPaymentLocally(state, {
    paymentMethod: "Telecel Cash",
    paymentReference: "TEL123456"
  }).ok, true);
});

test("desk, card, filters, and analytics", () => {
  const state = {
    customers: [
      { id: "c1", name: "Ama", collectorId: "a1", accountNo: "1001", savingsProductId: "prod-daily", active: true, dailyAmount: 5 },
      { id: "c2", name: "Kofi", collectorId: "a1", accountNo: "1002", active: true, dailyAmount: 5 }
    ],
    collections: [
      { id: "col1", customerId: "c1", userId: "a1", amount: 5, date: "2026-09-08", paymentMethod: "Cash", savingsProductId: "prod-daily" }
    ],
    transactions: [],
    savingsProducts: [{ id: "prod-daily", name: "Daily", defaultAmountPesewas: 500, frequency: "Daily" }],
    users: [{ id: "a1", name: "Agent Ama" }],
    groups: [{ id: "g1", name: "Madina" }],
    susuGroups: [],
    handovers: [],
    offlineQueue: [{ kind: "collection", status: "pending" }],
    collectionTargets: []
  };
  const desk = collectionDesk(state, "a1", { date: "2026-09-08" });
  assert.equal(desk.assignedToday, 2);
  assert.equal(desk.visited, 1);
  assert.equal(desk.pendingSync, 1);
  const card = collectionCustomerCard(state.customers[0], {
    collections: state.collections,
    products: state.savingsProducts,
    users: state.users,
    date: "2026-09-08"
  });
  assert.equal(card.status, "Collected");
  const filtered = filterCollections(state.collections, { method: "Cash", q: "ama" }, {
    customerName: () => "Ama"
  });
  assert.equal(filtered.length, 1);
  const stats = collectionAnalytics(state.collections, {
    customers: state.customers,
    users: state.users,
    products: state.savingsProducts,
    groups: state.groups
  });
  assert.equal(stats.total, 5);
  assert.equal(exportCollectionRows(state.collections, { customerName: () => "Ama" })[0].customer, "Ama");
});

test("bulk validation, missed rows, fraud alerts, and adjustments", () => {
  const customer = { id: "c1", name: "Ama", active: true, accountNo: "1001" };
  const bulk = validateBulkDrafts([
    { customer, amount: 10, date: "2026-09-08" },
    { customer: { active: false, accountNo: "x" }, amount: 4, date: "2026-09-08" }
  ], { today: "2026-09-08" });
  assert.equal(bulk.ok, false);
  assert.equal(bulk.valid.length, 1);
  const missed = missedCollectionRows([
    { customerId: "c1", amount: 0, visitOutcome: "Customer Travelling", date: "2026-09-08", receiptNo: "R1" }
  ], [customer]);
  assert.equal(missed[0].reason, "Customer Travelling");
  assert.equal(isLargeDeposit(5000), true);
  const alerts = fraudAlerts([
    { id: "1", customerId: "c1", date: "2026-09-08", amount: 6000 },
    { id: "2", customerId: "c1", date: "2026-09-08", amount: 10 }
  ]);
  assert.ok(alerts.some((item) => item.type === "large_deposit"));
  assert.ok(alerts.some((item) => item.type === "duplicate_same_day"));
  const state = {
    collections: [{ id: "col1", amount: 20, reversed: false, amountPesewas: 2000 }],
    collectionAdjustments: []
  };
  const req = createAdjustmentRequest(state, { collection: state.collections[0], amount: 5, reason: "Duplicate sitting", requestedBy: "u1", uid });
  assert.equal(req.adjustment.status, "Pending");
  assert.ok(applyAdjustment(state, req.adjustment.id, { role: "Collector" }).error);
  const approved = applyAdjustment(state, req.adjustment.id, { id: "u-owner", role: "SystemOwner" });
  assert.equal(approved.collection.amount, 15);
  const logs = { collectionActivityLogs: [] };
  assert.ok(logCollectionActivity(logs, { action: "Collected", uid }).id);
  const breakdown = customerBalanceBreakdown("c1", {
    collections: [{ customerId: "c1", amount: 20, reversed: false }],
    transactions: [],
    product: { interestRate: 10, maturityMonths: 12 }
  });
  assert.equal(breakdown.deposit, 20);
  assert.ok(breakdown.projected >= 20);
});
