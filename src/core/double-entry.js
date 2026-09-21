/**
 * Double-entry ledger: every customer movement has a matching cash/channel entry.
 * Amounts stored as integer pesewas internally; display uses fromPesewas.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { appendLedgerEntry, createLedgerEntry, mirrorTransactionFromLedger } from "./ledger.js";

export const CASH_ACCOUNT = "account:cash";
export const MOMO_ACCOUNT = "account:momo";
export const BANK_ACCOUNT = "account:bank";
export const POS_ACCOUNT = "account:pos";

export function channelAccountForMethod(paymentMethod = "Cash") {
  const method = String(paymentMethod || "Cash");
  if (/mobile money|mtn|telecel|airteltigo|momo/i.test(method)) return MOMO_ACCOUNT;
  if (method === "Bank Transfer") return BANK_ACCOUNT;
  if (method === "POS/Card") return POS_ACCOUNT;
  return CASH_ACCOUNT;
}

export function postDoubleEntry(state, {
  id,
  entryType,
  customerId,
  groupId,
  collectorId,
  amount,
  direction,
  referenceId,
  referenceType,
  receiptNo,
  paymentMethod = "Cash",
  paymentReference = "",
  reason = "",
  createdBy,
  approvedBy = "",
  clientCreatedAt = new Date().toISOString()
}, uidFn) {
  const pesewas = toPesewas(amount);
  const customerEntry = createLedgerEntry({
    id: id || uidFn("led"),
    entryType,
    customerId,
    groupId,
    collectorId,
    amount: fromPesewas(pesewas),
    amountPesewas: pesewas,
    direction,
    referenceId,
    referenceType,
    receiptNo,
    paymentMethod,
    paymentReference,
    reason,
    createdBy,
    approvedBy,
    clientCreatedAt
  });
  customerEntry.account = `customer:${customerId}`;

  const channelAccount = channelAccountForMethod(paymentMethod);
  const offsetDirection = direction === "credit" ? "debit" : "credit";
  const offsetEntry = createLedgerEntry({
    id: uidFn("led"),
    entryType,
    customerId: "",
    groupId,
    collectorId,
    amount: fromPesewas(pesewas),
    amountPesewas: pesewas,
    direction: offsetDirection,
    referenceId,
    referenceType,
    receiptNo,
    paymentMethod,
    paymentReference,
    reason,
    createdBy,
    approvedBy,
    clientCreatedAt
  });
  offsetEntry.account = channelAccount;
  offsetEntry.pairId = customerEntry.id;
  customerEntry.pairId = offsetEntry.id;

  appendLedgerEntry(state, customerEntry);
  appendLedgerEntry(state, offsetEntry);
  mirrorTransactionFromLedger(state, customerEntry, uidFn);
  return { customerEntry, offsetEntry };
}

export function markLedgerPairReversed(state, referenceId, referenceType) {
  (state.ledgerEntries || []).forEach((entry) => {
    if (entry.referenceId === referenceId && entry.referenceType === referenceType) {
      entry.reversed = true;
    }
  });
}

export function cashPositionPesewas(state, { groupIds = [] } = {}) {
  const accounts = [CASH_ACCOUNT, MOMO_ACCOUNT, BANK_ACCOUNT, POS_ACCOUNT];
  return (state.ledgerEntries || [])
    .filter((entry) => accounts.includes(entry.account) && !entry.reversed)
    .filter((entry) => !groupIds.length || groupIds.includes(entry.groupId))
    .reduce((sum, entry) => {
      const pesewas = Number(entry.amountPesewas ?? toPesewas(entry.amount));
      return sum + (entry.direction === "debit" ? pesewas : -pesewas);
    }, 0);
}
