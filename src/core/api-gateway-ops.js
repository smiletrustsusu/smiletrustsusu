/**
 * Module 20 — API Gateway & External Integration Platform.
 * Single in-process entry for external clients. No REST/GraphQL HTTP server.
 * Does not post collections, interest, or ledgers.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import { processPaymentCallback, initiatePayment } from "./payment-ops.js";
import { collectHealthSnapshot, requestRemoteDiagnostics, recordMetric, recordLog } from "./monitoring-ops.js";
import { enqueueJob, registerJobHandler, ensureJobState } from "./job-ops.js";
import {
  GATEWAY_CLIENT_TYPES,
  AUTH_METHODS,
  PIPELINE_STAGES,
  API_VERSIONS,
  WEBHOOK_STATES,
  DEFAULT_RATE_LIMITS,
  ROUTE_CATALOG,
  routeById,
  versionSupported,
  clientRateLimit,
  sanitizeGatewayPayload,
  parseSimpleGraphql,
  envelope
} from "./api-gateway-lifecycle.js";
import { normalizeRequestHeader, buildResponseHeader } from "./api-schema.js";

export {
  GATEWAY_CLIENT_TYPES,
  AUTH_METHODS,
  PIPELINE_STAGES,
  API_VERSIONS,
  ROUTE_CATALOG,
  sanitizeGatewayPayload,
  parseSimpleGraphql
};

export const GATEWAY_SCHEMA_VERSION = "1.0.0";

const GATEWAY_ARRAYS = [
  "apiClients",
  "apiKeys",
  "apiTokens",
  "apiVersions",
  "apiRequests",
  "apiRateLimits",
  "apiRateWindows",
  "webhookSubscriptions",
  "webhookDeliveries",
  "apiUsageStatistics",
  "apiAuditLogs",
  "integrationPartners",
  "gatewayActivityLogs"
];

const HANDLERS = new Map();

export function registerGatewayHandler(routeId, fn) {
  if (typeof fn !== "function") HANDLERS.delete(routeId);
  else HANDLERS.set(routeId, fn);
}

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

function hashSecret(value) {
  return payloadHash(String(value || ""));
}

function generatePlainKey() {
  return `stk_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

function auditGateway(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "security",
    guarantee: extras.guarantee || "G1",
    module: "20",
    ...extras
  }, uid);
}

function seedClients() {
  return [
    { id: "client-android", code: "android-apk", name: "Android APK", type: "android", status: "active", scopes: ["sync", "collection", "monitor", "gateway", "*"] },
    { id: "client-web", code: "web-admin", name: "Web Administration Portal", type: "web", status: "active", scopes: ["*"] },
    { id: "client-momo", code: "momo-provider", name: "Mobile Money Providers", type: "payment_provider", status: "active", scopes: ["payment.callback", "payment"] },
    { id: "client-ussd", code: "ussd", name: "USSD Platform", type: "ussd", status: "active", scopes: ["customer.view", "collection"] }
  ];
}

function ensureJobTypes(state) {
  ensureJobState(state);
  const extras = [
    { id: "job-webhook-delivery", type: "webhook_delivery", category: "notification", label: "Webhook Delivery", priority: "high", queue: "retry", parallel: true, maxAttempts: 5, strategy: "exponential", backoffMs: 1500 }
  ];
  extras.forEach((def) => {
    if (!(state.jobDefinitions || []).some((item) => item.id === def.id || item.type === def.type)) {
      state.jobDefinitions.push(def);
    }
  });
}

export function ensureGatewayState(state = {}) {
  GATEWAY_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.apiClients.length) state.apiClients = seedClients();
  if (!state.apiVersions.length) {
    state.apiVersions = API_VERSIONS.map((item) => ({ ...item }));
  }
  if (!state.apiRateLimits.length) {
    state.apiRateLimits = Object.entries(DEFAULT_RATE_LIMITS).map(([type, limits]) => ({
      id: `rl-${type}`,
      scope: type,
      ...limits
    }));
  }
  if (!state.integrationPartners.length) {
    state.integrationPartners = [
      { id: "partner-momo", name: "Mobile Money", type: "payment_provider", status: "active" },
      { id: "partner-sms", name: "SMS Provider", type: "sms", status: "active" }
    ];
  }
  ensureJobTypes(state);
  return state;
}

export function assertGatewayBoundary() {
  return {
    centralized: true,
    restHttpServer: false,
    graphqlHttpServer: false,
    grpcServer: false,
    postsCollections: false,
    storesCustomerPins: false,
    inProcess: true
  };
}

function resolveAuth(state, request = {}) {
  const method = request.auth?.method || (request.user ? "session" : "");
  if (request.user && (method === "session" || !method)) {
    return { ok: true, method: "session", user: request.user, client: state.apiClients.find((item) => item.code === "web-admin") };
  }
  if (method === "api_key" || request.auth?.apiKey) {
    const hash = hashSecret(request.auth.apiKey);
    const key = (state.apiKeys || []).find((item) => item.hash === hash && item.status === "active");
    if (!key) return { ok: false, status: 401, error: "Invalid API key" };
    const client = (state.apiClients || []).find((item) => item.id === key.clientId);
    if (!client || client.status !== "active") return { ok: false, status: 401, error: "API client is not active" };
    key.lastUsedAt = request.now || nowIso();
    return { ok: true, method: "api_key", user: request.user || { id: client.id, role: "Service", username: client.code }, client, key };
  }
  if (method === "device_token") {
    const token = request.auth.deviceToken;
    const device = (state.deviceAuthorizations || state.devices || []).find((item) => (
      item.token === token || item.deviceToken === token || item.fingerprint === token
    ) && item.active !== false && item.revoked !== true);
    if (!device) return { ok: false, status: 401, error: "Device token is not authorized" };
    return {
      ok: true,
      method: "device_token",
      user: request.user || { id: device.agentId || device.id, role: "Collector" },
      client: state.apiClients.find((item) => item.code === "android-apk"),
      device
    };
  }
  if (method === "jwt" && request.auth.jwt) {
    const token = (state.apiTokens || []).find((item) => item.tokenHash === hashSecret(request.auth.jwt) && item.status === "active");
    if (!token) return { ok: false, status: 401, error: "JWT is not recognized" };
    return { ok: true, method: "jwt", user: request.user || { id: token.userId, role: token.role || "Collector" }, client: state.apiClients.find((item) => item.id === token.clientId) };
  }
  return { ok: false, status: 401, error: "Authentication is required" };
}

function hasScope(client, route) {
  const scopes = client?.scopes || [];
  return scopes.includes("*") || (route.scopes || []).some((scope) => scopes.includes(scope));
}

function consumeRate(state, identity, limits, now) {
  const minute = Math.floor(nowMs(now) / 60000);
  let row = (state.apiRateWindows || []).find((item) => item.key === identity && item.window === minute);
  if (!row) {
    row = { id: `rw-${identity}-${minute}`, key: identity, window: minute, count: 0 };
    state.apiRateWindows.push(row);
    if (state.apiRateWindows.length > 400) state.apiRateWindows.splice(0, state.apiRateWindows.length - 400);
  }
  if (row.count >= Number(limits.perMinute || 60)) return { ok: false, retryAfter: 60 };
  row.count += 1;
  return { ok: true, remaining: Number(limits.perMinute || 60) - row.count };
}

function validateRequest(route, request) {
  const version = request.version || request.headers?.["X-API-Version"] || "v1";
  if (!versionSupported(version) || !(route.versions || []).includes(version)) {
    return { ok: false, error: "Unsupported API version" };
  }
  const body = request.body || {};
  const size = JSON.stringify(body).length;
  const maxBytes = 256 * 1024;
  if (size > maxBytes) return { ok: false, error: "Payload exceeds the configured size limit" };
  const missing = (route.required || []).filter((field) => body[field] == null || body[field] === "");
  if (missing.length) return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  return { ok: true, version };
}

function defaultHandler(routeId) {
  if (routeId === "health.snapshot") {
    return (state, request, ctx) => collectHealthSnapshot(state, ctx);
  }
  if (routeId === "gateway.whoami") {
    return (_state, request) => ({
      ok: true,
      client: request.client?.code,
      method: request.authMethod,
      scopes: request.client?.scopes || []
    });
  }
  if (routeId === "gateway.docs") {
    return (state) => ({ ok: true, spec: generateOpenApiSpec(state) });
  }
  if (routeId === "payment.initiate") {
    return (state, request, ctx) => initiatePayment(state, request.body || {}, ctx.user, ctx.uid, ctx.now);
  }
  if (routeId === "payment.callback") {
    return (state, request, ctx) => processPaymentCallback(state, request.body || {}, {
      user: ctx.user,
      uid: ctx.uid,
      now: ctx.now,
      verifiedBy: "gateway"
    });
  }
  if (routeId === "monitor.diagnostics") {
    return (state, request, ctx) => requestRemoteDiagnostics(state, request.body?.deviceId, {
      user: ctx.user,
      uid: ctx.uid,
      now: ctx.now
    });
  }
  if (routeId === "webhook.deliver") {
    return (state, request, ctx) => deliverWebhook(state, request.body?.subscriptionId, request.body || {}, {
      user: ctx.user,
      uid: ctx.uid,
      now: ctx.now
    });
  }
  return null;
}

export function dispatchGatewayRequest(state, request = {}, { uid, now, user } = {}) {
  ensureGatewayState(state);
  const started = nowMs(now);
  const schema = normalizeRequestHeader({
    ...request,
    contractId: request.contractId || request.route || request.operation || ""
  }, { now, user });
  const requestId = request.requestId || schema.header.requestId;
  const correlationId = request.correlationId || schema.header.correlationId || requestId;
  schema.header.requestId = requestId;
  schema.header.correlationId = correlationId;
  const route = routeById(request.route || request.operation);
  const pipeline = [];
  const respond = (status, message, data, error, http = 200) => {
    const body = sanitizeGatewayPayload({
      ...envelope({
        requestId,
        correlationId,
        status,
        message,
        data,
        error,
        now: nowIso(now)
      }),
      header: buildResponseHeader(schema.header, { now, startedMs: started })
    });
    const row = {
      id: requestId,
      correlationId,
      route: route?.id || request.route || "",
      version: request.version || "v1",
      status,
      http,
      durationMs: Math.max(0, nowMs(now) - started),
      clientId: request.resolvedClient?.id || "",
      userId: user?.id || request.user?.id || "",
      createdAt: nowIso(now)
    };
    state.apiRequests.push(row);
    if (state.apiRequests.length > 2000) state.apiRequests.splice(0, state.apiRequests.length - 2000);
    recordMetric(state, { domain: "api", name: "gatewayRequests", value: 1 }, uid, now);
    if (http >= 400) recordMetric(state, { domain: "api", name: "gatewayErrors", value: 1 }, uid, now);
    recordLog(state, {
      level: http >= 400 ? "warn" : "info",
      service: "api-gateway",
      message,
      correlationId,
      payload: { route: route?.id, status, http }
    }, uid, now);
    return { ok: http < 400, http, pipeline, response: body, request: row };
  };

  if (isFeatureEnabled(state, "enableApiGateway") === false) {
    return respond("disabled", "API Gateway is disabled", null, "API Gateway is disabled", 503);
  }
  pipeline.push("receive");
  if (request.tls === false && (request.auth?.method || "session") !== "session") {
    pipeline.push("tls");
    return respond("rejected", "TLS is required for external clients", null, "TLS validation failed", 400);
  }
  pipeline.push("tls");
  if (!route) return respond("rejected", "Unknown route", null, "Unknown route", 404);

  const auth = resolveAuth(state, { ...request, user: user || request.user, now: nowIso(now) });
  pipeline.push("authentication");
  if (!auth.ok) {
    auditGateway(state, "API authentication failed", auth.error, user, { entityId: requestId, correlationId }, uid);
    return respond("unauthenticated", auth.error, null, auth.error, 401);
  }
  request.resolvedClient = auth.client;
  request.authMethod = auth.method;
  const actor = auth.user || user;
  const scopeAuth = ["api_key", "jwt", "service_account"].includes(auth.method);
  if (route.action && actor && !scopeAuth && !canAction(actor, route.action) && !isSystemOwner(actor)) {
    pipeline.push("authorization");
    auditGateway(state, "API authorization failed", route.id, actor, { entityId: requestId, correlationId }, uid);
    return respond("forbidden", "You are not allowed to call this operation", null, "Forbidden", 403);
  }
  if (!hasScope(auth.client, route)) {
    pipeline.push("authorization");
    return respond("forbidden", "Client scope does not include this operation", null, "Forbidden", 403);
  }
  pipeline.push("authorization");

  const limits = clientRateLimit(auth.client?.type || "third_party");
  const configured = Number(getConfigValue(state, "gateway.perMinute")) || limits.perMinute;
  const rate = consumeRate(state, `${auth.client?.id || "anon"}:${actor?.id || "user"}`, { ...limits, perMinute: configured }, now);
  pipeline.push("rate_limit");
  if (!rate.ok) {
    recordMetric(state, { domain: "api", name: "rateLimitHits", value: 1 }, uid, now);
    return respond("rate_limited", "Rate limit exceeded", { retryAfter: rate.retryAfter }, "Rate limit exceeded", 429);
  }

  const valid = validateRequest(route, request);
  pipeline.push("request_validation");
  if (!valid.ok) return respond("invalid", valid.error, null, valid.error, 400);
  request.version = valid.version;

  let idem;
  if (route.idempotent && request.idempotencyKey) {
    idem = beginIdempotentRequest(state, {
      idempotencyKey: request.idempotencyKey,
      operationType: `gateway.${route.id}`,
      fingerprint: { operationType: `gateway.${route.id}`, body: request.body || {} },
      source: "api-gateway",
      userId: actor?.id || "",
      now: nowMs(now)
    }, uid);
    pipeline.push("idempotency");
    if (idem.duplicate) {
      return respond("duplicate", "Idempotent replay", idem.record?.result || { duplicate: true }, null, 200);
    }
    if (!idem.proceed) return respond("conflict", idem.error || "Idempotency conflict", null, idem.error, 409);
  } else {
    pipeline.push("idempotency");
  }

  pipeline.push("routing");
  const handler = HANDLERS.get(route.id) || defaultHandler(route.id);
  if (!handler) {
    if (idem) failIdempotentRequest(state, request.idempotencyKey, { error: "No handler" }, uid);
    return respond("rejected", "No business handler is registered", null, "No handler", 501);
  }

  let result;
  try {
    result = handler(state, { ...request, client: auth.client, authMethod: auth.method }, {
      uid,
      now,
      user: actor
    }) || { ok: true };
  } catch (error) {
    if (idem) failIdempotentRequest(state, request.idempotencyKey, { error: error.message }, uid);
    pipeline.push("business");
    return respond("error", "Business processing failed", null, "Business processing failed", 500);
  }
  pipeline.push("business");
  if (result && result.ok === false) {
    if (idem) failIdempotentRequest(state, request.idempotencyKey, { error: result.error }, uid);
    pipeline.push("response_validation", "audit", "return");
    return respond("rejected", result.error || "Business rule rejected the request", sanitizeGatewayPayload(result), result.error, result.http || 422);
  }
  pipeline.push("response_validation");
  if (idem) completeIdempotentRequest(state, request.idempotencyKey, { result: { ok: true } }, uid);
  auditGateway(state, "API request completed", route.id, actor, { entityId: requestId, correlationId, category: "operational" }, uid);
  pipeline.push("audit", "return");
  const successHttp = result.http && result.http >= 200 && result.http < 400 ? result.http : 200;
  return respond("ok", "Request completed", sanitizeGatewayPayload(result), null, successHttp);
}

export function registerApiClient(state, input = {}, user, uid, now) {
  ensureGatewayState(state);
  if (user && !canAction(user, "Gateway.Client") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot register API clients" };
  }
  if (!input.name || !input.type) return { ok: false, error: "Client name and type are required" };
  if (input.type && !GATEWAY_CLIENT_TYPES.includes(input.type)) return { ok: false, error: "Unsupported client type" };
  const client = {
    id: input.id || newId("apicl", uid),
    code: input.code || (input.name || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: input.name,
    type: input.type,
    status: "active",
    scopes: input.scopes || ["gateway"],
    partnerId: input.partnerId || "",
    createdAt: nowIso(now)
  };
  state.apiClients.push(client);
  auditGateway(state, "API client registered", client.name, user, { entityId: client.id }, uid);
  return { ok: true, client };
}

export function rotateApiKey(state, clientId, { user, uid, now } = {}) {
  ensureGatewayState(state);
  if (user && !canAction(user, "Gateway.Key") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot rotate API keys" };
  }
  const client = (state.apiClients || []).find((item) => item.id === clientId);
  if (!client) return { ok: false, error: "API client not found" };
  (state.apiKeys || []).filter((item) => item.clientId === clientId && item.status === "active").forEach((item) => {
    item.status = "rotated";
    item.rotatedAt = nowIso(now);
  });
  const plaintext = generatePlainKey();
  const key = {
    id: newId("apikey", uid),
    clientId,
    hash: hashSecret(plaintext),
    hint: plaintext.slice(-4),
    status: "active",
    createdAt: nowIso(now)
  };
  state.apiKeys.push(key);
  auditGateway(state, "API key rotated", client.name, user, { entityId: key.id }, uid);
  return { ok: true, key: { ...key, plaintextKey: plaintext } };
}

export function subscribeWebhook(state, input = {}, user, uid, now) {
  ensureGatewayState(state);
  if (user && !canAction(user, "Gateway.Webhook") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot manage webhooks" };
  }
  if (!input.event || !input.target) return { ok: false, error: "Webhook event and target are required" };
  const secret = input.secret || generatePlainKey();
  const row = {
    id: input.id || newId("whsub", uid),
    event: input.event,
    target: input.target,
    version: input.version || "v1",
    status: "active",
    secretHash: hashSecret(secret),
    createdAt: nowIso(now)
  };
  state.webhookSubscriptions.push(row);
  auditGateway(state, "Webhook subscribed", row.event, user, { entityId: row.id }, uid);
  return { ok: true, subscription: { ...row, secret } };
}

export function deliverWebhook(state, subscriptionId, payload = {}, { user, uid, now } = {}) {
  ensureGatewayState(state);
  const subscription = (state.webhookSubscriptions || []).find((item) => item.id === subscriptionId);
  if (!subscription || !WEBHOOK_STATES.includes(subscription.status)) {
    return { ok: false, error: "Webhook subscription is not active" };
  }
  if (subscription.status !== "active") return { ok: false, error: "Webhook subscription is not active" };
  const signature = hashSecret(`${subscription.secretHash}:${JSON.stringify(payload)}:${nowIso(now)}`);
  const delivery = {
    id: newId("whdel", uid),
    subscriptionId,
    event: subscription.event,
    status: "queued",
    attempts: 1,
    signature,
    payload: sanitizeGatewayPayload(payload),
    createdAt: nowIso(now)
  };
  state.webhookDeliveries.push(delivery);
  const job = enqueueJob(state, {
    type: "webhook_delivery",
    businessKey: delivery.id,
    payload: { deliveryId: delivery.id },
    correlationId: delivery.id
  }, user, uid, now);
  if (job.ok) {
    delivery.status = "delivered";
    delivery.jobId = job.job?.id || "";
  } else {
    delivery.status = "dead_letter";
    delivery.error = job.error;
  }
  return { ok: job.ok, delivery, job };
}

export function replayWebhook(state, deliveryId, { user, uid, now } = {}) {
  const delivery = (state.webhookDeliveries || []).find((item) => item.id === deliveryId);
  if (!delivery) return { ok: false, error: "Webhook delivery not found" };
  const again = deliverWebhook(state, delivery.subscriptionId, delivery.payload, { user, uid, now });
  if (again.ok) delivery.status = "replayed";
  return again;
}

export function receiveInboundWebhook(state, envelopeInput = {}, ctx = {}) {
  return dispatchGatewayRequest(state, {
    route: "payment.callback",
    version: "v1",
    tls: envelopeInput.tls !== false,
    auth: envelopeInput.auth || { method: "session" },
    user: ctx.user,
    body: envelopeInput,
    idempotencyKey: envelopeInput.idempotencyKey || `wh:${envelopeInput.reference || envelopeInput.body?.reference || ""}`,
    correlationId: envelopeInput.correlationId
  }, ctx);
}

export function executeGraphQL(state, input = {}, ctx = {}) {
  const field = input.field || parseSimpleGraphql(input.query);
  const route = ROUTE_CATALOG.find((item) => item.graphql === field || item.id === field);
  if (!route) {
    return {
      ok: false,
      response: envelope({
        requestId: "gql",
        status: "rejected",
        message: "Unknown GraphQL field",
        error: "Unknown GraphQL field",
        now: nowIso(ctx.now)
      })
    };
  }
  return dispatchGatewayRequest(state, {
    route: route.id,
    version: input.version || "v1",
    body: input.variables || input.args || {},
    user: ctx.user,
    auth: input.auth,
    tls: input.tls,
    idempotencyKey: input.idempotencyKey
  }, ctx);
}

export function generateOpenApiSpec(state = {}) {
  ensureGatewayState(state);
  const paths = {};
  ROUTE_CATALOG.forEach((route) => {
    const path = `/v1${route.path}`;
    paths[path] = paths[path] || {};
    paths[path][route.method.toLowerCase()] = {
      operationId: route.id,
      summary: route.id,
      "x-graphql": route.graphql,
      security: [{ ApiKey: [], Session: [] }],
      requestBody: {
        required: (route.required || []).length > 0,
        content: { "application/json": { schema: { required: route.required || [] } } }
      },
      responses: {
        200: { description: "Standard envelope with correlationId, requestId, status, message, data" },
        401: { description: "Unauthenticated" },
        403: { description: "Forbidden" },
        429: { description: "Rate limited" }
      }
    };
  });
  return {
    openapi: "3.0.3",
    info: {
      title: "SMILE TRUST SUSU MANAGEMENT SYSTEM Gateway",
      version: GATEWAY_SCHEMA_VERSION,
      description: "In-process integration contract. The application does not start an HTTP REST or GraphQL listener."
    },
    servers: [{ url: "in-process://gateway" }],
    paths,
    components: {
      securitySchemes: {
        ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        Session: { type: "http", scheme: "bearer" }
      }
    }
  };
}

export function gatewayDashboard(state) {
  ensureGatewayState(state);
  const requests = state.apiRequests || [];
  const errors = requests.filter((item) => Number(item.http || 0) >= 400);
  return {
    clients: (state.apiClients || []).length,
    keys: (state.apiKeys || []).filter((item) => item.status === "active").length,
    requests: requests.length,
    errors: errors.length,
    errorRate: requests.length ? errors.length / requests.length : 0,
    webhooks: (state.webhookSubscriptions || []).filter((item) => item.status === "active").length,
    versions: (state.apiVersions || []).map((item) => item.id)
  };
}

export function gatewayReports(state, reportId, range = {}) {
  ensureGatewayState(state);
  const from = Date.parse(range.from || "1970-01-01");
  const to = Date.parse(`${range.to || "2100-01-01"}T23:59:59.000Z`);
  const inRange = (item) => {
    const ts = Date.parse(item.createdAt || 0);
    return ts >= from && ts <= to;
  };
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "gateway_requests") return table(["createdAt", "route", "status", "http"], (state.apiRequests || []).filter(inRange));
  if (reportId === "gateway_usage") {
    return table(["clientId", "requests"], Object.entries((state.apiRequests || []).filter(inRange).reduce((acc, item) => {
      acc[item.clientId || "unknown"] = (acc[item.clientId || "unknown"] || 0) + 1;
      return acc;
    }, {})).map(([clientId, requests]) => ({ clientId, requests })));
  }
  if (reportId === "gateway_webhooks") return table(["createdAt", "event", "status"], (state.webhookDeliveries || []).filter(inRange));
  return table(["id"], []);
}

export function exportGatewayCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

registerJobHandler("webhook_delivery", (state, job) => {
  const delivery = (state.webhookDeliveries || []).find((item) => item.id === job.payload?.deliveryId);
  if (delivery && delivery.status === "queued") delivery.status = "delivered";
  return { ok: true, delivered: Boolean(delivery) };
});
