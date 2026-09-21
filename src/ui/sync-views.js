/**
 * Synchronization extras appended below the existing Backup screen.
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

export function renderSyncExtras({
  stats = {},
  rows = [],
  conflicts = [],
  devices = [],
  receipts = [],
  sessions = [],
  network = "online",
  canRetry = false,
  canResolve = false,
  identifierStats = {},
  delegations = [],
  canDelegate = false,
  canApproveDelegation = false,
  wave4PlatformHtml = "",
  wave6DesktopHtml = ""
} = {}) {
  return `
    ${wave4PlatformHtml || ""}
    ${wave6DesktopHtml || ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Synchronization dashboard</h2></div>
      <p class="muted">Local Backup and Cloud Backup above stay as they are. Offline collections still post on this device and queue for ordered sync. Financial items never last-write-wins.</p>
      <div class="grid four">
        <div class="stat"><small>Network</small><strong>${escapeHtml(network)}</strong></div>
        <div class="stat"><small>Pending</small><strong>${stats.pending || 0}</strong></div>
        <div class="stat"><small>Conflicts</small><strong>${stats.conflicts || 0}</strong></div>
        <div class="stat"><small>Failed</small><strong>${stats.failed || 0}</strong></div>
      </div>
      <div class="grid four" style="margin-top:10px">
        <div class="stat"><small>Applied</small><strong>${stats.applied || 0}</strong></div>
        <div class="stat"><small>Last local seq</small><strong>${stats.lastLocalSequence || 0}</strong></div>
        <div class="stat"><small>Server seq</small><strong>${stats.lastServerSequence || 0}</strong></div>
        <div class="stat"><small>Queue size</small><strong>${Math.round((stats.storageBytes || 0) / 1024)} KB</strong></div>
      </div>
      <p class="muted" style="margin-top:8px">Encryption at rest: <strong>${stats.encrypted === false ? "Off" : "On"}</strong> · Engine: ${escapeHtml(stats.status || "idle")}</p>
      <div class="row-actions" style="margin-top:12px">
        <button class="btn secondary" type="button" id="syncEngineRunBtn">Run ordered sync</button>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Queue viewer</h2></div>
        ${(rows || []).length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Seq</th><th>Kind</th><th>Status</th><th>Server</th><th></th></tr></thead>
              <tbody>
                ${rows.slice(-20).reverse().map((item) => `
                  <tr>
                    <td>${escapeHtml(item.localSequence || "")}</td>
                    <td>${escapeHtml(item.kind || "")}</td>
                    <td>${escapeHtml(item.status || "")}</td>
                    <td>${escapeHtml(item.serverSequence || "")}</td>
                    <td>${canRetry && item.status !== "applied" && item.status !== "conflict_detected" ? `<button class="btn ghost" type="button" data-sync-retry="${escapeAttr(item.id)}">Retry</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No queued items.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Conflict workspace</h2></div>
        ${(conflicts || []).filter((item) => item.status === "open").length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Kind</th><th>Reasons</th><th></th></tr></thead>
              <tbody>
                ${conflicts.filter((item) => item.status === "open").map((item) => `
                  <tr>
                    <td>${escapeHtml(item.kind || "")}</td>
                    <td>${escapeHtml((item.reasons || []).join(", "))}</td>
                    <td>${canResolve ? `<button class="btn ghost" type="button" data-sync-resolve="${escapeAttr(item.id)}" data-strategy="business_rule">Business rule</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No open conflicts.</div>`}
        <p class="muted" style="margin-top:10px">Dependent financial items stay paused until the conflict is resolved. Unrelated customers can continue.</p>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Device status</h2></div>
        ${(devices || []).length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Device</th><th>Seq</th><th>Status</th></tr></thead>
              <tbody>
                ${devices.slice(0, 8).map((item) => `
                  <tr>
                    <td>${escapeHtml(item.label || item.fingerprint || item.id)}</td>
                    <td>${escapeHtml(item.localSequence || 0)}</td>
                    <td>${item.active === false ? "Revoked" : "Authorized"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Devices still register on login. Disable lost phones in Settings.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Offline receipts</h2></div>
        ${(receipts || []).length ? `
          <ul class="muted">${receipts.slice(-8).reverse().map((item) => `<li>${escapeHtml(item.temporaryReceiptNo)} → ${escapeHtml(item.permanentReceiptNo || "pending")}</li>`).join("")}</ul>
        ` : `<div class="muted">Printed receipt numbers stay on the collection. After sync they map to a server receipt without changing balances.</div>`}
        <p class="muted" style="margin-top:10px">${(sessions || []).length} sync session(s) recorded.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Identifier standard</h2></div>
      <p class="muted">Existing customer, collection, and receipt numbers stay as they are. Sync items now carry a primary aggregate, version, and typed dependencies. Offline devices may only generate delegated temporary receipts and idempotency keys.</p>
      <div class="grid four">
        <div class="stat"><small>Prefixes</small><strong>${identifierStats.prefixes || 0}</strong></div>
        <div class="stat"><small>Aggregate types</small><strong>${identifierStats.aggregateTypes || 0}</strong></div>
        <div class="stat"><small>Active delegations</small><strong>${identifierStats.activeDelegations || 0}</strong></div>
        <div class="stat"><small>Pending</small><strong>${identifierStats.pendingDelegations || 0}</strong></div>
      </div>
      ${canDelegate ? `
        <form id="identifierDelegationForm" class="form-grid" style="margin-top:12px">
          <div class="field"><label>Identifier type</label><select name="identifierType"><option value="import_batch">Import batch</option><option value="temporary_receipt">Temporary receipt</option><option value="local_sync_session">Local sync session</option></select></div>
          <div class="field"><label>Component</label><input name="component" required placeholder="Import utility" /></div>
          <div class="field full"><label>Justification</label><input name="justification" required placeholder="Why this delegation is needed" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Submit delegation</button></div>
        </form>
      ` : ""}
      ${(delegations || []).length ? `
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>Type</th><th>Component</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${delegations.slice(-8).reverse().map((item) => `
                <tr>
                  <td>${escapeHtml(item.identifierType)}</td>
                  <td>${escapeHtml(item.component)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${canApproveDelegation && item.status === "pending_approval" ? `<button class="btn ghost" type="button" data-id-approve="${escapeAttr(item.id)}">Approve</button>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : ""}
    </div>
  `;
}
