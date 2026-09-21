import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  canTransitionWorkflow,
  canTransitionTask,
  canTransitionCase
} from "../src/core/workflow-lifecycle.js";
import {
  ensureWorkflowState,
  startWorkflow,
  simulateWorkflow,
  completeTask,
  delegateTask,
  escalateTask,
  retryWorkflow,
  compensateWorkflow,
  suspendWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  tickWorkflows,
  openCase,
  addCaseParticipant,
  attachCaseDocument,
  transitionCase,
  publishWorkflowDefinition,
  taskInbox,
  workflowDashboard,
  workflowReports,
  exportWorkflowCsv,
  assertWorkflowBoundary
} from "../src/core/workflow-ops.js";
import "../src/core/workflow-api.js";
import { invokeContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { getContract } from "../src/core/module-contracts.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const maker = { id: "u-maker", role: "Admin", username: "ama", branchId: "br-1" };
const checker = { id: "u-checker", role: "Accountant", username: "kofi" };
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

test("only documented workflow, task, and case transitions are permitted", () => {
  assert.equal(canTransitionWorkflow("draft", "created"), true);
  assert.equal(canTransitionWorkflow("running", "waiting"), true);
  assert.equal(canTransitionWorkflow("running", "suspended"), true);
  assert.equal(canTransitionWorkflow("failed", "retrying"), true);
  assert.equal(canTransitionWorkflow("completed", "running"), false);
  assert.equal(canTransitionWorkflow("running", "draft"), false);
  assert.equal(canTransitionTask("assigned", "completed"), true);
  assert.equal(canTransitionTask("completed", "assigned"), false);
  assert.equal(canTransitionCase("open", "assigned"), true);
  assert.equal(canTransitionCase("closed", "open"), false);
  assert.equal(assertWorkflowBoundary().postsCollections, false);
  assert.equal(assertWorkflowBoundary().restHttp, false);
});

test("automated workflows complete without posting collections", () => {
  const state = blank();
  const before = state.collections.length;
  const result = startWorkflow(state, { code: "fully_automated", subjectId: "auto-1", trigger: "manual" }, owner, uid, now);
  assert.equal(result.ok, true);
  assert.equal(result.instance.status, "completed");
  assert.equal(state.collections.length, before);
  assert.equal(state.collections[0].amount, 20);
});

test("dual approval enforces maker-checker and does not pay withdrawals", () => {
  const state = blank();
  const started = startWorkflow(state, { code: "withdrawal_approval", subjectId: "wd-1", trigger: "manual" }, maker, uid, now);
  assert.equal(started.ok, true);
  assert.equal(started.instance.status, "waiting");
  const task = state.workflowTasks.find((item) => item.instanceId === started.instance.id);
  const self = completeTask(state, task.id, { decision: "approve" }, maker, uid, now);
  assert.equal(self.ok, false);
  const first = completeTask(state, task.id, { decision: "approve" }, checker, uid, now);
  assert.equal(first.ok, true);
  assert.equal(first.pending, true);
  const second = completeTask(state, task.id, { decision: "approve" }, owner, uid, now);
  assert.equal(second.ok, true);
  assert.equal(second.instance.status, "completed");
  assert.equal((state.withdrawalRequests || []).length, 0);
});

test("conditional loan and payment workflows branch on variables", () => {
  const state = blank();
  const large = startWorkflow(state, { code: "loan_application", subjectId: "ln-1", amount: 8000 }, owner, uid, now);
  assert.equal(large.ok, true);
  assert.equal(state.workflowTasks.some((item) => item.name === "Manager review"), true);
  const small = startWorkflow(state, { code: "loan_application", subjectId: "ln-2", amount: 500 }, owner, uid, now);
  assert.equal(small.ok, true);
  assert.equal(state.workflowTasks.some((item) => item.name === "Officer review"), true);
  const auto = startWorkflow(state, { code: "payment_exception", subjectId: "pay-1", severity: "low" }, owner, uid, now);
  assert.equal(auto.instance.status, "completed");
  const human = startWorkflow(state, { code: "payment_exception", subjectId: "pay-2", severity: "critical" }, owner, uid, now);
  assert.equal(human.instance.status, "waiting");
});

test("parallel reviews wait for both tasks before completing", () => {
  const state = blank();
  const started = startWorkflow(state, { code: "parallel_review", subjectId: "par-1" }, owner, uid, now);
  const open = state.workflowTasks.filter((item) => item.instanceId === started.instance.id && item.status !== "completed");
  assert.equal(open.length, 2);
  completeTask(state, open[0].id, {}, owner, uid, now);
  assert.equal(instanceStatus(state, started.instance.id) !== "completed", true);
  completeTask(state, open[1].id, {}, owner, uid, now);
  assert.equal(instanceStatus(state, started.instance.id), "completed");
});

function instanceStatus(state, id) {
  return state.workflowInstances.find((item) => item.id === id)?.status;
}

test("SLA tick escalates overdue tasks and records breaches", () => {
  const state = blank();
  const started = startWorkflow(state, { code: "withdrawal_approval", subjectId: "sla-1" }, owner, uid, now);
  const later = "2026-09-12T08:00:00.000Z";
  const tick = tickWorkflows(state, { uid, now: later, user: owner });
  assert.ok(tick.slaBreaches >= 1 || tick.escalated >= 1);
  assert.ok((state.workflowEscalations || []).length >= 1);
  assert.equal(started.instance.status === "waiting" || started.instance.status === "running", true);
});

test("failed automated steps can retry and compensate without reversing money", () => {
  const state = blank();
  state.workflowDefinitions.push({
    id: "wfdef-fail",
    code: "retry_demo",
    status: "published",
    posting: false,
    steps: [{ id: "boom", name: "Boom", kind: "automated", handler: "fail_step", next: [] }]
  });
  state.workflowVersions.push({
    id: "ver-fail",
    definitionId: "wfdef-fail",
    code: "retry_demo",
    status: "published",
    version: "1.0.0",
    steps: [{ id: "boom", name: "Boom", kind: "automated", handler: "fail_step", next: [] }],
    slaMs: 1000
  });
  const failed = startWorkflow(state, { code: "retry_demo", subjectId: "r1" }, owner, uid, now);
  assert.equal(failed.instance.status, "failed");
  failed.instance.steps[0].handler = "auto_complete";
  const retried = retryWorkflow(state, failed.instance.id, owner, uid, now);
  assert.equal(retried.ok, true);
  assert.equal(retried.instance.status, "completed");
  const waiting = startWorkflow(state, { code: "withdrawal_approval", subjectId: "comp-1" }, owner, uid, now);
  const compensated = compensateWorkflow(state, waiting.instance.id, owner, uid, now);
  assert.equal(compensated.ok, true);
  assert.equal(compensated.postsCollections, false);
  assert.equal(state.collections[0].amount, 20);
});

test("running instances keep the version they started with", () => {
  const state = blank();
  const started = startWorkflow(state, { code: "withdrawal_approval", subjectId: "ver-1" }, owner, uid, now);
  const originalSteps = started.instance.steps.length;
  const definition = state.workflowDefinitions.find((item) => item.code === "withdrawal_approval");
  definition.steps = [...definition.steps, { id: "extra", name: "Extra", kind: "automated", handler: "auto_complete", next: [] }];
  publishWorkflowDefinition(state, definition.id, owner, uid, now);
  assert.equal(started.instance.steps.length, originalSteps);
  assert.notEqual(started.instance.versionId, state.workflowVersions[state.workflowVersions.length - 1].id);
});

test("simulation, idempotent start, concurrency, and RBAC hold", () => {
  const state = blank();
  const sim = simulateWorkflow(state, { code: "fully_automated" }, owner, uid, now);
  assert.equal(sim.simulated, true);
  assert.equal((state.workflowInstances || []).length, 0);
  const first = startWorkflow(state, { code: "withdrawal_approval", subjectId: "idemp", businessKey: "withdrawal_approval:idemp" }, owner, uid, now);
  const again = startWorkflow(state, { code: "withdrawal_approval", subjectId: "idemp", businessKey: "withdrawal_approval:idemp" }, owner, uid, now);
  assert.equal(again.duplicate, true);
  const task = state.workflowTasks.find((item) => item.instanceId === first.instance.id);
  const stale = completeTask(state, task.id, { revision: 1 }, owner, uid, now);
  assert.equal(stale.conflict, true);
  const denied = startWorkflow(state, { code: "fully_automated", subjectId: "nope" }, collector, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(canAction(collector, "Workflow.Approve"), false);
});

test("cases, inbox, contracts, gateway, and reports stay on the workflow engine", () => {
  const state = blank();
  const opened = openCase(state, { type: "fraud_investigation", title: "MoMo dispute", customerId: "c-a" }, owner, uid, now);
  assert.equal(opened.ok, true);
  addCaseParticipant(state, opened.case.id, { userId: checker.id, role: "investigator" }, owner, uid, now);
  attachCaseDocument(state, opened.case.id, { name: "screenshot" }, owner, uid, now);
  const moved = transitionCase(state, opened.case.id, "in_progress", owner, uid, now);
  assert.equal(moved.case.status, "in_progress");
  assert.ok(opened.case.timeline.length >= 1);
  startWorkflow(state, { code: "fraud_investigation", subjectId: "c-a" }, owner, uid, now);
  assert.ok(taskInbox(state, owner).length >= 1);
  const viaContract = invokeContract(state, {
    contractId: "Workflow.Start.v1",
    fromModule: 20,
    payload: { code: "fully_automated", subjectId: "api-1" }
  }, { uid, now, user: owner });
  assert.equal(viaContract.ok, true);
  const viaGateway = dispatchGatewayRequest(state, {
    route: "workflow.start",
    version: "v1",
    user: owner,
    body: { code: "fully_automated", subjectId: "gw-1" }
  }, { uid, now, user: owner });
  assert.equal(viaGateway.ok, true);
  const report = workflowReports(state, "workflow_active", { from: "2026-09-11", to: "2026-09-11" });
  assert.ok(exportWorkflowCsv(report).includes("code") || report.columns.includes("code"));
  assert.ok(getContract("Workflow.Start.v1"));
  assert.ok(workflowDashboard(state).active >= 0);
  cancelWorkflow(state, startWorkflow(state, { code: "withdrawal_approval", subjectId: "cx" }, owner, uid, now).instance.id, owner, uid, now);
  const suspended = startWorkflow(state, { code: "withdrawal_approval", subjectId: "sx" }, owner, uid, now);
  suspendWorkflow(state, suspended.instance.id, owner, uid, now);
  assert.equal(instanceStatus(state, suspended.instance.id), "suspended");
  resumeWorkflow(state, suspended.instance.id, owner, uid, now);
  delegateTask(state, state.workflowTasks.find((item) => item.instanceId === suspended.instance.id).id, checker.id, owner, uid, now);
  escalateTask(state, state.workflowTasks.find((item) => item.instanceId === suspended.instance.id).id, owner, uid, now);
});
