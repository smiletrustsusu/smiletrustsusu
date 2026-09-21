/**
 * Wave 5 — Admin portal panels (Audit / Reports / Backup surfaces).
 * No new top-level nav. Vanilla HTML via shared primitives.
 */

import {
  stPanel,
  stStatGrid,
  stMuted,
  stAlert,
  stEscape,
  stTable,
  stLazyPanel,
  stSearchField,
  stFilterBar,
  stSrOnly,
  stMoneyStat
} from "./shared-primitives.js";

function escapeHtml(value) {
  return stEscape(value);
}

/**
 * Ops monitoring under Audit / Reports — collector presence, sync queue, health, audit tail.
 */
export function renderOpsMonitoringPanel(model = {}) {
  if (!model.canView) {
    return stPanel({
      title: "Operations monitoring",
      body: stMuted("Requires Monitor.View, Sync.View, Audit.View, or Reports.View.")
    });
  }

  const collectors = model.collectors?.rows || [];
  const audit = model.auditTail || [];
  const sync = model.sync || {};
  const health = model.health || {};
  const today = model.collectionsToday || {};

  const body = `
    ${stMuted("Wave 5 ops monitoring — shared SPA portal (not a Next.js rewrite). Sync uses Wave 4 / invokeApi; money stays integer pesewas.")}
    ${stSrOnly("Operations monitoring summarises collector presence, sync queue, device health, and recent audit events.")}
    ${stStatGrid([
      { label: "Network", value: model.network || "—" },
      { label: "Collectors online", value: `${model.collectors?.online ?? 0} / ${model.collectors?.total ?? 0}` },
      { label: "Sync pending", value: sync.pending ?? 0 },
      { label: "Health", value: `${health.status || "—"} · ${health.score ?? 0}` }
    ])}
    <div class="grid four" style="margin-top:10px" role="group" aria-label="Collections and sync detail">
      ${stMoneyStat({ label: "Collections today", valueLabel: today.totalGhsLabel || "GHS 0.00", hint: `${today.count || 0} receipts` })}
      <div class="stat"><small>Pending collection sync</small><strong>${sync.pendingCollections ?? 0}</strong></div>
      <div class="stat"><small>Conflicts</small><strong>${sync.conflicts ?? 0}</strong></div>
      <div class="stat"><small>Devices offline</small><strong>${health.offlineDevices ?? 0} / ${health.devices ?? 0}</strong></div>
    </div>
    <p class="muted" style="margin-top:8px">Sync stage: ${escapeHtml(sync.stage || "—")} · Engine ${escapeHtml(sync.engineStatus || "idle")} · Progress ${Number(sync.progressPct || 0)}%</p>
    ${stLazyPanel({
      id: "wave5-collectors",
      title: "Collector presence",
      open: false,
      body: collectors.length ? stTable({
        columns: [
          { key: "name", label: "Collector" },
          { key: "status", label: "Status" },
          { key: "pendingSync", label: "Pending sync" },
          { key: "lastSeenAt", label: "Last seen" }
        ],
        rows: collectors.map((c) => ({
          name: c.name,
          status: c.status,
          pendingSync: c.pendingSync,
          lastSeenAt: (c.lastSeenAt || "—").slice(0, 19).replace("T", " ")
        }))
      }) : stMuted("No active collectors.")
    })}
    ${stLazyPanel({
      id: "wave5-audit-tail",
      title: "Recent audit",
      open: false,
      body: audit.length ? stTable({
        columns: [
          { key: "at", label: "Time" },
          { key: "action", label: "Action" },
          { key: "detail", label: "Detail" }
        ],
        rows: audit.map((row) => ({
          at: new Date(row.at || row.createdAt || 0).toLocaleString(),
          action: row.action || "",
          detail: row.detail || row.details || ""
        }))
      }) : stMuted("No recent audit rows.")
    })}
    <div class="row-actions" style="margin-top:12px">
      <button class="btn secondary" type="button" id="wave5RefreshOpsBtn" aria-label="Refresh operations monitoring">Refresh ops</button>
      <button class="btn ghost" type="button" id="wave5RefreshKpisBtn" aria-label="Refresh dashboard KPIs via API">Refresh API KPIs</button>
      <button class="btn ghost" type="button" id="wave5RunSearchBtn" aria-label="Open global portal search">Global search</button>
    </div>
  `;

  return stPanel({ title: "Operations monitoring", body });
}

/**
 * API-backed KPI strip for Reports (pesewas-preserving labels).
 */
export function renderPortalApiKpiStrip(kpis = {}) {
  const daily = kpis.dailyCollections || {};
  const money = kpis.moneyDefaults || {};
  const interest = money.loanInterest ?? money.interest ?? 15;
  const days = money.collectionDays ?? 31;
  const cashier = money.cashierLimitGhs ?? 1000;
  return stPanel({
    title: "Portal API KPIs",
    body: `
      ${stMuted("Sourced via Wave 3 invokeApi (dashboards / collections.daily / configuration.moneyDefaults). Not a separate HTTP BFF.")}
      ${stStatGrid([
        { label: "Daily collections", value: daily.totalGhsLabel || "GHS 0.00" },
        { label: "Receipts today", value: daily.count ?? 0 },
        { label: "Interest default", value: `${interest}%` },
        { label: "Collection days", value: days }
      ])}
      ${stAlert({
        tone: "info",
        message: `Cashier float limit GHS ${cashier} · Source ${kpis.source || "invokeApi"} · ${kpis.ok === false ? "Some API reads failed — showing available fields." : "API reads OK."}`
      })}
      <div id="wave5KpiDetail" class="muted" style="margin-top:8px" aria-live="polite"></div>
    `
  });
}

