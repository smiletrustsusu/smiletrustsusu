/**
 * Role-based dashboard markup. Pure HTML from a precomputed model.
 */
import { formatGhs } from "../core/money.js";
import { DASHBOARD_WIDGETS } from "../core/dashboard-analytics.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount) {
  return formatGhs(amount);
}

function changeChip(change = {}) {
  const tone = change.direction === "up" ? "up" : change.direction === "down" ? "down" : "flat";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "●";
  return `<span class="dash-change dash-change-${tone}">${arrow} ${escapeHtml(change.label || "vs yesterday")}</span>`;
}

function lineChart(rows, key = "collections") {
  if (!rows.length) return `<div class="empty">No chart data yet.</div>`;
  const width = 640;
  const height = 200;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const max = Math.max(1, ...rows.map((row) => Number(row[key] ?? row.amount || 0)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const point = (index, value) => ({
    x: pad.left + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW),
    y: pad.top + innerH - (Number(value) / max) * innerH
  });
  const path = rows.map((row, index) => {
    const { x, y } = point(index, row[key] ?? row.amount);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const labels = rows.filter((_, index) => index % Math.ceil(rows.length / 6) === 0);
  return `
    <svg class="dash-line-chart" viewBox="0 0 ${width} ${height}" role="img">
      <path d="${path}" class="dash-line collections"></path>
      ${labels.map((row) => {
        const index = rows.indexOf(row);
        const { x } = point(index, 0);
        return `<text x="${x}" y="${height - 6}" class="dash-axis-label" text-anchor="middle">${escapeHtml(row.label)}</text>`;
      }).join("")}
    </svg>
  `;
}

function barChart(rows) {
  if (!rows.length) return `<div class="empty">No chart data yet.</div>`;
  const max = Math.max(1, ...rows.map((row) => Number(row.amount || 0)));
  return `
    <div class="dash-bar-chart">
      ${rows.map((row) => `
        <div class="dash-bar-row">
          <div class="dash-bar-label" title="${escapeHtml(row.label || row.name)}">${escapeHtml(row.label || row.name)}</div>
          <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${((Number(row.amount || 0) / max) * 100).toFixed(1)}%"></div></div>
          <div class="dash-bar-value">${money(row.amount)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function pieChart(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (!total) return `<div class="empty">No product mix yet.</div>`;
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const start = cursor;
    cursor += (Number(row.amount || 0) / total) * 360;
    const colors = ["#0d7a63", "#d29b25", "#2d6ea3", "#8d2450", "#49545a", "#2f6b2f"];
    return `${colors[index % colors.length]} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`;
  });
  return `
    <div class="dash-pie-wrap">
      <div class="dash-pie" style="background:conic-gradient(${stops.join(",")})"></div>
      <ul class="dash-pie-legend">
        ${rows.map((row) => `<li><span>${escapeHtml(row.label)}</span><strong>${money(row.amount)}</strong></li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSearch(model) {
  return `
    <div class="panel dash-search-panel" data-widget="search">
      <div class="dash-search-grid">
        <form id="dashCustomerSearch" class="dash-search-form">
          <label>Customer search</label>
          <input id="dashCustomerQuery" placeholder="Name, number, phone, Ghana Card, account" autocomplete="off" />
        </form>
        <form id="dashGroupSearch" class="dash-search-form">
          <label>Group search</label>
          <input id="dashGroupQuery" placeholder="Group name, code, leader, agent" autocomplete="off" />
        </form>
      </div>
      <div id="dashSearchResults" class="dash-search-results"></div>
    </div>
  `;
}

function renderCards(model) {
  return `
    <div class="kpi-grid dash-kpi-grid" data-widget="summaryCards">
      ${model.cards.map((card) => `
        <button type="button" class="kpi-card kpi-clickable" data-view-jump="${card.jump || "dashboard"}" ${card.filter ? `data-nav-filter="${card.filter}"` : ""}>
          <div class="kpi-icon">${card.icon}</div>
          <small>${escapeHtml(card.label)}</small>
          <strong>${card.money ? money(card.value) : card.value}</strong>
          ${changeChip(card.change)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderQuickActions(model) {
  const pinned = new Set(model.prefs.pinnedActions || []);
  const actions = [...model.quickActions].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
  return `
    <div class="panel" data-widget="quickActions">
      <div class="section-title"><h2>Quick Actions</h2></div>
      <div class="dash-actions">
        ${actions.map((action) => `
          <button type="button" class="dash-action-btn ${pinned.has(action.id) ? "pinned" : ""}" data-view-jump="${action.jump}">
            ${escapeHtml(action.label)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderOffline(model) {
  return `
    <div class="panel dash-offline ${model.offline.online ? "" : "is-offline"}" data-widget="offline">
      <div class="section-title"><h2>Offline Sync</h2><span class="pill ${model.offline.online ? "" : "bad"}">${model.offline.online ? "Online" : "Offline"}</span></div>
      <div class="calc-list">
        <div><span>Unsynchronized transactions</span><strong>${model.offline.pending}</strong></div>
        <div><span>Last synchronization</span><strong>${escapeHtml(model.offline.lastSync ? new Date(model.offline.lastSync).toLocaleString() : "Never")}</strong></div>
      </div>
      <button class="btn" type="button" id="dashSyncNow">Sync Now</button>
    </div>
  `;
}

function renderAgentToday(model) {
  const collector = model.collector;
  if (!collector) return "";
  return `
    <div class="panel" data-widget="agentToday">
      <div class="section-title"><h2>Today's Route</h2></div>
      <div class="calc-list">
        <div><span>Assigned customers</span><strong>${collector.assignedCustomers}</strong></div>
        <div><span>Amount collected</span><strong>${money(collector.collectionsToday)}</strong></div>
        <div><span>Collection target</span><strong>${money(collector.expectedTotal)}</strong></div>
        <div><span>Outstanding customers</span><strong>${collector.missedCount}</strong></div>
        <div><span>Daily commission</span><strong>${money(collector.commission || 0)}</strong></div>
        <div><span>Target achievement</span><strong>${collector.progressPercent}%</strong></div>
      </div>
      <div class="form-actions"><button class="btn" type="button" data-view-jump="collections">Collect Savings</button></div>
    </div>
  `;
}

function renderCso(model) {
  return `
    <div class="panel" data-widget="cso">
      <div class="section-title"><h2>Customer Service</h2></div>
      <div class="calc-list">
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="customers"><span>New customers today</span><strong>${model.cso.newCustomers}</strong></div>
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="customers"><span>Pending verifications</span><strong>${model.cso.pendingVerifications}</strong></div>
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="withdrawals"><span>Customer requests</span><strong>${model.cso.requests}</strong></div>
      </div>
    </div>
  `;
}

function renderFinancial(model) {
  const f = model.financial;
  return `
    <div class="panel" data-widget="financial">
      <div class="section-title"><h2>Financial Summary</h2></div>
      <div class="calc-list">
        <div><span>Total savings collected today</span><strong>${money(f.today)}</strong></div>
        <div><span>Weekly collections</span><strong>${money(f.weekly)}</strong></div>
        <div><span>Monthly collections</span><strong>${money(f.monthly)}</strong></div>
        <div><span>Annual collections</span><strong>${money(f.annual)}</strong></div>
        <div><span>Total loans issued</span><strong>${money(f.loansIssued)}</strong></div>
        <div><span>Total loan repayments</span><strong>${money(f.repayments)}</strong></div>
        <div><span>Outstanding loan portfolio</span><strong>${money(f.outstanding)}</strong></div>
        <div><span>Total withdrawals</span><strong>${money(f.withdrawals)}</strong></div>
        <div><span>Total expenses</span><strong>${money(f.expenses)}</strong></div>
        <div><span>Net cash position</span><strong>${money(f.netCash)}</strong></div>
      </div>
    </div>
  `;
}

function renderCharts(model) {
  return `
    <div class="dash-charts" data-widget="charts">
      <div class="panel">
        <div class="section-title"><h2>Daily Collection Trend</h2><span class="muted">Last 30 days</span></div>
        ${lineChart(model.trends.daily)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Weekly Collection Trend</h2></div>
        ${barChart(model.trends.weekly)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Monthly Revenue</h2></div>
        ${barChart(model.trends.monthly)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Savings Product Distribution</h2></div>
        ${pieChart(model.trends.products)}
      </div>
    </div>
  `;
}

function renderLoans(model) {
  const p = model.loanPortfolio;
  return `
    <div class="panel" data-widget="loans">
      <div class="section-title"><h2>Loan Portfolio</h2><button class="btn ghost" type="button" data-view-jump="loans">Open loans</button></div>
      <div class="dash-loan-grid">
        <button type="button" class="dash-mini" data-view-jump="loans"><small>Active</small><strong>${p.active}</strong></button>
        <button type="button" class="dash-mini" data-view-jump="loans"><small>Completed</small><strong>${p.completed}</strong></button>
        <button type="button" class="dash-mini" data-view-jump="loans"><small>Overdue</small><strong>${p.overdue}</strong></button>
        <button type="button" class="dash-mini" data-view-jump="loans"><small>Pending</small><strong>${p.pending}</strong></button>
      </div>
    </div>
  `;
}

function renderBranches(model) {
  return `
    <div class="panel" data-widget="branches">
      <div class="section-title"><h2>Branch Performance</h2><button class="btn ghost" type="button" data-view-jump="groups">Branches</button></div>
      ${model.branchRows.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Branch</th><th>Collections</th><th>Active customers</th><th>Loan recovery</th><th>Revenue</th></tr></thead>
          <tbody>
            ${model.branchRows.slice(0, 8).map((row) => `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${money(row.collections)}</td>
                <td>${row.activeCustomers}</td>
                <td>${money(row.loanRecovery)}</td>
                <td>${money(row.revenue)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table></div>` : `<div class="empty">No branch activity yet.</div>`}
    </div>
  `;
}

function renderAgents(model) {
  return `
    <div class="panel" data-widget="agents">
      <div class="section-title"><h2>Agent Performance</h2><button class="btn ghost" type="button" data-view-jump="users">Agents</button></div>
      ${model.agentRows.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Top collectors</th><th>Collected</th><th>Customers</th><th>Target</th><th>Commission</th></tr></thead>
          <tbody>
            ${model.agentRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${money(row.collected)}</td>
                <td>${row.assignedCustomers}</td>
                <td>${row.achievementPercent}%</td>
                <td>${money(row.commission)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table></div>` : `<div class="empty">No collector totals yet.</div>`}
    </div>
  `;
}

function renderKpis(model) {
  const k = model.kpis;
  return `
    <div class="panel" data-widget="kpis">
      <div class="section-title"><h2>Performance Indicators</h2></div>
      <div class="dash-kpi-strip">
        <div><small>Collection rate</small><strong>${k.collectionRate}%</strong></div>
        <div><small>Loan recovery</small><strong>${k.recoveryRate}%</strong></div>
        <div><small>Active customers</small><strong>${k.activeCustomers}</strong></div>
        <div><small>Dormant customers</small><strong>${k.dormantCustomers}</strong></div>
        <div><small>Avg daily collection</small><strong>${money(k.averageDaily)}</strong></div>
        <div><small>Top branch</small><strong>${escapeHtml(k.branchRank)}</strong></div>
        <div><small>Top agent</small><strong>${escapeHtml(k.agentRank)}</strong></div>
        <div><small>Customer growth</small><strong>${k.growth}%</strong></div>
        <div><small>Profit margin</small><strong>${k.profitMargin}%</strong></div>
      </div>
    </div>
  `;
}

function renderCash(model) {
  const c = model.cash;
  return `
    <div class="panel" data-widget="cash">
      <div class="section-title"><h2>Cash Position</h2><button class="btn ghost" type="button" data-view-jump="handover">Handover</button></div>
      <div class="calc-list">
        <div><span>Cash in office</span><strong>${money(c.office)}</strong></div>
        <div><span>Cash with agents</span><strong>${money(c.agents)}</strong></div>
        <div><span>Cash in bank</span><strong>${money(c.bank)}</strong></div>
        <div><span>Mobile money balance</span><strong>${money(c.momo)}</strong></div>
        <div><span>Expected cash</span><strong>${money(c.expected)}</strong></div>
        <div><span>Actual cash</span><strong>${money(c.actual)}</strong></div>
        <div><span>Cash difference</span><strong class="${c.difference ? "text-danger" : ""}">${money(c.difference)}</strong></div>
      </div>
    </div>
  `;
}

function renderPending(model) {
  return `
    <div class="panel" data-widget="pending">
      <div class="section-title"><h2>Pending Tasks</h2><button class="btn ghost" type="button" data-view-jump="approvals">View all</button></div>
      ${model.pendingTasks.length ? `
        <div class="dash-task-list">
          ${model.pendingTasks.map((task) => `
            <button type="button" class="dash-task" data-view-jump="${task.jump}">
              <span>${escapeHtml(task.label)}</span>
              <strong>${task.count}</strong>
            </button>
          `).join("")}
        </div>` : `<div class="empty">No pending tasks.</div>`}
    </div>
  `;
}

function renderActivity(model) {
  return `
    <div class="panel" data-widget="activity">
      <div class="section-title"><h2>Recent Activities</h2><button class="btn ghost" type="button" data-view-jump="audit">Audit</button></div>
      ${model.activities.length ? `
        <div class="dash-activity">
          ${model.activities.map((row) => `
            <article>
              <strong>${escapeHtml(row.action)}</strong>
              <p>${escapeHtml(row.detail)}</p>
              <small>${escapeHtml(row.user)} · ${escapeHtml(row.date || "")} ${escapeHtml(row.time || "")} ${row.branch ? `· ${escapeHtml(row.branch)}` : ""}</small>
            </article>
          `).join("")}
        </div>` : `<div class="empty">No recent activity.</div>`}
    </div>
  `;
}

function renderCalendar(model) {
  return `
    <div class="panel" data-widget="calendar">
      <div class="section-title"><h2>Today's Calendar</h2><button class="btn ghost" type="button" data-view-jump="meetings">Meetings</button></div>
      ${model.calendar.length ? `<ul class="dash-calendar">${model.calendar.map((item) => `<li><span class="pill">${escapeHtml(item.type)}</span> ${escapeHtml(item.title)}</li>`).join("")}</ul>` : `<div class="empty">No meetings, dues, or birthdays today.</div>`}
    </div>
  `;
}

function renderSystem(model) {
  const s = model.system;
  return `
    <div class="panel" data-widget="system">
      <div class="section-title"><h2>System Status</h2></div>
      <div class="calc-list">
        <div><span>Database</span><strong>${escapeHtml(s.database)}</strong></div>
        <div><span>Internet</span><strong>${escapeHtml(s.internet)}</strong></div>
        <div><span>Synchronization</span><strong>${escapeHtml(s.sync === "Never" ? "Never" : new Date(s.sync).toLocaleString())}</strong></div>
        <div><span>Backup</span><strong>${escapeHtml(s.backup)}</strong></div>
        <div><span>Pending uploads</span><strong>${s.pendingUploads}</strong></div>
        <div><span>Application version</span><strong>${escapeHtml(s.version)}</strong></div>
      </div>
    </div>
  `;
}

const RENDERERS = {
  search: renderSearch,
  summaryCards: renderCards,
  quickActions: renderQuickActions,
  offline: renderOffline,
  agentToday: renderAgentToday,
  cso: renderCso,
  financial: renderFinancial,
  charts: renderCharts,
  loans: renderLoans,
  branches: renderBranches,
  agents: renderAgents,
  kpis: renderKpis,
  cash: renderCash,
  pending: renderPending,
  activity: renderActivity,
  calendar: renderCalendar,
  system: renderSystem
};

export function renderDashboardCustomize(model) {
  const hidden = new Set(model.prefs.hiddenWidgets || []);
  return `
    <details class="dash-customize">
      <summary>Customize dashboard</summary>
      <div class="dash-customize-grid">
        ${DASHBOARD_WIDGETS.filter((widget) => widget.roles.includes("*") || widget.roles.includes(model.role)).map((widget) => `
          <label><input type="checkbox" data-dash-widget="${widget.id}" ${hidden.has(widget.id) ? "" : "checked"} /> ${escapeHtml(widget.label)}</label>
        `).join("")}
      </div>
      <p class="muted">Unchecked widgets are hidden for this account only.</p>
    </details>
  `;
}

export function renderDashboardHome(model, { title = "Dashboard", hint = "", branchLabel = "", clock = "" } = {}) {
  const widgets = model.widgets.map((widget) => RENDERERS[widget.id]?.(model) || "").join("");
  return `
    <div class="dash-home" id="dashHome">
      <div class="dash-header panel">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <div class="muted">${escapeHtml(branchLabel)}</div>
          <div class="muted">${escapeHtml(hint)}</div>
        </div>
        <div class="dash-header-meta">
          <div><small>Business date</small><strong>${escapeHtml(model.date)}</strong></div>
          <div><small>Local time</small><strong id="dashClock">${escapeHtml(clock)}</strong></div>
        </div>
      </div>
      ${renderDashboardCustomize(model)}
      ${widgets}
    </div>
  `;
}

export function renderSearchResults({ customers = [], groups = [] } = {}) {
  if (!customers.length && !groups.length) return `<div class="empty">No matches.</div>`;
  return `
    ${customers.length ? `<div class="dash-result-block"><small>Customers</small>${customers.map((item) => `
      <button type="button" class="dash-result" data-open-customer="${item.id}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.accountNo || item.customerNumber || "")} · ${escapeHtml(item.phone || "")}</span>
      </button>`).join("")}</div>` : ""}
    ${groups.length ? `<div class="dash-result-block"><small>Groups</small>${groups.map((item) => `
      <button type="button" class="dash-result" data-view-jump="susuGroups">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.code || "")}</span>
      </button>`).join("")}</div>` : ""}
  `;
}

export function renderNotificationDrawer(items = []) {
  if (!items.length) return `<div class="empty">No notifications.</div>`;
  return items.slice(0, 12).map((item) => `
    <article class="dash-note ${item.read ? "is-read" : ""}" data-note-id="${item.id}">
      <strong>${escapeHtml(item.title || item.event)}</strong>
      <p>${escapeHtml(item.body || "")}</p>
      <div class="row-actions">
        ${item.read ? "" : `<button type="button" class="btn ghost" data-note-read="${item.id}">Mark as read</button>`}
        <button type="button" class="btn ghost" data-note-delete="${item.id}">Delete</button>
      </div>
    </article>
  `).join("");
}
