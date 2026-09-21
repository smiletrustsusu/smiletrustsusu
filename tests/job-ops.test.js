import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canPerformOffline } from "../src/core/sync-ops.js";
import {
  JOB_TRANSITION_MATRIX,
  canTransitionJob,
  nextRetryDelayMs,
  healthScore,
  cronMatches,
  blackoutActive
} from "../src/core/job-lifecycle.js";
import {
  ensureJobState,
  enqueueJob,
  tickScheduler,
  registerWorker,
  reserveJob,
  recoverStaleJobs,
  replayDeadLetter,
  decideJobApproval,
  runJobManually,
  scheduleJob,
  cancelJob,
  registerJobHandler,
  searchJobs,
  jobDashboard,
  jobReports,
  exportJobCsv,
  jobDetail,
  assertSchedulerBoundary
} from "../src/core/job-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const accountant = { id: "u-acc", role: "Accountant", username: "ama" };
const checker = { id: "u-chk", role: "Accountant", username: "kofi" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-10T16:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31, encryptOfflineQueue: true },
    collections: [],
    audit: []
  };
  ensureJobState(state);
  return state;
}

test("scheduler is centralized and does not post interest or collections", () => {
  const boundary = assertSchedulerBoundary();
  assert.equal(boundary.centralized, true);
  assert.equal(boundary.restApi, false);
  assert.equal(boundary.graphql, false);
  assert.equal(boundary.postsInterest, false);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.wrapsExistingQueues, true);
  assert.equal(canTransitionJob("created", "queued"), true);
  assert.equal(canTransitionJob("queued", "completed"), false);
  assert.deepEqual(JOB_TRANSITION_MATRIX.running, ["completed", "failed", "queued", "dead_letter", "cancelled"]);
  assert.equal(nextRetryDelayMs({ strategy: "exponential", backoffMs: 1000 }, 3), 4000);
  assert.equal(nextRetryDelayMs({ strategy: "fixed", backoffMs: 1500 }, 9), 1500);
  assert.equal(cronMatches("0 16 * * *", now), true);
  assert.equal(healthScore({ failureRate: 0, retryRate: 0, dlqSize: 0 }).status, "healthy");
});

test("enqueue is idempotent and lifecycle is audited", () => {
  const state = blank();
  const first = enqueueJob(state, { type: "cache_refresh", businessKey: "night" }, owner, uid, now);
  const again = enqueueJob(state, { type: "cache_refresh", businessKey: "night" }, owner, uid, now);
  assert.equal(first.ok, true);
  assert.equal(first.job.status, "queued");
  assert.equal(again.duplicate, true);
  assert.equal(state.backgroundJobs.length, 1);
  assert.equal(state.jobStatusHistory.some((item) => item.previousState === "created" && item.newState === "queued"), true);
  assert.equal(state.audit.some((item) => String(item.action).includes("Job queued")), true);
});

test("critical jobs run before background work", () => {
  const state = blank();
  enqueueJob(state, { type: "cleanup", businessKey: "a" }, owner, uid, now);
  enqueueJob(state, { type: "payment_retry", businessKey: "b" }, owner, uid, now);
  const ticked = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-a", maxJobs: 1 });
  assert.equal(ticked.processed, 1);
  const payment = state.backgroundJobs.find((item) => item.type === "payment_retry");
  const cleanup = state.backgroundJobs.find((item) => item.type === "cleanup");
  assert.equal(payment.status, "completed");
  assert.equal(cleanup.status, "queued");
});

test("job dependencies honor daily closing before interest and reports", () => {
  const state = blank();
  enqueueJob(state, { type: "daily_closing", businessKey: "close" }, owner, uid, now);
  enqueueJob(state, { type: "daily_interest", businessKey: "interest" }, owner, uid, now);
  enqueueJob(state, { type: "trial_balance", businessKey: "tb" }, owner, uid, now);
  enqueueJob(state, { type: "financial_statements", businessKey: "fs" }, owner, uid, now);
  tickScheduler(state, { uid, now, user: owner, workerId: "wrk-dep", maxJobs: 10 });
  const order = state.jobAttempts.map((item) => state.backgroundJobs.find((job) => job.id === item.jobId).type);
  assert.deepEqual(order, ["daily_closing", "daily_interest", "trial_balance", "financial_statements"]);
  assert.equal(state.backgroundJobs.every((item) => item.status === "completed"), true);
});

