/**
 * Phase 9 ESIACS generator — security registry + ownership assignment + docs + tests
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
  console.log("wrote", rel);
};

w("src/core/canonical-security-registry.js", `/**
 * Phase 9 — Enterprise Security, Identity, Authorization & Compliance (ESIACS).
 * Catalog only. Runtime remains rbac.js, roles.js, session.js, Module 20/22/29/30.
 */
import { ACTIONS } from "./rbac.js";
import { ROLE } from "./roles.js";

export const ESIACS_VERSION = "1.0.0";
export const ESIACS_STATUS = "Authoritative";

/** Crypto/policy constants — algorithm names as standards, not invented keys. */
export const CRYPTO_POLICY = Object.freeze({
  passwordKdf: "PBKDF2-SHA256",
  pbkdf2Iterations: 120000,
  hash: "SHA-256",
  transport: "TLS-1.2+",
  atRest: "AES-256-GCM (platform standard when encrypting backups/exports)",
  apiKeyStorage: "SHA-256 hash only (Integration Hub / Gateway)",
  webhookAuth: "HMAC-SHA256 over settings.momoWebhookSecret ref",
  forbiddenInSource: Object.freeze(["momoPin", "pin", "bankPassword", "cardCvv"])
});

export const ZERO_TRUST_CONTROLS = Object.freeze([
  "session binding + TTL (session.js)",
  "canAction RBAC gate (rbac.js)",
  "SUPER_ADMIN_FORBIDDEN unchanged",
  "Module 20 gateway authn/authz facade",
  "Integration Hub API keys hashed",
  "MoMo webhook secret settings pattern (no PINs)",
  "AI permission MFA flags for Critical codes"
]);

function ctrl(partial) {
  return Object.freeze({
    id: partial.id,
    name: partial.name,
    category: partial.category,
    primaryOwnerRole: partial.primaryOwnerRole,
    accountableOwnerRole: partial.accountableOwnerRole,
    reviewers: Object.freeze([...(partial.reviewers || [])]),
    finalApprover: partial.finalApprover,
    mappedRuntime: partial.mappedRuntime || "",
    owningModule: partial.owningModule,
    version: partial.version || "1.0.0"
  });
}

