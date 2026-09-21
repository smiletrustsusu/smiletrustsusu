#!/usr/bin/env node
/**
 * GAP-004 — Generate Capacitor Android Gradle project while preserving in-repo scaffold.
 *
 * Capacitor refuses `cap add android` when `android/` already exists (README + plugins-src).
 * This script stashes scaffold files, runs `cap add android`, then restores README/plugins-src.
 * Prefer not committing the generated Gradle tree (see .gitignore).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const androidDir = path.join(root, "android");
const gradlew = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

function hasGradle() {
  return fs.existsSync(gradlew) && fs.existsSync(path.join(androidDir, "app"));
}

function resolveSdkRoot() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const local =
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
      : path.join(os.homedir(), "Android", "Sdk");
  if (local && fs.existsSync(local)) return local;
  return "";
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Android", "Android Studio", "jbr")
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function runCap(args, env) {
  const capBin = path.join(root, "node_modules", "@capacitor", "cli", "bin", "capacitor");
  if (!fs.existsSync(capBin)) {
    console.error("ensure-android: @capacitor/cli not installed (npm ci first)");
    return 1;
  }
  const result = spawnSync(process.execPath, [capBin, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true
  });
  return result.status ?? 1;
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function main() {
  const sdk = resolveSdkRoot();
  const javaHome = resolveJavaHome();
  const env = { ...process.env };
  if (sdk) {
    env.ANDROID_HOME = sdk;
    env.ANDROID_SDK_ROOT = sdk;
  }
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
  }

  if (hasGradle()) {
    console.log("ensure-android: Gradle project already present");
    console.log(`  ANDROID_HOME=${env.ANDROID_HOME || "(unset)"}`);
    console.log(`  JAVA_HOME=${env.JAVA_HOME || "(unset)"}`);
    process.exit(0);
  }

  if (!sdk) {
    console.error(
      "ensure-android: Android SDK not found.\n" +
        "Install Android Studio / SDK, or set ANDROID_HOME, then re-run:\n" +
        "  npm run android:ensure"
    );
    process.exit(1);
  }

  console.log(`ensure-android: SDK=${sdk}`);
  if (javaHome) console.log(`ensure-android: JAVA_HOME=${javaHome}`);

  const stash = fs.mkdtempSync(path.join(os.tmpdir(), "smile-android-scaffold-"));
  const scaffoldNames = ["README.md", "plugins-src"];
  const stashed = [];

  try {
    if (fs.existsSync(androidDir)) {
      for (const name of scaffoldNames) {
        const src = path.join(androidDir, name);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(stash, name);
        copyRecursive(src, dest);
        stashed.push(name);
      }
      // Remove entire android/ so Capacitor can create a fresh platform.
      rimraf(androidDir);
      console.log(`ensure-android: stashed scaffold [${stashed.join(", ")}] → temp`);
    }

    const addStatus = runCap(["add", "android"], env);
    if (addStatus !== 0) {
      console.error("ensure-android: cap add android failed");
      // Best-effort restore scaffold if add failed before creating tree
      if (!fs.existsSync(androidDir)) fs.mkdirSync(androidDir, { recursive: true });
      for (const name of stashed) {
        copyRecursive(path.join(stash, name), path.join(androidDir, name));
      }
      process.exit(addStatus);
    }

    for (const name of stashed) {
      const dest = path.join(androidDir, name);
      // Prefer existing generated files only if Capacitor wrote something; otherwise restore.
      if (name === "README.md" && fs.existsSync(dest)) {
        // Keep our documented README over Capacitor default if both exist after restore overwrite.
      }
      copyRecursive(path.join(stash, name), dest);
    }
    console.log("ensure-android: restored README.md + plugins-src into generated android/");

    if (!hasGradle()) {
      console.error("ensure-android: Gradle wrapper still missing after cap add");
      process.exit(1);
    }

    // Write local.properties for SDK (gitignored)
    const localProps = path.join(androidDir, "local.properties");
    const sdkProp = sdk.replace(/\\/g, "/");
    fs.writeFileSync(localProps, `sdk.dir=${sdkProp}\n`, "utf8");
    console.log("ensure-android: wrote android/local.properties (gitignored)");
    console.log("ensure-android: ok — next: npm run cap:sync ; npm run build:apk");
    process.exit(0);
  } finally {
    try {
      rimraf(stash);
    } catch {
      /* ignore */
    }
  }
}

main();
