/**
 * Phase 18 — Ops SLA evaluation helpers (EOSSMS).
 * Incident response/resolve SLA, sync retry lookup, offline escalation,
 * collector status messages, EOD decision helpers.
 * Catalog/evaluation only — does not replace Module 15 sync engine.
 */

import {
  EOSSMS_VERSION,
  PHASE13_DASHBOARD_REFRESH,
  SYNC_WORKFLOW_STAGES,
  COLLECTOR_STATUSES,
  getIncidentSla,
  getIncidentSlaBySeverity,
  getSyncRetryPolicy,
  listSyncRetryPolicies,
  listEscalationThresholds,
  getCollectorMessageByStatus,
  getOfflineModeByName,
  getDecisionFlowNode
} from "./canonical-operations-registry.js";

export const P18_OPS_SLA_VERSION = "1.0.0";
export { EOSSMS_VERSION, PHASE13_DASHBOARD_REFRESH, SYNC_WORKFLOW_STAGES, COLLECTOR_STATUSES };

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
 * Evaluate incident SLA for response and resolve windows.
 */
export function evaluateIncidentSla({
  severity,
  slaId,
  elapsedResponseMinutes,
  elapsedResolveMinutes,
  resolved = false
} = {}) {
  const sla = slaId ? getIncidentSla(slaId) : getIncidentSlaBySeverity(severity);
  if (!sla) return err("P18-SLA-001", "Unknown incident severity / SLA");

  const resp = num(elapsedResponseMinutes);
  const resv = num(elapsedResolveMinutes);

  const responseMet = resp == null ? null : resp <= sla.responseMinutes;
  const resolveMet = resv == null ? null : resv <= sla.resolveMinutes;
  const escalateDue = resp != null && resp >= sla.escalateMinutes && !resolved;

  let overall = "pending";
  if (resolved && resolveMet === true && (responseMet === true || responseMet == null)) {
    overall = "met";
  } else if (responseMet === false || resolveMet === false) {
    overall = "breached";
  } else if (responseMet === true && !resolved) {
    overall = "response_met_open";
  }

  return ok({
    slaId: sla.id,
    severity: sla.severity,
    responseMinutes: sla.responseMinutes,
    resolveMinutes: sla.resolveMinutes,
    escalateMinutes: sla.escalateMinutes,
    elapsedResponseMinutes: resp,
    elapsedResolveMinutes: resv,
    responseMet,
    resolveMet,
    escalateDue,
    overall,
    majorIncidentEligible: !!sla.majorIncidentEligible
  });
}

/**
 * Look up sync retry policy by id or by queue item status / failure class.
 */
export function lookupSyncRetryPolicy({ policyId, status, failureClass } = {}) {
  if (policyId) {
    const p = getSyncRetryPolicy(policyId);
    if (!p) return err("P18-RETRY-001", `Unknown retry policy ${policyId}`);
    return ok({ policy: p });
  }

  let code = null;
  if (status === "conflict_detected") code = "RETRY-004";
  else if (failureClass === "device_revoked") code = "RETRY-005";
  else if (failureClass === "validation") code = "RETRY-003";
  else if (failureClass === "server_busy") code = "RETRY-002";
  else if (status === "failed" || status === "retrying" || failureClass === "network") {
    code = "RETRY-001";
  }

  if (!code) {
    return err("P18-RETRY-002", "Unable to resolve retry policy", {
      status,
      failureClass,
      available: listSyncRetryPolicies().map((p) => p.id)
    });
  }

  const policy = getSyncRetryPolicy(code);
  const nextBackoff =
    policy.maxAttempts > 0 && Array.isArray(policy.backoffSeconds) && policy.backoffSeconds.length
      ? policy.backoffSeconds[0]
      : null;

  return ok({
    policy,
    allowsAutoRetry: policy.maxAttempts > 0,
    nextBackoffSeconds: nextBackoff
  });
}

/**
 * Compute next backoff given attempt index (0-based).
 */
export function nextRetryBackoffSeconds(policyId, attemptIndex = 0) {
  const policy = getSyncRetryPolicy(policyId);
  if (!policy) return err("P18-RETRY-010", `Unknown policy ${policyId}`);
  if (policy.maxAttempts <= 0) {
    return ok({ retryAllowed: false, backoffSeconds: null, reason: "no_auto_retry" });
  }
  const idx = Math.max(0, Math.floor(num(attemptIndex) ?? 0));
  if (idx >= policy.maxAttempts) {
    return ok({ retryAllowed: false, backoffSeconds: null, reason: "max_attempts_exceeded" });
  }
  const list = policy.backoffSeconds || [];
  const backoffSeconds = list[Math.min(idx, list.length - 1)] ?? null;
  return ok({
    retryAllowed: true,
    backoffSeconds,
    attemptIndex: idx,
    maxAttempts: policy.maxAttempts,
    escalateAfterHours: policy.escalateAfterHours
  });
}