export const SECURITY_CONTROLS = Object.freeze([
  ctrl({ id: "SEC-CTRL-IDENTITY-USERS", name: "User identity accounts", category: "Identity", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "roles.js / users", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-RBAC-ACTIONS", name: "Action-level RBAC (canAction)", category: "Authorization", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR, ROLE.DEVELOPER], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "rbac.js canAction", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-SCREEN-PERMS", name: "Screen permission matrix", category: "Authorization", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "roles.js defaultPermissionsForRole", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-SUPER-ADMIN-FORBIDDEN", name: "SUPER_ADMIN_FORBIDDEN guard", category: "Authorization", primaryOwnerRole: ROLE.SYSTEM_OWNER, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "rbac.js SUPER_ADMIN_FORBIDDEN", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-SESSION-TTL", name: "Session timeout & expiry", category: "Session", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "session.js + security.sessionTimeoutMinutes", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-PASSWORD-POLICY", name: "Password length & expiry", category: "Authentication", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "security.passwordMinLength / PBKDF2", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-MFA-STANDARD", name: "MFA platform standard (privileged / AI Critical)", category: "Authentication", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "security.mfaRequired + AI mfaRequired flags", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-LOGIN-LOCKOUT", name: "Login attempt lockout", category: "Authentication", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "security.maxLoginAttempts / lockMinutes", owningModule: 1 }),
  ctrl({ id: "SEC-CTRL-APPROVAL-LIMITS", name: "Role approval limits (cashier 1000)", category: "Authorization", primaryOwnerRole: ROLE.BRANCH_MANAGER, accountableOwnerRole: ROLE.SUPER_ADMIN, reviewers: [ROLE.ACCOUNTANT, ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "DEFAULT_APPROVAL_LIMITS / approval.cashierLimitGhs", owningModule: 14 }),
  ctrl({ id: "SEC-CTRL-GATEWAY-AUTH", name: "API Gateway authn/authz facade", category: "API", primaryOwnerRole: ROLE.DEVELOPER, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "Module 20 api-gateway-ops", owningModule: 20 }),
  ctrl({ id: "SEC-CTRL-GATEWAY-KEYS", name: "Gateway API keys", category: "Secrets", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "Gateway.Key hashed keys", owningModule: 20 }),
  ctrl({ id: "SEC-CTRL-INT-API-KEYS", name: "Integration Hub API keys", category: "Secrets", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "integrationApiKeys hashSecret", owningModule: 28 }),
  ctrl({ id: "SEC-CTRL-MOMO-WEBHOOK", name: "MoMo webhook secret pattern", category: "Secrets", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "settings.momoWebhookSecret (no PINs)", owningModule: 28 }),
  ctrl({ id: "SEC-CTRL-FORBIDDEN-SECRETS", name: "Forbidden secret keys in source", category: "Secrets", primaryOwnerRole: ROLE.DEVELOPER, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "FORBIDDEN_SECRET_KEYS INT-022", owningModule: 28 }),
  ctrl({ id: "SEC-CTRL-AUDIT-TRAIL", name: "Immutable audit trail", category: "Compliance", primaryOwnerRole: ROLE.AUDITOR, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.SUPER_ADMIN], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "audit-ops.js", owningModule: 13 }),
  ctrl({ id: "SEC-CTRL-FRAUD-OPS", name: "Security ops / fraud scoring", category: "Monitoring", primaryOwnerRole: ROLE.OPERATIONS_MANAGER, accountableOwnerRole: ROLE.SUPER_ADMIN, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "security-ops.js Module 22", owningModule: 22 }),
  ctrl({ id: "SEC-CTRL-AI-PERMS", name: "AI permission registry & SoD", category: "Authorization", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "ai-permission-registry.js", owningModule: 29 }),
  ctrl({ id: "SEC-CTRL-PLATFORM-TENANT", name: "Platform tenant isolation", category: "Compliance", primaryOwnerRole: ROLE.SYSTEM_OWNER, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR, ROLE.SUPER_ADMIN], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "platform-ops.js tenants", owningModule: 30 }),
  ctrl({ id: "SEC-CTRL-BACKUP-ENCRYPT", name: "Encrypted backups", category: "Crypto", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "backup.encrypt", owningModule: 21 }),
  ctrl({ id: "SEC-CTRL-EXPORT-POLICY", name: "Export classification & masking", category: "Compliance", primaryOwnerRole: ROLE.AUDITOR, accountableOwnerRole: ROLE.SUPER_ADMIN, reviewers: [ROLE.ACCOUNTANT], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "export-policy.js", owningModule: 25 }),
  ctrl({ id: "SEC-CTRL-DEVICE-SYNC", name: "Device registration & revoke", category: "Identity", primaryOwnerRole: ROLE.OPERATIONS_MANAGER, accountableOwnerRole: ROLE.SUPER_ADMIN, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "Device.Revoke / offline sync", owningModule: 15 }),
  ctrl({ id: "SEC-CTRL-MAKER-CHECKER", name: "Config maker-checker", category: "Compliance", primaryOwnerRole: ROLE.SUPER_ADMIN, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "approval.makerChecker", owningModule: 14 }),
  ctrl({ id: "SEC-CTRL-OWNERSHIP-ASSIGN", name: "Security control ownership assignments", category: "Governance", primaryOwnerRole: ROLE.SYSTEM_OWNER, accountableOwnerRole: ROLE.SYSTEM_OWNER, reviewers: [ROLE.AUDITOR, ROLE.SUPER_ADMIN], finalApprover: ROLE.SYSTEM_OWNER, mappedRuntime: "security-ownership-assignment.js", owningModule: 30 })
]);

export const PERMISSION_REFS = Object.freeze({
  rbacActions: ACTIONS.slice(),
  roles: Object.freeze({ ...ROLE }),
  aiPermissionRegistry: "src/core/ai-permission-registry.js",
  superAdminForbidden: Object.freeze(["Owner.Transfer", "System.Reset", "Export.All"])
});

export function listSecurityControls() {
  return [...SECURITY_CONTROLS];
}

export function getSecurityControl(id) {
  return SECURITY_CONTROLS.find((c) => c.id === id) || null;
}

export function validateSecurityRegistry() {
  const errors = [];
  const ids = new Set();
  for (const c of SECURITY_CONTROLS) {
    if (ids.has(c.id)) errors.push("Duplicate " + c.id);
    ids.add(c.id);
    if (!c.primaryOwnerRole || !c.accountableOwnerRole || !c.finalApprover) {
      errors.push(c.id + " incomplete ownership");
    }
    if (!c.reviewers || c.reviewers.length < 1) errors.push(c.id + " missing reviewers");
  }
  return { ok: errors.length === 0, errors };
}

export const ESIACS_COUNTS = Object.freeze({
  controls: SECURITY_CONTROLS.length,
  rbacActions: ACTIONS.length
});
`);

w("src/core/security-ownership-assignment.js", `/**
 * Phase 9 — Security control ownership assignment workflow.
 * Status engine + SoD + authorization matrix. Error codes SEC-OWN-xxx / P9W-xxx.
 */

import { getSecurityControl, listSecurityControls } from "./canonical-security-registry.js";
import { ROLE } from "./roles.js";

export const SEC_OWN_VERSION = "1.0.0";

export const ASSIGNMENT_STATUSES = Object.freeze([
  "Draft",
  "PendingApproval",
  "Approved",
  "Active",
  "Suspended",
  "Expired",
  "Revoked",
  "Archived"
]);

export const ASSIGNMENT_TRANSITIONS = Object.freeze({
  Draft: ["PendingApproval", "Archived"],
  PendingApproval: ["Approved", "Draft", "Archived"],
  Approved: ["Active", "Archived"],
  Active: ["Suspended", "Expired", "Revoked", "Archived"],
  Suspended: ["Active", "Revoked", "Archived"],
  Expired: ["Archived", "Active"],
  Revoked: ["Archived"],
  Archived: []
});

/** Transition authorization roles matrix */
export const TRANSITION_AUTH = Object.freeze({
  initiate: [ROLE.SUPER_ADMIN, ROLE.SYSTEM_OWNER, ROLE.OPERATIONS_MANAGER],
  approve: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN],
  verify: [ROLE.AUDITOR, ROLE.SYSTEM_OWNER],
  execute: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN],
  emergency: [ROLE.SYSTEM_OWNER]
});

