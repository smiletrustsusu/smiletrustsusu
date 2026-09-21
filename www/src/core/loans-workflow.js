/**
 * Loan applications, approval, disbursement, schedule, penalties, restructuring, early settlement.
 * GAP-005: principal / disbursement amounts go through guardMoneyWritePayload (no SQL rewrite).
 */
import { toPesewas, fromPesewas, guardMoneyWritePayload, assertDualMoneyConsistent } from "./money.js";
import { buildInterestSchedule } from "./domain.js";

export const LOAN_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Pending Approval",
  "Approved",
  "Ready for Disbursement",
  "Disbursed",
  "Active",
  "Restructured",
  "Defaulted",
  "Written Off",
  "Recovered",
  "Completed",
  "Settled",
  "Rejected",
  "Cancelled",
  "Pending",
  "Verified"
];

export const LOAN_TRANSITIONS = {
  Draft: ["Submitted", "Cancelled"],
  Submitted: ["Under Review", "Draft", "Cancelled"],
  "Under Review": ["Pending Approval", "Rejected"],
  "Pending Approval": ["Approved", "Rejected", "Under Review"],
  Approved: ["Ready for Disbursement", "Cancelled", "Disbursed", "Active"],
  "Ready for Disbursement": ["Disbursed", "Cancelled"],
  Disbursed: ["Active"],
  Active: ["Completed", "Defaulted", "Restructured", "Settled"],
  Restructured: ["Active", "Completed", "Defaulted", "Settled"],
  Defaulted: ["Recovered", "Written Off"],
  "Written Off": ["Recovered"],
  Recovered: ["Active", "Completed"],
  Completed: [],
  Settled: [],
  Rejected: [],
  Cancelled: [],
  Pending: ["Approved", "Rejected", "Under Review", "Draft", "Cancelled", "Submitted", "Pending Approval"],
  Verified: ["Pending Approval", "Rejected", "Approved"]
};

export const TERMINAL_LOAN_STATUSES = ["Completed", "Settled", "Rejected", "Cancelled"];

