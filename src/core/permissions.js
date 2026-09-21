/**
 * Financial access control for Smile Trust Susu.
 * Collectors are scoped to accounts assigned to them.
 * Assistant Managers cannot verify their own handovers unless explicitly granted.
 */

export function customerAssignedToCollector(customer, collectorUserId) {
  if (!customer || !collectorUserId) return false;
  return String(customer.collectorId || "") === String(collectorUserId);
}

const HQ_ROLES = ["SystemOwner", "KBA", "Developer", "ManagingDirector", "OperationsManager", "Accountant"];

export function filterCustomersForUser(customers = [], user, { groupIds = [] } = {}) {
  if (!user) return [];
  if (HQ_ROLES.includes(user.role)) return customers;
  let scoped = customers.filter((customer) =>
    groupIds.includes(customer.groupId)
    || Boolean(customer.branchId && user.branchId && customer.branchId === user.branchId)
  );
  if (user.role === "Auditor" || user.role === "CustomerService" || user.role === "Cashier") return scoped;
  if (user.role === "Collector" || user.role === "GroupCoordinator") {
    scoped = scoped.filter((customer) => customerAssignedToCollector(customer, user.id));
  }
  return scoped;
}

export function canAccessCustomer(customer, user, { groupIds = [] } = {}) {
  if (!customer || !user) return false;
  if (HQ_ROLES.includes(user.role)) return true;
  const inGroup = groupIds.includes(customer.groupId);
  const inBranch = Boolean(customer.branchId && user.branchId && customer.branchId === user.branchId);
  if (!inGroup && !inBranch) return false;
  if (["Admin", "Auditor", "Cashier", "CustomerService", "FieldSupervisor"].includes(user.role)) return true;
  if (user.role === "Collector" || user.role === "GroupCoordinator") return customerAssignedToCollector(customer, user.id);
  return false;
}

export function canVerifyHandover(user, handover, state = {}) {
  if (!user || !handover) return false;
  if (user.role === "SystemOwner" || user.role === "KBA" || user.role === "ManagingDirector") return true;
  if (user.role === "Admin" || user.role === "OperationsManager" || user.role === "Cashier") {
    if (handover.collectorId === user.id) return false;
    if (user.role === "Cashier") return true;
    if (state.settings?.assistantCanVerifyHandover === true) return true;
    return false;
  }
  return false;
}

export function canApproveReversal(user, reversal, state = {}) {
  if (!user || !reversal) return false;
  if (user.role === "SystemOwner" || user.role === "KBA" || user.role === "ManagingDirector" || user.role === "Accountant") return true;
  if (user.role === "Admin" || user.role === "OperationsManager") {
    if (reversal.requestedBy === user.id) return false;
    return state.settings?.assistantCanApproveReversals === true;
  }
  return false;
}

export function canReverseCollection(user) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "Accountant"].includes(user?.role);
}

export function canEditFinancialRecord(user) {
  return false; // financial records are append-only; use reversals
}

export function canDeleteFinancialRecord(user) {
  return false;
}

export function resolveCollectorForRegistration(user, group, users = []) {
  if (!user) return "";
  if (user.role === "Collector") return user.id;
  if (group?.collectorId) return group.collectorId;
  const linkedCollector = users.find((item) =>
    item.role === "Collector" && item.active && item.groupId === group?.id
  );
  if (linkedCollector) return linkedCollector.id;
  if (["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager"].includes(user.role)) return user.id;
  return "";
}

export function isAuditorRole(user) {
  return user?.role === "Auditor";
}

export function isReadOnlyRole(user) {
  return isAuditorRole(user);
}

export function canWriteFinancialData(user) {
  return user && !isReadOnlyRole(user) && user.role !== "Developer";
}

export function canManageSusuGroups(user) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "GroupCoordinator", "FieldSupervisor"].includes(user?.role);
}

export function canViewAuditReports(user) {
  return ["SystemOwner", "KBA", "Admin", "Auditor", "Developer", "ManagingDirector", "Accountant", "OperationsManager"].includes(user?.role);
}
