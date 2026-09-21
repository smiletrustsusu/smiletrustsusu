/**
 * Enterprise BI extras under existing Audit Log and Reports screens.
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

export function renderBiAuditExtras({
  stats = {},
  kpis = [],
  metrics = [],
  canView = false,
  canCalculate = false,
  canPublish = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise BI registries</h2></div>
      <p class="muted">Canonical Metric Registry, KPI formulas, and Schema Metadata for analytics across Modules 1–27. Module 11 report screens stay live. This engine does not post collections.</p>
      <div class="grid four">
        <div class="stat"><small>Metrics</small><strong>${stats.metrics || 0}</strong></div>
        <div class="stat"><small>Published KPIs</small><strong>${stats.kpis || 0}</strong></div>
        <div class="stat"><small>Schemas</small><strong>${stats.schemas || 0}</strong></div>
        <div class="stat"><small>Calculations</small><strong>${stats.calculations || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canCalculate ? `<button class="btn secondary" type="button" id="biCalcAllBtn">Calculate all KPIs</button>` : ""}
        ${canCalculate ? `<button class="btn ghost" type="button" id="biCalcCollectionBtn">Collection rate</button>` : ""}
        ${canPublish ? `<button class="btn ghost" type="button" id="biPublishDemoBtn">Re-publish collection KPI</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>KPI registry</h2></div>
        ${rowsOrEmpty(kpis.slice(0, 8), "No KPIs registered.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.kpiCode)}</td>
                  <td>${escapeHtml(item.kpiName)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Metric registry</h2></div>
        ${rowsOrEmpty(metrics.slice(0, 8), "No metrics registered.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.metricCode)} · ${escapeHtml(item.metricName)}`).join(" · ")}</p>
        `)}
      </div>
    </div>
  `;
}

export function renderBiRegistryReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise BI registry reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-bi-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
