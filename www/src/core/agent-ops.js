/**
 * Agent operations: extended profile, routes, attendance, commissions,
 * wallet, leave, visit logs, documents, and performance KPIs.
 * Agents remain users (Collector / FieldSupervisor / GroupCoordinator).
 */
import { staffAgents, computeAgentCommission, nextAgentCode, capabilitiesFromAuthority } from "./agents.js";
import { createAssignment, reassignCustomer, reassignSusuGroup } from "./collector-assignments.js";
import { pendingQueueItems } from "../sync/offline-queue.js";

export const AGENT_STATUSES = ["Active", "On Leave", "Suspended", "Resigned", "Terminated", "Probation"];
export const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Casual", "Intern"];
export const ID_TYPES = ["Ghana Card", "Passport", "Driver's License", "Voter ID"];
export const JOB_TITLES = ["Field Collector", "Senior Collector", "Group Collector", "Field Supervisor", "Route Lead"];
export const LEAVE_TYPES = ["Annual Leave", "Medical Leave", "Emergency Leave", "Casual Leave"];
export const VISIT_PURPOSES = ["Collection", "Follow-up", "Onboarding", "Loan discussion", "Complaint", "Verification"];
export const VISIT_OUTCOMES = ["Paid", "Missed", "Promised", "Not at home", "Refused", "Closed"];
export const AGENT_DOC_TYPES = ["Employment Contract", "Appointment Letter", "National ID", "Certificate", "Passport Photo", "Bank Details", "Emergency Contact"];
export const EXPENSE_FIELD_CATEGORIES = ["Fuel", "Transport", "Meals", "Stationery", "Repairs", "Communication", "Other"];
export const ATTENDANCE_STATUSES = ["Present", "Late", "Absent", "Leave"];

export const PRODUCT_PERMISSIONS = [
  ["dailySavings", "Daily Savings"],
  ["weeklySavings", "Weekly Savings"],
  ["monthlySavings", "Monthly Savings"],
  ["fixedSavings", "Fixed Savings"],
  ["targetSavings", "Target Savings"],
  ["childSavings", "Child Savings"],
  ["businessSavings", "Business Savings"],
  ["groupContributions", "Group Contributions"],
  ["groupLoanRepayments", "Group Loan Repayments"],
  ["individualLoanRepayments", "Individual Loan Repayments"]
];

export function defaultProductPermissions() {
  return Object.fromEntries(PRODUCT_PERMISSIONS.map(([key]) => [key, true]));
}

export function canManageAgents(actor) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "FieldSupervisor"].includes(actor?.role);
}

export function canApproveAgentLeave(actor) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "FieldSupervisor"].includes(actor?.role);
}

