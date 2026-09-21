/**
 * Enterprise Implementation Roadmap (EIR) — 10 sequential delivery waves.
 * Maps Master Implementation Backlog (MIB) items into WAVE-01..WAVE-10.
 * Does NOT redefine Phases 1–20 specs or replace Modules 1–30 engines.
 * Does NOT invent a second backlog — traces existing MIB IDs only.
 * Money invariants: pesewas · interest 15 · collection days 31 · cashier 1000.
 */

import {
  listBacklogItems,
  getBacklogItem,
  backlogStatusSummary,
  MIB_DOC,
  PHASE20_BASELINE_DOC
} from "./master-backlog-registry.js";
import { IMPLEMENTATION_WAVES } from "./master-backlog-waves.js";

export const EIR_VERSION = "1.0.0";
export const EIR_STATUS = "Authoritative";
export const EIR_EFFECTIVE_DATE = "2026-09-15";
export const EIR_DOC = "docs/enterprise-implementation-roadmap.md";
export const EIR_CATALOGS = "docs/eir-catalogs.md";
export const EIR_REGISTRY = "src/core/enterprise-roadmap-registry.js";
export const MIB_WAVES_REF = "src/core/master-backlog-waves.js";
export const MIB_REGISTRY_REF = "src/core/master-backlog-registry.js";

export const WAVE_STATUSES = Object.freeze([
  "Mostly Complete",
  "In Progress",
  "Planned"
]);

export const WAVE_ID_PATTERN = /^WAVE-(0[1-9]|10)$/;

/** MIB implementation wave (1–20) → EIR delivery wave id */
export const MIB_WAVE_TO_EIR = Object.freeze({
  1: "WAVE-01",
  2: "WAVE-01",
  3: "WAVE-01",
  4: "WAVE-02",
  5: "WAVE-03",
  6: "WAVE-04",
  7: "WAVE-05",
  8: "WAVE-05",
  9: "WAVE-05",
  10: "WAVE-06",
  11: "WAVE-07",
  12: "WAVE-08",
  13: "WAVE-08",
  14: "WAVE-09",
  15: "WAVE-09",
  16: "WAVE-09",
  17: "WAVE-09",
  18: "WAVE-10",
  19: "WAVE-10",
  20: "WAVE-10"
});

/** Module number → primary EIR wave (for MOD-* and descendants with wave:null) */
export const MODULE_TO_EIR = Object.freeze({
  1: "WAVE-01",
  2: "WAVE-08",
  3: "WAVE-05",
  4: "WAVE-05",
  5: "WAVE-01",
  6: "WAVE-05",
  7: "WAVE-05",
  8: "WAVE-06",
  9: "WAVE-05",
  10: "WAVE-07",
  11: "WAVE-08",
  12: "WAVE-09",
  13: "WAVE-01",
  14: "WAVE-01",
  15: "WAVE-04",
  16: "WAVE-05",
  17: "WAVE-05",
  18: "WAVE-03",
  19: "WAVE-09",
  20: "WAVE-03",
  21: "WAVE-09",
  22: "WAVE-09",
  23: "WAVE-01",
  24: "WAVE-01",
  25: "WAVE-02",
  26: "WAVE-05",
  27: "WAVE-08",
  28: "WAVE-03",
  29: "WAVE-09",
  30: "WAVE-01"
});

/** Phase number → primary EIR wave (for PH-* anchors) */
export const PHASE_TO_EIR = Object.freeze({
  1: "WAVE-01",
  2: "WAVE-01",
  3: "WAVE-05",
  4: "WAVE-05",
  5: "WAVE-04",
  6: "WAVE-03",
  7: "WAVE-02",
  8: "WAVE-01",
  9: "WAVE-01",
  10: "WAVE-01",
  11: "WAVE-03",
  12: "WAVE-09",
  13: "WAVE-09",
  14: "WAVE-10",
  15: "WAVE-09",
  16: "WAVE-10",
  17: "WAVE-09",
  18: "WAVE-09",
  19: "WAVE-10",
  20: "WAVE-10"
});

/** Program-level item lands on production readiness / program closeout wave */
export const PROGRAM_EIR_WAVE = "WAVE-10";

const MONEY_NOTE =
  "Money invariants preserved: integer pesewas; interest 15; collection days 31; cashier float 1000.";

function freezeDeep(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) {
      out[key] = Object.freeze(out[key].map((v) => (v && typeof v === "object" ? freezeDeep(v) : v)));
    } else if (out[key] && typeof out[key] === "object") {
      out[key] = freezeDeep(out[key]);
    }
  }
  return Object.freeze(out);
}

function modNum(ref) {
  if (ref == null) return null;
  if (typeof ref === "number") return ref;
  const m = String(ref).match(/^MOD-0*([0-9]+)$/i);
  return m ? Number(m[1]) : null;
}

function phNum(ref) {
  if (ref == null) return null;
  if (typeof ref === "number") return ref;
  const m = String(ref).match(/^PH-0*([0-9]+)$/i);
  return m ? Number(m[1]) : null;
}

/**
 * Resolve EIR wave id for a MIB backlog item (deterministic, exactly one).
 */
export function resolveBacklogItemWave(item, byId = null) {
  if (!item) return null;
  const index = byId || Object.fromEntries(listBacklogItems().map((i) => [i.identifier, i]));

  if (item.deliveryWave != null && item.deliveryWave >= 1 && item.deliveryWave <= 10) {
    return `WAVE-${String(item.deliveryWave).padStart(2, "0")}`;
  }

  if (item.wave != null && MIB_WAVE_TO_EIR[item.wave]) {
    return MIB_WAVE_TO_EIR[item.wave];
  }

  if (item.identifier === "PRG-0001") return PROGRAM_EIR_WAVE;

  const idMod = modNum(item.identifier);
  if (idMod != null && MODULE_TO_EIR[idMod]) return MODULE_TO_EIR[idMod];

  const idPh = phNum(item.identifier);
  if (idPh != null && PHASE_TO_EIR[idPh]) return PHASE_TO_EIR[idPh];

  const visited = new Set();
  let cur = item;
  while (cur && !visited.has(cur.identifier)) {
    visited.add(cur.identifier);
    if (cur.deliveryWave != null && cur.deliveryWave >= 1 && cur.deliveryWave <= 10) {
      return `WAVE-${String(cur.deliveryWave).padStart(2, "0")}`;
    }
    if (cur.wave != null && MIB_WAVE_TO_EIR[cur.wave]) return MIB_WAVE_TO_EIR[cur.wave];
    const m = modNum(cur.identifier) ?? modNum(cur.module);
    if (m != null && MODULE_TO_EIR[m]) return MODULE_TO_EIR[m];
    const p = phNum(cur.identifier) ?? phNum(cur.enterprisePhase);
    if (p != null && PHASE_TO_EIR[p]) return PHASE_TO_EIR[p];
    if (!cur.parentIdentifier) break;
    cur = index[cur.parentIdentifier];
  }

  const fallbackMod = modNum(item.module);
  if (fallbackMod != null && MODULE_TO_EIR[fallbackMod]) return MODULE_TO_EIR[fallbackMod];
  const fallbackPh = phNum(item.enterprisePhase);
  if (fallbackPh != null && PHASE_TO_EIR[fallbackPh]) return PHASE_TO_EIR[fallbackPh];

  return null;
}

function buildSequence(waveNumber) {
  const prior = waveNumber > 1 ? [`WAVE-${String(waveNumber - 1).padStart(2, "0")}`] : [];
  const next =
    waveNumber < 10 ? [`WAVE-${String(waveNumber + 1).padStart(2, "0")}`] : [];
  return freezeDeep({
    buildBefore: prior,
    buildAfter: next,
    blockingDependencies: prior,
    parallelOpportunities: [],
    criticalPath: true
  });
}

/**
 * @param {object} partial
 */
