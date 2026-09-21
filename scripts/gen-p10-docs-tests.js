/**
 * Phase 10 docs + tests
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body, "utf8");
  console.log("wrote", rel);
};

w("docs/enterprise-integration-interoperability.md", `# Enterprise Integration, Interoperability & External Connectivity (EIIECS)

**Phase:** 10 · **Version:** 1.0.0 · **Status:** Authoritative · **Date:** 2026-09-13  
**Registry:** \`src/core/canonical-integration-registry.js\`  
**Operational engine:** Module 28 \`integration-ops.js\` (do not replace)  
**Gateway facade:** Module 20 · **Consumes:** Phases 1–9 · Modules 1–30  

## Architecture

In-process Integration Hub catalogs providers (MoMo/SMS/email simulated), webhooks, circuit breakers, rate limits, and transforms. External callers enter via Module 20 facade. No live HTTP security gateway beyond that facade. MoMo webhook secret uses \`settings.momoWebhookSecret\` — no MoMo PINs or bank passwords.

## Capability Domains

Mobile Money · Bank · Payments · Messaging · KYC/Credit · Regulatory · Enterprise (ERP/CRM/BI/Cloud)

## Provider / Endpoint / Webhook Templates

See catalogs and machine-readable registries. All integration catalog rows \`owningModule: 28\` except gateway facade cross-ref to Module 20 actions.

## Sync, Resilience, Monitoring, Security Mapping

SYNC-* strategies; RES-* circuit/retry/rate/timeout (defaults align Phase 8 CFG-INTEGRATION-*); MON-* metrics to Module 19; SECMAP-* to Phase 9 SEC-CTRL-*.

## Input & Dependency Rules

- Inputs: Phases 1–9, Module 28 SEEDED_PROVIDERS / HUB_ROUTE_CATALOG, Phase 8 integration config, Phase 9 secret controls
- Forbidden: redefining Phase 5–7/9; money posting; storing PINs; new nav

## Concrete Integration Output Schemas

Registry field lists include \`id\`, \`code\`/\`name\`, \`category\`, \`owningModule\`, plus common metadata: \`schemaVersion\`, \`tenantId\`, \`generatedAt\`, \`correlationId\`, \`environment\`, \`actorId\`.

## Canonical JSON Schema Examples

Draft 2020-12 under \`docs/schemas/\`. Schema ID convention: \`https://schemas.smiletrust.com/{domain}/{name}.schema.json\`.

## Metadata Reference Path Correction

ALL \`$ref\` to metadata MUST use canonical absolute \`$id\`:

\`https://schemas.smiletrust.com/common/metadata.schema.json\`

NO relative \`schemas/common/metadata.schema.json\`.

## Integration Migration File Checklist

Directory structure (mandatory files):

- \`manifest.json\`
- \`checksums.sha256\`
- \`schemas/common/metadata.schema.json\`
- \`schemas/integration/providers.schema.json\`
- \`data/providers.json\`
- \`data/endpoints.json\`
- \`data/webhooks.json\`
- \`README.md\`

Validated by \`validateMigrationChecklist\`.

## Migration Status Tracking Table

Fields: \`id\`, \`packageId\`, \`tenantId\`, \`status\`, \`currentSequence\`, \`checksum\`, \`createdAt\`, \`updatedAt\`, \`lastError\`.

Allowed statuses: Draft, Validated, Ready, InProgress, AwaitingConfirmation, Completed, Failed, RolledBack, Archived.

## Migration Status History Table

Immutable append-only rows: \`id\`, \`trackingId\`, \`sequence\` (+1), \`fromStatus\`, \`toStatus\`, \`actorId\`, \`note\`, \`at\`, \`immutable: true\`.

## Sample Migration Status History Rows

- **Normal:** Draft→…→Completed
- **AWC:** …→AwaitingConfirmation→Completed
- **Validation failure/rollback:** …→Failed→RolledBack
- **Archival:** …→Completed→Archived

Seeded via \`seedSampleMigrationLifecycles\`.

---

*Companion: \`docs/eiiecs-catalogs.md\`.*
`);

w("docs/eiiecs-catalogs.md", `# EIIECS Catalogs (Phase 10)

**Parent:** [enterprise-integration-interoperability.md](./enterprise-integration-interoperability.md)  
**Registry:** \`src/core/canonical-integration-registry.js\` · **Tracking:** \`phase10-migration-tracking.js\`

## Integration / Provider / Endpoint / Webhook Registries

Counts from \`EIIECS_COUNTS\`. Providers seeded from Module 28 \`SEEDED_PROVIDERS\` (MTN_MOMO, Vodafone Cash, SMS, SMTP, etc.).

## Sync / Resilience / Monitoring / Security Mapping

See SYNC-*, RES-*, MON-*, SECMAP-* in registry.

## Cross-ref Phases 1–9 / Modules 1–30

Module 28 owns hub; Module 20 facade; Phase 9 secret controls; Phase 8 rate/circuit config defaults (60/1000/5/30000).
`);

w("tests/eiiecs-consistency.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  INTEGRATIONS, PROVIDERS, ENDPOINTS, WEBHOOKS,
  validateIntegrationRegistry, EIIECS_COUNTS, METADATA_SCHEMA_ID
} from "../src/core/canonical-integration-registry.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("unique IDs and Module 28 ownership", () => {
  const v = validateIntegrationRegistry();
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.ok(EIIECS_COUNTS.providers >= 15);
  assert.ok(EIIECS_COUNTS.integrations >= 5);
  for (const i of INTEGRATIONS) assert.equal(i.owningModule, 28);
  for (const p of PROVIDERS) assert.equal(p.owningModule, 28);
  assert.equal(new Set(PROVIDERS.map((p) => p.id)).size, PROVIDERS.length);
  assert.equal(new Set(ENDPOINTS.map((e) => e.id)).size, ENDPOINTS.length);
  assert.equal(new Set(WEBHOOKS.map((w) => w.id)).size, WEBHOOKS.length);
});

test("schemas use smiletrust.com $id and absolute metadata $ref only", () => {
  assert.equal(METADATA_SCHEMA_ID, "https://schemas.smiletrust.com/common/metadata.schema.json");
  const dir = path.join(root, "docs", "schemas");
  const files = [
    "common/metadata.schema.json",
    "integration/providers.schema.json",
    "integration/endpoints.schema.json",
    "integration/webhooks.schema.json"
  ];
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const json = JSON.parse(text);
    assert.match(json.$id, /^https:\\/\\/schemas\\.smiletrust\\.com\\//);
    assert.equal(text.includes("schemas/common/metadata.schema.json"), false);
    if (f !== "common/metadata.schema.json") {
      assert.ok(text.includes(METADATA_SCHEMA_ID));
    }
  }
  const docs = fs.readFileSync(path.join(root, "docs", "enterprise-integration-interoperability.md"), "utf8");
  assert.match(docs, /Metadata Reference Path Correction/i);
  assert.match(docs, /Migration Status Tracking Table/i);
  assert.equal(fs.existsSync(path.join(root, "docs", "eiiecs-catalogs.md")), true);
});
`);

w("tests/phase10-migration-tracking.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import {
  createMigrationStore, createTrackingRecord, appendHistory,
  validateHistoryIntegrity, validateMigrationChecklist,
  seedSampleMigrationLifecycles, MANDATORY_MIGRATION_FILES
} from "../src/core/phase10-migration-tracking.js";

test("tracking/history sequence +1 append-only", () => {
  const store = createMigrationStore();
  store.tracking.push(createTrackingRecord({ id: "mig-t1", packageId: "p1" }));
  assert.equal(appendHistory(store, "mig-t1", { toStatus: "Validated" }).ok, true);
  assert.equal(appendHistory(store, "mig-t1", { toStatus: "Ready" }).ok, true);
  const bad = appendHistory(store, "mig-t1", { toStatus: "Completed" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "P10-002");
  const integrity = validateHistoryIntegrity(store, "mig-t1");
  assert.equal(integrity.ok, true);
  assert.equal(integrity.count, 2);
  assert.equal(store.history[0].immutable, true);
  assert.equal(store.history[0].sequence, 1);
  assert.equal(store.history[1].sequence, 2);
});

test("sample lifecycles and checklist", () => {
  const store = seedSampleMigrationLifecycles(createMigrationStore());
  for (const id of ["mig-normal", "mig-awc", "mig-fail", "mig-arch"]) {
    assert.equal(validateHistoryIntegrity(store, id).ok, true);
  }
  assert.equal(store.tracking.find((t) => t.id === "mig-normal").status, "Completed");
  assert.equal(store.tracking.find((t) => t.id === "mig-awc").status, "Completed");
  assert.equal(store.tracking.find((t) => t.id === "mig-fail").status, "RolledBack");
  assert.equal(store.tracking.find((t) => t.id === "mig-arch").status, "Archived");
  const miss = validateMigrationChecklist(["manifest.json"]);
  assert.equal(miss.ok, false);
  assert.ok(miss.missing.includes("checksums.sha256"));
  assert.equal(validateMigrationChecklist([...MANDATORY_MIGRATION_FILES]).ok, true);
});
`);

console.log("p10 docs/tests done");
