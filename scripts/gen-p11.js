/**
 * Phase 11 ERABIKS — reporting registry, docs, tests
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body, "utf8");
  console.log("wrote", rel);
};

w("src/core/canonical-reporting-registry.js", `/**
 * Phase 11 — Enterprise Reporting, Analytics, BI & KPI (ERABIKS).
 * Catalog only. Engines: Module 27 bi-ops.js, Module 11 report-ops.
 * Does not replace Module 27 or change money posting. Defaults 15/31/1000 unchanged.
 */

export const ERABIKS_VERSION = "1.0.0";
export const ERABIKS_STATUS = "Authoritative";

function roundHalfUp(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function metric(p) {
  return Object.freeze({
    id: p.id,
    code: p.code,
    name: p.name,
    owningModule: p.owningModule || 27,
    unit: p.unit || "Count",
    version: "1.0.0"
  });
}

function kpi(p) {
  return Object.freeze({
    id: p.id,
    code: p.code,
    name: p.name,
    module27Code: p.module27Code || null,
    formula: p.formula,
    formulaFields: Object.freeze([...(p.formulaFields || [])]),
    unitOfMeasure: p.unitOfMeasure || "Percent",
    roundingRule: "RoundHalfUp",
    roundingDigits: 2,
    nullPolicy: p.nullPolicy || "fail",
    divideByZeroPolicy: p.divideByZeroPolicy || "N/A",
    currency: p.currency || "GHS",
    qualityDimensions: Object.freeze([...(p.qualityDimensions || ["completeness", "accuracy", "timeliness"])]),
    qualityThreshold: p.qualityThreshold ?? 0.95,
    owningModule: 27,
    reportModule: 11,
    version: "1.0.0",
    workedExample: p.workedExample ? Object.freeze({ ...p.workedExample }) : null
  });
}

export const METRICS = Object.freeze([
  metric({ id: "MET-RPT-SAV-001", code: "MET-SAV-001", name: "Collections received" }),
  metric({ id: "MET-RPT-SAV-002", code: "MET-SAV-002", name: "Collections expected" }),
  metric({ id: "MET-RPT-CUS-003", code: "MET-CUS-003", name: "Active customers" }),
  metric({ id: "MET-RPT-CUS-004", code: "MET-CUS-004", name: "Registered customers" }),
  metric({ id: "MET-RPT-LOAN-001", code: "MET-LOAN-001", name: "Repayments posted" }),
  metric({ id: "MET-RPT-LOAN-002", code: "MET-LOAN-002", name: "Repayments due" }),
  metric({ id: "MET-RPT-LOAN-DEF", code: "MET-LOAN-DEF", name: "Defaulted loans count" }),
  metric({ id: "MET-RPT-LOAN-OUT", code: "MET-LOAN-OUT", name: "Outstanding loans count" }),
  metric({ id: "MET-RPT-CASH-COL", code: "MET-CASH-COL", name: "Cash collected GHS" }),
  metric({ id: "MET-RPT-CASH-EXP", code: "MET-CASH-EXP", name: "Cash expected GHS" }),
  metric({ id: "MET-RPT-BR-CUR", code: "MET-BR-CUR", name: "Branch members current" }),
  metric({ id: "MET-RPT-BR-PRIOR", code: "MET-BR-PRIOR", name: "Branch members prior" }),
  metric({ id: "MET-RPT-MON-001", code: "MET-MON-001", name: "Scheduled service minutes" }),
  metric({ id: "MET-RPT-MON-002", code: "MET-MON-002", name: "Unplanned downtime minutes" })
]);

export const KPIS = Object.freeze([
  kpi({
    id: "KPI-001",
    code: "KPI-001",
    name: "Daily Collection Success Rate",
    module27Code: "KPI-COL-RATE",
    formula: "(successfulCollections / expectedCollections) * 100",
    formulaFields: ["successfulCollections", "expectedCollections"],
    workedExample: { inputs: { successfulCollections: 190, expectedCollections: 200 }, expected: 95.0 }
  }),
  kpi({
    id: "KPI-002",
    code: "KPI-002",
    name: "Active Savings Account Rate",
    module27Code: "KPI-ACTIVE-MEM",
    formula: "(activeAccounts / totalAccounts) * 100",
    formulaFields: ["activeAccounts", "totalAccounts"],
    workedExample: { inputs: { activeAccounts: 480, totalAccounts: 500 }, expected: 96.0 }
  }),
  kpi({
    id: "KPI-003",
    code: "KPI-003",
    name: "Loan Repayment Rate",
    module27Code: "KPI-LOAN-REC",
    formula: "(repaymentsPosted / repaymentsDue) * 100",
    formulaFields: ["repaymentsPosted", "repaymentsDue"],
    workedExample: { inputs: { repaymentsPosted: 190, repaymentsDue: 200 }, expected: 95.0 }
  }),
  kpi({
    id: "KPI-004",
    code: "KPI-004",
    name: "Loan Default Rate",
    module27Code: null,
    formula: "(defaultedLoans / outstandingLoans) * 100",
    formulaFields: ["defaultedLoans", "outstandingLoans"],
    workedExample: { inputs: { defaultedLoans: 15, outstandingLoans: 400 }, expected: 3.75 }
  }),
  kpi({
    id: "KPI-005",
    code: "KPI-005",
    name: "Cash Collection Efficiency",
    module27Code: "KPI-COL-PROD",
    formula: "(cashCollected / cashExpected) * 100",
    formulaFields: ["cashCollected", "cashExpected"],
    workedExample: { inputs: { cashCollected: 9800, cashExpected: 10000 }, expected: 98.0 }
  }),
  kpi({
    id: "KPI-006",
    code: "KPI-006",
    name: "Branch Growth Rate",
    module27Code: "KPI-CUS-GROWTH",
    formula: "((currentMembers - priorMembers) / priorMembers) * 100",
    formulaFields: ["currentMembers", "priorMembers"],
    workedExample: { inputs: { currentMembers: 90, priorMembers: 80 }, expected: 12.5 }
  }),
  kpi({
    id: "KPI-007",
    code: "KPI-007",
    name: "System Availability",
    module27Code: "KPI-SYS-AVAIL",
    formula: "((scheduledMinutes - downtimeMinutes) / scheduledMinutes) * 100",
    formulaFields: ["scheduledMinutes", "downtimeMinutes"],
    workedExample: { inputs: { scheduledMinutes: 1000, downtimeMinutes: 2 }, expected: 99.8 }
  })
]);

export const REPORTS = Object.freeze([
  Object.freeze({ id: "RPT-DAILY-COL", name: "Daily Collections Report", owningModule: 11, biModule: 27 }),
  Object.freeze({ id: "RPT-LOAN-PORTFOLIO", name: "Loan Portfolio Report", owningModule: 11, biModule: 27 }),
  Object.freeze({ id: "RPT-BRANCH-PERF", name: "Branch Performance Report", owningModule: 11, biModule: 27 }),
  Object.freeze({ id: "RPT-SAVINGS-GROWTH", name: "Savings Growth Report", owningModule: 11, biModule: 27 }),
  Object.freeze({ id: "RPT-SYS-HEALTH", name: "System Health / Availability", owningModule: 11, biModule: 27 })
]);

export const DASHBOARDS = Object.freeze([
  Object.freeze({ id: "DSH-BI-EXEC", name: "Executive BI Dashboard", owningModule: 27, reportModule: 11 }),
  Object.freeze({ id: "DSH-BRANCH-OPS", name: "Branch Operations Dashboard", owningModule: 27, reportModule: 11 }),
  Object.freeze({ id: "DSH-RISK", name: "Risk & Default Dashboard", owningModule: 27, reportModule: 11 })
]);

const FORMULAS = {
  "KPI-001": (i) => (i.successfulCollections / i.expectedCollections) * 100,
  "KPI-002": (i) => (i.activeAccounts / i.totalAccounts) * 100,
  "KPI-003": (i) => (i.repaymentsPosted / i.repaymentsDue) * 100,
  "KPI-004": (i) => (i.defaultedLoans / i.outstandingLoans) * 100,
  "KPI-005": (i) => (i.cashCollected / i.cashExpected) * 100,
  "KPI-006": (i) => ((i.currentMembers - i.priorMembers) / i.priorMembers) * 100,
  "KPI-007": (i) => ((i.scheduledMinutes - i.downtimeMinutes) / i.scheduledMinutes) * 100
};

export function getKpi(kpiId) {
  return KPIS.find((k) => k.id === kpiId || k.code === kpiId) || null;
}

/**
 * Evaluate KPI formula with quality / null / div0 standards.
 * @param {string} kpiId
 * @param {object} inputs
 * @param {{ nullAsZero?: boolean }} [options]
 */
export function evaluateKpiFormula(kpiId, inputs = {}, options = {}) {
  const def = getKpi(kpiId);
  if (!def) return { ok: false, code: "ERABIKS-001", error: "Unknown KPI" };

  const fields = def.formulaFields;
  const resolved = { ...inputs };

  for (const field of fields) {
    if (resolved[field] == null) {
      if (options.nullAsZero === true) {
        resolved[field] = 0;
      } else if (def.nullPolicy === "fail") {
        return { ok: false, code: "ERABIKS-002", error: "Null validation failure", field, value: null };
      }
    }
  }

  // denominator detection
  let denominator;
  if (kpiId === "KPI-001" || kpiId === "KPI-001") denominator = resolved.expectedCollections;
  if (def.id === "KPI-001") denominator = resolved.expectedCollections;
  if (def.id === "KPI-002") denominator = resolved.totalAccounts;
  if (def.id === "KPI-003") denominator = resolved.repaymentsDue;
  if (def.id === "KPI-004") denominator = resolved.outstandingLoans;
  if (def.id === "KPI-005") denominator = resolved.cashExpected;
  if (def.id === "KPI-006") denominator = resolved.priorMembers;
  if (def.id === "KPI-007") denominator = resolved.scheduledMinutes;

  if (Number(denominator) === 0) {
    return { ok: false, code: "ERABIKS-003", error: "N/A", reason: "divide-by-zero", value: "N/A" };
  }

  const raw = FORMULAS[def.id](resolved);
  if (!Number.isFinite(raw)) {
    return { ok: false, code: "ERABIKS-004", error: "Non-finite result" };
  }
  const value = roundHalfUp(raw, def.roundingDigits);
  const qualityScore = fields.every((f) => inputs[f] != null) ? 1 : 0.5;
  return {
    ok: true,
    kpiId: def.id,
    value,
    display: value.toFixed(2) + "%",
    unitOfMeasure: def.unitOfMeasure,
    qualityScore,
    module27Code: def.module27Code
  };
}

export function validateReportingRegistry() {
  const errors = [];
  const ids = new Set();
  for (const k of KPIS) {
    if (ids.has(k.id)) errors.push("dup " + k.id);
    ids.add(k.id);
    if (k.owningModule !== 27) errors.push(k.id + " owner");
  }
  for (const r of REPORTS) {
    if (ids.has(r.id)) errors.push("dup " + r.id);
    ids.add(r.id);
  }
  return { ok: errors.length === 0, errors };
}

export const ERABIKS_COUNTS = Object.freeze({
  kpis: KPIS.length,
  metrics: METRICS.length,
  reports: REPORTS.length,
  dashboards: DASHBOARDS.length
});
`);

w("docs/enterprise-reporting-analytics-kpi.md", `# Enterprise Reporting, Analytics, BI & KPI Specification (ERABIKS)

**Phase:** 11 · **Version:** 1.0.0 · **Status:** Authoritative · **Date:** 2026-09-13  
**Registry:** \`src/core/canonical-reporting-registry.js\`  
**Engines:** Module 27 \`bi-ops.js\` · Module 11 Reports (\`report-ops\`) — do not replace  
**Consumes:** Phases 1–10 · Modules 1–30  

## Domains & Templates

Reports, dashboards, metrics (MET-*), KPIs (KPI-001…007 + Module 27 KPI-* cross-ref). Canonical financial defaults unchanged: interest **15**, collection days **31**, cashier **1000**.

## Analytics Model & Execution

Semantic metrics feed KPI formulas via \`evaluateKpiFormula\`. Execution is in-process; BI dashboard patterns remain Module 27.

## Exports, Security, Governance

Export actions from RBAC; masking via export-policy; Phase 9 security refs. No posting logic duplication.

## Input & Dependency Rules

- Inputs: Module 27 MET/KPI codes, Module 11 reports, Phases 1–10
- Forbidden: redefining entities/APIs/events/DB/security/integrations; changing money math

## KPI Formula & Data Quality Standards

| Topic | Standard |
|-------|----------|
| Formula fields | Explicit numerator/denominator field names per KPI |
| Null | Default fail (\`ERABIKS-002\`); optional \`nullAsZero\` for negative tests |
| Div0 | Return N/A (\`ERABIKS-003\`) |
| Rounding | RoundHalfUp, 2 decimal places for Percent |
| Currency | GHS where monetary |
| Quality dimensions | completeness, accuracy, timeliness |
| Quality threshold | default 0.95 |
| Quality score | 1.0 when all inputs present else 0.5 |
| Machine-readable | KPI registry metadata + evaluateKpiFormula result |

## Canonical KPI Formula Examples

### KPI-001 Daily Collection Success Rate
| Property | Value |
|----------|-------|
| Formula | (successfulCollections / expectedCollections) * 100 |
| Module 27 map | KPI-COL-RATE |
| Expected worked | 95.00% |

### KPI-002 Active Savings Account Rate
| Property | Value |
|----------|-------|
| Formula | (activeAccounts / totalAccounts) * 100 |
| Module 27 map | KPI-ACTIVE-MEM |
| Expected worked | 96.00% |

### KPI-003 Loan Repayment Rate
| Property | Value |
|----------|-------|
| Formula | (repaymentsPosted / repaymentsDue) * 100 |
| Module 27 map | KPI-LOAN-REC |
| Expected worked | 95.00% |

### KPI-004 Loan Default Rate
| Property | Value |
|----------|-------|
| Formula | (defaultedLoans / outstandingLoans) * 100 |
| Expected worked | 3.75% |

### KPI-005 Cash Collection Efficiency
| Property | Value |
|----------|-------|
| Formula | (cashCollected / cashExpected) * 100 |
| Module 27 map | KPI-COL-PROD (related) |
| Expected worked | 98.00% |

### KPI-006 Branch Growth Rate
| Property | Value |
|----------|-------|
| Formula | ((currentMembers - priorMembers) / priorMembers) * 100 |
| Module 27 map | KPI-CUS-GROWTH |
| Expected worked | 12.50% |

### KPI-007 System Availability
| Property | Value |
|----------|-------|
| Formula | ((scheduledMinutes - downtimeMinutes) / scheduledMinutes) * 100 |
| Module 27 map | KPI-SYS-AVAIL |
| Expected worked | 99.80% |

## Worked Numeric KPI Examples

| KPI | Inputs | Result |
|-----|--------|--------|
| KPI-001 | 190 / 200 | **95.00%** |
| KPI-002 | 480 / 500 | **96.00%** |
| KPI-003 | 190 / 200 | **95.00%** |
| KPI-004 | 15 / 400 | **3.75%** |
| KPI-005 | 9800 / 10000 | **98.00%** |
| KPI-006 | (90-80)/80 | **12.50%** |
| KPI-007 | (1000-2)/1000 | **99.80%** |

Negative tests: divide-by-zero → N/A; null without nullAsZero → validation failure; nullAsZero allowed only when explicitly opted in.

---

*Companion: \`docs/erabiks-catalogs.md\`.*
`);

