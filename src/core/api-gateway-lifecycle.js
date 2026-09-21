/**
 * Module 20 — API Gateway lifecycle, versions, and pipeline.
 * In-process contract only. No HTTP listener, REST server, or GraphQL server.
 */

export const GATEWAY_CLIENT_TYPES = [
  "android",
  "web",
  "customer_app",
  "ussd",
  "payment_provider",
  "banking",
  "government",
  "accounting",
  "sms",
  "email",
  "bi",
  "third_party",
  "service"
];

export const AUTH_METHODS = ["session", "api_key", "device_token", "jwt", "service_account", "oauth2"];

export const PIPELINE_STAGES = [
  "receive",
  "tls",
  "authentication",
  "authorization",
  "rate_limit",
  "request_validation",
  "idempotency",
  "routing",
  "business",
  "response_validation",
  "audit",
  "return"
];

export const API_VERSIONS = [
  { id: "v1", status: "active", uri: "/v1", header: "X-API-Version" },
  { id: "v2", status: "preview", uri: "/v2", header: "X-API-Version" }
];

export const WEBHOOK_STATES = ["registered", "active", "paused", "failed", "retired"];
export const WEBHOOK_DELIVERY_STATES = ["queued", "delivering", "delivered", "retrying", "dead_letter", "replayed"];

export const DEFAULT_RATE_LIMITS = {
  android: { perMinute: 120, perHour: 4000, burst: 30, concurrent: 4 },
  web: { perMinute: 120, perHour: 4000, burst: 20, concurrent: 6 },
  payment_provider: { perMinute: 60, perHour: 2000, burst: 20, concurrent: 4 },
  ussd: { perMinute: 30, perHour: 600, burst: 8, concurrent: 2 },
  third_party: { perMinute: 30, perHour: 800, burst: 8, concurrent: 2 },
  service: { perMinute: 180, perHour: 8000, burst: 40, concurrent: 8 }
};

export const SENSITIVE_RESPONSE_KEYS = [
  "pin",
  "password",
  "passwordHash",
  "secret",
  "token",
  "refreshToken",
  "webhookSecret",
  "momoWebhookSecret",
  "apiKey",
  "plaintextKey",
  "privateKey"
];

