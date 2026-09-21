/**
 * Phase 19 change/release helpers — classification, approvals, readiness,
 * policy transitions, exception expiry, CI baseline compare.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P19_CHANGE_RELEASE_VERSION,
  EGCCRMS_VERSION,
  PHASE16_GATE_EXCEPTION_RULE,
  PHASE16_CERT_HOTFIX,
  evaluateChangeClassification,
  evaluateApprovalRequirements,
  evaluateReleaseReadiness,
  evaluatePolicyLifecycleTransition,
  evaluateExceptionValidity,
  compareCiBaseline,
  assertEmergencyChangeExceptionAlignment
} from "../src/core/phase19-change-release.js";

test("phase19 versions and Phase 16 consume constants", () => {
  assert.equal(P19_CHANGE_RELEASE_VERSION, "1.0.0");
  assert.equal(EGCCRMS_VERSION, "1.0.0");
  assert.equal(PHASE16_GATE_EXCEPTION_RULE, "emergency_exception_approved");
  assert.equal(PHASE16_CERT_HOTFIX, "CERT-002");
});

test("evaluateChangeClassification standard/normal/emergency", () => {
  const std = evaluateChangeClassification({ changeTypeId: "CHG-001" });
  assert.equal(std.ok, true);
  assert.equal(std.changeClass, "standard");
  assert.equal(std.cabRequired, false);

  const normal = evaluateChangeClassification({
    changeClass: "normal",
    domain: "database"
  });
  assert.equal(normal.ok, true);
  assert.equal(normal.changeType.id, "CHG-005");
  assert.equal(normal.cabRequired, true);
  assert.equal(normal.pirRequired, true);

  const emerg = evaluateChangeClassification({ emergency: true, domain: "application" });
  assert.equal(emerg.changeClass, "emergency");
  assert.equal(emerg.ecabRequired, true);
  assert.equal(emerg.phase16Bypass, "emergency_exception_approved");
  assert.equal(emerg.phase14EmergencyAlign, true);

  const bad = evaluateChangeClassification({ changeTypeId: "CHG-999" });
  assert.equal(bad.ok, false);
});

test("evaluateApprovalRequirements by change type", () => {
  const std = evaluateApprovalRequirements({ changeTypeId: "CHG-001" });
  assert.equal(std.ok, true);
  assert.equal(std.approvalsSatisfiable, true);
  assert.ok(std.requiredApproverRoleIds.includes("ROLE-CHANGE-MGR"));

  const emergMissing = evaluateApprovalRequirements({ changeTypeId: "CHG-008" });
  assert.equal(emergMissing.missingException, true);
  assert.equal(emergMissing.approvalsSatisfiable, false);

  const emergOk = evaluateApprovalRequirements({
    changeTypeId: "CHG-008",
    exceptionId: "EXC-001"
  });
  assert.equal(emergOk.missingException, false);
  assert.equal(emergOk.exceptionLinked, true);
  assert.equal(emergOk.ecabRequired, true);
  assert.ok(emergOk.requiredApproverRoleIds.includes("ROLE-ECAB"));

  const unknownExc = evaluateApprovalRequirements({
    changeTypeId: "CHG-008",
    exceptionId: "EXC-999"
  });
  assert.equal(unknownExc.ok, false);
});

test("evaluateReleaseReadiness consumes Phase 16 gates", () => {
  const ready = evaluateReleaseReadiness({
    releaseType: "minor",
    gateResults: {
      "QG-001": "pass",
      "QG-002": "pass",
      "QG-003": "pass",
      "QG-004": "pass"
    },
    certificationId: "CERT-001",
    rollbackPlanAttached: true,
    postValidationPlan: true
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.ready, true);
  assert.equal(ready.consumesPhase16, true);
  assert.equal(ready.doesNotRedefineTesting, true);

  const missingPost = evaluateReleaseReadiness({
    releaseTypeId: "REL-001",
    gateResults: {
      "QG-001": "pass",
      "QG-002": "pass",
      "QG-003": "pass",
      "QG-004": "pass"
    },
    certificationId: "CERT-001",
    rollbackPlanAttached: true,
    postValidationPlan: false
  });
  assert.equal(missingPost.ready, false);
  assert.equal(missingPost.postValidationOk, false);

  const hotfix = evaluateReleaseReadiness({
    releaseType: "hotfix",
    gateResults: { "QG-001": "pass", "QG-004": "exception_approved" },
    certificationId: "CERT-002",
    exceptionId: "EXC-001",
    rollbackPlanAttached: true,
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(hotfix.ready, true);
  assert.equal(hotfix.needsException, true);
  assert.equal(hotfix.exceptionOk, true);

  const hotfixNoExc = evaluateReleaseReadiness({
    releaseType: "emergency",
    gateResults: { "QG-001": "pass", "QG-004": "pass" },
    certificationId: "CERT-002",
    rollbackPlanAttached: true
  });
  assert.equal(hotfixNoExc.ready, false);
  assert.equal(hotfixNoExc.exceptionOk, false);

  const failedGate = evaluateReleaseReadiness({
    releaseType: "patch",
    gateResults: { "QG-001": "pass", "QG-002": "fail", "QG-004": "pass" },
    certificationId: "CERT-001",
    rollbackPlanAttached: true
  });
  assert.equal(failedGate.gatesOk, false);
  assert.equal(failedGate.ready, false);
});

test("evaluatePolicyLifecycleTransition allowed and forbidden", () => {
  const okPub = evaluatePolicyLifecycleTransition({
    policyId: "POL-001",
    toState: "superseded"
  });
  assert.equal(okPub.ok, true);
  assert.equal(okPub.fromState, "published");
  assert.equal(okPub.transitionOk, true);

  const bad = evaluatePolicyLifecycleTransition({
    fromState: "published",
    toState: "draft"
  });
  assert.equal(bad.transitionOk, false);

  const draftToReview = evaluatePolicyLifecycleTransition({
    fromState: "draft",
    toState: "review"
  });
  assert.equal(draftToReview.transitionOk, true);

  const retiredToDraft = evaluatePolicyLifecycleTransition({
    fromState: "retired",
    toState: "draft"
  });
  assert.equal(retiredToDraft.transitionOk, false);
});

test("evaluateExceptionValidity and expiry", () => {
  const valid = evaluateExceptionValidity({
    exceptionId: "EXC-001",
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.valid, true);
  assert.equal(valid.reason, "valid");
  assert.equal(valid.phase16Bypass, "emergency_exception_approved");

  const expired = evaluateExceptionValidity({
    exceptionId: "EXC-003",
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "expired");

  const futureExpiry = evaluateExceptionValidity({
    exceptionId: "EXC-001",
    asOf: "2027-01-15T00:00:00.000Z"
  });
  assert.equal(futureExpiry.valid, false);
  assert.equal(futureExpiry.reason, "expired");
});

test("compareCiBaseline drift detection", () => {
  const match = compareCiBaseline({
    ciId: "CI-001",
    observedBaselineId: "BL-APK-2026-09",
    observedVersion: "2.4.1"
  });
  assert.equal(match.ok, true);
  assert.equal(match.drift, false);

  const drift = compareCiBaseline({
    ciId: "CI-001",
    observedBaselineId: "BL-APK-OLD",
    observedVersion: "2.4.0"
  });
  assert.equal(drift.drift, true);
  assert.ok(drift.remediationHint);

  const unknown = compareCiBaseline({ ciId: "CI-999" });
  assert.equal(unknown.ok, false);
});

test("assertEmergencyChangeExceptionAlignment", () => {
  const okAlign = assertEmergencyChangeExceptionAlignment({
    changeTypeId: "CHG-008",
    exceptionId: "EXC-001",
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(okAlign.ok, true);
  assert.equal(okAlign.aligned, true);

  const badExc = assertEmergencyChangeExceptionAlignment({
    changeTypeId: "CHG-008",
    exceptionId: "EXC-003",
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(badExc.ok, false);

  const notEmerg = assertEmergencyChangeExceptionAlignment({
    changeTypeId: "CHG-001",
    exceptionId: "EXC-001"
  });
  assert.equal(notEmerg.ok, false);
});
