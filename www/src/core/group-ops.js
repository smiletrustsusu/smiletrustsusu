/**
 * Group susu operations: types, members, meetings, welfare, fines,
 * share capital, share-out, and group analytics. Uses existing susuGroups[].
 */
import { toPesewas, fromPesewas, sumPesewas } from "./money.js";
import {
  activeMemberships,
  computeGroupPerformance,
  upsertMembership
} from "./susu-groups.js";
import {
  createGroupMeeting,
  finalizeMeetingTotals,
  recordAttendance,
  recordMeetingLine
} from "./group-meetings.js";
import { computeCyclePayouts } from "./group-distribution.js";
import { COLLECTION_TYPES } from "./savings-products.js";
import { postDoubleEntry } from "./double-entry.js";
import { canAction } from "./rbac.js";

export const GROUP_TYPES = [
  "Daily Group",
  "Weekly Group",
  "Monthly Group",
  "Village Savings & Loans Association (VSLA)",
  "Rotating Savings (ROSCA)",
  "Church Savings Group",
  "Market Traders Association",
  "Farmers Cooperative",
  "Teachers Savings Group",
  "Women's Savings Group",
  "Youth Savings Club",
  "Company Staff Welfare Group",
  "Custom"
];

export const GROUP_STATUSES = ["Active", "Pending", "Suspended", "Closed", "Completed"];
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused", "Guest"];
export const MEETING_STEPS = ["created", "attendance", "contributions", "fines", "loans", "notes", "closed"];
export const CONTRIBUTION_TYPES = [
  "Regular",
  "Special",
  "Emergency",
  "Project",
  "Development Levy",
  "Membership Fee",
  "Late Fee",
  "Registration Fee",
  "Custom"
];
export const WELFARE_TYPES = [
  "Contribution",
  "Funeral Support",
  "Medical Support",
  "Disaster Relief",
  "Emergency Assistance",
  "Withdrawal"
];
export const DEFAULT_FINES = [
  { code: "late", name: "Late Arrival", amount: 5 },
  { code: "absent", name: "Absence", amount: 10 },
  { code: "late_pay", name: "Late Payment", amount: 5 },
  { code: "rule", name: "Rule Violation", amount: 20 },
  { code: "default", name: "Loan Default", amount: 50 },
  { code: "misconduct", name: "Meeting Misconduct", amount: 20 }
];
export const SHARE_TYPES = ["Purchase", "Transfer", "Redemption", "Dividend"];

export function canConductGroupMeetings(user) {
  return canAction(user, "Group.Meeting");
}

export function applyGroupProfile(group, data = {}) {
  Object.assign(group, {
    groupType: data.groupType || group.groupType || "Weekly Group",
    status: data.status || group.status || (group.active === false ? "Suspended" : "Active"),
    supervisorId: data.supervisorId || group.supervisorId || "",
    meetingTime: data.meetingTime || group.meetingTime || "",
    meetingVenue: data.meetingVenue || group.meetingVenue || "",
    collectionFrequency: data.collectionFrequency || group.collectionFrequency || group.contributionFrequency || "Weekly",
    financialYearStart: data.financialYearStart || group.financialYearStart || "",
    financialYearEnd: data.financialYearEnd || group.financialYearEnd || "",
    chairpersonId: data.chairpersonId || group.chairpersonId || "",
    treasurerName: data.treasurerName || group.treasurerName || "",
    viceChairpersonName: data.viceChairpersonName || group.viceChairpersonName || "",
    committeeMembers: data.committeeMembers || group.committeeMembers || "",
    welfarePesewas: Number(group.welfarePesewas || 0),
    shareCapitalPesewas: Number(group.shareCapitalPesewas || 0),
    emergencyPesewas: Number(group.emergencyPesewas || 0),
    fineConfig: group.fineConfig?.length ? group.fineConfig : DEFAULT_FINES.map((item) => ({ ...item })),
    active: data.status ? !["Suspended", "Closed", "Completed"].includes(data.status) : group.active !== false
  });
  return group;
}

