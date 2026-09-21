import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { assertIntegrationLifecycleBoundary, DELIVERY_MILESTONES } from "../src/core/integration-lifecycle.js";
import { jsonToXml, xmlToJson, runTransformDefinition } from "../src/core/integration-transforms.js";
import {
  publishMessage,
  consumeNext,
  ackMessage,
  nackMessage,
  replayMessage,
  assertMessagingBoundary
} from "../src/core/integration-messaging.js";
import {
  assignOwnership,
  advanceMilestone,
  requestDeadlineChange,
  approveDeadlineChange,
  setDeliveryStatus,
  deliveryDashboard,
  assertDeliveryBoundary
} from "../src/core/integration-delivery.js";
import {
  ensureIntegrationState,
  assertIntegrationBoundary,
  registerProvider,
  listProviders,
  setProviderStatus,
  registerIntegrationClient,
  issueIntegrationKey,
  registerOauthClient,
  registerWebhook,
  receiveInboundWebhook,
  deliverOutboundWebhook,
  replayWebhookDelivery,
  registerTransform,
  runTransform,
  hubDispatch,
  evaluateAuthPolicy,
  checkReplayProtection,
  circuitAllow,
  circuitRecord,
  integrationHealth,
  integrationDashboard
} from "../src/core/integration-ops.js";
import "../src/core/integration-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { payloadHash } from "../src/core/audit-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-12T09:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31, momoWebhookSecret: "whsec-int" },
    collections: [],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    audit: [],
    notifications: [],
    featureFlags: [{ id: "enableEnterpriseIntegration", enabled: true }],
    parameterValues: []
  };
  ensureGatewayState(state);
  ensureIntegrationState(state, uid, now);
  return state;
}

test("integration hub boundary: in-process, no money posts, no PIN storage", () => {
  assert.equal(assertIntegrationLifecycleBoundary().postsCollections, false);
  assert.equal(assertIntegrationLifecycleBoundary().restHttp, false);
  const boundary = assertIntegrationBoundary();
  assert.equal(boundary.extendsModule20, true);
  assert.equal(boundary.restHttpServer, false);
  assert.equal(boundary.graphqlHttpServer, false);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.storesMomoPins, false);
  assert.equal(assertMessagingBoundary().inMemory, true);
  assert.equal(assertDeliveryBoundary().milestones, 10);
  assert.equal(canAction(collector, "Integration.Admin"), false);
  assert.equal(canAction(owner, "Integration.View"), true);
});

test("routing, auth policies, rate limits, and versioned hub dispatch", () => {
  const state = blank();
  const denied = hubDispatch(state, { providerCode: "MTN_MOMO", operation: "health", authPolicy: "api_key" }, null, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "INT-016");

  const client = registerIntegrationClient(state, { name: "Bank Partner", type: "banking" }, owner, uid, now);
  const key = issueIntegrationKey(state, client.client.id, owner, uid, now);
  assert.ok(key.key.plaintextKey);
  assert.equal(Object.prototype.hasOwnProperty.call(state.integrationApiKeys[0], "plaintextKey"), false);

  const viaKey = hubDispatch(state, {
    providerCode: "MTN_MOMO",
    operation: "health",
    authPolicy: "api_key",
    auth: { method: "api_key", apiKey: key.key.plaintextKey }
  }, null, uid, now);
  assert.equal(viaKey.ok, true);
  assert.equal(viaKey.response.body.postsCollections, false);

  state.integrationRateLimits.find((item) => item.scope === "endpoint").perMinute = 1;
  state._integrationRateWindows = [];
  hubDispatch(state, { providerCode: "MTN_MOMO", operation: "ping", authPolicy: "session" }, owner, uid, now);
  const limited = hubDispatch(state, { providerCode: "MTN_MOMO", operation: "ping", authPolicy: "session" }, owner, uid, now);
  assert.equal(limited.http, 429);
  assert.equal(limited.errorCode, "INT-008");

  const jwtOk = evaluateAuthPolicy(state, { authPolicy: "jwt", auth: { token: "aaa.bbb.ccc", bypassClientCheck: true } });
  assert.equal(jwtOk.ok, true);
  registerOauthClient(state, { name: "OIDC", clientSecret: "secret" }, owner, uid, now);
  const oauthOk = evaluateAuthPolicy(state, { authPolicy: "oauth2", auth: { token: "x.y.z" } });
  assert.equal(oauthOk.ok, true);
  const mtls = evaluateAuthPolicy(state, { authPolicy: "mtls", auth: { clientCertFingerprint: "abc" } });
  assert.equal(mtls.ok, true);
});

