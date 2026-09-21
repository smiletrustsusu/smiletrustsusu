/**
 * Enterprise AI extras under existing Audit Log and Reports screens.
 * No new top-level navigation.
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

export function renderAiAuditExtras({
  stats = {},
  models = [],
  fraudAlerts = [],
  recommendations = [],
  driftEvents = [],
  predictions = [],
  canView = false,
  canPredict = false,
  canGovern = false,
  canAdmin = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise AI Ops Dashboard</h2></div>
      <p class="muted">Advisory / heuristic intelligence only. Module 24 Rule Engine remains the deterministic authority. AI never posts collections or auto-approves loans/withdrawals.</p>
      <div class="grid four">
        <div class="stat"><small>Models</small><strong>${stats.models || 0}</strong></div>
        <div class="stat"><small>Predictions</small><strong>${stats.predictions || 0}</strong></div>
        <div class="stat"><small>Fraud alerts</small><strong>${stats.fraudAlerts || 0}</strong></div>
        <div class="stat"><small>Drift open</small><strong>${stats.driftEvents || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canPredict ? `<button class="btn secondary" type="button" id="aiPredictBtn">Run growth prediction</button>` : ""}
        ${canPredict ? `<button class="btn ghost" type="button" id="aiFraudBtn">Fraud scan</button>` : ""}
        ${canPredict ? `<button class="btn ghost" type="button" id="aiForecastBtn">Weekly forecast</button>` : ""}
        ${canPredict ? `<button class="btn ghost" type="button" id="aiRecommendBtn">Recommendations</button>` : ""}
        ${canGovern ? `<button class="btn ghost" type="button" id="aiGovernanceBtn">Governance</button>` : ""}
        ${canAdmin ? `<button class="btn ghost" type="button" id="aiDriftBtn">Drift scan</button>` : ""}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Model Registry</h2></div>
        ${rowsOrEmpty(models.slice(0, 8), "No models registered.", (rows) => `
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
      </div>
      <div class="panel">
        <div class="section-title"><h2>Fraud Dashboard</h2></div>
        ${rowsOrEmpty(fraudAlerts.slice(0, 8), "No open fraud alerts.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Severity</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.severityity)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Prediction Explorer</h2></div>
        ${rowsOrEmpty(predictions.slice(0, 6), "No predictions yet.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.target || item.id)} · conf ${escapeHtml(Math.round((item.confidence || 0) * 100))}%`).join(" · ")}</p>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Recommendation Center</h2></div>
        ${rowsOrEmpty(recommendations.slice(0, 6), "No recommendations.", (rows) => `
          <ul>${rows.map((item) => `<li>${escapeHtml(item.title)} <span class="muted">(${escapeHtml(item.decision || item.status)})</span></li>`).join("")}</ul>
        `)}
      </div>
    </div>

    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Feature Registry</h2></div>
        <p class="muted">Versioned reusable features with quality and lineage. See AI Feature reports for full inventory.</p>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Drift Monitoring / Model Approval</h2></div>
        ${rowsOrEmpty(driftEvents.slice(0, 5), "No drift events.", (rows) => `
          <ul>${rows.map((item) => `<li>${escapeHtml(item.modelCode)} · ${escapeHtml(item.severityity)}</li>`).join("")}</ul>
        `)}
        <p class="muted" style="margin-top:8px">Deploy requires independent approval (SoD). AI Audit Viewer available via reports.</p>
      </div>
    </div>
  `;
}

export function renderAiReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise AI reports</h2></div>
      <p class="muted">Forecast Dashboard, AI Governance, and audit exports. Advisory outputs only.</p>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-ai-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
