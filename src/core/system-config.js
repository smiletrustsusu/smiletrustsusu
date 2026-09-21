/**
 * Central system administration & configuration engine.
 * Live Settings form fields stay on state.settings. This module versions,
 * validates, and overlays extra parameters, flags, calendars, and policies.
 */

import { recordAuditEvent } from "./audit-ops.js";
import { ROLE, isSystemOwner } from "./roles.js";

export const CONFIG_SCHEMA_VERSION = "1.0.0";

export const PARAMETER_CATALOG = [
  { key: "org.language", category: "organization", label: "Default language", type: "string", defaultValue: "en-GH" },
  { key: "org.currency", category: "organization", label: "Default currency", type: "string", defaultValue: "GHS", liveSetting: "currency" },
  { key: "org.dateFormat", category: "organization", label: "Date format", type: "string", defaultValue: "YYYY-MM-DD" },
  { key: "org.numberFormat", category: "organization", label: "Number format", type: "string", defaultValue: "en-GH" },
  { key: "org.timeFormat", category: "organization", label: "Time format", type: "string", defaultValue: "HH:mm" },
  { key: "org.timezone", category: "organization", label: "Time zone", type: "string", defaultValue: "Africa/Accra", liveSetting: "timezone" },
  { key: "org.decimalPrecision", category: "organization", label: "Decimal precision", type: "number", defaultValue: 2 },
  { key: "org.financialPrecision", category: "organization", label: "Financial precision", type: "number", defaultValue: 2 },
  { key: "org.exchangeRatePolicy", category: "organization", label: "Exchange rate policy", type: "string", defaultValue: "manual" },
  { key: "finance.loanInterest", category: "financial", label: "Default loan interest %", type: "number", defaultValue: 15, liveSetting: "loanInterest", highRisk: true },
  { key: "finance.collectionDays", category: "financial", label: "Collection days / cycle", type: "number", defaultValue: 31, liveSetting: "collectionDays" },
  { key: "finance.maxDailyCollectionGhs", category: "parameters", label: "Maximum daily collection (GHS)", type: "number", defaultValue: 50000 },
  { key: "finance.maxWithdrawalGhs", category: "parameters", label: "Maximum withdrawal (GHS)", type: "number", defaultValue: 20000 },
  { key: "finance.minSavingsBalanceGhs", category: "parameters", label: "Minimum savings balance (GHS)", type: "number", defaultValue: 0 },
  { key: "finance.minLoanAmountGhs", category: "parameters", label: "Minimum loan amount (GHS)", type: "number", defaultValue: 100 },
  { key: "finance.maxLoanAmountGhs", category: "parameters", label: "Maximum loan amount (GHS)", type: "number", defaultValue: 50000 },
  { key: "finance.maxLoanInterestPct", category: "parameters", label: "Loan interest ceiling %", type: "number", defaultValue: 30, highRisk: true },
  { key: "finance.penaltyPct", category: "parameters", label: "Penalty %", type: "number", defaultValue: 0 },
  { key: "finance.receiptPrefix", category: "parameters", label: "Receipt number prefix", type: "string", defaultValue: "RCP" },
  { key: "finance.transactionPrefix", category: "parameters", label: "Transaction number prefix", type: "string", defaultValue: "TXN" },
  { key: "finance.branchCodeFormat", category: "parameters", label: "Branch code format", type: "string", defaultValue: "BR-####" },
  { key: "approval.cashierLimitGhs", category: "approval", label: "Cashier approval limit (GHS)", type: "number", defaultValue: 1000, highRisk: true },
  { key: "approval.branchManagerLimitGhs", category: "approval", label: "Branch manager approval limit (GHS)", type: "number", defaultValue: 20000 },
  { key: "approval.operationsLimitGhs", category: "approval", label: "Operations manager approval limit (GHS)", type: "number", defaultValue: 100000 },
  { key: "approval.accountantLimitGhs", category: "approval", label: "Accountant approval limit (GHS)", type: "number", defaultValue: 20000 },
  { key: "approval.makerChecker", category: "approval", label: "Maker-checker for high-risk config", type: "boolean", defaultValue: true },
  { key: "approval.escalationHours", category: "approval", label: "Approval timeout (hours)", type: "number", defaultValue: 24 },
  { key: "security.passwordMinLength", category: "security", label: "Password minimum length", type: "number", defaultValue: 8, highRisk: true },
  { key: "security.passwordExpiryDays", category: "security", label: "Password expiry (days)", type: "number", defaultValue: 90 },
  { key: "security.maxLoginAttempts", category: "security", label: "Max login attempts", type: "number", defaultValue: 5 },
  { key: "security.lockMinutes", category: "security", label: "Account lock duration (minutes)", type: "number", defaultValue: 15 },
  { key: "security.sessionTimeoutMinutes", category: "security", label: "Session timeout (minutes)", type: "number", defaultValue: 480, liveSetting: "sessionTimeoutMinutes" },
  { key: "security.mfaRequired", category: "security", label: "Require MFA for privileged roles", type: "boolean", defaultValue: false, highRisk: true },
  { key: "offline.maxQueueItems", category: "offline", label: "Offline queue size", type: "number", defaultValue: 500 },
  { key: "offline.syncMinutes", category: "offline", label: "Sync frequency (minutes)", type: "number", defaultValue: 5 },
  { key: "offline.conflictStrategy", category: "offline", label: "Conflict resolution", type: "string", defaultValue: "local-first" },
  { key: "offline.cacheLimitMb", category: "offline", label: "Device cache limit (MB)", type: "number", defaultValue: 64 },
  { key: "offline.allowHighRisk", category: "offline", label: "Allow high-risk actions offline", type: "boolean", defaultValue: false },
  { key: "offline.allowCustomerRegistration", category: "offline", label: "Allow customer registration offline", type: "boolean", defaultValue: true },
  { key: "backup.schedule", category: "backup", label: "Automatic backup schedule", type: "string", defaultValue: "daily" },
  { key: "backup.retentionDays", category: "backup", label: "Backup retention (days)", type: "number", defaultValue: 30 },
  { key: "backup.encrypt", category: "backup", label: "Encrypt backups", type: "boolean", defaultValue: true },
  { key: "backup.rtoMinutes", category: "backup", label: "Recovery time objective (minutes)", type: "number", defaultValue: 240 },
  { key: "backup.rpoMinutes", category: "backup", label: "Recovery point objective (minutes)", type: "number", defaultValue: 60 },
  { key: "gateway.perMinute", category: "parameters", label: "API gateway requests per minute", type: "number", defaultValue: 120 },
  { key: "retention.auditDays", category: "retention", label: "Audit retention (days)", type: "number", defaultValue: 2555 },
  { key: "retention.notificationDays", category: "retention", label: "Notification retention (days)", type: "number", defaultValue: 365 },
  { key: "retention.loginHistoryDays", category: "retention", label: "Login history retention (days)", type: "number", defaultValue: 730 },
  { key: "retention.idempotencyDays", category: "retention", label: "Idempotency key retention (days)", type: "number", defaultValue: 365 },
  { key: "payment.dailyLimitGhs", category: "financial", label: "Payment daily customer limit (GHS)", type: "number", defaultValue: 50000 },
  { key: "payment.velocityPerHour", category: "financial", label: "Payment velocity per customer / hour", type: "number", defaultValue: 20 },
  { key: "payment.highRiskGhs", category: "financial", label: "Payment high-risk amount (GHS)", type: "number", defaultValue: 5000 },
  { key: "payment.callbackWindowSeconds", category: "security", label: "Payment callback replay window (seconds)", type: "number", defaultValue: 300 },
  { key: "document.tempPrefix", category: "parameters", label: "Temporary offline receipt prefix", type: "string", defaultValue: "TMP-" },
  { key: "document.approvalTokenMinutes", category: "approval", label: "Receipt approval token validity (minutes)", type: "number", defaultValue: 15 },
  { key: "job.staleLockMs", category: "parameters", label: "Job reservation lock TTL (ms)", type: "number", defaultValue: 30000 },
  { key: "job.heartbeatMs", category: "parameters", label: "Worker heartbeat interval (ms)", type: "number", defaultValue: 15000 },
  { key: "job.maxJobsPerTick", category: "parameters", label: "Scheduler jobs per tick", type: "number", defaultValue: 10 },
  { key: "monitor.collectionIntervalMs", category: "parameters", label: "Health snapshot interval (ms)", type: "number", defaultValue: 60000 },
  { key: "monitor.criticalIntervalMs", category: "parameters", label: "Critical metric interval (ms)", type: "number", defaultValue: 30000 },
  { key: "monitor.highIntervalMs", category: "parameters", label: "High-priority metric interval (ms)", type: "number", defaultValue: 60000 },
  { key: "monitor.standardIntervalMs", category: "parameters", label: "Standard metric interval (ms)", type: "number", defaultValue: 300000 },
  { key: "monitor.businessIntervalMs", category: "parameters", label: "Business metric interval (ms)", type: "number", defaultValue: 900000 },
  { key: "monitor.batchTransmitMs", category: "parameters", label: "Telemetry batch transmit interval (ms)", type: "number", defaultValue: 300000 },
  { key: "monitor.requireAckComment", category: "approval", label: "Require comment on major/critical alert ack", type: "boolean", defaultValue: false },
  { key: "monitor.storageWarnPct", category: "parameters", label: "Storage warning percent", type: "number", defaultValue: 90 },
  { key: "android.storageWarnPct", category: "offline", label: "Android free storage warning %", type: "number", defaultValue: 15 },
  { key: "android.syncBacklogAlert", category: "offline", label: "Android sync backlog alert", type: "number", defaultValue: 50 },
  { key: "android.longOfflineHours", category: "offline", label: "Android long-offline hours", type: "number", defaultValue: 48 },
  { key: "security.largeAmountGhs", category: "security", label: "Fraud large-amount threshold (GHS)", type: "number", defaultValue: 5000 },
  { key: "rule.executionTimeoutMs", category: "parameters", label: "Rule evaluation timeout (ms)", type: "number", defaultValue: 50 },
  { key: "rule.maxEvaluationsPerRequest", category: "parameters", label: "Maximum rules per evaluation request", type: "number", defaultValue: 50 },
  { key: "rule.cacheTtlMs", category: "parameters", label: "Published rule cache TTL (ms)", type: "number", defaultValue: 30000 },
  { key: "rule.simulationLimit", category: "parameters", label: "Maximum simulation cases", type: "number", defaultValue: 1000 },
  { key: "rule.versionRetention", category: "retention", label: "Rule version retention count", type: "number", defaultValue: 25 },
  { key: "rule.makerChecker", category: "approval", label: "Maker-checker for rule publication", type: "boolean", defaultValue: true },
  { key: "exchange.maxSyncRecords", category: "parameters", label: "Maximum records per synchronous export", type: "number", defaultValue: 500 },
  { key: "exchange.maxFileBytes", category: "parameters", label: "Maximum export file size (bytes)", type: "number", defaultValue: 2000000 },
  { key: "exchange.maxConcurrentJobs", category: "parameters", label: "Maximum concurrent export jobs", type: "number", defaultValue: 3 },
  { key: "exchange.maxScheduledPerUser", category: "parameters", label: "Maximum scheduled exports per user", type: "number", defaultValue: 5 },
  { key: "records.storageProvider", category: "parameters", label: "Digital records storage provider", type: "string", defaultValue: "local" },
  { key: "records.maxFileBytes", category: "parameters", label: "Maximum digital record file size (bytes)", type: "number", defaultValue: 5000000 },
  { key: "records.downloadTtlMs", category: "parameters", label: "Secure download link TTL (ms)", type: "number", defaultValue: 300000 },
  { key: "records.watermarkSensitive", category: "security", label: "Watermark Financial/Restricted previews", type: "boolean", defaultValue: true },
  { key: "integration.perMinute", category: "parameters", label: "Integration hub per-minute rate limit", type: "number", defaultValue: 60 },
  { key: "integration.perHour", category: "parameters", label: "Integration hub per-hour rate limit", type: "number", defaultValue: 1000 },
  { key: "integration.defaultTimeoutMs", category: "parameters", label: "Integration provider timeout (ms)", type: "number", defaultValue: 5000 },
  { key: "integration.retryMax", category: "parameters", label: "Integration default retry max", type: "number", defaultValue: 3 },
  { key: "integration.circuitFailureThreshold", category: "parameters", label: "Integration circuit breaker failure threshold", type: "number", defaultValue: 5 },
  { key: "integration.circuitCoolDownMs", category: "parameters", label: "Integration circuit breaker cool-down (ms)", type: "number", defaultValue: 30000 }
];

