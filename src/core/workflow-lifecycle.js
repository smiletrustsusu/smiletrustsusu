/**
 * Module 23 — workflow, task, case, SLA, and approval state machines.
 * Orchestration only. Does not post collections, interest, or ledgers.
 */

export const WORKFLOW_SCHEMA_LIFECYCLE = "1.0.0";

export const WORKFLOW_STATES = [
  "draft",
  "created",
  "ready",
  "running",
  "waiting",
  "suspended",
  "failed",
  "retrying",
  "completed",
  "cancelled"
];

export const WORKFLOW_TRANSITION_MATRIX = {
  draft: ["created", "cancelled"],
  created: ["ready", "cancelled"],
  ready: ["running", "cancelled"],
  running: ["waiting", "completed", "suspended", "failed", "cancelled"],
  waiting: ["running", "completed", "suspended", "failed", "cancelled"],
  suspended: ["running", "cancelled"],
  failed: ["retrying", "cancelled"],
  retrying: ["running", "completed", "failed", "cancelled"],
  completed: [],
  cancelled: []
};

export const TASK_STATES = [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
  "suspended",
  "escalated",
  "delegated"
];

export const TASK_TRANSITION_MATRIX = {
  pending: ["assigned", "cancelled", "completed"],
  assigned: ["in_progress", "delegated", "escalated", "cancelled", "suspended", "completed"],
  in_progress: ["completed", "cancelled", "suspended", "escalated", "delegated"],
  delegated: ["assigned", "in_progress", "cancelled", "escalated"],
  escalated: ["assigned", "in_progress", "cancelled", "completed"],
  suspended: ["assigned", "in_progress", "cancelled"],
  completed: [],
  cancelled: []
};

export const CASE_STATES = ["open", "assigned", "in_progress", "waiting", "resolved", "closed", "cancelled"];
export const CASE_TRANSITION_MATRIX = {
  open: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "waiting", "resolved", "cancelled"],
  in_progress: ["waiting", "resolved", "cancelled"],
  waiting: ["in_progress", "resolved", "cancelled"],
  resolved: ["closed"],
  closed: [],
  cancelled: []
};

export const DEFINITION_STATUSES = ["draft", "published", "deprecated", "retired"];
export const DEFINITION_TRANSITIONS = {
  draft: ["published", "retired"],
  published: ["deprecated", "retired"],
  deprecated: ["retired", "published"],
  retired: []
};

export const APPROVAL_MODES = [
  "single",
  "dual",
  "multi_level",
  "majority",
  "unanimous",
  "conditional",
  "automatic",
  "automatic_rejection"
];

export const WORKFLOW_TYPES = [
  "sequential",
  "parallel",
  "conditional",
  "event",
  "human",
  "automated"
];

export const CASE_TYPES = [
  "fraud_investigation",
  "customer_complaint",
  "payment_dispute",
  "loan_exception",
  "recovery_case",
  "compliance_review",
  "audit_finding",
  "device_investigation"
];

export const TASK_PRIORITIES = ["critical", "high", "normal", "low"];

export function canTransitionWorkflow(from, to) {
  return (WORKFLOW_TRANSITION_MATRIX[from] || []).includes(to);
}

export function canTransitionTask(from, to) {
  return (TASK_TRANSITION_MATRIX[from] || []).includes(to);
}

export function canTransitionCase(from, to) {
  return (CASE_TRANSITION_MATRIX[from] || []).includes(to);
}

export function canTransitionDefinition(from, to) {
  return (DEFINITION_TRANSITIONS[from] || []).includes(to);
}

export function isTerminalWorkflow(status) {
  return status === "completed" || status === "cancelled";
}

export function compareRule(op, actual, expected) {
  if (op === "Exists") return actual !== undefined && actual !== null && String(actual) !== "";
  if (op === "NotExists") return actual === undefined || actual === null || String(actual) === "";
  if (op === "Equals") return actual === expected;
  if (op === "NotEquals") return actual !== expected;
  if (op === "GreaterThan") return Number(actual) > Number(expected);
  if (op === "LessThan") return Number(actual) < Number(expected);
  if (op === "GreaterThanOrEqual") return Number(actual) >= Number(expected);
  if (op === "LessThanOrEqual") return Number(actual) <= Number(expected);
  if (op === "In") return Array.isArray(expected) && expected.includes(actual);
  return false;
}

export function slaStatus({ dueAt, now, warningRatio = 0.8, startedAt }) {
  const due = Date.parse(dueAt || 0);
  const stamp = typeof now === "number" ? now : Date.parse(now || Date.now());
  if (!Number.isFinite(due)) return "none";
  if (stamp >= due) return "breached";
  const start = Date.parse(startedAt || 0);
  if (Number.isFinite(start) && due > start) {
    const window = due - start;
    if (stamp >= start + window * Number(warningRatio || 0.8)) return "warning";
  }
  return "ok";
}
