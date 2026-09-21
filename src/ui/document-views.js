/**
 * Document engine extras. Existing collection receipts, print windows,
 * and MoMo webhook secret stay as they are.
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

export function renderDocumentCollectionExtras({
  stats = {},
  documents = [],
  pending = [],
  mappings = [],
  detail = null,
  query = "",
  canView = false,
  canGenerate = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Document engine</h2></div>
      <p class="muted">Printed collection receipts above still use the same receipt numbers. This engine stores, versions, and reconciles every official document. Offline receipts stay temporary until sync.</p>
      <div class="grid four">
        <div class="stat"><small>Documents</small><strong>${stats.total || 0}</strong></div>
        <div class="stat"><small>Issued</small><strong>${stats.issued || 0}</strong></div>
        <div class="stat"><small>Pending offline</small><strong>${stats.pendingOffline || 0}</strong></div>
        <div class="stat"><small>Reconciled</small><strong>${stats.reconciled || 0}</strong></div>
      </div>
      <form id="documentSearchForm" class="form-grid" style="margin-top:14px">
        <div class="field"><label>Search receipts</label><input name="q" value="${escapeAttr(query)}" placeholder="Receipt, temporary number, customer" /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Search</button></div>
      </form>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Official documents</h2></div>
        ${rowsOrEmpty(documents.slice(-20).reverse(), "No document-engine records yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Number</th><th>Status</th><th>Outcome</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.type)}</td>
                    <td>${escapeHtml(item.permanentReceiptNo || item.receiptNo || item.temporaryReceiptNo || "")}</td>
                    <td>${escapeHtml(item.status)}</td>
                    <td>${escapeHtml(item.outcome || "")}</td>
                    <td><button class="btn ghost" type="button" data-document-detail="${escapeAttr(item.id)}">Details</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Offline receipt queue</h2></div>
        ${rowsOrEmpty(pending, "No pending temporary receipts.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Temporary</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.temporaryReceiptNumber)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        <div class="section-title" style="margin-top:16px"><h2>QR verification</h2></div>
        <form id="documentVerifyForm" class="form-grid">
          <div class="field full"><label>Verification token</label><input name="token" required placeholder="Paste QR token" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Verify</button></div>
        </form>
        <div id="documentVerifyResult"></div>
        ${canGenerate ? `
          <form id="documentStatementForm" class="form-grid" style="margin-top:16px">
            <div class="field"><label>Customer id</label><input name="customerId" required /></div>
            <div class="field"><label>From</label><input name="from" type="date" /></div>
            <div class="field"><label>To</label><input name="to" type="date" /></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Generate statement</button></div>
          </form>
        ` : ""}
      </div>
    </div>
    ${detail ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Document details</h2></div>
        <div class="calc-list">
          <div><span>Number</span><strong>${escapeHtml(detail.document.permanentReceiptNo || detail.document.receiptNo || "")}</strong></div>
          <div><span>Temporary</span><strong>${escapeHtml(detail.document.temporaryReceiptNo || "—")}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(detail.document.status)}</strong></div>
          <div><span>Outcome</span><strong>${escapeHtml(detail.document.outcome || "")}</strong></div>
          <div><span>Signed</span><strong>${detail.document.signed ? "Yes" : "No"}</strong></div>
        </div>
        ${detail.document.contentHtml ? `<div class="notice" style="margin-top:12px">Print preview is available from Details. Original receipts are never edited.</div>` : ""}
        ${(detail.linked || []).length ? `<p class="muted">Linked compensating documents: ${(detail.linked || []).map((item) => escapeHtml(item.receiptNo || item.id)).join(", ")}</p>` : ""}
      </div>
    ` : ""}
    ${mappings.length ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Receipt mappings</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Temporary</th><th>Permanent</th></tr></thead>
            <tbody>${mappings.slice(-12).reverse().map((item) => `<tr><td>${escapeHtml(item.temporaryReceiptNumber)}</td><td>${escapeHtml(item.permanentReceiptNumber)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
    ` : ""}
  `;
}

export function renderDocumentAccountingExtras({
  statements = [],
  refunds = [],
  reversals = [],
  approvals = [],
  canApprove = false
} = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Document statements & compensating receipts</h2></div>
      <p class="muted">Trial balance above is unchanged. Refund and reversal receipts are new linked documents. Issued receipts are never rewritten.</p>
      ${rowsOrEmpty(statements.slice(-8).reverse(), "No statements generated.", (rows) => `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.customerName || "")}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(String(item.createdAt || "").slice(0, 10))}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `)}
      ${rowsOrEmpty([...(refunds || []).map((item) => ({ ...item, kind: "Refund" })), ...(reversals || []).map((item) => ({ ...item, kind: "Reversal" }))].slice(-10).reverse(), "No compensating receipts.", (rows) => `
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>Kind</th><th>Number</th><th>Original</th></tr></thead>
            <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.receiptNo || "")}</td><td>${escapeHtml(item.originalReceiptNo || "")}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `)}
      ${canApprove ? `
        <div class="section-title" style="margin-top:16px"><h2>Pending receipt approvals</h2></div>
        ${rowsOrEmpty(approvals.filter((item) => item.status === "pending"), "No pending approvals.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Action</th><th>Maker</th><th></th></tr></thead>
              <tbody>${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.action)}</td>
                  <td>${escapeHtml(item.makerId)}</td>
                  <td>
                    <button class="btn ghost" type="button" data-document-approve="${escapeAttr(item.id)}">Approve</button>
                    <button class="btn warning" type="button" data-document-reject="${escapeAttr(item.id)}">Reject</button>
                  </td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        `)}
      ` : ""}
    </div>
  `;
}

export function renderDocumentTemplateExtras({
  templates = [],
  canManage = false
} = {}) {
  if (!canManage) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Document templates</h2></div>
      <p class="muted">Template edits are versioned and unpublished until a second officer publishes them. Live collection print layout is unchanged.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Version</th><th>Published</th></tr></thead>
          <tbody>
            ${templates.map((item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.type)}</td>
                <td>${item.version || 1}</td>
                <td>${item.published ? "Yes" : "No"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderDocumentReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Document reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-document-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
