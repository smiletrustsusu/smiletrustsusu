import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  assertAiLifecycleBoundary,
  AI_ERROR_CODES
} from "../src/core/ai-lifecycle.js";
import {
  listAiPermissions,
  getAiPermission,
  assertAiScopeValid,
  canAssignAiPermission,
  canDelegateAiPermission,
  evaluateAiPermission,
  assertAiRegistryCompleteness,
  assertAiPermissionRegistryBoundary,
  AI_PERMISSION_REGISTRY
} from "../src/core/ai-permission-registry.js";
import {
  buildCompleteRolePermissionMatrix,
  getRolePermissionCell,
  assertAiSegregationOfDuties,
  assertDatasetReadyForUse,
  GRANT
} from "../src/core/ai-governance.js";
import {
  ensureAiState,
  runPrediction,
  detectFraud,
  scoreRisk,
  generateRecommendations,
  decideRecommendation,
  runForecast,
  detectAnomalies,
  registerModel,
  approveModelVersion,
  deployModel,
  enqueueTrainingJob,
  registerDataset,
  approveDataset,
  aiDashboard,
  assertAiBoundary
} from "../src/core/ai-ops.js";
import "../src/core/ai-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { ensureMonitoringState } from "../src/core/monitoring-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const developer = { id: "u-dev", role: "KBA", username: "kba-dev" };
const validator = { id: "u-val", role: "KBA", username: "kba-val" };
const deployer = { id: "u-ops", role: "KBA", username: "kba-ops" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const admin = { id: "u-admin", role: "Admin", username: "ama-admin" };
const now = "2026-09-12T10:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [
      { id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 2000 },
      { id: "col-2", customerId: "c-a", date: "2026-09-11", amount: 2000 },
      { id: "col-3", customerId: "c-b", date: "2026-09-12", amount: 1500 }
    ],
    customers: [
      { id: "c-a", name: "Ama", active: true },
      { id: "c-b", name: "Kofi", active: true }
    ],
    loans: [{ id: "ln-1", totalDue: 10000, amountPaid: 4000, status: "Active" }],
    withdrawals: [{ id: "w-1", customerId: "c-a", amount: 500 }],
    paymentTransactions: [
      { id: "pay-1", status: "Completed" },
      { id: "pay-2", status: "Failed" }
    ],
    ledgerEntries: [],
    audit: [
      { action: "Export.Customers" },
      { action: "Export.Loans" },
      { action: "Export.Audit" },
      { action: "Export.Savings" },
      { action: "Export.Accounting" },
      { action: "Auth.LoginFailed" },
      { action: "Auth.Deny" },
      { action: "Auth.Forbidden" }
    ],
    notifications: [],
    featureFlags: [{ id: "enableEnterpriseAi", enabled: true }]
  };
  ensureGatewayState(state);
  ensureMonitoringState(state);
  ensureAiState(state, uid, now);
  return state;
}

test("lifecycle boundary: advisory only, no HTTP servers, rule engine authoritative", () => {
  const boundary = assertAiLifecycleBoundary();
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.autoApprovesLoans, false);
  assert.equal(boundary.replacesRuleEngine, false);
  assert.equal(boundary.ruleEngineAuthoritative, true);
  assert.equal(boundary.restHttpServer, false);
  assert.equal(boundary.graphqlHttpServer, false);
  assert.equal(boundary.storesMomoPins, false);
  assert.equal(assertAiBoundary().customerBalanceUntouched, true);
  assert.ok(AI_ERROR_CODES["AI-001"]);
});

test("canonical permission registry is complete, unique, and auditable", () => {
  const completeness = assertAiRegistryCompleteness();
  assert.equal(completeness.ok, true);
  assert.equal(completeness.uniqueCount, completeness.count);
  assert.equal(completeness.duplicates.length, 0);
  assert.equal(completeness.missingFamilies.length, 0);
  assert.equal(completeness.allAuditable, true);
  assert.equal(assertAiPermissionRegistryBoundary().singleSourceOfTruth, true);
  assert.equal(listAiPermissions().length, AI_PERMISSION_REGISTRY.length);
  assert.ok(getAiPermission("AI.Model.Deploy"));
  assert.equal(getAiPermission("AI.Model.Deploy").auditable, true);
});

