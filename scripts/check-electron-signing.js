#!/usr/bin/env node
/**
 * GAP-008 — Verify Electron signing / updater config without inventing certificates.
 * Exit 0 when pilot-safe defaults are intact; exit 1 on dangerous placeholder publish.
 * Writes docs/release-evidence/electron-signing-check.json for GAP evidence.
 *
 * Flags:
 *   --strict  also fail when signAndEditExecutable=true without CSC_* (production mode)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const evidenceDir = path.join(root, "docs", "release-evidence");
const outPath = path.join(evidenceDir, "electron-signing-check.json");
const strict = process.argv.includes("--strict");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function isPlaceholderHost(url) {
  if (!url || typeof url !== "string") return false;
  return /example\.invalid|example\.com/i.test(url);
}

function resolveCscLink() {
  return process.env.CSC_LINK || process.env.WIN_CSC_LINK || "";
}

function assessElectronSigning() {
  const errors = [];
  const warnings = [];
  const notes = [];
  const pkg = readJson("package.json");
  const build = pkg.build || {};

  if (build.publish != null && build.publish !== false) {
    const pub = build.publish;
    const url = typeof pub === "object" ? String(pub.url || "") : String(pub);
    if (isPlaceholderHost(url)) {
      errors.push(`build.publish uses placeholder host: ${url}`);
    } else {
      notes.push(`build.publish configured: ${url || JSON.stringify(pub)}`);
    }
  } else {
    notes.push("build.publish is null (pilot-safe; set SMILE_UPDATE_FEED_URL for production)");
  }

  const signFlag = build.win?.signAndEditExecutable === true;
  const cscLink = resolveCscLink();
  const hasCsc = Boolean(cscLink || process.env.CSC_KEY_PASSWORD);
  let cscPathExists = null;
  if (cscLink && !/^https?:/i.test(cscLink) && !cscLink.includes("://")) {
    cscPathExists = fs.existsSync(cscLink);
    if (!cscPathExists) {
      warnings.push(`CSC_LINK path does not exist: ${cscLink}`);
      if (strict) errors.push(`CSC_LINK path missing: ${cscLink}`);
    } else {
      notes.push("CSC_LINK path exists on disk");
    }
  }

  if (signFlag) {
    if (!hasCsc) {
      const msg =
        "signAndEditExecutable=true but CSC_LINK/WIN_CSC_LINK/CSC_KEY_PASSWORD unset — electron-builder will fail or skip signing";
      if (strict) errors.push(msg);
      else warnings.push(msg);
    } else {
      notes.push("CSC_* env present for signing");
    }
  } else {
    notes.push("signAndEditExecutable=false (unsigned pilot OK; flip only with real certs)");
  }

  if (!fs.existsSync(path.join(root, "electron/updater.js"))) {
    errors.push("Missing electron/updater.js");
  } else {
    notes.push("electron/updater.js present (placeholder feeds blocked at runtime)");
  }

  if (!fs.existsSync(path.join(root, "docs/wave6-windows-exe.md"))) {
    errors.push("Missing docs/wave6-windows-exe.md");
  }

  const feed = process.env.SMILE_UPDATE_FEED_URL || "";
  if (feed && isPlaceholderHost(feed)) {
    errors.push("SMILE_UPDATE_FEED_URL is a placeholder host — refuse for production");
  } else if (feed) {
    notes.push(`SMILE_UPDATE_FEED_URL set (${feed})`);
  } else {
    notes.push("SMILE_UPDATE_FEED_URL unset (checks skipped until org feed exists)");
  }

  const pkgScripts = pkg.scripts || {};
  if (!pkgScripts["check:electron-signing"]) {
    errors.push("package.json missing check:electron-signing script");
  }
  if (!pkgScripts["build:exe"]) {
    errors.push("package.json missing build:exe script");
  }

  const productionReady =
    signFlag &&
    hasCsc &&
    cscPathExists !== false &&
    Boolean(feed) &&
    !isPlaceholderHost(feed) &&
    errors.length === 0;

  return {
    schemaVersion: "smile-trust-electron-signing-check/1.0",
    gapId: "GAP-008",
    backlogId: "TASK-000186",
    generatedAtUtc: new Date().toISOString(),
    strict,
    ok: errors.length === 0,
    productionReady,
    signAndEditExecutable: signFlag,
    cscEnvPresent: hasCsc,
    cscPathExists,
    updateFeedConfigured: Boolean(feed) && !isPlaceholderHost(feed),
    notes,
    warnings,
    errors
  };
}

function main() {
  const assessment = assessElectronSigning();
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(assessment, null, 2)}\n`, "utf8");

  console.log("check:electron-signing — GAP-008");
  for (const n of assessment.notes) console.log(`  note: ${n}`);
  for (const w of assessment.warnings) console.warn(`  warn: ${w}`);
  if (assessment.errors.length) {
    for (const e of assessment.errors) console.error(`  error: ${e}`);
    console.error(`  wrote ${path.relative(root, outPath)}`);
    process.exit(1);
  }
  console.log(`  productionReady=${assessment.productionReady}`);
  console.log(`  wrote ${path.relative(root, outPath)}`);
  console.log("  ok: signing/updater config is pilot-safe (no fake certs)");
  process.exit(0);
}

module.exports = { assessElectronSigning, isPlaceholderHost };

if (require.main === module) {
  main();
}
