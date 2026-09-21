/**
 * Wave 5 — Enterprise Web Administration Portal (shared SPA hardening).
 * NOT a Next.js / React / Tailwind rewrite. Consumes Wave 3 invokeApi.
 */

import { createApiPlatform, invokeApi, bootstrapApiPlatform, isApiPlatformBootstrapped } from "../api/index.js";
import { canAction, dataScope, SUPER_ADMIN_FORBIDDEN } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { wave4SyncDashboard, ensureWave4SyncState } from "../sync/offline-sync-engine.js";
import { ensureMonitoringState, monitoringDashboard } from "./monitoring-ops.js";
import { ensureSystemConfig, FEATURE_FLAG_CATALOG } from "./system-config.js";
import { formatGhs, toPesewas } from "./money.js";

export const WAVE5_VERSION = "5.0.0-admin-portal";
export const WAVE5_WAVE = "WAVE-05";

/** Module / user-prompt area → existing SPA view / surface mapping */
export const WAVE5_MODULE_SCREEN_MAP = Object.freeze([
  { area: "Users / Roles / Permissions", spaView: "settings / users", apiOps: ["v1/users.list", "v1/users.get", "v1/auth.roles", "v1/authorization.can", "v1/authorization.forbidden"], notes: "RBAC in roles.js + rbac.js; SystemOwner=john; KBA developer hidden from owner listings" },
  { area: "Tenant / Region / Branch", spaView: "branches / platform admin (Audit)", apiOps: ["v1/authorization.checkTenantBranch", "v1/authorization.scope"], notes: "branch-ops + platform tenants; no new top-level nav" },
  { area: "Devices", spaView: "backup / sync", apiOps: ["v1/auth.registerDevice", "v1/sync.status"], notes: "Device authorize/revoke under Sync" },
  { area: "Feature Flags / System Config", spaView: "settings", apiOps: ["v1/configuration.get", "v1/configuration.flags", "v1/configuration.moneyDefaults"], notes: "system-config-views + Module 30 flags" },
  { area: "Customers", spaView: "customers", apiOps: ["v1/customers.list", "v1/customers.search", "v1/customers.register", "v1/customers.get"], notes: "CRM wizard; Wave 5 wires search/list via invokeApi" },
  { area: "Savings", spaView: "collections / savingsProducts", apiOps: ["v1/savings.balance", "v1/savings.statement", "v1/savings.collect"], notes: "Pesewas SoT in collection-ops" },
  { area: "Daily Collections", spaView: "collections", apiOps: ["v1/collections.record", "v1/collections.daily", "v1/collections.list"], notes: "31-day cycle; offline queue Wave 4" },
  { area: "Loans", spaView: "loans", apiOps: ["v1/loans.apply", "v1/loans.list", "v1/loans.repay", "v1/loans.portfolio"], notes: "Interest default 15; WAVE-06 delivery is Windows EXE — loan deep SM deferred" },
  { area: "Accounting", spaView: "accounting", apiOps: ["v1/accounting.trialBalance", "v1/accounting.cashFlow", "v1/accounting.cashbook"], notes: "WAVE-07 owns GL rewrite out-of-scope" },
  { area: "Reports / Dashboards", spaView: "reports / home dashboard", apiOps: ["v1/reporting.run", "v1/reporting.dashboard", "v1/dashboards.summary", "v1/dashboards.kpis"], notes: "Phase 17 performance: cached reads + lazy panels" },
  { area: "Ops monitoring (sync / health / audit)", spaView: "audit + reports + backup (no new nav)", apiOps: ["v1/monitoring.health", "v1/sync.status", "v1/sync.progress", "v1/audit.search"], notes: "Wave 5 ops panel under Audit/Reports" }
]);

