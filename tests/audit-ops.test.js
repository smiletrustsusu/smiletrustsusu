import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  recordAuditEvent,
  mutateAuditEvent,
  deleteAuditEvent,
  overwriteAuditEvent,
  searchAudit,
  auditTimeline,
  verifyAuditIntegrity,
  processAuditOutbox,
  replayDeadLetter,
  archiveExpiredAudit,
  complianceReport,
  complianceCsv,
  withClassATransaction,
  classifyAuditAction,
  recentFailedLogins,
  mergeAuditImmutable,
  EVENT_SCHEMA_VERSION
} from "../src/core/audit-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

function emptyState() {
  return { audit: [], auditOutbox: [], auditArchives: [], auditIntegrityChecks: [], auditActivityLogs: [], auditAlerts: [], auditRetentionPolicies: [] };
}

test("logAudit-shaped row keeps action and details", () => {
  const state = emptyState();
  const result = recordAuditEvent(state, {
    action: "Collection recorded",
    details: "Ama paid GHS 20.00",
    userId: "u1",
    username: "ama"
  }, uid);
  assert.equal(result.ok, true);
  assert.equal(state.audit[0].action, "Collection recorded");
  assert.equal(state.audit[0].details, "Ama paid GHS 20.00");
  assert.equal(state.audit[0].eventType, "Savings Collection");
  assert.equal(state.audit[0].guarantee, "G1");
  assert.equal(state.audit[0].eventSchemaVersion, EVENT_SCHEMA_VERSION);
  assert.ok(state.audit[0].hash);
});

test("duplicate event id and idempotency key return the original row", () => {
  const state = emptyState();
  const first = recordAuditEvent(state, { action: "User Created", details: "Kojo", eventId: "evt-1", idempotencyKey: "user:kojo" }, uid);
  const second = recordAuditEvent(state, { action: "User Created", details: "Kojo again", eventId: "evt-1" }, uid);
  const third = recordAuditEvent(state, { action: "User Created", details: "Kojo third", idempotencyKey: "user:kojo" }, uid);
  assert.equal(state.audit.length, 1);
  assert.equal(second.duplicate, true);
  assert.equal(third.event.id, first.event.id);
  assert.ok(state.auditActivityLogs.some((row) => row.action === "Duplicate submission ignored"));
});

test("mutate delete and overwrite are rejected", () => {
  assert.equal(mutateAuditEvent().ok, false);
  assert.equal(deleteAuditEvent().ok, false);
  assert.equal(overwriteAuditEvent().ok, false);
});

test("Class A failure rolls back the collection", () => {
  const state = { collections: [], ...emptyState() };
  const result = withClassATransaction(state, ["collections", "audit"], () => {
    state.collections.push({ id: "col-1", amount: 20 });
    return recordAuditEvent(state, { action: "Collection recorded", details: "Ama", forcePersistFailure: true }, uid);
  });
  assert.equal(result.rolledBack, true);
  assert.equal(state.collections.length, 0);
  assert.equal(state.audit.length, 0);
});

test("Class A commit keeps collection and audit together", () => {
  const state = { collections: [], ...emptyState() };
  const result = withClassATransaction(state, ["collections", "audit"], () => {
    state.collections.push({ id: "col-2", amount: 20 });
    return recordAuditEvent(state, {
      action: "Collection recorded",
      details: "Ama · RCP-1",
      transactionId: "col-2",
      correlationId: "col-2",
      entityType: "collection",
      entityId: "col-2"
    }, uid);
  });
  assert.equal(result.ok, true);
  assert.equal(state.collections.length, 1);
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].transactionId, "col-2");
});

test("hash chain detects tampering and records a critical event", () => {
  const state = emptyState();
  recordAuditEvent(state, { action: "Login Success", details: "john", userId: "u-owner" }, uid);
  recordAuditEvent(state, { action: "Collection recorded", details: "Ama", userId: "u-owner" }, uid);
  assert.equal(verifyAuditIntegrity(state, uid, { skipAlert: true }).ok, true);
  state.audit[1].details = "tampered";
  const check = verifyAuditIntegrity(state, uid, { userId: "system" });
  assert.equal(check.ok, false);
  assert.ok(check.breaks >= 1);
  assert.ok(state.audit.some((row) => row.severity === "Critical" && /integrity/i.test(row.action + row.details)));
});

test("login failure is searchable and counts toward lockout signal", () => {
  const state = emptyState();
  recordAuditEvent(state, {
    action: "Login Failure",
    details: "Invalid login for kofi",
    username: "kofi",
    createdAt: new Date().toISOString()
  }, uid);
  const rows = searchAudit(state, { eventType: "Login Failure", user: "kofi" });
  assert.equal(rows.length, 1);
  assert.equal(recentFailedLogins(state, "kofi"), 1);
});

