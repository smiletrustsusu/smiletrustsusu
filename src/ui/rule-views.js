/**
 * Rule engine extras under the existing Audit trail.
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

export function renderRuleAuditExtras({
  stats = {},
  definitions = [],
  history = [],
  canView = false,
  canTest = false,
  canSimulate = false,
  canPublish = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Rule engine</h2></div>
      <p class="muted">Configurable validation, decisions, scoring, and eligibility are evaluated here. Modules call published Rule.* contracts. This engine does not post collections or change loan interest, the 31-day cycle, or the cashier GHS 1,000 limit.</p>
      <div class="grid four">
        <div class="stat"><small>Published</small><strong>${stats.published || 0}</strong></div>
        <div class="stat"><small>Evaluations</small><strong>${stats.evaluations || 0}</strong></div>
        <div class="stat"><small>Simulations</small><strong>${stats.simulations || 0}</strong></div>
        <div class="stat"><small>Cache hit</small><strong>${Math.round((stats.cacheHitRate || 0) * 100)}%</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canTest ? `<button class="btn secondary" type="button" id="ruleEvalBtn">Evaluate min savings</button>` : ""}
        ${canSimulate ? `<button class="btn ghost" type="button" id="ruleSimulateBtn">Simulate withdrawal decision</button>` : ""}
        ${canTest ? `<button class="btn ghost" type="button" id="ruleTestBtn">Run rule tests</button>` : ""}
        ${canPublish ? `<button class="btn ghost" type="button" id="rulePublishBtn">Re-publish min savings</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Rule catalog</h2></div>
        ${rowsOrEmpty(definitions.slice(-10).reverse(), "No published rules.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Rule</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.name || item.code)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Execution history</h2></div>
        ${rowsOrEmpty(history.slice(-8).reverse(), "No rule evaluations yet.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.code)} · ${escapeHtml(String(item.result?.decision ?? item.result))}`).join(" · ")}</p>
        `)}
      </div>
    </div>
  `;
}

export function renderRuleReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Rule reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-rule-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
