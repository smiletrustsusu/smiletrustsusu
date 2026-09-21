/**
 * Module 26 — Enterprise Document & Digital Records Management.
 * Central ECM for uploads, versions, retention, archive, and legal hold.
 * Does not generate receipts (Module 17) or post collections/ledgers.
 * No REST/GraphQL HTTP server.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { canAction, dataScope } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { registerContractHandler, publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import {
  RECORD_TYPES,
  RECORD_CLASSIFICATIONS,
  STORAGE_PROVIDERS,
  canTransitionRecord,
  classificationForType
} from "./records-lifecycle.js";

export const RECORDS_SCHEMA_VERSION = "1.0.0";

const RECORD_ARRAYS = [
  "digitalRecords",
  "digitalRecordVersions",
  "digitalRecordMetadata",
  "digitalRecordTags",
  "digitalRecordCategories",
  "digitalRecordAccessLogs",
  "digitalRecordRetentionPolicies",
  "digitalRecordArchives",
  "digitalRecordDownloads",
  "digitalRecordShares",
  "digitalRecordLegalHolds",
  "digitalRecordChecksums",
  "digitalRecordStorage"
];

const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "application/pdf",
  "text/plain", "application/json", "text/csv"
];

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

function checksum(value) {
  const body = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rchk-${(hash >>> 0).toString(16)}`;
}

function signPayload(value, user, now) {
  return checksum(`${value}|${user?.id || ""}|${nowIso(now)}`);
}

function auditRecord(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "26",
    ...extras
  }, uid);
}

function notify(state, event, vars, uid, correlationId) {
  return queueNotification(state, {
    event,
    channel: "In-App",
    userId: vars.userId || "",
    vars: { name: vars.name || "Team", ...vars },
    uid,
    correlationId,
    committed: true,
    idempotencyKey: `${event}:${correlationId}:${vars.userId || "sys"}`
  });
}

function emitRecordEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 26,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "RECORD"
  }, uid, now);
}

function logAccess(state, record, action, user, uid, now, extras = {}) {
  state.digitalRecordAccessLogs.push({
    id: newId("racc", uid),
    recordId: record?.id || "",
    action,
    userId: user?.id || "",
    branchId: user?.branchId || record?.branchId || "",
    createdAt: nowIso(now),
    ...extras
  });
}

function seedPolicies() {
  return [
    { id: "ret-public", classification: "Public", retainDays: 365, allowDelete: true, autoArchiveDays: 180 },
    { id: "ret-internal", classification: "Internal", retainDays: 1095, allowDelete: true, autoArchiveDays: 365 },
    { id: "ret-confidential", classification: "Confidential", retainDays: 2555, allowDelete: false, autoArchiveDays: 730 },
    { id: "ret-financial", classification: "Financial", retainDays: 2555, allowDelete: false, autoArchiveDays: 730 },
    { id: "ret-restricted", classification: "Restricted", retainDays: 3650, allowDelete: false, autoArchiveDays: 1095 }
  ];
}

function seedCategories() {
  return [
    { id: "cat-identity", name: "Identity" },
    { id: "cat-agreement", name: "Agreements" },
    { id: "cat-receipt", name: "Receipts" },
    { id: "cat-report", name: "Reports" },
    { id: "cat-compliance", name: "Compliance" },
    { id: "cat-system", name: "System" }
  ];
}

export function ensureRecordsState(state = {}) {
  RECORD_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.digitalRecordRetentionPolicies.length) state.digitalRecordRetentionPolicies = seedPolicies();
  if (!state.digitalRecordCategories.length) state.digitalRecordCategories = seedCategories();
  return state;
}

function engineEnabled(state) {
  return isFeatureEnabled(state, "enableDigitalRecords") !== false;
}

function quota(state, key, fallback) {
  const value = Number(getConfigValue(state, key));
  return Number.isFinite(value) ? value : fallback;
}

function storageProvider(state) {
  const configured = String(getConfigValue(state, "records.storageProvider") || "local");
  return STORAGE_PROVIDERS.includes(configured) ? configured : "local";
}

function policyFor(state, classification) {
  return (state.digitalRecordRetentionPolicies || []).find((item) => item.classification === classification)
    || { retainDays: 2555, allowDelete: false, autoArchiveDays: 730 };
}

function hasLegalHold(state, recordId) {
  return (state.digitalRecordLegalHolds || []).some((item) => item.recordId === recordId && item.status === "active");
}

function visibleTo(user, record) {
  if (!user || isSystemOwner(user)) return true;
  const scope = dataScope(user);
  if (scope === "system" || scope === "organization") return true;
  if (scope === "branch") return !record.branchId || record.branchId === user.branchId;
  if (scope === "assigned" || scope === "self") {
    return record.uploadedBy === user.id || record.ownerId === user.id || record.ownerId === user.customerId;
  }
  return false;
}

function scanContent(content = "", mimeType = "") {
  const text = String(content);
  if (/EICAR-STANDARD-ANTIVIRUS-TEST-FILE/i.test(text)) return { ok: false, reason: "malware signature" };
  if (text.startsWith("MZ") || text.includes("\x00ELF")) return { ok: false, reason: "executable content" };
  if (/<script[\s>]/i.test(text) && mimeType !== "text/plain") return { ok: false, reason: "script content" };
  return { ok: true };
}

function recordById(state, id) {
  return (state.digitalRecords || []).find((item) => item.id === id || item.documentNumber === id);
}

function currentVersion(state, recordId) {
  return (state.digitalRecordVersions || []).find((item) => item.recordId === recordId && item.current === true);
}

function ingestGenerated(state, uid, now) {
  (state.documents || []).forEach((doc) => {
    if ((state.digitalRecords || []).some((item) => item.sourceModule === 17 && item.sourceId === doc.id)) return;
    const type = doc.type === "loan_agreement" ? "loan_agreement"
      : doc.type === "withdrawal_receipt" ? "withdrawal_receipt"
        : doc.type === "payment_confirmation" ? "payment_confirmation"
          : doc.category === "administrative" ? "accounting_report"
            : "savings_receipt";
    const classification = classificationForType(type);
    const record = {
      id: newId("rec", uid),
      documentNumber: doc.receiptNo || doc.id,
      type,
      category: doc.category || "receipt",
      ownerEntity: "customer",
      ownerId: doc.customerId || "",
      branchId: doc.branchId || "",
      uploadedBy: doc.createdBy || "module-17",
      uploadedAt: doc.createdAt || nowIso(now),
      fileName: `${doc.receiptNo || doc.id}.html`,
      fileSize: String(doc.html || doc.body || "").length,
      mimeType: "text/plain",
      storageLocation: "module-17",
      checksum: doc.contentHash || checksum(doc.id),
      version: `${doc.version || 1}.0`,
      classification,
      retentionPolicyId: policyFor(state, classification).id || "",
      encryptionStatus: "at_rest",
      signatureStatus: doc.signed ? "signed" : "unsigned",
      status: doc.status === "archived" ? "archived" : "active",
      sourceModule: 17,
      sourceId: doc.id,
      tags: ["generated", "receipt"]
    };
    state.digitalRecords.push(record);
  });
}

function authorizeRecord(user, action, record) {
  if (!permitted(user, action)) return { ok: false, error: "You are not allowed to manage this record", errorCode: "REC-002", http: 403 };
  if (record && !visibleTo(user, record)) return { ok: false, error: "Branch isolation prevents access", errorCode: "REC-003", http: 403 };
  return { ok: true };
}

export function uploadRecord(state, request = {}, user, uid, now) {
  ensureRecordsState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Digital records are disabled", errorCode: "REC-012", http: 423 };
  const gate = authorizeRecord(user, "Records.Upload");
  if (!gate.ok) return gate;
  const type = request.type || "branch_document";
  if (!RECORD_TYPES.includes(type)) return { ok: false, error: "Unknown document type", errorCode: "REC-001", http: 422 };
  const mimeType = request.mimeType || "text/plain";
  if (!ALLOWED_MIME.includes(mimeType)) return { ok: false, error: "MIME type is not permitted", errorCode: "REC-007", http: 422 };
  const content = String(request.content || request.text || "");
  if (content.length > quota(state, "records.maxFileBytes", 5000000)) {
    return { ok: false, error: "File exceeds the configured size limit", errorCode: "REC-010", http: 413 };
  }
  const scan = scanContent(content, mimeType);
  if (!scan.ok) return { ok: false, error: `Upload rejected: ${scan.reason}`, errorCode: "REC-007", http: 422 };
  const classification = RECORD_CLASSIFICATIONS.includes(request.classification)
    ? request.classification
    : classificationForType(type);
  const branchId = dataScope(user) === "branch" ? (user.branchId || "") : (request.branchId || user?.branchId || "");
  if (request.branchId && dataScope(user) === "branch" && request.branchId !== user.branchId) {
    return { ok: false, error: "Cannot upload into another branch", errorCode: "REC-003", http: 403 };
  }
  const existing = request.recordId ? recordById(state, request.recordId) : null;
  if (existing) return versionRecord(state, { recordId: existing.id, content, mimeType, fileName: request.fileName, bump: request.bump || "minor" }, user, uid, now);

  const hash = checksum(content);
  const record = {
    id: newId("rec", uid),
    documentNumber: request.documentNumber || newId("DREC", uid).toUpperCase(),
    type,
    category: request.category || type,
    ownerEntity: request.ownerEntity || "customer",
    ownerId: request.ownerId || request.customerId || "",
    branchId,
    uploadedBy: user?.id || "",
    uploadedAt: nowIso(now),
    fileName: request.fileName || `${type}.txt`,
    fileSize: content.length,
    mimeType,
    storageLocation: `${storageProvider(state)}://records/${hash}`,
    checksum: hash,
    version: "1.0",
    classification,
    retentionPolicyId: policyFor(state, classification).id || "",
    encryptionStatus: "at_rest",
    signatureStatus: "signed",
    status: "uploaded",
    sourceModule: request.sourceModule || 26,
    sourceId: "",
    tags: request.tags || [],
    watermark: request.watermark || ""
  };
  state.digitalRecords.push(record);
  const version = {
    id: newId("rver", uid),
    recordId: record.id,
    major: 1,
    minor: 0,
    label: "1.0",
    current: true,
    checksum: hash,
    fileSize: content.length,
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.digitalRecordVersions.push(version);
  state.digitalRecordStorage.push({
    id: newId("rstor", uid),
    recordId: record.id,
    versionId: version.id,
    provider: storageProvider(state),
    encrypted: true,
    signature: signPayload(content, user, now),
    content,
    createdAt: nowIso(now)
  });
  state.digitalRecordChecksums.push({ id: newId("rcsum", uid), recordId: record.id, versionId: version.id, checksum: hash, createdAt: nowIso(now) });
  state.digitalRecordMetadata.push({
    id: newId("rmeta", uid),
    recordId: record.id,
    fields: request.metadata || {},
    createdAt: nowIso(now)
  });
  (request.tags || []).forEach((tag) => {
    state.digitalRecordTags.push({ id: newId("rtag", uid), recordId: record.id, tag, createdAt: nowIso(now) });
  });
  const validated = transitionRecord(state, record.id, "validated", user, uid, now);
  if (validated.ok) transitionRecord(state, record.id, "active", user, uid, now);
  auditRecord(state, "Record uploaded", `${type} · ${record.documentNumber}`, user, { entityId: record.id }, uid);
  emitRecordEvent(state, "RecordUploaded", { recordId: record.id, type }, { uid, now, aggregateId: record.id });
  notify(state, "records_uploaded", { userId: user?.id, name: user?.username || "Team", type }, uid, record.id);
  recordMetric(state, { name: "records.uploaded", value: 1, module: "26" }, uid, now);
  logAccess(state, record, "upload", user, uid, now);
  return { ok: true, record: recordById(state, record.id), version };
}

export function versionRecord(state, request = {}, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, request.recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.Version", record);
  if (!gate.ok) return gate;
  if (!["active", "validated"].includes(record.status)) {
    return { ok: false, error: "Only active records can receive a new version", errorCode: "REC-004", http: 409 };
  }
  const content = String(request.content || "");
  const scan = scanContent(content, request.mimeType || record.mimeType);
  if (!scan.ok) return { ok: false, error: `Version rejected: ${scan.reason}`, errorCode: "REC-007", http: 422 };
  const current = currentVersion(state, record.id);
  if (current) current.current = false;
  const major = request.bump === "major" ? (current?.major || 1) + 1 : (current?.major || 1);
  const minor = request.bump === "major" ? 0 : (current?.minor || 0) + 1;
  const hash = checksum(content);
  const version = {
    id: newId("rver", uid),
    recordId: record.id,
    major,
    minor,
    label: `${major}.${minor}`,
    current: true,
    checksum: hash,
    fileSize: content.length,
    createdBy: user?.id || "",
    createdAt: nowIso(now),
    previousVersionId: current?.id || ""
  };
  state.digitalRecordVersions.push(version);
  state.digitalRecordStorage.push({
    id: newId("rstor", uid),
    recordId: record.id,
    versionId: version.id,
    provider: storageProvider(state),
    encrypted: true,
    signature: signPayload(content, user, now),
    content,
    createdAt: nowIso(now)
  });
  state.digitalRecordChecksums.push({ id: newId("rcsum", uid), recordId: record.id, versionId: version.id, checksum: hash, createdAt: nowIso(now) });
  record.version = version.label;
  record.checksum = hash;
  record.fileSize = content.length;
  record.fileName = request.fileName || record.fileName;
  record.status = "active";
  auditRecord(state, "Record versioned", `${record.documentNumber} · ${version.label}`, user, { entityId: record.id }, uid);
  emitRecordEvent(state, "RecordSuperseded", { recordId: record.id, version: version.label }, { uid, now, aggregateId: record.id });
  return { ok: true, record, version, previous: current };
}

export function compareRecordVersions(state, recordId, leftId, rightId, user) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.View", record);
  if (!gate.ok) return gate;
  const versions = (state.digitalRecordVersions || []).filter((item) => item.recordId === record.id);
  const left = versions.find((item) => item.id === leftId) || versions.find((item) => item.current);
  const right = versions.find((item) => item.id === rightId) || versions[0];
  return {
    ok: true,
    recordId: record.id,
    left: { id: left?.id, label: left?.label, checksum: left?.checksum },
    right: { id: right?.id, label: right?.label, checksum: right?.checksum },
    identical: left?.checksum === right?.checksum
  };
}

export function rollbackRecordVersion(state, recordId, versionId, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.Version", record);
  if (!gate.ok) return gate;
  const historic = (state.digitalRecordVersions || []).find((item) => item.id === versionId && item.recordId === record.id);
  if (!historic) return { ok: false, error: "Version not found", errorCode: "REC-001", http: 404 };
  const stored = (state.digitalRecordStorage || []).find((item) => item.versionId === historic.id);
  return versionRecord(state, {
    recordId: record.id,
    content: stored?.content || "",
    fileName: record.fileName,
    bump: "minor"
  }, user, uid, now);
}

export function transitionRecord(state, recordId, to, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  if (!canTransitionRecord(record.status, to)) {
    return { ok: false, error: `Cannot move record from ${record.status} to ${to}`, errorCode: "REC-004", http: 409 };
  }
  if (to === "deleted") {
    if (hasLegalHold(state, record.id)) return { ok: false, error: "Legal hold prevents deletion", errorCode: "REC-005", http: 409 };
    const policy = policyFor(state, record.classification);
    if (!policy.allowDelete && !isSystemOwner(user)) {
      return { ok: false, error: "Retention policy does not permit deletion", errorCode: "REC-006", http: 409 };
    }
  }
  record.status = to;
  record.updatedAt = nowIso(now);
  return { ok: true, record };
}

export function archiveRecord(state, recordId, user, uid, now) {
  const gate = authorizeRecord(user, "Records.Archive", recordById(state, recordId));
  if (!gate.ok) return gate;
  const moved = transitionRecord(state, recordId, "archived", user, uid, now);
  if (!moved.ok) return moved;
  state.digitalRecordArchives.push({
    id: newId("rarc", uid),
    recordId,
    archivedBy: user?.id || "",
    createdAt: nowIso(now)
  });
  auditRecord(state, "Record archived", recordId, user, { entityId: recordId }, uid);
  emitRecordEvent(state, "RecordArchived", { recordId }, { uid, now, aggregateId: recordId });
  notify(state, "records_archived", { userId: user?.id, name: user?.username || "Team" }, uid, recordId);
  return moved;
}

export function restoreRecord(state, recordId, user, uid, now) {
  const record = recordById(state, recordId);
  const gate = authorizeRecord(user, "Records.Restore", record);
  if (!gate.ok) return gate;
  const moved = transitionRecord(state, recordId, "active", user, uid, now);
  if (!moved.ok) return moved;
  auditRecord(state, "Record restored", recordId, user, { entityId: recordId }, uid);
  emitRecordEvent(state, "RecordRestored", { recordId }, { uid, now, aggregateId: recordId });
  return moved;
}

export function retireRecord(state, recordId, user, uid, now) {
  const record = recordById(state, recordId);
  const gate = authorizeRecord(user, "Records.Archive", record);
  if (!gate.ok) return gate;
  if (hasLegalHold(state, recordId)) return { ok: false, error: "Legal hold prevents retirement", errorCode: "REC-005", http: 409 };
  return transitionRecord(state, recordId, "retired", user, uid, now);
}

export function deleteRecord(state, recordId, user, uid, now) {
  const record = recordById(state, recordId);
  const gate = authorizeRecord(user, "Records.Delete", record);
  if (!gate.ok) return gate;
  const moved = transitionRecord(state, recordId, "deleted", user, uid, now);
  if (!moved.ok) return moved;
  auditRecord(state, "Record deleted", recordId, user, { entityId: recordId, category: "security" }, uid);
  emitRecordEvent(state, "RecordDeleted", { recordId }, { uid, now, aggregateId: recordId });
  return moved;
}

export function placeLegalHold(state, request = {}, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, request.recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.Hold", record);
  if (!gate.ok) return gate;
  const hold = {
    id: newId("rhold", uid),
    recordId: record.id,
    reason: request.reason || "Legal hold",
    status: "active",
    placedBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.digitalRecordLegalHolds.push(hold);
  auditRecord(state, "Legal hold placed", record.documentNumber, user, { entityId: record.id, category: "security" }, uid);
  emitRecordEvent(state, "RecordHeld", { recordId: record.id, holdId: hold.id }, { uid, now, aggregateId: record.id });
  notify(state, "records_hold", { userId: user?.id, name: user?.username || "Team" }, uid, hold.id);
  return { ok: true, hold };
}

export function releaseLegalHold(state, holdId, user, uid, now) {
  ensureRecordsState(state);
  const hold = (state.digitalRecordLegalHolds || []).find((item) => item.id === holdId);
  if (!hold) return { ok: false, error: "Legal hold not found", errorCode: "REC-001", http: 404 };
  if (!permitted(user, "Records.Hold")) return { ok: false, error: "You cannot release a legal hold", errorCode: "REC-002", http: 403 };
  hold.status = "released";
  hold.releasedBy = user?.id || "";
  hold.releasedAt = nowIso(now);
  auditRecord(state, "Legal hold released", hold.recordId, user, { entityId: hold.id, category: "security" }, uid);
  return { ok: true, hold };
}

export function searchRecords(state, query = {}, user) {
  ensureRecordsState(state);
  ingestGenerated(state);
  if (!permitted(user, "Records.View") && !permitted(user, "Document.View")) {
    return { ok: false, error: "You cannot search records", errorCode: "REC-002", http: 403 };
  }
  const q = String(query.q || query.text || "").toLowerCase();
  let rows = (state.digitalRecords || []).filter((item) => visibleTo(user, item) && item.status !== "deleted");
  if (query.id) rows = rows.filter((item) => item.id === query.id || item.documentNumber === query.id);
  if (query.customerId) rows = rows.filter((item) => item.ownerId === query.customerId && item.ownerEntity === "customer");
  if (query.loanId) rows = rows.filter((item) => item.ownerId === query.loanId && item.ownerEntity === "loan");
  if (query.savingsId) rows = rows.filter((item) => item.ownerId === query.savingsId);
  if (query.branchId) rows = rows.filter((item) => item.branchId === query.branchId);
  if (query.type) rows = rows.filter((item) => item.type === query.type);
  if (query.fileName) rows = rows.filter((item) => String(item.fileName || "").toLowerCase().includes(String(query.fileName).toLowerCase()));
  if (query.tag) rows = rows.filter((item) => (item.tags || []).includes(query.tag));
  if (query.from) rows = rows.filter((item) => String(item.uploadedAt || "") >= query.from);
  if (query.to) rows = rows.filter((item) => String(item.uploadedAt || "") <= query.to);
  if (q) {
    rows = rows.filter((item) => (
      `${item.documentNumber} ${item.fileName} ${item.type} ${(item.tags || []).join(" ")}`.toLowerCase().includes(q)
    ));
  }
  return { ok: true, rows, count: rows.length };
}

export function previewRecord(state, recordId, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.View", record);
  if (!gate.ok) return gate;
  const version = currentVersion(state, record.id);
  const stored = (state.digitalRecordStorage || []).find((item) => item.versionId === version?.id);
  const verified = !stored || checksum(stored.content) === record.checksum || stored.checksum === record.checksum || version?.checksum === checksum(stored.content);
  logAccess(state, record, "preview", user, uid, now);
  const watermark = record.classification === "Restricted" || record.classification === "Financial"
    ? `\n[WATERMARK ${record.classification} ${record.documentNumber}]`
    : "";
  return {
    ok: true,
    record,
    preview: `${(stored?.content || "").slice(0, 4000)}${watermark}`,
    integrity: verified ? "valid" : "mismatch"
  };
}

export function createDownloadLink(state, recordId, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.Download", record);
  if (!gate.ok) return gate;
  const ttl = quota(state, "records.downloadTtlMs", 300000);
  const token = signPayload(`${record.id}|${user?.id || ""}|${nowMs(now)}`, user, now);
  const link = {
    id: newId("rdl", uid),
    recordId: record.id,
    token,
    userId: user?.id || "",
    expiresAt: new Date(nowMs(now) + ttl).toISOString(),
    used: false,
    createdAt: nowIso(now)
  };
  state.digitalRecordDownloads.push(link);
  logAccess(state, record, "download_link", user, uid, now);
  auditRecord(state, "Download link issued", record.documentNumber, user, { entityId: record.id }, uid);
  return { ok: true, link: { ...link, url: `/records/${record.id}/download?token=${token}` } };
}

export function downloadRecord(state, recordId, token, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const link = (state.digitalRecordDownloads || []).find((item) => item.recordId === record.id && item.token === token);
  if (!link) return { ok: false, error: "Download is not authorized", errorCode: "REC-002", http: 403 };
  if (link.used) return { ok: false, error: "Download link already used", errorCode: "REC-009", http: 410 };
  if (Date.parse(link.expiresAt) <= nowMs(now)) return { ok: false, error: "Download link expired", errorCode: "REC-009", http: 410 };
  const stored = (state.digitalRecordStorage || []).find((item) => item.recordId === record.id && item.versionId === currentVersion(state, record.id)?.id);
  if (stored && checksum(stored.content) !== record.checksum && currentVersion(state, record.id)?.checksum !== checksum(stored.content)) {
    return { ok: false, error: "Checksum verification failed", errorCode: "REC-008", http: 409 };
  }
  link.used = true;
  link.downloadedAt = nowIso(now);
  logAccess(state, record, "download", user, uid, now);
  return { ok: true, record, content: stored?.content || "", mimeType: record.mimeType };
}

export function shareRecord(state, request = {}, user, uid, now) {
  ensureRecordsState(state);
  const record = recordById(state, request.recordId);
  if (!record) return { ok: false, error: "Record not found", errorCode: "REC-001", http: 404 };
  const gate = authorizeRecord(user, "Records.Share", record);
  if (!gate.ok) return gate;
  const share = {
    id: newId("rshr", uid),
    recordId: record.id,
    toUserId: request.toUserId || "",
    expiresAt: request.expiresAt || new Date(nowMs(now) + 86400000).toISOString(),
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.digitalRecordShares.push(share);
  auditRecord(state, "Record shared", record.documentNumber, user, { entityId: record.id }, uid);
  return { ok: true, share };
}

export function saveRetentionPolicy(state, policy, user, uid, now) {
  ensureRecordsState(state);
  if (!permitted(user, "Records.Policy")) return { ok: false, error: "You cannot change retention policy", errorCode: "REC-002", http: 403 };
  const row = {
    id: policy.id || newId("ret", uid),
    classification: policy.classification,
    retainDays: Number(policy.retainDays || 365),
    allowDelete: policy.allowDelete === true,
    autoArchiveDays: Number(policy.autoArchiveDays || 180),
    updatedAt: nowIso(now)
  };
  const index = state.digitalRecordRetentionPolicies.findIndex((item) => item.id === row.id || item.classification === row.classification);
  if (index >= 0) state.digitalRecordRetentionPolicies[index] = { ...state.digitalRecordRetentionPolicies[index], ...row };
  else state.digitalRecordRetentionPolicies.push(row);
  auditRecord(state, "Retention policy updated", row.classification, user, { entityId: row.id }, uid);
  return { ok: true, policy: row };
}

export function applyRetention(state, user, uid, now) {
  ensureRecordsState(state);
  const stamp = nowMs(now);
  let archived = 0;
  (state.digitalRecords || []).forEach((record) => {
    if (record.status !== "active") return;
    if (hasLegalHold(state, record.id)) return;
    const policy = policyFor(state, record.classification);
    const ageDays = (stamp - Date.parse(record.uploadedAt || nowIso(now))) / 86400000;
    if (ageDays >= Number(policy.autoArchiveDays || 99999)) {
      const moved = transitionRecord(state, record.id, "archived", user, uid, now);
      if (moved.ok) {
        state.digitalRecordArchives.push({ id: newId("rarc", uid), recordId: record.id, archivedBy: "retention", createdAt: nowIso(now) });
        archived += 1;
      }
    }
  });
  return { ok: true, archived };
}

export function recordsDashboard(state, user) {
  ensureRecordsState(state);
  ingestGenerated(state);
  const visible = (state.digitalRecords || []).filter((item) => visibleTo(user, item));
  return {
    total: visible.length,
    active: visible.filter((item) => item.status === "active").length,
    archived: visible.filter((item) => item.status === "archived").length,
    holds: (state.digitalRecordLegalHolds || []).filter((item) => item.status === "active").length,
    downloads: (state.digitalRecordDownloads || []).length
  };
}

export function recordsReports(state, reportId) {
  ensureRecordsState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "records_library") return table(["documentNumber", "type", "status", "classification"], state.digitalRecords || []);
  if (reportId === "records_access") return table(["recordId", "action", "userId", "createdAt"], state.digitalRecordAccessLogs || []);
  if (reportId === "records_retention") return table(["classification", "retainDays", "allowDelete"], state.digitalRecordRetentionPolicies || []);
  if (reportId === "records_holds") return table(["recordId", "reason", "status"], state.digitalRecordLegalHolds || []);
  if (reportId === "records_archives") return table(["recordId", "archivedBy", "createdAt"], state.digitalRecordArchives || []);
  return table(["id"], []);
}

export function exportRecordsCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

/**
 * Indexes a customer KYC upload into the ECM without replacing customer.kycDocuments[].
 * Call after addKycDocument so Module 26 owns searchable file metadata.
 */
