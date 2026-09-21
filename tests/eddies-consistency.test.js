/**
 * Phase 14 EDDIES consistency — unique IDs, env set, RPO/RTO critical services,
 * Module 30 not replaced, docs sections, schemas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDDIES_VERSION,
  OPERATIONAL_MANAGER_MODULE,
  OPERATIONAL_MANAGER_REF,
  ENVIRONMENTS,
  INFRASTRUCTURE,
  PIPELINES,
  ARTIFACTS,
  DEPLOYMENTS,
  RELEASES,
  RPO_RTO_TARGETS,
  REQUIRED_ENV_CODES,
  CRITICAL_SERVICES,
  STABILIZATION_PERIODS,
  listEnvironments,
  listPipelines,
  listArtifacts,
  listRpoRtoTargets,
  getEnvironment,
  getPipeline,
  getRpoRtoTarget,
  getStabilizationMinutes,
  assertIdUniqueness,
  assertRequiredEnvironments,
  assertCriticalRpoRto,
  assertAccountableAuthorityPerTarget,
  assertSingleAccountableAuthority,
  assertPipelineArtifactRefs,
  assertModule30NotReplaced,
  validateDeploymentRegistry,
  eddiesCounts
} from "../src/core/canonical-deployment-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

test("EDDIES docs exist with Input & Dependency Rules, topology, RPO, measurement, ownership, decision rights", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-deployment-devops.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "eddies-catalogs.md")), true);
  const primary = read("enterprise-deployment-devops.md");
  assert.match(primary, /EDDIES|Enterprise Deployment/);
  assert.match(primary, /Input & Dependency Rules/);
  assert.match(primary, /Module 30/);
  assert.match(primary, /platform-ops\.js/);
  assert.match(primary, /not replaced|does not replace/i);
  assert.match(primary, /Deployment Topology|logical topology|Appendix A/i);
  assert.match(primary, /RPO & RTO Specification|Appendix B/i);
  assert.match(primary, /Recovery Target Measurement|Appendix C/i);
  assert.match(primary, /Recovery Target Ownership|Appendix D/i);
  assert.match(primary, /Accountable Authority Decision Rights|Appendix E/i);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /Capacitor|Android|Electron/i);
  assert.match(primary, /stabilization|30/);
  assert.match(primary, /Phases? 1/);

  const catalogs = read("eddies-catalogs.md");
  assert.match(catalogs, /Environment Registry|Pipeline Registry|Artifact Registry/);
  assert.match(catalogs, /RPO \/ RTO|Ownership Matrix/);
  assert.match(catalogs, /Module 30/);
  assert.match(catalogs, /Cross-reference|Phase/);
  assert.match(catalogs, /ENV-00|PIPE-00|RRT-00/);
  assert.match(catalogs, /DEV|QA|UAT|STAGING|PRODUCTION|DR/);
});

test("optional deployment schemas exist with absolute $id and metadata $ref", () => {
  const schemaDir = path.join(DOCS, "schemas", "deployment");
  for (const file of [
    "environment.schema.json",
    "pipeline.schema.json",
    "artifact.schema.json",
    "rpo-rto-target.schema.json"
  ]) {
    const full = path.join(schemaDir, file);
    assert.equal(fs.existsSync(full), true, file);
    const json = JSON.parse(fs.readFileSync(full, "utf8"));
    assert.match(json.$id, /^https:\/\/schemas\.smiletrust\.com\/deployment\//);
    assert.equal(
      json.properties.metadata.$ref,
      "https://schemas.smiletrust.com/common/metadata.schema.json"
    );
  }
});

test("registry unique IDs, helpers, required envs, critical RPO/RTO, one accountableAuthority", () => {
  assert.equal(EDDIES_VERSION, "1.0.0");
  assert.equal(OPERATIONAL_MANAGER_MODULE, 30);
  assert.match(OPERATIONAL_MANAGER_REF, /platform-ops\.js/);

  const unique = assertIdUniqueness();
  assert.equal(unique.ok, true, unique.message);
  const envs = assertRequiredEnvironments();
  assert.equal(envs.ok, true, envs.message);
  const rrt = assertCriticalRpoRto();
  assert.equal(rrt.ok, true, rrt.message);
  const aa = assertAccountableAuthorityPerTarget();
  assert.equal(aa.ok, true, aa.message);
  const refs = assertPipelineArtifactRefs();
  assert.equal(refs.ok, true, refs.message);

  const result = validateDeploymentRegistry();
  assert.equal(result.ok, true, (result.errors || []).join("; "));

  assert.equal(listEnvironments().length, ENVIRONMENTS.length);
  assert.equal(listPipelines().length, PIPELINES.length);
  assert.equal(listArtifacts().length, ARTIFACTS.length);
  assert.equal(listRpoRtoTargets().length, RPO_RTO_TARGETS.length);

  assert.ok(getEnvironment("ENV-005"));
  assert.ok(getEnvironment("PRODUCTION"));
  assert.ok(getPipeline("PIPE-002"));
  assert.ok(getRpoRtoTarget("RRT-001"));
  assert.ok(getRpoRtoTarget("RPO_RTO_DATABASE"));

  for (const code of REQUIRED_ENV_CODES) {
    assert.ok(getEnvironment(code), code);
  }

  for (const entry of [
    ...ENVIRONMENTS,
    ...INFRASTRUCTURE,
    ...PIPELINES,
    ...ARTIFACTS,
    ...DEPLOYMENTS,
    ...RELEASES,
    ...RPO_RTO_TARGETS
  ]) {
    const own = assertSingleAccountableAuthority(entry);
    assert.equal(own.ok, true, own.message);
  }

  const services = new Set(RPO_RTO_TARGETS.map((t) => t.service));
  for (const svc of CRITICAL_SERVICES) {
    assert.ok(services.has(svc), svc);
  }

  assert.equal(STABILIZATION_PERIODS.production.minutes, 30);
  assert.equal(getStabilizationMinutes("production"), 30);
  assert.equal(getStabilizationMinutes("ENV-005"), 30);
  assert.equal(getEnvironment("PRODUCTION").stabilizationMinutes, 30);
});

test("Module 30 referenced as operational manager and not replaced; seed themes present", () => {
  const engine = assertModule30NotReplaced();
  assert.equal(engine.ok, true);
  assert.equal(engine.replaced, false);
  assert.equal(engine.postsMoney, false);
  assert.equal(engine.newNav, false);
  assert.equal(engine.rbacRewrite, false);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core", "platform-ops.js")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core", "backup-recovery-ops.js")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "scripts", "prepare-web.js")), true);

  const codes = new Set([
    ...ENVIRONMENTS.map((e) => e.code),
    ...PIPELINES.map((p) => p.code),
    ...ARTIFACTS.map((a) => a.code)
  ]);
  assert.ok(codes.has("DEV"));
  assert.ok(codes.has("QA"));
  assert.ok(codes.has("UAT"));
  assert.ok(codes.has("STAGING"));
  assert.ok(codes.has("PRODUCTION"));
  assert.ok(codes.has("DR"));
  assert.ok(codes.has("PREPARE_WEB"));
  assert.ok(codes.has("WWW_SPA_BUNDLE"));
  assert.ok(codes.has("ANDROID_APK"));
  assert.ok(codes.has("ELECTRON_EXE"));
});

test("eddiesCounts match seeded catalog sizes", () => {
  const counts = eddiesCounts();
  assert.equal(counts.environments, 6);
  assert.equal(counts.infrastructure, 6);
  assert.equal(counts.pipelines, 7);
  assert.equal(counts.artifacts, 6);
  assert.equal(counts.deployments, 5);
  assert.equal(counts.releases, 4);
  assert.equal(counts.rpoRtoTargets, 6);
});
