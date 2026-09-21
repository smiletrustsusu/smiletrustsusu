import test from "node:test";
import assert from "node:assert/strict";
import { canAction, canApproveAmount, defaultActionsForRole, dataScope } from "../src/core/rbac.js";
import {
  applyGroupProfile,
  closeMeeting,
  computeShareOut,
  createShareOut,
  groupDashboard,
  memberGroupCard,
  recordFine,
  recordShare,
  recordWelfare,
  searchGroups,
  setGroupStatus,
  setMemberStatus,
  startMeeting,
  transferMember,
  waiveFine
} from "../src/core/group-ops.js";
import { recordAttendance, recordMeetingLine } from "../src/core/group-meetings.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

test("RBAC: owner has all actions, super admin cannot transfer ownership", () => {
  const owner = { role: "SystemOwner", systemOwner: true };
  const kba = { role: "KBA" };
  const collector = { role: "Collector" };
  const auditor = { role: "Auditor" };
  const cashier = { role: "Cashier" };
  assert.equal(canAction(owner, "Owner.Transfer"), true);
  assert.equal(canAction(kba, "Owner.Transfer"), false);
  assert.equal(canAction(kba, "Group.Create"), true);
  assert.equal(canAction(collector, "Group.Create"), false);
  assert.equal(canAction(collector, "Group.Meeting"), true);
  assert.equal(canAction(collector, "Savings.Collect"), true);
  assert.equal(canAction(auditor, "Savings.Collect"), false);
  assert.equal(canAction(auditor, "Audit.View"), true);
  assert.equal(canApproveAmount(cashier, 500), true);
  assert.equal(canApproveAmount(cashier, 1500), false);
  assert.equal(dataScope(collector), "assigned");
  assert.ok(defaultActionsForRole("Admin").includes("Group.Create"));
});

test("group profile, search, member transfer, and dashboard", () => {
  const group = {
    id: "sg1",
    code: "SG0001",
    name: "Market Women",
    branchId: "b1",
    collectorId: "a1",
    contributionAmount: 10,
    memberships: [{ customerId: "c1", status: "Active" }, { customerId: "c2", status: "Active" }],
    walletPesewas: 0
  };
  applyGroupProfile(group, { groupType: "Market Traders Association", status: "Active", meetingVenue: "Makola" });
  assert.equal(group.groupType, "Market Traders Association");
  assert.equal(searchGroups([group], { q: "makola" }).length, 1);
  const other = { id: "sg2", memberships: [] };
  transferMember(group, other, "c1");
  assert.equal(group.memberships.find((item) => item.customerId === "c1").status, "Closed");
  assert.equal(other.memberships[0].status, "Active");
  setMemberStatus(other, "c1", "Suspended");
  assert.equal(other.memberships[0].status, "Suspended");
  const dash = groupDashboard(group, {
    collections: [{ susuGroupId: "sg1", customerId: "c2", amount: 10, date: "2026-09-09", reversed: false }],
    customers: [{ id: "c2" }],
    loans: [{ susuGroupId: "sg1", principal: 100, amountPaid: 40, totalDue: 100, status: "Active" }],
    meetings: [],
    welfare: [],
    fines: [],
    shares: [],
    date: "2026-09-09"
  });
  assert.equal(dash.paidMembers, 1);
  assert.equal(dash.loanRecoveryRate, 40);
});

test("meeting wizard close posts collections and share-out calculates payouts", () => {
  const group = {
    id: "sg1",
    branchId: "b1",
    collectorId: "a1",
    contributionAmount: 10,
    memberships: [{ customerId: "c1", status: "Active" }],
    walletPesewas: 0,
    code: "SG0001"
  };
  const state = { groupMeetings: [], collections: [], ledgerEntries: [], transactions: [], groupFines: [], groupWelfare: [], groupShares: [], groupShareOuts: [] };
  const started = startMeeting(state, group, { date: "2026-09-09", recordedBy: "a1", uid });
  recordAttendance(started.meeting, "c1", true, "", "Present");
  recordMeetingLine(started.meeting, "contributions", { customerId: "c1", amount: 10 });
  recordMeetingLine(started.meeting, "fines", { customerId: "c1", amount: 2, reason: "Late Arrival" });
  const closed = closeMeeting(state, started.meeting, group, { actor: { id: "a1", role: "Collector" }, uid, receiptFn: () => "RCP-G1" });
  assert.equal(closed.meeting.status, "Closed");
  assert.equal(state.collections.length, 1);
  assert.equal(state.collections[0].susuGroupId, "sg1");
  assert.ok(state.ledgerEntries.length >= 2);
  const welfare = recordWelfare(state, { group, customerId: "c1", amount: 5, type: "Contribution", uid });
  assert.equal(welfare.welfare.status, "Posted");
  const share = recordShare(state, { group, customerId: "c1", amount: 20, type: "Purchase", uid });
  assert.equal(share.share.type, "Purchase");
  const fine = recordFine(state, { group, customerId: "c1", amount: 2, reason: "Late", uid }).fine;
  assert.ok(waiveFine(fine, { role: "Admin" }).fine.waived);
  const calc = computeShareOut(group, {
    customers: [{ id: "c1", name: "Ama", accountNo: "1" }],
    collections: state.collections,
    loans: [],
    fines: state.groupFines,
    shares: state.groupShares
  });
  assert.ok(calc.memberLines[0].finalPayout >= 0);
  const created = createShareOut(state, group, {
    customers: [{ id: "c1", name: "Ama", accountNo: "1" }],
    collections: state.collections,
    loans: [],
    fines: state.groupFines,
    shares: state.groupShares
  }, { createdBy: "u-owner", uid });
  assert.equal(created.shareOut.status, "Pending");
  const card = memberGroupCard(group.memberships[0], { id: "c1", name: "Ama", accountNo: "1" }, {
    collections: state.collections,
    loans: [],
    meetings: [started.meeting],
    fines: state.groupFines,
    groupId: "sg1"
  });
  assert.equal(card.name, "Ama");
  assert.equal(setGroupStatus(group, "Suspended", { role: "Admin" }).group.active, false);
});
