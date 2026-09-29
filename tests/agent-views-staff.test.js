import test from "node:test";
import assert from "node:assert/strict";
import { renderAgentOpsFormExtras, renderAgentAnalytics, renderAgentFilters, renderAgentTable } from "../src/ui/agent-views.js";
import { agentRankings, searchAgents, canManageAgents } from "../src/core/agent-ops.js";
import { staffAgents } from "../src/core/agents.js";
import {
  canActorSeeUserAccount,
  listUsersForActor
} from "../src/core/system-accounts.js";
import { canAccessView, navItemsForRole, ROLE } from "../src/core/roles.js";

test("renderAgentOpsFormExtras tolerates null/undefined (create Staff form)", () => {
  const htmlNull = renderAgentOpsFormExtras(null, []);
  const htmlUndef = renderAgentOpsFormExtras(undefined, []);
  const htmlEmpty = renderAgentOpsFormExtras({}, []);
  assert.match(htmlNull, /Agent Identity/);
  assert.match(htmlUndef, /Employee Number/);
  assert.match(htmlEmpty, /Product Collection Permissions/);
  assert.doesNotThrow(() => renderAgentOpsFormExtras(null, [{ id: "s1", name: "Sup" }]));
});

test("JOHN can navigate to Staff (users) and Collectors (agents); KBA stays hidden", () => {
  const john = { id: "u-owner", username: "JOHN", role: ROLE.SYSTEM_OWNER, systemOwner: true, active: true };
  const kba = { id: "u-superadmin", username: "KBA", role: "KBA", active: true, systemDeveloper: true };
  const collector = { id: "u-c1", username: "ama", name: "Ama", role: "Collector", active: true, groupId: "g1" };
  const users = [john, kba, collector];

  assert.equal(canAccessView(john, "users"), true);
  assert.equal(canAccessView(john, "agents"), true);
  assert.ok(navItemsForRole(ROLE.SYSTEM_OWNER).some(([key]) => key === "users"));
  assert.ok(navItemsForRole(ROLE.SYSTEM_OWNER).some(([key]) => key === "agents"));
  assert.equal(canManageAgents(john), true);

  assert.equal(canActorSeeUserAccount(john, kba), false);
  const visible = listUsersForActor(users, john);
  assert.equal(visible.some((u) => String(u.username).toLowerCase() === "kba"), false);
  assert.ok(visible.some((u) => u.id === collector.id));

  const agents = staffAgents(visible);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, collector.id);

  const state = { users, customers: [], collections: [], loans: [], susuGroups: [], agentAttendance: [], agentRoutes: [], offlineQueue: [] };
  const rankings = agentRankings(agents, state, { date: "2026-09-23" });
  const filtered = searchAgents(agents, "", { branchName: () => "Branch" });
  assert.doesNotThrow(() => {
    renderAgentAnalytics({ total: agents.length, active: 1, inactive: 0, today: 0 }, rankings);
    renderAgentFilters([]);
    renderAgentTable(filtered, {
      branchName: () => "Branch",
      kpis: () => ({ assigned: 0, groups: 0, daily: 0 }),
      pendingIds: new Set()
    });
  });
});
