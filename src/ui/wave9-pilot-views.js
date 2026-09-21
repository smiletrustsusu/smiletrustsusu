/**
 * Wave 9 — Pilot / UAT / Ops Readiness panels under Audit / Reports.
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
  stEscape,
  stSelect,
  stField
} from "./shared-primitives.js";
import { UAT_HUMAN_CONFIRM_PHRASE } from "../core/wave9-uat-recording.js";
import { TRAINING_HUMAN_CONFIRM_PHRASE } from "../core/wave9-training-recording.js";
import { RECON_HUMAN_CONFIRM_PHRASE } from "../core/wave9-recon-recording.js";
import { SECURITY_HUMAN_CONFIRM_PHRASE } from "../core/wave9-security-recording.js";
import {
  EXECUTIVE_HUMAN_CONFIRM_PHRASE,
  EXECUTIVE_DECISION
} from "../core/wave9-executive-recording.js";

export function renderWave9PilotPanel(model = {}) {
  const smoke = model.smoke || {};
  const gaps = model.gaps || {};
  const evidence = model.evidence || null;
  const canView = model.canView !== false;
  if (!canView) return "";

  const decision = evidence?.goNoGo?.decision || "—";
  const readyW10 = evidence?.goNoGo?.readyForWave10 || "—";
  const conditions = evidence?.goNoGo?.conditions || [];
  const counts = smoke.counts || gaps.counts || {};

  return `
    <section class="panel wave9-pilot-panel" aria-labelledby="wave9PilotTitle" style="margin-top:18px">
      <h2 id="wave9PilotTitle">Pilot / UAT / Ops Readiness (Wave 9)</h2>
      ${stSrOnly("Wave 9 pilot deployment, UAT tracker, and operational readiness. Framework and evidence pack — not a live branch cutover claim.")}
      ${stMuted("Operators execute the pilot pack against an isolated env. HG-01 UAT deferred · HG-02 Training / HG-03 Recon / HG-04 Security prepared (all still PendingHumanSignOff) · Current focus HG-05 Executive Sponsor: docs/governance/wave9-executive-sponsor-execution-guide.md · Login as JOHN. Run npm run validate:pilot to refresh evidence. Wave 10 cutover / CERT-001 remain blocked until real human approvals — never auto-approve HA-EXEC.")}
      ${stStatGrid([
        { label: "Go/No-Go", value: String(decision) },
        { label: "Ready Wave 10", value: String(readyW10) },
        { label: "UAT scenarios", value: String(counts.uatScenarios ?? "—") },
        { label: "Framework ready", value: gaps.frameworkReady === false ? "No" : "Yes" }
      ])}
      <div class="row-actions" style="margin-top:12px">
        ${stButton({ label: "Reload pilot evidence", action: "wave9-refresh-pilot", variant: "secondary", ariaLabel: "Reload last Wave 9 pilot evidence" })}
      </div>
      ${evidence
        ? stAlert({
          tone: decision === "No-Go" ? "warning" : "info",
          message: decision === "Conditional"
            ? `Conditional Go / Ready for Executive Review. Conditions: ${conditions.slice(0, 4).join(", ") || "see evidence"}${conditions.length > 4 ? "…" : ""}. Not a live cutover.`
            : decision === "Go"
              ? "Go — all recorded gates complete (production promote still Wave 10)."
              : `Go/No-Go: ${decision}. ${evidence.goNoGo?.meaning || ""}`
        })
        : stAlert({ tone: "info", message: "No pilot evidence in session yet. Generate with: npm run validate:pilot" })}
    </section>
  `;
}

export function renderWave9UatTracker(scenarioRows = []) {
  if (!scenarioRows.length) {
    return stLazyPanel({
      id: "wave9-uat",
      title: "UAT tracker",
      body: stMuted("UAT matrix appears after validate:pilot or when evidence is loaded.")
    });
  }
  return stLazyPanel({
    id: "wave9-uat",
    title: "UAT tracker",
    body: stTable({
      columns: [
        { key: "scenarioId", label: "ID" },
        { key: "domain", label: "Domain" },
        { key: "status", label: "Status" },
        { key: "passFail", label: "Result" },
        { key: "approverStatus", label: "Approver" }
      ],
      rows: scenarioRows.map((r) => ({
        scenarioId: r.scenarioId || r.id || "",
        domain: r.domain || "",
        status: r.status || "",
        passFail: r.passFail || "—",
        approverStatus: r.approverStatus || "—"
      }))
    })
  });
}

/**
 * Interactive recorder: Pass/Fail + notes → localStorage / export.
 * Does NOT auto-flip HA-PO / HA-QA. Explicit gate approval needs typed name + phrase.
 */