/**
 * Global / advanced search panel (Audit or Reports).
 */
export function renderPortalGlobalSearchPanel({ query = "", filters = {}, results = null, canSearch = true } = {}) {
  if (!canSearch) return "";
  const body = `
    ${stMuted("Search customers via invokeApi (v1/customers.search). Loans, collections, and groups use scoped local filters with branch/tenant isolation.")}
    <form id="wave5GlobalSearchForm" class="form-grid" role="search" aria-label="Portal global search">
      ${stSearchField({ id: "wave5SearchQ", name: "q", label: "Search", value: query, placeholder: "Name, phone, account, receipt, loan id" })}
      ${stFilterBar({
        fields: [
          { name: "branchId", label: "Branch id", value: filters.branchId || "" },
          { name: "status", label: "Status", value: filters.status || "", type: "text" }
        ]
      })}
      <div class="form-actions full">
        <button class="btn" type="submit">Search</button>
      </div>
    </form>
    ${results ? renderSearchResults(results) : stMuted("Enter a query to search.")}
  `;
  return stPanel({ title: "Portal global search", body });
}

function renderSearchResults(results = {}) {
  const blocks = [];
  if (results.customers?.length) {
    blocks.push(`<h3>Customers (${results.customers.length})</h3>${stTable({
      columns: [{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "accountNo", label: "Account" }],
      rows: results.customers.map((c) => ({ name: c.name, phone: c.phone || "", accountNo: c.accountNo || c.customerNumber || "" }))
    })}`);
  }
  if (results.loans?.length) {
    blocks.push(`<h3>Loans (${results.loans.length})</h3>${stTable({
      columns: [{ key: "id", label: "Loan" }, { key: "status", label: "Status" }, { key: "customerId", label: "Customer" }],
      rows: results.loans.map((l) => ({ id: l.id, status: l.status || "", customerId: l.customerId || "" }))
    })}`);
  }
  if (results.collections?.length) {
    blocks.push(`<h3>Collections (${results.collections.length})</h3>${stTable({
      columns: [{ key: "receiptNo", label: "Receipt" }, { key: "date", label: "Date" }, { key: "customerId", label: "Customer" }],
      rows: results.collections.map((c) => ({ receiptNo: c.receiptNo || c.id, date: c.date || "", customerId: c.customerId || "" }))
    })}`);
  }
  if (results.groups?.length) {
    blocks.push(`<h3>Groups (${results.groups.length})</h3>${stTable({
      columns: [{ key: "name", label: "Name" }, { key: "code", label: "Code" }],
      rows: results.groups.map((g) => ({ name: g.name || "", code: g.code || "" }))
    })}`);
  }
  if (!blocks.length) {
    return stMuted(results.q ? `No hits for “${results.q}”.` : "No results.");
  }
  return `<div class="wave5-search-results" style="margin-top:12px" aria-live="polite">${blocks.join("")}</div>`;
}

/**
 * Gap / completeness checklist panel (Audit).
 */
export function renderAdminPortalChecklist(gaps = {}) {
  const items = gaps.items || [];
  const body = `
    ${stMuted("Wave 5 = SPA admin portal hardening on the shared vanilla JS core (Web / Electron / Capacitor). Next.js rewrite is out of scope.")}
    ${stStatGrid([
      { label: "Closed", value: gaps.closedCount ?? 0 },
      { label: "Partial", value: gaps.partialCount ?? 0 },
      { label: "Pilot ready", value: gaps.pilotReady ? "Yes" : "No" },
      { label: "Architecture", value: "SPA shared core" }
    ])}
    <div class="table-wrap" style="margin-top:10px">
      <table>
        <thead><tr><th>ID</th><th>Item</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHtml(item.id)}</td>
              <td>${escapeHtml(item.title)}${item.note ? ` <span class="muted">(${escapeHtml(item.note)})</span>` : ""}</td>
              <td>${escapeHtml(item.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return stPanel({ title: "Wave 5 admin portal checklist", body });
}

/**
 * Module → screen map (compact, for Audit docs surface).
 */
export function renderModuleScreenMap(rows = []) {
  return stLazyPanel({
    id: "wave5-module-map",
    title: "Module → SPA screen map",
    open: false,
    body: stTable({
      columns: [
        { key: "area", label: "Area" },
        { key: "spaView", label: "SPA view" },
        { key: "notes", label: "Notes" }
      ],
      rows: (rows || []).map((r) => ({
        area: r.area,
        spaView: r.spaView,
        notes: r.notes || ""
      }))
    })
  });
}
