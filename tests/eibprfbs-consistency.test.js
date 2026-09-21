/**
 * Phase 20 EIBPRFBS consistency — Modules 1–30, Phases 1–19, unique IDs,
 * ownership, readiness/certification/acceptance coverage, schemas, docs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EIBPRFBS_VERSION,
  MODULE_COUNT,
  PRIOR_PHASE_COUNT,
  PLATFORM_MODULE,
  MONEY_INVARIANTS,
  READINESS_CATEGORIES,
  CERTIFICATION_TYPES,
  ACCEPTANCE_TYPES,
  listModuleBaselines,
  listPhaseBaselines,
  listProductionReadinessChecks,
  listEnterpriseCertifications,
  listAcceptanceTypes,
  listFinalGovernance,
  listImplementationStages,
  assertIdUniqueness,
  assertModuleCoverage,
  assertPhaseCoverage,
  assertReadinessOwners,
  assertCertificationCompleteness,
  assertAcceptanceCompleteness,
  assertMoneyInvariants,
  assertModulesNotReplaced,
  validateBaselineRegistry,
  eibprfbsCounts
} from "../src/core/canonical-baseline-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function sha256File(relPath) {
  const buf = fs.readFileSync(path.join(DOCS, "schemas", relPath));
  return crypto.createHash("sha256").update(buf).digest("hex");
}

test("EIBPRFBS docs exist with baseline, readiness, certification, acceptance sections", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-implementation-baseline.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "eibprfbs-catalogs.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "phase20-final-validation-report.md")), true);

  const primary = read("enterprise-implementation-baseline.md");
  assert.match(primary, /EIBPRFBS|Implementation Blueprint/i);
  assert.match(primary, /Production readiness/i);
  assert.match(primary, /Traceability/i);
  assert.match(primary, /certification/i);
  assert.match(primary, /acceptance/i);
  assert.match(primary, /Long-term governance/i);
  assert.match(primary, /Phase 19/);
  assert.match(primary, /not redefine|not redefined|Consumed/i);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /specification baseline/i);
  assert.match(primary, /not.*live production|does \*\*not\*\* claim|not claim/i);
  assert.match(primary, /prepare:web|www\//);

  const catalogs = read("eibprfbs-catalogs.md");
  assert.match(catalogs, /BL-MOD-00|BL-PH-00|RDY-00|CERT-BL-00|ACC-00|GOV-BL-00/);
  assert.match(catalogs, /Modules 1–30|modules=30/i);
  assert.match(catalogs, /Phases 1–19|phases=19/i);

  const report = read("phase20-final-validation-report.md");
  assert.match(report, /Critical unresolved/);
  assert.match(report, /\*\*0\*\*|Critical unresolved\*\* \| \*\*0\*\*/);
  assert.match(report, /specification/i);
  assert.match(report, /not.*live production|Live production go-live claimed/i);
});

test("baseline schemas exist, Draft 2020-12, additionalProperties false, examples + manifest", () => {
  const files = [
    "enterprise-baseline-artifact.schema.json",
    "production-readiness-result.schema.json",
    "enterprise-certification.schema.json"
  ];
  for (const f of files) {
    const p = path.join(DOCS, "schemas", "baseline", f);
    assert.equal(fs.existsSync(p), true);
    const schema = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.equal(schema.$id, `https://schemas.smiletrust.com/baseline/${f}`);
    assert.match(schema.$schema, /draft\/2020-12/);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.$defs);
  }

  for (const rel of [
    "schemas/baseline/examples/valid/enterprise-baseline-artifact.valid.json",
    "schemas/baseline/examples/invalid/enterprise-baseline-artifact.invalid.json",
    "schemas/baseline/examples/valid/production-readiness-result.valid.json",
    "schemas/baseline/examples/invalid/production-readiness-result.invalid.json",
    "schemas/baseline/examples/valid/enterprise-certification.valid.json",
    "schemas/baseline/examples/invalid/enterprise-certification.invalid.json"
  ]) {
    const p = path.join(DOCS, rel);
    assert.equal(fs.existsSync(p), true);
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase20));
  assert.equal(manifest.phaseCoverage.phase20.length, 3);
  for (const schemaFile of files) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.sha256, sha256File(`baseline/${schemaFile}`));
  }
  assert.equal(manifest.constraints?.phase20DoesNotRedefinePhases1to19, true);
  assert.equal(manifest.constraints?.phase20DoesNotReplaceModules1to30, true);
  assert.equal(manifest.constraints?.phase20SpecificationBaselineOnly, true);
  assert.equal(manifest.constraints?.phase20NotStarted, undefined);
});

test("Modules 1–30 and Phases 1–19 present with unique IDs and ownership", () => {
  assert.equal(EIBPRFBS_VERSION, "1.0.0");
  assert.equal(PLATFORM_MODULE, 30);
  assert.equal(MODULE_COUNT, 30);
  assert.equal(PRIOR_PHASE_COUNT, 19);

  assert.equal(listModuleBaselines().length, 30);
  assert.equal(listPhaseBaselines().length, 19);
  assert.equal(assertModuleCoverage().ok, true);
  assert.equal(assertPhaseCoverage().ok, true);
  assert.equal(assertIdUniqueness().ok, true);
  assert.equal(assertReadinessOwners().ok, true);
  assert.equal(assertCertificationCompleteness().ok, true);
  assert.equal(assertAcceptanceCompleteness().ok, true);
  assert.equal(assertMoneyInvariants().ok, true);
  assert.equal(assertModulesNotReplaced().ok, true);

  for (let i = 1; i <= 30; i++) {
    const m = listModuleBaselines().find((x) => x.moduleId === i);
    assert.ok(m, `missing module ${i}`);
    assert.ok(m.accountableAuthority);
    assert.equal(m.enginesNotReplaced, true);
  }
  for (let i = 1; i <= 19; i++) {
    const p = listPhaseBaselines().find((x) => x.phaseNumber === i);
    assert.ok(p, `missing phase ${i}`);
    assert.ok(p.accountableAuthority);
    assert.equal(p.contentNotRedefined, true);
  }

  const validated = validateBaselineRegistry();
  assert.equal(validated.ok, true, validated.errors?.join("; "));

  const counts = eibprfbsCounts();
  assert.equal(counts.modules, 30);
  assert.equal(counts.phases, 19);
  assert.equal(counts.baselineArtifacts, 49);
  assert.equal(counts.readinessChecks, 20);
  assert.equal(counts.certifications, 10);
  assert.equal(counts.acceptanceTypes, 6);
  assert.equal(counts.finalGovernance, 8);
  assert.equal(counts.implementationStages, 16);
  assert.equal(READINESS_CATEGORIES.length, 11);
  assert.equal(CERTIFICATION_TYPES.length, 10);
  assert.equal(ACCEPTANCE_TYPES.length, 6);
  assert.equal(MONEY_INVARIANTS.defaultInterestPercent, 15);
  assert.equal(listFinalGovernance().length, 8);
  assert.equal(listImplementationStages().length, 16);
  assert.equal(listProductionReadinessChecks().filter((r) => r.mandatory).length, 18);
  assert.equal(listEnterpriseCertifications().length, 10);
  assert.equal(listAcceptanceTypes().length, 6);
});

test("Final Validation Report states Critical unresolved = 0", () => {
  const report = read("phase20-final-validation-report.md");
  assert.match(report, /Critical unresolved/);
  assert.match(report, /\*\*0\*\*/);
  assert.doesNotMatch(report, /Critical unresolved\*\* \| \*\*[1-9]/);
});
