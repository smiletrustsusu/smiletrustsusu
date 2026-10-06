/**
 * Member registration, member edits and collection recording when the relational database is authoritative:
 * nothing is presented or posted as done until the protected server write has definitively
 * succeeded, failures are refused with a visible reason, an unanswered request is held for a
 * same-identity retry, and retries never duplicate a member, collection or ledger credit.
 *
 * The server is an in-memory stand-in with the semantics of the deployed RPCs:
 * upsert_customer_from_client (044 + 047 wrapper), record_collection_from_client (005 internal +
 * 047 wrapper), customers_account_no_uq, and collections unique on idempotency_key / receipt_no.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { relationalLoad, staffSession, tableRows, canonicalPayload } from "./helpers/sync-fixtures.mjs";

const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage = globalThis.localStorage;

const { App } = await import("../src/context.js");
const writes = await import("../src/sync/authoritative-writes.js");
const cloud = await import("../src/sync/cloud.js");
const canonical = await import("../src/sync/canonical-snapshot.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { LEGACY_SYNC_KEY_STORAGE } = await import("../src/config.js");
const { WRITE_REJECTED, WRITE_UNCONFIRMED, registerCustomerAuthoritatively, updateCustomerAuthoritatively, submitCollectionAuthoritatively } = writes;

const BIZ = "SMILE-TRUST";
const SERVER_MANAGERS = ["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"];
const SAVED_AT = "2026-10-05T10:44:18.728+00:00";
const REAL_CUSTOMER = relationalLoad().customers[0];
const signIn = (options = {}) => localStorage.setItem(SESSION_KEY, JSON.stringify(staffSession({ business: BIZ, ...options })));

function deviceState() {
  const load = relationalLoad();
  return {
    settings: { relationalSync: true, postgresSourceOfTruth: true, cloudMode: "supabase", cloudUrl: "https://example.supabase.co", cloudKey: "anon", businessId: BIZ },
    groups: structuredClone(load.groups),
    users: structuredClone(load.users),
    customers: structuredClone(load.customers),
    collections: [],
    ledgerEntries: []
  };
}

/** In-memory server. `next[rpc]` holds one-shot behaviours: a { status, body } reply, "network", "hang" or "commit-then-drop". */
function fakeServer() {
  const server = {
    load: relationalLoad(),
    ledger: [],
    calls: [],
    next: {},
    snapshot: null,
    seq: 0
  };
  const reply = (status, body) => new Response(body === null || body === undefined ? null : JSON.stringify(body), { status });
  const refuse = (status, code, message) => ({ status, body: { code, message } });

  // 047 st_scope_staff_payload: a non-manager's collector_client_id becomes the caller's own id.
  function scoped(p, headers) {
    let meta = {};
    try {
      meta = JSON.parse(Buffer.from(String(headers.Authorization || "").split(".")[1] || "", "base64url").toString()).app_metadata || {};
    } catch { /* no claims */ }
    return SERVER_MANAGERS.includes(meta.app_role) ? p : { ...p, collector_client_id: meta.app_user_id };
  }

  function upsertCustomer(raw, headers) {
    const p = scoped(raw, headers);
    if (p.business_code !== BIZ) return refuse(403, "42501", "not a staff member of this business");
    const existing = server.load.customers.find((c) => c.id === p.customer_client_id);
    if (existing) {
      if (p.customer_name) existing.name = p.customer_name;
      if (p.customer_phone) existing.phone = p.customer_phone;
      existing.groupId = p.branch_client_id;
      existing.collectorId = p.collector_client_id;
      return { status: 200, body: { ok: true, customer_id: `uuid-${existing.id}`, business_id: "biz-uuid" } };
    }
    if (server.load.customers.some((c) => c.accountNo.toLowerCase() === String(p.account_no).toLowerCase())) {
      return refuse(409, "23505", 'duplicate key value violates unique constraint "customers_account_no_uq"');
    }
    server.load.customers.push({ id: p.customer_client_id, accountNo: p.account_no, name: p.customer_name, phone: p.customer_phone, groupId: p.branch_client_id,
      collectorId: p.collector_client_id, active: true, memberStatus: "Active", accountType: "personal" });
    return { status: 200, body: { ok: true, customer_id: `uuid-${p.customer_client_id}`, business_id: "biz-uuid" } };
  }

  function recordCollection(p) {
    if (p.business_code !== BIZ) return refuse(403, "42501", "not a staff member of this business");
    if (Number(p.amount) < 0) return refuse(400, "22023", "amounts cannot be negative");
    const duplicate = server.load.collections.find((c) => c.idempotencyKey === p.idempotency_key);
    if (duplicate) return { status: 200, body: { status: "duplicate", collection_id: `uuid-${duplicate.id}` } };
    if (server.load.collections.some((c) => c.receiptNo === p.receipt_no)) return refuse(409, "23505", 'duplicate key value violates unique constraint "collections_business_id_receipt_no_key"');
    const collection = { id: p.client_id, customerId: p.customer_client_id, groupId: p.branch_client_id, userId: p.collector_client_id, collectorId: p.collector_client_id,
      amount: Number(p.amount), amountPesewas: Number(p.amount_pesewas), date: p.collection_date, receiptNo: p.receipt_no, idempotencyKey: p.idempotency_key,
      paymentMethod: p.payment_method, paymentReference: p.payment_reference, verificationStatus: p.verification_status, reversed: false, createdAt: p.client_created_at };
    server.load.collections.push(collection);
    if (collection.amount > 0) server.ledger.push({ collectionId: collection.id, customerId: collection.customerId, amount: collection.amount, direction: "credit" });
    return { status: 200, body: { status: "recorded", collection_id: `uuid-${collection.id}`, business_id: "biz-uuid" } };
  }

  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    server.calls.push({ method, url, body, headers: options.headers || {} });
    const rpc = (url.match(/\/rpc\/([a-z_]+)/) || [])[1];
    const behaviour = rpc && server.next[rpc]?.length ? server.next[rpc].shift() : null;
    const run = () => {
      if (rpc === "fetch_business_snapshot") return { status: 200, body: structuredClone(server.load) };
      if (rpc === "upsert_customer_from_client") return upsertCustomer(body.payload, options.headers || {});
      if (rpc === "record_collection_from_client") return recordCollection(body.payload);
      if (url.includes("/rest/v1/customers?")) return { status: 200, body: tableRows(server.load).customers };
      if (url.includes("/rest/v1/collections?")) return { status: 200, body: tableRows(server.load).collections };
      if (url.includes("/smile_trust_cloud_snapshots")) {
        if (method === "GET") return { status: 200, body: server.snapshot ? [server.snapshot] : [] };
        if (method === "PATCH") {
          server.snapshot = { ...server.snapshot, payload: body.payload, saved_at: body.saved_at, saved_by: body.saved_by };
          return { status: 200, body: [{ id: 2 }] };
        }
      }
      return { status: 404, body: { message: "unexpected" } };
    };
    if (behaviour === "network") throw new TypeError("Failed to fetch");
    if (behaviour === "hang") {
      return new Promise((_, reject) => options.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    }
    if (behaviour === "commit-then-drop") {
      run();
      throw new TypeError("Failed to fetch");
    }
    if (behaviour && typeof behaviour === "object") return reply(behaviour.status, behaviour.body);
    const { status, body: out } = run();
    return reply(status, out);
  };
  return server;
}

