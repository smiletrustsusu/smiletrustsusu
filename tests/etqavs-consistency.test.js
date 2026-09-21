/**
 * Phase 16 ETQAVS consistency — unique IDs, ownership, quality gate coverage,
 * cross-phase consistency (Phase 14 env promotion / Phase 15 RTO), docs, schemas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETQAVS_VERSION,
  BACKUP_ENGINE_MODULE,
  PLATFORM_MODULE,
  MONITORING_MODULE,
  AI_MODULE,
  STABILIZATION_MINUTES,
  PROMOTION_PATH,
  TEST_SUITES,
  QUALITY_GATES,
  THRESHOLDS,
  SAMPLE_WINDOWS,
  STRESS_PHASES,
  RECOVERY_LIMITS,
  CERTIFICATIONS,
  listTestSuites,
  listQualityGates,
  listThresholds,
  listRecoveryLimits,
  getQualityGate,
  getTestSuite,
  getRecoveryLimit,
  qualityGateForPromotion,
  assertIdUniqueness,
  assertSingleOwnerPerEntry,
  assertQualityGateCoverage,
  assertRefsResolve,
  assertCrossPhaseConsistency,
  assertModulesNotReplaced,
  validateTestingRegistry,
  etqavsCounts
} from "../src/core/canonical-testing-registry.js";
import { REQUIRED_ENV_CODES } from "../src/core/canonical-deployment-registry.js";
import { BUSINESS_SERVICES } from "../src/core/canonical-continuity-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

test("ETQAVS docs exist with strategy, gates, appendices A–D, Input & Dependency Rules", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-testing-qa-validation.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "etqavs-catalogs.md")), true);
  const primary = read("enterprise-testing-qa-validation.md");
  assert.match(primary, /ETQAVS|Enterprise Testing/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Quality [Gg]ates/);
  assert.match(primary, /Appendix A/i);
  assert.match(primary, /Appendix B/i);
  assert.match(primary, /Appendix C/i);
  assert.match(primary, /Appendix D/i);
  assert.match(primary, /Line Coverage[\s\S]*90%/);
  assert.match(primary, /95%.*confidence|Confidence Level[\s\S]*95%/i);
  assert.match(primary, /200%/);
  assert.match(primary, /Stabilization[\s\S]*30/);
  assert.match(primary, /Phase 14/);
  assert.match(primary, /Phase 15/);
  assert.match(primary, /Phase 9/);
  assert.match(primary, /Phase 12/);
  assert.match(primary, /Module 19/);
  assert.match(primary, /Module 21/);
  assert.match(primary, /Module 29/);
  assert.match(primary, /Module 30/);
  assert.match(primary, /not redefined|does not redefine|Consumed/i);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /advisory/i);

  const catalogs = read("etqavs-catalogs.md");
  assert.match(catalogs, /Quality Gate Registry|Test Suite Registry/);
  assert.match(catalogs, /QG-00|TSU-00|THR-00|RLIM-00/);
  assert.match(catalogs, /Phase 14|Phase 15/);
  assert.match(catalogs, /Module 21|Module 30/);
  assert.match(catalogs, /Cross-reference/);
});

test("testing schemas exist, Draft 2020-12, additionalProperties false, examples + manifest", () => {
  const qgPath = path.join(DOCS, "schemas", "testing", "quality-gate-result.schema.json");
  const certPath = path.join(DOCS, "schemas", "testing", "release-certification.schema.json");
  assert.equal(fs.existsSync(qgPath), true);
  assert.equal(fs.existsSync(certPath), true);

  const qg = JSON.parse(fs.readFileSync(qgPath, "utf8"));
  assert.equal(qg.$id, "https://schemas.smiletrust.com/testing/quality-gate-result.schema.json");
  assert.match(qg.$schema, /draft\/2020-12/);
  assert.equal(qg.additionalProperties, false);
  assert.ok(qg.$defs.thresholdResult);
  assert.ok(qg.$defs.governance);
  assert.ok(qg.$defs.evidence);
  assert.ok(Array.isArray(qg.allOf) && qg.allOf.length >= 1);

  const cert = JSON.parse(fs.readFileSync(certPath, "utf8"));
  assert.equal(
    cert.$id,
    "https://schemas.smiletrust.com/testing/release-certification.schema.json"
  );
  assert.equal(cert.additionalProperties, false);
  assert.ok(cert.$defs.recoveryEvidence);
  assert.ok(Array.isArray(cert.allOf) && cert.allOf.length >= 1);

  for (const rel of [
    "schemas/testing/examples/valid/quality-gate-result.valid.json",
    "schemas/testing/examples/invalid/quality-gate-result.invalid.json",
    "schemas/testing/examples/valid/release-certification.valid.json",
    "schemas/testing/examples/invalid/release-certification.invalid.json"
  ]) {
    const p = path.join(DOCS, rel);
    assert.equal(fs.existsSync(p), true);
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase16));
  for (const schemaFile of [
    "quality-gate-result.schema.json",
    "release-certification.schema.json"
  ]) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.phase, 16);
  }
  assert.equal(manifest.constraints?.phase16DoesNotRedefinePhase14EnvPromotion, true);
  assert.equal(manifest.constraints?.phase16DoesNotRedefinePhase15RpoRtoPolicy, true);
});

test("registry unique IDs, ownership, gate coverage, Phase 14/15 consistency", () => {
  assert.equal(ETQAVS_VERSION, "1.0.0");
  assert.equal(BACKUP_ENGINE_MODULE, 21);
  assert.equal(PLATFORM_MODULE, 30);
  assert.equal(MONITORING_MODULE, 19);
  assert.equal(AI_MODULE, 29);
  assert.equal(STABILIZATION_MINUTES, 30);

  const unique = assertIdUniqueness();
  assert.equal(unique.ok, true, unique.message);
  const owners = assertSingleOwnerPerEntry();
  assert.equal(owners.ok, true, owners.message);
  const gates = assertQualityGateCoverage();
  assert.equal(gates.ok, true, gates.message);
  const refs = assertRefsResolve();
  assert.equal(refs.ok, true, (refs.errors || []).join("; ") || refs.message);
  const mods = assertModulesNotReplaced();
  assert.equal(mods.ok, true, mods.message);

  const xp = assertCrossPhaseConsistency({
    phase14EnvCodes: REQUIRED_ENV_CODES.filter((c) => c !== "DR")
  });
  assert.equal(xp.ok, true, (xp.errors || []).join("; ") || xp.message);

  const result = validateTestingRegistry({
    phase14EnvCodes: ["DEV", "QA", "UAT", "STAGING", "PRODUCTION"]
  });
  assert.equal(result.ok, true, (result.errors || []).join("; "));

  assert.equal(listTestSuites().length, TEST_SUITES.length);
  assert.equal(listQualityGates().length, QUALITY_GATES.length);
  assert.equal(listThresholds().length, THRESHOLDS.length);
  assert.ok(getQualityGate("QG-001"));
  assert.ok(getTestSuite("SUITE_UNIT"));
  assert.ok(qualityGateForPromotion("DEV", "QA"));
  assert.ok(qualityGateForPromotion("STAGING", "PRODUCTION"));

  const completeDr = getRecoveryLimit("RLIM-012");
  assert.equal(completeDr.usesPhase15Rto, true);
  assert.equal(completeDr.maxMinutes, null);

  // Phase 15 services still own RTO policy — Phase 16 must not invent conflicting complete-DR minutes
  assert.ok(BUSINESS_SERVICES.length >= 1);
  assert.ok(BUSINESS_SERVICES.every((s) => Number.isFinite(s.rtoMinutes)));

  const counts = etqavsCounts();
  assert.equal(counts.suites, 17);
  assert.equal(counts.qualityGates, 4);
  assert.equal(counts.thresholds, 44);
  assert.equal(counts.sampleWindows, 13);
  assert.equal(counts.stressPhases, 9);
  assert.equal(counts.recoveryLimits, 12);
  assert.equal(counts.certifications, 2);
  assert.equal(SAMPLE_WINDOWS.length, 13);
  assert.equal(STRESS_PHASES.length, 9);
  assert.equal(RECOVERY_LIMITS.length, 12);
  assert.equal(CERTIFICATIONS.length, 2);
  assert.deepEqual(PROMOTION_PATH, ["DEV", "QA", "UAT", "STAGING", "PRODUCTION"]);
});

test("unit coverage threshold and line coverage ≥90 encoded", () => {
  const line = THRESHOLDS.find((t) => t.code === "THR_UNIT_LINE_COVERAGE");
  assert.ok(line);
  assert.equal(line.passValue, 90);
  assert.equal(line.comparator, "gte");
  const branch = THRESHOLDS.find((t) => t.code === "THR_UNIT_BRANCH_COVERAGE");
  assert.equal(branch.passValue, 85);
});