test("scope validation: platform-only cannot be Org", () => {
  const bad = assertAiScopeValid("AI.Platform.Admin", "Organization");
  assert.equal(bad.ok, false);
  assert.equal(bad.errorCode, "AI-031");
  const ok = assertAiScopeValid("AI.Platform.Admin", "Platform");
  assert.equal(ok.ok, true);
  const assign = canAssignAiPermission("Collector", "AI.Model.Deploy", "Platform");
  assert.equal(assign.ok, false);
  const delegate = canDelegateAiPermission("AI.Model.Deploy", "Organization");
  assert.equal(delegate.ok, false);
  const evalOwner = evaluateAiPermission(owner, "AI.Model.Deploy", "Platform");
  assert.equal(evalOwner.allowed, true);
});

test("assignment and delegation rules enforce registry scopes", () => {
  const assignOk = canAssignAiPermission("AI Platform Admin", "AI.Dataset.View", "Organization");
  assert.equal(assignOk.ok, true);
  const assignBadScope = canAssignAiPermission("AI Platform Admin", "AI.Dataset.View", "Self");
  assert.equal(assignBadScope.ok, false);
  const delOk = canDelegateAiPermission("AI.Prediction.View", "Branch");
  assert.equal(delOk.ok, true);
});

test("role matrix covers every registry permission without wildcards", () => {
  const matrix = buildCompleteRolePermissionMatrix();
  assert.ok(matrix.length >= 12);
  const codes = AI_PERMISSION_REGISTRY.map((p) => p.code);
  matrix.forEach((row) => {
    codes.forEach((code) => {
      assert.ok(["✓", "R", "A", "—"].includes(row[code]), `${row.role} ${code}`);
    });
  });
  assert.equal(getRolePermissionCell("Internal Auditor", "AI.Model.Deploy"), GRANT.NONE);
  assert.ok([GRANT.FULL, GRANT.APPROVE].includes(getRolePermissionCell("Model Validator", "AI.Model.Approve")));
});

test("predictions are explainable and versioned", () => {
  const state = blank();
  const beforeCollections = state.collections.length;
  const beforeInterest = state.settings.loanInterest;
  const result = runPrediction(state, { target: "growth" }, owner, uid, now);
  assert.equal(result.ok, true);
  assert.equal(result.advisory, true);
  assert.equal(result.postsCollections, false);
  assert.ok(result.explanation.predictionId);
  assert.ok(result.explanation.modelVersion);
  assert.ok(result.explanation.confidence >= 0 && result.explanation.confidence <= 1);
  assert.ok(Array.isArray(result.explanation.featureImportance));
  assert.ok(result.explanation.correlationId);
  assert.equal(result.explanation.replacesRuleEngine, false);
  assert.equal(state.collections.length, beforeCollections);
  assert.equal(state.settings.loanInterest, beforeInterest);
  assert.equal(state.settings.collectionDays, 31);
});

test("recommendations cannot post money or auto-approve loans", () => {
  const state = blank();
  const ledgerBefore = state.ledgerEntries.length;
  const rec = generateRecommendations(state, { kind: "loan_support" }, owner, uid, now);
  assert.equal(rec.ok, true);
  assert.equal(rec.postsMoney, false);
  assert.equal(rec.autoApprovesLoan, false);
  assert.equal(rec.postsCollections, false);
  const decided = decideRecommendation(state, rec.recommendations[0].id, "accepted", "", owner, uid, now);
  assert.equal(decided.ok, true);
  assert.equal(decided.postsMoney, false);
  assert.equal(decided.autoApprovesLoan, false);
  assert.equal(decided.mutatesLedger, false);
  assert.equal(state.ledgerEntries.length, ledgerBefore);
  const override = decideRecommendation(state, rec.recommendations[0].id, "overridden", "", owner, uid, now);
  assert.equal(override.ok, false);
  assert.equal(override.errorCode, "AI-018");
});

test("fraud alerts created without mutating ledger", () => {
  const state = blank();
  const ledgerBefore = state.ledgerEntries.length;
  const collectionsBefore = state.collections.length;
  const fraud = detectFraud(state, {}, owner, uid, now);
  assert.equal(fraud.ok, true);
  assert.ok(fraud.count >= 1);
  assert.equal(fraud.mutatesLedger, false);
  assert.equal(fraud.postsCollections, false);
  assert.equal(state.ledgerEntries.length, ledgerBefore);
  assert.equal(state.collections.length, collectionsBefore);
  assert.ok(state.aiFraudAlerts.length >= 1);
});

