/**
 * Extra BI panels on the existing Reports screen. Does not replace Cash In / ledger tables.
 */
import { formatGhs } from "../core/money.js";
import { REPORT_CATALOG, CUSTOM_SOURCES } from "../core/report-ops.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function money(amount) {
  return formatGhs(amount);
}

function optionList(items, selected) {
  return items.map((item) => {
    const value = item.id ?? item.value ?? item;
    const label = item.name ?? item.label ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function renderBiDashboardCards(dash = {}) {
  return `
    <div class="grid four" style="margin-top:18px">
      <div class="stat"><small>Today's Collections</small><strong>${money(dash.todayCollections || 0)}</strong></div>
      <div class="stat"><small>Today's Withdrawals</small><strong>${money(dash.todayWithdrawals || 0)}</strong></div>
      <div class="stat"><small>Active Customers</small><strong>${dash.activeCustomers || 0}</strong></div>
      <div class="stat"><small>Active Groups</small><strong>${dash.activeGroups || 0}</strong></div>
      <div class="stat"><small>Active Loans</small><strong>${dash.activeLoans || 0}</strong></div>
      <div class="stat"><small>Outstanding Loans</small><strong>${money(dash.outstandingLoans || 0)}</strong></div>
      <div class="stat"><small>Total Savings (GL)</small><strong>${money(dash.totalSavings || 0)}</strong></div>
      <div class="stat"><small>Cash Position (GL)</small><strong>${money(dash.cashPosition || 0)}</strong></div>
      <div class="stat"><small>Revenue (GL)</small><strong>${money(dash.revenue || 0)}</strong></div>
      <div class="stat"><small>Expenses (GL)</small><strong>${money(dash.expenses || 0)}</strong></div>
      <div class="stat"><small>Net Position (GL)</small><strong>${money(dash.netPosition || 0)}</strong></div>
      <div class="stat"><small>PAR ${dash.par?.rate != null ? dash.par.rate : 0}%</small><strong>${money(dash.par?.pastDue || 0)}</strong></div>
    </div>
  `;
}

export function renderBiKpiStrip(dash = {}) {
  return `
    <div class="calc-list" style="margin-top:12px">
      <div><span>Collection success rate</span><strong>${dash.collectionSuccessRate || 0}%</strong></div>
      <div><span>Loan recovery rate</span><strong>${dash.loanRecoveryRate || 0}%</strong></div>
      <div><span>Customer growth (period)</span><strong>${dash.customerGrowth || 0}</strong></div>
    </div>
  `;
}

export function renderCollectionTrend(series = []) {
  if (!series.length) return `<div class="empty">No posted collections in this period for the trend chart.</div>`;
  const max = Math.max(...series.map((item) => item.amount), 1);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Posted collections</th><th></th></tr></thead>
        <tbody>
          ${series.map((item) => `
            <tr data-drill-date="${escapeAttr(item.date)}">
              <td>${escapeHtml(item.date)}</td>
              <td>${money(item.amount)}</td>
              <td><div style="height:8px;background:#0f766e;width:${Math.round((item.amount / max) * 100)}%"></div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderReportCatalog(selected = "collections_daily", canAccounting = false, canExecutive = false, selectId = "biReportSelect") {
  const items = REPORT_CATALOG.filter((item) => {
    if (item.kind === "financial" && !canAccounting) return false;
    if (item.action === "Reports.Executive" && !canExecutive) return false;
    return true;
  });
  return `<select name="reportId" id="${escapeAttr(selectId)}">${optionList(items, selected)}</select>`;
}

export function renderReportResult(result) {
  if (!result) return `<div class="empty">Choose a report and generate.</div>`;
  if (result.error) return `<div class="notice warn">${escapeHtml(result.error)}</div>`;
  const rows = result.rows || [];
  const columns = result.columns || [];
  if (!rows.length) return `<div class="empty">No rows for this report and filter set.</div>`;
  return `
    <div class="muted">Showing ${rows.length} of ${result.total || rows.length} · page ${result.page || 1}/${result.pages || 1} · ${escapeHtml(result.source || result.kind || "")}</div>
    <div class="table-wrap" style="margin-top:8px">
      <table>
        <thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(formatCell(row[col]))}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatCell(value) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : formatGhs(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderCustomBuilder(canCustom = false) {
  if (!canCustom) return `<div class="notice">Custom reports require Reports.Custom permission.</div>`;
  const sources = Object.entries(CUSTOM_SOURCES).map(([id, item]) => ({ id, name: item.label }));
  return `
    <form id="customReportForm" class="form-grid">
      <div class="field"><label>Name</label><input name="name" placeholder="Branch collections" required /></div>
      <div class="field"><label>Source</label><select name="source">${optionList(sources, "collections")}</select></div>
      <div class="field"><label>Group by</label><input name="groupBy" placeholder="paymentMethod" /></div>
      <div class="field"><label>Sort</label><input name="sort" placeholder="date" /></div>
      <div class="field full"><label>Fields (comma)</label><input name="fields" placeholder="date,amount,receiptNo" /></div>
      <div class="form-actions full"><button class="btn secondary" type="submit">Run custom</button></div>
    </form>
  `;
}

export function renderScheduleForm(canSchedule = false, selected = "collections_daily", canAccounting = false, canExecutive = false) {
  if (!canSchedule) return `<div class="notice">Scheduling requires Reports.Schedule permission.</div>`;
  return `
    <form id="scheduleReportForm" class="form-grid">
      <div class="field"><label>Report</label>${renderReportCatalog(selected, canAccounting, canExecutive, "biScheduleSelect")}</div>
      <div class="field"><label>Frequency</label>
        <select name="frequency">
          <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Annual</option>
        </select>
      </div>
      <div class="field"><label>Delivery</label>
        <select name="delivery"><option>In-App</option><option>Email</option><option>Download Queue</option></select>
      </div>
      <div class="form-actions full"><button class="btn secondary" type="submit">Save schedule</button></div>
    </form>
  `;
}

export function renderReportHistory(rows = []) {
  if (!rows.length) return `<div class="empty">No generated reports yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Report</th><th>By</th><th>Rows</th><th>Format</th></tr></thead>
        <tbody>
          ${rows.slice(-12).reverse().map((item) => `
            <tr>
              <td>${escapeHtml(String(item.createdAt || "").replace("T", " ").slice(0, 16))}</td>
              <td>${escapeHtml(item.reportName || item.reportId)}</td>
              <td>${escapeHtml(item.userId || "")}</td>
              <td>${item.rowCount || 0}</td>
              <td>${escapeHtml(item.format || "view")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderBiReportsExtra({
  dash,
  series = [],
  catalogId = "collections_daily",
  result,
  history = [],
  canAccounting = false,
  canExecutive = false,
  canCustom = false,
  canSchedule = false,
  canExport = false,
  searchHits
} = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Business Intelligence</h2><span class="muted">Financial cards use the General Ledger</span></div>
      ${renderBiDashboardCards(dash)}
      ${renderBiKpiStrip(dash)}
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Posted collection trend</h2></div>
        ${renderCollectionTrend(series)}
        <p class="muted">Click a date row after generating Daily Collections to drill into receipts.</p>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Search</h2></div>
        <form id="biSearchForm" class="form-grid">
          <div class="field full"><label>Customer, agent, group, loan, receipt</label><input name="q" minlength="2" placeholder="Name or number" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Search</button></div>
        </form>
        ${searchHits ? renderSearchHits(searchHits) : ""}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Standard reports</h2>
        <div class="row-actions">
          ${canExport ? `<button class="btn ghost" type="button" id="biExportCsvBtn">Export CSV / Excel</button>` : ""}
          <button class="btn ghost" type="button" onclick="window.print()">Print</button>
        </div>
      </div>
      <form id="biReportForm" class="form-grid">
        <div class="field"><label>Report</label>${renderReportCatalog(catalogId, canAccounting, canExecutive)}</div>
        <div class="field"><label>Branch id</label><input name="branchId" placeholder="Optional" /></div>
        <div class="field"><label>Agent id</label><input name="agentId" placeholder="Optional" /></div>
        <div class="form-actions full"><button class="btn" type="submit">Generate</button></div>
      </form>
      <div id="biReportResult">${renderReportResult(result)}</div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Custom report</h2></div>
        ${renderCustomBuilder(canCustom)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Schedule</h2></div>
        ${renderScheduleForm(canSchedule, catalogId, canAccounting, canExecutive)}
        <div class="section-title" style="margin-top:16px"><h3>History</h3></div>
        ${renderReportHistory(history)}
      </div>
    </div>
  `;
}

function renderSearchHits(hits) {
  const block = (title, rows, label) => {
    if (!rows?.length) return "";
    return `<div class="notice">${escapeHtml(title)}: ${rows.map((item) => escapeHtml(label(item))).join(", ")}</div>`;
  };
  return `
    ${block("Customers", hits.customers, (item) => item.name)}
    ${block("Agents", hits.agents, (item) => item.name)}
    ${block("Groups", hits.groups, (item) => item.name)}
    ${block("Loans", hits.loans, (item) => item.id)}
    ${block("Receipts", hits.transactions, (item) => item.receiptNo || item.id)}
  `;
}
