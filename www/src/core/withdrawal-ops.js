/**
 * Withdrawals and savings redemption on top of existing withdrawalRequests[]
 * and immediate cash-out transactions. Does not replace handleWithdrawal.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { cashPositionPesewas, channelAccountForMethod } from "./double-entry.js";
import { PRODUCT_TYPES } from "./savings-products.js";
import { barcodeSvg, qrSvg, receiptVerifyText } from "./receipt-codes.js";
import { canAction } from "./rbac.js";
import {
  acquireLock,
  assertOptimisticVersion,
  findByIdempotencyKey,
  newCorrelationId,
  releaseLock,
  restoreRecord,
  snapshotRecord
} from "./financial-txn.js";
import {
  createWithdrawalRequest,
  transitionWithdrawalStatus,
  withdrawalAwaitingPayment
} from "./withdrawals-workflow.js";

export const WITHDRAWAL_TYPES = [
  "Normal Withdrawal",
  "Partial Withdrawal",
  "Full Withdrawal",
  "Fixed Savings Maturity",
  "Target Savings Redemption",
  "Emergency Withdrawal",
  "Group Withdrawal",
  "Welfare Withdrawal",
  "Dividend Withdrawal",
  "Account Closure Withdrawal"
];

export const WITHDRAWAL_METHODS = [
  "Cash",
  "MTN Mobile Money",
  "Telecel Cash",
  "AirtelTigo Money",
  "Bank Transfer",
  "Internal Account Transfer"
];

export const WITHDRAWAL_TYPE_RULES = {
  "Normal Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Partial Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Full Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Fixed Savings Maturity": { feePercent: 0, minBalance: 0, requireMaturity: true, waitingDays: 0 },
  "Target Savings Redemption": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Emergency Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0, emergency: true },
  "Group Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Welfare Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Dividend Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0 },
  "Account Closure Withdrawal": { feePercent: 0, minBalance: 0, requireMaturity: false, waitingDays: 0, closeAccount: true }
};

export function canCreateWithdrawal(user) {
  return canAction(user, "Withdrawal.Create");
}

export function canApproveWithdrawal(user) {
  return canAction(user, "Withdrawal.Approve");
}

export function canPayWithdrawalAction(user) {
  return canAction(user, "Withdrawal.Pay");
}

export function withdrawalQuote(request = {}, rules = {}) {
  const type = request.withdrawalType || "Normal Withdrawal";
  const config = { ...WITHDRAWAL_TYPE_RULES[type], ...rules };
  const gross = Number(request.amount || 0);
  const fee = Number(request.fee != null ? request.fee : gross * Number(config.feePercent || 0) / 100);
  const tax = Number(request.tax || 0);
  const net = Math.max(0, gross - fee - tax);
  return {
    gross: +gross.toFixed(2),
    fee: +fee.toFixed(2),
    tax: +tax.toFixed(2),
    netAmount: +net.toFixed(2)
  };
}

export function availableWithdrawalBalance(available = 0, held = 0) {
  return Math.max(0, Number(available || 0) - Number(held || 0));
}

export function validateWithdrawalEligibility({
  customer,
  account,
  product,
  amount,
  availableBalance = 0,
  heldBalance = 0,
  loanBalance = 0,
  todayWithdrawn = 0,
  withdrawalType = "Normal Withdrawal",
  requireClearLoans = false,
  asOfDate = "",
  documentsComplete = true,
  requireDocuments = false
} = {}) {
  const checks = [];
  const day = asOfDate || new Date().toISOString().slice(0, 10);
  const rules = WITHDRAWAL_TYPE_RULES[withdrawalType] || WITHDRAWAL_TYPE_RULES["Normal Withdrawal"];
  const usable = availableWithdrawalBalance(availableBalance, heldBalance);
  const value = Number(amount || 0);

  function add(ok, message) {
    checks.push({ ok, message });
  }

  add(Boolean(customer), "Customer is selected");
  add(customer && customer.active !== false && !["Suspended", "Closed", "Blacklisted", "Deceased"].includes(customer?.memberStatus), "Customer is active");
  add(!account || account.status !== "Closed", "Savings account is active");
  add(value > 0, "Amount is greater than zero");
  add(value <= usable + 0.009, "Sufficient available balance");
  add(Number(heldBalance || 0) <= Number(availableBalance || 0), "Funds are not fully on hold");
  add(!(customer?.withdrawalRestricted || account?.restricted), "Account is not restricted");
  add(usable - value >= Number(rules.minBalance || 0) - 0.009, "Minimum balance will be maintained");
  if (rules.requireMaturity) {
    const maturity = account?.maturityDate || product?.maturityDate || "";
    add(Boolean(maturity) && maturity <= day, "Fixed savings maturity date reached");
  } else {
    add(true, "Maturity rule does not apply");
  }
  if (requireClearLoans) {
    add(Number(loanBalance || 0) <= 0.009, "No outstanding loan obligations");
  } else {
    add(true, "Loan clearance is not required by policy");
  }
  const dailyLimit = Number(product?.dailyWithdrawalLimit || product?.maxWithdrawal || 0);
  if (dailyLimit > 0) {
    add(Number(todayWithdrawn || 0) + value <= dailyLimit + 0.009, "Daily withdrawal limit");
  } else {
    add(true, "No daily withdrawal limit configured");
  }
  if (requireDocuments) {
    add(documentsComplete, "Required documents uploaded");
  } else {
    add(true, "Documents are not required");
  }
  const failed = checks.find((item) => !item.ok);
  return {
    ok: !failed,
    error: failed ? failed.message : "",
    checks,
    usable: +usable.toFixed(2),
    remaining: +Math.max(0, usable - value).toFixed(2)
  };
}

export function logWithdrawalActivity(state, request, action, detail = "", userId = "") {
  const row = {
    id: `${request?.id || "wdr"}-${Date.now().toString(36)}`,
    withdrawalId: request?.id || "",
    customerId: request?.customerId || "",
    action,
    detail,
    userId,
    createdAt: new Date().toISOString()
  };
  state.withdrawalActivityLogs = state.withdrawalActivityLogs || [];
  state.withdrawalActivityLogs.push(row);
  return row;
}

export function filterWithdrawals(rows = [], {
  query = "",
  status = "",
  type = "",
  method = "",
  branchId = "",
  officerId = "",
  from = "",
  to = ""
} = {}) {
  const q = String(query || "").trim().toLowerCase();
  return rows.filter((item) => {
    if (status && item.status !== status) return false;
    if (type && item.withdrawalType !== type) return false;
    if (method && item.paymentMethod !== method) return false;
    if (branchId && item.branchId !== branchId && item.groupId !== branchId) return false;
    if (officerId && ![item.requestedBy, item.approvedBy, item.paidBy].includes(officerId)) return false;
    if (from && (item.date || "") < from) return false;
    if (to && (item.date || "") > to) return false;
    if (!q) return true;
    return [item.id, item.receiptNo, item.customerId, item.reason, item.paymentReference, item.savingsAccountId]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function withdrawalDashboard(requests = [], transactions = [], { date = "", groupIds = [], ledgerState = null } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const paidTx = transactions.filter((tx) => tx.type === "Withdrawal" && !tx.reversed);
  const paidToday = paidTx.filter((tx) => tx.date === day);
  const fees = requests.reduce((sum, item) => sum + (item.status === "Paid" ? Number(item.fee || 0) : 0), 0);
  const pending = requests.filter((item) => !["Paid", "Rejected", "Cancelled", "Reversed"].includes(item.status));
  const byMethod = {};
  paidToday.forEach((tx) => {
    const method = tx.paymentMethod || "Cash";
    byMethod[method] = (byMethod[method] || 0) + Number(tx.amount || 0);
  });
  return {
    pendingRequests: pending.length,
    approvedToday: requests.filter((item) => item.status === "Approved" && (item.updatedAt || "").slice(0, 10) === day).length,
    paidToday: paidToday.length,
    rejectedRequests: requests.filter((item) => item.status === "Rejected").length,
    totalWithdrawalAmount: +paidTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2),
    emergencyWithdrawals: requests.filter((item) => item.withdrawalType === "Emergency Withdrawal").length,
    outstandingRequests: +pending.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2),
    feesCollected: +fees.toFixed(2),
    paidTodayAmount: +paidToday.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2),
    byMethod,
    cashPosition: ledgerState ? fromPesewas(cashPositionPesewas(ledgerState, { groupIds })) : 0
  };
}

export function withdrawalAnalytics(requests = [], transactions = []) {
  const paid = transactions.filter((tx) => tx.type === "Withdrawal" && !tx.reversed);
  const byType = {};
  const byBranch = {};
  const byAgent = {};
  const byMonth = {};
  requests.forEach((item) => {
    const type = item.withdrawalType || "Normal Withdrawal";
    byType[type] = (byType[type] || 0) + Number(item.amount || 0);
    const branch = item.branchId || item.groupId || "Unassigned";
    byBranch[branch] = (byBranch[branch] || 0) + Number(item.amount || 0);
    const agent = item.requestedBy || "Unassigned";
    byAgent[agent] = (byAgent[agent] || 0) + Number(item.amount || 0);
  });
  paid.forEach((tx) => {
    const month = String(tx.date || "").slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + Number(tx.amount || 0);
  });
  return {
    byType,
    byBranch,
    byAgent,
    byMonth,
    fees: +requests.reduce((sum, item) => sum + Number(item.fee || 0), 0).toFixed(2),
    outflow: +paid.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2)
  };
}

export function detectMaturedAccounts(accounts = [], products = [], { asOfDate = "" } = {}) {
  const day = asOfDate || new Date().toISOString().slice(0, 10);
  return accounts.filter((account) => {
    const product = products.find((item) => item.id === account.productId);
    const type = product?.type || account.type;
    const maturity = account.maturityDate || "";
    if (!maturity) return false;
    const locked = type === PRODUCT_TYPES.FIXED_DEPOSIT || type === PRODUCT_TYPES.INVESTMENT_SAVINGS || Boolean(product?.maturityMonths);
    return locked && maturity <= day && account.status !== "Closed" && account.status !== "Redeemed";
  });
}

export function maturityRedemptionPreview(account = {}, product = {}) {
  const principal = Number(account.balance || account.principal || 0);
  const rate = Number(account.interestRate ?? product.interestRate ?? 0);
  const months = Number(account.termMonths || product.maturityMonths || 0);
  const interest = principal * rate / 100 * (months / 12);
  const tax = Number(account.tax || 0);
  const charges = Number(account.charges || 0) || fromPesewas(product.feePesewas || 0);
  const net = Math.max(0, principal + interest - tax - charges);
  return {
    maturityDate: account.maturityDate || "",
    principal: +principal.toFixed(2),
    interestEarned: +interest.toFixed(2),
    totalPayable: +(principal + interest).toFixed(2),
    taxes: +tax.toFixed(2),
    charges: +charges.toFixed(2),
    netAmount: +net.toFixed(2)
  };
}

export function withdrawalReceiptModel(request, extras = {}) {
  const quote = withdrawalQuote(request);
  const receipt = {
    receiptNo: request.receiptNo || request.id,
    withdrawalNo: request.id,
    customerName: extras.customerName || "",
    customerNumber: extras.customerNumber || "",
    productName: extras.productName || "",
    withdrawalType: request.withdrawalType || "Normal Withdrawal",
    amount: quote.gross,
    fee: quote.fee,
    netAmount: quote.netAmount,
    paymentMethod: request.paymentMethod || "Cash",
    branchName: extras.branchName || "",
    officerName: extras.officerName || "",
    date: request.date || "",
    type: "Withdrawal"
  };
  return {
    ...receipt,
    verifyText: receiptVerifyText(receipt),
    barcode: barcodeSvg(receipt.receiptNo),
    qr: qrSvg(receiptVerifyText(receipt))
  };
}

export function exportWithdrawalRows(rows = [], nameOf = {}) {
  return rows.map((item) => ({
    Date: item.date || "",
    Number: item.id,
    Receipt: item.receiptNo || "",
    Customer: nameOf.customer?.(item.customerId) || item.customerId,
    Type: item.withdrawalType || "Normal Withdrawal",
    Amount: Number(item.amount || 0),
    Fee: Number(item.fee || 0),
    Net: Number(item.netAmount || item.amount || 0),
    Method: item.paymentMethod || "Cash",
    Status: item.status,
    Officer: nameOf.user?.(item.paidBy || item.requestedBy) || ""
  }));
}

export function withdrawalFraudAlerts(requests = []) {
  const alerts = [];
  const paidKeys = new Set();
  requests.forEach((item) => {
    if (item.status === "Paid" && item.receiptNo) {
      const key = String(item.receiptNo).toLowerCase();
      if (paidKeys.has(key)) alerts.push({ type: "duplicate_receipt", id: item.id, message: "Duplicate payment receipt" });
      paidKeys.add(key);
    }
    if (Number(item.amount || 0) >= 20000 && item.withdrawalType === "Emergency Withdrawal") {
      alerts.push({ type: "large_emergency", id: item.id, message: "Large emergency withdrawal" });
    }
  });
  return alerts;
}

export function submitWithdrawalRequest(state, data, uid) {
  const eligibility = data.eligibility || { ok: true };
  if (!eligibility.ok) return { error: eligibility.error || "Withdrawal is not eligible" };
  if (data.idempotencyKey && findByIdempotencyKey(state.withdrawalRequests || [], data.idempotencyKey)) {
    return { request: findByIdempotencyKey(state.withdrawalRequests, data.idempotencyKey), replay: true };
  }
  const quote = withdrawalQuote(data);
  const created = createWithdrawalRequest(state, {
    ...data,
    fee: quote.fee,
    netAmount: quote.netAmount,
    correlationId: data.correlationId || newCorrelationId("wd")
  }, uid);
  if (created.error) return created;
  logWithdrawalActivity(state, created.request, "requested", `${created.request.withdrawalType} · ${created.request.amount}`, data.requestedBy || "");
  return created;
}

export function payWithdrawal(state, request, {
  userId = "",
  role = "",
  availableBalance = 0,
  heldBalance = 0,
  expectedUpdatedAt = "",
  online = true,
  allowOfflinePay = false,
  idempotencyKey = "",
  paymentMethod = "",
  paymentReference = "",
  receiverName = "",
  receiverId = "",
  postPayment
} = {}) {
  if (!request) return { error: "Withdrawal not found" };
  if (!online && !allowOfflinePay) return { error: "Payment requires an online connection" };
  const version = assertOptimisticVersion(request, expectedUpdatedAt);
  if (version.error) return version;
  if (idempotencyKey && request.status === "Paid" && String(request.idempotencyKey || "").toLowerCase() === String(idempotencyKey).toLowerCase()) {
    return { request, replay: true };
  }
  if (!withdrawalAwaitingPayment(request.status)) return { error: "Withdrawal is not ready for payment" };
  if (request.receiptNo || request.paidAt) return { error: "This withdrawal has already been paid" };
  if (request.paymentInProgress) return { error: "A payment is already in progress" };
  const usable = availableWithdrawalBalance(availableBalance, heldBalance);
  if (Number(request.amount) > usable + 0.009) return { error: "Balance is no longer sufficient" };
  const method = paymentMethod || request.paymentMethod || "Cash";
  if (method !== "Cash" && method !== "Internal Account Transfer" && !String(paymentReference || request.paymentReference || "").trim()) {
    return { error: "Payment reference is required" };
  }
  const snapshot = snapshotRecord(request);
  const locked = acquireLock(request, userId);
  if (locked.error) return locked;
  request.paymentInProgress = true;
  try {
    const moved = transitionWithdrawalStatus(request, "Paid", {
      userId,
      role,
      reason: "Paid",
      canPay: true
    });
    if (moved.error) {
      restoreRecord(request, snapshot);
      return moved;
    }
    const quote = withdrawalQuote(request);
    const posted = typeof postPayment === "function"
      ? postPayment({
        amount: quote.netAmount,
        fee: quote.fee,
        method,
        reference: paymentReference || "",
        request
      })
      : { receiptNo: request.id };
    if (posted?.error) {
      restoreRecord(request, snapshot);
      return posted;
    }
    request.receiptNo = posted.receiptNo || request.receiptNo || request.id;
    request.paymentMethod = method;
    request.paymentReference = paymentReference || request.paymentReference || "";
    request.receiverName = receiverName || "";
    request.receiverId = receiverId || "";
    request.idempotencyKey = idempotencyKey || request.idempotencyKey || "";
    request.channelAccount = channelAccountForMethod(method);
    request.fee = quote.fee;
    request.netAmount = quote.netAmount;
    request.paymentInProgress = false;
    request.previousBalance = Number(availableBalance || 0);
    request.newBalance = +(usable - Number(request.amount || 0)).toFixed(2);
    releaseLock(request);
    logWithdrawalActivity(state, request, "paid", request.receiptNo, userId);
    return { request, quote, committed: true, notify: "withdrawal_paid" };
  } catch (error) {
    restoreRecord(request, snapshot);
    return { error: error.message || "Payment failed", rolledBack: true };
  }
}

export function reverseWithdrawalPayment(state, request, {
  userId = "",
  role = "",
  reason = "",
  postReversal
} = {}) {
  if (!request) return { error: "Withdrawal not found" };
  if (request.status !== "Paid") return { error: "Only paid withdrawals can be reversed" };
  if (!String(reason || "").trim()) return { error: "Reason is required" };
  const snapshot = snapshotRecord(request);
  const locked = acquireLock(request, userId);
  if (locked.error) return locked;
  try {
    const moved = transitionWithdrawalStatus(request, "Reversed", { userId, role, reason });
    if (moved.error) {
      restoreRecord(request, snapshot);
      return moved;
    }
    if (typeof postReversal === "function") {
      const reversed = postReversal(request);
      if (reversed?.error) {
        restoreRecord(request, snapshot);
        return reversed;
      }
    }
    releaseLock(request);
    logWithdrawalActivity(state, request, "reversed", reason, userId);
    return { request, committed: true, notify: "withdrawal_reversed" };
  } catch (error) {
    restoreRecord(request, snapshot);
    return { error: error.message || "Reversal failed", rolledBack: true };
  }
}

export function cancelWithdrawal(request, { userId = "", role = "", reason = "" } = {}) {
  return transitionWithdrawalStatus(request, "Cancelled", { userId, role, reason });
}

export function closeSavingsAccount(state, account, {
  userId = "",
  customerId = "",
  reason = "",
  loanBalance = 0,
  requireClearLoans = false,
  pendingCount = 0,
  confirmed = false,
  approved = false
} = {}) {
  if (!account) return { error: "Savings account not found" };
  if (account.status === "Closed") return { error: "Account is already closed" };
  if (requireClearLoans && Number(loanBalance || 0) > 0.009) return { error: "Outstanding loans must be cleared" };
  if (Number(pendingCount || 0) > 0) return { error: "Pending transactions must be completed" };
  if (!confirmed) return { error: "Customer confirmation is required" };
  if (!approved) return { error: "Manager approval is required" };
  account.status = "Closed";
  account.closedAt = new Date().toISOString();
  account.closedBy = userId;
  account.closureReason = String(reason || "").trim();
  account.updatedAt = account.closedAt;
  const closure = {
    id: `${account.id}-close`,
    accountId: account.id,
    customerId,
    reason: account.closureReason,
    closedBy: userId,
    createdAt: account.closedAt
  };
  state.accountClosures = state.accountClosures || [];
  state.accountClosures.push(closure);
  return { account, closure };
}

export function applyQueuedWithdrawal(state, entry, uid) {
  const payload = entry.payload || {};
  if (!payload.customerId) return false;
  if (payload.id && (state.withdrawalRequests || []).some((item) => item.id === payload.id)) return true;
  if (payload.idempotencyKey && findByIdempotencyKey(state.withdrawalRequests || [], payload.idempotencyKey)) return true;
  const created = submitWithdrawalRequest(state, payload, uid);
  return Boolean(created.request);
}