export function buildWave(partial) {
  const waveNumber = partial.waveNumber;
  const id = partial.id || `WAVE-${String(waveNumber).padStart(2, "0")}`;
  const mibWaves = [...(partial.mibWaves || [])];
  return freezeDeep({
    id,
    waveNumber,
    name: partial.name,
    code: partial.code,
    objectives: [...(partial.objectives || [])],
    deliverables: [...(partial.deliverables || [])],
    scope: [...(partial.scope || [])],
    outOfScope: [...(partial.outOfScope || [])],
    dependencies: {
      prerequisiteWaves: [...(partial.dependencies?.prerequisiteWaves || [])],
      blockingWaves: [...(partial.dependencies?.blockingWaves || [])],
      relatedPhases: [...(partial.dependencies?.relatedPhases || [])],
      relatedModules: [...(partial.dependencies?.relatedModules || [])],
      relatedApis: [...(partial.dependencies?.relatedApis || [])],
      relatedDb: [...(partial.dependencies?.relatedDb || [])],
      relatedUi: [...(partial.dependencies?.relatedUi || [])],
      relatedTests: [...(partial.dependencies?.relatedTests || [])],
      relatedPipelines: [...(partial.dependencies?.relatedPipelines || [])]
    },
    risks: [...(partial.risks || [])],
    requiredSkills: [...(partial.requiredSkills || [])],
    estimatedDurationWeeks: partial.estimatedDurationWeeks ?? { min: 1, max: 2 },
    estimatedEffortPersonWeeks: partial.estimatedEffortPersonWeeks ?? 4,
    waveStatus: partial.waveStatus ?? "Planned",
    entryCriteria: [...(partial.entryCriteria || [])],
    exitCriteria: [...(partial.exitCriteria || [])],
    acceptanceCriteria: [...(partial.acceptanceCriteria || [])],
    qualityGates: [...(partial.qualityGates || [])],
    testRequirements: [...(partial.testRequirements || [])],
    releaseMilestones: [...(partial.releaseMilestones || [])],
    requiredDocumentation: [...(partial.requiredDocumentation || [])],
    buildSequence: partial.buildSequence || buildSequence(waveNumber),
    mibWaves,
    mibWaveCodes: [...(partial.mibWaveCodes || [])],
    backlogItemIds: Object.freeze([]), // filled after mapping
    primaryModules: [...(partial.primaryModules || [])],
    primaryPhases: [...(partial.primaryPhases || [])],
    resourceProfile: freezeDeep(
      partial.resourceProfile || {
        developers: 2,
        qa: 1,
        dba: 0,
        devops: 0,
        uiux: 0,
        security: 0,
        productOwner: 1
      }
    ),
    moneyInvariantNote: partial.moneyInvariantNote ?? MONEY_NOTE,
    notes: partial.notes ?? null
  });
}

const COMMON_OUT = Object.freeze([
  "No Next.js/Flutter rewrite",
  "No new real HTTP servers",
  "No new top-level navigation",
  "Do not redefine Phases 1–20 or replace Modules 1–30 engines"
]);

const GATE_STD = Object.freeze([
  "QG-001",
  "QG-002",
  "Phase 16 unit/integration gate for in-scope suites",
  "prepare:web sync clean"
]);

const GATE_PROD = Object.freeze([
  "QG-001",
  "QG-002",
  "QG-003",
  "QG-004",
  "CERT-001 / CERT-002 per Phase 16",
  "Phase 19 change/release authorization",
  "Phase 20 RDY-* mandatory checks (fail closed)"
]);

