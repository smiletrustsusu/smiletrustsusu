import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAgentOps,
  agentCanCollectProduct,
  findDuplicateAgents,
  searchAgents,
  setAgentStatus,
  transferAgentBranch,
  upsertRoute,
  clockIn,
  clockOut,
  calculateCommission,
  agentWallet,
  requestLeave,
  decideLeave,
  logVisit,
  addAgentNote,
  agentKpis,
  dailyCollectionSummary,
  productPermissionFromForm,
  canManageAgents
} from "../src/core/agent-ops.js";

const uid = (prefix) => `${prefix}-1`;

test("agent profile, product permissions, and duplicate detection", () => {
  const user = { id: "a1", name: "Kofi", role: "Collector", phone: "0241112222" };
  applyAgentOps(user, {
    employeeNumber: "EMP01",
    email: "kofi@test.com",
    employmentStatus: "Active",
    productPermissions: { weeklySavings: false, dailySavings: true }
  });
  assert.equal(user.employeeNumber, "EMP01");
  assert.equal(agentCanCollectProduct(user, { frequency: "Weekly" }), false);
  assert.equal(agentCanCollectProduct(user, { frequency: "Daily" }), true);
  assert.equal(agentCanCollectProduct(user, {}, { isGroup: true }), true);
  const dups = findDuplicateAgents([user, { id: "a2", role: "Collector", phone: "0200000000" }], { phone: "024 111 2222" });
  assert.equal(dups[0].id, "a1");
  assert.equal(searchAgents([user], "emp01").length, 1);
  assert.equal(productPermissionFromForm({ perm_dailySavings: "on" }).weeklySavings, false);
});

test("status, branch transfer, and route uniqueness", () => {
  const actor = { id: "u-owner", role: "SystemOwner" };
  const agent = { id: "a1", name: "Ama", role: "Collector", groupId: "b1", employmentStatus: "Active", active: true };
  assert.equal(canManageAgents(actor), true);
  assert.equal(setAgentStatus(agent, "Suspended", actor, uid).user.active, false);
  const state = { collectorAssignments: [], agentRoutes: [] };
  const transfer = transferAgentBranch(state, agent, "b2", { reason: "Coverage", approvedBy: actor.id, uid });
  assert.equal(agent.groupId, "b2");
  assert.ok(transfer.assignment);
  assert.ok(upsertRoute(state, { code: "R1", name: "Madina East" }, uid).route);
  assert.ok(upsertRoute(state, { code: "R1", name: "Duplicate" }, uid).error);
});

test("attendance, commission engine, and wallet", () => {
  const agent = { id: "a1", name: "Ama", commissionType: "Percentage", commissionRate: 2, groupId: "b1" };
  const state = { agentAttendance: [], collections: [], handovers: [], expenses: [], users: [agent] };
  const inn = clockIn(state, agent, { date: "2026-09-08", uid });
  assert.equal(inn.attendance.status === "Present" || inn.attendance.status === "Late", true);
  assert.ok(clockIn(state, agent, { date: "2026-09-08", uid }).error);
  const out = clockOut(state, agent, { date: "2026-09-08", uid });
  assert.ok(out.attendance.clockOutAt);
  assert.equal(calculateCommission(agent, 1000), 20);
  assert.equal(calculateCommission({ commissionType: "Tiered Commission", commissionRate: 1 }, 2000), 40);
  state.collections.push({ userId: "a1", amount: 80, paymentMethod: "Cash", date: "2026-09-08" });
  state.handovers.push({ collectorId: "a1", declaredCash: 50, date: "2026-09-08", status: "Submitted" });
  const wallet = agentWallet(state, "a1", { date: "2026-09-08" });
  assert.equal(wallet.collected, 80);
  assert.equal(wallet.cashOnHand, 30);
});

test("leave, visits, notes, and KPIs", () => {
  const actor = { id: "u-owner", role: "SystemOwner" };
  const agent = { id: "a1", name: "Ama", role: "Collector", leaveBalance: 21 };
  const state = {
    users: [agent],
    agentLeave: [],
    agentVisits: [],
    collections: [{ userId: "a1", customerId: "c1", amount: 10, date: "2026-09-08" }],
    customers: [{ id: "c1", collectorId: "a1", active: true }],
    susuGroups: [],
    loans: [],
    agentAttendance: [],
    expenses: [],
    handovers: []
  };
  const leave = requestLeave(state, agent, { type: "Annual Leave", days: 2, from: "2026-09-10", to: "2026-09-11" }, uid);
  assert.equal(leave.leave.status, "Pending");
  assert.equal(decideLeave(state, leave.leave.id, actor, true, uid).leave.status, "Approved");
  assert.equal(agent.leaveBalance, 19);
  assert.ok(logVisit(state, { customerId: "c1", agentId: "a1", purpose: "Collection", outcome: "Paid" }, uid).visit);
  assert.ok(addAgentNote(agent, { body: "Field coaching", userId: actor.id }, uid).note);
  const kpis = agentKpis(agent, state, { date: "2026-09-08" });
  assert.equal(kpis.assigned, 1);
  assert.equal(kpis.daily, 10);
  assert.equal(dailyCollectionSummary(state, "a1", "2026-09-08").successful, 1);
});
