/**
 * Phase 5 ECECMS consistency — registry invariants, ECDM/ECSMLS binding, docs checks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_EVENTS,
  ECECMS_VERSION,
  listCanonicalEvents,
  getCanonicalEvent,
  validateEventRegistry,
  EVENT_SCHEMA
} from "../src/core/canonical-event-registry.js";
import { getCanonicalEntity } from "../src/core/canonical-domain-registry.js";
import { getStateMachine } from "../src/core/canonical-state-machine-registry.js";
import { CONTRACT_CATALOG, getContract } from "../src/core/module-contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

const ECECMS_DOCS = [
  "enterprise-canonical-event-catalog.md",
  "ececms-catalogs.md"
];

test("ECECMS docs exist and include Input & Dependency Rules", () => {
  for (const doc of ECECMS_DOCS) {
    assert.equal(exists(doc), true, `missing ${doc}`);
  }
  const primary = read("enterprise-canonical-event-catalog.md");
  assert.match(primary, /ECECMS|Enterprise Canonical Event/);
  assert.match(primary, /IMPLEMENTATION BOUNDARY/);
  assert.match(primary, /Phase Input & Dependency Rules/);
  assert.match(primary, /Required inputs/);
  assert.match(primary, /Precedence/);
  assert.match(primary, /Prohibited activities/);
  assert.match(primary, /canonical-event-registry\.js/);
  assert.match(primary, /in-process|publishDomainEvent|domainEvents/);
  assert.match(primary, /Modules?\s+1\s*[–-]\s*30|1–30/);
  assert.match(primary, /Module\s+20/);

  const catalogs = read("ececms-catalogs.md");
  assert.match(catalogs, /Event Ownership Matrix|Ownership Matrix/);
  assert.match(catalogs, /Producer|Consumer/);
  assert.match(catalogs, /Routing/);
  assert.match(catalogs, /Version|Schema/);
  assert.match(catalogs, /Lifecycle/);
  assert.match(catalogs, /Delivery/);
  assert.match(catalogs, /Security|Classification/);
  assert.match(catalogs, /Cross-Reference Index/);
});

test("registry has unique event IDs/names and curated count 40–80", () => {
  const ids = CANONICAL_EVENTS.map((e) => e.id);
  const names = CANONICAL_EVENTS.map((e) => e.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  assert.equal(listCanonicalEvents().length, ids.length);
  assert.ok(ids.length >= 40 && ids.length <= 80, `expected 40–80 events, got ${ids.length}`);
  assert.equal(typeof EVENT_SCHEMA.$id, "string");
  assert.equal(ECECMS_VERSION, "1.0.0");
});

test("validateEventRegistry passes", () => {
  const result = validateEventRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.eventCount, CANONICAL_EVENTS.length);
});

test("ECDM and ECSMLS refs resolve when present", () => {
  for (const event of CANONICAL_EVENTS) {
    if (event.entityId) {
      assert.ok(getCanonicalEntity(event.entityId), `${event.id} orphan entity ${event.entityId}`);
    }
    if (event.stateMachineId) {
      assert.ok(getStateMachine(event.stateMachineId), `${event.id} orphan SM ${event.stateMachineId}`);
    }
  }
});

test("contract catalog alignment — curated names are event contracts", () => {
  for (const event of CANONICAL_EVENTS) {
    const c = getContract(event.name);
    assert.ok(c, `${event.id} missing contract ${event.name}`);
    assert.equal(c.kind, "event");
    assert.ok(getCanonicalEvent(event.id));
    assert.ok(getCanonicalEvent(event.name));
  }
  const catalogEvents = CONTRACT_CATALOG.filter((c) => c.kind === "event");
  assert.ok(catalogEvents.length >= CANONICAL_EVENTS.length);
});

test("Phase 1–4 input docs still present for dependency chain", () => {
  assert.equal(exists("enterprise-master-architecture.md"), true);
  assert.equal(exists("enterprise-canonical-domain-model.md"), true);
  assert.equal(exists("phase2-registers.md"), true);
  assert.equal(exists("enterprise-canonical-state-machines.md"), true);
  assert.equal(exists("ecsmls-catalogs.md"), true);
});