export function canTransitionLoan(fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = LOAN_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

export function loanAwaitingApproval(status) {
  return ["Pending", "Submitted", "Under Review", "Pending Approval"].includes(status);
}

export function loanCanApproveNow(status) {
  return ["Pending", "Pending Approval", "Verified"].includes(status);
}

export function loanCanRejectNow(status) {
  return ["Pending", "Under Review", "Pending Approval", "Verified"].includes(status);
}

export function loanAwaitingDisbursement(status) {
  return ["Approved", "Ready for Disbursement"].includes(status);
}

export function loanIsEditable(status) {
  return ["Draft", "Pending", "Submitted", "Under Review", "Pending Approval", "Approved", "Active"].includes(status);
}

export function loanAcceptsRepayment(status) {
  return ["Active", "Restructured", "Disbursed", "Recovered", "Defaulted", "Written Off"].includes(status);
}

export function loanCanBeCancelled(status) {
  return ["Draft", "Submitted", "Pending", "Approved", "Ready for Disbursement"].includes(status);
}

export function loanShowsSchedule(status) {
  return ["Active", "Completed", "Settled", "Restructured", "Recovered", "Defaulted"].includes(status);
}

function denyLoanTransition(loan, fromStatus, nextStatus, error, opts = {}) {
  const denial = {
    previousStatus: fromStatus,
    requestedStatus: nextStatus,
    newStatus: fromStatus,
    rejected: true,
    error,
    at: new Date().toISOString(),
    by: opts.userId || "",
    role: opts.role || "",
    branchId: opts.branchId || loan?.groupId || "",
    device: opts.device || "",
    ipAddress: opts.ipAddress || "",
    reason: String(opts.reason || opts.note || "").trim(),
    loanNumber: loan?.id || "",
    customerId: loan?.customerId || ""
  };
  if (loan) {
    loan.deniedTransitions = loan.deniedTransitions || [];
    loan.deniedTransitions.push(denial);
  }
  return { error, denial };
}

export function transitionLoanStatus(loan, nextStatus, {
  userId = "",
  role = "",
  branchId = "",
  device = "",
  ipAddress = "",
  reason = "",
  note = "",
  approvalReference = "",
  canApprove = true,
  canDisburse = true,
  branchAllowed = true,
  periodOpen = true,
  eligibilityOk = true,
  approvalLimit = Number.POSITIVE_INFINITY,
  requireDocuments = false,
  documentsComplete = true,
  requireMakerChecker = false
} = {}) {
  if (!loan) return { error: "Loan not found" };
  const from = loan.status || "Draft";
  const opts = { userId, role, branchId, device, ipAddress, reason, note };
  if (!LOAN_STATUSES.includes(nextStatus)) {
    return denyLoanTransition(loan, from, nextStatus, "Invalid loan status", opts);
  }
  if (from === nextStatus) return { loan };
  if (TERMINAL_LOAN_STATUSES.includes(from)) {
    return denyLoanTransition(loan, from, nextStatus, `${from} loans cannot change status`, opts);
  }
  if (!canTransitionLoan(from, nextStatus)) {
    return denyLoanTransition(loan, from, nextStatus, `Cannot change loan from ${from} to ${nextStatus}`, opts);
  }
  if (branchAllowed === false) {
    return denyLoanTransition(loan, from, nextStatus, "This loan is not in your assigned location", opts);
  }
  if (periodOpen === false) {
    return denyLoanTransition(loan, from, nextStatus, "The accounting period is closed", opts);
  }
  if (eligibilityOk === false) {
    return denyLoanTransition(loan, from, nextStatus, "Loan eligibility rules were not met", opts);
  }
  if (nextStatus === "Approved" && canApprove === false) {
    return denyLoanTransition(loan, from, nextStatus, "You cannot approve this loan", opts);
  }
  if (nextStatus === "Approved" && Number(loan.principal || 0) > Number(approvalLimit)) {
    return denyLoanTransition(loan, from, nextStatus, "Amount exceeds your approval limit", opts);
  }
  if (
    requireMakerChecker
    && nextStatus === "Approved"
    && userId
    && (userId === loan.createdBy || userId === loan.submittedBy)
  ) {
    return denyLoanTransition(loan, from, nextStatus, "The submitter cannot approve this loan", opts);
  }
  if (["Disbursed", "Active"].includes(nextStatus) && ["Approved", "Ready for Disbursement"].includes(from)) {
    if (canDisburse === false) {
      return denyLoanTransition(loan, from, nextStatus, "You cannot disburse this loan", opts);
    }
    if (requireDocuments && !documentsComplete) {
      return denyLoanTransition(loan, from, nextStatus, "Signed loan documents are required before disbursement", opts);
    }
    try {
      const principalPesewas = assertDualMoneyConsistent(
        {
          amount: loan.principal,
          amountPesewas: loan.principalPesewas ?? loan.principal_pesewas
        },
        "loanDisbursement"
      );
      loan.principalPesewas = principalPesewas;
    } catch (err) {
      return denyLoanTransition(loan, from, nextStatus, err?.message || String(err), opts);
    }
  }
  if (["Rejected", "Cancelled", "Written Off", "Defaulted"].includes(nextStatus) && !String(reason || note || "").trim()) {
    return denyLoanTransition(loan, from, nextStatus, "Reason is required", opts);
  }
  const previous = from;
  loan.status = nextStatus;
  if (nextStatus === "Disbursed") {
    loan.status = "Active";
    loan.disbursedBy = userId;
    loan.disbursedAt = loan.disbursedAt || new Date().toISOString();
  }
  if (nextStatus === "Approved") {
    loan.approvedBy = userId;
    loan.approvedAt = loan.approvedAt || new Date().toISOString();
  }
  if (nextStatus === "Active" && ["Approved", "Ready for Disbursement", "Disbursed"].includes(previous)) {
    loan.disbursedBy = loan.disbursedBy || userId;
    loan.disbursedAt = loan.disbursedAt || new Date().toISOString();
  }
  if (nextStatus === "Rejected") {
    loan.rejectedBy = userId;
    loan.rejectedAt = new Date().toISOString();
    loan.rejectedReason = String(reason || note || "").trim();
  }
  if (nextStatus === "Cancelled") {
    loan.cancelledBy = userId;
    loan.cancelledAt = new Date().toISOString();
    loan.cancelledReason = String(reason || note || "").trim();
  }
  if (nextStatus === "Written Off") {
    loan.writtenOffBy = userId;
    loan.writtenOffAt = new Date().toISOString();
    loan.writtenOffReason = String(reason || note || "").trim();
  }
  const entry = {
    previousStatus: previous,
    newStatus: loan.status,
    requestedStatus: nextStatus,
    at: new Date().toISOString(),
    by: userId || "",
    role: role || "",
    branchId: branchId || loan.groupId || "",
    device: device || "",
    ipAddress: ipAddress || "",
    reason: String(reason || note || "").trim(),
    note: String(note || "").trim(),
    approvalReference: approvalReference || "",
    loanNumber: loan.id || "",
    customerId: loan.customerId || ""
  };
  loan.workflow = loan.workflow || [];
  loan.workflow.push({ status: loan.status, at: entry.at, by: userId || "", note: entry.reason });
  loan.statusHistory = loan.statusHistory || [];
  loan.statusHistory.push(entry);
  loan.updatedAt = entry.at;
  return { loan, transition: entry };
}

export function advanceLoanStatus(loan, nextStatus, userId, note = "") {
  if (!LOAN_STATUSES.includes(nextStatus)) return { error: "Invalid loan status" };
  return transitionLoanStatus(loan, nextStatus, {
    userId,
    note,
    reason: note || (["Rejected", "Cancelled", "Written Off", "Defaulted"].includes(nextStatus) ? "" : "Workflow")
  });
}

export function buildAmortizationSchedule({ principal, interestRate, months, startDate }) {
  const p = Number(principal || 0);
  const monthsCount = Math.max(1, Number(months || 1));
  const monthlyInterest = (p * Number(interestRate || 0)) / 100;
  const principalPortion = p / monthsCount;
  const installment = principalPortion + monthlyInterest;
  const rows = [];
  let cursor = startDate;
  let remaining = p;
  for (let index = 0; index < monthsCount; index += 1) {
    remaining = Math.max(0, remaining - principalPortion);
    rows.push({
      installmentNo: index + 1,
      dueDate: cursor,
      principal: +principalPortion.toFixed(2),
      interest: +monthlyInterest.toFixed(2),
      amount: +installment.toFixed(2),
      balance: +remaining.toFixed(2),
      status: "Pending",
      paidAmount: 0
    });
    const next = new Date(`${cursor}T00:00:00`);
    next.setMonth(next.getMonth() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return rows;
}

export function validateLoanApplication(data) {
  if (!data.customerId) return "Applicant is required";
  if (Number(data.principal || 0) <= 0) return "Loan amount must be greater than zero";
  if (Number(data.interestMonths || 0) < 1) return "Repayment period must be at least one month";
  return "";
}

export function createLoanApplication(state, data, uid) {
  const error = validateLoanApplication(data);
  if (error) return { error };
  let principal;
  let principalPesewas;
  try {
    const money = guardMoneyWritePayload(
      {
        amount: data.principal,
        amountPesewas: data.principalPesewas ?? data.principal_pesewas ?? data.amountPesewas
      },
      "loanPrincipal"
    );
    principal = money.amountGhs;
    principalPesewas = money.amountPesewas;
  } catch (err) {
    return { error: err?.message || String(err) };
  }
  const interest = Number(data.interest || 0);
  const months = Number(data.interestMonths || 1);
  const date = data.date || new Date().toISOString().slice(0, 10);
  const schedule = buildAmortizationSchedule({
    principal,
    interestRate: interest,
    months,
    startDate: date
  });
  const interestSchedule = buildInterestSchedule(date, principal, interest, months);
  const totalDue = principal + ((principal * interest) / 100) * months;
  const loan = {
    id: uid("loan"),
    customerId: data.customerId,
    groupId: data.groupId || "",
    susuGroupId: data.susuGroupId || "",
    productId: data.productId || "",
    principal,
    principalPesewas,
    interest,
    interestMonths: months,
    termDays: months * 30,
    purpose: String(data.purpose || "").trim(),
    date,
    requestDate: data.requestDate || date,
    totalDue,
    amountPaid: 0,
    status: "Pending",
    guarantors: data.guarantors || (data.guarantorName ? [{
      name: data.guarantorName,
      ghanaCard: data.guarantorGhanaCard || "",
      accountNo: data.guarantorAccountNo || "",
      phone: data.guarantorPhone || ""
    }] : []),
    schedule,
    interestSchedule,
    penaltyRate: Number(data.penaltyRate || 0),
    collectorRecommendation: data.collectorRecommendation || "",
    managerRecommendation: data.managerRecommendation || "",
    workflow: [{ status: "Pending", at: new Date().toISOString(), by: data.createdBy || "" }],
    createdBy: data.createdBy || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.loans = state.loans || [];
  state.loans.push(loan);
  return { loan };
}

export function outstandingLoanBalance(loan) {
  return Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0));
}

export function applyLoanPenalty(loan, overdueInstallments = 0) {
  const rate = Number(loan.penaltyRate || 0);
  if (rate <= 0 || overdueInstallments <= 0) return 0;
  const penalty = (Number(loan.principal || 0) * rate / 100) * overdueInstallments;
  loan.penaltyAmount = +(Number(loan.penaltyAmount || 0) + penalty).toFixed(2);
  loan.totalDue = +(Number(loan.totalDue || 0) + penalty).toFixed(2);
  return penalty;
}

export function restructureLoan(loan, { months, interest, userId, reason, role = "" }) {
  if (!loan) return { error: "Loan not found" };
  if (!["Active", "Restructured"].includes(loan.status)) {
    return { error: "Only active loans can be restructured" };
  }
  const balance = outstandingLoanBalance(loan);
  if (balance <= 0) return { error: "No outstanding balance to restructure" };
  const nextMonths = Number(months || loan.interestMonths || 1);
  const nextInterest = Number(interest ?? loan.interest);
  const previousSchedule = loan.schedule;
  loan.restructureHistory = loan.restructureHistory || [];
  loan.restructureHistory.push({
    at: new Date().toISOString(),
    by: userId || "",
    reason: String(reason || "").trim(),
    previousPrincipal: loan.principal,
    previousMonths: loan.interestMonths,
    previousInterest: loan.interest,
    previousSchedule: previousSchedule || [],
    remaining: balance
  });
  loan.principal = balance;
  loan.interest = nextInterest;
  loan.interestMonths = nextMonths;
  loan.totalDue = balance + ((balance * nextInterest) / 100) * nextMonths;
  loan.amountPaid = 0;
  loan.schedule = buildAmortizationSchedule({
    principal: balance,
    interestRate: nextInterest,
    months: nextMonths,
    startDate: new Date().toISOString().slice(0, 10)
  });
  loan.interestSchedule = buildInterestSchedule(new Date().toISOString().slice(0, 10), balance, nextInterest, nextMonths);
  if (loan.status === "Active") {
    const moved = transitionLoanStatus(loan, "Restructured", {
      userId,
      role,
      reason: String(reason || "").trim() || "Approved restructuring"
    });
    if (moved.error) return moved;
  } else {
    loan.updatedAt = new Date().toISOString();
  }
  return { loan };
}

export function earlySettlementAmount(loan, rebatePercent = 0) {
  const outstanding = outstandingLoanBalance(loan);
  const rebate = outstanding * Number(rebatePercent || 0) / 100;
  return {
    outstanding,
    rebate: +rebate.toFixed(2),
    payable: +Math.max(0, outstanding - rebate).toFixed(2)
  };
}

export function applyEarlySettlement(loan, { userId, rebatePercent = 0, role = "" }) {
  if (!loan) return { error: "Loan not found" };
  if (!canTransitionLoan(loan.status, "Settled")) {
    return { error: `Cannot settle loan from ${loan.status}` };
  }
  const quote = earlySettlementAmount(loan, rebatePercent);
  loan.amountPaid = Number(loan.amountPaid || 0) + quote.payable;
  const moved = transitionLoanStatus(loan, "Settled", {
    userId,
    role,
    reason: "Early settlement"
  });
  if (moved.error) return moved;
  loan.settledAt = new Date().toISOString();
  loan.settledBy = userId || "";
  loan.settlementRebate = quote.rebate;
  loan.updatedAt = loan.settledAt;
  return { loan, quote };
}

export function applyRepaymentLifecycle(loan, { userId = "", role = "", reason = "Repayment" } = {}) {
  if (!loan) return { error: "Loan not found" };
  if (["Defaulted", "Written Off"].includes(loan.status)) {
    const recovered = transitionLoanStatus(loan, "Recovered", {
      userId,
      role,
      reason: "Recovery payment received"
    });
    if (recovered.error) return recovered;
  } else if (loan.status === "Disbursed") {
    const activated = transitionLoanStatus(loan, "Active", {
      userId,
      role,
      reason: "Repayment tracking"
    });
    if (activated.error) return activated;
  }
  if (outstandingLoanBalance(loan) <= 0.009 && !["Completed", "Settled"].includes(loan.status)) {
    if (!canTransitionLoan(loan.status, "Completed")) {
      return { error: `Cannot complete loan from ${loan.status}` };
    }
    return transitionLoanStatus(loan, "Completed", {
      userId,
      role,
      reason: "Full repayment received"
    });
  }
  return { loan };
}

export function allocateRepayment(loan, amount, { userId = "", role = "" } = {}) {
  let remaining = Number(amount || 0);
  (loan.schedule || []).forEach((row) => {
    if (remaining <= 0 || row.status === "Paid") return;
    const due = Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0));
    const pay = Math.min(due, remaining);
    row.paidAmount = Number(row.paidAmount || 0) + pay;
    remaining -= pay;
    row.status = row.paidAmount >= row.amount - 0.009 ? "Paid" : "Partial";
  });
  loan.amountPaid = Number(loan.amountPaid || 0) + Number(amount || 0);
  applyRepaymentLifecycle(loan, { userId, role, reason: "Repayment" });
  loan.updatedAt = new Date().toISOString();
  return loan;
}

