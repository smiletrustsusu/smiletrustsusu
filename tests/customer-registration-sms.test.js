import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueCustomerRegistrationSms,
  buildCustomerRegistrationSmsBody,
  isLiveSmsProviderConfigured
} from "../src/core/customer-registration-notify.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("welcome SMS body includes member login details", () => {
  const body = buildCustomerRegistrationSmsBody({
    name: "Ama Mensah",
    customerNumber: "CN-1001",
    accountNo: "c13000001",
    phone: "0241234567",
    portalPin: "4567"
  });
  assert.match(body, /Ama Mensah/);
  assert.match(body, /c13000001/);
  assert.match(body, /4567/);
});

test("enqueueCustomerRegistrationSms queues notification and message without live provider", () => {
  const state = { notifications: [], messages: [], settings: {} };
  const customer = {
    id: "cust-1",
    name: "Ama Mensah",
    phone: "0241234567",
    customerNumber: "CN-1001",
    accountNo: "c13000001"
  };
  const result = enqueueCustomerRegistrationSms(state, customer, {
    uid: (p) => `${p}-test`,
    runtime: {}
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "queued_no_provider");
  assert.match(result.toast, /provider not configured/i);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].event, "customer_registered");
  assert.equal(state.notifications[0].channel, "SMS");
  assert.equal(state.messages.length, 1);
  assert.match(state.messages[0].body, /c13000001/);
  assert.match(state.messages[0].body, /4567/);
  assert.equal(isLiveSmsProviderConfigured(state, {}), false);
});

test("enqueue does not throw when phone missing", () => {
  const state = { notifications: [], messages: [] };
  const result = enqueueCustomerRegistrationSms(state, { id: "c1", name: "X", phone: "" }, { uid: (p) => p });
  assert.equal(result.ok, false);
  assert.equal(result.status, "invalid_phone");
  assert.equal(state.messages.length, 0);
});

test("registration handler calls enqueueCustomerRegistrationSms", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /enqueueCustomerRegistrationSms/);
  assert.match(app, /SMS queued \(provider not configured\)|smsResult\?\.toast/);
});