export const ROUTE_CATALOG = [
  {
    id: "health.snapshot",
    method: "POST",
    path: "/health/snapshot",
    versions: ["v1", "v2"],
    action: "Monitor.View",
    scopes: ["monitor", "*"],
    graphql: "healthSnapshot",
    required: [],
    idempotent: false
  },
  {
    id: "gateway.whoami",
    method: "GET",
    path: "/gateway/whoami",
    versions: ["v1", "v2"],
    action: "Gateway.View",
    scopes: ["gateway", "*"],
    graphql: "whoami",
    required: [],
    idempotent: false
  },
  {
    id: "gateway.docs",
    method: "GET",
    path: "/gateway/docs",
    versions: ["v1", "v2"],
    action: "Gateway.Docs",
    scopes: ["gateway", "docs", "*"],
    graphql: "openApi",
    required: [],
    idempotent: false
  },
  {
    id: "payment.initiate",
    method: "POST",
    path: "/payments",
    versions: ["v1"],
    action: "Payment.View",
    scopes: ["payment", "*"],
    graphql: "initiatePayment",
    required: ["paymentType", "paymentMethod", "amount"],
    idempotent: true
  },
  {
    id: "payment.callback",
    method: "POST",
    path: "/webhooks/payments",
    versions: ["v1"],
    action: "Payment.View",
    scopes: ["payment.callback", "payment", "*"],
    graphql: "paymentCallback",
    required: ["reference"],
    idempotent: true
  },
  {
    id: "backup.create",
    method: "POST",
    path: "/backups",
    versions: ["v1"],
    action: "Backup.Create",
    scopes: ["backup", "*"],
    graphql: "createBackup",
    required: [],
    idempotent: true
  },
  {
    id: "backup.verify",
    method: "POST",
    path: "/backups/verify",
    versions: ["v1"],
    action: "Backup.Verify",
    scopes: ["backup", "*"],
    graphql: "verifyBackup",
    required: ["backupSetId"],
    idempotent: false
  },
  {
    id: "monitor.diagnostics",
    method: "GET",
    path: "/monitor/diagnostics",
    versions: ["v1"],
    action: "Monitor.Diagnose",
    scopes: ["monitor", "*"],
    graphql: "remoteDiagnostics",
    required: ["deviceId"],
    idempotent: false
  },
  {
    id: "webhook.deliver",
    method: "POST",
    path: "/webhooks/deliver",
    versions: ["v1"],
    action: "Gateway.Webhook",
    scopes: ["webhook", "*"],
    graphql: "deliverWebhook",
    required: ["subscriptionId"],
    idempotent: true
  },
  {
    id: "risk.evaluate",
    method: "POST",
    path: "/security/risk",
    versions: ["v1"],
    action: "Security.Evaluate",
    scopes: ["security", "*"],
    graphql: "evaluateRisk",
    required: [],
    idempotent: true
  },
  {
    id: "security.incident.open",
    method: "POST",
    path: "/security/incidents",
    versions: ["v1"],
    action: "Security.Incident",
    scopes: ["security", "*"],
    graphql: "openSecurityIncident",
    required: ["title"],
    idempotent: false
  },
  {
    id: "workflow.start",
    method: "POST",
    path: "/workflows/start",
    versions: ["v1"],
    action: "Workflow.Start",
    scopes: ["workflow", "*"],
    graphql: "startWorkflow",
    required: ["code"],
    idempotent: true
  },
  {
    id: "workflow.status",
    method: "POST",
    path: "/workflows/status",
    versions: ["v1"],
    action: "Workflow.View",
    scopes: ["workflow", "*"],
    graphql: "workflowStatus",
    required: ["instanceId"],
    idempotent: false
  },
  {
    id: "task.inbox",
    method: "POST",
    path: "/workflows/inbox",
    versions: ["v1"],
    action: "Workflow.View",
    scopes: ["workflow", "*"],
    graphql: "taskInbox",
    required: [],
    idempotent: false
  },
  { id: "workflow.create", method: "POST", path: "/workflows", versions: ["v1"], action: "Workflow.Start", scopes: ["workflow", "*"], graphql: "createWorkflow", required: [], idempotent: true },
  { id: "workflow.get", method: "GET", path: "/workflows/{workflowInstanceId}", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "getWorkflow", required: [], idempotent: false },
  { id: "workflow.list", method: "GET", path: "/workflows", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "listWorkflows", required: [], idempotent: false },
  { id: "workflow.suspend", method: "POST", path: "/workflows/{workflowInstanceId}/suspend", versions: ["v1"], action: "Workflow.Admin", scopes: ["workflow", "*"], graphql: "suspendWorkflow", required: [], idempotent: true },
  { id: "workflow.resume", method: "POST", path: "/workflows/{workflowInstanceId}/resume", versions: ["v1"], action: "Workflow.Admin", scopes: ["workflow", "*"], graphql: "resumeWorkflow", required: [], idempotent: true },
  { id: "workflow.cancel", method: "POST", path: "/workflows/{workflowInstanceId}/cancel", versions: ["v1"], action: "Workflow.Start", scopes: ["workflow", "*"], graphql: "cancelWorkflow", required: [], idempotent: true },
  { id: "workflow.retry", method: "POST", path: "/workflows/{workflowInstanceId}/retry", versions: ["v1"], action: "Workflow.Admin", scopes: ["workflow", "*"], graphql: "retryWorkflow", required: [], idempotent: true },
  { id: "workflow.tasks", method: "GET", path: "/workflows/{workflowInstanceId}/tasks", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "workflowTasks", required: [], idempotent: false },
  { id: "workflow.history", method: "GET", path: "/workflows/{workflowInstanceId}/history", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "workflowHistory", required: [], idempotent: false },
  { id: "workflow.statistics", method: "GET", path: "/workflows/statistics", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "workflowStatistics", required: [], idempotent: false },
  { id: "workflow.replay", method: "POST", path: "/workflows/{workflowInstanceId}/replay", versions: ["v1"], action: "Workflow.Admin", scopes: ["workflow", "*"], graphql: "replayWorkflow", required: [], idempotent: true },
  { id: "task.complete", method: "POST", path: "/tasks/{taskId}/complete", versions: ["v1"], action: "Workflow.Task", scopes: ["workflow", "*"], graphql: "completeTask", required: [], idempotent: true },
  { id: "task.assign", method: "POST", path: "/tasks/{taskId}/assign", versions: ["v1"], action: "Workflow.Task", scopes: ["workflow", "*"], graphql: "assignTask", required: [], idempotent: true },
  { id: "task.delegate", method: "POST", path: "/tasks/{taskId}/delegate", versions: ["v1"], action: "Workflow.Task", scopes: ["workflow", "*"], graphql: "delegateTask", required: [], idempotent: true },
  { id: "task.approve", method: "POST", path: "/tasks/{taskId}/approve", versions: ["v1"], action: "Workflow.Approve", scopes: ["workflow", "*"], graphql: "approveTask", required: [], idempotent: true },
  { id: "task.reject", method: "POST", path: "/tasks/{taskId}/reject", versions: ["v1"], action: "Workflow.Approve", scopes: ["workflow", "*"], graphql: "rejectTask", required: [], idempotent: true },
  { id: "case.create", method: "POST", path: "/cases", versions: ["v1"], action: "Workflow.Case", scopes: ["workflow", "*"], graphql: "createCase", required: [], idempotent: true },
  { id: "case.get", method: "GET", path: "/cases/{caseId}", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "getCase", required: [], idempotent: false },
  { id: "case.list", method: "GET", path: "/cases", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "listCases", required: [], idempotent: false },
  { id: "case.close", method: "POST", path: "/cases/{caseId}/close", versions: ["v1"], action: "Workflow.Case", scopes: ["workflow", "*"], graphql: "closeCase", required: [], idempotent: true },
  { id: "workflow.definitions", method: "GET", path: "/workflow-definitions", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "listWorkflowDefinitions", required: [], idempotent: false },
  { id: "workflow.definition.get", method: "GET", path: "/workflow-definitions/{definitionId}", versions: ["v1"], action: "Workflow.View", scopes: ["workflow", "*"], graphql: "getWorkflowDefinition", required: [], idempotent: false },
  { id: "workflow.definition.publish", method: "POST", path: "/workflow-definitions/{definitionId}/publish", versions: ["v1"], action: "Workflow.Design", scopes: ["workflow", "*"], graphql: "publishWorkflowDefinition", required: [], idempotent: true },
  { id: "workflow.definition.retire", method: "POST", path: "/workflow-definitions/{definitionId}/retire", versions: ["v1"], action: "Workflow.Design", scopes: ["workflow", "*"], graphql: "retireWorkflowDefinition", required: [], idempotent: true },
  { id: "rule.evaluate", method: "POST", path: "/rules/evaluate", versions: ["v1"], action: "Rule.View", scopes: ["rules", "*"], graphql: "evaluateRule", required: ["code"], idempotent: true },
  { id: "rule.simulate", method: "POST", path: "/rules/simulate", versions: ["v1"], action: "Rule.Simulate", scopes: ["rules", "*"], graphql: "simulateRule", required: [], idempotent: true },
  { id: "rule.test", method: "POST", path: "/rules/{definitionId}/test", versions: ["v1"], action: "Rule.Test", scopes: ["rules", "*"], graphql: "testRule", required: [], idempotent: true },
  { id: "rule.publish", method: "POST", path: "/rules/{definitionId}/publish", versions: ["v1"], action: "Rule.Publish", scopes: ["rules", "*"], graphql: "publishRule", required: [], idempotent: true },
  { id: "rule.get", method: "GET", path: "/rules/{definitionId}", versions: ["v1"], action: "Rule.View", scopes: ["rules", "*"], graphql: "getRule", required: [], idempotent: false },
  { id: "rule.list", method: "GET", path: "/rules", versions: ["v1"], action: "Rule.View", scopes: ["rules", "*"], graphql: "listRules", required: [], idempotent: false },
  { id: "rule.history", method: "GET", path: "/rules/{definitionId}/history", versions: ["v1"], action: "Rule.View", scopes: ["rules", "*"], graphql: "ruleHistory", required: [], idempotent: false },
  { id: "rule.statistics", method: "GET", path: "/rules/statistics", versions: ["v1"], action: "Rule.View", scopes: ["rules", "*"], graphql: "ruleStatistics", required: [], idempotent: false },
  { id: "exchange.import", method: "POST", path: "/exchange/import", versions: ["v1"], action: "Exchange.Import", scopes: ["exchange", "*"], graphql: "importExchange", required: ["type"], idempotent: true },
  { id: "exchange.export", method: "POST", path: "/exchange/export", versions: ["v1"], action: "Exchange.Export", scopes: ["exchange", "*"], graphql: "exportExchange", required: ["type"], idempotent: true },
  { id: "exchange.validate", method: "POST", path: "/exchange/validate", versions: ["v1"], action: "Exchange.Import", scopes: ["exchange", "*"], graphql: "validateExchange", required: ["type"], idempotent: true },
  { id: "exchange.migrate", method: "POST", path: "/exchange/migrate", versions: ["v1"], action: "Exchange.Migrate", scopes: ["exchange", "*"], graphql: "migrateExchange", required: [], idempotent: true },
  { id: "exchange.bulk", method: "POST", path: "/exchange/bulk", versions: ["v1"], action: "Exchange.Bulk", scopes: ["exchange", "*"], graphql: "bulkExchange", required: [], idempotent: true },
  { id: "exchange.approve", method: "POST", path: "/exchange/exports/{jobId}/approve", versions: ["v1"], action: "Exchange.Approve", scopes: ["exchange", "*"], graphql: "approveExport", required: [], idempotent: true },
  { id: "exchange.jobs", method: "GET", path: "/exchange/jobs", versions: ["v1"], action: "Exchange.View", scopes: ["exchange", "*"], graphql: "exchangeJobs", required: [], idempotent: false },
  { id: "exchange.history", method: "GET", path: "/exchange/history", versions: ["v1"], action: "Exchange.View", scopes: ["exchange", "*"], graphql: "exchangeHistory", required: [], idempotent: false },
  { id: "exchange.statistics", method: "GET", path: "/exchange/statistics", versions: ["v1"], action: "Exchange.View", scopes: ["exchange", "*"], graphql: "exchangeStatistics", required: [], idempotent: false },
  { id: "records.upload", method: "POST", path: "/records", versions: ["v1"], action: "Records.Upload", scopes: ["records", "*"], graphql: "uploadRecord", required: ["type"], idempotent: true },
  { id: "records.search", method: "GET", path: "/records/search", versions: ["v1"], action: "Records.View", scopes: ["records", "*"], graphql: "searchRecords", required: [], idempotent: false },
  { id: "records.get", method: "GET", path: "/records/{recordId}", versions: ["v1"], action: "Records.View", scopes: ["records", "*"], graphql: "getRecord", required: [], idempotent: false },
  { id: "records.list", method: "GET", path: "/records", versions: ["v1"], action: "Records.View", scopes: ["records", "*"], graphql: "listRecords", required: [], idempotent: false },
  { id: "records.archive", method: "POST", path: "/records/{recordId}/archive", versions: ["v1"], action: "Records.Archive", scopes: ["records", "*"], graphql: "archiveRecord", required: [], idempotent: true },
  { id: "records.download", method: "POST", path: "/records/{recordId}/download", versions: ["v1"], action: "Records.Download", scopes: ["records", "*"], graphql: "downloadRecord", required: [], idempotent: true },
  { id: "records.statistics", method: "GET", path: "/records/statistics", versions: ["v1"], action: "Records.View", scopes: ["records", "*"], graphql: "recordsStatistics", required: [], idempotent: false },
  { id: "bi.metric.list", method: "GET", path: "/bi/metrics", versions: ["v1"], action: "Bi.View", scopes: ["bi", "*"], graphql: "listMetrics", required: [], idempotent: false },
  { id: "bi.metric.validate", method: "POST", path: "/bi/metrics/validate", versions: ["v1"], action: "Bi.Metric", scopes: ["bi", "*"], graphql: "validateMetric", required: [], idempotent: true },
  { id: "bi.kpi.calculate", method: "POST", path: "/bi/kpis/calculate", versions: ["v1"], action: "Bi.View", scopes: ["bi", "*"], graphql: "calculateKpi", required: ["kpiCode"], idempotent: true },
  { id: "bi.kpi.list", method: "GET", path: "/bi/kpis", versions: ["v1"], action: "Bi.View", scopes: ["bi", "*"], graphql: "listKpis", required: [], idempotent: false },
  { id: "bi.schema.list", method: "GET", path: "/bi/schemas", versions: ["v1"], action: "Bi.View", scopes: ["bi", "*"], graphql: "listSchemas", required: [], idempotent: false },
  { id: "bi.schema.validate", method: "POST", path: "/bi/schemas/validate", versions: ["v1"], action: "Bi.Schema", scopes: ["bi", "*"], graphql: "validateSchemaMetadata", required: [], idempotent: true },
  { id: "bi.statistics", method: "GET", path: "/bi/statistics", versions: ["v1"], action: "Bi.View", scopes: ["bi", "*"], graphql: "biStatistics", required: [], idempotent: false },
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
  { id: "integration.delivery.dashboard", method: "GET", path: "/integration/delivery", versions: ["v1"], action: "Integration.View", scopes: ["integration", "*"], graphql: "deliveryDashboard", required: [], idempotent: false },
  { id: "ai.health", method: "GET", path: "/ai/health", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiHealth", required: [], idempotent: false },
  { id: "ai.dashboard", method: "GET", path: "/ai/dashboard", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiDashboard", required: [], idempotent: false },
  { id: "ai.predict", method: "POST", path: "/ai/predict", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiPredict", required: ["target"], idempotent: true },
  { id: "ai.fraud.detect", method: "POST", path: "/ai/fraud/detect", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiFraudDetect", required: [], idempotent: true },
  { id: "ai.risk.score", method: "POST", path: "/ai/risk/score", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiRiskScore", required: ["entityType"], idempotent: true },
  { id: "ai.recommend", method: "POST", path: "/ai/recommend", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiRecommend", required: ["kind"], idempotent: true },
  { id: "ai.forecast", method: "POST", path: "/ai/forecast", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiForecast", required: ["horizon"], idempotent: true },
  { id: "ai.anomaly.detect", method: "POST", path: "/ai/anomaly/detect", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiAnomalyDetect", required: [], idempotent: true },
  { id: "ai.model.list", method: "GET", path: "/ai/models", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiModels", required: [], idempotent: false },
  { id: "ai.model.deploy", method: "POST", path: "/ai/models/deploy", versions: ["v1"], action: "Ai.Admin", scopes: ["ai", "*"], graphql: "deployAiModel", required: ["modelVersionId"], idempotent: true },
  { id: "ai.feature.list", method: "GET", path: "/ai/features", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiFeatures", required: [], idempotent: false },
  { id: "ai.dataset.list", method: "GET", path: "/ai/datasets", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiDatasets", required: [], idempotent: false },
  { id: "ai.governance.dashboard", method: "GET", path: "/ai/governance", versions: ["v1"], action: "Ai.Govern", scopes: ["ai", "*"], graphql: "aiGovernanceDashboard", required: [], idempotent: false },
  { id: "ai.statistics", method: "GET", path: "/ai/statistics", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiStatistics", required: [], idempotent: false },
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

export function routeById(id) {
  return ROUTE_CATALOG.find((item) => item.id === id) || null;
}

export function versionSupported(version) {
  return API_VERSIONS.some((item) => item.id === version && item.status !== "retired");
}

export function clientRateLimit(type) {
  return DEFAULT_RATE_LIMITS[type] || DEFAULT_RATE_LIMITS.third_party;
}

export function sanitizeGatewayPayload(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeGatewayPayload(item, seen));
  const next = {};
  Object.entries(value).forEach(([key, item]) => {
    if (SENSITIVE_RESPONSE_KEYS.includes(key)) next[key] = "[redacted]";
    else next[key] = typeof item === "object" ? sanitizeGatewayPayload(item, seen) : item;
  });
  return next;
}

export function parseSimpleGraphql(query = "") {
  const text = String(query || "").trim();
  const named = text.match(/(?:query|mutation)\s+\w+\s*\{\s*([A-Za-z0-9_]+)/);
  if (named) return named[1];
  const anon = text.match(/\{\s*([A-Za-z0-9_]+)/);
  return anon ? anon[1] : "";
}

export function envelope({ requestId, correlationId, status, message, data, error, now }) {
  return {
    correlationId: correlationId || requestId || "",
    requestId: requestId || "",
    timestamp: typeof now === "number" ? new Date(now).toISOString() : (now || new Date().toISOString()),
    status,
    message,
    data: data ?? null,
    error: error || null
  };
}
