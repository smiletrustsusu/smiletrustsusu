/**
 * Branch HQ operations: profile, dashboard, targets, transfers,
 * announcements, calendar, documents, cash summary, and settings.
 * Locations (`groups`) remain the operational collection unit.
 */
import { upsertBranch, nextBranchCode, filterBranchesForUser, branchPerformance } from "./branches.js";
import { reassignCustomer, reassignSusuGroup } from "./collector-assignments.js";
import { transferAgentBranch } from "./agent-ops.js";
import { isSystemDeveloperAccount, listUsersForActor } from "./system-accounts.js";

export const BRANCH_STATUSES = ["Active", "Inactive", "Suspended", "Closed"];
export const BRANCH_TYPES = ["Head Office", "Urban", "Rural", "Satellite", "Mobile"];
export const BRANCH_DOC_TYPES = [
  "Registration Certificate",
  "Operating License",
  "Rental Agreement",
  "Insurance",
  "Tax Document",
  "Utility Bill",
  "Inspection Report"
];
export const ANNOUNCEMENT_TYPES = ["Meeting", "Policy Change", "Training", "Holiday Notice", "Emergency"];
export const CALENDAR_TYPES = ["Meeting", "Collection Event", "Training", "Loan Deadline", "Public Holiday", "Internal Event"];
export const TRANSFER_KINDS = ["customer", "agent", "group", "staff", "cash"];
export const APPROVAL_KEYS = [
  "customerApproval",
  "loanApproval",
  "withdrawalApproval",
  "expenseApproval",
  "cashTransferApproval",
  "branchClosureApproval"
];

export function canManageBranches(actor) {
  return ["SystemOwner", "KBA", "ManagingDirector", "OperationsManager", "Admin"].includes(actor?.role);
}

export function canConfigureBranchApprovals(actor) {
  return actor?.role === "SystemOwner" || actor?.systemOwner === true;
}

export function defaultBranchSettings() {
  return {
    receiptPrefix: "ST",
    customerPrefix: "ST",
    groupPrefix: "SG",
    agentPrefix: "AG",
    loanPrefix: "LN",
    currency: "GHS",
    timezone: "Africa/Accra",
    openingTime: "08:00",
    closingTime: "17:00",
    workingDays: "Mon-Fri",
    cashHoldingLimit: 0,
    collectionLimit: 0,
    notifyCollections: true,
    notifyLoans: true,
    approvals: Object.fromEntries(APPROVAL_KEYS.map((key) => [key, true]))
  };
}

export function defaultBranchTargets() {
  return {
    monthlyCollection: 0,
    loanRecovery: 0,
    customerAcquisition: 0,
    savingsGrowth: 0,
    expenseLimit: 0
  };
}

export function applyBranchProfile(branch, data = {}) {
  branch.branchType = BRANCH_TYPES.includes(data.branchType) ? data.branchType : (branch.branchType || "Urban");
  branch.dateOpened = data.dateOpened || branch.dateOpened || (branch.createdAt || "").slice(0, 10);
  branch.status = BRANCH_STATUSES.includes(data.status) ? data.status : (branch.status || (branch.active === false ? "Inactive" : "Active"));
  branch.active = !["Inactive", "Suspended", "Closed"].includes(branch.status);
  branch.phoneAlt = String(data.phoneAlt || branch.phoneAlt || "").trim();
  branch.district = String(data.district || branch.district || "").trim();
  branch.town = String(data.town || branch.town || "").trim();
  branch.digitalAddress = String(data.digitalAddress || branch.digitalAddress || data.gpsAddress || branch.gpsAddress || "").trim();
  branch.assistantManagerId = data.assistantManagerId || branch.assistantManagerId || "";
  branch.supervisorId = data.supervisorId || branch.supervisorId || "";
  branch.accountantId = data.accountantId || branch.accountantId || "";
  branch.cashierId = data.cashierId || branch.cashierId || "";
  branch.bankName = String(data.bankName || branch.bankName || "").trim();
  branch.bankAccountNumber = String(data.bankAccountNumber || branch.bankAccountNumber || "").trim();
  branch.bankAccountName = String(data.bankAccountName || branch.bankAccountName || "").trim();
  branch.momoNumbers = String(data.momoNumbers || branch.momoNumbers || "").trim();
  branch.floatLimit = Number(data.floatLimit ?? branch.floatLimit ?? 0);
  branch.openingTime = data.openingTime || branch.openingTime || "08:00";
  branch.closingTime = data.closingTime || branch.closingTime || "17:00";
  branch.workingDays = String(data.workingDays || branch.workingDays || "Mon-Fri").trim();
  branch.holidays = String(data.holidays || branch.holidays || "").trim();
  branch.emergencyClosed = data.emergencyClosed === true || data.emergencyClosed === "on" || branch.emergencyClosed === true;
  branch.settings = { ...defaultBranchSettings(), ...(branch.settings || {}), ...(data.settings || {}) };
  branch.targets = { ...defaultBranchTargets(), ...(branch.targets || {}), ...(data.targets || {}) };
  branch.documents = Array.isArray(data.documents) ? data.documents : (branch.documents || []);
  branch.activityLog = Array.isArray(data.activityLog) ? data.activityLog : (branch.activityLog || []);
  branch.updatedAt = new Date().toISOString();
  return branch;
}

