const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
const migDir = path.join(ROOT, "supabase/migrations");

function write(rel, content) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("WROTE", rel);
}

const MIG_MODULE = {
  "001": 1, "002": 7, "003": 1, "004": 6, "005": 1, "006": 1, "007": 1,
  "008": 3, "009": 4, "010": 5, "011": 6, "012": 7, "013": 8, "014": 9,
  "015": 10, "016": 11, "017": 12, "018": 12, "019": 1, "020": 13,
  "021": 15, "022": 14, "023": 15, "024": 1, "025": 16, "026": 16,
  "027": 17, "028": 18, "029": 19, "030": 19, "031": 20, "032": 21,
  "033": 22, "034": 20, "035": 23, "036": 23, "037": 24, "038": 25,
  "039": 26, "040": 27, "041": 28, "042": 29, "043": 30
};

const ENTITY_MAP = {
  businesses: "ENT-ORG-001", branches: "ENT-ORG-002", app_users: "ENT-IDN-001",
  roles: "ENT-ORG-004", permissions: "ENT-ORG-005", role_permissions: "ENT-ORG-005",
  user_roles: "ENT-ORG-004", sessions: "ENT-IDN-002", devices: "ENT-IDN-003",
  customers: "ENT-CUS-001", beneficiaries: "ENT-CUS-002",
  savings_products: "ENT-SAV-001", savings_accounts: "ENT-SAV-002",
  personal_savings_accounts: "ENT-SAV-002", collections: "ENT-SAV-003",
  collection_adjustments: "ENT-SAV-004", susu_groups: "ENT-GRP-001",
  susu_group_members: "ENT-GRP-002", group_meetings: "ENT-GRP-003",
  loans: "ENT-LON-001", loan_repayments: "ENT-LON-002", loan_disbursements: "ENT-LON-001",
  withdrawal_requests: "ENT-WDL-001", chart_of_accounts: "ENT-FIN-001",
  journal_entries: "ENT-FIN-002", journal_lines: "ENT-FIN-002",
  ledger_entries: "ENT-FIN-003", accounting_periods: "ENT-FIN-004",
  payment_transactions: "ENT-PAY-001", payment_status_history: "ENT-PAY-001",
  workflow_definitions: "ENT-WFK-001", workflow_instances: "ENT-WFK-002",
  workflow_tasks: "ENT-WFK-003", business_cases: "ENT-WFK-004",
  documents: "ENT-DOC-001", document_metadata: "ENT-DOC-001",
  ecm_documents: "ENT-DOC-002", ecm_document_metadata: "ENT-DOC-002",
  notifications: "ENT-NTF-001", audit_log: "ENT-AUD-001",
  audit_activity_logs: "ENT-AUD-001", system_settings: "ENT-CFG-001",
  sync_queue: "ENT-SYN-001", idempotency_keys: "ENT-SYN-002",
  job_definitions: "ENT-JOB-001", job_queue: "ENT-JOB-002",
  alerts: "ENT-MON-001", incidents: "ENT-MON-002",
  api_clients: "ENT-GWY-001", api_keys: "ENT-GWY-002",
  backup_sets: "ENT-BKP-001", restore_operations: "ENT-BKP-001",
  security_incidents: "ENT-SEC-001", fraud_cases: "ENT-SEC-002",
  rule_definitions: "ENT-RUL-001", decision_tables: "ENT-RUL-001",
  migration_jobs: "ENT-XCH-001", export_jobs: "ENT-XCH-001", import_jobs: "ENT-XCH-001",
  metric_definitions: "ENT-BI-001", kpi_definitions: "ENT-BI-002",
  providers: "ENT-INT-001", webhooks: "ENT-INT-002", message_queues: "ENT-INT-003",
  ai_models: "ENT-AI-001", model_registry: "ENT-AI-001", dataset_registry: "ENT-AI-002",
  prediction_requests: "ENT-AI-003", prediction_results: "ENT-AI-003",
  fraud_alerts: "ENT-AI-004", recommendation_history: "ENT-AI-005",
  tenants: "ENT-PLT-001", licenses: "ENT-PLT-002",
  environment_registry: "ENT-PLT-003", feature_flag_rules: "ENT-PLT-004",
  maintenance_windows: "ENT-PLT-005", deployment_history: "ENT-PLT-006",
  agent_routes: "ENT-ORG-003", agent_attendance: "ENT-ORG-003", agent_leave: "ENT-ORG-003"
};

