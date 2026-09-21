/**
 * Wave 9 — Human training recording helpers (pilot / NORTHRISE MICRO SAVINGS).
 * Records attendance + competency locally; never auto-clears training_completion_pending
 * and never flips track completion to Approved without typed name + confirmation phrase.
 */

import {
  TRAINING_TRACKS,
  HUMAN_SIGNOFF_STATUS,
  WAVE9_MONEY_DEFAULTS
} from "./wave9-pilot-uat-ops.js";
import {
  canActorSeeUserAccount,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor
} from "./system-accounts.js";

export const TRAINING_RUN_SHEET_SCHEMA = "wave9-training-run-sheet/1.0";
export const TRAINING_RUN_SHEET_STORAGE_KEY = "wave9_training_run_sheet_v1";
export const TRAINING_HUMAN_CONFIRM_PHRASE = "I CONFIRM TRAINING COMPLETION";

export const TRAINING_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  PENDING_SIGNOFF: "PendingHumanSignOff",
  IN_PROGRESS: "InProgress",
  BLOCKED: "Blocked"
});

const GATE_IDS = Object.freeze(["HG-02"]);

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function normalizeCompetency(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "pass" || v === "fail" || v === "blocked") return v;
  if (v === "true" || v === "yes" || v === "y") return "pass";
  if (v === "false" || v === "no" || v === "n") return "fail";
  return null;
}

function emptyGate(id, role) {
  return Object.freeze({
    id,
    role,
    status: HUMAN_SIGNOFF_STATUS.PENDING,
    completerName: null,
    completedAt: null,
    notes: null
  });
}

function emptyAttendanceRow() {
  return {
    participantName: null,
    role: null,
    attendedAt: null,
    facilitator: null,
    notes: null
  };
}

/**
 * Build a machine-readable run sheet for human pilot training (HG-02).
 * Starts ReadyToExecute / PendingHumanSignOff — never Complete/Approved.
 */
export function createTrainingRunSheet({
  tracks = TRAINING_TRACKS,
  pilotName = "NORTHRISE MICRO SAVINGS",
  createdAt = nowIso()
} = {}) {
  const rows = tracks.map((t) => ({
    trackId: t.id,
    role: t.role,
    durationHours: t.durationHours,
    modules: [...(t.modules || [])],
    exercises: [...(t.exercises || [])],
    competencyChecklist: [...(t.competencyChecklist || [])],
    attendance: [],
    competencyPassed: null,
    competencyNotes: null,
    competencyRecordedBy: null,
    competencyRecordedAt: null,
    completionStatus: HUMAN_SIGNOFF_STATUS.PENDING,
    completedAt: null,
    completedBy: null,
    notes: null,
    status: TRAINING_RUN_SHEET_STATUS.READY,
    executable: true
  }));

  return {
    schemaVersion: TRAINING_RUN_SHEET_SCHEMA,
    wave: "WAVE-09",
    humanGate: "HG-02",
    pilotName,
    product: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    status: TRAINING_RUN_SHEET_STATUS.READY,
    createdAt,
    updatedAt: createdAt,
    claim: {
      livePilotExecuted: false,
      trainingAutoCompleted: false,
      trainingCompletionPending: true,
      gatesAutoApproved: false,
      note: "Run sheet ready for human training - no fabricated attendance or completions"
    },
    moneyInvariants: { ...WAVE9_MONEY_DEFAULTS },
    loginGuidance: {
      primaryOperator: "JOHN",
      role: "System Owner / training facilitator oversight",
      developerSupportOnly: "KBA",
      isolation: "JOHN must not see or manage the KBA developer account"
    },
    guidePath: "docs/training/wave9-training-execution-guide.md",
    evidencePath: "docs/release-evidence/wave9-training-run-sheet.json",
    curriculumPath: "docs/wave9-training-package.md",
    humanGates: {
      "HG-02": emptyGate("HG-02", "Training Completion (Wave 9)")
    },
    scores: {
      trackTotal: rows.length,
      executableCount: rows.length,
      attendanceRecordedCount: 0,
      competencyRecordedCount: 0,
      completedCount: 0,
      trainingCompletionPending: true,
      trainingCompletionComplete: false
    },
    tracks: rows
  };
}

