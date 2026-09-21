import test from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_STATUSES,
  LOAN_TRANSITIONS,
  TERMINAL_LOAN_STATUSES,
  canTransitionLoan,
  transitionLoanStatus,
  advanceLoanStatus,
  createLoanApplication,
  allocateRepayment,
  applyRepaymentLifecycle,
  restructureLoan,
  applyEarlySettlement,
  evaluateLoanDefault,
  loanCanApproveNow,
  loanAwaitingDisbursement,
  loanAcceptsRepayment
} from "../src/core/loans-workflow.js";

const uid = (prefix) => `${prefix}-1`;

function sampleLoan(status = "Pending", extra = {}) {
  return {
    id: "loan-1",
    customerId: "c1",
    principal: 1000,
    totalDue: 1400,
    amountPaid: 0,
    status,
    createdBy: "u-col",
    submittedBy: "u-col",
    ...extra
  };
}

test("legacy Pending → Approved → Disbursed → Active → Completed still works", () => {
  const state = { loans: [] };
  const created = createLoanApplication(state, {
    customerId: "c1",
    principal: 1000,
    interest: 10,
    interestMonths: 4,
    date: "2026-09-07",
    createdBy: "u-col"
  }, uid);
  assert.equal(created.loan.status, "Pending");
  assert.equal(loanCanApproveNow(created.loan.status), true);
  const approved = advanceLoanStatus(created.loan, "Approved", "u-mgr");
  assert.equal(approved.loan.status, "Approved");
  assert.equal(loanAwaitingDisbursement(approved.loan.status), true);
  const disbursed = advanceLoanStatus(created.loan, "Disbursed", "u-cash");
  assert.equal(disbursed.loan.status, "Active");
  assert.equal(created.loan.status, "Active");
  allocateRepayment(created.loan, created.loan.totalDue);
  assert.equal(created.loan.status, "Completed");
  assert.ok(created.loan.statusHistory.some((row) => row.previousStatus === "Pending" && row.newStatus === "Approved"));
  assert.ok(created.loan.statusHistory.some((row) => row.requestedStatus === "Disbursed" && row.newStatus === "Active"));
});

test("every matrix cell is allowed or rejected", () => {
  for (const from of Object.keys(LOAN_TRANSITIONS)) {
    for (const to of LOAN_STATUSES) {
      const loan = sampleLoan(from);
      const result = transitionLoanStatus(loan, to, { userId: "u1", reason: "Test" });
      if (from === to) {
        assert.equal(result.error, undefined, `${from} → ${to} should be a no-op`);
        assert.equal(loan.status, from);
        continue;
      }
      if ((LOAN_TRANSITIONS[from] || []).includes(to)) {
        assert.equal(result.error, undefined, `${from} → ${to} should succeed: ${result.error}`);
        assert.equal(loan.status, to === "Disbursed" ? "Active" : to);
      } else {
        assert.ok(result.error, `${from} → ${to} should be rejected`);
        assert.equal(loan.status, from);
        assert.equal(result.denial?.rejected, true);
      }
    }
  }
});

test("invalid transitions stay on the current status and record a denial", () => {
  const completed = sampleLoan("Completed");
  const back = transitionLoanStatus(completed, "Active", { userId: "u1", reason: "Fix" });
  assert.match(back.error, /cannot change status/i);
  assert.equal(completed.status, "Completed");

  const draft = sampleLoan("Draft");
  const skip = transitionLoanStatus(draft, "Approved", { userId: "u1" });
  assert.match(skip.error, /Cannot change loan from Draft to Approved/);
  assert.equal(draft.status, "Draft");

  const active = sampleLoan("Active");
  const rewind = transitionLoanStatus(active, "Pending", { userId: "u1" });
  assert.match(rewind.error, /Cannot change loan from Active to Pending/);
  assert.equal(active.status, "Active");
  assert.equal(active.deniedTransitions.length, 1);
});

