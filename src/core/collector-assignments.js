/**
 * Collector assignment and reassignment with audit trail.
 */
export const ASSIGNMENT_KINDS = ["customer", "susu_group", "route", "collection_type"];

export function defaultCollectorCapabilities() {
  return {
    susuGroupCollection: true,
    personalSavingsCollection: true
  };
}

export function collectorDoesPersonalSavings(user) {
  const caps = { ...defaultCollectorCapabilities(), ...(user?.collectionCapabilities || {}) };
  return caps.personalSavingsCollection !== false;
}

export function collectorDoesSusuGroup(user) {
  const caps = { ...defaultCollectorCapabilities(), ...(user?.collectionCapabilities || {}) };
  return caps.susuGroupCollection !== false;
}

export function collectorCapabilityBlockedScreens(user) {
  if (!user || user.role !== "Collector") return [];
  const blocked = [];
  if (!collectorDoesSusuGroup(user)) {
    blocked.push("susuGroups", "meetings");
  }
  if (!collectorDoesPersonalSavings(user)) {
    blocked.push("savingsProducts");
  }
  return blocked;
}

export function collectorCanAccessScreenByCapability(user, screenKey) {
  if (!user || user.role !== "Collector") return true;
  return !collectorCapabilityBlockedScreens(user).includes(screenKey);
}

export function collectorCanCollectType(user, collectionType) {
  const caps = { ...defaultCollectorCapabilities(), ...(user?.collectionCapabilities || {}) };
  if (collectionType === "susu_group") return caps.susuGroupCollection !== false;
  if (collectionType === "personal") return caps.personalSavingsCollection !== false;
  return true;
}

export function createAssignment(state, {
  kind,
  entityId,
  fromCollectorId = "",
  toCollectorId,
  reason,
  approvedBy,
  uid
}) {
  if (!kind || !entityId || !toCollectorId) return { error: "Assignment requires kind, entity, and target collector" };
  if (!String(reason || "").trim()) return { error: "Provide a reason for this assignment change" };
  const record = {
    id: uid("asgn"),
    kind,
    entityId,
    fromCollectorId: fromCollectorId || "",
    toCollectorId,
    reason: String(reason).trim(),
    approvedBy: approvedBy || "",
    createdAt: new Date().toISOString()
  };
  state.collectorAssignments = state.collectorAssignments || [];
  state.collectorAssignments.push(record);
  return { assignment: record };
}

export function reassignCustomer(state, customer, toCollectorId, { reason, approvedBy, uid, logAudit }) {
  const fromCollectorId = customer.collectorId || "";
  if (fromCollectorId === toCollectorId) return { error: "Customer is already assigned to this collector" };
  const result = createAssignment(state, {
    kind: "customer",
    entityId: customer.id,
    fromCollectorId,
    toCollectorId,
    reason,
    approvedBy,
    uid
  });
  if (result.error) return result;
  customer.collectorId = toCollectorId;
  customer.updatedAt = new Date().toISOString();
  if (logAudit) logAudit("Customer reassigned", `${customer.name} → collector ${toCollectorId}`);
  return { assignment: result.assignment, customer };
}

export function reassignSusuGroup(state, group, toCollectorId, { reason, approvedBy, uid, logAudit }) {
  const fromCollectorId = group.collectorId || "";
  if (fromCollectorId === toCollectorId) return { error: "Group is already assigned to this collector" };
  const result = createAssignment(state, {
    kind: "susu_group",
    entityId: group.id,
    fromCollectorId,
    toCollectorId,
    reason,
    approvedBy,
    uid
  });
  if (result.error) return result;
  group.collectorId = toCollectorId;
  group.updatedAt = new Date().toISOString();
  if (logAudit) logAudit("Susu group reassigned", `${group.name || group.code} → collector ${toCollectorId}`);
  return { assignment: result.assignment, group };
}

export function updateCollectorCapabilities(user, capabilities = {}) {
  user.collectionCapabilities = {
    ...defaultCollectorCapabilities(),
    ...(user.collectionCapabilities || {}),
    ...capabilities
  };
  user.updatedAt = new Date().toISOString();
  return user;
}

export function assignmentHistory(state, { entityId = "", collectorId = "" } = {}) {
  return (state.collectorAssignments || [])
    .filter((item) => {
      if (entityId && item.entityId !== entityId) return false;
      if (collectorId && item.toCollectorId !== collectorId && item.fromCollectorId !== collectorId) return false;
      return true;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
