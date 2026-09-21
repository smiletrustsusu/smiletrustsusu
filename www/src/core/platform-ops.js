/**
 * Module 30 — Enterprise Platform Administration engines (in-process).
 * Tenant, config, feature flags, license, environment, maintenance,
 * deployment governance, global ops center, DR governance.
 * Does NOT duplicate Modules 1–29 business logic or post money.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import { queueNotification } from "./notifications.js";
import { recordMetric, recordLog, monitoringDashboard } from "./monitoring-ops.js";
import { registerJobHandler } from "./job-ops.js";
import { publishDomainEvent } from "./module-contracts.js";
import {
  isFeatureEnabled as baseIsFeatureEnabled,
  FEATURE_FLAG_CATALOG,
  ensureSystemConfig,
  setFeatureFlag as baseSetFeatureFlag
} from "./system-config.js";
import { backupDashboard, recoveryObjectives } from "./backup-recovery-ops.js";
import { securityDashboard } from "./security-ops.js";
import {
  PLATFORM_VERSION,
  TENANT_STATES,
  LICENSE_STATES,
  ENVIRONMENT_CODES,
  DEPLOY_STRATEGIES,
  DEPLOY_STATES,
  MAINTENANCE_TYPES,
  MAINTENANCE_STATES,
  DEFAULT_TENANT_ID,
  DEFAULT_LICENSE_ID,
  PLATFORM_ERROR_CODES,
  PLATFORM_ROUTE_CATALOG,
  canTransitionTenant,
  canTransitionLicense,
  assertPlatformLifecycleBoundary
} from "./platform-lifecycle.js";

export const PLATFORM_SCHEMA_VERSION = "1.0.0";
export { PLATFORM_ERROR_CODES };

const PLATFORM_ARRAYS = [
  "platformTenants",
  "platformTenantConfigurations",
  "platformTenantBranding",
  "platformTenantLocalization",
  "platformFeatureFlagRules",
  "platformLicenses",
  "platformLicenseAssignments",
  "platformDeploymentHistory",
  "platformDeploymentApprovals",
  "platformMaintenanceWindows",
  "platformConfigurations",
  "platformConfigurationHistory",
  "platformOperationalPolicies",
  "platformGlobalAnnouncements",
  "platformEnvironmentRegistry",
  "platformActivityLogs",
  "platformDrVerificationRecords"
];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function requireAction(user, action) {
  if (!permitted(user, action)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  return { ok: true };
}

function platformEnabled(state) {
  return baseIsFeatureEnabled(state, "enablePlatformAdmin") !== false;
}

function requirePlatform(state, user, action) {
  if (!platformEnabled(state)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-001"], errorCode: "PLT-001", http: 503 };
  }
  return requireAction(user, action);
}

function auditPlatform(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "configuration",
    guarantee: extras.guarantee || "G1",
    module: "30",
    ...extras
  }, uid);
  state.platformActivityLogs = state.platformActivityLogs || [];
  state.platformActivityLogs.push({
    id: newId("plog", uid),
    action,
    details,
    userId: user?.id || "",
    createdAt: nowIso(extras.now)
  });
}

function emitPlatformEvent(state, name, payload, { uid, now, correlationId = "", aggregateId = "" } = {}) {
  publishDomainEvent(state, {
    name,
    moduleId: 30,
    payload,
    correlationId,
    aggregateId,
    aggregateType: "Platform"
  }, uid, now);
}

function correlationId(uid, now) {
  return `corr-plt-${payloadHash(`${uid?.("x") || "x"}-${nowIso(now)}`).slice(0, 16)}`;
}

/** Deterministic 0–99 bucket for gradual rollout. */
export function flagRolloutBucket(flagId, subjectKey = "") {
  const hex = payloadHash(`${flagId}|${subjectKey}`);
  let n = 0;
  for (let i = 0; i < 8; i += 1) n = (n * 16 + parseInt(hex[i] || "0", 16)) >>> 0;
  return n % 100;
}

function isMaintenanceReadOnly(state, now) {
  const ts = nowMs(now);
  return (state.platformMaintenanceWindows || []).some((w) => {
    if (w.status !== "active") return false;
    if (w.readOnly !== true) return false;
    const start = Date.parse(w.startsAt || 0);
    const end = Date.parse(w.endsAt || "2100-01-01");
    return ts >= start && ts <= end;
  });
}

function assertMutatingAllowed(state, now) {
  if (isMaintenanceReadOnly(state, now)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-015"], errorCode: "PLT-015", http: 503 };
  }
  return { ok: true };
}

function seedDefaultTenant(uid, now) {
  const ts = nowIso(now);
  return {
    tenant: {
      id: DEFAULT_TENANT_ID,
      code: "SMILE-TRUST",
      name: "Smile Trust",
      status: "active",
      region: "GH",
      timezone: "Africa/Accra",
      createdAt: ts,
      createdBy: "system",
      retentionDays: 2555
    },
    configuration: {
      id: "tcfg-smile-trust",
      tenantId: DEFAULT_TENANT_ID,
      currency: "GHS",
      loanInterestDefault: 15,
      collectionDaysDefault: 31,
      locale: "en-GH",
      updatedAt: ts
    },
    branding: {
      id: "tbr-smile-trust",
      tenantId: DEFAULT_TENANT_ID,
      primaryColor: "#0B5F3A",
      logo: "assets/smile-trust-logo.png",
      productName: "Smile Trust Susu Management System",
      updatedAt: ts
    },
    localization: {
      id: "tloc-smile-trust",
      tenantId: DEFAULT_TENANT_ID,
      language: "en",
      dateFormat: "YYYY-MM-DD",
      numberFormat: "en-GH",
      timezone: "Africa/Accra",
      updatedAt: ts
    }
  };
}

