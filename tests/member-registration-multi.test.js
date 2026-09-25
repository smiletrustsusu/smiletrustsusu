import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  customerRegistrationDraftFromFormData,
  closeCustomerRegistrationSession,
  openCustomerRegistrationSession,
  CUSTOMER_REG_DRAFT_KEY,
  CUSTOMER_CREATE_OPEN_KEY,
  MEMBER_WIZARD_SECTION_TITLES
} from "../src/core/customer-wizard.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("registration form extras omit beneficiaries and extra phone numbers", () => {
  const source = readFileSync(join(root, "src/ui/customer-views.js"), "utf8");
  const start = source.indexOf("export function renderCustomerCrmFormExtras");
  const end = source.indexOf("export function statusBadge");
  const fn = source.slice(start, end);
  assert.doesNotMatch(fn, /Beneficiar/i);
  assert.doesNotMatch(fn, /Secondary Phone/i);
  assert.doesNotMatch(fn, /WhatsApp Number/i);
  assert.doesNotMatch(fn, /benName/);
  assert.match(fn, /Contact/);
});

test("KYC extras omit alternate phone", () => {
  const source = readFileSync(join(root, "src/ui/agency-views.js"), "utf8");
  const start = source.indexOf("export function renderCustomerKycExtras");
  const end = source.indexOf("export { roleLabel");
  const fn = source.slice(start, end);
  assert.doesNotMatch(fn, /Alternate Phone/i);
  assert.doesNotMatch(fn, /name="phoneAlt"/);
  assert.match(fn, /Signature/);
});

test("wizard section titles no longer include Beneficiaries", () => {
  assert.equal(MEMBER_WIZARD_SECTION_TITLES.includes("Beneficiaries"), false);
});

test("draft helper strips photos and signatures", () => {
  const draft = customerRegistrationDraftFromFormData({
    name: "Ama",
    phone: "0241234567",
    signatureData: `data:image/png;base64,${"A".repeat(5000)}`,
    passportPhotoData: `data:image/jpeg;base64,${"B".repeat(5000)}`,
    ghanaCard: "GHA-1"
  });
  assert.equal(draft.name, "Ama");
  assert.equal(draft.phone, "0241234567");
  assert.equal(draft.ghanaCard, "GHA-1");
  assert.equal(draft.signatureData, undefined);
  assert.equal(draft.passportPhotoData, undefined);
});

test("open/close registration session always clears draft", () => {
  const store = new Map();
  const local = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const session = {
    getItem: (k) => store.get(`s:${k}`) ?? null,
    setItem: (k, v) => store.set(`s:${k}`, String(v)),
    removeItem: (k) => store.delete(`s:${k}`)
  };
  local.setItem(CUSTOMER_REG_DRAFT_KEY, JSON.stringify({ name: "old" }));
  openCustomerRegistrationSession(session, local);
  assert.equal(session.getItem(CUSTOMER_CREATE_OPEN_KEY), "1");
  assert.equal(local.getItem(CUSTOMER_REG_DRAFT_KEY), null);
  local.setItem(CUSTOMER_REG_DRAFT_KEY, JSON.stringify({ name: "again" }));
  closeCustomerRegistrationSession(session, local);
  assert.equal(session.getItem(CUSTOMER_CREATE_OPEN_KEY), "0");
  assert.equal(local.getItem(CUSTOMER_REG_DRAFT_KEY), null);
});

test("app wires continuous register reset helpers", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /prepareNextMemberRegistration/);
  assert.match(app, /customerRegistrationDraftFromFormData/);
  assert.match(app, /resetMemberRegistrationHardware/);
  assert.doesNotMatch(app, /beneficiariesFromCustomerForm/);
});
