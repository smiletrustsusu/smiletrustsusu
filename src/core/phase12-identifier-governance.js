/**
 * Phase 12 — Identifier governance, format validators, accountable authority,
 * and segregation-of-duties helpers for EAIADIS / AI Capability Registry.
 */

import {
  AI_CAPABILITY_ID_PATTERN,
  AI_CAPABILITY_CODE_PATTERN
} from "./canonical-ai-registry.js";

export const P12_IDENTIFIER_GOVERNANCE_VERSION = "1.0.0";

export const ID_FORMATS = Object.freeze({
  capabilityId: { pattern: AI_CAPABILITY_ID_PATTERN, example: "AI-CAP-001", owner: "Module29" },
  capabilityCode: { pattern: AI_CAPABILITY_CODE_PATTERN, example: "LOAN_DEFAULT_PREDICTION", owner: "Module29" },
  governanceId: { pattern: /^AI-GOV-[0-9]{3}$/, example: "AI-GOV-001", owner: "Module29" },
  auditId: { pattern: /^AI-AUD-[0-9]{3}$/, example: "AI-AUD-001", owner: "Module29" },
  envelopeId: { pattern: /^ENV-[0-9]{3}$/, example: "ENV-012", owner: "Architecture" },
  authorityId: { pattern: /^AUTH-[A-Z]{2,8}-[0-9]{3}$/, example: "AUTH-RISK-001", owner: "Governance" },
  correlationId: { pattern: /^CORR-[A-Z0-9-]{3,64}$/, example: "CORR-EAIADIS-P12-001", owner: "Workflow" },
  semver: { pattern: /^\d+\.\d+\.\d+$/, example: "1.0.0", owner: "Shared" }
});

/**
 * Identifier ownership matrix — who may mint each format.
 * Module 24 does not mint AI capability ids; Module 30 does not own AI-CAP-* .
 */
export const IDENTIFIER_OWNERSHIP_MATRIX = Object.freeze([
  Object.freeze({
    kind: "AI Capability ID",
    format: "AI-CAP-NNN",
    mintingOwner: "Module 29 — Enterprise AI",
    accountableAuthorityRole: "Risk Manager",
    mayNotMint: Object.freeze(["Module 24", "Module 30", "Module 8"]),
    notes: "Loan module 8 consumes predictions; does not mint capability ids."
  }),
  Object.freeze({
    kind: "AI Capability Code",
    format: "UPPER_SNAKE",
    mintingOwner: "Module 29 — Enterprise AI",
    accountableAuthorityRole: "AI Platform Admin",
    mayNotMint: Object.freeze(["Module 24", "Module 30"]),
    notes: "Codes are stable; renames require change control."
  }),
  Object.freeze({
    kind: "Governance ID",
    format: "AI-GOV-NNN",
    mintingOwner: "Module 29 — AI Governance",
    accountableAuthorityRole: "Chief Data Steward",
    mayNotMint: Object.freeze(["ML Engineer", "Collector"]),
    notes: "Bound 1:1 or 1:N to capability under change control."
  }),
  Object.freeze({
    kind: "Audit ID",
    format: "AI-AUD-NNN",
    mintingOwner: "Internal Audit / Module 22 coordination",
    accountableAuthorityRole: "Internal Auditor",
    mayNotMint: Object.freeze(["Model Validator", "ML Engineer", "MLOps"]),
    notes: "Auditor must not be the same party as approvingAuthority."
  }),
  Object.freeze({
    kind: "Document Envelope ID",
    format: "ENV-NNN",
    mintingOwner: "Architecture / EAIADIS stewards",
    accountableAuthorityRole: "Architecture Review Board",
    mayNotMint: Object.freeze(["Collector", "Branch Manager"]),
    notes: "Envelope wraps Phase 12 prose + schema artifacts."
  }),
  Object.freeze({
    kind: "Authority Slot ID",
    format: "AUTH-ROLE-NNN",
    mintingOwner: "Governance",
    accountableAuthorityRole: "SystemOwner",
    mayNotMint: Object.freeze(["AI runtime", "Rule Engine"]),
    notes: "Optional machine id for authority slots; people/roles remain primary."
  })
]);

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

export function validateIdentifierFormat(kind, value) {
  const spec = ID_FORMATS[kind];
  if (!spec) return err("P12-ID-001", `Unknown identifier kind: ${kind}`);
  const text = String(value ?? "");
  if (!spec.pattern.test(text)) {
    return err("P12-ID-002", `Invalid ${kind}: expected pattern like ${spec.example}`, {
      kind,
      value: text,
      owner: spec.owner
    });
  }
  return ok({ kind, value: text, owner: spec.owner });
}

