/**
 * Phase 20 baseline validation — validateEnterpriseBaseline critical===0,
 * readiness fail-closed, certification expiry rules.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P20_BASELINE_VALIDATION_VERSION,
  EIBPRFBS_VERSION,
  PHASE16_GATE_EXCEPTION_RULE,
  MONEY_INVARIANTS,
  validateEnterpriseBaseline,
  evaluateProductionReadiness,
  evaluateReadinessFailClosed,
  evaluateCertificationValidity,
  isExceptionValid
} from "../src/core/phase20-baseline-validation.js";
import {
  listProductionReadinessChecks,
  listEnterpriseCertifications
} from "../src/core/canonical-baseline-registry.js";

test("phase20 versions and money invariants", () => {
  assert.equal(P20_BASELINE_VALIDATION_VERSION, "1.0.0");
  assert.equal(EIBPRFBS_VERSION, "1.0.0");
  assert.equal(PHASE16_GATE_EXCEPTION_RULE, "emergency_exception_approved");
  assert.equal(MONEY_INVARIANTS.amountUnit, "pesewas");
  assert.equal(MONEY_INVARIANTS.defaultInterestPercent, 15);
  assert.equal(MONEY_INVARIANTS.collectionCycleDays, 31);
  assert.equal(MONEY_INVARIANTS.cashierFloatLimit, 1000);
});

test("validateEnterpriseBaseline critical === 0", async () => {
  const result = await validateEnterpriseBaseline();
  assert.equal(result.ok, true, result.critical.join("; "));
  assert.equal(result.critical.length, 0, result.critical.join("; "));
  assert.equal(result.summary.criticalCount, 0);
  assert.equal(result.summary.modules, 30);
  assert.equal(result.summary.phases, 19);
  assert.equal(result.summary.specificationBaselinePublicationReady, true);
  assert.equal(result.summary.liveProductionGoLiveClaimed, false);
  assert.ok(Array.isArray(result.warnings));
});

test("readiness fails closed when mandatory gate missing", () => {
  const checks = listProductionReadinessChecks().filter((c) => c.mandatory);
  assert.ok(checks.length >= 1);
  const partial = {};
  for (const c of checks.slice(0, 3)) {
    partial[c.id] = "pass";
  }
  // omit the rest → fail closed
  const evalResult = evaluateProductionReadiness({ checkResults: partial });
  assert.equal(evalResult.ready, false);
  assert.equal(evalResult.failClosed, true);
  assert.ok(evalResult.failures.length > 0);
  assert.ok(evalResult.failures.some((f) => f.reason === "mandatory_gate_missing"));

  const wrapped = evaluateReadinessFailClosed(partial);
  assert.equal(wrapped.ok, false);
});

test("readiness passes when all mandatory pass", () => {
  const checkResults = {};
  for (const c of listProductionReadinessChecks()) {
    if (c.mandatory) checkResults[c.id] = "pass";
    else checkResults[c.id] = "pass";
  }
  const evalResult = evaluateProductionReadiness({ checkResults });
  assert.equal(evalResult.ready, true);
  assert.equal(evalResult.failClosed, false);
  assert.equal(evalResult.failures.length, 0);
});

test("readiness allows approved exception for mandatory gate", () => {
  const checkResults = {};
  const exceptions = {};
  for (const c of listProductionReadinessChecks()) {
    if (c.id === "RDY-003") {
      checkResults[c.id] = "fail";
      exceptions[c.id] = {
        state: "approved",
        rule: PHASE16_GATE_EXCEPTION_RULE,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: "2026-12-31T23:59:59.000Z"
      };
    } else {
      checkResults[c.id] = "pass";
    }
  }
  const evalResult = evaluateProductionReadiness({
    checkResults,
    exceptions,
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(evalResult.ready, true);
  assert.ok(evalResult.exceptionApproved.includes("RDY-003"));
});

test("expired exception does not satisfy mandatory gate", () => {
  assert.equal(
    isExceptionValid(
      {
        state: "approved",
        rule: PHASE16_GATE_EXCEPTION_RULE,
        validTo: "2026-01-01T00:00:00.000Z"
      },
      "2026-09-15T12:00:00.000Z"
    ),
    false
  );

  const checkResults = {};
  for (const c of listProductionReadinessChecks()) {
    checkResults[c.id] = c.id === "RDY-003" ? "fail" : "pass";
  }
  const evalResult = evaluateProductionReadiness({
    checkResults,
    exceptions: {
      "RDY-003": {
        state: "approved",
        rule: PHASE16_GATE_EXCEPTION_RULE,
        validTo: "2026-01-01T00:00:00.000Z"
      }
    },
    asOf: "2026-09-15T12:00:00.000Z"
  });
  assert.equal(evalResult.ready, false);
});

test("certification expiry requires renewal", () => {
  const cert = listEnterpriseCertifications()[0];
  assert.ok(cert);

  const valid = evaluateCertificationValidity({
    certificationId: cert.id,
    issuedAt: "2026-09-15T00:00:00.000Z",
    asOf: "2026-09-20T00:00:00.000Z"
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.valid, true);
  assert.ok(valid.entryCriteria.length >= 1);
  assert.ok(valid.approvalRoles.length >= 1);

  const expired = evaluateCertificationValidity({
    certificationId: cert.id,
    issuedAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-06-01T00:00:00.000Z",
    asOf: "2026-09-15T00:00:00.000Z",
    renewed: false
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "P20-CERT-003");

  const renewed = evaluateCertificationValidity({
    certificationId: cert.id,
    issuedAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-06-01T00:00:00.000Z",
    asOf: "2026-09-15T00:00:00.000Z",
    renewed: true
  });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.valid, true);

  const unknown = evaluateCertificationValidity({ certificationId: "CERT-BL-999" });
  assert.equal(unknown.ok, false);
});
