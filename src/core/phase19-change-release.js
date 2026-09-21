/**
 * Phase 19 — Change / release / policy / exception evaluation helpers (EGCCRMS).
 * Change classification & approvals, release readiness (consumes Phase 16 gates),
 * policy lifecycle transitions, exception validity, CI baseline compare.
 * Catalog/evaluation only — does not redefine Phase 8/14/16/18 or replace Module 30.
 */

import {
  EGCCRMS_VERSION,
  PHASE16_GATE_EXCEPTION_RULE,
  PHASE16_CERT_HOTFIX,
  PHASE16_PROD_GATES,
  PHASE16_HOTFIX_GATES,
  CHANGE_CLASSES,
  CHANGE_DOMAINS,
  POLICY_LIFECYCLE,
  POLICY_TRANSITIONS,
  getChangeType,
  getChangeTypeByClassAndDomain,
  getChangeTypesByClass,
  getReleaseType,
  getReleaseTypeByKind,
  getException,
  getPolicy,
  getConfigurationItem,
  listChangeTypes
} from "./canonical-governance-registry.js";

export const P19_CHANGE_RELEASE_VERSION = "1.0.0";
export {
  EGCCRMS_VERSION,
  PHASE16_GATE_EXCEPTION_RULE,
  PHASE16_CERT_HOTFIX,
  PHASE16_PROD_GATES,
  PHASE16_HOTFIX_GATES,
  CHANGE_CLASSES,
  CHANGE_DOMAINS,
  POLICY_LIFECYCLE
};

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

/**
 * Classify a change into Standard / Normal / Emergency catalog type.
 * Prefer explicit changeTypeId; else resolve by class + domain.
 */
export function evaluateChangeClassification({
  changeTypeId,
  changeClass,
  domain,
  emergency = false,
  standardEligible = false
} = {}) {
  if (changeTypeId) {
    const t = getChangeType(changeTypeId);
    if (!t) return err("P19-CHG-001", `Unknown change type ${changeTypeId}`);
    return ok({
      changeType: t,
      changeClass: t.changeClass,
      domain: t.domain,
      cabRequired: !!t.cabRequired,
      ecabRequired: !!t.ecabRequired,
      pirRequired: !!t.pirRequired,
      phase14EmergencyAlign: !!t.phase14EmergencyAlign,
      phase16Bypass: t.phase16Bypass || null
    });
  }

  let resolvedClass = changeClass;
  if (emergency) resolvedClass = "emergency";
  else if (!resolvedClass && standardEligible) resolvedClass = "standard";
  else if (!resolvedClass) resolvedClass = "normal";

  if (!CHANGE_CLASSES.includes(resolvedClass)) {
    return err("P19-CHG-002", `Invalid change class ${resolvedClass}`, {
      allowed: [...CHANGE_CLASSES]
    });
  }
  if (domain && !CHANGE_DOMAINS.includes(domain)) {
    return err("P19-CHG-003", `Invalid change domain ${domain}`, {
      allowed: [...CHANGE_DOMAINS]
    });
  }

  let match = domain ? getChangeTypeByClassAndDomain(resolvedClass, domain) : null;
  if (!match) {
    const byClass = getChangeTypesByClass(resolvedClass);
    match = byClass[0] || null;
  }
  if (!match) {
    return err("P19-CHG-004", "Unable to resolve change type", {
      changeClass: resolvedClass,
      domain,
      available: listChangeTypes().map((c) => c.id)
    });
  }

  return ok({
    changeType: match,
    changeClass: match.changeClass,
    domain: match.domain,
    cabRequired: !!match.cabRequired,
    ecabRequired: !!match.ecabRequired,
    pirRequired: !!match.pirRequired,
    phase14EmergencyAlign: !!match.phase14EmergencyAlign,
    phase16Bypass: match.phase16Bypass || null,
    inferred: true
  });
}

/**
 * Determine approval requirements for a change type.
 */
