/**
 * Wave 8 — Release Certification panel under Audit / Reports.
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

export function renderWave8CertificationPanel(model = {}) {
  const smoke = model.smoke || {};
  const gaps = model.gaps || {};
  const evidence = model.evidence || null;
  const canView = model.canView !== false;
  if (!canView) return "";

  const decision = evidence?.decision || "—";
  const blockers = evidence?.blockers || [];
  const gates = evidence?.qualityGates?.gateResults || [];

  return `
    <section class="panel wave8-certification-panel" aria-labelledby="wave8CertTitle" style="margin-top:18px">
      <h2 id="wave8CertTitle">Release Certification (Wave 8)</h2>
      ${stSrOnly("Wave 8 release candidate validation. Uses Phase 16 quality gates. RC1 is pilot/UAT ready, not CERT-001 production promote.")}
      ${stMuted("Certifies Waves 1–7 on the shared SPA. Run npm run validate:rc to refresh machine-readable evidence. Full CERT-001 remains Wave 10.")}
      ${stStatGrid([
        { label: "RC decision", value: String(decision) },
        { label: "Pilot ready gaps", value: gaps.pilotReady === false ? "No" : "Yes" },
        { label: "Phase 16", value: String(smoke.phase16 || evidence?.p16Version || "—") },
        { label: "Ready Wave 9", value: evidence?.readyForWave9 ? "Yes" : (evidence ? "No" : "—") }
      ])}
      <div class="row-actions" style="margin-top:12px">
        ${stButton({ label: "Reload RC evidence", action: "wave8-refresh-rc", variant: "secondary", ariaLabel: "Reload last Wave 8 release candidate evidence" })}
      </div>
      ${evidence
        ? stAlert({
          tone: decision === "PASS" ? "info" : "warning",
          message: decision === "PASS"
            ? "Last RC1 evidence: PASS — pilot/UAT entry criteria met (not production CERT-001)."
            : `Last RC1 evidence: ${decision}. Blockers: ${blockers.join(", ") || "see evidence JSON"}.`
        })
        : stAlert({ tone: "info", message: "No RC evidence in session yet. Generate with: npm run validate:rc" })}
    </section>

    ${stLazyPanel({
      id: "wave8-gates",
      title: "Quality gate snapshot",
      body: gates.length
        ? stTable({
          columns: [
            { key: "gateId", label: "Gate" },
            { key: "decision", label: "Decision" },
            { key: "passed", label: "Passed" }
          ],
          rows: gates.map((g) => ({
            gateId: g.gateId,
            decision: g.decision || "",
            passed: g.passed ? "yes" : "no"
          }))
        })
        : stMuted("Gate results appear after validate:rc.")
    })}

    ${stLazyPanel({
      id: "wave8-blockers",
      title: "Release blockers",
      body: blockers.length
        ? `<ul>${blockers.map((b) => `<li>${stEscape(b)}</li>`).join("")}</ul>`
        : stMuted("No blockers recorded in last evidence.")
    })}
  `;
}

export function renderWave8ParityChecklist(rows = []) {
  if (!rows.length) return "";
  return stLazyPanel({
    id: "wave8-parity",
    title: "Wave 8 certification parity checklist",
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

export function renderWave8ReportsExtra(model = {}) {
  return stPanel({
    title: "Wave 8 RC evidence",
    body: `
      ${stMuted("Evidence files: docs/release-evidence/rc1-evidence.json · artifacts/wave8/rc1-evidence.json")}
      ${model.evidence
        ? stStatGrid([
          { label: "Decision", value: String(model.evidence.decision || "—") },
          { label: "Tests", value: String(model.evidence.testSummary?.total ?? "—") },
          { label: "Pass rate", value: `${model.evidence.testSummary?.passRate ?? "—"}%` }
        ])
        : stMuted("Run validate:rc to publish evidence.")}
    `
  });
}
