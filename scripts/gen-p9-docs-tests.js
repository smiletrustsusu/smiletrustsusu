/**
 * Phase 9 docs + tests
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

w("docs/enterprise-security-identity-compliance.md", `# Enterprise Security, Identity, Authorization & Compliance (ESIACS)

**Phase:** 9  
**Version:** 1.0.0  
**Status:** Authoritative  
**Date:** 2026-09-13  
**Registry:** \`src/core/canonical-security-registry.js\`  
**Ownership workflow:** \`src/core/security-ownership-assignment.js\`  
**Consumes:** Phases 1–8 · Modules 1–30  

## Architecture

Consolidate security into one canonical specification without redefining entities, APIs, DB schemas, or workflows. Runtime controls remain:

- Identity/roles: \`roles.js\` (Admin=Branch Manager, KBA=Super Admin, SystemOwner=john)
- Authorization: \`rbac.js\` \`canAction\` + \`SUPER_ADMIN_FORBIDDEN\` (unchanged)
- Session: \`session.js\` TTL / \`security.sessionTimeoutMinutes\`
- Gateway: Module 20 facade (in-process, no live HTTP security gateway beyond facade)
- Fraud/IR: Module 22
- AI permissions: Module 29 \`ai-permission-registry.js\`
- Platform tenant isolation: Module 30
- Secrets: Integration Hub hashed API keys; MoMo webhook secret Settings pattern — **no PINs/bank passwords**

## Zero Trust / MFA / Encryption (platform standards → actual controls)

| Standard | Mapped control |
|----------|----------------|
| Never trust network alone | Session binding + \`canAction\` on every mutating action |
| Verify explicitly | Login lockout, password PBKDF2 (120000), optional MFA flag |
| Least privilege | Role default action sets; Auditor read-only; KBA forbidden Owner.Transfer/System.Reset/Export.All |
| Assume breach | Audit trail Module 13; fraud scoring Module 22; kill switches Module 30 |
| Encrypt in transit/at rest | TLS-1.2+ standard; AES-256-GCM for backup.encrypt; hashed API keys |
| MFA for privileged | \`security.mfaRequired\` + AI Critical \`mfaRequired: true\` |

## Identity & Authentication

Users, devices, password policy, lockout, MFA standard, SystemOwner bootstrap (\`u-owner\` / john).

## Authorization

Screen permissions + action RBAC + approval limits (cashier **1000** GHS canonical). AI fine-grained permissions map to coarse \`Ai.*\` actions.

## Session

\`SESSION_TTL_MS\` default 8h; configurable via Phase 8 CFG-SEC-SESSION-TIMEOUT (default 480 minutes).

## Crypto & Secrets

See \`CRYPTO_POLICY\` — PBKDF2-SHA256, SHA-256, TLS-1.2+, AES-256-GCM naming standards. Forbidden keys: momoPin, pin, bankPassword, cardCvv.

## API / DB Security

Module 20 route actions + scopes; Module 28 INT-022 reject sensitive secrets; export-policy masking; no second posting path.

## Monitoring & Incident Response

Module 19 alerts + Module 22 incidents/fraud cases; AI fraud alerts Module 29 observe only.

## Compliance

Audit retention (2555 days config), maker-checker, ownership assignments, export classification.

## Machine-readable

\`SECURITY_CONTROLS\`, \`PERMISSION_REFS\`, \`CRYPTO_POLICY\`, ownership assignment store.

## GOVERNANCE

SystemOwner final accountability; KBA operational security admin; Auditor verifies; Developer implements non-prod; Branch Manager operates branch approval limits. Changes to security controls require ownership assignment workflow.

## Security Control Ownership Specification

| Dimension | Rule |
|-----------|------|
| Ownership matrix | Every SEC-CTRL-* has primaryOwnerRole, accountableOwnerRole, reviewers[], finalApprover |
| SoD | Initiator ≠ Approver (except SystemOwner emergency); primary ≠ accountable when requireDistinctOwners |
| Lifecycle responsibility | Primary maintains; Accountable accepts risk; Reviewers verify; FinalApprover activates |
| Validation | \`validateSecurityRegistry\` + assignment field validation |
| Audit | OwnershipAssignment.* events in assignment audit log |

## Ownership Assignment Data Requirements

| Field | Required | Notes |
|-------|----------|-------|
| id | Y | secown-* |
| controlId | Y | Must exist in SECURITY_CONTROLS |
| primaryOwnerId | Y | User id |
| accountableOwnerId | Y | User id |
| reviewerIds | N | Array |
| finalApproverId | N | User id |
| status | Y | See transitions |
| effectiveFrom / effectiveTo | Y/N | ISO timestamps |
| initiatedBy / approvedBy / verifiedBy / executedBy | lifecycle | Actor ids |
| tenantId | Y | Default tenant-smile-trust |
| reason | N | Free text |
| version | Y | Semver |

**Statuses:** Draft, PendingApproval, Approved, Active, Suspended, Expired, Revoked, Archived.  
**Uniqueness:** At most one **Active** assignment per controlId.  
**JSON shape:** \`buildAssignmentRecord\` output.

## Ownership Assignment Status Transitions

| From | Allowed to |
|------|------------|
| Draft | PendingApproval, Archived |
| PendingApproval | Approved, Draft, Archived |
| Approved | Active, Archived |
| Active | Suspended, Expired, Revoked, Archived |
| Suspended | Active, Revoked, Archived |
| Expired | Archived, Active (re-activate with execute auth) |
| Revoked | Archived |
| Archived | (none; reopen only SystemOwner via P9W-020 path) |

**Automatic:** Active → Expired when \`effectiveTo\` passed (\`applyAutoExpire\`).  
**Prohibited:** skip states; Archived → Active without SystemOwner.

## Transition Authorization Roles

| Step | Roles |
|------|-------|
| Initiated | Super Admin (KBA), SystemOwner, Operations Manager |
| Approved | SystemOwner, Super Admin (≠ initiator) |
| Verified | Auditor, SystemOwner |
| Executed (→ Active) | SystemOwner, Super Admin |
| Emergency | SystemOwner only |

SoD blocks same person initiate+approve (SEC-OWN-005). Delegation must remain within TRANSITION_AUTH sets. All transitions audited.

## Input & Dependency Rules

- Inputs: Phases 1–8, rbac/roles/session, Modules 20/22/28/29/30, AI permission registry, Phase 8 config security items
- Forbidden: changing SUPER_ADMIN_FORBIDDEN, money math, posting; storing MoMo PINs; new nav

---

*Companion: \`docs/esiacs-catalogs.md\`.*
`);

w("docs/esiacs-catalogs.md", `# ESIACS Catalogs (Phase 9)

**Parent:** [enterprise-security-identity-compliance.md](./enterprise-security-identity-compliance.md)  
**Registry:** \`src/core/canonical-security-registry.js\`

## Security Control Catalog

See \`SECURITY_CONTROLS\` (SEC-CTRL-*). Categories: Identity, Authentication, Authorization, Session, Secrets, API, Crypto, Monitoring, Compliance, Governance.

## Permission / Role Registries

- RBAC actions: \`rbac.js\` ACTIONS (cross-ref \`PERMISSION_REFS.rbacActions\`)
- Roles: Admin=Branch Manager, KBA=Super Admin, SystemOwner=john
- AI permissions: \`ai-permission-registry.js\` (Module 29) — not duplicated here
- SUPER_ADMIN_FORBIDDEN: Owner.Transfer, System.Reset, Export.All

## Threat Model Catalog (lightweight)

| ID | Threat | Mitigations |
|----|--------|-------------|
| THR-001 | Privilege escalation via KBA | SUPER_ADMIN_FORBIDDEN |
| THR-002 | Session hijack / stale session | Session TTL + clearSession |
| THR-003 | Secret leakage (MoMo PIN) | INT-022 forbidden keys; webhook secret ref only |
| THR-004 | Cross-tenant config read | Phase 8 isolation ECPFMS-011 |
| THR-005 | Fraudulent collections | Module 22 risk scoring (observe, no posting rewrite) |
| THR-006 | Unauthorized API use | Module 20 action/scopes; hashed keys |

## Compliance Control Matrix

| Framework theme | Control ids |
|-----------------|-------------|
| Access control | SEC-CTRL-RBAC-ACTIONS, SEC-CTRL-SUPER-ADMIN-FORBIDDEN |
| Auditability | SEC-CTRL-AUDIT-TRAIL |
| Cryptography | SEC-CTRL-BACKUP-ENCRYPT, CRYPTO_POLICY |
| Incident response | SEC-CTRL-FRAUD-OPS |
| Segregation of duties | SEC-CTRL-MAKER-CHECKER, SEC-CTRL-OWNERSHIP-ASSIGN |

## Ownership Matrix

Primary / Accountable / Reviewers / FinalApprover per control — see registry fields.

## Cross-ref Phases 1–8 / Modules 1–30

Consumes Phase 8 security config items; Module 1 identity; 13 audit; 15 devices; 20 gateway; 21 backup; 22 security ops; 25 export; 28 secrets; 29 AI perms; 30 platform.
`);

w("tests/esiacs-consistency.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SECURITY_CONTROLS,
  validateSecurityRegistry,
  CRYPTO_POLICY,
  PERMISSION_REFS,
  ESIACS_COUNTS
} from "../src/core/canonical-security-registry.js";
import { ownershipMatrixSanity } from "../src/core/security-ownership-assignment.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("unique controls and ownership completeness", () => {
  const v = validateSecurityRegistry();
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(new Set(SECURITY_CONTROLS.map((c) => c.id)).size, SECURITY_CONTROLS.length);
  assert.ok(ESIACS_COUNTS.controls >= 20);
  const sanity = ownershipMatrixSanity();
  assert.equal(sanity.ok, true);
});

test("SoD matrix sanity and crypto standards", () => {
  assert.equal(CRYPTO_POLICY.pbkdf2Iterations, 120000);
  assert.equal(CRYPTO_POLICY.hash, "SHA-256");
  assert.ok(CRYPTO_POLICY.forbiddenInSource.includes("momoPin"));
  assert.deepEqual(PERMISSION_REFS.superAdminForbidden, ["Owner.Transfer", "System.Reset", "Export.All"]);
  for (const c of SECURITY_CONTROLS) {
    assert.ok(c.reviewers.length >= 1);
    assert.ok(c.finalApprover);
  }
});

test("docs sections present including ownership appendices", () => {
  const text = fs.readFileSync(path.join(root, "docs", "enterprise-security-identity-compliance.md"), "utf8");
  assert.match(text, /GOVERNANCE/i);
  assert.match(text, /Security Control Ownership Specification/i);
  assert.match(text, /Ownership Assignment Data Requirements/i);
  assert.match(text, /Ownership Assignment Status Transitions/i);
  assert.match(text, /Transition Authorization Roles/i);
  assert.match(text, /Input & Dependency Rules/i);
  assert.equal(fs.existsSync(path.join(root, "docs", "esiacs-catalogs.md")), true);
});
`);

w("tests/security-ownership-assignment.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import { ROLE } from "../src/core/roles.js";
import {
  createEmptyStore,
  createAssignment,
  transitionAssignment,
  applyAutoExpire,
  validateAssignmentFields,
  canTransition
} from "../src/core/security-ownership-assignment.js";

test("field validation", () => {
  const bad = validateAssignmentFields({});
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "SEC-OWN-002");
  const unknown = validateAssignmentFields({
    controlId: "NOPE",
    primaryOwnerId: "a",
    accountableOwnerId: "b",
    status: "Draft"
  });
  assert.equal(unknown.code, "SEC-OWN-001");
});

test("unique Active assignment; transition allow/deny; SoD", () => {
  const store = createEmptyStore();
  const alice = { id: "u-alice", role: ROLE.SUPER_ADMIN };
  const bob = { id: "u-bob", role: ROLE.SUPER_ADMIN };
  const owner = { id: "u-owner", role: ROLE.SYSTEM_OWNER };

  const created = createAssignment(store, {
    controlId: "SEC-CTRL-RBAC-ACTIONS",
    primaryOwnerId: "u-alice",
    accountableOwnerId: "u-bob"
  }, alice);
  assert.equal(created.ok, true);

  assert.equal(transitionAssignment(store, created.assignment.id, "PendingApproval", alice).ok, true);
  const sod = transitionAssignment(store, created.assignment.id, "Approved", alice);
  assert.equal(sod.ok, false);
  assert.equal(sod.code, "SEC-OWN-005");

  assert.equal(transitionAssignment(store, created.assignment.id, "Approved", bob).ok, true);
  assert.equal(transitionAssignment(store, created.assignment.id, "Active", owner).ok, true);

  const second = createAssignment(store, {
    controlId: "SEC-CTRL-RBAC-ACTIONS",
    primaryOwnerId: "u-alice",
    accountableOwnerId: "u-bob",
    status: "Active"
  }, owner);
  assert.equal(second.ok, false);
  assert.equal(second.code, "SEC-OWN-003");

  assert.equal(canTransition("Active", "Draft"), false);
  assert.equal(canTransition("Draft", "PendingApproval"), true);
});

test("auto-expire and authorization roles", () => {
  const store = createEmptyStore();
  const owner = { id: "u-owner", role: ROLE.SYSTEM_OWNER };
  const cashier = { id: "u-cash", role: ROLE.CASHIER };
  const created = createAssignment(store, {
    controlId: "SEC-CTRL-SESSION-TTL",
    primaryOwnerId: "a",
    accountableOwnerId: "b",
    status: "Active",
    effectiveTo: "2020-01-01T00:00:00.000Z"
  }, owner);
  assert.equal(created.ok, true);
  const expired = applyAutoExpire(store, Date.parse("2026-09-13T00:00:00.000Z"));
  assert.equal(expired.length, 1);
  assert.equal(expired[0].status, "Expired");

  const draft = createAssignment(store, {
    controlId: "SEC-CTRL-AUDIT-TRAIL",
    primaryOwnerId: "a",
    accountableOwnerId: "b"
  }, cashier);
  assert.equal(draft.ok, false);
  assert.equal(draft.code, "SEC-OWN-006");
});
`);

console.log("phase9 docs/tests done");
