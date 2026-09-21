# EDSM Catalogs — Enterprise Development Standards Companion Matrices

**Parent:** [`enterprise-development-standards.md`](./enterprise-development-standards.md)  
**Registry:** `src/core/canonical-standards-registry.js`  
**Validation:** `src/core/edsm-validation.js`  
**Schemas:** [`schemas/standards/`](./schemas/standards/)  
**Version:** 1.0.0  
**Date:** 2026-09-17  

**Scope:** Coding / naming / API / DB / UI **standards catalog** + compliance checklist. Consumes Phases 9, 13–20 and Waves 1–10. Does **not** redefine RPO/RTO, quality-gate thresholds, or Module engines.

**Counts (seed):** codingRules=12, namingRules=10, apiRules=10, dbRules=8, uiRules=10, complianceChecks=12, owners=6, stackInvariants=8

**Stack note:** Android = **Capacitor + shared SPA** (not Compose). Web = **vanilla JS SPA** (not Next.js).

---

## 1. Coding standards registry

| ID | Code | Severity | Owner | Summary |
|----|------|----------|-------|---------|
| COD-001 | COD_ESM_MODULES | critical | Engineering Lead | Use ES modules in `src/`; match existing import style |
| COD-002 | COD_NO_ENGINE_REWRITE | critical | Architecture Owner | Do not rewrite `*-ops.js` engines without Phase 19 change |
| COD-003 | COD_MONEY_PESEWAS | critical | Domain Lead | Integer pesewas in cores; no float GHS storage |
| COD-004 | COD_INTEREST_DEFAULT_15 | critical | Domain Lead | Default interest remains 15 unless audited config |
| COD-005 | COD_COLLECTION_DAYS_31 | critical | Domain Lead | Collection cycle 31 days |
| COD-006 | COD_CASHIER_LIMIT_1000 | critical | Domain Lead | Cashier float limit GHS 1000 |
| COD-007 | COD_STRUCTURED_RESULTS | high | Engineering Lead | Prefer `{ ok, code, message }` on registry/ops boundaries |
| COD-008 | COD_FAIL_CLOSED_AUTHZ | critical | Security Lead | Authz and money validation fail closed |
| COD-009 | COD_NO_SECRETS_IN_REPO | critical | Security Lead | Never commit `config.json` keys / keystores |
| COD-010 | COD_PREPARE_WEB | high | Engineering Lead | Run `prepare:web` after SPA/`src` changes |
| COD-011 | COD_AI_ADVISORY_ONLY | critical | AI Owner | AI must not auto-approve loans or post money |
| COD-012 | COD_NO_NEW_TOP_NAV | critical | UX Owner | No new top-level nav; Audit/Reports only |

---

## 2. Naming standards registry

| ID | Code | Pattern / rule | Owner |
|----|------|----------------|-------|
| NAM-001 | NAM_FILE_KEBAB | `kebab-case.js` for modules | Engineering Lead |
| NAM-002 | NAM_FN_CAMEL | `camelCase` functions | Engineering Lead |
| NAM-003 | NAM_CONST_SCREAM | `SCREAMING_SNAKE` constants | Engineering Lead |
| NAM-004 | NAM_OPS_SUFFIX | Domain engines `*-ops.js` | Architecture Owner |
| NAM-005 | NAM_API_V1 | Ops ids `v1/domain.action` | API Owner |
| NAM-006 | NAM_TEST_FILE | `tests/<area>-*.test.js` | QA Lead |
| NAM-007 | NAM_SCHEMA_ID | `https://schemas.smiletrust.com/...` | Architecture Owner |
| NAM-008 | NAM_REGISTRY_CANON | `canonical-*-registry.js` / `*-registry.js` | Architecture Owner |
| NAM-009 | NAM_RULE_ID | `COD\|NAM\|API\|DB\|UI\|CHK-###` | Engineering Lead |
| NAM-010 | NAM_ROLE_ALIASES | Admin=Branch Manager; KBA=Super Admin; john=SystemOwner | Security Lead |

---

## 3. API standards registry

| ID | Code | Severity | Summary |
|----|------|----------|---------|
| API-001 | API_INVOKE_GATEWAY | critical | All domain calls via `invokeApi` / platform.invoke |
| API-002 | API_CONTROLLER_THIN | high | Controllers adapt only; posting stays in ops |
| API-003 | API_OPENAPI_FACADE | critical | OpenAPI documents contracts; no live REST required |
| API-004 | API_NO_NEW_HTTP_SOT | critical | No new HTTP server as system of record |
| API-005 | API_RBAC_ENFORCE | critical | RBAC + branch/tenant on mutating ops |
| API-006 | API_SUPER_ADMIN_FORBIDDEN | critical | Enforce `SUPER_ADMIN_FORBIDDEN` |
| API-007 | API_CORRELATION | high | Correlation / audit / metrics on gateway |
| API-008 | API_VALIDATE_INPUT | high | Schema/input validation before domain |
| API-009 | API_RATE_LIMIT | medium | Rate limit sensitive ops via platform |
| API-010 | API_MODULE20_ALIGN | high | Align with Module 20 / Wave 3 contracts |

---

## 4. Database standards registry

