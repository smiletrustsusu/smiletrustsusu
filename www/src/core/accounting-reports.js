/**
 * Chart of accounts, journals, trial balance, P&L, balance sheet, cashbook.
 * Built from the append-only double-entry ledger (pesewas).
 */
import { toPesewas, fromPesewas } from "./money.js";
import { CASH_ACCOUNT, MOMO_ACCOUNT, BANK_ACCOUNT, POS_ACCOUNT } from "./double-entry.js";

export const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"];

export function defaultChartOfAccounts() {
  return [
    { code: "1000", name: "Cash on Hand", type: "Asset", systemAccount: CASH_ACCOUNT },
    { code: "1005", name: "Branch Cash", type: "Asset", systemAccount: CASH_ACCOUNT },
    { code: "1010", name: "Mobile Money", type: "Asset", systemAccount: MOMO_ACCOUNT },
    { code: "1011", name: "MTN Mobile Money Float", type: "Asset", systemAccount: MOMO_ACCOUNT },
    { code: "1012", name: "Telecel Cash Float", type: "Asset", systemAccount: MOMO_ACCOUNT },
    { code: "1013", name: "AirtelTigo Money Float", type: "Asset", systemAccount: MOMO_ACCOUNT },
    { code: "1020", name: "Bank", type: "Asset", systemAccount: BANK_ACCOUNT },
    { code: "1030", name: "POS / Card", type: "Asset", systemAccount: POS_ACCOUNT },
    { code: "1100", name: "Customer Savings Control", type: "Liability", systemAccount: "control:savings" },
    { code: "1110", name: "Fixed Savings Liability", type: "Liability", systemAccount: "control:fixed_savings" },
    { code: "1120", name: "Group Savings Liability", type: "Liability", systemAccount: "control:group_savings" },
    { code: "1130", name: "Group Welfare Fund", type: "Liability", systemAccount: "control:welfare" },
    { code: "1140", name: "Group Share Capital", type: "Liability", systemAccount: "control:shares" },
    { code: "1150", name: "Group Loan Fund", type: "Liability", systemAccount: "control:group_loan_fund" },
    { code: "1200", name: "Customer Loans", type: "Asset", systemAccount: "control:loans" },
    { code: "1210", name: "Interest Receivable", type: "Asset", systemAccount: "asset:interest_receivable" },
    { code: "1300", name: "Accounts Receivable", type: "Asset", systemAccount: "asset:receivable" },
    { code: "1400", name: "Fixed Assets", type: "Asset", systemAccount: "asset:fixed" },
    { code: "1500", name: "Investments", type: "Asset", systemAccount: "asset:investments" },
    { code: "2000", name: "Suspense", type: "Liability", systemAccount: "account:suspense" },
    { code: "2100", name: "Loan Insurance Payable", type: "Liability", systemAccount: "liability:insurance" },
    { code: "2200", name: "Taxes Payable", type: "Liability", systemAccount: "liability:tax" },
    { code: "2300", name: "Accounts Payable", type: "Liability", systemAccount: "liability:payable" },
    { code: "3000", name: "Retained Earnings", type: "Equity", systemAccount: "equity:retained" },
    { code: "3100", name: "Owner's Capital", type: "Equity", systemAccount: "equity:capital" },
    { code: "3200", name: "Current Year Profit", type: "Equity", systemAccount: "equity:profit" },
    { code: "3300", name: "Reserves", type: "Equity", systemAccount: "equity:reserves" },
    { code: "4000", name: "Interest Income", type: "Income", systemAccount: "income:interest" },
    { code: "4010", name: "Fee Income", type: "Income", systemAccount: "income:fees" },
    { code: "4020", name: "Withdrawal Charges", type: "Income", systemAccount: "income:withdrawal_charges" },
    { code: "4030", name: "Penalty Income", type: "Income", systemAccount: "income:penalty" },
    { code: "4040", name: "Membership Fees", type: "Income", systemAccount: "income:membership" },
    { code: "4050", name: "Registration Fees", type: "Income", systemAccount: "income:registration" },
    { code: "4060", name: "Commission Income", type: "Income", systemAccount: "income:commission" },
    { code: "4090", name: "Other Income", type: "Income", systemAccount: "income:other" },
    { code: "5000", name: "Operating Expenses", type: "Expense", systemAccount: "expense:operating" },
    { code: "5100", name: "Salaries", type: "Expense", systemAccount: "expense:salaries" },
    { code: "5200", name: "Fuel & Transport", type: "Expense", systemAccount: "expense:transport" },
    { code: "5300", name: "Office Rent", type: "Expense", systemAccount: "expense:rent" },
    { code: "5310", name: "Electricity", type: "Expense", systemAccount: "expense:electricity" },
    { code: "5320", name: "Water", type: "Expense", systemAccount: "expense:water" },
    { code: "5330", name: "Internet", type: "Expense", systemAccount: "expense:internet" },
    { code: "5340", name: "Stationery", type: "Expense", systemAccount: "expense:stationery" },
    { code: "5350", name: "Maintenance", type: "Expense", systemAccount: "expense:maintenance" },
    { code: "5360", name: "Bank Charges", type: "Expense", systemAccount: "expense:bank" },
    { code: "5370", name: "Mobile Money Charges", type: "Expense", systemAccount: "expense:momo" },
    { code: "5380", name: "Depreciation", type: "Expense", systemAccount: "expense:depreciation" },
    { code: "5390", name: "Taxes", type: "Expense", systemAccount: "expense:tax" },
    { code: "5400", name: "Miscellaneous Expenses", type: "Expense", systemAccount: "expense:misc" }
  ];
}