export const FEATURE_FLAG_CATALOG = [
  { id: "enableFixedSavings", label: "Enable Fixed Savings", defaultEnabled: true },
  { id: "enableMobileMoney", label: "Enable Mobile Money", defaultEnabled: true },
  { id: "enableWhatsApp", label: "Enable WhatsApp", defaultEnabled: true },
  { id: "enablePushNotifications", label: "Enable Push Notifications", defaultEnabled: true },
  { id: "enableLoanModule", label: "Enable Loan Module", defaultEnabled: true, highRisk: true },
  { id: "enableOfflineMode", label: "Enable Offline Mode", defaultEnabled: true },
  { id: "enableGroupLoans", label: "Enable Group Loans", defaultEnabled: true },
  { id: "enableBranchAccounting", label: "Enable Branch Accounting", defaultEnabled: true },
  { id: "enableDocumentEngine", label: "Enable Document Engine", defaultEnabled: true },
  { id: "enableJobEngine", label: "Enable Job Scheduler Engine", defaultEnabled: true },
  { id: "enableMonitoringEngine", label: "Enable Monitoring Engine", defaultEnabled: true },
  { id: "enableApiGateway", label: "Enable API Gateway", defaultEnabled: true },
  { id: "enableBackupRecoveryEngine", label: "Enable Backup Recovery Engine", defaultEnabled: true },
  { id: "enableSecurityEngine", label: "Enable Security Operations Engine", defaultEnabled: true, highRisk: true },
  { id: "enableWorkflowEngine", label: "Enable Workflow Engine", defaultEnabled: true },
  { id: "enableRuleEngine", label: "Enable Enterprise Rule Engine", defaultEnabled: true },
  { id: "enableDataExchange", label: "Enable Data Exchange Framework", defaultEnabled: true },
  { id: "enableDigitalRecords", label: "Enable Digital Records Management", defaultEnabled: true },
  { id: "enableEnterpriseBi", label: "Enable Enterprise BI & Metric Registry", defaultEnabled: true },
  { id: "enableEnterpriseIntegration", label: "Enable Enterprise Integration Hub", defaultEnabled: true },
  { id: "enableEnterpriseAi", label: "Enable Enterprise AI & Predictive Intelligence", defaultEnabled: true },
  { id: "enablePlatformAdmin", label: "Enable Platform Administration & Global Operations", defaultEnabled: true }
];

