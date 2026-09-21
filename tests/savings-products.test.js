import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSavingsProducts,
  personalSavingsBalance,
  productPerformance,
  PRODUCT_TYPES,
  upsertProduct
} from "../src/core/savings-products.js";
import { toPesewas } from "../src/core/money.js";

test("default savings products include group susu and personal types", () => {
  const products = defaultSavingsProducts();
  assert.ok(products.length >= 4);
  assert.ok(products.some((p) => p.type === PRODUCT_TYPES.GROUP_SUSU));
  assert.ok(products.some((p) => p.type === PRODUCT_TYPES.PERSONAL_DAILY));
  assert.ok(products.some((p) => p.type === PRODUCT_TYPES.PERSONAL_WEEKLY));
});

test("personal savings balance excludes susu group collections", () => {
  const customerId = "c1";
  const collections = [
    { customerId, amount: 10, reversed: false, susuGroupId: "" },
    { customerId, amount: 5, reversed: false, susuGroupId: "sg1" }
  ];
  const balance = personalSavingsBalance(customerId, { collections, transactions: [] });
  assert.equal(balance, 10);
});

test("product performance counts paid and missed members", () => {
  const product = defaultSavingsProducts().find((p) => p.type === PRODUCT_TYPES.PERSONAL_DAILY);
  const customers = [
    { id: "c1", savingsProductId: product.id, active: true },
    { id: "c2", savingsProductId: product.id, active: true }
  ];
  const collections = [
    { customerId: "c1", savingsProductId: product.id, amount: 5, date: "2026-09-04", reversed: false, susuGroupId: "" }
  ];
  const perf = productPerformance(product, { customers, collections, date: "2026-09-04" });
  assert.equal(perf.members, 2);
  assert.equal(perf.paidMembers, 1);
  assert.equal(perf.missedMembers, 1);
});

test("upsertProduct rejects duplicate codes", () => {
  const products = defaultSavingsProducts();
  const result = upsertProduct(products, {
    code: "PERS-DAILY",
    name: "Duplicate",
    minAmount: 1
  }, () => "prod-x");
  assert.ok(result.error);
});