w("docs/erabiks-catalogs.md", `# ERABIKS Catalogs (Phase 11)

**Parent:** [enterprise-reporting-analytics-kpi.md](./enterprise-reporting-analytics-kpi.md)  
**Registry:** \`src/core/canonical-reporting-registry.js\`

## Report / KPI / Dashboard / Metric Registries

See REPORTS, KPIS (KPI-001…007), DASHBOARDS, METRICS. Module 27 cross-ref via \`module27Code\`.

## Semantic Model / Export / Security / Schedule Matrices

Metrics → KPIs → Dashboards → Reports. Export gated by Reports.*/Export.* actions. Schedules remain Module 11/18 jobs.

## Cross-ref Phases 1–10 / Modules 1–30

Especially Modules **11** and **27**. Does not replace bi-ops heuristic engines.
`);

w("tests/erabiks-consistency.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KPIS, REPORTS, METRICS, validateReportingRegistry, ERABIKS_COUNTS, getKpi
} from "../src/core/canonical-reporting-registry.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("registry uniqueness and ownership", () => {
  const v = validateReportingRegistry();
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(KPIS.length, 7);
  assert.ok(ERABIKS_COUNTS.reports >= 5);
  assert.ok(METRICS.length >= 10);
  assert.equal(new Set(KPIS.map((k) => k.id)).size, 7);
  assert.equal(new Set(REPORTS.map((r) => r.id)).size, REPORTS.length);
  assert.equal(getKpi("KPI-001").module27Code, "KPI-COL-RATE");
  assert.equal(getKpi("KPI-007").module27Code, "KPI-SYS-AVAIL");
});

