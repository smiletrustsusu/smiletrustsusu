#!/usr/bin/env node
/**
 * Wave 10 — Local CO-* timestamp recorder (file-backed).
 * Does not mark Accepted / CERT-001 / liveProductionCutover.
 *
 * Usage (PowerShell — use ; not &&):
 *   node scripts/wave10-cutover-record.js --list
 *   node scripts/wave10-cutover-record.js --step CO-01 --owner "Release Manager" --notes "freeze confirmed (rehearsal)"
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "release-evidence", "wave10-cutover-run-sheet.json");

function parseArgs(argv) {
  const out = { list: false, step: null, owner: "", notes: "", startedAt: null, completedAt: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--step") out.step = argv[++i];
    else if (a === "--owner") out.owner = argv[++i];
    else if (a === "--notes") out.notes = argv[++i];
    else if (a === "--started-at") out.startedAt = argv[++i];
    else if (a === "--completed-at") out.completedAt = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mod = await import(
    pathToFileURL(path.join(ROOT, "src/core/wave10-cutover-recording.js")).href
  );
  const {
    createCutoverRunSheet,
    recordCutoverStepTimestamp,
    refreshCutoverRunSheetScores,
    ensureCutoverNeverAccepted,
    CUTOVER_RUN_SHEET_SCHEMA
  } = mod;

  let sheet = null;
  if (fs.existsSync(OUT)) {
    try {
      sheet = JSON.parse(fs.readFileSync(OUT, "utf8"));
      ensureCutoverNeverAccepted(sheet);
    } catch {
      sheet = null;
    }
  }
  if (!sheet || sheet.schemaVersion !== CUTOVER_RUN_SHEET_SCHEMA) {
    sheet = createCutoverRunSheet();
  }

  if (args.list) {
    refreshCutoverRunSheetScores(sheet);
    console.log(`[wave10-cutover] status=${sheet.status} timestamped=${sheet.scores?.timestamped || 0}/${sheet.scores?.total || 0}`);
    console.log(`[wave10-cutover] claim.liveProductionAccepted=${sheet.claim?.liveProductionAccepted}`);
    for (const s of sheet.steps || []) {
      console.log(
        `  ${s.id}  ${s.status}  started=${s.startedAt || "—"}  completed=${s.completedAt || "—"}  owner=${s.ownerName || "—"}`
      );
    }
    process.exit(0);
  }

  if (!args.step) {
    console.error("Usage: node scripts/wave10-cutover-record.js --step CO-01 --owner \"Name\" [--notes \"...\"]");
    console.error("       node scripts/wave10-cutover-record.js --list");
    process.exit(1);
  }

  const result = recordCutoverStepTimestamp(sheet, args.step, {
    ownerName: args.owner,
    notes: args.notes,
    startedAt: args.startedAt,
    completedAt: args.completedAt,
    outcome: "recorded"
  });
  if (!result.ok) {
    console.error(`[wave10-cutover] refused: ${result.error} ${result.message || ""}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(sheet, null, 2)}\n`, "utf8");
  console.log(`[wave10-cutover] recorded ${args.step} status=${result.step.status}`);
  console.log(`[wave10-cutover] wrote ${path.relative(ROOT, OUT)}`);
  console.log("[wave10-cutover] Accepted / CERT-001 remain false (rehearsal only)");
  process.exit(0);
}

main().catch((err) => {
  console.error("[wave10-cutover] crashed", err);
  process.exit(1);
});
