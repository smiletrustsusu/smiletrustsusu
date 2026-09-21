/**
 * Workflow extras under the existing Audit trail.
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

export function renderWorkflowAuditExtras({
  stats = {},
  inbox = [],
  instances = [],
  cases = [],
  definitions = [],
  canView = false,
  canStart = false,
  canApprove = false,
  canCase = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Workflow engine</h2></div>
      <p class="muted">Approvals, tasks, cases, and SLAs run through this engine. Other modules must use the published Workflow.* contracts — they cannot write workflow tables directly. The engine does not post collections or replace the loan and withdrawal screens.</p>
      <div class="grid four">
        <div class="stat"><small>Active</small><strong>${stats.active || 0}</strong></div>
        <div class="stat"><small>Open tasks</small><strong>${stats.openTasks || 0}</strong></div>
        <div class="stat"><small>Open cases</small><strong>${stats.openCases || 0}</strong></div>
        <div class="stat"><small>SLA breaches</small><strong>${stats.slaBreaches || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canStart ? `<button class="btn secondary" type="button" id="workflowStartBtn">Start withdrawal workflow</button>` : ""}
        ${canStart ? `<button class="btn ghost" type="button" id="workflowAutoBtn">Run automated workflow</button>` : ""}
        ${canStart ? `<button class="btn ghost" type="button" id="workflowTickBtn">Check SLAs</button>` : ""}
        ${canCase ? `<button class="btn ghost" type="button" id="workflowCaseBtn">Open case</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Task inbox</h2></div>
        ${rowsOrEmpty(inbox.slice(-8).reverse(), "No open workflow tasks.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${canApprove && item.status !== "completed" ? `<button class="btn ghost" type="button" data-workflow-approve="${escapeAttr(item.id)}">Approve</button>` : ""}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Cases & instances</h2></div>
        ${rowsOrEmpty(instances.slice(-6).reverse(), "No workflow instances.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.code)} · ${escapeHtml(item.status)}`).join(" · ")}</p>
        `)}
        ${rowsOrEmpty(cases.slice(-6).reverse(), "No business cases.", (rows) => `
          <div class="table-wrap" style="margin-top:8px">
            <table>
              <thead><tr><th>Case</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${definitions.length ? `<p class="muted" style="margin-top:8px">${definitions.length} published definition(s).</p>` : ""}
      </div>
    </div>
  `;
}

export function renderWorkflowReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Workflow reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-workflow-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
