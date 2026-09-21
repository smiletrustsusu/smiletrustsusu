import { App } from "../context.js";

export function currentUser() {
  return App.state?.users?.find((user) => user.id === App.sessionUserId);
}

export function isKBA() {
  const user = currentUser();
  return user?.role === "KBA" || user?.role === "SystemOwner" || user?.systemOwner === true;
}

export function isAdmin() {
  return currentUser()?.role === "Admin";
}

export function isCollector() {
  return currentUser()?.role === "Collector";
}

export function canManageUsers() {
  return isKBA();
}

export function canAdmin() {
  return isAdmin();
}

export function userLinkedToGroup(user, group) {
  if (!user || !group) return false;
  if (user.groupId && user.groupId === group.id) return true;
  if (group.adminId === user.id) return true;
  if (group.collectorId === user.id) return true;
  return false;
}

export function visibleGroups() {
  if (isKBA()) return App.state.groups;
  const user = currentUser();
  if (!user) return [];
  if (["SystemOwner", "ManagingDirector", "OperationsManager", "Accountant", "Auditor", "Developer"].includes(user.role)) {
    return App.state.groups;
  }
  if (["Admin", "Collector", "Cashier", "FieldSupervisor", "GroupCoordinator", "CustomerService"].includes(user.role)) {
    return App.state.groups.filter((group) => userLinkedToGroup(user, group) || group.id === user.groupId || group.branchId === user.branchId);
  }
  return App.state.groups.filter((group) => group.collectorId === user.id);
}

export function visibleGroupIds() {
  return visibleGroups().map((group) => group.id);
}

export function visibleCustomers() {
  const groups = visibleGroupIds();
  if (isKBA()) return App.state.customers;
  return App.state.customers.filter((customer) => groups.includes(customer.groupId));
}

export function visibleCollections() {
  const groups = visibleGroupIds();
  if (isKBA()) return App.state.collections;
  return App.state.collections.filter((item) => groups.includes(item.groupId));
}

export function visibleLoans() {
  const groups = visibleGroupIds();
  if (isKBA()) return App.state.loans;
  return App.state.loans.filter((loan) => groups.includes(loan.groupId));
}

export function visibleTransactions() {
  const customerIds = visibleCustomers().map((customer) => customer.id);
  if (isKBA()) return App.state.transactions;
  return App.state.transactions.filter((tx) => customerIds.includes(tx.customerId));
}

export function visibleMessages() {
  const customerIds = visibleCustomers().map((customer) => customer.id);
  if (isKBA()) return App.state.messages;
  return App.state.messages.filter((message) => customerIds.includes(message.customerId));
}

export function primaryGroup() {
  return visibleGroups()[0];
}
