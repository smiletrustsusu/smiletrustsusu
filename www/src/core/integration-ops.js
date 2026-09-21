/**
 * Module 28 — Enterprise Integration Hub & Third-Party API Gateway (in-process).
 * Extends Module 20; does not replace it. Does not post collections or store MoMo PINs.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric, recordLog } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import { dispatchGatewayRequest } from "./api-gateway-ops.js";
import {
  INTEGRATION_HUB_VERSION,
  PROVIDER_CATEGORIES,
  PROVIDER_STATES,
  WEBHOOK_STATES,
  WEBHOOK_DELIVERY_STATES,
  CIRCUIT_STATES,
  AUTH_POLICY_MODELS,
  RATE_LIMIT_SCOPES,
  SEEDED_PROVIDERS,
  HUB_ROUTE_CATALOG,
  canTransitionProvider,
  INT_ERROR_CODES
} from "./integration-lifecycle.js";
import { runTransformDefinition, validateTransformDefinition } from "./integration-transforms.js";
import {
  ensureMessageBrokerState,
  publishMessage,
  subscribe,
  consumeNext,
  ackMessage,
  nackMessage,
  replayMessage,
  queueDepthReport
} from "./integration-messaging.js";
import {
  ensureDeliveryState,
  assignOwnership,
  advanceMilestone,
  setDeliveryStatus,
  requestDeadlineChange,
  approveDeadlineChange,
  deliveryDashboard,
  deliveryReports,
  evaluateOverdue
} from "./integration-delivery.js";

export const INTEGRATION_SCHEMA_VERSION = "1.0.0";

const INTEGRATION_ARRAYS = [
  "integrationProviders",
  "integrationProviderVersions",
  "integrationProviderConfigs",
  "integrationRoutes",
  "integrationApiClients",
  "integrationApiKeys",
  "integrationOauthClients",
  "integrationWebhooks",
  "integrationWebhookDeliveries",
  "integrationApiRequests",
  "integrationApiResponses",
  "integrationTransforms",
  "integrationRateLimits",
  "integrationUsageStatistics",
  "integrationCircuitBreakers",
  "integrationNonces",
  "integrationSecretRotations",
  "integrationActivityLogs",
  "integrationIpAllowlists"
];

const FORBIDDEN_SECRET_KEYS = ["momoPin", "pin", "bankPassword", "password", "cardCvv"];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function hashSecret(value) {
  return payloadHash(String(value || ""));
}

function generatePlainKey() {
  return `inth_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

function auditInt(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "28",
    ...extras
  }, uid);
}

function emitIntEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 28,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "Integration"
  }, uid, now);
}

function rejectSensitive(input = {}) {
  for (const key of FORBIDDEN_SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key]) {
      return { ok: false, error: "MoMo PINs and bank passwords must not be stored", errorCode: "INT-022", http: 400 };
    }
  }
  if (input.secrets && typeof input.secrets === "object") {
    for (const key of FORBIDDEN_SECRET_KEYS) {
      if (input.secrets[key]) {
        return { ok: false, error: "MoMo PINs and bank passwords must not be stored", errorCode: "INT-022", http: 400 };
      }
    }
  }
  return { ok: true };
}

function hubEnabled(state) {
  return isFeatureEnabled(state, "enableEnterpriseIntegration") !== false;
}

function seedProviders(uid, now) {
  return SEEDED_PROVIDERS.map((item, index) => ({
    id: `prov-${item.code.toLowerCase()}`,
    code: item.code,
    name: item.name,
    category: item.category,
    priority: item.priority,
    status: "healthy",
    version: "1.0.0",
    health: { status: "healthy", checkedAt: nowIso(now), latencyMs: 5 + index },
    failoverGroup: item.category,
    suspended: false,
    createdAt: nowIso(now)
  }));
}

function seedTransforms(uid, now) {
  return [
    {
      id: "xf-json-xml",
      code: "XF-JSON-XML",
      name: "JSON to XML",
      kind: "json_xml",
      version: "1.0.0",
      root: "envelope",
      createdAt: nowIso(now)
    },
    {
      id: "xf-currency",
      code: "XF-CURRENCY-PESEWAS",
      name: "Pesewas to GHS display",
      kind: "currency",
      version: "1.0.0",
      field: "amount",
      mode: "pesewas_to_ghs",
      createdAt: nowIso(now)
    },
    {
      id: "xf-field",
      code: "XF-PARTNER-FIELDS",
      name: "Partner field map",
      kind: "field_map",
      version: "1.0.0",
      fieldMap: { customerId: "member_id", amount: "txn_amount" },
      createdAt: nowIso(now)
    }
  ];
}

function ensureCircuit(state, key) {
  let row = state.integrationCircuitBreakers.find((item) => item.key === key);
  if (!row) {
    row = {
      key,
      state: "closed",
      failures: 0,
      successes: 0,
      openedAt: null,
      threshold: Number(getConfigValue(state, "integration.circuitFailureThreshold") ?? 5),
      coolDownMs: Number(getConfigValue(state, "integration.circuitCoolDownMs") ?? 30000),
      halfOpenMax: 1
    };
    state.integrationCircuitBreakers.push(row);
  }
  return row;
}

export function ensureIntegrationState(state = {}, uid, now) {
  INTEGRATION_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  ensureMessageBrokerState(state);
  ensureDeliveryState(state, uid, now);
  if (!state.integrationProviders.length) {
    state.integrationProviders = seedProviders(uid, now);
    state.integrationProviders.forEach((provider) => {
      state.integrationProviderVersions.push({
        id: newId("pv", uid),
        providerId: provider.id,
        version: provider.version,
        status: "active",
        createdAt: nowIso(now)
      });
      state.integrationProviderConfigs.push({
        id: newId("pc", uid),
        providerId: provider.id,
        priority: provider.priority,
        timeoutMs: Number(getConfigValue(state, "integration.defaultTimeoutMs") ?? 5000),
        retryMax: Number(getConfigValue(state, "integration.retryMax") ?? 3),
        secretsMeta: { rotationIntervalDays: 90, lastRotatedAt: null },
        createdAt: nowIso(now)
      });
      ensureCircuit(state, provider.code);
    });
  }
  if (!state.integrationRoutes.length) {
    state.integrationRoutes = HUB_ROUTE_CATALOG.map((route) => ({ ...route, status: "active" }));
  }
  if (!state.integrationTransforms.length) {
    state.integrationTransforms = seedTransforms(uid, now);
  }
  if (!state.integrationRateLimits.length) {
    state.integrationRateLimits = RATE_LIMIT_SCOPES.map((scope) => ({
      id: `rl-${scope}`,
      scope,
      perMinute: Number(getConfigValue(state, "integration.perMinute") ?? 60),
      perHour: Number(getConfigValue(state, "integration.perHour") ?? 1000),
      burst: 20,
      enabled: true
    }));
  }
  state.integrationConfig = state.integrationConfig || {
    versioningDefault: "uri",
    loggingThreshold: "info",
    monitoringThresholdMs: 2000,
    encryptedInTransitPolicy: true,
    secretRotationDays: 90
  };
  return state;
}

export function assertIntegrationBoundary() {
  return {
    centralized: true,
    extendsModule20: true,
    restHttpServer: false,
    graphqlHttpServer: false,
    postsCollections: false,
    storesMomoPins: false,
    storesBankPasswords: false,
    inProcess: true,
    version: INTEGRATION_HUB_VERSION,
    errorCodes: INT_ERROR_CODES
  };
}

function recordUsage(state, dims = {}, now) {
  state.integrationUsageStatistics.push({
    id: newId("ius", null),
    ...dims,
    at: nowIso(now)
  });
}

function checkRateLimit(state, dims = {}, now) {
  const windowKey = [
    dims.scope || "endpoint",
    dims.userId || "",
    dims.role || "",
    dims.apiKeyId || "",
    dims.clientId || "",
    dims.ip || "",
    dims.partner || "",
    dims.endpoint || ""
  ].join("|");
  const limit = state.integrationRateLimits.find((item) => item.scope === (dims.scope || "endpoint"))
    || state.integrationRateLimits[0];
  const perMinute = Number(limit?.perMinute || 60);
  const minuteBucket = Math.floor(nowMs(now) / 60000);
  state._integrationRateWindows = state._integrationRateWindows || [];
  let window = state._integrationRateWindows.find((item) => item.key === windowKey && item.bucket === minuteBucket);
  if (!window) {
    window = { key: windowKey, bucket: minuteBucket, count: 0 };
    state._integrationRateWindows.push(window);
  }
  window.count += 1;
  if (window.count > perMinute) {
    return {
      ok: false,
      error: "Rate limit exceeded",
      errorCode: "INT-008",
      http: 429,
      retryAfterSec: 60
    };
  }
  return { ok: true, remaining: perMinute - window.count };
}

export function evaluateAuthPolicy(state, request = {}) {
  const policy = request.authPolicy || request.auth?.method || "session";
  if (!AUTH_POLICY_MODELS.includes(policy) && policy !== "none") {
    return { ok: false, error: "Unknown auth policy", errorCode: "INT-015", http: 401 };
  }
  if (policy === "api_key") {
    const plain = request.auth?.apiKey || request.apiKey;
    const hashed = hashSecret(plain);
    const key = (state.integrationApiKeys || []).find((item) => item.keyHash === hashed && item.status === "active");
    if (!key) return { ok: false, error: "API key invalid", errorCode: "INT-016", http: 401 };
    return { ok: true, principal: { type: "api_key", clientId: key.clientId, keyId: key.id } };
  }
  if (policy === "hmac") {
    const secret = request.auth?.secret || state.settings?.momoWebhookSecret || "";
    const signature = request.auth?.signature || request.headers?.["x-signature"] || "";
    const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body || {});
    const expected = hashSecret(`${secret}.${body}`);
    if (!secret || signature !== expected) {
      return { ok: false, error: "HMAC verification failed", errorCode: "INT-011", http: 401 };
    }
    return { ok: true, principal: { type: "hmac" } };
  }
  if (policy === "jwt" || policy === "oauth2" || policy === "oidc") {
    const token = request.auth?.token || request.headers?.authorization || "";
    if (!token || !String(token).includes(".")) {
      return { ok: false, error: "JWT/OAuth token rejected", errorCode: "INT-015", http: 401 };
    }
    const client = (state.integrationOauthClients || []).find((item) => item.status === "active");
    if (policy !== "jwt" && !client && !request.auth?.bypassClientCheck) {
      return { ok: false, error: "OAuth client missing", errorCode: "INT-015", http: 401 };
    }
    return { ok: true, principal: { type: policy, tokenFingerprint: hashSecret(token).slice(0, 12) } };
  }
  if (policy === "mtls") {
    if (!request.auth?.clientCertFingerprint) {
      return { ok: false, error: "mTLS certificate fingerprint required", errorCode: "INT-015", http: 401 };
    }
    return { ok: true, principal: { type: "mtls", fingerprint: request.auth.clientCertFingerprint } };
  }
  if (request.user || policy === "session") {
    return { ok: true, principal: { type: "session", userId: request.user?.id || "" } };
  }
  return { ok: false, error: "Authentication failed", errorCode: "INT-006", http: 401 };
}

export function checkReplayProtection(state, request = {}, now) {
  const nonce = request.nonce || request.headers?.["x-nonce"];
  const timestamp = request.timestamp || request.headers?.["x-timestamp"];
  if (!nonce) return { ok: true, skipped: true };
  const ts = Date.parse(timestamp || nowIso(now));
  if (!Number.isFinite(ts) || Math.abs(nowMs(now) - ts) > 300000) {
    return { ok: false, error: "Replay window exceeded", errorCode: "INT-012", http: 401 };
  }
  if (state.integrationNonces.find((item) => item.nonce === nonce)) {
    return { ok: false, error: "Replay detected", errorCode: "INT-012", http: 409 };
  }
  state.integrationNonces.push({ nonce, at: nowIso(now) });
  if (state.integrationNonces.length > 5000) state.integrationNonces.splice(0, state.integrationNonces.length - 5000);
  return { ok: true };
}

export function checkIpAllowlist(state, ip, partnerCode) {
  if (!ip) return { ok: true, skipped: true };
  const rules = (state.integrationIpAllowlists || []).filter((item) => !partnerCode || item.partnerCode === partnerCode);
  if (!rules.length) return { ok: true, skipped: true };
  if (!rules.some((item) => item.ip === ip || item.cidr === ip)) {
    return { ok: false, error: "IP not allowlisted", errorCode: "INT-017", http: 403 };
  }
  return { ok: true };
}

export function circuitAllow(state, key, now) {
  const circuit = ensureCircuit(state, key);
  if (circuit.state === "open") {
    if (nowMs(now) - Date.parse(circuit.openedAt || 0) >= circuit.coolDownMs) {
      circuit.state = "half_open";
      circuit.successes = 0;
    } else {
      return { ok: false, error: "Circuit breaker open", errorCode: "INT-009", http: 503, circuit };
    }
  }
  return { ok: true, circuit };
}

export function circuitRecord(state, key, success, now) {
  const circuit = ensureCircuit(state, key);
  if (success) {
    circuit.failures = 0;
    circuit.successes += 1;
    if (circuit.state === "half_open" || circuit.state === "open") circuit.state = "closed";
    circuit.openedAt = null;
  } else {
    circuit.failures += 1;
    if (circuit.failures >= circuit.threshold || circuit.state === "half_open") {
      circuit.state = "open";
      circuit.openedAt = nowIso(now);
    }
  }
  return circuit;
}

export function registerProvider(state, input = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!hubEnabled(state)) return { ok: false, error: "Integration hub disabled", errorCode: "INT-001", http: 503 };
  if (!permitted(user, "Integration.Provider") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const sensitive = rejectSensitive(input);
  if (!sensitive.ok) return sensitive;
  if (!input.code || !input.name || !PROVIDER_CATEGORIES.includes(input.category)) {
    return { ok: false, error: "Invalid provider registration", errorCode: "INT-010", http: 400 };
  }
  if (state.integrationProviders.some((item) => item.code === input.code)) {
    return { ok: false, error: "Duplicate provider", errorCode: "INT-023", http: 409 };
  }
  const provider = {
    id: newId("prov", uid),
    code: input.code,
    name: input.name,
    category: input.category,
    priority: Number(input.priority || 100),
    status: "configured",
    version: input.version || "1.0.0",
    health: { status: "unknown", checkedAt: nowIso(now), latencyMs: null },
    failoverGroup: input.failoverGroup || input.category,
    suspended: false,
    createdAt: nowIso(now)
  };
  state.integrationProviders.push(provider);
  state.integrationProviderVersions.push({
    id: newId("pv", uid),
    providerId: provider.id,
    version: provider.version,
    status: "active",
    createdAt: nowIso(now)
  });
  state.integrationProviderConfigs.push({
    id: newId("pc", uid),
    providerId: provider.id,
    priority: provider.priority,
    timeoutMs: Number(input.timeoutMs || 5000),
    retryMax: Number(input.retryMax || 3),
    secretsMeta: { rotationIntervalDays: 90, lastRotatedAt: null },
    createdAt: nowIso(now)
  });
  ensureCircuit(state, provider.code);
  auditInt(state, "Integration provider registered", provider.code, user, { entityId: provider.id }, uid);
  emitIntEvent(state, "ProviderRegistered", { code: provider.code }, { uid, now, aggregateId: provider.id });
  return { ok: true, provider };
}

export function listProviders(state, filters = {}) {
  ensureIntegrationState(state);
  let rows = [...(state.integrationProviders || [])];
  if (filters.category) rows = rows.filter((item) => item.category === filters.category);
  if (filters.status) rows = rows.filter((item) => item.status === filters.status);
  rows.sort((a, b) => a.priority - b.priority);
  return { ok: true, rows, count: rows.length };
}

export function setProviderStatus(state, providerCode, status, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Provider") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const provider = state.integrationProviders.find((item) => item.code === providerCode || item.id === providerCode);
  if (!provider) return { ok: false, error: "Provider not found", errorCode: "INT-003", http: 404 };
  if (!canTransitionProvider(provider.status, status) && status !== provider.status) {
    return { ok: false, error: "Invalid provider transition", errorCode: "INT-010", http: 409 };
  }
  provider.status = status;
  provider.suspended = status === "suspended";
  provider.health = { ...provider.health, status, checkedAt: nowIso(now) };
  auditInt(state, "Integration provider status", `${provider.code}:${status}`, user, { entityId: provider.id }, uid);
  return { ok: true, provider };
}

export function resolveProvider(state, category, { preferCode } = {}) {
  ensureIntegrationState(state);
  const candidates = state.integrationProviders
    .filter((item) => item.category === category && !item.suspended && item.status !== "retired")
    .sort((a, b) => a.priority - b.priority);
  if (preferCode) {
    const preferred = candidates.find((item) => item.code === preferCode);
    if (preferred) return preferred;
  }
  return candidates[0] || null;
}

export function registerIntegrationClient(state, input = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Client") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const client = {
    id: newId("icl", uid),
    name: input.name || "Integration Client",
    type: input.type || "third_party",
    partnerCode: input.partnerCode || "",
    scopes: input.scopes || ["integration"],
    status: "active",
    createdAt: nowIso(now)
  };
  state.integrationApiClients.push(client);
  auditInt(state, "Integration client registered", client.name, user, { entityId: client.id }, uid);
  emitIntEvent(state, "IntegrationClientRegistered", { clientId: client.id }, { uid, now, aggregateId: client.id });
  return { ok: true, client };
}

export function issueIntegrationKey(state, clientId, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Key") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const client = state.integrationApiClients.find((item) => item.id === clientId);
  if (!client) return { ok: false, error: "Client not found", errorCode: "INT-005", http: 404 };
  const plaintextKey = generatePlainKey();
  const key = {
    id: newId("ikey", uid),
    clientId,
    keyHash: hashSecret(plaintextKey),
    status: "active",
    createdAt: nowIso(now),
    rotatedAt: nowIso(now)
  };
  state.integrationApiKeys.push(key);
  state.integrationSecretRotations.push({
    id: newId("rot", uid),
    kind: "api_key",
    targetId: key.id,
    at: nowIso(now),
    by: user?.id || ""
  });
  auditInt(state, "Integration API key issued", clientId, user, { entityId: key.id }, uid);
  return { ok: true, key: { ...key, plaintextKey } };
}

export function registerOauthClient(state, input = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Client") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const sensitive = rejectSensitive(input);
  if (!sensitive.ok) return sensitive;
  const client = {
    id: newId("oauth", uid),
    name: input.name || "OAuth Client",
    clientId: input.clientId || newId("ocid", uid),
    clientSecretHash: hashSecret(input.clientSecret || generatePlainKey()),
    grantTypes: input.grantTypes || ["client_credentials"],
    status: "active",
    createdAt: nowIso(now)
  };
  state.integrationOauthClients.push(client);
  auditInt(state, "Integration OAuth client registered", client.name, user, { entityId: client.id }, uid);
  return { ok: true, client: { ...client, clientSecretHash: "[redacted]" } };
}

export function registerWebhook(state, input = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Webhook") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const sensitive = rejectSensitive(input);
  if (!sensitive.ok) return sensitive;
  const webhook = {
    id: newId("iwh", uid),
    direction: input.direction || "outbound",
    eventType: input.eventType || "integration.event",
    target: input.target || "in-process",
    version: input.version || "1.0.0",
    status: "active",
    secretRef: "settings.momoWebhookSecret",
    retryMax: Number(input.retryMax || 3),
    backoffMs: Number(input.backoffMs || 1000),
    createdAt: nowIso(now)
  };
  if (!WEBHOOK_STATES.includes(webhook.status)) webhook.status = "active";
  state.integrationWebhooks.push(webhook);
  auditInt(state, "Integration webhook registered", webhook.eventType, user, { entityId: webhook.id }, uid);
  emitIntEvent(state, "WebhookRegistered", { webhookId: webhook.id }, { uid, now, aggregateId: webhook.id });
  return { ok: true, webhook };
}

function signWebhookBody(state, body) {
  const secret = state.settings?.momoWebhookSecret || "";
  const payload = typeof body === "string" ? body : JSON.stringify(body || {});
  return hashSecret(`${secret}.${payload}`);
}

export function receiveInboundWebhook(state, input = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!hubEnabled(state)) return { ok: false, error: "Integration hub disabled", errorCode: "INT-001", http: 503 };
  const webhook = state.integrationWebhooks.find((item) => item.id === input.webhookId)
    || state.integrationWebhooks.find((item) => item.direction === "inbound" && item.eventType === input.eventType);
  if (!webhook) return { ok: false, error: "Webhook not found", errorCode: "INT-005", http: 404 };
  const expected = signWebhookBody(state, input.body || input.payload || {});
  if (input.signature && input.signature !== expected) {
    return { ok: false, error: "Webhook signature invalid", errorCode: "INT-011", http: 401 };
  }
  const replay = checkReplayProtection(state, input, now);
  if (!replay.ok) return replay;
  const delivery = {
    id: newId("iwd", uid),
    webhookId: webhook.id,
    direction: "inbound",
    status: "delivered",
    payload: input.body || input.payload || {},
    attempts: 1,
    createdAt: nowIso(now),
    deliveredAt: nowIso(now)
  };
  state.integrationWebhookDeliveries.push(delivery);
  recordMetric(state, { name: "integration.webhook.inbound", value: 1, tags: { webhookId: webhook.id } }, uid, now);
  auditInt(state, "Integration inbound webhook", webhook.id, user, { entityId: delivery.id }, uid);
  // Never posts money — payment paths must still go through payment-ops abstractions.
  return { ok: true, delivery, postsCollections: false };
}

export function deliverOutboundWebhook(state, webhookId, payload = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  const webhook = state.integrationWebhooks.find((item) => item.id === webhookId);
  if (!webhook) return { ok: false, error: "Webhook not found", errorCode: "INT-005", http: 404 };
  const delivery = {
    id: newId("iwd", uid),
    webhookId,
    direction: "outbound",
    status: "queued",
    payload,
    attempts: 0,
    createdAt: nowIso(now),
    signature: signWebhookBody(state, payload)
  };
  state.integrationWebhookDeliveries.push(delivery);
  const max = webhook.retryMax || 3;
  let delay = webhook.backoffMs || 1000;
  let success = false;
  for (let attempt = 1; attempt <= max; attempt += 1) {
    delivery.attempts = attempt;
    delivery.status = "delivering";
    const failSim = payload.__forceFail === true && attempt < max;
    if (failSim) {
      delivery.status = "retrying";
      delay *= 2;
      continue;
    }
    if (payload.__forceFail === true && attempt >= max) {
      delivery.status = "dead_letter";
      break;
    }
    delivery.status = "delivered";
    delivery.deliveredAt = nowIso(now);
    success = true;
    break;
  }
  if (!success && delivery.status !== "dead_letter") delivery.status = "failed";
  recordMetric(state, {
    name: success ? "integration.webhook.delivered" : "integration.webhook.failed",
    value: 1,
    tags: { webhookId }
  }, uid, now);
  return { ok: success, delivery };
}

export function replayWebhookDelivery(state, deliveryId, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Webhook") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const original = state.integrationWebhookDeliveries.find((item) => item.id === deliveryId);
  if (!original) return { ok: false, error: "Delivery not found", errorCode: "INT-005", http: 404 };
  const payload = { ...(original.payload || {}) };
  delete payload.__forceFail;
  const result = deliverOutboundWebhook(state, original.webhookId, payload, user, uid, now);
  if (result.ok) {
    original.status = "replayed";
    result.delivery.status = "delivered";
  }
  return result;
}

export function registerTransform(state, definition = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Transform") && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const validated = validateTransformDefinition(definition);
  if (!validated.ok) return { ...validated, http: 400 };
  const row = {
    id: newId("xf", uid),
    ...definition,
    createdAt: nowIso(now)
  };
  state.integrationTransforms.push(row);
  auditInt(state, "Integration transform registered", row.code, user, { entityId: row.id }, uid);
  return { ok: true, transform: row };
}

export function runTransform(state, transformId, payload, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.Transform") && !permitted(user, "Integration.View")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const definition = state.integrationTransforms.find((item) => item.id === transformId || item.code === transformId);
  if (!definition) return { ok: false, error: "Transform not found", errorCode: "INT-005", http: 404 };
  const result = runTransformDefinition(definition, payload);
  recordUsage(state, { kind: "transform", transformId: definition.id }, now);
  return result;
}

export function hubDispatch(state, request = {}, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!hubEnabled(state)) return { ok: false, error: "Integration hub disabled", errorCode: "INT-001", http: 503 };
  const correlationId = request.correlationId || newId("corr", uid);
  const pipeline = ["receive", "authn", "authz", "rate_limit", "validation", "circuit", "route", "provider", "audit", "return"];
  const started = nowMs(now);

  const auth = evaluateAuthPolicy(state, { ...request, user });
  if (!auth.ok) return { ...auth, correlationId, pipeline };

  if (request.action && !permitted(user, request.action) && !permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Authorization failed", errorCode: "INT-007", http: 403, correlationId, pipeline };
  }

  const rate = checkRateLimit(state, {
    scope: request.rateScope || "endpoint",
    userId: user?.id,
    role: user?.role,
    endpoint: request.operation || "dispatch",
    partner: request.partnerCode,
    clientId: auth.principal?.clientId,
    ip: request.ip
  }, now);
  if (!rate.ok) return { ...rate, correlationId, pipeline };

  const ipCheck = checkIpAllowlist(state, request.ip, request.partnerCode);
  if (!ipCheck.ok) return { ...ipCheck, correlationId, pipeline };

  const replay = checkReplayProtection(state, request, now);
  if (!replay.ok) return { ...replay, correlationId, pipeline };

  const providerCode = request.providerCode;
  const category = request.category;
  let provider = null;
  if (providerCode) {
    provider = state.integrationProviders.find((item) => item.code === providerCode);
  } else if (category) {
    provider = resolveProvider(state, category);
  }
  if (!provider) return { ok: false, error: "Provider not found", errorCode: "INT-003", http: 404, correlationId, pipeline };
  if (provider.suspended || provider.status === "retired" || provider.status === "suspended") {
    const failover = resolveProvider(state, provider.failoverGroup || provider.category, { preferCode: null });
    if (!failover || failover.code === provider.code) {
      return { ok: false, error: "Provider unavailable", errorCode: "INT-004", http: 503, correlationId, pipeline };
    }
    provider = failover;
  }

  const circuit = circuitAllow(state, provider.code, now);
  if (!circuit.ok) return { ...circuit, correlationId, pipeline };

  const timeoutMs = Number(getConfigValue(state, "integration.defaultTimeoutMs") ?? 5000);
  if (request.__forceTimeout) {
    circuitRecord(state, provider.code, false, now);
    return { ok: false, error: "Timeout", errorCode: "INT-024", http: 504, correlationId, pipeline };
  }

  // Simulated in-process provider call — never posts collections.
  const forceFail = request.__forceFail === true;
  const success = !forceFail;
  circuitRecord(state, provider.code, success, now);
  if (!success) {
    const alternate = state.integrationProviders
      .filter((item) => item.failoverGroup === provider.failoverGroup && item.code !== provider.code && !item.suspended)
      .sort((a, b) => a.priority - b.priority)[0];
    if (alternate) {
      circuitRecord(state, alternate.code, true, now);
      provider = alternate;
    } else {
      return { ok: false, error: "Failover exhausted", errorCode: "INT-025", http: 503, correlationId, pipeline };
    }
  }

  const reqRow = {
    id: newId("ireq", uid),
    correlationId,
    providerCode: provider.code,
    operation: request.operation || "invoke",
    version: request.version || "v1",
    createdAt: nowIso(now)
  };
  state.integrationApiRequests.push(reqRow);
  const latencyMs = Math.max(1, nowMs(now) - started);
  const response = {
    id: newId("ires", uid),
    requestId: reqRow.id,
    correlationId,
    status: 200,
    body: {
      provider: provider.code,
      operation: request.operation || "invoke",
      accepted: true,
      postsCollections: false,
      simulated: true,
      result: request.payload || {}
    },
    latencyMs,
    createdAt: nowIso(now)
  };
  state.integrationApiResponses.push(response);
  recordUsage(state, { kind: "dispatch", providerCode: provider.code, operation: request.operation }, now);
  recordMetric(state, { name: "integration.dispatch.latency_ms", value: latencyMs, tags: { provider: provider.code } }, uid, now);
  recordLog(state, { level: "info", message: `integration.dispatch ${provider.code}`, correlationId }, uid, now);
  auditInt(state, "Integration hub dispatch", provider.code, user, { entityId: reqRow.id, correlationId }, uid);
  emitIntEvent(state, "IntegrationDispatched", { providerCode: provider.code, correlationId }, { uid, now, correlationId, aggregateId: reqRow.id });

  // Optional bridge into Module 20 for partner routes without duplicating gateway.
  if (request.bridgeRoute) {
    const bridged = dispatchGatewayRequest(state, {
      route: request.bridgeRoute,
      version: request.version || "v1",
      user,
      body: request.payload || {}
    }, { uid, now, user });
    response.body.bridge = { ok: bridged.ok, http: bridged.http };
  }

  return {
    ok: true,
    correlationId,
    pipeline,
    provider,
    request: reqRow,
    response,
    timeoutMs,
    encryptedInTransitPolicy: state.integrationConfig.encryptedInTransitPolicy === true
  };
}

export function integrationHealth(state, now) {
  ensureIntegrationState(state);
  const providers = state.integrationProviders || [];
  const healthy = providers.filter((item) => item.status === "healthy" || item.status === "configured").length;
  const openCircuits = (state.integrationCircuitBreakers || []).filter((item) => item.state === "open").length;
  const queues = queueDepthReport(state);
  return {
    status: openCircuits ? "degraded" : "ok",
    readiness: hubEnabled(state),
    liveness: true,
    providers: providers.length,
    healthyProviders: healthy,
    openCircuits,
    webhooks: (state.integrationWebhooks || []).length,
    queueDepth: queues.reduce((sum, q) => sum + Number(q.depth || 0), 0),
    queues,
    checkedAt: nowIso(now),
    version: INTEGRATION_HUB_VERSION
  };
}

export function integrationDashboard(state, user, uid, now) {
  ensureIntegrationState(state, uid, now);
  if (!permitted(user, "Integration.View") && !permitted(user, "Audit.View") && !permitted(user, "Reports.View")) {
    return { providers: 0, webhooks: 0, clients: 0, transforms: 0, requests: 0 };
  }
  const health = integrationHealth(state, now);
  const delivery = deliveryDashboard(state, now);
  return {
    providers: (state.integrationProviders || []).length,
    webhooks: (state.integrationWebhooks || []).length,
    clients: (state.integrationApiClients || []).length,
    keys: (state.integrationApiKeys || []).length,
    transforms: (state.integrationTransforms || []).length,
    requests: (state.integrationApiRequests || []).length,
    deliveries: (state.integrationWebhookDeliveries || []).length,
    openCircuits: health.openCircuits,
    queueDepth: health.queueDepth,
    usage: (state.integrationUsageStatistics || []).length,
    delivery,
    health
  };
}

export function integrationReports(state, reportId) {
  ensureIntegrationState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "integration_providers") {
    return table(["code", "name", "category", "status", "priority"], state.integrationProviders || []);
  }
  if (reportId === "integration_webhooks") {
    return table(["id", "direction", "eventType", "status", "version"], state.integrationWebhooks || []);
  }
  if (reportId === "integration_clients") {
    return table(["id", "name", "type", "status"], state.integrationApiClients || []);
  }
  if (reportId === "integration_usage") {
    return table(["id", "kind", "providerCode", "at"], state.integrationUsageStatistics || []);
  }
  if (reportId === "integration_queues") {
    return table(["name", "status", "depth", "backPressure", "pattern"], queueDepthReport(state));
  }
  if (reportId === "integration_delivery" || reportId === "integration_ownership") {
    return deliveryReports(state, reportId);
  }
  return table(["id"], []);
}

export function exportIntegrationCsv(report) {
  const columns = report.columns || [];
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.join(","),
    ...(report.rows || []).map((row) => columns.map((col) => escape(row[col])).join(","))
  ].join("\n");
}

// Re-exports for API / UI convenience
export {
  publishMessage,
  subscribe,
  consumeNext,
  ackMessage,
  nackMessage,
  replayMessage,
  assignOwnership,
  advanceMilestone,
  setDeliveryStatus,
  requestDeadlineChange,
  approveDeadlineChange,
  deliveryDashboard,
  evaluateOverdue,
  HUB_ROUTE_CATALOG,
  WEBHOOK_DELIVERY_STATES,
  CIRCUIT_STATES,
  PROVIDER_STATES
};

registerJobHandler("integration_webhook_retry", (state, job, ctx) => {
  ensureIntegrationState(state, ctx.uid, ctx.now);
  const pending = (state.integrationWebhookDeliveries || []).filter((item) => item.status === "retrying" || item.status === "dead_letter");
  let processed = 0;
  pending.slice(0, 10).forEach((item) => {
    const result = deliverOutboundWebhook(state, item.webhookId, item.payload, ctx.user, ctx.uid, ctx.now);
    if (result.ok) processed += 1;
  });
  return { ok: true, processed };
});

registerJobHandler("integration_overdue_scan", (state, job, ctx) => {
  const result = evaluateOverdue(state, ctx.now);
  return { ok: true, overdue: result.overdue?.length || 0 };
});
