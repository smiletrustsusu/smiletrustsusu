import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROLE, ROLE_CODES, LEGACY_SQL_ROLE_ALIASES } from "../src/core/roles.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration045 = fs.readFileSync(
  path.join(root, "supabase/migrations/045_app_users_role_rbac_align.sql"),
  "utf8"
);
const productionMd = fs.readFileSync(path.join(root, "PRODUCTION.md"), "utf8");

test("GAP-010 migration 045 includes every JS ROLE code", () => {
  for (const code of ROLE_CODES) {
    assert.match(migration045, new RegExp(`'${code}'`), `missing role ${code}`);
  }
  for (const legacy of LEGACY_SQL_ROLE_ALIASES) {
    assert.match(migration045, new RegExp(`'${legacy}'`), `missing legacy ${legacy}`);
  }
  assert.match(migration045, /drop constraint if exists app_users_role_check/i);
  assert.match(migration045, /add constraint app_users_role_check/i);
});

test("GAP-010 SystemOwner is JS SoT; Owner remains legacy alias only", () => {
  assert.equal(ROLE.SYSTEM_OWNER, "SystemOwner");
  assert.ok(ROLE_CODES.includes("SystemOwner"));
  assert.ok(!ROLE_CODES.includes("Owner"));
  assert.ok(LEGACY_SQL_ROLE_ALIASES.includes("Owner"));
});

test("SUPER_ADMIN_FORBIDDEN unchanged by role CHECK work", () => {
  assert.deepEqual(SUPER_ADMIN_FORBIDDEN.slice().sort(), ["Export.All", "Owner.Transfer", "System.Reset"].sort());
});

test("GAP-006 PRODUCTION.md lists migrations 001–044 and 045 + rls.sql", () => {
  assert.match(productionMd, /supabase\/rls\.sql/);
  assert.match(productionMd, /001_financial_core\.sql/);
  assert.match(productionMd, /044_wave2_database_platform\.sql/);
  assert.match(productionMd, /045_app_users_role_rbac_align\.sql/);
  for (let i = 1; i <= 44; i += 1) {
    const pad = String(i).padStart(3, "0");
    assert.match(productionMd, new RegExp(`${pad}_`), `missing migration ${pad} in PRODUCTION.md`);
  }
});