export const SEC_OWN_ERRORS = Object.freeze({
  "SEC-OWN-001": "Unknown security control",
  "SEC-OWN-002": "Invalid assignment fields",
  "SEC-OWN-003": "Duplicate Active assignment for control",
  "SEC-OWN-004": "Invalid status transition",
  "SEC-OWN-005": "SoD violation: initiator cannot approve",
  "SEC-OWN-006": "Unauthorized transition role",
  "SEC-OWN-007": "Assignment not found",
  "SEC-OWN-008": "Assignment expired",
  "P9W-010": "Primary and accountable owners must differ for Critical controls",
  "P9W-020": "Reopen from Archived requires SystemOwner"
});

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function newId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export function createEmptyStore() {
  return { assignments: [], audit: [] };
}

function audit(store, action, details, extras = {}) {
  const row = {
    id: newId("secaud"),
    action,
    details,
    at: nowIso(extras.now),
    ...extras
  };
  store.audit.push(row);
  return row;
}

export function validateAssignmentFields(record = {}) {
  const required = ["controlId", "primaryOwnerId", "accountableOwnerId", "status"];
  for (const key of required) {
    if (!record[key]) return { ok: false, code: "SEC-OWN-002", error: SEC_OWN_ERRORS["SEC-OWN-002"] + ": " + key };
  }
  if (!getSecurityControl(record.controlId)) {
    return { ok: false, code: "SEC-OWN-001", error: SEC_OWN_ERRORS["SEC-OWN-001"] };
  }
  if (!ASSIGNMENT_STATUSES.includes(record.status)) {
    return { ok: false, code: "SEC-OWN-002", error: "Invalid status" };
  }
  if (record.primaryOwnerId === record.accountableOwnerId && record.requireDistinctOwners) {
    return { ok: false, code: "P9W-010", error: SEC_OWN_ERRORS["P9W-010"] };
  }
  return { ok: true };
}

/**
 * Assignment record shape (JSON-schema aligned).
 */
export function buildAssignmentRecord(input = {}) {
  return {
    id: input.id || newId("secown"),
    controlId: input.controlId,
    primaryOwnerId: input.primaryOwnerId,
    accountableOwnerId: input.accountableOwnerId,
    reviewerIds: [...(input.reviewerIds || [])],
    finalApproverId: input.finalApproverId || "",
    status: input.status || "Draft",
    effectiveFrom: input.effectiveFrom || nowIso(),
    effectiveTo: input.effectiveTo || null,
    initiatedBy: input.initiatedBy || "",
    approvedBy: input.approvedBy || "",
    verifiedBy: input.verifiedBy || "",
    executedBy: input.executedBy || "",
    tenantId: input.tenantId || "tenant-smile-trust",
    reason: input.reason || "",
    version: input.version || "1.0.0",
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso()
  };
}

export function createAssignment(store, input, actor = {}) {
  const record = buildAssignmentRecord({ ...input, status: input.status || "Draft", initiatedBy: actor.id || input.initiatedBy || "" });
  const fields = validateAssignmentFields({ ...record, requireDistinctOwners: input.requireDistinctOwners });
  if (!fields.ok) return fields;

  const roleOk = TRANSITION_AUTH.initiate.includes(actor.role) || actor.role === ROLE.SYSTEM_OWNER || !actor.role;
  if (actor.role && !roleOk) {
    return { ok: false, code: "SEC-OWN-006", error: SEC_OWN_ERRORS["SEC-OWN-006"] };
  }

  if (record.status === "Active") {
    const clash = store.assignments.find((a) => a.controlId === record.controlId && a.status === "Active");
    if (clash) return { ok: false, code: "SEC-OWN-003", error: SEC_OWN_ERRORS["SEC-OWN-003"] };
  }

  store.assignments.push(record);
  audit(store, "OwnershipAssignment.Created", record.id, { controlId: record.controlId, actorId: actor.id });
  return { ok: true, assignment: record };
}

