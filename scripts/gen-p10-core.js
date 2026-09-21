/**
 * Phase 10 EIIECS generator
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
  console.log("wrote", rel);
};

w("src/core/canonical-integration-registry.js", `/**
 * Phase 10 — Enterprise Integration, Interoperability & External Connectivity (EIIECS).
 * Catalog only. Operational engine remains Module 28 integration-ops.js.
 * No live HTTP beyond Module 20 facade; no MoMo PINs / bank passwords.
 */

export const EIIECS_VERSION = "1.0.0";
export const EIIECS_STATUS = "Authoritative";
export const METADATA_SCHEMA_ID = "https://schemas.smiletrust.com/common/metadata.schema.json";

function integ(p) {
  return Object.freeze({
    id: p.id,
    name: p.name,
    category: p.category,
    owningModule: 28,
    gatewayModule: 20,
    providers: Object.freeze([...(p.providers || [])]),
    version: p.version || "1.0.0"
  });
}

function prov(p) {
  return Object.freeze({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    priority: p.priority,
    owningModule: 28,
    authModels: Object.freeze([...(p.authModels || ["api_key", "hmac"])]),
    simulated: true,
    version: "1.0.0"
  });
}

function ep(p) {
  return Object.freeze({
    id: p.id,
    integrationId: p.integrationId,
    method: p.method,
    path: p.path,
    action: p.action,
    owningModule: 28,
    version: "1.0.0"
  });
}

function wh(p) {
  return Object.freeze({
    id: p.id,
    direction: p.direction,
    eventType: p.eventType,
    secretRef: p.secretRef || "settings.momoWebhookSecret",
    owningModule: 28,
    version: "1.0.0"
  });
}

export const INTEGRATIONS = Object.freeze([
  integ({ id: "INT-MOMO", name: "Mobile Money Connectivity", category: "momo", providers: ["PROV-MTN-MOMO", "PROV-VODAFONE-CASH", "PROV-AIRTELTIGO-MONEY"] }),
  integ({ id: "INT-BANK", name: "Bank Rails", category: "bank", providers: ["PROV-GHIPSS"] }),
  integ({ id: "INT-PAYMENT", name: "Payment Aggregators", category: "payment", providers: ["PROV-HUBTEL-PAY"] }),
  integ({ id: "INT-MESSAGING", name: "SMS / Email / Push", category: "messaging", providers: ["PROV-SMS-GATEWAY", "PROV-SMTP-RELAY", "PROV-FCM-PUSH"] }),
  integ({ id: "INT-KYC", name: "KYC / Credit", category: "kyc", providers: ["PROV-NIA-KYC", "PROV-CREDIT-BUREAU-GH"] }),
  integ({ id: "INT-REG", name: "Regulatory / Government", category: "government", providers: ["PROV-GRA-REG", "PROV-REG-REPORTING"] }),
  integ({ id: "INT-ENTERPRISE", name: "ERP / CRM / BI / Cloud", category: "enterprise", providers: ["PROV-ERP-BRIDGE", "PROV-CRM-BRIDGE", "PROV-BI-EXPORT", "PROV-CLOUD-STORE"] })
]);

