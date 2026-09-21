/**
 * Monitoring extras. Existing Backup, scheduler, dashboard KPIs, and collection math stay as they are.
 */

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

function rowsOrEmpty(rows, empty, render) {
  if (!rows?.length) return `<div class="empty">${empty}</div>`;
  return render(rows);
}

export function renderMonitoringBackupExtras({
  stats = {},
  domains = [],
  alerts = [],
  incidents = [],
  devices = [],
  logs = [],
  traces = [],
  forecast = {},
  business = {},
  detail = null,
  query = "",
  canView = false,
  canAlert = false,
  canIncident = false,
  canDiagnose = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Operations center</h2></div>
      <p class="muted">Backup and scheduler above stay as they are. This engine watches queues, workers, payments, sync, and Android devices. It does not post collections or read private phone content.</p>
      <div class="grid four">
        <div class="stat"><small>System</small><strong>${escapeHtml(stats.status || "healthy")} · ${stats.score || 0}</strong></div>
        <div class="stat"><small>Open alerts</small><strong>${stats.openAlerts || 0}</strong></div>
        <div class="stat"><small>Incidents</small><strong>${stats.openIncidents || 0}</strong></div>
        <div class="stat"><small>Devices offline</small><strong>${stats.offlineDevices || 0} / ${stats.devices || 0}</strong></div>
      </div>
      <div class="grid four" style="margin-top:10px">
        <div class="stat"><small>Collections today</small><strong>${business.collectionsToday || 0}</strong></div>
        <div class="stat"><small>Payment success</small><strong>${Math.round((business.paymentSuccessRate || 1) * 100)}%</strong></div>
        <div class="stat"><small>Sync success</small><strong>${Math.round((business.synchronizationSuccessRate || 1) * 100)}%</strong></div>
        <div class="stat"><small>Forecast collections</small><strong>${forecast.next || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        <button class="btn secondary" type="button" id="monitorSnapshotBtn">Collect health snapshot</button>
        <button class="btn ghost" type="button" id="monitorFlushBtn">Flush offline telemetry</button>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Health explorer</h2></div>
        ${rowsOrEmpty(domains, "No health domains yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Domain</th><th>Status</th><th>Score</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.name || item.domain)}</td><td>${escapeHtml(item.status)}</td><td>${item.score || 0}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Alert console</h2></div>
        ${rowsOrEmpty(alerts.filter((item) => !["resolved", "closed"].includes(item.status)).slice(-12).reverse(), "No open alerts.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Alert</th><th>Severity</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.severity)}</td>
                    <td>${canAlert ? `<button class="btn ghost" type="button" data-monitor-ack="${escapeAttr(item.id)}">Ack</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
        <div class="section-title" style="margin-top:16px"><h2>Incidents</h2></div>
        ${rowsOrEmpty(incidents.slice(-8).reverse(), "No incidents.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.title)}</td>
                    <td>${escapeHtml(item.status)}</td>
                    <td>${canIncident && item.status === "detected" ? `<button class="btn ghost" type="button" data-monitor-classify="${escapeAttr(item.id)}">Classify</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Android devices</h2></div>
        ${rowsOrEmpty(devices.slice(-20).reverse(), "No device health reports yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Device</th><th>Status</th><th>Ready</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.name || item.deviceId)}</td>
                    <td>${escapeHtml(item.operationalStatus || "")}</td>
                    <td>${item.readiness || 0}</td>
                    <td>
                      <button class="btn ghost" type="button" data-monitor-device="${escapeAttr(item.deviceId)}">Details</button>
                      ${canDiagnose ? `<button class="btn ghost" type="button" data-monitor-diag="${escapeAttr(item.deviceId)}">Diagnose</button>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Log explorer</h2></div>
        <form id="monitorLogSearchForm" class="form-grid">
          <div class="field"><label>Search logs</label><input name="q" value="${escapeAttr(query)}" placeholder="Correlation, service, message" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Search</button></div>
        </form>
        ${rowsOrEmpty(logs.slice(-12).reverse(), "No logs captured.", (rows) => `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Level</th><th>Service</th><th>Message</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.level)}</td><td>${escapeHtml(item.service)}</td><td>${escapeHtml(item.message)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        <div class="section-title" style="margin-top:16px"><h2>Traces</h2></div>
        ${rowsOrEmpty(traces.slice(-8).reverse(), "No traces yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Path</th><th>Status</th><th>ms</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.path || item.correlationId || "")}</td><td>${escapeHtml(item.status)}</td><td>${item.durationMs || 0}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
    ${detail ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Device detail</h2></div>
        <div class="calc-list">
          <div><span>Device</span><strong>${escapeHtml(detail.deviceId)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(detail.operationalStatus || "")}</strong></div>
          <div><span>Readiness</span><strong>${detail.readiness || 0} · ${escapeHtml(detail.readinessLabel || "")}</strong></div>
          <div><span>App version</span><strong>${escapeHtml(detail.appVersion || "")}</strong></div>
          <div><span>Last seen</span><strong>${escapeHtml(String(detail.lastSeenAt || "").replace("T", " ").slice(0, 19))}</strong></div>
        </div>
        <p class="muted" style="margin-top:8px">Remote diagnostics never include customer balances, PINs, or private phone content.</p>
      </div>
    ` : ""}
  `;
}

export function renderMonitoringExecutiveExtras({ stats = {}, canView = false } = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>System health</h2></div>
      <p class="muted">Business cards above are unchanged. Health scores come from the monitoring engine.</p>
      <div class="grid four">
        <div class="stat"><small>Status</small><strong>${escapeHtml(stats.status || "healthy")}</strong></div>
        <div class="stat"><small>Score</small><strong>${stats.score || 0}</strong></div>
        <div class="stat"><small>Critical alerts</small><strong>${stats.criticalAlerts || 0}</strong></div>
        <div class="stat"><small>Open incidents</small><strong>${stats.openIncidents || 0}</strong></div>
      </div>
    </div>
  `;
}

export function renderMonitoringReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Monitoring reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-monitor-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
