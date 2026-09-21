#!/usr/bin/env node
/**
 * GAP-018 / TASK-000193 — Guard www/ SoT: www must match src after prepare:web.
 * Compares a sample of mirrored paths (hash). Does not invent deploy state.
 *
 * Usage:
 *   node scripts/check-www-sot.js           # fail if drift
 *   node scripts/check-www-sot.js --sample  # print sample only
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

/** High-signal mirrored paths (src → www/src or root → www). */
const SAMPLE_PATHS = [
  ["src/core/money.js", "www/src/core/money.js"],
  ["src/core/momo-webhook.js", "www/src/core/momo-webhook.js"],
  ["src/core/payment-ops.js", "www/src/core/payment-ops.js"],
  ["src/core/roles.js", "www/src/core/roles.js"],
  ["index.html", "www/index.html"],
  ["app.js", "www/app.js"],
  ["styles.css", "www/styles.css"]
];

function sha256File(abs) {
  const buf = fs.readFileSync(abs);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function assessWwwSot() {
  const mismatches = [];
  const missing = [];
  const matched = [];

  for (const [srcRel, wwwRel] of SAMPLE_PATHS) {
    const srcAbs = path.join(root, srcRel);
    const wwwAbs = path.join(root, wwwRel);
    if (!fs.existsSync(srcAbs)) {
      missing.push({ side: "src", path: srcRel });
      continue;
    }
    if (!fs.existsSync(wwwAbs)) {
      missing.push({ side: "www", path: wwwRel });
      continue;
    }
    const srcHash = sha256File(srcAbs);
    const wwwHash = sha256File(wwwAbs);
    if (srcHash !== wwwHash) {
      mismatches.push({ src: srcRel, www: wwwRel, srcHash, wwwHash });
    } else {
      matched.push(srcRel);
    }
  }

  return {
    ok: mismatches.length === 0 && missing.length === 0,
    sampleSize: SAMPLE_PATHS.length,
    matched: matched.length,
    mismatches,
    missing,
    regenerateHint: "npm run prepare:web",
    gap: "GAP-018",
    backlogId: "TASK-000193"
  };
}

function main() {
  const sampleOnly = process.argv.includes("--sample");
  const result = assessWwwSot();
  const payload = JSON.stringify(result, null, 2);
  if (sampleOnly) {
    console.log(payload);
    process.exit(0);
  }
  if (!result.ok) {
    console.error("check:www-sot FAILED — www/ drifted from src/ (or missing mirror).");
    console.error(payload);
    console.error(`Regenerate: ${result.regenerateHint}`);
    process.exit(1);
  }
  console.log(`check:www-sot OK — ${result.matched}/${result.sampleSize} sample paths match.`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { assessWwwSot, SAMPLE_PATHS };
