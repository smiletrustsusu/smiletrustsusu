import { rt } from "../runtime.js";
import {
  canDeleteUserAccount,
  canDisableUserAccount,
  canEditUserAccount,
  isProtectedOwnerAccount,
  isSystemDeveloperAccount,
  listUsersForActor
} from "../core/system-accounts.js";
import { currentUser, canManageUsers } from "../core/auth.js";

export function render() {
  document.body.className = `theme-${rt.state.settings.theme || "emerald"}`;
  if (!currentUser()) {
    renderLogin();
    return;
  }
  renderApp();
}

export function renderLogin() {
  const remembered = rememberedLogin();
  rt.root.innerHTML = `
    <main class="auth">
      <section class="auth-hero">
        <div class="brand-mark"><img src="assets/smile-trust-logo.svg" alt="Smile Trust" /></div>
        <h1>SMILE TRUST SUSU MANAGEMENT SYSTEM</h1>
        <p>Manage daily collections, customer savings, loans, interest, repayments, staff permissions, and reports from one focused workspace.</p>
      </section>
      <section class="login-panel">
        <div class="cloud-login">
          <h2>Cloud data</h2>
          <p class="muted">Restore the latest online susu records before login. No computer address is needed.</p>
          <div class="form-actions">
            <button class="btn" id="loginRestoreSync" type="button">Restore cloud data</button>
            <button class="btn secondary" id="loginReplaceSync" type="button">Replace phone data</button>
          </div>
          <div id="loginSyncNotice"></div>
        </div>
        <div class="auth-tabs">
          <button class="active" type="button" data-auth-tab="login">Login</button>
          <button type="button" data-auth-tab="create">Create</button>
        </div>
        <div data-auth-panel="login">
          <h2>Sign in</h2>
          <p class="muted">Sign in with the account the owner created for you.</p>
        <form id="loginForm">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" value="${escapeAttr(remembered?.username || "")}" required autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <div class="password-row">
              <input id="password" type="password" required autocomplete="current-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="password">Show</button>
            </div>
          </div>
          <div class="form-actions" style="margin-top:18px">
            <button class="btn" type="submit">Sign in</button>
          </div>
          <label class="check-row"><input id="rememberMe" type="checkbox" ${remembered ? "checked" : ""} /> Remember me on this device</label>
          <div id="loginError"></div>
        </form>
        </div>
        <div class="request-panel">
          <div>
            <h2>Create admin request</h2>
            <p class="muted">Submit your details and location name. The owner will review, create or assign the location, and activate the account.</p>
          </div>
          <form id="adminRequestForm" class="form-grid">
            <div class="field"><label>Full Name</label><input name="name" required /></div>
            <div class="field"><label>Username</label><input name="username" required /></div>
            <div class="field"><label>Location Name</label><input name="groupName" required /></div>
            <div class="field"><label>Password</label><div class="password-row"><input id="requestPassword" name="password" type="password" required /><button class="btn ghost password-toggle" type="button" data-toggle-password="requestPassword">Show</button></div></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Request admin access</button></div>
            <div id="requestNotice" class="full"></div>
          </form>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#username").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    let user = await findLoginUser(username, password);
    if (!user) {
      document.querySelector("#loginError").innerHTML = `<div class="notice">Checking latest cloud account status...</div>`;
      try {
        await restoreCloudBackupFromCloud({ keepView: true, keepSession: true });
        user = await findLoginUser(username, password);
      } catch {
        // Keep the normal invalid message below.
      }
      if (!user) {
        document.querySelector("#loginError").innerHTML = `<div class="notice">Invalid login or inactive account.</div>`;
        return;
      }
    }
    rt.sessionUserId = user.id;
    sessionStorage.setItem("smile_trust_session_user", user.id);
    if (document.querySelector("#rememberMe")?.checked) {
      localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
        userId: user.id,
        username: user.username,
        passwordHash: user.passwordHash
      }));
    } else {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
    rt.activeView = "dashboard";
    render();
  });
  document.querySelector("#adminRequestForm").addEventListener("submit", handleAdminRequest);
  document.querySelector("#loginRestoreSync").addEventListener("click", connectLoginSync);
  document.querySelector("#loginReplaceSync").addEventListener("click", replaceLoginSync);
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => togglePassword(button));
  });
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.authTab;
      document.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelector('[data-auth-panel="login"]').style.display = mode === "login" ? "block" : "none";
      document.querySelector(".request-panel").style.display = mode === "create" ? "block" : "none";
    });
  });
}

export function renderApp() {
  const user = currentUser();
  const nav = (isKBA() ? [
    ["dashboard", "Dashboard"],
    ["groups", "Susu Locations"],
    ["reports", "Reports"],
    ["logs", "Logs"],
    ["closing", "Daily Closing"],
    ["backup", "Backup"],
    ["settings", "Settings"],
    ["users", "Users"]
  ] : [
    ["dashboard", "Dashboard"],
    ["groups", "My Location"],
    ["customers", "Customers"],
    ["collections", "Collections"],
    ["loans", "Loans"],
    ["loanRepayments", "Loan Repayments"],
    ["interestPayments", "Interest Payments"],
    ["messages", "Messages"],
    ["imports", "Uploads"],
    ["reports", "Reports"],
    ["logs", "Logs"],
    ["closing", "Daily Closing"],
    ["backup", "Backup"]
  ]);
  const groupLabel = isKBA() ? `${rt.state.groups.length} susu location(s)` : (primaryGroup()?.name || "No location assigned");
  const workspaceLabel = isKBA() ? rt.state.settings.businessName : (primaryGroup()?.name || "No location assigned");

  rt.root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="side-brand">
          <div class="brand-mark"><img src="assets/smile-trust-logo.svg" alt="Smile Trust" /></div>
          <div>
            <strong>Susu System</strong>
            <span>${escapeHtml(workspaceLabel)}</span>
          </div>
        </div>
        <nav class="nav">
          ${nav.map(([key, label]) => `<button class="${rt.activeView === key ? "active" : ""}" data-view="${key}">${label}</button>`).join("")}
        </nav>
        <div class="user-box">
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <span>${user.role}</span>
          </div>
          <button class="btn secondary" id="logoutBtn">Sign out</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <strong>${titleFor(rt.activeView)}</strong>
            <div class="muted">${today()} · ${escapeHtml(groupLabel)} · ${rt.state.settings.currency}</div>
          </div>
          <div class="row-actions">
            <span class="pill ${navigator.onLine ? "" : "bad"}">${navigator.onLine ? "Online" : "Offline"}</span>
            <span class="muted">Sync: ${rt.state.settings.lastSyncedAt ? escapeHtml(new Date(rt.state.settings.lastSyncedAt).toLocaleString()) : "Never"}</span>
            <button class="btn ghost" id="syncNowBtn">Sync now</button>
            <select id="themeSelect" aria-label="Theme">
              <option value="emerald" ${rt.state.settings.theme === "emerald" ? "selected" : ""}>Emerald</option>
              <option value="royal" ${rt.state.settings.theme === "royal" ? "selected" : ""}>Royal</option>
              <option value="slate" ${rt.state.settings.theme === "slate" ? "selected" : ""}>Slate</option>
              <option value="sunrise" ${rt.state.settings.theme === "sunrise" ? "selected" : ""}>Sunrise</option>
              <option value="forest" ${rt.state.settings.theme === "forest" ? "selected" : ""}>Forest</option>
              <option value="wine" ${rt.state.settings.theme === "wine" ? "selected" : ""}>Wine</option>
              <option value="mono" ${rt.state.settings.theme === "mono" ? "selected" : ""}>Mono</option>
              <option value="ocean" ${rt.state.settings.theme === "ocean" ? "selected" : ""}>Ocean</option>
            </select>
          </div>
        </header>
        <section class="content">${renderView()}</section>
      </main>
    </div>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      rt.activeView = button.dataset.view;
      render();
    });
  });
  document.querySelector("#logoutBtn").addEventListener("click", () => {
    if (!backupDoneToday() && !confirm("No backup has been recorded today. Sign out anyway?")) return;
    sessionStorage.removeItem("smile_trust_session_user");
    rt.sessionUserId = null;
    render();
  });
  document.querySelector("#syncNowBtn").addEventListener("click", syncNow);
  document.querySelector("#themeSelect").addEventListener("change", (event) => {
    rt.state.settings.theme = event.target.value;
    saveState();
    logAudit("Theme changed", event.target.value);
    render();
  });
  attachHandlers();
}

export function titleFor(view) {
  return {
    dashboard: "Overview",
    groups: "Susu Locations",
    customers: "Customer Accounts",
    collections: "Daily Collections",
    loans: "Loans",
    loanRepayments: "Loan Repayments",
    interestPayments: "Interest Payments",
    messages: "Member Messages",
    imports: "Import Uploads",
    reports: "Reports",
    logs: "Daily Input Log",
    closing: "Daily Closing",
    backup: "Backup & Restore",
    groupDetail: "Location Details",
    memberDetail: "Member Details",
    settings: "Admin Settings",
    users: "Admin Users"
  }[view];
}

export function renderView() {
  return {
    dashboard: renderDashboard,
    groups: renderGroups,
    customers: renderCustomers,
    collections: renderCollections,
    loans: renderLoans,
    loanRepayments: renderLoanRepayments,
    interestPayments: renderInterestPayments,
    messages: renderMessages,
    imports: renderImports,
    reports: renderReports,
    logs: renderLogs,
    closing: renderDailyClosing,
    backup: renderBackup,
    groupDetail: renderGroupDetail,
    memberDetail: renderMemberDetail,
    settings: renderSettings,
    users: renderUsers
  }[rt.activeView]();
}

export function metrics() {
  const deposits = sumTransactions("Susu Deposit");
  const repayments = sumTransactions("Loan Repayment");
  const interestPaid = sumTransactions("Interest Payment");
  const withdrawals = sumTransactions("Withdrawal");
  const disbursed = visibleLoans().reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
  const outstanding = visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0);
  const expected = visibleExpectedContribution();
  const remaining = Math.max(0, expected - deposits);
  const keeperBalance = deposits + repayments + interestPaid - withdrawals - disbursed;
  return { deposits, repayments, interestPaid, withdrawals, disbursed, outstanding, expected, remaining, keeperBalance };
}

export function sumTransactions(type) {
  return visibleTransactions().filter((tx) => tx.type === type).reduce((sum, tx) => sum + Number(tx.amount), 0);
}

export function visibleExpectedContribution() {
  return visibleCustomers().reduce((sum, customer) => {
    const group = groupById(customer.groupId);
    const target = group?.targetContributions || rt.state.settings.collectionDays;
    return sum + perSittingAmount(customer) * target;
  }, 0);
}

export function renderDashboard() {
  const m = metrics();
  const activeGroups = visibleGroups().filter((group) => group.active).length;
  const dashboardName = isKBA() ? "Owner Overview" : (primaryGroup()?.name || "No location assigned");
  return `
    <div class="panel" style="margin-bottom:18px">
      <div class="section-title"><h2>${escapeHtml(dashboardName)}</h2></div>
      <div class="muted">${isKBA() ? "All susu locations and system activity" : "Assigned susu location dashboard"}</div>
    </div>
    <div class="grid four">
      <div class="stat"><small>Expected Total Contribution</small><strong>${money(m.expected)}</strong></div>
      <div class="stat"><small>Total Susu Collected</small><strong>${money(m.deposits)}</strong></div>
      <div class="stat"><small>Amount Remaining To Be Contributed</small><strong>${money(m.remaining)}</strong></div>
      <div class="stat"><small>Amount Remaining With Keeper</small><strong>${money(m.keeperBalance)}</strong></div>
      <div class="stat"><small>Loan Repayments</small><strong>${money(m.repayments)}</strong></div>
      <div class="stat"><small>Interest Paid</small><strong>${money(m.interestPaid)}</strong></div>
      <div class="stat"><small>Outstanding Loans</small><strong>${money(m.outstanding)}</strong></div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Contribution Target</h2></div>
        <div class="calc-list">
          <div><span>Expected total</span><strong>${money(m.expected)}</strong></div>
          <div><span>Collected</span><strong>${money(m.deposits)}</strong></div>
          <div><span>Loan repayments</span><strong>${money(m.repayments)}</strong></div>
          <div><span>Interest paid</span><strong>${money(m.interestPaid)}</strong></div>
          <div><span>Loans given out</span><strong>${money(m.disbursed)}</strong></div>
          <div><span>Withdrawals</span><strong>${money(m.withdrawals)}</strong></div>
          <div><span>Remaining to be contributed</span><strong>${money(m.remaining)}</strong></div>
          <div><span>Remaining with keeper</span><strong>${money(m.keeperBalance)}</strong></div>
          <div><span>Locations / Members</span><strong>${activeGroups} / ${visibleCustomers().length}</strong></div>
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Recent Transactions</h2><button class="btn ghost" data-view-jump="reports">View reports</button></div>
        ${renderTransactionsTable(visibleTransactions().slice(-8).reverse())}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Members Behind</h2><button class="btn ghost" data-view-jump="reports">Full reports</button></div>
      ${renderArrearsTable(arrearsRows().slice(0, 8))}
    </div>
  `;
}

export function renderGroups() {
  if (isKBA()) return renderKbaGroups();
  return renderAdminGroupSetup();
}

export function renderKbaGroups() {
  const editing = rt.state.groups.find((group) => group.id === sessionStorage.getItem("edit_group_id"));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Location" : "Create Location"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelGroupEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="groupForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field"><label>Location Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
          <div class="field"><label>System Admin</label>${adminSelect("adminId", editing?.adminId)}</div>
          <div class="field full"><label>Note</label><textarea name="note" placeholder="Admin will complete executives and operating rules.">${escapeHtml(editing?.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save location" : "Create location"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Owner Access</h2></div>
        <div class="calc-list">
          <div><span>Create admins</span><strong>Yes</strong></div>
          <div><span>Create locations</span><strong>Yes</strong></div>
          <div><span>Operate location</span><strong>Admin only</strong></div>
          <div><span>View location activity</span><strong>All locations</strong></div>
        </div>
        <p class="notice">The owner creates the location and assigns the admin. The assigned admin completes setup and manages members, collections, loans, and messages.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Susu Locations</h2><button class="btn ghost" data-export="groups">Export CSV</button></div>
      ${renderGroupsTable()}
    </div>
  `;
}

