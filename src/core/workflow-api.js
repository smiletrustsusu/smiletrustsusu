/**
 * Module 23 public workflow API contracts, HTTP mappings, and response schemas.
 * In-process only. Other modules must use these contracts — never workflow tables.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureWorkflowState,
  startWorkflow,
  resumeWorkflow,
  suspendWorkflow,
  cancelWorkflow,
  retryWorkflow,
  completeTask,
  assignTask,
  delegateTask,
  openCase,
  closeCase,
  publishWorkflowDefinition,
  retireWorkflowDefinition,
  replayWorkflow,
  registerWorkflowCallback,
  getWorkflowInstance,
  getWorkflowCase,
  getWorkflowVariables,
  listWorkflowInstances,
  listBusinessCases,
  workflowHistory,
  instanceTasks,
  workflowDashboard,
  taskInbox
} from "./workflow-ops.js";

export const WORKFLOW_API_VERSION = "1.0.0";
export const WORKFLOW_ERROR_CODES = {
  "WF-001": "Workflow Definition Not Found",
  "WF-002": "Workflow Version Unsupported",
  "WF-003": "Invalid Workflow State",
  "WF-004": "Task Not Found",
  "WF-005": "Unauthorized Task Action",
  "WF-006": "SLA Expired",
  "WF-007": "Duplicate Workflow Request",
  "WF-008": "Invalid Transition",
  "WF-009": "Workflow Already Completed",
  "WF-010": "Concurrency Conflict"
};

function titleCase(value, fallback = "") {
  const text = String(value || fallback);
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function displayState(status) {
  return titleCase(status, "Unknown");
}

function instanceIdOf(payload = {}) {
  return payload.workflowInstanceId || payload.instanceId || payload.id || "";
}

function taskIdOf(payload = {}) {
  return payload.workflowTaskId || payload.taskId || payload.id || "";
}

function caseIdOf(payload = {}) {
  return payload.caseId || payload.id || "";
}

function definitionIdOf(payload = {}) {
  return payload.definitionId || payload.workflowDefinitionId || payload.id || "";
}

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function mapWorkflowError(result) {
  if (!result || result.ok) return result;
  if (result.errorCode) return result;
  const message = String(result.error || "");
  if (result.conflict || message.includes("updated by another operator")) {
    return { ...result, errorCode: "WF-010", http: 409 };
  }
  if (message.includes("Task not found")) return { ...result, errorCode: "WF-004", http: 404 };
  if (message.includes("instance not found") || message.includes("Definition not found")) {
    return { ...result, errorCode: message.includes("Definition") ? "WF-001" : "WF-003", http: 404 };
  }
  if (message.includes("You cannot") || message.includes("restricted")) {
    return { ...result, errorCode: "WF-005", http: 403 };
  }
  if (message.includes("already completed") || message.includes("Already Completed")) {
    return { ...result, errorCode: "WF-009", http: 409 };
  }
  if (message.includes("Invalid") && message.includes("transition")) {
    return { ...result, errorCode: "WF-008", http: 409 };
  }
  if (message.includes("already running") || message.includes("Duplicate")) {
    return { ...result, errorCode: "WF-007", http: 409 };
  }
  return result;
}

function startPayload(payload = {}) {
  return {
    ...payload,
    code: payload.code,
    workflowDefinitionId: payload.workflowDefinitionId,
    workflowVersion: payload.workflowVersion,
    subjectType: payload.subjectType || payload.businessEntityType,
    subjectId: payload.subjectId || payload.businessEntityId,
    variables: { ...(payload.variables || {}), ...(payload.initialVariables || {}) },
    correlationId: payload.correlationId,
    priority: payload.priority,
    initiatedBy: payload.initiatedBy
  };
}

function startData(state, result, payload = {}) {
  const instance = result.instance;
  if (!instance) return {};
  const tasks = instanceTasks(state, instance.id);
  return {
    workflowInstanceId: instance.id,
    workflowDefinitionId: instance.definitionId,
    workflowVersion: instance.version || payload.workflowVersion || "1.0.0",
    state: displayState(instance.status),
    initialState: displayState(instance.status),
    priority: titleCase(instance.priority, "Normal"),
    businessEntityType: instance.subjectType || payload.businessEntityType || "",
    businessEntityId: instance.subjectId || payload.businessEntityId || "",
    startedAtUtc: instance.startedAt || instance.createdAt,
    createdTimestamp: instance.createdAt,
    startedBy: instance.startedBy,
    activeTaskCount: tasks.activeTasks.length,
    acceptedTasks: tasks.activeTasks,
    links: { self: `/api/v1/workflows/${instance.id}` }
  };
}

export function startWorkflowContract(state, payload, user, uid, now) {
  const result = startWorkflow(state, startPayload(payload), user, uid, now);
  if (result.simulated) return result;
  if (!result.ok) return mapWorkflowError(result);
  return { ...result, http: result.duplicate ? 200 : 201, ...startData(state, result, payload) };
}

export function resumeWorkflowContract(state, payload, user, uid, now) {
  const result = resumeWorkflow(state, instanceIdOf(payload), user, uid, now, payload.reason);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowInstanceId: result.instance.id,
    currentState: displayState(result.instance.status),
    previousState: displayState(result.previousState || "Suspended"),
    resumedAtUtc: result.instance.resumedAt,
    resumedBy: result.instance.resumedBy || payload.resumedBy || user?.id || ""
  };
}

export function suspendWorkflowContract(state, payload, user, uid, now) {
  const result = suspendWorkflow(state, instanceIdOf(payload), user, uid, now, payload.reason);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowInstanceId: result.instance.id,
    previousState: displayState(result.previousState || "Running"),
    currentState: displayState(result.instance.status),
    suspendedAtUtc: result.instance.suspendedAt,
    suspensionTimestamp: result.instance.suspendedAt,
    suspendedBy: result.instance.suspendedBy || payload.suspendedBy || user?.id || ""
  };
}

export function cancelWorkflowContract(state, payload, user, uid, now) {
  const result = cancelWorkflow(
    state,
    instanceIdOf(payload),
    user,
    uid,
    now,
    payload.cancellationReason || payload.reason || "Cancelled"
  );
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowInstanceId: result.instance.id,
    previousState: displayState(result.previousState || "Running"),
    currentState: displayState(result.instance.status),
    finalState: displayState(result.instance.status),
    cancelledAtUtc: result.instance.cancelledAt,
    cancelledBy: result.instance.cancelledBy || payload.cancelledBy || user?.id || "",
    reason: payload.cancellationReason || payload.reason || "User Requested"
  };
}

export function retryWorkflowContract(state, payload, user, uid, now) {
  const result = retryWorkflow(state, instanceIdOf(payload), user, uid, now, payload.retryReason || payload.reason);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowInstanceId: result.instance.id,
    retryAttempt: result.retryAttempt,
    previousState: displayState(result.previousState || "Failed"),
    currentState: displayState(result.instance.status),
    workflowState: displayState(result.instance.status),
    retriedAtUtc: result.instance.updatedAt
  };
}

export function completeTaskContract(state, payload, user, uid, now) {
  const decision = String(payload.decision || payload.outcome || "approve").toLowerCase() === "rejected"
    || String(payload.outcome || "").toLowerCase() === "reject"
    ? "reject"
    : (payload.decision || "approve");
  const result = completeTask(state, taskIdOf(payload), {
    ...payload,
    decision,
    reason: payload.reason || payload.rejectionReason,
    taskData: payload.taskData
  }, user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  const next = instanceTasks(state, result.instance?.id);
  return {
    ...result,
    taskId: result.task.id,
    workflowInstanceId: result.instance?.id,
    taskStatus: result.task.status,
    completedAtUtc: result.task.completedAt,
    completedBy: payload.completedBy || user?.id || "",
    outcome: payload.outcome || titleCase(decision, "Approved"),
    nextState: displayState(result.instance?.status),
    nextTasks: next.activeTasks,
    generatedTasks: next.activeTasks
  };
}

export function assignTaskContract(state, payload, user, uid, now) {
  const result = assignTask(state, taskIdOf(payload), payload.assigneeId, user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    assignmentId: result.assignmentId,
    taskId: result.task.id,
    assignedTo: payload.assigneeId,
    assignedRole: payload.assigneeType || result.task.role || "",
    assignedAtUtc: result.assignment?.createdAt
  };
}

export function delegateTaskContract(state, payload, user, uid, now) {
  const result = delegateTask(state, taskIdOf(payload), payload.delegatedTo || payload.assigneeId, user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  const expires = new Date(Date.parse(result.delegation?.createdAt || Date.now()) + 86400000).toISOString();
  return {
    ...result,
    delegationId: result.delegationId,
    taskId: result.task.id,
    delegatedFrom: result.task.delegatedFrom || user?.id || "",
    delegatedTo: payload.delegatedTo || payload.assigneeId,
    delegatedAtUtc: result.delegation?.createdAt,
    expiresAtUtc: expires
  };
}

export function approveWorkflowContract(state, payload, user, uid, now) {
  const result = completeTaskContract(state, { ...payload, decision: "approve", outcome: "Approved" }, user, uid, now);
  if (!result.ok) return result;
  return {
    ...result,
    approvalStatus: "Approved",
    approvedBy: user?.id || payload.completedBy || "",
    approvedAtUtc: result.completedAtUtc,
    workflowState: result.nextState
  };
}

export function rejectWorkflowContract(state, payload, user, uid, now) {
  const result = completeTask(state, taskIdOf(payload), {
    decision: "reject",
    reason: payload.rejectionReason || payload.reason || "Rejected"
  }, user, uid, now);
  if (!result.instance && !result.ok) return mapWorkflowError(result);
  return {
    ok: true,
    instance: result.instance,
    task: result.task,
    taskId: taskIdOf(payload),
    approvalStatus: "Rejected",
    rejectedBy: user?.id || "",
    rejectedAtUtc: result.instance?.updatedAt,
    workflowState: displayState(result.instance?.status || "Rejected"),
    rejectionStatus: "Rejected",
    reason: payload.rejectionReason || result.error || "Business Rule Failed"
  };
}

export function getWorkflowContract(state, payload) {
  ensureWorkflowState(state);
  const instance = getWorkflowInstance(state, instanceIdOf(payload));
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const tasks = instanceTasks(state, instance.id);
  const definition = (state.workflowDefinitions || []).find((item) => item.id === instance.definitionId);
  return {
    ok: true,
    instance,
    definition,
    currentState: displayState(instance.status),
    variables: getWorkflowVariables(state, instance.id),
    workflowInstanceId: instance.id,
    definitionId: instance.definitionId,
    definitionName: definition?.name || instance.name,
    workflowVersion: instance.version || definition?.version || "1.0.0",
    priority: titleCase(instance.priority, "Normal"),
    ownerUserId: instance.startedBy,
    businessEntityType: instance.subjectType,
    businessEntityId: instance.subjectId,
    createdAtUtc: instance.createdAt,
    lastUpdatedUtc: instance.updatedAt,
    timestamps: { createdAtUtc: instance.createdAt, lastUpdatedUtc: instance.updatedAt },
    linkedBusinessEntity: { type: instance.subjectType, id: instance.subjectId },
    activeTasks: tasks.activeTasks,
    completedTasks: tasks.completedTasks,
    timeline: workflowHistory(state, instance.id)
  };
}

export function listWorkflowsContract(state, payload = {}) {
  const rows = listWorkflowInstances(state, payload);
  const paged = paginateCollection(rows, payload);
  if (!paged.ok) return paged;
  return {
    ok: true,
    http: 200,
    rows: paged.data,
    pagination: paged.pagination,
    data: paged.data.map((item) => ({
      workflowInstanceId: item.id,
      state: displayState(item.status),
      priority: titleCase(item.priority, "Normal"),
      ownerUserId: item.startedBy,
      businessEntityType: item.subjectType,
      businessEntityId: item.subjectId,
      startedAtUtc: item.startedAt || item.createdAt
    }))
  };
}

export function workflowTasksContract(state, payload) {
  const instance = getWorkflowInstance(state, instanceIdOf(payload));
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const tasks = instanceTasks(state, instance.id);
  return {
    ok: true,
    workflowInstanceId: instance.id,
    ...tasks
  };
}

export function workflowCaseContract(state, payload) {
  ensureWorkflowState(state);
  const row = getWorkflowCase(state, caseIdOf(payload));
  if (!row) return { ok: false, error: "Case not found", http: 404 };
  return {
    ok: true,
    case: row,
    caseId: row.id,
    status: titleCase(row.status, "Open"),
    priority: titleCase(row.priority, "Medium"),
    ownerUserId: row.ownerId,
    participants: (state.caseParticipants || []).filter((item) => item.caseId === row.id),
    documents: (state.caseDocuments || []).filter((item) => item.caseId === row.id),
    timeline: row.timeline || [],
    relatedEntities: [
      row.customerId ? { type: "Customer", id: row.customerId } : null,
      row.workflowInstanceId ? { type: "Workflow", id: row.workflowInstanceId } : null
    ].filter(Boolean),
    relatedTransactions: [],
    caseDetails: row
  };
}

export function workflowHistoryContract(state, payload) {
  const instance = getWorkflowInstance(state, instanceIdOf(payload));
  if (!instance) return { ok: false, error: "Workflow instance not found", errorCode: "WF-003", http: 404 };
  const history = workflowHistory(state, instance.id);
  const events = (state.domainEvents || []).filter((item) => item.payload?.instanceId === instance.id || item.aggregateId === instance.id);
  return {
    ok: true,
    instance,
    history,
    stateTransitions: (state.workflowTransitions || []).filter((item) => item.instanceId === instance.id),
    approvals: (state.workflowTasks || []).filter((item) => item.instanceId === instance.id && item.approvals?.length),
    escalations: (state.workflowEscalations || []).filter((item) => item.instanceId === instance.id),
    retries: history.filter((item) => String(item.action || "").includes("retry")),
    auditReferences: history.map((item) => item.id),
    events
  };
}

export function openCaseContract(state, payload, user, uid, now) {
  const result = openCase(state, payload, user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    http: 201,
    caseId: result.case.id,
    caseNumber: result.case.caseNumber,
    status: titleCase(result.case.status, "Open"),
    createdAtUtc: result.case.createdAt,
    ownerUserId: result.case.ownerId
  };
}

export function closeCaseContract(state, payload, user, uid, now) {
  const result = closeCase(state, caseIdOf(payload), user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    caseId: result.case.id,
    previousStatus: titleCase(result.previousStatus, "Investigating"),
    currentStatus: titleCase(result.case.status, "Closed"),
    closedAtUtc: result.case.closedAt,
    closedBy: result.case.closedBy || user?.id || ""
  };
}

export function listCasesContract(state, payload = {}) {
  const rows = listBusinessCases(state, payload);
  const paged = paginateCollection(rows, payload);
  if (!paged.ok) return paged;
  return {
    ok: true,
    http: 200,
    rows: paged.data,
    pagination: paged.pagination,
    data: paged.data.map((item) => ({
      caseId: item.id,
      status: titleCase(item.status, "Open"),
      priority: titleCase(item.priority, "Medium"),
      ownerUserId: item.ownerId,
      createdAtUtc: item.createdAt
    }))
  };
}

export function listDefinitionsContract(state, payload = {}) {
  ensureWorkflowState(state);
  const paged = paginateCollection(state.workflowDefinitions || [], payload);
  if (!paged.ok) return paged;
  return {
    ok: true,
    rows: paged.data,
    pagination: paged.pagination,
    data: paged.data.map((item) => ({
      workflowDefinitionId: item.id,
      name: item.name,
      version: item.version || "1.0.0",
      status: titleCase(item.status, "Published")
    }))
  };
}

export function getDefinitionContract(state, payload) {
  ensureWorkflowState(state);
  const definition = (state.workflowDefinitions || []).find((item) => (
    item.id === definitionIdOf(payload) || item.code === definitionIdOf(payload)
  ));
  if (!definition) return { ok: false, error: "Definition not found", errorCode: "WF-001", http: 404 };
  return {
    ok: true,
    definition,
    workflowDefinitionId: definition.id,
    name: definition.name,
    version: definition.version || "1.0.0",
    status: titleCase(definition.status, "Published"),
    steps: definition.steps || [],
    transitions: (definition.steps || []).flatMap((step) => (step.next || []).map((next) => ({ from: step.id, to: next }))),
    sla: { slaMs: definition.slaMs, warningRatio: definition.warningRatio }
  };
}

export function publishDefinitionContract(state, payload, user, uid, now) {
  const result = publishWorkflowDefinition(state, definitionIdOf(payload), user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowDefinitionId: result.definition.id,
    version: result.version?.version || result.definition.version || "1.0.0",
    status: "Published",
    publishedAtUtc: result.version?.createdAt,
    publishedBy: user?.id || ""
  };
}

export function retireDefinitionContract(state, payload, user, uid, now) {
  const result = retireWorkflowDefinition(state, definitionIdOf(payload), user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    workflowDefinitionId: result.definition.id,
    status: "Retired",
    retiredAtUtc: result.definition.retiredAt,
    retiredBy: result.definition.retiredBy || user?.id || ""
  };
}

export function workflowStatisticsContract(state) {
  const stats = workflowDashboard(state);
  const instances = state.workflowInstances || [];
  const durations = instances
    .filter((item) => item.completedAt && item.createdAt)
    .map((item) => Date.parse(item.completedAt) - Date.parse(item.createdAt))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageExecutionTimeMs = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;
  return {
    ok: true,
    running: instances.filter((item) => item.status === "running").length,
    waiting: stats.waiting,
    completed: stats.completed,
    failed: stats.failed,
    cancelled: instances.filter((item) => item.status === "cancelled").length,
    slaBreaches: stats.slaBreaches,
    escalations: stats.escalations,
    averageExecutionTimeMs
  };
}

export function replayWorkflowContract(state, payload, user, uid, now) {
  const result = replayWorkflow(state, instanceIdOf(payload), user, uid, now);
  if (!result.ok) return mapWorkflowError(result);
  return {
    ...result,
    originalWorkflowInstanceId: result.original.id,
    replayWorkflowInstanceId: result.instance?.id,
    replayStartedAtUtc: result.instance?.createdAt,
    initiatedBy: user?.id || ""
  };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

registerContractHandler("Workflow.Start.v1", (state, payload, ctx) => startWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Resume.v1", (state, payload, ctx) => resumeWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Suspend.v1", (state, payload, ctx) => suspendWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Cancel.v1", (state, payload, ctx) => cancelWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Retry.v1", (state, payload, ctx) => retryWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.CompleteTask.v1", (state, payload, ctx) => completeTaskContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Task.Complete.v1", (state, payload, ctx) => completeTaskContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.AssignTask.v1", (state, payload, ctx) => assignTaskContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.DelegateTask.v1", (state, payload, ctx) => delegateTaskContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Approve.v1", (state, payload, ctx) => approveWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Reject.v1", (state, payload, ctx) => rejectWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Simulate.v1", (state, payload, ctx) => startWorkflow(state, { ...payload, simulate: true }, ...ctxArgs(ctx)));
registerContractHandler("Case.Open.v1", (state, payload, ctx) => openCaseContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Case.Close.v1", (state, payload, ctx) => closeCaseContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.PublishDefinition.v1", (state, payload, ctx) => publishDefinitionContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.RetireDefinition.v1", (state, payload, ctx) => retireDefinitionContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Replay.v1", (state, payload, ctx) => replayWorkflowContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.RegisterCallback.v1", (state, payload, ctx) => registerWorkflowCallback(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Workflow.Status.v1", (state, payload) => getWorkflowContract(state, payload));
registerContractHandler("Workflow.Get.v1", (state, payload) => getWorkflowContract(state, payload));
registerContractHandler("Workflow.List.v1", (state, payload) => listWorkflowsContract(state, payload));
registerContractHandler("Workflow.Tasks.v1", (state, payload) => workflowTasksContract(state, payload));
registerContractHandler("Workflow.Case.v1", (state, payload) => workflowCaseContract(state, payload));
registerContractHandler("Workflow.History.v1", (state, payload) => workflowHistoryContract(state, payload));
registerContractHandler("Task.Inbox.v1", (state, _payload, ctx) => ({ ok: true, rows: taskInbox(state, ctx.user) }));
registerContractHandler("Case.Get.v1", (state, payload) => workflowCaseContract(state, payload));
registerContractHandler("Workflow.Definitions.v1", (state, payload) => listDefinitionsContract(state, payload));
registerContractHandler("Workflow.Definition.Get.v1", (state, payload) => getDefinitionContract(state, payload));
registerContractHandler("Workflow.Statistics.v1", (state) => workflowStatisticsContract(state));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

function gatewayQuery(fn) {
  return (state, request) => fn(state, requestFields(request));
}

registerGatewayHandler("workflow.start", gateway(startWorkflowContract));
registerGatewayHandler("workflow.create", gateway(startWorkflowContract));
registerGatewayHandler("workflow.get", gatewayQuery(getWorkflowContract));
registerGatewayHandler("workflow.status", gatewayQuery(getWorkflowContract));
registerGatewayHandler("workflow.list", gatewayQuery(listWorkflowsContract));
registerGatewayHandler("workflow.suspend", gateway(suspendWorkflowContract));
registerGatewayHandler("workflow.resume", gateway(resumeWorkflowContract));
registerGatewayHandler("workflow.cancel", gateway(cancelWorkflowContract));
registerGatewayHandler("workflow.retry", gateway(retryWorkflowContract));
registerGatewayHandler("workflow.tasks", gatewayQuery(workflowTasksContract));
registerGatewayHandler("workflow.history", gatewayQuery(workflowHistoryContract));
registerGatewayHandler("workflow.statistics", (state) => workflowStatisticsContract(state));
registerGatewayHandler("workflow.replay", gateway(replayWorkflowContract));
registerGatewayHandler("task.complete", gateway(completeTaskContract));
registerGatewayHandler("task.assign", gateway(assignTaskContract));
registerGatewayHandler("task.delegate", gateway(delegateTaskContract));
registerGatewayHandler("task.approve", gateway(approveWorkflowContract));
registerGatewayHandler("task.reject", gateway(rejectWorkflowContract));
registerGatewayHandler("task.inbox", (state, _request, ctx) => ({ ok: true, rows: taskInbox(state, ctx.user) }));
registerGatewayHandler("case.create", gateway(openCaseContract));
registerGatewayHandler("case.get", gatewayQuery(workflowCaseContract));
registerGatewayHandler("case.list", gatewayQuery(listCasesContract));
registerGatewayHandler("case.close", gateway(closeCaseContract));
registerGatewayHandler("workflow.definitions", gatewayQuery(listDefinitionsContract));
registerGatewayHandler("workflow.definition.get", gatewayQuery(getDefinitionContract));
registerGatewayHandler("workflow.definition.publish", gateway(publishDefinitionContract));
registerGatewayHandler("workflow.definition.retire", gateway(retireDefinitionContract));
