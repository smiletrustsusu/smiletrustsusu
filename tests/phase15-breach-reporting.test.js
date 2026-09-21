/**
 * Phase 15 breach reporting — evaluate RPO/RTO/Combined, severity bands,
 * overallCompliance, CAPA for L2+, schema/examples on disk, measurement pass/fail.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  P15_BREACH_REPORTING_VERSION,
  SEVERITY_LEVELS,
  evaluateMetricBreach,
  evaluateBreach,
  severityFromPercentOver,
  percentOverTarget,
  capaRequiredForSeverity,
  buildBreachReportPayload,
  validateBreachReportPayload,
  computeComplianceKpis,
  measurementPassFail
} from "../src/core/phase15-breach-reporting.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("phase15 breach reporting version and severity bands", () => {
  assert.equal(P15_BREACH_REPORTING_VERSION, "1.0.0");
  assert.deepEqual(SEVERITY_LEVELS, ["Level0", "Level1", "Level2", "Level3", "Level4"]);
  assert.equal(severityFromPercentOver(0), "Level0");
  assert.equal(severityFromPercentOver(-5), "Level0");
  assert.equal(severityFromPercentOver(10), "Level1");
  assert.equal(severityFromPercentOver(10.1), "Level2");
  assert.equal(severityFromPercentOver(25), "Level2");
  assert.equal(severityFromPercentOver(25.1), "Level3");
  assert.equal(severityFromPercentOver(50), "Level3");
  assert.equal(severityFromPercentOver(50.1), "Level4");
  assert.equal(capaRequiredForSeverity("Level0"), false);
  assert.equal(capaRequiredForSeverity("Level1"), false);
  assert.equal(capaRequiredForSeverity("Level2"), true);
  assert.equal(capaRequiredForSeverity("Level4"), true);
});

test("evaluateMetricBreach and percentOverTarget", () => {
  assert.equal(percentOverTarget(5, 5), 0);
  assert.equal(percentOverTarget(10, 5), 100);

  const pass = evaluateMetricBreach({
    kind: "RPO",
    measuredMinutes: 3,
    targetMinutes: 5
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.breached, false);
  assert.equal(pass.severity, "Level0");
  assert.equal(pass.passFail, "pass");

  const fail = evaluateMetricBreach({
    kind: "RTO",
    measuredMinutes: 300,
    targetMinutes: 240
  });
  assert.equal(fail.ok, true);
  assert.equal(fail.breached, true);
  // (300-240)/240 = 25% → Level2 band (10%, 25%]
  assert.equal(severityFromPercentOver(25), "Level2");
  assert.equal(fail.severity, "Level2");
});

test("evaluateBreach RPO / RTO / Combined and overallCompliance", () => {
  const rpoOnly = evaluateBreach({
    kind: "RPO",
    serviceId: "SVC-001",
    measuredRpoMinutes: 3,
    targetRpoMinutes: 5
  });
  assert.equal(rpoOnly.ok, true);
  assert.equal(rpoOnly.breached, false);
  assert.equal(rpoOnly.overallCompliance, "compliant");
  assert.equal(rpoOnly.severity, "Level0");

  const rtoFail = evaluateBreach({
    kind: "RTO",
    serviceId: "SVC-002",
    measuredRtoMinutes: 200,
    targetRtoMinutes: 120
  });
  assert.equal(rtoFail.ok, true);
  assert.equal(rtoFail.breached, true);
  assert.equal(rtoFail.overallCompliance, "breached");
  // (200-120)/120 = 66.67% → Level4
  assert.equal(rtoFail.severity, "Level4");
  assert.equal(rtoFail.capaRequired, true);

  const combined = evaluateBreach({
    kind: "Combined",
    serviceId: "SVC-001",
    measuredRpoMinutes: 12,
    targetRpoMinutes: 5,
    measuredRtoMinutes: 200,
    targetRtoMinutes: 240
  });
  assert.equal(combined.ok, true);
  assert.equal(combined.breached, true);
  assert.equal(combined.overallCompliance, "breached");
  // RPO 140% over → L4; RTO pass → L0; max = L4
  assert.equal(combined.severity, "Level4");
  assert.equal(combined.rpo.passFail, "fail");
  assert.equal(combined.rto.passFail, "pass");
});

test("buildBreachReportPayload requires CAPA for L2+ and validates", () => {
  const built = buildBreachReportPayload({
    reportId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    incidentId: "INC-20260914-TEST",
    recoveryTargetId: "REC-TARGET-RRT-001",
    serviceId: "SVC-001",
    kind: "Combined",
    measuredRpoMinutes: 12,
    targetRpoMinutes: 5,
    measuredRtoMinutes: 200,
    targetRtoMinutes: 240,
    environment: "production",
    rootCauseCode: "BACKUP_STALE",
    detectedAt: "2026-09-14T10:00:00.000Z",
    declaredAt: "2026-09-14T10:05:00.000Z",
    restoredAt: "2026-09-14T12:30:00.000Z",
    stabilizedAt: "2026-09-14T13:00:00.000Z",
    reportedAt: "2026-09-14T13:15:00.000Z",
    evidence: [{ type: "backup_set", reference: "set-1" }]
  });
  assert.equal(built.ok, true);
  const { payload } = built;
  assert.equal(payload.classification.severity, "Level4");
  assert.equal(payload.classification.capaRequired, true);
  assert.ok(payload.correctiveActions.length >= 1);
  assert.equal(payload.classification.overallCompliance, "breached");

  const valid = validateBreachReportPayload(payload);
  assert.equal(valid.ok, true, (valid.errors || []).join("; "));

  const noCapa = {
    ...payload,
    correctiveActions: [],
    classification: { ...payload.classification, severity: "Level2", capaRequired: true }
  };
  const bad = validateBreachReportPayload(noCapa);
  assert.equal(bad.ok, false);
  assert.ok((bad.errors || []).some((e) => /correctiveActions/i.test(e)));
});

test("measurementPassFail helper", () => {
  const pass = measurementPassFail(3, 5);
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.passFail, "pass");

  const fail = measurementPassFail(10, 5);
  assert.equal(fail.ok, true);
  assert.equal(fail.failed, true);
  assert.equal(fail.passFail, "fail");
  assert.equal(fail.percentOverTarget, 100);
});

test("computeComplianceKpis roll-up", () => {
  const a = evaluateBreach({
    kind: "RPO",
    measuredRpoMinutes: 3,
    targetRpoMinutes: 5
  });
  const b = evaluateBreach({
    kind: "RTO",
    measuredRtoMinutes: 300,
    targetRtoMinutes: 240
  });
  const kpis = computeComplianceKpis([a, b]);
  assert.equal(kpis.measured, 2);
  assert.equal(kpis.compliant, 1);
  assert.equal(kpis.breached, 1);
  assert.equal(kpis.overallCompliance, "breached");
  assert.equal(kpis.complianceRate, 0.5);
});

test("schema file exists and parses; valid and invalid examples present", () => {
  const schemaPath = path.join(
    ROOT,
    "docs",
    "schemas",
    "business-continuity",
    "rpo-rto-breach-report.schema.json"
  );
  assert.equal(fs.existsSync(schemaPath), true);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(typeof schema, "object");
  assert.ok(schema.$defs.service);
  assert.ok(schema.$defs.measurement);
  assert.ok(schema.$defs.classification);
  assert.ok(schema.$defs.timeline);
  assert.ok(schema.$defs.governance);
  assert.ok(schema.$defs.correctiveAction);
  assert.ok(schema.$defs.evidence);
  assert.ok(schema.$defs.metadata);

  const validPath = path.join(
    ROOT,
    "docs",
    "schemas",
    "business-continuity",
    "examples",
    "valid",
    "rpo-rto-breach-report.valid.json"
  );
  const invalidPath = path.join(
    ROOT,
    "docs",
    "schemas",
    "business-continuity",
    "examples",
    "invalid",
    "rpo-rto-breach-report.invalid.json"
  );
  assert.equal(fs.existsSync(validPath), true);
  assert.equal(fs.existsSync(invalidPath), true);
  JSON.parse(fs.readFileSync(validPath, "utf8"));
  JSON.parse(fs.readFileSync(invalidPath, "utf8"));
});
