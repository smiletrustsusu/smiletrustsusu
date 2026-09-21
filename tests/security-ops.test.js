import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  CONTRACT_CATALOG,
  getContract,
  mayConsume,
  assertContractBoundary,
  invokeContract,
  publishDomainEvent,
  PROHIBITED_PATHS
} from "../src/core/module-contracts.js";
import "../src/core/module-contract-handlers.js";
import {
  ensureSecurityState,
  evaluateRisk,
  openSecurityIncident,
  closeSecurityIncident,
  investigateFraud,
  securityDashboard,
  securityReports,
  exportSecurityCsv,
  assertSecurityBoundary
} from "../src/core/security-ops.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-11T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20 }],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    loans: [],
    audit: [],
    devices: []
  };
  ensureGatewayState(state);
  ensureSecurityState(state);
  return state;
}

test("every module has documented contracts and prohibited paths stay closed", () => {
  const boundary = assertContractBoundary();
  assert.equal(boundary.directSql, false);
  assert.equal(boundary.postsCollections, false);
  assert.ok(PROHIBITED_PATHS.includes("direct_sql"));
  assert.ok(getContract("Savings.Collect.v1"));
  assert.ok(getContract("Risk.Evaluate.v1"));
  assert.ok(getContract("API.RegisterClient.v1"));
  assert.ok(getContract("Backup.Start.v1"));
  const modules = new Set(CONTRACT_CATALOG.map((item) => item.moduleId));
  for (let i = 1; i <= 30; i += 1) assert.equal(modules.has(i), true);
  assert.equal(mayConsume(20, 19, getContract("Health.Status.v1")), true);
  assert.equal(mayConsume(6, 8, getContract("Loan.Approve.v1")), false);
});

test("queries are side-effect free and posting commands never create collections", () => {
  const state = blank();
  const before = state.collections.length;
  const balance = invokeContract(state, { contractId: "Savings.Balance.v1", fromModule: 20, payload: { customerId: "c-a" } }, { uid, now, user: owner });
  assert.equal(balance.ok, true);
  assert.equal(balance.data.balance, 20);
  const blocked = invokeContract(state, { contractId: "Savings.Collect.v1", fromModule: 20, payload: { amount: 99 } }, { uid, now, user: owner });
  assert.equal(blocked.ok, false);
  const alsoBlocked = invokeContract(state, { contractId: "Savings.Collect.v1", fromModule: 6, payload: { amount: 99 } }, { uid, now, user: owner });
  assert.equal(alsoBlocked.ok, false);
  const loan = invokeContract(state, { contractId: "Loan.Approve.v1", fromModule: 6, payload: { loanId: "x" } }, { uid, now, user: owner });
  assert.equal(loan.ok, false);
  assert.equal(state.collections.length, before);
  assert.equal(state.collections[0].amount, 20);
});

test("events cannot be published by a non-owner and retired contracts are rejected", () => {
  const state = blank();
  const stolen = publishDomainEvent(state, { name: "LoanApproved", moduleId: 6, payload: {} }, uid, now);
  assert.equal(stolen.ok, false);
  const owned = publishDomainEvent(state, { name: "RiskScoreUpdated", moduleId: 22, payload: { score: 1 } }, uid, now);
  assert.equal(owned.ok, true);
  const call = invokeContract(state, { contractId: "Security.DeprecatedProbe.v1", fromModule: 20 }, { uid, now, user: owner });
  assert.equal(call.http, 410);
});

test("risk evaluation scores signals without posting money", () => {
  const state = blank();
  state.collections.push({ id: "col-2", customerId: "c-a", date: "2026-09-11", amount: 20 });
  state.deviceHealthSnapshots = [{ integrityFailed: true }];
  const result = evaluateRisk(state, { customerId: "c-a" }, { user: owner, uid, now });
  assert.equal(result.ok, true);
  assert.ok(result.score.score >= 25);
  assert.equal(state.collections.filter((item) => item.id === "col-1")[0].amount, 20);
  assert.equal(canAction(collector, "Security.Incident"), false);
});

test("security incidents and fraud cases follow the documented lifecycle", () => {
  const state = blank();
  const denied = openSecurityIncident(state, { title: "Nope" }, collector, uid, now);
  assert.equal(denied.ok, false);
  const opened = openSecurityIncident(state, { title: "Tamper detected", severity: "critical" }, owner, uid, now);
  assert.equal(opened.ok, true);
  const closed = closeSecurityIncident(state, opened.incident.id, { user: owner, uid, now, note: "contained" });
  assert.equal(closed.incident.status, "closed");
  const fraud = investigateFraud(state, { subjectId: "c-a", advance: "investigating" }, owner, uid, now);
  assert.equal(fraud.fraud.status, "investigating");
  const report = securityReports(state, "security_incidents", { from: "2026-09-11", to: "2026-09-11" });
  assert.ok(exportSecurityCsv(report).includes("Tamper detected"));
  assert.ok(securityDashboard(state).incidents >= 1);
});

test("gateway and contracts share the security engine", () => {
  const state = blank();
  const viaContract = invokeContract(state, { contractId: "Risk.Evaluate.v1", fromModule: 20, payload: { customerId: "c-a" } }, { uid, now, user: owner });
  assert.equal(viaContract.ok, true);
  const viaGateway = dispatchGatewayRequest(state, {
    route: "risk.evaluate",
    version: "v1",
    user: owner,
    body: { customerId: "c-a" }
  }, { uid, now, user: owner });
  assert.equal(viaGateway.ok, true);
  const health = invokeContract(state, { contractId: "Health.Status.v1", fromModule: 20 }, { uid, now, user: owner });
  assert.equal(health.ok, true);
  assert.equal(assertSecurityBoundary().postsCollections, false);
});
