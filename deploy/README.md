# Deploy

Deployment packaging for this product:

- Web mirror: `npm run prepare:web` → `www/`
- Windows EXE: `npm run build:exe` (Electron)
- Android APK: `npm run build:apk` / `build:apk:release`

## Environment profiles (GAP-016 / TASK-000184)

Non-secret config profiles live under `deploy/profiles/`:

| File | Purpose |
|------|---------|
| [`profiles/pilot.json`](./profiles/pilot.json) | Pilot / UAT channel expectations |
| [`profiles/prod.json`](./profiles/prod.json) | Production channel expectations |

These are **manifests for operators and readiness checks** — they do not contain API keys, MoMo secrets, keystore passwords, or CSC credentials. Fill real values via org env / secret stores cited in each profile. Do not invent certificates or flip human Approvals from these files.

Operational runbooks: Wave 9/10 evidence, [`docs/backlog/org-handoff-checklist.md`](../docs/backlog/org-handoff-checklist.md), `PRODUCTION.md`.

Do not introduce a separate HTTP application server for Module 20 contracts — they remain in-process.