test("rejected, cancelled, and written-off transitions require a reason", () => {
  const pending = sampleLoan("Pending");
  const rejected = transitionLoanStatus(pending, "Rejected", { userId: "u-mgr" });
  assert.match(rejected.error, /Reason is required/);
  assert.equal(pending.status, "Pending");

  const ok = transitionLoanStatus(pending, "Rejected", { userId: "u-mgr", reason: "Failed KYC", role: "Admin" });
  assert.equal(ok.loan.status, "Rejected");
  assert.equal(ok.transition.reason, "Failed KYC");
  assert.equal(ok.loan.rejectedBy, "u-mgr");
  assert.equal(ok.transition.role, "Admin");

  const approved = sampleLoan("Approved");
  assert.match(transitionLoanStatus(approved, "Cancelled", { userId: "u-mgr" }).error, /Reason is required/);
  const cancelled = transitionLoanStatus(approved, "Cancelled", { userId: "u-mgr", reason: "Customer withdrew" });
  assert.equal(cancelled.loan.status, "Cancelled");
});

test("approval limits, documents, and maker-checker are enforced", () => {
  const loan = sampleLoan("Pending", { principal: 50000 });
  const limited = transitionLoanStatus(loan, "Approved", { userId: "u-mgr", approvalLimit: 20000 });
  assert.match(limited.error, /approval limit/);
  assert.equal(loan.status, "Pending");

  const forbidden = transitionLoanStatus(loan, "Approved", { userId: "u-mgr", canApprove: false });
  assert.match(forbidden.error, /cannot approve/i);

  const maker = transitionLoanStatus(loan, "Approved", {
    userId: "u-col",
    requireMakerChecker: true
  });
  assert.match(maker.error, /submitter cannot approve/i);

  const approved = sampleLoan("Approved");
  const docs = transitionLoanStatus(approved, "Disbursed", {
    userId: "u-cash",
    requireDocuments: true,
    documentsComplete: false
  });
  assert.match(docs.error, /documents are required/);
  assert.equal(approved.status, "Approved");

  const ready = transitionLoanStatus(sampleLoan("Approved"), "Disbursed", {
    userId: "u-cash",
    canDisburse: false
  });
  assert.match(ready.error, /cannot disburse/i);
});

test("automatic lifecycle: default, recover, restructure, and full repayment", () => {
  const loan = sampleLoan("Active", { totalDue: 500, amountPaid: 0 });
  assert.equal(evaluateLoanDefault(loan, { overdueDays: 10, thresholdDays: 90 }).loan.status, "Active");
  assert.equal(evaluateLoanDefault(loan, { overdueDays: 120, thresholdDays: 90 }).loan.status, "Defaulted");

  loan.amountPaid = 50;
  applyRepaymentLifecycle(loan);
  assert.equal(loan.status, "Recovered");

  loan.amountPaid = 500;
  applyRepaymentLifecycle(loan);
  assert.equal(loan.status, "Completed");

  const live = sampleLoan("Active", { totalDue: 800, amountPaid: 200, interest: 10, interestMonths: 4 });
  const restructured = restructureLoan(live, { months: 3, interest: 8, userId: "u-mgr", reason: "Hardship" });
  assert.equal(restructured.loan.status, "Restructured");
  assert.ok(restructured.loan.restructureHistory[0].previousSchedule);
  allocateRepayment(restructured.loan, 50);
  assert.equal(restructured.loan.status, "Restructured");
  assert.ok(loanAcceptsRepayment("Restructured"));
});

test("written-off loans accept recovery then complete; cancelled loans stay immutable", () => {
  const loan = sampleLoan("Defaulted", { totalDue: 400, amountPaid: 0 });
  const written = transitionLoanStatus(loan, "Written Off", { userId: "u-mgr", reason: "Uncollectable" });
  assert.equal(written.loan.status, "Written Off");
  loan.amountPaid = 400;
  applyRepaymentLifecycle(loan);
  assert.equal(loan.status, "Completed");

  const cancelled = sampleLoan("Cancelled");
  assert.match(transitionLoanStatus(cancelled, "Approved", { userId: "u-mgr" }).error, /cannot change status/i);
  assert.equal(cancelled.status, "Cancelled");
  assert.equal(loanAcceptsRepayment("Cancelled"), false);
});

test("early settlement keeps Settled for the existing engine path", () => {
  const loan = sampleLoan("Active", { totalDue: 1000, amountPaid: 100 });
  applyEarlySettlement(loan, { userId: "u-mgr", rebatePercent: 10 });
  assert.equal(loan.status, "Settled");
  assert.ok(loan.settledAt);
});
