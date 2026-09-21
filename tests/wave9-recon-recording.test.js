/**
 * Wave 9 — Financial recon recording helpers (human execution; never productionReconciled).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RECON_CHECKLIST,
  HUMAN_SIGNOFF_STATUS
} from "../src/core/wave9-pilot-uat-ops.js";
import {
  createReconRunSheet,
  recordReconChecklistItem,
  recordReconGateSignOff,
  ensureProductionReconciledNeverAutoClaimed,
  exportReconRunSheetForSignOff,
  serializeReconRunSheet,
  saveReconRunSheetToStorage,
  loadReconRunSheetFromStorage,
  formatReconVarianceDisplay,
  assertJohnCannotSeeKbaInRecon,
  canReconActorSeeAccount,
  RECON_HUMAN_CONFIRM_PHRASE,
  RECON_RUN_SHEET_STATUS
} from "../src/core/wave9-recon-recording.js";
import { renderWave9ReconRecorder } from "../src/ui/wave9-pilot-views.js";
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

function seedAllChecklistPass(sheet) {
  for (const item of RECON_CHECKLIST) {
    const result = recordReconChecklistItem(sheet, item.id, {
      passFail: "pass",
      variancePesewas: 0,
      executedBy: "JOHN",
      signerName: "JOHN"
    });
    assert.equal(result.ok, true, result.error);
  }
}

test("recon run sheet starts ReadyToExecute with 8 items and pending HA-RECON/HA-FIN", () => {
  const sheet = createReconRunSheet();
  assert.equal(sheet.schemaVersion, "wave9-recon-run-sheet/1.0");
  assert.equal(sheet.humanGate, "HG-03");
  assert.equal(sheet.status, RECON_RUN_SHEET_STATUS.READY);
  assert.equal(sheet.checklist.length, 8);
  assert.equal(sheet.checklist.length, RECON_CHECKLIST.length);
  assert.equal(sheet.scores.recordedPassFailCount, 0);
  assert.equal(sheet.scores.reconSignOffPending, true);
  assert.equal(sheet.claim.productionReconciled, false);
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-FIN"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-RECON"].signerName, null);
  assert.equal(sheet.moneyInvariants.interest, 15);
  assert.equal(sheet.moneyInvariants.collectionDays, 31);
  assert.equal(sheet.moneyInvariants.cashierLimitGhs, 1000);
  assert.equal(sheet.loginGuidance.primaryOperator, "JOHN");
  for (const item of sheet.checklist) {
    assert.equal(item.passFail, null);
    assert.equal(item.systemTotalPesewas, null);
    assert.equal(item.physicalTotalPesewas, null);
  }
});

test("checklist Pass/Fail never approves gates or sets productionReconciled", () => {
  const sheet = createReconRunSheet();
  const saved = recordReconChecklistItem(sheet, "RC-CASHBOOK-01", {
    passFail: "pass",
    variancePesewas: 0,
    executedBy: "Ama"
  });
  assert.equal(saved.ok, true);
  assert.equal(sheet.claim.productionReconciled, false);
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.scores.productionReconciled, false);

  const failNoNotes = recordReconChecklistItem(sheet, "RC-COLL-01", {
    passFail: "fail"
  });
  assert.equal(failNoNotes.ok, false);
  assert.equal(failNoNotes.error, "variance_notes_required_on_fail");

  const failOk = recordReconChecklistItem(sheet, "RC-COLL-01", {
    passFail: "fail",
    variancePesewas: 50,
    varianceNotes: "Collector sheet short 50 pesewas",
    executedBy: "Kwame"
  });
  assert.equal(failOk.ok, true);
  assert.equal(sheet.claim.productionReconciled, false);
});

test("cannot sign HA-RECON without typed name + phrase; never productionReconciled", () => {
  const sheet = createReconRunSheet();
  seedAllChecklistPass(sheet);

  const noName = recordReconGateSignOff(sheet, "HA-RECON", {
    signerName: "  ",
    confirmPhrase: RECON_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noName.ok, false);
  assert.equal(noName.error, "signer_name_required");

  const badPhrase = recordReconGateSignOff(sheet, "HA-RECON", {
    signerName: "Finance Lead",
    confirmPhrase: "yes"
  });
  assert.equal(badPhrase.ok, false);
  assert.equal(badPhrase.error, "confirm_phrase_required");
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.productionReconciled, false);

  const early = createReconRunSheet();
  const gateEarly = recordReconGateSignOff(early, "HA-RECON", {
    signerName: "Finance Lead",
    confirmPhrase: RECON_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(gateEarly.ok, false);
  assert.equal(gateEarly.error, "all_checklist_items_must_be_recorded_first");
});

test("explicit HA-RECON sign-off keeps productionReconciled false; stripping name reverts", () => {
  const sheet = createReconRunSheet();
  seedAllChecklistPass(sheet);
  const ok = recordReconGateSignOff(sheet, "HA-RECON", {
    signerName: "Finance Lead",
    confirmPhrase: RECON_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(ok.ok, true);
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(sheet.humanGates["HA-RECON"].signerName, "Finance Lead");
  assert.equal(sheet.claim.productionReconciled, false);
  assert.equal(sheet.scores.productionReconciled, false);

  // Force-claim then ensure helper clears it
  sheet.claim.productionReconciled = true;
  ensureProductionReconciledNeverAutoClaimed(sheet);
  assert.equal(sheet.claim.productionReconciled, false);

  sheet.humanGates["HA-RECON"].signerName = "";
  ensureProductionReconciledNeverAutoClaimed(sheet);
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("variance display formats pesewas and GHS", () => {
  const v = formatReconVarianceDisplay(100000);
  assert.equal(v.ok, true);
  assert.equal(v.variancePesewas, 100000);
  assert.equal(v.varianceGhs, 1000);
  assert.match(v.displayGhs, /GHS/);
  const bad = formatReconVarianceDisplay(1.5);
  assert.equal(bad.ok, false);
});

test("JOHN isolation still holds for recon visible accounts", () => {
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
  assert.equal(canReconActorSeeAccount(john, kba), false);
  const check = assertJohnCannotSeeKbaInRecon([john, kba, staff], john);
  assert.equal(check.ok, true);
  assert.deepEqual(check.leakedUsernames, []);
});

test("localStorage save/load + export keep productionReconciled false; UI recorder renders", () => {
  const storage = memoryStorage();
  const sheet = createReconRunSheet();
  recordReconChecklistItem(sheet, "RC-CASHBOOK-01", {
    passFail: "pass",
    variancePesewas: 0,
    executedBy: "JOHN"
  });
  const saved = saveReconRunSheetToStorage(sheet, storage);
  assert.equal(saved.ok, true);
  const loaded = loadReconRunSheetFromStorage(storage);
  assert.equal(loaded.checklist.find((i) => i.itemId === "RC-CASHBOOK-01").passFail, "pass");
  assert.equal(loaded.claim.productionReconciled, false);
  assert.equal(loaded.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const exported = exportReconRunSheetForSignOff(loaded);
  assert.equal(exported.exportPurpose, "human_financial_recon_signoff_packet");
  assert.equal(exported.claim.productionReconciled, false);
  const json = serializeReconRunSheet(loaded);
  assert.match(json, /"productionReconciled": false/);
  assert.doesNotMatch(json, /"productionReconciled": true/);

  const html = renderWave9ReconRecorder({ runSheet: loaded, canRecord: true });
  assert.match(html, /Financial reconciliation recorder/);
  assert.match(html, /Export for sign-off/);
  assert.match(html, /Record recon sign-off/);
  assert.match(html, /RC-CASHBOOK-01/);
  assert.match(html, /productionReconciled=false/);
});

test("evidence run sheet file and execution guide exist; gates not Approved; no fake totals", () => {
  const guide = path.join(ROOT, "docs", "reconciliation", "wave9-financial-recon-execution-guide.md");
  const sheetPath = path.join(ROOT, "docs", "release-evidence", "wave9-recon-run-sheet.json");
  assert.equal(fs.existsSync(guide), true);
  assert.equal(fs.existsSync(sheetPath), true);
  const sheet = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
  assert.equal(sheet.checklist.length, 8);
  assert.equal(sheet.scores.recordedPassFailCount, 0);
  assert.equal(sheet.humanGates["HA-RECON"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-FIN"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-RECON"].signerName, null);
  assert.equal(sheet.claim.productionReconciled, false);
  for (const item of sheet.checklist) {
    assert.equal(item.passFail, null);
    assert.equal(item.systemTotalPesewas, null);
    assert.equal(item.physicalTotalPesewas, null);
  }
  assert.ok(["ReadyToExecute", "PendingHumanSignOff"].includes(sheet.status));
  const guideText = fs.readFileSync(guide, "utf8");
  assert.match(guideText, /RC-CASHBOOK-01/);
  assert.match(guideText, /JOHN/);
  assert.match(guideText, /HG-03/);
  assert.match(guideText, /productionReconciled/);
  assert.match(guideText, /Prepared/);

  const runbook = fs.readFileSync(path.join(ROOT, "docs", "backlog", "human-gates-runbook.md"), "utf8");
  assert.match(runbook, /HG-04 Security Acceptance/);
  assert.match(runbook, /\*\*current focus\*\*/i);
  assert.match(runbook, /HG-01.*deferred/i);
  assert.match(runbook, /HG-02.*prepared/i);
  assert.match(runbook, /HG-03.*prepared/i);
});
