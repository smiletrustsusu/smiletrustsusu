import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKEND_IDENTITY_KEY,
  BACKEND_QUARANTINE_INDEX_KEY,
  QUARANTINE_PREFIX,
  backendIdentity,
  enforceBackendIdentity,
  sameBackend,
  takeQuarantineNotice
} from "../src/core/backend-guard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_URL = "https://old-project.supabase.co";
const NEW_URL = "https://new-project.supabase.co";
const NEW_CONFIG = { supabaseUrl: NEW_URL, businessId: "SMILE-TRUST" };
const NOW = "2026-09-30T10:11:12.000Z";

class MemoryStorage {
  constructor(entries = {}, { failOnPrefix = null } = {}) {
    this.map = new Map(Object.entries(entries));
    this.failOnPrefix = failOnPrefix;
  }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.failOnPrefix && key.startsWith(this.failOnPrefix)) {
      const error = new Error("QuotaExceededError");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.map.set(key, String(value));
  }
  removeItem(key) { this.map.delete(key); }
  keys() { return [...this.map.keys()]; }
}

function oldDevice(extra = {}) {
  const state = JSON.stringify({ settings: { cloudUrl: OLD_URL, businessId: "st-old" }, customers: [{ id: "c1" }] });
  return new MemoryStorage({
    smile_trust_susu_v1: state,
    smile_trust_offline_queue_v1: JSON.stringify([{ id: "q1" }]),
    smile_trust_susu_sync_url: OLD_URL,
    smile_trust_susu_cloud_key: "old-public-key",
    smile_trust_business_id: "st-old",
    smile_trust_susu_remembered_login: "JOHN",
    ...extra
  });
}

test("backend identity compares host and business code", () => {
  assert.equal(backendIdentity("not a url", "x"), null);
  assert.deepEqual(backendIdentity("https://ABC.supabase.co/rest/v1", " SMILE-TRUST "), { host: "abc.supabase.co", businessId: "SMILE-TRUST" });
  assert.equal(sameBackend(backendIdentity(OLD_URL, "a"), backendIdentity(NEW_URL, "a")), false);
  assert.equal(sameBackend(backendIdentity(NEW_URL, "a"), backendIdentity(NEW_URL, "b")), false);
  assert.equal(sameBackend(backendIdentity(NEW_URL, "a"), backendIdentity(`${NEW_URL}/`, "a")), true);
  assert.equal(sameBackend(backendIdentity(NEW_URL, ""), backendIdentity(NEW_URL, "a")), true);
});

test("a device synced with another project is quarantined and starts clean", () => {
  const storage = oldDevice();
  const originalState = storage.getItem("smile_trust_susu_v1");
  const sessionStore = new MemoryStorage({ smile_trust_session_user: "u1", smile_trust_portal_session: "tok" });
  const result = enforceBackendIdentity({ storage, sessionStore, config: NEW_CONFIG, now: NOW });

  assert.equal(result.quarantined, true);
  assert.equal(result.from.host, "old-project.supabase.co");
  assert.equal(result.to.host, "new-project.supabase.co");
  assert.equal(storage.getItem("smile_trust_susu_v1"), null);
  assert.equal(storage.getItem("smile_trust_offline_queue_v1"), null, "pending uploads from the old backend must not be replayed");
  assert.equal(storage.getItem(`${QUARANTINE_PREFIX}:20260930101112:smile_trust_susu_v1`), originalState, "old data is preserved byte-for-byte");
  for (const key of ["smile_trust_susu_sync_url", "smile_trust_susu_cloud_key", "smile_trust_business_id", "smile_trust_susu_remembered_login"]) {
    assert.equal(storage.getItem(key), null, `${key} must be cleared`);
  }
  assert.deepEqual(sessionStore.keys(), []);
  assert.deepEqual(JSON.parse(storage.getItem(BACKEND_IDENTITY_KEY)), { host: "new-project.supabase.co", businessId: "SMILE-TRUST" });
});

