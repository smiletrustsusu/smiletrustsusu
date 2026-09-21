/**
 * Enterprise Implementation Roadmap consistency — 10 waves, full MIB
 * coverage (exactly-once mapping), sequential deps, quality gates,
 * validateEnterpriseRoadmap critical=0.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EIR_VERSION,
  EIR_DOC,
  IMPLEMENTATION_ROADMAP_WAVES,
  MIB_WAVE_TO_EIR,
  listWaves,
  getWave,
  listBacklogForWave,
  getWaveForBacklogItem,
  validateEnterpriseRoadmap,
  waveBacklogCounts,
  criticalPathWaves,
  listRoadmapRisks,
  qualityGateMatrix,
  estimateTotalDurationWeeks
} from "../src/core/enterprise-roadmap-registry.js";
import { listBacklogItems, backlogStatusSummary } from "../src/core/master-backlog-registry.js";
import { IMPLEMENTATION_WAVES } from "../src/core/master-backlog-waves.js";

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

test("EIR docs exist and link MIB / Phase 20 without redefining modules/phases", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-implementation-roadmap.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "eir-catalogs.md")), true);

  const primary = read("enterprise-implementation-roadmap.md");
  assert.match(primary, /Enterprise Implementation Roadmap/i);
  assert.match(primary, /WAVE-01/);
  assert.match(primary, /WAVE-10/);
  assert.match(primary, /Executive Summary/i);
  assert.match(primary, /Wave Overview Table/i);
  assert.match(primary, /Detailed Wave Specifications/i);
  assert.match(primary, /Dependency Matrix/i);
  assert.match(primary, /Critical Path Analysis/i);
  assert.match(primary, /Resource Plan/i);
  assert.match(primary, /Risk Register/i);
  assert.match(primary, /Quality Gate Matrix/i);
  assert.match(primary, /Release Roadmap/i);
  assert.match(primary, /Implementation Timeline/i);
  assert.match(primary, /Final Readiness Checklist/i);
  assert.match(primary, /master-implementation-backlog/);
  assert.match(primary, /enterprise-implementation-baseline/);
  assert.match(primary, /not redefine|does not redefine|engines not replaced|not invent a second backlog/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /enterprise-roadmap-registry/);
  assert.match(primary, /Mostly Complete|In Progress|Planned/);

  const catalogs = read("eir-catalogs.md");
  assert.match(catalogs, /WAVE-01|mapping counts|Quality gates/i);
  assert.match(catalogs, /734|698|mapped items/i);

  const mib = read("master-implementation-backlog.md");
  assert.match(mib, /enterprise-implementation-roadmap\.md/);

  const baseline = read("enterprise-implementation-baseline.md");
  assert.match(baseline, /enterprise-implementation-roadmap\.md/);
});

test("roadmap schema Draft 2020-12, examples, manifest sha256", () => {
  const schemaPath = path.join(DOCS, "schemas", "roadmap", "implementation-wave.schema.json");
  assert.equal(fs.existsSync(schemaPath), true);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(schema.$id, "https://schemas.smiletrust.com/roadmap/implementation-wave.schema.json");
  assert.match(schema.$schema, /draft\/2020-12/);
  assert.equal(schema.additionalProperties, false);
  assert.ok(Array.isArray(schema.required));
  assert.ok(schema.required.includes("id"));
  assert.ok(schema.required.includes("qualityGates"));
  assert.ok(schema.required.includes("mibWaves"));
  assert.ok(schema.required.includes("moneyInvariantNote"));

  for (const rel of [
    "schemas/roadmap/examples/valid/implementation-wave.valid.json",
    "schemas/roadmap/examples/invalid/implementation-wave.invalid.json"
  ]) {
    assert.equal(fs.existsSync(path.join(DOCS, rel)), true);
    const body = JSON.parse(fs.readFileSync(path.join(DOCS, rel), "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    } else {
      assert.match(String(body.id), /^WAVE-(0[1-9]|10)$/);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.roadmap));
  assert.equal(manifest.phaseCoverage.roadmap.length, 1);
  const entry = (manifest.schemas || []).find((s) =>
    String(s.path || "").includes("implementation-wave.schema.json")
  );
  assert.ok(entry, "manifest must list implementation-wave.schema.json");
  assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
  assert.equal(entry.sha256, sha256File("roadmap/implementation-wave.schema.json"));
  assert.equal(manifest.constraints?.eirDoesNotRedefinePhases1to20, true);
  assert.equal(manifest.constraints?.eirDoesNotReplaceModules1to30, true);
  assert.equal(manifest.constraints?.eirDoesNotInventSecondBacklog, true);
  assert.equal(manifest.constraints?.eirMapsMibToTenDeliveryWaves, true);
});

test("exactly 10 waves WAVE-01..WAVE-10 with structured fields", () => {
  assert.equal(EIR_VERSION, "1.0.0");
  assert.equal(EIR_DOC, "docs/enterprise-implementation-roadmap.md");
  const waves = listWaves();
  assert.equal(waves.length, 10);
  assert.equal(IMPLEMENTATION_ROADMAP_WAVES.length, 10);

  for (let n = 1; n <= 10; n++) {
    const id = `WAVE-${String(n).padStart(2, "0")}`;
    const w = getWave(id);
    assert.ok(w, `missing ${id}`);
    assert.equal(w.waveNumber, n);
    assert.equal(getWave(n)?.id, id);
    assert.ok(w.name);
    assert.ok(w.objectives.length >= 1);
    assert.ok(w.deliverables.length >= 1);
    assert.ok(w.scope.length >= 1);
    assert.ok(w.entryCriteria.length >= 1);
    assert.ok(w.exitCriteria.length >= 1);
    assert.ok(w.acceptanceCriteria.length >= 1);
    assert.ok(w.qualityGates.length >= 1);
    assert.ok(w.testRequirements.length >= 1);
    assert.ok(w.releaseMilestones.length >= 1);
    assert.ok(w.requiredDocumentation.length >= 1);
    assert.ok(w.mibWaves.length >= 1);
    assert.ok(w.moneyInvariantNote.includes("pesewas"));
    assert.ok(["Mostly Complete", "In Progress", "Planned"].includes(w.waveStatus));
  }
});

test("dependency order: WAVE-n requires WAVE-1..n-1 exit before entry", () => {
  for (let n = 1; n <= 10; n++) {
    const w = getWave(n);
    const prereq = w.dependencies.prerequisiteWaves;
    for (let p = 1; p < n; p++) {
      const pid = `WAVE-${String(p).padStart(2, "0")}`;
      assert.ok(prereq.includes(pid), `${w.id} missing prereq ${pid}`);
    }
    if (n > 1) {
      const prior = `WAVE-${String(n - 1).padStart(2, "0")}`;
      assert.ok(
        w.entryCriteria.some((c) => String(c).includes(prior) && /exit/i.test(String(c))),
        `${w.id} entry must require ${prior} exit`
      );
    }
  }
  assert.deepEqual(
    criticalPathWaves(),
    Array.from({ length: 10 }, (_, i) => `WAVE-${String(i + 1).padStart(2, "0")}`)
  );
});

test("all MIB waves 1–20 map into EIR; every backlog item exactly once", () => {
  assert.equal(IMPLEMENTATION_WAVES.length, 20);
  for (let i = 1; i <= 20; i++) {
    assert.ok(MIB_WAVE_TO_EIR[i], `MIB wave ${i} unmapped`);
    assert.match(MIB_WAVE_TO_EIR[i], /^WAVE-(0[1-9]|10)$/);
  }

  const items = listBacklogItems();
  assert.ok(items.length >= 698);
  assert.equal(items.length, backlogStatusSummary().total);

  const seen = new Set();
  for (const item of items) {
    const waveId = getWaveForBacklogItem(item.identifier);
    assert.ok(waveId, `unmapped ${item.identifier}`);
    assert.ok(getWave(waveId), `bad wave ${waveId} for ${item.identifier}`);
    assert.equal(seen.has(item.identifier), false);
    seen.add(item.identifier);
  }
  assert.equal(seen.size, items.length);

  const counts = waveBacklogCounts();
  let sum = 0;
  for (const w of listWaves()) {
    const listed = listBacklogForWave(w.id);
    assert.equal(listed.length, counts[w.id]);
    sum += listed.length;
  }
  assert.equal(sum, items.length);
});

test("quality gates present; risks and duration helpers; validateEnterpriseRoadmap critical=0", () => {
  const matrix = qualityGateMatrix();
  assert.equal(matrix.length, 10);
  for (const row of matrix) {
    assert.ok(row.qualityGates.length >= 1);
  }

  const risks = listRoadmapRisks();
  assert.ok(risks.length >= 10);
  assert.equal(risks.length, 24);

  const dur = estimateTotalDurationWeeks();
  assert.ok(dur.min >= 10 && dur.max >= dur.min);

  const result = validateEnterpriseRoadmap();
  assert.equal(result.ok, true);
  assert.equal(result.critical, 0);
  assert.equal(result.waveCount, 10);
  assert.equal(result.mappedBacklogItems, result.backlogTotal);
  assert.ok(result.backlogTotal >= 698);
  assert.equal(result.backlogTotal, listBacklogItems().length);
});