const CLASS_HINT = {
  ledger_entries: "Restricted", collections: "Restricted", loans: "Restricted",
  payment_transactions: "Restricted", audit_log: "Restricted", api_keys: "Restricted",
  provider_credentials: "Restricted", user_mfa_secrets: "Restricted",
  customers: "Confidential", app_users: "Confidential", beneficiaries: "Confidential"
};

const RETENTION = {
  Restricted: "7y-financial-or-policy",
  Confidential: "5y-or-policy",
  Internal: "3y-or-ops-policy",
  Public: "1y-or-ops-policy"
};

function classify(name) {
  if (CLASS_HINT[name]) return CLASS_HINT[name];
  if (/audit|ledger|payment|loan|withdrawal|collection|credential|secret|mfa|fraud|security/.test(name)) return "Restricted";
  if (/customer|user|agent|beneficiary|tenant|license/.test(name)) return "Confidential";
  if (/metric|kpi|report|health|monitor|log|job|sync/.test(name)) return "Internal";
  return "Internal";
}

const files = fs.readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();
const tableMap = new Map(); // name -> { migration, schema, pk, fks:[], indexes:[] }
const schemas = new Set(["public"]);
const migrations = [];
const allIndexes = [];
const allConstraints = [];
const allFks = [];

for (const f of files) {
  const num = f.slice(0, 3);
  const text = fs.readFileSync(path.join(migDir, f), "utf8");
  migrations.push({
    id: `MIG-${num}`,
    file: f,
    order: Number(num),
    owningModule: MIG_MODULE[num] || 1,
    notes: f.replace(/\.sql$/, "").replace(/^\d+_/, "").replace(/_/g, " ")
  });

  let m;
  const reSchema = /CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/gi;
  while ((m = reSchema.exec(text))) schemas.add(m[1].replace(/"/g, "").toLowerCase());

  const reTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_."]+)\s*\(([\s\S]*?)\n\s*\)/gi;
  while ((m = reTable.exec(text))) {
    let full = m[1].replace(/"/g, "").toLowerCase();
    let schema = "public";
    let name = full;
    if (full.includes(".")) {
      [schema, name] = full.split(".");
      schemas.add(schema);
    }
    const body = m[2];
    const pkMatch = body.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i) || body.match(/^\s*([a-zA-Z0-9_]+)\s+[^\n,]+PRIMARY\s+KEY/im);
    let pk = "id";
    if (pkMatch) {
      pk = pkMatch[1].split(",")[0].trim().replace(/"/g, "");
    } else if (/^\s*id\s+/im.test(body)) pk = "id";

    const fks = [];
    const refRe = /(?:FOREIGN\s+KEY\s*\(([^)]+)\)\s*)?REFERENCES\s+([a-zA-Z0-9_."]+)(?:\s*\(([^)]+)\))?/gi;
    let rm;
    while ((rm = refRe.exec(body))) {
      let cols = rm[1] ? rm[1].replace(/"/g, "").trim() : null;
      if (!cols) {
        // inline column references — find preceding column name roughly
        const before = body.slice(Math.max(0, rm.index - 120), rm.index);
        const cm = before.match(/([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_\[\]]+[^\n]*$/);
        cols = cm ? cm[1] : "unknown";
      }
      let ref = rm[2].replace(/"/g, "").toLowerCase();
      if (ref.includes(".")) ref = ref.split(".")[1];
      const refCols = rm[3] ? rm[3].replace(/"/g, "").trim() : "id";
      fks.push({ columns: cols, refTable: ref, refColumns: refCols });
    }

    if (!tableMap.has(name)) {
      tableMap.set(name, {
        name,
        schema,
        migration: f,
        migrationOrder: Number(num),
        owningModule: MIG_MODULE[num] || 1,
        pk,
        fks,
        entityId: ENTITY_MAP[name] || null,
        classification: classify(name),
        retention: RETENTION[classify(name)]
      });
    } else {
      const existing = tableMap.get(name);
      for (const fk of fks) {
        if (!existing.fks.some(x => x.columns === fk.columns && x.refTable === fk.refTable)) {
          existing.fks.push(fk);
        }
      }
    }
  }

  // indexes created separately
  const reIdx = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+ON\s+([a-zA-Z0-9_."]+)\s*\(([^)]+)\)/gi;
  while ((m = reIdx.exec(text))) {
    let tname = m[3].replace(/"/g, "").toLowerCase();
    if (tname.includes(".")) tname = tname.split(".")[1];
    allIndexes.push({
      id: `IDX-${m[2].replace(/"/g, "")}`,
      name: m[2].replace(/"/g, ""),
      table: tname,
      unique: Boolean(m[1]),
      columns: m[4].replace(/"/g, "").trim(),
      migration: f
    });
  }
}

const tables = [...tableMap.values()].sort((a, b) => a.name.localeCompare(b.name));
const tableNames = new Set(tables.map(t => t.name));

for (const t of tables) {
  for (const fk of t.fks) {
    allFks.push({
      id: `FK-${t.name}-${fk.columns}-${fk.refTable}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      table: t.name,
      columns: fk.columns,
      refTable: fk.refTable,
      refColumns: fk.refColumns
    });
  }
  allConstraints.push({
    id: `PK-${t.name}`,
    table: t.name,
    type: "PRIMARY KEY",
    definition: `(${t.pk})`
  });
}

console.log({ migrations: migrations.length, tables: tables.length, fks: allFks.length, indexes: allIndexes.length });

// Emit registry JS
function j(v) { return JSON.stringify(v); }

const registrySrc = `/**
 * Phase 7 — ECDAPS machine-readable database / persistence registry.
 * Catalogs physical SQL tables from supabase/migrations and maps to ECDM entities.
 * Does not redefine entities, APIs, events, SMs, money math, RBAC, or posting.
 */
import { getCanonicalEntity } from "./canonical-domain-registry.js";

export const ECDAPS_VERSION = "1.0.0";
export const ECDAPS_STATUS = "Authoritative";
export const TABLE_CLASSIFICATIONS = Object.freeze(["Public", "Internal", "Confidential", "Restricted"]);

export const DATABASE_SCHEMAS = Object.freeze([
${[...schemas].sort().map(s => `  Object.freeze({ id: "SCH-${s}", name: ${j(s)}, description: ${j(s === "public" ? "Primary Supabase/Postgres schema for Smile Trust" : s)} })`).join(",\n")}
]);

/** Physical tables inventoried from CREATE TABLE in migrations (normalized name without schema prefix). */
export const DATABASE_TABLES = Object.freeze([
${tables.map(t => `  Object.freeze({
    id: ${j("TBL-" + t.name)},
    name: ${j(t.name)},
    schema: ${j(t.schema)},
    owningModule: ${t.owningModule},
    entityId: ${j(t.entityId)},
    pk: ${j(t.pk)},
    fks: Object.freeze(${j(t.fks.map(fk => ({ columns: fk.columns, refTable: fk.refTable, refColumns: fk.refColumns })))}.map(Object.freeze)),
    classification: ${j(t.classification)},
    retention: ${j(t.retention)},
    migration: ${j(t.migration)},
    localStorageMirror: ${j(Boolean(t.entityId))}
  })`).join(",\n")}
]);

export const DATABASE_CONSTRAINTS = Object.freeze([
${allConstraints.slice(0, 500).map(c => `  Object.freeze(${j(c)})`).join(",\n")}
]);

export const DATABASE_INDEXES = Object.freeze([
${allIndexes.map(i => `  Object.freeze(${j(i)})`).join(",\n")}
]);

export const DATABASE_MIGRATIONS = Object.freeze([
${migrations.map(m => `  Object.freeze(${j(m)})`).join(",\n")}
]);

export const DATABASE_PARTITIONS = Object.freeze([
  Object.freeze({ id: "PART-PLANNED-LEDGER", table: "ledger_entries", strategy: "range-by-created_at", status: "planned", note: "Not present in current SQL; optional cloud scale" }),
  Object.freeze({ id: "PART-PLANNED-AUDIT", table: "audit_activity_logs", strategy: "range-by-created_at", status: "planned", note: "Not present in current SQL; optional archival scale" }),
  Object.freeze({ id: "PART-PLANNED-API-REQ", table: "api_requests", strategy: "range-by-created_at", status: "planned", note: "Not present in current SQL; optional ops scale" })
]);

export function listTables(filter = {}) {
  let rows = [...DATABASE_TABLES];
  if (filter.owningModule != null) rows = rows.filter(t => t.owningModule === Number(filter.owningModule));
  if (filter.entityId) rows = rows.filter(t => t.entityId === filter.entityId);
  if (filter.schema) rows = rows.filter(t => t.schema === filter.schema);
  if (filter.classification) rows = rows.filter(t => t.classification === filter.classification);
  return rows;
}

export function getTable(key) {
  return DATABASE_TABLES.find(t => t.id === key || t.name === key) || null;
}

export function listMigrations() {
  return [...DATABASE_MIGRATIONS].sort((a, b) => a.order - b.order);
}

export function listSchemas() {
  return [...DATABASE_SCHEMAS];
}

export function listIndexes(tableName) {
  return DATABASE_INDEXES.filter(i => !tableName || i.table === tableName);
}

export function validateDatabaseRegistry(options = {}) {
  const tables = options.tables || DATABASE_TABLES;
  const migrations = options.migrations || DATABASE_MIGRATIONS;
  const errors = [];
  const warnings = [];

  const ids = tables.map(t => t.id);
  if (new Set(ids).size !== ids.length) {
    const dupes = ids.filter((c, i) => ids.indexOf(c) !== i);
    errors.push("Duplicate table ids: " + [...new Set(dupes)].join(", "));
  }
  const names = tables.map(t => t.name);
  if (new Set(names).size !== names.length) {
    const dupes = names.filter((c, i) => names.indexOf(c) !== i);
    errors.push("Duplicate table names: " + [...new Set(dupes)].join(", "));
  }

  const nameSet = new Set(names);
  for (const t of tables) {
    for (const fk of t.fks || []) {
      if (fk.refTable && !nameSet.has(fk.refTable) && fk.refTable !== "auth.users") {
        // auth.users is external Supabase
        if (!String(fk.refTable).startsWith("auth.")) {
          errors.push(\`FK target missing for \${t.name} -> \${fk.refTable}\`);
        }
      }
    }
    if (t.entityId) {
      const ent = getCanonicalEntity(t.entityId);
      if (!ent) errors.push(\`Unknown ECDM entity \${t.entityId} on table \${t.name}\`);
    }
    const mod = Number(t.owningModule);
    if (!Number.isInteger(mod) || mod < 1 || mod > 30) {
      errors.push(\`Invalid owningModule for \${t.name}: \${t.owningModule}\`);
    }
  }

  const orders = migrations.map(m => m.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.join(",") !== sorted.join(",")) {
    // listMigrations sorts; registry array should still be unique
  }
  if (new Set(orders).size !== orders.length) errors.push("Duplicate migration order numbers");
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] >= sorted[i + 1]) errors.push("Migration order not strictly increasing");
  }
  const required = [38, 39, 40, 41, 42, 43];
  for (const n of required) {
    if (!migrations.some(m => m.order === n)) errors.push(\`Missing migration \${n} in registry\`);
  }

  const mapped = tables.filter(t => t.entityId).length;
  if (mapped < 40) warnings.push(\`Only \${mapped} tables mapped to ECDM entities\`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    tableCount: tables.length,
    migrationCount: migrations.length,
    schemaCount: DATABASE_SCHEMAS.length,
    indexCount: DATABASE_INDEXES.length,
    version: ECDAPS_VERSION
  };
}
`;

write("src/core/canonical-database-registry.js", registrySrc);

// Save inventory summary for docs
write("scripts/_ecdaps_inventory.json", JSON.stringify({
  tableCount: tables.length,
  migrationCount: migrations.length,
  indexCount: allIndexes.length,
  fkCount: allFks.length,
  entityMapped: tables.filter(t => t.entityId).length,
  migrations: migrations.map(m => m.file),
  sampleTables: tables.slice(0, 30).map(t => t.name),
  entityMappedTables: tables.filter(t => t.entityId).map(t => ({ name: t.name, entityId: t.entityId, module: t.owningModule }))
}, null, 2));

console.log("registry generated");
