import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canTransitionRule, assertRuleLifecycleBoundary } from "../src/core/rule-lifecycle.js";
import { evaluateExpression, assertExpressionBoundary } from "../src/core/rule-expression.js";
import { assertSloCatalogComplete, assertRuleSloBoundary, sloFor, WORKLOAD_PROFILES } from "../src/core/rule-slo.js";
import {
  ensureRuleState,
  evaluateRule,
  evaluateDecisionTable,
  evaluateDecisionTree,
  evaluateScore,
  simulateRule,
  runRuleTests,
  publishRule,
  retireRule,
  importRule,
  submitRuleForTesting,
  submitRuleForApproval,
  approveRule,
  benchmarkRules,
  ruleDashboard,
  ruleReports,
  exportRuleCsv,
  assertRuleBoundary
} from "../src/core/rule-ops.js";
import "../src/core/rule-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { RULE_ERROR_CODES } from "../src/core/rule-api.js";

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
    featureFlags: [{ id: "enableRuleEngine", enabled: true }]
  };
  ensureGatewayState(state);
  ensureRuleState(state);
  return state;
}

test("only documented rule transitions are permitted and evaluation is sandboxed", () => {
  assert.equal(canTransitionRule("draft", "testing"), true);
  assert.equal(canTransitionRule("testing", "approval"), true);
  assert.equal(canTransitionRule("approval", "published"), true);
  assert.equal(canTransitionRule("published", "draft"), false);
  assert.equal(canTransitionRule("retired", "published"), false);
  assert.equal(assertRuleLifecycleBoundary().postsCollections, false);
  assert.equal(assertExpressionBoundary().evalDisabled, true);
  assert.equal(assertRuleBoundary().sideEffectFree, true);
  const ok = evaluateExpression("amount >= 5 AND customer.active == true", { amount: 8, customer: { active: true } });
  assert.equal(ok.ok, true);
  assert.equal(ok.value, true);
  const blocked = evaluateExpression("constructor", { amount: 1 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "RE-012");
});

test("decision tables, trees, scoring, and calculations stay off the ledger", () => {
  const state = blank();
  const before = state.collections.length;
  const table = evaluateDecisionTable(state.ruleDefinitions.find((item) => item.code === "withdrawal_decision").table, { amount: 200 });
  assert.equal(table.value.decision, "Approve");
  const tree = evaluateDecisionTree(state.ruleDefinitions.find((item) => item.code === "workflow_routing").tree, { amount: 8000, severity: "low" });
  assert.equal(tree.value, "Escalate");
  const score = evaluateScore(state.ruleDefinitions.find((item) => item.code === "payment_risk_score").model, { amount: 100, failedAttempts: 0, deviceTrust: 1 });
  assert.equal(score.value, "low");
  const target = evaluateRule(state, { code: "collection_target", facts: { dailyAmount: 10, cycleDays: 31 } }, owner, uid, now);
  assert.equal(target.ok, true);
  assert.equal(target.value, 310);
  assert.equal(state.settings.loanInterest, 15);
  assert.equal(state.settings.collectionDays, 31);
  assert.equal(state.collections.length, before);
  assert.equal(state.collections[0].amount, 20);
});

test("evaluations are deterministic and simulations never write production history", () => {
  const state = blank();
  const first = evaluateRule(state, { code: "min_savings_amount", facts: { amount: 5 } }, owner, uid, now);
  const second = evaluateRule(state, { code: "min_savings_amount", facts: { amount: 5 } }, owner, uid, now);
  assert.equal(first.value, second.value);
  const historyBefore = state.ruleExecutionHistory.length;
  const simulated = simulateRule(state, { code: "withdrawal_decision", cases: [{ amount: 200 }, { amount: 25000 }] }, owner, uid, now);
  assert.equal(simulated.ok, true);
  assert.equal(simulated.historyUnchanged, true);
  assert.equal(state.ruleExecutionHistory.length, historyBefore);
  assert.equal(simulated.results[0].value.decision, "Approve");
  assert.equal(simulated.results[1].value.decision, "Reject");
});

test("publication requires tests and collector cannot publish", () => {
  const state = blank();
  const imported = importRule(state, {
    code: "branch_hours",
    name: "Branch operating hours",
    type: "validation",
    expression: "hour >= 8 AND hour <= 17",
    tests: [
      { input: { hour: 9 }, expected: true },
      { input: { hour: 20 }, expected: false }
    ]
  }, owner, uid, now);
  assert.equal(imported.ok, true);
  assert.equal(imported.definition.status, "draft");
  const tested = submitRuleForTesting(state, imported.definition.id, owner, uid, now);
  assert.equal(tested.ok, true);
  const approvedPath = submitRuleForApproval(state, imported.definition.id, owner, uid, now);
  assert.equal(approvedPath.ok, true);
  approveRule(state, imported.definition.id, owner, uid, now, "OK");
  const published = publishRule(state, imported.definition.id, owner, uid, now);
  assert.equal(published.ok, true);
  assert.ok(published.version.signature.startsWith("rsig-"));
  const denied = publishRule(state, "rdef-min-savings", collector, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "RE-005");
  assert.equal(canAction(collector, "Rule.Publish"), false);
  const tests = runRuleTests(state, "rdef-min-savings", owner, uid, now);
  assert.equal(tests.ok, true);
});

test("contracts, gateway, reports, version pin, and SLOs hold", () => {
  const state = blank();
  const viaContract = invokeContract(state, {
    contractId: "Rule.Evaluate.v1",
    fromModule: 6,
    payload: { code: "loan_eligibility", facts: { customer: { active: true }, amount: 500 } }
  }, { uid, now, user: owner });
  assert.equal(viaContract.ok, true);
  assert.equal(viaContract.data.value, true);
  const viaGateway = dispatchGatewayRequest(state, {
    route: "rule.evaluate",
    version: "v1",
    user: owner,
    body: { code: "min_savings_amount", facts: { amount: 2 } }
  }, { uid, now, user: owner });
  assert.equal(viaGateway.ok, true);
  const missing = invokeContract(state, {
    contractId: "Rule.Evaluate.v1",
    fromModule: 20,
    payload: { code: "does-not-exist" }
  }, { uid, now, user: owner });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.errorCode, "RE-001");
  assert.ok(getContract("Rule.Evaluate.v1"));
  assert.equal(RULE_ERROR_CODES["RE-012"], "Sandbox Violation");
  const report = ruleReports(state, "rules_frequency", { from: "2026-09-11", to: "2026-09-11" });
  assert.ok(exportRuleCsv(report).includes("code") || report.columns.includes("code"));
  assert.ok(ruleDashboard(state).published >= 1);
  const catalog = assertSloCatalogComplete();
  assert.equal(catalog.ok, true);
  assert.equal(sloFor("latency.ruleEvaluation.p95").profile, "W3");
  assert.equal(sloFor("latency.ruleEvaluation.p95").cache, "warm");
  assert.equal(WORKLOAD_PROFILES.W1.acceptance, false);
  assert.equal(assertRuleSloBoundary().w1NotAcceptance, true);
  const bench = benchmarkRules(state, { iterations: 40, user: owner, uid, now });
  assert.equal(bench.acceptance, false);
  assert.equal(bench.profile, "W1");
  assert.ok(bench.p95 >= 0);
  retireRule(state, "rdef-cashier-hint", owner, uid, now);
  const retiredEval = evaluateRule(state, { code: "cashier_limit_hint", facts: { role: "Cashier", amount: 1000 } }, owner, uid, now);
  assert.equal(retiredEval.ok, false);
});
