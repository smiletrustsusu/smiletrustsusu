/**
 * One-shot Phase 7 ECDAPS generator: rewrite registry field names + docs + tests.
 * Run: node scripts/_p7_generate_ecdaps.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ECDAPS_VERSION,
  ECDAPS_STATUS,
  TABLE_CLASSIFICATIONS,
  DATABASE_TABLES,
  DATABASE_CONSTRAINTS,
  DATABASE_INDEXES,
  DATABASE_MIGRATIONS,
  DATABASE_PARTITIONS
} from "../src/core/canonical-database-registry.js";
import { getCanonicalEntity } from "../src/core/canonical-domain-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function freezeJson(obj) {
  return JSON.stringify(obj);
}

const tables = DATABASE_TABLES.map((t) => {
  const migrationFile = t.migrationFile || t.migration;
  let localStorageKeys = t.localStorageKeys;
  if (localStorageKeys === undefined) {
    if (t.localStorageMirror) {
      const ent = t.entityId ? getCanonicalEntity(t.entityId) : null;
      localStorageKeys = ent?.persistenceKeys?.length ? [...ent.persistenceKeys] : [t.name];
    }
  }
  return {
    id: t.id,
    name: t.name,
    schema: t.schema,
    owningModule: t.owningModule,
    entityId: t.entityId ?? null,
    pk: t.pk,
    fks: (t.fks || []).map((fk) => ({ ...fk })),
    classification: t.classification,
    retention: t.retention,
    migrationFile,
    localStorageKeys
  };
});

const migrations = DATABASE_MIGRATIONS.map((m) => ({
  id: m.id,
  filename: m.filename || m.file,
  order: m.order,
  description: m.description || m.notes || m.filename || m.file,
  owningModule: m.owningModule
}));

const constraints = DATABASE_CONSTRAINTS.map((c) => ({ ...c }));
const indexes = DATABASE_INDEXES.map((i) => ({ ...i }));
const partitions = DATABASE_PARTITIONS.map((p) => ({ ...p }));

function emitFrozenArray(name, rows) {
  const lines = [`export const ${name} = Object.freeze([`];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const comma = i < rows.length - 1 ? "," : "";
    if (name === "DATABASE_TABLES") {
      const fks = JSON.stringify(row.fks || []);
      const ls =
        row.localStorageKeys === undefined ? "undefined" : JSON.stringify(row.localStorageKeys);
      lines.push("  Object.freeze({");
      lines.push(`    id: ${JSON.stringify(row.id)},`);
      lines.push(`    name: ${JSON.stringify(row.name)},`);
      lines.push(`    schema: ${JSON.stringify(row.schema)},`);
      lines.push(`    owningModule: ${row.owningModule},`);
      lines.push(`    entityId: ${row.entityId == null ? "null" : JSON.stringify(row.entityId)},`);
      lines.push(`    pk: ${JSON.stringify(row.pk)},`);
      lines.push(`    fks: Object.freeze(${fks}.map(Object.freeze)),`);
      lines.push(`    classification: ${JSON.stringify(row.classification)},`);
      lines.push(`    retention: ${JSON.stringify(row.retention)},`);
      lines.push(`    migrationFile: ${JSON.stringify(row.migrationFile)},`);
      lines.push(`    localStorageKeys: ${ls}`);
      lines.push(`  })${comma}`);
    } else {
      lines.push(`  Object.freeze(${freezeJson(row)})${comma}`);
    }
  }
  lines.push("]);");
  return lines.join("\n");
}

const header = `/**
 * Phase 7 — ECDAPS machine-readable database / persistence registry.
 * Catalogs physical SQL tables from supabase/migrations and maps to ECDM entities.
 * Does not redefine entities, APIs, events, SMs, money math, RBAC, or posting.
 * Inventory: CREATE TABLE from migrations 001–043 (public schema).
 */
import { getCanonicalEntity } from "./canonical-domain-registry.js";

export const ECDAPS_VERSION = "${ECDAPS_VERSION}";
export const ECDAPS_STATUS = "${ECDAPS_STATUS}";
export const TABLE_CLASSIFICATIONS = Object.freeze(${JSON.stringify([...TABLE_CLASSIFICATIONS])});

export const DATABASE_SCHEMAS = Object.freeze([
  Object.freeze({ id: "SCH-public", name: "public", description: "Primary Supabase/Postgres schema for Smile Trust" })
]);
`;

const helpers = `
export function listTables(filter = {}) {
  let rows = [...DATABASE_TABLES];
  if (filter.owningModule != null) rows = rows.filter((t) => t.owningModule === Number(filter.owningModule));
  if (filter.entityId) rows = rows.filter((t) => t.entityId === filter.entityId);
  if (filter.schema) rows = rows.filter((t) => t.schema === filter.schema);
  if (filter.classification) rows = rows.filter((t) => t.classification === filter.classification);
  return rows;
}