function seedEnvironments(uid, now) {
  const ts = nowIso(now);
  return ENVIRONMENT_CODES.map((code) => ({
    id: `env-${code}`,
    code,
    name: code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    status: code === "production" ? "active" : "available",
    metadata: { independentlyConfigurable: true, separateDatabase: false },
    createdAt: ts
  }));
}

function seedLicense(uid, now) {
  const ts = nowIso(now);
  const expiresAt = new Date(nowMs(now) + 365 * 24 * 3600 * 1000).toISOString();
  return {
    license: {
      id: DEFAULT_LICENSE_ID,
      code: "PLT-OWNER-2026",
      status: "active",
      issuedTo: "SystemOwner",
      issuedAt: ts,
      activatedAt: ts,
      expiresAt,
      entitlements: ["platform", "tenants", "flags", "deploy", "maintenance", "ops", "dr"],
      quotas: { users: 10000, branches: 500, devices: 5000, apiPerMinute: 6000 },
      createdBy: "system"
    },
    assignment: {
      id: "lassign-owner",
      licenseId: DEFAULT_LICENSE_ID,
      assigneeType: "system",
      assigneeId: "u-owner",
      tenantId: DEFAULT_TENANT_ID,
      createdAt: ts
    }
  };
}

export function ensurePlatformState(state = {}, uid, now) {
  ensureSystemConfig(state);
  PLATFORM_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  state.platformMeta = state.platformMeta || { version: PLATFORM_VERSION, seeded: false };

  if (!(state.platformTenants || []).some((t) => t.id === DEFAULT_TENANT_ID)) {
    const seed = seedDefaultTenant(uid, now);
    state.platformTenants.push(seed.tenant);
    state.platformTenantConfigurations.push(seed.configuration);
    state.platformTenantBranding.push(seed.branding);
    state.platformTenantLocalization.push(seed.localization);
  }
  if (!(state.platformEnvironmentRegistry || []).length) {
    state.platformEnvironmentRegistry.push(...seedEnvironments(uid, now));
  }
  if (!(state.platformLicenses || []).some((l) => l.id === DEFAULT_LICENSE_ID)) {
    const lic = seedLicense(uid, now);
    state.platformLicenses.push(lic.license);
    state.platformLicenseAssignments.push(lic.assignment);
  }
  if (!(state.platformConfigurations || []).some((c) => c.key === "platform.defaults")) {
    state.platformConfigurations.push({
      id: "pcfg-defaults",
      key: "platform.defaults",
      version: 1,
      value: {
        auth: { minPasswordLength: 8, sessionMinutes: 480 },
        notifications: { defaultChannel: "in_app" },
        api: { defaultRatePerMinute: 60 },
        monitoring: { sampleHealthy: true },
        backup: { rpoMinutes: 60, rtoMinutes: 240 },
        ai: { advisoryOnly: true },
        workflow: { makerChecker: true },
        auditRetentionDays: 2555,
        documentRetentionDays: 2555,
        paymentProviderDefaults: { momoEnabled: true, secretsInPlaintext: false },
        currency: "GHS",
        localization: { timezone: "Africa/Accra", locale: "en-GH" }
      },
      publishedAt: nowIso(now),
      publishedBy: "system"
    });
  }
  if (!(state.platformOperationalPolicies || []).length) {
    state.platformOperationalPolicies.push({
      id: "pol-retention",
      code: "tenant_deletion_retention",
      minRetentionDays: 90,
      requireApproval: true,
      updatedAt: nowIso(now)
    });
  }
  state.platformMeta.seeded = true;
  return state;
}

function findTenant(state, tenantId) {
  return (state.platformTenants || []).find((t) => t.id === tenantId || t.code === tenantId) || null;
}

function scopedTenantRows(rows, tenantId) {
  return (rows || []).filter((row) => row.tenantId === tenantId);
}

/* -------------------- Tenant Management -------------------- */

export function registerTenant(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Tenant");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const code = String(payload.code || "").trim().toUpperCase();
  const name = String(payload.name || "").trim();
  if (!code || !name) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-030"], errorCode: "PLT-030", http: 400 };
  }
  if ((state.platformTenants || []).some((t) => t.code === code)) {
    return { ok: false, error: "Tenant code already exists", errorCode: "PLT-030", http: 409 };
  }
  const ts = nowIso(now);
  const tenant = {
    id: newId("tenant", uid),
    code,
    name,
    status: "registered",
    region: payload.region || "GH",
    timezone: payload.timezone || "Africa/Accra",
    createdAt: ts,
    createdBy: user?.id || "",
    retentionDays: Number(payload.retentionDays) || 2555,
    migration: payload.migration || null
  };
  state.platformTenants.push(tenant);
  state.platformTenantConfigurations.push({
    id: newId("tcfg", uid),
    tenantId: tenant.id,
    currency: payload.currency || "GHS",
    locale: payload.locale || "en-GH",
    loanInterestDefault: 15,
    collectionDaysDefault: 31,
    updatedAt: ts
  });
  state.platformTenantBranding.push({
    id: newId("tbr", uid),
    tenantId: tenant.id,
    primaryColor: payload.primaryColor || "#0B5F3A",
    logo: payload.logo || "",
    productName: name,
    updatedAt: ts
  });
  state.platformTenantLocalization.push({
    id: newId("tloc", uid),
    tenantId: tenant.id,
    language: payload.language || "en",
    dateFormat: "YYYY-MM-DD",
    numberFormat: payload.locale || "en-GH",
    timezone: tenant.timezone,
    updatedAt: ts
  });
  auditPlatform(state, "Platform.Tenant.Register", `${tenant.code}`, user, { entityId: tenant.id, now }, uid);
  return { ok: true, tenant };
}

