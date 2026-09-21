import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBranchProfile,
  saveBranch,
  setBranchStatus,
  searchBranches,
  branchDashboard,
  branchRankings,
  setBranchTargets,
  createBranchTransfer,
  applyEntityTransfer,
  bulkTransferCustomers,
  publishAnnouncement,
  acknowledgeAnnouncement,
  addCalendarEvent,
  addBranchDocument,
  canManageBranches
} from "../src/core/branch-ops.js";

const uid = (prefix) => `${prefix}-1`;

test("branch profile, unique codes, and status rules", () => {
  const state = { branches: [], groups: [] };
  const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true };
  const created = saveBranch(state, { name: "Madina", code: "BR010", region: "Greater Accra", updatedBy: owner.id }, uid);
  assert.equal(created.branch.code, "BR010");
  assert.equal(created.branch.status, "Active");
  applyBranchProfile(created.branch, { branchType: "Urban", floatLimit: 5000 });
  assert.equal(created.branch.floatLimit, 5000);
  assert.ok(saveBranch(state, { name: "Duplicate", code: "BR010" }, uid).error);
  assert.equal(canManageBranches(owner), true);
  assert.equal(setBranchStatus(created.branch, "Suspended", owner, uid).branch.active, false);
  assert.equal(searchBranches(state.branches, "madina").length, 1);
});

test("dashboard, targets, and rankings use existing collections", () => {
  const branch = { id: "br1", name: "Tema", locationGroupId: "g1", status: "Active", targets: {} };
  setBranchTargets(branch, { monthlyCollection: 100 });
  const state = {
    groups: [{ id: "g1", branchId: "br1" }],
    customers: [{ id: "c1", groupId: "g1", active: true, createdAt: "2026-09-01T00:00:00.000Z" }],
    users: [{ id: "a1", role: "Collector", groupId: "g1", active: true }],
    susuGroups: [{ id: "sg1", branchId: "br1", name: "Tema Circle" }],
    collections: [{ groupId: "g1", amount: 40, date: "2026-09-08" }],
    loans: [{ groupId: "g1", totalDue: 100, amountPaid: 40, status: "Active" }],
    transactions: [],
    expenses: [],
    handovers: [],
    withdrawalRequests: []
  };
  const dash = branchDashboard(branch, state, { date: "2026-09-08" });
  assert.equal(dash.customers, 1);
  assert.equal(dash.todayCollections, 40);
  assert.equal(dash.loanRecoveryRate, 40);
  assert.equal(dash.progress.collection, 40);
  assert.equal(branchRankings([branch], state, { date: "2026-09-08" })[0].rank, 1);
});

test("transfers, announcements, calendar, and documents", () => {
  const state = {
    branches: [
      { id: "br1", name: "A", locationGroupId: "g1", activityLog: [] },
      { id: "br2", name: "B", locationGroupId: "g2", activityLog: [] }
    ],
    groups: [{ id: "g1" }, { id: "g2" }],
    customers: [{ id: "c1", groupId: "g1", name: "Ama" }],
    users: [],
    susuGroups: [],
    collectorAssignments: [],
    branchTransfers: [],
    branchAnnouncements: [],
    branchCalendar: []
  };
  const created = createBranchTransfer(state, {
    kind: "customer",
    entityId: "c1",
    fromBranchId: "br1",
    toBranchId: "br2",
    reason: "Relocation"
  }, uid);
  assert.ok(created.transfer);
  assert.ok(applyEntityTransfer(state, created.transfer, { uid, approvedBy: "u-owner" }).transfer);
  assert.equal(state.customers[0].groupId, "g2");
  const bulk = bulkTransferCustomers(state, ["c1"], "br1", { reason: "Return", requestedBy: "u-owner", uid });
  assert.equal(bulk.results[0].ok, true);
  const ann = publishAnnouncement(state, { branchId: "br1", title: "Holiday", type: "Holiday Notice", body: "Closed Friday" }, uid);
  acknowledgeAnnouncement(ann.announcement, "u1");
  assert.equal(ann.announcement.acknowledgements.length, 1);
  assert.ok(addCalendarEvent(state, { branchId: "br1", title: "Training", date: "2026-09-10", type: "Training" }, uid).event);
  assert.equal(addBranchDocument(state.branches[0], { type: "Operating License", fileName: "lic.pdf" }, uid).document.version, 1);
});