export const PRODUCT_CATALOG = [
  { id: "prod-daily-susu", kind: "savings", name: "Daily Susu", minAmount: 1, maxAmount: 50000, interestMethod: "none", frequency: "Daily", status: "active" },
  { id: "prod-weekly-susu", kind: "savings", name: "Weekly Susu", minAmount: 5, maxAmount: 50000, interestMethod: "none", frequency: "Weekly", status: "active" },
  { id: "prod-monthly-savings", kind: "savings", name: "Monthly Savings", minAmount: 20, maxAmount: 100000, interestMethod: "none", frequency: "Monthly", status: "active" },
  { id: "prod-fixed-deposit", kind: "savings", name: "Fixed Deposit", minAmount: 100, maxAmount: 200000, interestMethod: "flat", frequency: "Term", status: "active" },
  { id: "prod-target-savings", kind: "savings", name: "Target Savings", minAmount: 5, maxAmount: 100000, interestMethod: "none", frequency: "Flexible", status: "active" },
  { id: "prod-child-education", kind: "savings", name: "Child Education Savings", minAmount: 5, maxAmount: 100000, interestMethod: "none", frequency: "Flexible", status: "active" },
  { id: "prod-business-savings", kind: "savings", name: "Business Savings", minAmount: 20, maxAmount: 200000, interestMethod: "none", frequency: "Flexible", status: "active" },
  { id: "prod-loan-personal", kind: "loan", name: "Personal Loan", minAmount: 100, maxAmount: 50000, interestMethod: "flat", frequency: "Monthly", status: "active" },
  { id: "prod-loan-business", kind: "loan", name: "Business Loan", minAmount: 200, maxAmount: 100000, interestMethod: "flat", frequency: "Monthly", status: "active" },
  { id: "prod-loan-emergency", kind: "loan", name: "Emergency Loan", minAmount: 50, maxAmount: 10000, interestMethod: "flat", frequency: "Weekly", status: "active" },
  { id: "prod-loan-group", kind: "loan", name: "Group Loan", minAmount: 200, maxAmount: 80000, interestMethod: "flat", frequency: "Monthly", status: "active" }
];

