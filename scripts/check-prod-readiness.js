#!/usr/bin/env node
/**
 * Production-readiness dashboard (read-only).
 * Reports Ready / Blocked / Partial for tests, RC1, HA statuses, Android APK, signing env,
 * www SoT, deploy profiles, and bootstrap password guard (GAP-024).
 * Never flips HA-* gates, never invents certs, never deploys.
 *
 * Flags:
 *   (default)     Do NOT run npm test — only reports that test files exist (Partial).
 *   --run-tests   Execute npm test and report pass/fail (slower; use for release gates).
 *   --json        Print JSON only.
 *
 * Docs: docs/backlog/org-handoff-checklist.md · docs/backlog/blocked-on-org.md
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const runTests = process.argv.includes("--run-tests");
const jsonOnly = process.argv.includes("--json");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function statusOf(ok, blockedReason, partial = false) {
  if (ok && !partial) return { status: "Ready", detail: blockedReason || "ok" };
  if (partial) return { status: "Partial", detail: blockedReason || "partial" };
  return { status: "Blocked", detail: blockedReason || "blocked" };
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

function assessTests() {
  const testDir = path.join(root, "tests");
  const files = fs.existsSync(testDir)
    ? fs.readdirSync(testDir).filter((f) => f.endsWith(".test.js"))
    : [];
  if (!files.length) {
    return statusOf(false, "no tests/*.test.js files");
  }
  if (!runTests) {
    return statusOf(
      true,
      `${files.length} test files present (default skips execution; pass --run-tests to execute npm test)`,
      true
    );
  }
  // Windows needs shell so npm.cmd resolves; without it status is often null.
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["test"],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      shell: process.platform === "win32"
    }
  );
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  const passMatch = out.match(/# pass\s+(\d+)/);
  const failMatch = out.match(/# fail\s+(\d+)/);
  const pass = passMatch ? Number(passMatch[1]) : null;
  const fail = failMatch ? Number(failMatch[1]) : null;
  if ((result.status ?? 1) === 0 && (fail == null || fail === 0)) {
    return statusOf(true, pass != null ? `${pass} pass / 0 fail` : "npm test exit 0");
  }
  return statusOf(
    false,
    fail != null ? `${pass || 0} pass / ${fail} fail` : `npm test exit ${result.status}`
  );
}

function assessRc1() {
  const rc1 =
    readJson("docs/release-evidence/rc1-evidence.json") ||
    readJson("artifacts/wave8/rc1-evidence.json");
  if (!rc1) return statusOf(false, "rc1-evidence.json missing");
  if (rc1.decision === "PASS" && rc1.readyForWave9) {
    return statusOf(true, `decision=${rc1.decision}`);
  }
  return statusOf(false, `decision=${rc1.decision || "unknown"} readyForWave9=${rc1.readyForWave9}`);
}

function assessHaStatuses() {
  const wave9 =
    readJson("docs/release-evidence/wave9-pilot-evidence.json") ||
    readJson("artifacts/wave9/wave9-pilot-evidence.json");
  if (!wave9) return statusOf(false, "wave9-pilot-evidence.json missing");
  const approvals =
    wave9.goNoGo?.humanApprovals ||
    wave9.humanApprovals ||
    [];
  const rows = approvals.map((a) => ({
    id: a.id,
    status: a.status || "PendingHumanSignOff"
  }));
  const pending = rows.filter((r) => /pending/i.test(String(r.status)));
  const approved = rows.filter((r) => /approved/i.test(String(r.status)));
  if (rows.length === 0) {
    return {
      ...statusOf(false, "no HA-* rows in evidence"),
      gates: []
    };
  }
  if (pending.length === 0 && approved.length === rows.length) {
    return {
      ...statusOf(true, `all ${approved.length} HA-* Approved (read-only check)`),
      gates: rows
    };
  }
  return {
    ...statusOf(
      false,
      `${pending.length}/${rows.length} still PendingHumanSignOff (read-only; not flipped)`
    ),
    gates: rows
  };
}

function assessAndroidApk() {
  const debug = findDebugApk();
  const release = findReleaseApk();
  if (debug && release) {
    return statusOf(true, `debug=${debug}; release=${release}`);
  }
  if (debug) {
    return statusOf(true, `debug present (${debug}); release APK absent (org keystore)`, true);
  }
  return statusOf(false, "no debug APK under android/app/build/outputs/apk/debug/");
}

function assessSigningEnv() {
  const androidStore = Boolean(process.env.SMILE_ANDROID_STORE_PASSWORD);
  const androidKeystoreFile = process.env.SMILE_ANDROID_KEYSTORE_FILE || "";
  const androidKeystoreOk = androidKeystoreFile ? fs.existsSync(androidKeystoreFile) : false;
  const allowLocal = process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE === "1";
  const props = exists("android/keystore.properties");
  const androidReady =
    androidStore || androidKeystoreOk || allowLocal || props;

  const csc = Boolean(
    process.env.CSC_LINK || process.env.WIN_CSC_LINK || process.env.CSC_KEY_PASSWORD
  );
  const feed = process.env.SMILE_UPDATE_FEED_URL || "";
  const electronReady = csc && feed && !/example\.(invalid|com)/i.test(feed);

  if (androidReady && electronReady) {
    return statusOf(true, "Android + Electron signing env present");
  }
  if (androidReady || csc || feed) {
    return statusOf(
      true,
      [
        androidReady ? "Android signing path available" : "Android signing env missing",
        csc ? "CSC_* present" : "CSC_* missing",
        feed ? "update feed set" : "SMILE_UPDATE_FEED_URL unset"
      ].join("; "),
      true
    );
  }
  return statusOf(
    false,
    "No SMILE_ANDROID_* / CSC_* / SMILE_UPDATE_FEED_URL (do not invent certs)"
  );
}

function assessGitRemote() {
  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    return statusOf(false, "not a git repo / .git missing");
  }
  try {
    const result = spawnSync("git", ["remote", "-v"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    const out = (result.stdout || "").trim();
    if (!out) return statusOf(false, "no git remotes configured (see docs/ci-remote-connect.md)");
    return statusOf(true, out.split("\n")[0], true);
  } catch {
    return statusOf(false, "git remote check failed");
  }
}

function assessMigrationsDoc() {
  const prod = exists("PRODUCTION.md");
  if (!prod) return statusOf(false, "PRODUCTION.md missing");
  const text = fs.readFileSync(path.join(root, "PRODUCTION.md"), "utf8");
  const has045 = /045_app_users_role_rbac_align\.sql/.test(text);
  const has001 = /001_financial_core\.sql/.test(text);
  if (has001 && has045) {
    return statusOf(true, "PRODUCTION.md lists 001–045 (apply on UAT only — not prod from this script)");
  }
  return statusOf(false, "PRODUCTION.md incomplete migration list");
}

function assessWwwSot() {
  try {
    const { assessWwwSot: assess } = require("./check-www-sot.js");
    const a = assess();
    if (a.ok) {
      return statusOf(true, `www/ matches src/ sample ${a.matched}/${a.sampleSize} (GAP-018)`);
    }
    const drift = (a.mismatches || []).length;
    const miss = (a.missing || []).length;
    return statusOf(false, `www SoT drift mismatches=${drift} missing=${miss} — run prepare:web`);
  } catch (err) {
    return statusOf(false, `check-www-sot failed: ${err.message || err}`);
  }
}

function assessDeployProfiles() {
  const pilot = readJson("deploy/profiles/pilot.json");
  const prod = readJson("deploy/profiles/prod.json");
  if (!pilot || !prod) {
    return statusOf(false, "deploy/profiles/pilot.json or prod.json missing (GAP-016)");
  }
  if (pilot.profileId === "pilot" && prod.profileId === "prod") {
    return statusOf(true, "pilot≠prod manifests present (non-secret)");
  }
  return statusOf(false, "deploy profileIds unexpected");
}

function assessBootstrapPasswordGuard() {
  const config = readJson("config.json") || readJson("config.example.json") || {};
  const productionMode =
    config.productionMode === true || process.env.SMILE_PRODUCTION_MODE === "1";
  // Mirror src/core/production-guards.js BOOTSTRAP_DEFAULT_PASSWORDS (CJS cannot import ESM).
  const defaults = ["7049", "05491", "change-me", "change-me-immediately", "password", "1234"];
  const hasDefault = [
    config.defaultOwnerPassword,
    config.developerPassword,
    config.defaultKbaPassword,
    config.defaultSuperAdminPassword,
    config.defaultDeveloperPassword
  ].some((v) => defaults.includes(String(v || "").trim()));

  if (!productionMode) {
    return statusOf(
      true,
      hasDefault
        ? "config has bootstrap defaults; productionMode off (Partial until live secrets)"
        : "no known bootstrap defaults; productionMode off",
      hasDefault
    );
  }
  if (hasDefault) {
    return statusOf(false, "productionMode on with bootstrap default passwords (GAP-024 fail-closed)");
  }
  return statusOf(true, "productionMode on; bootstrap defaults not detected in config");
}

function assessChannelScripts() {
  const needed = [
    "scripts/check-channels.js",
    "scripts/check-android-path.js",
    "scripts/check-electron-signing.js",
    "scripts/check-www-sot.js"
  ];
  const missing = needed.filter((rel) => !exists(rel));
  if (missing.length) {
    return statusOf(false, `missing ${missing.join(", ")}`);
  }
  return statusOf(true, "channel smoke scripts present (run: npm run check:channels)");
}

function assessOrgBlockedDoc() {
  if (!exists("docs/backlog/blocked-on-org.md")) {
    return statusOf(false, "docs/backlog/blocked-on-org.md missing");
  }
  return statusOf(true, "blocked-on-org.md published (org/human hard stops)");
}

function main() {
  const checks = {
    tests: assessTests(),
    rc1Evidence: assessRc1(),
    haStatuses: assessHaStatuses(),
    androidDebugApk: assessAndroidApk(),
    signingEnv: assessSigningEnv(),
    gitRemote: assessGitRemote(),
    migrationsDoc: assessMigrationsDoc(),
    wwwSot: assessWwwSot(),
    deployProfiles: assessDeployProfiles(),
    bootstrapPasswordGuard: assessBootstrapPasswordGuard(),
    channelScripts: assessChannelScripts(),
    orgBlockedDoc: assessOrgBlockedDoc()
  };

  const summary = {
    schemaVersion: "smile-trust-prod-readiness/1.1",
    generatedAtUtc: new Date().toISOString(),
    runTests,
    runTestsDefault: false,
    runTestsHint:
      "Default skips npm test (Partial). Pass --run-tests to execute the suite for a Ready tests row.",
    note: "Read-only dashboard. Does not flip HA-* gates, invent certs, or deploy.",
    checks,
    counts: {
      ready: Object.values(checks).filter((c) => c.status === "Ready").length,
      partial: Object.values(checks).filter((c) => c.status === "Partial").length,
      blocked: Object.values(checks).filter((c) => c.status === "Blocked").length
    }
  };

  const outPath = path.join(root, "docs", "release-evidence", "prod-readiness-check.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (jsonOnly) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("check:prod-readiness — read-only (no gate flips)");
    console.log(
      `  tests mode: ${runTests ? "--run-tests (executing)" : "default (skip execution; use --run-tests)"}`
    );
    for (const [key, val] of Object.entries(checks)) {
      const gateHint =
        key === "haStatuses" && Array.isArray(val.gates)
          ? ` | ${val.gates.map((g) => `${g.id}=${g.status}`).join(", ")}`
          : "";
      console.log(`  ${key}: ${val.status} — ${val.detail}${gateHint}`);
    }
    console.log(
      `  summary: Ready=${summary.counts.ready} Partial=${summary.counts.partial} Blocked=${summary.counts.blocked}`
    );
    console.log(`  wrote ${path.relative(root, outPath)}`);
  }

  process.exit(0);
}

module.exports = {
  assessTests,
  assessRc1,
  assessHaStatuses,
  assessAndroidApk,
  assessSigningEnv,
  assessWwwSot,
  assessDeployProfiles,
  assessBootstrapPasswordGuard,
  assessChannelScripts
};

if (require.main === module) {
  main();
}
