import test from "node:test";
import assert from "node:assert/strict";
import {
  ROLE,
  can,
  canAccessView,
  defaultPermissionsForRole,
  navItemsForRole,
  roleLabel,
  staffRoleOptions
} from "../src/core/roles.js";
import { createExpense, expenseTotals, validateExpense } from "../src/core/expenses.js";
import {
  createWithdrawalRequest,
  advanceWithdrawal,
  canAdvanceWithdrawal,
  nextWithdrawalAction
} from "../src/core/withdrawals-workflow.js";
import {
  createLoanApplication,
  advanceLoanStatus,
  allocateRepayment,
  restructureLoan,
  earlySettlementAmount,
  applyEarlySettlement,
  outstandingLoanBalance
} from "../src/core/loans-workflow.js";
import { trialBalance, createJournalEntry, defaultChartOfAccounts, cashbook } from "../src/core/accounting-reports.js";
import { createGroupMeeting, recordAttendance, recordMeetingLine, finalizeMeetingTotals } from "../src/core/group-meetings.js";
import { queueNotification, interpolateTemplate, birthdayCustomers } from "../src/core/notifications.js";
import { applyCustomerKyc, upsertBeneficiary, nextCustomerNumber, splitBeneficiariesValid } from "../src/core/customer-kyc.js";
import { applyAgentProfile, computeAgentCommission, capabilitiesFromAuthority, agentPerformance } from "../src/core/agents.js";
import { upsertBranch, nextBranchCode, branchPerformance } from "../src/core/branches.js";
import { verifyPortalPin, portalDashboard, setPortalPin } from "../src/core/customer-portal.js";
import { barcodeSvg, qrSvg, receiptVerifyText } from "../src/core/receipt-codes.js";
import { defaultSavingsProducts, PRODUCT_TYPES, ensureSavingsProducts } from "../src/core/savings-products.js";
import { postDoubleEntry } from "../src/core/double-entry.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

test("all agency roles have labels and default permissions", () => {
  assert.equal(roleLabel(ROLE.SYSTEM_OWNER), "System Owner");
  assert.equal(roleLabel(ROLE.SUPER_ADMIN), "Super Administrator");
  assert.equal(can({ role: ROLE.SYSTEM_OWNER }, "users"), true);
  assert.equal(roleLabel(ROLE.COLLECTOR), "Agent / Collector");
  assert.ok(staffRoleOptions().length >= 10);
  assert.equal(can({ role: ROLE.AUDITOR }, "settings"), false);
  assert.equal(can({ role: ROLE.ACCOUNTANT }, "accounting"), true);
  assert.equal(canAccessView({ role: ROLE.COLLECTOR }, "collections"), true);
  assert.ok(navItemsForRole(ROLE.SUPER_ADMIN).length > navItemsForRole(ROLE.CASHIER).length);
  assert.equal(defaultPermissionsForRole(ROLE.AUDITOR).customers, true);
  assert.equal(defaultPermissionsForRole(ROLE.AUDITOR).settings, false);
});

