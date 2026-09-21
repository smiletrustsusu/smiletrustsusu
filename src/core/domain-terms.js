/**
 * Authoritative savings and collection terms for Smile Trust.
 * Live posting paths are unchanged; reports and new helpers must use these meanings.
 */

export const TERM = {
  SAVINGS: "Savings",
  COLLECTION: "Collection",
  CONTRIBUTION: "Contribution",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  PAYMENT: "Payment",
  LOAN_REPAYMENT: "Loan Repayment",
  TRANSFER: "Transfer",
  ACCOUNT_BALANCE: "Account Balance",
  AVAILABLE_BALANCE: "Available Balance",
  HELD_BALANCE: "Held Balance",
  POSTED: "Posted Transaction",
  PENDING: "Pending Transaction",
  CANCELLED: "Cancelled Transaction",
  REVERSED: "Reversed Transaction",
  VOIDED: "Voided Transaction",
  RECEIPT: "Receipt",
  ACCOUNTING_EVENT: "Accounting Event",
  BUSINESS_EVENT: "Business Event"
};

export const DRAFT_OR_NON_POSTED = ["Draft", "Pending", "Cancelled", "Rejected", "Duplicate", "Voided", "Failed"];

export function isPostedCollection(item) {
  if (!item || item.reversed) return false;
  if (DRAFT_OR_NON_POSTED.includes(item.status)) return false;
  return Number(item.amount || 0) > 0;
}

export function isPostedTransaction(item) {
  if (!item || item.reversed) return false;
  if (DRAFT_OR_NON_POSTED.includes(item.status)) return false;
  if (item.lifecycleStatus && !["Posted", "Completed"].includes(item.lifecycleStatus)) return false;
  return Number(item.amount || item.amountPesewas || 0) !== 0;
}

export function isContribution(item) {
  return isPostedCollection(item);
}

export function availableBalance({ current = 0, held = 0, pendingHolds = 0 } = {}) {
  return Math.max(0, Number(current || 0) - Number(held || 0) - Number(pendingHolds || 0));
}

export function loanRepaymentIncreasesSavings() {
  return false;
}