export function renderWave9UatRecorder(model = {}) {
  const runSheet = model.runSheet || null;
  const canRecord = model.canRecord !== false;
  if (!canRecord) return "";

  const scenarios = runSheet?.scenarios || [];
  const scores = runSheet?.scores || {};
  const gates = runSheet?.humanGates || {};
  const haPo = gates["HA-PO"]?.status || "PendingHumanSignOff";
  const haQa = gates["HA-QA"]?.status || "PendingHumanSignOff";

  const rowsHtml = scenarios.length
    ? scenarios
      .map((s) => {
        const id = stEscape(s.scenarioId);
        return `
          <tr data-uat-scenario="${id}">
            <td><strong>${id}</strong><div class="muted">${stEscape(s.title || "")}</div></td>
            <td>${stEscape(s.domain || "")}</td>
            <td>
              <select class="uat-passfail" data-uat-passfail="${id}" aria-label="Pass/Fail ${id}">
                <option value="">—</option>
                <option value="pass" ${s.passFail === "pass" ? "selected" : ""}>pass</option>
                <option value="fail" ${s.passFail === "fail" ? "selected" : ""}>fail</option>
                <option value="blocked" ${s.passFail === "blocked" ? "selected" : ""}>blocked</option>
              </select>
            </td>
            <td>
              <input type="text" class="uat-notes" data-uat-notes="${id}" value="${stEscape(s.notes || "")}"
                placeholder="Notes / evidence" aria-label="Notes ${id}" />
            </td>
            <td>
              <input type="text" class="uat-executor" data-uat-executor="${id}" value="${stEscape(s.executedBy || "")}"
                placeholder="Executed by" aria-label="Executed by ${id}" />
            </td>
            <td class="muted">${stEscape(s.approverStatus || "PendingHumanSignOff")}</td>
            <td>
              <button type="button" class="btn secondary" data-action="wave9-uat-save"
                data-scenario-id="${id}" aria-label="Save UAT result ${id}">Save</button>
            </td>
          </tr>`;
      })
      .join("")
    : `<tr><td colspan="7">${stMuted("No scenarios in run sheet.")}</td></tr>`;

  return stLazyPanel({
    id: "wave9-uat-recorder",
    title: "UAT execution recorder (human)",
    body: `
      ${stMuted("NORTHRISE MICRO SAVINGS pilot · Login as JOHN for business UAT. KBA is developer support only (JOHN must not see KBA). Guide: docs/uat/wave9-uat-execution-guide.md")}
      ${stAlert({
        tone: "info",
        message: `Run sheet ${runSheet?.status || "ReadyToExecute"} · recorded ${scores.recordedPassFailCount ?? 0}/${scores.mandatoryTotal ?? 21} · business signed ${scores.businessSignedCount ?? 0}/${scores.mandatoryTotal ?? 21} · HA-PO ${haPo} · HA-QA ${haQa}. Pass/Fail save never auto-approves gates.`
      })}
      ${stStatGrid([
        { label: "Executable", value: String(scores.executableCount ?? "—") },
        { label: "Recorded", value: String(scores.recordedPassFailCount ?? 0) },
        { label: "Business signed", value: String(scores.businessSignedCount ?? 0) },
        { label: "Gates auto-Approved", value: "No" }
      ])}
      <div class="row-actions" style="margin-top:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px">
        ${stButton({ label: "Export for sign-off", action: "wave9-uat-export", variant: "secondary", ariaLabel: "Export UAT run sheet JSON for sign-off" })}
        ${stButton({ label: "Reset local recorder", action: "wave9-uat-reset", variant: "ghost", ariaLabel: "Reset local UAT run sheet" })}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table" aria-label="UAT scenario recorder">
          <thead>
            <tr>
              <th>Scenario</th><th>Domain</th><th>Pass/Fail</th><th>Notes</th><th>Executed by</th><th>Approver</th><th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record human approval">
        <h3>Record human approval (explicit)</h3>
        ${stMuted(`Requires typed name + exact phrase: ${UAT_HUMAN_CONFIRM_PHRASE}. Does not run from Pass/Fail.`)}
        <div class="form-grid" style="margin-top:8px">
          ${stSelect({
            label: "Gate",
            name: "wave9UatGateId",
            selected: "HA-PO",
            options: [
              { value: "HA-PO", label: "HA-PO — Product / Business Owner" },
              { value: "HA-QA", label: "HA-QA — QA Lead" }
            ]
          })}
          ${stField({ label: "Approver full name", name: "wave9UatApproverName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9UatConfirmPhrase", placeholder: UAT_HUMAN_CONFIRM_PHRASE })}
          ${stField({ label: "Notes (optional)", name: "wave9UatGateNotes", placeholder: "Evidence / memo ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Record human approval",
            action: "wave9-uat-gate-approve",
            variant: "primary",
            ariaLabel: "Record explicit human gate approval with typed name"
          })}
        </div>
      </div>
    `
  });
}

/**
 * Interactive training recorder: attendance + competency + explicit completion.
 * Does NOT auto-clear training_completion_pending. Explicit completion needs typed name + phrase.
 */
