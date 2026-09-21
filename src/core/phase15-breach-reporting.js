/**
 * Phase 15 — Measurable RPO/RTO breach reporting (EBCBDRS).
 * Evaluates RPO / RTO / Combined breaches against Phase 14 targets (consumed,
 * not redefined), assigns severity L0–L4 from percent over target, builds
 * canonical breach-report payloads, validates structure, and computes KPIs.
 * Does not execute backups (Module 21) or replace Module 30 DR governance.
 */

import {
  getBusinessService,
  COMMUNICATION_CHANNELS
} from "./canonical-continuity-registry.js";

export const P15_BREACH_REPORTING_VERSION = "1.0.0";

export const BREACH_KINDS = Object.freeze(["RPO", "RTO", "Combined"]);

export const SEVERITY_LEVELS = Object.freeze([
  "Level0",
  "Level1",
  "Level2",
  "Level3",
  "Level4"
]);

/** Percent-over-target bands (exclusive lower bound via ordering). */
export const SEVERITY_BANDS = Object.freeze([
  Object.freeze({ level: "Level0", maxPercentOver: 0, label: "Within target / no breach" }),
  Object.freeze({ level: "Level1", maxPercentOver: 10, label: "Breached ≤ 10% over target" }),
  Object.freeze({ level: "Level2", maxPercentOver: 25, label: "Breached > 10% and ≤ 25% over" }),
  Object.freeze({ level: "Level3", maxPercentOver: 50, label: "Breached > 25% and ≤ 50% over" }),
  Object.freeze({ level: "Level4", maxPercentOver: Infinity, label: "Breached > 50% over target" })
]);

export const ROOT_CAUSE_CODES = Object.freeze([
  "BACKUP_STALE",
  "RESTORE_SLOW",
  "STABILIZATION_FAILED",
  "DEPENDENCY_OUTAGE",
  "HUMAN_PROCESS",
  "CAPACITY",
  "CORRUPTION",
  "UNKNOWN"
]);