export function setGroupStatus(group, status, actor) {
  if (!GROUP_STATUSES.includes(status)) return { error: "Invalid group status" };
  if (status === "Closed" && !canAction(actor, "Group.Delete") && actor?.role !== "SystemOwner") {
    group.status = "Closed";
    group.active = false;
    group.closedAt = new Date().toISOString();
    return { group, soft: true };
  }
  group.status = status;
  group.active = !["Suspended", "Closed", "Completed"].includes(status);
  group.updatedAt = new Date().toISOString();
  return { group };
}

export function setLeadership(state, group, roles, { actorId, uid }) {
  state.groupLeadershipHistory = state.groupLeadershipHistory || [];
  const prev = {
    chairpersonId: group.chairpersonId || "",
    leaderName: group.leaderName || "",
    secretaryName: group.secretaryName || "",
    treasurerName: group.treasurerName || "",
    viceChairpersonName: group.viceChairpersonName || ""
  };
  Object.assign(group, roles, { updatedAt: new Date().toISOString() });
  const row = {
    id: uid("lead"),
    susuGroupId: group.id,
    previous: prev,
    next: {
      chairpersonId: group.chairpersonId || "",
      leaderName: group.leaderName || "",
      secretaryName: group.secretaryName || "",
      treasurerName: group.treasurerName || "",
      viceChairpersonName: group.viceChairpersonName || ""
    },
    changedBy: actorId || "",
    createdAt: new Date().toISOString()
  };
  state.groupLeadershipHistory.push(row);
  return { history: row, group };
}

export function setMemberStatus(group, customerId, status) {
  if (!["Active", "Suspended", "Closed", "Transferred"].includes(status)) return { error: "Invalid member status" };
  const membership = upsertMembership(group, customerId, status === "Transferred" ? "Closed" : status);
  membership.transferStatus = status === "Transferred" ? "Transferred" : "";
  return { membership };
}

export function transferMember(fromGroup, toGroup, customerId) {
  if (!fromGroup || !toGroup) return { error: "Both groups are required" };
  if (fromGroup.id === toGroup.id) return { error: "Choose a different group" };
  setMemberStatus(fromGroup, customerId, "Transferred");
  const membership = upsertMembership(toGroup, customerId, "Active");
  membership.transferredFrom = fromGroup.id;
  return { membership };
}

export function promoteLeader(state, group, { customerId, customerName, role, actorId, uid }) {
  const patch = {};
  if (role === "Chairperson") {
    patch.chairpersonId = customerId;
    patch.leaderName = customerName || "";
  }
  if (role === "Secretary") patch.secretaryName = customerName || "";
  if (role === "Treasurer") patch.treasurerName = customerName || "";
  if (role === "Vice Chairperson") patch.viceChairpersonName = customerName || "";
  return setLeadership(state, group, patch, { actorId, uid });
}

export function searchGroups(groups = [], query = {}) {
  const term = String(query.q || "").trim().toLowerCase();
  return groups.filter((group) => {
    if (query.status && (group.status || (group.active === false ? "Suspended" : "Active")) !== query.status) return false;
    if (query.groupType && group.groupType !== query.groupType) return false;
    if (query.agentId && group.collectorId !== query.agentId) return false;
    if (query.branchId && group.branchId !== query.branchId) return false;
    if (!term) return true;
    const hay = [group.name, group.code, group.leaderName, group.secretaryName, group.groupType, group.status, group.meetingVenue, group.meetingDay].join(" ").toLowerCase();
    return hay.includes(term);
  });
}

