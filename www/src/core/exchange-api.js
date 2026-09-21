/**
 * Module 25 public data-exchange contracts and in-process gateway mappings.
 * Other modules must use these contracts. No REST/GraphQL HTTP server.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureExchangeState,
  validateImport,
  importExchange,
  exportExchange,
  migrateExchange,
  bulkExchange,
  approveExportJob,
  rollbackImport,
  controlExchangeJob,
  saveMappingTemplate,
  requestExportPermissionAssignment,
  advanceExportPermissionAssignment,
  exchangeDashboard
} from "./exchange-ops.js";

export const EXCHANGE_API_VERSION = "1.0.0";
export const EXCHANGE_ERROR_CODES = {
  "EX-001": "Dataset or job not found",
  "EX-002": "Unauthorized exchange action",
  "EX-003": "Branch scope violation",
  "EX-004": "Approval required",
  "EX-005": "Format not permitted",
  "EX-006": "Validation failed",
  "EX-007": "Quota exceeded",
  "EX-008": "Restricted field",
  "EX-009": "Invalid job state",
  "EX-010": "Concurrency conflict",
  "EX-011": "Segregation of duties",
  "EX-012": "Engine disabled"
};

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

export function listJobsContract(state, payload = {}) {
  ensureExchangeState(state);
  const kind = payload.kind || "export";
  const source = kind === "import" ? state.importJobs : kind === "migration" ? state.migrationJobs : state.exportJobs;
  const paged = paginateCollection(source || [], payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

export function historyContract(state, payload = {}) {
  ensureExchangeState(state);
  const kind = payload.kind || "export";
  const source = kind === "import" ? state.importHistory : kind === "migration" ? state.migrationHistory : state.exportHistory;
  const paged = paginateCollection([...(source || [])].reverse(), payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

export function errorsContract(state, payload = {}) {
  ensureExchangeState(state);
  let rows = [...(state.validationErrors || [])];
  if (payload.dataset) rows = rows.filter((item) => item.dataset === payload.dataset);
  const paged = paginateCollection(rows, payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

export function templatesContract(state) {
  ensureExchangeState(state);
  return { ok: true, templates: state.mappingTemplates || [] };
}

registerContractHandler("Exchange.Validate.v1", (state, payload, ctx) => validateImport(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Import.v1", (state, payload, ctx) => importExchange(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Export.v1", (state, payload, ctx) => exportExchange(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Migrate.v1", (state, payload, ctx) => migrateExchange(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Bulk.v1", (state, payload, ctx) => bulkExchange(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Map.v1", (state, payload, ctx) => saveMappingTemplate(state, payload.template || payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Approve.v1", (state, payload, ctx) => approveExportJob(state, payload.jobId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Rollback.v1", (state, payload, ctx) => rollbackImport(state, payload.jobId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Exchange.Control.v1", (state, payload, ctx) => controlExchangeJob(state, payload.jobId || payload.id, payload.action, ...ctxArgs(ctx)));
registerContractHandler("Exchange.RequestPermission.v1", (state, payload, ctx) => requestExportPermissionAssignment(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Exchange.AdvancePermission.v1", (state, payload, ctx) => advanceExportPermissionAssignment(state, payload.requestId || payload.id, payload.step, ctx.user, ctx.uid, ctx.now, payload.decision));
registerContractHandler("Exchange.Jobs.v1", (state, payload) => listJobsContract(state, payload));
registerContractHandler("Exchange.History.v1", (state, payload) => historyContract(state, payload));
registerContractHandler("Exchange.Errors.v1", (state, payload) => errorsContract(state, payload));
registerContractHandler("Exchange.Templates.v1", (state) => templatesContract(state));
registerContractHandler("Exchange.Statistics.v1", (state) => ({ ok: true, ...exchangeDashboard(state) }));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("exchange.import", gateway(importExchange));
registerGatewayHandler("exchange.export", gateway(exportExchange));
registerGatewayHandler("exchange.validate", gateway(validateImport));
registerGatewayHandler("exchange.migrate", gateway(migrateExchange));
registerGatewayHandler("exchange.bulk", gateway(bulkExchange));
registerGatewayHandler("exchange.approve", (state, request, ctx) => approveExportJob(state, requestFields(request).jobId, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("exchange.jobs", (state, request) => listJobsContract(state, requestFields(request)));
registerGatewayHandler("exchange.history", (state, request) => historyContract(state, requestFields(request)));
registerGatewayHandler("exchange.statistics", (state) => ({ ok: true, ...exchangeDashboard(state) }));
