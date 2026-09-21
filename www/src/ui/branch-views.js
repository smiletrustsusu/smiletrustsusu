/**
 * Branch Management screens: registration, list, dashboard, profile extras.
 */
import { formatGhs } from "../core/money.js";
import {
  BRANCH_STATUSES,
  BRANCH_TYPES,
  BRANCH_DOC_TYPES,
  ANNOUNCEMENT_TYPES,
  CALENDAR_TYPES,
  TRANSFER_KINDS,
  APPROVAL_KEYS
} from "../core/branch-ops.js";

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

function staffSelect(name, users = [], selected = "", blank = "Unassigned") {
  return `<select name="${name}"><option value="">${escapeHtml(blank)}</option>${users.map((user) => `<option value="${escapeAttr(user.id)}" ${user.id === selected ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`).join("")}</select>`;
}

function tone(status) {
  if (status === "Active") return "";
  if (status === "Inactive" || status === "Suspended") return "warn";
  return "bad";
}

function progressBar(percent, label) {
  return `
    <div class="agent-progress">
      <div class="dash-bar-track"><div class="dash-bar-fill ${percent >= 100 ? "" : percent < 40 ? "bad" : ""}" style="width:${Math.min(100, percent || 0)}%"></div></div>
      <small>${escapeHtml(label)} · ${percent || 0}%</small>
    </div>`;
}

export function renderBranchForm(editing = {}, staff = []) {
  const settings = editing.settings || {};
  const targets = editing.targets || {};
  return `
    <form id="branchForm" class="form-grid">
      ${editing.id ? `<input type="hidden" name="id" value="${escapeAttr(editing.id)}" />` : ""}
      <div class="section-title full"><h3>General</h3></div>
      <div class="field"><label>Branch Code</label><input name="code" value="${escapeAttr(editing.code || "")}" placeholder="BR001" required /></div>
      <div class="field"><label>Branch Name</label><input name="name" value="${escapeAttr(editing.name || "")}" required /></div>
      <div class="field"><label>Branch Type</label><select name="branchType">${optionList(BRANCH_TYPES, editing.branchType || "Urban")}</select></div>
      <div class="field"><label>Date Opened</label><input name="dateOpened" type="date" value="${escapeAttr(editing.dateOpened || "")}" /></div>
      <div class="field"><label>Status</label><select name="status">${optionList(BRANCH_STATUSES, editing.status || "Active")}</select></div>
      <div class="section-title full"><h3>Contact</h3></div>
      <div class="field"><label>Phone</label><input name="phone" value="${escapeAttr(editing.phone || "")}" /></div>
      <div class="field"><label>Alternative Phone</label><input name="phoneAlt" value="${escapeAttr(editing.phoneAlt || "")}" /></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${escapeAttr(editing.email || "")}" /></div>
      <div class="field"><label>GPS / Digital Address</label><input name="gpsAddress" value="${escapeAttr(editing.gpsAddress || editing.digitalAddress || "")}" /></div>
      <div class="field"><label>Region</label><input name="region" value="${escapeAttr(editing.region || "")}" /></div>
      <div class="field"><label>District</label><input name="district" value="${escapeAttr(editing.district || "")}" /></div>
      <div class="field"><label>Town</label><input name="town" value="${escapeAttr(editing.town || "")}" /></div>
      <div class="field full"><label>Physical Address</label><textarea name="address">${escapeHtml(editing.address || "")}</textarea></div>
      <div class="section-title full"><h3>Management</h3></div>
      <div class="field"><label>Branch Manager</label>${staffSelect("managerId", staff, editing.managerId)}</div>
      <div class="field"><label>Assistant Manager</label>${staffSelect("assistantManagerId", staff, editing.assistantManagerId)}</div>
      <div class="field"><label>Supervisor</label>${staffSelect("supervisorId", staff, editing.supervisorId)}</div>
      <div class="field"><label>Accountant</label>${staffSelect("accountantId", staff, editing.accountantId)}</div>
      <div class="field"><label>Cashier</label>${staffSelect("cashierId", staff, editing.cashierId)}</div>
      <div class="section-title full"><h3>Banking</h3></div>
      <div class="field"><label>Bank Name</label><input name="bankName" value="${escapeAttr(editing.bankName || "")}" /></div>
      <div class="field"><label>Account Number</label><input name="bankAccountNumber" value="${escapeAttr(editing.bankAccountNumber || "")}" /></div>
      <div class="field"><label>Account Name</label><input name="bankAccountName" value="${escapeAttr(editing.bankAccountName || "")}" /></div>
      <div class="field"><label>MoMo Numbers</label><input name="momoNumbers" value="${escapeAttr(editing.momoNumbers || "")}" /></div>
      <div class="field"><label>Float Limit (GHS)</label><input name="floatLimit" type="number" min="0" step="0.01" value="${editing.floatLimit || 0}" /></div>
      <div class="section-title full"><h3>Hours</h3></div>
      <div class="field"><label>Opening Time</label><input name="openingTime" type="time" value="${escapeAttr(editing.openingTime || "08:00")}" /></div>
      <div class="field"><label>Closing Time</label><input name="closingTime" type="time" value="${escapeAttr(editing.closingTime || "17:00")}" /></div>
      <div class="field"><label>Working Days</label><input name="workingDays" value="${escapeAttr(editing.workingDays || "Mon-Fri")}" /></div>
      <div class="field"><label>Public Holidays</label><input name="holidays" value="${escapeAttr(editing.holidays || "")}" placeholder="2026-12-25, 2026-03-06" /></div>
      <div class="field"><label><input type="checkbox" name="emergencyClosed" ${editing.emergencyClosed ? "checked" : ""} /> Emergency closure</label></div>
      <div class="section-title full"><h3>Targets</h3></div>
      <div class="field"><label>Monthly collection</label><input name="targetMonthlyCollection" type="number" min="0" step="0.01" value="${targets.monthlyCollection || 0}" /></div>
      <div class="field"><label>Loan recovery</label><input name="targetLoanRecovery" type="number" min="0" step="0.01" value="${targets.loanRecovery || 0}" /></div>
      <div class="field"><label>New customers</label><input name="targetCustomerAcquisition" type="number" min="0" value="${targets.customerAcquisition || 0}" /></div>
      <div class="field"><label>Expense limit</label><input name="targetExpenseLimit" type="number" min="0" step="0.01" value="${targets.expenseLimit || 0}" /></div>
      <div class="section-title full"><h3>Prefixes & Limits</h3></div>
      <div class="field"><label>Receipt prefix</label><input name="receiptPrefix" value="${escapeAttr(settings.receiptPrefix || "ST")}" /></div>
      <div class="field"><label>Customer prefix</label><input name="customerPrefix" value="${escapeAttr(settings.customerPrefix || "ST")}" /></div>
      <div class="field"><label>Cash holding limit</label><input name="cashHoldingLimit" type="number" min="0" step="0.01" value="${settings.cashHoldingLimit || 0}" /></div>
      <div class="form-actions full"><button class="btn" type="submit">${editing.id ? "Save branch" : "Create branch"}</button></div>
    </form>
  `;
}

export function renderBranchFilters() {
  return `
    <div class="crm-filters branch-filters">
      <input id="branchSearch" placeholder="Name, code, region, town, phone" />
      <select id="branchStatusFilter">
        <option value="">All statuses</option>
        ${BRANCH_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
      <select id="branchTypeFilter">
        <option value="">All types</option>
        ${BRANCH_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
      </select>
      <button class="btn ghost" type="button" id="exportBranchesBtn">Export CSV</button>
    </div>
  `;
}

export function renderBranchTable(branches, { dash = () => ({}), managerName = () => "" } = {}) {
  if (!branches.length) return `<div class="empty">No branches match this search. Create one to get started.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Code</th><th>Branch</th><th>Manager</th><th>Customers</th><th>This month</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${branches.map((branch) => {
            const stats = dash(branch) || {};
            return `
              <tr class="clickable-row" data-branch-detail="${branch.id}">
                <td>${escapeHtml(branch.code)}</td>
                <td><button type="button" class="link-btn" data-branch-detail="${branch.id}"><strong>${escapeHtml(branch.name)}</strong></button><br><span class="muted">${escapeHtml(branch.region || branch.town || branch.branchType || "")}</span></td>
                <td>${escapeHtml(managerName(branch) || "—")}</td>
                <td>${stats.customers || 0}</td>
                <td>${money(stats.monthlyCollections || 0)}</td>
                <td><span class="pill ${tone(branch.status || "Active")}">${escapeHtml(branch.status || "Active")}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="btn secondary" data-branch-detail="${branch.id}">Dashboard</button>
                    <button class="btn ghost" data-edit-branch="${branch.id}">Edit</button>
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderBranchAnalytics(rankings = [], totals = {}) {
  return `
    <div class="panel">
      <div class="section-title"><h2>Company Branch Analytics</h2></div>
      <div class="grid four">
        <div class="stat"><small>Branches</small><strong>${totals.count || 0}</strong></div>
        <div class="stat"><small>Active</small><strong>${totals.active || 0}</strong></div>
        <div class="stat"><small>Today</small><strong>${money(totals.today || 0)}</strong></div>
        <div class="stat"><small>This month</small><strong>${money(totals.monthly || 0)}</strong></div>
      </div>
      ${rankings.length ? `
        <div class="dash-bar-chart" style="margin-top:12px">
          ${rankings.slice(0, 8).map((row) => `
            <div class="dash-bar-row">
              <div class="dash-bar-label">${escapeHtml(row.name)}</div>
              <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.min(100, row.monthly || 0)}%"></div></div>
              <div class="dash-bar-value">${money(row.monthly)}</div>
            </div>`).join("")}
        </div>` : `<div class="empty">No ranking data yet.</div>`}
    </div>
  `;
}

export function renderBranchDashboard(branch, dash, { staff = [], customers = [], groups = [], announcements = [], calendar = [], transfers = [], canManage = false, rankings = [] } = {}) {
  const rank = rankings.find((item) => item.id === branch.id);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(branch.name)}</h2>
        <div class="row-actions">
          <span class="pill ${tone(branch.status || "Active")}">${escapeHtml(branch.status || "Active")}</span>
          <button class="btn ghost" data-back-view="groups">Back</button>
        </div>
      </div>
      <p class="muted">${escapeHtml(branch.code)} · ${escapeHtml(branch.branchType || "Urban")} · ${escapeHtml(branch.region || "")} ${escapeHtml(branch.town || "")}${branch.emergencyClosed ? " · Emergency closed" : ""}</p>
      <div class="grid four">
        <div class="stat"><small>Customers</small><strong>${dash.customers}</strong><span>${dash.activeCustomers} active</span></div>
        <div class="stat"><small>Agents</small><strong>${dash.agents}</strong><span>${dash.activeAgents} active</span></div>
        <div class="stat"><small>Groups</small><strong>${dash.groups}</strong></div>
        <div class="stat"><small>Today / week / month</small><strong>${money(dash.todayCollections)}</strong><span>${money(dash.weeklyCollections)} · ${money(dash.monthlyCollections)}</span></div>
        <div class="stat"><small>Outstanding loans</small><strong>${money(dash.outstandingLoans)}</strong><span>Recovery ${dash.loanRecoveryRate}%</span></div>
        <div class="stat"><small>Withdrawals / expenses</small><strong>${money(dash.withdrawals)}</strong><span>${money(dash.expenses)}</span></div>
        <div class="stat"><small>Profit / loss</small><strong>${money(dash.profit)}</strong></div>
        <div class="stat"><small>Pending approvals</small><strong>${dash.pendingApprovals}</strong><span>Rank #${rank?.rank || "—"}</span></div>
      </div>
      <div class="grid two" style="margin-top:14px">
        ${progressBar(dash.progress.collection, "Monthly collection target")}
        ${progressBar(dash.progress.acquisition, "Customer acquisition")}
        ${progressBar(dash.progress.recovery, "Loan recovery")}
        ${progressBar(dash.progress.expenses, "Expense limit")}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Financial Summary (today)</h2></div>
      <div class="grid four">
        <div class="stat"><small>Income</small><strong>${money(dash.todayIncome)}</strong></div>
        <div class="stat"><small>Expenses</small><strong>${money(dash.todayExpenses)}</strong></div>
        <div class="stat"><small>Withdrawals</small><strong>${money(dash.todayWithdrawals)}</strong></div>
        <div class="stat"><small>Net position</small><strong>${money(dash.netPosition)}</strong></div>
        <div class="stat"><small>Cash on hand</small><strong>${money(dash.cashOnHand)}</strong></div>
        <div class="stat"><small>Expected cash</small><strong>${money(dash.cashExpected)}</strong></div>
        <div class="stat"><small>Handed over</small><strong>${money(dash.cashHanded)}</strong></div>
        <div class="stat"><small>MoMo / Bank</small><strong>${money(dash.momoBalance)} / ${money(dash.bankBalance)}</strong></div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Staff (${staff.length})</h2></div>
        ${staff.length ? `<ul>${staff.map((user) => `<li>${escapeHtml(user.name)} · ${escapeHtml(user.role)} · ${user.active === false ? "Inactive" : "Active"}</li>`).join("")}</ul>` : `<div class="empty">No staff linked to this branch.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Groups (${groups.length})</h2></div>
        ${groups.length ? `<ul>${groups.map((group) => `<li>${escapeHtml(group.code || "")} ${escapeHtml(group.name)} · ${escapeHtml(group.meetingDay || "")}</li>`).join("")}</ul>` : `<div class="empty">No susu groups on this branch.</div>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Customers (${customers.length})</h2></div>
      ${customers.length ? `<div class="table-wrap"><table><thead><tr><th>Number</th><th>Name</th><th>Phone</th><th>Status</th></tr></thead><tbody>
        ${customers.slice(0, 30).map((item) => `<tr><td>${escapeHtml(item.customerNumber || item.accountNo)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.memberStatus || "Active")}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No customers allocated yet.</div>`}
    </div>
    ${canManage ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Transfers</h2></div>
      <form id="branchTransferForm" class="form-grid">
        <input type="hidden" name="fromBranchId" value="${escapeAttr(branch.id)}" />
        <div class="field"><label>Type</label><select name="kind">${optionList(TRANSFER_KINDS, "customer")}</select></div>
        <div class="field"><label>Record ID</label><input name="entityId" placeholder="Customer / agent / group / staff id" /></div>
        <div class="field"><label>To branch</label><select name="toBranchId" id="branchTransferDest"></select></div>
        <div class="field"><label>Cash amount</label><input name="amount" type="number" min="0" step="0.01" value="0" /></div>
        <div class="field full"><label>Reason</label><input name="reason" required /></div>
        <div class="form-actions full"><button class="btn" type="submit">Transfer</button></div>
      </form>
      <form id="branchBulkCustomerForm" class="form-grid">
        <input type="hidden" name="toBranchId" value="" id="bulkToBranchId" />
        <div class="field full"><label>Bulk customer IDs</label><input name="customerIds" placeholder="cust-1, cust-2" /></div>
        <div class="field full"><label>Reason</label><input name="reason" required /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Bulk transfer customers to selected branch</button></div>
      </form>
      ${transfers.length ? `<ul>${transfers.slice(0, 8).map((item) => `<li>${escapeHtml(item.kind)} · ${escapeHtml(item.status)} · ${escapeHtml(item.reason)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Announcements & Calendar</h2></div>
      <form id="branchAnnounceForm" class="form-grid">
        <input type="hidden" name="branchId" value="${escapeAttr(branch.id)}" />
        <div class="field"><label>Type</label><select name="type">${optionList(ANNOUNCEMENT_TYPES, "Policy Change")}</select></div>
        <div class="field"><label>Title</label><input name="title" required /></div>
        <div class="field full"><label>Message</label><textarea name="body"></textarea></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Publish</button></div>
      </form>
      ${announcements.length ? announcements.slice(0, 5).map((item) => `<article class="crm-note"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><button class="btn ghost" data-ack-announcement="${item.id}">Acknowledge</button></article>`).join("") : `<div class="empty">No announcements.</div>`}
      <form id="branchCalendarForm" class="form-grid">
        <input type="hidden" name="branchId" value="${escapeAttr(branch.id)}" />
        <div class="field"><label>Type</label><select name="type">${optionList(CALENDAR_TYPES, "Meeting")}</select></div>
        <div class="field"><label>Title</label><input name="title" required /></div>
        <div class="field"><label>Date</label><input name="date" type="date" required /></div>
        <div class="form-actions full"><button class="btn ghost" type="submit">Add event</button></div>
      </form>
      ${calendar.length ? `<ul>${calendar.slice(0, 8).map((item) => `<li>${item.date} · ${escapeHtml(item.type)} · ${escapeHtml(item.title)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Documents</h2></div>
      <form id="branchDocumentForm" class="form-grid">
        <input type="hidden" name="branchId" value="${escapeAttr(branch.id)}" />
        <div class="field"><label>Type</label><select name="type">${optionList(BRANCH_DOC_TYPES, "Operating License")}</select></div>
        <div class="field"><label>Reference</label><input name="reference" /></div>
        <div class="field full"><label>File (JPEG, PNG, PDF · 2 MB)</label><input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Upload</button></div>
      </form>
      ${(branch.documents || []).length ? branch.documents.map((doc) => `<div class="crm-doc">${escapeHtml(doc.type)} v${doc.version || 1} · ${escapeHtml(doc.reference || doc.fileName || "")}</div>`).join("") : `<div class="empty">No documents uploaded.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Status</h2></div>
      <div class="row-actions">${BRANCH_STATUSES.map((status) => `<button class="btn ghost" type="button" data-branch-status="${status}">${status}</button>`).join("")}</div>
    </div>` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Audit</h2></div>
      ${(branch.activityLog || []).length ? `<ul>${branch.activityLog.slice(0, 12).map((item) => `<li>${escapeHtml(item.action)} · ${escapeHtml(item.detail || "")} · ${escapeHtml((item.at || "").replace("T", " ").slice(0, 16))}</li>`).join("")}</ul>` : `<div class="empty">No branch activity yet.</div>`}
    </div>
  `;
}

export function renderBranchPager({ page, pages, total }) {
  if (total <= 30) return "";
  return `
    <div class="crm-pager">
      <button class="btn ghost" type="button" data-branch-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${pages} · ${total} branches</span>
      <button class="btn ghost" type="button" data-branch-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button>
    </div>
  `;
}

export { APPROVAL_KEYS };
