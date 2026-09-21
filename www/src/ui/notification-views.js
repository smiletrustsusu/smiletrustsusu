/**
 * Extra communication-center panels. Existing Templates + Queue form stay in renderNotifications.
 */
import { formatGhs } from "../core/money.js";

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

export function renderNotificationDashboard(stats = {}) {
  return `
    <div class="grid four" style="margin-top:18px">
      <div class="stat"><small>Queued</small><strong>${stats.queued || 0}</strong></div>
      <div class="stat"><small>Sent</small><strong>${stats.sent || 0}</strong></div>
      <div class="stat"><small>Failed</small><strong>${stats.failed || 0}</strong></div>
      <div class="stat"><small>Delivery rate</small><strong>${stats.deliveryRate || 0}%</strong></div>
    </div>
  `;
}

export function renderProviderHealthTable(providers = []) {
  if (!providers.length) return `<div class="empty">No providers configured.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Provider</th><th>Channel</th><th>Priority</th><th>Health</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>
          ${providers.map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.channel)}</td>
              <td>${item.priority}</td>
              <td>${escapeHtml(item.healthState || "Not Evaluated")}</td>
              <td>${item.displayedScore == null ? "—" : item.displayedScore}</td>
              <td>${item.maintenance ? "Maintenance" : item.enabled === false ? "Disabled" : "Enabled"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderQueueMonitor(rows = []) {
  if (!rows.length) return `<div class="empty">Queue is empty.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Channel</th><th>Event</th><th>Status</th><th>Failover</th><th>Provider</th></tr></thead>
        <tbody>
          ${rows.slice(0, 20).map((item) => `
            <tr>
              <td>${escapeHtml(String(item.createdAt || "").slice(0, 16))}</td>
              <td>${escapeHtml(item.channel)}</td>
              <td>${escapeHtml(item.event)}</td>
              <td>${escapeHtml(item.status)}</td>
              <td>${escapeHtml(item.failoverState || "")}</td>
              <td>${escapeHtml(item.providerId || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderNotificationExtras({
  stats,
  providers = [],
  queue = [],
  announcements = [],
  events = [],
  canSend = false,
  canBroadcast = false,
  canSchedule = false,
  canProvider = false,
  recipientPreview = 0
} = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Communication center</h2>
        <div class="row-actions">
          ${canSend ? `<button class="btn secondary" type="button" id="processNotificationQueueBtn">Process queue</button>` : ""}
        </div>
      </div>
      <p class="muted">All SMS, WhatsApp, email, push, and in-app messages go through this queue. Delivery failures never change posted financial records. Provider credentials are not stored in the APK.</p>
      ${renderNotificationDashboard(stats)}
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Provider health</h2></div>
        ${renderProviderHealthTable(providers)}
        ${canProvider ? `
          <form id="providerOverrideForm" class="form-grid" style="margin-top:12px">
            <div class="field"><label>Provider</label><select name="id">${optionList(providers, providers[0]?.id)}</select></div>
            <div class="field"><label>Priority</label><input name="priority" type="number" min="1" value="1" /></div>
            <div class="field"><label>Maintenance</label><select name="maintenance"><option value="false">No</option><option value="true">Yes</option></select></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Save override</button></div>
          </form>
        ` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Delivery queue</h2></div>
        ${renderQueueMonitor(queue)}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Bulk message</h2></div>
        ${canBroadcast ? `
          <form id="bulkNotificationForm" class="form-grid">
            <div class="field"><label>Event</label><select name="event">${optionList(events, "contribution_received")}</select></div>
            <div class="field"><label>Channel</label><select name="channel">${optionList(["SMS", "WhatsApp", "Email", "In-App"].map((item) => ({ value: item, label: item })), "SMS")}</select></div>
            <div class="field"><label>Branch id</label><input name="branchId" /></div>
            <div class="field"><label>Agent id</label><input name="agentId" /></div>
            <div class="field full"><label>Name variable</label><input name="name" placeholder="Members" /></div>
            <div class="notice">Estimated recipients: <strong>${recipientPreview}</strong></div>
            <div class="form-actions full"><button class="btn" type="submit">Queue bulk messages</button></div>
          </form>
        ` : `<div class="notice">Bulk send requires Notification.Broadcast.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Schedule & announcements</h2></div>
        ${canSchedule ? `
          <form id="scheduleNotificationForm" class="form-grid">
            <div class="field"><label>Event</label><select name="event">${optionList(events, "meeting_reminder")}</select></div>
            <div class="field"><label>Channel</label><select name="channel">${optionList(["SMS", "In-App", "WhatsApp"].map((item) => ({ value: item, label: item })), "In-App")}</select></div>
            <div class="field"><label>Frequency</label><select name="frequency">${optionList(["Daily", "Weekly", "Monthly", "Annual", "One-Time"], "Daily")}</select></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Save schedule</button></div>
          </form>
        ` : `<div class="notice">Scheduling requires Notification.Schedule.</div>`}
        ${canBroadcast ? `
          <form id="announcementForm" class="form-grid" style="margin-top:12px">
            <div class="field full"><label>Announcement title</label><input name="title" required /></div>
            <div class="field full"><label>Body</label><textarea name="body" required></textarea></div>
            <div class="field"><label>Audience</label><select name="audience">${optionList(["All Users", "Branch", "Agents", "Customers", "Groups"], "All Users")}</select></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Publish</button></div>
          </form>
        ` : ""}
        ${announcements.length ? `<div class="muted" style="margin-top:8px">${announcements.slice(-3).reverse().map((item) => escapeHtml(item.title)).join(" · ")}</div>` : ""}
      </div>
    </div>
  `;
}

export { formatGhs };
