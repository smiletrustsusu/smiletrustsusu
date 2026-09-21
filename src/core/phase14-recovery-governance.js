/**
 * Phase 14 — Recovery target measurement, pass/fail vs EDDIES targets,
 * stabilization checks, and decision-rights / SoD helpers.
 * Does not execute backups (Module 21) or replace Module 30 governance.
 */

import {
  RPO_RTO_TARGETS,
  getRpoRtoTarget,
  getStabilizationMinutes,
  STABILIZATION_PERIODS,
  assertSingleAccountableAuthority
} from "./canonical-deployment-registry.js";

export const P14_RECOVERY_GOVERNANCE_VERSION = "1.0.0";

export const DECISION_RIGHTS = Object.freeze({
  exclusive: Object.freeze([
    "approve_production_failover",
    "approve_rpo_rto_exception",
    "declare_disaster",
    "accept_recovery_measurement"
  ]),
  nonDelegable: Object.freeze([
    "approve_production_failover",
    "declare_disaster"
  ]),
  delegable: Object.freeze([
    "schedule_recovery_drill",
    "execute_backup_verify",
    "draft_rpo_rto_change"
  ])
});

export const MEASUREMENT_CLOCK = Object.freeze({
  timezone: "UTC",
  format: "ISO-8601",
  syncRequirement: "NTP or equivalent; clock skew documented if > 1s"
});

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function toMs(minutes) {
  return Number(minutes) * 60 * 1000;
}

function parseTime(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : null;
}

/**
 * RPO formula:
 *   measuredRpoMinutes = (recoveryPointTimestamp - lastDurableCommitTimestamp) / 60000
 * Pass when measuredRpoMinutes <= targetRpoMinutes.
 *
 * Start event: last confirmed durable data commit / backup consistency mark.
 * End event: earliest recoverable consistent point used for restore.
 */
export function measureRpo({
  targetId,
  targetRpoMinutes,
  lastDurableCommitAt,
  recoveryPointAt,
  measuredRpoMinutes,
  environment = "production"
} = {}) {
  const target = targetId ? getRpoRtoTarget(targetId) : null;
  const budget =
    Number.isFinite(targetRpoMinutes)
      ? Number(targetRpoMinutes)
      : Number(
          target?.measurementRpoTargetMinutes ??
            target?.rpoMinutes ??
            NaN
        );

  if (!Number.isFinite(budget) || budget <= 0) {
    return err("P14-RPO-001", "targetRpoMinutes or registered target required");
  }

  let measured = measuredRpoMinutes;
  if (!Number.isFinite(measured)) {
    const start = parseTime(lastDurableCommitAt);
    const end = parseTime(recoveryPointAt);
    if (start == null || end == null) {
      return err("P14-RPO-002", "Provide measuredRpoMinutes or lastDurableCommitAt + recoveryPointAt");
    }
    if (end < start) {
      return err("P14-RPO-003", "recoveryPointAt must be >= lastDurableCommitAt");
    }
    measured = (end - start) / 60000;
  }

  measured = Number(measured);
  if (!Number.isFinite(measured) || measured < 0) {
    return err("P14-RPO-004", "measuredRpoMinutes must be a non-negative number");
  }

  const passed = measured <= budget;
  return ok({
    kind: "RPO",
    targetId: target?.id || targetId || null,
    service: target?.service || null,
    environment,
    measuredRpoMinutes: measured,
    targetRpoMinutes: budget,
    passed,
    failed: !passed,
    formula: "measuredRpoMinutes = (recoveryPointAt - lastDurableCommitAt) / 60000; pass iff measured <= target",
    startEvent: "lastDurableCommitAt",
    endEvent: "recoveryPointAt",
    clock: MEASUREMENT_CLOCK,
    evidenceRequired: Object.freeze([
      "backup_set_id_or_commit_marker",
      "timestamps_utc",
      "operator_id"
    ])
  });
}

/**
 * RTO formula:
 *   measuredRtoMinutes = (serviceStabilizedAt - incidentDeclaredAt) / 60000
 * Pass when measuredRtoMinutes <= targetRtoMinutes.
 * Stabilization period (production default 30m) must elapse after restore
 * before serviceStabilizedAt may be declared.
 */
