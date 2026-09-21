/**
 * EMAS consistency checks — lightweight validation that the Enterprise Master
 * Architecture Specification stays aligned with Modules 1–30, key docs/cores,
 * and documented dependency/AI boundaries.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_CATALOG,
  MODULE_CONSUME,
  contractsForModule,
  assertContractBoundary
} from "../src/core/module-contracts.js";
import { assertAiBoundary } from "../src/core/ai-ops.js";
import { assertPlatformBoundary } from "../src/core/platform-ops.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const CORE = path.join(ROOT, "src", "core");

const EMAS_PATH = path.join(DOCS, "enterprise-master-architecture.md");
const MATRICES_PATH = path.join(DOCS, "emas-matrices.md");

const MODULE_NAMES = {
  1: "Authentication",
  2: "Dashboard",
  3: "Customer",
  4: "Agent",
  5: "Branch",
  6: "Savings",
  7: "Group",
  8: "Loan",
  9: "Withdrawal",
  10: "Accounting",
  11: "Reports",
  12: "Notification",
  13: "Audit",
  14: "Configuration",
  15: "Synchronization",
  16: "Payment",
  17: "Document",
  18: "Scheduler",
  19: "Monitoring",
  20: "API Gateway",
  21: "Backup",
  22: "Security",
  23: "Workflow",
  24: "Rules",
  25: "Exchange",
  26: "Records",
  27: "BI",
  28: "Integration",
  29: "AI",
  30: "Platform"
};

const KEY_DOCS = {
  20: "api-gateway.md",
  24: "rule-engine.md",
  27: "enterprise-bi.md",
  28: "enterprise-integration.md",
  29: "enterprise-ai.md",
  30: "platform-administration.md"
};

const KEY_CORES = {
  20: ["api-gateway-ops.js", "module-contracts.js"],
  24: ["rule-ops.js", "rule-api.js"],
  27: ["bi-ops.js", "bi-api.js"],
  28: ["integration-ops.js", "integration-api.js"],
  29: ["ai-ops.js", "ai-api.js", "ai-governance.js"],
  30: ["platform-ops.js", "platform-api.js", "platform-lifecycle.js"]
};

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

test("EMAS and matrices documents exist", () => {
  assert.equal(exists(EMAS_PATH), true, "enterprise-master-architecture.md missing");
  assert.equal(exists(MATRICES_PATH), true, "emas-matrices.md missing");
});

test("Modules 1–30 are listed in EMAS catalog", () => {
  const emas = read(EMAS_PATH);
  for (let id = 1; id <= 30; id += 1) {
    const heading = new RegExp(`###\\s+Module\\s+${id}\\s+[—-]`, "m");
    assert.match(emas, heading, `EMAS missing catalog heading for Module ${id}`);
  }
  assert.match(emas, /Module Catalog \(Modules 1–30\)/);
});

test("CONTRACT_CATALOG covers modules 1–30 with no orphan IDs", () => {
  const ids = new Set(CONTRACT_CATALOG.map((c) => Number(c.moduleId)));
  for (let id = 1; id <= 30; id += 1) {
    assert.equal(ids.has(id), true, `No contracts for module ${id}`);
    assert.ok(contractsForModule(id).length > 0, `Empty contract list for ${id}`);
  }
  for (const id of ids) {
    assert.ok(id >= 1 && id <= 30, `Orphan moduleId in catalog: ${id}`);
  }
});

test("spot-check key module docs and cores exist (20, 24, 27–30)", () => {
  for (const [id, doc] of Object.entries(KEY_DOCS)) {
    const p = path.join(DOCS, doc);
    assert.equal(exists(p), true, `Missing doc for module ${id}: ${doc}`);
    const text = read(p);
    assert.match(text, new RegExp(`Module\\s+${id}`), `${doc} should mention Module ${id}`);
  }
  for (const [id, files] of Object.entries(KEY_CORES)) {
    for (const file of files) {
      assert.equal(exists(path.join(CORE, file)), true, `Missing core ${file} for module ${id}`);
    }
  }
});

test("documented dependency claims for modules 28–30 are sane", () => {
  assert.deepEqual(
    MODULE_CONSUME[28].slice().sort((a, b) => a - b),
    [13, 16, 18, 19, 20, 23, 25].sort((a, b) => a - b)
  );
  assert.ok(MODULE_CONSUME[28].includes(20), "28 must depend on gateway 20");

  assert.ok(MODULE_CONSUME[29].includes(24), "29 must depend on rule engine 24");
  assert.ok(MODULE_CONSUME[29].includes(20), "29 must depend on gateway 20");

  const emas = read(EMAS_PATH);
  const matrices = read(MATRICES_PATH);
  assert.match(emas, /30.*govern/i);
  assert.match(matrices, /30 governs config\/flags/i);
  assert.match(matrices, /29 depends on 24/i);
  assert.match(matrices, /28 depends on 20/i);
});

test("AI does not own transactional posting (explicit)", () => {
  const emas = read(EMAS_PATH);
  const matrices = read(MATRICES_PATH);
  const aiDoc = read(path.join(DOCS, "enterprise-ai.md"));

  assert.match(emas, /AI does not own transactional posting/i);
  assert.match(matrices, /does not own transactional posting/i);
  assert.match(aiDoc, /never replaces Module 24|AI never replaces/i);

  const boundary = assertAiBoundary();
  assert.equal(boundary.customerBalanceUntouched, true);
  assert.equal(boundary.moneyUnit, "pesewas");
  assert.equal(boundary.advisoryOnly, true);

  const postingAi = CONTRACT_CATALOG.filter((c) => c.moduleId === 29 && c.posting === true);
  assert.equal(postingAi.length, 0, "AI contracts must not be marked posting");
});

test("platform boundary and gateway in-process statements hold", () => {
  const platform = assertPlatformBoundary();
  assert.equal(platform.customerBalanceUntouched, true);
  assert.equal(platform.doesNotDuplicateModules1to29, true);

  const contractBoundary = assertContractBoundary();
  assert.equal(contractBoundary.restHttp, false);
  assert.equal(contractBoundary.graphqlHttp, false);
  assert.equal(contractBoundary.postsCollections, false);

  const emas = read(EMAS_PATH);
  assert.match(emas, /no separate REST or GraphQL HTTP server/i);
  assert.match(emas, /in-process/i);
});

test("EMAS references matrices and known owner aliases", () => {
  const emas = read(EMAS_PATH);
  assert.match(emas, /emas-matrices\.md/);
  assert.match(emas, /Branch Manager.*Admin/i);
  assert.match(emas, /Super Admin.*KBA/i);
  assert.match(emas, /System Owner.*john/i);
  assert.match(emas, /cashier.*1,?000/i);
  assert.match(emas, /15%/);
  assert.match(emas, /31/);
});

test("contract owner names align with MODULE_NAMES spot check", () => {
  for (const [id, name] of Object.entries(MODULE_NAMES)) {
    const sample = contractsForModule(Number(id))[0];
    assert.ok(sample, `module ${id}`);
    assert.equal(sample.owner, name, `Module ${id} owner expected ${name}, got ${sample.owner}`);
  }
});
