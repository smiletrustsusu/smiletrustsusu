import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_SCHEMA_VERSION,
  MONEY_UNIT,
  CURRENCY,
  ENTITY_ALIASES,
  CANONICAL_TABLES,
  TABLES_NOT_CREATED,
  ATOMIC_CONTRIBUTION,
  BALANCE_RULE,
  API_OPERATIONS,
  ARCHITECTURE_GAPS,
  CONTRIBUTION_LIFECYCLE,
  WITHDRAWAL_LIFECYCLE,
  LOAN_LIFECYCLE,
  assertSingleMemberModel,
  postgresIsSourceOfTruth,
  tableByName
} from "../src/core/canonical-schema.js";
import { LOAN_STATUSES } from "../src/core/loans-workflow.js";
import { WITHDRAWAL_STATUSES } from "../src/core/withdrawals-workflow.js";
import { ACTIONS } from "../src/core/rbac.js";
import { toPesewas, fromPesewas } from "../src/core/money.js";

test("one member model: customers is members; no second members table", () => {
  assert.equal(assertSingleMemberModel(), true);
  assert.equal(ENTITY_ALIASES.members, "customers");
  assert.equal(ENTITY_ALIASES.organizations, "businesses");
  assert.equal(ENTITY_ALIASES.users, "app_users");
  assert.equal(ENTITY_ALIASES.contributions, "collections");
  assert.equal(CANONICAL_TABLES.filter((item) => item.name === "members").length, 0);
  assert.ok(TABLES_NOT_CREATED.some((item) => item.promptName === "members"));
});

test("money is integer pesewas and GHS has 100 pesewas", () => {
  assert.equal(MONEY_UNIT, "pesewas");
  assert.equal(CURRENCY, "GHS");
  assert.equal(toPesewas(10.5), 1050);
  assert.equal(fromPesewas(1050), 10.5);
  assert.equal(BALANCE_RULE.authoritative.includes("ledger_entries"), true);
  assert.ok(BALANCE_RULE.forbidden.includes("apk.balance"));
});

test("EXE and APK do not get separate production tables", () => {
  const names = CANONICAL_TABLES.map((item) => item.name);
  assert.equal(names.some((name) => /apk|android_only|exe_only|windows_only/i.test(name)), false);
  assert.equal(CANONICAL_SCHEMA_VERSION, "1.0.0");
});

test("posted contributions are atomic and not deleted", () => {
  assert.ok(ATOMIC_CONTRIBUTION.some((step) => /ledger/i.test(step)));
  assert.ok(ATOMIC_CONTRIBUTION.some((step) => /COMMIT/i.test(step)));
  assert.deepEqual(CONTRIBUTION_LIFECYCLE, ["Initiated", "Pending", "Validated", "Posted"]);
});

test("withdrawal and loan lifecycles match the live Smile Trust workflows", () => {
  WITHDRAWAL_LIFECYCLE.forEach((status) => assert.ok(WITHDRAWAL_STATUSES.includes(status)));
  LOAN_LIFECYCLE.forEach((status) => assert.ok(LOAN_STATUSES.includes(status)));
  assert.ok(ACTIONS.includes("Savings.Collect"));
  assert.ok(ACTIONS.includes("Withdrawal.Approve"));
});

test("API contract is operation-shaped, not table dumps", () => {
  const paths = API_OPERATIONS.map((item) => item.path);
  assert.ok(paths.includes("/api/v1/contributions"));
  assert.ok(paths.includes("/api/v1/withdrawals/:id/approve"));
  assert.equal(API_OPERATIONS.every((item) => item.op && item.method), true);
  assert.equal(tableByName("members").name, "customers");
  assert.equal(tableByName("contributions").name, "collections");
});

test("PostgreSQL is not yet exclusive source of truth in the running clients", () => {
  assert.equal(postgresIsSourceOfTruth({ postgresSourceOfTruth: false, relationalSync: false }), false);
  assert.equal(postgresIsSourceOfTruth({ postgresSourceOfTruth: true, relationalSync: true }), true);
  assert.ok(ARCHITECTURE_GAPS.some((item) => /localStorage/i.test(item)));
  assert.ok(ARCHITECTURE_GAPS.some((item) => /Argon2id/i.test(item)));
});
