/**
 * Wave 6 — Thin Electron / Windows desktop shell bridges.
 * Graceful degradation on Web/Android. Does NOT implement business/money rules.
 * Sync always goes through the shared Wave 4 engine (`runWave4Sync` / offline-sync-engine).
 */

import { secureSet, secureGet, redactSecrets } from "../core/secure-storage.js";

export const ELECTRON_SHELL_VERSION = "1.0.0";
export const WAVE6_DESKTOP_WAVE = "WAVE-06";

const DEVICE_META_KEY = "desktop_device_registration_v1";

export function getDesktopBridge() {
  return globalThis.smileTrustDesktop || null;
}

export function isElectronRuntime() {
  const bridge = getDesktopBridge();
  if (bridge?.platform === "electron") return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "")) return true;
  return false;
}

export function getElectronRuntime() {
  const bridge = getDesktopBridge();
  return {
    version: ELECTRON_SHELL_VERSION,
    wave: WAVE6_DESKTOP_WAVE,
    isElectron: isElectronRuntime(),
    hasBridge: Boolean(bridge),
    architecture: "electron-shared-spa",
    notNextJsRewrite: true,
    channels: bridge?.channels || null
  };
}

/**
 * Desktop wake hooks — only schedule shared JS sync; never post money in main process.
 */
export function documentDesktopWakeBridge() {
  return {
    ok: true,
    primary: "js-sync-engine",
    module: "src/sync/offline-sync-engine.js",
    facade: "runWave4Sync",
    optionalNative: "electron/main.js powerMonitor + interval wakeSync",
    behavior:
      "Main process emits desktop:wakeSync; renderer calls window.__SMILE_TRUST_BACKGROUND_SYNC__ which runs shared Wave 4 flush. Money apply stays in JS.",
    notRequiredForPilot: false
  };
}

export async function desktopPrintHtml({ html = "", title = "Smile Trust", silent = false } = {}) {
  const bridge = getDesktopBridge();
  if (bridge?.printHtml) {
    return bridge.printHtml({ html, title, silent });
  }
  if (typeof window !== "undefined" && window.print && !html) {
    window.print();
    return { ok: true, via: "window.print" };
  }
  return { ok: false, error: "Desktop print bridge unavailable", fallback: "window.open" };
}

export async function desktopPrintToPdf(opts = {}) {
  const bridge = getDesktopBridge();
  if (bridge?.printToPdf) return bridge.printToPdf(opts);
  return { ok: false, error: "printToPdf unavailable outside Electron" };
}

export async function desktopExportFile({ filename, content, type = "text/plain" } = {}) {
  const bridge = getDesktopBridge();
  if (bridge?.exportFile) {
    return bridge.exportFile({ filename, content, type });
  }
  return { ok: false, error: "export bridge unavailable", fallback: "anchor-download" };
}

export async function desktopSecureSet(key, value) {
  const bridge = getDesktopBridge();
  if (bridge?.secureSet) return bridge.secureSet(key, value);
  return secureSet(key, value, { namespace: "desktop", allowSensitive: true });
}

export async function desktopSecureGet(key) {
  const bridge = getDesktopBridge();
  if (bridge?.secureGet) return bridge.secureGet(key);
  return secureGet(key, { namespace: "desktop" });
}

export async function desktopDeviceId() {
  const bridge = getDesktopBridge();
  if (bridge?.getDeviceId) return bridge.getDeviceId();
  return { ok: true, deviceId: "", platform: "web", via: "absent" };
}

export async function desktopAppInfo() {
  const bridge = getDesktopBridge();
  if (bridge?.getAppInfo) return bridge.getAppInfo();
  return {
    ok: true,
    isPackaged: false,
    wave: WAVE6_DESKTOP_WAVE,
    architecture: "web-or-android",
    notNextJsRewrite: true
  };
}

