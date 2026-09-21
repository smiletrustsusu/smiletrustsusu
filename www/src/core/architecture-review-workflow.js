/**
 * Phase 2 — Enterprise Architecture Review workflow (lightweight in-process model).
 * Governance only: stage sequencing, finding lifecycle, SoD, audit log.
 * Does not post collections, change RBAC money limits, or alter Modules 1–30 business logic.
 */

export const ARW_SCHEMA_VERSION = "1.0.0";

/** Sequential review stages (1–14). Cannot skip forward. */
export const ARW_STAGES = Object.freeze([
  "Planned",
  "Review Initiated",
  "Evidence Collection",
  "Technical",
  "Security",
  "Data Governance",
  "Integration",
  "AI Governance",
  "Findings Consolidated",
  "Owner Response",
  "Remediation Verification",
  "Final Approval Review",
  "Approved",
  "Closed"
]);

export const ARW_TERMINAL_STAGES = Object.freeze(["Closed"]);

/** Finding lifecycle (Identified → … → Closed). */
export const ARW_FINDING_STATES = Object.freeze([
  "Identified",
  "Triaged",
  "Accepted",
  "Rejected",
  "Deferred",
  "Remediated",
  "Verified",
  "Closed"
]);

export const ARW_FINDING_TRANSITIONS = Object.freeze({
  Identified: ["Triaged", "Rejected"],
  Triaged: ["Accepted", "Rejected", "Deferred"],
  Accepted: ["Remediated", "Deferred", "Rejected"],
  Deferred: ["Accepted", "Rejected", "Closed"],
  Rejected: ["Closed"],
  Remediated: ["Verified", "Accepted"],
  Verified: ["Closed"],
  Closed: []
});

export const ARW_SEVERITIES = Object.freeze([
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational"
]);

/** Deliverable flags that must be true before leaving each stage (exit gate). */
export const ARW_STAGE_EXIT_DELIVERABLES = Object.freeze({
  Planned: ["charterApproved"],
  "Review Initiated": ["reviewersAssigned", "scopeLocked"],
  "Evidence Collection": ["evidencePackComplete"],
  Technical: ["technicalReviewComplete"],
  Security: ["securityReviewComplete"],
  "Data Governance": ["dataGovernanceReviewComplete"],
  Integration: ["integrationReviewComplete"],
  "AI Governance": ["aiGovernanceReviewCompleteOrSkipped"],
  "Findings Consolidated": ["findingsRegisterPublished"],
  "Owner Response": ["ownerResponsesRecorded"],
  "Remediation Verification": ["remediationVerifiedOrWaived"],
  "Final Approval Review": ["approvalPacketReady"],
  Approved: ["formalApprovalRecorded"],
  Closed: []
});

export const ARW_ERROR_CODES = Object.freeze({
  "ARW-001": "Unknown or invalid review stage",
  "ARW-002": "Stage transition not sequential (cannot skip)",
  "ARW-003": "Exit criteria not met — required deliverable flags missing",
  "ARW-004": "Review is blocked; clear validation before advancing",
  "ARW-005": "Terminal stage cannot transition",
  "ARW-006": "Unknown finding lifecycle state",
  "ARW-007": "Finding transition not allowed",
  "ARW-008": "Separation of duties violation — approver cannot be sole reviewer",
  "ARW-009": "Missing actor identity",
  "ARW-010": "AI Governance skip requires justification when AI in scope",
  "ARW-011": "Invalid severity",
  "ARW-012": "Audit log is append-only"
});

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function fail(code, detail = "") {
  return {
    ok: false,
    errorCode: code,
    errorMessage: detail ? `${ARW_ERROR_CODES[code] || code}: ${detail}` : (ARW_ERROR_CODES[code] || code)
  };
}

export function createImmutableAuditLog(seed = []) {
  const entries = Array.isArray(seed) ? seed.map((e) => Object.freeze({ ...e })) : [];
  return {
    entries() {
      return entries.slice();
    },
    append(entry) {
      const frozen = Object.freeze({ ...entry });
      entries.push(frozen);
      return frozen;
    },
    /** Rejects in-place mutation attempts on returned snapshot. */
    snapshot() {
      return Object.freeze(entries.map((e) => Object.freeze({ ...e })));
    }
  };
}

export function stageIndex(stage) {
  return ARW_STAGES.indexOf(stage);
}

export function canAdvanceStage(from, to) {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (a < 0 || b < 0) return false;
  if (ARW_TERMINAL_STAGES.includes(from)) return false;
  return b === a + 1;
}

export function canTransitionFinding(from, to) {
  return (ARW_FINDING_TRANSITIONS[from] || []).includes(to);
}

export function missingExitDeliverables(stage, flags = {}) {
  const required = ARW_STAGE_EXIT_DELIVERABLES[stage] || [];
  return required.filter((key) => flags[key] !== true);
}