export function groupDashboard(group, {
  collections = [],
  customers = [],
  loans = [],
  meetings = [],
  welfare = [],
  fines = [],
  shares = [],
  date = ""
} = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const perf = computeGroupPerformance(group, { collections, customers, date: day });
  const members = group.memberships || [];
  const active = members.filter((item) => item.status === "Active").length;
  const inactive = members.length - active;
  const groupLoans = loans.filter((loan) => loan.susuGroupId === group.id && !["Completed", "Settled", "Rejected"].includes(loan.status));
  const outstanding = groupLoans.reduce((sum, loan) => sum + Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0)), 0);
  const disbursed = loans.filter((loan) => loan.susuGroupId === group.id).reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
  const repaid = loans.filter((loan) => loan.susuGroupId === group.id).reduce((sum, loan) => sum + Number(loan.amountPaid || 0), 0);
  const groupMeetings = meetings.filter((item) => item.susuGroupId === group.id);
  const latest = groupMeetings.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const attendancePct = latest
    ? Math.round((((latest.attendance || []).filter((row) => row.present).length) / Math.max(1, (latest.attendance || []).length)) * 100)
    : 0;
  const welfareIn = welfare.filter((item) => item.susuGroupId === group.id && item.direction !== "out").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const welfareOut = welfare.filter((item) => item.susuGroupId === group.id && item.direction === "out").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const fineTotal = fines.filter((item) => item.susuGroupId === group.id && !item.waived).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const shareTotal = shares.filter((item) => item.susuGroupId === group.id && item.type === "Purchase").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    ...perf,
    totalMembers: members.length,
    activeMembers: active,
    inactiveMembers: inactive,
    outstandingLoans: +outstanding.toFixed(2),
    loanRecoveryRate: disbursed ? Math.round((repaid / disbursed) * 100) : 0,
    fineCollections: +fineTotal.toFixed(2),
    welfareBalance: +(welfareIn - welfareOut).toFixed(2),
    shareCapital: +shareTotal.toFixed(2),
    emergencyFund: fromPesewas(group.emergencyPesewas || 0),
    attendancePercent: attendancePct,
    groupBalance: fromPesewas(group.walletPesewas || 0) + Number(perf.actual || 0)
  };
}

export function memberGroupCard(membership, customer, {
  collections = [],
  loans = [],
  meetings = [],
  fines = [],
  groupId = ""
} = {}) {
  const savings = collections.filter((item) => item.customerId === customer?.id && item.susuGroupId === groupId && !item.reversed)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const loanBalance = loans.filter((loan) => loan.customerId === customer?.id && loan.susuGroupId === groupId && !["Completed", "Settled"].includes(loan.status))
    .reduce((sum, loan) => sum + Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0)), 0);
  const attended = meetings.filter((meeting) => (meeting.attendance || []).some((row) => row.customerId === customer?.id && row.present)).length;
  const meetingCount = meetings.filter((meeting) => (meeting.attendance || []).some((row) => row.customerId === customer?.id)).length;
  const fineBalance = fines.filter((item) => item.customerId === customer?.id && item.susuGroupId === groupId && !item.paid && !item.waived)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    customerId: customer?.id || membership.customerId,
    name: customer?.name || "",
    photo: customer?.passportPhoto || "",
    memberNumber: membership.memberNumber || customer?.customerNumber || "",
    customerNumber: customer?.customerNumber || customer?.accountNo || "",
    status: membership.status || "Active",
    savingsBalance: +savings.toFixed(2),
    loanBalance: +loanBalance.toFixed(2),
    attendancePercent: meetingCount ? Math.round((attended / meetingCount) * 100) : 0,
    fineBalance: +fineBalance.toFixed(2)
  };
}

export function startMeeting(state, group, { date, recordedBy, uid, agenda = "" }) {
  const count = (state.groupMeetings || []).filter((item) => item.susuGroupId === group.id).length + 1;
  return createGroupMeeting(state, {
    susuGroupId: group.id,
    branchId: group.branchId,
    date,
    recordedBy,
    agenda,
    meetingNo: count,
    status: "Open",
    step: "attendance"
  }, uid);
}

export function setMeetingStep(meeting, step) {
  if (!MEETING_STEPS.includes(step)) return { error: "Unknown meeting step" };
  if (meeting.status === "Closed") return { error: "Meeting is already closed" };
  meeting.step = step;
  meeting.updatedAt = new Date().toISOString();
  return { meeting };
}