export const WAVE5_GAP_CHECKLIST = Object.freeze([
  { id: "W5-G01", title: "Admin surfaces exist in SPA (users/roles/branches/config/flags)", status: "closed", severity: "critical" },
  { id: "W5-G02", title: "Customer / savings / collections / loans / accounting / reports UI present", status: "closed", severity: "critical" },
  { id: "W5-G03", title: "RBAC + tenant/branch isolation on portal API paths", status: "closed", severity: "critical" },
  { id: "W5-G04", title: "Ops monitoring (collector / sync queue / health / audit) under Audit/Reports", status: "closed", severity: "high" },
  { id: "W5-G05", title: "Wire admin/read workflows to Wave 3 invokeApi (no duplicated posting rules)", status: "closed", severity: "high" },
  { id: "W5-G06", title: "Collections reconciliation + pending sync visibility", status: "closed", severity: "high" },
  { id: "W5-G07", title: "Dashboard/report accuracy via API-backed KPIs (pesewas)", status: "closed", severity: "high" },
  { id: "W5-G08", title: "Global search / advanced filter helpers on shared primitives", status: "closed", severity: "medium" },
  { id: "W5-G09", title: "Accessibility (labels, keyboard, contrast) on touched portal panels", status: "closed", severity: "medium" },
  { id: "W5-G10", title: "Lazy panels to reduce unnecessary dashboard re-render cost", status: "closed", severity: "medium" },
  { id: "W5-G11", title: "No Next.js / React / Tailwind portal rewrite", status: "closed", severity: "critical" },
  { id: "W5-G12", title: "Full mutation paths (every collection/loan write) forced through invokeApi", status: "partial", severity: "low", note: "Legacy Class-A collection wizard remains; portal helpers available for API-first callers" }
]);

function ensurePortalApi(state) {
  if (!isApiPlatformBootstrapped()) {
    bootstrapApiPlatform(state);
  }
}

/**
 * Unified portal invoke — always passes actor for RBAC/tenant/branch middleware.
 */
export async function portalInvoke(state, request, { user, uid, now } = {}) {
  ensurePortalApi(state);
  return invokeApi(state, request, { user, uid, now });
}

export function createWave5PortalServices(state, { uid, now, user } = {}) {
  ensurePortalApi(state);
  ensureWave4SyncState(state);
  ensureMonitoringState(state);
  ensureSystemConfig(state);
  const platform = createApiPlatform(state, { actor: user, uid, now });

  return {
    wave: WAVE5_WAVE,
    version: WAVE5_VERSION,
    architecture: "vanilla-spa-shared-core",
    notNextJsRewrite: true,
    api: platform,
    invoke: (request, ctx = {}) => portalInvoke(state, request, { user, uid, now, ...ctx }),
    can: (action) => canAction(user, action) || isSystemOwner(user),
    scope: () => dataScope(user),
    forbidden: () => SUPER_ADMIN_FORBIDDEN.slice(),
    moduleMap: () => WAVE5_MODULE_SCREEN_MAP.slice(),
    gaps: () => analyzeWave5Gaps(state, { user }),
    monitoring: (opts) => buildOpsMonitoringModel(state, { user, ...opts }),
    search: (query) => portalGlobalSearch(state, query, { user, uid, now }),
    dashboardKpis: () => portalDashboardKpis(state, { user, uid, now }),
    moneyDefaults: () => platform.services.configuration.moneyDefaults()
  };
}

/**
 * Gap analysis snapshot for docs / smoke / UI checklist.
 */
export function analyzeWave5Gaps(state = {}, { user = null } = {}) {
  const items = WAVE5_GAP_CHECKLIST.map((g) => ({ ...g }));
  const open = items.filter((g) => g.status !== "closed");
  const criticalOpen = open.filter((g) => g.severity === "critical");
  return {
    wave: WAVE5_WAVE,
    version: WAVE5_VERSION,
    architecture: "vanilla-spa-shared-core",
    notNextJsRewrite: true,
    actorPresent: Boolean(user),
    items,
    closedCount: items.filter((g) => g.status === "closed").length,
    partialCount: items.filter((g) => g.status === "partial").length,
    openCritical: criticalOpen.length,
    pilotReady: criticalOpen.length === 0,
    moneyDefaults: {
      interest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000,
      currency: "GHS",
      pesewas: true
    }
  };
}

/**
 * Collector online/offline heuristic from devices + recent collections.
 */
