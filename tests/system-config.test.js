import test from "node:test";
import assert from "node:assert/strict";
import { canAction, canApproveAmount, DEFAULT_APPROVAL_LIMITS } from "../src/core/rbac.js";
import { ROLE } from "../src/core/roles.js";
import { sessionTtlMs } from "../src/core/session.js";
import { validateForcedPassword } from "../src/core/system-accounts.js";
import {
  ensureSystemConfig,
  getConfigValue,
  isFeatureEnabled,
  setParameter,
  setFeatureFlag,
  approveConfigDraft,
  rejectConfigDraft,
  rollbackConfigVersion,
  compareConfigVersions,
  searchConfig,
  updateCompanyProfile,
  addHoliday,
  isWorkingDay,
  exportConfig,
  importConfig,
  validateConfigImport,
  configuredApprovalLimits,
  recordLiveSettingsChange,
  upsertProductDefinition
} from "../src/core/system-config.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const kba = { id: "u-kba", role: "KBA", username: "kba" };
const other = { id: "u-md", role: "ManagingDirector", username: "ama" };

function blank() {
  return { settings: { loanInterest: 15, currency: "GHS", sessionTimeoutMinutes: 480, collectionDays: 31, businessName: "Smile Trust" } };
}

test("catalog defaults keep cashier 1000, interest 15, GHS, and 31-day cycle", () => {
  const state = blank();
  ensureSystemConfig(state);
  assert.equal(getConfigValue(state, "approval.cashierLimitGhs"), 1000);
  assert.equal(getConfigValue(state, "finance.loanInterest"), 15);
  assert.equal(getConfigValue(state, "org.currency"), "GHS");
  assert.equal(getConfigValue(state, "finance.collectionDays"), 31);
  assert.equal(DEFAULT_APPROVAL_LIMITS[ROLE.CASHIER], 1000);
  assert.equal(canApproveAmount({ role: "Cashier" }, 1000), true);
  assert.equal(canApproveAmount({ role: "Cashier" }, 1500), false);
});

test("live settings overlay catalog until a parameter value is stored", () => {
  const state = blank();
  state.settings.loanInterest = 18;
  assert.equal(getConfigValue(state, "finance.loanInterest"), 18);
});

test("owner applies high-risk parameter immediately and versions it", () => {
  const state = blank();
  const result = setParameter(state, { key: "approval.cashierLimitGhs", value: 1200, reason: "board", user: owner }, uid);
  assert.equal(result.ok, true);
  assert.equal(getConfigValue(state, "approval.cashierLimitGhs"), 1200);
  assert.ok(state.configurationVersions.length >= 2);
  assert.ok(state.audit.some((row) => /settings changed/i.test(row.action)));
});

test("super admin high-risk change is drafted; another approver applies it", () => {
  const state = blank();
  const drafted = setParameter(state, { key: "finance.loanInterest", value: 16, reason: "review", user: kba }, uid);
  assert.equal(drafted.pending, true);
  assert.equal(getConfigValue(state, "finance.loanInterest"), 15);
  const self = approveConfigDraft(state, drafted.draft.id, kba, uid);
  assert.match(self.error, /different approver/i);
  const approved = approveConfigDraft(state, drafted.draft.id, owner, uid);
  assert.equal(approved.ok, true);
  assert.equal(getConfigValue(state, "finance.loanInterest"), 16);
});

test("rejected draft does not change runtime values", () => {
  const state = blank();
  const drafted = setParameter(state, { key: "security.mfaRequired", value: true, user: kba }, uid);
  rejectConfigDraft(state, drafted.draft.id, owner, uid);
  assert.equal(getConfigValue(state, "security.mfaRequired"), false);
});

test("feature flags default on so loans and momo stay available", () => {
  const state = blank();
  ensureSystemConfig(state);
  assert.equal(isFeatureEnabled(state, "enableLoanModule"), true);
  assert.equal(isFeatureEnabled(state, "enableMobileMoney"), true);
  assert.equal(isFeatureEnabled(state, "enableOfflineMode"), true);
});

test("loan flag by super admin is maker-checked", () => {
  const state = blank();
  const drafted = setFeatureFlag(state, { id: "enableLoanModule", enabled: false, user: kba }, uid);
  assert.equal(drafted.pending, true);
  assert.equal(isFeatureEnabled(state, "enableLoanModule"), true);
});

