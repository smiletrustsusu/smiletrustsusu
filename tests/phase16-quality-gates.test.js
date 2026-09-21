/**
 * Phase 16 quality gates — threshold evaluation, sample/window validity,
 * recovery time limits, stress phases, certification fail rules, KPIs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  P16_QUALITY_GATES_VERSION,
  evaluateThresholdResult,
  evaluateQualityGate,
  evaluateMeasurementWindow,
  evaluateRecoveryTime,
  evaluateStressPhases,
  evaluateReleaseCertification,
  defectReleaseAllowed,
  computeTestPassRate,
  computeDefectEscapeRate,
  computeAutomationCoverage,
  computeMeanTimeToValidate,
  computeRegressionStability,
  computeReleaseQualityIndex,
  computeRecoverySuccessRate,
  validateQualityGateResultPayload,
  validateReleaseCertificationPayload
} from "../src/core/phase16-quality-gates.js";
import { STABILIZATION_MINUTES } from "../src/core/canonical-testing-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("phase16 quality gates version and threshold evaluation", () => {
  assert.equal(P16_QUALITY_GATES_VERSION, "1.0.0");
  assert.equal(STABILIZATION_MINUTES, 30);

  const pass = evaluateThresholdResult({
    thresholdId: "THR-002",
    measured: 92
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.passFail, "pass");

  const fail = evaluateThresholdResult({
    thresholdId: "THR-002",
    measured: 80
  });
  assert.equal(fail.ok, true);
  assert.equal(fail.passed, false);

  const p95 = evaluateThresholdResult({
    thresholdId: "THR-041",
    measured: 700
  });
  assert.equal(p95.passed, true);

  const p95Fail = evaluateThresholdResult({
    thresholdId: "THR-041",
    measured: 800
  });
  assert.equal(p95Fail.passed, false);
});

test("RPO/RTO thresholds consume Phase 15 approved targets", () => {
  const rtoPass = evaluateThresholdResult({
    thresholdId: "THR-091",
    measured: 200,
    approvedTarget: 240
  });
  assert.equal(rtoPass.ok, true);
  assert.equal(rtoPass.passed, true);
  assert.equal(rtoPass.consumesPhase15, true);

  const rtoFail = evaluateThresholdResult({
    thresholdId: "THR-091",
    measured: 300,
    approvedTarget: 240
  });
  assert.equal(rtoFail.passed, false);

  const missing = evaluateThresholdResult({
    thresholdId: "THR-090",
    measured: 5
  });
  assert.equal(missing.ok, false);
});

test("evaluateQualityGate pass/fail and high defect exception", () => {
  const pass = evaluateQualityGate({
    gateId: "QG-001",
    thresholdResults: [
      { thresholdId: "THR-001", measured: 100 },
      { thresholdId: "THR-002", measured: 91 },
      { thresholdId: "THR-006", measured: 0 }
    ],
    openCriticalDefects: 0,
    openHighDefects: 0,
    mandatoryTestsPassed: true,
    approvalsRecorded: ["ROLE-QA-LEAD"]
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.decision, "pass");

  const failCrit = evaluateQualityGate({
    gateId: "QG-001",
    thresholdResults: [{ thresholdId: "THR-001", measured: 100 }],
    openCriticalDefects: 1,
    mandatoryTestsPassed: true,
    approvalsRecorded: ["ROLE-QA-LEAD"]
  });
  assert.equal(failCrit.passed, false);
  assert.ok(failCrit.reasons.includes("open_critical_defects"));

  const highBlocked = evaluateQualityGate({
    gateId: "QG-002",
    thresholdResults: [],
    openCriticalDefects: 0,
    openHighDefects: 1,
    highExceptionApproved: false,
    mandatoryTestsPassed: true,
    approvalsRecorded: ["ROLE-QA-LEAD", "ROLE-SECURITY-TEST"]
  });
  assert.equal(highBlocked.passed, false);

  const highOk = evaluateQualityGate({
    gateId: "QG-002",
    thresholdResults: [],
    openCriticalDefects: 0,
    openHighDefects: 1,
    highExceptionApproved: true,
    mandatoryTestsPassed: true,
    approvalsRecorded: ["ROLE-QA-LEAD", "ROLE-SECURITY-TEST"]
  });
  assert.equal(highOk.passed, true);

  const emergency = evaluateQualityGate({
    gateId: "QG-004",
    emergencyExceptionApproved: true
  });
  assert.equal(emergency.decision, "exception_approved");
  assert.equal(emergency.passed, true);
});

test("measurement window validity and statistical confidence", () => {
  const okWin = evaluateMeasurementWindow({
    sampleWindowId: "SMP-006",
    sampleSize: 10000,
    windowMinutes: 30,
    warmupExcluded: true,
    confidenceLevel: 0.95,
    marginOfError: 0.05
  });
  assert.equal(okWin.ok, true);
  assert.equal(okWin.valid, true);

  const small = evaluateMeasurementWindow({
    sampleWindowId: "SMP-006",
    sampleSize: 100,
    windowMinutes: 10,
    warmupExcluded: false
  });
  assert.equal(small.valid, false);
  assert.ok(small.reasons.includes("insufficient_sample_size"));
  assert.ok(small.reasons.includes("warmup_not_excluded"));

  const lowConf = evaluateMeasurementWindow({
    sampleWindowId: "SMP-002",
    sampleSize: 1000,
    confidenceLevel: 0.9,
    marginOfError: 0.1
  });
  assert.equal(lowConf.valid, false);
  assert.ok(lowConf.reasons.includes("confidence_below_95"));
});

test("recovery time limits and Phase 15 complete DR", () => {
  const app = evaluateRecoveryTime({
    recoveryLimitId: "RLIM-001",
    measuredMinutes: 4,
    stabilizationMinutes: 30,
    healthChecksPassed: true,
    functionalValidationPassed: true,
    databaseConsistent: true
  });
  assert.equal(app.ok, true);
  assert.equal(app.passed, true);
  assert.equal(app.targetMinutes, 5);

  const slow = evaluateRecoveryTime({
    recoveryLimitId: "RLIM-001",
    measuredMinutes: 6,
    stabilizationMinutes: 30
  });
  assert.equal(slow.passed, false);

  const shortStab = evaluateRecoveryTime({
    recoveryLimitId: "RLIM-004",
    measuredMinutes: 10,
    stabilizationMinutes: 15
  });
  assert.equal(shortStab.passed, false);
  assert.ok(shortStab.reasons.includes("stabilization_below_30_minutes"));

  const dr = evaluateRecoveryTime({
    recoveryLimitId: "RLIM-012",
    measuredMinutes: 200,
    phase15RtoMinutes: 240,
    stabilizationMinutes: 30
  });
  assert.equal(dr.ok, true);
  assert.equal(dr.usesPhase15Rto, true);
  assert.equal(dr.passed, true);
  assert.equal(dr.targetMinutes, 240);

  const drNeedTarget = evaluateRecoveryTime({
    recoveryLimitId: "RLIM-012",
    measuredMinutes: 100
  });
  assert.equal(drNeedTarget.ok, false);
});

test("stress phase duration validation 100%→200%", () => {
  const phases = [
    { code: "STRESS_ENV_VALIDATION", minutes: 10 },
    { code: "STRESS_WARMUP", minutes: 15 },
    { code: "STRESS_BASELINE", minutes: 20 },
    { code: "STRESS_RAMPUP", minutes: 45 },
    { code: "STRESS_SUSTAINED", minutes: 90 },
    { code: "STRESS_PEAK", minutes: 40 },
    { code: "STRESS_FAILURE_OBS", minutes: 20 },
    { code: "STRESS_RECOVERY", minutes: 35 },
    { code: "STRESS_STABILIZATION", minutes: 30 }
  ];
  const ok = evaluateStressPhases(phases);
  assert.equal(ok.ok, true);
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.workloadProgression, [100, 125, 150, 175, 200]);

  const missing = evaluateStressPhases(phases.slice(0, 3));
  assert.equal(missing.valid, false);
});

test("release certification pass and fail rules", () => {
  const certified = evaluateReleaseCertification({
    certificationId: "CERT-001",
    gateResults: [
      { gateId: "QG-001", passed: true },
      { gateId: "QG-002", passed: true },
      { gateId: "QG-003", passed: true },
      { gateId: "QG-004", passed: true }
    ],
    performancePassed: true,
    securityPassed: true,
    disasterRecoveryPassed: true,
    monitoringPassed: true,
    businessAcceptanceApproved: true,
    governanceApprovalsComplete: true
  });
  assert.equal(certified.ok, true);
  assert.equal(certified.certified, true);
  assert.equal(certified.decision, "certified");

  const rejected = evaluateReleaseCertification({
    certificationId: "CERT-001",
    gateResults: [
      { gateId: "QG-001", passed: true },
      { gateId: "QG-002", passed: true },
      { gateId: "QG-003", passed: true },
      { gateId: "QG-004", passed: false }
    ],
    performancePassed: true,
    securityPassed: true,
    disasterRecoveryPassed: false,
    monitoringPassed: true,
    businessAcceptanceApproved: false,
    governanceApprovalsComplete: false
  });
  assert.equal(rejected.certified, false);
  assert.ok(rejected.reasons.some((r) => /gate_not_passed|dr_validation|business_acceptance|governance/i.test(r)));

  const defects = defectReleaseAllowed({ openCritical: 0, openHigh: 0 });
  assert.equal(defects.allowed, true);
  const blocked = defectReleaseAllowed({ openCritical: 1 });
  assert.equal(blocked.allowed, false);
});

test("KPI helpers", () => {
  assert.equal(computeTestPassRate(50, 50).value, 100);
  assert.equal(computeDefectEscapeRate(2, 8).value, 20);
  assert.equal(computeAutomationCoverage(80, 100).value, 80);
  assert.equal(computeMeanTimeToValidate([10, 20, 30]).value, 20);
  assert.equal(computeRegressionStability(19, 20).value, 95);
  const rqi = computeReleaseQualityIndex({
    passRatePercent: 100,
    escapeRatePercent: 0,
    openCritical: 0,
    openHigh: 0,
    gatesPassed: 4,
    gatesTotal: 4
  });
  assert.equal(rqi.ok, true);
  assert.ok(rqi.value >= 99);
  assert.equal(computeRecoverySuccessRate(9, 10).value, 90);
});

test("payload validators and schema examples on disk", () => {
  const validQg = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        "docs/schemas/testing/examples/valid/quality-gate-result.valid.json"
      ),
      "utf8"
    )
  );
  const qgVal = validateQualityGateResultPayload(validQg);
  assert.equal(qgVal.ok, true, (qgVal.errors || []).join("; "));

  const badQg = validateQualityGateResultPayload({
    ...validQg,
    governance: {
      accountableAuthority: "QA Lead",
      auditAuthority: "QA Lead"
    }
  });
  assert.equal(badQg.ok, false);

  const validCert = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        "docs/schemas/testing/examples/valid/release-certification.valid.json"
      ),
      "utf8"
    )
  );
  const certVal = validateReleaseCertificationPayload(validCert);
  assert.equal(certVal.ok, true, (certVal.errors || []).join("; "));

  const badCert = validateReleaseCertificationPayload({
    ...validCert,
    disasterRecoveryPassed: false
  });
  assert.equal(badCert.ok, false);
});
