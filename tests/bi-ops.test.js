import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canTransitionKpi, assertBiLifecycleBoundary } from "../src/core/bi-lifecycle.js";
import {
  validateMetricDefinition,
  assertMetricSchemaBoundary,
  METRIC_DEFINITION_SCHEMA_ID
} from "../src/core/metric-schema.js";
import {
  validateSchemaMetadata,
  schemaChecksum,
  canonicalizeSchemaDocument,
  verifySchemaChecksum,
  isCanonicalChecksumFormat,
  isHistoricalChecksumFormat,
  SCHEMA_METADATA_JSON_SCHEMA,
  assertSchemaMetadataBoundary
} from "../src/core/schema-metadata.js";
import { sha256Hex, assertChecksumCanonicalizationBoundary } from "../src/core/schema-checksum.js";
import {
  ensureBiState,
  registerMetric,
  listMetrics,
  calculateKpi,
  calculateAllKpis,
  publishKpi,
  registerSchema,
  biDashboard,
  assertBiBoundary
} from "../src/core/bi-ops.js";
import "../src/core/bi-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { createHash } from "node:crypto";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-12T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [
      { id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20 },
      { id: "col-2", customerId: "c-a", date: "2026-09-12", amount: 30 }
    ],
    customers: [
      { id: "c-a", name: "Ama", active: true, memberStatus: "Active", createdAt: "2026-09-01" },
      { id: "c-b", name: "Kofi", active: true, memberStatus: "Active", createdAt: "2026-09-11" }
    ],
    loans: [{ id: "ln-1", totalDue: 100, amountPaid: 40, status: "Active" }],
    ledgerEntries: [],
    workflowInstances: [
      { id: "wf-1", status: "completed", slaBreached: false },
      { id: "wf-2", status: "completed", slaBreached: true }
    ],
    paymentTransactions: [
      { id: "pay-1", status: "Completed", idempotencyKey: "ik-1" },
      { id: "pay-2", status: "Failed", idempotencyKey: "ik-2" }
    ],
    audit: [],
    notifications: [],
    featureFlags: [{ id: "enableEnterpriseBi", enabled: true }]
  };
  ensureGatewayState(state);
  ensureBiState(state);
  return state;
}

test("metric and schema metadata JSON schemas reject unknowns and enforce conditionals", () => {
  assert.equal(assertMetricSchemaBoundary().machineReadable, true);
  assert.equal(assertSchemaMetadataBoundary().globalGovernance, true);
  assert.equal(assertBiLifecycleBoundary().postsCollections, false);
  assert.equal(assertBiBoundary().canonicalFormulas, true);
  assert.equal(METRIC_DEFINITION_SCHEMA_ID.includes("metric-definition"), true);

  const bad = validateMetricDefinition({ metricCode: "BAD", extra: true });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((item) => item.path === "extra"));

  const custom = validateMetricDefinition({
    metricId: "9cbb3b85-93d0-4d75-8a2d-cdfb2e0d2b8d",
    metricCode: "MET-SAV-099",
    metricName: "Custom",
    description: "Custom metric",
    dataType: "Decimal",
    unitOfMeasure: "Count",
    sourceModule: "Savings",
    sourceEntity: "X",
    aggregationMethod: "Custom",
    timeGranularity: "Daily",
    roundingPolicy: "None",
    missingDataPolicy: "Zero",
    version: "1.0.0",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    ownerModule: "Business Intelligence",
    customAggregationExpression: null
  });
  assert.equal(custom.ok, false);

  const meta = validateSchemaMetadata({
    schemaId: "5c0d34a9-66a3-46b2-b7fd-58f2eec4f4ad",
    schemaCode: "SCH-TEST-001",
    schemaName: "Test",
    schemaType: "Metric",
    version: "1.0.0",
    status: "Retired",
    ownerModule: "Business Intelligence",
    owningTeam: "Platform Engineering",
    approvalReference: "WF-1",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    compatibilityLevel: "BackwardCompatible",
    registryUri: "urn:smiletrust:schemas:test:v1",
    documentationUri: "https://docs.smiletrust.local/schemas/test/v1",
    checksum: schemaChecksum({ a: 1 }),
    publishedAtUtc: "2026-01-01T00:00:00.000Z",
    publishedBy: "system"
  });
  assert.equal(meta.ok, false);
  assert.ok(meta.errors.some((item) => item.path === "effectiveTo"));
});

