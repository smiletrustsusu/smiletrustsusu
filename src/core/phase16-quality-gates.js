/**
 * Phase 16 — Quality gate evaluation, recovery-time checks, measurement-window
 * validity, release certification, and KPI helpers (ETQAVS).
 * Consumes Phase 14 CI/CD env promotion and Phase 15 RTO budgets — does not
 * redefine pipelines or RPO/RTO policy. Catalog/evaluation only.
 */

import {
  ETQAVS_VERSION,
  STABILIZATION_MINUTES,
  STATISTICAL_CONFIDENCE,
  getQualityGate,
  getCertification,
  getThreshold,
  getRecoveryLimit,
  getSampleWindow,
  listStressPhases,
  DEFECT_SEVERITIES,
  QUALITY_KPIS
} from "./canonical-testing-registry.js";

export const P16_QUALITY_GATES_VERSION = "1.0.0";
export { ETQAVS_VERSION };

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Evaluate a single measured value against a threshold definition.
 */
export function evaluateThresholdResult({
  thresholdId,
  measured,
  approvedTarget,
  exceptionApproved = false
} = {}) {
  const thr = thresholdId ? getThreshold(thresholdId) : null;
  if (thresholdId && !thr) {
    return err("P16-THR-001", `Unknown threshold ${thresholdId}`);
  }

  const comparator = thr?.comparator || "gte";
  const passValue = thr?.passValue;
  const m = measured === true || measured === false ? (measured ? 1 : 0) : num(measured);

  if (comparator === "lte_approved_rpo" || comparator === "lte_approved_rto") {
    const target = num(approvedTarget);
    if (target == null || target <= 0) {
      return err("P16-THR-002", "approvedTarget (Phase 14/15) required for RPO/RTO threshold");
    }
    if (m == null || m < 0) {
      return err("P16-THR-003", "measured minutes required");
    }
    const within = m <= target;
    return ok({
      thresholdId: thr?.id,
      metric: thr?.metric,
      category: thr?.category,
      measured: m,
      passValue: target,
      comparator,
      passed: within,
      passFail: within ? "pass" : "fail",
      consumesPhase15: true
    });
  }

  if (comparator === "eq_or_exception") {
    if (m == null) return err("P16-THR-004", "measured required");
    const within = m === passValue || (m > passValue && exceptionApproved);
    return ok({
      thresholdId: thr?.id,
      metric: thr?.metric,
      category: thr?.category,
      measured: m,
      passValue,
      comparator,
      passed: within,
      passFail: within ? "pass" : "fail",
      exceptionApplied: m > passValue && exceptionApproved
    });
  }

  if (m == null) return err("P16-THR-005", "measured must be a finite number or boolean");

  let passed = false;
  switch (comparator) {
    case "eq":
      passed = m === passValue;
      break;
    case "gte":
      passed = m >= passValue;
      break;
    case "lte":
      passed = m <= passValue;
      break;
    default:
      return err("P16-THR-006", `Unsupported comparator ${comparator}`);
  }

  return ok({
    thresholdId: thr?.id,
    metric: thr?.metric,
    category: thr?.category,
    measured: m,
    passValue,
    comparator,
    passed,
    passFail: passed ? "pass" : "fail"
  });
}

/**
 * Quality gate PASS only when all mandatory tests pass, thresholds satisfied,
 * no unresolved Critical, no unresolved High unless exception, approvals recorded.
 */
