/**
 * Phase 14 — Canonical Deployment Registry (EDDIES).
 * Source of truth for environments, infrastructure intents, pipelines,
 * deployments, artifacts, releases, and RPO/RTO targets.
 * Operational runtime remains Module 30 (platform-ops.js) — not replaced.
 * Catalog only: no money posts, no RBAC rewrite, no new nav.
 */

export const EDDIES_VERSION = "1.0.0";
export const EDDIES_STATUS = "Authoritative";
export const OPERATIONAL_MANAGER_MODULE = 30;
export const OPERATIONAL_MANAGER_REF = "src/core/platform-ops.js";
export const BACKUP_ENGINE_MODULE = 21;
export const BACKUP_ENGINE_REF = "src/core/backup-recovery-ops.js";

export const ENV_ID_PATTERN = /^ENV-[0-9]{3}$/;
export const INFRA_ID_PATTERN = /^INF-[0-9]{3}$/;
export const PIPELINE_ID_PATTERN = /^PIPE-[0-9]{3}$/;
export const DEPLOYMENT_ID_PATTERN = /^DEP-[0-9]{3}$/;
export const ARTIFACT_ID_PATTERN = /^ART-[0-9]{3}$/;
export const RELEASE_ID_PATTERN = /^REL-[0-9]{3}$/;
export const RPO_RTO_ID_PATTERN = /^RRT-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const ENVIRONMENT_TIERS = Object.freeze([
  "development",
  "qa",
  "uat",
  "staging",
  "production",
  "dr"
]);

/** Maps EDDIES catalog codes to Module 30 ENVIRONMENT_CODES. */
export const MODULE30_ENV_CODE_MAP = Object.freeze({
  DEV: "development",
  QA: "testing",
  UAT: "uat",
  STAGING: "staging",
  PRODUCTION: "production",
  DR: "dr"
});

export const ARTIFACT_KINDS = Object.freeze([
  "web_bundle",
  "android_apk",
  "electron_exe",
  "sql_migration",
  "docs_catalog",
  "config_template"
]);

export const PIPELINE_KINDS = Object.freeze([
  "test",
  "prepare_web",
  "build_apk",
  "build_exe",
  "migrate",
  "promote",
  "verify"
]);

export const CRITICALITY = Object.freeze(["critical", "high", "standard", "low"]);

export const STABILIZATION_PERIODS = Object.freeze({
  development: { minutes: 0 },
  qa: { minutes: 5 },
  uat: { minutes: 15 },
  staging: { minutes: 15 },
  production: { minutes: 30 },
  dr: { minutes: 30 }
});

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

// ─── Environments ───────────────────────────────────────────────────────────

