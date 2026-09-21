/**
 * Phase 17 — Capacity forecast helpers, utilization threshold evaluation,
 * benchmark compliance checks, and scaling trigger evaluation (EPSCMS).
 * Consumes Phase 16 performance thresholds and Phase 13 SLOs — does not
 * redefine testing or monitoring standards. Catalog/evaluation only.
 */

import {
  EPSCMS_VERSION,
  PHASE16_PERF_TARGETS,
  PHASE13_SLO_TARGETS,
  getCapacityEntry,
  getBenchmark,
  getResourceThreshold,
  getForecast,
  getWorkloadProfile,
  listCapacityEntries,
  listResourceThresholds
} from "./canonical-performance-registry.js";

export const P17_CAPACITY_VERSION = "1.0.0";
export { EPSCMS_VERSION, PHASE16_PERF_TARGETS, PHASE13_SLO_TARGETS };

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Linear interpolate forecast value between baseline→12→24→36 month points.
 * horizonMonths: 0..36
 */
export function interpolateForecastPoints(points, horizonMonths) {
  const h = num(horizonMonths);
  if (h == null || h < 0) return err("P17-FRC-001", "horizonMonths must be ≥ 0");
  const sorted = [...points]
    .map((p) => ({ month: num(p.month), value: num(p.value) }))
    .filter((p) => p.month != null && p.value != null)
    .sort((a, b) => a.month - b.month);
  if (sorted.length < 2) return err("P17-FRC-002", "Need at least two forecast points");

  if (h <= sorted[0].month) {
    return ok({ horizonMonths: h, value: sorted[0].value, method: "clamp_low" });
  }
  const last = sorted[sorted.length - 1];
  if (h >= last.month) {
    return ok({ horizonMonths: h, value: last.value, method: "clamp_high" });
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (h >= a.month && h <= b.month) {
      const t = (h - a.month) / (b.month - a.month);
      const value = a.value + t * (b.value - a.value);
      return ok({
        horizonMonths: h,
        value: Math.round(value * 1000) / 1000,
        method: "linear",
        fromMonth: a.month,
        toMonth: b.month
      });
    }
  }
  return err("P17-FRC-003", "Unable to interpolate");
}

/**
 * Forecast a registered FRC entry at 12 / 24 / 36 (or custom) months.
 * Uses month12/month24/month36 fields with baseline as month 0.
 */
export function evaluateCapacityForecast({
  forecastId,
  horizonMonths = 12,
  metricField = "auto"
} = {}) {
  const frc = getForecast(forecastId);
  if (!frc) return err("P17-FRC-010", `Unknown forecast ${forecastId}`);

  const baseline =
    num(frc.baselineBranches) ??
    num(frc.baselineMembers) ??
    num(frc.baselineDailyTxns) ??
    num(frc.baselineTb) ??
    num(frc.baselineInferencesPerDay) ??
    num(frc.baselineDevices);

  const m12 =
    num(frc.month12) ??
    null;
  const m24 = num(frc.month24);
  const m36 = num(frc.month36);

  if (baseline == null || m12 == null) {
    return err("P17-FRC-011", `Forecast ${forecastId} missing baseline/month12`);
  }

  const points = [
    { month: 0, value: baseline },
    { month: 12, value: m12 }
  ];
  if (m24 != null) points.push({ month: 24, value: m24 });
  if (m36 != null) points.push({ month: 36, value: m36 });

  const interp = interpolateForecastPoints(points, horizonMonths);
  if (!interp.ok) return interp;

  const growthFactor = baseline > 0 ? interp.value / baseline : null;
  return ok({
    forecastId: frc.id,
    code: frc.code,
    driver: frc.driver,
    horizonMonths: interp.horizonMonths,
    projectedValue: interp.value,
    baseline,
    growthFactor,
    method: interp.method,
    reviewFrequency: frc.reviewFrequency,
    linkedCapacityIds: [...(frc.linkedCapacityIds || [])],
    linkedWorkloadIds: [...(frc.linkedWorkloadIds || [])],
    metricField
  });
}

/**
 * Project capacity resource current → forecast at horizon using CAP entry fields.
 */
