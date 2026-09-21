# WAVE-06 — Enterprise Windows Desktop (EXE)

**Status:** Delivered as Electron shared-core SPA shell hardening  
**Date:** 2026-09-15  
**Wave:** WAVE-06 · MIB LOANS (mapped) · Module 8 (deferred deep-work) · Phases 3, 4, 16  

---

## 1. Architecture decision (do NOT violate)

```
SUPABASE → Wave 3 invokeApi / ops → Shared Business Logic
    ├── Android APK (Capacitor)
    ├── Web Admin Portal (SPA)
    └── Windows EXE (Electron)   ← this wave
```

| Channel | Runtime |
|---|---|
| Web | Shared SPA (`app.js` + `src/`) |
| Desktop EXE | **Electron** loads `www/` after `prepare:web` |
| Android APK | Capacitor loads the same `www/` |

Wave 3 APIs are **in-process `invokeApi` contracts**. Wave 4 sync is shared JS (`src/sync/*`).

### Why Wave 6 is **not** Electron + Next.js + React + TypeScript + SQLite

- Would **duplicate** Modules 1–30 UI and money rules already in the SPA
- Would **break EXE ↔ APK synchronization** (historical pain: divergent desktop stacks)
- Would violate project invariants (**no** Next.js / Flutter rewrite; shared-core model)
- Would invent a second business DB instead of the Wave 1/4 **encrypted offline queue**
- Money posting (integer **pesewas**), interest **15**, collection days **31**, cashier GHS **1000**, `SUPER_ADMIN_FORBIDDEN`, and SystemOwner **john** already live in the shared JS core

**Wave 6 value** = Electron shell hardening + packaging + shared-core parity so branch-office EXE uses identical auth, APIs, money rules, and Wave 4 sync as Android/Web.

### Catalog mapping (EIR name vs delivery)

| Field | Value |
|---|---|
| Delivery name | **Windows Desktop EXE** (`WINDOWS_EXE`) |
| Historical EIR catalog name | Loan Platform (`LOAN_PLATFORM`) |
| MIB wave 10 LOANS / Module 8 | Still mapped to `WAVE-06` |
| Loan deep SM rewrite | **Mostly Complete / deferred** — not the EXE focus |

---

## 2. Gap analysis

| ID | Item | Status |
|---|---|---|
| W6-G01 | contextIsolation + sandbox + no nodeIntegration | Closed |
| W6-G02 | Preload bridge (print/export/secure storage/device/updates) | Closed |
| W6-G03 | IPC allowlist | Closed |
| W6-G04 | Shared Wave 4 sync + desktop wake hooks | Closed |
| W6-G05 | Encrypted offline queue reused (no SQLite business DB) | Closed |
| W6-G06 | Loads `www/` SPA (not Next.js) | Closed |
| W6-G07 | Print / printToPDF / export bridges | Closed |
| W6-G08 | electron-builder NSIS + portable | Closed |
| W6-G09 | electron-updater scaffolding + signing docs | Closed |
| W6-G10 | CSP + navigation locks + external link allowlist | Closed |
| W6-G11 | Desktop a11y / screenshot guidance (reuse Wave 5) | Closed |
| W6-G12 | Monitoring + sync health hooks | Closed |
| W6-G13 | Code-signing certificates in CI/pilot env | **Partial** — hooks/docs only |
| W6-G14 | Loan Platform deep SM rewrite | **Deferred** |

Runtime: `analyzeWave6Gaps()` / `WAVE6_GAP_CHECKLIST` in `src/core/wave6-windows-exe-ops.js`.

---

## 3. Key files

| Path | Role |
|---|---|
| `electron/main.js` | Hardened main: sandbox, CSP, nav locks, print/export IPC, wake sync |
| `electron/preload.js` | `contextBridge` → `window.smileTrustDesktop` |
| `electron/ipc-channels.js` | Secure IPC allowlist |
| `electron/secure-vault.js` | `safeStorage`-backed session/token vault |
| `electron/updater.js` | electron-updater scaffolding |
| `src/platform/electron-shell.js` | SPA-side desktop bridges + wake wiring |
| `src/core/wave6-windows-exe-ops.js` | Gaps, parity, `runDesktopWave4Sync` |
| `src/ui/desktop-shell-views.js` | Backup/Sync panel status (no new nav) |
| `src/sync/offline-sync-engine.js` | **Same** Wave 4 engine as Android |
| `package.json` `build` | NSIS + portable electron-builder |

---

## 4. Sync parity (EXE ↔ APK)

1. Desktop wake: `powerMonitor` resume / unlock + 5-minute interval → `desktop:wakeSync`
2. Preload exposes `onWakeSync` → renderer
3. `initElectronShell` attaches handlers that call `window.__SMILE_TRUST_BACKGROUND_SYNC__`
4. That hook runs the **same** flush path as Capacitor (`flushOfflineQueueNow` → Wave 4 / `runWave4Sync`)
5. Money apply stays in JS Module 15 / domain ops — **never** in Electron main

`runDesktopWave4Sync` is a thin alias over `runWave4Sync` — tests assert identical module.

Offline cache: Wave 1/4 encrypted queue + localStorage patterns. **No** separate SQLite business database.

---

## 5. Printing & export

| Bridge | IPC | SPA usage |
|---|---|---|
| Print HTML receipts/reports | `desktop:print` | `openPrintWindow` → `desktopPrintHtml` when Electron |
| Save PDF | `desktop:printToPdf` | Available via `smileTrustDesktop.printToPdf` |
| File export | `desktop:exportFile` | `download()` prefers save dialog on EXE |

Existing receipt/report UI (`window.print` / popup HTML) is reused — gap-close only.

---

## 6. Auto-updates & code signing

### Updater