test("collector cannot export audit; auditor can view and export", () => {
  const collector = { role: "Collector" };
  const auditor = { role: "Auditor" };
  const owner = { role: "SystemOwner", systemOwner: true };
  assert.equal(canAction(collector, "Audit.Export"), false);
  assert.equal(canAction(collector, "Audit.View"), false);
  assert.equal(canAction(auditor, "Audit.View"), true);
  assert.equal(canAction(auditor, "Audit.Export"), true);
  assert.equal(canAction(auditor, "Audit.Archive"), false);
  assert.equal(canAction(owner, "Audit.Integrity"), true);
});

test("outbox retries then dead-letters; replay checks payload hash", () => {
  const state = emptyState();
  recordAuditEvent(state, {
    action: "Report generated",
    details: "daily",
    guarantee: "G2",
    category: "operational",
    correlationId: "corr-1"
  }, uid);
  assert.equal(state.auditOutbox.length, 1);
  const fail = processAuditOutbox(state, {
    maxRetries: 2,
    transport: () => ({ ok: false, error: "network" }),
    now: Date.now()
  });
  assert.equal(fail.retried, 1);
  const dead = processAuditOutbox(state, {
    maxRetries: 2,
    transport: () => ({ ok: false, error: "network" }),
    now: Date.now() + 120000
  });
  assert.equal(dead.dead, 1);
  const item = state.auditOutbox[0];
  const replay = replayDeadLetter(state, item.id, {
    transport: () => ({ ok: true }),
    now: Date.now() + 240000
  });
  assert.equal(replay.published, 1);
  assert.equal(state.auditOutbox[0].status, "published");
});

test("G2 publication failure does not remove the persisted audit row", () => {
  const state = emptyState();
  recordAuditEvent(state, { action: "Report generated", details: "x", guarantee: "G2" }, uid);
  processAuditOutbox(state, { maxRetries: 1, transport: () => ({ ok: false, error: "down" }), now: Date.now() });
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].action, "Report generated");
});

test("correlation order is preserved in the outbox worker", () => {
  const state = emptyState();
  recordAuditEvent(state, { action: "Report generated", details: "one", guarantee: "G2", correlationId: "c1", eventId: "e1" }, uid);
  recordAuditEvent(state, { action: "Report generated", details: "two", guarantee: "G2", correlationId: "c1", eventId: "e2" }, uid);
  const seen = [];
  processAuditOutbox(state, {
    transport: (item) => {
      seen.push(item.eventId);
      return { ok: true };
    }
  });
  assert.deepEqual(seen, ["e1", "e2"]);
});

test("timeline reconstructs entity history including related correlation", () => {
  const state = emptyState();
  recordAuditEvent(state, { action: "Customer Registered", details: "Ama", entityType: "customer", entityId: "c1", correlationId: "c1" }, uid);
  recordAuditEvent(state, { action: "Collection recorded", details: "20", entityType: "collection", entityId: "col1", correlationId: "c1" }, uid);
  const timeline = auditTimeline(state, "customer", "c1");
  assert.equal(timeline.length, 2);
});

test("retention archives expired operational rows and never deletes", () => {
  const state = emptyState();
  recordAuditEvent(state, {
    action: "Dashboard refresh",
    details: "old",
    category: "operational",
    guarantee: "G3",
    createdAt: new Date(Date.now() - 3000 * 86400000).toISOString()
  }, uid);
  const result = archiveExpiredAudit(state, { now: Date.now() });
  assert.equal(result.archived, 1);
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].archived, true);
  assert.equal(state.auditArchives.length, 1);
  assert.equal(deleteAuditEvent().ok, false);
});

test("compliance report and watermarked csv", () => {
  const state = emptyState();
  recordAuditEvent(state, { action: "Login Failure", details: "bad", username: "kofi" }, uid);
  recordAuditEvent(state, { action: "Collection recorded", details: "20", userId: "u1" }, uid);
  const failed = complianceReport(state, "failed-login");
  assert.equal(failed.length, 1);
  const csv = complianceCsv(failed, "CONFIDENTIAL · test");
  assert.match(csv, /CONFIDENTIAL/);
  assert.match(csv, /Login Failure/);
});

test("legacy rows without hash are not treated as tampered", () => {
  const state = emptyState();
  state.audit.push({ id: "legacy-1", action: "Old log", details: "pre-module", createdAt: "2024-01-01T00:00:00.000Z" });
  recordAuditEvent(state, { action: "Login Success", details: "john" }, uid);
  assert.equal(verifyAuditIntegrity(state, uid, { skipAlert: true }).ok, true);
});

test("immutable merge keeps the hashed original", () => {
  const local = [{ id: "a1", action: "x", hash: "abc", details: "original" }];
  const remote = [{ id: "a1", action: "x", hash: "abc", details: "changed" }];
  const merged = mergeAuditImmutable(local, remote);
  assert.equal(merged[0].details, "original");
});

test("financial events classify as G1 Class A", () => {
  const classified = classifyAuditAction("Loan Disbursement");
  assert.equal(classified.guarantee, "G1");
  assert.equal(classified.category, "financial");
});
