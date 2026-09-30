/**
 * Agency module screens: expenses, accounting, meetings, notifications, portal, reports extras.
 * Uses App.state; call after syncToApp().
 */
import { App } from "../context.js";
import { formatGhs } from "../core/money.js";
import { EXPENSE_CATEGORIES, expenseTotals } from "../core/expenses.js";
import { trialBalance, incomeStatement, balanceSheet, cashbook, bankReconciliation, ensureChartOfAccounts } from "../core/accounting-reports.js";
import { canAction } from "../core/rbac.js";
import { defaultAccountingSettings, fiscalYearBounds, validatePeriodClose, cashFlowSummary } from "../core/accounting-ops.js";
import { taxSummary, canManageTaxes } from "../core/tax-engine.js";
import { renderAccountingExtras } from "./accounting-views.js";
import { renderPaymentAccountingExtras } from "./payment-views.js";
import { renderDocumentAccountingExtras } from "./document-views.js";
import { ensurePaymentState } from "../core/payment-ops.js";
import { ensureDocumentState } from "../core/document-ops.js";
import { defaultNotificationTemplates, unreadNotifications, birthdayCustomers, allNotificationTemplates } from "../core/notifications.js";
import { ensureNotificationProviders, communicationReport, previewBulkRecipients, providerHealthSnapshot } from "../core/notification-ops.js";
import { renderNotificationExtras } from "./notification-views.js";
import { meetingTotals, memberMeetingHistory } from "../core/group-meetings.js";
import { portalDashboard, portalStatement } from "../core/customer-portal.js";
import { outstandingLoanBalance, loanPortfolioSummary } from "../core/loans-workflow.js";
import { pendingWithdrawals, nextWithdrawalAction, canAdvanceWithdrawal, withdrawalApprovalLevels } from "../core/withdrawals-workflow.js";
import { agentPerformance, staffAgents, COLLECTION_AUTHORITY, EMPLOYMENT_STATUSES, COMMISSION_TYPES } from "../core/agents.js";
import { branchPerformance } from "../core/branches.js";
import { barcodeSvg, qrSvg, receiptShareMessage } from "../core/receipt-codes.js";
import { roleLabel } from "../core/roles.js";

function state() {
  return App.state || {
    customers: [],
    collections: [],
    transactions: [],
    loans: [],
    notifications: [],
    withdrawalRequests: [],
    ledgerEntries: []
  };
}

function money(amount) {
  return formatGhs(amount);
}

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function userName(id) {
  return state().users?.find((user) => user.id === id)?.name || "";
}

function customerName(id) {
  return state().customers?.find((item) => item.id === id)?.name || "";
}

function groupName(id) {
  return state().groups?.find((item) => item.id === id)?.name || "";
}

function branchName(id) {
  return state().branches?.find((item) => item.id === id)?.name || groupName(id) || "";
}