test("transforms, currency pesewas, and field maps", () => {
  const state = blank();
  const xml = jsonToXml({ a: 1, b: "x" }, "root");
  assert.match(xml, /<root>/);
  assert.equal(xmlToJson(xml).a, 1);
  const currency = runTransform(state, "XF-CURRENCY-PESEWAS", { amount: 2500 }, owner, uid, now);
  assert.equal(currency.ok, true);
  assert.equal(currency.result.amount, 25);
  const mapped = runTransformDefinition({ kind: "field_map", fieldMap: { customerId: "member_id" } }, { customerId: "c-1", amount: 10 });
  assert.equal(mapped.result.member_id, "c-1");
  const registered = registerTransform(state, { code: "XF-CSV", kind: "csv", version: "1.0.0", columns: ["id", "name"] }, owner, uid, now);
  assert.equal(registered.ok, true);
});

test("provider failover, circuit breaker, and security boundaries", () => {
  const state = blank();
  const listed = listProviders(state, { category: "momo" });
  assert.ok(listed.rows.length >= 2);
  setProviderStatus(state, "MTN_MOMO", "suspended", owner, uid, now);
  const failOver = hubDispatch(state, {
    providerCode: "MTN_MOMO",
    operation: "collect_status",
    authPolicy: "session",
    payload: { note: "status only" }
  }, owner, uid, now);
  assert.equal(failOver.ok, true);
  assert.notEqual(failOver.provider.code, "MTN_MOMO");

  const key = "TEST_CIRCUIT";
  for (let i = 0; i < 5; i += 1) circuitRecord(state, key, false, now);
  const blocked = circuitAllow(state, key, now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "INT-009");

  const pinReject = registerProvider(state, {
    code: "BAD_PIN",
    name: "Bad",
    category: "momo",
    momoPin: "1234"
  }, owner, uid, now);
  assert.equal(pinReject.errorCode, "INT-022");

  const replay1 = checkReplayProtection(state, { nonce: "n-1", timestamp: now }, now);
  const replay2 = checkReplayProtection(state, { nonce: "n-1", timestamp: now }, now);
  assert.equal(replay1.ok, true);
  assert.equal(replay2.errorCode, "INT-012");
});

test("webhooks: HMAC, retry/DLQ, replay", () => {
  const state = blank();
  const wh = registerWebhook(state, { direction: "inbound", eventType: "momo.callback" }, owner, uid, now);
  assert.equal(wh.ok, true);
  const body = { reference: "pay-1", status: "Completed" };
  const signature = payloadHash(`whsec-int.${JSON.stringify(body)}`);
  const inbound = receiveInboundWebhook(state, {
    webhookId: wh.webhook.id,
    body,
    signature,
    nonce: "wh-n-1",
    timestamp: now
  }, owner, uid, now);
  assert.equal(inbound.ok, true);
  assert.equal(inbound.postsCollections, false);

  const out = registerWebhook(state, { direction: "outbound", eventType: "partner.notify", retryMax: 3 }, owner, uid, now);
  const failed = deliverOutboundWebhook(state, out.webhook.id, { __forceFail: true }, owner, uid, now);
  assert.equal(failed.ok, false);
  assert.equal(failed.delivery.status, "dead_letter");
  const replayed = replayWebhookDelivery(state, failed.delivery.id, owner, uid, now);
  assert.equal(replayed.ok, true);
});