| ID | Code | Severity | Summary |
|----|------|----------|---------|
| DB-001 | DB_MIGRATIONS_ONLY | critical | Schema via versioned Supabase migrations |
| DB-002 | DB_PESEWAS_COLUMNS | critical | Money columns integer pesewas |
| DB-003 | DB_RLS_REQUIRED | critical | RLS for tenant/branch cloud access |
| DB-004 | DB_RPC_BOUNDARY | high | Cloud writes prefer audited RPCs |
| DB-005 | DB_APPEND_ONLY_POSTING | critical | Posted collections append-only (reverse, don’t edit) |
| DB-006 | DB_DUAL_WRITE_SAFE | high | Dual-write preserves local money SoT rules |
| DB-007 | DB_NO_RPO_REDEFINE | critical | Do not redefine Phase 14/15 RPO/RTO |
| DB-008 | DB_WAVE2_ALIGN | high | Align with Wave 2 migration/RLS catalog |

---

## 5. UI standards registry

| ID | Code | Severity | Summary |
|----|------|----------|---------|
| UI-001 | UI_SHARED_SPA | critical | Web UI = vanilla JS SPA (`app.js` + `src/`) |
| UI-002 | UI_NO_NEXTJS | critical | Next.js/React not primary delivery |
| UI-003 | UI_CAPACITOR_ANDROID | critical | Android = Capacitor + shared SPA |
| UI-004 | UI_NO_COMPOSE_PRIMARY | critical | Jetpack Compose not primary UI |
| UI-005 | UI_CSS_TOKENS | high | Use existing CSS variables (`--brand`, `--ink`, …) |
| UI-006 | UI_NO_PURPLE_CLICHE | medium | Avoid purple-on-white AI default aesthetics |
| UI-007 | UI_RESPONSIVE | high | Desktop + mobile CSS paths |
| UI-008 | UI_AUDIT_REPORTS_EXTRAS | critical | Extras under Audit/Reports only |
| UI-009 | UI_GHS_DISPLAY | medium | Display GHS; store pesewas |
| UI-010 | UI_A11Y_AA | high | WCAG 2.1 AA target for staff/member surfaces |

---

## 6. Compliance checklist registry

| ID | Code | Maps to | Critical |
|----|------|---------|----------|
| CHK-001 | CHK_STACK_SPA | UI-001, UI-002 | yes |
| CHK-002 | CHK_STACK_CAPACITOR | UI-003, UI-004 | yes |
| CHK-003 | CHK_STACK_ELECTRON | Wave 6 | yes |
| CHK-004 | CHK_MONEY_INVARIANTS | COD-003…006 | yes |
| CHK-005 | CHK_INVOKE_API | API-001, API-003 | yes |
| CHK-006 | CHK_NO_TOP_NAV | COD-012, UI-008 | yes |
| CHK-007 | CHK_AI_ADVISORY | COD-011 | yes |
| CHK-008 | CHK_RBAC_FORBIDDEN | API-006, NAM-010 | yes |
| CHK-009 | CHK_NPM_TEST | Phase 16 | yes |
| CHK-010 | CHK_PREPARE_WEB | COD-010 | yes |
| CHK-011 | CHK_SCHEMA_MANIFEST | Phase schemas | high |
| CHK-012 | CHK_PHASE_CONSUME | Phases 9/13–20 | yes |

---

## 7. Owners registry

| ID | Role | Accountable for |
|----|------|-----------------|
| OWN-001 | Engineering Lead | Coding, naming, prepare:web |
| OWN-002 | Architecture Owner | Stack invariants, registries, Clean Architecture adapters |
| OWN-003 | Domain Lead | Money / interest / days / cashier invariants |
| OWN-004 | Security Lead | RBAC, secrets, `SUPER_ADMIN_FORBIDDEN` |
| OWN-005 | QA Lead | Tests, quality gates, EDSM consistency suite |
| OWN-006 | UX Owner | SPA UX, nav, a11y, CSS tokens |

---

## 8. Stack invariants (normative)

| ID | Invariant |
|----|-----------|
| INV-001 | Shared vanilla JS SPA is the UI SoT for Web + EXE + APK |
| INV-002 | Capacitor Android — not Compose primary |
| INV-003 | No Next.js / React primary web rewrite |
| INV-004 | Wave 3 `invokeApi` — OpenAPI facade only |
| INV-005 | Wave 2 Supabase migrations/RLS/RPCs |
| INV-006 | Wave 4 JS offline/sync (+ thin native bridges) |
| INV-007 | Wave 6 Electron main/preload/IPC hardening |
| INV-008 | Money: pesewas · interest 15 · days 31 · cashier 1000 |

---

## 9. Cross-reference — Modules / Phases / Waves

| EDSM area | Consumes |
|-----------|----------|
| Architecture | EMA · Waves 1–6 · Modules 20/24/30 |
| Database | Wave 2 · Phase DB catalogs |
| Backend | Wave 3 · Module 20 |
| Android | Wave 4 |
| Web | Wave 5 |
| Windows | Wave 6 |
| Security | Phase 9 |
| Testing / gates | Phase 16 · Wave 8 |
| DevOps | Phase 14 |
| Monitoring | Phase 13 · Module 19 |
| Performance | Phase 17 |
| Governance links | Phase 19 |
| Baseline / backlog | Phase 20 · MIB · EIR |

---

## 10. Acceptance quick-check

- [ ] No Next.js / Compose mandated as primary  
- [ ] Capacitor + SPA + Electron documented  
- [ ] Money invariants present in code + docs  
- [ ] Registries validate critical = 0  
- [ ] Schemas in manifest with SHA-256  
- [ ] `npm test` green; `prepare:web` if mirrored  
