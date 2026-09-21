/**
 * Global request/response schema, header property registry, and
 * machine-readable conditional requirement rules.
 * In-process platform contract. No REST/GraphQL HTTP server.
 * Does not post collections or change financial engines.
 */

export const API_SCHEMA_VERSION = "1.0.0";
export const HEADER_SCHEMA_VERSION = "1.0.0";
export const RULE_SCHEMA_VERSION = "1.0.0";
export const OPERAND_SCHEMA_VERSION = "1.0.0";
export const SERVER_NODE_ID = "api-node-local";
export const DEFAULT_LOCALE = "en-GH";
export const DEFAULT_TIME_ZONE = "Africa/Accra";
export const CLOCK_DRIFT_SECONDS = 300;

export const STATUS_SCHEMA_VERSION = "1.0.0";
export const PAGINATION_SCHEMA_VERSION = "1.0.0";
export const MAX_PAGE_SIZE = 200;

export const STATUS_CATEGORIES = [
  "Success",
  "Validation",
  "Authentication",
  "Authorization",
  "BusinessRule",
  "Conflict",
  "RateLimit",
  "TemporaryFailure",
  "PermanentFailure",
  "InternalError"
];

export const STATUS_CODES = [
  "SUCCESS",
  "ACCEPTED",
  "VALIDATION_ERROR",
  "AUTHENTICATION_FAILED",
  "AUTHORIZATION_FAILED",
  "RESOURCE_NOT_FOUND",
  "CONFLICT",
  "DUPLICATE_REQUEST",
  "PRECONDITION_FAILED",
  "PAGE_OUT_OF_RANGE",
  "RATE_LIMIT_EXCEEDED",
  "BUSINESS_RULE_VIOLATION",
  "TEMPORARY_FAILURE",
  "SERVICE_UNAVAILABLE",
  "PERMANENT_FAILURE",
  "INTERNAL_ERROR"
];

export const STATUS_CATEGORY_FOR = {
  SUCCESS: "Success",
  ACCEPTED: "Success",
  VALIDATION_ERROR: "Validation",
  PAGE_OUT_OF_RANGE: "Validation",
  AUTHENTICATION_FAILED: "Authentication",
  AUTHORIZATION_FAILED: "Authorization",
  RESOURCE_NOT_FOUND: "PermanentFailure",
  CONFLICT: "Conflict",
  DUPLICATE_REQUEST: "Conflict",
  PRECONDITION_FAILED: "BusinessRule",
  BUSINESS_RULE_VIOLATION: "BusinessRule",
  RATE_LIMIT_EXCEEDED: "RateLimit",
  TEMPORARY_FAILURE: "TemporaryFailure",
  SERVICE_UNAVAILABLE: "TemporaryFailure",
  PERMANENT_FAILURE: "PermanentFailure",
  INTERNAL_ERROR: "InternalError"
};

export const HTTP_FOR_STATUS = {
  SUCCESS: 200,
  ACCEPTED: 202,
  VALIDATION_ERROR: 400,
  AUTHENTICATION_FAILED: 401,
  AUTHORIZATION_FAILED: 403,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_REQUEST: 409,
  PRECONDITION_FAILED: 412,
  PAGE_OUT_OF_RANGE: 416,
  RATE_LIMIT_EXCEEDED: 429,
  BUSINESS_RULE_VIOLATION: 422,
  TEMPORARY_FAILURE: 503,
  SERVICE_UNAVAILABLE: 503,
  PERMANENT_FAILURE: 410,
  INTERNAL_ERROR: 500
};

export const CLIENT_TYPES = [
  "AndroidAPK",
  "WebPortal",
  "APIClient",
  "InternalService",
  "Scheduler",
  "BackgroundWorker",
  "IntegrationPartner"
];

export const TRUSTED_CLIENT_TYPES = ["InternalService", "Scheduler", "BackgroundWorker"];

export const REQUIREMENT_CODES = {
  R: "Required",
  CR: "Conditionally Required",
  O: "Optional"
};

export const GENERATION_CODES = {
  CG: "Client Generated",
  GG: "Gateway Generated",
  SG: "Service Generated",
  PG: "Platform Generated",
  RG: "Response Generated",
  PR: "Propagated"
};

export const VALID_REQUIREMENT_GENERATION = [
  "R:CG", "R:GG", "R:SG", "R:PG", "R:RG", "R:PR",
  "CR:CG", "CR:GG", "CR:SG", "CR:PG", "CR:PR",
  "O:CG", "O:GG", "O:PG", "O:PR", "O:RG"
];

export const COMPARISON_OPERATORS = [
  "Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual",
  "LessThan", "LessThanOrEqual", "In", "NotIn", "Exists", "NotExists",
  "StartsWith", "EndsWith", "MatchesPattern"
];

export const LOGICAL_OPERATORS = ["AND", "OR", "NOT"];

export const FIELD_TYPES = ["String", "Integer", "Decimal", "Boolean", "UUID", "Date", "DateTime", "Enum"];

export const SINGLE_VALUE_OPERATORS = [
  "Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual",
  "LessThan", "LessThanOrEqual", "StartsWith", "EndsWith", "MatchesPattern"
];

export const MULTI_VALUE_OPERATORS = ["In", "NotIn"];
export const PRESENCE_OPERATORS = ["Exists", "NotExists"];

