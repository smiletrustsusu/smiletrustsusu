import test from "node:test";
import assert from "node:assert/strict";
import {
  toPesewas,
  fromPesewas,
  formatGhs,
  sumPesewas,
  addPesewas,
  assertPesewasInteger,
  preferPesewasFromRow,
  reconcileDualMoneyRow,
  assertDualMoneyConsistent,
  guardMoneyWritePayload,
  assertCashierFloatWithinLimit,
  CASHIER_FLOAT_PESEWAS,
  PESEWAS_PER_GHS,
  INTEREST_PERCENT_DEFAULT,
  COLLECTION_DAYS_DEFAULT
} from "../src/core/money.js";

test("toPesewas rounds to integer pesewas", () => {
  assert.equal(toPesewas(1.01), 101);
  assert.equal(toPesewas(10.5), 1050);
});

test("fromPesewas converts back to cedis", () => {
  assert.equal(fromPesewas(1050), 10.5);
});

test("formatGhs displays Ghana Cedi amounts", () => {
  assert.match(formatGhs(12.5), /GHS.*12\.50/);
  assert.match(formatGhs(250, { fromPesewas: true }), /GHS.*2\.50/);
});

test("sumPesewas adds integer amounts", () => {
  assert.equal(sumPesewas([100, 250, 50]), 400);
});

test("GAP-005 mapping constants: 1 GHS = 100 pesewas; cashier 1000 GHS; 15/31", () => {
  assert.equal(PESEWAS_PER_GHS, 100);
  assert.equal(CASHIER_FLOAT_PESEWAS, 100_000);
  assert.equal(INTEREST_PERCENT_DEFAULT, 15);
  assert.equal(COLLECTION_DAYS_DEFAULT, 31);
  assert.equal(toPesewas(1000), CASHIER_FLOAT_PESEWAS);
  assert.equal(fromPesewas(CASHIER_FLOAT_PESEWAS), 1000);
});

test("assertPesewasInteger accepts integers and rejects floats", () => {
  assert.equal(assertPesewasInteger(250), 250);
  assert.throws(() => assertPesewasInteger(1.5), /integer/);
  assert.throws(() => assertPesewasInteger(-1), />= 0/);
});

test("preferPesewasFromRow prefers amountPesewas over numeric GHS", () => {
  assert.equal(preferPesewasFromRow({ amountPesewas: 150, amount: 9.99 }), 150);
  assert.equal(preferPesewasFromRow({ amount_pesewas: 200, amount: 1 }), 200);
  assert.equal(preferPesewasFromRow({ amount: 3.5 }), 350);
});

test("GAP-005 round-trip invariants for common collection amounts", () => {
  for (const ghs of [0, 0.01, 1, 15, 31, 1000, 12.34, 99.99]) {
    const p = toPesewas(ghs);
    assert.equal(assertPesewasInteger(p), p);
    assert.equal(toPesewas(fromPesewas(p)), p);
  }
  assert.equal(addPesewas(CASHIER_FLOAT_PESEWAS, toPesewas(15)), 101_500);
});

test("GAP-005 reconcileDualMoneyRow detects drift; consistent rows pass", () => {
  const ok = reconcileDualMoneyRow({ amountPesewas: 101, amount: 1.01 });
  assert.equal(ok.ok, true);
  assert.equal(ok.delta, 0);
  assert.equal(assertDualMoneyConsistent({ amountPesewas: 250, amount: 2.5 }), 250);

  const drift = reconcileDualMoneyRow({ amountPesewas: 100, amount: 1.5 });
  assert.equal(drift.ok, false);
  assert.equal(drift.delta, -50);
  assert.throws(() => assertDualMoneyConsistent({ amountPesewas: 100, amount: 1.5 }), /drift/);
});

test("GAP-005 GHS-only and pesewas-only rows are accepted", () => {
  assert.equal(assertDualMoneyConsistent({ amount: 10 }), 1000);
  assert.equal(assertDualMoneyConsistent({ amount_pesewas: 500 }), 500);
  assert.equal(reconcileDualMoneyRow({ amountPesewas: 10 }).ghsPesewas, null);
});

test("GAP-005 guardMoneyWritePayload normalizes and rejects drift", () => {
  const fromGhs = guardMoneyWritePayload({ amount: 12.34 }, "collection");
  assert.equal(fromGhs.amountPesewas, 1234);
  assert.equal(fromGhs.amountGhs, 12.34);

  const fromPesewasPayload = guardMoneyWritePayload({ amountPesewas: 500 }, "deposit");
  assert.equal(fromPesewasPayload.amountPesewas, 500);
  assert.equal(fromPesewasPayload.amountGhs, 5);

  const scalar = guardMoneyWritePayload(7.5, "loanRepayment");
  assert.equal(scalar.amountPesewas, 750);

  assert.throws(
    () => guardMoneyWritePayload({ amountPesewas: 100, amount: 2 }, "collection"),
    /drift/
  );
  assert.throws(() => guardMoneyWritePayload({ amountPesewas: 1.5 }, "collection"), /integer/);
});

test("GAP-005 assertCashierFloatWithinLimit enforces 1000 GHS", () => {
  assert.equal(assertCashierFloatWithinLimit(50_000).ok, true);
  assert.equal(assertCashierFloatWithinLimit(CASHIER_FLOAT_PESEWAS).ok, true);
  assert.throws(() => assertCashierFloatWithinLimit(CASHIER_FLOAT_PESEWAS + 1), /exceeds limit/);
});
