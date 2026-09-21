# WAVE-04 — Offline Platform & Android (Capacitor)

**Status:** Delivered as Capacitor + shared vanilla JS SPA offline/sync platform  
**Date:** 2026-09-15  
**Wave:** WAVE-04 · MIB SYNC_ENGINE · Module 15 · Phases 5, 14, 18

---

## 1. Architecture decision (do not violate)

| Channel | Runtime |
|---|---|
| Web | Shared SPA (`app.js` + `src/`) |
| Desktop EXE | Electron loads `www/` (Wave 6 hardening: `docs/wave6-windows-exe.md`) |
| Android APK | **Capacitor** loads the same `www/` |

Wave 3 APIs are **in-process `invokeApi` contracts**, not a live Retrofit HTTP backend.

### Why not a Kotlin / Jetpack Compose rewrite?

- Would duplicate Modules 1–30 UI and business surface
- Would break the single-core Web / EXE / APK model
- Would contradict project invariants (no Flutter/Next rewrite; in-process API platform)
- Money posting, interest **15**, collection days **31**, cashier **1000**, pesewas, and `SUPER_ADMIN_FORBIDDEN` already live in the shared JS core

**Wave 4 value** is the deep offline/sync engine + Android shell hardening around that shared core.

---

## 2. Offline & synchronization platform

### Modules

| File | Role |
|---|---|
| `src/sync/offline-sync-engine.js` | Orchestrates persist/recover, prioritize, upload, apply, ack, progress, collector UX |
| `src/sync/sync-priority.js` | Financial-first queue ordering |
| `src/sync/sync-retry-policy.js` | Phase 18 exponential backoff (`RETRY-001…005`) |
| `src/sync/sync-progress.js` | Progress % + workflow stage mapping |
| `src/sync/conflict-guidance.js` | Conflict resolution guidance (no LWW for money) |
| `src/core/offline-foundation.js` | Encrypted local store (Wave 1) |
| `src/core/sync-ops.js` | Module 15 ordered apply / conflict detection |
| `src/core/wave4-offline-ops.js` | Facade + `runWave4Sync` via `invokeApi` |
| `src/platform/capacitor-shell.js` | Secure prefs, biometric, screenshot, share, notify |
| `src/ui/offline-status-views.js` | Phase 18 collector banners/panels (not color-alone) |

### Sync flow

1. **Recover** encrypted queue (idempotent by `idempotencyKey`)
2. **Note** connectivity / offline-since for ESC-001/002
3. If offline → defer; show Phase 18 collector message; keep collecting allowed kinds
4. If online → prioritize due items → `v1/sync.upload` (invokeApi) → `processSyncQueue` apply → `v1/sync.ack`
5. Failures → schedule retry with jittered backoff; conflicts held for `Sync.Resolve`
6. **Persist** encrypted queue; update progress + escalation helpers

### Guarantees

- Idempotent uploads / duplicate prevention (queue key + upload seen map)
- Financial kinds never `client_wins` / last-write-wins
- Device clocks are not the sole ordering key (local sequence)
- Secrets redacted from sync logs (`redactSecrets`)
- Collector decision hooks: start-of-day, EOD, escalation thresholds (Phase 18)

---

## 3. Android / Capacitor shell

See `android/README.md` and `android/plugins-src/`.

Optional thin Kotlin **only** for plugin bridges (FLAG_SECURE, Bluetooth print stub, WorkManager wake). WorkManager must call `window.__SMILE_TRUST_BACKGROUND_SYNC__` — never post money in Kotlin.

### APK pilot commands

```powershell
npm run pilot:android
# or step-by-step:
npm run prepare:web
npm run check:android
npm run android:ensure
npm run cap:sync
npm run build:apk
```

Debug APK path (when built): `android/app/build/outputs/apk/debug/app-debug.apk`  
Evidence hashes: `npm run hash:artifacts` → `docs/release-evidence/artifact-hashes.json`

If `./gradlew assemble` cannot run in CI/agent (no SDK / wrong JDK), config completeness is still verified via `capacitor.config.json`, `npm run check:android`, `prepare:web` → `www/`, and `android/README.md`. Prefer generating the Gradle tree locally rather than committing a huge binary-hostile tree (GAP-004). Use `android:ensure` so scaffold README/plugins-src survive Capacitor generate.

---

## 4. UI surfaces

- Mobile collector banner: Phase 18 approved wording + `aria-label` (not color-alone)
- Topbar network pill: accessibility label from registry
- Backup / Audit-Reports area: **Offline sync platform** panel (progress, EOD, escalation, conflict guidance)
- No new top-level nav

---

## 5. Role-based behaviour

Existing SPA dashboards remain authoritative for Collector / Teller / Branch Manager / etc. Offline indicators wrap the shared shell; Compose dashboards were not rebuilt.

---

## 6. Tests

`tests/wave4-offline-platform.test.js` covers:

- Prioritization
- Retry backoff / no auto-retry on conflict
- Idempotent upload / duplicate prevention
- Offline deferral + recovery
- Conflict guidance (financial forbid client_wins)
- Status transitions / collector UX
- Capacitor shell graceful degradation
- Roadmap WAVE-04 notes

---

## 7. Pilot checklist

- [ ] `npm test` green
- [ ] `npm run prepare:web` refreshes `www/`
- [ ] Auth/session still works (Wave 1 session)
- [ ] Queue persist → kill → recover → sync
- [ ] Conflict on financial item blocks client_wins
- [ ] Collector banner shows text + accessibility label
- [ ] `cap:add:android` + `build:apk` on a machine with Android SDK
- [ ] Optional: merge `SmileTrustSecure` plugin; confirm FLAG_SECURE
- [ ] SystemOwner `john` / money defaults unchanged (15 / 31 / 1000 / pesewas)

---

## 8. Partial / follow-ups

| Item | Notes |
|---|---|
| Full Gradle `android/app` tree | Generated locally by Capacitor; not always committed |
| Biometric / Preferences npm plugins | JS bridges ready; add packages when pilot needs them |
| Live FCM push | Local notification hook only until push project configured |
| Bluetooth ESC/POS | Stub resolves; vendor SDK per device fleet |
| Field offline recovery drill sign-off | Evidence folder for WAVE-10 |

---

## 9. Self-validation

- [x] Capacitor + shared core (not Compose rewrite)
- [x] Consumes Wave 3 `invokeApi` sync ops
- [x] Encrypted queue + retry + conflict + progress
- [x] Phase 18 collector messages / decision helpers
- [x] Docs + roadmap notes updated
- [x] No commit unless requested
