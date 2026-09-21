/**
 * Wave 9 — Human financial reconciliation recording helpers
 * (pilot / NORTHRISE MICRO SAVINGS / HG-03).
 * Records checklist Pass/Fail + variance notes locally; never auto-flips
 * HA-RECON / HA-FIN to Approved and NEVER sets claim.productionReconciled true.
 */

import {
  RECON_CHECKLIST,
  HUMAN_SIGNOFF_STATUS,
  WAVE9_MONEY_DEFAULTS
} from "./wave9-pilot-uat-ops.js";
import {
  canActorSeeUserAccount,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor
} from "./system-accounts.js";
import { fromPesewas, formatGhs, PESEWAS_PER_GHS } from "./money.js";

export const RECON_RUN_SHEET_SCHEMA = "wave9-recon-run-sheet/1.0";
export const RECON_RUN_SHEET_STORAGE_KEY = "wave9_recon_run_sheet_v1";
export const RECON_HUMAN_CONFIRM_PHRASE = "I CONFIRM FINANCIAL RECONCILIATION";

export const RECON_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  PENDING_SIGNOFF: "PendingHumanSignOff",
  IN_PROGRESS: "InProgress",
  BLOCKED: "Blocked"
});

const GATE_IDS = Object.freeze(["HA-RECON", "HA-FIN"]);

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function normalizePassFail(value) {
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
    signerName: null,
    signedAt: null,
    notes: null
  });
}

/**
 * Format a variance for worksheets: pesewas SoT + GHS display.
 * Does not invent totals — callers supply measured integers.
 */
export function formatReconVarianceDisplay(variancePesewas) {
  const n = Number(variancePesewas);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: "variance_must_be_integer_pesewas" };
  }
  return {
    ok: true,
    variancePesewas: n,
    varianceGhs: fromPesewas(n),
    displayPesewas: `${n} pesewas`,
    displayGhs: formatGhs(n, { fromPesewas: true }),
    note: `1 GHS = ${PESEWAS_PER_GHS} pesewas; compare in pesewas first`
  };
}

/**
 * Build a machine-readable run sheet for human financial recon (HG-03).
 * Starts ReadyToExecute / PendingHumanSignOff — never Approved;
 * claim.productionReconciled is always false from this builder.
 */
export function createReconRunSheet({
  checklist = RECON_CHECKLIST,
  pilotName = "NORTHRISE MICRO SAVINGS",
  createdAt = nowIso()
} = {}) {
  const rows = checklist.map((c) => ({
    itemId: c.id,
    category: c.category,
    title: c.title,
    steps: [...(c.steps || [])],
    expected: [...(c.expected || [])],
    passFail: null,
    variancePesewas: null,
    varianceNotes: null,
    systemTotalPesewas: null,
    physicalTotalPesewas: null,
    evidence: null,
    executedBy: null,
    executedAt: null,
    signerName: null,
    notes: null,
    status: RECON_RUN_SHEET_STATUS.READY,
    executable: true
  }));

  return {
    schemaVersion: RECON_RUN_SHEET_SCHEMA,
    wave: "WAVE-09",
    humanGate: "HG-03",
    pilotName,
    product: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    status: RECON_RUN_SHEET_STATUS.READY,
    createdAt,
    updatedAt: createdAt,
    claim: {
      livePilotExecuted: false,
      productionReconciled: false,
      reconAutoApproved: false,
      gatesAutoApproved: false,
      note: "Run sheet ready for human financial recon - no fabricated totals or production reconciled claim"
    },
    moneyInvariants: { ...WAVE9_MONEY_DEFAULTS },
    loginGuidance: {
      primaryOperator: "JOHN",
      role: "System Owner / recon facilitator oversight",
      financeSigner: "Finance / Branch Manager (HA-RECON / HA-FIN)",
      developerSupportOnly: "KBA",
      isolation: "JOHN must not see or manage the KBA developer account"
    },
    guidePath: "docs/reconciliation/wave9-financial-recon-execution-guide.md",
    evidencePath: "docs/release-evidence/wave9-recon-run-sheet.json",
    humanGates: {
      "HA-RECON": emptyGate("HA-RECON", "Finance / Branch Manager (Reconciliation)"),
      "HA-FIN": emptyGate("HA-FIN", "Finance acceptance (Wave 9/10)")
    },
    scores: {
      checklistTotal: rows.length,
      executableCount: rows.length,
      recordedPassFailCount: 0,
      varianceNotedCount: 0,
      passedCount: 0,
      failedOrBlockedCount: 0,
      reconSignOffPending: true,
      productionReconciled: false
    },
    checklist: rows
  };
}

