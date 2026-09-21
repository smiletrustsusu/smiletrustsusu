import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardModel,
  percentChange,
  searchCustomers,
  searchGroups,
  widgetsForRole,
  normalizeDashboardPrefs
} from "../src/core/dashboard-analytics.js";

test("percentChange reports up, down, and flat", () => {
  assert.equal(percentChange(120, 100).direction, "up");
  assert.equal(percentChange(80, 100).direction, "down");
  assert.equal(percentChange(0, 0).direction, "flat");
});

test("search finds customers and groups without requiring full ids", () => {
  const customers = [
    { id: "c1", name: "Ama Mensah", accountNo: "C13002", phone: "0241112222", ghanaCard: "GHA-1" },
    { id: "c2", name: "Kofi Boateng", accountNo: "C13009", phone: "0200000000" }
  ];
  assert.equal(searchCustomers(customers, "ama").length, 1);
  assert.equal(searchCustomers(customers, "c13009")[0].id, "c2");
  assert.equal(searchCustomers(customers, "gha-1").length, 1);
  assert.equal(searchCustomers(customers, "x").length, 0);
  const groups = [{ id: "g1", name: "Market Women", code: "SG-01", leaderName: "Efua" }];
  assert.equal(searchGroups(groups, "market")[0].id, "g1");
});

test("collector dashboard hides HQ-only widgets", () => {
  const widgets = widgetsForRole("Collector", normalizeDashboardPrefs({}));
  const ids = widgets.map((item) => item.id);
  assert.ok(ids.includes("agentToday"));
  assert.ok(ids.includes("summaryCards"));
  assert.equal(ids.includes("branches"), false);
  assert.equal(ids.includes("system"), false);
});

test("system owner dashboard includes operational and admin widgets", () => {
  const ids = widgetsForRole("SystemOwner", normalizeDashboardPrefs({})).map((item) => item.id);
  assert.ok(ids.includes("system"));
  assert.ok(ids.includes("cash"));
  assert.ok(ids.includes("financial"));
});

test("buildDashboardModel aggregates collections and pending work", () => {
  const model = buildDashboardModel({
    date: "2026-09-08",
    online: true,
    user: { id: "u-owner", role: "SystemOwner", name: "John" },
    state: {
      settings: { lastSyncedAt: "2026-09-08T10:00:00.000Z" },
      users: [{ id: "u-col", role: "Collector", name: "Ama", dailyTarget: 200, commissionType: "Percentage", commissionRate: 5 }],
      ledgerEntries: [
        { account: "account:cash", direction: "debit", amountPesewas: 15000, reversed: false, groupId: "br1" }
      ],
      offlineQueue: [{ status: "pending" }],
      audit: []
    },
    scoped: {
      customers: [
        { id: "c1", name: "Ama", groupId: "br1", active: true, dailyAmount: 20, createdAt: "2026-09-08T08:00:00.000Z" }
      ],
      collections: [
        { id: "p1", amount: 50, date: "2026-09-08", groupId: "br1", userId: "u-col", collectorId: "u-col" },
        { id: "p2", amount: 30, date: "2026-09-07", groupId: "br1", userId: "u-col" }
      ],
      loans: [{ id: "l1", status: "Active", principal: 400, totalDue: 460, amountPaid: 100, groupId: "br1" }],
      transactions: [
        { type: "Loan Repayment", amount: 40, date: "2026-09-08" },
        { type: "Withdrawal", amount: 10, date: "2026-09-08" }
      ],
      withdrawals: [{ status: "Requested", customerId: "c1", date: "2026-09-08" }],
      expenses: [{ amount: 5, date: "2026-09-08" }],
      groups: [{ id: "br1", name: "Madina" }],
      susuGroups: [{ id: "sg1", name: "Circle" }],
      users: [{ id: "u-col", role: "Collector", name: "Ama", dailyTarget: 200 }]
    }
  });
  const collectionsCard = model.cards.find((card) => card.id === "todayCollections");
  assert.equal(collectionsCard.value, 50);
  assert.equal(collectionsCard.change.direction, "up");
  assert.equal(model.financial.today, 50);
  assert.ok(model.pendingTasks.some((task) => task.jump === "withdrawals"));
  assert.equal(model.system.pendingUploads, 1);
  assert.equal(model.cash.office, 150);
  assert.equal(model.trends.daily.length, 30);
});
