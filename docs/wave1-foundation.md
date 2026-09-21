# Wave 1 â€” Foundation Platform

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Wave:** WAVE-01 (MIB waves 1â€“3: Foundation Â· Auth & RBAC Â· Tenant & Branch)  
**Status:** Gap closure + hardening delivered (EIR waveStatus remains **Mostly Complete** â€” production certification is WAVE-10)  
**Date:** 2026-09-15  
**Stack constraints:** Vanilla JS SPA (`app.js`), Capacitor APK, Electron EXE Â· localStorage + optional Supabase Â· integer **pesewas** Â· interest **15** Â· collection days **31** Â· cashier GHS **1000** Â· no Next.js/Flutter Â· no new HTTP servers Â· no new top-level nav

---

## 1. Architecture (feature-based, existing patterns)

Wave 1 **does not** create a second app or DI container rewrite. It unifies cross-cutting concerns as thin adapters over existing engines:

| Concern | Existing SoT | Wave 1 adapter |
|---------|--------------|----------------|
| Auth / session | `app.js` login, `src/core/session.js`, `src/sync/supabase-auth.js`, `src/password.js` | `src/core/auth-session-ops.js` |
| RBAC | `src/core/rbac.js`, `src/core/roles.js` | exported `SUPER_ADMIN_FORBIDDEN`, `isForbiddenForSuperAdmin`, `assertActionAllowed` |
| Tenant | Module 30 `platform-ops.js` | `foundation-ops.resolveFoundationContext` / repos |
| Branch | `branches.js`, `branch-ops.js` | foundation repos + branch status helpers |
| Config / flags | `system-config.js`, Module 30 flags | foundation services `flags` / `config` |
| Audit | `audit-ops.js` | used by auth-session + foundation API client |
| Logging | Module 19 `monitoring-ops.recordLog` | `foundation-logging.js` categories |
| Errors | contract `standardError` patterns | `foundation-errors.js` catalog + global handler |
| Monitoring hooks | Module 19 | `installFoundationErrorBridge`, health/metrics |
| Offline foundation | `sync-ops.js`, `offline-queue.js`, `offline-crypto.js` | `offline-foundation.js` persist/recover only |
| Secure storage | `offline-crypto.js` | `secure-storage.js` |
| Shared UI | `styles.css` `.panel` `.btn` `.field` | `src/ui/shared-primitives.js` |
| Facade | â€” | `src/core/foundation-ops.js` |

**API conventions (in-process):** call Module 20 / `invokeContract(state, request, { uid, now, user })`. No REST/GraphQL listeners. Facades return `{ ok, errorCode, userMessage, retryable, ... }`.

**Coding standards:** extend `*-ops.js` / lifecycle / registry patterns; money in pesewas; preserve Admin=Branch Manager, KBA=Super Admin, SystemOwner=`john`; never grant KBA `Owner.Transfer` / `System.Reset` / `Export.All`.

---

## 2. Repository folders

| Path | Role |
|------|------|
| `src/core/` | Shared domain & platform engines |
| `src/sync/` | Offline queue, crypto, Supabase clients |
| `src/ui/` | View helpers (Audit/Reports extras â€” no new top-level nav) |
| `electron/` | Desktop EXE shell |
| `android/` | Capacitor Android project (**generated** via `npm run cap:add:android`) â€” see `android/README.md` |
| `supabase/` | SQL migrations / RLS (canonical DB under Wave 2) |
| `db/` | Pointer / local notes for DB artifacts (`db/README.md`) |
| `docs/` | Architecture & wave docs |
| `tests/` | `node --test` suites |
| `scripts/` | `prepare:web`, builds, generators |
| `deploy/` | Deploy runbook placeholders (`deploy/README.md`) |
| `www/` | Web mirror produced by `npm run prepare:web` |

---

## 3. Setup (developer guide)

1. Install: `npm install`
2. Config: copy `config.example.json` â†’ `config.json` (Supabase optional)
3. Tests: `npm test`
4. Web mirror: `npm run prepare:web` (copies `src/` â†’ `www/src/` etc.)
5. Desktop: `npm run desktop` / `npm run build:exe`
6. Android: `npm run cap:add:android` (once) then `npm run build:apk`

**Foundation usage sketch:**

```js
import { createFoundationServices, installFoundationErrorBridge } from "./src/core/foundation-ops.js";

installFoundationErrorBridge(state);
const services = createFoundationServices(state, { actor: currentUser, uid, now });
await services.auth.login({ username, password, device });
await services.offline.persist({ secret, fingerprint });
```

---

## 4. Wave 1 completion checklist

| # | Deliverable | Status | Pointers |
|---|-------------|--------|----------|
| 1 | Repository structure | **Complete** | folders + `db/` `deploy/` `android/` READMEs |
| 2 | Architecture / thin adapters | **Complete** | this doc Â· `foundation-ops.js` |
| 3 | Authentication | **Complete** | `auth-session-ops.js` Â· `session.js` Â· `supabase-auth.js` refresh/recover |
| 4 | RBAC | **Complete** | `rbac.js` (`SUPER_ADMIN_FORBIDDEN` exported) Â· role map in `listAuthRoles` |
| 5 | Tenant management | **Complete** | Module 30 + foundation context/repos |
| 6 | Branch management | **Complete** | `branch-ops.js` / `branches.js` + foundation repos |
| 7 | Enterprise configuration | **Complete** | `system-config.js` Â· platform flags |
| 8 | Audit framework | **Complete** | `audit-ops.js` categories incl. authz/CRUD/config/security/login failures |
| 9 | Structured logging | **Complete** | `foundation-logging.js` (app/api/security/sync/error/performance) |
| 10 | Error handling | **Complete** | `foundation-errors.js` |
| 11 | Monitoring hooks | **Complete** | bridge â†’ Module 19 metrics/logs |
| 12 | Offline foundation | **Complete** (foundation only) | `offline-foundation.js` â€” **not** full Wave 4 sync |
| 13 | Shared UI components | **Complete** | `shared-primitives.js` |
| 14 | Security helpers | **Complete** | `secure-storage.js` Â· offline-crypto |
| 15 | Tests | **Complete** | `tests/wave1-foundation.test.js` (+ existing suites stay green) |
| 16 | Docs / backlog notes | **Complete** | this file Â· MIB Wave-01 module hardening â†’ Code Complete |

### Partial (intentionally)

| Item | Why partial |
|------|-------------|
| EIR `WAVE-01.waveStatus` | Registry enum is only Mostly Complete / In Progress / Planned â€” kept **Mostly Complete** with updated notes |
| Capacitor `android/` native project | Created on demand by Capacitor; placeholder README only |
| Supabase cloud auth path | Optional; refresh/recover helpers present when configured |
| Full offline business sync | **Delivered in WAVE-04** — see `docs/wave4-android-offline.md` |

---

## 5. Money & role invariants (normative)

- Amounts: integer **pesewas**
- Default loan interest: **15**
- Collection cycle days: **31**
- Cashier approval limit: **GHS 1000**
- Roles: Admin = Branch Manager Â· KBA = Super Admin Â· SystemOwner username `john`
- `SUPER_ADMIN_FORBIDDEN`: `Owner.Transfer`, `System.Reset`, `Export.All`

---

## 6. Related registries

- `docs/enterprise-implementation-roadmap.md` Â· `src/core/enterprise-roadmap-registry.js`
- `docs/master-implementation-backlog.md` Â· `src/core/master-backlog-registry.js`
- Modules: 1, 5, 13, 14, 23, 24, 30 Â· Phases: 1, 2, 8, 9, 10