test("seeded metrics and KPIs calculate with zero-denominator safety and no ledger posts", () => {
  const state = blank();
  const before = state.collections.length;
  assert.ok(state.metricDefinitions.length >= 20);
  assert.ok(state.kpiDefinitions.length >= 10);
  assert.ok(state.schemaRegistryEntries.some((item) => item.schemaCode === "SCH-METRIC-001"));
  assert.ok(state.schemaRegistryEntries.some((item) => item.schemaCode === "SCH-META-001"));

  const rate = calculateKpi(state, "KPI-COL-RATE", { from: "2026-09-01", to: "2026-09-12", expectedCollections: 100 }, owner, uid, now);
  assert.equal(rate.ok, true);
  assert.equal(rate.result.value, 50);
  assert.equal(rate.result.formulaVersion, "1.0.0");

  const zero = calculateKpi(state, "KPI-COL-RATE", { from: "2099-01-01", to: "2099-01-02", expectedCollections: 0 }, owner, uid, now);
  assert.equal(zero.ok, true);
  assert.equal(zero.result.value, 0);

  const loan = calculateKpi(state, "KPI-LOAN-REC", {}, owner, uid, now);
  assert.equal(loan.ok, true);
  assert.equal(loan.result.value, 40);

  const all = calculateAllKpis(state, { from: "2026-09-01", to: "2026-09-12", workingDays: 2, scheduledServiceSeconds: 100, unplannedDowntimeSeconds: 5 }, owner, uid, now);
  assert.equal(all.ok, true);
  assert.equal(all.dashboard["KPI-WF-SLA"], 50);
  assert.equal(all.dashboard["KPI-SYS-AVAIL"], 95);
  assert.equal(state.collections.length, before);
  assert.equal(state.settings.loanInterest, 15);
  assert.equal(state.settings.collectionDays, 31);
});

