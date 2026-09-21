import { SESSION_USER_KEY } from "../constants.js";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
export const SESSION_STARTED_KEY = "smile_trust_session_started";
export const SESSION_DEVICE_KEY = "smile_trust_session_device";

export function markSessionStarted() {
  sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
}

/** Sliding refresh so active users do not expire mid-work. */
export function touchSession() {
  if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
    markSessionStarted();
    return;
  }
  sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
}

export function bindSessionDevice(deviceId) {
  if (!deviceId) {
    sessionStorage.removeItem(SESSION_DEVICE_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_DEVICE_KEY, String(deviceId));
}

export function getSessionDeviceId() {
  return sessionStorage.getItem(SESSION_DEVICE_KEY) || "";
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_STARTED_KEY);
  sessionStorage.removeItem(SESSION_DEVICE_KEY);
}

export function sessionTtlMs(settings = {}) {
  const minutes = Number(settings.sessionTimeoutMinutes);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * 60 * 1000;
  return SESSION_TTL_MS;
}

export function sessionExpired(settings) {
  const started = Number(sessionStorage.getItem(SESSION_STARTED_KEY) || 0);
  if (!started) return false;
  return Date.now() - started > sessionTtlMs(settings);
}

export function ensureActiveSession(onExpired, settings) {
  if (sessionExpired(settings)) {
    clearSession();
    if (typeof onExpired === "function") onExpired();
    return false;
  }
  return true;
}
