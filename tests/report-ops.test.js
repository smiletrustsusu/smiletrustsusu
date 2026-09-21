import test from "node:test";
import assert from "node:assert/strict";
import { postDoubleEntry } from "../src/core/double-entry.js";
import { trialBalance } from "../src/core/accounting-reports.js";
import { isPostedCollection, loanRepaymentIncreasesSavings, TERM } from "../src/core/domain-terms.js";
import { deriveStatusView, derivedDisplayStatus } from "../src/core/txn-status.js";
import { assertLifecycle, canEnterApproval, canExecute, makerCheckerAllowed } from "../src/core/txn-lifecycle.js";
import {
  runReport,
  scopedState,
  financialFigures,
  collectionSuccessRate,
  loanRecoveryRate,
  portfolioAtRisk,
  agentPerformanceScore,
  runCustomReport,
  scheduleReport,
  runDueSchedules,
  kpiWeights,
  DEFAULT_KPI_WEIGHTS,
  canRunReport,
  REPORT_CATALOG
} from "../src/core/report-ops.js";

const uid = (prefix) => `${prefix}-1`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true };
const collector = { id: "u-col", role: "Collector", groupId: "g1" };

function baseState() {
  return {
    settings: { currency: "GHS" },
    users: [owner, collector, { id: "u-col-2", role: "Collector", groupId: "g2" }],
    customers: [
      { id: "c1", name: "Ama", collectorId: "u-col", groupId: "g1", active: true, memberStatus: "Active", createdAt: "2026-09-01" },
      { id: "c2", name: "Kofi", collectorId: "u-col-2", groupId: "g2", active: true, memberStatus: "Active", createdAt: "2026-09-01" }
    ],
    collections: [
      { id: "col1", customerId: "c1", groupId: "g1", amount: 50, date: "2026-09-09", paymentMethod: "Cash", userId: "u-col" },
      { id: "col2", customerId: "c2", groupId: "g2", amount: 80, date: "2026-09-09", paymentMethod: "Cash", userId: "u-col-2" },
      { id: "col3", customerId: "c1", groupId: "g1", amount: 20, date: "2026-09-09", reversed: true }
    ],
    loans: [
      { id: "ln1", customerId: "c1", groupId: "g1", principal: 100, totalDue: 115, amountPaid: 40, status: "Active", dueDate: "2026-01-01" }
    ],
    transactions: [
      { id: "tx1", customerId: "c1", type: "Withdrawal", amount: 10, date: "2026-09-09" },
      { id: "tx2", customerId: "c1", type: "Loan Repayment", amount: 40, date: "2026-09-09" }
    ],
    withdrawalRequests: [{ id: "wd1", customerId: "c1", amount: 10, status: "Requested", date: "2026-09-09" }],
    ledgerEntries: [],
    journalEntries: [],
    groups: [{ id: "g1", name: "Accra" }, { id: "g2", name: "Kumasi" }],
    branches: [{ id: "g1", name: "Accra" }, { id: "g2", name: "Kumasi" }],
    susuGroups: [],
    expenses: [],
    savingsProducts: []
  };
}

test("collections are operational events and reversed rows are not posted", () => {
  assert.equal(TERM.COLLECTION, "Collection");
  assert.equal(isPostedCollection({ amount: 50 }), true);
  assert.equal(isPostedCollection({ amount: 50, reversed: true }), false);
  assert.equal(isPostedCollection({ amount: 50, status: "Draft" }), false);
  assert.equal(loanRepaymentIncreasesSavings(), false);
});

test("lifecycle and approval are separate state machines", () => {
  assert.match(assertLifecycle("Draft", "Posted").error, /Invalid/);
  assert.equal(assertLifecycle("Draft", "Submitted").ok, true);
  assert.equal(canEnterApproval("Failed"), false);
  assert.equal(canEnterApproval("Passed"), true);
  assert.equal(canExecute({ validationStatus: "Passed", approvalStatus: "Pending", approvalRequired: true }), false);
  assert.equal(canExecute({ validationStatus: "Passed", approvalStatus: "Approved" }), true);
  assert.equal(makerCheckerAllowed("u-col", "u-col", true), false);
  assert.equal(makerCheckerAllowed("u-col", "u-mgr", true), true);
});

