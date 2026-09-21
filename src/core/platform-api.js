/**
 * Module 30 public platform contracts and Module 20 gateway mappings.
 * In-process only — no REST/GraphQL HTTP server.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensurePlatformState,
  registerTenant,
  transitionTenant,
  getTenantConfig,
  updateTenantConfig,
  listTenants,
  getPlatformConfig,
  publishPlatformConfig,
  evaluateFeatureFlag,
  setPlatformFlag,
  killFeatureFlag,
  listLicenses,
  issueLicense,
  activateLicense,
  revokeLicense,
  renewLicense,
  enforceLicense,
  listEnvironments,
  updateEnvironment,
  scheduleMaintenance,
  startMaintenance,
  endMaintenance,
  planDeployment,
  approveDeployment,
  executeDeployment,
  rollbackDeployment,
  publishAnnouncement,
  listAnnouncements,
  platformOpsDashboard,
  platformDrDashboard,
  recordDrVerification,
  platformHealth,
  platformReports,
  PLATFORM_ERROR_CODES
} from "./platform-ops.js";

export const PLATFORM_API_VERSION = "1.0.0";
export { PLATFORM_ERROR_CODES };

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

registerContractHandler("Platform.Tenant.Register.v1", (state, payload, ctx) => registerTenant(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.Tenant.Transition.v1", (state, payload, ctx) => transitionTenant(state, payload.tenantId || payload.id, payload.to, ...ctxArgs(ctx), { reason: payload.reason }));
registerContractHandler("Platform.Tenant.Get.v1", (state, payload, ctx) => getTenantConfig(state, payload.tenantId || payload.id, ctx.user));
registerContractHandler("Platform.Tenant.Config.v1", (state, payload, ctx) => updateTenantConfig(state, payload.tenantId || payload.id, payload.patch || payload, ...ctxArgs(ctx)));
registerContractHandler("Platform.Tenant.List.v1", (state, payload, ctx) => listTenants(state, ctx.user));

registerContractHandler("Platform.Config.Get.v1", (state, payload, ctx) => getPlatformConfig(state, payload.key, ctx.user));
registerContractHandler("Platform.Config.Publish.v1", (state, payload, ctx) => publishPlatformConfig(state, payload || {}, ...ctxArgs(ctx)));

registerContractHandler("Platform.Flag.Evaluate.v1", (state, payload, ctx) => evaluateFeatureFlag(state, payload.flagId || payload.id, payload.context || payload, ctx.now));
registerContractHandler("Platform.Flag.Set.v1", (state, payload, ctx) => setPlatformFlag(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.Flag.Kill.v1", (state, payload, ctx) => killFeatureFlag(state, payload.flagId || payload.id, ...ctxArgs(ctx)));

registerContractHandler("Platform.License.List.v1", (state, payload, ctx) => listLicenses(state, ctx.user));
registerContractHandler("Platform.License.Issue.v1", (state, payload, ctx) => issueLicense(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.License.Activate.v1", (state, payload, ctx) => activateLicense(state, payload.licenseId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Platform.License.Revoke.v1", (state, payload, ctx) => revokeLicense(state, payload.licenseId || payload.id, ...ctxArgs(ctx), payload.reason || ""));
registerContractHandler("Platform.License.Renew.v1", (state, payload, ctx) => renewLicense(state, payload.licenseId || payload.id, ...ctxArgs(ctx), payload));
registerContractHandler("Platform.License.Enforce.v1", (state, payload, ctx) => enforceLicense(state, payload || {}, ...ctxArgs(ctx)));

registerContractHandler("Platform.Deploy.Plan.v1", (state, payload, ctx) => planDeployment(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.Deploy.Approve.v1", (state, payload, ctx) => approveDeployment(state, payload.deploymentId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Platform.Deploy.Execute.v1", (state, payload, ctx) => executeDeployment(state, payload.deploymentId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Platform.Deploy.Rollback.v1", (state, payload, ctx) => rollbackDeployment(state, payload.deploymentId || payload.id, ...ctxArgs(ctx)));

registerContractHandler("Platform.Maintenance.Schedule.v1", (state, payload, ctx) => scheduleMaintenance(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.Maintenance.Start.v1", (state, payload, ctx) => startMaintenance(state, payload.windowId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Platform.Maintenance.End.v1", (state, payload, ctx) => endMaintenance(state, payload.windowId || payload.id, ...ctxArgs(ctx)));

registerContractHandler("Platform.Ops.Dashboard.v1", (state, payload, ctx) => platformOpsDashboard(state, ...ctxArgs(ctx)));
registerContractHandler("Platform.Dr.Dashboard.v1", (state, payload, ctx) => platformDrDashboard(state, ...ctxArgs(ctx)));
registerContractHandler("Platform.Dr.Verify.v1", (state, payload, ctx) => recordDrVerification(state, payload || {}, ...ctxArgs(ctx)));

registerContractHandler("Platform.Environment.List.v1", (state, payload, ctx) => listEnvironments(state, ctx.user));
registerContractHandler("Platform.Environment.Update.v1", (state, payload, ctx) => updateEnvironment(state, payload.environmentId || payload.id || payload.code, payload.patch || payload, ...ctxArgs(ctx)));

registerContractHandler("Platform.Announcement.Publish.v1", (state, payload, ctx) => publishAnnouncement(state, payload || {}, ...ctxArgs(ctx)));
registerContractHandler("Platform.Announcement.List.v1", (state, payload, ctx) => listAnnouncements(state, ctx.user));

registerContractHandler("Platform.Health.v1", (state, payload, ctx) => ({ ok: true, ...platformHealth(state, ctx.now) }));
registerContractHandler("Platform.Reports.v1", (state, payload) => ({ ok: true, ...platformReports(state, payload.reportId || payload.id) }));
registerContractHandler("Platform.Tenant.Paged.v1", (state, payload, ctx) => {
  ensurePlatformState(state);
  const listed = listTenants(state, ctx.user);
  if (!listed.ok) return listed;
  const paged = paginateCollection(listed.rows || [], payload || {});
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
});

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("platform.health", (state, request, ctx) => ({ ok: true, ...platformHealth(state, ctx.now) }));
registerGatewayHandler("platform.ops.dashboard", (state, request, ctx) => platformOpsDashboard(state, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("platform.tenant.list", (state, request, ctx) => listTenants(state, ctx.user));
registerGatewayHandler("platform.tenant.register", gateway((state, payload, user, uid, now) => registerTenant(state, payload, user, uid, now)));
registerGatewayHandler("platform.tenant.transition", gateway((state, payload, user, uid, now) => transitionTenant(state, payload.tenantId || payload.id, payload.to, user, uid, now, { reason: payload.reason })));
registerGatewayHandler("platform.config.get", (state, request, ctx) => getPlatformConfig(state, requestFields(request).key, ctx.user));
registerGatewayHandler("platform.config.publish", gateway((state, payload, user, uid, now) => publishPlatformConfig(state, payload, user, uid, now)));
registerGatewayHandler("platform.flag.evaluate", gateway((state, payload, user, uid, now) => evaluateFeatureFlag(state, payload.flagId || payload.id, payload.context || payload, now)));
registerGatewayHandler("platform.flag.set", gateway((state, payload, user, uid, now) => setPlatformFlag(state, payload, user, uid, now)));
registerGatewayHandler("platform.flag.kill", gateway((state, payload, user, uid, now) => killFeatureFlag(state, payload.flagId || payload.id, user, uid, now)));
registerGatewayHandler("platform.license.list", (state, request, ctx) => listLicenses(state, ctx.user));
registerGatewayHandler("platform.license.enforce", gateway((state, payload, user, uid, now) => enforceLicense(state, payload, user, uid, now)));
registerGatewayHandler("platform.deploy.plan", gateway((state, payload, user, uid, now) => planDeployment(state, payload, user, uid, now)));
registerGatewayHandler("platform.deploy.approve", gateway((state, payload, user, uid, now) => approveDeployment(state, payload.deploymentId || payload.id, user, uid, now)));
registerGatewayHandler("platform.maintenance.start", gateway((state, payload, user, uid, now) => startMaintenance(state, payload.windowId || payload.id, user, uid, now)));
registerGatewayHandler("platform.environment.list", (state, request, ctx) => listEnvironments(state, ctx.user));
registerGatewayHandler("platform.dr.dashboard", (state, request, ctx) => platformDrDashboard(state, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("platform.announcement.list", (state, request, ctx) => listAnnouncements(state, ctx.user));