export function canTransition(from, to) {
  return (ASSIGNMENT_TRANSITIONS[from] || []).includes(to);
}

export function transitionAssignment(store, assignmentId, toStatus, actor = {}, options = {}) {
  const row = store.assignments.find((a) => a.id === assignmentId);
  if (!row) return { ok: false, code: "SEC-OWN-007", error: SEC_OWN_ERRORS["SEC-OWN-007"] };

  if (options.now && row.effectiveTo && Date.parse(row.effectiveTo) <= Date.parse(nowIso(options.now)) && row.status === "Active") {
    row.status = "Expired";
    audit(store, "OwnershipAssignment.AutoExpired", row.id, { actorId: "system" });
  }

  if (row.status === "Archived" && toStatus !== "Archived") {
    if (actor.role !== ROLE.SYSTEM_OWNER) {
      return { ok: false, code: "P9W-020", error: SEC_OWN_ERRORS["P9W-020"] };
    }
  }

  if (!canTransition(row.status, toStatus)) {
    return { ok: false, code: "SEC-OWN-004", error: SEC_OWN_ERRORS["SEC-OWN-004"] };
  }

  // Authorization by target
  if (toStatus === "PendingApproval") {
    if (actor.role && !TRANSITION_AUTH.initiate.includes(actor.role) && actor.role !== ROLE.SYSTEM_OWNER) {
      return { ok: false, code: "SEC-OWN-006", error: SEC_OWN_ERRORS["SEC-OWN-006"] };
    }
  }
  if (toStatus === "Approved") {
    if (actor.role && !TRANSITION_AUTH.approve.includes(actor.role) && actor.role !== ROLE.SYSTEM_OWNER) {
      return { ok: false, code: "SEC-OWN-006", error: SEC_OWN_ERRORS["SEC-OWN-006"] };
    }
    if (row.initiatedBy && actor.id && row.initiatedBy === actor.id && actor.role !== ROLE.SYSTEM_OWNER) {
      return { ok: false, code: "SEC-OWN-005", error: SEC_OWN_ERRORS["SEC-OWN-005"] };
    }
    row.approvedBy = actor.id || row.approvedBy;
  }
  if (toStatus === "Active") {
    if (actor.role && !TRANSITION_AUTH.execute.includes(actor.role) && actor.role !== ROLE.SYSTEM_OWNER) {
      return { ok: false, code: "SEC-OWN-006", error: SEC_OWN_ERRORS["SEC-OWN-006"] };
    }
    const clash = store.assignments.find((a) => a.id !== row.id && a.controlId === row.controlId && a.status === "Active");
    if (clash) return { ok: false, code: "SEC-OWN-003", error: SEC_OWN_ERRORS["SEC-OWN-003"] };
    row.executedBy = actor.id || row.executedBy;
  }

  const from = row.status;
  row.status = toStatus;
  row.updatedAt = nowIso(options.now);
  audit(store, "OwnershipAssignment.Transition", from + "→" + toStatus, {
    assignmentId: row.id,
    actorId: actor.id,
    role: actor.role
  });
  return { ok: true, assignment: row };
}

/** Auto-expire Active assignments past effectiveTo */
export function applyAutoExpire(store, now) {
  const ts = nowIso(now);
  const changed = [];
  for (const row of store.assignments) {
    if (row.status === "Active" && row.effectiveTo && Date.parse(row.effectiveTo) <= Date.parse(ts)) {
      row.status = "Expired";
      row.updatedAt = ts;
      audit(store, "OwnershipAssignment.AutoExpired", row.id, { actorId: "system" });
      changed.push(row);
    }
  }
  return changed;
}

export function getAssignmentAudit(store) {
  return [...(store.audit || [])];
}

export function listAssignments(store, filter = {}) {
  let rows = [...store.assignments];
  if (filter.controlId) rows = rows.filter((r) => r.controlId === filter.controlId);
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  return rows;
}

export function ownershipMatrixSanity() {
  const controls = listSecurityControls();
  const missing = controls.filter((c) => !c.primaryOwnerRole || !c.accountableOwnerRole);
  return { ok: missing.length === 0, missing: missing.map((m) => m.id) };
}
`);

console.log("phase9 core done");
