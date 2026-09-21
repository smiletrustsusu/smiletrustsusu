/**
 * Phase 12 — AI Capability Registry, governance/audit schemas, identifier SoD.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_CAPABILITY_REGISTRY,
  AI_CAP_001,
  AI_CAPABILITY_REGISTRY_VERSION,
  listAiCapabilities,
  getAiCapability,
  assertAiCapabilityIdUnique,
  validateAiCapabilityEntry,
  assertAiCapabilityRegistryIntegrity,
  assertCanonicalAiRegistryBoundary
} from "../src/core/canonical-ai-registry.js";
import {
  ID_FORMATS,
  IDENTIFIER_OWNERSHIP_MATRIX,
  IDENTIFIER_GENERATION_RULES,
  validateIdentifierFormat,
  validateAllCapabilityIdentifiers,
  nextSequentialId,
  assertSingleAccountableAuthority,
  clarifyAuthorityVsResponsibility,
  assertSegregationOfDuties,
  assertGovernanceConditionals,
  assertAuditBlock,
  validateCapabilityGovernanceBundle,
  listOwnershipMatrix
} from "../src/core/phase12-identifier-governance.js";
import {
  P12_SECTIONS,
  createPhase12Envelope,
  markSectionComplete,
  allSectionsComplete,
  listPhase12Sections
} from "../src/core/phase12-document-envelope.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMAS = path.join(ROOT, "docs", "schemas");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMAS, rel), "utf8"));
}

function schemaExists(rel) {
  return fs.existsSync(path.join(SCHEMAS, rel));
}

test("schemas package exists with smiletrust.com $ids (no placeholders)", () => {
  assert.equal(schemaExists("manifest.json"), true);
  const manifest = readJson("manifest.json");
  assert.equal(manifest.baseUri, "https://schemas.smiletrust.com");
  assert.ok(manifest.schemas.length >= 9);

  const required = [
    ["common/metadata.schema.json", "https://schemas.smiletrust.com/common/metadata.schema.json"],
    ["common/identifiers.schema.json", "https://schemas.smiletrust.com/common/identifiers.schema.json"],
    ["common/classification.schema.json", "https://schemas.smiletrust.com/common/classification.schema.json"],
    ["common/module-ref.schema.json", "https://schemas.smiletrust.com/common/module-ref.schema.json"],
    ["envelope/document-envelope.schema.json", "https://schemas.smiletrust.com/envelope/document-envelope.schema.json"],
    ["envelope/section-envelope.schema.json", "https://schemas.smiletrust.com/envelope/section-envelope.schema.json"],
    ["ai/ai-capability-registry.schema.json", "https://schemas.smiletrust.com/ai/ai-capability-registry.schema.json"],
    ["ai/governance.schema.json", "https://schemas.smiletrust.com/ai/governance.schema.json"],
    ["ai/audit.schema.json", "https://schemas.smiletrust.com/ai/audit.schema.json"]
  ];

  for (const [rel, id] of required) {
    assert.equal(schemaExists(rel), true, `missing ${rel}`);
    const schema = readJson(rel);
    assert.equal(schema.$id, id);
    assert.equal(String(schema.$id).includes("schemas.smiletrust.com"), true);
    assert.equal(/placeholder|TODO|TBD/i.test(JSON.stringify(schema)), false);
  }

  const capSchema = readJson("ai/ai-capability-registry.schema.json");
  assert.equal(capSchema.properties.id.pattern, "^AI-CAP-[0-9]{3}$");
  assert.equal(
    capSchema.properties.metadata.$ref,
    "https://schemas.smiletrust.com/common/metadata.schema.json"
  );
  assert.equal(
    capSchema.properties.governance.$ref,
    "https://schemas.smiletrust.com/ai/governance.schema.json"
  );
  assert.equal(
    capSchema.properties.audit.$ref,
    "https://schemas.smiletrust.com/ai/audit.schema.json"
  );
});

test("governance schema requires exceptionApprovalAuthority conditionally", () => {
  const gov = readJson("ai/governance.schema.json");
  assert.ok(Array.isArray(gov.allOf) && gov.allOf.length >= 1);
  const branch = gov.allOf[0];
  assert.ok(branch.if);
  assert.ok(branch.then);
  assert.ok(branch.then.required.includes("exceptionApprovalAuthority"));

  assert.equal(assertGovernanceConditionals({
    riskClass: "High",
    exceptionRequired: false,
    humanOversightRequired: true,
    sodProfile: {
      approverMustDifferFromAuditor: true,
      developerMustDifferFromValidator: true
    }
  }).ok, true);

  const needs = assertGovernanceConditionals({
    riskClass: "Critical",
    exceptionRequired: false,
    humanOversightRequired: true,
    sodProfile: {
      approverMustDifferFromAuditor: true,
      developerMustDifferFromValidator: true
    }
  });
  assert.equal(needs.ok, false);
  assert.ok(needs.errors.some((e) => e.path === "exceptionApprovalAuthority"));

  const withEx = assertGovernanceConditionals({
    riskClass: "Critical",
    exceptionRequired: true,
    exceptionApprovalAuthority: "SystemOwner",
    humanOversightRequired: true,
    sodProfile: {
      approverMustDifferFromAuditor: true,
      developerMustDifferFromValidator: true
    }
  });
  assert.equal(withEx.ok, true);

  const exExample = readJson("examples/governance-exception-example.json");
  assert.equal(exExample.exceptionRequired, true);
  assert.ok(exExample.exceptionApprovalAuthority);
});

test("AI-CAP-001 example structure and relatedModules 8 + 29", () => {
  const example = readJson("examples/ai-cap-001-loan-default-prediction.json");
  assert.equal(example.id, "AI-CAP-001");
  assert.equal(example.code, "LOAN_DEFAULT_PREDICTION");
  assert.equal(example.decisionMode, "advisory");
  assert.equal(example.humanReviewRequired, true);
  assert.equal(example.autoExecuteAllowed, false);
  assert.equal(example.canPostMoney, false);
  assert.equal(example.canApproveLoans, false);
  assert.equal(example.replacesRuleEngine, false);
  assert.equal(example.owningModule, 29);
  assert.deepEqual(example.relatedModules.slice().sort((a, b) => a - b), [8, 29]);
  assert.equal(example.relatedModules.includes(30), false);
  assert.equal(example.accountableAuthority, "Risk Manager");
  assert.equal(example.governance.accountableAuthority, "Risk Manager");
  assert.equal(example.governance.approvingAuthority, "Model Validator");
  assert.equal(example.audit.auditor, "Internal Auditor");
  assert.equal(example.crossReferences.ruleEngineModule, 24);
  assert.match(example.metadata.checksum, /^[a-f0-9]{64}$/);
});

test("canonical registry seeds AI-CAP-001 uniquely with advisory flags", () => {
  assert.equal(AI_CAPABILITY_REGISTRY_VERSION, "1.0.0");
  assert.equal(AI_CAPABILITY_REGISTRY.length, 1);
  assert.equal(AI_CAP_001.id, "AI-CAP-001");
  assert.equal(AI_CAP_001.humanReviewRequired, true);
  assert.equal(AI_CAP_001.decisionMode, "advisory");
  assert.deepEqual([...AI_CAP_001.relatedModules].sort((a, b) => a - b), [8, 29]);

  const unique = assertAiCapabilityIdUnique();
  assert.equal(unique.ok, true);
  assert.equal(unique.count, 1);

  const dup = assertAiCapabilityIdUnique([AI_CAP_001, { ...AI_CAP_001 }]);
  assert.equal(dup.ok, false);

  assert.equal(getAiCapability("AI-CAP-001").code, "LOAN_DEFAULT_PREDICTION");
  assert.equal(getAiCapability("LOAN_DEFAULT_PREDICTION").id, "AI-CAP-001");
  assert.equal(listAiCapabilities().length, 1);

  const integrity = assertAiCapabilityRegistryIntegrity();
  assert.equal(integrity.ok, true);

  const boundary = assertCanonicalAiRegistryBoundary();
  assert.equal(boundary.advisory, true);
  assert.equal(boundary.postsCollections, false);
  assert.equal(boundary.autoApprovesLoans, false);
  assert.equal(boundary.replacesRuleEngine, false);
  assert.equal(boundary.ruleEngineModule, 24);
  assert.equal(boundary.owningModule, 29);
  assert.equal(boundary.platformModuleNotOwner, 30);

  const bad = validateAiCapabilityEntry({
    ...AI_CAP_001,
    decisionMode: "autonomous",
    humanReviewRequired: false,
    owningModule: 30
  });
  assert.equal(bad.ok, false);
});

test("identifier formats, generation, and ownership matrix", () => {
  assert.equal(validateIdentifierFormat("capabilityId", "AI-CAP-001").ok, true);
  assert.equal(validateIdentifierFormat("capabilityId", "AI-CAP-1").ok, false);
  assert.equal(validateIdentifierFormat("capabilityCode", "LOAN_DEFAULT_PREDICTION").ok, true);
  assert.equal(validateIdentifierFormat("governanceId", "AI-GOV-001").ok, true);
  assert.equal(validateIdentifierFormat("auditId", "AI-AUD-001").ok, true);
  assert.equal(validateIdentifierFormat("envelopeId", "ENV-012").ok, true);
  assert.ok(ID_FORMATS.capabilityId.pattern.test("AI-CAP-099"));

  assert.equal(nextSequentialId("AI-CAP", ["AI-CAP-001", "AI-CAP-002"]), "AI-CAP-003");
  assert.equal(IDENTIFIER_GENERATION_RULES.capabilityId.reuseAfterRetire, false);
  assert.ok(IDENTIFIER_OWNERSHIP_MATRIX.length >= 5);
  assert.ok(listOwnershipMatrix().some((r) => r.kind === "AI Capability ID"));

  const loanRow = IDENTIFIER_OWNERSHIP_MATRIX.find((r) => r.kind === "AI Capability ID");
  assert.ok(loanRow.mayNotMint.includes("Module 30"));
  assert.ok(loanRow.mayNotMint.includes("Module 24"));

  assert.equal(validateAllCapabilityIdentifiers(AI_CAP_001).ok, true);
});

test("exactly one accountableAuthority and SoD approve≠audit", () => {
  assert.equal(assertSingleAccountableAuthority(AI_CAP_001).ok, true);

  assert.equal(assertSingleAccountableAuthority({
    accountableAuthority: ["Risk Manager", "Compliance"]
  }).ok, false);

  assert.equal(assertSingleAccountableAuthority({
    accountableAuthority: "Risk Manager, Compliance"
  }).ok, false);

  assert.equal(assertSingleAccountableAuthority({
    accountableAuthority: "Risk Manager",
    governance: { accountableAuthority: "Compliance" }
  }).ok, false);

  const sodOk = assertSegregationOfDuties({
    approvingAuthority: "Model Validator",
    auditor: "Internal Auditor",
    responsibleParty: "ML Engineer",
    accountableAuthority: "Risk Manager",
    developer: "ML Engineer",
    validator: "Model Validator"
  });
  assert.equal(sodOk.ok, true);

  const sodBad = assertSegregationOfDuties({
    approvingAuthority: "Internal Auditor",
    auditor: "Internal Auditor"
  });
  assert.equal(sodBad.ok, false);
  assert.ok(sodBad.errors.some((e) => e.code === "P12-SOD-001"));

  assert.equal(assertAuditBlock(AI_CAP_001.audit, "Model Validator").ok, true);
  assert.equal(assertAuditBlock({
    ...AI_CAP_001.audit,
    auditor: "Model Validator"
  }, "Model Validator").ok, false);

  const bundle = validateCapabilityGovernanceBundle(AI_CAP_001);
  assert.equal(bundle.ok, true);

  const roles = clarifyAuthorityVsResponsibility({
    accountableAuthority: "Risk Manager",
    responsibleParty: "ML Engineer",
    approvingAuthority: "Model Validator",
    auditor: "Internal Auditor"
  });
  assert.equal(roles.accountableAuthority, "Risk Manager");
  assert.ok(roles.rules.length >= 4);
});

test("phase12 document envelope and EAIADIS doc exist", () => {
  assert.equal(listPhase12Sections().length, 10);
  assert.equal(P12_SECTIONS[0].code, "P12-CAPABILITY_REGISTRY");

  const created = createPhase12Envelope({
    primaryOwner: "AI Platform Admin",
    accountableAuthority: "Risk Manager",
    approver: "Model Validator",
    auditor: "Internal Auditor"
  });
  assert.equal(created.ok, true);

  const sodEnv = createPhase12Envelope({
    primaryOwner: "AI Platform Admin",
    accountableAuthority: "Risk Manager",
    approver: "Same Person",
    auditor: "Same Person"
  });
  assert.equal(sodEnv.ok, false);

  for (const section of P12_SECTIONS) {
    const r = markSectionComplete(created.envelope, section.code, { actor: "tester" });
    assert.equal(r.ok, true);
  }
  assert.equal(allSectionsComplete(created.envelope), true);

  const docPath = path.join(ROOT, "docs", "enterprise-ai-automation-decision.md");
  assert.equal(fs.existsSync(docPath), true);
  const doc = fs.readFileSync(docPath, "utf8");
  assert.match(doc, /AI Capability Registry Specification/);
  assert.match(doc, /Accountable Authority Consistency/);
  assert.match(doc, /AI-CAP-001/);
  assert.match(doc, /exceptionApprovalAuthority/);
});

test("schema file count and capability count summary invariants", () => {
  const manifest = readJson("manifest.json");
  assert.ok(manifest.schemas.length >= 9, "foundation + phase12 schemas present");
  assert.equal(
    manifest.schemas.length,
    32,
    "phase12 (9) + phase13 monitoring (4) + phase15 BC (1) + phase16 testing (2) + phase17 performance (3) + phase18 operations (3) + phase19 governance (3) + phase20 baseline (3) + backlog (1) + roadmap (1) + standards (2)"
  );
  assert.ok(Array.isArray(manifest.phaseCoverage?.backlog));
  assert.equal(manifest.phaseCoverage.backlog.length, 1);
  assert.ok(Array.isArray(manifest.phaseCoverage?.roadmap));
  assert.equal(manifest.phaseCoverage.roadmap.length, 1);
  assert.ok(Array.isArray(manifest.phaseCoverage?.standards));
  assert.equal(manifest.phaseCoverage.standards.length, 2);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase13));
  assert.equal(manifest.phaseCoverage.phase13.length, 4);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase15));
  assert.equal(manifest.phaseCoverage.phase15.length, 1);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase16));
  assert.equal(manifest.phaseCoverage.phase16.length, 2);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase17));
  assert.equal(manifest.phaseCoverage.phase17.length, 3);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase18));
  assert.equal(manifest.phaseCoverage.phase18.length, 3);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase19));
  assert.equal(manifest.phaseCoverage.phase19.length, 3);
  assert.ok(Array.isArray(manifest.phaseCoverage?.phase20));
  assert.equal(manifest.phaseCoverage.phase20.length, 3);
  assert.equal(AI_CAPABILITY_REGISTRY.length, 1);
  assert.ok(schemaExists("examples/ai-cap-001-loan-default-prediction.json"));
  assert.ok(schemaExists("examples/governance-example.json"));
  assert.ok(schemaExists("examples/audit-example.json"));
  assert.ok(schemaExists("monitoring/metric.schema.json"));
  assert.ok(schemaExists("business-continuity/rpo-rto-breach-report.schema.json"));
  assert.ok(schemaExists("testing/quality-gate-result.schema.json"));
  assert.ok(schemaExists("testing/release-certification.schema.json"));
  assert.ok(schemaExists("performance/workload-profile.schema.json"));
  assert.ok(schemaExists("performance/capacity-forecast.schema.json"));
  assert.ok(schemaExists("performance/performance-benchmark-result.schema.json"));
  assert.ok(schemaExists("operations/incident-ticket.schema.json"));
  assert.ok(schemaExists("operations/sync-event.schema.json"));
  assert.ok(schemaExists("operations/service-request.schema.json"));
  assert.ok(schemaExists("governance/change-request.schema.json"));
  assert.ok(schemaExists("governance/configuration-item.schema.json"));
  assert.ok(schemaExists("governance/release-record.schema.json"));
  assert.ok(schemaExists("baseline/enterprise-baseline-artifact.schema.json"));
  assert.ok(schemaExists("baseline/production-readiness-result.schema.json"));
  assert.ok(schemaExists("baseline/enterprise-certification.schema.json"));
});
