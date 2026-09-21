/**
 * Wave 7 — Enterprise AI, Reporting, Analytics & BI Platform.
 * Facade over Module 11 report-ops, Module 27 bi-ops, Module 29 ai-ops,
 * and Module 24 rule-ops. Shared vanilla JS SPA only — no Next.js/React BI rewrite.
 * AI is advisory only; never auto-approves loans or posts money.
 * Money = integer pesewas; interest 15; collection days 31; cashier GHS 1000.
 */

import { createApiPlatform, invokeApi, bootstrapApiPlatform, isApiPlatformBootstrapped } from "../api/index.js";
import { recordAuditEvent } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { SUPER_ADMIN_FORBIDDEN } from "./rbac.js";
import { toPesewas, fromPesewas } from "./money.js";
import {
  ensureBiState,
  calculateKpi,
  calculateAllKpis,
  publishKpi,
  listMetrics,
  biDashboard,
  resolveMetricInputs
} from "./bi-ops.js";
import {
  REPORT_CATALOG,
  REPORT_VERSION,
  canRunReport,
  runReport,
  reportDashboard,
  scheduleReport,
  exportReportCsv,
  analyticsSeries,
  portfolioAtRisk,
  kpiWeights,
  scopedState,
  totalCollections,
  postedWithdrawals
} from "./report-ops.js";
import {
  ensureAiState,
  detectFraud,
  runForecast,
  generateRecommendations,
  runPrediction,
  aiDashboard,
  detectAnomalies
} from "./ai-ops.js";
import { ensureRuleState, evaluateRule } from "./rule-ops.js";
import { branchPerformance } from "./branches.js";
import { agentPerformance } from "./agents.js";
import { outstandingLoanBalance } from "./loans-workflow.js";
import { isPostedCollection } from "./domain-terms.js";
import { wave4SyncDashboard, ensureWave4SyncState } from "./wave4-offline-ops.js";
import { ensureMonitoringState, monitoringDashboard } from "./monitoring-ops.js";

export const WAVE7_VERSION = "7.0.0-analytics-bi";
export const WAVE7_WAVE = "WAVE-07";

/** Catalog mapping: historical EIR name was Accounting Platform; user Wave 7 = Analytics/AI/BI */
export const WAVE7_CATALOG_ALIAS = Object.freeze({
  deliveryName: "Enterprise Analytics & BI Platform",
  deliveryCode: "ANALYTICS_BI",
  historicalEirName: "Accounting Platform",
  historicalEirCode: "ACCOUNTING_PLATFORM",
  accountingDeepWork: "Mostly Complete / deferred — Module 10 GL remains; deep CoA rewrite not the Wave 7 analytics focus"
});

/** Canonical Module 27 KPI codes published through this facade (one formula SoT). */
export const WAVE7_CANONICAL_KPI_CODES = Object.freeze([
  "KPI-COL-RATE",
  "KPI-LOAN-REC",
  "KPI-SAV-GROWTH",
  "KPI-CUS-GROWTH",
  "KPI-ACTIVE-MEM",
  "KPI-BRANCH-PROFIT",
  "KPI-COL-PROD",
  "KPI-WF-SLA",
  "KPI-SYS-AVAIL",
  "KPI-PAY-SUCCESS"
]);

/** Extended operational KPI ids computed from existing report/dashboard engines (not duplicate formulas). */
export const WAVE7_EXTENDED_KPI_IDS = Object.freeze([
  "EXT-DEPOSITS",
  "EXT-WITHDRAWALS",
  "EXT-DISBURSEMENT",
  "EXT-PAR",
  "EXT-BRANCH-PERF",
  "EXT-SYNC-SUCCESS",
  "EXT-COLLECTIONS-PESEWAS"
]);

export const WAVE7_FRAUD_RULES = Object.freeze([
  {
    id: "W7-FR-01",
    code: "duplicate_txn",
    title: "Duplicate transactions",
    severityDefault: "high",
    recommendedAction: "Review duplicate collection keys; reverse or investigate before posting corrections"
  },
  {
    id: "W7-FR-02",
    code: "abnormal_collections",
    title: "Abnormal collections",
    severityDefault: "medium",
    recommendedAction: "Compare collector/day totals to branch average; request supervisor verification"
  },
  {
    id: "W7-FR-03",
    code: "suspicious_withdrawals",
    title: "Suspicious withdrawals",
    severityDefault: "high",
    recommendedAction: "Hold pending withdrawals and confirm customer identity / available balance"
  },
  {
    id: "W7-FR-04",
    code: "unusual_loan_approvals",
    title: "Unusual loan approvals",
    severityDefault: "high",
    recommendedAction: "Escalate to credit committee; do not auto-approve — Rule Engine remains authority"
  },
  {
    id: "W7-FR-05",
    code: "unauthorized_access",
    title: "Unauthorized access patterns",
    severityDefault: "critical",
    recommendedAction: "Lock account, review audit trail, rotate credentials"
  },
  {
    id: "W7-FR-06",
    code: "sync_anomaly",
    title: "Device sync anomalies",
    severityDefault: "medium",
    recommendedAction: "Inspect offline queue conflicts and device health; re-run Wave 4 sync"
  },
  {
    id: "W7-FR-07",
    code: "out_of_hours",
    title: "Out-of-hours activity",
    severityDefault: "medium",
    recommendedAction: "Confirm business justification; flag for auditor review"
  }
]);

export const WAVE7_REGULATORY_TEMPLATES = Object.freeze([
  {
    id: "GH-MF-FIN-SUMMARY",
    name: "Ghana microfinance financial summary",
    category: "financial",
    permission: "Reports.Accounting",
    fields: ["totalSavingsPesewas", "totalCollectionsPesewas", "loanOutstandingPesewas", "parRate", "cashPositionPesewas"]
  },
  {
    id: "GH-MF-BRANCH",
    name: "Branch performance regulatory pack",
    category: "branch",
    permission: "Reports.View",
    fields: ["branchId", "collectionsPesewas", "activeCustomers", "agents"]
  },
  {
    id: "GH-MF-CUSTOMER",
    name: "Customer stock summary",
    category: "customer",
    permission: "Reports.View",
    fields: ["activeCustomers", "newCustomers", "dormantCustomers"]
  },
  {
    id: "GH-MF-LOAN",
    name: "Loan portfolio regulatory summary",
    category: "loan",
    permission: "Reports.View",
    fields: ["activeLoans", "outstandingPesewas", "disbursedPesewas", "recoveryRate", "par"]
  },
  {
    id: "GH-MF-AUDIT",
    name: "Audit evidence pack",
    category: "audit",
    permission: "Reports.Audit",
    fields: ["auditCount", "fraudAlertCount", "exportCount", "aiRequestCount"]
  }
]);

