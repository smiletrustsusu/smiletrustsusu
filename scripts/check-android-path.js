#!/usr/bin/env node
/**
 * GAP-004 — Verify Android Capacitor reproducible path without requiring a committed Gradle tree.
 * Exit 0 when scripts/config are healthy; exit 1 when required scaffolding is missing.
 * With --strict-sdk: also require ANDROID_HOME / local SDK so pilot:android can run.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const errors = [];
const notes = [];
const warnings = [];
const strictSdk = process.argv.includes("--strict-sdk");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
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

function findDebugApk() {
  const candidates = [
    "android/app/build/outputs/apk/debug/app-debug.apk",
    "android/app/build/outputs/apk/debug/app-debug-unsigned.apk"
  ];
  for (const rel of candidates) {
    if (exists(rel)) return rel;
  }
  return null;
}

function findReleaseApk() {
  const candidates = [
    "android/app/build/outputs/apk/release/app-release.apk",
    "android/app/build/outputs/apk/release/app-release-unsigned.apk"
  ];
  for (const rel of candidates) {
    if (exists(rel)) return rel;
  }
  return null;
}

function assessReleaseSigning() {
  const props = exists("android/keystore.properties");
  const keystore = exists("android/smile-trust-release.keystore");
  const storePassword = Boolean(process.env.SMILE_ANDROID_STORE_PASSWORD);
  const allowLocal = process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE === "1";
  const external = process.env.SMILE_ANDROID_KEYSTORE_FILE || "";
  const externalOk = external ? fs.existsSync(external) : false;
  return {
    props,
    keystore,
    storePasswordEnv: storePassword,
    allowLocalKeystore: allowLocal,
    externalKeystoreConfigured: Boolean(external),
    externalKeystoreExists: externalOk,
    canAttemptRelease:
      (props && keystore) || storePassword || allowLocal || externalOk
  };
}

if (!exists("capacitor.config.json")) {
  errors.push("Missing capacitor.config.json");
} else {
  const cap = readJson("capacitor.config.json");
  if (cap.webDir !== "www") errors.push(`capacitor webDir must be www (got ${cap.webDir})`);
  if (!cap.appId) errors.push("capacitor.appId missing");
  notes.push(`appId=${cap.appId}; webDir=${cap.webDir}`);
}

const pkg = readJson("package.json");
for (const script of [
  "prepare:web",
  "cap:add:android",
  "cap:sync",
  "build:apk",
  "build:apk:release",
  "setup:android-signing",
  "android:ensure",
  "pilot:android",
  "release:android",
  "hash:artifacts",
  "check:channels"
]) {
  if (!pkg.scripts?.[script]) errors.push(`package.json missing script: ${script}`);
}

if (!exists("android/README.md")) errors.push("Missing android/README.md");
if (!exists("scripts/ensure-android-platform.js")) errors.push("Missing scripts/ensure-android-platform.js");
if (!exists("scripts/pilot-android.js")) errors.push("Missing scripts/pilot-android.js");
notes.push("plugins-src optional stubs present=" + exists("android/plugins-src"));

const sdk = resolveSdkRoot();
const javaHome = resolveJavaHome();
if (sdk) {
  notes.push(`SDK found: ${sdk}`);
  const envSet = Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT);
  if (!envSet) {
    warnings.push("ANDROID_HOME unset — pilot:android / ensure-android will auto-detect local SDK");
  }
} else {
  warnings.push("Android SDK not detected — install Android Studio or set ANDROID_HOME");
  if (strictSdk) errors.push("SDK required (--strict-sdk) but not found");
}

if (javaHome) {
  notes.push(`JAVA_HOME candidate: ${javaHome}`);
} else {
  warnings.push("No JAVA_HOME / Android Studio JBR detected — Gradle may fail on system JDK >21");
}

const hasGradle = exists("android/gradlew") || exists("android/gradlew.bat");
const hasApp = exists("android/app");
if (!hasGradle || !hasApp) {
  notes.push(
    "Gradle project not generated yet — run: npm run android:ensure   (or npm run pilot:android)"
  );
} else {
  notes.push("Gradle wrapper + android/app present (local generate OK)");
}

const apk = findDebugApk();
if (apk) {
  const st = fs.statSync(path.join(root, apk));
  notes.push(`debug APK present: ${apk} (${st.size} bytes)`);
} else {
  notes.push("debug APK not built yet — expected at android/app/build/outputs/apk/debug/app-debug.apk");
}

const releaseApk = findReleaseApk();
if (releaseApk) {
  const st = fs.statSync(path.join(root, releaseApk));
  notes.push(`release APK present: ${releaseApk} (${st.size} bytes)`);
} else {
  notes.push("release APK not built yet — requires org keystore via setup:android-signing (do not invent certs)");
}

const signing = assessReleaseSigning();
notes.push(
  `release signing: props=${signing.props} keystore=${signing.keystore} storePasswordEnv=${signing.storePasswordEnv} canAttempt=${signing.canAttemptRelease}`
);
if (!signing.canAttemptRelease) {
  warnings.push(
    "Signed release blocked until SMILE_ANDROID_STORE_PASSWORD / KEYSTORE_FILE or ALLOW_LOCAL_KEYSTORE=1"
  );
}

if (!exists("www/index.html") && !exists("www")) {
  notes.push("www/ missing — run npm run prepare:web before cap:sync");
}

console.log("check:android — Android Capacitor path");
for (const n of notes) console.log(`  note: ${n}`);
for (const w of warnings) console.warn(`  warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  error: ${e}`);
  process.exit(1);
}
console.log("  ok: scripts and Capacitor config ready (Gradle may be generated locally)");
console.log("  pilot one-liner: npm run pilot:android");
console.log("  release (when keystore ready): npm run release:android");
process.exit(0);
