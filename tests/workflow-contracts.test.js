import test from "node:test";
import assert from "node:assert/strict";
import { getContract } from "../src/core/module-contracts.js";
import { invokeContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { ensureWorkflowState, startWorkflow } from "../src/core/workflow-ops.js";
import { WORKFLOW_ERROR_CODES } from "../src/core/workflow-api.js";
import { routeById } from "../src/core/api-gateway-lifecycle.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-11T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20 }],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    loans: [],
    audit: [],
    notifications: [],
    featureFlags: [{ id: "enableWorkflowEngine", enabled: true }]
  };
  ensureGatewayState(state);
  ensureWorkflowState(state);
  return state;
}

function call(state, contractId, payload, user = owner) {
  return invokeContract(state, { contractId, fromModule: 20, payload }, { uid, now, user });
}

test("published workflow contracts and standard error codes are catalogued", () => {
  [
    "Workflow.Start.v1", "Workflow.Resume.v1", "Workflow.Suspend.v1", "Workflow.Cancel.v1",
    "Workflow.Retry.v1", "Workflow.CompleteTask.v1", "Workflow.AssignTask.v1", "Workflow.DelegateTask.v1",
    "Workflow.Approve.v1", "Workflow.Reject.v1", "Workflow.Get.v1", "Workflow.List.v1",
    "Workflow.Tasks.v1", "Workflow.Case.v1", "Workflow.History.v1"
  ].forEach((id) => assert.ok(getContract(id), id));
  [
    "WorkflowStarted", "WorkflowTaskAssigned", "WorkflowApproved", "WorkflowSLABreached", "WorkflowCaseClosed"
  ].forEach((id) => assert.equal(getContract(id).kind, "event"));
  assert.equal(WORKFLOW_ERROR_CODES["WF-001"], "Workflow Definition Not Found");
  assert.equal(WORKFLOW_ERROR_CODES["WF-010"], "Concurrency Conflict");
  assert.equal(routeById("workflow.create").path, "/workflows");
  assert.equal(routeById("task.approve").method, "POST");
});

test("start, get, list, suspend, resume, and cancel use documented contracts", () => {
  const state = blank();
  const before = state.collections.length;
  const started = call(state, "Workflow.Start.v1", {
    workflowDefinitionId: "wfdef-auto",
    workflowVersion: "1.0.0",
    businessEntityType: "Loan",
    businessEntityId: "ln-api-1",
    priority: "Normal",
    initialVariables: { note: "contract-start" },
    correlationId: "corr-wf-1"
  });
  assert.equal(started.ok, true);
  assert.equal(started.http, 201);
  assert.equal(started.data.workflowInstanceId, started.data.instance.id);
  assert.equal(started.data.state, "Completed");
  assert.equal(started.data.businessEntityType, "Loan");
  assert.ok(started.envelope.links.self.includes(started.data.workflowInstanceId) || started.data.links.self.includes(started.data.workflowInstanceId));
  const got = call(state, "Workflow.Get.v1", { workflowInstanceId: started.data.workflowInstanceId });
  assert.equal(got.ok, true);
  assert.equal(got.data.currentState, "Completed");
  assert.equal(got.data.linkedBusinessEntity.id, "ln-api-1");
  const listed = call(state, "Workflow.List.v1", { page: 1, pageSize: 20, businessEntityId: "ln-api-1" });
  assert.equal(listed.ok, true);
  assert.equal(listed.envelope.pagination.totalItems >= 1, true);
  assert.equal(listed.data.data[0].workflowInstanceId, started.data.workflowInstanceId);
  const waiting = startWorkflow(state, { code: "withdrawal_approval", subjectId: "wd-api" }, owner, uid, now);
  const suspended = call(state, "Workflow.Suspend.v1", { workflowInstanceId: waiting.instance.id, reason: "Hold" });
  assert.equal(suspended.ok, true);
  assert.equal(suspended.data.currentState, "Suspended");
  assert.equal(suspended.data.previousState, "Waiting");
  const resumed = call(state, "Workflow.Resume.v1", { workflowInstanceId: waiting.instance.id, reason: "Continue" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.data.currentState, "Waiting");
  const cancelled = call(state, "Workflow.Cancel.v1", { workflowInstanceId: waiting.instance.id, cancellationReason: "User Requested" });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.data.finalState, "Cancelled");
  assert.equal(state.collections.length, before);
});

test("task assign, complete, approve, reject, and history stay on the engine", () => {
  const state = blank();
  const started = startWorkflow(state, { code: "payment_exception", subjectId: "wd-tasks", severity: "critical" }, owner, uid, now);
  const task = state.workflowTasks.find((item) => item.instanceId === started.instance.id);
  const assigned = call(state, "Workflow.AssignTask.v1", { workflowTaskId: task.id, assigneeId: owner.id, assigneeType: "BranchManager" });
  assert.equal(assigned.ok, true);
  assert.ok(assigned.data.assignmentId);
  const delegated = call(state, "Workflow.DelegateTask.v1", { workflowTaskId: task.id, delegatedTo: "u-checker", delegationReason: "Cover" });
  assert.equal(delegated.ok, true);
  assert.ok(delegated.data.delegationId);
  const approved = call(state, "Workflow.Approve.v1", { workflowTaskId: task.id, approvalDecision: "Approved", approvalComment: "OK" });
  assert.equal(approved.ok, true);
  assert.equal(approved.data.approvalStatus, "Approved");
  const tasks = call(state, "Workflow.Tasks.v1", { workflowInstanceId: started.instance.id });
  assert.equal(tasks.ok, true);
  assert.ok(Array.isArray(tasks.data.completedTasks));
  const history = call(state, "Workflow.History.v1", { workflowInstanceId: started.instance.id });
  assert.equal(history.ok, true);
  assert.ok(history.data.history.length >= 1);
  const other = startWorkflow(state, { code: "payment_exception", subjectId: "wd-rej", severity: "critical" }, owner, uid, now);
  const rejectTask = state.workflowTasks.find((item) => item.instanceId === other.instance.id);
  const rejected = call(state, "Workflow.Reject.v1", { workflowTaskId: rejectTask.id, rejectionReason: "Business Rule Failed" });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.data.approvalStatus, "Rejected");
  assert.equal(rejected.data.workflowState, "Failed");
});

