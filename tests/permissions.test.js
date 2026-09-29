import test from "node:test";
import assert from "node:assert/strict";
import {
  customerAssignedToCollector,
  filterCustomersForUser,
  filterCollectionsForUser,
  canAccessCustomer,
  canVerifyHandover,
  canApproveReversal,
  isCollectorScopedRole
} from "../src/core/permissions.js";

test("collector only sees assigned customers", () => {
  const customers = [
    { id: "c1", groupId: "g1", collectorId: "u-col-1", name: "Ama" },
    { id: "c2", groupId: "g1", collectorId: "u-col-2", name: "Kofi" }
  ];
  const collector = { id: "u-col-1", role: "Collector", groupId: "g1" };
  const scoped = filterCustomersForUser(customers, collector, { groupIds: ["g1"] });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, "c1");
});

test("collector cannot see other branch customers even if collectorId leaked", () => {
  const customers = [
    { id: "c1", groupId: "g1", collectorId: "u-col-1", name: "Ama" },
    { id: "c2", groupId: "g2", collectorId: "u-col-1", name: "Other branch" }
  ];
  const collector = { id: "u-col-1", role: "Collector", groupId: "g1" };
  const scoped = filterCustomersForUser(customers, collector, { groupIds: ["g1"] });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, "c1");
});

test("collector collections scoped to assigned members / own postings", () => {
  const customers = [
    { id: "c1", groupId: "g1", collectorId: "u-col-1" },
    { id: "c2", groupId: "g1", collectorId: "u-col-2" }
  ];
  const collections = [
    { id: "x1", customerId: "c1", groupId: "g1", userId: "u-col-1" },
    { id: "x2", customerId: "c2", groupId: "g1", userId: "u-col-2" },
    { id: "x3", customerId: "c2", groupId: "g1", userId: "u-col-1", collectorId: "u-col-1" }
  ];
  const collector = { id: "u-col-1", role: "Collector", groupId: "g1" };
  const scoped = filterCollectionsForUser(collections, collector, { customers, groupIds: ["g1"] });
  assert.deepEqual(scoped.map((r) => r.id).sort(), ["x1", "x3"]);
  assert.equal(isCollectorScopedRole(collector), true);
});

test("assistant manager cannot verify own handover by default", () => {
  const admin = { id: "u-admin", role: "Admin" };
  const handover = { collectorId: "u-admin", date: "2026-09-02", status: "Submitted" };
  assert.equal(canVerifyHandover(admin, handover, {}), false);
});

test("branch manager can confirm another collector handover when no receiver assigned", () => {
  const admin = { id: "u-admin", role: "Admin" };
  const handover = { collectorId: "u-col", date: "2026-09-02", status: "Submitted" };
  assert.equal(canVerifyHandover(admin, handover, {}), true);
});

test("owner can verify any handover", () => {
  const owner = { id: "u-owner", role: "KBA" };
  const handover = { collectorId: "u-col", date: "2026-09-02", status: "Submitted" };
  assert.equal(canVerifyHandover(owner, handover, {}), true);
});

test("assistant cannot approve own reversal by default", () => {
  const admin = { id: "u-admin", role: "Admin" };
  const reversal = { requestedBy: "u-admin", status: "Pending" };
  assert.equal(canApproveReversal(admin, reversal, {}), false);
});

test("canAccessCustomer enforces collector assignment", () => {
  const customer = { id: "c1", groupId: "g1", collectorId: "u-col-1" };
  const collector = { id: "u-col-2", role: "Collector", groupId: "g1" };
  assert.equal(canAccessCustomer(customer, collector, { groupIds: ["g1"] }), false);
  assert.equal(customerAssignedToCollector(customer, "u-col-1"), true);
});

test("auditor can access customers in assigned branch scope", () => {
  const customer = { id: "c1", groupId: "g1", collectorId: "u-col-1" };
  const auditor = { id: "u-audit", role: "Auditor" };
  assert.equal(canAccessCustomer(customer, auditor, { groupIds: ["g1"] }), true);
  assert.equal(canAccessCustomer(customer, auditor, { groupIds: ["g2"] }), false);
});
