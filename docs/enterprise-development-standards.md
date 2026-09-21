# Enterprise Development Standards Manual (EDSM)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Authoritative development standard for all future code  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-17  
**Machine registry:** `src/core/canonical-standards-registry.js`  
**Validation helpers:** `src/core/edsm-validation.js`  
**Companion catalogs:** [`edsm-catalogs.md`](./edsm-catalogs.md)  
**Schemas:** [`schemas/standards/`](./schemas/standards/)  

**Upstream (consume, not redefine):** Phases **9, 13, 14, 16, 17, 18, 19, 20** · Waves **1–10** · Modules **1–30** · MIB / EIR  

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EDSM |
| Accountable authority | Engineering Lead / Architecture Owner / QA Lead |
| Nature | **Single authoritative coding & delivery standard** — adapters over existing patterns |
| Money posts via standards catalog | **Forbidden** |
| Modules 1–30 engines | **Referenced**, **not replaced** |
| Phases / Waves policy | **Consumed via links/IDs**, **not redefined** |
| Nav | **No new top-level nav** (extras under Audit / Reports) |
| AI | **Advisory only** (Phase 12 / Module 29) |
| Web sync | `prepare:web` → `www/` |

**Money invariants (normative):** amounts in **integer pesewas**; default interest **15**; collection cycle **31 days**; cashier float limit **GHS 1000**; Admin = Branch Manager; KBA = Super Admin; SystemOwner = `john`; `SUPER_ADMIN_FORBIDDEN` retained.

**REST / OpenAPI:** in-process contract facades only — **no live REST server required**.

---

## Non-goals / Rejected stacks

The following were **explicitly rejected** in Waves 4–6 and **must not** be reintroduced as the primary delivery path by future agents or contributors:

| Rejected primary path | Why rejected | Authoritative alternative |
|----------------------|--------------|---------------------------|
| Next.js / React / TypeScript / Tailwind portal rewrite | Splits shared core; bypasses `invokeApi`; violates Waves 5–6 | Shared vanilla JS SPA (`app.js` + `src/`) |
| Jetpack Compose / Kotlin-first Android rewrite | Duplicates ledger; bypasses Wave 4 JS offline/sync | Capacitor APK loading the same `www/` SPA |
| Flutter rewrite | Same ledger-split risk | Capacitor + shared SPA |
| Live Node HTTP REST/GraphQL server as SoT | Wave 3 is in-process | `invokeApi` + OpenAPI facade |
| New top-level navigation | UX invariant | Extras under **Audit** / **Reports** only |

Thin Kotlin Capacitor plugin bridges and optional native shell code are **allowed** only as adapters around the shared SPA — never as a parallel product UI.

---

## 1. Architecture standards

### 1.1 Authoritative runtime architecture

