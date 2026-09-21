/**
 * Enterprise Development Standards Manual (EDSM) — Canonical Standards Registry.
 * Coding / Naming / API / DB / UI rules + compliance checks + stack invariants.
 * Consumes Phases 9, 13–20 and Waves 1–10 — does not redefine RPO/RTO or Module engines.
 * Catalog only: no money posts, no RBAC rewrite, no new nav, no Next.js/Compose mandate.
 *
 * Authoritative runtime: shared vanilla JS SPA + Capacitor APK + Electron EXE +
 * Wave 3 invokeApi (OpenAPI facade) + Wave 2 Supabase + Wave 4 offline/sync.
 */

export const EDSM_VERSION = "1.0.0";
export const EDSM_STATUS = "Authoritative";
export const EDSM_EFFECTIVE_DATE = "2026-09-17";
export const EDSM_DOC = "docs/enterprise-development-standards.md";
export const EDSM_CATALOGS = "docs/edsm-catalogs.md";
export const EDSM_REGISTRY = "src/core/canonical-standards-registry.js";
export const EDSM_VALIDATION = "src/core/edsm-validation.js";

export const PHASE_REFS = Object.freeze({
  security: 9,
  monitoring: 13,
  devops: 14,
  testing: 16,
  performance: 17,
  operations: 18,
  governance: 19,
  baseline: 20
});

export const MONEY_INVARIANTS = Object.freeze({
  unit: "pesewas",
  interestDefault: 15,
  collectionDays: 31,
  cashierLimitGhs: 1000,
  note: "Money invariants: integer pesewas; interest 15; collection days 31; cashier float 1000."
});

export const ROLE_ALIASES = Object.freeze({
  Admin: "Branch Manager",
  KBA: "Super Admin",
  SystemOwner: "john"
});

export const REJECTED_PRIMARY_STACKS = Object.freeze([
  "Next.js",
  "React-primary-SPA-rewrite",
  "Jetpack Compose primary Android",
  "Kotlin-first Android rewrite",
  "Flutter rewrite",
  "Live REST/GraphQL HTTP server as SoT"
]);

export const AUTHORITATIVE_STACK = Object.freeze({
  web: "vanilla-js-spa",
  android: "capacitor-shared-spa",
  windows: "electron-www",
  api: "invokeApi-in-process",
  openApi: "facade-only",
  database: "supabase-postgres-wave2",
  offline: "wave4-js-sync",
  nav: "no-new-top-level"
});

export const RULE_ID_PATTERN = /^(COD|NAM|API|DB|UI|CHK|OWN|INV)-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
export const SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);

function freezeEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = Object.freeze([...out[key]]);
    else if (out[key] && typeof out[key] === "object") out[key] = Object.freeze({ ...out[key] });
  }
  return Object.freeze(out);
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function critical(code, message, extra = {}) {
  return { ok: false, severity: "critical", code, message, ...extra };
}

function warning(code, message, extra = {}) {
  return { ok: true, severity: "warning", code, message, ...extra };
}

// ─── Owners ──────────────────────────────────────────────────────────────────

export const STANDARDS_OWNERS = Object.freeze([
  freezeEntry({
    id: "OWN-001",
    code: "OWN_ENGINEERING_LEAD",
    title: "Engineering Lead",
    accountableAuthority: "Engineering Lead",
    domains: ["coding", "naming", "prepare:web"]
  }),
  freezeEntry({
    id: "OWN-002",
    code: "OWN_ARCHITECTURE",
    title: "Architecture Owner",
    accountableAuthority: "Architecture Owner",
    domains: ["stack", "registries", "clean-architecture-adapters"]
  }),
  freezeEntry({
    id: "OWN-003",
    code: "OWN_DOMAIN",
    title: "Domain Lead",
    accountableAuthority: "Domain Lead",
    domains: ["money", "interest", "collection-days", "cashier"]
  }),
  freezeEntry({
    id: "OWN-004",
    code: "OWN_SECURITY",
    title: "Security Lead",
    accountableAuthority: "Security Lead",
    domains: ["rbac", "secrets", "SUPER_ADMIN_FORBIDDEN"]
  }),
  freezeEntry({
    id: "OWN-005",
    code: "OWN_QA",
    title: "QA Lead",
    accountableAuthority: "QA Lead",
    domains: ["testing", "quality-gates", "edsm-consistency"]
  }),
  freezeEntry({
    id: "OWN-006",
    code: "OWN_UX",
    title: "UX Owner",
    accountableAuthority: "UX Owner",
    domains: ["spa-ux", "nav", "a11y", "css-tokens"]
  })
]);