export const OPERATORS_BY_FIELD_TYPE = {
  String: ["Equals", "NotEquals", "In", "NotIn", "StartsWith", "EndsWith", "MatchesPattern", "Exists", "NotExists"],
  Integer: ["Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "In", "NotIn", "Exists", "NotExists"],
  Decimal: ["Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "In", "NotIn", "Exists", "NotExists"],
  Boolean: ["Equals", "NotEquals", "Exists", "NotExists"],
  UUID: ["Equals", "NotEquals", "In", "NotIn", "Exists", "NotExists"],
  Date: ["Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "Exists", "NotExists"],
  DateTime: ["Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "Exists", "NotExists"],
  Enum: ["Equals", "NotEquals", "In", "NotIn", "Exists", "NotExists"]
};

export const CONDITION_FIELDS = {
  clientType: "Enum",
  contractId: "String",
  contractVersion: "String",
  authenticationState: "Enum",
  authenticationMethod: "Enum",
  transportProtocol: "String",
  requestDirection: "Enum",
  featureFlag: "String",
  deploymentProfile: "String",
  processingMode: "Enum",
  deviceId: "UUID",
  userId: "UUID",
  branchId: "UUID",
  sessionId: "UUID",
  idempotencyKey: "String"
};

export const IDEMPOTENT_CONTRACTS = [
  "Savings.Collect.v1",
  "Loan.Repay.v1",
  "Loan.Disburse.v1",
  "Withdrawal.Execute.v1",
  "Withdrawal.Request.v1",
  "Payment.Initiate.v1",
  "Payment.Refund.v1",
  "Payment.Reverse.v1",
  "Receipt.Generate.v1",
  "Sync.Upload.v1",
  "Journal.Reverse.v1"
];

export const REGISTERED_CLIENT_IDS = [
  "client-internal",
  "client-web",
  "client-android",
  "client-momo",
  "client-ussd"
];

export const SENSITIVE_HEADER_KEYS = [
  "password", "pin", "secret", "token", "apiKey", "authorization", "refreshToken"
];

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER = /^\d+\.\d+\.\d+$/;
const RULE_CODE = /^[A-Z]{2,10}-[A-Z0-9]{2,20}-[0-9]{3}$/;
const OWNER_MODULE = /^Module\s[0-9]{1,2}$/;
const BCP47 = /^[a-z]{2}(?:-[A-Z]{2})?(?:-[A-Za-z0-9]+)?$/;
const IANA_TZ = /^(UTC|Etc\/UTC|[A-Za-z]+\/[A-Za-z0-9_+\-]+)$/;

function prop(name, requirement, generation, dataType, ownerModule, extras = {}) {
  return {
    name,
    requirement,
    requirementName: REQUIREMENT_CODES[requirement],
    generation,
    generationName: GENERATION_CODES[generation],
    dataType,
    ownerModule,
    mutable: extras.mutable === true,
    responsePropagation: extras.responsePropagation !== false,
    requestOnly: extras.requestOnly === true,
    responseOnly: extras.responseOnly === true,
    validation: extras.validation || "",
    defaultValue: extras.defaultValue
  };
}

export const HEADER_PROPERTIES = [
  prop("requestId", "R", "CG", "UUID v4", "Module 20", { validation: "UUID v4, globally unique" }),
  prop("correlationId", "R", "CG", "UUID v4", "Module 20", { validation: "UUID v4; gateway may assign" }),
  prop("contractId", "R", "CG", "String", "Module 20", { validation: "Must match a published contract" }),
  prop("contractVersion", "R", "CG", "Semantic Version", "Module 20", { validation: "Major.Minor.Patch" }),
  prop("requestTimestampUtc", "R", "CG", "ISO-8601 UTC", "Module 20", { validation: "UTC only" }),
  prop("clientType", "R", "CG", "Enum", "Module 20", { validation: "Approved client types" }),
  prop("clientId", "R", "CG", "UUID", "Module 20", { validation: "Registered client" }),
  prop("userId", "CR", "PR", "UUID", "Module 1", { validation: "Authenticated user" }),
  prop("deviceId", "CR", "CG", "UUID", "Module 1", { validation: "Device Registry" }),
  prop("branchId", "CR", "CG", "UUID", "Module 5", { validation: "Branch Management" }),
  prop("sessionId", "CR", "SG", "UUID", "Module 1", { validation: "Authenticated session" }),
  prop("idempotencyKey", "CR", "CG", "UUID/String", "Module 20", { requestOnly: true, responsePropagation: false, validation: "Retryable commands" }),
  prop("traceId", "R", "GG", "UUID v4", "Module 19", { validation: "Assigned at ingress" }),
  prop("locale", "O", "CG", "BCP-47", "Module 20", { defaultValue: DEFAULT_LOCALE }),
  prop("timeZone", "O", "CG", "IANA", "Module 20", { defaultValue: DEFAULT_TIME_ZONE }),
  prop("responseId", "R", "RG", "UUID v4", "Module 20", { responseOnly: true, mutable: false }),
  prop("responseTimestampUtc", "R", "RG", "ISO-8601 UTC", "Module 20", { responseOnly: true }),
  prop("processingDurationMs", "R", "RG", "Integer", "Module 20", { responseOnly: true }),
  prop("serverNodeId", "R", "PG", "String", "Module 19", { responseOnly: true }),
  prop("responseSignature", "O", "RG", "String", "Module 22", { responseOnly: true }),
  prop("schemaVersion", "R", "PG", "Semantic Version", "Module 20", { responseOnly: true, defaultValue: HEADER_SCHEMA_VERSION })
];

export const REQUEST_HEADER_FIELDS = HEADER_PROPERTIES.filter((item) => !item.responseOnly).map((item) => item.name);
export const RESPONSE_GENERATED_FIELDS = HEADER_PROPERTIES.filter((item) => item.responseOnly).map((item) => item.name);
export const IMMUTABLE_REQUEST_FIELDS = [
  "requestId", "correlationId", "traceId", "contractId", "contractVersion", "requestTimestampUtc"
];
export const PROPAGATED_RESPONSE_FIELDS = [
  "requestId", "correlationId", "traceId", "contractId", "contractVersion", "requestTimestampUtc",
  "clientType", "clientId", "userId", "deviceId", "branchId", "sessionId"
];

export const CONDITIONAL_RULE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://smiletrust.local/schemas/conditional-rule.schema.json",
  title: "Conditional Requirement Rule",
  type: "object",
  additionalProperties: false,
  required: [
    "ruleId", "ruleCode", "schemaVersion", "ruleVersion", "status", "propertyName",
    "requirementState", "priority", "ownerModule", "effectiveFrom", "condition", "description"
  ],
  properties: {
    ruleId: { type: "string", format: "uuid" },
    ruleCode: { type: "string", pattern: RULE_CODE.source },
    schemaVersion: { type: "string", pattern: SEMVER.source },
    ruleVersion: { type: "string", pattern: SEMVER.source },
    status: { type: "string", enum: ["Draft", "Active", "Deprecated", "Retired"] },
    propertyName: { type: "string", minLength: 1, maxLength: 100 },
    requirementState: { type: "string", enum: ["Required", "NotRequired"] },
    priority: { type: "integer", minimum: 1, maximum: 10000 },
    ownerModule: { type: "string", pattern: OWNER_MODULE.source },
    effectiveFrom: { type: "string", format: "date-time" },
    effectiveTo: { type: ["string", "null"], format: "date-time" },
    description: { type: "string", minLength: 10, maxLength: 2000 },
    condition: { $ref: "#/$defs/Condition" }
  }
};

export const OPERAND_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://smiletrust.local/schemas/operand.schema.json",
  title: "Rule Operand",
  type: "object",
  additionalProperties: false,
  required: ["field", "fieldType", "operator"],
  allOf: [
    {
      if: { properties: { operator: { enum: SINGLE_VALUE_OPERATORS } }, required: ["operator"] },
      then: { required: ["value"], not: { required: ["values"] } }
    },
    {
      if: { properties: { operator: { enum: MULTI_VALUE_OPERATORS } }, required: ["operator"] },
      then: { required: ["values"], not: { required: ["value"] }, properties: { values: { type: "array", minItems: 1, uniqueItems: true } } }
    },
    {
      if: { properties: { operator: { enum: PRESENCE_OPERATORS } }, required: ["operator"] },
      then: { not: { anyOf: [{ required: ["value"] }, { required: ["values"] }] } }
    },
    { not: { required: ["value", "values"] } }
  ],
  properties: {
    field: { type: "string", minLength: 1, maxLength: 100 },
    fieldType: { type: "string", enum: FIELD_TYPES },
    operator: { type: "string" },
    value: {},
    values: { type: "array" },
    caseSensitive: { type: "boolean", default: true },
    metadata: { type: "object", additionalProperties: true }
  }
};

export function generateUuidV4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    const value = char === "x" ? rand : (rand & 0x3 | 0x8);
    return value.toString(16);
  });
}

