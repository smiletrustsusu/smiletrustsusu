import test from "node:test";
import assert from "node:assert/strict";
import {
  API_SCHEMA_VERSION,
  HEADER_PROPERTIES,
  DEFAULT_CONDITIONAL_RULES,
  STATUS_CODES,
  generateUuidV4,
  isUuidV4,
  formatDecimalAmount,
  assertFinancialType,
  assertHeaderMetadataIntegrity,
  isValidRequirementGeneration,
  headerProperty,
  validateOperand,
  validateRuleInstance,
  validateActiveRuleSet,
  evaluateCondition,
  evaluateConditionalRules,
  buildEvaluationContext,
  normalizeRequestHeader,
  validateRequestHeader,
  buildResponseHeader,
  assertImmutablePropagation,
  standardSuccessEnvelope,
  standardErrorEnvelope,
  standardPaginatedEnvelope,
  standardAsyncEnvelope,
  standardFileEnvelope,
  standardEvent,
  assertApiSchemaBoundary,
  OPERAND_JSON_SCHEMA,
  CONDITIONAL_RULE_JSON_SCHEMA,
  paginateCollection,
  buildPagination,
  buildStatus,
  STATUS_CATEGORIES,
  STATUS_SCHEMA_VERSION,
  PAGINATION_SCHEMA_VERSION
} from "../src/core/api-schema.js";
import { invokeContract, publishDomainEvent, ensureContractState } from "../src/core/module-contracts.js";
import "../src/core/module-contract-handlers.js";
import { ensureGatewayState, dispatchGatewayRequest } from "../src/core/api-gateway-ops.js";
import { ensureSecurityState } from "../src/core/security-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const now = "2026-09-11T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20 }],
    customers: [
      { id: "c-a", name: "Ama", active: true },
      { id: "c-b", name: "Kofi", active: true }
    ],
    loans: [],
    audit: [],
    devices: []
  };
  ensureGatewayState(state);
  ensureSecurityState(state);
  ensureContractState(state);
  return state;
}

function uuidHeader(overrides = {}) {
  return {
    requestId: generateUuidV4(),
    correlationId: generateUuidV4(),
    contractId: "Savings.Balance.v1",
    contractVersion: "1.0.0",
    requestTimestampUtc: now,
    clientType: "APIClient",
    clientId: "client-web",
    ...overrides
  };
}

test("two-axis header metadata is complete and internally consistent", () => {
  const integrity = assertHeaderMetadataIntegrity();
  assert.equal(integrity.ok, true);
  assert.ok(HEADER_PROPERTIES.length >= 20);
  assert.equal(headerProperty("requestId").requirement, "R");
  assert.equal(headerProperty("requestId").generation, "CG");
  assert.equal(headerProperty("traceId").generation, "GG");
  assert.equal(headerProperty("responseId").generation, "RG");
  assert.equal(headerProperty("locale").requirement, "O");
  assert.equal(isValidRequirementGeneration("R", "CG"), true);
  assert.equal(isValidRequirementGeneration("R", "O"), false);
  assert.equal(assertApiSchemaBoundary().floatingPointMoney, false);
  assert.equal(assertApiSchemaBoundary().headerSuperset, true);
  assert.ok(STATUS_CODES.includes("VALIDATION_ERROR"));
  assert.equal(OPERAND_JSON_SCHEMA.allOf.length >= 3, true);
  assert.equal(CONDITIONAL_RULE_JSON_SCHEMA.additionalProperties, false);
  assert.equal(API_SCHEMA_VERSION, "1.0.0");
});

test("trusted internal invokeContract stays backward compatible and returns a response header superset", () => {
  const state = blank();
  const before = state.collections.length;
  const balance = invokeContract(state, {
    contractId: "Savings.Balance.v1",
    fromModule: 20,
    payload: { customerId: "c-a" }
  }, { uid, now, user: owner });
  assert.equal(balance.ok, true);
  assert.equal(balance.data.balance, 20);
  assert.equal(isUuidV4(balance.header.requestId), true);
  assert.equal(balance.header.requestId, balance.envelope.header.requestId);
  assert.equal(balance.header.correlationId, balance.envelope.header.correlationId);
  assert.equal(balance.header.contractId, "Savings.Balance.v1");
  assert.equal(balance.header.clientType, "InternalService");
  assert.equal(typeof balance.header.processingDurationMs, "number");
  assert.equal(Boolean(balance.header.responseId), true);
  assert.equal(balance.envelope.status.code, "SUCCESS");
  assert.equal(state.collections.length, before);
  const blocked = invokeContract(state, { contractId: "Savings.Collect.v1", fromModule: 20, payload: { amount: 99 } }, { uid, now, user: owner });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.header.requestId, blocked.envelope.header.requestId);
  assert.ok(blocked.envelope.header.responseId);
  assert.equal(assertImmutablePropagation(blocked.header, blocked.envelope.header).ok, true);
});

