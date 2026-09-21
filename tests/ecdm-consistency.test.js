/**
 * Phase 3 ECDM consistency — registry invariants, money ownership, docs/EMAS cross-check.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_ENTITIES,
  CANONICAL_RELATIONSHIPS,
  MONEY_TRANSACTION_ENTITY_CODES,
  listCanonicalEntities,
  getCanonicalEntity,
  assertSingleOwner,
  listAggregateRoots,
  validateDomainRegistry,
  ECDM_VERSION
} from "../src/core/canonical-domain-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

const ECDM_DOCS = ["enterprise-canonical-domain-model.md", "ecdm-catalogs.md"];

test("ECDM docs exist and mention ECDM / Modules 1–30", () => {
  for (const doc of ECDM_DOCS) {
    assert.equal(exists(doc), true, `missing ${doc}`);
    const text = read(doc);
    assert.match(text, /ECDM|Enterprise Canonical Domain Model/);
    assert.match(text, /Modules?\s+1\s*[–-]\s*30|1–30/);
  }
});

test("ECDM docs cross-check EMAS existence and Modules 1–30", () => {
  assert.equal(exists("enterprise-master-architecture.md"), true);
  assert.equal(exists("emas-matrices.md"), true);
  assert.equal(exists("phase2-registers.md"), true);

  const emas = read("enterprise-master-architecture.md");
  for (let id = 1; id <= 30; id += 1) {
    assert.match(emas, new RegExp(`###\\s+Module\\s+${id}\\s+[—-]`, "m"), `EMAS missing Module ${id}`);
  }

  const ecdm = read("enterprise-canonical-domain-model.md");
  assert.match(ecdm, /enterprise-master-architecture\.md|EMAS/);
  assert.match(ecdm, /phase2-registers\.md|Phase 2/);
  assert.match(ecdm, /advisory/i);
  assert.match(ecdm, /pesewas/i);
  assert.match(ecdm, /canonical-domain-registry\.js/);

  const catalogs = read("ecdm-catalogs.md");
  assert.match(catalogs, /Canonical Entity Catalog/);
  assert.match(catalogs, /Aggregate Root Catalog/);
  assert.match(catalogs, /Relationship Matrix/);
  assert.match(catalogs, /Ownership Matrix/);
  assert.match(catalogs, /Identifier Registry/);
  assert.match(catalogs, /Cross-Reference Index/);
});

test("registry has unique entity codes", () => {
  const codes = CANONICAL_ENTITIES.map((e) => e.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(listCanonicalEntities().length, codes.length);
});

test("every entity has exactly one owning module (1–30)", () => {
  const result = assertSingleOwner();
  assert.equal(result.ok, true);
  for (const entity of CANONICAL_ENTITIES) {
    const owner = Number(entity.owningModuleId);
    assert.ok(Number.isInteger(owner) && owner >= 1 && owner <= 30, entity.code);
    assert.equal(getCanonicalEntity(entity.code).owningModuleId, owner);
  }
});

test("no orphan relationship targets", () => {
  const codes = new Set(CANONICAL_ENTITIES.map((e) => e.code));
  for (const rel of CANONICAL_RELATIONSHIPS) {
    assert.equal(codes.has(rel.from), true, `orphan from ${rel.from}`);
    assert.equal(codes.has(rel.to), true, `orphan to ${rel.to}`);
  }
});

test("aggregate roots are a subset of the catalog", () => {
  const codes = new Set(CANONICAL_ENTITIES.map((e) => e.code));
  const roots = listAggregateRoots();
  assert.ok(roots.length > 0);
  for (const root of roots) {
    assert.equal(codes.has(root.code), true, root.code);
    assert.equal(root.aggregateRoot, true);
  }
  assert.ok(roots.length <= CANONICAL_ENTITIES.length);
});

test("money/transaction entities not owned by Modules 28, 29, or 30", () => {
  for (const code of MONEY_TRANSACTION_ENTITY_CODES) {
    const entity = getCanonicalEntity(code);
    assert.ok(entity, `missing money entity ${code}`);
    assert.equal([28, 29, 30].includes(entity.owningModuleId), false, `${code} owned by ${entity.owningModuleId}`);
  }
  const aiMoney = CANONICAL_ENTITIES.filter(
    (e) => e.owningModuleId === 29 && MONEY_TRANSACTION_ENTITY_CODES.includes(e.code)
  );
  const hubMoney = CANONICAL_ENTITIES.filter(
    (e) => e.owningModuleId === 28 && MONEY_TRANSACTION_ENTITY_CODES.includes(e.code)
  );
  const platMoney = CANONICAL_ENTITIES.filter(
    (e) => e.owningModuleId === 30 && MONEY_TRANSACTION_ENTITY_CODES.includes(e.code)
  );
  assert.equal(aiMoney.length, 0);
  assert.equal(hubMoney.length, 0);
  assert.equal(platMoney.length, 0);
});

test("validateDomainRegistry passes", () => {
  const result = validateDomainRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.version, ECDM_VERSION);
  assert.ok(result.entityCount >= 40);
  assert.ok(result.aggregateRootCount >= 20);
});

test("helpers expose expected surface", () => {
  assert.equal(typeof listCanonicalEntities, "function");
  assert.equal(typeof getCanonicalEntity, "function");
  assert.equal(typeof assertSingleOwner, "function");
  assert.equal(typeof listAggregateRoots, "function");
  assert.equal(typeof validateDomainRegistry, "function");
  assert.equal(getCanonicalEntity("ENT-DOES-NOT-EXIST"), null);
  assert.equal(getCanonicalEntity("ENT-CUS-001").name, "Customer");
  assert.equal(getCanonicalEntity("ENT-SAV-003").owningModuleId, 6);
  assert.equal(getCanonicalEntity("ENT-AI-001").owningModuleId, 29);
  assert.equal(getCanonicalEntity("ENT-PLT-001").owningModuleId, 30);
});
