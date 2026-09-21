/**
 * Wave 9 — Human security acceptance recording helpers
 * (pilot / NORTHRISE MICRO SAVINGS / HG-04 / HA-SEC).
 * Records checklist Pass/Fail locally; never auto-flips HA-SEC to Approved.
 */

import {
  SECURITY_CHECKLIST,
  HUMAN_SIGNOFF_STATUS,
  WAVE9_MONEY_DEFAULTS
} from "./wave9-pilot-uat-ops.js";
import {
  canActorSeeUserAccount,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor
} from "./system-accounts.js";

export const SECURITY_RUN_SHEET_SCHEMA = "wave9-security-run-sheet/1.0";
export const SECURITY_RUN_SHEET_STORAGE_KEY = "wave9_security_run_sheet_v1";
export const SECURITY_HUMAN_CONFIRM_PHRASE = "I CONFIRM SECURITY ACCEPTANCE";

export const SECURITY_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  PENDING_SIGNOFF: "PendingHumanSignOff",
  IN_PROGRESS: "InProgress",
  BLOCKED: "Blocked"
});

const GATE_IDS = Object.freeze(["HA-SEC"]);

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
 * Build a machine-readable run sheet for human security acceptance (HG-04).
 * Starts ReadyToExecute / PendingHumanSignOff — never Approved.
 */
export function createSecurityRunSheet({
  checklist = SECURITY_CHECKLIST,
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
    evidence: null,
    findingNotes: null,
    executedBy: null,
    executedAt: null,
    signerName: null,
    notes: null,
    status: SECURITY_RUN_SHEET_STATUS.READY,
    executable: true
  }));

  return {
    schemaVersion: SECURITY_RUN_SHEET_SCHEMA,
    wave: "WAVE-09",
    humanGate: "HG-04",
    pilotName,
    product: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    status: SECURITY_RUN_SHEET_STATUS.READY,
    createdAt,
    updatedAt: createdAt,
    claim: {
      livePilotExecuted: false,
      securityAutoApproved: false,
      productionHardenedClaim: false,
      gatesAutoApproved: false,
      note: "Run sheet ready for human security acceptance - no fabricated findings or HA-SEC approval"
    },
    moneyInvariants: { ...WAVE9_MONEY_DEFAULTS },
    loginGuidance: {
      primaryOperator: "JOHN",
      role: "System Owner / security acceptance facilitator oversight",
      securitySigner: "Security Governance / Compliance (HA-SEC)",
      developerSupportOnly: "KBA",
      isolation: "JOHN must not see or manage the KBA developer account"
    },
    hardConstraints: {
      noProductionDeploy: true,
      noProdSupabaseMigrate: true,
      noProdConfigOrFinancialDataChange: true,
      preserveJohnKbaIsolation: true,
      superAdminForbidden: true,
      moneyInvariants: "15/31/1000 pesewas"
    },
    guidePath: "docs/security/wave9-security-acceptance-execution-guide.md",
    evidencePath: "docs/release-evidence/wave9-security-run-sheet.json",
    humanGates: {
      "HA-SEC": emptyGate("HA-SEC", "Security / Compliance (Security Acceptance)")
    },
    scores: {
      checklistTotal: rows.length,
      executableCount: rows.length,
      recordedPassFailCount: 0,
      passedCount: 0,
      failedOrBlockedCount: 0,
      securitySignOffPending: true,
      productionHardenedClaim: false
    },
    checklist: rows
  };
}

