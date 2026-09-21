/**
 * Backup / DR extras below the existing Local and Cloud Backup panels.
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

export function renderRecoveryBackupExtras({
  stats = {},
  sets = [],
  restores = [],
  tests = [],
  sites = [],
  canView = false,
  canCreate = false,
  canRestore = false,
  canApprove = false,
  canTest = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Recovery console</h2></div>
      <p class="muted">The export and cloud buttons above stay as they are. This engine catalogs, verifies, and tests recovery without changing collection amounts.</p>
      <div class="grid four">
        <div class="stat"><small>Backups</small><strong>${stats.backups || 0}</strong></div>
        <div class="stat"><small>Verified</small><strong>${stats.verified || 0}</strong></div>
        <div class="stat"><small>RPO</small><strong>${stats.rpoMinutes || 0}m ${stats.rpoBreached ? "breach" : "ok"}</strong></div>
        <div class="stat"><small>RTO</small><strong>${stats.rtoMinutes || 0}m</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canCreate ? `<button class="btn secondary" type="button" id="recoverySnapshotBtn">Create verified snapshot</button>` : ""}
        ${canTest ? `<button class="btn ghost" type="button" id="recoveryTestBtn">Run recovery drill</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Backup sets</h2></div>
        ${rowsOrEmpty(sets.slice(-8).reverse(), "No cataloged backups yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.verificationStatus || item.status)}</td>
                  <td>
                    ${canRestore ? `<button class="btn ghost" type="button" data-restore-request="${escapeAttr(item.id)}">Request restore</button>` : ""}
                    <button class="btn ghost" type="button" data-backup-verify="${escapeAttr(item.id)}">Verify</button>
                  </td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Restore wizard</h2></div>
        ${rowsOrEmpty(restores.slice(-8).reverse(), "No restore requests.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Request</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.id)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${canApprove && item.status === "authorized" ? `<button class="btn ghost" type="button" data-restore-approve="${escapeAttr(item.id)}">Approve</button>` : ""}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${rowsOrEmpty(tests.slice(-4).reverse(), "", (rows) => `
          <p class="muted" style="margin-top:10px">Last drill: ${escapeHtml(rows[0].status)} · ${rows[0].durationMinutes || 0}m · production untouched.</p>
        `)}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Disaster recovery sites</h2></div>
      ${rowsOrEmpty(sites, "No DR sites.", (rows) => `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Site</th><th>Role</th><th>Strategy</th></tr></thead>
            <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.role)}</td><td>${escapeHtml(item.strategy)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `)}
    </div>
  `;
}

export function renderRecoveryReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Recovery reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-recovery-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
