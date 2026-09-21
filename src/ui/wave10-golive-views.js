/**
 * Wave 10 — Production cutover / hypercare / closure panels under Audit / Reports.
 * No new top-level navigation.
 */

import {
  stSrOnly,
  stPanel,
  stStatGrid,
  stLazyPanel,
  stMuted,
  stAlert,
  stTable,
  stButton,
  stEscape
} from "./shared-primitives.js";

export function renderWave10GolivePanel(model = {}) {
  const smoke = model.smoke || {};
  const gaps = model.gaps || {};
  const evidence = model.evidence || null;
  const canView = model.canView !== false;
  if (!canView) return "";

  const decision = evidence?.goLive?.decision || "—";
  const counts = smoke.counts || gaps.counts || {};
  const cert = evidence?.goLive?.cert001;

  return `
    <section class="panel wave10-golive-panel" aria-labelledby="wave10GoliveTitle" style="margin-top:18px">
      <h2 id="wave10GoliveTitle">Production Cutover / Go-Live (Wave 10)</h2>
      ${stSrOnly("Wave 10 production deployment, cutover checklist, hypercare, and project closure. Framework and evidence pack — not a live production cutover claim.")}
      ${stMuted("Operators execute cutover under docs/wave10-production-golive.md. Run npm run validate:golive to refresh evidence. Wave 10 stays blocked until real Wave 9 HA-* Approvals — never auto-Accepted. CERT-001 stays preview until Accountable Authority approvals. Executive Sign-Off remains PendingHumanSignOff. Framework complete ≠ production live.")}
      ${stStatGrid([
        { label: "Go-Live decision", value: String(decision) },
        { label: "Cutover steps", value: String(counts.cutoverSteps ?? "—") },
        { label: "PV checks", value: String(counts.validationChecks ?? "—") },
        { label: "Hypercare days", value: String(counts.hypercareDurationDays ?? "—") }
      ])}
      <div class="row-actions" style="margin-top:12px">
        ${stButton({ label: "Reload go-live evidence", action: "wave10-refresh-golive", variant: "secondary", ariaLabel: "Reload last Wave 10 go-live evidence" })}
      </div>
      ${evidence
        ? stAlert({
          tone: (evidence.goLive?.hardBlockers || []).length ? "warning" : "info",
          message: decision === "FrameworkReady"
            ? "FrameworkReady — pack complete for human execution. Not a live production cutover. Executive Sign-Off PendingHumanSignOff."
            : decision === "Accepted"
              ? "Production Accepted — recorded human approvals and cutover evidence present."
              : decision === "AwaitingApprovals"
                ? "AwaitingApprovals — human Accountable Authority gates remain."
                : `Decision: ${decision}. ${evidence.goLive?.meaning || ""}`
        })
        : stAlert({ tone: "info", message: "No go-live evidence in session yet. Generate with: npm run validate:golive" })}
      ${cert
        ? stMuted(`CERT-001: certified=${cert.certified ? "yes" : "no"} (preview=${cert.preview !== false ? "yes" : "no"})`)
        : ""}
    </section>
  `;
}

export function renderWave10CutoverChecklist(stepRows = []) {
  if (!stepRows.length) {
    return stLazyPanel({
      id: "wave10-cutover",
      title: "Production cutover checklist",
      body: stMuted("Cutover steps appear after validate:golive or when evidence is loaded.")
    });
  }
  const ready = stepRows.filter((r) => String(r.status || "").toLowerCase().includes("ready")).length;
  const done = stepRows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("complete") || s.includes("done") || s.includes("accepted");
  }).length;
  const truncated = (text, max = 72) => {
    const t = String(text || "").trim();
    if (!t) return "—";
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };
  return stLazyPanel({
    id: "wave10-cutover",
    title: "Production cutover checklist",
    body: `
      ${stAlert({
        tone: "warning",
        message:
          "CO-* remains ReadyToExecute until real Wave 9 HA-* human Approvals. Do not mark cutover complete or CERT-001 certified from this panel."
      })}
      ${stStatGrid([
        { label: "Steps", value: String(stepRows.length) },
        { label: "ReadyToExecute", value: String(ready) },
        { label: "Completed (human)", value: String(done) },
        { label: "Money invariants", value: "15 / 31 / 1000" }
      ])}
      ${stMuted("Guide: docs/wave10-production-golive.md · Rollback RB-PROD-001 · Local timestamps: npm run wave10:cutover-record (rehearsal only — never Accepted). Login as JOHN for operator recording (KBA is developer support only).")}
      ${stTable({
        columns: [
          { key: "id", label: "ID" },
          { key: "title", label: "Step" },
          { key: "ownerRole", label: "Owner" },
          { key: "status", label: "Status" },
          { key: "completedAt", label: "Timestamp" },
          { key: "rollback", label: "Rollback" }
        ],
        rows: stepRows.map((r) => ({
          id: r.id || "",
          title: r.title || "",
          ownerRole: r.ownerRole || "",
          status: r.status || "—",
          completedAt: r.completedAt || r.startedAt || "—",
          rollback: truncated(r.rollbackCriteria)
        }))
      })}
    `
  });
}

