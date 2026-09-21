import test from "node:test";
import assert from "node:assert/strict";
import { applyUnifiedCloudDefaults, unifiedCloudEnabled } from "../src/config.js";
import { restoreUsersFromCloud } from "../src/sync/snapshot-security.js";

test("applyUnifiedCloudDefaults forces unified supabase settings", () => {
  const state = {
    settings: {
      cloudUrl: "",
      cloudKey: "",
      relationalSync: false,
      postgresSourceOfTruth: false,
      unifiedCloud: false
    },
    users: [],
    customers: [],
    collections: []
  };
  applyUnifiedCloudDefaults(state, {
    supabaseUrl: "https://demo.supabase.co",
    supabaseAnonKey: "anon-key",
    businessId: "st-demo",
    syncAccessKey: "secret-key-at-least-32-characters-long",
    unifiedCloud: true
  });
  assert.equal(state.settings.relationalSync, true);
  assert.equal(state.settings.postgresSourceOfTruth, true);
  assert.equal(state.settings.unifiedCloud, true);
  assert.equal(state.settings.cloudMode, "supabase");
  assert.equal(state.settings.businessId, "st-demo");
});

test("unifiedCloudEnabled when supabase configured", () => {
  const state = {
    settings: {
      cloudUrl: "https://demo.supabase.co",
      cloudKey: "anon-key"
    }
  };
  assert.equal(unifiedCloudEnabled(state, { unifiedCloud: true }), true);
});

test("restoreUsersFromCloud keeps local password hashes", () => {
  const localUsers = [{
    id: "u-owner",
    username: "JOHN",
    passwordHash: "local-hash",
    role: "KBA",
    active: true
  }];
  const remoteUsers = [{
    id: "u-owner",
    username: "JOHN",
    passwordHash: "[protected]",
    role: "KBA",
    active: true
  }];
  const merged = restoreUsersFromCloud(localUsers, remoteUsers);
  assert.equal(merged[0].passwordHash, "local-hash");
});
