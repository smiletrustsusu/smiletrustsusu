/**
 * Wave 4 — Collector offline status banner / panel (Phase 18 wording).
 * Not color-alone: always includes text + aria-label from registry messages.
 */

import { stPanel, stStatGrid, stMuted, stAlert, stEscape } from "./shared-primitives.js";

function escapeHtml(value) {
  return stEscape(value);
}

function toneFromHint(colorHint = "") {
  const h = String(colorHint || "").toLowerCase();
  if (h.includes("red") || h.includes("danger") || h.includes("error")) return "danger";
  if (h.includes("amber") || h.includes("warn") || h.includes("orange")) return "warning";
  return "info";
}

/**
 * Compact top banner for mobile / collector shells.
 */
export function renderOfflineStatusBanner(ux = {}) {
  if (!ux || !ux.status) return "";
  const onlineLike = ux.status === "Online" || ux.status === "Synchronizing";
  const label = ux.shortLabel || ux.status;
  const message = ux.message || "";
  const a11y = ux.accessibilityLabel || label;
  return `
    <div class="mobile-sync-banner wave4-offline-banner ${onlineLike ? "online" : ""}"
         role="status"
         aria-live="polite"
         aria-label="${escapeHtml(a11y)}"
         data-collector-status="${escapeHtml(ux.status)}">
      <span class="pill ${onlineLike ? "" : "bad"}" aria-hidden="true">${escapeHtml(label)}</span>
      <span>${escapeHtml(message)}</span>
      ${ux.progress ? `<span class="muted">Queue ${Number(ux.progress.pending || 0)} · ${Number(ux.progress.progressPct || 0)}%</span>` : ""}
    </div>
  `;
}

/**
 * Richer panel for Backup / Audit-Reports sync area.
 */
export function renderOfflineSyncPlatformPanel({
  dashboard = {},
  ux = {},
  escalation = null,
  eod = null,
  startOfDay = null
} = {}) {
  const progress = dashboard.progress || ux.progress || {};
  const conflicts = dashboard.conflictGuidance || [];
  const body = `
    ${stMuted("Wave 4 offline platform — Capacitor shared SPA core. Money sync uses Module 15 / invokeApi; not a Compose rewrite.")}
    ${stAlert({
      tone: toneFromHint(ux.colorHint),
      message: (ux.shortLabel || ux.status || "Status") + ": " + (ux.message || "")
    })}
    <p class="muted" aria-label="${escapeHtml(ux.accessibilityLabel || "")}"><strong>Accessibility:</strong> ${escapeHtml(ux.accessibilityLabel || ux.status || "")}</p>
    ${stStatGrid([
      { label: "Engine", value: progress.engineStatus || dashboard.status || "idle" },
      { label: "Pending", value: progress.pending ?? dashboard.pending ?? 0 },
      { label: "Conflicts", value: progress.conflicts ?? dashboard.conflicts ?? 0 },
      { label: "Progress", value: (progress.progressPct ?? 0) + "%" }
    ])}
    <div class="wave4-sync-progress" style="margin-top:10px" role="progressbar"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(progress.progressPct || 0)}"
         aria-label="Synchronization progress">
      <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100, Number(progress.progressPct || 0))}%;background:#0f766e"></div>
      </div>
      <p class="muted" style="margin-top:6px">Stage: ${escapeHtml(progress.stage || "—")} · Workflow ${Number(progress.workflowProgressPct || 0)}%</p>
    </div>
    ${startOfDay?.ok ? stMuted("Start of day: " + (startOfDay.outcome || "") + " — use Sync now when Online.") : ""}
    ${eod?.ok ? stMuted("EOD: " + (eod.action || eod.outcome || "")) : ""}
    ${escalation?.escalate ? stAlert({
      tone: "warning",
      message: "Escalation: " + (escalation.highest?.code || escalation.highest?.id || "threshold") + " → " + (escalation.highest?.escalateTo || "supervisor")
    }) : ""}
    ${conflicts.length ? `
      <div style="margin-top:12px">
        <h3>Conflict guidance</h3>
        <ul class="muted">
          ${conflicts.slice(0, 5).map((c) => `<li><strong>${escapeHtml(c.kind)}</strong> — ${escapeHtml(c.collectorBanner || "")}</li>`).join("")}
        </ul>
      </div>
    ` : stMuted("No open conflicts.")}
    <div class="row-actions" style="margin-top:12px">
      <button class="btn secondary" type="button" id="wave4SyncNowBtn">Sync now</button>
      <button class="btn ghost" type="button" id="wave4RecoverQueueBtn">Recover queue</button>
    </div>
  `;
  return stPanel({ title: "Offline sync platform", body });
}

export function enhanceTopbarNetworkPill({ status = "Online", accessibilityLabel = "", shortLabel = "" } = {}) {
  const onlineLike = status === "Online" || status === "Synchronizing";
  const label = shortLabel || status;
  return `<span class="pill ${onlineLike ? "" : "bad"}" role="status" aria-label="${escapeHtml(accessibilityLabel || label)}">${escapeHtml(label)}</span>`;
}