export function transitionTenant(state, tenantId, to, user, uid, now, extras = {}) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, to === "deleted" || to === "suspended" ? "Platform.Admin" : "Platform.Tenant");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const tenant = findTenant(state, tenantId);
  if (!tenant) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-003"], errorCode: "PLT-003", http: 404 };
  if (!canTransitionTenant(tenant.status, to)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-004"], errorCode: "PLT-004", http: 409 };
  }
  if (to === "deleted") {
    const policy = (state.platformOperationalPolicies || []).find((p) => p.code === "tenant_deletion_retention");
    const minDays = Number(policy?.minRetentionDays || 90);
    const archivedAt = Date.parse(tenant.archivedAt || tenant.updatedAt || tenant.createdAt || 0);
    if (nowMs(now) - archivedAt < minDays * 24 * 3600 * 1000 && tenant.status !== "pending_deletion") {
      return { ok: false, error: PLATFORM_ERROR_CODES["PLT-006"], errorCode: "PLT-006", http: 409 };
    }
    if (tenant.status === "archived") {
      tenant.status = "pending_deletion";
      tenant.pendingDeletionAt = nowIso(now);
      auditPlatform(state, "Platform.Tenant.PendingDeletion", tenant.code, user, { entityId: tenant.id, now }, uid);
      return { ok: true, tenant, pendingDeletion: true };
    }
  }
  const prev = tenant.status;
  tenant.status = to;
  tenant.updatedAt = nowIso(now);
  if (to === "archived") tenant.archivedAt = nowIso(now);
  if (to === "active" && prev === "reactivating") tenant.reactivatedAt = nowIso(now);
  if (to === "suspended") {
    emitPlatformEvent(state, "TenantSuspended", { tenantId: tenant.id, code: tenant.code }, { uid, now, aggregateId: tenant.id });
  }
  auditPlatform(state, "Platform.Tenant.Transition", `${tenant.code}: ${prev} → ${to}`, user, { entityId: tenant.id, now, reason: extras.reason || "" }, uid);
  return { ok: true, tenant };
}

export function getTenantConfig(state, tenantId, user) {
  ensurePlatformState(state);
  const gate = requirePlatform(state, user, "Platform.View");
  if (!gate.ok) return gate;
  const tenant = findTenant(state, tenantId);
  if (!tenant) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-003"], errorCode: "PLT-003", http: 404 };
  const configuration = scopedTenantRows(state.platformTenantConfigurations, tenant.id)[0] || null;
  const branding = scopedTenantRows(state.platformTenantBranding, tenant.id)[0] || null;
  const localization = scopedTenantRows(state.platformTenantLocalization, tenant.id)[0] || null;
  return { ok: true, tenant, configuration, branding, localization };
}

export function updateTenantConfig(state, tenantId, patch = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Config");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const tenant = findTenant(state, tenantId);
  if (!tenant) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-003"], errorCode: "PLT-003", http: 404 };
  const cfg = scopedTenantRows(state.platformTenantConfigurations, tenant.id)[0];
  if (!cfg) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-003"], errorCode: "PLT-003", http: 404 };
  // Never overwrite core Smile Trust financial constants via silent cross-tenant bleed
  Object.assign(cfg, {
    currency: patch.currency ?? cfg.currency,
    locale: patch.locale ?? cfg.locale,
    updatedAt: nowIso(now)
  });
  if (patch.branding) {
    const br = scopedTenantRows(state.platformTenantBranding, tenant.id)[0];
    if (br) Object.assign(br, { ...patch.branding, tenantId: tenant.id, updatedAt: nowIso(now) });
  }
  if (patch.localization) {
    const loc = scopedTenantRows(state.platformTenantLocalization, tenant.id)[0];
    if (loc) Object.assign(loc, { ...patch.localization, tenantId: tenant.id, updatedAt: nowIso(now) });
  }
  auditPlatform(state, "Platform.Tenant.Config", tenant.code, user, { entityId: tenant.id, now }, uid);
  return { ok: true, configuration: cfg };
}

export function listTenants(state, user) {
  ensurePlatformState(state);
  if (!platformEnabled(state)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-001"], errorCode: "PLT-001", http: 503 };
  }
  if (!permitted(user, "Platform.View") && !permitted(user, "Platform.Tenant")) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  return { ok: true, rows: [...(state.platformTenants || [])] };
}

/* -------------------- Platform Configuration -------------------- */

export function getPlatformConfig(state, key, user) {
  ensurePlatformState(state);
  const gate = requirePlatform(state, user, "Platform.Config");
  if (!gate.ok && !permitted(user, "Platform.View")) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  const rows = (state.platformConfigurations || []).filter((c) => !key || c.key === key);
  return { ok: true, rows, history: (state.platformConfigurationHistory || []).filter((h) => !key || h.key === key).slice(-50) };
}