export const GHANA_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-03-06", name: "Independence Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-01", name: "May Day" },
  { date: "2026-07-01", name: "Republic Day" },
  { date: "2026-08-04", name: "Founders' Day" },
  { date: "2026-09-21", name: "Kwame Nkrumah Memorial Day" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Boxing Day" }
];

export const DEFAULT_COMPANY_PROFILE = {
  companyName: "Smile Trust Business Control and Collection System",
  registrationNumber: "",
  taxId: "",
  licenseNumber: "",
  logo: "assets/smile-trust-logo.png",
  address: "",
  region: "",
  district: "",
  telephone: "",
  email: "",
  website: "",
  gps: "",
  currency: "GHS",
  timezone: "Africa/Accra",
  financialYearStart: "01-01",
  financialYearEnd: "12-31",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  businessHours: "08:00-17:00"
};

let configCache = { stamp: "", map: null };

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function catalogByKey(key) {
  return PARAMETER_CATALOG.find((item) => item.key === key);
}

export function invalidateConfigCache() {
  configCache = { stamp: "", map: null };
}

export function ensureSystemConfig(state = {}) {
  state.settings = state.settings || {};
  state.companyProfile = { ...DEFAULT_COMPANY_PROFILE, ...(state.companyProfile || {}) };
  if (!state.companyProfile.companyName && state.settings.businessName) {
    state.companyProfile.companyName = state.settings.businessName;
  }
  state.parameterValues = state.parameterValues || [];
  state.featureFlags = state.featureFlags || [];
  state.configurationVersions = state.configurationVersions || [];
  state.configurationChanges = state.configurationChanges || [];
  state.configurationDrafts = state.configurationDrafts || [];
  state.businessCalendars = state.businessCalendars || [];
  state.backupPolicies = state.backupPolicies || [];
  state.syncPolicies = state.syncPolicies || [];
  state.productDefinitions = state.productDefinitions || [];
  state.configActivityLogs = state.configActivityLogs || [];
  FEATURE_FLAG_CATALOG.forEach((flag) => {
    if (!state.featureFlags.some((item) => item.id === flag.id)) {
      state.featureFlags.push({ id: flag.id, enabled: flag.defaultEnabled, highRisk: Boolean(flag.highRisk) });
    }
  });
  if (!state.businessCalendars.length) {
    state.businessCalendars.push({
      id: "cal-gh-default",
      name: "Ghana working calendar",
      workingDays: DEFAULT_COMPANY_PROFILE.workingDays,
      holidays: GHANA_HOLIDAYS_2026.map((item) => ({ ...item, source: "ghana" })),
      monthEnd: true,
      yearEnd: true
    });
  }
  if (!state.backupPolicies.length) {
    state.backupPolicies.push({
      id: "bak-default",
      schedule: "daily",
      retentionDays: 30,
      encrypt: true,
      compress: true,
      verify: true
    });
  }
  if (!state.syncPolicies.length) {
    state.syncPolicies.push({
      id: "sync-default",
      maxQueueItems: 500,
      syncMinutes: 5,
      conflictStrategy: "local-first",
      cacheLimitMb: 64
    });
  }
  PRODUCT_CATALOG.forEach((product) => {
    if (!state.productDefinitions.some((item) => item.id === product.id)) {
      state.productDefinitions.push({ ...product });
    }
  });
  if (!state.configurationVersions.length) {
    state.configurationVersions.push({
      id: "cfg-v1",
      versionNumber: 1,
      status: "active",
      reason: "Initial configuration",
      createdAt: nowIso(),
      createdBy: "system",
      snapshot: snapshotConfig(state)
    });
    state.configVersionNumber = 1;
  }
  state.configVersionNumber = state.configVersionNumber || 1;
  return state;
}