export function evaluateApprovalRequirements({
  changeTypeId,
  changeClass,
  domain,
  exceptionId = null
} = {}) {
  const classified = evaluateChangeClassification({ changeTypeId, changeClass, domain });
  if (!classified.ok) return classified;

  const t = classified.changeType;
  const missingException = !!t.requiresExceptionId && !exceptionId;
  const exception = exceptionId ? getException(exceptionId) : null;

  if (exceptionId && !exception) {
    return err("P19-APR-001", `Unknown exception ${exceptionId}`);
  }

  return ok({
    changeTypeId: t.id,
    changeClass: t.changeClass,
    domain: t.domain,
    cabRequired: !!t.cabRequired,
    ecabRequired: !!t.ecabRequired,
    requiredApproverRoleIds: [...(t.requiredApproverRoleIds || [])],
    pirRequired: !!t.pirRequired,
    maxLeadTimeHours: t.maxLeadTimeHours,
    requiresExceptionId: !!t.requiresExceptionId,
    exceptionId: exceptionId || null,
    exceptionLinked: !!exception,
    missingException,
    approvalsSatisfiable: !missingException,
    phase14EmergencyAlign: !!t.phase14EmergencyAlign,
    phase16Bypass: t.phase16Bypass || null,
    accountableAuthority: t.accountableAuthority
  });
}

/**
 * Release readiness check — consumes Phase 16 gate IDs / CERT refs (does not redefine).
 */
export function evaluateReleaseReadiness({
  releaseTypeId,
  releaseType,
  gateResults = {},
  certificationId = null,
  exceptionId = null,
  rollbackPlanAttached = false,
  postValidationPlan = false
} = {}) {
  const rel = releaseTypeId
    ? getReleaseType(releaseTypeId)
    : getReleaseTypeByKind(releaseType);
  if (!rel) {
    return err("P19-REL-001", "Unknown release type", { releaseTypeId, releaseType });
  }

  const requiredGates = [...(rel.requiredGateIds || [])];
  const failedGates = [];
  const passedGates = [];
  const exceptionApprovedGates = [];

  for (const gid of requiredGates) {
    const decision = gateResults[gid];
    if (decision === "pass") passedGates.push(gid);
    else if (decision === "exception_approved") exceptionApprovedGates.push(gid);
    else failedGates.push(gid);
  }

  const needsException = !!rel.requiresException;
  const exception = exceptionId ? getException(exceptionId) : null;
  let exceptionOk = !needsException;
  if (needsException) {
    exceptionOk =
      !!exception &&
      exception.state === "approved" &&
      exception.phase16Bypass === PHASE16_GATE_EXCEPTION_RULE;
  }

  const certOk =
    !rel.certificationId ||
    certificationId === rel.certificationId ||
    (needsException && certificationId === PHASE16_CERT_HOTFIX);

  const gatesOk = failedGates.length === 0;
  const postValidationOk = ["major", "minor"].includes(rel.releaseType)
    ? !!postValidationPlan
    : true;
  const readinessReady =
    gatesOk && exceptionOk && certOk && rollbackPlanAttached && postValidationOk;

  return ok({
    releaseTypeId: rel.id,
    releaseType: rel.releaseType,
    requiredGateIds: requiredGates,
    passedGates,
    exceptionApprovedGates,
    failedGates,
    gatesOk,
    certificationId: certificationId || rel.certificationId,
    expectedCertificationId: rel.certificationId,
    certOk,
    needsException,
    exceptionOk,
    exceptionId: exceptionId || null,
    rollbackPlanAttached,
    postValidationPlan,
    postValidationOk,
    ready: readinessReady,
    consumesPhase16: true,
    doesNotRedefineTesting: true,
    phase16Bypass: rel.phase16Bypass || null,
    accountableAuthority: rel.accountableAuthority
  });
}

/**
 * Validate policy lifecycle transition.
 */
export function evaluatePolicyLifecycleTransition({
  policyId,
  fromState,
  toState
} = {}) {
  let from = fromState;
  let to = toState;
  if (policyId) {
    const p = getPolicy(policyId);
    if (!p) return err("P19-POL-001", `Unknown policy ${policyId}`);
    from = fromState || p.lifecycleState;
  }
  if (!POLICY_LIFECYCLE.includes(from)) {
    return err("P19-POL-002", `Invalid fromState ${from}`, { allowed: [...POLICY_LIFECYCLE] });
  }
  if (!POLICY_LIFECYCLE.includes(to)) {
    return err("P19-POL-003", `Invalid toState ${to}`, { allowed: [...POLICY_LIFECYCLE] });
  }
  const allowed = POLICY_TRANSITIONS[from] || [];
  const allowedTransition = allowed.includes(to);
  return ok({
    policyId: policyId || null,
    fromState: from,
    toState: to,
    allowedTransition,
    allowedNext: [...allowed],
    transitionOk: allowedTransition
  });
}