// ─── Coding rules ─────────────────────────────────────────────────────────────

export const CODING_STANDARDS = Object.freeze([
  freezeEntry({
    id: "COD-001",
    code: "COD_ESM_MODULES",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-001",
    title: "ES modules in src/",
    rule: "Use ES module import/export in src/; match existing style",
    enforcement: "code-review + consistency tests"
  }),
  freezeEntry({
    id: "COD-002",
    code: "COD_NO_ENGINE_REWRITE",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-002",
    title: "No silent engine rewrite",
    rule: "Do not rewrite *-ops.js engines without Phase 19 change approval",
    enforcement: "architecture-review"
  }),
  freezeEntry({
    id: "COD-003",
    code: "COD_MONEY_PESEWAS",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Integer pesewas",
    rule: "Money in cores is integer pesewas; never float GHS storage",
    enforcement: "money-tests",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "COD-004",
    code: "COD_INTEREST_DEFAULT_15",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Interest default 15",
    rule: "Default interest remains 15 unless audited config change",
    enforcement: "money-tests",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "COD-005",
    code: "COD_COLLECTION_DAYS_31",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Collection days 31",
    rule: "Collection cycle is 31 days",
    enforcement: "money-tests",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "COD-006",
    code: "COD_CASHIER_LIMIT_1000",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Cashier limit 1000",
    rule: "Cashier float limit GHS 1000",
    enforcement: "money-tests",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "COD-007",
    code: "COD_STRUCTURED_RESULTS",
    category: "coding",
    severity: "high",
    ownerId: "OWN-001",
    title: "Structured results",
    rule: "Prefer { ok, code, message } on registry/ops boundaries",
    enforcement: "code-review"
  }),
  freezeEntry({
    id: "COD-008",
    code: "COD_FAIL_CLOSED_AUTHZ",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-004",
    title: "Fail closed authz",
    rule: "Authz and money validation fail closed",
    enforcement: "security-tests"
  }),
  freezeEntry({
    id: "COD-009",
    code: "COD_NO_SECRETS_IN_REPO",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-004",
    title: "No secrets in repo",
    rule: "Never commit config.json secrets or signing keystores",
    enforcement: "git-hooks + review"
  }),
  freezeEntry({
    id: "COD-010",
    code: "COD_PREPARE_WEB",
    category: "coding",
    severity: "high",
    ownerId: "OWN-001",
    title: "prepare:web after SPA changes",
    rule: "Run npm run prepare:web after app.js/styles/src changes for EXE/APK",
    enforcement: "developer-checklist"
  }),
  freezeEntry({
    id: "COD-011",
    code: "COD_AI_ADVISORY_ONLY",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-002",
    title: "AI advisory only",
    rule: "AI must not auto-approve loans or post money",
    enforcement: "phase12-ai-tests"
  }),
  freezeEntry({
    id: "COD-012",
    code: "COD_NO_NEW_TOP_NAV",
    category: "coding",
    severity: "critical",
    ownerId: "OWN-006",
    title: "No new top-level nav",
    rule: "Extras under Audit/Reports only",
    enforcement: "ux-review"
  })
]);

// ─── Naming rules ─────────────────────────────────────────────────────────────