export function renderAdminGroupSetup() {
  const group = primaryGroup();
  if (!group) return `
    <div class="panel">
      <div class="section-title"><h2>Create My Susu Location</h2></div>
      <form id="groupForm" class="form-grid">
        <div class="field"><label>Location Name</label><input name="name" value="${escapeAttr(currentUser()?.requestedGroupName || "")}" required /></div>
        <div class="field"><label>Money Keeper</label><input name="moneyKeeper" required /></div>
        <div class="field"><label>Money Counter</label><input name="moneyCounter" required /></div>
        <div class="field"><label>Contribution Every</label><input name="intervalDays" type="number" min="1" value="1" required /></div>
        <div class="field"><label>Number of collection days</label><input name="targetContributions" type="number" min="1" value="31" required /></div>
        <div class="field"><label>Default Amount</label><input name="defaultAmount" type="number" min="0" step="0.01" value="0" required /></div>
        <div class="field"><label>Loan Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${rt.state.settings.loanInterest}" required /></div>
        <div class="field full"><label>Arrangement Note</label><textarea name="note"></textarea></div>
        <div class="form-actions full"><button class="btn" type="submit">Create location</button></div>
      </form>
    </div>
  `;
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>${escapeHtml(group.name)}</h2></div>
        <form id="groupForm" class="form-grid">
          <input type="hidden" name="id" value="${group.id}" />
          <div class="field"><label>Money Keeper</label><input name="moneyKeeper" value="${escapeAttr(group.moneyKeeper || "")}" required /></div>
          <div class="field"><label>Money Counter</label><input name="moneyCounter" value="${escapeAttr(group.moneyCounter || "")}" required /></div>
          <div class="field"><label>Contribution Every</label><input name="intervalDays" type="number" min="1" value="${group.intervalDays || 7}" required /></div>
          <div class="field"><label>Number of collection days</label><input name="targetContributions" type="number" min="1" value="${group.targetContributions || 31}" required /></div>
          <div class="field"><label>Default Amount</label><input name="defaultAmount" type="number" min="0" step="0.01" value="${group.defaultAmount || 0}" required /></div>
          <div class="field"><label>Loan Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${group.interest ?? rt.state.settings.loanInterest}" required /></div>
          <div class="field full"><label>Arrangement Note</label><textarea name="note">${escapeHtml(group.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">Save location setup</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Automatic Calculation</h2></div>
        <div class="calc-list">
          <div><span>Members</span><strong>${groupSummary(group.id).members}</strong></div>
          <div><span>Total contributed</span><strong>${money(groupSummary(group.id).contributed)}</strong></div>
          <div><span>Expected at break</span><strong>${money(groupSummary(group.id).expected)}</strong></div>
          <div><span>Input admin</span><strong>${escapeHtml(userName(group.adminId))}</strong></div>
        </div>
      </div>
    </div>
  `;
}

export function renderGroupsTable() {
  const groups = visibleGroups();
  if (!groups.length) return `<div class="empty">No susu locations yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Executives</th><th>Operation</th><th>Members</th><th>Total Contributed</th><th>Expected At Break</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${groups.map((group) => {
            const summary = groupSummary(group.id);
            return `
              <tr>
                <td><strong>${escapeHtml(group.name)}</strong><br><span class="muted">${escapeHtml(group.note || "")}</span></td>
                <td>
                  Keeper: ${escapeHtml(group.moneyKeeper)}<br>
                  Counter: ${escapeHtml(group.moneyCounter)}<br>
                  Input: ${escapeHtml(userName(group.adminId))}
                </td>
                <td>Every ${group.intervalDays} day(s)<br>${group.targetContributions} sitting<br>${group.interest}% loan interest</td>
                <td>${summary.members}</td>
                <td>${money(summary.contributed)}</td>
                <td>${money(summary.expected)}</td>
                <td><span class="pill ${group.active ? "" : "bad"}">${group.active ? "Active" : "Closed"}</span></td>
                <td>${isKBA() ? `
                  <div class="row-actions">
                    <button class="btn secondary" data-group-detail="${group.id}">Details</button>
                    <button class="btn secondary" data-edit-group="${group.id}">Edit</button>
                    <button class="btn secondary" data-toggle-group="${group.id}">${group.active ? "Close" : "Reopen"}</button>
                    <button class="btn danger" data-delete-group="${group.id}">Delete</button>
                  </div>
                ` : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderCustomers() {
  if (isKBA()) return `<div class="notice">The owner can view member and money activity from Dashboard, Susu Locations, and Reports. Member registration is done by the assigned location admin.</div>`;
  if (!primaryGroup()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const customers = visibleCustomers();
  const editing = rt.state.customers.find((customer) => customer.id === sessionStorage.getItem("edit_customer_id") && visibleGroupIds().includes(customer.groupId));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Member" : "Register Member"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelCustomerEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="customerForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field"><label>Full Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeAttr(editing?.phone || "")}" required /></div>
          <div class="field"><label>NHIS</label><input name="nhis" type="number" min="0" step="0.01" value="${escapeAttr(editing?.nhis || "")}" /></div>
          <div class="field"><label>Susu Location</label>${groupSelect("groupId", editing?.groupId || "")}</div>
          <div class="field"><label>Contribution Amount</label><input name="dailyAmount" type="number" min="0" step="0.01" value="${editing?.dailyAmount || ""}" required /></div>
          <div class="field full"><label>Address</label><textarea name="address">${escapeHtml(editing?.address || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save member" : "Save member"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Customer Summary</h2></div>
        <table>
          <tr><td>Expected break value</td><td><strong>${money(customers.reduce((s, c) => s + perSittingAmount(c) * (groupById(c.groupId)?.targetContributions || rt.state.settings.collectionDays), 0))}</strong></td></tr>
          <tr><td>Active accounts</td><td><strong>${customers.filter((c) => c.active).length}</strong></td></tr>
          <tr><td>Average contribution</td><td><strong>${money(customers.length ? customers.reduce((s, c) => s + Number(c.dailyAmount || 0), 0) / customers.length : 0)}</strong></td></tr>
        </table>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Customers</h2><input id="customerSearch" placeholder="Search customers" /></div>
      <div id="customerTable">${renderCustomerTable(customers)}</div>
    </div>
  `;
}

export function renderCustomerTable(customers) {
  if (!customers.length) return `<div class="empty">No customers yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Account</th><th>Member</th><th>Location</th><th>Amount</th><th>Progress</th><th>Susu Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${customers.map((c) => `
            <tr>
              <td>${c.accountNo}</td>
              <td><strong>${escapeHtml(c.name)}</strong><br><span class="muted">${escapeHtml(c.phone)} · NHIS: ${money(Number(c.nhis || 0))}</span></td>
              <td>${escapeHtml(groupName(c.groupId))}</td>
              <td>${money(c.dailyAmount)} + ${money(c.nhis)} = ${money(perSittingAmount(c))}</td>
              <td>${memberProgress(c.id)}</td>
              <td>${money(customerBalance(c.id))}</td>
              <td><span class="pill ${c.active ? "" : "bad"}">${c.active ? "Active" : "Disabled"}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn secondary" data-edit-customer="${c.id}">Edit</button>
          <button class="btn secondary" data-member-detail="${c.id}">Details</button>
          <button class="btn secondary" data-print-statement="${c.id}">Statement</button>
          <button class="btn secondary" data-toggle-customer="${c.id}">${c.active ? "Disable" : "Enable"}</button>
                  <button class="btn danger" data-delete-customer="${c.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderCollections() {
  if (isKBA()) return `<div class="notice">The owner can view collection activity from Reports. Collections are recorded by assigned location admins.</div>`;
  if (!primaryGroup()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const editing = rt.state.collections.find((item) => item.id === sessionStorage.getItem("edit_collection_id") && visibleGroupIds().includes(item.groupId));
  const selectedCustomer = visibleCustomers().find((customer) => customer.id === editing?.customerId) || visibleCustomers().find((customer) => customer.active);
  const defaultCollectionAmount = selectedCustomer ? perSittingAmount(selectedCustomer) : "";
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Susu Collection" : "Record Susu Collection"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelCollectionEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="collectionForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field full"><label>Search Member</label><input id="collectionMemberSearch" placeholder="Type name, phone, NHIS, or account number" /></div>
          <div class="field"><label>Customer</label>${customerSelect("customerId", editing?.customerId || "")}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" value="${editing?.amount || defaultCollectionAmount}" required /></div>
          <div class="field"><label>Sitting Paid</label><input name="sittingsPaid" type="number" min="1" value="${editing?.sittingsPaid || ""}" placeholder="Auto from amount" /></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          <div class="field"><label>Status</label><select name="status">${["Paid", "Partial", "Missed"].map((status) => `<option ${editing?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
          <div class="field full"><label>Note</label><textarea name="note">${escapeHtml(editing?.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save collection" : "Record collection"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Withdraw Savings</h2></div>
        <form id="withdrawForm" class="form-grid">
          <div class="field"><label>Customer</label>${customerSelect("customerId")}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" required /></div>
          <div class="field full"><label>Reason</label><textarea name="note"></textarea></div>
          <div class="form-actions full"><button class="btn warning" type="submit">Record withdrawal</button></div>
        </form>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Collection Records</h2><div class="row-actions"><input id="collectionSearch" placeholder="Search member or date" /><button class="btn ghost" data-export="collections">Export CSV</button></div></div>
      <div id="collectionTable">${renderCollectionsTable(visibleCollections())}</div>
    </div>
  `;
}

export function renderCollectionsTable(collections = visibleCollections()) {
  if (!collections.length) return `<div class="empty">No collections recorded yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Customer</th><th>Sitting Paid</th><th>Amount</th><th>Status</th><th>Officer</th><th>Note</th><th>SMS</th><th></th></tr></thead>
        <tbody>
          ${collections.slice().reverse().map((item) => `
            <tr>
              <td>${item.date}</td>
              <td>${escapeHtml(groupName(item.groupId))}</td>
              <td>${escapeHtml(customerName(item.customerId))}</td>
              <td>${item.sittingsPaid || item.contributionNo || ""}</td>
              <td>${money(item.amount)}</td>
              <td><span class="pill ${item.status === "Missed" ? "bad" : item.status === "Partial" ? "warn" : ""}">${item.status}</span></td>
              <td>${escapeHtml(userName(item.userId))}</td>
              <td>${escapeHtml(item.note || "")}</td>
              <td>${Number(item.amount || 0) > 0 ? `<button class="btn secondary" data-send-collection-sms="${item.id}">Send SMS</button>` : ""}</td>
              <td><div class="row-actions"><button class="btn secondary" data-edit-collection="${item.id}">Edit</button><button class="btn danger" data-delete-collection="${item.id}">Delete</button></div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderLoans() {
  if (isKBA()) return `<div class="notice">The owner can view loan activity from Reports. Loans are managed by assigned location admins.</div>`;
  if (!primaryGroup()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const editing = rt.state.loans.find((loan) => loan.id === sessionStorage.getItem("edit_loan_id") && visibleGroupIds().includes(loan.groupId));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Loan" : "Create Loan"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelLoanEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="loanForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field"><label>Customer</label>${customerSelect("customerId", editing?.customerId)}</div>
          <div class="field"><label>Principal</label><input name="principal" type="number" min="0" step="0.01" value="${editing?.principal || ""}" required /></div>
          <div class="field"><label>Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${editing?.interest ?? rt.state.settings.loanInterest}" required /></div>
          <div class="field"><label>Interest Months</label><input name="interestMonths" type="number" min="1" value="${editing?.interestMonths || 6}" required /></div>
          <div class="field"><label>Loan Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          <div class="field full"><label>Purpose</label><textarea name="purpose">${escapeHtml(editing?.purpose || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save loan" : "Approve and disburse"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Loan Summary</h2></div>
        <div class="calc-list">
          <div><span>Total loan given</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Number(loan.principal || 0), 0))}</strong></div>
          <div><span>Loan repaid</span><strong>${money(sumTransactions("Loan Repayment"))}</strong></div>
          <div><span>Interest paid</span><strong>${money(sumTransactions("Interest Payment"))}</strong></div>
          <div><span>Outstanding loans</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0))}</strong></div>
        </div>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn secondary" data-view-jump="loanRepayments">Loan Repayments</button>
          <button class="btn secondary" data-view-jump="interestPayments">Interest Payments</button>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loans</h2><button class="btn ghost" data-export="loans">Export CSV</button></div>
      ${renderLoansTable()}
    </div>
  `;
}

export function renderLoansTable() {
  if (!visibleLoans().length) return `<div class="empty">No loans created yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Customer</th><th>Principal</th><th>Monthly Interest</th><th>Interest Schedule</th><th>Total Due</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleLoans().slice().reverse().map((loan) => `
            <tr>
              <td>${loan.date}</td>
              <td>${escapeHtml(groupName(loan.groupId))}</td>
              <td>${escapeHtml(customerName(loan.customerId))}<br><span class="muted">${escapeHtml(loan.purpose || "")}</span></td>
              <td>${money(loan.principal)}</td>
              <td>${loan.interest}%<br><span class="muted">${money(monthlyInterestAmount(loan))}</span></td>
              <td>${renderInterestSchedule(loan)}</td>
              <td>${money(loan.totalDue)}</td>
              <td>${money(loan.amountPaid)}</td>
              <td>${money(Math.max(0, loan.totalDue - loan.amountPaid))}</td>
              <td><span class="pill ${loan.status === "Completed" ? "" : "blue"}">${loan.status}</span></td>
              <td>
                <div class="row-actions">
                  <button class="btn secondary" data-send-loan-sms="${loan.id}">Send SMS</button>
                  <button class="btn secondary" data-edit-loan="${loan.id}">Edit</button>
                  <button class="btn danger" data-delete-loan="${loan.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderLoanRepayments() {
  if (isKBA()) return `<div class="notice">The owner can view repayment activity from Reports. Loan repayments are managed by assigned location admins.</div>`;
  if (!primaryGroup()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const editing = rt.state.transactions.find((tx) => tx.id === sessionStorage.getItem("edit_repayment_id") && tx.type === "Loan Repayment" && visibleTransactions().includes(tx));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Loan Repayment" : "Record Loan Repayment"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelRepaymentEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="repaymentForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field full"><label>Loan</label>${loanSelect("loanId", editing?.ref)}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" value="${editing?.amount || ""}" required /></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          <div class="field full"><label>Note</label><textarea name="note">${escapeHtml(editing?.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save repayment" : "Record repayment"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Repayment Summary</h2></div>
        <div class="calc-list">
          <div><span>Loan repaid</span><strong>${money(sumTransactions("Loan Repayment"))}</strong></div>
          <div><span>Interest paid</span><strong>${money(sumTransactions("Interest Payment"))}</strong></div>
          <div><span>Active loans</span><strong>${visibleLoans().filter((loan) => loan.status === "Active").length}</strong></div>
          <div><span>Outstanding loans</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0))}</strong></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loan Repayment Records</h2><button class="btn ghost" data-export="repayments">Export CSV</button></div>
      ${renderLoanRepaymentsTable()}
    </div>
  `;
}

export function renderLoanRepaymentsTable() {
  const rows = visibleTransactions().filter((tx) => tx.type === "Loan Repayment").slice().reverse();
  if (!rows.length) return `<div class="empty">No loan repayments recorded yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Member</th><th>Loan</th><th>Amount</th><th>Officer</th><th></th></tr></thead>
        <tbody>
          ${rows.map((tx) => {
            const loan = rt.state.loans.find((item) => item.id === tx.ref);
            const customer = rt.state.customers.find((item) => item.id === tx.customerId);
            return `
              <tr>
                <td>${tx.date}</td>
                <td>${escapeHtml(groupName(customer?.groupId || loan?.groupId))}</td>
                <td>${escapeHtml(customerName(tx.customerId))}</td>
                <td>${loan ? `${money(loan.principal)} - balance ${money(Math.max(0, loan.totalDue - loan.amountPaid))}` : escapeHtml(tx.ref)}</td>
                <td>${money(tx.amount)}</td>
                <td>${escapeHtml(userName(tx.userId))}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn secondary" data-edit-repayment="${tx.id}">Edit</button>
                    <button class="btn danger" data-delete-repayment="${tx.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMemberLoansTable(loans) {
  if (!loans.length) return `<div class="empty">No loans recorded for this member.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Principal</th><th>Monthly Interest</th><th>Interest Schedule</th><th>Total Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          ${loans.map((loan) => `
            <tr>
              <td>${loan.date}</td>
              <td>${money(loan.principal)}</td>
              <td>${loan.interest}%<br><span class="muted">${money(monthlyInterestAmount(loan))}</span></td>
              <td>${renderInterestSchedule(loan)}</td>
              <td>${money(loan.totalDue)}</td>
              <td>${money(loan.amountPaid)}</td>
              <td>${money(Math.max(0, loan.totalDue - loan.amountPaid))}</td>
              <td><span class="pill ${loan.status === "Completed" ? "" : "blue"}">${loan.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderInterestSchedule(loan) {
  const schedule = ensureLoanInterestSchedule(loan);
  return `
    <div class="mini-list">
      ${schedule.map((item, index) => `<span>${index + 1}. ${item.date}: ${money(item.amount)}${item.status === "Paid" ? " paid" : ""}</span>`).join("")}
    </div>
  `;
}

export function renderInterestPayments() {
  const rows = interestPaymentRows();
  const pending = rows.filter((row) => interestPaymentStatus(row.entry) !== "Paid");
  const overdue = rows.filter((row) => interestPaymentStatus(row.entry) === "Overdue");
  const paid = rows.filter((row) => interestPaymentStatus(row.entry) === "Paid");
  const pendingAmount = pending.reduce((sum, row) => sum + Number(row.entry.amount || 0), 0);
  const paidAmount = paid.reduce((sum, row) => sum + Number(row.entry.amount || 0), 0);

  return `
    <div class="grid four">
      <div class="stat"><small>Pending Interest</small><strong>${money(pendingAmount)}</strong></div>
      <div class="stat"><small>Pending Count</small><strong>${pending.length}</strong></div>
      <div class="stat"><small>Overdue</small><strong>${overdue.length}</strong></div>
      <div class="stat"><small>Paid Interest</small><strong>${money(paidAmount)}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Interest Payment Schedule</h2>
        <button class="btn ghost" data-export="loans">Export CSV</button>
      </div>
      ${renderInterestPaymentsTable(rows)}
    </div>
  `;
}

export function renderInterestPaymentsTable(rows = interestPaymentRows()) {
  if (!rows.length) return `<div class="empty">No interest schedules found yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Phone</th><th>Loan Date</th><th>Month</th><th>Due Date</th><th>Interest</th><th>Status</th><th>Paid Date</th><th></th></tr></thead>
        <tbody>
          ${rows.map(({ loan, entry, index }) => {
            const customer = rt.state.customers.find((item) => item.id === loan.customerId);
            const status = interestPaymentStatus(entry);
            return `
              <tr>
                <td>${escapeHtml(groupName(loan.groupId))}</td>
                <td>${escapeHtml(customer?.name || customerName(loan.customerId))}<br><span class="muted">${money(loan.principal)} loan</span></td>
                <td>${escapeHtml(customer?.phone || "")}</td>
                <td>${loan.date}</td>
                <td>${entry.month || index + 1} of ${loan.interestMonths || ensureLoanInterestSchedule(loan).length}</td>
                <td>${entry.date}</td>
                <td>${money(entry.amount)}</td>
                <td><span class="pill ${status === "Overdue" ? "bad" : status === "Pending" ? "blue" : ""}">${status}</span></td>
                <td>${entry.paidAt || ""}</td>
                <td>${isAdmin() ? (status !== "Paid" ? `<button class="btn secondary" data-pay-interest="${loan.id}|${index}">Pay Interest</button>` : `<button class="btn danger" data-undo-interest="${loan.id}|${index}">Undo</button>`) : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMessages() {
  if (isKBA()) return `<div class="notice">The owner can view member messages from Reports. Payment messages are handled by assigned location admins.</div>`;
  return `
    <div class="panel">
      <div class="section-title">
        <h2>Payment Messages</h2>
        <div class="row-actions">
          <button class="btn" id="sendSelectedMessagesBtn">Send selected</button>
          <button class="btn secondary" id="markSelectedMessagesBtn">Mark sent</button>
          <button class="btn warning" id="cancelSelectedMessagesBtn">Cancel selected</button>
          <button class="btn ghost" data-export="messages">Export CSV</button>
          <button class="btn warning" id="cancelPendingMessagesBtn">Cancel pending</button>
          <button class="btn danger" id="clearMessagesBtn">Clear messages</button>
        </div>
      </div>
      ${renderMessagesTable()}
    </div>
  `;
}

export function renderBackup() {
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Local Backup</h2></div>
        <p class="muted">Export a full copy of this system, or restore from a JSON backup file.</p>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn" id="backupBtn">Export backup</button>
          <label class="btn secondary" for="restoreInput">Restore backup</label>
          <input id="restoreInput" type="file" accept="application/json" hidden />
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Cloud Backup</h2></div>
        <p class="muted">Use this to force a cloud save or restore when you need the phone and computer to match immediately.</p>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn" id="pushCloudBackup">Back up to cloud</button>
          <button class="btn secondary" id="pullCloudBackup">Restore cloud backup</button>
          <button class="btn warning" id="replaceCloudBackup">Replace this device from cloud</button>
        </div>
        <div class="notice good">Automatic cloud sync still runs when internet is available.</div>
      </div>
    </div>
  `;
}

export function renderGroupDetail() {
  if (!isKBA()) return `<div class="notice">Only the owner can open full location details.</div>`;
  const groupId = sessionStorage.getItem("detail_group_id");
  const group = rt.state.groups.find((item) => item.id === groupId);
  if (!group) return `<div class="notice">Location not found.</div>`;
  const members = rt.state.customers.filter((customer) => customer.groupId === group.id);
  const summary = groupSummary(group.id);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(group.name)} Details</h2>
        <button class="btn ghost" data-back-view="groups">Back to locations</button>
      </div>
      <div class="grid four">
        <div class="stat"><small>Members</small><strong>${members.length}</strong></div>
        <div class="stat"><small>Total Contributed</small><strong>${money(summary.contributed)}</strong></div>
        <div class="stat"><small>Expected At Break</small><strong>${money(summary.expected)}</strong></div>
        <div class="stat"><small>Active Loans</small><strong>${rt.state.loans.filter((loan) => loan.groupId === group.id && loan.status === "Active").length}</strong></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Members And Contributions</h2><button class="btn ghost" data-export="distribution">Export CSV</button></div>
      ${renderGroupMembersTable(members)}
    </div>
  `;
}

export function renderGroupMembersTable(members) {
  if (!members.length) return `<div class="empty">No members in this location yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Account</th><th>Member</th><th>Phone</th><th>Per Sitting</th><th>Progress</th><th>Total Contribution</th><th>Loan Balance</th><th>Final Payout</th></tr></thead>
        <tbody>
          ${members.map((member) => {
            const contributed = customerBalance(member.id);
            const loanBalance = loanBalanceForCustomer(member.id);
            return `
              <tr>
                <td>${escapeHtml(member.accountNo)}</td>
                <td><strong>${escapeHtml(member.name)}</strong></td>
                <td>${escapeHtml(member.phone)}</td>
                <td>${money(perSittingAmount(member))}</td>
                <td>${memberProgress(member.id)}</td>
                <td>${money(contributed)}</td>
                <td>${money(loanBalance)}</td>
                <td>${money(Math.max(0, contributed - loanBalance))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMemberDetail() {
  const customerId = sessionStorage.getItem("detail_customer_id");
  const customer = rt.state.customers.find((item) => item.id === customerId);
  if (!customer || (!isKBA() && !visibleGroupIds().includes(customer.groupId))) return `<div class="notice">Member not found or not assigned to you.</div>`;
  const txs = rt.state.transactions.filter((tx) => tx.customerId === customer.id).slice().reverse();
  const collections = rt.state.collections.filter((item) => item.customerId === customer.id).slice().reverse();
  const loans = rt.state.loans.filter((loan) => loan.customerId === customer.id).slice().reverse();
  const messages = rt.state.messages.filter((message) => message.customerId === customer.id).slice().reverse();
  const sitting = memberSittingSummary(customer.id);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(customer.name)}</h2>
        <div class="row-actions">
          <button class="btn secondary" data-print-statement="${customer.id}">Print statement</button>
          <button class="btn ghost" data-back-view="${isKBA() ? "groupDetail" : "customers"}">${isKBA() ? "Back" : "Back to members"}</button>
        </div>
      </div>
      <div class="grid four">
        <div class="stat"><small>Group</small><strong>${escapeHtml(groupName(customer.groupId))}</strong></div>
        <div class="stat"><small>Total Contribution</small><strong>${money(customerBalance(customer.id))}</strong></div>
        <div class="stat"><small>Loan Balance</small><strong>${money(loanBalanceForCustomer(customer.id))}</strong></div>
        <div class="stat"><small>Progress</small><strong>${memberProgress(customer.id)}</strong></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Sitting Summary</h2></div>
      <div class="grid four">
        <div class="stat"><small>Total Sitting</small><strong>${sitting.target}</strong><span>${money(sitting.expectedAmount)}</span></div>
        <div class="stat"><small>Sitting Paid</small><strong>${sitting.paid}</strong><span>${money(sitting.paidAmount)}</span></div>
        <div class="stat"><small>Remaining Sitting</small><strong>${sitting.remaining}</strong><span>${money(sitting.remainingAmount)}</span></div>
        <div class="stat"><small>Per Sitting</small><strong>${money(sitting.perSitting)}</strong><span>Amount + NHIS</span></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Collections</h2></div>
      ${renderCollectionsTable(collections)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loans</h2></div>
      ${renderMemberLoansTable(loans)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Transactions</h2></div>
      ${renderTransactionsTable(txs)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Messages</h2></div>
      ${renderMemberMessagesTable(messages)}
    </div>
  `;
}

export function renderMessagesTable() {
  if (!visibleMessages().length) return `<div class="empty">No member messages yet. A confirmation will appear here after each susu payment.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th><input type="checkbox" id="selectAllMessages" /></th><th>Date</th><th>Type</th><th>Member</th><th>Phone</th><th>Amount</th><th>Total</th><th>Message</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleMessages().slice().reverse().map((message) => `
            <tr>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<input type="checkbox" data-message-select="${message.id}" />`}</td>
              <td>${message.date}</td>
              <td>${escapeHtml(message.kind || "Payment")}</td>
              <td>${escapeHtml(customerName(message.customerId))}</td>
              <td>${escapeHtml(message.phone)}</td>
              <td>${money(message.amountPaid)}</td>
              <td>${money(message.totalContributed)}</td>
              <td>${escapeHtml(message.body)}</td>
              <td><span class="pill ${message.status === "Cancelled" ? "bad" : message.status === "Sent" ? "" : "blue"}">${message.status}</span></td>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<button class="btn secondary" data-send-message="${message.id}">Send SMS</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function selectedMessageIds() {
  return Array.from(document.querySelectorAll("[data-message-select]:checked")).map((input) => input.dataset.messageSelect);
}

export function renderMemberMessagesTable(messages) {
  if (!messages.length) return `<div class="empty">No messages recorded for this member.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Phone</th><th>Message</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${messages.map((message) => `
            <tr>
              <td>${message.date}</td>
              <td>${escapeHtml(message.kind || "Payment")}</td>
              <td>${escapeHtml(message.phone)}</td>
              <td>${escapeHtml(message.body)}</td>
              <td><span class="pill ${message.status === "Cancelled" ? "bad" : message.status === "Sent" ? "" : "blue"}">${message.status}</span></td>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<button class="btn secondary" data-send-message="${message.id}">Send SMS</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderImports() {
  if (isKBA()) return `<div class="notice">The owner can view imported activity from Reports. Uploads are done by assigned location admins.</div>`;
  if (!primaryGroup()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Upload Existing Records</h2></div>
        <form id="importForm" class="form-grid">
          <div class="field full">
            <label>File</label>
            <input name="file" type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.txt" required />
          </div>
          <div class="field">
            <label>PDF/DOCX Record Type</label>
            <select name="kind">
              <option value="auto">Auto / Excel Sheets</option>
              <option value="savings">Savings Sheet</option>
              <option value="loans">Loan Sheet</option>
              <option value="log">Log Sheet</option>
            </select>
          </div>
          <div class="field">
            <label>Group</label>
            ${groupSelect("groupId")}
          </div>
          <div class="form-actions full"><button class="btn" type="submit">Deduce and import</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Expected Columns</h2></div>
        <div class="calc-list">
          <div><span>Savings</span><strong>date, name, phone, NHIS, amount, total</strong></div>
          <div><span>Loans</span><strong>date, name, principal, interest, interest months, total, paid</strong></div>
          <div><span>Log</span><strong>date, name/user, action, details</strong></div>
        </div>
        <p class="notice">Excel files work best when sheet names include Savings, Loans, or Log. PDF/DOCX files must contain selectable text, not only scanned images.</p>
      </div>
    </div>
    <div id="importResult" class="panel" style="margin-top:18px">
      <div class="empty">Upload a file to preview the import result.</div>
    </div>
  `;
}

export function renderReports() {
  const m = metrics();
  const range = reportDateRange();
  const reportTransactions = visibleTransactions().filter((tx) => tx.date >= range.from && tx.date <= range.to);
  return `
    <div class="grid four">
      <div class="stat"><small>Cash In</small><strong>${money(m.deposits + m.repayments + m.interestPaid)}</strong></div>
      <div class="stat"><small>Cash Out</small><strong>${money(m.withdrawals + m.disbursed)}</strong></div>
      <div class="stat"><small>Net Cash</small><strong>${money(m.keeperBalance)}</strong></div>
      <div class="stat"><small>Expected Interest</small><strong>${money(visibleLoans().reduce((s, l) => s + (l.totalDue - l.principal), 0))}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Report Period</h2>
        <div class="row-actions">
          <button class="btn secondary" data-report-range="today">Today</button>
          <button class="btn secondary" data-report-range="yesterday">Yesterday</button>
          <button class="btn secondary" data-report-range="week">This Week</button>
          <button class="btn secondary" data-report-range="month">This Month</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>From</label><input id="reportFrom" type="date" value="${range.from}" /></div>
        <div class="field"><label>To</label><input id="reportTo" type="date" value="${range.to}" /></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Daily Money Received</h2>
        <button class="btn ghost" data-export="dailyLog">Export CSV</button>
      </div>
      ${renderDailyMoneyLogTable(dailyMoneyLogRows(range.from, range.to))}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Member Financial Report</h2>
        <button class="btn ghost" data-export="memberReport">Export CSV</button>
      </div>
      ${renderMemberFinancialReportTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Transaction Ledger</h2>
        <div class="row-actions">
          <button class="btn ghost" data-export="transactions">Export CSV</button>
          <button class="btn ghost" onclick="window.print()">Print</button>
        </div>
      </div>
      ${renderTransactionsTable(reportTransactions.slice().reverse())}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Members Behind</h2>
        <button class="btn ghost" data-export="arrears">Export CSV</button>
      </div>
      ${renderArrearsTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Break / Distribution</h2>
        <button class="btn ghost" data-export="distribution">Export CSV</button>
      </div>
      ${renderDistributionTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Audit Trail</h2>
        <button class="btn ghost" data-export="audit">Export CSV</button>
      </div>
      ${renderAuditTable()}
    </div>
  `;
}

export function renderLogs() {
  const selectedDate = sessionStorage.getItem("log_date") || today();
  const rows = dailyInputLogRows(selectedDate);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>Daily Input Log</h2>
        <div class="row-actions">
          <input id="logDate" type="date" value="${selectedDate}" />
          <button class="btn secondary" id="todayLogBtn" type="button">Today</button>
          <button class="btn ghost" id="printLogBtn" type="button">Print / PDF</button>
          <button class="btn ghost" data-export="dailyInputs">Export CSV</button>
        </div>
      </div>
      <div class="notice good">This shows all money inputs recorded for the selected day: contributions, loan repayments, and interest payments.</div>
      <div id="dailyInputLogTable">${renderDailyInputLogTable(rows)}</div>
    </div>
  `;
}

export function renderDailyInputLogTable(rows = dailyInputLogRows()) {
  if (!rows.length) return `<div class="empty">No inputs recorded for this date.</div>`;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Date</th><th>Location</th><th>Member</th><th>Input Type</th><th>Amount</th><th>Officer</th><th>Reference</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.time)}</td>
              <td>${escapeHtml(row.date)}</td>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${escapeHtml(row.type)}</td>
              <td>${money(row.amount)}</td>
              <td>${escapeHtml(row.officer)}</td>
              <td>${escapeHtml(row.ref)}</td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="5"><strong>Total received</strong></td>
            <td><strong>${money(total)}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function renderDailyClosing() {
  const selectedDate = sessionStorage.getItem("closing_date") || today();
  const expected = expectedCashForDate(selectedDate);
  const closing = visibleClosings().find((item) => item.date === selectedDate);
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Close Day</h2></div>
        <form id="closingForm" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${selectedDate}" required /></div>
          <div class="field"><label>System Expected Cash</label><input name="expected" type="number" step="0.01" value="${expected}" readonly /></div>
          <div class="field"><label>Cash Counted</label><input name="counted" type="number" min="0" step="0.01" value="${closing?.counted || ""}" required /></div>
          <div class="field"><label>Closed By</label><input name="closedByName" value="${escapeAttr(closing?.closedByName || currentUser()?.name || "")}" required /></div>
          <div class="field full"><label>Note</label><textarea name="note">${escapeHtml(closing?.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${closing ? "Update closing" : "Save closing"}</button><button class="btn ghost" type="button" id="printClosingBtn">Print / PDF</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>${selectedDate} Summary</h2></div>
        <div class="calc-list">
          <div><span>System expected</span><strong>${money(expected)}</strong></div>
          <div><span>Cash counted</span><strong>${money(closing?.counted || 0)}</strong></div>
          <div><span>Shortage / overage</span><strong>${money(Number(closing?.counted || 0) - expected)}</strong></div>
          <div><span>Status</span><strong>${closing ? "Closed" : "Open"}</strong></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Closing History</h2><button class="btn ghost" data-export="closings">Export CSV</button></div>
      ${renderClosingsTable()}
    </div>
  `;
}

export function renderClosingsTable() {
  const rows = visibleClosings().slice().reverse();
  if (!rows.length) return `<div class="empty">No daily closings yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Expected</th><th>Counted</th><th>Short / Over</th><th>Closed By</th><th>Note</th><th></th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <td>${row.date}</td>
            <td>${escapeHtml(groupName(row.groupId))}</td>
            <td>${money(row.expected)}</td>
            <td>${money(row.counted)}</td>
            <td>${money(row.difference)}</td>
            <td>${escapeHtml(row.closedByName || userName(row.userId))}</td>
            <td>${escapeHtml(row.note || "")}</td>
            <td><button class="btn secondary" data-print-closing="${row.id}">Print</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderDistributionTable() {
  const rows = distributionRows();
  if (!rows.length) return `<div class="empty">No members available for distribution calculation.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Contributed</th><th>Loan Balance</th><th>Final Payout</th><th>Sitting</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${money(row.contributed)}</td>
              <td>${money(row.loanBalance)}</td>
              <td><strong>${money(row.finalPayout)}</strong></td>
              <td>${row.settingsPaid} / ${row.settingsTarget}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderDailyMoneyLogTable(rows = dailyMoneyLogRows()) {
  if (!rows.length) return `<div class="empty">No money received yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Susu Contributions</th><th>Loan Repaid</th><th>Interest Paid</th><th>Total Received</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.date}</td>
              <td>${money(row.contributions)}</td>
              <td>${money(row.loanRepaid)}</td>
              <td>${money(row.interestPaid)}</td>
              <td><strong>${money(row.totalReceived)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMemberFinancialReportTable() {
  const rows = memberFinancialReportRows();
  if (!rows.length) return `<div class="empty">No members available for report.</div>`;
  const totals = rows.reduce((sum, row) => ({
    contribution: sum.contribution + row.totalContribution,
    loan: sum.loan + row.totalLoan,
    loanRepaid: sum.loanRepaid + row.loanRepaid,
    interestPaid: sum.interestPaid + row.interestPaid,
    interestRemaining: sum.interestRemaining + row.interestRemaining,
    amountToReceive: sum.amountToReceive + row.amountToReceive
  }), { contribution: 0, loan: 0, loanRepaid: 0, interestPaid: 0, interestRemaining: 0, amountToReceive: 0 });
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Total Contributions</th><th>Total Loan</th><th>Loan Repaid</th><th>Interest Paid</th><th>Interest Remaining</th><th>Amount To Receive</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${money(row.totalContribution)}</td>
              <td>${money(row.totalLoan)}</td>
              <td>${money(row.loanRepaid)}</td>
              <td>${money(row.interestPaid)}</td>
              <td>${money(row.interestRemaining)}</td>
              <td><strong>${money(row.amountToReceive)}</strong></td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="2"><strong>Totals</strong></td>
            <td><strong>${money(totals.contribution)}</strong></td>
            <td><strong>${money(totals.loan)}</strong></td>
            <td><strong>${money(totals.loanRepaid)}</strong></td>
            <td><strong>${money(totals.interestPaid)}</strong></td>
            <td><strong>${money(totals.interestRemaining)}</strong></td>
            <td><strong>${money(totals.amountToReceive)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function renderAuditTable() {
  const rows = visibleAudit().slice().reverse();
  if (!rows.length) return `<div class="empty">No audit activity yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.date}</td>
              <td>${escapeHtml(userName(row.userId))}</td>
              <td>${escapeHtml(row.action)}</td>
              <td>${escapeHtml(row.details || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderTransactionsTable(transactions) {
  if (!transactions.length) return `<div class="empty">No transactions yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Amount</th><th>Officer</th><th>Reference</th></tr></thead>
        <tbody>
          ${transactions.map((tx) => `
            <tr>
              <td>${tx.date}</td>
              <td>${tx.type}</td>
              <td>${escapeHtml(customerName(tx.customerId))}</td>
              <td>${money(tx.amount)}</td>
              <td>${escapeHtml(userName(tx.userId))}</td>
              <td><button class="btn secondary" data-receipt="${tx.id}">Receipt</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderSettings() {
  if (!isKBA()) return `<div class="notice">System defaults are controlled by the owner. Location operating rules are managed from My Location.</div>`;
  const syncMode = getSyncMode(rt.state);
  return `
    <div class="panel">
      <div class="section-title"><h2>System Controls</h2></div>
      <form id="settingsForm" class="form-grid">
        <div class="field"><label>Business Name</label><input name="businessName" value="${escapeAttr(rt.state.settings.businessName)}" required /></div>
        <div class="field"><label>Currency</label><input name="currency" value="${escapeAttr(rt.state.settings.currency)}" required /></div>
        <div class="field"><label>Default Loan Interest %</label><input name="loanInterest" type="number" min="0" step="0.01" value="${rt.state.settings.loanInterest}" required /></div>
        <div class="field"><label>Business ID</label><input name="businessId" value="${escapeAttr(businessId())}" readonly /></div>
        <div class="field"><label>Cloud Mode</label><select name="cloudMode"><option value="auto" ${rt.state.settings.cloudMode === "auto" ? "selected" : ""}>Auto detect</option><option value="supabase" ${rt.state.settings.cloudMode === "supabase" ? "selected" : ""}>Supabase</option><option value="local" ${rt.state.settings.cloudMode === "local" ? "selected" : ""}>Local backup server</option></select></div>
        <div class="field full"><label>Supabase Project URL</label><input name="cloudUrl" value="${escapeAttr(cloudUrl())}" placeholder="https://your-project.supabase.co" /></div>
        <div class="field full"><label>Supabase Anon Key</label><textarea name="cloudKey" placeholder="Paste Supabase anon public key">${escapeHtml(cloudKey())}</textarea></div>
        <div class="field full"><label>Local Backup URL</label><input name="localBackupUrl" value="${escapeAttr(localBackupUrl())}" placeholder="http://localhost:8787" /></div>
        <div class="field full"><label>Sync Token</label><input name="syncToken" value="${escapeAttr(rt.state.settings.syncToken || "")}" placeholder="Optional token for local backup server" /></div>
        <div class="form-actions full"><button class="btn" type="submit">Save settings</button></div>
      </form>
      <div class="notice">Active sync mode: <strong>${syncMode}</strong>. Supabase stores online snapshots. The local backup URL uses the desktop sync server at /backup. Copy config.example.json to config.json for deployment defaults.</div>
    </div>
  `;
}

export function renderUsers() {
  if (!canManageUsers()) return `<div class="notice">Only the owner can create admins and staff.</div>`;
  const actor = currentUser();
  const editing = listUsersForActor(rt.state.users, actor).find((user) => user.id === sessionStorage.getItem("edit_user_id") && canEditUserAccount(actor, user));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Admin" : "Create Admin"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelUserEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="userForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field"><label>Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
          <div class="field"><label>Username</label><input name="username" value="${escapeAttr(editing?.username || "")}" required /></div>
          <div class="field"><label>Password</label><input name="password" ${editing ? `placeholder="Leave blank to keep current password"` : "required"} /></div>
          <div class="field"><label>Role</label><select name="role">${["Admin", "Input Officer", "Money Keeper", "Money Counter"].map((role) => `<option ${editing?.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save admin" : "Create user"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Permissions</h2></div>
        <table>
          <tr><td>Owner</td><td>Create admins, create susu locations, assign admins, and view all location activity.</td></tr>
          <tr><td>Admin</td><td>Set up assigned location, register members, record collections, manage loans, and handle messages.</td></tr>
          <tr><td>Input Officer</td><td>Record member activity for assigned locations.</td></tr>
          <tr><td>Money Keeper</td><td>View reports, logs, and daily closing records for cash accountability.</td></tr>
          <tr><td>Money Counter</td><td>View reports and support daily cash verification.</td></tr>
        </table>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Users</h2></div>
      ${renderUsersTable()}
    </div>
  `;
}

export function renderUsersTable() {
  const actor = currentUser();
  const visibleUsers = listUsersForActor(rt.state.users, actor);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>Requested Group</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleUsers.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.username)}</td>
              <td>${escapeHtml(u.requestedGroupName || "")}</td>
              <td>${u.role}</td>
              <td><span class="pill ${u.pending ? "warn" : u.active ? "" : "bad"}">${u.pending ? "Pending" : u.active ? "Active" : "Disabled"}</span></td>
              <td>${isProtectedOwnerAccount(u) || isSystemDeveloperAccount(u) ? "" : `
                <div class="row-actions">
                  ${canEditUserAccount(actor, u) ? `<button class="btn secondary" data-edit-user="${u.id}">Edit</button>` : ""}
                  ${canDisableUserAccount(actor, u) ? `<button class="btn secondary" data-toggle-user="${u.id}">${u.active ? "Disable" : "Activate"}</button>` : ""}
                  ${canDeleteUserAccount(actor, u) ? `<button class="btn danger" data-delete-user="${u.id}">Delete</button>` : ""}
                </div>
              `}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

