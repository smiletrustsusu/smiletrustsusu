import test from "node:test";
import assert from "node:assert/strict";
import {
  nextSusuGroupCode,
  filterSusuGroupsForUser,
  computeGroupPerformance,
  validateSusuGroupInput,
  upsertMembership,
  activeMemberships
} from "../src/core/susu-groups.js";

test("nextSusuGroupCode increments from existing groups", () => {
  assert.equal(nextSusuGroupCode([{ code: "SG0003" }]), "SG0004");
  assert.equal(nextSusuGroupCode([]), "SG0001");
});

test("collector only sees assigned susu groups", () => {
  const groups = [
    { id: "g1", branchId: "b1", collectorId: "u1", code: "SG0001", name: "Market Women" },
    { id: "g2", branchId: "b1", collectorId: "u2", code: "SG0002", name: "Drivers" }
  ];
  const collector = { id: "u1", role: "Collector" };
  const scoped = filterSusuGroupsForUser(groups, collector, { branchIds: ["b1"] });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, "g1");
});

test("auditor can view all groups in branch scope", () => {
  const groups = [
    { id: "g1", branchId: "b1", collectorId: "u1", code: "SG0001", name: "A" },
    { id: "g2", branchId: "b1", collectorId: "u2", code: "SG0002", name: "B" }
  ];
  const auditor = { id: "u-audit", role: "Auditor" };
  assert.equal(filterSusuGroupsForUser(groups, auditor, { branchIds: ["b1"] }).length, 2);
});

test("computeGroupPerformance counts paid and missed members", () => {
  const group = {
    id: "sg1",
    contributionAmount: 10,
    memberships: [{ customerId: "c1", status: "Active" }, { customerId: "c2", status: "Active" }]
  };
  const collections = [
    { susuGroupId: "sg1", customerId: "c1", amount: 10, date: "2026-09-03", reversed: false }
  ];
  const perf = computeGroupPerformance(group, { collections, date: "2026-09-03" });
  assert.equal(perf.paidMembers, 1);
  assert.equal(perf.missedMembers, 1);
  assert.equal(perf.actual, 10);
});

test("validateSusuGroupInput requires core fields", () => {
  assert.match(validateSusuGroupInput({}), /name/i);
  assert.equal(validateSusuGroupInput({
    name: "Traders",
    branchId: "b1",
    collectorId: "u1",
    contributionAmount: 5
  }), "");
});

test("upsertMembership maintains active members", () => {
  const group = { memberships: [] };
  upsertMembership(group, "c1");
  upsertMembership(group, "c1", "Suspended");
  assert.equal(activeMemberships(group).length, 0);
  assert.equal(group.memberships[0].status, "Suspended");
});