export function renderWave9TrainingRecorder(model = {}) {
  const runSheet = model.runSheet || null;
  const canRecord = model.canRecord !== false;
  if (!canRecord) return "";

  const tracks = runSheet?.tracks || [];
  const scores = runSheet?.scores || {};
  const gates = runSheet?.humanGates || {};
  const hg02 = gates["HG-02"]?.status || "PendingHumanSignOff";
  const pending = scores.trainingCompletionPending !== false;

  const rowsHtml = tracks.length
    ? tracks
      .map((t) => {
        const id = stEscape(t.trackId);
        const attendanceCount = (t.attendance || []).length;
        return `
          <tr data-training-track="${id}">
            <td><strong>${id}</strong><div class="muted">${stEscape(t.role || "")} · ${stEscape(String(t.durationHours ?? ""))}h</div></td>
            <td>
              <input type="text" class="training-participant" data-training-participant="${id}"
                placeholder="Participant name" aria-label="Participant ${id}" />
              <div class="muted" style="margin-top:4px">${attendanceCount} recorded</div>
            </td>
            <td>
              <select class="training-competency" data-training-competency="${id}" aria-label="Competency ${id}">
                <option value="">—</option>
                <option value="pass" ${t.competencyPassed === "pass" ? "selected" : ""}>pass</option>
                <option value="fail" ${t.competencyPassed === "fail" ? "selected" : ""}>fail</option>
                <option value="blocked" ${t.competencyPassed === "blocked" ? "selected" : ""}>blocked</option>
              </select>
            </td>
            <td>
              <input type="text" class="training-notes" data-training-notes="${id}" value="${stEscape(t.notes || t.competencyNotes || "")}"
                placeholder="Notes / evidence" aria-label="Notes ${id}" />
            </td>
            <td class="muted">${stEscape(t.completionStatus || "PendingHumanSignOff")}<div>${stEscape(t.completedBy || "—")}</div></td>
            <td>
              <div class="row-actions" style="display:flex; flex-direction:column; gap:4px">
                <button type="button" class="btn secondary" data-action="wave9-training-attendance"
                  data-track-id="${id}" aria-label="Save attendance ${id}">Attendance</button>
                <button type="button" class="btn secondary" data-action="wave9-training-competency"
                  data-track-id="${id}" aria-label="Save competency ${id}">Competency</button>
                <button type="button" class="btn" data-action="wave9-training-complete"
                  data-track-id="${id}" aria-label="Complete track ${id} with typed name">Complete…</button>
              </div>
            </td>
          </tr>`;
      })
      .join("")
    : `<tr><td colspan="6">${stMuted("No tracks in run sheet.")}</td></tr>`;

  return stLazyPanel({
    id: "wave9-training-recorder",
    title: "Training execution recorder (human)",
    body: `
      ${stMuted("NORTHRISE MICRO SAVINGS · HG-02 Training Completion · Login as JOHN. KBA is developer support only (JOHN must not see KBA). Guide: docs/training/wave9-training-execution-guide.md")}
      ${stAlert({
        tone: "info",
        message: `Run sheet ${runSheet?.status || "ReadyToExecute"} · attendance ${scores.attendanceRecordedCount ?? 0}/${scores.trackTotal ?? 6} · competency ${scores.competencyRecordedCount ?? 0}/${scores.trackTotal ?? 6} · completed ${scores.completedCount ?? 0}/${scores.trackTotal ?? 6} · HG-02 ${hg02} · training_completion_pending=${pending ? "true" : "false"}. Attendance/competency never auto-completes tracks.`
      })}
      ${stStatGrid([
        { label: "Tracks", value: String(scores.trackTotal ?? "—") },
        { label: "Attendance", value: String(scores.attendanceRecordedCount ?? 0) },
        { label: "Completed", value: String(scores.completedCount ?? 0) },
        { label: "Auto-cleared pending", value: "No" }
      ])}
      <div class="row-actions" style="margin-top:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px">
        ${stButton({ label: "Export for sign-off", action: "wave9-training-export", variant: "secondary", ariaLabel: "Export training run sheet JSON for sign-off" })}
        ${stButton({ label: "Reset local recorder", action: "wave9-training-reset", variant: "ghost", ariaLabel: "Reset local training run sheet" })}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table" aria-label="Training track recorder">
          <thead>
            <tr>
              <th>Track</th><th>Attendance</th><th>Competency</th><th>Notes</th><th>Completion</th><th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record track completion">
        <h3>Record track completion (explicit)</h3>
        ${stMuted(`Requires typed completer name + exact phrase: ${TRAINING_HUMAN_CONFIRM_PHRASE}. Use Complete… on a track row, or fill below then click Complete track.`)}
        <div class="form-grid" style="margin-top:8px">
          ${stSelect({
            label: "Track",
            name: "wave9TrainingTrackId",
            selected: tracks[0]?.trackId || "TR-CASHIER",
            options: tracks.map((t) => ({ value: t.trackId, label: `${t.trackId} — ${t.role}` }))
          })}
          ${stField({ label: "Completer full name", name: "wave9TrainingCompleterName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9TrainingConfirmPhrase", placeholder: TRAINING_HUMAN_CONFIRM_PHRASE })}
          ${stField({ label: "Notes (optional)", name: "wave9TrainingCompleteNotes", placeholder: "Evidence / attendance sheet ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Complete selected track",
            action: "wave9-training-complete-form",
            variant: "primary",
            ariaLabel: "Record explicit track completion with typed name"
          })}
        </div>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record HG-02 completion">
        <h3>Record HG-02 completion (all tracks)</h3>
        ${stMuted(`Only after all tracks completed with names. Phrase: ${TRAINING_HUMAN_CONFIRM_PHRASE}. Does not run from attendance/competency.`)}
        <div class="form-grid" style="margin-top:8px">
          ${stField({ label: "Completer full name", name: "wave9TrainingGateCompleterName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9TrainingGateConfirmPhrase", placeholder: TRAINING_HUMAN_CONFIRM_PHRASE })}
          ${stField({ label: "Notes (optional)", name: "wave9TrainingGateNotes", placeholder: "Training pack memo ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Record HG-02 completion",
            action: "wave9-training-gate-complete",
            variant: "primary",
            ariaLabel: "Record explicit HG-02 training gate completion with typed name"
          })}
        </div>
      </div>
    `
  });
}

