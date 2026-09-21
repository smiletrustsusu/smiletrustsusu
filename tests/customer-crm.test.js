import test from "node:test";
import assert from "node:assert/strict";
import {
  addCustomerNote,
  applyCustomerCrm,
  canHardDeleteCustomers,
  customerAnalytics,
  customerProfileStats,
  findDuplicateCustomers,
  searchCustomersAdvanced,
  paginateList,
  parseCustomerImportRows,
  setCustomerStatus,
  setKycVerification,
  statementRows,
  whatsappLink
} from "../src/core/customer-crm.js";

const uid = (prefix) => `${prefix}-1`;

test("duplicate detection matches phone and Ghana Card", () => {
  const customers = [
    { id: "c1", name: "Ama", phone: "0241112222", ghanaCard: "GHA-1" },
    { id: "c2", name: "Kofi", phone: "0200000000", email: "kofi@test.com" }
  ];
  assert.equal(findDuplicateCustomers(customers, { phone: "024 111 2222" }).length, 1);
  assert.equal(findDuplicateCustomers(customers, { ghanaCard: "GHA-1" }, "c1").length, 0);
  assert.equal(findDuplicateCustomers(customers, { email: "kofi@test.com" })[0].id, "c2");
});

test("status and KYC changes write history and verification badge data", () => {
  const owner = { id: "u-owner", role: "SystemOwner" };
  const customer = { id: "c1", name: "Ama", memberStatus: "Active", active: true };
  applyCustomerCrm(customer, { category: "VIP", email: "ama@test.com" });
  assert.equal(customer.category, "VIP");
  const status = setCustomerStatus(customer, "Suspended", owner, uid);
  assert.equal(status.customer.memberStatus, "Suspended");
  assert.equal(status.customer.active, false);
  assert.equal(customer.statusHistory[0].to, "Suspended");
  setKycVerification(customer, "Verified", owner, uid);
  assert.equal(customer.kycStatus, "Verified");
  assert.ok(addCustomerNote(customer, { type: "Visited customer", body: "Home visit", userId: owner.id }, uid).note);
});

test("search covers number, agent, and branch extras", () => {
  const customers = [
    { id: "c1", name: "Ama Mensah", customerNumber: "ST000001", phone: "0241", groupId: "g1", collectorId: "a1" }
  ];
  assert.equal(searchCustomersAdvanced(customers, "st000001").length, 1);
  assert.equal(searchCustomersAdvanced(customers, "madina", {
    branchName: () => "Madina",
    agentName: () => "Kofi"
  }).length, 1);
});

test("profile stats and analytics aggregate existing records", () => {
  const customer = { id: "c1", name: "Ama", savingsProductId: "p1", createdAt: "2026-09-08T08:00:00.000Z", gender: "Female" };
  const stats = customerProfileStats(customer, {
    collections: [{ customerId: "c1", amount: 20, date: "2026-09-08" }],
    transactions: [{ customerId: "c1", type: "Withdrawal", amount: 5, date: "2026-09-08" }],
    loans: [{ customerId: "c1", status: "Active", totalDue: 100, amountPaid: 40 }],
    date: "2026-09-08"
  });
  assert.equal(stats.todayContribution, 20);
  assert.equal(stats.loanBalance, 60);
  const analytics = customerAnalytics([customer, { id: "c2", memberStatus: "Suspended", dormant: true, gender: "Male" }], {
    groups: [],
    users: [],
    products: []
  });
  assert.equal(analytics.total, 2);
  assert.ok(analytics.byGender.length);
  assert.equal(canHardDeleteCustomers({ role: "KBA" }), false);
  assert.equal(canHardDeleteCustomers({ role: "SystemOwner" }), true);
  assert.equal(statementRows([{ customerId: "c1", type: "Susu Deposit", amount: 10, date: "2026-09-08" }], [], "c1").length, 1);
});

test("pagination, WhatsApp links, and CSV import parsing", () => {
  const page = paginateList([1, 2, 3, 4, 5], 2, 2);
  assert.deepEqual(page.items, [3, 4]);
  assert.equal(page.pages, 3);
  assert.ok(whatsappLink("0241112222", "Hello").includes("233241112222"));
  const rows = parseCustomerImportRows([
    { Name: "Ama", Phone: "0241112222", "Ghana Card": "GHA-1" },
    { name: "", phone: "0200000000" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ghanaCard, "GHA-1");
});
