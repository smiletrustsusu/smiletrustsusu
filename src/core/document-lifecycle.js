/**
 * Module 17 document lifecycle, receipt outcomes, and temporary-receipt states.
 * Receipts are documents, not the financial transaction.
 */

export const DOCUMENT_SCHEMA_LIFECYCLE = "1.0.0";

export const DOCUMENT_STATES = [
  "draft",
  "generated",
  "approved",
  "issued",
  "delivered",
  "archived",
  "superseded",
  "cancelled"
];

export const TERMINAL_DOCUMENT_STATES = ["archived", "superseded", "cancelled"];

export const DOCUMENT_TRANSITION_MATRIX = {
  draft: ["generated", "cancelled"],
  generated: ["approved", "issued", "cancelled"],
  approved: ["issued", "cancelled"],
  issued: ["delivered", "archived", "superseded", "cancelled"],
  delivered: ["archived", "superseded"],
  archived: [],
  superseded: [],
  cancelled: []
};

export const RECEIPT_OUTCOMES = [
  "valid",
  "rejected",
  "cancelled",
  "partially_reversed",
  "fully_reversed",
  "partially_refunded",
  "fully_refunded",
  "superseded"
];

export const RECEIPT_OUTCOME_MATRIX = {
  valid: ["partially_refunded", "fully_refunded", "partially_reversed", "fully_reversed", "superseded", "rejected", "cancelled"],
  partially_refunded: ["fully_refunded"],
  partially_reversed: ["fully_reversed"],
  rejected: [],
  cancelled: [],
  fully_refunded: [],
  fully_reversed: [],
  superseded: []
};

export const TEMP_RECEIPT_STATES = [
  "created",
  "pending_synchronization",
  "synchronizing",
  "reconciled",
  "rejected",
  "cancelled"
];

export const TEMP_RECEIPT_MATRIX = {
  created: ["pending_synchronization", "cancelled", "rejected"],
  pending_synchronization: ["synchronizing", "reconciled", "rejected", "cancelled"],
  synchronizing: ["reconciled", "pending_synchronization", "rejected"],
  reconciled: [],
  rejected: [],
  cancelled: []
};

export function canonicalDocumentStatus(status) {
  return String(status || "draft");
}

export function canTransitionDocument(from, to) {
  return (DOCUMENT_TRANSITION_MATRIX[canonicalDocumentStatus(from)] || []).includes(canonicalDocumentStatus(to));
}

export function canTransitionOutcome(from, to) {
  return (RECEIPT_OUTCOME_MATRIX[from] || []).includes(to);
}

export function canTransitionTempReceipt(from, to) {
  return (TEMP_RECEIPT_MATRIX[from] || []).includes(to);
}

export function isTerminalDocumentStatus(status) {
  return TERMINAL_DOCUMENT_STATES.includes(canonicalDocumentStatus(status));
}

export function isSignedImmutable(document) {
  return Boolean(document?.signed && document?.signatureHash);
}

export function ensureDocumentLifecycleState(state = {}) {
  state.documentStatusHistory = state.documentStatusHistory || [];
  state.receiptOutcomeHistory = state.receiptOutcomeHistory || [];
  state.receiptMappingHistory = state.receiptMappingHistory || [];
  return state;
}

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function transitionDocument(state, document, nextStatus, { uid, now, user, reason = "", actor = "Document Engine" } = {}) {
  if (!document) return { ok: false, error: "Document not found" };
  ensureDocumentLifecycleState(state);
  const from = canonicalDocumentStatus(document.status);
  const to = canonicalDocumentStatus(nextStatus);
  if (from === to) return { ok: true, document, noop: true };
  if (isSignedImmutable(document) && !["delivered", "archived"].includes(to)) {
    return { ok: false, error: "Signed documents are immutable" };
  }
  if (!canTransitionDocument(from, to)) {
    return { ok: false, error: `Invalid document transition: ${from} → ${to}` };
  }
  const timestamp = nowIso(now);
  document.status = to;
  document.version = Number(document.version || 1) + 1;
  document.updatedAt = timestamp;
  const history = {
    id: newId("dsh", uid),
    documentId: document.id,
    previousState: from,
    newState: to,
    timestamp,
    actor,
    userId: user?.id || "",
    reason
  };
  document.statusHistory = [...(document.statusHistory || []), { previousState: from, newState: to, timestamp, reason }];
  state.documentStatusHistory.push(history);
  return { ok: true, document, from, to, history };
}

export function transitionOutcome(state, document, nextOutcome, { uid, now, user, reason = "" } = {}) {
  if (!document) return { ok: false, error: "Document not found" };
  ensureDocumentLifecycleState(state);
  const from = document.outcome || "valid";
  const to = nextOutcome;
  if (from === to) return { ok: true, document, noop: true };
  if (!canTransitionOutcome(from, to)) {
    return { ok: false, error: `Invalid receipt outcome: ${from} → ${to}` };
  }
  const timestamp = nowIso(now);
  document.outcome = to;
  document.updatedAt = timestamp;
  const history = {
    id: newId("roh", uid),
    documentId: document.id,
    receiptNo: document.receiptNo || document.permanentReceiptNo || document.temporaryReceiptNo,
    previousOutcome: from,
    newOutcome: to,
    timestamp,
    userId: user?.id || "",
    reason
  };
  state.receiptOutcomeHistory.push(history);
  return { ok: true, document, from, to, history };
}

export function transitionTempReceipt(row, nextStatus, now) {
  const from = row.status || "created";
  const to = nextStatus;
  if (from === to) return { ok: true, row, noop: true };
  if (!canTransitionTempReceipt(from, to)) {
    return { ok: false, error: `Invalid temporary receipt transition: ${from} → ${to}` };
  }
  row.status = to;
  row.updatedAt = nowIso(now);
  return { ok: true, row };
}
