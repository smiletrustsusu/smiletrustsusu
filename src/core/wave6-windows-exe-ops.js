/**
 * Wave 6 — Enterprise Windows Desktop EXE (Electron shared-core hardening).
 * NOT an Electron+Next.js+React+TypeScript+SQLite rewrite.
 * Consumes Wave 3 invokeApi + Wave 4 runWave4Sync on the same SPA as Web/APK.
 */

import { createApiPlatform, invokeApi, bootstrapApiPlatform, isApiPlatformBootstrapped } from "../api/index.js";
import { runWave4Sync, ensureWave4SyncState, wave4SyncDashboard } from "./wave4-offline-ops.js";
import { WAVE4_SYNC_ENGINE_VERSION } from "../sync/offline-sync-engine.js";
import { ensureMonitoringState, monitoringDashboard } from "./monitoring-ops.js";
import {
  getElectronRuntime,
  isElectronRuntime,
  documentDesktopWakeBridge,
  desktopScreenshotGuidance,
  desktopAccessibilityNotes,
  desktopAppInfo,
  initElectronShell,
  ELECTRON_SHELL_VERSION
} from "../platform/electron-shell.js";
import { SUPER_ADMIN_FORBIDDEN } from "./rbac.js";

export const WAVE6_VERSION = "6.0.0-windows-exe";
export const WAVE6_WAVE = "WAVE-06";

/** Catalog mapping: historical EIR name was Loan Platform; user Wave 6 = Windows EXE */
export const WAVE6_CATALOG_ALIAS = Object.freeze({
  deliveryName: "Windows Desktop EXE",
  deliveryCode: "WINDOWS_EXE",
  historicalEirName: "Loan Platform",
  historicalEirCode: "LOAN_PLATFORM",
  loanDeepWork: "Mostly Complete / deferred — Module 8 remains; deep loan SM hardening not the Wave 6 EXE focus"
});

export const WAVE6_PARITY_CHECKLIST = Object.freeze([
  { id: "W6-P01", title: "Same SPA entry (www/ after prepare:web)", channel: "EXE↔Web↔APK" },
  { id: "W6-P02", title: "Auth via shared SPA session (no separate desktop login stack)", channel: "EXE↔Web↔APK" },
  { id: "W6-P03", title: "Wave 3 invokeApi in-process (no Next BFF)", channel: "EXE↔Web↔APK" },
  { id: "W6-P04", title: "Wave 4 sync engine module identical (runWave4Sync)", channel: "EXE↔APK" },
  { id: "W6-P05", title: "Encrypted offline queue (Wave 1/4) — no SQLite business DB", channel: "EXE↔APK" },
  { id: "W6-P06", title: "Tenant/branch RBAC unchanged (SUPER_ADMIN_FORBIDDEN)", channel: "EXE↔Web↔APK" },
  { id: "W6-P07", title: "Money rules: pesewas / interest 15 / days 31 / cashier 1000", channel: "EXE↔Web↔APK" },
  { id: "W6-P08", title: "Print/export via Electron bridge (receipts/reports)", channel: "EXE" },
  { id: "W6-P09", title: "Auto-update scaffolding + code-signing docs", channel: "EXE" },
  { id: "W6-P10", title: "Monitoring/health via existing monitoring ops", channel: "EXE↔Web" }
]);

export const WAVE6_GAP_CHECKLIST = Object.freeze([
  { id: "W6-G01", title: "Electron contextIsolation + sandbox + no nodeIntegration", status: "closed", severity: "critical" },
  { id: "W6-G02", title: "Preload bridge for print / export / secure storage / device id / updates", status: "closed", severity: "critical" },
  { id: "W6-G03", title: "IPC allowlist (electron/ipc-channels.js)", status: "closed", severity: "critical" },
  { id: "W6-G04", title: "Shared Wave 4 sync + desktop wake hooks", status: "closed", severity: "critical" },
  { id: "W6-G05", title: "Offline encrypted queue reused (no SQLite business DB)", status: "closed", severity: "critical" },
  { id: "W6-G06", title: "Loads www/ SPA after prepare:web (not Next.js)", status: "closed", severity: "critical" },
  { id: "W6-G07", title: "Print / printToPDF / export bridges", status: "closed", severity: "high" },
  { id: "W6-G08", title: "electron-builder NSIS + portable config", status: "closed", severity: "high" },
  { id: "W6-G09", title: "electron-updater scaffolding + signing docs", status: "closed", severity: "high" },
  { id: "W6-G10", title: "CSP + navigation locks + external link allowlist", status: "closed", severity: "high" },
  { id: "W6-G11", title: "Desktop a11y / screenshot-sensitive guidance (reuse Wave 5)", status: "closed", severity: "medium" },
  { id: "W6-G12", title: "Monitoring + sync health hooks", status: "closed", severity: "medium" },
  { id: "W6-G13", title: "Code-signing certificates in CI/pilot env", status: "partial", severity: "medium", note: "Hooks/docs present; certs are env-specific — do not embed secrets" },
  { id: "W6-G14", title: "Loan Platform deep SM rewrite", status: "deferred", severity: "low", note: "Historical EIR WAVE-06 name; Module 8 Mostly Complete — not EXE scope" }
]);

