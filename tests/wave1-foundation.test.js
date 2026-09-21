/**
 * Wave 1 foundation pack — unit/integration smoke for new foundation modules.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/password.js";
import {
  buildFoundationError,
  handleFoundationError,
  clearRecentFoundationErrors,
  isRetryableError,
  userFacingMessage,
  withFoundationErrorBoundary,
  FOUNDATION_ERROR_CATALOG
} from "../src/core/foundation-errors.js";
import {
  logFoundation,
  listLogsByCategory,
  LOG_CATEGORIES
} from "../src/core/foundation-logging.js";
import {
  assertNoPlaintextSecrets,
  redactSecrets,
  createSecureApiClient
} from "../src/core/secure-storage.js";
import {
  persistOfflineQueue,
  recoverOfflineQueue,
  setEncryptedLocalCache,
  getEncryptedLocalCache,
  setOfflineStorageAdapter,
  offlineFoundationDashboard
} from "../src/core/offline-foundation.js";
import {
  authenticateLocal,
  logoutLocal,
  requestPasswordReset,
  completePasswordReset,
  listAuthRoles,
  assertActionAllowed
} from "../src/core/auth-session-ops.js";
import {
  FOUNDATION_VERSION,
  resolveFoundationContext,
  createFoundationServices,
  installFoundationErrorBridge,
  foundationSmokeChecklist,
  SUPER_ADMIN_FORBIDDEN
} from "../src/core/foundation-ops.js";
import { canAction, isForbiddenForSuperAdmin } from "../src/core/rbac.js";
import { ensureMonitoringState } from "../src/core/monitoring-ops.js";
import { ensureSystemConfig } from "../src/core/system-config.js";
import { stButton, stPanel, renderFoundationStatusPanel } from "../src/ui/shared-primitives.js";
import { listBacklogForWave } from "../src/core/enterprise-roadmap-registry.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-t`;
const now = "2026-09-15T12:00:00.000Z";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

function mockSessionStorage() {
  const store = memoryStorage();
  globalThis.sessionStorage = store;
  return store;
}

async function blankState() {
  mockSessionStorage();
  const passwordHash = await hashPassword("SecretPass1");
  const state = {
    settings: { loanInterest: 15, collectionDays: 31, currency: "GHS", sessionTimeoutMinutes: 480 },
    users: [
      {
        id: "u-owner",
        username: "john",
        role: "SystemOwner",
        systemOwner: true,
        active: true,
        passwordHash
      },
      {
        id: "u-kba",
        username: "kba",
        role: "KBA",
        active: true,
        passwordHash
      },
      {
        id: "u-admin",
        username: "ama",
        role: "Admin",
        branchId: "br-1",
        active: true,
        passwordHash
      }
    ],
    branches: [{ id: "br-1", name: "Accra", status: "Active", active: true }],
    audit: [],
    offlineQueue: [],
    devices: [],
    collections: [],
    customers: [],
    loans: []
  };
  ensureSystemConfig(state);
  ensureMonitoringState(state);
  return state;
}

test("foundation error catalog covers categories and retry flags", () => {
  assert.ok(FOUNDATION_ERROR_CATALOG.length >= 10);
  const locked = buildFoundationError("FND-003");
  assert.equal(locked.retryable, true);
  assert.equal(isRetryableError(locked), true);
  assert.match(userFacingMessage(locked), /locked/i);
  clearRecentFoundationErrors();
  const handled = handleFoundationError(new Error("boom"), { code: "FND-014", source: "test" });
  assert.equal(handled.errorCode, "FND-014");
  const guarded = withFoundationErrorBoundary(() => {
    throw new Error("fail");
  }, { code: "FND-014" });
  const out = guarded();
  assert.equal(out.ok, false);
});

test("structured logging categories are recorded", async () => {
  const state = await blankState();
  for (const category of LOG_CATEGORIES) {
    logFoundation(state, { category, message: category + " msg", payload: { category } }, uid, now);
  }
  assert.equal(listLogsByCategory(state, "security").length >= 1, true);
  assert.equal(listLogsByCategory(state, "sync").length >= 1, true);
  assert.equal(listLogsByCategory(state, "error").length >= 1, true);
});

test("secure storage rejects plaintext secrets and redacts", () => {
  const bad = assertNoPlaintextSecrets({ password: "plain" });
  assert.equal(bad.ok, false);
  const ok = assertNoPlaintextSecrets({ passwordHash: "pbkdf2:1:aa:bb", note: "x" });
  assert.equal(ok.ok, true);
  const redacted = redactSecrets({ token: "abc", nested: { apiKey: "k" } });
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.nested.apiKey, "[REDACTED]");
  const client = createSecureApiClient({
    invoke: async (name, input) => ({ ok: true, name, input }),
    getToken: () => "t"
  });
  assert.equal(typeof client.call, "function");
});

test("auth login/logout/password reset and SUPER_ADMIN_FORBIDDEN", async () => {
  const state = await blankState();
  const fail = await authenticateLocal(state, { username: "ama", password: "wrong" }, uid, now);
  assert.equal(fail.ok, false);
  assert.equal(fail.errorCode, "FND-002");
  assert.ok((state.audit || []).some((a) => /login fail/i.test(a.action || a.type || "") || /Login Failure/i.test(a.action || "")));

  const ok = await authenticateLocal(state, {
    username: "ama",
    password: "SecretPass1",
    device: { id: "dev-1", platform: "web" }
  }, uid, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.user.role, "Admin");
  assert.ok((state.devices || []).some((d) => d.id === "dev-1"));

  const roles = listAuthRoles();
  assert.equal(roles.legacy.Admin, "Branch Manager");
  assert.deepEqual(roles.superAdminForbidden, SUPER_ADMIN_FORBIDDEN.slice());

  const kba = state.users.find((u) => u.role === "KBA");
  assert.equal(canAction(kba, "Owner.Transfer"), false);
  assert.equal(isForbiddenForSuperAdmin(kba, "System.Reset"), true);
  assert.equal(assertActionAllowed(kba, "Export.All").errorCode, "FND-006");

  const issued = await requestPasswordReset(state, { username: "ama" }, uid, now);
  assert.equal(issued.ok, true);
  assert.equal(issued.issued, true);
  const reset = await completePasswordReset(state, { token: issued.token, newPassword: "NewSecret99" }, uid, now);
  assert.equal(reset.ok, true);

  const out = logoutLocal(state, { user: ok.user, sessionId: ok.session.id }, uid, now);
  assert.equal(out.ok, true);
});

test("offline queue persist/recover foundation (no business sync)", async () => {
  const store = memoryStorage();
  setOfflineStorageAdapter(store);
  const state = await blankState();
  state.offlineQueue.push({
    id: "q1",
    idempotencyKey: "idem-1",
    kind: "ping",
    status: "pending",
    payload: { hello: 1 }
  });
  const persisted = await persistOfflineQueue(state, { uid, now });
  assert.equal(persisted.ok, true);
  assert.equal(persisted.count, 1);

  const state2 = await blankState();
  setOfflineStorageAdapter(store);
  const recovered = await recoverOfflineQueue(state2, { uid, now });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.recovered, 1);

  const cacheSet = await setEncryptedLocalCache(state2, "branch:br-1", { name: "Accra" }, { uid, now });
  assert.equal(cacheSet.ok, true);
  const cacheGet = await getEncryptedLocalCache(state2, "branch:br-1");
  assert.equal(cacheGet.ok, true);
  assert.equal(cacheGet.value.name, "Accra");
  assert.equal(offlineFoundationDashboard(state2).total >= 1, true);
  setOfflineStorageAdapter(null);
});

test("foundation facade context, services, monitoring bridge, UI primitives", async () => {
  const state = await blankState();
  mockSessionStorage();
  installFoundationErrorBridge(state, { uid });
  const ctx = resolveFoundationContext(state, state.users[2]);
  assert.equal(ctx.wave, "WAVE-01");
  assert.equal(ctx.version, FOUNDATION_VERSION);
  assert.equal(ctx.branchId, "br-1");
  assert.equal(ctx.moneyDefaults, undefined);
  assert.equal(Number(foundationSmokeChecklist(state, state.users[0]).moneyDefaults.loanInterest), 15);
  assert.equal(Number(foundationSmokeChecklist(state).moneyDefaults.collectionDays), 31);
  assert.equal(Number(foundationSmokeChecklist(state).moneyDefaults.cashierLimitGhs), 1000);

  const services = createFoundationServices(state, { uid, now, actor: state.users[0] });
  assert.equal(services.rbac.can("Platform.View"), true);
  services.monitoring.log({ category: "app", message: "hello" });
  handleFoundationError(new Error("bridge"), { code: "FND-014" });
  assert.ok((state.logEntries || []).some((row) => String(row.message || "").includes("bridge") || row.payload?.errorCode === "FND-014"));

  const html = stPanel({ title: "T", body: stButton({ label: "Go", action: "x" }) });
  assert.match(html, /class="panel"/);
  assert.match(html, /class="btn"/);
  assert.match(renderFoundationStatusPanel(foundationSmokeChecklist(state)), /Foundation platform/);
});

test("wave1 docs and folder layout exist", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "docs", "wave1-foundation.md")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "db", "README.md")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "deploy", "README.md")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "android", "README.md")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "electron")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "tests")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "scripts")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "docs")), true);
});

test("WAVE-01 backlog hardening items for foundation modules are Completed", () => {
  const items = listBacklogForWave("WAVE-01");
  const hardening = items.filter((i) =>
    /Integration & Hardening/i.test(i.title) &&
    ["MOD-001", "MOD-005", "MOD-013", "MOD-014", "MOD-023", "MOD-024", "MOD-030"].includes(i.module)
  );
  assert.ok(hardening.length >= 7);
  for (const item of hardening) {
    assert.equal(item.status, "Completed", item.identifier + " " + item.title);
  }
});
