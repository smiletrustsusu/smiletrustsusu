/**
 * Phase 17 EPSCMS consistency — unique IDs, ownership, Phase 13/16 alignment,
 * docs, schemas, Module 19 not replaced.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EPSCMS_VERSION,
  MONITORING_MODULE,
  BACKUP_ENGINE_MODULE,
  AI_MODULE,
  PLATFORM_MODULE,
  PHASE16_PERF_TARGETS,
  PHASE13_SLO_TARGETS,
  PERFORMANCE_METRICS,
  CAPACITY_ENTRIES,
  BENCHMARKS,
  WORKLOAD_PROFILES,
  RESOURCE_THRESHOLDS,
  FORECASTS,
  PERFORMANCE_GOVERNANCE,
  listPerformanceMetrics,
  listCapacityEntries,
  listBenchmarks,
  listWorkloadProfiles,
  listResourceThresholds,
  listForecasts,
  getPerformanceMetric,
  getBenchmark,
  getResourceThreshold,
  assertIdUniqueness,
  assertSingleOwnerPerEntry,
  assertSingleOwnerPerMetric,
  assertRefsResolve,
  assertCrossPhaseConsistency,
  assertModulesNotReplaced,
  validatePerformanceRegistry,
  epscmsCounts
} from "../src/core/canonical-performance-registry.js";

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

test("EPSCMS docs exist with architecture, workloads, capacity, Input & Dependency Rules", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-performance-capacity.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "epscms-catalogs.md")), true);
  const primary = read("enterprise-performance-capacity.md");
  assert.match(primary, /EPSCMS|Enterprise Performance/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Workload/);
  assert.match(primary, /Capacity/);
  assert.match(primary, /Scalability/);
  assert.match(primary, /Benchmark/);
  assert.match(primary, /Forecast/);
  assert.match(primary, /Governance/);
  assert.match(primary, /Cross-reference/);
  assert.match(primary, /Phase 13/);
  assert.match(primary, /Phase 16/);
  assert.match(primary, /Module 19/);
  assert.match(primary, /not redefined|does not redefine|Consumed/i);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /median.*300|≤300/);
  assert.match(primary, /750/);
  assert.match(primary, /advisory/i);

  const catalogs = read("epscms-catalogs.md");
  assert.match(catalogs, /Performance Metric Registry|Workload Profile Registry/);
  assert.match(catalogs, /PMET-00|CAP-00|BEN-00|WLP-00|RTHR-00|FRC-00/);
  assert.match(catalogs, /Phase 13|Phase 16/);
  assert.match(catalogs, /Module 19/);
  assert.match(catalogs, /Cross-reference/);
});

test("performance schemas exist, Draft 2020-12, additionalProperties false, examples + manifest", () => {
  const files = [
    "workload-profile.schema.json",
    "capacity-forecast.schema.json",
    "performance-benchmark-result.schema.json"
  ];
  for (const f of files) {
    const p = path.join(DOCS, "schemas", "performance", f);
    assert.equal(fs.existsSync(p), true);
    const schema = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.equal(schema.$id, `https://schemas.smiletrust.com/performance/${f}`);
    assert.match(schema.$schema, /draft\/2020-12/);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.$defs);
  }

  for (const rel of [
    "schemas/performance/examples/valid/workload-profile.valid.json",
    "schemas/performance/examples/invalid/workload-profile.invalid.json",
    "schemas/performance/examples/valid/capacity-forecast.valid.json",
    "schemas/performance/examples/invalid/capacity-forecast.invalid.json",
    "schemas/performance/examples/valid/performance-benchmark-result.valid.json",
    "schemas/performance/examples/invalid/performance-benchmark-result.invalid.json"
  ]) {
    const p = path.join(DOCS, rel);
    assert.equal(fs.existsSync(p), true);
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase17));
  assert.equal(manifest.phaseCoverage.phase17.length, 3);
  for (const schemaFile of files) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.phase, 17);
    assert.equal(entry.sha256, sha256File(`performance/${schemaFile}`));
  }
  assert.equal(manifest.constraints?.phase17DoesNotRedefinePhase13Monitoring, true);
  assert.equal(manifest.constraints?.phase17DoesNotRedefinePhase16TestingStandards, true);
  assert.equal(manifest.constraints?.phase17DoesNotReplaceModule19, true);
});

test("registry unique IDs, ownership, Phase 13/16 consistency", () => {
  assert.equal(EPSCMS_VERSION, "1.0.0");
  assert.equal(MONITORING_MODULE, 19);
  assert.equal(BACKUP_ENGINE_MODULE, 21);
  assert.equal(AI_MODULE, 29);
  assert.equal(PLATFORM_MODULE, 30);

  assert.equal(PHASE16_PERF_TARGETS.medianApiMs, 300);
  assert.equal(PHASE16_PERF_TARGETS.p95ResponseMs, 750);
  assert.equal(PHASE16_PERF_TARGETS.p99ResponseMs, 1500);
  assert.equal(PHASE16_PERF_TARGETS.cpuSteadyPct, 70);
  assert.equal(PHASE16_PERF_TARGETS.memorySteadyPct, 75);
  assert.equal(PHASE13_SLO_TARGETS.apiP95Ms.targetMs, 500);
  assert.equal(PHASE13_SLO_TARGETS.aiP95Ms.targetMs, 2000);

  const uniq = assertIdUniqueness();
  assert.equal(uniq.ok, true);
  const own = assertSingleOwnerPerEntry();
  assert.equal(own.ok, true);
  const metricOwn = assertSingleOwnerPerMetric();
  assert.equal(metricOwn.ok, true);
  const refs = assertRefsResolve();
  assert.equal(refs.ok, true);
  const xp = assertCrossPhaseConsistency();
  assert.equal(xp.ok, true, xp.errors ? xp.errors.join("; ") : xp.message);
  const mods = assertModulesNotReplaced();
  assert.equal(mods.ok, true);
  assert.equal(mods.monitoringModule, 19);

  const validated = validatePerformanceRegistry();
  assert.equal(validated.ok, true, validated.errors ? validated.errors.join("; ") : validated.message);

  const counts = epscmsCounts();
  assert.equal(counts.metrics, 20);
  assert.equal(counts.capacityEntries, 12);
  assert.equal(counts.benchmarks, 10);
  assert.equal(counts.workloads, 9);
  assert.equal(counts.resourceThresholds, 8);
  assert.equal(counts.forecasts, 6);
  assert.equal(counts.governance, 6);
  assert.equal(listPerformanceMetrics().length, PERFORMANCE_METRICS.length);
  assert.equal(listCapacityEntries().length, CAPACITY_ENTRIES.length);
  assert.equal(listBenchmarks().length, BENCHMARKS.length);
  assert.equal(listWorkloadProfiles().length, WORKLOAD_PROFILES.length);
  assert.equal(listResourceThresholds().length, RESOURCE_THRESHOLDS.length);
  assert.equal(listForecasts().length, FORECASTS.length);
  assert.equal(PERFORMANCE_GOVERNANCE.length, 6);

  const pmet002 = getPerformanceMetric("PMET-002");
  assert.equal(pmet002.phase16PassValue, 750);
  assert.equal(pmet002.phase13SloTargetMs, 500);

  const rCpu = getResourceThreshold("RTHR-001");
  assert.equal(rCpu.warningPct, 70);
  assert.equal(rCpu.alignsPhase16PassValue, 70);

  const collections = getBenchmark("BEN-004");
  assert.equal(collections.targetMedianMs, 300);
  assert.equal(collections.targetP95Ms, 750);
  assert.equal(collections.phase16Aligned, true);

  for (const ben of BENCHMARKS.filter((b) => b.phase16Aligned)) {
    if (ben.targetP95Ms != null) {
      assert.ok(ben.targetP95Ms <= 750, `${ben.id} p95 exceeds Phase 16`);
    }
    if (ben.targetMedianMs != null && ben.phase16CeilingMedianMs != null) {
      assert.ok(ben.targetMedianMs <= ben.phase16CeilingMedianMs);
    }
  }
});

test("downstream links present on Phase 13/14/16 docs", () => {
  const mon = read("enterprise-monitoring-observability.md");
  assert.match(mon, /Phase 17|EPSCMS|enterprise-performance-capacity/);
  const deploy = read("enterprise-deployment-devops.md");
  assert.match(deploy, /Phase 17|EPSCMS|enterprise-performance-capacity/);
  const testDoc = read("enterprise-testing-qa-validation.md");
  assert.match(testDoc, /Phase 17|EPSCMS|enterprise-performance-capacity/);
});
