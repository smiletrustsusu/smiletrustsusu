/**
 * Wave 3 backend API platform — gateway, security, domain contract tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/password.js";
import {
  createApiPlatform,
  resetApiPlatformForTests,
  wave3SmokeChecklist,
  operationCountsByDomain,
  WAVE3_WAVE
} from "../src/core/wave3-api-ops.js";
import { buildOpenApiDocument } from "../src/api/openapi.js";
import { resetRateLimitWindows } from "../src/api/middleware/rate-limit.js";
import { listBacklogForWave, getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const uid = (prefix) => `${prefix}-t`;
const now = "2026-09-15T12:00:00.000Z";

function mockSessionStorage() {
  const map = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

async function blankState() {
  mockSessionStorage();
  resetApiPlatformForTests();
  resetRateLimitWindows();
  const passwordHash = await hashPassword("SecretPass1");
  return {
    settings: {
      loanInterest: 15,
      collectionDays: 31,
      currency: "GHS",
      sessionTimeoutMinutes: 480,
      tenantId: "smile-trust",
      businessId: "smile-trust",
      postgresSourceOfTruth: false,
      relationalSync: false
    },
    users: [
      {
        id: "u-owner",
        username: "john",
        role: "SystemOwner",
        systemOwner: true,
        active: true,
        passwordHash,
        branchId: "br-1",
        tenantId: "smile-trust"
      },
      {
        id: "u-admin",
        username: "admin1",
        role: "Admin",
        active: true,
        passwordHash,
        branchId: "br-1",
        tenantId: "smile-trust"
      },
      {
        id: "u-collector",
        username: "col1",
        role: "Collector",
        active: true,
        passwordHash,
        branchId: "br-1",
        tenantId: "smile-trust"
      },
      {
        id: "u-other-branch",
        username: "col2",
        role: "Collector",
        active: true,
        passwordHash,
        branchId: "br-2",
        tenantId: "smile-trust"
      }
    ],
    branches: [
      { id: "br-1", name: "Accra", status: "Active", active: true },
      { id: "br-2", name: "Kumasi", status: "Active", active: true }
    ],
    customers: [],
    collections: [],
    loans: [],
    transactions: [],
    ledgerEntries: [],
    audit: [],
    notifications: [],
    offlineQueue: [],
    deviceAuthorizations: []
  };
}

test("wave3 docs and openapi paths exist", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "docs", "wave3-backend-api.md")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "docs", "openapi")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "api", "gateway.js")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core", "wave3-api-ops.js")), true);
  assert.equal(fs.existsSync(path.join(ROOT, "src", "core", "repositories", "supabase-rpc-repository.js")), true);
});

test("bootstrap registers operations across required domains", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const counts = api.countsByDomain();
  const required = [
    "auth", "authorization", "customers", "savings", "collections", "loans",
    "accounting", "reporting", "dashboards", "sync", "audit", "notifications",
    "configuration", "monitoring"
  ];
  for (const domain of required) {
    assert.ok((counts[domain] || 0) >= 2, `domain ${domain} should have operations`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total >= 50, `expected >= 50 operations, got ${total}`);
  const smoke = wave3SmokeChecklist(state);
  assert.equal(smoke.wave, WAVE3_WAVE);
  assert.equal(smoke.httpServer, false);
  assert.equal(smoke.moneyDefaults.ok, true);
  assert.equal(smoke.moneyDefaults.loanInterest, 15);
  assert.equal(smoke.moneyDefaults.collectionDays, 31);
  assert.equal(smoke.moneyDefaults.cashierLimitGhs, 1000);
});

test("unauthorized requests are rejected", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const res = await api.invoke({ operationId: "v1/customers.list" });
  assert.equal(res.ok, false);
  assert.equal(res.http, 401);
  assert.ok(res.problem?.code === "FND-001" || res.error?.errorCode === "FND-001");
  assert.ok(res.correlationId);
});

test("wrong branch is rejected for branch-scoped ops", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const collector = state.users.find((u) => u.id === "u-collector");
  const res = await api.invoke({
    operationId: "v1/customers.register",
    payload: { name: "Other Branch", branchId: "br-2" }
  }, { user: collector });
  assert.equal(res.ok, false);
  assert.equal(res.http, 403);
});

test("wrong tenant is rejected", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const admin = state.users.find((u) => u.id === "u-admin");
  const res = await api.invoke({
    operationId: "v1/authorization.checkTenantBranch",
    payload: { tenantId: "other-tenant", branchId: "br-1" }
  }, { user: admin });
  assert.equal(res.ok, false);
});

test("auth login + customer register + collection posting uses pesewas path", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const login = await api.invoke({
    operationId: "v1/auth.login",
    payload: { username: "admin1", password: "SecretPass1" }
  });
  assert.equal(login.ok, true);

  const admin = state.users.find((u) => u.id === "u-admin");
  const created = await api.invoke({
    operationId: "v1/customers.register",
    payload: { name: "Ama Mensah", phone: "0244000001", branchId: "br-1", groupId: "br-1" }
  }, { user: admin });
  assert.equal(created.ok, true);
  assert.ok(created.data?.customer?.id);

  const posted = await api.invoke({
    operationId: "v1/collections.record",
    payload: {
      customerId: created.data.customer.id,
      amountPesewas: 10000,
      date: "2026-09-15",
      paymentMethod: "Cash",
      branchId: "br-1"
    }
  }, { user: admin });
  assert.equal(posted.ok, true);
  assert.equal(posted.data?.collection?.amountPesewas, 10000);
  assert.equal(Number(posted.data?.collection?.amount), 100);
  assert.ok((state.ledgerEntries || []).length > 0 || (state.collections || []).length === 1);

  const balance = await api.invoke({
    operationId: "v1/savings.balance",
    payload: { customerId: created.data.customer.id }
  }, { user: admin });
  assert.equal(balance.ok, true);
});

test("OpenAPI 3.1 document covers registered operations", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const doc = buildOpenApiDocument({ operations: api.operations() });
  assert.equal(doc.openapi, "3.1.0");
  assert.equal(doc["x-smile-trust"].httpServer, false);
  assert.ok(Object.keys(doc.paths).length >= 50);
  const outDir = path.join(ROOT, "docs", "openapi");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "wave3-api.openapi.json"), JSON.stringify(doc, null, 2));
  assert.equal(fs.existsSync(path.join(outDir, "wave3-api.openapi.json")), true);
});

test("monitoring health and configuration money defaults", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const admin = state.users.find((u) => u.id === "u-admin");
  const health = await api.invoke({ operationId: "v1/monitoring.health" }, { user: admin });
  assert.equal(health.ok, true);
  const money = await api.invoke({ operationId: "v1/configuration.moneyDefaults" }, { user: admin });
  assert.equal(money.ok, true);
  assert.equal(money.data.loanInterest, 15);
  assert.equal(money.data.collectionDays, 31);
  assert.equal(money.data.cashierLimitGhs, 1000);
  assert.deepEqual(SUPER_ADMIN_FORBIDDEN.slice().sort(), ["Export.All", "Owner.Transfer", "System.Reset"].sort());
});

test("sync upload requires idempotency and reports status", async () => {
  const state = await blankState();
  const api = createApiPlatform(state, { uid, now });
  const admin = state.users.find((u) => u.id === "u-admin");
  const upload = await api.invoke({
    operationId: "v1/sync.upload",
    payload: { idempotencyKey: "off-1", kind: "collection", payload: { demo: true } }
  }, { user: admin });
  assert.equal(upload.ok, true);
  const status = await api.invoke({ operationId: "v1/sync.status" }, { user: admin });
  assert.equal(status.ok, true);
  assert.ok(status.data.pendingCount >= 1);
});

test("WAVE-03 backlog hardening for modules 18/20/28 is Completed", () => {
  const wave = getWave("WAVE-03");
  assert.ok(wave);
  assert.ok(wave.requiredDocumentation.some((d) => /wave3-backend-api/.test(d)));
  const items = listBacklogForWave("WAVE-03");
  const hardening = items.filter((i) =>
    /Integration & Hardening/i.test(i.title) &&
    ["MOD-018", "MOD-020", "MOD-028"].includes(i.module)
  );
  assert.ok(hardening.length >= 3, `expected hardening epics, got ${hardening.length}`);
  for (const item of hardening) {
    assert.equal(item.status, "Completed", item.identifier + " " + item.title);
  }
});

test("operationCountsByDomain is stable after bootstrap", async () => {
  const state = await blankState();
  createApiPlatform(state, { uid, now });
  const counts = operationCountsByDomain();
  assert.ok(counts.auth >= 8);
  assert.ok(counts.customers >= 5);
  assert.ok(counts.monitoring >= 3);
});
