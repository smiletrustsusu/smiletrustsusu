/**
 * Wave 9 — Human Executive Sponsor decision recording helpers
 * (pilot / NORTHRISE MICRO SAVINGS / HG-05 / HA-EXEC / HA-W9-EXEC).
 * Records Full Go / Conditional Go / No-Go locally; never auto-approves.
 * Full Go with open HG-01..04 requires explicit accept-open-conditions + typed name.
 */

import {
  HUMAN_SIGNOFF_STATUS,
  WAVE9_MONEY_DEFAULTS
} from "./wave9-pilot-uat-ops.js";
import {
  canActorSeeUserAccount,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor
} from "./system-accounts.js";
import { UAT_RUN_SHEET_STORAGE_KEY } from "./wave9-uat-recording.js";
import { TRAINING_RUN_SHEET_STORAGE_KEY } from "./wave9-training-recording.js";
import { RECON_RUN_SHEET_STORAGE_KEY } from "./wave9-recon-recording.js";
import { SECURITY_RUN_SHEET_STORAGE_KEY } from "./wave9-security-recording.js";

export const EXECUTIVE_RUN_SHEET_SCHEMA = "wave9-executive-run-sheet/1.0";
export const EXECUTIVE_RUN_SHEET_STORAGE_KEY = "wave9_executive_run_sheet_v1";
export const EXECUTIVE_HUMAN_CONFIRM_PHRASE = "I CONFIRM EXECUTIVE SPONSOR DECISION";

export const EXECUTIVE_RUN_SHEET_STATUS = Object.freeze({
  READY: "ReadyToExecute",
  PENDING_SIGNOFF: "PendingHumanSignOff",
  IN_PROGRESS: "InProgress",
  DECIDED: "DecisionRecorded",
  BLOCKED: "Blocked"
});

export const EXECUTIVE_DECISION = Object.freeze({
  FULL_GO: "FullGo",
  CONDITIONAL_GO: "ConditionalGo",
  NO_GO: "NoGo"
});

const GATE_IDS = Object.freeze(["HA-EXEC", "HA-W9-EXEC"]);

const PREREQUISITE_GATES = Object.freeze([
  {
    id: "HG-01",
    label: "Business UAT",
    humanApprovals: ["HA-PO", "HA-QA"],
    defaultNote: "Deferred by request — remains PendingHumanSignOff until humans resume"
  },
  {
    id: "HG-02",
    label: "Training Completion",
    humanApprovals: ["HG-02"],
    defaultNote: "Prepared — PendingHumanSignOff until training evidence complete"
  },
  {
    id: "HG-03",
    label: "Financial Reconciliation",
    humanApprovals: ["HA-RECON", "HA-FIN"],
    defaultNote: "Prepared — PendingHumanSignOff until recon evidence complete"
  },
  {
    id: "HG-04",
    label: "Security Acceptance",
    humanApprovals: ["HA-SEC"],
    defaultNote: "Prepared — PendingHumanSignOff until HA-SEC signed"
  }
]);

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function emptyGate(id, role) {
  return Object.freeze({
    id,
    role,
    status: HUMAN_SIGNOFF_STATUS.PENDING,
    signerName: null,
    signedAt: null,
    decision: null,
    notes: null
  });
}

function normalizeDecision(value) {
  const v = String(value || "").trim();
  if (
    v === EXECUTIVE_DECISION.FULL_GO ||
    v === EXECUTIVE_DECISION.CONDITIONAL_GO ||
    v === EXECUTIVE_DECISION.NO_GO
  ) {
    return v;
  }
  const lower = v.toLowerCase().replace(/[\s_-]+/g, "");
  if (lower === "fullgo" || lower === "go") return EXECUTIVE_DECISION.FULL_GO;
  if (lower === "conditionalgo" || lower === "conditional") {
    return EXECUTIVE_DECISION.CONDITIONAL_GO;
  }
  if (lower === "nogo" || lower === "nogodecision") return EXECUTIVE_DECISION.NO_GO;
  return null;
}