/** @type {ReadonlyArray<object>} */
const WAVE_DEFS = [
  buildWave({
    waveNumber: 1,
    name: "Foundation Platform",
    code: "FOUNDATION_PLATFORM",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 6,
    mibWaves: [1, 2, 3],
    mibWaveCodes: ["FOUNDATION", "AUTH_RBAC", "TENANT_BRANCH"],
    primaryModules: [1, 5, 13, 14, 23, 24, 30],
    primaryPhases: [1, 2, 8, 9, 10],
    objectives: [
      "Close gaps in repo/architecture/env baseline for FinTech Susu delivery",
      "Harden Supabase auth, RBAC, tenant/branch isolation, config, logging, audit, errors, feature flags",
      "Confirm EMAS alignment without rewriting Phase 1–2 catalogs"
    ],
    deliverables: [
      "Hardened auth/RBAC and branch isolation checks",
      "Platform config/feature-flag/audit logging verification pack",
      "Wave-01 exit evidence linked to MIB wave epics 1–3"
    ],
    scope: [
      "Repo & architecture guardrails",
      "Environment / Supabase client config",
      "Auth, RBAC, tenant/branch",
      "Config, logging, audit, errors, feature flags"
    ],
    outOfScope: [...COMMON_OUT, "Live production certification"],
    dependencies: {
      prerequisiteWaves: [],
      blockingWaves: [],
      relatedPhases: [1, 2, 8, 9, 10],
      relatedModules: [1, 5, 13, 14, 30],
      relatedApis: ["auth", "session", "rbac"],
      relatedDb: ["profiles", "roles", "branches"],
      relatedUi: ["login", "session"],
      relatedTests: ["tests/emas-consistency.test.js", "tests/phase2-consistency.test.js"],
      relatedPipelines: ["prepare:web"]
    },
    risks: [
      { id: "EIR-R-001", level: "High", title: "RBAC drift across modules", mitigation: "Cross-module RBAC contract tests" },
      { id: "EIR-R-002", level: "Medium", title: "Config/env mismatch EXE vs APK", mitigation: "Unified config.json via prepare:web" }
    ],
    requiredSkills: ["Platform", "Security", "Supabase/Auth"],
    entryCriteria: [
      "Phase 20 baseline published as specification SoT",
      "MIB PRG-0001 and registries loadable",
      "Workspace builds and npm test harness available"
    ],
    exitCriteria: [
      "Auth/RBAC/tenant-branch exit criteria from MIB waves 1–3 met or gap-tracked",
      "No critical validateMasterBacklog / validateEnterpriseRoadmap findings",
      "Audit and error logging smoke verified"
    ],
    acceptanceCriteria: [
      "Foundation platform hardening accepted by Platform Administrator",
      MONEY_NOTE,
      "No silent Phase/Module redefinition"
    ],
    qualityGates: [...GATE_STD, "Security smoke (session/RBAC)"],
    testRequirements: [
      "Auth/RBAC regression",
      "Branch isolation tests",
      "MIB consistency green"
    ],
    releaseMilestones: ["MS-W01-HARDEN", "MS-W01-EXIT"],
    requiredDocumentation: [EIR_DOC, MIB_DOC, "docs/enterprise-master-architecture.md", PHASE20_BASELINE_DOC],
    resourceProfile: { developers: 2, qa: 1, dba: 0, devops: 1, uiux: 0, security: 1, productOwner: 1 },
    notes: "WAVE-01 foundation pack delivered (docs/wave1-foundation.md); EIR status remains Mostly Complete until WAVE-10 production certification. Gap closure + hardening evidence in tests/wave1-foundation.test.js."
  }),
  buildWave({
    waveNumber: 2,
    name: "Database Platform",
    code: "DATABASE_PLATFORM",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 5,
    mibWaves: [4],
    mibWaveCodes: ["DATABASE"],
    primaryModules: [14, 25, 30],
    primaryPhases: [7],
    objectives: [
      "Align PG schema, constraints, indexes, views, triggers, RPCs, seeds with ECDAPS",
      "Verify migrations and rollback playbooks without inventing a new schema SoT"
    ],
    deliverables: [
      "Migration/rollback verification report",
      "Constraint & money-column integrity checklist (pesewas)",
      "Wave-02 exit package"
    ],
    scope: ["PostgreSQL/Supabase schema hardening", "Migrations/rollbacks", "Seeds", "Views/triggers/RPCs"],
    outOfScope: [...COMMON_OUT, "Greenfield schema rewrite"],
    dependencies: {
      prerequisiteWaves: ["WAVE-01"],
      blockingWaves: ["WAVE-01"],
      relatedPhases: [7],
      relatedModules: [14, 25, 30],
      relatedApis: [],
      relatedDb: ["supabase/migrations", "constraints", "indexes"],
      relatedUi: [],
      relatedTests: ["tests/ecdaps-consistency.test.js", "tests/wave2-database.test.js"],
      relatedPipelines: ["migration apply (lab)", "rollback drill"]
    },
    risks: [
      { id: "EIR-R-003", level: "Critical", title: "Migration break on money tables", mitigation: "Pesewas invariant + rollback drill before promote" },
      { id: "EIR-R-004", level: "Medium", title: "Index drift vs query plans", mitigation: "Phase 17 perf spot-check on hot paths" }
    ],
    requiredSkills: ["DBA", "Platform", "Supabase"],
    entryCriteria: ["WAVE-01 exit criteria met", "ECDAPS docs/registry available"],
    exitCriteria: [
      "MIB wave 4 database exit met or gaps ticketed",
      "Rollback drill documented",
      "No critical money-column type violations in scoped checks"
    ],
    acceptanceCriteria: ["DB platform hardening accepted by Platform Administrator / DBA", MONEY_NOTE],
    qualityGates: [...GATE_STD, "Migration dry-run + rollback evidence"],
    testRequirements: ["Schema consistency", "Migration/rollback rehearsal", "Seed idempotency where applicable"],
    releaseMilestones: ["MS-W02-MIGRATE", "MS-W02-EXIT"],
    requiredDocumentation: [EIR_DOC, "docs/enterprise-canonical-database-architecture.md", MIB_DOC, "docs/wave2-database.md"],
    resourceProfile: { developers: 1, qa: 1, dba: 1, devops: 1, uiux: 0, security: 0, productOwner: 1 },
    notes: "WAVE-02 database platform pack delivered (docs/wave2-database.md); EIR status remains Mostly Complete until WAVE-10 production certification. Additive migration 044 + rollback + static tests; posting SoT remains JS with optional SQL RPCs."
  }),
  buildWave({
    waveNumber: 3,
    name: "Core Services",
    code: "CORE_SERVICES",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 6,
    mibWaves: [5],
    mibWaveCodes: ["CORE_APIS"],
    primaryModules: [18, 20, 28],
    primaryPhases: [6, 11],
    objectives: [
      "Harden in-process Auth/Customer/Savings/Branch/User/Audit/Notification service facades",
      "Keep canonical API catalog authoritative; no new HTTP server surface"
    ],
    deliverables: [
      "Core service contract verification pack",
      "Gateway/facade consistency evidence",
      "Wave-03 exit package"
    ],
    scope: [
      "Auth/Customer/Savings/Branch/User/Audit/Notification APIs (in-process)",
      "API gateway facades",
      "Job/queue service hooks as needed for APIs"
    ],
    outOfScope: [...COMMON_OUT, "External public REST rewrite"],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02"],
      blockingWaves: ["WAVE-02"],
      relatedPhases: [6, 11],
      relatedModules: [18, 20, 28],
      relatedApis: ["canonical API catalog", "graphql/openapi facades"],
      relatedDb: ["service-backed tables"],
      relatedUi: [],
      relatedTests: ["tests/ecacis-consistency.test.js", "tests/wave3-backend-api.test.js"],
      relatedPipelines: ["prepare:web"]
    },
    risks: [
      { id: "EIR-R-005", level: "High", title: "Facade/catalog drift", mitigation: "ECACIS consistency tests mandatory" }
    ],
    requiredSkills: ["Integration", "Backend", "API design"],
    entryCriteria: ["WAVE-02 exit criteria met", "Canonical API catalog available"],
    exitCriteria: ["MIB wave 5 Core APIs exit met or gaps ticketed", "No new HTTP listeners introduced"],
    acceptanceCriteria: ["Core services hardening accepted by CIO / Integration", MONEY_NOTE],
    qualityGates: [...GATE_STD, "API catalog consistency"],
    testRequirements: ["API contract tests", "Facade smoke", "No-money-post on catalog actions"],
    releaseMilestones: ["MS-W03-API", "MS-W03-EXIT"],
    requiredDocumentation: [EIR_DOC, "docs/enterprise-canonical-api-catalog.md", MIB_DOC, "docs/wave3-backend-api.md"],
    resourceProfile: { developers: 2, qa: 1, dba: 0, devops: 0, uiux: 0, security: 0, productOwner: 1 },
    notes: "WAVE-03 backend API platform pack delivered (docs/wave3-backend-api.md); EIR status remains Mostly Complete until WAVE-10. In-process invokeApi + OpenAPI facade; JS posting SoT with optional Wave 2 RPC dual-write; no HTTP listeners."
  }),
  buildWave({
    waveNumber: 4,
    name: "Offline Platform",
    code: "OFFLINE_PLATFORM",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 7,
    mibWaves: [6],
    mibWaveCodes: ["SYNC_ENGINE"],
    primaryModules: [15],
    primaryPhases: [5, 14],
    objectives: [
      "Harden encrypted local store, sync queue, conflict resolution, retry, recovery",
      "Collector offline path preserves money invariants on reconnect"
    ],
    deliverables: [
      "Offline sync conflict/recovery test evidence",
      "Collector offline drill notes",
      "Wave-04 exit package"
    ],
    scope: [
      "Encrypted local store",
      "Sync engine & queue",
      "Conflict/retry/recovery",
      "Collector offline flows"
    ],
    outOfScope: [...COMMON_OUT],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02", "WAVE-03"],
      blockingWaves: ["WAVE-03"],
      relatedPhases: [5, 14, 18],
      relatedModules: [15],
      relatedApis: ["sync events"],
      relatedDb: ["sync_outbox", "conflict_log"],
      relatedUi: ["collector offline"],
      relatedTests: ["tests/phase18-ops-sla.test.js", "tests/wave4-offline-platform.test.js"],
      relatedPipelines: ["offline recovery drill"]
    },
    risks: [
      { id: "EIR-R-006", level: "Critical", title: "Double-post on sync replay", mitigation: "Idempotent sync keys + money invariant pack" },
      { id: "EIR-R-007", level: "High", title: "Conflict policy ambiguity", mitigation: "Module 15 conflict rules + ops sync-event schema" }
    ],
    requiredSkills: ["Platform", "Mobile/offline", "Domain"],
    entryCriteria: ["WAVE-03 exit criteria met", "Module 15 offline sync specs available"],
    exitCriteria: ["MIB wave 6 Sync Engine exit met or gaps ticketed", "Offline recovery drill completed"],
    acceptanceCriteria: ["Offline platform accepted by Platform Administrator", MONEY_NOTE],
    qualityGates: [...GATE_STD, "Offline conflict/recovery gate"],
    testRequirements: ["Sync queue/retry", "Conflict resolution", "Money invariant offline pack"],
    releaseMilestones: ["MS-W04-SYNC", "MS-W04-EXIT"],
    requiredDocumentation: [EIR_DOC, "docs/offline-sync.md", "docs/enterprise-operations-support.md", "docs/wave4-android-offline.md"],
    resourceProfile: { developers: 2, qa: 1, dba: 0, devops: 1, uiux: 1, security: 1, productOwner: 1 },
    notes: "WAVE-04 offline platform pack delivered (docs/wave4-android-offline.md); Capacitor + shared JS SPA sync engine (not Compose rewrite); EIR status remains Mostly Complete until WAVE-10. Deep sync/conflict/retry/recovery + Phase 18 collector UX; thin Android plugin bridges optional."
  }),
  buildWave({
    waveNumber: 5,
    name: "Core Business Modules",
    code: "CORE_BUSINESS",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 2, max: 3 },
    estimatedEffortPersonWeeks: 12,
    mibWaves: [7, 8, 9],
    mibWaveCodes: ["CUSTOMER", "SAVINGS", "DAILY_COLLECTIONS"],
    primaryModules: [3, 4, 6, 7, 9, 16, 17, 26],
    primaryPhases: [3, 4, 16],
    objectives: [
      "Harden customers, savings, daily collections, receipts, passbook, deposits, withdrawals",
      "Preserve 31-day collection cycle and pesewas posting"
    ],
    deliverables: [
      "Core business regression pack (collections/savings/withdrawals)",
      "Receipt/passbook verification",
      "Wave-05 exit package",
      "docs/wave5-web-admin-portal.md (SPA portal hardening — not Next.js)",
      "Ops monitoring + portal API KPI panels under Audit/Reports"
    ],
    scope: [
      "Customer CRM",
      "Individual + group savings",
      "Daily collections / agents",
      "Receipts, passbook, deposits, withdrawals",
      "Payment gateway edge gaps (MOD-016) as business-adjacent",
      "Enterprise web admin portal hardening on existing SPA (RBAC, monitoring, invokeApi wiring)"
    ],
    outOfScope: [...COMMON_OUT, "Windows EXE deep shell (WAVE-06)", "Loan product deep rewrite (deferred on WAVE-06)", "GL rewrite (WAVE-07)"],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02", "WAVE-03", "WAVE-04"],
      blockingWaves: ["WAVE-04"],
      relatedPhases: [3, 4, 16],
      relatedModules: [3, 4, 6, 7, 9, 16, 17],
      relatedApis: ["customer", "savings", "collections"],
      relatedDb: ["customers", "savings_accounts", "collections"],
      relatedUi: ["collections-entry", "customer-profile", "passbook", "audit-ops-monitoring", "reports-api-kpis"],
      relatedTests: ["tests/master-backlog-consistency.test.js", "tests/wave5-web-admin-portal.test.js"],
      relatedPipelines: ["prepare:web"]
    },
    risks: [
      { id: "EIR-R-008", level: "Critical", title: "Collection day/interest drift", mitigation: "Enforce days=31 and interest=15 in regression" },
      { id: "EIR-R-009", level: "High", title: "Cashier float breach", mitigation: "Enforce cashier 1000 float limit tests" }
    ],
    requiredSkills: ["Domain", "QA", "UI"],
    entryCriteria: ["WAVE-04 exit criteria met", "Money modules engines available"],
    exitCriteria: [
      "MIB waves 7–9 exit met or gaps ticketed",
      "Money invariant regression pack green for in-scope modules",
      "SPA admin portal ops/search/KPI panels available under Audit/Reports (no Next.js rewrite)"
    ],
    acceptanceCriteria: ["Core business hardening accepted by CIO", MONEY_NOTE, "Admin portal hardening on existing SPA accepted"],
    qualityGates: [...GATE_STD, "Money invariant gate (pesewas/15/31/1000)"],
    testRequirements: ["Collections/savings/withdrawals regression", "Receipt/passbook smoke", "Offline collection replay", "Wave 5 portal helpers + invokeApi KPI/search tests"],
    releaseMilestones: ["MS-W05-COLLECT", "MS-W05-EXIT"],
    requiredDocumentation: [
      EIR_DOC,
      "docs/individual-savings-collection.md",
      "docs/group-susu-management.md",
      "docs/withdrawals-savings-redemption.md",
      "docs/wave5-web-admin-portal.md"
    ],
    resourceProfile: { developers: 3, qa: 2, dba: 0, devops: 0, uiux: 1, security: 0, productOwner: 1 },
    notes: "WAVE-05 SPA admin portal hardening delivered (docs/wave5-web-admin-portal.md); EIR status remains Mostly Complete until WAVE-10. Vanilla JS SPA shared with Electron/Capacitor — NOT a Next.js rewrite. Ops monitoring + global search under Audit/Reports; portal reads via Wave 3 invokeApi; money invariants 15/31/1000/pesewas preserved."
  }),
  buildWave({
    waveNumber: 6,
    name: "Windows Desktop EXE",
    code: "WINDOWS_EXE",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 8,
    mibWaves: [10],
    mibWaveCodes: ["LOANS"],
    primaryModules: [8],
    primaryPhases: [3, 4, 16],
    objectives: [
      "Harden Electron Windows EXE shell around the shared vanilla JS SPA (same core as Web + Capacitor APK)",
      "Preserve Wave 3 invokeApi + Wave 4 runWave4Sync parity — no Next.js/React/SQLite business rewrite",
      "Ship NSIS installer + portable packaging, print/export bridges, auto-update scaffolding",
      "Keep Module 8 loan surface Mostly Complete; deep loan SM rewrite deferred (historical EIR name: Loan Platform)"
    ],
    deliverables: [
      "Hardened electron/main.js + preload IPC allowlist",
      "Shared Wave 4 sync desktop wake hooks",
      "Print / printToPDF / export bridges",
      "electron-builder NSIS + portable configs",
      "electron-updater scaffolding + code-signing docs",
      "docs/wave6-windows-exe.md",
      "Wave-06 exit package"
    ],
    scope: [
      "Electron security (contextIsolation, sandbox, CSP, navigation locks)",
      "Desktop print/export/secure vault/device id",
      "Shared offline queue + sync engine parity with Android",
      "Installer / portable EXE packaging path",
      "MIB wave 10 LOANS backlog mapping retained; loan deep-work deferred"
    ],
    outOfScope: [
      ...COMMON_OUT,
      "Electron+Next.js+React+TypeScript rewrite",
      "SQLite business database (prefer shared encrypted queue)",
      "AI auto-approval",
      "Accounting CoA rewrite",
      "Loan product deep rewrite (deferred; Module 8 remains Mostly Complete)"
    ],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02", "WAVE-03", "WAVE-04", "WAVE-05"],
      blockingWaves: ["WAVE-05"],
      relatedPhases: [3, 4, 16],
      relatedModules: [8, 15],
      relatedApis: ["loans", "sync", "monitoring"],
      relatedDb: ["loans", "loan_schedules", "guarantors"],
      relatedUi: ["backup-sync-desktop-panel", "receipt-print", "loan-application"],
      relatedTests: ["tests/wave6-windows-exe.test.js", "tests/loan-related where present"],
      relatedPipelines: ["prepare:web", "build:exe", "build:installer", "build:portable"]
    },
    risks: [
      { id: "EIR-R-010", level: "Critical", title: "Disbursement without approval (loan backlog on this wave id)", mitigation: "State-machine + RBAC gates; loan deep rewrite deferred but gates remain" },
      { id: "EIR-R-011", level: "High", title: "Desktop fork or AI treated as authority", mitigation: "Force shared SPA + identical runWave4Sync (no Next.js desktop); Module 29 advisory-only" }
    ],
    requiredSkills: ["Desktop/Electron", "Domain", "QA", "Security"],
    entryCriteria: ["WAVE-05 exit criteria met", "Electron entry loads www/ SPA"],
    exitCriteria: [
      "Electron hardening + packaging path documented",
      "Sync parity with Wave 4 engine verified by tests",
      "MIB wave 10 Loans exit met or gaps ticketed (loan deep-work may remain Mostly Complete)",
      "No auto-approval path"
    ],
    acceptanceCriteria: [
      "Windows EXE pilot packaging accepted by CIO",
      "Shared-core parity accepted (not Next.js rewrite)",
      MONEY_NOTE
    ],
    qualityGates: [...GATE_STD, "Electron IPC allowlist gate", "Sync engine parity gate", "No auto-approval invariant"],
    testRequirements: [
      "IPC allowlist tests",
      "Sync parity (same engine as Android)",
      "Offline queue desktop path",
      "Builder config presence",
      "Interest 15 default (loan surface regression)"
    ],
    releaseMilestones: ["MS-W06-EXE", "MS-W06-EXIT"],
    requiredDocumentation: [EIR_DOC, "docs/wave6-windows-exe.md", "docs/loan-status-transitions.md", MIB_DOC],
    resourceProfile: { developers: 2, qa: 1, dba: 0, devops: 1, uiux: 0, security: 1, productOwner: 1 },
    notes: "WAVE-06 delivery focus = Enterprise Windows Desktop EXE (docs/wave6-windows-exe.md). Historical EIR catalog name was Loan Platform (LOAN_PLATFORM); Module 8 / MIB wave 10 remain mapped here and stay Mostly Complete — deep loan SM hardening deferred. Electron wraps the same vanilla JS SPA as Web+APK; Wave 3 invokeApi + Wave 4 sync shared. NOT Electron+Next.js. Code signing certs are env-specific."
  }),
  buildWave({
    waveNumber: 7,
    name: "Enterprise Analytics & BI",
    code: "ANALYTICS_BI",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 8,
    mibWaves: [11],
    mibWaveCodes: ["ACCOUNTING"],
    primaryModules: [10, 11, 27, 29],
    primaryPhases: [3, 7, 11, 12, 16],
    objectives: [
      "Deliver shared-core Analytics/BI/AI facade (Modules 11/27/29) — not a Next.js BI rewrite",
      "Publish KPIs only via Module 27 canonical formulas; AI advisory-only",
      "Keep Module 10 Accounting Mostly Complete; deep CoA/GL rewrite deferred (historical EIR name: Accounting Platform)"
    ],
    deliverables: [
      "Wave 7 KPI/report/BI/fraud/AI facade",
      "Reports/Audit analytics panels (no new top-level nav)",
      "docs/wave7-analytics-bi.md",
      "KPI fixture + fraud/AI/export tests",
      "Wave-07 exit package"
    ],
    scope: [
      "Reporting framework facade over report-ops",
      "Executive KPI dashboards (Module 27)",
      "BI drill-down / period compare / branch benchmark helpers",
      "Fraud detect-only rules + Module 29 advisory AI",
      "Ghana microfinance regulatory summary templates",
      "MIB wave 11 ACCOUNTING mapping retained; GL deep-work deferred"
    ],
    outOfScope: [
      ...COMMON_OUT,
      "Next.js/React BI product rewrite",
      "Opaque unpaid ML vendor auto-decisions",
      "Accounting CoA/GL deep rewrite (deferred; Module 10 remains Mostly Complete)",
      "AI auto-approval of loans or money posts"
    ],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02", "WAVE-03", "WAVE-04", "WAVE-05", "WAVE-06"],
      blockingWaves: ["WAVE-05", "WAVE-06"],
      relatedPhases: [3, 7, 11, 12, 16],
      relatedModules: [10, 11, 27, 29],
      relatedApis: ["reports", "bi", "ai advisory", "accounting"],
      relatedDb: ["report views", "kpi registries", "chart_of_accounts"],
      relatedUi: ["reports-wave7-analytics", "audit-wave7-fraud-ai", "journal-entry"],
      relatedTests: ["tests/wave7-analytics-bi.test.js", "tests/bi-ops.test.js", "tests/ai-ops.test.js"],
      relatedPipelines: ["prepare:web"]
    },
    risks: [
      { id: "EIR-R-012", level: "Critical", title: "Unbalanced journals (accounting backlog on this wave id)", mitigation: "Double-entry validation remains; GL deep rewrite deferred" },
      { id: "EIR-R-013", level: "High", title: "Float rounding to non-pesewas", mitigation: "Integer-only amount columns + Wave 7 pesewas annotations" },
      { id: "EIR-R-013B", level: "High", title: "AI treated as posting authority", mitigation: "Module 29 advisory-only + audited Wave 7 AI router" }
    ],
    requiredSkills: ["Analytics", "Finance", "Domain", "QA", "AI"],
    entryCriteria: ["WAVE-06 exit criteria met", "Module 27 BI + Module 11 reports available"],
    exitCriteria: [
      "Analytics/BI/AI facade documented and tested",
      "KPI formulas SoT = Module 27",
      "MIB wave 11 Accounting exit met or gaps ticketed (GL deep-work may remain Mostly Complete)",
      "AI remains advisory-only"
    ],
    acceptanceCriteria: [
      "Analytics & BI pilot accepted by CIO / Policy Owner",
      "Shared-core parity accepted (not Next.js rewrite)",
      MONEY_NOTE
    ],
    qualityGates: [...GATE_STD, "KPI formula fixture gate", "AI advisory-only gate", "Trial balance / double-entry gate (accounting surface)"],
    testRequirements: [
      "KPI fixture coverage for canonical Module 27 KPIs",
      "Fraud detect-only + AI authz/audit tests",
      "Export masking gate",
      "TB/P&L smoke where accounting surface touched"
    ],
    releaseMilestones: ["MS-W07-ANALYTICS", "MS-W07-EXIT"],
    requiredDocumentation: [EIR_DOC, "docs/wave7-analytics-bi.md", "docs/enterprise-bi.md", "docs/accounting-general-ledger.md", MIB_DOC],
    resourceProfile: { developers: 2, qa: 1, dba: 1, devops: 0, uiux: 1, security: 0, productOwner: 1 },
    notes: "WAVE-07 delivery focus = Enterprise Analytics & BI (docs/wave7-analytics-bi.md). Historical EIR catalog name was Accounting Platform (ACCOUNTING_PLATFORM); Module 10 / MIB wave 11 remain mapped and stay Mostly Complete — deep CoA rewrite deferred. Facade over Modules 11/27/29 on shared SPA; AI advisory-only; no Next.js BI product."
  }),
  buildWave({
    waveNumber: 8,
    name: "Release Certification",
    code: "RELEASE_CERTIFICATION",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 1, max: 2 },
    estimatedEffortPersonWeeks: 6,
    mibWaves: [12, 13],
    mibWaveCodes: ["REPORTS", "DASHBOARDS"],
    primaryModules: [2, 11, 27],
    primaryPhases: [13, 16, 17],
    objectives: [
      "Produce RC1 validation platform certifying Waves 1–7 via Phase 16 ETQAVS quality gates",
      "Reuse npm test; emit machine-readable RC evidence — not a parallel QA product",
      "Keep Reporting Platform polish Mostly Complete via Wave 7; historical EIR name retained as alias"
    ],
    deliverables: [
      "wave8-release-certification orchestrator",
      "validate:rc script + docs/release-evidence RC JSON",
      "Cross-wave / security / DR / a11y smoke harnesses",
      "Audit/Reports certification panel",
      "docs/wave8-release-certification.md",
      "Wave-08 exit package"
    ],
    scope: [
      "Phase 16 gate evaluation + defect registry",
      "Cross-wave smoke (Foundation→Analytics)",
      "RC1 pilot/UAT decision (not CERT-001 production)",
      "MIB waves 12–13 REPORTS/DASHBOARDS mapping retained"
    ],
    outOfScope: [
      ...COMMON_OUT,
      "Live load generators / real DR infra drills (partial harness only)",
      "CERT-001 full production promote (WAVE-10)",
      "Next.js rewrite",
      "New top-level QA console nav"
    ],
    dependencies: {
      prerequisiteWaves: ["WAVE-01", "WAVE-02", "WAVE-03", "WAVE-04", "WAVE-05", "WAVE-06", "WAVE-07"],
      blockingWaves: ["WAVE-07"],
      relatedPhases: [13, 16, 17],
      relatedModules: [2, 11, 27],
      relatedApis: ["reports", "bi", "monitoring"],
      relatedDb: ["report views", "kpi registries"],
      relatedUi: ["audit-wave8-certification", "reports-wave8-rc"],
      relatedTests: ["tests/wave8-release-certification.test.js", "tests/phase16-quality-gates.test.js"],
      relatedPipelines: ["prepare:web", "validate:rc", "npm test"]
    },
    risks: [
      { id: "EIR-R-014", level: "Medium", title: "KPI definition drift", mitigation: "Enterprise BI registry + Wave 7 facade SoT" },
      { id: "EIR-R-014B", level: "High", title: "RC1 confused with CERT-001", mitigation: "Evidence marks notProductionCert001; Wave 10 owns production cert" }
    ],
    requiredSkills: ["QA", "Analytics", "UI", "DevOps"],
    entryCriteria: ["WAVE-07 exit criteria met", "Phase 16 ETQAVS catalogs available"],
    exitCriteria: [
      "RC1 evidence generated with decision PASS or blockers ticketed",
      "Mandatory QG-001/QG-002 smoke green with npm test",
      "MIB waves 12–13 exit met or gaps ticketed"
    ],
    acceptanceCriteria: [
      "Release certification platform accepted by QA Lead / CIO for pilot entry",
      MONEY_NOTE,
      "CERT-001 production promote not claimed"
    ],
    qualityGates: [...GATE_STD, "Critical report smoke gate", "RC1 gate (critical=0 + mandatory QG pass)"],
    testRequirements: [
      "Cross-wave smoke",
      "Phase 16 gate evaluation tests",
      "validate:rc evidence schema",
      "KPI registry consistency (Wave 7)"
    ],
    releaseMilestones: ["MS-W08-RC1", "MS-W08-EXIT"],
    requiredDocumentation: [
      EIR_DOC,
      "docs/wave8-release-certification.md",
      "docs/enterprise-testing-qa-validation.md",
      "docs/reports-analytics-bi.md",
      "docs/enterprise-bi.md"
    ],
    resourceProfile: { developers: 2, qa: 2, dba: 0, devops: 1, uiux: 1, security: 1, productOwner: 1 },
    notes: "WAVE-08 delivery focus = Release Certification / RC1 (docs/wave8-release-certification.md). Historical EIR catalog name was Reporting Platform (REPORTING_PLATFORM); MIB waves 12–13 remain mapped. Reporting/BI polish delivered via WAVE-07. RC1 certifies Waves 1–7 for pilot/UAT — full CERT-001 is WAVE-10. Uses Phase 16 gates + npm test; validate:rc writes docs/release-evidence."
  }),
  buildWave({
    waveNumber: 9,
    name: "Pilot Deployment, UAT & Operational Readiness",
    code: "PILOT_UAT_OPS_READINESS",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 2, max: 3 },
    estimatedEffortPersonWeeks: 10,
    mibWaves: [14, 15, 16, 17],
    mibWaveCodes: ["NOTIFICATIONS", "MONITORING", "SECURITY", "AI"],
    primaryModules: [12, 19, 21, 22, 29],
    primaryPhases: [14, 15, 16, 18, 20],
    objectives: [
      "Deliver pilot deployment plan, UAT pack, ops readiness, and training framework over RC1",
      "Produce machine-readable Go/No-Go evidence without claiming live branch cutover",
      "Keep historical Enterprise Features (MIB 14–17) mapped; Phase 12–18 catalogs remain SoT for notifications/monitoring/AI/BCDR"
    ],
    deliverables: [
      "wave9-pilot-uat-ops registries + evaluateGoNoGo",
      "validate:pilot / wave9:assess evidence writer",
      "UAT scenario pack + training curricula + Go/No-Go report draft",
      "Audit/Reports pilot panels",
      "docs/wave9-pilot-uat.md + UAT/training companions",
      "Wave-09 exit package (framework)"
    ],
    scope: [
      "Pilot environment isolation checklist",
      "Mandatory UAT scenarios (auth→admin) with recording fields",
      "Operational readiness (Phase 18 / RDY-*)",
      "Training tracks + feedback/issue registers",
      "Conditional Go with PendingHumanSignOff gates",
      "MIB waves 14–17 mapping retained"
    ],
    outOfScope: [
      ...COMMON_OUT,
      "Live bank branch cutover claim",
      "Fabricated Executive Sponsor approval",
      "False production financial reconciliation claim",
      "CERT-001 full production promote (WAVE-10)",
      "Autonomous AI money decisions"
    ],
    dependencies: {
      prerequisiteWaves: [
        "WAVE-01",
        "WAVE-02",
        "WAVE-03",
        "WAVE-04",
        "WAVE-05",
        "WAVE-06",
        "WAVE-07",
        "WAVE-08"
      ],
      blockingWaves: ["WAVE-08"],
      relatedPhases: [14, 15, 16, 18, 20],
      relatedModules: [12, 19, 21, 22, 29],
      relatedApis: ["notifications", "metrics", "ai advisory", "invokeApi"],
      relatedDb: ["alerts", "backup metadata", "pilot tenant"],
      relatedUi: ["audit-wave9-pilot", "reports-wave9-uat"],
      relatedTests: [
        "tests/wave9-pilot-uat.test.js",
        "tests/wave8-release-certification.test.js",
        "tests/phase16-quality-gates.test.js"
      ],
      relatedPipelines: ["validate:rc", "validate:pilot", "prepare:web", "npm test"]
    },
    risks: [
      { id: "EIR-R-015", level: "High", title: "BCDR RPO/RTO unmet", mitigation: "Phase 15 procedures in ops checklist; live DR cert deferred Wave 10" },
      { id: "EIR-R-016", level: "High", title: "AI scope creep into posting", mitigation: "UAT-LOAN-01 advisory-only + Module 24/29 rules" },
      { id: "EIR-R-017", level: "Medium", title: "Alert fatigue", mitigation: "Pilot alert routes isolated from prod on-call" },
      { id: "EIR-R-017B", level: "High", title: "Conditional Go treated as Executive Approved", mitigation: "HA-EXEC always PendingHumanSignOff until documented" }
    ],
    requiredSkills: ["Ops", "QA", "Security", "DevOps", "Training", "Product"],
    entryCriteria: ["WAVE-08 exit criteria met", "WAVE-08 RC1 PASS", "Phase 14–16/18/20 catalogs available"],
    exitCriteria: [
      "Pilot/UAT framework evidence written with Go or Conditional recommendation",
      "Mandatory UAT domains covered; ops + training packs present",
      "Human approval gates documented for Wave 10",
      "MIB waves 14–17 exit met or remaining gaps explicitly deferred with Phase 19 CR"
    ],
    acceptanceCriteria: [
      "Pilot/UAT ops readiness pack accepted by QA Lead for executive review (Conditional OK)",
      MONEY_NOTE,
      "No claim of live production certification or fabricated Executive Sponsor approval"
    ],
    qualityGates: [...GATE_STD, "RC1 entry gate", "UAT pack completeness gate", "Ops readiness gate", "Go/No-Go human sign-off gate"],
    testRequirements: [
      "UAT domain coverage",
      "RC1 entry criterion",
      "Go/No-Go rules + isolation flags",
      "validate:pilot evidence schema"
    ],
    releaseMilestones: ["MS-W09-PILOT", "MS-W09-UAT", "MS-W09-EXIT"],
    requiredDocumentation: [
      EIR_DOC,
      "docs/wave9-pilot-uat.md",
      "docs/wave9-uat-pack.md",
      "docs/wave9-training-package.md",
      "docs/wave9-go-nogo-report.md",
      "docs/enterprise-testing-qa-validation.md"
    ],
    resourceProfile: { developers: 2, qa: 2, dba: 1, devops: 2, uiux: 0, security: 1, productOwner: 1 },
    notes: "WAVE-09 delivery focus = Pilot Deployment, UAT & Operational Readiness (docs/wave9-pilot-uat.md). Historical EIR catalog name was Enterprise Features (ENTERPRISE_FEATURES); MIB waves 14–17 remain mapped. Notifications/monitoring/AI/BCDR catalogs stay Phase 12–18 SoT. Requires RC1 PASS; validate:pilot writes docs/release-evidence/wave9-pilot-evidence.json. Framework ready ≠ live branch cutover; Executive Sponsor stays PendingHumanSignOff. Full CERT-001 is WAVE-10."
  }),
  buildWave({
    waveNumber: 10,
    name: "Production Deployment, Go-Live, Hypercare & Continuous Improvement",
    code: "PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE",
    waveStatus: "Mostly Complete",
    estimatedDurationWeeks: { min: 4, max: 6 },
    estimatedEffortPersonWeeks: 24,
    mibWaves: [18, 19, 20],
    mibWaveCodes: ["TESTING", "DEPLOYMENT", "PRODUCTION_READINESS"],
    primaryModules: [21, 30],
    primaryPhases: [14, 15, 16, 19, 20],
    objectives: [
      "Deliver production deployment, cutover, rollback, hypercare, and project closure framework over RC1 + Wave 9",
      "Emit machine-readable go-live evidence without claiming live production cutover or auto-approving Executive Sign-Off",
      "Keep historical EIR name Production Readiness mapped; delivery focus = prod deploy / go-live / hypercare / closure"
    ],
    deliverables: [
      "wave10-production-golive-ops registries + evaluateProductionGoLive",
      "validate:golive / wave10:assess evidence writer",
      "Cutover runbook + rollback + hypercare + PIR + CI + KT packs",
      "Audit/Reports cutover / hypercare / closure panels",
      "docs/wave10-production-golive.md",
      "Wave-10 / program framework exit package (not live CERT-001 certified)"
    ],
    scope: [
      "Production env validation (≠ pilot/dev)",
      "Cutover + concrete rollback (revert / restore / flags / communicate)",
      "Production validation PV-*",
      "Hypercare 14d + metrics targets (Phase 13/17/18)",
      "CERT-001 preview vs certified linkage (Phase 16/20)",
      "MIB waves 18–20 TESTING/DEPLOYMENT/PRODUCTION_READINESS mapping retained"
    ],
    outOfScope: [
      ...COMMON_OUT,
      "Silent waiver of mandatory RDY checks",
      "Fabricated live production cutover or Executive Sign-Off Approved",
      "Next.js rewrite",
      "New top-level go-live console nav"
    ],
    dependencies: {
      prerequisiteWaves: [
        "WAVE-01",
        "WAVE-02",
        "WAVE-03",
        "WAVE-04",
        "WAVE-05",
        "WAVE-06",
        "WAVE-07",
        "WAVE-08",
        "WAVE-09"
      ],
      blockingWaves: ["WAVE-09"],
      relatedPhases: [14, 15, 16, 19, 20],
      relatedModules: [21, 30],
      relatedApis: ["monitoring", "sync"],
      relatedDb: ["prod migration freeze window"],
      relatedUi: ["audit-wave10-golive", "reports-wave10-closure"],
      relatedTests: [
        "tests/wave10-production-golive.test.js",
        "tests/etqavs-consistency.test.js",
        "tests/eddies-consistency.test.js",
        "tests/egccrms-consistency.test.js",
        "tests/eibprfbs-consistency.test.js",
        "tests/phase20-baseline-validation.test.js",
        "tests/enterprise-roadmap-consistency.test.js"
      ],
      relatedPipelines: ["prepare:web", "validate:golive", "npm test", "prod promote", "hypercare"]
    },
    risks: [
      { id: "EIR-R-018", level: "Critical", title: "Go-live before RDY checks", mitigation: "Fail-closed readiness; RISK-000001 tracked" },
      { id: "EIR-R-019", level: "High", title: "UAT scope underestimation", mitigation: "Role-based UAT scripts + PO sign-off" },
      { id: "EIR-R-020", level: "High", title: "Hotfix without CERT-002", mitigation: "Phase 16 hotfix gate path" },
      { id: "EIR-R-021", level: "Critical", title: "Framework confused with live cutover", mitigation: "Evidence marks liveProductionCutover=false; PendingHumanSignOff until AA approves" }
    ],
    requiredSkills: ["QA", "DevOps", "Security", "PO", "Governance", "Domain", "Ops"],
    entryCriteria: [
      "WAVE-09 exit criteria met (Conditional or Go evidence present)",
      "RC1 PASS evidence present",
      "Phase 14/15/16/19/20 catalogs available",
      "No open Critical defects without approved Phase 19 exception"
    ],
    exitCriteria: [
      "validate:golive FrameworkReady (or Conditional awaiting humans) with hard blockers=0",
      "Cutover/hypercare/closure framework accepted for operator execution",
      "MIB waves 18–20 exit met or remaining gaps deferred with Phase 19 CR",
      "CERT-001 remains preview until human approvals + live cutover",
      "validateEnterpriseRoadmap critical=0"
    ],
    acceptanceCriteria: [
      "Production deploy/golive framework accepted by Release Manager for executive review (FrameworkReady OK)",
      MONEY_NOTE,
      "No claim of live production certification or fabricated Executive Sponsor approval"
    ],
    qualityGates: [...GATE_PROD, "RC1+Wave9 entry gate", "Prod env ≠ pilot/dev gate", "Human sign-off gate for Accepted"],
    testRequirements: [
      "Prod env differsFromPilotDev",
      "evaluateProductionGoLive decisions",
      "validate:golive evidence schema",
      "Rollback plan concreteness",
      "Executive Sign-Off stays PendingHumanSignOff"
    ],
    releaseMilestones: ["MS-W10-FRAMEWORK", "MS-W10-CUTOVER", "MS-W10-HYPERCARE", "MS-W10-CLOSURE"],
    requiredDocumentation: [
      EIR_DOC,
      EIR_CATALOGS,
      "docs/wave10-production-golive.md",
      "docs/enterprise-testing-qa-validation.md",
      "docs/enterprise-deployment-devops.md",
      "docs/enterprise-governance-change-release.md",
      PHASE20_BASELINE_DOC,
      MIB_DOC
    ],
    resourceProfile: { developers: 3, qa: 3, dba: 1, devops: 2, uiux: 1, security: 2, productOwner: 1 },
    notes: "WAVE-10 delivery focus = Production Deployment, Go-Live, Hypercare & Continuous Improvement (docs/wave10-production-golive.md). Historical EIR catalog name was Production Readiness (PRODUCTION_READINESS); MIB waves 18–20 remain mapped. Requires RC1 PASS + Wave 9 Conditional/Go; validate:golive writes docs/release-evidence/wave10-golive-evidence.json. Framework complete ≠ production live; Executive Sign-Off stays PendingHumanSignOff; CERT-001 preview until human AA approvals. Implementation waves 1–10 framework complete — remaining work is human execution of pilot sign-offs + real production cutover under Wave 10 runbooks."
  })
];

