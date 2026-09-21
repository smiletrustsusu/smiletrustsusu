/**
 * Phase 6 — ECACIS deliverable governance workflow.
 * Enforces stage sequencing (11), deliverable status transitions (16),
 * segregation of duties, Approved-with-Conditions rules, and immutable audit log.
 * Error codes: P6W-xxx. Does not change money math / RBAC / posting.
 */

export const P6_WORKFLOW_VERSION = "1.0.0";

/** Stage sequencing 1–11 (cannot skip). */
export const P6_STAGES = Object.freeze([
  Object.freeze({ id: 1, code: "INPUT_VALIDATION", name: "Input Validation" }),
  Object.freeze({ id: 2, code: "API_OWNERSHIP_REGISTRY", name: "API Ownership Registry" }),
  Object.freeze({ id: 3, code: "ENDPOINT_REGISTRY", name: "Endpoint Registry" }),
  Object.freeze({ id: 4, code: "CANONICAL_INTERFACE_CONTRACTS", name: "Canonical Interface Contracts" }),
  Object.freeze({ id: 5, code: "SCHEMA_REGISTRY", name: "Schema Registry" }),
  Object.freeze({ id: 6, code: "SECURITY_AUTHORIZATION", name: "Security & Authorization" }),
  Object.freeze({ id: 7, code: "OPERATIONAL_CHARACTERISTICS", name: "Operational Characteristics" }),
  Object.freeze({ id: 8, code: "VERSIONING_LIFECYCLE", name: "Versioning & Lifecycle" }),
  Object.freeze({ id: 9, code: "MACHINE_READABLE_SPECS", name: "Machine-Readable Specs" }),
  Object.freeze({ id: 10, code: "TRACEABILITY_CROSS_REFERENCES", name: "Traceability & Cross-References" }),
  Object.freeze({ id: 11, code: "FINAL_QUALITY_REVIEW", name: "Final Quality Review" })
]);

/** Exactly 16 deliverable statuses. */
export const P6_STATUSES = Object.freeze([
  "NotStarted",
  "Draft",
  "InAuthoring",
  "Submitted",
  "UnderReview",
  "ChangesRequested",
  "PendingApproval",
  "Approved",
  "ApprovedWithConditions",
  "ConditionsInProgress",
  "Rejected",
  "BaselineCandidate",
  "Baselined",
  "Published",
  "Deprecated",
  "Retired"
]);

/** Allowed status transitions only. */
export const P6_STATUS_TRANSITIONS = Object.freeze({
  NotStarted: ["Draft"],
  Draft: ["InAuthoring", "Rejected"],
  InAuthoring: ["Submitted", "Draft", "Rejected"],
  Submitted: ["UnderReview", "ChangesRequested", "Rejected"],
  UnderReview: ["ChangesRequested", "PendingApproval", "Rejected"],
  ChangesRequested: ["InAuthoring", "Submitted", "Rejected"],
  PendingApproval: ["Approved", "ApprovedWithConditions", "Rejected", "ChangesRequested"],
  Approved: ["BaselineCandidate", "Deprecated"],
  ApprovedWithConditions: ["ConditionsInProgress", "Rejected"],
  ConditionsInProgress: ["ApprovedWithConditions", "Approved", "Rejected"],
  Rejected: ["Draft"],
  BaselineCandidate: ["Baselined", "Approved", "Rejected"],
  Baselined: ["Published", "Deprecated"],
  Published: ["Deprecated"],
  Deprecated: ["Retired", "Published"],
  Retired: []
});

export const P6_FINDING_SEVERITIES = Object.freeze(["Critical", "Major", "Minor", "Info"]);

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

export function createDeliverable(input = {}) {
  const primaryOwner = String(input.primaryOwner || "").trim();
  const accountableApprover = String(input.accountableApprover || "").trim();
  const independentReviewer = String(input.independentReviewer || "").trim();
  if (!primaryOwner || !accountableApprover) {
    return err("P6W-001", "primaryOwner and accountableApprover are required");
  }
  if (primaryOwner === accountableApprover) {
    return err("P6W-010", "SoD violation: Primary Owner must not equal Accountable Approver");
  }
  if (independentReviewer && independentReviewer === primaryOwner) {
    return err("P6W-011", "SoD violation: owner cannot be the sole independent reviewer");
  }
  const deliverable = {
    id: input.id || `P6-DEL-${Date.now()}`,
    title: input.title || "ECACIS Deliverable",
    status: "NotStarted",
    currentStage: 0,
    stageCompletion: Object.fromEntries(P6_STAGES.map((s) => [s.id, false])),
    primaryOwner,
    accountableApprover,
    independentReviewer: independentReviewer || null,
    conditions: [],
    findings: [],
    approvals: {
      primaryOwnerSigned: false,
      accountableApproverSigned: false,
      independentReviewerSigned: false,
      finalQualitySigned: false
    },
    auditLog: []
  };
  appendAudit(deliverable, "CREATED", { actor: input.actor || primaryOwner });
  return ok({ deliverable });
}