function normalizeConditionsList(value) {
  if (Array.isArray(value)) {
    return value.map((c) => String(c || "").trim()).filter(Boolean);
  }
  if (value == null) return [];
  return String(value)
    .split(/\r?\n|;/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function defaultPrerequisites() {
  return PREREQUISITE_GATES.map((g) => ({
    id: g.id,
    label: g.label,
    status: HUMAN_SIGNOFF_STATUS.PENDING,
    note: g.defaultNote,
    source: "default_pending"
  }));
}

function gateStatusFromSheet(sheet, approvalIds) {
  if (!sheet?.humanGates) return HUMAN_SIGNOFF_STATUS.PENDING;
  const statuses = approvalIds.map(
    (id) => sheet.humanGates[id]?.status || HUMAN_SIGNOFF_STATUS.PENDING
  );
  if (statuses.every((s) => s === HUMAN_SIGNOFF_STATUS.APPROVED)) {
    return HUMAN_SIGNOFF_STATUS.APPROVED;
  }
  return HUMAN_SIGNOFF_STATUS.PENDING;
}

function readJsonStorage(storage, key) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Build a machine-readable run sheet for Executive Sponsor HG-05.
 * Starts ReadyToExecute / PendingHumanSignOff — never Approved / Full Go.
 */
export function createExecutiveRunSheet({
  pilotName = "NORTHRISE MICRO SAVINGS",
  createdAt = nowIso()
} = {}) {
  return {
    schemaVersion: EXECUTIVE_RUN_SHEET_SCHEMA,
    wave: "WAVE-09",
    humanGate: "HG-05",
    pilotName,
    product: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    status: EXECUTIVE_RUN_SHEET_STATUS.READY,
    createdAt,
    updatedAt: createdAt,
    claim: {
      livePilotExecuted: false,
      executiveAutoApproved: false,
      fullGoClaimed: false,
      wave10CutoverAuthorized: false,
      cert001Certified: false,
      gatesAutoApproved: false,
      note: "Run sheet ready for human Executive Sponsor review - no fabricated Full Go / HA-EXEC approval"
    },
    moneyInvariants: { ...WAVE9_MONEY_DEFAULTS },
    loginGuidance: {
      primaryOperator: "JOHN",
      role: "System Owner / executive briefing facilitator",
      executiveSigner: "Executive Sponsor (HA-EXEC / HA-W9-EXEC)",
      developerSupportOnly: "KBA",
      isolation: "JOHN must not see or manage the KBA developer account"
    },
    hardConstraints: {
      noProductionDeploy: true,
      noProdSupabaseMigrate: true,
      noProdConfigOrFinancialDataChange: true,
      preserveJohnKbaIsolation: true,
      superAdminForbidden: true,
      moneyInvariants: "15/31/1000 pesewas",
      noFakeApprovals: true,
      wave10BlockedUntilRealApprovals: true
    },
    guidePath: "docs/governance/wave9-executive-sponsor-execution-guide.md",
    evidencePath: "docs/release-evidence/wave9-executive-run-sheet.json",
    reviewPack: {
      rc1Status: "PASS (framework entry) — confirm against docs/release-evidence/rc1-evidence.json",
      conditionalGoMeaning:
        "Wave 9 framework Conditional / Ready for Executive Review — not a live branch cutover",
      deferredUat:
        "HG-01 Business UAT deferred by request; remains PendingHumanSignOff (do not fake HA-PO / HA-QA)",
      trainingStatus: "HG-02 prepared; PendingHumanSignOff until humans complete training evidence",
      reconStatus: "HG-03 prepared; PendingHumanSignOff until humans complete recon evidence",
      securityStatus: "HG-04 prepared; PendingHumanSignOff until humans complete HA-SEC",
      goNoGoReportPath: "docs/wave9-go-nogo-report.md",
      afterHg05Note:
        "After HG-05 human path is prepared and (later) signed, Wave 10 cutover remains blocked until HA-* approvals are real — never mark Wave 10 Accepted / CERT-001 certified from this pack alone"
    },
    prerequisites: defaultPrerequisites(),
    memo: {
      decision: null,
      decisionRationale: null,
      openConditions: [],
      acceptOpenConditions: false,
      rc1Acknowledged: null,
      deferredUatAcknowledged: null,
      trainingStatusNote: null,
      reconStatusNote: null,
      securityStatusNote: null,
      sponsorMemoFields: {
        pilotName: null,
        reviewDate: null,
        rc1Summary: null,
        conditionsList: null,
        recommendation: null,
        risksOrWaivers: null,
        wave10EntryIntent: null
      }
    },
    humanGates: {
      "HA-EXEC": emptyGate("HA-EXEC", "Executive Sponsor"),
      "HA-W9-EXEC": emptyGate(
        "HA-W9-EXEC",
        "Wave 9 Executive Sponsor (carry-forward)"
      )
    },
    scores: {
      prerequisiteTotal: PREREQUISITE_GATES.length,
      prerequisitesPendingCount: PREREQUISITE_GATES.length,
      prerequisitesApprovedCount: 0,
      executiveSignOffPending: true,
      fullGoEligibleWithoutConditions: false,
      decisionRecorded: false,
      wave10CutoverAuthorized: false
    }
  };
}

export function listOpenPrerequisiteIds(runSheet) {
  const rows = runSheet?.prerequisites || [];
  return rows
    .filter((p) => p.status !== HUMAN_SIGNOFF_STATUS.APPROVED)
    .map((p) => p.id);
}

export function refreshExecutiveRunSheetScores(runSheet) {
  if (!runSheet) return runSheet;
  const prereqs = Array.isArray(runSheet.prerequisites)
    ? runSheet.prerequisites
    : defaultPrerequisites();
  runSheet.prerequisites = prereqs;
  const pending = prereqs.filter(
    (p) => p.status !== HUMAN_SIGNOFF_STATUS.APPROVED
  ).length;
  const approved = prereqs.length - pending;
  const haExecPending =
    runSheet.humanGates?.["HA-EXEC"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  const haW9Pending =
    runSheet.humanGates?.["HA-W9-EXEC"]?.status === HUMAN_SIGNOFF_STATUS.PENDING;
  const decision = runSheet.memo?.decision || null;
  const decisionRecorded = Boolean(decision) && !haExecPending && !haW9Pending;

  runSheet.scores = {
    prerequisiteTotal: prereqs.length,
    prerequisitesPendingCount: pending,
    prerequisitesApprovedCount: approved,
    executiveSignOffPending: haExecPending || haW9Pending,
    fullGoEligibleWithoutConditions: pending === 0,
    decisionRecorded,
    wave10CutoverAuthorized: false
  };

  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.executiveAutoApproved = false;
  runSheet.claim.wave10CutoverAuthorized = false;
  runSheet.claim.cert001Certified = false;
  runSheet.claim.gatesAutoApproved = false;
  if (decision !== EXECUTIVE_DECISION.FULL_GO) {
    runSheet.claim.fullGoClaimed = false;
  }

  if (runSheet.status !== EXECUTIVE_RUN_SHEET_STATUS.BLOCKED) {
    if (decisionRecorded) {
      runSheet.status = EXECUTIVE_RUN_SHEET_STATUS.DECIDED;
    } else if (decision || runSheet.memo?.decisionRationale) {
      runSheet.status = EXECUTIVE_RUN_SHEET_STATUS.PENDING_SIGNOFF;
    } else {
      runSheet.status = EXECUTIVE_RUN_SHEET_STATUS.READY;
    }
  }
  runSheet.updatedAt = nowIso();
  return runSheet;
}

/**
 * Optionally sync HG-01..04 status from local browser run sheets (never fabricates Approved).
 */
export function syncExecutivePrerequisitesFromStorage(
  runSheet,
  storage = globalThis.localStorage
) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  const uat = readJsonStorage(storage, UAT_RUN_SHEET_STORAGE_KEY);
  const training = readJsonStorage(storage, TRAINING_RUN_SHEET_STORAGE_KEY);
  const recon = readJsonStorage(storage, RECON_RUN_SHEET_STORAGE_KEY);
  const security = readJsonStorage(storage, SECURITY_RUN_SHEET_STORAGE_KEY);

  const next = [
    {
      id: "HG-01",
      label: "Business UAT",
      status: gateStatusFromSheet(uat, ["HA-PO", "HA-QA"]),
      note:
        gateStatusFromSheet(uat, ["HA-PO", "HA-QA"]) === HUMAN_SIGNOFF_STATUS.APPROVED
          ? "Local UAT run sheet shows HA-PO/HA-QA Approved"
          : "Deferred / PendingHumanSignOff — local UAT sheet not fully signed",
      source: uat ? "local_uat_run_sheet" : "default_pending"
    },
    {
      id: "HG-02",
      label: "Training Completion",
      status: gateStatusFromSheet(training, ["HG-02"]),
      note:
        gateStatusFromSheet(training, ["HG-02"]) === HUMAN_SIGNOFF_STATUS.APPROVED
          ? "Local training run sheet shows HG-02 Approved"
          : "Prepared / PendingHumanSignOff — local training sheet not complete",
      source: training ? "local_training_run_sheet" : "default_pending"
    },
    {
      id: "HG-03",
      label: "Financial Reconciliation",
      status: gateStatusFromSheet(recon, ["HA-RECON", "HA-FIN"]),
      note:
        gateStatusFromSheet(recon, ["HA-RECON", "HA-FIN"]) ===
        HUMAN_SIGNOFF_STATUS.APPROVED
          ? "Local recon run sheet shows HA-RECON/HA-FIN Approved"
          : "Prepared / PendingHumanSignOff — local recon sheet not signed",
      source: recon ? "local_recon_run_sheet" : "default_pending"
    },
    {
      id: "HG-04",
      label: "Security Acceptance",
      status: gateStatusFromSheet(security, ["HA-SEC"]),
      note:
        gateStatusFromSheet(security, ["HA-SEC"]) === HUMAN_SIGNOFF_STATUS.APPROVED
          ? "Local security run sheet shows HA-SEC Approved"
          : "Prepared / PendingHumanSignOff — local security sheet not signed",
      source: security ? "local_security_run_sheet" : "default_pending"
    }
  ];

  runSheet.prerequisites = next;
  ensureExecutiveNeverAutoApproved(runSheet);
  refreshExecutiveRunSheetScores(runSheet);
  return { ok: true, prerequisites: next, runSheet };
}

/**
 * Save memo / briefing fields without approving HA-EXEC.
 */
export function recordExecutiveMemoDraft(runSheet, fields = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };
  if (!runSheet.memo) runSheet.memo = {};
  if (!runSheet.memo.sponsorMemoFields) runSheet.memo.sponsorMemoFields = {};

  if (fields.decisionRationale != null) {
    runSheet.memo.decisionRationale = String(fields.decisionRationale);
  }
  if (fields.openConditions != null) {
    runSheet.memo.openConditions = normalizeConditionsList(fields.openConditions);
  }
  if (fields.rc1Acknowledged != null) {
    runSheet.memo.rc1Acknowledged = Boolean(fields.rc1Acknowledged);
  }
  if (fields.deferredUatAcknowledged != null) {
    runSheet.memo.deferredUatAcknowledged = Boolean(fields.deferredUatAcknowledged);
  }
  if (fields.trainingStatusNote != null) {
    runSheet.memo.trainingStatusNote = String(fields.trainingStatusNote);
  }
  if (fields.reconStatusNote != null) {
    runSheet.memo.reconStatusNote = String(fields.reconStatusNote);
  }
  if (fields.securityStatusNote != null) {
    runSheet.memo.securityStatusNote = String(fields.securityStatusNote);
  }

  const memoFields = fields.sponsorMemoFields || fields;
  const keys = [
    "pilotName",
    "reviewDate",
    "rc1Summary",
    "conditionsList",
    "recommendation",
    "risksOrWaivers",
    "wave10EntryIntent"
  ];
  for (const key of keys) {
    if (memoFields[key] != null) {
      runSheet.memo.sponsorMemoFields[key] = String(memoFields[key]);
    }
  }

  ensureExecutiveNeverAutoApproved(runSheet);
  refreshExecutiveRunSheetScores(runSheet);
  return { ok: true, memo: runSheet.memo, runSheet };
}

/**
 * Explicit Executive Sponsor decision — requires typed name + confirmation phrase.
 * Never auto-approves. Full Go with open HG-01..04 requires acceptOpenConditions + list.
 */
export function recordExecutiveSponsorDecision(runSheet, {
  decision = "",
  signerName = "",
  confirmPhrase = "",
  openConditions = null,
  acceptOpenConditions = false,
  decisionRationale = null,
  signedAt = null,
  notes = null,
  gateIds = GATE_IDS
} = {}) {
  if (!runSheet) return { ok: false, error: "run_sheet_missing" };

  const name = String(signerName || "").trim();
  if (!name) return { ok: false, error: "signer_name_required" };
  if (String(confirmPhrase || "").trim() !== EXECUTIVE_HUMAN_CONFIRM_PHRASE) {
    return { ok: false, error: "confirm_phrase_required" };
  }

  const normalized = normalizeDecision(decision);
  if (!normalized) return { ok: false, error: "decision_required" };

  refreshExecutiveRunSheetScores(runSheet);
  const openPrereqs = listOpenPrerequisiteIds(runSheet);
  const conditions = normalizeConditionsList(
    openConditions != null ? openConditions : runSheet.memo?.openConditions
  );
  const acceptOpen = Boolean(acceptOpenConditions);

  if (normalized === EXECUTIVE_DECISION.FULL_GO && openPrereqs.length > 0) {
    if (!acceptOpen) {
      return {
        ok: false,
        error: "full_go_blocked_open_prerequisites",
        openPrerequisites: openPrereqs
      };
    }
    if (!conditions.length) {
      return {
        ok: false,
        error: "open_conditions_required_for_full_go_with_pending_gates",
        openPrerequisites: openPrereqs
      };
    }
  }

  if (normalized === EXECUTIVE_DECISION.CONDITIONAL_GO && !conditions.length) {
    return { ok: false, error: "open_conditions_required_for_conditional_go" };
  }

  if (
    normalized === EXECUTIVE_DECISION.NO_GO &&
    !String(decisionRationale || notes || runSheet.memo?.decisionRationale || "").trim()
  ) {
    return { ok: false, error: "rationale_required_for_no_go" };
  }

  if (!runSheet.memo) runSheet.memo = {};
  runSheet.memo.decision = normalized;
  runSheet.memo.openConditions = conditions;
  runSheet.memo.acceptOpenConditions =
    normalized === EXECUTIVE_DECISION.FULL_GO && openPrereqs.length > 0
      ? true
      : acceptOpen && conditions.length > 0;
  if (decisionRationale != null) {
    runSheet.memo.decisionRationale = String(decisionRationale);
  } else if (notes != null && !runSheet.memo.decisionRationale) {
    runSheet.memo.decisionRationale = String(notes);
  }

  if (!runSheet.humanGates) runSheet.humanGates = {};
  const ids = Array.isArray(gateIds) && gateIds.length ? gateIds : GATE_IDS;
  for (const gateId of ids) {
    if (!GATE_IDS.includes(gateId)) {
      return { ok: false, error: "gate_not_allowed" };
    }
    const existing = runSheet.humanGates[gateId] || emptyGate(gateId, gateId);
    runSheet.humanGates[gateId] = {
      ...existing,
      id: gateId,
      status:
        normalized === EXECUTIVE_DECISION.NO_GO
          ? "NoGoRecorded"
          : HUMAN_SIGNOFF_STATUS.APPROVED,
      signerName: name,
      signedAt: signedAt || `${todayDate()}T00:00:00.000Z`,
      decision: normalized,
      notes:
        notes != null
          ? String(notes)
          : [
              `decision=${normalized}`,
              openPrereqs.length
                ? `open_prerequisites=${openPrereqs.join(",")}`
                : "prerequisites_clear",
              conditions.length ? `conditions=${conditions.join(" | ")}` : null,
              runSheet.memo.decisionRationale
                ? `rationale=${runSheet.memo.decisionRationale}`
                : null
            ]
              .filter(Boolean)
              .join("; ")
    };
  }

  runSheet.claim = {
    ...(runSheet.claim || {}),
    livePilotExecuted: Boolean(runSheet.claim?.livePilotExecuted),
    executiveAutoApproved: false,
    fullGoClaimed: normalized === EXECUTIVE_DECISION.FULL_GO,
    wave10CutoverAuthorized: false,
    cert001Certified: false,
    gatesAutoApproved: false,
    note:
      normalized === EXECUTIVE_DECISION.FULL_GO
        ? "HA-EXEC/HA-W9-EXEC Full Go recorded via explicit human name + phrase only — Wave 10 cutover / CERT-001 still require separate real human path"
        : normalized === EXECUTIVE_DECISION.CONDITIONAL_GO
          ? "Conditional Go recorded — Wave 10 cutover remains blocked until open conditions cleared or formally accepted in Wave 10 evidence"
          : "No-Go recorded — do not proceed to Wave 10 cutover"
  };

  ensureExecutiveNeverAutoApproved(runSheet);
  refreshExecutiveRunSheetScores(runSheet);
  return {
    ok: true,
    decision: normalized,
    openPrerequisites: openPrereqs,
    gates: Object.fromEntries(
      ids.map((id) => [id, runSheet.humanGates[id]])
    ),
    runSheet
  };
}

/**
 * Hard rule: never auto-approve; Approved without typed name reverts;
 * never authorize Wave 10 cutover or CERT-001 from this helper.
 */
export function ensureExecutiveNeverAutoApproved(runSheet) {
  if (!runSheet) return runSheet;
  if (!runSheet.claim) runSheet.claim = {};
  runSheet.claim.executiveAutoApproved = false;
  runSheet.claim.wave10CutoverAuthorized = false;
  runSheet.claim.cert001Certified = false;
  runSheet.claim.gatesAutoApproved = false;
  if (runSheet.scores) runSheet.scores.wave10CutoverAuthorized = false;

  if (runSheet.humanGates) {
    for (const id of GATE_IDS) {
      const g = runSheet.humanGates[id];
      if (!g) continue;
      if (
        (g.status === HUMAN_SIGNOFF_STATUS.APPROVED || g.status === "NoGoRecorded") &&
        !String(g.signerName || "").trim()
      ) {
        g.status = HUMAN_SIGNOFF_STATUS.PENDING;
        g.signerName = null;
        g.signedAt = null;
        g.decision = null;
      }
    }
  }

  if (
    runSheet.claim.fullGoClaimed === true &&
    runSheet.humanGates?.["HA-EXEC"]?.status !== HUMAN_SIGNOFF_STATUS.APPROVED
  ) {
    runSheet.claim.fullGoClaimed = false;
  }

  return runSheet;
}

export function exportExecutiveRunSheetForSignOff(runSheet) {
  const copy = JSON.parse(JSON.stringify(runSheet || {}));
  ensureExecutiveNeverAutoApproved(copy);
  refreshExecutiveRunSheetScores(copy);
  copy.exportedAt = nowIso();
  copy.exportPurpose = "human_executive_sponsor_signoff_packet";
  copy.instructions = [
    "Executive reviews RC1, Conditional Go meaning, deferred UAT, training/recon/security status",
    "Choose Full Go, Conditional Go, or No-Go — never auto-assumed",
    "Full Go with HG-01..04 still PendingHumanSignOff requires accept open conditions + typed condition list",
    "Typed executive name + phrase I CONFIRM EXECUTIVE SPONSOR DECISION required",
    "Do not deploy production or apply production Supabase migrations from this gate",
    "Wave 10 cutover / CERT-001 remain blocked until real human approvals are recorded in evidence",
    "Update docs/release-evidence/wave9-pilot-evidence.json humanApprovals HA-EXEC with the same names/dates after humans sign",
    "Preserve JOHN/KBA isolation; SUPER_ADMIN_FORBIDDEN; money 15/31/1000"
  ];
  return copy;
}

export function serializeExecutiveRunSheet(runSheet) {
  return JSON.stringify(exportExecutiveRunSheetForSignOff(runSheet), null, 2);
}

export function loadExecutiveRunSheetFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(EXECUTIVE_RUN_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    ensureExecutiveNeverAutoApproved(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveExecutiveRunSheetToStorage(
  runSheet,
  storage = globalThis.localStorage
) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, error: "storage_unavailable" };
  }
  ensureExecutiveNeverAutoApproved(runSheet);
  refreshExecutiveRunSheetScores(runSheet);
  try {
    storage.setItem(EXECUTIVE_RUN_SHEET_STORAGE_KEY, JSON.stringify(runSheet));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function getOrCreateExecutiveRunSheet(storage = globalThis.localStorage) {
  const existing = loadExecutiveRunSheetFromStorage(storage);
  if (existing?.humanGates?.["HA-EXEC"]) return existing;
  const sheet = createExecutiveRunSheet();
  saveExecutiveRunSheetToStorage(sheet, storage);
  return sheet;
}

/** JOHN isolation: owner operator must not see KBA in executive pickers. */
export function listExecutiveVisibleUsers(users, actor) {
  return listUsersForActor(users || [], actor);
}

export function assertJohnCannotSeeKbaInExecutive(users, johnActor) {
  if (!isSystemOwnerUser(johnActor)) {
    return { ok: false, error: "actor_not_john_owner" };
  }
  const visible = listExecutiveVisibleUsers(users, johnActor);
  const leaked = visible.filter((u) => isSystemDeveloperAccount(u));
  return {
    ok: leaked.length === 0,
    visibleCount: visible.length,
    leakedUsernames: leaked.map((u) => u.username)
  };
}

export function canExecutiveActorSeeAccount(actor, target) {
  return canActorSeeUserAccount(actor, target);
}

export { PREREQUISITE_GATES };