export function measureRto({
  targetId,
  targetRtoMinutes,
  incidentDeclaredAt,
  restoreCompletedAt,
  serviceStabilizedAt,
  measuredRtoMinutes,
  environment = "production",
  stabilizationMinutes
} = {}) {
  const target = targetId ? getRpoRtoTarget(targetId) : null;
  const budget =
    Number.isFinite(targetRtoMinutes)
      ? Number(targetRtoMinutes)
      : Number(
          target?.measurementRtoTargetMinutes ??
            target?.rtoMinutes ??
            NaN
        );

  if (!Number.isFinite(budget) || budget <= 0) {
    return err("P14-RTO-001", "targetRtoMinutes or registered target required");
  }

  const stabRequired =
    Number.isFinite(stabilizationMinutes)
      ? Number(stabilizationMinutes)
      : Number(
          target?.stabilizationMinutesProduction ??
            getStabilizationMinutes(environment)
        );

  let measured = measuredRtoMinutes;
  const declared = parseTime(incidentDeclaredAt);
  const stabilized = parseTime(serviceStabilizedAt);
  const restored = parseTime(restoreCompletedAt);

  if (!Number.isFinite(measured)) {
    if (declared == null || stabilized == null) {
      return err("P14-RTO-002", "Provide measuredRtoMinutes or incidentDeclaredAt + serviceStabilizedAt");
    }
    if (stabilized < declared) {
      return err("P14-RTO-003", "serviceStabilizedAt must be >= incidentDeclaredAt");
    }
    measured = (stabilized - declared) / 60000;
  }

  measured = Number(measured);
  if (!Number.isFinite(measured) || measured < 0) {
    return err("P14-RTO-004", "measuredRtoMinutes must be a non-negative number");
  }

  const hasStabTimestamps = Boolean(restoreCompletedAt || serviceStabilizedAt);
  const stabCheck = assertStabilizationPeriod({
    environment,
    restoreCompletedAt: restoreCompletedAt || (restored != null ? new Date(restored).toISOString() : null),
    serviceStabilizedAt: serviceStabilizedAt || (stabilized != null ? new Date(stabilized).toISOString() : null),
    stabilizationMinutes: stabRequired,
    measuredOnly: !hasStabTimestamps
  });

  const withinBudget = measured <= budget;
  const stabOk = stabCheck.ok !== false && stabCheck.passed !== false;
  const passed = withinBudget && stabOk;
  return ok({
    kind: "RTO",
    targetId: target?.id || targetId || null,
    service: target?.service || null,
    environment,
    measuredRtoMinutes: measured,
    targetRtoMinutes: budget,
    stabilizationMinutesRequired: stabRequired,
    stabilization: stabCheck,
    passed,
    failed: !passed,
    formula:
      "measuredRtoMinutes = (serviceStabilizedAt - incidentDeclaredAt) / 60000; pass iff measured <= target AND stabilization satisfied",
    startEvent: "incidentDeclaredAt",
    endEvent: "serviceStabilizedAt",
    clock: MEASUREMENT_CLOCK,
    evidenceRequired: Object.freeze([
      "incident_id",
      "restore_job_id",
      "health_check_pass_window",
      "timestamps_utc"
    ])
  });
}

/**
 * Production stabilization default: 30 minutes after restore completion
 * before declaring service stabilized / RTO end.
 */
