/**
 * Phase 2 consistency checks — docs, known architecture facts, money-ownership spot-check.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_CATALOG,
  MODULE_CONSUME,
  assertContractBoundary
} from "../src/core/module-contracts.js";
import { assertAiBoundary } from "../src/core/ai-ops.js";
import { assertPlatformBoundary } from "../src/core/platform-ops.js";
import { DEFAULT_APPROVAL_LIMITS, defaultActionsForRole } from "../src/core/rbac.js";
import { ROLE } from "../src/core/roles.js";
import { SCHEMA_CHECKSUM_RE } from "../src/core/schema-checksum.js";
import { ARW_STAGES } from "../src/core/architecture-review-workflow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

const PHASE2_DOCS = [
  "enterprise-consistency-review.md",
  "enterprise-governance-validation.md",
  "phase2-registers.md",
  "enterprise-architecture-review-workflow.md",
  "enterprise-master-architecture.md",
  "emas-matrices.md"
];

test("Phase 2 docs exist and reference Modules 1–30 / EMAS", () => {
  for (const doc of PHASE2_DOCS) {
    assert.equal(exists(doc), true, `missing ${doc}`);
  }
  const consistency = read("enterprise-consistency-review.md");
  const governance = read("enterprise-governance-validation.md");
  const registers = read("phase2-registers.md");
  const workflow = read("enterprise-architecture-review-workflow.md");

  for (const text of [consistency, governance, registers, workflow]) {
    assert.match(text, /Modules?\s+1\s*[–-]\s*30|1–30/);
    assert.match(text, /EMAS|enterprise-master-architecture/);
  }

  assert.match(consistency, /CHANGE GOVERNANCE/);
  assert.match(consistency, /enterprise-architecture-review-workflow\.md/);
  assert.match(workflow, /Planned/);
  assert.match(workflow, /AI Governance/);
  assert.match(workflow, /Final Approval Review/);
  assert.match(registers, /API Conflict Register/);
  assert.match(registers, /Event Conflict Register/);
  assert.match(registers, /Data Ownership Register/);
  assert.match(registers, /Security Consistency Register/);
  assert.match(registers, /Dependency Validation Matrix/);
});

test("known project facts: AI ≠ 24, Hub 28, Platform 30, gateway 20 in-process", () => {
  const emas = read("enterprise-master-architecture.md");
  const consistency = read("enterprise-consistency-review.md");

  assert.match(emas, /Module\s+\*\*24\*\*\s+Rule Engine|Module 24/);
  assert.match(emas, /29.*advisory|advisory only/i);
  assert.match(emas, /28.*Integration|Integration Hub/);
  assert.match(emas, /30.*Platform|Platform Admin/);
  assert.match(emas, /no separate REST or GraphQL HTTP server/i);
  assert.match(emas, /in-process/i);

  assert.match(consistency, /AI.*Module 24|24.*deterministic/i);
  assert.match(consistency, /Integration Hub|Module\s+\*\*28\*\*|Module 28/);
  assert.match(consistency, /Platform Admin|Module\s+\*\*30\*\*|Module 30/);
  assert.match(consistency, /Module\s+\*\*20\*\*|Module 20|in-process/);

  const boundary = assertContractBoundary();
  assert.equal(boundary.restHttp, false);
  assert.equal(boundary.graphqlHttp, false);

  assert.ok(MODULE_CONSUME[28].includes(20));
  assert.ok(MODULE_CONSUME[29].includes(24));
  assert.equal(ARW_STAGES.includes("AI Governance"), true);
});

test("spot-check: no Critical unresolved money posting ownership for collections", () => {
  const consistency = read("enterprise-consistency-review.md");
  const registers = read("phase2-registers.md");
  const governance = read("enterprise-governance-validation.md");

  assert.match(consistency, /Critical unresolved count|\*\*0\*\*|Critical.*\*\*0\*\*|no Critical|Critical blockers remaining.*\*\*No/i);
  assert.match(consistency, /Critical \| 0/);
  assert.match(registers, /Collections posting ownership.*Module\s+\*\*6\*\*/i);
  assert.match(governance, /Critical unresolved \|\s*\*\*0\*\*/);

  const ai = assertAiBoundary();
  assert.equal(ai.customerBalanceUntouched, true);
  assert.equal(ai.advisoryOnly, true);

  const platform = assertPlatformBoundary();
  assert.equal(platform.customerBalanceUntouched, true);

  const postingAi = CONTRACT_CATALOG.filter((c) => c.moduleId === 29 && c.posting === true);
  const postingPlat = CONTRACT_CATALOG.filter((c) => c.moduleId === 30 && c.posting === true);
  assert.equal(postingAi.length, 0);
  assert.equal(postingPlat.length, 0);
  assert.equal(assertContractBoundary().postsCollections, false);
});

test("money defaults and SUPER_ADMIN_FORBIDDEN remain governance invariants", () => {
  const emas = read("enterprise-master-architecture.md");
  assert.match(emas, /1,?000/);
  assert.match(emas, /15%/);
  assert.match(emas, /31/);

  assert.equal(DEFAULT_APPROVAL_LIMITS[ROLE.CASHIER], 1000);
  const superActions = defaultActionsForRole(ROLE.SUPER_ADMIN);
  assert.equal(superActions.includes("Owner.Transfer"), false);
  assert.equal(superActions.includes("System.Reset"), false);
  assert.equal(superActions.includes("Export.All"), false);
});

test("checksum normative pattern is lowercase hex", () => {
  assert.equal(SCHEMA_CHECKSUM_RE.test("SHA-256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), true);
  assert.equal(SCHEMA_CHECKSUM_RE.test("SHA-256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), false);
});

test("workflow doc lists all 14 stages", () => {
  const workflow = read("enterprise-architecture-review-workflow.md");
  for (const stage of ARW_STAGES) {
    assert.match(workflow, new RegExp(stage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