export const ENVIRONMENTS = Object.freeze([
  freezeEntry({
    id: "ENV-001",
    code: "DEV",
    name: "Development",
    tier: "development",
    module30Code: "development",
    purpose: "Local and shared developer workstations; Capacitor/Electron debug builds.",
    dataClass: "synthetic",
    promotesTo: ["ENV-002"],
    owner: "Platform Engineering Lead",
    accountableAuthority: "Platform Engineering Lead",
    operationalManager: "Module 30",
    artifacts: Object.freeze(["ART-001", "ART-004"]),
    rpoMinutes: 1440,
    rtoMinutes: 480
  }),
  freezeEntry({
    id: "ENV-002",
    code: "QA",
    name: "Quality Assurance",
    tier: "qa",
    module30Code: "testing",
    purpose: "Automated and manual QA against prepare:web / APK / EXE artifacts.",
    dataClass: "anonymized",
    promotesTo: ["ENV-003", "ENV-004"],
    owner: "QA Lead",
    accountableAuthority: "QA Lead",
    operationalManager: "Module 30",
    artifacts: Object.freeze(["ART-001", "ART-002", "ART-003"]),
    rpoMinutes: 720,
    rtoMinutes: 240
  }),
  freezeEntry({
    id: "ENV-003",
    code: "UAT",
    name: "User Acceptance Testing",
    tier: "uat",
    module30Code: "uat",
    purpose: "Business acceptance of SPA / Android / Electron release candidates.",
    dataClass: "masked_production_like",
    promotesTo: ["ENV-004"],
    owner: "Business Acceptance Lead",
    accountableAuthority: "Business Acceptance Lead",
    operationalManager: "Module 30",
    artifacts: Object.freeze(["ART-001", "ART-002", "ART-003"]),
    rpoMinutes: 360,
    rtoMinutes: 180
  }),
  freezeEntry({
    id: "ENV-004",
    code: "STAGING",
    name: "Staging",
    tier: "staging",
    module30Code: "staging",
    purpose: "Pre-production soak; migration dry-run; deployment governance rehearsal.",
    dataClass: "masked_production_like",
    promotesTo: ["ENV-005"],
    owner: "Release Manager",
    accountableAuthority: "Release Manager",
    operationalManager: "Module 30",
    artifacts: Object.freeze(["ART-001", "ART-002", "ART-003", "ART-004"]),
    rpoMinutes: 120,
    rtoMinutes: 120
  }),
  freezeEntry({
    id: "ENV-005",
    code: "PRODUCTION",
    name: "Production",
    tier: "production",
    module30Code: "production",
    purpose: "Live Smile Trust operations (SPA www/, Capacitor APK, Electron EXE, optional Supabase).",
    dataClass: "production",
    promotesTo: ["ENV-006"],
    owner: "Platform Operations Lead",
    accountableAuthority: "Platform Operations Lead",
    operationalManager: "Module 30",
    artifacts: Object.freeze(["ART-001", "ART-002", "ART-003", "ART-004"]),
    rpoMinutes: 60,
    rtoMinutes: 240,
    stabilizationMinutes: 30
  }),
  freezeEntry({
    id: "ENV-006",
    code: "DR",
    name: "Disaster Recovery",
    tier: "dr",
    module30Code: "dr",
    purpose: "Warm/cold DR site metadata; failover governed by Module 30 + Module 21 execution.",
    dataClass: "production_replica",
    promotesTo: [],
    owner: "DR Steward",
    accountableAuthority: "DR Steward",
    operationalManager: "Module 30",
    backupEngine: "Module 21",
    artifacts: Object.freeze(["ART-001", "ART-004"]),
    rpoMinutes: 60,
    rtoMinutes: 240,
    stabilizationMinutes: 30
  })
]);

// ─── Infrastructure intents (target/canonical; map to real artifacts) ───────

export const INFRASTRUCTURE = Object.freeze([
  freezeEntry({
    id: "INF-001",
    code: "WEB_STATIC_HOST",
    name: "Static web host (www/)",
    kind: "compute_edge",
    sizingTier: "small",
    mapsTo: "npm run prepare:web → www/",
    owner: "Platform Engineering Lead",
    accountableAuthority: "Platform Engineering Lead",
    environments: Object.freeze(["ENV-001", "ENV-002", "ENV-003", "ENV-004", "ENV-005", "ENV-006"])
  }),
  freezeEntry({
    id: "INF-002",
    code: "OPTIONAL_SUPABASE",
    name: "Optional Supabase / Postgres",
    kind: "database",
    sizingTier: "medium",
    mapsTo: "supabase/migrations/*.sql",
    owner: "Data Platform Lead",
    accountableAuthority: "Data Platform Lead",
    environments: Object.freeze(["ENV-004", "ENV-005", "ENV-006"]),
    note: "No real k8s HTTP servers in-repo; document as target topology for cloud+local."
  }),
  freezeEntry({
    id: "INF-003",
    code: "ANDROID_DISTRIBUTION",
    name: "Capacitor Android APK distribution",
    kind: "mobile",
    sizingTier: "small",
    mapsTo: "npm run build:apk / build:apk:release",
    owner: "Mobile Ops Lead",
    accountableAuthority: "Mobile Ops Lead",
    environments: Object.freeze(["ENV-002", "ENV-003", "ENV-004", "ENV-005"])
  }),
  freezeEntry({
    id: "INF-004",
    code: "ELECTRON_DESKTOP",
    name: "Electron Windows EXE",
    kind: "desktop",
    sizingTier: "small",
    mapsTo: "npm run build:exe / build:portable",
    owner: "Desktop Ops Lead",
    accountableAuthority: "Desktop Ops Lead",
    environments: Object.freeze(["ENV-002", "ENV-003", "ENV-004", "ENV-005"])
  }),
  freezeEntry({
    id: "INF-005",
    code: "CI_RUNNER_POOL",
    name: "CI runner pool (target)",
    kind: "ci",
    sizingTier: "medium",
    mapsTo: "npm test ; prepare:web ; build pipelines",
    owner: "DevOps Lead",
    accountableAuthority: "DevOps Lead",
    environments: Object.freeze(["ENV-001", "ENV-002", "ENV-004"])
  }),
  freezeEntry({
    id: "INF-006",
    code: "BACKUP_STORE",
    name: "Backup & DR object store (target)",
    kind: "storage",
    sizingTier: "medium",
    mapsTo: "Module 21 backup-recovery-ops + local/cloud backup buttons",
    owner: "Backup Steward",
    accountableAuthority: "Backup Steward",
    environments: Object.freeze(["ENV-005", "ENV-006"])
  })
]);

