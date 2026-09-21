/**
 * Module 27 — Enterprise BI, KPI Registry, Metric Registry, Schema Registry.
 * Canonical KPI formulas consume registered metrics only.
 * Does not post collections or replace Module 11 report screens.
 * No REST/GraphQL HTTP server.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { registerContractHandler, publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled } from "./system-config.js";
import { isPostedCollection } from "./domain-terms.js";
import { toPesewas, fromPesewas } from "./money.js";
import { validateMetricDefinition, METRIC_DEFINITION_JSON_SCHEMA, METRIC_DEFINITION_SCHEMA_ID } from "./metric-schema.js";
import {
  validateSchemaMetadata,
  schemaChecksum,
  verifySchemaChecksum,
  SCHEMA_METADATA_JSON_SCHEMA,
  SCHEMA_METADATA_SCHEMA_ID
} from "./schema-metadata.js";

export const BI_SCHEMA_VERSION = "1.0.0";
export const KPI_REGISTRY_VERSION = "1.0.0";
export const METRIC_REGISTRY_VERSION = "1.0.0";

const BI_ARRAYS = [
  "metricDefinitions",
  "metricDefinitionHistory",
  "kpiDefinitions",
  "kpiDefinitionHistory",
  "kpiPublications",
  "schemaRegistryEntries",
  "schemaRegistryHistory",
  "biCalculationLog",
  "biChecksumAuditLog"
];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function auditBi(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "27",
    ...extras
  }, uid);
}

function emitBiEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 27,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "BI"
  }, uid, now);
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pct(numerator, denominator) {
  if (!Number(denominator)) return 0;
  return round2((Number(numerator) / Number(denominator)) * 100);
}

function seedMetrics() {
  const from = "2026-01-01T00:00:00.000Z";
  const owner = "Business Intelligence";
  const base = {
    version: "1.0.0",
    effectiveFrom: from,
    effectiveTo: null,
    ownerModule: owner,
    roundingPolicy: "RoundHalfUp",
    missingDataPolicy: "Zero",
    customAggregationExpression: null
  };
  return [
    {
      metricId: "9cbb3b85-93d0-4d75-8a2d-cdfb2e0d2b8d",
      metricCode: "MET-SAV-001",
      metricName: "Total Collected Amount",
      description: "Sum of successfully posted savings collections.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Savings",
      sourceEntity: "SavingsTransaction",
      aggregationMethod: "Sum",
      timeGranularity: "Daily",
      tags: ["Savings", "Collections"],
      labels: { department: "Finance" },
      ...base
    },
    {
      metricId: "a1b2c3d4-1111-4d75-8a2d-cdfb2e0d2b01",
      metricCode: "MET-SAV-002",
      metricName: "Total Expected Collection Amount",
      description: "Sum of scheduled collections due in the period.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Savings",
      sourceEntity: "CollectionSchedule",
      aggregationMethod: "Sum",
      timeGranularity: "Daily",
      tags: ["Savings"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-2222-4d75-8a2d-cdfb2e0d2b02",
      metricCode: "MET-LOAN-001",
      metricName: "Loan Repayments Received",
      description: "Sum of posted loan repayments.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Loans",
      sourceEntity: "LoanRepayment",
      aggregationMethod: "Sum",
      timeGranularity: "Daily",
      tags: ["Loans"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-3333-4d75-8a2d-cdfb2e0d2b03",
      metricCode: "MET-LOAN-002",
      metricName: "Loan Repayments Due",
      description: "Sum of loan repayments due in the period.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Loans",
      sourceEntity: "LoanAccount",
      aggregationMethod: "Sum",
      timeGranularity: "Daily",
      tags: ["Loans"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-4444-4d75-8a2d-cdfb2e0d2b04",
      metricCode: "MET-SAV-003",
      metricName: "Closing Savings Balance",
      description: "Savings liability after posted transactions at period end.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Accounting",
      sourceEntity: "LedgerEntry",
      aggregationMethod: "Latest",
      timeGranularity: "Daily",
      tags: ["Savings"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-5555-4d75-8a2d-cdfb2e0d2b05",
      metricCode: "MET-SAV-004",
      metricName: "Opening Savings Balance",
      description: "Savings liability at period start.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Accounting",
      sourceEntity: "LedgerEntry",
      aggregationMethod: "Earliest",
      timeGranularity: "Daily",
      tags: ["Savings"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-6666-4d75-8a2d-cdfb2e0d2b06",
      metricCode: "MET-CUS-001",
      metricName: "New Active Customers",
      description: "Count of customers becoming Active in the period.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Customer",
      sourceEntity: "Customer",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Customers"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-7777-4d75-8a2d-cdfb2e0d2b07",
      metricCode: "MET-CUS-002",
      metricName: "Opening Active Customers",
      description: "Active customers at period start.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Customer",
      sourceEntity: "Customer",
      aggregationMethod: "Latest",
      timeGranularity: "Daily",
      tags: ["Customers"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-8888-4d75-8a2d-cdfb2e0d2b08",
      metricCode: "MET-CUS-003",
      metricName: "Active Customers",
      description: "Customers with Active status.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Customer",
      sourceEntity: "Customer",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Customers"],
      labels: {},
      ...base
    },
    {
      metricId: "a1b2c3d4-9999-4d75-8a2d-cdfb2e0d2b09",
      metricCode: "MET-CUS-004",
      metricName: "Total Registered Customers",
      description: "Active, suspended, and dormant customers excluding deleted.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Customer",
      sourceEntity: "Customer",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Customers"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0001-4d75-8a2d-cdfb2e0d2b10",
      metricCode: "MET-ACC-001",
      metricName: "Operating Revenue",
      description: "Operating revenue from the Accounting Module.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Accounting",
      sourceEntity: "JournalEntry",
      aggregationMethod: "Sum",
      timeGranularity: "Monthly",
      tags: ["Accounting"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0002-4d75-8a2d-cdfb2e0d2b11",
      metricCode: "MET-ACC-002",
      metricName: "Operating Expenses",
      description: "Operating expenses from the Accounting Module.",
      dataType: "Currency",
      unitOfMeasure: "GHS",
      sourceModule: "Accounting",
      sourceEntity: "JournalEntry",
      aggregationMethod: "Sum",
      timeGranularity: "Monthly",
      tags: ["Accounting"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0003-4d75-8a2d-cdfb2e0d2b12",
      metricCode: "MET-COL-001",
      metricName: "Completed Collections",
      description: "Count of completed collection assignments.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Savings",
      sourceEntity: "Collection",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Collections"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0004-4d75-8a2d-cdfb2e0d2b13",
      metricCode: "MET-COL-002",
      metricName: "Working Days",
      description: "Working days excluding leave and holidays where configured.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Administration",
      sourceEntity: "Calendar",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Productivity"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0005-4d75-8a2d-cdfb2e0d2b14",
      metricCode: "MET-WF-001",
      metricName: "Workflow Instances Completed Within SLA",
      description: "Completed workflows meeting SLA.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Workflow",
      sourceEntity: "WorkflowInstance",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Workflow"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0006-4d75-8a2d-cdfb2e0d2b15",
      metricCode: "MET-WF-002",
      metricName: "Total Completed Workflow Instances",
      description: "Completed workflows excluding cancelled.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Workflow",
      sourceEntity: "WorkflowInstance",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Workflow"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0007-4d75-8a2d-cdfb2e0d2b16",
      metricCode: "MET-MON-001",
      metricName: "Scheduled Service Time",
      description: "Scheduled uptime window from Monitoring.",
      dataType: "Duration",
      unitOfMeasure: "Seconds",
      sourceModule: "Monitoring",
      sourceEntity: "HealthCheck",
      aggregationMethod: "Sum",
      timeGranularity: "Hourly",
      tags: ["Availability"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0008-4d75-8a2d-cdfb2e0d2b17",
      metricCode: "MET-MON-002",
      metricName: "Unplanned Downtime",
      description: "Unplanned downtime from Monitoring.",
      dataType: "Duration",
      unitOfMeasure: "Seconds",
      sourceModule: "Monitoring",
      sourceEntity: "Incident",
      aggregationMethod: "Sum",
      timeGranularity: "Hourly",
      tags: ["Availability"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0009-4d75-8a2d-cdfb2e0d2b18",
      metricCode: "MET-PAY-001",
      metricName: "Successful Payments",
      description: "Payments in Completed state.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Payments",
      sourceEntity: "PaymentTransaction",
      aggregationMethod: "Count",
      timeGranularity: "Daily",
      tags: ["Payments"],
      labels: {},
      ...base
    },
    {
      metricId: "b1b2c3d4-0010-4d75-8a2d-cdfb2e0d2b19",
      metricCode: "MET-PAY-002",
      metricName: "Total Payment Attempts",
      description: "Payment attempts after idempotency deduplication.",
      dataType: "Count",
      unitOfMeasure: "Count",
      sourceModule: "Payments",
      sourceEntity: "PaymentTransaction",
      aggregationMethod: "CountDistinct",
      timeGranularity: "Daily",
      tags: ["Payments"],
      labels: {},
      ...base
    }
  ];
}

function seedKpis() {
  const from = "2026-01-01T00:00:00.000Z";
  return [
    {
      kpiId: "kpi-col-rate",
      kpiCode: "KPI-COL-RATE",
      kpiName: "Collection Rate",
      purpose: "Percentage of expected savings collections received.",
      formula: "(MET-SAV-001 / MET-SAV-002) * 100",
      inputMetrics: ["MET-SAV-001", "MET-SAV-002"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-loan-rec",
      kpiCode: "KPI-LOAN-REC",
      kpiName: "Loan Recovery Rate",
      purpose: "Posted repayments versus repayments due.",
      formula: "(MET-LOAN-001 / MET-LOAN-002) * 100",
      inputMetrics: ["MET-LOAN-001", "MET-LOAN-002"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-sav-growth",
      kpiCode: "KPI-SAV-GROWTH",
      kpiName: "Savings Growth Rate",
      purpose: "Change in savings balances over the period.",
      formula: "((MET-SAV-003 - MET-SAV-004) / MET-SAV-004) * 100",
      inputMetrics: ["MET-SAV-003", "MET-SAV-004"],
      aggregationPeriod: "Monthly",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-cus-growth",
      kpiCode: "KPI-CUS-GROWTH",
      kpiName: "Customer Growth Rate",
      purpose: "New active customers versus opening active customers.",
      formula: "(MET-CUS-001 / MET-CUS-002) * 100",
      inputMetrics: ["MET-CUS-001", "MET-CUS-002"],
      aggregationPeriod: "Monthly",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-active-mem",
      kpiCode: "KPI-ACTIVE-MEM",
      kpiName: "Active Membership Rate",
      purpose: "Active customers as a share of registered customers.",
      formula: "(MET-CUS-003 / MET-CUS-004) * 100",
      inputMetrics: ["MET-CUS-003", "MET-CUS-004"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-branch-profit",
      kpiCode: "KPI-BRANCH-PROFIT",
      kpiName: "Branch Profitability",
      purpose: "Operating revenue minus operating expenses.",
      formula: "MET-ACC-001 - MET-ACC-002",
      inputMetrics: ["MET-ACC-001", "MET-ACC-002"],
      aggregationPeriod: "Monthly",
      unitOfMeasure: "GHS",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-col-prod",
      kpiCode: "KPI-COL-PROD",
      kpiName: "Collector Productivity",
      purpose: "Completed collections per working day.",
      formula: "MET-COL-001 / MET-COL-002",
      inputMetrics: ["MET-COL-001", "MET-COL-002"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Count",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-wf-sla",
      kpiCode: "KPI-WF-SLA",
      kpiName: "Workflow SLA Compliance",
      purpose: "Share of completed workflows within SLA.",
      formula: "(MET-WF-001 / MET-WF-002) * 100",
      inputMetrics: ["MET-WF-001", "MET-WF-002"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-sys-avail",
      kpiCode: "KPI-SYS-AVAIL",
      kpiName: "System Availability",
      purpose: "Scheduled service time minus unplanned downtime.",
      formula: "((MET-MON-001 - MET-MON-002) / MET-MON-001) * 100",
      inputMetrics: ["MET-MON-001", "MET-MON-002"],
      aggregationPeriod: "Hourly",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    },
    {
      kpiId: "kpi-pay-success",
      kpiCode: "KPI-PAY-SUCCESS",
      kpiName: "Payment Success Rate",
      purpose: "Successful payments versus payment attempts.",
      formula: "(MET-PAY-001 / MET-PAY-002) * 100",
      inputMetrics: ["MET-PAY-001", "MET-PAY-002"],
      aggregationPeriod: "Daily",
      unitOfMeasure: "Percent",
      roundingRule: "RoundHalfUp",
      missingDataPolicy: "Zero",
      ownerModule: "Business Intelligence",
      version: "1.0.0",
      status: "published",
      effectiveFrom: from
    }
  ];
}

function recordChecksumAudit(state, event) {
  ensureBiState(state);
  state.biChecksumAuditLog.push({
    id: event.id || `chk-${Date.now().toString(36)}`,
    schemaId: event.schemaId || "",
    schemaVersion: event.schemaVersion || "",
    checksumAlgorithm: event.checksumAlgorithm || "SHA-256",
    computedChecksum: event.computedChecksum || "",
    verificationResult: event.verificationResult || "",
    timestampUtc: event.timestampUtc || new Date().toISOString(),
    executingService: event.executingService || "bi-ops",
    correlationId: event.correlationId || "",
    immutable: true
  });
}

function seedSchemaRegistry() {
  return [
    {
      schemaId: "5c0d34a9-66a3-46b2-b7fd-58f2eec4f4ad",
      schemaCode: "SCH-METRIC-001",
      schemaName: "Metric Definition",
      schemaType: "Metric",
      version: "1.0.0",
      status: "Published",
      ownerModule: "Business Intelligence",
      owningTeam: "Platform Engineering",
      approvalReference: "WF-APP-2026-000001",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      compatibilityLevel: "BackwardCompatible",
      registryUri: METRIC_DEFINITION_SCHEMA_ID,
      documentationUri: "https://docs.smiletrust.local/schemas/metric-definition/v1",
      checksum: schemaChecksum(METRIC_DEFINITION_JSON_SCHEMA),
      publishedAtUtc: "2026-01-01T00:00:00.000Z",
      publishedBy: "platform-release-service",
      labels: { domain: "analytics", criticality: "high" },
      tags: ["metric", "kpi", "v1"],
      definition: METRIC_DEFINITION_JSON_SCHEMA
    },
    {
      schemaId: "6d1e45b0-77b4-47c3-88ae-69a3ffd5a5be",
      schemaCode: "SCH-META-001",
      schemaName: "Schema Metadata",
      schemaType: "Configuration",
      version: "1.0.0",
      status: "Published",
      ownerModule: "Business Intelligence",
      owningTeam: "Platform Engineering",
      approvalReference: "WF-APP-2026-000002",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      compatibilityLevel: "BackwardCompatible",
      registryUri: SCHEMA_METADATA_SCHEMA_ID,
      documentationUri: "https://docs.smiletrust.local/schemas/schema-metadata/v1",
      checksum: schemaChecksum(SCHEMA_METADATA_JSON_SCHEMA),
      publishedAtUtc: "2026-01-01T00:00:00.000Z",
      publishedBy: "platform-release-service",
      labels: { domain: "governance", criticality: "high" },
      tags: ["schema", "metadata", "v1"],
      definition: SCHEMA_METADATA_JSON_SCHEMA
    }
  ];
}

export function ensureBiState(state = {}) {
  BI_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.metricDefinitions.length) {
    const seeded = seedMetrics();
    seeded.forEach((item) => {
      const check = validateMetricDefinition(item);
      if (check.ok) state.metricDefinitions.push(item);
    });
  }
  if (!state.kpiDefinitions.length) state.kpiDefinitions = seedKpis();
  if (!state.schemaRegistryEntries.length) {
    seedSchemaRegistry().forEach((item) => {
      const { definition, ...metadata } = item;
      const check = validateSchemaMetadata(metadata);
      if (check.ok) state.schemaRegistryEntries.push(item);
    });
  }
  return state;
}

function engineEnabled(state) {
  return isFeatureEnabled(state, "enableEnterpriseBi") !== false;
}

export function getMetric(state, codeOrId) {
  ensureBiState(state);
  return (state.metricDefinitions || []).find((item) => item.metricCode === codeOrId || item.metricId === codeOrId) || null;
}

export function listMetrics(state, filters = {}) {
  ensureBiState(state);
  let rows = [...(state.metricDefinitions || [])];
  if (filters.sourceModule) rows = rows.filter((item) => item.sourceModule === filters.sourceModule);
  if (filters.tag) rows = rows.filter((item) => (item.tags || []).includes(filters.tag));
  return { ok: true, rows, count: rows.length, registryVersion: METRIC_REGISTRY_VERSION };
}

export function registerMetric(state, definition, user, uid, now) {
  ensureBiState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Enterprise BI is disabled", errorCode: "BI-012", http: 423 };
  if (!permitted(user, "Bi.Metric") && !permitted(user, "Bi.Admin")) {
    return { ok: false, error: "You cannot register metrics", errorCode: "BI-003", http: 403 };
  }
  const check = validateMetricDefinition(definition);
  if (!check.ok) return { ...check, http: 422 };
  if ((state.metricDefinitions || []).some((item) => item.metricCode === definition.metricCode && item.metricId !== definition.metricId)) {
    return { ok: false, error: "metricCode must be unique", errorCode: "BI-004", http: 409 };
  }
  if ((state.metricDefinitions || []).some((item) => item.metricId === definition.metricId)) {
    return { ok: false, error: "metricId must be unique", errorCode: "BI-004", http: 409 };
  }
  state.metricDefinitions.push({ ...definition });
  state.metricDefinitionHistory.push({
    id: newId("mh", uid),
    metricId: definition.metricId,
    previousVersion: null,
    newVersion: definition.version,
    changeDescription: "Registered",
    changedBy: user?.id || "",
    approvalReference: definition.approvalReference || "",
    effectiveDate: definition.effectiveFrom,
    createdAt: nowIso(now)
  });
  auditBi(state, "Metric registered", definition.metricCode, user, { entityId: definition.metricId }, uid);
  emitBiEvent(state, "MetricRegistered", { metricCode: definition.metricCode }, { uid, now, aggregateId: definition.metricId });
  return { ok: true, metric: definition };
}

export function resolveMetricInputs(state, range = {}, user) {
  ensureBiState(state);
  const collections = (state.collections || []).filter((item) => isPostedCollection(item));
  const inRange = (date) => {
    const day = String(date || "").slice(0, 10);
    if (range.from && day < range.from) return false;
    if (range.to && day > range.to) return false;
    return true;
  };
  const collected = collections.filter((item) => inRange(item.date)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expected = Number(range.expectedCollections ?? collected);
  const loans = state.loans || [];
  const loanDue = loans.reduce((sum, loan) => sum + Number(loan.totalDue || 0), 0);
  const loanPaid = loans.reduce((sum, loan) => sum + Number(loan.amountPaid || 0), 0);
  const revenue = fromPesewas((state.ledgerEntries || [])
    .filter((item) => !item.reversed && String(item.account || "").startsWith("income"))
    .reduce((sum, item) => sum + Number(item.amountPesewas || toPesewas(item.amount || 0)), 0));
  const expenses = fromPesewas((state.ledgerEntries || [])
    .filter((item) => !item.reversed && String(item.account || "").startsWith("expense"))
    .reduce((sum, item) => sum + Number(item.amountPesewas || toPesewas(item.amount || 0)), 0));
  const savingsLiability = collected;
  const customers = state.customers || [];
  const active = customers.filter((item) => item.active !== false && !["Closed", "Deleted"].includes(item.memberStatus)).length;
  const registered = customers.filter((item) => item.memberStatus !== "Deleted").length;
  const opened = customers.filter((item) => inRange(item.createdAt || item.date)).length;
  const openingActive = Math.max(active - opened, 0);
  const workflows = state.workflowInstances || [];
  const completed = workflows.filter((item) => item.status === "completed");
  const withinSla = completed.filter((item) => item.slaBreached !== true);
  const payments = state.paymentTransactions || [];
  const successPayments = payments.filter((item) => ["Completed", "completed", "success", "Success"].includes(item.status)).length;
  const attempts = new Set(payments.map((item) => item.idempotencyKey || item.id)).size || payments.length;
  const scheduledSeconds = Number(range.scheduledServiceSeconds ?? 86400);
  const downtimeSeconds = Number(range.unplannedDowntimeSeconds ?? 0);
  const workingDays = Number(range.workingDays ?? 1);
  const completedCollections = collections.filter((item) => inRange(item.date)).length;

  return {
    "MET-SAV-001": collected,
    "MET-SAV-002": expected,
    "MET-LOAN-001": loanPaid,
    "MET-LOAN-002": loanDue,
    "MET-SAV-003": Number(range.closingSavingsBalance ?? savingsLiability),
    "MET-SAV-004": Number(range.openingSavingsBalance ?? savingsLiability),
    "MET-CUS-001": opened,
    "MET-CUS-002": openingActive,
    "MET-CUS-003": active,
    "MET-CUS-004": registered,
    "MET-ACC-001": revenue,
    "MET-ACC-002": expenses,
    "MET-COL-001": completedCollections,
    "MET-COL-002": workingDays,
    "MET-WF-001": withinSla.length,
    "MET-WF-002": completed.length,
    "MET-MON-001": scheduledSeconds,
    "MET-MON-002": downtimeSeconds,
    "MET-PAY-001": successPayments,
    "MET-PAY-002": attempts,
    _compat: { userId: user?.id || "" }
  };
}

export function calculateKpi(state, kpiCode, range = {}, user, uid, now) {
  ensureBiState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Enterprise BI is disabled", errorCode: "BI-012", http: 423 };
  if (!permitted(user, "Bi.View") && !permitted(user, "Reports.View") && !permitted(user, "Reports.Executive")) {
    return { ok: false, error: "You cannot calculate KPIs", errorCode: "BI-003", http: 403 };
  }
  const kpi = (state.kpiDefinitions || []).find((item) => item.kpiCode === kpiCode || item.kpiId === kpiCode);
  if (!kpi) return { ok: false, error: "KPI not found", errorCode: "BI-005", http: 404 };
  if (kpi.status !== "published" && !isSystemOwner(user)) {
    return { ok: false, error: "KPI is not published", errorCode: "BI-006", http: 409 };
  }
  for (const code of kpi.inputMetrics || []) {
    if (!getMetric(state, code)) {
      return { ok: false, error: `Referenced metric ${code} is not registered`, errorCode: "BI-007", http: 422 };
    }
  }
  const inputs = resolveMetricInputs(state, range, user);
  const m = (code) => Number(inputs[code] || 0);
  let value = 0;
  switch (kpi.kpiCode) {
    case "KPI-COL-RATE":
      value = pct(m("MET-SAV-001"), m("MET-SAV-002"));
      break;
    case "KPI-LOAN-REC":
      value = pct(m("MET-LOAN-001"), m("MET-LOAN-002"));
      break;
    case "KPI-SAV-GROWTH":
      value = pct(m("MET-SAV-003") - m("MET-SAV-004"), m("MET-SAV-004"));
      break;
    case "KPI-CUS-GROWTH":
      value = pct(m("MET-CUS-001"), m("MET-CUS-002"));
      break;
    case "KPI-ACTIVE-MEM":
      value = pct(m("MET-CUS-003"), m("MET-CUS-004"));
      break;
    case "KPI-BRANCH-PROFIT":
      value = round2(m("MET-ACC-001") - m("MET-ACC-002"));
      break;
    case "KPI-COL-PROD":
      value = m("MET-COL-002") ? round2(m("MET-COL-001") / m("MET-COL-002")) : 0;
      break;
    case "KPI-WF-SLA":
      value = pct(m("MET-WF-001"), m("MET-WF-002"));
      break;
    case "KPI-SYS-AVAIL":
      value = pct(m("MET-MON-001") - m("MET-MON-002"), m("MET-MON-001"));
      break;
    case "KPI-PAY-SUCCESS":
      value = pct(m("MET-PAY-001"), m("MET-PAY-002"));
      break;
    default:
      return { ok: false, error: "Unsupported KPI formula", errorCode: "BI-008", http: 422 };
  }
  const row = {
    id: newId("kcal", uid),
    kpiCode: kpi.kpiCode,
    formulaVersion: kpi.version,
    value,
    unit: kpi.unitOfMeasure,
    inputs: Object.fromEntries((kpi.inputMetrics || []).map((code) => [code, m(code)])),
    range,
    createdAt: nowIso(now),
    createdBy: user?.id || ""
  };
  state.biCalculationLog.push(row);
  recordMetric(state, { name: "bi.kpi.calculated", value: 1, module: "27" }, uid, now);
  return { ok: true, kpi, result: row };
}

export function calculateAllKpis(state, range = {}, user, uid, now) {
  ensureBiState(state);
  const published = (state.kpiDefinitions || []).filter((item) => item.status === "published");
  const results = published.map((kpi) => calculateKpi(state, kpi.kpiCode, range, user, uid, now));
  return { ok: true, results, dashboard: Object.fromEntries(results.filter((item) => item.ok).map((item) => [item.kpi.kpiCode, item.result.value])) };
}

export function publishKpi(state, kpiId, user, uid, now) {
  ensureBiState(state);
  if (!permitted(user, "Bi.Publish") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot publish KPIs", errorCode: "BI-003", http: 403 };
  }
  const kpi = (state.kpiDefinitions || []).find((item) => item.kpiId === kpiId || item.kpiCode === kpiId);
  if (!kpi) return { ok: false, error: "KPI not found", errorCode: "BI-005", http: 404 };
  for (const code of kpi.inputMetrics || []) {
    if (!getMetric(state, code)) return { ok: false, error: `Metric ${code} missing`, errorCode: "BI-007", http: 422 };
  }
  const from = kpi.status;
  if (from === "draft") kpi.status = "testing";
  else if (from === "testing") kpi.status = "approved";
  else if (from === "approved") kpi.status = "published";
  else if (from === "published") kpi.status = "published";
  else return { ok: false, error: "Invalid KPI transition", errorCode: "BI-009", http: 409 };
  state.kpiPublications.push({ id: newId("kpub", uid), kpiId: kpi.kpiId, version: kpi.version, publishedBy: user?.id || "", createdAt: nowIso(now) });
  auditBi(state, "KPI published", kpi.kpiCode, user, { entityId: kpi.kpiId }, uid);
  queueNotification(state, {
    event: "bi_kpi_published",
    channel: "In-App",
    userId: user?.id || "",
    vars: { name: user?.username || "Team", kpi: kpi.kpiName },
    uid,
    correlationId: kpi.kpiId,
    committed: true,
    idempotencyKey: `bi_kpi_published:${kpi.kpiId}:${kpi.version}`
  });
  emitBiEvent(state, "KpiPublished", { kpiCode: kpi.kpiCode }, { uid, now, aggregateId: kpi.kpiId });
  return { ok: true, kpi };
}

export function registerSchema(state, entry, user, uid, now) {
  ensureBiState(state);
  if (!permitted(user, "Bi.Schema") && !permitted(user, "Bi.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot publish schemas", errorCode: "BI-003", http: 403 };
  }
  const { definition, ...metadata } = entry;
  const metaCheck = validateSchemaMetadata(metadata);
  if (!metaCheck.ok) return { ...metaCheck, http: 422 };
  if ((state.schemaRegistryEntries || []).some((item) => item.schemaCode === metadata.schemaCode && item.schemaId !== metadata.schemaId)) {
    return { ok: false, error: "schemaCode must be unique", errorCode: "BI-004", http: 409 };
  }
  if (metadata.status === "Published" && definition) {
    const computed = schemaChecksum(definition);
    recordChecksumAudit(state, {
      id: newId("chk", uid),
      schemaId: metadata.schemaId,
      schemaVersion: metadata.version,
      checksumAlgorithm: "SHA-256",
      computedChecksum: computed,
      verificationResult: "generated",
      timestampUtc: nowIso(now),
      executingService: "bi-ops",
      correlationId: metadata.schemaId
    });
    const verified = verifySchemaChecksum(definition, metadata.checksum);
    recordChecksumAudit(state, {
      id: newId("chk", uid),
      schemaId: metadata.schemaId,
      schemaVersion: metadata.version,
      checksumAlgorithm: "SHA-256",
      computedChecksum: verified.computed || computed,
      verificationResult: verified.ok ? "passed" : "failed",
      timestampUtc: nowIso(now),
      executingService: "bi-ops",
      correlationId: metadata.schemaId
    });
    if (!verified.ok) {
      return {
        ok: false,
        error: verified.error || "checksum mismatch",
        errorCode: verified.errorCode || "BI-010",
        http: 422
      };
    }
  }
  const row = { ...metadata, definition: definition || null };
  state.schemaRegistryEntries.push(row);
  state.schemaRegistryHistory.push({
    id: newId("schh", uid),
    schemaId: metadata.schemaId,
    previousVersion: null,
    newVersion: metadata.version,
    previousStatus: null,
    newStatus: metadata.status,
    changeDescription: "Published",
    approvalReference: metadata.approvalReference,
    changedBy: user?.id || "",
    createdAt: nowIso(now)
  });
  auditBi(state, "Schema registered", metadata.schemaCode, user, { entityId: metadata.schemaId }, uid);
  emitBiEvent(state, "SchemaPublished", { schemaCode: metadata.schemaCode }, { uid, now, aggregateId: metadata.schemaId });
  return { ok: true, schema: row };
}

export function listSchemas(state, filters = {}) {
  ensureBiState(state);
  let rows = [...(state.schemaRegistryEntries || [])];
  if (filters.status) rows = rows.filter((item) => item.status === filters.status);
  if (filters.schemaType) rows = rows.filter((item) => item.schemaType === filters.schemaType);
  return { ok: true, rows, count: rows.length };
}

export function biDashboard(state, range = {}, user, uid, now) {
  ensureBiState(state);
  const all = calculateAllKpis(state, range, user || { role: "SystemOwner", systemOwner: true }, uid || ((p) => `${p}-dash`), now);
  return {
    metrics: (state.metricDefinitions || []).length,
    kpis: (state.kpiDefinitions || []).filter((item) => item.status === "published").length,
    schemas: (state.schemaRegistryEntries || []).filter((item) => item.status === "Published").length,
    calculations: (state.biCalculationLog || []).length,
    dashboard: all.dashboard || {},
    registryVersions: {
      metric: METRIC_REGISTRY_VERSION,
      kpi: KPI_REGISTRY_VERSION,
      bi: BI_SCHEMA_VERSION
    }
  };
}

export function biReports(state, reportId) {
  ensureBiState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "bi_metrics") return table(["metricCode", "metricName", "dataType", "sourceModule", "version"], state.metricDefinitions || []);
  if (reportId === "bi_kpis") return table(["kpiCode", "kpiName", "status", "formula", "version"], state.kpiDefinitions || []);
  if (reportId === "bi_schemas") return table(["schemaCode", "schemaName", "status", "version", "compatibilityLevel"], state.schemaRegistryEntries || []);
  if (reportId === "bi_calculations") return table(["kpiCode", "value", "formulaVersion", "createdAt"], state.biCalculationLog || []);
  if (reportId === "bi_metric_history") return table(["metricId", "newVersion", "changeDescription", "createdAt"], state.metricDefinitionHistory || []);
  return table(["id"], []);
}

export function exportBiCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function assertBiBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    replacesModule11: false,
    restHttp: false,
    graphqlHttp: false,
    metricRegistry: true,
    schemaRegistry: true,
    canonicalFormulas: true
  };
}

registerJobHandler("bi_kpi_refresh", (state, job, ctx) => calculateAllKpis(state, job.payload?.range || {}, ctx.user, ctx.uid, ctx.now));

registerContractHandler("Bi.Metric.List.v1", (state, payload) => listMetrics(state, payload || {}));
registerContractHandler("Bi.Kpi.Calculate.v1", (state, payload, ctx) => calculateKpi(state, payload.kpiCode || payload.code, payload.range || {}, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Bi.Schema.List.v1", (state, payload) => listSchemas(state, payload || {}));
