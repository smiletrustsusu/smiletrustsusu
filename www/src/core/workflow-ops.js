/**
 * Module 23 — Workflow Engine, Business Process Automation & Case Management.
 * Central orchestration for approvals, tasks, cases, SLAs, and escalations.
 * Does not post collections, interest, or ledgers. No REST/GraphQL HTTP server.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest } from "./idempotency.js";
import { acquireAggregateLock, releaseAggregateLock } from "./identifiers.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric, evaluateAlerts } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import { registerContractHandler, publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled } from "./system-config.js";
import {
  WORKFLOW_STATES,
  WORKFLOW_TRANSITION_MATRIX,
  TASK_STATES,
  CASE_STATES,
  APPROVAL_MODES,
  WORKFLOW_TYPES,
  CASE_TYPES,
  canTransitionWorkflow,
  canTransitionTask,
  canTransitionCase,
  canTransitionDefinition,
  isTerminalWorkflow,
  compareRule,
  slaStatus
} from "./workflow-lifecycle.js";

export {
  WORKFLOW_STATES,
  WORKFLOW_TRANSITION_MATRIX,
  TASK_STATES,
  CASE_STATES,
  APPROVAL_MODES,
  WORKFLOW_TYPES,
  CASE_TYPES,
  canTransitionWorkflow,
  canTransitionTask,
  canTransitionCase,
  canTransitionDefinition,
  isTerminalWorkflow,
  slaStatus
};

export const WORKFLOW_SCHEMA_VERSION = "1.0.0";

const WORKFLOW_ARRAYS = [
  "workflowDefinitions",
  "workflowVersions",
  "workflowInstances",
  "workflowSteps",
  "workflowTransitions",
  "workflowVariables",
  "workflowEvents",
  "workflowTasks",
  "workflowAssignments",
  "workflowEscalations",
  "workflowSlas",
  "businessCases",
  "caseParticipants",
  "caseDocuments",
  "workflowHistory",
  "workflowSimulations",
  "workflowActivityLogs",
  "workflowCallbacks",
  "workflowCallbackDeliveries"
];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function auditWorkflow(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "23",
    ...extras
  }, uid);
}

function history(state, instanceId, action, details, uid, now, extras = {}) {
  state.workflowHistory.push({
    id: newId("wfh", uid),
    instanceId,
    action,
    details,
    userId: extras.userId || "",
    createdAt: nowIso(now),
    immutable: true
  });
}

function notify(state, event, vars, uid, correlationId) {
  const result = queueNotification(state, {
    event,
    channel: "In-App",
    userId: vars.userId || "",
    vars: { name: vars.name || "Team", ...vars },
    uid,
    correlationId,
    committed: true,
    idempotencyKey: `${event}:${correlationId}:${vars.userId || "sys"}`
  });
  return result;
}

function emitWorkflowEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "", aggregateType = "WORKFLOW" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 23,
    payload,
    correlationId,
    aggregateId,
    aggregateType
  }, uid, now);
  deliverWorkflowCallbacks(state, name, payload, uid, now, correlationId);
}

function deliverWorkflowCallbacks(state, eventName, payload, uid, now, correlationId) {
  ensureWorkflowState(state);
  (state.workflowCallbacks || []).forEach((callback) => {
    if (callback.event !== eventName && callback.event !== "*") return;
    state.workflowCallbackDeliveries.push({
      id: newId("wfcd", uid),
      callbackId: callback.id,
      event: eventName,
      endpoint: callback.endpoint || "",
      contractId: callback.contractId || "",
      payload,
      correlationId: correlationId || "",
      channel: "gateway_webhook",
      deliveredAt: nowIso(now)
    });
  });
}

function resolveStartVersion(state, input = {}) {
  if (input.versionId) {
    const version = (state.workflowVersions || []).find((item) => item.id === input.versionId);
    if (!version) return { error: "No published workflow definition is available", errorCode: "WF-001" };
    if (version.status !== "published" && !input.simulate) {
      return { error: "Workflow version unsupported", errorCode: "WF-002" };
    }
    return { version };
  }
  let code = input.code;
  if (!code && input.workflowDefinitionId) {
    const definition = (state.workflowDefinitions || []).find((item) => (
      item.id === input.workflowDefinitionId || item.code === input.workflowDefinitionId
    ));
    if (!definition) return { error: "Workflow definition not found", errorCode: "WF-001" };
    code = definition.code;
    if (input.workflowVersion) {
      const version = (state.workflowVersions || []).find((item) => (
        item.definitionId === definition.id && String(item.version) === String(input.workflowVersion)
      ));
      if (!version) return { error: "Workflow version unsupported", errorCode: "WF-002" };
      if (version.status !== "published" && !input.simulate) {
        return { error: "Workflow version unsupported", errorCode: "WF-002" };
      }
      return { version, definition };
    }
  }
  if (!code) return { error: "No published workflow definition is available", errorCode: "WF-001" };
  const version = publishedVersion(state, code);
  if (!version || (version.status !== "published" && !input.simulate)) {
    return { error: "No published workflow definition is available", errorCode: "WF-001" };
  }
  return { version };
}

function seedDefinitions() {
  const dualHuman = (id, name, role) => ([
    { id: `${id}-submit`, name: "Record request", kind: "automated", handler: "record_audit", next: [`${id}-approve`] },
    { id: `${id}-approve`, name: name, kind: "human", approval: "dual", role, slaMs: 14400000, next: [`${id}-done`] },
    { id: `${id}-done`, name: "Complete", kind: "automated", handler: "notify_complete", next: [] }
  ]);
  return [
    { id: "wfdef-customer-onboarding", code: "customer_onboarding", name: "Customer Onboarding", type: "sequential", ownerModule: 3, slaMs: 172800000, steps: [
      { id: "co-kyc", name: "KYC review", kind: "human", approval: "single", role: "Customer.Edit", slaMs: 86400000, next: ["co-activate"] },
      { id: "co-activate", name: "Activate record", kind: "automated", handler: "record_audit", next: [] }
    ] },
    { id: "wfdef-customer-update", code: "customer_update", name: "Customer Update", type: "sequential", ownerModule: 3, slaMs: 86400000, steps: dualHuman("cu", "Approve update", "Customer.Edit") },
    { id: "wfdef-customer-suspend", code: "customer_suspension", name: "Customer Suspension", type: "human", ownerModule: 3, slaMs: 43200000, steps: dualHuman("cs", "Approve suspension", "Customer.Edit") },
    { id: "wfdef-agent-onboarding", code: "agent_onboarding", name: "Agent Onboarding", type: "sequential", ownerModule: 4, slaMs: 172800000, steps: dualHuman("ao", "Approve agent", "Agent.Edit") },
    { id: "wfdef-branch-approval", code: "branch_approval", name: "Branch Approval", type: "human", ownerModule: 5, slaMs: 86400000, steps: dualHuman("ba", "Approve branch", "Branch.Edit") },
    { id: "wfdef-savings-adjust", code: "savings_adjustment", name: "Savings Adjustment", type: "human", ownerModule: 6, slaMs: 28800000, steps: dualHuman("sa", "Approve adjustment", "Savings.Adjust") },
    { id: "wfdef-savings-reversal", code: "savings_reversal", name: "Savings Reversal", type: "human", ownerModule: 6, slaMs: 28800000, steps: dualHuman("sr", "Approve reversal", "Savings.Reverse") },
    { id: "wfdef-withdrawal", code: "withdrawal_approval", name: "Withdrawal Approval", type: "human", ownerModule: 9, slaMs: 28800000, steps: dualHuman("wa", "Approve withdrawal", "Withdrawal.Approve") },
    { id: "wfdef-loan-apply", code: "loan_application", name: "Loan Application", type: "sequential", ownerModule: 8, slaMs: 259200000, steps: [
      { id: "la-risk", name: "Risk screen", kind: "automated", handler: "evaluate_risk", next: ["la-gate"] },
      { id: "la-gate", name: "Amount gate", kind: "conditional", rules: [
        { when: { field: "amount", op: "GreaterThan", value: 5000 }, next: "la-manager" },
        { default: true, next: "la-officer" }
      ] },
      { id: "la-officer", name: "Officer review", kind: "human", approval: "single", role: "Loan.Approve", slaMs: 86400000, next: ["la-done"] },
      { id: "la-manager", name: "Manager review", kind: "human", approval: "dual", role: "Loan.Approve", slaMs: 172800000, next: ["la-done"] },
      { id: "la-done", name: "Complete", kind: "automated", handler: "notify_complete", next: [] }
    ] },
    { id: "wfdef-loan-approve", code: "loan_approval", name: "Loan Approval", type: "human", ownerModule: 8, slaMs: 172800000, steps: dualHuman("lap", "Approve loan", "Loan.Approve") },
    { id: "wfdef-loan-disburse", code: "loan_disbursement", name: "Loan Disbursement", type: "human", ownerModule: 8, slaMs: 86400000, steps: dualHuman("ld", "Approve disbursement", "Loan.Disburse") },
    { id: "wfdef-loan-restructure", code: "loan_restructuring", name: "Loan Restructuring", type: "human", ownerModule: 8, slaMs: 172800000, steps: dualHuman("lr", "Approve restructure", "Loan.Approve") },
    { id: "wfdef-payment-ex", code: "payment_exception", name: "Payment Exception", type: "conditional", ownerModule: 16, slaMs: 43200000, steps: [
      { id: "pe-gate", name: "Severity gate", kind: "conditional", rules: [
        { when: { field: "severity", op: "Equals", value: "critical" }, next: "pe-human" },
        { default: true, next: "pe-auto" }
      ] },
      { id: "pe-human", name: "Manual review", kind: "human", approval: "single", role: "Payment.Reconcile", slaMs: 14400000, next: [] },
      { id: "pe-auto", name: "Auto close", kind: "automated", handler: "auto_complete", next: [] }
    ] },
    { id: "wfdef-payment-rev", code: "payment_reversal", name: "Payment Reversal", type: "human", ownerModule: 16, slaMs: 28800000, steps: dualHuman("pr", "Approve payment reversal", "Payment.Reverse") },
    { id: "wfdef-fraud", code: "fraud_investigation", name: "Fraud Investigation", type: "human", ownerModule: 22, slaMs: 259200000, caseType: "fraud_investigation", steps: [
      { id: "fi-open", name: "Open case", kind: "automated", handler: "open_case", next: ["fi-review"] },
      { id: "fi-review", name: "Investigate", kind: "human", approval: "single", role: "Security.Investigate", slaMs: 172800000, next: [] }
    ] },
    { id: "wfdef-security", code: "security_incident", name: "Security Incident", type: "human", ownerModule: 22, slaMs: 86400000, caseType: "device_investigation", steps: dualHuman("si", "Contain incident", "Security.Incident") },
    { id: "wfdef-config", code: "configuration_approval", name: "Configuration Approval", type: "human", ownerModule: 14, slaMs: 86400000, steps: dualHuman("cfg", "Approve configuration", "System.ConfigurationApprove") },
    { id: "wfdef-user", code: "user_provisioning", name: "User Provisioning", type: "human", ownerModule: 1, slaMs: 86400000, steps: dualHuman("up", "Approve user", "User.Create") },
    { id: "wfdef-backup", code: "backup_approval", name: "Backup Approval", type: "human", ownerModule: 21, slaMs: 43200000, steps: dualHuman("bk", "Approve backup", "Backup.Create") },
    { id: "wfdef-restore", code: "restore_approval", name: "Restore Approval", type: "human", ownerModule: 21, slaMs: 14400000, steps: dualHuman("rs", "Approve restore", "Backup.Approve") },
    { id: "wfdef-document", code: "document_approval", name: "Document Approval", type: "human", ownerModule: 17, slaMs: 86400000, steps: dualHuman("da", "Approve document", "Document.Approve") },
    { id: "wfdef-report", code: "report_approval", name: "Report Approval", type: "human", ownerModule: 11, slaMs: 86400000, steps: dualHuman("ra", "Approve report", "Reports.Audit") },
    { id: "wfdef-parallel", code: "parallel_review", name: "Parallel Review", type: "parallel", ownerModule: 23, slaMs: 86400000, steps: [
      { id: "pv-a", name: "Operations review", kind: "human", approval: "single", role: "Workflow.Approve", parallelGroup: "reviews", next: ["pv-join"] },
      { id: "pv-b", name: "Finance review", kind: "human", approval: "single", role: "Workflow.Approve", parallelGroup: "reviews", next: ["pv-join"] },
      { id: "pv-join", name: "Join", kind: "parallel_join", joinGroup: "reviews", next: [] }
    ] },
    { id: "wfdef-auto", code: "fully_automated", name: "Fully Automated", type: "automated", ownerModule: 23, slaMs: 600000, steps: [
      { id: "fa-1", name: "Audit", kind: "automated", handler: "record_audit", next: ["fa-2"] },
      { id: "fa-2", name: "Notify", kind: "automated", handler: "notify_complete", next: [] }
    ] },
    { id: "wfdef-custom", code: "custom_organizational", name: "Custom Organizational", type: "sequential", ownerModule: 23, slaMs: 86400000, steps: dualHuman("cx", "Approve custom request", "Workflow.Approve") }
  ].map((item) => ({
    ...item,
    status: "published",
    version: "1.0.0",
    posting: false,
    warningRatio: 0.8
  }));
}

export function ensureWorkflowState(state = {}) {
  WORKFLOW_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  const seeds = seedDefinitions();
  if (!state.workflowDefinitions.length) {
    state.workflowDefinitions = seeds;
  } else {
    seeds.forEach((def) => {
      if (!state.workflowDefinitions.some((item) => item.code === def.code)) state.workflowDefinitions.push(def);
    });
  }
  if (!state.workflowVersions.length) {
    state.workflowVersions = state.workflowDefinitions.map((def) => ({
      id: `${def.id}-v1`,
      definitionId: def.id,
      code: def.code,
      version: def.version,
      status: def.status,
      steps: clone(def.steps),
      slaMs: def.slaMs,
      warningRatio: def.warningRatio,
      createdAt: "2026-09-11T00:00:00.000Z"
    }));
  }
  return state;
}

function publishedVersion(state, code) {
  const versions = (state.workflowVersions || []).filter((item) => item.code === code && item.status === "published");
  return versions[versions.length - 1] || null;
}

function instanceById(state, id) {
  return (state.workflowInstances || []).find((item) => item.id === id) || null;
}

function taskById(state, id) {
  return (state.workflowTasks || []).find((item) => item.id === id) || null;
}

function caseById(state, id) {
  return (state.businessCases || []).find((item) => item.id === id) || null;
}

export function getWorkflowInstance(state, id) {
  return instanceById(state, id);
}

export function getWorkflowTask(state, id) {
  return taskById(state, id);
}

export function getWorkflowCase(state, id) {
  return caseById(state, id);
}

export function getWorkflowVariables(state, instanceId) {
  return variablesOf(state, instanceId);
}

function variablesOf(state, instanceId) {
  const row = (state.workflowVariables || []).find((item) => item.instanceId === instanceId);
  return row?.values || {};
}

function setVariables(state, instanceId, values) {
  let row = (state.workflowVariables || []).find((item) => item.instanceId === instanceId);
  if (!row) {
    row = { instanceId, values: {} };
    state.workflowVariables.push(row);
  }
  row.values = { ...row.values, ...values };
  return row.values;
}

function permitted(user, action) {
  if (!user) return false;
  return canAction(user, action) || isSystemOwner(user);
}

export function transitionWorkflow(state, instance, nextStatus, { uid, now, user, reason = "" } = {}) {
  if (!instance) return { ok: false, error: "Workflow instance not found" };
  const from = instance.status;
  if (from === nextStatus) return { ok: true, instance, noop: true };
  if (!canTransitionWorkflow(from, nextStatus)) {
    const errorCode = from === "completed" ? "WF-009" : "WF-008";
    return { ok: false, error: `Invalid workflow transition: ${from} → ${nextStatus}`, errorCode, http: 409 };
  }
  instance.status = nextStatus;
  instance.revision = Number(instance.revision || 1) + 1;
  instance.updatedAt = nowIso(now);
  if (nextStatus === "running" && !instance.startedAt) instance.startedAt = nowIso(now);
  if (nextStatus === "completed" || nextStatus === "cancelled") instance.completedAt = nowIso(now);
  state.workflowTransitions.push({
    id: newId("wft", uid),
    instanceId: instance.id,
    from,
    to: nextStatus,
    reason,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  history(state, instance.id, `status:${nextStatus}`, reason || `${from} → ${nextStatus}`, uid, now, { userId: user?.id });
  return { ok: true, instance, from, to: nextStatus };
}

function dueAtFrom(startIso, slaMs, now) {
  const start = Date.parse(startIso || nowIso(now));
  return new Date(start + Number(slaMs || 0)).toISOString();
}

function createSla(state, instance, { uid, now }) {
  const row = {
    id: newId("wsla", uid),
    instanceId: instance.id,
    startedAt: instance.createdAt,
    dueAt: dueAtFrom(instance.createdAt, instance.slaMs, now),
    warningRatio: instance.warningRatio || 0.8,
    status: "ok",
    breachedAt: "",
    escalationCount: 0
  };
  state.workflowSlas.push(row);
  instance.slaId = row.id;
  return row;
}

function createTask(state, instance, step, { uid, now, user }) {
  const task = {
    id: newId("wtsk", uid),
    instanceId: instance.id,
    stepId: step.id,
    name: step.name,
    status: "pending",
    priority: step.priority || instance.priority || "normal",
    role: step.role || "Workflow.Approve",
    branchId: instance.branchId || "",
    assigneeId: "",
    dueAt: dueAtFrom(nowIso(now), step.slaMs || instance.slaMs, now),
    approval: step.approval || "single",
    approvals: [],
    requiredApprovals: step.approval === "dual" || step.approval === "unanimous" ? 2 : 1,
    skill: step.skill || "",
    createdAt: nowIso(now)
  };
  if (step.approval === "majority") task.requiredApprovals = Math.floor(Number(step.quorum || 2) / 2) + 1;
  if (step.approval === "unanimous") task.requiredApprovals = Number(step.quorum || 2);
  state.workflowTasks.push(task);
  state.workflowAssignments.push({
    id: newId("wasn", uid),
    taskId: task.id,
    role: task.role,
    userId: "",
    createdAt: nowIso(now)
  });
  const assigned = transitionTask(state, task, "assigned", { uid, now, user, reason: "Routed by workflow engine" });
  notify(state, "workflow_task_assigned", { name: "Approver", userId: user?.id || "" }, uid, instance.correlationId);
  notify(state, "workflow_approval_request", { name: "Approver", userId: user?.id || "" }, uid, instance.correlationId);
  emitWorkflowEvent(state, "WorkflowTaskCreated", { taskId: task.id, instanceId: instance.id }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  emitWorkflowEvent(state, "TaskAssigned", { taskId: task.id, instanceId: instance.id }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  emitWorkflowEvent(state, "WorkflowTaskAssigned", { taskId: task.id, instanceId: instance.id }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  return assigned.task || task;
}

export function transitionTask(state, task, nextStatus, { uid, now, user, reason = "" } = {}) {
  if (!task) return { ok: false, error: "Task not found" };
  const from = task.status;
  if (from === nextStatus) return { ok: true, task, noop: true };
  if (!canTransitionTask(from, nextStatus)) return { ok: false, error: `Invalid task transition: ${from} → ${nextStatus}` };
  task.status = nextStatus;
  task.updatedAt = nowIso(now);
  if (nextStatus === "completed") task.completedAt = nowIso(now);
  if (nextStatus === "in_progress" && !task.startedAt) task.startedAt = nowIso(now);
  history(state, task.instanceId, `task:${nextStatus}`, reason || task.name, uid, now, { userId: user?.id });
  return { ok: true, task, from, to: nextStatus };
}

function runHandler(state, instance, step, ctx) {
  const handler = step.handler || "auto_complete";
  if (handler === "record_audit") {
    auditWorkflow(state, "Workflow automated step", `${instance.code} · ${step.name}`, ctx.user, { entityId: instance.id, correlationId: instance.correlationId }, ctx.uid);
    return { ok: true };
  }
  if (handler === "notify_complete") {
    notify(state, "workflow_completed", { name: ctx.user?.username || "Team", userId: instance.startedBy }, ctx.uid, instance.correlationId);
    return { ok: true };
  }
  if (handler === "evaluate_risk") {
    history(state, instance.id, "rule:risk", "Risk decision orchestrated; Security module owns scoring", ctx.uid, ctx.now, { userId: ctx.user?.id });
    return { ok: true, orchestrated: true };
  }
  if (handler === "open_case") {
    openCase(state, {
      type: instance.caseType || "fraud_investigation",
      title: `${instance.name} case`,
      workflowInstanceId: instance.id,
      customerId: instance.subjectId,
      ownerId: ctx.user?.id || ""
    }, ctx.user, ctx.uid, ctx.now);
    return { ok: true };
  }
  if (handler === "fail_step") return { ok: false, error: "Automated step failed" };
  return { ok: true, orchestrated: true };
}

function stepById(steps, id) {
  return (steps || []).find((item) => item.id === id) || null;
}

function completedStepIds(state, instanceId) {
  return (state.workflowSteps || []).filter((item) => item.instanceId === instanceId && item.status === "completed").map((item) => item.stepId);
}

function markStep(state, instance, step, status, { uid, now }) {
  let row = (state.workflowSteps || []).find((item) => item.instanceId === instance.id && item.stepId === step.id);
  if (!row) {
    row = { id: newId("wstp", uid), instanceId: instance.id, stepId: step.id, name: step.name, status, createdAt: nowIso(now) };
    state.workflowSteps.push(row);
  }
  row.status = status;
  row.updatedAt = nowIso(now);
  return row;
}

function openHumanTasks(state, instanceId) {
  return (state.workflowTasks || []).filter((item) => item.instanceId === instanceId && !["completed", "cancelled"].includes(item.status));
}

function joinSatisfied(state, instance, step) {
  const group = step.joinGroup;
  const members = (instance.steps || []).filter((item) => item.parallelGroup === group);
  const done = completedStepIds(state, instance.id);
  return members.every((item) => done.includes(item.id));
}

function activateStep(state, instance, step, ctx) {
  if (!step) return { ok: false };
  markStep(state, instance, step, "ready", ctx);
  instance.currentStepId = step.id;
  if (step.kind === "conditional") {
    const values = variablesOf(state, instance.id);
    const match = (step.rules || []).find((rule) => rule.default) || (step.rules || []).find((rule) => compareRule(rule.when?.op, values[rule.when?.field], rule.when?.value));
    const chosen = (step.rules || []).find((rule) => rule.when && compareRule(rule.when.op, values[rule.when.field], rule.when.value)) || match;
    const nextId = chosen?.next;
    markStep(state, instance, step, "completed", ctx);
    return activateNext(state, instance, nextId ? [nextId] : [], ctx);
  }
  if (step.kind === "parallel_join") {
    if (!joinSatisfied(state, instance, step)) {
      return transitionWorkflow(state, instance, "waiting", { ...ctx, reason: "Waiting for parallel reviews" });
    }
    markStep(state, instance, step, "completed", ctx);
    return activateNext(state, instance, step.next || [], ctx);
  }
  if (step.kind === "human") {
    const existingTask = (state.workflowTasks || []).find((item) => item.instanceId === instance.id && item.stepId === step.id && !["completed", "cancelled"].includes(item.status));
    if (existingTask) {
      if (existingTask.status === "suspended") {
        transitionTask(state, existingTask, "assigned", { ...ctx, reason: "Resumed with workflow" });
      }
      return transitionWorkflow(state, instance, "waiting", { ...ctx, reason: `Waiting on ${step.name}` });
    }
    if (step.approval === "automatic") {
      markStep(state, instance, step, "completed", ctx);
      return activateNext(state, instance, step.next || [], ctx);
    }
    if (step.approval === "automatic_rejection") {
      markStep(state, instance, step, "cancelled", ctx);
      return failWorkflow(state, instance, "Automatic rejection", ctx);
    }
    createTask(state, instance, step, ctx);
    return transitionWorkflow(state, instance, "waiting", { ...ctx, reason: `Waiting on ${step.name}` });
  }
  const result = runHandler(state, instance, step, ctx);
  if (!result || result.ok === false) {
    markStep(state, instance, step, "failed", ctx);
    return failWorkflow(state, instance, result?.error || "Automated step failed", ctx);
  }
  markStep(state, instance, step, "completed", ctx);
  return activateNext(state, instance, step.next || [], ctx);
}

function activateNext(state, instance, nextIds, ctx) {
  const ids = (nextIds || []).filter(Boolean);
  if (!ids.length) {
    if (!openHumanTasks(state, instance.id).length) {
      return completeWorkflow(state, instance, ctx);
    }
    return { ok: true, instance };
  }
  const parallel = ids.map((id) => stepById(instance.steps, id)).filter(Boolean);
  if (parallel.length > 1 || parallel.some((item) => item.parallelGroup)) {
    if (instance.status !== "running" && instance.status !== "retrying") {
      const resume = transitionWorkflow(state, instance, instance.status === "waiting" ? "running" : instance.status, ctx);
      if (!resume.ok && instance.status !== "running") {
        /* stay on current documented state */
      }
    }
    if (instance.status === "waiting") transitionWorkflow(state, instance, "running", { ...ctx, reason: "Resume parallel" });
    parallel.forEach((step) => activateStep(state, instance, step, ctx));
    if (openHumanTasks(state, instance.id).length && instance.status === "running") {
      transitionWorkflow(state, instance, "waiting", { ...ctx, reason: "Parallel human tasks" });
    }
    return { ok: true, instance };
  }
  return activateStep(state, instance, stepById(instance.steps, ids[0]), ctx);
}

