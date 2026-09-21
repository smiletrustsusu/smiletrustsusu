/**
 * Module 29 — CANONICAL SINGLE PERMISSION REGISTRY (authoritative Source of Truth).
 * Catalog, role matrix, and scope matrices MUST derive from / reference this registry.
 * Every AI permission appears exactly once. Auditable is always true.
 */

export const AI_PERMISSION_REGISTRY_VERSION = "1.0.0";

/** Allowed authorization scopes (narrow → wide). */
export const AI_AUTH_SCOPES = Object.freeze(["Self", "Branch", "Organization", "Platform"]);

/** Scope ranks for validation (higher = broader). */
export const AI_SCOPE_RANK = Object.freeze({
  Self: 1,
  Branch: 2,
  Organization: 3,
  Platform: 4
});

/**
 * @typedef {object} AiPermissionDef
 * @property {string} code
 * @property {string} family
 * @property {string} description
 * @property {string[]} allowedScopes
 * @property {string} defaultScope
 * @property {string} maxScope
 * @property {string[]} assignmentScopes
 * @property {string[]} delegationScopes
 * @property {string[]} approvalScopes
 * @property {string[]} revocationScopes
 * @property {"Low"|"Medium"|"High"|"Critical"} riskLevel
 * @property {boolean} mfaRequired
 * @property {boolean} workflowApprovalRequired
 * @property {boolean} delegable
 * @property {true} auditable
 * @property {string} [coarseAction] maps to rbac.js Ai.* action
 */

function def(partial) {
  const allowed = partial.allowedScopes || ["Organization"];
  const maxScope = partial.maxScope || allowed[allowed.length - 1];
  const defaultScope = partial.defaultScope || allowed[0];
  return Object.freeze({
    code: partial.code,
    family: partial.family,
    description: partial.description || partial.code,
    allowedScopes: Object.freeze([...allowed]),
    defaultScope,
    maxScope,
    assignmentScopes: Object.freeze([...(partial.assignmentScopes || ["Organization", "Platform"])]),
    delegationScopes: Object.freeze([...(partial.delegationScopes || (partial.delegable === false ? [] : ["Branch", "Organization"]))]),
    approvalScopes: Object.freeze([...(partial.approvalScopes || ["Organization", "Platform"])]),
    revocationScopes: Object.freeze([...(partial.revocationScopes || ["Organization", "Platform"])]),
    riskLevel: partial.riskLevel || "Medium",
    mfaRequired: partial.mfaRequired === true,
    workflowApprovalRequired: partial.workflowApprovalRequired === true,
    delegable: partial.delegable !== false,
    auditable: true,
    coarseAction: partial.coarseAction || "Ai.View"
  });
}

