/**
 * Module 26 public digital-records contracts and in-process gateway mappings.
 * Other modules must use these contracts for file storage. No REST/GraphQL HTTP server.
 */

import { paginateCollection } from "./api-schema.js";
import { registerContractHandler } from "./module-contracts.js";
import { registerGatewayHandler } from "./api-gateway-ops.js";
import {
  ensureRecordsState,
  uploadRecord,
  versionRecord,
  compareRecordVersions,
  rollbackRecordVersion,
  archiveRecord,
  restoreRecord,
  retireRecord,
  deleteRecord,
  placeLegalHold,
  releaseLegalHold,
  searchRecords,
  previewRecord,
  createDownloadLink,
  downloadRecord,
  shareRecord,
  saveRetentionPolicy,
  recordsDashboard
} from "./records-ops.js";

export const RECORDS_API_VERSION = "1.0.0";
export const RECORDS_ERROR_CODES = {
  "REC-001": "Record not found",
  "REC-002": "Unauthorized records action",
  "REC-003": "Branch scope violation",
  "REC-004": "Invalid record transition",
  "REC-005": "Legal hold active",
  "REC-006": "Retention policy violation",
  "REC-007": "Malware or MIME rejection",
  "REC-008": "Checksum mismatch",
  "REC-009": "Download link expired",
  "REC-010": "Quota exceeded",
  "REC-011": "Concurrency conflict",
  "REC-012": "Engine disabled"
};

function requestFields(request = {}, payload = {}) {
  return { ...(request.params || {}), ...(request.query || {}), ...(request.body || {}), ...payload };
}

function ctxArgs(ctx = {}) {
  return [ctx.user, ctx.uid, ctx.now];
}

function idOf(payload = {}) {
  return payload.recordId || payload.documentId || payload.id || "";
}

export function getRecordContract(state, payload, user) {
  const found = searchRecords(state, { id: idOf(payload) }, user);
  if (!found.ok) return found;
  const record = (found.rows || [])[0];
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  return { ok: true, record };
}

export function listRecordsContract(state, payload = {}, user) {
  const found = searchRecords(state, payload, user);
  if (!found.ok) return found;
  const paged = paginateCollection(found.rows || [], payload);
  if (!paged.ok) return paged;
  return { ok: true, pagination: paged.pagination, rows: paged.data, data: paged.data };
}

registerContractHandler("Records.Upload.v1", (state, payload, ctx) => uploadRecord(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Records.Version.v1", (state, payload, ctx) => versionRecord(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Records.Compare.v1", (state, payload, ctx) => compareRecordVersions(state, idOf(payload), payload.leftId, payload.rightId, ctx.user));
registerContractHandler("Records.Rollback.v1", (state, payload, ctx) => rollbackRecordVersion(state, idOf(payload), payload.versionId, ...ctxArgs(ctx)));
registerContractHandler("Records.Archive.v1", (state, payload, ctx) => archiveRecord(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Restore.v1", (state, payload, ctx) => restoreRecord(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Retire.v1", (state, payload, ctx) => retireRecord(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Delete.v1", (state, payload, ctx) => deleteRecord(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Hold.v1", (state, payload, ctx) => placeLegalHold(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Records.ReleaseHold.v1", (state, payload, ctx) => releaseLegalHold(state, payload.holdId || payload.id, ...ctxArgs(ctx)));
registerContractHandler("Records.Share.v1", (state, payload, ctx) => shareRecord(state, payload, ...ctxArgs(ctx)));
registerContractHandler("Records.Preview.v1", (state, payload, ctx) => previewRecord(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Link.v1", (state, payload, ctx) => createDownloadLink(state, idOf(payload), ...ctxArgs(ctx)));
registerContractHandler("Records.Download.v1", (state, payload, ctx) => downloadRecord(state, idOf(payload), payload.token, ...ctxArgs(ctx)));
registerContractHandler("Records.Policy.v1", (state, payload, ctx) => saveRetentionPolicy(state, payload.policy || payload, ...ctxArgs(ctx)));
registerContractHandler("Records.Search.v1", (state, payload, ctx) => searchRecords(state, payload, ctx.user));
registerContractHandler("Records.Get.v1", (state, payload, ctx) => getRecordContract(state, payload, ctx.user));
registerContractHandler("Records.List.v1", (state, payload, ctx) => listRecordsContract(state, payload, ctx.user));
registerContractHandler("Records.Statistics.v1", (state, payload, ctx) => ({ ok: true, ...recordsDashboard(state, ctx.user) }));

function gateway(fn) {
  return (state, request, ctx) => fn(state, requestFields(request), ctx.user, ctx.uid, ctx.now);
}

registerGatewayHandler("records.upload", gateway(uploadRecord));
registerGatewayHandler("records.search", (state, request, ctx) => searchRecords(state, requestFields(request), ctx.user));
registerGatewayHandler("records.get", (state, request, ctx) => getRecordContract(state, requestFields(request), ctx.user));
registerGatewayHandler("records.list", (state, request, ctx) => listRecordsContract(state, requestFields(request), ctx.user));
registerGatewayHandler("records.archive", (state, request, ctx) => archiveRecord(state, requestFields(request).recordId || requestFields(request).id, ctx.user, ctx.uid, ctx.now));
registerGatewayHandler("records.download", (state, request, ctx) => {
  const fields = requestFields(request);
  return downloadRecord(state, fields.recordId || fields.id, fields.token, ctx.user, ctx.uid, ctx.now);
});
registerGatewayHandler("records.statistics", (state, request, ctx) => ({ ok: true, ...recordsDashboard(state, ctx.user) }));

export { ensureRecordsState };