test("model deploy requires approval and SoD blocks developer self-approve", () => {
  const state = blank();
  const registered = registerModel(state, { code: "MDL-TEST-SOD", name: "SoD Test", version: "1.0.0" }, developer, uid, now);
  assert.equal(registered.ok, true);
  const selfApprove = approveModelVersion(state, registered.version.id, developer, uid, now);
  assert.equal(selfApprove.ok, false);
  assert.equal(selfApprove.errorCode, "AI-040");
  const sod = assertAiSegregationOfDuties({
    action: "approve",
    actorId: developer.id,
    creatorId: developer.id
  });
  assert.equal(sod.ok, false);
  const approved = approveModelVersion(state, registered.version.id, validator, uid, now);
  assert.equal(approved.ok, true);
  const selfDeploy = deployModel(state, registered.version.id, developer, uid, now);
  assert.equal(selfDeploy.ok, false);
  assert.equal(selfDeploy.errorCode, "AI-015");
  const deployed = deployModel(state, registered.version.id, deployer, uid, now);
  assert.equal(deployed.ok, true);
});

test("dataset must be approved and checksum ok before train/inference", () => {
  const state = blank();
  const created = registerDataset(state, {
    code: "DS-UNAPPROVED",
    name: "Unapproved",
    classification: "Internal",
    qualityScore: 0.9
  }, owner, uid, now);
  assert.equal(created.ok, true);
  assert.equal(created.dataset.status, "registered");
  const gate = assertDatasetReadyForUse(created.dataset);
  assert.equal(gate.ok, false);
  assert.equal(gate.errorCode, "AI-007");
  const train = enqueueTrainingJob(state, { datasetCode: "DS-UNAPPROVED" }, owner, uid, now);
  assert.equal(train.ok, false);
  assert.equal(train.errorCode, "AI-014");
  const predict = runPrediction(state, { target: "growth", datasetCode: "DS-UNAPPROVED" }, owner, uid, now);
  assert.equal(predict.ok, false);
  assert.equal(predict.errorCode, "AI-007");
  const approved = approveDataset(state, created.dataset.id, validator, uid, now);
  assert.equal(approved.ok, true);
  const trainOk = enqueueTrainingJob(state, { datasetCode: "DS-UNAPPROVED" }, owner, uid, now);
  assert.equal(trainOk.ok, true);
});

test("RBAC denials for Collector; Admin can view/predict", () => {
  assert.equal(canAction(collector, "Ai.View"), false);
  assert.equal(canAction(collector, "Ai.Predict"), false);
  assert.equal(canAction(collector, "Ai.Admin"), false);
  assert.equal(canAction(admin, "Ai.View"), true);
  assert.equal(canAction(admin, "Ai.Predict"), true);
  assert.equal(canAction(admin, "Ai.Admin"), false);
  assert.equal(canAction(owner, "Ai.Admin"), true);
  const state = blank();
  const denied = runPrediction(state, { target: "growth" }, collector, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "AI-002");
});

test("gateway and contracts work for Module 29", () => {
  const state = blank();
  assert.ok(getContract("Ai.Predict.v1"));
  assert.ok(getContract("Ai.Fraud.Detect.v1"));
  assert.ok(getContract("Ai.Model.Deploy.v1"));
  const viaContract = invokeContract(state, { contractId: "Ai.Health.v1", fromModule: 20, payload: {} }, { user: owner, uid, now });
  assert.equal(viaContract.ok, true);
  const predict = invokeContract(state, { contractId: "Ai.Predict.v1", fromModule: 20, payload: { target: "savings" } }, { user: owner, uid, now });
  assert.equal(predict.ok, true);
  const viaGw = dispatchGatewayRequest(state, {
    route: "ai.health",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(viaGw.ok, true);
  const dashGw = dispatchGatewayRequest(state, {
    route: "ai.statistics",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(dashGw.ok, true);
  const dash = aiDashboard(state, owner, uid, now);
  assert.ok(dash.models >= 1);
  assert.equal(dash.advisoryOnly, true);
  assert.equal(dash.ruleEngineAuthoritative, true);
  const risk = scoreRisk(state, { entityType: "Customer" }, owner, uid, now);
  assert.equal(risk.ok, true);
  const forecast = runForecast(state, { horizon: "weekly" }, owner, uid, now);
  assert.equal(forecast.ok, true);
  assert.equal(forecast.unit, "pesewas");
  const anom = detectAnomalies(state, {}, owner, uid, now);
  assert.equal(anom.ok, true);
});