function completeWorkflow(state, instance, ctx) {
  const moved = instance.status === "running" || instance.status === "waiting" || instance.status === "retrying"
    ? transitionWorkflow(state, instance, "completed", { ...ctx, reason: "All steps completed" })
    : { ok: true, instance };
  emitWorkflowEvent(state, "WorkflowCompleted", { instanceId: instance.id, code: instance.code }, {
    uid: ctx.uid, now: ctx.now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  notify(state, "workflow_completed", { name: "Team", userId: instance.startedBy }, ctx.uid, instance.correlationId);
  return moved;
}

function failWorkflow(state, instance, reason, ctx) {
  if (instance.status === "running" || instance.status === "waiting" || instance.status === "retrying") {
    transitionWorkflow(state, instance, "failed", { ...ctx, reason });
  }
  instance.lastError = reason;
  emitWorkflowEvent(state, "WorkflowFailed", { instanceId: instance.id, reason }, {
    uid: ctx.uid, now: ctx.now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  notify(state, "workflow_failed", { name: "Team", userId: instance.startedBy }, ctx.uid, instance.correlationId);
  return { ok: false, error: reason, instance };
}

function entrySteps(steps = []) {
  const targeted = new Set();
  steps.forEach((step) => (step.next || []).forEach((id) => targeted.add(id)));
  (steps || []).forEach((step) => {
    (step.rules || []).forEach((rule) => {
      if (rule.next) targeted.add(rule.next);
    });
  });
  const roots = steps.filter((step) => !targeted.has(step.id));
  return roots.length ? roots : steps.slice(0, 1);
}

function pump(state, instance, ctx) {
  let guard = 0;
  while (guard < 40 && ["running", "ready", "retrying"].includes(instance.status)) {
    guard += 1;
    const current = stepById(instance.steps, instance.currentStepId) || entrySteps(instance.steps)[0];
    if (!current) {
      completeWorkflow(state, instance, ctx);
      break;
    }
    const before = instance.revision;
    const result = activateStep(state, instance, current, ctx);
    if (instance.status === "waiting" || isTerminalWorkflow(instance.status) || instance.status === "failed") break;
    if (result && result.ok === false) break;
    if (instance.revision === before && instance.currentStepId === current.id) break;
  }
  return instance;
}

export function startWorkflow(state, input = {}, user, uid, now) {
  ensureWorkflowState(state);
  if (isFeatureEnabled(state, "enableWorkflowEngine") === false) {
    return { ok: false, error: "Workflow engine is disabled" };
  }
  if (user && !permitted(user, "Workflow.Start") && !permitted(user, "Workflow.Approve")) {
    return { ok: false, error: "You cannot start workflows", errorCode: "WF-005", http: 403 };
  }
  const resolved = resolveStartVersion(state, input);
  if (resolved.error) {
    return { ok: false, error: resolved.error, errorCode: resolved.errorCode || "WF-001", http: 404 };
  }
  const version = resolved.version;
  const definition = resolved.definition || (state.workflowDefinitions || []).find((item) => item.code === version.code);
  if (definition?.posting) return { ok: false, error: "Workflow definitions must not post financial transactions" };

  if (input.simulate) {
    const simulation = {
      id: newId("wsim", uid),
      code: version.code,
      version: version.version,
      path: (version.steps || []).map((item) => item.id),
      createdAt: nowIso(now)
    };
    state.workflowSimulations.push(simulation);
    auditWorkflow(state, "Workflow simulated", version.code, user, { entityId: simulation.id }, uid);
    return { ok: true, simulation, simulated: true };
  }

  const subjectId = input.subjectId || input.businessEntityId || "";
  const subjectType = input.subjectType || input.businessEntityType || "";
  const businessKey = input.businessKey || `${version.code}:${subjectId || "none"}`;
  const idempotencyKey = input.idempotencyKey || `wf:${businessKey}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey,
    operationType: "workflow.start",
    fingerprint: { operationType: "workflow.start", businessKey },
    source: "workflow-engine",
    userId: user?.id || "",
    now: nowMs(now)
  }, uid);
  if (gate.duplicate) {
    const existing = (state.workflowInstances || []).find((item) => item.businessKey === businessKey && !isTerminalWorkflow(item.status));
    return { ok: true, duplicate: true, instance: existing };
  }
  if (!gate.proceed) return { ok: false, error: gate.error || "Workflow is already running", errorCode: "WF-007", http: 409 };

  const instance = {
    id: newId("wfin", uid),
    definitionId: version.definitionId,
    versionId: version.id,
    code: version.code,
    name: definition?.name || version.code,
    type: definition?.type || "sequential",
    status: "draft",
    revision: 1,
    steps: clone(version.steps || []),
    slaMs: version.slaMs,
    warningRatio: version.warningRatio || 0.8,
    subjectId,
    subjectType,
    branchId: input.branchId || user?.branchId || "",
    caseType: definition?.caseType || "",
    correlationId: input.correlationId || newId("wfcorr", uid),
    businessKey,
    idempotencyKey,
    startedBy: user?.id || input.initiatedBy || "",
    currentStepId: "",
    lastError: "",
    retryAttempt: 0,
    priority: input.priority || "normal",
    createdAt: nowIso(now),
    updatedAt: nowIso(now)
  };
  state.workflowInstances.push(instance);
  setVariables(state, instance.id, {
    amount: Number(input.amount || 0),
    severity: input.severity || "",
    ...(input.variables || {}),
    ...(input.initialVariables || {})
  });
  createSla(state, instance, { uid, now });
  const ctx = { uid, now, user };
  transitionWorkflow(state, instance, "created", { ...ctx, reason: "Instance created" });
  transitionWorkflow(state, instance, "ready", { ...ctx, reason: "Ready to run" });
  transitionWorkflow(state, instance, "running", { ...ctx, reason: input.trigger || "manual" });
  const roots = entrySteps(instance.steps);
  if (roots.length > 1 || roots.some((item) => item.parallelGroup)) {
    roots.forEach((step) => activateStep(state, instance, step, ctx));
    if (openHumanTasks(state, instance.id).length && instance.status === "running") {
      transitionWorkflow(state, instance, "waiting", { ...ctx, reason: "Waiting on parallel tasks" });
    }
  } else if (roots[0]) {
    instance.currentStepId = roots[0].id;
    pump(state, instance, ctx);
  }
  auditWorkflow(state, "Workflow started", instance.code, user, { entityId: instance.id, correlationId: instance.correlationId }, uid);
  emitWorkflowEvent(state, "WorkflowStarted", { instanceId: instance.id, code: instance.code }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  state.workflowEvents.push({ id: newId("wfev", uid), instanceId: instance.id, type: "started", createdAt: nowIso(now) });
  completeIdempotentRequest(state, idempotencyKey, { transactionId: instance.id, responsePayload: { instanceId: instance.id } }, { source: "workflow-engine", now, userId: user?.id });
  return { ok: true, instance };
}

export function simulateWorkflow(state, input = {}, user, uid, now) {
  return startWorkflow(state, { ...input, simulate: true }, user, uid, now);
}

function lockInstance(state, instance, holder, now) {
  return acquireAggregateLock(state, "WORKFLOW", instance.id, holder, { ttlMs: 15000, now: nowMs(now) });
}

export function completeTask(state, taskId, input = {}, user, uid, now) {
  ensureWorkflowState(state);
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found", errorCode: "WF-004", http: 404 };
  const instance = instanceById(state, task.instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  if (instance.status === "completed") {
    return { ok: false, error: "Workflow already completed", errorCode: "WF-009", http: 409 };
  }
  if (input.revision != null && Number(input.revision) !== Number(instance.revision)) {
    return { ok: false, error: "Workflow instance was updated by another operator", conflict: true, errorCode: "WF-010", http: 409 };
  }
  const canComplete = isSystemOwner(user)
    || permitted(user, "Workflow.Approve")
    || permitted(user, task.role)
    || (permitted(user, "Workflow.Task") && task.assigneeId === user?.id);
  if (user && !canComplete) {
    return { ok: false, error: "You cannot complete this task", errorCode: "WF-005", http: 403 };
  }
  if (task.branchId && user?.branchId && task.branchId !== user.branchId && !isSystemOwner(user)) {
    return { ok: false, error: "This task is restricted to another branch" };
  }
  const lock = lockInstance(state, instance, user?.id || "wf-engine", now);
  if (lock.error) return { ok: false, error: lock.error };
  try {
    if (["assigned", "delegated", "escalated"].includes(task.status)) {
      const started = transitionTask(state, task, "in_progress", { uid, now, user, reason: "Started by assignee" });
      if (!started.ok && task.status !== "in_progress") return started;
    }
    const decision = input.decision || "approve";
    if (decision === "reject") {
      transitionTask(state, task, "cancelled", { uid, now, user, reason: input.reason || "Rejected" });
      openHumanTasks(state, instance.id).forEach((item) => {
        if (item.id !== task.id) transitionTask(state, item, "cancelled", { uid, now, user, reason: "Rejected with sibling task" });
      });
      const failed = failWorkflow(state, instance, input.reason || "Approval rejected", { uid, now, user });
      emitWorkflowEvent(state, "WorkflowTaskCompleted", { taskId: task.id, instanceId: instance.id, outcome: "Rejected" }, {
        uid, now, correlationId: instance.correlationId, aggregateId: instance.id
      });
      emitWorkflowEvent(state, "WorkflowRejected", { taskId: task.id, instanceId: instance.id, reason: input.reason || "Rejected" }, {
        uid, now, correlationId: instance.correlationId, aggregateId: instance.id
      });
      return failed;
    }
    if (task.approval === "dual" || task.approval === "majority" || task.approval === "unanimous") {
      if (task.approvals.some((item) => item.userId === user?.id)) {
        return { ok: false, error: "You have already recorded an approval on this task" };
      }
      if (task.approval === "dual" && instance.startedBy && user?.id === instance.startedBy && !isSystemOwner(user)) {
        return { ok: false, error: "Maker-checker: the requester cannot approve this workflow" };
      }
      task.approvals.push({ userId: user?.id || "", at: nowIso(now), decision: "approve" });
      if (task.approvals.length < Number(task.requiredApprovals || 2)) {
        history(state, instance.id, "approval:partial", `${task.approvals.length}/${task.requiredApprovals}`, uid, now, { userId: user?.id });
        return { ok: true, task, pending: true, instance };
      }
    }
    const done = transitionTask(state, task, "completed", { uid, now, user, reason: input.reason || "Approved" });
    if (!done.ok) return done;
    markStep(state, instance, { id: task.stepId, name: task.name }, "completed", { uid, now });
    const step = stepById(instance.steps, task.stepId);
    if (instance.status === "waiting") transitionWorkflow(state, instance, "running", { uid, now, user, reason: "Task completed" });
    const next = activateNext(state, instance, step?.next || [], { uid, now, user });
    if (instance.status === "running") pump(state, instance, { uid, now, user });
    auditWorkflow(state, "Workflow task completed", task.name, user, { entityId: task.id, correlationId: instance.correlationId }, uid);
    const completedInstance = next.instance || instance;
    emitWorkflowEvent(state, "WorkflowTaskCompleted", { taskId: task.id, instanceId: instance.id, outcome: input.outcome || "Approved" }, {
      uid, now, correlationId: instance.correlationId, aggregateId: instance.id
    });
    if ((input.decision || "approve") !== "reject") {
      emitWorkflowEvent(state, "WorkflowApproved", { taskId: task.id, instanceId: instance.id }, {
        uid, now, correlationId: instance.correlationId, aggregateId: instance.id
      });
    }
    return { ok: true, task, instance: completedInstance };
  } finally {
    releaseAggregateLock(state, "WORKFLOW", instance.id, user?.id || "wf-engine");
  }
}

export function assignTask(state, taskId, assigneeId, user, uid, now) {
  ensureWorkflowState(state);
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found", errorCode: "WF-004", http: 404 };
  if (user && !permitted(user, "Workflow.Task") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot assign tasks", errorCode: "WF-005", http: 403 };
  }
  task.assigneeId = assigneeId;
  const assignment = { id: newId("wasn", uid), taskId, userId: assigneeId, createdAt: nowIso(now) };
  state.workflowAssignments.push(assignment);
  if (task.status === "pending") transitionTask(state, task, "assigned", { uid, now, user, reason: "Assigned" });
  const instance = instanceById(state, task.instanceId);
  emitWorkflowEvent(state, "WorkflowTaskAssigned", { taskId: task.id, assignmentId: assignment.id, assigneeId }, {
    uid, now, correlationId: instance?.correlationId || "", aggregateId: task.instanceId
  });
  return { ok: true, task, assignment, assignmentId: assignment.id };
}

export function reassignTask(state, taskId, assigneeId, user, uid, now) {
  return assignTask(state, taskId, assigneeId, user, uid, now);
}

export function delegateTask(state, taskId, assigneeId, user, uid, now) {
  ensureWorkflowState(state);
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found", errorCode: "WF-004", http: 404 };
  if (user && !permitted(user, "Workflow.Task") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot delegate tasks", errorCode: "WF-005", http: 403 };
  }
  const moved = transitionTask(state, task, "delegated", { uid, now, user, reason: "Delegated" });
  if (!moved.ok) return { ...moved, errorCode: moved.errorCode || "WF-008", http: 409 };
  task.delegatedFrom = task.assigneeId || user?.id || "";
  task.assigneeId = assigneeId;
  const delegation = {
    id: newId("wdel", uid),
    taskId,
    userId: assigneeId,
    delegatedFrom: task.delegatedFrom,
    createdAt: nowIso(now)
  };
  state.workflowAssignments.push(delegation);
  transitionTask(state, task, "assigned", { uid, now, user, reason: "Delegation accepted" });
  const instance = instanceById(state, task.instanceId);
  emitWorkflowEvent(state, "WorkflowTaskDelegated", { taskId: task.id, delegationId: delegation.id, assigneeId }, {
    uid, now, correlationId: instance?.correlationId || "", aggregateId: task.instanceId
  });
  return { ok: true, task, delegation, delegationId: delegation.id };
}

export function escalateTask(state, taskId, user, uid, now, { reason = "SLA escalation" } = {}) {
  ensureWorkflowState(state);
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found" };
  const instance = instanceById(state, task.instanceId);
  const moved = transitionTask(state, task, "escalated", { uid, now, user, reason });
  if (!moved.ok && task.status !== "escalated") return moved;
  task.escalationCount = Number(task.escalationCount || 0) + 1;
  state.workflowEscalations.push({
    id: newId("wesc", uid),
    taskId: task.id,
    instanceId: task.instanceId,
    reason,
    level: task.escalationCount,
    createdAt: nowIso(now)
  });
  const sla = (state.workflowSlas || []).find((item) => item.instanceId === task.instanceId);
  if (sla) sla.escalationCount = Number(sla.escalationCount || 0) + 1;
  evaluateAlerts(state, { workflowSlaBreaches: 1, workflowEscalations: 1 }, { uid, now, user, eventDriven: true });
  recordMetric(state, { domain: "workflow", name: "escalations", value: 1 }, uid, now);
  notify(state, "workflow_escalation", { name: "Supervisor", userId: user?.id || "" }, uid, instance?.correlationId || task.id);
  emitWorkflowEvent(state, "TaskEscalated", { taskId: task.id, instanceId: task.instanceId }, {
    uid, now, correlationId: instance?.correlationId || "", aggregateId: task.instanceId
  });
  emitWorkflowEvent(state, "WorkflowEscalated", { taskId: task.id, instanceId: task.instanceId }, {
    uid, now, correlationId: instance?.correlationId || "", aggregateId: task.instanceId
  });
  auditWorkflow(state, "Workflow task escalated", task.name, user, { entityId: task.id }, uid);
  return { ok: true, task };
}

export function cancelTask(state, taskId, user, uid, now, reason = "Cancelled") {
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found" };
  return transitionTask(state, task, "cancelled", { uid, now, user, reason });
}

export function suspendTask(state, taskId, user, uid, now) {
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found" };
  return transitionTask(state, task, "suspended", { uid, now, user, reason: "Suspended" });
}

export function resumeTask(state, taskId, user, uid, now) {
  const task = taskById(state, taskId);
  if (!task) return { ok: false, error: "Task not found" };
  return transitionTask(state, task, "in_progress", { uid, now, user, reason: "Resumed" });
}

export function suspendWorkflow(state, instanceId, user, uid, now, reason = "Suspended") {
  const instance = instanceById(state, instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  if (user && !permitted(user, "Workflow.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot suspend workflows", errorCode: "WF-005", http: 403 };
  }
  const previousState = instance.status;
  const moved = transitionWorkflow(state, instance, "suspended", { uid, now, user, reason });
  if (!moved.ok) return moved;
  instance.suspendedAt = nowIso(now);
  instance.suspendedBy = user?.id || "";
  openHumanTasks(state, instanceId).forEach((task) => {
    if (task.status === "assigned" || task.status === "in_progress") {
      transitionTask(state, task, "suspended", { uid, now, user, reason: "Workflow suspended" });
    }
  });
  emitWorkflowEvent(state, "WorkflowSuspended", { instanceId: instance.id, reason }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  return { ...moved, previousState };
}

export function resumeWorkflow(state, instanceId, user, uid, now, reason = "Resumed") {
  const instance = instanceById(state, instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const previousState = instance.status;
  const moved = transitionWorkflow(state, instance, "running", { uid, now, user, reason });
  if (!moved.ok) return moved;
  instance.resumedAt = nowIso(now);
  instance.resumedBy = user?.id || "";
  pump(state, instance, { uid, now, user });
  emitWorkflowEvent(state, "WorkflowResumed", { instanceId: instance.id, reason }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  return { ok: true, instance, previousState };
}

export function cancelWorkflow(state, instanceId, user, uid, now, reason = "Cancelled") {
  ensureWorkflowState(state);
  const instance = instanceById(state, instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  if (user && !permitted(user, "Workflow.Admin") && !permitted(user, "Workflow.Start") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot cancel workflows", errorCode: "WF-005", http: 403 };
  }
  if (isTerminalWorkflow(instance.status)) {
    return {
      ok: false,
      error: instance.status === "completed" ? "Workflow already completed" : "Invalid workflow state",
      errorCode: instance.status === "completed" ? "WF-009" : "WF-008",
      http: 409
    };
  }
  const previousState = instance.status;
  openHumanTasks(state, instanceId).forEach((task) => transitionTask(state, task, "cancelled", { uid, now, user, reason }));
  const moved = transitionWorkflow(state, instance, "cancelled", { uid, now, user, reason });
  if (moved.ok) {
    instance.cancelledAt = nowIso(now);
    instance.cancelledBy = user?.id || "";
    emitWorkflowEvent(state, "WorkflowCancelled", { instanceId: instance.id, reason }, {
      uid, now, correlationId: instance.correlationId, aggregateId: instance.id
    });
  }
  return { ...moved, previousState };
}

export function retryWorkflow(state, instanceId, user, uid, now, reason = "Retry") {
  const instance = instanceById(state, instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const previousState = instance.status;
  const retrying = transitionWorkflow(state, instance, "retrying", { uid, now, user, reason });
  if (!retrying.ok) return retrying;
  instance.retryAttempt = Number(instance.retryAttempt || 0) + 1;
  const running = transitionWorkflow(state, instance, "running", { uid, now, user, reason: "Retry running" });
  if (!running.ok) return running;
  const failed = (state.workflowSteps || []).find((item) => item.instanceId === instance.id && item.status === "failed");
  if (failed) {
    failed.status = "ready";
    instance.currentStepId = failed.stepId;
  }
  pump(state, instance, { uid, now, user });
  emitWorkflowEvent(state, "WorkflowRetried", { instanceId: instance.id, retryAttempt: instance.retryAttempt, reason }, {
    uid, now, correlationId: instance.correlationId, aggregateId: instance.id
  });
  return { ok: true, instance, previousState, retryAttempt: instance.retryAttempt };
}

export function compensateWorkflow(state, instanceId, user, uid, now) {
  ensureWorkflowState(state);
  const instance = instanceById(state, instanceId);
  if (!instance) return { ok: false, error: "Workflow instance not found" };
  openHumanTasks(state, instanceId).forEach((task) => transitionTask(state, task, "cancelled", { uid, now, user, reason: "Compensation" }));
  instance.compensated = true;
  history(state, instance.id, "compensation", "Open tasks cancelled; no financial posting was reversed", uid, now, { userId: user?.id });
  if (!isTerminalWorkflow(instance.status)) {
    if (instance.status === "failed") {
      /* cancel from failed is not in matrix; leave failed and flag compensation */
    } else {
      const moved = transitionWorkflow(state, instance, "cancelled", { uid, now, user, reason: "Compensation" });
      if (!moved.ok && instance.status === "waiting") {
        transitionWorkflow(state, instance, "running", { uid, now, user, reason: "Compensation resume" });
        transitionWorkflow(state, instance, "cancelled", { uid, now, user, reason: "Compensation" });
      }
    }
  }
  auditWorkflow(state, "Workflow compensated", instance.code, user, { entityId: instance.id }, uid);
  return { ok: true, instance, postsCollections: false };
}

export function tickWorkflows(state, { uid, now, user } = {}) {
  ensureWorkflowState(state);
  const stamp = nowMs(now);
  let slaWarnings = 0;
  let slaBreaches = 0;
  let escalated = 0;
  (state.workflowSlas || []).forEach((sla) => {
    const instance = instanceById(state, sla.instanceId);
    if (!instance || isTerminalWorkflow(instance.status)) return;
    const status = slaStatus({ dueAt: sla.dueAt, now: stamp, warningRatio: sla.warningRatio, startedAt: sla.startedAt });
    if (status === "warning" && sla.status !== "warning" && sla.status !== "breached") {
      sla.status = "warning";
      slaWarnings += 1;
      notify(state, "workflow_sla_warning", { name: "Team", userId: instance.startedBy }, uid, instance.correlationId);
    }
    if (status === "breached" && sla.status !== "breached") {
      sla.status = "breached";
      sla.breachedAt = nowIso(now);
      slaBreaches += 1;
      notify(state, "workflow_sla_breach", { name: "Team", userId: instance.startedBy }, uid, instance.correlationId);
      emitWorkflowEvent(state, "WorkflowSLABreached", { instanceId: instance.id, slaId: sla.id }, {
        uid, now, correlationId: instance.correlationId, aggregateId: instance.id
      });
    }
  });
  (state.workflowTasks || []).forEach((task) => {
    if (["completed", "cancelled"].includes(task.status)) return;
    if (task.dueAt && Date.parse(task.dueAt) <= stamp) {
      const result = escalateTask(state, task.id, user, uid, now, { reason: "Time-based SLA escalation" });
      if (result.ok) escalated += 1;
    }
  });
  if (slaBreaches || escalated) {
    evaluateAlerts(state, { workflowSlaBreaches: slaBreaches, workflowEscalations: escalated }, { uid, now, user, eventDriven: true });
  }
  recordMetric(state, { domain: "workflow", name: "activeInstances", value: (state.workflowInstances || []).filter((item) => !isTerminalWorkflow(item.status)).length }, uid, now);
  return { ok: true, slaWarnings, slaBreaches, escalated };
}

export function publishWorkflowDefinition(state, definitionId, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Design") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot publish workflow definitions" };
  }
  const definition = (state.workflowDefinitions || []).find((item) => item.id === definitionId || item.code === definitionId);
  if (!definition) return { ok: false, error: "Definition not found" };
  const from = definition.status || "draft";
  if (from !== "published" && !canTransitionDefinition(from, "published")) {
    return { ok: false, error: `Invalid definition transition: ${from} → published` };
  }
  (state.workflowVersions || []).filter((item) => item.code === definition.code && item.status === "published").forEach((item) => {
    item.status = "deprecated";
  });
  definition.status = "published";
  const version = {
    id: newId("wver", uid),
    definitionId: definition.id,
    code: definition.code,
    version: definition.version || "1.0.0",
    status: "published",
    steps: clone(definition.steps || []),
    slaMs: definition.slaMs,
    warningRatio: definition.warningRatio,
    createdAt: nowIso(now)
  };
  state.workflowVersions.push(version);
  auditWorkflow(state, "Workflow definition published", definition.code, user, { entityId: version.id }, uid);
  return { ok: true, version, definition };
}

export function openCase(state, input = {}, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Case") && !permitted(user, "Security.Incident") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot open cases" };
  }
  const year = nowIso(now).slice(0, 4);
  const caseNumber = input.caseNumber || `CASE-${year}-${String((state.businessCases || []).length + 1).padStart(6, "0")}`;
  const row = {
    id: newId("wcse", uid),
    caseNumber,
    type: CASE_TYPES.includes(input.type) ? input.type : "compliance_review",
    title: input.title || "Untitled case",
    status: "open",
    priority: input.priority || "medium",
    ownerId: input.ownerId || user?.id || "",
    workflowInstanceId: input.workflowInstanceId || "",
    customerId: input.customerId || "",
    alertId: input.alertId || "",
    createdAt: nowIso(now),
    timeline: [{ at: nowIso(now), action: "opened", userId: user?.id || "" }]
  };
  state.businessCases.push(row);
  if (row.ownerId) {
    state.caseParticipants.push({ id: newId("wcsp", uid), caseId: row.id, userId: row.ownerId, role: "owner", createdAt: nowIso(now) });
    canTransitionCase("open", "assigned") && (row.status = "assigned");
  }
  emitWorkflowEvent(state, "CaseOpened", { caseId: row.id, type: row.type }, {
    uid, now, correlationId: input.correlationId || row.id, aggregateId: row.id, aggregateType: "CASE"
  });
  emitWorkflowEvent(state, "WorkflowCaseOpened", { caseId: row.id, type: row.type }, {
    uid, now, correlationId: input.correlationId || row.id, aggregateId: row.id, aggregateType: "CASE"
  });
  notify(state, "workflow_case_updated", { name: "Team", userId: row.ownerId }, uid, row.id);
  auditWorkflow(state, "Business case opened", row.title, user, { entityId: row.id, category: "security" }, uid);
  return { ok: true, case: row };
}

export function addCaseParticipant(state, caseId, participant = {}, user, uid, now) {
  const row = caseById(state, caseId);
  if (!row) return { ok: false, error: "Case not found" };
  state.caseParticipants.push({
    id: newId("wcsp", uid),
    caseId,
    userId: participant.userId,
    role: participant.role || "participant",
    createdAt: nowIso(now)
  });
  row.timeline = [...(row.timeline || []), { at: nowIso(now), action: "participant", userId: user?.id || "" }];
  return { ok: true, case: row };
}

export function attachCaseDocument(state, caseId, document = {}, user, uid, now) {
  const row = caseById(state, caseId);
  if (!row) return { ok: false, error: "Case not found" };
  state.caseDocuments.push({
    id: newId("wcsd", uid),
    caseId,
    documentId: document.documentId || "",
    name: document.name || "attachment",
    createdAt: nowIso(now),
    userId: user?.id || ""
  });
  row.timeline = [...(row.timeline || []), { at: nowIso(now), action: "document", userId: user?.id || "" }];
  return { ok: true, case: row };
}

export function transitionCase(state, caseId, nextStatus, user, uid, now) {
  const row = caseById(state, caseId);
  if (!row) return { ok: false, error: "Case not found" };
  if (!canTransitionCase(row.status, nextStatus)) return { ok: false, error: `Invalid case transition: ${row.status} → ${nextStatus}` };
  row.status = nextStatus;
  row.timeline = [...(row.timeline || []), { at: nowIso(now), action: nextStatus, userId: user?.id || "" }];
  notify(state, "workflow_case_updated", { name: "Team", userId: row.ownerId }, uid, row.id);
  return { ok: true, case: row };
}

export function taskInbox(state, user) {
  ensureWorkflowState(state);
  const tasks = state.workflowTasks || [];
  if (!user) return [];
  if (isSystemOwner(user) || permitted(user, "Workflow.Admin")) return tasks.filter((item) => !["completed", "cancelled"].includes(item.status));
  return tasks.filter((item) => {
    if (["completed", "cancelled"].includes(item.status)) return false;
    if (item.assigneeId && item.assigneeId === user.id) return true;
    return permitted(user, item.role) || permitted(user, "Workflow.Task") || permitted(user, "Workflow.Approve");
  });
}

export function workflowDashboard(state) {
  ensureWorkflowState(state);
  const instances = state.workflowInstances || [];
  const tasks = state.workflowTasks || [];
  const cases = state.businessCases || [];
  const slas = state.workflowSlas || [];
  return {
    active: instances.filter((item) => !isTerminalWorkflow(item.status)).length,
    completed: instances.filter((item) => item.status === "completed").length,
    failed: instances.filter((item) => item.status === "failed").length,
    waiting: instances.filter((item) => item.status === "waiting").length,
    openTasks: tasks.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
    openCases: cases.filter((item) => !["closed", "cancelled"].includes(item.status)).length,
    slaBreaches: slas.filter((item) => item.status === "breached").length,
    escalations: (state.workflowEscalations || []).length
  };
}

export function workflowReports(state, reportId, range = {}) {
  ensureWorkflowState(state);
  const from = String(range.from || "0000-01-01");
  const to = String(range.to || "9999-12-31");
  const inRange = (row) => String(row.createdAt || "").slice(0, 10) >= from && String(row.createdAt || "").slice(0, 10) <= to;
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "workflow_active") return table(["createdAt", "code", "status", "startedBy"], (state.workflowInstances || []).filter((item) => !isTerminalWorkflow(item.status)));
  if (reportId === "workflow_completed") return table(["createdAt", "code", "status", "completedAt"], (state.workflowInstances || []).filter((item) => item.status === "completed" && inRange(item)));
  if (reportId === "workflow_duration") return table(["code", "createdAt", "completedAt", "status"], (state.workflowInstances || []).filter(inRange));
  if (reportId === "workflow_sla") return table(["instanceId", "status", "dueAt", "escalationCount"], state.workflowSlas || []);
  if (reportId === "workflow_approvals") return table(["name", "status", "approval", "instanceId"], state.workflowTasks || []);
  if (reportId === "workflow_cases") return table(["createdAt", "title", "type", "status"], (state.businessCases || []).filter(inRange));
  if (reportId === "workflow_escalations") return table(["createdAt", "reason", "level", "taskId"], (state.workflowEscalations || []).filter(inRange));
  if (reportId === "workflow_productivity") return table(["name", "status", "assigneeId", "completedAt"], state.workflowTasks || []);
  return table(["id"], []);
}

export function exportWorkflowCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function closeCase(state, caseId, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Case") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot close cases", errorCode: "WF-005", http: 403 };
  }
  const row = caseById(state, caseId);
  if (!row) return { ok: false, error: "Case not found", http: 404 };
  const previousStatus = row.status;
  if (row.status === "closed") return { ok: true, case: row, previousStatus };
  if (row.status === "cancelled") {
    return { ok: false, error: "Cancelled cases cannot be closed", errorCode: "WF-008", http: 409 };
  }
  const hops = { open: "in_progress", assigned: "resolved", in_progress: "resolved", waiting: "resolved", resolved: "closed" };
  let guard = 0;
  while (row.status !== "closed" && guard < 6) {
    const next = hops[row.status];
    if (!next || !canTransitionCase(row.status, next)) {
      return { ok: false, error: `Invalid case transition: ${row.status} → closed`, errorCode: "WF-008", http: 409 };
    }
    const moved = transitionCase(state, caseId, next, user, uid, now);
    if (!moved.ok) return { ...moved, errorCode: "WF-008", http: 409 };
    guard += 1;
  }
  row.closedAt = nowIso(now);
  row.closedBy = user?.id || "";
  emitWorkflowEvent(state, "WorkflowCaseClosed", { caseId: row.id }, {
    uid, now, correlationId: row.id, aggregateId: row.id, aggregateType: "CASE"
  });
  return { ok: true, case: row, previousStatus };
}

export function retireWorkflowDefinition(state, definitionId, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Design") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot retire workflow definitions", errorCode: "WF-005", http: 403 };
  }
  const definition = (state.workflowDefinitions || []).find((item) => item.id === definitionId || item.code === definitionId);
  if (!definition) return { ok: false, error: "Definition not found", errorCode: "WF-001", http: 404 };
  const from = definition.status || "draft";
  if (from !== "retired" && !canTransitionDefinition(from, "retired")) {
    return { ok: false, error: `Invalid definition transition: ${from} → retired`, errorCode: "WF-008", http: 409 };
  }
  definition.status = "retired";
  definition.retiredAt = nowIso(now);
  definition.retiredBy = user?.id || "";
  (state.workflowVersions || []).filter((item) => item.definitionId === definition.id && item.status === "published").forEach((item) => {
    item.status = "retired";
  });
  auditWorkflow(state, "Workflow definition retired", definition.code, user, { entityId: definition.id }, uid);
  return { ok: true, definition };
}

export function replayWorkflow(state, instanceId, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot replay workflows", errorCode: "WF-005", http: 403 };
  }
  const original = instanceById(state, instanceId);
  if (!original) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const started = startWorkflow(state, {
    code: original.code,
    subjectId: original.subjectId,
    subjectType: original.subjectType,
    branchId: original.branchId,
    priority: original.priority,
    variables: variablesOf(state, original.id),
    businessKey: `replay:${original.id}:${nowIso(now)}`,
    correlationId: original.correlationId,
    trigger: "replay"
  }, user, uid, now);
  if (!started.ok) return started;
  if (started.instance) started.instance.replayOf = original.id;
  return { ok: true, original, instance: started.instance };
}

export function registerWorkflowCallback(state, input = {}, user, uid, now) {
  ensureWorkflowState(state);
  if (user && !permitted(user, "Workflow.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot register workflow callbacks", errorCode: "WF-005", http: 403 };
  }
  const row = {
    id: newId("wfcb", uid),
    event: input.event || input.trigger || "*",
    endpoint: input.endpoint || "",
    contractId: input.contractId || "",
    createdAt: nowIso(now),
    createdBy: user?.id || ""
  };
  state.workflowCallbacks.push(row);
  return { ok: true, callback: row };
}

export function listWorkflowInstances(state, query = {}) {
  ensureWorkflowState(state);
  let rows = [...(state.workflowInstances || [])];
  if (query.status) rows = rows.filter((item) => item.status === query.status);
  if (query.owner || query.startedBy) {
    const owner = query.owner || query.startedBy;
    rows = rows.filter((item) => item.startedBy === owner);
  }
  if (query.branchId) rows = rows.filter((item) => item.branchId === query.branchId);
  if (query.priority) {
    rows = rows.filter((item) => String(item.priority).toLowerCase() === String(query.priority).toLowerCase());
  }
  if (query.businessEntityType) rows = rows.filter((item) => item.subjectType === query.businessEntityType);
  if (query.businessEntityId) rows = rows.filter((item) => item.subjectId === query.businessEntityId);
  if (query.createdAfter) rows = rows.filter((item) => item.createdAt >= query.createdAfter);
  if (query.createdBefore) rows = rows.filter((item) => item.createdAt <= query.createdBefore);
  if (query.slaState) {
    const slas = state.workflowSlas || [];
    rows = rows.filter((item) => slas.find((sla) => sla.instanceId === item.id)?.status === query.slaState);
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

export function listBusinessCases(state, query = {}) {
  ensureWorkflowState(state);
  let rows = [...(state.businessCases || [])];
  if (query.status) rows = rows.filter((item) => item.status === query.status);
  if (query.priority) {
    rows = rows.filter((item) => String(item.priority || "").toLowerCase() === String(query.priority).toLowerCase());
  }
  if (query.owner) rows = rows.filter((item) => item.ownerId === query.owner);
  if (query.branchId) rows = rows.filter((item) => item.branchId === query.branchId);
  if (query.customer || query.customerId) {
    const customerId = query.customer || query.customerId;
    rows = rows.filter((item) => item.customerId === customerId);
  }
  if (query.createdAfter) rows = rows.filter((item) => item.createdAt >= query.createdAfter);
  if (query.createdBefore) rows = rows.filter((item) => item.createdAt <= query.createdBefore);
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

export function workflowHistory(state, instanceId) {
  ensureWorkflowState(state);
  return (state.workflowHistory || []).filter((item) => item.instanceId === instanceId);
}

export function instanceTasks(state, instanceId) {
  ensureWorkflowState(state);
  const tasks = (state.workflowTasks || []).filter((item) => item.instanceId === instanceId);
  return {
    activeTasks: tasks.filter((item) => ["assigned", "in_progress", "delegated", "escalated"].includes(item.status)),
    pendingTasks: tasks.filter((item) => item.status === "pending" || item.status === "suspended"),
    completedTasks: tasks.filter((item) => item.status === "completed" || item.status === "cancelled")
  };
}

export function assertWorkflowBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    postsInterest: false,
    ownsBusinessRules: false,
    restHttp: false,
    graphqlHttp: false,
    versioned: true,
    durableState: true,
    publicContracts: true,
    httpGatewayOnly: true,
    directTableAccess: false
  };
}

registerJobHandler("workflow_sla_tick", (state, _job, ctx) => tickWorkflows(state, ctx));

registerContractHandler("Workflow.Start.v1", (state, payload, ctx) => startWorkflow(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Workflow.Cancel.v1", (state, payload, ctx) => cancelWorkflow(state, payload.instanceId, ctx.user, ctx.uid, ctx.now, payload.reason));
registerContractHandler("Workflow.Approve.v1", (state, payload, ctx) => completeTask(state, payload.taskId, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Task.Complete.v1", (state, payload, ctx) => completeTask(state, payload.taskId, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Case.Open.v1", (state, payload, ctx) => openCase(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Workflow.Simulate.v1", (state, payload, ctx) => simulateWorkflow(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Workflow.Status.v1", (state, payload) => {
  const instance = instanceById(state, payload.instanceId);
  return instance ? { ok: true, instance, steps: (state.workflowSteps || []).filter((item) => item.instanceId === instance.id) } : { ok: false, error: "Workflow instance not found" };
});
registerContractHandler("Task.Inbox.v1", (state, _payload, ctx) => ({ ok: true, rows: taskInbox(state, ctx.user) }));
registerContractHandler("Case.Get.v1", (state, payload) => {
  const row = caseById(state, payload.caseId);
  return row ? { ok: true, case: row, participants: (state.caseParticipants || []).filter((item) => item.caseId === row.id) } : { ok: false, error: "Case not found" };
});

registerGatewayHandler("workflow.start", (state, request, ctx) => startWorkflow(state, request.body || {}, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("workflow.status", (state, request) => {
  const instance = instanceById(state, request.body?.instanceId || request.instanceId);
  return instance ? { ok: true, instance } : { ok: false, error: "Workflow instance not found" };
});
registerGatewayHandler("task.inbox", (state, _request, ctx) => ({ ok: true, rows: taskInbox(state, ctx.user) }));
