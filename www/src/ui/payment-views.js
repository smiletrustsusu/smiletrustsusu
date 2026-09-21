/**
 * Payment engine extras. Existing collection form, accounting statements,
 * System Controls, and MoMo webhook secret stay as they are.
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

function money(amount) {
  return formatGhs(amount);
}

function optionList(items, selected) {
  return items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function rowsOrEmpty(rows, empty, render) {
  if (!rows?.length) return `<div class="empty">${empty}</div>`;
  return render(rows);
}

export function renderPaymentCollectionExtras({
  stats = {},
  payments = [],
  queue = [],
  callbacks = [],
  health = [],
  methods = [],
  query = "",
  detail = null,
  canRefund = false,
  canReverse = false,
  canView = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Payment engine</h2></div>
      <p class="muted">Collections above still post the same way. This engine is the only path to Mobile Money, bank, and other providers. Smile Trust never asks for a MoMo PIN.</p>
      <div class="grid four">
        <div class="stat"><small>Today</small><strong>${money(stats.todayAmount || 0)}</strong></div>
        <div class="stat"><small>Pending</small><strong>${stats.pending || 0}</strong></div>
        <div class="stat"><small>Failed</small><strong>${stats.failed || 0}</strong></div>
        <div class="stat"><small>Queue</small><strong>${stats.queuePending || 0}</strong></div>
      </div>
      <form id="paymentSearchForm" class="form-grid" style="margin-top:14px">
        <div class="field"><label>Search payments</label><input name="q" value="${escapeAttr(query)}" placeholder="Reference, payment id, customer" /></div>
        <div class="field"><label>Method</label><select name="method">${optionList([{ value: "", label: "All methods" }, ...methods], "")}</select></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Search</button></div>
      </form>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Payment transactions</h2></div>
        ${rowsOrEmpty(payments.slice(-20).reverse(), "No payment engine records yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.paymentMethod)}</td>
                    <td>${money(item.amount)}</td>
                    <td>${escapeHtml(item.status)}</td>
                    <td>${escapeHtml(item.paymentReference || "")}</td>
                    <td><button class="btn ghost" type="button" data-payment-detail="${escapeAttr(item.id)}">Details</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Payment queue</h2>
          <button class="btn ghost" type="button" id="paymentQueueRunBtn">Process queue</button>
        </div>
        ${rowsOrEmpty(queue.slice(-15).reverse(), "Queue is empty.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Status</th><th>Tries</th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.paymentId)}</td>
                    <td>${escapeHtml(item.status)}</td>
                    <td>${item.attempts || 0}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
        <div class="section-title" style="margin-top:16px"><h2>Callback monitor</h2></div>
        <form id="paymentCallbackForm" class="form-grid">
          <div class="field"><label>Provider</label><select name="providerId">${optionList(["prov-mtn", "prov-telecel", "prov-airteltigo", "prov-bank"].map((id) => ({ value: id, label: id.replace("prov-", "") })), "prov-mtn")}</select></div>
          <div class="field"><label>Reference</label><input name="reference" required placeholder="Provider reference" /></div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" /></div>
          <div class="field"><label>Status</label><select name="status">${optionList(["success", "failed"], "success")}</select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Ingest signed callback</button></div>
        </form>
        ${rowsOrEmpty(callbacks.slice(-8).reverse(), "No callbacks received.", (rows) => `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Ref</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.reference)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
    ${detail ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Transaction details</h2></div>
        <div class="calc-list">
          <div><span>Payment</span><strong>${escapeHtml(detail.payment.id)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(detail.payment.status)}</strong></div>
          <div><span>Method</span><strong>${escapeHtml(detail.payment.paymentMethod)}</strong></div>
          <div><span>Amount</span><strong>${money(detail.payment.amount)}</strong></div>
          <div><span>Reference</span><strong>${escapeHtml(detail.payment.paymentReference || "")}</strong></div>
          <div><span>Correlation</span><strong>${escapeHtml(detail.payment.correlationId || "")}</strong></div>
        </div>
        ${(canRefund || canReverse) && ["completed", "partially_refunded", "partially_reversed"].includes(detail.payment.status) ? `
          <div class="row-actions" style="margin-top:12px">
            ${canRefund && ["completed", "partially_refunded"].includes(detail.payment.status) ? `<button class="btn warning" type="button" data-payment-refund="${escapeAttr(detail.payment.id)}">Record refund</button>` : ""}
            ${canReverse && ["completed", "partially_reversed"].includes(detail.payment.status) ? `<button class="btn warning" type="button" data-payment-reverse="${escapeAttr(detail.payment.id)}">Record reversal</button>` : ""}
          </div>
          <p class="muted">Refunds and reversals create linked records. The original payment amount is never rewritten.</p>
        ` : ""}
        ${(detail.history || []).length ? `
          <div class="section-title" style="margin-top:16px"><h3>Status history</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>From</th><th>To</th><th>When</th></tr></thead>
              <tbody>${detail.history.map((item) => `<tr><td>${escapeHtml(item.previousState)}</td><td>${escapeHtml(item.newState)}</td><td>${escapeHtml(item.timestamp || "")}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        ` : ""}
      </div>
    ` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Provider health</h2></div>
      ${rowsOrEmpty(health, "Providers have not been seeded.", (rows) => `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Provider</th><th>Health</th><th>Failures</th><th>Last error</th></tr></thead>
            <tbody>
              ${rows.map((item) => `
                <tr>
                  <td>${escapeHtml(item.providerId)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td>${item.consecutiveFailures || 0}</td>
                  <td>${escapeHtml(item.lastError || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `)}
    </div>
  `;
}

export function renderPaymentAccountingExtras({
  settlements = [],
  reconciliations = [],
  refunds = [],
  reversals = [],
  canReconcile = false,
  canRefund = false
} = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Payment reconciliation workspace</h2></div>
      <p class="muted">Existing trial balance and bank rec above stay as they are. This workspace matches provider statements to payment-engine records without changing collection math.</p>
      ${canReconcile ? `
        <form id="paymentReconcileForm" class="form-grid">
          <div class="field full"><label>Statement lines (reference,amount per line)</label><textarea name="lines" rows="4" placeholder="MTN123456,50.00"></textarea></div>
          <div class="field"><label>Source</label><select name="source">${optionList(["momo", "bank", "provider"], "momo")}</select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Match statement</button></div>
        </form>
      ` : `<div class="notice">Reconciliation is limited to accounting and branch roles.</div>`}
      ${rowsOrEmpty(reconciliations.slice(-8).reverse(), "No reconciliation runs yet.", (rows) => `
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>Source</th><th>Matched</th><th>Exceptions</th></tr></thead>
            <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.source)}</td><td>${item.matched || 0}</td><td>${item.exceptions || 0}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `)}
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Settlement manager</h2></div>
        ${canReconcile ? `
          <form id="paymentSettlementForm" class="form-grid">
            <div class="field"><label>Provider</label><select name="providerId">${optionList(["prov-mtn", "prov-telecel", "prov-airteltigo", "prov-bank"], "prov-mtn")}</select></div>
            <div class="field"><label>Gross</label><input name="grossAmount" type="number" min="0" step="0.01" required /></div>
            <div class="field"><label>Fees</label><input name="fees" type="number" min="0" step="0.01" value="0" /></div>
            <div class="field"><label>Taxes</label><input name="taxes" type="number" min="0" step="0.01" value="0" /></div>
            <div class="field"><label>Settlement date</label><input name="settlementDate" type="date" /></div>
            <div class="field"><label>Reference</label><input name="settlementReference" /></div>
            <div class="form-actions full"><button class="btn" type="submit">Record settlement</button></div>
          </form>
        ` : ""}
        ${rowsOrEmpty(settlements.slice(-8).reverse(), "No settlements recorded.", (rows) => `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Date</th><th>Net</th><th>Status</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.settlementDate)}</td><td>${money(item.netSettlement)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Refunds & reversals</h2></div>
        <p class="muted">${canRefund ? "Linked compensating records only." : "View only."} Original payment rows stay immutable.</p>
        ${rowsOrEmpty([...(refunds || []).map((item) => ({ ...item, kind: "Refund" })), ...(reversals || []).map((item) => ({ ...item, kind: "Reversal" }))].slice(-12).reverse(), "No refunds or reversals.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Kind</th><th>Payment</th><th>Amount</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.paymentId)}</td><td>${money(item.amount)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
  `;
}

export function renderPaymentProviderExtras({
  providers = [],
  methods = [],
  canManage = false
} = {}) {
  if (!canManage) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Payment providers</h2></div>
      <p class="muted">MoMo Webhook Secret in System Controls above stays the live callback secret. Provider adapters are plug-ins. API secrets must not be bundled into the Android APK.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Provider</th><th>Status</th><th>Priority</th><th>Methods</th></tr></thead>
          <tbody>
            ${providers.map((item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.status)}</td>
                <td>${item.priority || ""}</td>
                <td>${escapeHtml((item.methods || []).join(", "))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <form id="paymentMethodToggleForm" class="form-grid" style="margin-top:16px">
        <div class="field"><label>Method</label><select name="methodId">${optionList(methods.map((item) => ({ value: item.id, label: item.name })), methods[0]?.id || "")}</select></div>
        <div class="field"><label>Enabled</label><select name="enabled">${optionList([{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }], "true")}</select></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Update method</button></div>
      </form>
    </div>
  `;
}

export function renderPaymentReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Payment reports</h2></div>
      <p class="muted">Daily Money Received and collection reports above are unchanged. These exports are from the payment engine.</p>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-payment-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