export function publishPlatformConfig(state, { key, value, reason } = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Config");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  if (!key) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-007"], errorCode: "PLT-007", http: 400 };
  if (String(JSON.stringify(value || {})).toLowerCase().includes("momo pin") || String(JSON.stringify(value || {})).includes("bankPassword")) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-007"], errorCode: "PLT-007", http: 400 };
  }
  let row = (state.platformConfigurations || []).find((c) => c.key === key);
  const previous = row ? structuredClone(row.value) : null;
  const version = row ? Number(row.version || 1) + 1 : 1;
  if (!row) {
    row = { id: newId("pcfg", uid), key, version, value, publishedAt: nowIso(now), publishedBy: user?.id || "" };
    state.platformConfigurations.push(row);
  } else {
    row.version = version;
    row.value = value;
    row.publishedAt = nowIso(now);
    row.publishedBy = user?.id || "";
  }
  state.platformConfigurationHistory.push({
    id: newId("pcfgh", uid),
    key,
    version,
    previous,
    value,
    reason: reason || "",
    publishedBy: user?.id || "",
    publishedAt: nowIso(now),
    immutable: true
  });
  auditPlatform(state, "Platform.Config.Publish", `${key} v${version}`, user, { entityId: row.id, now, category: "configuration", guarantee: "G2" }, uid);
  return { ok: true, configuration: row, version };
}

/* -------------------- Feature Flag Engine (wraps system-config) -------------------- */

export function evaluateFeatureFlag(state, flagId, context = {}, now) {
  ensurePlatformState(state);
  const catalog = FEATURE_FLAG_CATALOG.find((f) => f.id === flagId);
  const flagRow = (state.featureFlags || []).find((f) => f.id === flagId);
  if (!catalog && !flagRow) {
    return { ok: false, enabled: false, error: PLATFORM_ERROR_CODES["PLT-008"], errorCode: "PLT-008" };
  }

  const ts = nowMs(now);
  if (flagRow?.killSwitch === true) {
    return { ok: true, enabled: false, reason: "kill_switch", deterministic: true };
  }

  const rules = (state.platformFeatureFlagRules || []).filter((r) => r.flagId === flagId && r.enabled !== false);
  for (const rule of rules) {
    if (rule.killSwitch === true) {
      return { ok: true, enabled: false, reason: "rule_kill_switch", ruleId: rule.id, deterministic: true };
    }
    if (rule.activateAt && ts < Date.parse(rule.activateAt)) {
      continue;
    }
    if (rule.retireAt && ts >= Date.parse(rule.retireAt)) {
      continue;
    }
    if (rule.tenantIds?.length) {
      const tid = context.tenantId || DEFAULT_TENANT_ID;
      if (!rule.tenantIds.includes(tid)) continue;
    }
    if (rule.branchIds?.length) {
      const bid = context.branchId || "";
      if (!rule.branchIds.includes(bid)) continue;
    }
    if (Number.isFinite(Number(rule.rolloutPercent))) {
      const pct = Math.max(0, Math.min(100, Number(rule.rolloutPercent)));
      const subject = context.subjectKey || context.userId || context.branchId || context.tenantId || "global";
      const bucket = flagRolloutBucket(flagId, subject);
      const enabled = bucket < pct;
      return { ok: true, enabled, reason: "rollout", bucket, percent: pct, ruleId: rule.id, deterministic: true };
    }
    if (rule.enabled === true) {
      return { ok: true, enabled: true, reason: "rule_enable", ruleId: rule.id, deterministic: true };
    }
    if (rule.enabled === false) {
      return { ok: true, enabled: false, reason: "rule_disable", ruleId: rule.id, deterministic: true };
    }
  }

  if (flagRow?.scheduledActivateAt && ts < Date.parse(flagRow.scheduledActivateAt)) {
    return { ok: true, enabled: false, reason: "scheduled_inactive", deterministic: true };
  }
  if (flagRow?.scheduledRetireAt && ts >= Date.parse(flagRow.scheduledRetireAt)) {
    return { ok: true, enabled: false, reason: "retired", deterministic: true };
  }

  const base = baseIsFeatureEnabled(state, flagId);
  return { ok: true, enabled: base !== false, reason: "base_flag", deterministic: true };
}

export function setPlatformFlag(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Flag");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const flagId = payload.flagId || payload.id;
  if (!flagId) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-008"], errorCode: "PLT-008", http: 404 };

  if (payload.rule) {
    const rule = {
      id: newId("ffrule", uid),
      flagId,
      enabled: payload.rule.enabled !== false,
      killSwitch: Boolean(payload.rule.killSwitch),
      rolloutPercent: payload.rule.rolloutPercent,
      tenantIds: payload.rule.tenantIds || [],
      branchIds: payload.rule.branchIds || [],
      activateAt: payload.rule.activateAt || null,
      retireAt: payload.rule.retireAt || null,
      createdAt: nowIso(now),
      createdBy: user?.id || ""
    };
    state.platformFeatureFlagRules.push(rule);
    auditPlatform(state, "Platform.Flag.Rule", flagId, user, { entityId: rule.id, now }, uid);
    return { ok: true, rule };
  }

  const result = baseSetFeatureFlag(state, {
    id: flagId,
    enabled: payload.enabled,
    reason: payload.reason || "platform flag",
    user,
    now
  }, uid);
  if (result.error) return { ok: false, error: result.error, errorCode: "PLT-008" };
  const flag = (state.featureFlags || []).find((f) => f.id === flagId);
  if (flag) {
    if (payload.killSwitch != null) flag.killSwitch = Boolean(payload.killSwitch);
    if (payload.scheduledActivateAt != null) flag.scheduledActivateAt = payload.scheduledActivateAt;
    if (payload.scheduledRetireAt != null) flag.scheduledRetireAt = payload.scheduledRetireAt;
  }
  auditPlatform(state, "Platform.Flag.Set", `${flagId}=${payload.enabled}`, user, { entityId: flagId, now }, uid);
  return { ok: true, ...result, flag };
}