function compare(operator, measured, threshold) {
  switch (operator) {
    case "gte":
      return measured >= threshold;
    case "gt":
      return measured > threshold;
    case "lte":
      return measured <= threshold;
    case "lt":
      return measured < threshold;
    case "eq":
      return measured === threshold;
    default:
      return false;
  }
}

/**
 * Evaluate offline / sync escalation thresholds (4h, 24h, queue>1000, success<99%).
 */
export function evaluateOfflineEscalation({
  offlineDurationHours,
  queueSize,
  syncSuccessPct,
  openConflicts
} = {}) {
  const triggered = [];
  const metrics = {
    offline_duration_hours: num(offlineDurationHours),
    queue_size: num(queueSize),
    sync_success_pct: num(syncSuccessPct),
    open_conflicts: num(openConflicts)
  };

  for (const esc of listEscalationThresholds()) {
    const measured = metrics[esc.metric];
    if (measured == null) continue;
    if (compare(esc.operator, measured, esc.thresholdValue)) {
      triggered.push({
        id: esc.id,
        code: esc.code,
        metric: esc.metric,
        measured,
        thresholdValue: esc.thresholdValue,
        operator: esc.operator,
        escalateTo: esc.escalateTo,
        severityHint: esc.severityHint
      });
    }
  }

  triggered.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return (rank[a.severityHint] ?? 9) - (rank[b.severityHint] ?? 9);
  });

  const highest = triggered[0] || null;
  return ok({
    triggered,
    escalate: triggered.length > 0,
    highest,
    consumesEscalationTable: true
  });
}

/**
 * Resolve collector-facing status message for a connectivity status.
 */
export function resolveCollectorStatusMessage({ status, offlineMode } = {}) {
  let resolved = status;
  if (!resolved && offlineMode) {
    const mode = getOfflineModeByName(offlineMode);
    resolved = mode?.collectorStatus || offlineMode;
  }
  if (resolved === "Recovery") resolved = "SyncFailed";
  if (resolved === "synchronization_failed") resolved = "SyncFailed";
  if (resolved === "poor_network") resolved = "PoorNetwork";
  if (resolved === "online") resolved = "Online";
  if (resolved === "offline") resolved = "Offline";
  if (resolved === "synchronizing") resolved = "Synchronizing";

  const msg = getCollectorMessageByStatus(resolved);
  if (!msg) {
    return err("P18-CSM-001", `Unknown collector status ${resolved}`, {
      allowed: [...COLLECTOR_STATUSES]
    });
  }
  return ok({
    status: msg.status,
    shortLabel: msg.shortLabel,
    message: msg.message,
    accessibilityLabel: msg.accessibilityLabel,
    colorHint: msg.colorHint,
    infoPanelFields: [...(msg.infoPanelFields || [])],
    failureGuidance: msg.failureGuidance ? [...msg.failureGuidance] : null,
    warningThresholdsHours: msg.warningThresholdsHours
      ? [...msg.warningThresholdsHours]
      : null
  });
}

/**
 * EOD decision helper for collectors / branch supervisors.
 */
export function evaluateEodDecision({
  pendingCount = 0,
  online = false,
  offlineDurationHours = 0,
  waivePartial = false,
  deviceSecure = true
} = {}) {
  const pending = num(pendingCount) ?? 0;
  const offlineH = num(offlineDurationHours) ?? 0;

  if (online && pending === 0) {
    return ok({
      flow: "eod",
      outcome: "sync_complete",
      action: "Close day; confirm branch reconciliation",
      openIncident: false
    });
  }

  if (online && pending > 0) {
    return ok({
      flow: "eod",
      outcome: "start_sync",
      action: "Run Sync now until queue drained or escalate",
      openIncident: false,
      decisionNodeId: "DF-003"
    });
  }

  if (!online && offlineH >= 24) {
    return ok({
      flow: "eod",
      outcome: "open_incident",
      action: "Open SEV-001/SEV-002 incident; escalate Regional Ops",
      openIncident: true,
      escalationId: "ESC-002"
    });
  }

  if (!online && offlineH >= 4) {
    return ok({
      flow: "eod",
      outcome: "open_incident",
      action: "Escalate Branch Supervisor; keep collecting if allowed; plan sync",
      openIncident: true,
      escalationId: "ESC-001"
    });
  }

  if (!online && pending > 0 && waivePartial) {
    return ok({
      flow: "eod",
      outcome: "partial_waive",
      action: "Supervisor waive documented; secure device; sync next connectivity",
      openIncident: false,
      deviceSecure
    });
  }

  if (!online) {
    return ok({
      flow: "eod",
      outcome: "secure_offline",
      action: "Secure device; remind collector EOD sync; monitor ESC thresholds",
      openIncident: false,
      deviceSecure
    });
  }

  return ok({
    flow: "eod",
    outcome: "sync_complete",
    action: "Confirm reconciliation",
    openIncident: false
  });
}

