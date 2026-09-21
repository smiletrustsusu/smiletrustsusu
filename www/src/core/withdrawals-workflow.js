/**
 * Withdrawal workflow: Request → Verification → Approval → Payment → Receipt.
 * Existing Requested → Verified → Approved → Paid path is preserved.
 * GAP-005: write-path money amounts go through guardMoneyWritePayload (no SQL rewrite).
 */
import { guardMoneyWritePayload } from "./money.js";

export const WITHDRAWAL_STATUSES = [
  "Draft",
  "Submitted",
  "Under Verification",
  "Pending Approval",
  "Ready for Payment",
  "Requested",
  "Verified",
  "Approved",
  "Paid",
  "Rejected",
  "Cancelled",
  "Reversed"
];

export const WITHDRAWAL_TRANSITIONS = {
  Draft: ["Submitted", "Cancelled"],
  Submitted: ["Under Verification", "Requested", "Verified", "Cancelled"],
  "Under Verification": ["Pending Approval", "Verified", "Rejected"],
  "Pending Approval": ["Approved", "Rejected", "Under Verification"],
  "Ready for Payment": ["Paid", "Cancelled"],
  Requested: ["Verified", "Rejected", "Cancelled", "Submitted", "Under Verification"],
  Verified: ["Approved", "Rejected", "Under Verification", "Pending Approval"],
  Approved: ["Paid", "Rejected", "Cancelled", "Ready for Payment"],
  Paid: ["Reversed"],
  Rejected: [],
  Cancelled: [],
  Reversed: []
};

export const TERMINAL_WITHDRAWAL_STATUSES = ["Rejected", "Cancelled"];

export function withdrawalApprovalLevels() {
  return [
    { status: "Requested", actor: "Customer / Agent" },
    { status: "Verified", actor: "Customer Service / Supervisor" },
    { status: "Approved", actor: "Branch Manager / Accountant" },
    { status: "Paid", actor: "Cashier" }
  ];
}

