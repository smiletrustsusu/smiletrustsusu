/**
 * Module 24 public rule contracts, HTTP mappings, and response schemas.
 * In-process only. Other modules must use these contracts — never rule tables.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureRuleState,
  evaluateRule,
  evaluateRuleSet,
  simulateRule,
  runRuleTests,
  publishRule,
  retireRule,
  approveRule,
  rejectRule,
  submitRuleForTesting,
  submitRuleForApproval,
  importRule,
  exportRule,
  replayRuleHistory,
  ruleDashboard,
  publishedRuleVersion
} from "./rule-ops.js";

export const RULE_API_VERSION = "1.0.0";
export const RULE_ERROR_CODES = {
  "RE-001": "Rule Definition Not Found",
  "RE-002": "Rule Version Unsupported",
  "RE-003": "Invalid Rule State",
  "RE-004": "Expression Error",
  "RE-005": "Unauthorized Rule Action",
  "RE-006": "Tests Failed",
  "RE-007": "Duplicate Rule Request",
  "RE-008": "Invalid Transition",
  "RE-009": "Rule Already Published",
  "RE-010": "Concurrency Conflict",
  "RE-011": "Evaluation Timeout",
  "RE-012": "Sandbox Violation"
};

function idOf(payload = {}, keys = []) {
  for (const key of keys) {
    if (payload[key]) return payload[key];
  }
  return payload.id || "";
}

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

export function evaluateRuleContract(state, payload, user, uid, now) {
  const result = evaluateRule(state, payload, user, uid, now);
  if (!result.ok) return result;
  return {
    ...result,
    decision: result.value?.decision || result.value,
    ruleCode: result.code,
    versionId: result.versionId
  };
}

export function getRuleContract(state, payload) {
  ensureRuleState(state);
  const version = publishedRuleVersion(state, idOf(payload, ["ruleDefinitionId", "code", "ruleCode", "definitionId"]));
  if (!version) return { ok: false, error: "Rule definition not found", errorCode: "RE-001", http: 404 };
  const definition = (state.ruleDefinitions || []).find((item) => item.id === version.definitionId);
  return {
    ok: true,
    definition,
    version,
    ruleDefinitionId: version.definitionId,
    name: definition?.name || version.code,
    versionNumber: version.version,
    status: definition?.status || version.status,
    type: version.type,
    expression: version.expression,
    table: version.table,
    tree: version.tree,
    model: version.model
  };
}

export function listRulesContract(state, payload = {}) {
  ensureRuleState(state);
  let rows = [...(state.ruleDefinitions || [])];
  if (payload.type) rows = rows.filter((item) => item.type === payload.type);
  if (payload.status) rows = rows.filter((item) => item.status === payload.status);
  const paged = paginateCollection(rows, payload);
  if (!paged.ok) return paged;
  return {
    ok: true,
    pagination: paged.pagination,
    rows: paged.data,
    data: paged.data.map((item) => ({
      ruleDefinitionId: item.id,
      code: item.code,
      name: item.name,
      type: item.type,
      status: item.status,
      version: item.version
    }))
  };
}

export function historyContract(state, payload = {}) {
  ensureRuleState(state);
  const code = payload.code || payload.ruleCode;
  let rows = [...(state.ruleExecutionHistory || [])];
  if (code) rows = rows.filter((item) => item.code === code);
  const paged = paginateCollection(rows.reverse(), payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

export function statisticsContract(state) {
  return { ok: true, ...ruleDashboard(state) };
}

registerContractHandler("Rule.Evaluate.v1", (state, payload, ctx) => evaluateRuleContract(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Rule.EvaluateSet.v1", (state, payload, ctx) => evaluateRuleSet(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Rule.Simulate.v1", (state, payload, ctx) => simulateRule(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Rule.Test.v1", (state, payload, ctx) => runRuleTests(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ...ctxArgs(ctx)));
registerContractHandler("Rule.Publish.v1", (state, payload, ctx) => publishRule(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ...ctxArgs(ctx)));
registerContractHandler("Rule.Retire.v1", (state, payload, ctx) => retireRule(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ...ctxArgs(ctx)));
registerContractHandler("Rule.Approve.v1", (state, payload, ctx) => approveRule(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ctx.user, ctx.uid, ctx.now, payload.comment));
registerContractHandler("Rule.Reject.v1", (state, payload, ctx) => rejectRule(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ctx.user, ctx.uid, ctx.now, payload.reason));
registerContractHandler("Rule.SubmitTest.v1", (state, payload, ctx) => submitRuleForTesting(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ...ctxArgs(ctx)));
registerContractHandler("Rule.SubmitApproval.v1", (state, payload, ctx) => submitRuleForApproval(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"]), ...ctxArgs(ctx)));
registerContractHandler("Rule.Import.v1", (state, payload, ctx) => importRule(state, payload.document || payload, ...ctxArgs(ctx)));
registerContractHandler("Rule.Export.v1", (state, payload) => exportRule(state, idOf(payload, ["definitionId", "ruleDefinitionId", "code"])));
registerContractHandler("Rule.Replay.v1", (state, payload, ctx) => replayRuleHistory(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Rule.Get.v1", (state, payload) => getRuleContract(state, payload));
registerContractHandler("Rule.List.v1", (state, payload) => listRulesContract(state, payload));
registerContractHandler("Rule.History.v1", (state, payload) => historyContract(state, payload));
registerContractHandler("DecisionTable.Get.v1", (state, payload) => {
  const got = getRuleContract(state, payload);
  return got.ok ? { ok: true, table: got.table, ruleDefinitionId: got.ruleDefinitionId } : got;
});
registerContractHandler("DecisionTree.Get.v1", (state, payload) => {
  const got = getRuleContract(state, payload);
  return got.ok ? { ok: true, tree: got.tree, ruleDefinitionId: got.ruleDefinitionId } : got;
});
registerContractHandler("ScoringModel.Get.v1", (state, payload) => {
  const got = getRuleContract(state, payload);
  return got.ok ? { ok: true, model: got.model, ruleDefinitionId: got.ruleDefinitionId } : got;
});
registerContractHandler("Rule.Statistics.v1", (state) => statisticsContract(state));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

function gatewayQuery(fn) {
  return (state, request) => fn(state, requestFields(request));
}

registerGatewayHandler("rule.evaluate", gateway(evaluateRuleContract));
registerGatewayHandler("rule.simulate", gateway(simulateRule));
registerGatewayHandler("rule.test", gateway((state, payload, user, uid, now) => runRuleTests(state, idOf(payload, ["definitionId", "code"]), user, uid, now)));
registerGatewayHandler("rule.publish", gateway((state, payload, user, uid, now) => publishRule(state, idOf(payload, ["definitionId", "code"]), user, uid, now)));
registerGatewayHandler("rule.get", gatewayQuery(getRuleContract));
registerGatewayHandler("rule.list", gatewayQuery(listRulesContract));
registerGatewayHandler("rule.history", gatewayQuery(historyContract));
registerGatewayHandler("rule.statistics", (state) => statisticsContract(state));