test("metric registration uniqueness, KPI publish, schema register, RBAC, contracts", () => {
  const state = blank();
  const denied = registerMetric(state, {
    metricId: "11111111-1111-4111-8111-111111111111",
    metricCode: "MET-SAV-001",
    metricName: "Dup",
    description: "Dup",
    dataType: "Currency",
    unitOfMeasure: "GHS",
    sourceModule: "Savings",
    sourceEntity: "SavingsTransaction",
    aggregationMethod: "Sum",
    timeGranularity: "Daily",
    roundingPolicy: "RoundHalfUp",
    missingDataPolicy: "Zero",
    version: "1.0.0",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    ownerModule: "Business Intelligence"
  }, owner, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "BI-004");

  assert.equal(canAction(collector, "Bi.View"), false);
  assert.equal(canAction(owner, "Bi.View"), true);
  assert.equal(canTransitionKpi("draft", "testing"), true);

  const published = publishKpi(state, "KPI-COL-RATE", owner, uid, now);
  assert.equal(published.ok, true);

  const definition = { type: "object", properties: { value: { type: "number" } } };
  const schema = registerSchema(state, {
    schemaId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    schemaCode: "SCH-KPI-001",
    schemaName: "KPI Definition",
    schemaType: "KPI",
    version: "1.0.0",
    status: "Published",
    ownerModule: "Business Intelligence",
    owningTeam: "Platform Engineering",
    approvalReference: "WF-APP-2026-000099",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    compatibilityLevel: "BackwardCompatible",
    registryUri: "urn:smiletrust:schemas:kpi-definition:v1",
    documentationUri: "https://docs.smiletrust.local/schemas/kpi-definition/v1",
    checksum: schemaChecksum(definition),
    publishedAtUtc: "2026-01-01T00:00:00.000Z",
    publishedBy: "platform-release-service",
    definition
  }, owner, uid, now);
  assert.equal(schema.ok, true);
  assert.ok((state.biChecksumAuditLog || []).some((row) => row.verificationResult === "passed"));

  assert.ok(getContract("Bi.Kpi.Calculate.v1"));
  const invoked = invokeContract(state, {
    contractId: "Bi.Metric.List.v1",
    fromModule: 20,
    payload: { sourceModule: "Savings" }
  }, { uid, now, user: owner });
  assert.equal(invoked.ok, true);
  assert.ok((invoked.data?.rows || invoked.data || []).length >= 1 || listMetrics(state, { sourceModule: "Savings" }).count >= 1);

  const gateway = dispatchGatewayRequest(state, {
    route: "bi.statistics",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(gateway.ok, true);
  assert.ok(biDashboard(state, {}, owner, uid, now).metrics >= 1);
});

test("schema checksum canonicalization is deterministic and lowercase-only", () => {
  assert.equal(assertChecksumCanonicalizationBoundary().sha256, true);
  assert.equal(sha256Hex(""), createHash("sha256").update("").digest("hex"));
  assert.equal(sha256Hex("abc"), createHash("sha256").update("abc").digest("hex"));

  const left = { b: 2, a: 1, nested: { z: true, y: null }, list: [3, 1] };
  const right = { list: [3, 1], nested: { y: null, z: true }, a: 1, b: 2 };
  const pretty = `{\n  "b": 2,\n  "a": 1,\n  "nested": { "z": true, "y": null },\n  "list": [3, 1]\n}`;
  const sumLeft = schemaChecksum(left);
  const sumRight = schemaChecksum(right);
  const sumPretty = schemaChecksum(pretty);
  assert.equal(sumLeft, sumRight);
  assert.equal(sumLeft, sumPretty);
  assert.match(sumLeft, /^SHA-256:[a-f0-9]{64}$/);
  assert.equal(isCanonicalChecksumFormat(sumLeft), true);

  const withMeta = {
    ...left,
    checksum: "SHA-256:deadbeef",
    publishedAtUtc: "2026-01-01T00:00:00.000Z",
    publishedBy: "someone",
    approvalReference: "WF-1",
    schemaMetadata: { note: "ignored" }
  };
  assert.equal(schemaChecksum(withMeta), sumLeft);
  assert.equal(canonicalizeSchemaDocument(left), '{"a":1,"b":2,"list":[3,1],"nested":{"y":null,"z":true}}');

  const semantic = schemaChecksum({ ...left, list: [1, 3] });
  assert.notEqual(semantic, sumLeft);

  const verified = verifySchemaChecksum(left, sumLeft);
  assert.equal(verified.ok, true);

  const uppercase = sumLeft.replace(/[a-f]/g, (ch) => ch.toUpperCase());
  assert.equal(isHistoricalChecksumFormat(uppercase), true);
  assert.equal(isCanonicalChecksumFormat(uppercase), false);
  const rejectUpper = verifySchemaChecksum(left, uppercase);
  assert.equal(rejectUpper.ok, false);
  assert.equal(rejectUpper.errorCode, "BI-013");

  const badMeta = validateSchemaMetadata({
    schemaId: "5c0d34a9-66a3-46b2-b7fd-58f2eec4f4ad",
    schemaCode: "SCH-TEST-002",
    schemaName: "Test",
    schemaType: "Metric",
    version: "1.0.0",
    status: "Published",
    ownerModule: "Business Intelligence",
    owningTeam: "Platform Engineering",
    approvalReference: "WF-1",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    compatibilityLevel: "BackwardCompatible",
    registryUri: "urn:smiletrust:schemas:test:v1",
    documentationUri: "https://docs.smiletrust.local/schemas/test/v1",
    checksum: uppercase,
    publishedAtUtc: "2026-01-01T00:00:00.000Z",
    publishedBy: "system"
  });
  assert.equal(badMeta.ok, false);
  assert.ok(badMeta.errors.some((item) => item.path === "checksum"));
  assert.equal(SCHEMA_METADATA_JSON_SCHEMA.properties.checksum.pattern, "^SHA-256:[a-f0-9]{64}$");

  const state = blank();
  const definition = { type: "object", title: "Mismatch" };
  const mismatch = registerSchema(state, {
    schemaId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    schemaCode: "SCH-BAD-001",
    schemaName: "Bad",
    schemaType: "Other",
    version: "1.0.0",
    status: "Published",
    ownerModule: "Business Intelligence",
    owningTeam: "Platform Engineering",
    approvalReference: "WF-APP-2026-000100",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    compatibilityLevel: "BreakingChange",
    registryUri: "urn:smiletrust:schemas:bad:v1",
    documentationUri: "https://docs.smiletrust.local/schemas/bad/v1",
    checksum: schemaChecksum({ type: "string" }),
    publishedAtUtc: "2026-01-01T00:00:00.000Z",
    publishedBy: "platform-release-service",
    definition
  }, owner, uid, now);
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.errorCode, "BI-010");
});
