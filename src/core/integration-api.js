/**
 * Module 28 public Integration contracts and Module 20 gateway mappings.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureIntegrationState,
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
  integrationHealth,
  integrationDashboard,
  integrationReports,
  publishMessage,
  subscribe,
  consumeNext,
  ackMessage,
  assignOwnership,
  advanceMilestone,
  requestDeadlineChange,
  approveDeadlineChange,
  deliveryDashboard
} from "./integration-ops.js";
import { INT_ERROR_CODES } from "./integration-lifecycle.js";

export const INTEGRATION_API_VERSION = "1.0.0";
export { INT_ERROR_CODES as INTEGRATION_ERROR_CODES };

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

registerContractHandler("Integration.Provider.Register.v1", (state, payload, ctx) => registerProvider(state, payload.provider || payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Provider.List.v1", (state, payload) => listProviders(state, payload || {}));
registerContractHandler("Integration.Provider.Status.v1", (state, payload, ctx) => setProviderStatus(state, payload.providerCode || payload.code, payload.status, ...ctxArgs(ctx)));
registerContractHandler("Integration.Client.Register.v1", (state, payload, ctx) => registerIntegrationClient(state, payload.client || payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Key.Issue.v1", (state, payload, ctx) => issueIntegrationKey(state, payload.clientId, ...ctxArgs(ctx)));
registerContractHandler("Integration.OAuth.Register.v1", (state, payload, ctx) => registerOauthClient(state, payload.client || payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Webhook.Register.v1", (state, payload, ctx) => registerWebhook(state, payload.webhook || payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Webhook.Receive.v1", (state, payload, ctx) => receiveInboundWebhook(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Webhook.Deliver.v1", (state, payload, ctx) => deliverOutboundWebhook(state, payload.webhookId, payload.payload || payload.body || {}, ...ctxArgs(ctx)));
registerContractHandler("Integration.Webhook.Replay.v1", (state, payload, ctx) => replayWebhookDelivery(state, payload.deliveryId, ...ctxArgs(ctx)));
registerContractHandler("Integration.Transform.Register.v1", (state, payload, ctx) => registerTransform(state, payload.transform || payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Transform.Run.v1", (state, payload, ctx) => runTransform(state, payload.transformId || payload.code, payload.payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Dispatch.v1", (state, payload, ctx) => hubDispatch(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Health.v1", (state, payload, ctx) => ({ ok: true, ...integrationHealth(state, ctx.now) }));
registerContractHandler("Integration.Dashboard.v1", (state, payload, ctx) => ({ ok: true, ...integrationDashboard(state, ctx.user, ctx.uid, ctx.now) }));
registerContractHandler("Integration.Usage.v1", (state, payload) => {
  ensureIntegrationState(state);
  const rows = state.integrationUsageStatistics || [];
  const paged = paginateCollection(rows, payload || {});
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
});
registerContractHandler("Integration.Queue.Publish.v1", (state, payload, ctx) => publishMessage(state, payload, ctx.uid, ctx.now));
registerContractHandler("Integration.Queue.Subscribe.v1", (state, payload, ctx) => subscribe(state, payload, ctx.uid, ctx.now));
registerContractHandler("Integration.Queue.Consume.v1", (state, payload, ctx) => consumeNext(state, payload.queue, payload.consumer, ctx.uid, ctx.now));
registerContractHandler("Integration.Queue.Ack.v1", (state, payload, ctx) => ackMessage(state, payload.messageId, ctx.now));
registerContractHandler("Integration.Delivery.Assign.v1", (state, payload, ctx) => assignOwnership(state, payload.deliverableCode, payload.ownership || {}, ...ctxArgs(ctx)));
registerContractHandler("Integration.Delivery.Advance.v1", (state, payload, ctx) => advanceMilestone(state, payload.deliverableCode, payload.milestone, ...ctxArgs(ctx)));
registerContractHandler("Integration.Delivery.DeadlineRequest.v1", (state, payload, ctx) => requestDeadlineChange(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Integration.Delivery.DeadlineApprove.v1", (state, payload, ctx) => approveDeadlineChange(state, payload.changeRequestId, ...ctxArgs(ctx)));
registerContractHandler("Integration.Delivery.Dashboard.v1", (state, payload, ctx) => ({ ok: true, ...deliveryDashboard(state, ctx.now) }));
registerContractHandler("Integration.Reports.v1", (state, payload) => ({ ok: true, ...integrationReports(state, payload.reportId || payload.id) }));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("integration.health", (state, request, ctx) => ({ ok: true, ...integrationHealth(state, ctx.now) }));
registerGatewayHandler("integration.dashboard", (state, request, ctx) => ({ ok: true, ...integrationDashboard(state, ctx.user, ctx.uid, ctx.now) }));
registerGatewayHandler("integration.dispatch", gateway((state, payload, user, uid, now) => hubDispatch(state, payload, user, uid, now)));
registerGatewayHandler("integration.provider.list", (state, request) => listProviders(state, requestFields(request)));
registerGatewayHandler("integration.provider.register", gateway((state, payload, user, uid, now) => registerProvider(state, payload, user, uid, now)));
registerGatewayHandler("integration.webhook.register", gateway((state, payload, user, uid, now) => registerWebhook(state, payload, user, uid, now)));
registerGatewayHandler("integration.webhook.receive", gateway((state, payload, user, uid, now) => receiveInboundWebhook(state, payload, user, uid, now)));
registerGatewayHandler("integration.client.register", gateway((state, payload, user, uid, now) => registerIntegrationClient(state, payload, user, uid, now)));
registerGatewayHandler("integration.key.issue", gateway((state, payload, user, uid, now) => issueIntegrationKey(state, payload.clientId, user, uid, now)));
registerGatewayHandler("integration.transform.run", gateway((state, payload, user, uid, now) => runTransform(state, payload.transformId || payload.code, payload.payload, user, uid, now)));
registerGatewayHandler("integration.queue.publish", gateway((state, payload, user, uid, now) => publishMessage(state, payload, uid, now)));
registerGatewayHandler("integration.usage", (state, request) => {
  ensureIntegrationState(state);
  const paged = paginateCollection(state.integrationUsageStatistics || [], requestFields(request));
  return paged.ok ? { ok: true, pagination: paged.pagination, rows: paged.data } : paged;
});
registerGatewayHandler("integration.delivery.dashboard", (state, request, ctx) => ({ ok: true, ...deliveryDashboard(state, ctx.now) }));