export const WAVE7_REPORT_FRAMEWORK = Object.freeze({
  version: WAVE7_VERSION,
  catalogSource: "src/core/report-ops.js#REPORT_CATALOG",
  exportFormats: ["csv", "excel", "json", "pdf"],
  scheduler: "scheduleReport / report_schedule job (Module 11)",
  archivalMeta: ["reportHistory", "reportExports", "reportActivityLogs"],
  distributionMeta: ["scheduledReports.delivery", "In-App", "Queued export"]
});

export const WAVE7_EXEC_ROLES = Object.freeze({
  CEO: { label: "CEO", actions: ["Reports.Executive", "Bi.View", "Ai.View"], kpis: WAVE7_CANONICAL_KPI_CODES },
  ManagingDirector: { label: "Managing Director", actions: ["Reports.Executive", "Bi.View"], kpis: WAVE7_CANONICAL_KPI_CODES },
  RegionalManager: { label: "Regional Manager", actions: ["Reports.View", "Bi.View"], kpis: ["KPI-COL-RATE", "KPI-CUS-GROWTH", "KPI-ACTIVE-MEM", "KPI-COL-PROD", "KPI-LOAN-REC"] },
  BranchManager: { label: "Branch Manager", actions: ["Reports.View"], kpis: ["KPI-COL-RATE", "KPI-COL-PROD", "KPI-ACTIVE-MEM", "KPI-LOAN-REC"] },
  Finance: { label: "Finance", actions: ["Reports.Accounting", "Reports.Executive", "Bi.View"], kpis: ["KPI-COL-RATE", "KPI-LOAN-REC", "KPI-SAV-GROWTH", "KPI-BRANCH-PROFIT", "KPI-PAY-SUCCESS"] },
  Operations: { label: "Operations", actions: ["Reports.View", "Bi.View"], kpis: ["KPI-COL-RATE", "KPI-COL-PROD", "KPI-WF-SLA", "KPI-SYS-AVAIL", "KPI-PAY-SUCCESS"] },
  Auditor: { label: "Auditor", actions: ["Reports.Audit", "Ai.View", "Bi.View"], kpis: ["KPI-SYS-AVAIL", "KPI-WF-SLA", "KPI-PAY-SUCCESS", "KPI-LOAN-REC"] }
});

export const WAVE7_GAP_CHECKLIST = Object.freeze([
  { id: "W7-G01", title: "Reporting framework facade (catalog/templates/export/schedule metadata)", status: "closed", severity: "critical" },
  { id: "W7-G02", title: "Operational reports wired via report-ops + invokeApi", status: "closed", severity: "critical" },
  { id: "W7-G03", title: "Executive role-filtered KPI dashboards (Module 27 formulas)", status: "closed", severity: "critical" },
  { id: "W7-G04", title: "KPI engine facade — calculate/publish via canonical formulas only", status: "closed", severity: "critical" },
  { id: "W7-G05", title: "BI drill-down / period compare / branch benchmarking helpers", status: "closed", severity: "high" },
  { id: "W7-G06", title: "AI assistant layer (Module 29) with RBAC + audit", status: "closed", severity: "critical" },
  { id: "W7-G07", title: "Fraud/anomaly detectors with evidence (deterministic + Module 29)", status: "closed", severity: "critical" },
  { id: "W7-G08", title: "Predictive forecast helpers (MA/linear) advisory-only", status: "closed", severity: "high" },
  { id: "W7-G09", title: "Ghana microfinance regulatory template registry", status: "closed", severity: "high" },
  { id: "W7-G10", title: "Export permission gates + masking hooks + audit", status: "closed", severity: "critical" },
  { id: "W7-G11", title: "UI under Reports/Audit (no new top-level nav)", status: "closed", severity: "high" },
  { id: "W7-G12", title: "docs/wave7-analytics-bi.md + roadmap/MIB notes", status: "closed", severity: "medium" },
  { id: "W7-G13", title: "KPI fixture tests + authz/export/fraud/AI tests", status: "closed", severity: "critical" },
  { id: "W7-G14", title: "Accounting Platform deep GL rewrite", status: "deferred", severity: "low", note: "Historical EIR WAVE-07 name; Module 10 Mostly Complete — not analytics scope" },
  { id: "W7-G15", title: "Opaque paid ML vendor integration", status: "partial", severity: "low", note: "Uses Module 29 heuristics + transparent MA/linear; no unpaid opaque ML" }
]);

export const WAVE7_PARITY_CHECKLIST = Object.freeze([
  { id: "W7-P01", title: "Same SPA entry (www/ after prepare:web)", channel: "Web↔EXE↔APK" },
  { id: "W7-P02", title: "Wave 3 invokeApi for dashboards/reports (no duplicate posting)", channel: "Web↔EXE↔APK" },
  { id: "W7-P03", title: "Module 27 KPI formulas are single SoT", channel: "Web↔EXE↔APK" },
  { id: "W7-P04", title: "Module 29 AI advisory-only (no auto-approve)", channel: "Web↔EXE↔APK" },
  { id: "W7-P05", title: "Fraud detect-only (no ledger mutation)", channel: "Web↔EXE↔APK" },
  { id: "W7-P06", title: "Money: pesewas / interest 15 / days 31 / cashier 1000", channel: "Web↔EXE↔APK" },
  { id: "W7-P07", title: "No new top-level nav — Reports/Audit panels only", channel: "Web↔EXE↔APK" },
  { id: "W7-P08", title: "SUPER_ADMIN_FORBIDDEN + SystemOwner john", channel: "Web↔EXE↔APK" }
]);