test("expenses validate, post, and total by category", () => {
  assert.equal(validateExpense({ category: "Fuel", amount: 0, date: "2026-09-07" }), "Amount must be greater than zero");
  const state = { expenses: [] };
  const result = createExpense(state, {
    date: "2026-09-07",
    category: "Fuel",
    amount: 120,
    recordedBy: "u1"
  }, uid);
  assert.ok(result.expense.id);
  const totals = expenseTotals(state.expenses, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(totals.count, 1);
  assert.equal(totals.total, 120);
  assert.equal(totals.byCategory.Fuel, 120);
});

test("withdrawal pipeline enforces Request → Verified → Approved → Paid", () => {
  const state = { withdrawalRequests: [] };
  const created = createWithdrawalRequest(state, {
    customerId: "c1",
    amount: 50,
    availableBalance: 80,
    requestedBy: "u-col"
  }, uid);
  assert.equal(created.request.status, "Requested");
  assert.ok(advanceWithdrawal(created.request, "Approved", "u-mgr").error);
  assert.ok(advanceWithdrawal(created.request, "Verified", "u-cso").request);
  assert.equal(nextWithdrawalAction("Verified"), "Approved");
  assert.equal(canAdvanceWithdrawal({ role: "KBA" }, created.request), true);
  advanceWithdrawal(created.request, "Approved", "u-mgr");
  advanceWithdrawal(created.request, "Paid", "u-cash");
  assert.equal(created.request.status, "Paid");
  assert.ok(created.request.receiptNo === "" || created.request.paidBy === "u-cash");
});

test("loan workflow supports schedule, repayment, restructure, and early settlement", () => {
  const state = { loans: [] };
  const created = createLoanApplication(state, {
    customerId: "c1",
    principal: 1000,
    interest: 10,
    interestMonths: 4,
    date: "2026-09-07",
    createdBy: "u-col"
  }, uid);
  assert.equal(created.loan.schedule.length, 4);
  advanceLoanStatus(created.loan, "Approved", "u-mgr");
  advanceLoanStatus(created.loan, "Disbursed", "u-cash");
  assert.equal(created.loan.status, "Active");
  allocateRepayment(created.loan, 350);
  assert.ok(outstandingLoanBalance(created.loan) < created.loan.totalDue);
  const restructure = restructureLoan(created.loan, { months: 3, interest: 8, userId: "u-mgr", reason: "Hardship" });
  assert.equal(restructure.loan.status, "Restructured");
  const quote = earlySettlementAmount(restructure.loan, 10);
  assert.ok(quote.payable < quote.outstanding);
  applyEarlySettlement(restructure.loan, { userId: "u-mgr", rebatePercent: 10 });
  assert.equal(restructure.loan.status, "Settled");
});

test("trial balance balances after double-entry collection", () => {
  const state = { ledgerEntries: [], transactions: [], chartOfAccounts: defaultChartOfAccounts() };
  postDoubleEntry(state, {
    entryType: "Susu Deposit",
    customerId: "c1",
    groupId: "g1",
    amount: 40,
    direction: "credit",
    referenceId: "col-1",
    referenceType: "collection",
    paymentMethod: "Cash",
    createdBy: "u1"
  }, uid);
  const tb = trialBalance(state);
  assert.equal(tb.balanced, true);
  assert.ok(cashbook(state).length >= 1);
  const journal = createJournalEntry(state, {
    date: "2026-09-07",
    narration: "Fuel",
    lines: [
      { accountCode: "5000", debit: 10, credit: 0 },
      { accountCode: "1000", debit: 0, credit: 10 }
    ],
    createdBy: "u1"
  }, uid);
  assert.ok(journal.entry);
  assert.ok(createJournalEntry(state, {
    date: "2026-09-07",
    narration: "Bad",
    lines: [{ accountCode: "5000", debit: 10, credit: 0 }],
    createdBy: "u1"
  }, uid).error);
});

test("group meetings capture attendance and collections", () => {
  const state = { groupMeetings: [] };
  const created = createGroupMeeting(state, { susuGroupId: "sg1", date: "2026-09-07", recordedBy: "u-col" }, uid);
  recordAttendance(created.meeting, "c1", true);
  recordAttendance(created.meeting, "c2", false);
  recordMeetingLine(created.meeting, "contributions", { customerId: "c1", amount: 20 });
  recordMeetingLine(created.meeting, "fines", { customerId: "c2", amount: 5, reason: "Late" });
  const totals = finalizeMeetingTotals(created.meeting);
  assert.equal(totals.present, 1);
  assert.equal(totals.absent, 1);
  assert.equal(totals.total, 25);
});

test("notification templates interpolate and queue", () => {
  const text = interpolateTemplate("Hi {{name}}, GHS {{amount}}", { name: "Ama", amount: "10.00" });
  assert.equal(text, "Hi Ama, GHS 10.00");
  const state = { notifications: [] };
  const queued = queueNotification(state, {
    event: "contribution_received",
    channel: "SMS",
    customerId: "c1",
    vars: { name: "Ama", amount: "10.00", receiptNo: "AG-1", balance: "40.00" },
    uid
  });
  assert.match(queued.notification.body, /Ama/);
  const bdays = birthdayCustomers([{ name: "Kojo", dateOfBirth: "1990-09-07" }], "2026-09-07");
  assert.equal(bdays.length, 1);
});

test("customer KYC, beneficiaries, and agent commission", () => {
  const customer = applyCustomerKyc({}, { name: "Ama", phone: "0241234567", ghanaCard: "GHA-1", gpsAddress: "GA-001" });
  assert.equal(customer.nationalId, "GHA-1");
  const ben = upsertBeneficiary(customer, { name: "Kofi", relationship: "Spouse", sharePercent: 100 }, uid);
  assert.ok(ben.beneficiary.id);
  assert.equal(splitBeneficiariesValid(customer.beneficiaries), true);
  assert.match(nextCustomerNumber([]), /^ST/);
  const agent = applyAgentProfile({ id: "u-col", role: "Collector" }, {
    agentCode: "AG0007",
    collectionAuthority: "both",
    commissionType: "Percentage",
    commissionRate: 5,
    dailyTarget: 200
  });
  assert.equal(agent.collectionCapabilities.susuGroupCollection, true);
  assert.equal(computeAgentCommission(agent, 100), 5);
  const perf = agentPerformance(agent, {
    collections: [{ collectorId: "u-col", amount: 80, date: "2026-09-07", paymentMethod: "Cash" }],
    customers: [{ collectorId: "u-col", active: true }],
    susuGroups: [],
    date: "2026-09-07"
  });
  assert.equal(perf.achievementPercent, 40);
  assert.deepEqual(capabilitiesFromAuthority("individual").susuGroupCollection, false);
});

test("branches, portal pin, receipts, and expanded products", () => {
  const state = { branches: [], groups: [{ id: "g1", name: "Kumasi", collectorCode: "c13" }] };
  const created = upsertBranch(state, { name: "Kumasi", code: nextBranchCode([]) }, uid);
  assert.equal(created.branch.code, "BR001");
  const perf = branchPerformance(created.branch, {
    groups: [{ id: "g1", branchId: created.branch.id }],
    customers: [{ groupId: "g1", active: true }],
    collections: [{ groupId: "g1", amount: 15, date: "2026-09-07" }],
    date: "2026-09-07"
  });
  assert.equal(perf.collected, 15);
  const customer = { id: "c1", accountNo: "c13000001", phone: "0241234567", active: true };
  assert.equal(verifyPortalPin(customer, "4567"), true);
  assert.ok(!setPortalPin(customer, "12").customer);
  setPortalPin(customer, "8899");
  assert.equal(verifyPortalPin(customer, "8899"), true);
  const dash = portalDashboard({ collections: [], transactions: [], loans: [], withdrawalRequests: [], notifications: [] }, customer);
  assert.equal(dash.savingsBalance, 0);
  assert.match(barcodeSvg("RCP-1"), /svg/);
  assert.match(qrSvg("RCP-1"), /svg/);
  assert.match(receiptVerifyText({ receiptNo: "R1", amount: 10, date: "2026-09-07", customerName: "Ama" }), /ST\|R1/);
  const products = defaultSavingsProducts();
  assert.ok(products.some((p) => p.type === PRODUCT_TYPES.FUNERAL_SAVINGS));
  assert.ok(products.some((p) => p.type === PRODUCT_TYPES.CHILD_EDUCATION));
  const seeded = { savingsProducts: products.slice(0, 2) };
  ensureSavingsProducts(seeded);
  assert.ok(seeded.savingsProducts.length > 2);
});