export function saveBranch(state, data, uid) {
  const result = upsertBranch(state, data, uid);
  if (result.error) return result;
  applyBranchProfile(result.branch, data);
  if (!result.branch.locationGroupId) {
    const match = (state.groups || []).find((group) => group.branchId === result.branch.id || group.name === result.branch.name);
    if (match) {
      result.branch.locationGroupId = match.id;
      match.branchId = result.branch.id;
    }
  }
  appendBranchActivity(result.branch, {
    action: data.id ? "Branch updated" : "Branch created",
    detail: result.branch.name,
    userId: data.updatedBy || "",
    uid
  });
  return result;
}

export function setBranchStatus(branch, status, actor, uid) {
  if (!BRANCH_STATUSES.includes(status)) return { error: "Invalid branch status" };
  if (!canManageBranches(actor)) return { error: "You cannot change branch status" };
  if (status === "Closed" && !canConfigureBranchApprovals(actor) && branch.settings?.approvals?.branchClosureApproval !== false) {
    return { error: "Branch closure requires System Owner approval" };
  }
  const previous = branch.status || (branch.active === false ? "Inactive" : "Active");
  branch.status = status;
  branch.active = !["Inactive", "Suspended", "Closed"].includes(status);
  appendBranchActivity(branch, { action: "Status changed", detail: `${previous} → ${status}`, userId: actor?.id || "", uid });
  return { branch };
}

export function searchBranches(branches = [], query = "") {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return branches;
  return branches.filter((branch) => [
    branch.name,
    branch.code,
    branch.region,
    branch.town,
    branch.phone,
    branch.email
  ].some((value) => String(value || "").toLowerCase().includes(term)));
}

export function locationIdsForBranch(branch, groups = []) {
  const ids = new Set();
  if (branch?.locationGroupId) ids.add(branch.locationGroupId);
  (groups || []).forEach((group) => {
    if (group.branchId === branch.id || group.id === branch.locationGroupId) ids.add(group.id);
  });
  return ids;
}

export function staffForBranch(users = [], branch, groups = [], actor = null) {
  const locationIds = locationIdsForBranch(branch, groups);
  const scoped = users.filter((user) =>
    user.branchId === branch.id
    || locationIds.has(user.groupId)
    || [
      branch.managerId,
      branch.assistantManagerId,
      branch.supervisorId,
      branch.accountantId,
      branch.cashierId
    ].includes(user.id)
  );
  const visible = actor ? listUsersForActor(scoped, actor) : scoped.filter((user) => !isSystemDeveloperAccount(user));
  return visible;
}

export function appendBranchActivity(branch, { action, detail = "", userId = "", uid }) {
  branch.activityLog = branch.activityLog || [];
  branch.activityLog.unshift({
    id: typeof uid === "function" ? uid("bact") : `bact-${Date.now()}`,
    action,
    detail,
    userId,
    at: new Date().toISOString()
  });
  branch.activityLog = branch.activityLog.slice(0, 80);
  return branch;
}