test("error responses preserve propagated identifiers including retired contracts", () => {
  const state = blank();
  const call = invokeContract(state, { contractId: "Security.DeprecatedProbe.v1", fromModule: 20 }, { uid, now, user: owner });
  assert.equal(call.http, 410);
  assert.equal(call.envelope.status.code, "PERMANENT_FAILURE");
  assert.equal(call.header.contractId, "Security.DeprecatedProbe.v1");
  assert.equal(Boolean(call.header.responseId), true);
  assert.equal(Boolean(call.header.traceId), true);
});

test("AndroidAPK requests require deviceId before business logic", () => {
  const state = blank();
  const denied = invokeContract(state, {
    contractId: "Savings.Balance.v1",
    fromModule: 20,
    header: uuidHeader({ clientType: "AndroidAPK", clientId: "client-android" }),
    payload: { customerId: "c-a" }
  }, { uid, now });
  assert.equal(denied.ok, false);
  assert.equal(denied.envelope.status.code, "VALIDATION_ERROR");
  assert.equal(denied.error.details.some((item) => item.field === "deviceId"), true);
  assert.equal(state.collections[0].amount, 20);

  const allowed = invokeContract(state, {
    contractId: "Savings.Balance.v1",
    fromModule: 20,
    header: uuidHeader({
      clientType: "AndroidAPK",
      clientId: "client-android",
      deviceId: generateUuidV4()
    }),
    payload: { customerId: "c-a" }
  }, { uid, now });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.data.balance, 20);
});

test("idempotencyKey is required for financial commands from external clients but not for queries", () => {
  const state = blank();
  const payment = invokeContract(state, {
    contractId: "Payment.Initiate.v1",
    fromModule: 20,
    header: uuidHeader({ contractId: "Payment.Initiate.v1", clientType: "APIClient", clientId: generateUuidV4() })
  }, { uid, now });
  assert.equal(payment.ok, false);
  assert.equal(payment.error.details.some((item) => item.field === "idempotencyKey"), true);

  const query = invokeContract(state, {
    contractId: "Health.Status.v1",
    fromModule: 20,
    header: uuidHeader({ contractId: "Health.Status.v1", clientType: "APIClient", clientId: generateUuidV4() })
  }, { uid, now });
  assert.equal(query.ok, true);
});

test("clients cannot override system-generated response fields", () => {
  const state = blank();
  const denied = invokeContract(state, {
    contractId: "Savings.Balance.v1",
    fromModule: 20,
    header: uuidHeader({ responseId: generateUuidV4(), processingDurationMs: 1 }),
    payload: { customerId: "c-a" }
  }, { uid, now });
  assert.equal(denied.ok, false);
  assert.equal(denied.envelope.status.code, "VALIDATION_ERROR");
  assert.equal(denied.error.details.some((item) => item.field === "responseId"), true);
});

test("response header copies immutable request identifiers without modification", () => {
  const requestId = generateUuidV4();
  const correlationId = generateUuidV4();
  const traceId = generateUuidV4();
  const requestHeader = uuidHeader({ requestId, correlationId, traceId });
  const response = buildResponseHeader(requestHeader, { now, startedMs: Date.parse(now) });
  assert.equal(response.requestId, requestId);
  assert.equal(response.correlationId, correlationId);
  assert.equal(response.traceId, traceId);
  assert.equal(response.contractId, requestHeader.contractId);
  assert.equal(response.requestTimestampUtc, now);
  assert.notEqual(response.responseId, requestId);
  assert.equal(typeof response.processingDurationMs, "number");
  assert.equal(assertImmutablePropagation(requestHeader, response).ok, true);
});

test("financial amounts serialize as decimal strings rather than floats", () => {
  assert.equal(formatDecimalAmount(20), "20.00");
  assert.equal(formatDecimalAmount("15"), "15.00");
  assert.equal(typeof formatDecimalAmount(10.5), "string");
  assert.equal(assertFinancialType(100), true);
  assert.equal(assertFinancialType(10.25), false);
});