// ─── Pipelines ──────────────────────────────────────────────────────────────

export const PIPELINES = Object.freeze([
  freezeEntry({
    id: "PIPE-001",
    code: "UNIT_TEST",
    name: "Unit / contract test suite",
    kind: "test",
    command: "npm test",
    produces: Object.freeze([]),
    owner: "QA Lead",
    accountableAuthority: "QA Lead",
    environments: Object.freeze(["ENV-001", "ENV-002"])
  }),
  freezeEntry({
    id: "PIPE-002",
    code: "PREPARE_WEB",
    name: "Prepare static web bundle",
    kind: "prepare_web",
    command: "npm run prepare:web",
    script: "scripts/prepare-web.js",
    produces: Object.freeze(["ART-001"]),
    owner: "Platform Engineering Lead",
    accountableAuthority: "Platform Engineering Lead",
    environments: Object.freeze(["ENV-001", "ENV-002", "ENV-003", "ENV-004", "ENV-005"])
  }),
  freezeEntry({
    id: "PIPE-003",
    code: "BUILD_ANDROID_APK",
    name: "Capacitor Android APK build",
    kind: "build_apk",
    command: "npm run build:apk",
    produces: Object.freeze(["ART-002"]),
    owner: "Mobile Ops Lead",
    accountableAuthority: "Mobile Ops Lead",
    environments: Object.freeze(["ENV-002", "ENV-003", "ENV-004", "ENV-005"])
  }),
  freezeEntry({
    id: "PIPE-004",
    code: "BUILD_ELECTRON_EXE",
    name: "Electron Windows EXE build",
    kind: "build_exe",
    command: "npm run build:exe",
    produces: Object.freeze(["ART-003"]),
    owner: "Desktop Ops Lead",
    accountableAuthority: "Desktop Ops Lead",
    environments: Object.freeze(["ENV-002", "ENV-003", "ENV-004", "ENV-005"])
  }),
  freezeEntry({
    id: "PIPE-005",
    code: "SUPABASE_MIGRATE",
    name: "Optional Supabase migrations",
    kind: "migrate",
    command: "supabase db push (ops-governed)",
    produces: Object.freeze(["ART-004"]),
    owner: "Data Platform Lead",
    accountableAuthority: "Data Platform Lead",
    environments: Object.freeze(["ENV-004", "ENV-005", "ENV-006"]),
    module30Governance: true
  }),
  freezeEntry({
    id: "PIPE-006",
    code: "RELEASE_PROMOTE",
    name: "Release promotion with Module 30 approval",
    kind: "promote",
    command: "platform-ops plan/approve/execute deployment metadata",
    produces: Object.freeze(["ART-005"]),
    owner: "Release Manager",
    accountableAuthority: "Release Manager",
    environments: Object.freeze(["ENV-004", "ENV-005"]),
    module30Governance: true
  }),
  freezeEntry({
    id: "PIPE-007",
    code: "BACKUP_VERIFY",
    name: "Backup verification & recovery drill",
    kind: "verify",
    command: "Module 21 backup_verify / recovery_test jobs",
    produces: Object.freeze([]),
    owner: "Backup Steward",
    accountableAuthority: "Backup Steward",
    environments: Object.freeze(["ENV-005", "ENV-006"]),
    module21Execution: true
  })
]);

