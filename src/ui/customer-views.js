/**
 * Customer CRM UI: registration extras, profile dashboard, analytics, membership card.
 */
import { formatGhs } from "../core/money.js";
import { qrSvg, barcodeSvg } from "../core/receipt-codes.js";
import {
  CRM_STATUSES,
  ID_TYPES,
  CUSTOMER_CATEGORIES,
  NOTE_TYPES,
  KYC_VERIFICATION,
  CRM_MESSAGE_TEMPLATES
} from "../core/customer-crm.js";
import { KYC_DOC_TYPES } from "../core/customer-kyc.js";
import { districtSelectOptionsHtml, regionSelectOptionsHtml } from "../core/ghana-geo.js";

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

function optionList(values, selected) {
  return values.map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

export function renderCustomerCrmFormExtras(editing = {}) {
  return `
    <div class="section-title full"><h3>Contact &amp; identification</h3></div>
    <div class="field"><label>Email</label><input name="email" type="email" value="${escapeAttr(editing.email || "")}" /></div>
    <div class="field"><label>Region</label>
      <select name="region" id="customerRegionSelect">
        ${regionSelectOptionsHtml(editing.region || "", escapeAttr)}
      </select>
    </div>
    <div class="field"><label>District</label>
      <select name="district" id="customerDistrictSelect">
        ${districtSelectOptionsHtml(editing.region || "", editing.district || "", escapeAttr)}
      </select>
    </div>
    <div class="field"><label>Town / Community</label><input name="town" value="${escapeAttr(editing.town || "")}" /></div>
    <div class="field full"><label>Postal Address</label><input name="postalAddress" value="${escapeAttr(editing.postalAddress || "")}" /></div>
    <div class="field full"><label>Employer Address</label><input name="employerAddress" value="${escapeAttr(editing.employerAddress || "")}" /></div>
    <div class="field"><label>ID Type</label><select name="idType">${optionList(ID_TYPES, editing.idType || "Ghana Card")}</select></div>
    <div class="field"><label>ID Number</label><input name="idNumber" value="${escapeAttr(editing.idNumber || editing.ghanaCard || "")}" /></div>
    <div class="field"><label>ID Expiry</label><input name="idExpiry" type="date" value="${escapeAttr(editing.idExpiry || "")}" /></div>
    <div class="field"><label>ID Front Image</label><input name="idFrontFile" type="file" accept="image/jpeg,image/png,application/pdf" /></div>
    <div class="field"><label>ID Back Image</label><input name="idBackFile" type="file" accept="image/jpeg,image/png,application/pdf" /></div>
    <div class="field"><label>Customer Category</label><select name="category">${optionList(CUSTOMER_CATEGORIES, editing.category || "Individual")}</select></div>
    <div class="field"><label>Collection Route</label><input name="collectionRoute" value="${escapeAttr(editing.collectionRoute || "")}" /></div>
    <div class="field"><label>Membership Number</label><input name="membershipNumber" value="${escapeAttr(editing.membershipNumber || editing.customerNumber || "")}" placeholder="Auto if blank" /></div>
    <div class="field"><label>KYC Status</label><select name="kycStatus">${optionList(KYC_VERIFICATION, editing.kycStatus || "Pending")}</select></div>
  `;
}

export function statusBadge(customer) {
  const status = customer.memberStatus || (customer.active === false ? "Closed" : "Active");
  const tone = status === "Active" ? "" : status === "Pending Verification" ? "warn" : "bad";
  const verified = customer.kycStatus === "Verified" ? `<span class="pill good">Verified</span>` : customer.kycStatus === "Rejected" ? `<span class="pill bad">KYC Rejected</span>` : `<span class="pill warn">KYC Pending</span>`;
  return `<span class="pill ${tone}">${escapeHtml(status)}</span> ${verified}`;
}

export function renderCustomerAnalyticsPanel(stats) {
  return `
    <div class="panel crm-analytics">
      <div class="section-title"><h2>Customer Analytics</h2></div>
      <div class="grid four">
        <div class="stat"><small>Total customers</small><strong>${stats.total}</strong></div>
        <div class="stat"><small>Active</small><strong>${stats.active}</strong></div>
        <div class="stat"><small>Dormant / suspended</small><strong>${stats.dormant}</strong></div>
        <div class="stat"><small>New this month</small><strong>${stats.newThisMonth}</strong></div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <div><small>By branch</small>${miniBars(stats.byBranch)}</div>
        <div><small>By agent</small>${miniBars(stats.byAgent)}</div>
        <div><small>By product</small>${miniBars(stats.byProduct)}</div>
        <div><small>Gender / age</small>${miniBars(stats.byGender)}${miniBars(stats.byAge)}</div>
      </div>
    </div>
  `;
}

function miniBars(rows = []) {
  if (!rows.length) return `<div class="empty">No data.</div>`;
  const max = Math.max(1, ...rows.map((row) => row.count));
  return `<div class="dash-bar-chart">${rows.slice(0, 5).map((row) => `
    <div class="dash-bar-row">
      <div class="dash-bar-label">${escapeHtml(row.label)}</div>
      <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${((row.count / max) * 100).toFixed(1)}%"></div></div>
      <div class="dash-bar-value">${row.count}</div>
    </div>`).join("")}</div>`;
}

export function renderCustomerProfileExtras({
  customer,
  stats,
  timeline = [],
  documents = [],
  notes = [],
  accounts = [],
  products = [],
  withdrawals = [],
  groups = [],
  productName = () => "",
  agentName = "",
  branchName = "",
  canVerify = false
}) {
  return `
    <div class="grid four crm-profile-stats">
      <div class="stat"><small>Total savings</small><strong>${money(stats.totalSavings)}</strong></div>
      <div class="stat"><small>Today's contribution</small><strong>${money(stats.todayContribution)}</strong></div>
      <div class="stat"><small>Monthly contribution</small><strong>${money(stats.monthlyContribution)}</strong></div>
      <div class="stat"><small>Transactions</small><strong>${stats.transactions}</strong></div>
      <div class="stat"><small>Loan balance</small><strong>${money(stats.loanBalance)}</strong></div>
      <div class="stat"><small>Total withdrawals</small><strong>${money(stats.totalWithdrawals)}</strong></div>
      <div class="stat"><small>Active accounts</small><strong>${stats.activeAccounts}</strong></div>
      <div class="stat"><small>Group memberships</small><strong>${stats.groupCount}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Assignment & KYC</h2>${statusBadge(customer)}</div>
      <table>
        <tr><td>Customer number</td><td>${escapeHtml(customer.customerNumber || "—")}</td></tr>
        <tr><td>Membership number</td><td>${escapeHtml(customer.membershipNumber || customer.customerNumber || "—")}</td></tr>
        <tr><td>Assigned agent</td><td>${escapeHtml(agentName || "—")}</td></tr>
        <tr><td>Assigned branch</td><td>${escapeHtml(branchName || "—")}</td></tr>
        <tr><td>Category / route</td><td>${escapeHtml(customer.category || "Individual")} · ${escapeHtml(customer.collectionRoute || "—")}</td></tr>
        <tr><td>ID</td><td>${escapeHtml(customer.idType || "Ghana Card")} · ${escapeHtml(customer.idNumber || customer.ghanaCard || "—")}</td></tr>
        <tr><td>Email / WhatsApp</td><td>${escapeHtml(customer.email || "—")} · ${escapeHtml(customer.whatsapp || customer.phone || "")}</td></tr>
        <tr><td>QR / barcode</td><td>
          <div class="crm-card-codes">
            ${qrSvg(`ST-CUST|${customer.customerNumber || customer.accountNo || customer.id}|${customer.name || ""}`, { size: 84 })}
            ${barcodeSvg(customer.accountNo || customer.customerNumber || customer.id, { width: 140, height: 36 })}
          </div>
        </td></tr>
      </table>
      ${canVerify ? `
        <div class="row-actions" style="margin-top:12px">
          <button class="btn" type="button" data-kyc-verify="Verified">Mark verified</button>
          <button class="btn secondary" type="button" data-kyc-verify="Rejected">Reject KYC</button>
          <button class="btn ghost" type="button" data-kyc-verify="Pending">Reset pending</button>
        </div>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Savings Accounts</h2></div>
      ${accounts.length ? `<div class="table-wrap"><table><thead><tr><th>Product</th><th>Status</th><th>Opened</th></tr></thead><tbody>
        ${accounts.map((item) => `<tr><td>${escapeHtml(productName(item.productId))}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml((item.openedAt || "").slice(0, 10))}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Primary product: ${escapeHtml(productName(customer.savingsProductId) || "None")}</div>`}
      ${products.length ? `
        <form id="customerAccountForm" class="form-grid" style="margin-top:12px">
          <input type="hidden" name="customerId" value="${escapeAttr(customer.id)}" />
          <div class="field"><label>Open another savings product</label>
            <select name="productId">${products.map((product) => `<option value="${escapeAttr(product.id)}">${escapeHtml(product.name)}</option>`).join("")}</select>
          </div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Add savings account</button></div>
        </form>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Beneficiaries</h2></div>
      ${(customer.beneficiaries || []).length ? `<ul>${customer.beneficiaries.map((item) => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.relationship || "")} · ${item.sharePercent || 0}%</li>`).join("")}</ul>` : `<div class="empty">No beneficiaries recorded.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Documents</h2></div>
      <form id="customerDocumentForm" class="form-grid">
        <input type="hidden" name="customerId" value="${escapeAttr(customer.id)}" />
        <div class="field"><label>Document type</label><select name="type">${optionList(KYC_DOC_TYPES, "Ghana Card")}</select></div>
        <div class="field"><label>Reference</label><input name="reference" placeholder="ID / file reference" /></div>
        <div class="field full"><label>File (JPEG, PNG, PDF · max 2 MB)</label><input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Upload document</button></div>
      </form>
      ${documents.length ? documents.map((doc) => `<div class="crm-doc">${escapeHtml(doc.type)} · ${escapeHtml(doc.reference || doc.fileName || "")} <small>${escapeHtml((doc.uploadedAt || "").slice(0, 10))}</small></div>`).join("") : `<div class="empty">No KYC documents uploaded yet.</div>`}
      ${(customer.idFrontImage || customer.idBackImage) ? `<p class="muted">ID images captured on registration.</p>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Group Membership</h2></div>
      ${groups.length ? `<ul>${groups.map((group) => `<li>${escapeHtml(group.name)} · ${escapeHtml(group.status || "Active")}</li>`).join("")}</ul>` : `<div class="empty">Not assigned to a susu group cycle.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Withdrawals</h2></div>
      ${withdrawals.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${withdrawals.map((item) => `<tr><td>${escapeHtml(item.date || (item.createdAt || "").slice(0, 10))}</td><td>${money(item.amount)}</td><td>${escapeHtml(item.status || "")}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No withdrawal requests for this customer.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Communication</h2></div>
      <form id="customerMessageForm" class="form-grid">
        <input type="hidden" name="customerId" value="${escapeAttr(customer.id)}" />
        <div class="field"><label>Template</label>
          <select name="templateId">${CRM_MESSAGE_TEMPLATES.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Channel</label>
          <select name="channel"><option>SMS</option><option>WhatsApp</option><option>Email</option><option>Push</option></select>
        </div>
        <div class="field full"><label>Message</label><textarea name="body" rows="3">${escapeHtml(CRM_MESSAGE_TEMPLATES[0].body)}</textarea></div>
        <div class="form-actions full row-actions">
          <button class="btn secondary" type="submit">Queue / send</button>
          <a class="btn ghost" id="customerWhatsAppLink" target="_blank" rel="noopener">Open WhatsApp</a>
        </div>
      </form>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Staff Notes</h2></div>
      <form id="customerNoteForm" class="form-grid">
        <input type="hidden" name="customerId" value="${escapeAttr(customer.id)}" />
        <div class="field"><label>Note type</label><select name="type">${optionList(NOTE_TYPES, "General")}</select></div>
        <div class="field full"><label>Note</label><textarea name="body" required placeholder="Visited customer, complaint, loan discussion..."></textarea></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Save note</button></div>
      </form>
      ${notes.length ? notes.slice(0, 8).map((note) => `<article class="crm-note"><strong>${escapeHtml(note.type)}</strong><p>${escapeHtml(note.body)}</p><small>${escapeHtml(note.userName || "")} · ${escapeHtml((note.createdAt || "").replace("T", " ").slice(0, 16))}</small></article>`).join("") : `<div class="empty">No notes yet.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Relationship Timeline</h2></div>
      ${timeline.length ? `<div class="dash-activity">${timeline.map((row) => `<article><strong>${escapeHtml(row.action)}</strong><p>${escapeHtml(row.detail || "")}</p><small>${escapeHtml((row.at || "").replace("T", " ").slice(0, 16))} · ${escapeHtml(row.user || "")}</small></article>`).join("")}</div>` : `<div class="empty">No timeline events.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Audit History</h2></div>
      ${(customer.statusHistory || []).length ? `<ul>${customer.statusHistory.slice(0, 10).map((item) => `<li>${escapeHtml(item.from)} → ${escapeHtml(item.to)} · ${escapeHtml((item.at || "").replace("T", " ").slice(0, 16))}</li>`).join("")}</ul>` : `<div class="empty">No status changes recorded.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Statement & Card</h2></div>
      <form id="customerStatementForm" class="form-grid">
        <input type="hidden" name="customerId" value="${escapeAttr(customer.id)}" />
        <div class="field"><label>From</label><input name="from" type="date" /></div>
        <div class="field"><label>To</label><input name="to" type="date" /></div>
        <div class="form-actions full row-actions">
          <button class="btn" type="submit">Print statement</button>
          <button class="btn secondary" type="button" data-export-statement="${customer.id}">Export Excel / CSV</button>
          <button class="btn ghost" type="button" data-share-statement="whatsapp">Share WhatsApp</button>
          <button class="btn ghost" type="button" data-share-statement="email">Share Email</button>
          <button class="btn ghost" type="button" data-print-card="${customer.id}">Print membership card</button>
        </div>
      </form>
    </div>
  `;
}

export function renderMembershipCardHtml(card) {
  return `
    <section class="crm-card">
      <header>
        <img src="assets/smile-trust-logo.png" alt="" />
        <strong>${escapeHtml(card.businessName)}</strong>
      </header>
      <div class="crm-card-body">
        ${card.photo ? `<img class="crm-card-photo" src="${escapeAttr(card.photo)}" alt="" />` : `<div class="crm-card-photo placeholder">Photo</div>`}
        <div>
          <h2>${escapeHtml(card.name)}</h2>
          <p>${escapeHtml(card.customerNumber)}</p>
          <p>${escapeHtml(card.branch)} · ${escapeHtml(card.agent)}</p>
          <p>Member since ${escapeHtml(card.memberSince || "")}</p>
        </div>
        <div class="crm-card-codes">
          ${qrSvg(card.qrValue, { size: 92 })}
          ${barcodeSvg(card.accountNo || card.customerNumber, { width: 140, height: 36 })}
        </div>
      </div>
    </section>
  `;
}

export function renderCustomerFilters(agents = [], groups = []) {
  return `
    <div class="crm-filters">
      <select id="customerStatusFilter">
        <option value="">All statuses</option>
        ${CRM_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
      <select id="customerBranchFilter">
        <option value="">All branches</option>
        ${groups.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}
      </select>
      <select id="customerAgentFilter">
        <option value="">All agents</option>
        ${agents.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}
      </select>
      <button class="btn ghost" type="button" id="exportCustomersBtn">Export CSV</button>
      <label class="btn ghost crm-import-label">Import CSV<input type="file" id="importCustomersInput" accept=".csv,.xlsx,.xls" hidden /></label>
    </div>
  `;
}

export function renderCustomerBulkBar(agents = [], groups = [], canHardDelete = false) {
  return `
    <div class="crm-bulk" id="customerBulkBar">
      <label><input type="checkbox" id="selectAllCustomers" /> Select page</label>
      <select id="bulkAgentId">
        <option value="">Assign agent…</option>
        ${agents.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}
      </select>
      <select id="bulkBranchId">
        <option value="">Transfer branch…</option>
        ${groups.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}
      </select>
      <button class="btn secondary" type="button" id="bulkAssignBtn">Apply assignment</button>
      <button class="btn ghost" type="button" id="bulkSuspendBtn">Suspend selected</button>
      ${canHardDelete ? `<button class="btn danger" type="button" id="bulkDeleteBtn">Delete selected</button>` : ""}
    </div>
  `;
}

export function renderCustomerPager({ page, pages, total }) {
  if (total <= 50) return "";
  return `
    <div class="crm-pager">
      <button class="btn ghost" type="button" data-customer-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${pages} · ${total} customers</span>
      <button class="btn ghost" type="button" data-customer-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button>
    </div>
  `;
}

export { CRM_STATUSES, KYC_DOC_TYPES };
