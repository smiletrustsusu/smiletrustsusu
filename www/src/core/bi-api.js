/**
 * Module 27 public BI / Metric / Schema contracts and in-process gateway mappings.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureBiState,
  listMetrics,
  registerMetric,
  getMetric,
  calculateKpi,
  calculateAllKpis,
  publishKpi,
  registerSchema,
  listSchemas,
  biDashboard
} from "./bi-ops.js";
import { validateMetricDefinition } from "./metric-schema.js";
import { validateSchemaMetadata } from "./schema-metadata.js";

export const BI_API_VERSION = "1.0.0";
export const BI_ERROR_CODES = {
  "BI-001": "Metric schema validation failed",
  "BI-002": "Schema metadata validation failed",
  "BI-003": "Unauthorized BI action",
  "BI-004": "Duplicate identifier",
  "BI-005": "KPI not found",
  "BI-006": "KPI not published",
  "BI-007": "Referenced metric missing",
  "BI-008": "Unsupported KPI formula",
  "BI-009": "Invalid KPI transition",
  "BI-010": "Checksum mismatch",
  "BI-011": "Schema not found",
  "BI-012": "Engine disabled"
};

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

export function listKpisContract(state, payload = {}) {
  ensureBiState(state);
  let rows = [...(state.kpiDefinitions || [])];
  if (payload.status) rows = rows.filter((item) => item.status === payload.status);
  const paged = paginateCollection(rows, payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

registerContractHandler("Bi.Metric.Register.v1", (state, payload, ctx) => registerMetric(state, payload.metric || payload, ...ctxArgs(ctx)));
registerContractHandler("Bi.Metric.Validate.v1", (state, payload) => validateMetricDefinition(payload.metric || payload));
registerContractHandler("Bi.Metric.Get.v1", (state, payload) => {
  const metric = getMetric(state, payload.metricCode || payload.code || payload.metricId);
  return metric ? { ok: true, metric } : { ok: false, error: "Metric not found", errorCode: "BI-005", http: 404 };
});
registerContractHandler("Bi.Metric.List.v1", (state, payload) => listMetrics(state, payload || {}));
registerContractHandler("Bi.Kpi.Calculate.v1", (state, payload, ctx) => calculateKpi(state, payload.kpiCode || payload.code, payload.range || {}, ...ctxArgs(ctx)));
registerContractHandler("Bi.Kpi.CalculateAll.v1", (state, payload, ctx) => calculateAllKpis(state, payload.range || {}, ...ctxArgs(ctx)));
registerContractHandler("Bi.Kpi.Publish.v1", (state, payload, ctx) => publishKpi(state, payload.kpiId || payload.kpiCode || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Bi.Kpi.List.v1", (state, payload) => listKpisContract(state, payload || {}));
registerContractHandler("Bi.Schema.Register.v1", (state, payload, ctx) => registerSchema(state, payload.schema || payload, ...ctxArgs(ctx)));
registerContractHandler("Bi.Schema.Validate.v1", (state, payload) => validateSchemaMetadata(payload.metadata || payload));
registerContractHandler("Bi.Schema.List.v1", (state, payload) => listSchemas(state, payload || {}));
registerContractHandler("Bi.Statistics.v1", (state, payload, ctx) => ({ ok: true, ...biDashboard(state, payload?.range || {}, ctx.user, ctx.uid, ctx.now) }));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("bi.metric.list", (state, request) => listMetrics(state, requestFields(request)));
registerGatewayHandler("bi.metric.validate", (state, request) => validateMetricDefinition(requestFields(request).metric || requestFields(request)));
registerGatewayHandler("bi.kpi.calculate", gateway((state, payload, user, uid, now) => calculateKpi(state, payload.kpiCode || payload.code, payload.range || {}, user, uid, now)));
registerGatewayHandler("bi.kpi.list", (state, request) => listKpisContract(state, requestFields(request)));
registerGatewayHandler("bi.schema.list", (state, request) => listSchemas(state, requestFields(request)));
registerGatewayHandler("bi.schema.validate", (state, request) => validateSchemaMetadata(requestFields(request).metadata || requestFields(request)));
registerGatewayHandler("bi.statistics", (state, request, ctx) => ({ ok: true, ...biDashboard(state, requestFields(request).range || {}, ctx.user, ctx.uid, ctx.now) }));
