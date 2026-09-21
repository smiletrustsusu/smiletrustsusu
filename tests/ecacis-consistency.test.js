/**
 * Phase 6 ECACIS consistency — API registry, facades, docs checks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_APIS,
  ECACIS_VERSION,
  listCanonicalApis,
  getCanonicalApi,
  validateApiRegistry,
  API_SCHEMA
} from "../src/core/canonical-api-registry.js";
import { CONTRACT_CATALOG, getContract } from "../src/core/module-contracts.js";
import { ROUTE_CATALOG } from "../src/core/api-gateway-lifecycle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

const ECACIS_DOCS = [
  "enterprise-canonical-api-catalog.md",
  "ecacis-catalogs.md",
  "openapi-enterprise-facade.json",
  "graphql-enterprise-facade.graphql"
];

test("Phase 6 docs exist and include governance + facade disclaimer", () => {
  for (const doc of ECACIS_DOCS) {
    assert.equal(exists(doc), true, `missing ${doc}`);
  }
  const primary = read("enterprise-canonical-api-catalog.md");
  assert.match(primary, /ECACIS|Enterprise Canonical API/);
  assert.match(primary, /Input & Dependency Rules|Phase Input & Dependency Rules/);
  assert.match(primary, /Stage sequencing|Stage Sequencing/i);
  assert.match(primary, /Approved-with-Conditions|Approved with Conditions/i);
  assert.match(primary, /Deliverable Status/);
  assert.match(primary, /NOT a live|NO live|facade/i);
  assert.match(primary, /invokeContract/);

  const catalogs = read("ecacis-catalogs.md");
  assert.match(catalogs, /Ownership/);
  assert.match(catalogs, /Endpoint Registry|endpoint/i);
  assert.match(catalogs, /Authorization|Authz/i);
  assert.match(catalogs, /Version/);
  assert.match(catalogs, /Error/);
  assert.match(catalogs, /SLA/);
  assert.match(catalogs, /Cross-Reference/);
});

test("API registry unique endpoint ids and contractIds; ownership present", () => {
  const ids = CANONICAL_APIS.map((a) => a.id);
  const contractIds = CANONICAL_APIS.map((a) => a.contractId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(contractIds).size, contractIds.length);
  assert.equal(listCanonicalApis().length, ids.length);
  assert.ok(ids.length > 100, `expected substantial endpoint count, got ${ids.length}`);
  assert.equal(ECACIS_VERSION, "1.0.0");
  assert.equal(typeof API_SCHEMA.$id, "string");
  for (const api of CANONICAL_APIS) {
    assert.ok(Number(api.owningModule) >= 1 && Number(api.owningModule) <= 30, api.id);
  }
});

test("validateApiRegistry passes and matches catalogs", () => {
  const result = validateApiRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.liveHttpServer, false);
  assert.equal(result.facadeOnly, true);
  assert.equal(result.contractEndpointCount, CONTRACT_CATALOG.filter((c) => ["command", "query", "admin", "batch", "health"].includes(c.kind)).length);
  assert.equal(result.gatewayEndpointCount, ROUTE_CATALOG.length);
});

test("contract and gateway refs resolve", () => {
  for (const api of listCanonicalApis({ facadeType: "contract" })) {
    assert.ok(getContract(api.contractId), api.contractId);
    assert.ok(getCanonicalApi(api.id));
    assert.ok(getCanonicalApi(api.contractId));
  }
  for (const api of listCanonicalApis({ facadeType: "gateway" })) {
    const routeId = String(api.contractId).replace(/^gateway:/, "");
    assert.ok(ROUTE_CATALOG.some((r) => r.id === routeId), routeId);
  }
});

test("OpenAPI facade parses JSON and GraphQL file exists with disclaimer", () => {
  const raw = read("openapi-enterprise-facade.json");
  const doc = JSON.parse(raw);
  assert.equal(doc.openapi.startsWith("3."), true);
  assert.match(String(doc.info.description || ""), /NOT a live|facade|in-process/i);
  assert.equal(doc["x-live-http-server"], false);
  assert.ok(doc.paths["/contracts/{contractId}"]);
  assert.ok(doc.paths["/gateway/{route}"]);

  const gql = read("graphql-enterprise-facade.graphql");
  assert.match(gql, /NOT a live GraphQL|facade/i);
  assert.match(gql, /type Query/);
});

test("Phase 1–5 input docs present (Phase 5 before 6)", () => {
  assert.equal(exists("enterprise-master-architecture.md"), true);
  assert.equal(exists("enterprise-canonical-domain-model.md"), true);
  assert.equal(exists("enterprise-canonical-state-machines.md"), true);
  assert.equal(exists("enterprise-canonical-event-catalog.md"), true);
  assert.equal(exists("ececms-catalogs.md"), true);
});