export function branchDashboard(branch, state = {}, { date = "" } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const weekStart = shiftDays(day, -6);
  const locationIds = locationIdsForBranch(branch, state.groups || []);
  const inBranch = (item) => locationIds.has(item.groupId) || item.branchId === branch.id;
  const customers = (state.customers || []).filter(inBranch);
  const agents = staffForBranch(state.users || [], branch, state.groups || []).filter((user) => user.role === "Collector");
  const groups = (state.susuGroups || []).filter((item) => item.branchId === branch.id || locationIds.has(item.branchId));
  const collections = (state.collections || []).filter((item) => !item.reversed && inBranch(item));
  const loans = (state.loans || []).filter((item) => inBranch(item) || customers.some((customer) => customer.id === item.customerId));
  const withdrawals = (state.transactions || []).filter((item) => item.type === "Withdrawal" && !item.reversed && inBranch(item));
  const expenses = (state.expenses || []).filter((item) => item.status !== "Void" && (item.branchId === branch.id || locationIds.has(item.groupId)));
  const sum = (rows, key = "amount") => rows.reduce((total, item) => total + Number(item[key] || 0), 0);
  const todayCols = collections.filter((item) => item.date === day);
  const weekCols = collections.filter((item) => item.date >= weekStart);
  const monthCols = collections.filter((item) => String(item.date || "").startsWith(month));
  const outstanding = loans
    .filter((loan) => !["Completed", "Settled", "Rejected"].includes(loan.status))
    .reduce((total, loan) => total + Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0)), 0);
  const recovered = loans.reduce((total, loan) => total + Number(loan.amountPaid || 0), 0);
  const due = loans.reduce((total, loan) => total + Number(loan.totalDue || 0), 0);
  const monthExpenses = expenses.filter((item) => String(item.date || "").startsWith(month));
  const income = sum(monthCols);
  const expenseTotal = sum(monthExpenses);
  const cash = todayCols.filter((item) => (item.paymentMethod || "Cash") === "Cash");
  const momo = todayCols.filter((item) => /momo|mobile/i.test(item.paymentMethod || ""));
  const bank = todayCols.filter((item) => /bank/i.test(item.paymentMethod || ""));
  const handed = (state.handovers || [])
    .filter((item) => item.date === day && locationIds.has(item.groupId))
    .reduce((total, item) => total + Number(item.declaredCash || item.countedCash || 0), 0);
  const pendingApprovals = [
    ...(state.withdrawalRequests || []).filter((item) => item.status === "Pending" && inBranch(item)),
    ...(state.expenses || []).filter((item) => item.status === "Pending" && (item.branchId === branch.id || locationIds.has(item.groupId))),
    ...(state.loans || []).filter((item) => item.status === "Pending" && inBranch(item))
  ].length;
  const targets = { ...defaultBranchTargets(), ...(branch.targets || {}) };
  const newThisMonth = customers.filter((item) => String(item.createdAt || "").startsWith(month)).length;
  return {
    customers: customers.length,
    activeCustomers: customers.filter((item) => item.active !== false && item.memberStatus !== "Suspended").length,
    agents: agents.length,
    activeAgents: agents.filter((item) => item.active !== false).length,
    groups: groups.length,
    todayCollections: +sum(todayCols).toFixed(2),
    weeklyCollections: +sum(weekCols).toFixed(2),
    monthlyCollections: +income.toFixed(2),
    outstandingLoans: +outstanding.toFixed(2),
    loanRecoveryRate: due ? Math.round((recovered / due) * 100) : 0,
    withdrawals: +sum(withdrawals.filter((item) => String(item.date || "").startsWith(month))).toFixed(2),
    expenses: +expenseTotal.toFixed(2),
    profit: +(income - expenseTotal).toFixed(2),
    pendingApprovals,
    todayIncome: +sum(todayCols).toFixed(2),
    todayExpenses: +sum(expenses.filter((item) => item.date === day)).toFixed(2),
    todayWithdrawals: +sum(withdrawals.filter((item) => item.date === day)).toFixed(2),
    cashOnHand: +Math.max(0, sum(cash) - handed).toFixed(2),
    momoBalance: +sum(momo).toFixed(2),
    bankBalance: +sum(bank).toFixed(2),
    netPosition: +(sum(todayCols) - sum(expenses.filter((item) => item.date === day)) - sum(withdrawals.filter((item) => item.date === day))).toFixed(2),
    targets,
    progress: {
      collection: targets.monthlyCollection ? Math.min(100, Math.round((income / targets.monthlyCollection) * 100)) : (income > 0 ? 100 : 0),
      recovery: targets.loanRecovery ? Math.min(100, Math.round((recovered / targets.loanRecovery) * 100)) : 0,
      acquisition: targets.customerAcquisition ? Math.min(100, Math.round((newThisMonth / targets.customerAcquisition) * 100)) : 0,
      expenses: targets.expenseLimit ? Math.min(100, Math.round((expenseTotal / targets.expenseLimit) * 100)) : 0
    },
    newThisMonth,
    cashExpected: +sum(cash).toFixed(2),
    cashHanded: +handed.toFixed(2)
  };
}

