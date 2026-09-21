/**
 * Security operations extras under the existing Audit trail.
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

export function renderSecurityAuditExtras({
  stats = {},
  incidents = [],
  scores = [],
  fraud = [],
  schema = {},
  canView = false,
  canEvaluate = false,
  canIncident = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Security operations</h2></div>
      <p class="muted">Fraud and risk scoring observe collections, payments, devices, and sync. They do not post money or replace the Audit Log above.</p>
      <div class="grid four">
        <div class="stat"><small>Open incidents</small><strong>${stats.openIncidents || 0}</strong></div>
        <div class="stat"><small>Last risk</small><strong>${escapeHtml(stats.lastLevel || "low")} · ${stats.lastScore || 0}</strong></div>
        <div class="stat"><small>Fraud cases</small><strong>${stats.fraudCases || 0}</strong></div>
        <div class="stat"><small>Contract calls</small><strong>${stats.contracts || 0}</strong></div>
      </div>
      ${schema.schemaVersion ? `<p class="muted" style="margin-top:10px">Global API schema ${escapeHtml(schema.schemaVersion)} · ${schema.headerProperties || 0} header properties · ${schema.activeRules || 0} active conditional rules · last validation ${escapeHtml(schema.lastOutcome || "none")}.</p>` : ""}
      <div class="row-actions" style="margin-top:12px">
        ${canEvaluate ? `<button class="btn secondary" type="button" id="securityEvaluateBtn">Evaluate risk</button>` : ""}
        ${canIncident ? `<button class="btn ghost" type="button" id="securityIncidentBtn">Open incident</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Incidents</h2></div>
        ${rowsOrEmpty(incidents.slice(-8).reverse(), "No security incidents.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.title)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${canIncident && item.status !== "closed" ? `<button class="btn ghost" type="button" data-security-close="${escapeAttr(item.id)}">Close</button>` : ""}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Risk scores</h2></div>
        ${rowsOrEmpty(scores.slice(-8).reverse(), "No risk evaluations yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Subject</th><th>Score</th><th>Level</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.subjectId)}</td><td>${item.score}</td><td>${escapeHtml(item.level)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${fraud.length ? `<p class="muted" style="margin-top:8px">${fraud.length} fraud case(s) on file.</p>` : ""}
      </div>
    </div>
  `;
}

export function renderSecurityReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Security reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-security-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