export function evaluateExitGate(stage, flags = {}) {
  const missing = missingExitDeliverables(stage, flags);
  return {
    ok: missing.length === 0,
    stage,
    missing,
    errorCode: missing.length ? "ARW-003" : null
  };
}

/**
 * SoD: the user who solely conducted the review cannot be the sole formal approver.
 * Allowed when there is at least one other distinct reviewer, or approver differs from all sole-reviewer sets.
 */
export function assertApprovalSeparationOfDuties({
  soleReviewerIds = [],
  reviewerIds = [],
  approverId
} = {}) {
  if (!approverId) return fail("ARW-009", "approverId required");
  const reviewers = (reviewerIds || []).map(String);
  const sole = (soleReviewerIds || []).map(String);
  const approver = String(approverId);

  if (sole.length === 1 && sole[0] === approver && reviewers.every((id) => id === approver)) {
    return fail("ARW-008", `user ${approver}`);
  }
  if (reviewers.length === 1 && reviewers[0] === approver) {
    return fail("ARW-008", `sole reviewer ${approver} cannot solely approve`);
  }
  return { ok: true };
}

export function ensureArchitectureReviewState(state = {}) {
  state.architectureReviews = state.architectureReviews || [];
  state.architectureReviewAudit = state.architectureReviewAudit || createImmutableAuditLog();
  if (Array.isArray(state.architectureReviewAudit)) {
    state.architectureReviewAudit = createImmutableAuditLog(state.architectureReviewAudit);
  }
  return state;
}

function appendAudit(state, entry, now) {
  ensureArchitectureReviewState(state);
  return state.architectureReviewAudit.append({
    ...entry,
    at: entry.at || nowIso(now)
  });
}

export function createArchitectureReview(state, {
  reviewId,
  title = "Enterprise Architecture Review",
  modulesInScope = [],
  aiInScope = false,
  initiatedBy,
  now
} = {}) {
  ensureArchitectureReviewState(state);
  if (!initiatedBy) return fail("ARW-009", "initiatedBy required");
  const id = reviewId || `arw-${Date.now()}`;
  const review = {
    id,
    title,
    stage: "Planned",
    blocked: false,
    blockReason: "",
    aiInScope: aiInScope === true,
    modulesInScope: [...(modulesInScope || [])],
    deliverableFlags: {},
    reviewerIds: [],
    soleReviewerIds: [],
    findings: [],
    approval: null,
    createdBy: String(initiatedBy),
    createdAt: nowIso(now),
    updatedAt: nowIso(now)
  };
  state.architectureReviews.push(review);
  appendAudit(state, {
    type: "review_created",
    reviewId: id,
    actorId: String(initiatedBy),
    stage: "Planned"
  }, now);
  return { ok: true, review };
}

export function getArchitectureReview(state, reviewId) {
  ensureArchitectureReviewState(state);
  return (state.architectureReviews || []).find((r) => r.id === reviewId) || null;
}

export function setDeliverableFlag(state, reviewId, flagKey, value = true, { actorId, now } = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  review.deliverableFlags = review.deliverableFlags || {};
  review.deliverableFlags[flagKey] = value === true;
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "deliverable_flag",
    reviewId,
    actorId: actorId ? String(actorId) : "",
    flagKey,
    value: value === true
  }, now);
  return { ok: true, review };
}

export function setReviewBlocked(state, reviewId, blocked, reason = "", { actorId, now } = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  review.blocked = blocked === true;
  review.blockReason = blocked ? String(reason || "validation_failed") : "";
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: blocked ? "review_blocked" : "review_unblocked",
    reviewId,
    actorId: actorId ? String(actorId) : "",
    reason: review.blockReason
  }, now);
  return { ok: true, review };
}

export function assignReviewers(state, reviewId, reviewerIds = [], { soleReviewerIds = [], actorId, now } = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  review.reviewerIds = [...new Set((reviewerIds || []).map(String))];
  review.soleReviewerIds = [...new Set((soleReviewerIds || []).map(String))];
  if (review.reviewerIds.length) {
    review.deliverableFlags.reviewersAssigned = true;
  }
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "reviewers_assigned",
    reviewId,
    actorId: actorId ? String(actorId) : "",
    reviewerIds: review.reviewerIds.slice()
  }, now);
  return { ok: true, review };
}

/**
 * Advance exactly one stage forward when exit gate passes and review is not blocked.
 */
