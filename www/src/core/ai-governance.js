/**
 * Module 29 — Enterprise AI Data Governance.
 * Roles, responsibility matrix, SoD, and role–permission matrix derived from the
 * Canonical Permission Registry (ai-permission-registry.js) — single Source of Truth.
 */

import {
  AI_PERMISSION_REGISTRY,
  listAiPermissions,
  getAiPermission,
  assertAiScopeValid,
  canAssignAiPermission,
  canDelegateAiPermission,
  evaluateAiPermission,
  assertAiSegregationOfDuties,
  permissionScopeMatrix,
  permissionAssignmentScopeMatrix,
  assertAiRegistryCompleteness
} from "./ai-permission-registry.js";
import { AI_GOVERNANCE_ROLES, DATA_CLASSIFICATIONS } from "./ai-lifecycle.js";

export const AI_GOVERNANCE_VERSION = "1.0.0";

/** Cell values: ✓ full, R read, A approve-only, — none */
const GRANT = {
  FULL: "✓",
  READ: "R",
  APPROVE: "A",
  NONE: "—"
};

/**
 * High-level role → permission grant patterns (derived mapping, not a second SoT).
 * Actual codes come exclusively from AI_PERMISSION_REGISTRY.
 */
const ROLE_FAMILY_ACCESS = Object.freeze({
  "AI Platform Admin": { Dataset: "✓", Feature: "✓", Model: "✓", Prediction: "✓", Recommendation: "✓", Governance: "✓", Platform: "✓", Pipeline: "✓", Drift: "✓", Inference: "✓" },
  "Chief Data Steward": { Dataset: "✓", Feature: "A", Model: "A", Prediction: "R", Recommendation: "R", Governance: "✓", Platform: "R", Pipeline: "A", Drift: "R", Inference: "R" },
  "Data Steward": { Dataset: "✓", Feature: "R", Model: "R", Prediction: "R", Recommendation: "R", Governance: "R", Platform: "—", Pipeline: "R", Drift: "R", Inference: "R" },
  "Data Engineer": { Dataset: "✓", Feature: "✓", Model: "R", Prediction: "R", Recommendation: "—", Governance: "R", Platform: "—", Pipeline: "R", Drift: "R", Inference: "R" },
  "ML Engineer": { Dataset: "R", Feature: "✓", Model: "✓", Prediction: "✓", Recommendation: "✓", Governance: "R", Platform: "—", Pipeline: "✓", Drift: "✓", Inference: "✓" },
  "MLOps": { Dataset: "R", Feature: "R", Model: "✓", Prediction: "R", Recommendation: "—", Governance: "R", Platform: "R", Pipeline: "✓", Drift: "✓", Inference: "✓" },
  "AI Security": { Dataset: "R", Feature: "R", Model: "R", Prediction: "R", Recommendation: "R", Governance: "✓", Platform: "R", Pipeline: "R", Drift: "✓", Inference: "R" },
  "Compliance": { Dataset: "R", Feature: "R", Model: "R", Prediction: "R", Recommendation: "R", Governance: "✓", Platform: "—", Pipeline: "R", Drift: "R", Inference: "R" },
  "Model Validator": { Dataset: "R", Feature: "A", Model: "A", Prediction: "R", Recommendation: "—", Governance: "R", Platform: "—", Pipeline: "A", Drift: "R", Inference: "R" },
  "Internal Auditor": { Dataset: "R", Feature: "R", Model: "R", Prediction: "R", Recommendation: "R", Governance: "✓", Platform: "R", Pipeline: "R", Drift: "R", Inference: "R" },
  "Business Owner": { Dataset: "R", Feature: "R", Model: "R", Prediction: "✓", Recommendation: "✓", Governance: "R", Platform: "—", Pipeline: "R", Drift: "R", Inference: "R" },
  "Risk Manager": { Dataset: "R", Feature: "R", Model: "R", Prediction: "✓", Recommendation: "✓", Governance: "✓", Platform: "—", Pipeline: "R", Drift: "✓", Inference: "R" }
});

const APPROVE_CODES = new Set(
  AI_PERMISSION_REGISTRY.filter((item) => /Approve|Validate|Deploy/.test(item.code.split(".").pop() || "")).map((item) => item.code)
);

const READ_CODES = new Set(
  AI_PERMISSION_REGISTRY.filter((item) => item.code.endsWith(".View") || item.code.endsWith(".Explain")).map((item) => item.code)
);

function cellForRolePermission(role, permission) {
  const familyAccess = ROLE_FAMILY_ACCESS[role]?.[permission.family] || GRANT.NONE;
  if (familyAccess === GRANT.NONE) return GRANT.NONE;
  if (familyAccess === GRANT.READ) return READ_CODES.has(permission.code) || permission.code.includes(".View") ? GRANT.READ : GRANT.NONE;
  if (familyAccess === GRANT.APPROVE) {
    if (APPROVE_CODES.has(permission.code) || permission.code.includes(".Approve") || permission.code.includes(".Validate")) return GRANT.APPROVE;
    if (READ_CODES.has(permission.code)) return GRANT.READ;
    return GRANT.NONE;
  }
  // Full: still block Critical Platform-only for non-platform admin roles except AI Platform Admin
  if (permission.maxScope === "Platform" && permission.riskLevel === "Critical" && role !== "AI Platform Admin" && role !== "Chief Data Steward") {
    if (permission.family === "Platform" || permission.code.includes("Configure") || permission.code.includes("Admin")) {
      return role === "AI Platform Admin" ? GRANT.FULL : GRANT.NONE;
    }
  }
  return GRANT.FULL;
}