/**
 * Interactive financial recon recorder: Pass/Fail + variance notes + explicit HA-RECON / HA-FIN.
 * Does NOT set claim.productionReconciled true. Explicit sign-off needs typed name + phrase.
 */
export function renderWave9ReconRecorder(model = {}) {
  const runSheet = model.runSheet || null;
  const canRecord = model.canRecord !== false;
  if (!canRecord) return "";

  const items = runSheet?.checklist || [];
  const scores = runSheet?.scores || {};
  const gates = runSheet?.humanGates || {};
  const haRecon = gates["HA-RECON"]?.status || "PendingHumanSignOff";
  const haFin = gates["HA-FIN"]?.status || "PendingHumanSignOff";
  const prodClaim = runSheet?.claim?.productionReconciled === true ? "true" : "false";

  const rowsHtml = items.length
    ? items
      .map((item) => {
        const id = stEscape(item.itemId);
        return `
          <tr data-recon-item="${id}">
            <td><strong>${id}</strong><div class="muted">${stEscape(item.title || "")}</div></td>
            <td>${stEscape(item.category || "")}</td>
            <td>
              <select class="recon-passfail" data-recon-passfail="${id}" aria-label="Pass/Fail ${id}">
                <option value="">—</option>
                <option value="pass" ${item.passFail === "pass" ? "selected" : ""}>pass</option>
                <option value="fail" ${item.passFail === "fail" ? "selected" : ""}>fail</option>
                <option value="blocked" ${item.passFail === "blocked" ? "selected" : ""}>blocked</option>
              </select>
            </td>
            <td>
              <input type="text" class="recon-variance" data-recon-variance="${id}" value="${item.variancePesewas != null ? stEscape(String(item.variancePesewas)) : ""}"
                placeholder="Variance pesewas" aria-label="Variance pesewas ${id}" inputmode="numeric" />
            </td>
            <td>
              <input type="text" class="recon-notes" data-recon-notes="${id}" value="${stEscape(item.varianceNotes || item.notes || "")}"
                placeholder="Variance / notes" aria-label="Notes ${id}" />
            </td>
            <td>
              <input type="text" class="recon-signer" data-recon-signer="${id}" value="${stEscape(item.signerName || item.executedBy || "")}"
                placeholder="Signer / executor" aria-label="Signer ${id}" />
            </td>
            <td>
              <button type="button" class="btn secondary" data-action="wave9-recon-save"
                data-item-id="${id}" aria-label="Save recon result ${id}">Save</button>
            </td>
          </tr>`;
      })
      .join("")
    : `<tr><td colspan="7">${stMuted("No checklist items in run sheet.")}</td></tr>`;

  return stLazyPanel({
    id: "wave9-recon-recorder",
    title: "Financial reconciliation recorder (human)",
    body: `
      ${stMuted("NORTHRISE MICRO SAVINGS · HG-03 Financial Reconciliation · Login as JOHN. Finance/Branch Manager signs HA-RECON / HA-FIN. KBA is developer support only (JOHN must not see KBA). Guide: docs/reconciliation/wave9-financial-recon-execution-guide.md · Compare in pesewas; GHS = pesewas/100; float limit 1000.")}
      ${stAlert({
        tone: "info",
        message: `Run sheet ${runSheet?.status || "ReadyToExecute"} · recorded ${scores.recordedPassFailCount ?? 0}/${scores.checklistTotal ?? 8} · passed ${scores.passedCount ?? 0} · HA-RECON ${haRecon} · HA-FIN ${haFin} · productionReconciled=${prodClaim}. Pass/Fail save never auto-approves gates and never sets productionReconciled true.`
      })}
      ${stStatGrid([
        { label: "Checklist", value: String(scores.checklistTotal ?? "—") },
        { label: "Recorded", value: String(scores.recordedPassFailCount ?? 0) },
        { label: "Variances noted", value: String(scores.varianceNotedCount ?? 0) },
        { label: "productionReconciled", value: "false" }
      ])}
      <div class="row-actions" style="margin-top:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px">
        ${stButton({ label: "Export for sign-off", action: "wave9-recon-export", variant: "secondary", ariaLabel: "Export recon run sheet JSON for sign-off" })}
        ${stButton({ label: "Reset local recorder", action: "wave9-recon-reset", variant: "ghost", ariaLabel: "Reset local recon run sheet" })}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table" aria-label="Financial reconciliation checklist recorder">
          <thead>
            <tr>
              <th>Item</th><th>Category</th><th>Pass/Fail</th><th>Variance (pesewas)</th><th>Notes</th><th>Signer</th><th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record HA-RECON sign-off">
        <h3>Record HA-RECON / HA-FIN sign-off (explicit)</h3>
        ${stMuted(`Requires typed signer name + exact phrase: ${RECON_HUMAN_CONFIRM_PHRASE}. Does not run from Pass/Fail. Never sets productionReconciled true.`)}
        <div class="form-grid" style="margin-top:8px">
          ${stSelect({
            label: "Gate",
            name: "wave9ReconGateId",
            selected: "HA-RECON",
            options: [
              { value: "HA-RECON", label: "HA-RECON — Finance / Branch Manager" },
              { value: "HA-FIN", label: "HA-FIN — Finance acceptance" }
            ]
          })}
          ${stField({ label: "Signer full name", name: "wave9ReconSignerName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9ReconConfirmPhrase", placeholder: RECON_HUMAN_CONFIRM_PHRASE })}
          ${stField({ label: "Notes (optional)", name: "wave9ReconGateNotes", placeholder: "Worksheet / memo ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Record recon sign-off",
            action: "wave9-recon-gate-approve",
            variant: "primary",
            ariaLabel: "Record explicit HA-RECON or HA-FIN sign-off with typed name"
          })}
        </div>
      </div>
    `
  });
}

