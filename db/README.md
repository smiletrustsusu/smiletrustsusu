# Database artifacts

Canonical PostgreSQL migrations and RLS live under `supabase/` (especially `supabase/migrations/`).

Wave 2 (Database Platform) owns schema alignment and hardening:

| Artifact | Path |
|----------|------|
| Additive hardening migration | `supabase/migrations/044_wave2_database_platform.sql` |
| Lab rollback | `supabase/rollbacks/044_wave2_database_platform.rollback.sql` |
| Exit package | `docs/wave2-database.md` |
| Static tests | `tests/wave2-database.test.js` |
| Registry | `src/core/canonical-database-registry.js` (MIG-044 + Wave 2 tables) |

This `db/` folder exists for local notes, dumps, and tooling paths without relocating the Supabase SoT.

Do not store secrets or production dumps here.