export function evaluateQualityGate({
  gateId,
  thresholdResults = [],
  openCriticalDefects = 0,
  openHighDefects = 0,
  highExceptionApproved = false,
  mandatoryTestsPassed = true,
  approvalsRecorded = [],
  emergencyExceptionApproved = false
} = {}) {
  const gate = getQualityGate(gateId);
  if (!gate) return err("P16-QG-001", `Unknown quality gate ${gateId}`);

  if (emergencyExceptionApproved) {
    return ok({
      gateId: gate.id,
      code: gate.code,
      decision: "exception_approved",
      passFail: "pass",
      passed: true,
      reasons: ["emergency_exception_approved"],
      fromEnv: gate.fromEnv,
      toEnv: gate.toEnv
    });
  }

  const reasons = [];
  let passed = true;

  if (!mandatoryTestsPassed) {
    passed = false;
    reasons.push("mandatory_tests_failed");
  }

  const crit = num(openCriticalDefects) ?? 0;
  const high = num(openHighDefects) ?? 0;
  if (crit > 0) {
    passed = false;
    reasons.push("open_critical_defects");
  }
  if (high > 0 && !highExceptionApproved) {
    passed = false;
    reasons.push("open_high_defects_without_exception");
  }

  const thrEvals = [];
  for (const raw of thresholdResults) {
    const ev = evaluateThresholdResult(raw);
    thrEvals.push(ev);
    if (!ev.ok) {
      passed = false;
      reasons.push(ev.code || "threshold_eval_error");
      continue;
    }
    if (!ev.passed) {
      passed = false;
      reasons.push(`threshold_fail:${ev.thresholdId || ev.metric}`);
    }
  }

  const required = gate.requiredApprovals || [];
  for (const role of required) {
    if (!approvalsRecorded.includes(role)) {
      passed = false;
      reasons.push(`missing_approval:${role}`);
    }
  }

  return ok({
    gateId: gate.id,
    code: gate.code,
    fromEnv: gate.fromEnv,
    toEnv: gate.toEnv,
    decision: passed ? "pass" : "fail",
    passFail: passed ? "pass" : "fail",
    passed,
    reasons,
    thresholdEvaluations: thrEvals,
    openCriticalDefects: crit,
    openHighDefects: high
  });
}

/**
 * Validate sample size / measurement window sufficiency.
 */
export function evaluateMeasurementWindow({
  sampleWindowId,
  sampleSize,
  windowMinutes,
  warmupExcluded = true,
  windowDays,
  confidenceLevel,
  marginOfError,
  environmentStable = true
} = {}) {
  const smp = sampleWindowId ? getSampleWindow(sampleWindowId) : null;
  if (sampleWindowId && !smp) {
    return err("P16-WIN-001", `Unknown sample window ${sampleWindowId}`);
  }

  const reasons = [];
  let valid = true;

  if (smp?.minSampleNumeric != null) {
    const s = num(sampleSize);
    if (s == null || s < smp.minSampleNumeric) {
      valid = false;
      reasons.push("insufficient_sample_size");
    }
  }

  if (smp?.windowMinutesMin != null) {
    const w = num(windowMinutes);
    if (w == null || w < smp.windowMinutesMin) {
      valid = false;
      reasons.push("insufficient_window_minutes");
    }
  }

  if (smp?.windowDaysMin != null) {
    const d = num(windowDays);
    if (d == null || d < smp.windowDaysMin) {
      valid = false;
      reasons.push("insufficient_window_days");
    }
  }

  if (smp?.warmupMinutesMin != null && !warmupExcluded) {
    valid = false;
    reasons.push("warmup_not_excluded");
  }

  if (!environmentStable) {
    valid = false;
    reasons.push("environment_unstable");
  }

  const conf = num(confidenceLevel);
  const moe = num(marginOfError);
  if (conf != null && conf < STATISTICAL_CONFIDENCE.confidenceLevel) {
    valid = false;
    reasons.push("confidence_below_95");
  }
  if (moe != null && moe > STATISTICAL_CONFIDENCE.marginOfError) {
    valid = false;
    reasons.push("margin_of_error_above_5pct");
  }

  return ok({
    sampleWindowId: smp?.id || null,
    valid,
    passFail: valid ? "pass" : "fail",
    reasons,
    statisticalConfidence: STATISTICAL_CONFIDENCE
  });
}

/**
 * Evaluate recovery time against RLIM-* limits (or Phase 15 RTO for complete DR).
 */
