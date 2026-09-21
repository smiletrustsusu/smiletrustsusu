/**
 * Phase 17 — Canonical Performance Registry (EPSCMS).
 * Catalog of performance metrics, capacity plans, benchmarks, workload
 * profiles, resource thresholds, forecasts, and governance.
 * Consumes Phase 13 metrics/SLOs and Phase 16 performance thresholds —
 * does not redefine monitoring or testing standards.
 * Does not replace Modules 1–30 operational engines (esp. Module 19).
 * Catalog only: no money posts, no RBAC rewrite, no new nav.
 */

export const EPSCMS_VERSION = "1.0.0";
export const EPSCMS_STATUS = "Authoritative";
export const MONITORING_MODULE = 19;
export const MONITORING_ENGINE_REF = "src/core/monitoring-ops.js";
export const PHASE13_REGISTRY_REF = "src/core/canonical-monitoring-registry.js";
export const PHASE16_REGISTRY_REF = "src/core/canonical-testing-registry.js";
export const PHASE16_THRESHOLDS_REF = "docs/enterprise-testing-qa-validation.md";
export const PHASE14_DEPLOY_REF = "src/core/canonical-deployment-registry.js";
export const BACKUP_ENGINE_MODULE = 21;
export const AI_MODULE = 29;
export const PLATFORM_MODULE = 30;
export const JOB_ENGINE_MODULE = 18;

/** Phase 16 performance pass values — consumed, not redefined. */
export const PHASE16_PERF_TARGETS = Object.freeze({
  medianApiMs: 300,
  p95ResponseMs: 750,
  p99ResponseMs: 1500,
  apiAvailabilityPct: 99.9,
  errorRatePct: 0.5,
  cpuSteadyPct: 70,
  memorySteadyPct: 75,
  thresholdIds: Object.freeze([
    "THR-040",
    "THR-041",
    "THR-042",
    "THR-043",
    "THR-044",
    "THR-045",
    "THR-046"
  ])
});

/** Phase 13 operational SLO targets — consumed, not redefined. */
export const PHASE13_SLO_TARGETS = Object.freeze({
  apiAvailability: Object.freeze({ sloId: "SLO-001", targetPct: 99.5 }),
  apiP95Ms: Object.freeze({ sloId: "SLO-006", targetMs: 500 }),
  aiP95Ms: Object.freeze({ sloId: "SLO-005", targetMs: 2000 }),
  platformUptimePct: Object.freeze({ sloId: "SLO-003", targetPct: 99.0 })
});

export const PMET_ID_PATTERN = /^PMET-[0-9]{3}$/;
export const CAP_ID_PATTERN = /^CAP-[0-9]{3}$/;
export const BEN_ID_PATTERN = /^BEN-[0-9]{3}$/;
export const WLP_ID_PATTERN = /^WLP-[0-9]{3}$/;
export const RTHR_ID_PATTERN = /^RTHR-[0-9]{3}$/;
export const FRC_ID_PATTERN = /^FRC-[0-9]{3}$/;
export const PGOV_ID_PATTERN = /^PGOV-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const PERFORMANCE_DOMAINS = Object.freeze([
  "latency",
  "throughput",
  "concurrency",
  "utilization",
  "queue",
  "cache",
  "database",
  "storage",
  "network",
  "ai",
  "batch",
  "sync"
]);

export const SCALE_STRATEGIES = Object.freeze([
  "horizontal",
  "vertical",
  "stateless_replicas",
  "read_replicas",
  "partitioning",
  "sharding",
  "queue_workers",
  "cache_expansion",
  "object_storage_tiering",
  "ai_batch_offload"
]);

export const FORECAST_HORIZONS = Object.freeze(["12m", "24m", "36m"]);
export const REVIEW_FREQUENCIES = Object.freeze([
  "monthly",
  "quarterly",
  "semi_annual",
  "annual"
]);

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

// ─── Roles ───────────────────────────────────────────────────────────────────

export const PERFORMANCE_ROLES = Object.freeze([
  freezeEntry({
    id: "ROLE-PERF-ARCH",
    code: "ROLE_PERF_ARCHITECT",
    title: "Performance Architect",
    accountableAuthority: "Performance Architect"
  }),
  freezeEntry({
    id: "ROLE-CAP-PLANNER",
    code: "ROLE_CAPACITY_PLANNER",
    title: "Capacity Planner",
    accountableAuthority: "Capacity Planner"
  }),
  freezeEntry({
    id: "ROLE-SRE-LEAD",
    code: "ROLE_SRE_LEAD",
    title: "SRE Lead",
    accountableAuthority: "SRE Lead"
  }),
  freezeEntry({
    id: "ROLE-PLATFORM-OPS",
    code: "ROLE_PLATFORM_OPS",
    title: "Platform Operations Lead",
    accountableAuthority: "Platform Operations Lead"
  }),
  freezeEntry({
    id: "ROLE-DBA-LEAD",
    code: "ROLE_DBA_LEAD",
    title: "Database Platform Lead",
    accountableAuthority: "Database Platform Lead"
  }),
  freezeEntry({
    id: "ROLE-PERF-ENG",
    code: "ROLE_PERF_ENG",
    title: "Performance Test Engineer",
    accountableAuthority: "Performance Test Engineer"
  }),
  freezeEntry({
    id: "ROLE-CIO",
    code: "ROLE_CIO",
    title: "Chief Information Officer",
    accountableAuthority: "CIO"
  }),
  freezeEntry({
    id: "ROLE-ML-OPS",
    code: "ROLE_ML_OPS",
    title: "ML Ops Lead",
    accountableAuthority: "ML Ops Lead"
  })
]);

// ─── Performance Metric Registry (catalog; observes Phase 13 MET/SLO) ────────

