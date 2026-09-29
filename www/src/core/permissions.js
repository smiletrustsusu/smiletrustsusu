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

function customerInUserBranch(customer, user, groupIds = []) {
  if (!customer || !user) return false;
  if (groupIds.length && groupIds.includes(customer.groupId)) return true;
  if (customer.branchId && user.branchId && customer.branchId === user.branchId) return true;
  if (customer.groupId && user.groupId && customer.groupId === user.groupId) return true;
  if (customer.branchId && user.groupId && customer.branchId === user.groupId) return true;
  return false;
}

/** Collector / coordinator: own assigned members only (never other collectors’ books). */
export function isCollectorScopedRole(user) {
  return user?.role === "Collector" || user?.role === "GroupCoordinator";
}

export function filterCustomersForUser(customers = [], user, { groupIds = [] } = {}) {
  if (!user) return [];
  if (HQ_ROLES.includes(user.role)) return customers;
  if (isCollectorScopedRole(user)) {
    const branchKeys = groupIds.length ? groupIds : [user.groupId, user.branchId].filter(Boolean);
    return customers.filter((customer) => {
      if (!customerAssignedToCollector(customer, user.id)) return false;
      if (!branchKeys.length) return true;
      return customerInUserBranch(customer, user, branchKeys);
    });
  }
  let scoped = customers.filter((customer) => customerInUserBranch(customer, user, groupIds));
  if (user.role === "Auditor" || user.role === "CustomerService" || user.role === "Cashier") return scoped;
  return scoped;
}

export function filterCollectionsForUser(collections = [], user, { customers = [], groupIds = [] } = {}) {
  if (!user) return [];
  if (HQ_ROLES.includes(user.role)) return collections;
  const visibleCustomerIds = new Set(
    filterCustomersForUser(customers, user, { groupIds }).map((customer) => customer.id)
  );
  if (isCollectorScopedRole(user)) {
    return collections.filter((item) => {
      if (visibleCustomerIds.has(item.customerId)) return true;
      return item.userId === user.id || item.collectorId === user.id;
    }).filter((item) => {
      if (!groupIds.length) return true;
      return !item.groupId || groupIds.includes(item.groupId);
    });
  }
  if (!groupIds.length) return collections;
  return collections.filter((item) =>
    visibleCustomerIds.has(item.customerId) || (item.groupId && groupIds.includes(item.groupId))
  );
}

export function canAccessCustomer(customer, user, { groupIds = [] } = {}) {
  if (!customer || !user) return false;
  if (HQ_ROLES.includes(user.role)) return true;
  if (!customerInUserBranch(customer, user, groupIds)) return false;
  if (["Admin", "Auditor", "Cashier", "CustomerService", "FieldSupervisor"].includes(user.role)) return true;
  if (isCollectorScopedRole(user)) return customerAssignedToCollector(customer, user.id);
  return false;
}

export function canVerifyHandover(user, handover, state = {}) {
  if (!user || !handover) return false;
  if (handover.collectorId === user.id) return false;
  if (handover.status === "Received" || handover.status === "Verified") return false;

  const receiverId = String(handover.receiverId || "").trim();
  if (receiverId) {
    if (user.id === receiverId) return true;
    // Owners can still confirm if the assigned receiver is unavailable.
    return ["SystemOwner", "KBA", "ManagingDirector"].includes(user.role);
  }

  // Legacy handovers with no assigned receiver.
  if (["SystemOwner", "KBA", "ManagingDirector", "Accountant", "Cashier"].includes(user.role)) return true;
  if (user.role === "Admin" || user.role === "OperationsManager") {
    if (state.settings?.assistantCanVerifyHandover === false) return false;
    return true;
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