export function assertStabilizationPeriod({
  environment = "production",
  restoreCompletedAt,
  serviceStabilizedAt,
  stabilizationMinutes,
  measuredOnly = false
} = {}) {
  const required =
    Number.isFinite(stabilizationMinutes)
      ? Number(stabilizationMinutes)
      : getStabilizationMinutes(environment);

  if (environment === "production" || environment === "PRODUCTION" || environment === "ENV-005") {
    if (required < 30 && stabilizationMinutes == null) {
      return err("P14-STAB-001", "Production stabilization period must be at least 30 minutes");
    }
  }

  if (measuredOnly || (!restoreCompletedAt && !serviceStabilizedAt)) {
    return ok({
      passed: true,
      skipped: true,
      stabilizationMinutesRequired: required,
      productionDefaultMinutes: STABILIZATION_PERIODS.production.minutes,
      note: "Timestamp pair not provided; requirement recorded only"
    });
  }

  const restored = parseTime(restoreCompletedAt);
  const stabilized = parseTime(serviceStabilizedAt);
  if (restored == null || stabilized == null) {
    return err("P14-STAB-002", "restoreCompletedAt and serviceStabilizedAt required for stabilization check");
  }
  const elapsedMinutes = (stabilized - restored) / 60000;
  const passed = elapsedMinutes >= required;
  return ok({
    passed,
    failed: !passed,
    elapsedMinutes,
    stabilizationMinutesRequired: required,
    productionDefaultMinutes: STABILIZATION_PERIODS.production.minutes
  });
}

/**
 * Validate a measurement record document against a target (catalog governance).
 */
export function validateMeasurementRecord(record = {}) {
  const errors = [];
  if (!record || typeof record !== "object") {
    return err("P14-REC-001", "measurement record must be an object");
  }
  if (!record.kind || !["RPO", "RTO"].includes(record.kind)) {
    errors.push("kind must be RPO or RTO");
  }
  if (!record.targetId) errors.push("targetId required");
  const target = record.targetId ? getRpoRtoTarget(record.targetId) : null;
  if (record.targetId && !target) errors.push(`unknown targetId ${record.targetId}`);

  if (record.kind === "RPO") {
    const m = measureRpo({
      targetId: record.targetId,
      targetRpoMinutes: record.targetRpoMinutes,
      measuredRpoMinutes: record.measuredRpoMinutes,
      lastDurableCommitAt: record.lastDurableCommitAt,
      recoveryPointAt: record.recoveryPointAt,
      environment: record.environment
    });
    if (!m.ok) errors.push(m.message);
    else if (record.expectPass === true && !m.passed) errors.push("expected RPO pass");
    else if (record.expectPass === false && m.passed) errors.push("expected RPO fail");
  }

  if (record.kind === "RTO") {
    const m = measureRto({
      targetId: record.targetId,
      targetRtoMinutes: record.targetRtoMinutes,
      measuredRtoMinutes: record.measuredRtoMinutes,
      incidentDeclaredAt: record.incidentDeclaredAt,
      restoreCompletedAt: record.restoreCompletedAt,
      serviceStabilizedAt: record.serviceStabilizedAt,
      environment: record.environment,
      stabilizationMinutes: record.stabilizationMinutes
    });
    if (!m.ok) errors.push(m.message);
    else if (record.expectPass === true && !m.passed) errors.push("expected RTO pass");
    else if (record.expectPass === false && m.passed) errors.push("expected RTO fail");
  }

  if (record.accountableAuthority && record.auditAuthority) {
    const sod = assertDecisionRightsSoD({
      accountableAuthority: record.accountableAuthority,
      auditAuthority: record.auditAuthority,
      decision: record.decision || "accept_recovery_measurement"
    });
    if (!sod.ok) errors.push(sod.message);
  }

  if (errors.length) return err("P14-REC-000", "measurement record invalid", { errors });
  return ok({ targetId: record.targetId, kind: record.kind });
}

/**
 * Decision-rights SoD: Accountable ≠ Audit for the same decision.
 * Exclusive / non-delegable rights cannot be reassigned in catalog metadata.
 */