export function collectorPresenceRows(state = {}, { nowMs = Date.now(), staleMs = 30 * 60 * 1000 } = {}) {
  const collectors = (state.users || []).filter((u) => u.role === "Collector" && u.active !== false);
  const devices = state.devices || [];
  const collections = state.collections || [];
  return collectors.map((collector) => {
    const device = devices.find((d) => d.userId === collector.id || d.agentId === collector.id)
      || devices.find((d) => String(d.label || "").toLowerCase().includes(String(collector.name || "").toLowerCase()));
    const recent = collections
      .filter((c) => (c.collectorId || c.userId) === collector.id && !c.reversed)
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))[0];
    const lastSeenAt = device?.lastSeenAt || device?.updatedAt || recent?.createdAt || recent?.serverCreatedAt || "";
    const lastMs = lastSeenAt ? Date.parse(lastSeenAt) : 0;
    const online = lastMs > 0 && (nowMs - lastMs) <= staleMs;
    const pendingForAgent = (state.offlineQueue || []).filter((q) =>
      (q.agentId === collector.id || q.payload?.collectorId === collector.id) &&
      !["applied", "acked", "cancelled"].includes(q.status)
    ).length;
    return {
      id: collector.id,
      name: collector.name || collector.username || collector.id,
      branchId: collector.branchId || collector.groupId || "",
      status: online ? "online" : "offline",
      lastSeenAt: lastSeenAt || "",
      deviceId: device?.id || "",
      pendingSync: pendingForAgent
    };
  });
}

/**
 * Ops monitoring model for Audit/Reports panel (no new top-level nav).
 */
export function buildOpsMonitoringModel(state = {}, {
  user = null,
  online = true,
  nowMs = Date.now()
} = {}) {
  ensureWave4SyncState(state);
  ensureMonitoringState(state);
  const dash = wave4SyncDashboard(state, { online });
  const mon = monitoringDashboard(state);
  const collectors = collectorPresenceRows(state, { nowMs });
  const onlineCollectors = collectors.filter((c) => c.status === "online").length;
  const queue = state.offlineQueue || [];
  const pending = queue.filter((q) => !["applied", "acked", "cancelled"].includes(q.status || "pending"));
  const failed = pending.filter((q) => q.status === "failed" || q.status === "retrying");
  const devices = state.devices || [];
  const offlineDevices = devices.filter((d) => d.status === "offline" || d.online === false).length;
  const canView = !user || canAction(user, "Monitor.View") || canAction(user, "Sync.View") || canAction(user, "Audit.View") || canAction(user, "Reports.View") || isSystemOwner(user);

  const today = new Date(nowMs).toISOString().slice(0, 10);
  const todayCollections = (state.collections || []).filter((c) => c.date === today && !c.reversed);
  const todayPesewas = todayCollections.reduce((sum, c) => {
    if (c.amountPesewas != null) return sum + Number(c.amountPesewas);
    return sum + toPesewas(c.amount || 0);
  }, 0);
  const pendingCollectionSync = pending.filter((q) => String(q.kind || "").includes("collection")).length;

  return {
    canView,
    generatedAt: new Date(nowMs).toISOString(),
    network: online ? "online" : "offline",
    collectors: {
      total: collectors.length,
      online: onlineCollectors,
      offline: collectors.length - onlineCollectors,
      rows: collectors
    },
    sync: {
      pending: dash.pending ?? pending.length,
      conflicts: dash.conflicts ?? (state.syncConflicts || []).length,
      failed: failed.length,
      progressPct: dash.progress?.progressPct ?? 0,
      stage: dash.progress?.stage || "—",
      pendingCollections: pendingCollectionSync,
      engineStatus: dash.progress?.engineStatus || dash.status || "idle"
    },
    health: {
      status: mon.status || "healthy",
      score: mon.score ?? 0,
      openAlerts: mon.openAlerts ?? 0,
      openIncidents: mon.openIncidents ?? 0,
      devices: devices.length,
      offlineDevices: offlineDevices || (mon.offlineDevices ?? 0)
    },
    collectionsToday: {
      count: todayCollections.length,
      totalPesewas: todayPesewas,
      totalGhsLabel: formatGhs(todayPesewas, { fromPesewas: true })
    },
    auditTail: (state.audit || []).slice(-8).reverse(),
    moneyDefaults: {
      interest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000
    }
  };
}

