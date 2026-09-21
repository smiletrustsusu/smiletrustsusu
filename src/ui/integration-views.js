/**
 * Enterprise Integration Hub extras under existing Audit Log and Reports screens.
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

export function renderIntegrationAuditExtras({
  stats = {},
  providers = [],
  webhooks = [],
  clients = [],
  transforms = [],
  queues = [],
  delivery = {},
  canView = false,
  canAdmin = false,
  canWebhook = false,
  canProvider = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise Integration Hub</h2></div>
      <p class="muted">In-process API gateway policies, providers, webhooks, transforms, and message queues on top of Module 20. Does not post collections or store MoMo PINs.</p>
      <div class="grid four">
        <div class="stat"><small>Providers</small><strong>${stats.providers || 0}</strong></div>
        <div class="stat"><small>Webhooks</small><strong>${stats.webhooks || 0}</strong></div>
        <div class="stat"><small>Clients</small><strong>${stats.clients || 0}</strong></div>
        <div class="stat"><small>Queue depth</small><strong>${stats.queueDepth || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canProvider ? `<button class="btn secondary" type="button" id="integrationDispatchDemoBtn">Dispatch MoMo health</button>` : ""}
        ${canWebhook ? `<button class="btn ghost" type="button" id="integrationWebhookDemoBtn">Register inbound webhook</button>` : ""}
        ${canAdmin ? `<button class="btn ghost" type="button" id="integrationTransformDemoBtn">Run currency transform</button>` : ""}
        ${canAdmin ? `<button class="btn ghost" type="button" id="integrationQueueDemoBtn">Publish queue message</button>` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Providers</h2></div>
        ${rowsOrEmpty(providers.slice(0, 8), "No providers.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Category</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.category)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Webhooks & clients</h2></div>
        <p class="muted">Webhooks: ${webhooks.slice(0, 5).map((item) => escapeHtml(item.eventType || item.id)).join(" · ") || "none"}</p>
        <p class="muted">Clients: ${clients.slice(0, 5).map((item) => escapeHtml(item.name)).join(" · ") || "none"}</p>
        <p class="muted">Transforms: ${transforms.slice(0, 5).map((item) => escapeHtml(item.code)).join(" · ") || "none"}</p>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Message queues</h2></div>
        ${rowsOrEmpty(queues.slice(0, 8), "No queues.", (rows) => `
          <p class="muted">${rows.map((item) => `${escapeHtml(item.name)} · depth ${escapeHtml(item.depth)}${item.backPressure ? " · back-pressure" : ""}`).join(" · ")}</p>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Delivery dashboard</h2></div>
        <div class="grid four">
          <div class="stat"><small>Deliverables</small><strong>${delivery.deliverables || 0}</strong></div>
          <div class="stat"><small>Completed</small><strong>${delivery.completed || 0}</strong></div>
          <div class="stat"><small>Overdue</small><strong>${delivery.overdue || 0}</strong></div>
          <div class="stat"><small>Readiness</small><strong>${delivery.releaseReadinessPct || 0}%</strong></div>
        </div>
        ${canAdmin ? `<div class="row-actions" style="margin-top:12px"><button class="btn ghost" type="button" id="integrationAdvanceDeliveryBtn">Advance first deliverable milestone</button></div>` : ""}
        ${rowsOrEmpty((delivery.rows || []).slice(0, 6), "No delivery rows.", (rows) => `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Code</th><th>Milestone</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.deadline?.currentMilestone || "")}</td>
                  <td>${escapeHtml(item.deadline?.status || "")}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
  `;
}

export function renderIntegrationReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Enterprise Integration reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-integration-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