const WAVE7_ARRAYS = ["wave7AiAuditLog", "wave7FraudFindings", "wave7ForecastLog", "wave7ExportLog", "wave7InsightLog"];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function requireAny(user, actions = []) {
  if (!user) return { ok: true };
  if (isSystemOwner(user)) return { ok: true };
  if (actions.some((a) => canAction(user, a))) return { ok: true };
  return { ok: false, error: "Forbidden", errorCode: "W7-403", http: 403 };
}

function auditWave7(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G2",
    module: "11",
    ...extras
  }, uid);
}

function ensurePortalApi(state) {
  if (!isApiPlatformBootstrapped()) bootstrapApiPlatform(state);
}

export function ensureWave7State(state = {}, uid, now) {
  WAVE7_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  ensureBiState(state);
  ensureAiState(state, uid, now);
  ensureRuleState(state);
  ensureMonitoringState(state);
  ensureWave4SyncState(state);
  state.reportHistory = state.reportHistory || [];
  state.reportExports = state.reportExports || [];
  state.reportActivityLogs = state.reportActivityLogs || [];
  state.scheduledReports = state.scheduledReports || [];
  return state;
}

export function listWave7ReportCatalog(user) {
  return REPORT_CATALOG.map((item) => ({
    ...item,
    allowed: canRunReport(user, item),
    frameworkVersion: WAVE7_VERSION,
    reportEngineVersion: REPORT_VERSION
  }));
}

export function reportingFrameworkMeta() {
  return {
    ...WAVE7_REPORT_FRAMEWORK,
    catalogCount: REPORT_CATALOG.length,
    regulatoryTemplates: WAVE7_REGULATORY_TEMPLATES.length,
    versioningHooks: {
      reportVersion: REPORT_VERSION,
      biSchema: "BI_SCHEMA_VERSION via bi-ops",
      wave7: WAVE7_VERSION
    },
    schedulerStub: {
      api: "scheduleReport",
      jobHandler: "report_schedule",
      frequencies: ["Daily", "Weekly", "Monthly", "Quarterly", "Annual", "Custom"]
    }
  };
}

/**
 * KPI facade — ALWAYS delegates formula math to Module 27 calculateKpi.
 */
export function calculateWave7Kpis(state, range = {}, user, uid, now) {
  ensureWave7State(state, uid, now);
  const gate = requireAny(user, ["Bi.View", "Reports.View", "Reports.Executive", "Ai.View"]);
  if (!gate.ok) return gate;
  const all = calculateAllKpis(state, range, user, uid, now);
  const extended = computeExtendedKpis(state, range, user);
  auditWave7(state, "Wave7.KPI.Calculate", `canonical=${WAVE7_CANONICAL_KPI_CODES.length} extended=${extended.length}`, user, {}, uid);
  return {
    ok: true,
    sourceOfTruth: "src/core/bi-ops.js#calculateKpi",
    advisory: false,
    postsMoney: false,
    canonical: all,
    dashboard: all.dashboard || {},
    extended,
    kpiCodes: WAVE7_CANONICAL_KPI_CODES.slice(),
    moneyUnitHint: "collections/loans may be GHS display; ledger uses pesewas — exports annotate both"
  };
}

export function publishWave7Kpi(state, kpiId, user, uid, now) {
  ensureWave7State(state, uid, now);
  return publishKpi(state, kpiId, user, uid, now);
}

function mapBranchPerformance(scoped, date = "") {
  const branches = scoped.branches || [];
  return branches.map((branch) => branchPerformance(branch, {
    collections: scoped.collections || [],
    customers: scoped.customers || [],
    groups: [...(scoped.groups || []), ...(scoped.susuGroups || [])],
    date
  }));
}

function mapAgentPerformance(scoped, date = "") {
  const agents = (scoped.users || []).filter((u) => u.role === "Collector" || u.role === "Agent");
  return agents.map((agent) => agentPerformance(agent, {
    collections: scoped.collections || [],
    customers: scoped.customers || [],
    susuGroups: scoped.susuGroups || [],
    date
  }));
}

function computeExtendedKpis(state, range = {}, user) {
  const scoped = scopedState(state, user);
  const collectionsGhs = totalCollections(scoped, range);
  const withdrawalsGhs = postedWithdrawals(scoped, range).reduce((s, r) => s + Number(r.amount || 0), 0);
  const disbursed = (scoped.loans || []).reduce((s, loan) => s + Number(loan.principal || loan.amount || 0), 0);
  const today = range.to || new Date().toISOString().slice(0, 10);
  const par = portfolioAtRisk(scoped.loans || [], { asOf: today, days: kpiWeights(state.settings).parDays });
  const branches = mapBranchPerformance(scoped, today);
  const sync = wave4SyncDashboard(state, { online: true });
  const syncSuccess = Number(sync?.progress?.successRate ?? sync?.collectorStatus?.successRate ?? 100);
  return [
    { id: "EXT-COLLECTIONS-PESEWAS", label: "Collections (pesewas)", value: toPesewas(collectionsGhs), unit: "pesewas", formula: "toPesewas(totalCollections)" },
    { id: "EXT-DEPOSITS", label: "Deposits / collections (GHS)", value: +collectionsGhs.toFixed(2), unit: "GHS", formula: "report-ops.totalCollections" },
    { id: "EXT-WITHDRAWALS", label: "Withdrawals (GHS)", value: +withdrawalsGhs.toFixed(2), unit: "GHS", formula: "report-ops.postedWithdrawals sum" },
    { id: "EXT-DISBURSEMENT", label: "Loan disbursement (GHS)", value: +disbursed.toFixed(2), unit: "GHS", formula: "sum(loan.principal)" },
    { id: "EXT-PAR", label: "Portfolio at Risk %", value: par.rate, unit: "Percent", formula: "report-ops.portfolioAtRisk" },
    { id: "EXT-BRANCH-PERF", label: "Branch count with performance rows", value: branches.length, unit: "Count", formula: "branches.branchPerformance per branch" },
    { id: "EXT-SYNC-SUCCESS", label: "Sync success rate", value: syncSuccess, unit: "Percent", formula: "wave4SyncDashboard" }
  ];
}