export function evaluateRecoveryTime({
  recoveryLimitId,
  measuredMinutes,
  phase15RtoMinutes,
  stabilizationMinutes,
  healthChecksPassed = true,
  functionalValidationPassed = true,
  databaseConsistent = true,
  criticalAlertsDuringStabilization = 0
} = {}) {
  const lim = getRecoveryLimit(recoveryLimitId);
  if (!lim) return err("P16-REC-001", `Unknown recovery limit ${recoveryLimitId}`);

  const measured = num(measuredMinutes);
  if (measured == null || measured < 0) {
    return err("P16-REC-002", "measuredMinutes required");
  }

  let target = lim.maxMinutes;
  if (lim.usesPhase15Rto) {
    target = num(phase15RtoMinutes);
    if (target == null || target <= 0) {
      return err("P16-REC-003", "phase15RtoMinutes required for complete DR (consume Phase 15)");
    }
  }

  const withinTime = measured <= target;
  const stab = num(stabilizationMinutes);
  const stabOk = stab == null ? true : stab >= STABILIZATION_MINUTES;
  const alerts = num(criticalAlertsDuringStabilization) ?? 0;

  const reasons = [];
  let passed = true;
  if (!withinTime) {
    passed = false;
    reasons.push("exceeded_recovery_limit");
  }
  if (!stabOk) {
    passed = false;
    reasons.push("stabilization_below_30_minutes");
  }
  if (!healthChecksPassed) {
    passed = false;
    reasons.push("health_checks_failed");
  }
  if (!functionalValidationPassed) {
    passed = false;
    reasons.push("functional_validation_failed");
  }
  if (!databaseConsistent) {
    passed = false;
    reasons.push("database_inconsistent");
  }
  if (alerts > 0) {
    passed = false;
    reasons.push("critical_alerts_during_stabilization");
  }

  return ok({
    recoveryLimitId: lim.id,
    scenario: lim.scenario,
    measuredMinutes: measured,
    targetMinutes: target,
    usesPhase15Rto: !!lim.usesPhase15Rto,
    stabilizationMinutesRequired: STABILIZATION_MINUTES,
    passed,
    passFail: passed ? "pass" : "fail",
    reasons
  });
}

/**
 * Validate stress-test phase durations against STP-* catalog.
 */
export function evaluateStressPhases(phaseDurations = []) {
  const catalog = listStressPhases();
  const byCode = new Map(phaseDurations.map((p) => [p.code || p.id, p]));
  const reasons = [];
  let valid = true;
  const evaluations = [];

  for (const phase of catalog) {
    if (!phase.required) continue;
    const observed = byCode.get(phase.code) || byCode.get(phase.id);
    if (!observed) {
      valid = false;
      reasons.push(`missing_phase:${phase.code}`);
      evaluations.push({ code: phase.code, passed: false, reason: "missing" });
      continue;
    }
    const minutes = num(observed.minutes ?? observed.durationMinutes);
    if (minutes == null) {
      valid = false;
      reasons.push(`missing_duration:${phase.code}`);
      evaluations.push({ code: phase.code, passed: false, reason: "missing_duration" });
      continue;
    }
    if (minutes < phase.minMinutes) {
      valid = false;
      reasons.push(`below_min:${phase.code}`);
      evaluations.push({ code: phase.code, passed: false, minutes, min: phase.minMinutes });
      continue;
    }
    if (phase.maxMinutes != null && minutes > phase.maxMinutes) {
      valid = false;
      reasons.push(`above_max:${phase.code}`);
      evaluations.push({ code: phase.code, passed: false, minutes, max: phase.maxMinutes });
      continue;
    }
    evaluations.push({ code: phase.code, passed: true, minutes });
  }

  return ok({
    valid,
    passFail: valid ? "pass" : "fail",
    reasons,
    evaluations,
    workloadProgression: [100, 125, 150, 175, 200]
  });
}

/**
 * Release certification decision for CERT-*.
 */
export function evaluateReleaseCertification({
  certificationId = "CERT-001",
  gateResults = [],
  performancePassed = false,
  securityPassed = false,
  disasterRecoveryPassed = false,
  monitoringPassed = false,
  businessAcceptanceApproved = false,
  governanceApprovalsComplete = false,
  emergencyExceptionApproved = false
} = {}) {
  const cert = getCertification(certificationId);
  if (!cert) return err("P16-CERT-001", `Unknown certification ${certificationId}`);

  const reasons = [];
  let certified = true;

  if (cert.requiresException && !emergencyExceptionApproved) {
    certified = false;
    reasons.push("emergency_exception_required");
  }

  const requiredGates = cert.requiredGateIds || [];
  const gateMap = new Map(
    gateResults.map((g) => [g.gateId || g.id, g])
  );
  for (const gid of requiredGates) {
    const gr = gateMap.get(gid);
    if (!gr || !(gr.passed || gr.decision === "pass" || gr.decision === "exception_approved")) {
      certified = false;
      reasons.push(`gate_not_passed:${gid}`);
    }
  }

  if (cert.requiresSecurityPass && !securityPassed) {
    certified = false;
    reasons.push("security_thresholds_not_met");
  }
  if (performancePassed === false && certificationId === "CERT-001") {
    // production cert always requires performance
    if (!performancePassed) {
      certified = false;
      reasons.push("performance_thresholds_not_met");
    }
  }
  if (cert.requiresDrPass && !disasterRecoveryPassed) {
    certified = false;
    reasons.push("dr_validation_not_passed");
  }
  if (cert.requiresMonitoringValidation && !monitoringPassed) {
    certified = false;
    reasons.push("monitoring_validation_not_passed");
  }
  if (cert.requiresBusinessAcceptance && !businessAcceptanceApproved) {
    certified = false;
    reasons.push("business_acceptance_missing");
  }
  if (!governanceApprovalsComplete && !emergencyExceptionApproved) {
    certified = false;
    reasons.push("governance_approvals_incomplete");
  }

  // Deduplicate performance reason if pushed twice
  const uniqueReasons = [...new Set(reasons)];

  return ok({
    certificationId: cert.id,
    code: cert.code,
    decision: certified ? "certified" : "rejected",
    passFail: certified ? "pass" : "fail",
    certified,
    reasons: uniqueReasons,
    accountableAuthority: cert.accountableAuthority
  });
}

