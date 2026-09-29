import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findPortalCustomer,
  verifyPortalPin,
  ensureDefaultPortalCredentials,
  portalPinFromPhone,
  portalDashboard,
  portalAccountBalance,
  portalStatement,
  normalizePortalLoginId
} from "../src/core/customer-portal.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("findPortalCustomer matches account, spaced account, and phone", () => {
  const state = {
    customers: [{
      id: "c1",
      name: "Ama",
      accountNo: "c13000001",
      customerNumber: "ST000001",
      phone: "0241234567"
    }]
  };
  assert.equal(findPortalCustomer(state, "c13000001")?.id, "c1");
  assert.equal(findPortalCustomer(state, "C13 000001")?.id, "c1");
  assert.equal(findPortalCustomer(state, "024 123 4567")?.id, "c1");
  assert.equal(findPortalCustomer(state, "233241234567")?.id, "c1");
  assert.equal(findPortalCustomer(state, "missing"), null);
});

test("verifyPortalPin accepts stored pin and phone last4", () => {
  const customer = { phone: "0241234567", portalPin: "9999" };
  assert.equal(verifyPortalPin(customer, "9999"), true);
  assert.equal(verifyPortalPin(customer, "4567"), true);
  assert.equal(verifyPortalPin(customer, "0000"), false);
  assert.equal(portalPinFromPhone("233241234567"), "4567");
});

test("portal dashboard shows collection balances when no personal product tx", () => {
  const customer = { id: "c1", name: "Ama", accountNo: "c13000001", phone: "0241234567" };
  const state = {
    customers: [customer],
    collections: [
      { id: "col1", customerId: "c1", amount: 50, date: "2026-09-20", paymentMethod: "Cash" },
      { id: "col2", customerId: "c1", amount: 30, date: "2026-09-21", paymentMethod: "Cash" }
    ],
    transactions: [],
    loans: [],
    notifications: [],
    withdrawalRequests: [],
    ledgerEntries: []
  };
  const dash = portalDashboard(state, customer);
  assert.equal(dash.contributionTotal, 80);
  assert.equal(dash.accountBalance, 80);
  assert.equal(dash.collections.length, 2);
  const statement = portalStatement(state, customer);
  assert.equal(statement.length, 2);
  assert.equal(statement[1].runningBalance, 80);
});

test("portalAccountBalance uses susu deposit transactions when present", () => {
  const state = {
    transactions: [
      { customerId: "c1", type: "Susu Deposit", amount: 100, reversed: false },
      { customerId: "c1", type: "Withdrawal", amount: 20, reversed: false }
    ],
    collections: [],
    ledgerEntries: []
  };
  assert.equal(portalAccountBalance(state, "c1"), 80);
});

test("app syncs state before portal shell and hardens login", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /function render\(\) \{\s*syncToApp\(\)/);
  assert.match(app, /function renderPortalShell[\s\S]*syncToApp\(\)/);
  assert.match(app, /handlePortalChangePin/);
  assert.match(app, /ensureDefaultPortalCredentials\(customer\)/);
  assert.equal(normalizePortalLoginId(" C13 00001 "), "c1300001");
  const customer = { phone: "0249998877" };
  ensureDefaultPortalCredentials(customer);
  assert.equal(customer.portalPin, "8877");
});