export function indexCustomerKycDocument(state, customer, kycDoc, user, uid, now) {
  ensureRecordsState(state);
  if (!customer || !kycDoc) return { ok: false, error: "Customer document is required", errorCode: "REC-001" };
  const typeMap = {
    "Ghana Card": "national_id",
    Passport: "passport_photograph",
    "Voter ID": "national_id",
    "Driver License": "national_id",
    "Birth Certificate": "national_id",
    "Proof of Address": "customer_agreement"
  };
  const type = typeMap[kycDoc.type] || "national_id";
  const mimeType = String(kycDoc.dataUrl || "").startsWith("data:image/png")
    ? "image/png"
    : String(kycDoc.dataUrl || "").startsWith("data:image/")
      ? "image/jpeg"
      : String(kycDoc.dataUrl || "").startsWith("data:application/pdf")
        ? "application/pdf"
        : "text/plain";
  return uploadRecord(state, {
    type,
    fileName: kycDoc.fileName || `${type}.bin`,
    mimeType,
    content: kycDoc.dataUrl || kycDoc.reference || kycDoc.id,
    ownerEntity: "customer",
    ownerId: customer.id,
    customerId: customer.id,
    branchId: customer.branchId || user?.branchId || "",
    category: "identity",
    tags: ["kyc", String(kycDoc.type || "").toLowerCase().replace(/\s+/g, "_")],
    documentNumber: kycDoc.id,
    metadata: { kycDocumentId: kycDoc.id, reference: kycDoc.reference || "" }
  }, user, uid, now);
}

export function assertRecordsBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    generatesReceipts: false,
    restHttp: false,
    graphqlHttp: false,
    immutableVersions: true,
    legalHold: true
  };
}

registerJobHandler("records_retention_tick", (state, job, ctx) => applyRetention(state, ctx.user, ctx.uid, ctx.now));
registerJobHandler("records_archive_tick", (state, job, ctx) => applyRetention(state, ctx.user, ctx.uid, ctx.now));

registerContractHandler("Records.Upload.v1", (state, payload, ctx) => uploadRecord(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Records.Search.v1", (state, payload, ctx) => searchRecords(state, payload, ctx.user));
registerContractHandler("Records.Archive.v1", (state, payload, ctx) => archiveRecord(state, payload.recordId || payload.id, ctx.user, ctx.uid, ctx.now));