const rpcCalls = (server, name) => server.calls.filter((c) => c.url.includes(`/rpc/${name}`));
const fails = (code, pattern) => (error) => {
  assert.equal(error.code, code, error.message);
  if (pattern) assert.match(error.message, pattern);
  assert.doesNotMatch(error.message, /eyJ|access_token|refresh_token/);
  return true;
};

function uatCustomer(n, extra = {}) {
  const no = String(n).padStart(3, "0");
  return { id: `cust-uat-${no}`, accountNo: `acc000${no}`, name: `UAT CUSTOMER ${no}`, phone: "", groupId: "demo-branch-accra", collectorId: "demo-user-kwame", ...extra };
}

function collectionFor(customerId, amount, n = 1, extra = {}) {
  return { id: `col-uat-${n}`, idempotencyKey: `device-1:col-uat-${n}:2026-10-06T10:00:0${n}.000Z`, receiptNo: `ACC-0000000${n}`, paymentNo: `ACC-0000000${n}`,
    customerId, groupId: "demo-branch-accra", collectorId: "demo-user-kwame", userId: "demo-user-john", amount, amountPesewas: Math.round(amount * 100),
    date: "2026-10-06", paymentMethod: "Cash", paymentReference: "", verificationStatus: "Verified", reversed: false, createdAt: "2026-10-06T10:00:00.000Z", ...extra };
}

let server;
let state;
beforeEach(() => {
  memory.clear();
  cloud.resumeCloudUploads();
  server = fakeServer();
  state = deviceState();
  signIn();
});

// ------------------------------------------------------------------------------------------ customers

test("1: relational success registers the member exactly once, bound to the session and the database's location and collector", async () => {
  const customer = uatCustomer(1);
  const before = structuredClone(state);
  const result = await registerCustomerAuthoritatively(state, customer);
  assert.equal(result.status, "registered");
  assert.equal(server.load.customers.filter((c) => c.id === customer.id).length, 1);
  assert.equal(server.load.customers.length, 2);
  const [call] = rpcCalls(server, "upsert_customer_from_client");
  assert.deepEqual(
    { ...call.body.payload },
    { business_code: BIZ, customer_client_id: customer.id, account_no: "acc000001", customer_name: "UAT CUSTOMER 001", customer_phone: "",
      branch_client_id: "demo-branch-accra", branch_name: "Accra Main", collector_client_id: "demo-user-kwame", active: true }
  );
  assert.match(call.headers.Authorization, /^Bearer eyJ/, "the signed-in staff session authorizes the write");
  assert.equal(rpcCalls(server, "fetch_business_snapshot").length, 1, "a fresh database check precedes the write");
  assert.deepEqual(state, before, "the module never adds the member locally itself");
});

test("2: a server rejection leaves no member anywhere and says why", async () => {
  server.next.upsert_customer_from_client = [{ status: 400, body: { code: "P0001", message: "customer_client_id required" } }];
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1)), fails(WRITE_REJECTED, /refused it: customer_client_id required/));
  assert.equal(server.load.customers.length, 1);
});

test("3: a network failure is an unconfirmed outcome, never a registration; the same member retried is written once", async () => {
  const customer = uatCustomer(1);
  server.next.upsert_customer_from_client = ["network"];
  await assert.rejects(registerCustomerAuthoritatively(state, customer), fails(WRITE_UNCONFIRMED, /connection to the server failed/));
  assert.equal(server.load.customers.length, 1);
  assert.equal((await registerCustomerAuthoritatively(state, customer)).status, "registered");
  assert.equal(server.load.customers.filter((c) => c.id === customer.id).length, 1);
});