/**
 * Interactive security acceptance recorder: Pass/Fail + finding notes + explicit HA-SEC.
 * Does NOT auto-approve HA-SEC. Explicit sign-off needs typed name + phrase.
 */
export function renderWave9SecurityRecorder(model = {}) {
  const runSheet = model.runSheet || null;
  const canRecord = model.canRecord !== false;
  if (!canRecord) return "";

  const items = runSheet?.checklist || [];
  const scores = runSheet?.scores || {};
  const gates = runSheet?.humanGates || {};
  const haSec = gates["HA-SEC"]?.status || "PendingHumanSignOff";
  const hardenClaim = runSheet?.claim?.productionHardenedClaim === true ? "true" : "false";

  const rowsHtml = items.length
    ? items
      .map((item) => {
        const id = stEscape(item.itemId);
        return `
          <tr data-security-item="${id}">
            <td><strong>${id}</strong><div class="muted">${stEscape(item.title || "")}</div></td>
            <td>${stEscape(item.category || "")}</td>
            <td>
              <select class="security-passfail" data-security-passfail="${id}" aria-label="Pass/Fail ${id}">
                <option value="">—</option>
                <option value="pass" ${item.passFail === "pass" ? "selected" : ""}>pass</option>
                <option value="fail" ${item.passFail === "fail" ? "selected" : ""}>fail</option>
                <option value="blocked" ${item.passFail === "blocked" ? "selected" : ""}>blocked</option>
              </select>
            </td>
            <td>
              <input type="text" class="security-notes" data-security-notes="${id}" value="${stEscape(item.findingNotes || item.notes || "")}"
                placeholder="Finding / notes" aria-label="Notes ${id}" />
            </td>
            <td>
              <input type="text" class="security-evidence" data-security-evidence="${id}" value="${stEscape(item.evidence || "")}"
                placeholder="Evidence ref" aria-label="Evidence ${id}" />
            </td>
            <td>
              <input type="text" class="security-signer" data-security-signer="${id}" value="${stEscape(item.signerName || item.executedBy || "")}"
                placeholder="Signer / executor" aria-label="Signer ${id}" />
            </td>
            <td>
              <button type="button" class="btn secondary" data-action="wave9-security-save"
                data-item-id="${id}" aria-label="Save security result ${id}">Save</button>
            </td>
          </tr>`;
      })
      .join("")
    : `<tr><td colspan="7">${stMuted("No checklist items in run sheet.")}</td></tr>`;

  return stLazyPanel({
    id: "wave9-security-recorder",
    title: "Security acceptance recorder (human)",
    body: `
      ${stMuted("NORTHRISE MICRO SAVINGS · HG-04 Security Acceptance · Login as JOHN. Security Governance signs HA-SEC. KBA is developer support only (JOHN must not see KBA). Guide: docs/security/wave9-security-acceptance-execution-guide.md · No prod deploy/migrate. Preserve SUPER_ADMIN_FORBIDDEN · money 15/31/1000.")}
      ${stAlert({
        tone: "info",
        message: `Run sheet ${runSheet?.status || "ReadyToExecute"} · recorded ${scores.recordedPassFailCount ?? 0}/${scores.checklistTotal ?? 9} · passed ${scores.passedCount ?? 0} · HA-SEC ${haSec} · productionHardenedClaim=${hardenClaim}. Pass/Fail save never auto-approves HA-SEC.`
      })}
      ${stStatGrid([
        { label: "Checklist", value: String(scores.checklistTotal ?? "—") },
        { label: "Recorded", value: String(scores.recordedPassFailCount ?? 0) },
        { label: "Fail/Blocked", value: String(scores.failedOrBlockedCount ?? 0) },
        { label: "HA-SEC", value: String(haSec) }
      ])}
      <div class="row-actions" style="margin-top:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px">
        ${stButton({ label: "Export for sign-off", action: "wave9-security-export", variant: "secondary", ariaLabel: "Export security run sheet JSON for sign-off" })}
        ${stButton({ label: "Reset local recorder", action: "wave9-security-reset", variant: "ghost", ariaLabel: "Reset local security run sheet" })}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table" aria-label="Security acceptance checklist recorder">
          <thead>
            <tr>
              <th>Item</th><th>Category</th><th>Pass/Fail</th><th>Finding notes</th><th>Evidence</th><th>Signer</th><th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record HA-SEC sign-off">
        <h3>Record HA-SEC sign-off (explicit)</h3>
        ${stMuted(`Requires typed signer name + exact phrase: ${SECURITY_HUMAN_CONFIRM_PHRASE}. Does not run from Pass/Fail. Never sets productionHardenedClaim true. Remediate Fail/Blocked before signing.`)}
        <div class="form-grid" style="margin-top:8px">
          ${stField({ label: "Signer full name", name: "wave9SecuritySignerName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9SecurityConfirmPhrase", placeholder: SECURITY_HUMAN_CONFIRM_PHRASE })}
          ${stField({ label: "Notes (optional)", name: "wave9SecurityGateNotes", placeholder: "Memo / evidence packet ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Record HA-SEC sign-off",
            action: "wave9-security-gate-approve",
            variant: "primary",
            ariaLabel: "Record explicit HA-SEC sign-off with typed name"
          })}
        </div>
      </div>
    `
  });
}