test("withdrawal statuses map to independent lifecycle fields", () => {
  const view = deriveStatusView({ id: "wd1", status: "Requested" }, "withdrawal");
  assert.equal(view.lifecycle_status, "Pending Approval");
  assert.equal(view.accounting_status, "Not Posted");
  assert.equal(derivedDisplayStatus(deriveStatusView({ status: "Paid" }, "withdrawal")), "Completed");
});

test("collector reports cannot include another branch customer", () => {
  const state = baseState();
  const scoped = scopedState(state, collector);
  assert.equal(scoped.customers.length, 1);
  assert.equal(scoped.customers[0].id, "c1");
  const report = runReport(state, "customer_register", { user: collector });
  assert.equal(report.rows.some((row) => row.id === "c2"), false);
  assert.equal(canRunReport(collector, REPORT_CATALOG.find((item) => item.id === "trial_balance")), false);
});

test("financial reports use the GL and reject an unbalanced trial balance", () => {
  const state = baseState();
  postDoubleEntry(state, {
    entryType: "Susu Deposit",
    customerId: "c1",
    groupId: "g1",
    amount: 50,
    direction: "credit",
    referenceId: "col1",
    referenceType: "collection",
    paymentMethod: "Cash",
    createdBy: "u-col"
  }, uid);
  const tb = trialBalance(state);
  assert.equal(tb.balanced, true);
  const figures = financialFigures(state, {}, []);
  assert.equal(figures.outstandingSavingsLiability, 50);
  state.ledgerEntries.push({
    account: "income:interest",
    amountPesewas: 1500,
    direction: "credit",
    reversed: false,
    date: "2026-09-09"
  });
  const unbalanced = runReport(state, "trial_balance", { user: owner });
  assert.match(unbalanced.error, /not balanced/i);
});

test("interest income comes from posted GL income, not repayment rows", () => {
  const state = baseState();
  state.ledgerEntries = [
    { account: "income:interest", amountPesewas: 2000, direction: "credit", reversed: false, date: "2026-09-09" },
    { account: "account:cash", amountPesewas: 2000, direction: "debit", reversed: false, date: "2026-09-09" }
  ];
  const figures = financialFigures(state, { from: "2026-09-01", to: "2026-09-30" }, []);
  assert.equal(figures.interestIncome, 20);
  assert.ok(state.transactions.some((item) => item.type === "Loan Repayment"));
});

test("KPI formulas: success rate, recovery, PAR, and configurable weights", () => {
  const state = baseState();
  assert.equal(collectionSuccessRate(state, { from: "2026-09-01", to: "2026-09-30" }) > 0, true);
  assert.equal(loanRecoveryRate(state.loans), Math.round(40 / 115 * 100));
  const par = portfolioAtRisk(state.loans, { asOf: "2026-09-09", days: 30 });
  assert.ok(par.rate > 0);
  const custom = kpiWeights({ reportKpiWeights: { agentCollection: 100, agentRecovery: 0, agentAttendance: 0, agentSatisfaction: 0 } });
  assert.equal(agentPerformanceScore({ collectionAchievement: 80, loanRecovery: 10, attendance: 10, satisfaction: 10 }, custom), 80);
  assert.equal(DEFAULT_KPI_WEIGHTS.parDays, 30);
});

test("custom reports and schedules respect permissions", () => {
  const state = baseState();
  assert.match(runCustomReport(state, { source: "collections" }, collector).error, /cannot build/i);
  const custom = runCustomReport(state, { source: "collections", fields: ["amount"] }, owner);
  assert.ok(custom.rows.length);
  assert.match(scheduleReport(state, { reportId: "collections_daily" }, collector, uid).error, /cannot schedule/i);
  const scheduled = scheduleReport(state, {
    reportId: "collections_daily",
    nextRunAt: "2020-01-01T00:00:00.000Z",
    filters: { from: "2026-09-01", to: "2026-09-30" }
  }, owner, uid);
  assert.ok(scheduled.schedule);
  const ran = runDueSchedules(state, owner, uid, "2026-09-09T12:00:00.000Z");
  assert.equal(ran.ran, 1);
  assert.equal((state.reportHistory || []).length, 1);
});

test("balance sheet generation is rejected when the equation fails", () => {
  const state = baseState();
  state.ledgerEntries = [
    { account: "account:cash", amountPesewas: 5000, direction: "debit", reversed: false, date: "2026-09-09" }
  ];
  const result = runReport(state, "balance_sheet", { user: owner });
  assert.match(result.error, /Assets = Liabilities/i);
});
