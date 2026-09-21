/**
 * Phase 15 EBCBDRS consistency — unique IDs, Phase 14 alignment, Module 21/30
 * not replaced, docs sections, schema on disk.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EBCBDRS_VERSION,
  BACKUP_ENGINE_MODULE,
  DR_GOVERNANCE_MODULE,
  BACKUP_ENGINE_REF,
  DR_GOVERNANCE_REF,
  BUSINESS_SERVICES,
  BACKUP_POLICIES,
  RECOVERY_PLANS,
  DISASTER_CLASSES,
  CONTINUITY_TESTS,
  COMMUNICATION_CHANNELS,
  listBusinessServices,
  listBackupPolicies,
  listRecoveryPlans,
  listDisasterClasses,
  getBusinessService,
  getBackupPolicy,
  getRecoveryPlan,
  operationalRpoRtoMatrix,
  assertIdUniqueness,
  assertPhase14Alignment,
  assertRefsResolve,
  assertModulesNotReplaced,
  assertCriticalServicesPresent,
  validateContinuityRegistry,
  ebcbdrsCounts
} from "../src/core/canonical-continuity-registry.js";
import { listRpoRtoTargets, RPO_RTO_TARGETS } from "../src/core/canonical-deployment-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

test("EBCBDRS docs exist with BIA, backup, DR, Input & Dependency Rules, appendices", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-business-continuity-dr.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "ebcbdrs-catalogs.md")), true);
  const primary = read("enterprise-business-continuity-dr.md");
  assert.match(primary, /EBCBDRS|Enterprise Business Continuity/);
  assert.match(primary, /Business Impact Analysis|BIA/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Module 21/);
  assert.match(primary, /Module 30/);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /Phase 14/);
  assert.match(primary, /not redefined|does not redefine|Consumed/i);
  assert.match(primary, /Concrete RPO & RTO Target Matrix|Appendix A/i);
  assert.match(primary, /Breach Reporting|Appendix B/i);
  assert.match(primary, /Breach Reporting Payload|Appendix C/i);
  assert.match(primary, /Canonical JSON Schema|Appendix D/i);
  assert.match(primary, /failover|failback/i);
  assert.match(primary, /crisis communication/i);
  assert.match(primary, /prepare:web|www\//);

  const catalogs = read("ebcbdrs-catalogs.md");
  assert.match(catalogs, /Business Service Registry|Backup Policy Registry/);
  assert.match(catalogs, /Recovery Plan Registry|Disaster Classification/);
  assert.match(catalogs, /Continuity Test|Communication Registry/);
  assert.match(catalogs, /RPO \/ RTO Operational Matrix/);
  assert.match(catalogs, /Cross-reference/);
  assert.match(catalogs, /Module 21/);
  assert.match(catalogs, /Module 30/);
  assert.match(catalogs, /SVC-00|BKP-00|RCP-00|DIS-00/);
  assert.match(catalogs, /Phase 14|RRT-00/);
});

test("breach schema exists, parses, Draft 2020-12, additionalProperties false, $defs complete", () => {
  const schemaPath = path.join(
    DOCS,
    "schemas",
    "business-continuity",
    "rpo-rto-breach-report.schema.json"
  );
  assert.equal(fs.existsSync(schemaPath), true);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(
    schema.$id,
    "https://schemas.smiletrust.com/business-continuity/rpo-rto-breach-report.schema.json"
  );
  assert.match(schema.$schema, /draft\/2020-12/);
  assert.equal(schema.additionalProperties, false);
  const defs = schema.$defs || {};
  for (const key of [
    "service",
    "measurement",
    "classification",
    "timeline",
    "governance",
    "correctiveAction",
    "evidence",
    "metadata"
  ]) {
    assert.equal(typeof defs[key], "object", `missing $defs.${key}`);
  }
  assert.ok(Array.isArray(schema.allOf) && schema.allOf.length >= 1);

  const validPath = path.join(
    DOCS,
    "schemas",
    "business-continuity",
    "examples",
    "valid",
    "rpo-rto-breach-report.valid.json"
  );
  const invalidPath = path.join(
    DOCS,
    "schemas",
    "business-continuity",
    "examples",
    "invalid",
    "rpo-rto-breach-report.invalid.json"
  );
  assert.equal(fs.existsSync(validPath), true);
  assert.equal(fs.existsSync(invalidPath), true);
  const valid = JSON.parse(fs.readFileSync(validPath, "utf8"));
  const invalid = JSON.parse(fs.readFileSync(invalidPath, "utf8"));
  assert.equal(valid.kind, "Combined");
  assert.ok(Array.isArray(valid.correctiveActions) && valid.correctiveActions.length >= 1);
  assert.ok(Array.isArray(invalid._failureReasons) && invalid._failureReasons.length >= 1);

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  const entry = (manifest.schemas || []).find((s) =>
    String(s.path || "").includes("rpo-rto-breach-report.schema.json")
  );
  assert.ok(entry, "manifest must list breach schema");
  assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
});

test("registry unique IDs, helpers, Module 21/30 boundary, Phase 14 alignment", () => {
  assert.equal(EBCBDRS_VERSION, "1.0.0");
  assert.equal(BACKUP_ENGINE_MODULE, 21);
  assert.equal(DR_GOVERNANCE_MODULE, 30);
  assert.match(BACKUP_ENGINE_REF, /backup-recovery/);
  assert.match(DR_GOVERNANCE_REF, /platform-ops/);

  const unique = assertIdUniqueness();
  assert.equal(unique.ok, true, unique.message);
  const refs = assertRefsResolve();
  assert.equal(refs.ok, true, refs.message);
  const mods = assertModulesNotReplaced();
  assert.equal(mods.ok, true, mods.message);
  const crit = assertCriticalServicesPresent();
  assert.equal(crit.ok, true, crit.message);

  const align = assertPhase14Alignment(listRpoRtoTargets());
  assert.equal(align.ok, true, (align.errors || []).join("; ") || align.message);

  const result = validateContinuityRegistry({ phase14Targets: RPO_RTO_TARGETS });
  assert.equal(result.ok, true, (result.errors || []).join("; "));

  assert.equal(listBusinessServices().length, BUSINESS_SERVICES.length);
  assert.equal(listBackupPolicies().length, BACKUP_POLICIES.length);
  assert.equal(listRecoveryPlans().length, RECOVERY_PLANS.length);
  assert.equal(listDisasterClasses().length, DISASTER_CLASSES.length);
  assert.ok(getBusinessService("SVC-001"));
  assert.ok(getBusinessService("SVC_DATABASE"));
  assert.ok(getBackupPolicy("BKP-001"));
  assert.ok(getRecoveryPlan("RCP-004"));

  const matrix = operationalRpoRtoMatrix();
  assert.equal(matrix.length, BUSINESS_SERVICES.length);
  assert.ok(matrix.every((row) => row.phase14TargetId && Number.isFinite(row.rpoMinutes)));

  const counts = ebcbdrsCounts();
  assert.equal(counts.services, 10);
  assert.equal(counts.backupPolicies, 6);
  assert.equal(counts.recoveryPlans, 10);
  assert.equal(counts.disasterClasses, 5);
  assert.equal(CONTINUITY_TESTS.length, 4);
  assert.equal(COMMUNICATION_CHANNELS.length, 4);
});

test("technical service RPO/RTO minutes match Phase 14 RRT entries exactly", () => {
  const technical = new Set([
    "database",
    "application",
    "auth",
    "synchronization",
    "payments",
    "monitoring"
  ]);
  for (const svc of BUSINESS_SERVICES) {
    if (!technical.has(svc.serviceKey)) continue;
    const t = RPO_RTO_TARGETS.find((x) => x.id === svc.phase14TargetId);
    assert.ok(t, `${svc.id} missing Phase14 target`);
    assert.equal(svc.rpoMinutes, t.rpoMinutes, `${svc.id} rpo`);
    assert.equal(svc.rtoMinutes, t.rtoMinutes, `${svc.id} rto`);
  }
});
