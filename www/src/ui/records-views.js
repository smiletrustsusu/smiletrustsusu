/**
 * Digital records extras under the existing Audit trail and Reports screens.
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

export function renderRecordsAuditExtras({
  stats = {},
  records = [],
  holds = [],
  canView = false,
  canUpload = false,
  canArchive = false,
  canHold = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Digital records</h2></div>
      <p class="muted">Centralized document repository for photos, IDs, agreements, reports, and generated files. Receipt numbers and printable templates stay on the Document Engine. This module does not post collections.</p>
      <div class="grid four">
        <div class="stat"><small>Records</small><strong>${stats.total || 0}</strong></div>
        <div class="stat"><small>Active</small><strong>${stats.active || 0}</strong></div>
        <div class="stat"><small>Archived</small><strong>${stats.archived || 0}</strong></div>
        <div class="stat"><small>Legal holds</small><strong>${stats.holds || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canUpload ? `<button class="btn secondary" type="button" id="recordsUploadDemoBtn">Upload sample ID</button>` : ""}
        ${canArchive ? `<button class="btn ghost" type="button" id="recordsArchiveDemoBtn">Archive latest</button>` : ""}
        ${canHold ? `<button class="btn ghost" type="button" id="recordsHoldDemoBtn">Place legal hold</button>` : ""}
        ${canView ? `<button class="btn ghost" type="button" id="recordsSearchDemoBtn">Search records</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Document library</h2></div>
        ${rowsOrEmpty(records.slice(-8).reverse(), "No digital records yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Number</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.documentNumber)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Legal holds</h2></div>
        ${rowsOrEmpty(holds.filter((item) => item.status === "active").slice(-8), "No active legal holds.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.recordId)} · ${escapeHtml(item.reason)}`).join(" · ")}</p>
        `)}
      </div>
    </div>
  `;
}

export function renderRecordsReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Digital records reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-records-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