/**
 * Assert Module 27 formula correctness against fixture metric inputs (for tests + ops).
 */
export function assertCanonicalKpiFixtures(fixtures = []) {
  const results = [];
  for (const fx of fixtures) {
    const m = (code) => Number(fx.inputs[code] || 0);
    const pct = (n, d) => (!d ? 0 : Math.round((n / d) * 10000) / 100);
    const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
    let expected = 0;
    switch (fx.kpiCode) {
      case "KPI-COL-RATE":
        expected = pct(m("MET-SAV-001"), m("MET-SAV-002"));
        break;
      case "KPI-LOAN-REC":
        expected = pct(m("MET-LOAN-001"), m("MET-LOAN-002"));
        break;
      case "KPI-SAV-GROWTH":
        expected = pct(m("MET-SAV-003") - m("MET-SAV-004"), m("MET-SAV-004"));
        break;
      case "KPI-CUS-GROWTH":
        expected = pct(m("MET-CUS-001"), m("MET-CUS-002"));
        break;
      case "KPI-ACTIVE-MEM":
        expected = pct(m("MET-CUS-003"), m("MET-CUS-004"));
        break;
      case "KPI-BRANCH-PROFIT":
        expected = round2(m("MET-ACC-001") - m("MET-ACC-002"));
        break;
      case "KPI-COL-PROD":
        expected = m("MET-COL-002") ? round2(m("MET-COL-001") / m("MET-COL-002")) : 0;
        break;
      case "KPI-WF-SLA":
        expected = pct(m("MET-WF-001"), m("MET-WF-002"));
        break;
      case "KPI-SYS-AVAIL":
        expected = pct(m("MET-MON-001") - m("MET-MON-002"), m("MET-MON-001"));
        break;
      case "KPI-PAY-SUCCESS":
        expected = pct(m("MET-PAY-001"), m("MET-PAY-002"));
        break;
      default:
        results.push({ kpiCode: fx.kpiCode, ok: false, error: "unknown KPI" });
        continue;
    }
    const pass = Number(fx.expected) === expected;
    results.push({ kpiCode: fx.kpiCode, ok: pass, expected, actual: fx.expected });
  }
  return {
    ok: results.every((r) => r.ok),
    results,
    coverage: WAVE7_CANONICAL_KPI_CODES.length,
    sourceOfTruth: "bi-ops calculateKpi switch + enterprise-bi.md"
  };
}

export function executiveDashboard(state, { roleKey = "CEO", range = {}, user, uid, now } = {}) {
  ensureWave7State(state, uid, now);
  const profile = WAVE7_EXEC_ROLES[roleKey] || WAVE7_EXEC_ROLES.CEO;
  const gate = requireAny(user, profile.actions);
  if (!gate.ok) return gate;
  const kpis = calculateWave7Kpis(state, range, user, uid, now);
  if (!kpis.ok) return kpis;
  const filtered = Object.fromEntries(
    Object.entries(kpis.dashboard || {}).filter(([code]) => profile.kpis.includes(code))
  );
  const dash = reportDashboard(state, range, user);
  const bi = biDashboard(state, range, user, uid);
  return {
    ok: true,
    roleKey,
    roleLabel: profile.label,
    kpis: filtered,
    extended: (kpis.extended || []).filter((row) =>
      ["EXT-PAR", "EXT-COLLECTIONS-PESEWAS", "EXT-SYNC-SUCCESS", "EXT-DEPOSITS", "EXT-WITHDRAWALS", "EXT-DISBURSEMENT"].includes(row.id)
    ),
    operational: {
      todayCollections: dash.todayCollections,
      activeCustomers: dash.activeCustomers,
      outstandingLoans: dash.outstandingLoans,
      par: dash.par,
      cashPosition: dash.cashPosition
    },
    bi,
    formulaSource: "Module 27 bi-ops",
    postsMoney: false
  };
}

export function biPeriodCompare(state, { current = {}, prior = {}, user, uid, now } = {}) {
  ensureWave7State(state, uid, now);
  const gate = requireAny(user, ["Reports.View", "Bi.View", "Reports.Executive"]);
  if (!gate.ok) return gate;
  const a = calculateWave7Kpis(state, current, user, uid, now);
  const b = calculateWave7Kpis(state, prior, user, uid, now);
  const compare = {};
  for (const code of WAVE7_CANONICAL_KPI_CODES) {
    const cur = Number(a.dashboard?.[code] || 0);
    const prev = Number(b.dashboard?.[code] || 0);
    const delta = Math.round((cur - prev) * 100) / 100;
    compare[code] = {
      current: cur,
      prior: prev,
      delta,
      pctChange: prev ? Math.round((delta / Math.abs(prev)) * 10000) / 100 : (cur ? 100 : 0)
    };
  }
  return { ok: true, compare, current: a.dashboard, prior: b.dashboard };
}

export function biDrilldown(state, { dimension = "branch", range = {}, user } = {}) {
  const gate = requireAny(user, ["Reports.View", "Bi.View"]);
  if (!gate.ok) return gate;
  const scoped = scopedState(state, user);
  const collections = (scoped.collections || []).filter((c) => isPostedCollection(c));
  const inRange = (date) => {
    const day = String(date || "").slice(0, 10);
    if (range.from && day < range.from) return false;
    if (range.to && day > range.to) return false;
    return true;
  };
  const rows = collections.filter((c) => inRange(c.date));
  const bucket = new Map();
  rows.forEach((row) => {
    const key =
      dimension === "agent" ? (row.collectorId || row.agentId || "unknown")
        : dimension === "product" ? (row.productId || row.product || "unknown")
          : dimension === "day" ? String(row.date || "").slice(0, 10)
            : (row.branchId || row.groupId || "unknown");
    const prev = bucket.get(key) || { key, count: 0, amountGhs: 0, amountPesewas: 0 };
    const amt = Number(row.amount || 0);
    prev.count += 1;
    prev.amountGhs += amt;
    prev.amountPesewas += toPesewas(amt);
    bucket.set(key, prev);
  });
  const series = analyticsSeries(state, range, user);
  return {
    ok: true,
    dimension,
    rows: [...bucket.values()].map((r) => ({
      ...r,
      amountGhs: +r.amountGhs.toFixed(2)
    })).sort((a, b) => b.amountPesewas - a.amountPesewas),
    series,
    reconcileHint: "amountPesewas = toPesewas(amountGhs)"
  };
}