export function killFeatureFlag(state, flagId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Admin");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  ensureSystemConfig(state);
  let flag = (state.featureFlags || []).find((f) => f.id === flagId);
  if (!flag) {
    if (!FEATURE_FLAG_CATALOG.some((f) => f.id === flagId)) {
      return { ok: false, error: PLATFORM_ERROR_CODES["PLT-008"], errorCode: "PLT-008", http: 404 };
    }
    flag = { id: flagId, enabled: false, killSwitch: true };
    state.featureFlags.push(flag);
  } else {
    flag.enabled = false;
    flag.killSwitch = true;
  }
  state.platformFeatureFlagRules.push({
    id: newId("ffkill", uid),
    flagId,
    enabled: true,
    killSwitch: true,
    createdAt: nowIso(now),
    createdBy: user?.id || "",
    emergency: true
  });
  auditPlatform(state, "Platform.Flag.KillSwitch", flagId, user, { entityId: flagId, now, category: "security", guarantee: "G2" }, uid);
  emitPlatformEvent(state, "FeatureFlagKilled", { flagId }, { uid, now, aggregateId: flagId });
  queueNotification(state, {
    event: "platform_flag_killed",
    channel: "In-App",
    userId: user?.id || "",
    vars: { flagId },
    uid
  });
  return { ok: true, flag };
}

/* -------------------- License Management -------------------- */

export function listLicenses(state, user) {
  ensurePlatformState(state);
  const gate = requirePlatform(state, user, "Platform.License");
  if (!gate.ok && !permitted(user, "Platform.View")) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  return { ok: true, rows: state.platformLicenses || [], assignments: state.platformLicenseAssignments || [] };
}

export function issueLicense(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.License");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const license = {
    id: newId("lic", uid),
    code: payload.code || `LIC-${Date.now().toString(36).toUpperCase()}`,
    status: "issued",
    issuedTo: payload.issuedTo || "",
    issuedAt: nowIso(now),
    expiresAt: payload.expiresAt || new Date(nowMs(now) + 365 * 24 * 3600 * 1000).toISOString(),
    entitlements: payload.entitlements || ["platform"],
    quotas: payload.quotas || { users: 100, branches: 10, devices: 100, apiPerMinute: 60 },
    createdBy: user?.id || ""
  };
  state.platformLicenses.push(license);
  auditPlatform(state, "Platform.License.Issue", license.code, user, { entityId: license.id, now }, uid);
  return { ok: true, license };
}

export function activateLicense(state, licenseId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.License");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const license = (state.platformLicenses || []).find((l) => l.id === licenseId);
  if (!license) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-010"], errorCode: "PLT-010", http: 404 };
  if (!canTransitionLicense(license.status, "active") && license.status !== "issued" && license.status !== "suspended" && license.status !== "renewing") {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-011"], errorCode: "PLT-011", http: 409 };
  }
  license.status = "active";
  license.activatedAt = nowIso(now);
  auditPlatform(state, "Platform.License.Activate", license.code, user, { entityId: license.id, now }, uid);
  return { ok: true, license };
}

export function revokeLicense(state, licenseId, user, uid, now, reason = "") {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Admin");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  if (!isSystemOwner(user) && !reason) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-021"], errorCode: "PLT-021", http: 400 };
  }
  const license = (state.platformLicenses || []).find((l) => l.id === licenseId);
  if (!license) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-010"], errorCode: "PLT-010", http: 404 };
  if (!canTransitionLicense(license.status, "revoked") && license.status === "revoked") {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-012"], errorCode: "PLT-012", http: 409 };
  }
  const prev = license.status;
  license.status = "revoked";
  license.revokedAt = nowIso(now);
  license.revokeReason = reason;
  auditPlatform(state, "Platform.License.Revoke", `${license.code} (${prev})`, user, { entityId: license.id, now, category: "security", guarantee: "G2" }, uid);
  return { ok: true, license };
}

export function renewLicense(state, licenseId, user, uid, now, extras = {}) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.License");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const license = (state.platformLicenses || []).find((l) => l.id === licenseId);
  if (!license) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-010"], errorCode: "PLT-010", http: 404 };
  license.status = "active";
  license.expiresAt = extras.expiresAt || new Date(nowMs(now) + 365 * 24 * 3600 * 1000).toISOString();
  license.renewedAt = nowIso(now);
  auditPlatform(state, "Platform.License.Renew", license.code, user, { entityId: license.id, now }, uid);
  return { ok: true, license };
}

export function expireLicenses(state, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const ts = nowMs(now);
  const expired = [];
  (state.platformLicenses || []).forEach((license) => {
    if (license.status === "active" && license.expiresAt && Date.parse(license.expiresAt) <= ts) {
      license.status = "expired";
      expired.push(license.id);
      emitPlatformEvent(state, "LicenseExpired", { licenseId: license.id, code: license.code }, { uid, now, aggregateId: license.id });
    }
  });
  return { ok: true, expired };
}

/**
 * Enforce license quotas. Returns clear errors; never mutates collections/loans/balances.
 */
