/**
 * Global Canonical KPI Input Metric JSON Schema (Module 27 / platform-wide).
 * Consumed by Metric Registry, KPI Engine, Rule Engine, Analytics, Exchange, APIs.
 * Lightweight validator — no external JSON Schema library.
 */

export const METRIC_DEFINITION_SCHEMA_ID = "urn:smiletrust:schemas:metric-definition:v1";
export const METRIC_DEFINITION_SCHEMA_CODE = "SCH-METRIC-001";
export const METRIC_DEFINITION_SCHEMA_VERSION = "1.0.0";

export const METRIC_DATA_TYPES = [
  "Integer", "Decimal", "Currency", "Percentage", "Count",
  "Duration", "Boolean", "Date", "DateTime", "Enumeration"
];

export const METRIC_AGGREGATIONS = [
  "Sum", "Count", "CountDistinct", "Average", "Minimum", "Maximum",
  "Median", "Latest", "Earliest", "WeightedAverage", "Custom"
];

export const METRIC_GRANULARITIES = [
  "RealTime", "Minute", "Hourly", "Daily", "Weekly", "Monthly", "Quarterly", "Yearly"
];

export const METRIC_ROUNDING = ["None", "RoundHalfUp", "RoundHalfEven", "RoundDown", "RoundUp", "Truncate"];
export const METRIC_MISSING = ["Zero", "Ignore", "Null", "Error", "Interpolate"];