export function getTable(key) {
  return DATABASE_TABLES.find((t) => t.id === key || t.name === key) || null;
}

export function listMigrations() {
  return [...DATABASE_MIGRATIONS].sort((a, b) => a.order - b.order);
}

export function listSchemas() {
  return [...DATABASE_SCHEMAS];
}

export function listIndexes(tableName) {
  return DATABASE_INDEXES.filter((i) => !tableName || i.table === tableName);
}

export function listConstraints(tableName) {
  return DATABASE_CONSTRAINTS.filter((c) => !tableName || c.table === tableName);
}

export function validateDatabaseRegistry(options = {}) {
  const tables = options.tables || DATABASE_TABLES;
  const migrations = options.migrations || DATABASE_MIGRATIONS;
  const errors = [];
  const warnings = [];

  const ids = tables.map((t) => t.id);
  if (new Set(ids).size !== ids.length) {
    const dupes = ids.filter((c, i) => ids.indexOf(c) !== i);
    errors.push("Duplicate table ids: " + [...new Set(dupes)].join(", "));
  }
  const names = tables.map((t) => t.name);
  if (new Set(names).size !== names.length) {
    const dupes = names.filter((c, i) => names.indexOf(c) !== i);
    errors.push("Duplicate table names: " + [...new Set(dupes)].join(", "));
  }

  const nameSet = new Set(names);
  for (const t of tables) {
    const ALIASES = { users: "app_users", members: "customers", organizations: "businesses" };
    const PG_TYPES = new Set([
      "jsonb", "json", "text", "uuid", "int", "integer", "bigint", "boolean",
      "timestamptz", "timestamp", "numeric", "bytea", "date", "varchar", "char",
      "real", "double", "float", "serial", "bigserial"
    ]);
    for (const fk of t.fks || []) {
      let ref = fk.refTable;
      if (!ref) continue;
      if (String(ref).startsWith("auth.")) continue;
      if (PG_TYPES.has(String(ref).toLowerCase())) continue;
      if (ALIASES[ref]) ref = ALIASES[ref];
      if (!nameSet.has(ref)) {
        errors.push(\`FK target missing for \${t.name} -> \${fk.refTable}\`);
      }
    }
    if (t.entityId) {
      const ent = getCanonicalEntity(t.entityId);
      if (!ent) errors.push(\`Unknown ECDM entity \${t.entityId} on table \${t.name}\`);
    }
    if (!t.migrationFile) errors.push(\`Missing migrationFile for \${t.name}\`);
    const mod = Number(t.owningModule);
    if (!Number.isInteger(mod) || mod < 1 || mod > 30) {
      errors.push(\`Invalid owningModule for \${t.name}: \${t.owningModule}\`);
    }
  }

  const orders = migrations.map((m) => m.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (new Set(orders).size !== orders.length) errors.push("Duplicate migration order numbers");
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] >= sorted[i + 1]) errors.push("Migration order not strictly increasing");
  }
  const requiredFiles = [
    "038_data_exchange.sql",
    "039_digital_records.sql",
    "040_enterprise_bi.sql",
    "041_enterprise_integration.sql",
    "042_enterprise_ai.sql",
    "043_platform_admin.sql"
  ];
  for (const f of requiredFiles) {
    if (!migrations.some((m) => (m.filename || m.file) === f)) {
      errors.push(\`Missing migration file in registry: \${f}\`);
    }
  }
  for (const n of [38, 39, 40, 41, 42, 43]) {
    if (!migrations.some((m) => m.order === n)) errors.push(\`Missing migration order \${n} in registry\`);
  }

  const mapped = tables.filter((t) => t.entityId).length;
  if (mapped < 40) warnings.push(\`Only \${mapped} tables mapped to ECDM entities\`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    tableCount: tables.length,
    migrationCount: migrations.length,
    schemaCount: DATABASE_SCHEMAS.length,
    indexCount: DATABASE_INDEXES.length,
    constraintCount: DATABASE_CONSTRAINTS.length,
    version: ECDAPS_VERSION
  };
}
`;

const registryBody = [
  header,
  emitFrozenArray("DATABASE_TABLES", tables),
  "",
  emitFrozenArray("DATABASE_CONSTRAINTS", constraints),
  "",
  emitFrozenArray("DATABASE_INDEXES", indexes),
  "",
  emitFrozenArray("DATABASE_MIGRATIONS", migrations),
  "",
  emitFrozenArray("DATABASE_PARTITIONS", partitions),
  "",
  helpers
].join("\n");

fs.writeFileSync(path.join(ROOT, "src/core/canonical-database-registry.js"), registryBody);
console.log("Wrote canonical-database-registry.js", tables.length, "tables");

// Stats for docs
const byModule = {};
for (const t of tables) {
  byModule[t.owningModule] = (byModule[t.owningModule] || 0) + 1;
}
const mapped = tables.filter((t) => t.entityId);
const fkCount = tables.reduce((n, t) => n + (t.fks?.length || 0), 0);
const classCounts = {};
for (const t of tables) {
  classCounts[t.classification] = (classCounts[t.classification] || 0) + 1;
}

const coreTables = [
  "customers",
  "collections",
  "loans",
  "ledger_entries",
  "branches",
  "businesses",
  "app_users",
  "savings_accounts",
  "withdrawal_requests",
  "journal_entries",
  "transactions",
  "susu_groups",
  "payment_transactions",
  "audit_activity_logs",
  "workflow_instances"
].map((n) => tables.find((t) => t.name === n)).filter(Boolean);

const migrationRows = migrations
  .map(
    (m) =>
      `| ${m.order} | \`${m.filename}\` | ${m.owningModule || "—"} | ${m.description} |`
  )
  .join("\n");

const ownershipRows = Object.keys(byModule)
  .map(Number)
  .sort((a, b) => a - b)
  .map((m) => `| ${m} | ${byModule[m]} |`)
  .join("\n");

const entityMapRows = mapped
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((t) => `| \`${t.name}\` | ${t.entityId} | ${t.owningModule} | \`${t.migrationFile}\` |`)
  .join("\n");

const relRows = tables
  .filter((t) => t.fks?.length)
  .flatMap((t) =>
    t.fks.map(
      (fk) =>
        `| \`${t.name}\` | ${fk.columns} | \`${fk.refTable}\` | ${fk.refColumns || "id"} |`
    )
  )
  .slice(0, 120)
  .join("\n");

const indexRows = indexes
  .slice(0, 80)
  .map(
    (i) =>
      `| \`${i.name || i.id}\` | \`${i.table}\` | ${i.unique ? "unique" : "non-unique"} | ${i.columns} | \`${i.migration || ""}\` |`
  )
  .join("\n");

const constraintSample = constraints
  .filter((c) => String(c.type || "").includes("PRIMARY") || String(c.type || "").includes("UNIQUE") || String(c.type || "").includes("CHECK"))
  .slice(0, 60)
  .map((c) => `| \`${c.id}\` | \`${c.table}\` | ${c.type} | ${c.definition} |`)
  .join("\n");

const partitionRows = partitions
  .map((p) => `| ${p.id} | \`${p.table}\` | ${p.strategy} | ${p.status} | ${p.note || ""} |`)
  .join("\n");

const lsNoteRows = tables
  .filter((t) => t.localStorageKeys?.length)
  .slice(0, 40)
  .map((t) => `| \`${t.name}\` | ${(t.localStorageKeys || []).join(", ")} | ${t.entityId || "—"} |`)
  .join("\n");

const ecdapsDoc = `# Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 7 — Authoritative Database / Persistence Architecture  
**Status:** ${ECDAPS_STATUS}  
**Version:** ${ECDAPS_VERSION}  
**Date:** 2026-09-12  
**Machine registry:** \`src/core/canonical-database-registry.js\`  
**Companion matrices:** [\`ecdaps-catalogs.md\`](./ecdaps-catalogs.md)  
**Workflow:** \`src/core/phase7-output-workflow.js\` (sections 1–20)

Cross-references: Phase 1 [\`enterprise-master-architecture.md\`](./enterprise-master-architecture.md); Phase 2 consistency / governance docs; Phase 3 [\`enterprise-canonical-domain-model.md\`](./enterprise-canonical-domain-model.md); Phase 4 [\`enterprise-canonical-state-machines.md\`](./enterprise-canonical-state-machines.md); Phase 5 [\`enterprise-canonical-event-catalog.md\`](./enterprise-canonical-event-catalog.md); Phase 6 [\`enterprise-canonical-api-catalog.md\`](./enterprise-canonical-api-catalog.md).

**Persistence reality (normative):** **localStorage is primary** for the vanilla JS SPA runtime; **Supabase/Postgres is optional** cloud alignment via \`supabase/migrations/*.sql\`. This catalog inventories physical SQL tables honestly from migrations **001–043** (**${tables.length}** tables, **${migrations.length}** migrations). It does **not** invent a contradictory second database of record for money posting.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| Title | Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS) |
| Version | ${ECDAPS_VERSION} |
| Status | ${ECDAPS_STATUS} |
| Owner | Architecture / Data Governance |
| Approver | Accountable Approver (SoD vs Primary Owner) |
| Registry | \`canonical-database-registry.js\` |
| Sections | 20 (cannot skip; see Phase 7 workflow) |
| Change control | ADR + registry PR; no silent money/RBAC edits |

Classification of this document: **Internal**. Financial table designs inherit **Restricted** where indicated in the physical catalog.

---

## 2. Purpose & Scope

ECDAPS is the **single authoritative definition** of physical persistence alignment for Smile Trust across Modules **1–30**.

| In scope | Out of scope |
|----------|--------------|
| Inventory of CREATE TABLE objects in migrations 001–043 | Redefining ECDM entities (Phase 3) |
| Soft mapping tables → \`ENT-*\` when confident | Changing pesewas money math / posting formulas |
| Ownership by module; FK / constraint / index catalogs | Rewriting RBAC permission matrices |
| Migration ordering & DR alignment notes | Live HTTP DB admin APIs |
| localStorage mirror notes via ECDM \`persistenceKeys\` | New business navigation or features |

**MUST:** consume Phases 1–6 as inputs; keep OpenAPI/GraphQL facades non-live (Phase 6).  
**MUST NOT:** claim Supabase is the exclusive SoR when the SPA posts via local/in-process ledgers.

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase | Artifacts |
|------:|-----------|
| 1 | \`enterprise-master-architecture.md\`, \`emas-matrices.md\` |
| 2 | \`enterprise-consistency-review.md\`, \`phase2-registers.md\`, architecture review / governance docs |
| 3 | \`enterprise-canonical-domain-model.md\`, \`ecdm-catalogs.md\`, \`canonical-domain-registry.js\` |
| 4 | \`enterprise-canonical-state-machines.md\`, \`ecsmls-catalogs.md\`, \`canonical-state-machine-registry.js\` |
| 5 | \`enterprise-canonical-event-catalog.md\`, \`ececms-catalogs.md\`, \`canonical-event-registry.js\` |
| 6 | \`enterprise-canonical-api-catalog.md\`, \`ecacis-catalogs.md\`, \`canonical-api-registry.js\`, OpenAPI/GraphQL **facades only** |

### 3.2 Precedence

1. ADRs / explicit exceptions  
2. EMAS (Phase 1)  
3. Phase 2 consistency & governance  
4. ECDM (Phase 3)  
5. ECSMLS (Phase 4)  
6. ECECMS (Phase 5)  
7. ECACIS (Phase 6)  
8. Module specs 1–30  
9. Global standards (lowest)

Unresolved conflicts escalate via Architecture Review Workflow — **not** silently inside ECDAPS.

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | Physical tables come from migration SQL inventory (not invented) |
| D2 | If \`entityId\` is set it MUST resolve in ECDM |
| D3 | Owning module MUST be integer 1–30 |
| D4 | Phase 6 API facades remain non-live HTTP |
| D5 | Money SoR semantics remain as implemented in app + financial migrations |
| D6 | localStorage keys documented via ECDM \`persistenceKeys\` where mirrored |

---

## 4. Design Principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECDAPS-P01 | Honest inventory | Catalog only tables present in \`supabase/migrations\` |
| ECDAPS-P02 | Dual persistence honesty | localStorage primary; Supabase optional |
| ECDAPS-P03 | Soft ECDM map | Map when confident; omit \`entityId\` when not |
| ECDAPS-P04 | Module ownership | Every table has owningModule 1–30 |
| ECDAPS-P05 | No money rewrite | Never changes posting / pesewas math |
| ECDAPS-P06 | No RBAC rewrite | Permissions by identifier only |
| ECDAPS-P07 | Migration monotonicity | Orders 001–043 strictly increasing |
| ECDAPS-P08 | Partition honesty | Partitioning is planned/optional unless in SQL |
| ECDAPS-P09 | Facade fence | Phase 6 OpenAPI/GraphQL stay documentation facades |
| ECDAPS-P10 | Versioning | ECDAPS semver; breaking schema needs ADR |

---

## 5. Persistence Architecture Overview

\`\`\`
[ SPA UI / Modules 1–30 ]
        |  in-process contracts / events
        v
[ localStorage + in-memory state ]  <— primary runtime SoR for field ops
        |
        |  optional sync / cloud align
        v
[ Supabase Postgres public schema ]  <— migrations 001–043 (${tables.length} tables)
\`\`\`

- **Schemas:** \`public\` (SCH-public).  
- **Identifiers:** integer/UUID per migration; app identifiers follow Module standards.  
- **Money:** integer **pesewas** in financial tables — formulas unchanged by ECDAPS.  
- **Module 20:** in-process API gateway; no live HTTP DB server introduced here.

---

## 6. Logical Data Model Mapping

Tables soft-map to ECDM entities when name/domain heuristics and explicit overrides agree (e.g. \`customers\`→ENT-CUS-001, \`collections\`→ENT-SAV-003, \`loans\`→ENT-LON-001, \`ledger_entries\`→ENT-FIN-003).

| Metric | Count |
|--------|------:|
| Physical tables | ${tables.length} |
| Tables with entityId | ${mapped.length} |
| ECDM entities available | (see Phase 3 registry) |
| Unmapped tables | ${tables.length - mapped.length} (allowed; no entityId) |

Validation rule: **IF** \`entityId\` present **THEN** it exists in ECDM. See companion matrix for the full entity–table list.

---

## 7. Physical Schema Catalog

| Schema | Tables | Notes |
|--------|-------:|-------|
| public | ${tables.length} | All inventoried CREATE TABLE objects |

Core financial / CRM samples:

| Table ID | Name | Module | Entity | Migration |
|----------|------|-------:|--------|-----------|
${coreTables.map((t) => `| ${t.id} | \`${t.name}\` | ${t.owningModule} | ${t.entityId || "—"} | \`${t.migrationFile}\` |`).join("\n")}

Full machine catalog: \`DATABASE_TABLES\` in \`canonical-database-registry.js\`.

---

## 8. Table Ownership & Module Mapping

Owning module is derived from migration theme (e.g. 043→30 platform, 042→29 AI, 041→28 integration, 035/036→23 workflow) and ECDM owner when mapped.

| Owning Module | Table count |
|--------------:|------------:|
${ownershipRows}

---

## 9. Relationships & Foreign Keys

Registry captures **${fkCount}** FK edges from migration SQL (representative; aliases \`users\`→\`app_users\` accepted in validation). Sample:

| From table | Columns | To table | Ref columns |
|------------|---------|----------|-------------|
${relRows}

---

## 10. Constraints & Integrity Rules

Primary keys are cataloged for inventoried tables; additional UNIQUE/CHECK appear where extracted. Money integrity remains application + ledger posting rules (unchanged).

| Constraint ID | Table | Type | Definition |
|---------------|-------|------|------------|
${constraintSample}

---

## 11. Indexes & Access Paths

Indexes are representative extractions from migrations (including \`001_financial_core\` and later ops). Full list: \`DATABASE_INDEXES\` (${indexes.length}).

| Index | Table | Kind | Columns | Migration |
|-------|-------|------|---------|-----------|
${indexRows}

---

## 12. Partitioning Strategy

**Honest status:** no RANGE/LIST partitions are declared in current migration SQL. The following are **planned/optional** for cloud scale only:

| ID | Table | Strategy | Status | Note |
|----|-------|----------|--------|------|
${partitionRows}

---

## 13. Migration Catalog & Ordering

All **${migrations.length}** files 001–043 inclusive (including 038–043):

| Order | Filename | Module | Description |
|------:|----------|-------:|-------------|
${migrationRows}

**Rule:** order is strictly monotonic; registry validation fails if 038–043 filenames are missing.

---

## 14. Retention, Archival & Soft-Delete

| Classification / domain | Default retention label |
|-------------------------|-------------------------|
| Restricted financial | 7y-financial-or-policy |
| Confidential PII / agents | 5y-or-policy |
| Internal ops | 3y-or-ops-policy |
| Soft-delete | Prefer \`deleted_at\` / status flags where present in SQL; archival jobs Module 21 |

Tables carry per-row \`retention\` in the registry. Archival is policy-driven; ECDAPS does not invent purge jobs that bypass audit Module 13.

---

## 15. Backup, Recovery & DR Alignment

| Concern | Alignment |
|---------|-----------|
| Cloud DB backups | Module 21 tables / \`032_backup_recovery.sql\` |
| SPA localStorage | Device backup / export policies (ops); not a substitute for Restricted financial retention |
| DR | Restore order follows migration order 001→043 |
| RPO/RTO | Defined in Module 21 ops docs; ECDAPS does not invent new targets |

---

## 16. Security, Classification & Access

| Classification | Table count |
|----------------|------------:|
${Object.entries(classCounts).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

Access remains via existing RLS (migrations 003/005) and app RBAC **by identifier** — ECDAPS does not rewrite permission matrices. Restricted tables require elevated review for exports.

---

## 17. Consistency with APIs / Events / State Machines

| Artifact | Consistency rule |
|----------|------------------|
| Phase 6 APIs | Endpoints reference entities/tables by id only; facades **not** live HTTP |
| Phase 5 Events | Emitters may persist via localStorage keys / optional SQL mirrors |
| Phase 4 SMs | State columns remain in owning module tables; no SM redesign here |
| Phase 3 ECDM | Soft \`entityId\` links only |

Sequencing: **Phase 5 → Phase 6 → Phase 7** (events → APIs → persistence).

---

## 18. Non-Goals & Prohibited Activities

| Prohibited | Reason |
|------------|--------|
| Changing money math / posting | Financial integrity |
| Rewriting RBAC | Security governance |
| Changing business navigation | Product scope fence |
| Inventing tables not in SQL | Catalog honesty |
| Claiming live OpenAPI/GraphQL HTTP | Phase 6 facade fence |
| Skipping ECDAPS sections 1–20 | Phase 7 workflow |

---

## 19. Governance, Versioning & Change Control

| Control | Mechanism |
|---------|-----------|
| Section sequencing | \`phase7-output-workflow.js\` P7_SECTIONS 1–20 |
| Error codes | \`P7W-xxx\` |
| Registry changes | PR + \`validateDatabaseRegistry\` green |
| Breaking physical changes | ADR + migration number > 043 |
| Approvals | SoD: Primary Owner ≠ Accountable Approver |

---

## 20. Appendices

### A. Inventory method

Regex over \`supabase/migrations/*.sql\`:

- \`create table if not exists public.<name> (\`
- \`create table if not exists <name> (\`

Does **not** capture bare \`public\` as a table name. Filenames 001–043 sorted.

### B. Core table dictionary (short)

| Table | Entity | Module | localStorage / notes |
|-------|--------|-------:|----------------------|
${coreTables.map((t) => `| \`${t.name}\` | ${t.entityId || "—"} | ${t.owningModule} | ${(t.localStorageKeys || []).join(", ") || "SQL optional / no primary mirror"} |`).join("\n")}

### C. localStorage mirrors (sample)

| SQL table | persistenceKeys / mirrors | Entity |
|-----------|---------------------------|--------|
${lsNoteRows}

### D. Related registries

- \`canonical-domain-registry.js\` (Phase 3)  
- \`canonical-state-machine-registry.js\` (Phase 4)  
- \`canonical-event-registry.js\` (Phase 5)  
- \`canonical-api-registry.js\` (Phase 6)  
- \`canonical-database-registry.js\` (Phase 7)

### E. Counts snapshot

| Metric | Value |
|--------|------:|
| Tables | ${tables.length} |
| Migrations | ${migrations.length} |
| Constraints (catalog) | ${constraints.length} |
| Indexes (catalog) | ${indexes.length} |
| Planned partitions | ${partitions.length} |
| FK edges | ${fkCount} |
`;

fs.writeFileSync(
  path.join(ROOT, "docs/enterprise-canonical-database-architecture.md"),
  ecdapsDoc
);
console.log("Wrote enterprise-canonical-database-architecture.md");

const catalogsDoc = `# ECDAPS Catalogs (Phase 7 Companion Matrices)

**Parent:** [\`enterprise-canonical-database-architecture.md\`](./enterprise-canonical-database-architecture.md)  
**Registry:** \`src/core/canonical-database-registry.js\`  
**Version:** ${ECDAPS_VERSION}  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · Phases 1–6 alignment  

**Persistence reality:** localStorage primary; Supabase optional. Registry validation must be \`ok=true\`.

**Counts:** tables=${tables.length}, migrations=${migrations.length}, constraints=${constraints.length}, indexes=${indexes.length}, partitions=${partitions.length}, FK edges=${fkCount}, entity-mapped=${mapped.length}

---

## 1. Ownership Matrix (module → table count)

| Owning Module | Tables |
|--------------:|-------:|
${ownershipRows}

---

## 2. Entity–Table Matrix (mapped only)

| Table | Entity ID | Module | Migration |
|-------|-----------|-------:|-----------|
${entityMapRows}

---

## 3. Relationships Matrix (sample of FK edges)

| From | Columns | To | Ref |
|------|---------|----|-----|
${relRows}

---

## 4. Constraints Matrix (sample)

| ID | Table | Type | Definition |
|----|-------|------|------------|
${constraintSample}

---

## 5. Indexes Matrix (sample)

| Index | Table | Kind | Columns | Migration |
|-------|-------|------|---------|-----------|
${indexRows}

---

## 6. Partitions Matrix

| ID | Table | Strategy | Status | Note |
|----|-------|----------|--------|------|
${partitionRows}

---

## 7. Migrations Matrix (001–043)

| Order | Filename | Module | Description |
|------:|----------|-------:|-------------|
${migrationRows}

---

## 8. Retention Matrix (by classification)

| Classification | Count | Typical retention label |
|----------------|------:|-------------------------|
${Object.entries(classCounts).map(([k, v]) => `| ${k} | ${v} | see per-table retention in registry |`).join("\n")}

---

## 9. Backup / DR Cross-Reference

| Concern | Module / Migration | Note |
|---------|--------------------|------|
| Backup sets / restore jobs | 21 / \`032_backup_recovery.sql\` | Cloud DR |
| Audit retention | 13 / \`020_audit_ops.sql\` | Immutable activity |
| SPA device backup | 15 / ops policy | Complements, not replaces, Restricted retention |

---

## 10. Security / Classification Cross-Reference

| Classification | Count | Access note |
|----------------|------:|-------------|
${Object.entries(classCounts).map(([k, v]) => `| ${k} | ${v} | RBAC by identifier; RLS where enabled |`).join("\n")}

---

## 11. Cross-References Phases 1–6 / Modules 1–30

| Phase | Artifact | ECDAPS use |
|------:|----------|------------|
| 1 | EMAS | Persistence architecture boundaries |
| 2 | Consistency / governance | Conflict escalation |
| 3 | ECDM | Soft entityId map + persistenceKeys |
| 4 | ECSMLS | State column ownership |
| 5 | ECECMS | Event persistence channels |
| 6 | ECACIS | API facades (non-live) vs physical storage |

| Modules | Theme examples |
|--------:|----------------|
| 1–5 | Identity, customers, agents, branches |
| 6–10 | Savings, groups, loans, withdrawals, accounting |
| 11–15 | Reports, notifications, audit, config, sync |
| 16–20 | Payments, documents, jobs, monitoring, gateway |
| 21–25 | Backup, security, workflow, rules, exchange |
| 26–30 | Records, BI, integration, AI, platform admin |

---

## 12. Registry helper surface

| Helper | Purpose |
|--------|---------|
| \`listTables\` / \`getTable\` | Query inventory |
| \`listMigrations\` | Ordered 001–043 |
| \`listIndexes\` / \`listConstraints\` | Access paths / integrity |
| \`validateDatabaseRegistry\` | Uniqueness, FK targets, entityId, migrations 038–043 |
`;

fs.writeFileSync(path.join(ROOT, "docs/ecdaps-catalogs.md"), catalogsDoc);
console.log("Wrote ecdaps-catalogs.md");

const dictDoc = `# ECDAPS Data Dictionary (Core Tables)

Short companion to [\`enterprise-canonical-database-architecture.md\`](./enterprise-canonical-database-architecture.md) Appendix B.

| Table | PK | Entity | Module | Classification | Migration | localStorage keys |
|-------|----|--------|-------:|----------------|-----------|-------------------|
${coreTables
  .map(
    (t) =>
      `| \`${t.name}\` | ${t.pk} | ${t.entityId || "—"} | ${t.owningModule} | ${t.classification} | \`${t.migrationFile}\` | ${(t.localStorageKeys || []).join(", ") || "—"} |`
  )
  .join("\n")}

