/**
 * Module 29 public AI contracts and Module 20 gateway mappings.
 * In-process only — no REST/GraphQL HTTP server.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
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
  rollbackModel,
  enqueueTrainingJob,
  detectDrift,
  listModels,
  listFeatures,
  listDatasets,
  registerDataset,
  approveDataset,
  aiDashboard,
  aiReports,
  aiHealth,
  aiGovernanceView,
  AI_ERROR_CODES
} from "./ai-ops.js";

export const AI_API_VERSION = "1.0.0";
export { AI_ERROR_CODES };

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

registerContractHandler("Ai.Predict.v1", (state, payload, ctx) => runPrediction(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Fraud.Detect.v1", (state, payload, ctx) => detectFraud(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Risk.Score.v1", (state, payload, ctx) => scoreRisk(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Recommend.v1", (state, payload, ctx) => generateRecommendations(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Recommend.Decide.v1", (state, payload, ctx) => decideRecommendation(state, payload.recommendationId || payload.id, payload.decision, payload.justification, ...ctxArgs(ctx)));
registerContractHandler("Ai.Forecast.v1", (state, payload, ctx) => runForecast(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Anomaly.Detect.v1", (state, payload, ctx) => detectAnomalies(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.Register.v1", (state, payload, ctx) => registerModel(state, payload.model || payload, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.Approve.v1", (state, payload, ctx) => approveModelVersion(state, payload.modelVersionId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.Deploy.v1", (state, payload, ctx) => deployModel(state, payload.modelVersionId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.Rollback.v1", (state, payload, ctx) => rollbackModel(state, payload.deploymentId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.Train.v1", (state, payload, ctx) => enqueueTrainingJob(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Model.List.v1", (state, payload) => listModels(state, payload || {}));
registerContractHandler("Ai.Feature.List.v1", (state) => listFeatures(state));
registerContractHandler("Ai.Dataset.Register.v1", (state, payload, ctx) => registerDataset(state, payload.dataset || payload, ...ctxArgs(ctx)));
registerContractHandler("Ai.Dataset.Approve.v1", (state, payload, ctx) => approveDataset(state, payload.datasetId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Ai.Dataset.List.v1", (state, payload, ctx) => listDatasets(state, ctx.user));
registerContractHandler("Ai.Drift.Detect.v1", (state, payload, ctx) => detectDrift(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Ai.Governance.Dashboard.v1", (state, payload, ctx) => aiGovernanceView(state, ctx.user));
registerContractHandler("Ai.Dashboard.v1", (state, payload, ctx) => ({ ok: true, ...aiDashboard(state, ctx.user, ctx.uid, ctx.now) }));
registerContractHandler("Ai.Statistics.v1", (state, payload, ctx) => ({ ok: true, ...aiDashboard(state, ctx.user, ctx.uid, ctx.now) }));
registerContractHandler("Ai.Health.v1", (state, payload, ctx) => ({ ok: true, ...aiHealth(state, ctx.now) }));
registerContractHandler("Ai.Reports.v1", (state, payload) => ({ ok: true, ...aiReports(state, payload.reportId || payload.id) }));
registerContractHandler("Ai.Prediction.List.v1", (state, payload) => {
  ensureAiState(state);
  const paged = paginateCollection(state.aiPredictionResults || [], payload || {});
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
});

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("ai.health", (state, request, ctx) => ({ ok: true, ...aiHealth(state, ctx.now) }));
registerGatewayHandler("ai.dashboard", (state, request, ctx) => ({ ok: true, ...aiDashboard(state, ctx.user, ctx.uid, ctx.now) }));
registerGatewayHandler("ai.predict", gateway((state, payload, user, uid, now) => runPrediction(state, payload, user, uid, now)));
registerGatewayHandler("ai.fraud.detect", gateway((state, payload, user, uid, now) => detectFraud(state, payload, user, uid, now)));
registerGatewayHandler("ai.risk.score", gateway((state, payload, user, uid, now) => scoreRisk(state, payload, user, uid, now)));
registerGatewayHandler("ai.recommend", gateway((state, payload, user, uid, now) => generateRecommendations(state, payload, user, uid, now)));
registerGatewayHandler("ai.forecast", gateway((state, payload, user, uid, now) => runForecast(state, payload, user, uid, now)));
registerGatewayHandler("ai.anomaly.detect", gateway((state, payload, user, uid, now) => detectAnomalies(state, payload, user, uid, now)));
registerGatewayHandler("ai.model.list", (state, request) => listModels(state, requestFields(request)));
registerGatewayHandler("ai.model.deploy", gateway((state, payload, user, uid, now) => deployModel(state, payload.modelVersionId || payload.id, user, uid, now)));
registerGatewayHandler("ai.feature.list", (state) => listFeatures(state));
registerGatewayHandler("ai.dataset.list", (state, request, ctx) => listDatasets(state, ctx.user));
registerGatewayHandler("ai.governance.dashboard", (state, request, ctx) => aiGovernanceView(state, ctx.user));
registerGatewayHandler("ai.statistics", (state, request, ctx) => ({ ok: true, ...aiDashboard(state, ctx.user, ctx.uid, ctx.now) }));
