import test from "node:test";
import assert from "node:assert/strict";
import { collectorDashboardMetrics, channelSplit, managerDashboardSplit } from "../src/core/collector-dashboard.js";
import { defaultSavingsProducts } from "../src/core/savings-products.js";

test("channelSplit separates cash and mobile money", () => {
  const collections = [
    { amount: 10, paymentMethod: "Cash" },
    { amount: 5, paymentMethod: "Mobile Money" },
    { amount: 3, paymentMethod: "Cash" }
  ];
  const split = channelSplit(collections);
  assert.equal(split.Cash, 13);
  assert.equal(split["Mobile Money"], 5);
});

test("collectorDashboardMetrics computes today totals", () => {
  const state = {
    customers: [{ id: "c1", collectorId: "col1", active: true, savingsProductId: "prod-daily", dailyAmount: 5 }],
    collections: [
      { userId: "col1", customerId: "c1", amount: 5, date: "2026-09-04", reversed: false, paymentMethod: "Cash" }
    ],
    susuGroups: [],
    savingsProducts: defaultSavingsProducts(),
    handovers: []
  };
  const metrics = collectorDashboardMetrics("col1", state, { date: "2026-09-04" });
  assert.equal(metrics.collectionsToday, 5);
  assert.equal(metrics.cashToday, 5);
  assert.equal(metrics.assignedCustomers, 1);
});

test("managerDashboardSplit separates personal and group collections", () => {
  const state = {
    collections: [
      { amount: 10, date: "2026-09-04", reversed: false, susuGroupId: "", paymentMethod: "Cash" },
      { amount: 20, date: "2026-09-04", reversed: false, susuGroupId: "sg1", paymentMethod: "Mobile Money" }
    ]
  };
  const split = managerDashboardSplit(state, { date: "2026-09-04" });
  assert.equal(split.personalToday, 10);
  assert.equal(split.groupToday, 20);
  assert.equal(split.totalToday, 30);
});