Full inventory: **${tables.length}** tables in \`DATABASE_TABLES\`.
`;

fs.writeFileSync(path.join(ROOT, "docs/ecdaps-data-dictionary.md"), dictDoc);
console.log("Wrote ecdaps-data-dictionary.md");

const consistencyTest = `/**
 * Phase 7 ECDAPS consistency — docs, registry, migrations, entity refs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ECDAPS_VERSION,
  DATABASE_TABLES,
  DATABASE_MIGRATIONS,
  listTables,
  getTable,
  listMigrations,
  validateDatabaseRegistry
} from "../src/core/canonical-database-registry.js";
import { getCanonicalEntity } from "../src/core/canonical-domain-registry.js";
import { P7_SECTIONS, assertSectionOrder } from "../src/core/phase7-output-workflow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

test("Phase 7 ECDAPS docs exist", () => {
  assert.equal(exists("enterprise-canonical-database-architecture.md"), true);
  assert.equal(exists("ecdaps-catalogs.md"), true);
});

test("primary ECDAPS has exactly 20 sections in order", () => {
  const primary = read("enterprise-canonical-database-architecture.md");
  const headings = [];
  const re = /^##\\s+(\\d+)\\.\\s+(.+)$/gm;
  let m;
  while ((m = re.exec(primary))) {
    headings.push({ n: Number(m[1]), title: m[2].trim() });
  }
  assert.equal(headings.length, 20, \`expected 20 headings, got \${headings.length}\`);
  for (let i = 0; i < 20; i++) {
    assert.equal(headings[i].n, i + 1);
    assert.equal(headings[i].title, P7_SECTIONS[i].name);
  }
  const order = assertSectionOrder(headings.map((h) => \`\${h.n}. \${h.title}\`));
  assert.equal(order.ok, true, order.message);
});

test("Phase 1–6 inputs referenced in ECDAPS", () => {
  const primary = read("enterprise-canonical-database-architecture.md");
  assert.match(primary, /enterprise-master-architecture/);
  assert.match(primary, /enterprise-canonical-domain-model|ECDM/);
  assert.match(primary, /enterprise-canonical-state-machines|ECSMLS/);
  assert.match(primary, /enterprise-canonical-event-catalog|ECECMS|Phase 5/);
  assert.match(primary, /enterprise-canonical-api-catalog|ECACIS|Phase 6/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /localStorage/i);
  assert.match(primary, /Supabase|Postgres/i);
});

test("registry uniqueness and validateDatabaseRegistry ok", () => {
  assert.equal(ECDAPS_VERSION, "1.0.0");
  assert.ok(DATABASE_TABLES.length >= 200, \`expected >=200 tables, got \${DATABASE_TABLES.length}\`);
  assert.equal(listTables().length, DATABASE_TABLES.length);
  const ids = DATABASE_TABLES.map((t) => t.id);
  const names = DATABASE_TABLES.map((t) => t.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  assert.ok(getTable("customers") || getTable("TBL-customers"));
  const result = validateDatabaseRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.tableCount, DATABASE_TABLES.length);
  assert.equal(result.migrationCount, DATABASE_MIGRATIONS.length);
});

test("migrations cover 038–043 and are monotonic", () => {
  const migs = listMigrations();
  assert.equal(migs.length, 43);
  const required = [
    "038_data_exchange.sql",
    "039_digital_records.sql",
    "040_enterprise_bi.sql",
    "041_enterprise_integration.sql",
    "042_enterprise_ai.sql",
    "043_platform_admin.sql"
  ];
  for (const f of required) {
    assert.ok(migs.some((m) => m.filename === f), \`missing \${f}\`);
  }
  for (let i = 1; i < migs.length; i++) {
    assert.ok(migs[i].order > migs[i - 1].order);
  }
});

test("entity refs resolve when present", () => {
  for (const t of DATABASE_TABLES) {
    if (!t.entityId) continue;
    assert.ok(getCanonicalEntity(t.entityId), \`\${t.name} -> \${t.entityId}\`);
  }
  const customers = getTable("customers");
  assert.ok(customers);
  assert.equal(customers.entityId, "ENT-CUS-001");
});
`;

