/**
 * Wave 8 — Node CLI: prepare:web + npm test + Phase 16 RC evidence writer.
 * Exit non-zero when RC decision is FAIL.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");

function existsPath(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function runNpm(args) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    status: result.status == null ? 1 : result.status,
    stdout: `${result.stdout || ""}${result.stderr || ""}`,
    error: result.error
  };
}

function runNpmScript(script) {
  return runNpm(["run", script]);
}

function runNpmTest() {
  return runNpm(["test"]);
}

async function main() {
  const startedAt = new Date().toISOString();
  const mod = await import(pathToFileURL(path.join(ROOT, "src/core/wave8-release-certification.js")).href);
  const {
    buildRcEvidencePackage,
    summarizeNodeTestOutput,
    WAVE8_VERSION
  } = mod;

  console.log(`[wave8] validate:rc starting (${WAVE8_VERSION})`);

  const prepare = runNpmScript("prepare:web");
  const preparedWeb = prepare.status === 0;
  if (!preparedWeb) {
    console.error("[wave8] prepare:web failed");
    if (prepare.error) console.error(prepare.error);
    console.error(prepare.stdout.slice(-2000));
  } else {
    console.log("[wave8] prepare:web ok");
  }

  // Migration / electron presence checks (non-fatal individually; captured in smoke)
  const migrationOk = existsPath("db") || existsPath("supabase");
  const electronOk = existsPath("electron/main.js");
  console.log(`[wave8] migration roots present=${migrationOk}; electron=${electronOk}`);

  const testRun = runNpmTest();
  const testSummary = summarizeNodeTestOutput(testRun.stdout);
  if (testRun.error) {
    console.error("[wave8] npm test spawn error", testRun.error);
  }
  if (testRun.status !== 0 && testSummary.failed === 0) {
    testSummary.failed = Math.max(1, testSummary.failed);
    testSummary.passRate = testSummary.requiredTotal
      ? Math.min(99.99, Math.round((testSummary.passed / testSummary.requiredTotal) * 10000) / 100)
      : 0;
  }
  console.log(`[wave8] npm test pass=${testSummary.passed} fail=${testSummary.failed} skipped=${testSummary.skipped} total=${testSummary.total} required=${testSummary.requiredTotal} rate=${testSummary.passRate}%`);
  console.log(`[wave8] expected platform skips=${testSummary.expectedPlatformSkips} unexpected skips=${testSummary.unexpectedSkipCount}${testSummary.skipsClassified ? "" : " (not every skip could be identified and approved)"}`);
  for (const item of testSummary.expectedSkips || []) {
    console.log(`[wave8]   expected skip on ${item.platform}: ${item.name} (${item.file}) — ${item.reason}`);
  }
  for (const item of testSummary.unexpectedSkips || []) {
    console.log(`[wave8]   UNEXPECTED skip: ${item.name}${item.skipReason ? ` — ${item.skipReason}` : ""}`);
  }
  if (testSummary.total === 0) {
    console.error("[wave8] npm test output (tail):");
    console.error(testRun.stdout.slice(-3000));
  }

  let packageJson = {};
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch {
    packageJson = {};
  }

  const finishedAt = new Date().toISOString();
  const evidence = buildRcEvidencePackage({
    existsPath,
    readText,
    packageJson,
    testSummary,
    preparedWeb,
    startedAt,
    finishedAt
  });

  const releaseDir = path.join(ROOT, "docs", "release-evidence");
  const artifactDir = path.join(ROOT, "artifacts", "wave8");
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  const primary = path.join(releaseDir, "rc1-evidence.json");
  const latest = path.join(releaseDir, "latest-rc-evidence.json");
  const artifact = path.join(artifactDir, "rc1-evidence.json");
  fs.writeFileSync(primary, body, "utf8");
  fs.writeFileSync(latest, body, "utf8");
  fs.writeFileSync(artifact, body, "utf8");

  console.log(`[wave8] RC decision=${evidence.decision}`);
  console.log(`[wave8] evidence=${primary}`);
  console.log(`[wave8] artifact=${artifact}`);
  if (evidence.blockers?.length) {
    console.log(`[wave8] blockers=${evidence.blockers.join(", ")}`);
  }

  if (evidence.decision !== "PASS") {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error("[wave8] validate:rc crashed", err);
  process.exitCode = 1;
});