export function canTransitionWithdrawal(fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = WITHDRAWAL_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

export function withdrawalAwaitingPayment(status) {
  return ["Approved", "Ready for Payment"].includes(status);
}

function denyWithdrawalTransition(request, fromStatus, nextStatus, error, opts = {}) {
  const denial = {
    previousStatus: fromStatus,
    requestedStatus: nextStatus,
    newStatus: fromStatus,
    rejected: true,
    error,
    at: new Date().toISOString(),
    by: opts.userId || "",
    role: opts.role || "",
    reason: String(opts.reason || opts.note || "").trim()
  };
  if (request) {
    request.deniedTransitions = request.deniedTransitions || [];
    request.deniedTransitions.push(denial);
  }
  return { error, denial };
}

export function transitionWithdrawalStatus(request, nextStatus, {
  userId = "",
  role = "",
  reason = "",
  note = "",
  canApprove = true,
  canPay = true,
  approvalLimit = Number.POSITIVE_INFINITY,
  requireMakerChecker = false
} = {}) {
  if (!request) return { error: "Withdrawal not found" };
  const from = request.status || "Draft";
  const opts = { userId, role, reason, note };
  if (!WITHDRAWAL_STATUSES.includes(nextStatus)) {
    return denyWithdrawalTransition(request, from, nextStatus, "Invalid withdrawal status", opts);
  }
  if (from === nextStatus) return { request };
  if (from === "Paid" && nextStatus !== "Reversed") {
    return denyWithdrawalTransition(request, from, nextStatus, "Paid withdrawals cannot be edited or deleted", opts);
  }
  if (TERMINAL_WITHDRAWAL_STATUSES.includes(from)) {
    return denyWithdrawalTransition(request, from, nextStatus, `${from} withdrawals cannot change status`, opts);
  }
  if (!canTransitionWithdrawal(from, nextStatus)) {
    return denyWithdrawalTransition(request, from, nextStatus, `Cannot move from ${from} to ${nextStatus}`, opts);
  }
  if (["Approved", "Ready for Payment"].includes(nextStatus) && canApprove === false) {
    return denyWithdrawalTransition(request, from, nextStatus, "You cannot approve this withdrawal", opts);
  }
  if (["Approved", "Ready for Payment", "Paid"].includes(nextStatus) && Number(request.amount || 0) > Number(approvalLimit)) {
    return denyWithdrawalTransition(request, from, nextStatus, "This amount is above your approval limit", opts);
  }
  if (nextStatus === "Paid" && canPay === false) {
    return denyWithdrawalTransition(request, from, nextStatus, "You cannot pay this withdrawal", opts);
  }
  if (
    requireMakerChecker
    && ["Approved", "Ready for Payment"].includes(nextStatus)
    && userId
    && userId === request.requestedBy
  ) {
    return denyWithdrawalTransition(request, from, nextStatus, "The requester cannot approve this withdrawal", opts);
  }
  if (["Rejected", "Cancelled", "Reversed"].includes(nextStatus) && !String(reason || note || "").trim()) {
    return denyWithdrawalTransition(request, from, nextStatus, "Reason is required", opts);
  }
  const previous = from;
  request.status = nextStatus;
  if (nextStatus === "Verified" || nextStatus === "Under Verification") request.verifiedBy = request.verifiedBy || userId;
  if (nextStatus === "Approved" || nextStatus === "Ready for Payment") request.approvedBy = request.approvedBy || userId;
  if (nextStatus === "Rejected") {
    request.rejectedBy = userId;
    request.rejectedReason = String(reason || note || "").trim();
  }
  if (nextStatus === "Cancelled") {
    request.cancelledBy = userId;
    request.cancelledReason = String(reason || note || "").trim();
  }
  if (nextStatus === "Paid") {
    request.paidBy = userId;
    request.paidAt = request.paidAt || new Date().toISOString();
  }
  if (nextStatus === "Reversed") {
    request.reversedBy = userId;
    request.reversedAt = new Date().toISOString();
    request.reversedReason = String(reason || note || "").trim();
  }
  const entry = {
    previousStatus: previous,
    newStatus: request.status,
    requestedStatus: nextStatus,
    at: new Date().toISOString(),
    by: userId || "",
    role: role || "",
    reason: String(reason || note || "").trim(),
    note: String(note || "").trim()
  };
  request.workflow = request.workflow || [];
  request.workflow.push({ status: request.status, at: entry.at, by: userId || "", note: entry.reason });
  request.statusHistory = request.statusHistory || [];
  request.statusHistory.push(entry);
  request.updatedAt = entry.at;
  request.versionNumber = Number(request.versionNumber || 1) + 1;
  return { request, transition: entry };
}

export function validateWithdrawalRequest(data, availableBalance = 0) {
  if (!data.customerId) return "Customer is required";
  const amount = Number(data.amount || 0);
  if (amount <= 0) return "Amount must be greater than zero";
  if (amount > Number(availableBalance || 0) + 0.009) return "Amount exceeds available savings balance";
  return "";
}

export function createWithdrawalRequest(state, data, uid) {
  const error = validateWithdrawalRequest(data, data.availableBalance);
  if (error) return { error };
  let amountGhs;
  let amountPesewas;
  try {
    const money = guardMoneyWritePayload(
      {
        amount: data.amount,
        amountPesewas: data.amountPesewas ?? data.amount_pesewas
      },
      "withdrawal"
    );
    amountGhs = money.amountGhs;
    amountPesewas = money.amountPesewas;
  } catch (err) {
    return { error: err?.message || String(err) };
  }
  let feeGhs = 0;
  let feePesewas = 0;
  if (data.fee != null && data.fee !== "" && Number(data.fee) !== 0) {
    try {
      const feeMoney = guardMoneyWritePayload(
        {
          amount: data.fee,
          amountPesewas: data.feePesewas ?? data.fee_pesewas
        },
        "withdrawalFee"
      );
      feeGhs = feeMoney.amountGhs;
      feePesewas = feeMoney.amountPesewas;
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  }
  const netAmount =
    data.netAmount != null ? Number(data.netAmount) : +(amountGhs - feeGhs).toFixed(2);
  const request = {
    id: uid("wdr"),
    customerId: data.customerId,
    groupId: data.groupId || "",
    branchId: data.branchId || data.groupId || "",
    savingsAccountId: data.savingsAccountId || "",
    productId: data.productId || "",
    amount: amountGhs,
    amountPesewas,
    fee: feeGhs,
    feePesewas,
    netAmount,
    reason: String(data.reason || data.note || "").trim(),
    paymentMethod: data.paymentMethod || "Cash",
    withdrawalType: data.withdrawalType || "Normal Withdrawal",
    status: data.status || "Requested",
    requestedBy: data.requestedBy || "",
    requestedAt: new Date().toISOString(),
    date: data.date || new Date().toISOString().slice(0, 10),
    workflow: [{ status: data.status || "Requested", at: new Date().toISOString(), by: data.requestedBy || "" }],
    receiptNo: "",
    paidAt: "",
    paidBy: "",
    idempotencyKey: data.idempotencyKey || "",
    correlationId: data.correlationId || "",
    versionNumber: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.withdrawalRequests = state.withdrawalRequests || [];
  state.withdrawalRequests.push(request);
  return { request };
}

export function advanceWithdrawal(request, nextStatus, userId, note = "") {
  if (!WITHDRAWAL_STATUSES.includes(nextStatus)) return { error: "Invalid withdrawal status" };
  const reason = note || (
    nextStatus === "Rejected" ? "Rejected"
      : nextStatus === "Cancelled" ? "Cancelled"
        : nextStatus === "Reversed" ? "Reversed"
          : "Workflow"
  );
  return transitionWithdrawalStatus(request, nextStatus, { userId, note, reason });
}

export function pendingWithdrawals(state, { status = "", branchId = "" } = {}) {
  return (state.withdrawalRequests || []).filter((item) => {
    if (status && item.status !== status) return false;
    if (branchId && item.branchId !== branchId && item.groupId !== branchId) return false;
    return true;
  });
}

export function canAdvanceWithdrawal(user, request) {
  if (!user || !request) return false;
  if (["Paid", "Rejected", "Cancelled", "Reversed"].includes(request.status)) return false;
  if (["Requested", "Submitted", "Under Verification", "Draft"].includes(request.status)) {
    return ["SystemOwner", "KBA", "Admin", "CustomerService", "FieldSupervisor", "OperationsManager", "ManagingDirector"].includes(user.role);
  }
  if (["Verified", "Pending Approval"].includes(request.status)) {
    return ["SystemOwner", "KBA", "Admin", "Accountant", "ManagingDirector", "OperationsManager"].includes(user.role);
  }
  if (["Approved", "Ready for Payment"].includes(request.status)) {
    return ["SystemOwner", "KBA", "Admin", "Cashier", "Accountant", "ManagingDirector"].includes(user.role);
  }
  return false;
}

export function nextWithdrawalAction(status) {
  if (status === "Draft") return "Submitted";
  if (status === "Submitted" || status === "Requested") return "Verified";
  if (status === "Under Verification") return "Verified";
  if (status === "Verified" || status === "Pending Approval") return "Approved";
  if (status === "Approved" || status === "Ready for Payment") return "Paid";
  return "";
}
