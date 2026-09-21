import test from "node:test";
import assert from "node:assert/strict";
import {
  reassignCustomer,
  collectorCanCollectType,
  collectorCanAccessScreenByCapability,
  collectorCapabilityBlockedScreens,
  collectorDoesPersonalSavings,
  collectorDoesSusuGroup,
  createAssignment,
  defaultCollectorCapabilities
} from "../src/core/collector-assignments.js";

test("collectorCanCollectType respects capabilities", () => {
  const user = { collectionCapabilities: { susuGroupCollection: true, personalSavingsCollection: false } };
  assert.equal(collectorCanCollectType(user, "susu_group"), true);
  assert.equal(collectorCanCollectType(user, "personal"), false);
});

test("createAssignment requires reason", () => {
  const state = { collectorAssignments: [] };
  const result = createAssignment(state, {
    kind: "customer",
    entityId: "c1",
    toCollectorId: "u2",
    reason: "",
    uid: () => "asgn1"
  });
  assert.ok(result.error);
});

test("reassignCustomer records audit and updates collector", () => {
  const state = { collectorAssignments: [] };
  const customer = { id: "c1", name: "Ama", collectorId: "u1" };
  const audits = [];
  const result = reassignCustomer(state, customer, "u2", {
    reason: "Route change",
    approvedBy: "owner",
    uid: () => "asgn1",
    logAudit: (action, detail) => audits.push({ action, detail })
  });
  assert.ok(result.assignment);
  assert.equal(customer.collectorId, "u2");
  assert.equal(state.collectorAssignments.length, 1);
  assert.equal(audits.length, 1);
});

test("defaultCollectorCapabilities allows both collection types", () => {
  const caps = defaultCollectorCapabilities();
  assert.equal(caps.susuGroupCollection, true);
  assert.equal(caps.personalSavingsCollection, true);
});

test("personal-only collector cannot access susu screens", () => {
  const user = { role: "Collector", collectionCapabilities: { susuGroupCollection: false, personalSavingsCollection: true } };
  assert.equal(collectorDoesPersonalSavings(user), true);
  assert.equal(collectorDoesSusuGroup(user), false);
  assert.deepEqual(collectorCapabilityBlockedScreens(user), ["susuGroups", "meetings"]);
  assert.equal(collectorCanAccessScreenByCapability(user, "susuGroups"), false);
  assert.equal(collectorCanAccessScreenByCapability(user, "collections"), true);
  assert.equal(collectorCanAccessScreenByCapability(user, "customers"), true);
});

test("susu-only collector cannot access savings products screen", () => {
  const user = { role: "Collector", collectionCapabilities: { susuGroupCollection: true, personalSavingsCollection: false } };
  assert.equal(collectorDoesSusuGroup(user), true);
  assert.equal(collectorDoesPersonalSavings(user), false);
  assert.deepEqual(collectorCapabilityBlockedScreens(user), ["savingsProducts"]);
  assert.equal(collectorCanAccessScreenByCapability(user, "susuGroups"), true);
  assert.equal(collectorCanAccessScreenByCapability(user, "savingsProducts"), false);
});