export const IMPLEMENTATION_ROADMAP_WAVES = Object.freeze(WAVE_DEFS);

export const WAVE_BY_ID = Object.freeze(
  Object.fromEntries(IMPLEMENTATION_ROADMAP_WAVES.map((w) => [w.id, w]))
);

/** @type {Map<string, string>} backlogId → waveId */
const BACKLOG_TO_WAVE = new Map();
/** @type {Map<string, string[]>} waveId → backlogIds */
const WAVE_TO_BACKLOG = new Map(IMPLEMENTATION_ROADMAP_WAVES.map((w) => [w.id, []]));

function buildBacklogMapping() {
  BACKLOG_TO_WAVE.clear();
  for (const id of WAVE_TO_BACKLOG.keys()) WAVE_TO_BACKLOG.set(id, []);

  const items = listBacklogItems();
  const byId = Object.fromEntries(items.map((i) => [i.identifier, i]));

  for (const item of items) {
    const waveId = resolveBacklogItemWave(item, byId);
    if (!waveId) {
      BACKLOG_TO_WAVE.set(item.identifier, null);
      continue;
    }
    BACKLOG_TO_WAVE.set(item.identifier, waveId);
    WAVE_TO_BACKLOG.get(waveId).push(item.identifier);
  }

  for (const [waveId, ids] of WAVE_TO_BACKLOG.entries()) {
    ids.sort();
    WAVE_TO_BACKLOG.set(waveId, Object.freeze([...ids]));
    const wave = WAVE_BY_ID[waveId];
    if (wave) {
      // Replace frozen backlogItemIds via mutable rebuild — waves already frozen.
      // Consumers should use listBacklogForWave(); stored copy kept for docs helpers.
    }
  }
}

