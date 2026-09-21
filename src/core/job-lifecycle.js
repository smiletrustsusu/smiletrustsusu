/**
 * Module 18 job state machine, queue ownership, workers, retry, dependencies, DLQ, and health.
 * Jobs are orchestration records. They do not post money themselves.
 */

export const JOB_SCHEMA_LIFECYCLE = "1.0.0";

export const JOB_STATES = [
  "created",
  "queued",
  "reserved",
  "running",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
  "expired"
];

export const TERMINAL_JOB_STATES = ["completed", "cancelled", "dead_letter", "expired"];

export const JOB_TRANSITION_MATRIX = {
  created: ["queued", "cancelled", "expired"],
  queued: ["reserved", "cancelled", "expired"],
  reserved: ["running", "queued", "cancelled", "expired"],
  running: ["completed", "failed", "queued", "dead_letter", "cancelled"],
  failed: ["queued", "dead_letter", "cancelled"],
  completed: [],
  cancelled: [],
  dead_letter: ["queued"],
  expired: []
};

export const QUEUE_TYPES = ["immediate", "delayed", "scheduled", "priority", "retry", "dead_letter", "batch"];

export const JOB_PRIORITIES = ["critical", "high", "normal", "low", "background"];

export const PRIORITY_RANK = { critical: 0, high: 1, normal: 2, low: 3, background: 4 };

export const QUEUE_OWNERS = {
  immediate: "Scheduler Engine",
  delayed: "Scheduler Engine",
  scheduled: "Scheduler Engine",
  priority: "Scheduler Engine",
  retry: "Retry Engine",
  dead_letter: "Dead Letter Service",
  batch: "Batch Orchestrator"
};

export const QUEUE_BACKUP_OWNERS = {
  immediate: "Application Controller",
  delayed: "Process Orchestrator",
  scheduled: "Workflow Engine",
  priority: "Scheduler Recovery Service",
  retry: "Job Recovery Service",
  dead_letter: "Operations Recovery Service",
  batch: "Batch Recovery Service"
};

export const WORKER_STATES = ["registered", "healthy", "degraded", "unhealthy", "draining", "offline"];

export const RETRY_STRATEGIES = ["exponential", "fixed", "immediate", "manual"];

export const CRITICAL_JOB_CATEGORIES = ["accounting", "payment", "synchronization", "audit"];

export const APPROVAL_REQUIRED_ACTIONS = ["replay", "manual_financial", "manual_accounting", "cancel_running"];

export function canTransitionJob(from, to) {
  return (JOB_TRANSITION_MATRIX[from] || []).includes(to);
}

export function isTerminalJobStatus(status) {
  return TERMINAL_JOB_STATES.includes(status);
}

export function isCriticalJob(definition = {}) {
  return CRITICAL_JOB_CATEGORIES.includes(definition.category) || definition.priority === "critical";
}

export function nextRetryDelayMs(policy = {}, attempt = 1) {
  const strategy = policy.strategy || "exponential";
  const base = Number(policy.backoffMs || policy.delayMs || 1000);
  const cap = Number(policy.maxDelayMs || 300000);
  if (strategy === "immediate") return 0;
  if (strategy === "manual") return Number.POSITIVE_INFINITY;
  if (strategy === "fixed") return Math.min(base, cap);
  const delay = base * (2 ** Math.max(0, attempt - 1));
  return Math.min(delay, cap);
}

export function dependenciesSatisfied(jobs = [], dependencyIds = []) {
  if (!dependencyIds?.length) return { ok: true };
  const missing = [];
  const blocked = [];
  dependencyIds.forEach((id) => {
    const row = jobs.find((item) => item.id === id);
    if (!row) missing.push(id);
    else if (row.status !== "completed") blocked.push(id);
  });
  if (missing.length || blocked.length) {
    return { ok: false, missing, blocked };
  }
  return { ok: true };
}

export function healthScore({ failureRate = 0, retryRate = 0, dlqSize = 0, staleWorkers = 0, queueDepth = 0 } = {}) {
  let score = 100;
  score -= Math.min(40, failureRate * 100);
  score -= Math.min(20, retryRate * 50);
  score -= Math.min(20, dlqSize * 2);
  score -= Math.min(10, staleWorkers * 10);
  score -= Math.min(10, queueDepth > 100 ? 10 : 0);
  const value = Math.max(0, Math.round(score));
  const status = value >= 80 ? "healthy" : value >= 50 ? "degraded" : "unhealthy";
  return { score: value, status };
}

export function blackoutActive(config = {}, now) {
  const windows = config.blackoutWindows || [];
  if (!windows.length) return false;
  const ts = typeof now === "number" ? now : Date.parse(now || Date.now());
  return windows.some((window) => Date.parse(window.from) <= ts && ts <= Date.parse(window.to));
}

export function inExecutionWindow(config = {}, now) {
  if (!config.executionWindow) return true;
  const ts = typeof now === "number" ? now : Date.parse(now || Date.now());
  const from = Date.parse(config.executionWindow.from || 0);
  const to = Date.parse(config.executionWindow.to || "9999-12-31");
  return ts >= from && ts <= to;
}

function cronFieldMatches(part, value) {
  if (part === "*") return true;
  return String(part).split(",").some((token) => {
    if (token.includes("/")) {
      const [range, step] = token.split("/");
      const n = Number(step);
      if (!Number.isFinite(n) || n <= 0) return false;
      if (range === "*") return value % n === 0;
      const [a, b] = range.split("-").map(Number);
      if (!Number.isFinite(a)) return false;
      const max = Number.isFinite(b) ? b : a;
      return value >= a && value <= max && (value - a) % n === 0;
    }
    if (token.includes("-")) {
      const [a, b] = token.split("-").map(Number);
      return value >= a && value <= b;
    }
    return Number(token) === value;
  });
}

export function cronMatches(expr, date) {
  if (!expr) return false;
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const fields = [d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCDay()];
  return parts.every((part, index) => cronFieldMatches(part, fields[index]));
}