export function ensureChartOfAccounts(state) {
  const defaults = defaultChartOfAccounts();
  state.chartOfAccounts = state.chartOfAccounts || [];
  const have = new Set(state.chartOfAccounts.map((item) => item.code));
  defaults.forEach((account) => {
    if (!have.has(account.code)) state.chartOfAccounts.push(account);
  });
  if (!state.chartOfAccounts.length) state.chartOfAccounts = defaults;
  return state.chartOfAccounts;
}

export function accountForLedgerEntry(entry, chart) {
  if (entry.account && String(entry.account).startsWith("customer:")) {
    return chart.find((item) => item.code === "1100") || null;
  }
  return chart.find((item) => item.systemAccount === entry.account) || null;
}

export function trialBalance(state, { from = "", to = "", groupIds = [] } = {}) {
  const chart = ensureChartOfAccounts(state);
  const balances = Object.fromEntries(chart.map((account) => [account.code, { ...account, debitPesewas: 0, creditPesewas: 0 }]));
  (state.ledgerEntries || []).forEach((entry) => {
    if (entry.reversed) return;
    if (from && String(entry.clientCreatedAt || entry.date || "").slice(0, 10) < from) return;
    if (to && String(entry.clientCreatedAt || entry.date || "").slice(0, 10) > to) return;
    if (groupIds.length && entry.groupId && !groupIds.includes(entry.groupId)) return;
    const account = accountForLedgerEntry(entry, chart);
    if (!account || !balances[account.code]) return;
    const pesewas = Number(entry.amountPesewas ?? toPesewas(entry.amount));
    if (entry.direction === "debit") balances[account.code].debitPesewas += pesewas;
    else balances[account.code].creditPesewas += pesewas;
  });
  const rows = Object.values(balances).map((row) => ({
    ...row,
    debit: fromPesewas(row.debitPesewas),
    credit: fromPesewas(row.creditPesewas),
    net: fromPesewas(row.debitPesewas - row.creditPesewas)
  }));
  const totalDebit = rows.reduce((sum, row) => sum + row.debitPesewas, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.creditPesewas, 0);
  return {
    rows,
    totalDebit: fromPesewas(totalDebit),
    totalCredit: fromPesewas(totalCredit),
    balanced: totalDebit === totalCredit
  };
}

export function incomeStatement(state, range = {}) {
  const tb = trialBalance(state, range);
  const income = tb.rows.filter((row) => row.type === "Income");
  const expense = tb.rows.filter((row) => row.type === "Expense");
  const incomeTotal = income.reduce((sum, row) => sum + row.creditPesewas - row.debitPesewas, 0);
  const expenseTotal = expense.reduce((sum, row) => sum + row.debitPesewas - row.creditPesewas, 0);
  return {
    income: income.map((row) => ({ ...row, amount: fromPesewas(row.creditPesewas - row.debitPesewas) })),
    expenses: expense.map((row) => ({ ...row, amount: fromPesewas(row.debitPesewas - row.creditPesewas) })),
    incomeTotal: fromPesewas(incomeTotal),
    expenseTotal: fromPesewas(expenseTotal),
    netIncome: fromPesewas(incomeTotal - expenseTotal)
  };
}

