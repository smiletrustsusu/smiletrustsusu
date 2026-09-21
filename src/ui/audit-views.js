/**
 * Investigation extras appended below the existing Audit Log + Exceptions panels.
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

function optionList(items, selected) {
  return items.map((item) => {
    const value = item.value ?? item.id ?? item;
    const label = item.label ?? item.name ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function renderAuditDashboard(stats = {}) {
  return `
    <div class="grid four" style="margin-top:18px">
      <div class="stat"><small>Today</small><strong>${stats.today || 0}</strong></div>
      <div class="stat"><small>Financial</small><strong>${stats.financial || 0}</strong></div>
      <div class="stat"><small>Failed logins</small><strong>${stats.failedLogins || 0}</strong></div>
      <div class="stat"><small>Integrity</small><strong>${stats.integrityOk === false ? "Break" : "OK"}</strong></div>
    </div>
    <div class="grid four" style="margin-top:10px">
      <div class="stat"><small>High risk</small><strong>${stats.highRisk || 0}</strong></div>
      <div class="stat"><small>Outbox pending</small><strong>${stats.pendingOutbox || 0}</strong></div>
      <div class="stat"><small>Dead letters</small><strong>${stats.deadLetters || 0}</strong></div>
      <div class="stat"><small>Archives</small><strong>${stats.archives || 0}</strong></div>
    </div>
  `;
}

export function renderExactlyOncePanel(metrics = {}) {
  return `
    <div class="grid four" style="margin-top:10px">
      <div class="stat"><small>Idempotency hits</small><strong>${metrics.duplicateRequestsPrevented || 0}</strong></div>
      <div class="stat"><small>Duplicates prevented</small><strong>${metrics.cachedResponsesReturned || 0}</strong></div>
      <div class="stat"><small>Callbacks ignored</small><strong>${metrics.duplicateCallbacksIgnored || 0}</strong></div>
      <div class="stat"><small>Key conflicts</small><strong>${metrics.keyConflicts || 0}</strong></div>
    </div>
    <div class="grid four" style="margin-top:10px">
      <div class="stat"><small>Replays</small><strong>${metrics.replayOperations || 0}</strong></div>
      <div class="stat"><small>Retries</small><strong>${metrics.retryOperations || 0}</strong></div>
      <div class="stat"><small>Outbox pending</small><strong>${metrics.pendingOutbox || 0}</strong></div>
      <div class="stat"><small>External delivery</small><strong>Not guaranteed</strong></div>
    </div>
  `;
}

export function renderAuditTimeline(rows = []) {
  if (!rows.length) return `<div class="empty">No timeline events for this entity.</div>`;
  return `
    <ol class="audit-timeline" style="margin:0;padding-left:18px">
      ${rows.slice(-40).map((row) => `
        <li style="margin-bottom:8px">
          <strong>${escapeHtml(row.eventType || row.action)}</strong>
          <span class="muted"> · ${escapeHtml(String(row.createdAt || "").replace("T", " ").slice(0, 19))}</span>
          <div>${escapeHtml(row.details || "")}</div>
        </li>
      `).join("")}
    </ol>
  `;
}

export function renderAuditSearchResults(rows = []) {
  if (!rows.length) return `<div class="empty">No matching audit events.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>Details</th><th>User</th><th>Corr.</th></tr></thead>
        <tbody>
          ${rows.slice(-80).reverse().map((row) => `
            <tr>
              <td>${escapeHtml(String(row.createdAt || "").replace("T", " ").slice(0, 19))}</td>
              <td>${escapeHtml(row.eventType || row.action || "")}</td>
              <td>${escapeHtml(row.severity || "")}</td>
              <td>${escapeHtml(row.details || "")}</td>
              <td>${escapeHtml(row.username || row.fullName || row.userId || "")}</td>
              <td>${escapeHtml(String(row.correlationId || "").slice(0, 12))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAuditExtras({
  stats = {},
  searchRows = [],
  timelineRows = [],
  filters = {},
  savedFilters = [],
  reports = [],
  outbox = [],
  canExport = false,
  canIntegrity = false,
  canArchive = false
} = {}) {
  const dead = outbox.filter((item) => item.status === "dead").slice(-8);
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Investigation console</h2>
        <div class="row-actions">
          ${canIntegrity ? `<button class="btn secondary" type="button" id="auditVerifyIntegrityBtn">Verify integrity</button>` : ""}
          ${canIntegrity ? `<button class="btn ghost" type="button" id="auditProcessOutboxBtn">Process outbox</button>` : ""}
          ${canArchive ? `<button class="btn ghost" type="button" id="auditArchiveBtn">Apply retention</button>` : ""}
        </div>
      </div>
      <p class="muted">Every module writes through the central audit engine. Records cannot be edited or deleted. The Audit Log table above is unchanged. Exactly-once persistence and business effects apply only inside this system; SMS, MoMo, and email delivery are at-least-once and not guaranteed by Smile Trust.</p>
      ${renderAuditDashboard(stats)}
      ${renderExactlyOncePanel(stats.idempotency || {})}
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Advanced search</h2></div>
        <form id="auditSearchForm" class="form-grid">
          <div class="field"><label>Text</label><input name="q" value="${escapeAttr(filters.q || "")}" /></div>
          <div class="field"><label>User</label><input name="user" value="${escapeAttr(filters.user || "")}" /></div>
          <div class="field"><label>Customer</label><input name="customer" value="${escapeAttr(filters.customer || "")}" /></div>
          <div class="field"><label>Event type</label><input name="eventType" value="${escapeAttr(filters.eventType || "")}" /></div>
          <div class="field"><label>Severity</label><select name="severity">${optionList([{ value: "", label: "Any" }, "Informational", "Low", "Medium", "High", "Critical"].map((item) => typeof item === "string" ? { value: item, label: item } : item), filters.severity || "")}</select></div>
          <div class="field"><label>Module</label><input name="module" value="${escapeAttr(filters.module || "")}" /></div>
          <div class="field"><label>From</label><input name="from" type="date" value="${escapeAttr(filters.from || "")}" /></div>
          <div class="field"><label>To</label><input name="to" type="date" value="${escapeAttr(filters.to || "")}" /></div>
          <div class="field"><label>Correlation ID</label><input name="correlationId" value="${escapeAttr(filters.correlationId || "")}" /></div>
          <div class="field"><label>IP address</label><input name="ipAddress" value="${escapeAttr(filters.ipAddress || "")}" /></div>
          <div class="form-actions full"><button class="btn" type="submit">Search</button></div>
        </form>
        ${savedFilters.length ? `<div class="muted" style="margin-top:8px">Saved: ${savedFilters.map((item) => escapeHtml(item.name)).join(" · ")}</div>` : ""}
        ${canExport ? `
          <form id="auditSaveFilterForm" class="form-grid" style="margin-top:10px">
            <div class="field full"><label>Save this search</label><input name="name" placeholder="Failed logins this week" required /></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Save filter</button></div>
          </form>
        ` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Results</h2></div>
        ${renderAuditSearchResults(searchRows)}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Entity timeline</h2></div>
        <form id="auditTimelineForm" class="form-grid">
          <div class="field"><label>Entity</label><select name="entityType">${optionList(["customer", "loan", "savings", "group", "branch", "user", "transaction"].map((item) => ({ value: item, label: item })), filters.entityType || "customer")}</select></div>
          <div class="field"><label>ID</label><input name="entityId" value="${escapeAttr(filters.entityId || "")}" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Build timeline</button></div>
        </form>
        ${renderAuditTimeline(timelineRows)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Compliance reports</h2></div>
        ${canExport ? `
          <div class="row-actions" style="flex-wrap:wrap;gap:8px">
            ${reports.map((item) => `<button class="btn ghost" type="button" data-compliance-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
          </div>
          <p class="muted" style="margin-top:10px">Exports are watermarked CSV. PDF/Excel use the same rows via spreadsheet import.</p>
        ` : `<div class="notice">Export requires Audit.Export.</div>`}
        ${dead.length ? `
          <div class="section-title" style="margin-top:16px"><h3>Dead letter queue</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Retries</th><th>Reason</th><th></th></tr></thead>
              <tbody>
                ${dead.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.eventId || item.auditId)}</td>
                    <td>${item.retryCount || 0}</td>
                    <td>${escapeHtml(item.failureReason || "")}</td>
                    <td>${canIntegrity ? `<button class="btn ghost" type="button" data-replay-dlq="${escapeAttr(item.id)}">Replay</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="muted" style="margin-top:12px">No dead-letter items.</div>`}
      </div>
    </div>
  `;
}