export const PROVIDERS = Object.freeze([
  prov({ id: "PROV-MTN-MOMO", code: "MTN_MOMO", name: "MTN MoMo", category: "momo", priority: 10 }),
  prov({ id: "PROV-VODAFONE-CASH", code: "VODAFONE_CASH", name: "Vodafone Cash", category: "momo", priority: 20 }),
  prov({ id: "PROV-AIRTELTIGO-MONEY", code: "AIRTELTIGO_MONEY", name: "AirtelTigo Money", category: "momo", priority: 30 }),
  prov({ id: "PROV-GHIPSS", code: "GHIPSS", name: "GhIPSS Bank Rails", category: "bank", priority: 10 }),
  prov({ id: "PROV-HUBTEL-PAY", code: "HUBTEL_PAY", name: "Hubtel Payments", category: "payment", priority: 15 }),
  prov({ id: "PROV-SMS-GATEWAY", code: "SMS_GATEWAY", name: "SMS Gateway", category: "sms", priority: 10 }),
  prov({ id: "PROV-SMTP-RELAY", code: "SMTP_RELAY", name: "SMTP Relay", category: "email", priority: 10 }),
  prov({ id: "PROV-FCM-PUSH", code: "FCM_PUSH", name: "FCM Push", category: "push", priority: 10 }),
  prov({ id: "PROV-NIA-KYC", code: "NIA_KYC", name: "NIA KYC/ID", category: "kyc", priority: 10 }),
  prov({ id: "PROV-CREDIT-BUREAU-GH", code: "CREDIT_BUREAU_GH", name: "Credit Bureau GH", category: "credit_bureau", priority: 10 }),
  prov({ id: "PROV-GRA-REG", code: "GRA_REG", name: "GRA Regulatory", category: "government", priority: 10 }),
  prov({ id: "PROV-ERP-BRIDGE", code: "ERP_BRIDGE", name: "Accounting/ERP Bridge", category: "accounting", priority: 10 }),
  prov({ id: "PROV-CRM-BRIDGE", code: "CRM_BRIDGE", name: "CRM Bridge", category: "crm", priority: 20 }),
  prov({ id: "PROV-BI-EXPORT", code: "BI_EXPORT", name: "BI Export Partner", category: "bi", priority: 10 }),
  prov({ id: "PROV-CLOUD-STORE", code: "CLOUD_STORE", name: "Cloud Storage", category: "cloud_storage", priority: 10 }),
  prov({ id: "PROV-REG-REPORTING", code: "REG_REPORTING", name: "Regulatory Reporting", category: "regulatory", priority: 10 })
]);

export const ENDPOINTS = Object.freeze([
  ep({ id: "EP-INT-HEALTH", integrationId: "INT-MOMO", method: "GET", path: "/integration/health", action: "Integration.View" }),
  ep({ id: "EP-INT-DISPATCH", integrationId: "INT-MOMO", method: "POST", path: "/integration/dispatch", action: "Integration.Admin" }),
  ep({ id: "EP-INT-PROVIDERS", integrationId: "INT-ENTERPRISE", method: "GET", path: "/integration/providers", action: "Integration.Provider" }),
  ep({ id: "EP-INT-WEBHOOKS", integrationId: "INT-MOMO", method: "POST", path: "/integration/webhooks", action: "Integration.Webhook" }),
  ep({ id: "EP-INT-WEBHOOK-IN", integrationId: "INT-MOMO", method: "POST", path: "/integration/webhooks/inbound", action: "Integration.Webhook" }),
  ep({ id: "EP-INT-KEYS", integrationId: "INT-ENTERPRISE", method: "POST", path: "/integration/keys", action: "Integration.Key" }),
  ep({ id: "EP-GWY-FACADE", integrationId: "INT-ENTERPRISE", method: "POST", path: "/gateway/*", action: "Gateway.View" })
]);

export const WEBHOOKS = Object.freeze([
  wh({ id: "WH-MOMO-INBOUND", direction: "inbound", eventType: "momo.payment.callback", secretRef: "settings.momoWebhookSecret" }),
  wh({ id: "WH-MOMO-OUTBOUND", direction: "outbound", eventType: "payment.status.changed", secretRef: "settings.momoWebhookSecret" }),
  wh({ id: "WH-SMS-DLR", direction: "inbound", eventType: "sms.delivery.receipt", secretRef: "integrationApiKeys.hash" }),
  wh({ id: "WH-REG-OUTBOUND", direction: "outbound", eventType: "regulatory.report.ready", secretRef: "integrationApiKeys.hash" })
]);

export const SYNC_STRATEGIES = Object.freeze([
  Object.freeze({ id: "SYNC-NEAR-REALTIME", name: "Near real-time dispatch", mode: "sync", owningModule: 28 }),
  Object.freeze({ id: "SYNC-ASYNC-QUEUE", name: "Async message queue", mode: "async", owningModule: 28 }),
  Object.freeze({ id: "SYNC-BATCH-EXPORT", name: "Batch export partner", mode: "batch", owningModule: 28 }),
  Object.freeze({ id: "SYNC-WEBHOOK-PUSH", name: "Webhook push/retry", mode: "webhook", owningModule: 28 })
]);

