/**
 * Master Implementation Backlog consistency — coverage, IDs, parents,
 * dependencies, enums, validateMasterBacklog critical=0.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  MIB_VERSION,
  PROGRAM,
  BACKLOG_ITEMS,
  BACKLOG_STATUSES,
  BACKLOG_PRIORITIES,
  BACKLOG_COMPLEXITIES,
  BACKLOG_STORY_POINTS,
  BACKLOG_RISK_LEVELS,
  CANONICAL_BACKLOG_STATUSES,
  listBacklogItems,
  getBacklogItem,
  listByModule,
  listByPhase,
  listByStatus,
  listByWave,
  backlogCountsByType,
  backlogStatusSummary,
  listAuditGapMappings,
  validateMasterBacklog,
  toCanonicalStatus
} from "../src/core/master-backlog-registry.js";
import { IMPLEMENTATION_WAVES } from "../src/core/master-backlog-waves.js";
import { USER_DELIVERY_WAVES } from "../src/core/master-backlog-delivery-waves.js";

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

test("MIB docs exist and link Phase 20 without redefining modules/phases", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "master-implementation-backlog.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "mib-catalogs.md")), true);

  const primary = read("master-implementation-backlog.md");
  assert.match(primary, /Master Implementation Backlog/i);
  assert.match(primary, /PRG-0001/);
  assert.match(primary, /PH-001|PH-020/);
  assert.match(primary, /MOD-001|MOD-030/);
  assert.match(primary, /implementation.?order|Wave/i);
  assert.match(primary, /not redefine|not replaced|engines referenced/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /master-backlog-registry/);
  assert.match(primary, /Audit reconciliation|gap-register-reconciled/i);

  const baseline = read("enterprise-implementation-baseline.md");
  assert.match(baseline, /master-implementation-backlog\.md/);
  assert.match(baseline, /Execution backlog SoT|master-backlog-registry/);

  const catalogs = read("mib-catalogs.md");
  assert.match(catalogs, /Wave|MOD-|PH-|EPC-|FEAT-/);
  assert.match(catalogs, /734|GAP-001/);

  assert.equal(fs.existsSync(path.join(DOCS, "backlog", "gap-register-reconciled.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "backlog", "wave-execution-plan.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "backlog", "critical-path-report.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "backlog", "release-readiness-dashboard.md")), true);
});

test("backlog schema Draft 2020-12, examples, manifest sha256", () => {
  const schemaPath = path.join(DOCS, "schemas", "backlog", "backlog-item.schema.json");
  assert.equal(fs.existsSync(schemaPath), true);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(schema.$id, "https://schemas.smiletrust.com/backlog/backlog-item.schema.json");
  assert.match(schema.$schema, /draft\/2020-12/);
  assert.equal(schema.additionalProperties, false);
  assert.ok(Array.isArray(schema.required));
  assert.ok(schema.required.includes("identifier"));
  assert.ok(schema.required.includes("owner"));
  assert.ok(schema.required.includes("dependencies"));

  for (const rel of [
    "schemas/backlog/examples/valid/backlog-item.valid.json",
    "schemas/backlog/examples/invalid/backlog-item.invalid.json"
  ]) {
    assert.equal(fs.existsSync(path.join(DOCS, rel)), true);
    const body = JSON.parse(fs.readFileSync(path.join(DOCS, rel), "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    } else {
      assert.match(String(body.identifier), /^(USR|TASK|FEAT|EPC)-/);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.backlog));
  assert.equal(manifest.phaseCoverage.backlog.length, 1);
  const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes("backlog-item.schema.json"));
  assert.ok(entry, "manifest must list backlog-item.schema.json");
  assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
  assert.equal(entry.sha256, sha256File("backlog/backlog-item.schema.json"));
  assert.equal(manifest.constraints?.mibDoesNotRedefinePhases1to20, true);
  assert.equal(manifest.constraints?.mibDoesNotReplaceModules1to30, true);
  assert.equal(manifest.constraints?.mibIsExecutionBacklogSoT, true);
});

test("program, phases PH-001..020, modules MOD-001..030 coverage", () => {
  assert.equal(MIB_VERSION, "1.1.0");
  assert.ok(PROGRAM);
  assert.equal(PROGRAM.identifier, "PRG-0001");
  assert.equal(PROGRAM.parentIdentifier, null);

  for (let i = 1; i <= 20; i++) {
    const id = `PH-${String(i).padStart(3, "0")}`;
    const item = getBacklogItem(id);
    assert.ok(item, `missing ${id}`);
    assert.equal(item.parentIdentifier, "PRG-0001");
  }
  for (let i = 1; i <= 30; i++) {
    const id = `MOD-${String(i).padStart(3, "0")}`;
    const item = getBacklogItem(id);
    assert.ok(item, `missing ${id}`);
    assert.equal(item.parentIdentifier, "PRG-0001");
  }

  assert.equal(IMPLEMENTATION_WAVES.length, 20);
  assert.equal(listByWave(1).length >= 1, true);
  assert.equal(listByModule("MOD-006").length >= 1, true);
  assert.equal(listByPhase("PH-020").length >= 1, true);
  assert.ok(listByStatus("Completed").length >= 1);
});

test("ID uniqueness, parent integrity, dependency resolution, enums", () => {
  const ids = new Set();
  for (const item of listBacklogItems()) {
    assert.equal(ids.has(item.identifier), false, `duplicate ${item.identifier}`);
    ids.add(item.identifier);

    assert.ok(BACKLOG_STATUSES.includes(item.status), item.identifier);
    assert.ok(BACKLOG_PRIORITIES.includes(item.priority), item.identifier);
    assert.ok(BACKLOG_COMPLEXITIES.includes(item.complexity), item.identifier);
    assert.ok(BACKLOG_STORY_POINTS.includes(item.storyPoints), item.identifier);
    assert.ok(BACKLOG_RISK_LEVELS.includes(item.riskLevel), item.identifier);
    assert.ok(item.owner && String(item.owner).trim().length > 0, item.identifier);

    if (item.identifier !== "PRG-0001") {
      assert.ok(item.parentIdentifier, `orphan ${item.identifier}`);
      assert.ok(getBacklogItem(item.parentIdentifier), `missing parent for ${item.identifier}`);
    }

    const deps = item.dependencies || {};
    for (const key of Object.keys(deps)) {
      for (const depId of deps[key] || []) {
        assert.ok(getBacklogItem(depId), `unresolved ${key} ${depId} on ${item.identifier}`);
      }
    }

    for (const field of [
      "acceptanceCriteria",
      "validationRequirements",
      "testCases",
      "uiScreens",
      "apis",
      "databaseTables",
      "databaseViews",
      "databaseFunctions",
      "storedProcedures",
      "reports",
      "dashboards",
      "securityControls",
      "auditRequirements",
      "documentationReferences",
      "relatedEnterprisePhaseReferences",
      "relatedModuleReferences",
      "blockers"
    ]) {
      assert.ok(Array.isArray(item[field]), `${item.identifier}.${field}`);
    }
  }
  assert.equal(ids.size, BACKLOG_ITEMS.length);
});

test("scale bands and wave epics present", () => {
  const counts = backlogCountsByType();
  assert.equal(counts.PRG, 1);
  assert.equal(counts.PH, 20);
  assert.equal(counts.MOD, 30);
  assert.ok(counts.EPC >= 60 && counts.EPC <= 120, `EPC=${counts.EPC}`);
  assert.ok(counts.FEAT >= 150 && counts.FEAT <= 300, `FEAT=${counts.FEAT}`);
  const leaf = (counts.USR || 0) + (counts.TASK || 0);
  assert.ok(leaf >= 200 && leaf <= 400, `USR+TASK=${leaf}`);

  const waveEpics = listBacklogItems().filter((i) => i.identifier.startsWith("EPC-") && i.wave != null);
  assert.equal(waveEpics.length, 20);
});

test("validateMasterBacklog critical=0", () => {
  const result = validateMasterBacklog();
  assert.equal(result.ok, true);
  assert.equal(result.critical, 0);
  assert.ok(result.counts.PRG === 1);
  const summary = backlogStatusSummary();
  assert.ok(summary.total === listBacklogItems().length);
  assert.ok(summary.completed >= 1);
  assert.ok(summary.open >= 1);
});

test("audit gaps GAP-001..027 map to unique active backlog items", () => {
  const mappings = listAuditGapMappings();
  for (let i = 1; i <= 27; i++) {
    const gapId = `GAP-${String(i).padStart(3, "0")}`;
    const active = (mappings[gapId] || []).filter((x) => x.status !== "Cancelled");
    assert.equal(active.length, 1, `${gapId} expected 1 active item, got ${active.length}`);
    assert.ok(active[0].owner && active[0].owner.trim());
    assert.ok(active[0].priority);
    assert.ok(CANONICAL_BACKLOG_STATUSES.includes(toCanonicalStatus(active[0].status)));
    assert.ok(active[0].deliveryWave >= 1 && active[0].deliveryWave <= 10);
  }
  assert.equal(USER_DELIVERY_WAVES.length, 10);
});

test("canonical statuses used on all items after normalize", () => {
  for (const item of listBacklogItems()) {
    assert.ok(CANONICAL_BACKLOG_STATUSES.includes(item.status), `${item.identifier} status=${item.status}`);
  }
});
