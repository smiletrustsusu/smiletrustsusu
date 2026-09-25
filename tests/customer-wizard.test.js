import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMBER_REGISTRATION_MANDATORY_FIELDS,
  MEMBER_WIZARD_SECTION_TITLES,
  NOK_RELATIONSHIPS,
  bucketCrmWizardSteps,
  closeCustomerRegistrationSession,
  CUSTOMER_CREATE_OPEN_KEY,
  CUSTOMER_REG_DRAFT_KEY,
  defaultBusinessLocationForCollector,
  EDIT_CUSTOMER_ID_KEY,
  isCustomerCreateSessionOpen,
  isSignatureCaptured,
  openCustomerRegistrationSession,
  relationshipOptionsHtml,
  requiredFieldsInStep,
  shouldShowCustomerRegistrationForm,
  shouldShowRegisterAnotherControls,
  validateMemberRegistrationPayload
} from "../src/core/customer-wizard.js";
import {
  districtsForRegion,
  districtSelectOptionsHtml,
  listGhanaRegions,
  regionSelectOptionsHtml
} from "../src/core/ghana-geo.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function el(className) {
  return {
    className,
    classList: { contains: (name) => className.split(/\s+/).includes(name) }
  };
}

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
    _data: data
  };
}

const validCreatePayload = {
  name: "Ama Mensah",
  phone: "0241234567",
  ghanaCard: "GHA-123456789-0",
  dateOfBirth: "1990-01-15",
  nextOfKin: "Kofi Mensah",
  businessLocation: "Kaneshie Market",
  passportPhoto: "data:image/jpeg;base64,/9j/4AAQ",
  signatureData: `data:image/png;base64,${"A".repeat(900)}`
};

test("bucketCrmWizardSteps splits on section-title after content", () => {
  const kids = [
    el("section-title full"),
    el("field"),
    el("field"),
    el("section-title full"),
    el("field"),
    el("section-title full"),
    el("field"),
    el("form-actions full")
  ];
  const steps = bucketCrmWizardSteps(kids);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].length, 3);
  assert.equal(steps[1].length, 2);
  assert.equal(steps[2].length, 3);
});

test("member form markup declares five wizard section titles in order", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  const agency = readFileSync(join(root, "src/ui/agency-views.js"), "utf8");
  const crm = readFileSync(join(root, "src/ui/customer-views.js"), "utf8");
  const combined = `${app}\n${agency}\n${crm}`;
  for (const title of MEMBER_WIZARD_SECTION_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`<h3>${escaped.replace(/&/g, "(?:&|&amp;)")}</h3>`);
    assert.match(combined, pattern);
  }
  // Next-of-kin fields live together in memberFormFields, not scattered in KYC/CRM extras
  assert.match(app, /section-title full"><h3>Next of kin<\/h3>/);
  assert.match(app, /name="nextOfKinRelationship"/);
  assert.match(app, /name="nextOfKinPhone"/);
  assert.match(app, /name="nextOfKinOccupation"/);
  assert.doesNotMatch(agency, /name="nextOfKinPhone"/);
  assert.doesNotMatch(crm, /name="nextOfKinOccupation"/);
  assert.doesNotMatch(crm, /<h3>Identification<\/h3>/);
});

test("relationship select options include common values and custom selection", () => {
  assert.ok(NOK_RELATIONSHIPS.includes("Spouse"));
  const html = relationshipOptionsHtml("Cousin", (v) => v);
  assert.match(html, /Select relationship/);
  assert.match(html, /value="Cousin" selected/);
  assert.match(html, /value="Spouse"/);
});

test("requiredFieldsInStep filters hidden and optional controls", () => {
  const required = { required: true, disabled: false, type: "text", willValidate: true, style: {} };
  const optional = { required: false, disabled: false, type: "text", willValidate: true, style: {} };
  const hiddenType = { required: true, disabled: false, type: "hidden", willValidate: true, style: {} };
  const root = {
    querySelectorAll: () => [required, optional, hiddenType]
  };
  assert.deepEqual(requiredFieldsInStep(root), [required]);
});

