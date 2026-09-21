/**
 * Wave 9 — Human UAT recording helpers (pilot / NORTHRISE MICRO SAVINGS).
 * Records Pass/Fail + notes locally; never auto-flips HA-PO / HA-QA to Approved.
 * Scenario business sign-off and gate approvals require a typed human name + confirmation.
 */

import {
  UAT_SCENARIOS,
  HUMAN_SIGNOFF_STATUS,
  WAVE9_MONEY_DEFAULTS,
  scoreUatPack
} from "./wave9-pilot-uat-ops.js";
import {
  canActorSeeUserAccount,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor
} from "./system-accounts.js";

export const UAT_RUN_SHEET_SCHEMA = "wave9-uat-run-sheet/1.0";
export const UAT_RUN_SHEET_STORAGE_KEY = "wave9_uat_run_sheet_v1";
export const UAT_HUMAN_CONFIRM_PHRASE = "I CONFIRM HUMAN APPROVAL";

export const UAT_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  PENDING_SIGNOFF: "PendingHumanSignOff",
  IN_PROGRESS: "InProgress",
  BLOCKED: "Blocked"
});

const GATE_IDS = Object.freeze(["HA-PO", "HA-QA"]);

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function normalizePassFail(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "pass" || v === "fail" || v === "blocked") return v;
  return null;
}

function emptyGate(id, role) {
  return Object.freeze({
    id,
    role,
    status: HUMAN_SIGNOFF_STATUS.PENDING,
    approverName: null,
    approvedAt: null,
    notes: null
  });
}

/**
 * Build a machine-readable run sheet for human pilot UAT.
 * Starts ReadyToExecute / PendingHumanSignOff — never Approved.
 */
export function createUatRunSheet({
  scenarios = UAT_SCENARIOS,
  pilotName = "NORTHRISE MICRO SAVINGS",
  createdAt = nowIso()
} = {}) {
  const rows = scenarios.map((s) => ({
    scenarioId: s.id,
    domain: s.domain,
    title: s.title,
    mandatory: s.mandatory !== false,
    technicalSmoke: Boolean(s.technicalSmoke),
    preconditions: [...(s.preconditions || [])],
    steps: [...(s.steps || [])],
    expected: [...(s.expected || [])],
    actual: null,
    passFail: null,
    evidence: null,
    executedBy: null,
    executedAt: null,
    notes: null,
    approver: null,
    approverStatus: HUMAN_SIGNOFF_STATUS.PENDING,
    approvedAt: null,
    status: s.technicalSmoke && s.wave8Proven
      ? "TechnicalPassPendingBusinessSignOff"
      : UAT_RUN_SHEET_STATUS.READY,
    executable: true
  }));

  const scores = scoreUatPack(rows);
  return {
    schemaVersion: UAT_RUN_SHEET_SCHEMA,
    wave: "WAVE-09",
    pilotName,
    product: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    status: UAT_RUN_SHEET_STATUS.READY,
    createdAt,
    updatedAt: createdAt,
    claim: {
      livePilotExecuted: false,
      gatesAutoApproved: false,
      note: "Run sheet ready for human execution — no fabricated signatures"
    },
    moneyInvariants: { ...WAVE9_MONEY_DEFAULTS },
    loginGuidance: {
      primaryOperator: "JOHN",
      role: "System Owner / business UAT",
      developerSupportOnly: "KBA",
      isolation: "JOHN must not see or manage the KBA developer account"
    },
    guidePath: "docs/uat/wave9-uat-execution-guide.md",
    evidencePath: "docs/release-evidence/wave9-uat-run-sheet.json",
    humanGates: {
      "HA-PO": emptyGate("HA-PO", "Product / Business Owner"),
      "HA-QA": emptyGate("HA-QA", "QA Lead")
    },
    scores: {
      mandatoryTotal: scores.mandatoryTotal,
      executableCount: scores.executableCount,
      businessSignedCount: scores.businessSignedCount,
      recordedPassFailCount: 0,
      businessAcceptanceComplete: false
    },
    scenarios: rows
  };
}