/**
 * Interactive Executive Sponsor recorder: Full Go / Conditional Go / No-Go.
 * Does NOT auto-approve HA-EXEC / HA-W9-EXEC. Explicit decision needs typed name + phrase.
 * Full Go with open HG-01..04 requires accept-open-conditions + typed condition list.
 */
export function renderWave9ExecutiveRecorder(model = {}) {
  const runSheet = model.runSheet || null;
  const canRecord = model.canRecord !== false;
  if (!canRecord) return "";

  const scores = runSheet?.scores || {};
  const gates = runSheet?.humanGates || {};
  const haExec = gates["HA-EXEC"]?.status || "PendingHumanSignOff";
  const haW9 = gates["HA-W9-EXEC"]?.status || "PendingHumanSignOff";
  const memo = runSheet?.memo || {};
  const review = runSheet?.reviewPack || {};
  const prereqs = runSheet?.prerequisites || [];
  const openConditionsText = Array.isArray(memo.openConditions)
    ? memo.openConditions.join("\n")
    : String(memo.openConditions || "");
  const sponsor = memo.sponsorMemoFields || {};
  const wave10Claim = runSheet?.claim?.wave10CutoverAuthorized === true ? "true" : "false";
  const fullGoClaim = runSheet?.claim?.fullGoClaimed === true ? "true" : "false";

  const prereqRows = prereqs.length
    ? prereqs
      .map((p) => `
          <tr>
            <td><strong>${stEscape(p.id)}</strong></td>
            <td>${stEscape(p.label || "")}</td>
            <td class="muted">${stEscape(p.status || "PendingHumanSignOff")}</td>
            <td class="muted">${stEscape(p.note || "")}</td>
          </tr>`)
      .join("")
    : `<tr><td colspan="4">${stMuted("No prerequisite rows.")}</td></tr>`;

  return stLazyPanel({
    id: "wave9-executive-recorder",
    title: "Executive Sponsor recorder (human)",
    body: `
      ${stMuted("NORTHRISE MICRO SAVINGS · HG-05 Executive Sponsor Approval · Login as JOHN. Executive Sponsor signs HA-EXEC / HA-W9-EXEC. KBA is developer support only (JOHN must not see KBA). Guide: docs/governance/wave9-executive-sponsor-execution-guide.md · No prod deploy/migrate. Wave 10 cutover blocked until real approvals · money 15/31/1000.")}
      ${stAlert({
        tone: "info",
        message: `Run sheet ${runSheet?.status || "ReadyToExecute"} · prereqs pending ${scores.prerequisitesPendingCount ?? 4}/${scores.prerequisiteTotal ?? 4} · HA-EXEC ${haExec} · HA-W9-EXEC ${haW9} · fullGoClaimed=${fullGoClaim} · wave10CutoverAuthorized=${wave10Claim}. Memo save never auto-approves. Full Go with open HG-01..04 requires Accept open conditions + typed list.`
      })}
      ${stStatGrid([
        { label: "Prereqs pending", value: String(scores.prerequisitesPendingCount ?? 4) },
        { label: "HA-EXEC", value: String(haExec) },
        { label: "Decision", value: String(memo.decision || "—") },
        { label: "Wave 10 auth", value: wave10Claim }
      ])}
      <div class="panel" style="margin-top:12px" aria-label="Executive review pack">
        <h3>Review pack (read before deciding)</h3>
        <ul class="muted">
          <li><strong>RC1:</strong> ${stEscape(review.rc1Status || "Confirm RC1 evidence")}</li>
          <li><strong>Conditional Go:</strong> ${stEscape(review.conditionalGoMeaning || "")}</li>
          <li><strong>Deferred UAT:</strong> ${stEscape(review.deferredUat || "")}</li>
          <li><strong>Training:</strong> ${stEscape(review.trainingStatus || "")}</li>
          <li><strong>Recon:</strong> ${stEscape(review.reconStatus || "")}</li>
          <li><strong>Security:</strong> ${stEscape(review.securityStatus || "")}</li>
          <li><strong>After HG-05:</strong> ${stEscape(review.afterHg05Note || "")}</li>
        </ul>
      </div>
      <div class="row-actions" style="margin-top:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px">
        ${stButton({ label: "Sync prerequisite status", action: "wave9-executive-sync-prereqs", variant: "secondary", ariaLabel: "Sync HG-01 to HG-04 status from local run sheets" })}
        ${stButton({ label: "Save memo draft", action: "wave9-executive-memo-save", variant: "secondary", ariaLabel: "Save executive memo draft without approving" })}
        ${stButton({ label: "Export for sign-off", action: "wave9-executive-export", variant: "secondary", ariaLabel: "Export executive run sheet JSON for sign-off" })}
        ${stButton({ label: "Reset local recorder", action: "wave9-executive-reset", variant: "ghost", ariaLabel: "Reset local executive run sheet" })}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table" aria-label="HG-01 to HG-04 dependency status">
          <thead>
            <tr>
              <th>Gate</th><th>Topic</th><th>Status</th><th>Note</th>
            </tr>
          </thead>
          <tbody>${prereqRows}</tbody>
        </table>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Executive memo fields">
        <h3>Memo template (draft — does not approve)</h3>
        <div class="form-grid" style="margin-top:8px">
          ${stField({ label: "Pilot name", name: "wave9ExecMemoPilotName", placeholder: "NORTHRISE MICRO SAVINGS", value: sponsor.pilotName || "" })}
          ${stField({ label: "Review date", name: "wave9ExecMemoReviewDate", placeholder: "YYYY-MM-DD", value: sponsor.reviewDate || "" })}
          ${stField({ label: "RC1 summary", name: "wave9ExecMemoRc1", placeholder: "RC1 PASS / exceptions", value: sponsor.rc1Summary || "" })}
          ${stField({ label: "Recommendation", name: "wave9ExecMemoRecommendation", placeholder: "Full Go / Conditional Go / No-Go", value: sponsor.recommendation || "" })}
          ${stField({ label: "Risks or waivers", name: "wave9ExecMemoRisks", placeholder: "Named risks, owners, dates", value: sponsor.risksOrWaivers || "" })}
          ${stField({ label: "Wave 10 entry intent", name: "wave9ExecMemoWave10", placeholder: "Planning only — cutover still blocked", value: sponsor.wave10EntryIntent || "" })}
          ${stField({ label: "Training status note", name: "wave9ExecTrainingNote", placeholder: "HG-02 status", value: memo.trainingStatusNote || "" })}
          ${stField({ label: "Recon status note", name: "wave9ExecReconNote", placeholder: "HG-03 status", value: memo.reconStatusNote || "" })}
          ${stField({ label: "Security status note", name: "wave9ExecSecurityNote", placeholder: "HG-04 status", value: memo.securityStatusNote || "" })}
        </div>
      </div>
      <div class="panel" style="margin-top:16px" aria-label="Record executive decision">
        <h3>Record executive decision (explicit)</h3>
        ${stMuted(`Requires typed executive name + exact phrase: ${EXECUTIVE_HUMAN_CONFIRM_PHRASE}. Full Go with open HG-01..04 is blocked unless Accept open conditions is checked and conditions are listed. Never sets wave10CutoverAuthorized or CERT-001.`)}
        <div class="form-grid" style="margin-top:8px">
          <div class="field">
            <label for="wave9ExecDecision">Decision</label>
            <select id="wave9ExecDecision" name="wave9ExecDecision" aria-label="Executive decision">
              <option value="">—</option>
              <option value="${EXECUTIVE_DECISION.FULL_GO}" ${memo.decision === EXECUTIVE_DECISION.FULL_GO ? "selected" : ""}>Full Go</option>
              <option value="${EXECUTIVE_DECISION.CONDITIONAL_GO}" ${memo.decision === EXECUTIVE_DECISION.CONDITIONAL_GO ? "selected" : ""}>Conditional Go</option>
              <option value="${EXECUTIVE_DECISION.NO_GO}" ${memo.decision === EXECUTIVE_DECISION.NO_GO ? "selected" : ""}>No-Go</option>
            </select>
          </div>
          ${stField({ label: "Executive full name", name: "wave9ExecSignerName", placeholder: "Type real name" })}
          ${stField({ label: "Confirmation phrase", name: "wave9ExecConfirmPhrase", placeholder: EXECUTIVE_HUMAN_CONFIRM_PHRASE })}
          <div class="field full">
            <label for="wave9ExecOpenConditions">Open conditions (one per line; required for Conditional Go and Full Go with open prereqs)</label>
            <textarea id="wave9ExecOpenConditions" name="wave9ExecOpenConditions" rows="4" placeholder="e.g. HG-01 UAT still deferred&#10;HG-02 training completion pending">${stEscape(openConditionsText)}</textarea>
          </div>
          <div class="field full">
            <label>
              <input type="checkbox" id="wave9ExecAcceptOpenConditions" name="wave9ExecAcceptOpenConditions" ${memo.acceptOpenConditions ? "checked" : ""} />
              Accept open conditions (required for Full Go while HG-01..04 pending)
            </label>
          </div>
          ${stField({ label: "Decision rationale / No-Go reason", name: "wave9ExecRationale", placeholder: "Required for No-Go", value: memo.decisionRationale || "" })}
          ${stField({ label: "Notes (optional)", name: "wave9ExecGateNotes", placeholder: "Memo / evidence packet ref" })}
        </div>
        <div class="row-actions" style="margin-top:10px">
          ${stButton({
            label: "Record executive decision",
            action: "wave9-executive-gate-approve",
            variant: "primary",
            ariaLabel: "Record explicit HA-EXEC decision with typed name"
          })}
        </div>
      </div>
    `
  });
}

