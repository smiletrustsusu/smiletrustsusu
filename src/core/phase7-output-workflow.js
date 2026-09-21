/**
 * Phase 7 — ECDAPS output governance workflow.
 * Enforces section sequencing 1-20 (cannot skip), section completion criteria,
 * immutable audit log. Error codes: P7W-xxx.
 * Does not change money math / RBAC / posting / business nav.
 */

export const P7_WORKFLOW_VERSION = "1.0.0";

/** Mandatory ECDAPS primary document sections in order. */
export const P7_SECTIONS = Object.freeze([
  Object.freeze({ id: 1, code: "DOCUMENT_CONTROL", name: "Document Control" }),
  Object.freeze({ id: 2, code: "PURPOSE_SCOPE", name: "Purpose & Scope" }),
  Object.freeze({ id: 3, code: "INPUT_DEPENDENCY_RULES", name: "Input & Dependency Rules" }),
  Object.freeze({ id: 4, code: "DESIGN_PRINCIPLES", name: "Design Principles" }),
  Object.freeze({ id: 5, code: "PERSISTENCE_ARCHITECTURE_OVERVIEW", name: "Persistence Architecture Overview" }),
  Object.freeze({ id: 6, code: "LOGICAL_DATA_MODEL_MAPPING", name: "Logical Data Model Mapping" }),
  Object.freeze({ id: 7, code: "PHYSICAL_SCHEMA_CATALOG", name: "Physical Schema Catalog" }),
  Object.freeze({ id: 8, code: "TABLE_OWNERSHIP_MODULE_MAPPING", name: "Table Ownership & Module Mapping" }),
  Object.freeze({ id: 9, code: "RELATIONSHIPS_FOREIGN_KEYS", name: "Relationships & Foreign Keys" }),
  Object.freeze({ id: 10, code: "CONSTRAINTS_INTEGRITY_RULES", name: "Constraints & Integrity Rules" }),
  Object.freeze({ id: 11, code: "INDEXES_ACCESS_PATHS", name: "Indexes & Access Paths" }),
  Object.freeze({ id: 12, code: "PARTITIONING_STRATEGY", name: "Partitioning Strategy" }),
  Object.freeze({ id: 13, code: "MIGRATION_CATALOG_ORDERING", name: "Migration Catalog & Ordering" }),
  Object.freeze({ id: 14, code: "RETENTION_ARCHIVAL_SOFT_DELETE", name: "Retention, Archival & Soft-Delete" }),
  Object.freeze({ id: 15, code: "BACKUP_RECOVERY_DR", name: "Backup, Recovery & DR Alignment" }),
  Object.freeze({ id: 16, code: "SECURITY_CLASSIFICATION_ACCESS", name: "Security, Classification & Access" }),
  Object.freeze({ id: 17, code: "CONSISTENCY_APIS_EVENTS_SMS", name: "Consistency with APIs / Events / State Machines" }),
  Object.freeze({ id: 18, code: "NON_GOALS_PROHIBITED", name: "Non-Goals & Prohibited Activities" }),
  Object.freeze({ id: 19, code: "GOVERNANCE_VERSIONING_CHANGE", name: "Governance, Versioning & Change Control" }),
  Object.freeze({ id: 20, code: "APPENDICES", name: "Appendices" })
]);

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

export function createPhase7Deliverable(input = {}) {
  const primaryOwner = String(input.primaryOwner || "").trim();
  const accountableApprover = String(input.accountableApprover || "").trim();
  if (!primaryOwner || !accountableApprover) {
    return err("P7W-001", "primaryOwner and accountableApprover are required");
  }
  if (primaryOwner === accountableApprover) {
    return err("P7W-010", "SoD violation: Primary Owner must not equal Accountable Approver");
  }
  const deliverable = {
    id: input.id || `P7-DEL-${Date.now()}`,
    title: input.title || "ECDAPS Deliverable",
    currentSection: 0,
    sectionCompletion: Object.fromEntries(P7_SECTIONS.map((s) => [s.id, false])),
    primaryOwner,
    accountableApprover,
    auditLog: []
  };
  appendAudit(deliverable, "CREATED", { actor: input.actor || primaryOwner });
  return ok({ deliverable });
}

export function appendAudit(deliverable, action, meta = {}) {
  const entry = Object.freeze({
    at: meta.at || new Date().toISOString(),
    action,
    actor: meta.actor || "system",
    detail: meta.detail || null
  });
  deliverable.auditLog.push(entry);
  return entry;
}

export function getAuditLog(deliverable) {
  return Object.freeze([...(deliverable.auditLog || [])]);
}

export function completeSection(deliverable, sectionId, meta = {}) {
  const section = P7_SECTIONS.find((s) => s.id === Number(sectionId));
  if (!section) return err("P7W-060", `Unknown section: ${sectionId}`);
  const id = section.id;
  const nextIncomplete = P7_SECTIONS.find((s) => !deliverable.sectionCompletion[s.id]);
  if (!nextIncomplete || nextIncomplete.id !== id) {
    return err("P7W-062", `Section sequencing violation: next required section is ${nextIncomplete ? nextIncomplete.id : "none"}`, {
      attempted: id,
      next: nextIncomplete ? nextIncomplete.id : null,
      blockedBy: nextIncomplete ? nextIncomplete.id : null
    });
  }
  if (!meta.criteriaMet) {
    return err("P7W-063", `Section ${id} completion criteria not met`, { section: section.code });
  }
  deliverable.sectionCompletion[id] = true;
  deliverable.currentSection = id;
  appendAudit(deliverable, "SECTION_COMPLETED", { actor: meta.actor, detail: { sectionId: id, code: section.code } });
  return ok({ deliverable, section });
}

export function allSectionsComplete(deliverable) {
  return P7_SECTIONS.every((s) => deliverable.sectionCompletion[s.id] === true);
}

export function listSections() {
  return [...P7_SECTIONS];
}

export function assertSectionOrder(headings) {
  const expected = P7_SECTIONS.map((s) => s.name);
  const normalized = (headings || []).map((h) => String(h).replace(/^\d+\.\s*/, "").trim());
  for (let i = 0; i < expected.length; i++) {
    if (!normalized[i] || !normalized[i].includes(expected[i].split(" ")[0])) {
      // soft: require exact name match when present
    }
    if (normalized[i] !== expected[i] && !String(normalized[i]).endsWith(expected[i]) && normalized[i] !== expected[i]) {
      if (normalized[i] !== expected[i]) {
        return err("P7W-070", `Section order mismatch at index ${i + 1}`, { expected: expected[i], actual: normalized[i] });
      }
    }
  }
  if (normalized.length < 20) return err("P7W-071", "Fewer than 20 sections", { count: normalized.length });
  for (let i = 0; i < 20; i++) {
    if (normalized[i] !== expected[i]) {
      return err("P7W-070", `Section order mismatch at index ${i + 1}`, { expected: expected[i], actual: normalized[i] });
    }
  }
  return ok({ sections: expected });
}


/** Alias for tests / callers expecting createDeliverable naming. */
export function createDeliverable(input = {}) {
  return createPhase7Deliverable(input);
}
