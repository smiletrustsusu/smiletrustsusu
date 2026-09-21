/**
 * Extra Ghana accounting panels. Existing trial balance / journal form stay in renderAccounting.
 */
import { formatGhs } from "../core/money.js";
import { TAX_CATEGORIES, TAX_METHODS, TAX_STATUSES } from "../core/tax-engine.js";

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
  return items.map((item) => `<option value="${escapeAttr(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

export function renderAccountingExtras({
  fiscal,
  periods = [],
  closeCheck,
  cashFlow,
  taxes = [],
  taxTotals,
  canClose = false,
  canTax = false
} = {}) {
  return `
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Ghana Fiscal Year</h2></div>
        <p class="muted">Default currency GHS · Accra calendar year unless settings change the start date.</p>
        <div class="calc-list">
          <div><span>Fiscal year</span><strong>${escapeHtml(fiscal?.from || "")} → ${escapeHtml(fiscal?.to || "")}</strong></div>
          <div><span>Cash inflow</span><strong>${money(cashFlow?.inflow || 0)}</strong></div>
          <div><span>Cash outflow</span><strong>${money(cashFlow?.outflow || 0)}</strong></div>
          <div><span>Net cash</span><strong>${money(cashFlow?.net || 0)}</strong></div>
        </div>
        ${canClose ? `
          <form id="closePeriodForm" class="form-grid" style="margin-top:16px">
            <div class="field"><label>Close from</label><input name="from" type="date" value="${escapeAttr(fiscal?.from || "")}" required /></div>
            <div class="field"><label>Close to</label><input name="to" type="date" value="${escapeAttr(fiscal?.to || "")}" required /></div>
            <div class="field full"><label>Reason</label><input name="reason" placeholder="Year-end close" /></div>
            <div class="form-actions full"><button class="btn warning" type="submit">Close period</button></div>
          </form>
          ${closeCheck && !closeCheck.ok ? `<div class="notice warn">${escapeHtml((closeCheck.errors || []).join(" · "))}</div>` : ""}
        ` : `<div class="notice">Period close is limited to Accountant / Owner roles.</div>`}
        ${periods.length ? `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>From</th><th>To</th><th>Status</th></tr></thead>
              <tbody>${periods.map((item) => `<tr><td>${item.from}</td><td>${item.to}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        ` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Tax configuration</h2></div>
        <p class="muted">Calculates and accounts for tax only. Does not file GRA returns or submit to government systems.</p>
        <div class="calc-list">
          <div><span>Tax collected (posted)</span><strong>${money(taxTotals?.total || 0)}</strong></div>
        </div>
        ${canTax ? `
          <form id="taxDefinitionForm" class="form-grid" style="margin-top:16px">
            <div class="field"><label>Code</label><input name="code" required placeholder="VAT" /></div>
            <div class="field"><label>Name</label><input name="name" required placeholder="Value Added Tax" /></div>
            <div class="field"><label>Category</label><select name="category">${optionList(TAX_CATEGORIES, "VAT")}</select></div>
            <div class="field"><label>Method</label><select name="method">${optionList(TAX_METHODS, "Percentage")}</select></div>
            <div class="field"><label>Rate</label><input name="rate" type="number" min="0" step="0.01" value="0" /></div>
            <div class="field"><label>Status</label><select name="status">${optionList(TAX_STATUSES, "Draft")}</select></div>
            <div class="field"><label>Effective</label><input name="effectiveDate" type="date" /></div>
            <div class="field"><label>Expiry</label><input name="expiryDate" type="date" /></div>
            <div class="field full"><label>Reason for change</label><input name="reason" placeholder="New rate" /></div>
            <div class="form-actions full"><button class="btn" type="submit">Save tax</button></div>
          </form>
        ` : `<div class="notice">Only Settings or Accounting editors can change tax rates.</div>`}
        ${taxes.length ? `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Code</th><th>Rate</th><th>Status</th><th>Ver</th></tr></thead>
              <tbody>${taxes.map((tax) => `<tr><td>${escapeHtml(tax.code)}</td><td>${tax.rate}</td><td>${escapeHtml(tax.status)}</td><td>${tax.version || 1}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        ` : `<div class="empty">No taxes configured — transactions are not taxed.</div>`}
      </div>
    </div>
  `;
}
