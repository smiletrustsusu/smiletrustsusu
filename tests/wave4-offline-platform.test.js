/**
 * Wave 4 — Offline platform + Capacitor shell tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  prioritizeQueueItems,
  queueItemPriority,
  PRIORITY_BANDS
} from "../src/sync/sync-priority.js";
import {
  scheduleQueueRetry,
  isRetryDue,
  classifySyncFailure,
  clearRetrySchedule
} from "../src/sync/sync-retry-policy.js";
import {
  buildConflictGuidance,
  allowedStrategiesForConflict
} from "../src/sync/conflict-guidance.js";
import {
  ensureWave4SyncState,
  runSyncPass,
  durablePersist,
  durableRecover,
  rememberUploadKey,
  wasUploadSeen,
  wave4SyncDashboard,
  resolveCollectorOfflineUx,
  noteConnectivity,
  offlineDurationHours,
  enqueueWithWave4,
  selectSyncCandidates
} from "../src/sync/offline-sync-engine.js";
import {
  WAVE4_WAVE,
  WAVE4_VERSION,
  runWave4Sync,
  wave4SmokeChecklist,
  createWave4Services
} from "../src/core/wave4-offline-ops.js";
import {
  getCapacitorRuntime,
  securePinSet,
  securePinVerify,
  setScreenshotProtection,
  documentWorkManagerBridge,
  shareReceiptNative,
  initCapacitorShell
} from "../src/platform/capacitor-shell.js";
import { setOfflineStorageAdapter } from "../src/core/offline-foundation.js";
import { renderOfflineStatusBanner, renderOfflineSyncPlatformPanel } from "../src/ui/offline-status-views.js";
import { bootstrapApiPlatform, resetApiPlatformForTests, invokeApi } from "../src/api/index.js";
import { listWaves, getWave } from "../src/core/enterprise-roadmap-registry.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const now = "2026-09-15T12:00:00.000Z";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

function blankState() {
  setOfflineStorageAdapter(memoryStorage());
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  return {
    settings: {
      encryptOfflineQueue: true,
      loanInterest: 15,
      collectionDays: 31,
      currency: "GHS",
      syncAccessKey: "test-sync-key"
    },
    users: [{ id: "u-owner", username: "john", role: "SystemOwner", systemOwner: true, active: true }],
    customers: [
      { id: "c-a", name: "Ama", active: true, phone: "024111" },
      { id: "c-b", name: "Kofi", active: true, phone: "024222" }
    ],
    collections: [],
    devices: [{ id: "dev-1", fingerprint: "fp-1", active: true, localSequence: 0, label: "Android" }],
    offlineQueue: [],
    auditEvents: [],
    notifications: []
  };
}

test("wave4 prioritizes financial collections ahead of metadata", () => {
  const items = [
    { id: "1", kind: "meeting", status: "pending", localSequence: 1 },
    { id: "2", kind: "collection", status: "pending", localSequence: 2 },
    { id: "3", kind: "customer", status: "pending", localSequence: 3 }
  ];
  const sorted = prioritizeQueueItems(items);
  assert.equal(sorted[0].kind, "collection");
  assert.equal(queueItemPriority({ kind: "collection", status: "pending" }), PRIORITY_BANDS.CRITICAL_FINANCIAL);
  assert.equal(queueItemPriority({ status: "conflict_detected" }), PRIORITY_BANDS.HELD_CONFLICT);
});

test("retry policy applies exponential backoff and holds conflicts", () => {
  const entry = { status: "failed", attempts: 0, lastError: "network timeout" };
  const scheduled = scheduleQueueRetry(entry, { now: Date.parse(now), random: () => 0.5 });
  assert.equal(scheduled.retryAllowed, true);
  assert.ok(scheduled.backoffSeconds >= 30);
  assert.equal(entry.status, "retrying");
  assert.ok(entry.nextRetryAt);

  const conflict = { status: "conflict_detected", attempts: 1 };
  const held = scheduleQueueRetry(conflict, { now: Date.parse(now), failureClass: "conflict" });
  assert.equal(held.retryAllowed, false);
  assert.equal(classifySyncFailure({ status: "conflict_detected" }), "conflict");
});

test("isRetryDue respects nextRetryAt", () => {
  const entry = { status: "retrying", nextRetryAt: "2026-09-15T13:00:00.000Z" };
  assert.equal(isRetryDue(entry, "2026-09-15T12:00:00.000Z"), false);
  assert.equal(isRetryDue(entry, "2026-09-15T14:00:00.000Z"), true);
  clearRetrySchedule(entry);
  assert.equal(isRetryDue(entry, now), true);
});

test("idempotent upload keys prevent duplicate remember", () => {
  const state = blankState();
  ensureWave4SyncState(state);
  assert.equal(rememberUploadKey(state, "KEY-1"), false);
  assert.equal(rememberUploadKey(state, "key-1"), true);
  assert.equal(wasUploadSeen(state, "KEY-1"), true);
});

test("offline sync pass defers when offline and persists queue", async () => {
  const store = memoryStorage();
  setOfflineStorageAdapter(store);
  globalThis.localStorage = store;
  const state = blankState();
  setOfflineStorageAdapter(store);
  globalThis.localStorage = store;
  enqueueWithWave4(state, {
    kind: "collection",
    idempotencyKey: "off-1",
    payload: { customerId: "c-a", id: "col-1", amount: 100 },
    deviceId: "dev-1"
  }, uid);
  const result = await runSyncPass(state, {
    mode: "manual",
    online: false,
    deviceId: "dev-1",
    uid,
    now,
    secret: "test-sync-key",
    fingerprint: "fp-1",
    applyFn: () => true,
    persist: true
  });
  assert.equal(result.deferred, true);
  assert.equal(result.collector.status, "Offline");
  assert.ok(result.collector.accessibilityLabel);
  assert.equal(result.collector.notColorAlone, true);

  const recoveredState = {
    settings: state.settings,
    offlineQueue: [],
    customers: state.customers,
    devices: state.devices,
    users: state.users,
    collections: [],
    auditEvents: [],
    notifications: []
  };
  setOfflineStorageAdapter(store);
  const rec = await durableRecover(recoveredState, { secret: "test-sync-key", fingerprint: "fp-1", uid, now });
  assert.ok(rec.ok);
  assert.ok((rec.recovered || 0) >= 1 || recoveredState.offlineQueue.length >= 1);
});

test("online sync pass applies idempotently via processSyncQueue", async () => {
  const state = blankState();
  enqueueWithWave4(state, {
    kind: "collection",
    idempotencyKey: "on-1",
    payload: { customerId: "c-a", id: "col-on-1", receiptNo: "RCP-1", temporaryReceiptNo: "RCP-1" },
    deviceId: "dev-1"
  }, uid);
  const first = await runSyncPass(state, {
    online: true,
    deviceId: "dev-1",
    user: state.users[0],
    uid,
    now,
    secret: "test-sync-key",
    fingerprint: "fp-1",
    applyFn: () => true,
    persist: false
  });
  assert.equal(first.ok, true);
  assert.equal(state.offlineQueue[0].status, "applied");
  const second = await runSyncPass(state, {
    online: true,
    deviceId: "dev-1",
    uid,
    now,
    applyFn: () => true,
    persist: false
  });
  assert.equal(state.offlineQueue.filter((i) => i.idempotencyKey === "on-1").length, 1);
  assert.ok(second.progress);
});

test("financial conflict guidance forbids client_wins", () => {
  const guidance = buildConflictGuidance(
    { id: "c1", reasons: ["duplicate_collection"], strategy: "business_rule" },
    { kind: "collection", id: "q1" }
  );
  assert.equal(guidance.financial, true);
  assert.equal(guidance.forbidClientWins, true);
  assert.ok(!guidance.allowedStrategies.includes("client_wins"));
  assert.equal(guidance.recommendedStrategy, "business_rule");
  assert.ok(allowedStrategiesForConflict({}, { kind: "meeting" }).includes("client_wins"));
});

test("collector UX and escalation helpers surface Phase 18 messages", () => {
  const state = blankState();
  noteConnectivity(state, { online: false, now: Date.parse(now) - 5 * 3600000 });
  const hours = offlineDurationHours(state, Date.parse(now));
  assert.ok(hours >= 4);
  const ux = resolveCollectorOfflineUx(state, { online: false, now });
  assert.equal(ux.status, "Offline");
  assert.ok(ux.message);
  assert.ok(ux.accessibilityLabel);
  assert.ok(ux.eod);
  const dash = wave4SyncDashboard(state, { online: false });
  assert.equal(dash.wave, WAVE4_WAVE);
  assert.ok(dash.collectorStatus.message || dash.collectorStatus.status);
});

test("status transitions and candidates skip future retries", async () => {
  const state = blankState();
  enqueueWithWave4(state, {
    kind: "collection",
    idempotencyKey: "retry-1",
    payload: { customerId: "c-a", id: "col-r" },
    deviceId: "dev-1"
  }, uid);
  const entry = state.offlineQueue[0];
  entry.status = "retrying";
  entry.nextRetryAt = "2099-01-01T00:00:00.000Z";
  const candidates = selectSyncCandidates(state, { deviceId: "dev-1", now });
  assert.equal(candidates.length, 0);
});

test("invokeApi sync.status/progress integrate with wave4 dashboard fields", async () => {
  resetApiPlatformForTests();
  const state = blankState();
  ensureWave4SyncState(state);
  bootstrapApiPlatform(state);
  const user = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
  const status = await invokeApi(state, { operationId: "v1/sync.status" }, { user, uid, now });
  assert.equal(status.ok, true);
  const progress = await invokeApi(state, { operationId: "v1/sync.progress" }, { user, uid, now });
  assert.equal(progress.ok, true);
  assert.ok(progress.data);
  assert.ok(typeof progress.data.pendingCount === "number" || progress.data.ok === true);
  assert.ok(status.data);
});

test("capacitor shell degrades without native plugins", async () => {
  const runtime = getCapacitorRuntime();
  assert.equal(runtime.isNative, false);
  const pin = await securePinSet("1234");
  assert.equal(pin.ok, true);
  const verify = await securePinVerify("1234");
  assert.equal(verify.ok, true);
  const bad = await securePinVerify("9999");
  assert.equal(bad.matched, false);
  const shot = await setScreenshotProtection(true);
  assert.equal(shot.ok, true);
  const wm = documentWorkManagerBridge();
  assert.equal(wm.primary, "js-sync-engine");
  const share = await shareReceiptNative({ title: "t", text: "hello" });
  assert.ok(share.ok === false || share.ok === true);
  const state = blankState();
  const init = await initCapacitorShell(state, { fingerprint: "fp-1" });
  assert.equal(init.ok, true);
});

test("UI banner includes accessibility label (not color alone)", () => {
  const html = renderOfflineStatusBanner({
    status: "Offline",
    shortLabel: "Offline",
    message: "You are offline. Collections will queue.",
    accessibilityLabel: "Connection status: offline",
    colorHint: "amber",
    progress: { pending: 2, progressPct: 10 }
  });
  assert.ok(html.includes("aria-label"));
  assert.ok(html.includes("Connection status: offline"));
  assert.ok(html.includes("role=\"status\""));
  const panel = renderOfflineSyncPlatformPanel({
    dashboard: { pending: 2, conflicts: 0, progress: { progressPct: 10, stage: "Queued", engineStatus: "idle" } },
    ux: { status: "Offline", shortLabel: "Offline", message: "Offline", accessibilityLabel: "Connection status: offline", colorHint: "amber" }
  });
  assert.ok(panel.includes("Offline sync platform"));
  assert.ok(panel.includes("Accessibility"));
});

test("wave4 facade smoke checklist and services", () => {
  const state = blankState();
  const checklist = wave4SmokeChecklist(state, { online: true });
  assert.equal(checklist.wave, WAVE4_WAVE);
  assert.equal(checklist.architecture, "capacitor-shared-spa");
  assert.equal(checklist.notComposeRewrite, true);
  assert.equal(checklist.moneyDefaults.interest, 15);
  assert.equal(checklist.moneyDefaults.collectionDays, 31);
  assert.equal(checklist.moneyDefaults.cashierLimitGhs, 1000);
  const services = createWave4Services(state, { uid, now, user: state.users[0] });
  assert.equal(services.version, WAVE4_VERSION);
  assert.ok(services.dashboard());
});

test("docs and android scaffolding exist", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "docs/wave4-android-offline.md")));
  assert.ok(fs.existsSync(path.join(ROOT, "android/README.md")));
  assert.ok(fs.existsSync(path.join(ROOT, "android/plugins-src/SmileTrustSecure/SmileTrustSecurePlugin.kt")));
  assert.ok(fs.existsSync(path.join(ROOT, "src/sync/offline-sync-engine.js")));
});

test("WAVE-04 registry notes reference wave4 delivery", () => {
  const wave = getWave(4) || getWave("WAVE-04") || listWaves().find((w) => w.waveNumber === 4);
  assert.ok(wave);
  assert.equal(wave.waveStatus, "Mostly Complete");
  assert.ok(String(wave.notes || "").includes("Capacitor") || String(wave.notes || "").includes("wave4-android-offline"));
});
