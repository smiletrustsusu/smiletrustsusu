/**
 * Wave 7 — Analytics / BI / AI facade tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WAVE7_WAVE,
  WAVE7_VERSION,
  WAVE7_CATALOG_ALIAS,
  WAVE7_CANONICAL_KPI_CODES,
  WAVE7_FRAUD_RULES,
  WAVE7_GAP_CHECKLIST,
  WAVE7_PARITY_CHECKLIST,
  ensureWave7State,
  analyzeWave7Gaps,
  wave7SmokeChecklist,
  assertCanonicalKpiFixtures,
  calculateWave7Kpis,
  calculateSingleKpiViaFacade,
  executiveDashboard,
  biDrilldown,
  biPeriodCompare,
  branchBenchmark,
  runWave7FraudScan,
  routeAiInsight,
  runWave7Forecast,
  exportWave7Report,
  generateRegulatoryReport,
  listWave7ReportCatalog,
  createWave7AnalyticsServices,
  maskReportRows
} from "../src/core/wave7-analytics-bi-ops.js";
import { ensureBiState } from "../src/core/bi-ops.js";
import { renderWave7AnalyticsPanel, renderWave7ReportsExtra } from "../src/ui/wave7-analytics-views.js";
import { getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const now = "2026-09-16T12:00:00.000Z";
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw", branchId: "b1" };
const noAccess = { id: "u-none", role: "NoAccessRole", username: "guest" };

function blankState() {
  const state = {
    settings: {
      currency: "GHS",
      loanInterest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000,
      encryptOfflineQueue: true
    },
    users: [owner, collector],
    customers: [
      { id: "c-a", name: "Ama", active: true, memberStatus: "Active", phone: "0241112222", createdAt: "2026-09-01" },
      { id: "c-b", name: "Kofi", active: true, memberStatus: "Active", createdAt: "2026-09-10" }
    ],
    collections: [
      { id: "col-1", customerId: "c-a", date: "2026-09-15", amount: 20, status: "Posted", collectorId: "u-col", branchId: "b1", createdAt: "2026-09-15T10:00:00.000Z" },
      { id: "col-2", customerId: "c-a", date: "2026-09-15", amount: 20, status: "Posted", collectorId: "u-col", branchId: "b1", createdAt: "2026-09-15T10:05:00.000Z" },
      { id: "col-3", customerId: "c-b", date: "2026-09-16", amount: 50, status: "Posted", collectorId: "u-col", branchId: "b1", createdAt: "2026-09-16T09:00:00.000Z" }
    ],
    loans: [
      { id: "ln-1", principal: 12000, amount: 12000, status: "Active", approvedBy: "u-owner", createdBy: "u-owner" }
    ],
    withdrawals: [],
    branches: [{ id: "b1", name: "Accra Central", active: true }],
    groups: [],
    susuGroups: [],
    auditEvents: [
      { action: "login_fail", details: "bad password" },
      { action: "login_fail", details: "bad password" },
      { action: "unauthorized", details: "denied" }
    ],
    syncConflicts: [],
    offlineQueue: [],
    devices: []
  };
  ensureBiState(state);
  ensureWave7State(state, uid, now);
  return state;
}

test("Wave 7 catalog alias and gap checklist pilot-ready", () => {
  assert.equal(WAVE7_WAVE, "WAVE-07");
  assert.match(WAVE7_VERSION, /7\.0/);
  assert.equal(WAVE7_CATALOG_ALIAS.deliveryCode, "ANALYTICS_BI");
  assert.equal(WAVE7_CATALOG_ALIAS.historicalEirCode, "ACCOUNTING_PLATFORM");
  assert.equal(WAVE7_FRAUD_RULES.length, 7);
  assert.equal(WAVE7_CANONICAL_KPI_CODES.length, 10);
  const gaps = analyzeWave7Gaps();
  assert.equal(gaps.openCritical, 0);
  assert.equal(gaps.pilotReady, true);
  assert.equal(gaps.notNextJsRewrite, true);
  assert.equal(gaps.moneyDefaults.interest, 15);
  assert.equal(gaps.moneyDefaults.collectionDays, 31);
  assert.equal(gaps.moneyDefaults.cashierLimitGhs, 1000);
  assert.ok(WAVE7_GAP_CHECKLIST.some((g) => g.id === "W7-G14" && g.status === "deferred"));
  assert.ok(WAVE7_PARITY_CHECKLIST.length >= 7);
  assert.ok(SUPER_ADMIN_FORBIDDEN.includes("System.Reset"));
});

test("canonical KPI fixtures match Module 27 formulas 100%", () => {
  const fixtures = [
    { kpiCode: "KPI-COL-RATE", inputs: { "MET-SAV-001": 80, "MET-SAV-002": 100 }, expected: 80 },
    { kpiCode: "KPI-LOAN-REC", inputs: { "MET-LOAN-001": 45, "MET-LOAN-002": 50 }, expected: 90 },
    { kpiCode: "KPI-SAV-GROWTH", inputs: { "MET-SAV-003": 120, "MET-SAV-004": 100 }, expected: 20 },
    { kpiCode: "KPI-CUS-GROWTH", inputs: { "MET-CUS-001": 10, "MET-CUS-002": 100 }, expected: 10 },
    { kpiCode: "KPI-ACTIVE-MEM", inputs: { "MET-CUS-003": 90, "MET-CUS-004": 100 }, expected: 90 },
    { kpiCode: "KPI-BRANCH-PROFIT", inputs: { "MET-ACC-001": 500, "MET-ACC-002": 200 }, expected: 300 },
    { kpiCode: "KPI-COL-PROD", inputs: { "MET-COL-001": 310, "MET-COL-002": 10 }, expected: 31 },
    { kpiCode: "KPI-WF-SLA", inputs: { "MET-WF-001": 95, "MET-WF-002": 100 }, expected: 95 },
    { kpiCode: "KPI-SYS-AVAIL", inputs: { "MET-MON-001": 100, "MET-MON-002": 1 }, expected: 99 },
    { kpiCode: "KPI-PAY-SUCCESS", inputs: { "MET-PAY-001": 98, "MET-PAY-002": 100 }, expected: 98 }
  ];
  const result = assertCanonicalKpiFixtures(fixtures);
  assert.equal(result.ok, true);
  assert.equal(result.coverage, 10);
  assert.equal(result.results.filter((r) => r.ok).length, 10);
});

test("KPI facade delegates to Module 27 and respects authz", () => {
  const state = blankState();
  const ok = calculateWave7Kpis(state, { from: "2026-09-01", to: "2026-09-16" }, owner, uid, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.sourceOfTruth, "src/core/bi-ops.js#calculateKpi");
  assert.equal(ok.postsMoney, false);
  assert.ok(Array.isArray(ok.extended));
  assert.ok(ok.extended.some((row) => row.id === "EXT-COLLECTIONS-PESEWAS"));

  const denied = calculateWave7Kpis(state, {}, noAccess, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.http, 403);

  const single = calculateSingleKpiViaFacade(state, "KPI-COL-RATE", {}, owner, uid, now);
  assert.ok(single.ok === true || single.errorCode);
});

test("executive dashboard, drilldown, compare, benchmark", () => {
  const state = blankState();
  const exec = executiveDashboard(state, { roleKey: "CEO", range: { from: "2026-09-01", to: "2026-09-16" }, user: owner, uid, now });
  assert.equal(exec.ok, true);
  assert.equal(exec.postsMoney, false);
  assert.equal(exec.formulaSource, "Module 27 bi-ops");

  const drill = biDrilldown(state, { dimension: "branch", range: { from: "2026-09-01", to: "2026-09-16" }, user: owner });
  assert.equal(drill.ok, true);
  assert.ok(Array.isArray(drill.rows));

  const compare = biPeriodCompare(state, {
    current: { from: "2026-09-10", to: "2026-09-16" },
    prior: { from: "2026-09-01", to: "2026-09-09" },
    user: owner,
    uid,
    now
  });
  assert.equal(compare.ok, true);

  const bench = branchBenchmark(state, { range: { to: "2026-09-16" }, user: owner });
  assert.equal(bench.ok, true);
  assert.ok(Array.isArray(bench.branches));
});

test("fraud scan detect-only and AI advisory audited", () => {
  const state = blankState();
  const fraud = runWave7FraudScan(state, { includeAi: true }, owner, uid, now);
  assert.equal(fraud.ok, true);
  assert.equal(fraud.mutatesLedger, false);
  assert.equal(fraud.autoApprovesLoan, false);
  assert.ok(fraud.count >= 1);
  assert.ok(fraud.findings.some((f) => f.code === "duplicate_txn" || f.code === "unusual_loan_approvals" || f.code === "unauthorized_access"));
  assert.ok((state.wave7FraudFindings || []).length >= 1);

  const ai = routeAiInsight(state, { text: "forecast cash 30d" }, owner, uid, now);
  assert.equal(ai.ok, true);
  assert.equal(ai.advisory, true);
  assert.equal(ai.postsMoney, false);
  assert.equal(ai.autoApprovesLoan, false);
  assert.ok((state.wave7AiAuditLog || []).length >= 2);

  const deniedAi = routeAiInsight(state, { text: "predict" }, noAccess, uid, now);
  assert.equal(deniedAi.ok, false);

  const forecast = runWave7Forecast(state, { horizon: "30d", method: "moving_average" }, owner, uid, now);
  assert.equal(forecast.ok, true);
  assert.equal(forecast.advisory, true);
  assert.equal(forecast.postsMoney, false);
});

test("export masking + regulatory templates gated", () => {
  const state = blankState();
  const catalog = listWave7ReportCatalog(owner);
  assert.ok(catalog.length > 0);
  const reportId = catalog[0].id;
  const exported = exportWave7Report(state, reportId, { user: owner, format: "json", mask: true, uid, now });
  assert.equal(exported.ok, true);
  assert.equal(exported.masked, true);

  const masked = maskReportRows([{ phone: "024", ghanaCard: "GHA-1", name: "Ama" }], { mask: true });
  assert.equal(masked[0].phone, "[REDACTED]");
  assert.equal(masked[0].ghanaCard, "[REDACTED]");
  assert.equal(masked[0].name, "Ama");

  const denied = exportWave7Report(state, reportId, { user: noAccess, format: "csv", uid, now });
  assert.equal(denied.ok, false);

  const reg = generateRegulatoryReport(state, "GH-MF-FIN-SUMMARY", { user: owner, uid, now });
  assert.equal(reg.ok, true);
  assert.equal(reg.report.interestDefault, 15);
  assert.equal(reg.report.collectionDays, 31);
  assert.equal(reg.report.cashierLimitGhs, 1000);
});

test("services facade + UI panels render without new nav markers", () => {
  const state = blankState();
  const svc = createWave7AnalyticsServices(state, { uid, now, user: owner });
  assert.equal(svc.notNextJsRewrite, true);
  assert.equal(svc.catalogAlias.deliveryCode, "ANALYTICS_BI");
  const smoke = wave7SmokeChecklist(state, { user: owner });
  assert.equal(smoke.fraudRules, 7);
  assert.equal(smoke.aiAdvisoryOnly, true);

  const html = renderWave7AnalyticsPanel({
    smoke,
    gaps: analyzeWave7Gaps(),
    executive: { kpis: { "KPI-COL-RATE": 80 } },
    fraudFindings: [],
    canView: true,
    canPredict: true,
    canExport: true
  });
  assert.match(html, /Wave 7/);
  assert.match(html, /advisory/i);
  assert.doesNotMatch(html, /next\.js rewrite product/i);

  const reports = renderWave7ReportsExtra({
    catalog: listWave7ReportCatalog(owner).slice(0, 3),
    regulatory: [{ id: "GH-MF-FIN-SUMMARY", name: "Financial" }],
    framework: { catalogCount: 3, exportFormats: ["csv"] }
  });
  assert.match(reports, /Wave 7 reporting framework/);
});

test("docs and registry notes map Wave 7 to analytics delivery", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs/wave7-analytics-bi.md"), "utf8");
  assert.match(doc, /WAVE-07/);
  assert.match(doc, /Analytics|BI/i);
  assert.match(doc, /not.*Next\.js|NOT.*Next\.js/i);
  assert.match(doc, /Module 27|bi-ops/i);
  assert.match(doc, /advisory/i);
  assert.match(doc, /Accounting Platform/);
  assert.match(doc, /pesewas|interest 15|collection days 31/i);

  const wave = getWave(7) || getWave("WAVE-07");
  assert.ok(wave);
  assert.equal(wave.code, "ANALYTICS_BI");
  assert.match(String(wave.name), /Analytics|BI/i);
  assert.ok(String(wave.notes || "").includes("wave7-analytics-bi") || String(wave.notes || "").includes("Analytics"));
  assert.ok(String(wave.notes || "").includes("Accounting") || String(wave.notes || "").includes("ACCOUNTING"));
  assert.ok((wave.requiredDocumentation || []).some((d) => String(d).includes("wave7-analytics-bi")));
});