export function evaluateLoanDefault(loan, { overdueDays = 0, thresholdDays = 90, userId = "", role = "" } = {}) {
  if (!loan) return { error: "Loan not found" };
  if (!["Active", "Restructured"].includes(loan.status)) return { loan };
  if (Number(overdueDays) < Number(thresholdDays || 0)) return { loan };
  return transitionLoanStatus(loan, "Defaulted", {
    userId,
    role,
    reason: `Repayment overdue ${overdueDays} days`
  });
}

export function loanPortfolioSummary(loans = []) {
  const active = loans.filter((loan) => ["Approved", "Disbursed", "Active", "Restructured"].includes(loan.status));
  const outstanding = loans.reduce((sum, loan) => sum + outstandingLoanBalance(loan), 0);
  const disbursed = loans.reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
  const pending = loans.filter((loan) => [
    "Pending",
    "Verified",
    "Draft",
    "Submitted",
    "Under Review",
    "Pending Approval"
  ].includes(loan.status)).length;
  return {
    count: loans.length,
    active: active.length,
    pending,
    disbursed: +disbursed.toFixed(2),
    outstanding: +outstanding.toFixed(2),
    outstandingPesewas: toPesewas(outstanding),
    disbursedDisplay: fromPesewas(toPesewas(disbursed))
  };
}
