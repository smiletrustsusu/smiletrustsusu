/**
 * GAP-005 — additional write-path guards (withdrawals / loan principal / disbursement).
 * Wave 10 — cutover timestamp recorder (no Accepted).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createWithdrawalRequest } from "../src/core/withdrawals-workflow.js";
import {
  createLoanApplication,
  advanceLoanStatus
} from "../src/core/loans-workflow.js";
import {
  createCutoverRunSheet,
  recordCutoverStepTimestamp,
  ensureCutoverNeverAccepted,
  CUTOVER_STEP_STATUS
} from "../src/core/wave10-cutover-recording.js";

const uid = (prefix) => `${prefix}-gap005`;

test("GAP-005 withdrawal create guards amountPesewas and rejects dual drift", () => {
  const state = { withdrawalRequests: [] };
  const ok = createWithdrawalRequest(
    state,
    { customerId: "c1", amount: 50, availableBalance: 100, requestedBy: "u1" },
    uid
  );
  assert.ok(ok.request);
  assert.equal(ok.request.amount, 50);
  assert.equal(ok.request.amountPesewas, 5000);

  const drift = createWithdrawalRequest(
    state,
    {
      customerId: "c1",
      amount: 10,
      amountPesewas: 999,
      availableBalance: 100,
      requestedBy: "u1"
    },
    uid
  );
  assert.match(String(drift.error || ""), /drift|integer/i);
});

test("GAP-005 loan principal create + disbursement assert principalPesewas", () => {
  const state = { loans: [] };
  const created = createLoanApplication(
    state,
    { customerId: "c1", principal: 1000, interest: 15, interestMonths: 1, createdBy: "u1" },
    uid
  );
  assert.ok(created.loan);
  assert.equal(created.loan.principal, 1000);
  assert.equal(created.loan.principalPesewas, 100000);

  const bad = createLoanApplication(
    state,
    {
      customerId: "c1",
      principal: 100,
      principalPesewas: 50,
      interest: 15,
      interestMonths: 1
    },
    uid
  );
  assert.match(String(bad.error || ""), /drift|integer/i);

  advanceLoanStatus(created.loan, "Approved", "u-mgr");
  const disbursed = advanceLoanStatus(created.loan, "Disbursed", "u-cash");
  assert.equal(disbursed.error, undefined);
  assert.equal(created.loan.status, "Active");
  assert.equal(created.loan.principalPesewas, 100000);
});

test("Wave 10 cutover recorder timestamps without Accepted", () => {
  const sheet = createCutoverRunSheet();
  assert.equal(sheet.claim.liveProductionAccepted, false);
  assert.equal(sheet.claim.cert001Certified, false);

  const rec = recordCutoverStepTimestamp(sheet, "CO-01", {
    ownerName: "Release Manager",
    notes: "rehearsal freeze"
  });
  assert.equal(rec.ok, true);
  assert.equal(rec.step.status, CUTOVER_STEP_STATUS.TIMESTAMPED);
  assert.ok(rec.step.startedAt);
  assert.ok(rec.step.freezeConfirmedAt);

  const refuse = recordCutoverStepTimestamp(sheet, "CO-02", {
    ownerName: "DBA",
    outcome: "Accepted",
    markAccepted: true
  });
  assert.equal(refuse.ok, false);
  assert.equal(refuse.error, "accepted_forbidden");

  const co13 = recordCutoverStepTimestamp(sheet, "CO-13", {
    ownerName: "Executive Sponsor",
    notes: "memo draft only"
  });
  assert.equal(co13.ok, true);
  assert.equal(co13.step.goLiveAcceptedAt, null);
  assert.match(String(co13.step.notes || ""), /PendingHumanSignOff|rehearsal/i);

  ensureCutoverNeverAccepted(sheet);
  assert.equal(sheet.claim.wave10Accepted, false);
  assert.equal(sheet.scores.liveCutoverExecuted, false);
});