export function refreshReconRunSheetScores(runSheet) {
  if (!runSheet || !Array.isArray(runSheet.checklist)) return runSheet;
  const items = runSheet.checklist;
  const recordedPassFailCount = items.filter((i) => i.passFail).length;
  const varianceNotedCount = items.filter(
    (i) => i.varianceNotes != null && String(i.varianceNotes).trim() !== ""
  ).length;
  const passedCount = items.filter((i) => i.passFail === "pass").length;
  const failedOrBlockedCount = items.filter(
    (i) => i.passFail === "fail" || i.passFail === "blocked"
  ).length;
  const allRecorded = recordedPassFailCount === items.length && items.length > 0;
  const haReconPending =
    runSheet.humanGates?.["HA-RECON"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  const haFinPending =
    runSheet.humanGates?.["HA-FIN"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  const reconSignOffPending = haReconPending || haFinPending || !allRecorded;

  runSheet.scores = {
    checklistTotal: items.length,
    executableCount: items.filter((i) => i.executable !== false).length,
    recordedPassFailCount,
    varianceNotedCount,
    passedCount,
    failedOrBlockedCount,
    reconSignOffPending,
    productionReconciled: false
  };

  if (!runSheet.claim) runSheet.claim = {};
  // Hard rule: automation never claims production reconciled
  runSheet.claim.productionReconciled = false;
  runSheet.claim.reconAutoApproved = false;
  runSheet.claim.gatesAutoApproved = false;

  const anyActivity = recordedPassFailCount > 0;
  if (runSheet.status !== RECON_RUN_SHEET_STATUS.BLOCKED) {
    runSheet.status = anyActivity
      ? reconSignOffPending
        ? RECON_RUN_SHEET_STATUS.PENDING_SIGNOFF
        : RECON_RUN_SHEET_STATUS.IN_PROGRESS
      : RECON_RUN_SHEET_STATUS.READY;
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Record Pass/Fail + optional variance for a checklist item.
 * Does NOT approve HA-RECON / HA-FIN and does NOT set productionReconciled.
 */
export function recordReconChecklistItem(runSheet, itemId, fields = {}) {
  if (!runSheet?.checklist) return { ok: false, error: "run_sheet_missing" };
  const row = runSheet.checklist.find((i) => i.itemId === itemId);
  if (!row) return { ok: false, error: "item_not_found" };

  const passFail = normalizePassFail(fields.passFail);
  if (!passFail) return { ok: false, error: "pass_fail_required" };

  if (fields.variancePesewas != null && fields.variancePesewas !== "") {
    const n = Number(fields.variancePesewas);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: "variance_must_be_integer_pesewas" };
    }
    row.variancePesewas = n;
  }

  if (fields.systemTotalPesewas != null && fields.systemTotalPesewas !== "") {
    const n = Number(fields.systemTotalPesewas);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: "system_total_must_be_integer_pesewas" };
    }
    row.systemTotalPesewas = n;
  }

  if (fields.physicalTotalPesewas != null && fields.physicalTotalPesewas !== "") {
    const n = Number(fields.physicalTotalPesewas);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: "physical_total_must_be_integer_pesewas" };
    }
    row.physicalTotalPesewas = n;
  }

  if (
    (passFail === "fail" || passFail === "blocked") &&
    !(String(fields.varianceNotes || row.varianceNotes || "").trim())
  ) {
    return { ok: false, error: "variance_notes_required_on_fail" };
  }

  row.passFail = passFail;
  row.varianceNotes =
    fields.varianceNotes != null ? String(fields.varianceNotes) : row.varianceNotes;
  row.evidence = fields.evidence != null ? String(fields.evidence) : row.evidence;
  row.executedBy =
    String(fields.executedBy || "").trim() || row.executedBy || null;
  row.executedAt = fields.executedAt || nowIso();
  row.signerName =
    String(fields.signerName || "").trim() || row.signerName || null;
  if (fields.notes != null) row.notes = String(fields.notes);
  row.status =
    passFail === "pass"
      ? "RecordedPassPendingGateSignOff"
      : passFail === "fail"
        ? "RecordedFailPendingRemediation"
        : "BlockedPendingRemediation";

  ensureProductionReconciledNeverAutoClaimed(runSheet);
  refreshReconRunSheetScores(runSheet);
  return { ok: true, item: row, runSheet };
}

/**
 * Explicit HA-RECON / HA-FIN sign-off — requires typed signer name + confirmation phrase.
 * Never sets claim.productionReconciled true (pilot/procedure sign-off ≠ production claim).
 */