export const RESILIENCE_POLICIES = Object.freeze([
  Object.freeze({ id: "RES-CIRCUIT", name: "Circuit breaker", threshold: 5, coolDownMs: 30000, owningModule: 28 }),
  Object.freeze({ id: "RES-RETRY", name: "Retry with backoff", retryMax: 3, owningModule: 28 }),
  Object.freeze({ id: "RES-RATE-LIMIT", name: "Per-minute/hour rate limits", perMinute: 60, perHour: 1000, owningModule: 28 }),
  Object.freeze({ id: "RES-TIMEOUT", name: "Provider timeout", timeoutMs: 5000, owningModule: 28 })
]);

export const MONITORING_POLICIES = Object.freeze([
  Object.freeze({ id: "MON-INT-METRICS", name: "integration.* metrics", owningModule: 28, sinkModule: 19 }),
  Object.freeze({ id: "MON-INT-AUDIT", name: "Integration activity audit", owningModule: 28, sinkModule: 13 })
]);

export const SECURITY_MAPPINGS = Object.freeze([
  Object.freeze({ id: "SECMAP-API-KEY", controlRef: "SEC-CTRL-INT-API-KEYS", mechanism: "SHA-256 hashed keys" }),
  Object.freeze({ id: "SECMAP-MOMO-WH", controlRef: "SEC-CTRL-MOMO-WEBHOOK", mechanism: "settings.momoWebhookSecret HMAC" }),
  Object.freeze({ id: "SECMAP-NO-PINS", controlRef: "SEC-CTRL-FORBIDDEN-SECRETS", mechanism: "INT-022 reject" }),
  Object.freeze({ id: "SECMAP-GATEWAY", controlRef: "SEC-CTRL-GATEWAY-AUTH", mechanism: "Module 20 facade" })
]);

export function listProviders() { return [...PROVIDERS]; }
export function listIntegrations() { return [...INTEGRATIONS]; }
export function listEndpoints() { return [...ENDPOINTS]; }
export function listWebhooks() { return [...WEBHOOKS]; }

export function validateIntegrationRegistry() {
  const errors = [];
  const check = (rows, key = "id") => {
    const s = new Set();
    for (const r of rows) {
      if (s.has(r[key])) errors.push("Duplicate " + r[key]);
      s.add(r[key]);
      if (r.owningModule != null && r.owningModule !== 28 && r.id !== "EP-GWY-FACADE") {
        /* gateway facade may note 20 via action only */
      }
      if (r.owningModule != null && ![20, 28].includes(r.owningModule)) {
        errors.push(r.id + " unexpected owner");
      }
    }
  };
  check(INTEGRATIONS);
  check(PROVIDERS);
  check(ENDPOINTS);
  check(WEBHOOKS);
  for (const i of INTEGRATIONS) {
    if (i.owningModule !== 28) errors.push(i.id + " must be owned by Module 28");
  }
  return { ok: errors.length === 0, errors };
}

export const EIIECS_COUNTS = Object.freeze({
  integrations: INTEGRATIONS.length,
  providers: PROVIDERS.length,
  endpoints: ENDPOINTS.length,
  webhooks: WEBHOOKS.length
});
`);

w("src/core/phase10-migration-tracking.js", `/**
 * Phase 10 — Integration migration package tracking + history + checklist.
 */

export const P10_MIG_VERSION = "1.0.0";

export const MIGRATION_STATUSES = Object.freeze([
  "Draft",
  "Validated",
  "Ready",
  "InProgress",
  "AwaitingConfirmation",
  "Completed",
  "Failed",
  "RolledBack",
  "Archived"
]);

export const MIGRATION_TRANSITIONS = Object.freeze({
  Draft: ["Validated", "Archived"],
  Validated: ["Ready", "Draft", "Failed"],
  Ready: ["InProgress", "Archived"],
  InProgress: ["AwaitingConfirmation", "Completed", "Failed"],
  AwaitingConfirmation: ["Completed", "Failed", "RolledBack"],
  Completed: ["Archived"],
  Failed: ["RolledBack", "Draft", "Archived"],
  RolledBack: ["Draft", "Archived"],
  Archived: []
});