buildBacklogMapping();

export function listWaves() {
  return IMPLEMENTATION_ROADMAP_WAVES;
}

export function getWave(idOrNumber) {
  if (typeof idOrNumber === "number") {
    return IMPLEMENTATION_ROADMAP_WAVES.find((w) => w.waveNumber === idOrNumber) || null;
  }
  return WAVE_BY_ID[idOrNumber] || null;
}

export function listBacklogForWave(idOrNumber) {
  const wave = getWave(idOrNumber);
  if (!wave) return [];
  const ids = WAVE_TO_BACKLOG.get(wave.id) || [];
  return ids.map((id) => getBacklogItem(id)).filter(Boolean);
}

export function getWaveForBacklogItem(backlogId) {
  return BACKLOG_TO_WAVE.get(backlogId) || null;
}

export function backlogWaveMapping() {
  return Object.freeze(Object.fromEntries(BACKLOG_TO_WAVE.entries()));
}

export function waveBacklogCounts() {
  const out = {};
  for (const w of IMPLEMENTATION_ROADMAP_WAVES) {
    out[w.id] = (WAVE_TO_BACKLOG.get(w.id) || []).length;
  }
  return out;
}

export function listMibWavesForEir(waveId) {
  const w = getWave(waveId);
  return w ? [...w.mibWaves] : [];
}

