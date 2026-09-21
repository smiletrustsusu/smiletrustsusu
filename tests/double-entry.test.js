import test from "node:test";
import assert from "node:assert/strict";
import { postDoubleEntry, cashPositionPesewas, CASH_ACCOUNT } from "../src/core/double-entry.js";

function uid(prefix) {
  return `${prefix}-1`;
}

test("postDoubleEntry creates paired customer and cash entries", () => {
  const state = { ledgerEntries: [], transactions: [] };
  postDoubleEntry(state, {
    id: "led-1",
    entryType: "Susu Deposit",
    customerId: "c1",
    groupId: "g1",
    collectorId: "u1",
    amount: 10,
    direction: "credit",
    referenceId: "col-1",
    referenceType: "collection",
    receiptNo: "RCP-001",
    paymentMethod: "Cash",
    createdBy: "u1"
  }, uid);
  assert.equal(state.ledgerEntries.length, 2);
  assert.equal(state.ledgerEntries[0].account, "customer:c1");
  assert.equal(state.ledgerEntries[1].account, CASH_ACCOUNT);
  assert.equal(state.transactions.length, 1);
});

test("cashPositionPesewas tracks channel account net", () => {
  const state = {
    ledgerEntries: [
      { account: CASH_ACCOUNT, amountPesewas: 1000, direction: "debit", reversed: false },
      { account: CASH_ACCOUNT, amountPesewas: 300, direction: "credit", reversed: false }
    ]
  };
  assert.equal(cashPositionPesewas(state), 700);
});