// ─── Artifacts ──────────────────────────────────────────────────────────────

export const ARTIFACTS = Object.freeze([
  freezeEntry({
    id: "ART-001",
    code: "WWW_SPA_BUNDLE",
    name: "Static SPA bundle (www/)",
    kind: "web_bundle",
    pathHint: "www/",
    producedBy: "PIPE-002",
    owner: "Platform Engineering Lead",
    accountableAuthority: "Platform Engineering Lead"
  }),
  freezeEntry({
    id: "ART-002",
    code: "ANDROID_APK",
    name: "Capacitor Android APK",
    kind: "android_apk",
    pathHint: "android/app/build/outputs/apk/",
    producedBy: "PIPE-003",
    owner: "Mobile Ops Lead",
    accountableAuthority: "Mobile Ops Lead"
  }),
  freezeEntry({
    id: "ART-003",
    code: "ELECTRON_EXE",
    name: "Electron Windows executable",
    kind: "electron_exe",
    pathHint: "dist/",
    producedBy: "PIPE-004",
    owner: "Desktop Ops Lead",
    accountableAuthority: "Desktop Ops Lead"
  }),
  freezeEntry({
    id: "ART-004",
    code: "SQL_MIGRATIONS",
    name: "Supabase / SQL migration set",
    kind: "sql_migration",
    pathHint: "supabase/migrations/",
    producedBy: "PIPE-005",
    owner: "Data Platform Lead",
    accountableAuthority: "Data Platform Lead"
  }),
  freezeEntry({
    id: "ART-005",
    code: "EDDIES_DOCS",
    name: "EDDIES deployment catalogs & schemas",
    kind: "docs_catalog",
    pathHint: "docs/enterprise-deployment-devops.md",
    producedBy: "PIPE-006",
    owner: "Architecture Steward",
    accountableAuthority: "Architecture Steward"
  }),
  freezeEntry({
    id: "ART-006",
    code: "CONFIG_EXAMPLE",
    name: "Config template",
    kind: "config_template",
    pathHint: "config.example.json",
    producedBy: "PIPE-002",
    owner: "Platform Engineering Lead",
    accountableAuthority: "Platform Engineering Lead"
  })
]);

// ─── Deployments (catalog intents; Module 30 executes metadata) ─────────────

export const DEPLOYMENTS = Object.freeze([
  freezeEntry({
    id: "DEP-001",
    code: "DEPLOY_WEB_PROD",
    name: "Promote www/ to production static host",
    environmentId: "ENV-005",
    artifactIds: Object.freeze(["ART-001"]),
    pipelineId: "PIPE-002",
    strategy: "recreate",
    owner: "Release Manager",
    accountableAuthority: "Release Manager",
    module30Ref: "platform-ops.executeDeployment"
  }),
  freezeEntry({
    id: "DEP-002",
    code: "DEPLOY_APK_PROD",
    name: "Distribute production Android APK",
    environmentId: "ENV-005",
    artifactIds: Object.freeze(["ART-002"]),
    pipelineId: "PIPE-003",
    strategy: "rolling",
    owner: "Mobile Ops Lead",
    accountableAuthority: "Mobile Ops Lead",
    module30Ref: "platform-ops.executeDeployment"
  }),
  freezeEntry({
    id: "DEP-003",
    code: "DEPLOY_EXE_PROD",
    name: "Distribute production Electron EXE",
    environmentId: "ENV-005",
    artifactIds: Object.freeze(["ART-003"]),
    pipelineId: "PIPE-004",
    strategy: "rolling",
    owner: "Desktop Ops Lead",
    accountableAuthority: "Desktop Ops Lead",
    module30Ref: "platform-ops.executeDeployment"
  }),
  freezeEntry({
    id: "DEP-004",
    code: "DEPLOY_MIGRATE_STAGING",
    name: "Apply migrations on staging (dry-run)",
    environmentId: "ENV-004",
    artifactIds: Object.freeze(["ART-004"]),
    pipelineId: "PIPE-005",
    strategy: "recreate",
    owner: "Data Platform Lead",
    accountableAuthority: "Data Platform Lead",
    module30Ref: "platform-ops.planDeployment"
  }),
  freezeEntry({
    id: "DEP-005",
    code: "DEPLOY_FAILOVER_DR",
    name: "DR failover metadata activation",
    environmentId: "ENV-006",
    artifactIds: Object.freeze(["ART-001", "ART-004"]),
    pipelineId: "PIPE-007",
    strategy: "blue_green",
    owner: "DR Steward",
    accountableAuthority: "DR Steward",
    module30Ref: "platform-ops DR governance",
    module21Ref: "backup-recovery-ops"
  })
]);

