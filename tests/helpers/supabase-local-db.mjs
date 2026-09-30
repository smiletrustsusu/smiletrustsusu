/**
 * Throwaway local PostgreSQL that mimics the Supabase pieces our migrations rely on:
 * anon / authenticated / service_role roles, auth.jwt() from request.jwt.claims, and
 * Supabase's permissive default grants (so tests prove RLS, not missing grants, blocks access).
 * Never connects to a remote database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SUPABASE_STUB_SQL = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;
grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter role postgres set search_path = public, extensions;
set search_path = public, extensions;
`;

export function migrationFiles() {
  const dir = path.join(root, "supabase", "migrations");
  return fs.readdirSync(dir).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

export function snapshotTableSql() {
  return fs.readFileSync(path.join(root, "supabase", "rls.sql"), "utf8");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export async function loadEmbeddedPostgres() {
  try {
    const mod = await import("embedded-postgres");
    return mod.default || mod;
  } catch {
    return null;
  }
}

/**
 * Start a disposable cluster, apply the stub + snapshot table + every migration up to `upTo`.
 * Returns { query, asRole, stop, applied }.
 */
export async function startLocalSupabase({ upTo = "999", onlyThrough } = {}) {
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  if (!EmbeddedPostgres) return null;
  const { default: pgLib } = await import("pg");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-sec-pg-"));
  const port = await freePort();
  const password = `local-${Math.random().toString(36).slice(2)}`;
  const cluster = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password,
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {}
  });
  await cluster.initialise();
  await cluster.start();
  const client = new pgLib.Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres" });
  await client.connect();
  await client.query(SUPABASE_STUB_SQL);
  await client.query(snapshotTableSql());
  const applied = [];
  for (const file of migrationFiles()) {
    const prefix = file.name.slice(0, 3);
    if (prefix > upTo) break;
    if (onlyThrough && prefix > onlyThrough) break;
    try {
      await client.query(file.sql);
      applied.push({ name: file.name, ok: true });
    } catch (error) {
      applied.push({ name: file.name, ok: false, error: error.message });
    }
  }

  async function asRole(role, claims, fn) {
    await client.query("begin");
    try {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || {})]);
      await client.query(`set local role ${role}`);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  async function stop() {
    await client.end().catch(() => {});
    await cluster.stop().catch(() => {});
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch {
      // Windows can keep the stopped server's files locked briefly; the OS temp cleaner removes leftovers.
    }
  }

  return { query: (sql, params) => client.query(sql, params), asRole, stop, applied };
}
