#!/usr/bin/env node
/**
 * Apply supabase/rls.sql + migrations 001–045 to **local/UAT only**.
 *
 * Safety:
 *   - Requires explicit flag: --i-understand-uat-only
 *   - Connection URL from SMILE_UAT_DATABASE_URL only (never invents; never defaults to prod)
 *   - Refuses if URL equals SMILE_PROD_DATABASE_URL or looks like a production host
 *   - Default is --dry-run (list files); pass --apply to execute via psql
 *
 * Usage (PowerShell):
 *   $env:SMILE_UAT_DATABASE_URL = "postgresql://...uat..."
 *   node scripts/apply-uat-migrations.js --i-understand-uat-only
 *   node scripts/apply-uat-migrations.js --i-understand-uat-only --apply
 *
 * Docs: scripts/apply-uat-migrations.md · PRODUCTION.md · docs/backlog/blocked-on-org.md
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const confirm = process.argv.includes("--i-understand-uat-only");
const doApply = process.argv.includes("--apply");
const jsonOnly = process.argv.includes("--json");

const PROD_HINT =
  /(prod(uction)?[-_.]|[-_.]prod(uction)?\b|live[-_.]db|smile.?trust.?prod)/i;

function die(msg, code = 1) {
  console.error(`apply-uat-migrations: ${msg}`);
  process.exit(code);
}

function listMigrationFiles() {
  const files = [{ rel: "supabase/rls.sql", order: 0 }];
  const migDir = path.join(root, "supabase", "migrations");
  const names = fs
    .readdirSync(migDir)
    .filter((n) => /^\d{3}_.+\.sql$/i.test(n))
    .sort();
  for (const name of names) {
    const num = Number(name.slice(0, 3));
    if (num >= 1 && num <= 45) {
      files.push({ rel: path.join("supabase", "migrations", name).replace(/\\/g, "/"), order: num });
    }
  }
  return files;
}

function assertUatUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    die(
      "SMILE_UAT_DATABASE_URL is required.\n" +
        "  Never use a production connection string.\n" +
        "  See scripts/apply-uat-migrations.md"
    );
  }
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    die("SMILE_UAT_DATABASE_URL must be a postgresql:// connection string.");
  }
  const prodUrl = String(process.env.SMILE_PROD_DATABASE_URL || "").trim();
  if (prodUrl && trimmed === prodUrl) {
    die("Refusing: SMILE_UAT_DATABASE_URL equals SMILE_PROD_DATABASE_URL.");
  }
  // Strip credentials for host checks
  let hostPath = trimmed.replace(/^postgres(ql)?:\/\//i, "").replace(/^[^@]+@/, "");
  if (PROD_HINT.test(hostPath) || PROD_HINT.test(trimmed)) {
    die(
      "Refusing: connection string looks production-like. Use a UAT/local DB only.\n" +
        "  If this is a false positive, rename the UAT host or set a non-prod-looking URL."
    );
  }
  if (process.env.SMILE_ALLOW_PROD_MIGRATE === "1") {
    die("Refusing: SMILE_ALLOW_PROD_MIGRATE is set — this script never applies to production.");
  }
  return trimmed;
}

function runPsql(url, fileRel) {
  const full = path.join(root, fileRel);
  const result = spawnSync(
    "psql",
    [url, "-v", "ON_ERROR_STOP=1", "-f", full],
    { cwd: root, encoding: "utf8", windowsHide: true, shell: process.platform === "win32" }
  );
  return result;
}

function main() {
  if (!confirm) {
    die(
      "Refusing without --i-understand-uat-only.\n" +
        "  This script targets local/UAT only and will not default to production.\n" +
        "  Example:\n" +
        "    node scripts/apply-uat-migrations.js --i-understand-uat-only\n" +
        "    node scripts/apply-uat-migrations.js --i-understand-uat-only --apply"
    );
  }

  const files = listMigrationFiles();
  const missing = files.filter((f) => !fs.existsSync(path.join(root, f.rel)));
  if (missing.length) {
    die(`Missing migration files: ${missing.map((m) => m.rel).join(", ")}`);
  }

  const through045 = files.some((f) => f.order === 45);
  if (!through045) {
    die("Expected migrations through 045_*.sql — list incomplete.");
  }

  const summary = {
    schemaVersion: "smile-trust-uat-migrations/1.0",
    target: "uat-or-local-only",
    confirmFlag: "--i-understand-uat-only",
    apply: doApply,
    fileCount: files.length,
    files: files.map((f) => f.rel),
    note: "Never apply this script against production. Agents must not invent DB URLs."
  };

  if (!doApply) {
    if (jsonOnly) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log("apply-uat-migrations — dry-run (UAT/local only)");
      console.log("  flag: --i-understand-uat-only acknowledged");
      console.log(`  files (${files.length}): rls.sql + 001…045`);
      for (const f of files) {
        console.log(`    [${String(f.order).padStart(2, "0")}] ${f.rel}`);
      }
      console.log("  To execute: set SMILE_UAT_DATABASE_URL, then re-run with --apply");
      console.log("  Wrote plan only — no database changes.");
    }
    process.exit(0);
  }

  const url = assertUatUrl(process.env.SMILE_UAT_DATABASE_URL);
  console.log("apply-uat-migrations — APPLY to UAT/local (not production)");
  console.log(`  files: ${files.length}`);

  for (const f of files) {
    console.log(`  applying ${f.rel} …`);
    const result = runPsql(url, f.rel);
    if ((result.status ?? 1) !== 0) {
      console.error(result.stderr || result.stdout || "psql failed");
      die(`Stopped at ${f.rel} (exit ${result.status}). Fix and re-run; do not continue on prod.`);
    }
  }

  console.log("  ok: rls.sql + 001–045 applied on SMILE_UAT_DATABASE_URL target");
  console.log("  next: staff role smoke on UAT (GAP-010) — still no prod migrate");
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { listMigrationFiles, assertUatUrl };
