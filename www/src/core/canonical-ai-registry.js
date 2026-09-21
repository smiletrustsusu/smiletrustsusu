/**
 * Phase 12 — Canonical AI Capability Registry (EAIADIS).
 * Source of truth for registered AI capabilities.
 * Advisory only: Module 24 Rule Engine remains deterministic authority.
 * Owning module is 29 (Enterprise AI), not 30 (Platform).
 * Does not post money or auto-approve loans. No new nav.
 */

export const AI_CAPABILITY_REGISTRY_VERSION = "1.0.0";
export const AI_CAPABILITY_ID_PATTERN = /^AI-CAP-[0-9]{3}$/;
export const AI_CAPABILITY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** Allowed capability categories (aligned with schema). */
export const AI_CAPABILITY_CATEGORIES = Object.freeze([
  "Prediction",
  "FraudDetection",
  "RiskScoring",
  "Recommendation",
  "Forecasting",
  "AnomalyDetection",
  "Explainability",
  "MLOps",
  "GovernanceSupport"
]);

export const AI_CAPABILITY_LIFECYCLE = Object.freeze([
  "Proposed",
  "Registered",
  "Validated",
  "Approved",
  "Active",
  "Suspended",
  "Retired"
]);

/**
 * Seed capability: Loan Default Prediction (AI-CAP-001).
 * relatedModules: Loan=8, AI=29 (not 30).
 */
export const AI_CAP_001 = Object.freeze({
  id: "AI-CAP-001",
  code: "LOAN_DEFAULT_PREDICTION",
  name: "Loan Default Prediction",
  description:
    "Advisory heuristic that estimates loan default probability from repayment and risk features. Requires human review. Does not post money or approve loans.",
  category: "Prediction",
  subcategory: "CreditRisk",
  version: "1.0.0",
  lifecycleState: "Active",
  decisionMode: "advisory",
  humanReviewRequired: true,
  autoExecuteAllowed: false,
  canPostMoney: false,
  canApproveLoans: false,
  replacesRuleEngine: false,
  owningModule: 29,
  relatedModules: Object.freeze([8, 29]),
  accountableAuthority: "Risk Manager",
  businessOwner: "Loan Operations",
  technicalOwner: "ML Engineer",
  riskLevel: "High",
  dataClassification: "Confidential",
  modelRefs: Object.freeze(["MDL-LOAN-DEFAULT-001"]),
  featureRefs: Object.freeze(["FEAT-LON-REPAY-RATIO", "FEAT-LON-DPD", "FEAT-BRH-RISK"]),
  crossReferences: Object.freeze({
    contracts: Object.freeze(["Ai.Predict.v1", "Ai.Risk.Score.v1"]),
    events: Object.freeze(["PredictionGenerated"]),
    permissions: Object.freeze(["AI.Prediction.Run", "AI.Prediction.Explain"]),
    documents: Object.freeze([
      "docs/enterprise-ai.md",
      "docs/enterprise-ai-automation-decision.md"
    ]),
    ruleEngineModule: 24
  }),
  governance: Object.freeze({
    governanceId: "AI-GOV-001",
    riskClass: "High",
    approvalStatus: "Approved",
    approvingAuthority: "Model Validator",
    accountableAuthority: "Risk Manager",
    responsibleParty: "ML Engineer",
    humanOversightRequired: true,
    exceptionRequired: false,
    sodProfile: Object.freeze({
      approverMustDifferFromAuditor: true,
      developerMustDifferFromValidator: true,
      deployerMustDifferFromSoleApprover: true
    })
  }),
  audit: Object.freeze({
    auditId: "AI-AUD-001",
    auditStatus: "Passed",
    auditor: "Internal Auditor",
    auditTrailRequired: true,
    retentionDays: 2555,
    findingsOpen: 0
  })
});

/** Canonical registry seed list — expand via registerAiCapability. */
export const AI_CAPABILITY_REGISTRY = Object.freeze([AI_CAP_001]);

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

export function listAiCapabilities() {
  return AI_CAPABILITY_REGISTRY.map((item) => ({ ...item }));
}

export function getAiCapability(idOrCode) {
  const key = String(idOrCode || "").trim();
  return (
    AI_CAPABILITY_REGISTRY.find((item) => item.id === key || item.code === key) || null
  );
}

