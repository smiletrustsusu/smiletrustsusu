/**
 * Module 28 — Enterprise Integration Hub lifecycle, catalogs, and policy models.
 * In-process only. No REST/GraphQL HTTP server. Does not post collections.
 */

export const INTEGRATION_SCHEMA_LIFECYCLE = "1.0.0";
export const INTEGRATION_HUB_VERSION = "1.0.0";

export const PROVIDER_CATEGORIES = [
  "momo", "bank", "payment", "sms", "email", "push", "kyc", "credit_bureau",
  "government", "accounting", "erp", "crm", "bi", "cloud_storage", "regulatory"
];

export const PROVIDER_STATES = ["registered", "configured", "healthy", "degraded", "suspended", "retired"];
export const PROVIDER_TRANSITIONS = {
  registered: ["configured", "retired"],
  configured: ["healthy", "degraded", "suspended", "retired"],
  healthy: ["degraded", "suspended", "retired"],
  degraded: ["healthy", "suspended", "retired"],
  suspended: ["configured", "retired"],
  retired: []
};

export const WEBHOOK_DIRECTIONS = ["inbound", "outbound"];
export const WEBHOOK_STATES = ["draft", "active", "paused", "failed", "retired"];
export const WEBHOOK_DELIVERY_STATES = [
  "queued", "delivering", "delivered", "retrying", "dead_letter", "replayed", "failed"
];

export const CIRCUIT_STATES = ["closed", "open", "half_open"];
export const API_VERSION_MODELS = ["uri", "header", "semver"];
export const AUTH_POLICY_MODELS = ["api_key", "oauth2", "oidc", "jwt", "mtls", "hmac", "session"];

export const RATE_LIMIT_SCOPES = [
  "user", "role", "api_key", "client", "ip", "partner", "endpoint", "window"
];

export const MESSAGE_PATTERNS = ["pubsub", "p2p"];
export const QUEUE_STATES = ["active", "paused", "draining", "retired"];
export const MESSAGE_STATES = ["queued", "delivered", "acked", "nacked", "dead_letter", "replayed"];

export const TRANSFORM_KINDS = [
  "json_xml", "xml_json", "csv", "field_map", "enum_map", "currency", "datetime", "encoding"
];

export const DELIVERY_MILESTONES = [
  "Planned",
  "Requirements Approved",
  "Design Approved",
  "Development Started",
  "Feature Complete",
  "QA Complete",
  "Security Review Complete",
  "Performance Validated",
  "Documentation Complete",
  "Production Released"
];

export const DELIVERY_STATUS = [
  "Not Started", "On Schedule", "At Risk", "Delayed", "Blocked", "Completed", "Cancelled"
];

export const DELIVERY_STATUS_TRANSITIONS = {
  "Not Started": ["On Schedule", "Blocked", "Cancelled"],
  "On Schedule": ["At Risk", "Delayed", "Blocked", "Completed", "Cancelled"],
  "At Risk": ["On Schedule", "Delayed", "Blocked", "Completed", "Cancelled"],
  "Delayed": ["At Risk", "On Schedule", "Blocked", "Completed", "Cancelled"],
  "Blocked": ["On Schedule", "At Risk", "Delayed", "Cancelled"],
  Completed: [],
  Cancelled: []
};

export const OWNERSHIP_ROLES = ["Primary Owner", "Backup Owner", "Reviewer", "Approver"];

export const INT_ERROR_CODES = {
  "INT-001": "Integration hub disabled",
  "INT-002": "Unauthorized integration action",
  "INT-003": "Provider not found",
  "INT-004": "Provider suspended or retired",
  "INT-005": "Route not found",
  "INT-006": "Authentication failed",
  "INT-007": "Authorization failed",
  "INT-008": "Rate limit exceeded",
  "INT-009": "Circuit breaker open",
  "INT-010": "Validation failed",
  "INT-011": "Webhook signature invalid",
  "INT-012": "Replay detected",
  "INT-013": "Transform failed",
  "INT-014": "Queue back-pressure",
  "INT-015": "OAuth/JWT policy rejected",
  "INT-016": "API key invalid",
  "INT-017": "IP not allowlisted",
  "INT-018": "Version deprecated or unknown",
  "INT-019": "Delivery milestone order violation",
  "INT-020": "Delivery dependency not met",
  "INT-021": "Deadline change requires approval",
  "INT-022": "Sensitive secret rejected",
  "INT-023": "Duplicate client or key",
  "INT-024": "Timeout",
  "INT-025": "Failover exhausted"
};