test("paginated, async, file, and event envelopes follow the platform schema", () => {
  const header = buildResponseHeader(uuidHeader(), { now, startedMs: Date.parse(now) });
  const page = standardPaginatedEnvelope({ header, data: [1, 2, 3], page: 1, pageSize: 2, totalItems: 3 });
  assert.equal(page.pagination.hasNext, true);
  assert.equal(page.pagination.totalPages, 2);
  assert.equal(page.pagination.firstPage, 1);
  assert.equal(page.pagination.lastPage, 2);
  assert.equal(page.status.category, "Success");
  assert.equal(page.status.httpStatus, 200);
  const asyncJob = standardAsyncEnvelope({ header, jobId: generateUuidV4(), queue: "receipts" });
  assert.equal(asyncJob.status.code, "ACCEPTED");
  assert.equal(asyncJob.job.status, "Queued");
  const file = standardFileEnvelope({
    header,
    document: { documentId: generateUuidV4(), documentType: "receipt", version: "1.0", downloadUrl: "/doc", expiresAtUtc: now, checksum: "abc" }
  });
  assert.equal(file.document.documentType, "receipt");
  const event = standardEvent({ eventType: "RiskScoreUpdated", sourceModule: 22, payload: { score: 1 }, correlationId: generateUuidV4() });
  assert.equal(event.eventType, "RiskScoreUpdated");
  assert.equal(Boolean(event.eventId), true);
  assert.equal(Boolean(event.occurredAtUtc), true);
  const published = publishDomainEvent(blank(), { name: "RiskScoreUpdated", moduleId: 22, payload: { score: 4 } }, uid, now);
  assert.equal(published.ok, true);
  assert.equal(published.event.eventType, "RiskScoreUpdated");
  assert.equal(published.event.sourceModule, "22");
  assert.deepEqual(published.event.payload, { score: 4 });
});

test("canonical status and empty-result pagination are shared platform schemas", () => {
  const status = buildStatus({ code: "SUCCESS", now });
  assert.equal(status.category, "Success");
  assert.equal(status.httpStatus, 200);
  assert.equal(status.retryable, false);
  assert.equal(status.timestampUtc, now);
  assert.ok(STATUS_CATEGORIES.includes("BusinessRule"));
  assert.equal(STATUS_SCHEMA_VERSION, "1.0.0");
  assert.equal(PAGINATION_SCHEMA_VERSION, "1.0.0");
  const empty = paginateCollection([], { page: 1, pageSize: 50 });
  assert.equal(empty.ok, true);
  assert.equal(empty.http, 200);
  assert.deepEqual(empty.data, []);
  assert.equal(empty.pagination.totalItems, 0);
  assert.equal(empty.pagination.totalPages, 0);
  assert.equal(empty.pagination.lastPage, 0);
  assert.equal(empty.pagination.firstPage, 1);
  assert.equal(empty.pagination.hasNext, false);
  assert.equal(empty.pagination.hasPrevious, false);
  const emptyPageTwo = paginateCollection([], { page: 2, pageSize: 50 });
  assert.equal(emptyPageTwo.ok, false);
  assert.equal(emptyPageTwo.http, 416);
  assert.equal(emptyPageTwo.errorCode, "PAG-001");
  assert.equal(emptyPageTwo.code, "PAGE_OUT_OF_RANGE");
  const invalidPage = paginateCollection([1], { page: 0, pageSize: 10 });
  assert.equal(invalidPage.http, 400);
  const huge = paginateCollection([1], { page: 1, pageSize: 500 });
  assert.equal(huge.http, 400);
  const beyond = paginateCollection([1, 2, 3], { page: 5, pageSize: 2 });
  assert.equal(beyond.ok, false);
  assert.equal(beyond.http, 416);
  const meta = buildPagination({ page: 1, pageSize: 50, totalItems: 0 });
  assert.equal(meta.lastPage, 0);
  assert.equal(assertApiSchemaBoundary().emptyResultZeroPages, true);
  assert.equal(assertApiSchemaBoundary().sharedStatusSchema, true);
});