export function appendAudit(deliverable, action, meta = {}) {
  const entry = Object.freeze({
    at: meta.at || new Date().toISOString(),
    action,
    actor: meta.actor || "system",
    from: meta.from,
    to: meta.to,
    detail: meta.detail || null
  });
  deliverable.auditLog.push(entry);
  return entry;
}

export function getAuditLog(deliverable) {
  return Object.freeze([...(deliverable.auditLog || [])]);
}

export function isTransitionAllowed(from, to) {
  const allowed = P6_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function transitionStatus(deliverable, toStatus, meta = {}) {
  const from = deliverable.status;
  if (!P6_STATUSES.includes(toStatus)) {
    return err("P6W-020", `Unknown status: ${toStatus}`);
  }
  if (!isTransitionAllowed(from, toStatus)) {
    return err("P6W-021", `Illegal status transition ${from} → ${toStatus}`, { from, to: toStatus });
  }
  if (toStatus === "Baselined") {
    const open = (deliverable.conditions || []).filter((c) => c.status !== "closed");
    if (deliverable.status === "ApprovedWithConditions" || deliverable.status === "ConditionsInProgress" || open.length) {
      if (open.length) {
        return err("P6W-040", "Cannot baseline while conditions remain open", { openCount: open.length });
      }
    }
    if (from === "BaselineCandidate") {
      const open2 = (deliverable.conditions || []).filter((c) => c.status !== "closed");
      if (open2.length) return err("P6W-040", "Cannot baseline while conditions remain open", { openCount: open2.length });
    }
  }
  if (toStatus === "Published") {
    const a = deliverable.approvals || {};
    if (!a.primaryOwnerSigned || !a.accountableApproverSigned || !a.finalQualitySigned) {
      return err("P6W-050", "Cannot publish without required approvals");
    }
    if (deliverable.primaryOwner === deliverable.accountableApprover) {
      return err("P6W-010", "SoD violation: Primary Owner must not equal Accountable Approver");
    }
    if (!deliverable.independentReviewer || deliverable.independentReviewer === deliverable.primaryOwner) {
      return err("P6W-011", "SoD violation: owner cannot be the sole independent reviewer");
    }
    if (!a.independentReviewerSigned) {
      return err("P6W-050", "Cannot publish without independent reviewer sign-off");
    }
    const open = (deliverable.conditions || []).filter((c) => c.status !== "closed");
    if (open.length) return err("P6W-040", "Cannot publish while conditions remain open");
  }
  if (toStatus === "ApprovedWithConditions") {
    const critical = (deliverable.findings || []).filter((f) => f.severity === "Critical" && f.status !== "closed");
    if (critical.length) {
      return err("P6W-030", "Approved-with-Conditions forbidden while Critical findings remain", { criticalCount: critical.length });
    }
  }
  deliverable.status = toStatus;
  appendAudit(deliverable, "STATUS_TRANSITION", { actor: meta.actor, from, to: toStatus, detail: meta.detail });
  return ok({ deliverable, from, to: toStatus });
}

export function assertSod(deliverable) {
  if (deliverable.primaryOwner === deliverable.accountableApprover) {
    return err("P6W-010", "SoD violation: Primary Owner must not equal Accountable Approver");
  }
  if (!deliverable.independentReviewer || deliverable.independentReviewer === deliverable.primaryOwner) {
    return err("P6W-011", "SoD violation: owner cannot be the sole independent reviewer");
  }
  return ok();
}

export function completeStage(deliverable, stageId, meta = {}) {
  const stage = P6_STAGES.find((s) => s.id === Number(stageId));
  if (!stage) return err("P6W-060", `Unknown stage: ${stageId}`);
  const id = stage.id;
  const nextIncomplete = P6_STAGES.find((s) => !deliverable.stageCompletion[s.id]);
  if (!nextIncomplete || nextIncomplete.id !== id) {
    return err("P6W-062", `Stage sequencing violation: next required stage is ${nextIncomplete ? nextIncomplete.id : "none"}`, {
      attempted: id,
      next: nextIncomplete ? nextIncomplete.id : null,
      blockedBy: nextIncomplete ? nextIncomplete.id : null
    });
  }
  if (!meta.criteriaMet) {
    return err("P6W-063", `Stage ${id} completion criteria not met`, { stage: stage.code });
  }
  deliverable.stageCompletion[id] = true;
  deliverable.currentStage = id;
  appendAudit(deliverable, "STAGE_COMPLETED", { actor: meta.actor, detail: { stageId: id, code: stage.code } });
  return ok({ deliverable, stage });
}

export function allStagesComplete(deliverable) {
  return P6_STAGES.every((s) => deliverable.stageCompletion[s.id] === true);
}

export function addFinding(deliverable, finding = {}, meta = {}) {
  const severity = finding.severity || "Minor";
  if (!P6_FINDING_SEVERITIES.includes(severity)) {
    return err("P6W-070", `Invalid finding severity: ${severity}`);
  }
  const row = {
    id: finding.id || `F-${(deliverable.findings.length || 0) + 1}`,
    severity,
    summary: finding.summary || "",
    status: finding.status || "open"
  };
  deliverable.findings.push(row);
  appendAudit(deliverable, "FINDING_ADDED", { actor: meta.actor, detail: row });
  return ok({ finding: row, deliverable });
}

export function closeFinding(deliverable, findingId, meta = {}) {
  const f = (deliverable.findings || []).find((x) => x.id === findingId);
  if (!f) return err("P6W-071", `Finding not found: ${findingId}`);
  f.status = "closed";
  appendAudit(deliverable, "FINDING_CLOSED", { actor: meta.actor, detail: { findingId } });
  return ok({ deliverable, finding: f });
}

export function addCondition(deliverable, condition = {}, meta = {}) {
  if (deliverable.status !== "ApprovedWithConditions" && deliverable.status !== "ConditionsInProgress" && deliverable.status !== "PendingApproval") {
    // allow drafting conditions when moving toward AWC; still record
  }
  const row = {
    id: condition.id || `C-${(deliverable.conditions.length || 0) + 1}`,
    summary: condition.summary || "",
    status: "open",
    createdAt: new Date().toISOString()
  };
  deliverable.conditions.push(row);
  appendAudit(deliverable, "CONDITION_ADDED", { actor: meta.actor, detail: row });
  return ok({ condition: row, deliverable });
}

export function closeCondition(deliverable, conditionId, meta = {}) {
  const c = (deliverable.conditions || []).find((x) => x.id === conditionId);
  if (!c) return err("P6W-041", `Condition not found: ${conditionId}`);
  c.status = "closed";
  c.closedAt = new Date().toISOString();
  appendAudit(deliverable, "CONDITION_CLOSED", { actor: meta.actor, detail: { conditionId } });
  return ok({ deliverable, condition: c });
}

export function openConditions(deliverable) {
  return (deliverable.conditions || []).filter((c) => c.status !== "closed");
}

export function recordApproval(deliverable, role, meta = {}) {
  const map = {
    primaryOwner: "primaryOwnerSigned",
    accountableApprover: "accountableApproverSigned",
    independentReviewer: "independentReviewerSigned",
    finalQuality: "finalQualitySigned"
  };
  const key = map[role];
  if (!key) return err("P6W-080", `Unknown approval role: ${role}`);
  if (role === "accountableApprover" && meta.actor && meta.actor === deliverable.primaryOwner) {
    return err("P6W-010", "SoD violation: Primary Owner must not equal Accountable Approver");
  }
  if (role === "independentReviewer" && meta.actor && meta.actor === deliverable.primaryOwner) {
    return err("P6W-011", "SoD violation: owner cannot be the sole independent reviewer");
  }
  deliverable.approvals[key] = true;
  appendAudit(deliverable, "APPROVAL_RECORDED", { actor: meta.actor, detail: { role } });
  return ok({ deliverable });
}

export function canApproveWithConditions(deliverable) {
  const critical = (deliverable.findings || []).filter((f) => f.severity === "Critical" && f.status !== "closed");
  if (critical.length) return err("P6W-030", "Approved-with-Conditions forbidden while Critical findings remain", { criticalCount: critical.length });
  return ok();
}

export function listStages() {
  return [...P6_STAGES];
}

export function listStatuses() {
  return [...P6_STATUSES];
}