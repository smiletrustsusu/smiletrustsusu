/**
 * Wave 4 — Thin Capacitor / Android shell bridges.
 * Graceful degradation on Web/Electron. Optional native plugins under android/plugins-src.
 * Does NOT implement business/money rules.
 */

import { secureSet, secureGet, redactSecrets } from "../core/secure-storage.js";

export const CAPACITOR_SHELL_VERSION = "1.0.0";
const PIN_KEY = "unlock_pin_hash";
const DEVICE_META_KEY = "device_registration_v1";

function cap() {
  return globalThis.Capacitor || null;
}

export function getCapacitorRuntime() {
  const c = cap();
  const platform = c?.getPlatform?.() || (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "android-web" : "web");
  return {
    version: CAPACITOR_SHELL_VERSION,
    isNative: Boolean(c?.isNativePlatform?.()),
    platform,
    plugins: c?.Plugins ? Object.keys(c.Plugins) : []
  };
}

async function prefsSet(key, value) {
  const c = cap();
  const Preferences = c?.Plugins?.Preferences || globalThis.CapacitorPreferences;
  if (Preferences?.set) {
    await Preferences.set({ key, value: typeof value === "string" ? value : JSON.stringify(value) });
    return { ok: true, via: "preferences" };
  }
  return secureSet(key, value, { namespace: "capacitor", allowSensitive: true });
}

async function prefsGet(key) {
  const c = cap();
  const Preferences = c?.Plugins?.Preferences || globalThis.CapacitorPreferences;
  if (Preferences?.get) {
    const res = await Preferences.get({ key });
    if (res?.value == null) return { ok: true, value: null, via: "preferences" };
    try {
      return { ok: true, value: JSON.parse(res.value), via: "preferences" };
    } catch {
      return { ok: true, value: res.value, via: "preferences" };
    }
  }
  return secureGet(key, { namespace: "capacitor" });
}

/** Store PIN hash only — never plaintext in logs. */
export async function securePinSet(pin) {
  const raw = String(pin || "");
  if (raw.length < 4) return { ok: false, error: "PIN must be at least 4 digits" };
  const enc = new TextEncoder().encode("smile-trust-pin:" + raw);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const saved = await prefsSet(PIN_KEY, { v: 1, alg: "sha-256", hash });
  return { ok: saved.ok !== false, via: saved.via || "secure" };
}

export async function securePinVerify(pin) {
  const stored = await prefsGet(PIN_KEY);
  if (!stored?.value?.hash) return { ok: false, error: "PIN not set" };
  const enc = new TextEncoder().encode("smile-trust-pin:" + String(pin || ""));
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { ok: hash === stored.value.hash, matched: hash === stored.value.hash };
}

export async function biometricAvailable() {
  const c = cap();
  const Bio = c?.Plugins?.NativeBiometric || c?.Plugins?.BiometricAuth || globalThis.SmileTrustSecure;
  if (Bio?.isAvailable) {
    try {
      const res = await Bio.isAvailable();
      return { ok: true, available: Boolean(res?.available ?? res?.isAvailable ?? res) };
    } catch {
      return { ok: true, available: false };
    }
  }
  return { ok: true, available: false, reason: "plugin_absent" };
}

export async function biometricUnlock({ reason = "Unlock Smile Trust" } = {}) {
  const c = cap();
  const Bio = c?.Plugins?.NativeBiometric || c?.Plugins?.BiometricAuth || globalThis.SmileTrustSecure;
  if (Bio?.verifyIdentity || Bio?.authenticate) {
    try {
      const fn = Bio.verifyIdentity || Bio.authenticate;
      await fn.call(Bio, { reason, title: "Smile Trust", subtitle: reason });
      return { ok: true, via: "biometric" };
    } catch (err) {
      return { ok: false, error: err?.message || "Biometric cancelled" };
    }
  }
  return { ok: false, error: "Biometric plugin not installed", fallback: "pin" };
}

/**
 * FLAG_SECURE style protection when thin native plugin is present.
 */
