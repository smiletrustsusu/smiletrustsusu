/**
 * Fast field-collection UI: desk cards, customer card, keypad, bulk entry.
 */
import { formatGhs } from "../core/money.js";
import { COLLECTION_METHODS, MISSED_REASONS } from "../core/collection-ops.js";

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

export function renderCollectionDesk(desk) {
  const online = typeof navigator === "undefined" || navigator.onLine;
  return `
    <div class="panel collection-desk">
      <div class="section-title">
        <h2>Today's Collection</h2>
        <span class="pill ${online ? "good" : "bad"}" id="collectionOfflineIcon">${online ? "Online" : "Offline"}</span>
      </div>
      <div class="grid four">
        <div class="stat"><small>Assigned customers</small><strong>${desk.assignedToday ?? desk.assignedCustomers ?? 0}</strong></div>
        <div class="stat"><small>Today's target</small><strong>${money(desk.target ?? desk.expectedTotal ?? 0)}</strong><span>${money(desk.collectionsToday || 0)} collected</span></div>
        <div class="stat"><small>Remaining</small><strong>${money(desk.remaining || 0)}</strong></div>
        <div class="stat"><small>Visited / missed / sync</small><strong>${desk.visited || 0} / ${desk.missedCount || 0} / ${desk.pendingSync || 0}</strong></div>
      </div>
      <div class="agent-progress" style="margin-top:12px">
        <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${desk.progressPercent || 0}%"></div></div>
        <small>${desk.progressPercent || 0}% of today's target</small>
      </div>
    </div>
  `;
}

export function renderCollectionCustomerCard(card) {
  if (!card) return `<div class="empty">Select a customer to collect.</div>`;
  return `
    <article class="collection-card">
      ${card.photo ? `<img class="collection-card-photo" src="${escapeAttr(card.photo)}" alt="" />` : `<div class="collection-card-photo placeholder">Photo</div>`}
      <div>
        <h3>${escapeHtml(card.name)}</h3>
        <p class="muted">${escapeHtml(card.customerNumber)} · ${escapeHtml(card.phone)}</p>
        <p>${escapeHtml(card.productName)} · Agent ${escapeHtml(card.agentName || "—")}</p>
        <div class="grid two">
          <div class="stat"><small>Balance</small><strong>${money(card.balance)}</strong></div>
          <div class="stat"><small>Expected</small><strong>${money(card.expected)}</strong></div>
        </div>
        <p class="muted">Last collection ${escapeHtml(card.lastCollection || "—")}</p>
        <span class="pill ${card.status === "Collected" ? "" : card.overdue ? "bad" : "warn"}">${escapeHtml(card.status)}</span>
      </div>
    </article>
  `;
}

export function renderAmountKeypad() {
  return `
    <div class="collection-keypad" id="collectionKeypad">
      ${["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((key) =>
        `<button type="button" class="btn ghost keypad-key" data-keypad="${escapeAttr(key)}">${key}</button>`
      ).join("")}
    </div>
  `;
}

export function renderCollectionFilters(agents = [], groups = [], products = []) {
  return `
    <div class="crm-filters collection-filters">
      <input id="collectionFrom" type="date" />
      <input id="collectionTo" type="date" />
      <select id="collectionMethodFilter">
        <option value="">All methods</option>
        ${COLLECTION_METHODS.map((method) => `<option value="${method}">${method}</option>`).join("")}
      </select>
      <select id="collectionAgentFilter">
        <option value="">All agents</option>
        ${agents.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}
      </select>
      <select id="collectionBranchFilter">
        <option value="">All branches</option>
        ${groups.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}
      </select>
      <select id="collectionProductFilter">
        <option value="">All products</option>
        ${products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function renderBulkCollectionForm(customers = []) {
  if (!customers.length) return `<div class="empty">No pending assigned customers for bulk entry.</div>`;
  return `
    <form id="bulkCollectionForm">
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Customer</th><th>Expected</th><th>Amount</th></tr></thead>
          <tbody>
            ${customers.map((card) => `
              <tr>
                <td><input type="checkbox" name="bulkId" value="${escapeAttr(card.id)}" checked /></td>
                <td>${escapeHtml(card.name)}<br><span class="muted">${escapeHtml(card.customerNumber)}</span></td>
                <td>${money(card.expected)}</td>
                <td><input name="bulkAmount_${card.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${card.expected || ""}" /></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="form-actions" style="margin-top:12px">
        <button class="btn" type="submit">Save selected collections</button>
      </div>
    </form>
  `;
}

export function renderCollectionAnalyticsPanel(stats) {
  return `
    <div class="panel">
      <div class="section-title"><h2>Collection Analytics</h2></div>
      <div class="grid four">
        <div class="stat"><small>Total</small><strong>${money(stats.total)}</strong></div>
        <div class="stat"><small>Transactions</small><strong>${stats.count}</strong></div>
        <div class="stat"><small>Average</small><strong>${money(stats.average)}</strong></div>
        <div class="stat"><small>Success rate</small><strong>${stats.successRate}%</strong></div>
      </div>
    </div>
  `;
}

export function paymentMethodOptions(selected = "Cash") {
  return COLLECTION_METHODS.map((method) => `<option value="${escapeAttr(method)}" ${method === selected ? "selected" : ""}>${escapeHtml(method)}</option>`).join("");
}

export function missedReasonOptions(selected = "") {
  return [`<option value="">Paid / no miss reason</option>`]
    .concat(MISSED_REASONS.map((reason) => `<option value="${escapeAttr(reason)}" ${reason === selected ? "selected" : ""}>${escapeHtml(reason)}</option>`))
    .join("");
}

export function renderCollectionSwipe(hasPrev, hasNext) {
  return `
    <div class="collection-swipe">
      <button type="button" class="btn ghost" id="collectionPrevCustomer" ${hasPrev ? "" : "disabled"}>Prev</button>
      <button type="button" class="btn ghost" id="collectionNextCustomer" ${hasNext ? "" : "disabled"}>Next</button>
    </div>
  `;
}

export function renderBalanceBreakdown(breakdown) {
  if (!breakdown) return "";
  return `
    <div class="calc-list collection-balance">
      <div><span>Opening</span><strong>${money(breakdown.opening)}</strong></div>
      <div><span>Deposits</span><strong>${money(breakdown.deposit)}</strong></div>
      <div><span>Interest</span><strong>${money(breakdown.interest)}</strong></div>
      <div><span>Charges</span><strong>${money(breakdown.charges)}</strong></div>
      <div><span>Penalties</span><strong>${money(breakdown.penalties)}</strong></div>
      <div><span>Current / available</span><strong>${money(breakdown.current)} / ${money(breakdown.available)}</strong></div>
      <div><span>Projected maturity</span><strong>${money(breakdown.projected)}</strong></div>
    </div>
  `;
}

export function renderMissedCollectionTable(rows = []) {
  if (!rows.length) return `<div class="empty">No missed collections in this view.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th>Receipt</th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.reason)}</td><td>${escapeHtml(row.receiptNo)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAdjustmentQueue(rows = []) {
  if (!rows.length) return "";
  return `
    <div class="panel">
      <div class="section-title"><h2>Pending Adjustments</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Collection</th><th>Amount</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.collectionId)}</td>
                <td>${money(row.amount)}</td>
                <td>${escapeHtml(row.reason)}</td>
                <td><button class="btn" type="button" data-approve-adjustment="${escapeAttr(row.id)}">Approve</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
