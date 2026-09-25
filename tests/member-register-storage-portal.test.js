import test from "node:test";
import assert from "node:assert/strict";
import {
  isStorageQuotaError,
  reclaimCustomerMediaSpace,
  isDataUrlImage
} from "../src/core/media-compress.js";
import {
  portalPinFromPhone,
  ensureDefaultPortalCredentials,
  verifyPortalPin
} from "../src/core/customer-portal.js";
import { buildCustomerRegistrationSmsBody } from "../src/core/customer-registration-notify.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("isStorageQuotaError detects quota failures", () => {
  assert.equal(isStorageQuotaError({ name: "QuotaExceededError", message: "x" }), true);
  assert.equal(isStorageQuotaError(new Error("Failed to execute 'setItem' on 'Storage': exceeded the quota")), true);
  assert.equal(isStorageQuotaError(new Error("network down")), false);
});

test("reclaimCustomerMediaSpace clears old ID scans first", () => {
  const big = `data:image/jpeg;base64,${"A".repeat(6000)}`;
  const state = {
    customers: [
      { id: "old", createdAt: "2020-01-01", idFrontImage: big, passportPhoto: big },
      { id: "new", createdAt: "2026-01-01", passportPhoto: big, signatureData: big }
    ]
  };
  assert.equal(reclaimCustomerMediaSpace(state, { keepCustomerId: "new" }), true);
  assert.equal(state.customers[0].idFrontImage, "");
  assert.equal(state.customers[1].passportPhoto, big);
  assert.equal(state.customers[1].signatureData, big);
});

test("portal PIN is last 4 phone digits", () => {
  assert.equal(portalPinFromPhone("024 123 4567"), "4567");
  const customer = { phone: "233241234567", accountNo: "c13000001" };
  ensureDefaultPortalCredentials(customer);
  assert.equal(customer.portalPin, "4567");
  assert.equal(verifyPortalPin(customer, "4567"), true);
  assert.equal(verifyPortalPin(customer, "0000"), false);
});

test("welcome SMS includes account and PIN", () => {
  const body = buildCustomerRegistrationSmsBody({
    name: "Ama Mensah",
    customerNumber: "CN-1001",
    accountNo: "c13000001",
    phone: "0241234567",
    portalPin: "4567"
  });
  assert.match(body, /c13000001/);
  assert.match(body, /4567/);
  assert.match(body, /Login/i);
});

test("registration path compresses media and sets portal credentials", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /compressMemberMediaBundle/);
  assert.match(app, /ensureDefaultPortalCredentials/);
  assert.match(app, /isStorageQuotaError/);
  assert.match(app, /topbarLogoutBtn/);
  assert.match(app, /confirmSignOutAllowed/);
});

test("isDataUrlImage detects images", () => {
  assert.equal(isDataUrlImage("data:image/png;base64,aaa"), true);
  assert.equal(isDataUrlImage("hello"), false);
});