function snapshotConfig(state) {
  return {
    parameters: Object.fromEntries((state.parameterValues || []).map((item) => [item.key, item.value])),
    flags: Object.fromEntries((state.featureFlags || []).map((item) => [item.id, item.enabled])),
    profile: { ...(state.companyProfile || {}) },
    products: (state.productDefinitions || []).map((item) => ({ ...item }))
  };
}

function applySnapshot(state, snap = {}) {
  state.parameterValues = Object.entries(snap.parameters || {}).map(([key, value]) => ({ id: key, key, value, status: "active" }));
  Object.entries(snap.flags || {}).forEach(([id, enabled]) => {
    const flag = (state.featureFlags || []).find((item) => item.id === id);
    if (flag) flag.enabled = enabled;
  });
  if (snap.profile) state.companyProfile = { ...DEFAULT_COMPANY_PROFILE, ...snap.profile };
  if (Array.isArray(snap.products)) {
    state.productDefinitions = snap.products.map((item) => ({ ...item }));
  }
  PARAMETER_CATALOG.filter((item) => item.liveSetting).forEach((item) => {
    if (snap.parameters && snap.parameters[item.key] != null) {
      state.settings[item.liveSetting] = snap.parameters[item.key];
    }
  });
  invalidateConfigCache();
}

function buildMap(state) {
  const map = {};
  PARAMETER_CATALOG.forEach((item) => {
    map[item.key] = item.defaultValue;
    if (item.liveSetting && state.settings && state.settings[item.liveSetting] != null && state.settings[item.liveSetting] !== "") {
      map[item.key] = state.settings[item.liveSetting];
    }
  });
  (state.parameterValues || []).forEach((row) => {
    if (row.status && row.status !== "active") return;
    map[row.key] = row.value;
  });
  return map;
}

export function getConfigValue(state, key) {
  ensureSystemConfig(state);
  const stamp = `${state.configVersionNumber || 0}:${(state.parameterValues || []).length}:${state.settings?.loanInterest}:${state.settings?.sessionTimeoutMinutes}`;
  if (!configCache.map || configCache.stamp !== stamp) {
    configCache = { stamp, map: buildMap(state) };
  }
  return configCache.map[key];
}

export function isFeatureEnabled(state, flagId) {
  ensureSystemConfig(state);
  const row = (state.featureFlags || []).find((item) => item.id === flagId);
  if (row?.killSwitch === true) return false;
  const now = Date.now();
  if (row?.scheduledActivateAt && now < Date.parse(row.scheduledActivateAt)) return false;
  if (row?.scheduledRetireAt && now >= Date.parse(row.scheduledRetireAt)) return false;
  if (row) return row.enabled !== false;
  return FEATURE_FLAG_CATALOG.find((item) => item.id === flagId)?.defaultEnabled !== false;
}

export function configuredApprovalLimits(state) {
  return {
    [ROLE.CASHIER]: Number(getConfigValue(state, "approval.cashierLimitGhs") ?? 1000),
    [ROLE.BRANCH_MANAGER]: Number(getConfigValue(state, "approval.branchManagerLimitGhs") ?? 20000),
    [ROLE.OPERATIONS_MANAGER]: Number(getConfigValue(state, "approval.operationsLimitGhs") ?? 100000),
    [ROLE.ACCOUNTANT]: Number(getConfigValue(state, "approval.accountantLimitGhs") ?? 20000)
  };
}

function logConfig(state, action, details, user, uid, extras = {}) {
  state.configActivityLogs.push({
    id: newId("clog", uid),
    action,
    details,
    userId: user?.id || "",
    createdAt: nowIso(extras.now)
  });
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: "configuration",
    guarantee: "G1",
    module: "14",
    ...extras
  }, uid);
}

