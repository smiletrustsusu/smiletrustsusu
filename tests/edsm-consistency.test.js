/**
 * EDSM consistency — registry integrity, stack invariants
 * (no Next.js/Compose as required primary), money invariants,
 * schemas/manifest sha256, validateStandardsRegistry critical=0.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  EDSM_VERSION,
  EDSM_DOC,
  EDSM_CATALOGS,
  MONEY_INVARIANTS,
  AUTHORITATIVE_STACK,
  REJECTED_PRIMARY_STACKS,
  ROLE_ALIASES,
  listCodingStandards,
  listNamingStandards,
  listApiStandards,
  listDbStandards,
  listUiStandards,
  listComplianceChecks,
  listStandardsOwners,
  listStackInvariants,
  getCodingStandard,
  getUiStandard,
  getStandard,
  edsmCounts,
  validateStandardsRegistry
} from "../src/core/canonical-standards-registry.js";
import {
  validateSampleCompliance,
  validateEdsmPackage,
  buildComplianceCheckResult
} from "../src/core/edsm-validation.js";

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

test("EDSM docs exist with all major sections and rejected-stack note", () => {
  assert.equal(fs.existsSync(path.join(DOCS, "enterprise-development-standards.md")), true);
  assert.equal(fs.existsSync(path.join(DOCS, "edsm-catalogs.md")), true);

  const primary = read("enterprise-development-standards.md");
  assert.match(primary, /Enterprise Development Standards Manual/i);
  assert.match(primary, /Non-goals \/ Rejected stacks/i);
  assert.match(primary, /Architecture standards/i);
  assert.match(primary, /Repository/i);
  assert.match(primary, /Database standards/i);
  assert.match(primary, /Backend \/ API|invokeApi/i);
  assert.match(primary, /Android standards \(Capacitor/i);
  assert.match(primary, /Web standards \(Vanilla JS SPA/i);
  assert.match(primary, /Windows \/ Electron/i);
  assert.match(primary, /Security standards/i);
  assert.match(primary, /UI \/ UX/i);
  assert.match(primary, /Testing standards/i);
  assert.match(primary, /Documentation standards/i);
  assert.match(primary, /Git/i);
  assert.match(primary, /DevOps/i);
  assert.match(primary, /Logging|monitoring/i);
  assert.match(primary, /Performance standards/i);
  assert.match(primary, /Accessibility|WCAG 2\.1 AA/i);
  assert.match(primary, /Coding standards/i);
  assert.match(primary, /Quality gates/i);
  assert.match(primary, /Machine-readable registries/i);
  assert.match(primary, /Acceptance criteria/i);
  assert.match(primary, /pesewas|interest 15|collection.*31|cashier.*1000/i);
  assert.match(primary, /SUPER_ADMIN_FORBIDDEN/);
  assert.match(primary, /prepare:web|www\//);
  assert.match(primary, /canonical-standards-registry/);
  assert.match(primary, /Capacitor/);
  assert.match(primary, /vanilla JS SPA|Vanilla JS SPA/i);
  assert.match(primary, /not.*Next\.js|No Next\.js|rejected.*Next/i);
  assert.match(primary, /not.*Compose|No Compose|rejected.*Compose/i);
  assert.doesNotMatch(primary, /must use Next\.js as primary|Jetpack Compose is the primary/i);

  const catalogs = read("edsm-catalogs.md");
  assert.match(catalogs, /Coding standards registry|COD-00/i);
  assert.match(catalogs, /UI standards registry|UI-00/i);
  assert.match(catalogs, /Capacitor/);
  assert.match(catalogs, /not Next\.js|vanilla JS SPA/i);
  assert.match(catalogs, /not Compose/i);
});

test("EDSM schemas Draft 2020-12, examples, manifest sha256 + constraints", () => {
  const files = [
    "coding-standard-rule.schema.json",
    "edsm-compliance-check.schema.json"
  ];
  for (const schemaFile of files) {
    const schemaPath = path.join(DOCS, "schemas", "standards", schemaFile);
    assert.equal(fs.existsSync(schemaPath), true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    assert.match(schema.$schema, /draft\/2020-12/);
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
    assert.ok(schema.required.length >= 1);
  }

  for (const rel of [
    "schemas/standards/examples/valid/coding-standard-rule.valid.json",
    "schemas/standards/examples/invalid/coding-standard-rule.invalid.json",
    "schemas/standards/examples/valid/edsm-compliance-check.valid.json",
    "schemas/standards/examples/invalid/edsm-compliance-check.invalid.json"
  ]) {
    assert.equal(fs.existsSync(path.join(DOCS, rel)), true);
    const body = JSON.parse(fs.readFileSync(path.join(DOCS, rel), "utf8"));
    if (rel.includes("invalid")) {
      assert.ok(Array.isArray(body._failureReasons) && body._failureReasons.length >= 1);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, "schemas", "manifest.json"), "utf8"));
  assert.ok(Array.isArray(manifest.phaseCoverage?.standards));
  assert.equal(manifest.phaseCoverage.standards.length, 2);

  for (const schemaFile of files) {
    const entry = (manifest.schemas || []).find((s) => String(s.path || "").includes(schemaFile));
    assert.ok(entry, `manifest must list ${schemaFile}`);
    assert.match(String(entry.sha256 || ""), /^[a-f0-9]{64}$/);
    assert.equal(entry.sha256, sha256File(`standards/${schemaFile}`));
  }

  assert.equal(manifest.constraints?.edsmDoesNotRedefinePhases1to20, true);
  assert.equal(manifest.constraints?.edsmDoesNotReplaceModules1to30, true);
  assert.equal(manifest.constraints?.edsmAuthoritativeStackIsSpaCapacitorElectron, true);
  assert.equal(manifest.constraints?.edsmRejectsNextJsAsPrimary, true);
  assert.equal(manifest.constraints?.edsmRejectsComposeAsPrimary, true);
  assert.equal(manifest.constraints?.edsmInvokeApiOpenApiFacadeOnly, true);
});

test("registry counts, list/get, owners, money + stack invariants", () => {
  assert.equal(EDSM_VERSION, "1.0.0");
  assert.equal(EDSM_DOC, "docs/enterprise-development-standards.md");
  assert.equal(EDSM_CATALOGS, "docs/edsm-catalogs.md");

  const counts = edsmCounts();
  assert.equal(counts.codingRules, 12);
  assert.equal(counts.namingRules, 10);
  assert.equal(counts.apiRules, 10);
  assert.equal(counts.dbRules, 8);
  assert.equal(counts.uiRules, 10);
  assert.equal(counts.complianceChecks, 12);
  assert.equal(counts.owners, 6);
  assert.equal(counts.stackInvariants, 8);

  assert.equal(listCodingStandards().length, 12);
  assert.equal(listNamingStandards().length, 10);
  assert.equal(listApiStandards().length, 10);
  assert.equal(listDbStandards().length, 8);
  assert.equal(listUiStandards().length, 10);
  assert.equal(listComplianceChecks().length, 12);
  assert.equal(listStandardsOwners().length, 6);
  assert.equal(listStackInvariants().length, 8);

  assert.equal(getCodingStandard("COD-003")?.code, "COD_MONEY_PESEWAS");
  assert.equal(getUiStandard("UI_NO_NEXTJS")?.id, "UI-002");
  assert.equal(getUiStandard("UI-004")?.code, "UI_NO_COMPOSE_PRIMARY");
  assert.equal(getUiStandard("UI-003")?.code, "UI_CAPACITOR_ANDROID");
  assert.equal(getStandard("API-001")?.code, "API_INVOKE_GATEWAY");

  assert.equal(MONEY_INVARIANTS.unit, "pesewas");
  assert.equal(MONEY_INVARIANTS.interestDefault, 15);
  assert.equal(MONEY_INVARIANTS.collectionDays, 31);
  assert.equal(MONEY_INVARIANTS.cashierLimitGhs, 1000);

  assert.equal(AUTHORITATIVE_STACK.web, "vanilla-js-spa");
  assert.equal(AUTHORITATIVE_STACK.android, "capacitor-shared-spa");
  assert.equal(AUTHORITATIVE_STACK.api, "invokeApi-in-process");
  assert.equal(AUTHORITATIVE_STACK.openApi, "facade-only");

  assert.ok(REJECTED_PRIMARY_STACKS.includes("Next.js"));
  assert.ok(REJECTED_PRIMARY_STACKS.some((s) => /Compose/i.test(s)));

  assert.equal(ROLE_ALIASES.Admin, "Branch Manager");
  assert.equal(ROLE_ALIASES.KBA, "Super Admin");
  assert.equal(ROLE_ALIASES.SystemOwner, "john");
});

test("stack invariants: registry must not require Next.js or Compose as primary", () => {
  const uiBlob = listUiStandards()
    .map((u) => `${u.title} ${u.rule}`)
    .join("\n")
    .toLowerCase();
  assert.match(uiBlob, /capacitor/);
  assert.match(uiBlob, /vanilla|shared.*spa|app\.js/);
  assert.match(uiBlob, /next\.js/);
  assert.match(uiBlob, /compose/);
  assert.doesNotMatch(uiBlob, /must use next\.js as primary/);
  assert.doesNotMatch(uiBlob, /compose as the primary android ui/);

  assert.ok(getUiStandard("UI-002"));
  assert.ok(getUiStandard("UI-004"));
  assert.equal(AUTHORITATIVE_STACK.web.includes("next"), false);
  assert.equal(AUTHORITATIVE_STACK.android.includes("compose"), false);
});

test("validateStandardsRegistry critical=0; sample compliance helpers", () => {
  const result = validateStandardsRegistry();
  assert.equal(result.ok, true);
  assert.equal(result.critical, 0);
  assert.equal(result.counts.codingRules, 12);

  const pass = validateSampleCompliance({
    deliveryStack: "vanilla-js-spa",
    usesInvokeApi: true,
    introducesNextJs: false,
    introducesComposePrimary: false,
    money: {
      unit: "pesewas",
      interestDefault: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000
    }
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.critical, 0);

  const failNext = validateSampleCompliance({ introducesNextJs: true });
  assert.equal(failNext.ok, false);
  assert.ok(failNext.critical >= 1);

  const failCompose = validateSampleCompliance({ introducesComposePrimary: true });
  assert.equal(failCompose.ok, false);

  const failMoney = validateSampleCompliance({
    money: { unit: "ghs", interestDefault: 15, collectionDays: 31, cashierLimitGhs: 1000 }
  });
  assert.equal(failMoney.ok, false);

  const built = buildComplianceCheckResult({ checkId: "CHK-004", status: "pass" });
  assert.equal(built.id, "CHK-004");
  assert.match(built.moneyInvariantNote, /pesewas/);
  assert.match(built.stackNote, /Capacitor|SPA/i);

  const pkg = validateEdsmPackage();
  assert.equal(pkg.ok, true);
  assert.equal(pkg.critical, 0);
});

test("Phase 20 baseline / MIB / README link EDSM when present", () => {
  const baseline = read("enterprise-implementation-baseline.md");
  assert.match(baseline, /enterprise-development-standards\.md/);

  const mib = read("master-implementation-backlog.md");
  assert.match(mib, /enterprise-development-standards\.md/);

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /enterprise-development-standards\.md/);
});
