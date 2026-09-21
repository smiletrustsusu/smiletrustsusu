/**
 * Phase 8 — Enterprise Configuration, Policy & Feature Management (ECPFMS).
 * Canonical registry SoT. Runtime engine remains Module 14 (system-config.js);
 * Module 30 Platform Admin is operational manager for tenants/flags.
 * Does not change money math, posting, or RBAC SUPER_ADMIN_FORBIDDEN.
 */

export const ECPFMS_VERSION = "1.0.0";
export const ECPFMS_STATUS = "Authoritative";

/** Resolution precedence (highest → lowest). */
export const CONFIG_PRECEDENCE = Object.freeze([
  "Emergency",
  "Env",
  "Tenant",
  "Branch",
  "Product",
  "Global"
]);

export const CONFIG_SCOPES = Object.freeze([
  "Platform",
  "Tenant",
  "Branch",
  "Product",
  "User",
  "Global",
  "Emergency",
  "Env"
]);

const VALID_SCOPES = new Set(CONFIG_SCOPES);

function cfg(partial) {
  return Object.freeze({
    id: partial.id,
    name: partial.name,
    category: partial.category,
    owningModule: partial.owningModule,
    operationalManagerModule: partial.operationalManagerModule ?? 30,
    engineModule: partial.engineModule ?? 14,
    dataType: partial.dataType,
    defaultValue: partial.defaultValue,
    allowedValues: partial.allowedValues ? Object.freeze([...partial.allowedValues]) : undefined,
    scopes: Object.freeze([...(partial.scopes || ["Global", "Tenant", "Branch"])]),
    overridable: partial.overridable !== false,
    highRisk: Boolean(partial.highRisk),
    liveSetting: partial.liveSetting || null,
    sourceKey: partial.sourceKey || null,
    version: partial.version || "1.0.0"
  });
}

function pol(partial) {
  return Object.freeze({
    id: partial.id,
    name: partial.name,
    category: partial.category,
    owningModule: partial.owningModule,
    description: partial.description,
    enforcement: partial.enforcement || "advisory",
    scopes: Object.freeze([...(partial.scopes || ["Tenant", "Branch"])]),
    version: partial.version || "1.0.0"
  });
}

function flag(partial) {
  return Object.freeze({
    id: partial.id,
    name: partial.name,
    runtimeFlagId: partial.runtimeFlagId,
    category: partial.category,
    owningModule: partial.owningModule,
    operationalManagerModule: 30,
    engineModule: 14,
    defaultEnabled: partial.defaultEnabled !== false,
    highRisk: Boolean(partial.highRisk),
    scopes: Object.freeze([...(partial.scopes || ["Platform", "Tenant", "Branch"])]),
    supportsKillSwitch: partial.supportsKillSwitch !== false,
    supportsRolloutPercent: partial.supportsRolloutPercent !== false,
    version: partial.version || "1.0.0"
  });
}

/**
 * Canonical configuration items seeded from system-config PARAMETER_CATALOG
 * and live settings (interest 15, collectionDays 31, cashierLimit 1000, currency GHS).
 */