export const NAMING_STANDARDS = Object.freeze([
  freezeEntry({
    id: "NAM-001",
    code: "NAM_FILE_KEBAB",
    category: "naming",
    severity: "high",
    ownerId: "OWN-001",
    title: "kebab-case files",
    rule: "Module files use kebab-case.js"
  }),
  freezeEntry({
    id: "NAM-002",
    code: "NAM_FN_CAMEL",
    category: "naming",
    severity: "high",
    ownerId: "OWN-001",
    title: "camelCase functions",
    rule: "Functions and methods use camelCase"
  }),
  freezeEntry({
    id: "NAM-003",
    code: "NAM_CONST_SCREAM",
    category: "naming",
    severity: "medium",
    ownerId: "OWN-001",
    title: "SCREAMING_SNAKE constants",
    rule: "Exported constants use SCREAMING_SNAKE"
  }),
  freezeEntry({
    id: "NAM-004",
    code: "NAM_OPS_SUFFIX",
    category: "naming",
    severity: "high",
    ownerId: "OWN-002",
    title: "*-ops.js engines",
    rule: "Domain engines follow *-ops.js naming"
  }),
  freezeEntry({
    id: "NAM-005",
    code: "NAM_API_V1",
    category: "naming",
    severity: "critical",
    ownerId: "OWN-002",
    title: "v1/domain.action",
    rule: "invokeApi operation ids use v1/domain.action"
  }),
  freezeEntry({
    id: "NAM-006",
    code: "NAM_TEST_FILE",
    category: "naming",
    severity: "medium",
    ownerId: "OWN-005",
    title: "tests/<area>-*.test.js",
    rule: "Consistency suites live under tests/"
  }),
  freezeEntry({
    id: "NAM-007",
    code: "NAM_SCHEMA_ID",
    category: "naming",
    severity: "high",
    ownerId: "OWN-002",
    title: "schemas.smiletrust.com $id",
    rule: "JSON Schema $id under https://schemas.smiletrust.com/"
  }),
  freezeEntry({
    id: "NAM-008",
    code: "NAM_REGISTRY_CANON",
    category: "naming",
    severity: "medium",
    ownerId: "OWN-002",
    title: "canonical registries",
    rule: "Machine registries use canonical-*-registry.js or *-registry.js"
  }),
  freezeEntry({
    id: "NAM-009",
    code: "NAM_RULE_ID",
    category: "naming",
    severity: "high",
    ownerId: "OWN-001",
    title: "EDSM rule id pattern",
    rule: "Rule ids match COD|NAM|API|DB|UI|CHK|OWN|INV-###"
  }),
  freezeEntry({
    id: "NAM-010",
    code: "NAM_ROLE_ALIASES",
    category: "naming",
    severity: "critical",
    ownerId: "OWN-004",
    title: "Role aliases",
    rule: "Admin=Branch Manager; KBA=Super Admin; SystemOwner=john"
  })
]);

// ─── API rules ────────────────────────────────────────────────────────────────

export const API_STANDARDS = Object.freeze([
  freezeEntry({
    id: "API-001",
    code: "API_INVOKE_GATEWAY",
    category: "api",
    severity: "critical",
    ownerId: "OWN-002",
    title: "invokeApi gateway",
    rule: "Domain calls go through invokeApi / createApiPlatform().invoke",
    waveRef: "WAVE-03"
  }),
  freezeEntry({
    id: "API-002",
    code: "API_CONTROLLER_THIN",
    category: "api",
    severity: "high",
    ownerId: "OWN-002",
    title: "Thin controllers",
    rule: "Controllers adapt only; posting math stays in *-ops.js"
  }),
  freezeEntry({
    id: "API-003",
    code: "API_OPENAPI_FACADE",
    category: "api",
    severity: "critical",
    ownerId: "OWN-002",
    title: "OpenAPI facade",
    rule: "OpenAPI documents contracts; no live REST server required",
    waveRef: "WAVE-03"
  }),
  freezeEntry({
    id: "API-004",
    code: "API_NO_NEW_HTTP_SOT",
    category: "api",
    severity: "critical",
    ownerId: "OWN-002",
    title: "No HTTP SoT",
    rule: "Do not introduce a live HTTP server as system of record"
  }),
  freezeEntry({
    id: "API-005",
    code: "API_RBAC_ENFORCE",
    category: "api",
    severity: "critical",
    ownerId: "OWN-004",
    title: "RBAC enforce",
    rule: "RBAC + branch/tenant checks on mutating ops"
  }),
  freezeEntry({
    id: "API-006",
    code: "API_SUPER_ADMIN_FORBIDDEN",
    category: "api",
    severity: "critical",
    ownerId: "OWN-004",
    title: "SUPER_ADMIN_FORBIDDEN",
    rule: "Enforce SUPER_ADMIN_FORBIDDEN from rbac.js"
  }),
  freezeEntry({
    id: "API-007",
    code: "API_CORRELATION",
    category: "api",
    severity: "high",
    ownerId: "OWN-001",
    title: "Correlation / audit",
    rule: "Gateway retains correlation, audit, metrics hooks"
  }),
  freezeEntry({
    id: "API-008",
    code: "API_VALIDATE_INPUT",
    category: "api",
    severity: "high",
    ownerId: "OWN-001",
    title: "Input validation",
    rule: "Validate inputs before domain orchestration"
  }),
  freezeEntry({
    id: "API-009",
    code: "API_RATE_LIMIT",
    category: "api",
    severity: "medium",
    ownerId: "OWN-004",
    title: "Rate limit",
    rule: "Rate-limit sensitive operations via platform middleware"
  }),
  freezeEntry({
    id: "API-010",
    code: "API_MODULE20_ALIGN",
    category: "api",
    severity: "high",
    ownerId: "OWN-002",
    title: "Module 20 align",
    rule: "Align with Module 20 / Wave 3 contract patterns"
  })
]);