test("4: an account number already in the database is refused before sending, and the database constraint is the backstop", async () => {
  await assert.rejects(
    registerCustomerAuthoritatively(state, uatCustomer(1, { accountNo: REAL_CUSTOMER.accountNo.toLowerCase() })),
    fails(WRITE_REJECTED, /account number st-1001 is already used/)
  );
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 0, "nothing is sent");

  server.next.upsert_customer_from_client = [{ status: 409, body: { code: "23505", message: 'duplicate key value violates unique constraint "customers_account_no_uq"' } }];
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(2)), fails(WRITE_REJECTED, /account number acc000002 is already used by another member in the database/));
  assert.equal(server.load.customers.length, 1);
});

test("5: authorization failures are refused: RLS/047 refusal, no session, another business's session, a legacy access key", async () => {
  server.next.upsert_customer_from_client = [{ status: 403, body: { code: "42501", message: "member is assigned to another collector" } }];
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1)), fails(WRITE_REJECTED, /refused this account: member is assigned to another collector/));

  for (const setup of [
    () => localStorage.removeItem(SESSION_KEY),
    () => localStorage.setItem(SESSION_KEY, JSON.stringify(staffSession({ business: "OTHER-BIZ" }))),
    () => { localStorage.removeItem(SESSION_KEY); localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-access-key"); }
  ]) {
    memory.clear();
    setup();
    server.calls.length = 0;
    await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1)), fails(WRITE_REJECTED));
    assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 0);
  }
  assert.equal(server.load.customers.length, 1);
});

test("6: a retry with the same registration identity after a lost reply returns the original, never a second member", async () => {
  const customer = uatCustomer(1);
  server.next.upsert_customer_from_client = ["commit-then-drop"];
  await assert.rejects(registerCustomerAuthoritatively(state, customer), fails(WRITE_UNCONFIRMED));
  assert.equal(server.load.customers.filter((c) => c.id === customer.id).length, 1, "the server did commit");
  const retry = await registerCustomerAuthoritatively(state, customer);
  assert.equal(retry.status, "already-registered");
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 1, "the retry is answered from the database check");
  assert.equal(server.load.customers.filter((c) => c.id === customer.id).length, 1);
});

test("customers: ids the server would invent rows for are refused before sending (unknown collector, unknown location)", async () => {
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1, { collectorId: "device-only-collector" })), fails(WRITE_REJECTED, /collector is not in the database/));
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1, { groupId: "device-only-group" })), fails(WRITE_REJECTED, /location is not in the database/));
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 0, "ensure_app_user / ensure_branch never get a chance to create staff or branches");
  server.next.fetch_business_snapshot = ["network"];
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1)), fails(WRITE_REJECTED, /could not be checked first.*nothing was sent/));
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 0);
});

// ------------------------------------------------------------------------------------------ collections

async function registered(n = 1) {
  const customer = uatCustomer(n);
  await registerCustomerAuthoritatively(state, customer);
  state.customers.push(customer);
  return customer;
}

test("7: relational success records one collection and exactly one ledger credit of the amount", async () => {
  const customer = await registered();
  const result = await submitCollectionAuthoritatively(state, collectionFor(customer.id, 10));
  assert.equal(result.status, "recorded");
  assert.equal(server.load.collections.length, 1);
  assert.deepEqual(server.ledger, [{ collectionId: "col-uat-1", customerId: customer.id, amount: 10, direction: "credit" }]);
  const [call] = rpcCalls(server, "record_collection_from_client");
  assert.equal(call.body.payload.idempotency_key, collectionFor(customer.id, 10).idempotencyKey);
  assert.equal(call.body.payload.account_no, "acc000001");
  assert.equal(call.body.payload.amount_pesewas, 1000);
});

test("8: a server rejection posts nothing", async () => {
  const customer = await registered();
  server.next.record_collection_from_client = [{ status: 400, body: { code: "22023", message: "amounts cannot be negative" } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10)), fails(WRITE_REJECTED, /refused it: amounts cannot be negative/));
  assert.deepEqual([server.load.collections.length, server.ledger.length], [0, 0]);
});

test("9: an authorization rejection posts nothing", async () => {
  const customer = await registered();
  server.next.record_collection_from_client = [{ status: 403, body: { code: "42501", message: "member is assigned to another collector" } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10)), fails(WRITE_REJECTED, /refused this account/));
  server.next.record_collection_from_client = [{ status: 401, body: { message: "JWT expired" } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10)), fails(WRITE_REJECTED, /refused this account: JWT expired/));
  assert.deepEqual([server.load.collections.length, server.ledger.length], [0, 0]);
});

test("10: a member, location or collector the database does not hold is refused before sending (no server-side invention)", async () => {
  const deviceOnly = uatCustomer(9);
  state.customers.push(deviceOnly);
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(deviceOnly.id, 10)), fails(WRITE_REJECTED, /member is not in the database/));
  const customer = await registered();
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10, 2, { groupId: "old-group" })), fails(WRITE_REJECTED, /location is not in the database/));
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10, 3, { collectorId: "old-collector" })), fails(WRITE_REJECTED, /collector is not in the database/));
  assert.equal(rpcCalls(server, "record_collection_from_client").length, 0);
  server.next.record_collection_from_client = [{ status: 409, body: { code: "23505", message: "duplicate key" } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 10, 4)), fails(WRITE_REJECTED, /already holds a collection with receipt ACC-00000004/));
  assert.deepEqual([server.load.collections.length, server.ledger.length], [0, 0]);
});