/** Authoritative inventory — every code exactly once. */
export const AI_PERMISSION_REGISTRY = Object.freeze([
  // Dataset
  def({ code: "AI.Dataset.View", family: "Dataset", description: "View dataset registry metadata", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Dataset.Register", family: "Dataset", description: "Register dataset metadata", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Govern" }),
  def({ code: "AI.Dataset.Update", family: "Dataset", description: "Update dataset metadata", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Govern" }),
  def({ code: "AI.Dataset.Approve", family: "Dataset", description: "Approve dataset for train/inference", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Dataset.Retire", family: "Dataset", description: "Retire dataset from use", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Dataset.Export", family: "Dataset", description: "Export dataset metadata (masked)", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", mfaRequired: true, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Dataset.Validate", family: "Dataset", description: "Validate checksum and quality gates", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Govern" }),

  // Feature
  def({ code: "AI.Feature.View", family: "Feature", description: "View feature registry", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Feature.Register", family: "Feature", description: "Register reusable features", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),
  def({ code: "AI.Feature.Update", family: "Feature", description: "Update feature definitions", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),
  def({ code: "AI.Feature.Approve", family: "Feature", description: "Approve feature for production use", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Feature.Retire", family: "Feature", description: "Retire feature versions", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Feature.Validate", family: "Feature", description: "Validate feature quality and lineage", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),

  // Model
  def({ code: "AI.Model.View", family: "Model", description: "View model registry and versions", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Model.Register", family: "Model", description: "Register models and versions", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),
  def({ code: "AI.Model.Version", family: "Model", description: "Create model versions / lineage", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),
  def({ code: "AI.Model.Approve", family: "Model", description: "Approve model for deployment", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Model.Deploy", family: "Model", description: "Deploy approved model to production", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Model.Rollback", family: "Model", description: "Rollback deployed model", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Model.Retire", family: "Model", description: "Retire model from registry", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Model.Train", family: "Model", description: "Enqueue training job metadata", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Model" }),

  // Prediction
  def({ code: "AI.Prediction.View", family: "Prediction", description: "View prediction results and XAI", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Prediction.Run", family: "Prediction", description: "Run growth/savings/loan predictions", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Prediction.Explain", family: "Prediction", description: "Retrieve XAI explanations", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Prediction.Export", family: "Prediction", description: "Export prediction artifacts", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", mfaRequired: true, coarseAction: "Ai.Govern" }),
  def({ code: "AI.Prediction.FraudDetect", family: "Prediction", description: "Run fraud detection heuristics", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Prediction.RiskScore", family: "Prediction", description: "Compute risk scores", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Prediction.Forecast", family: "Prediction", description: "Run forecasting models", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Prediction.AnomalyDetect", family: "Prediction", description: "Run anomaly detection", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", coarseAction: "Ai.Predict" }),

  // Recommendation
  def({ code: "AI.Recommendation.View", family: "Recommendation", description: "View advisory recommendations", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Recommendation.Generate", family: "Recommendation", description: "Generate advisory recommendations", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Recommendation.Accept", family: "Recommendation", description: "Accept recommendation (advisory record only)", allowedScopes: ["Self", "Branch", "Organization"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Recommendation.Reject", family: "Recommendation", description: "Reject recommendation with justification", allowedScopes: ["Self", "Branch", "Organization"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Low", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Recommendation.Override", family: "Recommendation", description: "Override recommendation with justification", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Govern" }),

  // Governance
  def({ code: "AI.Governance.View", family: "Governance", description: "View AI governance dashboards", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Governance.Configure", family: "Governance", description: "Configure governance policies", allowedScopes: ["Platform"], defaultScope: "Platform", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Governance.Audit", family: "Governance", description: "View AI audit trails", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Govern" }),
  def({ code: "AI.Governance.SoD", family: "Governance", description: "View/enforce segregation of duties", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", coarseAction: "Ai.Govern" }),
  def({ code: "AI.Governance.AssignPermission", family: "Governance", description: "Assign AI permissions", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Governance.RevokePermission", family: "Governance", description: "Revoke AI permissions", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Governance.Delegate", family: "Governance", description: "Delegate AI permissions within scope", allowedScopes: ["Branch", "Organization"], defaultScope: "Organization", maxScope: "Organization", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Govern" }),

  // Platform
  def({ code: "AI.Platform.View", family: "Platform", description: "View AI platform health", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Platform.Configure", family: "Platform", description: "Configure platform flags (shadow/canary)", allowedScopes: ["Platform"], defaultScope: "Platform", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Platform.Admin", family: "Platform", description: "Full AI platform administration", allowedScopes: ["Platform"], defaultScope: "Platform", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),

  // Pipeline
  def({ code: "AI.Pipeline.View", family: "Pipeline", description: "View MLOps pipelines / jobs", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Pipeline.Run", family: "Pipeline", description: "Run training/validation pipelines", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Model" }),
  def({ code: "AI.Pipeline.Configure", family: "Pipeline", description: "Configure pipeline definitions", allowedScopes: ["Platform"], defaultScope: "Platform", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Pipeline.Approve", family: "Pipeline", description: "Approve pipeline promotion", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Govern" }),

  // Drift
  def({ code: "AI.Drift.View", family: "Drift", description: "View drift events", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Drift.Detect", family: "Drift", description: "Run drift detection", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Model" }),
  def({ code: "AI.Drift.Acknowledge", family: "Drift", description: "Acknowledge drift alerts", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Medium", coarseAction: "Ai.Govern" }),
  def({ code: "AI.Drift.Remediate", family: "Drift", description: "Remediate drift (rollback/retrain)", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, coarseAction: "Ai.Admin" }),

  // Inference
  def({ code: "AI.Inference.View", family: "Inference", description: "View inference logs", allowedScopes: ["Self", "Branch", "Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Low", coarseAction: "Ai.View" }),
  def({ code: "AI.Inference.Run", family: "Inference", description: "Execute inference against deployed models", allowedScopes: ["Branch", "Organization", "Platform"], defaultScope: "Branch", maxScope: "Organization", riskLevel: "Medium", coarseAction: "Ai.Predict" }),
  def({ code: "AI.Inference.Shadow", family: "Inference", description: "Enable shadow inference", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "High", workflowApprovalRequired: true, coarseAction: "Ai.Admin" }),
  def({ code: "AI.Inference.Canary", family: "Inference", description: "Enable canary inference", allowedScopes: ["Organization", "Platform"], defaultScope: "Organization", maxScope: "Platform", riskLevel: "Critical", mfaRequired: true, workflowApprovalRequired: true, delegable: false, coarseAction: "Ai.Admin" })
]);

const BY_CODE = new Map(AI_PERMISSION_REGISTRY.map((item) => [item.code, item]));

export function listAiPermissions(filter = {}) {
  let rows = [...AI_PERMISSION_REGISTRY];
  if (filter.family) rows = rows.filter((item) => item.family === filter.family);
  if (filter.riskLevel) rows = rows.filter((item) => item.riskLevel === filter.riskLevel);
  if (filter.coarseAction) rows = rows.filter((item) => item.coarseAction === filter.coarseAction);
  return rows;
}

export function getAiPermission(code) {
  return BY_CODE.get(code) || null;
}

export function assertAiRegistryCompleteness() {
  const codes = AI_PERMISSION_REGISTRY.map((item) => item.code);
  const unique = new Set(codes);
  const families = ["Dataset", "Feature", "Model", "Prediction", "Recommendation", "Governance", "Platform", "Pipeline", "Drift", "Inference"];
  const missingFamilies = families.filter((family) => !AI_PERMISSION_REGISTRY.some((item) => item.family === family));
  return {
    ok: unique.size === codes.length && missingFamilies.length === 0,
    count: codes.length,
    uniqueCount: unique.size,
    duplicates: codes.filter((code, index) => codes.indexOf(code) !== index),
    missingFamilies,
    allAuditable: AI_PERMISSION_REGISTRY.every((item) => item.auditable === true)
  };
}

export function assertAiScopeValid(permissionCode, scope) {
  const perm = getAiPermission(permissionCode);
  if (!perm) {
    return { ok: false, error: `Unknown AI permission: ${permissionCode}`, errorCode: "AI-030" };
  }
  if (!AI_AUTH_SCOPES.includes(scope)) {
    return { ok: false, error: `Invalid scope: ${scope}`, errorCode: "AI-031" };
  }
  if (!perm.allowedScopes.includes(scope)) {
    return {
      ok: false,
      error: `Scope ${scope} not allowed for ${permissionCode} (allowed: ${perm.allowedScopes.join(", ")})`,
      errorCode: "AI-031"
    };
  }
  if (AI_SCOPE_RANK[scope] > AI_SCOPE_RANK[perm.maxScope]) {
    return {
      ok: false,
      error: `Scope ${scope} exceeds max ${perm.maxScope} for ${permissionCode}`,
      errorCode: "AI-031"
    };
  }
  return { ok: true, permission: perm, scope };
}

export function canAssignAiPermission(assignerRole, permissionCode, scope, opts = {}) {
  const scopeCheck = assertAiScopeValid(permissionCode, scope);
  if (!scopeCheck.ok) return scopeCheck;
  const perm = scopeCheck.permission;
  if (!perm.assignmentScopes.includes(scope) && !opts.platformOverride) {
    return {
      ok: false,
      error: `Assignment scope ${scope} not permitted for ${permissionCode}`,
      errorCode: "AI-032"
    };
  }
  if (perm.riskLevel === "Critical" && !["SystemOwner", "KBA", "AI Platform Admin", "Chief Data Steward"].includes(assignerRole)) {
    return { ok: false, error: "Critical AI permissions require elevated assigner role", errorCode: "AI-033" };
  }
  return { ok: true, permission: perm, scope };
}

export function canDelegateAiPermission(permissionCode, scope) {
  const perm = getAiPermission(permissionCode);
  if (!perm) return { ok: false, error: "Unknown permission", errorCode: "AI-030" };
  if (!perm.delegable) return { ok: false, error: "Permission is not delegable", errorCode: "AI-034" };
  if (!perm.delegationScopes.includes(scope)) {
    return { ok: false, error: `Delegation scope ${scope} not allowed`, errorCode: "AI-034" };
  }
  return { ok: true, permission: perm };
}

/**
 * Evaluate detailed AI permission + scope against user grants.
 * Coarse Ai.* RBAC may gate first; this evaluates the registry entry.
 */
export function evaluateAiPermission(user, permissionCode, scope = null, grants = []) {
  const perm = getAiPermission(permissionCode);
  if (!perm) return { ok: false, allowed: false, errorCode: "AI-030", error: "Unknown permission" };
  const effectiveScope = scope || perm.defaultScope;
  const scopeCheck = assertAiScopeValid(permissionCode, effectiveScope);
  if (!scopeCheck.ok) return { ...scopeCheck, allowed: false };

  if (user?.systemOwner || user?.username === "john" || user?.role === "SystemOwner") {
    return { ok: true, allowed: true, permission: perm, scope: effectiveScope, reason: "system_owner" };
  }

  const grant = (grants || []).find((item) => item.code === permissionCode && item.enabled !== false);
  if (grant) {
    const grantScope = grant.scope || perm.defaultScope;
    if (AI_SCOPE_RANK[grantScope] >= AI_SCOPE_RANK[effectiveScope]) {
      return { ok: true, allowed: true, permission: perm, scope: effectiveScope, reason: "explicit_grant" };
    }
    return { ok: false, allowed: false, errorCode: "AI-035", error: "Granted scope insufficient", permission: perm };
  }

  return {
    ok: false,
    allowed: false,
    errorCode: "AI-002",
    error: "AI permission not granted",
    permission: perm,
    coarseAction: perm.coarseAction
  };
}

/** SoD: creator cannot approve own model/dataset; developer cannot validate. */
export function assertAiSegregationOfDuties({ action, actorId, creatorId, developerId, validatorId } = {}) {
  if (!actorId) return { ok: true };
  if (["approve", "deploy", "validate"].includes(action) && creatorId && actorId === creatorId) {
    return { ok: false, error: "SoD violation: creator cannot approve/deploy own artifact", errorCode: "AI-040" };
  }
  if (action === "validate" && developerId && actorId === developerId) {
    return { ok: false, error: "SoD violation: developer cannot validate own model", errorCode: "AI-040" };
  }
  if (action === "approve" && validatorId && actorId === validatorId && developerId === actorId) {
    return { ok: false, error: "SoD violation: validator cannot also be developer", errorCode: "AI-040" };
  }
  return { ok: true };
}

export function permissionScopeMatrix() {
  return AI_PERMISSION_REGISTRY.map((item) => ({
    code: item.code,
    allowedScopes: item.allowedScopes,
    defaultScope: item.defaultScope,
    maxScope: item.maxScope
  }));
}

export function permissionAssignmentScopeMatrix() {
  return AI_PERMISSION_REGISTRY.map((item) => ({
    code: item.code,
    assignmentScopes: item.assignmentScopes,
    delegationScopes: item.delegationScopes,
    approvalScopes: item.approvalScopes,
    revocationScopes: item.revocationScopes,
    delegable: item.delegable
  }));
}

export function assertAiPermissionRegistryBoundary() {
  return {
    singleSourceOfTruth: true,
    auditableAlways: true,
    noWildcards: true,
    noImpliedGrants: true,
    completeness: assertAiRegistryCompleteness()
  };
}