export function assertAiCapabilityIdUnique(entries = AI_CAPABILITY_REGISTRY) {
  const ids = entries.map((e) => e.id);
  const codes = entries.map((e) => e.code);
  const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
  const dupCode = codes.find((code, i) => codes.indexOf(code) !== i);
  if (dupId) return err("AI-CAP-REG-001", `Duplicate capability id: ${dupId}`);
  if (dupCode) return err("AI-CAP-REG-002", `Duplicate capability code: ${dupCode}`);
  return ok({ count: entries.length });
}

export function validateAiCapabilityEntry(entry = {}) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return err("AI-CAP-REG-010", "Capability entry must be an object");
  }
  if (!AI_CAPABILITY_ID_PATTERN.test(String(entry.id || ""))) {
    errors.push({ path: "id", message: "id must match ^AI-CAP-[0-9]{3}$" });
  }
  if (!AI_CAPABILITY_CODE_PATTERN.test(String(entry.code || ""))) {
    errors.push({ path: "code", message: "code must be UPPER_SNAKE" });
  }
  if (entry.decisionMode !== "advisory") {
    errors.push({ path: "decisionMode", message: "decisionMode must be advisory" });
  }
  if (entry.humanReviewRequired !== true) {
    errors.push({ path: "humanReviewRequired", message: "humanReviewRequired must be true" });
  }
  if (entry.autoExecuteAllowed !== false) {
    errors.push({ path: "autoExecuteAllowed", message: "autoExecuteAllowed must be false" });
  }
  if (entry.canPostMoney !== false) {
    errors.push({ path: "canPostMoney", message: "canPostMoney must be false" });
  }
  if (entry.canApproveLoans !== false) {
    errors.push({ path: "canApproveLoans", message: "canApproveLoans must be false" });
  }
  if (entry.replacesRuleEngine !== false) {
    errors.push({ path: "replacesRuleEngine", message: "replacesRuleEngine must be false" });
  }
  if (entry.owningModule !== 29) {
    errors.push({ path: "owningModule", message: "owningModule must be 29 (not 30)" });
  }
  if (!Array.isArray(entry.relatedModules) || !entry.relatedModules.includes(29)) {
    errors.push({ path: "relatedModules", message: "relatedModules must include 29" });
  }
  if (entry.category === "Prediction" && entry.code === "LOAN_DEFAULT_PREDICTION") {
    if (!Array.isArray(entry.relatedModules) || !entry.relatedModules.includes(8)) {
      errors.push({ path: "relatedModules", message: "Loan default prediction must include module 8" });
    }
  }
  if (!entry.accountableAuthority || typeof entry.accountableAuthority !== "string") {
    errors.push({ path: "accountableAuthority", message: "accountableAuthority is required" });
  }
  if (
    entry.governance &&
    entry.governance.accountableAuthority &&
    entry.accountableAuthority !== entry.governance.accountableAuthority
  ) {
    errors.push({
      path: "accountableAuthority",
      message: "accountableAuthority must match governance.accountableAuthority"
    });
  }
  if (!AI_CAPABILITY_CATEGORIES.includes(entry.category)) {
    errors.push({ path: "category", message: "Invalid category" });
  }
  if (!AI_CAPABILITY_LIFECYCLE.includes(entry.lifecycleState)) {
    errors.push({ path: "lifecycleState", message: "Invalid lifecycleState" });
  }
  if (errors.length) return err("AI-CAP-REG-011", "Capability validation failed", { errors });
  return ok({ entry });
}

export function assertAiCapabilityRegistryIntegrity(entries = AI_CAPABILITY_REGISTRY) {
  const unique = assertAiCapabilityIdUnique(entries);
  if (!unique.ok) return unique;
  for (const entry of entries) {
    const result = validateAiCapabilityEntry(entry);
    if (!result.ok) return result;
  }
  return ok({ count: entries.length, version: AI_CAPABILITY_REGISTRY_VERSION });
}

export function assertCanonicalAiRegistryBoundary() {
  return Object.freeze({
    advisory: true,
    humanReviewRequired: true,
    postsCollections: false,
    autoApprovesLoans: false,
    replacesRuleEngine: false,
    ruleEngineModule: 24,
    owningModule: 29,
    platformModuleNotOwner: 30,
    registryVersion: AI_CAPABILITY_REGISTRY_VERSION
  });
}