export function recordFine(state, { group, customerId, amount, reason, meetingId, recordedBy, uid }) {
  const value = Number(amount);
  if (!group) return { error: "Group is required" };
  if (!customerId) return { error: "Member is required" };
  if (!Number.isFinite(value) || value <= 0) return { error: "Fine amount must be greater than zero" };
  state.groupFines = state.groupFines || [];
  const row = {
    id: uid("fine"),
    susuGroupId: group.id,
    customerId,
    amount: value,
    amountPesewas: toPesewas(value),
    reason: reason || "Fine",
    meetingId: meetingId || "",
    recordedBy: recordedBy || "",
    paid: false,
    waived: false,
    createdAt: new Date().toISOString()
  };
  state.groupFines.push(row);
  return { fine: row };
}

export function waiveFine(fine, actor) {
  if (!canAction(actor, "Savings.Adjust") && !canAction(actor, "Group.Edit")) return { error: "You cannot waive this fine" };
  fine.waived = true;
  fine.waivedAt = new Date().toISOString();
  fine.waivedBy = actor?.id || "";
  return { fine };
}

export function recordWelfare(state, { group, customerId, amount, type, direction = "in", reason, meetingId, recordedBy, uid }) {
  const value = Number(amount);
  if (!group) return { error: "Group is required" };
  if (!Number.isFinite(value) || value <= 0) return { error: "Amount must be greater than zero" };
  if (direction === "out" && fromPesewas(group.welfarePesewas || 0) < value) {
    return { error: "Welfare balance is insufficient" };
  }
  state.groupWelfare = state.groupWelfare || [];
  const row = {
    id: uid("wlf"),
    susuGroupId: group.id,
    customerId: customerId || "",
    amount: value,
    amountPesewas: toPesewas(value),
    type: type || "Contribution",
    direction,
    reason: reason || "",
    meetingId: meetingId || "",
    recordedBy: recordedBy || "",
    status: direction === "out" ? "Pending" : "Posted",
    createdAt: new Date().toISOString()
  };
  state.groupWelfare.push(row);
  if (direction === "in") group.welfarePesewas = Number(group.welfarePesewas || 0) + toPesewas(value);
  return { welfare: row };
}

export function approveWelfarePayout(group, welfare, actor) {
  if (!canAction(actor, "Withdrawal.Approve") && !canAction(actor, "Group.Edit")) return { error: "You cannot approve this welfare payout" };
  if (welfare.status !== "Pending") return { error: "Welfare payout is not pending" };
  welfare.status = "Approved";
  welfare.approvedBy = actor?.id || "";
  welfare.approvedAt = new Date().toISOString();
  group.welfarePesewas = Math.max(0, Number(group.welfarePesewas || 0) - toPesewas(welfare.amount));
  return { welfare };
}

export function recordShare(state, { group, customerId, amount, type = "Purchase", counterpartyId = "", recordedBy, uid }) {
  const value = Number(amount);
  if (!SHARE_TYPES.includes(type)) return { error: "Invalid share type" };
  if (!customerId) return { error: "Member is required" };
  if (!Number.isFinite(value) || value <= 0) return { error: "Share amount must be greater than zero" };
  state.groupShares = state.groupShares || [];
  const row = {
    id: uid("shr"),
    susuGroupId: group.id,
    customerId,
    counterpartyId,
    amount: value,
    amountPesewas: toPesewas(value),
    type,
    recordedBy: recordedBy || "",
    createdAt: new Date().toISOString()
  };
  state.groupShares.push(row);
  if (type === "Purchase") group.shareCapitalPesewas = Number(group.shareCapitalPesewas || 0) + toPesewas(value);
  if (type === "Redemption") group.shareCapitalPesewas = Math.max(0, Number(group.shareCapitalPesewas || 0) - toPesewas(value));
  return { share: row };
}

export function memberShareBalance(shares = [], customerId, groupId) {
  return shares.filter((item) => item.customerId === customerId && item.susuGroupId === groupId).reduce((sum, item) => {
    if (item.type === "Purchase" || item.type === "Dividend") return sum + Number(item.amount || 0);
    if (item.type === "Redemption") return sum - Number(item.amount || 0);
    return sum;
  }, 0);
}

