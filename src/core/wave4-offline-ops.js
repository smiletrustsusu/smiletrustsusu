/**
 * Wave 4 — Offline Platform facade (Capacitor + shared JS core).
 * NOT a Kotlin/Compose rewrite. Consumes Wave 3 invokeApi sync ops.
 */

import { invokeApi, createApiPlatform } from "../api/index.js";
import {
  WAVE4_SYNC_ENGINE_VERSION,
  WAVE4_WAVE,
  ensureWave4SyncState,
  runSyncPass,
  durablePersist,
  durableRecover,
  wave4SyncDashboard,
  resolveCollectorOfflineUx,
  noteConnectivity,
  offlineDurationHours,
  enqueueWithWave4,
  conflictGuidanceRows
} from "../sync/offline-sync-engine.js";
import { evaluateOfflineEscalation, evaluateEodDecision, evaluateDecisionFlow } from "./phase18-ops-sla.js";
import {
  getCapacitorRuntime,
  ensureDeviceRegistration,
  setScreenshotProtection,
  securePinSet,
  securePinVerify,
  biometricAvailable,
  biometricUnlock,
  shareReceiptNative,
  notifyLocal,
  documentWorkManagerBridge,
  initCapacitorShell
} from "../platform/capacitor-shell.js";

export const WAVE4_VERSION = WAVE4_SYNC_ENGINE_VERSION;
export { WAVE4_WAVE };

export {
  ensureWave4SyncState,
  runSyncPass,
  durablePersist,
  durableRecover,
  wave4SyncDashboard,
  resolveCollectorOfflineUx,
  noteConnectivity,
  offlineDurationHours,
  enqueueWithWave4,
  conflictGuidanceRows,
  evaluateOfflineEscalation,
  evaluateEodDecision,
  evaluateDecisionFlow,
  getCapacitorRuntime,
  ensureDeviceRegistration,
  setScreenshotProtection,
  securePinSet,
  securePinVerify,
  biometricAvailable,
  biometricUnlock,
  shareReceiptNative,
  notifyLocal,
  documentWorkManagerBridge,
  initCapacitorShell
};

/**
 * Convenience: run sync pass using in-process invokeApi as upload/ack transport.
 */
export async function runWave4Sync(state, opts = {}) {
  ensureWave4SyncState(state);
  const invokeApiFn = opts.invokeApiFn || ((s, request, ctx) => invokeApi(s, request, ctx));
  return runSyncPass(state, { ...opts, invokeApiFn });
}

export function createWave4Services(state, { uid, now, user } = {}) {
  ensureWave4SyncState(state);
  const platform = createApiPlatform(state, { actor: user, uid, now });
  return {
    wave: WAVE4_WAVE,
    version: WAVE4_VERSION,
    dashboard: (opts) => wave4SyncDashboard(state, opts),
    collectorUx: (opts) => resolveCollectorOfflineUx(state, opts),
    sync: (opts) => runWave4Sync(state, { ...opts, user, uid, now }),
    persist: (opts) => durablePersist(state, { ...opts, uid, now }),
    recover: (opts) => durableRecover(state, { ...opts, uid, now }),
    enqueue: (operation) => enqueueWithWave4(state, operation, uid),
    conflicts: () => conflictGuidanceRows(state),
    startOfDay: (opts) => evaluateDecisionFlow({ flow: "start_of_day", ...opts }),
    eod: (opts) => evaluateEodDecision(opts),
    escalate: (opts) => evaluateOfflineEscalation(opts),
    api: platform,
    capacitor: {
      runtime: () => getCapacitorRuntime(),
      registerDevice: (meta) => ensureDeviceRegistration(state, meta),
      screenshotProtection: (enabled) => setScreenshotProtection(enabled),
      pinSet: (pin) => securePinSet(pin),
      pinVerify: (pin) => securePinVerify(pin),
      biometricAvailable: () => biometricAvailable(),
      biometricUnlock: (opts) => biometricUnlock(opts),
      shareReceipt: (payload) => shareReceiptNative(payload),
      notify: (payload) => notifyLocal(payload),
      workManager: () => documentWorkManagerBridge()
    }
  };
}

export function wave4SmokeChecklist(state, { online = true } = {}) {
  ensureWave4SyncState(state);
  const dash = wave4SyncDashboard(state, { online });
  const cap = getCapacitorRuntime();
  return {
    wave: WAVE4_WAVE,
    version: WAVE4_VERSION,
    architecture: "capacitor-shared-spa",
    notComposeRewrite: true,
    invokeApiSyncOps: true,
    encryptedQueueDefault: dash.encrypted !== false,
    pending: dash.pending,
    conflicts: dash.conflicts,
    collectorStatus: dash.collectorStatus?.status || "",
    capacitorDetected: Boolean(cap.isNative),
    platform: cap.platform,
    backgroundBridge: state.wave4Sync.backgroundBridge || "js-engine",
    moneyDefaults: {
      interest: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000,
      currency: "GHS",
      pesewas: true
    }
  };
}
