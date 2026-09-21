/**
 * API Gateway extras. Existing Backup, scheduler, and monitoring panels stay as they are.
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

export function renderGatewayBackupExtras({
  stats = {},
  clients = [],
  keys = [],
  webhooks = [],
  requests = [],
  spec = null,
  canView = false,
  canClient = false,
  canKey = false,
  canWebhook = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>API gateway</h2></div>
      <p class="muted">External clients enter through this in-process gateway. It does not start an HTTP or GraphQL server and it does not post collections.</p>
      <div class="grid four">
        <div class="stat"><small>Clients</small><strong>${stats.clients || 0}</strong></div>
        <div class="stat"><small>Active keys</small><strong>${stats.keys || 0}</strong></div>
        <div class="stat"><small>Requests</small><strong>${stats.requests || 0}</strong></div>
        <div class="stat"><small>Webhook deliveries</small><strong>${stats.webhooks || 0}</strong></div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>API clients</h2></div>
        ${canClient ? `
          <form id="gatewayClientForm" class="form-grid">
            <div class="field"><label>Name</label><input name="name" required /></div>
            <div class="field"><label>Type</label>
              <select name="type">
                <option value="third_party">Third party</option>
                <option value="banking">Banking</option>
                <option value="ussd">USSD</option>
                <option value="bi">BI</option>
              </select>
            </div>
            <button class="btn secondary" type="submit">Register client</button>
          </form>
        ` : ""}
        ${rowsOrEmpty(clients.slice(-8).reverse(), "No API clients.", (rows) => `
          <div class="table-wrap" style="margin-top:10px">
            <table>
              <thead><tr><th>Client</th><th>Type</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${canKey ? `<button class="btn ghost" type="button" data-gateway-rotate="${escapeAttr(item.id)}">Rotate key</button>` : ""}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Webhooks</h2></div>
        ${canWebhook ? `
          <form id="gatewayWebhookForm" class="form-grid">
            <div class="field"><label>Event</label><input name="event" placeholder="payment.completed" required /></div>
            <div class="field"><label>Target</label><input name="target" placeholder="partner://payments" required /></div>
            <button class="btn secondary" type="submit">Subscribe</button>
          </form>
        ` : ""}
        ${rowsOrEmpty(webhooks.slice(-8).reverse(), "No webhook subscriptions.", (rows) => `
          <div class="table-wrap" style="margin-top:10px">
            <table>
              <thead><tr><th>Event</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.event)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Recent gateway requests</h2></div>
      ${rowsOrEmpty(requests.slice(-10).reverse(), "No gateway traffic yet.", (rows) => `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Route</th><th>Status</th><th>ms</th></tr></thead>
            <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.route)}</td><td>${escapeHtml(item.status)}</td><td>${item.durationMs || 0}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `)}
      ${spec ? `<p class="muted" style="margin-top:8px">OpenAPI ${escapeHtml(spec.info?.version || "")} · ${Object.keys(spec.paths || {}).length} paths · in-process only.</p>` : ""}
      ${keys.length ? `<p class="muted">Active keys end with ${escapeHtml(keys.map((item) => item.hint).filter(Boolean).join(", ") || "—")}.</p>` : ""}
    </div>
  `;
}

export function renderGatewayReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>API gateway reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-gateway-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