export function refreshSecurityRunSheetScores(runSheet) {
  if (!runSheet || !Array.isArray(runSheet.checklist)) return runSheet;
  const items = runSheet.checklist;
  const recordedPassFailCount = items.filter((i) => i.passFail).length;
  const passedCount = items.filter((i) => i.passFail === "pass").length;
  const failedOrBlockedCount = items.filter(
    (i) => i.passFail === "fail" || i.passFail === "blocked"
  ).length;
  const allRecorded = recordedPassFailCount === items.length && items.length > 0;
  const haSecPending =
    runSheet.humanGates?.["HA-SEC"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  const securitySignOffPending = haSecPending || !allRecorded;

  runSheet.scores = {
    checklistTotal: items.length,
    executableCount: items.filter((i) => i.executable !== false).length,
    recordedPassFailCount,
    passedCount,
    failedOrBlockedCount,
    securitySignOffPending,
    productionHardenedClaim: false
  };

  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.securityAutoApproved = false;
  runSheet.claim.productionHardenedClaim = false;
  runSheet.claim.gatesAutoApproved = false;

  const anyActivity = recordedPassFailCount > 0;
  if (runSheet.status !== SECURITY_RUN_SHEET_STATUS.BLOCKED) {
    runSheet.status = anyActivity
      ? securitySignOffPending
        ? SECURITY_RUN_SHEET_STATUS.PENDING_SIGNOFF
        : SECURITY_RUN_SHEET_STATUS.IN_PROGRESS
      : SECURITY_RUN_SHEET_STATUS.READY;
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Record Pass/Fail for a security checklist item.
 * Does NOT approve HA-SEC.
 */
export function recordSecurityChecklistItem(runSheet, itemId, fields = {}) {
  if (!runSheet?.checklist) return { ok: false, error: "run_sheet_missing" };
  const row = runSheet.checklist.find((i) => i.itemId === itemId);
  if (!row) return { ok: false, error: "item_not_found" };

  const passFail = normalizePassFail(fields.passFail);
  if (!passFail) return { ok: false, error: "pass_fail_required" };

  if (
    (passFail === "fail" || passFail === "blocked") &&
    !(String(fields.findingNotes || row.findingNotes || fields.notes || row.notes || "").trim())
  ) {
    return { ok: false, error: "finding_notes_required_on_fail" };
  }

  row.passFail = passFail;
  row.findingNotes =
    fields.findingNotes != null
      ? String(fields.findingNotes)
      : fields.notes != null
        ? String(fields.notes)
        : row.findingNotes;
  if (fields.notes != null) row.notes = String(fields.notes);
  row.evidence = fields.evidence != null ? String(fields.evidence) : row.evidence;
  row.executedBy =
    String(fields.executedBy || "").trim() || row.executedBy || null;
  row.executedAt = fields.executedAt || nowIso();
  row.signerName =
    String(fields.signerName || "").trim() || row.signerName || null;
  row.status =
    passFail === "pass"
      ? "RecordedPassPendingGateSignOff"
      : passFail === "fail"
        ? "RecordedFailPendingRemediation"
        : "BlockedPendingRemediation";

  ensureSecurityNeverAutoApproved(runSheet);
  refreshSecurityRunSheetScores(runSheet);
  return { ok: true, item: row, runSheet };
}

/**
 * Explicit HA-SEC sign-off — requires typed signer name + confirmation phrase.
 * Never auto-approves from Pass/Fail alone.
 */
export function recordSecurityGateSignOff(runSheet, gateId, {
  signerName = "",
  confirmPhrase = "",
  signedAt = null,
  notes = null
} = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  if (!GATE_IDS.includes(gateId)) return { ok: false, error: "gate_not_allowed" };

  const name = String(signerName || "").trim();
  if (!name) return { ok: false, error: "signer_name_required" };
  if (String(confirmPhrase || "").trim() !== SECURITY_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }

  refreshSecurityRunSheetScores(runSheet);
  const total = runSheet.scores?.checklistTotal || 0;
  const recorded = runSheet.scores?.recordedPassFailCount || 0;
  if (!total || recorded < total) {
    return { ok: false, error: "all_checklist_items_must_be_recorded_first" };
  }

  const failedOrBlocked = runSheet.scores?.failedOrBlockedCount || 0;
  if (failedOrBlocked > 0) {
    return { ok: false, error: "remediate_fail_or_blocked_items_first" };
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
    securityAutoApproved: false,
    productionHardenedClaim: false,
    gatesAutoApproved: false,
    note:
      `${gateId} Approved only via explicit human name + confirmation — pilot security acceptance ≠ production harden claim (never set by this helper)`
  };

  ensureSecurityNeverAutoApproved(runSheet);
  refreshSecurityRunSheetScores(runSheet);
  return { ok: true, gate: runSheet.humanGates[gateId], runSheet };
}

/**
 * Hard rule: HA-SEC never auto-approves; Approved without typed name reverts;
 * productionHardenedClaim never becomes true from recording helpers.
 */
export function ensureSecurityNeverAutoApproved(runSheet) {
  if (!runSheet) return runSheet;
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.securityAutoApproved = false;
  runSheet.claim.productionHardenedClaim = false;
  runSheet.claim.gatesAutoApproved = false;
  if (runSheet.scores) runSheet.scores.productionHardenedClaim = false;

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

export function exportSecurityRunSheetForSignOff(runSheet) {
  const copy = JSON.parse(JSON.stringify(runSheet || {}));
  ensureSecurityNeverAutoApproved(copy);
  refreshSecurityRunSheetScores(copy);
  copy.exportedAt = nowIso();
  copy.exportPurpose = "human_security_acceptance_signoff_packet";
  copy.instructions = [
    "Attach screenshots / audit log refs / RLS review notes as evidence paths",
    "Use Record HA-SEC sign-off only after typed signer name + confirmation phrase",
    "Do not claim production hardened from this export or local recorder alone",
    "Do not deploy production or apply production Supabase migrations from this gate",
    "Update docs/release-evidence/wave9-pilot-evidence.json humanApprovals HA-SEC with the same names/dates after humans sign",
    "Preserve JOHN/KBA isolation; SUPER_ADMIN_FORBIDDEN; money 15/31/1000"
  ];
  return copy;
}

export function serializeSecurityRunSheet(runSheet) {
  return JSON.stringify(exportSecurityRunSheetForSignOff(runSheet), null, 2);
}

export function loadSecurityRunSheetFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(SECURITY_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureSecurityNeverAutoApproved(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveSecurityRunSheetToStorage(runSheet, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, error: "storage_unavailable" };
  }
  ensureSecurityNeverAutoApproved(runSheet);
  refreshSecurityRunSheetScores(runSheet);
  try {
    storage.setItem(SECURITY_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function getOrCreateSecurityRunSheet(storage = globalThis.localStorage) {
  const existing = loadSecurityRunSheetFromStorage(storage);
  if (existing?.checklist?.length) return existing;
  const sheet = createSecurityRunSheet();
  saveSecurityRunSheetToStorage(sheet, storage);
  return sheet;
}

/** JOHN isolation: owner operator must not see KBA in security pickers. */
export function listSecurityVisibleUsers(users, actor) {
  return listUsersForActor(users || [], actor);
}

export function assertJohnCannotSeeKbaInSecurity(users, johnActor) {
  if (!isSystemOwnerUser(johnActor)) {
    return { ok: false, error: "actor_not_john_owner" };
  }
  const visible = listSecurityVisibleUsers(users, johnActor);
  const leaked = visible.filter((u) => isSystemDeveloperAccount(u));
  return {
    ok: leaked.length === 0,
    visibleCount: visible.length,
    leakedUsernames: leaked.map((u) => u.username)
  };
}

export function canSecurityActorSeeAccount(actor, target) {
  return canActorSeeUserAccount(actor, target);
}