export function assertDecisionRightsSoD({
  accountableAuthority,
  auditAuthority,
  approvingAuthority,
  responsibleParty,
  decision,
  delegatedTo
} = {}) {
  const errors = [];
  if (accountableAuthority && auditAuthority && accountableAuthority === auditAuthority) {
    errors.push({
      code: "P14-SOD-001",
      message: "Accountable authority must not equal Audit authority for the same decision"
    });
  }
  if (approvingAuthority && auditAuthority && approvingAuthority === auditAuthority) {
    errors.push({
      code: "P14-SOD-002",
      message: "Approving authority must not equal Audit authority"
    });
  }
  if (decision && DECISION_RIGHTS.nonDelegable.includes(decision) && delegatedTo) {
    errors.push({
      code: "P14-SOD-003",
      message: `Decision ${decision} is non-delegable`
    });
  }
  if (decision && DECISION_RIGHTS.exclusive.includes(decision)) {
    if (!accountableAuthority || !String(accountableAuthority).trim()) {
      errors.push({
        code: "P14-SOD-004",
        message: `Exclusive decision ${decision} requires accountableAuthority`
      });
    }
  }
  if (responsibleParty && auditAuthority && responsibleParty === auditAuthority) {
    errors.push({
      code: "P14-SOD-005",
      message: "Responsible party should not equal Audit authority"
    });
  }
  if (errors.length) {
    return err("P14-SOD-000", "Segregation of duties / decision-rights violation", { errors });
  }
  return ok({ decision: decision || null, accountableAuthority, auditAuthority });
}

export function assertTargetOwnership(target = {}) {
  const aa = assertSingleAccountableAuthority(target, "rpoRtoTarget");
  if (!aa.ok) return aa;
  if (target.auditAuthority && target.accountableAuthority === target.auditAuthority) {
    return err("P14-OWN-001", `${target.id}: accountableAuthority must differ from auditAuthority`);
  }
  return ok({
    id: target.id,
    accountableAuthority: target.accountableAuthority,
    responsibleParty: target.responsibleParty || null,
    auditAuthority: target.auditAuthority || null
  });
}

export function ownershipMatrix(targets = RPO_RTO_TARGETS) {
  return targets.map((t) =>
    Object.freeze({
      targetId: t.id,
      code: t.code,
      service: t.service,
      accountableAuthority: t.accountableAuthority,
      responsibleParty: t.responsibleParty || null,
      auditAuthority: t.auditAuthority || null,
      reviewFrequency: t.testingFrequency || "annual"
    })
  );
}

/**
 * Machine-readable accountable authority decision-rights metadata example.
 */
export function accountableAuthorityMetadataExample() {
  return Object.freeze({
    schemaVersion: "1.0.0",
    decisionRights: DECISION_RIGHTS,
    roles: Object.freeze({
      accountableAuthority: "Platform Operations Lead",
      responsibleParty: "Release Manager",
      approvingAuthority: "SystemOwner",
      auditAuthority: "Internal Auditor"
    }),
    boundaryMatrix: Object.freeze([
      Object.freeze({
        right: "approve_production_failover",
        exclusive: true,
        delegable: false,
        moduleBoundary: "Module 30 metadata; Module 21 executes restore"
      }),
      Object.freeze({
        right: "accept_recovery_measurement",
        exclusive: true,
        delegable: false,
        sod: "Accountable ≠ Audit"
      }),
      Object.freeze({
        right: "schedule_recovery_drill",
        exclusive: false,
        delegable: true,
        emergencyOverride: "SystemOwner with audit trail"
      })
    ]),
    emergency: Object.freeze({
      mayInvoke: Object.freeze(["SystemOwner", "DR Steward"]),
      requiresPostFactoAudit: true,
      maxWindowHours: 24
    }),
    clock: MEASUREMENT_CLOCK
  });
}

export function reportingMetricsFromMeasurement(measurement) {
  if (!measurement || measurement.ok === false) {
    return Object.freeze({
      recovery_measurement_pass: 0,
      recovery_measurement_fail: 1
    });
  }
  return Object.freeze({
    recovery_measurement_pass: measurement.passed ? 1 : 0,
    recovery_measurement_fail: measurement.passed ? 0 : 1,
    measured_rpo_minutes: measurement.measuredRpoMinutes ?? null,
    measured_rto_minutes: measurement.measuredRtoMinutes ?? null,
    target_rpo_minutes: measurement.targetRpoMinutes ?? null,
    target_rto_minutes: measurement.targetRtoMinutes ?? null,
    stabilization_minutes_required: measurement.stabilizationMinutesRequired ?? null
  });
}

export function msForMinutes(minutes) {
  return toMs(minutes);
}