test("docs contain Formula Standards + Examples + Worked Numeric", () => {
  const text = fs.readFileSync(path.join(root, "docs", "enterprise-reporting-analytics-kpi.md"), "utf8");
  assert.match(text, /KPI Formula & Data Quality Standards/i);
  assert.match(text, /Canonical KPI Formula Examples/i);
  assert.match(text, /Worked Numeric KPI Examples/i);
  assert.equal(fs.existsSync(path.join(root, "docs", "erabiks-catalogs.md")), true);
});
`);

w("tests/erabiks-kpi-numeric.test.js", `import test from "node:test";
import assert from "node:assert/strict";
import { evaluateKpiFormula, KPIS } from "../src/core/canonical-reporting-registry.js";

test("worked numeric exact matches KPI-001..007", () => {
  const expected = {
    "KPI-001": 95.0,
    "KPI-002": 96.0,
    "KPI-003": 95.0,
    "KPI-004": 3.75,
    "KPI-005": 98.0,
    "KPI-006": 12.5,
    "KPI-007": 99.8
  };
  for (const k of KPIS) {
    const r = evaluateKpiFormula(k.id, k.workedExample.inputs);
    assert.equal(r.ok, true, k.id);
    assert.equal(r.value, expected[k.id]);
    assert.equal(r.display, expected[k.id].toFixed(2) + "%");
  }
});

test("divide-by-zero and null handling", () => {
  const div0 = evaluateKpiFormula("KPI-001", { successfulCollections: 10, expectedCollections: 0 });
  assert.equal(div0.ok, false);
  assert.equal(div0.value, "N/A");
  assert.equal(div0.code, "ERABIKS-003");

  const nul = evaluateKpiFormula("KPI-002", { activeAccounts: 10 });
  assert.equal(nul.ok, false);
  assert.equal(nul.code, "ERABIKS-002");

  const zeroed = evaluateKpiFormula("KPI-002", { activeAccounts: null, totalAccounts: 100 }, { nullAsZero: true });
  assert.equal(zeroed.ok, true);
  assert.equal(zeroed.value, 0);
});
`);

console.log("p11 done");