test("a business-code change on the same project also quarantines", () => {
  const storage = oldDevice({ smile_trust_susu_sync_url: NEW_URL });
  storage.setItem(BACKEND_IDENTITY_KEY, JSON.stringify({ host: "new-project.supabase.co", businessId: "st-other" }));
  const result = enforceBackendIdentity({ storage, config: NEW_CONFIG, now: NOW });
  assert.equal(result.quarantined, true);
});

test("the same backend and fresh devices are left untouched", () => {
  const same = oldDevice({ smile_trust_susu_sync_url: NEW_URL, smile_trust_business_id: "SMILE-TRUST" });
  const before = same.getItem("smile_trust_susu_v1");
  assert.equal(enforceBackendIdentity({ storage: same, config: NEW_CONFIG, now: NOW }).quarantined, false);
  assert.equal(same.getItem("smile_trust_susu_v1"), before);
  assert.equal(same.getItem("smile_trust_susu_cloud_key"), "old-public-key");

  const fresh = new MemoryStorage();
  assert.equal(enforceBackendIdentity({ storage: fresh, config: NEW_CONFIG, now: NOW }).quarantined, false);
  assert.ok(fresh.getItem(BACKEND_IDENTITY_KEY));

  const noConfig = oldDevice();
  assert.equal(enforceBackendIdentity({ storage: noConfig, config: {}, now: NOW }).quarantined, false);
  assert.ok(noConfig.getItem("smile_trust_susu_v1"), "no bundled backend means nothing to compare against");
});

test("quarantine runs once; the next launch keeps the new backend's data", () => {
  const storage = oldDevice();
  enforceBackendIdentity({ storage, config: NEW_CONFIG, now: NOW });
  storage.setItem("smile_trust_susu_v1", JSON.stringify({ settings: {}, customers: [] }));
  const again = enforceBackendIdentity({ storage, config: NEW_CONFIG, now: "2026-10-01T00:00:00.000Z" });
  assert.equal(again.quarantined, false);
  assert.ok(storage.getItem("smile_trust_susu_v1"));
  assert.equal(JSON.parse(storage.getItem(BACKEND_QUARANTINE_INDEX_KEY)).length, 1);
});

test("a storage failure rolls back and blocks instead of losing data", () => {
  const storage = oldDevice();
  storage.failOnPrefix = `${QUARANTINE_PREFIX}:`;
  const snapshot = new Map(storage.map);
  const result = enforceBackendIdentity({ storage, config: NEW_CONFIG, now: NOW });
  assert.equal(result.quarantined, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(new Map(storage.map), snapshot, "every original key is restored and nothing else is written");
});

test("the quarantine notice is shown exactly once", () => {
  const storage = oldDevice();
  enforceBackendIdentity({ storage, config: NEW_CONFIG, now: NOW });
  const notice = takeQuarantineNotice(storage);
  assert.equal(notice.from.host, "old-project.supabase.co");
  assert.equal(takeQuarantineNotice(storage), null);
  assert.equal(takeQuarantineNotice(new MemoryStorage()), null);
});

test("no app or sync code reads quarantined keys or enumerates local storage", () => {
  const files = [path.join(root, "app.js")];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js") && entry.name !== "backend-guard.js") files.push(full);
    }
  };
  walk(path.join(root, "src"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /smile_trust_quarantine|QUARANTINE_PREFIX/, `${path.relative(root, file)} must not read quarantined data`);
    assert.doesNotMatch(source, /localStorage\.key\(|Object\.(keys|entries)\(localStorage\)/, `${path.relative(root, file)} must not enumerate storage`);
  }
});

test("app startup runs the guard before any sync starts", () => {
  const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const guard = source.indexOf("enforceBackendIdentity({");
  assert.ok(guard > 0);
  assert.ok(guard < source.indexOf("startAutoCloudSync();", guard), "guard must run before auto cloud sync");
  assert.ok(guard > source.indexOf("await loadAppConfig();"), "guard needs the bundled config");
});