export function enforceLicense(state, usage = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.License");
  if (!gate.ok && user && !permitted(user, "Platform.View")) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  expireLicenses(state, user, uid, now);
  const active = (state.platformLicenses || []).find((l) => l.status === "active");
  if (!active) {
    return {
      ok: false,
      allowed: false,
      error: PLATFORM_ERROR_CODES["PLT-011"],
      errorCode: "PLT-011",
      http: 403,
      collectionsUnchanged: true
    };
  }
  const quotas = active.quotas || {};
  const checks = [
    ["users", usage.users ?? (state.users || []).length],
    ["branches", usage.branches ?? (state.branches || []).length],
    ["devices", usage.devices ?? (state.devices || []).length],
    ["apiPerMinute", usage.apiPerMinute]
  ];
  for (const [key, value] of checks) {
    if (value == null || quotas[key] == null) continue;
    if (Number(value) > Number(quotas[key])) {
      return {
        ok: false,
        allowed: false,
        error: PLATFORM_ERROR_CODES["PLT-011"],
        errorCode: "PLT-011",
        http: 403,
        quota: key,
        limit: quotas[key],
        actual: value,
        collectionsUnchanged: true
      };
    }
  }
  return { ok: true, allowed: true, license: { id: active.id, code: active.code, status: active.status }, collectionsUnchanged: true };
}

/* -------------------- Environment Management -------------------- */

export function listEnvironments(state, user) {
  ensurePlatformState(state);
  const gate = requirePlatform(state, user, "Platform.View");
  if (!gate.ok) return gate;
  return { ok: true, rows: state.platformEnvironmentRegistry || [] };
}

export function updateEnvironment(state, envId, patch = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Admin");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const env = (state.platformEnvironmentRegistry || []).find((e) => e.id === envId || e.code === envId);
  if (!env) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-013"], errorCode: "PLT-013", http: 404 };
  Object.assign(env, {
    name: patch.name ?? env.name,
    status: patch.status ?? env.status,
    metadata: { ...(env.metadata || {}), ...(patch.metadata || {}), separateDatabase: false },
    updatedAt: nowIso(now)
  });
  auditPlatform(state, "Platform.Environment.Update", env.code, user, { entityId: env.id, now }, uid);
  return { ok: true, environment: env };
}

/* -------------------- Maintenance Manager -------------------- */

export function scheduleMaintenance(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Maintenance");
  if (!gate.ok) return gate;
  const type = MAINTENANCE_TYPES.includes(payload.type) ? payload.type : "scheduled";
  const window = {
    id: newId("maint", uid),
    type,
    status: "planned",
    title: payload.title || "Maintenance window",
    startsAt: payload.startsAt || nowIso(now),
    endsAt: payload.endsAt || new Date(nowMs(now) + 3600 * 1000).toISOString(),
    readOnly: payload.readOnly !== false,
    notify: payload.notify !== false,
    procedure: payload.procedure || { startup: [], shutdown: [] },
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.platformMaintenanceWindows.push(window);
  if (window.notify) {
    queueNotification(state, {
      event: "platform_maintenance_scheduled",
      channel: "In-App",
      userId: user?.id || "",
      vars: { title: window.title },
      uid
    });
  }
  auditPlatform(state, "Platform.Maintenance.Schedule", window.title, user, { entityId: window.id, now }, uid);
  return { ok: true, window };
}

export function startMaintenance(state, windowId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const action = "Platform.Maintenance";
  const gate = requirePlatform(state, user, action);
  if (!gate.ok) return gate;
  const window = (state.platformMaintenanceWindows || []).find((w) => w.id === windowId);
  if (!window) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-014"], errorCode: "PLT-014", http: 404 };
  if (window.type === "emergency" && !permitted(user, "Platform.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-002"], errorCode: "PLT-002", http: 403 };
  }
  window.status = "active";
  window.startedAt = nowIso(now);
  window.startedBy = user?.id || "";
  emitPlatformEvent(state, "MaintenanceStarted", { windowId: window.id, type: window.type, readOnly: window.readOnly }, { uid, now, aggregateId: window.id });
  auditPlatform(state, "Platform.Maintenance.Start", window.title, user, { entityId: window.id, now, category: "operational", guarantee: "G2" }, uid);
  recordLog(state, { level: "warn", message: `Maintenance started: ${window.title}`, domain: "platform" }, uid, now);
  return { ok: true, window };
}

export function endMaintenance(state, windowId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Maintenance");
  if (!gate.ok) return gate;
  const window = (state.platformMaintenanceWindows || []).find((w) => w.id === windowId);
  if (!window) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-014"], errorCode: "PLT-014", http: 404 };
  window.status = "completed";
  window.endedAt = nowIso(now);
  auditPlatform(state, "Platform.Maintenance.End", window.title, user, { entityId: window.id, now }, uid);
  return { ok: true, window };
}

export function isPlatformReadOnly(state, now) {
  ensurePlatformState(state);
  return isMaintenanceReadOnly(state, now);
}

/* -------------------- Deployment Governance -------------------- */

export function planDeployment(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Deploy");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const strategy = DEPLOY_STRATEGIES.includes(payload.strategy) ? payload.strategy : "rolling";
  const deployment = {
    id: newId("deploy", uid),
    version: payload.version || PLATFORM_VERSION,
    strategy,
    status: "pending_approval",
    environment: payload.environment || "production",
    docsRef: payload.docsRef || "docs/platform-administration.md",
    plannedBy: user?.id || "",
    createdAt: nowIso(now),
    verification: null,
    rollbackOf: payload.rollbackOf || null
  };
  state.platformDeploymentHistory.push(deployment);
  state.platformDeploymentApprovals.push({
    id: newId("dapr", uid),
    deploymentId: deployment.id,
    status: "pending",
    requestedBy: user?.id || "",
    createdAt: nowIso(now)
  });
  auditPlatform(state, "Platform.Deploy.Plan", deployment.version, user, { entityId: deployment.id, now }, uid);
  return { ok: true, deployment, requiresApproval: true };
}