export function validateAllCapabilityIdentifiers(entry = {}) {
  const checks = [
    validateIdentifierFormat("capabilityId", entry.id),
    validateIdentifierFormat("capabilityCode", entry.code),
    entry.governance?.governanceId
      ? validateIdentifierFormat("governanceId", entry.governance.governanceId)
      : ok(),
    entry.audit?.auditId ? validateIdentifierFormat("auditId", entry.audit.auditId) : ok()
  ];
  const failed = checks.find((c) => c && c.ok === false);
  if (failed) return failed;
  return ok();
}

/**
 * Generation rules — sequential within namespace; no reuse after retire.
 */
export const IDENTIFIER_GENERATION_RULES = Object.freeze({
  capabilityId: Object.freeze({
    namespace: "AI-CAP",
    width: 3,
    startAt: 1,
    reuseAfterRetire: false,
    allocator: "canonical-ai-registry",
    description: "Allocate next free AI-CAP-NNN; never reuse a retired id."
  }),
  governanceId: Object.freeze({
    namespace: "AI-GOV",
    width: 3,
    startAt: 1,
    reuseAfterRetire: false,
    allocator: "ai-governance",
    description: "Allocate next AI-GOV-NNN under Module 29 governance."
  }),
  auditId: Object.freeze({
    namespace: "AI-AUD",
    width: 3,
    startAt: 1,
    reuseAfterRetire: false,
    allocator: "ai-audit",
    description: "Allocate next AI-AUD-NNN; auditor-owned namespace."
  }),
  envelopeId: Object.freeze({
    namespace: "ENV",
    width: 3,
    startAt: 1,
    reuseAfterRetire: false,
    allocator: "phase12-document-envelope",
    description: "Allocate next ENV-NNN for EAIADIS envelopes."
  })
});