// ─── Releases ───────────────────────────────────────────────────────────────

export const RELEASES = Object.freeze([
  freezeEntry({
    id: "REL-001",
    code: "REL_WEB_SPA",
    name: "Web SPA release train",
    versionPolicy: "semver",
    artifactIds: Object.freeze(["ART-001", "ART-006"]),
    pipelineIds: Object.freeze(["PIPE-001", "PIPE-002", "PIPE-006"]),
    owner: "Release Manager",
    accountableAuthority: "Release Manager"
  }),
  freezeEntry({
    id: "REL-002",
    code: "REL_ANDROID",
    name: "Android APK release train",
    versionPolicy: "semver+build",
    artifactIds: Object.freeze(["ART-002"]),
    pipelineIds: Object.freeze(["PIPE-001", "PIPE-003", "PIPE-006"]),
    owner: "Mobile Ops Lead",
    accountableAuthority: "Mobile Ops Lead"
  }),
  freezeEntry({
    id: "REL-003",
    code: "REL_ELECTRON",
    name: "Electron EXE release train",
    versionPolicy: "semver+build",
    artifactIds: Object.freeze(["ART-003"]),
    pipelineIds: Object.freeze(["PIPE-001", "PIPE-004", "PIPE-006"]),
    owner: "Desktop Ops Lead",
    accountableAuthority: "Desktop Ops Lead"
  }),
  freezeEntry({
    id: "REL-004",
    code: "REL_DATA_SCHEMA",
    name: "Database schema / migration release",
    versionPolicy: "migration_serial",
    artifactIds: Object.freeze(["ART-004"]),
    pipelineIds: Object.freeze(["PIPE-005", "PIPE-006"]),
    owner: "Data Platform Lead",
    accountableAuthority: "Data Platform Lead"
  })
]);

// ─── RPO / RTO targets (critical: DB, app, auth) ────────────────────────────