export function canApproveAgentExpense(actor) {
  return ["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "Accountant"].includes(actor?.role);
}

export function applyAgentOps(user, data = {}) {
  user.employeeNumber = String(data.employeeNumber || user.employeeNumber || user.agentCode || "").trim();
  user.gender = String(data.gender || user.gender || "").trim();
  user.dateOfBirth = data.dateOfBirth || user.dateOfBirth || "";
  user.nationality = String(data.nationality || user.nationality || "Ghanaian").trim();
  user.maritalStatus = String(data.maritalStatus || user.maritalStatus || "").trim();
  user.whatsapp = String(data.whatsapp || user.whatsapp || data.phone || user.phone || "").trim();
  user.email = String(data.email || user.email || "").trim();
  user.phoneSecondary = String(data.phoneSecondary || user.phoneSecondary || "").trim();
  user.gpsAddress = String(data.gpsAddress || user.gpsAddress || "").trim();
  user.region = String(data.region || user.region || "").trim();
  user.district = String(data.district || user.district || "").trim();
  user.town = String(data.town || user.town || "").trim();
  user.idType = ID_TYPES.includes(data.idType) ? data.idType : (user.idType || "Ghana Card");
  user.idNumber = String(data.idNumber || data.ghanaCard || user.idNumber || user.ghanaCard || "").trim();
  user.idExpiry = data.idExpiry || user.idExpiry || "";
  user.idFrontImage = data.idFrontImage || user.idFrontImage || "";
  user.idBackImage = data.idBackImage || user.idBackImage || "";
  user.dateEmployed = data.dateEmployed || user.dateEmployed || (user.createdAt || "").slice(0, 10);
  user.supervisorId = data.supervisorId || user.supervisorId || "";
  user.jobTitle = String(data.jobTitle || user.jobTitle || "Field Collector").trim();
  user.employmentType = EMPLOYMENT_TYPES.includes(data.employmentType) ? data.employmentType : (user.employmentType || "Permanent");
  if (AGENT_STATUSES.includes(data.employmentStatus)) {
    user.employmentStatus = data.employmentStatus;
    user.active = !["Suspended", "Resigned", "Terminated"].includes(data.employmentStatus);
  }
  user.productPermissions = {
    ...defaultProductPermissions(),
    ...(user.productPermissions || {}),
    ...(data.productPermissions || {})
  };
  user.gpsEnabled = data.gpsEnabled === true || data.gpsEnabled === "on" || user.gpsEnabled === true;
  user.notes = Array.isArray(data.notes) ? data.notes : (user.notes || []);
  user.documents = Array.isArray(data.documents) ? data.documents : (user.documents || []);
  user.activityLog = Array.isArray(data.activityLog) ? data.activityLog : (user.activityLog || []);
  if (!user.agentCode) user.agentCode = data.agentCode || nextAgentCode([user]);
  if (!user.employeeNumber) user.employeeNumber = user.agentCode;
  user.updatedAt = new Date().toISOString();
  return user;
}

export function productPermissionFromForm(data = {}) {
  const hasKeys = PRODUCT_PERMISSIONS.some(([key]) => data[`perm_${key}`] !== undefined);
  if (!hasKeys && data.productPermissions) {
    return { ...defaultProductPermissions(), ...data.productPermissions };
  }
  if (!hasKeys) return defaultProductPermissions();
  const perms = defaultProductPermissions();
  PRODUCT_PERMISSIONS.forEach(([key]) => {
    perms[key] = data[`perm_${key}`] === "on" || data[`perm_${key}`] === true || data[`perm_${key}`] === "true";
  });
  return perms;
}

export function agentCanCollectProduct(user, product = {}, { isGroup = false, isLoan = false, isGroupLoan = false } = {}) {
  const perms = { ...defaultProductPermissions(), ...(user?.productPermissions || {}) };
  if (isGroupLoan) return perms.groupLoanRepayments !== false;
  if (isLoan) return perms.individualLoanRepayments !== false;
  if (isGroup) return perms.groupContributions !== false;
  const hay = `${product.frequency || ""} ${product.name || ""} ${product.code || ""}`.toLowerCase();
  if (hay.includes("week")) return perms.weeklySavings !== false;
  if (hay.includes("month")) return perms.monthlySavings !== false;
  if (hay.includes("fixed")) return perms.fixedSavings !== false;
  if (hay.includes("target")) return perms.targetSavings !== false;
  if (hay.includes("child") || hay.includes("educat")) return perms.childSavings !== false;
  if (hay.includes("business")) return perms.businessSavings !== false;
  return perms.dailySavings !== false;
}

export function findDuplicateAgents(users = [], data = {}, excludeId = "") {
  const phone = String(data.phone || "").replace(/\D/g, "").slice(-9);
  const email = String(data.email || "").trim().toLowerCase();
  const idNumber = String(data.idNumber || data.ghanaCard || "").trim().toLowerCase();
  const username = String(data.username || "").trim().toLowerCase();
  const employeeNumber = String(data.employeeNumber || data.agentCode || "").trim().toLowerCase();
  return staffAgents(users).filter((user) => {
    if (!user || user.id === excludeId) return false;
    const samePhone = phone && String(user.phone || "").replace(/\D/g, "").slice(-9) === phone;
    const sameEmail = email && String(user.email || "").trim().toLowerCase() === email;
    const sameId = idNumber && String(user.idNumber || user.ghanaCard || "").trim().toLowerCase() === idNumber;
    const sameUser = username && String(user.username || "").toLowerCase() === username;
    const sameEmp = employeeNumber && String(user.employeeNumber || user.agentCode || "").toLowerCase() === employeeNumber;
    return samePhone || sameEmail || sameId || sameUser || sameEmp;
  });
}

export function searchAgents(users = [], query = "", extras = {}) {
  const term = String(query || "").trim().toLowerCase();
  const agents = staffAgents(users);
  if (!term) return agents;
  const { branchName = () => "" } = extras;
  return agents.filter((user) => [
    user.name,
    user.username,
    user.agentCode,
    user.employeeNumber,
    user.phone,
    user.email,
    user.ghanaCard,
    user.idNumber,
    branchName(user)
  ].some((value) => String(value || "").toLowerCase().includes(term)));
}

export function appendAgentActivity(user, { action, detail = "", userId = "", uid }) {
  user.activityLog = user.activityLog || [];
  user.activityLog.unshift({
    id: typeof uid === "function" ? uid("aact") : `aact-${Date.now()}`,
    action,
    detail,
    userId,
    at: new Date().toISOString()
  });
  user.activityLog = user.activityLog.slice(0, 80);
  return user;
}

export function setAgentStatus(user, status, actor, uid) {
  if (!AGENT_STATUSES.includes(status)) return { error: "Invalid employment status" };
  if (!canManageAgents(actor) && actor?.id !== user.id) return { error: "You cannot change agent status" };
  const previous = user.employmentStatus || (user.active === false ? "Suspended" : "Active");
  user.employmentStatus = status;
  user.active = !["Suspended", "Resigned", "Terminated"].includes(status);
  appendAgentActivity(user, { action: "Status changed", detail: `${previous} → ${status}`, userId: actor?.id || "", uid });
  return { user };
}

export function transferAgentBranch(state, user, branchId, { reason, approvedBy, uid, logAudit }) {
  if (!branchId) return { error: "Choose a branch" };
  if (user.groupId === branchId) return { error: "Agent is already on this branch" };
  const from = user.groupId || user.branchId || "";
  const result = createAssignment(state, {
    kind: "route",
    entityId: user.id,
    fromCollectorId: from,
    toCollectorId: branchId,
    reason: reason || "Branch transfer",
    approvedBy,
    uid
  });
  if (result.error) return result;
  user.groupId = branchId;
  user.branchId = branchId;
  user.updatedAt = new Date().toISOString();
  appendAgentActivity(user, { action: "Transferred branch", detail: reason || branchId, userId: approvedBy || "", uid });
  if (logAudit) logAudit("Agent transferred", `${user.name} → ${branchId}`);
  return { user, assignment: result.assignment };
}

export function bulkAssignCustomers(state, customerIds, toCollectorId, { reason, approvedBy, uid, logAudit }) {
  const results = [];
  (customerIds || []).forEach((id) => {
    const customer = (state.customers || []).find((item) => item.id === id);
    if (!customer) return;
    const result = reassignCustomer(state, customer, toCollectorId, { reason, approvedBy, uid, logAudit });
    results.push({ id, ok: !result.error, error: result.error || "" });
  });
  return results;
}

export function upsertRoute(state, data, uid) {
  state.agentRoutes = state.agentRoutes || [];
  const payload = {
    code: String(data.code || "").trim().toUpperCase(),
    name: String(data.name || "").trim(),
    area: String(data.area || "").trim(),
    communities: String(data.communities || "").trim(),
    distanceKm: Number(data.distanceKm || 0),
    estimatedCustomers: Number(data.estimatedCustomers || 0),
    estimatedMinutes: Number(data.estimatedMinutes || 0),
    agentId: data.agentId || "",
    branchId: data.branchId || "",
    active: data.active !== false,
    updatedAt: new Date().toISOString()
  };
  if (!payload.code || !payload.name) return { error: "Route code and name are required" };
  if (data.id) {
    const existing = state.agentRoutes.find((item) => item.id === data.id);
    if (!existing) return { error: "Route not found" };
    Object.assign(existing, payload);
    return { route: existing };
  }
  if (state.agentRoutes.some((item) => item.code === payload.code && item.active !== false)) {
    return { error: "A route with this code already exists" };
  }
  const route = { id: uid("rte"), createdAt: new Date().toISOString(), ...payload };
  state.agentRoutes.push(route);
  return { route };
}

export function clockIn(state, agent, { date, gps = "", uid, lateAfterHour = 8 }) {
  state.agentAttendance = state.agentAttendance || [];
  const day = date || new Date().toISOString().slice(0, 10);
  const existing = state.agentAttendance.find((item) => item.agentId === agent.id && item.date === day && !item.clockOutAt);
  if (existing) return { error: "Already clocked in", attendance: existing };
  const now = new Date();
  const late = now.getHours() > Number(lateAfterHour);
  const row = {
    id: uid("att"),
    agentId: agent.id,
    branchId: agent.groupId || agent.branchId || "",
    date: day,
    clockInAt: now.toISOString(),
    clockOutAt: "",
    gps,
    status: late ? "Late" : "Present",
    hours: 0,
    createdAt: now.toISOString()
  };
  state.agentAttendance.push(row);
  appendAgentActivity(agent, { action: "Clocked in", detail: row.status, userId: agent.id, uid });
  return { attendance: row };
}

export function clockOut(state, agent, { date, uid }) {
  const day = date || new Date().toISOString().slice(0, 10);
  const row = (state.agentAttendance || []).find((item) => item.agentId === agent.id && item.date === day && !item.clockOutAt);
  if (!row) return { error: "No open clock-in for today" };
  row.clockOutAt = new Date().toISOString();
  row.hours = +((Date.parse(row.clockOutAt) - Date.parse(row.clockInAt)) / 36e5).toFixed(2);
  appendAgentActivity(agent, { action: "Clocked out", detail: `${row.hours}h`, userId: agent.id, uid });
  return { attendance: row };
}

export function markAttendance(state, agent, { date, status, uid, actorId = "" }) {
  if (!ATTENDANCE_STATUSES.includes(status)) return { error: "Invalid attendance status" };
  state.agentAttendance = state.agentAttendance || [];
  const day = date || new Date().toISOString().slice(0, 10);
  let row = state.agentAttendance.find((item) => item.agentId === agent.id && item.date === day);
  if (!row) {
    row = {
      id: uid("att"),
      agentId: agent.id,
      branchId: agent.groupId || "",
      date: day,
      clockInAt: "",
      clockOutAt: "",
      gps: "",
      hours: 0,
      createdAt: new Date().toISOString()
    };
    state.agentAttendance.push(row);
  }
  row.status = status;
  appendAgentActivity(agent, { action: "Attendance marked", detail: `${day} ${status}`, userId: actorId, uid });
  return { attendance: row };
}

export function attendanceRate(rows = [], days = 22) {
  if (!rows.length) return 0;
  const present = rows.filter((item) => item.status === "Present" || item.status === "Late").length;
  return Math.round((present / Math.max(days, rows.length)) * 100);
}

export function calculateCommission(user, collectedAmount, extras = {}) {
  const amount = Number(collectedAmount || 0);
  const type = extras.method || user?.commissionType || "None";
  if (!user || type === "None" || amount <= 0) return 0;
  if (type === "Fixed Amount" || type === "Flat per collection") return Number(user.commissionRate || extras.fixed || 0);
  if (type === "Percentage" || type === "Percentage of Collection" || type === "Salary plus commission") {
    return +(amount * Number(user.commissionRate || 0) / 100).toFixed(2);
  }
  if (type === "Tiered Commission") {
    const tiers = extras.tiers || user.commissionTiers || [
      { min: 0, rate: Number(user.commissionRate || 0) },
      { min: 500, rate: Number(user.commissionRate || 0) + 0.5 },
      { min: 2000, rate: Number(user.commissionRate || 0) + 1 }
    ];
    const tier = [...tiers].sort((a, b) => a.min - b.min).reverse().find((item) => amount >= item.min) || tiers[0];
    return +(amount * Number(tier?.rate || 0) / 100).toFixed(2);
  }
  if (type === "Monthly Bonus" || type === "Performance Bonus") {
    const bonus = Number(user.bonusAmount || extras.bonus || 0);
    return +(computeAgentCommission(user, amount) + bonus).toFixed(2);
  }
  return computeAgentCommission(user, amount);
}

export function agentWallet(state, agentId, { date = "" } = {}) {
  const collections = (state.collections || []).filter((item) =>
    (item.userId === agentId || item.collectorId === agentId) && !item.reversed && (!date || item.date === date)
  );
  const collected = collections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cash = collections.filter((item) => (item.paymentMethod || "Cash") === "Cash").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const handed = (state.handovers || [])
    .filter((item) => item.collectorId === agentId && (!date || item.date === date) && item.status !== "Rejected")
    .reduce((sum, item) => sum + Number(item.declaredCash || item.countedCash || 0), 0);
  const expenses = (state.expenses || [])
    .filter((item) => item.recordedBy === agentId && item.status !== "Void" && item.status !== "Rejected" && (!date || item.date === date))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const user = (state.users || []).find((item) => item.id === agentId);
  const commission = calculateCommission(user, collected);
  return {
    collected: +collected.toFixed(2),
    cashOnHand: +Math.max(0, cash - handed).toFixed(2),
    handed: +handed.toFixed(2),
    expenses: +expenses.toFixed(2),
    commission: +commission.toFixed(2),
    balance: +(cash - handed - expenses).toFixed(2)
  };
}

export function requestLeave(state, agent, data, uid) {
  const days = Number(data.days || 0);
  if (!LEAVE_TYPES.includes(data.type)) return { error: "Choose a leave type" };
  if (days <= 0) return { error: "Leave days must be greater than zero" };
  state.agentLeave = state.agentLeave || [];
  const row = {
    id: uid("leave"),
    agentId: agent.id,
    type: data.type,
    days,
    from: data.from || "",
    to: data.to || "",
    reason: String(data.reason || "").trim(),
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  state.agentLeave.push(row);
  appendAgentActivity(agent, { action: "Leave requested", detail: `${data.type} · ${days}d`, userId: agent.id, uid });
  return { leave: row };
}

export function decideLeave(state, leaveId, actor, approved, uid) {
  if (!canApproveAgentLeave(actor)) return { error: "You cannot approve leave" };
  const leave = (state.agentLeave || []).find((item) => item.id === leaveId);
  if (!leave) return { error: "Leave request not found" };
  leave.status = approved ? "Approved" : "Rejected";
  leave.decidedBy = actor.id;
  leave.decidedAt = new Date().toISOString();
  const agent = (state.users || []).find((item) => item.id === leave.agentId);
  if (agent && approved) {
    agent.leaveBalance = Math.max(0, Number(agent.leaveBalance ?? 21) - Number(leave.days || 0));
    if (leave.from && leave.to) setAgentStatus(agent, "On Leave", actor, uid);
  }
  return { leave };
}

export function leaveBalance(agent, leaveRows = []) {
  const used = leaveRows
    .filter((item) => item.agentId === agent.id && item.status === "Approved")
    .reduce((sum, item) => sum + Number(item.days || 0), 0);
  const allowance = Number(agent.leaveBalance ?? 21);
  return { allowance: allowance + used, used, remaining: allowance };
}

export function logVisit(state, data, uid) {
  if (!data.customerId || !data.agentId) return { error: "Customer and agent are required" };
  state.agentVisits = state.agentVisits || [];
  const visit = {
    id: uid("vis"),
    customerId: data.customerId,
    agentId: data.agentId,
    date: data.date || new Date().toISOString().slice(0, 10),
    time: data.time || new Date().toISOString().slice(11, 16),
    purpose: VISIT_PURPOSES.includes(data.purpose) ? data.purpose : "Collection",
    outcome: VISIT_OUTCOMES.includes(data.outcome) ? data.outcome : "Paid",
    notes: String(data.notes || "").trim(),
    gps: data.gps || "",
    photo: data.photo || "",
    createdAt: new Date().toISOString()
  };
  state.agentVisits.push(visit);
  return { visit };
}

export function addAgentNote(user, data, uid) {
  user.notes = user.notes || [];
  const body = String(data.body || "").trim();
  if (!body) return { error: "Note text is required" };
  const note = {
    id: uid("anote"),
    body,
    userId: data.userId || "",
    userName: data.userName || "",
    createdAt: new Date().toISOString()
  };
  user.notes.unshift(note);
  appendAgentActivity(user, { action: "Note added", detail: body.slice(0, 40), userId: note.userId, uid });
  return { note };
}

export function addAgentDocument(user, data, uid) {
  user.documents = user.documents || [];
  const doc = {
    id: uid("adoc"),
    type: AGENT_DOC_TYPES.includes(data.type) ? data.type : "National ID",
    reference: String(data.reference || "").trim(),
    fileName: String(data.fileName || "").trim(),
    dataUrl: data.dataUrl || "",
    uploadedAt: new Date().toISOString()
  };
  user.documents.push(doc);
  return { document: doc };
}

export function dailyCollectionSummary(state, agentId, date) {
  const day = date || new Date().toISOString().slice(0, 10);
  const visits = (state.agentVisits || []).filter((item) => item.agentId === agentId && item.date === day);
  const collections = (state.collections || []).filter((item) =>
    (item.userId === agentId || item.collectorId === agentId) && item.date === day && !item.reversed
  );
  const successful = collections.filter((item) => Number(item.amount || 0) > 0).length;
  const attendance = (state.agentAttendance || []).find((item) => item.agentId === agentId && item.date === day);
  const wallet = agentWallet(state, agentId, { date: day });
  const expenses = (state.expenses || []).filter((item) => item.recordedBy === agentId && item.date === day && item.status !== "Void");
  return {
    date: day,
    customersVisited: visits.length || collections.length,
    successful,
    missed: visits.filter((item) => item.outcome === "Missed" || item.outcome === "Not at home").length,
    amount: wallet.collected,
    expenses: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    hours: attendance?.hours || 0,
    cashHeld: wallet.cashOnHand,
    distanceKm: Number((state.agentRoutes || []).find((item) => item.agentId === agentId)?.distanceKm || 0)
  };
}

export function agentKpis(user, state, { from = "", to = "", date = "" } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const mine = (state.collections || []).filter((item) =>
    (item.userId === user.id || item.collectorId === user.id) && !item.reversed
  );
  const inRange = (item) => (!from || item.date >= from) && (!to || item.date <= to);
  const daily = mine.filter((item) => item.date === day).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const weekly = mine.filter((item) => item.date >= shiftDays(day, -6)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthly = mine.filter((item) => String(item.date || "").startsWith(month)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const assigned = (state.customers || []).filter((item) => item.collectorId === user.id);
  const active = assigned.filter((item) => item.active !== false && item.memberStatus !== "Suspended").length;
  const dormant = assigned.filter((item) => item.dormant || item.memberStatus === "Suspended").length;
  const paidIds = new Set(mine.filter((item) => item.date === day && Number(item.amount || 0) > 0).map((item) => item.customerId));
  const successRate = assigned.length ? Math.round((paidIds.size / assigned.length) * 100) : 0;
  const loans = (state.loans || []).filter((item) => assigned.some((customer) => customer.id === item.customerId));
  const recovered = loans.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const due = loans.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const attendance = (state.agentAttendance || []).filter((item) => item.agentId === user.id && inRange(item));
  return {
    daily: +daily.toFixed(2),
    weekly: +weekly.toFixed(2),
    monthly: +monthly.toFixed(2),
    successRate,
    loanRecoveryRate: due ? Math.round((recovered / due) * 100) : 0,
    retention: assigned.length ? Math.round((active / assigned.length) * 100) : 0,
    attendanceRate: attendanceRate(attendance, attendance.length || 22),
    commission: calculateCommission(user, monthly),
    assigned: assigned.length,
    active,
    dormant,
    groups: (state.susuGroups || []).filter((item) => item.collectorId === user.id).length
  };
}

export function agentRankings(users = [], state = {}, { date = "" } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  return staffAgents(users)
    .filter((user) => user.active !== false)
    .map((user) => {
      const kpis = agentKpis(user, state, { date: day });
      return { id: user.id, name: user.name, branchId: user.groupId, collected: kpis.daily, monthly: kpis.monthly, successRate: kpis.successRate };
    })
    .sort((a, b) => b.collected - a.collected)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function agentDeskModel(user, state, { date = "" } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const kpis = agentKpis(user, state, { date: day });
  const summary = dailyCollectionSummary(state, user.id, day);
  const wallet = agentWallet(state, user.id, { date: day });
  const offline = pendingQueueItems(state).filter((item) =>
    item.payload?.userId === user.id || item.payload?.collectorId === user.id || item.kind === "customer"
  );
  const meetings = (state.groupMeetings || []).filter((item) => {
    const group = (state.susuGroups || []).find((row) => row.id === item.groupId);
    return group?.collectorId === user.id && String(item.date || "") >= day;
  }).slice(0, 5);
  const attendance = (state.agentAttendance || []).find((item) => item.agentId === user.id && item.date === day);
  return {
    kpis,
    summary,
    wallet,
    attendance,
    offlinePending: offline.length,
    meetings,
    loansDue: (state.loans || []).filter((item) => item.collectorId === user.id || (state.customers || []).some((customer) => customer.id === item.customerId && customer.collectorId === user.id && !["Completed", "Settled"].includes(item.status))).length,
    route: (state.agentRoutes || []).find((item) => item.agentId === user.id && item.active !== false) || null
  };
}

export function exportAgentRows(users = [], state = {}, extras = {}) {
  const { branchName = () => "" } = extras;
  return staffAgents(users).map((user) => {
    const kpis = agentKpis(user, state);
    return {
      agentCode: user.agentCode || "",
      employeeNumber: user.employeeNumber || "",
      name: user.name || "",
      phone: user.phone || "",
      branch: branchName(user),
      status: user.employmentStatus || (user.active === false ? "Suspended" : "Active"),
      assigned: kpis.assigned,
      groups: kpis.groups,
      monthly: kpis.monthly,
      commission: kpis.commission,
      attendance: kpis.attendanceRate
    };
  });
}

function shiftDays(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export { capabilitiesFromAuthority, reassignSusuGroup };
