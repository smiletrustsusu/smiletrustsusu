/**
 * Phase 4 ECSMLS consistency — registry invariants, ECDM binding, docs checks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_STATE_MACHINES,
  ECSMLS_VERSION,
  FORBIDDEN_MONEY_MUTATION_MODULES,
  listStateMachines,
  getStateMachine,
  isTransitionAllowed,
  assertTransition,
  validateStateMachineRegistry,
  STATE_MACHINE_SCHEMA
} from "../src/core/canonical-state-machine-registry.js";
import {
  CANONICAL_ENTITIES,
  MONEY_TRANSACTION_ENTITY_CODES,
  getCanonicalEntity
} from "../src/core/canonical-domain-registry.js";
import { LOAN_TRANSITIONS } from "../src/core/loans-workflow.js";
import { PAYMENT_TRANSITION_MATRIX } from "../src/core/payment-lifecycle.js";
import { WORKFLOW_TRANSITION_MATRIX } from "../src/core/workflow-lifecycle.js";
import { MODEL_TRANSITIONS } from "../src/core/ai-lifecycle.js";
import { TENANT_TRANSITIONS } from "../src/core/platform-lifecycle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function read(name) {
  return fs.readFileSync(path.join(DOCS, name), "utf8");
}

function exists(name) {
  return fs.existsSync(path.join(DOCS, name));
}

const ECSMLS_DOCS = [
  "enterprise-canonical-state-machines.md",
  "ecsmls-catalogs.md"
];

test("ECSMLS docs exist and include Input & Dependency Rules", () => {
  for (const doc of ECSMLS_DOCS) {
    assert.equal(exists(doc), true, `missing ${doc}`);
  }
  const primary = read("enterprise-canonical-state-machines.md");
  assert.match(primary, /ECSMLS|Enterprise Canonical State Machine/);
  assert.match(primary, /IMPLEMENTATION BOUNDARY/);
  assert.match(primary, /Phase Input & Dependency Rules/);
  assert.match(primary, /Required inputs/);
  assert.match(primary, /Precedence/);
  assert.match(primary, /Prohibited activities/);
  assert.match(primary, /canonical-state-machine-registry\.js/);
  assert.match(primary, /Modules?\s+1\s*[–-]\s*30|1–30/);

  const catalogs = read("ecsmls-catalogs.md");
  assert.match(catalogs, /Enterprise State Machine Catalog/);
  assert.match(catalogs, /Transition Matrix/);
  assert.match(catalogs, /State Ownership Matrix/);
  assert.match(catalogs, /Lifecycle Dependency Matrix/);
  assert.match(catalogs, /Terminal State Register/);
  assert.match(catalogs, /Transition Authorization Matrix/);
  assert.match(catalogs, /Timeout|Compensation|Rollback/);
  assert.match(catalogs, /Cross-Reference Index/);
});

test("registry has unique machine IDs and schema metadata", () => {
  const ids = CANONICAL_STATE_MACHINES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(listStateMachines().length, ids.length);
  assert.ok(ids.length >= 25 && ids.length <= 45, `expected 25–45 machines, got ${ids.length}`);
  assert.equal(typeof STATE_MACHINE_SCHEMA.$id, "string");
  assert.equal(ECSMLS_VERSION, "1.0.0");
});

test("required domain machines present", () => {
  const required = [
    "SM-CUS-001",
    "SM-LON-001",
    "SM-PAY-001",
    "SM-WFK-002",
    "SM-AI-001",
    "SM-PLT-001"
  ];
  for (const id of required) {
    assert.ok(getStateMachine(id), `missing ${id}`);
  }
});

test("transitions use only defined states; no orphan transition states", () => {
  for (const machine of CANONICAL_STATE_MACHINES) {
    const states = new Set(machine.states);
    for (const t of machine.transitions) {
      assert.equal(states.has(t.from), true, `${machine.id} orphan from ${t.from}`);
      assert.equal(states.has(t.to), true, `${machine.id} orphan to ${t.to}`);
    }
    assert.equal(states.has(machine.initialState), true, `${machine.id} initial`);
  }
});

test("terminal states have no illegal outbound (except approved recovery)", () => {
  for (const machine of CANONICAL_STATE_MACHINES) {
    const recovery = new Set(
      (machine.approvedRecoveryFromTerminal || []).map((r) => `${r.from}=>${r.to}`)
    );
    for (const term of machine.terminalStates || []) {
      const outbound = machine.transitions.filter((t) => t.from === term);
      for (const t of outbound) {
        const key = `${t.from}=>${t.to}`;
        assert.ok(
          recovery.has(key) || t.recovery,
          `${machine.id}: terminal ${term} → ${t.to} not approved recovery`
        );
      }
    }
  }
});

test("referenced entity IDs exist in ECDM registry", () => {
  const codes = new Set(CANONICAL_ENTITIES.map((e) => e.code));
  for (const machine of CANONICAL_STATE_MACHINES) {
    assert.equal(codes.has(machine.entityId), true, `${machine.id} → ${machine.entityId}`);
    assert.ok(getCanonicalEntity(machine.entityId));
  }
});

test("validateStateMachineRegistry passes", () => {
  const result = validateStateMachineRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.machineCount, CANONICAL_STATE_MACHINES.length);
});

test("isTransitionAllowed / assertTransition helpers", () => {
  assert.equal(isTransitionAllowed("SM-LON-001", "Pending", "Approved"), true);
  assert.equal(isTransitionAllowed("SM-LON-001", "Completed", "Active"), false);
  assert.equal(isTransitionAllowed("SM-MISSING", "a", "b"), false);
  assert.equal(assertTransition("SM-PAY-001", "created", "validated").ok, true);
  assert.equal(assertTransition("SM-PAY-001", "created", "completed").ok, false);
});

test("loan / payment / workflow / AI / platform machines align with source matrices", () => {
  const loan = getStateMachine("SM-LON-001");
  for (const [from, targets] of Object.entries(LOAN_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(isTransitionAllowed("SM-LON-001", from, to), true, `loan ${from}→${to}`);
    }
  }
  assert.ok(loan.terminalStates.includes("Completed"));

  for (const [from, targets] of Object.entries(PAYMENT_TRANSITION_MATRIX)) {
    for (const to of targets) {
      assert.equal(isTransitionAllowed("SM-PAY-001", from, to), true, `pay ${from}→${to}`);
    }
  }

  for (const [from, targets] of Object.entries(WORKFLOW_TRANSITION_MATRIX)) {
    for (const to of targets) {
      assert.equal(isTransitionAllowed("SM-WFK-002", from, to), true, `wf ${from}→${to}`);
    }
  }

  for (const [from, targets] of Object.entries(MODEL_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(isTransitionAllowed("SM-AI-001", from, to), true, `ai ${from}→${to}`);
    }
  }

  for (const [from, targets] of Object.entries(TENANT_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(isTransitionAllowed("SM-PLT-001", from, to), true, `plt ${from}→${to}`);
    }
  }
});

test("money lifecycles are not owned by modules 28/29 for mutation authority", () => {
  for (const machine of CANONICAL_STATE_MACHINES) {
    if (!MONEY_TRANSACTION_ENTITY_CODES.includes(machine.entityId)) continue;
    assert.equal(
      FORBIDDEN_MONEY_MUTATION_MODULES.includes(Number(machine.owningModule)),
      false,
      `${machine.id} money entity ${machine.entityId} owned by ${machine.owningModule}`
    );
    const entity = getCanonicalEntity(machine.entityId);
    assert.ok(entity);
    assert.equal(
      FORBIDDEN_MONEY_MUTATION_MODULES.includes(Number(entity.owningModuleId)),
      false,
      `ECDM ${machine.entityId} owned by ${entity.owningModuleId}`
    );
  }
});

test("Phase 1–3 input docs still present for dependency chain", () => {
  assert.equal(exists("enterprise-master-architecture.md"), true);
  assert.equal(exists("enterprise-canonical-domain-model.md"), true);
  assert.equal(exists("phase2-registers.md"), true);
  assert.equal(exists("loan-status-transitions.md"), true);
});
