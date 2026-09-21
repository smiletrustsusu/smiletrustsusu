/**
 * Phase 8 docs generator
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
  console.log("wrote", rel);
};

w("docs/enterprise-configuration-policy-feature.md", `# Enterprise Configuration, Policy & Feature Management Specification (ECPFMS)

**Phase:** 8  
**Version:** 1.0.0  
**Status:** Authoritative  
**Date:** 2026-09-13  
**Registry:** \`src/core/canonical-config-registry.js\`  
**Engine:** Module 14 \`system-config.js\` (runtime)  
**Operational manager:** Module 30 Platform Admin (tenants, flag rules, kill switches, %)  
**Consumes:** Phases 1–7 · Modules 1–30  

## Principles

1. Catalog configuration, policy, and feature flags only — no new functional features or nav.
2. Dual-layer ownership: registry is Source of Truth; Module 14 remains the evaluation engine; Module 30 is operational manager for tenant/flag administration (Phase 2 dual-layer style).
3. Canonical live defaults are unchanged: loan interest **15**, collection days **31**, cashier approval limit GHS **1000**, currency **GHS**.
4. MoMo Webhook Secret remains Settings System Controls pattern (\`settings.momoWebhookSecret\`) — no MoMo PINs or bank passwords.
5. In-process only; Module 20 gateway facade; localStorage + optional Supabase.
6. Roles: Admin = Branch Manager, KBA = Super Admin, SystemOwner = john.

## Domains

| Domain | Examples | Primary owner |
|--------|----------|---------------|
| Platform | gateway rate, offline, backup, jobs | 14 / 15 / 18 / 20 / 21 / 30 |
| Org | language, currency, timezone, prefixes | 14 |
| Security | password, session, MFA, approval limits | 14 / 1 / 22 |
| Savings | collectionDays, max daily collection | 14 / 6 |
| Loans | loanInterest, min/max loan, penalty | 14 / 8 |
| Payments | daily limit, velocity, webhook secret ref | 16 / 28 |
| Workflow | escalation, rule timeouts, maker-checker | 23 / 24 |
| AI | shadow mode defaults | 29 |
| Monitoring | intervals, retention | 19 / 13 |
| Feature Flags | enableEnterprise* / enablePlatformAdmin | 14 catalog + 30 rules |

## Item Template

| Field | Description |
|-------|-------------|
| id | Canonical CFG- / POL- / FF- id |
| name | Human label |
| category | Domain |
| owningModule | Single numeric module owner |
| dataType | string \\| number \\| boolean |
| defaultValue | Seeded live default |
| scopes[] | Platform/Tenant/Branch/Product/User/Global/Emergency/Env |
| overridable | If false, Tenant/Branch/Product overrides ignored |
| version | Semver |

## Policies

Hard policies include GHS-only currency, maker-checker for high-risk, no MoMo PINs, tenant/branch/flag isolation, import validation, cache invalidation, and unchanged \`SUPER_ADMIN_FORBIDDEN\`.

## CONFIGURATION PRECEDENCE

Highest → lowest:

1. **Emergency** — time-boxed kill / emergency override (audited)
2. **Env** — environment overlay (dev/staging/production)
3. **Tenant** — Module 30 tenant configuration
4. **Branch** — branch-scoped override within tenant
5. **Product** — product definition overlay
6. **Global Default** — registry / PARAMETER_CATALOG default

Non-overridable items ignore Tenant/Branch/Product overlays; Emergency and Env may still apply when present.

## Versioning & Lifecycle

Draft → Pending Approval → Active → Superseded → Rolled Back. Module 14 \`configurationVersions\` remains the runtime version store.

## Validation & Governance

- Unique IDs; single owningModule; valid scopes
- \`validateConfigRegistry()\` and Module 14 \`validateParameter\`
- Maker-checker for highRisk
- Audit via configuration category (G1)

## Input & Dependency Rules

- Inputs: Phases 1–7 catalogs, Module 14 PARAMETER_CATALOG / FEATURE_FLAG_CATALOG, Module 30 flag engine, live \`settings\`
- Dependencies: Module 20 for external evaluate facade; Module 28 for webhook secret ref pattern
- Forbidden: redefining entities/APIs/DB/state machines; changing money math; granting SUPER_ADMIN forbidden actions via flags

## Tenant & Branch Isolation Rules

| Scope | Visibility | Modification | Inheritance |
|-------|------------|--------------|-------------|
| Platform | SystemOwner / KBA Platform | SystemOwner + Platform.Config | Root |
| Tenant | Same tenant operators | Platform.Tenant / Platform.Config | Inherits Platform |
| Branch | Same tenant + branch | Branch managers within tenant | Inherits Tenant |
| Product | Products in tenant | System.Products | Inherits Tenant |
| User | Self prefs only (non-financial) | Self / admin | Inherits Branch |

- Overrides never leak across tenants.
- Feature flag rules (\`platformFeatureFlagRules\`) are tenant-scoped; kill switches may be platform-wide with audit.
- Cache keys must include tenantId (+ branchId when branch-scoped).
- Import/export packages must declare tenantId; cross-tenant import rejected.
- Validation: \`assertTenantIsolation\` / \`enforceConfigResolution\`.
- Audit: every rejected cross-tenant attempt emits Config.Isolation.Check.

## Tenant & Branch Enforcement Points

Defense-in-depth layers 1–17:

1. UI Settings form (live settings fields)
2. SPA route/action gates (\`canAction\`)
3. Session tenant binding
4. Branch context binding
5. Config registry resolution (\`resolveEffectiveConfig\`)
6. Isolation helper (\`phase8-config-isolation.js\`)
7. Module 14 \`getConfigValue\` / \`setParameter\`
8. Module 14 feature flag base
9. Module 30 \`evaluateFeatureFlag\` (kill switch, %, rules)
10. Module 30 tenant configuration store
11. Product definition scope
12. Module 20 gateway \`platform.flag.evaluate\`
13. Contract handlers
14. Import/export validators
15. Cache stamp includes tenant-sensitive settings
16. Audit / activity logs
17. Admin Console / Platform Ops views

**Failure handling:** reject with ECPFMS-010/011/012/013; do not fall back to another tenant's values.  
**Validation:** registry + parameter validators before write.

---

*End of ECPFMS. Companion catalogs: \`docs/ecpfms-catalogs.md\`.*
`);

w("docs/ecpfms-catalogs.md", `# ECPFMS Catalogs (Phase 8)

**Parent:** [enterprise-configuration-policy-feature.md](./enterprise-configuration-policy-feature.md)  
**Registry:** \`src/core/canonical-config-registry.js\`

## Configuration Registry (summary)

Canonical items map 1:1 to Module 14 \`PARAMETER_CATALOG\` keys plus MoMo webhook secret ref and platform/AI seeds. Counts from \`ECPFMS_COUNTS\`.

| Canonical ID | Default | Owner | Notes |
|--------------|---------|-------|-------|
| CFG-FINANCE-LOAN-INTEREST | 15 | 14 | liveSetting loanInterest |
| CFG-FINANCE-COLLECTION-DAYS | 31 | 14 | liveSetting collectionDays |
| CFG-APPROVAL-CASHIER-LIMIT | 1000 | 14 | Cashier GHS limit |
| CFG-ORG-CURRENCY | GHS | 14 | non-overridable |
| CFG-PAYMENT-MOMO-WEBHOOK-SECRET-REF | settings.momoWebhookSecret | 28 | no PINs |

Full item list: \`CONFIG_ITEMS\` in registry.

## Policy Registry

See \`POLICY_ITEMS\` — isolation, GHS-only, maker-checker, no MoMo PINs, SUPER_ADMIN_FORBIDDEN unchanged.

## Feature Flag Registry

Maps FF-* → runtime ids including \`enableEnterpriseBi\`, \`enableEnterpriseIntegration\`, \`enableEnterpriseAi\`, \`enablePlatformAdmin\`.

## Ownership Matrix

| Layer | Role |
|-------|------|
| Registry SoT | Phase 8 ECPFMS |
| Runtime engine | Module 14 |
| Tenant/flag ops | Module 30 |
| Gateway evaluate | Module 20 |

## Precedence Matrix

Emergency > Env > Tenant > Branch > Product > Global

## Environment Override Matrix

Env overlays apply in non-production freely; production Env overrides require SystemOwner + audit.

## Validation Catalog / Version Registry / Rollback

Module 14 versions + \`validateConfigRegistry\`. Rollback via \`rollbackConfigVersion\`.

## Cross-ref Phases 1–7 / Modules 1–30

Consumes ECDM ENT-CFG-001, ECACIS platform routes, Module 14/30 dual ownership; does not redefine Phases 3–7 entities/APIs/DB/events.
`);

console.log("phase8 docs done");
