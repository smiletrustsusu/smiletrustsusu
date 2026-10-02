/**
 * Wave 2 database platform — static validation of migrations, registry, SQL objects, docs.
 * Does not require a live Supabase/Postgres instance.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATABASE_MIGRATIONS,
  DATABASE_TABLES,
  listMigrations,
  getTable,
  validateDatabaseRegistry
} from "../src/core/canonical-database-registry.js";
import { listBacklogForWave, getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIG_DIR = path.join(ROOT, "supabase", "migrations");
const ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "044_wave2_database_platform.rollback.sql");
const WAVE2_SQL = path.join(MIG_DIR, "044_wave2_database_platform.sql");
const WAVE2_DOC = path.join(ROOT, "docs", "wave2-database.md");

const WAVE2_RPCS = [
  "upsert_customer_from_client",
  "record_deposit_from_client",
  "record_withdrawal_from_client",
  "record_loan_repayment_from_client",
  "record_eod_snapshot",
  "fetch_cashbook_summary",
  "fetch_dashboard_kpis",
  "ack_sync_queue_item",
  "append_audit_event",
  "enqueue_offline_item"
];

const LEGACY_RPCS = ["record_collection_from_client", "ensure_customer", "fetch_business_snapshot"];

const CRITICAL_VIEWS = [
  "v_branch_collection_daily",
  "v_customer_balance_summary",
  "v_loan_portfolio_kpi",
  "v_cashbook_daily",
  "v_dashboard_ops_kpi"
];

const WAVE2_TABLES = [
  "schema_migration_log",
  "wave2_platform_meta",
  "offline_queue",
  "bcdr_drill_log"
];

function migrationFiles() {
  return fs
    .readdirSync(MIG_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
    .sort();
}

function allMigrationSql() {
  return migrationFiles()
    .map((f) => fs.readFileSync(path.join(MIG_DIR, f), "utf8"))
    .join("\n");
}

test("migration files are strictly sequenced without gaps in numbering", () => {
  const files = migrationFiles();
  assert.ok(files.length >= 45, `expected >= 45 migrations, got ${files.length}`);
  const orders = files.map((f) => Number(f.slice(0, 3)));
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] > orders[i - 1], `${files[i - 1]} then ${files[i]}`);
  }
  assert.ok(files.includes("044_wave2_database_platform.sql"));
  assert.ok(files.includes("045_app_users_role_rbac_align.sql"));
  assert.ok(files.includes("046_server_side_authorization.sql"));
  assert.ok(files.includes("047_security_hardening.sql"));
  assert.equal(orders[orders.length - 1], 47);
});

test("registry migrations match disk and validateDatabaseRegistry ok", () => {
  const files = migrationFiles();
  const reg = listMigrations();
  assert.equal(reg.length, DATABASE_MIGRATIONS.length);
  for (const m of reg) {
    const name = m.filename || m.file;
    assert.ok(files.includes(name), `registry migration missing on disk: ${name}`);
  }
  for (const file of files) {
    assert.ok(reg.some((m) => (m.filename || m.file) === file), `disk migration missing from registry: ${file}`);
  }
  assert.ok(DATABASE_MIGRATIONS.some((m) => m.order === 44 && m.filename === "044_wave2_database_platform.sql"));
  assert.ok(DATABASE_MIGRATIONS.some((m) => m.order === 45 && m.filename === "045_app_users_role_rbac_align.sql"));
  const result = validateDatabaseRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(result.migrationCount >= 45);
});

test("Wave 2 tables registered and present in 044 SQL", () => {
  const sql = fs.readFileSync(WAVE2_SQL, "utf8");
  for (const name of WAVE2_TABLES) {
    assert.ok(getTable(name), `registry missing ${name}`);
    assert.equal(getTable(name).migrationFile, "044_wave2_database_platform.sql");
    assert.match(sql, new RegExp(`create table if not exists public\\.${name}`, "i"));
  }
  assert.ok(DATABASE_TABLES.length >= 350);
});

test("044 SQL contains critical RPCs, views, RLS, seeds, money defaults", () => {
  const sql = fs.readFileSync(WAVE2_SQL, "utf8");
  const allSql = allMigrationSql();
  for (const fn of WAVE2_RPCS) {
    assert.match(sql, new RegExp(`function public\\.${fn}`, "i"), fn);
  }
  for (const fn of LEGACY_RPCS) {
    assert.match(allSql, new RegExp(`function public\\.${fn}`, "i"), fn);
  }
  for (const v of CRITICAL_VIEWS) {
    assert.match(sql, new RegExp(`view public\\.${v}`, "i"), v);
  }
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /tg_set_updated_at/);
  assert.match(sql, /loanInterestPercent['"]?\s*:\s*15|interest_percent['"]?,?\s*'15'|loan_interest_default\s*=\s*15/);
  assert.match(sql, /collectionDays['"]?\s*:\s*31|collection\.days['"]?,?\s*'31'|collection_days_default\s*=\s*31/);
  assert.match(sql, /100000|cashier\.limit_pesewas|cashierLimitPesewas/);
  assert.match(sql, /Owner\.Transfer|System\.Reset|Export\.All/);
  assert.match(sql, /KBA/);
  assert.match(sql, /username.*john|demo-user-john/i);
  assert.match(sql, /amount_pesewas/);
  assert.match(sql, /pesewas/i);
  assert.doesNotMatch(sql, /drop table if exists public\.(customers|collections|ledger_entries|loans)/i);
});

test("rollback script exists and only targets Wave 2 objects", () => {
  assert.equal(fs.existsSync(ROLLBACK), true);
  const rb = fs.readFileSync(ROLLBACK, "utf8");
  assert.match(rb, /044_wave2_database_platform/);
  assert.match(rb, /drop function if exists public\.record_deposit_from_client/i);
  assert.match(rb, /drop table if exists public\.offline_queue/i);
  assert.doesNotMatch(rb, /drop table if exists public\.customers/i);
  assert.doesNotMatch(rb, /drop table if exists public\.collections/i);
});

test("wave2 docs checklist and ERD present", () => {
  assert.equal(fs.existsSync(WAVE2_DOC), true);
  const doc = fs.readFileSync(WAVE2_DOC, "utf8");
  assert.match(doc, /Wave 2/);
  assert.match(doc, /```mermaid/);
  assert.match(doc, /Complete \/ Partial checklist|Complete \/ Partial/i);
  assert.match(doc, /044_wave2_database_platform\.sql/);
  assert.match(doc, /Wave 3/);
  assert.match(doc, /pesewas/i);
  assert.match(doc, /SUPER_ADMIN_FORBIDDEN|Owner\.Transfer/);
  for (let i = 1; i <= 15; i++) {
    assert.match(doc, new RegExp(`\\|\\s*${i}\\s*\\|`));
  }
});

test("SUPER_ADMIN_FORBIDDEN matches seeded exclusions", () => {
  assert.deepEqual(SUPER_ADMIN_FORBIDDEN.slice().sort(), ["Export.All", "Owner.Transfer", "System.Reset"]);
  const sql = fs.readFileSync(WAVE2_SQL, "utf8");
  for (const code of SUPER_ADMIN_FORBIDDEN) {
    assert.match(sql, new RegExp(code.replace(".", "\\.")));
  }
  assert.match(sql, /p\.code not in \('Owner\.Transfer', 'System\.Reset', 'Export\.All'\)/);
});

test("WAVE-02 backlog hardening for DB modules is Completed", () => {
  const wave = getWave("WAVE-02") || getWave(2);
  assert.ok(wave);
  assert.equal(wave.waveStatus, "Mostly Complete");
  assert.ok((wave.requiredDocumentation || []).some((d) => String(d).includes("wave2-database")));
  const items = listBacklogForWave("WAVE-02");
  const hardening = items.filter(
    (i) =>
      /Integration & Hardening/i.test(i.title) &&
      ["MOD-014", "MOD-025", "MOD-030"].includes(i.module)
  );
  assert.ok(hardening.length >= 3, `expected hardening items, got ${hardening.length}`);
  for (const item of hardening) {
    assert.equal(item.status, "Completed", item.identifier + " " + item.title);
  }
});