const INC_PATTERN = /^INC-[A-Z0-9-]{4,}$/;
const REC_TARGET_PATTERN = /^REC-TARGET-[A-Z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SVC_PATTERN = /^SVC-[0-9]{3}$/;

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function parseTime(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : null;
}

/**
 * Map percent over target to severity Level0–Level4.
 * percentOver <= 0 → Level0; (0,10] → L1; (10,25] → L2; (25,50] → L3; >50 → L4.
 */
export function severityFromPercentOver(percentOver) {
  const p = Number(percentOver);
  if (!Number.isFinite(p) || p <= 0) return "Level0";
  if (p <= 10) return "Level1";
  if (p <= 25) return "Level2";
  if (p <= 50) return "Level3";
  return "Level4";
}

export function percentOverTarget(measured, target) {
  const m = Number(measured);
  const t = Number(target);
  if (!Number.isFinite(m) || !Number.isFinite(t) || t <= 0) return null;
  if (m <= t) return 0;
  return ((m - t) / t) * 100;
}

export function severityRank(level) {
  const idx = SEVERITY_LEVELS.indexOf(level);
  return idx < 0 ? 0 : idx;
}

export function maxSeverity(a, b) {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export function capaRequiredForSeverity(level) {
  return severityRank(level) >= severityRank("Level2");
}

/**
 * Evaluate a single metric breach (RPO or RTO).
 */
export function evaluateMetricBreach({
  kind,
  measuredMinutes,
  targetMinutes,
  passed
} = {}) {
  if (!["RPO", "RTO"].includes(kind)) {
    return err("P15-BR-001", "kind must be RPO or RTO for metric breach");
  }
  const measured = Number(measuredMinutes);
  const target = Number(targetMinutes);
  if (!Number.isFinite(measured) || measured < 0) {
    return err("P15-BR-002", "measuredMinutes must be a non-negative number");
  }
  if (!Number.isFinite(target) || target <= 0) {
    return err("P15-BR-003", "targetMinutes must be a positive number");
  }

  const within = typeof passed === "boolean" ? passed : measured <= target;
  const over = percentOverTarget(measured, target);
  const severity = within ? "Level0" : severityFromPercentOver(over);
  const breached = !within;

  return ok({
    kind,
    measuredMinutes: measured,
    targetMinutes: target,
    percentOverTarget: over == null ? 0 : over,
    withinTarget: within,
    breached,
    severity,
    capaRequired: capaRequiredForSeverity(severity),
    passFail: within ? "pass" : "fail"
  });
}

/**
 * Evaluate RPO, RTO, or Combined breach against continuity / Phase 14 budgets.
 */
export function evaluateBreach({
  kind = "Combined",
  serviceId,
  targetRpoMinutes,
  targetRtoMinutes,
  measuredRpoMinutes,
  measuredRtoMinutes,
  rpoPassed,
  rtoPassed
} = {}) {
  if (!BREACH_KINDS.includes(kind)) {
    return err("P15-BR-010", `kind must be one of ${BREACH_KINDS.join(", ")}`);
  }

  const svc = serviceId ? getBusinessService(serviceId) : null;
  const rpoTarget =
    Number.isFinite(targetRpoMinutes)
      ? Number(targetRpoMinutes)
      : Number(svc?.measurementRpoTargetMinutes ?? svc?.rpoMinutes ?? NaN);
  const rtoTarget =
    Number.isFinite(targetRtoMinutes)
      ? Number(targetRtoMinutes)
      : Number(svc?.measurementRtoTargetMinutes ?? svc?.rtoMinutes ?? NaN);

  let rpoEval = null;
  let rtoEval = null;

  if (kind === "RPO" || kind === "Combined") {
    if (!Number.isFinite(measuredRpoMinutes)) {
      return err("P15-BR-011", "measuredRpoMinutes required for RPO/Combined");
    }
    rpoEval = evaluateMetricBreach({
      kind: "RPO",
      measuredMinutes: measuredRpoMinutes,
      targetMinutes: rpoTarget,
      passed: rpoPassed
    });
    if (!rpoEval.ok) return rpoEval;
  }

  if (kind === "RTO" || kind === "Combined") {
    if (!Number.isFinite(measuredRtoMinutes)) {
      return err("P15-BR-012", "measuredRtoMinutes required for RTO/Combined");
    }
    rtoEval = evaluateMetricBreach({
      kind: "RTO",
      measuredMinutes: measuredRtoMinutes,
      targetMinutes: rtoTarget,
      passed: rtoPassed
    });
    if (!rtoEval.ok) return rtoEval;
  }

  let severity = "Level0";
  let breached = false;
  if (rpoEval?.breached) {
    breached = true;
    severity = maxSeverity(severity, rpoEval.severity);
  }
  if (rtoEval?.breached) {
    breached = true;
    severity = maxSeverity(severity, rtoEval.severity);
  }
  if (!breached) severity = "Level0";

  return ok({
    kind,
    serviceId: svc?.id || serviceId || null,
    serviceKey: svc?.serviceKey || null,
    phase14TargetId: svc?.phase14TargetId || null,
    rpo: rpoEval,
    rto: rtoEval,
    breached,
    severity,
    capaRequired: capaRequiredForSeverity(severity),
    overallCompliance: breached ? "breached" : "compliant"
  });
}

function defaultCorrectiveAction(severity, nowIso) {
  return Object.freeze({
    id: `CAPA-${Date.now()}`,
    title: "Investigate and remediate recovery objective breach",
    owner: "Platform Operations Lead",
    status: "open",
    dueAt: nowIso,
    severity,
    description: "CAPA required for Level2+ RPO/RTO breach per Phase 15 EBCBDRS."
  });
}

/**
 * Build a canonical breach-report payload (schema-aligned shape).
 */
export function buildBreachReportPayload({
  reportId,
  incidentId,
  recoveryTargetId,
  serviceId,
  kind = "Combined",
  evaluation,
  measuredRpoMinutes,
  measuredRtoMinutes,
  targetRpoMinutes,
  targetRtoMinutes,
  environment = "production",
  rootCauseCode = "UNKNOWN",
  rootCauseDetail = "",
  detectedAt,
  declaredAt,
  restoredAt,
  stabilizedAt,
  reportedAt,
  accountableAuthority,
  auditAuthority = "Internal Auditor",
  correctiveActions,
  evidence = [],
  correlationId
} = {}) {
  const evalResult =
    evaluation ||
    evaluateBreach({
      kind,
      serviceId,
      measuredRpoMinutes,
      measuredRtoMinutes,
      targetRpoMinutes,
      targetRtoMinutes
    });

  if (!evalResult.ok) return evalResult;

  const nowIso = reportedAt || new Date().toISOString();
  const svc = serviceId ? getBusinessService(serviceId) : null;
  const severity = evalResult.severity;
  const needsCapa = capaRequiredForSeverity(severity);

  let actions = Array.isArray(correctiveActions) ? [...correctiveActions] : [];
  if (needsCapa && actions.length === 0) {
    actions = [defaultCorrectiveAction(severity, nowIso)];
  }

  const recTarget =
    recoveryTargetId ||
    (svc?.phase14TargetId ? `REC-TARGET-${svc.phase14TargetId}` : "REC-TARGET-UNSPECIFIED");

  const channels = COMMUNICATION_CHANNELS.filter((c) =>
    (c.triggerSeverities || []).includes(severity)
  ).map((c) => c.id);

  const payload = {
    schemaVersion: "1.0.0",
    reportId: reportId || cryptoRandomUuid(),
    incidentId: incidentId || "INC-UNSPECIFIED",
    recoveryTargetId: recTarget,
    kind: evalResult.kind,
    environment,
    service: {
      serviceId: svc?.id || serviceId || "SVC-000",
      serviceCode: svc?.code || "UNKNOWN",
      serviceKey: svc?.serviceKey || "unknown",
      tier: svc?.tier || "tier3_standard",
      phase14TargetId: svc?.phase14TargetId || null,
      recoveryPriority: svc?.recoveryPriority ?? null
    },
    measurement: {
      rpo:
        evalResult.rpo == null
          ? null
          : {
              measuredMinutes: evalResult.rpo.measuredMinutes,
              targetMinutes: evalResult.rpo.targetMinutes,
              percentOverTarget: round2(evalResult.rpo.percentOverTarget),
              passFail: evalResult.rpo.passFail,
              withinTarget: evalResult.rpo.withinTarget
            },
      rto:
        evalResult.rto == null
          ? null
          : {
              measuredMinutes: evalResult.rto.measuredMinutes,
              targetMinutes: evalResult.rto.targetMinutes,
              percentOverTarget: round2(evalResult.rto.percentOverTarget),
              passFail: evalResult.rto.passFail,
              withinTarget: evalResult.rto.withinTarget
            },
      clock: Object.freeze({ timezone: "UTC", format: "ISO-8601" })
    },
    classification: {
      breached: evalResult.breached,
      severity,
      overallCompliance: evalResult.overallCompliance,
      capaRequired: needsCapa,
      rootCauseCode: ROOT_CAUSE_CODES.includes(rootCauseCode) ? rootCauseCode : "UNKNOWN",
      rootCauseDetail: String(rootCauseDetail || "").slice(0, 2000)
    },
    timeline: {
      detectedAt: detectedAt || nowIso,
      declaredAt: declaredAt || detectedAt || nowIso,
      restoredAt: restoredAt || null,
      stabilizedAt: stabilizedAt || null,
      reportedAt: nowIso
    },
    governance: {
      accountableAuthority:
        accountableAuthority || svc?.accountableAuthority || "Platform Operations Lead",
      auditAuthority,
      communicationChannelIds: channels,
      module21Engine: "backup-recovery-ops",
      module30Governance: "platform-ops",
      phase14PolicyRef: svc?.phase14TargetId || null
    },
    correctiveActions: actions,
    evidence: Array.isArray(evidence) ? evidence : [],
    metadata: {
      schemaVersion: "1.0.0",
      createdAt: nowIso,
      createdBy: accountableAuthority || svc?.accountableAuthority || "system",
      lastModifiedAt: nowIso,
      lastModifiedBy: accountableAuthority || svc?.accountableAuthority || "system",
      correlationId: correlationId || null,
      labels: {
        phase: "15",
        document: "EBCBDRS"
      }
    }
  };

  return ok({ payload, evaluation: evalResult });
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function cryptoRandomUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Deterministic-enough fallback for older runtimes in tests
  return "00000000-0000-4000-8000-000000000001";
}

/**
 * Structural validation of a breach-report payload (mirrors schema rules).
 */
export function validateBreachReportPayload(payload = {}) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return err("P15-VAL-001", "payload must be an object");
  }

  if (!payload.reportId || !UUID_PATTERN.test(String(payload.reportId))) {
    errors.push("reportId must be UUID format");
  }
  if (!payload.incidentId || !INC_PATTERN.test(String(payload.incidentId))) {
    errors.push("incidentId must match INC-* pattern");
  }
  if (!payload.recoveryTargetId || !REC_TARGET_PATTERN.test(String(payload.recoveryTargetId))) {
    errors.push("recoveryTargetId must match REC-TARGET-* pattern");
  }
  if (!BREACH_KINDS.includes(payload.kind)) {
    errors.push("kind must be RPO, RTO, or Combined");
  }

  const svc = payload.service;
  if (!svc || typeof svc !== "object") errors.push("service object required");
  else if (!SVC_PATTERN.test(String(svc.serviceId || ""))) {
    errors.push("service.serviceId must match SVC-NNN");
  }

  const cls = payload.classification;
  if (!cls || typeof cls !== "object") errors.push("classification object required");
  else {
    if (!SEVERITY_LEVELS.includes(cls.severity)) {
      errors.push("classification.severity must be Level0–Level4");
    }
    if (typeof cls.breached !== "boolean") errors.push("classification.breached required");
    if (capaRequiredForSeverity(cls.severity)) {
      if (!Array.isArray(payload.correctiveActions) || payload.correctiveActions.length < 1) {
        errors.push("correctiveActions required (min 1) when severity is Level2+");
      }
    }
  }

  const tl = payload.timeline;
  if (!tl || typeof tl !== "object") errors.push("timeline object required");
  else {
    const detected = parseTime(tl.detectedAt);
    const declared = parseTime(tl.declaredAt);
    const restored = parseTime(tl.restoredAt);
    const stabilized = parseTime(tl.stabilizedAt);
    const reported = parseTime(tl.reportedAt);
    if (detected == null) errors.push("timeline.detectedAt invalid");
    if (declared == null) errors.push("timeline.declaredAt invalid");
    if (reported == null) errors.push("timeline.reportedAt invalid");
    if (detected != null && declared != null && declared < detected) {
      errors.push("timeline.declaredAt must be >= detectedAt");
    }
    if (restored != null && declared != null && restored < declared) {
      errors.push("timeline.restoredAt must be >= declaredAt");
    }
    if (stabilized != null && restored != null && stabilized < restored) {
      errors.push("timeline.stabilizedAt must be >= restoredAt");
    }
    if (reported != null && detected != null && reported < detected) {
      errors.push("timeline.reportedAt must be >= detectedAt");
    }
  }

  const gov = payload.governance;
  if (!gov || typeof gov !== "object") errors.push("governance object required");
  else {
    if (!gov.accountableAuthority) errors.push("governance.accountableAuthority required");
    if (!gov.auditAuthority) errors.push("governance.auditAuthority required");
    if (gov.accountableAuthority && gov.auditAuthority && gov.accountableAuthority === gov.auditAuthority) {
      errors.push("governance: accountableAuthority must differ from auditAuthority");
    }
  }

  const m = payload.measurement;
  if (!m || typeof m !== "object") errors.push("measurement object required");
  else if (payload.kind === "RPO" && !m.rpo) errors.push("measurement.rpo required for kind RPO");
  else if (payload.kind === "RTO" && !m.rto) errors.push("measurement.rto required for kind RTO");
  else if (payload.kind === "Combined" && (!m.rpo || !m.rto)) {
    errors.push("measurement.rpo and measurement.rto required for Combined");
  }

  if (!payload.metadata || typeof payload.metadata !== "object") {
    errors.push("metadata object required");
  }

  if (errors.length) {
    return err("P15-VAL-000", "breach report payload invalid", { errors });
  }
  return ok({ reportId: payload.reportId, severity: cls?.severity });
}

