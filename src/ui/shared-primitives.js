/**
 * Wave 1 — Shared UI primitives in existing Smile Trust style.
 * Wave 5 extends with a11y / lazy / search helpers — still no React component library.
 * Reuses .panel / .btn / .field / .grid / .muted / .stat.
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

export function stEscape(value) {
  return escapeHtml(value);
}

export function stSrOnly(text = "") {
  return `<span class="sr-only">${escapeHtml(text)}</span>`;
}

export function stButton({ label, action = "", variant = "", type = "button", disabled = false, ariaLabel = "" } = {}) {
  const cls = ["btn", variant].filter(Boolean).join(" ");
  const data = action ? ` data-action="${escapeAttr(action)}"` : "";
  const aria = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : "";
  return `<button type="${escapeAttr(type)}" class="${escapeAttr(cls)}"${data}${aria}${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
}

export function stField({ label, name, type = "text", value = "", placeholder = "", required = false, describedBy = "" } = {}) {
  const desc = describedBy ? ` aria-describedby="${escapeAttr(describedBy)}"` : "";
  return `
    <div class="field">
      <label for="${escapeAttr(name)}">${escapeHtml(label)}</label>
      <input id="${escapeAttr(name)}" name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}"${required ? " required" : ""}${desc} />
    </div>
  `;
}

export function stSearchField({ id = "portalSearch", name = "q", label = "Search", value = "", placeholder = "Search…" } = {}) {
  return `
    <div class="field">
      <label for="${escapeAttr(id)}">${escapeHtml(label)}</label>
      <input id="${escapeAttr(id)}" name="${escapeAttr(name)}" type="search" value="${escapeAttr(value)}"
        placeholder="${escapeAttr(placeholder)}" autocomplete="off" enterkeyhint="search" />
    </div>
  `;
}

export function stFilterBar({ fields = [] } = {}) {
  if (!fields.length) return "";
  return `
    <div class="form-grid wave5-filter-bar" role="group" aria-label="Advanced filters">
      ${fields.map((f) => stField({
        label: f.label || f.name,
        name: f.name,
        type: f.type || "text",
        value: f.value || "",
        placeholder: f.placeholder || ""
      })).join("")}
    </div>
  `;
}

export function stSelect({ label, name, options = [], selected = "" } = {}) {
  const opts = options.map((item) => {
    const value = item.value ?? item.id ?? item;
    const text = item.label ?? item.name ?? item;
    return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(text)}</option>`;
  }).join("");
  return `
    <div class="field">
      <label for="${escapeAttr(name)}">${escapeHtml(label)}</label>
      <select id="${escapeAttr(name)}" name="${escapeAttr(name)}">${opts}</select>
    </div>
  `;
}

export function stPanel({ title = "", body = "", actions = "", landmark = "region" } = {}) {
  const labelled = title ? ` aria-label="${escapeAttr(title)}"` : "";
  return `
    <section class="panel" role="${escapeAttr(landmark)}"${labelled}>
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
      ${body}
      ${actions ? `<div class="row" style="margin-top:12px;gap:8px">${actions}</div>` : ""}
    </section>
  `;
}

/**
 * Collapsible lazy panel — content stays in DOM but collapsed panels avoid visual clutter;
 * use with session registry so dashboards do not expand every heavy table on each render.
 */
export function stLazyPanel({ id = "", title = "", body = "", open = false } = {}) {
  const panelId = id || `lazy-${Math.random().toString(36).slice(2, 8)}`;
  const expanded = Boolean(open);
  return `
    <details class="panel wave5-lazy-panel" data-lazy-panel="${escapeAttr(panelId)}" ${expanded ? "open" : ""} style="margin-top:12px">
      <summary class="section-title" style="cursor:pointer;list-style:none" aria-controls="${escapeAttr(panelId)}-body">
        <h3 style="display:inline;margin:0;font-size:1.05rem">${escapeHtml(title)}</h3>
        <span class="muted" style="margin-left:8px">${expanded ? "Collapse" : "Expand"}</span>
      </summary>
      <div id="${escapeAttr(panelId)}-body" style="margin-top:10px">${body}</div>
    </details>
  `;
}

export function stMoneyStat({ label = "", valueLabel = "", hint = "" } = {}) {
  return `
    <div class="stat" role="group" aria-label="${escapeAttr(label)}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(valueLabel)}</strong>
      ${hint ? `<span class="muted">${escapeHtml(hint)}</span>` : ""}
    </div>
  `;
}

export function stStatGrid(stats = []) {
  const cols = stats.length >= 4 ? "four" : stats.length === 3 ? "three" : "two";
  return `
    <div class="grid ${cols}" role="group">
      ${stats.map((s) => `<div class="stat"><small>${escapeHtml(s.label)}</small><strong>${escapeHtml(s.value)}</strong></div>`).join("")}
    </div>
  `;
}

export function stEmpty(message = "Nothing to show.") {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

export function stMuted(text) {
  return `<p class="muted">${escapeHtml(text)}</p>`;
}

export function stAlert({ tone = "info", message = "" } = {}) {
  const border = tone === "danger" ? "#b42318" : tone === "warning" ? "#b54708" : "#175cd3";
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return `<div class="panel" role="${role}" style="border-left:4px solid ${border};padding:10px 12px">${escapeHtml(message)}</div>`;
}

export function stTable({ columns = [], rows = [] } = {}) {
  if (!rows.length) return stEmpty("No rows.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((c) => `<th scope="col">${escapeHtml(c.label || c)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((c) => {
            const key = c.key || c;
            return `<td>${escapeHtml(row[key])}</td>`;
          }).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderFoundationStatusPanel(checklist = {}) {
  const money = checklist.moneyDefaults || {};
  return stPanel({
    title: "Foundation platform",
    body: `
      ${stMuted("Wave 1 unified adapters — auth, RBAC, tenant/branch, config, audit, logging, offline foundation.")}
      ${stStatGrid([
        { label: "Wave", value: checklist.wave || "WAVE-01" },
        { label: "Version", value: checklist.version || "" },
        { label: "Tenant", value: checklist.tenantId || "" },
        { label: "Offline pending", value: checklist.offline?.pending ?? 0 }
      ])}
      ${stMuted("Money defaults: interest " + (money.loanInterest ?? 15) + "% · days " + (money.collectionDays ?? 31) + " · cashier GHS " + (money.cashierLimitGhs ?? 1000))}
    `
  });
}