test("11: submitting the same collection again never duplicates the financial effect", async () => {
  const customer = await registered();
  const collection = collectionFor(customer.id, 20);
  assert.equal((await submitCollectionAuthoritatively(state, collection)).status, "recorded");
  assert.equal((await submitCollectionAuthoritatively(state, collection)).status, "duplicate");
  assert.equal(rpcCalls(server, "record_collection_from_client").length, 1, "the repeat is answered from the database check");

  const staleLoad = { ...structuredClone(server.load), collections: [] };
  server.next.fetch_business_snapshot = [{ status: 200, body: staleLoad }];
  assert.equal((await submitCollectionAuthoritatively(state, collection)).status, "duplicate", "if the check misses it, the server's idempotency key still answers duplicate");
  assert.equal(rpcCalls(server, "record_collection_from_client").length, 2);
  assert.equal(server.load.collections.length, 1);
  assert.deepEqual(server.ledger.map((l) => l.amount), [20], "one credit of GHS 20.00");
});

test("12: timeouts, dropped connections and gateway errors are unconfirmed, never success; a lost reply then a retry posts once", async () => {
  const customer = await registered();
  server.next.record_collection_from_client = ["hang"];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 30), { timeoutMs: 20 }), fails(WRITE_UNCONFIRMED, /did not answer in time/));
  server.next.record_collection_from_client = ["network"];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 30)), fails(WRITE_UNCONFIRMED, /connection to the server failed/));
  server.next.record_collection_from_client = [{ status: 503, body: { message: "upstream timeout" } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 30)), fails(WRITE_UNCONFIRMED, /may or may not have saved it/));
  server.next.record_collection_from_client = [{ status: 200, body: { unexpected: true } }];
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, 30)), fails(WRITE_UNCONFIRMED, /did not confirm/));
  server.load.collections = [];
  server.ledger = [];

  const collection = collectionFor(customer.id, 40, 2);
  server.next.record_collection_from_client = ["commit-then-drop"];
  await assert.rejects(submitCollectionAuthoritatively(state, collection), fails(WRITE_UNCONFIRMED));
  assert.equal(server.ledger.length, 1, "the server committed even though the device heard nothing");
  assert.equal((await submitCollectionAuthoritatively(state, collection)).status, "duplicate");
  assert.equal(server.load.collections.length, 1);
  assert.equal(server.ledger.length, 1, "one ledger credit, not two");
});

test("13: an unconfirmed collection is held unposted with its original identity, and its retry reuses that identity", async () => {
  const customer = await registered();
  const collection = collectionFor(customer.id, 25);
  server.next.record_collection_from_client = ["network"];
  const error = await submitCollectionAuthoritatively(state, collection).catch((e) => e);
  assert.equal(error.code, WRITE_UNCONFIRMED);
  writes.holdCollectionForConfirmation(state, collection, error.message);
  writes.holdCollectionForConfirmation(state, collection, "again");
  assert.equal(writes.collectionsAwaitingConfirmation(state).length, 1, "held once");
  assert.equal(writes.collectionAwaitingConfirmationFor(state, customer.id).idempotencyKey, collection.idempotencyKey);
  assert.deepEqual(state.collections, [], "held collections are not posted");
  assert.deepEqual(state.ledgerEntries, []);

  const held = writes.collectionsAwaitingConfirmation(state)[0].collection;
  await submitCollectionAuthoritatively(state, held);
  const sent = rpcCalls(server, "record_collection_from_client").map((c) => c.body.payload);
  assert.equal(sent.length, 2);
  assert.deepEqual([sent[1].idempotency_key, sent[1].client_id, sent[1].receipt_no], [sent[0].idempotency_key, sent[0].client_id, sent[0].receipt_no]);
  writes.releaseCollectionConfirmation(state, collection.id);
  assert.deepEqual(writes.collectionsAwaitingConfirmation(state), []);
  assert.equal(server.ledger.length, 1);
});