function nextVersion(state) {
  const last = (state.configurationVersions || []).reduce((max, item) => Math.max(max, Number(item.versionNumber || 0)), 0);
  return last + 1;
}

function pushVersion(state, { user, reason, uid, now }) {
  const versionNumber = nextVersion(state);
  const row = {
    id: newId("cfgv", uid),
    versionNumber,
    status: "active",
    reason: reason || "Configuration update",
    createdAt: nowIso(now),
    createdBy: user?.id || "system",
    previousVersion: state.configVersionNumber || 1,
    snapshot: snapshotConfig(state)
  };
  state.configurationVersions.push(row);
  state.configVersionNumber = versionNumber;
  invalidateConfigCache();
  return row;
}

export function validateParameter(key, value) {
  const def = catalogByKey(key);
  if (!def) return "Unknown parameter";
  if (def.type === "number" && !Number.isFinite(Number(value))) return "Enter a number";
  if (def.key === "org.currency" && String(value).toUpperCase() !== "GHS") {
    return "Default currency must remain GHS for this deployment";
  }
  if (def.key === "approval.cashierLimitGhs" && Number(value) < 0) return "Cashier limit cannot be negative";
  if (def.key === "finance.loanInterest" && (Number(value) < 0 || Number(value) > 100)) return "Interest must be between 0 and 100";
  if (def.key === "security.passwordMinLength" && Number(value) < 8) return "Password minimum cannot be below 8";
  if (def.key === "security.sessionTimeoutMinutes" && Number(value) < 5) return "Session timeout must be at least 5 minutes";
  return "";
}

export function setParameter(state, { key, value, reason, user, approveOwn = false, now } = {}, uid) {
  ensureSystemConfig(state);
  const error = validateParameter(key, value);
  if (error) return { error };
  const def = catalogByKey(key);
  const previous = getConfigValue(state, key);
  const needsApproval = Boolean(def.highRisk) && getConfigValue(state, "approval.makerChecker") !== false && !isSystemOwner(user) && !approveOwn;
  if (needsApproval) {
    const draft = {
      id: newId("cdraft", uid),
      kind: "parameter",
      key,
      value: def.type === "number" ? Number(value) : def.type === "boolean" ? value === true || value === "true" : value,
      previousValue: previous,
      reason: reason || "",
      status: "pending",
      requestedBy: user?.id || "",
      createdAt: nowIso(now)
    };
    state.configurationDrafts.push(draft);
    logConfig(state, "Configuration draft created", `${key} → ${draft.value}`, user, uid, { entityType: "parameter", entityId: key });
    return { draft, pending: true };
  }
  const stored = def.type === "number" ? Number(value) : def.type === "boolean" ? value === true || value === "true" : value;
  const existing = (state.parameterValues || []).find((item) => item.key === key);
  if (existing) existing.value = stored;
  else state.parameterValues.push({ id: key, key, value: stored, status: "active" });
  if (def.liveSetting) state.settings[def.liveSetting] = stored;
  const change = {
    id: newId("cchg", uid),
    key,
    previousValue: previous,
    newValue: stored,
    reason: reason || "",
    userId: user?.id || "",
    createdAt: nowIso(now)
  };
  state.configurationChanges.push(change);
  const version = pushVersion(state, { user, reason: reason || `Updated ${key}`, uid, now });
  logConfig(state, "System settings changed", `${key}: ${previous} → ${stored}`, user, uid, {
    entityType: "parameter",
    entityId: key,
    before: previous,
    after: stored
  });
  return { ok: true, version, change };
}

export function setFeatureFlag(state, { id, enabled, reason, user, applyApproved = false, now } = {}, uid) {
  ensureSystemConfig(state);
  const catalog = FEATURE_FLAG_CATALOG.find((item) => item.id === id);
  if (!catalog) return { error: "Unknown feature flag" };
  const flag = (state.featureFlags || []).find((item) => item.id === id);
  const previous = flag ? flag.enabled : catalog.defaultEnabled;
  if (catalog.highRisk && !isSystemOwner(user) && !applyApproved && getConfigValue(state, "approval.makerChecker") !== false) {
    const draft = {
      id: newId("cdraft", uid),
      kind: "flag",
      key: id,
      value: Boolean(enabled),
      previousValue: previous,
      reason: reason || "",
      status: "pending",
      requestedBy: user?.id || "",
      createdAt: nowIso(now)
    };
    state.configurationDrafts.push(draft);
    logConfig(state, "Feature flag draft created", `${id} → ${enabled}`, user, uid);
    return { draft, pending: true };
  }
  if (flag) flag.enabled = Boolean(enabled);
  else state.featureFlags.push({ id, enabled: Boolean(enabled) });
  const version = pushVersion(state, { user, reason: reason || `Flag ${id}`, uid, now });
  logConfig(state, "Feature flag updated", `${id}: ${previous} → ${enabled}`, user, uid);
  return { ok: true, version };
}

