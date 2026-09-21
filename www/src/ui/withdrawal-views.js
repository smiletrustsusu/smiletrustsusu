/**
 * Extra withdrawal dashboard, preview, filters, and analytics.
 * The existing Smile Trust Withdrawal Form stays in app.js.
 */
import { formatGhs } from "../core/money.js";
import { WITHDRAWAL_TYPES, WITHDRAWAL_METHODS } from "../core/withdrawal-ops.js";

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
    const value = item.value ?? item;
    const label = item.label ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function renderWithdrawalDashboard(dash = {}, maturedCount = 0) {
  return `
    <div class="grid four" style="margin-bottom:18px">
      <div class="stat"><small>Pending requests</small><strong>${dash.pendingRequests || 0}</strong><span>${money(dash.outstandingRequests || 0)} outstanding</span></div>
      <div class="stat"><small>Paid today</small><strong>${dash.paidToday || 0}</strong><span>${money(dash.paidTodayAmount || 0)}</span></div>
      <div class="stat"><small>Approved today</small><strong>${dash.approvedToday || 0}</strong><span>${dash.rejectedRequests || 0} rejected</span></div>
      <div class="stat"><small>Emergency / matured</small><strong>${dash.emergencyWithdrawals || 0} / ${maturedCount}</strong><span>Fees ${money(dash.feesCollected || 0)}</span></div>
    </div>
  `;
}

export function renderWithdrawalFormExtras({ type = "Normal Withdrawal", method = "Cash", balance = 0, held = 0 } = {}) {
  return `
    <div class="field"><label>Withdrawal type</label><select name="withdrawalType">${optionList(WITHDRAWAL_TYPES, type)}</select></div>
    <div class="field"><label>Payment method</label><select name="paymentMethod">${optionList(WITHDRAWAL_METHODS, method)}</select></div>
    <div class="field"><label>Available balance</label><input id="withdrawAvailableBalance" readonly value="${escapeAttr(Number(balance || 0).toFixed(2))}" /></div>
    <div class="field"><label>Held / pending</label><input readonly value="${escapeAttr(Number(held || 0).toFixed(2))}" /></div>
    <div class="field full"><label>Payment reference (MoMo / bank)</label><input name="paymentReference" placeholder="Required for electronic payouts" /></div>
  `;
}

export function renderEligibilityNotice(eligibility) {
  if (!eligibility) return "";
  const items = (eligibility.checks || []).map((item) =>
    `<li class="${item.ok ? "" : "bad"}">${item.ok ? "✓" : "✕"} ${escapeHtml(item.message)}</li>`
  ).join("");
  return `
    <div class="notice ${eligibility.ok ? "" : "warn"}" id="withdrawalEligibilityBox">
      <strong>${eligibility.ok ? "Eligible" : "Not eligible"}</strong>
      ${eligibility.usable != null ? `<span class="muted"> · Usable ${money(eligibility.usable)} · Remaining ${money(eligibility.remaining)}</span>` : ""}
      <ul class="mini-list">${items}</ul>
    </div>
  `;
}

export function renderWithdrawalCustomerPreview(card) {
  if (!card) return "";
  return `
    <div class="notice" id="withdrawalCustomerPreview">
      <strong>${escapeHtml(card.name || "")}</strong>
      <span class="muted"> · ${escapeHtml(card.customerNumber || "")} · ${escapeHtml(card.branchName || "")}</span>
      <div>Agent ${escapeHtml(card.agentName || "—")} · Product ${escapeHtml(card.productName || "—")}</div>
      <div>Balance ${money(card.balance || 0)} · Held ${money(card.held || 0)}</div>
    </div>
  `;
}

export function renderWithdrawalFilters(users = [], groups = []) {
  return `
    <div class="crm-filters" id="withdrawalFilters">
      <input id="withdrawalSearch" placeholder="Search number, receipt, member" />
      <select id="withdrawalStatusFilter">
        <option value="">All statuses</option>
        ${["Requested", "Verified", "Approved", "Paid", "Rejected", "Cancelled", "Reversed"].map((status) => `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`).join("")}
      </select>
      <select id="withdrawalTypeFilter">
        <option value="">All types</option>
        ${WITHDRAWAL_TYPES.map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`).join("")}
      </select>
      <select id="withdrawalMethodFilter">
        <option value="">All methods</option>
        ${WITHDRAWAL_METHODS.map((method) => `<option value="${escapeAttr(method)}">${escapeHtml(method)}</option>`).join("")}
      </select>
      <select id="withdrawalOfficerFilter">
        <option value="">All officers</option>
        ${users.map((user) => `<option value="${escapeAttr(user.id)}">${escapeHtml(user.name)}</option>`).join("")}
      </select>
      <select id="withdrawalBranchFilter">
        <option value="">All locations</option>
        ${groups.map((group) => `<option value="${escapeAttr(group.id)}">${escapeHtml(group.name)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function renderMaturedAccounts(rows = []) {
  if (!rows.length) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Matured Savings</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Maturity</th><th>Principal</th><th>Interest</th><th>Net payable</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.accountNo || row.id)}</td>
                <td>${escapeHtml(row.preview?.maturityDate || "")}</td>
                <td>${money(row.preview?.principal || 0)}</td>
                <td>${money(row.preview?.interestEarned || 0)}</td>
                <td>${money(row.preview?.netAmount || 0)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderWithdrawalAnalyticsPanel(analytics = {}) {
  const types = Object.entries(analytics.byType || {});
  if (!types.length && !analytics.outflow) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Withdrawal Analytics</h2></div>
      <div class="calc-list">
        <div><span>Total cash outflow</span><strong>${money(analytics.outflow || 0)}</strong></div>
        <div><span>Fees collected</span><strong>${money(analytics.fees || 0)}</strong></div>
        ${types.slice(0, 8).map(([type, amount]) => `<div><span>${escapeHtml(type)}</span><strong>${money(amount)}</strong></div>`).join("")}
      </div>
    </div>
  `;
}

export function renderWithdrawalReceiptPreview(model) {
  if (!model) return "";
  return `
    <div class="panel" id="withdrawalReceiptPreview">
      <div class="section-title"><h2>Receipt preview</h2></div>
      <p><strong>${escapeHtml(model.receiptNo)}</strong> · ${escapeHtml(model.withdrawalType)}</p>
      <p>${escapeHtml(model.customerName)} · ${money(model.netAmount)}</p>
      <div>${model.barcode || ""}</div>
      <div style="max-width:120px">${model.qr || ""}</div>
    </div>
  `;
}

export function renderWithdrawalTimeline(history = []) {
  if (!history.length) return `<div class="empty">No workflow history yet.</div>`;
  return `
    <ol class="mini-list">
      ${history.map((item) => `<li>${escapeHtml(item.previousStatus || "")} → <strong>${escapeHtml(item.newStatus || item.status || "")}</strong> · ${escapeHtml((item.at || "").replace("T", " ").slice(0, 19))}</li>`).join("")}
    </ol>
  `;
}