export function criticalPathWaves() {
  return IMPLEMENTATION_ROADMAP_WAVES.filter((w) => w.buildSequence?.criticalPath).map((w) => w.id);
}

export function estimateTotalDurationWeeks() {
  let min = 0;
  let max = 0;
  for (const w of IMPLEMENTATION_ROADMAP_WAVES) {
    min += w.estimatedDurationWeeks.min;
    max += w.estimatedDurationWeeks.max;
  }
  return { min, max, note: "Sequential wave exits; calendar-relative gap closure + hardening (not greenfield)." };
}

export function aggregateResourcePlan() {
  const roles = ["developers", "qa", "dba", "devops", "uiux", "security", "productOwner"];
  const peak = Object.fromEntries(roles.map((r) => [r, 0]));
  const byWave = {};
  for (const w of IMPLEMENTATION_ROADMAP_WAVES) {
    byWave[w.id] = { ...w.resourceProfile };
    for (const r of roles) {
      peak[r] = Math.max(peak[r], w.resourceProfile[r] || 0);
    }
  }
  return freezeDeep({ peak, byWave, roles });
}

export function listRoadmapRisks() {
  const risks = [];
  for (const w of IMPLEMENTATION_ROADMAP_WAVES) {
    for (const r of w.risks) {
      risks.push({ ...r, waveId: w.id });
    }
  }
  return Object.freeze(risks);
}

