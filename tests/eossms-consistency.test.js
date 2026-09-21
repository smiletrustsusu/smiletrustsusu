/**
 * Phase 18 EOSSMS consistency — unique IDs, ownership, offline runbooks,
 * collector message coverage, cross-phase refs, schemas, modules not replaced.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EOSSMS_VERSION,
  SYNC_MODULE,
  MONITORING_MODULE,
  BACKUP_ENGINE_MODULE,
  PLATFORM_MODULE,
  JOB_ENGINE_MODULE,
  PHASE13_DASHBOARD_REFRESH,
  COLLECTOR_STATUSES,
  OFFLINE_MODES,
  SYNC_WORKFLOW_STAGES,
  SERVICE_CATALOG,
  INCIDENT_SLAS,
  SERVICE_REQUEST_TYPES,
  RUNBOOKS,
  OPS_KPIS,
  COLLECTOR_STATUS_MESSAGES,
  listServices,
  listIncidentSlas,
  listRunbooks,
  listOpsKpis,
  listCollectorStatusMessages,
  listOfflineRunbooks,
  getService,
  getEscalationThreshold,
  assertIdUniqueness,
  assertSingleOwnerPerEntry,
  assertSingleOwnerPerProcess,
  assertRefsResolve,
  assertOfflineRunbookCompleteness,
  assertCollectorMessageCoverage,
  assertEscalationThresholdsAlign,
  assertCrossPhaseConsistency,
  assertModulesNotReplaced,
  validateOperationsRegistry,
  eossmsCounts
} from "../src/core/canonical-operations-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function sha256File(relPath) {
  const buf = fs.readFileSync(path.join(DOCS, "schemas", relPath));
  return crypto.createHash("sha256").update(buf).digest("hex");
}

test("EOSSMS docs exist with service desk, incidents, offline appendices", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-operations-support.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "eossms-catalogs.md")), true);
  const primary = read("enterprise-operations-support.md");
  assert.match(primary, /EOSSMS|Enterprise Operations/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Service (management|catalog|desk)/i);
  assert.match(primary, /Incident/);
  assert.match(primary, /Major incident/i);
  assert.match(primary, /Problem management/i);
  assert.match(primary, /Service request/i);
  assert.match(primary, /Knowledge/);
  assert.match(primary, /[Rr]unbook/);
  assert.match(primary, /On-call/i);
  assert.match(primary, /MTTA|MTTR|FCR|CSAT/);
  assert.match(primary, /Governance/);
  assert.match(primary, /Cross-reference/);
  assert.match(primary, /Appendix A/i);
  assert.match(primary, /Appendix B/i);
  assert.match(primary, /Appendix C/i);
  assert.match(primary, /Online|Offline|Synchronizing|Recovery|Read-?Only/);
  assert.match(primary, /13-stage|13 stage/i);
  assert.match(primary, /4\s*h|4h/);
  assert.match(primary, /24\s*h|24h/);
  assert.match(primary, /1000/);
  assert.match(primary, /99%/);
  assert.match(primary, /Module 15/);
  assert.match(primary, /Phase 13/);
  assert.match(primary, /not redefined|does not redefine|Consumed/i);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /prepare:web|www\//);

  const catalogs = read("eossms-catalogs.md");
  assert.match(catalogs, /Service Catalog|Incident|Runbook|KPI/i);
  assert.match(catalogs, /SVC-00|SEV-00|RB-0|OKPI-00/);
  assert.match(catalogs, /Module 15|Phase 13/);
  assert.match(catalogs, /Cross-reference/);
});

test("operations schemas exist, Draft 2020-12, additionalProperties false, examples + manifest", () => {
  const files = [
    "incident-ticket.schema.json",
    "sync-event.schema.json",
    "service-request.schema.json"
  ];
  for (const f of files) {
    const p = path.join(DOCS, "schemas", "operations", f);
    assert.equal(fs.existsSync(p), true);
    const schema = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.equal(schema.$id, `https://schemas.smiletrust.com/operations/${f}`);
    assert.match(schema.$schema, /draft\/2020-12/);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.$defs);
  }

  for (const rel of [
    "schemas/operations/examples/valid/incident-ticket.valid.json",
    "schemas/operations/examples/invalid/incident-ticket.invalid.json",
    "schemas/operations/examples/valid/sync-event.valid.json",
    "schemas/operations/examples/invalid/sync-event.invalid.json",
    "schemas/operations/examples/valid/service-request.valid.json",
    "schemas/operations/examples/invalid/service-request.invalid.json"
  ]) {
    const p = path.join(DOCS, rel);
    assert.equal(fs.existsSync(p), true);
    const body = JSON.parse(fs.readFileSync(p, "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const syncSchema = JSON.parse(
    fs.readFileSync(path.join(DOCS, "schemas", "operations", "sync-event.schema.json"), "utf8")
  );
  const statusEnum = syncSchema.$defs.offlineMode.enum;
  for (const mode of ["Online", "Offline", "Synchronizing", "Recovery", "ReadOnly"]) {
    assert.ok(statusEnum.includes(mode), `offlineMode must include ${mode}`);
  }
  const collectorEnum = syncSchema.$defs.collectorStatus.enum;
  assert.equal(collectorEnum.length, 6);

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase18));
  assert.equal(manifest.phaseCoverage.phase18.length, 3);
  for (const schemaFile of files) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.phase, 18);
    assert.equal(entry.sha256, sha256File(`operations/${schemaFile}`));
  }
  assert.equal(manifest.constraints?.phase18DoesNotRedefinePhase13Monitoring, true);
  assert.equal(manifest.constraints?.phase18DoesNotRedefinePhase14Deployment, true);
  assert.equal(manifest.constraints?.phase18DoesNotRedefinePhase15Bcdr, true);
  assert.equal(manifest.constraints?.phase18DoesNotRedefinePhase16Testing, true);
  assert.equal(manifest.constraints?.phase18DoesNotRedefinePhase17Performance, true);
  assert.equal(manifest.constraints?.phase18DoesNotReplaceModule15, true);
  assert.equal(manifest.constraints?.phase18DoesNotReplaceModule19, true);
});

test("registry unique IDs, ownership, offline coverage, escalation alignment", () => {
  assert.equal(EOSSMS_VERSION, "1.0.0");
  assert.equal(SYNC_MODULE, 15);
  assert.equal(MONITORING_MODULE, 19);
  assert.equal(BACKUP_ENGINE_MODULE, 21);
  assert.equal(PLATFORM_MODULE, 30);
  assert.equal(JOB_ENGINE_MODULE, 18);
  assert.equal(PHASE13_DASHBOARD_REFRESH.syncHealthPanelSeconds, 60);
  assert.equal(PHASE13_DASHBOARD_REFRESH.deviceOfflinePanelSeconds, 60);
  assert.equal(OFFLINE_MODES.length, 5);
  assert.equal(COLLECTOR_STATUSES.length, 6);
  assert.equal(SYNC_WORKFLOW_STAGES.length, 13);

  const uniq = assertIdUniqueness();
  assert.equal(uniq.ok, true);
  const own = assertSingleOwnerPerEntry();
  assert.equal(own.ok, true);
  const proc = assertSingleOwnerPerProcess();
  assert.equal(proc.ok, true);
  const refs = assertRefsResolve();
  assert.equal(refs.ok, true, refs.errors ? refs.errors.join("; ") : refs.message);
  const rb = assertOfflineRunbookCompleteness();
  assert.equal(rb.ok, true, rb.errors ? rb.errors.join("; ") : rb.message);
  const csm = assertCollectorMessageCoverage();
  assert.equal(csm.ok, true, csm.missing ? csm.missing.join("; ") : csm.message);
  const esc = assertEscalationThresholdsAlign();
  assert.equal(esc.ok, true, esc.errors ? esc.errors.join("; ") : esc.message);
  const xp = assertCrossPhaseConsistency();
  assert.equal(xp.ok, true, xp.errors ? xp.errors.join("; ") : xp.message);
  const mods = assertModulesNotReplaced();
  assert.equal(mods.ok, true);
  assert.equal(mods.syncModule, 15);

  const validated = validateOperationsRegistry();
  assert.equal(
    validated.ok,
    true,
    validated.errors ? validated.errors.join("; ") : validated.message
  );

  const counts = eossmsCounts();
  assert.equal(counts.services, 18);
  assert.equal(counts.incidentSlas, 4);
  assert.equal(counts.serviceRequests, 8);
  assert.equal(counts.runbooks, 12);
  assert.equal(counts.offlineRunbooks, 4);
  assert.equal(counts.kpis, 10);
  assert.equal(counts.collectorStatuses, 6);
  assert.equal(counts.syncWorkflowStages, 13);
  assert.equal(listServices().length, SERVICE_CATALOG.length);
  assert.equal(listIncidentSlas().length, INCIDENT_SLAS.length);
  assert.equal(listRunbooks().length, RUNBOOKS.length);
  assert.equal(listOpsKpis().length, OPS_KPIS.length);
  assert.equal(listCollectorStatusMessages().length, COLLECTOR_STATUS_MESSAGES.length);
  assert.equal(listOfflineRunbooks().length, 4);

  const syncSvc = getService("SVC-007");
  assert.equal(syncSvc.owningModule, 15);
  assert.equal(getEscalationThreshold("ESC-001").thresholdValue, 4);
  assert.equal(getEscalationThreshold("ESC-002").thresholdValue, 24);
  assert.equal(getEscalationThreshold("ESC-003").thresholdValue, 1000);
  assert.equal(getEscalationThreshold("ESC-004").thresholdValue, 99);

  for (const status of COLLECTOR_STATUSES) {
    assert.ok(
      COLLECTOR_STATUS_MESSAGES.some((m) => m.status === status),
      `missing message for ${status}`
    );
  }
});
