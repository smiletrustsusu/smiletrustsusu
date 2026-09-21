/**
 * Module 22 — Security Operations, Fraud Detection & Risk Management.
 * Observes payments, auth, sync, and devices. Does not post collections or ledgers.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { fraudAlerts } from "./collection-ops.js";
import { evaluateAlerts, recordMetric } from "./monitoring-ops.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  registerContractHandler,
  invokeContract,
  publishDomainEvent,
  ensureContractState
} from "./module-contracts.js";
import {
  riskLevelFromScore,
  canTransitionIncident,
  canTransitionFraud,
  THREAT_TYPES
} from "./security-lifecycle.js";

export {
  riskLevelFromScore,
  canTransitionIncident,
  canTransitionFraud,
  THREAT_TYPES
};

export const SECURITY_SCHEMA_VERSION = "1.0.0";

const SECURITY_ARRAYS = [
  "riskScores",
  "securityIncidents",
  "fraudCases",
  "threatSignals",
  "securityInvestigations",
  "securityActivityLogs"
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

function auditSecurity(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "security",
    guarantee: "G1",
    module: "22",
    ...extras
  }, uid);
}

export function ensureSecurityState(state = {}) {
  SECURITY_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  ensureContractState(state);
  return state;
}

export function assertSecurityBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    storesPins: false,
    restHttp: false,
    graphqlHttp: false,
    contractsOnly: true
  };
}

export function evaluateRisk(state, subject = {}, { user, uid, now } = {}) {
  ensureSecurityState(state);
  if (user && !canAction(user, "Security.Evaluate") && !canAction(user, "Security.View") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot evaluate risk" };
  }
  const collections = (state.collections || []).filter((item) => !subject.customerId || item.customerId === subject.customerId);
  const collectionFlags = fraudAlerts(collections, { largeThreshold: Number(subject.largeThreshold || 5000) });
  const failedAuth = (state.audit || []).filter((item) => /login fail|authentication fail/i.test(`${item.action || ""} ${item.details || item.detail || ""}`)).length;
  const revoked = (state.devices || []).filter((item) => item.revoked === true || item.status === "revoked").length;
  const paymentFlags = (state.paymentTransactions || []).flatMap((item) => item.fraudFlags || []);
  const syncConflicts = (state.syncConflicts || []).filter((item) => item.status !== "resolved").length;
  const integrity = (state.deviceHealthSnapshots || []).some((item) => item.integrityFailed);
  const rateHits = (state.monitoringMetrics || []).filter((item) => item.name === "rateLimitHits").length;

  let score = 0;
  const signals = [];
  if (collectionFlags.some((item) => item.type === "large_deposit")) {
    score += 20;
    signals.push("large_amount");
  }
  if (collectionFlags.some((item) => item.type === "duplicate_same_day")) {
    score += 15;
    signals.push("duplicate_collection");
  }
  if (paymentFlags.length) {
    score += Math.min(25, paymentFlags.length * 8);
    signals.push("payment_fraud_flag");
  }
  if (failedAuth >= 5) {
    score += 20;
    signals.push("failed_authentication");
  }
  if (revoked) {
    score += 25;
    signals.push("device_revoked");
  }
  if (syncConflicts >= 3) {
    score += 10;
    signals.push("sync_conflict");
  }
  if (integrity) {
    score += 30;
    signals.push("integrity_failure");
  }
  if (rateHits >= 5) {
    score += 10;
    signals.push("rate_limit");
  }
  score = Math.min(100, score);
  const level = riskLevelFromScore(score);
  const row = {
    id: newId("risk", uid),
    subjectType: subject.subjectType || "customer",
    subjectId: subject.customerId || subject.deviceId || subject.userId || "system",
    score,
    level,
    signals,
    createdAt: nowIso(now)
  };
  state.riskScores.push(row);
  signals.forEach((type) => {
    state.threatSignals.push({
      id: newId("thr", uid),
      type,
      subjectId: row.subjectId,
      createdAt: nowIso(now)
    });
  });
  recordMetric(state, { domain: "security", name: "riskScore", value: score }, uid, now);
  publishDomainEvent(state, { name: "RiskScoreUpdated", moduleId: 22, payload: { score, level }, correlationId: row.id }, uid, now);
  if (level === "critical" || level === "high") {
    evaluateAlerts(state, { fraudDetected: 1, securityFindings: 1 }, { uid, now, user });
    publishDomainEvent(state, { name: "FraudDetected", moduleId: 22, payload: { score, signals }, correlationId: row.id }, uid, now);
    if (level === "critical") {
      openSecurityIncident(state, {
        title: "Critical risk score",
        severity: "critical",
        subjectId: row.subjectId,
        signals
      }, user, uid, now);
    }
  }
  auditSecurity(state, "Risk evaluated", `${level} · ${score}`, user, { entityId: row.id }, uid);
  return { ok: true, score: row, collectionsUnchanged: true };
}

export function openSecurityIncident(state, input = {}, user, uid, now) {
  ensureSecurityState(state);
  if (user && !canAction(user, "Security.Incident") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot open security incidents" };
  }
  const row = {
    id: input.id || newId("secinc", uid),
    title: input.title || "Security incident",
    severity: input.severity || "high",
    status: "open",
    subjectId: input.subjectId || "",
    signals: input.signals || [],
    createdBy: user?.id || "system",
    createdAt: nowIso(now)
  };
  state.securityIncidents.push(row);
  publishDomainEvent(state, { name: "SecurityIncidentOpened", moduleId: 22, payload: { id: row.id }, correlationId: row.id }, uid, now);
  auditSecurity(state, "Security incident opened", row.title, user, { entityId: row.id }, uid);
  return { ok: true, incident: row, event: "SecurityIncidentOpened" };
}

export function closeSecurityIncident(state, incidentId, { user, uid, now, note = "" } = {}) {
  ensureSecurityState(state);
  if (user && !canAction(user, "Security.Incident") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot close security incidents" };
  }
  const incident = (state.securityIncidents || []).find((item) => item.id === incidentId);
  if (!incident) return { ok: false, error: "Incident not found" };
  if (incident.status !== "closed" && !canTransitionIncident(incident.status, "closed")) {
    return { ok: false, error: `Invalid incident transition: ${incident.status} → closed` };
  }
  incident.status = "closed";
  incident.closedAt = nowIso(now);
  incident.note = note;
  publishDomainEvent(state, { name: "SecurityIncidentClosed", moduleId: 22, payload: { id: incident.id }, correlationId: incident.id }, uid, now);
  auditSecurity(state, "Security incident closed", incident.id, user, { entityId: incident.id }, uid);
  return { ok: true, incident, event: "SecurityIncidentClosed" };
}

export function investigateFraud(state, input = {}, user, uid, now) {
  ensureSecurityState(state);
  if (user && !canAction(user, "Security.Investigate") && !canAction(user, "Security.Incident") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot investigate fraud" };
  }
  const row = {
    id: newId("fraud", uid),
    subjectId: input.subjectId || "",
    reason: input.reason || "manual",
    status: "detected",
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  if (input.advance === "investigating" && canTransitionFraud(row.status, "investigating")) row.status = "investigating";
  state.fraudCases.push(row);
  state.securityInvestigations.push({
    id: newId("sinv", uid),
    fraudId: row.id,
    note: input.note || "",
    createdAt: nowIso(now)
  });
  auditSecurity(state, "Fraud investigation opened", row.id, user, { entityId: row.id }, uid);
  return { ok: true, fraud: row };
}

export function latestRiskScore(state, subjectId = "") {
  ensureSecurityState(state);
  const rows = (state.riskScores || []).filter((item) => !subjectId || item.subjectId === subjectId);
  return rows[rows.length - 1] || { score: 0, level: "low", signals: [] };
}

export function threatStatus(state) {
  ensureSecurityState(state);
  const open = (state.securityIncidents || []).filter((item) => item.status !== "closed");
  const last = latestRiskScore(state);
  return {
    openIncidents: open.length,
    fraudCases: (state.fraudCases || []).filter((item) => item.status !== "dismissed").length,
    lastScore: last.score || 0,
    lastLevel: last.level || "low",
    signals: (state.threatSignals || []).slice(-12)
  };
}

export function securityDashboard(state) {
  ensureSecurityState(state);
  const threats = threatStatus(state);
  return {
    incidents: (state.securityIncidents || []).length,
    openIncidents: threats.openIncidents,
    fraudCases: (state.fraudCases || []).length,
    lastLevel: threats.lastLevel,
    lastScore: threats.lastScore,
    contracts: (state.contractInvocations || []).length
  };
}

export function securityReports(state, reportId, range = {}) {
  ensureSecurityState(state);
  const from = Date.parse(range.from || "1970-01-01");
  const to = Date.parse(`${range.to || "2100-01-01"}T23:59:59.000Z`);
  const inRange = (item) => {
    const ts = Date.parse(item.createdAt || 0);
    return ts >= from && ts <= to;
  };
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "security_incidents") return table(["createdAt", "title", "severity", "status"], (state.securityIncidents || []).filter(inRange));
  if (reportId === "fraud_cases") return table(["createdAt", "subjectId", "status"], (state.fraudCases || []).filter(inRange));
  if (reportId === "risk_scores") return table(["createdAt", "subjectId", "score", "level"], (state.riskScores || []).filter(inRange));
  if (reportId === "contract_invocations") return table(["createdAt", "contractId", "fromModule", "status"], (state.contractInvocations || []).filter(inRange));
  return table(["id"], []);
}

export function exportSecurityCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

registerContractHandler("Risk.Evaluate.v1", (state, payload, ctx) => evaluateRisk(state, payload, ctx));
registerContractHandler("Security.OpenIncident.v1", (state, payload, ctx) => openSecurityIncident(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Security.CloseIncident.v1", (state, payload, ctx) => closeSecurityIncident(state, payload.incidentId, ctx));
registerContractHandler("Fraud.Investigate.v1", (state, payload, ctx) => investigateFraud(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Risk.Score.v1", (state, payload) => ({ ok: true, ...latestRiskScore(state, payload.subjectId) }));
registerContractHandler("Incident.Get.v1", (state, payload) => {
  const incident = (state.securityIncidents || []).find((item) => item.id === payload.incidentId);
  return incident ? { ok: true, incident } : { ok: false, error: "Incident not found" };
});
registerContractHandler("Threat.Status.v1", (state) => ({ ok: true, ...threatStatus(state) }));

registerGatewayHandler("risk.evaluate", (state, request, ctx) => evaluateRisk(state, request.body || {}, ctx));
registerGatewayHandler("security.incident.open", (state, request, ctx) => openSecurityIncident(state, request.body || {}, ctx.user, ctx.uid, ctx.now));

export { invokeContract, nowMs };