export function nextSequentialId(namespace, existingIds = [], width = 3) {
  const re = new RegExp(`^${namespace}-([0-9]{${width}})$`);
  let max = 0;
  for (const id of existingIds) {
    const m = String(id).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const next = String(max + 1).padStart(width, "0");
  return `${namespace}-${next}`;
}

export function assertMintingAllowed(kind, actorModule) {
  const row = IDENTIFIER_OWNERSHIP_MATRIX.find((r) => {
    if (kind === "capabilityId") return r.kind === "AI Capability ID";
    if (kind === "capabilityCode") return r.kind === "AI Capability Code";
    if (kind === "governanceId") return r.kind === "Governance ID";
    if (kind === "auditId") return r.kind === "Audit ID";
    if (kind === "envelopeId") return r.kind === "Document Envelope ID";
    if (kind === "authorityId") return r.kind === "Authority Slot ID";
    return false;
  });
  if (!row) return err("P12-ID-010", `No ownership row for kind ${kind}`);
  const actor = String(actorModule || "");
  if (row.mayNotMint.some((blocked) => actor.includes(blocked.replace("Module ", "")) || actor === blocked)) {
    return err("P12-ID-011", `Actor ${actor} may not mint ${kind}`, { mintingOwner: row.mintingOwner });
  }
  return ok({ mintingOwner: row.mintingOwner });
}

/**
 * Exactly one accountableAuthority — string field, non-empty, no arrays/multi-values.
 */
export function assertSingleAccountableAuthority(target = {}) {
  const root = target.accountableAuthority;
  const gov = target.governance?.accountableAuthority;
  if (Array.isArray(root) || Array.isArray(gov)) {
    return err("P12-AUTH-001", "accountableAuthority must not be an array");
  }
  if (root == null || String(root).trim() === "") {
    return err("P12-AUTH-002", "accountableAuthority is required");
  }
  if (String(root).includes(",") || String(root).includes(";")) {
    return err("P12-AUTH-003", "accountableAuthority must be exactly one party (no lists)");
  }
  if (gov != null && String(gov).trim() !== String(root).trim()) {
    return err("P12-AUTH-004", "Root accountableAuthority must equal governance.accountableAuthority", {
      root,
      governance: gov
    });
  }
  return ok({ accountableAuthority: String(root).trim() });
}

/**
 * Authority (A) vs Responsibility (R) — SoD clarification helpers.
 */
export function clarifyAuthorityVsResponsibility({
  accountableAuthority,
  responsibleParty,
  approvingAuthority,
  auditor
} = {}) {
  return Object.freeze({
    accountableAuthority: accountableAuthority || null,
    responsibleParty: responsibleParty || null,
    approvingAuthority: approvingAuthority || null,
    auditor: auditor || null,
    rules: Object.freeze([
      "Accountable (A) owns outcome and may not be duplicated.",
      "Responsible (R) does the work; may differ from A.",
      "Approving authority decides go-live / use approval.",
      "Auditor independently reviews; must differ from approver.",
      "AI remains advisory; A/R never authorize automatic money posts."
    ])
  });
}

export function assertSegregationOfDuties({
  approvingAuthority,
  auditor,
  responsibleParty,
  accountableAuthority,
  developer,
  validator
} = {}) {
  const errors = [];
  if (approvingAuthority && auditor && approvingAuthority === auditor) {
    errors.push({ code: "P12-SOD-001", message: "approvingAuthority must not equal auditor" });
  }
  if (developer && validator && developer === validator) {
    errors.push({ code: "P12-SOD-002", message: "developer must not equal validator" });
  }
  if (responsibleParty && auditor && responsibleParty === auditor) {
    errors.push({ code: "P12-SOD-003", message: "responsibleParty should not equal auditor" });
  }
  if (accountableAuthority && auditor && accountableAuthority === auditor) {
    // Allowed in some orgs for Risk Manager ≠ Internal Auditor typically enforced:
    // keep soft? User asked SoD approve≠audit specifically. Keep accountable≠auditor as warning-level hard fail for AI caps.
    errors.push({ code: "P12-SOD-004", message: "accountableAuthority must not equal auditor for AI capabilities" });
  }
  if (errors.length) {
    return err("P12-SOD-000", "Segregation of duties violation", { errors });
  }
  return ok();
}

export function assertGovernanceConditionals(governance = {}) {
  const errors = [];
  if (!governance || typeof governance !== "object") {
    return err("P12-GOV-001", "governance must be an object");
  }
  const needsException =
    governance.exceptionRequired === true || governance.riskClass === "Critical";
  if (needsException) {
    if (!governance.exceptionApprovalAuthority || !String(governance.exceptionApprovalAuthority).trim()) {
      errors.push({
        path: "exceptionApprovalAuthority",
        message: "exceptionApprovalAuthority required when exceptionRequired or riskClass Critical"
      });
    }
  }
  if (governance.humanOversightRequired !== true) {
    errors.push({ path: "humanOversightRequired", message: "must be true" });
  }
  if (governance.sodProfile) {
    if (governance.sodProfile.approverMustDifferFromAuditor !== true) {
      errors.push({ path: "sodProfile.approverMustDifferFromAuditor", message: "must be true" });
    }
    if (governance.sodProfile.developerMustDifferFromValidator !== true) {
      errors.push({ path: "sodProfile.developerMustDifferFromValidator", message: "must be true" });
    }
  }
  if (errors.length) return err("P12-GOV-002", "Governance conditional validation failed", { errors });
  return ok();
}

export function assertAuditBlock(audit = {}, approvingAuthority) {
  const errors = [];
  if (!audit || typeof audit !== "object") {
    return err("P12-AUD-001", "audit must be an object");
  }
  if (audit.auditTrailRequired !== true) {
    errors.push({ path: "auditTrailRequired", message: "must be true" });
  }
  if (!audit.auditor) {
    errors.push({ path: "auditor", message: "required" });
  }
  if (approvingAuthority && audit.auditor && approvingAuthority === audit.auditor) {
    errors.push({ path: "auditor", message: "auditor must differ from approvingAuthority" });
  }
  if (typeof audit.retentionDays === "number" && audit.retentionDays < 365) {
    errors.push({ path: "retentionDays", message: "minimum 365" });
  }
  if (errors.length) return err("P12-AUD-002", "Audit validation failed", { errors });
  return ok();
}

export function validateCapabilityGovernanceBundle(entry = {}) {
  const idCheck = validateAllCapabilityIdentifiers(entry);
  if (!idCheck.ok) return idCheck;
  const auth = assertSingleAccountableAuthority(entry);
  if (!auth.ok) return auth;
  const gov = assertGovernanceConditionals(entry.governance || {});
  if (!gov.ok) return gov;
  const aud = assertAuditBlock(entry.audit || {}, entry.governance?.approvingAuthority);
  if (!aud.ok) return aud;
  const sod = assertSegregationOfDuties({
    approvingAuthority: entry.governance?.approvingAuthority,
    auditor: entry.audit?.auditor,
    responsibleParty: entry.governance?.responsibleParty,
    accountableAuthority: entry.accountableAuthority,
    developer: entry.technicalOwner,
    validator: entry.governance?.approvingAuthority === "Model Validator" ? "Model Validator" : entry.governance?.approvingAuthority
  });
  // developer vs validator: technicalOwner (ML Engineer) vs approvingAuthority (Model Validator) — should differ
  if (entry.technicalOwner && entry.governance?.approvingAuthority && entry.technicalOwner === entry.governance.approvingAuthority) {
    return err("P12-SOD-002", "developer/technicalOwner must not equal approvingAuthority/validator");
  }
  if (!sod.ok) return sod;
  return ok({ accountableAuthority: auth.accountableAuthority });
}

export function listOwnershipMatrix() {
  return IDENTIFIER_OWNERSHIP_MATRIX.map((row) => ({ ...row, mayNotMint: [...row.mayNotMint] }));
}