export function defectReleaseAllowed({
  openCritical = 0,
  openHigh = 0,
  highExceptionApproved = false,
  mediumRemediationPlanApproved = true
} = {}) {
  const critical = num(openCritical) ?? 0;
  const high = num(openHigh) ?? 0;
  const reasons = [];
  let allowed = true;
  if (critical > 0) {
    allowed = false;
    reasons.push("critical_open");
  }
  if (high > 0 && !highExceptionApproved) {
    allowed = false;
    reasons.push("high_open_without_exception");
  }
  if (!mediumRemediationPlanApproved) {
    allowed = false;
    reasons.push("medium_remediation_plan_missing");
  }
  return ok({
    allowed,
    passFail: allowed ? "pass" : "fail",
    reasons,
    severities: DEFECT_SEVERITIES
  });
}

/** KPI helpers — formulas from QUALITY_KPIS catalog. */
export function computeTestPassRate(passed, total) {
  const p = num(passed);
  const t = num(total);
  if (p == null || t == null || t <= 0) return err("P16-KPI-001", "passed/total required");
  return ok({ kpiId: "KPI-001", value: (p / t) * 100, unit: "percent" });
}

export function computeDefectEscapeRate(productionDefects, preProdDefects) {
  const prod = num(productionDefects);
  const pre = num(preProdDefects);
  if (prod == null || pre == null) return err("P16-KPI-002", "defect counts required");
  const denom = prod + pre;
  if (denom <= 0) return ok({ kpiId: "KPI-003", value: 0, unit: "percent" });
  return ok({ kpiId: "KPI-003", value: (prod / denom) * 100, unit: "percent" });
}

export function computeAutomationCoverage(automatedMandatory, totalMandatory) {
  const a = num(automatedMandatory);
  const t = num(totalMandatory);
  if (a == null || t == null || t <= 0) return err("P16-KPI-003", "counts required");
  return ok({ kpiId: "KPI-004", value: (a / t) * 100, unit: "percent" });
}

export function computeMeanTimeToValidate(durationsMinutes = []) {
  const nums = durationsMinutes.map(num).filter((n) => n != null && n >= 0);
  if (!nums.length) return err("P16-KPI-004", "durations required");
  const sum = nums.reduce((a, b) => a + b, 0);
  return ok({ kpiId: "KPI-005", value: sum / nums.length, unit: "minutes" });
}

export function computeMeanTimeToResolve(durationsHours = []) {
  const nums = durationsHours.map(num).filter((n) => n != null && n >= 0);
  if (!nums.length) return err("P16-KPI-005", "durations required");
  const sum = nums.reduce((a, b) => a + b, 0);
  return ok({ kpiId: "KPI-006", value: sum / nums.length, unit: "hours" });
}

export function computeRegressionStability(stableRuns, totalRuns) {
  const s = num(stableRuns);
  const t = num(totalRuns);
  if (s == null || t == null || t <= 0) return err("P16-KPI-006", "run counts required");
  return ok({ kpiId: "KPI-007", value: (s / t) * 100, unit: "percent" });
}

/**
 * Simple weighted Release Quality Index (0–100).
 * weights: passRate 0.35, escapeInverse 0.2, severityBacklog 0.2, gateCompliance 0.25
 */