function optionList(items, selected, blankLabel = "") {
  const blank = blankLabel ? `<option value="">${escapeHtml(blankLabel)}</option>` : "";
  return blank + items.map((item) => {
    const value = item.value ?? item.id ?? item;
    const label = item.label ?? item.name ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function renderExpenses() {
  const rangeFrom = sessionStorage.getItem("expense_from") || today().slice(0, 8) + "01";
  const rangeTo = sessionStorage.getItem("expense_to") || today();
  const totals = expenseTotals(state().expenses || [], { from: rangeFrom, to: rangeTo });
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Record Expense</h2></div>
        <form id="expenseForm" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required /></div>
          <div class="field"><label>Category</label><select name="category" required>${optionList(EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })), "Fuel")}</select></div>
          <div class="field"><label>Amount (GHS)</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div class="field"><label>Payment Method</label><select name="paymentMethod">${optionList(["Cash", "Mobile Money", "Bank Transfer"].map((m) => ({ value: m, label: m })), "Cash")}</select></div>
          <div class="field"><label>Vendor</label><input name="vendor" /></div>
          <div class="field"><label>Reference</label><input name="reference" /></div>
          <div class="field full"><label>Notes</label><textarea name="notes"></textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">Post expense</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Expense Summary</h2></div>
        <div class="calc-list">
          <div><span>Records</span><strong>${totals.count}</strong></div>
          <div><span>Total</span><strong>${money(totals.total)}</strong></div>
        </div>
        ${Object.keys(totals.byCategory).length ? `
          <div class="calc-list" style="margin-top:14px">
            ${Object.entries(totals.byCategory).map(([cat, amt]) => `<div><span>${escapeHtml(cat)}</span><strong>${money(amt)}</strong></div>`).join("")}
          </div>
        ` : `<div class="empty">No expenses in this period.</div>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Expense Register</h2>
        <button class="btn ghost" data-export="expenses">Export CSV</button>
      </div>
      ${totals.rows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Method</th><th>Officer</th><th>Notes</th></tr></thead>
            <tbody>
              ${totals.rows.slice().reverse().map((row) => `
                <tr>
                  <td>${row.date}</td>
                  <td>${escapeHtml(row.category)}</td>
                  <td>${escapeHtml(row.vendor || "")}</td>
                  <td>${money(row.amount)}</td>
                  <td>${escapeHtml(row.paymentMethod)}</td>
                  <td>${escapeHtml(userName(row.recordedBy))}</td>
                  <td>${escapeHtml(row.notes || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No expenses posted yet.</div>`}
    </div>
  `;
}

export function renderAccounting() {
  const st = state();
  const user = st.users?.find((item) => item.id === App.sessionUserId);
  const from = sessionStorage.getItem("acct_from") || "";
  const to = sessionStorage.getItem("acct_to") || today();
  const range = { from, to };
  const tb = trialBalance(st, range);
  const pnl = incomeStatement(st, range);
  const bs = balanceSheet(st, range);
  const book = cashbook(st, range).slice(-40).reverse();
  const rec = bankReconciliation(st);
  const chart = ensureChartOfAccounts(st);
  return `
    <div class="panel">
      <div class="section-title"><h2>Accounting Period</h2></div>
      <form id="accountingRangeForm" class="form-grid">
        <div class="field"><label>From</label><input name="from" type="date" value="${escapeAttr(from)}" /></div>
        <div class="field"><label>To</label><input name="to" type="date" value="${escapeAttr(to)}" /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Refresh statements</button></div>
      </form>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Trial Balance</h2><span class="pill ${tb.balanced ? "" : "bad"}">${tb.balanced ? "Balanced" : "Out of balance"}</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              ${tb.rows.filter((row) => row.debit || row.credit).map((row) => `
                <tr><td>${row.code}</td><td>${escapeHtml(row.name)}</td><td>${money(row.debit)}</td><td>${money(row.credit)}</td></tr>
              `).join("") || `<tr><td colspan="4">No ledger movement yet.</td></tr>`}
              <tr><th></th><th>Total</th><th>${money(tb.totalDebit)}</th><th>${money(tb.totalCredit)}</th></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Income Statement</h2></div>
        <div class="calc-list">
          <div><span>Income</span><strong>${money(pnl.incomeTotal)}</strong></div>
          <div><span>Expenses</span><strong>${money(pnl.expenseTotal)}</strong></div>
          <div><span>Net income</span><strong>${money(pnl.netIncome)}</strong></div>
        </div>
        <div class="section-title" style="margin-top:18px"><h2>Balance Sheet</h2><span class="pill ${bs.balanced ? "" : "warn"}">${bs.balanced ? "Assets = Liab + Equity" : "Review"}</span></div>
        <div class="calc-list">
          <div><span>Assets</span><strong>${money(bs.assetTotal)}</strong></div>
          <div><span>Liabilities</span><strong>${money(bs.liabilityTotal)}</strong></div>
          <div><span>Equity</span><strong>${money(bs.equityTotal)}</strong></div>
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Cashbook</h2></div>
        ${book.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Debit</th><th>Credit</th><th>Receipt</th></tr></thead>
              <tbody>
                ${book.map((row) => `<tr><td>${row.date}</td><td>${escapeHtml(row.type)}</td><td>${money(row.debit)}</td><td>${money(row.credit)}</td><td>${escapeHtml(row.receiptNo)}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No cashbook lines yet.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Bank Reconciliation</h2></div>
        <form id="bankRecForm" class="form-grid">
          <div class="field"><label>Statement balance</label><input name="statementBalance" type="number" step="0.01" value="${rec.statementBalance}" /></div>
          <div class="field"><label>Uncleared receipts</label><input name="unclearedReceipts" type="number" step="0.01" value="${rec.unclearedReceipts}" /></div>
          <div class="field"><label>Uncleared payments</label><input name="unclearedPayments" type="number" step="0.01" value="${rec.unclearedPayments}" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Recalculate</button></div>
        </form>
        <div class="calc-list" style="margin-top:12px">
          <div><span>Book (bank)</span><strong>${money(rec.bookBalance)}</strong></div>
          <div><span>Difference</span><strong>${money(rec.difference)}</strong></div>
        </div>
        <div class="section-title" style="margin-top:18px"><h2>Chart of Accounts</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
            <tbody>${chart.map((row) => `<tr><td>${row.code}</td><td>${escapeHtml(row.name)}</td><td>${row.type}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <form id="journalForm" class="form-grid" style="margin-top:16px">
          <div class="section-title full"><h3>Manual Journal</h3></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required /></div>
          <div class="field full"><label>Narration</label><input name="narration" required /></div>
          <div class="field"><label>Debit account</label><select name="debitAccount">${optionList(chart.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })), "5000")}</select></div>
          <div class="field"><label>Credit account</label><select name="creditAccount">${optionList(chart.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })), "1000")}</select></div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div class="form-actions full"><button class="btn" type="submit">Post journal</button></div>
        </form>
      </div>
    </div>
    ${renderAccountingExtras({
      fiscal: fiscalYearBounds(to || today(), { ...defaultAccountingSettings(), ...(st.settings || {}) }),
      periods: st.accountingPeriods || [],
      closeCheck: validatePeriodClose(st, fiscalYearBounds(to || today(), { ...defaultAccountingSettings(), ...(st.settings || {}) })),
      cashFlow: cashFlowSummary(st, range),
      taxes: st.taxDefinitions || [],
      taxTotals: taxSummary([...(st.transactions || []), ...(st.collections || []), ...(st.expenses || [])], range),
      canClose: canAction(user, "Accounting.ClosePeriod"),
      canTax: canManageTaxes(user)
    })}
    ${renderPaymentAccountingBlock(st, user)}
    ${renderDocumentAccountingBlock(st, user)}
  `;
}

function renderPaymentAccountingBlock(st, user) {
  ensurePaymentState(st);
  return renderPaymentAccountingExtras({
    settlements: st.settlements || [],
    reconciliations: st.paymentReconciliation || [],
    refunds: st.paymentRefunds || [],
    reversals: st.paymentReversals || [],
    canReconcile: canAction(user, "Payment.Reconcile") || canAction(user, "Accounting.View"),
    canRefund: canAction(user, "Payment.Refund")
  });
}

function renderDocumentAccountingBlock(st, user) {
  ensureDocumentState(st);
  return renderDocumentAccountingExtras({
    statements: (st.documents || []).filter((item) => /statement|passbook/i.test(item.type)),
    refunds: (st.documents || []).filter((item) => item.type === "refund_receipt"),
    reversals: (st.documents || []).filter((item) => item.type === "reversal_receipt"),
    approvals: st.receiptApprovals || [],
    canApprove: canAction(user, "Document.Approve") || canAction(user, "Document.Refund") || canAction(user, "Accounting.View")
  });
}

export function renderNotifications() {
  const st = state();
  const user = st.users?.find((item) => item.id === App.sessionUserId);
  const templates = { ...defaultNotificationTemplates(), ...(st.notificationTemplates || {}) };
  const queue = (st.notifications || []).filter((item) => !item.deleted).slice(-30).reverse();
  const birthdays = birthdayCustomers(st.customers || [], today());
  const unread = unreadNotifications(st);
  const providers = ensureNotificationProviders(st).map((provider) => {
    const health = providerHealthSnapshot(provider, st.deliveryAttempts || []);
    return { ...provider, healthState: health.healthState, displayedScore: health.displayedScore };
  });
  const stats = communicationReport(st);
  const extras = renderNotificationExtras({
    stats,
    providers,
    queue,
    announcements: st.announcements || [],
    events: Object.entries(allNotificationTemplates(st)).map(([value, tpl]) => ({ value, label: tpl.title })),
    canSend: canAction(user, "Notification.Send"),
    canBroadcast: canAction(user, "Notification.Broadcast"),
    canSchedule: canAction(user, "Notification.Schedule"),
    canProvider: canAction(user, "Notification.Provider"),
    recipientPreview: previewBulkRecipients(st).length
  });
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Templates</h2><span class="muted">${unread.length} unread</span></div>
        <form id="notificationTemplateForm" class="form-grid">
          ${Object.entries(templates).map(([event, tpl]) => `
            <div class="field full"><label>${escapeHtml(tpl.title)} (SMS)</label><textarea name="sms_${event}">${escapeHtml(tpl.sms)}</textarea></div>
          `).join("")}
          <div class="form-actions full"><button class="btn" type="submit">Save templates</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Queue & Birthdays</h2></div>
        ${birthdays.length ? `<div class="notice good">${birthdays.length} birthday(s) today: ${escapeHtml(birthdays.map((c) => c.name).join(", "))}</div>` : `<div class="muted">No customer birthdays today.</div>`}
        <form id="sendNotificationForm" class="form-grid" style="margin-top:12px">
          <div class="field"><label>Event</label><select name="event">${optionList(Object.keys(templates).map((k) => ({ value: k, label: templates[k].title })), "contribution_received")}</select></div>
          <div class="field"><label>Channel</label><select name="channel">${optionList(["In-App", "SMS", "WhatsApp", "Email"].map((c) => ({ value: c, label: c })), "In-App")}</select></div>
          <div class="field full"><label>Customer account / name vars</label><input name="name" placeholder="Ama Mensah" /></div>
          <div class="field"><label>Amount</label><input name="amount" placeholder="50.00" /></div>
          <div class="field"><label>Receipt</label><input name="receiptNo" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Queue notification</button></div>
        </form>
        ${queue.length ? `
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>When</th><th>Channel</th><th>Title</th><th>Status</th></tr></thead>
              <tbody>${queue.map((item) => `<tr><td>${escapeHtml(String(item.createdAt).slice(0, 16))}</td><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(item.title)}</td><td>${item.read ? "Read" : item.status}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        ` : `<div class="empty">No notifications queued.</div>`}
      </div>
    </div>
    ${extras}
  `;
}

export function renderGroupMeetings() {
  const groups = state().susuGroups || [];
  const meetings = (state().groupMeetings || []).slice().reverse();
  const selectedId = sessionStorage.getItem("meeting_group_id") || groups[0]?.id || "";
  const group = groups.find((item) => item.id === selectedId);
  const members = group?.memberships || [];
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Record Meeting</h2></div>
        <form id="groupMeetingForm" class="form-grid">
          <div class="field"><label>Group</label><select name="susuGroupId" id="meetingGroupSelect">${optionList(groups.map((g) => ({ value: g.id, label: `${g.code} · ${g.name}` })), selectedId)}</select></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required /></div>
          <div class="field full"><label>Notes</label><textarea name="notes"></textarea></div>
          ${group ? `
            <div class="section-title full"><h3>Attendance & collections</h3></div>
            ${members.length ? members.map((m) => {
              const customer = state().customers.find((c) => c.id === m.customerId);
              return `
                <div class="field"><label>${escapeHtml(customer?.name || m.customerId)}</label>
                  <label class="check-row"><input type="checkbox" name="present_${m.customerId}" checked /> Present</label>
                </div>
                <div class="field"><label>Contribution</label><input name="contrib_${m.customerId}" type="number" min="0" step="0.01" value="${group.contributionAmount || 0}" /></div>
                <div class="field"><label>Loan repayment</label><input name="loan_${m.customerId}" type="number" min="0" step="0.01" value="0" /></div>
                <div class="field"><label>Fine</label><input name="fine_${m.customerId}" type="number" min="0" step="0.01" value="0" /></div>
                <div class="field"><label>Welfare</label><input name="welfare_${m.customerId}" type="number" min="0" step="0.01" value="0" /></div>
              `;
            }).join("") : `<div class="notice full">Add members to this group first.</div>`}
          ` : `<div class="notice full">Create a susu group first.</div>`}
          <div class="form-actions full"><button class="btn" type="submit">Save meeting</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Meeting History</h2></div>
        ${meetings.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Group</th><th>Present</th><th>Collected</th></tr></thead>
              <tbody>
                ${meetings.slice(0, 20).map((meeting) => {
                  const totals = meeting.totals || meetingTotals(meeting);
                  const g = groups.find((item) => item.id === meeting.susuGroupId);
                  return `<tr><td>${meeting.date}</td><td>${escapeHtml(g?.name || "")}</td><td>${totals.present}</td><td>${money(totals.total || totals.contributions)}</td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No meetings recorded yet.</div>`}
      </div>
    </div>
  `;
}

export function renderWithdrawalWorkflow() {
  const requests = (state().withdrawalRequests || []).slice().reverse();
  const user = App.state.users?.find((item) => item.id === App.sessionUserId);
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Withdrawal Approval Pipeline</h2></div>
      <p class="muted">${withdrawalApprovalLevels().map((step) => step.status).join(" → ")}</p>
      ${requests.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Requested by</th><th></th></tr></thead>
            <tbody>
              ${requests.map((item) => `
                <tr>
                  <td>${item.date}</td>
                  <td>${escapeHtml(customerName(item.customerId))}</td>
                  <td>${money(item.amount)}</td>
                  <td><span class="pill ${item.status === "Paid" ? "" : ["Rejected", "Cancelled", "Reversed"].includes(item.status) ? "bad" : "warn"}">${escapeHtml(item.status)}</span></td>
                  <td>${escapeHtml(userName(item.requestedBy))}</td>
                  <td>
                    ${canAdvanceWithdrawal(user, item) && nextWithdrawalAction(item.status) ? `<button class="btn" data-advance-withdrawal="${item.id}">${nextWithdrawalAction(item.status)}</button>` : ""}
                    ${item.status !== "Paid" && item.status !== "Rejected" && item.status !== "Cancelled" && item.status !== "Reversed" ? `<button class="btn danger" data-reject-withdrawal="${item.id}">Reject</button>` : ""}
                    ${item.status === "Paid" ? `<button class="btn ghost" data-reverse-withdrawal="${item.id}">Reverse</button>` : ""}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No withdrawal requests in the pipeline. Recording a withdrawal still posts immediately for field cash-outs; use Request to start the approval path.</div>`}
    </div>
  `;
}

export function renderAgencyReportsExtra() {
  const st = state();
  const loans = loanPortfolioSummary(st.loans || []);
  const pendingWd = pendingWithdrawals(st, { status: "Requested" }).length + pendingWithdrawals(st, { status: "Verified" }).length;
  const agents = staffAgents(st.users || []).map((user) => agentPerformance(user, {
    collections: st.collections || [],
    customers: st.customers || [],
    susuGroups: st.susuGroups || [],
    date: today()
  })).sort((a, b) => b.collected - a.collected);
  const branches = (st.branches || []).map((branch) => ({
    branch,
    perf: branchPerformance(branch, { collections: st.collections || [], customers: st.customers || [], groups: st.groups || [], date: today() })
  }));
  const dormant = (st.customers || []).filter((c) => c.dormant).length;
  const active = (st.customers || []).filter((c) => c.active !== false && c.memberStatus !== "Closed").length;
  return `
    <div class="grid four" style="margin-top:18px">
      <div class="stat"><small>Active Customers</small><strong>${active}</strong></div>
      <div class="stat"><small>Dormant Customers</small><strong>${dormant}</strong></div>
      <div class="stat"><small>Loan Outstanding</small><strong>${money(loans.outstanding)}</strong></div>
      <div class="stat"><small>Pending Withdrawals</small><strong>${pendingWd}</strong></div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Top Agents Today</h2><button class="btn ghost" data-export="topAgents">Export CSV</button></div>
        ${agents.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Collected</th><th>Target %</th><th>Commission</th></tr></thead>
              <tbody>
                ${agents.slice(0, 8).map((row) => {
                  const user = st.users.find((item) => item.id === row.agentId);
                  return `<tr><td>${escapeHtml(user?.name || "")}</td><td>${money(row.collected)}</td><td>${row.achievementPercent}%</td><td>${money(row.commission)}</td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No agent collections today.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Branch Performance Today</h2><button class="btn ghost" data-export="topBranches">Export CSV</button></div>
        ${branches.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Branch</th><th>Customers</th><th>Collected</th></tr></thead>
              <tbody>
                ${branches.map(({ branch, perf }) => `<tr><td>${escapeHtml(branch.name)}</td><td>${perf.activeCustomers}</td><td>${money(perf.collected)}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No branches yet. Locations will map to branches automatically.</div>`}
      </div>
    </div>
  `;
}

export function renderCustomerPortal(customer, portalState = null) {
  const source = portalState || state();
  const dash = portalDashboard(source, customer);
  if (!dash) return `<div class="notice">Unable to load member portal.</div>`;
  const statement = portalStatement(source, customer).slice(-20).reverse();
  const phonePin = String(customer.phone || "").replace(/\D/g, "").slice(-4) || "****";
  return `
    <div class="dash-header panel">
      <div>
        <h2>Member Portal</h2>
        <div class="muted">${escapeHtml(customer.name)} · Account ${escapeHtml(customer.accountNo || customer.customerNumber || "")}</div>
        <div class="muted">Login: account number · PIN ${customer.portalPinSource === "manual" ? "(your PIN)" : `default last 4 of phone (e.g. ${escapeHtml(phonePin)})`}</div>
      </div>
      <button class="btn secondary" id="portalLogoutBtn" type="button">Sign out</button>
    </div>
    <div class="kpi-grid">
      <div class="stat"><small>Account Balance</small><strong>${money(dash.accountBalance || dash.savingsBalance)}</strong></div>
      <div class="stat"><small>Contributions</small><strong>${money(dash.contributionTotal)}</strong></div>
      <div class="stat"><small>Loan Balance</small><strong>${money(dash.loanBalance)}</strong></div>
      <div class="stat"><small>Open Withdrawals</small><strong>${dash.withdrawals.filter((w) => w.status !== "Paid" && w.status !== "Rejected").length}</strong></div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Request Withdrawal</h2></div>
        <form id="portalWithdrawForm" class="form-grid">
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div class="field full"><label>Reason</label><textarea name="reason"></textarea></div>
          <div class="form-actions full"><button class="btn warning" type="submit">Submit request</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Change PIN</h2></div>
        <form id="portalChangePinForm" class="form-grid">
          <div class="field"><label>Current PIN</label><input name="currentPin" type="password" inputmode="numeric" required /></div>
          <div class="field"><label>New PIN (4–6 digits)</label><input name="newPin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Update PIN</button></div>
        </form>
        <div class="section-title" style="margin-top:16px"><h2>Notifications</h2></div>
        ${dash.notifications.length ? dash.notifications.slice(0, 8).map((item) => `<div class="notice">${escapeHtml(item.title || "")} — ${escapeHtml(item.body || "")}</div>`).join("") : `<div class="empty">No alerts yet.</div>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Recent collections</h2></div>
      ${dash.collections.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
            <tbody>${dash.collections.slice(0, 15).map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${money(item.amount)}</td><td>${escapeHtml(item.paymentMethod || "Cash")}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<div class="empty">No collections recorded yet.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Statement</h2><button class="btn ghost" id="portalPrintStatement" type="button">Download statement</button></div>
      ${statement.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead>
            <tbody>${statement.map((tx) => `<tr><td>${escapeHtml(tx.date)}</td><td>${escapeHtml(tx.type)}</td><td>${money(tx.amount)}</td><td>${money(tx.runningBalance)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<div class="empty">No transactions yet.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loans</h2></div>
      ${dash.loans.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Principal</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>${dash.loans.map((loan) => `<tr><td>${escapeHtml(loan.date || "")}</td><td>${money(loan.principal)}</td><td>${money(outstandingLoanBalance(loan))}</td><td>${escapeHtml(loan.status)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      ` : `<div class="empty">No loans.</div>`}
    </div>
  `;
}

export function renderReceiptMarkup(receipt, businessName) {
  return `
    <div class="print-receipt">
      <div class="brand"><strong>${escapeHtml(businessName || "SMILE TRUST SUSU MANAGEMENT SYSTEM")}</strong></div>
      <div>Receipt ${escapeHtml(receipt.receiptNo || "")}</div>
      <div>${escapeHtml(receipt.customerName || "")}</div>
      <div>Agent: ${escapeHtml(receipt.agentName || "")}</div>
      <div>Branch: ${escapeHtml(receipt.branchName || "")}</div>
      <div>${escapeHtml(receipt.collectionType || "Collection")} · ${money(receipt.amount)}</div>
      <div>Balance: ${money(receipt.balance || 0)}</div>
      <div>${escapeHtml(receipt.date || "")} · ${escapeHtml(receipt.paymentMethod || "Cash")}</div>
      <div class="receipt-codes">${qrSvg(receipt.receiptNo || "")}${barcodeSvg(receipt.receiptNo || "")}</div>
    </div>
  `;
}

export function receiptWhatsAppText(receipt, businessName) {
  return receiptShareMessage(receipt, businessName);
}

export function renderAgentStaffExtras(editing) {
  const authority = editing?.collectionCapabilities?.personalSavingsCollection === false
    ? COLLECTION_AUTHORITY.GROUP
    : editing?.collectionCapabilities?.susuGroupCollection === false
      ? COLLECTION_AUTHORITY.INDIVIDUAL
      : COLLECTION_AUTHORITY.BOTH;
  return `
    <div class="section-title full"><h3>Agent Profile</h3></div>
    <div class="field"><label>Agent ID</label><input name="agentCode" value="${escapeAttr(editing?.agentCode || "")}" placeholder="AG0001" /></div>
    <div class="field"><label>Employment Status</label><select name="employmentStatus">${optionList(EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s })), editing?.employmentStatus || "Active")}</select></div>
    <div class="field full"><label>Residential Address</label><textarea name="residentialAddress">${escapeHtml(editing?.residentialAddress || "")}</textarea></div>
    <div class="field"><label>Alternate Phone</label><input name="phoneAlt" value="${escapeAttr(editing?.phoneAlt || "")}" /></div>
    <div class="field"><label>Emergency Contact</label><input name="emergencyContactName" value="${escapeAttr(editing?.emergencyContactName || "")}" /></div>
    <div class="field"><label>Emergency Phone</label><input name="emergencyContactPhone" value="${escapeAttr(editing?.emergencyContactPhone || "")}" /></div>
    <div class="field"><label>Collection Authority</label>
      <select name="collectionAuthority">
        <option value="individual" ${authority === "individual" ? "selected" : ""}>Individual savings only</option>
        <option value="group" ${authority === "group" ? "selected" : ""}>Group savings only</option>
        <option value="both" ${authority === "both" ? "selected" : ""}>Both individual and group</option>
      </select>
    </div>
    <div class="field"><label>Commission Type</label><select name="commissionType">${optionList(COMMISSION_TYPES.map((s) => ({ value: s, label: s })), editing?.commissionType || "None")}</select></div>
    <div class="field"><label>Commission Rate / Amount</label><input name="commissionRate" type="number" min="0" step="0.01" value="${editing?.commissionRate || 0}" /></div>
    <div class="field"><label>Daily Collection Target (GHS)</label><input name="dailyTarget" type="number" min="0" step="0.01" value="${editing?.dailyTarget || 0}" /></div>
  `;
}

export function renderCustomerKycExtras(editing) {
  const signatureSrc = String(editing?.signatureData || "").trim();
  return `
    <div class="section-title full"><h3>KYC Details</h3></div>
    <div class="field"><label>Date of Birth</label><input name="dateOfBirth" type="date" value="${escapeAttr(editing?.dateOfBirth || "")}" required /></div>
    <div class="field"><label>Occupation</label><input name="occupation" value="${escapeAttr(editing?.occupation || "")}" /></div>
    <div class="field"><label>Employer</label><input name="employer" value="${escapeAttr(editing?.employer || "")}" /></div>
    <div class="field"><label>GPS Address</label><input name="gpsAddress" value="${escapeAttr(editing?.gpsAddress || "")}" placeholder="GA-123-4567" /></div>
    <div class="field full signature-pad-field">
      <label>Signature <span class="muted">(draw with finger, stylus, or mouse)</span></label>
      <div class="signature-pad-wrap">
        <canvas id="memberSignaturePad" class="signature-pad" width="640" height="180" aria-label="Signature pad"></canvas>
      </div>
      <input type="hidden" name="signatureData" id="memberSignatureData" value="${escapeAttr(signatureSrc)}" />
      <div class="signature-pad-actions">
        <button type="button" class="btn ghost" id="clearMemberSignature">Clear signature</button>
        ${signatureSrc ? `<img class="signature-preview" id="memberSignaturePreview" src="${escapeAttr(signatureSrc)}" alt="Saved signature" />` : `<img class="signature-preview" id="memberSignaturePreview" alt="" hidden />`}
      </div>
      <div class="muted">Signature is required for new member registration.</div>
    </div>
  `;
}

export { roleLabel, memberMeetingHistory, COLLECTION_AUTHORITY };