export function renderWave9Readiness(opsRows = [], envRows = []) {
  const opsBody = opsRows.length
    ? stTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "category", label: "Category" },
        { key: "status", label: "Status" },
        { key: "rdyRef", label: "RDY" }
      ],
      rows: opsRows.map((r) => ({
        id: r.id,
        category: r.category || "",
        status: r.status || "",
        rdyRef: r.rdyRef || ""
      }))
    })
    : stMuted("Ops readiness rows appear after validate:pilot.");

  const envBody = envRows.length
    ? stTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "category", label: "Category" },
        { key: "isolation", label: "Isolated" },
        { key: "status", label: "Status" }
      ],
      rows: envRows.map((r) => ({
        id: r.id,
        category: r.category || "",
        isolation: r.isolationFromProd ? "yes" : "no",
        status: r.status || ""
      }))
    })
    : stMuted("Pilot environment checklist appears after validate:pilot.");

  return `
    ${stLazyPanel({ id: "wave9-ops", title: "Operational readiness", body: opsBody })}
    ${stLazyPanel({ id: "wave9-env", title: "Pilot environment checklist", body: envBody })}
  `;
}

export function renderWave9Feedback(feedback = [], issues = []) {
  const fb = feedback.length
    ? `<ul>${feedback.map((f) => `<li><strong>${stEscape(f.severity || "")}</strong> ${stEscape(f.title || f.id || "")} (${stEscape(f.status || "")})</li>`).join("")}</ul>`
    : stMuted("No feedback items.");
  const iss = issues.length
    ? `<ul>${issues.map((i) => `<li><strong>${stEscape(i.severity || "")}</strong> ${stEscape(i.title || i.id || "")} (${stEscape(i.status || "")})</li>`).join("")}</ul>`
    : stMuted("No open issues in register.");
  return `
    ${stLazyPanel({ id: "wave9-feedback", title: "Feedback register", body: fb })}
    ${stLazyPanel({ id: "wave9-issues", title: "Issue register", body: iss })}
  `;
}

export function renderWave9GoNoGoSummary(evidence = null) {
  const g = evidence?.goNoGo || {};
  const approvals = g.humanApprovals || [];
  return stPanel({
    title: "Go / No-Go summary",
    body: `
      ${stMuted("Evidence: docs/release-evidence/wave9-pilot-evidence.json · artifacts/wave9/")}
      ${evidence
        ? stStatGrid([
          { label: "Decision", value: String(g.decision || "—") },
          { label: "Wave 10", value: String(g.readyForWave10 || "—") },
          { label: "Live cutover", value: evidence.claim?.liveBranchCutover ? "yes" : "no" },
          { label: "Ops score", value: `${evidence.operationalReadiness?.scores?.score ?? "—"}%` }
        ])
        : stMuted("Run validate:pilot to publish evidence.")}
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

export function renderWave9ParityChecklist(rows = []) {
  if (!rows.length) return "";
  return stLazyPanel({
    id: "wave9-parity",
    title: "Wave 9 pilot parity checklist",
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

export function renderWave9ReportsExtra(model = {}) {
  return renderWave9GoNoGoSummary(model.evidence || null);
}
