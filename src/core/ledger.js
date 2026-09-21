/**
 * Append-only financial ledger.
 * Balances are derived from ledger entries; transactions mirror ledger for UI compatibility.
 */

export function createLedgerEntry({
  id,
  entryType,
  customerId,
  groupId,
  collectorId,
  amount,
  amountPesewas,
  direction,
  referenceId,
  referenceType,
  receiptNo,
  paymentMethod = "",
  paymentReference = "",
  reason = "",
  createdBy,
  approvedBy = "",
  clientCreatedAt = new Date().toISOString(),
  account = "",
  pairId = ""
}) {
  const pesewas = Number.isFinite(amountPesewas) ? amountPesewas : Math.round(Number(amount || 0) * 100);
  return {
    id,
    entryType,
    customerId,
    groupId,
    collectorId,
    amount: Number(amount || 0),
    amountPesewas: pesewas,
    direction, // credit | debit
    referenceId,
    referenceType,
    receiptNo: receiptNo || "",
    paymentMethod,
    paymentReference,
    reason,
    createdBy,
    approvedBy,
    account,
    pairId,
    clientCreatedAt,
    serverCreatedAt: new Date().toISOString(),
    reversed: false,
    immutable: true
  };
}

export function appendLedgerEntry(state, entry) {
  state.ledgerEntries = state.ledgerEntries || [];
  state.ledgerEntries.push(entry);
  return entry;
}

export function ledgerBalanceForCustomer(state, customerId) {
  return (state.ledgerEntries || [])
    .filter((entry) =>
      entry.customerId === customerId
      && (!entry.account || entry.account.startsWith("customer:"))
      && !entry.reversed
    )
    .reduce((sum, entry) => {
      const pesewas = Number(entry.amountPesewas ?? Math.round(Number(entry.amount || 0) * 100));
      return sum + (entry.direction === "credit" ? pesewas : -pesewas);
    }, 0) / 100;
}

export function mirrorTransactionFromLedger(state, entry, uidFn) {
  state.transactions = state.transactions || [];
  const txType = entry.entryType === "Reversal" ? entry.originalType || entry.entryType : entry.entryType;
  state.transactions.push({
    id: uidFn("tx"),
    type: txType,
    customerId: entry.customerId,
    amount: entry.amount,
    ref: entry.referenceId,
    date: entry.clientCreatedAt.slice(0, 10),
    note: entry.reason || "",
    paymentMethod: entry.paymentMethod || "",
    paymentReference: entry.paymentReference || "",
    paymentNo: entry.receiptNo || "",
    userId: entry.createdBy,
    ledgerEntryId: entry.id,
    immutable: true,
    createdAt: entry.serverCreatedAt
  });
}
