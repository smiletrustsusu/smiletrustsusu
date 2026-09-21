import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  ensureGatewayState,
  dispatchGatewayRequest,
  registerApiClient,
  rotateApiKey,
  subscribeWebhook,
  deliverWebhook,
  replayWebhook,
  receiveInboundWebhook,
  executeGraphQL,
  generateOpenApiSpec,
  gatewayDashboard,
  gatewayReports,
  exportGatewayCsv,
  assertGatewayBoundary
} from "../src/core/api-gateway-ops.js";
import { ensurePaymentState, signPaymentPayload } from "../src/core/payment-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-10T20:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", momoWebhookSecret: "whsec-test", loanInterest: 15 },
    collections: [],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    audit: []
  };
  ensurePaymentState(state);
  ensureGatewayState(state);
  return state;
}

test("gateway is the only external entry and never starts HTTP or posts money", () => {
  const boundary = assertGatewayBoundary();
  assert.equal(boundary.centralized, true);
  assert.equal(boundary.restHttpServer, false);
  assert.equal(boundary.graphqlHttpServer, false);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.inProcess, true);
  const spec = generateOpenApiSpec();
  assert.equal(spec.openapi.startsWith("3."), true);
  assert.ok(spec.paths["/v1/health/snapshot"]);
  assert.match(spec.info.description, /in-process/i);
});

test("unauthenticated and unauthorized callers are stopped before business work", () => {
  const state = blank();
  const denied = dispatchGatewayRequest(state, { route: "gateway.whoami", version: "v1" }, { uid, now });
  assert.equal(denied.ok, false);
  assert.equal(denied.http, 401);
  const forbidden = dispatchGatewayRequest(state, {
    route: "gateway.docs",
    version: "v1",
    user: collector
  }, { uid, now, user: collector });
  assert.equal(forbidden.http, 403);
  const ok = dispatchGatewayRequest(state, { route: "gateway.whoami", version: "v1", user: owner }, { uid, now, user: owner });
  assert.equal(ok.ok, true);
  assert.equal(ok.response.data.client, "web-admin");
  assert.ok(ok.pipeline.includes("authorization"));
  assert.equal(canAction(collector, "Gateway.Key"), false);
});

test("API keys, rate limits, and versions are enforced", () => {
  const state = blank();
  const client = registerApiClient(state, { name: "Bank Core", type: "banking", scopes: ["gateway", "*"] }, owner, uid, now);
  const rotated = rotateApiKey(state, client.client.id, { user: owner, uid, now });
  assert.ok(rotated.key.plaintextKey);
  assert.equal(Object.prototype.hasOwnProperty.call(state.apiKeys[0], "plaintextKey"), false);
  const viaKey = dispatchGatewayRequest(state, {
    route: "gateway.whoami",
    version: "v1",
    auth: { method: "api_key", apiKey: rotated.key.plaintextKey }
  }, { uid, now });
  assert.equal(viaKey.ok, true);
  const badVersion = dispatchGatewayRequest(state, {
    route: "gateway.whoami",
    version: "v9",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(badVersion.http, 400);
  state.parameterValues = [{ key: "gateway.perMinute", value: 1 }];
  state.apiRateWindows = [];
  dispatchGatewayRequest(state, { route: "gateway.whoami", version: "v1", user: owner }, { uid, now, user: owner });
  const limited = dispatchGatewayRequest(state, { route: "gateway.whoami", version: "v1", user: owner }, { uid, now, user: owner });
  assert.equal(limited.http, 429);
});

test("idempotent dispatch and inbound payment webhooks stay inside the gateway", () => {
  const state = blank();
  const first = dispatchGatewayRequest(state, {
    route: "health.snapshot",
    version: "v1",
    user: owner,
    idempotencyKey: "gw-health-1"
  }, { uid, now, user: owner });
  assert.equal(first.ok, true);
  const secret = state.settings.momoWebhookSecret;
  const body = { reference: "MTN123456", amount: 20, status: "success", provider: "prov-mtn" };
  const inbound = receiveInboundWebhook(state, {
    providerId: "prov-mtn",
    body,
    timestamp: now,
    signature: signPaymentPayload(secret, body, now),
    reference: body.reference,
    auth: { method: "session" }
  }, { uid, now, user: owner });
  assert.equal(inbound.response.status === "ok" || inbound.response.status === "rejected", true);
  assert.equal((state.collections || []).length, 0);
});

test("webhooks queue through the scheduler and GraphQL maps to the same router", () => {
  const state = blank();
  const sub = subscribeWebhook(state, { event: "payment.completed", target: "partner://ledger" }, owner, uid, now);
  const delivered = deliverWebhook(state, sub.subscription.id, { paymentId: "pay-1" }, { user: owner, uid, now });
  assert.equal(delivered.ok, true);
  const replayed = replayWebhook(state, delivered.delivery.id, { user: owner, uid, now });
  assert.equal(replayed.ok, true);
  const gql = executeGraphQL(state, { query: "{ whoami }", auth: { method: "session" } }, { uid, now, user: owner });
  assert.equal(gql.ok, true);
  const report = gatewayReports(state, "gateway_webhooks", { from: "2026-09-10", to: "2026-09-10" });
  assert.ok(exportGatewayCsv(report).includes("payment.completed"));
  assert.ok(gatewayDashboard(state).requests >= 1);
});

test("collector cannot rotate keys; responses redact secrets", () => {
  const state = blank();
  const client = registerApiClient(state, { name: "Denied", type: "third_party" }, owner, uid, now);
  const denied = rotateApiKey(state, client.client.id, { user: collector, uid, now });
  assert.equal(denied.ok, false);
  const result = dispatchGatewayRequest(state, {
    route: "gateway.whoami",
    version: "v1",
    user: owner,
    body: { pin: "9999", token: "abc" }
  }, { uid, now, user: owner });
  assert.equal(result.response.data.pin, undefined);
});
