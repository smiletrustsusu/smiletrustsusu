/**
 * Wave 6 — Preload bridge (contextIsolation).
 * Exposes a narrow allowlisted API on window.smileTrustDesktop.
 * No Node integration in the renderer.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const { IPC_INVOKE, IPC_EVENTS, isAllowedInvokeChannel, isAllowedEventChannel } = require("./ipc-channels");

function invoke(channel, payload) {
  if (!isAllowedInvokeChannel(channel)) {
    return Promise.reject(new Error(`IPC channel refused: ${channel}`));
  }
  return ipcRenderer.invoke(channel, payload);
}

function subscribe(channel, handler) {
  if (!isAllowedEventChannel(channel)) return () => {};
  const listener = (_event, data) => {
    try {
      handler(data);
    } catch {
      /* ignore renderer handler errors */
    }
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("smileTrustDesktop", {
  platform: "electron",
  wave: "WAVE-06",
  channels: { invoke: IPC_INVOKE.slice(), events: IPC_EVENTS.slice() },

  printHtml: (payload) => invoke("desktop:print", payload || {}),
  printToPdf: (payload) => invoke("desktop:printToPdf", payload || {}),
  exportFile: (payload) => invoke("desktop:exportFile", payload || {}),
  secureSet: (key, value) => invoke("desktop:secureSet", { key, value }),
  secureGet: (key) => invoke("desktop:secureGet", { key }),
  secureDelete: (key) => invoke("desktop:secureDelete", { key }),
  getDeviceId: () => invoke("desktop:deviceId"),
  getAppInfo: () => invoke("desktop:appInfo"),
  checkForUpdates: () => invoke("desktop:updateCheck"),
  installUpdate: () => invoke("desktop:updateInstall"),
  openExternal: (url) => invoke("desktop:openExternal", { url }),
  getPaths: () => invoke("desktop:getPaths"),

  onWakeSync: (handler) => subscribe("desktop:wakeSync", handler),
  onUpdateStatus: (handler) => subscribe("desktop:updateStatus", handler),
  onPowerResume: (handler) => subscribe("desktop:powerResume", handler)
});
