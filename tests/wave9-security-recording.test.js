/**
 * Wave 9 — Security acceptance recording helpers (human execution; never auto-approve HA-SEC).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SECURITY_CHECKLIST,
  HUMAN_SIGNOFF_STATUS
} from "../src/core/wave9-pilot-uat-ops.js";
import {
  createSecurityRunSheet,
  recordSecurityChecklistItem,
  recordSecurityGateSignOff,
  ensureSecurityNeverAutoApproved,
  exportSecurityRunSheetForSignOff,
  serializeSecurityRunSheet,
  saveSecurityRunSheetToStorage,
  loadSecurityRunSheetFromStorage,
  assertJohnCannotSeeKbaInSecurity,
  canSecurityActorSeeAccount,
  SECURITY_HUMAN_CONFIRM_PHRASE,
  SECURITY_RUN_SHEET_STATUS
} from "../src/core/wave9-security-recording.js";
import { renderWave9SecurityRecorder } from "../src/ui/wave9-pilot-views.js";
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
  for (const item of SECURITY_CHECKLIST) {
    const result = recordSecurityChecklistItem(sheet, item.id, {
      passFail: "pass",
      executedBy: "JOHN",
      signerName: "JOHN",
      evidence: `evidence-${item.id}`
    });
    assert.equal(result.ok, true, result.error);
  }
}

test("security run sheet starts ReadyToExecute with 9 items and pending HA-SEC", () => {
  const sheet = createSecurityRunSheet();
  assert.equal(sheet.schemaVersion, "wave9-security-run-sheet/1.0");
  assert.equal(sheet.humanGate, "HG-04");
  assert.equal(sheet.status, SECURITY_RUN_SHEET_STATUS.READY);
  assert.equal(sheet.checklist.length, 9);
  assert.equal(sheet.checklist.length, SECURITY_CHECKLIST.length);
  assert.equal(sheet.scores.recordedPassFailCount, 0);
  assert.equal(sheet.scores.securitySignOffPending, true);
  assert.equal(sheet.claim.productionHardenedClaim, false);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-SEC"].signerName, null);
  assert.equal(sheet.moneyInvariants.interest, 15);
  assert.equal(sheet.moneyInvariants.collectionDays, 31);
  assert.equal(sheet.moneyInvariants.cashierLimitGhs, 1000);
  assert.equal(sheet.loginGuidance.primaryOperator, "JOHN");
  assert.equal(sheet.hardConstraints.noProdSupabaseMigrate, true);
  for (const item of sheet.checklist) {
    assert.equal(item.passFail, null);
  }
  const ids = sheet.checklist.map((i) => i.itemId);
  assert.ok(ids.includes("SEC-AUTH-01"));
  assert.ok(ids.includes("SEC-RBAC-01"));
  assert.ok(ids.includes("SEC-TENANT-01"));
  assert.ok(ids.includes("SEC-JOHN-KBA-01"));
  assert.ok(ids.includes("SEC-SESSION-01"));
  assert.ok(ids.includes("SEC-AUDIT-01"));
  assert.ok(ids.includes("SEC-ENCRYPT-01"));
  assert.ok(ids.includes("SEC-ISSUES-01"));
  assert.ok(ids.includes("SEC-RLS-01"));
});

test("checklist Pass/Fail never approves HA-SEC or sets productionHardenedClaim", () => {
  const sheet = createSecurityRunSheet();
  const saved = recordSecurityChecklistItem(sheet, "SEC-AUTH-01", {
    passFail: "pass",
    executedBy: "Ama"
  });
  assert.equal(saved.ok, true);
  assert.equal(sheet.claim.productionHardenedClaim, false);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const failNoNotes = recordSecurityChecklistItem(sheet, "SEC-RBAC-01", {
    passFail: "fail"
  });
  assert.equal(failNoNotes.ok, false);
  assert.equal(failNoNotes.error, "finding_notes_required_on_fail");

  const failOk = recordSecurityChecklistItem(sheet, "SEC-RBAC-01", {
    passFail: "fail",
    findingNotes: "Cashier could open Admin deep link",
    executedBy: "Kwame"
  });
  assert.equal(failOk.ok, true);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("cannot sign HA-SEC without typed name + phrase; blocks Fail items", () => {
  const sheet = createSecurityRunSheet();
  seedAllChecklistPass(sheet);

  const noName = recordSecurityGateSignOff(sheet, "HA-SEC", {
    signerName: "  ",
    confirmPhrase: SECURITY_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noName.ok, false);
  assert.equal(noName.error, "signer_name_required");

  const badPhrase = recordSecurityGateSignOff(sheet, "HA-SEC", {
    signerName: "Security Lead",
    confirmPhrase: "yes"
  });
  assert.equal(badPhrase.ok, false);
  assert.equal(badPhrase.error, "confirm_phrase_required");
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const early = createSecurityRunSheet();
  const gateEarly = recordSecurityGateSignOff(early, "HA-SEC", {
    signerName: "Security Lead",
    confirmPhrase: SECURITY_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(gateEarly.ok, false);
  assert.equal(gateEarly.error, "all_checklist_items_must_be_recorded_first");

  const withFail = createSecurityRunSheet();
  seedAllChecklistPass(withFail);
  recordSecurityChecklistItem(withFail, "SEC-ISSUES-01", {
    passFail: "fail",
    findingNotes: "Open Critical finding ISS-SEC-9"
  });
  const blocked = recordSecurityGateSignOff(withFail, "HA-SEC", {
    signerName: "Security Lead",
    confirmPhrase: SECURITY_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "remediate_fail_or_blocked_items_first");
});

test("explicit HA-SEC sign-off keeps productionHardenedClaim false; stripping name reverts", () => {
  const sheet = createSecurityRunSheet();
  seedAllChecklistPass(sheet);
  const ok = recordSecurityGateSignOff(sheet, "HA-SEC", {
    signerName: "Security Lead",
    confirmPhrase: SECURITY_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(ok.ok, true);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(sheet.humanGates["HA-SEC"].signerName, "Security Lead");
  assert.equal(sheet.claim.productionHardenedClaim, false);
  assert.equal(sheet.claim.securityAutoApproved, false);

  sheet.claim.productionHardenedClaim = true;
  ensureSecurityNeverAutoApproved(sheet);
  assert.equal(sheet.claim.productionHardenedClaim, false);

  sheet.humanGates["HA-SEC"].signerName = "";
  ensureSecurityNeverAutoApproved(sheet);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("JOHN isolation still holds for security visible accounts", () => {
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
  assert.equal(canSecurityActorSeeAccount(john, kba), false);
  const check = assertJohnCannotSeeKbaInSecurity([john, kba, staff], john);
  assert.equal(check.ok, true);
  assert.deepEqual(check.leakedUsernames, []);
});

test("localStorage save/load + export keep HA-SEC pending; UI recorder renders", () => {
  const storage = memoryStorage();
  const sheet = createSecurityRunSheet();
  recordSecurityChecklistItem(sheet, "SEC-AUTH-01", {
    passFail: "pass",
    executedBy: "JOHN"
  });
  const saved = saveSecurityRunSheetToStorage(sheet, storage);
  assert.equal(saved.ok, true);
  const loaded = loadSecurityRunSheetFromStorage(storage);
  assert.equal(loaded.checklist.find((i) => i.itemId === "SEC-AUTH-01").passFail, "pass");
  assert.equal(loaded.claim.productionHardenedClaim, false);
  assert.equal(loaded.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);

  const exported = exportSecurityRunSheetForSignOff(loaded);
  assert.equal(exported.exportPurpose, "human_security_acceptance_signoff_packet");
  assert.equal(exported.claim.productionHardenedClaim, false);
  const json = serializeSecurityRunSheet(loaded);
  assert.match(json, /"productionHardenedClaim": false/);
  assert.doesNotMatch(json, /"productionHardenedClaim": true/);

  const html = renderWave9SecurityRecorder({ runSheet: loaded, canRecord: true });
  assert.match(html, /Security acceptance recorder/);
  assert.match(html, /Export for sign-off/);
  assert.match(html, /Record HA-SEC sign-off/);
  assert.match(html, /SEC-AUTH-01/);
  assert.match(html, /I CONFIRM SECURITY ACCEPTANCE/);
  assert.match(html, /productionHardenedClaim=false/);
});

test("evidence run sheet file and execution guide exist; HA-SEC not Approved; HG-04 prepared under HG-05 focus", () => {
  const guide = path.join(ROOT, "docs", "security", "wave9-security-acceptance-execution-guide.md");
  const sheetPath = path.join(ROOT, "docs", "release-evidence", "wave9-security-run-sheet.json");
  assert.equal(fs.existsSync(guide), true);
  assert.equal(fs.existsSync(sheetPath), true);
  const sheet = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
  assert.equal(sheet.checklist.length, 9);
  assert.equal(sheet.scores.recordedPassFailCount, 0);
  assert.equal(sheet.humanGates["HA-SEC"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HA-SEC"].signerName, null);
  assert.equal(sheet.claim.productionHardenedClaim, false);
  for (const item of sheet.checklist) {
    assert.equal(item.passFail, null);
  }
  assert.ok(["ReadyToExecute", "PendingHumanSignOff"].includes(sheet.status));
  const guideText = fs.readFileSync(guide, "utf8");
  assert.match(guideText, /SEC-AUTH-01/);
  assert.match(guideText, /SEC-JOHN-KBA-01/);
  assert.match(guideText, /SEC-RLS-01/);
  assert.match(guideText, /JOHN/);
  assert.match(guideText, /HG-04/);
  assert.match(guideText, /Prepared/);
  assert.match(guideText, /I CONFIRM SECURITY ACCEPTANCE/);

  const runbook = fs.readFileSync(path.join(ROOT, "docs", "backlog", "human-gates-runbook.md"), "utf8");
  assert.match(runbook, /HG-04 Security Acceptance/);
  assert.match(runbook, /HG-05 Executive Sponsor Approval/);
  assert.match(runbook, /HG-05.*\*\*current focus\*\*/is);
  assert.match(runbook, /HG-01.*deferred/i);
  assert.match(runbook, /HG-02.*prepared/i);
  assert.match(runbook, /HG-03.*prepared/i);
  assert.match(runbook, /HG-04.*prepared/i);
});
