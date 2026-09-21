/**
 * Wave 9 — Training recording helpers (human execution; no auto-clear of training_completion_pending).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TRAINING_TRACKS,
  HUMAN_SIGNOFF_STATUS
} from "../src/core/wave9-pilot-uat-ops.js";
import {
  createTrainingRunSheet,
  recordTrackAttendance,
  recordTrackCompetency,
  recordTrackCompletion,
  recordTrainingGateCompletion,
  ensureTrainingCompletionNotAutoCleared,
  exportTrainingRunSheetForSignOff,
  serializeTrainingRunSheet,
  saveTrainingRunSheetToStorage,
  loadTrainingRunSheetFromStorage,
  assertJohnCannotSeeKbaInTraining,
  canTrainingActorSeeAccount,
  TRAINING_HUMAN_CONFIRM_PHRASE,
  TRAINING_RUN_SHEET_STATUS
} from "../src/core/wave9-training-recording.js";
import { renderWave9TrainingRecorder } from "../src/ui/wave9-pilot-views.js";
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

function seedTrackReady(sheet, trackId) {
  recordTrackAttendance(sheet, trackId, {
    participantName: "Ama Cashier",
    facilitator: "JOHN"
  });
  recordTrackCompetency(sheet, trackId, {
    competencyPassed: "pass",
    recordedBy: "JOHN"
  });
}

test("training run sheet starts ReadyToExecute with 6 tracks and pending HG-02", () => {
  const sheet = createTrainingRunSheet();
  assert.equal(sheet.schemaVersion, "wave9-training-run-sheet/1.0");
  assert.equal(sheet.status, TRAINING_RUN_SHEET_STATUS.READY);
  assert.equal(sheet.tracks.length, 6);
  assert.equal(sheet.tracks.length, TRAINING_TRACKS.length);
  assert.equal(sheet.scores.completedCount, 0);
  assert.equal(sheet.scores.trainingCompletionPending, true);
  assert.equal(sheet.claim.trainingCompletionPending, true);
  assert.equal(sheet.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HG-02"].completerName, null);
  assert.equal(sheet.claim.trainingAutoCompleted, false);
  assert.equal(sheet.moneyInvariants.interest, 15);
  assert.equal(sheet.moneyInvariants.collectionDays, 31);
  assert.equal(sheet.moneyInvariants.cashierLimitGhs, 1000);
  assert.equal(sheet.loginGuidance.primaryOperator, "JOHN");
  for (const t of sheet.tracks) {
    assert.equal(t.completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);
    assert.equal(t.completedAt, null);
    assert.equal(t.completedBy, null);
  }
});

test("attendance and competency never clear training_completion_pending or complete tracks", () => {
  const sheet = createTrainingRunSheet();
  const att = recordTrackAttendance(sheet, "TR-CASHIER", {
    participantName: "Kwame",
    facilitator: "JOHN"
  });
  assert.equal(att.ok, true);
  assert.equal(sheet.tracks.find((t) => t.trackId === "TR-CASHIER").completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.trainingCompletionPending, true);

  const comp = recordTrackCompetency(sheet, "TR-CASHIER", {
    competencyPassed: "pass",
    recordedBy: "JOHN"
  });
  assert.equal(comp.ok, true);
  assert.equal(sheet.tracks.find((t) => t.trackId === "TR-CASHIER").completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.tracks.find((t) => t.trackId === "TR-CASHIER").completedBy, null);
  assert.equal(sheet.scores.trainingCompletionPending, true);
  assert.equal(sheet.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("cannot complete track or HG-02 without typed name + confirm phrase", () => {
  const sheet = createTrainingRunSheet();
  seedTrackReady(sheet, "TR-CASHIER");

  const noName = recordTrackCompletion(sheet, "TR-CASHIER", {
    completedBy: "  ",
    confirmPhrase: TRAINING_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(noName.ok, false);
  assert.equal(noName.error, "completer_name_required");

  const badPhrase = recordTrackCompletion(sheet, "TR-CASHIER", {
    completedBy: "Trainer Name",
    confirmPhrase: "yes"
  });
  assert.equal(badPhrase.ok, false);
  assert.equal(badPhrase.error, "confirm_phrase_required");
  assert.equal(sheet.tracks.find((t) => t.trackId === "TR-CASHIER").completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);

  const gateEarly = recordTrainingGateCompletion(sheet, "HG-02", {
    completerName: "Ops Lead",
    confirmPhrase: TRAINING_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(gateEarly.ok, false);
  assert.equal(gateEarly.error, "all_tracks_must_be_completed_first");
  assert.equal(sheet.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("explicit track completion with name; stripping name reverts; pending not auto-cleared", () => {
  const sheet = createTrainingRunSheet();
  seedTrackReady(sheet, "TR-CASHIER");
  const ok = recordTrackCompletion(sheet, "TR-CASHIER", {
    completedBy: "Trainer Name",
    confirmPhrase: TRAINING_HUMAN_CONFIRM_PHRASE
  });
  assert.equal(ok.ok, true);
  const row = sheet.tracks.find((t) => t.trackId === "TR-CASHIER");
  assert.equal(row.completionStatus, HUMAN_SIGNOFF_STATUS.APPROVED);
  assert.equal(row.completedBy, "Trainer Name");
  assert.ok(row.completedAt);
  // other tracks still pending => training_completion_pending stays
  assert.equal(sheet.scores.trainingCompletionPending, true);
  assert.equal(sheet.claim.trainingCompletionPending, true);

  row.completedBy = "";
  ensureTrainingCompletionNotAutoCleared(sheet);
  assert.equal(row.completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.claim.trainingCompletionPending, true);
});

test("JOHN isolation still holds for training visible accounts", () => {
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
  assert.equal(canTrainingActorSeeAccount(john, kba), false);
  const check = assertJohnCannotSeeKbaInTraining([john, kba, staff], john);
  assert.equal(check.ok, true);
  assert.deepEqual(check.leakedUsernames, []);
});

test("localStorage save/load + export keep pending; UI recorder renders", () => {
  const storage = memoryStorage();
  const sheet = createTrainingRunSheet();
  recordTrackAttendance(sheet, "TR-CASHIER", { participantName: "Ama", facilitator: "JOHN" });
  const saved = saveTrainingRunSheetToStorage(sheet, storage);
  assert.equal(saved.ok, true);
  const loaded = loadTrainingRunSheetFromStorage(storage);
  assert.equal(loaded.tracks.find((t) => t.trackId === "TR-CASHIER").attendance.length, 1);
  assert.equal(loaded.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(loaded.claim.trainingCompletionPending, true);

  const exported = exportTrainingRunSheetForSignOff(loaded);
  assert.equal(exported.exportPurpose, "human_training_signoff_packet");
  assert.equal(exported.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  const json = serializeTrainingRunSheet(loaded);
  assert.match(json, /ReadyToExecute|PendingHumanSignOff|InProgress/);
  assert.doesNotMatch(json, /"trainingAutoCompleted": true/);
  assert.match(json, /"trainingCompletionPending": true/);

  const html = renderWave9TrainingRecorder({ runSheet: loaded, canRecord: true });
  assert.match(html, /Training execution recorder/);
  assert.match(html, /Export for sign-off/);
  assert.match(html, /Record HG-02 completion/);
  assert.match(html, /TR-CASHIER/);
});

test("evidence run sheet file and execution guide exist; gates not Approved", () => {
  const guide = path.join(ROOT, "docs", "training", "wave9-training-execution-guide.md");
  const sheetPath = path.join(ROOT, "docs", "release-evidence", "wave9-training-run-sheet.json");
  assert.equal(fs.existsSync(guide), true);
  assert.equal(fs.existsSync(sheetPath), true);
  const sheet = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
  assert.equal(sheet.tracks.length, 6);
  assert.equal(sheet.scores.completedCount, 0);
  assert.equal(sheet.humanGates["HG-02"].status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.equal(sheet.humanGates["HG-02"].completerName, null);
  assert.equal(sheet.claim.trainingCompletionPending, true);
  for (const t of sheet.tracks) {
    assert.equal(t.completedAt, null);
    assert.equal(t.completedBy, null);
    assert.equal(t.completionStatus, HUMAN_SIGNOFF_STATUS.PENDING);
  }
  assert.ok(["ReadyToExecute", "PendingHumanSignOff"].includes(sheet.status));
  const guideText = fs.readFileSync(guide, "utf8");
  assert.match(guideText, /TR-CASHIER/);
  assert.match(guideText, /JOHN/);
  assert.match(guideText, /[Dd]eferred by request/);
  assert.match(guideText, /HG-02/);
});