test("retries use exponential backoff then dead-letter and controlled replay", () => {
  const state = blank();
  registerJobHandler("temp_file_cleanup", () => ({ ok: false, error: "boom" }));
  const created = enqueueJob(state, { type: "temp_file_cleanup", businessKey: "fail", maxAttempts: 2 }, owner, uid, now);
  created.job.maxAttempts = 2;
  tickScheduler(state, { uid, now, user: owner, workerId: "wrk-r", maxJobs: 1 });
  assert.equal(created.job.status, "queued");
  assert.equal(created.job.queue, "retry");
  assert.equal(created.job.correlationId.length > 0, true);
  const later = Date.parse(now) + created.job.backoffMs + 10;
  tickScheduler(state, { uid, now: later, user: owner, workerId: "wrk-r", maxJobs: 1 });
  assert.equal(created.job.status, "dead_letter");
  assert.equal(state.deadLetterQueue.length, 1);
  assert.equal(state.deadLetterQueue[0].correlationId, created.job.correlationId);
  const replay = replayDeadLetter(state, created.job.id, { user: owner, uid, now: later, approved: true });
  assert.equal(replay.ok, true);
  assert.equal(created.job.status, "queued");
  registerJobHandler("temp_file_cleanup");
});

test("non-owner DLQ replay requires maker-checker", () => {
  const state = blank();
  const maker = { id: "u-maker", role: "Accountant", username: "ama", actionPermissions: { "Job.Replay": true, "Job.Approve": true, "Job.View": true } };
  const other = { id: "u-checker", role: "Accountant", username: "kofi", actionPermissions: { "Job.Approve": true, "Job.View": true } };
  registerJobHandler("session_cleanup", () => ({ ok: false, error: "fail" }));
  const created = enqueueJob(state, { type: "session_cleanup", businessKey: "dlq", maxAttempts: 1 }, owner, uid, now);
  tickScheduler(state, { uid, now, user: owner, workerId: "wrk-d", maxJobs: 1 });
  assert.equal(created.job.status, "dead_letter");
  assert.equal(canAction(maker, "Job.Replay"), true);
  const request = replayDeadLetter(state, created.job.id, { user: maker, uid, now, approved: false });
  assert.equal(request.ok, true);
  assert.equal(request.pending, true);
  const sameUser = decideJobApproval(state, request.approval.id, { user: maker, uid, now, approved: true });
  assert.match(sameUser.error, /different users/);
  const granted = decideJobApproval(state, request.approval.id, { user: other, uid, now, approved: true });
  assert.equal(granted.ok, true);
  assert.equal(created.job.status, "queued");
  registerJobHandler("session_cleanup");
});

test("distributed workers cannot execute the same non-parallel job", () => {
  const state = blank();
  enqueueJob(state, { type: "daily_closing", businessKey: "lock" }, owner, uid, now);
  registerWorker(state, { id: "wrk-1", name: "a" }, uid, now);
  registerWorker(state, { id: "wrk-2", name: "b" }, uid, now);
  const job = state.backgroundJobs[0];
  const first = reserveJob(state, job.id, "wrk-1", { uid, now, user: owner, expectedVersion: job.version });
  const second = reserveJob(state, job.id, "wrk-2", { uid, now, user: owner, expectedVersion: job.version });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  const conflict = reserveJob(state, job.id, "wrk-1", { uid, now, user: owner, expectedVersion: 1 });
  assert.match(conflict.error, /version conflict|not found|Invalid job transition/i);
});