export function projectCapacityResource({ capacityId, horizonMonths = 12 } = {}) {
  const cap = getCapacityEntry(capacityId);
  if (!cap) return err("P17-CAP-001", `Unknown capacity ${capacityId}`);

  const h = num(horizonMonths);
  if (h == null || h < 0) return err("P17-CAP-002", "horizonMonths must be ≥ 0");

  const points = [
    { month: 0, value: cap.current },
    { month: 12, value: cap.forecast12m },
    { month: 24, value: cap.forecast24m },
    { month: 36, value: cap.forecast36m }
  ];
  const interp = interpolateForecastPoints(points, h);
  if (!interp.ok) return interp;

  const projected = interp.value;
  const utilVsMax =
    cap.maxCapacity > 0 ? (projected / cap.maxCapacity) * 100 : null;
  const headroom = cap.maxCapacity - projected;

  return ok({
    capacityId: cap.id,
    resource: cap.resource,
    unit: cap.unit,
    horizonMonths: h,
    current: cap.current,
    projected,
    maxCapacity: cap.maxCapacity,
    headroom,
    utilizationVsMaxPct: utilVsMax != null ? Math.round(utilVsMax * 100) / 100 : null,
    scalingTriggerPct: cap.scalingTriggerPct,
    upgradeStrategy: cap.upgradeStrategy
  });
}

/**
 * Evaluate measured utilization against RTHR warning/critical bands.
 */
export function evaluateUtilizationThreshold({
  thresholdId,
  measuredPct,
  resource
} = {}) {
  let thr = thresholdId ? getResourceThreshold(thresholdId) : null;
  if (!thr && resource) {
    thr = listResourceThresholds().find((t) => t.resource === resource) || null;
  }
  if (!thr) return err("P17-RTHR-001", "Unknown resource threshold");

  const m = num(measuredPct);
  if (m == null || m < 0) return err("P17-RTHR-002", "measuredPct must be ≥ 0");

  let band = "ok";
  if (m >= thr.criticalPct) band = "critical";
  else if (m >= thr.warningPct) band = "warning";

  return ok({
    thresholdId: thr.id,
    resource: thr.resource,
    measuredPct: m,
    warningPct: thr.warningPct,
    criticalPct: thr.criticalPct,
    band,
    passFail: band === "ok" ? "pass" : "fail",
    alignsPhase16ThresholdId: thr.alignsPhase16ThresholdId || null,
    alignsPhase16PassValue: thr.alignsPhase16PassValue ?? null
  });
}

/**
 * Evaluate measured latency/duration against a BEN entry.
 * Aligns interactive API benches with Phase 16 ceilings.
 */
