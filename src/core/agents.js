/**
 * Field agent / collector profile, commission, collection types, and targets.
 */
import { defaultCollectorCapabilities, collectorCanCollectType } from "./collector-assignments.js";

export const EMPLOYMENT_STATUSES = ["Active", "Probation", "Suspended", "Resigned", "Terminated"];
export const COMMISSION_TYPES = ["None", "Percentage", "Flat per collection", "Salary plus commission"];
export const COLLECTION_AUTHORITY = {
  INDIVIDUAL: "individual",
  GROUP: "group",
  BOTH: "both"
};

export function nextAgentCode(users = []) {
  const numbers = users
    .map((user) => Number(String(user.agentCode || user.collectorCode || "").replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `AG${String(next).padStart(4, "0")}`;
}

export function collectionAuthorityFromCapabilities(user) {
  const caps = { ...defaultCollectorCapabilities(), ...(user?.collectionCapabilities || {}) };
  if (caps.personalSavingsCollection !== false && caps.susuGroupCollection !== false) return COLLECTION_AUTHORITY.BOTH;
  if (caps.susuGroupCollection !== false) return COLLECTION_AUTHORITY.GROUP;
  return COLLECTION_AUTHORITY.INDIVIDUAL;
}

export function capabilitiesFromAuthority(authority) {
  if (authority === COLLECTION_AUTHORITY.INDIVIDUAL) {
    return { personalSavingsCollection: true, susuGroupCollection: false };
  }
  if (authority === COLLECTION_AUTHORITY.GROUP) {
    return { personalSavingsCollection: false, susuGroupCollection: true };
  }
  return { personalSavingsCollection: true, susuGroupCollection: true };
}

export function applyAgentProfile(user, data = {}) {
  const authority = data.collectionAuthority || collectionAuthorityFromCapabilities(user);
  user.agentCode = String(data.agentCode || user.agentCode || "").trim().toUpperCase();
  user.nationalId = String(data.nationalId || data.ghanaCard || user.nationalId || user.ghanaCard || "").trim();
  user.ghanaCard = user.nationalId;
  user.residentialAddress = String(data.residentialAddress || user.residentialAddress || "").trim();
  user.phoneAlt = String(data.phoneAlt || user.phoneAlt || "").trim();
  user.emergencyContactName = String(data.emergencyContactName || user.emergencyContactName || "").trim();
  user.emergencyContactPhone = String(data.emergencyContactPhone || user.emergencyContactPhone || "").trim();
  user.employmentStatus = EMPLOYMENT_STATUSES.includes(data.employmentStatus)
    ? data.employmentStatus
    : (user.employmentStatus || (user.active === false ? "Suspended" : "Active"));
  user.commissionType = COMMISSION_TYPES.includes(data.commissionType) ? data.commissionType : (user.commissionType || "None");
  user.commissionRate = Number(data.commissionRate ?? user.commissionRate ?? 0);
  user.dailyTarget = Number(data.dailyTarget ?? user.dailyTarget ?? 0);
  user.branchId = data.branchId || user.branchId || user.groupId || "";
  user.collectionCapabilities = {
    ...defaultCollectorCapabilities(),
    ...(user.collectionCapabilities || {}),
    ...capabilitiesFromAuthority(authority)
  };
  user.updatedAt = new Date().toISOString();
  return user;
}

export function agentMayCollect(user, collectionType) {
  return collectorCanCollectType(user, collectionType);
}

export function computeAgentCommission(user, collectedAmount) {
  const amount = Number(collectedAmount || 0);
  if (!user || user.commissionType === "None" || amount <= 0) return 0;
  if (user.commissionType === "Percentage") return +(amount * Number(user.commissionRate || 0) / 100).toFixed(2);
  if (user.commissionType === "Flat per collection") return Number(user.commissionRate || 0);
  if (user.commissionType === "Salary plus commission") return +(amount * Number(user.commissionRate || 0) / 100).toFixed(2);
  return 0;
}

export function agentPerformance(user, { collections = [], customers = [], susuGroups = [], date = "" } = {}) {
  const mine = collections.filter((item) =>
    (item.collectorId === user.id || item.userId === user.id)
    && !item.reversed
    && (!date || item.date === date)
  );
  const collected = mine.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cash = mine.filter((item) => (item.paymentMethod || "Cash") === "Cash").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const electronic = collected - cash;
  const assignedCustomers = customers.filter((item) => item.collectorId === user.id && item.active !== false).length;
  const assignedGroups = susuGroups.filter((item) => item.collectorId === user.id).length;
  const target = Number(user.dailyTarget || 0);
  return {
    agentId: user.id,
    collected,
    cash,
    electronic,
    receipts: mine.length,
    assignedCustomers,
    assignedGroups,
    target,
    achievementPercent: target > 0 ? Math.round((collected / target) * 100) : (collected > 0 ? 100 : 0),
    commission: computeAgentCommission(user, collected)
  };
}

export function staffAgents(users = []) {
  return users.filter((user) => user.role === "Collector" || user.role === "GroupCoordinator" || user.role === "FieldSupervisor");
}
