/**
 * Administration extras appended below the existing System Controls form.
 */

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

function optionList(items, selected) {
  return items.map((item) => {
    const value = item.value ?? item.id ?? item;
    const label = item.label ?? item.name ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

export function renderSystemConfigExtras({
  profile = {},
  parameters = [],
  flags = [],
  products = [],
  holidays = [],
  drafts = [],
  versions = [],
  diffs = [],
  searchQuery = "",
  category = "",
  stats = {},
  canConfigure = false,
  canSecurity = false,
  canFlags = false,
  canApprove = false,
  canBackup = false,
  canProducts = false
} = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Administration console</h2></div>
      <p class="muted">System Controls above stay as they are. Runtime parameters, flags, and calendars are versioned here. High-risk changes use maker-checker except for the System Owner. Cashier approval still defaults to GHS 1,000.</p>
      <div class="grid four">
        <div class="stat"><small>Config version</small><strong>v${stats.version || 1}</strong></div>
        <div class="stat"><small>Parameters</small><strong>${stats.parameters || 0}</strong></div>
        <div class="stat"><small>Flags on</small><strong>${stats.flagsOn || 0}</strong></div>
        <div class="stat"><small>Pending drafts</small><strong>${stats.pendingDrafts || 0}</strong></div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Company profile</h2></div>
        ${canConfigure ? `
          <form id="companyProfileForm" class="form-grid">
            <div class="field"><label>Company name</label><input name="companyName" value="${escapeAttr(profile.companyName || "")}" /></div>
            <div class="field"><label>Registration no.</label><input name="registrationNumber" value="${escapeAttr(profile.registrationNumber || "")}" /></div>
            <div class="field"><label>TIN</label><input name="taxId" value="${escapeAttr(profile.taxId || "")}" /></div>
            <div class="field"><label>License no.</label><input name="licenseNumber" value="${escapeAttr(profile.licenseNumber || "")}" /></div>
            <div class="field"><label>Region</label><input name="region" value="${escapeAttr(profile.region || "")}" /></div>
            <div class="field"><label>District</label><input name="district" value="${escapeAttr(profile.district || "")}" /></div>
            <div class="field"><label>Telephone</label><input name="telephone" value="${escapeAttr(profile.telephone || "")}" /></div>
            <div class="field"><label>Email</label><input name="email" value="${escapeAttr(profile.email || "")}" /></div>
            <div class="field full"><label>Address</label><input name="address" value="${escapeAttr(profile.address || "")}" /></div>
            <div class="field"><label>Working hours</label><input name="businessHours" value="${escapeAttr(profile.businessHours || "")}" /></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Save profile</button></div>
          </form>
        ` : `<div class="notice">Company profile requires System.Configure.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Configuration search</h2></div>
        <form id="configSearchForm" class="form-grid">
          <div class="field"><label>Search</label><input name="q" value="${escapeAttr(searchQuery)}" /></div>
          <div class="field"><label>Category</label><select name="category">${optionList([{ value: "", label: "All" }, "organization", "financial", "parameters", "approval", "security", "offline", "backup", "retention"].map((item) => typeof item === "string" ? { value: item, label: item } : item), category)}</select></div>
          <div class="form-actions full"><button class="btn" type="submit">Filter</button></div>
        </form>
        ${canConfigure ? `
          <form id="configParameterForm" class="form-grid" style="margin-top:12px">
            <div class="field"><label>Parameter</label><select name="key">${optionList(parameters.map((item) => ({ value: item.key, label: item.label })), parameters[0]?.key)}</select></div>
            <div class="field"><label>Value</label><input name="value" /></div>
            <div class="field full"><label>Reason</label><input name="reason" placeholder="Why this change" /></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Save parameter</button></div>
          </form>
        ` : ""}
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>Parameter</th><th>Value</th><th>Category</th></tr></thead>
            <tbody>
              ${parameters.slice(0, 16).map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.category)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Feature flags</h2></div>
        ${canFlags ? `
          <form id="featureFlagForm" class="form-grid">
            ${flags.map((flag) => `
              <label class="permission-item"><input type="checkbox" name="flag_${flag.id}" ${flag.enabled ? "checked" : ""} /> ${escapeHtml(flag.label || flag.id)}</label>
            `).join("")}
            <div class="form-actions full"><button class="btn secondary" type="submit">Save flags</button></div>
          </form>
        ` : `<div class="notice">Feature flags require System.FeatureFlags.</div>`}
        ${canSecurity ? `<p class="muted" style="margin-top:10px">Password minimum, session timeout, and lockout live in parameters (security category). Changing them is versioned and audited.</p>` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Business calendar</h2></div>
        <p class="muted">${holidays.length} holidays (Ghana defaults plus custom).</p>
        ${canConfigure ? `
          <form id="holidayForm" class="form-grid">
            <div class="field"><label>Date</label><input name="date" type="date" required /></div>
            <div class="field"><label>Name</label><input name="name" required /></div>
            <div class="form-actions full"><button class="btn ghost" type="submit">Add holiday</button></div>
          </form>
        ` : ""}
        <div class="muted" style="margin-top:8px">${holidays.slice(0, 8).map((item) => escapeHtml(`${item.date} ${item.name}`)).join(" · ")}</div>
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Version history</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ver</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              ${(versions || []).slice(-8).reverse().map((item) => `
                <tr>
                  <td>v${item.versionNumber}</td>
                  <td>${escapeHtml(item.reason || "")}</td>
                  <td>${canConfigure ? `<button class="btn ghost" type="button" data-config-rollback="${item.versionNumber}">Rollback</button>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ${canConfigure ? `
          <form id="configCompareForm" class="form-grid" style="margin-top:10px">
            <div class="field"><label>From</label><input name="from" type="number" min="1" value="1" /></div>
            <div class="field"><label>To</label><input name="to" type="number" min="1" value="${stats.version || 1}" /></div>
            <div class="form-actions full"><button class="btn ghost" type="submit">Compare</button></div>
          </form>
          ${diffs.length ? `<ul>${diffs.map((item) => `<li>${escapeHtml(item.key)}: ${escapeHtml(item.previousValue)} → ${escapeHtml(item.newValue)}</li>`).join("")}</ul>` : ""}
        ` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Drafts, import & backup policy</h2></div>
        ${drafts.filter((item) => item.status === "pending").length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Key</th><th>Value</th><th></th></tr></thead>
              <tbody>
                ${drafts.filter((item) => item.status === "pending").map((item) => `
                  <tr>
                    <td>${escapeHtml(item.key)}</td>
                    <td>${escapeHtml(item.value)}</td>
                    <td>${canApprove ? `<button class="btn ghost" type="button" data-config-approve="${escapeAttr(item.id)}">Approve</button> <button class="btn ghost" type="button" data-config-reject="${escapeAttr(item.id)}">Reject</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No pending configuration drafts.</div>`}
        ${canConfigure ? `
          <div class="row-actions" style="margin-top:12px">
            <button class="btn secondary" type="button" id="exportConfigBtn">Export JSON</button>
            <label class="btn ghost" for="importConfigInput">Import JSON</label>
            <input id="importConfigInput" type="file" accept="application/json" hidden />
          </div>
        ` : ""}
        ${canBackup ? `<p class="muted" style="margin-top:10px">Manual backup remains on the Backup screen. Schedule and encryption are parameters under backup.</p>` : ""}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Product configuration</h2></div>
      <p class="muted">Catalog defaults for savings and loan products. Live collection and loan calculations still use existing product and interest settings so current balances do not change.</p>
      ${canProducts ? `
        <form id="configProductForm" class="form-grid">
          <div class="field"><label>Product</label><select name="id">${optionList((products || []).map((item) => ({ value: item.id, label: `${item.name} (${item.kind})` })), (products || [])[0]?.id)}</select></div>
          <div class="field"><label>Minimum (GHS)</label><input name="minAmount" type="number" min="0" step="0.01" /></div>
          <div class="field"><label>Maximum (GHS)</label><input name="maxAmount" type="number" min="0" step="0.01" /></div>
          <div class="field"><label>Status</label><select name="status">${optionList([{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], "active")}</select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Save product</button></div>
        </form>
      ` : `<div class="notice">Product configuration requires System.Products.</div>`}
      <div class="table-wrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Product</th><th>Kind</th><th>Min</th><th>Max</th><th>Status</th></tr></thead>
          <tbody>
            ${(products || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.minAmount)}</td><td>${escapeHtml(item.maxAmount)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