/**
 * Compliance KPIs from a set of evaluations or payloads.
 */
export function computeComplianceKpis(items = []) {
  const list = Array.isArray(items) ? items : [];
  let measured = 0;
  let compliant = 0;
  let breached = 0;
  let capaOpen = 0;
  const bySeverity = {
    Level0: 0,
    Level1: 0,
    Level2: 0,
    Level3: 0,
    Level4: 0
  };

  for (const raw of list) {
    const item = raw?.evaluation || raw?.payload?.classification || raw?.classification || raw;
    if (!item || typeof item !== "object") continue;
    measured += 1;
    const sev = item.severity || (item.breached ? "Level1" : "Level0");
    if (bySeverity[sev] != null) bySeverity[sev] += 1;
    if (item.breached || item.overallCompliance === "breached") breached += 1;
    else compliant += 1;
    if (item.capaRequired || capaRequiredForSeverity(sev)) {
      const actions = raw?.payload?.correctiveActions || raw?.correctiveActions || [];
      if (!Array.isArray(actions) || actions.some((a) => a.status === "open" || !a.status)) {
        capaOpen += 1;
      }
    }
  }

  const complianceRate = measured === 0 ? null : compliant / measured;
  return Object.freeze({
    measured,
    compliant,
    breached,
    complianceRate,
    breachRate: measured === 0 ? null : breached / measured,
    capaOpen,
    bySeverity: Object.freeze({ ...bySeverity }),
    overallCompliance:
      measured === 0 ? "not_measured" : breached === 0 ? "compliant" : "breached"
  });
}

export function measurementPassFail(measuredMinutes, targetMinutes) {
  const measured = Number(measuredMinutes);
  const target = Number(targetMinutes);
  if (!Number.isFinite(measured) || !Number.isFinite(target) || target <= 0) {
    return err("P15-PF-001", "measuredMinutes and positive targetMinutes required");
  }
  const passed = measured <= target;
  return ok({
    passed,
    failed: !passed,
    passFail: passed ? "pass" : "fail",
    measuredMinutes: measured,
    targetMinutes: target,
    percentOverTarget: percentOverTarget(measured, target)
  });
}