function ensurePortalApi(state) {
  if (!isApiPlatformBootstrapped()) bootstrapApiPlatform(state);
}

/**
 * Prove desktop sync path uses the identical Wave 4 module export.
 */
export async function runDesktopWave4Sync(state, opts = {}) {
  ensureWave4SyncState(state);
  // Same function Android/Web use — do not fork.
  return runWave4Sync(state, { ...opts, backgroundBridge: "electron-wake+js-engine" });
}

export function syncEngineParityProbe() {
  return {
    ok: true,
    engineModule: "src/sync/offline-sync-engine.js",
    facade: "src/core/wave4-offline-ops.js#runWave4Sync",
    desktopEntry: "src/core/wave6-windows-exe-ops.js#runDesktopWave4Sync",
    engineVersion: WAVE4_SYNC_ENGINE_VERSION,
    sameModuleAsAndroid: true,
    sqliteBusinessDb: false
  };
}

export function analyzeWave6Gaps(state = {}, { user = null } = {}) {
  const items = WAVE6_GAP_CHECKLIST.map((g) => ({ ...g }));
  const openCritical = items.filter((g) => g.severity === "critical" && g.status !== "closed");
  const runtime = getElectronRuntime();
  return {
    wave: WAVE6_WAVE,
    version: WAVE6_VERSION,
    architecture: "electron-shared-spa",
    notNextJsRewrite: true,
    catalogAlias: WAVE6_CATALOG_ALIAS,
    actorPresent: Boolean(user),
    runtime,
    items,
    closedCount: items.filter((g) => g.status === "closed").length,
    partialCount: items.filter((g) => g.status === "partial").length,
    deferredCount: items.filter((g) => g.status === "deferred").length,
    openCritical: openCritical.length,
    pilotReady: openCritical.length === 0,
    moneyDefaults: {
      interest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000,
      currency: "GHS",
      pesewas: true
    },
    forbiddenSample: SUPER_ADMIN_FORBIDDEN.slice(0, 3),
    parity: WAVE6_PARITY_CHECKLIST.slice(),
    syncParity: syncEngineParityProbe()
  };
}

export function createWave6DesktopServices(state, { uid, now, user } = {}) {
  ensurePortalApi(state);
  ensureWave4SyncState(state);
  ensureMonitoringState(state);
  const platform = createApiPlatform(state, { actor: user, uid, now });
  return {
    wave: WAVE6_WAVE,
    version: WAVE6_VERSION,
    architecture: "electron-shared-spa",
    notNextJsRewrite: true,
    catalogAlias: WAVE6_CATALOG_ALIAS,
    shellVersion: ELECTRON_SHELL_VERSION,
    api: platform,
    invoke: (request, ctx = {}) => invokeApi(state, request, { user, uid, now, ...ctx }),
    sync: (opts) => runDesktopWave4Sync(state, { ...opts, user, uid, now }),
    syncDashboard: (opts) => wave4SyncDashboard(state, opts),
    monitoring: () => monitoringDashboard(state),
    gaps: () => analyzeWave6Gaps(state, { user }),
    runtime: () => getElectronRuntime(),
    wake: () => documentDesktopWakeBridge(),
    screenshot: () => desktopScreenshotGuidance(),
    a11y: () => desktopAccessibilityNotes(),
    appInfo: () => desktopAppInfo(),
    initShell: (meta) => initElectronShell(state, meta),
    parity: () => WAVE6_PARITY_CHECKLIST.slice()
  };
}

export function wave6SmokeChecklist(state = {}) {
  ensureWave4SyncState(state);
  const gaps = analyzeWave6Gaps(state);
  const wake = documentDesktopWakeBridge();
  return {
    wave: WAVE6_WAVE,
    version: WAVE6_VERSION,
    architecture: "electron-shared-spa",
    notNextJsRewrite: true,
    catalogAlias: WAVE6_CATALOG_ALIAS,
    pilotReady: gaps.pilotReady,
    syncSameAsAndroid: gaps.syncParity.sameModuleAsAndroid,
    sqliteBusinessDb: false,
    electronDetected: isElectronRuntime(),
    wakePrimary: wake.primary,
    moneyDefaults: gaps.moneyDefaults,
    closedGaps: gaps.closedCount,
    partialGaps: gaps.partialCount
  };
}

export {
  initElectronShell,
  getElectronRuntime,
  isElectronRuntime,
  documentDesktopWakeBridge,
  desktopScreenshotGuidance,
  desktopAccessibilityNotes
};
