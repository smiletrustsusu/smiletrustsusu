import test from "node:test";
import assert from "node:assert/strict";
import { getSyncMode } from "../src/config.js";

test("auto mode picks supabase when supabase url set", () => {
  const mode = getSyncMode({
    settings: {
      cloudMode: "auto",
      cloudUrl: "https://demo.supabase.co",
      localBackupUrl: "http://localhost:8787"
    }
  });
  assert.equal(mode, "supabase");
});

test("auto mode picks local when only local url set", () => {
  const mode = getSyncMode({
    settings: {
      cloudMode: "auto",
      cloudUrl: "",
      localBackupUrl: "http://localhost:8787"
    }
  });
  assert.equal(mode, "local");
});

test("explicit local mode", () => {
  const mode = getSyncMode({
    settings: {
      cloudMode: "local",
      cloudUrl: "https://demo.supabase.co",
      localBackupUrl: "http://192.168.1.20:8787"
    }
  });
  assert.equal(mode, "local");
});

test("none when unset", () => {
  const mode = getSyncMode({ settings: { cloudMode: "auto", cloudUrl: "", localBackupUrl: "" } });
  assert.equal(mode, "none");
});
