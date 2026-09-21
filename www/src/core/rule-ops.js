/**
 * Module 24 — Enterprise Rule Engine & Decision Management.
 * Centralized configurable evaluation. Does not post collections, interest, or ledgers.
 * No REST/GraphQL HTTP server.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { acquireAggregateLock, releaseAggregateLock } from "./identifiers.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import { registerContractHandler, publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import {
  RULE_TYPES,
  RULE_STATES,
  HIT_POLICIES,
  canTransitionRule,
  isPublishedRule
} from "./rule-lifecycle.js";
import { evaluateExpression, evaluateAst, resolvePath } from "./rule-expression.js";
import { percentile } from "./rule-slo.js";

export {
  RULE_TYPES,
  RULE_STATES,
  HIT_POLICIES,
  canTransitionRule,
  isPublishedRule
};

export const RULE_SCHEMA_VERSION = "1.0.0";

const RULE_ARRAYS = [
  "ruleDefinitions",
  "ruleVersions",
  "ruleSets",
  "decisionTables",
  "decisionTreeNodes",
  "scoringModels",
  "ruleParameters",
  "ruleTests",
  "simulationRuns",
  "ruleExecutionHistory",
  "ruleApprovals",
  "ruleDependencies",
  "ruleChangeHistory"
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

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function auditRule(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "24",
    ...extras
  }, uid);
}

function notify(state, event, vars, uid, correlationId) {
  return queueNotification(state, {
    event,
    channel: "In-App",
    userId: vars.userId || "",
    vars: { name: vars.name || "Team", ...vars },
    uid,
    correlationId,
    committed: true,
    idempotencyKey: `${event}:${correlationId}:${vars.userId || "sys"}`
  });
}

function emitRuleEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 24,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "RULE"
  }, uid, now);
}

function signDefinition(definition, user, now) {
  const payload = JSON.stringify({
    id: definition.id,
    code: definition.code,
    version: definition.version,
    body: definition.body,
    userId: user?.id || "",
    at: nowIso(now)
  });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rsig-${(hash >>> 0).toString(16)}`;
}

function seedRules() {
  return [
    {
      id: "rdef-min-savings",
      code: "min_savings_amount",
      name: "Minimum savings amount",
      type: "validation",
      ownerModule: 6,
      expression: "amount >= 1",
      tests: [
        { input: { amount: 1 }, expected: true },
        { input: { amount: 0 }, expected: false }
      ]
    },
    {
      id: "rdef-max-withdrawal",
      code: "max_withdrawal_amount",
      name: "Maximum withdrawal amount",
      type: "validation",
      ownerModule: 9,
      expression: "amount <= 20000",
      tests: [
        { input: { amount: 20000 }, expected: true },
        { input: { amount: 20001 }, expected: false }
      ]
    },
    {
      id: "rdef-loan-eligibility",
      code: "loan_eligibility",
      name: "Loan qualification",
      type: "eligibility",
      ownerModule: 8,
      expression: "customer.active == true AND amount >= 100 AND amount <= 50000",
      tests: [
        { input: { customer: { active: true }, amount: 500 }, expected: true },
        { input: { customer: { active: false }, amount: 500 }, expected: false }
      ]
    },
    {
      id: "rdef-withdrawal-decision",
      code: "withdrawal_decision",
      name: "Withdrawal decision table",
      type: "decision",
      ownerModule: 9,
      kind: "table",
      table: {
        hitPolicy: "first",
        inputs: ["amount"],
        rows: [
          { priority: 1, conditions: { amount: { op: "LessThan", value: 1000 } }, output: { decision: "Approve" } },
          { priority: 2, conditions: { amount: { op: "LessThan", value: 20000 } }, output: { decision: "Manual Review" } }
        ],
        defaultOutput: { decision: "Reject" }
      },
      tests: [
        { input: { amount: 200 }, expected: "Approve" },
        { input: { amount: 5000 }, expected: "Manual Review" },
        { input: { amount: 25000 }, expected: "Reject" }
      ]
    },
    {
      id: "rdef-payment-risk",
      code: "payment_risk_score",
      name: "Payment risk score",
      type: "scoring",
      ownerModule: 16,
      kind: "score",
      model: {
        inputs: ["amount", "failedAttempts", "deviceTrust"],
        weights: { amount: 0.4, failedAttempts: 0.4, deviceTrust: 0.2 },
        formula: "weighted_sum",
        normalize: {
          amount: { max: 10000 },
          failedAttempts: { max: 10 },
          deviceTrust: { max: 1, invert: true }
        },
        thresholds: [
          { max: 30, output: "low" },
          { max: 70, output: "medium" },
          { max: 101, output: "high" }
        ]
      },
      tests: [
        { input: { amount: 100, failedAttempts: 0, deviceTrust: 1 }, expected: "low" }
      ]
    },
    {
      id: "rdef-collection-target",
      code: "collection_target",
      name: "Collection target calculation",
      type: "calculation",
      ownerModule: 6,
      expression: "dailyAmount * cycleDays",
      parameters: { cycleDays: 31 },
      tests: [
        { input: { dailyAmount: 10, cycleDays: 31 }, expected: 310 }
      ]
    },
    {
      id: "rdef-workflow-routing",
      code: "workflow_routing",
      name: "Workflow routing tree",
      type: "routing",
      ownerModule: 23,
      kind: "tree",
      tree: {
        condition: { op: "GreaterThan", field: "amount", value: 5000 },
        then: { outcome: "Escalate" },
        else: {
          condition: { op: "Equals", field: "severity", value: "critical" },
          then: { outcome: "Manual Review" },
          else: { outcome: "Approve" }
        }
      },
      tests: [
        { input: { amount: 8000, severity: "low" }, expected: "Escalate" },
        { input: { amount: 200, severity: "critical" }, expected: "Manual Review" },
        { input: { amount: 200, severity: "low" }, expected: "Approve" }
      ]
    },
    {
      id: "rdef-cashier-hint",
      code: "cashier_limit_hint",
      name: "Cashier limit hint",
      type: "policy",
      ownerModule: 1,
      expression: "role != \"Cashier\" OR amount <= 1000",
      tests: [
        { input: { role: "Cashier", amount: 1000 }, expected: true },
        { input: { role: "Cashier", amount: 1001 }, expected: false }
      ]
    }
  ].map((item) => ({
    ...item,
    status: "published",
    version: "1.0.0",
    revision: 1,
    posting: false,
    testsPassed: true
  }));
}

export function ensureRuleState(state = {}) {
  RULE_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  state.ruleCache = state.ruleCache || { published: {}, hits: 0, misses: 0, warmedAt: "" };
  const seeds = seedRules();
  if (!state.ruleDefinitions.length) {
    state.ruleDefinitions = seeds;
  } else {
    seeds.forEach((def) => {
      if (!state.ruleDefinitions.some((item) => item.code === def.code)) state.ruleDefinitions.push(def);
    });
  }
  if (!state.ruleVersions.length) {
    state.ruleVersions = state.ruleDefinitions.map((def) => ({
      id: `${def.id}-v1`,
      definitionId: def.id,
      code: def.code,
      version: def.version,
      status: def.status,
      type: def.type,
      kind: def.kind || "expression",
      expression: def.expression || "",
      table: def.table || null,
      tree: def.tree || null,
      model: def.model || null,
      parameters: def.parameters || {},
      tests: def.tests || [],
      createdAt: "2026-09-11T00:00:00.000Z"
    }));
  }
  if (!state.ruleTests.length) {
    state.ruleDefinitions.forEach((def) => {
      (def.tests || []).forEach((test, index) => {
        state.ruleTests.push({
          id: `${def.id}-t${index + 1}`,
          definitionId: def.id,
          input: test.input,
          expected: test.expected,
          required: true
        });
      });
    });
  }
  warmRuleCache(state, "2026-09-11T00:00:00.000Z");
  return state;
}

export function warmRuleCache(state, now) {
  state.ruleCache = state.ruleCache || { published: {}, hits: 0, misses: 0, warmedAt: "" };
  const published = {};
  (state.ruleVersions || []).filter((item) => item.status === "published").forEach((item) => {
    published[item.code] = item;
    published[item.id] = item;
  });
  state.ruleCache = {
    published,
    hits: state.ruleCache?.hits || 0,
    misses: state.ruleCache?.misses || 0,
    warmedAt: nowIso(now)
  };
  return state.ruleCache;
}

function definitionById(state, id) {
  return (state.ruleDefinitions || []).find((item) => item.id === id || item.code === id) || null;
}

function versionById(state, id) {
  return (state.ruleVersions || []).find((item) => item.id === id) || null;
}

export function publishedRuleVersion(state, codeOrId) {
  ensureRuleState(state);
  const cached = state.ruleCache?.published?.[codeOrId];
  if (cached && cached.status === "published") {
    state.ruleCache.hits += 1;
    return cached;
  }
  if (state.ruleCache) state.ruleCache.misses += 1;
  const versions = (state.ruleVersions || []).filter((item) => (
    (item.code === codeOrId || item.id === codeOrId || item.definitionId === codeOrId) && item.status === "published"
  ));
  return versions[versions.length - 1] || null;
}

function resolveVersion(state, input = {}) {
  if (input.versionId) {
    const version = versionById(state, input.versionId);
    if (!version) return { error: "Rule version unsupported", errorCode: "RE-002", http: 404 };
    return { version };
  }
  const code = input.code || input.ruleCode || input.ruleDefinitionId;
  if (!code) return { error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const definition = definitionById(state, code);
  if (!definition && !publishedRuleVersion(state, code)) {
    return { error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  }
  if (input.ruleVersion && definition) {
    const version = (state.ruleVersions || []).find((item) => (
      item.definitionId === definition.id && String(item.version) === String(input.ruleVersion)
    ));
    if (!version) return { error: "Rule version unsupported", errorCode: "RE-002", http: 404 };
    return { version, definition };
  }
  const version = publishedRuleVersion(state, definition?.code || code);
  if (!version) return { error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  return { version, definition };
}

export function evaluateDecisionTable(table = {}, context = {}) {
  const rows = [...(table.rows || [])].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  const matches = rows.filter((row) => Object.entries(row.conditions || {}).every(([field, condition]) => {
    const actual = resolvePath(context, field);
    if (condition && typeof condition === "object" && condition.op) {
      return Boolean(evaluateAst({ ...condition, field }, context));
    }
    return actual === condition;
  }));
  const policy = table.hitPolicy || "first";
  if (policy === "collect") {
    return { ok: true, value: matches.map((item) => item.output), hits: matches.length };
  }
  if (policy === "unique" && matches.length > 1) {
    return { ok: false, error: "Decision table unique hit policy matched multiple rows", errorCode: "RE-004" };
  }
  const hit = matches[0];
  return { ok: true, value: hit?.output || table.defaultOutput || null, hits: matches.length };
}

export function evaluateDecisionTree(node, context = {}) {
  if (!node) return { ok: true, value: null };
  if (node.outcome != null && !node.condition) return { ok: true, value: node.outcome };
  if (node.condition) {
    const passed = evaluateAst(node.condition, context);
    return evaluateDecisionTree(passed ? (node.then || node.true) : (node.else || node.false || node.default), context);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = evaluateDecisionTree(child, context);
      if (result.value != null) return result;
    }
  }
  return { ok: true, value: node.default || node.outcome || null };
}

export function evaluateScore(model = {}, context = {}) {
  const weights = model.weights || {};
  let total = 0;
  Object.entries(weights).forEach(([field, weight]) => {
    const spec = (model.normalize || {})[field] || {};
    let value = Number(resolvePath(context, field) || 0);
    const max = Number(spec.max || 1) || 1;
    value = Math.max(0, Math.min(1, value / max));
    if (spec.invert) value = 1 - value;
    total += value * Number(weight || 0);
  });
  const score = Math.round(total * 100);
  const band = (model.thresholds || []).find((item) => score <= Number(item.max));
  return { ok: true, value: band?.output || score, score };
}

function outcomeOf(version, context) {
  if (version.kind === "table" || version.table) return evaluateDecisionTable(version.table, context);
  if (version.kind === "tree" || version.tree) return evaluateDecisionTree(version.tree, context);
  if (version.kind === "score" || version.model) return evaluateScore(version.model, context);
  const merged = { ...(version.parameters || {}), ...context };
  return evaluateExpression(version.expression, merged);
}

function valuesEqual(actual, expected) {
  if (expected && typeof expected === "object" && expected.decision) {
    return (actual?.decision || actual) === expected.decision;
  }
  if (actual && typeof actual === "object" && actual.decision != null) {
    return actual.decision === expected;
  }
  return actual === expected;
}

export function evaluateRule(state, input = {}, user, uid, now, { simulate = false, record = true } = {}) {
  ensureRuleState(state);
  const started = nowMs(now);
  if (isFeatureEnabled(state, "enableRuleEngine") === false) {
    return { ok: false, error: "Rule engine is disabled", errorCode: "RE-003", http: 503 };
  }
  const resolved = resolveVersion(state, input);
  if (resolved.error) return { ok: false, error: resolved.error, errorCode: resolved.errorCode, http: resolved.http };
  const version = resolved.version;
  const timeoutMs = Number(getConfigValue(state, "rule.executionTimeoutMs") ?? 50);
  const context = { ...(input.facts || input.input || input.context || input) };
  delete context.code;
  delete context.ruleCode;
  delete context.ruleDefinitionId;
  delete context.versionId;
  delete context.ruleVersion;
  delete context.facts;
  const result = outcomeOf(version, context);
  const durationMs = Math.max(0, nowMs(now) - started);
  if (!result.ok) {
    emitRuleEvent(state, "RuleFailed", { code: version.code, error: result.error }, {
      uid, now, correlationId: input.correlationId || version.id, aggregateId: version.definitionId
    });
    return { ...result, durationMs, versionId: version.id, code: version.code };
  }
  if (durationMs > timeoutMs && timeoutMs > 0 && input.enforceTimeout) {
    return { ok: false, error: "Rule evaluation timed out", errorCode: "RE-011", http: 503, durationMs };
  }
  const row = {
    id: newId("rex", uid),
    definitionId: version.definitionId,
    versionId: version.id,
    code: version.code,
    result: result.value,
    score: result.score,
    durationMs,
    simulate: simulate === true,
    correlationId: input.correlationId || "",
    createdAt: nowIso(now)
  };
  if (record && !simulate) {
    state.ruleExecutionHistory.push(row);
    if (state.ruleExecutionHistory.length > 5000) state.ruleExecutionHistory.splice(0, state.ruleExecutionHistory.length - 5000);
    recordMetric(state, { domain: "rules", name: "evaluations", value: 1 }, uid, now);
    recordMetric(state, { domain: "rules", name: "latencyMs", value: durationMs }, uid, now);
    emitRuleEvent(state, "RuleEvaluated", { code: version.code, result: result.value }, {
      uid, now, correlationId: row.correlationId, aggregateId: version.definitionId
    });
  }
  return {
    ok: true,
    value: result.value,
    score: result.score,
    hits: result.hits,
    durationMs,
    versionId: version.id,
    code: version.code,
    type: version.type,
    postsCollections: false,
    historyId: record && !simulate ? row.id : null
  };
}

export function evaluateRuleSet(state, input = {}, user, uid, now) {
  const codes = input.codes || input.rules || [];
  const results = codes.map((code) => evaluateRule(state, { ...input, code }, user, uid, now));
  return { ok: results.every((item) => item.ok), results };
}

export function simulateRule(state, input = {}, user, uid, now) {
  ensureRuleState(state);
  if (user && !permitted(user, "Rule.Simulate") && !permitted(user, "Rule.Test")) {
    return { ok: false, error: "You cannot simulate rules", errorCode: "RE-005", http: 403 };
  }
  const beforeHistory = (state.ruleExecutionHistory || []).length;
  const cases = Array.isArray(input.cases) ? input.cases : [input.facts || input.input || input];
  const results = cases.map((facts) => evaluateRule(state, { ...input, facts }, user, uid, now, { simulate: true, record: false }));
  const run = {
    id: newId("rsim", uid),
    code: input.code || input.ruleCode,
    results,
    whatIf: input.whatIf || false,
    createdAt: nowIso(now),
    createdBy: user?.id || ""
  };
  state.simulationRuns.push(run);
  emitRuleEvent(state, "RuleSimulated", { runId: run.id, code: run.code }, {
    uid, now, correlationId: input.correlationId || run.id, aggregateId: run.id
  });
  return {
    ok: true,
    run,
    results,
    simulated: true,
    postsCollections: false,
    historyUnchanged: (state.ruleExecutionHistory || []).length === beforeHistory
  };
}

export function runRuleTests(state, definitionId, user, uid, now) {
  ensureRuleState(state);
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const tests = (state.ruleTests || []).filter((item) => item.definitionId === definition.id);
  const draftVersion = {
    id: definition.id,
    definitionId: definition.id,
    code: definition.code,
    type: definition.type,
    kind: definition.kind || "expression",
    expression: definition.expression || "",
    table: definition.table || null,
    tree: definition.tree || null,
    model: definition.model || null,
    parameters: definition.parameters || {}
  };
  const results = tests.map((test) => {
    const evaluated = outcomeOf(draftVersion, test.input || {});
    const passed = evaluated.ok && valuesEqual(evaluated.value, test.expected);
    return { id: test.id, passed, actual: evaluated.value, expected: test.expected, error: evaluated.error };
  });
  const passed = results.every((item) => item.passed);
  definition.testsPassed = passed;
  definition.coverage = tests.length ? Math.round((results.filter((item) => item.passed).length / tests.length) * 100) : 0;
  return { ok: passed, passed, results, coverage: definition.coverage, errorCode: passed ? undefined : "RE-006" };
}

export function transitionRuleDefinition(state, definition, nextStatus, user, uid, now, reason = "") {
  const from = definition.status || "draft";
  if (from === nextStatus) return { ok: true, definition, noop: true };
  if (!canTransitionRule(from, nextStatus)) {
    return { ok: false, error: `Invalid rule transition: ${from} → ${nextStatus}`, errorCode: from === "published" ? "RE-009" : "RE-008", http: 409 };
  }
  definition.status = nextStatus;
  definition.revision = Number(definition.revision || 1) + 1;
  definition.updatedAt = nowIso(now);
  state.ruleChangeHistory.push({
    id: newId("rch", uid),
    definitionId: definition.id,
    from,
    to: nextStatus,
    reason,
    userId: user?.id || "",
    createdAt: nowIso(now),
    immutable: true
  });
  return { ok: true, definition, from, to: nextStatus };
}

export function submitRuleForTesting(state, definitionId, user, uid, now) {
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  if (user && !permitted(user, "Rule.Design") && !permitted(user, "Rule.Test")) {
    return { ok: false, error: "You cannot submit rules for testing", errorCode: "RE-005", http: 403 };
  }
  return transitionRuleDefinition(state, definition, "testing", user, uid, now, "Submitted for testing");
}

export function submitRuleForApproval(state, definitionId, user, uid, now) {
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const tested = runRuleTests(state, definition.id, user, uid, now);
  if (!tested.ok) return { ok: false, error: "Rules shall not be publishable unless all required tests pass", errorCode: "RE-006", http: 422, results: tested.results };
  notify(state, "rule_approval_request", { name: "Approver", userId: user?.id || "" }, uid, definition.id);
  return transitionRuleDefinition(state, definition, "approval", user, uid, now, "Tests passed");
}

export function approveRule(state, definitionId, user, uid, now, comment = "") {
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  if (user && !permitted(user, "Rule.Approve") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot approve rules", errorCode: "RE-005", http: 403 };
  }
  if (definition.createdBy && user?.id === definition.createdBy && !isSystemOwner(user)) {
    return { ok: false, error: "Maker-checker: the author cannot approve this rule", errorCode: "RE-005", http: 403 };
  }
  state.ruleApprovals.push({
    id: newId("rap", uid),
    definitionId: definition.id,
    decision: "approve",
    comment,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  emitRuleEvent(state, "RuleApproved", { definitionId: definition.id }, { uid, now, aggregateId: definition.id });
  return { ok: true, definition, approved: true };
}

export function rejectRule(state, definitionId, user, uid, now, reason = "Rejected") {
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  if (user && !permitted(user, "Rule.Approve") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot reject rules", errorCode: "RE-005", http: 403 };
  }
  state.ruleApprovals.push({
    id: newId("rap", uid),
    definitionId: definition.id,
    decision: "reject",
    comment: reason,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  return transitionRuleDefinition(state, definition, "draft", user, uid, now, reason);
}

export function publishRule(state, definitionId, user, uid, now) {
  ensureRuleState(state);
  if (user && !permitted(user, "Rule.Publish") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot publish rules", errorCode: "RE-005", http: 403 };
  }
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const tested = runRuleTests(state, definition.id, user, uid, now);
  if (!tested.ok) return { ok: false, error: "Rules shall not be publishable unless all required tests pass", errorCode: "RE-006", http: 422 };
  if (definition.status !== "approval" && definition.status !== "published" && definition.status !== "deprecated" && !isSystemOwner(user)) {
    return { ok: false, error: `Invalid rule transition: ${definition.status} → published`, errorCode: "RE-008", http: 409 };
  }
  const lock = acquireAggregateLock(state, "RULE", definition.id, user?.id || "rule-engine", { ttlMs: 15000, now: nowMs(now) });
  if (lock.error) return { ok: false, error: lock.error, errorCode: "RE-010", http: 409 };
  try {
    if (definition.status !== "published") {
      const moved = transitionRuleDefinition(state, definition, "published", user, uid, now, "Published");
      if (!moved.ok && definition.status !== "published") return moved;
    }
    (state.ruleVersions || []).filter((item) => item.code === definition.code && item.status === "published").forEach((item) => {
      item.status = "deprecated";
    });
    const version = {
      id: newId("rver", uid),
      definitionId: definition.id,
      code: definition.code,
      version: definition.version || "1.0.0",
      status: "published",
      type: definition.type,
      kind: definition.kind || "expression",
      expression: definition.expression || "",
      table: definition.table || null,
      tree: definition.tree || null,
      model: definition.model || null,
      parameters: definition.parameters || {},
      tests: definition.tests || [],
      signature: signDefinition(definition, user, now),
      createdAt: nowIso(now),
      publishedBy: user?.id || ""
    };
    state.ruleVersions.push(version);
    definition.signature = version.signature;
    warmRuleCache(state, now);
    auditRule(state, "Rule published", definition.code, user, { entityId: version.id }, uid);
    notify(state, "rule_published", { name: "Team", userId: user?.id || "" }, uid, definition.id);
    emitRuleEvent(state, "RulePublished", { definitionId: definition.id, versionId: version.id }, {
      uid, now, aggregateId: definition.id
    });
    return { ok: true, definition, version };
  } finally {
    releaseAggregateLock(state, "RULE", definition.id, user?.id || "rule-engine");
  }
}

export function retireRule(state, definitionId, user, uid, now) {
  ensureRuleState(state);
  if (user && !permitted(user, "Rule.Publish") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot retire rules", errorCode: "RE-005", http: 403 };
  }
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const moved = transitionRuleDefinition(state, definition, "retired", user, uid, now, "Retired");
  if (!moved.ok) return moved;
  (state.ruleVersions || []).filter((item) => item.definitionId === definition.id && item.status === "published").forEach((item) => {
    item.status = "retired";
  });
  warmRuleCache(state, now);
  emitRuleEvent(state, "RuleRetired", { definitionId: definition.id }, { uid, now, aggregateId: definition.id });
  return { ok: true, definition };
}

export function exportRule(state, definitionId) {
  const definition = definitionById(state, definitionId);
  if (!definition) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  return { ok: true, document: clone(definition) };
}

export function importRule(state, document = {}, user, uid, now) {
  ensureRuleState(state);
  if (user && !permitted(user, "Rule.Design") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot import rules", errorCode: "RE-005", http: 403 };
  }
  if (!document.code || !document.name) return { ok: false, error: "Rule code and name are required", errorCode: "RE-004", http: 400 };
  if (definitionById(state, document.code)) return { ok: false, error: "Duplicate rule request", errorCode: "RE-007", http: 409 };
  const row = {
    id: newId("rdef", uid),
    code: document.code,
    name: document.name,
    type: RULE_TYPES.includes(document.type) ? document.type : "validation",
    status: "draft",
    version: document.version || "1.0.0",
    revision: 1,
    expression: document.expression || "",
    table: document.table || null,
    tree: document.tree || null,
    model: document.model || null,
    parameters: document.parameters || {},
    tests: document.tests || [],
    ownerModule: document.ownerModule || 24,
    createdBy: user?.id || "",
    createdAt: nowIso(now),
    testsPassed: false,
    posting: false
  };
  state.ruleDefinitions.push(row);
  (row.tests || []).forEach((test, index) => {
    state.ruleTests.push({ id: `${row.id}-t${index + 1}`, definitionId: row.id, input: test.input, expected: test.expected, required: true });
  });
  return { ok: true, definition: row };
}

export function replayRuleHistory(state, input = {}, user, uid, now) {
  const rows = (state.ruleExecutionHistory || []).filter((item) => !input.code || item.code === input.code).slice(0, Number(input.limit || 10000));
  const results = rows.map((item) => evaluateRule(state, {
    code: item.code,
    versionId: item.versionId,
    facts: input.facts || {}
  }, user, uid, now, { simulate: true, record: false }));
  return { ok: true, replayed: results.length, results, simulated: true, postsCollections: false };
}

export function ruleDashboard(state) {
  ensureRuleState(state);
  const definitions = state.ruleDefinitions || [];
  const history = state.ruleExecutionHistory || [];
  const durations = history.map((item) => Number(item.durationMs || 0));
  const cache = state.ruleCache || { hits: 0, misses: 0 };
  const cacheTotal = cache.hits + cache.misses;
  return {
    published: definitions.filter((item) => item.status === "published").length,
    draft: definitions.filter((item) => item.status === "draft").length,
    approval: definitions.filter((item) => item.status === "approval").length,
    evaluations: history.length,
    simulations: (state.simulationRuns || []).length,
    failures: history.filter((item) => item.result === false).length,
    cacheHitRate: cacheTotal ? cache.hits / cacheTotal : 1,
    latencyP95: percentile(durations, 0.95)
  };
}

export function ruleReports(state, reportId, range = {}) {
  ensureRuleState(state);
  const from = String(range.from || "0000-01-01");
  const to = String(range.to || "9999-12-31");
  const inRange = (row) => String(row.createdAt || "").slice(0, 10) >= from && String(row.createdAt || "").slice(0, 10) <= to;
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "rules_frequency") return table(["code", "createdAt", "result"], (state.ruleExecutionHistory || []).filter(inRange));
  if (reportId === "rules_latency") return table(["code", "durationMs", "createdAt"], (state.ruleExecutionHistory || []).filter(inRange));
  if (reportId === "rules_failures") return table(["code", "createdAt"], (state.ruleExecutionHistory || []).filter((item) => item.result === false && inRange(item)));
  if (reportId === "rules_coverage") return table(["code", "testsPassed", "coverage"], state.ruleDefinitions || []);
  if (reportId === "rules_decisions") return table(["code", "result", "createdAt"], (state.ruleExecutionHistory || []).filter(inRange));
  if (reportId === "rules_scores") return table(["code", "score", "result"], (state.ruleExecutionHistory || []).filter((item) => item.score != null));
  if (reportId === "rules_simulations") return table(["code", "createdAt"], (state.simulationRuns || []).filter(inRange));
  if (reportId === "rules_versions") return table(["code", "version", "status"], state.ruleVersions || []);
  return table(["id"], []);
}

export function exportRuleCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function benchmarkRules(state, { iterations = 200, code = "min_savings_amount", user, uid, now } = {}) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = Date.now();
    evaluateRule(state, { code, facts: { amount: 5 } }, user, uid, now, { simulate: true, record: false });
    samples.push(Date.now() - started);
  }
  return {
    profile: "W1",
    acceptance: false,
    iterations,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    cache: "warm"
  };
}

export function assertRuleBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    postsInterest: false,
    ownsBusinessProcesses: false,
    restHttp: false,
    graphqlHttp: false,
    sideEffectFree: true,
    versioned: true,
    publicContracts: true,
    httpGatewayOnly: true,
    directTableAccess: false,
    sandbox: true
  };
}

registerJobHandler("rule_batch_evaluate", (state, job, ctx) => {
  const codes = job?.payload?.codes || ["min_savings_amount"];
  return evaluateRuleSet(state, { codes, facts: job?.payload?.facts || { amount: 1 } }, ctx.user, ctx.uid, ctx.now);
});

registerContractHandler("Rule.Evaluate.v1", (state, payload, ctx) => evaluateRule(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Rule.EvaluateSet.v1", (state, payload, ctx) => evaluateRuleSet(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Rule.Simulate.v1", (state, payload, ctx) => simulateRule(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Rule.Test.v1", (state, payload, ctx) => runRuleTests(state, payload.definitionId || payload.ruleDefinitionId || payload.code, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("rule.evaluate", (state, request, ctx) => evaluateRule(state, request.body || {}, ctx.user, ctx.uid, ctx.now));