test("cases, definitions, statistics, replay, callbacks, and HTTP routes are versioned", () => {
  const state = blank();
  const opened = call(state, "Case.Open.v1", { type: "fraud_investigation", title: "Dispute", customerId: "c-a", priority: "High" });
  assert.equal(opened.ok, true);
  assert.equal(opened.http, 201);
  assert.ok(String(opened.data.caseNumber).startsWith("CASE-2026-"));
  const got = call(state, "Workflow.Case.v1", { caseId: opened.data.caseId });
  assert.equal(got.ok, true);
  assert.equal(got.data.ownerUserId, owner.id);
  const closed = call(state, "Case.Close.v1", { caseId: opened.data.caseId });
  assert.equal(closed.ok, true);
  assert.equal(closed.data.currentStatus, "Closed");
  const defs = call(state, "Workflow.Definitions.v1", { page: 1, pageSize: 10 });
  assert.equal(defs.ok, true);
  assert.ok(defs.data.data.length >= 1);
  const one = call(state, "Workflow.Definition.Get.v1", { definitionId: "wfdef-loan-approve" });
  assert.equal(one.ok, true);
  assert.equal(one.data.name, "Loan Approval");
  const stats = call(state, "Workflow.Statistics.v1", {});
  assert.equal(stats.ok, true);
  assert.equal(typeof stats.data.averageExecutionTimeMs, "number");
  const original = startWorkflow(state, { code: "fully_automated", subjectId: "replay-1" }, owner, uid, now);
  const replayed = call(state, "Workflow.Replay.v1", { workflowInstanceId: original.instance.id });
  assert.equal(replayed.ok, true);
  assert.equal(replayed.data.originalWorkflowInstanceId, original.instance.id);
  const callback = call(state, "Workflow.RegisterCallback.v1", { event: "WorkflowStarted", endpoint: "/internal/hooks/workflow" });
  assert.equal(callback.ok, true);
  startWorkflow(state, { code: "fully_automated", subjectId: "cb-1" }, owner, uid, now);
  assert.ok((state.workflowCallbackDeliveries || []).some((item) => item.event === "WorkflowStarted"));
  const viaGateway = dispatchGatewayRequest(state, {
    route: "workflow.create",
    version: "v1",
    user: owner,
    body: { code: "fully_automated", subjectId: "gw-contract" }
  }, { uid, now, user: owner });
  assert.equal(viaGateway.ok, true);
  assert.equal(viaGateway.http, 201);
});

test("standard workflow errors, pagination, and authorization hold", () => {
  const state = blank();
  const missing = call(state, "Workflow.Start.v1", { workflowDefinitionId: "does-not-exist" });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.errorCode, "WF-001");
  const unsupported = call(state, "Workflow.Start.v1", { workflowDefinitionId: "wfdef-auto", workflowVersion: "9.9.9" });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.errorCode, "WF-002");
  const forbidden = invokeContract(state, {
    contractId: "Workflow.Start.v1",
    fromModule: 20,
    payload: { code: "fully_automated", subjectId: "nope" }
  }, { uid, now, user: collector });
  assert.equal(forbidden.ok, false);
  const emptyList = call(state, "Workflow.List.v1", { page: 1, pageSize: 20, businessEntityId: "none" });
  assert.equal(emptyList.ok, true);
  assert.equal(emptyList.http, 200);
  assert.deepEqual(emptyList.data.data, []);
  assert.equal(emptyList.envelope.pagination.totalPages, 0);
  assert.equal(emptyList.envelope.pagination.lastPage, 0);
  const outOfRange = call(state, "Workflow.List.v1", { page: 2, pageSize: 20, businessEntityId: "none" });
  assert.equal(outOfRange.ok, false);
  assert.equal(outOfRange.http, 416);
  assert.equal(outOfRange.error.errorCode, "PAG-001");
  assert.equal(outOfRange.envelope.status.code, "PAGE_OUT_OF_RANGE");
  const done = startWorkflow(state, { code: "fully_automated", subjectId: "done-1" }, owner, uid, now);
  const again = call(state, "Workflow.Cancel.v1", { workflowInstanceId: done.instance.id });
  assert.equal(again.ok, false);
  assert.equal(again.error.errorCode, "WF-009");
  const staleTask = startWorkflow(state, { code: "withdrawal_approval", subjectId: "conc-1" }, owner, uid, now);
  const task = state.workflowTasks.find((item) => item.instanceId === staleTask.instance.id);
  const conflict = call(state, "Workflow.CompleteTask.v1", { workflowTaskId: task.id, revision: 1 });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.errorCode, "WF-010");
});