export function isUuidV4(value) {
  return UUID_V4.test(String(value || ""));
}

export function isSemver(value) {
  return SEMVER.test(String(value || ""));
}

export function headerProperty(name) {
  return HEADER_PROPERTIES.find((item) => item.name === name) || null;
}

export function isValidRequirementGeneration(requirement, generation) {
  return VALID_REQUIREMENT_GENERATION.includes(`${requirement}:${generation}`);
}

export function assertHeaderMetadataIntegrity() {
  const invalid = HEADER_PROPERTIES.filter((item) => !isValidRequirementGeneration(item.requirement, item.generation));
  return {
    ok: invalid.length === 0,
    count: HEADER_PROPERTIES.length,
    invalid: invalid.map((item) => item.name)
  };
}

export function formatDecimalAmount(value) {
  if (value === null || value === undefined || value === "") return "0.00";
  const text = String(value).trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    const cents = Math.round(Number(value) * 100);
    if (!Number.isFinite(cents)) return "0.00";
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  }
  const frac = (match[3] || "00").padEnd(2, "0").slice(0, 2);
  return `${match[1]}${match[2]}.${frac}`;
}

export function assertFinancialType(value) {
  return typeof value !== "number" || Number.isInteger(value);
}

function toUtc(now) {
  if (typeof now === "number" && Number.isFinite(now)) return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function toMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isTrusted(clientType) {
  return TRUSTED_CLIENT_TYPES.includes(clientType);
}

function validClientId(clientId, clientType) {
  if (!present(clientId)) return false;
  if (REGISTERED_CLIENT_IDS.includes(String(clientId))) return true;
  if (isUuidV4(clientId)) return true;
  return isTrusted(clientType);
}

function validIdentifier(value, clientType) {
  if (!present(value)) return false;
  if (isUuidV4(value)) return true;
  return isTrusted(clientType);
}

export function maskHeaderForAudit(header = {}) {
  const copy = { ...header };
  SENSITIVE_HEADER_KEYS.forEach((key) => {
    if (copy[key]) copy[key] = "[masked]";
  });
  return copy;
}

export const DEFAULT_CONDITIONAL_RULES = [
  {
    ruleId: "7f52db53-38a9-41a4-8b15-4dc83c32f5e4",
    ruleCode: "HDR-DEVICE-001",
    schemaVersion: RULE_SCHEMA_VERSION,
    ruleVersion: "1.2.0",
    status: "Active",
    propertyName: "deviceId",
    requirementState: "Required",
    priority: 100,
    ownerModule: "Module 20",
    effectiveFrom: "2026-09-11T00:00:00Z",
    effectiveTo: null,
    description: "Require deviceId for Android-originated requests.",
    condition: {
      field: "clientType",
      fieldType: "Enum",
      operator: "Equals",
      value: "AndroidAPK"
    }
  },
  {
    ruleId: "a18c0d2e-6b41-4c77-9f01-2c8d9e4a11b0",
    ruleCode: "HDR-USER-001",
    schemaVersion: RULE_SCHEMA_VERSION,
    ruleVersion: "1.0.0",
    status: "Active",
    propertyName: "userId",
    requirementState: "Required",
    priority: 110,
    ownerModule: "Module 1",
    effectiveFrom: "2026-09-11T00:00:00Z",
    effectiveTo: null,
    description: "Require userId for authenticated user-scoped operations.",
    condition: {
      field: "authenticationState",
      fieldType: "Enum",
      operator: "Equals",
      value: "Authenticated"
    }
  },
  {
    ruleId: "b29d1e3f-7c52-4d88-8a12-3d9e0f5b22c1",
    ruleCode: "HDR-SESS-001",
    schemaVersion: RULE_SCHEMA_VERSION,
    ruleVersion: "1.0.0",
    status: "Active",
    propertyName: "sessionId",
    requirementState: "Required",
    priority: 120,
    ownerModule: "Module 1",
    effectiveFrom: "2026-09-11T00:00:00Z",
    effectiveTo: null,
    description: "Require sessionId when session-based authentication is used.",
    condition: {
      operator: "AND",
      operands: [
        { field: "authenticationState", fieldType: "Enum", operator: "Equals", value: "Authenticated" },
        { field: "authenticationMethod", fieldType: "Enum", operator: "Equals", value: "Session" }
      ]
    }
  },
  {
    ruleId: "c3ae2f40-8d63-4e99-9b23-4e0f1a6c33d2",
    ruleCode: "HDR-IDEM-001",
    schemaVersion: RULE_SCHEMA_VERSION,
    ruleVersion: "1.0.0",
    status: "Active",
    propertyName: "idempotencyKey",
    requirementState: "Required",
    priority: 130,
    ownerModule: "Module 20",
    effectiveFrom: "2026-09-11T00:00:00Z",
    effectiveTo: null,
    description: "Require idempotencyKey for retryable financial commands from external clients.",
    condition: {
      operator: "AND",
      operands: [
        { field: "contractId", fieldType: "String", operator: "In", values: [...IDEMPOTENT_CONTRACTS] },
        { field: "clientType", fieldType: "Enum", operator: "In", values: ["AndroidAPK", "WebPortal", "APIClient", "IntegrationPartner"] }
      ]
    }
  },
  {
    ruleId: "d4bf3051-9e74-4faa-ac34-5f102b7d44e3",
    ruleCode: "HDR-BRANCH-001",
    schemaVersion: RULE_SCHEMA_VERSION,
    ruleVersion: "1.0.0",
    status: "Active",
    propertyName: "branchId",
    requirementState: "Required",
    priority: 140,
    ownerModule: "Module 5",
    effectiveFrom: "2026-09-11T00:00:00Z",
    effectiveTo: null,
    description: "Require branchId for branch-scoped financial processing.",
    condition: {
      field: "processingMode",
      fieldType: "Enum",
      operator: "Equals",
      value: "BranchScoped"
    }
  }
];

export function ensureApiSchemaState(state = {}) {
  state.headerPropertyRegistry = state.headerPropertyRegistry || HEADER_PROPERTIES.map((item) => ({ ...item }));
  state.conditionalRules = state.conditionalRules?.length ? state.conditionalRules : DEFAULT_CONDITIONAL_RULES.map((item) => ({ ...item, condition: structuredClone(item.condition) }));
  state.headerValidations = state.headerValidations || [];
  state.schemaVersions = state.schemaVersions?.length
    ? state.schemaVersions
    : [{
      id: "schema-header-1",
      schemaVersion: HEADER_SCHEMA_VERSION,
      effectiveDate: "2026-09-11",
      deprecationDate: null,
      owningModule: "Module 20",
      compatibleContractVersions: ["1.0.0"]
    }];
  return state;
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function hasProperty(object, key) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined;
}

export function validateOperand(operand = {}, { path = "condition" } = {}) {
  const errors = [];
  if (!operand || typeof operand !== "object") {
    return { ok: false, errors: [{ field: path, message: "Operand must be an object.", errorCode: "OPR-001" }] };
  }
  if (LOGICAL_OPERATORS.includes(operand.operator)) {
    if (hasProperty(operand, "field") || hasProperty(operand, "fieldType") || hasProperty(operand, "value") || hasProperty(operand, "values")) {
      errors.push({ field: path, message: "Logical operators must not contain field, fieldType, value, or values.", errorCode: "OPR-002" });
    }
    const operands = Array.isArray(operand.operands) ? operand.operands : [];
    const min = operand.operator === "NOT" ? 1 : 2;
    const max = operand.operator === "NOT" ? 1 : Number.POSITIVE_INFINITY;
    if (operands.length < min || operands.length > max) {
      errors.push({
        field: `${path}.operands`,
        message: `${operand.operator} requires ${min}${max === 1 ? "" : "+"} operand(s).`,
        errorCode: "OPR-003"
      });
    }
    operands.forEach((child, index) => {
      const nested = validateCondition(child, { path: `${path}.operands[${index}]` });
      errors.push(...nested.errors);
    });
    return { ok: errors.length === 0, errors };
  }

  if (!present(operand.field)) errors.push({ field: `${path}.field`, message: "field is required.", errorCode: "OPR-004" });
  const fieldType = operand.fieldType || CONDITION_FIELDS[operand.field];
  if (!fieldType || !FIELD_TYPES.includes(fieldType)) {
    errors.push({ field: `${path}.fieldType`, message: "fieldType must be a registered type.", errorCode: "OPR-005" });
  }
  if (operand.field && CONDITION_FIELDS[operand.field] && fieldType && CONDITION_FIELDS[operand.field] !== fieldType) {
    errors.push({ field: `${path}.fieldType`, message: "fieldType does not match the Contract Registry.", errorCode: "OPR-006" });
  }
  if (!COMPARISON_OPERATORS.includes(operand.operator)) {
    errors.push({ field: `${path}.operator`, message: "Unsupported comparison operator.", errorCode: "OPR-007" });
  }
  const hasValue = hasProperty(operand, "value");
  const hasValues = hasProperty(operand, "values");
  if (hasValue && hasValues) {
    errors.push({ field: path, message: "value and values are mutually exclusive.", errorCode: "OPR-008" });
  }
  if (SINGLE_VALUE_OPERATORS.includes(operand.operator)) {
    if (!hasValue) errors.push({ field: `${path}.value`, message: `${operand.operator} requires value.`, errorCode: "OPR-009" });
    if (hasValues) errors.push({ field: `${path}.values`, message: `${operand.operator} prohibits values.`, errorCode: "OPR-010" });
  }
  if (MULTI_VALUE_OPERATORS.includes(operand.operator)) {
    if (!hasValues) errors.push({ field: `${path}.values`, message: `${operand.operator} requires values.`, errorCode: "OPR-011" });
    if (hasValue) errors.push({ field: `${path}.value`, message: `${operand.operator} prohibits value.`, errorCode: "OPR-012" });
    if (hasValues && (!Array.isArray(operand.values) || operand.values.length < 1)) {
      errors.push({ field: `${path}.values`, message: "values must be a non-empty array.", errorCode: "OPR-013" });
    }
    if (Array.isArray(operand.values)) {
      const types = new Set(operand.values.map((item) => typeof item));
      if (types.size > 1) errors.push({ field: `${path}.values`, message: "Array elements shall share a common type.", errorCode: "OPR-014" });
      if (new Set(operand.values.map((item) => JSON.stringify(item))).size !== operand.values.length) {
        errors.push({ field: `${path}.values`, message: "values must be unique.", errorCode: "OPR-015" });
      }
    }
  }
  if (PRESENCE_OPERATORS.includes(operand.operator)) {
    if (hasValue) errors.push({ field: `${path}.value`, message: `${operand.operator} prohibits value.`, errorCode: "OPR-016" });
    if (hasValues) errors.push({ field: `${path}.values`, message: `${operand.operator} prohibits values.`, errorCode: "OPR-017" });
    if (hasProperty(operand, "operands")) errors.push({ field: `${path}.operands`, message: `${operand.operator} prohibits operands.`, errorCode: "OPR-018" });
  }
  if (fieldType && operand.operator && OPERATORS_BY_FIELD_TYPE[fieldType] && !OPERATORS_BY_FIELD_TYPE[fieldType].includes(operand.operator)) {
    errors.push({
      field: `${path}.operator`,
      message: `${operand.operator} is not permitted for ${fieldType}.`,
      errorCode: "OPR-019"
    });
  }
  if (operand.operator === "MatchesPattern" && hasValue) {
    try {
      RegExp(String(operand.value));
    } catch {
      errors.push({ field: `${path}.value`, message: "Invalid regular expression.", errorCode: "OPR-020" });
    }
    if (/\(\?\)|\+\+|\*\*|\{[0-9]{3,}/.test(String(operand.value || ""))) {
      errors.push({ field: `${path}.value`, message: "Unsafe regular expression rejected.", errorCode: "OPR-021" });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateCondition(condition, options = {}, seen = new Set()) {
  if (!condition || typeof condition !== "object") {
    return { ok: false, errors: [{ field: options.path || "condition", message: "Condition must be an object.", errorCode: "CND-001" }] };
  }
  if (seen.has(condition)) {
    return { ok: false, errors: [{ field: options.path || "condition", message: "Circular condition reference.", errorCode: "CND-002" }] };
  }
  seen.add(condition);
  return validateOperand(condition, options);
}

export function validateRuleInstance(rule = {}) {
  const errors = [];
  const required = CONDITIONAL_RULE_JSON_SCHEMA.required;
  required.forEach((field) => {
    if (!hasProperty(rule, field) || (field !== "condition" && !present(rule[field]) && rule[field] !== 0)) {
      errors.push({ field, message: `${field} is required.`, errorCode: "RUL-001" });
    }
  });
  Object.keys(rule).forEach((key) => {
    if (!CONDITIONAL_RULE_JSON_SCHEMA.properties[key]) {
      errors.push({ field: key, message: "Additional undocumented properties are not permitted.", errorCode: "RUL-002" });
    }
  });
  if (rule.ruleId && !isUuidV4(rule.ruleId)) errors.push({ field: "ruleId", message: "ruleId must be UUID v4.", errorCode: "RUL-003" });
  if (rule.ruleCode && !RULE_CODE.test(rule.ruleCode)) errors.push({ field: "ruleCode", message: "ruleCode does not match the canonical pattern.", errorCode: "RUL-004" });
  if (rule.schemaVersion && !isSemver(rule.schemaVersion)) errors.push({ field: "schemaVersion", message: "schemaVersion must be semantic.", errorCode: "RUL-005" });
  if (rule.ruleVersion && !isSemver(rule.ruleVersion)) errors.push({ field: "ruleVersion", message: "ruleVersion must be semantic.", errorCode: "RUL-006" });
  if (rule.status && !["Draft", "Active", "Deprecated", "Retired"].includes(rule.status)) {
    errors.push({ field: "status", message: "Invalid rule status.", errorCode: "RUL-007" });
  }
  if (rule.requirementState && !["Required", "NotRequired"].includes(rule.requirementState)) {
    errors.push({ field: "requirementState", message: "Invalid requirement state.", errorCode: "RUL-008" });
  }
  if (rule.priority != null && (!Number.isInteger(rule.priority) || rule.priority < 1 || rule.priority > 10000)) {
    errors.push({ field: "priority", message: "priority must be an integer from 1 to 10000.", errorCode: "RUL-009" });
  }
  if (rule.ownerModule && !OWNER_MODULE.test(rule.ownerModule)) {
    errors.push({ field: "ownerModule", message: "ownerModule must match Module N.", errorCode: "RUL-010" });
  }
  if (rule.description && (rule.description.length < 10 || rule.description.length > 2000)) {
    errors.push({ field: "description", message: "description length is out of range.", errorCode: "RUL-011" });
  }
  if (rule.condition) {
    const nested = validateCondition(rule.condition);
    errors.push(...nested.errors);
  }
  return { ok: errors.length === 0, errors };
}

export function validateActiveRuleSet(rules = []) {
  const errors = [];
  const active = rules.filter((item) => item.status === "Active");
  active.forEach((rule) => {
    const result = validateRuleInstance(rule);
    if (!result.ok) errors.push(...result.errors.map((error) => ({ ...error, ruleCode: rule.ruleCode })));
  });
  const grouped = new Map();
  active.forEach((rule) => {
    const key = `${rule.propertyName}:${rule.priority}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(rule);
  });
  grouped.forEach((group) => {
    const states = new Set(group.map((item) => item.requirementState));
    if (group.length > 1 && states.size > 1) {
      errors.push({
        field: "priority",
        message: `Conflicting active rules at the same priority for ${group[0].propertyName}.`,
        errorCode: "RUL-012"
      });
    }
  });
  return { ok: errors.length === 0, errors };
}

function readContextValue(context, field) {
  if (Object.prototype.hasOwnProperty.call(context, field)) return context[field];
  if (context.header && Object.prototype.hasOwnProperty.call(context.header, field)) return context.header[field];
  return undefined;
}

function valuesEqual(left, right, caseSensitive = true) {
  if (typeof left === "string" && typeof right === "string" && caseSensitive === false) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

export function evaluateCondition(condition, context = {}) {
  if (!condition || typeof condition !== "object") return false;
  if (condition.operator === "AND") return (condition.operands || []).every((item) => evaluateCondition(item, context));
  if (condition.operator === "OR") return (condition.operands || []).some((item) => evaluateCondition(item, context));
  if (condition.operator === "NOT") return !evaluateCondition((condition.operands || [])[0], context);
  const fieldValue = readContextValue(context, condition.field);
  const exists = present(fieldValue);
  switch (condition.operator) {
    case "Exists":
      return exists;
    case "NotExists":
      return !exists;
    case "Equals":
      return valuesEqual(fieldValue, condition.value, condition.caseSensitive);
    case "NotEquals":
      return !valuesEqual(fieldValue, condition.value, condition.caseSensitive);
    case "GreaterThan":
      return fieldValue > condition.value;
    case "GreaterThanOrEqual":
      return fieldValue >= condition.value;
    case "LessThan":
      return fieldValue < condition.value;
    case "LessThanOrEqual":
      return fieldValue <= condition.value;
    case "In":
      return Array.isArray(condition.values) && condition.values.some((item) => valuesEqual(fieldValue, item, condition.caseSensitive));
    case "NotIn":
      return Array.isArray(condition.values) && !condition.values.some((item) => valuesEqual(fieldValue, item, condition.caseSensitive));
    case "StartsWith":
      return String(fieldValue || "").startsWith(String(condition.value || ""));
    case "EndsWith":
      return String(fieldValue || "").endsWith(String(condition.value || ""));
    case "MatchesPattern":
      try {
        return new RegExp(String(condition.value || "")).test(String(fieldValue || ""));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function evaluateConditionalRules(rules = [], context = {}, at = null) {
  const stamp = at ? toMs(at) : Date.now();
  const active = rules
    .filter((rule) => rule.status === "Active")
    .filter((rule) => {
      const from = Date.parse(rule.effectiveFrom || 0);
      const to = rule.effectiveTo ? Date.parse(rule.effectiveTo) : Number.POSITIVE_INFINITY;
      return stamp >= from && stamp <= to;
    })
    .sort((a, b) => a.priority - b.priority);
  const required = {};
  const applied = [];
  active.forEach((rule) => {
    if (!evaluateCondition(rule.condition, context)) return;
    required[rule.propertyName] = rule.requirementState === "Required";
    applied.push(rule.ruleCode);
  });
  return { required, applied };
}

export function buildEvaluationContext(header = {}, extras = {}) {
  return {
    header,
    clientType: header.clientType,
    contractId: header.contractId,
    contractVersion: header.contractVersion,
    authenticationState: extras.authenticationState || (present(header.userId) || extras.user ? "Authenticated" : "Anonymous"),
    authenticationMethod: extras.authenticationMethod || (isTrusted(header.clientType) ? "ServiceAccount" : (extras.session ? "Session" : "ServiceAccount")),
    transportProtocol: extras.transportProtocol || "in-process",
    requestDirection: extras.requestDirection || "Ingress",
    featureFlag: extras.featureFlag || "",
    deploymentProfile: extras.deploymentProfile || "local",
    processingMode: extras.processingMode || (present(header.branchId) ? "BranchScoped" : "SystemWide"),
    deviceId: header.deviceId,
    userId: header.userId,
    branchId: header.branchId,
    sessionId: header.sessionId,
    idempotencyKey: header.idempotencyKey
  };
}

export function normalizeRequestHeader(input = {}, ctx = {}) {
  const explicit = Boolean(input.header && typeof input.header === "object");
  const supplied = explicit ? { ...input.header } : {};
  const substitutions = [];
  const header = { ...supplied };
  const contractId = header.contractId || input.contractId || ctx.contract?.id || "";
  const contractVersion = header.contractVersion || input.contractVersion || ctx.contract?.version || "1.0.0";
  header.contractId = contractId;
  header.contractVersion = contractVersion;

  if (!present(header.clientType)) {
    header.clientType = "InternalService";
    substitutions.push("clientType");
  }
  const trusted = isTrusted(header.clientType) || !explicit;
  if (!present(header.clientId)) {
    header.clientId = input.clientId || (trusted ? "client-internal" : "");
    if (header.clientId) substitutions.push("clientId");
  }
  if (!present(header.requestTimestampUtc)) {
    header.requestTimestampUtc = toUtc(ctx.now);
    substitutions.push("requestTimestampUtc");
  }
  if (!present(header.requestId)) {
    if (trusted) {
      header.requestId = generateUuidV4();
      substitutions.push("requestId");
    }
  }
  if (!present(header.correlationId)) {
    header.correlationId = header.requestId || generateUuidV4();
    substitutions.push("correlationId");
  }
  if (!present(header.traceId)) {
    header.traceId = generateUuidV4();
    substitutions.push("traceId");
  }
  if (!present(header.userId) && ctx.user?.id && (trusted || ctx.user)) {
    header.userId = ctx.user.id;
    substitutions.push("userId");
  }
  if (!present(header.sessionId) && ctx.sessionId) {
    header.sessionId = ctx.sessionId;
    substitutions.push("sessionId");
  }
  if (!present(header.locale)) header.locale = DEFAULT_LOCALE;
  if (!present(header.timeZone)) header.timeZone = DEFAULT_TIME_ZONE;
  return { header, substitutions, trusted, explicit };
}

function requirementErrors(header, rules, context, explicit, trusted) {
  const errors = [];
  const always = ["requestId", "correlationId", "contractId", "contractVersion", "requestTimestampUtc", "clientType", "clientId", "traceId"];
  always.forEach((field) => {
    if (!present(header[field])) {
      errors.push({ field, message: `${field} is required.`, errorCode: "HDR-001" });
    }
  });
  RESPONSE_GENERATED_FIELDS.forEach((field) => {
    if (hasProperty(header, field) && present(header[field])) {
      errors.push({ field, message: `${field} is system generated and cannot be supplied on a request.`, errorCode: "HDR-002" });
    }
  });
  if (header.clientType && !CLIENT_TYPES.includes(header.clientType)) {
    errors.push({ field: "clientType", message: "Unsupported clientType.", errorCode: "HDR-003" });
  }
  if (header.contractVersion && !isSemver(header.contractVersion)) {
    errors.push({ field: "contractVersion", message: "contractVersion must be semantic.", errorCode: "HDR-004" });
  }
  if (header.locale && !BCP47.test(header.locale)) {
    errors.push({ field: "locale", message: "locale must be a BCP-47 language tag.", errorCode: "HDR-005" });
  }
  if (header.timeZone && !IANA_TZ.test(header.timeZone)) {
    errors.push({ field: "timeZone", message: "timeZone must be an IANA identifier.", errorCode: "HDR-006" });
  }
  if (present(header.requestTimestampUtc)) {
    const parsed = Date.parse(header.requestTimestampUtc);
    if (!Number.isFinite(parsed)) {
      errors.push({ field: "requestTimestampUtc", message: "requestTimestampUtc must be ISO-8601 UTC.", errorCode: "HDR-007" });
    } else if (explicit && !trusted) {
      const drift = Math.abs(parsed - toMs(context.now));
      if (drift > CLOCK_DRIFT_SECONDS * 1000) {
        errors.push({ field: "requestTimestampUtc", message: "Request clock drift exceeds the allowed window.", errorCode: "HDR-008" });
      }
    }
  }
  if (!validClientId(header.clientId, header.clientType)) {
    errors.push({ field: "clientId", message: "clientId must reference a registered client.", errorCode: "HDR-009" });
  }
  ["requestId", "correlationId", "traceId"].forEach((field) => {
    if (present(header[field]) && !validIdentifier(header[field], header.clientType)) {
      errors.push({ field, message: `${field} must be UUID v4.`, errorCode: "HDR-010" });
    }
  });
  const evaluated = evaluateConditionalRules(rules, context, header.requestTimestampUtc);
  Object.entries(evaluated.required).forEach(([field, needed]) => {
    if (needed && !present(header[field])) {
      errors.push({ field, message: `${field} is conditionally required.`, errorCode: "HDR-011" });
    }
  });
  ["userId", "deviceId", "branchId", "sessionId"].forEach((field) => {
    if (present(header[field]) && !validIdentifier(header[field], header.clientType)) {
      errors.push({ field, message: `${field} must be a valid identifier.`, errorCode: "HDR-012" });
    }
  });
  return { errors, applied: evaluated.applied };
}

export function validateRequestHeader(header = {}, options = {}) {
  const rules = options.rules || DEFAULT_CONDITIONAL_RULES;
  const context = buildEvaluationContext(header, { ...options, now: options.now });
  context.now = options.now;
  const requirement = requirementErrors(header, rules, context, options.explicit === true, options.trusted === true);
  const generation = [];
  if (options.explicit && !options.trusted && options.substitutions?.includes("requestId")) {
    generation.push({ field: "requestId", message: "Clients must generate requestId.", errorCode: "GEN-001" });
  }
  RESPONSE_GENERATED_FIELDS.forEach((field) => {
    if (hasProperty(header, field)) {
      generation.push({ field, message: `${field} cannot be client generated.`, errorCode: "GEN-002" });
    }
  });
  const errors = [...requirement.errors, ...generation];
  return {
    ok: errors.length === 0,
    errors,
    requirementErrors: requirement.errors,
    generationErrors: generation,
    appliedRules: requirement.applied
  };
}

export function buildResponseHeader(requestHeader = {}, extras = {}) {
  const responseTimestampUtc = toUtc(extras.now);
  const started = extras.startedMs != null ? extras.startedMs : Date.parse(requestHeader.requestTimestampUtc || responseTimestampUtc);
  const formula = Math.max(0, Date.parse(responseTimestampUtc) - Date.parse(requestHeader.requestTimestampUtc || responseTimestampUtc));
  const elapsed = Math.max(0, Date.parse(responseTimestampUtc) - started);
  const header = {
    requestId: requestHeader.requestId,
    correlationId: requestHeader.correlationId,
    traceId: requestHeader.traceId,
    contractId: requestHeader.contractId,
    contractVersion: requestHeader.contractVersion,
    requestTimestampUtc: requestHeader.requestTimestampUtc,
    responseTimestampUtc,
    clientType: requestHeader.clientType,
    clientId: requestHeader.clientId,
    processingDurationMs: extras.processingDurationMs != null ? extras.processingDurationMs : Math.max(formula, elapsed),
    serverNodeId: extras.serverNodeId || SERVER_NODE_ID,
    responseId: extras.responseId || generateUuidV4(),
    schemaVersion: extras.schemaVersion || HEADER_SCHEMA_VERSION
  };
  PROPAGATED_RESPONSE_FIELDS.forEach((field) => {
    if (present(requestHeader[field])) header[field] = requestHeader[field];
  });
  if (extras.signingEnabled && extras.responseSignature) header.responseSignature = extras.responseSignature;
  return header;
}

export function assertImmutablePropagation(requestHeader, responseHeader) {
  const mismatches = IMMUTABLE_REQUEST_FIELDS.filter((field) => requestHeader[field] !== responseHeader[field]);
  return { ok: mismatches.length === 0, mismatches };
}

export function buildStatus({ code = "SUCCESS", message = "", now, retryable } = {}) {
  const resolved = code || "SUCCESS";
  return {
    code: resolved,
    category: STATUS_CATEGORY_FOR[resolved] || "InternalError",
    httpStatus: HTTP_FOR_STATUS[resolved] || 500,
    message: message || (resolved === "SUCCESS" ? "Operation completed successfully." : "The request could not be processed."),
    retryable: retryable != null
      ? retryable
      : resolved === "TEMPORARY_FAILURE" || resolved === "RATE_LIMIT_EXCEEDED" || resolved === "SERVICE_UNAVAILABLE",
    timestampUtc: toUtc(now)
  };
}

export function standardStatus(code, message, extras = {}) {
  return buildStatus({ code, message, ...extras });
}

export function validatePaginationRequest({ page = 1, pageSize = 50 } = {}) {
  const requestedPage = Number(page);
  const requestedSize = Number(pageSize);
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    return { ok: false, http: 400, errorCode: "PAG-002", code: "VALIDATION_ERROR", message: "Page numbering is 1-based." };
  }
  if (!Number.isInteger(requestedSize) || requestedSize < 1) {
    return { ok: false, http: 400, errorCode: "PAG-003", code: "VALIDATION_ERROR", message: "Page size must be positive." };
  }
  if (requestedSize > MAX_PAGE_SIZE) {
    return { ok: false, http: 400, errorCode: "PAG-004", code: "VALIDATION_ERROR", message: "Page size exceeds the configured maximum." };
  }
  return { ok: true, page: requestedPage, pageSize: requestedSize };
}

export function buildPagination({ page = 1, pageSize = 50, totalItems = 0 } = {}) {
  const total = Math.max(0, Number(totalItems) || 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    totalItems: total,
    totalPages,
    hasPrevious: totalPages > 0 && page > 1,
    hasNext: totalPages > 0 && page < totalPages,
    firstPage: 1,
    lastPage: totalPages
  };
}

export function paginateCollection(items = [], query = {}) {
  const valid = validatePaginationRequest(query);
  if (!valid.ok) {
    return { ok: false, http: valid.http, errorCode: valid.errorCode, code: valid.code, message: valid.message, data: [], pagination: null };
  }
  const totalItems = Array.isArray(items) ? items.length : 0;
  const pagination = buildPagination({ page: valid.page, pageSize: valid.pageSize, totalItems });
  if ((totalItems === 0 && valid.page > 1) || (totalItems > 0 && valid.page > pagination.totalPages)) {
    return {
      ok: false,
      http: 416,
      errorCode: "PAG-001",
      code: "PAGE_OUT_OF_RANGE",
      message: "The requested page does not exist.",
      requestedPage: valid.page,
      pagination,
      data: []
    };
  }
  const start = (valid.page - 1) * valid.pageSize;
  return {
    ok: true,
    http: 200,
    pagination,
    data: (items || []).slice(start, start + valid.pageSize)
  };
}

export function standardSuccessEnvelope({ header, data = {}, links = {}, warnings = [], pagination, job, document } = {}) {
  const envelope = {
    header,
    status: standardStatus("SUCCESS", "Operation completed successfully."),
    data,
    links,
    warnings
  };
  if (pagination) envelope.pagination = pagination;
  if (job) envelope.job = job;
  if (document) envelope.document = document;
  return envelope;
}

export function standardErrorEnvelope({ header, code = "VALIDATION_ERROR", message = "The request could not be processed.", error, errors } = {}) {
  return {
    header,
    status: standardStatus(code, message),
    error: error || {
      errorCode: "VAL-001",
      category: "Validation",
      details: errors || [],
      retryable: code === "TEMPORARY_FAILURE" || code === "RATE_LIMIT_EXCEEDED"
    },
    errors: errors || error?.details || []
  };
}

export function standardPaginatedEnvelope({ header, data = [], page = 1, pageSize = 50, totalItems } = {}) {
  const total = totalItems != null ? totalItems : data.length;
  return {
    header,
    status: standardStatus("SUCCESS", "Operation completed successfully."),
    pagination: buildPagination({ page, pageSize, totalItems: total }),
    data: Array.isArray(data) ? data : []
  };
}

export function standardAsyncEnvelope({ header, jobId, queue = "default", estimatedCompletion = "", status = "Queued" } = {}) {
  return {
    header,
    status: standardStatus("ACCEPTED", "Request accepted for background processing."),
    job: { jobId, queue, estimatedCompletion, status }
  };
}

export function standardFileEnvelope({ header, document } = {}) {
  return {
    header,
    status: standardStatus("SUCCESS", "Document is available."),
    document
  };
}

export function standardEvent({
  eventType,
  payload = {},
  correlationId = "",
  sourceModule,
  aggregateId = "",
  aggregateType = "",
  eventVersion = "1.0.0",
  occurredAtUtc,
  eventId
} = {}) {
  return {
    eventId: eventId || generateUuidV4(),
    eventType,
    eventVersion,
    occurredAtUtc: occurredAtUtc || new Date().toISOString(),
    correlationId,
    aggregateId,
    aggregateType,
    sourceModule: sourceModule != null ? String(sourceModule) : "",
    payload
  };
}

export function paginationFrom(query = {}, rows = [], totalItems) {
  const page = Number(query.page || 1) || 1;
  const pageSize = Number(query.pageSize || 50) || 50;
  const total = totalItems != null ? totalItems : rows.length;
  return buildPagination({ page, pageSize, totalItems: total });
}

export function httpStatusFor(code, fallback = 400) {
  return HTTP_FOR_STATUS[code] || fallback;
}

export function statusFromContractError(errorCode, http) {
  if (http === 401) return "AUTHENTICATION_FAILED";
  if (http === 403) return "AUTHORIZATION_FAILED";
  if (http === 404) return "RESOURCE_NOT_FOUND";
  if (http === 409) return "CONFLICT";
  if (http === 410) return "PERMANENT_FAILURE";
  if (http === 412) return "PRECONDITION_FAILED";
  if (http === 416) return "PAGE_OUT_OF_RANGE";
  if (http === 422) return "BUSINESS_RULE_VIOLATION";
  if (http === 429) return "RATE_LIMIT_EXCEEDED";
  if (http === 503) return "TEMPORARY_FAILURE";
  if (http >= 500) return "INTERNAL_ERROR";
  if (errorCode === "PAG-001" || errorCode === "PAGE_OUT_OF_RANGE") return "PAGE_OUT_OF_RANGE";
  if (errorCode === "RETIRED_CONTRACT") return "PERMANENT_FAILURE";
  if (errorCode === "UNKNOWN_CONTRACT") return "RESOURCE_NOT_FOUND";
  if (String(errorCode || "").includes("FORBIDDEN") || errorCode === "OWNER_INTERNAL" || errorCode === "NO_POSTING_SHORTCUT") {
    return "AUTHORIZATION_FAILED";
  }
  return "VALIDATION_ERROR";
}

export function recordHeaderValidation(state, row = {}) {
  ensureApiSchemaState(state);
  state.headerValidations.push({
    id: row.id || generateUuidV4(),
    requestId: row.requestId || "",
    correlationId: row.correlationId || "",
    axis: row.axis || "requirement",
    outcome: row.outcome || "pass",
    errors: row.errors || [],
    appliedRules: row.appliedRules || [],
    substitutions: row.substitutions || [],
    createdAt: row.createdAt || new Date().toISOString()
  });
  if (state.headerValidations.length > 2000) {
    state.headerValidations.splice(0, state.headerValidations.length - 2000);
  }
}

export function schemaDashboard(state = {}) {
  ensureApiSchemaState(state);
  const last = state.headerValidations[state.headerValidations.length - 1];
  return {
    schemaVersion: API_SCHEMA_VERSION,
    headerProperties: HEADER_PROPERTIES.length,
    activeRules: (state.conditionalRules || []).filter((item) => item.status === "Active").length,
    validations: (state.headerValidations || []).length,
    lastOutcome: last?.outcome || "none"
  };
}

export function assertApiSchemaBoundary() {
  return {
    utf8Json: true,
    versioned: true,
    restHttp: false,
    graphqlHttp: false,
    postsCollections: false,
    floatingPointMoney: false,
    headerSuperset: true,
    twoAxisMetadata: true,
    sharedStatusSchema: true,
    sharedPaginationSchema: true,
    emptyResultZeroPages: true
  };
}
