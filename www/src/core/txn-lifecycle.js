/**
 * Validation and approval are separate from lifecycle.
 * Live collection/loan/withdrawal screens keep their existing status strings;
 * this engine is the shared matrix for new financial helpers and tests.
 */

export const LIFECYCLE_TRANSITIONS = {
  Draft: ["Submitted", "Cancelled"],
  Submitted: ["Validating", "Cancelled"],
  Validating: ["Validation Failed", "Validation Passed"],
  "Validation Failed": ["Draft", "Cancelled"],
  "Validation Passed": ["Pending Approval", "Approved", "Processing"],
  "Pending Approval": ["Partially Approved", "Approved", "Rejected", "Cancelled"],
  "Partially Approved": ["Approved", "Rejected", "Cancelled"],
  Approved: ["Processing", "Cancelled"],
  Processing: ["Posted", "Failed"],
  Posted: ["Completed"],
  Completed: ["Reversed"],
  Failed: ["Draft", "Cancelled"],
  Rejected: ["Draft"],
  Cancelled: [],
  Reversed: []
};

export const VALIDATION_TRANSITIONS = {
  "Not Started": ["In Progress"],
  "In Progress": ["Passed", "Failed"],
  Passed: [],
  Failed: ["Not Started"]
};

export const APPROVAL_TRANSITIONS = {
  "Not Required": [],
  Pending: ["Partially Approved", "Approved", "Rejected", "Expired", "Cancelled"],
  "Partially Approved": ["Approved", "Rejected", "Expired", "Cancelled"],
  Approved: [],
  Rejected: [],
  Expired: [],
  Cancelled: []
};

export function canTransition(map, from, to) {
  return (map[from] || []).includes(to);
}

export function assertLifecycle(from, to) {
  if (!canTransition(LIFECYCLE_TRANSITIONS, from, to)) {
    return { error: `Invalid lifecycle transition ${from} → ${to}` };
  }
  return { ok: true };
}

export function canEnterApproval(validationStatus) {
  return validationStatus === "Passed";
}

export function canExecute({ validationStatus, approvalStatus, approvalRequired = true } = {}) {
  if (validationStatus !== "Passed") return false;
  if (!approvalRequired) return true;
  return approvalStatus === "Approved" || approvalStatus === "Not Required";
}

export function makerCheckerAllowed(creatorId, approverId, enabled = true) {
  if (!enabled) return true;
  if (!creatorId || !approverId) return false;
  return creatorId !== approverId;
}

export function approvalExpired(requestedAt, timeoutHours = 0, now = Date.now()) {
  if (!timeoutHours || !requestedAt) return false;
  const start = Date.parse(requestedAt);
  if (!Number.isFinite(start)) return false;
  return now - start > Number(timeoutHours) * 3600 * 1000;
}