export function computeShareOut(group, extras = {}) {
  const cycle = computeCyclePayouts(group, extras);
  const fines = (extras.fines || []).filter((item) => item.susuGroupId === group.id && !item.waived);
  const expenses = Number(extras.expensesTotal || 0);
  const interest = Number(extras.interestEarned || 0);
  const profit = interest - expenses;
  const memberLines = cycle.memberLines.map((line) => {
    const memberFines = fines.filter((item) => item.customerId === line.customerId).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const shares = memberShareBalance(extras.shares || [], line.customerId, group.id);
    const dividend = shares && cycle.totalPesewas ? +(fromPesewas(line.payoutPesewas) * Math.max(0, profit) / Math.max(1, fromPesewas(cycle.totalPesewas))).toFixed(2) : 0;
    const payout = +(fromPesewas(line.payoutPesewas) - memberFines + dividend).toFixed(2);
    return {
      ...line,
      fines: memberFines,
      shares,
      dividend,
      finalPayout: Math.max(0, payout)
    };
  });
  const total = memberLines.reduce((sum, line) => sum + line.finalPayout, 0);
  return {
    memberLines,
    total: +total.toFixed(2),
    interestEarned: interest,
    expenses,
    profit: +profit.toFixed(2)
  };
}

export function createShareOut(state, group, extras, { cycleLabel, createdBy, uid }) {
  const calc = computeShareOut(group, extras);
  state.groupShareOuts = state.groupShareOuts || [];
  const row = {
    id: uid("sout"),
    susuGroupId: group.id,
    cycleLabel: cycleLabel || `${group.code}-${new Date().toISOString().slice(0, 7)}`,
    status: "Pending",
    createdBy: createdBy || "",
    total: calc.total,
    interestEarned: calc.interestEarned,
    expenses: calc.expenses,
    profit: calc.profit,
    memberLines: calc.memberLines,
    createdAt: new Date().toISOString()
  };
  state.groupShareOuts.push(row);
  return { shareOut: row };
}

export function approveShareOut(shareOut, actor) {
  if (!canAction(actor, "Group.Edit") && !canAction(actor, "Accounting.Edit")) return { error: "You cannot approve this share-out" };
  if (shareOut.status !== "Pending") return { error: "Share-out is not pending" };
  if (shareOut.createdBy && shareOut.createdBy === actor?.id && actor?.role !== "SystemOwner") {
    return { error: "Cannot approve your own share-out" };
  }
  shareOut.status = "Approved";
  shareOut.approvedBy = actor?.id || "";
  shareOut.approvedAt = new Date().toISOString();
  return { shareOut };
}

export function closeMeeting(state, meeting, group, { actor, uid, receiptFn }) {
  if (meeting.status === "Closed") return { error: "Meeting already closed" };
  finalizeMeetingTotals(meeting);
  const posted = [];
  (meeting.contributions || []).forEach((line) => {
    if (line.postedCollectionId || Number(line.amount || 0) <= 0) return;
    const collection = {
      id: uid("col"),
      paymentNo: receiptFn ? receiptFn() : uid("rcp"),
      receiptNo: "",
      customerId: line.customerId,
      groupId: group.branchId,
      susuGroupId: group.id,
      collectionType: COLLECTION_TYPES.SUSU_GROUP,
      amount: Number(line.amount || 0),
      amountPesewas: toPesewas(line.amount),
      date: meeting.date,
      paymentMethod: line.method || "Cash",
      visitOutcome: "Paid",
      note: line.reason || "Group meeting contribution",
      userId: actor?.id || meeting.recordedBy,
      collectorId: group.collectorId,
      meetingId: meeting.id,
      reversed: false,
      createdAt: new Date().toISOString()
    };
    collection.receiptNo = collection.paymentNo;
    state.collections = state.collections || [];
    state.collections.push(collection);
    line.postedCollectionId = collection.id;
    postDoubleEntry(state, {
      id: uid("led"),
      entryType: "Susu Deposit",
      customerId: line.customerId,
      groupId: group.branchId,
      collectorId: group.collectorId,
      amount: collection.amount,
      direction: "credit",
      referenceId: collection.id,
      referenceType: "collection",
      receiptNo: collection.receiptNo,
      paymentMethod: collection.paymentMethod,
      createdBy: actor?.id || "",
      clientCreatedAt: collection.createdAt
    }, uid);
    posted.push(collection);
  });
  (meeting.fines || []).forEach((line) => {
    if (line.postedFineId || Number(line.amount || 0) <= 0) return;
    const fine = recordFine(state, {
      group,
      customerId: line.customerId,
      amount: line.amount,
      reason: line.reason || "Meeting fine",
      meetingId: meeting.id,
      recordedBy: actor?.id || "",
      uid
    }).fine;
    line.postedFineId = fine?.id;
  });
  (meeting.welfare || []).forEach((line) => {
    if (line.postedWelfareId || Number(line.amount || 0) <= 0) return;
    const welfare = recordWelfare(state, {
      group,
      customerId: line.customerId,
      amount: line.amount,
      type: "Contribution",
      meetingId: meeting.id,
      recordedBy: actor?.id || "",
      uid
    }).welfare;
    line.postedWelfareId = welfare?.id;
  });
  meeting.status = "Closed";
  meeting.step = "closed";
  meeting.closedAt = new Date().toISOString();
  meeting.closedBy = actor?.id || "";
  group.walletPesewas = Number(group.walletPesewas || 0) + toPesewas(meeting.totals?.contributions || 0);
  return { meeting, posted };
}