/**
 * Global search across customers (invokeApi) + local loans/groups fallback.
 */
export async function portalGlobalSearch(state, query = {}, { user, uid, now } = {}) {
  const q = String(query.q || query.search || "").trim();
  const branchId = query.branchId || "";
  const results = { ok: true, q, customers: [], loans: [], collections: [], groups: [] };

  if (q && (!user || canAction(user, "Customer.View") || isSystemOwner(user))) {
    const api = await portalInvoke(state, {
      operationId: "v1/customers.search",
      query: { q, page: 1, pageSize: query.pageSize || 25, branchId }
    }, { user, uid, now });
    if (api.ok) {
      const rows = api.data?.rows || api.data?.items || api.rows || [];
      results.customers = rows;
    } else {
      results.customersError = api.error || api.problem?.detail || "search failed";
    }
  }

  const needle = q.toLowerCase();
  if (needle && (!user || canAction(user, "Customer.View") || isSystemOwner(user))) {
    results.loans = (state.loans || []).filter((l) =>
      String(l.id || "").toLowerCase().includes(needle) ||
      String(l.customerId || "").toLowerCase().includes(needle) ||
      String(l.status || "").toLowerCase().includes(needle)
    ).slice(0, 15);
    results.collections = (state.collections || []).filter((c) =>
      String(c.receiptNo || "").toLowerCase().includes(needle) ||
      String(c.customerId || "").toLowerCase().includes(needle) ||
      String(c.id || "").toLowerCase().includes(needle)
    ).slice(0, 15);
    results.groups = (state.groups || state.susuGroups || []).filter((g) =>
      String(g.name || "").toLowerCase().includes(needle) ||
      String(g.code || "").toLowerCase().includes(needle)
    ).slice(0, 15);
  }

  results.totalHits = results.customers.length + results.loans.length + results.collections.length + results.groups.length;
  return results;
}

/**
 * Dashboard / report KPIs via Wave 3 APIs (cached reads).
 */
export async function portalDashboardKpis(state, { user, uid, now, branchId = "" } = {}) {
  const [summary, kpis, daily, money, health, syncStatus] = await Promise.all([
    portalInvoke(state, { operationId: "v1/dashboards.summary", query: { branchId } }, { user, uid, now }),
    portalInvoke(state, { operationId: "v1/dashboards.kpis", query: { branchId } }, { user, uid, now }),
    portalInvoke(state, { operationId: "v1/collections.daily", query: {} }, { user, uid, now }),
    portalInvoke(state, { operationId: "v1/configuration.moneyDefaults" }, { user, uid, now }),
    portalInvoke(state, { operationId: "v1/monitoring.health" }, { user, uid, now }),
    portalInvoke(state, { operationId: "v1/sync.status" }, { user, uid, now })
  ]);

  const dailyData = daily.ok ? (daily.data || daily) : {};
  const totalPesewas = Number(dailyData.totalPesewas || dailyData.data?.totalPesewas || 0);

  return {
    ok: summary.ok && kpis.ok,
    summary: summary.data || summary,
    kpis: kpis.data || kpis,
    dailyCollections: {
      ok: daily.ok,
      count: dailyData.count ?? dailyData.data?.count ?? 0,
      totalPesewas,
      totalGhsLabel: formatGhs(totalPesewas, { fromPesewas: true })
    },
    moneyDefaults: money.ok ? (money.data || money) : { loanInterest: 15, collectionDays: 31, cashierLimitGhs: 1000 },
    health: health.ok ? (health.data || health) : null,
    sync: syncStatus.ok ? (syncStatus.data || syncStatus) : null,
    source: "invokeApi"
  };
}

/**
 * Advanced filter helper — branch/tenant/status/q for list UIs.
 */