test("initCustomerWizard advances with validation and updates step label", () => {
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /show\(current \+ 1, \{ validate: true \}\)/);
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /crmWizardTotal/);
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /crm-wizard-progress-top/);
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /bucketCrmWizardSteps/);
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /member-wizard-open/);
  assert.match(readFileSync(join(root, "app.js"), "utf8"), /member-summary-panel/);
});

test("mobile CSS keeps member wizard full-width and hides summary over form", () => {
  const css = readFileSync(join(root, "styles-mobile.css"), "utf8");
  assert.doesNotMatch(css, /body\.layout-mobile \* \{\s*max-width:\s*100%/);
  assert.match(css, /\.member-summary-panel/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /#customerForm\.crm-wizard/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /\.layout-mobile\.member-wizard-open \.dash-fab/);
  assert.doesNotMatch(css, /:has\(#customerForm\) \.dash-fab/);
});

test("shouldShowCustomerRegistrationForm closes on mobile after create mode off", () => {
  assert.equal(shouldShowCustomerRegistrationForm({ readOnly: true, isMobile: true, createOpen: true }), false);
  assert.equal(shouldShowCustomerRegistrationForm({ isMobile: false, createOpen: false }), true);
  assert.equal(shouldShowCustomerRegistrationForm({ isMobile: true, createOpen: false }), false);
  assert.equal(shouldShowCustomerRegistrationForm({ isMobile: true, createOpen: true }), true);
  assert.equal(shouldShowCustomerRegistrationForm({ isMobile: true, createOpen: false, editing: true }), true);
});

test("isCustomerCreateSessionOpen only true when key is 1", () => {
  const session = memoryStore({});
  assert.equal(isCustomerCreateSessionOpen(session), false);
  session.setItem(CUSTOMER_CREATE_OPEN_KEY, "0");
  assert.equal(isCustomerCreateSessionOpen(session), false);
  session.setItem(CUSTOMER_CREATE_OPEN_KEY, "1");
  assert.equal(isCustomerCreateSessionOpen(session), true);
});

test("shouldShowRegisterAnotherControls when list-only after close", () => {
  assert.equal(shouldShowRegisterAnotherControls({
    readOnly: false,
    isMobile: true,
    showRegForm: false,
    canRegister: true
  }), true);
  assert.equal(shouldShowRegisterAnotherControls({
    readOnly: false,
    isMobile: true,
    showRegForm: true,
    canRegister: true
  }), false);
  assert.equal(shouldShowRegisterAnotherControls({
    readOnly: false,
    isMobile: false,
    showRegForm: false,
    canRegister: true
  }), true);
});

test("closeCustomerRegistrationSession clears draft and closes create mode", () => {
  const session = memoryStore({ [CUSTOMER_CREATE_OPEN_KEY]: "1", [EDIT_CUSTOMER_ID_KEY]: "cust-1" });
  const local = memoryStore({ [CUSTOMER_REG_DRAFT_KEY]: JSON.stringify({ name: "Ama" }) });
  closeCustomerRegistrationSession(session, local);
  assert.equal(session.getItem(CUSTOMER_CREATE_OPEN_KEY), "0");
  assert.equal(session.getItem(EDIT_CUSTOMER_ID_KEY), null);
  assert.equal(local.getItem(CUSTOMER_REG_DRAFT_KEY), null);
  openCustomerRegistrationSession(session, local);
  assert.equal(session.getItem(CUSTOMER_CREATE_OPEN_KEY), "1");
  assert.equal(session.getItem(EDIT_CUSTOMER_ID_KEY), null);
  assert.equal(local.getItem(CUSTOMER_REG_DRAFT_KEY), null);
  assert.equal(isCustomerCreateSessionOpen(session), true);
});

test("handleCustomer success path closes registration and scrolls to member list", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /closeCustomerRegistrationSession\(sessionStorage, localStorage\)/);
  assert.match(app, /openCustomerCreateFab/);
  assert.match(app, /openCustomerCreateBtn/);
  assert.match(app, /isCustomerCreateSessionOpen/);
  assert.match(app, /shouldShowRegisterAnotherControls/);
  assert.match(app, /members-list-panel.*?scrollIntoView/s);
  assert.match(app, /Member registered/);
  assert.match(app, /enqueueCustomerRegistrationSms/);
  assert.match(app, /validateMemberRegistrationPayload/);
  assert.match(app, /initMemberSignaturePad/);
  assert.match(app, /bindRegionDistrictCascade/);
  assert.match(app, /toast\(softError\)/);
  assert.match(app, /Could not register member/);
});

test("mandatory registration fields cover soft set only", () => {
  assert.deepEqual([...MEMBER_REGISTRATION_MANDATORY_FIELDS], [
    "name",
    "phone",
    "ghanaCard",
    "dateOfBirth",
    "nextOfKin",
    "businessLocation",
    "passportPhoto",
    "signatureData"
  ]);
  assert.equal(validateMemberRegistrationPayload(validCreatePayload), "");
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, name: "" }), /Full name/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, phone: "" }), /Phone/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, ghanaCard: "" }), /Ghana Card/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, dateOfBirth: "" }), /Date of birth/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, nextOfKin: "" }), /Next of kin/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, businessLocation: "" }), /Location of business/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, passportPhoto: "" }), /Passport/);
  assert.match(validateMemberRegistrationPayload({ ...validCreatePayload, signatureData: "" }), /Signature/);
  assert.equal(validateMemberRegistrationPayload({
    ...validCreatePayload,
    passportPhoto: "",
    signatureData: ""
  }, { isCreate: false }), "");
});

