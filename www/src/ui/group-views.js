/**
 * Group susu UI: dashboard cards, filters, meeting wizard, member cards.
 */
import { formatGhs } from "../core/money.js";
import {
  ATTENDANCE_STATUSES,
  CONTRIBUTION_TYPES,
  DEFAULT_FINES,
  GROUP_STATUSES,
  GROUP_TYPES,
  MEETING_STEPS,
  WELFARE_TYPES
} from "../core/group-ops.js";

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

export function renderGroupTypeOptions(selected = "") {
  return GROUP_TYPES.map((type) => `<option value="${escapeAttr(type)}" ${type === selected ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

export function renderGroupStatusOptions(selected = "Active") {
  return GROUP_STATUSES.map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status}</option>`).join("");
}

export function renderGroupFilters(agents = [], branches = []) {
  return `
    <div class="crm-filters group-filters">
      <input id="groupSearch" placeholder="Search group, code, or leader" />
      <select id="groupStatusFilter">
        <option value="">All statuses</option>
        ${renderGroupStatusOptions("")}
      </select>
      <select id="groupTypeFilter">
        <option value="">All types</option>
        ${GROUP_TYPES.map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`).join("")}
      </select>
      <select id="groupAgentFilter">
        <option value="">All agents</option>
        ${agents.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}
      </select>
      <select id="groupBranchFilter">
        <option value="">All branches</option>
        ${branches.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function renderGroupFormExtras(editing = {}) {
  return `
    <div class="field"><label>Group Type</label><select name="groupType">${renderGroupTypeOptions(editing.groupType || "Weekly Group")}</select></div>
    <div class="field"><label>Status</label><select name="status">${renderGroupStatusOptions(editing.status || "Active")}</select></div>
    <div class="field"><label>Supervisor</label><input name="supervisorName" value="${escapeAttr(editing.supervisorName || "")}" placeholder="Name or staff" /></div>
    <div class="field"><label>Meeting Time</label><input name="meetingTime" type="time" value="${escapeAttr(editing.meetingTime || "")}" /></div>
    <div class="field"><label>Meeting Venue</label><input name="meetingVenue" value="${escapeAttr(editing.meetingVenue || "")}" /></div>
    <div class="field"><label>Collection Frequency</label>
      <select name="collectionFrequency">
        ${["Daily", "Weekly", "Monthly"].map((freq) => `<option value="${freq}" ${(editing.collectionFrequency || editing.contributionFrequency || "Weekly") === freq ? "selected" : ""}>${freq}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Financial Year Start</label><input name="financialYearStart" type="date" value="${escapeAttr(editing.financialYearStart || "")}" /></div>
    <div class="field"><label>Financial Year End</label><input name="financialYearEnd" type="date" value="${escapeAttr(editing.financialYearEnd || "")}" /></div>
    <div class="field"><label>Treasurer</label><input name="treasurerName" value="${escapeAttr(editing.treasurerName || "")}" /></div>
    <div class="field"><label>Vice Chairperson</label><input name="viceChairpersonName" value="${escapeAttr(editing.viceChairpersonName || "")}" /></div>
    <div class="field full"><label>Committee Members</label><input name="committeeMembers" value="${escapeAttr(editing.committeeMembers || "")}" placeholder="Comma-separated names" /></div>
  `;
}

export function renderGroupDashboardCards(dash, online = true) {
  return `
    <div class="panel group-desk">
      <div class="section-title">
        <h2>Group Dashboard</h2>
        <span class="pill ${online ? "good" : "bad"}">${online ? "Online" : "Offline"}</span>
      </div>
      <div class="grid four">
        <div class="stat"><small>Group balance</small><strong>${money(dash.groupBalance || 0)}</strong></div>
        <div class="stat"><small>Members (active / inactive)</small><strong>${dash.activeMembers || 0} / ${dash.inactiveMembers || 0}</strong></div>
        <div class="stat"><small>Today's collections</small><strong>${money(dash.actual || 0)}</strong></div>
        <div class="stat"><small>Outstanding loans</small><strong>${money(dash.outstandingLoans || 0)}</strong></div>
        <div class="stat"><small>Loan recovery</small><strong>${dash.loanRecoveryRate || 0}%</strong></div>
        <div class="stat"><small>Fines / welfare</small><strong>${money(dash.fineCollections || 0)} / ${money(dash.welfareBalance || 0)}</strong></div>
        <div class="stat"><small>Share capital</small><strong>${money(dash.shareCapital || 0)}</strong></div>
        <div class="stat"><small>Attendance</small><strong>${dash.attendancePercent || 0}%</strong></div>
      </div>
    </div>
  `;
}

export function renderMemberCards(cards = []) {
  if (!cards.length) return `<div class="empty">No members in this group yet.</div>`;
  return `
    <div class="group-member-grid">
      ${cards.map((card) => `
        <article class="group-member-card">
          ${card.photo ? `<img src="${escapeAttr(card.photo)}" alt="" />` : `<div class="group-member-photo">Photo</div>`}
          <div>
            <strong>${escapeHtml(card.name)}</strong>
            <p class="muted">${escapeHtml(card.customerNumber)} · ${escapeHtml(card.status)}</p>
            <p>Savings ${money(card.savingsBalance)} · Loan ${money(card.loanBalance)}</p>
            <p class="muted">Attendance ${card.attendancePercent}% · Fines ${money(card.fineBalance)}</p>
          </div>
        </article>`).join("")}
    </div>
  `;
}

export function renderMeetingWizard(group, meeting, members = [], customers = []) {
  const step = meeting?.step || "attendance";
  const stepIndex = Math.max(0, MEETING_STEPS.indexOf(step));
  return `
    <div class="panel meeting-wizard">
      <div class="section-title">
        <h2>Meeting ${escapeHtml(meeting?.date || "")} · Step ${stepIndex + 1}/${MEETING_STEPS.length}</h2>
        <span class="pill">${escapeHtml(meeting?.status || "Open")}</span>
      </div>
      <div class="agent-progress"><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round((stepIndex / (MEETING_STEPS.length - 1)) * 100)}%"></div></div></div>
      <form id="meetingWizardForm">
        <input type="hidden" name="meetingId" value="${escapeAttr(meeting?.id || "")}" />
        <input type="hidden" name="susuGroupId" value="${escapeAttr(group.id)}" />
        <input type="hidden" name="step" value="${escapeAttr(step)}" />
        ${step === "attendance" ? renderAttendanceStep(meeting, members, customers, group) : ""}
        ${step === "contributions" ? renderContributionStep(meeting, members, customers, group) : ""}
        ${step === "fines" ? renderFineStep(members, customers) : ""}
        ${step === "loans" ? `<div class="notice">Record loan repayments per member. New loan requests stay on the Loans screen.</div>${renderLoanStep(members, customers)}` : ""}
        ${step === "notes" ? `
          <div class="field full"><label>Agenda</label><textarea name="agenda">${escapeHtml(meeting?.agenda || "")}</textarea></div>
          <div class="field full"><label>Discussions / notes</label><textarea name="notes">${escapeHtml(meeting?.notes || "")}</textarea></div>
          <div class="field full"><label>Decisions</label><textarea name="decisions">${escapeHtml(meeting?.decisions || "")}</textarea></div>
          <div class="field full"><label>Resolutions</label><textarea name="resolutions">${escapeHtml(meeting?.resolutions || "")}</textarea></div>
          <div class="field full"><label>Action items</label><textarea name="actionItems">${escapeHtml(meeting?.actionItems || "")}</textarea></div>
        ` : ""}
        <div class="form-actions">
          ${step !== "closed" ? `<button class="btn" type="submit">${step === "notes" ? "Close meeting & post" : "Save and continue"}</button>` : `<div class="notice good">Meeting closed. Receipts posted.</div>`}
        </div>
      </form>
    </div>
  `;
}

function memberName(customers, id) {
  return customers.find((item) => item.id === id)?.name || id;
}

function renderAttendanceStep(meeting, members, customers) {
  return members.map((member) => {
    const current = (meeting?.attendance || []).find((row) => row.customerId === member.customerId);
    return `
      <div class="field">
        <label>${escapeHtml(memberName(customers, member.customerId))}</label>
        <select name="att_${member.customerId}">
          ${ATTENDANCE_STATUSES.map((status) => `<option value="${status}" ${(current?.status || "Present") === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>`;
  }).join("") || `<div class="empty">Add members first.</div>`;
}