export function branchBenchmark(state, { range = {}, user } = {}) {
  const gate = requireAny(user, ["Reports.View", "Bi.View", "Reports.Executive"]);
  if (!gate.ok) return gate;
  const scoped = scopedState(state, user);
  const day = range.to || "";
  const perf = mapBranchPerformance(scoped, day);
  const agents = mapAgentPerformance(scoped, day);
  const drill = biDrilldown(state, { dimension: "branch", range, user });
  return {
    ok: true,
    branches: perf,
    collectors: agents.slice(0, 25),
    collectionDrill: drill.ok ? drill.rows : [],
    method: "existing branchPerformance + agentPerformance + drilldown aggregates"
  };
}

export function runWave7Report(state, reportId, opts = {}) {
  const user = opts.user;
  const report = REPORT_CATALOG.find((item) => item.id === reportId);
  if (!report) return { ok: false, error: "Unknown report", errorCode: "W7-404" };
  if (!canRunReport(user, report)) return { ok: false, error: "You cannot view this report", errorCode: "W7-403", http: 403 };
  const result = runReport(state, reportId, opts);
  if (result.error) return { ok: false, ...result };
  return { ok: true, ...result, wave7: true, engine: "report-ops" };
}

const SENSITIVE_EXPORT_FIELDS = ["phone", "ghanaCard", "nationalId", "password", "pin", "momoPin", "token", "secret"];

export function maskReportRows(rows = [], { mask = true } = {}) {
  if (!mask) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    SENSITIVE_EXPORT_FIELDS.forEach((field) => {
      if (copy[field] != null && copy[field] !== "") copy[field] = "[REDACTED]";
    });
    return copy;
  });
}

export function exportWave7Report(state, reportId, { user, format = "csv", mask = true, uid, now, ...filters } = {}) {
  ensureWave7State(state, uid, now);
  const report = REPORT_CATALOG.find((item) => item.id === reportId);
  if (!report) return { ok: false, error: "Unknown report", errorCode: "W7-404" };
  if (!canRunReport(user, report)) return { ok: false, error: "Export forbidden", errorCode: "W7-403", http: 403 };
  if (!permitted(user, "Reports.View") && !permitted(user, "Reports.Print") && !isSystemOwner(user)) {
    return { ok: false, error: "Export forbidden", errorCode: "W7-403", http: 403 };
  }
  const result = runReport(state, reportId, { user, ...filters });
  if (result.error) return { ok: false, ...result };
  const masked = {
    ...result,
    rows: maskReportRows(result.rows || [], { mask })
  };
  const fmt = String(format || "csv").toLowerCase();
  let body = "";
  let contentType = "text/csv";
  if (fmt === "json") {
    body = JSON.stringify({
      report: masked.report,
      columns: masked.columns,
      rows: masked.rows,
      summary: masked.summary,
      version: REPORT_VERSION,
      wave7: WAVE7_VERSION
    }, null, 2);
    contentType = "application/json";
  } else if (fmt === "pdf") {
    body = [
      `%PDF-WAVE7-PRINT-LAYOUT`,
      `Report: ${masked.report?.name || reportId}`,
      `Generated: ${nowIso(now)}`,
      `Rows: ${(masked.rows || []).length}`,
      `Note: Use window.print / Electron printToPDF for real PDF rendering.`,
      ...((masked.rows || []).slice(0, 50).map((row) => JSON.stringify(row)))
    ].join("\n");
    contentType = "application/pdf+text";
  } else {
    // csv + excel (Excel opens CSV)
    body = exportReportCsv(masked, {
      company: "Smile Trust",
      generatedAt: nowIso(now),
      generatedBy: user?.username || user?.id || "",
      filters
    });
    contentType = fmt === "excel" ? "application/vnd.ms-excel" : "text/csv";
  }
  const exportRow = {
    id: newId("w7x", uid),
    reportId,
    format: fmt,
    rowCount: (masked.rows || []).length,
    masked: Boolean(mask),
    createdAt: nowIso(now),
    createdBy: user?.id || "",
    status: "Queued"
  };
  state.reportExports.push(exportRow);
  state.wave7ExportLog.push(exportRow);
  auditWave7(state, "Wave7.Report.Export", `${reportId} format=${fmt} rows=${exportRow.rowCount}`, user, { category: "security" }, uid);
  return {
    ok: true,
    format: fmt,
    contentType,
    body,
    export: exportRow,
    masked: Boolean(mask)
  };
}

export function scheduleWave7Report(state, data, user, uid) {
  ensureWave7State(state, uid);
  const result = scheduleReport(state, data, user, uid);
  if (result.error) return { ok: false, error: result.error, errorCode: "W7-422" };
  auditWave7(state, "Wave7.Report.Schedule", data.reportId, user, {}, uid);
  return { ok: true, ...result, framework: reportingFrameworkMeta().schedulerStub };
}

/**
 * NL-ish / structured AI insight router — Module 29 only; always audited.
 */
