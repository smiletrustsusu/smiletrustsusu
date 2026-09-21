/**
 * Wave 6 — Secure IPC channel allowlist for the Electron shell.
 * Renderer may only invoke channels listed here (via preload bridge).
 * Keep CommonJS so main/preload and Node tests share one source of truth.
 */

"use strict";

const IPC_INVOKE = Object.freeze([
  "desktop:print",
  "desktop:printToPdf",
  "desktop:exportFile",
  "desktop:secureSet",
  "desktop:secureGet",
  "desktop:secureDelete",
  "desktop:deviceId",
  "desktop:appInfo",
  "desktop:updateCheck",
  "desktop:updateInstall",
  "desktop:openExternal",
  "desktop:getPaths"
]);

const IPC_EVENTS = Object.freeze([
  "desktop:wakeSync",
  "desktop:updateStatus",
  "desktop:powerResume"
]);

const ALLOWED_EXTERNAL_SCHEMES = Object.freeze(["https:", "http:", "mailto:", "tel:", "sms:", "smsto:"]);

function isAllowedInvokeChannel(channel) {
  return IPC_INVOKE.includes(String(channel || ""));
}

function isAllowedEventChannel(channel) {
  return IPC_EVENTS.includes(String(channel || ""));
}

function assertAllowedInvoke(channel) {
  if (!isAllowedInvokeChannel(channel)) {
    const err = new Error(`IPC channel refused: ${channel}`);
    err.code = "IPC_ALLOWLIST";
    throw err;
  }
  return channel;
}

module.exports = {
  IPC_INVOKE,
  IPC_EVENTS,
  ALLOWED_EXTERNAL_SCHEMES,
  isAllowedInvokeChannel,
  isAllowedEventChannel,
  assertAllowedInvoke
};
