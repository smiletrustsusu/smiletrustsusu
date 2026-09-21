/**
 * Module 30 — Enterprise Platform Administration lifecycle catalogs.
 * Governs Modules 1–29 operation metadata. Does NOT own collections, loans,
 * BI formulas, AI engines, Integration Hub dispatch, or Rule Engine logic.
 * In-process only — no REST/GraphQL HTTP server.
 */

export const PLATFORM_SCHEMA_LIFECYCLE = "1.0.0";
export const PLATFORM_VERSION = "1.0.0";

export const TENANT_STATES = ["registered", "active", "suspended", "reactivating", "archived", "pending_deletion", "deleted"];
export const TENANT_TRANSITIONS = {
  registered: ["active", "archived", "pending_deletion"],
  active: ["suspended", "archived", "pending_deletion"],
  suspended: ["reactivating", "archived", "pending_deletion"],
  reactivating: ["active", "suspended"],
  archived: ["pending_deletion", "active"],
  pending_deletion: ["deleted", "archived"],
  deleted: []
};

export const LICENSE_STATES = ["draft", "issued", "active", "renewing", "suspended", "expired", "revoked"];
export const LICENSE_TRANSITIONS = {
  draft: ["issued", "revoked"],
  issued: ["active", "revoked", "expired"],
  active: ["renewing", "suspended", "expired", "revoked"],
  renewing: ["active", "expired", "revoked"],
  suspended: ["active", "revoked", "expired"],
  expired: ["renewing", "revoked"],
  revoked: []
};

export const ENVIRONMENT_CODES = ["development", "testing", "staging", "uat", "production", "dr"];
export const DEPLOY_STRATEGIES = ["blue_green", "canary", "rolling", "recreate"];
export const DEPLOY_STATES = ["planned", "pending_approval", "approved", "in_progress", "verified", "rolled_back", "completed", "cancelled"];
export const MAINTENANCE_TYPES = ["scheduled", "emergency"];
export const MAINTENANCE_STATES = ["planned", "notified", "active", "completed", "cancelled"];

export const DEFAULT_TENANT_ID = "tenant-smile-trust";
export const DEFAULT_LICENSE_ID = "lic-platform-owner";

export const PLATFORM_ERROR_CODES = {
  "PLT-001": "Platform administration disabled",
  "PLT-002": "Unauthorized platform action",
  "PLT-003": "Tenant not found",
  "PLT-004": "Tenant transition invalid",
  "PLT-005": "Tenant isolation violation",
  "PLT-006": "Tenant deletion blocked by retention policy",
  "PLT-007": "Platform configuration invalid",
  "PLT-008": "Feature flag not found",
  "PLT-009": "Feature flag evaluation failed",
  "PLT-010": "License not found",
  "PLT-011": "License not active or quota exceeded",
  "PLT-012": "License revocation denied",
  "PLT-013": "Environment not found",
  "PLT-014": "Maintenance window conflict or invalid",
  "PLT-015": "Platform is in read-only maintenance mode",
  "PLT-016": "Deployment not found",
  "PLT-017": "Deployment approval required",
  "PLT-018": "Deployment strategy invalid",
  "PLT-019": "Announcement not found",
  "PLT-020": "Segregation of duties violation",
  "PLT-021": "Privileged action requires audit context",
  "PLT-030": "Input validation failed"
};

export const PLATFORM_ROUTE_CATALOG = [
  { id: "platform.health", method: "GET", path: "/platform/health", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "platformHealth", required: [], idempotent: false },
  { id: "platform.ops.dashboard", method: "GET", path: "/platform/ops/dashboard", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "platformOpsDashboard", required: [], idempotent: false },
  { id: "platform.tenant.list", method: "GET", path: "/platform/tenants", versions: ["v1"], action: "Platform.Tenant", scopes: ["platform", "*"], graphql: "listTenants", required: [], idempotent: false },
  { id: "platform.tenant.register", method: "POST", path: "/platform/tenants", versions: ["v1"], action: "Platform.Tenant", scopes: ["platform", "*"], graphql: "registerTenant", required: ["code", "name"], idempotent: true },
  { id: "platform.tenant.transition", method: "POST", path: "/platform/tenants/transition", versions: ["v1"], action: "Platform.Admin", scopes: ["platform", "*"], graphql: "transitionTenant", required: ["tenantId", "to"], idempotent: true },
  { id: "platform.config.get", method: "GET", path: "/platform/config", versions: ["v1"], action: "Platform.Config", scopes: ["platform", "*"], graphql: "getPlatformConfig", required: [], idempotent: false },
  { id: "platform.config.publish", method: "POST", path: "/platform/config", versions: ["v1"], action: "Platform.Config", scopes: ["platform", "*"], graphql: "publishPlatformConfig", required: ["key"], idempotent: true },
  { id: "platform.flag.evaluate", method: "POST", path: "/platform/flags/evaluate", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "evaluateFeatureFlag", required: ["flagId"], idempotent: false },
  { id: "platform.flag.set", method: "POST", path: "/platform/flags", versions: ["v1"], action: "Platform.Flag", scopes: ["platform", "*"], graphql: "setPlatformFlag", required: ["flagId"], idempotent: true },
  { id: "platform.flag.kill", method: "POST", path: "/platform/flags/kill", versions: ["v1"], action: "Platform.Admin", scopes: ["platform", "*"], graphql: "killFeatureFlag", required: ["flagId"], idempotent: true },
  { id: "platform.license.list", method: "GET", path: "/platform/licenses", versions: ["v1"], action: "Platform.License", scopes: ["platform", "*"], graphql: "listLicenses", required: [], idempotent: false },
  { id: "platform.license.enforce", method: "POST", path: "/platform/licenses/enforce", versions: ["v1"], action: "Platform.License", scopes: ["platform", "*"], graphql: "enforceLicense", required: [], idempotent: false },
  { id: "platform.deploy.plan", method: "POST", path: "/platform/deployments", versions: ["v1"], action: "Platform.Deploy", scopes: ["platform", "*"], graphql: "planDeployment", required: ["version"], idempotent: true },
  { id: "platform.deploy.approve", method: "POST", path: "/platform/deployments/approve", versions: ["v1"], action: "Platform.Deploy", scopes: ["platform", "*"], graphql: "approveDeployment", required: ["deploymentId"], idempotent: true },
  { id: "platform.maintenance.start", method: "POST", path: "/platform/maintenance/start", versions: ["v1"], action: "Platform.Maintenance", scopes: ["platform", "*"], graphql: "startMaintenance", required: ["windowId"], idempotent: true },
  { id: "platform.environment.list", method: "GET", path: "/platform/environments", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "listEnvironments", required: [], idempotent: false },
  { id: "platform.dr.dashboard", method: "GET", path: "/platform/dr", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "platformDrDashboard", required: [], idempotent: false },
  { id: "platform.announcement.list", method: "GET", path: "/platform/announcements", versions: ["v1"], action: "Platform.View", scopes: ["platform", "*"], graphql: "listAnnouncements", required: [], idempotent: false }
];

export function canTransitionTenant(from, to) {
  return (TENANT_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionLicense(from, to) {
  return (LICENSE_TRANSITIONS[from] || []).includes(to);
}

export function assertPlatformLifecycleBoundary() {
  return {
    documentedOnly: true,
    restHttp: false,
    graphqlHttp: false,
    postsCollections: false,
    duplicatesModuleBusinessLogic: false,
    governsOnly: true,
    moneyUnit: "pesewas",
    customerBalanceUntouched: true,
    versioned: true
  };
}