export function branchRankings(branches = [], state = {}, { date = "" } = {}) {
  return branches
    .filter((branch) => branch.status !== "Closed")
    .map((branch) => {
      const dash = branchDashboard(branch, state, { date });
      return { id: branch.id, name: branch.name, collected: dash.todayCollections, monthly: dash.monthlyCollections, customers: dash.customers };
    })
    .sort((a, b) => b.monthly - a.monthly)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function setBranchTargets(branch, targets = {}) {
  branch.targets = { ...defaultBranchTargets(), ...(branch.targets || {}), ...targets };
  Object.keys(branch.targets).forEach((key) => {
    branch.targets[key] = Number(branch.targets[key] || 0);
  });
  return branch;
}

export function createBranchTransfer(state, data, uid) {
  if (!TRANSFER_KINDS.includes(data.kind)) return { error: "Invalid transfer type" };
  if (!data.toBranchId) return { error: "Choose a destination branch" };
  if (!data.fromBranchId) data.fromBranchId = "unassigned";
  if (data.fromBranchId === data.toBranchId) return { error: "Destination must be a different branch" };
  if (!String(data.reason || "").trim()) return { error: "A reason is required" };
  const row = {
    id: uid("btr"),
    kind: data.kind,
    entityId: data.entityId || "",
    fromBranchId: data.fromBranchId,
    toBranchId: data.toBranchId,
    amount: Number(data.amount || 0),
    reason: String(data.reason || "").trim(),
    status: data.kind === "cash" ? "Pending" : "Applied",
    requestedBy: data.requestedBy || "",
    createdAt: new Date().toISOString()
  };
  state.branchTransfers = state.branchTransfers || [];
  state.branchTransfers.push(row);
  return { transfer: row };
}

export function applyEntityTransfer(state, transfer, { uid, logAudit, approvedBy }) {
  const from = (state.branches || []).find((item) => item.id === transfer.fromBranchId);
  const to = (state.branches || []).find((item) => item.id === transfer.toBranchId);
  if (!to) return { error: "Destination branch not found" };
  const toLocation = to.locationGroupId || (state.groups || []).find((group) => group.branchId === to.id)?.id || "";
  if (transfer.kind === "customer") {
    const customer = (state.customers || []).find((item) => item.id === transfer.entityId);
    if (!customer) return { error: "Customer not found" };
    customer.groupId = toLocation || customer.groupId;
    customer.branchId = to.id;
    customer.updatedAt = new Date().toISOString();
  } else if (transfer.kind === "agent" || transfer.kind === "staff") {
    const user = (state.users || []).find((item) => item.id === transfer.entityId);
    if (!user) return { error: "Staff not found" };
    if (user.role === "Collector") {
      const moved = transferAgentBranch(state, user, toLocation || user.groupId, {
        reason: transfer.reason,
        approvedBy,
        uid,
        logAudit
      });
      if (moved.error && moved.error !== "Agent is already on this branch") return moved;
    }
    user.groupId = toLocation || user.groupId;
    user.branchId = to.id;
  } else if (transfer.kind === "group") {
    const group = (state.susuGroups || []).find((item) => item.id === transfer.entityId);
    if (!group) return { error: "Group not found" };
    group.branchId = to.id;
    group.updatedAt = new Date().toISOString();
  } else if (transfer.kind === "cash") {
    transfer.status = "Approved";
    transfer.approvedBy = approvedBy || "";
    transfer.approvedAt = new Date().toISOString();
  }
  transfer.status = transfer.status === "Pending" && transfer.kind !== "cash" ? "Applied" : transfer.status;
  if (from) appendBranchActivity(from, { action: "Transfer out", detail: `${transfer.kind} → ${to.name}`, userId: approvedBy || "", uid });
  appendBranchActivity(to, { action: "Transfer in", detail: `${transfer.kind} from ${from?.name || "unassigned"}`, userId: approvedBy || "", uid });
  return { transfer };
}

export function bulkTransferCustomers(state, customerIds, toBranchId, { reason, requestedBy, uid, logAudit }) {
  const to = (state.branches || []).find((item) => item.id === toBranchId);
  if (!to) return { error: "Destination branch not found" };
  const results = [];
  (customerIds || []).forEach((id) => {
    const customer = (state.customers || []).find((item) => item.id === id);
    if (!customer) return;
    const created = createBranchTransfer(state, {
      kind: "customer",
      entityId: id,
      fromBranchId: customer.branchId || (state.branches || []).find((item) => item.locationGroupId === customer.groupId)?.id || "",
      toBranchId,
      reason,
      requestedBy
    }, uid);
    if (created.transfer) applyEntityTransfer(state, created.transfer, { uid, logAudit, approvedBy: requestedBy });
    results.push({ id, ok: !created.error, error: created.error || "" });
  });
  return { results };
}

export function publishAnnouncement(state, data, uid) {
  const title = String(data.title || "").trim();
  if (!title) return { error: "Announcement title is required" };
  const row = {
    id: uid("ann"),
    branchId: data.branchId || "",
    type: ANNOUNCEMENT_TYPES.includes(data.type) ? data.type : "Policy Change",
    title,
    body: String(data.body || "").trim(),
    createdBy: data.createdBy || "",
    createdAt: new Date().toISOString(),
    acknowledgements: []
  };
  state.branchAnnouncements = state.branchAnnouncements || [];
  state.branchAnnouncements.push(row);
  return { announcement: row };
}

export function acknowledgeAnnouncement(announcement, userId) {
  announcement.acknowledgements = announcement.acknowledgements || [];
  if (!announcement.acknowledgements.some((item) => item.userId === userId)) {
    announcement.acknowledgements.push({ userId, at: new Date().toISOString() });
  }
  return announcement;
}

export function addCalendarEvent(state, data, uid) {
  if (!data.date || !String(data.title || "").trim()) return { error: "Date and title are required" };
  const row = {
    id: uid("cal"),
    branchId: data.branchId || "",
    type: CALENDAR_TYPES.includes(data.type) ? data.type : "Internal Event",
    title: String(data.title || "").trim(),
    date: data.date,
    createdAt: new Date().toISOString()
  };
  state.branchCalendar = state.branchCalendar || [];
  state.branchCalendar.push(row);
  return { event: row };
}

export function addBranchDocument(branch, data, uid) {
  branch.documents = branch.documents || [];
  const doc = {
    id: uid("bdoc"),
    type: BRANCH_DOC_TYPES.includes(data.type) ? data.type : "Inspection Report",
    reference: String(data.reference || "").trim(),
    fileName: String(data.fileName || "").trim(),
    dataUrl: data.dataUrl || "",
    version: (branch.documents.filter((item) => item.type === data.type).length || 0) + 1,
    uploadedAt: new Date().toISOString()
  };
  branch.documents.push(doc);
  return { document: doc };
}

export function exportBranchRows(branches = [], state = {}) {
  return branches.map((branch) => {
    const dash = branchDashboard(branch, state);
    return {
      code: branch.code || "",
      name: branch.name || "",
      type: branch.branchType || "",
      status: branch.status || "Active",
      region: branch.region || "",
      customers: dash.customers,
      agents: dash.agents,
      monthly: dash.monthlyCollections,
      profit: dash.profit,
      recovery: dash.loanRecoveryRate
    };
  });
}

function shiftDays(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export { upsertBranch, nextBranchCode, filterBranchesForUser, branchPerformance, reassignCustomer, reassignSusuGroup };
