/**
 * Phase 12 — EAIADIS document envelope helpers.
 * Thin integration surface for schema examples and section tracking.
 * Does not add navigation or change money/RBAC paths.
 */

export const P12_ENVELOPE_VERSION = "1.0.0";

export const P12_SECTIONS = Object.freeze([
  Object.freeze({ ordinal: 1, code: "P12-CAPABILITY_REGISTRY", title: "AI Capability Registry Specification" }),
  Object.freeze({ ordinal: 2, code: "P12-CAPABILITY_EXAMPLE", title: "Complete AI Capability Registry JSON Example" }),
  Object.freeze({ ordinal: 3, code: "P12-CAPABILITY_SCHEMA", title: "Matching JSON Schema" }),
  Object.freeze({ ordinal: 4, code: "P12-GOVERNANCE_FIELDS", title: "Governance & Audit Field Definitions" }),
  Object.freeze({ ordinal: 5, code: "P12-GOVERNANCE_SCHEMAS", title: "Governance & Audit JSON Schemas" }),
  Object.freeze({ ordinal: 6, code: "P12-IDENTIFIER_FORMATS", title: "Identifier & Format Handling" }),
  Object.freeze({ ordinal: 7, code: "P12-IDENTIFIER_GENERATION", title: "Identifier Generation Rules" }),
  Object.freeze({ ordinal: 8, code: "P12-IDENTIFIER_OWNERSHIP", title: "Identifier Ownership Boundaries" }),
  Object.freeze({ ordinal: 9, code: "P12-AUTHORITY_RESPONSIBILITY", title: "Authority vs Responsibility Clarification" }),
  Object.freeze({ ordinal: 10, code: "P12-ACCOUNTABLE_AUTHORITY", title: "Accountable Authority Consistency" })
]);

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

export function createPhase12Envelope(input = {}) {
  const primaryOwner = String(input.primaryOwner || "").trim();
  const accountableAuthority = String(input.accountableAuthority || "").trim();
  const approver = String(input.approver || "").trim();
  const auditor = String(input.auditor || "").trim();
  if (!primaryOwner || !accountableAuthority) {
    return err("P12-ENV-001", "primaryOwner and accountableAuthority are required");
  }
  if (approver && auditor && approver === auditor) {
    return err("P12-ENV-010", "SoD violation: approver must not equal auditor");
  }
  if (accountableAuthority.includes(",") || accountableAuthority.includes(";")) {
    return err("P12-ENV-011", "accountableAuthority must be exactly one party");
  }
  const envelope = {
    envelopeId: input.envelopeId || "ENV-012",
    documentType: input.documentType || "EAIADIS",
    title: input.title || "Enterprise AI Automation Decision & Identifier Specification",
    version: input.version || P12_ENVELOPE_VERSION,
    status: input.status || "Draft",
    accountableAuthority,
    primaryOwner,
    approver: approver || null,
    auditor: auditor || null,
    sections: P12_SECTIONS.map((s) => ({
      sectionCode: s.code,
      sectionTitle: s.title,
      ordinal: s.ordinal,
      complete: false
    })),
    auditLog: []
  };
  envelope.auditLog.push({
    at: input.at || new Date().toISOString(),
    action: "CREATED",
    actor: input.actor || primaryOwner
  });
  return ok({ envelope });
}

export function markSectionComplete(envelope, sectionCode, meta = {}) {
  const section = envelope.sections.find((s) => s.sectionCode === sectionCode);
  if (!section) return err("P12-ENV-020", `Unknown section ${sectionCode}`);
  section.complete = true;
  envelope.auditLog.push({
    at: meta.at || new Date().toISOString(),
    action: "SECTION_COMPLETED",
    actor: meta.actor || "system",
    detail: { sectionCode }
  });
  return ok({ envelope, section });
}

export function allSectionsComplete(envelope) {
  return (envelope.sections || []).every((s) => s.complete === true);
}

export function listPhase12Sections() {
  return P12_SECTIONS.map((s) => ({ ...s }));
}