// ------------------------------------------------------------------------------------------ app.js wiring

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const fn = (name) => {
  const start = appSource.search(new RegExp(`\\n(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const end = appSource.indexOf("\nfunction ", start + 10);
  const endAsync = appSource.indexOf("\nasync function ", start + 10);
  return appSource.slice(start, Math.min(...[end, endAsync].filter((i) => i > 0)));
};

test("14: the operator never sees a definitive success before the authoritative write succeeds", () => {
  const customer = fn("handleCustomer");
  const write = customer.indexOf("await registerCustomerAuthoritatively(state, created)");
  assert.ok(write > 0, "registration awaits the database write");
  assert.ok(write < customer.indexOf("state.customers.push(created)"), "the member is added locally only after it");
  assert.ok(write < customer.indexOf("ensureSavingsAccount(state, created"), "no savings account before it");
  assert.ok(write < customer.indexOf('"Member registered"'), "no success message before it");
  const failure = customer.slice(write, customer.indexOf("state.customers.push(created)"));
  assert.match(failure, /catch \(error\)[\s\S]*Member NOT (confirmed|registered)[\s\S]*return;/, "a failure reports and stops");
  assert.match(customer, /authoritative && !online\)[\s\S]{0,200}Member NOT registered/, "no offline registration while the database is authoritative");

  const collection = fn("handleCollection");
  const branch = collection.indexOf("await recordCollectionAuthoritatively(collection, customer, event.target)");
  assert.ok(branch > 0);
  assert.ok(branch < collection.indexOf("state.collections.push(collection)"), "authoritative mode returns before the legacy local posting");
  assert.ok(branch < collection.indexOf("Collection recorded"));
  assert.ok(collection.indexOf('event.target?.dataset?.submitting === "1"') < branch, "a second tap while waiting is refused");
  assert.ok(collection.indexOf("collectionAwaitingConfirmationFor(state, customer.id)") < branch, "no new collection for a member with one awaiting confirmation");

  const record = fn("recordCollectionAuthoritatively");
  assert.ok(record.indexOf("await submitCollectionAuthoritatively(state, collection)") < record.indexOf("finalizeConfirmedCollection("));
  assert.doesNotMatch(record, /state\.collections\.push|postDoubleEntry|Collection recorded\./, "nothing is posted or announced here");
  assert.match(record, /WRITE_UNCONFIRMED[\s\S]*hold\(/, "an unknown outcome is held, not posted");

  const finalize = fn("finalizeConfirmedCollection");
  assert.ok(finalize.indexOf("state.collections.push(collection)") < finalize.indexOf("Collection recorded."));
  const confirm = fn("confirmHeldCollection");
  assert.ok(confirm.indexOf("await submitCollectionAuthoritatively(state, collection)") < confirm.indexOf("finalizeConfirmedCollection("));
  assert.match(confirm, /WRITE_UNCONFIRMED \|\| !\(error\?\.status >= 400\)/, "a held collection is dropped only on a definitive server refusal");

  const flush = fn("flushOfflineQueueNow");
  assert.match(flush, /authoritativeWritesEnabled\(state\)\)[\s\S]{0,40}holdCollectionForConfirmation/, "queued offline collections are held, not posted locally");
  assert.match(flush, /if \(authoritativeWritesEnabled\(state\)\) return results;/, "and never pushed fire-and-forget");
  const bulk = fn("handleBulkCollection");
  assert.match(bulk, /await handleCollection\(submitEvent\)/);
  assert.match(fn("handleCustomerImport"), /authoritativeWritesEnabled\(state\)/, "bulk member import cannot create device-only members");
  assert.match(fn("handleImport"), /authoritativeWritesEnabled\(state\)/, "spreadsheet import cannot create device-only members or payments");
});

// ------------------------------------------------------------------------------------------ sync / security

function cloudRow(load) {
  return { id: 2, business_id: BIZ, payload: canonicalPayload(load, BIZ), saved_at: SAVED_AT, saved_by: "demo-user-john" };
}

test("15/16: a member or collection the server refused never enters the canonical snapshot, even if a device holds it", async () => {
  server.snapshot = cloudRow(relationalLoad());
  server.next.upsert_customer_from_client = [{ status: 403, body: { code: "42501", message: "refused" } }];
  const refusedMember = uatCustomer(1);
  await assert.rejects(registerCustomerAuthoritatively(state, refusedMember), fails(WRITE_REJECTED));
  const accepted = await registered(2);
  const heldCollection = collectionFor(accepted.id, 30, 7);
  server.next.record_collection_from_client = ["network"];
  await assert.rejects(submitCollectionAuthoritatively(state, heldCollection), fails(WRITE_UNCONFIRMED));
  writes.holdCollectionForConfirmation(state, heldCollection, "no answer");

  App.state = { ...structuredClone(state), customers: [...state.customers, refusedMember], collections: [collectionFor(refusedMember.id, 5, 8)] };
  App.syncBusy = false;
  await cloud.pushCloudBackup(false);
  const payload = server.snapshot.payload;
  assert.deepEqual(payload.customers.map((c) => c.id).sort(), ["cust-uat-002", REAL_CUSTOMER.id].sort(), "only database members");
  assert.deepEqual(payload.collections, [], "neither the held nor the device-only collection");
  assert.equal("pendingCollectionConfirmations" in payload, false);
  assert.deepEqual(canonical.canonicalSnapshotProblems(payload, { database: server.load, cloudPayload: cloudRow(relationalLoad()).payload, businessCode: BIZ }), []);
});

test("17: with nothing new in the database, the hardened sync still writes nothing", async () => {
  server.snapshot = cloudRow(relationalLoad());
  App.state = { ...structuredClone(state), customers: [...state.customers, uatCustomer(1)] };
  App.syncBusy = false;
  await cloud.pushCloudBackup(true);
  assert.equal(server.calls.filter((c) => c.method === "PATCH").length, 0);
});

test("18: a legacy access-key client cannot register members or record collections", async () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-access-key");
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(1)), fails(WRITE_REJECTED));
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(REAL_CUSTOMER.id, 10)), fails(WRITE_REJECTED));
  assert.equal(server.calls.filter((c) => /upsert_customer_from_client|record_collection_from_client/.test(c.url)).length, 0);
  assert.equal(server.calls.some((c) => JSON.stringify(c.headers).includes("legacy-access-key")), false);
});

test("19: the server guarantees this client relies on are present in the migrations", () => {
  const read = (name) => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  const m001 = read("001_financial_core.sql");
  assert.match(m001, /create unique index if not exists customers_account_no_uq\s+on public\.customers \(business_id, lower\(account_no\)\)/);
  assert.match(m001, /unique \(business_id, idempotency_key\),\s+unique \(business_id, receipt_no\)/);
  const m005 = read("005_production_auth_rls.sql");
  assert.match(m005, /where business_id = v_business_id and idempotency_key = v_idempotency;\s+if v_existing is not null then\s+return jsonb_build_object\('status', 'duplicate'/);
  assert.match(m005, /select id into v_id from public\.customers\s+where business_id = p_business_id and client_id = p_client_id;/, "members are matched by client id, never by account number");
  const m047 = read("047_security_hardening.sql");
  const wrapper = (name) => m047.slice(m047.indexOf(`create or replace function public.${name}(payload jsonb)`), m047.indexOf("end $b$;", m047.indexOf(`create or replace function public.${name}(payload jsonb)`)));
  for (const name of ["record_collection_from_client", "upsert_customer_from_client"]) {
    const body = wrapper(name);
    assert.match(body, /st_assert_business\(payload->>'business_code'\)/, `${name}: business bound to the session`);
    assert.match(body, /st_assert_customer_assignment/, `${name}: collectors limited to their members`);
    assert.match(body, /st_scope_staff_payload/, `${name}: actor derived from the session`);
  }
  assert.match(wrapper("record_collection_from_client"), /st_assert_payload_amounts/);
});

test("20: the existing real member is never changed by registrations, collections or refused attempts", async () => {
  const before = structuredClone(server.load.customers.find((c) => c.id === REAL_CUSTOMER.id));
  const customer = await registered(1);
  await submitCollectionAuthoritatively(state, collectionFor(customer.id, 10));
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(3, { accountNo: REAL_CUSTOMER.accountNo })), fails(WRITE_REJECTED));
  await assert.rejects(registerCustomerAuthoritatively(state, { ...uatCustomer(4), id: REAL_CUSTOMER.id, accountNo: "acc000004" }), fails(WRITE_REJECTED, /different member already uses this registration id/));
  assert.deepEqual(server.load.customers.find((c) => c.id === REAL_CUSTOMER.id), before);
  assert.deepEqual(server.ledger.filter((l) => l.customerId === REAL_CUSTOMER.id), []);
  assert.deepEqual(relationalLoad().customers[0], before, "the shared fixture itself is untouched");
});

test("money and messages: amounts are validated before sending and server text is length-limited with tokens masked", async () => {
  const customer = await registered();
  await assert.rejects(submitCollectionAuthoritatively(state, collectionFor(customer.id, -5)), fails(WRITE_REJECTED, /amount is not valid/));
  await assert.rejects(submitCollectionAuthoritatively(state, { ...collectionFor(customer.id, 5), idempotencyKey: "" }), fails(WRITE_REJECTED, /idempotency key/));
  server.next.record_collection_from_client = [{ status: 400, body: { message: `bad eyJabcdefghijkl.eyJabcdefghijkl.sig ${"x".repeat(400)}` } }];
  const error = await submitCollectionAuthoritatively(state, collectionFor(customer.id, 5)).catch((e) => e);
  assert.equal(error.code, WRITE_REJECTED);
  assert.match(error.message, /\[token\]/);
  assert.ok(error.message.length < 220);
});

// ------------------------------------------------------------------------------------------ member edits

const KUMASI = { id: "demo-branch-kumasi", name: "Kumasi", active: true, collectorCode: "KSI" };

async function registeredForEdit(n = 1) {
  const customer = await registered(n);
  server.load.groups.push(structuredClone(KUMASI));
  state.groups.push(structuredClone(KUMASI));
  return customer;
}

const editOf = (customer, extra = {}) => ({ name: customer.name, phone: "233240000001", groupId: customer.groupId, accountNo: customer.accountNo, ...extra });
const serverMember = (id) => server.load.customers.find((c) => c.id === id);

test("E1: a successful authoritative member edit updates name, phone and location of the same database member only", async () => {
  const customer = await registeredForEdit();
  const before = structuredClone(state);
  const result = await updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "UAT CUSTOMER 001 RENAMED", groupId: KUMASI.id }));
  assert.equal(result.status, "updated");
  const [, call] = rpcCalls(server, "upsert_customer_from_client");
  assert.deepEqual(call.body.payload, {
    business_code: BIZ, customer_client_id: customer.id, account_no: "acc000001", customer_name: "UAT CUSTOMER 001 RENAMED", customer_phone: "233240000001",
    branch_client_id: KUMASI.id, branch_name: "Kumasi", collector_client_id: "demo-user-kwame", active: true
  }, "account number, collector and active come from the database, never from the device");
  assert.deepEqual(
    { ...serverMember(customer.id) },
    { id: customer.id, accountNo: "acc000001", name: "UAT CUSTOMER 001 RENAMED", phone: "233240000001", groupId: KUMASI.id, collectorId: "demo-user-kwame",
      active: true, memberStatus: "Active", accountType: "personal" }
  );
  assert.equal(server.load.customers.length, 2, "an edit never adds a member");
  assert.deepEqual(state, before, "the module never changes the device copy itself");
});

test("E2: a relational rejection of an edit leaves the database member and the device unchanged", async () => {
  const customer = await registeredForEdit();
  const dbBefore = structuredClone(serverMember(customer.id));
  const before = structuredClone(state);
  server.next.upsert_customer_from_client = [{ status: 400, body: { code: "P0001", message: "business_code not found" } }];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "NEW NAME" })), fails(WRITE_REJECTED, /refused it: business_code not found/));
  assert.deepEqual(serverMember(customer.id), dbBefore);
  assert.deepEqual(state, before);
});

test("E3: a timeout or dropped reply is unconfirmed, never success; the retry finds the edit applied and changes nothing twice", async () => {
  const customer = await registeredForEdit();
  const edit = editOf(customer, { name: "NEW NAME" });
  server.next.upsert_customer_from_client = ["hang"];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, edit, { timeoutMs: 20 }), fails(WRITE_UNCONFIRMED, /did not answer in time/));
  assert.equal(serverMember(customer.id).name, customer.name);
  server.next.upsert_customer_from_client = [{ status: 502, body: { message: "bad gateway" } }];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, edit), fails(WRITE_UNCONFIRMED, /may or may not have saved it/));
  server.next.upsert_customer_from_client = [{ status: 200, body: { ok: false } }];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, edit), fails(WRITE_UNCONFIRMED, /did not confirm the edit/));

  server.next.upsert_customer_from_client = ["commit-then-drop"];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, edit), fails(WRITE_UNCONFIRMED, /connection to the server failed/));
  assert.equal(serverMember(customer.id).name, "NEW NAME", "the server did commit");
  const sentBefore = rpcCalls(server, "upsert_customer_from_client").length;
  assert.equal((await updateCustomerAuthoritatively(state, customer.id, edit)).status, "already-applied");
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, sentBefore, "the retry is answered from the database check");
});

test("E4: unauthorized edits are refused: 047/RLS refusal, no session, another business, legacy key, and a collector editing another collector's member", async () => {
  const customer = await registeredForEdit();
  const dbBefore = structuredClone(serverMember(customer.id));
  server.next.upsert_customer_from_client = [{ status: 403, body: { code: "42501", message: "member is assigned to another collector" } }];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "X" })), fails(WRITE_REJECTED, /refused this account/));
  for (const setup of [
    () => localStorage.removeItem(SESSION_KEY),
    () => localStorage.setItem(SESSION_KEY, JSON.stringify(staffSession({ business: "OTHER-BIZ" }))),
    () => { localStorage.removeItem(SESSION_KEY); localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-access-key"); },
    () => signIn({ role: "Collector", appUserId: "demo-user-other", username: "other" })
  ]) {
    memory.clear();
    setup();
    server.calls.length = 0;
    await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "X" })), fails(WRITE_REJECTED));
    assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 0, "nothing is sent");
  }
  assert.deepEqual(serverMember(customer.id), dbBefore);

  memory.clear();
  signIn({ role: "Collector", appUserId: "demo-user-other", username: "other" });
  await assert.rejects(registerCustomerAuthoritatively(state, uatCustomer(5)), fails(WRITE_REJECTED, /assign this member to your own account/),
    "a registration the server would silently re-assign to the caller is refused too");
});

test("E4b: a collector may edit their own member; the server keeps them as collector", async () => {
  server.load.users.push({ id: "demo-user-esi", username: "esi", name: "Esi Collector", role: "Collector", groupId: "demo-branch-accra", active: true, authEmail: null });
  const customer = await registeredForEdit();
  serverMember(customer.id).collectorId = "demo-user-esi";
  memory.clear();
  signIn({ role: "Collector", appUserId: "demo-user-esi", username: "esi" });
  assert.equal((await updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "ESI MEMBER" }))).status, "updated");
  assert.deepEqual([serverMember(customer.id).name, serverMember(customer.id).collectorId], ["ESI MEMBER", "demo-user-esi"]);
});

test("E5: account-number changes and members the database does not hold are refused before sending (no upsert-insert)", async () => {
  const customer = await registeredForEdit();
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { accountNo: REAL_CUSTOMER.accountNo })),
    fails(WRITE_REJECTED, /account number cannot be changed here; the database holds acc000001/));
  const deviceOnly = uatCustomer(9);
  await assert.rejects(updateCustomerAuthoritatively(state, deviceOnly.id, editOf(deviceOnly)), fails(WRITE_REJECTED, /not in the database.*nothing was sent/));
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 1, "only the original registration was ever sent");
  assert.equal(server.load.customers.length, 2);
  assert.equal(server.load.customers.some((c) => c.id === deviceOnly.id), false);
});

test("E6: an unknown location, an unknown collector or a missing name/phone is refused before sending", async () => {
  const customer = await registeredForEdit();
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { groupId: "device-only-group" })), fails(WRITE_REJECTED, /location is not in the database/));
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { phone: "" })), fails(WRITE_REJECTED, /missing a name, phone or location/));
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "  " })), fails(WRITE_REJECTED, /missing a name, phone or location/));
  server.load.users = server.load.users.filter((u) => u.id !== "demo-user-kwame");
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "X" })), fails(WRITE_REJECTED, /collector is not in the database/));
  assert.equal(rpcCalls(server, "upsert_customer_from_client").length, 1, "only the original registration was ever sent");
  server.next.fetch_business_snapshot = ["network"];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "X" })), fails(WRITE_REJECTED, /could not be checked first/));
});

test("E7: repeating an edit, even past a stale database check, never duplicates the member", async () => {
  const customer = await registeredForEdit();
  const edit = editOf(customer, { name: "REPEATED" });
  assert.equal((await updateCustomerAuthoritatively(state, customer.id, edit)).status, "updated");
  assert.equal((await updateCustomerAuthoritatively(state, customer.id, edit)).status, "already-applied");
  const stale = structuredClone(server.load);
  stale.customers.find((c) => c.id === customer.id).name = customer.name;
  server.next.fetch_business_snapshot = [{ status: 200, body: stale }];
  assert.equal((await updateCustomerAuthoritatively(state, customer.id, edit)).status, "updated", "the server updates by client id");
  assert.equal(server.load.customers.filter((c) => c.id === customer.id).length, 1);
  assert.equal(server.load.customers.length, 2);
});

test("E8: member edits never change the existing real member or the shared fixture", async () => {
  const before = structuredClone(serverMember(REAL_CUSTOMER.id));
  const customer = await registeredForEdit();
  await updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "OTHER", groupId: KUMASI.id }));
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { accountNo: REAL_CUSTOMER.accountNo })), fails(WRITE_REJECTED));
  assert.deepEqual(serverMember(REAL_CUSTOMER.id), before);
  assert.deepEqual(relationalLoad().customers[0], before);
});

test("E9: a refused or device-only member edit never reaches the canonical snapshot", async () => {
  server.snapshot = cloudRow(relationalLoad());
  const customer = await registeredForEdit();
  server.next.upsert_customer_from_client = [{ status: 403, body: { code: "42501", message: "refused" } }];
  await assert.rejects(updateCustomerAuthoritatively(state, customer.id, editOf(customer, { name: "REFUSED NAME" })), fails(WRITE_REJECTED));
  const device = structuredClone(state);
  Object.assign(device.customers.find((c) => c.id === customer.id), { name: "REFUSED NAME", phone: "233249999999", groupId: KUMASI.id, memberStatus: "Closed", updatedAt: new Date().toISOString() });
  App.state = device;
  App.syncBusy = false;
  await cloud.pushCloudBackup(false);
  assert.equal(server.calls.filter((c) => c.method === "PATCH").length, 1, "the snapshot was rewritten from the database");
  const member = (server.snapshot.payload.customers || []).find((c) => c.id === customer.id);
  assert.deepEqual([member.name, member.phone, member.groupId, member.memberStatus], [customer.name, "", "demo-branch-accra", "Active"], "the snapshot keeps the database's values");
});

test("E10: the member-edit handler confirms with the database before changing the device or announcing success", () => {
  const customer = fn("handleCustomer");
  const edit = customer.slice(customer.indexOf("if (data.id) {"), customer.indexOf("const accountNo = String(data.accountNo"));
  const write = edit.indexOf("await updateCustomerAuthoritatively(state, customer.id");
  assert.ok(write > 0, "edits await the database write");
  for (const marker of ["Object.assign(customer, payload)", "setCustomerStatus(customer", "ensureSavingsAccount(state, customer", "saveState(", 'logAudit("Member edited"', "Member saved"]) {
    assert.ok(write < edit.indexOf(marker), `nothing (${marker}) happens before it`);
  }
  assert.match(edit.slice(write), /catch \(error\)[\s\S]*Member edit NOT (confirmed|saved)[\s\S]*return;/, "a failure reports and stops");
  assert.match(edit, /payload\.memberStatus !== previousStatus\)[\s\S]{0,80}Member NOT saved: a member's status cannot be changed/, "status changes have no protected database path and are refused");
  assert.match(edit, /navigator\.onLine === false\)[\s\S]{0,80}Member NOT saved: editing a member needs a connection/);
  assert.match(edit, /kept on this device only/, "device-only profile details are labelled as such");
});

// ------------------------------------------------------------------------------------------ payment verification (blocker)

test("B (blocker, documented): electronic payment verification has no server-authoritative path yet", async () => {
  const verify = fn("verifyPayment");
  assert.doesNotMatch(verify, /fetch\(|callProtectedRpc|restFetch|rpc\//, "Verify changes only this device today");
  assert.match(verify, /collection\.verificationStatus = "Verified"/);

  const read = (name) => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  const m005 = read("005_production_auth_rls.sql");
  assert.match(m005, /if v_amount > 0 and coalesce\(\(payload->>'reversed'\)::boolean, false\) = false then\s+insert into public\.ledger_entries/,
    "the server credits the ledger on submission whatever the verification status");
  assert.match(m005, /c\.payment_method = 'Mobile Money'/, "record_momo_webhook only matches the literal method 'Mobile Money'");
  const { COLLECTION_METHODS } = await import("../src/core/collection-ops.js");
  assert.deepEqual(COLLECTION_METHODS.filter((m) => m !== "Cash" && m !== "Mobile Money"),
    ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money", "Bank Transfer", "POS/Card", "Cheque"],
    "so these electronic methods the app records can never be verified by it");
  const m047 = read("047_security_hardening.sql");
  assert.match(m047, /\('collections', array\['verification_status', 'reversed'\]\)/, "the column may change only through server functions");
  assert.match(m047, /foreach t in array array\['collections', 'ledger_entries',[\s\S]{0,1200}?revoke insert, update, delete, truncate on public\.%I from anon, authenticated/, "clients cannot update collections");
  const all = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).map(read).join("\n");
  assert.doesNotMatch(all, /create or replace function public\.verify_[a-z_]*collection|create or replace function public\.[a-z_]*verify_payment/, "no verification RPC exists yet");
});

test("T: the www mirror of the module is the source (checked when present)", () => {
  const www = new URL("../www/src/sync/authoritative-writes.js", import.meta.url);
  if (!fs.existsSync(www)) return;
  assert.equal(fs.readFileSync(www, "utf8"), fs.readFileSync(new URL("../src/sync/authoritative-writes.js", import.meta.url), "utf8"));
});