export function computeReleaseQualityIndex({
  passRatePercent = 100,
  escapeRatePercent = 0,
  openCritical = 0,
  openHigh = 0,
  gatesPassed = 0,
  gatesTotal = 4
} = {}) {
  const pr = Math.max(0, Math.min(100, num(passRatePercent) ?? 0));
  const esc = Math.max(0, num(escapeRatePercent) ?? 0);
  const escapeScore = Math.max(0, 100 - esc * 10);
  const backlogPenalty = (num(openCritical) ?? 0) * 25 + (num(openHigh) ?? 0) * 10;
  const severityScore = Math.max(0, 100 - backlogPenalty);
  const gt = num(gatesTotal) || 1;
  const gp = num(gatesPassed) ?? 0;
  const gateScore = Math.max(0, Math.min(100, (gp / gt) * 100));
  const value =
    pr * 0.35 + escapeScore * 0.2 + severityScore * 0.2 + gateScore * 0.25;
  return ok({
    kpiId: "KPI-008",
    value: Math.round(value * 100) / 100,
    unit: "index",
    components: { passRate: pr, escapeScore, severityScore, gateScore }
  });
}

export function computeRecoverySuccessRate(successful, total) {
  const s = num(successful);
  const t = num(total);
  if (s == null || t == null || t <= 0) return err("P16-KPI-007", "counts required");
  return ok({ kpiId: "KPI-009", value: (s / t) * 100, unit: "percent" });
}

export function computeRecoveryTimeCompliance(withinTarget, total) {
  const w = num(withinTarget);
  const t = num(total);
  if (w == null || t == null || t <= 0) return err("P16-KPI-008", "counts required");
  return ok({ kpiId: "KPI-010", value: (w / t) * 100, unit: "percent" });
}

export function listKpiCatalog() {
  return [...QUALITY_KPIS];
}

/**
 * Structural validation for a quality-gate-result style payload.
 */
export function validateQualityGateResultPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return err("P16-SCH-001", "payload required");
  }
  if (!payload.schemaVersion) errors.push("schemaVersion required");
  if (!payload.gateId || !/^QG-[0-9]{3}$/.test(payload.gateId)) {
    errors.push("gateId must match QG-NNN");
  }
  if (!["pass", "fail", "exception_approved"].includes(payload.decision)) {
    errors.push("decision invalid");
  }
  if (!payload.governance?.accountableAuthority) {
    errors.push("governance.accountableAuthority required");
  }
  if (
    payload.governance?.accountableAuthority &&
    payload.governance?.auditAuthority &&
    payload.governance.accountableAuthority === payload.governance.auditAuthority
  ) {
    errors.push("governance: accountableAuthority must differ from auditAuthority");
  }
  if (!Array.isArray(payload.thresholdResults)) {
    errors.push("thresholdResults array required");
  }
  if (!Array.isArray(payload.evidence)) {
    errors.push("evidence array required");
  }
  if (errors.length) return err("P16-SCH-002", "Quality gate result invalid", { errors });
  return ok({ payload });
}

/**
 * Structural validation for release-certification payload.
 */
export function validateReleaseCertificationPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return err("P16-SCH-010", "payload required");
  }
  if (!payload.schemaVersion) errors.push("schemaVersion required");
  if (!payload.certificationId || !/^CERT-[0-9]{3}$/.test(payload.certificationId)) {
    errors.push("certificationId must match CERT-NNN");
  }
  if (!["certified", "rejected", "pending"].includes(payload.decision)) {
    errors.push("decision invalid");
  }
  if (payload.decision === "certified") {
    if (!payload.gatesSatisfied) errors.push("gatesSatisfied required when certified");
    if (!payload.securityPassed) errors.push("securityPassed required when certified");
    if (payload.certificationId === "CERT-001" && !payload.disasterRecoveryPassed) {
      errors.push("disasterRecoveryPassed required for CERT-001");
    }
    if (payload.certificationId === "CERT-001" && !payload.businessAcceptanceApproved) {
      errors.push("businessAcceptanceApproved required for CERT-001");
    }
  }
  if (!payload.governance?.accountableAuthority) {
    errors.push("governance.accountableAuthority required");
  }
  if (errors.length) return err("P16-SCH-011", "Release certification invalid", { errors });
  return ok({ payload });
}