export function balanceSheet(state, range = {}) {
  const tb = trialBalance(state, range);
  const byType = (type) => tb.rows.filter((row) => row.type === type);
  const assets = byType("Asset").map((row) => ({ ...row, amount: fromPesewas(row.debitPesewas - row.creditPesewas) }));
  const liabilities = byType("Liability").map((row) => ({ ...row, amount: fromPesewas(row.creditPesewas - row.debitPesewas) }));
  const equity = byType("Equity").map((row) => ({ ...row, amount: fromPesewas(row.creditPesewas - row.debitPesewas) }));
  const assetTotal = assets.reduce((sum, row) => sum + toPesewas(row.amount), 0);
  const liabilityTotal = liabilities.reduce((sum, row) => sum + toPesewas(row.amount), 0);
  const equityTotal = equity.reduce((sum, row) => sum + toPesewas(row.amount), 0);
  return {
    assets,
    liabilities,
    equity,
    assetTotal: fromPesewas(assetTotal),
    liabilityTotal: fromPesewas(liabilityTotal),
    equityTotal: fromPesewas(equityTotal),
    balanced: assetTotal === liabilityTotal + equityTotal
  };
}

export function cashbook(state, { from = "", to = "", groupIds = [] } = {}) {
  const cashAccounts = [CASH_ACCOUNT, MOMO_ACCOUNT, BANK_ACCOUNT, POS_ACCOUNT];
  return (state.ledgerEntries || [])
    .filter((entry) => cashAccounts.includes(entry.account) && !entry.reversed)
    .filter((entry) => {
      const date = String(entry.clientCreatedAt || entry.date || "").slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (groupIds.length && entry.groupId && !groupIds.includes(entry.groupId)) return false;
      return true;
    })
    .sort((a, b) => String(a.clientCreatedAt).localeCompare(String(b.clientCreatedAt)))
    .map((entry) => ({
      date: String(entry.clientCreatedAt || "").slice(0, 10),
      account: entry.account,
      type: entry.entryType,
      debit: entry.direction === "debit" ? fromPesewas(entry.amountPesewas ?? toPesewas(entry.amount)) : 0,
      credit: entry.direction === "credit" ? fromPesewas(entry.amountPesewas ?? toPesewas(entry.amount)) : 0,
      receiptNo: entry.receiptNo || "",
      reference: entry.referenceId || "",
      method: entry.paymentMethod || ""
    }));
}

export function isAccountingPeriodClosed(state, date) {
  const day = String(date || "").slice(0, 10);
  return (state.accountingPeriods || []).some((period) =>
    period.status === "Closed" && day && day >= period.from && day <= period.to
  );
}

export function createJournalEntry(state, { date, narration, lines, createdBy }, uid) {
  if (isAccountingPeriodClosed(state, date)) return { error: "The accounting period is closed" };
  const debit = (lines || []).reduce((sum, line) => sum + toPesewas(line.debit || 0), 0);
  const credit = (lines || []).reduce((sum, line) => sum + toPesewas(line.credit || 0), 0);
  if (debit !== credit) return { error: "Journal entry must balance" };
  if (!lines?.length) return { error: "Journal needs at least two lines" };
  const entry = {
    id: uid("jnl"),
    date,
    narration: String(narration || "").trim(),
    lines: lines.map((line) => ({
      accountCode: line.accountCode,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      memo: line.memo || ""
    })),
    createdBy: createdBy || "",
    createdAt: new Date().toISOString()
  };
  state.journalEntries = state.journalEntries || [];
  state.journalEntries.push(entry);
  return { entry };
}

export function bankReconciliation(state, { statementBalance = 0, unclearedReceipts = 0, unclearedPayments = 0 } = {}) {
  const book = cashbook(state);
  const bankLines = book.filter((row) => row.account === BANK_ACCOUNT);
  const bookBalance = bankLines.reduce((sum, row) => sum + row.debit - row.credit, 0);
  const adjustedBook = bookBalance + Number(unclearedReceipts || 0) - Number(unclearedPayments || 0);
  return {
    bookBalance: +bookBalance.toFixed(2),
    statementBalance: Number(statementBalance || 0),
    unclearedReceipts: Number(unclearedReceipts || 0),
    unclearedPayments: Number(unclearedPayments || 0),
    difference: +(Number(statementBalance || 0) - adjustedBook).toFixed(2)
  };
}
