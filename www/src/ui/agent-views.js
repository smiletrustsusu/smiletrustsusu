/**
 * Agent & Collector Management screens: list, profile, desk, routes, reports.
 */
import { formatGhs } from "../core/money.js";
import {
  AGENT_STATUSES,
  EMPLOYMENT_TYPES,
  ID_TYPES,
  JOB_TITLES,
  LEAVE_TYPES,
  VISIT_PURPOSES,
  VISIT_OUTCOMES,
  AGENT_DOC_TYPES,
  EXPENSE_FIELD_CATEGORIES,
  PRODUCT_PERMISSIONS,
  ATTENDANCE_STATUSES
} from "../core/agent-ops.js";
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

function toneForStatus(status) {
  if (status === "Active" || status === "Present") return "";
  if (status === "On Leave" || status === "Late" || status === "Probation" || status === "Pending") return "warn";
  return "bad";
}

export function renderAgentOpsFormExtras(editing = {}, supervisors = []) {
  // Explicit null (create-staff form) must not throw — default params do not apply to null.
  const profile = editing && typeof editing === "object" ? editing : {};
  const perms = profile.productPermissions || {};
  return `
    <div class="section-title full"><h3>Agent Identity & Contact</h3></div>
    <div class="field"><label>Employee Number</label><input name="employeeNumber" value="${escapeAttr(profile.employeeNumber || profile.agentCode || "")}" placeholder="Auto if blank" /></div>
    <div class="field"><label>Gender</label><select name="gender">${optionList(["", "Male", "Female"], profile.gender || "")}</select></div>
    <div class="field"><label>Date of Birth</label><input name="dateOfBirth" type="date" value="${escapeAttr(profile.dateOfBirth || "")}" /></div>
    <div class="field"><label>Nationality</label><input name="nationality" value="${escapeAttr(profile.nationality || "Ghanaian")}" /></div>
    <div class="field"><label>Marital Status</label><select name="maritalStatus">${optionList(["", "Single", "Married", "Divorced", "Widowed"], profile.maritalStatus || "")}</select></div>
    <div class="field"><label>Secondary Phone</label><input name="phoneSecondary" value="${escapeAttr(profile.phoneSecondary || "")}" /></div>
    <div class="field"><label>WhatsApp</label><input name="whatsapp" value="${escapeAttr(profile.whatsapp || profile.phone || "")}" /></div>
    <div class="field"><label>Email</label><input name="email" type="email" value="${escapeAttr(profile.email || "")}" /></div>
    <div class="field"><label>GPS Address</label><input name="gpsAddress" value="${escapeAttr(profile.gpsAddress || "")}" placeholder="GA-123-4567" /></div>
    <div class="field"><label>Region</label><input name="region" value="${escapeAttr(profile.region || "")}" /></div>
    <div class="field"><label>District</label><input name="district" value="${escapeAttr(profile.district || "")}" /></div>
    <div class="field"><label>Town</label><input name="town" value="${escapeAttr(profile.town || "")}" /></div>
    <div class="section-title full"><h3>Identification</h3></div>
    <div class="field"><label>ID Type</label><select name="idType">${optionList(ID_TYPES, profile.idType || "Ghana Card")}</select></div>
    <div class="field"><label>ID Number</label><input name="idNumber" value="${escapeAttr(profile.idNumber || profile.ghanaCard || "")}" /></div>
    <div class="field"><label>ID Expiry</label><input name="idExpiry" type="date" value="${escapeAttr(profile.idExpiry || "")}" /></div>
    <div class="field"><label>ID Front</label><input name="idFrontFile" type="file" accept="image/jpeg,image/png,application/pdf" /></div>
    <div class="field"><label>ID Back</label><input name="idBackFile" type="file" accept="image/jpeg,image/png,application/pdf" /></div>
    <div class="section-title full"><h3>Employment</h3></div>
    <div class="field"><label>Date Employed</label><input name="dateEmployed" type="date" value="${escapeAttr(profile.dateEmployed || "")}" /></div>
    <div class="field"><label>Job Title</label><select name="jobTitle">${optionList(JOB_TITLES, profile.jobTitle || "Field Collector")}</select></div>
    <div class="field"><label>Employment Type</label><select name="employmentType">${optionList(EMPLOYMENT_TYPES, profile.employmentType || "Permanent")}</select></div>
    <div class="field"><label>Employment Status</label><select name="employmentStatus">${optionList(AGENT_STATUSES, profile.employmentStatus || "Active")}</select></div>
    <div class="field"><label>Supervisor</label>
      <select name="supervisorId">
        <option value="">None</option>
        ${supervisors.map((user) => `<option value="${escapeAttr(user.id)}" ${user.id === profile.supervisorId ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>GPS tracking</label><label class="permission-item"><input type="checkbox" name="gpsEnabled" ${profile.gpsEnabled ? "checked" : ""} /> Enable optional GPS</label></div>
    <div class="section-title full"><h3>Product Collection Permissions</h3></div>
    <div class="field full permission-grid">
      ${PRODUCT_PERMISSIONS.map(([key, label]) => `
        <label class="permission-item">
          <input type="checkbox" name="perm_${key}" ${perms[key] !== false ? "checked" : ""} />
          <span>${escapeHtml(label)}</span>
        </label>`).join("")}
    </div>
  `;
}

export function renderAgentAnalytics(stats = {}, rankings = []) {
  return `
    <div class="panel agent-analytics">
      <div class="section-title"><h2>Agent Analytics</h2></div>
      <div class="grid four">
        <div class="stat"><small>Agents</small><strong>${stats.total || 0}</strong></div>
        <div class="stat"><small>Active</small><strong>${stats.active || 0}</strong></div>
        <div class="stat"><small>On leave / suspended</small><strong>${stats.inactive || 0}</strong></div>
        <div class="stat"><small>Today's collections</small><strong>${money(stats.today || 0)}</strong></div>
      </div>
      ${rankings.length ? `
        <div class="section-title" style="margin-top:12px"><h3>Company ranking (today)</h3></div>
        <div class="dash-bar-chart">${rankings.slice(0, 6).map((row) => `
          <div class="dash-bar-row">
            <div class="dash-bar-label">${escapeHtml(row.name)}</div>
            <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.min(100, row.collected || 0)}%"></div></div>
            <div class="dash-bar-value">${money(row.collected)}</div>
          </div>`).join("")}</div>` : `<div class="empty">No ranking data yet.</div>`}
    </div>
  `;
}

export function renderAgentFilters(groups = []) {
  return `
    <div class="crm-filters agent-filters">
      <input id="agentSearch" placeholder="Name, code, phone, employee no, branch" />
      <select id="agentStatusFilter">
        <option value="">All statuses</option>
        ${AGENT_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
      <select id="agentBranchFilter">
        <option value="">All branches</option>
        ${groups.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}
      </select>
      <button class="btn ghost" type="button" id="exportAgentsBtn">Export CSV</button>
    </div>
  `;
}

export function renderAgentTable(agents, { branchName = () => "", kpis = () => ({}), pendingIds = new Set() } = {}) {
  if (!agents.length) return `<div class="empty">No agents match this search.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Photo</th><th>Code</th><th>Agent</th><th>Phone</th><th>Branch</th><th>Customers</th><th>Today</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${agents.map((user) => {
            const kpi = kpis(user) || {};
            return `
              <tr class="clickable-row" data-agent-detail="${user.id}">
                <td>${user.passportPhoto ? `<img class="passport-preview table-thumb" src="${escapeAttr(user.passportPhoto)}" alt="" />` : "—"}</td>
                <td>${escapeHtml(user.agentCode || user.employeeNumber || "—")}${pendingIds.has(user.id) ? `<br><span class="pill warn">Pending sync</span>` : ""}</td>
                <td><button type="button" class="link-btn" data-agent-detail="${user.id}"><strong>${escapeHtml(user.name)}</strong></button><br><span class="muted">${escapeHtml(user.jobTitle || "Collector")}</span></td>
                <td>${escapeHtml(user.phone || "—")}</td>
                <td>${escapeHtml(branchName(user) || "—")}</td>
                <td>${kpi.assigned || 0} · ${kpi.groups || 0} groups</td>
                <td>${money(kpi.daily || 0)}</td>
                <td><span class="pill ${toneForStatus(user.employmentStatus || (user.active === false ? "Suspended" : "Active"))}">${escapeHtml(user.employmentStatus || (user.active === false ? "Suspended" : "Active"))}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="btn secondary" data-agent-detail="${user.id}">Profile</button>
                    <button class="btn ghost" data-edit-user="${user.id}">Edit account</button>
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAgentDesk(model, { self = false, user } = {}) {
  const { kpis, summary, wallet, attendance, offlinePending, meetings, loansDue, route } = model;
  const clocked = Boolean(attendance?.clockInAt && !attendance?.clockOutAt);
  return `
    <div class="panel agent-desk">
      <div class="section-title">
        <h2>${self ? "My Desk" : `${escapeHtml(user?.name || "Agent")} desk`}</h2>
        ${self ? `<span class="pill ${typeof navigator !== "undefined" && navigator.onLine ? "" : "bad"}">${typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"}</span>` : ""}
      </div>
      <div class="grid four">
        <div class="stat"><small>Assigned customers</small><strong>${kpis.assigned}</strong><span>${kpis.active} active · ${kpis.dormant} dormant</span></div>
        <div class="stat"><small>Assigned groups</small><strong>${kpis.groups}</strong></div>
        <div class="stat"><small>Today collected</small><strong>${money(summary.amount)}</strong><span>Target remaining ${money(Math.max(0, (user?.dailyTarget || 0) - summary.amount))}</span></div>
        <div class="stat"><small>Commission (month)</small><strong>${money(kpis.commission)}</strong></div>
        <div class="stat"><small>Cash on hand</small><strong>${money(wallet.cashOnHand)}</strong></div>
        <div class="stat"><small>Pending / offline</small><strong>${summary.missed} / ${offlinePending}</strong></div>
        <div class="stat"><small>Loan collections</small><strong>${loansDue}</strong></div>
        <div class="stat"><small>Attendance</small><strong>${escapeHtml(attendance?.status || "—")}</strong><span>${clocked ? "Clocked in" : attendance?.clockOutAt ? "Clocked out" : "Not started"}</span></div>
      </div>
      <div class="agent-progress" style="margin-top:14px">
        <div class="dash-bar-track"><div class="dash-bar-fill ${kpis.successRate < 50 ? "bad" : ""}" style="width:${kpis.successRate}%"></div></div>
        <small>Collection success ${kpis.successRate}% · Attendance ${kpis.attendanceRate}%</small>
      </div>
      ${self ? `
        <div class="row-actions" style="margin-top:14px">
          <button class="btn" type="button" data-agent-clock="${clocked ? "out" : "in"}">${clocked ? "Clock out" : "Clock in"}</button>
          <button class="btn collector-action-btn" type="button" data-view-jump="collections">Collect</button>
          <button class="btn secondary" type="button" data-view-jump="handover">Cash handover</button>
        </div>` : ""}
      ${route ? `<p class="muted" style="margin-top:10px">Route ${escapeHtml(route.code)} · ${escapeHtml(route.name)} · ${escapeHtml(route.area || "")}</p>` : ""}
      ${meetings.length ? `<p class="muted">Upcoming meetings: ${meetings.map((item) => escapeHtml(item.date)).join(", ")}</p>` : ""}
    </div>
  `;
}

export function renderAgentProfile({
  user,
  kpis,
  wallet,
  customers = [],
  groups = [],
  attendance = [],
  leave = [],
  visits = [],
  routes = [],
  notes = [],
  documents = [],
  history = [],
  branchName = "",
  supervisorName = "",
  canManage = false
}) {
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(user.name)}</h2>
        <div class="row-actions">
          <span class="pill ${toneForStatus(user.employmentStatus || "Active")}">${escapeHtml(user.employmentStatus || "Active")}</span>
          <button class="btn ghost" data-back-view="agents">Back</button>
        </div>
      </div>
      <div class="grid two">
        <div>${user.passportPhoto ? `<img class="passport-preview large" src="${escapeAttr(user.passportPhoto)}" alt="" />` : ""}</div>
        <table>
          <tr><td>Agent / employee</td><td>${escapeHtml(user.agentCode || "—")} · ${escapeHtml(user.employeeNumber || "—")}</td></tr>
          <tr><td>Branch</td><td>${escapeHtml(branchName || "—")}</td></tr>
          <tr><td>Supervisor</td><td>${escapeHtml(supervisorName || "—")}</td></tr>
          <tr><td>Job / type</td><td>${escapeHtml(user.jobTitle || "Collector")} · ${escapeHtml(user.employmentType || "Permanent")}</td></tr>
          <tr><td>Phone / WhatsApp</td><td>${escapeHtml(user.phone || "")} · ${escapeHtml(user.whatsapp || "")}</td></tr>
          <tr><td>ID</td><td>${escapeHtml(user.idType || "Ghana Card")} · ${escapeHtml(user.idNumber || user.ghanaCard || "—")}</td></tr>
          <tr><td>Employed</td><td>${escapeHtml(user.dateEmployed || (user.createdAt || "").slice(0, 10))}</td></tr>
        </table>
      </div>
    </div>
    <div class="grid four" style="margin-top:18px">
      <div class="stat"><small>Monthly collections</small><strong>${money(kpis.monthly)}</strong></div>
      <div class="stat"><small>Success / recovery</small><strong>${kpis.successRate}% / ${kpis.loanRecoveryRate}%</strong></div>
      <div class="stat"><small>Wallet cash</small><strong>${money(wallet.cashOnHand)}</strong></div>
      <div class="stat"><small>Commission</small><strong>${money(kpis.commission)}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Assigned Customers (${customers.length})</h2></div>
      ${customers.length ? `<div class="table-wrap"><table><thead><tr><th>Number</th><th>Name</th><th>Phone</th><th>Status</th></tr></thead><tbody>
        ${customers.slice(0, 40).map((item) => `<tr><td>${escapeHtml(item.customerNumber || item.accountNo)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.memberStatus || "Active")}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No customers assigned.</div>`}
      ${canManage ? `
        <form id="agentAssignForm" class="form-grid" style="margin-top:12px">
          <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
          <div class="field full"><label>Bulk assign customer IDs (comma separated)</label><input name="customerIds" placeholder="cust-1, cust-2" /></div>
          <div class="field full"><label>Reason</label><input name="reason" required placeholder="Route change / coverage" /></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Assign customers</button></div>
        </form>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Assigned Groups (${groups.length})</h2></div>
      ${groups.length ? `<ul>${groups.map((group) => `<li>${escapeHtml(group.code || "")} ${escapeHtml(group.name)} · ${(group.memberships || []).length} members</li>`).join("")}</ul>` : `<div class="empty">No susu groups assigned.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Collection Rights</h2></div>
      <div class="permission-grid">${PRODUCT_PERMISSIONS.map(([key, label]) => `<span class="pill ${(user.productPermissions || {})[key] === false ? "bad" : ""}">${escapeHtml(label)}</span>`).join("")}</div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Attendance</h2></div>
      ${attendance.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>
        ${attendance.slice(0, 14).map((item) => `<tr><td>${item.date}</td><td>${escapeHtml((item.clockInAt || "").slice(11, 16))}</td><td>${escapeHtml((item.clockOutAt || "").slice(11, 16))}</td><td>${item.hours || 0}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No attendance recorded.</div>`}
      ${canManage ? `
        <form id="agentAttendanceForm" class="form-grid" style="margin-top:12px">
          <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
          <div class="field"><label>Date</label><input name="date" type="date" required /></div>
          <div class="field"><label>Status</label><select name="status">${optionList(ATTENDANCE_STATUSES, "Present")}</select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Mark attendance</button></div>
        </form>` : ""}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Leave</h2></div>
      ${leave.length ? `<ul>${leave.slice(0, 8).map((item) => `<li>${escapeHtml(item.type)} · ${item.days}d · ${escapeHtml(item.status)}${canManage && item.status === "Pending" ? ` <button class="btn ghost" data-leave-decide="${item.id}" data-leave-ok="1">Approve</button> <button class="btn ghost" data-leave-decide="${item.id}" data-leave-ok="0">Reject</button>` : ""}</li>`).join("")}</ul>` : `<div class="empty">No leave requests.</div>`}
      <form id="agentLeaveForm" class="form-grid">
        <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
        <div class="field"><label>Type</label><select name="type">${optionList(LEAVE_TYPES, "Annual Leave")}</select></div>
        <div class="field"><label>Days</label><input name="days" type="number" min="1" required /></div>
        <div class="field"><label>From</label><input name="from" type="date" /></div>
        <div class="field"><label>To</label><input name="to" type="date" /></div>
        <div class="field full"><label>Reason</label><input name="reason" /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Request leave</button></div>
      </form>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Visit Log</h2></div>
      ${visits.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Purpose</th><th>Outcome</th><th>Notes</th></tr></thead><tbody>
        ${visits.slice(0, 12).map((item) => `<tr><td>${item.date} ${escapeHtml(item.time || "")}</td><td>${escapeHtml(item.purpose)}</td><td>${escapeHtml(item.outcome)}</td><td>${escapeHtml(item.notes || "")}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No visits logged.</div>`}
      <form id="agentVisitForm" class="form-grid">
        <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
        <div class="field"><label>Customer</label>
          ${customers.length ? `<select name="customerId" required>${customers.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.accountNo || "")}</option>`).join("")}</select>` : `<input name="customerId" required placeholder="Customer record id" />`}
        </div>
        <div class="field"><label>Purpose</label><select name="purpose">${optionList(VISIT_PURPOSES, "Collection")}</select></div>
        <div class="field"><label>Outcome</label><select name="outcome">${optionList(VISIT_OUTCOMES, "Paid")}</select></div>
        <div class="field full"><label>Notes</label><input name="notes" /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Log visit</button></div>
      </form>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Routes</h2></div>
      ${routes.length ? `<ul>${routes.map((item) => `<li>${escapeHtml(item.code)} · ${escapeHtml(item.name)} · ${escapeHtml(item.area || "")}</li>`).join("")}</ul>` : `<div class="empty">No route assigned.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Documents</h2></div>
      <form id="agentDocumentForm" class="form-grid">
        <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
        <div class="field"><label>Type</label><select name="type">${optionList(AGENT_DOC_TYPES, "National ID")}</select></div>
        <div class="field"><label>Reference</label><input name="reference" /></div>
        <div class="field full"><label>File (JPEG, PNG, PDF · 2 MB)</label><input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Upload</button></div>
      </form>
      ${documents.length ? documents.map((doc) => `<div class="crm-doc">${escapeHtml(doc.type)} · ${escapeHtml(doc.reference || doc.fileName || "")}</div>`).join("") : `<div class="empty">No documents uploaded.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Notes & Audit</h2></div>
      <form id="agentNoteForm" class="form-grid">
        <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
        <div class="field full"><label>Note</label><textarea name="body" required></textarea></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Save note</button></div>
      </form>
      ${notes.length ? notes.slice(0, 6).map((note) => `<article class="crm-note"><p>${escapeHtml(note.body)}</p><small>${escapeHtml(note.userName || "")} · ${escapeHtml((note.createdAt || "").replace("T", " ").slice(0, 16))}</small></article>`).join("") : ""}
      ${history.length ? `<ul>${history.slice(0, 10).map((item) => `<li>${escapeHtml(item.action)} · ${escapeHtml(item.detail || "")} · ${escapeHtml((item.at || "").replace("T", " ").slice(0, 16))}</li>`).join("")}</ul>` : `<div class="empty">No audit events.</div>`}
    </div>
    ${canManage ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Transfer / Status</h2></div>
        <form id="agentTransferForm" class="form-grid">
          <input type="hidden" name="agentId" value="${escapeAttr(user.id)}" />
          <div class="field"><label>New branch</label><select name="branchId" id="agentTransferBranch"></select></div>
          <div class="field"><label>Reason</label><input name="reason" required /></div>
          <div class="form-actions full"><button class="btn" type="submit">Transfer agent</button></div>
        </form>
        <div class="row-actions" style="margin-top:10px">
          ${AGENT_STATUSES.map((status) => `<button class="btn ghost" type="button" data-agent-status="${status}">${status}</button>`).join("")}
        </div>
      </div>` : ""}
  `;
}

export function renderRouteForm(routes = [], agents = [], groups = [], editing = {}) {
  return `
    <div class="panel">
      <div class="section-title"><h2>${editing.id ? "Edit Route" : "Collection Routes"}</h2></div>
      <form id="agentRouteForm" class="form-grid">
        ${editing.id ? `<input type="hidden" name="id" value="${escapeAttr(editing.id)}" />` : ""}
        <div class="field"><label>Route Code</label><input name="code" value="${escapeAttr(editing.code || "")}" required /></div>
        <div class="field"><label>Route Name</label><input name="name" value="${escapeAttr(editing.name || "")}" required /></div>
        <div class="field"><label>Area</label><input name="area" value="${escapeAttr(editing.area || "")}" /></div>
        <div class="field full"><label>Communities</label><input name="communities" value="${escapeAttr(editing.communities || "")}" /></div>
        <div class="field"><label>Distance (km)</label><input name="distanceKm" type="number" min="0" step="0.1" value="${editing.distanceKm || 0}" /></div>
        <div class="field"><label>Estimated customers</label><input name="estimatedCustomers" type="number" min="0" value="${editing.estimatedCustomers || 0}" /></div>
        <div class="field"><label>Estimated minutes</label><input name="estimatedMinutes" type="number" min="0" value="${editing.estimatedMinutes || 0}" /></div>
        <div class="field"><label>Branch</label>
          <select name="branchId"><option value="">Unassigned</option>${groups.map((group) => `<option value="${group.id}" ${group.id === editing.branchId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Assigned agent</label>
          <select name="agentId"><option value="">Unassigned</option>${agents.map((user) => `<option value="${user.id}" ${user.id === editing.agentId ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}</select>
        </div>
        <div class="form-actions full"><button class="btn" type="submit">Save route</button></div>
      </form>
      ${routes.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Code</th><th>Name</th><th>Area</th><th>Agent</th><th></th></tr></thead><tbody>
        ${routes.map((item) => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.area || "")}</td><td>${escapeHtml(agents.find((user) => user.id === item.agentId)?.name || "—")}</td><td><button class="btn ghost" data-edit-route="${item.id}">Edit</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No routes yet.</div>`}
    </div>
  `;
}

export function renderAgentExpenseForm(agentId) {
  return `
    <form id="agentExpenseForm" class="form-grid">
      <input type="hidden" name="agentId" value="${escapeAttr(agentId)}" />
      <div class="field"><label>Category</label><select name="category">${optionList(EXPENSE_FIELD_CATEGORIES, "Transport")}</select></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div class="field"><label>Date</label><input name="date" type="date" required /></div>
      <div class="field full"><label>Notes</label><input name="notes" /></div>
      <div class="form-actions full"><button class="btn secondary" type="submit">Submit expense for approval</button></div>
    </form>
  `;
}

export function renderAgentPager({ page, pages, total }) {
  if (total <= 40) return "";
  return `
    <div class="crm-pager">
      <button class="btn ghost" type="button" data-agent-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${pages} · ${total} agents</span>
      <button class="btn ghost" type="button" data-agent-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button>
    </div>
  `;
}