// ─── DB rules ─────────────────────────────────────────────────────────────────

export const DB_STANDARDS = Object.freeze([
  freezeEntry({
    id: "DB-001",
    code: "DB_MIGRATIONS_ONLY",
    category: "database",
    severity: "critical",
    ownerId: "OWN-002",
    title: "Migrations only",
    rule: "Schema changes via versioned Supabase migrations",
    waveRef: "WAVE-02"
  }),
  freezeEntry({
    id: "DB-002",
    code: "DB_PESEWAS_COLUMNS",
    category: "database",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Pesewas columns",
    rule: "Money columns are integer pesewas",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "DB-003",
    code: "DB_RLS_REQUIRED",
    category: "database",
    severity: "critical",
    ownerId: "OWN-004",
    title: "RLS required",
    rule: "RLS for tenant/branch cloud access"
  }),
  freezeEntry({
    id: "DB-004",
    code: "DB_RPC_BOUNDARY",
    category: "database",
    severity: "high",
    ownerId: "OWN-002",
    title: "RPC boundary",
    rule: "Prefer audited RPCs for cloud writes"
  }),
  freezeEntry({
    id: "DB-005",
    code: "DB_APPEND_ONLY_POSTING",
    category: "database",
    severity: "critical",
    ownerId: "OWN-003",
    title: "Append-only posting",
    rule: "Posted collections are append-only; reverse do not edit"
  }),
  freezeEntry({
    id: "DB-006",
    code: "DB_DUAL_WRITE_SAFE",
    category: "database",
    severity: "high",
    ownerId: "OWN-002",
    title: "Dual-write safe",
    rule: "Dual-write preserves local money SoT rules"
  }),
  freezeEntry({
    id: "DB-007",
    code: "DB_NO_RPO_REDEFINE",
    category: "database",
    severity: "critical",
    ownerId: "OWN-002",
    title: "No RPO/RTO redefine",
    rule: "Do not redefine Phase 14/15 RPO/RTO in EDSM or migrations docs"
  }),
  freezeEntry({
    id: "DB-008",
    code: "DB_WAVE2_ALIGN",
    category: "database",
    severity: "high",
    ownerId: "OWN-002",
    title: "Wave 2 align",
    rule: "Align with Wave 2 migration/RLS catalog",
    waveRef: "WAVE-02"
  })
]);

// ─── UI rules ─────────────────────────────────────────────────────────────────

export const UI_STANDARDS = Object.freeze([
  freezeEntry({
    id: "UI-001",
    code: "UI_SHARED_SPA",
    category: "ui",
    severity: "critical",
    ownerId: "OWN-006",
    title: "Shared vanilla JS SPA",
    rule: "Web UI is app.js + src/ vanilla SPA",
    waveRef: "WAVE-05",
    rejectedStacks: ["Next.js", "React-primary-SPA-rewrite"]
  }),
  freezeEntry({
    id: "UI-002",
    code: "UI_NO_NEXTJS",
    category: "ui",
    severity: "critical",
    ownerId: "OWN-002",
    title: "No Next.js primary",
    rule: "Next.js/React are not the primary delivery path",
    rejectedStacks: ["Next.js"]
  }),
  freezeEntry({
    id: "UI-003",
    code: "UI_CAPACITOR_ANDROID",
    category: "ui",
    severity: "critical",
    ownerId: "OWN-002",
    title: "Capacitor Android",
    rule: "Android APK is Capacitor loading shared www/ SPA",
    waveRef: "WAVE-04"
  }),
  freezeEntry({
    id: "UI-004",
    code: "UI_NO_COMPOSE_PRIMARY",
    category: "ui",
    severity: "critical",
    ownerId: "OWN-002",
    title: "No Compose primary",
    rule: "Jetpack Compose / Kotlin-first is not the primary Android UI",
    rejectedStacks: ["Jetpack Compose primary Android", "Kotlin-first Android rewrite"]
  }),
  freezeEntry({
    id: "UI-005",
    code: "UI_CSS_TOKENS",
    category: "ui",
    severity: "high",
    ownerId: "OWN-006",
    title: "CSS design tokens",
    rule: "Use existing CSS variables (--brand, --ink, --bg, --gold, …)"
  }),
  freezeEntry({
    id: "UI-006",
    code: "UI_NO_PURPLE_CLICHE",
    category: "ui",
    severity: "medium",
    ownerId: "OWN-006",
    title: "Avoid purple-on-white cliché",
    rule: "Do not default to purple-on-white / glow AI aesthetics"
  }),
  freezeEntry({
    id: "UI-007",
    code: "UI_RESPONSIVE",
    category: "ui",
    severity: "high",
    ownerId: "OWN-006",
    title: "Responsive CSS",
    rule: "Honor styles.css + styles-mobile.css paths"
  }),
  freezeEntry({
    id: "UI-008",
    code: "UI_AUDIT_REPORTS_EXTRAS",
    category: "ui",
    severity: "critical",
    ownerId: "OWN-006",
    title: "Audit/Reports extras",
    rule: "No new top-level nav; extras under Audit/Reports"
  }),
  freezeEntry({
    id: "UI-009",
    code: "UI_GHS_DISPLAY",
    category: "ui",
    severity: "medium",
    ownerId: "OWN-003",
    title: "GHS display",
    rule: "UI may display GHS; cores store pesewas",
    moneyInvariant: true
  }),
  freezeEntry({
    id: "UI-010",
    code: "UI_A11Y_AA",
    category: "ui",
    severity: "high",
    ownerId: "OWN-006",
    title: "WCAG 2.1 AA",
    rule: "Target WCAG 2.1 Level AA for staff and member surfaces"
  })
]);