export const MANDATORY_MIGRATION_FILES = Object.freeze([
  "manifest.json",
  "checksums.sha256",
  "schemas/common/metadata.schema.json",
  "schemas/integration/providers.schema.json",
  "data/providers.json",
  "data/endpoints.json",
  "data/webhooks.json",
  "README.md"
]);

export function createMigrationStore() {
  return { tracking: [], history: [] };
}

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

export function createTrackingRecord(input = {}) {
  return {
    id: input.id || ("mig-" + Date.now().toString(36)),
    packageId: input.packageId || "",
    tenantId: input.tenantId || "tenant-smile-trust",
    status: input.status || "Draft",
    currentSequence: Number(input.currentSequence || 0),
    checksum: input.checksum || "",
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
    lastError: input.lastError || null
  };
}

export function canTransitionMigration(from, to) {
  return (MIGRATION_TRANSITIONS[from] || []).includes(to);
}

export function appendHistory(store, trackingId, { fromStatus, toStatus, actorId = "system", note = "", now } = {}) {
  const row = store.tracking.find((t) => t.id === trackingId);
  if (!row) return { ok: false, code: "P10-001", error: "Tracking record not found" };
  if (!canTransitionMigration(fromStatus ?? row.status, toStatus)) {
    return { ok: false, code: "P10-002", error: "Invalid migration transition" };
  }
  const nextSeq = row.currentSequence + 1;
  const hist = Object.freeze({
    id: "migh-" + nextSeq + "-" + trackingId,
    trackingId,
    sequence: nextSeq,
    fromStatus: fromStatus ?? row.status,
    toStatus,
    actorId,
    note,
    at: nowIso(now),
    immutable: true
  });
  // append-only: never mutate prior history rows
  store.history.push(hist);
  row.status = toStatus;
  row.currentSequence = nextSeq;
  row.updatedAt = hist.at;
  if (toStatus === "Failed") row.lastError = note || row.lastError;
  return { ok: true, history: hist, tracking: row };
}

export function validateHistoryIntegrity(store, trackingId) {
  const rows = store.history.filter((h) => h.trackingId === trackingId).sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sequence !== i + 1) {
      return { ok: false, code: "P10-003", error: "Sequence must increment by 1" };
    }
    if (rows[i].immutable !== true) {
      return { ok: false, code: "P10-004", error: "History must be immutable" };
    }
  }
  return { ok: true, count: rows.length };
}

export function validateMigrationChecklist(files = []) {
  const set = new Set(files);
  const missing = MANDATORY_MIGRATION_FILES.filter((f) => !set.has(f));
  return { ok: missing.length === 0, missing, required: [...MANDATORY_MIGRATION_FILES] };
}

