/**
 * Wave 10 — Node CLI: assess production go-live pack, write evidence.
 * Exit 0 for FrameworkReady / Conditional / AwaitingApprovals awaiting humans.
 * Exit non-zero only on hard blockers (missing RC1, broken pack, Wave 9 entry fail).
 * Does not claim live production cutover. Never auto-Approves Executive Sign-Off.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");

function existsPath(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readJson(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

async function main() {
  const startedAt = new Date().toISOString();
  const mod = await import(
    pathToFileURL(path.join(ROOT, "src/core/wave10-production-golive-ops.js")).href
  );
  const {
    buildGoliveEvidencePackage,
    seedSyntheticGoliveRun,
    renderExecutiveSignOffPackageMarkdown,
    WAVE10_VERSION
  } = mod;

  console.log(`[wave10] validate:golive starting (${WAVE10_VERSION})`);

  let packageJson = {};
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch {
    packageJson = {};
  }

  const rc1 =
    readJson("docs/release-evidence/rc1-evidence.json") ||
    readJson("artifacts/wave8/rc1-evidence.json");

  const wave9 =
    readJson("docs/release-evidence/wave9-pilot-evidence.json") ||
    readJson("artifacts/wave9/wave9-pilot-evidence.json");

  if (!rc1) {
    console.warn("[wave10] RC1 evidence not found — hard blocker until validate:rc PASS exists");
  } else {
    console.log(`[wave10] RC1 decision=${rc1.decision} readyForWave9=${rc1.readyForWave9}`);
  }

  if (!wave9) {
    console.warn("[wave10] Wave 9 evidence not found — hard blocker until validate:pilot Conditional/Go exists");
  } else {
    console.log(
      `[wave10] Wave9 decision=${wave9.goNoGo?.decision} readyForWave10=${wave9.goNoGo?.readyForWave10}`
    );
  }

  const requiredDocs = [
    "docs/wave10-production-golive.md",
    "src/core/wave10-production-golive-ops.js",
    "src/ui/wave10-golive-views.js",
    "tests/wave10-production-golive.test.js"
  ];
  const missingDocs = requiredDocs.filter((p) => !existsPath(p));
  if (missingDocs.length) {
    console.error(`[wave10] missing pack files: ${missingDocs.join(", ")}`);
  }

  const goliveRun = seedSyntheticGoliveRun({ startedAt });
  const finishedAt = new Date().toISOString();
  const evidence = buildGoliveEvidencePackage({
    rc1Evidence: rc1,
    wave9Evidence: wave9,
    goliveRun,
    startedAt,
    finishedAt,
    packageJson,
    packFilesMissing: missingDocs.length > 0
  });

  const releaseDir = path.join(ROOT, "docs", "release-evidence");
  const artifactDir = path.join(ROOT, "artifacts", "wave10");
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  const primary = path.join(releaseDir, "wave10-golive-evidence.json");
  const latest = path.join(releaseDir, "latest-golive-evidence.json");
  const artifact = path.join(artifactDir, "wave10-golive-evidence.json");
  fs.writeFileSync(primary, body, "utf8");
  fs.writeFileSync(latest, body, "utf8");
  fs.writeFileSync(artifact, body, "utf8");

  const execMd = renderExecutiveSignOffPackageMarkdown(evidence);
  const execPath = path.join(ROOT, "docs", "wave10-executive-signoff-draft.md");
  fs.writeFileSync(execPath, execMd, "utf8");
  fs.writeFileSync(path.join(artifactDir, "executive-signoff-draft.md"), execMd, "utf8");

  const decision = evidence.goLive?.decision;
  const hard = evidence.goLive?.hardBlockers || [];
  console.log(`[wave10] decision=${decision}`);
  console.log(`[wave10] frameworkReady=${evidence.claim?.frameworkReady}`);
  console.log(`[wave10] CERT-001 certified=${evidence.goLive?.cert001?.certified}`);
  console.log(`[wave10] evidence=${primary}`);
  console.log(`[wave10] artifact=${artifact}`);
  if (evidence.goLive?.conditions?.length) {
    console.log(`[wave10] conditions=${evidence.goLive.conditions.slice(0, 8).join(", ")}`);
  }
  if (hard.length) {
    console.log(`[wave10] hardBlockers=${hard.join(", ")}`);
  }

  // Exit non-zero only on hard blockers
  if (hard.length > 0) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error("[wave10] validate:golive crashed", err);
  process.exitCode = 1;
});
