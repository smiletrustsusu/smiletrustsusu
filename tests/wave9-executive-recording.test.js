/**
 * Wave 9 — Executive Sponsor recording helpers (human execution; never auto-approve HA-EXEC).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HUMAN_SIGNOFF_STATUS, SECURITY_CHECKLIST } from "../src/core/wave9-pilot-uat-ops.js";
import {
  createExecutiveRunSheet,
  recordExecutiveMemoDraft,
  recordExecutiveSponsorDecision,
  ensureExecutiveNeverAutoApproved,
  exportExecutiveRunSheetForSignOff,
  serializeExecutiveRunSheet,
  saveExecutiveRunSheetToStorage,
  loadExecutiveRunSheetFromStorage,
  syncExecutivePrerequisitesFromStorage,
  listOpenPrerequisiteIds,
  assertJohnCannotSeeKbaInExecutive,
  canExecutiveActorSeeAccount,
  EXECUTIVE_HUMAN_CONFIRM_PHRASE,
  EXECUTIVE_DECISION,
  EXECUTIVE_RUN_SHEET_STATUS
} from "../src/core/wave9-executive-recording.js";
import {
  createSecurityRunSheet,
  recordSecurityChecklistItem,
  recordSecurityGateSignOff,
  saveSecurityRunSheetToStorage,
  SECURITY_HUMAN_CONFIRM_PHRASE,
  SECURITY_RUN_SHEET_STORAGE_KEY as SEC_KEY
} from "../src/core/wave9-security-recording.js";
import { renderWave9ExecutiveRecorder } from "../src/ui/wave9-pilot-views.js";
import {
  SYSTEM_OWNER_ID,
  SYSTEM_OWNER_ROLE,
  SUPER_ADMIN_ID,
  SUPER_ADMIN_ROLE
} from "../src/core/system-accounts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    }
  };
}

test("executive run sheet starts ReadyToExecute with pending HA-EXEC / HA-W9-EXEC", () => {
  const sheet = createExecutiveRunSheet();
  assert.equal(sheet.schemaVersion, "wave9-executive-run-sheet/1.0");
  assert.equal(sheet.humanGate, "HG-05");
  assert.equal(sheet.status, EXECUTIVE_RUN_SHEET_STATUS.READY);
  assert.equal(sheet.prerequisites.length, 4);
  assert.equal(sheet.scores.prerequisitesPendingCount, 4);
  assert.equal(sheet.scores.executiveSignOffPending, true);
  assert.equal(sheet.claim.fullGoClaimed, false);
  assert.equal(sheet.claim.wave10CutoverAuthorized, false);
  assert.equal(sheet.claim.cert001Certified, false);
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-W9-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-EXEC"].signerName, null);
  assert.equal(sheet.moneyInvariants.interest, 15);
  assert.equal(sheet.loginGuidance.primaryOperator, "JOHN");
  assert.equal(sheet.hardConstraints.wave10BlockedUntilRealApprovals, true);
  assert.deepEqual(listOpenPrerequisiteIds(sheet), ["HG-01", "HG-02", "HG-03", "HG-04"]);
});

test("memo draft never approves HA-EXEC or authorizes Wave 10", () => {
  const sheet = createExecutiveRunSheet();
  const saved = recordExecutiveMemoDraft(sheet, {
    decisionRationale: "Draft only",
    openConditions: "HG-01 deferred",
    sponsorMemoFields: {
      pilotName: "NORTHRISE MICRO SAVINGS",
      recommendation: "Conditional Go"
    }
  });
  assert.equal(saved.ok, true);
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.wave10CutoverAuthorized, false);
  assert.equal(sheet.memo.sponsorMemoFields.pilotName, "NORTHRISE MICRO SAVINGS");
});

test("Full Go blocked while HG-01..04 pending unless accept open conditions + list", () => {
  const sheet = createExecutiveRunSheet();

  const noName = recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.FULL_GO,
    signerName: "  ",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noName.ok, false);
  assert.equal(noName.error, "signer_name_required");

  const badPhrase = recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.FULL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: "yes"
  });
  assert.equal(badPhrase.ok, false);
  assert.equal(badPhrase.error, "confirm_phrase_required");

  const blocked = recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.FULL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "full_go_blocked_open_prerequisites");
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const missingList = recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.FULL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE,
    acceptOpenConditions: true,
    openConditions: ""
  });
  assert.equal(missingList.ok, false);
  assert.equal(missingList.error, "open_conditions_required_for_full_go_with_pending_gates");

  const ok = recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.FULL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE,
    acceptOpenConditions: true,
    openConditions: ["HG-01 UAT deferred", "HG-02 training pending"]
  });
  assert.equal(ok.ok, true);
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(sheet.humanGates["HA-W9-EXEC"].status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(sheet.humanGates["HA-EXEC"].signerName, "Exec Sponsor");
  assert.equal(sheet.memo.decision, EXECUTIVE_DECISION.FULL_GO);
  assert.equal(sheet.claim.fullGoClaimed, true);
  assert.equal(sheet.claim.wave10CutoverAuthorized, false);
  assert.equal(sheet.claim.cert001Certified, false);
});

test("Conditional Go requires conditions; No-Go requires rationale; Wave 10 never authorized", () => {
  const conditional = createExecutiveRunSheet();
  const noCond = recordExecutiveSponsorDecision(conditional, {
    decision: EXECUTIVE_DECISION.CONDITIONAL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noCond.ok, false);
  assert.equal(noCond.error, "open_conditions_required_for_conditional_go");

  const condOk = recordExecutiveSponsorDecision(conditional, {
    decision: EXECUTIVE_DECISION.CONDITIONAL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE,
    openConditions: "business_uat_signoff_pending\ntraining_completion_pending"
  });
  assert.equal(condOk.ok, true);
  assert.equal(conditional.memo.decision, EXECUTIVE_DECISION.CONDITIONAL_GO);
  assert.equal(conditional.claim.fullGoClaimed, false);
  assert.equal(conditional.claim.wave10CutoverAuthorized, false);
  assert.equal(conditional.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.APPROVED);

  const noGo = createExecutiveRunSheet();
  const noReason = recordExecutiveSponsorDecision(noGo, {
    decision: EXECUTIVE_DECISION.NO_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noReason.ok, false);
  assert.equal(noReason.error, "rationale_required_for_no_go");

  const noGoOk = recordExecutiveSponsorDecision(noGo, {
    decision: EXECUTIVE_DECISION.NO_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE,
    decisionRationale: "Open Critical pilot risk unresolved"
  });
  assert.equal(noGoOk.ok, true);
  assert.equal(noGo.humanGates["HA-EXEC"].status, "NoGoRecorded");
  assert.equal(noGo.claim.fullGoClaimed, false);
  assert.equal(noGo.claim.wave10CutoverAuthorized, false);
});

test("Approved without typed name reverts; wave10CutoverAuthorized forced false", () => {
  const sheet = createExecutiveRunSheet();
  recordExecutiveSponsorDecision(sheet, {
    decision: EXECUTIVE_DECISION.CONDITIONAL_GO,
    signerName: "Exec Sponsor",
    confirmPhrase: EXECUTIVE_HUMAN_CONFIRM_PHRASE,
    openConditions: ["HG-01 deferred"]
  });
  sheet.claim.wave10CutoverAuthorized = true;
  sheet.claim.cert001Certified = true;
  ensureExecutiveNeverAutoApproved(sheet);
  assert.equal(sheet.claim.wave10CutoverAuthorized, false);
  assert.equal(sheet.claim.cert001Certified, false);

  sheet.humanGates["HA-EXEC"].signerName = "";
  sheet.humanGates["HA-W9-EXEC"].signerName = "";
  ensureExecutiveNeverAutoApproved(sheet);
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-W9-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("sync prerequisites from local security sheet; JOHN isolation holds", () => {
  const storage = memoryStorage();
  const sec = createSecurityRunSheet();
  for (const item of SECURITY_CHECKLIST) {
    recordSecurityChecklistItem(sec, item.id, {
      passFail: "pass",
      executedBy: "JOHN",
      evidence: `ev-${item.id}`
    });
  }
  recordSecurityGateSignOff(sec, "HA-SEC", {
    signerName: "Security Lead",
    confirmPhrase: SECURITY_HUMAN_CONFIRM_PHRASE
  });
  saveSecurityRunSheetToStorage(sec, storage);
  assert.equal(SEC_KEY, "wave9_security_run_sheet_v1");

  const exec = createExecutiveRunSheet();
  const synced = syncExecutivePrerequisitesFromStorage(exec, storage);
  assert.equal(synced.ok, true);
  const hg04 = exec.prerequisites.find((p) => p.id === "HG-04");
  assert.equal(hg04.status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.ok(listOpenPrerequisiteIds(exec).includes("HG-01"));
  assert.ok(!listOpenPrerequisiteIds(exec).includes("HG-04"));

  const john = {
    id: SYSTEM_OWNER_ID,
    role: SYSTEM_OWNER_ROLE,
    systemOwner: true,
    username: "JOHN",
    name: "John",
    active: true
  };
  const kba = {
    id: SUPER_ADMIN_ID,
    role: SUPER_ADMIN_ROLE,
    username: "KBA",
    name: "KBA",
    systemDeveloper: true,
    active: true
  };
  assert.equal(canExecutiveActorSeeAccount(john, kba), false);
  const check = assertJohnCannotSeeKbaInExecutive([john, kba], john);
  assert.equal(check.ok, true);
});

test("localStorage save/load + export keep HA-EXEC pending; UI recorder renders", () => {
  const storage = memoryStorage();
  const sheet = createExecutiveRunSheet();
  recordExecutiveMemoDraft(sheet, {
    openConditions: "HG-01 deferred",
    sponsorMemoFields: { recommendation: "Conditional Go" }
  });
  const saved = saveExecutiveRunSheetToStorage(sheet, storage);
  assert.equal(saved.ok, true);
  const loaded = loadExecutiveRunSheetFromStorage(storage);
  assert.equal(loaded.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(loaded.claim.wave10CutoverAuthorized, false);

  const exported = exportExecutiveRunSheetForSignOff(loaded);
  assert.equal(exported.exportPurpose, "human_executive_sponsor_signoff_packet");
  assert.equal(exported.claim.wave10CutoverAuthorized, false);
  const json = serializeExecutiveRunSheet(loaded);
  assert.match(json, /"wave10CutoverAuthorized": false/);
  assert.match(json, /"cert001Certified": false/);

  const html = renderWave9ExecutiveRecorder({ runSheet: loaded, canRecord: true });
  assert.match(html, /Executive Sponsor recorder/);
  assert.match(html, /Export for sign-off/);
  assert.match(html, /Record executive decision/);
  assert.match(html, /Full Go/);
  assert.match(html, /Conditional Go/);
  assert.match(html, /No-Go/);
  assert.match(html, /I CONFIRM EXECUTIVE SPONSOR DECISION/);
  assert.match(html, /Accept open conditions/);
  assert.match(html, /wave10CutoverAuthorized=false/);
  assert.match(html, /HG-01/);
});

test("evidence run sheet and execution guide exist; HA-EXEC PendingHumanSignOff; HG-05 current focus", () => {
  const guide = path.join(
    ROOT,
    "docs",
    "governance",
    "wave9-executive-sponsor-execution-guide.md"
  );
  const sheetPath = path.join(
    ROOT,
    "docs",
    "release-evidence",
    "wave9-executive-run-sheet.json"
  );
  assert.equal(fs.existsSync(guide), true);
  assert.equal(fs.existsSync(sheetPath), true);
  const sheet = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
  assert.equal(sheet.humanGate, "HG-05");
  assert.equal(sheet.humanGates["HA-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-W9-EXEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-EXEC"].signerName, null);
  assert.equal(sheet.claim.fullGoClaimed, false);
  assert.equal(sheet.claim.wave10CutoverAuthorized, false);
  assert.equal(sheet.claim.cert001Certified, false);
  assert.equal(sheet.scores.prerequisitesPendingCount, 4);
  assert.ok(["ReadyToExecute", "PendingHumanSignOff"].includes(sheet.status));

  const guideText = fs.readFileSync(guide, "utf8");
  assert.match(guideText, /HG-05/);
  assert.match(guideText, /Current focus/);
  assert.match(guideText, /Full Go/);
  assert.match(guideText, /Conditional Go/);
  assert.match(guideText, /No-Go/);
  assert.match(guideText, /I CONFIRM EXECUTIVE SPONSOR DECISION/);
  assert.match(guideText, /accept with open conditions/i);
  assert.match(guideText, /Wave 10 cutover remains blocked/);
  assert.match(guideText, /JOHN/);

  const runbook = fs.readFileSync(
    path.join(ROOT, "docs", "backlog", "human-gates-runbook.md"),
    "utf8"
  );
  assert.match(runbook, /HG-05 Executive Sponsor Approval/);
  assert.match(runbook, /HG-05.*\*\*current focus\*\*/is);
  assert.match(runbook, /Wave 10 cutover still blocked/);

  const critical = fs.readFileSync(
    path.join(ROOT, "docs", "backlog", "critical-path-report.md"),
    "utf8"
  );
  assert.match(critical, /HG-05/);
  assert.match(critical, /\*\*current focus\*\*/i);
});