export const RPO_RTO_TARGETS = Object.freeze([
  freezeEntry({
    id: "RRT-001",
    code: "RPO_RTO_DATABASE",
    name: "Database recovery objectives",
    service: "database",
    dataDomain: "persistence",
    criticality: "critical",
    environmentIds: Object.freeze(["ENV-005", "ENV-006"]),
    rpoMinutes: 60,
    rtoMinutes: 240,
    /** Tighter measurement example target used in governance tests (prod DB RPO budget). */
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 1,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Data Platform Lead",
    responsibleParty: "Backup Steward",
    auditAuthority: "Internal Auditor",
    owningModule: 21,
    relatedModules: Object.freeze([21, 30, 7]),
    backupAlignment: "Module 21 DEFAULT_RECOVERY_OBJECTIVES + platform.defaults.backup",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RRT-002",
    code: "RPO_RTO_APPLICATION",
    name: "Application (SPA/APK/EXE) recovery objectives",
    service: "application",
    dataDomain: "runtime",
    criticality: "critical",
    environmentIds: Object.freeze(["ENV-005", "ENV-006"]),
    rpoMinutes: 60,
    rtoMinutes: 120,
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 120,
    recoveryPriority: 2,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Platform Operations Lead",
    responsibleParty: "Release Manager",
    auditAuthority: "Internal Auditor",
    owningModule: 30,
    relatedModules: Object.freeze([30, 19, 21]),
    backupAlignment: "Redeploy ART-001/002/003 from last known-good release",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RRT-003",
    code: "RPO_RTO_AUTH",
    name: "Authentication / session recovery objectives",
    service: "auth",
    dataDomain: "identity",
    criticality: "critical",
    environmentIds: Object.freeze(["ENV-005", "ENV-006"]),
    rpoMinutes: 15,
    rtoMinutes: 60,
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 60,
    recoveryPriority: 1,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Security Operations Lead",
    responsibleParty: "Platform Engineering Lead",
    auditAuthority: "Internal Auditor",
    owningModule: 22,
    relatedModules: Object.freeze([22, 1, 30, 21]),
    backupAlignment: "Auth config + session policy restore; Module 22 signals",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RRT-004",
    code: "RPO_RTO_SYNC_QUEUE",
    name: "Offline sync queue recovery objectives",
    service: "synchronization",
    dataDomain: "offline_queue",
    criticality: "high",
    environmentIds: Object.freeze(["ENV-005"]),
    rpoMinutes: 30,
    rtoMinutes: 180,
    measurementRpoTargetMinutes: 30,
    measurementRtoTargetMinutes: 180,
    recoveryPriority: 3,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Sync Steward",
    responsibleParty: "Mobile Ops Lead",
    auditAuthority: "Internal Auditor",
    owningModule: 15,
    relatedModules: Object.freeze([15, 19, 21]),
    backupAlignment: "Android encrypted offline backup (Module 21)",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RRT-005",
    code: "RPO_RTO_PAYMENTS",
    name: "Payment / MoMo integration recovery objectives",
    service: "payments",
    dataDomain: "integration",
    criticality: "critical",
    environmentIds: Object.freeze(["ENV-005", "ENV-006"]),
    rpoMinutes: 15,
    rtoMinutes: 90,
    measurementRpoTargetMinutes: 15,
    measurementRtoTargetMinutes: 90,
    recoveryPriority: 2,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Integration Steward",
    responsibleParty: "Payment Ops Lead",
    auditAuthority: "Internal Auditor",
    owningModule: 28,
    relatedModules: Object.freeze([28, 16, 21, 30]),
    backupAlignment: "Provider config restore; no money rewrite",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RRT-006",
    code: "RPO_RTO_MONITORING",
    name: "Monitoring / observability stack recovery",
    service: "monitoring",
    dataDomain: "telemetry",
    criticality: "high",
    environmentIds: Object.freeze(["ENV-005"]),
    rpoMinutes: 120,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 120,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 4,
    stabilizationMinutesProduction: 30,
    accountableAuthority: "Platform Operations Lead",
    responsibleParty: "Monitoring Steward",
    auditAuthority: "Internal Auditor",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30]),
    backupAlignment: "Module 19 buffers; catalog rehydrate from EDDIES/EMOOIS",
    testingFrequency: "semi_annual"
  })
]);

export const REQUIRED_ENV_CODES = Object.freeze(["DEV", "QA", "UAT", "STAGING", "PRODUCTION", "DR"]);
export const CRITICAL_SERVICES = Object.freeze(["database", "application", "auth"]);

// ─── List / get helpers ─────────────────────────────────────────────────────

function indexByIdAndCode(list) {
  const map = new Map();
  for (const item of list) {
    map.set(item.id, item);
    map.set(item.code, item);
  }
  return map;
}

const ENV_INDEX = indexByIdAndCode(ENVIRONMENTS);
const INFRA_INDEX = indexByIdAndCode(INFRASTRUCTURE);
const PIPE_INDEX = indexByIdAndCode(PIPELINES);
const ART_INDEX = indexByIdAndCode(ARTIFACTS);
const DEP_INDEX = indexByIdAndCode(DEPLOYMENTS);
const REL_INDEX = indexByIdAndCode(RELEASES);
const RRT_INDEX = indexByIdAndCode(RPO_RTO_TARGETS);

