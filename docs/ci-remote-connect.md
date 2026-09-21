# CI & Git remote connect (GAP-007)

**Status:** Workflow scaffold **In Progress** — org must still attach a real remote.  
**Do not invent remotes or GitHub orgs in docs.**

---

## What is in-repo

| Artifact | Role |
|----------|------|
| `.github/workflows/ci.yml` | On push/PR to `main`/`master`/`develop` (+ `workflow_dispatch`): `npm ci` → `prepare:web` → `check:channels` → `npm test` → `validate:rc` → `validate:pilot` → `hash:artifacts` |
| Concurrency | Cancels overlapping runs on the same ref |
| Permissions | `contents: read` only |
| `npm run check:channels` | Android path + Electron signing smoke (PowerShell-safe; no `&&`) |
| `npm run check:android` | Capacitor path smoke (no SDK required unless `--strict-sdk`) |
| `npm run check:electron-signing` | Pilot-safe updater/signing defaults (no fake certs); writes `docs/release-evidence/electron-signing-check.json` |
| `npm run hash:artifacts` | Records SHA-256 for any APK/EXE present (partial OK) |

CI uses npm cache via `actions/setup-node` `cache: npm`.

---

## Connect a remote (owner steps)

Run these only when your org has created the empty repository. Replace placeholders with **your** URL — do not copy invented hosts.

Helper script (requires env; dry-run by default):

```powershell
# From repo root — inspect first
git status
git remote -v

# Set YOUR org URL (required — script refuses placeholders)
$env:SMILE_GIT_REMOTE = "https://github.com/<ORG>/<REPO>.git"
npm run git:connect-remote
npm run git:connect-remote -- --apply

# Then (human):
# git branch -M main
# git push -u origin main
```

Manual equivalent if you prefer raw git:

```powershell
# If no origin yet (example shape only — replace <ORG>/<REPO>):
# git remote add origin https://github.com/<ORG>/<REPO>.git
# git branch -M main
# git push -u origin main
```

After the first push, confirm Actions:

1. GitHub → **Actions** → workflow **CI**
2. Or: `gh run list` ; `gh workflow view CI` when `gh` is authenticated

Optional org policy (not required for GAP-007 Complete): branch protection requiring the CI job on `main`.

---

## Local parity (no remote required)

PowerShell — use `;` between commands (not `&&`):

```powershell
npm ci
npm run prepare:web
npm run check:channels
npm test
npm run validate:rc
npm run validate:pilot
npm run hash:artifacts
```

---

## Still open for GAP-007 Completed

- [ ] Org VCS remote attached (`git remote -v` shows origin)
- [ ] At least one green Actions run on the default branch
- [ ] Branch protection optional (org policy)

*docs/ci-remote-connect.md — GAP-007*
