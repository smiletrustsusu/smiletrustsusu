/**
 * Phase 19 EGCCRMS consistency — unique IDs, ownership, change/CI/release coverage,
 * lifecycle states, cross-phase consistency, schemas, modules not replaced.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EGCCRMS_VERSION,
  PLATFORM_MODULE,
  CONFIG_POLICY_PHASE,
  DEPLOYMENT_PHASE,
  TESTING_PHASE,
  OPERATIONS_PHASE,
  PHASE16_GATE_EXCEPTION_RULE,
  CHANGE_CLASSES,
  CHANGE_DOMAINS,
  CI_CATEGORIES,
  RELEASE_TYPES,
  POLICY_LIFECYCLE,
  listGovernanceRoles,
  listCommittees,
  listChangeTypes,
  listConfigurationItems,
  listReleaseTypes,
  listPolicies,
  listGovernanceWorkflows,
  listExceptions,
  assertIdUniqueness,
  assertSingleOwnerPerEntry,
  assertExactlyOneAccountableAuthority,
  assertRefsResolve,
  assertChangeTypeCoverage,
  assertCiCategoryCoverage,
  assertReleaseTypeCoverage,
  assertPolicyLifecycleStates,
  assertCrossPhaseConsistency,
  assertModulesNotReplaced,
  validateGovernanceRegistry,
  egccrmsCounts
} from "../src/core/canonical-governance-registry.js";

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

test("EGCCRMS docs exist with governance, change, config, release sections", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-governance-change-release.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "egccrms-catalogs.md")), true);
  const primary = read("enterprise-governance-change-release.md");
  assert.match(primary, /EGCCRMS|Enterprise Governance/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Change management/i);
  assert.match(primary, /Standard|Normal|Emergency/);
  assert.match(primary, /Configuration management/i);
  assert.match(primary, /Release management/i);
  assert.match(primary, /Major|Minor|Patch|Hotfix/);
  assert.match(primary, /Version governance/i);
  assert.match(primary, /Compliance/i);
  assert.match(primary, /Policy.*lifecycle|Draft.*Review.*Approved/i);
  assert.match(primary, /Governance workflow/i);
  assert.match(primary, /Cross-reference/);
  assert.match(primary, /Phase 8/);
  assert.match(primary, /Phase 14/);
  assert.match(primary, /Phase 16/);
  assert.match(primary, /Phase 18/);
  assert.match(primary, /Module 30/);
  assert.match(primary, /Phase 20/);
  assert.match(primary, /not redefined|does not redefine|Consumed/i);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /emergency_exception_approved/);

  const catalogs = read("egccrms-catalogs.md");
  assert.match(catalogs, /Change Types|Configuration Items|Release Types/i);
  assert.match(catalogs, /CHG-00|CI-00|REL-00|GWF-00|EXC-00/);
  assert.match(catalogs, /Phase 14|Phase 16|Module 30/);
  assert.match(catalogs, /Phase 20/);
  assert.match(catalogs, /Cross-reference/);
});

test("governance schemas exist, Draft 2020-12, additionalProperties false, examples + manifest", () => {
  const files = [
    "change-request.schema.json",
    "configuration-item.schema.json",
    "release-record.schema.json"
  ];
  for (const f of files) {
    const p = path.join(DOCS, "schemas", "governance", f);
    assert.equal(fs.existsSync(p), true);
    const schema = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.equal(schema.$id, `https://schemas.smiletrust.com/governance/${f}`);
    assert.match(schema.$schema, /draft\/2020-12/);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.$defs);
  }

  for (const rel of [
    "schemas/governance/examples/valid/change-request.valid.json",
    "schemas/governance/examples/invalid/change-request.invalid.json",
    "schemas/governance/examples/valid/configuration-item.valid.json",
    "schemas/governance/examples/invalid/configuration-item.invalid.json",
    "schemas/governance/examples/valid/release-record.valid.json",
    "schemas/governance/examples/invalid/release-record.invalid.json"
  ]) {
    const p = path.join(DOCS, rel);
    assert.equal(fs.existsSync(p), true);
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const crSchema = JSON.parse(
    fs.readFileSync(path.join(DOCS, "schemas", "governance", "change-request.schema.json"), "utf8")
  );
  for (const cls of ["standard", "normal", "emergency"]) {
    assert.ok(crSchema.$defs.changeClass.enum.includes(cls));
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase19));
  assert.equal(manifest.phaseCoverage.phase19.length, 3);
  for (const schemaFile of files) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.sha256, sha256File(`governance/${schemaFile}`));
  }
  assert.equal(manifest.constraints?.phase19DoesNotRedefinePhase8Config, true);
  assert.equal(manifest.constraints?.phase19DoesNotRedefinePhase14Deployment, true);
  assert.equal(manifest.constraints?.phase19DoesNotRedefinePhase16Testing, true);
  assert.equal(manifest.constraints?.phase19DoesNotRedefinePhase18Ops, true);
  assert.equal(manifest.constraints?.phase19DoesNotReplaceModule30, true);
  assert.equal(manifest.constraints?.phase20DoesNotRedefinePhases1to19, true);
  assert.equal(manifest.constraints?.phase20SpecificationBaselineOnly, true);
});

test("registry uniqueness, ownership, coverage, cross-phase", () => {
  assert.equal(EGCCRMS_VERSION, "1.0.0");
  assert.equal(PLATFORM_MODULE, 30);
  assert.equal(CONFIG_POLICY_PHASE, 8);
  assert.equal(DEPLOYMENT_PHASE, 14);
  assert.equal(TESTING_PHASE, 16);
  assert.equal(OPERATIONS_PHASE, 18);
  assert.equal(PHASE16_GATE_EXCEPTION_RULE, "emergency_exception_approved");

  assert.equal(assertIdUniqueness().ok, true);
  assert.equal(assertSingleOwnerPerEntry().ok, true);
  assert.equal(assertExactlyOneAccountableAuthority().ok, true);
  assert.equal(assertRefsResolve().ok, true);
  assert.equal(assertChangeTypeCoverage().ok, true);
  assert.equal(assertCiCategoryCoverage().ok, true);
  assert.equal(assertReleaseTypeCoverage().ok, true);
  assert.equal(assertPolicyLifecycleStates().ok, true);
  assert.equal(assertCrossPhaseConsistency().ok, true);
  assert.equal(assertModulesNotReplaced().ok, true);

  const validated = validateGovernanceRegistry();
  assert.equal(validated.ok, true, validated.errors?.join("; "));

  assert.equal(CHANGE_CLASSES.length, 3);
  assert.equal(CHANGE_DOMAINS.length, 7);
  assert.equal(CI_CATEGORIES.length, 12);
  assert.equal(RELEASE_TYPES.length, 5);
  assert.equal(POLICY_LIFECYCLE.length, 6);

  const counts = egccrmsCounts();
  assert.equal(counts.roles, listGovernanceRoles().length);
  assert.equal(counts.committees, listCommittees().length);
  assert.equal(counts.changeTypes, listChangeTypes().length);
  assert.equal(counts.configurationItems, listConfigurationItems().length);
  assert.equal(counts.releaseTypes, listReleaseTypes().length);
  assert.equal(counts.policies, listPolicies().length);
  assert.equal(counts.workflows, listGovernanceWorkflows().length);
  assert.equal(counts.exceptions, listExceptions().length);
  assert.equal(counts.crossRefs, 30);
  assert.ok(counts.changeTypes >= 7);
  assert.ok(counts.configurationItems >= 11);
  assert.ok(counts.workflows >= 5);
});

test("emergency change types align Phase 14/16 exception patterns", () => {
  const emergency = listChangeTypes().filter((c) => c.changeClass === "emergency");
  assert.ok(emergency.length >= 3);
  for (const e of emergency) {
    assert.equal(e.ecabRequired, true);
    assert.equal(e.requiresExceptionId, true);
    assert.equal(e.phase14EmergencyAlign, true);
    assert.equal(e.phase16Bypass, "emergency_exception_approved");
    assert.equal(e.pirRequired, true);
  }
  const hotfix = listReleaseTypes().find((r) => r.releaseType === "hotfix");
  const emergRel = listReleaseTypes().find((r) => r.releaseType === "emergency");
  assert.equal(hotfix.requiresException, true);
  assert.equal(hotfix.certificationId, "CERT-002");
  assert.equal(emergRel.phase14EmergencyAlign, true);
  assert.equal(emergRel.phase16Bypass, "emergency_exception_approved");
});
