/**
 * Member registration CRM wizard helpers (step bucketing + next-of-kin options).
 */

export const NOK_RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Uncle",
  "Aunt",
  "Guardian",
  "Friend",
  "Other"
];

/**
 * Soft mandatory set for collector/admin member registration.
 * All other profile fields remain optional.
 */
export const MEMBER_REGISTRATION_MANDATORY_FIELDS = Object.freeze([
  "name",
  "phone",
  "ghanaCard",
  "dateOfBirth",
  "nextOfKin",
  "businessLocation",
  "passportPhoto",
  "signatureData"
]);

/** Expected top-level section titles that drive the collector/admin member wizard. */
export const MEMBER_WIZARD_SECTION_TITLES = [
  "Personal details",
  "Next of kin",
  "KYC Details",
  "Contact & identification",
  "Account & photo"
];

export function isWizardSectionTitle(el) {
  if (!el) return false;
  if (typeof el.classList?.contains === "function") {
    return el.classList.contains("section-title");
  }
  return String(el.className || "")
    .split(/\s+/)
    .includes("section-title");
}

/**
 * Split form children into wizard steps on each `.section-title` after the first bucket.
 */
export function bucketCrmWizardSteps(elements) {
  const steps = [];
  let bucket = [];
  for (const el of elements) {
    if (isWizardSectionTitle(el) && bucket.length) {
      steps.push(bucket);
      bucket = [el];
    } else {
      bucket.push(el);
    }
  }
  if (bucket.length) steps.push(bucket);
  return steps;
}

export function relationshipOptionsHtml(selected = "", escapeAttr = (v) => String(v ?? "")) {
  const current = String(selected || "").trim();
  const values = NOK_RELATIONSHIPS.slice();
  if (current && !values.includes(current)) values.push(current);
  const options = [
    `<option value="">Select relationship</option>`,
    ...values.map(
      (value) =>
        `<option value="${escapeAttr(value)}" ${value === current ? "selected" : ""}>${escapeAttr(value)}</option>`
    )
  ];
  return options.join("");
}

/** Session / local keys for member registration create mode (collector mobile). */
export const CUSTOMER_CREATE_OPEN_KEY = "customer_create_open";
export const CUSTOMER_REG_DRAFT_KEY = "customer_reg_draft";
export const EDIT_CUSTOMER_ID_KEY = "edit_customer_id";

/**
 * Create mode is open only when explicitly set to "1".
 * Missing/"0" → list-only on mobile so Register / FAB stay available after success.
 */