test("message broker: pub/sub, ack, DLQ, idempotent publish", () => {
  const state = blank();
  const first = publishMessage(state, { queue: "events", payload: { a: 1 }, idempotencyKey: "ik-1" }, uid, now);
  const dup = publishMessage(state, { queue: "events", payload: { a: 1 }, idempotencyKey: "ik-1" }, uid, now);
  assert.equal(first.ok, true);
  assert.equal(dup.replayed, true);
  const consumed = consumeNext(state, "events", "c1", uid, now);
  assert.equal(consumed.message.id, first.message.id);
  ackMessage(state, consumed.message.id, now);
  const m2 = publishMessage(state, { queue: "events", payload: { b: 2 } }, uid, now);
  const c2 = consumeNext(state, "events", "c1", uid, now);
  nackMessage(state, c2.message.id, { deadLetter: true }, now);
  assert.equal(c2.message.status, "dead_letter");
  const replayed = replayMessage(state, m2.message.id, uid, now);
  assert.equal(replayed.ok, true);
});

test("ownership, milestone sequencing, deadline change control, reporting", () => {
  const state = blank();
  const code = state.integrationDeliverables[0].code;
  const assigned = assignOwnership(state, code, {
    "Primary Owner": { assignee: "Ama Platform" }
  }, owner, uid, now);
  assert.equal(assigned.ok, true);
  assert.equal(assigned.deliverable.deadline.ownership["Primary Owner"].assignee, "Ama Platform");

  const skip = advanceMilestone(state, code, "Feature Complete", owner, uid, now);
  assert.equal(skip.errorCode, "INT-019");

  let current = state.integrationDeliverables[0].deadline.currentMilestone;
  while (current !== "Development Started") {
    const next = DELIVERY_MILESTONES[DELIVERY_MILESTONES.indexOf(current) + 1];
    const advanced = advanceMilestone(state, code, next, owner, uid, now);
    assert.equal(advanced.ok, true, advanced.error);
    current = advanced.deliverable.deadline.currentMilestone;
  }
  const feature = advanceMilestone(state, code, "Feature Complete", owner, uid, now);
  assert.equal(feature.ok, true);

  const req = requestDeadlineChange(state, {
    deliverableCode: code,
    newDeadline: "2026-12-01T00:00:00.000Z",
    justification: "Scope expansion",
    changeRequestId: "CR-28-1"
  }, owner, uid, now);
  assert.equal(req.ok, true);
  const approved = approveDeadlineChange(state, "CR-28-1", owner, uid, now);
  assert.equal(approved.ok, true);
  assert.equal(approved.deliverable.deadline.plannedEnd, "2026-12-01T00:00:00.000Z");
  const again = approveDeadlineChange(state, "CR-28-1", owner, uid, now);
  assert.equal(again.errorCode, "INT-021");

  setDeliveryStatus(state, code, "At Risk", owner, uid, now);
  const dash = deliveryDashboard(state, now);
  assert.ok(dash.deliverables >= 10);
  assert.ok(dash.releaseReadinessPct >= 0);
  assert.ok((state.audit || []).some((item) => String(item.action || "").includes("Integration")));
});

test("contracts and Module 20 gateway routes for integration", () => {
  const state = blank();
  assert.ok(getContract("Integration.Dispatch.v1"));
  assert.ok(getContract("Integration.Delivery.Dashboard.v1"));
  const health = invokeContract(state, { contractId: "Integration.Health.v1", fromModule: 20, payload: {} }, { user: owner, uid, now });
  assert.equal(health.ok, true);
  const viaGw = dispatchGatewayRequest(state, {
    route: "integration.health",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(viaGw.ok, true);
  const dash = integrationDashboard(state, owner, uid, now);
  assert.ok(dash.providers > 0);
  assert.equal(integrationHealth(state, now).liveness, true);
});