// ─── Compliance checks ────────────────────────────────────────────────────────

export const COMPLIANCE_CHECKS = Object.freeze([
  freezeEntry({
    id: "CHK-001",
    code: "CHK_STACK_SPA",
    title: "SPA stack",
    mapsTo: ["UI-001", "UI-002"],
    critical: true,
    acceptance: "Vanilla JS SPA is primary web path; Next.js not required"
  }),
  freezeEntry({
    id: "CHK-002",
    code: "CHK_STACK_CAPACITOR",
    title: "Capacitor Android",
    mapsTo: ["UI-003", "UI-004"],
    critical: true,
    acceptance: "Capacitor + shared SPA; Compose not primary"
  }),
  freezeEntry({
    id: "CHK-003",
    code: "CHK_STACK_ELECTRON",
    title: "Electron EXE",
    mapsTo: ["UI-001"],
    critical: true,
    acceptance: "Electron loads www/ with Wave 6 IPC hardening"
  }),
  freezeEntry({
    id: "CHK-004",
    code: "CHK_MONEY_INVARIANTS",
    title: "Money invariants",
    mapsTo: ["COD-003", "COD-004", "COD-005", "COD-006"],
    critical: true,
    acceptance: "pesewas · interest 15 · days 31 · cashier 1000"
  }),
  freezeEntry({
    id: "CHK-005",
    code: "CHK_INVOKE_API",
    title: "invokeApi",
    mapsTo: ["API-001", "API-003"],
    critical: true,
    acceptance: "invokeApi gateway; OpenAPI facade only"
  }),
  freezeEntry({
    id: "CHK-006",
    code: "CHK_NO_TOP_NAV",
    title: "No top-level nav",
    mapsTo: ["COD-012", "UI-008"],
    critical: true,
    acceptance: "Extras under Audit/Reports only"
  }),
  freezeEntry({
    id: "CHK-007",
    code: "CHK_AI_ADVISORY",
    title: "AI advisory",
    mapsTo: ["COD-011"],
    critical: true,
    acceptance: "AI advisory only"
  }),
  freezeEntry({
    id: "CHK-008",
    code: "CHK_RBAC_FORBIDDEN",
    title: "RBAC forbidden",
    mapsTo: ["API-006", "NAM-010"],
    critical: true,
    acceptance: "SUPER_ADMIN_FORBIDDEN + role aliases retained"
  }),
  freezeEntry({
    id: "CHK-009",
    code: "CHK_NPM_TEST",
    title: "npm test",
    mapsTo: [],
    critical: true,
    acceptance: "npm test green before merge/release"
  }),
  freezeEntry({
    id: "CHK-010",
    code: "CHK_PREPARE_WEB",
    title: "prepare:web",
    mapsTo: ["COD-010"],
    critical: true,
    acceptance: "prepare:web when SPA/src mirrored to www/"
  }),
  freezeEntry({
    id: "CHK-011",
    code: "CHK_SCHEMA_MANIFEST",
    title: "Schema manifest",
    mapsTo: ["NAM-007"],
    critical: false,
    acceptance: "New schemas listed in manifest.json with sha256"
  }),
  freezeEntry({
    id: "CHK-012",
    code: "CHK_PHASE_CONSUME",
    title: "Phase consume",
    mapsTo: ["DB-007"],
    critical: true,
    acceptance: "Phases 9/13–20 consumed not redefined"
  })
]);

