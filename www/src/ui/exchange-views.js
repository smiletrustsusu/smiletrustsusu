/**
 * Data exchange extras under the existing Audit trail and Reports screens.
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

export function renderExchangeAuditExtras({
  stats = {},
  imports = [],
  exports = [],
  errors = [],
  canView = false,
  canImport = false,
  canExport = false,
  canApprove = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Data exchange</h2></div>
      <p class="muted">Centralized import, export, migration, and bulk processing. Financial rows are validated and staged only — this engine does not post collections, loans, or journals.</p>
      <div class="grid four">
        <div class="stat"><small>Imports</small><strong>${stats.imports || 0}</strong></div>
        <div class="stat"><small>Exports</small><strong>${stats.exports || 0}</strong></div>
        <div class="stat"><small>Staged</small><strong>${stats.staged || 0}</strong></div>
        <div class="stat"><small>Pending approval</small><strong>${stats.pendingApprovals || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canImport ? `<button class="btn secondary" type="button" id="exchangeImportDemoBtn">Import sample customer</button>` : ""}
        ${canExport ? `<button class="btn ghost" type="button" id="exchangeExportDemoBtn">Export customers</button>` : ""}
        ${canImport ? `<button class="btn ghost" type="button" id="exchangeValidateDemoBtn">Validate sample rows</button>` : ""}
        ${canApprove ? `<button class="btn ghost" type="button" id="exchangeApproveDemoBtn">Approve latest export</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Import / export jobs</h2></div>
        ${rowsOrEmpty([...imports, ...exports].slice(-8).reverse(), "No exchange jobs yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Dataset</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.dataset)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Validation errors</h2></div>
        ${rowsOrEmpty(errors.slice(-8).reverse(), "No validation errors.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.dataset)} · ${escapeHtml(item.field)} · ${escapeHtml(item.message)}`).join(" · ")}</p>
        `)}
      </div>
    </div>
  `;
}

export function renderExchangeReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Data exchange reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-exchange-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