export const CONFIG_ITEMS = Object.freeze([
  cfg({ id: "CFG-ORG-LANGUAGE", name: "Default language", category: "Platform", owningModule: 14, dataType: "string", defaultValue: "en-GH", sourceKey: "org.language", scopes: ["Global", "Tenant"] }),
  cfg({ id: "CFG-ORG-CURRENCY", name: "Default currency", category: "Org", owningModule: 14, dataType: "string", defaultValue: "GHS", allowedValues: ["GHS"], liveSetting: "currency", sourceKey: "org.currency", overridable: false, scopes: ["Global", "Tenant"], highRisk: true }),
  cfg({ id: "CFG-ORG-DATE-FORMAT", name: "Date format", category: "Org", owningModule: 14, dataType: "string", defaultValue: "YYYY-MM-DD", sourceKey: "org.dateFormat" }),
  cfg({ id: "CFG-ORG-NUMBER-FORMAT", name: "Number format", category: "Org", owningModule: 14, dataType: "string", defaultValue: "en-GH", sourceKey: "org.numberFormat" }),
  cfg({ id: "CFG-ORG-TIME-FORMAT", name: "Time format", category: "Org", owningModule: 14, dataType: "string", defaultValue: "HH:mm", sourceKey: "org.timeFormat" }),
  cfg({ id: "CFG-ORG-TIMEZONE", name: "Time zone", category: "Org", owningModule: 14, dataType: "string", defaultValue: "Africa/Accra", liveSetting: "timezone", sourceKey: "org.timezone" }),
  cfg({ id: "CFG-ORG-DECIMAL-PRECISION", name: "Decimal precision", category: "Org", owningModule: 14, dataType: "number", defaultValue: 2, sourceKey: "org.decimalPrecision", overridable: false }),
  cfg({ id: "CFG-ORG-FINANCIAL-PRECISION", name: "Financial precision", category: "Org", owningModule: 14, dataType: "number", defaultValue: 2, sourceKey: "org.financialPrecision", overridable: false }),
  cfg({ id: "CFG-ORG-EXCHANGE-RATE-POLICY", name: "Exchange rate policy", category: "Org", owningModule: 14, dataType: "string", defaultValue: "manual", sourceKey: "org.exchangeRatePolicy" }),

  cfg({ id: "CFG-FINANCE-LOAN-INTEREST", name: "Default loan interest %", category: "Loans", owningModule: 14, dataType: "number", defaultValue: 15, liveSetting: "loanInterest", sourceKey: "finance.loanInterest", highRisk: true, scopes: ["Global", "Tenant", "Branch", "Product"] }),
  cfg({ id: "CFG-FINANCE-COLLECTION-DAYS", name: "Collection days / cycle", category: "Savings", owningModule: 14, dataType: "number", defaultValue: 31, liveSetting: "collectionDays", sourceKey: "finance.collectionDays", scopes: ["Global", "Tenant", "Branch", "Product"] }),
  cfg({ id: "CFG-FINANCE-MAX-DAILY-COLLECTION", name: "Maximum daily collection (GHS)", category: "Savings", owningModule: 14, dataType: "number", defaultValue: 50000, sourceKey: "finance.maxDailyCollectionGhs" }),
  cfg({ id: "CFG-FINANCE-MAX-WITHDRAWAL", name: "Maximum withdrawal (GHS)", category: "Savings", owningModule: 14, dataType: "number", defaultValue: 20000, sourceKey: "finance.maxWithdrawalGhs" }),
  cfg({ id: "CFG-FINANCE-MIN-SAVINGS-BALANCE", name: "Minimum savings balance (GHS)", category: "Savings", owningModule: 14, dataType: "number", defaultValue: 0, sourceKey: "finance.minSavingsBalanceGhs" }),
  cfg({ id: "CFG-FINANCE-MIN-LOAN-AMOUNT", name: "Minimum loan amount (GHS)", category: "Loans", owningModule: 14, dataType: "number", defaultValue: 100, sourceKey: "finance.minLoanAmountGhs" }),
  cfg({ id: "CFG-FINANCE-MAX-LOAN-AMOUNT", name: "Maximum loan amount (GHS)", category: "Loans", owningModule: 14, dataType: "number", defaultValue: 50000, sourceKey: "finance.maxLoanAmountGhs" }),
  cfg({ id: "CFG-FINANCE-MAX-LOAN-INTEREST", name: "Loan interest ceiling %", category: "Loans", owningModule: 14, dataType: "number", defaultValue: 30, sourceKey: "finance.maxLoanInterestPct", highRisk: true }),
  cfg({ id: "CFG-FINANCE-PENALTY-PCT", name: "Penalty %", category: "Loans", owningModule: 14, dataType: "number", defaultValue: 0, sourceKey: "finance.penaltyPct" }),
  cfg({ id: "CFG-FINANCE-RECEIPT-PREFIX", name: "Receipt number prefix", category: "Org", owningModule: 14, dataType: "string", defaultValue: "RCP", sourceKey: "finance.receiptPrefix" }),
  cfg({ id: "CFG-FINANCE-TXN-PREFIX", name: "Transaction number prefix", category: "Org", owningModule: 14, dataType: "string", defaultValue: "TXN", sourceKey: "finance.transactionPrefix" }),
  cfg({ id: "CFG-FINANCE-BRANCH-CODE-FORMAT", name: "Branch code format", category: "Org", owningModule: 14, dataType: "string", defaultValue: "BR-####", sourceKey: "finance.branchCodeFormat" }),

  cfg({ id: "CFG-APPROVAL-CASHIER-LIMIT", name: "Cashier approval limit (GHS)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 1000, sourceKey: "approval.cashierLimitGhs", highRisk: true, scopes: ["Global", "Tenant", "Branch"] }),
  cfg({ id: "CFG-APPROVAL-BRANCH-MANAGER-LIMIT", name: "Branch manager approval limit (GHS)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 20000, sourceKey: "approval.branchManagerLimitGhs" }),
  cfg({ id: "CFG-APPROVAL-OPERATIONS-LIMIT", name: "Operations manager approval limit (GHS)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 100000, sourceKey: "approval.operationsLimitGhs" }),
  cfg({ id: "CFG-APPROVAL-ACCOUNTANT-LIMIT", name: "Accountant approval limit (GHS)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 20000, sourceKey: "approval.accountantLimitGhs" }),
  cfg({ id: "CFG-APPROVAL-MAKER-CHECKER", name: "Maker-checker for high-risk config", category: "Security", owningModule: 14, dataType: "boolean", defaultValue: true, sourceKey: "approval.makerChecker", overridable: false }),
  cfg({ id: "CFG-APPROVAL-ESCALATION-HOURS", name: "Approval timeout (hours)", category: "Workflow", owningModule: 14, dataType: "number", defaultValue: 24, sourceKey: "approval.escalationHours" }),

  cfg({ id: "CFG-SEC-PASSWORD-MIN-LENGTH", name: "Password minimum length", category: "Security", owningModule: 14, dataType: "number", defaultValue: 8, sourceKey: "security.passwordMinLength", highRisk: true, overridable: false }),
  cfg({ id: "CFG-SEC-PASSWORD-EXPIRY-DAYS", name: "Password expiry (days)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 90, sourceKey: "security.passwordExpiryDays" }),
  cfg({ id: "CFG-SEC-MAX-LOGIN-ATTEMPTS", name: "Max login attempts", category: "Security", owningModule: 14, dataType: "number", defaultValue: 5, sourceKey: "security.maxLoginAttempts" }),
  cfg({ id: "CFG-SEC-LOCK-MINUTES", name: "Account lock duration (minutes)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 15, sourceKey: "security.lockMinutes" }),
  cfg({ id: "CFG-SEC-SESSION-TIMEOUT", name: "Session timeout (minutes)", category: "Security", owningModule: 14, dataType: "number", defaultValue: 480, liveSetting: "sessionTimeoutMinutes", sourceKey: "security.sessionTimeoutMinutes" }),
  cfg({ id: "CFG-SEC-MFA-REQUIRED", name: "Require MFA for privileged roles", category: "Security", owningModule: 14, dataType: "boolean", defaultValue: false, sourceKey: "security.mfaRequired", highRisk: true }),
  cfg({ id: "CFG-SEC-LARGE-AMOUNT", name: "Fraud large-amount threshold (GHS)", category: "Security", owningModule: 22, dataType: "number", defaultValue: 5000, sourceKey: "security.largeAmountGhs", engineModule: 14 }),

  cfg({ id: "CFG-OFFLINE-MAX-QUEUE", name: "Offline queue size", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 500, sourceKey: "offline.maxQueueItems", engineModule: 14 }),
  cfg({ id: "CFG-OFFLINE-SYNC-MINUTES", name: "Sync frequency (minutes)", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 5, sourceKey: "offline.syncMinutes", engineModule: 14 }),
  cfg({ id: "CFG-OFFLINE-CONFLICT-STRATEGY", name: "Conflict resolution", category: "Platform", owningModule: 15, dataType: "string", defaultValue: "local-first", sourceKey: "offline.conflictStrategy", engineModule: 14 }),
  cfg({ id: "CFG-OFFLINE-CACHE-LIMIT", name: "Device cache limit (MB)", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 64, sourceKey: "offline.cacheLimitMb", engineModule: 14 }),
  cfg({ id: "CFG-OFFLINE-ALLOW-HIGH-RISK", name: "Allow high-risk actions offline", category: "Security", owningModule: 15, dataType: "boolean", defaultValue: false, sourceKey: "offline.allowHighRisk", engineModule: 14 }),
  cfg({ id: "CFG-OFFLINE-ALLOW-CUSTOMER-REG", name: "Allow customer registration offline", category: "Platform", owningModule: 15, dataType: "boolean", defaultValue: true, sourceKey: "offline.allowCustomerRegistration", engineModule: 14 }),

  cfg({ id: "CFG-BACKUP-SCHEDULE", name: "Automatic backup schedule", category: "Platform", owningModule: 21, dataType: "string", defaultValue: "daily", sourceKey: "backup.schedule", engineModule: 14 }),
  cfg({ id: "CFG-BACKUP-RETENTION-DAYS", name: "Backup retention (days)", category: "Platform", owningModule: 21, dataType: "number", defaultValue: 30, sourceKey: "backup.retentionDays", engineModule: 14 }),
  cfg({ id: "CFG-BACKUP-ENCRYPT", name: "Encrypt backups", category: "Security", owningModule: 21, dataType: "boolean", defaultValue: true, sourceKey: "backup.encrypt", engineModule: 14, overridable: false }),
  cfg({ id: "CFG-BACKUP-RTO", name: "Recovery time objective (minutes)", category: "Platform", owningModule: 21, dataType: "number", defaultValue: 240, sourceKey: "backup.rtoMinutes", engineModule: 14 }),
  cfg({ id: "CFG-BACKUP-RPO", name: "Recovery point objective (minutes)", category: "Platform", owningModule: 21, dataType: "number", defaultValue: 60, sourceKey: "backup.rpoMinutes", engineModule: 14 }),

  cfg({ id: "CFG-GATEWAY-PER-MINUTE", name: "API gateway requests per minute", category: "Platform", owningModule: 20, dataType: "number", defaultValue: 120, sourceKey: "gateway.perMinute", engineModule: 14 }),
  cfg({ id: "CFG-RETENTION-AUDIT-DAYS", name: "Audit retention (days)", category: "Monitoring", owningModule: 13, dataType: "number", defaultValue: 2555, sourceKey: "retention.auditDays", engineModule: 14, overridable: false }),
  cfg({ id: "CFG-RETENTION-NOTIFICATION-DAYS", name: "Notification retention (days)", category: "Monitoring", owningModule: 12, dataType: "number", defaultValue: 365, sourceKey: "retention.notificationDays", engineModule: 14 }),
  cfg({ id: "CFG-RETENTION-LOGIN-HISTORY-DAYS", name: "Login history retention (days)", category: "Security", owningModule: 13, dataType: "number", defaultValue: 730, sourceKey: "retention.loginHistoryDays", engineModule: 14 }),
  cfg({ id: "CFG-RETENTION-IDEMPOTENCY-DAYS", name: "Idempotency key retention (days)", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 365, sourceKey: "retention.idempotencyDays", engineModule: 14 }),

  cfg({ id: "CFG-PAYMENT-DAILY-LIMIT", name: "Payment daily customer limit (GHS)", category: "Payments", owningModule: 16, dataType: "number", defaultValue: 50000, sourceKey: "payment.dailyLimitGhs", engineModule: 14 }),
  cfg({ id: "CFG-PAYMENT-VELOCITY", name: "Payment velocity per customer / hour", category: "Payments", owningModule: 16, dataType: "number", defaultValue: 20, sourceKey: "payment.velocityPerHour", engineModule: 14 }),
  cfg({ id: "CFG-PAYMENT-HIGH-RISK", name: "Payment high-risk amount (GHS)", category: "Payments", owningModule: 16, dataType: "number", defaultValue: 5000, sourceKey: "payment.highRiskGhs", engineModule: 14 }),
  cfg({ id: "CFG-PAYMENT-CALLBACK-WINDOW", name: "Payment callback replay window (seconds)", category: "Security", owningModule: 16, dataType: "number", defaultValue: 300, sourceKey: "payment.callbackWindowSeconds", engineModule: 14 }),
  cfg({ id: "CFG-PAYMENT-MOMO-WEBHOOK-SECRET-REF", name: "MoMo webhook secret settings key", category: "Payments", owningModule: 28, dataType: "string", defaultValue: "settings.momoWebhookSecret", sourceKey: "settings.momoWebhookSecret", overridable: false, scopes: ["Tenant"], highRisk: true, engineModule: 14 }),

  cfg({ id: "CFG-DOCUMENT-TEMP-PREFIX", name: "Temporary offline receipt prefix", category: "Platform", owningModule: 17, dataType: "string", defaultValue: "TMP-", sourceKey: "document.tempPrefix", engineModule: 14 }),
  cfg({ id: "CFG-DOCUMENT-APPROVAL-TOKEN-MINUTES", name: "Receipt approval token validity (minutes)", category: "Workflow", owningModule: 17, dataType: "number", defaultValue: 15, sourceKey: "document.approvalTokenMinutes", engineModule: 14 }),

  cfg({ id: "CFG-JOB-STALE-LOCK-MS", name: "Job reservation lock TTL (ms)", category: "Platform", owningModule: 18, dataType: "number", defaultValue: 30000, sourceKey: "job.staleLockMs", engineModule: 14 }),
  cfg({ id: "CFG-JOB-HEARTBEAT-MS", name: "Worker heartbeat interval (ms)", category: "Platform", owningModule: 18, dataType: "number", defaultValue: 15000, sourceKey: "job.heartbeatMs", engineModule: 14 }),
  cfg({ id: "CFG-JOB-MAX-PER-TICK", name: "Scheduler jobs per tick", category: "Platform", owningModule: 18, dataType: "number", defaultValue: 10, sourceKey: "job.maxJobsPerTick", engineModule: 14 }),

  cfg({ id: "CFG-MONITOR-COLLECTION-INTERVAL", name: "Health snapshot interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 60000, sourceKey: "monitor.collectionIntervalMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-CRITICAL-INTERVAL", name: "Critical metric interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 30000, sourceKey: "monitor.criticalIntervalMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-HIGH-INTERVAL", name: "High-priority metric interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 60000, sourceKey: "monitor.highIntervalMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-STANDARD-INTERVAL", name: "Standard metric interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 300000, sourceKey: "monitor.standardIntervalMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-BUSINESS-INTERVAL", name: "Business metric interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 900000, sourceKey: "monitor.businessIntervalMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-BATCH-TRANSMIT", name: "Telemetry batch transmit interval (ms)", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 300000, sourceKey: "monitor.batchTransmitMs", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-REQUIRE-ACK-COMMENT", name: "Require comment on major/critical alert ack", category: "Monitoring", owningModule: 19, dataType: "boolean", defaultValue: false, sourceKey: "monitor.requireAckComment", engineModule: 14 }),
  cfg({ id: "CFG-MONITOR-STORAGE-WARN", name: "Storage warning percent", category: "Monitoring", owningModule: 19, dataType: "number", defaultValue: 90, sourceKey: "monitor.storageWarnPct", engineModule: 14 }),

  cfg({ id: "CFG-ANDROID-STORAGE-WARN", name: "Android free storage warning %", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 15, sourceKey: "android.storageWarnPct", engineModule: 14 }),
  cfg({ id: "CFG-ANDROID-SYNC-BACKLOG", name: "Android sync backlog alert", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 50, sourceKey: "android.syncBacklogAlert", engineModule: 14 }),
  cfg({ id: "CFG-ANDROID-LONG-OFFLINE", name: "Android long-offline hours", category: "Platform", owningModule: 15, dataType: "number", defaultValue: 48, sourceKey: "android.longOfflineHours", engineModule: 14 }),

  cfg({ id: "CFG-RULE-EXEC-TIMEOUT", name: "Rule evaluation timeout (ms)", category: "Workflow", owningModule: 24, dataType: "number", defaultValue: 50, sourceKey: "rule.executionTimeoutMs", engineModule: 14 }),
  cfg({ id: "CFG-RULE-MAX-EVALS", name: "Maximum rules per evaluation request", category: "Workflow", owningModule: 24, dataType: "number", defaultValue: 50, sourceKey: "rule.maxEvaluationsPerRequest", engineModule: 14 }),
  cfg({ id: "CFG-RULE-CACHE-TTL", name: "Published rule cache TTL (ms)", category: "Workflow", owningModule: 24, dataType: "number", defaultValue: 30000, sourceKey: "rule.cacheTtlMs", engineModule: 14 }),
  cfg({ id: "CFG-RULE-SIMULATION-LIMIT", name: "Maximum simulation cases", category: "Workflow", owningModule: 24, dataType: "number", defaultValue: 1000, sourceKey: "rule.simulationLimit", engineModule: 14 }),
  cfg({ id: "CFG-RULE-VERSION-RETENTION", name: "Rule version retention count", category: "Workflow", owningModule: 24, dataType: "number", defaultValue: 25, sourceKey: "rule.versionRetention", engineModule: 14 }),
  cfg({ id: "CFG-RULE-MAKER-CHECKER", name: "Maker-checker for rule publication", category: "Workflow", owningModule: 24, dataType: "boolean", defaultValue: true, sourceKey: "rule.makerChecker", engineModule: 14 }),

  cfg({ id: "CFG-EXCHANGE-MAX-SYNC-RECORDS", name: "Maximum records per synchronous export", category: "Platform", owningModule: 25, dataType: "number", defaultValue: 500, sourceKey: "exchange.maxSyncRecords", engineModule: 14 }),
  cfg({ id: "CFG-EXCHANGE-MAX-FILE-BYTES", name: "Maximum export file size (bytes)", category: "Platform", owningModule: 25, dataType: "number", defaultValue: 2000000, sourceKey: "exchange.maxFileBytes", engineModule: 14 }),
  cfg({ id: "CFG-EXCHANGE-MAX-CONCURRENT", name: "Maximum concurrent export jobs", category: "Platform", owningModule: 25, dataType: "number", defaultValue: 3, sourceKey: "exchange.maxConcurrentJobs", engineModule: 14 }),
  cfg({ id: "CFG-EXCHANGE-MAX-SCHEDULED", name: "Maximum scheduled exports per user", category: "Platform", owningModule: 25, dataType: "number", defaultValue: 5, sourceKey: "exchange.maxScheduledPerUser", engineModule: 14 }),

  cfg({ id: "CFG-RECORDS-STORAGE-PROVIDER", name: "Digital records storage provider", category: "Platform", owningModule: 26, dataType: "string", defaultValue: "local", sourceKey: "records.storageProvider", engineModule: 14 }),
  cfg({ id: "CFG-RECORDS-MAX-FILE-BYTES", name: "Maximum digital record file size (bytes)", category: "Platform", owningModule: 26, dataType: "number", defaultValue: 5000000, sourceKey: "records.maxFileBytes", engineModule: 14 }),
  cfg({ id: "CFG-RECORDS-DOWNLOAD-TTL", name: "Secure download link TTL (ms)", category: "Security", owningModule: 26, dataType: "number", defaultValue: 300000, sourceKey: "records.downloadTtlMs", engineModule: 14 }),
  cfg({ id: "CFG-RECORDS-WATERMARK", name: "Watermark Financial/Restricted previews", category: "Security", owningModule: 26, dataType: "boolean", defaultValue: true, sourceKey: "records.watermarkSensitive", engineModule: 14 }),

  cfg({ id: "CFG-INTEGRATION-PER-MINUTE", name: "Integration hub per-minute rate limit", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 60, sourceKey: "integration.perMinute", engineModule: 14 }),
  cfg({ id: "CFG-INTEGRATION-PER-HOUR", name: "Integration hub per-hour rate limit", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 1000, sourceKey: "integration.perHour", engineModule: 14 }),
  cfg({ id: "CFG-INTEGRATION-TIMEOUT", name: "Integration provider timeout (ms)", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 5000, sourceKey: "integration.defaultTimeoutMs", engineModule: 14 }),
  cfg({ id: "CFG-INTEGRATION-RETRY-MAX", name: "Integration default retry max", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 3, sourceKey: "integration.retryMax", engineModule: 14 }),
  cfg({ id: "CFG-INTEGRATION-CIRCUIT-THRESHOLD", name: "Integration circuit breaker failure threshold", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 5, sourceKey: "integration.circuitFailureThreshold", engineModule: 14 }),
  cfg({ id: "CFG-INTEGRATION-CIRCUIT-COOLDOWN", name: "Integration circuit breaker cool-down (ms)", category: "Platform", owningModule: 28, dataType: "number", defaultValue: 30000, sourceKey: "integration.circuitCoolDownMs", engineModule: 14 }),

  cfg({ id: "CFG-AI-SHADOW-MODE", name: "AI shadow mode default", category: "AI", owningModule: 29, dataType: "boolean", defaultValue: true, scopes: ["Platform", "Tenant"], engineModule: 14 }),
  cfg({ id: "CFG-PLATFORM-DEFAULT-TENANT", name: "Default tenant id", category: "Platform", owningModule: 30, dataType: "string", defaultValue: "tenant-smile-trust", overridable: false, scopes: ["Platform"], engineModule: 14 })
]);

export const POLICY_ITEMS = Object.freeze([
  pol({ id: "POL-CURRENCY-GHS-ONLY", name: "Currency must remain GHS", category: "Org", owningModule: 14, description: "Deployment currency is GHS; cannot override to other currencies", enforcement: "hard", scopes: ["Global", "Tenant"] }),
  pol({ id: "POL-MAKER-CHECKER-HIGH-RISK", name: "Maker-checker for high-risk config", category: "Security", owningModule: 14, description: "High-risk parameters and flags require a different approver", enforcement: "hard" }),
  pol({ id: "POL-NO-MOMO-PINS", name: "No MoMo PINs or bank passwords in config", category: "Security", owningModule: 28, description: "Only webhook secret refs / API key hashes; never PINs or bank passwords", enforcement: "hard", scopes: ["Platform", "Tenant"] }),
  pol({ id: "POL-TENANT-ISOLATION", name: "Tenant configuration isolation", category: "Platform", owningModule: 30, description: "Tenant A cannot read or mutate Tenant B configuration or flags", enforcement: "hard", scopes: ["Platform", "Tenant"] }),
  pol({ id: "POL-BRANCH-ISOLATION", name: "Branch configuration isolation", category: "Org", owningModule: 5, description: "Branch overrides apply only within owning tenant + branch", enforcement: "hard", scopes: ["Tenant", "Branch"] }),
  pol({ id: "POL-FEATURE-FLAG-ISOLATION", name: "Feature flag tenant isolation", category: "Platform", owningModule: 30, description: "Flag rules and kill switches are scoped; cross-tenant evaluation rejected", enforcement: "hard", scopes: ["Platform", "Tenant"] }),
  pol({ id: "POL-EMERGENCY-OVERRIDE-AUDIT", name: "Emergency overrides are audited", category: "Security", owningModule: 30, description: "Emergency layer wins but must emit audit and expire", enforcement: "hard", scopes: ["Emergency", "Platform"] }),
  pol({ id: "POL-IMPORT-EXPORT-VALIDATE", name: "Config import/export validation", category: "Platform", owningModule: 14, description: "Imports run validateParameter / validateConfigImport before apply", enforcement: "hard" }),
  pol({ id: "POL-CACHE-INVALIDATION", name: "Config cache invalidation on change", category: "Platform", owningModule: 14, description: "invalidateConfigCache on parameter/flag/version changes", enforcement: "hard" }),
  pol({ id: "POL-INTEREST-CEILING", name: "Loan interest within ceiling", category: "Loans", owningModule: 8, description: "Interest cannot exceed finance.maxLoanInterestPct without high-risk approval", enforcement: "advisory" }),
  pol({ id: "POL-CASHIER-LIMIT-NONNEG", name: "Cashier limit non-negative", category: "Security", owningModule: 14, description: "approval.cashierLimitGhs >= 0", enforcement: "hard" }),
  pol({ id: "POL-SESSION-MIN-TIMEOUT", name: "Session timeout minimum 5 minutes", category: "Security", owningModule: 1, description: "sessionTimeoutMinutes >= 5", enforcement: "hard" }),
  pol({ id: "POL-PASSWORD-MIN-8", name: "Password minimum length 8", category: "Security", owningModule: 1, description: "passwordMinLength cannot be below 8", enforcement: "hard" }),
  pol({ id: "POL-BACKUP-ENCRYPT-ON", name: "Backups encrypted by default", category: "Platform", owningModule: 21, description: "backup.encrypt default true", enforcement: "advisory" }),
  pol({ id: "POL-SUPER-ADMIN-FORBIDDEN-UNCHANGED", name: "SUPER_ADMIN_FORBIDDEN unchanged by config", category: "Security", owningModule: 1, description: "Config/flags must not grant Owner.Transfer, System.Reset, or Export.All to KBA", enforcement: "hard", scopes: ["Platform"] })
]);

export const FEATURE_FLAG_ITEMS = Object.freeze([
  flag({ id: "FF-FIXED-SAVINGS", name: "Enable Fixed Savings", runtimeFlagId: "enableFixedSavings", category: "Savings", owningModule: 6, defaultEnabled: true }),
  flag({ id: "FF-MOBILE-MONEY", name: "Enable Mobile Money", runtimeFlagId: "enableMobileMoney", category: "Payments", owningModule: 16, defaultEnabled: true }),
  flag({ id: "FF-WHATSAPP", name: "Enable WhatsApp", runtimeFlagId: "enableWhatsApp", category: "Platform", owningModule: 12, defaultEnabled: true }),
  flag({ id: "FF-PUSH", name: "Enable Push Notifications", runtimeFlagId: "enablePushNotifications", category: "Platform", owningModule: 12, defaultEnabled: true }),
  flag({ id: "FF-LOAN-MODULE", name: "Enable Loan Module", runtimeFlagId: "enableLoanModule", category: "Loans", owningModule: 8, defaultEnabled: true, highRisk: true }),
  flag({ id: "FF-OFFLINE-MODE", name: "Enable Offline Mode", runtimeFlagId: "enableOfflineMode", category: "Platform", owningModule: 15, defaultEnabled: true }),
  flag({ id: "FF-GROUP-LOANS", name: "Enable Group Loans", runtimeFlagId: "enableGroupLoans", category: "Loans", owningModule: 8, defaultEnabled: true }),
  flag({ id: "FF-BRANCH-ACCOUNTING", name: "Enable Branch Accounting", runtimeFlagId: "enableBranchAccounting", category: "Org", owningModule: 10, defaultEnabled: true }),
  flag({ id: "FF-DOCUMENT-ENGINE", name: "Enable Document Engine", runtimeFlagId: "enableDocumentEngine", category: "Platform", owningModule: 17, defaultEnabled: true }),
  flag({ id: "FF-JOB-ENGINE", name: "Enable Job Scheduler Engine", runtimeFlagId: "enableJobEngine", category: "Platform", owningModule: 18, defaultEnabled: true }),
  flag({ id: "FF-MONITORING-ENGINE", name: "Enable Monitoring Engine", runtimeFlagId: "enableMonitoringEngine", category: "Monitoring", owningModule: 19, defaultEnabled: true }),
  flag({ id: "FF-API-GATEWAY", name: "Enable API Gateway", runtimeFlagId: "enableApiGateway", category: "Platform", owningModule: 20, defaultEnabled: true }),
  flag({ id: "FF-BACKUP-RECOVERY", name: "Enable Backup Recovery Engine", runtimeFlagId: "enableBackupRecoveryEngine", category: "Platform", owningModule: 21, defaultEnabled: true }),
  flag({ id: "FF-SECURITY-ENGINE", name: "Enable Security Operations Engine", runtimeFlagId: "enableSecurityEngine", category: "Security", owningModule: 22, defaultEnabled: true, highRisk: true }),
  flag({ id: "FF-WORKFLOW-ENGINE", name: "Enable Workflow Engine", runtimeFlagId: "enableWorkflowEngine", category: "Workflow", owningModule: 23, defaultEnabled: true }),
  flag({ id: "FF-RULE-ENGINE", name: "Enable Enterprise Rule Engine", runtimeFlagId: "enableRuleEngine", category: "Workflow", owningModule: 24, defaultEnabled: true }),
  flag({ id: "FF-DATA-EXCHANGE", name: "Enable Data Exchange Framework", runtimeFlagId: "enableDataExchange", category: "Platform", owningModule: 25, defaultEnabled: true }),
  flag({ id: "FF-DIGITAL-RECORDS", name: "Enable Digital Records Management", runtimeFlagId: "enableDigitalRecords", category: "Platform", owningModule: 26, defaultEnabled: true }),
  flag({ id: "FF-ENTERPRISE-BI", name: "Enable Enterprise BI & Metric Registry", runtimeFlagId: "enableEnterpriseBi", category: "Platform", owningModule: 27, defaultEnabled: true }),
  flag({ id: "FF-ENTERPRISE-INTEGRATION", name: "Enable Enterprise Integration Hub", runtimeFlagId: "enableEnterpriseIntegration", category: "Platform", owningModule: 28, defaultEnabled: true }),
  flag({ id: "FF-ENTERPRISE-AI", name: "Enable Enterprise AI & Predictive Intelligence", runtimeFlagId: "enableEnterpriseAi", category: "AI", owningModule: 29, defaultEnabled: true }),
  flag({ id: "FF-PLATFORM-ADMIN", name: "Enable Platform Administration & Global Operations", runtimeFlagId: "enablePlatformAdmin", category: "Platform", owningModule: 30, defaultEnabled: true })
]);

export function listConfigItems(filter = {}) {
  let rows = [...CONFIG_ITEMS];
  if (filter.category) rows = rows.filter((r) => r.category === filter.category);
  if (filter.owningModule != null) rows = rows.filter((r) => r.owningModule === filter.owningModule);
  return rows;
}

export function getConfigItem(itemId) {
  return CONFIG_ITEMS.find((item) => item.id === itemId) || null;
}

export function getPolicyItem(policyId) {
  return POLICY_ITEMS.find((item) => item.id === policyId) || null;
}

export function getFeatureFlagItem(flagId) {
  return FEATURE_FLAG_ITEMS.find((item) => item.id === flagId || item.runtimeFlagId === flagId) || null;
}

export function listFeatureFlags() {
  return [...FEATURE_FLAG_ITEMS];
}

export function listPolicies() {
  return [...POLICY_ITEMS];
}

/**
 * Resolve effective value with precedence Emergency → Env → Tenant → Branch → Product → Global.
 * Non-overridable items ignore lower-scope overrides (only Emergency/Env may still apply if present).
 */
export function resolveEffectiveConfig(itemId, context = {}) {
  const item = getConfigItem(itemId);
  if (!item) {
    return { ok: false, error: "Unknown config item", code: "ECPFMS-001", value: undefined };
  }

  const isolation = assertTenantIsolation(context);
  if (!isolation.ok) return { ...isolation, value: undefined };

  const layers = {
    Emergency: context.emergencyOverrides,
    Env: context.envOverrides,
    Tenant: context.tenantOverrides,
    Branch: context.branchOverrides,
    Product: context.productOverrides,
    Global: null
  };

  for (const layer of CONFIG_PRECEDENCE) {
    if (layer === "Global") {
      return {
        ok: true,
        value: item.defaultValue,
        layer: "Global",
        itemId,
        sourceKey: item.sourceKey
      };
    }
    const map = layers[layer];
    if (!map || map[itemId] === undefined) continue;
    if (!item.overridable && layer !== "Emergency" && layer !== "Env") {
      continue;
    }
    return {
      ok: true,
      value: map[itemId],
      layer,
      itemId,
      sourceKey: item.sourceKey
    };
  }

  return { ok: true, value: item.defaultValue, layer: "Global", itemId };
}

/**
 * Tenant/branch isolation assertion for resolution context.
 */
export function assertTenantIsolation(context = {}) {
  if (context.requireTenant === false && context.requireBranch === false) {
    return { ok: true };
  }
  if (context.requireTenant !== false && !context.tenantId) {
    return { ok: false, error: "Tenant context required", code: "ECPFMS-010" };
  }
  if (context.requestedTenantId && context.tenantId && context.requestedTenantId !== context.tenantId) {
    return { ok: false, error: "Cross-tenant configuration access rejected", code: "ECPFMS-011" };
  }
  if (context.requireBranch === true && !context.branchId) {
    return { ok: false, error: "Branch context required", code: "ECPFMS-012" };
  }
  if (context.requestedBranchId && context.branchId && context.requestedBranchId !== context.branchId) {
    if (context.tenantId && context.requestedTenantId && context.requestedTenantId !== context.tenantId) {
      return { ok: false, error: "Cross-tenant configuration access rejected", code: "ECPFMS-011" };
    }
    return { ok: false, error: "Cross-branch configuration access rejected", code: "ECPFMS-013" };
  }
  return { ok: true };
}

export function validateConfigRegistry() {
  const errors = [];
  const configIds = new Set();
  const owners = new Map();

  for (const item of CONFIG_ITEMS) {
    if (configIds.has(item.id)) errors.push(`Duplicate config id ${item.id}`);
    configIds.add(item.id);
    if (!item.owningModule) errors.push(`${item.id} missing owningModule`);
    if (owners.has(item.id) && owners.get(item.id) !== item.owningModule) {
      errors.push(`${item.id} multiple owners`);
    }
    owners.set(item.id, item.owningModule);
    for (const scope of item.scopes) {
      if (!VALID_SCOPES.has(scope)) errors.push(`${item.id} invalid scope ${scope}`);
    }
  }

  const policyIds = new Set();
  for (const item of POLICY_ITEMS) {
    if (policyIds.has(item.id)) errors.push(`Duplicate policy id ${item.id}`);
    policyIds.add(item.id);
    if (!item.owningModule) errors.push(`${item.id} missing owningModule`);
  }

  const flagIds = new Set();
  const runtimeIds = new Set();
  for (const item of FEATURE_FLAG_ITEMS) {
    if (flagIds.has(item.id)) errors.push(`Duplicate flag id ${item.id}`);
    flagIds.add(item.id);
    if (runtimeIds.has(item.runtimeFlagId)) errors.push(`Duplicate runtimeFlagId ${item.runtimeFlagId}`);
    runtimeIds.add(item.runtimeFlagId);
    if (!item.owningModule) errors.push(`${item.id} missing owningModule`);
  }

  const interest = getConfigItem("CFG-FINANCE-LOAN-INTEREST");
  const days = getConfigItem("CFG-FINANCE-COLLECTION-DAYS");
  const cashier = getConfigItem("CFG-APPROVAL-CASHIER-LIMIT");
  if (interest?.defaultValue !== 15) errors.push("loan interest default must be 15");
  if (days?.defaultValue !== 31) errors.push("collectionDays default must be 31");
  if (cashier?.defaultValue !== 1000) errors.push("cashier limit default must be 1000");

  return { ok: errors.length === 0, errors };
}

export const ECPFMS_COUNTS = Object.freeze({
  configItems: CONFIG_ITEMS.length,
  policies: POLICY_ITEMS.length,
  featureFlags: FEATURE_FLAG_ITEMS.length
});
