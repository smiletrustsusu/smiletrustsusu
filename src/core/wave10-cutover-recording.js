/**
 * Wave 10 — Local CO-* cutover timestamp recorder (GAP-001 rehearsal support).
 * Records start/end timestamps locally for operators; never marks production Accepted,
 * never flips CERT-001, never sets liveProductionCutover / liveProductionAccepted.
 */

import {
  CUTOVER_STEPS,
  HUMAN_SIGNOFF_STATUS,
  scoreCutover
} from "./wave10-production-golive-ops.js";

export const CUTOVER_RUN_SHEET_SCHEMA = "wave10-cutover-run-sheet/1.0";
export const CUTOVER_RUN_SHEET_STORAGE_KEY = "wave10_cutover_run_sheet_v1";

/** Status used for local timestamp notes — not complete/done/Accepted. */
export const CUTOVER_STEP_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  TIMESTAMPED: "TimestampRecorded",
  BLOCKED: "Blocked"
});

export const CUTOVER_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  IN_PROGRESS: "InProgress",
  PENDING_HA: "BlockedUntilHaApprovals",
  REHEARSAL: "RehearsalTimestampsOnly",
  BLOCKED: "Blocked"
});

function nowIso() {
  return new Date().toISOString();
}

function stepDef(stepId) {
  return CUTOVER_STEPS.find((s) => s.id === stepId) || null;
}

function emptyStepRow(step) {
  return {
    id: step.id,
    title: step.title,
    ownerRole: step.ownerRole,
    status: CUTOVER_STEP_STATUS.READY,
    [step.timestampField]: null,
    startedAt: null,
    completedAt: null,
    ownerName: null,
    notes: null,
    outcome: null,
    rollbackCriteria: step.rollbackCriteria
  };
}

/**
 * Seed a local cutover run sheet. Always blocked from Accepted / live cutover claims.
 */
export function createCutoverRunSheet({
  startedAt = nowIso(),
  note = "Local CO-* timestamp rehearsal — not production Accepted"
} = {}) {
  return {
    schemaVersion: CUTOVER_RUN_SHEET_SCHEMA,
    wave: "WAVE-10",
    status: CUTOVER_RUN_SHEET_STATUS.PENDING_HA,
    startedAt,
    updatedAt: startedAt,
    note,
    claim: {
      liveProductionCutover: false,
      liveProductionAccepted: false,
      wave10Accepted: false,
      cert001Certified: false,
      timestampsAreRehearsalOnly: true
    },
    humanGatesNote:
      "CO-* execution remains blocked until real Wave 9 HA-* Approvals. Recording timestamps does not flip gates.",
    steps: CUTOVER_STEPS.map(emptyStepRow),
    history: []
  };
}