export const SEEDED_PROVIDERS = [
  { code: "MTN_MOMO", name: "MTN MoMo", category: "momo", priority: 10 },
  { code: "VODAFONE_CASH", name: "Vodafone Cash", category: "momo", priority: 20 },
  { code: "AIRTELTIGO_MONEY", name: "AirtelTigo Money", category: "momo", priority: 30 },
  { code: "GHIPSS", name: "GhIPSS Bank Rails", category: "bank", priority: 10 },
  { code: "HUBTEL_PAY", name: "Hubtel Payments", category: "payment", priority: 15 },
  { code: "SMS_GATEWAY", name: "SMS Gateway", category: "sms", priority: 10 },
  { code: "SMTP_RELAY", name: "SMTP Relay", category: "email", priority: 10 },
  { code: "FCM_PUSH", name: "FCM Push", category: "push", priority: 10 },
  { code: "NIA_KYC", name: "NIA KYC/ID", category: "kyc", priority: 10 },
  { code: "CREDIT_BUREAU_GH", name: "Credit Bureau GH", category: "credit_bureau", priority: 10 },
  { code: "GRA_REG", name: "GRA Regulatory", category: "government", priority: 10 },
  { code: "ERP_BRIDGE", name: "Accounting/ERP Bridge", category: "accounting", priority: 10 },
  { code: "CRM_BRIDGE", name: "CRM Bridge", category: "crm", priority: 20 },
  { code: "BI_EXPORT", name: "BI Export Partner", category: "bi", priority: 10 },
  { code: "CLOUD_STORE", name: "Cloud Storage", category: "cloud_storage", priority: 10 },
  { code: "REG_REPORTING", name: "Regulatory Reporting", category: "regulatory", priority: 10 }
];

export const HUB_ROUTE_CATALOG = [
  { id: "integration.health", method: "GET", path: "/integration/health", versions: ["v1"], action: "Integration.View", scopes: ["integration", "*"], graphql: "integrationHealth", required: [], idempotent: false },
  { id: "integration.dashboard", method: "GET", path: "/integration/dashboard", versions: ["v1"], action: "Integration.View", scopes: ["integration", "*"], graphql: "integrationDashboard", required: [], idempotent: false },
  { id: "integration.dispatch", method: "POST", path: "/integration/dispatch", versions: ["v1"], action: "Integration.Admin", scopes: ["integration", "*"], graphql: "integrationDispatch", required: ["providerCode", "operation"], idempotent: true },
  { id: "integration.provider.list", method: "GET", path: "/integration/providers", versions: ["v1"], action: "Integration.Provider", scopes: ["integration", "*"], graphql: "listProviders", required: [], idempotent: false },
  { id: "integration.provider.register", method: "POST", path: "/integration/providers", versions: ["v1"], action: "Integration.Provider", scopes: ["integration", "*"], graphql: "registerProvider", required: ["code", "name", "category"], idempotent: true },
  { id: "integration.webhook.register", method: "POST", path: "/integration/webhooks", versions: ["v1"], action: "Integration.Webhook", scopes: ["integration", "*"], graphql: "registerWebhook", required: ["direction", "eventType"], idempotent: true },
  { id: "integration.webhook.receive", method: "POST", path: "/integration/webhooks/inbound", versions: ["v1"], action: "Integration.Webhook", scopes: ["integration", "*"], graphql: "receiveWebhook", required: ["webhookId"], idempotent: true },
  { id: "integration.client.register", method: "POST", path: "/integration/clients", versions: ["v1"], action: "Integration.Client", scopes: ["integration", "*"], graphql: "registerIntegrationClient", required: ["name"], idempotent: true },
  { id: "integration.key.issue", method: "POST", path: "/integration/keys", versions: ["v1"], action: "Integration.Key", scopes: ["integration", "*"], graphql: "issueIntegrationKey", required: ["clientId"], idempotent: true },
  { id: "integration.transform.run", method: "POST", path: "/integration/transforms/run", versions: ["v1"], action: "Integration.Transform", scopes: ["integration", "*"], graphql: "runTransform", required: ["transformId"], idempotent: true },
  { id: "integration.queue.publish", method: "POST", path: "/integration/queues/publish", versions: ["v1"], action: "Integration.Admin", scopes: ["integration", "*"], graphql: "publishMessage", required: ["queue", "payload"], idempotent: true },
  { id: "integration.usage", method: "GET", path: "/integration/usage", versions: ["v1"], action: "Integration.View", scopes: ["integration", "*"], graphql: "integrationUsage", required: [], idempotent: false },
  { id: "integration.delivery.dashboard", method: "GET", path: "/integration/delivery", versions: ["v1"], action: "Integration.View", scopes: ["integration", "*"], graphql: "deliveryDashboard", required: [], idempotent: false }
];

export function canTransitionProvider(from, to) {
  return (PROVIDER_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionDeliveryStatus(from, to) {
  return (DELIVERY_STATUS_TRANSITIONS[from] || []).includes(to);
}

export function milestoneIndex(name) {
  return DELIVERY_MILESTONES.indexOf(name);
}

export function assertIntegrationLifecycleBoundary() {
  return {
    documentedOnly: true,
    postsCollections: false,
    restHttp: false,
    graphqlHttp: false,
    inProcess: true,
    extendsModule20: true,
    replacesHandleCollection: false
  };
}