/**
 * Evaluate exception validity at a point in time.
 */
export function evaluateExceptionValidity({
  exceptionId,
  asOf = null
} = {}) {
  const ex = getException(exceptionId);
  if (!ex) return err("P19-EXC-001", `Unknown exception ${exceptionId}`);

  const now = asOf ? new Date(asOf) : new Date();
  if (Number.isNaN(now.getTime())) {
    return err("P19-EXC-002", "Invalid asOf timestamp");
  }

  const from = new Date(ex.validFrom);
  const to = new Date(ex.validTo);
  const withinWindow = now >= from && now <= to;
  const stateActive = ex.state === "approved";
  const valid = stateActive && withinWindow;

  let reason = "valid";
  if (ex.state === "expired" || (!withinWindow && now > to)) reason = "expired";
  else if (ex.state === "denied") reason = "denied";
  else if (ex.state === "revoked") reason = "revoked";
  else if (ex.state === "requested") reason = "pending_approval";
  else if (!withinWindow && now < from) reason = "not_yet_valid";
  else if (!valid) reason = "invalid";

  return ok({
    exceptionId: ex.id,
    state: ex.state,
    validFrom: ex.validFrom,
    validTo: ex.validTo,
    asOf: now.toISOString(),
    withinWindow,
    stateActive,
    valid,
    reason,
    phase16Bypass: ex.phase16Bypass || null,
    phase14Align: !!ex.phase14Align,
    pirRequired: !!ex.pirRequired,
    maxDurationHours: ex.maxDurationHours,
    accountableAuthority: ex.accountableAuthority
  });
}

/**
 * Compare a CI's recorded baseline to an observed baseline / version.
 */
export function compareCiBaseline({
  ciId,
  observedBaselineId = null,
  observedVersion = null
} = {}) {
  const ci = getConfigurationItem(ciId);
  if (!ci) return err("P19-CI-001", `Unknown CI ${ciId}`);

  const baselineMatch =
    observedBaselineId == null ? null : observedBaselineId === ci.baselineId;
  const versionMatch = observedVersion == null ? null : observedVersion === ci.version;
  const drift =
    (baselineMatch === false) ||
    (versionMatch === false);

  return ok({
    ciId: ci.id,
    category: ci.category,
    expectedBaselineId: ci.baselineId,
    expectedVersion: ci.version,
    observedBaselineId,
    observedVersion,
    baselineMatch,
    versionMatch,
    drift,
    status: ci.status,
    accountableAuthority: ci.accountableAuthority,
    remediationHint: drift
      ? "Open GWF-004 CI baseline workflow; disposition via Configuration Control Board"
      : null
  });
}

/**
 * Convenience: emergency change must link approved Phase 16-aligned exception.
 */
export function assertEmergencyChangeExceptionAlignment({
  changeTypeId,
  exceptionId,
  asOf = null
} = {}) {
  const approvals = evaluateApprovalRequirements({ changeTypeId, exceptionId });
  if (!approvals.ok) return approvals;
  if (approvals.changeClass !== "emergency") {
    return err("P19-EMG-001", "Change type is not emergency");
  }
  if (!approvals.phase14EmergencyAlign) {
    return err("P19-EMG-002", "Emergency change missing Phase 14 alignment flag");
  }
  if (approvals.phase16Bypass !== PHASE16_GATE_EXCEPTION_RULE) {
    return err("P19-EMG-003", "Emergency change must use Phase 16 emergency_exception_approved");
  }
  const validity = evaluateExceptionValidity({ exceptionId, asOf });
  if (!validity.ok) return validity;
  if (!validity.valid) {
    return err("P19-EMG-004", "Emergency exception not valid", { validity });
  }
  return ok({
    aligned: true,
    changeTypeId: approvals.changeTypeId,
    exceptionId,
    phase14EmergencyAlign: true,
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE
  });
}