export function renderWave10HypercareBoard(hypercare = null, metrics = []) {
  const plan = hypercare?.plan || hypercare || {};
  const status = hypercare?.run?.status || hypercare?.status || "NotStarted";
  const body = `
    ${stStatGrid([
      { label: "Duration", value: plan.durationDays != null ? `${plan.durationDays}d` : "—" },
      { label: "Extended watch", value: plan.extendedWatchDays != null ? `${plan.extendedWatchDays}d` : "—" },
      { label: "Status", value: String(status) },
      { label: "Metrics", value: String(metrics.length || "—") }
    ])}
    ${metrics.length
      ? stTable({
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Metric" },
          { key: "actual", label: "Actual" }
        ],
        rows: metrics.map((m) => ({
          id: m.id,
          name: m.name || "",
          actual: m.actual == null ? m.actualNote || "not measured" : String(m.actual)
        }))
      })
      : stMuted("Success metrics actuals remain null until ops measures them.")}
  `;
  return stLazyPanel({
    id: "wave10-hypercare",
    title: "Hypercare board",
    body
  });
}

export function renderWave10ClosureSignoff(evidence = null) {
  const g = evidence?.goLive || {};
  const approvals = g.humanApprovals || [];
  const closure = evidence?.projectClosure || {};
  return stPanel({
    title: "Closure / sign-off status",
    body: `
      ${stMuted("Evidence: docs/release-evidence/wave10-golive-evidence.json · artifacts/wave10/")}
      ${evidence
        ? stStatGrid([
          { label: "Decision", value: String(g.decision || "—") },
          { label: "Framework waves", value: closure.frameworkWavesComplete ? "1–10 complete" : "—" },
          { label: "Prod live", value: evidence.claim?.liveProductionCutover ? "yes" : "no" },
          { label: "CERT-001", value: g.cert001?.certified ? "certified" : "preview" }
        ])
        : stMuted("Run validate:golive to publish evidence.")}
      ${closure.statement ? `<p class="muted" style="margin-top:8px">${stEscape(closure.statement)}</p>` : ""}
      ${approvals.length
        ? `<div style="margin-top:10px" aria-label="Human approval gates">${stTable({
          columns: [
            { key: "role", label: "Role" },
            { key: "status", label: "Status" }
          ],
          rows: approvals.map((a) => ({ role: a.role, status: a.status }))
        })}</div>`
        : ""}
    `
  });
}

export function renderWave10ProdEnv(envRows = []) {
  if (!envRows.length) {
    return stLazyPanel({
      id: "wave10-env",
      title: "Production environment checklist",
      body: stMuted("Prod env rows appear after validate:golive.")
    });
  }
  return stLazyPanel({
    id: "wave10-env",
    title: "Production environment checklist",
    body: stTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "category", label: "Category" },
        { key: "differs", label: "≠ Pilot/Dev" },
        { key: "status", label: "Status" }
      ],
      rows: envRows.map((r) => ({
        id: r.id,
        category: r.category || "",
        differs: r.differsFromPilotDev ? "yes" : "no",
        status: r.status || ""
      }))
    })
  });
}

export function renderWave10ParityChecklist(rows = []) {
  if (!rows.length) return "";
  return stLazyPanel({
    id: "wave10-parity",
    title: "Wave 10 production parity checklist",
    body: stTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Item" },
        { key: "channel", label: "Channel" }
      ],
      rows
    })
  });
}

/**
 * Read-only org hard-stop board under Audit/Reports (no new top-level nav).
 * Never flips HA-* or invents signing secrets.
 */
export function renderOrgBlockedHardStopsPanel(model = {}) {
  const items = Array.isArray(model.items) ? model.items : [];
  const note = model.note || "Blocked on org/humans — see docs/backlog/blocked-on-org.md.";
  const canView = model.canView !== false;
  if (!canView) return "";
  const hgJump = (panelId, label) =>
    `<button type="button" class="btn secondary" data-view-jump="audit" data-panel-focus="${stEscape(panelId)}" aria-label="${stEscape(label)}">${stEscape(label)}</button>`;
  return stPanel({
    title: "Blocked on org / humans (read-only)",
    body: `
      ${stMuted(note)}
      ${stAlert({
        tone: "warning",
        message: "Implementation paused for these rows. Agents must not fabricate Approvals, keystores, CSC certs, remotes, or live cutover."
      })}
      ${stMuted("Owner checklist: docs/backlog/org-handoff-checklist.md · Human gates: docs/backlog/human-gates-runbook.md · Local UAT SQL: scripts/apply-uat-migrations.md")}
      <div class="row" style="margin:10px 0;gap:8px;flex-wrap:wrap" role="group" aria-label="Open Wave 9 HG recorders">
        ${hgJump("wave9-uat-recorder", "HG-01 UAT recorder")}
        ${hgJump("wave9-training-recorder", "HG-02 Training")}
        ${hgJump("wave9-recon-recorder", "HG-03 Recon")}
        ${hgJump("wave9-security-recorder", "HG-04 Security")}
        ${hgJump("wave9-executive-recorder", "HG-05 Executive")}
      </div>
      ${items.length
        ? stTable({
          columns: [
            { key: "id", label: "ID" },
            { key: "gap", label: "Gap" },
            { key: "owner", label: "Owner" },
            { key: "action", label: "Required action" }
          ],
          rows: items.map((row) => ({
            id: row.id || "—",
            gap: row.gap || "—",
            owner: row.owner || "—",
            action: row.action || "—"
          }))
        })
        : stMuted("No hard-stop rows loaded.")}
      ${stMuted("Local check: npm run check:prod-readiness (default skips tests; add --run-tests to execute npm test).")}
    `
  });
}

export function renderWave10ReportsExtra(model = {}) {
  return renderWave10ClosureSignoff(model.evidence || null);
}