export function recordReconGateSignOff(runSheet, gateId, {
  signerName = "",
  confirmPhrase = "",
  signedAt = null,
  notes = null
} = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  if (!GATE_IDS.includes(gateId)) return { ok: false, error: "gate_not_allowed" };

  const name = String(signerName || "").trim();
  if (!name) return { ok: false, error: "signer_name_required" };
  if (String(confirmPhrase || "").trim() !== RECON_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }

  refreshReconRunSheetScores(runSheet);
  const total = runSheet.scores?.checklistTotal || 0;
  const recorded = runSheet.scores?.recordedPassFailCount || 0;
  if (!total || recorded < total) {
    return { ok: false, error: "all_checklist_items_must_be_recorded_first" };
  }

  if (!runSheet.humanGates) runSheet.humanGates = {};
  const existing = runSheet.humanGates[gateId] || emptyGate(gateId, gateId);
  runSheet.humanGates[gateId] = {
    ...existing,
    id: gateId,
    status: HUMAN_SIGNOFF_STATUS.APPROVED,
    signerName: name,
    signedAt: signedAt || `${todayDate()}T00:00:00.000Z`,
    notes: notes != null ? String(notes) : existing.notes
  };

  runSheet.claim = {
    ...(runSheet.claim || {}),
    livePilotExecuted: Boolean(runSheet.claim?.livePilotExecuted),
    productionReconciled: false,
    reconAutoApproved: false,
    gatesAutoApproved: false,
    note:
      `${gateId} Approved only via explicit human name + confirmation — productionReconciled remains false until separate production evidence (never set by this helper)`
  };

  ensureProductionReconciledNeverAutoClaimed(runSheet);
  refreshReconRunSheetScores(runSheet);
  return { ok: true, gate: runSheet.humanGates[gateId], runSheet };
}

/**
 * Hard rule: productionReconciled never becomes true from recording helpers,
 * and Approved gates without typed signer names are reverted.
 */
export function ensureProductionReconciledNeverAutoClaimed(runSheet) {
  if (!runSheet) return runSheet;
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.productionReconciled = false;
  runSheet.claim.reconAutoApproved = false;
  runSheet.claim.gatesAutoApproved = false;
  if (runSheet.scores) runSheet.scores.productionReconciled = false;

  if (runSheet.humanGates) {
    for (const id of GATE_IDS) {
      const g = runSheet.humanGates[id];
      if (!g) continue;
      if (g.status === HUMAN_SIGNOFF_STATUS.APPROVED && !String(g.signerName || "").trim()) {
        g.status = HUMAN_SIGNOFF_STATUS.PENDING;
        g.signerName = null;
        g.signedAt = null;
      }
    }
  }
  return runSheet;
}

export function exportReconRunSheetForSignOff(runSheet) {
  const copy = JSON.parse(JSON.stringify(runSheet || {}));
  ensureProductionReconciledNeverAutoClaimed(copy);
  refreshReconRunSheetScores(copy);
  copy.exportedAt = nowIso();
  copy.exportPurpose = "human_financial_recon_signoff_packet";
  copy.instructions = [
    "Attach cashbook / collection / vault / EOD worksheets as evidence paths or notes",
    "Use Record HA-RECON / HA-FIN sign-off only after typed signer name + confirmation phrase",
    "Do not set claim.productionReconciled true from this export or local recorder alone",
    "Update docs/release-evidence/wave9-pilot-evidence.json humanApprovals HA-RECON with the same names/dates after humans sign",
    "Money: compare in integer pesewas; display GHS as pesewas/100; interest 15; days 31; cashier 1000"
  ];
  return copy;
}

export function serializeReconRunSheet(runSheet) {
  return JSON.stringify(exportReconRunSheetForSignOff(runSheet), null, 2);
}

export function loadReconRunSheetFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(RECON_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureProductionReconciledNeverAutoClaimed(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveReconRunSheetToStorage(runSheet, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, error: "storage_unavailable" };
  }
  ensureProductionReconciledNeverAutoClaimed(runSheet);
  refreshReconRunSheetScores(runSheet);
  try {
    storage.setItem(RECON_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function getOrCreateReconRunSheet(storage = globalThis.localStorage) {
  const existing = loadReconRunSheetFromStorage(storage);
  if (existing?.checklist?.length) return existing;
  const sheet = createReconRunSheet();
  saveReconRunSheetToStorage(sheet, storage);
  return sheet;
}

/** JOHN isolation: owner operator must not see KBA in recon pickers. */
export function listReconVisibleUsers(users, actor) {
  return listUsersForActor(users || [], actor);
}

export function assertJohnCannotSeeKbaInRecon(users, johnActor) {
  if (!isSystemOwnerUser(johnActor)) {
    return { ok: false, error: "actor_not_john_owner" };
  }
  const visible = listReconVisibleUsers(users, johnActor);
  const leaked = visible.filter((u) => isSystemDeveloperAccount(u));
  return {
    ok: leaked.length === 0,
    visibleCount: visible.length,
    leakedUsernames: leaked.map((u) => u.username)
  };
}

export function canReconActorSeeAccount(actor, target) {
  return canActorSeeUserAccount(actor, target);
}
