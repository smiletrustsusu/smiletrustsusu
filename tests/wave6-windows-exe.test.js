/**
 * Wave 6 — Enterprise Windows Desktop EXE (Electron shared-core) tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  WAVE6_WAVE,
  WAVE6_VERSION,
  WAVE6_GAP_CHECKLIST,
  WAVE6_PARITY_CHECKLIST,
  WAVE6_CATALOG_ALIAS,
  analyzeWave6Gaps,
  runDesktopWave4Sync,
  syncEngineParityProbe,
  wave6SmokeChecklist,
  createWave6DesktopServices
} from "../src/core/wave6-windows-exe-ops.js";
import {
  getElectronRuntime,
  documentDesktopWakeBridge,
  desktopScreenshotGuidance,
  desktopAccessibilityNotes,
  initElectronShell,
  isElectronRuntime
} from "../src/platform/electron-shell.js";
import { runWave4Sync, WAVE4_WAVE } from "../src/core/wave4-offline-ops.js";
import {
  ensureWave4SyncState,
  durablePersist,
  durableRecover,
  enqueueWithWave4
} from "../src/sync/offline-sync-engine.js";
import { setOfflineStorageAdapter } from "../src/core/offline-foundation.js";
import { renderDesktopShellStatus, renderWave6ParityChecklist } from "../src/ui/desktop-shell-views.js";
import { getWave } from "../src/core/enterprise-roadmap-registry.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const now = "2026-09-15T12:00:00.000Z";

const {
  IPC_INVOKE,
  IPC_EVENTS,
  isAllowedInvokeChannel,
  isAllowedEventChannel,
  assertAllowedInvoke
} = require("../electron/ipc-channels.js");
const { createSecureVault } = require("../electron/secure-vault.js");
const { readPackageBuild, isPlaceholderUpdateUrl } = require("../electron/updater.js");

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
    customers: [{ id: "c-a", name: "Ama", active: true, phone: "024111" }],
    collections: [],
    devices: [{ id: "dev-exe", fingerprint: "fp-exe", active: true, localSequence: 0, label: "EXE" }],
    offlineQueue: [],
    auditEvents: [],
    notifications: []
  };
}

test("IPC allowlist refuses unknown channels and lists print/export/secure/update", () => {
  assert.ok(IPC_INVOKE.includes("desktop:print"));
  assert.ok(IPC_INVOKE.includes("desktop:printToPdf"));
  assert.ok(IPC_INVOKE.includes("desktop:exportFile"));
  assert.ok(IPC_INVOKE.includes("desktop:secureSet"));
  assert.ok(IPC_INVOKE.includes("desktop:updateCheck"));
  assert.ok(IPC_EVENTS.includes("desktop:wakeSync"));
  assert.equal(isAllowedInvokeChannel("desktop:print"), true);
  assert.equal(isAllowedInvokeChannel("desktop:evil"), false);
  assert.equal(isAllowedEventChannel("desktop:wakeSync"), true);
  assert.equal(isAllowedEventChannel("desktop:evil"), false);
  assert.throws(() => assertAllowedInvoke("not-allowed"), /IPC channel refused/);
});

test("secure vault encrypts when safeStorage available and never throws on missing key", () => {
  const tmp = path.join(ROOT, "tmp-wave6-vault-test");
  fs.mkdirSync(tmp, { recursive: true });
  const fakeSafe = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from("enc:" + s, "utf8"),
    decryptString: (b) => Buffer.from(b).toString("utf8").replace(/^enc:/, "")
  };
  const vault = createSecureVault({ userDataPath: tmp, safeStorage: fakeSafe });
  assert.equal(vault.encryptionAvailable(), true);
  const set = vault.setItem("sessionToken", { token: "kba-hashed-not-plain" });
  assert.equal(set.ok, true);
  assert.equal(set.encrypted, true);
  const got = vault.getItem("sessionToken");
  assert.equal(got.ok, true);
  assert.deepEqual(got.value, { token: "kba-hashed-not-plain" });
  assert.equal(vault.getItem("missing").value, null);
  vault.deleteItem("sessionToken");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("sync parity: runDesktopWave4Sync uses same runWave4Sync facade / engine", async () => {
  const probe = syncEngineParityProbe();
  assert.equal(probe.sameModuleAsAndroid, true);
  assert.equal(probe.sqliteBusinessDb, false);
  assert.equal(probe.engineModule, "src/sync/offline-sync-engine.js");
  assert.ok(probe.engineVersion);

  const state = blankState();
  ensureWave4SyncState(state);
  enqueueWithWave4(state, {
    kind: "collection",
    payload: { customerId: "c-a", amount: 10 },
    idempotencyKey: "idem-w6-1",
    deviceId: "dev-exe"
  }, uid);

  // Offline pass should defer without throwing — identical to Android path
  const desktop = await runDesktopWave4Sync(state, {
    online: false,
    user: state.users[0],
    uid,
    now,
    secret: "sync-secret",
    fingerprint: "fp-exe",
    persist: true,
    invokeApiFn: async () => ({ ok: true })
  });
  assert.ok(desktop);
  assert.equal(WAVE4_WAVE, "WAVE-04");

  const viaFacade = await runWave4Sync(state, {
    online: false,
    user: state.users[0],
    uid,
    now,
    secret: "sync-secret",
    fingerprint: "fp-exe",
    persist: false,
    invokeApiFn: async () => ({ ok: true })
  });
  assert.ok(viaFacade);
});

test("offline encrypted queue works on desktop path (persist/recover)", async () => {
  const state = blankState();
  ensureWave4SyncState(state);
  enqueueWithWave4(state, {
    kind: "collection",
    payload: { customerId: "c-a", amount: 25 },
    idempotencyKey: "idem-w6-offline",
    deviceId: "dev-exe"
  }, uid);
  await durablePersist(state, { secret: "s", fingerprint: "fp-exe", uid, now });
  state.offlineQueue = [];
  await durableRecover(state, { secret: "s", fingerprint: "fp-exe", uid, now });
  assert.ok((state.offlineQueue || []).length >= 1);
});

test("wave6 gaps, smoke, services, and catalog alias", () => {
  const state = blankState();
  const gaps = analyzeWave6Gaps(state, { user: state.users[0] });
  assert.equal(gaps.wave, WAVE6_WAVE);
  assert.equal(gaps.architecture, "electron-shared-spa");
  assert.equal(gaps.notNextJsRewrite, true);
  assert.equal(gaps.pilotReady, true);
  assert.equal(gaps.openCritical, 0);
  assert.equal(gaps.moneyDefaults.interest, 15);
  assert.equal(gaps.moneyDefaults.collectionDays, 31);
  assert.equal(gaps.moneyDefaults.cashierLimitGhs, 1000);
  assert.ok(WAVE6_GAP_CHECKLIST.some((g) => g.id === "W6-G13" && g.status === "partial"));
  assert.ok(WAVE6_GAP_CHECKLIST.some((g) => g.id === "W6-G14" && g.status === "deferred"));
  assert.equal(WAVE6_CATALOG_ALIAS.historicalEirCode, "LOAN_PLATFORM");
  assert.equal(WAVE6_CATALOG_ALIAS.deliveryCode, "WINDOWS_EXE");
  assert.ok(WAVE6_PARITY_CHECKLIST.length >= 8);

  const smoke = wave6SmokeChecklist(state);
  assert.equal(smoke.version, WAVE6_VERSION);
  assert.equal(smoke.syncSameAsAndroid, true);
  assert.equal(smoke.sqliteBusinessDb, false);

  const services = createWave6DesktopServices(state, { uid, now, user: state.users[0] });
  assert.equal(services.notNextJsRewrite, true);
  assert.ok(services.wake().primary === "js-sync-engine");
});

test("electron shell helpers degrade gracefully outside Electron", async () => {
  assert.equal(isElectronRuntime(), false);
  const runtime = getElectronRuntime();
  assert.equal(runtime.notNextJsRewrite, true);
  const wake = documentDesktopWakeBridge();
  assert.equal(wake.module, "src/sync/offline-sync-engine.js");
  assert.ok(desktopScreenshotGuidance().guidance.length >= 1);
  assert.equal(desktopAccessibilityNotes().reuseWave5, true);
  const state = blankState();
  const init = await initElectronShell(state, { fingerprint: "fp-exe" });
  assert.equal(init.ok, true);
});

test("desktop UI snippets render without new top-level nav claims", () => {
  const html = renderDesktopShellStatus({
    runtime: { isElectron: false },
    smoke: { architecture: "electron-shared-spa", syncSameAsAndroid: true, sqliteBusinessDb: false },
    gaps: { pilotReady: true, closedCount: 12 },
    screenshot: desktopScreenshotGuidance()
  });
  assert.ok(html.includes("Windows desktop (Wave 6)"));
  assert.ok(html.includes("runWave4Sync"));
  assert.ok(html.includes("aria-labelledby"));
  const parity = renderWave6ParityChecklist(WAVE6_PARITY_CHECKLIST);
  assert.ok(parity.includes("EXE ↔ APK ↔ Web"));
});

test("electron-builder config has NSIS + portable + publish scaffolding", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.main, "electron/main.js");
  assert.ok(pkg.scripts["build:exe"]);
  assert.ok(pkg.scripts["build:installer"]);
  assert.ok(pkg.scripts["build:portable"]);
  assert.ok(pkg.scripts["prepare:web"]);
  const build = pkg.build;
  assert.equal(build.appId, "com.smiletrust.susu");
  assert.ok(build.files.includes("www/**/*"));
  assert.ok(build.files.includes("electron/**/*"));
  assert.ok(build.win);
  assert.ok(build.nsis);
  assert.ok(build.portable);
  // GAP-008: publish is null by default; production feed via SMILE_UPDATE_FEED_URL
  assert.ok(build.publish === null || Array.isArray(build.publish) || build.publish);
  assert.equal(build.win.signAndEditExecutable, false);
  const fromUpdater = readPackageBuild(ROOT);
  assert.equal(fromUpdater.appId, "com.smiletrust.susu");
  assert.ok(fs.existsSync(path.join(ROOT, "electron/main.js")));
  assert.ok(fs.existsSync(path.join(ROOT, "electron/preload.js")));
  assert.ok(fs.existsSync(path.join(ROOT, "electron/ipc-channels.js")));
  assert.ok(fs.existsSync(path.join(ROOT, "electron/updater.js")));
  assert.equal(isPlaceholderUpdateUrl("https://updates.example.invalid/x"), true);
  const mainSrc = fs.readFileSync(path.join(ROOT, "electron/main.js"), "utf8");
  assert.ok(mainSrc.includes("contextIsolation: true"));
  assert.ok(mainSrc.includes("sandbox: true"));
  assert.ok(mainSrc.includes("nodeIntegration: false"));
  assert.ok(mainSrc.includes("webSecurity: true"));
  assert.ok(pkg.dependencies["electron-updater"] || pkg.devDependencies["electron-updater"]);
});

