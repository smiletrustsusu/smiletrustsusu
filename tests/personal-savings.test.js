import test from "node:test";
import assert from "node:assert/strict";
import {
  missedPeriods,
  contributionStreak,
  personalSavingsSummary,
  isPersonalCustomer
} from "../src/core/personal-savings.js";
import { defaultSavingsProducts } from "../src/core/savings-products.js";

const dailyProduct = defaultSavingsProducts().find((p) => p.code === "PERS-DAILY");

test("isPersonalCustomer detects personal account types", () => {
  assert.equal(isPersonalCustomer({ savingsProductId: "prod-daily" }), true);
  assert.equal(isPersonalCustomer({ accountType: "both" }), true);
  assert.equal(isPersonalCustomer({ accountType: "susu_group" }), false);
});

test("contribution streak counts consecutive daily payments", () => {
  const collections = [
    { customerId: "c1", amount: 5, date: "2026-09-04", reversed: false, susuGroupId: "" },
    { customerId: "c1", amount: 5, date: "2026-09-03", reversed: false, susuGroupId: "" },
    { customerId: "c1", amount: 5, date: "2026-09-02", reversed: false, susuGroupId: "" }
  ];
  assert.equal(contributionStreak("c1", collections, { frequency: "Daily" }), 3);
});

test("missedPeriods flags overdue daily saver", () => {
  const customer = { id: "c1", savingsProductId: dailyProduct.id, createdAt: "2026-08-01T00:00:00.000Z" };
  const missed = missedPeriods(customer, dailyProduct, [], { asOf: "2026-09-04" });
  assert.ok(missed.overdue);
  assert.ok(missed.missedDays > 0);
});

test("personalSavingsSummary includes streak and next expected", () => {
  const customer = { id: "c1", savingsProductId: dailyProduct.id, dailyAmount: 5 };
  const collections = [
    { customerId: "c1", amount: 5, date: "2026-09-03", reversed: false, susuGroupId: "" }
  ];
  const summary = personalSavingsSummary(customer, dailyProduct, collections);
  assert.equal(summary.streak, 1);
  assert.equal(summary.lastPayment, "2026-09-03");
  assert.ok(summary.nextExpected);
});
