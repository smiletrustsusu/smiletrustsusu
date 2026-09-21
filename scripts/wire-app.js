const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(root, "app.js"), "utf8").split(/\r?\n/);

const head = lines.slice(0, 500).join("\n");
const tail = lines.slice(4124).join("\n");

const bridge = `
import { registerRuntime, rt } from "./src/runtime.js";
import { render, renderLogin, renderApp } from "./src/ui/views.js";
import { attachHandlers } from "./src/ui/handlers.js";
import * as Print from "./src/ui/print.js";
import * as Imports from "./src/ui/imports.js";

const stateRef = { value: state };
const sessionRef = { value: sessionUserId };
const viewRef = { value: activeView };

function syncRefsFromLocals() {
  stateRef.value = state;
  sessionRef.value = sessionUserId;
  viewRef.value = activeView;
  rt.syncTimer = syncTimer;
  rt.syncBusy = syncBusy;
  rt.gatewayTimer = gatewayTimer;
  rt.autoSyncTimer = autoSyncTimer;
  rt.localSavePending = localSavePending;
  rt.lastAndroidRefreshAt = lastAndroidRefreshAt;
  rt.root = app;
}

function syncLocalsFromRefs() {
  state = stateRef.value;
  sessionUserId = sessionRef.value;
  activeView = viewRef.value;
  syncTimer = rt.syncTimer;
  syncBusy = rt.syncBusy;
  gatewayTimer = rt.gatewayTimer;
  autoSyncTimer = rt.autoSyncTimer;
  localSavePending = rt.localSavePending;
  lastAndroidRefreshAt = rt.lastAndroidRefreshAt;
}

function registerUiBridge() {
  syncRefsFromLocals();
  const core = {};
  const skip = new Set(["registerUiBridge", "syncRefsFromLocals", "syncLocalsFromRefs"]);
  for (const name of Object.getOwnPropertyNames(globalThis)) {}
  const fnNames = ${JSON.stringify([...lines.slice(0, 500).join("\n").matchAll(/^(?:async )?function (\w+)/gm)].map(m => m[1]))};
  // register at call time below
}

`;

// Simpler: keep core in app.js, append wire at end before init
console.log("Use manual app.js wiring");