export function approveDeployment(state, deploymentId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Deploy");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const deployment = (state.platformDeploymentHistory || []).find((d) => d.id === deploymentId);
  if (!deployment) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-016"], errorCode: "PLT-016", http: 404 };
  const approval = (state.platformDeploymentApprovals || []).find((a) => a.deploymentId === deploymentId && a.status === "pending");
  if (!approval) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-017"], errorCode: "PLT-017", http: 409 };
  if (approval.requestedBy && approval.requestedBy === user?.id && !isSystemOwner(user)) {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-020"], errorCode: "PLT-020", http: 409 };
  }
  approval.status = "approved";
  approval.approvedBy = user?.id || "";
  approval.approvedAt = nowIso(now);
  deployment.status = "approved";
  auditPlatform(state, "Platform.Deploy.Approve", deployment.version, user, { entityId: deployment.id, now, guarantee: "G2" }, uid);
  return { ok: true, deployment, approval };
}

export function executeDeployment(state, deploymentId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Deploy");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const deployment = (state.platformDeploymentHistory || []).find((d) => d.id === deploymentId);
  if (!deployment) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-016"], errorCode: "PLT-016", http: 404 };
  if (deployment.status !== "approved" && deployment.status !== "in_progress") {
    return { ok: false, error: PLATFORM_ERROR_CODES["PLT-017"], errorCode: "PLT-017", http: 409 };
  }
  deployment.status = "completed";
  deployment.executedAt = nowIso(now);
  deployment.executedBy = user?.id || "";
  deployment.verification = { ok: true, checkedAt: nowIso(now), notes: "In-process verification metadata only" };
  auditPlatform(state, "Platform.Deploy.Execute", deployment.version, user, { entityId: deployment.id, now }, uid);
  return { ok: true, deployment };
}

export function rollbackDeployment(state, deploymentId, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Deploy");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const deployment = (state.platformDeploymentHistory || []).find((d) => d.id === deploymentId);
  if (!deployment) return { ok: false, error: PLATFORM_ERROR_CODES["PLT-016"], errorCode: "PLT-016", http: 404 };
  deployment.status = "rolled_back";
  deployment.rolledBackAt = nowIso(now);
  auditPlatform(state, "Platform.Deploy.Rollback", deployment.version, user, { entityId: deployment.id, now }, uid);
  return { ok: true, deployment };
}

/* -------------------- Announcements -------------------- */