// ─── Stack invariants ─────────────────────────────────────────────────────────

export const STACK_INVARIANTS = Object.freeze([
  freezeEntry({
    id: "INV-001",
    code: "INV_SHARED_SPA",
    title: "Shared SPA SoT",
    rule: "Shared vanilla JS SPA is UI SoT for Web + EXE + APK"
  }),
  freezeEntry({
    id: "INV-002",
    code: "INV_CAPACITOR_NOT_COMPOSE",
    title: "Capacitor not Compose",
    rule: "Android delivery is Capacitor; Compose is not primary"
  }),
  freezeEntry({
    id: "INV-003",
    code: "INV_NO_NEXTJS",
    title: "No Next.js primary",
    rule: "Next.js/React rewrite is rejected as primary web path"
  }),
  freezeEntry({
    id: "INV-004",
    code: "INV_INVOKEAPI",
    title: "invokeApi in-process",
    rule: "Wave 3 invokeApi; OpenAPI is facade only"
  }),
  freezeEntry({
    id: "INV-005",
    code: "INV_WAVE2_DB",
    title: "Wave 2 database",
    rule: "Supabase PostgreSQL migrations/RLS/RPCs"
  }),
  freezeEntry({
    id: "INV-006",
    code: "INV_WAVE4_OFFLINE",
    title: "Wave 4 offline",
    rule: "JS offline/sync engine; thin native bridges only"
  }),
  freezeEntry({
    id: "INV-007",
    code: "INV_WAVE6_ELECTRON",
    title: "Wave 6 Electron",
    rule: "Electron main/preload/IPC hardening; loads www/"
  }),
  freezeEntry({
    id: "INV-008",
    code: "INV_MONEY",
    title: "Money invariants",
    rule: MONEY_INVARIANTS.note,
    moneyInvariant: true
  })
]);

const ALL_RULE_COLLECTIONS = Object.freeze([
  CODING_STANDARDS,
  NAMING_STANDARDS,
  API_STANDARDS,
  DB_STANDARDS,
  UI_STANDARDS,
  COMPLIANCE_CHECKS,
  STANDARDS_OWNERS,
  STACK_INVARIANTS
]);

function allEntries() {
  return ALL_RULE_COLLECTIONS.flatMap((c) => [...c]);
}

function findByIdOrCode(list, idOrCode) {
  const key = String(idOrCode || "");
  return list.find((e) => e.id === key || e.code === key) || null;
}

// ─── List / get ───────────────────────────────────────────────────────────────

export function listCodingStandards() {
  return [...CODING_STANDARDS];
}
export function listNamingStandards() {
  return [...NAMING_STANDARDS];
}
export function listApiStandards() {
  return [...API_STANDARDS];
}
export function listDbStandards() {
  return [...DB_STANDARDS];
}
export function listUiStandards() {
  return [...UI_STANDARDS];
}
export function listComplianceChecks() {
  return [...COMPLIANCE_CHECKS];
}
export function listStandardsOwners() {
  return [...STANDARDS_OWNERS];
}
export function listStackInvariants() {
  return [...STACK_INVARIANTS];
}
export function listAllStandards() {
  return allEntries();
}

export function getCodingStandard(idOrCode) {
  return findByIdOrCode(CODING_STANDARDS, idOrCode);
}
export function getNamingStandard(idOrCode) {
  return findByIdOrCode(NAMING_STANDARDS, idOrCode);
}
export function getApiStandard(idOrCode) {
  return findByIdOrCode(API_STANDARDS, idOrCode);
}
export function getDbStandard(idOrCode) {
  return findByIdOrCode(DB_STANDARDS, idOrCode);
}
export function getUiStandard(idOrCode) {
  return findByIdOrCode(UI_STANDARDS, idOrCode);
}
export function getComplianceCheck(idOrCode) {
  return findByIdOrCode(COMPLIANCE_CHECKS, idOrCode);
}
export function getStandardsOwner(idOrCode) {
  return findByIdOrCode(STANDARDS_OWNERS, idOrCode);
}
export function getStackInvariant(idOrCode) {
  return findByIdOrCode(STACK_INVARIANTS, idOrCode);
}

