# SmileTrustSecure — optional Capacitor plugin sources

These Kotlin files are **thin bridges** for Wave 4 Android hardening:

- Screenshot protection (`FLAG_SECURE`)
- Bluetooth print stub
- Optional WorkManager wake that calls JS `__SMILE_TRUST_BACKGROUND_SYNC__`

They are **not** a Jetpack Compose rewrite of Modules 1–30.

## Integrate after generating the Capacitor Android project

```powershell
npm run prepare:web
npm run cap:add:android
npm run cap:sync
```

Then copy or register `SmileTrustSecurePlugin.kt` into the generated `android` app module (or publish as a local Capacitor plugin) and rebuild:

```powershell
npm run build:apk
```

Biometric unlock and Preferences should use community Capacitor plugins when added to `package.json` (`@capacitor/preferences`, biometric plugin). The JS shell in `src/platform/capacitor-shell.js` already degrades gracefully when plugins are absent.
