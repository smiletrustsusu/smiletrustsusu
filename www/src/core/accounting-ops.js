/**
 * Period close, fiscal calendar, and Ghana accounting helpers.
 * Operational collection/withdrawal posting stays in double-entry.js.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { trialBalance, cashbook, ensureChartOfAccounts, isAccountingPeriodClosed, createJournalEntry } from "./accounting-reports.js";
import { canAction } from "./rbac.js";

export function defaultAccountingSettings() {
  return {
    currency: "GHS",
    fiscalYearStart: "01-01",
    fiscalYearEnd: "12-31",
    locale: "en-GH",
    timezone: "Africa/Accra",
    dateFormat: "YYYY-MM-DD"
  };
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fiscalYearBounds(date, settings = {}) {
  const day = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const startParts = String(settings.fiscalYearStart || "01-01").split("-");
  const startMonth = Number(startParts[0] || 1) - 1;
  const startDay = Number(startParts[1] || 1);
  let start = new Date(day.getFullYear(), startMonth, startDay);
  if (day < start) start = new Date(day.getFullYear() - 1, startMonth, startDay);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return {
    from: ymd(start),
    to: ymd(end)
  };
}

export function reportingPeriods(yearBounds) {
  const from = new Date(`${yearBounds.from}T00:00:00`);
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const start = new Date(from);
    start.setMonth(from.getMonth() + i);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    months.push({
      label: ymd(start).slice(0, 7),
      from: ymd(start),
      to: ymd(end)
    });
  }
  const quarters = [0, 1, 2, 3].map((q) => ({
    label: `Q${q + 1}`,
    from: months[q * 3].from,
    to: months[q * 3 + 2].to
  }));
  return { monthly: months, quarterly: quarters, annual: yearBounds };
}

export function validatePeriodClose(state, { from, to, groupIds = [] } = {}) {
  const errors = [];
  const tb = trialBalance(state, { from, to, groupIds });
  if (!tb.balanced) errors.push("Trial balance is not balanced");
  const pendingWd = (state.withdrawalRequests || []).filter((item) =>
    !["Paid", "Rejected", "Cancelled", "Reversed"].includes(item.status)
    && item.date >= from && item.date <= to
  );
  if (pendingWd.length) errors.push(`${pendingWd.length} withdrawal request(s) still pending`);
  const pendingLoans = (state.loans || []).filter((item) =>
    ["Pending", "Approved"].includes(item.status) && item.date >= from && item.date <= to
  );
  if (pendingLoans.length) errors.push(`${pendingLoans.length} loan(s) awaiting approval or disbursement`);
  const pendingAdj = (state.collectionAdjustments || []).filter((item) => item.status === "Pending");
  if (pendingAdj.length) errors.push(`${pendingAdj.length} collection adjustment(s) still pending`);
  const recDiff = Number(state.settings?.bankRecDifference || 0);
  if (Math.abs(recDiff) > 0.009) errors.push("Bank reconciliation is not balanced");
  return { ok: errors.length === 0, errors };
}

export function closeAccountingPeriod(state, { from, to, user, reason = "" } = {}) {
  if (!canAction(user, "Accounting.ClosePeriod")) return { error: "You cannot close accounting periods" };
  if (!from || !to) return { error: "Period dates are required" };
  if (isAccountingPeriodClosed(state, from) && isAccountingPeriodClosed(state, to)) {
    return { error: "This period is already closed" };
  }
  const check = validatePeriodClose(state, { from, to });
  if (!check.ok) return { error: check.errors[0], errors: check.errors };
  const period = {
    id: `${from}_${to}`,
    from,
    to,
    status: "Closed",
    closedBy: user?.id || "",
    reason: String(reason || "").trim(),
    closedAt: new Date().toISOString()
  };
  state.accountingPeriods = (state.accountingPeriods || []).filter((item) => item.id !== period.id);
  state.accountingPeriods.push(period);
  return { period };
}

export function reopenAccountingPeriod(state, periodId, user, reason = "") {
  if (!canAction(user, "Accounting.ClosePeriod")) return { error: "You cannot reopen accounting periods" };
  const period = (state.accountingPeriods || []).find((item) => item.id === periodId);
  if (!period) return { error: "Period not found" };
  period.status = "Open";
  period.reopenedBy = user?.id || "";
  period.reopenReason = String(reason || "").trim();
  period.reopenedAt = new Date().toISOString();
  return { period };
}

export function branchTrialBalance(state, branchId, range = {}) {
  return trialBalance(state, { ...range, groupIds: branchId ? [branchId] : [] });
}

export function cashFlowSummary(state, range = {}) {
  const book = cashbook(state, range);
  const inflow = book.reduce((sum, row) => sum + toPesewas(row.debit || 0), 0);
  const outflow = book.reduce((sum, row) => sum + toPesewas(row.credit || 0), 0);
  return {
    inflow: fromPesewas(inflow),
    outflow: fromPesewas(outflow),
    net: fromPesewas(inflow - outflow)
  };
}

export function ghanaAccountingReady(state) {
  const chart = ensureChartOfAccounts(state);
  const currency = state.settings?.currency || "GHS";
  return {
    currency,
    accounts: chart.length,
    hasSavingsControl: chart.some((item) => item.code === "1100"),
    hasTaxLiability: chart.some((item) => item.code === "2200"),
    hasMtnFloat: chart.some((item) => item.code === "1011")
  };
}

/** Balanced tax posting for a taxable charge. Not used unless a tax amount is present. */
export function postTaxAccountingEntry(state, {
  date,
  taxResult,
  baseAmount,
  debitAccount = "1000",
  createdBy = "",
  narration = ""
} = {}, uid) {
  const taxAmount = Number(taxResult?.taxAmount || 0);
  if (!taxAmount) return { skipped: true };
  const base = Number(baseAmount || 0);
  return createJournalEntry(state, {
    date,
    narration: narration || `Tax ${taxResult.taxCode || ""}`.trim(),
    createdBy,
    lines: [
      { accountCode: debitAccount, debit: +(base + taxAmount).toFixed(2), credit: 0 },
      { accountCode: taxResult.incomeAccount || "4010", debit: 0, credit: base },
      { accountCode: taxResult.liabilityAccount || "2200", debit: 0, credit: taxAmount }
    ]
  }, uid);
}