export const METRIC_DEFINITION_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: METRIC_DEFINITION_SCHEMA_ID,
  title: "MetricDefinition",
  description: "Canonical KPI input metric definition.",
  type: "object",
  additionalProperties: false,
  required: [
    "metricId", "metricCode", "metricName", "description", "dataType", "unitOfMeasure",
    "sourceModule", "sourceEntity", "aggregationMethod", "timeGranularity",
    "roundingPolicy", "missingDataPolicy", "version", "effectiveFrom", "ownerModule"
  ],
  properties: {
    metricId: { type: "string", format: "uuid" },
    metricCode: { type: "string", pattern: "^MET-[A-Z]{2,10}-[0-9]{3,6}$" },
    metricName: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    dataType: { type: "string", enum: METRIC_DATA_TYPES },
    unitOfMeasure: { type: "string", minLength: 1, maxLength: 50 },
    sourceModule: { type: "string", minLength: 1, maxLength: 100 },
    sourceEntity: { type: "string", minLength: 1, maxLength: 100 },
    aggregationMethod: { type: "string", enum: METRIC_AGGREGATIONS },
    timeGranularity: { type: "string", enum: METRIC_GRANULARITIES },
    roundingPolicy: { type: "string", enum: METRIC_ROUNDING },
    missingDataPolicy: { type: "string", enum: METRIC_MISSING },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
    effectiveFrom: { type: "string", format: "date-time" },
    effectiveTo: { type: ["string", "null"], format: "date-time" },
    ownerModule: { type: "string", minLength: 1, maxLength: 100 },
    tags: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 50 } },
    labels: { type: "object", additionalProperties: { type: "string", maxLength: 100 } },
    customAggregationExpression: { type: ["string", "null"], maxLength: 5000 }
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^MET-[A-Z]{2,10}-[0-9]{3,6}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function isDateTime(value) {
  if (typeof value !== "string" || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function push(errors, path, message) {
  errors.push({ path, message });
}

export function validateMetricDefinition(definition = {}) {
  const errors = [];
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return { ok: false, errors: [{ path: "", message: "Metric definition must be an object" }], errorCode: "BI-001" };
  }
  const allowed = new Set(Object.keys(METRIC_DEFINITION_JSON_SCHEMA.properties));
  Object.keys(definition).forEach((key) => {
    if (!allowed.has(key)) push(errors, key, "Unknown property");
  });
  METRIC_DEFINITION_JSON_SCHEMA.required.forEach((key) => {
    if (definition[key] === undefined || definition[key] === "") push(errors, key, "Required property missing");
  });
  if (definition.metricId != null && !UUID_RE.test(String(definition.metricId))) {
    push(errors, "metricId", "metricId must be a UUID");
  }
  if (definition.metricCode != null && !CODE_RE.test(String(definition.metricCode))) {
    push(errors, "metricCode", "metricCode must match MET-<CATEGORY>-<NUMBER>");
  }
  if (definition.metricName != null && String(definition.metricName).length > 200) {
    push(errors, "metricName", "metricName exceeds maxLength");
  }
  if (definition.description != null && String(definition.description).length > 2000) {
    push(errors, "description", "description exceeds maxLength");
  }
  if (definition.dataType != null && !METRIC_DATA_TYPES.includes(definition.dataType)) {
    push(errors, "dataType", "Invalid dataType");
  }
  if (definition.aggregationMethod != null && !METRIC_AGGREGATIONS.includes(definition.aggregationMethod)) {
    push(errors, "aggregationMethod", "Invalid aggregationMethod");
  }
  if (definition.timeGranularity != null && !METRIC_GRANULARITIES.includes(definition.timeGranularity)) {
    push(errors, "timeGranularity", "Invalid timeGranularity");
  }
  if (definition.roundingPolicy != null && !METRIC_ROUNDING.includes(definition.roundingPolicy)) {
    push(errors, "roundingPolicy", "Invalid roundingPolicy");
  }
  if (definition.missingDataPolicy != null && !METRIC_MISSING.includes(definition.missingDataPolicy)) {
    push(errors, "missingDataPolicy", "Invalid missingDataPolicy");
  }
  if (definition.version != null && !SEMVER_RE.test(String(definition.version))) {
    push(errors, "version", "version must be semantic MAJOR.MINOR.PATCH");
  }
  if (definition.effectiveFrom != null && !isDateTime(definition.effectiveFrom)) {
    push(errors, "effectiveFrom", "effectiveFrom must be date-time");
  }
  if (definition.effectiveTo != null && definition.effectiveTo !== null) {
    if (!isDateTime(definition.effectiveTo)) push(errors, "effectiveTo", "effectiveTo must be date-time or null");
    else if (isDateTime(definition.effectiveFrom) && Date.parse(definition.effectiveTo) <= Date.parse(definition.effectiveFrom)) {
      push(errors, "effectiveTo", "effectiveTo must be later than effectiveFrom");
    }
  }
  if (definition.aggregationMethod === "Custom") {
    if (!definition.customAggregationExpression || !String(definition.customAggregationExpression).trim()) {
      push(errors, "customAggregationExpression", "Required when aggregationMethod is Custom");
    }
  }
  if (Array.isArray(definition.tags)) {
    const seen = new Set();
    definition.tags.forEach((tag, index) => {
      if (typeof tag !== "string" || !tag || tag.length > 50) push(errors, `tags[${index}]`, "Invalid tag");
      if (seen.has(tag)) push(errors, `tags[${index}]`, "Duplicate tag");
      seen.add(tag);
    });
  } else if (definition.tags != null) {
    push(errors, "tags", "tags must be an array");
  }
  if (definition.labels != null) {
    if (typeof definition.labels !== "object" || Array.isArray(definition.labels)) {
      push(errors, "labels", "labels must be an object");
    } else {
      Object.entries(definition.labels).forEach(([key, value]) => {
        if (typeof value !== "string" || value.length > 100) push(errors, `labels.${key}`, "Invalid label value");
      });
    }
  }
  return errors.length
    ? { ok: false, errors, errorCode: "BI-001" }
    : { ok: true, errors: [], schemaId: METRIC_DEFINITION_SCHEMA_ID };
}

export function assertMetricSchemaBoundary() {
  return {
    additionalProperties: false,
    restHttp: false,
    postsCollections: false,
    machineReadable: true
  };
}
