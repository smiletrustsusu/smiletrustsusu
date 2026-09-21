import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  ensureBackupRecoveryState,
  createBackupSet,
  verifyBackup,
  requestRestore,
  transitionRestore,
  executeRestore,
  runRecoveryTest,
  enforceRetention,
  upsertDrSite,
  recoveryObjectives,
  backupDashboard,
  backupReports,
  exportBackupCsv,
  assertBackupBoundary,
  canTransitionRestore
} from "../src/core/backup-recovery-ops.js";
import { enqueueJob, tickScheduler, ensureJobState } from "../src/core/job-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-10T20:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31, lastBackupAt: now },
    collections: [{ id: "col-1", date: "2026-09-10", amount: 20 }],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    loans: [],
    audit: [],
    offlineQueue: [{ id: "q1", kind: "collection" }]
  };
  ensureJobState(state);
  ensureBackupRecoveryState(state);
  return state;
}

test("backup engine is centralized and test restores never change production money", () => {
  const boundary = assertBackupBoundary();
  assert.equal(boundary.centralized, true);
  assert.equal(boundary.independentModuleBackups, false);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.testRestoreMutatesProduction, false);
  assert.equal(canTransitionRestore("requested", "authorized"), true);
  assert.equal(canTransitionRestore("activated", "requested"), false);
});

test("create, verify, and retain cataloged backups", () => {
  const state = blank();
  const created = createBackupSet(state, { type: "full", source: "manual" }, owner, uid, now);
  assert.equal(created.ok, true);
  assert.equal(created.verification.status, "passed");
  const again = verifyBackup(state, created.backup.id, { user: owner, uid, now });
  assert.equal(again.ok, true);
  created.backup.checksum = "tampered";
  const failed = verifyBackup(state, created.backup.id, { user: owner, uid, now });
  assert.equal(failed.ok, false);
  assert.ok(state.monitoringAlerts.some((item) => item.domain === "backup" || /backup/i.test(item.name || "")));
  const android = createBackupSet(state, { type: "android_offline", deviceId: "dev-1" }, owner, uid, now);
  assert.equal(android.backup.encrypted, true);
  assert.equal(state.androidOfflineBackups.length >= 1, true);
});

test("production restore needs maker-checker and does not apply without approval", () => {
  const state = blank();
  const created = createBackupSet(state, { type: "snapshot" }, owner, uid, now);
  const restore = requestRestore(state, { backupSetId: created.backup.id, applyToProduction: true }, collector, uid, now);
  assert.equal(restore.ok, false);
  const asked = requestRestore(state, { backupSetId: created.backup.id, applyToProduction: true }, owner, uid, now);
  assert.equal(asked.restore.status, "requested");
  const blocked = executeRestore(state, asked.restore.id, { user: owner, uid, now, applyToProduction: true });
  assert.equal(blocked.ok, false);
  transitionRestore(state, asked.restore.id, "authorized", { user: owner, uid, now });
  const approved = transitionRestore(state, asked.restore.id, "approved", { user: owner, uid, now });
  assert.equal(approved.ok, true);
  const executed = executeRestore(state, asked.restore.id, { user: owner, uid, now, applyToProduction: false });
  assert.equal(executed.ok, true);
  assert.equal(executed.productionTouched, false);
  assert.equal(state.collections[0].amount, 20);
  assert.equal(canAction(collector, "Backup.Approve"), false);
});

test("recovery drills leave collections untouched and report RTO/RPO", () => {
  const state = blank();
  const drill = runRecoveryTest(state, {}, owner, uid, now);
  assert.equal(drill.ok, true);
  assert.equal(drill.collectionsUnchanged, true);
  assert.equal(state.collections[0].amount, 20);
  const obj = recoveryObjectives(state, now);
  assert.equal(obj.rpoBreached, false);
  assert.equal(backupDashboard(state, now).tests >= 1, true);
  const site = upsertDrSite(state, { id: "dr-secondary", strategy: "hot", status: "standby" }, owner, uid, now);
  assert.equal(site.site.strategy, "hot");
});

test("retention expires old sets and the scheduler can create backups", () => {
  const state = blank();
  const old = createBackupSet(state, { type: "daily", source: "old" }, owner, uid, "2020-01-01T00:00:00.000Z");
  const kept = enforceRetention(state, { user: owner, uid, now });
  assert.equal(kept.ok, true);
  assert.equal(state.backupSets.find((item) => item.id === old.backup.id).status, "expired");
  const queued = enqueueJob(state, { type: "backup", businessKey: `test-${Date.now()}` }, owner, uid, now);
  assert.equal(queued.ok, true);
  tickScheduler(state, { uid, user: owner, workerId: "wrk-local", now: Date.parse(now) });
  assert.ok(state.backupSets.length >= 2);
  const report = backupReports(state, "backup_jobs", { from: "2020-01-01", to: "2026-09-10" });
  assert.ok(exportBackupCsv(report).includes("full") || exportBackupCsv(report).length > 10);
});
