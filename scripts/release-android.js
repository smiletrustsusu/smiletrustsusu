#!/usr/bin/env node
/**
 * GAP-004 / GAP-012 — Release APK path when org keystore is available.
 * Never invent certificates. Exit 1 if signing secrets are absent (unless --check-only).
 *
 * Flow: prepare:web → android:ensure → setup:android-signing → assembleRelease → hash:artifacts
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const checkOnly = process.argv.includes("--check-only");
const skipHash = process.argv.includes("--skip-hash");

function runNode(scriptRel, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, scriptRel), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    windowsHide: true
  });
  return result.status ?? 1;
}

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

function findReleaseApk() {
  const candidates = [
    path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const releaseDir = path.join(root, "android", "app", "build", "outputs", "apk", "release");
  if (!fs.existsSync(releaseDir)) return null;
  const hit = fs.readdirSync(releaseDir).find((n) => n.endsWith(".apk"));
  return hit ? path.join(releaseDir, hit) : null;
}

function main() {
  console.log("release:android — signed/release APK path (org keystore required)");

  const setupCheck = runNode("scripts/setup-android-signing.js", ["--check-only"]);
  if (setupCheck !== 0) {
    console.error(
      "release:android: signing not ready.\n" +
        "Provide org secrets (do not invent certs):\n" +
        "  $env:SMILE_ANDROID_STORE_PASSWORD = '<from vault>'\n" +
        "  $env:SMILE_ANDROID_KEYSTORE_FILE = 'C:\\secure\\org-release.keystore'  # optional existing file\n" +
        "Or pilot-only (not Play Store): $env:SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE = '1'"
    );
    process.exit(1);
  }

  if (checkOnly) {
    console.log("release:android: signing readiness OK (--check-only)");
    process.exit(0);
  }

  let status = runNpm(["run", "prepare:web"]);
  if (status !== 0) process.exit(status);

  status = runNode("scripts/ensure-android-platform.js");
  if (status !== 0) process.exit(status);

  status = runNpm(["run", "cap:sync"]);
  if (status !== 0) process.exit(status);

  status = runNode("scripts/setup-android-signing.js");
  if (status !== 0) process.exit(status);

  status = runNode("scripts/build-apk.js", ["release"]);
  if (status !== 0) process.exit(status);

  const apk = findReleaseApk();
  if (!apk) {
    console.error("release:android: release APK not found under android/app/build/outputs/apk/release/");
    process.exit(1);
  }

  const stat = fs.statSync(apk);
  console.log(`release:android: ok`);
  console.log(`  apk=${apk}`);
  console.log(`  bytes=${stat.size}`);

  if (!skipHash) {
    status = runNode("scripts/hash-release-artifacts.js");
    if (status !== 0) process.exit(status);
  }

  process.exit(0);
}

main();