export function getStandard(idOrCode) {
  return findByIdOrCode(allEntries(), idOrCode);
}

export function listStandardsByCategory(category) {
  const cat = String(category || "").toLowerCase();
  return allEntries().filter((e) => String(e.category || "").toLowerCase() === cat);
}

export function listStandardsByOwner(ownerId) {
  return allEntries().filter((e) => e.ownerId === ownerId);
}

export function edsmCounts() {
  return Object.freeze({
    codingRules: CODING_STANDARDS.length,
    namingRules: NAMING_STANDARDS.length,
    apiRules: API_STANDARDS.length,
    dbRules: DB_STANDARDS.length,
    uiRules: UI_STANDARDS.length,
    complianceChecks: COMPLIANCE_CHECKS.length,
    owners: STANDARDS_OWNERS.length,
    stackInvariants: STACK_INVARIANTS.length,
    rejectedPrimaryStacks: REJECTED_PRIMARY_STACKS.length
  });
}

// ─── Assert helpers ───────────────────────────────────────────────────────────

export function assertIdUniqueness() {
  const ids = allEntries().map((e) => e.id);
  const codes = allEntries().map((e) => e.code);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupIds.length || dupCodes.length) {
    return err("EDSM-ID-001", "Duplicate standard ids or codes", { dupIds, dupCodes });
  }
  return ok();
}

export function assertIdPatterns() {
  const bad = allEntries().filter((e) => !RULE_ID_PATTERN.test(e.id) || !CODE_PATTERN.test(e.code));
  if (bad.length) {
    return err(
      "EDSM-ID-002",
      "Invalid id/code pattern",
      { bad: bad.map((b) => b.id) }
    );
  }
  return ok();
}

export function assertOwnersResolve() {
  const ownerIds = new Set(STANDARDS_OWNERS.map((o) => o.id));
  const missing = allEntries()
    .filter((e) => e.ownerId && !ownerIds.has(e.ownerId))
    .map((e) => `${e.id}->${e.ownerId}`);
  if (missing.length) {
    return err("EDSM-OWN-001", "Owner refs do not resolve", { missing });
  }
  return ok();
}

export function assertSingleOwnerPerOwnedEntry() {
  const owned = allEntries().filter((e) => e.ownerId);
  const multi = owned.filter((e) => Array.isArray(e.ownerId));
  if (multi.length) {
    return err("EDSM-OWN-002", "Entries must have a single ownerId", {
      bad: multi.map((m) => m.id)
    });
  }
  return ok();
}

export function assertMoneyInvariantsPresent() {
  const moneyRules = allEntries().filter((e) => e.moneyInvariant);
  if (moneyRules.length < 4) {
    return err("EDSM-MON-001", "Expected money-invariant rules", {
      count: moneyRules.length
    });
  }
  if (MONEY_INVARIANTS.unit !== "pesewas") {
    return err("EDSM-MON-002", "Money unit must be pesewas");
  }
  if (MONEY_INVARIANTS.interestDefault !== 15) {
    return err("EDSM-MON-003", "Interest default must be 15");
  }
  if (MONEY_INVARIANTS.collectionDays !== 31) {
    return err("EDSM-MON-004", "Collection days must be 31");
  }
  if (MONEY_INVARIANTS.cashierLimitGhs !== 1000) {
    return err("EDSM-MON-005", "Cashier limit must be 1000");
  }
  return ok({ moneyRules: moneyRules.length });
}

