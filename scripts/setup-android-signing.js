#!/usr/bin/env node
/**
 * GAP-004 — Configure Android release signing from org env secrets.
 * Never invent certificates. Never commit keystore.properties or *.keystore.
 *
 * Env (recommended for release):
 *   SMILE_ANDROID_STORE_PASSWORD
 *   SMILE_ANDROID_KEY_PASSWORD (defaults to store password)
 *   SMILE_ANDROID_KEY_ALIAS (default: smiletrust)
 *   SMILE_ANDROID_KEYSTORE_FILE — path to an existing org keystore (copied into android/)
 *
 * Pilot-only local keystore (not for Play Store):
 *   SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE=1
 *
 * Flags:
 *   --check-only  report readiness and exit (0=ready or pilot-ok path documented; 1=blocked)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const androidDir = path.join(root, "android");
const propsPath = path.join(androidDir, "keystore.properties");
const defaultKeystoreName = "smile-trust-release.keystore";
const keystorePath = path.join(androidDir, defaultKeystoreName);
const checkOnly = process.argv.includes("--check-only");

// Only the storeFile key is read; passwords in keystore.properties are never loaded here.
function configuredKeystorePath() {
  if (!fs.existsSync(propsPath)) return keystorePath;
  const line = fs.readFileSync(propsPath, "utf8").split(/\r?\n/).find((item) => /^\s*storeFile\s*=/.test(item));
  const storeFile = line ? line.slice(line.indexOf("=") + 1).trim() : "";
  return storeFile ? path.resolve(androidDir, storeFile) : keystorePath;
}

function assessSigningReadiness() {
  const storePassword = Boolean(process.env.SMILE_ANDROID_STORE_PASSWORD);
  const allowLocal = process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE === "1";
  const externalKeystore = process.env.SMILE_ANDROID_KEYSTORE_FILE || "";
  const externalExists = externalKeystore ? fs.existsSync(externalKeystore) : false;
  const propsExist = fs.existsSync(propsPath);
  const keystoreExist = fs.existsSync(configuredKeystorePath());
  const ready =
    (propsExist && keystoreExist) ||
    storePassword ||
    allowLocal ||
    externalExists;

  return {
    propsExist,
    keystoreExist,
    storePasswordEnv: storePassword,
    allowLocalKeystore: allowLocal,
    externalKeystore: externalKeystore || null,
    externalKeystoreExists: externalExists,
    readyForReleaseBuild: ready,
    notes: [
      "Do not invent signing certificates.",
      "Play Store / production requires an org-managed keystore + SMILE_ANDROID_* secrets.",
      "SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE=1 creates a pilot-only keystore (never ship to Play)."
    ]
  };
}

function writeProps({ alias, storePassword, keyPassword, storeFile }) {
  const props = `storeFile=${storeFile}
storePassword=${storePassword}
keyAlias=${alias}
keyPassword=${keyPassword}
`;
  fs.writeFileSync(propsPath, props, "utf8");
}

function resolveKeytool() {
  if (process.env.JAVA_HOME) {
    const bin = path.join(
      process.env.JAVA_HOME,
      "bin",
      process.platform === "win32" ? "keytool.exe" : "keytool"
    );
    if (fs.existsSync(bin)) return bin;
  }
  return "keytool";
}

function main() {
  if (!fs.existsSync(androidDir)) {
    console.error("android/ missing — run npm run android:ensure first");
    process.exit(1);
  }

  const assessment = assessSigningReadiness();

  if (checkOnly) {
    console.log("setup:android-signing --check-only");
    console.log(`  propsExist=${assessment.propsExist}`);
    console.log(`  keystoreExist=${assessment.keystoreExist}`);
    console.log(`  storePasswordEnv=${assessment.storePasswordEnv}`);
    console.log(`  allowLocalKeystore=${assessment.allowLocalKeystore}`);
    console.log(`  externalKeystoreExists=${assessment.externalKeystoreExists}`);
    console.log(`  readyForReleaseBuild=${assessment.readyForReleaseBuild}`);
    process.exit(assessment.readyForReleaseBuild ? 0 : 1);
  }

  if (fs.existsSync(propsPath) && fs.existsSync(configuredKeystorePath())) {
    console.log("Android signing already configured (keystore.properties + keystore present).");
    process.exit(0);
  }
  if (fs.existsSync(propsPath)) {
    console.error(
      "android/keystore.properties exists but its storeFile keystore is missing.\n" +
        "Restore the original keystore; refusing to generate a new key or overwrite the signing config."
    );
    process.exit(1);
  }

  const alias = process.env.SMILE_ANDROID_KEY_ALIAS || "smiletrust";
  let storePassword = process.env.SMILE_ANDROID_STORE_PASSWORD || "";
  let keyPassword = process.env.SMILE_ANDROID_KEY_PASSWORD || storePassword;
  const externalKeystore = process.env.SMILE_ANDROID_KEYSTORE_FILE || "";

  if (externalKeystore) {
    if (!fs.existsSync(externalKeystore)) {
      console.error(`SMILE_ANDROID_KEYSTORE_FILE not found: ${externalKeystore}`);
      process.exit(1);
    }
    if (!storePassword) {
      console.error(
        "SMILE_ANDROID_KEYSTORE_FILE requires SMILE_ANDROID_STORE_PASSWORD (and optional KEY_PASSWORD)."
      );
      process.exit(1);
    }
    fs.copyFileSync(externalKeystore, keystorePath);
    writeProps({
      alias,
      storePassword,
      keyPassword,
      storeFile: defaultKeystoreName
    });
    console.log("Copied org keystore into android/ and wrote keystore.properties.");
    console.log("Do not commit keystore or properties files.");
    process.exit(0);
  }

  if (!storePassword) {
    if (process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE !== "1") {
      console.error(
        "Refusing to create a keystore without secrets.\n" +
          "Set SMILE_ANDROID_STORE_PASSWORD (and optional SMILE_ANDROID_KEY_PASSWORD),\n" +
          "or set SMILE_ANDROID_KEYSTORE_FILE to an existing org keystore,\n" +
          "or set SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE=1 for a pilot-only local keystore."
      );
      process.exit(1);
    }
    storePassword = crypto.randomBytes(18).toString("base64url");
    keyPassword = storePassword;
    console.warn(
      "WARNING: Generated a pilot-only local keystore password. Back it up; do not use for Play Store."
    );
  }

  if (!fs.existsSync(keystorePath)) {
    const keytool = resolveKeytool();
    const result = spawnSync(
      keytool,
      [
        "-genkeypair",
        "-v",
        "-keystore",
        keystorePath,
        "-alias",
        alias,
        "-keyalg",
        "RSA",
        "-keysize",
        "2048",
        "-validity",
        "10000",
        "-storepass",
        storePassword,
        "-keypass",
        keyPassword,
        "-dname",
        "CN=Smile Trust Susu, OU=Mobile, O=Smile Trust, L=Accra, ST=Greater Accra, C=GH"
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      console.error("keytool failed — install JDK or set JAVA_HOME");
      process.exit(1);
    }
  }

  writeProps({
    alias,
    storePassword,
    keyPassword,
    storeFile: defaultKeystoreName
  });
  console.log("Created android/keystore.properties and smile-trust-release.keystore");
  console.log("Back up the keystore and passwords before Play Store upload. Do not commit them.");
}

module.exports = { assessSigningReadiness };

if (require.main === module) {
  main();
}