export function approveConfigDraft(state, draftId, user, uid) {
  ensureSystemConfig(state);
  const draft = (state.configurationDrafts || []).find((item) => item.id === draftId);
  if (!draft || draft.status !== "pending") return { error: "Draft not found" };
  if (draft.requestedBy && draft.requestedBy === user?.id && !isSystemOwner(user)) {
    return { error: "Maker-checker: a different approver is required" };
  }
  draft.status = "approved";
  draft.approvedBy = user?.id || "";
  draft.approvedAt = nowIso();
  if (draft.kind === "flag") {
    return setFeatureFlag(state, { id: draft.key, enabled: draft.value, reason: draft.reason, user, applyApproved: true, now: Date.now() }, uid);
  }
  return setParameter(state, { key: draft.key, value: draft.value, reason: draft.reason, user, approveOwn: true }, uid);
}

export function rejectConfigDraft(state, draftId, user, uid) {
  ensureSystemConfig(state);
  const draft = (state.configurationDrafts || []).find((item) => item.id === draftId);
  if (!draft || draft.status !== "pending") return { error: "Draft not found" };
  draft.status = "rejected";
  draft.rejectedBy = user?.id || "";
  logConfig(state, "Configuration draft rejected", draft.key, user, uid);
  return { ok: true, draft };
}

export function rollbackConfigVersion(state, versionNumber, user, uid) {
  ensureSystemConfig(state);
  const target = (state.configurationVersions || []).find((item) => Number(item.versionNumber) === Number(versionNumber));
  if (!target?.snapshot) return { error: "Version not found" };
  applySnapshot(state, target.snapshot);
  const version = pushVersion(state, { user, reason: `Rollback to v${versionNumber}`, uid });
  logConfig(state, "Configuration rolled back", `v${versionNumber}`, user, uid);
  return { ok: true, version };
}

export function compareConfigVersions(state, a, b) {
  const left = (state.configurationVersions || []).find((item) => Number(item.versionNumber) === Number(a));
  const right = (state.configurationVersions || []).find((item) => Number(item.versionNumber) === Number(b));
  if (!left || !right) return [];
  const keys = new Set([
    ...Object.keys(left.snapshot?.parameters || {}),
    ...Object.keys(right.snapshot?.parameters || {})
  ]);
  const diffs = [];
  keys.forEach((key) => {
    const prev = left.snapshot.parameters?.[key];
    const next = right.snapshot.parameters?.[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) diffs.push({ key, previousValue: prev, newValue: next });
  });
  return diffs;
}

export function searchConfig(state, query = "", category = "") {
  ensureSystemConfig(state);
  const q = String(query || "").toLowerCase();
  return PARAMETER_CATALOG.filter((item) => {
    if (category && item.category !== category) return false;
    if (!q) return true;
    return `${item.key} ${item.label} ${item.category}`.toLowerCase().includes(q);
  }).map((item) => ({ ...item, value: getConfigValue(state, item.key) }));
}

export function updateCompanyProfile(state, patch, user, uid) {
  ensureSystemConfig(state);
  const previous = { ...state.companyProfile };
  state.companyProfile = { ...state.companyProfile, ...patch };
  if (patch.companyName) state.settings.businessName = patch.companyName;
  if (patch.currency) state.settings.currency = patch.currency;
  if (patch.timezone) state.settings.timezone = patch.timezone;
  const version = pushVersion(state, { user, reason: "Company profile updated", uid });
  logConfig(state, "Company profile updated", patch.companyName || state.companyProfile.companyName, user, uid, {
    entityType: "company",
    before: previous,
    after: state.companyProfile
  });
  return { ok: true, version, profile: state.companyProfile };
}

export function addHoliday(state, { date, name, branchId = "" }, user, uid) {
  ensureSystemConfig(state);
  const calendar = state.businessCalendars[0];
  if (!date || !name) return { error: "Date and name are required" };
  calendar.holidays = calendar.holidays || [];
  if (calendar.holidays.some((item) => item.date === date && item.name === name)) return { error: "Holiday already exists" };
  calendar.holidays.push({ date, name, branchId, source: "custom" });
  const version = pushVersion(state, { user, reason: `Holiday ${name}`, uid });
  logConfig(state, "Business calendar updated", `${name} ${date}`, user, uid);
  return { ok: true, version };
}

export function isWorkingDay(state, dateText) {
  ensureSystemConfig(state);
  const calendar = state.businessCalendars[0];
  const [year, month, day] = String(dateText).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  if (!(calendar.workingDays || []).includes(weekday)) return false;
  if ((calendar.holidays || []).some((item) => item.date === dateText)) return false;
  return true;
}