export function qualityGateMatrix() {
  return Object.freeze(
    IMPLEMENTATION_ROADMAP_WAVES.map((w) =>
      freezeDeep({
        waveId: w.id,
        waveStatus: w.waveStatus,
        qualityGates: w.qualityGates,
        entryCriteriaCount: w.entryCriteria.length,
        exitCriteriaCount: w.exitCriteria.length
      })
    )
  );
}

function ok(extra = {}) {
  return { ok: true, severity: "info", ...extra };
}

function critical(code, message, extra = {}) {
  return { ok: false, severity: "critical", code, message, ...extra };
}

function warn(code, message, extra = {}) {
  return { ok: true, severity: "warning", code, message, ...extra };
}

/**
 * Validate enterprise roadmap: 10 waves, every MIB item mapped exactly once,
 * wave deps form a sequential DAG, exit-before-next-entry, gates present.
 */
export function validateEnterpriseRoadmap() {
  const findings = [];
  const waves = listWaves();

  if (waves.length !== 10) {
    findings.push(critical("EIR-WAV-001", `Expected 10 waves, found ${waves.length}`));
  }

  const ids = new Set();
  for (const w of waves) {
    if (!WAVE_ID_PATTERN.test(w.id)) {
      findings.push(critical("EIR-WAV-002", `Invalid wave id ${w.id}`));
    }
    if (ids.has(w.id)) findings.push(critical("EIR-WAV-003", `Duplicate wave id ${w.id}`));
    ids.add(w.id);
    if (!WAVE_STATUSES.includes(w.waveStatus)) {
      findings.push(critical("EIR-WAV-004", `Invalid waveStatus on ${w.id}`, { waveStatus: w.waveStatus }));
    }
    if (!w.qualityGates || w.qualityGates.length === 0) {
      findings.push(critical("EIR-QG-001", `Missing quality gates on ${w.id}`));
    }
    if (!w.exitCriteria || w.exitCriteria.length === 0) {
      findings.push(critical("EIR-EXIT-001", `Missing exit criteria on ${w.id}`));
    }
    if (!w.entryCriteria || w.entryCriteria.length === 0) {
      findings.push(critical("EIR-ENTRY-001", `Missing entry criteria on ${w.id}`));
    }
  }

  // Sequential dependency DAG: WAVE-n requires WAVE-1..n-1
  for (let n = 1; n <= 10; n++) {
    const w = getWave(n);
    if (!w) continue;
    const expected = [];
    for (let p = 1; p < n; p++) expected.push(`WAVE-${String(p).padStart(2, "0")}`);
    const prereq = w.dependencies?.prerequisiteWaves || [];
    for (const e of expected) {
      if (!prereq.includes(e)) {
        findings.push(critical("EIR-DEP-001", `${w.id} missing prerequisite ${e}`));
      }
    }
    for (const p of prereq) {
      if (!WAVE_BY_ID[p]) {
        findings.push(critical("EIR-DEP-002", `${w.id} unknown prerequisite ${p}`));
      }
      const pn = WAVE_BY_ID[p]?.waveNumber;
      if (pn != null && pn >= n) {
        findings.push(critical("EIR-DEP-003", `${w.id} has non-prior prerequisite ${p}`));
      }
    }
    // Exit before next entry: WAVE-n entry must require WAVE-(n-1) exit when n>1
    if (n > 1) {
      const priorId = `WAVE-${String(n - 1).padStart(2, "0")}`;
      const entryMentionsPriorExit = (w.entryCriteria || []).some(
        (c) => String(c).includes(priorId) && /exit/i.test(String(c))
      );
      if (!entryMentionsPriorExit) {
        findings.push(
          critical("EIR-DEP-004", `${w.id} entry criteria must require ${priorId} exit criteria met`)
        );
      }
    }
  }

  // MIB wave coverage: every MIB wave 1–20 maps to exactly one EIR wave
  const mibSeen = new Set();
  for (const w of waves) {
    for (const mw of w.mibWaves || []) {
      if (mibSeen.has(mw)) {
        findings.push(critical("EIR-MIB-001", `MIB wave ${mw} mapped to multiple EIR waves`));
      }
      mibSeen.add(mw);
      if (MIB_WAVE_TO_EIR[mw] !== w.id) {
        findings.push(
          critical("EIR-MIB-002", `MIB wave ${mw} table mismatch for ${w.id}`, {
            expected: MIB_WAVE_TO_EIR[mw]
          })
        );
      }
    }
  }
  for (let i = 1; i <= 20; i++) {
    if (!mibSeen.has(i)) {
      findings.push(critical("EIR-MIB-003", `MIB wave ${i} not assigned to any EIR wave`));
    }
  }
  if (IMPLEMENTATION_WAVES.length !== 20) {
    findings.push(warn("EIR-MIB-004", `Expected 20 MIB waves, found ${IMPLEMENTATION_WAVES.length}`));
  }

  // Every backlog item exactly once
  const items = listBacklogItems();
  const assigned = new Map();
  for (const item of items) {
    const waveId = BACKLOG_TO_WAVE.get(item.identifier);
    if (!waveId) {
      findings.push(critical("EIR-MAP-001", `Backlog item ${item.identifier} not mapped to any wave`));
      continue;
    }
    if (!WAVE_BY_ID[waveId]) {
      findings.push(critical("EIR-MAP-002", `Backlog item ${item.identifier} maps to unknown ${waveId}`));
      continue;
    }
    if (assigned.has(item.identifier)) {
      findings.push(critical("EIR-MAP-003", `Backlog item ${item.identifier} mapped more than once`));
    }
    assigned.set(item.identifier, waveId);
  }

  const mappedCount = assigned.size;
  if (mappedCount !== items.length) {
    findings.push(
      critical("EIR-MAP-004", `Mapped ${mappedCount} of ${items.length} backlog items`)
    );
  }

  // Inverse: sum of wave lists equals total; no duplicates across waves
  const seenInWaves = new Set();
  for (const w of waves) {
    const idsList = WAVE_TO_BACKLOG.get(w.id) || [];
    for (const id of idsList) {
      if (seenInWaves.has(id)) {
        findings.push(critical("EIR-MAP-005", `Backlog item ${id} appears in multiple wave lists`));
      }
      seenInWaves.add(id);
    }
  }
  if (seenInWaves.size !== items.length) {
    findings.push(
      critical("EIR-MAP-006", `Wave lists cover ${seenInWaves.size} items; backlog has ${items.length}`)
    );
  }

  const criticalFindings = findings.filter((f) => f.severity === "critical");
  if (criticalFindings.length === 0) {
    findings.push(ok({ code: "EIR-OK", message: "Enterprise roadmap validation passed" }));
  }

  return Object.freeze({
    ok: criticalFindings.length === 0,
    critical: criticalFindings.length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    findings: Object.freeze(findings),
    waveCount: waves.length,
    mappedBacklogItems: mappedCount,
    backlogTotal: items.length,
    waveBacklogCounts: waveBacklogCounts(),
    durationWeeks: estimateTotalDurationWeeks(),
    riskCount: listRoadmapRisks().length,
    mibStatusSummary: backlogStatusSummary()
  });
}

export {
  MONEY_NOTE as MONEY_INVARIANT_NOTE,
  WAVE_TO_BACKLOG as _WAVE_TO_BACKLOG_INTERNAL,
  BACKLOG_TO_WAVE as _BACKLOG_TO_WAVE_INTERNAL
};