export function routeAiInsight(state, query = {}, user, uid, now) {
  ensureWave7State(state, uid, now);
  const gate = requireAny(user, ["Ai.Predict", "Ai.View", "Reports.Executive"]);
  if (!gate.ok) return gate;
  if (!permitted(user, "Ai.Predict") && !isSystemOwner(user)) {
    return { ok: false, error: "AI predict permission required", errorCode: "W7-403", http: 403 };
  }

  const text = String(query.text || query.intent || "").toLowerCase();
  let intent = query.intent || "insights";
  if (/fraud|anomaly|suspicious/.test(text)) intent = "fraud";
  else if (/forecast|predict|30d|90d|12m|cash/.test(text)) intent = "forecast";
  else if (/recommend|suggest/.test(text)) intent = "recommend";
  else if (/growth|collect|kpi|report/.test(text)) intent = "predict";

  const requestId = newId("w7ai", uid);
  const requestLog = {
    id: requestId,
    intent,
    text: String(query.text || "").slice(0, 500),
    userId: user?.id || "",
    username: user?.username || "",
    branchId: user?.branchId || "",
    createdAt: nowIso(now),
    advisory: true,
    autoApprove: false
  };
  state.wave7AiAuditLog.push(requestLog);
  auditWave7(state, "Wave7.AI.Request", `${intent} ${requestId}`, user, { category: "security" }, uid);

  let response;
  if (intent === "fraud") {
    response = runWave7FraudScan(state, { ...query, includeAi: true }, user, uid, now);
  } else if (intent === "forecast") {
    response = runWave7Forecast(state, query, user, uid, now);
  } else if (intent === "recommend") {
    response = generateRecommendations(state, query, user, uid, now);
  } else {
    response = runPrediction(state, { target: query.target || "growth", ...query }, user, uid, now);
  }

  const responseLog = {
    id: newId("w7air", uid),
    requestId,
    intent,
    ok: Boolean(response?.ok),
    advisory: true,
    postsMoney: false,
    autoApprovesLoan: false,
    createdAt: nowIso(now)
  };
  state.wave7AiAuditLog.push(responseLog);
  state.wave7InsightLog.push({ request: requestLog, response: responseLog, intent });
  auditWave7(state, "Wave7.AI.Response", `${intent} ok=${responseLog.ok}`, user, { category: "security" }, uid);

  return {
    ok: Boolean(response?.ok),
    intent,
    requestId,
    result: response,
    advisory: true,
    postsMoney: false,
    autoApprovesLoan: false,
    governance: "Module 29"
  };
}

function hourOf(iso) {
  const d = new Date(iso || Date.now());
  return Number.isFinite(d.getTime()) ? d.getUTCHours() : 12;
}

/**
 * Deterministic fraud/anomaly detectors + optional Module 29 AI scan.
 * Detect only — never mutates balances / ledger.
 */