test("stale reserved jobs are recovered without duplicate completion", () => {
  const state = blank();
  enqueueJob(state, { type: "audit_retention", businessKey: "crash" }, owner, uid, now);
  registerWorker(state, { id: "wrk-dead", name: "dead" }, uid, now);
  const job = state.backgroundJobs[0];
  reserveJob(state, job.id, "wrk-dead", { uid, now, user: owner });
  assert.equal(job.status, "reserved");
  const recovered = recoverStaleJobs(state, { uid, now: Date.parse(now) + 31000, user: owner });
  assert.equal(recovered.recovered, 1);
  assert.equal(job.status, "queued");
  tickScheduler(state, { uid, now: Date.parse(now) + 32000, user: owner, workerId: "wrk-live", maxJobs: 1 });
  assert.equal(job.status, "completed");
  assert.equal(state.jobAttempts.filter((item) => item.jobId === job.id && item.status === "completed").length, 1);
});

test("blackout and execution windows pause processing", () => {
  const state = blank();
  state.schedulerConfiguration[0].blackoutWindows = [{ from: "2026-09-10T15:00:00.000Z", to: "2026-09-10T17:00:00.000Z" }];
  enqueueJob(state, { type: "cache_refresh", businessKey: "win" }, owner, uid, now);
  const ticked = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-b", maxJobs: 5 });
  assert.equal(ticked.reason, "blackout");
  assert.equal(state.backgroundJobs[0].status, "queued");
  assert.equal(blackoutActive(state.schedulerConfiguration[0], now), true);
  state.schedulerConfiguration[0].blackoutWindows = [];
  state.schedulerConfiguration[0].executionWindow = { from: "2026-09-11T00:00:00.000Z", to: "2026-09-11T23:59:59.000Z" };
  const later = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-b", maxJobs: 5 });
  assert.equal(later.reason, "execution_window");
});

test("cron schedules enqueue once per minute bucket", () => {
  const state = blank();
  scheduleJob(state, { type: "provider_health", cron: "0 16 * * *", frequency: "Daily" }, owner, uid, now);
  const first = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-c", maxJobs: 5 });
  const second = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-c", maxJobs: 5 });
  assert.ok(first.scheduled >= 1);
  assert.equal(second.scheduled, 0);
  assert.equal(state.backgroundJobs.filter((item) => item.type === "provider_health").length, 1);
});

test("horizontal workers share the queue without duplicate execution", () => {
  const state = blank();
  enqueueJob(state, { type: "dormant_account", businessKey: "1" }, owner, uid, now);
  enqueueJob(state, { type: "cache_refresh", businessKey: "2" }, owner, uid, now);
  const a = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-h1", maxJobs: 1 });
  const b = tickScheduler(state, { uid, now, user: owner, workerId: "wrk-h2", maxJobs: 1 });
  assert.equal(a.processed, 1);
  assert.equal(b.processed, 1);
  assert.equal(state.backgroundJobs.filter((item) => item.status === "completed").length, 2);
  assert.equal(new Set(state.jobAttempts.map((item) => item.workerId)).size >= 2, true);
});

test("RBAC, reports, and high-risk replay rules hold", () => {
  const state = blank();
  enqueueJob(state, { type: "cleanup", businessKey: "rbac" }, owner, uid, now);
  tickScheduler(state, { uid, now, user: owner, workerId: "wrk-rbac", maxJobs: 1 });
  assert.equal(canAction({ role: "Auditor" }, "Job.View"), true);
  assert.equal(canAction({ role: "Auditor" }, "Job.Replay"), false);
  assert.equal(canAction(collector, "Job.Run"), false);
  assert.equal(canAction(accountant, "Job.View"), true);
  assert.equal(canAction({ role: "OperationsManager" }, "Job.Run"), true);
  const denied = runJobManually(state, "cleanup", { user: collector, uid, now });
  assert.equal(denied.ok, false);
  const cancelled = cancelJob(state, state.backgroundJobs[0].id, { user: collector, uid, now });
  assert.equal(cancelled.ok, false);
  assert.equal(searchJobs(state, { type: "cleanup" }).length, 1);
  assert.equal(jobDashboard(state).completed >= 1, true);
  const report = jobReports(state, "jobs_history", { from: "2026-09-10", to: "2026-09-10" });
  assert.ok(exportJobCsv(report).includes("cleanup"));
  assert.ok(jobDetail(state, state.backgroundJobs[0].id).history.length >= 1);
  assert.equal(canPerformOffline(state, "job.replay", { online: false }).ok, false);
});
