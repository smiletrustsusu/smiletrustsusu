import { appendLedgerEntry, createLedgerEntry, mirrorTransactionFromLedger } from "./ledger.js";
import { markLedgerPairReversed, postDoubleEntry } from "./double-entry.js";
import { canApproveReversal } from "./permissions.js";

export function createReversalRequest(state, {
  id,
  originalCollection,
  reason,
  requestedBy,
  customerId,
  groupId,
  collectorId
}) {
  const reversal = {
    id,
    kind: "collection",
    originalCollectionId: originalCollection.id,
    originalReferenceId: originalCollection.id,
    originalReferenceType: "collection",
    originalReceiptNo: originalCollection.receiptNo || originalCollection.paymentNo || "",
    originalAmount: Number(originalCollection.amount || 0),
    originalEntryType: "Susu Deposit",
    customerId,
    groupId,
    collectorId,
    reason: String(reason || "").trim(),
    requestedBy,
    approvedBy: "",
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  state.reversals = state.reversals || [];
  state.reversals.push(reversal);
  return reversal;
}

export function createTransactionReversalRequest(state, {
  id,
  transaction,
  reason,
  requestedBy,
  customerId,
  groupId,
  collectorId
}) {
  const reversal = {
    id,
    kind: "transaction",
    originalTransactionId: transaction.id,
    originalReferenceId: transaction.id,
    originalReferenceType: "transaction",
    originalReceiptNo: transaction.paymentNo || "",
    originalAmount: Number(transaction.amount || 0),
    originalEntryType: transaction.type,
    customerId,
    groupId,
    collectorId,
    reason: String(reason || "").trim(),
    requestedBy,
    approvedBy: "",
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  state.reversals = state.reversals || [];
  state.reversals.push(reversal);
  return reversal;
}

function reverseDirectionForEntryType(entryType) {
  const credits = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  return credits.includes(entryType) ? "debit" : "credit";
}

export function approveReversal(state, reversalId, approver, uidFn) {
  const reversal = (state.reversals || []).find((item) => item.id === reversalId);
  if (!reversal || reversal.status !== "Pending") return { ok: false, error: "Reversal not found or already processed" };
  if (!canApproveReversal(approver, reversal, state)) {
    return { ok: false, error: "You cannot approve this reversal" };
  }

  if (reversal.kind === "transaction" || reversal.originalTransactionId) {
    return approveTransactionReversal(state, reversal, approver, uidFn);
  }
  return approveCollectionReversal(state, reversal, approver, uidFn);
}

function approveCollectionReversal(state, reversal, approver, uidFn) {
  const collection = (state.collections || []).find((item) => item.id === reversal.originalCollectionId);
  if (!collection || collection.reversed) return { ok: false, error: "Original collection not found or already reversed" };

  const ledgerId = uidFn("led");
  const entry = createLedgerEntry({
    id: ledgerId,
    entryType: "Reversal",
    customerId: reversal.customerId,
    groupId: reversal.groupId,
    collectorId: reversal.collectorId,
    amount: reversal.originalAmount,
    direction: "debit",
    referenceId: collection.id,
    referenceType: "collection",
    receiptNo: reversal.originalReceiptNo,
    paymentMethod: collection.paymentMethod || "",
    paymentReference: collection.paymentReference || "",
    reason: reversal.reason,
    createdBy: reversal.requestedBy,
    approvedBy: approver.id,
    account: `customer:${reversal.customerId}`
  });
  entry.originalType = "Susu Deposit";
  appendLedgerEntry(state, entry);
  mirrorTransactionFromLedger(state, entry, uidFn);
  markLedgerPairReversed(state, collection.id, "collection");

  collection.reversed = true;
  collection.reversalId = reversal.id;
  collection.updatedAt = new Date().toISOString();

  reversal.status = "Approved";
  reversal.approvedBy = approver.id;
  reversal.reversalLedgerId = ledgerId;
  reversal.approvedAt = new Date().toISOString();

  return { ok: true, reversal, entry };
}

function approveTransactionReversal(state, reversal, approver, uidFn) {
  const transaction = (state.transactions || []).find((item) => item.id === reversal.originalTransactionId);
  if (!transaction || transaction.reversed) return { ok: false, error: "Original transaction not found or already reversed" };

  const direction = reverseDirectionForEntryType(reversal.originalEntryType);
  postDoubleEntry(state, {
    id: uidFn("led"),
    entryType: "Reversal",
    customerId: reversal.customerId,
    groupId: reversal.groupId,
    collectorId: reversal.collectorId,
    amount: reversal.originalAmount,
    direction,
    referenceId: transaction.id,
    referenceType: "transaction",
    receiptNo: reversal.originalReceiptNo,
    paymentMethod: transaction.paymentMethod || "Cash",
    paymentReference: transaction.paymentReference || "",
    reason: reversal.reason,
    createdBy: reversal.requestedBy,
    approvedBy: approver.id
  }, uidFn);

  markLedgerPairReversed(state, transaction.ref || transaction.id, transaction.type === "Loan Disbursement" ? "loan" : "transaction");
  transaction.reversed = true;
  transaction.reversalId = reversal.id;
  transaction.updatedAt = new Date().toISOString();

  if (transaction.type === "Loan Repayment") {
    const loan = (state.loans || []).find((item) => item.id === transaction.ref);
    if (loan) {
      loan.amountPaid = Math.max(0, Number(loan.amountPaid || 0) - Number(transaction.amount || 0));
      if (loan.amountPaid < loan.totalDue) loan.status = "Active";
    }
  }
  if (transaction.type === "Withdrawal") {
    // balance restored via reversal ledger entry
  }
  if (transaction.type === "Loan Disbursement") {
    const loan = (state.loans || []).find((item) => item.id === transaction.ref);
    if (loan) loan.status = "Reversed";
  }

  reversal.status = "Approved";
  reversal.approvedBy = approver.id;
  reversal.approvedAt = new Date().toISOString();
  return { ok: true, reversal };
}