export function isCustomerCreateSessionOpen(sessionStore) {
  try {
    return sessionStore?.getItem?.(CUSTOMER_CREATE_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether the member registration form panel should render.
 * Desktop always shows create form; mobile shows it only when create mode is open or editing.
 */
export function shouldShowCustomerRegistrationForm({
  readOnly = false,
  isMobile = false,
  editing = false,
  createOpen = false
} = {}) {
  if (readOnly) return false;
  if (editing) return true;
  if (!isMobile) return true;
  return Boolean(createOpen);
}

/**
 * List-only mobile: show Register / + controls so collectors can start another registration.
 */
export function shouldShowRegisterAnotherControls({
  readOnly = false,
  isMobile = false,
  showRegForm = false,
  canRegister = false
} = {}) {
  if (readOnly || !canRegister) return false;
  if (showRegForm) return false;
  return Boolean(isMobile) || !showRegForm;
}

/**
 * Clear create/edit session flags and registration draft after successful register (or cancel).
 * On mobile, sets create mode closed so the member list is shown instead of the wizard.
 * Does not mutate DOM; callers should re-render afterward.
 */
export function closeCustomerRegistrationSession(sessionStore, localStore) {
  try {
    sessionStore?.setItem?.(CUSTOMER_CREATE_OPEN_KEY, "0");
    sessionStore?.removeItem?.(EDIT_CUSTOMER_ID_KEY);
  } catch {
    /* ignore */
  }
  clearCustomerRegistrationDraft(localStore);
  try {
    if (typeof document !== "undefined") document.body?.classList?.remove?.("member-wizard-open");
  } catch {
    /* ignore */
  }
}

/** Drop registration draft (never store passport/signature blobs in draft). */
export function clearCustomerRegistrationDraft(localStore) {
  try {
    localStore?.removeItem?.(CUSTOMER_REG_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Text-only draft payload — excludes photos, signatures, files, and other heavy fields
 * so repeated registrations cannot fill device storage via the draft key.
 */
export function customerRegistrationDraftFromFormData(formDataLike) {
  const raw = formDataLike && typeof formDataLike.entries === "function"
    ? Object.fromEntries(formDataLike.entries())
    : { ...(formDataLike || {}) };
  const skip = new Set([
    "passportPhoto",
    "passportPhotoData",
    "existingPassportPhoto",
    "signatureData",
    "idFrontFile",
    "idBackFile",
    "idFrontImage",
    "idBackImage",
    "benName",
    "benRelationship",
    "benShare",
    "benPhone",
    "benAddress"
  ]);
  const draft = {};
  for (const [key, value] of Object.entries(raw)) {
    if (skip.has(key)) continue;
    if (/photo|signature|image|file|dataurl/i.test(key)) continue;
    const text = String(value ?? "");
    if (text.startsWith("data:image")) continue;
    if (text.length > 2_000) continue;
    draft[key] = text;
  }
  return draft;
}

/**
 * Open member registration create mode (mobile FAB / explicit Register).
 * Clears edit id and optional draft so the wizard starts blank at step 1.
 */
export function openCustomerRegistrationSession(sessionStore, localStore) {
  try {
    sessionStore?.setItem?.(CUSTOMER_CREATE_OPEN_KEY, "1");
    sessionStore?.removeItem?.(EDIT_CUSTOMER_ID_KEY);
  } catch {
    /* ignore */
  }
  clearCustomerRegistrationDraft(localStore);
}

/**
 * Required controls in a step that should block Next when empty/invalid.
 */
export function requiredFieldsInStep(stepRoot) {
  if (!stepRoot?.querySelectorAll) return [];
  return [...stepRoot.querySelectorAll("input, select, textarea")].filter((el) => {
    if (el.disabled || el.type === "hidden" || el.type === "button" || el.type === "submit") return false;
    if (!el.required) return false;
    if (typeof el.willValidate === "boolean" && !el.willValidate) return false;
    const style = el.style;
    if (style?.display === "none" || style?.visibility === "hidden") return false;
    return true;
  });
}

/** True when signature payload looks like a drawn/uploaded image (not blank ink). */
export function isSignatureCaptured(signatureData, { minLength = 800 } = {}) {
  const value = String(signatureData || "").trim();
  if (!value) return false;
  if (value.startsWith("data:image/")) return value.length >= minLength;
  return value.length >= 2;
}

/**
 * Validate soft-mandatory member registration fields.
 * Passport/signature are required on create; optional when editing unless explicitly flagged.
 */
export function validateMemberRegistrationPayload(data = {}, { isCreate = true } = {}) {
  if (!String(data.name || "").trim()) return "Full name is required";
  if (!String(data.phone || "").trim()) return "Phone number is required";
  if (!String(data.ghanaCard || data.nationalId || data.idNumber || "").trim()) {
    return "Ghana Card number is required";
  }
  if (!String(data.dateOfBirth || "").trim()) return "Date of birth is required";
  if (!String(data.nextOfKin || "").trim()) return "Next of kin is required";
  if (!String(data.businessLocation || "").trim()) return "Location of business is required";
  if (isCreate && !String(data.passportPhoto || "").trim()) return "Passport picture is required";
  if (isCreate && !isSignatureCaptured(data.signatureData)) return "Signature is required — please sign in the box";
  return "";
}

/** Default business location from the collector’s assigned susu location / branch name. */
export function defaultBusinessLocationForCollector({
  editingBusinessLocation = "",
  isCollector = false,
  groupName = "",
  branchName = ""
} = {}) {
  const existing = String(editingBusinessLocation || "").trim();
  if (existing) return existing;
  if (!isCollector) return "";
  return String(groupName || branchName || "").trim();
}
