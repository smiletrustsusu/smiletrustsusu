#!/usr/bin/env node
/**
 * Build debug/release APK. On Windows, prefers Android Studio JBR (Java 21) when
 * system Java is too new for Gradle 8.x (e.g. Java 25). Uses repo `.gradle-home`
 * when present to avoid re-downloading the Gradle distribution (SSL/proxy issues).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const androidDir = path.join(root, "android");
const gradlew = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

function readJavaMajor(javaHome) {
  const javaBin = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!fs.existsSync(javaBin)) return null;
  const result = spawnSync(javaBin, ["-version"], { encoding: "utf8" });
  const text = `${result.stderr || ""}${result.stdout || ""}`;
  const match = text.match(/version "(\d+)/);
  return match ? Number(match[1]) : null;
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    const major = readJavaMajor(process.env.JAVA_HOME);
    if (major && major <= 21) return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Android", "Android Studio", "jbr")
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const major = readJavaMajor(candidate);
    if (major && major >= 17 && major <= 21) return candidate;
  }
  return process.env.JAVA_HOME || null;
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

const javaHome = resolveJavaHome();
const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
  console.log(`Using JAVA_HOME=${javaHome}`);
}

const sdkRoot = resolveSdkRoot();
if (sdkRoot) {
  env.ANDROID_HOME = sdkRoot;
  env.ANDROID_SDK_ROOT = sdkRoot;
  console.log(`Using ANDROID_HOME=${sdkRoot}`);
  const localProps = path.join(androidDir, "local.properties");
  if (!fs.existsSync(localProps)) {
    fs.writeFileSync(localProps, `sdk.dir=${sdkRoot.replace(/\\/g, "/")}\n`, "utf8");
  }
}

const localGradleHome = path.join(root, ".gradle-home");
if (fs.existsSync(localGradleHome)) {
  env.GRADLE_USER_HOME = localGradleHome;
} else if (!env.GRADLE_USER_HOME && process.env.USERPROFILE) {
  env.GRADLE_USER_HOME = path.join(process.env.USERPROFILE, ".gradle");
}
if (env.GRADLE_USER_HOME) {
  console.log(`Using GRADLE_USER_HOME=${env.GRADLE_USER_HOME}`);
}

if (!fs.existsSync(gradlew)) {
  console.error(`Gradle wrapper not found: ${gradlew}`);
  console.error("Run: npm run android:ensure");
  process.exit(1);
}

const task = process.argv[2] === "release" ? "assembleRelease" : "assembleDebug";

// Ensure Android WebView assets are ES2018-safe even if Gradle was invoked
// without going through `npm run cap:sync` (postcap:sync downlevel).
{
  const downlevel = spawnSync(process.execPath, [path.join(root, "scripts", "downlevel-android-assets.js")], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true
  });
  if ((downlevel.status ?? 1) !== 0) process.exit(downlevel.status ?? 1);
}

if (task === "assembleRelease") {
  const propsPath = path.join(androidDir, "keystore.properties");
  const keystorePath = path.join(androidDir, "smile-trust-release.keystore");
  if (!fs.existsSync(propsPath) || !fs.existsSync(keystorePath)) {
    console.error("Release APK requires android/keystore.properties + smile-trust-release.keystore.");
    console.error(
      "Configure with org secrets (never invent certs):\n" +
        "  $env:SMILE_ANDROID_STORE_PASSWORD = '<vault>'\n" +
        "  # optional: $env:SMILE_ANDROID_KEYSTORE_FILE = 'C:\\secure\\org.keystore'\n" +
        "  npm run setup:android-signing\n" +
        "Or pilot-only: $env:SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE='1'; npm run setup:android-signing"
    );
    process.exit(1);
  }
  console.log("Release signing props present — building assembleRelease");
}

console.log(`Running ${path.basename(gradlew)} ${task}`);

// Paths with spaces (e.g. "...SMILE TRUST...") break unquoted Windows shell spawns.
const result =
  process.platform === "win32"
    ? spawnSync(`"${gradlew}" ${task} --no-daemon`, {
        cwd: androidDir,
        env,
        stdio: "inherit",
        shell: true,
        windowsHide: true
      })
    : spawnSync(gradlew, [task, "--no-daemon"], {
        cwd: androidDir,
        env,
        stdio: "inherit",
        shell: false
      });

if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);