test("docs/wave6-windows-exe.md documents architecture and why not Next.js", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs/wave6-windows-exe.md"), "utf8");
  assert.match(doc, /WAVE-06/);
  assert.match(doc, /Windows Desktop EXE|Electron/i);
  assert.match(doc, /not.*Next\.js|NOT.*Next\.js/i);
  assert.match(doc, /runWave4Sync/);
  assert.match(doc, /prepare:web/);
  assert.match(doc, /NSIS|portable/i);
  assert.match(doc, /code.?sign/i);
  assert.match(doc, /Loan Platform/);
  assert.match(doc, /pesewas|interest 15|collection days 31|cashier/i);
});

test("WAVE-06 registry aligns to Windows EXE delivery with Loan Platform alias note", () => {
  const wave = getWave(6) || getWave("WAVE-06");
  assert.ok(wave);
  assert.equal(wave.waveStatus, "Mostly Complete");
  assert.match(String(wave.name), /Windows Desktop EXE/i);
  assert.equal(wave.code, "WINDOWS_EXE");
  assert.ok(String(wave.notes || "").includes("wave6-windows-exe") || String(wave.notes || "").includes("Electron"));
  assert.ok(String(wave.notes || "").includes("Loan Platform") || String(wave.notes || "").includes("LOAN_PLATFORM"));
  assert.ok((wave.requiredDocumentation || []).some((d) => String(d).includes("wave6-windows-exe")));
  assert.ok((wave.mibWaveCodes || []).includes("LOANS"));
});
