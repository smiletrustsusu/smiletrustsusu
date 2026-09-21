/**
 * Phase 17 capacity — forecast, utilization thresholds, benchmark compliance,
 * scaling triggers, Phase 13/16 gate helpers.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P17_CAPACITY_VERSION,
  PHASE16_PERF_TARGETS,
  PHASE13_SLO_TARGETS,
  interpolateForecastPoints,
  evaluateCapacityForecast,
  projectCapacityResource,
  evaluateUtilizationThreshold,
  evaluateBenchmarkCompliance,
  evaluateScalingTrigger,
  evaluateWorkloadFit,
  evaluatePhase16LatencyGate,
  evaluatePhase13ApiLatencySlo,
  summarizeCapacityPosture
} from "../src/core/phase17-capacity-forecast.js";

test("phase17 capacity version and Phase 16/13 constants", () => {
  assert.equal(P17_CAPACITY_VERSION, "1.0.0");
  assert.equal(PHASE16_PERF_TARGETS.medianApiMs, 300);
  assert.equal(PHASE16_PERF_TARGETS.p95ResponseMs, 750);
  assert.equal(PHASE13_SLO_TARGETS.apiP95Ms.targetMs, 500);
});

test("interpolateForecastPoints linear and clamps", () => {
  const mid = interpolateForecastPoints(
    [
      { month: 0, value: 100 },
      { month: 12, value: 200 },
      { month: 24, value: 400 }
    ],
    6
  );
  assert.equal(mid.ok, true);
  assert.equal(mid.value, 150);
  assert.equal(mid.method, "linear");

  const low = interpolateForecastPoints(
    [
      { month: 0, value: 10 },
      { month: 12, value: 20 }
    ],
    0
  );
  assert.equal(low.value, 10);

  const high = interpolateForecastPoints(
    [
      { month: 0, value: 10 },
      { month: 12, value: 20 }
    ],
    36
  );
  assert.equal(high.value, 20);
  assert.equal(high.method, "clamp_high");
});

test("evaluateCapacityForecast for branch and txn growth", () => {
  const branches = evaluateCapacityForecast({
    forecastId: "FRC-001",
    horizonMonths: 24
  });
  assert.equal(branches.ok, true);
  assert.equal(branches.projectedValue, 120);
  assert.ok(branches.growthFactor > 1);

  const txns = evaluateCapacityForecast({
    forecastId: "FRC-003",
    horizonMonths: 12
  });
  assert.equal(txns.ok, true);
  assert.equal(txns.projectedValue, 45000);

  const missing = evaluateCapacityForecast({ forecastId: "FRC-999" });
  assert.equal(missing.ok, false);
});

test("projectCapacityResource and scaling trigger", () => {
  const proj = projectCapacityResource({
    capacityId: "CAP-006",
    horizonMonths: 24
  });
  assert.equal(proj.ok, true);
  assert.equal(proj.projected, 800);
  assert.equal(proj.current, 200);

  const scaleOk = evaluateScalingTrigger({
    capacityId: "CAP-001",
    measuredUtilizationPct: 55
  });
  assert.equal(scaleOk.ok, true);
  assert.equal(scaleOk.triggered, false);

  const scaleTrip = evaluateScalingTrigger({
    capacityId: "CAP-001",
    measuredUtilizationPct: 72
  });
  assert.equal(scaleTrip.triggered, true);
  assert.match(scaleTrip.recommendation, /Scale/);

  const byProjected = evaluateScalingTrigger({
    capacityId: "CAP-006",
    projectedValue: 160
  });
  assert.equal(byProjected.ok, true);
  assert.equal(byProjected.triggered, true);
});

test("evaluateUtilizationThreshold warning and critical bands", () => {
  const okBand = evaluateUtilizationThreshold({
    thresholdId: "RTHR-001",
    measuredPct: 50
  });
  assert.equal(okBand.band, "ok");
  assert.equal(okBand.passFail, "pass");
  assert.equal(okBand.alignsPhase16PassValue, 70);

  const warn = evaluateUtilizationThreshold({
    thresholdId: "RTHR-001",
    measuredPct: 70
  });
  assert.equal(warn.band, "warning");

  const crit = evaluateUtilizationThreshold({
    resource: "memory",
    measuredPct: 91
  });
  assert.equal(crit.thresholdId, "RTHR-002");
  assert.equal(crit.band, "critical");
  assert.equal(crit.alignsPhase16PassValue, 75);
});

test("evaluateBenchmarkCompliance Phase 16 aligned collections", () => {
  const pass = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-004",
    measuredMedianMs: 280,
    measuredP95Ms: 720,
    measuredP99Ms: 1400
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.passed, true);
  assert.equal(pass.phase16Aligned, true);

  const failP95 = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-004",
    measuredMedianMs: 280,
    measuredP95Ms: 800,
    measuredP99Ms: 1400
  });
  assert.equal(failP95.passed, false);
  assert.ok(failP95.failures.includes("p95_exceeds_target"));

  const ai = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-009",
    measuredMedianMs: 700,
    measuredP95Ms: 1800
  });
  assert.equal(ai.passed, true);
  assert.equal(ai.consumesPhase13Slo, "SLO-005");

  const aiFail = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-009",
    measuredMedianMs: 700,
    measuredP95Ms: 2500
  });
  assert.equal(aiFail.passed, false);

  const batch = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-010",
    measuredDurationMin: 40
  });
  assert.equal(batch.passed, true);

  const batchFail = evaluateBenchmarkCompliance({
    benchmarkId: "BEN-010",
    measuredDurationMin: 70
  });
  assert.equal(batchFail.passed, false);
});

test("evaluateWorkloadFit and Phase 13/16 gate helpers", () => {
  const single = evaluateWorkloadFit({
    workloadId: "WLP-001",
    capacityId: "CAP-006"
  });
  assert.equal(single.ok, true);
  assert.equal(single.fits, true);

  const nationwidePeak = evaluateWorkloadFit({
    workloadId: "WLP-005",
    capacityId: "CAP-006",
    peak: true
  });
  assert.equal(nationwidePeak.ok, true);
  assert.equal(nationwidePeak.fits, false);

  const p16 = evaluatePhase16LatencyGate({
    measuredMedianMs: 250,
    measuredP95Ms: 700,
    measuredP99Ms: 1200
  });
  assert.equal(p16.passed, true);
  assert.equal(p16.consumesPhase16, true);

  const p16Fail = evaluatePhase16LatencyGate({
    measuredMedianMs: 350,
    measuredP95Ms: 700
  });
  assert.equal(p16Fail.passed, false);
  assert.ok(p16Fail.failures.includes("median"));

  const slo = evaluatePhase13ApiLatencySlo({ measuredP95Ms: 480 });
  assert.equal(slo.passed, true);
  assert.equal(slo.consumesPhase13, true);

  const sloFail = evaluatePhase13ApiLatencySlo({ measuredP95Ms: 600 });
  assert.equal(sloFail.passed, false);
  assert.equal(sloFail.targetMs, 500);
});

test("summarizeCapacityPosture returns entries", () => {
  const summary = summarizeCapacityPosture(12);
  assert.equal(summary.ok, true);
  assert.ok(summary.entries.length >= 12);
  assert.ok(summary.entries.every((e) => e.capacityId && e.projected != null));
});
