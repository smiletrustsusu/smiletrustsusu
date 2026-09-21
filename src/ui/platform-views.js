/**
 * Platform Admin extras under existing Audit Log and Reports screens.
 * No new top-level navigation.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsOrEmpty(rows, empty, render) {
  if (!rows?.length) return `<div class="empty">${empty}</div>`;
  return render(rows);
}

export function renderPlatformAuditExtras({
  stats = {},
  tenants = [],
  licenses = [],
  flags = [],
  deployments = [],
  maintenance = [],
  environments = [],
  announcements = [],
  configHistory = [],
  dr = {},
  canView = false,
  canTenant = false,
  canFlag = false,
  canLicense = false,
  canDeploy = false,
  canMaintenance = false,
  canAdmin = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Platform Admin Dashboard</h2></div>
      <p class="muted">Module 30 governs tenants, flags, licenses, maintenance, and ops metadata. It does not post collections or duplicate Modules 1–29 business engines.</p>
      <div class="grid four">
        <div class="stat"><small>Tenants</small><strong>${stats.tenants?.active || 0}/${stats.tenants?.total || 0}</strong></div>
        <div class="stat"><small>Licenses active</small><strong>${stats.licenses?.active || 0}</strong></div>
        <div class="stat"><small>Flags on</small><strong>${stats.flags?.on || 0}</strong></div>
        <div class="stat"><small>Read-only maint.</small><strong>${stats.maintenance?.readOnly ? "Yes" : "No"}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canAdmin ? `<button class="btn secondary" type="button" id="platformOpsRefreshBtn">Refresh Ops Center</button>` : ""}
        ${canMaintenance ? `<button class="btn ghost" type="button" id="platformMaintScheduleBtn">Schedule maintenance</button>` : ""}
        ${canFlag ? `<button class="btn ghost" type="button" id="platformFlagEvalBtn">Evaluate sample flag</button>` : ""}
        ${canDeploy ? `<button class="btn ghost" type="button" id="platformDeployPlanBtn">Plan release</button>` : ""}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Tenant Console</h2></div>
        ${rowsOrEmpty(tenants.slice(0, 8), "No tenants.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${canTenant ? `<p class="muted" style="margin-top:8px">Logical isolation via tenantId on platform admin records.</p>` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>License Manager</h2></div>
        ${rowsOrEmpty(licenses.slice(0, 8), "No licenses.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Status</th><th>Expires</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${escapeHtml((item.expiresAt || "").slice(0, 10))}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${canLicense ? "" : ""}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Feature Flag Manager</h2></div>
        ${rowsOrEmpty(flags.slice(0, 10), "No flags.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Flag</th><th>On</th><th>Kill</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.id)}</td>
                  <td>${item.enabled !== false ? "yes" : "no"}</td>
                  <td>${item.killSwitch ? "KILL" : "—"}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Global Config Console</h2></div>
        ${rowsOrEmpty(configHistory.slice(0, 6), "No published config history.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.key)} v${escapeHtml(item.version)}`).join(" · ")}</p>
        `)}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Deployment Center</h2></div>
        ${rowsOrEmpty(deployments.slice(0, 6), "No deployments planned.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Version</th><th>Strategy</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.version)}</td>
                  <td>${escapeHtml(item.strategy)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Maintenance Manager</h2></div>
        ${rowsOrEmpty(maintenance.slice(0, 6), "No maintenance windows.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.title)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Ops Center</h2></div>
        <p class="muted">Monitoring alerts: ${escapeHtml(stats.monitoring?.openAlerts ?? "—")} · Integration providers: ${escapeHtml(stats.integration?.providers ?? 0)} · AI models: ${escapeHtml(stats.ai?.models ?? 0)}</p>
        <p class="muted">Payments stub completed/failed: ${escapeHtml(stats.payments?.completed ?? 0)}/${escapeHtml(stats.payments?.failed ?? 0)} · Storage est. KB: ${escapeHtml(stats.storage?.approxKb ?? 0)}</p>
        <p class="muted">Security incidents: ${escapeHtml(stats.security?.incidents ?? 0)} · Audit events: ${escapeHtml(stats.security?.auditEvents ?? 0)}</p>
      </div>
      <div class="panel">
        <div class="section-title"><h2>DR Dashboard</h2></div>
        <p class="muted">${escapeHtml(dr.governedBy || "Module 21 backup-recovery")}</p>
        <p class="muted">Failover: ${escapeHtml(dr.failoverReadiness || "—")} · RTO ${escapeHtml(dr.rtoMinutes ?? "—")}m · RPO ${escapeHtml(dr.rpoMinutes ?? "—")}m</p>
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Environment Manager</h2></div>
        ${rowsOrEmpty(environments.slice(0, 8), "No environments.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.code)} (${escapeHtml(item.status)})`).join(" · ")}</p>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Global Announcement Center</h2></div>
        ${rowsOrEmpty(announcements.slice(0, 6), "No announcements.", (rows) => `
          <p class="muted">${rows.map((item) => escapeHtml(item.title)).join(" · ")}</p>
        `)}
      </div>
    </div>
  `;
}

export function renderPlatformReportsExtra({ reports = [] } = {}) {
  if (!reports.length) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Platform Administration Reports</h2></div>
      <p class="muted">Read-only platform governance reports. No collection posting.</p>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-platform-report="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