- Module: `electron/updater.js` (electron-updater)
- Config: **do not** ship a placeholder `build.publish` URL. Default in `package.json` is `"publish": null`.
- Env overrides (production):
  - `SMILE_UPDATE_FEED_URL` — HTTPS generic provider base (required for checks)
  - `SMILE_UPDATE_CHANNEL` — default `latest`
  - `SMILE_UPDATE_FORCE=1` — allow checks in unpackaged/dev
- Behavior: packaged builds check after ~15s **only when a real feed URL is configured**; download is manual (`autoDownload: false`); install via `quitAndInstall`
- Placeholder hosts (`*.example.invalid`, `example.com`) are treated as **unconfigured** and will not trigger update traffic (GAP-008)
- Rollback: keep prior NSIS installer / portable EXE; electron-updater does not auto-rollback — redeploy previous artifact

### Code signing (do not commit secrets)

```powershell
# Example — use your org cert store or file (never commit CSC_KEY_PASSWORD)
$env:CSC_LINK = "C:\secure\smile-trust-codesign.pfx"
$env:CSC_KEY_PASSWORD = "<from secret store>"
$env:SMILE_UPDATE_FEED_URL = "https://updates.your-org.example/smile-trust-susu"
# Optional: enable signing in package.json build.win.signAndEditExecutable = true
# (leave false for unsigned pilots; flip only when CSC_* is available)
npm run check:electron-signing
npm run build:exe
```

| Mode | `signAndEditExecutable` | Certs | Update feed |
|------|-------------------------|-------|-------------|
| Pilot unsigned | `false` (current default) | none | omit / null |
| Production signed | `true` when CSC ready | `CSC_LINK` + password or Windows store | real `SMILE_UPDATE_FEED_URL` |

Pilot unsigned builds are supported today. **Do not** invent certificates or commit PFX files.  
Config smoke: `npm run check:electron-signing` (writes `docs/release-evidence/electron-signing-check.json`).  
Production readiness: `npm run check:electron-signing -- --strict` fails if `signAndEditExecutable=true` without CSC_*.  
After EXE/APK exist: `npm run hash:artifacts` (GAP-012).

| Check | Command |
|-------|---------|
| Pilot-safe defaults | `npm run check:electron-signing` |
| Channels (Android+EXE) | `npm run check:channels` |
| Strict CSC path | `npm run check:electron-signing -- --strict` |

---

## 7. Install / user / admin guides

### Build (developer)

```powershell
npm run prepare:web
npm run generate:icons
npm run build:exe          # NSIS + portable
# or
npm run build:installer    # NSIS only
npm run build:portable     # portable only
npm run build:exe:dir      # unpacked dir (fast smoke)
npm run desktop:dev        # prepare:web then electron .
```

Artifacts land in `dist/` (e.g. `SmileTrustSusu-*-portable.exe`, NSIS setup).

### End-user install

1. Run the NSIS installer (per-machine, Start Menu + desktop shortcut) **or** copy the portable EXE
2. Sign in with the same shared SPA credentials (SystemOwner **john**, branch users, etc.)
3. Auth/session is the SPA session; optional secure vault uses OS `safeStorage` when available
4. Sync uses the same cloud/Supabase + Wave 4 engine as APK/Web

### Branch admin

- Tenant/branch isolation unchanged (RBAC / `SUPER_ADMIN_FORBIDDEN`)
- Devices appear under Backup / Sync; Wave 6 panel shows desktop shell status
- Prefer Win+L when unattended; avoid screen-share with PII/receipts visible

### Troubleshooting

| Symptom | Check |
|---|---|
| Blank window | Run `npm run prepare:web`; confirm `www/index.html` exists |
| Sync not running | Network + Wave 4 panel; wake hooks only schedule JS sync |
| Print fails | Windows default printer; try Print / PDF bridge |
| Updates skipped | Packaged build + valid `publish` / `SMILE_UPDATE_FEED_URL` |
| CSP / API blocked | Supabase must be `https:`; local backup `127.0.0.1` is allowlisted |

---

## 8. EXE ↔ APK ↔ Web parity checklist

| ID | Item | Channels |
|---|---|---|
| W6-P01 | Same SPA entry (`www/` after `prepare:web`) | EXE↔Web↔APK |
| W6-P02 | Auth via shared SPA session | EXE↔Web↔APK |
| W6-P03 | Wave 3 `invokeApi` in-process | EXE↔Web↔APK |
| W6-P04 | Wave 4 sync engine identical | EXE↔APK |
| W6-P05 | Encrypted offline queue (no SQLite business DB) | EXE↔APK |
| W6-P06 | Tenant/branch RBAC unchanged | EXE↔Web↔APK |
| W6-P07 | Money: pesewas / 15 / 31 / 1000 | EXE↔Web↔APK |
| W6-P08 | Print/export bridges | EXE |
| W6-P09 | Auto-update scaffolding + signing docs | EXE |
| W6-P10 | Monitoring via existing ops | EXE↔Web |

---

## 9. Accessibility

Reuse Wave 5 helpers (`stSrOnly`, aria-labels, lazy panels). Desktop notes:

- Prefer keyboard focus order already in SPA dialogs
- Windows High Contrast / Magnifier compatible; status is not color-alone
- Native Electron/Windows print UI is keyboard-accessible

---

## 10. Monitoring

Health/sync continue via Wave 3 `v1/monitoring.*` + Wave 4/5 Backup/Audit panels. Desktop wake does not invent a second health bus.

---

## 11. Tests

`tests/wave6-windows-exe.test.js` covers IPC allowlist, sync parity, offline queue path, builder/updater presence, docs, and registry notes.

```powershell
npm test
npm run prepare:web
npm run check:electron
```

Full `npm run build:exe` may require local Windows SDK / signing setup — config is validated even when a full installer run is skipped.