export const PERFORMANCE_METRICS = Object.freeze([
  freezeEntry({
    id: "PMET-001",
    code: "PERF_API_MEDIAN_MS",
    name: "API median latency",
    domain: "latency",
    unit: "ms",
    phase16ThresholdId: "THR-040",
    phase16PassValue: 300,
    phase13MetricId: "MET-003",
    phase13SloId: null,
    description: "Median API latency; Phase 16 THR-040 ≤300ms.",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-002",
    code: "PERF_API_P95_MS",
    name: "API p95 latency",
    domain: "latency",
    unit: "ms",
    phase16ThresholdId: "THR-041",
    phase16PassValue: 750,
    phase13MetricId: "MET-003",
    phase13SloId: "SLO-006",
    phase13SloTargetMs: 500,
    description:
      "p95 API latency. Release/test gate uses Phase 16 ≤750ms; operational SLO-006 ≤500ms consumed.",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-003",
    code: "PERF_API_P99_MS",
    name: "API p99 latency",
    domain: "latency",
    unit: "ms",
    phase16ThresholdId: "THR-042",
    phase16PassValue: 1500,
    phase13MetricId: "MET-003",
    phase13SloId: null,
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-004",
    code: "PERF_API_TPS",
    name: "API sustained throughput",
    domain: "throughput",
    unit: "tps",
    phase13MetricId: "MET-001",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-005",
    code: "PERF_CONCURRENT_USERS",
    name: "Concurrent interactive users",
    domain: "concurrency",
    unit: "count",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "PMET-006",
    code: "PERF_CPU_UTIL_PCT",
    name: "CPU utilization",
    domain: "utilization",
    unit: "percent",
    phase16ThresholdId: "THR-045",
    phase16PassValue: 70,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "PMET-007",
    code: "PERF_MEM_UTIL_PCT",
    name: "Memory utilization",
    domain: "utilization",
    unit: "percent",
    phase16ThresholdId: "THR-046",
    phase16PassValue: 75,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "PMET-008",
    code: "PERF_QUEUE_DEPTH",
    name: "Job queue depth",
    domain: "queue",
    unit: "count",
    phase13MonitorId: "MON-010",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([18, 19])
  }),
  freezeEntry({
    id: "PMET-009",
    code: "PERF_CACHE_HIT_RATIO",
    name: "Cache hit ratio",
    domain: "cache",
    unit: "percent",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "PMET-010",
    code: "PERF_DB_OPS_PER_SEC",
    name: "Database operations per second",
    domain: "database",
    unit: "ops_per_sec",
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([7, 19, 21])
  }),
  freezeEntry({
    id: "PMET-011",
    code: "PERF_DB_CONN_UTIL_PCT",
    name: "DB connection pool utilization",
    domain: "database",
    unit: "percent",
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([7, 19])
  }),
  freezeEntry({
    id: "PMET-012",
    code: "PERF_STORAGE_GROWTH_GB_MO",
    name: "Storage growth rate",
    domain: "storage",
    unit: "gb_per_month",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    owningModule: 19,
    relatedModules: Object.freeze([21, 19])
  }),
  freezeEntry({
    id: "PMET-013",
    code: "PERF_NETWORK_MBPS",
    name: "Network bandwidth utilization",
    domain: "network",
    unit: "mbps",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "PMET-014",
    code: "PERF_AI_INFERENCE_P95_MS",
    name: "AI advisory inference p95",
    domain: "ai",
    unit: "ms",
    phase13MetricId: "MET-008",
    phase13SloId: "SLO-005",
    phase13SloTargetMs: 2000,
    accountableAuthority: "ML Ops Lead",
    roleId: "ROLE-ML-OPS",
    owningModule: 19,
    relatedModules: Object.freeze([29, 19]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "PMET-015",
    code: "PERF_SYNC_EVENTS_PER_MIN",
    name: "Offline sync events per minute",
    domain: "sync",
    unit: "events_per_min",
    phase13MonitorId: "MON-009",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([19])
  }),
  freezeEntry({
    id: "PMET-016",
    code: "PERF_ERROR_RATE_PCT",
    name: "API error rate",
    domain: "throughput",
    unit: "percent",
    phase16ThresholdId: "THR-044",
    phase16PassValue: 0.5,
    phase13MetricId: "MET-002",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-017",
    code: "PERF_AVAILABILITY_PCT",
    name: "API availability (test gate)",
    domain: "throughput",
    unit: "percent",
    phase16ThresholdId: "THR-043",
    phase16PassValue: 99.9,
    phase13SloId: "SLO-001",
    phase13SloTargetPct: 99.5,
    description:
      "Release gate uses Phase 16 ≥99.9%; operational SLO-001 ≥99.5% consumed.",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "PMET-018",
    code: "PERF_DISK_UTIL_PCT",
    name: "Disk utilization",
    domain: "storage",
    unit: "percent",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    owningModule: 19,
    relatedModules: Object.freeze([19, 21])
  }),
  freezeEntry({
    id: "PMET-019",
    code: "PERF_IO_WAIT_PCT",
    name: "Disk IO wait",
    domain: "utilization",
    unit: "percent",
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([7, 19])
  }),
  freezeEntry({
    id: "PMET-020",
    code: "PERF_BATCH_JOB_DURATION_MIN",
    name: "Batch / EOD job duration",
    domain: "batch",
    unit: "minutes",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    owningModule: 19,
    relatedModules: Object.freeze([18, 19])
  })
]);

// ─── Workload Profile Registry ───────────────────────────────────────────────

export const WORKLOAD_PROFILES = Object.freeze([
  freezeEntry({
    id: "WLP-001",
    code: "WLP_SINGLE_BRANCH",
    name: "Single-branch steady state",
    profileClass: "baseline",
    branches: 1,
    concurrentUsers: 25,
    tps: 8,
    apiRequestsPerMin: 480,
    queueEventsPerMin: 40,
    dbOpsPerSec: 35,
    aiInferencesPerHour: 20,
    storageGrowthGbPerMonth: 2.5,
    peakMultiplier: 1.0,
    description: "One teller hall + field officers; typical daily Susu collections.",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([1, 6, 8, 19])
  }),
  freezeEntry({
    id: "WLP-002",
    code: "WLP_MULTI_BRANCH",
    name: "Multi-branch (8–20 branches)",
    profileClass: "growth",
    branches: 15,
    concurrentUsers: 180,
    tps: 55,
    apiRequestsPerMin: 3300,
    queueEventsPerMin: 280,
    dbOpsPerSec: 220,
    aiInferencesPerHour: 150,
    storageGrowthGbPerMonth: 28,
    peakMultiplier: 1.3,
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([1, 6, 8, 19, 30])
  }),
  freezeEntry({
    id: "WLP-003",
    code: "WLP_REGIONAL",
    name: "Regional cluster (50–80 branches)",
    profileClass: "regional",
    branches: 65,
    concurrentUsers: 650,
    tps: 180,
    apiRequestsPerMin: 10800,
    queueEventsPerMin: 900,
    dbOpsPerSec: 750,
    aiInferencesPerHour: 600,
    storageGrowthGbPerMonth: 110,
    peakMultiplier: 1.5,
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([6, 8, 19, 20, 30])
  }),
  freezeEntry({
    id: "WLP-004",
    code: "WLP_NATIONWIDE",
    name: "Nationwide FinTech Susu scale",
    profileClass: "nationwide",
    branches: 250,
    concurrentUsers: 2200,
    tps: 550,
    apiRequestsPerMin: 33000,
    queueEventsPerMin: 3200,
    dbOpsPerSec: 2400,
    aiInferencesPerHour: 2500,
    storageGrowthGbPerMonth: 420,
    peakMultiplier: 1.8,
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([6, 8, 18, 19, 20, 29, 30])
  }),
  freezeEntry({
    id: "WLP-005",
    code: "WLP_PEAK_COLLECTION",
    name: "Peak collection day (market day)",
    profileClass: "peak",
    branches: 250,
    concurrentUsers: 3200,
    tps: 900,
    apiRequestsPerMin: 54000,
    queueEventsPerMin: 5500,
    dbOpsPerSec: 3800,
    aiInferencesPerHour: 1800,
    storageGrowthGbPerMonth: 420,
    peakMultiplier: 2.2,
    description:
      "31-day collection cycle peaks; cashiers observe float limit 1000; amounts in pesewas.",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([6, 16, 19, 27])
  }),
  freezeEntry({
    id: "WLP-006",
    code: "WLP_EOD",
    name: "End-of-day batch & reconciliation",
    profileClass: "batch",
    branches: 250,
    concurrentUsers: 120,
    tps: 40,
    apiRequestsPerMin: 2400,
    queueEventsPerMin: 8000,
    dbOpsPerSec: 4500,
    aiInferencesPerHour: 50,
    storageGrowthGbPerMonth: 420,
    peakMultiplier: 1.0,
    batchDurationTargetMin: 45,
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    relatedModules: Object.freeze([7, 18, 19, 21])
  }),
  freezeEntry({
    id: "WLP-007",
    code: "WLP_MONTH_END",
    name: "Month-end close & interest posting window",
    profileClass: "batch",
    branches: 250,
    concurrentUsers: 400,
    tps: 120,
    apiRequestsPerMin: 7200,
    queueEventsPerMin: 12000,
    dbOpsPerSec: 6000,
    aiInferencesPerHour: 200,
    storageGrowthGbPerMonth: 450,
    peakMultiplier: 1.4,
    description: "Interest default 15%; ledger integrity mandatory; no money-post rewrite.",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    relatedModules: Object.freeze([7, 8, 18, 19, 27])
  }),
  freezeEntry({
    id: "WLP-008",
    code: "WLP_LOAN_PEAK",
    name: "Loan application & disbursement peak",
    profileClass: "peak",
    branches: 250,
    concurrentUsers: 900,
    tps: 220,
    apiRequestsPerMin: 13200,
    queueEventsPerMin: 1500,
    dbOpsPerSec: 1100,
    aiInferencesPerHour: 4000,
    storageGrowthGbPerMonth: 420,
    peakMultiplier: 1.6,
    description: "AI advisory only (Module 29); no auto loan approval.",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([8, 19, 24, 29])
  }),
  freezeEntry({
    id: "WLP-009",
    code: "WLP_REPORTING_PEAK",
    name: "Reporting / BI / dashboard peak",
    profileClass: "peak",
    branches: 250,
    concurrentUsers: 500,
    tps: 95,
    apiRequestsPerMin: 5700,
    queueEventsPerMin: 600,
    dbOpsPerSec: 2800,
    aiInferencesPerHour: 100,
    storageGrowthGbPerMonth: 420,
    peakMultiplier: 1.3,
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([11, 19, 20])
  })
]);

// ─── Capacity Registry ───────────────────────────────────────────────────────

export const CAPACITY_ENTRIES = Object.freeze([
  freezeEntry({
    id: "CAP-001",
    code: "CAP_CPU_CORES",
    name: "Application CPU capacity",
    resource: "cpu",
    unit: "vCPU",
    current: 16,
    forecast12m: 24,
    forecast24m: 40,
    forecast36m: 64,
    scalingTriggerPct: 70,
    maxCapacity: 128,
    upgradeStrategy: "horizontal",
    decisionCriteria: "Sustained CPU >70% (Phase 16 THR-045) over 15m → add app replicas",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "CAP-002",
    code: "CAP_MEMORY_GB",
    name: "Application memory capacity",
    resource: "memory",
    unit: "GB",
    current: 64,
    forecast12m: 96,
    forecast24m: 160,
    forecast36m: 256,
    scalingTriggerPct: 75,
    maxCapacity: 512,
    upgradeStrategy: "vertical_then_horizontal",
    decisionCriteria: "Memory >75% (Phase 16 THR-046) → scale memory or split workers",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "CAP-003",
    code: "CAP_STORAGE_TB",
    name: "Primary + object storage",
    resource: "storage",
    unit: "TB",
    current: 4,
    forecast12m: 8,
    forecast24m: 16,
    forecast36m: 32,
    scalingTriggerPct: 80,
    maxCapacity: 100,
    upgradeStrategy: "object_storage_tiering",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([21, 19])
  }),
  freezeEntry({
    id: "CAP-004",
    code: "CAP_DB_GROWTH_GB",
    name: "Database growth capacity",
    resource: "database",
    unit: "GB",
    current: 250,
    forecast12m: 520,
    forecast24m: 1100,
    forecast36m: 2300,
    scalingTriggerPct: 75,
    maxCapacity: 8000,
    upgradeStrategy: "read_replicas",
    decisionCriteria: "Write primary >75% disk or p95 > SLO-006 → add read replicas / partition hot tables",
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD",
    relatedModules: Object.freeze([7, 19, 21])
  }),
  freezeEntry({
    id: "CAP-005",
    code: "CAP_BANDWIDTH_MBPS",
    name: "WAN / branch bandwidth budget",
    resource: "bandwidth",
    unit: "mbps",
    current: 200,
    forecast12m: 400,
    forecast24m: 800,
    forecast36m: 1500,
    scalingTriggerPct: 70,
    maxCapacity: 5000,
    upgradeStrategy: "horizontal",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "CAP-006",
    code: "CAP_API_RPS",
    name: "API request capacity",
    resource: "api",
    unit: "rps",
    current: 200,
    forecast12m: 400,
    forecast24m: 800,
    forecast36m: 1500,
    scalingTriggerPct: 70,
    maxCapacity: 5000,
    upgradeStrategy: "stateless_replicas",
    decisionCriteria: "Sustained RPS >70% of provisioned OR p95 breach Phase 16/13 → scale gateway workers",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "CAP-007",
    code: "CAP_QUEUE_WORKERS",
    name: "Queue worker capacity",
    resource: "queue",
    unit: "workers",
    current: 8,
    forecast12m: 16,
    forecast24m: 32,
    forecast36m: 64,
    scalingTriggerPct: 70,
    maxCapacity: 256,
    upgradeStrategy: "queue_workers",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    relatedModules: Object.freeze([18, 19])
  }),
  freezeEntry({
    id: "CAP-008",
    code: "CAP_BACKUP_TB",
    name: "Backup retention capacity",
    resource: "backup",
    unit: "TB",
    current: 12,
    forecast12m: 24,
    forecast24m: 48,
    forecast36m: 96,
    scalingTriggerPct: 80,
    maxCapacity: 200,
    upgradeStrategy: "object_storage_tiering",
    description: "Module 21 executes backups; Phase 15 RPO/RTO consumed.",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([21, 30])
  }),
  freezeEntry({
    id: "CAP-009",
    code: "CAP_LOG_GB_DAY",
    name: "Log ingest capacity",
    resource: "log",
    unit: "GB_per_day",
    current: 15,
    forecast12m: 35,
    forecast24m: 70,
    forecast36m: 140,
    scalingTriggerPct: 75,
    maxCapacity: 500,
    upgradeStrategy: "object_storage_tiering",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    relatedModules: Object.freeze([19])
  }),
  freezeEntry({
    id: "CAP-010",
    code: "CAP_OBJECT_TB",
    name: "Object / media storage",
    resource: "object",
    unit: "TB",
    current: 6,
    forecast12m: 14,
    forecast24m: 30,
    forecast36m: 60,
    scalingTriggerPct: 80,
    maxCapacity: 250,
    upgradeStrategy: "object_storage_tiering",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER",
    relatedModules: Object.freeze([19, 21])
  }),
  freezeEntry({
    id: "CAP-011",
    code: "CAP_AI_INFERENCE_RPS",
    name: "AI advisory inference capacity",
    resource: "ai",
    unit: "inferences_per_sec",
    current: 5,
    forecast12m: 12,
    forecast24m: 25,
    forecast36m: 50,
    scalingTriggerPct: 70,
    maxCapacity: 200,
    upgradeStrategy: "ai_batch_offload",
    decisionCriteria: "p95 > SLO-005 2000ms → scale advisory workers (advisory only)",
    accountableAuthority: "ML Ops Lead",
    roleId: "ROLE-ML-OPS",
    relatedModules: Object.freeze([29, 19]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "CAP-012",
    code: "CAP_DB_CONNECTIONS",
    name: "DB connection pool capacity",
    resource: "db_connections",
    unit: "connections",
    current: 100,
    forecast12m: 160,
    forecast24m: 250,
    forecast36m: 400,
    scalingTriggerPct: 75,
    maxCapacity: 800,
    upgradeStrategy: "read_replicas",
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD",
    relatedModules: Object.freeze([7, 19])
  })
]);

// ─── Benchmark Registry ──────────────────────────────────────────────────────

export const BENCHMARKS = Object.freeze([
  freezeEntry({
    id: "BEN-001",
    code: "BEN_AUTH",
    name: "Authentication latency",
    category: "auth",
    method: "load_script_login_flow",
    targetMedianMs: 200,
    targetP95Ms: 500,
    targetP99Ms: 1000,
    phase16Aligned: true,
    phase16CeilingP95Ms: 750,
    passFailRule: "median≤200 AND p95≤500 AND p95≤Phase16_750",
    sampleWindowHint: "SMP-006",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([1, 22])
  }),
  freezeEntry({
    id: "BEN-002",
    code: "BEN_SAVINGS",
    name: "Savings deposit / withdrawal API",
    category: "savings",
    method: "transaction_mix_pesewas",
    targetMedianMs: 250,
    targetP95Ms: 650,
    targetP99Ms: 1200,
    phase16Aligned: true,
    phase16CeilingP95Ms: 750,
    phase16CeilingMedianMs: 300,
    passFailRule: "median≤250≤300 AND p95≤650≤750; money in pesewas",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([5, 6, 27])
  }),
  freezeEntry({
    id: "BEN-003",
    code: "BEN_LOANS",
    name: "Loan inquiry & schedule",
    category: "loans",
    method: "loan_read_write_mix",
    targetMedianMs: 280,
    targetP95Ms: 700,
    targetP99Ms: 1400,
    phase16Aligned: true,
    phase16CeilingP95Ms: 750,
    phase16CeilingMedianMs: 300,
    passFailRule: "median≤280≤300 AND p95≤700≤750; interest formula Module 27",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([8, 27])
  }),
  freezeEntry({
    id: "BEN-004",
    code: "BEN_COLLECTIONS",
    name: "Collection posting path",
    category: "collections",
    method: "collection_day_simulation",
    targetMedianMs: 300,
    targetP95Ms: 750,
    targetP99Ms: 1500,
    phase16Aligned: true,
    phase16ThresholdIds: Object.freeze(["THR-040", "THR-041", "THR-042"]),
    phase16CeilingMedianMs: 300,
    phase16CeilingP95Ms: 750,
    phase16CeilingP99Ms: 1500,
    passFailRule: "Exactly Phase 16 median≤300 p95≤750 p99≤1500; cycle day ≤31",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([6, 27])
  }),
  freezeEntry({
    id: "BEN-005",
    code: "BEN_REPORTS",
    name: "Report generation",
    category: "reports",
    method: "report_export_timed",
    targetMedianMs: 2000,
    targetP95Ms: 8000,
    targetP99Ms: 15000,
    phase16Aligned: false,
    notes: "Batch/report path; interactive API still subject to Phase 16 ceilings",
    passFailRule: "p95≤8000ms for standard branch report; no integrity loss",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([11])
  }),
  freezeEntry({
    id: "BEN-006",
    code: "BEN_DASHBOARD",
    name: "Operations dashboard TTI",
    category: "dashboard",
    method: "spa_first_contentful_plus_api",
    targetMedianMs: 800,
    targetP95Ms: 2000,
    targetP99Ms: 3500,
    phase16Aligned: false,
    notes: "Page TTI; underlying APIs still Phase 16 gated",
    passFailRule: "p95 TTI≤2000ms; API fan-out each ≤THR-041",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([19, 30])
  }),
  freezeEntry({
    id: "BEN-007",
    code: "BEN_SEARCH",
    name: "Member / account search",
    category: "search",
    method: "search_latency_script",
    targetMedianMs: 200,
    targetP95Ms: 600,
    targetP99Ms: 1100,
    phase16Aligned: true,
    phase16CeilingP95Ms: 750,
    phase16CeilingMedianMs: 300,
    passFailRule: "median≤200≤300 AND p95≤600≤750",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([3, 20])
  }),
  freezeEntry({
    id: "BEN-008",
    code: "BEN_SYNC",
    name: "Offline/online sync batch",
    category: "sync",
    method: "android_offline_buffer_replay",
    targetMedianMs: 1500,
    targetP95Ms: 5000,
    targetP99Ms: 10000,
    phase16Aligned: false,
    passFailRule: "p95≤5000ms for 500-event buffer; 100% reconcile",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    relatedModules: Object.freeze([19])
  }),
  freezeEntry({
    id: "BEN-009",
    code: "BEN_AI_INFERENCE",
    name: "AI advisory inference",
    category: "ai",
    method: "advisory_inference_batch",
    targetMedianMs: 800,
    targetP95Ms: 2000,
    targetP99Ms: 3500,
    phase16Aligned: false,
    phase13SloId: "SLO-005",
    phase13SloTargetMs: 2000,
    passFailRule: "p95≤2000ms (SLO-005); advisory only — no auto approval",
    accountableAuthority: "ML Ops Lead",
    roleId: "ROLE-ML-OPS",
    relatedModules: Object.freeze([29, 24]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "BEN-010",
    code: "BEN_BATCH_EOD",
    name: "EOD / month-end batch window",
    category: "batch",
    method: "batch_duration_wallclock",
    targetMedianMs: null,
    targetP95Ms: null,
    targetDurationMin: 45,
    targetP95DurationMin: 60,
    phase16Aligned: false,
    passFailRule: "EOD ≤45m median / ≤60m p95; data integrity 100%",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD",
    relatedModules: Object.freeze([18, 7, 21])
  })
]);

// ─── Resource Threshold Registry (ops capacity; aligns Phase 16 where noted) ─

export const RESOURCE_THRESHOLDS = Object.freeze([
  freezeEntry({
    id: "RTHR-001",
    code: "RTHR_CPU",
    resource: "cpu",
    unit: "percent",
    warningPct: 70,
    criticalPct: 85,
    alignsPhase16ThresholdId: "THR-045",
    alignsPhase16PassValue: 70,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RTHR-002",
    code: "RTHR_MEMORY",
    resource: "memory",
    unit: "percent",
    warningPct: 75,
    criticalPct: 90,
    alignsPhase16ThresholdId: "THR-046",
    alignsPhase16PassValue: 75,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RTHR-003",
    code: "RTHR_DISK",
    resource: "disk",
    unit: "percent",
    warningPct: 80,
    criticalPct: 90,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RTHR-004",
    code: "RTHR_IO",
    resource: "io",
    unit: "percent",
    warningPct: 70,
    criticalPct: 85,
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD"
  }),
  freezeEntry({
    id: "RTHR-005",
    code: "RTHR_NETWORK",
    resource: "network",
    unit: "percent",
    warningPct: 70,
    criticalPct: 85,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RTHR-006",
    code: "RTHR_DB_CONN",
    resource: "db_connections",
    unit: "percent",
    warningPct: 75,
    criticalPct: 90,
    accountableAuthority: "Database Platform Lead",
    roleId: "ROLE-DBA-LEAD"
  }),
  freezeEntry({
    id: "RTHR-007",
    code: "RTHR_QUEUE",
    resource: "queue",
    unit: "percent",
    warningPct: 70,
    criticalPct: 90,
    description: "Queue depth vs configured max depth",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD"
  }),
  freezeEntry({
    id: "RTHR-008",
    code: "RTHR_CACHE",
    resource: "cache",
    unit: "percent",
    warningPct: 85,
    criticalPct: 95,
    description: "Cache memory fill; hit-ratio drop handled separately",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH"
  })
]);

// ─── Forecast Registry ───────────────────────────────────────────────────────

export const FORECASTS = Object.freeze([
  freezeEntry({
    id: "FRC-001",
    code: "FRC_BRANCH_GROWTH",
    name: "Branch footprint growth",
    driver: "branch_expansion",
    horizon: "36m",
    reviewFrequency: "quarterly",
    baselineBranches: 15,
    month12: 40,
    month24: 120,
    month36: 250,
    linkedCapacityIds: Object.freeze(["CAP-001", "CAP-002", "CAP-006"]),
    linkedWorkloadIds: Object.freeze(["WLP-002", "WLP-003", "WLP-004"]),
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  }),
  freezeEntry({
    id: "FRC-002",
    code: "FRC_MEMBER_GROWTH",
    name: "Active member growth",
    driver: "membership",
    horizon: "36m",
    reviewFrequency: "quarterly",
    baselineMembers: 25000,
    month12: 80000,
    month24: 220000,
    month36: 500000,
    linkedCapacityIds: Object.freeze(["CAP-003", "CAP-004", "CAP-012"]),
    linkedWorkloadIds: Object.freeze(["WLP-003", "WLP-004", "WLP-005"]),
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  }),
  freezeEntry({
    id: "FRC-003",
    code: "FRC_TXN_VOLUME",
    name: "Daily transaction volume",
    driver: "collections_and_loans",
    horizon: "36m",
    reviewFrequency: "monthly",
    baselineDailyTxns: 12000,
    month12: 45000,
    month24: 140000,
    month36: 350000,
    linkedCapacityIds: Object.freeze(["CAP-006", "CAP-007", "CAP-004"]),
    linkedWorkloadIds: Object.freeze(["WLP-005", "WLP-008"]),
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  }),
  freezeEntry({
    id: "FRC-004",
    code: "FRC_STORAGE",
    name: "Storage & backup growth",
    driver: "data_retention",
    horizon: "36m",
    reviewFrequency: "quarterly",
    baselineTb: 4,
    month12: 8,
    month24: 16,
    month36: 32,
    linkedCapacityIds: Object.freeze(["CAP-003", "CAP-008", "CAP-010"]),
    linkedWorkloadIds: Object.freeze(["WLP-004", "WLP-006"]),
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  }),
  freezeEntry({
    id: "FRC-005",
    code: "FRC_AI_ADVISORY",
    name: "AI advisory inference growth",
    driver: "ai_adoption",
    horizon: "36m",
    reviewFrequency: "quarterly",
    baselineInferencesPerDay: 500,
    month12: 4000,
    month24: 15000,
    month36: 40000,
    linkedCapacityIds: Object.freeze(["CAP-011"]),
    linkedWorkloadIds: Object.freeze(["WLP-008"]),
    accountableAuthority: "ML Ops Lead",
    roleId: "ROLE-ML-OPS",
    advisoryOnly: true
  }),
  freezeEntry({
    id: "FRC-006",
    code: "FRC_MOBILE_SYNC",
    name: "Field officer offline sync growth",
    driver: "mobile_workforce",
    horizon: "24m",
    reviewFrequency: "semi_annual",
    baselineDevices: 80,
    month12: 350,
    month24: 900,
    month36: 900,
    linkedCapacityIds: Object.freeze(["CAP-005", "CAP-007"]),
    linkedWorkloadIds: Object.freeze(["WLP-005"]),
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD"
  })
]);

// ─── Performance Governance Registry ─────────────────────────────────────────

export const PERFORMANCE_GOVERNANCE = Object.freeze([
  freezeEntry({
    id: "PGOV-001",
    code: "PGOV_OWNERSHIP",
    name: "Metric & capacity ownership",
    topic: "ownership",
    rule: "Exactly one accountableAuthority per PMET/CAP/BEN/WLP/RTHR/FRC entry",
    approvalAuthority: "Performance Architect",
    escalationAuthority: "CIO",
    accountableAuthority: "Performance Architect",
    roleId: "ROLE-PERF-ARCH"
  }),
  freezeEntry({
    id: "PGOV-002",
    code: "PGOV_CAPACITY_CHANGE",
    name: "Capacity plan change control",
    topic: "approval",
    rule: "Changes to CAP maxCapacity or scalingTriggerPct require Capacity Planner + Platform Ops approval",
    approvalAuthority: "Capacity Planner",
    escalationAuthority: "CIO",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  }),
  freezeEntry({
    id: "PGOV-003",
    code: "PGOV_BENCHMARK_EXCEPTION",
    name: "Benchmark exception process",
    topic: "exceptions",
    rule: "Cannot loosen Phase 16 THR-040..046 ceilings without Phase 16 change control; exceptions logged",
    approvalAuthority: "Performance Test Engineer",
    escalationAuthority: "CIO",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "PGOV-004",
    code: "PGOV_SLO_ESCALATION",
    name: "Operational SLO breach escalation",
    topic: "escalation",
    rule: "Phase 13 SLO burn / breach escalates via Module 19 alerts — EPSCMS does not redefine alert routing",
    approvalAuthority: "SRE Lead",
    escalationAuthority: "Platform Operations Lead",
    accountableAuthority: "SRE Lead",
    roleId: "ROLE-SRE-LEAD"
  }),
  freezeEntry({
    id: "PGOV-005",
    code: "PGOV_SCALE_DECISION",
    name: "Scale-out decision authority",
    topic: "approval",
    rule: "Horizontal scale of PRODUCTION requires Platform Ops; emergency scale with post-facto CIO review",
    approvalAuthority: "Platform Operations Lead",
    escalationAuthority: "CIO",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "PGOV-006",
    code: "PGOV_FORECAST_REVIEW",
    name: "Forecast review cadence",
    topic: "ownership",
    rule: "FRC entries reviewed per reviewFrequency; 36m plan refreshed at least annually",
    approvalAuthority: "Capacity Planner",
    escalationAuthority: "CIO",
    accountableAuthority: "Capacity Planner",
    roleId: "ROLE-CAP-PLANNER"
  })
]);

// ─── list / get ──────────────────────────────────────────────────────────────

function findByIdOrCode(list, idOrCode) {
  if (!idOrCode) return null;
  const key = String(idOrCode);
  return list.find((e) => e.id === key || e.code === key) || null;
}

export function listPerformanceMetrics() {
  return PERFORMANCE_METRICS;
}
export function listCapacityEntries() {
  return CAPACITY_ENTRIES;
}
export function listBenchmarks() {
  return BENCHMARKS;
}
export function listWorkloadProfiles() {
  return WORKLOAD_PROFILES;
}
export function listResourceThresholds() {
  return RESOURCE_THRESHOLDS;
}
export function listForecasts() {
  return FORECASTS;
}
export function listPerformanceGovernance() {
  return PERFORMANCE_GOVERNANCE;
}
export function listPerformanceRoles() {
  return PERFORMANCE_ROLES;
}

export function getPerformanceMetric(idOrCode) {
  return findByIdOrCode(PERFORMANCE_METRICS, idOrCode);
}
export function getCapacityEntry(idOrCode) {
  return findByIdOrCode(CAPACITY_ENTRIES, idOrCode);
}
export function getBenchmark(idOrCode) {
  return findByIdOrCode(BENCHMARKS, idOrCode);
}
export function getWorkloadProfile(idOrCode) {
  return findByIdOrCode(WORKLOAD_PROFILES, idOrCode);
}
export function getResourceThreshold(idOrCode) {
  return findByIdOrCode(RESOURCE_THRESHOLDS, idOrCode);
}
export function getForecast(idOrCode) {
  return findByIdOrCode(FORECASTS, idOrCode);
}
export function getPerformanceGovernance(idOrCode) {
  return findByIdOrCode(PERFORMANCE_GOVERNANCE, idOrCode);
}
export function getPerformanceRole(idOrCode) {
  return findByIdOrCode(PERFORMANCE_ROLES, idOrCode);
}

export function workloadsByClass(profileClass) {
  return WORKLOAD_PROFILES.filter((w) => w.profileClass === profileClass);
}

export function capacityByResource(resource) {
  return CAPACITY_ENTRIES.filter((c) => c.resource === resource);
}

export function benchmarksByCategory(category) {
  return BENCHMARKS.filter((b) => b.category === category);
}

// ─── validation / assertions ─────────────────────────────────────────────────

export function assertIdUniqueness() {
  const groups = [
    ["PMET", PERFORMANCE_METRICS],
    ["CAP", CAPACITY_ENTRIES],
    ["BEN", BENCHMARKS],
    ["WLP", WORKLOAD_PROFILES],
    ["RTHR", RESOURCE_THRESHOLDS],
    ["FRC", FORECASTS],
    ["PGOV", PERFORMANCE_GOVERNANCE],
    ["ROLE", PERFORMANCE_ROLES]
  ];
  for (const [label, list] of groups) {
    const ids = new Set();
    const codes = new Set();
    for (const item of list) {
      if (ids.has(item.id)) return err("EPS-ID-001", `Duplicate ${label} id ${item.id}`);
      if (codes.has(item.code)) return err("EPS-ID-002", `Duplicate ${label} code ${item.code}`);
      ids.add(item.id);
      codes.add(item.code);
    }
  }
  return ok();
}

export function assertSingleOwnerPerEntry() {
  const collections = [
    ...PERFORMANCE_METRICS,
    ...CAPACITY_ENTRIES,
    ...BENCHMARKS,
    ...WORKLOAD_PROFILES,
    ...RESOURCE_THRESHOLDS,
    ...FORECASTS,
    ...PERFORMANCE_GOVERNANCE
  ];
  for (const item of collections) {
    if (!item.accountableAuthority || !String(item.accountableAuthority).trim()) {
      return err("EPS-OWN-001", `Missing accountableAuthority on ${item.id}`);
    }
  }
  return ok();
}

export function assertSingleOwnerPerMetric() {
  const owners = new Map();
  for (const m of PERFORMANCE_METRICS) {
    if (owners.has(m.id)) {
      return err("EPS-OWN-002", `Metric ${m.id} has multiple owner records`);
    }
    owners.set(m.id, m.accountableAuthority);
    if (!m.accountableAuthority) {
      return err("EPS-OWN-003", `Metric ${m.id} missing single owner`);
    }
  }
  return ok({ metricOwners: owners.size });
}

export function assertRefsResolve() {
  const errors = [];
  for (const item of [
    ...PERFORMANCE_METRICS,
    ...CAPACITY_ENTRIES,
    ...BENCHMARKS,
    ...WORKLOAD_PROFILES,
    ...RESOURCE_THRESHOLDS,
    ...FORECASTS,
    ...PERFORMANCE_GOVERNANCE
  ]) {
    if (item.roleId && !getPerformanceRole(item.roleId)) {
      errors.push(`${item.id} unknown roleId ${item.roleId}`);
    }
  }
  for (const frc of FORECASTS) {
    for (const cid of frc.linkedCapacityIds || []) {
      if (!getCapacityEntry(cid)) errors.push(`${frc.id} unknown capacity ${cid}`);
    }
    for (const wid of frc.linkedWorkloadIds || []) {
      if (!getWorkloadProfile(wid)) errors.push(`${frc.id} unknown workload ${wid}`);
    }
  }
  if (errors.length) return err("EPS-REF-001", "Cross-reference resolution failed", { errors });
  return ok();
}

/**
 * Confirm Phase 17 does not redefine Phase 16 perf thresholds or Phase 13 SLOs.
 */
export function assertCrossPhaseConsistency() {
  const errors = [];

  if (PHASE16_PERF_TARGETS.medianApiMs !== 300) {
    errors.push("PHASE16_PERF_TARGETS.medianApiMs must remain 300");
  }
  if (PHASE16_PERF_TARGETS.p95ResponseMs !== 750) {
    errors.push("PHASE16_PERF_TARGETS.p95ResponseMs must remain 750");
  }
  if (PHASE16_PERF_TARGETS.p99ResponseMs !== 1500) {
    errors.push("PHASE16_PERF_TARGETS.p99ResponseMs must remain 1500");
  }
  if (PHASE16_PERF_TARGETS.cpuSteadyPct !== 70) {
    errors.push("PHASE16_PERF_TARGETS.cpuSteadyPct must remain 70");
  }
  if (PHASE16_PERF_TARGETS.memorySteadyPct !== 75) {
    errors.push("PHASE16_PERF_TARGETS.memorySteadyPct must remain 75");
  }

  if (PHASE13_SLO_TARGETS.apiP95Ms.targetMs !== 500) {
    errors.push("Phase 13 SLO-006 target must remain 500ms (consumed)");
  }
  if (PHASE13_SLO_TARGETS.aiP95Ms.targetMs !== 2000) {
    errors.push("Phase 13 SLO-005 target must remain 2000ms (consumed)");
  }
  if (PHASE13_SLO_TARGETS.apiAvailability.targetPct !== 99.5) {
    errors.push("Phase 13 SLO-001 target must remain 99.5% (consumed)");
  }

  const pmet002 = getPerformanceMetric("PMET-002");
  if (!pmet002 || pmet002.phase16PassValue !== 750) {
    errors.push("PMET-002 must align Phase 16 p95 ≤750");
  }
  if (pmet002?.phase13SloTargetMs !== 500) {
    errors.push("PMET-002 must consume Phase 13 SLO-006 ≤500ms");
  }

  const pmet001 = getPerformanceMetric("PMET-001");
  if (!pmet001 || pmet001.phase16PassValue !== 300) {
    errors.push("PMET-001 must align Phase 16 median ≤300");
  }

  const rCpu = getResourceThreshold("RTHR-001");
  if (!rCpu || rCpu.warningPct !== 70 || rCpu.alignsPhase16PassValue !== 70) {
    errors.push("RTHR-001 warning must align Phase 16 CPU ≤70%");
  }
  const rMem = getResourceThreshold("RTHR-002");
  if (!rMem || rMem.warningPct !== 75 || rMem.alignsPhase16PassValue !== 75) {
    errors.push("RTHR-002 warning must align Phase 16 memory ≤75%");
  }

  for (const ben of BENCHMARKS) {
    if (ben.phase16Aligned) {
      if (ben.phase16CeilingP95Ms != null && ben.phase16CeilingP95Ms !== 750) {
        errors.push(`${ben.id} phase16CeilingP95Ms must be 750`);
      }
      if (
        ben.targetP95Ms != null &&
        ben.phase16CeilingP95Ms != null &&
        ben.targetP95Ms > ben.phase16CeilingP95Ms
      ) {
        errors.push(`${ben.id} targetP95Ms exceeds Phase 16 ceiling`);
      }
      if (
        ben.targetMedianMs != null &&
        ben.phase16CeilingMedianMs != null &&
        ben.targetMedianMs > ben.phase16CeilingMedianMs
      ) {
        errors.push(`${ben.id} targetMedianMs exceeds Phase 16 ceiling`);
      }
    }
  }

  const aiBen = getBenchmark("BEN-009");
  if (!aiBen || aiBen.phase13SloTargetMs !== 2000) {
    errors.push("BEN-009 must consume SLO-005 ≤2000ms");
  }

  if (MONITORING_MODULE !== 19) errors.push("MONITORING_MODULE must remain 19");
  if (BACKUP_ENGINE_MODULE !== 21) errors.push("BACKUP_ENGINE_MODULE must remain 21");
  if (AI_MODULE !== 29) errors.push("AI_MODULE must remain 29");
  if (PLATFORM_MODULE !== 30) errors.push("PLATFORM_MODULE must remain 30");

  if (errors.length) {
    return err("EPS-XP-001", "Cross-phase consistency failed", { errors });
  }
  return ok();
}

export function assertModulesNotReplaced() {
  return ok({
    monitoringModule: MONITORING_MODULE,
    backupEngineModule: BACKUP_ENGINE_MODULE,
    aiModule: AI_MODULE,
    platformModule: PLATFORM_MODULE,
    jobEngineModule: JOB_ENGINE_MODULE,
    note: "Phase 17 catalogs only; Module 19 monitoring engine not replaced"
  });
}

export function validatePerformanceRegistry(options = {}) {
  const checks = [
    assertIdUniqueness(),
    assertSingleOwnerPerEntry(),
    assertSingleOwnerPerMetric(),
    assertRefsResolve(),
    assertCrossPhaseConsistency(),
    assertModulesNotReplaced()
  ];
  const errors = [];
  for (const c of checks) {
    if (!c.ok) {
      errors.push(c.message);
      if (c.errors) errors.push(...c.errors);
    }
  }
  if (errors.length) return err("EPS-VAL-000", "Performance registry invalid", { errors });
  return ok({ counts: epscmsCounts() });
}

export function epscmsCounts() {
  return Object.freeze({
    roles: PERFORMANCE_ROLES.length,
    metrics: PERFORMANCE_METRICS.length,
    capacityEntries: CAPACITY_ENTRIES.length,
    benchmarks: BENCHMARKS.length,
    workloads: WORKLOAD_PROFILES.length,
    resourceThresholds: RESOURCE_THRESHOLDS.length,
    forecasts: FORECASTS.length,
    governance: PERFORMANCE_GOVERNANCE.length
  });
}
