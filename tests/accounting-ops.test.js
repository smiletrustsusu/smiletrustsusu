import test from "node:test";
import assert from "node:assert/strict";
import * as taxEngine from "../src/core/tax-engine.js";
import {
  applyConfiguredTax,
  upsertTaxDefinition,
  canManageTaxes,
  calculateTax
} from "../src/core/tax-engine.js";
import {
  closeAccountingPeriod,
  reopenAccountingPeriod,
  validatePeriodClose,
  fiscalYearBounds,
  ghanaAccountingReady,
  postTaxAccountingEntry,
  defaultAccountingSettings
} from "../src/core/accounting-ops.js";
import {
  trialBalance,
  createJournalEntry,
  ensureChartOfAccounts,
  defaultChartOfAccounts
} from "../src/core/accounting-reports.js";
import { postDoubleEntry } from "../src/core/double-entry.js";

const uid = (prefix) => `${prefix}-1`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true };
const collector = { id: "u-col", role: "Collector" };

test("Ghana chart merge keeps cash 1000 and adds mobile money floats", () => {
  const state = { chartOfAccounts: [{ code: "1000", name: "Cash on Hand", type: "Asset" }] };
  const chart = ensureChartOfAccounts(state);
  assert.equal(chart.find((item) => item.code === "1000")?.name, "Cash on Hand");
  assert.ok(chart.find((item) => item.code === "1011"));
  assert.ok(chart.find((item) => item.code === "1100"));
  assert.ok(chart.find((item) => item.code === "2200"));
  assert.ok(defaultChartOfAccounts().some((item) => item.code === "1000"));
  assert.equal(ghanaAccountingReady(state).currency, "GHS");
  assert.equal(defaultAccountingSettings().currency, "GHS");
});

test("trial balance still balances after a cash savings deposit", () => {
  const state = { ledgerEntries: [], transactions: [], chartOfAccounts: [] };
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
  assert.equal(state.ledgerEntries.length, 2);
});

test("no tax is applied when none are configured", () => {
  const result = applyConfiguredTax(100, { taxes: [], date: "2026-09-09" });
  assert.equal(result.taxAmount, 0);
  assert.equal(result.taxCode, "");
});

test("percentage tax calculates without changing historical postings", () => {
  const state = { taxDefinitions: [], taxConfigHistory: [] };
  const saved = upsertTaxDefinition(state, {
    code: "VAT",
    name: "Value Added Tax",
    category: "VAT",
    method: "Percentage",
    rate: 15,
    status: "Active",
    effectiveDate: "2026-01-01"
  }, owner, uid);
  assert.ok(saved.tax);
  const first = calculateTax(100, saved.tax);
  assert.equal(first.taxAmount, 15);
  const posted = { taxAmount: first.taxAmount, taxCode: first.taxCode, date: "2026-03-01" };
  upsertTaxDefinition(state, {
    ...saved.tax,
    rate: 20,
    reason: "Rate change"
  }, owner, uid);
  assert.equal(posted.taxAmount, 15);
  const next = applyConfiguredTax(100, { taxes: state.taxDefinitions, date: "2026-09-09" });
  assert.equal(next.taxAmount, 20);
  assert.equal(state.taxConfigHistory.length, 2);
});

test("collectors cannot change tax definitions", () => {
  assert.equal(canManageTaxes(collector), false);
  const result = upsertTaxDefinition({ taxDefinitions: [] }, {
    code: "VAT",
    name: "VAT",
    rate: 15,
    status: "Active"
  }, collector, uid);
  assert.match(result.error, /cannot change tax/i);
});

test("period close is blocked while a withdrawal is pending", () => {
  const state = {
    ledgerEntries: [],
    chartOfAccounts: [],
    withdrawalRequests: [{ id: "wd1", status: "Requested", date: "2026-03-01" }],
    loans: [],
    collectionAdjustments: [],
    accountingPeriods: [],
    settings: {}
  };
  const check = validatePeriodClose(state, { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(check.ok, false);
  const closed = closeAccountingPeriod(state, {
    from: "2026-01-01",
    to: "2026-12-31",
    user: owner
  });
  assert.match(closed.error, /withdrawal/i);
});

test("closed period rejects journals and collector cannot close", () => {
  const state = {
    ledgerEntries: [],
    chartOfAccounts: [],
    withdrawalRequests: [],
    loans: [],
    collectionAdjustments: [],
    accountingPeriods: [],
    journalEntries: [],
    settings: {}
  };
  assert.match(closeAccountingPeriod(state, {
    from: "2026-01-01",
    to: "2026-12-31",
    user: collector
  }).error, /cannot close/i);
  const closed = closeAccountingPeriod(state, {
    from: "2026-01-01",
    to: "2026-12-31",
    user: owner
  });
  assert.ok(closed.period);
  const blocked = createJournalEntry(state, {
    date: "2026-06-01",
    narration: "Late fuel",
    createdBy: "u1",
    lines: [
      { accountCode: "5000", debit: 10, credit: 0 },
      { accountCode: "1000", debit: 0, credit: 10 }
    ]
  }, uid);
  assert.match(blocked.error, /closed/i);
  reopenAccountingPeriod(state, closed.period.id, owner, "Correction");
  const posted = createJournalEntry(state, {
    date: "2026-06-01",
    narration: "Fuel",
    createdBy: "u1",
    lines: [
      { accountCode: "5000", debit: 10, credit: 0 },
      { accountCode: "1000", debit: 0, credit: 10 }
    ]
  }, uid);
  assert.ok(posted.entry);
});

test("tax accounting entry is balanced and GRA filing is out of scope", () => {
  const state = { journalEntries: [], accountingPeriods: [] };
  const tax = calculateTax(100, {
    code: "VAT",
    method: "Percentage",
    rate: 15,
    liabilityAccount: "2200",
    incomeAccount: "4010"
  });
  const posted = postTaxAccountingEntry(state, {
    date: "2026-09-09",
    taxResult: tax,
    baseAmount: 100,
    debitAccount: "1000",
    createdBy: "u-acc"
  }, uid);
  const debit = posted.entry.lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = posted.entry.lines.reduce((sum, line) => sum + line.credit, 0);
  assert.equal(debit, credit);
  assert.equal("fileTaxReturn" in taxEngine, false);
  assert.equal("submitToGra" in taxEngine, false);
  assert.equal(fiscalYearBounds("2026-09-09").from, "2026-01-01");
  assert.equal(fiscalYearBounds("2026-09-09").to, "2026-12-31");
});
