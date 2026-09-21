/**
 * Global Canonical Schema Metadata JSON Schema (Modules 1–27 platform-wide).
 * Every published machine-readable schema must carry validated metadata.
 * Checksum format is lowercase-only per Checksum Format Consistency Resolution.
 */

import {
  SCHEMA_CHECKSUM_PATTERN,
  SCHEMA_CHECKSUM_RE
} from "./schema-checksum.js";

export {
  schemaChecksum,
  canonicalizeSchemaDocument,
  verifySchemaChecksum,
  isCanonicalChecksumFormat,
  isHistoricalChecksumFormat,
  SCHEMA_CHECKSUM_PATTERN,
  SCHEMA_CHECKSUM_RE,
  SCHEMA_CHECKSUM_ALGORITHM
} from "./schema-checksum.js";

export const SCHEMA_METADATA_SCHEMA_ID = "urn:smiletrust:schemas:schema-metadata:v1";
export const SCHEMA_METADATA_SCHEMA_CODE = "SCH-META-001";
export const SCHEMA_METADATA_SCHEMA_VERSION = "1.0.0";

export const SCHEMA_TYPES = [
  "Request", "Response", "Event", "Configuration", "Entity", "Metric", "KPI",
  "Workflow", "Rule", "Import", "Export", "Document", "Security", "Other"
];

export const SCHEMA_STATUSES = ["Draft", "Testing", "Approved", "Published", "Deprecated", "Retired"];
export const SCHEMA_COMPATIBILITY = ["BackwardCompatible", "ForwardCompatible", "BreakingChange"];

export const SCHEMA_METADATA_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCHEMA_METADATA_SCHEMA_ID,
  title: "SchemaMetadata",
  description: "Canonical metadata describing a published platform schema.",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaId", "schemaCode", "schemaName", "schemaType", "version", "status",
    "ownerModule", "owningTeam", "approvalReference", "effectiveFrom",
    "compatibilityLevel", "registryUri", "documentationUri", "checksum",
    "publishedAtUtc", "publishedBy"
  ],
  properties: {
    schemaId: { type: "string", format: "uuid" },
    schemaCode: { type: "string", pattern: "^SCH-[A-Z0-9-]{3,100}$" },
    schemaName: { type: "string", minLength: 1, maxLength: 200 },
    schemaType: { type: "string", enum: SCHEMA_TYPES },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
    status: { type: "string", enum: SCHEMA_STATUSES },
    ownerModule: { type: "string", minLength: 1, maxLength: 100 },
    owningTeam: { type: "string", minLength: 1, maxLength: 150 },
    approvalReference: { type: "string", minLength: 1, maxLength: 100 },
    effectiveFrom: { type: "string", format: "date-time" },
    effectiveTo: { type: ["string", "null"], format: "date-time" },
    compatibilityLevel: { type: "string", enum: SCHEMA_COMPATIBILITY },
    registryUri: { type: "string", format: "uri" },
    documentationUri: { type: "string", format: "uri" },
    checksum: { type: "string", pattern: SCHEMA_CHECKSUM_PATTERN },
    publishedAtUtc: { type: "string", format: "date-time" },
    publishedBy: { type: "string", minLength: 1, maxLength: 100 },
    labels: { type: "object", additionalProperties: { type: "string", maxLength: 100 } },
    tags: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 50 } }
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^SCH-[A-Z0-9-]{3,100}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const URI_RE = /^(urn:|https?:\/\/|docs:\/\/)/i;

function isDateTime(value) {
  if (typeof value !== "string" || !value) return false;
  return Number.isFinite(Date.parse(value));
}

function push(errors, path, message) {
  errors.push({ path, message });
}

export function validateSchemaMetadata(metadata = {}) {
  const errors = [];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ok: false, errors: [{ path: "", message: "Schema metadata must be an object" }], errorCode: "BI-002" };
  }
  const allowed = new Set(Object.keys(SCHEMA_METADATA_JSON_SCHEMA.properties));
  Object.keys(metadata).forEach((key) => {
    if (!allowed.has(key)) push(errors, key, "Unknown property");
  });
  SCHEMA_METADATA_JSON_SCHEMA.required.forEach((key) => {
    if (metadata[key] === undefined || metadata[key] === "") push(errors, key, "Required property missing");
  });
  if (metadata.schemaId != null && !UUID_RE.test(String(metadata.schemaId))) {
    push(errors, "schemaId", "schemaId must be a UUID");
  }
  if (metadata.schemaCode != null && !CODE_RE.test(String(metadata.schemaCode))) {
    push(errors, "schemaCode", "schemaCode must match SCH-*");
  }
  if (metadata.schemaType != null && !SCHEMA_TYPES.includes(metadata.schemaType)) {
    push(errors, "schemaType", "Invalid schemaType");
  }
  if (metadata.version != null && !SEMVER_RE.test(String(metadata.version))) {
    push(errors, "version", "version must be semantic MAJOR.MINOR.PATCH");
  }
  if (metadata.status != null && !SCHEMA_STATUSES.includes(metadata.status)) {
    push(errors, "status", "Invalid status");
  }
  if (metadata.compatibilityLevel != null && !SCHEMA_COMPATIBILITY.includes(metadata.compatibilityLevel)) {
    push(errors, "compatibilityLevel", "Invalid compatibilityLevel");
  }
  if (metadata.effectiveFrom != null && !isDateTime(metadata.effectiveFrom)) {
    push(errors, "effectiveFrom", "effectiveFrom must be date-time");
  }
  if (metadata.effectiveTo != null && metadata.effectiveTo !== null) {
    if (!isDateTime(metadata.effectiveTo)) push(errors, "effectiveTo", "effectiveTo must be date-time or null");
    else if (isDateTime(metadata.effectiveFrom) && Date.parse(metadata.effectiveTo) <= Date.parse(metadata.effectiveFrom)) {
      push(errors, "effectiveTo", "effectiveTo must be later than effectiveFrom");
    }
  }
  if (metadata.registryUri != null && !URI_RE.test(String(metadata.registryUri))) {
    push(errors, "registryUri", "registryUri must be a URI");
  }
  if (metadata.documentationUri != null && !URI_RE.test(String(metadata.documentationUri))) {
    push(errors, "documentationUri", "documentationUri must be a URI");
  }
  if (metadata.checksum != null && !SCHEMA_CHECKSUM_RE.test(String(metadata.checksum))) {
    push(errors, "checksum", "checksum must match SHA-256:<64 lowercase hex>");
  }
  if (metadata.publishedAtUtc != null && !isDateTime(metadata.publishedAtUtc)) {
    push(errors, "publishedAtUtc", "publishedAtUtc must be date-time");
  }
  if (metadata.status === "Published") {
    if (!metadata.publishedAtUtc) push(errors, "publishedAtUtc", "Required when status is Published");
    if (!metadata.publishedBy) push(errors, "publishedBy", "Required when status is Published");
    if (!metadata.checksum) push(errors, "checksum", "Required when status is Published");
  }
  if (metadata.status === "Retired" && (metadata.effectiveTo == null || metadata.effectiveTo === "")) {
    push(errors, "effectiveTo", "Required when status is Retired");
  }
  return errors.length
    ? { ok: false, errors, errorCode: "BI-002" }
    : { ok: true, errors: [], schemaId: SCHEMA_METADATA_SCHEMA_ID };
}

export function assertSchemaMetadataBoundary() {
  return {
    additionalProperties: false,
    restHttp: false,
    postsCollections: false,
    globalGovernance: true
  };
}