/**
 * Generic decision-flow outcome resolver for documented flows.
 */
export function evaluateDecisionFlow({
  flow,
  online = true,
  highRisk = false,
  readOnly = false,
  poorNetwork = false,
  conflict = false,
  financial = false,
  offlineDurationHours = 0,
  pendingCount = 0,
  deviceRevoked = false,
  deviceLost = false
} = {}) {
  const flowNode = ["DF-001", "DF-002", "DF-003", "DF-004", "DF-005", "DF-006", "DF-007"]
    .map((id) => getDecisionFlowNode(id))
    .find((n) => n && n.flow === flow);

  if (!flowNode) return err("P18-DF-001", `Unknown decision flow ${flow}`);

  let outcome = null;

  if (flow === "start_of_day") {
    if (deviceRevoked || readOnly) outcome = "device_blocked";
    else if (!online && offlineDurationHours >= 4) outcome = "escalate";
    else if (!online) outcome = "work_offline";
    else outcome = "go_online";
  } else if (flow === "transaction") {
    if (readOnly || deviceRevoked) outcome = "read_only_block";
    else if (!online && highRisk) outcome = "block_high_risk";
    else if (!online) outcome = "enqueue_offline";
    else outcome = "post_online";
  } else if (flow === "sync") {
    if (deviceRevoked) outcome = "escalate";
    else if (poorNetwork && (pendingCount ?? 0) > 100) outcome = "defer_poor_network";
    else if (!online) outcome = "defer_poor_network";
    else outcome = "start_sync";
  } else if (flow === "conflict") {
    if (financial) outcome = "manual_resolve";
    else if (conflict) outcome = "auto_business_rule";
    else outcome = "hold";
  } else if (flow === "eod") {
    return evaluateEodDecision({
      pendingCount,
      online,
      offlineDurationHours,
      waivePartial: false,
      deviceSecure: !deviceLost
    });
  } else if (flow === "device_replacement") {
    if (deviceLost) outcome = "escalate_loss";
    else if (deviceRevoked) outcome = "authorize_new";
    else outcome = "revoke_old";
  } else if (flow === "escalation") {
    const esc = evaluateOfflineEscalation({
      offlineDurationHours,
      queueSize: pendingCount,
      syncSuccessPct: online ? 100 : 95,
      openConflicts: conflict ? 30 : 0
    });
    if (!esc.ok) return esc;
    if (esc.highest?.id === "ESC-002") outcome = "regional";
    else if (esc.highest?.id === "ESC-001") outcome = "branch";
    else if (esc.highest) outcome = "ops_lead";
    else outcome = "branch";
  }

  if (!outcome) return err("P18-DF-002", "Unable to determine outcome");

  return ok({
    flow: flowNode.flow,
    decisionNodeId: flowNode.id,
    outcome,
    allowedOutcomes: [...flowNode.outcomes],
    validOutcome: flowNode.outcomes.includes(outcome)
  });
}

/**
 * Map sync workflow stage index (0–12) to stage name.
 */
export function getSyncWorkflowStage(stageIndex) {
  const idx = Math.floor(num(stageIndex) ?? -1);
  if (idx < 0 || idx >= SYNC_WORKFLOW_STAGES.length) {
    return err("P18-SYNC-001", "stageIndex must be 0..12");
  }
  return ok({
    stageIndex: idx,
    stage: SYNC_WORKFLOW_STAGES[idx],
    totalStages: SYNC_WORKFLOW_STAGES.length,
    progressPct: Math.round(((idx + 1) / SYNC_WORKFLOW_STAGES.length) * 100)
  });
}

export function getDashboardRefreshSchedule() {
  return ok({
    ...PHASE13_DASHBOARD_REFRESH,
    consumesPhase13: true,
    doesNotRedefine: true
  });
}