export function evaluateBenchmarkCompliance({
  benchmarkId,
  measuredMedianMs,
  measuredP95Ms,
  measuredP99Ms,
  measuredDurationMin
} = {}) {
  const ben = getBenchmark(benchmarkId);
  if (!ben) return err("P17-BEN-001", `Unknown benchmark ${benchmarkId}`);

  const failures = [];
  const checks = [];

  if (ben.targetDurationMin != null || ben.targetP95DurationMin != null) {
    const d = num(measuredDurationMin);
    if (d == null) return err("P17-BEN-002", "measuredDurationMin required for batch benchmark");
    if (ben.targetDurationMin != null) {
      const passed = d <= ben.targetDurationMin;
      checks.push({ metric: "duration_min", measured: d, target: ben.targetDurationMin, passed });
      if (!passed) failures.push("duration_exceeds_target");
    }
    if (ben.targetP95DurationMin != null) {
      const passed = d <= ben.targetP95DurationMin;
      checks.push({
        metric: "duration_p95_min",
        measured: d,
        target: ben.targetP95DurationMin,
        passed
      });
      if (!passed) failures.push("duration_p95_exceeds_target");
    }
  } else {
    const med = num(measuredMedianMs);
    const p95 = num(measuredP95Ms);
    const p99 = measuredP99Ms == null ? null : num(measuredP99Ms);

    if (ben.targetMedianMs != null) {
      if (med == null) return err("P17-BEN-003", "measuredMedianMs required");
      const passed = med <= ben.targetMedianMs;
      checks.push({ metric: "median_ms", measured: med, target: ben.targetMedianMs, passed });
      if (!passed) failures.push("median_exceeds_target");
    }
    if (ben.targetP95Ms != null) {
      if (p95 == null) return err("P17-BEN-004", "measuredP95Ms required");
      const passed = p95 <= ben.targetP95Ms;
      checks.push({ metric: "p95_ms", measured: p95, target: ben.targetP95Ms, passed });
      if (!passed) failures.push("p95_exceeds_target");
    }
    if (ben.targetP99Ms != null && p99 != null) {
      const passed = p99 <= ben.targetP99Ms;
      checks.push({ metric: "p99_ms", measured: p99, target: ben.targetP99Ms, passed });
      if (!passed) failures.push("p99_exceeds_target");
    }

    // Phase 16 hard ceilings for aligned benchmarks
    if (ben.phase16Aligned) {
      const ceilingMed = ben.phase16CeilingMedianMs ?? PHASE16_PERF_TARGETS.medianApiMs;
      const ceilingP95 = ben.phase16CeilingP95Ms ?? PHASE16_PERF_TARGETS.p95ResponseMs;
      const ceilingP99 = ben.phase16CeilingP99Ms ?? PHASE16_PERF_TARGETS.p99ResponseMs;
      if (med != null && med > ceilingMed) {
        failures.push("phase16_median_ceiling");
        checks.push({
          metric: "phase16_median_ceiling",
          measured: med,
          target: ceilingMed,
          passed: false
        });
      }
      if (p95 != null && p95 > ceilingP95) {
        failures.push("phase16_p95_ceiling");
        checks.push({
          metric: "phase16_p95_ceiling",
          measured: p95,
          target: ceilingP95,
          passed: false
        });
      }
      if (p99 != null && p99 > ceilingP99) {
        failures.push("phase16_p99_ceiling");
        checks.push({
          metric: "phase16_p99_ceiling",
          measured: p99,
          target: ceilingP99,
          passed: false
        });
      }
    }

    // Phase 13 SLO consume for AI / API where declared
    if (ben.phase13SloId === "SLO-005" && p95 != null) {
      const slo = PHASE13_SLO_TARGETS.aiP95Ms.targetMs;
      const passed = p95 <= slo;
      checks.push({ metric: "phase13_slo_005", measured: p95, target: slo, passed });
      if (!passed) failures.push("phase13_slo_005_breach");
    }
  }

  const passed = failures.length === 0;
  return ok({
    benchmarkId: ben.id,
    category: ben.category,
    passed,
    passFail: passed ? "pass" : "fail",
    failures,
    checks,
    phase16Aligned: !!ben.phase16Aligned,
    consumesPhase13Slo: ben.phase13SloId || null
  });
}

/**
 * Evaluate whether current utilization or projected load trips a CAP scaling trigger.
 */
export function evaluateScalingTrigger({
  capacityId,
  measuredUtilizationPct,
  projectedValue
} = {}) {
  const cap = getCapacityEntry(capacityId);
  if (!cap) return err("P17-SCALE-001", `Unknown capacity ${capacityId}`);

  const util = num(measuredUtilizationPct);
  let utilPct = util;
  // Projected absolute capacity demand vs current provisioned (not theoretical max).
  if (utilPct == null && projectedValue != null && cap.current > 0) {
    utilPct = (num(projectedValue) / cap.current) * 100;
  }
  if (utilPct == null) {
    return err("P17-SCALE-002", "measuredUtilizationPct or projectedValue required");
  }

  const triggered = utilPct >= cap.scalingTriggerPct;
  const nearMax =
    projectedValue != null && cap.maxCapacity > 0
      ? num(projectedValue) >= cap.maxCapacity * 0.9
      : utilPct >= 90;

  return ok({
    capacityId: cap.id,
    resource: cap.resource,
    measuredUtilizationPct: Math.round(utilPct * 100) / 100,
    scalingTriggerPct: cap.scalingTriggerPct,
    triggered,
    nearMax,
    upgradeStrategy: cap.upgradeStrategy,
    decisionCriteria: cap.decisionCriteria || null,
    recommendation: triggered
      ? `Scale using ${cap.upgradeStrategy}`
      : "No scale action required"
  });
}

