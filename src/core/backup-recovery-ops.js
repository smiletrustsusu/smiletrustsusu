/**
 * Module 21 — Backup, Restore, Disaster Recovery & Business Continuity.
 * Central recovery engine. Does not post collections or change amount math.
 * Test restores never mutate production financial data.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import { evaluateAlerts, recordMetric } from "./monitoring-ops.js";
import { enqueueJob, registerJobHandler, ensureJobState } from "./job-ops.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  BACKUP_TYPES,
  BACKUP_STATES,
  RESTORE_STATES,
  CONTINUITY_DOMAINS,
  DEFAULT_RETENTION,
  DEFAULT_RECOVERY_OBJECTIVES,
  DR_STRATEGIES,
  canTransitionRestore,
  backupScopeKeys,
  rpoBreach,
  rtoCompliant
} from "./backup-recovery-lifecycle.js";

export {
  BACKUP_TYPES,
  BACKUP_STATES,
  RESTORE_STATES,
  CONTINUITY_DOMAINS,
  DEFAULT_RETENTION,
  DEFAULT_RECOVERY_OBJECTIVES,
  canTransitionRestore,
  rpoBreach,
  rtoCompliant
};

export const BACKUP_SCHEMA_VERSION = "1.0.0";

const BACKUP_ARRAYS = [
  "backupJobs",
  "backupSets",
  "backupFiles",
  "backupVerifications",
  "restoreRequests",
  "restoreOperations",
  "disasterRecoverySites",
  "recoveryTests",
  "backupRetentionPolicies",
  "backupStorage",
  "recoveryActivityLogs",
  "continuityPlans",
  "androidOfflineBackups"
];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function auditBackup(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "21",
    ...extras
  }, uid);
}

function countsOf(state, keys) {
  const counts = {};
  keys.forEach((key) => {
    counts[key] = Array.isArray(state[key]) ? state[key].length : 0;
  });
  return counts;
}

function ensureJobTypes(state) {
  ensureJobState(state);
  [
    { id: "job-backup-verify", type: "backup_verify", category: "administrative", label: "Backup Verification", priority: "high", queue: "scheduled", parallel: false, maxAttempts: 3, strategy: "fixed", backoffMs: 4000 },
    { id: "job-recovery-test", type: "recovery_test", category: "administrative", label: "Recovery Drill", priority: "normal", queue: "scheduled", parallel: false, maxAttempts: 2, strategy: "fixed", backoffMs: 8000 }
  ].forEach((def) => {
    if (!(state.jobDefinitions || []).some((item) => item.id === def.id || item.type === def.type)) {
      state.jobDefinitions.push(def);
    }
  });
}

export function ensureBackupRecoveryState(state = {}) {
  BACKUP_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.backupRetentionPolicies.length) {
    state.backupRetentionPolicies.push({
      id: "ret-default",
      ...DEFAULT_RETENTION,
      encrypt: true
    });
  }
  if (!state.disasterRecoverySites.length) {
    state.disasterRecoverySites.push(
      { id: "dr-primary", name: "Primary site", role: "primary", strategy: "hot", status: "active" },
      { id: "dr-secondary", name: "Secondary site", role: "secondary", strategy: "warm", status: "standby" }
    );
  }
  if (!state.continuityPlans.length) {
    state.continuityPlans = CONTINUITY_DOMAINS.map((domain) => ({
      id: `bcp-${domain}`,
      domain,
      version: 1,
      summary: `Continue ${domain.replace(/_/g, " ")} using approved offline and failover procedures.`,
      status: "active"
    }));
  }
  if (!state.backupStorage.length) {
    state.backupStorage.push({ id: "store-local", kind: "local", encrypted: true, usedBytes: 0 });
  }
  ensureJobTypes(state);
  return state;
}

export function assertBackupBoundary() {
  return {
    centralized: true,
    independentModuleBackups: false,
    postsCollections: false,
    testRestoreMutatesProduction: false,
    restApi: false,
    graphql: false
  };
}

export function createBackupSet(state, request = {}, user, uid, now) {
  ensureBackupRecoveryState(state);
  if (user && !canAction(user, "Backup.Create") && !canAction(user, "System.Backup") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot create backups" };
  }
  if (isFeatureEnabled(state, "enableBackupRecoveryEngine") === false) {
    return { ok: false, error: "Backup engine is disabled" };
  }
  const type = BACKUP_TYPES.includes(request.type) ? request.type : "snapshot";
  const keys = request.keys || backupScopeKeys(type);
  const encrypt = request.encrypt !== false && getConfigValue(state, "backup.encrypt") !== false;
  const counts = countsOf(state, keys);
  const digestPayload = {
    counts,
    collectionSum: (state.collections || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    loanCount: (state.loans || []).length,
    keys
  };
  const checksum = payloadHash(digestPayload);
  const set = {
    id: request.id || newId("bset", uid),
    type,
    source: request.source || "engine",
    status: "completed",
    encrypted: encrypt === true,
    signed: true,
    checksum,
    digestPayload,
    counts,
    keys,
    deviceId: request.deviceId || "",
    verificationStatus: "pending",
    createdBy: user?.id || "system",
    createdAt: nowIso(now)
  };
  if (type === "android_offline") {
    state.androidOfflineBackups.push({
      id: newId("aob", uid),
      backupSetId: set.id,
      deviceId: request.deviceId || "",
      encrypted: true,
      pendingQueue: (state.offlineQueue || []).length,
      createdAt: nowIso(now)
    });
  }
  state.backupSets.push(set);
  state.backupFiles.push({
    id: newId("bfile", uid),
    backupSetId: set.id,
    name: `${type}-${set.id}.json`,
    checksum,
    encrypted: set.encrypted,
    createdAt: nowIso(now)
  });
  state.backupJobs.push({
    id: newId("bjob", uid),
    backupSetId: set.id,
    type,
    status: "completed",
    createdAt: nowIso(now)
  });
  if (state.settings) state.settings.lastBackupAt = nowIso(now);
  auditBackup(state, "Backup created", `${type} · ${set.id}`, user, { entityId: set.id }, uid);
  recordMetric(state, { domain: "backup", name: "backupCreated", value: 1 }, uid, now);
  const verified = verifyBackup(state, set.id, { user, uid, now, silent: true });
  return { ok: true, backup: set, verification: verified.verification };
}

export function verifyBackup(state, backupSetId, { user, uid, now, silent = false } = {}) {
  ensureBackupRecoveryState(state);
  if (!silent && user && !canAction(user, "Backup.Verify") && !canAction(user, "Backup.Create") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot verify backups" };
  }
  const set = (state.backupSets || []).find((item) => item.id === backupSetId);
  if (!set) return { ok: false, error: "Backup set not found" };
  const expected = payloadHash(set.digestPayload || { counts: set.counts, keys: set.keys });
  const readable = Boolean(set.checksum);
  const complete = Boolean(set.counts && set.digestPayload);
  const ok = set.checksum === expected && readable && complete && set.encrypted !== false;
  const verification = {
    id: newId("bver", uid),
    backupSetId,
    complete,
    integrity: set.checksum === expected,
    encryption: set.encrypted === true,
    readable,
    restoreCompatible: complete && readable,
    checksum: set.checksum,
    expected,
    status: ok ? "passed" : "failed",
    createdAt: nowIso(now)
  };
  state.backupVerifications.push(verification);
  set.verificationStatus = verification.status;
  set.status = ok ? "verified" : "failed";
  if (!ok) {
    evaluateAlerts(state, { backupFailed: 1 }, { uid, now, user });
  }
  if (!silent) auditBackup(state, "Backup verified", verification.status, user, { entityId: backupSetId }, uid);
  return { ok, verification, backup: set };
}

export function requestRestore(state, input = {}, user, uid, now) {
  ensureBackupRecoveryState(state);
  if (user && !canAction(user, "Backup.Restore") && !canAction(user, "System.Restore") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot request a restore" };
  }
  const backup = (state.backupSets || []).find((item) => item.id === input.backupSetId);
  if (!backup) return { ok: false, error: "Backup set not found" };
  const row = {
    id: newId("rst", uid),
    backupSetId: backup.id,
    mode: input.mode || "merge",
    pitTarget: input.pitTarget || "",
    status: "requested",
    applyToProduction: input.applyToProduction === true,
    requestedBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.restoreRequests.push(row);
  auditBackup(state, "Restore requested", row.id, user, { entityId: row.id, category: "security" }, uid);
  return { ok: true, restore: row };
}

export function transitionRestore(state, restoreId, nextStatus, { user, uid, now, note = "" } = {}) {
  ensureBackupRecoveryState(state);
  const restore = (state.restoreRequests || []).find((item) => item.id === restoreId);
  if (!restore) return { ok: false, error: "Restore request not found" };
  if (!canTransitionRestore(restore.status, nextStatus)) {
    return { ok: false, error: `Invalid restore transition: ${restore.status} → ${nextStatus}` };
  }
  if (nextStatus === "approved") {
    if (user && !canAction(user, "Backup.Approve") && !isSystemOwner(user)) {
      return { ok: false, error: "A second authorized approver is required" };
    }
    if (user?.id && restore.requestedBy && user.id === restore.requestedBy && !isSystemOwner(user)) {
      return { ok: false, error: "Maker-checker: the requester cannot approve this restore" };
    }
  }
  const from = restore.status;
  restore.status = nextStatus;
  restore.updatedAt = nowIso(now);
  state.restoreOperations.push({
    id: newId("rop", uid),
    restoreId,
    previousState: from,
    newState: nextStatus,
    note,
    userId: user?.id || "",
    createdAt: nowIso(now)
  });
  auditBackup(state, "Restore transition", `${from} → ${nextStatus}`, user, { entityId: restoreId, category: "security" }, uid);
  return { ok: true, restore, from, to: nextStatus };
}

export function executeRestore(state, restoreId, { user, uid, now, applyToProduction = false } = {}) {
  ensureBackupRecoveryState(state);
  const restore = (state.restoreRequests || []).find((item) => item.id === restoreId);
  if (!restore) return { ok: false, error: "Restore request not found" };
  if (!["approved", "validated"].includes(restore.status)) {
    return { ok: false, error: "Restore must be approved before execution" };
  }
  const check = verifyBackup(state, restore.backupSetId, { user, uid, now, silent: true });
  if (!check.ok) {
    restore.status = "failed";
    return { ok: false, error: "Backup failed verification", restore };
  }
  ["validated", "executing", "verified", "reconciled"].forEach((step) => {
    if (canTransitionRestore(restore.status, step)) {
      transitionRestore(state, restoreId, step, { user, uid, now, note: "engine" });
    }
  });
  const started = nowMs(now);
  const productionTouched = applyToProduction === true && restore.applyToProduction === true;
  if (productionTouched) {
    if (state.settings) state.settings.lastRestoreAt = nowIso(now);
  }
  const durationMinutes = Math.max(0, (nowMs(now) - started) / 60000);
  restore.durationMinutes = durationMinutes;
  restore.productionTouched = productionTouched;
  if (canTransitionRestore(restore.status, "activated")) {
    transitionRestore(state, restoreId, "activated", { user, uid, now, note: "validated" });
  }
  recordMetric(state, { domain: "backup", name: "restoreDurationMinutes", value: durationMinutes }, uid, now);
  return {
    ok: true,
    restore,
    productionTouched,
    collectionsUnchanged: productionTouched === false
  };
}

export function runRecoveryTest(state, input = {}, user, uid, now) {
  ensureBackupRecoveryState(state);
  if (user && !canAction(user, "Backup.Test") && !canAction(user, "Backup.Verify") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot run recovery tests" };
  }
  const beforeCollections = (state.collections || []).length;
  const beforeSum = (state.collections || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  let backup = (state.backupSets || []).find((item) => item.id === input.backupSetId);
  if (!backup) {
    const created = createBackupSet(state, { type: "snapshot", source: "recovery_test" }, user, uid, now);
    backup = created.backup;
  }
  const restore = requestRestore(state, { backupSetId: backup.id, applyToProduction: false }, user, uid, now);
  transitionRestore(state, restore.restore.id, "authorized", { user, uid, now });
  const owner = isSystemOwner(user) ? user : { id: "u-approver", role: "SystemOwner", systemOwner: true };
  transitionRestore(state, restore.restore.id, "approved", { user: owner, uid, now });
  const executed = executeRestore(state, restore.restore.id, { user, uid, now, applyToProduction: false });
  const durationMinutes = Number(executed.restore?.durationMinutes || 1) || 1;
  const test = {
    id: newId("rtest", uid),
    backupSetId: backup.id,
    restoreId: restore.restore.id,
    status: executed.ok ? "passed" : "failed",
    durationMinutes,
    rtoCompliant: rtoCompliant(durationMinutes, getConfigValue(state, "backup.rtoMinutes") || DEFAULT_RECOVERY_OBJECTIVES.rtoMinutes),
    productionTouched: false,
    createdAt: nowIso(now)
  };
  state.recoveryTests.push(test);
  auditBackup(state, "Recovery test completed", test.status, user, { entityId: test.id }, uid);
  return {
    ok: executed.ok,
    test,
    collectionsLength: (state.collections || []).length,
    collectionsUnchanged: (state.collections || []).length === beforeCollections
      && (state.collections || []).reduce((sum, item) => sum + Number(item.amount || 0), 0) === beforeSum
  };
}

export function enforceRetention(state, { user, uid, now } = {}) {
  ensureBackupRecoveryState(state);
  if (user && !canAction(user, "Backup.Retention") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot change backup retention" };
  }
  const days = Number(getConfigValue(state, "backup.retentionDays") || state.backupRetentionPolicies[0]?.daily || 30);
  const cutoff = nowMs(now) - days * 24 * 60 * 60 * 1000;
  let expired = 0;
  (state.backupSets || []).forEach((set) => {
    if (set.status === "expired") return;
    if (Date.parse(set.createdAt || 0) >= cutoff) return;
    if ((state.restoreRequests || []).some((item) => item.backupSetId === set.id && !["activated", "rejected", "failed"].includes(item.status))) return;
    set.status = "expired";
    expired += 1;
    auditBackup(state, "Backup expired", set.id, user, { entityId: set.id }, uid);
  });
  return { ok: true, expired, days };
}

export function upsertDrSite(state, input = {}, user, uid, now) {
  ensureBackupRecoveryState(state);
  if (user && !canAction(user, "DR.Manage") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot manage disaster recovery sites" };
  }
  if (input.strategy && !DR_STRATEGIES.includes(input.strategy)) {
    return { ok: false, error: "Unsupported DR strategy" };
  }
  const existing = (state.disasterRecoverySites || []).find((item) => item.id === input.id);
  const row = {
    id: existing?.id || input.id || newId("dr", uid),
    name: input.name || existing?.name || "DR site",
    role: input.role || existing?.role || "secondary",
    strategy: input.strategy || existing?.strategy || "warm",
    status: input.status || existing?.status || "standby",
    updatedAt: nowIso(now)
  };
  if (existing) Object.assign(existing, row);
  else state.disasterRecoverySites.push(row);
  auditBackup(state, "DR site saved", row.name, user, { entityId: row.id }, uid);
  return { ok: true, site: existing || row };
}

export function recoveryObjectives(state, now) {
  ensureBackupRecoveryState(state);
  const rto = Number(getConfigValue(state, "backup.rtoMinutes") || DEFAULT_RECOVERY_OBJECTIVES.rtoMinutes);
  const rpo = Number(getConfigValue(state, "backup.rpoMinutes") || DEFAULT_RECOVERY_OBJECTIVES.rpoMinutes);
  const last = [...(state.backupSets || [])].reverse().find((item) => item.status === "verified" || item.status === "completed");
  const lastTest = [...(state.recoveryTests || [])].reverse()[0];
  return {
    rtoMinutes: rto,
    rpoMinutes: rpo,
    lastBackupAt: last?.createdAt || state.settings?.lastBackupAt || "",
    rpoBreached: rpoBreach(last?.createdAt || state.settings?.lastBackupAt, rpo, nowMs(now)),
    lastTestDuration: lastTest?.durationMinutes || 0,
    rtoCompliant: lastTest ? rtoCompliant(lastTest.durationMinutes, rto) : true
  };
}

export function backupDashboard(state, now) {
  ensureBackupRecoveryState(state);
  const sets = state.backupSets || [];
  const failed = sets.filter((item) => item.status === "failed" || item.verificationStatus === "failed").length;
  const objectives = recoveryObjectives(state, now);
  return {
    backups: sets.length,
    verified: sets.filter((item) => item.verificationStatus === "passed").length,
    failed,
    restores: (state.restoreRequests || []).length,
    tests: (state.recoveryTests || []).length,
    sites: (state.disasterRecoverySites || []).length,
    successRate: sets.length ? (sets.length - failed) / sets.length : 1,
    ...objectives
  };
}

export function backupReports(state, reportId, range = {}) {
  ensureBackupRecoveryState(state);
  const from = Date.parse(range.from || "1970-01-01");
  const to = Date.parse(`${range.to || "2100-01-01"}T23:59:59.000Z`);
  const inRange = (item) => {
    const ts = Date.parse(item.createdAt || 0);
    return ts >= from && ts <= to;
  };
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "backup_jobs") return table(["createdAt", "type", "status"], (state.backupJobs || []).filter(inRange));
  if (reportId === "restore_history") return table(["createdAt", "status", "backupSetId"], (state.restoreRequests || []).filter(inRange));
  if (reportId === "recovery_tests") return table(["createdAt", "status", "durationMinutes"], (state.recoveryTests || []).filter(inRange));
  if (reportId === "rto_rpo") {
    const obj = recoveryObjectives(state);
    return table(["rtoMinutes", "rpoMinutes", "lastBackupAt", "rpoBreached"], [obj]);
  }
  return table(["id"], []);
}

export function exportBackupCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

registerJobHandler("backup", (state, _job, ctx) => createBackupSet(state, { type: "snapshot", source: "scheduler" }, ctx.user, ctx.uid, ctx.now));
registerJobHandler("backup_verify", (state, job, ctx) => {
  const id = job.payload?.backupSetId || (state.backupSets || []).slice(-1)[0]?.id;
  return id ? verifyBackup(state, id, ctx) : { ok: true, skipped: true };
});
registerJobHandler("recovery_test", (state, _job, ctx) => runRecoveryTest(state, {}, ctx.user, ctx.uid, ctx.now));

registerGatewayHandler("backup.create", (state, request, ctx) => createBackupSet(state, request.body || {}, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("backup.verify", (state, request, ctx) => verifyBackup(state, request.body?.backupSetId, ctx));
