/**
 * Wave 9 — UAT recording helpers (human execution; no auto HA-* approve).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  UAT_SCENARIOS,
  HUMAN_SIGNOFF_STATUS
} from "../src/core/wave9-pilot-uat-ops.js";
import {
  createUatRunSheet,
  recordScenarioExecution,
  recordScenarioBusinessSignOff,
  recordHumanGateApproval,
  ensureGatesNotAutoApproved,
  exportRunSheetForSignOff,
  serializeRunSheet,
  saveRunSheetToStorage,
  loadRunSheetFromStorage,
  assertJohnCannotSeeKba,
  canUatActorSeeAccount,
  UAT_HUMAN_CONFIRM_PHRASE,
  UAT_RUN_SHEET_STATUS
} from "../src/core/wave9-uat-recording.js";
import { renderWave9UatRecorder } from "../src/ui/wave9-pilot-views.js";
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

test("run sheet starts ReadyToExecute with 21 scenarios and pending gates", () => {
  const sheet = createUatRunSheet();
  assert.equal(sheet.schemaVersion, "wave9-uat-run-sheet/1.0");
  assert.equal(sheet.status, UAT_RUN_SHEET_STATUS.READY);
  assert.equal(sheet.scenarios.length, 21);
  assert.equal(sheet.scenarios.length, UAT_SCENARIOS.length);
  assert.equal(sheet.scores.businessSignedCount, 0);
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.gatesAutoApproved, false);
  assert.equal(sheet.claim.livePilotExecuted, false);
  assert.equal(sheet.moneyInvariants.interest, 15);
  assert.equal(sheet.moneyInvariants.collectionDays, 31);
  assert.equal(sheet.moneyInvariants.cashierLimitGhs, 1000);
  assert.equal(sheet.loginGuidance.primaryOperator, "JOHN");
});

test("cannot approve scenario or gate without typed name + confirm phrase", () => {
  const sheet = createUatRunSheet();
  const exec = recordScenarioExecution(sheet, "UAT-AUTH-01", { passFail: "pass", executedBy: "JOHN" });
  assert.equal(exec.ok, true);
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(exec.scenario.approverStatus, HUMAN_SIGNOFF_STATUS.PENDING);

  const noName = recordScenarioBusinessSignOff(sheet, "UAT-AUTH-01", {
    approverName: "  ",
    confirmPhrase: UAT_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noName.ok, false);
  assert.equal(noName.error, "approver_name_required");

  const badPhrase = recordScenarioBusinessSignOff(sheet, "UAT-AUTH-01", {
    approverName: "Ama Boateng",
    confirmPhrase: "yes"
  });
  assert.equal(badPhrase.ok, false);
  assert.equal(badPhrase.error, "confirm_phrase_required");

  const gateNoName = recordHumanGateApproval(sheet, "HA-PO", {
    approverName: "",
    confirmPhrase: UAT_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(gateNoName.ok, false);
  assert.equal(gateNoName.error, "approver_name_required");

  const gateBad = recordHumanGateApproval(sheet, "HA-QA", {
    approverName: "QA Lead",
    confirmPhrase: "APPROVED"
  });
  assert.equal(gateBad.ok, false);
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("explicit gate approval with name does not fabricate other gates; pass/fail never flips HA-*", () => {
  const sheet = createUatRunSheet();
  for (const s of sheet.scenarios.slice(0, 3)) {
    recordScenarioExecution(sheet, s.scenarioId, { passFail: "pass", executedBy: "JOHN" });
  }
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const ok = recordHumanGateApproval(sheet, "HA-PO", {
    approverName: "Product Owner Name",
    confirmPhrase: UAT_HUMAN_CONFIRM_PHRASE,
    notes: "Business UAT pack accepted"
  });
  assert.equal(ok.ok, true);
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(sheet.humanGates["HA-PO"].approverName, "Product Owner Name");
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.gatesAutoApproved, false);

  // Strip name → ensureGatesNotAutoApproved reverts Approved without name
  sheet.humanGates["HA-PO"].approverName = "";
  ensureGatesNotAutoApproved(sheet);
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("JOHN isolation still holds for UAT visible accounts", () => {
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
  const staff = { id: "u-staff", role: "Admin", username: "ama", name: "Ama", active: true };
  assert.equal(canUatActorSeeAccount(john, kba), false);
  const check = assertJohnCannotSeeKba([john, kba, staff], john);
  assert.equal(check.ok, true);
  assert.deepEqual(check.leakedUsernames, []);
});

test("localStorage save/load + export keep pending gates; UI recorder renders", () => {
  const storage = memoryStorage();
  const sheet = createUatRunSheet();
  recordScenarioExecution(sheet, "UAT-AUTH-01", { passFail: "pass", notes: "ok", executedBy: "JOHN" });
  const saved = saveRunSheetToStorage(sheet, storage);
  assert.equal(saved.ok, true);
  const loaded = loadRunSheetFromStorage(storage);
  assert.equal(loaded.scenarios.find((s) => s.scenarioId === "UAT-AUTH-01").passFail, "pass");
  assert.equal(loaded.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const exported = exportRunSheetForSignOff(loaded);
  assert.equal(exported.exportPurpose, "human_signoff_packet");
  assert.equal(exported.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  const json = serializeRunSheet(loaded);
  assert.match(json, /ReadyToExecute|PendingHumanSignOff|InProgress/);
  assert.doesNotMatch(json, /"gatesAutoApproved": true/);

  const html = renderWave9UatRecorder({ runSheet: loaded, canRecord: true });
  assert.match(html, /UAT execution recorder/);
  assert.match(html, /Export for sign-off/);
  assert.match(html, /Record human approval/);
  assert.match(html, /UAT-AUTH-01/);
});

test("evidence run sheet file and execution guide exist; gates not Approved", () => {
  const guide = path.join(ROOT, "docs", "uat", "wave9-uat-execution-guide.md");
  const sheetPath = path.join(ROOT, "docs", "release-evidence", "wave9-uat-run-sheet.json");
  assert.equal(fs.existsSync(guide), true);
  assert.equal(fs.existsSync(sheetPath), true);
  const sheet = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
  assert.equal(sheet.scenarios.length, 21);
  assert.equal(sheet.scores.businessSignedCount, 0);
  assert.equal(sheet.humanGates["HA-PO"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-QA"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.ok(["ReadyToExecute", "PendingHumanSignOff"].includes(sheet.status));
  assert.match(fs.readFileSync(guide, "utf8"), /UAT-AUTH-01/);
  assert.match(fs.readFileSync(guide, "utf8"), /JOHN/);
});