test("rollback restores previous parameter snapshot", () => {
  const state = blank();
  setParameter(state, { key: "finance.maxWithdrawalGhs", value: 8000, user: owner }, uid);
  const before = state.configVersionNumber;
  setParameter(state, { key: "finance.maxWithdrawalGhs", value: 9000, user: owner }, uid);
  rollbackConfigVersion(state, before, owner, uid);
  assert.equal(Number(getConfigValue(state, "finance.maxWithdrawalGhs")), 8000);
});

test("compare versions lists field diffs", () => {
  const state = blank();
  setParameter(state, { key: "finance.penaltyPct", value: 2, user: owner }, uid);
  const diffs = compareConfigVersions(state, 1, state.configVersionNumber);
  assert.ok(diffs.some((item) => item.key === "finance.penaltyPct"));
});

test("import validates currency and rolls back on invalid payload", () => {
  assert.match(validateConfigImport({ parameters: { "org.currency": "USD" } }), /GHS/);
  const state = blank();
  const bad = importConfig(state, { parameters: { "org.currency": "USD" } }, owner, uid);
  assert.ok(bad.error);
  const good = importConfig(state, { parameters: { "finance.maxDailyCollectionGhs": 10000 }, flags: { enableWhatsApp: true } }, owner, uid);
  assert.equal(good.ok, true);
  assert.equal(Number(getConfigValue(state, "finance.maxDailyCollectionGhs")), 10000);
});

test("product catalog seeds savings and loan products without changing live defaults", () => {
  const state = blank();
  ensureSystemConfig(state);
  assert.ok(state.productDefinitions.some((item) => item.name === "Daily Susu"));
  assert.ok(state.productDefinitions.some((item) => item.name === "Personal Loan"));
  const result = upsertProductDefinition(state, { id: "prod-loan-personal", minAmount: 250, maxAmount: 40000, status: "active" }, owner, uid);
  assert.equal(result.ok, true);
  assert.equal(state.productDefinitions.find((item) => item.id === "prod-loan-personal").minAmount, 250);
  assert.equal(getConfigValue(state, "finance.loanInterest"), 15);
});

test("company profile syncs business name and is searchable", () => {
  const state = blank();
  updateCompanyProfile(state, { companyName: "Smile Trust Ghana", region: "Greater Accra" }, owner, uid);
  assert.equal(state.settings.businessName, "Smile Trust Ghana");
  const rows = searchConfig(state, "cashier");
  assert.ok(rows.some((item) => item.key === "approval.cashierLimitGhs"));
});

test("Ghana holidays seed and custom holiday blocks working day", () => {
  const state = blank();
  ensureSystemConfig(state);
  assert.equal(isWorkingDay(state, "2026-03-06"), false);
  assert.equal(isWorkingDay(state, "2026-03-05"), true);
  addHoliday(state, { date: "2026-03-05", name: "Branch day" }, owner, uid);
  assert.equal(isWorkingDay(state, "2026-03-05"), false);
});

test("session timeout and password floor come from configuration", () => {
  assert.equal(sessionTtlMs({ sessionTimeoutMinutes: 480 }), 480 * 60 * 1000);
  assert.equal(sessionTtlMs({}), 8 * 60 * 60 * 1000);
  assert.match(validateForcedPassword("short", "old"), /8 characters/);
  assert.match(validateForcedPassword("12345678", "old", undefined, { minLength: 10 }), /10 characters/);
});

test("configured approval limits override only when set", () => {
  const state = blank();
  assert.equal(configuredApprovalLimits(state)[ROLE.CASHIER], 1000);
  setParameter(state, { key: "approval.cashierLimitGhs", value: 1500, user: owner }, uid);
  assert.equal(configuredApprovalLimits(state)[ROLE.CASHIER], 1500);
});

test("settings form snapshot is versioned", () => {
  const state = blank();
  recordLiveSettingsChange(state, { businessName: "A", currency: "GHS", loanInterest: 15 }, { businessName: "B", currency: "GHS", loanInterest: 15 }, owner, uid);
  assert.ok(state.configurationChanges.some((item) => item.newValue === "B"));
});

test("collector cannot configure system; auditor can view", () => {
  assert.equal(canAction({ role: "Collector" }, "System.Configure"), false);
  assert.equal(canAction({ role: "Auditor" }, "System.View"), true);
  assert.equal(canAction({ role: "Auditor" }, "System.Configure"), false);
  assert.equal(canAction(owner, "System.ConfigurationApprove"), true);
});

test("export includes schema version and current values", () => {
  const state = blank();
  const payload = exportConfig(state);
  assert.equal(payload.schemaVersion, "1.0.0");
  assert.equal(payload.parameters["org.currency"], "GHS");
});