test("operator-specific operand rules reject invalid value shapes and type combinations", () => {
  const exists = validateOperand({ field: "deviceId", fieldType: "UUID", operator: "Exists", value: "x" });
  assert.equal(exists.ok, false);
  const inn = validateOperand({ field: "clientType", fieldType: "Enum", operator: "In", value: "AndroidAPK" });
  assert.equal(inn.ok, false);
  const both = validateOperand({ field: "clientType", fieldType: "Enum", operator: "Equals", value: "AndroidAPK", values: ["WebPortal"] });
  assert.equal(both.ok, false);
  const andOne = validateOperand({ operator: "AND", operands: [{ field: "clientType", fieldType: "Enum", operator: "Equals", value: "AndroidAPK" }] });
  assert.equal(andOne.ok, false);
  const boolGt = validateOperand({ field: "authenticationState", fieldType: "Boolean", operator: "GreaterThan", value: true });
  assert.equal(boolGt.ok, false);
  const okEq = validateOperand({ field: "clientType", fieldType: "Enum", operator: "Equals", value: "AndroidAPK" });
  assert.equal(okEq.ok, true);
  const okIn = validateOperand({ field: "clientType", fieldType: "Enum", operator: "In", values: ["AndroidAPK", "WebPortal"] });
  assert.equal(okIn.ok, true);
  const okExists = validateOperand({ field: "deviceId", fieldType: "UUID", operator: "Exists" });
  assert.equal(okExists.ok, true);
});

test("conditional rules evaluate deterministically and reject conflicting priorities", () => {
  DEFAULT_CONDITIONAL_RULES.forEach((rule) => {
    const result = validateRuleInstance(rule);
    assert.equal(result.ok, true, rule.ruleCode);
  });
  const android = evaluateConditionalRules(DEFAULT_CONDITIONAL_RULES, buildEvaluationContext({
    clientType: "AndroidAPK",
    contractId: "Savings.Balance.v1"
  }));
  assert.equal(android.required.deviceId, true);
  assert.ok(android.applied.includes("HDR-DEVICE-001"));
  const nested = evaluateCondition(DEFAULT_CONDITIONAL_RULES.find((item) => item.ruleCode === "HDR-SESS-001").condition, {
    authenticationState: "Authenticated",
    authenticationMethod: "Session"
  });
  assert.equal(nested, true);
  const conflict = validateActiveRuleSet([
    { ...DEFAULT_CONDITIONAL_RULES[0], ruleId: generateUuidV4(), requirementState: "Required", priority: 50 },
    { ...DEFAULT_CONDITIONAL_RULES[0], ruleId: generateUuidV4(), ruleCode: "HDR-DEVICE-002", requirementState: "NotRequired", priority: 50 }
  ]);
  assert.equal(conflict.ok, false);
});

test("query pagination attaches to collection contracts and gateway responses include the standard header", () => {
  const state = blank();
  const listed = invokeContract(state, {
    contractId: "Customer.List.v1",
    fromModule: 20,
    query: { page: 1, pageSize: 50 },
    payload: {}
  }, { uid, now, user: owner });
  assert.equal(listed.ok, true);
  assert.equal(listed.envelope.pagination.totalItems >= 2, true);
  const viaGateway = dispatchGatewayRequest(state, {
    route: "risk.evaluate",
    version: "v1",
    user: owner,
    body: { customerId: "c-a" }
  }, { uid, now, user: owner });
  assert.equal(viaGateway.ok, true);
  assert.equal(Boolean(viaGateway.response.header.requestId), true);
  assert.equal(Boolean(viaGateway.response.header.responseId), true);
});

test("standard envelopes expose success and validation error shapes", () => {
  const header = buildResponseHeader(uuidHeader(), { now, startedMs: Date.parse(now) });
  const ok = standardSuccessEnvelope({ header, data: { balance: "20.00" } });
  assert.equal(ok.status.code, "SUCCESS");
  assert.equal(ok.data.balance, "20.00");
  const err = standardErrorEnvelope({
    header,
    errors: [{ field: "customerId", message: "Customer does not exist.", errorCode: "CUS-101" }]
  });
  assert.equal(err.status.code, "VALIDATION_ERROR");
  assert.equal(err.errors[0].field, "customerId");
});

test("normalizeRequestHeader records gateway substitutions for trusted callers", () => {
  const normalized = normalizeRequestHeader({ contractId: "Health.Status.v1" }, { now, user: owner });
  assert.equal(normalized.trusted, true);
  assert.ok(normalized.substitutions.includes("requestId"));
  assert.ok(normalized.substitutions.includes("traceId"));
  const check = validateRequestHeader(normalized.header, {
    trusted: true,
    explicit: false,
    user: owner,
    now,
    substitutions: normalized.substitutions
  });
  assert.equal(check.ok, true);
});
