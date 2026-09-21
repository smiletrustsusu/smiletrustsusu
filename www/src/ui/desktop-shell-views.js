/**
 * Wave 6 — Desktop EXE status snippets (no new top-level nav).
 * Embed under Backup / Sync / Audit surfaces only.
 */

import { stSrOnly } from "./shared-primitives.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDesktopShellStatus(model = {}) {
  const runtime = model.runtime || {};
  const smoke = model.smoke || {};
  const gaps = model.gaps || {};
  const guidance = model.screenshot?.guidance || [];
  return `
    <section class="panel wave6-desktop-panel" aria-labelledby="wave6DesktopTitle" style="margin-top:18px">
      <h3 id="wave6DesktopTitle">Windows desktop (Wave 6)</h3>
      ${stSrOnly("Enterprise Windows EXE shell status. Uses the same SPA and Wave 4 sync engine as Android and Web.")}
      <p class="muted">Electron loads the shared SPA — not a Next.js rewrite. Sync uses <code>runWave4Sync</code> (same module as APK).</p>
      <div class="grid two" style="gap:12px">
        <div>
          <p><strong>Shell</strong>: ${escapeHtml(runtime.isElectron ? "Electron detected" : "Browser / non-EXE runtime")}</p>
          <p><strong>Architecture</strong>: ${escapeHtml(smoke.architecture || "electron-shared-spa")}</p>
          <p><strong>Pilot ready</strong>: ${gaps.pilotReady === false ? "No" : "Yes"} (${escapeHtml(String(gaps.closedCount ?? "—"))} gaps closed)</p>
        </div>
        <div>
          <p><strong>Sync parity</strong>: ${smoke.syncSameAsAndroid !== false ? "Same Wave 4 engine" : "Check wiring"}</p>
          <p><strong>SQLite business DB</strong>: ${smoke.sqliteBusinessDb ? "Unexpected" : "Not used"}</p>
          <p><strong>Catalog note</strong>: EIR alias Loan Platform → EXE delivery</p>
        </div>
      </div>
      ${guidance.length ? `<ul class="muted">${guidance.slice(0, 3).map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>` : ""}
    </section>
  `;
}

export function renderWave6ParityChecklist(rows = []) {
  if (!rows.length) return "";
  return `
    <details class="wave5-lazy-panel" data-lazy-panel="wave6-parity" style="margin-top:12px">
      <summary>EXE ↔ APK ↔ Web parity checklist</summary>
      <table class="data-table" aria-label="Wave 6 parity checklist">
        <thead><tr><th>ID</th><th>Item</th><th>Channels</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.channel)}</td></tr>`).join("")}
        </tbody>
      </table>
    </details>
  `;
}
