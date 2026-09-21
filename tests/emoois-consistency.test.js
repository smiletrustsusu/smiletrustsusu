/**
 * Phase 13 EMOOIS consistency — unique IDs, single owners, docs, Module 19,
 * alert→metric refs, health-check shape.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMOOIS_VERSION,
  OPERATIONAL_ENGINE_MODULE,
  OPERATIONAL_ENGINE_REF,
  MONITORS,
  METRICS,
  ALERTS,
  HEALTH_CHECKS,
  DASHBOARDS,
  TRACES,
  SLIS,
  SLOS,
  SLAS,
  CORRELATION_STANDARDS,
  listMonitors,
  listMetrics,
  listAlerts,
  listHealthChecks,
  listDashboards,
  listSlos,
  getMonitor,
  getMetric,
  getAlert,
  getHealthCheck,
  getSlo,
  assertIdUniqueness,
  assertOwnersUniquePerEntry,
  assertSingleOwner,
  assertAlertMetricRefs,
  assertHealthCheckShape,
  assertSliSloRefs,
  assertModule19EngineNotReplaced,
  validateMonitoringRegistry,
  emooisCounts
} from "../src/core/canonical-monitoring-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

test("EMOOIS docs exist with Input & Dependency Rules and Module 19", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-monitoring-observability.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "emoois-catalogs.md")), true);
  const primary = read("enterprise-monitoring-observability.md");
  assert.match(primary, /EMOOIS|Enterprise Monitoring/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Module 19/);
  assert.match(primary, /monitoring-ops\.js/);
  assert.match(primary, /Phases? 1/);
  assert.match(primary, /UUID lowercase|uuid-lowercase/i);
  assert.match(primary, /UTC/);
  assert.match(primary, /observe/i);
  assert.match(primary, /MoMo|Module 28/);
  assert.match(primary, /Module 27|BI/);
  assert.match(primary, /Module 29|AI/);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /operational engine/i);

  const catalogs = read("emoois-catalogs.md");
  assert.match(catalogs, /Monitoring Registry|Metric Registry|Alert Registry/);
  assert.match(catalogs, /HealthCheck|SLO Catalog|Ownership/);
  assert.match(catalogs, /Module 19/);
  assert.match(catalogs, /Cross-reference|Phase/);
  assert.match(catalogs, /MET-00|ALT-00|HC-00|SLO-00/);
});

test("optional monitoring schemas exist with absolute $id and metadata $ref", () => {
  const schemaDir = path.join(DOCS, "schemas", "monitoring");
  for (const file of ["metric.schema.json", "alert.schema.json", "health-check.schema.json", "slo.schema.json"]) {
    const full = path.join(schemaDir, file);
    assert.equal(fs.existsSync(full), true, file);
    const json = JSON.parse(fs.readFileSync(full, "utf8"));
    assert.match(json.$id, /^https:\/\/schemas\.smiletrust\.com\/monitoring\//);
    assert.equal(
      json.properties.metadata.$ref,
      "https://schemas.smiletrust.com/common/metadata.schema.json"
    );
  }
});

test("registry unique IDs, helpers, single owners, and validation", () => {
  assert.equal(EMOOIS_VERSION, "1.0.0");
  assert.equal(OPERATIONAL_ENGINE_MODULE, 19);
  assert.match(OPERATIONAL_ENGINE_REF, /monitoring-ops\.js/);

  const unique = assertIdUniqueness();
  assert.equal(unique.ok, true, unique.message);
  const owners = assertOwnersUniquePerEntry();
  assert.equal(owners.ok, true, owners.message);
  const alerts = assertAlertMetricRefs();
  assert.equal(alerts.ok, true, alerts.message);
  const hcs = assertHealthCheckShape();
  assert.equal(hcs.ok, true, hcs.message);
  const sli = assertSliSloRefs();
  assert.equal(sli.ok, true, sli.message);

  const result = validateMonitoringRegistry();
  assert.equal(result.ok, true, (result.errors || []).join("; "));

  assert.equal(listMonitors().length, MONITORS.length);
  assert.equal(listMetrics().length, METRICS.length);
  assert.equal(listAlerts().length, ALERTS.length);
  assert.equal(listHealthChecks().length, HEALTH_CHECKS.length);
  assert.equal(listDashboards().length, DASHBOARDS.length);
  assert.equal(listSlos().length, SLOS.length);

  assert.ok(getMonitor("MON-001"));
  assert.ok(getMonitor("SYS_OVERALL_HEALTH"));
  assert.ok(getMetric("MET-004"));
  assert.ok(getAlert("ALT-007"));
  assert.ok(getHealthCheck("HC-008"));
  assert.ok(getSlo("SLO-002"));
  assert.equal(getSlo("SLO-002").observeOnly, true);

  for (const entry of [...MONITORS, ...METRICS, ...ALERTS, ...HEALTH_CHECKS]) {
    const own = assertSingleOwner(entry);
    assert.equal(own.ok, true, own.message);
  }
});

test("no orphan alert→metric refs; health checks have interval/timeout/severity", () => {
  const metricIds = new Set(METRICS.map((m) => m.id));
  for (const alert of ALERTS) {
    assert.ok(Array.isArray(alert.metricIds) && alert.metricIds.length, alert.id);
    for (const mid of alert.metricIds) {
      assert.ok(metricIds.has(mid), `${alert.id} -> ${mid}`);
    }
  }
  for (const hc of HEALTH_CHECKS) {
    assert.ok(Number.isFinite(hc.intervalMs) && hc.intervalMs > 0, hc.id);
    assert.ok(Number.isFinite(hc.timeoutMs) && hc.timeoutMs > 0, hc.id);
    assert.ok(["information", "warning", "minor", "major", "critical"].includes(hc.severity), hc.id);
    assert.ok(hc.timeoutMs <= hc.intervalMs, hc.id);
  }
});

test("Module 19 referenced as engine and not replaced; seed themes present", () => {
  const engine = assertModule19EngineNotReplaced();
  assert.equal(engine.ok, true);
  assert.equal(engine.replaced, false);
  assert.equal(engine.postsMoney, false);
  assert.equal(engine.newNav, false);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core", "monitoring-ops.js")), true);

  const codes = new Set([
    ...MONITORS.map((m) => m.code),
    ...METRICS.map((m) => m.code),
    ...ALERTS.map((a) => a.code),
    ...SLOS.map((s) => s.code)
  ]);
  assert.ok(codes.has("API_GATEWAY_HEALTH") || codes.has("API_AVAILABILITY_RATIO"));
  assert.ok(codes.has("COLLECTIONS_TODAY_COUNT"));
  assert.ok(codes.has("LOAN_REPAYMENT_RATE"));
  assert.ok(codes.has("AI_INFERENCE_LATENCY_P95_MS"));
  assert.ok(codes.has("MOMO_PROVIDER_UP") || codes.has("MOMO_PROVIDER_OUTAGE"));
  assert.ok(codes.has("FAILED_LOGIN_COUNT") || codes.has("FAILED_LOGIN_SPIKE"));
  assert.ok(codes.has("BACKUP_FAILED_FLAG") || codes.has("BACKUP_VERIFY_FAIL"));
  assert.ok(codes.has("SLO_API_AVAILABILITY"));
  assert.ok(codes.has("SLO_COLLECTION_POST_HEALTH"));
  assert.ok(codes.has("SLO_PLATFORM_UPTIME"));

  assert.equal(CORRELATION_STANDARDS.operationalCorrelationId, "uuid-lowercase");
  assert.equal(CORRELATION_STANDARDS.timestampTimezone, "UTC");
  assert.ok(TRACES.some((t) => t.correlationIdFormat === "uuid-lowercase" || t.traceIdFormat === "uuid-lowercase"));
  assert.ok(SLAS.length >= 3);
  assert.ok(DASHBOARDS.every((d) => d.newNav === false));
});

test("emooisCounts match seeded catalog sizes", () => {
  const counts = emooisCounts();
  assert.equal(counts.monitors, 12);
  assert.equal(counts.metrics, 18);
  assert.equal(counts.alerts, 14);
  assert.equal(counts.healthChecks, 11);
  assert.equal(counts.dashboards, 8);
  assert.equal(counts.traces, 4);
  assert.equal(counts.slis, 8);
  assert.equal(counts.slos, 6);
  assert.equal(counts.slas, 3);
});