export function advanceReviewStage(state, reviewId, { actorId, now, skipAiJustification = "" } = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  if (review.blocked) return fail("ARW-004", review.blockReason || "");
  if (ARW_TERMINAL_STAGES.includes(review.stage)) return fail("ARW-005", review.stage);

  const gate = evaluateExitGate(review.stage, review.deliverableFlags || {});
  if (!gate.ok) {
    return fail("ARW-003", gate.missing.join(", "));
  }

  const fromIdx = stageIndex(review.stage);
  const next = ARW_STAGES[fromIdx + 1];
  if (!next) return fail("ARW-005", review.stage);
  if (!canAdvanceStage(review.stage, next)) return fail("ARW-002", `${review.stage} → ${next}`);

  if (review.stage === "Integration" && next === "AI Governance") {
    if (review.aiInScope !== true) {
      review.deliverableFlags.aiGovernanceReviewCompleteOrSkipped = true;
    } else if (
      review.deliverableFlags.aiGovernanceReviewCompleteOrSkipped !== true &&
      !skipAiJustification
    ) {
      /* gate evaluated on exit from AI Governance, not entry */
    }
  }

  if (review.stage === "AI Governance" && review.aiInScope === true) {
    if (review.deliverableFlags.aiGovernanceReviewCompleteOrSkipped !== true && !skipAiJustification) {
      return fail("ARW-010", "complete AI governance or provide skipAiJustification");
    }
    if (skipAiJustification) {
      review.deliverableFlags.aiGovernanceReviewCompleteOrSkipped = true;
      review.aiSkipJustification = String(skipAiJustification);
    }
  }

  const previous = review.stage;
  review.stage = next;
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "stage_advanced",
    reviewId,
    actorId: actorId ? String(actorId) : "",
    from: previous,
    to: next
  }, now);
  return { ok: true, review, from: previous, to: next };
}

export function addFinding(state, reviewId, {
  findingId,
  severity,
  title,
  affectedDocuments = [],
  actorId,
  now
} = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  if (!ARW_SEVERITIES.includes(severity)) return fail("ARW-011", String(severity));
  if (!actorId) return fail("ARW-009", "actorId required");
  const id = findingId || `F-${(review.findings.length + 1).toString().padStart(3, "0")}`;
  const finding = {
    id,
    severity,
    title: title || id,
    status: "Identified",
    affectedDocuments: [...(affectedDocuments || [])],
    createdBy: String(actorId),
    createdAt: nowIso(now),
    updatedAt: nowIso(now)
  };
  review.findings.push(finding);
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "finding_added",
    reviewId,
    findingId: id,
    actorId: String(actorId),
    severity,
    status: "Identified"
  }, now);
  return { ok: true, finding, review };
}

export function transitionFinding(state, reviewId, findingId, toStatus, { actorId, now } = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  const finding = (review.findings || []).find((f) => f.id === findingId);
  if (!finding) return fail("ARW-006", "finding not found");
  if (!ARW_FINDING_STATES.includes(toStatus)) return fail("ARW-006", toStatus);
  if (!canTransitionFinding(finding.status, toStatus)) {
    return fail("ARW-007", `${finding.status} → ${toStatus}`);
  }
  const previous = finding.status;
  finding.status = toStatus;
  finding.updatedAt = nowIso(now);
  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "finding_transition",
    reviewId,
    findingId,
    actorId: actorId ? String(actorId) : "",
    from: previous,
    to: toStatus
  }, now);
  return { ok: true, finding, review };
}

/**
 * Record formal approval with SoD enforcement.
 */
export function approveArchitectureReview(state, reviewId, {
  approverId,
  decision = "Approved",
  now
} = {}) {
  const review = getArchitectureReview(state, reviewId);
  if (!review) return fail("ARW-001", "review not found");
  if (review.stage !== "Final Approval Review" && review.stage !== "Approved") {
    return fail("ARW-002", `approval only from Final Approval Review (current: ${review.stage})`);
  }
  if (review.blocked) return fail("ARW-004", review.blockReason || "");

  const sod = assertApprovalSeparationOfDuties({
    soleReviewerIds: review.soleReviewerIds,
    reviewerIds: review.reviewerIds,
    approverId
  });
  if (!sod.ok) return sod;

  review.deliverableFlags.formalApprovalRecorded = true;
  review.deliverableFlags.approvalPacketReady = true;
  review.approval = {
    decision,
    approverId: String(approverId),
    at: nowIso(now)
  };

  if (review.stage === "Final Approval Review") {
    const gate = evaluateExitGate(review.stage, review.deliverableFlags);
    if (!gate.ok) return fail("ARW-003", gate.missing.join(", "));
    review.stage = "Approved";
  }

  review.updatedAt = nowIso(now);
  appendAudit(state, {
    type: "review_approved",
    reviewId,
    actorId: String(approverId),
    decision,
    stage: review.stage
  }, now);
  return { ok: true, review };
}

export function assertArchitectureReviewBoundary() {
  return {
    postsCollections: false,
    changesMoneyMath: false,
    changesRbacForbidden: false,
    governanceOnly: true,
    restHttp: false,
    graphqlHttp: false
  };
}