export function isTrackFullyCompleted(track) {
  if (!track) return false;
  return (
    track.completionStatus === HUMAN_SIGNOFF_STATUS.APPROVED &&
    Boolean(String(track.completedBy || "").trim()) &&
    Boolean(track.completedAt)
  );
}

export function refreshTrainingRunSheetScores(runSheet) {
  if (!runSheet || !Array.isArray(runSheet.tracks)) return runSheet;
  const tracks = runSheet.tracks;
  const attendanceRecordedCount = tracks.filter((t) => (t.attendance || []).length > 0).length;
  const competencyRecordedCount = tracks.filter((t) => t.competencyPassed).length;
  const completedCount = tracks.filter((t) => isTrackFullyCompleted(t)).length;
  const trainingCompletionPending = completedCount < tracks.length;
  runSheet.scores = {
    trackTotal: tracks.length,
    executableCount: tracks.filter((t) => t.executable !== false).length,
    attendanceRecordedCount,
    competencyRecordedCount,
    completedCount,
    trainingCompletionPending,
    trainingCompletionComplete: !trainingCompletionPending && tracks.length > 0
  };
  if (!runSheet.claim) runSheet.claim = {};
  // Hard rule: never clear pending unless all tracks completed with typed names
  runSheet.claim.trainingCompletionPending = trainingCompletionPending;
  runSheet.claim.trainingAutoCompleted = false;
  runSheet.claim.gatesAutoApproved = false;

  const anyActivity = attendanceRecordedCount + competencyRecordedCount + completedCount > 0;
  const gatePending =
    runSheet.humanGates?.["HG-02"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  if (runSheet.status !== TRAINING_RUN_SHEET_STATUS.BLOCKED) {
    runSheet.status = anyActivity
      ? gatePending || trainingCompletionPending
        ? TRAINING_RUN_SHEET_STATUS.PENDING_SIGNOFF
        : TRAINING_RUN_SHEET_STATUS.IN_PROGRESS
      : TRAINING_RUN_SHEET_STATUS.READY;
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Record attendance for a track. Does NOT complete the track and does NOT
 * clear training_completion_pending.
 */
export function recordTrackAttendance(runSheet, trackId, fields = {}) {
  if (!runSheet?.tracks) return { ok: false, error: "run_sheet_missing" };
  const row = runSheet.tracks.find((t) => t.trackId === trackId);
  if (!row) return { ok: false, error: "track_not_found" };

  const participantName = String(fields.participantName || "").trim();
  if (!participantName) return { ok: false, error: "participant_name_required" };

  const entry = {
    ...emptyAttendanceRow(),
    participantName,
    role: String(fields.role || row.role || "").trim() || null,
    attendedAt: fields.attendedAt || nowIso(),
    facilitator: String(fields.facilitator || "").trim() || null,
    notes: fields.notes != null ? String(fields.notes) : null
  };
  if (!Array.isArray(row.attendance)) row.attendance = [];
  row.attendance.push(entry);
  if (fields.notes != null) row.notes = String(fields.notes);
  if (row.status === TRAINING_RUN_SHEET_STATUS.READY || !row.status) {
    row.status = "AttendanceInProgress";
  }
  // Keep completion pending — attendance alone never completes
  if (!isTrackFullyCompleted(row)) {
    row.completionStatus = HUMAN_SIGNOFF_STATUS.PENDING;
    row.completedAt = null;
    row.completedBy = null;
  }
  ensureTrainingCompletionNotAutoCleared(runSheet);
  refreshTrainingRunSheetScores(runSheet);
  return { ok: true, track: row, attendance: entry, runSheet };
}

/**
 * Record competency pass/fail for a track.
 * Does NOT set completionStatus to Approved and does NOT clear training_completion_pending.
 */
export function recordTrackCompetency(runSheet, trackId, fields = {}) {
  if (!runSheet?.tracks) return { ok: false, error: "run_sheet_missing" };
  const row = runSheet.tracks.find((t) => t.trackId === trackId);
  if (!row) return { ok: false, error: "track_not_found" };

  const competencyPassed = normalizeCompetency(fields.competencyPassed);
  if (!competencyPassed) return { ok: false, error: "competency_result_required" };

  row.competencyPassed = competencyPassed;
  row.competencyNotes =
    fields.competencyNotes != null ? String(fields.competencyNotes) : row.competencyNotes;
  row.competencyRecordedBy =
    String(fields.recordedBy || "").trim() || row.competencyRecordedBy || null;
  row.competencyRecordedAt = fields.recordedAt || nowIso();
  if (fields.notes != null) row.notes = String(fields.notes);
  if (row.status === TRAINING_RUN_SHEET_STATUS.READY || row.status === "AttendanceInProgress") {
    row.status = "CompetencyRecordedPendingCompletion";
  }
  // Hard rule: competency never auto-completes the track
  if (!isTrackFullyCompleted(row)) {
    row.completionStatus = HUMAN_SIGNOFF_STATUS.PENDING;
    row.completedAt = null;
    row.completedBy = null;
  }
  ensureTrainingCompletionNotAutoCleared(runSheet);
  refreshTrainingRunSheetScores(runSheet);
  return { ok: true, track: row, runSheet };
}

/**
 * Explicit track completion — requires typed completer name + confirmation phrase.
 * Only this path may set completionStatus Approved and contribute to clearing
 * training_completion_pending (when all tracks are so completed).
 */
export function recordTrackCompletion(runSheet, trackId, {
  completedBy = "",
  confirmPhrase = "",
  completedAt = null,
  notes = null
} = {}) {
  if (!runSheet?.tracks) return { ok: false, error: "run_sheet_missing" };
  const name = String(completedBy || "").trim();
  if (!name) return { ok: false, error: "completer_name_required" };
  if (String(confirmPhrase || "").trim() !== TRAINING_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }
  const row = runSheet.tracks.find((t) => t.trackId === trackId);
  if (!row) return { ok: false, error: "track_not_found" };
  if (!row.competencyPassed) {
    return { ok: false, error: "competency_required_before_completion" };
  }
  if (row.competencyPassed !== "pass") {
    return { ok: false, error: "competency_must_pass_before_completion" };
  }
  if (!(row.attendance || []).length) {
    return { ok: false, error: "attendance_required_before_completion" };
  }

  row.completedBy = name;
  row.completedAt = completedAt || nowIso();
  row.completionStatus = HUMAN_SIGNOFF_STATUS.APPROVED;
  row.status = "TrainingComplete";
  if (notes != null) row.notes = String(notes);

  ensureTrainingCompletionNotAutoCleared(runSheet);
  refreshTrainingRunSheetScores(runSheet);
  return { ok: true, track: row, runSheet };
}

/**
 * Explicit HG-02 gate completion — requires typed name + phrase.
 * Still requires all tracks completed; never auto-called from attendance/competency.
 */
export function recordTrainingGateCompletion(runSheet, gateId, {
  completerName = "",
  confirmPhrase = "",
  completedAt = null,
  notes = null
} = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  if (!GATE_IDS.includes(gateId)) return { ok: false, error: "gate_not_allowed" };

  const name = String(completerName || "").trim();
  if (!name) return { ok: false, error: "completer_name_required" };
  if (String(confirmPhrase || "").trim() !== TRAINING_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }

  refreshTrainingRunSheetScores(runSheet);
  if (runSheet.scores?.trainingCompletionPending) {
    return { ok: false, error: "all_tracks_must_be_completed_first" };
  }

  if (!runSheet.humanGates) runSheet.humanGates = {};
  const existing = runSheet.humanGates[gateId] || emptyGate(gateId, gateId);
  runSheet.humanGates[gateId] = {
    ...existing,
    id: gateId,
    status: HUMAN_SIGNOFF_STATUS.APPROVED,
    completerName: name,
    completedAt: completedAt || `${todayDate()}T00:00:00.000Z`,
    notes: notes != null ? String(notes) : existing.notes
  };
  runSheet.claim = {
    ...(runSheet.claim || {}),
    livePilotExecuted: Boolean(runSheet.claim?.livePilotExecuted),
    trainingAutoCompleted: false,
    trainingCompletionPending: false,
    gatesAutoApproved: false,
    note: "HG-02 Approved only via explicit human name + confirmation after all tracks complete"
  };
  refreshTrainingRunSheetScores(runSheet);
  return { ok: true, gate: runSheet.humanGates[gateId], runSheet };
}

/**
 * Ensure no track/gate is Approved without a typed name, and
 * training_completion_pending is never cleared without full named completions.
 */
export function ensureTrainingCompletionNotAutoCleared(runSheet) {
  if (!runSheet) return runSheet;
  for (const track of runSheet.tracks || []) {
    if (
      track.completionStatus === HUMAN_SIGNOFF_STATUS.APPROVED &&
      !String(track.completedBy || "").trim()
    ) {
      track.completionStatus = HUMAN_SIGNOFF_STATUS.PENDING;
      track.completedBy = null;
      track.completedAt = null;
      if (track.status === "TrainingComplete") {
        track.status = "CompetencyRecordedPendingCompletion";
      }
    }
  }
  if (runSheet.humanGates) {
    for (const id of GATE_IDS) {
      const g = runSheet.humanGates[id];
      if (!g) continue;
      if (g.status === HUMAN_SIGNOFF_STATUS.APPROVED && !String(g.completerName || "").trim()) {
        g.status = HUMAN_SIGNOFF_STATUS.PENDING;
        g.completerName = null;
        g.completedAt = null;
      }
    }
  }
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.trainingAutoCompleted = false;
  runSheet.claim.gatesAutoApproved = false;
  const allDone = (runSheet.tracks || []).every((t) => isTrackFullyCompleted(t));
  runSheet.claim.trainingCompletionPending = !allDone;
  return runSheet;
}

export function exportTrainingRunSheetForSignOff(runSheet) {
  const copy = JSON.parse(JSON.stringify(runSheet || {}));
  ensureTrainingCompletionNotAutoCleared(copy);
  refreshTrainingRunSheetScores(copy);
  copy.exportedAt = nowIso();
  copy.exportPurpose = "human_training_signoff_packet";
  copy.instructions = [
    "Attach attendance sheets / competency checklists as evidence paths or notes",
    "Use Record track completion only after typed completer name + confirmation phrase",
    "Do not clear training_completion_pending or mark CERT-001 from this export alone",
    "Update docs/release-evidence/wave9-pilot-evidence.json trainingResults with the same names/dates after humans sign"
  ];
  return copy;
}

export function serializeTrainingRunSheet(runSheet) {
  return JSON.stringify(exportTrainingRunSheetForSignOff(runSheet), null, 2);
}

export function loadTrainingRunSheetFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(TRAINING_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureTrainingCompletionNotAutoCleared(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveTrainingRunSheetToStorage(runSheet, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, error: "storage_unavailable" };
  }
  ensureTrainingCompletionNotAutoCleared(runSheet);
  refreshTrainingRunSheetScores(runSheet);
  try {
    storage.setItem(TRAINING_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function getOrCreateTrainingRunSheet(storage = globalThis.localStorage) {
  const existing = loadTrainingRunSheetFromStorage(storage);
  if (existing?.tracks?.length) return existing;
  const sheet = createTrainingRunSheet();
  saveTrainingRunSheetToStorage(sheet, storage);
  return sheet;
}

/** JOHN isolation: owner operator must not see KBA in training pickers. */
export function listTrainingVisibleUsers(users, actor) {
  return listUsersForActor(users || [], actor);
}

export function assertJohnCannotSeeKbaInTraining(users, johnActor) {
  if (!isSystemOwnerUser(johnActor)) {
    return { ok: false, error: "actor_not_john_owner" };
  }
  const visible = listTrainingVisibleUsers(users, johnActor);
  const leaked = visible.filter((u) => isSystemDeveloperAccount(u));
  return {
    ok: leaked.length === 0,
    visibleCount: visible.length,
    leakedUsernames: leaked.map((u) => u.username)
  };
}

export function canTrainingActorSeeAccount(actor, target) {
  return canActorSeeUserAccount(actor, target);
}
