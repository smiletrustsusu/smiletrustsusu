/**
 * Module 18 — Background Jobs, Queue Management & Scheduler Engine.
 * Central async orchestration. Does not post collections, interest, or ledgers.
 * Existing payment, document, sync, and notification queues remain the workers.
 * No REST/GraphQL.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { acquireAggregateLock, releaseAggregateLock } from "./identifiers.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { canPerformOffline, processSyncQueue } from "./sync-ops.js";
import { processPaymentQueue } from "./payment-ops.js";
import { processDocumentQueue } from "./document-ops.js";
import { queueNotification } from "./notifications.js";
import { getConfigValue, isFeatureEnabled } from "./system-config.js";
import {
  JOB_STATES,
  JOB_TRANSITION_MATRIX,
  QUEUE_TYPES,
  JOB_PRIORITIES,
  PRIORITY_RANK,
  QUEUE_OWNERS,
  QUEUE_BACKUP_OWNERS,
  WORKER_STATES,
  RETRY_STRATEGIES,
  CRITICAL_JOB_CATEGORIES,
  APPROVAL_REQUIRED_ACTIONS,
  canTransitionJob,
  isTerminalJobStatus,
  isCriticalJob,
  nextRetryDelayMs,
  dependenciesSatisfied,
  healthScore,
  blackoutActive,
  inExecutionWindow,
  cronMatches
} from "./job-lifecycle.js";

export {
  JOB_STATES,
  JOB_TRANSITION_MATRIX,
  QUEUE_TYPES,
  JOB_PRIORITIES,
  QUEUE_OWNERS,
  QUEUE_BACKUP_OWNERS,
  WORKER_STATES,
  RETRY_STRATEGIES,
  CRITICAL_JOB_CATEGORIES,
  canTransitionJob,
  isTerminalJobStatus,
  isCriticalJob,
  nextRetryDelayMs,
  healthScore,
  cronMatches
};

export const JOB_SCHEMA_VERSION = "1.0.0";

const JOB_ARRAYS = [
  "backgroundJobs",
  "jobDefinitions",
  "jobSchedules",
  "jobQueue",
  "jobAttempts",
  "jobDependencies",
  "workerNodes",
  "workerHeartbeats",
  "deadLetterQueue",
  "jobActivityLogs",
  "schedulerConfiguration",
  "jobLocks",
  "jobApprovals",
  "jobStatusHistory"
];

const HANDLERS = new Map();

export function registerJobHandler(type, fn) {
  if (typeof fn !== "function") HANDLERS.delete(type);
  else HANDLERS.set(type, fn);
}

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

function seedDefinitions() {
  return [
    { id: "job-daily-interest", type: "daily_interest", category: "financial", label: "Daily Interest Posting", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 2000 },
    { id: "job-monthly-interest", type: "monthly_interest", category: "financial", label: "Monthly Interest Posting", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 2000 },
    { id: "job-penalty", type: "penalty_calculation", category: "financial", label: "Penalty Calculation", priority: "normal", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 2000 },
    { id: "job-loan-schedule", type: "loan_schedule", category: "financial", label: "Loan Schedule Generation", priority: "normal", queue: "scheduled", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 1500 },
    { id: "job-loan-overdue", type: "loan_overdue", category: "financial", label: "Loan Overdue Processing", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 4, strategy: "exponential", backoffMs: 2000 },
    { id: "job-dormant", type: "dormant_account", category: "financial", label: "Dormant Account Detection", priority: "low", queue: "scheduled", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 5000 },
    { id: "job-fd-maturity", type: "fixed_deposit_maturity", category: "financial", label: "Fixed Deposit Maturity", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 4, strategy: "exponential", backoffMs: 2000 },
    { id: "job-daily-closing", type: "daily_closing", category: "accounting", label: "Daily Closing", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 3000 },
    { id: "job-month-close", type: "month_end_closing", category: "accounting", label: "Month-End Closing", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 5000 },
    { id: "job-year-close", type: "year_end_closing", category: "accounting", label: "Year-End Closing", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-ledger-balance", type: "ledger_balancing", category: "accounting", label: "Ledger Balancing", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 3000 },
    { id: "job-trial-balance", type: "trial_balance", category: "accounting", label: "Trial Balance Generation", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 3000 },
    { id: "job-fin-statements", type: "financial_statements", category: "accounting", label: "Financial Statement Preparation", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 3000 },
    { id: "job-payment-retry", type: "payment_retry", category: "payment", label: "Payment Retry", priority: "critical", queue: "retry", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-settlement", type: "settlement_reconciliation", category: "payment", label: "Settlement Reconciliation", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 4, strategy: "exponential", backoffMs: 2000 },
    { id: "job-callback-retry", type: "callback_retry", category: "payment", label: "Callback Retry", priority: "critical", queue: "retry", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-provider-health", type: "provider_health", category: "payment", label: "Provider Health Checks", priority: "high", queue: "scheduled", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-failed-pay", type: "failed_payment_recovery", category: "payment", label: "Failed Payment Recovery", priority: "critical", queue: "retry", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 1500 },
    { id: "job-sms", type: "sms_queue", category: "notification", label: "SMS Queue", priority: "normal", queue: "immediate", parallel: true, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-whatsapp", type: "whatsapp_queue", category: "notification", label: "WhatsApp Queue", priority: "normal", queue: "immediate", parallel: true, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-email", type: "email_queue", category: "notification", label: "Email Queue", priority: "low", queue: "immediate", parallel: true, maxAttempts: 5, strategy: "exponential", backoffMs: 1500 },
    { id: "job-push", type: "push_queue", category: "notification", label: "Push Notification Queue", priority: "normal", queue: "immediate", parallel: true, maxAttempts: 4, strategy: "fixed", backoffMs: 1000 },
    { id: "job-notify-retry", type: "notification_retry", category: "notification", label: "Notification Retry Queue", priority: "normal", queue: "retry", parallel: true, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-offline-up", type: "offline_upload", category: "synchronization", label: "Offline Upload Queue", priority: "critical", queue: "immediate", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-offline-down", type: "offline_download", category: "synchronization", label: "Offline Download Queue", priority: "high", queue: "immediate", parallel: false, maxAttempts: 4, strategy: "exponential", backoffMs: 1000 },
    { id: "job-conflict-retry", type: "conflict_retry", category: "synchronization", label: "Conflict Retry", priority: "critical", queue: "retry", parallel: false, maxAttempts: 4, strategy: "exponential", backoffMs: 2000 },
    { id: "job-device-sync", type: "device_sync", category: "synchronization", label: "Device Synchronization", priority: "critical", queue: "immediate", parallel: false, maxAttempts: 5, strategy: "exponential", backoffMs: 1000 },
    { id: "job-cache", type: "cache_refresh", category: "synchronization", label: "Cache Refresh", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 5000 },
    { id: "job-statements", type: "statement_generation", category: "document", label: "Statement Generation", priority: "normal", queue: "batch", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-bulk-receipt", type: "bulk_receipt", category: "document", label: "Bulk Receipt Generation", priority: "normal", queue: "batch", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-pdf", type: "pdf_generation", category: "document", label: "PDF Generation", priority: "low", queue: "batch", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-doc-archive", type: "archive_processing", category: "document", label: "Archive Processing", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-qr", type: "qr_update", category: "document", label: "QR Verification Updates", priority: "low", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 4000 },
    { id: "job-backup", type: "backup", category: "administrative", label: "Backup Scheduling", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 4000 },
    { id: "job-cleanup", type: "cleanup", category: "administrative", label: "Cleanup", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-archive-exp", type: "archive_expiration", category: "administrative", label: "Archive Expiration", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-session", type: "session_cleanup", category: "administrative", label: "Session Cleanup", priority: "low", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 5000 },
    { id: "job-audit-ret", type: "audit_retention", category: "audit", label: "Audit Retention", priority: "critical", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 4000 },
    { id: "job-temp-clean", type: "temp_file_cleanup", category: "administrative", label: "Temporary File Cleanup", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-report-sched", type: "report_schedule", category: "administrative", label: "Scheduled Reports", priority: "normal", queue: "scheduled", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-workflow-sla", type: "workflow_sla_tick", category: "administrative", label: "Workflow SLA Tick", priority: "high", queue: "scheduled", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-exchange-import", type: "exchange_import", category: "administrative", label: "Data Exchange Import", priority: "normal", queue: "batch", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 2000 },
    { id: "job-exchange-export", type: "exchange_export", category: "administrative", label: "Data Exchange Export", priority: "normal", queue: "batch", parallel: false, maxAttempts: 3, strategy: "exponential", backoffMs: 2000 },
    { id: "job-exchange-migrate", type: "exchange_migrate", category: "administrative", label: "Data Exchange Migration", priority: "high", queue: "batch", parallel: false, maxAttempts: 2, strategy: "fixed", backoffMs: 4000 },
    { id: "job-exchange-bulk", type: "exchange_bulk", category: "administrative", label: "Data Exchange Bulk", priority: "normal", queue: "batch", parallel: true, maxAttempts: 3, strategy: "fixed", backoffMs: 2000 },
    { id: "job-records-retention", type: "records_retention_tick", category: "administrative", label: "Digital Records Retention", priority: "normal", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "fixed", backoffMs: 4000 },
    { id: "job-records-archive", type: "records_archive_tick", category: "administrative", label: "Digital Records Archive", priority: "background", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 },
    { id: "job-bi-kpi-refresh", type: "bi_kpi_refresh", category: "administrative", label: "Enterprise BI KPI Refresh", priority: "normal", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 5000 },
    { id: "job-ai-drift-scan", type: "ai_drift_scan", category: "administrative", label: "Enterprise AI Drift Scan", priority: "normal", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 5000 },
    { id: "job-ai-fraud-scan", type: "ai_fraud_scan", category: "administrative", label: "Enterprise AI Fraud Scan", priority: "high", queue: "scheduled", parallel: true, maxAttempts: 2, strategy: "fixed", backoffMs: 5000 }
  ];
}

function seedDependencies() {
  return [
    { id: "dep-close-interest", jobType: "daily_interest", dependsOnType: "daily_closing" },
    { id: "dep-interest-tb", jobType: "trial_balance", dependsOnType: "daily_interest" },
    { id: "dep-tb-fs", jobType: "financial_statements", dependsOnType: "trial_balance" }
  ];
}

function defaultHandler(type) {
  if (["payment_retry", "callback_retry", "failed_payment_recovery", "provider_health"].includes(type)) {
    return (state, job, ctx) => processPaymentQueue(state, { uid: ctx.uid, now: ctx.now, user: ctx.user });
  }
  if (["statement_generation", "bulk_receipt", "pdf_generation", "archive_processing", "qr_update"].includes(type)) {
    return (state, job, ctx) => processDocumentQueue(state, { uid: ctx.uid, now: ctx.now, user: ctx.user });
  }
  if (["offline_upload", "offline_download", "conflict_retry", "device_sync"].includes(type)) {
    return (state, job, ctx) => {
      if (typeof ctx.applyFn !== "function") return { ok: true, delegated: true, skipped: !(state.offlineQueue || []).length };
      return processSyncQueue(state, ctx.applyFn, { deviceId: ctx.deviceId, user: ctx.user, uid: ctx.uid, now: ctx.now });
    };
  }
  return () => ({ ok: true, orchestrated: true });
}

export function ensureJobState(state = {}) {
  JOB_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.jobDefinitions.length) state.jobDefinitions = seedDefinitions();
  else {
    seedDefinitions().forEach((def) => {
      if (!state.jobDefinitions.some((item) => item.type === def.type)) state.jobDefinitions.push(def);
    });
  }
  if (!state.jobDependencies.length) state.jobDependencies = seedDependencies();
  if (!state.schedulerConfiguration.length) {
    state.schedulerConfiguration.push({
      id: "sched-default",
      encryptedPayloads: state.settings?.encryptOfflineQueue !== false,
      staleLockMs: 30000,
      heartbeatMs: 15000,
      blackoutWindows: [],
      executionWindow: null,
      autoFailover: true
    });
  }
  return state;
}

function definitionFor(state, type) {
  return (state.jobDefinitions || []).find((item) => item.type === type || item.id === type);
}

function jobById(state, id) {
  return (state.backgroundJobs || []).find((item) => item.id === id);
}

function configOf(state) {
  const row = (state.schedulerConfiguration || [])[0] || {};
  return {
    ...row,
    staleLockMs: Number(getConfigValue(state, "job.staleLockMs") ?? row.staleLockMs ?? 30000),
    heartbeatMs: Number(getConfigValue(state, "job.heartbeatMs") ?? row.heartbeatMs ?? 15000),
    maxJobsPerTick: Number(getConfigValue(state, "job.maxJobsPerTick") ?? row.maxJobsPerTick ?? 10)
  };
}

function auditJob(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "18",
    ...extras
  }, uid);
}

function logActivity(state, action, details, extras = {}, uid) {
  state.jobActivityLogs.push({
    id: newId("jal", uid),
    action,
    details,
    userId: extras.userId || "",
    createdAt: nowIso(extras.now)
  });
}

export function transitionJob(state, job, nextStatus, { uid, now, user, reason = "", actor = "Scheduler Engine" } = {}) {
  if (!job) return { ok: false, error: "Job not found" };
  ensureJobState(state);
  const from = job.status;
  const to = nextStatus;
  if (from === to) return { ok: true, job, noop: true };
  if (!canTransitionJob(from, to)) return { ok: false, error: `Invalid job transition: ${from} → ${to}` };
  const timestamp = nowIso(now);
  job.status = to;
  job.version = Number(job.version || 1) + 1;
  job.updatedAt = timestamp;
  const history = {
    id: newId("jsh", uid),
    jobId: job.id,
    previousState: from,
    newState: to,
    timestamp,
    actor,
    userId: user?.id || "",
    reason
  };
  job.statusHistory = [...(job.statusHistory || []), { previousState: from, newState: to, timestamp, reason }];
  state.jobStatusHistory.push(history);
  const queue = (state.jobQueue || []).find((item) => item.jobId === job.id);
  if (queue) queue.status = to;
  return { ok: true, job, from, to, history };
}

export function registerWorker(state, worker = {}, uid, now) {
  ensureJobState(state);
  const existing = (state.workerNodes || []).find((item) => item.id && item.id === worker.id)
    || (!worker.id ? (state.workerNodes || []).find((item) => item.name === worker.name) : null);
  const row = existing || {
    id: worker.id || newId("wrk", uid),
    name: worker.name || "local-worker",
    status: "registered",
    hostname: worker.hostname || "local",
    createdAt: nowIso(now)
  };
  if (!existing) state.workerNodes.push(row);
  row.status = "healthy";
  row.lastHeartbeatAt = nowIso(now);
  beatWorker(state, row.id, uid, now);
  return { ok: true, worker: row };
}

export function beatWorker(state, workerId, uid, now) {
  ensureJobState(state);
  const worker = (state.workerNodes || []).find((item) => item.id === workerId);
  if (!worker) return { ok: false, error: "Unknown worker" };
  worker.lastHeartbeatAt = nowIso(now);
  worker.status = worker.status === "draining" ? "draining" : "healthy";
  state.workerHeartbeats.push({
    id: newId("whb", uid),
    workerId,
    createdAt: nowIso(now)
  });
  return { ok: true, worker };
}

export function drainWorker(state, workerId, now) {
  const worker = (state.workerNodes || []).find((item) => item.id === workerId);
  if (!worker) return { ok: false, error: "Unknown worker" };
  worker.status = "draining";
  worker.updatedAt = nowIso(now);
  return { ok: true, worker };
}

export function detectStaleWorkers(state, now) {
  ensureJobState(state);
  const ts = nowMs(now);
  const staleMs = Number(configOf(state).heartbeatMs || 15000) * 3;
  (state.workerNodes || []).forEach((worker) => {
    const last = Date.parse(worker.lastHeartbeatAt || 0);
    if (worker.status !== "offline" && (!last || ts - last > staleMs)) {
      worker.status = "unhealthy";
    }
    if (worker.status === "unhealthy" && last && ts - last > staleMs * 2) {
      worker.status = "offline";
    }
  });
  return (state.workerNodes || []).filter((item) => item.status === "unhealthy" || item.status === "offline");
}

export function enqueueJob(state, request = {}, user, uid, now) {
  now = nowMs(now);
  ensureJobState(state);
  const definition = definitionFor(state, request.type);
  if (!definition) return { ok: false, error: "Unknown job type" };
  const idempotencyKey = request.idempotencyKey || `job:${definition.type}:${request.businessKey || request.scheduledFor || "once"}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey,
    operationType: "job.enqueue",
    fingerprint: { operationType: "job.enqueue", type: definition.type, businessKey: request.businessKey || "" },
    source: "scheduler-engine",
    userId: user?.id || "",
    now
  }, uid);
  if (gate.duplicate) {
    const existing = jobById(state, gate.record?.transactionId) || (state.backgroundJobs || []).find((item) => item.idempotencyKey === idempotencyKey);
    return { ok: true, duplicate: true, job: existing };
  }
  if (!gate.proceed) return { ok: false, error: gate.error || "Job is already queued" };

  const availableAt = request.availableAt || request.runAt || nowIso(now);
  const job = {
    id: newId("job", uid),
    type: definition.type,
    definitionId: definition.id,
    category: definition.category,
    priority: request.priority || definition.priority || "normal",
    queue: request.queue || definition.queue || "immediate",
    status: "created",
    version: 1,
    payload: request.payload || {},
    correlationId: request.correlationId || newId("jobcorr", uid),
    idempotencyKey,
    businessKey: request.businessKey || "",
    availableAt,
    attempts: 0,
    maxAttempts: Number(request.maxAttempts || definition.maxAttempts || 3),
    retryStrategy: definition.strategy || "exponential",
    backoffMs: definition.backoffMs || 1000,
    parallel: definition.parallel === true,
    workerId: "",
    checkpoint: null,
    lastError: "",
    dependsOn: request.dependsOn || [],
    createdBy: user?.id || "",
    createdAt: nowIso(now),
    statusHistory: []
  };
  state.backgroundJobs.push(job);
  const queued = transitionJob(state, job, "queued", { uid, now, user, reason: "enqueued" });
  if (!queued.ok) {
    failIdempotentRequest(state, idempotencyKey, { recoverable: false, error: queued.error, now });
    return queued;
  }
  state.jobQueue.push({
    id: newId("jq", uid),
    jobId: job.id,
    queue: job.queue,
    priority: job.priority,
    status: "queued",
    owner: QUEUE_OWNERS[job.queue] || "Scheduler Engine",
    availableAt,
    createdAt: nowIso(now)
  });
  (job.dependsOn || []).forEach((depId) => {
    if (!(state.jobDependencies || []).some((item) => item.jobId === job.id && item.dependsOnJobId === depId)) {
      state.jobDependencies.push({
        id: newId("jdep", uid),
        jobId: job.id,
        jobType: job.type,
        dependsOnJobId: depId,
        dependsOnType: ""
      });
    }
  });
  completeIdempotentRequest(state, idempotencyKey, {
    transactionId: job.id,
    responsePayload: { jobId: job.id, status: job.status }
  }, { source: "scheduler-engine", now });
  auditJob(state, "Job queued", `${job.type} · ${job.priority}`, user, { entityId: job.id, correlationId: job.correlationId }, uid);
  logActivity(state, "Job queued", job.type, { userId: user?.id, now }, uid);
  return { ok: true, job };
}

export function scheduleJob(state, request = {}, user, uid, now) {
  ensureJobState(state);
  if (user && !canAction(user, "Job.Schedule") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot schedule jobs" };
  }
  const definition = definitionFor(state, request.type);
  if (!definition) return { ok: false, error: "Unknown job type" };
  const row = {
    id: newId("jsch", uid),
    type: definition.type,
    cron: request.cron || "",
    frequency: request.frequency || "Daily",
    calendar: request.calendar || "",
    nextRunAt: request.nextRunAt || nowIso(now),
    active: request.active !== false,
    payload: request.payload || {},
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.jobSchedules.push(row);
  auditJob(state, "Job schedule created", definition.type, user, { entityId: row.id }, uid);
  return { ok: true, schedule: row };
}

export function enqueueDueSchedules(state, { user, uid, now } = {}) {
  ensureJobState(state);
  const ts = nowIso(now);
  let created = 0;
  (state.jobSchedules || []).forEach((schedule) => {
    if (!schedule.active) return;
    if (schedule.cron) {
      if (!cronMatches(schedule.cron, nowMs(now))) return;
      const bucket = new Date(nowMs(now));
      bucket.setUTCSeconds(0, 0);
      bucket.setUTCMilliseconds(0);
      if (schedule.lastRunAt && Date.parse(schedule.lastRunAt) >= bucket.getTime()) return;
    } else if (String(schedule.nextRunAt || "") > ts) {
      return;
    }
    const slot = schedule.cron ? ts : schedule.nextRunAt;
    const result = enqueueJob(state, {
      type: schedule.type,
      payload: schedule.payload,
      businessKey: `${schedule.id}:${slot}`,
      idempotencyKey: `job:${schedule.type}:${schedule.id}:${slot}`,
      correlationId: schedule.id
    }, user, uid, now);
    if (result.ok) created += 1;
    const days = { Hourly: 0, Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Annual: 365, "One-Time": 0 }[schedule.frequency] || 1;
    if (schedule.frequency === "One-Time" || schedule.cron === "once") schedule.active = false;
    else if (!schedule.cron) {
      const next = new Date(schedule.nextRunAt);
      if (schedule.frequency === "Hourly") next.setHours(next.getHours() + 1);
      else next.setDate(next.getDate() + days);
      schedule.nextRunAt = next.toISOString();
    }
    schedule.lastRunAt = ts;
  });
  return { ok: true, created };
}

function typePrerequisites(state, job) {
  const typeDeps = (state.jobDependencies || []).filter((item) => item.jobType === job.type && item.dependsOnType && !item.dependsOnJobId);
  if (!typeDeps.length) return { ok: true };
  const blocked = typeDeps.filter((dep) => {
    const required = (state.backgroundJobs || []).filter((item) => item.type === dep.dependsOnType);
    if (!required.length) return false;
    return required.every((item) => item.status !== "completed");
  });
  return blocked.length ? { ok: false, blocked: blocked.map((item) => item.dependsOnType) } : { ok: true };
}

function jobReady(state, job, now) {
  if (job.status !== "queued") return false;
  if (job.availableAt && Date.parse(job.availableAt) > nowMs(now)) return false;
  const instanceDeps = (state.jobDependencies || []).filter((item) => item.jobId === job.id && item.dependsOnJobId).map((item) => item.dependsOnJobId);
  const allDeps = [...new Set([...(job.dependsOn || []), ...instanceDeps])];
  const graph = dependenciesSatisfied(state.backgroundJobs, allDeps);
  if (!graph.ok) return false;
  return typePrerequisites(state, job).ok;
}

function pickNextJob(state, now, skip = new Set()) {
  const ready = (state.backgroundJobs || [])
    .filter((job) => !skip.has(job.id) && jobReady(state, job, now))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const criticalReady = ready.filter((job) => isCriticalJob(definitionFor(state, job.type) || job));
  return (criticalReady[0] || ready[0]) || null;
}

export function recoverStaleJobs(state, { uid, now, user } = {}) {
  ensureJobState(state);
  const ts = nowMs(now);
  const staleMs = Number(configOf(state).staleLockMs || 30000);
  let recovered = 0;
  (state.backgroundJobs || []).forEach((job) => {
    if (!["reserved", "running"].includes(job.status)) return;
    const lockAge = ts - Date.parse(job.reservedAt || job.startedAt || 0);
    if (lockAge <= staleMs) return;
    const moved = transitionJob(state, job, "queued", { uid, now, user, reason: "crash_recovery", actor: "Job Recovery Service" });
    if (moved.ok) {
      const holder = job.workerId;
      if (!job.parallel) releaseAggregateLock(state, "JOB", job.type, holder);
      job.workerId = "";
      recovered += 1;
      auditJob(state, "Job recovered after crash", job.id, user, { entityId: job.id, correlationId: job.correlationId }, uid);
    }
  });
  return { ok: true, recovered };
}

export function reserveJob(state, jobId, workerId, { uid, now, user, expectedVersion } = {}) {
  ensureJobState(state);
  const job = jobById(state, jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (expectedVersion != null && Number(job.version) !== Number(expectedVersion)) {
    return { ok: false, error: "Job version conflict" };
  }
  const worker = (state.workerNodes || []).find((item) => item.id === workerId);
  if (!worker || worker.status === "offline" || worker.status === "draining") {
    return { ok: false, error: "Worker is not eligible to reserve jobs" };
  }
  if (!job.parallel) {
    const lock = acquireAggregateLock(state, "JOB", job.type, workerId, { ttlMs: Number(configOf(state).staleLockMs || 30000), now: nowMs(now) });
    if (lock.error) return { ok: false, error: lock.error };
  }
  const reserved = transitionJob(state, job, "reserved", { uid, now, user, reason: "reserved" });
  if (!reserved.ok) {
    if (!job.parallel) releaseAggregateLock(state, "JOB", job.type, workerId);
    return reserved;
  }
  job.workerId = workerId;
  job.reservedAt = nowIso(now);
  return { ok: true, job };
}

export function runJob(state, jobId, { uid, now, user, applyFn, deviceId } = {}) {
  ensureJobState(state);
  const job = jobById(state, jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (!inExecutionWindow(configOf(state), now)) {
    return { ok: false, error: "Outside the configured execution window" };
  }
  const started = transitionJob(state, job, "running", { uid, now, user, reason: "started" });
  if (!started.ok) return started;
  job.startedAt = nowIso(now);
  job.attempts = Number(job.attempts || 0) + 1;
  const attempt = {
    id: newId("jat", uid),
    jobId: job.id,
    attempt: job.attempts,
    workerId: job.workerId,
    startedAt: job.startedAt,
    status: "running"
  };
  state.jobAttempts.push(attempt);
  const handler = HANDLERS.get(job.type) || defaultHandler(job.type);
  let result;
  try {
    result = handler(state, job, { uid, now, user, applyFn, deviceId }) || { ok: true };
  } catch (error) {
    result = { ok: false, error: error.message || "Job handler failed" };
  }
  attempt.endedAt = nowIso(now);
  attempt.error = result.error || "";
  if (result.ok !== false) {
    const completed = transitionJob(state, job, "completed", { uid, now, user, reason: "completed" });
    if (!completed.ok) return completed;
    job.completedAt = nowIso(now);
    job.checkpoint = result.checkpoint || job.checkpoint;
    attempt.status = "completed";
    if (!job.parallel) releaseAggregateLock(state, "JOB", job.type, job.workerId);
    auditJob(state, "Job completed", job.type, user, { entityId: job.id, correlationId: job.correlationId }, uid);
    return { ok: true, job, result };
  }
  attempt.status = "failed";
  job.lastError = result.error || "Job failed";
  const failed = transitionJob(state, job, "failed", { uid, now, user, reason: job.lastError });
  if (!failed.ok) return failed;
  if (job.attempts >= job.maxAttempts) {
    const dead = transitionJob(state, job, "dead_letter", { uid, now, user, reason: "retry_exhausted" });
    if (dead.ok) moveToDeadLetter(state, job, uid, now, user);
    if (!job.parallel) releaseAggregateLock(state, "JOB", job.type, job.workerId);
    return { ok: false, error: job.lastError, job, deadLetter: true };
  }
  const delay = nextRetryDelayMs({ strategy: job.retryStrategy, backoffMs: job.backoffMs }, job.attempts);
  job.availableAt = new Date(nowMs(now) + (Number.isFinite(delay) ? delay : 60000)).toISOString();
  job.queue = "retry";
  const requeued = transitionJob(state, job, "queued", { uid, now, user, reason: "automatic_retry" });
  if (!job.parallel) releaseAggregateLock(state, "JOB", job.type, job.workerId);
  auditJob(state, "Job retry scheduled", `${job.type} · attempt ${job.attempts}`, user, { entityId: job.id, correlationId: job.correlationId }, uid);
  return { ok: false, error: job.lastError, job, retry: requeued.ok, delay };
}

function moveToDeadLetter(state, job, uid, now, user) {
  const row = {
    id: newId("dlq", uid),
    jobId: job.id,
    type: job.type,
    payload: job.payload,
    failureReason: job.lastError,
    retryHistory: (state.jobAttempts || []).filter((item) => item.jobId === job.id),
    correlationId: job.correlationId,
    idempotencyKey: job.idempotencyKey,
    queueHistory: job.statusHistory || [],
    createdAt: nowIso(now)
  };
  state.deadLetterQueue.push(row);
  auditJob(state, "Job moved to dead letter", job.type, user, { entityId: job.id, correlationId: job.correlationId, category: "operational" }, uid);
  queueNotification(state, {
    event: "sync_failed",
    channel: "In-App",
    userId: user?.id || "",
    vars: { name: job.type, amount: "0.00", receiptNo: job.id },
    uid,
    idempotencyKey: `${job.id}:dlq`,
    correlationId: job.correlationId,
    committed: true
  });
  return row;
}

export function tickScheduler(state, { uid, now, user, workerId, applyFn, deviceId, maxJobs } = {}) {
  now = nowMs(now);
  ensureJobState(state);
  if (isFeatureEnabled(state, "enableJobEngine") === false) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  detectStaleWorkers(state, now);
  const recovered = recoverStaleJobs(state, { uid, now, user });
  if (blackoutActive(configOf(state), now)) {
    return { ok: true, skipped: true, reason: "blackout", recovered: recovered.recovered, processed: 0 };
  }
  if (!inExecutionWindow(configOf(state), now)) {
    return { ok: true, skipped: true, reason: "execution_window", recovered: recovered.recovered, processed: 0 };
  }
  const due = enqueueDueSchedules(state, { uid, now, user });
  let worker = (state.workerNodes || []).find((item) => item.id === workerId);
  if (!worker) {
    worker = registerWorker(state, { id: workerId || "wrk-local", name: workerId || "local-worker" }, uid, now).worker;
  } else {
    beatWorker(state, worker.id, uid, now);
  }
  if (worker.status === "draining" || worker.status === "offline") {
    return { ok: true, processed: 0, recovered: recovered.recovered, scheduled: due.created, draining: true };
  }
  const limit = Number(maxJobs || configOf(state).maxJobsPerTick || 10);
  let processed = 0;
  const results = [];
  const skip = new Set();
  while (processed < limit) {
    const next = pickNextJob(state, now, skip);
    if (!next) break;
    const reserved = reserveJob(state, next.id, worker.id, { uid, now, user, expectedVersion: next.version });
    if (!reserved.ok) {
      skip.add(next.id);
      continue;
    }
    const ran = runJob(state, next.id, { uid, now, user, applyFn, deviceId });
    results.push(ran);
    processed += 1;
  }
  return { ok: true, processed, recovered: recovered.recovered, scheduled: due.created, results };
}

export function cancelJob(state, jobId, { user, uid, now, reason = "" } = {}) {
  ensureJobState(state);
  const job = jobById(state, jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (user && !canAction(user, "Job.Cancel") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot cancel jobs" };
  }
  if (job.status === "running") {
    return requestJobApproval(state, jobId, "cancel_running", { user, uid, now, reason });
  }
  const moved = transitionJob(state, job, "cancelled", { uid, now, user, reason: reason || "cancelled" });
  if (moved.ok && !job.parallel) releaseAggregateLock(state, "JOB", job.type, job.workerId);
  return moved;
}

export function expireJob(state, jobId, extras = {}) {
  const job = jobById(state, jobId);
  if (!job) return { ok: false, error: "Job not found" };
  return transitionJob(state, job, "expired", extras);
}

export function requestJobApproval(state, jobId, action, { user, uid, now, reason = "" } = {}) {
  ensureJobState(state);
  if (!APPROVAL_REQUIRED_ACTIONS.includes(action) && action !== "manual_run") {
    return { ok: false, error: "Unknown approval action" };
  }
  if (!user || (!canAction(user, "Job.Approve") && !canAction(user, "Job.Replay") && !isSystemOwner(user))) {
    return { ok: false, error: "You cannot request this job action" };
  }
  const row = {
    id: newId("jap", uid),
    jobId,
    action,
    makerId: user.id,
    checkerId: "",
    status: "pending",
    reason,
    createdAt: nowIso(now)
  };
  state.jobApprovals.push(row);
  auditJob(state, "Job approval requested", `${action} · ${jobId}`, user, { entityId: row.id }, uid);
  return { ok: true, pending: true, approval: row };
}

export function decideJobApproval(state, approvalId, { user, uid, now, approved = true, reason = "" } = {}) {
  ensureJobState(state);
  const row = (state.jobApprovals || []).find((item) => item.id === approvalId);
  if (!row) return { ok: false, error: "Approval request not found" };
  if (row.status !== "pending") return { ok: false, error: "Approval is no longer pending" };
  if (!user) return { ok: false, error: "Checker is required" };
  if (row.makerId === user.id) return { ok: false, error: "Maker and checker must be different users" };
  if (!canAction(user, "Job.Approve") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot approve job actions" };
  }
  row.checkerId = user.id;
  row.decidedAt = nowIso(now);
  row.decisionReason = reason;
  if (!approved) {
    row.status = "rejected";
    auditJob(state, "Job approval rejected", row.action, user, { entityId: row.id }, uid);
    return { ok: true, approval: row, rejected: true };
  }
  row.status = "approved";
  let executed = { ok: true };
  if (row.action === "replay") executed = replayDeadLetter(state, row.jobId, { user, uid, now, approved: true });
  if (row.action === "cancel_running") {
    const job = jobById(state, row.jobId);
    if (job) executed = transitionJob(state, job, "cancelled", { uid, now, user, reason: reason || "approved_cancel" });
  }
  if (row.action === "manual_run" || row.action === "manual_financial" || row.action === "manual_accounting") {
    const job = jobById(state, row.jobId);
    if (job && job.status === "queued") executed = { ok: true, job };
  }
  auditJob(state, "Job approval granted", row.action, user, { entityId: row.id }, uid);
  return { ...executed, approval: row };
}

export function replayDeadLetter(state, jobId, { user, uid, now, approved = false } = {}) {
  ensureJobState(state);
  const job = jobById(state, jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status !== "dead_letter") return { ok: false, error: "Only dead-letter jobs can be replayed" };
  if (approved) {
    if (user && !canAction(user, "Job.Approve") && !isSystemOwner(user)) {
      return { ok: false, error: "You cannot approve a dead-letter replay" };
    }
  } else if (user && !canAction(user, "Job.Replay") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot replay dead-letter jobs" };
  }
  const offline = canPerformOffline(state, "job.replay", { online: true });
  if (!offline.ok) return offline;
  if (!approved && !isSystemOwner(user)) {
    return requestJobApproval(state, jobId, "replay", { user, uid, now, reason: "dlq_replay" });
  }
  const moved = transitionJob(state, job, "queued", { uid, now, user, reason: "dlq_replay" });
  if (!moved.ok) return moved;
  job.availableAt = nowIso(now);
  job.queue = "retry";
  job.lastError = "";
  auditJob(state, "Dead letter job replayed", job.type, user, { entityId: job.id, correlationId: job.correlationId }, uid);
  return { ok: true, job };
}

export function runJobManually(state, type, { user, uid, now, payload = {}, approved = false } = {}) {
  ensureJobState(state);
  if (user && !canAction(user, "Job.Run") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot run jobs manually" };
  }
  const definition = definitionFor(state, type);
  if (!definition) return { ok: false, error: "Unknown job type" };
  if (isCriticalJob(definition) && !approved && !isSystemOwner(user)) {
    const enqueued = enqueueJob(state, { type, payload, businessKey: `manual:${nowIso(now)}` }, user, uid, now);
    if (!enqueued.ok) return enqueued;
    return requestJobApproval(state, enqueued.job.id, definition.category === "accounting" ? "manual_accounting" : "manual_financial", { user, uid, now, reason: "manual_run" });
  }
  return enqueueJob(state, { type, payload, businessKey: `manual:${Date.now()}` }, user, uid, now);
}

export function searchJobs(state, query = {}) {
  ensureJobState(state);
  const q = String(query.q || "").trim().toLowerCase();
  return (state.backgroundJobs || []).filter((item) => {
    if (query.status && item.status !== query.status) return false;
    if (query.type && item.type !== query.type) return false;
    if (query.priority && item.priority !== query.priority) return false;
    if (query.queue && item.queue !== query.queue) return false;
    if (!q) return true;
    return [item.id, item.type, item.correlationId, item.idempotencyKey, item.lastError].join(" ").toLowerCase().includes(q);
  });
}

export function jobDashboard(state) {
  ensureJobState(state);
  const jobs = state.backgroundJobs || [];
  const queued = jobs.filter((item) => item.status === "queued").length;
  const running = jobs.filter((item) => item.status === "running" || item.status === "reserved").length;
  const failed = jobs.filter((item) => item.status === "failed").length;
  const completed = jobs.filter((item) => item.status === "completed").length;
  const dlq = (state.deadLetterQueue || []).length;
  const attempts = state.jobAttempts || [];
  const retries = attempts.filter((item) => item.attempt > 1).length;
  const health = healthScore({
    failureRate: jobs.length ? failed / jobs.length : 0,
    retryRate: attempts.length ? retries / attempts.length : 0,
    dlqSize: dlq,
    staleWorkers: (state.workerNodes || []).filter((item) => item.status === "unhealthy" || item.status === "offline").length,
    queueDepth: queued
  });
  return {
    queued,
    running,
    failed,
    completed,
    dlq,
    workers: (state.workerNodes || []).filter((item) => item.status === "healthy").length,
    schedules: (state.jobSchedules || []).filter((item) => item.active).length,
    health: health.status,
    score: health.score
  };
}

export function jobReports(state, reportId, range = {}) {
  ensureJobState(state);
  const from = range.from || "0000-01-01";
  const to = range.to || "9999-12-31";
  const inRange = (row) => {
    const day = String(row.createdAt || row.startedAt || "").slice(0, 10);
    return day >= from && day <= to;
  };
  const table = (columns, rows) => ({ columns, rows, reportId });
  if (reportId === "jobs_queued") return table(["createdAt", "type", "priority", "status"], (state.backgroundJobs || []).filter((item) => item.status === "queued"));
  if (reportId === "jobs_failed") return table(["createdAt", "type", "lastError"], (state.backgroundJobs || []).filter((item) => item.status === "failed" || item.status === "dead_letter"));
  if (reportId === "jobs_dlq") return table(["createdAt", "type", "failureReason", "correlationId"], (state.deadLetterQueue || []).filter(inRange));
  if (reportId === "jobs_workers") return table(["name", "status", "lastHeartbeatAt"], state.workerNodes || []);
  if (reportId === "jobs_history") return table(["createdAt", "type", "status", "attempts"], (state.backgroundJobs || []).filter(inRange));
  if (reportId === "jobs_approvals") return table(["action", "status", "makerId", "checkerId", "createdAt"], state.jobApprovals || []);
  return table(["id"], []);
}

export function exportJobCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function jobDetail(state, id) {
  ensureJobState(state);
  const job = jobById(state, id);
  if (!job) return null;
  return {
    job,
    attempts: (state.jobAttempts || []).filter((item) => item.jobId === id),
    history: (state.jobStatusHistory || []).filter((item) => item.jobId === id),
    dependencies: (state.jobDependencies || []).filter((item) => item.jobId === id || item.dependsOnJobId === id),
    dlq: (state.deadLetterQueue || []).find((item) => item.jobId === id) || null
  };
}

export function assertSchedulerBoundary() {
  return {
    centralized: true,
    postsInterest: false,
    postsCollections: false,
    restApi: false,
    graphql: false,
    wrapsExistingQueues: true
  };
}
