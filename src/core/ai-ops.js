/**
 * Module 29 — Enterprise AI, ML & Predictive Intelligence (in-process).
 * Advisory / heuristic only. Does NOT replace Module 24 Rule Engine.
 * Never auto-approves loans/withdrawals or posts collections / ledger entries.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric, recordLog } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled } from "./system-config.js";
import {
  AI_PLATFORM_VERSION,
  MODEL_STATES,
  canTransitionModel,
  SEEDED_MODELS,
  SEEDED_FEATURES,
  SEEDED_DATASETS,
  AI_ERROR_CODES,
  AI_ROUTE_CATALOG,
  assertAiLifecycleBoundary,
  RECOMMENDATION_DECISIONS
} from "./ai-lifecycle.js";
import {
  assertDatasetReadyForUse,
  assertAiSegregationOfDuties,
  privacyMinimizationFields,
  maskSensitiveValue,
  governanceDashboard,
  evaluateAiPermission,
  getAiPermission
} from "./ai-governance.js";

export const AI_SCHEMA_VERSION = "1.0.0";
export { AI_ERROR_CODES };

const AI_ARRAYS = [
  "aiModels",
  "aiModelVersions",
  "aiModelRegistry",
  "aiFeatureRegistry",
  "aiFeatureVersions",
  "aiDatasets",
  "aiPredictionRequests",
  "aiPredictionResults",
  "aiFraudAlerts",
  "aiAnomalyEvents",
  "aiRecommendationHistory",
  "aiModelTrainingJobs",
  "aiModelDeployments",
  "aiDriftEvents",
  "aiInferenceLogs",
  "aiHumanFeedback",
  "aiPermissionGrants",
  "aiActivityLogs"
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

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function requireAction(user, action) {
  if (!permitted(user, action)) {
    return { ok: false, error: AI_ERROR_CODES["AI-002"], errorCode: "AI-002", http: 403 };
  }
  return { ok: true };
}

function aiEnabled(state) {
  return isFeatureEnabled(state, "enableEnterpriseAi") !== false;
}

function auditAi(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "29",
    ...extras
  }, uid);
}

function emitAiEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 29,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "AI"
  }, uid, now);
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function mean(nums) {
  const vals = nums.filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sumPesewas(rows, field = "amount") {
  return (rows || []).reduce((acc, row) => acc + Math.round(Number(row[field]) || 0), 0);
}

function correlationId(uid, now) {
  return `corr-ai-${payloadHash(`${uid?.("x") || "x"}-${nowIso(now)}`).slice(0, 16)}`;
}

function buildExplanation({ predictionId, modelVersion, confidence, featureImportance, factors, explanation, timestamp, correlationId: cid }) {
  return {
    predictionId,
    modelVersion,
    confidence: clamp01(confidence),
    featureImportance: featureImportance || [],
    contributingFactors: factors || [],
    explanation: explanation || "Heuristic advisory output",
    timestamp,
    correlationId: cid,
    advisory: true,
    replacesRuleEngine: false
  };
}

function seedModels(uid, now) {
  const ts = nowIso(now);
  return SEEDED_MODELS.map((item) => {
    const modelId = `aim-${item.code.toLowerCase()}`;
    const versionId = `${modelId}-v1`;
    return {
      model: {
        id: modelId,
        code: item.code,
        name: item.name,
        family: item.family,
        status: "approved",
        createdAt: ts,
        createdBy: "system"
      },
      version: {
        id: versionId,
        modelId,
        version: item.version,
        status: "approved",
        approvedAt: ts,
        approvedBy: "system-validator",
        createdBy: "system-ml",
        lineage: { parent: null, features: SEEDED_FEATURES.slice(0, 4).map((f) => f.code) },
        checksum: payloadHash(item.code + item.version),
        createdAt: ts
      },
      registry: {
        id: `reg-${item.code.toLowerCase()}`,
        modelId,
        modelVersionId: versionId,
        status: "approved",
        production: item.code === "MDL-FRAUD-V1" || item.code === "MDL-GROWTH-V1" || item.code === "MDL-CASHFLOW-V1",
        createdAt: ts
      }
    };
  });
}

function seedFeatures(uid, now) {
  const ts = nowIso(now);
  return SEEDED_FEATURES.map((item) => {
    const id = `aif-${item.code.toLowerCase()}`;
    return {
      feature: {
        id,
        code: item.code,
        name: item.name,
        dtype: item.dtype,
        status: "approved",
        version: "1.0.0",
        qualityScore: 0.92,
        lineage: { source: "app_state", transforms: ["aggregate"] },
        createdAt: ts
      },
      version: {
        id: `${id}-v1`,
        featureId: id,
        version: "1.0.0",
        status: "approved",
        createdAt: ts
      }
    };
  });
}

function seedDatasets(uid, now) {
  const ts = nowIso(now);
  return SEEDED_DATASETS.map((item) => ({
    id: `aids-${item.code.toLowerCase()}`,
    code: item.code,
    name: item.name,
    classification: item.classification,
    status: "approved",
    checksum: payloadHash(item.code + "-seed-v1"),
    checksumInvalid: false,
    qualityScore: 0.9,
    retentionDays: 365,
    approvedAt: ts,
    approvedBy: "system-steward",
    createdBy: "system-data",
    lineage: { sources: ["collections", "loans", "payments", "audit"] },
    createdAt: ts
  }));
}

export function ensureAiState(state = {}, uid, now) {
  AI_ARRAYS.forEach((key) => {
    if (!Array.isArray(state[key])) state[key] = [];
  });
  if (!state.aiPlatformMeta) {
    state.aiPlatformMeta = {
      version: AI_PLATFORM_VERSION,
      shadowMode: false,
      canaryMode: false,
      seededAt: nowIso(now)
    };
  }
  if (!state.aiModels.length) {
    const seeded = seedModels(uid, now);
    seeded.forEach((row) => {
      state.aiModels.push(row.model);
      state.aiModelVersions.push(row.version);
      state.aiModelRegistry.push(row.registry);
      if (row.registry.production) {
        state.aiModelDeployments.push({
          id: `deploy-${row.model.code.toLowerCase()}`,
          modelId: row.model.id,
          modelVersionId: row.version.id,
          environment: "production",
          status: "deployed",
          approvedBy: "system-validator",
          deployedBy: "system-mlops",
          deployedAt: nowIso(now)
        });
        row.model.status = "deployed";
        row.version.status = "deployed";
        row.registry.status = "deployed";
      }
    });
  }
  if (!state.aiFeatureRegistry.length) {
    seedFeatures(uid, now).forEach((row) => {
      state.aiFeatureRegistry.push(row.feature);
      state.aiFeatureVersions.push(row.version);
    });
  }
  if (!state.aiDatasets.length) {
    state.aiDatasets.push(...seedDatasets(uid, now));
  }
  return state;
}

function findProductionModel(state, familyOrCode) {
  ensureAiState(state);
  const deploy = (state.aiModelDeployments || []).find((d) => d.status === "deployed" && d.environment === "production");
  if (familyOrCode) {
    const model = (state.aiModels || []).find((m) => m.code === familyOrCode || m.family === familyOrCode);
    if (model) {
      const d = (state.aiModelDeployments || []).find((x) => x.modelId === model.id && x.status === "deployed");
      if (d) {
        const version = (state.aiModelVersions || []).find((v) => v.id === d.modelVersionId);
        return { model, version, deployment: d };
      }
    }
  }
  if (!deploy) return null;
  const model = (state.aiModels || []).find((m) => m.id === deploy.modelId);
  const version = (state.aiModelVersions || []).find((v) => v.id === deploy.modelVersionId);
  return { model, version, deployment: deploy };
}

function requireDatasetGate(state, datasetCode) {
  const ds = (state.aiDatasets || []).find((d) => d.code === datasetCode || d.id === datasetCode);
  return assertDatasetReadyForUse(ds);
}

function extractFeatures(state) {
  const collections = state.collections || [];
  const loans = state.loans || [];
  const customers = state.customers || [];
  const payments = state.paymentTransactions || [];
  const withdrawals = state.withdrawals || [];
  const audit = state.audit || [];

  const collections7d = sumPesewas(collections);
  const activeCustomers = customers.filter((c) => c.active !== false).length;
  const loanUtil = loans.length
    ? mean(loans.map((l) => {
      const due = Number(l.totalDue) || 0;
      const paid = Number(l.amountPaid) || 0;
      return due > 0 ? paid / due : 0;
    }))
    : 0;
  const payFail = payments.length
    ? payments.filter((p) => String(p.status || "").toLowerCase().includes("fail")).length / payments.length
    : 0;
  const withdrawalVelocity = withdrawals.length / Math.max(1, activeCustomers);
  const authFails = audit.filter((a) => /auth|login|deny|forbidden/i.test(String(a.action || a.details || ""))).length;
  const exportBurst = audit.filter((a) => /export/i.test(String(a.action || ""))).length;

  return {
    "FEAT-COLLECTIONS-7D": collections7d,
    "FEAT-LOAN-UTIL": Number(loanUtil.toFixed(4)),
    "FEAT-ACTIVE-CUSTOMERS": activeCustomers,
    "FEAT-PAYMENT-FAIL-RATE": Number(payFail.toFixed(4)),
    "FEAT-WITHDRAWAL-VELOCITY": Number(withdrawalVelocity.toFixed(4)),
    "FEAT-BRANCH-VOLUME": collections.length,
    "FEAT-AUTH-FAILS": authFails,
    "FEAT-EXPORT-BURST": exportBurst
  };
}

function featureImportanceFrom(features, weights) {
  return Object.keys(weights).map((key) => ({
    feature: key,
    importance: clamp01(weights[key]),
    value: features[key]
  })).sort((a, b) => b.importance - a.importance);
}

export function runPrediction(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const dsGate = requireDatasetGate(state, payload.datasetCode || "DS-COLLECTIONS-AGG");
  if (!dsGate.ok) return dsGate;

  const target = payload.target || "growth";
  const modelRef = findProductionModel(state, payload.modelCode) || findProductionModel(state, "prediction") || findProductionModel(state);
  if (!modelRef?.version) return { ok: false, error: AI_ERROR_CODES["AI-017"], errorCode: "AI-017", http: 409 };

  const features = extractFeatures(state);
  const weights = {
    "FEAT-ACTIVE-CUSTOMERS": 0.35,
    "FEAT-COLLECTIONS-7D": 0.3,
    "FEAT-BRANCH-VOLUME": 0.2,
    "FEAT-LOAN-UTIL": 0.15
  };
  let score = 0.5;
  if (target === "growth") score = clamp01(0.4 + features["FEAT-ACTIVE-CUSTOMERS"] / 100);
  else if (target === "savings") score = clamp01(0.3 + Math.min(features["FEAT-COLLECTIONS-7D"] / 100000, 0.5));
  else if (target === "loan_demand") score = clamp01(0.45 + (1 - features["FEAT-LOAN-UTIL"]) * 0.4);
  else if (target === "default") score = clamp01(0.2 + features["FEAT-PAYMENT-FAIL-RATE"] * 0.6 + (1 - features["FEAT-LOAN-UTIL"]) * 0.2);
  else if (target === "cash_flow") score = clamp01(0.5 + Math.min(features["FEAT-COLLECTIONS-7D"] / 200000, 0.4) - features["FEAT-WITHDRAWAL-VELOCITY"] * 0.1);
  else if (target === "revenue") score = clamp01(0.4 + Math.min(features["FEAT-BRANCH-VOLUME"] / 50, 0.4));
  else if (target === "productivity") score = clamp01(0.5 + Math.min(features["FEAT-BRANCH-VOLUME"] / 40, 0.4));
  else if (target === "payment_success") score = clamp01(1 - features["FEAT-PAYMENT-FAIL-RATE"]);

  const cid = correlationId(uid, now);
  const predictionId = newId("aipred", uid);
  const ts = nowIso(now);
  const confidence = clamp01(0.55 + score * 0.35);
  const importance = featureImportanceFrom(features, weights);
  const factors = importance.slice(0, 3).map((f) => `${f.feature}=${f.value}`);
  const xai = buildExplanation({
    predictionId,
    modelVersion: modelRef.version.version,
    confidence,
    featureImportance: importance,
    factors,
    explanation: `Advisory ${target} estimate from heuristic model ${modelRef.model.code} v${modelRef.version.version}. Does not authorize financial posts.`,
    timestamp: ts,
    correlationId: cid
  });

  const request = {
    id: newId("aireq", uid),
    predictionId,
    target,
    modelId: modelRef.model.id,
    modelVersionId: modelRef.version.id,
    features: privacyMinimizationFields(features),
    createdAt: ts,
    createdBy: user?.id || "",
    correlationId: cid
  };
  const result = {
    id: predictionId,
    requestId: request.id,
    target,
    score,
    value: Math.round(score * 1000) / 1000,
    modelCode: modelRef.model.code,
    modelVersion: modelRef.version.version,
    ...xai,
    postsCollections: false,
    autoApprove: false
  };

  state.aiPredictionRequests.push(request);
  state.aiPredictionResults.push(result);
  state.aiInferenceLogs.push({
    id: newId("ailog", uid),
    predictionId,
    modelVersionId: modelRef.version.id,
    latencyMs: 2,
    createdAt: ts,
    correlationId: cid
  });

  auditAi(state, "Ai.Predict", `Prediction ${target} ${predictionId}`, user, { category: "operational" }, uid);
  emitAiEvent(state, "PredictionGenerated", { predictionId, target, modelVersion: modelRef.version.version }, { uid, now, correlationId: cid, aggregateId: predictionId });
  recordMetric(state, { name: "ai.prediction.generated", module: "29", value: 1 }, uid, now);
  queueNotification(state, {
    event: "ai_prediction_generated",
    channel: "In-App",
    userId: user?.id || "",
    vars: { name: user?.username || "Team", target, predictionId },
    uid
  });

  return { ok: true, result, explanation: xai, postsCollections: false, advisory: true };
}

export function detectFraud(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const dsGate = requireDatasetGate(state, "DS-PAYMENT-EVENTS");
  if (!dsGate.ok) return dsGate;

  const features = extractFeatures(state);
  const alerts = [];
  const collections = state.collections || [];
  const seen = new Map();
  collections.forEach((c) => {
    const key = `${c.customerId}|${c.date}|${c.amount}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  for (const [key, count] of seen.entries()) {
    if (count >= 2) {
      alerts.push({
        type: "duplicate_txn",
        severity: "high",
        detail: `Duplicate pattern ${key} x${count}`,
        score: 0.85
      });
    }
  }
  if (features["FEAT-WITHDRAWAL-VELOCITY"] > 2) {
    alerts.push({ type: "suspicious_withdrawal", severity: "medium", detail: "Elevated withdrawal velocity", score: 0.7 });
  }
  if (features["FEAT-AUTH-FAILS"] >= 3) {
    alerts.push({ type: "identity_auth_anomaly", severity: "high", detail: "Auth failure cluster", score: 0.8 });
  }
  if (features["FEAT-EXPORT-BURST"] >= 5) {
    alerts.push({ type: "export_abuse", severity: "critical", detail: "Export burst detected", score: 0.9 });
  }
  if (features["FEAT-PAYMENT-FAIL-RATE"] > 0.4) {
    alerts.push({ type: "api_abuse_or_payment_anomaly", severity: "medium", detail: "High payment failure rate", score: 0.65 });
  }

  const modelRef = findProductionModel(state, "MDL-FRAUD-V1") || findProductionModel(state, "fraud");
  const ts = nowIso(now);
  const cid = correlationId(uid, now);
  const created = alerts.map((alert) => {
    const row = {
      id: newId("aifraud", uid),
      ...alert,
      status: "open",
      modelVersion: modelRef?.version?.version || "1.0.0",
      createdAt: ts,
      correlationId: cid,
      mutatesLedger: false
    };
    state.aiFraudAlerts.push(row);
    return row;
  });

  auditAi(state, "Ai.Fraud.Detect", `Fraud scan alerts=${created.length}`, user, {}, uid);
  created.forEach((alert) => {
    emitAiEvent(state, "FraudAlertCreated", { alertId: alert.id, type: alert.type, severity: alert.severityity }, { uid, now, correlationId: cid, aggregateId: alert.id });
    recordMetric(state, { name: "ai.fraud.alert", module: "29", value: 1, tags: { severity: alert.severityity } }, uid, now);
  });
  recordLog(state, { level: "warn", message: `AI fraud scan produced ${created.length} alerts`, module: "29" }, uid, now);
  queueNotification(state, {
    event: "ai_fraud_alert",
    channel: "In-App",
    userId: user?.id || "",
    vars: { name: user?.username || "Team", count: created.length },
    uid
  });

  return {
    ok: true,
    alerts: created,
    count: created.length,
    mutatesLedger: false,
    postsCollections: false,
    workflowHook: created.length ? "FraudReview" : null
  };
}

export function scoreRisk(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const entityType = payload.entityType || "Customer";
  const features = extractFeatures(state);
  const configVersion = payload.configVersion || "risk-cfg-1.0.0";
  let score = 50;
  if (entityType === "Customer") score = Math.round(clamp01(features["FEAT-PAYMENT-FAIL-RATE"] * 0.5 + (1 - features["FEAT-LOAN-UTIL"]) * 0.3 + features["FEAT-WITHDRAWAL-VELOCITY"] * 0.2) * 100);
  else if (entityType === "Loan") score = Math.round(clamp01((1 - features["FEAT-LOAN-UTIL"]) * 0.7 + features["FEAT-PAYMENT-FAIL-RATE"] * 0.3) * 100);
  else if (entityType === "Collector") score = Math.round(clamp01(0.3 + features["FEAT-EXPORT-BURST"] / 20) * 100);
  else if (entityType === "Branch") score = Math.round(clamp01(0.4 + features["FEAT-AUTH-FAILS"] / 20) * 100);
  else if (entityType === "Payment") score = Math.round(clamp01(features["FEAT-PAYMENT-FAIL-RATE"]) * 100);

  const cid = correlationId(uid, now);
  const predictionId = newId("airisk", uid);
  const xai = buildExplanation({
    predictionId,
    modelVersion: configVersion,
    confidence: 0.7,
    featureImportance: featureImportanceFrom(features, {
      "FEAT-PAYMENT-FAIL-RATE": 0.4,
      "FEAT-LOAN-UTIL": 0.3,
      "FEAT-WITHDRAWAL-VELOCITY": 0.2,
      "FEAT-AUTH-FAILS": 0.1
    }),
    factors: [`entityType=${entityType}`, `score=${score}`],
    explanation: `Configurable risk score for ${entityType}. Advisory only; Rule Engine remains authoritative.`,
    timestamp: nowIso(now),
    correlationId: cid
  });

  state.aiPredictionResults.push({
    id: predictionId,
    target: "risk_score",
    entityType,
    entityId: payload.entityId || "",
    score,
    configVersion,
    ...xai
  });

  return { ok: true, entityType, score, configVersion, explanation: xai, advisory: true };
}

export function generateRecommendations(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const kind = payload.kind || "retention";
  const features = extractFeatures(state);
  const items = [];
  if (kind === "loan_support" || kind === "all") {
    items.push({ kind: "loan_support", title: "Review high-utilization loans", rationale: "Loan util indicates support opportunity", priority: features["FEAT-LOAN-UTIL"] > 0.7 ? "high" : "medium" });
  }
  if (kind === "collector_assignment" || kind === "all") {
    items.push({ kind: "collector_assignment", title: "Rebalance collector workload", rationale: `Branch volume ${features["FEAT-BRANCH-VOLUME"]}`, priority: "medium" });
  }
  if (kind === "retention" || kind === "all") {
    items.push({ kind: "retention", title: "Follow up inactive savers", rationale: "Growth heuristic suggests retention campaign", priority: "medium" });
  }
  if (kind === "campaign" || kind === "all") {
    items.push({ kind: "campaign", title: "Savings boost campaign", rationale: "Collections trajectory advisory", priority: "low" });
  }
  if (kind === "follow_up" || kind === "all") {
    items.push({ kind: "follow_up", title: "Payment failure follow-ups", rationale: `Fail rate ${features["FEAT-PAYMENT-FAIL-RATE"]}`, priority: features["FEAT-PAYMENT-FAIL-RATE"] > 0.2 ? "high" : "low" });
  }
  if (kind === "portfolio" || kind === "branch_ops" || kind === "all") {
    items.push({ kind: "portfolio", title: "Branch ops review", rationale: "Advisory portfolio/branch ops suggestion", priority: "medium" });
  }

  const ts = nowIso(now);
  const created = items.map((item) => {
    const row = {
      id: newId("airec", uid),
      ...item,
      status: "pending",
      decision: "pending",
      justification: "",
      advisory: true,
      postsMoney: false,
      autoApprovesLoan: false,
      createdAt: ts,
      createdBy: user?.id || ""
    };
    state.aiRecommendationHistory.push(row);
    return row;
  });

  auditAi(state, "Ai.Recommend", `Generated ${created.length} recommendations`, user, {}, uid);
  return {
    ok: true,
    recommendations: created,
    advisory: true,
    postsMoney: false,
    autoApprovesLoan: false,
    postsCollections: false
  };
}

export function decideRecommendation(state, recommendationId, decision, justification, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;
  if (!RECOMMENDATION_DECISIONS.includes(decision) || decision === "pending") {
    return { ok: false, error: "Invalid decision", errorCode: "AI-018", http: 400 };
  }
  if ((decision === "rejected" || decision === "overridden") && !String(justification || "").trim()) {
    return { ok: false, error: AI_ERROR_CODES["AI-018"], errorCode: "AI-018", http: 400 };
  }
  const row = (state.aiRecommendationHistory || []).find((r) => r.id === recommendationId);
  if (!row) return { ok: false, error: "Recommendation not found", errorCode: "AI-008", http: 404 };

  row.decision = decision;
  row.status = decision;
  row.justification = justification || "";
  row.decidedBy = user?.id || "";
  row.decidedAt = nowIso(now);
  state.aiHumanFeedback.push({
    id: newId("aifb", uid),
    recommendationId,
    decision,
    justification: row.justification,
    createdAt: row.decidedAt,
    learningMetadataOnly: true
  });

  return {
    ok: true,
    recommendation: row,
    postsMoney: false,
    autoApprovesLoan: false,
    postsCollections: false,
    mutatesLedger: false
  };
}

export function runForecast(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const horizon = payload.horizon || "weekly";
  if (!["daily", "weekly", "monthly"].includes(horizon)) {
    return { ok: false, error: AI_ERROR_CODES["AI-012"], errorCode: "AI-012", http: 400 };
  }
  const dsGate = requireDatasetGate(state, "DS-COLLECTIONS-AGG");
  if (!dsGate.ok) return dsGate;

  const features = extractFeatures(state);
  const mult = horizon === "daily" ? 1 : horizon === "weekly" ? 7 : 30;
  const base = Math.max(1, features["FEAT-COLLECTIONS-7D"] / 7);
  const forecast = {
    horizon,
    collectionsPesewas: Math.round(base * mult),
    repaymentsPesewas: Math.round(base * mult * 0.35),
    liquidityPesewas: Math.round(base * mult * 0.8),
    customerGrowth: Math.round(features["FEAT-ACTIVE-CUSTOMERS"] * (horizon === "monthly" ? 0.05 : 0.01)),
    workloadUnits: Math.round(features["FEAT-BRANCH-VOLUME"] * (mult / 7)),
    storageEstimateMb: Math.round(10 + features["FEAT-BRANCH-VOLUME"] * 0.5),
    apiTrafficEstimate: Math.round(100 + features["FEAT-BRANCH-VOLUME"] * 12)
  };

  const modelRef = findProductionModel(state, "MDL-CASHFLOW-V1") || findProductionModel(state, "forecast");
  const predictionId = newId("aifc", uid);
  const xai = buildExplanation({
    predictionId,
    modelVersion: modelRef?.version?.version || "1.0.0",
    confidence: 0.62,
    featureImportance: featureImportanceFrom(features, { "FEAT-COLLECTIONS-7D": 0.5, "FEAT-ACTIVE-CUSTOMERS": 0.3, "FEAT-BRANCH-VOLUME": 0.2 }),
    factors: [`horizon=${horizon}`, `baseDaily=${base}`],
    explanation: "Heuristic forecast from app aggregates (pesewas). Advisory only.",
    timestamp: nowIso(now),
    correlationId: correlationId(uid, now)
  });

  state.aiPredictionResults.push({ id: predictionId, target: "forecast", horizon, forecast, ...xai });
  return { ok: true, forecast, explanation: xai, advisory: true, unit: "pesewas" };
}

export function detectAnomalies(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  if (!aiEnabled(state)) return { ok: false, error: AI_ERROR_CODES["AI-001"], errorCode: "AI-001", http: 503 };
  const gate = requireAction(user, "Ai.Predict");
  if (!gate.ok) return gate;

  const features = extractFeatures(state);
  const events = [];
  const checks = [
    { metric: "transactions", value: features["FEAT-BRANCH-VOLUME"], threshold: 0, type: "transaction_volume" },
    { metric: "auth", value: features["FEAT-AUTH-FAILS"], threshold: 2, type: "auth_anomaly" },
    { metric: "payments", value: features["FEAT-PAYMENT-FAIL-RATE"], threshold: 0.25, type: "payment_anomaly" },
    { metric: "exports", value: features["FEAT-EXPORT-BURST"], threshold: 4, type: "api_infra_anomaly" }
  ];
  const ts = nowIso(now);
  checks.forEach((check) => {
    if (check.value > check.threshold) {
      const row = {
        id: newId("aianom", uid),
        type: check.type,
        metric: check.metric,
        value: check.value,
        threshold: check.threshold,
        severity: check.value > check.threshold * 2 ? "high" : "medium",
        createdAt: ts,
        status: "open"
      };
      state.aiAnomalyEvents.push(row);
      events.push(row);
    }
  });

  return { ok: true, events, count: events.length, mutatesLedger: false };
}

export function registerModel(state, input = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Model");
  if (!gate.ok) return gate;
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "code required", errorCode: "AI-020", http: 400 };
  const model = {
    id: newId("aim", uid),
    code,
    name: input.name || code,
    family: input.family || "prediction",
    status: "registered",
    createdAt: nowIso(now),
    createdBy: user?.id || ""
  };
  const version = {
    id: newId("aimv", uid),
    modelId: model.id,
    version: input.version || "1.0.0",
    status: "registered",
    createdBy: user?.id || "",
    lineage: input.lineage || {},
    checksum: payloadHash(code + (input.version || "1.0.0")),
    createdAt: nowIso(now)
  };
  state.aiModels.push(model);
  state.aiModelVersions.push(version);
  state.aiModelRegistry.push({
    id: newId("aimreg", uid),
    modelId: model.id,
    modelVersionId: version.id,
    status: "registered",
    production: false,
    createdAt: nowIso(now)
  });
  auditAi(state, "Ai.Model.Register", `Registered ${code}`, user, {}, uid);
  return { ok: true, model, version };
}

export function approveModelVersion(state, modelVersionId, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Govern");
  if (!gate.ok) return gate;
  const version = (state.aiModelVersions || []).find((v) => v.id === modelVersionId);
  if (!version) return { ok: false, error: AI_ERROR_CODES["AI-003"], errorCode: "AI-003", http: 404 };
  const sod = assertAiSegregationOfDuties({
    action: "approve",
    actorId: user?.id,
    creatorId: version.createdBy,
    developerId: version.createdBy
  });
  if (!sod.ok) return { ...sod, http: 403 };

  version.status = "approved";
  version.approvedAt = nowIso(now);
  version.approvedBy = user?.id || "";
  const model = (state.aiModels || []).find((m) => m.id === version.modelId);
  if (model) model.status = "approved";
  const reg = (state.aiModelRegistry || []).find((r) => r.modelVersionId === version.id);
  if (reg) reg.status = "approved";
  auditAi(state, "Ai.Model.Approve", `Approved ${modelVersionId}`, user, { category: "security" }, uid);
  return { ok: true, version };
}

export function deployModel(state, modelVersionId, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Admin");
  if (!gate.ok) return gate;
  const version = (state.aiModelVersions || []).find((v) => v.id === modelVersionId);
  if (!version) return { ok: false, error: AI_ERROR_CODES["AI-003"], errorCode: "AI-003", http: 404 };
  if (version.status !== "approved" && version.status !== "deployed") {
    return { ok: false, error: AI_ERROR_CODES["AI-004"], errorCode: "AI-004", http: 409 };
  }
  const sod = assertAiSegregationOfDuties({
    action: "deploy",
    actorId: user?.id,
    creatorId: version.createdBy,
    developerId: version.createdBy
  });
  if (!sod.ok) return { ...sod, errorCode: "AI-015", http: 403 };
  if (!version.approvedBy || version.approvedBy === user?.id) {
    return { ok: false, error: "Deployment requires independent prior approval", errorCode: "AI-015", http: 403 };
  }

  const model = (state.aiModels || []).find((m) => m.id === version.modelId);
  if (model && !canTransitionModel(model.status === "approved" ? "approved" : model.status, "deployed") && model.status !== "deployed") {
    // allow from approved
  }

  const deployment = {
    id: newId("aideploy", uid),
    modelId: version.modelId,
    modelVersionId: version.id,
    environment: "production",
    status: "deployed",
    approvedBy: version.approvedBy,
    deployedBy: user?.id || "",
    deployedAt: nowIso(now)
  };
  state.aiModelDeployments.push(deployment);
  version.status = "deployed";
  if (model) model.status = "deployed";
  const reg = (state.aiModelRegistry || []).find((r) => r.modelVersionId === version.id);
  if (reg) {
    reg.status = "deployed";
    reg.production = true;
  }

  auditAi(state, "Ai.Model.Deploy", `Deployed ${modelVersionId}`, user, { category: "security" }, uid);
  emitAiEvent(state, "ModelDeployed", { modelVersionId, deploymentId: deployment.id }, { uid, now, aggregateId: deployment.id });
  queueNotification(state, {
    event: "ai_model_deployed",
    channel: "In-App",
    userId: user?.id || "",
    vars: { name: user?.username || "Team", modelVersionId },
    uid
  });
  return { ok: true, deployment };
}

export function rollbackModel(state, deploymentId, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Admin");
  if (!gate.ok) return gate;
  const deployment = (state.aiModelDeployments || []).find((d) => d.id === deploymentId);
  if (!deployment) return { ok: false, error: "Deployment not found", errorCode: "AI-003", http: 404 };
  deployment.status = "rolled_back";
  deployment.rolledBackAt = nowIso(now);
  deployment.rolledBackBy = user?.id || "";
  const version = (state.aiModelVersions || []).find((v) => v.id === deployment.modelVersionId);
  if (version) version.status = "rolled_back";
  auditAi(state, "Ai.Model.Rollback", `Rollback ${deploymentId}`, user, {}, uid);
  return { ok: true, deployment };
}

export function enqueueTrainingJob(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Model");
  if (!gate.ok) return gate;
  const dsGate = requireDatasetGate(state, payload.datasetCode || "DS-COLLECTIONS-AGG");
  if (!dsGate.ok) return { ...dsGate, errorCode: "AI-014" };

  const job = {
    id: newId("aitrain", uid),
    modelCode: payload.modelCode || "MDL-GROWTH-V1",
    datasetCode: payload.datasetCode || "DS-COLLECTIONS-AGG",
    status: "queued",
    validationStatus: "pending",
    shadow: !!payload.shadow,
    canary: !!payload.canary,
    createdAt: nowIso(now),
    createdBy: user?.id || "",
    metadataOnly: true
  };
  state.aiModelTrainingJobs.push(job);
  auditAi(state, "Ai.Model.Train", `Training job ${job.id}`, user, {}, uid);
  return { ok: true, job };
}

export function detectDrift(state, payload = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Model");
  if (!gate.ok) return gate;
  const features = extractFeatures(state);
  const baseline = payload.baselineFailRate ?? 0.1;
  const current = features["FEAT-PAYMENT-FAIL-RATE"];
  const drifted = Math.abs(current - baseline) > 0.15;
  const events = [];
  if (drifted) {
    const row = {
      id: newId("aidrift", uid),
      modelCode: payload.modelCode || "MDL-FRAUD-V1",
      metric: "FEAT-PAYMENT-FAIL-RATE",
      baseline,
      current,
      severity: Math.abs(current - baseline) > 0.3 ? "critical" : "warning",
      status: "open",
      createdAt: nowIso(now)
    };
    state.aiDriftEvents.push(row);
    events.push(row);
    emitAiEvent(state, "DriftDetected", { driftId: row.id, severity: row.severityity }, { uid, now, aggregateId: row.id });
  }
  return { ok: true, drifted, events };
}

export function listModels(state, filter = {}) {
  ensureAiState(state);
  let rows = [...(state.aiModels || [])];
  if (filter.status) rows = rows.filter((m) => m.status === filter.status);
  return { ok: true, models: rows, versions: state.aiModelVersions || [], deployments: state.aiModelDeployments || [] };
}

export function listFeatures(state) {
  ensureAiState(state);
  return { ok: true, features: state.aiFeatureRegistry || [], versions: state.aiFeatureVersions || [] };
}

export function listDatasets(state, user) {
  ensureAiState(state);
  const authorizedRestricted = permitted(user, "Ai.Govern") || permitted(user, "Ai.Admin") || isSystemOwner(user);
  const rows = (state.aiDatasets || []).map((ds) => {
    const clone = { ...ds };
    if (ds.classification === "Restricted" && !authorizedRestricted) {
      clone.name = maskSensitiveValue(ds.name, "Restricted", false);
      clone.lineage = { masked: true };
      clone.errorCode = clone.errorCode || undefined;
    }
    return clone;
  });
  return { ok: true, datasets: rows };
}

export function registerDataset(state, input = {}, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Govern");
  if (!gate.ok) return gate;
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "code required", errorCode: "AI-020", http: 400 };
  const row = {
    id: newId("aids", uid),
    code,
    name: input.name || code,
    classification: input.classification || "Internal",
    status: "registered",
    checksum: input.checksum || payloadHash(code + nowIso(now)),
    checksumInvalid: false,
    qualityScore: Number(input.qualityScore ?? 0.8),
    retentionDays: Number(input.retentionDays || 365),
    createdBy: user?.id || "",
    lineage: input.lineage || {},
    createdAt: nowIso(now)
  };
  state.aiDatasets.push(row);
  return { ok: true, dataset: row };
}

export function approveDataset(state, datasetId, user, uid, now) {
  ensureAiState(state, uid, now);
  const gate = requireAction(user, "Ai.Govern");
  if (!gate.ok) return gate;
  const ds = (state.aiDatasets || []).find((d) => d.id === datasetId || d.code === datasetId);
  if (!ds) return { ok: false, error: AI_ERROR_CODES["AI-006"], errorCode: "AI-006", http: 404 };
  const sod = assertAiSegregationOfDuties({ action: "approve", actorId: user?.id, creatorId: ds.createdBy });
  if (!sod.ok) return { ...sod, http: 403 };
  ds.status = "approved";
  ds.approvedAt = nowIso(now);
  ds.approvedBy = user?.id || "";
  return { ok: true, dataset: ds };
}

export function aiDashboard(state, user, uid, now) {
  ensureAiState(state, uid, now);
  return {
    version: AI_PLATFORM_VERSION,
    enabled: aiEnabled(state),
    models: (state.aiModels || []).length,
    approvedModels: (state.aiModels || []).filter((m) => ["approved", "deployed"].includes(m.status)).length,
    deployments: (state.aiModelDeployments || []).filter((d) => d.status === "deployed").length,
    features: (state.aiFeatureRegistry || []).length,
    datasets: (state.aiDatasets || []).length,
    predictions: (state.aiPredictionResults || []).length,
    fraudAlerts: (state.aiFraudAlerts || []).filter((a) => a.status === "open").length,
    anomalies: (state.aiAnomalyEvents || []).filter((a) => a.status === "open").length,
    recommendations: (state.aiRecommendationHistory || []).length,
    driftEvents: (state.aiDriftEvents || []).filter((d) => d.status === "open").length,
    trainingJobs: (state.aiModelTrainingJobs || []).length,
    advisoryOnly: true,
    ruleEngineAuthoritative: true,
    routes: AI_ROUTE_CATALOG.length
  };
}

export function aiReports(state, reportId) {
  ensureAiState(state);
  const map = {
    ai_models: state.aiModels || [],
    ai_features: state.aiFeatureRegistry || [],
    ai_datasets: state.aiDatasets || [],
    ai_predictions: state.aiPredictionResults || [],
    ai_fraud: state.aiFraudAlerts || [],
    ai_forecasts: (state.aiPredictionResults || []).filter((r) => r.target === "forecast"),
    ai_recommendations: state.aiRecommendationHistory || [],
    ai_drift: state.aiDriftEvents || [],
    ai_governance: [governanceDashboard()],
    ai_audit: state.aiActivityLogs || []
  };
  return { ok: true, reportId, rows: map[reportId] || [] };
}

export function exportAiCsv(state, reportId) {
  const report = aiReports(state, reportId);
  const rows = report.rows || [];
  if (!rows.length) return { ok: true, csv: "id\n" };
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(",")];
  rows.forEach((row) => {
    lines.push(keys.map((k) => JSON.stringify(row[k] ?? "")).join(","));
  });
  return { ok: true, csv: lines.join("\n") };
}

export function aiHealth(state, now) {
  ensureAiState(state);
  return {
    status: aiEnabled(state) ? "healthy" : "disabled",
    version: AI_PLATFORM_VERSION,
    checkedAt: nowIso(now),
    modelsDeployed: (state.aiModelDeployments || []).filter((d) => d.status === "deployed").length,
    advisoryOnly: true
  };
}

export function aiGovernanceView(state, user) {
  ensureAiState(state);
  const gate = requireAction(user, "Ai.Govern");
  if (!gate.ok) {
    // allow View for dashboard summary
    if (!permitted(user, "Ai.View")) return gate;
  }
  return { ok: true, ...governanceDashboard(), grants: state.aiPermissionGrants || [] };
}

export function assertAiBoundary() {
  return {
    ...assertAiLifecycleBoundary(),
    permissionRegistry: "src/core/ai-permission-registry.js",
    customerBalanceUntouched: true,
    moneyUnit: "pesewas"
  };
}

registerJobHandler("ai_drift_scan", (state, job, ctx) => {
  ensureAiState(state, ctx.uid, ctx.now);
  return detectDrift(state, job?.payload || {}, ctx.user || { role: "SystemOwner", systemOwner: true, username: "john" }, ctx.uid, ctx.now);
});

registerJobHandler("ai_fraud_scan", (state, job, ctx) => {
  ensureAiState(state, ctx.uid, ctx.now);
  return detectFraud(state, job?.payload || {}, ctx.user || { role: "SystemOwner", systemOwner: true, username: "john" }, ctx.uid, ctx.now);
});

export {
  evaluateAiPermission,
  getAiPermission,
  MODEL_STATES,
  AI_ROUTE_CATALOG
};