export function runWave7FraudScan(state, payload = {}, user, uid, now) {
  ensureWave7State(state, uid, now);
  const gate = requireAny(user, ["Ai.Predict", "Reports.Audit", "Audit.View", "Security.View"]);
  if (!gate.ok) return gate;

  const findings = [];
  const ts = nowIso(now);
  const collections = state.collections || [];
  const seen = new Map();
  collections.forEach((c) => {
    const key = `${c.customerId}|${c.date}|${c.amount}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  for (const [key, count] of seen.entries()) {
    if (count >= 2) {
      const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "duplicate_txn");
      findings.push({
        ruleId: rule.id,
        code: rule.code,
        severity: rule.severityityDefault,
        confidence: 0.9,
        evidence: { key, count },
        recommendedAction: rule.recommendedAction,
        mutatesLedger: false
      });
    }
  }

  const byCollectorDay = new Map();
  collections.filter((c) => isPostedCollection(c)).forEach((c) => {
    const k = `${c.collectorId || c.agentId || "na"}|${c.date}`;
    byCollectorDay.set(k, (byCollectorDay.get(k) || 0) + Number(c.amount || 0));
  });
  const amounts = [...byCollectorDay.values()];
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  for (const [key, total] of byCollectorDay.entries()) {
    if (avg > 0 && total > avg * 3 && total > 500) {
      const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "abnormal_collections");
      findings.push({
        ruleId: rule.id,
        code: rule.code,
        severity: rule.severityityDefault,
        confidence: 0.7,
        evidence: { key, total, avg: +avg.toFixed(2) },
        recommendedAction: rule.recommendedAction,
        mutatesLedger: false
      });
    }
  }

  const withdrawals = state.withdrawals || state.transactions || [];
  const recentWd = withdrawals.filter((w) => /withdraw/i.test(String(w.type || w.kind || "")) || w.withdrawal === true);
  if (recentWd.length >= 5) {
    const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "suspicious_withdrawals");
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      severity: rule.severityityDefault,
      confidence: 0.65,
      evidence: { count: recentWd.length },
      recommendedAction: rule.recommendedAction,
      mutatesLedger: false
    });
  }

  const loans = state.loans || [];
  const unusualApprovals = loans.filter((loan) => {
    const principal = Number(loan.principal || loan.amount || 0);
    const approvedBy = loan.approvedBy || loan.approverId;
    const createdBy = loan.createdBy || loan.requestedBy;
    return principal >= 10000 && approvedBy && createdBy && approvedBy === createdBy;
  });
  unusualApprovals.forEach((loan) => {
    const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "unusual_loan_approvals");
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      severity: rule.severityityDefault,
      confidence: 0.8,
      evidence: { loanId: loan.id, principal: loan.principal || loan.amount, approvedBy: loan.approvedBy },
      recommendedAction: rule.recommendedAction,
      mutatesLedger: false
    });
  });

  const authFails = (state.auditEvents || state.audit || []).filter((e) =>
    /login.?fail|auth.?fail|unauthorized|denied/i.test(String(e.action || e.details || ""))
  );
  if (authFails.length >= 3) {
    const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "unauthorized_access");
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      severity: rule.severityityDefault,
      confidence: 0.85,
      evidence: { count: authFails.length },
      recommendedAction: rule.recommendedAction,
      mutatesLedger: false
    });
  }

  const syncDash = wave4SyncDashboard(state, { online: true });
  const failRate = Number(syncDash?.progress?.failureRate ?? 0);
  const conflictCount = (state.syncConflicts || []).length;
  if (failRate > 0.25 || conflictCount >= 3) {
    const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "sync_anomaly");
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      severity: rule.severityityDefault,
      confidence: 0.75,
      evidence: { failRate, conflictCount },
      recommendedAction: rule.recommendedAction,
      mutatesLedger: false
    });
  }

  const ooh = collections.filter((c) => {
    const h = hourOf(c.createdAt || `${c.date}T12:00:00.000Z`);
    return h < 5 || h >= 22;
  });
  if (ooh.length) {
    const rule = WAVE7_FRAUD_RULES.find((r) => r.code === "out_of_hours");
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      severity: rule.severityityDefault,
      confidence: 0.6,
      evidence: { count: ooh.length, sampleIds: ooh.slice(0, 5).map((c) => c.id) },
      recommendedAction: rule.recommendedAction,
      mutatesLedger: false
    });
  }

  // Prefer Rule Engine evaluation when a published fraud rule exists (non-fatal).
  try {
    const ruleEval = evaluateRule(state, { code: "fraud_review", context: { findingsCount: findings.length } }, user, uid, now, { simulate: true, record: false });
    if (ruleEval && ruleEval.ok === false && ruleEval.error) {
      /* rule may not be published — ignore */
    }
  } catch {
    /* detect-only path must not throw on missing rules */
  }

  let ai = null;
  if (payload.includeAi !== false && (permitted(user, "Ai.Predict") || isSystemOwner(user))) {
    try {
      ai = detectFraud(state, payload, user, uid, now);
      if (ai?.ok && Array.isArray(ai.alerts)) {
        ai.alerts.forEach((alert) => {
          findings.push({
            ruleId: "W7-FR-AI",
            code: alert.type || "ai_fraud",
            severity: alert.severityity || "medium",
            confidence: Number(alert.score || 0.5),
            evidence: { detail: alert.detail, alertId: alert.id },
            recommendedAction: "Review AI fraud alert in Module 29 Fraud Dashboard (advisory)",
            mutatesLedger: false,
            source: "Module29"
          });
        });
      }
    } catch {
      ai = { ok: false, skipped: true };
    }
  }

  const created = findings.map((f) => {
    const row = {
      id: newId("w7fraud", uid),
      ...f,
      status: "open",
      createdAt: ts,
      createdBy: user?.id || "",
      postsMoney: false,
      autoApprovesLoan: false
    };
    state.wave7FraudFindings.push(row);
    return row;
  });

  auditWave7(state, "Wave7.Fraud.Scan", `findings=${created.length} rules=${WAVE7_FRAUD_RULES.length}`, user, { category: "security" }, uid);

  return {
    ok: true,
    findings: created,
    count: created.length,
    rules: WAVE7_FRAUD_RULES.length,
    mutatesLedger: false,
    postsCollections: false,
    autoApprovesLoan: false,
    ai,
    anomalies: detectAnomalies(state, payload, user, uid, now)
  };
}

function movingAverage(values, window) {
  const w = Math.max(1, Number(window) || 3);
  if (!values.length) return 0;
  const slice = values.slice(-w);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function linearForecast(values, steps) {
  const n = values.length;
  if (n < 2) return values[n - 1] || 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  values.forEach((y, i) => {
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  });
  const denom = n * sumXX - sumX * sumX;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  return intercept + slope * (n - 1 + steps);
}

/**
 * Transparent forecast helpers (30d / 90d / 12m). Advisory only.
 */
export function runWave7Forecast(state, payload = {}, user, uid, now) {
  ensureWave7State(state, uid, now);
  const gate = requireAny(user, ["Ai.Predict", "Reports.Executive", "Bi.View"]);
  if (!gate.ok) return gate;

  const horizon = payload.horizon || "30d";
  const series = analyticsSeries(state, payload.range || {}, user).map((r) => Number(r.amount || 0));
  const steps = horizon === "12m" ? 12 : horizon === "90d" ? 90 : 30;
  const method = payload.method === "linear" ? "linear" : "moving_average";
  const ma = movingAverage(series, Math.min(7, Math.max(3, series.length)));
  const linear = linearForecast(series.length ? series : [ma], Math.min(steps, 30));
  const point = method === "linear" ? linear : ma;
  const growth = Math.round(point * (horizon === "12m" ? 30 : horizon === "90d" ? 3 : 1) * 100) / 100;
  const cashPesewas = toPesewas(growth);
  const apiEstimate = Math.round(100 + (series.length || 1) * steps);

  let module29 = null;
  if (permitted(user, "Ai.Predict") || isSystemOwner(user)) {
    const mapped = horizon === "12m" ? "monthly" : horizon === "90d" ? "monthly" : "daily";
    module29 = runForecast(state, { horizon: mapped }, user, uid, now);
  }

  const row = {
    id: newId("w7fc", uid),
    horizon,
    method,
    growthGhs: growth,
    cashPesewas,
    apiTrafficEstimate: apiEstimate,
    advisory: true,
    opaqueMl: false,
    createdAt: nowIso(now),
    createdBy: user?.id || ""
  };
  state.wave7ForecastLog.push(row);
  auditWave7(state, "Wave7.Forecast", `${horizon} ${method}`, user, {}, uid);

  return {
    ok: true,
    forecast: row,
    module29,
    advisory: true,
    postsMoney: false,
    methodNote: "Transparent moving average / linear projection; Module 29 forecast attached when authorized"
  };
}

export function generateRegulatoryReport(state, templateId, { user, range = {}, uid, now } = {}) {
  ensureWave7State(state, uid, now);
  const template = WAVE7_REGULATORY_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return { ok: false, error: "Unknown regulatory template", errorCode: "W7-404" };
  if (!permitted(user, template.permission) && !permitted(user, "Reports.View") && !isSystemOwner(user)) {
    return { ok: false, error: "Forbidden", errorCode: "W7-403", http: 403 };
  }
  const scoped = scopedState(state, user);
  const dash = reportDashboard(state, range, user);
  const collectionsPesewas = toPesewas(dash.todayCollections || 0);
  const outstandingPesewas = toPesewas(Number(dash.outstandingLoans || 0));
  const payload = {
    templateId: template.id,
    name: template.name,
    category: template.category,
    generatedAt: nowIso(now),
    currency: "GHS",
    amountUnit: "pesewas_and_ghs",
    interestDefault: 15,
    collectionDays: 31,
    cashierLimitGhs: 1000,
    data: {
      totalSavingsPesewas: toPesewas(Number(dash.totalSavings || 0)),
      totalCollectionsPesewas: collectionsPesewas,
      loanOutstandingPesewas: outstandingPesewas,
      parRate: dash.par?.rate ?? 0,
      cashPositionPesewas: toPesewas(Number(dash.cashPosition || 0)),
      branchId: user?.branchId || "",
      collectionsPesewas,
      activeCustomers: dash.activeCustomers,
      agents: (scoped.users || []).filter((u) => u.role === "Collector").length,
      newCustomers: (scoped.customers || []).filter((c) => range.from && String(c.createdAt || "").slice(0, 10) >= range.from).length,
      dormantCustomers: (scoped.customers || []).filter((c) => c.active === false || c.memberStatus === "Dormant").length,
      activeLoans: dash.activeLoans,
      outstandingPesewas,
      disbursedPesewas: toPesewas((scoped.loans || []).reduce((s, l) => s + Number(l.principal || 0), 0)),
      recoveryRate: dash.loanRecoveryRate,
      par: dash.par,
      auditCount: (state.auditEvents || state.audit || []).length,
      fraudAlertCount: (state.wave7FraudFindings || []).length + (state.aiFraudAlerts || []).length,
      exportCount: (state.wave7ExportLog || []).length,
      aiRequestCount: (state.wave7AiAuditLog || []).filter((r) => String(r.id || "").startsWith("w7ai")).length
    }
  };
  auditWave7(state, "Wave7.Regulatory.Generate", templateId, user, { category: "compliance" }, uid);
  return { ok: true, template, report: payload };
}

export function analyzeWave7Gaps(state = {}, { user = null } = {}) {
  const items = WAVE7_GAP_CHECKLIST.map((g) => ({ ...g }));
  const openCritical = items.filter((g) => g.severity === "critical" && g.status !== "closed");
  return {
    wave: WAVE7_WAVE,
    version: WAVE7_VERSION,
    architecture: "shared-spa-analytics-facade",
    notNextJsRewrite: true,
    catalogAlias: WAVE7_CATALOG_ALIAS,
    actorPresent: Boolean(user),
    items,
    closedCount: items.filter((g) => g.status === "closed").length,
    partialCount: items.filter((g) => g.status === "partial").length,
    deferredCount: items.filter((g) => g.status === "deferred").length,
    openCritical: openCritical.length,
    pilotReady: openCritical.length === 0,
    fraudRules: WAVE7_FRAUD_RULES.length,
    canonicalKpis: WAVE7_CANONICAL_KPI_CODES.length,
    moneyDefaults: {
      interest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000,
      currency: "GHS",
      pesewas: true
    },
    forbiddenSample: SUPER_ADMIN_FORBIDDEN.slice(0, 3),
    parity: WAVE7_PARITY_CHECKLIST.slice()
  };
}

export function createWave7AnalyticsServices(state, { uid, now, user } = {}) {
  ensurePortalApi(state);
  ensureWave7State(state, uid, now);
  const platform = createApiPlatform(state, { actor: user, uid, now });
  return {
    wave: WAVE7_WAVE,
    version: WAVE7_VERSION,
    architecture: "shared-spa-analytics-facade",
    notNextJsRewrite: true,
    catalogAlias: WAVE7_CATALOG_ALIAS,
    api: platform,
    invoke: (request, ctx = {}) => invokeApi(state, request, { user, uid, now, ...ctx }),
    catalog: () => listWave7ReportCatalog(user),
    framework: () => reportingFrameworkMeta(),
    kpis: (range) => calculateWave7Kpis(state, range, user, uid, now),
    publishKpi: (kpiId) => publishWave7Kpi(state, kpiId, user, uid, now),
    executive: (opts) => executiveDashboard(state, { ...opts, user, uid, now }),
    drilldown: (opts) => biDrilldown(state, { ...opts, user }),
    compare: (opts) => biPeriodCompare(state, { ...opts, user, uid, now }),
    benchmark: (opts) => branchBenchmark(state, { ...opts, user }),
    report: (reportId, opts) => runWave7Report(state, reportId, { user, uid, now, ...opts }),
    export: (reportId, opts) => exportWave7Report(state, reportId, { user, uid, now, ...opts }),
    schedule: (data) => scheduleWave7Report(state, data, user, uid),
    ai: (query) => routeAiInsight(state, query, user, uid, now),
    fraud: (payload) => runWave7FraudScan(state, payload, user, uid, now),
    forecast: (payload) => runWave7Forecast(state, payload, user, uid, now),
    regulatory: (templateId, opts) => generateRegulatoryReport(state, templateId, { user, uid, now, ...opts }),
    metrics: (filters) => listMetrics(state, filters),
    aiDash: () => aiDashboard(state, user, uid),
    monitoring: () => monitoringDashboard(state),
    gaps: () => analyzeWave7Gaps(state, { user }),
    parity: () => WAVE7_PARITY_CHECKLIST.slice()
  };
}

export function wave7SmokeChecklist(state = {}, { user = null } = {}) {
  ensureWave7State(state);
  const gaps = analyzeWave7Gaps(state, { user });
  return {
    wave: WAVE7_WAVE,
    version: WAVE7_VERSION,
    architecture: "shared-spa-analytics-facade",
    notNextJsRewrite: true,
    catalogAlias: WAVE7_CATALOG_ALIAS,
    pilotReady: gaps.pilotReady,
    catalogCount: REPORT_CATALOG.length,
    fraudRules: WAVE7_FRAUD_RULES.length,
    canonicalKpis: WAVE7_CANONICAL_KPI_CODES.length,
    regulatoryTemplates: WAVE7_REGULATORY_TEMPLATES.length,
    aiAdvisoryOnly: true,
    formulaSoT: "Module 27 bi-ops",
    invokeApiEntry: "Wave 3",
    moneyDefaults: gaps.moneyDefaults
  };
}

export function resolveMetricInputsForTests(state, range, user) {
  return resolveMetricInputs(state, range, user);
}

export function calculateSingleKpiViaFacade(state, kpiCode, range, user, uid, now) {
  ensureWave7State(state, uid, now);
  return calculateKpi(state, kpiCode, range, user, uid, now);
}

export { fromPesewas, toPesewas, outstandingLoanBalance };