/** Complete Role–Permission Matrix: every role × every registry permission. */
export function buildCompleteRolePermissionMatrix() {
  return AI_GOVERNANCE_ROLES.map((role) => {
    const row = { role };
    for (const perm of AI_PERMISSION_REGISTRY) {
      row[perm.code] = cellForRolePermission(role, perm);
    }
    return row;
  });
}

export function getRolePermissionCell(role, permissionCode) {
  const perm = getAiPermission(permissionCode);
  if (!perm) return GRANT.NONE;
  return cellForRolePermission(role, perm);
}

export const RESPONSIBILITY_MATRIX = Object.freeze([
  { activity: "Dataset registration", primary: "Data Steward", secondary: "Data Engineer", approver: "Chief Data Steward" },
  { activity: "Feature engineering", primary: "ML Engineer", secondary: "Data Engineer", approver: "Model Validator" },
  { activity: "Model development", primary: "ML Engineer", secondary: "MLOps", approver: "Model Validator" },
  { activity: "Model deployment", primary: "MLOps", secondary: "AI Platform Admin", approver: "Model Validator" },
  { activity: "Drift response", primary: "MLOps", secondary: "ML Engineer", approver: "Risk Manager" },
  { activity: "Fraud alert triage", primary: "Risk Manager", secondary: "AI Security", approver: "Compliance" },
  { activity: "Permission assignment", primary: "AI Platform Admin", secondary: "Chief Data Steward", approver: "Compliance" },
  { activity: "AI audit review", primary: "Internal Auditor", secondary: "Compliance", approver: "Chief Data Steward" },
  { activity: "Business recommendation accept", primary: "Business Owner", secondary: "Risk Manager", approver: "—" },
  { activity: "Platform configuration", primary: "AI Platform Admin", secondary: "MLOps", approver: "Compliance" }
]);

export const SOD_RULES = Object.freeze([
  { id: "SOD-AI-01", rule: "creator ≠ approver", description: "Artifact creator cannot approve the same artifact" },
  { id: "SOD-AI-02", rule: "developer ≠ validator", description: "ML Engineer who developed a model cannot be sole Model Validator" },
  { id: "SOD-AI-03", rule: "deployer ≠ sole approver", description: "Deployment requires independent approval" },
  { id: "SOD-AI-04", rule: "assigner ≠ self Critical", description: "Users cannot self-assign Critical AI permissions" },
  { id: "SOD-AI-05", rule: "auditor ≠ operator", description: "Internal Auditor cannot run production deploy" }
]);

export const ESCALATION_PATH = Object.freeze([
  { level: 1, role: "Business Owner", slaHours: 24 },
  { level: 2, role: "Risk Manager", slaHours: 12 },
  { level: 3, role: "Chief Data Steward", slaHours: 8 },
  { level: 4, role: "AI Platform Admin", slaHours: 4 },
  { level: 5, role: "Compliance", slaHours: 2 }
]);

export function maskSensitiveValue(value, classification, authorized = false) {
  if (classification === "Public" || classification === "Internal") return value;
  if (classification === "Restricted" && !authorized) return "***RESTRICTED***";
  if (classification === "Confidential" && !authorized) {
    const text = String(value ?? "");
    if (text.length <= 4) return "****";
    return `${text.slice(0, 2)}***${text.slice(-1)}`;
  }
  return value;
}

export function assertDatasetReadyForUse(dataset, { requireApproved = true } = {}) {
  if (!dataset) return { ok: false, error: "Dataset not found", errorCode: "AI-006" };
  if (requireApproved && dataset.status !== "approved") {
    return { ok: false, error: "Dataset must be approved before train/inference", errorCode: "AI-007" };
  }
  if (!dataset.checksum || dataset.checksumInvalid) {
    return { ok: false, error: "Dataset checksum missing or invalid", errorCode: "AI-007" };
  }
  if (Number(dataset.qualityScore || 0) < 0.5) {
    return { ok: false, error: "Dataset quality score below threshold", errorCode: "AI-007" };
  }
  if (!DATA_CLASSIFICATIONS.includes(dataset.classification)) {
    return { ok: false, error: "Invalid dataset classification", errorCode: "AI-020" };
  }
  return { ok: true };
}

export function privacyMinimizationFields(record = {}, classification = "Internal") {
  const clone = { ...record };
  delete clone.momoPin;
  delete clone.pin;
  delete clone.bankPassword;
  delete clone.password;
  delete clone.cardCvv;
  if (classification === "Restricted") {
    delete clone.nationalId;
    delete clone.ghanaCard;
    delete clone.phone;
  }
  return clone;
}

export function governanceDashboard() {
  const completeness = assertAiRegistryCompleteness();
  return {
    registryVersion: "1.0.0",
    permissionCount: completeness.count,
    roles: AI_GOVERNANCE_ROLES,
    sodRules: SOD_RULES,
    escalation: ESCALATION_PATH,
    responsibilityMatrix: RESPONSIBILITY_MATRIX,
    scopeMatrix: permissionScopeMatrix(),
    assignmentScopeMatrix: permissionAssignmentScopeMatrix(),
    rolePermissionMatrix: buildCompleteRolePermissionMatrix(),
    sourceOfTruth: "src/core/ai-permission-registry.js"
  };
}

export {
  listAiPermissions,
  getAiPermission,
  assertAiScopeValid,
  canAssignAiPermission,
  canDelegateAiPermission,
  evaluateAiPermission,
  assertAiSegregationOfDuties,
  permissionScopeMatrix,
  permissionAssignmentScopeMatrix,
  AI_PERMISSION_REGISTRY,
  GRANT
};