export async function ensureDesktopDeviceRegistration(state, meta = {}) {
  const runtime = getElectronRuntime();
  const idRes = await desktopDeviceId();
  const row = {
    registeredAt: new Date().toISOString(),
    platform: "electron-windows",
    isElectron: runtime.isElectron,
    deviceId: idRes.deviceId || meta.deviceId || "",
    userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 180) : "",
    appVersion: meta.appVersion || state?.settings?.appVersion || "",
    branchId: meta.branchId || "",
    agentId: meta.agentId || "",
    fingerprint: meta.fingerprint || idRes.deviceId || ""
  };
  state.wave4Sync = state.wave4Sync || {};
  state.wave4Sync.desktopRegistration = row;
  state.wave4Sync.backgroundBridge = runtime.isElectron ? "electron-wake+js-engine" : state.wave4Sync.backgroundBridge || "js-engine";
  await desktopSecureSet(DEVICE_META_KEY, redactSecrets(row));
  if (row.deviceId && Array.isArray(state.devices)) {
    const existing = state.devices.find((d) => d.id === row.deviceId || d.fingerprint === row.fingerprint);
    if (existing) {
      existing.platform = row.platform;
      existing.lastSeenAt = row.registeredAt;
      existing.desktopShell = true;
    }
  }
  return { ok: true, registration: row };
}

/**
 * Screenshot-sensitive guidance for branch-office desktops (no OS FLAG_SECURE equivalent).
 */
export function desktopScreenshotGuidance() {
  return {
    ok: true,
    via: "policy",
    guidance: [
      "Prefer branch-office locked sessions; lock screen when unattended (Win+L).",
      "Do not share screen while receipts, PINs, or customer PII are visible.",
      "Use Windows high-contrast / Magnifier as needed — Wave 5 a11y helpers remain in SPA.",
      "Clear printer spoolers of sensitive receipts after batch print jobs."
    ]
  };
}

export function desktopAccessibilityNotes() {
  return {
    ok: true,
    reuseWave5: true,
    notes: [
      "Keyboard: existing SPA focus order and dialogs; avoid mouse-only admin actions.",
      "High contrast: prefer system high-contrast theme; avoid color-alone status (Wave 4/5 aria-labels).",
      "Print dialogs: Electron native print is keyboard accessible via Windows print UI."
    ]
  };
}

/**
 * Wire wake/update listeners so desktop uses the same __SMILE_TRUST_BACKGROUND_SYNC__ as Android.
 */
export function attachDesktopWakeHandlers({ onWake } = {}) {
  const bridge = getDesktopBridge();
  const unsubs = [];
  if (!bridge) return () => {};
  if (typeof bridge.onWakeSync === "function") {
    unsubs.push(
      bridge.onWakeSync((payload) => {
        if (typeof onWake === "function") onWake(payload);
        else if (typeof window !== "undefined" && typeof window.__SMILE_TRUST_BACKGROUND_SYNC__ === "function") {
          window.__SMILE_TRUST_BACKGROUND_SYNC__(payload);
        }
      })
    );
  }
  if (typeof bridge.onPowerResume === "function") {
    unsubs.push(
      bridge.onPowerResume((payload) => {
        if (typeof onWake === "function") onWake({ ...payload, reason: payload?.reason || "power-resume" });
        else if (typeof window !== "undefined" && typeof window.__SMILE_TRUST_BACKGROUND_SYNC__ === "function") {
          window.__SMILE_TRUST_BACKGROUND_SYNC__(payload);
        }
      })
    );
  }
  return () => unsubs.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export async function initElectronShell(state, meta = {}) {
  const runtime = getElectronRuntime();
  if (typeof window !== "undefined") {
    window.__SMILE_TRUST_BACKGROUND_SYNC__ = window.__SMILE_TRUST_BACKGROUND_SYNC__ || null;
  }
  if (runtime.isElectron) {
    await ensureDesktopDeviceRegistration(state, meta);
    attachDesktopWakeHandlers();
  }
  return {
    ok: true,
    runtime,
    wake: documentDesktopWakeBridge(),
    screenshot: desktopScreenshotGuidance(),
    a11y: desktopAccessibilityNotes()
  };
}