test("signature capture rejects blank ink payloads", () => {
  assert.equal(isSignatureCaptured(""), false);
  assert.equal(isSignatureCaptured("data:image/png;base64,abc"), false);
  assert.equal(isSignatureCaptured(`data:image/png;base64,${"x".repeat(900)}`), true);
  assert.equal(isSignatureCaptured("initials-ok"), true);
});

test("region district cascade helpers load Ghana regions", () => {
  const regions = listGhanaRegions();
  assert.ok(regions.includes("Greater Accra"));
  assert.ok(regions.includes("Ashanti"));
  const districts = districtsForRegion("Greater Accra");
  assert.ok(districts.includes("Accra Metropolitan"));
  assert.deepEqual(districtsForRegion(""), []);
  const regionHtml = regionSelectOptionsHtml("Ashanti", (v) => v);
  assert.match(regionHtml, /Select region/);
  assert.match(regionHtml, /value="Ashanti" selected/);
  const districtHtml = districtSelectOptionsHtml("Ashanti", "Kumasi Metropolitan", (v) => v);
  assert.match(districtHtml, /Select district/);
  assert.match(districtHtml, /value="Kumasi Metropolitan" selected/);
  assert.match(districtSelectOptionsHtml("", "", (v) => v), /Select region first/);
});

test("default business location uses collector branch when empty", () => {
  assert.equal(defaultBusinessLocationForCollector({
    isCollector: true,
    groupName: "Kaneshie Route",
    branchName: "Branch A"
  }), "Kaneshie Route");
  assert.equal(defaultBusinessLocationForCollector({
    editingBusinessLocation: "Existing Shop",
    isCollector: true,
    groupName: "Kaneshie Route"
  }), "Existing Shop");
  assert.equal(defaultBusinessLocationForCollector({
    isCollector: false,
    groupName: "Kaneshie Route"
  }), "");
});

test("registration UI includes region selects and signature pad", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  const crm = readFileSync(join(root, "src/ui/customer-views.js"), "utf8");
  const agency = readFileSync(join(root, "src/ui/agency-views.js"), "utf8");
  const css = readFileSync(join(root, "styles.css"), "utf8");
  assert.match(crm, /customerRegionSelect/);
  assert.match(crm, /customerDistrictSelect/);
  assert.match(crm, /regionSelectOptionsHtml/);
  assert.match(agency, /memberSignaturePad/);
  assert.match(agency, /name="signatureData"/);
  assert.match(agency, /dateOfBirth".*required/s);
  assert.match(app, /defaultBusinessLocationForCollector/);
  assert.match(css, /\.signature-pad\b/);
});