export function refreshCutoverRunSheetScores(runSheet) {
  if (!runSheet) return runSheet;
  const scored = scoreCutover(runSheet.steps || []);
  runSheet.scores = {
    total: scored.total,
    timestamped: (runSheet.steps || []).filter(
      (s) => s.status === CUTOVER_STEP_STATUS.TIMESTAMPED || s.startedAt || s.completedAt
    ).length,
    // Deliberately never claim liveCutoverExecuted from this recorder
    liveCutoverExecuted: false,
    scoreCutoverCompleted: scored.completed
  };
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.liveProductionCutover = false;
  runSheet.claim.liveProductionAccepted = false;
  runSheet.claim.wave10Accepted = false;
  runSheet.claim.cert001Certified = false;
  runSheet.claim.timestampsAreRehearsalOnly = true;
  const anyTs = runSheet.scores.timestamped > 0;
  if (runSheet.status !== CUTOVER_RUN_SHEET_STATUS.BLOCKED) {
    runSheet.status = anyTs
      ? CUTOVER_RUN_SHEET_STATUS.REHEARSAL
      : CUTOVER_RUN_SHEET_STATUS.PENDING_HA;
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Record local timestamps for a CO-* step. Never sets status to complete/done/Accepted.
 * CO-13: allows notes/timestamps but refuses Accepted / goLiveAcceptedAt that would certify.
 */
export function recordCutoverStepTimestamp(runSheet, stepId, fields = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  const def = stepDef(stepId);
  if (!def) return { ok: false, error: "unknown_step", stepId };

  const steps = Array.isArray(runSheet.steps) ? runSheet.steps : [];
  let row = steps.find((s) => s.id === stepId);
  if (!row) {
    row = emptyStepRow(def);
    steps.push(row);
    runSheet.steps = steps;
  }

  const ownerName = String(fields.ownerName || fields.owner || "").trim();
  const startedAt = fields.startedAt != null ? String(fields.startedAt) : row.startedAt || nowIso();
  const completedAt =
    fields.completedAt != null
      ? String(fields.completedAt)
      : fields.markComplete === false
        ? row.completedAt
        : nowIso();
  const notes = fields.notes != null ? String(fields.notes) : row.notes;
  const outcome = fields.outcome != null ? String(fields.outcome) : "recorded";

  // Hard refuse Accepted / live go-live language
  const outcomeLower = outcome.toLowerCase();
  if (
    outcomeLower === "accepted" ||
    outcomeLower === "complete" ||
    outcomeLower === "done" ||
    fields.markAccepted === true ||
    fields.goLiveAccepted === true
  ) {
    return {
      ok: false,
      error: "accepted_forbidden",
      message:
        "Cutover recorder refuses Accepted / complete / done. Use TimestampRecorded only until real HA-* Approvals and live cutover under docs/wave10-production-golive.md."
    };
  }

  row.ownerName = ownerName || row.ownerName;
  row.startedAt = startedAt;
  row.completedAt = completedAt;
  row.notes = notes;
  row.outcome = outcome;
  row.status = CUTOVER_STEP_STATUS.TIMESTAMPED;
  // Canonical Wave 10 timestamp field — recorded for rehearsal evidence only
  row[def.timestampField] = completedAt || startedAt;

  // CO-13: never set goLiveAcceptedAt in a way that implies Accepted decision
  if (stepId === "CO-13") {
    row.goLiveAcceptedAt = null;
    row.status = CUTOVER_STEP_STATUS.TIMESTAMPED;
    row.notes = [
      notes,
      "CO-13 go-live acceptance remains PendingHumanSignOff — timestamps are rehearsal only"
    ]
      .filter(Boolean)
      .join(" | ");
  }

  runSheet.history = runSheet.history || [];
  runSheet.history.push({
    at: nowIso(),
    stepId,
    ownerName: row.ownerName,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    outcome: row.outcome,
    humanSignOff: HUMAN_SIGNOFF_STATUS.PENDING
  });

  ensureCutoverNeverAccepted(runSheet);
  refreshCutoverRunSheetScores(runSheet);
  return { ok: true, step: row, runSheet };
}

export function ensureCutoverNeverAccepted(runSheet) {
  if (!runSheet) return runSheet;
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.liveProductionCutover = false;
  runSheet.claim.liveProductionAccepted = false;
  runSheet.claim.wave10Accepted = false;
  runSheet.claim.cert001Certified = false;
  runSheet.claim.timestampsAreRehearsalOnly = true;
  for (const step of runSheet.steps || []) {
    const s = String(step.status || "").toLowerCase();
    if (s === "accepted" || s === "complete" || s === "done") {
      step.status = CUTOVER_STEP_STATUS.TIMESTAMPED;
    }
    if (step.id === "CO-13") {
      step.goLiveAcceptedAt = null;
    }
  }
  return runSheet;
}

export function loadCutoverRunSheet(storage = globalThis.localStorage) {
  try {
    if (!storage?.getItem) return null;
    const raw = storage.getItem(CUTOVER_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureCutoverNeverAccepted(parsed);
    refreshCutoverRunSheetScores(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveCutoverRunSheet(runSheet, storage = globalThis.localStorage) {
  if (!runSheet || !storage?.setItem) return { ok: false, error: "storage_unavailable" };
  ensureCutoverNeverAccepted(runSheet);
  refreshCutoverRunSheetScores(runSheet);
  storage.setItem(CUTOVER_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
  return { ok: true, runSheet };
}

export function listCutoverStepsForUi(runSheet) {
  const sheet = runSheet || createCutoverRunSheet();
  return (sheet.steps || []).map((s) => ({
    id: s.id,
    title: s.title,
    ownerRole: s.ownerRole,
    status: s.status,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    ownerName: s.ownerName,
    rollbackCriteria: s.rollbackCriteria
  }));
}