/** Sample seed rows for tests: normal, AWC, validation failure/rollback, archival */
export function seedSampleMigrationLifecycles(store) {
  const normal = createTrackingRecord({ id: "mig-normal", packageId: "pkg-normal" });
  store.tracking.push(normal);
  appendHistory(store, "mig-normal", { toStatus: "Validated", actorId: "u1", note: "ok" });
  appendHistory(store, "mig-normal", { toStatus: "Ready", actorId: "u1" });
  appendHistory(store, "mig-normal", { toStatus: "InProgress", actorId: "u1" });
  appendHistory(store, "mig-normal", { toStatus: "Completed", actorId: "u1", note: "normal complete" });

  const awc = createTrackingRecord({ id: "mig-awc", packageId: "pkg-awc" });
  store.tracking.push(awc);
  appendHistory(store, "mig-awc", { toStatus: "Validated", actorId: "u1" });
  appendHistory(store, "mig-awc", { toStatus: "Ready", actorId: "u1" });
  appendHistory(store, "mig-awc", { toStatus: "InProgress", actorId: "u1" });
  appendHistory(store, "mig-awc", { toStatus: "AwaitingConfirmation", actorId: "u1", note: "AWC" });
  appendHistory(store, "mig-awc", { toStatus: "Completed", actorId: "u2", note: "confirmed" });

  const fail = createTrackingRecord({ id: "mig-fail", packageId: "pkg-fail" });
  store.tracking.push(fail);
  appendHistory(store, "mig-fail", { toStatus: "Validated", actorId: "u1" });
  appendHistory(store, "mig-fail", { toStatus: "Ready", actorId: "u1" });
  appendHistory(store, "mig-fail", { toStatus: "InProgress", actorId: "u1" });
  appendHistory(store, "mig-fail", { toStatus: "Failed", actorId: "u1", note: "validation failure" });
  appendHistory(store, "mig-fail", { toStatus: "RolledBack", actorId: "u1", note: "rollback" });

  const arch = createTrackingRecord({ id: "mig-arch", packageId: "pkg-arch", status: "Completed", currentSequence: 0 });
  // rebuild archival path cleanly
  store.tracking.push(arch);
  // force sequence path: Draft already — need Completed first via transitions
  // reset
  arch.status = "Draft";
  arch.currentSequence = 0;
  appendHistory(store, "mig-arch", { toStatus: "Validated", actorId: "u1" });
  appendHistory(store, "mig-arch", { toStatus: "Ready", actorId: "u1" });
  appendHistory(store, "mig-arch", { toStatus: "InProgress", actorId: "u1" });
  appendHistory(store, "mig-arch", { toStatus: "Completed", actorId: "u1" });
  appendHistory(store, "mig-arch", { toStatus: "Archived", actorId: "u1", note: "archival" });

  return store;
}
`);

// JSON schemas with absolute $id and $ref
const metadataSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.smiletrust.com/common/metadata.schema.json",
  title: "Smile Trust Common Metadata",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "tenantId", "generatedAt", "correlationId"],
  properties: {
    schemaVersion: { type: "string", pattern: "^\\\\d+\\\\.\\\\d+\\\\.\\\\d+$" },
    tenantId: { type: "string", minLength: 1 },
    generatedAt: { type: "string", format: "date-time" },
    correlationId: { type: "string", minLength: 1 },
    environment: { type: "string", enum: ["development", "staging", "production"] },
    actorId: { type: "string" }
  }
};

const providersSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.smiletrust.com/integration/providers.schema.json",
  title: "Integration Providers Registry Schema",
  type: "object",
  additionalProperties: false,
  required: ["metadata", "providers"],
  properties: {
    metadata: { $ref: "https://schemas.smiletrust.com/common/metadata.schema.json" },
    providers: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "code", "name", "category", "owningModule"],
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          priority: { type: "integer" },
          owningModule: { const: 28 },
          simulated: { type: "boolean" }
        }
      }
    }
  }
};

const endpointsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.smiletrust.com/integration/endpoints.schema.json",
  title: "Integration Endpoints Registry Schema",
  type: "object",
  required: ["metadata", "endpoints"],
  properties: {
    metadata: { $ref: "https://schemas.smiletrust.com/common/metadata.schema.json" },
    endpoints: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "method", "path", "owningModule"],
        properties: {
          id: { type: "string" },
          method: { type: "string" },
          path: { type: "string" },
          action: { type: "string" },
          owningModule: { type: "integer" }
        }
      }
    }
  }
};

const webhooksSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.smiletrust.com/integration/webhooks.schema.json",
  title: "Integration Webhooks Registry Schema",
  type: "object",
  required: ["metadata", "webhooks"],
  properties: {
    metadata: { $ref: "https://schemas.smiletrust.com/common/metadata.schema.json" },
    webhooks: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "direction", "eventType", "secretRef"],
        properties: {
          id: { type: "string" },
          direction: { enum: ["inbound", "outbound"] },
          eventType: { type: "string" },
          secretRef: { type: "string" },
          owningModule: { const: 28 }
        }
      }
    }
  }
};

w("docs/schemas/common/metadata.schema.json", JSON.stringify(metadataSchema, null, 2).replace(/\\\\\\\\d/g, "\\\\d"));
w("docs/schemas/integration/providers.schema.json", JSON.stringify(providersSchema, null, 2));
w("docs/schemas/integration/endpoints.schema.json", JSON.stringify(endpointsSchema, null, 2));
w("docs/schemas/integration/webhooks.schema.json", JSON.stringify(webhooksSchema, null, 2));

console.log("phase10 core+schemas done");