export function publishAnnouncement(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Admin");
  if (!gate.ok) return gate;
  const mutate = assertMutatingAllowed(state, now);
  if (!mutate.ok) return mutate;
  const row = {
    id: newId("ann", uid),
    title: payload.title || "Announcement",
    body: payload.body || "",
    severity: payload.severityity || "info",
    audience: payload.audience || "all",
    active: true,
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.platformGlobalAnnouncements.push(row);
  queueNotification(state, {
    event: "platform_announcement",
    channel: "In-App",
    userId: user?.id || "",
    vars: { title: row.title, body: row.body },
    uid
  });
  auditPlatform(state, "Platform.Announcement.Publish", row.title, user, { entityId: row.id, now }, uid);
  return { ok: true, announcement: row };
}

export function listAnnouncements(state, user) {
  ensurePlatformState(state);
  const gate = requirePlatform(state, user, "Platform.View");
  if (!gate.ok) return gate;
  return { ok: true, rows: (state.platformGlobalAnnouncements || []).filter((a) => a.active !== false) };
}

/* -------------------- Global Ops Center & DR -------------------- */

export function platformOpsDashboard(state, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.View");
  if (!gate.ok) return gate;

  const monitoring = monitoringDashboard(state) || {};
  const backup = backupDashboard(state, now) || {};
  const security = securityDashboard(state) || {};
  const payments = {
    status: "stub",
    completed: (state.paymentTransactions || []).filter((p) => p.status === "Completed").length,
    failed: (state.paymentTransactions || []).filter((p) => p.status === "Failed").length
  };

  const storageEstimate = {
    customers: (state.customers || []).length,
    collections: (state.collections || []).length,
    audit: (state.audit || []).length,
    approxKb: Math.round(((state.customers || []).length + (state.collections || []).length + (state.audit || []).length) * 0.25)
  };

  recordMetric(state, { name: "platform.ops.dashboard", value: 1, domain: "platform" }, uid, now);

  return {
    ok: true,
    postsMoney: false,
    checkedAt: nowIso(now),
    tenants: {
      total: (state.platformTenants || []).length,
      active: (state.platformTenants || []).filter((t) => t.status === "active").length
    },
    licenses: {
      active: (state.platformLicenses || []).filter((l) => l.status === "active").length,
      expired: (state.platformLicenses || []).filter((l) => l.status === "expired").length
    },
    flags: {
      on: (state.featureFlags || []).filter((f) => f.enabled && !f.killSwitch).length,
      killed: (state.featureFlags || []).filter((f) => f.killSwitch).length,
      rules: (state.platformFeatureFlagRules || []).length
    },
    maintenance: {
      active: (state.platformMaintenanceWindows || []).filter((w) => w.status === "active").length,
      readOnly: isMaintenanceReadOnly(state, now)
    },
    deployments: {
      pendingApproval: (state.platformDeploymentApprovals || []).filter((a) => a.status === "pending").length,
      recent: (state.platformDeploymentHistory || []).slice(-5)
    },
    monitoring,
    integration: {
      providers: (state.integrationProviders || []).length,
      webhooks: (state.integrationWebhooks || []).length
    },
    ai: {
      models: (state.aiModels || []).length,
      predictions: (state.aiPredictionResults || []).length
    },
    payments,
    storage: storageEstimate,
    security: {
      incidents: security.incidents ?? (state.securityIncidents || []).filter((i) => i.status !== "closed").length,
      auditEvents: (state.audit || []).length
    },
    backup: {
      sets: backup.backups ?? 0,
      verified: backup.verified ?? 0
    },
    dr: platformDrDashboard(state, user, uid, now)
  };
}

export function platformDrDashboard(state, user, uid, now) {
  ensurePlatformState(state, uid, now);
  if (user) {
    const gate = requirePlatform(state, user, "Platform.View");
    if (!gate.ok) return gate;
  }
  const backup = { ...backupDashboard(state, now), ...recoveryObjectives(state, now) };
  const verifications = state.platformDrVerificationRecords || [];
  return {
    ok: true,
    governedBy: "Module 21 backup-recovery (no duplicate engine)",
    backup,
    verifications: verifications.slice(-10),
    failoverReadiness: backup.rtoCompliant !== false && backup.rpoBreached !== true ? "ready" : "at_risk",
    rtoMinutes: backup.rtoMinutes ?? 240,
    rpoMinutes: backup.rpoMinutes ?? 60,
    continuityNotes: "Platform Module 30 governs DR metadata; execution remains Module 21."
  };
}

export function recordDrVerification(state, payload = {}, user, uid, now) {
  ensurePlatformState(state, uid, now);
  const gate = requirePlatform(state, user, "Platform.Admin");
  if (!gate.ok) return gate;
  const row = {
    id: newId("drv", uid),
    kind: payload.kind || "backup_verify",
    status: payload.status || "passed",
    notes: payload.notes || "",
    rtoObservedMinutes: payload.rtoObservedMinutes,
    rpoObservedMinutes: payload.rpoObservedMinutes,
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.platformDrVerificationRecords.push(row);
  auditPlatform(state, "Platform.Dr.Verify", row.kind, user, { entityId: row.id, now }, uid);
  return { ok: true, verification: row };
}

export function platformHealth(state, now) {
  ensurePlatformState(state);
  return {
    status: platformEnabled(state) ? "healthy" : "disabled",
    version: PLATFORM_VERSION,
    checkedAt: nowIso(now),
    readOnly: isMaintenanceReadOnly(state, now),
    tenants: (state.platformTenants || []).length,
    routes: PLATFORM_ROUTE_CATALOG.length
  };
}

export function platformReports(state, reportId) {
  ensurePlatformState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "platform_tenants") {
    return table(["id", "code", "name", "status", "timezone"], state.platformTenants || []);
  }
  if (reportId === "platform_licenses") {
    return table(["id", "code", "status", "expiresAt"], state.platformLicenses || []);
  }
  if (reportId === "platform_flags") {
    return table(["id", "enabled", "killSwitch"], state.featureFlags || []);
  }
  if (reportId === "platform_deployments") {
    return table(["id", "version", "strategy", "status"], state.platformDeploymentHistory || []);
  }
  if (reportId === "platform_maintenance") {
    return table(["id", "type", "status", "startsAt", "endsAt"], state.platformMaintenanceWindows || []);
  }
  if (reportId === "platform_config_history") {
    return table(["key", "version", "publishedAt", "publishedBy"], state.platformConfigurationHistory || []);
  }
  if (reportId === "platform_environments") {
    return table(["id", "code", "name", "status"], state.platformEnvironmentRegistry || []);
  }
  if (reportId === "platform_announcements") {
    return table(["id", "title", "severityity", "createdAt"], state.platformGlobalAnnouncements || []);
  }
  if (reportId === "platform_dr") {
    return table(["id", "kind", "status", "createdAt"], state.platformDrVerificationRecords || []);
  }
  if (reportId === "platform_ops") {
    return table(["metric", "value"], [
      { metric: "tenants", value: (state.platformTenants || []).length },
      { metric: "licenses", value: (state.platformLicenses || []).length },
      { metric: "flag_rules", value: (state.platformFeatureFlagRules || []).length }
    ]);
  }
  return table(["id"], []);
}

export function exportPlatformCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function assertPlatformBoundary() {
  return {
    ...assertPlatformLifecycleBoundary(),
    customerBalanceUntouched: true,
    moneyUnit: "pesewas",
    doesNotDuplicateModules1to29: true
  };
}

registerJobHandler("platform_license_expire", (state, _job, ctx) => {
  ensurePlatformState(state, ctx.uid, ctx.now);
  return expireLicenses(state, ctx.user || { role: "SystemOwner", systemOwner: true }, ctx.uid, ctx.now);
});

registerJobHandler("platform_ops_snapshot", (state, _job, ctx) => {
  ensurePlatformState(state, ctx.uid, ctx.now);
  const dash = platformOpsDashboard(state, ctx.user || { role: "SystemOwner", systemOwner: true }, ctx.uid, ctx.now);
  return { ok: true, tenants: dash.tenants, readOnly: dash.maintenance?.readOnly };
});

export {
  PLATFORM_ROUTE_CATALOG,
  TENANT_STATES,
  LICENSE_STATES,
  DEPLOY_STATES,
  MAINTENANCE_STATES,
  DEFAULT_TENANT_ID,
  DEFAULT_LICENSE_ID
};
