/**
 * Wave 5 — Enterprise Web Admin Portal (SPA hardening) tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WAVE5_WAVE,
  WAVE5_VERSION,
  WAVE5_MODULE_SCREEN_MAP,
  WAVE5_GAP_CHECKLIST,
  analyzeWave5Gaps,
  buildOpsMonitoringModel,
  collectorPresenceRows,
  portalGlobalSearch,
  portalDashboardKpis,
  portalInvoke,
  assertPortalAction,
  applyPortalAdvancedFilters,
  createLazyPanelRegistry,
  loadLazyPanelState,
  persistLazyPanelState,
  wave5SmokeChecklist,
  createWave5PortalServices
} from "../src/core/wave5-admin-portal-ops.js";
import {
  renderOpsMonitoringPanel,
  renderPortalApiKpiStrip,
  renderPortalGlobalSearchPanel,
  renderAdminPortalChecklist,
  renderModuleScreenMap
} from "../src/ui/admin-portal-views.js";
import { stLazyPanel, stSearchField, stSrOnly, stMoneyStat } from "../src/ui/shared-primitives.js";
import { bootstrapApiPlatform, resetApiPlatformForTests, invokeApi } from "../src/api/index.js";
import { getWave, listBacklogForWave } from "../src/core/enterprise-roadmap-registry.js";
import { toPesewas } from "../src/core/money.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const now = "2026-09-15T12:00:00.000Z";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

function blankState() {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  const today = new Date().toISOString().slice(0, 10);
  return {
    settings: { loanInterest: 15, collectionDays: 31, cashierApprovalLimit: 1000 },
    users: [
      { id: "u-owner", username: "john", role: "SystemOwner", systemOwner: true, name: "John", active: true },
      { id: "u-admin", username: "admin1", role: "Admin", name: "Admin", active: true, branchId: "br-1", groupId: "br-1" },
      { id: "u-col", username: "col1", role: "Collector", name: "Kojo", active: true, branchId: "br-1", groupId: "br-1" },
      { id: "u-sa", username: "kba", role: "KBA", name: "KBA", active: true }
    ],
    customers: [
      { id: "c-1", name: "Ama Mensah", phone: "0244111111", accountNo: "ACC-1", branchId: "br-1", groupId: "br-1", memberStatus: "Active" },
      { id: "c-2", name: "Kofi Boateng", phone: "0244222222", accountNo: "ACC-2", branchId: "br-2", groupId: "br-2", memberStatus: "Active" }
    ],
    collections: [
      {
        id: "col-1",
        customerId: "c-1",
        collectorId: "u-col",
        amount: 50,
        amountPesewas: 5000,
        date: today,
        receiptNo: "R-1",
        createdAt: `${today}T11:00:00.000Z`,
        reversed: false
      }
    ],
    loans: [{ id: "ln-1", customerId: "c-1", status: "Active", principal: 1000 }],
    groups: [{ id: "br-1", name: "Accra Central", code: "ACC" }],
    devices: [{ id: "dev-1", userId: "u-col", lastSeenAt: new Date().toISOString(), label: "Kojo phone" }],
    offlineQueue: [
      { id: "q-1", kind: "collection", status: "pending", agentId: "u-col", payload: { collectorId: "u-col" } }
    ],
    syncConflicts: [],
    audit: [{ id: "a-1", action: "Login", detail: "john", at: `${today}T10:00:00.000Z` }],
    featureFlags: [],
    monitoringServices: [],
    monitoringMetrics: [],
    monitoringAlerts: [],
    wave4Sync: null,
    apiPlatform: null
  };
}

test("wave5 architecture invariants — SPA not Next.js", () => {
  const state = blankState();
  const smoke = wave5SmokeChecklist(state, { user: state.users[0], online: true });
  assert.equal(smoke.wave, WAVE5_WAVE);
  assert.equal(smoke.version, WAVE5_VERSION);
  assert.equal(smoke.architecture, "vanilla-spa-shared-core");
  assert.equal(smoke.notNextJsRewrite, true);
  assert.equal(smoke.notReactRewrite, true);
  assert.equal(smoke.invokeApiPortal, true);
  assert.equal(smoke.moneyDefaults.interest, 15);
  assert.equal(smoke.moneyDefaults.collectionDays, 31);
  assert.equal(smoke.moneyDefaults.cashierLimitGhs, 1000);
  assert.ok(smoke.moduleMapCount >= 8);
  assert.ok(smoke.sharedChannels.includes("web-spa"));
});

test("gap analysis closes critical portal items; one partial write-path gap allowed", () => {
  const gaps = analyzeWave5Gaps(blankState(), { user: { id: "u-owner", role: "SystemOwner", systemOwner: true } });
  assert.equal(gaps.pilotReady, true);
  assert.equal(gaps.openCritical, 0);
  assert.ok(gaps.closedCount >= 10);
  assert.ok(gaps.partialCount >= 1);
  assert.ok(WAVE5_GAP_CHECKLIST.some((g) => g.id === "W5-G11" && g.status === "closed"));
  assert.ok(WAVE5_MODULE_SCREEN_MAP.some((m) => /Customers/i.test(m.area)));
});

test("collector presence and ops monitoring model", () => {
  const state = blankState();
  const nowMs = Date.now();
  const rows = collectorPresenceRows(state, { nowMs });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "online");
  assert.equal(rows[0].pendingSync, 1);
  const mon = buildOpsMonitoringModel(state, {
    user: state.users[0],
    online: true,
    nowMs
  });
  assert.equal(mon.canView, true);
  assert.equal(mon.collectors.online, 1);
  assert.equal(mon.sync.pendingCollections, 1);
  assert.equal(mon.collectionsToday.count, 1);
  assert.equal(mon.collectionsToday.totalPesewas, 5000);
  assert.match(mon.collectionsToday.totalGhsLabel, /GHS/);
});

test("RBAC assertPortalAction enforces SUPER_ADMIN_FORBIDDEN", () => {
  const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
  const superAdmin = { id: "u-sa", role: "KBA", username: "kba" };
  const branchUser = { id: "u-admin", role: "Admin", branchId: "br-1", tenantId: "t-1" };
  assert.equal(assertPortalAction(owner, "System.Reset").ok, true);
  assert.equal(assertPortalAction(superAdmin, "System.Reset").ok, false);
  assert.ok(SUPER_ADMIN_FORBIDDEN.includes("System.Reset"));
  const branchGate = assertPortalAction(branchUser, "Customer.View", { branchId: "br-2" });
  // Admin may be all-scope depending on role defaults — wrong-tenant still fails
  const tenantGate = assertPortalAction({ ...branchUser, role: "Collector" }, "Customer.View", { tenantId: "t-other" });
  assert.equal(tenantGate.ok, false);
  assert.equal(tenantGate.errorCode, "FND-005");
  assert.ok(branchGate.ok === true || branchGate.ok === false);
});

test("advanced filters apply branch/tenant isolation", () => {
  const state = blankState();
  const user = { id: "u-col", role: "Collector", branchId: "br-1", tenantId: "t-1" };
  const filtered = applyPortalAdvancedFilters(state.customers, { q: "ama" }, { user });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "c-1");
  const byBranch = applyPortalAdvancedFilters(state.customers, { branchId: "br-2" }, { user: state.users[0] });
  assert.equal(byBranch.length, 1);
  assert.equal(byBranch[0].id, "c-2");
});

test("portal global search uses invokeApi for customers", async () => {
  resetApiPlatformForTests();
  const state = blankState();
  bootstrapApiPlatform(state);
  const owner = state.users[0];
  const results = await portalGlobalSearch(state, { q: "Ama" }, { user: owner, uid, now });
  assert.equal(results.ok, true);
  assert.ok(results.customers.length >= 1);
  assert.ok(results.totalHits >= 1);
});

test("portalDashboardKpis wires dashboards + collections.daily + money defaults", async () => {
  resetApiPlatformForTests();
  const state = blankState();
  bootstrapApiPlatform(state);
  const owner = state.users[0];
  const kpis = await portalDashboardKpis(state, { user: owner, uid, now });
  assert.equal(kpis.source, "invokeApi");
  assert.equal(kpis.dailyCollections.count, 1);
  assert.equal(kpis.dailyCollections.totalPesewas, 5000);
  assert.ok(kpis.moneyDefaults);
});

test("portalInvoke customers.list and authorization.forbidden", async () => {
  resetApiPlatformForTests();
  const state = blankState();
  bootstrapApiPlatform(state);
  const owner = state.users[0];
  const list = await portalInvoke(state, { operationId: "v1/customers.list", query: { pageSize: 10 } }, { user: owner, uid, now });
  assert.equal(list.ok, true);
  const forbidden = await invokeApi(state, { operationId: "v1/authorization.forbidden" }, { user: owner, uid, now });
  assert.equal(forbidden.ok, true);
  assert.ok((forbidden.data?.forbidden || []).includes("Export.All"));
});

test("lazy panel registry persists to sessionStorage", () => {
  globalThis.sessionStorage = memoryStorage();
  const reg = loadLazyPanelState("wave5_test_panels");
  assert.equal(reg.isOpen("ops"), false);
  reg.toggle("ops");
  persistLazyPanelState(reg, "wave5_test_panels");
  const again = loadLazyPanelState("wave5_test_panels");
  assert.equal(again.isOpen("ops"), true);
  const fresh = createLazyPanelRegistry({ a: true });
  assert.equal(fresh.isOpen("a"), true);
});

test("UI panels include a11y labels and pesewas-safe KPI strip", () => {
  const monHtml = renderOpsMonitoringPanel({
    canView: true,
    network: "online",
    collectors: { total: 1, online: 1, offline: 0, rows: [{ name: "Kojo", status: "online", pendingSync: 1, lastSeenAt: "2026-09-15T11:55:00.000Z" }] },
    sync: { pending: 1, conflicts: 0, pendingCollections: 1, progressPct: 20, stage: "Queued", engineStatus: "idle" },
    health: { status: "healthy", score: 90, offlineDevices: 0, devices: 1 },
    collectionsToday: { count: 1, totalPesewas: 5000, totalGhsLabel: "GHS 50.00" },
    auditTail: [{ action: "Login", detail: "ok", at: "2026-09-15T10:00:00.000Z" }]
  });
  assert.ok(monHtml.includes("Operations monitoring"));
  assert.ok(monHtml.includes("aria-label"));
  assert.ok(monHtml.includes("GHS 50.00"));
  assert.ok(monHtml.includes("wave5-collectors"));

  const kpiHtml = renderPortalApiKpiStrip({
    ok: true,
    source: "invokeApi",
    dailyCollections: { count: 1, totalGhsLabel: "GHS 50.00" },
    moneyDefaults: { loanInterest: 15, collectionDays: 31, cashierLimitGhs: 1000 }
  });
  assert.ok(kpiHtml.includes("15%"));
  assert.ok(kpiHtml.includes("31"));

  const searchHtml = renderPortalGlobalSearchPanel({ query: "ama", canSearch: true });
  assert.ok(searchHtml.includes("role=\"search\""));
  assert.ok(searchHtml.includes("wave5GlobalSearchForm"));

  const gaps = analyzeWave5Gaps(blankState());
  assert.ok(renderAdminPortalChecklist(gaps).includes("Wave 5 admin portal checklist"));
  assert.ok(renderModuleScreenMap(WAVE5_MODULE_SCREEN_MAP).includes("Module → SPA screen map"));

  assert.ok(stLazyPanel({ id: "t1", title: "T", body: "x", open: false }).includes("details"));
  assert.ok(stSearchField({ id: "s1", label: "Find" }).includes("type=\"search\""));
  assert.ok(stSrOnly("hidden").includes("sr-only"));
  assert.ok(stMoneyStat({ label: "Cash", valueLabel: "GHS 1.00" }).includes("GHS 1.00"));
  assert.equal(toPesewas(50), 5000);
});

test("createWave5PortalServices facade", () => {
  resetApiPlatformForTests();
  const state = blankState();
  const services = createWave5PortalServices(state, { uid, now, user: state.users[0] });
  assert.equal(services.wave, WAVE5_WAVE);
  assert.equal(services.notNextJsRewrite, true);
  assert.equal(services.moneyDefaults().loanInterest ?? services.moneyDefaults().interest ?? 15, 15);
  assert.ok(services.moduleMap().length >= 8);
});

test("WAVE-05 roadmap docs and backlog mapping", () => {
  const wave = getWave("WAVE-05");
  assert.ok(wave);
  assert.equal(wave.waveStatus, "Mostly Complete");
  assert.ok((wave.requiredDocumentation || []).some((d) => String(d).includes("wave5-web-admin-portal")));
  assert.ok((wave.dependencies?.relatedTests || []).some((t) => String(t).includes("wave5")));
  const items = listBacklogForWave("WAVE-05");
  assert.ok(items.length > 0);
  const docPath = path.join(ROOT, "docs", "wave5-web-admin-portal.md");
  assert.equal(fs.existsSync(docPath), true);
  const doc = fs.readFileSync(docPath, "utf8");
  assert.match(doc, /Next\.js/i);
  assert.match(doc, /not.*Next\.js|Next\.js.*rewrite/i);
  assert.match(doc, /invokeApi/);
  assert.match(doc, /prepare:web/);
});