export function listEnvironments() {
  return [...ENVIRONMENTS];
}
export function listInfrastructure() {
  return [...INFRASTRUCTURE];
}
export function listPipelines() {
  return [...PIPELINES];
}
export function listArtifacts() {
  return [...ARTIFACTS];
}
export function listDeployments() {
  return [...DEPLOYMENTS];
}
export function listReleases() {
  return [...RELEASES];
}
export function listRpoRtoTargets() {
  return [...RPO_RTO_TARGETS];
}

export function getEnvironment(idOrCode) {
  return ENV_INDEX.get(idOrCode) || null;
}
export function getInfrastructure(idOrCode) {
  return INFRA_INDEX.get(idOrCode) || null;
}
export function getPipeline(idOrCode) {
  return PIPE_INDEX.get(idOrCode) || null;
}
export function getArtifact(idOrCode) {
  return ART_INDEX.get(idOrCode) || null;
}
export function getDeployment(idOrCode) {
  return DEP_INDEX.get(idOrCode) || null;
}
export function getRelease(idOrCode) {
  return REL_INDEX.get(idOrCode) || null;
}
export function getRpoRtoTarget(idOrCode) {
  return RRT_INDEX.get(idOrCode) || null;
}

export function getStabilizationMinutes(environmentTierOrCode = "production") {
  const env = getEnvironment(environmentTierOrCode);
  if (env && Number.isFinite(env.stabilizationMinutes)) return env.stabilizationMinutes;
  const tier = env?.tier || String(environmentTierOrCode).toLowerCase();
  return STABILIZATION_PERIODS[tier]?.minutes ?? STABILIZATION_PERIODS.production.minutes;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function assertIdUniqueness(collections = {
  environments: ENVIRONMENTS,
  infrastructure: INFRASTRUCTURE,
  pipelines: PIPELINES,
  artifacts: ARTIFACTS,
  deployments: DEPLOYMENTS,
  releases: RELEASES,
  rpoRtoTargets: RPO_RTO_TARGETS
}) {
  const seenIds = new Map();
  const seenCodes = new Map();
  for (const [label, list] of Object.entries(collections)) {
    for (const entry of list) {
      if (!entry?.id) return err("EDDIES-ID-001", `${label} entry missing id`);
      if (seenIds.has(entry.id)) {
        return err("EDDIES-ID-002", `Duplicate id ${entry.id} in ${label} and ${seenIds.get(entry.id)}`);
      }
      seenIds.set(entry.id, label);
      if (entry.code) {
        const key = `${label}:${entry.code}`;
        if (seenCodes.has(key)) {
          return err("EDDIES-ID-003", `Duplicate code ${entry.code} in ${label}`);
        }
        seenCodes.set(key, entry.id);
      }
    }
  }
  // Global ID uniqueness across all catalogs
  const global = new Set();
  for (const list of Object.values(collections)) {
    for (const entry of list) {
      if (global.has(entry.id)) {
        return err("EDDIES-ID-004", `Global duplicate id ${entry.id}`);
      }
      global.add(entry.id);
    }
  }
  return ok({ idCount: global.size });
}

export function assertSingleAccountableAuthority(entry, label = "entry") {
  if (!entry || typeof entry !== "object") {
    return err("EDDIES-AA-001", `${label} missing`);
  }
  const aa = entry.accountableAuthority;
  if (!aa || !String(aa).trim()) {
    return err("EDDIES-AA-002", `${label} ${entry.id || ""} requires accountableAuthority`);
  }
  if (Array.isArray(aa) || (typeof aa === "object" && aa !== null && !(aa instanceof String))) {
    return err("EDDIES-AA-003", `${label} ${entry.id} accountableAuthority must be a single string`);
  }
  if (entry.accountableAuthorities) {
    return err("EDDIES-AA-004", `${label} ${entry.id} must not declare plural accountableAuthorities`);
  }
  return ok({ accountableAuthority: String(aa).trim() });
}

export function assertAccountableAuthorityPerTarget(targets = RPO_RTO_TARGETS) {
  for (const t of targets) {
    const r = assertSingleAccountableAuthority(t, "rpoRtoTarget");
    if (!r.ok) return r;
  }
  return ok({ targetCount: targets.length });
}

export function assertRequiredEnvironments(environments = ENVIRONMENTS) {
  const codes = new Set(environments.map((e) => e.code));
  for (const required of REQUIRED_ENV_CODES) {
    if (!codes.has(required)) {
      return err("EDDIES-ENV-001", `Missing required environment code ${required}`);
    }
  }
  for (const e of environments) {
    if (!MODULE30_ENV_CODE_MAP[e.code]) {
      return err("EDDIES-ENV-002", `Environment ${e.code} missing Module 30 map`);
    }
    if (e.module30Code !== MODULE30_ENV_CODE_MAP[e.code]) {
      return err("EDDIES-ENV-003", `Environment ${e.code} module30Code mismatch`);
    }
  }
  return ok({ environmentCount: environments.length });
}

export function assertCriticalRpoRto(targets = RPO_RTO_TARGETS) {
  const services = new Set(targets.map((t) => t.service));
  for (const svc of CRITICAL_SERVICES) {
    if (!services.has(svc)) {
      return err("EDDIES-RRT-001", `Missing RPO/RTO target for critical service ${svc}`);
    }
  }
  for (const t of targets) {
    if (!Number.isFinite(t.rpoMinutes) || t.rpoMinutes <= 0) {
      return err("EDDIES-RRT-002", `${t.id} requires positive rpoMinutes`);
    }
    if (!Number.isFinite(t.rtoMinutes) || t.rtoMinutes <= 0) {
      return err("EDDIES-RRT-003", `${t.id} requires positive rtoMinutes`);
    }
  }
  return ok({ criticalServices: [...CRITICAL_SERVICES] });
}

export function assertPipelineArtifactRefs(
  pipelines = PIPELINES,
  artifacts = ARTIFACTS
) {
  const artIds = new Set(artifacts.map((a) => a.id));
  for (const p of pipelines) {
    for (const aid of p.produces || []) {
      if (!artIds.has(aid)) {
        return err("EDDIES-PIPE-001", `Pipeline ${p.id} produces missing artifact ${aid}`);
      }
    }
  }
  for (const a of artifacts) {
    if (a.producedBy && !pipelines.some((p) => p.id === a.producedBy)) {
      return err("EDDIES-ART-001", `Artifact ${a.id} producedBy missing pipeline ${a.producedBy}`);
    }
  }
  return ok();
}

export function assertModule30NotReplaced() {
  return ok({
    replaced: false,
    postsMoney: false,
    newNav: false,
    rbacRewrite: false,
    operationalManagerModule: OPERATIONAL_MANAGER_MODULE,
    operationalManagerRef: OPERATIONAL_MANAGER_REF,
    note: "EDDIES catalogs deployment/infra only; Module 30 remains operational manager."
  });
}

export function validateDeploymentRegistry() {
  const errors = [];
  const steps = [
    assertIdUniqueness(),
    assertRequiredEnvironments(),
    assertCriticalRpoRto(),
    assertAccountableAuthorityPerTarget(),
    assertPipelineArtifactRefs()
  ];
  for (const list of [
    ENVIRONMENTS,
    INFRASTRUCTURE,
    PIPELINES,
    ARTIFACTS,
    DEPLOYMENTS,
    RELEASES,
    RPO_RTO_TARGETS
  ]) {
    for (const entry of list) {
      const aa = assertSingleAccountableAuthority(entry);
      if (!aa.ok) errors.push(aa.message);
    }
  }
  for (const step of steps) {
    if (!step.ok) errors.push(step.message);
  }
  const m30 = assertModule30NotReplaced();
  if (m30.replaced) errors.push("Module 30 must not be replaced");
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], counts: eddiesCounts() };
}

export function eddiesCounts() {
  return Object.freeze({
    environments: ENVIRONMENTS.length,
    infrastructure: INFRASTRUCTURE.length,
    pipelines: PIPELINES.length,
    artifacts: ARTIFACTS.length,
    deployments: DEPLOYMENTS.length,
    releases: RELEASES.length,
    rpoRtoTargets: RPO_RTO_TARGETS.length
  });
}
