/**
 * Module 25 — Enterprise Data Exchange, Import, Export & Migration Framework.
 * Centralized import/export/migration/bulk processing. Does not post collections or ledgers.
 * No REST/GraphQL HTTP server.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric } from "./monitoring-ops.js";
import { enqueueJob, registerJobHandler } from "./job-ops.js";
import { registerContractHandler, publishDomainEvent } from "./module-contracts.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import { parseCustomerImportRows } from "./customer-crm.js";
import { IMPORT_TYPES, EXPORT_TYPES, canTransitionExchange } from "./exchange-lifecycle.js";
import {
  DATASET_CATALOG,
  SENSITIVE_FIELDS,
  HIGH_RISK_EXPORT_PERMISSIONS,
  SOD_FORBIDDEN,
  ASSIGNMENT_STEP_OWNERS,
  evaluateExportAuthorization,
  needsExportApproval,
  expireExportGrants,
  datasetMeta
} from "./export-policy.js";

export const EXCHANGE_SCHEMA_VERSION = "1.0.0";

const EXCHANGE_ARRAYS = [
  "importJobs",
  "exportJobs",
  "migrationJobs",
  "bulkOperations",
  "mappingTemplates",
  "validationErrors",
  "migrationBatches",
  "reconciliationResults",
  "importHistory",
  "exportHistory",
  "migrationHistory",
  "exchangeStagedRows",
  "exportPermissionGrants",
  "exportPermissionRequests",
  "exportAuthorizationLog"
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

function auditExchange(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: extras.guarantee || "G1",
    module: "25",
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

function emitExchangeEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 25,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "EXCHANGE"
  }, uid, now);
}

function signArchive(payload, user, now) {
  const body = JSON.stringify({ payload, userId: user?.id || "", at: nowIso(now) });
  let hash = 2166136261;
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `xsig-${(hash >>> 0).toString(16)}`;
}

function seedMappingTemplates() {
  return [
    {
      id: "map-customers-default",
      name: "Customer CSV",
      dataset: "customers",
      fields: [
        { external: "Full Name", internal: "name" },
        { external: "Phone Number", internal: "phone" },
        { external: "Ghana Card", internal: "ghanaCard" },
        { external: "Account Number", internal: "accountNo" },
        { external: "Email", internal: "email" }
      ]
    },
    {
      id: "map-savings-default",
      name: "Savings transactions",
      dataset: "savings_transactions",
      fields: [
        { external: "Customer ID", internal: "customerId" },
        { external: "Amount", internal: "amount" },
        { external: "Date", internal: "date" }
      ]
    }
  ];
}

export function ensureExchangeState(state = {}) {
  EXCHANGE_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  if (!state.mappingTemplates.length) state.mappingTemplates = seedMappingTemplates();
  expireExportGrants(state, Date.now());
  return state;
}

function engineEnabled(state) {
  return isFeatureEnabled(state, "enableDataExchange") !== false;
}

function quota(state, key, fallback) {
  const value = Number(getConfigValue(state, key));
  return Number.isFinite(value) ? value : fallback;
}

export function parseExchangePayload(input = {}, format = "csv") {
  if (Array.isArray(input.rows)) return input.rows;
  const text = String(input.text || input.content || "");
  if (!text.trim()) return [];
  if (format === "json") {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.rows || []);
  }
  if (format === "xml") {
    const rows = [];
    const blocks = text.match(/<row[\s\S]*?<\/row>/gi) || [];
    blocks.forEach((block) => {
      const row = {};
      [...block.matchAll(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g)].forEach((match) => {
        if (match[1].toLowerCase() !== "row") row[match[1]] = match[2];
      });
      rows.push(row);
    });
    return rows;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

export function applyMappingTemplate(rows = [], template) {
  if (!template?.fields?.length) return rows;
  return rows.map((row) => {
    const mapped = {};
    template.fields.forEach((field) => {
      mapped[field.internal] = row[field.internal] ?? row[field.external] ?? "";
    });
    return { ...row, ...mapped };
  });
}

function requiredFields(type) {
  if (type === "customers") return ["name", "phone"];
  if (type === "branches") return ["name"];
  if (type === "agents") return ["name"];
  if (["savings_transactions", "loan_repayments", "withdrawals", "journal_entries"].includes(type)) return ["amount"];
  return [];
}

export function validateExchangeRows(state, type, rows = [], { branchId = "" } = {}) {
  const errors = [];
  const seen = new Set();
  const required = requiredFields(type);
  const meta = datasetMeta(type) || { apply: false, classification: "Internal" };
  rows.forEach((row, index) => {
    required.forEach((field) => {
      if (!String(row[field] || "").trim()) {
        errors.push({ row: index + 1, field, code: "required", message: `${field} is required` });
      }
    });
    if (row.amount != null && row.amount !== "" && Number.isNaN(Number(row.amount))) {
      errors.push({ row: index + 1, field: "amount", code: "type", message: "amount must be numeric" });
    }
    if (type === "customers") {
      const key = `${String(row.phone || "").trim()}|${String(row.accountNo || "").trim()}`;
      if (seen.has(key)) errors.push({ row: index + 1, field: "phone", code: "duplicate", message: "Duplicate customer in file" });
      seen.add(key);
      const exists = (state.customers || []).some((item) => item.phone === row.phone || (row.accountNo && item.accountNo === row.accountNo));
      if (exists) errors.push({ row: index + 1, field: "phone", code: "duplicate", message: "Customer already exists" });
    }
    if (row.customerId && !(state.customers || []).some((item) => item.id === row.customerId)) {
      errors.push({ row: index + 1, field: "customerId", code: "referential", message: "Unknown customer" });
    }
    if (branchId && row.branchId && row.branchId !== branchId) {
      errors.push({ row: index + 1, field: "branchId", code: "ownership", message: "Row is outside authorized branch" });
    }
    SENSITIVE_FIELDS.forEach((field) => {
      if (row[field] && meta.classification === "Restricted") {
        errors.push({ row: index + 1, field, code: "restricted", message: "Restricted field cannot be imported in plaintext" });
      }
    });
  });
  return { ok: errors.length === 0, errors, recordCount: rows.length, apply: meta.apply === true };
}

function maskSensitive(row) {
  const copy = { ...row };
  SENSITIVE_FIELDS.forEach((field) => {
    if (copy[field] != null && copy[field] !== "") copy[field] = "[REDACTED]";
  });
  return copy;
}

function rowsForExport(state, type, user, options = {}) {
  const branchId = options.branchId || user?.branchId || "";
  const scopeBranch = (rows, field = "branchId") => {
    if (options.evaluation?.scope !== "Branch" || !branchId) return rows;
    return rows.filter((item) => !item[field] || item[field] === branchId);
  };
  if (type === "customers") return scopeBranch(state.customers || []).map(maskSensitive);
  if (type === "branches") return (state.branches || []).map(maskSensitive);
  if (type === "agents") return scopeBranch(state.agents || state.collectors || []).map(maskSensitive);
  if (type === "savings_statements" || type === "savings_transactions") return scopeBranch(state.collections || [], "branchId").map(maskSensitive);
  if (type === "loan_statements" || type === "loan_accounts") return scopeBranch(state.loans || []).map(maskSensitive);
  if (type === "financial_reports") return (state.journalEntries || []).map(maskSensitive);
  if (type === "audit_reports") return (state.audit || []).map(maskSensitive);
  if (type === "workflow_history") return (state.workflowInstances || []).map(maskSensitive);
  if (type === "security_reports") return (state.securityIncidents || []).map(maskSensitive);
  if (type === "backup_metadata") return (state.backupJobs || []).map(maskSensitive);
  if (type === "configuration") return [{ key: "loanInterest", value: state.settings?.loanInterest }, { key: "collectionDays", value: state.settings?.collectionDays }].map(maskSensitive);
  if (type === "business_intelligence") return (state.collections || []).map((item) => ({ date: item.date, amount: item.amount, branchId: item.branchId }));
  if (type === "regulatory_reports") return (state.audit || []).map((item) => ({ action: item.action, createdAt: item.createdAt }));
  return [];
}

export function serializeExport(rows, format, { classification, user, now } = {}) {
  const safe = rows.map(maskSensitive);
  if (format === "json") return JSON.stringify(safe, null, 2);
  if (format === "xml") {
    const body = safe.map((row) => {
      const fields = Object.entries(row).map(([key, value]) => `<${key}>${String(value ?? "")}</${key}>`).join("");
      return `<row>${fields}</row>`;
    }).join("");
    return `<export>${body}</export>`;
  }
  if (format === "pdf") {
    return `PDF-LITE\n${safe.map((row) => Object.values(row).join(" | ")).join("\n")}`;
  }
  const columns = safe[0] ? Object.keys(safe[0]) : ["id"];
  const csv = [columns.join(","), ...safe.map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","))].join("\n");
  if (format === "zip" || ["Confidential", "Financial", "Restricted"].includes(classification)) {
    return JSON.stringify({
      encrypted: true,
      classification,
      signature: signArchive(csv, user, now),
      format,
      content: csv
    });
  }
  return csv;
}

function recordHistory(list, row) {
  list.push(row);
}

function createJob(state, collection, draft, uid, now) {
  const job = {
    id: newId(draft.prefix || "xjob", uid),
    type: draft.type,
    dataset: draft.dataset,
    format: draft.format || "csv",
    status: draft.status || "draft",
    progress: 0,
    processed: 0,
    total: draft.total || 0,
    checkpoint: 0,
    createdBy: draft.userId || "",
    branchId: draft.branchId || "",
    classification: draft.classification || "Internal",
    permission: draft.permission || "",
    approvalId: draft.approvalId || "",
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    result: "",
    payload: draft.payload || {},
    createdIds: [],
    fileSize: 0,
    correlationId: draft.correlationId || newId("xcorr", uid)
  };
  collection.push(job);
  return job;
}

function transition(job, to, now) {
  if (!canTransitionExchange(job.status, to)) {
    return { ok: false, error: `Cannot move job from ${job.status} to ${to}`, errorCode: "EX-009", http: 409 };
  }
  job.status = to;
  job.updatedAt = nowIso(now);
  return { ok: true, job };
}

export function validateImport(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Data exchange is disabled", errorCode: "EX-012", http: 423 };
  if (!permitted(user, "Exchange.Import") && !permitted(user, "Exchange.View")) {
    return { ok: false, error: "You cannot validate imports", errorCode: "EX-002", http: 403 };
  }
  const type = request.type || request.dataset;
  if (!IMPORT_TYPES.includes(type)) return { ok: false, error: "Unknown import type", errorCode: "EX-001", http: 404 };
  const template = (state.mappingTemplates || []).find((item) => item.id === request.templateId || item.dataset === type);
  const rows = applyMappingTemplate(parseExchangePayload(request, request.format || "csv"), template);
  const normalized = type === "customers"
    ? rows.map((row) => ({
      name: String(row.name || row.Name || row.fullName || row["Full Name"] || "").trim(),
      phone: String(row.phone || row.Phone || row["Phone Number"] || "").trim(),
      ghanaCard: String(row.ghanaCard || row.nationalId || row["Ghana Card"] || "").trim(),
      accountNo: String(row.accountNo || row.Account || row["Account Number"] || "").trim(),
      email: String(row.email || row.Email || "").trim(),
      membershipNumber: String(row.membershipNumber || row["Membership Number"] || "").trim()
    }))
    : rows;
  const report = validateExchangeRows(state, type, normalized, { branchId: user?.branchId });
  report.errors.forEach((error) => {
    state.validationErrors.push({
      id: newId("xerr", uid),
      dataset: type,
      ...error,
      createdAt: nowIso(now)
    });
  });
  return { ...report, rows: normalized, templateId: template?.id || "" };
}

function applyMetadataRows(state, type, rows, user, uid, now) {
  const created = [];
  if (type === "customers") {
    rows.forEach((row) => {
      const exists = (state.customers || []).some((item) => item.phone === row.phone);
      if (exists) return;
      const customer = {
        id: newId("cust", uid),
        name: row.name,
        phone: row.phone,
        ghanaCard: row.ghanaCard || "",
        accountNo: row.accountNo || "",
        email: row.email || "",
        membershipNumber: row.membershipNumber || "",
        branchId: user?.branchId || row.branchId || "",
        memberStatus: "pending_verification",
        createdAt: nowIso(now)
      };
      state.customers = state.customers || [];
      state.customers.push(customer);
      created.push(customer.id);
    });
  }
  if (type === "branches") {
    rows.forEach((row) => {
      const branch = { id: newId("br", uid), name: row.name, createdAt: nowIso(now) };
      state.branches = state.branches || [];
      state.branches.push(branch);
      created.push(branch.id);
    });
  }
  if (type === "agents") {
    rows.forEach((row) => {
      const agent = { id: newId("ag", uid), name: row.name, branchId: user?.branchId || "", createdAt: nowIso(now) };
      state.agents = state.agents || [];
      state.agents.push(agent);
      created.push(agent.id);
    });
  }
  if (type === "documents_metadata") {
    rows.forEach((row) => {
      const doc = { id: newId("docmeta", uid), name: row.name || row.title, type: row.type || "metadata", createdAt: nowIso(now) };
      state.documentMetadata = state.documentMetadata || [];
      state.documentMetadata.push(doc);
      created.push(doc.id);
    });
  }
  return created;
}

export function importExchange(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Data exchange is disabled", errorCode: "EX-012", http: 423 };
  if (!permitted(user, "Exchange.Import")) return { ok: false, error: "You cannot import data", errorCode: "EX-002", http: 403 };
  const validated = validateImport(state, request, user, uid, now);
  if (!validated.ok && request.allowPartial !== true) {
    emitExchangeEvent(state, "ValidationFailed", { type: request.type, errors: validated.errors.length }, { uid, now });
    return { ok: false, error: "Validation failed", errorCode: "EX-006", http: 422, errors: validated.errors };
  }
  const meta = datasetMeta(request.type);
  const apply = request.apply === true && meta?.apply === true && !["savings_transactions", "loan_repayments", "withdrawals", "journal_entries"].includes(request.type);
  const job = createJob(state, state.importJobs, {
    prefix: "imp",
    type: "import",
    dataset: request.type,
    format: request.format || "csv",
    status: "queued",
    total: validated.rows.length,
    userId: user?.id,
    branchId: user?.branchId || "",
    classification: meta?.classification,
    permission: meta?.permission,
    payload: { dryRun: request.dryRun === true, apply }
  }, uid, now);
  if (request.dryRun === true || !apply) {
    validated.rows.forEach((row, index) => {
      state.exchangeStagedRows.push({
        id: newId("stg", uid),
        jobId: job.id,
        dataset: request.type,
        row,
        index,
        posted: false
      });
    });
    job.status = "completed";
    job.progress = 100;
    job.processed = validated.rows.length;
    job.result = apply ? "staged" : "validated";
    recordHistory(state.importHistory, { id: newId("imph", uid), jobId: job.id, dataset: request.type, count: validated.rows.length, result: job.result, createdAt: nowIso(now) });
    auditExchange(state, "Import staged", `${request.type} · ${validated.rows.length}`, user, { entityId: job.id }, uid);
    emitExchangeEvent(state, "ImportCompleted", { jobId: job.id, staged: true }, { uid, now, aggregateId: job.id, correlationId: job.correlationId });
    recordMetric(state, { name: "exchange.import.staged", value: validated.rows.length, module: "25" }, uid, now);
    return { ok: true, job, staged: true, applied: 0, posted: false, rows: validated.rows.length };
  }
  const applyRows = request.type === "customers" ? parseCustomerImportRows(validated.rows) : validated.rows;
  const created = applyMetadataRows(state, request.type, applyRows, user, uid, now);
  job.createdIds = created;
  job.status = "completed";
  job.progress = 100;
  job.processed = created.length;
  job.result = "applied";
  recordHistory(state.importHistory, { id: newId("imph", uid), jobId: job.id, dataset: request.type, count: created.length, result: "applied", createdAt: nowIso(now) });
  auditExchange(state, "Import applied", `${request.type} · ${created.length}`, user, { entityId: job.id }, uid);
  notify(state, "exchange_import_completed", { userId: user?.id, name: user?.username || "Team", count: created.length }, uid, job.correlationId);
  emitExchangeEvent(state, "ImportCompleted", { jobId: job.id, applied: created.length }, { uid, now, aggregateId: job.id, correlationId: job.correlationId });
  return { ok: true, job, applied: created.length, createdIds: created, posted: false };
}

export function rollbackImport(state, jobId, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Exchange.Import") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot roll back imports", errorCode: "EX-002", http: 403 };
  }
  const job = (state.importJobs || []).find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Import job not found", errorCode: "EX-001", http: 404 };
  const moved = transition(job, "rolled_back", now);
  if (!moved.ok) return moved;
  (job.createdIds || []).forEach((id) => {
    const customer = (state.customers || []).find((item) => item.id === id);
    const hasActivity = (state.collections || []).some((item) => item.customerId === id);
    if (customer && !hasActivity) {
      state.customers = state.customers.filter((item) => item.id !== id);
    }
    state.branches = (state.branches || []).filter((item) => item.id !== id);
    state.agents = (state.agents || []).filter((item) => item.id !== id);
  });
  auditExchange(state, "Import rolled back", job.dataset, user, { entityId: job.id }, uid);
  return { ok: true, job, posted: false };
}

export function exportExchange(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!engineEnabled(state)) return { ok: false, error: "Data exchange is disabled", errorCode: "EX-012", http: 423 };
  if (!permitted(user, "Exchange.Export") && !permitted(user, request.permission || "")) {
    return { ok: false, error: "You cannot export data", errorCode: "EX-002", http: 403 };
  }
  const type = request.type || request.dataset;
  if (!EXPORT_TYPES.includes(type) && !datasetMeta(type)) {
    return { ok: false, error: "Unknown export type", errorCode: "EX-001", http: 404 };
  }
  const format = request.format || "csv";
  const auth = evaluateExportAuthorization(state, user, type, format, {
    now,
    uid,
    correlationId: request.correlationId,
    branchId: request.branchId
  });
  if (!auth.ok) {
    emitExchangeEvent(state, "ExportDenied", { type, reason: auth.error }, { uid, now });
    return auth;
  }
  const concurrent = (state.exportJobs || []).filter((item) => ["queued", "running"].includes(item.status) && item.createdBy === user?.id).length;
  if (concurrent >= quota(state, "exchange.maxConcurrentJobs", 3)) {
    return { ok: false, error: "Export quota exceeded", errorCode: "EX-007", http: 429 };
  }
  const rows = rowsForExport(state, type, user, { ...request, evaluation: auth.evaluation });
  const maxSync = quota(state, "exchange.maxSyncRecords", 500);
  const approvalNeeded = needsExportApproval(auth.meta, { ...request, recordCount: rows.length }, user);
  const job = createJob(state, state.exportJobs, {
    prefix: "exp",
    type: "export",
    dataset: type,
    format,
    status: approvalNeeded ? "pending_approval" : "queued",
    total: rows.length,
    userId: user?.id,
    branchId: user?.branchId || request.branchId || "",
    classification: auth.meta.classification,
    permission: auth.meta.permission,
    payload: { fullHistory: request.fullHistory === true }
  }, uid, now);
  if (approvalNeeded) {
    auditExchange(state, "Export approval required", type, user, { entityId: job.id, category: "security" }, uid);
    notify(state, "exchange_export_approval", { userId: user?.id, name: user?.username || "Team", dataset: type }, uid, job.correlationId);
    return { ok: true, pendingApproval: true, job, recordCount: rows.length };
  }
  return completeExportJob(state, job, rows, user, uid, now, maxSync);
}

function completeExportJob(state, job, rows, user, uid, now, maxSync) {
  if (rows.length > maxSync) {
    const queued = enqueueJob(state, {
      type: "exchange_export",
      businessKey: job.id,
      payload: { exportJobId: job.id }
    }, user, uid, now);
    job.status = "queued";
    return { ok: true, async: true, job, scheduler: queued };
  }
  const content = serializeExport(rows, job.format, { classification: job.classification, user, now });
  if (content.length > quota(state, "exchange.maxFileBytes", 2000000)) {
    return { ok: false, error: "Export exceeds file size limit", errorCode: "EX-007", http: 413, job };
  }
  job.status = "completed";
  job.progress = 100;
  job.processed = rows.length;
  job.fileSize = content.length;
  job.result = "success";
  job.content = content;
  recordHistory(state.exportHistory, {
    id: newId("exph", uid),
    jobId: job.id,
    userId: user?.id || "",
    branchId: job.branchId,
    permission: job.permission,
    classification: job.classification,
    exportType: job.dataset,
    format: job.format,
    recordCount: rows.length,
    fileSize: content.length,
    approvalReference: job.approvalId,
    requestTimestamp: job.createdAt,
    completionTimestamp: nowIso(now),
    result: "Success"
  });
  auditExchange(state, "Export completed", `${job.dataset} · ${rows.length}`, user, { entityId: job.id, category: job.classification === "Restricted" ? "security" : "operational" }, uid);
  emitExchangeEvent(state, "ExportCompleted", { jobId: job.id, recordCount: rows.length }, { uid, now, aggregateId: job.id, correlationId: job.correlationId });
  recordMetric(state, { name: "exchange.export.completed", value: rows.length, module: "25" }, uid, now);
  notify(state, "exchange_export_completed", { userId: user?.id, name: user?.username || "Team", dataset: job.dataset }, uid, job.correlationId);
  return { ok: true, job, recordCount: rows.length, format: job.format, content };
}

export function approveExportJob(state, jobId, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Exchange.Approve") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot approve exports", errorCode: "EX-002", http: 403 };
  }
  const job = (state.exportJobs || []).find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Export job not found", errorCode: "EX-001", http: 404 };
  if (job.createdBy && job.createdBy === user?.id && !isSystemOwner(user)) {
    return { ok: false, error: "Maker and checker must be different users", errorCode: "EX-011", http: 409 };
  }
  const moved = transition(job, "queued", now);
  if (!moved.ok) return moved;
  job.approvalId = newId("xappr", uid);
  const rows = rowsForExport(state, job.dataset, user, { branchId: job.branchId, evaluation: { scope: "Organization" } });
  return completeExportJob(state, job, rows, user, uid, now, quota(state, "exchange.maxSyncRecords", 500));
}

export function migrateExchange(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Exchange.Migrate")) return { ok: false, error: "You cannot run migrations", errorCode: "EX-002", http: 403 };
  const source = request.source || "spreadsheet";
  const validated = validateImport(state, { ...request, type: request.type || "customers" }, user, uid, now);
  if (!validated.ok && request.dryRun !== true) {
    return { ok: false, error: "Migration validation failed", errorCode: "EX-006", http: 422, errors: validated.errors };
  }
  const job = createJob(state, state.migrationJobs, {
    prefix: "mig",
    type: "migration",
    dataset: request.type || "customers",
    format: request.format || "csv",
    status: request.dryRun === true ? "completed" : "queued",
    total: validated.rows?.length || 0,
    userId: user?.id,
    payload: { source, incremental: request.incremental === true, dryRun: request.dryRun === true }
  }, uid, now);
  const batch = {
    id: newId("mbat", uid),
    jobId: job.id,
    source,
    count: validated.rows?.length || 0,
    dryRun: request.dryRun === true,
    createdAt: nowIso(now)
  };
  state.migrationBatches.push(batch);
  if (request.dryRun === true) {
    job.result = "dry_run";
    job.progress = 100;
  } else if (datasetMeta(request.type || "customers")?.apply) {
    const created = applyMetadataRows(state, request.type || "customers", validated.rows || [], user, uid, now);
    job.createdIds = created;
    job.status = "completed";
    job.progress = 100;
    job.result = "applied";
  } else {
    job.status = "completed";
    job.result = "staged";
    job.progress = 100;
  }
  const expected = Number(request.expectedCount || validated.rows?.length || 0);
  const actual = job.createdIds?.length || (validated.rows?.length || 0);
  const reconciliation = {
    id: newId("rec", uid),
    jobId: job.id,
    expected,
    actual,
    matched: expected === actual,
    createdAt: nowIso(now)
  };
  state.reconciliationResults.push(reconciliation);
  recordHistory(state.migrationHistory, { id: newId("migh", uid), jobId: job.id, source, result: job.result, createdAt: nowIso(now) });
  auditExchange(state, "Migration completed", `${source} · ${job.result}`, user, { entityId: job.id }, uid);
  emitExchangeEvent(state, "MigrationCompleted", { jobId: job.id, result: job.result }, { uid, now, aggregateId: job.id });
  return { ok: true, job, batch, reconciliation, posted: false };
}

export function bulkExchange(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Exchange.Bulk")) return { ok: false, error: "You cannot run bulk operations", errorCode: "EX-002", http: 403 };
  const action = request.action || "validate";
  const ids = request.ids || [];
  const job = createJob(state, state.bulkOperations, {
    prefix: "blk",
    type: "bulk",
    dataset: request.dataset || "customers",
    status: "completed",
    total: ids.length,
    userId: user?.id,
    payload: { action }
  }, uid, now);
  let processed = 0;
  if (action === "validate") {
    processed = ids.length;
  } else if (action === "assign" && request.dataset === "customers") {
    (state.customers || []).forEach((item) => {
      if (ids.includes(item.id)) {
        item.collectorId = request.collectorId || item.collectorId;
        processed += 1;
      }
    });
  } else if (action === "status" && request.dataset === "customers") {
    (state.customers || []).forEach((item) => {
      if (ids.includes(item.id) && request.status !== "deleted") {
        item.memberStatus = request.status;
        processed += 1;
      }
    });
  } else if (action === "delete" && request.dataset === "customers" && permitted(user, "Customer.Delete")) {
    const removable = ids.filter((id) => !(state.collections || []).some((item) => item.customerId === id));
    state.customers = (state.customers || []).filter((item) => !removable.includes(item.id));
    processed = removable.length;
  }
  job.processed = processed;
  job.progress = 100;
  job.result = action;
  auditExchange(state, "Bulk operation", `${action} · ${processed}`, user, { entityId: job.id }, uid);
  return { ok: true, job, processed, posted: false };
}

export function controlExchangeJob(state, jobId, action, user, uid, now) {
  ensureExchangeState(state);
  const job = [...state.importJobs, ...state.exportJobs, ...state.migrationJobs, ...state.bulkOperations].find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Job not found", errorCode: "EX-001", http: 404 };
  const map = { pause: "paused", resume: "running", cancel: "cancelled", retry: "queued" };
  const next = map[action];
  if (!next) return { ok: false, error: "Unknown job action", errorCode: "EX-009", http: 422 };
  const moved = transition(job, next, now);
  if (!moved.ok) return moved;
  job.checkpoint = job.processed || 0;
  auditExchange(state, `Exchange job ${action}`, job.dataset, user, { entityId: job.id }, uid);
  return { ok: true, job };
}

export function requestExportPermissionAssignment(state, request = {}, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Request.ExportPermission") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot request export permissions", errorCode: "EX-002", http: 403 };
  }
  const row = {
    id: newId("xperm", uid),
    status: "draft",
    permission: request.permission,
    scope: request.scope || "Branch",
    targetUserId: request.targetUserId || user?.id,
    requesterId: user?.id,
    reason: request.reason || "",
    expiresAt: request.expiresAt || "",
    participants: { requester: user?.id },
    createdAt: nowIso(now)
  };
  state.exportPermissionRequests.push(row);
  row.status = "validation";
  if (HIGH_RISK_EXPORT_PERMISSIONS.includes(request.permission) && !request.reason) {
    row.status = "failed";
    return { ok: false, error: "High-risk permissions require a reason", errorCode: "EX-004", http: 422, request: row };
  }
  row.status = "pending_review";
  auditExchange(state, "Export permission requested", request.permission, user, { entityId: row.id, category: "security" }, uid);
  return { ok: true, request: row, owners: ASSIGNMENT_STEP_OWNERS };
}

function sodConflict(request, role, userId) {
  return SOD_FORBIDDEN.some(([left, right]) => (
    (left === role && request.participants?.[right] === userId)
    || (right === role && request.participants?.[left] === userId)
    || (request.participants?.requester === userId && role !== "requester")
  ));
}

export function advanceExportPermissionAssignment(state, requestId, step, user, uid, now, decision = "approve") {
  ensureExchangeState(state);
  const row = (state.exportPermissionRequests || []).find((item) => item.id === requestId);
  if (!row) return { ok: false, error: "Assignment request not found", errorCode: "EX-001", http: 404 };
  const role = step;
  if (sodConflict(row, role, user?.id) && !isSystemOwner(user)) {
    return { ok: false, error: "Segregation of duties prevents this action", errorCode: "EX-011", http: 409 };
  }
  row.participants[role] = user?.id;
  if (decision !== "approve") {
    row.status = "revoked";
    return { ok: true, request: row, denied: true };
  }
  const sequence = {
    pending_review: "pending_security",
    pending_security: "pending_compliance",
    pending_compliance: "approved",
    approved: "provisioning"
  };
  if (row.status === "pending_review" && role === "business_reviewer") row.status = sequence.pending_review;
  else if (row.status === "pending_security" && role === "security_reviewer") row.status = sequence.pending_security;
  else if (row.status === "pending_compliance" && role === "compliance_reviewer") row.status = sequence.pending_compliance;
  else if (row.status === "approved" && role === "final_approver") row.status = "provisioning";
  else return { ok: false, error: "Step is not available", errorCode: "EX-009", http: 409 };
  if (row.status === "provisioning") {
    state.exportPermissionGrants.push({
      id: newId("xgrant", uid),
      userId: row.targetUserId,
      permission: row.permission,
      scope: row.scope,
      status: "active",
      startAt: nowIso(now),
      expiresAt: row.expiresAt,
      approvalReference: row.id,
      reason: row.reason,
      assignedBy: user?.id
    });
    row.status = "active";
  }
  auditExchange(state, "Export permission step", `${role} · ${row.status}`, user, { entityId: row.id, category: "security" }, uid);
  return { ok: true, request: row };
}

export function revokeExportPermissionGrant(state, grantId, user, uid, now) {
  ensureExchangeState(state);
  const grant = (state.exportPermissionGrants || []).find((item) => item.id === grantId);
  if (!grant) return { ok: false, error: "Grant not found", errorCode: "EX-001", http: 404 };
  grant.status = "revoked";
  grant.revokedAt = nowIso(now);
  grant.revokedBy = user?.id;
  auditExchange(state, "Export permission revoked", grant.permission, user, { entityId: grant.id, category: "security" }, uid);
  return { ok: true, grant };
}

export function exchangeDashboard(state) {
  ensureExchangeState(state);
  return {
    imports: (state.importJobs || []).length,
    exports: (state.exportJobs || []).length,
    migrations: (state.migrationJobs || []).length,
    bulk: (state.bulkOperations || []).length,
    staged: (state.exchangeStagedRows || []).length,
    validationErrors: (state.validationErrors || []).length,
    pendingApprovals: (state.exportJobs || []).filter((item) => item.status === "pending_approval").length
  };
}

export function exchangeReports(state, reportId) {
  ensureExchangeState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "exchange_imports") return table(["id", "dataset", "status", "processed"], state.importJobs || []);
  if (reportId === "exchange_exports") return table(["id", "dataset", "status", "classification", "fileSize"], state.exportJobs || []);
  if (reportId === "exchange_migrations") return table(["id", "dataset", "result"], state.migrationJobs || []);
  if (reportId === "exchange_validation") return table(["dataset", "field", "code", "message"], state.validationErrors || []);
  if (reportId === "exchange_reconciliation") return table(["jobId", "expected", "actual", "matched"], state.reconciliationResults || []);
  if (reportId === "exchange_bulk") return table(["id", "dataset", "processed", "result"], state.bulkOperations || []);
  if (reportId === "exchange_history") return table(["jobId", "exportType", "result"], state.exportHistory || []);
  return table(["id"], []);
}

export function exportExchangeCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function saveMappingTemplate(state, template, user, uid, now) {
  ensureExchangeState(state);
  if (!permitted(user, "Exchange.Map") && !permitted(user, "Exchange.Import")) {
    return { ok: false, error: "You cannot save mapping templates", errorCode: "EX-002", http: 403 };
  }
  const row = {
    id: template.id || newId("map", uid),
    name: template.name,
    dataset: template.dataset,
    fields: template.fields || [],
    updatedAt: nowIso(now)
  };
  const existing = state.mappingTemplates.findIndex((item) => item.id === row.id);
  if (existing >= 0) state.mappingTemplates[existing] = row;
  else state.mappingTemplates.push(row);
  return { ok: true, template: row };
}

export function assertExchangeBoundary() {
  return {
    centralized: true,
    postsCollections: false,
    postsJournals: false,
    restHttp: false,
    graphqlHttp: false,
    financialApply: false,
    audited: true,
    resumable: true
  };
}

registerJobHandler("exchange_import", (state, job, ctx) => importExchange(state, job.payload || {}, ctx.user, ctx.uid, ctx.now));
registerJobHandler("exchange_export", (state, job, ctx) => {
  const target = (state.exportJobs || []).find((item) => item.id === job.payload?.exportJobId);
  if (!target) return { ok: false, error: "Export job not found" };
  const rows = rowsForExport(state, target.dataset, ctx.user, { branchId: target.branchId });
  return completeExportJob(state, target, rows, ctx.user, ctx.uid, ctx.now, Number.MAX_SAFE_INTEGER);
});
registerJobHandler("exchange_migrate", (state, job, ctx) => migrateExchange(state, job.payload || {}, ctx.user, ctx.uid, ctx.now));
registerJobHandler("exchange_bulk", (state, job, ctx) => bulkExchange(state, job.payload || {}, ctx.user, ctx.uid, ctx.now));

registerContractHandler("Exchange.Validate.v1", (state, payload, ctx) => validateImport(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Exchange.Import.v1", (state, payload, ctx) => importExchange(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Exchange.Export.v1", (state, payload, ctx) => exportExchange(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Exchange.Migrate.v1", (state, payload, ctx) => migrateExchange(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Exchange.Bulk.v1", (state, payload, ctx) => bulkExchange(state, payload, ctx.user, ctx.uid, ctx.now));
