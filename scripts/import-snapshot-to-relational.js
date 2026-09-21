#!/usr/bin/env node
/**
 * One-time import: localStorage snapshot JSON → Supabase PostgreSQL.
 *
 * Usage:
 *   node scripts/import-snapshot-to-relational.js [path-to-snapshot.json]
 *
 * Requires config.json with supabaseUrl, supabaseAnonKey, businessId.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "config.json");
const defaultSnapshot = path.join(root, "cloud-backup.json");

async function main() {
  const snapshotPath = process.argv[2] || defaultSnapshot;
  if (!fs.existsSync(configPath)) {
    console.error("Missing config.json — copy from config.example.json");
    process.exit(1);
  }
  if (!fs.existsSync(snapshotPath)) {
    console.error(`Snapshot not found: ${snapshotPath}`);
    console.error("");
    console.error("How to get a backup file:");
    console.error("  1. Open the app → Backup & Restore → Export backup");
    console.error("  2. Save the downloaded JSON (e.g. smile-trust-backup-YYYY-MM-DD.json)");
    console.error("  3. Run: node scripts/import-snapshot-to-relational.js \"path\\to\\that-file.json\"");
    console.error("");
    console.error("Or skip the file: in the app go to Settings → Go-live checklist →");
    console.error("  \"Import local data to PostgreSQL\" (uses data already in the app).");
    console.error("");
    console.error("If you have no data yet, skip import and start adding customers in the app.");
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const data = snapshot.data || snapshot;
  const businessCode = config.businessId || data.settings?.businessId;
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error("supabaseUrl and supabaseAnonKey required in config.json");
    process.exit(1);
  }
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/import_snapshot_batch`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ business_code: businessCode, snapshot: data })
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("Import failed:", response.status, text.slice(0, 500));
    process.exit(1);
  }
  console.log("Import successful:", text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
