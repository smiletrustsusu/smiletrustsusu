#!/usr/bin/env node
/**
 * GAP-007 — Local channel config smoke (Android path + Electron signing + www SoT).
 * Prefer this over shell && chaining (PowerShell-safe).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const scripts = [
  "scripts/check-android-path.js",
  "scripts/check-electron-signing.js",
  "scripts/check-www-sot.js"
];

let failed = false;
for (const rel of scripts) {
  console.log(`check:channels — running ${rel}`);
  const result = spawnSync(process.execPath, [path.join(root, rel)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    windowsHide: true
  });
  if ((result.status ?? 1) !== 0) failed = true;
}

if (failed) {
  console.error("check:channels — one or more checks failed");
  process.exit(1);
}
console.log("check:channels — ok (android + electron-signing + www-sot)");
process.exit(0);
