#!/usr/bin/env node
/**
 * GAP-004 — One-command Android pilot: prepare:web → ensure platform → sync → debug APK.
 * Exit 0 only when a debug APK file is produced (or already present and --skip-build).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const skipBuild = process.argv.includes("--skip-build");
const syncOnly = process.argv.includes("--sync-only");

function runNpm(args) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    windowsHide: true
  });
  return result.status ?? 1;
}

function runNode(scriptRel, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, scriptRel), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    windowsHide: true
  });
  return result.status ?? 1;
}

function findDebugApk() {
  const candidates = [
    path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug-unsigned.apk")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback: any *.apk under debug outputs
  const debugDir = path.join(root, "android", "app", "build", "outputs", "apk", "debug");
  if (!fs.existsSync(debugDir)) return null;
  const hit = fs.readdirSync(debugDir).find((n) => n.endsWith(".apk"));
  return hit ? path.join(debugDir, hit) : null;
}

function main() {
  console.log("pilot:android — Capacitor debug APK path");

  let status = runNpm(["run", "prepare:web"]);
  if (status !== 0) process.exit(status);

  status = runNode("scripts/ensure-android-platform.js");
  if (status !== 0) process.exit(status);

  // Brand launcher icons (mipmap + PWA) after android/ exists so mipmaps land in res/
  status = runNpm(["run", "generate:icons"]);
  if (status !== 0) process.exit(status);

  status = runNpm(["run", "prepare:web"]);
  if (status !== 0) process.exit(status);

  status = runNpm(["run", "cap:sync"]);
  if (status !== 0) process.exit(status);

  if (syncOnly) {
    console.log("pilot:android: sync complete (--sync-only)");
    process.exit(0);
  }

  if (!skipBuild) {
    status = runNode("scripts/build-apk.js");
    if (status !== 0) process.exit(status);
  }

  const apk = findDebugApk();
  if (!apk) {
    console.error(
      "pilot:android: debug APK not found under android/app/build/outputs/apk/debug/\n" +
        "Run without --skip-build, or open Android Studio after npm run android:ensure"
    );
    process.exit(1);
  }

  const stat = fs.statSync(apk);
  console.log(`pilot:android: ok`);
  console.log(`  apk=${apk}`);
  console.log(`  bytes=${stat.size}`);
  console.log(`  next: npm run hash:artifacts  (GAP-012 evidence when release APK/EXE exist)`);
  process.exit(0);
}

main();
