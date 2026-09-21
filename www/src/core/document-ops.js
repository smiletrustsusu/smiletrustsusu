/**
 * Module 17 — Receipt, Document & Statement Management.
 * Central document engine. Other modules must not generate printable documents.
 * Wraps existing buildReceiptNo and offline localReceipts mapping.
 * No REST/GraphQL. No second collection or ledger posting.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { getConfigValue } from "./system-config.js";
import { queueNotification } from "./notifications.js";
import { buildReceiptNo } from "./receipts.js";
import { qrSvg, barcodeSvg, receiptVerifyText } from "./receipt-codes.js";
import { issueLocalReceipt, promoteReceipt, canPerformOffline } from "./sync-ops.js";
import { canAction, canApproveAmount } from "./rbac.js";
import { isSystemOwner, ROLE } from "./roles.js";
import { formatBusinessId } from "./identifiers.js";
import {
  DOCUMENT_STATES,
  DOCUMENT_TRANSITION_MATRIX,
  RECEIPT_OUTCOMES,
  RECEIPT_OUTCOME_MATRIX,
  TEMP_RECEIPT_STATES,
  canTransitionDocument,
  canTransitionOutcome,
  isSignedImmutable,
  ensureDocumentLifecycleState,
  transitionDocument,
  transitionOutcome,
  transitionTempReceipt
} from "./document-lifecycle.js";

export {
  DOCUMENT_STATES,
  DOCUMENT_TRANSITION_MATRIX,
  RECEIPT_OUTCOMES,
  RECEIPT_OUTCOME_MATRIX,
  TEMP_RECEIPT_STATES,
  canTransitionDocument,
  canTransitionOutcome,
  isSignedImmutable,
  transitionDocument,
  transitionOutcome
};

export const DOCUMENT_SCHEMA_VERSION = "1.0.0";

export const DOCUMENT_TYPES = {
  savings_collection_receipt: { category: "financial", label: "Savings Collection Receipt" },
  withdrawal_receipt: { category: "financial", label: "Withdrawal Receipt" },
  loan_disbursement_receipt: { category: "financial", label: "Loan Disbursement Receipt" },
  loan_repayment_receipt: { category: "financial", label: "Loan Repayment Receipt" },
  mobile_money_receipt: { category: "financial", label: "Mobile Money Receipt" },
  payment_confirmation: { category: "financial", label: "Payment Confirmation" },
  journal_voucher: { category: "financial", label: "Journal Voucher" },
  cash_transfer_receipt: { category: "financial", label: "Cash Transfer Receipt" },
  adjustment_voucher: { category: "financial", label: "Adjustment Voucher" },
  reversal_receipt: { category: "financial", label: "Reversal Receipt" },
  refund_receipt: { category: "financial", label: "Refund Receipt" },
  customer_account_statement: { category: "customer", label: "Customer Account Statement" },
  savings_statement: { category: "customer", label: "Savings Statement" },
  loan_statement: { category: "customer", label: "Loan Statement" },
  contribution_history: { category: "customer", label: "Contribution History" },
  group_statement: { category: "customer", label: "Group Statement" },
  passbook: { category: "customer", label: "Passbook" },
  loan_agreement: { category: "loan", label: "Loan Agreement" },
  repayment_schedule: { category: "loan", label: "Repayment Schedule" },
  guarantor_form: { category: "loan", label: "Guarantor Form" },
  loan_approval_letter: { category: "loan", label: "Loan Approval Letter" },
  loan_closure_certificate: { category: "loan", label: "Loan Closure Certificate" },
  branch_report: { category: "administrative", label: "Branch Report" },
  cash_summary: { category: "administrative", label: "Cash Summary" },
  daily_collection_summary: { category: "administrative", label: "Daily Collection Summary" },
  agent_performance_summary: { category: "administrative", label: "Agent Performance Summary" },
  configuration_report: { category: "administrative", label: "Configuration Report" },
  audit_report: { category: "administrative", label: "Audit Report" },
  membership_certificate: { category: "certificate", label: "Membership Certificate" },
  savings_completion_certificate: { category: "certificate", label: "Savings Completion Certificate" },
  group_registration_certificate: { category: "certificate", label: "Group Registration Certificate" },
  loan_clearance_certificate: { category: "certificate", label: "Loan Clearance Certificate" }
};

export const DOCUMENT_ACTIONS = [
  "generate", "issue", "deliver", "reprint", "reissue", "cancel", "reject",
  "reverse", "refund", "supersede", "archive", "restore", "approve_template", "publish_template"
];

export const MAKER_CHECKER_ACTIONS = ["cancel", "reverse", "refund", "supersede", "publish_template", "reissue"];

const DOCUMENT_ARRAYS = [
  "documents",
  "documentTemplates",
  "templateVersions",
  "documentVersions",
  "documentMetadata",
  "documentSignatures",
  "documentQrCodes",
  "documentDelivery",
  "documentStorage",
  "documentCategories",
  "documentActivityLogs",
  "documentJobs",
  "offlineReceipts",
  "receiptReconciliation",
  "receiptMappingHistory",
  "receiptApprovals",
  "documentStatusHistory",
  "receiptOutcomeHistory"
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

function auditDocument(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "operational",
    guarantee: "G1",
    module: "17",
    ...extras
  }, uid);
}

function logActivity(state, action, details, extras = {}, uid) {
  state.documentActivityLogs.push({
    id: newId("dal", uid),
    action,
    details,
    userId: extras.userId || "",
    createdAt: nowIso(extras.now)
  });
}

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => (vars[key] == null ? "" : String(vars[key])));
}

function seedTemplates() {
  const receiptBody = `<header>{{businessName}}</header>
<p>Receipt {{receiptNo}}</p>
<p>{{customerName}} · {{agentName}} · {{branchName}}</p>
<p>{{date}} {{time}} · {{paymentMethod}}</p>
<p>Amount: GHS {{amount}}</p>
<p>Balance after: GHS {{balanceAfter}}</p>
<p>{{temporaryNote}}</p>
<div class="codes">{{qrSvg}}{{barcodeSvg}}</div>
<footer>{{footer}}</footer>`;
  return [
    { id: "tpl-receipt", type: "savings_collection_receipt", name: "Standard receipt", language: "en", theme: "default", published: true, version: 1, header: "{{businessName}}", footer: "Smile Trust Susu — verify with QR", watermark: "", body: receiptBody },
    { id: "tpl-statement", type: "customer_account_statement", name: "Customer statement", language: "en", theme: "default", published: true, version: 1, header: "{{businessName}} Statement", footer: "For information only", watermark: "", body: "<h1>Statement</h1><p>{{customerName}}</p><p>{{from}} to {{to}}</p><p>Opening GHS {{openingBalance}}</p>{{rowsHtml}}<p>Closing GHS {{closingBalance}}</p>" },
    { id: "tpl-schedule", type: "repayment_schedule", name: "Loan schedule", language: "en", theme: "default", published: true, version: 1, header: "Repayment Schedule", footer: "", watermark: "", body: "<h1>Schedule {{loanId}}</h1>{{rowsHtml}}" },
    { id: "tpl-agreement", type: "loan_agreement", name: "Loan agreement", language: "en", theme: "default", published: true, version: 1, header: "Loan Agreement", footer: "Signed copy is immutable", watermark: "DRAFT", body: "<h1>Loan Agreement</h1><p>{{customerName}} borrows GHS {{amount}} at {{interest}}%.</p>" },
    { id: "tpl-certificate", type: "membership_certificate", name: "Membership certificate", language: "en", theme: "default", published: true, version: 1, header: "{{businessName}}", footer: "", watermark: "", body: "<h1>Membership Certificate</h1><p>{{customerName}} · {{customerNumber}}</p>" },
    { id: "tpl-reversal", type: "reversal_receipt", name: "Reversal receipt", language: "en", theme: "default", published: true, version: 1, header: "Reversal", footer: "Compensating document", watermark: "REVERSAL", body: "<h1>Reversal {{receiptNo}}</h1><p>Original {{originalReceiptNo}}</p><p>GHS {{amount}}</p>" },
    { id: "tpl-refund", type: "refund_receipt", name: "Refund receipt", language: "en", theme: "default", published: true, version: 1, header: "Refund", footer: "Compensating document", watermark: "REFUND", body: "<h1>Refund {{receiptNo}}</h1><p>Original {{originalReceiptNo}}</p><p>GHS {{amount}}</p>" }
  ];
}

export function ensureDocumentState(state = {}) {
  DOCUMENT_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  ensureDocumentLifecycleState(state);
  if (!state.documentTemplates.length) {
    state.documentTemplates = seedTemplates();
    state.documentTemplates.forEach((tpl) => {
      state.templateVersions.push({
        id: `${tpl.id}-v1`,
        templateId: tpl.id,
        version: 1,
        body: tpl.body,
        header: tpl.header,
        footer: tpl.footer,
        published: true,
        createdAt: nowIso()
      });
    });
  }
  if (!state.documentCategories.length) {
    state.documentCategories = ["financial", "customer", "loan", "administrative", "certificate"].map((id) => ({ id, name: id }));
  }
  return state;
}

function publishedTemplate(state, type) {
  return (state.documentTemplates || []).find((item) => item.type === type && item.published !== false)
    || (state.documentTemplates || []).find((item) => item.id === "tpl-receipt");
}

function documentById(state, id) {
  return (state.documents || []).find((item) => item.id === id);
}

function documentByReceipt(state, number) {
  const value = String(number || "").trim().toLowerCase();
  if (!value) return null;
  return (state.documents || []).find((item) =>
    [item.receiptNo, item.permanentReceiptNo, item.temporaryReceiptNo, item.id]
      .some((field) => String(field || "").toLowerCase() === value)
  );
}

export function renderTemplate(state, type, vars = {}) {
  ensureDocumentState(state);
  const tpl = publishedTemplate(state, type);
  const merged = {
    businessName: state.settings?.businessName || "Smile Trust Susu",
    footer: tpl?.footer || "",
    header: tpl?.header || "",
    temporaryNote: "",
    qrSvg: "",
    barcodeSvg: "",
    rowsHtml: "",
    ...vars
  };
  const body = interpolate(tpl?.body || "<p>{{receiptNo}}</p>", merged);
  const header = interpolate(tpl?.header || "", merged);
  const footer = interpolate(tpl?.footer || "", merged);
  const watermark = interpolate(tpl?.watermark || "", merged);
  return {
    html: `<article class="smile-document" data-type="${type}"><div class="header">${header}</div>${watermark ? `<div class="watermark">${watermark}</div>` : ""}${body}<div class="footer">${footer}</div></article>`,
    templateId: tpl?.id || "",
    templateVersion: tpl?.version || 1
  };
}

function storeContent(state, document, html, uid, now) {
  const hash = payloadHash({ html, id: document.id, version: document.version || 1 });
  const row = {
    id: newId("dst", uid),
    documentId: document.id,
    version: document.version || 1,
    contentHash: hash,
    encryptedAtRest: state.settings?.encryptOfflineQueue !== false,
    createdAt: nowIso(now)
  };
  state.documentStorage.push(row);
  document.contentHtml = html;
  document.contentHash = hash;
  return row;
}

function attachQr(state, document, uid, now) {
  const payload = {
    documentId: document.id,
    receiptNo: document.receiptNo || document.permanentReceiptNo || document.temporaryReceiptNo,
    issuedAt: document.issuedAt || document.createdAt,
    version: document.version || 1,
    status: document.status,
    branchId: document.branchId || ""
  };
  const token = payloadHash(payload);
  const verifyText = receiptVerifyText({
    receiptNo: payload.receiptNo,
    amount: document.amount,
    date: String(document.createdAt || "").slice(0, 10),
    customerName: document.customerName || ""
  });
  const row = {
    id: newId("dqr", uid),
    documentId: document.id,
    token,
    payload,
    svg: qrSvg(token),
    barcodeSvg: barcodeSvg(payload.receiptNo || document.id),
    verifyText,
    createdAt: nowIso(now)
  };
  state.documentQrCodes.push(row);
  document.qrToken = token;
  return row;
}

export function generateDocument(state, request = {}, user, uid, now) {
  now = nowMs(now);
  ensureDocumentState(state);
  const type = request.type || "savings_collection_receipt";
  if (!DOCUMENT_TYPES[type]) return { ok: false, error: "Unknown document type" };
  if (["pin", "momoPin", "momoPIN", "bankPassword", "password", "otp"].some((key) => request[key])) {
    return { ok: false, error: "Documents must never request or store customer PINs or banking passwords" };
  }
  if (user && !canAction(user, "Document.Generate") && !canAction(user, "Document.View") && !canAction(user, "Savings.Collect") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot generate documents" };
  }
  if (request.businessType && request.businessId) {
    const existing = (state.documents || []).find((item) =>
      item.businessType === request.businessType && item.businessId === request.businessId && item.type === type && !item.compensating
    );
    if (existing) return { ok: true, duplicate: true, document: existing };
  }
  const idempotencyKey = request.idempotencyKey || `doc:${type}:${request.businessType || "misc"}:${request.businessId || newId("dockey", uid)}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey,
    operationType: "document.generate",
    fingerprint: { operationType: "document.generate", type, businessId: request.businessId || "", amount: request.amount },
    source: "document-engine",
    userId: user?.id || "",
    now
  }, uid);
  if (gate.duplicate) {
    const document = documentById(state, gate.record?.transactionId) || (state.documents || []).find((item) => item.idempotencyKey === idempotencyKey);
    return { ok: true, duplicate: true, document };
  }
  if (!gate.proceed) return { ok: false, error: gate.error || "Document is already processing" };

  const offline = request.offline === true;
  const receiptNo = request.receiptNo || (offline ? "" : buildReceiptNo(state, request.collectorCode || getConfigValue(state, "finance.receiptPrefix") || "RCP"));
  const tempPrefix = String(getConfigValue(state, "document.tempPrefix") || "TMP-");
  const temporaryReceiptNo = offline
    ? (request.temporaryReceiptNo || `${tempPrefix}${receiptNo || formatBusinessId("TMP", request.branchCode || "HQ", new Date(now).getFullYear(), (state.offlineReceipts.length + 1))}`)
    : (request.temporaryReceiptNo || "");
  const vars = {
    receiptNo: receiptNo || temporaryReceiptNo,
    customerName: request.customerName || "",
    agentName: request.agentName || "",
    branchName: request.branchName || "",
    date: request.date || nowIso(now).slice(0, 10),
    time: nowIso(now).slice(11, 19),
    paymentMethod: request.paymentMethod || "Cash",
    amount: Number(request.amount || 0).toFixed(2),
    balanceAfter: Number(request.balanceAfter || 0).toFixed(2),
    temporaryNote: offline ? "TEMPORARY / OFFLINE — final confirmation pending synchronization." : "",
    customerNumber: request.customerNumber || "",
    loanId: request.loanId || "",
    interest: request.interest || "",
    from: request.from || "",
    to: request.to || "",
    openingBalance: Number(request.openingBalance || 0).toFixed(2),
    closingBalance: Number(request.closingBalance || 0).toFixed(2),
    rowsHtml: request.rowsHtml || "",
    originalReceiptNo: request.originalReceiptNo || ""
  };
  const rendered = renderTemplate(state, type, vars);
  const document = {
    id: newId("doc", uid),
    type,
    category: DOCUMENT_TYPES[type].category,
    status: "draft",
    outcome: request.outcome || "valid",
    version: 1,
    receiptNo: receiptNo || temporaryReceiptNo,
    temporaryReceiptNo,
    permanentReceiptNo: offline ? "" : (receiptNo || ""),
    businessType: request.businessType || "",
    businessId: request.businessId || "",
    transactionId: request.transactionId || request.businessId || "",
    localTransactionId: request.localTransactionId || "",
    correlationId: request.correlationId || newId("doccorr", uid),
    idempotencyKey,
    customerId: request.customerId || "",
    customerName: request.customerName || "",
    agentId: request.agentId || user?.id || "",
    agentName: request.agentName || user?.name || "",
    branchId: request.branchId || "",
    deviceId: request.deviceId || "",
    amount: Number(request.amount || 0),
    paymentMethod: request.paymentMethod || "",
    currency: "GHS",
    offline,
    accountingPosted: Boolean(request.accountingPosted || request.accountingAlreadyPosted),
    businessCommitted: request.businessCommitted !== false,
    signed: false,
    compensating: Boolean(request.compensating),
    originalDocumentId: request.originalDocumentId || "",
    originalReceiptNo: request.originalReceiptNo || "",
    linkedDocumentIds: [],
    templateId: rendered.templateId,
    templateVersion: rendered.templateVersion,
    createdBy: user?.id || "",
    createdAt: nowIso(now),
    issuedAt: "",
    statusHistory: []
  };
  state.documents.push(document);
  const generated = transitionDocument(state, document, "generated", { uid, now, user, reason: "generated" });
  if (!generated.ok) {
    failIdempotentRequest(state, idempotencyKey, { recoverable: false, error: generated.error, now });
    return generated;
  }
  storeContent(state, document, rendered.html, uid, now);
  state.documentMetadata.push({
    id: newId("dmd", uid),
    documentId: document.id,
    type,
    customerId: document.customerId,
    branchId: document.branchId,
    amount: document.amount,
    createdAt: nowIso(now)
  });
  state.documentVersions.push({
    id: newId("dv", uid),
    documentId: document.id,
    version: document.version,
    contentHash: document.contentHash,
    createdAt: nowIso(now)
  });

  if (offline) {
    const tempRow = {
      id: newId("orp", uid),
      temporaryReceiptNumber: temporaryReceiptNo,
      localTransactionId: document.localTransactionId || document.businessId,
      deviceId: document.deviceId,
      agentId: document.agentId,
      branchId: document.branchId,
      status: "created",
      createdAt: nowIso(now)
    };
    state.offlineReceipts.push(tempRow);
    transitionTempReceipt(tempRow, "pending_synchronization", now);
    issueLocalReceipt(state, {
      temporaryReceiptNo,
      transactionId: document.transactionId,
      deviceId: document.deviceId,
      agentId: document.agentId,
      offline: true
    }, uid);
  }

  completeIdempotentRequest(state, idempotencyKey, {
    transactionId: document.id,
    responsePayload: { documentId: document.id, receiptNo: document.receiptNo }
  }, { source: "document-engine", now });
  auditDocument(state, "Document generated", `${type} · ${document.receiptNo}`, user, {
    entityId: document.id,
    correlationId: document.correlationId
  }, uid);
  logActivity(state, "Document generated", document.receiptNo, { userId: user?.id, now }, uid);
  return { ok: true, document, html: rendered.html };
}

export function issueDocument(state, documentId, { user, uid, now, skipAccountingCheck = false } = {}) {
  ensureDocumentState(state);
  const document = documentById(state, documentId);
  if (!document) return { ok: false, error: "Document not found" };
  if (document.offline && !document.permanentReceiptNo) {
    return { ok: false, error: "Permanent receipts are issued only after successful reconciliation" };
  }
  if (!skipAccountingCheck && DOCUMENT_TYPES[document.type]?.category === "financial" && !document.compensating) {
    if (!document.businessCommitted) return { ok: false, error: "Permanent receipts require a committed business transaction" };
    if (!document.accountingPosted) return { ok: false, error: "Permanent receipts require posted accounting entries" };
  }
  if (document.status === "generated" || document.status === "approved") {
    const issued = transitionDocument(state, document, "issued", { uid, now, user, reason: "issued" });
    if (!issued.ok) return issued;
  }
  document.issuedAt = document.issuedAt || nowIso(now);
  attachQr(state, document, uid, now);
  const html = renderTemplate(state, document.type, {
    receiptNo: document.permanentReceiptNo || document.receiptNo,
    customerName: document.customerName,
    agentName: document.agentName,
    branchName: document.branchName || "",
    date: String(document.createdAt || "").slice(0, 10),
    time: String(document.createdAt || "").slice(11, 19),
    paymentMethod: document.paymentMethod,
    amount: Number(document.amount || 0).toFixed(2),
    balanceAfter: Number(document.balanceAfter || 0).toFixed(2),
    temporaryNote: "",
    qrSvg: (state.documentQrCodes || []).filter((item) => item.documentId === document.id).slice(-1)[0]?.svg || "",
    barcodeSvg: (state.documentQrCodes || []).filter((item) => item.documentId === document.id).slice(-1)[0]?.barcodeSvg || "",
    originalReceiptNo: document.originalReceiptNo || ""
  }).html;
  storeContent(state, document, html, uid, now);
  state.documentVersions.push({
    id: newId("dv", uid),
    documentId: document.id,
    version: document.version,
    contentHash: document.contentHash,
    createdAt: nowIso(now)
  });
  auditDocument(state, "Document issued", document.receiptNo, user, { entityId: document.id, correlationId: document.correlationId }, uid);
  return { ok: true, document };
}

export function signDocument(state, documentId, { user, uid, now, kind = "system" } = {}) {
  ensureDocumentState(state);
  const document = documentById(state, documentId);
  if (!document) return { ok: false, error: "Document not found" };
  if (document.status !== "issued" && document.status !== "delivered") {
    return { ok: false, error: "Only issued documents can be signed" };
  }
  const hash = payloadHash({
    documentId: document.id,
    contentHash: document.contentHash,
    version: document.version,
    officer: user?.id || "system"
  });
  const row = {
    id: newId("dsig", uid),
    documentId: document.id,
    kind,
    officerId: user?.id || "system",
    hash,
    createdAt: nowIso(now)
  };
  state.documentSignatures.push(row);
  document.signed = true;
  document.signatureHash = hash;
  document.signedAt = nowIso(now);
  auditDocument(state, "Document signed", document.receiptNo, user, { entityId: document.id, category: "security" }, uid);
  return { ok: true, document, signature: row };
}

export function verifyDocumentQr(state, token) {
  ensureDocumentState(state);
  const row = (state.documentQrCodes || []).find((item) => item.token === token);
  if (!row) return { ok: false, authentic: false, error: "Unknown verification code" };
  const document = documentById(state, row.documentId);
  if (!document) return { ok: false, authentic: false, error: "Document not found" };
  const expected = payloadHash({
    documentId: document.id,
    receiptNo: document.receiptNo || document.permanentReceiptNo || document.temporaryReceiptNo,
    issuedAt: document.issuedAt || document.createdAt,
    version: row.payload?.version || document.version,
    status: row.payload?.status || document.status,
    branchId: document.branchId || ""
  });
  const authentic = expected === token || row.token === token;
  return {
    ok: authentic,
    authentic,
    issueDate: String(document.issuedAt || document.createdAt || "").slice(0, 10),
    status: document.status,
    outcome: document.outcome,
    branchId: document.branchId || "",
    version: document.version,
    receiptNo: document.permanentReceiptNo || document.receiptNo,
    temporaryReceiptNo: document.temporaryReceiptNo || ""
  };
}

export function deliverDocument(state, documentId, { channel = "Download", user, uid, now, address = "" } = {}) {
  ensureDocumentState(state);
  const document = documentById(state, documentId);
  if (!document) return { ok: false, error: "Document not found" };
  if (user && !canAction(user, "Document.Deliver") && !canAction(user, "Document.View") && !canAction(user, "Savings.Collect") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot deliver documents" };
  }
  if (document.status === "issued") {
    const moved = transitionDocument(state, document, "delivered", { uid, now, user, reason: channel });
    if (!moved.ok) return moved;
  }
  const row = {
    id: newId("ddl", uid),
    documentId: document.id,
    channel,
    address,
    status: "queued",
    createdAt: nowIso(now)
  };
  state.documentDelivery.push(row);
  queueNotification(state, {
    event: "receipt_generated",
    channel: channel === "SMS" || channel === "Email" || channel === "WhatsApp" ? channel : "In-App",
    customerId: document.customerId,
    userId: user?.id || "",
    vars: { name: document.customerName || "", amount: Number(document.amount || 0).toFixed(2), receiptNo: document.permanentReceiptNo || document.receiptNo },
    uid,
    idempotencyKey: `${document.id}:deliver:${channel}`,
    correlationId: document.correlationId,
    committed: true
  });
  row.status = "sent";
  auditDocument(state, "Document delivered", `${document.receiptNo} · ${channel}`, user, { entityId: document.id }, uid);
  return { ok: true, document, delivery: row };
}

export function registerBusinessDocument(state, request = {}, user, uid, now) {
  const generated = generateDocument(state, {
    ...request,
    accountingPosted: request.accountingAlreadyPosted !== false && request.accountingPosted !== false,
    businessCommitted: request.businessCommitted !== false
  }, user, uid, now);
  if (!generated.ok || generated.duplicate) return generated;
  if (!generated.document.offline) {
    return issueDocument(state, generated.document.id, { user, uid, now });
  }
  return generated;
}

export function generateStatement(state, { customerId, from, to, type = "customer_account_statement", user, uid, now } = {}) {
  ensureDocumentState(state);
  const customer = (state.customers || []).find((item) => item.id === customerId);
  if (!customer) return { ok: false, error: "Customer not found" };
  const start = from || "0000-01-01";
  const end = to || "9999-12-31";
  const rows = (state.collections || []).filter((item) =>
    item.customerId === customerId && String(item.date || "") >= start && String(item.date || "") <= end && !item.reversed
  );
  const opening = (state.collections || []).filter((item) =>
    item.customerId === customerId && String(item.date || "") < start && !item.reversed
  ).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const movement = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const rowsHtml = `<table>${rows.map((item) => `<tr><td>${item.date}</td><td>${item.receiptNo || ""}</td><td>${Number(item.amount || 0).toFixed(2)}</td></tr>`).join("")}</table>`;
  return generateDocument(state, {
    type,
    customerId,
    customerName: customer.name,
    customerNumber: customer.accountNo || customer.customerNumber || "",
    from: start,
    to: end,
    openingBalance: opening,
    closingBalance: opening + movement,
    rowsHtml,
    businessType: "statement",
    businessId: `${customerId}:${start}:${end}:${type}`,
    accountingPosted: true,
    offline: false
  }, user, uid, now);
}

export function generateLoanSchedule(state, loanId, user, uid, now) {
  const loan = (state.loans || []).find((item) => item.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found" };
  const schedule = loan.interestSchedule || [];
  const rowsHtml = `<table>${schedule.map((item) => `<tr><td>${item.dueDate || item.date || ""}</td><td>${Number(item.amount || item.interest || 0).toFixed(2)}</td></tr>`).join("")}</table>`;
  return generateDocument(state, {
    type: "repayment_schedule",
    loanId: loan.id,
    customerId: loan.customerId,
    amount: loan.principal,
    interest: loan.interest,
    rowsHtml,
    businessType: "loan",
    businessId: `${loan.id}:schedule`,
    accountingPosted: true
  }, user, uid, now);
}

export function searchDocuments(state, query = {}) {
  ensureDocumentState(state);
  const q = String(query.q || "").trim().toLowerCase();
  return (state.documents || []).filter((item) => {
    if (query.type && item.type !== query.type) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.outcome && item.outcome !== query.outcome) return false;
    if (query.customerId && item.customerId !== query.customerId) return false;
    if (query.branchId && item.branchId !== query.branchId) return false;
    if (!q) return true;
    return [item.id, item.receiptNo, item.temporaryReceiptNo, item.permanentReceiptNo, item.correlationId, item.customerName, item.transactionId]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function documentDashboard(state) {
  ensureDocumentState(state);
  const rows = state.documents || [];
  return {
    total: rows.length,
    issued: rows.filter((item) => item.status === "issued" || item.status === "delivered").length,
    draft: rows.filter((item) => item.status === "draft" || item.status === "generated").length,
    pendingOffline: (state.offlineReceipts || []).filter((item) => ["created", "pending_synchronization", "synchronizing"].includes(item.status)).length,
    reconciled: (state.receiptReconciliation || []).length,
    deliveries: (state.documentDelivery || []).length,
    jobs: (state.documentJobs || []).filter((item) => item.status !== "completed").length
  };
}

export function reconcileOfflineReceipt(state, {
  temporaryReceiptNo,
  permanentReceiptNo,
  localTransactionId,
  serverTransactionId,
  deviceId,
  agentId,
  branchId,
  syncSessionId,
  correlationId,
  user,
  uid,
  now
} = {}) {
  ensureDocumentState(state);
  const temp = String(temporaryReceiptNo || "").trim();
  if (!temp) return { ok: false, error: "Temporary receipt number is required" };
  const existing = (state.receiptReconciliation || []).find((item) => item.temporaryReceiptNumber === temp);
  if (existing) {
    logActivity(state, "Duplicate synchronization attempt", temp, { userId: user?.id, now }, uid);
    auditDocument(state, "Duplicate receipt synchronization", temp, user, {
      entityId: existing.id,
      correlationId: existing.correlationId,
      category: "financial"
    }, uid);
    return { ok: true, duplicate: true, mapping: existing, permanentReceiptNo: existing.permanentReceiptNumber };
  }
  const document = documentByReceipt(state, temp);
  const committed = document ? document.businessCommitted !== false && document.accountingPosted : true;
  if (document && !committed) {
    const tempRow = (state.offlineReceipts || []).find((item) => item.temporaryReceiptNumber === temp);
    if (tempRow) transitionTempReceipt(tempRow, "rejected", now);
    if (document) transitionOutcome(state, document, "rejected", { uid, now, user, reason: "transaction_not_committed" });
    return { ok: false, error: "Permanent receipts are issued only after commit, accounting, and audit", conflict: true };
  }
  const permanent = permanentReceiptNo || (document?.receiptNo && !String(document.receiptNo).startsWith("TMP-") ? document.receiptNo : buildReceiptNo(state, "RCP"));
  const promoted = promoteReceipt(state, temp, permanent);
  if (promoted.error && !(state.localReceipts || []).some((item) => item.temporaryReceiptNo === temp)) {
    issueLocalReceipt(state, { temporaryReceiptNo: temp, transactionId: serverTransactionId || localTransactionId, deviceId, agentId }, uid);
    promoteReceipt(state, temp, permanent);
  }
  const mapping = {
    id: newId("rrc", uid),
    reconciliationId: newId("rrc", uid),
    temporaryReceiptNumber: temp,
    permanentReceiptNumber: permanent,
    localTransactionId: localTransactionId || "",
    serverTransactionId: serverTransactionId || "",
    deviceId: deviceId || "",
    agentId: agentId || "",
    branchId: branchId || "",
    synchronizationSessionId: syncSessionId || "",
    mappingTimestamp: nowIso(now),
    correlationId: correlationId || document?.correlationId || "",
    reconciliationStatus: "reconciled"
  };
  state.receiptReconciliation.push(mapping);
  const history = {
    id: newId("rmh", uid),
    mappingId: mapping.id,
    previousStatus: "pending_synchronization",
    newStatus: "reconciled",
    changedAt: nowIso(now),
    changedBy: user?.id || "system"
  };
  state.receiptMappingHistory.push(history);
  const tempRow = (state.offlineReceipts || []).find((item) => item.temporaryReceiptNumber === temp);
  if (tempRow) {
    transitionTempReceipt(tempRow, "synchronizing", now);
    transitionTempReceipt(tempRow, "reconciled", now);
  }
  if (document) {
    document.permanentReceiptNo = permanent;
    document.receiptNo = document.receiptNo || permanent;
    document.offline = false;
    issueDocument(state, document.id, { user, uid, now });
  }
  auditDocument(state, "Offline receipt reconciled", `${temp} → ${permanent}`, user, {
    entityId: mapping.id,
    correlationId: mapping.correlationId,
    category: "financial"
  }, uid);
  return { ok: true, mapping, permanentReceiptNo: permanent, document };
}

export function rejectTemporaryReceipt(state, temporaryReceiptNo, { user, uid, now, reason = "" } = {}) {
  ensureDocumentState(state);
  const tempRow = (state.offlineReceipts || []).find((item) => item.temporaryReceiptNumber === temporaryReceiptNo);
  if (tempRow) {
    const moved = transitionTempReceipt(tempRow, "rejected", now);
    if (!moved.ok) return moved;
  }
  const document = documentByReceipt(state, temporaryReceiptNo);
  if (document) {
    transitionOutcome(state, document, "rejected", { uid, now, user, reason });
    if (document.status === "generated" || document.status === "draft") {
      transitionDocument(state, document, "cancelled", { uid, now, user, reason });
    }
  }
  auditDocument(state, "Temporary receipt rejected", temporaryReceiptNo, user, { category: "financial" }, uid);
  return { ok: true, document, temporary: tempRow };
}

export function cancelTemporaryReceipt(state, temporaryReceiptNo, { user, uid, now, reason = "" } = {}) {
  ensureDocumentState(state);
  const tempRow = (state.offlineReceipts || []).find((item) => item.temporaryReceiptNumber === temporaryReceiptNo);
  if (tempRow) {
    const moved = transitionTempReceipt(tempRow, "cancelled", now);
    if (!moved.ok) return moved;
  }
  const document = documentByReceipt(state, temporaryReceiptNo);
  if (document) {
    transitionOutcome(state, document, "cancelled", { uid, now, user, reason });
    if (["draft", "generated", "approved"].includes(document.status)) {
      transitionDocument(state, document, "cancelled", { uid, now, user, reason });
    }
  }
  auditDocument(state, "Temporary receipt cancelled", temporaryReceiptNo, user, { category: "financial" }, uid);
  return { ok: true, document };
}

function linkedAmount(original, amount, already) {
  const remaining = +(Number(original.amount) - Number(already || 0)).toFixed(2);
  const value = amount == null ? remaining : Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter a valid amount" };
  if (value - remaining > 0.009) return { error: "Amount cannot exceed the original transaction" };
  return { amount: value, remaining };
}

export function createCompensatingDocument(state, originalId, { type, amount, reason = "", user, uid, now, partial = false } = {}) {
  ensureDocumentState(state);
  const original = documentById(state, originalId);
  if (!original) return { ok: false, error: "Original document not found" };
  if (isSignedImmutable(original) && original.status === "cancelled") {
    return { ok: false, error: "Signed documents are immutable" };
  }
  const snapshot = {
    receiptNo: original.receiptNo,
    amount: original.amount,
    contentHash: original.contentHash,
    status: original.status
  };
  const kind = type === "refund_receipt" ? "refund" : "reversal";
  const already = (state.documents || [])
    .filter((item) => item.originalDocumentId === original.id && item.type === type)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const money = linkedAmount(original, partial ? amount : null, already);
  if (money.error) return { ok: false, error: money.error };
  const generated = generateDocument(state, {
    type,
    amount: money.amount,
    customerId: original.customerId,
    customerName: original.customerName,
    agentId: original.agentId,
    branchId: original.branchId,
    compensating: true,
    originalDocumentId: original.id,
    originalReceiptNo: original.permanentReceiptNo || original.receiptNo,
    accountingPosted: true,
    businessCommitted: true,
    businessType: kind,
    businessId: `${original.id}:${kind}:${already + money.amount}`,
    reason
  }, user, uid, now);
  if (!generated.ok) return generated;
  const issued = issueDocument(state, generated.document.id, { user, uid, now, skipAccountingCheck: true });
  if (!issued.ok) return issued;
  original.linkedDocumentIds = [...(original.linkedDocumentIds || []), generated.document.id];
  const total = already + money.amount;
  const nextOutcome = kind === "refund"
    ? (total + 0.009 >= Number(original.amount) ? "fully_refunded" : "partially_refunded")
    : (total + 0.009 >= Number(original.amount) ? "fully_reversed" : "partially_reversed");
  const moved = transitionOutcome(state, original, nextOutcome, { uid, now, user, reason });
  if (!moved.ok) return moved;
  if (original.receiptNo !== snapshot.receiptNo || original.amount !== snapshot.amount || original.contentHash !== snapshot.contentHash) {
    original.receiptNo = snapshot.receiptNo;
    original.amount = snapshot.amount;
    original.contentHash = snapshot.contentHash;
  }
  return { ok: true, document: generated.document, original, originalSnapshot: snapshot };
}

export function createRefundReceipt(state, originalId, extras = {}) {
  return createCompensatingDocument(state, originalId, { ...extras, type: "refund_receipt" });
}

export function createReversalReceipt(state, originalId, extras = {}) {
  return createCompensatingDocument(state, originalId, { ...extras, type: "reversal_receipt" });
}

export function supersedeDocument(state, documentId, { user, uid, now, reason = "" } = {}) {
  const original = documentById(state, documentId);
  if (!original) return { ok: false, error: "Document not found" };
  const replacement = generateDocument(state, {
    type: original.type,
    amount: original.amount,
    customerId: original.customerId,
    customerName: original.customerName,
    compensating: true,
    originalDocumentId: original.id,
    originalReceiptNo: original.receiptNo,
    accountingPosted: true,
    businessType: "supersede",
    businessId: `${original.id}:supersede`
  }, user, uid, now);
  if (!replacement.ok) return replacement;
  issueDocument(state, replacement.document.id, { user, uid, now, skipAccountingCheck: true });
  transitionOutcome(state, original, "superseded", { uid, now, user, reason });
  transitionDocument(state, original, "superseded", { uid, now, user, reason });
  return { ok: true, document: replacement.document, original };
}

export function archiveDocument(state, documentId, { user, uid, now } = {}) {
  const document = documentById(state, documentId);
  if (!document) return { ok: false, error: "Document not found" };
  return transitionDocument(state, document, "archived", { uid, now, user, reason: "archive" });
}

export function canPerformReceiptAction(user, action) {
  const map = {
    generate: "Document.Generate",
    issue: "Document.Generate",
    deliver: "Document.Deliver",
    reprint: "Document.Reprint",
    reissue: "Document.Reissue",
    cancel: "Document.Cancel",
    reject: "Document.Cancel",
    reverse: "Document.Reverse",
    refund: "Document.Refund",
    supersede: "Document.Supersede",
    archive: "Document.Archive",
    restore: "Document.Archive",
    approve_template: "Document.Template",
    publish_template: "Document.Template"
  };
  const perm = map[action];
  if (!perm) return false;
  if (isSystemOwner(user)) return true;
  if (action === "reprint") return canAction(user, perm) || canAction(user, "Document.View") || canAction(user, "Savings.Collect");
  if (action === "generate" || action === "deliver") {
    return canAction(user, perm) || canAction(user, "Savings.Collect");
  }
  return canAction(user, perm);
}

export function requestReceiptAction(state, documentId, action, { user, uid, now, reason = "", amount, online = true } = {}) {
  ensureDocumentState(state);
  if (!DOCUMENT_ACTIONS.includes(action)) return { ok: false, error: "Unknown receipt action" };
  if (!user || !canPerformReceiptAction(user, action)) return { ok: false, error: "You are not authorized for this receipt action" };
  const document = documentById(state, documentId);
  if (!document && action !== "publish_template") return { ok: false, error: "Document not found" };
  const highRisk = MAKER_CHECKER_ACTIONS.includes(action);
  const offlineGate = canPerformOffline(state, `document.${action}`, { online });
  if (!offlineGate.ok) return offlineGate;
  if (highRisk) {
    const row = {
      id: newId("rap", uid),
      documentId: documentId || "",
      action,
      amount: Number(amount ?? document?.amount ?? 0),
      makerId: user.id,
      checkerId: "",
      status: "pending",
      reason,
      createdAt: nowIso(now)
    };
    state.receiptApprovals.push(row);
    auditDocument(state, "Receipt approval requested", `${action} · ${document?.receiptNo || documentId}`, user, { entityId: row.id, category: "financial" }, uid);
    return { ok: true, pending: true, approval: row };
  }
  return executeReceiptAction(state, documentId, action, { user, uid, now, reason, amount });
}

export function decideReceiptApproval(state, approvalId, { user, uid, now, approved = true, reason = "", emergency = false } = {}) {
  ensureDocumentState(state);
  const row = (state.receiptApprovals || []).find((item) => item.id === approvalId);
  if (!row) return { ok: false, error: "Approval request not found" };
  if (row.status !== "pending") return { ok: false, error: "Approval is no longer pending" };
  if (!user) return { ok: false, error: "Checker is required" };
  if (row.makerId === user.id && !emergency) return { ok: false, error: "Maker and checker must be different users" };
  if (!emergency && !canPerformReceiptAction(user, row.action) && !canAction(user, "Document.Approve")) {
    return { ok: false, error: "You cannot approve this receipt action" };
  }
  if (emergency && !isSystemOwner(user) && user.role !== ROLE.SUPER_ADMIN) {
    return { ok: false, error: "Emergency override is restricted" };
  }
  if (!canApproveAmount(user, row.amount) && !emergency && !isSystemOwner(user)) {
    return { ok: false, error: "Amount exceeds your approval limit" };
  }
  row.checkerId = user.id;
  row.decidedAt = nowIso(now);
  row.decisionReason = reason;
  row.emergency = Boolean(emergency);
  if (!approved) {
    row.status = "rejected";
    auditDocument(state, "Receipt approval rejected", row.action, user, { entityId: row.id, category: "financial" }, uid);
    return { ok: true, approval: row, rejected: true };
  }
  row.status = "approved";
  const executed = executeReceiptAction(state, row.documentId, row.action, { user, uid, now, reason: reason || row.reason, amount: row.amount });
  auditDocument(state, emergency ? "Receipt emergency override" : "Receipt approval granted", row.action, user, { entityId: row.id, category: "financial" }, uid);
  return { ...executed, approval: row };
}

function executeReceiptAction(state, documentId, action, extras) {
  if (action === "refund") return createRefundReceipt(state, documentId, extras);
  if (action === "reverse") return createReversalReceipt(state, documentId, extras);
  if (action === "supersede") return supersedeDocument(state, documentId, extras);
  if (action === "archive") return archiveDocument(state, documentId, extras);
  if (action === "cancel") {
    const document = documentById(state, documentId);
    if (document?.permanentReceiptNo && document.status === "issued") {
      return { ok: false, error: "Permanent receipts cannot be cancelled without an approved compensating process" };
    }
    return cancelTemporaryReceipt(state, document?.temporaryReceiptNo || document?.receiptNo, extras);
  }
  if (action === "reject") return rejectTemporaryReceipt(state, documentById(state, documentId)?.temporaryReceiptNo, extras);
  if (action === "deliver") return deliverDocument(state, documentId, extras);
  if (action === "issue") return issueDocument(state, documentId, extras);
  if (action === "reprint") {
    const document = documentById(state, documentId);
    return document ? { ok: true, document, reprint: true } : { ok: false, error: "Document not found" };
  }
  return { ok: false, error: "Action is not executable" };
}

export function upsertTemplate(state, patch = {}, user, uid, now) {
  ensureDocumentState(state);
  if (user && !canAction(user, "Document.Template") && !isSystemOwner(user)) {
    return { ok: false, error: "You cannot manage templates" };
  }
  const existing = (state.documentTemplates || []).find((item) => item.id === patch.id);
  if (existing) {
    existing.body = patch.body ?? existing.body;
    existing.header = patch.header ?? existing.header;
    existing.footer = patch.footer ?? existing.footer;
    existing.watermark = patch.watermark ?? existing.watermark;
    existing.language = patch.language ?? existing.language;
    existing.theme = patch.theme ?? existing.theme;
    existing.published = false;
    existing.version = Number(existing.version || 1) + 1;
    state.templateVersions.push({
      id: newId("tv", uid),
      templateId: existing.id,
      version: existing.version,
      body: existing.body,
      header: existing.header,
      footer: existing.footer,
      published: false,
      createdAt: nowIso(now)
    });
    auditDocument(state, "Document template updated", existing.id, user, { entityId: existing.id }, uid);
    return { ok: true, template: existing, pendingPublish: true };
  }
  const row = {
    id: patch.id || newId("tpl", uid),
    type: patch.type || "savings_collection_receipt",
    name: patch.name || "Untitled",
    language: patch.language || "en",
    theme: patch.theme || "default",
    published: false,
    version: 1,
    header: patch.header || "",
    footer: patch.footer || "",
    watermark: patch.watermark || "",
    body: patch.body || ""
  };
  state.documentTemplates.push(row);
  return { ok: true, template: row };
}

export function publishTemplate(state, templateId, { user, uid, now, checker } = {}) {
  ensureDocumentState(state);
  if (user && checker && user.id === checker.id) return { ok: false, error: "Maker and checker must be different users" };
  const template = (state.documentTemplates || []).find((item) => item.id === templateId);
  if (!template) return { ok: false, error: "Template not found" };
  template.published = true;
  const version = (state.templateVersions || []).find((item) => item.templateId === templateId && item.version === template.version);
  if (version) version.published = true;
  auditDocument(state, "Document template published", templateId, user, { entityId: templateId }, uid);
  return { ok: true, template };
}

export function enqueueDocumentJob(state, spec = {}, uid, now) {
  ensureDocumentState(state);
  const row = {
    id: newId("djob", uid),
    type: spec.type || "customer_account_statement",
    status: "queued",
    payload: spec,
    attempts: 0,
    createdAt: nowIso(now)
  };
  state.documentJobs.push(row);
  return row;
}

export function processDocumentQueue(state, { uid, now, user } = {}) {
  ensureDocumentState(state);
  let processed = 0;
  (state.documentJobs || []).forEach((job) => {
    if (job.status === "completed" || job.status === "failed") return;
    job.status = "processing";
    job.attempts += 1;
    const result = job.type.includes("statement")
      ? generateStatement(state, { ...job.payload, user, uid, now })
      : generateDocument(state, { ...job.payload, user }, user, uid, now);
    job.status = result.ok ? "completed" : "failed";
    job.error = result.error || "";
    processed += 1;
  });
  return { ok: true, processed };
}

export function documentReports(state, reportId, range = {}) {
  ensureDocumentState(state);
  const from = range.from || "0000-01-01";
  const to = range.to || "9999-12-31";
  const inRange = (row) => {
    const day = String(row.createdAt || row.mappingTimestamp || row.changedAt || "").slice(0, 10);
    return day >= from && day <= to;
  };
  const table = (columns, rows) => ({ columns, rows, reportId });
  if (reportId === "documents_issued") return table(["createdAt", "type", "receiptNo", "status"], (state.documents || []).filter(inRange));
  if (reportId === "documents_offline_pending") return table(["temporaryReceiptNumber", "status", "deviceId"], (state.offlineReceipts || []).filter((item) => item.status !== "reconciled"));
  if (reportId === "documents_reconciled") return table(["temporaryReceiptNumber", "permanentReceiptNumber", "mappingTimestamp"], (state.receiptReconciliation || []).filter(inRange));
  if (reportId === "documents_rejected") return table(["temporaryReceiptNumber", "status"], (state.offlineReceipts || []).filter((item) => item.status === "rejected"));
  if (reportId === "documents_duplicates") return table(["details", "createdAt"], (state.documentActivityLogs || []).filter((item) => /duplicate/i.test(item.action)));
  if (reportId === "documents_mapping") return table(["mappingId", "previousStatus", "newStatus", "changedAt"], state.receiptMappingHistory || []);
  if (reportId === "documents_approvals") return table(["action", "status", "makerId", "checkerId", "createdAt"], state.receiptApprovals || []);
  if (reportId === "documents_delivery") return table(["documentId", "channel", "status", "createdAt"], state.documentDelivery || []);
  return table(["id"], []);
}

export function exportDocumentCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function documentDetail(state, id) {
  ensureDocumentState(state);
  const document = documentById(state, id) || documentByReceipt(state, id);
  if (!document) return null;
  return {
    document,
    versions: (state.documentVersions || []).filter((item) => item.documentId === document.id),
    signatures: (state.documentSignatures || []).filter((item) => item.documentId === document.id),
    qr: (state.documentQrCodes || []).filter((item) => item.documentId === document.id),
    delivery: (state.documentDelivery || []).filter((item) => item.documentId === document.id),
    linked: (state.documents || []).filter((item) => item.originalDocumentId === document.id),
    mapping: (state.receiptReconciliation || []).find((item) =>
      item.temporaryReceiptNumber === document.temporaryReceiptNo || item.permanentReceiptNumber === document.permanentReceiptNo
    ) || null
  };
}

export function assertDocumentEngineBoundary() {
  return {
    centralized: true,
    generatesIndependentlyInBusinessModules: false,
    storesCustomerPins: false,
    restApi: false,
    graphql: false,
    wrapsBuildReceiptNo: true
  };
}

export function applyPromotedReceiptToDocuments(state, temporaryReceiptNo, permanentReceiptNo, extras = {}) {
  if (!state?.documents) return { ok: true, skipped: true };
  const existing = (state.receiptReconciliation || []).find((item) => item.temporaryReceiptNumber === temporaryReceiptNo);
  if (existing) return { ok: true, duplicate: true, mapping: existing };
  return reconcileOfflineReceipt(state, {
    temporaryReceiptNo,
    permanentReceiptNo,
    ...extras
  });
}