export function exportConfig(state) {
  ensureSystemConfig(state);
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    exportedAt: nowIso(),
    version: state.configVersionNumber,
    parameters: Object.fromEntries(PARAMETER_CATALOG.map((item) => [item.key, getConfigValue(state, item.key)])),
    flags: Object.fromEntries((state.featureFlags || []).map((item) => [item.id, item.enabled])),
    profile: { ...(state.companyProfile || {}) },
    products: (state.productDefinitions || []).map((item) => ({ ...item }))
  };
}

export function upsertProductDefinition(state, patch, user, uid) {
  ensureSystemConfig(state);
  const id = patch?.id;
  if (!id) return { error: "Product is required" };
  const existing = (state.productDefinitions || []).find((item) => item.id === id);
  if (!existing) return { error: "Unknown product" };
  const previous = { ...existing };
  if (patch.minAmount !== "" && patch.minAmount != null) existing.minAmount = Number(patch.minAmount);
  if (patch.maxAmount !== "" && patch.maxAmount != null) existing.maxAmount = Number(patch.maxAmount);
  if (patch.interestMethod) existing.interestMethod = String(patch.interestMethod);
  if (patch.frequency) existing.frequency = String(patch.frequency);
  if (patch.status) existing.status = String(patch.status);
  if (patch.eligibility) existing.eligibility = String(patch.eligibility);
  if (Number.isFinite(existing.minAmount) && Number.isFinite(existing.maxAmount) && existing.minAmount > existing.maxAmount) {
    Object.assign(existing, previous);
    return { error: "Minimum amount cannot exceed maximum" };
  }
  const version = pushVersion(state, { user, reason: `Product ${existing.name}`, uid });
  logConfig(state, "Product definition updated", existing.name, user, uid, {
    entityType: "product",
    entityId: existing.id,
    before: previous,
    after: { ...existing }
  });
  return { ok: true, version, product: existing };
}

export function validateConfigImport(payload = {}) {
  if (!payload || typeof payload !== "object") return "Invalid configuration file";
  const params = payload.parameters || {};
  const errors = [];
  Object.entries(params).forEach(([key, value]) => {
    const err = validateParameter(key, value);
    if (err && err !== "Unknown parameter") errors.push(`${key}: ${err}`);
  });
  return errors.length ? errors.join("; ") : "";
}

export function importConfig(state, payload, user, uid) {
  ensureSystemConfig(state);
  const invalid = validateConfigImport(payload);
  if (invalid) return { error: invalid };
  const previous = snapshotConfig(state);
  try {
    Object.entries(payload.parameters || {}).forEach(([key, value]) => {
      const def = catalogByKey(key);
      if (!def) return;
      const existing = (state.parameterValues || []).find((item) => item.key === key);
      const stored = def.type === "number" ? Number(value) : def.type === "boolean" ? Boolean(value) : value;
      if (existing) existing.value = stored;
      else state.parameterValues.push({ id: key, key, value: stored, status: "active" });
      if (def.liveSetting) state.settings[def.liveSetting] = stored;
    });
    Object.entries(payload.flags || {}).forEach(([id, enabled]) => {
      const flag = (state.featureFlags || []).find((item) => item.id === id);
      if (flag) flag.enabled = Boolean(enabled);
    });
    if (payload.profile) state.companyProfile = { ...state.companyProfile, ...payload.profile };
    if (Array.isArray(payload.products)) {
      payload.products.forEach((incoming) => {
        const existing = (state.productDefinitions || []).find((item) => item.id === incoming.id);
        if (existing) Object.assign(existing, incoming);
        else state.productDefinitions.push({ ...incoming });
      });
    }
    const version = pushVersion(state, { user, reason: "Configuration import", uid });
    logConfig(state, "Configuration imported", `v${version.versionNumber}`, user, uid);
    return { ok: true, version };
  } catch (error) {
    applySnapshot(state, previous);
    return { error: error.message, rolledBack: true };
  }
}

export function recordLiveSettingsChange(state, previous, next, user, uid) {
  ensureSystemConfig(state);
  const keys = ["businessName", "currency", "loanInterest"];
  keys.forEach((field) => {
    if (previous[field] === next[field]) return;
    const catalog = PARAMETER_CATALOG.find((item) => item.liveSetting === field);
    state.configurationChanges.push({
      id: newId("cchg", uid),
      key: catalog?.key || field,
      previousValue: previous[field],
      newValue: next[field],
      reason: "Settings form",
      userId: user?.id || "",
      createdAt: nowIso()
    });
  });
  pushVersion(state, { user, reason: "System Controls saved", uid });
  logConfig(state, "System settings changed", "System Controls form", user, uid);
}

export function configDashboard(state) {
  ensureSystemConfig(state);
  return {
    version: state.configVersionNumber || 1,
    parameters: (state.parameterValues || []).length,
    flagsOn: (state.featureFlags || []).filter((item) => item.enabled).length,
    pendingDrafts: (state.configurationDrafts || []).filter((item) => item.status === "pending").length,
    holidays: state.businessCalendars?.[0]?.holidays?.length || 0
  };
}
