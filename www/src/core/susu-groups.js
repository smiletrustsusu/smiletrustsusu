import { toPesewas, fromPesewas, sumPesewas } from "./money.js";

export const MEMBERSHIP_STATUSES = ["Active", "Suspended", "Closed", "Deceased"];
export const CUSTOMER_STATUSES = ["Active", "Suspended", "Closed", "Deceased"];

export function nextSusuGroupCode(existingGroups = []) {
  const numbers = existingGroups
    .map((group) => Number(String(group.code || "").replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `SG${String(next).padStart(4, "0")}`;
}

export function filterSusuGroupsForUser(groups = [], user, { branchIds = [] } = {}) {
  if (!user) return [];
  if (["SystemOwner", "KBA", "Developer", "Auditor", "ManagingDirector", "OperationsManager", "Accountant"].includes(user.role)) {
    return groups.filter((group) => !branchIds.length || branchIds.includes(group.branchId));
  }
  if (user.role === "Admin" || user.role === "FieldSupervisor" || user.role === "Cashier" || user.role === "CustomerService") {
    return groups.filter((group) => !branchIds.length || branchIds.includes(group.branchId));
  }
  if (user.role === "Collector" || user.role === "GroupCoordinator") {
    return groups.filter((group) =>
      group.collectorId === user.id && (!branchIds.length || branchIds.includes(group.branchId))
    );
  }
  return [];
}

export function canManageSusuGroups(user) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "GroupCoordinator"].includes(user?.role);
}

export function groupMemberships(group) {
  return group?.memberships || [];
}

export function activeMemberships(group) {
  return groupMemberships(group).filter((item) => item.status === "Active");
}

export function upsertMembership(group, customerId, status = "Active") {
  group.memberships = groupMemberships(group);
  const existing = group.memberships.find((item) => item.customerId === customerId);
  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const membership = {
    customerId,
    status,
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  group.memberships.push(membership);
  return membership;
}

export function computeGroupPerformance(group, { collections = [], customers = [], date = "" } = {}) {
  const memberIds = new Set(activeMemberships(group).map((item) => item.customerId));
  const memberCollections = collections.filter((item) =>
    item.susuGroupId === group.id
    && memberIds.has(item.customerId)
    && (!date || item.date === date)
    && !item.reversed
  );
  const actualPesewas = sumPesewas(memberCollections.map((item) => toPesewas(item.amount)));
  const contributionPesewas = toPesewas(group.contributionAmount || 0);
  const activeCount = memberIds.size;
  const expectedPesewas = date ? contributionPesewas * activeCount : 0;
  const paidMembers = new Set(memberCollections.filter((item) => Number(item.amount) > 0).map((item) => item.customerId)).size;
  const partialMembers = memberCollections.filter((item) => {
    const amt = toPesewas(item.amount);
    return amt > 0 && contributionPesewas > 0 && amt < contributionPesewas;
  }).length;
  const missedMembers = Math.max(0, activeCount - paidMembers);
  return {
    groupId: group.id,
    expected: fromPesewas(expectedPesewas),
    actual: fromPesewas(actualPesewas),
    expectedPesewas,
    actualPesewas,
    activeMembers: activeCount,
    paidMembers,
    partialMembers,
    missedMembers,
    balance: fromPesewas(Number(group.walletPesewas || 0) + actualPesewas)
  };
}

export function validateSusuGroupInput(data) {
  if (!String(data.name || "").trim()) return "Group name is required";
  if (!String(data.branchId || "").trim()) return "Branch is required";
  if (!String(data.collectorId || "").trim()) return "Assigned collector is required";
  if (Number(data.contributionAmount || 0) <= 0) return "Contribution amount must be greater than zero";
  return "";
}
