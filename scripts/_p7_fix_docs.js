/**
 * Rewrite ECDAPS primary doc with 20 sections + real Phase 1–6 refs + migration filenames.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ECDAPS_VERSION,
  ECDAPS_STATUS,
  DATABASE_TABLES,
  DATABASE_CONSTRAINTS,
  DATABASE_INDEXES,
  DATABASE_MIGRATIONS,
  DATABASE_PARTITIONS,
  validateDatabaseRegistry
} from "../src/core/canonical-database-registry.js";
import { getCanonicalEntity } from "../src/core/canonical-domain-registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tables = [...DATABASE_TABLES];
const migrations = [...DATABASE_MIGRATIONS].sort((a, b) => a.order - b.order);
const indexes = [...DATABASE_INDEXES];
const constraints = [...DATABASE_CONSTRAINTS];
const partitions = [...DATABASE_PARTITIONS];
const mapped = tables.filter((t) => t.entityId);
const fkCount = tables.reduce((n, t) => n + (t.fks?.length || 0), 0);

const byModule = {};
for (const t of tables) byModule[t.owningModule] = (byModule[t.owningModule] || 0) + 1;
const classCounts = {};
for (const t of tables) classCounts[t.classification] = (classCounts[t.classification] || 0) + 1;

const coreNames = [
  "customers", "collections", "loans", "ledger_entries", "branches", "businesses",
  "app_users", "savings_accounts", "withdrawal_requests", "journal_entries",
  "transactions", "susu_groups", "payment_transactions", "audit_activity_logs", "workflow_instances"
];
const coreTables = coreNames.map((n) => tables.find((t) => t.name === n)).filter(Boolean);

const ownershipRows = Object.keys(byModule).map(Number).sort((a, b) => a - b)
  .map((m) => `| ${m} | ${byModule[m]} |`).join("\n");
const migrationRows = migrations.map((m) =>
  `| ${m.order} | \`${m.filename || m.file}\` | ${m.owningModule || "—"} | ${m.description || m.notes || ""} |`
).join("\n");
const entityMapRows = mapped.slice().sort((a, b) => a.name.localeCompare(b.name))
  .map((t) => `| \`${t.name}\` | ${t.entityId} | ${t.owningModule} | \`${t.migrationFile || t.migration}\` |`).join("\n");
const relRows = tables.filter((t) => t.fks?.length).flatMap((t) =>
  t.fks.map((fk) => `| \`${t.name}\` | ${fk.columns} | \`${fk.refTable}\` | ${fk.refColumns || "id"} |`)
).slice(0, 100).join("\n");
const indexRows = indexes.slice(0, 60).map((i) =>
  `| \`${i.name || i.id}\` | \`${i.table}\` | ${i.unique ? "unique" : "non-unique"} | ${i.columns} | \`${i.migration || ""}\` |`
).join("\n");
const constraintSample = constraints.slice(0, 50).map((c) =>
  `| \`${c.id}\` | \`${c.table}\` | ${c.type} | ${c.definition} |`
).join("\n");
const partitionRows = partitions.map((p) =>
  `| ${p.id} | \`${p.table}\` | ${p.strategy} | ${p.status} | ${p.note || ""} |`
).join("\n");
const lsNoteRows = tables.filter((t) => t.localStorageKeys?.length).slice(0, 40).map((t) =>
  `| \`${t.name}\` | ${(t.localStorageKeys || []).join(", ")} | ${t.entityId || "—"} |`
).join("\n");

const v = validateDatabaseRegistry();

const doc = `# Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 7 — Authoritative Database / Persistence Architecture  
**Status:** ${ECDAPS_STATUS}  
**Version:** ${ECDAPS_VERSION}  
**Date:** 2026-09-12  
**Machine registry:** \`src/core/canonical-database-registry.js\`  
**Companion matrices:** [\`ecdaps-catalogs.md\`](./ecdaps-catalogs.md)  
**Data dictionary:** [\`ecdaps-data-dictionary.md\`](./ecdaps-data-dictionary.md)  
**Workflow:** \`src/core/phase7-output-workflow.js\` (sections 1–20)

Cross-references: Phase 1 [\`enterprise-master-architecture.md\`](./enterprise-master-architecture.md) / [\`emas-matrices.md\`](./emas-matrices.md); Phase 2 [\`enterprise-consistency-review.md\`](./enterprise-consistency-review.md) / [\`phase2-registers.md\`](./phase2-registers.md) / [\`enterprise-architecture-review-workflow.md\`](./enterprise-architecture-review-workflow.md) / [\`enterprise-governance-validation.md\`](./enterprise-governance-validation.md); Phase 3 [\`enterprise-canonical-domain-model.md\`](./enterprise-canonical-domain-model.md) / [\`ecdm-catalogs.md\`](./ecdm-catalogs.md); Phase 4 [\`enterprise-canonical-state-machines.md\`](./enterprise-canonical-state-machines.md) / [\`ecsmls-catalogs.md\`](./ecsmls-catalogs.md); Phase 5 [\`enterprise-canonical-event-catalog.md\`](./enterprise-canonical-event-catalog.md) / [\`ececms-catalogs.md\`](./ececms-catalogs.md); Phase 6 [\`enterprise-canonical-api-catalog.md\`](./enterprise-canonical-api-catalog.md) / [\`ecacis-catalogs.md\`](./ecacis-catalogs.md).

**Persistence reality (normative):** **localStorage is primary** for the vanilla JS SPA runtime; **Supabase/Postgres is optional** cloud alignment via \`supabase/migrations/*.sql\`. Inventory: **${tables.length}** tables, **${migrations.length}** migrations (001–043). Registry \`validateDatabaseRegistry\` → ok=${v.ok}. Does **not** invent a contradictory second money SoR.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| Title | Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS) |
| Document ID | ST-ECDAPS-001 |
| Version | ${ECDAPS_VERSION} |
| Status | ${ECDAPS_STATUS} |
| Owner | Architecture / Data Governance |
| Approver | Accountable Approver (SoD vs Primary Owner) |
| Registry | \`canonical-database-registry.js\` |
| Sections | 20 (cannot skip; Phase 7 workflow) |
| Sequencing | Phase 5 → Phase 6 → Phase 7 |
| Change control | ADR + registry PR; no silent money/RBAC/posting/nav edits |

---

## 2. Purpose & Scope

ECDAPS is the **single authoritative definition** of physical persistence alignment for Smile Trust across Modules **1–30**.

| In scope | Out of scope |
|----------|--------------|
| Inventory of CREATE TABLE in migrations 001–043 | Redefining ECDM entities (Phase 3) |
| Soft mapping tables → \`ENT-*\` when confident | Changing pesewas money math / posting |
| Ownership by module; FK / constraint / index catalogs | Rewriting RBAC permission matrices |
| Migration ordering & DR alignment | Live HTTP DB admin APIs |
| localStorage mirrors via ECDM \`persistenceKeys\` | New business navigation or features |

**Inventory snapshot:** ${tables.length} tables · ${migrations.length} migrations · ${indexes.length} indexes · ${mapped.length} ECDM-mapped · ${fkCount} FK edges.

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase | Artifacts |
|------:|-----------|
| 1 | \`docs/enterprise-master-architecture.md\`, \`docs/emas-matrices.md\` |
| 2 | \`docs/enterprise-consistency-review.md\`, \`docs/phase2-registers.md\`, \`docs/enterprise-architecture-review-workflow.md\`, \`docs/enterprise-governance-validation.md\` |
| 3 | \`docs/enterprise-canonical-domain-model.md\`, \`docs/ecdm-catalogs.md\`, \`src/core/canonical-domain-registry.js\` |
| 4 | \`docs/enterprise-canonical-state-machines.md\`, \`docs/ecsmls-catalogs.md\`, \`src/core/canonical-state-machine-registry.js\` |
| 5 | \`docs/enterprise-canonical-event-catalog.md\`, \`docs/ececms-catalogs.md\`, \`src/core/canonical-event-registry.js\` |
| 6 | \`docs/enterprise-canonical-api-catalog.md\`, \`docs/ecacis-catalogs.md\`, \`src/core/canonical-api-registry.js\`, OpenAPI/GraphQL **facades only** (not live HTTP) |
| SQL | \`supabase/migrations/001_*.sql\` … \`043_platform_admin.sql\` |

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
| D4 | Phase 6 OpenAPI/GraphQL remain non-live facades |
| D5 | Money SoR semantics remain as implemented (local + financial migrations) |
| D6 | localStorage keys documented via ECDM \`persistenceKeys\` where mirrored |
| D7 | Phase **5** before **6** before **7** |

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
| ECDAPS-P08 | Partition honesty | Partitioning planned/optional unless in SQL |
| ECDAPS-P09 | Facade fence | Phase 6 OpenAPI/GraphQL stay documentation facades |
| ECDAPS-P10 | Versioning | ECDAPS semver; breaking schema needs ADR |

---

## 5. Persistence Architecture Overview

\`\`\`
[ SPA UI / Modules 1–30 ]
        |  in-process contracts / events (Phases 5–6)
        v
[ localStorage + in-memory state ]  <— primary runtime SoR for field ops
        |
        |  optional sync / cloud align
        v
[ Supabase Postgres public schema ]  <— migrations 001–043 (${tables.length} tables)
\`\`\`

- **Schemas:** \`public\` (SCH-public).  
- **Money:** integer **pesewas** — formulas unchanged by ECDAPS.  
- **Module 20:** in-process API gateway; no live HTTP DB server introduced here.

---

## 6. Logical Data Model Mapping

Soft-map tables to ECDM when heuristics + overrides agree (e.g. \`customers\`→ENT-CUS-001, \`collections\`→ENT-SAV-003, \`loans\`→ENT-LON-001, \`ledger_entries\`→ENT-FIN-003). Validation: **IF** \`entityId\` present **THEN** it exists in ECDM.

| Metric | Count |
|--------|------:|
| Physical tables | ${tables.length} |
| Tables with entityId | ${mapped.length} |
| Unmapped (allowed) | ${tables.length - mapped.length} |

| SQL table | ECDM entity | Module | Migration |
|-----------|-------------|-------:|-----------|
${entityMapRows}

Logical-only entities may exist solely via ECDM \`persistenceKeys\` without a 1:1 SQL table.

---

## 7. Physical Schema Catalog

| Schema | Tables | Notes |
|--------|-------:|-------|
| public | ${tables.length} | All inventoried CREATE TABLE objects |

Core samples:

| Table ID | Name | Module | Entity | Migration |
|----------|------|-------:|--------|-----------|
${coreTables.map((t) => `| ${t.id} | \`${t.name}\` | ${t.owningModule} | ${t.entityId || "—"} | \`${t.migrationFile || t.migration}\` |`).join("\n")}

Authority: \`DATABASE_TABLES\` in \`canonical-database-registry.js\`.

---

## 8. Table Ownership & Module Mapping

Owning module from migration theme (043→30, 042→29, 041→28, 035/036→23, …) and ECDM owner when mapped.

| Owning Module | Table count |
|--------------:|------------:|
${ownershipRows}

Full matrix: [\`ecdaps-catalogs.md\`](./ecdaps-catalogs.md).

---

## 9. Relationships & Foreign Keys

Registry captures **${fkCount}** FK edges (aliases \`users\`→\`app_users\` accepted in validation). Sample:

| From table | Columns | To table | Ref columns |
|------------|---------|----------|-------------|
${relRows}

---

## 10. Constraints & Integrity Rules

Primary keys cataloged for inventoried tables; UNIQUE/CHECK where extracted. Money integrity remains application + ledger posting rules (unchanged).

| Constraint ID | Table | Type | Definition |
|---------------|-------|------|------------|
${constraintSample}

---

## 11. Indexes & Access Paths

Representative indexes from migrations (including \`001_financial_core\` and later ops). Catalog size: **${indexes.length}**.

| Index | Table | Kind | Columns | Migration |
|-------|-------|------|---------|-----------|
${indexRows}

---

## 12. Partitioning Strategy

**Honest status:** no RANGE/LIST partitions declared in current migration SQL. Planned/optional for cloud scale:

| ID | Table | Strategy | Status | Note |
|----|-------|----------|--------|------|
${partitionRows}

---

## 13. Migration Catalog & Ordering

All **${migrations.length}** files 001–043 inclusive (including \`038_data_exchange.sql\` … \`043_platform_admin.sql\`):

| Order | Filename | Module | Description |
|------:|----------|-------:|-------------|
${migrationRows}

**Rule:** order strictly monotonic; \`validateDatabaseRegistry\` fails if 038–043 filenames are missing.

---

## 14. Retention, Archival & Soft-Delete

| Classification / domain | Default retention label |
|-------------------------|-------------------------|
| Restricted financial | 7y-financial-or-policy |
| Confidential PII / agents | 5y-or-policy |
| Internal ops | 3y-or-ops-policy |

Per-table \`retention\` in registry. Soft-delete via \`deleted_at\` / status / \`active\` flags where present. Archival jobs align with Module 21 / audit Module 13 — ECDAPS does not invent purge that bypasses audit.

---

## 15. Backup, Recovery & DR Alignment

| Concern | Alignment |
|---------|-----------|
| Cloud DB backups | Module 21 / \`032_backup_recovery.sql\` (\`backup_sets\`, restore ops) |
| SPA localStorage | Device backup / export policies; complements Restricted retention |
| DR restore order | Migrations 001→043 |
| RPO/RTO | Module 21 ops docs; ECDAPS does not invent new targets |

---

## 16. Security, Classification & Access

| Classification | Table count |
|----------------|------------:|
${Object.entries(classCounts).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

Access via existing RLS (migrations 003/005) and app RBAC **by identifier** — ECDAPS does not rewrite permission matrices.

---

## 17. Consistency with APIs / Events / State Machines

| Artifact | Consistency rule |
|----------|------------------|
| Phase 6 APIs (ECACIS) | Endpoints reference entities/tables by id; OpenAPI/GraphQL **facades not live HTTP** |
| Phase 5 Events (ECECMS) | Emitters may persist via localStorage keys / optional SQL mirrors |
| Phase 4 SMs (ECSMLS) | State columns remain in owning module tables |
| Phase 3 ECDM | Soft \`entityId\` + \`persistenceKeys\` only |

Sequencing: **Phase 5 → Phase 6 → Phase 7**.

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

Does **not** capture bare \`public\` as a table name. Filenames **001–043** sorted.

### B. Core table dictionary (short)

| Table | Entity | Module | localStorage / notes |
|-------|--------|-------:|----------------------|
${coreTables.map((t) => `| \`${t.name}\` | ${t.entityId || "—"} | ${t.owningModule} | ${(t.localStorageKeys || []).join(", ") || "SQL optional / no primary mirror"} |`).join("\n")}

See also [\`ecdaps-data-dictionary.md\`](./ecdaps-data-dictionary.md).

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
| validateDatabaseRegistry.ok | ${v.ok} |
`;

fs.writeFileSync(path.join(ROOT, "docs/enterprise-canonical-database-architecture.md"), doc);
console.log("Fixed ECDAPS primary doc");