export async function setScreenshotProtection(enabled = true) {
  const c = cap();
  const Secure = c?.Plugins?.SmileTrustSecure || globalThis.SmileTrustSecure;
  if (Secure?.setScreenshotProtection) {
    await Secure.setScreenshotProtection({ enabled: Boolean(enabled) });
    return { ok: true, enabled: Boolean(enabled), via: "native" };
  }
  // Web/Electron: best-effort CSS blur on visibility is not reliable; document only.
  return { ok: true, enabled: Boolean(enabled), via: "noop", note: "Install android/plugins-src SmileTrustSecure for FLAG_SECURE" };
}

export async function ensureDeviceRegistration(state, meta = {}) {
  const runtime = getCapacitorRuntime();
  const row = {
    registeredAt: new Date().toISOString(),
    platform: runtime.platform,
    isNative: runtime.isNative,
    userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 180) : "",
    appId: meta.appId || "com.kba.susu",
    appVersion: meta.appVersion || state?.settings?.appVersion || "",
    deviceId: meta.deviceId || "",
    fingerprint: meta.fingerprint || "",
    branchId: meta.branchId || "",
    agentId: meta.agentId || ""
  };
  state.wave4Sync = state.wave4Sync || {};
  state.wave4Sync.deviceRegistration = row;
  await prefsSet(DEVICE_META_KEY, redactSecrets(row));
  if (meta.deviceId && Array.isArray(state.devices)) {
    const existing = state.devices.find((d) => d.id === meta.deviceId || d.fingerprint === meta.fingerprint);
    if (existing) {
      existing.platform = row.platform;
      existing.lastSeenAt = row.registeredAt;
      existing.nativeShell = runtime.isNative;
    }
  }
  return { ok: true, registration: row };
}

/**
 * Receipt share / print hooks — Web Share API + optional Bluetooth print bridge stub.
 */
export async function shareReceiptNative({ title = "Smile Trust receipt", text = "", bluetooth = false } = {}) {
  const c = cap();
  const Share = c?.Plugins?.Share;
  if (Share?.share) {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return { ok: true, via: "capacitor-share" };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, cancelled: true };
    }
  }
  if (bluetooth) {
    const Print = c?.Plugins?.SmileTrustSecure || globalThis.SmileTrustSecure;
    if (Print?.bluetoothPrint) {
      await Print.bluetoothPrint({ text });
      return { ok: true, via: "bluetooth-print" };
    }
    return { ok: false, error: "Bluetooth print bridge not installed", stub: true };
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return { ok: true, via: "web-share" };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, cancelled: true };
    }
  }
  return { ok: false, error: "Share unavailable" };
}

export async function notifyLocal({ title = "Smile Trust", body = "", id = "smile-sync" } = {}) {
  const c = cap();
  const Local = c?.Plugins?.LocalNotifications;
  if (Local?.schedule) {
    await Local.schedule({
      notifications: [{ title, body, id: Number(String(id).replace(/\D/g, "").slice(0, 8) || "1") || 1 }]
    });
    return { ok: true, via: "local-notifications" };
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    // eslint-disable-next-line no-new
    new Notification(title, { body });
    return { ok: true, via: "web-notification" };
  }
  return { ok: true, via: "noop", note: "Configure @capacitor/local-notifications for APK push/local alerts" };
}

/**
 * Optional WorkManager bridge documentation payload — JS engine remains SoT.
 */
export function documentWorkManagerBridge() {
  return {
    ok: true,
    primary: "js-sync-engine",
    optionalNative: "android/plugins-src/SmileTrustSecure/WorkManagerSyncWorker.kt",
    behavior: "Native worker should only wake the WebView / call window.__SMILE_TRUST_BACKGROUND_SYNC__(); money apply stays in JS runSyncPass",
    notRequiredForPilot: true
  };
}

export async function initCapacitorShell(state, meta = {}) {
  const runtime = getCapacitorRuntime();
  if (runtime.isNative || runtime.platform === "android" || runtime.platform === "android-web") {
    await setScreenshotProtection(meta.screenshotProtection !== false);
    await ensureDeviceRegistration(state, meta);
  }
  if (typeof window !== "undefined") {
    window.__SMILE_TRUST_BACKGROUND_SYNC__ = window.__SMILE_TRUST_BACKGROUND_SYNC__ || null;
  }
  return { ok: true, runtime };
}
