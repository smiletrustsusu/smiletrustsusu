/**
 * Phase 7 ECDAPS consistency — registry invariants, docs section order, Phase 1-6 refs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATABASE_TABLES,
  DATABASE_MIGRATIONS,
  ECDAPS_VERSION,
  listTables,
  getTable,
  listMigrations,
  validateDatabaseRegistry
} from "../src/core/canonical-database-registry.js";
import { getCanonicalEntity } from "../src/core/canonical-domain-registry.js";
import { P7_SECTIONS } from "../src/core/phase7-output-workflow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

test("ECDAPS docs exist with 20 sections in prescribed order", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-canonical-database-architecture.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "ecdaps-catalogs.md")), true);
  const primary = read("enterprise-canonical-database-architecture.md");
  assert.match(primary, /ECDAPS|Enterprise Canonical Database/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Phase 5/);
  assert.match(primary, /Phase 6/);
  assert.match(primary, /localStorage/);
  assert.match(primary, /[Ss]upabase/);
  assert.match(primary, /1[–-]30|Modules 1/);
  assert.match(primary, /facade|OpenAPI|GraphQL/i);
  assert.match(primary, /038|043/);

  const headings = [...primary.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((m) => ({
    n: Number(m[1]),
    name: m[2].trim()
  }));
  assert.equal(headings.length, 20, `expected 20 sections, got ${headings.length}`);
  for (let i = 0; i < 20; i++) {
    assert.equal(headings[i].n, i + 1);
    assert.equal(headings[i].name, P7_SECTIONS[i].name, `section ${i + 1}`);
  }

  const catalogs = read("ecdaps-catalogs.md");
  assert.match(catalogs, /Ownership|Entity/);
  assert.match(catalogs, /Migration/);
  assert.match(catalogs, /Retention/);
  assert.match(catalogs, /Backup|DR/);
  assert.match(catalogs, /Cross-Reference|Phase 1/);
  assert.match(catalogs, /038|043/);
});

test("database registry unique ids, helpers, and validation", () => {
  const ids = DATABASE_TABLES.map((t) => t.id);
  const names = DATABASE_TABLES.map((t) => t.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  assert.ok(DATABASE_TABLES.length >= 100, `expected many tables, got ${DATABASE_TABLES.length}`);
  assert.equal(listTables().length, DATABASE_TABLES.length);
  assert.ok(getTable(DATABASE_TABLES[0].id));
  assert.ok(getTable(DATABASE_TABLES[0].name));
  assert.equal(listMigrations().length, DATABASE_MIGRATIONS.length);
  assert.equal(ECDAPS_VERSION, "1.0.0");

  const result = validateDatabaseRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.tableCount, DATABASE_TABLES.length);
  assert.equal(result.migrationCount, DATABASE_MIGRATIONS.length);
});

test("migrations cover 038-044 and are ordered", () => {
  const orders = listMigrations().map((m) => m.order);
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] > orders[i - 1], `order ${orders[i - 1]} then ${orders[i]}`);
  }
  for (const n of [38, 39, 40, 41, 42, 43, 44]) {
    assert.ok(DATABASE_MIGRATIONS.some((m) => m.order === n), `missing migration ${n}`);
  }
  const files = DATABASE_MIGRATIONS.map((m) => m.filename || m.file);
  assert.ok(files.every(Boolean), "migration filenames present");
});

test("ECDM entity refs resolve when present; modules 1-30", () => {
  for (const t of DATABASE_TABLES) {
    const mod = Number(t.owningModule);
    assert.ok(mod >= 1 && mod <= 30, t.name);
    if (t.entityId) {
      assert.ok(getCanonicalEntity(t.entityId), `${t.name} -> ${t.entityId}`);
    }
  }
});

test("Phase 1-6 input artifacts referenced", () => {
  const primary = read("enterprise-canonical-database-architecture.md");
  assert.match(primary, /Phase 1|EMAS/);
  assert.match(primary, /Phase 3|ECDM/);
  assert.match(primary, /Phase 4|ECSMLS|state machine/i);
  assert.match(primary, /Phase 5|ECECMS|event/i);
  assert.match(primary, /Phase 6|ECACIS|API/i);
});