export function assertStackInvariants() {
  const findings = [];
  if (AUTHORITATIVE_STACK.web !== "vanilla-js-spa") {
    findings.push("web must be vanilla-js-spa");
  }
  if (AUTHORITATIVE_STACK.android !== "capacitor-shared-spa") {
    findings.push("android must be capacitor-shared-spa");
  }
  if (AUTHORITATIVE_STACK.api !== "invokeApi-in-process") {
    findings.push("api must be invokeApi-in-process");
  }
  if (AUTHORITATIVE_STACK.openApi !== "facade-only") {
    findings.push("openApi must be facade-only");
  }
  if (REJECTED_PRIMARY_STACKS.includes("Next.js") === false) {
    findings.push("Next.js must be listed as rejected primary");
  }
  if (
    REJECTED_PRIMARY_STACKS.some((s) => /Compose/i.test(s)) === false
  ) {
    findings.push("Compose must be listed as rejected primary");
  }
  if (UI_STANDARDS.some((u) => u.code === "UI_NO_NEXTJS") === false) {
    findings.push("UI_NO_NEXTJS missing");
  }
  if (UI_STANDARDS.some((u) => u.code === "UI_NO_COMPOSE_PRIMARY") === false) {
    findings.push("UI_NO_COMPOSE_PRIMARY missing");
  }
  if (UI_STANDARDS.some((u) => u.code === "UI_CAPACITOR_ANDROID") === false) {
    findings.push("UI_CAPACITOR_ANDROID missing");
  }
  // Guard: never require Next/Compose as primary in this registry text
  const primaryMandateLeak = allEntries().filter((e) => {
    const blob = `${e.title || ""} ${e.rule || ""} ${e.acceptance || ""}`.toLowerCase();
    const requiresNext =
      /must use next\.js|required.*next\.js|next\.js as primary|mandate.*next/.test(blob);
    const requiresCompose =
      /must use (jetpack )?compose|compose as primary|kotlin-first required/.test(blob);
    return requiresNext || requiresCompose;
  });
  if (primaryMandateLeak.length) {
    findings.push(
      `Registry must not mandate Next/Compose primary: ${primaryMandateLeak.map((x) => x.id).join(",")}`
    );
  }
  if (findings.length) {
    return err("EDSM-STK-001", "Stack invariants violated", { findings });
  }
  return ok();
}

export function assertComplianceMapsResolve() {
  const index = new Set(allEntries().map((e) => e.id));
  const missing = [];
  for (const chk of COMPLIANCE_CHECKS) {
    for (const ref of chk.mapsTo || []) {
      if (!index.has(ref)) missing.push(`${chk.id}->${ref}`);
    }
  }
  if (missing.length) {
    return err("EDSM-CHK-001", "Compliance mapsTo unresolved", { missing });
  }
  return ok();
}

export function assertRoleAliases() {
  if (ROLE_ALIASES.Admin !== "Branch Manager") {
    return err("EDSM-ROL-001", "Admin alias must be Branch Manager");
  }
  if (ROLE_ALIASES.KBA !== "Super Admin") {
    return err("EDSM-ROL-002", "KBA alias must be Super Admin");
  }
  if (ROLE_ALIASES.SystemOwner !== "john") {
    return err("EDSM-ROL-003", "SystemOwner must be john");
  }
  return ok();
}

export function assertPhaseRefsConsumed() {
  const required = [9, 13, 14, 16, 17, 18, 19, 20];
  for (const p of required) {
    if (!Object.values(PHASE_REFS).includes(p)) {
      return err("EDSM-PH-001", `Missing phase ref ${p}`);
    }
  }
  return ok();
}

/**
 * Full registry integrity validation.
 * @returns {{ ok: boolean, critical: number, warnings: number, findings: object[], counts: object }}
 */
export function validateStandardsRegistry() {
  const checks = [
    assertIdUniqueness(),
    assertIdPatterns(),
    assertOwnersResolve(),
    assertSingleOwnerPerOwnedEntry(),
    assertMoneyInvariantsPresent(),
    assertStackInvariants(),
    assertComplianceMapsResolve(),
    assertRoleAliases(),
    assertPhaseRefsConsumed()
  ];

  const findings = [];
  for (const c of checks) {
    if (!c.ok) {
      findings.push(critical(c.code, c.message, c));
    }
  }

  // Soft coverage warnings
  const counts = edsmCounts();
  if (counts.codingRules < 10) {
    findings.push(warning("EDSM-COV-001", "Coding rules below expected seed", counts));
  }
  if (counts.uiRules < 8) {
    findings.push(warning("EDSM-COV-002", "UI rules below expected seed", counts));
  }

  const criticalFindings = findings.filter((f) => f.severity === "critical");
  const warningFindings = findings.filter((f) => f.severity === "warning");

  return {
    ok: criticalFindings.length === 0,
    critical: criticalFindings.length,
    warnings: warningFindings.length,
    findings,
    counts,
    authoritativeStack: AUTHORITATIVE_STACK,
    rejectedPrimaryStacks: REJECTED_PRIMARY_STACKS,
    moneyInvariants: MONEY_INVARIANTS
  };
}

export function validateEdsmCompliance(sample = {}) {
  return validateStandardsRegistry();
}
