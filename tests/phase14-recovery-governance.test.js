/**
 * Phase 14 recovery governance — RPO/RTO measure pass/fail, stabilization 30m,
 * one accountableAuthority, SoD Accountable ≠ Audit.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  RPO_RTO_TARGETS,
  getRpoRtoTarget,
  getStabilizationMinutes,
  assertSingleAccountableAuthority,
  assertAccountableAuthorityPerTarget
} from "../src/core/canonical-deployment-registry.js";
import {
  P14_RECOVERY_GOVERNANCE_VERSION,
  measureRpo,
  measureRto,
  assertStabilizationPeriod,
  validateMeasurementRecord,
  assertDecisionRightsSoD,
  assertTargetOwnership,
  ownershipMatrix,
  accountableAuthorityMetadataExample,
  reportingMetricsFromMeasurement,
  DECISION_RIGHTS
} from "../src/core/phase14-recovery-governance.js";

test("phase14 recovery governance version and production stabilization 30m", () => {
  assert.equal(P14_RECOVERY_GOVERNANCE_VERSION, "1.0.0");
  assert.equal(getStabilizationMinutes("production"), 30);
  const stab = assertStabilizationPeriod({
    environment: "production",
    restoreCompletedAt: "2026-09-14T10:00:00.000Z",
    serviceStabilizedAt: "2026-09-14T10:30:00.000Z",
    stabilizationMinutes: 30
  });
  assert.equal(stab.ok, true);
  assert.equal(stab.passed, true);
  assert.equal(stab.stabilizationMinutesRequired, 30);

  const tooSoon = assertStabilizationPeriod({
    environment: "production",
    restoreCompletedAt: "2026-09-14T10:00:00.000Z",
    serviceStabilizedAt: "2026-09-14T10:10:00.000Z",
    stabilizationMinutes: 30
  });
  assert.equal(tooSoon.ok, true);
  assert.equal(tooSoon.passed, false);
});

test("measureRpo pass when 3m <= 5m target; fail when 10m > 5m", () => {
  const pass = measureRpo({
    targetId: "RRT-001",
    targetRpoMinutes: 5,
    measuredRpoMinutes: 3,
    environment: "production"
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.failed, false);
  assert.equal(pass.measuredRpoMinutes, 3);
  assert.equal(pass.targetRpoMinutes, 5);

  const fail = measureRpo({
    targetId: "RRT-001",
    targetRpoMinutes: 5,
    measuredRpoMinutes: 10,
    environment: "production"
  });
  assert.equal(fail.ok, true);
  assert.equal(fail.passed, false);
  assert.equal(fail.failed, true);

  const fromTimestamps = measureRpo({
    targetRpoMinutes: 5,
    lastDurableCommitAt: "2026-09-14T12:00:00.000Z",
    recoveryPointAt: "2026-09-14T12:03:00.000Z"
  });
  assert.equal(fromTimestamps.ok, true);
  assert.equal(fromTimestamps.passed, true);
  assert.equal(fromTimestamps.measuredRpoMinutes, 3);
});

test("measureRto pass/fail vs target with stabilization", () => {
  const pass = measureRto({
    targetId: "RRT-002",
    targetRtoMinutes: 120,
    measuredRtoMinutes: 90,
    environment: "production",
    stabilizationMinutes: 30
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.stabilizationMinutesRequired, 30);

  const fail = measureRto({
    targetId: "RRT-001",
    targetRtoMinutes: 240,
    measuredRtoMinutes: 300,
    environment: "production"
  });
  assert.equal(fail.ok, true);
  assert.equal(fail.passed, false);

  const withStab = measureRto({
    targetRtoMinutes: 240,
    incidentDeclaredAt: "2026-09-14T08:00:00.000Z",
    restoreCompletedAt: "2026-09-14T10:00:00.000Z",
    serviceStabilizedAt: "2026-09-14T10:30:00.000Z",
    environment: "production",
    stabilizationMinutes: 30
  });
  assert.equal(withStab.ok, true);
  assert.equal(withStab.passed, true);
  assert.equal(withStab.measuredRtoMinutes, 150);

  const stabFail = measureRto({
    targetRtoMinutes: 240,
    incidentDeclaredAt: "2026-09-14T08:00:00.000Z",
    restoreCompletedAt: "2026-09-14T10:00:00.000Z",
    serviceStabilizedAt: "2026-09-14T10:05:00.000Z",
    environment: "production",
    stabilizationMinutes: 30
  });
  assert.equal(stabFail.ok, true);
  assert.equal(stabFail.passed, false);
});

test("exactly one accountableAuthority per RPO/RTO target; ownership matrix", () => {
  const batch = assertAccountableAuthorityPerTarget();
  assert.equal(batch.ok, true, batch.message);
  for (const t of RPO_RTO_TARGETS) {
    const r = assertSingleAccountableAuthority(t);
    assert.equal(r.ok, true, r.message);
    assert.equal(typeof t.accountableAuthority, "string");
    assert.ok(!("accountableAuthorities" in t));
    const own = assertTargetOwnership(t);
    assert.equal(own.ok, true, own.message);
    assert.notEqual(t.accountableAuthority, t.auditAuthority);
  }
  const matrix = ownershipMatrix();
  assert.equal(matrix.length, RPO_RTO_TARGETS.length);
  assert.ok(getRpoRtoTarget("RRT-003").service === "auth");
});

test("SoD: Accountable ≠ Audit for same decision; non-delegable rights", () => {
  const good = assertDecisionRightsSoD({
    accountableAuthority: "Platform Operations Lead",
    auditAuthority: "Internal Auditor",
    decision: "accept_recovery_measurement"
  });
  assert.equal(good.ok, true, good.message);

  const bad = assertDecisionRightsSoD({
    accountableAuthority: "Platform Operations Lead",
    auditAuthority: "Platform Operations Lead",
    decision: "accept_recovery_measurement"
  });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Segregation|duties|decision-rights/i);

  const nonDel = assertDecisionRightsSoD({
    accountableAuthority: "DR Steward",
    auditAuthority: "Internal Auditor",
    decision: "approve_production_failover",
    delegatedTo: "Release Manager"
  });
  assert.equal(nonDel.ok, false);
  assert.ok(DECISION_RIGHTS.nonDelegable.includes("approve_production_failover"));
  assert.ok(DECISION_RIGHTS.nonDelegable.includes("declare_disaster"));
});

test("validateMeasurementRecord and reporting metrics", () => {
  const okRec = validateMeasurementRecord({
    kind: "RPO",
    targetId: "RRT-001",
    targetRpoMinutes: 5,
    measuredRpoMinutes: 3,
    expectPass: true,
    accountableAuthority: "Data Platform Lead",
    auditAuthority: "Internal Auditor",
    decision: "accept_recovery_measurement"
  });
  assert.equal(okRec.ok, true, (okRec.errors || []).join("; "));

  const failRec = validateMeasurementRecord({
    kind: "RPO",
    targetId: "RRT-001",
    targetRpoMinutes: 5,
    measuredRpoMinutes: 10,
    expectPass: false
  });
  assert.equal(failRec.ok, true);

  const sodFail = validateMeasurementRecord({
    kind: "RTO",
    targetId: "RRT-002",
    measuredRtoMinutes: 60,
    targetRtoMinutes: 120,
    accountableAuthority: "Same Person",
    auditAuthority: "Same Person",
    decision: "accept_recovery_measurement"
  });
  assert.equal(sodFail.ok, false);

  const m = measureRpo({ targetRpoMinutes: 5, measuredRpoMinutes: 3 });
  const metrics = reportingMetricsFromMeasurement(m);
  assert.equal(metrics.recovery_measurement_pass, 1);
  assert.equal(metrics.measured_rpo_minutes, 3);

  const example = accountableAuthorityMetadataExample();
  assert.equal(example.schemaVersion, "1.0.0");
  assert.ok(example.boundaryMatrix.length >= 2);
  assert.equal(example.roles.auditAuthority, "Internal Auditor");
});
