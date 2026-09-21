import test from "node:test";
import assert from "node:assert/strict";
import {
  customerAssignedToCollector,
  filterCustomersForUser,
  canAccessCustomer,
  canVerifyHandover,
  canApproveReversal
} from "../src/core/permissions.js";

test("collector only sees assigned customers", () => {
  const customers = [
    { id: "c1", groupId: "g1", collectorId: "u-col-1", name: "Ama" },
    { id: "c2", groupId: "g1", collectorId: "u-col-2", name: "Kofi" }
  ];
  const collector = { id: "u-col-1", role: "Collector" };
  const scoped = filterCustomersForUser(customers, collector, { groupIds: ["g1"] });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, "c1");
});

test("assistant manager cannot verify own handover by default", () => {
  const admin = { id: "u-admin", role: "Admin" };
  const handover = { collectorId: "u-admin", date: "2026-09-02" };
  assert.equal(canVerifyHandover(admin, handover, {}), false);
});

test("owner can verify any handover", () => {
  const owner = { id: "u-owner", role: "KBA" };
  const handover = { collectorId: "u-col", date: "2026-09-02" };
  assert.equal(canVerifyHandover(owner, handover, {}), true);
});

test("assistant cannot approve own reversal by default", () => {
  const admin = { id: "u-admin", role: "Admin" };
  const reversal = { requestedBy: "u-admin", status: "Pending" };
  assert.equal(canApproveReversal(admin, reversal, {}), false);
});

test("canAccessCustomer enforces collector assignment", () => {
  const customer = { id: "c1", groupId: "g1", collectorId: "u-col-1" };
  const collector = { id: "u-col-2", role: "Collector" };
  assert.equal(canAccessCustomer(customer, collector, { groupIds: ["g1"] }), false);
  assert.equal(customerAssignedToCollector(customer, "u-col-1"), true);
});

test("auditor can access customers in assigned branch scope", () => {
  const customer = { id: "c1", groupId: "g1", collectorId: "u-col-1" };
  const auditor = { id: "u-audit", role: "Auditor" };
  assert.equal(canAccessCustomer(customer, auditor, { groupIds: ["g1"] }), true);
  assert.equal(canAccessCustomer(customer, auditor, { groupIds: ["g2"] }), false);
});
