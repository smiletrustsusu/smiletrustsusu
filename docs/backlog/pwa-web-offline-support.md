# PWA / web-offline support level (GAP-023)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Backlog:** TASK-000199  
**Decision:** Document **limits** (no false parity with Capacitor field offline). Product may later expand web-offline; until then this is the support SoT.

Related: [`../offline-sync.md`](../offline-sync.md) · [`../wave4-android-offline.md`](../wave4-android-offline.md) · root `service-worker.js` · `src/sync/offline-sync-engine.js`

---

## Support levels

| Channel | Offline posture | Authoritative engine |
|---------|-----------------|----------------------|
| **Android (Capacitor)** | Field-grade: encrypted queue, ordered sync, conflict/recovery, receipts | Module 15 / Wave 4 offline-sync engine |
| **Windows EXE (Electron)** | Local SPA + shared core; same money engines; not a second offline stack | Shared `src/` engines |
| **Browser PWA / service worker** | **Best-effort shell cache only** | `service-worker.js` asset cache — **not** Module 15 parity |

---

## What the PWA service worker does

- Caches a fixed shell list (`index.html`, `app.js`, styles, icons, vendor libs).  
- Serves cached GETs when available; falls back to `./index.html` on network failure.  
- Does **not** claim encrypted offline queue, server-sequence apply, or conflict resolution.

## What agents / operators must not assume

- Web PWA is **not** certified for collector field money posting while offline.  
- Do not claim “web = Capacitor offline” in UAT, PV, or CERT-001 evidence.  
- Pilot/production field collection offline drills use **Android** (or EXE with documented local policy), not browser SW alone.

## Evidence / hygiene

- Capacitor offline: Wave 4 docs + tests under offline/sync suites.  
- PWA: presence of `service-worker.js` + `manifest.webmanifest` only proves installable shell caching.  
- Money invariants still apply everywhere the SPA runs: integer **pesewas**, interest **15%**, cycle **31** days, cashier float **1000**.

---

## Acceptance (GAP-023)

- [x] Support level defined (Capacitor = field SoT; PWA = shell cache)  
- [x] No false parity claim vs Capacitor  
- [x] Limits documented for agents and UAT writers  

---

*pwa-web-offline-support.md v1.0.0 — 2026-09-20 · TASK-000199 Completed (limits documented)*
