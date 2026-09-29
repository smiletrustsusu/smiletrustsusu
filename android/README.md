# Android (Capacitor) — Wave 4 / GAP-004

Production Android delivery is **Capacitor wrapping the shared vanilla JS SPA** (same core as Web + Electron EXE).  
Do **not** rewrite the product in Kotlin / Jetpack Compose / Hilt / Room / Retrofit.

**Policy:** The full Gradle tree (`android/app`, wrapper, etc.) is **generated locally** and typically not committed (binary/hostile size). This README + `plugins-src/` are the in-repo scaffold. Reproducible path = scripts below + `npm run check:android`.

---

## Prerequisites

| Tool | Notes |
|------|--------|
| Node 20+ | `npm ci` |
| Android Studio / SDK | Platform tools; JDK **17–21** (JBR preferred) |
| `JAVA_HOME` | Optional; `scripts/build-apk.js` prefers Android Studio JBR |

---

## Generate & build (PowerShell)

**One command (preferred for pilot):**

```powershell
npm run pilot:android
```

This runs `prepare:web` → `android:ensure` (Capacitor Gradle generate, preserving README/plugins-src) → `cap:sync` → **downlevel Android assets to ES2018** → debug APK.  
Expected artifact: `android/app/build/outputs/apk/debug/app-debug.apk`

**Step-by-step:**

```powershell
npm run prepare:web
npm run check:android
npm run android:ensure
npm run cap:sync
npm run build:apk
```

> `postcap:sync` / `build:apk` rewrite `android/app/src/main/assets/public` JS to **ES2018** so older System WebViews do not throw `Uncaught SyntaxError` on optional chaining (`?.`) / nullish coalescing (`??`) / numeric separators. Source of truth (`src/`, `www/`) stays modern — do **not** hand-edit the downleveled Android copies.
> Note: `npm run cap:add:android` alone fails while `android/README.md` + `plugins-src/` exist (Capacitor sees the folder as a platform). Use `android:ensure` instead.

`precap:add:android` / `precap:sync` / `prebuild:apk` already run `prepare:web` where wired in `package.json`.

### Release signing (no secrets in git)

```powershell
# Preferred — org secrets from vault / CI (never invent certs)
$env:SMILE_ANDROID_STORE_PASSWORD = "<from secret store>"
$env:SMILE_ANDROID_KEY_PASSWORD = "<from secret store>"   # optional; defaults to store password
$env:SMILE_ANDROID_KEY_ALIAS = "smiletrust"               # optional
# Optional: use an existing org keystore file
# $env:SMILE_ANDROID_KEYSTORE_FILE = "C:\secure\org-release.keystore"
npm run release:android
# Or step-by-step:
# npm run setup:android-signing
# npm run build:apk:release
# npm run hash:artifacts
```

Check readiness without building:

```powershell
npm run setup:android-signing -- --check-only
npm run release:android -- --check-only
```

Pilot-only local keystore (never Play Store):

```powershell
$env:SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE = "1"
npm run setup:android-signing
npm run build:apk:release
```

Ignored by git: `android/keystore.properties`, `android/smile-trust-release.keystore`, `android/app/build/`.

`build:apk:release` / `release:android` **refuse** to assemble when keystore props are missing — they will not invent certificates.
---

## Config

- App id: `com.kba.susu` (`capacitor.config.json`)
- Web assets: `www/` (from `prepare:web` — **edit SoT is `src/`**)
- Offline/sync: JS engine `src/sync/offline-sync-engine.js` via Wave 3 `invokeApi` (`v1/sync.*`)

---

## Hardening hooks (JS + optional native)

| Capability | JS | Native |
|---|---|---|
| Encrypted offline queue | `offline-foundation` + AES-GCM | — |
| Secure PIN / token prefs | `capacitor-shell` → Preferences or secure-storage | optional Preferences plugin |
| Biometric unlock | `biometricUnlock()` | community biometric plugin |
| Screenshot protection | `setScreenshotProtection()` | `plugins-src/SmileTrustSecure` FLAG_SECURE |
| Device registration metadata | `ensureDeviceRegistration()` | — |
| Receipt share / print | Web Share + `shareReceiptNative` | Bluetooth stub in plugin |
| Background sync | `__SMILE_TRUST_BACKGROUND_SYNC__` | optional WorkManager worker |
| Push / local notify | `notifyLocal()` | `@capacitor/local-notifications` when configured |

Copy Kotlin stubs from `plugins-src/` into the generated Capacitor Android module after `cap:add:android` if native hardening is required for the pilot.

---

## Troubleshooting

| Symptom | Action |
|---|---|
| `android platform already exists` | Use `npm run android:ensure` (not bare `cap add`) |
| `Gradle wrapper not found` | `npm run android:ensure` |
| `check:android` fails | Fix `capacitor.config.json` / package scripts |
| Java version errors | `build-apk.js` prefers Android Studio JBR 17–21 (system JDK 25+ will fail) |
| Blank WebView | `npm run prepare:web` then `npm run cap:sync` |
| Uncaught SyntaxError on launch | Fixed duplicate ESM imports in `app.js` and illegal `??`/`||` mix in `dashboard-views.js`. Rebuild with `prepare:web` + `cap:sync` (also ES2018-downlevels Android assets). Update System WebView from Play Store on very old devices. |
| Sync not draining | Check device not revoked; open Backup → Offline sync platform |
| Signing refused | Set store password env or `SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE=1` |
| SDK not found | Install Android Studio; or set `ANDROID_HOME` — then `npm run check:android -- --strict-sdk` |

See `docs/wave4-android-offline.md` for architecture, offline guide, and pilot checklist.  
After any APK/EXE exists: `npm run hash:artifacts` (GAP-012 evidence under `docs/release-evidence/`).