```
Supabase PostgreSQL (Wave 2 migrations / RLS / RPCs)
        │
        ▼
Wave 3 invokeApi / Module 20 contracts  (+ OpenAPI facade — no live HTTP required)
        │
        ▼
Shared business logic (`src/core/*-ops.js`, services, repositories)
        │
        ├── Web Admin  — vanilla JS SPA (`app.js` + `src/` + CSS)
        ├── Electron EXE — Wave 6 main/preload/IPC → loads `www/`
        └── Capacitor Android APK — Wave 4 offline/sync → loads `www/`
```

### 1.2 Clean Architecture mapped to existing patterns

EDSM maps classical layers onto **current** code — not a Java/Kotlin rewrite:

| Classical concept | SMILE TRUST adapter |
|-------------------|---------------------|
| Controllers / API | `src/api/controllers/*` + `invokeApi` |
| Application / use cases | `src/core/services/*` orchestration |
| Domain engines | Existing `*-ops.js` (posting, RBAC, loans, …) |
| Repositories | `src/core/repositories/*` (state + optional Supabase RPC) |
| Presentation | `app.js`, `src/ui/*`, shared CSS |
| DI | Explicit imports / factory `createApiPlatform()` — no IoC container mandate |

**Rule:** New features extend ops/services/controllers; they must not fork money math into UI or native shells.

### 1.3 Cross-channel parity

Web ↔ EXE ↔ APK share one SPA artifact via `prepare:web`. Channel-specific code is limited to:

- Electron: `main` / `preload` / IPC hardening (Wave 6)
- Capacitor: thin native bridges + offline indicators (Wave 4)
- Never duplicate posting or RBAC in native code

---

## 2. Repository & project structure

| Path | Role |
|------|------|
| `app.js`, `index.html`, `styles.css`, `styles-mobile.css` | SPA shell |
| `src/core/` | Domain ops, registries, engines |
| `src/api/` | `invokeApi` platform + controllers |
| `src/ui/` | View helpers (no new top-level nav) |
| `src/sync/` | Offline/sync (Wave 4) |
| `docs/` | Authoritative phase/wave/EDSM docs |
| `docs/schemas/` | JSON Schema package + `manifest.json` |
| `tests/` | Node test suite (`npm test`) |
| `supabase/migrations/` | Wave 2 PostgreSQL |
| `www/` | **Generated** Electron/Capacitor web root (`prepare:web`) |
| `android/` | Capacitor Android shell (generated / thin plugins) |
| Electron entry | Main/preload per Wave 6 |

**Rules:** Edit sources under repo root (`src/`, `app.js`, …); never treat `www/` as SoT. After SPA changes run `npm run prepare:web`. Do not rewrite runtime engines under the guise of “cleanup.”

---

## 3. Database standards (Wave 2)

Consume [`wave2-database.md`](./wave2-database.md) and `canonical-database-registry.js`. Normative rules:

1. Schema changes via **versioned Supabase migrations** only.  
2. Money columns = **integer pesewas** (never float GHS in cores).  
3. RLS and RPCs remain the security boundary for cloud reads/writes.  
4. Dual-write / relational sync must preserve append-only posting semantics.  
5. Do **not** redefine RPO/RTO here — Phase 14/15 remain SoT.  

---

## 4. Backend / API standards (Wave 3 + Module 20)

1. All client→domain calls go through **`invokeApi(state, request, ctx)`** (or `createApiPlatform().invoke`).  
2. Controllers register `v1/domain.action` ops; services call existing `*-ops.js`.  
3. OpenAPI (`docs/openapi/`) is a **facade for contracts/docs/tools** — not evidence of a live REST listener.  
4. Authz uses existing RBAC + branch/tenant checks; enforce `SUPER_ADMIN_FORBIDDEN`.  
5. Correlation, validation, rate limit, audit, metrics stay in the API platform middleware chain.  
6. No new HTTP servers as the system of record.

---

## 5. Android standards (Capacitor — not Compose)

**Primary delivery:** Capacitor Android APK loads the shared `www/` SPA.

| Requirement | Standard |
|-------------|----------|
| UI | Shared vanilla JS SPA — **not** Jetpack Compose screens as primary |
| Offline / sync | Wave 4 JS engine (`src/sync/*`, `wave4-offline-ops`) |
| Native code | Optional **thin** Kotlin Capacitor plugins only (filesystem, network status, etc.) |
| Money / RBAC | Never reimplemented in Kotlin |
| Build | `prepare:web` → `cap:sync` → APK scripts in `package.json` |

Rejected: Kotlin-first / Compose rewrite of Collector/Teller/Admin dashboards.

---

## 6. Web standards (Vanilla JS SPA — not Next.js)

**Primary delivery:** Shared SPA (`app.js` + `src/` + responsive CSS).

| Requirement | Standard |
|-------------|----------|
| Framework | Vanilla JS modules — **not** Next.js / React |
| Layout | Responsive CSS (`styles.css`, `styles-mobile.css`); match existing CSS variables |
| Admin portal | Wave 5 hardening under existing shell |
| API | Wave 3 `invokeApi` only |
| Nav | No new top-level items; Audit / Reports for extras |
| Design tokens | Prefer `--brand`, `--ink`, `--bg`, `--gold`, etc. — avoid purple-on-white AI cliché themes |

Rejected: Next.js / React / Tailwind / shadcn portal rewrite.

---

## 7. Windows / Electron standards (Wave 6)

1. EXE loads `www/` SPA (same artifact as web/APK).  
2. Harden **main / preload / IPC** — contextIsolation, no Node in renderer, least-privilege IPC.  
3. Offline flush hooks call the **same** Wave 4 sync path as Capacitor.  
4. No Electron+Next.js/React/SQLite parallel stack.

---

## 8. Security standards (Phase 9 consume)

Consume [`enterprise-security.md`](./enterprise-security.md). Highlights for developers:

- PBKDF2 (or stronger) password storage; never plaintext  
- Session / MFA per existing auth-session ops  
- RBAC matrix; `SUPER_ADMIN_FORBIDDEN`; SystemOwner = `john`  
- Secrets only in `config.json` (gitignored) / env — never commit keys  
- CSP / Electron hardening / Capacitor WebView defaults per Waves 6 & 4  
- AI remains advisory — no auto loan approval  

---

## 9. UI / UX standards

1. Preserve existing design system and CSS variables (`--brand` teal family, `--ink`, `--bg`, `--gold`).  
2. Avoid generic purple-on-white / glow / pill-cluster AI aesthetics.  
3. One job per panel; extras under Audit / Reports.  
4. Money display may show GHS; cores remain pesewas.  
5. Collector mobile tabs remain Home · Customers · Collect · Groups · More unless a change request amends Wave docs.  
6. Motion only where it aids hierarchy; do not block critical cash workflows.

---

## 10. Testing standards (Phase 16 ETQAVS)

Consume [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md) and `canonical-testing-registry.js`.

- Suites `TSU-*`, gates `QG-001`…`QG-004`, CERT-001/002 remain SoT  
- `npm test` is the local gate for registry/engine consistency  
- Money invariant tests required for financial changes  
- Do not redefine Phase 14 promotion path or Phase 15 RPO/RTO in test docs  

---

## 11. Documentation standards

| Artifact | Rule |
|----------|------|
| Phase / Wave docs | Authoritative for their domain; link, don’t fork |
| Registries | Machine-readable SoT for IDs/counts |
| Schemas | Draft 2020-12; `additionalProperties: false`; SHA-256 in `manifest.json` |
| EDSM | This manual — coding/delivery SoT |
| Catalogs | Companion matrices only |
| README | Minimal operator entry; deep standards live in `docs/` |

Every material change updates the relevant doc **or** explicitly cites an existing Wave/Phase section.

---

## 12. Git & branching standards

1. No force-push to `main`/`master`.  
2. Do not commit `config.json`, service-role keys, or signing keystores.  
3. Prefer small, reviewable commits when the owner requests commits.  
4. Change/release governance consumes Phase 19 EGCCRMS (CHG/REL/CI) — not redefined here.  
5. Hotfix path aligns with Phase 16 CERT-002 + Phase 14 emergency patterns.

---

## 13. DevOps / CI-CD standards (Phase 14 EDDIES)

Consume [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md).

- Env promotion: DEV → QA → UAT → STAGING → PRODUCTION  
- Artifacts: SPA `www/`, Electron EXE, Capacitor APK  
- Quality gates before promotion (Phase 16)  
- RPO/RTO **owned by** Phase 14/15 — EDSM only requires developers not to invent alternate targets  

---

## 14. Logging & monitoring (Phase 13 / foundation)

Consume [`enterprise-monitoring-observability.md`](./enterprise-monitoring-observability.md) and Module 19.

- Use existing correlation / metrics hooks on `invokeApi`  
- Structured logs; no secrets in log lines  
- Health checks and SLOs remain Phase 13 catalog  
- Do not stand up a parallel observability stack without Phase 19 change approval  

---

## 15. Performance standards (Phase 17 EPSCMS)

Consume [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md).

- Honor Phase 16/17 thresholds (e.g. P95 response budgets in ETQAVS)  
- Prefer incremental SPA work; avoid shipping a second heavyweight framework  
- Offline queue and sync must remain bounded (Wave 4)  

---

## 16. Accessibility standards (WCAG 2.1 AA)

1. Target **WCAG 2.1 Level AA** for staff and member-facing SPA surfaces.  
2. Semantic HTML, keyboard operability, visible focus, sufficient contrast against existing tokens.  
3. Form labels and error text associated with controls.  
4. Do not rely on color alone for money status.  
5. Accessibility suite `TSU-016` (Phase 16) is the catalog reference — expand cases rather than forking a new a11y program.

---

## 17. Coding standards

### 17.1 Language & modules

- **ES modules** in `src/` (`import`/`export`)  
- Prefer small pure helpers + existing ops composition  
- No TypeScript/Next mandate  
- Match existing naming: `kebab-file.js`, `camelCase` functions, `SCREAMING_SNAKE` constants  

### 17.2 Money & domain

```text
pesewas = integer
interest default = 15
collection days = 31
cashier limit = 1000 (GHS display; enforce in pesewas where coded)
```

### 17.3 Error handling

- Return structured `{ ok, code, message }` from registries/ops where that pattern exists  
- Fail closed on authz / money validation  

### 17.4 Comments

- Prefer clarity in names; comments for non-obvious invariants (money, RBAC, channel parity)  
- Do not narrate every line  

---

## 18. Quality gates (Phase 16 + Wave 8)

| Gate class | Reference |
|------------|-----------|
| Env promotion gates | QG-001…QG-004 (Phase 16) |
| Release certification | CERT-001 / CERT-002; Wave 8 RC evidence |
| Local developer gate | `npm test` green; `prepare:web` when SPA changed |
| EDSM gate | `validateStandardsRegistry()` / `validateEdsmCompliance()` critical = 0 |
| Money / stack invariants | Pesewas · 15 · 31 · 1000 · no Next/Compose primary |

Bypass requires Phase 16 `emergency_exception_approved` / Phase 19 emergency change — never silent skip.

---

## 19. Machine-readable registries

| Registry | Path |
|----------|------|
| EDSM standards | `src/core/canonical-standards-registry.js` |
| Sample compliance | `src/core/edsm-validation.js` |
| Testing | `canonical-testing-registry.js` (Phase 16) |
| Deployment | `canonical-deployment-registry.js` (Phase 14) |
| Monitoring | `canonical-monitoring-registry.js` (Phase 13) |
| Baseline | `canonical-baseline-registry.js` (Phase 20) |
| Roadmap / backlog | `enterprise-roadmap-registry.js` / `master-backlog-registry.js` |

New standard IDs must be unique, owned, and listed in [`edsm-catalogs.md`](./edsm-catalogs.md).

---

## 20. Acceptance criteria (EDSM compliance)

A change is EDSM-compliant when **all** hold:

1. Uses shared SPA / Capacitor / Electron architecture — **not** Next.js or Compose as primary.  
2. Money math remains integer **pesewas**; defaults **15 / 31 / 1000** unless audited config change.  
3. Domain calls go through **`invokeApi`** (or documented exception under Audit/Reports tooling that still ends in ops).  
4. No new top-level nav.  
5. AI remains advisory.  
6. `SUPER_ADMIN_FORBIDDEN` and SystemOwner/`john` invariants preserved.  
7. Relevant docs/registries/schemas updated; `manifest.json` SHA-256 correct for new schemas.  
8. `npm test` green; `prepare:web` run if `src/` or SPA shell mirrored.  
9. Phase 14/15/16 policy (RPO/RTO, gates, promotion) referenced, not redefined.  
10. `validateStandardsRegistry()` reports **critical = 0**.

---

## Cross-references

| Topic | Authoritative doc |
|-------|-------------------|
| Master architecture | [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) |
| Wave 2 DB | [`wave2-database.md`](./wave2-database.md) |
| Wave 3 API | [`wave3-backend-api.md`](./wave3-backend-api.md) |
| Wave 4 Android offline | [`wave4-android-offline.md`](./wave4-android-offline.md) |
| Wave 5 Web admin | [`wave5-web-admin-portal.md`](./wave5-web-admin-portal.md) |
| Wave 6 Electron | [`wave6-windows-exe.md`](./wave6-windows-exe.md) |
| Phase 9 security | [`enterprise-security.md`](./enterprise-security.md) |
| Phase 13 monitoring | [`enterprise-monitoring-observability.md`](./enterprise-monitoring-observability.md) |
| Phase 14 DevOps | [`enterprise-deployment-devops.md`](./enterprise-deployment-devops.md) |
| Phase 16 testing | [`enterprise-testing-qa-validation.md`](./enterprise-testing-qa-validation.md) |
| Phase 17 performance | [`enterprise-performance-capacity.md`](./enterprise-performance-capacity.md) |
| Phase 19 governance | [`enterprise-governance-change-release.md`](./enterprise-governance-change-release.md) |
| Phase 20 baseline | [`enterprise-implementation-baseline.md`](./enterprise-implementation-baseline.md) |
| MIB / EIR | [`master-implementation-backlog.md`](./master-implementation-backlog.md) · [`enterprise-implementation-roadmap.md`](./enterprise-implementation-roadmap.md) |

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-17 | Initial EDSM — Capacitor/SPA/Electron authoritative; Next/Compose rejected as primary |
