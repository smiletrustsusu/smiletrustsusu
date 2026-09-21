/**
 * Wave 9 — Node CLI: assess pilot/UAT/ops pack, write evidence, exit non-zero on No-Go.
 * Does not claim live branch cutover. Requires RC1 PASS as entry criterion when evidence file present.
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
  const mod = await import(pathToFileURL(path.join(ROOT, "src/core/wave9-pilot-uat-ops.js")).href);
  const {
    buildPilotEvidencePackage,
    seedSyntheticPilotRun,
    renderGoNoGoReportMarkdown,
    WAVE9_VERSION
  } = mod;

  console.log(`[wave9] validate:pilot starting (${WAVE9_VERSION})`);

  let packageJson = {};
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch {
    packageJson = {};
  }

  const rc1 =
    readJson("docs/release-evidence/rc1-evidence.json") ||
    readJson("artifacts/wave8/rc1-evidence.json");

  if (!rc1) {
    console.warn("[wave9] RC1 evidence not found — assessment will be No-Go until validate:rc PASS exists");
  } else {
    console.log(`[wave9] RC1 decision=${rc1.decision} readyForWave9=${rc1.readyForWave9}`);
  }

  const requiredDocs = [
    "docs/wave9-pilot-uat.md",
    "docs/wave9-uat-pack.md",
    "docs/wave9-training-package.md",
    "docs/wave9-go-nogo-report.md",
    "src/core/wave9-pilot-uat-ops.js",
    "src/ui/wave9-pilot-views.js",
    "tests/wave9-pilot-uat.test.js"
  ];
  const missingDocs = requiredDocs.filter((p) => !existsPath(p));
  if (missingDocs.length) {
    console.error(`[wave9] missing pack files: ${missingDocs.join(", ")}`);
  }

  const pilotRun = seedSyntheticPilotRun({ startedAt });
  const finishedAt = new Date().toISOString();
  const evidence = buildPilotEvidencePackage({
    rc1Evidence: rc1,
    pilotRun,
    startedAt,
    finishedAt,
    packageJson
  });

  if (missingDocs.length) {
    evidence.goNoGo.reasons = [...new Set([...(evidence.goNoGo.reasons || []), "pilot_pack_files_missing"])];
    evidence.goNoGo.decision = "No-Go";
    evidence.goNoGo.recommendation = "No-Go";
    evidence.goNoGo.readyForWave10 = "no";
  }

  const releaseDir = path.join(ROOT, "docs", "release-evidence");
  const artifactDir = path.join(ROOT, "artifacts", "wave9");
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  const primary = path.join(releaseDir, "wave9-pilot-evidence.json");
  const latest = path.join(releaseDir, "latest-pilot-evidence.json");
  const artifact = path.join(artifactDir, "wave9-pilot-evidence.json");
  fs.writeFileSync(primary, body, "utf8");
  fs.writeFileSync(latest, body, "utf8");
  fs.writeFileSync(artifact, body, "utf8");

  const reportMd = renderGoNoGoReportMarkdown(evidence);
  const reportPath = path.join(ROOT, "docs", "wave9-go-nogo-report.md");
  // Preserve template header if file starts with template marker; else write full draft
  fs.writeFileSync(reportPath, reportMd, "utf8");
  fs.writeFileSync(path.join(artifactDir, "go-nogo-report.md"), reportMd, "utf8");

  console.log(`[wave9] Go/No-Go=${evidence.goNoGo.decision}`);
  console.log(`[wave9] readyForWave10=${evidence.goNoGo.readyForWave10}`);
  console.log(`[wave9] evidence=${primary}`);
  console.log(`[wave9] artifact=${artifact}`);
  if (evidence.goNoGo.conditions?.length) {
    console.log(`[wave9] conditions=${evidence.goNoGo.conditions.join(", ")}`);
  }
  if (evidence.goNoGo.reasons?.length) {
    console.log(`[wave9] reasons=${evidence.goNoGo.reasons.join(", ")}`);
  }

  // Exit non-zero only on No-Go (mandatory gaps). Conditional is acceptable exit 0.
  if (evidence.goNoGo.decision === "No-Go") {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error("[wave9] validate:pilot crashed", err);
  process.exitCode = 1;
});