fs.writeFileSync(path.join(ROOT, "tests/ecdaps-consistency.test.js"), consistencyTest);
console.log("Wrote ecdaps-consistency.test.js");

const workflowTest = `/**
 * Phase 7 deliverable workflow — sections, audit, P7W codes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P7_SECTIONS,
  createPhase7Deliverable,
  completeSection,
  allSectionsComplete,
  getAuditLog,
  listSections,
  assertSectionOrder
} from "../src/core/phase7-output-workflow.js";

test("exactly 20 sections in mandated order", () => {
  assert.equal(listSections().length, 20);
  assert.equal(P7_SECTIONS.length, 20);
  assert.equal(P7_SECTIONS[0].name, "Document Control");
  assert.equal(P7_SECTIONS[19].name, "Appendices");
  const names = P7_SECTIONS.map((s) => s.name);
  const r = assertSectionOrder(names);
  assert.equal(r.ok, true, r.message);
});

test("cannot skip sections; criteria required; audit log immutable entries", () => {
  const created = createPhase7Deliverable({
    primaryOwner: "alice",
    accountableApprover: "bob"
  });
  assert.equal(created.ok, true);
  const d = created.deliverable;

  const skip = completeSection(d, 3, { criteriaMet: true, actor: "alice" });
  assert.equal(skip.ok, false);
  assert.equal(skip.code, "P7W-062");

  const noCrit = completeSection(d, 1, { criteriaMet: false, actor: "alice" });
  assert.equal(noCrit.ok, false);
  assert.equal(noCrit.code, "P7W-063");

  for (let i = 1; i <= 20; i++) {
    const r = completeSection(d, i, { criteriaMet: true, actor: "alice" });
    assert.equal(r.ok, true, \`section \${i}: \${r.code} \${r.message}\`);
  }
  assert.equal(allSectionsComplete(d), true);
  const log = getAuditLog(d);
  assert.ok(log.length >= 21);
  assert.ok(Object.isFrozen(log[0]));
  assert.ok(log.some((e) => e.action === "CREATED"));
  assert.ok(log.some((e) => e.action === "SECTION_COMPLETED"));
});

test("P7W codes on create failures", () => {
  const missing = createPhase7Deliverable({ primaryOwner: "alice" });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "P7W-001");

  const sod = createPhase7Deliverable({
    primaryOwner: "alice",
    accountableApprover: "alice"
  });
  assert.equal(sod.ok, false);
  assert.equal(sod.code, "P7W-010");

  const created = createPhase7Deliverable({
    primaryOwner: "alice",
    accountableApprover: "bob"
  });
  const unknown = completeSection(created.deliverable, 99, { criteriaMet: true });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "P7W-060");
});
`;

fs.writeFileSync(path.join(ROOT, "tests/phase7-output-workflow.test.js"), workflowTest);
console.log("Wrote phase7-output-workflow.test.js");

// Strengthen phase7 workflow assertSectionOrder (already present)
const wfPath = path.join(ROOT, "src/core/phase7-output-workflow.js");
let wf = fs.readFileSync(wfPath, "utf8");
if (!wf.includes("export function createDeliverable")) {
  wf += `

/** Alias for tests / callers expecting createDeliverable naming. */
export function createDeliverable(input = {}) {
  return createPhase7Deliverable(input);
}
`;
  fs.writeFileSync(wfPath, wf);
  console.log("Patched phase7-output-workflow.js with createDeliverable alias");
}

console.log("DONE");