/**
 * Compare workload demand (TPS) against API capacity provisioned RPS.
 */
export function evaluateWorkloadFit({
  workloadId,
  capacityId = "CAP-006",
  peak = false
} = {}) {
  const wlp = getWorkloadProfile(workloadId);
  if (!wlp) return err("P17-WLP-001", `Unknown workload ${workloadId}`);
  const cap = getCapacityEntry(capacityId);
  if (!cap) return err("P17-WLP-002", `Unknown capacity ${capacityId}`);

  const demandTps = peak ? wlp.tps * (wlp.peakMultiplier || 1) : wlp.tps;
  const provisioned = cap.current;
  const utilPct = provisioned > 0 ? (demandTps / provisioned) * 100 : null;
  const withinTrigger = utilPct != null && utilPct < cap.scalingTriggerPct;
  const headroom = provisioned - demandTps;

  return ok({
    workloadId: wlp.id,
    capacityId: cap.id,
    demandTps: Math.round(demandTps * 100) / 100,
    provisionedRps: provisioned,
    utilizationPct: utilPct != null ? Math.round(utilPct * 100) / 100 : null,
    headroom,
    fits: withinTrigger && headroom > 0,
    scalingTriggerPct: cap.scalingTriggerPct,
    peakApplied: !!peak
  });
}

/**
 * Quick Phase 16 latency gate helper (does not redefine thresholds).
 */
export function evaluatePhase16LatencyGate({
  measuredMedianMs,
  measuredP95Ms,
  measuredP99Ms
} = {}) {
  const med = num(measuredMedianMs);
  const p95 = num(measuredP95Ms);
  const p99 = measuredP99Ms == null ? null : num(measuredP99Ms);
  if (med == null || p95 == null) {
    return err("P17-P16-001", "measuredMedianMs and measuredP95Ms required");
  }
  const failures = [];
  if (med > PHASE16_PERF_TARGETS.medianApiMs) failures.push("median");
  if (p95 > PHASE16_PERF_TARGETS.p95ResponseMs) failures.push("p95");
  if (p99 != null && p99 > PHASE16_PERF_TARGETS.p99ResponseMs) failures.push("p99");
  const passed = failures.length === 0;
  return ok({
    passed,
    passFail: passed ? "pass" : "fail",
    failures,
    targets: { ...PHASE16_PERF_TARGETS },
    measured: { medianMs: med, p95Ms: p95, p99Ms: p99 },
    consumesPhase16: true,
    doesNotRedefine: true
  });
}

/**
 * Operational SLO-006 p95 check (Phase 13 consume).
 */
export function evaluatePhase13ApiLatencySlo({ measuredP95Ms } = {}) {
  const p95 = num(measuredP95Ms);
  if (p95 == null) return err("P17-P13-001", "measuredP95Ms required");
  const target = PHASE13_SLO_TARGETS.apiP95Ms.targetMs;
  const passed = p95 <= target;
  return ok({
    sloId: PHASE13_SLO_TARGETS.apiP95Ms.sloId,
    measuredP95Ms: p95,
    targetMs: target,
    passed,
    passFail: passed ? "pass" : "fail",
    consumesPhase13: true,
    doesNotRedefine: true
  });
}

export function summarizeCapacityPosture(horizonMonths = 12) {
  const rows = [];
  for (const cap of listCapacityEntries()) {
    const proj = projectCapacityResource({
      capacityId: cap.id,
      horizonMonths
    });
    if (!proj.ok) continue;
    const scale = evaluateScalingTrigger({
      capacityId: cap.id,
      projectedValue: proj.projected
    });
    rows.push({
      capacityId: cap.id,
      resource: cap.resource,
      projected: proj.projected,
      utilizationVsMaxPct: proj.utilizationVsMaxPct,
      scaleTriggered: scale.ok ? scale.triggered : null
    });
  }
  return ok({ horizonMonths, entries: rows });
}