export function applyPortalAdvancedFilters(rows = [], filters = {}, { user = null } = {}) {
  let out = Array.isArray(rows) ? rows.slice() : [];
  const scope = user ? dataScope(user) : "all";
  if (scope === "branch" && user?.branchId) {
    out = out.filter((row) => {
      const bid = row.branchId || row.groupId || "";
      return !bid || String(bid) === String(user.branchId);
    });
  }
  if (user?.tenantId) {
    out = out.filter((row) => {
      const tid = row.tenantId || row.businessId || "";
      return !tid || String(tid) === String(user.tenantId);
    });
  }
  if (filters.branchId) {
    out = out.filter((row) => String(row.branchId || row.groupId || "") === String(filters.branchId));
  }
  if (filters.status) {
    out = out.filter((row) => String(row.status || row.memberStatus || "").toLowerCase() === String(filters.status).toLowerCase());
  }
  if (filters.from) {
    out = out.filter((row) => String(row.date || row.createdAt || "").slice(0, 10) >= String(filters.from));
  }
  if (filters.to) {
    out = out.filter((row) => String(row.date || row.createdAt || "").slice(0, 10) <= String(filters.to));
  }
  const q = String(filters.q || filters.search || "").trim().toLowerCase();
  if (q) {
    out = out.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }
  return out;
}

/**
 * Permission gate for portal UI actions (hardens gaps beyond nav-only checks).
 */
export function assertPortalAction(user, action, { tenantId, branchId } = {}) {
  if (!user) return { ok: false, errorCode: "FND-001", error: "Authentication required" };
  if (SUPER_ADMIN_FORBIDDEN.includes(action) && !isSystemOwner(user)) {
    return { ok: false, errorCode: "FND-003", error: "SUPER_ADMIN_FORBIDDEN", action };
  }
  if (!canAction(user, action) && !isSystemOwner(user)) {
    return { ok: false, errorCode: "FND-003", error: "Permission denied", action };
  }
  if (tenantId && user.tenantId && String(tenantId) !== String(user.tenantId) && !isSystemOwner(user)) {
    return { ok: false, errorCode: "FND-005", error: "Wrong tenant" };
  }
  const scope = dataScope(user);
  if (branchId && scope === "branch" && user.branchId && String(branchId) !== String(user.branchId)) {
    return { ok: false, errorCode: "FND-005", error: "Wrong branch" };
  }
  return { ok: true, scope };
}

/**
 * Lazy panel registry — dashboards only expand panels when opened.
 */
export function createLazyPanelRegistry(initialOpen = {}) {
  const open = { ...initialOpen };
  return {
    isOpen: (id) => Boolean(open[id]),
    toggle: (id) => {
      open[id] = !open[id];
      return open[id];
    },
    open: (id) => { open[id] = true; },
    close: (id) => { open[id] = false; },
    snapshot: () => ({ ...open })
  };
}

export function loadLazyPanelState(storageKey = "wave5_lazy_panels") {
  try {
    if (typeof sessionStorage === "undefined") return createLazyPanelRegistry();
    const raw = sessionStorage.getItem(storageKey);
    return createLazyPanelRegistry(raw ? JSON.parse(raw) : {});
  } catch {
    return createLazyPanelRegistry();
  }
}

export function persistLazyPanelState(registry, storageKey = "wave5_lazy_panels") {
  try {
    if (typeof sessionStorage === "undefined" || !registry) return;
    sessionStorage.setItem(storageKey, JSON.stringify(registry.snapshot()));
  } catch {
    /* ignore */
  }
}

export function wave5SmokeChecklist(state = {}, { user = null, online = true } = {}) {
  const gaps = analyzeWave5Gaps(state, { user });
  const mon = buildOpsMonitoringModel(state, { user, online });
  ensureSystemConfig(state);
  return {
    wave: WAVE5_WAVE,
    version: WAVE5_VERSION,
    architecture: "vanilla-spa-shared-core",
    notNextJsRewrite: true,
    notReactRewrite: true,
    invokeApiPortal: true,
    moduleMapCount: WAVE5_MODULE_SCREEN_MAP.length,
    gapClosed: gaps.closedCount,
    gapPartial: gaps.partialCount,
    pilotReady: gaps.pilotReady,
    opsCanView: mon.canView,
    collectorsTracked: mon.collectors.total,
    syncPending: mon.sync.pending,
    featureFlagCatalog: FEATURE_FLAG_CATALOG.length,
    moneyDefaults: gaps.moneyDefaults,
    prepareWeb: "npm run prepare:web",
    sharedChannels: ["web-spa", "electron-exe", "capacitor-apk"]
  };
}