export function logGroupActivity(state, { action, susuGroupId = "", detail = "", userId = "", uid }) {
  state.groupActivityLogs = state.groupActivityLogs || [];
  const row = {
    id: uid("gal"),
    action,
    susuGroupId,
    detail,
    userId,
    createdAt: new Date().toISOString()
  };
  state.groupActivityLogs.push(row);
  return row;
}

export function publishGroupAnnouncement(state, { susuGroupId, title, body, createdBy, uid }) {
  if (!String(title || "").trim()) return { error: "Title is required" };
  state.groupAnnouncements = state.groupAnnouncements || [];
  const row = {
    id: uid("gann"),
    susuGroupId,
    title: String(title).trim(),
    body: String(body || "").trim(),
    createdBy: createdBy || "",
    createdAt: new Date().toISOString()
  };
  state.groupAnnouncements.push(row);
  return { announcement: row };
}

export function addGroupDocument(group, { name, dataUrl, uploadedBy }) {
  group.documents = group.documents || [];
  const doc = {
    id: `gdoc-${Date.now()}`,
    name: name || "Document",
    dataUrl: dataUrl || "",
    uploadedBy: uploadedBy || "",
    createdAt: new Date().toISOString()
  };
  group.documents.push(doc);
  return { document: doc };
}

export function groupAnalytics(groups = [], extras = {}) {
  const rows = groups.map((group) => {
    const dash = groupDashboard(group, extras);
    return { id: group.id, name: group.name, collected: dash.actual || 0, members: dash.activeMembers, attendance: dash.attendancePercent };
  }).sort((a, b) => b.collected - a.collected);
  return {
    groupCount: groups.length,
    memberCount: groups.reduce((sum, group) => sum + activeMemberships(group).length, 0),
    topGroups: rows.slice(0, 8),
    totalCollected: rows.reduce((sum, row) => sum + row.collected, 0)
  };
}

export function exportGroupRows(groups = [], extras = {}) {
  const { branchName = () => "", agentName = () => "" } = extras;
  return groups.map((group) => ({
    code: group.code,
    name: group.name,
    type: group.groupType || "",
    status: group.status || "Active",
    branch: branchName(group),
    agent: agentName(group),
    members: activeMemberships(group).length,
    contribution: group.contributionAmount || 0
  }));
}

export function attendancePercent(meeting) {
  const rows = meeting.attendance || [];
  if (!rows.length) return 0;
  return Math.round((rows.filter((row) => row.present).length / rows.length) * 100);
}

export { recordAttendance, recordMeetingLine, finalizeMeetingTotals, createGroupMeeting };