export function refreshRunSheetScores(runSheet) {
  if (!runSheet || !Array.isArray(runSheet.scenarios)) return runSheet;
  const scored = scoreUatPack(runSheet.scenarios);
  const recordedPassFailCount = runSheet.scenarios.filter((r) => r.passFail).length;
  runSheet.scores = {
    mandatoryTotal: scored.mandatoryTotal,
    executableCount: scored.executableCount,
    businessSignedCount: scored.businessSignedCount,
    recordedPassFailCount,
    businessAcceptanceComplete: scored.businessAcceptanceComplete
  };
  const anyRecorded = recordedPassFailCount > 0;
  const allPending =
    GATE_IDS.every((id) => runSheet.humanGates?.[id]?.status === HUMAN_SIGNOFF_STATUS.PENDING);
  if (runSheet.status !== UAT_RUN_SHEET_STATUS.BLOCKED) {
    runSheet.status = anyRecorded
      ? allPending
        ? UAT_RUN_SHEET_STATUS.PENDING_SIGNOFF
        : UAT_RUN_SHEET_STATUS.IN_PROGRESS
      : UAT_RUN_SHEET_STATUS.READY;
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Record Pass/Fail / notes for a scenario.
 * Does NOT set approverStatus to Approved and does NOT flip HA-PO / HA-QA.
 */
export function recordScenarioExecution(runSheet, scenarioId, fields = {}) {
  if (!runSheet?.scenarios) {
    return { ok: false, error: "run_sheet_missing" };
  }
  const row = runSheet.scenarios.find((s) => s.scenarioId === scenarioId);
  if (!row) return { ok: false, error: "scenario_not_found" };

  const passFail = normalizePassFail(fields.passFail);
  if (!passFail) return { ok: false, error: "pass_fail_required" };

  row.passFail = passFail;
  row.actual = fields.actual != null ? String(fields.actual) : row.actual;
  row.evidence = fields.evidence != null ? String(fields.evidence) : row.evidence;
  row.notes = fields.notes != null ? String(fields.notes) : row.notes;
  row.executedBy = String(fields.executedBy || "").trim() || row.executedBy || null;
  row.executedAt = fields.executedAt || nowIso();
  if (row.status === UAT_RUN_SHEET_STATUS.READY || !row.status) {
    row.status = "ExecutedPendingBusinessSignOff";
  }
  // Keep scenario approver pending unless a separate sign-off call is made
  if (row.approverStatus !== HUMAN_SIGNOFF_STATUS.APPROVED) {
    row.approverStatus = HUMAN_SIGNOFF_STATUS.PENDING;
  }
  // Hard rule: recording execution never touches human gates
  ensureGatesNotAutoApproved(runSheet);
  refreshRunSheetScores(runSheet);
  return { ok: true, scenario: row, runSheet };
}

/**
 * Approve a single scenario's business sign-off — requires typed name + confirm phrase.
 * Still does NOT flip HA-PO / HA-QA gate status.
 */
export function recordScenarioBusinessSignOff(runSheet, scenarioId, {
  approverName = "",
  confirmPhrase = "",
  approvedAt = null,
  notes = null
} = {}) {
  if (!runSheet?.scenarios) {
    return { ok: false, error: "run_sheet_missing" };
  }
  const name = String(approverName || "").trim();
  if (!name) return { ok: false, error: "approver_name_required" };
  if (String(confirmPhrase || "").trim() !== UAT_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }
  const row = runSheet.scenarios.find((s) => s.scenarioId === scenarioId);
  if (!row) return { ok: false, error: "scenario_not_found" };
  if (!row.passFail) return { ok: false, error: "pass_fail_required_before_signoff" };

  row.approver = name;
  row.approverStatus = HUMAN_SIGNOFF_STATUS.APPROVED;
  row.approvedAt = approvedAt || nowIso();
  if (notes != null) row.notes = String(notes);
  row.status = "BusinessSigned";

  ensureGatesNotAutoApproved(runSheet);
  refreshRunSheetScores(runSheet);
  return { ok: true, scenario: row, runSheet };
}

/**
 * Explicit human gate approval path (HA-PO / HA-QA only).
 * Requires typed name + exact confirmation phrase. Never auto-called from Pass/Fail.
 */
export function recordHumanGateApproval(runSheet, gateId, {
  approverName = "",
  confirmPhrase = "",
  approvedAt = null,
  notes = null
} = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  if (!GATE_IDS.includes(gateId)) return { ok: false, error: "gate_not_allowed" };

  const name = String(approverName || "").trim();
  if (!name) return { ok: false, error: "approver_name_required" };
  if (String(confirmPhrase || "").trim() !== UAT_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }

  if (!runSheet.humanGates) runSheet.humanGates = {};
  const existing = runSheet.humanGates[gateId] || emptyGate(gateId, gateId);
  runSheet.humanGates[gateId] = {
    ...existing,
    id: gateId,
    status: HUMAN_SIGNOFF_STATUS.APPROVED,
    approverName: name,
    approvedAt: approvedAt || `${todayDate()}T00:00:00.000Z`,
    notes: notes != null ? String(notes) : existing.notes
  };
  runSheet.claim = {
    ...(runSheet.claim || {}),
    livePilotExecuted: Boolean(runSheet.claim?.livePilotExecuted),
    gatesAutoApproved: false,
    note: "Gate Approved only via explicit human name + confirmation"
  };
  refreshRunSheetScores(runSheet);
  return { ok: true, gate: runSheet.humanGates[gateId], runSheet };
}

/** Ensure HA-PO / HA-QA stay Pending unless already explicitly Approved with a name. */
export function ensureGatesNotAutoApproved(runSheet) {
  if (!runSheet?.humanGates) return runSheet;
  for (const id of GATE_IDS) {
    const g = runSheet.humanGates[id];
    if (!g) continue;
    if (g.status === HUMAN_SIGNOFF_STATUS.APPROVED && !String(g.approverName || "").trim()) {
      g.status = HUMAN_SIGNOFF_STATUS.PENDING;
      g.approverName = null;
      g.approvedAt = null;
    }
  }
  if (runSheet.claim) runSheet.claim.gatesAutoApproved = false;
  return runSheet;
}

export function exportRunSheetForSignOff(runSheet) {
  const copy = JSON.parse(JSON.stringify(runSheet || {}));
  ensureGatesNotAutoApproved(copy);
  refreshRunSheetScores(copy);
  copy.exportedAt = nowIso();
  copy.exportPurpose = "human_signoff_packet";
  copy.instructions = [
    "Attach screenshots / receipts as evidence paths or notes",
    "Use Record human approval only after typed name + confirmation phrase",
    "Do not mark production reconciled or CERT-001 from this export"
  ];
  return copy;
}

export function serializeRunSheet(runSheet) {
  return JSON.stringify(exportRunSheetForSignOff(runSheet), null, 2);
}

export function loadRunSheetFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(UAT_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureGatesNotAutoApproved(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveRunSheetToStorage(runSheet, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, error: "storage_unavailable" };
  }
  ensureGatesNotAutoApproved(runSheet);
  refreshRunSheetScores(runSheet);
  try {
    storage.setItem(UAT_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function getOrCreateRunSheet(storage = globalThis.localStorage) {
  const existing = loadRunSheetFromStorage(storage);
  if (existing?.scenarios?.length) return existing;
  const sheet = createUatRunSheet();
  saveRunSheetToStorage(sheet, storage);
  return sheet;
}

/**
 * JOHN isolation: owner operator must not see KBA developer account in UAT pickers.
 */
export function listUatVisibleUsers(users, actor) {
  return listUsersForActor(users || [], actor);
}

export function assertJohnCannotSeeKba(users, johnActor) {
  if (!isSystemOwnerUser(johnActor)) {
    return { ok: false, error: "actor_not_john_owner" };
  }
  const visible = listUatVisibleUsers(users, johnActor);
  const leaked = visible.filter((u) => isSystemDeveloperAccount(u));
  return {
    ok: leaked.length === 0,
    visibleCount: visible.length,
    leakedUsernames: leaked.map((u) => u.username)
  };
}

export function canUatActorSeeAccount(actor, target) {
  return canActorSeeUserAccount(actor, target);
}

export function mergeRunSheetIntoScenarioRows(evidenceScenarios = [], runSheet = null) {
  const byId = new Map((runSheet?.scenarios || []).map((s) => [s.scenarioId, s]));
  return (evidenceScenarios || []).map((row) => {
    const local = byId.get(row.scenarioId || row.id);
    if (!local) return row;
    return {
      ...row,
      passFail: local.passFail ?? row.passFail,
      notes: local.notes ?? row.notes,
      executedBy: local.executedBy ?? row.executedBy,
      executedAt: local.executedAt ?? row.executedAt,
      approver: local.approver ?? row.approver,
      approverStatus: local.approverStatus ?? row.approverStatus,
      status: local.status || row.status,
      actual: local.actual ?? row.actual,
      evidence: local.evidence ?? row.evidence
    };
  });
}
