/**
 * Module 24 performance SLOs and platform workload measurement conditions.
 * Machine-readable targets. W1 results are never production acceptance evidence.
 */

export const RULE_SLO_VERSION = "1.0.0";
export const WORKLOAD_PROFILE_VERSION = "1.0.0";

export const WORKLOAD_PROFILES = {
  W1: {
    id: "W1",
    name: "Development",
    acceptance: false,
    nodes: 1,
    datasetRecords: 10000,
    concurrentUsers: 20,
    cache: "cold_or_warm",
    observationMinutes: 1
  },
  W2: {
    id: "W2",
    name: "Functional Test",
    acceptance: false,
    nodes: 1,
    datasetRecords: 100000,
    concurrentUsers: 100,
    cache: "warm",
    observationMinutes: 15
  },
  W3: {
    id: "W3",
    name: "Production Nominal",
    acceptance: true,
    nodes: "production-equivalent",
    datasetRecords: 1000000,
    concurrentUsers: 1000,
    cache: "warm",
    concurrencyTier: "C4",
    observationMinutes: 15,
    backgroundJobs: true,
    monitoring: true,
    audit: true,
    notifications: true
  },
  W4: {
    id: "W4",
    name: "Peak Production",
    acceptance: "graceful-degradation",
    cache: "warm",
    concurrencyTier: "C5",
    transactionRateMultiplier: 2,
    concurrentUsers: 2500,
    observationMinutes: 60
  },
  W5: {
    id: "W5",
    name: "Stress",
    acceptance: false,
    informational: true
  }
};

export const CONCURRENCY_TIERS = {
  C1: { min: 1, max: 25 },
  C2: { min: 26, max: 100 },
  C3: { min: 101, max: 500 },
  C4: { min: 501, max: 1000 },
  C5: { min: 1001, max: 2500 },
  C6: { min: 2501, max: Number.POSITIVE_INFINITY }
};

export const DATASET_ASSUMPTIONS = {
  customers: 1000000,
  savingsTransactions: 20000000,
  loanRecords: 2000000,
  accountingEntries: 50000000,
  workflowInstances: 5000000,
  auditRecords: 100000000,
  ruleExecutionHistory: 25000000
};

export const DEFAULT_REQUEST_MIX = {
  ruleEvaluations: 55,
  workflowInteractions: 20,
  readOnlyQueries: 15,
  administrative: 5,
  rulePublication: 3,
  simulations: 2
};

export const RULE_SLOS = [
  { metric: "availability.monthly", target: 0.9995, unit: "ratio", profile: "W3" },
  { metric: "latency.ruleEvaluation.p95", targetMs: 50, p99Ms: 100, profile: "W3", cache: "warm", concurrency: "C4" },
  { metric: "latency.decisionTable.p95", targetMs: 75, p99Ms: 150, profile: "W3", cache: "warm", concurrency: "C4" },
  { metric: "latency.decisionTree.p95", targetMs: 100, p99Ms: 200, profile: "W3", cache: "warm", concurrency: "C4" },
  { metric: "latency.expression.p95", targetMs: 30, p99Ms: 75, profile: "W3", cache: "warm", concurrency: "C4" },
  { metric: "latency.metadataQuery.p95", targetMs: 100, p99Ms: 250, profile: "W3", cache: "warm", concurrency: "C3" },
  { metric: "latency.publication.p95", targetMs: 2000, p99Ms: 5000, profile: "W3", cache: "mixed", concurrency: "C1" },
  { metric: "latency.simulation.p95", targetMs: 500, p99Ms: 2000, profile: "W3", cache: "warm", concurrency: "C2" },
  { metric: "throughput.evaluationsPerSecond", target: 2000, profile: "W3", perNode: true },
  { metric: "throughput.decisionTablePerSecond", target: 3000, profile: "W3", perNode: true },
  { metric: "throughput.concurrentWorkflowRuleRequests", target: 1000, profile: "W3" },
  { metric: "throughput.concurrentApiClients", target: 5000, profile: "W3" },
  { metric: "throughput.concurrentSimulations", target: 100, profile: "W3" },
  { metric: "cache.hitRate", target: 0.95, profile: "W3", cache: "warm" },
  { metric: "cache.refreshAfterPublishMs", targetMs: 5000, profile: "W3" },
  { metric: "database.ruleLookup.p95", targetMs: 25, profile: "W3" },
  { metric: "database.versionLookup.p95", targetMs: 25, profile: "W3" },
  { metric: "database.historyWrite.p95", targetMs: 100, profile: "W3" },
  { metric: "database.historyQuery.p95", targetMs: 250, profile: "W3" },
  { metric: "simulation.batch1000Ms", targetMs: 30000, profile: "W3" },
  { metric: "simulation.replay10000Ms", targetMs: 600000, profile: "W3" },
  { metric: "startup.readyMs", targetMs: 60000, profile: "W3" },
  { metric: "startup.cacheWarmMs", targetMs: 30000, profile: "W3" },
  { metric: "failover.detectionMs", targetMs: 30000, profile: "W4" },
  { metric: "resource.cpuAvg", target: 0.70, profile: "W3" },
  { metric: "resource.memoryAvg", target: 0.75, profile: "W3" }
];

export const OBSERVATION_WINDOWS = {
  latency: { minutes: 15 },
  sustained: { minutes: 60 },
  soak: { hours: 24 }
};

export const MONITORING_METRICS = [
  "requestRate", "evaluationRate", "latencyAvg", "latencyP50", "latencyP95", "latencyP99",
  "errorRate", "timeoutRate", "cacheHitRatio", "queueDepth", "cpuUtilization",
  "memoryUtilization", "databaseLatency"
];

export function sloFor(metric) {
  return RULE_SLOS.find((item) => item.metric === metric) || null;
}

export function assertSloCatalogComplete() {
  const missing = RULE_SLOS.filter((item) => !item.profile || !WORKLOAD_PROFILES[item.profile]);
  return {
    ok: missing.length === 0,
    count: RULE_SLOS.length,
    profiles: Object.keys(WORKLOAD_PROFILES),
    w3AcceptanceOnly: RULE_SLOS.filter((item) => item.profile === "W3").every((item) => WORKLOAD_PROFILES.W3.acceptance === true),
    missing
  };
}

export function percentile(values = [], ratio = 0.95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

export function assertRuleSloBoundary() {
  return {
    measurable: true,
    w1NotAcceptance: WORKLOAD_PROFILES.W1.acceptance === false,
    defaultProfile: "W3",
    defaultCache: "warm",
    restHttp: false,
    postsCollections: false
  };
}