function renderContributionStep(meeting, members, customers, group) {
  return members.map((member) => `
    <div class="field">
      <label>${escapeHtml(memberName(customers, member.customerId))}</label>
      <input name="contrib_${member.customerId}" type="number" min="0" step="0.01" inputmode="decimal" value="${group.contributionAmount || 0}" />
    </div>
    <div class="field">
      <label>Type</label>
      <select name="contribType_${member.customerId}">
        ${CONTRIBUTION_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

function renderFineStep(members, customers) {
  return members.map((member) => `
    <div class="field">
      <label>${escapeHtml(memberName(customers, member.customerId))} fine</label>
      <input name="fine_${member.customerId}" type="number" min="0" step="0.01" value="0" />
    </div>
    <div class="field">
      <label>Reason</label>
      <select name="fineReason_${member.customerId}">
        ${DEFAULT_FINES.map((fine) => `<option value="${escapeAttr(fine.name)}">${escapeHtml(fine.name)} (${money(fine.amount)})</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label>Welfare</label>
      <input name="welfare_${member.customerId}" type="number" min="0" step="0.01" value="0" />
    </div>
  `).join("");
}

function renderLoanStep(members, customers) {
  return members.map((member) => `
    <div class="field">
      <label>${escapeHtml(memberName(customers, member.customerId))} repayment</label>
      <input name="loan_${member.customerId}" type="number" min="0" step="0.01" value="0" />
    </div>
  `).join("");
}

export function renderShareOutPreview(calc) {
  if (!calc?.memberLines?.length) return `<div class="empty">No share-out lines yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Member</th><th>Contributed</th><th>Fines</th><th>Dividend</th><th>Payout</th></tr></thead>
        <tbody>
          ${calc.memberLines.map((line) => `
            <tr>
              <td>${escapeHtml(line.customerName)}</td>
              <td>${money(line.contributedPesewas ? line.contributedPesewas / 100 : 0)}</td>
              <td>${money(line.fines || 0)}</td>
              <td>${money(line.dividend || 0)}</td>
              <td>${money(line.finalPayout || 0)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p>Total payout ${money(calc.total)} · Profit ${money(calc.profit || 0)}</p>
  `;
}

export function renderGroupAnalyticsPanel(stats) {
  return `
    <div class="panel">
      <div class="section-title"><h2>Group Analytics</h2></div>
      <div class="grid four">
        <div class="stat"><small>Groups</small><strong>${stats.groupCount || 0}</strong></div>
        <div class="stat"><small>Members</small><strong>${stats.memberCount || 0}</strong></div>
        <div class="stat"><small>Collected</small><strong>${money(stats.totalCollected || 0)}</strong></div>
      </div>
    </div>
  `;
}

export function renderActionPermissionGrid(actions = [], selected = {}) {
  return actions.map((action) => `
    <label class="permission-item">
      <input type="checkbox" name="act_${action}" ${selected[action] !== false && selected[action] !== undefined ? "checked" : defaultCheck(selected, action)} />
      <span>${escapeHtml(action)}</span>
    </label>
  `).join("");
}

function defaultCheck(selected, action) {
  if (Object.keys(selected).length === 0) return "";
  return selected[action] ? "checked" : "";
}

export { WELFARE_TYPES };
