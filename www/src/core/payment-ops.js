/**
 * Module 16 — Mobile Money & Payment Gateway Integration.
 * Orchestration layer only. Does not run MoMo wallets, bank ledgers, or PIN entry.
 * Business modules must call this engine instead of talking to providers.
 */

import { recordAuditEvent, payloadHash } from "./audit-ops.js";
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { isFeatureEnabled, getConfigValue } from "./system-config.js";
import { verifyMomoPaymentLocally, isWalletPaymentMethod, normalizeMomoReference, isValidMomoReference } from "./momo.js";
import { processMomoCallback, parseMomoWebhookPayload, normalizeWebhookReference } from "./momo-webhook.js";
import { queueNotification } from "./notifications.js";
import { linkExternalReference } from "./identifiers.js";
import { toPesewas } from "./money.js";
import { ROLE, isSystemOwner } from "./roles.js";
import {
  PAYMENT_STATES,
  TERMINAL_PAYMENT_STATES,
  PAYMENT_TRANSITION_MATRIX,
  TRANSACTION_STATUS_MAP,
  WORKFLOW_STAGES,
  canonicalPaymentStatus,
  mapPaymentToTransactionStatus,
  canTransitionPayment,
  isTerminalPaymentStatus,
  ensurePaymentLifecycleState,
  transitionPayment,
  executeWorkflowStage,
  acquireStageLock,
  releaseStageLock,
  failbackStageOwner,
  setOwnerHealth,
  assertStageActor,
  markAccountingPosted,
  STATE_OWNERS,
  paymentFlowOrder
} from "./payment-lifecycle.js";

export {
  PAYMENT_STATES,
  TERMINAL_PAYMENT_STATES,
  PAYMENT_TRANSITION_MATRIX,
  TRANSACTION_STATUS_MAP,
  WORKFLOW_STAGES,
  canonicalPaymentStatus,
  mapPaymentToTransactionStatus,
  canTransitionPayment,
  isTerminalPaymentStatus,
  transitionPayment,
  executeWorkflowStage,
  acquireStageLock,
  releaseStageLock,
  failbackStageOwner,
  setOwnerHealth,
  assertStageActor,
  markAccountingPosted,
  STATE_OWNERS,
  paymentFlowOrder
};

export const PAYMENT_SCHEMA_VERSION = "1.1.0";

export const PAYMENT_METHODS = [
  "Cash",
  "MTN Mobile Money",
  "Telecel Cash",
  "AirtelTigo Money",
  "Mobile Money",
  "Bank Transfer",
  "Bank Deposit",
  "Internal Wallet",
  "Card Payments",
  "QR Payments",
  "POS/Card",
  "Cheque"
];

export const PAYMENT_TYPES = [
  "savings_deposit",
  "loan_repayment",
  "loan_disbursement",
  "withdrawal_payout",
  "group_contribution",
  "membership_fee",
  "penalty_payment",
  "interest_payment",
  "expense_payment",
  "miscellaneous_income"
];

export const QUEUE_STATES = [
  "pending",
  "awaiting_provider",
  "callback_pending",
  "completed",
  "failed",
  "retrying",
  "dead_letter"
];

export const FORBIDDEN_CUSTOMER_FIELDS = ["pin", "momoPin", "momoPIN", "bankPassword", "password", "otp", "oneTimeCode", "cvv", "cardCvv"];

export const TRUSTED_PAYMENT_BOUNDARY = [
  "Android APK",
  "Web Administration Portal",
  "Payment Engine",
  "Business Services",
  "Accounting Engine",
  "Audit Engine",
  "Notification Engine",
  "Synchronization Engine",
  "Database",
  "Internal APIs"
];

export const EXTERNAL_PAYMENT_SYSTEMS = [
  "MTN Mobile Money",
  "Telecel Cash",
  "AirtelTigo Money",
  "Banks",
  "Card Processors",
  "Payment Gateways",
  "SMS Providers",
  "Email Providers",
  "Government APIs",
  "Third-party Integration Platforms"
];

export const FAILURE_OWNERSHIP = {
  invalid_business_rules: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
  duplicate_internal_transaction: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
  incorrect_accounting_entry: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
  network_outage: "Shared responsibility (system retries, provider availability)",
  provider_timeout: "External provider, handled through retry policy",
  duplicate_callback: "External provider behavior, handled by system idempotency",
  customer_incorrect_pin: "Customer",
  provider_rejects: "External provider",
  bank_settlement_delay: "Financial institution"
};

export const UNSUPPORTED_RESPONSIBILITIES = [
  "Mobile wallet management",
  "Banking ledger systems",
  "Card network switching",
  "Telecom billing systems",
  "Foreign exchange trading",
  "Regulatory settlement systems"
];

const PAYMENT_ARRAYS = [
  "paymentTransactions",
  "paymentMethods",
  "paymentProviders",
  "providerCredentials",
  "paymentCallbacks",
  "paymentReconciliation",
  "settlements",
  "paymentRefunds",
  "paymentReversals",
  "paymentQueue",
  "paymentAttempts",
  "providerHealth",
  "paymentLimits",
  "paymentActivityLogs",
  "paymentBlacklist",
  "paymentStatusHistory",
  "paymentStageLocks",
  "paymentOwnershipEvents",
  "paymentWorkflowEvents",
  "paymentOwnerHealth"
];

const FUTURE_METHODS = new Set(["Internal Wallet", "Card Payments", "QR Payments"]);

const PROVIDER_ADAPTERS = new Map();

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

function cloneFrozen(row) {
  return JSON.parse(JSON.stringify(row));
}

function logActivity(state, action, details, extras = {}, uid) {
  state.paymentActivityLogs.push({
    id: newId("plog", uid),
    action,
    details,
    paymentId: extras.paymentId || "",
    owner: extras.owner || FAILURE_OWNERSHIP.invalid_business_rules,
    createdAt: nowIso(extras.now)
  });
}

function auditPayment(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username || "",
    role: user?.role || "",
    category: extras.category || "financial",
    entityType: extras.entityType || "payment",
    entityId: extras.entityId || "",
    transactionId: extras.transactionId || extras.entityId || "",
    correlationId: extras.correlationId || extras.entityId || "",
    guarantee: "G1",
    module: "16",
    result: extras.result || "Success"
  }, uid);
}

export function signPaymentPayload(secret, body, timestamp) {
  return payloadHash({
    secret: String(secret || ""),
    body: typeof body === "string" ? body : JSON.stringify(body || {}),
    timestamp: String(timestamp || "")
  });
}

export function verifyPaymentSignature(secret, body, timestamp, signature) {
  if (!secret) return { ok: false, error: "Provider callback secret is not configured" };
  const expected = signPaymentPayload(secret, body, timestamp);
  if (!signature || expected !== String(signature)) return { ok: false, error: "Invalid callback signature" };
  return { ok: true };
}

function containsForbiddenCredentials(request = {}) {
  return FORBIDDEN_CUSTOMER_FIELDS.some((field) => {
    const value = request[field];
    return value != null && String(value).trim() !== "";
  });
}

function methodRow(state, method) {
  return (state.paymentMethods || []).find((item) => item.name === method || item.id === method);
}

function providerById(state, id) {
  return (state.paymentProviders || []).find((item) => item.id === id);
}

function healthRow(state, providerId) {
  return (state.providerHealth || []).find((item) => item.providerId === providerId);
}

function isHttpsUrl(url) {
  if (!url) return true;
  return /^https:\/\//i.test(url) || url.startsWith("/");
}

function defaultRetryPolicy() {
  return { maxAttempts: 5, backoffMs: 1000, timeoutMs: 30000 };
}

function seedMethods() {
  return PAYMENT_METHODS.map((name, index) => ({
    id: `pm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    enabled: !FUTURE_METHODS.has(name),
    futureReady: FUTURE_METHODS.has(name),
    priority: index + 1,
    configurable: true
  }));
}

function seedProviders() {
  return [
    { id: "prov-cash", name: "Cash Desk", methods: ["Cash", "Cheque"], authMethod: "internal", callbackUrl: "", timeoutMs: 0, retryPolicy: defaultRetryPolicy(), settlementRules: "same-day-cash", currencies: ["GHS"], status: "active", priority: 1, plugin: "cash" },
    { id: "prov-mtn", name: "MTN Mobile Money", methods: ["MTN Mobile Money", "Mobile Money"], authMethod: "hmac", callbackUrl: "/payments/callback/mtn", timeoutMs: 30000, retryPolicy: defaultRetryPolicy(), settlementRules: "t-plus-1", currencies: ["GHS"], status: "active", priority: 2, plugin: "mtn" },
    { id: "prov-telecel", name: "Telecel Cash", methods: ["Telecel Cash", "Mobile Money"], authMethod: "hmac", callbackUrl: "/payments/callback/telecel", timeoutMs: 30000, retryPolicy: defaultRetryPolicy(), settlementRules: "t-plus-1", currencies: ["GHS"], status: "active", priority: 3, plugin: "telecel" },
    { id: "prov-airteltigo", name: "AirtelTigo Money", methods: ["AirtelTigo Money", "Mobile Money"], authMethod: "hmac", callbackUrl: "/payments/callback/airteltigo", timeoutMs: 30000, retryPolicy: defaultRetryPolicy(), settlementRules: "t-plus-1", currencies: ["GHS"], status: "active", priority: 4, plugin: "airteltigo" },
    { id: "prov-bank", name: "Bank Transfer / Deposit", methods: ["Bank Transfer", "Bank Deposit"], authMethod: "hmac", callbackUrl: "/payments/callback/bank", timeoutMs: 45000, retryPolicy: defaultRetryPolicy(), settlementRules: "clearing", currencies: ["GHS"], status: "active", priority: 5, plugin: "bank" },
    { id: "prov-wallet", name: "Internal Wallet", methods: ["Internal Wallet"], authMethod: "internal", callbackUrl: "", timeoutMs: 0, retryPolicy: defaultRetryPolicy(), settlementRules: "internal", currencies: ["GHS"], status: "disabled", priority: 90, plugin: "wallet" },
    { id: "prov-card", name: "Card Processor", methods: ["Card Payments", "POS/Card"], authMethod: "hmac", callbackUrl: "/payments/callback/card", timeoutMs: 30000, retryPolicy: defaultRetryPolicy(), settlementRules: "card-clearing", currencies: ["GHS"], status: "disabled", priority: 91, plugin: "card" },
    { id: "prov-qr", name: "QR Payments", methods: ["QR Payments"], authMethod: "hmac", callbackUrl: "/payments/callback/qr", timeoutMs: 30000, retryPolicy: defaultRetryPolicy(), settlementRules: "t-plus-1", currencies: ["GHS"], status: "disabled", priority: 92, plugin: "qr" }
  ];
}

function cashAdapter() {
  return {
    id: "cash",
    executeTransfer: false,
    initiate() {
      return { ok: true, status: "completed", providerOwned: false, message: "Cash is recorded internally. Customer PIN is not used." };
    },
    parseCallback() {
      return { ok: false, error: "Cash payments do not use provider callbacks" };
    }
  };
}

function electronicAdapter(plugin, label) {
  return {
    id: plugin,
    executeTransfer: false,
    initiate({ payment, provider }) {
      if (provider?.callbackUrl && !isHttpsUrl(provider.callbackUrl) && !provider.callbackUrl.startsWith("/")) {
        return { ok: false, error: "Provider callback URL must use TLS (https)", owner: FAILURE_OWNERSHIP.invalid_business_rules };
      }
      return {
        ok: true,
        status: "pending_provider",
        providerOwned: true,
        outbound: {
          providerId: provider.id,
          paymentId: payment.id,
          amountPesewas: payment.amountPesewas,
          reference: payment.paymentReference,
          correlationId: payment.correlationId
        },
        message: `${label} must authorize this payment. Smile Trust does not collect PINs or execute the wallet transfer.`
      };
    },
    parseCallback(body = {}) {
      const parsed = parseMomoWebhookPayload(body);
      return {
        ok: true,
        reference: parsed.reference,
        amount: parsed.amount,
        amountPesewas: parsed.amountPesewas,
        phone: parsed.phone,
        provider: parsed.provider || plugin,
        status: parsed.status,
        providerRef: parsed.reference,
        raw: parsed.raw
      };
    }
  };
}

export function registerProviderAdapter(adapter) {
  if (!adapter?.id) return { error: "Adapter id is required" };
  PROVIDER_ADAPTERS.set(adapter.id, adapter);
  return { ok: true, adapter };
}

function adapterFor(plugin) {
  return PROVIDER_ADAPTERS.get(plugin);
}

registerProviderAdapter(cashAdapter());
registerProviderAdapter(electronicAdapter("mtn", "MTN Mobile Money"));
registerProviderAdapter(electronicAdapter("telecel", "Telecel Cash"));
registerProviderAdapter(electronicAdapter("airteltigo", "AirtelTigo Money"));
registerProviderAdapter(electronicAdapter("bank", "The bank"));
registerProviderAdapter(electronicAdapter("wallet", "Internal wallet"));
registerProviderAdapter(electronicAdapter("card", "The card processor"));
registerProviderAdapter(electronicAdapter("qr", "The QR provider"));

export function ensurePaymentState(state = {}) {
  PAYMENT_ARRAYS.forEach((key) => {
    state[key] = state[key] || [];
  });
  ensurePaymentLifecycleState(state);
  if (!state.paymentMethods.length) state.paymentMethods = seedMethods();
  if (!state.paymentProviders.length) state.paymentProviders = seedProviders();
  state.paymentProviders.forEach((provider) => {
    if (!healthRow(state, provider.id)) {
      state.providerHealth.push({
        id: `ph-${provider.id}`,
        providerId: provider.id,
        status: provider.status === "active" ? "healthy" : "disabled",
        consecutiveFailures: 0,
        lastSuccessAt: "",
        lastFailureAt: "",
        lastError: ""
      });
    }
  });
  if (!state.paymentLimits.length) {
    state.paymentLimits.push({
      id: "pl-default",
      scope: "system",
      dailyLimitGhs: 50000,
      velocityPerHour: 20,
      highRiskGhs: 5000
    });
  }
  return state;
}

export function enabledPaymentMethods(state) {
  ensurePaymentState(state);
  return (state.paymentMethods || []).filter((item) => item.enabled !== false).map((item) => item.name);
}

export function classifyFailure(code) {
  return FAILURE_OWNERSHIP[code] || FAILURE_OWNERSHIP.invalid_business_rules;
}

function applyStatus(state, payment, next, extras = {}) {
  return transitionPayment(state, payment, next, {
    actor: extras.actor || "Payment Engine",
    reason: extras.reason || "",
    user: extras.user,
    uid: extras.uid,
    now: extras.now,
    expectedVersion: extras.expectedVersion,
    providerId: extras.providerId,
    failover: extras.failover,
    approved: extras.approved,
    recordAudit: extras.skipAudit ? undefined : (payload) => auditPayment(state, payload.action, payload.details, extras.user, {
      entityId: payment.id,
      correlationId: payment.correlationId,
      transactionId: payment.id
    }, extras.uid)
  });
}

function methodRequiresProvider(method) {
  return method && method !== "Cash" && method !== "Cheque";
}

function providersForMethod(state, method) {
  return (state.paymentProviders || [])
    .filter((item) => item.status === "active" && (item.methods || []).includes(method))
    .sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99));
}

export function selectProvider(state, method, { allowUnhealthy = false } = {}) {
  ensurePaymentState(state);
  if (!methodRequiresProvider(method)) return providerById(state, "prov-cash");
  const candidates = providersForMethod(state, method);
  for (const provider of candidates) {
    const health = healthRow(state, provider.id);
    if (allowUnhealthy || !health || health.status !== "down") return provider;
  }
  return candidates[0] || null;
}

function recordHealth(state, providerId, ok, error, now) {
  const row = healthRow(state, providerId);
  if (!row) return;
  if (ok) {
    row.status = "healthy";
    row.consecutiveFailures = 0;
    row.lastSuccessAt = nowIso(now);
    row.lastError = "";
    return;
  }
  row.consecutiveFailures = Number(row.consecutiveFailures || 0) + 1;
  row.lastFailureAt = nowIso(now);
  row.lastError = error || "provider failure";
  row.status = row.consecutiveFailures >= 3 ? "down" : "degraded";
}

function paymentById(state, id) {
  return (state.paymentTransactions || []).find((item) => item.id === id);
}

function paymentByBusiness(state, businessType, businessId) {
  return (state.paymentTransactions || []).find((item) => item.businessType === businessType && item.businessId === businessId);
}

function freezeOriginal(payment) {
  if (payment.originalSnapshot) return;
  payment.originalSnapshot = cloneFrozen({
    id: payment.id,
    amount: payment.amount,
    amountPesewas: payment.amountPesewas,
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference,
    status: payment.status,
    providerId: payment.providerId,
    correlationId: payment.correlationId
  });
}

export function validatePaymentRequest(state, request = {}) {
  ensurePaymentState(state);
  if (containsForbiddenCredentials(request)) {
    return {
      ok: false,
      error: "The application must never request or store Mobile Money PINs or banking credentials",
      owner: FAILURE_OWNERSHIP.customer_incorrect_pin,
      boundary: "security"
    };
  }
  const method = request.paymentMethod || "Cash";
  const row = methodRow(state, method);
  if (!row) return { ok: false, error: "Unknown payment method", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  if (row.enabled === false) return { ok: false, error: `${method} is disabled`, owner: FAILURE_OWNERSHIP.invalid_business_rules };
  if (FUTURE_METHODS.has(method) && row.enabled === false) {
    return { ok: false, error: `${method} is future-ready and not enabled`, owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }
  if (!PAYMENT_TYPES.includes(request.paymentType || "savings_deposit")) {
    return { ok: false, error: "Unknown payment type", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }
  const amount = Number(request.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  if ((request.currency || "GHS") !== "GHS") return { ok: false, error: "Currency must stay GHS", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  if (isWalletPaymentMethod(method) && isFeatureEnabled(state, "enableMobileMoney") === false) {
    return { ok: false, error: "Mobile Money is disabled", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }
  if (method !== "Cash" && method !== "Cheque" && !String(request.paymentReference || "").trim()) {
    return { ok: false, error: "Payment reference is required for electronic payments", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }
  const momo = verifyMomoPaymentLocally(state, {
    paymentMethod: method,
    paymentReference: request.paymentReference,
    collectionId: request.businessId || request.collectionId || ""
  });
  if (!momo.ok) return { ok: false, error: momo.error, owner: FAILURE_OWNERSHIP.duplicate_internal_transaction };
  const phone = String(request.phone || request.msisdn || "").replace(/\s+/g, "");
  if (phone && (state.paymentBlacklist || []).some((item) => item.value === phone || item.value === request.paymentReference)) {
    return { ok: false, error: "This account is blacklisted for payments", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }
  return { ok: true, method, amount };
}

function velocityCount(state, customerId, now) {
  const windowMs = 60 * 60 * 1000;
  const ts = new Date(now || Date.now()).getTime();
  return (state.paymentTransactions || []).filter((item) =>
    item.customerId === customerId
    && ["failed", "cancelled", "expired"].indexOf(item.status) < 0
    && ts - Date.parse(item.createdAt || 0) <= windowMs
  ).length;
}

function dailyTotalGhs(state, customerId, now) {
  const day = nowIso(now).slice(0, 10);
  return (state.paymentTransactions || [])
    .filter((item) => item.customerId === customerId && String(item.createdAt || "").slice(0, 10) === day && item.status !== "failed" && item.status !== "cancelled")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function applyFraudFlags(state, payment, request, now) {
  const limits = state.paymentLimits[0] || {};
  const velocity = Number(getConfigValue(state, "payment.velocityPerHour") ?? limits.velocityPerHour ?? 20);
  const daily = Number(getConfigValue(state, "payment.dailyLimitGhs") ?? limits.dailyLimitGhs ?? 50000);
  const highRisk = Number(getConfigValue(state, "payment.highRiskGhs") ?? limits.highRiskGhs ?? 5000);
  const flags = [];
  if (velocityCount(state, payment.customerId, now) >= velocity) flags.push("velocity_limit");
  if (dailyTotalGhs(state, payment.customerId, now) + Number(payment.amount || 0) > daily) flags.push("daily_limit");
  if (Number(payment.amount || 0) >= highRisk) flags.push("high_risk_amount");
  const recent = (state.paymentTransactions || []).find((item) =>
    item.id !== payment.id
    && item.customerId === payment.customerId
    && Number(item.amount) === Number(payment.amount)
    && item.paymentMethod === payment.paymentMethod
    && Date.parse(nowIso(now)) - Date.parse(item.createdAt || 0) < 60000
  );
  if (recent) flags.push("suspicious_repeat");
  payment.fraudFlags = flags;
  payment.requiresApproval = flags.includes("high_risk_amount") && methodRequiresProvider(payment.paymentMethod);
  return flags;
}

function enqueuePayment(state, payment, uid, now) {
  const existing = (state.paymentQueue || []).find((item) => item.paymentId === payment.id);
  if (existing) return existing;
  const row = {
    id: newId("pq", uid),
    paymentId: payment.id,
    status: payment.status === "completed" ? "completed" : (methodRequiresProvider(payment.paymentMethod) ? "pending" : "completed"),
    attempts: 0,
    nextAttemptAt: nowIso(now),
    createdAt: nowIso(now)
  };
  state.paymentQueue.push(row);
  return row;
}

export function initiatePayment(state, request = {}, user, uid, now) {
  now = nowMs(now);
  ensurePaymentState(state);
  const check = validatePaymentRequest(state, request);
  if (!check.ok) {
    logActivity(state, "Payment rejected", check.error, { owner: check.owner, now }, uid);
    auditPayment(state, "Payment rejected", check.error, user, { result: "Validation Failed", correlationId: request.correlationId }, uid);
    return check;
  }
  if (request.businessType && request.businessId) {
    const existing = paymentByBusiness(state, request.businessType, request.businessId);
    if (existing) return { ok: true, duplicate: true, payment: existing };
  }
  const idempotencyKey = request.idempotencyKey || `pay:${request.businessType || "misc"}:${request.businessId || newId("paykey", uid)}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey,
    operationType: "payment.initiate",
    fingerprint: {
      operationType: "payment.initiate",
      customerId: request.customerId || "",
      amount: check.amount,
      date: request.date || nowIso(now).slice(0, 10),
      paymentMethod: check.method,
      externalReference: request.paymentReference || ""
    },
    source: "payment-engine",
    userId: user?.id || "",
    now
  }, uid);
  if (gate.duplicate) {
    const payment = paymentById(state, gate.record?.transactionId) || (state.paymentTransactions || []).find((item) => item.idempotencyKey === idempotencyKey);
    return { ok: true, duplicate: true, payment, owner: FAILURE_OWNERSHIP.duplicate_internal_transaction };
  }
  if (!gate.proceed) {
    return { ok: false, error: gate.error || "Payment is already processing", owner: FAILURE_OWNERSHIP.duplicate_internal_transaction };
  }

  const provider = selectProvider(state, check.method);
  if (methodRequiresProvider(check.method) && !provider) {
    failIdempotentRequest(state, idempotencyKey, { recoverable: true, error: "No active provider", now });
    return { ok: false, error: "No active payment provider for this method", owner: FAILURE_OWNERSHIP.network_outage };
  }
  const adapter = adapterFor(provider?.plugin || "cash");
  if (!adapter) {
    failIdempotentRequest(state, idempotencyKey, { recoverable: false, error: "Missing adapter", now });
    return { ok: false, error: "Provider adapter is not registered", owner: FAILURE_OWNERSHIP.invalid_business_rules };
  }

  const correlationId = request.correlationId || newId("paycorr", uid);
  const payment = {
    id: newId("pay", uid),
    paymentType: request.paymentType || "savings_deposit",
    paymentMethod: check.method,
    amount: check.amount,
    amountPesewas: toPesewas(check.amount),
    currency: "GHS",
    status: "created",
    transactionStatus: "pending",
    version: 1,
    customerId: request.customerId || "",
    branchId: request.branchId || "",
    groupId: request.groupId || "",
    businessType: request.businessType || "",
    businessId: request.businessId || request.collectionId || "",
    paymentReference: String(request.paymentReference || "").trim(),
    providerId: provider?.id || "prov-cash",
    providerRef: "",
    correlationId,
    idempotencyKey,
    phone: String(request.phone || "").trim(),
    createdBy: user?.id || "",
    createdAt: nowIso(now),
    completedAt: "",
    failureOwner: "",
    fraudFlags: [],
    requiresApproval: false,
    accountingPosted: Boolean(request.accountingAlreadyPosted),
    accountingStatus: request.accountingAlreadyPosted ? "posted" : "pending",
    originalSnapshot: null,
    statusHistory: []
  };
  applyFraudFlags(state, payment, request, now);
  executeWorkflowStage(state, "create_record", "Payment Engine", () => ({ ok: true }), { paymentId: payment.id, correlationId, uid, now });
  state.paymentTransactions.push(payment);
  const validated = applyStatus(state, payment, "validated", { user, uid, now, reason: "business_rules" });
  if (!validated.ok) return validated;
  const routed = applyStatus(state, payment, "pending_provider", { user, uid, now, reason: methodRequiresProvider(check.method) ? "provider_routing" : "internal_cash" });
  if (!routed.ok) return routed;

  const outbound = adapter.initiate({ payment, provider, request });
  state.paymentAttempts.push({
    id: newId("pa", uid),
    paymentId: payment.id,
    providerId: provider?.id || "",
    status: outbound.ok ? "sent" : "failed",
    message: outbound.message || outbound.error || "",
    createdAt: nowIso(now)
  });
  if (!outbound.ok) {
    applyStatus(state, payment, "failed", { user, uid, now, reason: outbound.error || "provider_error" });
    payment.failureOwner = outbound.owner || FAILURE_OWNERSHIP.provider_rejects;
    recordHealth(state, provider.id, false, outbound.error, now);
    failIdempotentRequest(state, idempotencyKey, { recoverable: true, error: outbound.error, now });
    logActivity(state, "Provider request failed", outbound.error, { paymentId: payment.id, owner: payment.failureOwner, now }, uid);
    return { ok: false, error: outbound.error, payment, owner: payment.failureOwner };
  }

  if (outbound.status === "completed" && methodRequiresProvider(check.method)) {
    applyStatus(state, payment, "failed", { user, uid, now, reason: "simulated_provider_approval" });
    payment.failureOwner = FAILURE_OWNERSHIP.invalid_business_rules;
    failIdempotentRequest(state, idempotencyKey, { recoverable: false, error: "Electronic adapter attempted to complete without provider confirmation", now });
    return { ok: false, error: "Payment Engine must not simulate provider approval", payment, owner: payment.failureOwner };
  }

  if (outbound.status === "completed" && !methodRequiresProvider(check.method)) {
    const processing = applyStatus(state, payment, "processing", { user, uid, now, reason: "internal_confirmation" });
    if (!processing.ok) return processing;
    const completed = applyStatus(state, payment, "completed", { user, uid, now, reason: "cash_accepted" });
    if (!completed.ok) return completed;
    if (payment.accountingPosted) markAccountingPosted(state, payment, "Accounting Engine");
  }
  recordHealth(state, provider.id, true, "", now);
  const queue = enqueuePayment(state, payment, uid, now);
  if (payment.status === "pending_provider") queue.status = "awaiting_provider";
  if (payment.status === "completed") queue.status = "completed";

  if (payment.paymentReference) {
    linkExternalReference(state, {
      system: provider?.name || check.method,
      value: payment.paymentReference,
      internalId: payment.id,
      internalType: "payment"
    }, uid);
  }

  completeIdempotentRequest(state, idempotencyKey, {
    transactionId: payment.id,
    responsePayload: { paymentId: payment.id, status: payment.status }
  }, { source: "payment-engine", now });

  auditPayment(state, "Payment initiated", `${check.method} · GHS ${check.amount} · ${payment.status}`, user, {
    entityId: payment.id,
    correlationId,
    transactionId: payment.id
  }, uid);
  logActivity(state, "Payment initiated", payment.status, { paymentId: payment.id, now }, uid);

  if (payment.status === "completed") {
    queueNotification(state, {
      event: "payment_completed",
      channel: "In-App",
      customerId: payment.customerId,
      userId: user?.id || "",
      vars: { name: request.customerName || "", amount: Number(payment.amount).toFixed(2), receiptNo: payment.paymentReference || payment.id },
      uid,
      idempotencyKey: `${payment.id}:payment_completed`,
      correlationId,
      committed: true
    });
  }

  return { ok: true, payment, queue, provider, outbound };
}

export function registerBusinessPayment(state, request, user, uid, now) {
  return initiatePayment(state, {
    ...request,
    accountingAlreadyPosted: request.accountingAlreadyPosted !== false
  }, user, uid, now);
}

function timestampFresh(timestamp, now, windowSeconds) {
  const ts = Date.parse(timestamp || "");
  if (!Number.isFinite(ts)) return false;
  return Math.abs(new Date(now || Date.now()).getTime() - ts) <= windowSeconds * 1000;
}

export function processPaymentCallback(state, envelope = {}, { user, uid, now, verifiedBy = "callback" } = {}) {
  now = nowMs(now);
  ensurePaymentState(state);
  const providerId = envelope.providerId || "";
  const provider = providerById(state, providerId) || selectProvider(state, envelope.paymentMethod || "Mobile Money", { allowUnhealthy: true });
  if (!provider) return { ok: false, error: "Unknown payment provider", owner: FAILURE_OWNERSHIP.provider_rejects };
  if (envelope.sourceIp && Array.isArray(provider.ipAllowlist) && provider.ipAllowlist.length && !provider.ipAllowlist.includes(envelope.sourceIp)) {
    return { ok: false, error: "Callback source is not allowlisted", owner: FAILURE_OWNERSHIP.provider_rejects };
  }
  const windowSeconds = Number(getConfigValue(state, "payment.callbackWindowSeconds") ?? 300);
  if (envelope.timestamp && !timestampFresh(envelope.timestamp, now, windowSeconds)) {
    return { ok: false, error: "Callback timestamp is outside the replay window", owner: FAILURE_OWNERSHIP.duplicate_callback };
  }
  const secret = envelope.secret || state.settings?.momoWebhookSecret || (state.providerCredentials || []).find((item) => item.providerId === provider.id)?.secret || "";
  const signed = verifyPaymentSignature(secret, envelope.body || envelope, envelope.timestamp || "", envelope.signature);
  if (!signed.ok) return { ok: false, error: signed.error, owner: FAILURE_OWNERSHIP.provider_rejects };

  if (containsForbiddenCredentials(envelope.body || envelope)) {
    return { ok: false, error: "Callback must not include customer PINs or banking passwords", owner: FAILURE_OWNERSHIP.customer_incorrect_pin };
  }

  const adapter = adapterFor(provider.plugin);
  const parsed = adapter?.parseCallback?.(envelope.body || envelope) || parseMomoWebhookPayload(envelope.body || envelope);
  const reference = parsed.reference || envelope.reference || "";
  const key = `callback:${provider.id}:${normalizeWebhookReference(reference)}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "payment.callback",
    fingerprint: {
      operationType: "payment.callback",
      externalReference: reference,
      amount: parsed.amount,
      amountPesewas: parsed.amountPesewas,
      paymentMethod: provider.name
    },
    source: "payment-callback",
    now
  }, uid);
  if (gate.duplicate) {
    const payment = paymentById(state, gate.record?.transactionId)
      || (state.paymentTransactions || []).find((item) => normalizeMomoReference(item.paymentReference) === normalizeWebhookReference(reference));
    return { ok: true, duplicate: true, payment, owner: FAILURE_OWNERSHIP.duplicate_callback };
  }
  if (!gate.proceed) {
    return { ok: false, error: gate.error, duplicate: Boolean(gate.processing), owner: FAILURE_OWNERSHIP.duplicate_callback };
  }

  const callbackRow = {
    id: newId("pcb", uid),
    providerId: provider.id,
    reference,
    correlationId: envelope.correlationId || "",
    status: parsed.status,
    signatureOk: true,
    payload: parsed.raw || envelope.body || {},
    createdAt: nowIso(now)
  };
  state.paymentCallbacks.push(callbackRow);

  let payment = (state.paymentTransactions || []).find((item) =>
    normalizeMomoReference(item.paymentReference) === normalizeWebhookReference(reference)
    || item.correlationId === envelope.correlationId
  );
  const success = ["success", "successful", "completed", "paid", "authorized"].includes(String(parsed.status || "").toLowerCase());

  let collectionResult = null;
  if (isWalletPaymentMethod(provider.methods?.[0] || "") || /mtn|telecel|airteltigo|momo/i.test(provider.plugin || "")) {
    collectionResult = processMomoCallback(state, {
      reference,
      amount: parsed.amount,
      amountPesewas: parsed.amountPesewas,
      phone: parsed.phone,
      provider: provider.name,
      status: success ? "success" : parsed.status
    }, { verifiedBy, uid, now });
  }

  if (!payment && collectionResult?.collection) {
    const registered = registerBusinessPayment(state, {
      paymentType: "savings_deposit",
      paymentMethod: collectionResult.collection.paymentMethod || "Mobile Money",
      amount: collectionResult.collection.amount,
      customerId: collectionResult.collection.customerId,
      businessType: "collection",
      businessId: collectionResult.collection.id,
      paymentReference: collectionResult.collection.paymentReference,
      accountingAlreadyPosted: true
    }, user, uid, now);
    payment = registered.payment;
  }

  if (!payment) {
    failIdempotentRequest(state, key, { recoverable: true, error: "No matching payment", now });
    logActivity(state, "Unmatched callback", reference, { owner: FAILURE_OWNERSHIP.provider_rejects, now }, uid);
    return { ok: false, error: "No matching payment or collection", callback: callbackRow, owner: FAILURE_OWNERSHIP.provider_rejects };
  }

  freezeOriginal(payment);
  const previousStatus = canonicalPaymentStatus(payment.status);
  if (isTerminalPaymentStatus(previousStatus) || previousStatus === "completed" || previousStatus === "partially_refunded" || previousStatus === "fully_refunded") {
    completeIdempotentRequest(state, key, {
      transactionId: payment.id,
      responsePayload: { paymentId: payment.id, status: payment.status }
    }, { source: "payment-callback", now });
    return { ok: true, duplicate: true, payment, callback: callbackRow, owner: FAILURE_OWNERSHIP.duplicate_callback };
  }
  if (success && payment.businessType === "collection" && payment.businessId) {
    const collection = (state.collections || []).find((item) => item.id === payment.businessId);
    if (collection && collection.verificationStatus !== "Verified") {
      collection.verificationStatus = "Verified";
      collection.momoVerifiedAt = nowIso(now);
      collection.momoVerifiedBy = verifiedBy;
    }
  }
  if (success) {
    payment.providerRef = parsed.providerRef || reference;
    if (previousStatus === "pending_provider") {
      const authorized = applyStatus(state, payment, "authorized", { user, uid, now, reason: "provider_callback", providerId: provider.id });
      if (!authorized.ok) return authorized;
    }
    const current = canonicalPaymentStatus(payment.status);
    if (current === "authorized" || current === "pending_provider") {
      const processing = applyStatus(state, payment, current === "pending_provider" ? "processing" : "processing", { user, uid, now, reason: "internal_confirmation", providerId: provider.id });
      if (!processing.ok) return processing;
    }
    const completed = applyStatus(state, payment, "completed", { user, uid, now, reason: "provider_confirmed", providerId: provider.id });
    if (!completed.ok) return completed;
    if (payment.accountingPosted) markAccountingPosted(state, payment, "Accounting Engine");
  } else {
    const failed = applyStatus(state, payment, "failed", { user, uid, now, reason: parsed.status || "provider_rejected", providerId: provider.id });
    if (!failed.ok) return failed;
    payment.failureOwner = FAILURE_OWNERSHIP.provider_rejects;
  }
  const queue = (state.paymentQueue || []).find((item) => item.paymentId === payment.id);
  if (queue) queue.status = success ? "completed" : "failed";

  completeIdempotentRequest(state, key, {
    transactionId: payment.id,
    responsePayload: { paymentId: payment.id, status: payment.status }
  }, { source: "payment-callback", now });

  auditPayment(state, success ? "Payment callback completed" : "Payment callback failed", `${provider.name} · ${reference}`, user, {
    entityId: payment.id,
    correlationId: payment.correlationId,
    transactionId: payment.id
  }, uid);
  logActivity(state, "Callback processed", `${previousStatus} → ${payment.status}`, { paymentId: payment.id, owner: FAILURE_OWNERSHIP.duplicate_callback, now }, uid);

  if (success) {
    queueNotification(state, {
      event: "payment_completed",
      channel: "In-App",
      customerId: payment.customerId,
      userId: user?.id || "",
      vars: { name: "", amount: Number(payment.amount).toFixed(2), receiptNo: payment.paymentReference || payment.id },
      uid,
      idempotencyKey: `${payment.id}:payment_completed`,
      correlationId: payment.correlationId,
      committed: true
    });
  } else {
    queueNotification(state, {
      event: "payment_failed",
      channel: "In-App",
      customerId: payment.customerId,
      userId: user?.id || "",
      vars: { name: "", amount: Number(payment.amount).toFixed(2), receiptNo: payment.paymentReference || payment.id },
      uid,
      idempotencyKey: `${payment.id}:payment_failed`,
      correlationId: payment.correlationId,
      committed: true
    });
  }

  return { ok: true, payment, callback: callbackRow, collection: collectionResult?.collection || null, duplicateCollection: Boolean(collectionResult?.duplicate) };
}

export function processPaymentQueue(state, { uid, now, user } = {}) {
  ensurePaymentState(state);
  const ts = new Date(now || Date.now()).getTime();
  let processed = 0;
  let recovered = 0;
  (state.paymentQueue || []).forEach((item) => {
    if (item.status === "processing" && Date.parse(item.processingAt || 0) < ts - 30000) {
      item.status = "retrying";
      recovered += 1;
    }
    if (!["pending", "awaiting_provider", "retrying"].includes(item.status)) return;
    if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > ts) return;
    const payment = paymentById(state, item.paymentId);
    if (!payment) {
      item.status = "dead_letter";
      return;
    }
    if (canonicalPaymentStatus(payment.status) === "completed" || canonicalPaymentStatus(payment.status) === "cancelled") {
      item.status = "completed";
      return;
    }
    item.status = "processing";
    item.processingAt = nowIso(now);
    item.attempts = Number(item.attempts || 0) + 1;
    processed += 1;
    const provider = providerById(state, payment.providerId);
    const health = healthRow(state, payment.providerId);
    if (health?.status === "down") {
      const failover = selectProvider(state, payment.paymentMethod);
      if (failover && failover.id !== payment.providerId) {
        payment.providerId = failover.id;
        logActivity(state, "Provider failover", `${provider?.name || ""} → ${failover.name}`, { paymentId: payment.id, owner: FAILURE_OWNERSHIP.network_outage, now }, uid);
        recordAuditEvent(state, {
          action: "Payment provider failover",
          details: `${payment.id} moved to ${failover.name}`,
          userId: user?.id || "",
          category: "financial",
          module: "16",
          entityId: payment.id,
          guarantee: "G1"
        }, uid);
      }
    }
    const retry = provider?.retryPolicy || defaultRetryPolicy();
    if (item.attempts > Number(retry.maxAttempts || 5)) {
      item.status = "dead_letter";
      applyStatus(state, payment, "failed", { user, uid, now, reason: "provider_timeout" });
      payment.failureOwner = FAILURE_OWNERSHIP.provider_timeout;
      return;
    }
    if (canonicalPaymentStatus(payment.status) === "pending_provider") {
      item.status = "callback_pending";
      item.nextAttemptAt = new Date(ts + Number(retry.backoffMs || 1000) * (2 ** Math.min(item.attempts, 6))).toISOString();
      return;
    }
    item.status = "retrying";
    item.nextAttemptAt = new Date(ts + Number(retry.backoffMs || 1000) * item.attempts).toISOString();
  });
  return { ok: true, processed, recovered };
}

function assertMutableLink(original) {
  if (!original) return { ok: false, error: "Original payment not found" };
  const status = canonicalPaymentStatus(original.status);
  if (["completed", "partially_refunded", "partially_reversed"].includes(status)) return { ok: true };
  if (isTerminalPaymentStatus(status) && status !== "fully_refunded" && status !== "fully_reversed") {
    return { ok: false, error: "Only successful payments can be refunded or reversed" };
  }
  return { ok: false, error: "Payment is not in a completed state" };
}

function linkedAmount(original, amount, partial, already = 0) {
  const remaining = +(Number(original.amount) - Number(already || 0)).toFixed(2);
  const value = partial ? Number(amount) : remaining;
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter a valid amount" };
  if (value - remaining > 0.009) return { error: "Amount cannot exceed the original payment" };
  return { amount: value, amountPesewas: toPesewas(value), remaining };
}

export function createRefund(state, paymentId, { amount, reason = "", partial = false, user, uid, now, online = true } = {}) {
  ensurePaymentState(state);
  const original = paymentById(state, paymentId);
  const gate = assertMutableLink(original);
  if (!gate.ok) return gate;
  const already = (state.paymentRefunds || []).filter((item) => item.paymentId === original.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const money = linkedAmount(original, amount, partial, already);
  if (money.error) return { ok: false, error: money.error };
  freezeOriginal(original);
  const snapshot = cloneFrozen(original.originalSnapshot);
  const refund = {
    id: newId("prf", uid),
    paymentId: original.id,
    amount: money.amount,
    amountPesewas: money.amountPesewas,
    partial: Boolean(partial) && money.amount < Number(original.amount),
    reason,
    status: "completed",
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.paymentRefunds.push(refund);
  original.linkedRefundIds = [...(original.linkedRefundIds || []), refund.id];
  const refundedTotal = (state.paymentRefunds || []).filter((item) => item.paymentId === original.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const nextStatus = refundedTotal + 0.009 >= Number(original.amount) ? "fully_refunded" : "partially_refunded";
  const moved = applyStatus(state, original, nextStatus, { user, uid, now, reason: reason || "refund" });
  if (!moved.ok) return moved;
  if (JSON.stringify(original.originalSnapshot) !== JSON.stringify(snapshot)) {
    original.originalSnapshot = snapshot;
  }
  auditPayment(state, "Payment refund recorded", `${original.id} · GHS ${money.amount}`, user, {
    entityId: refund.id,
    transactionId: original.id,
    correlationId: original.correlationId
  }, uid);
  queueNotification(state, {
    event: "payment_refunded",
    channel: "In-App",
    customerId: original.customerId,
    userId: user?.id || "",
    vars: { name: "", amount: money.amount.toFixed(2), receiptNo: original.paymentReference || original.id },
    uid,
    idempotencyKey: `${refund.id}:payment_refunded`,
    correlationId: original.correlationId,
    committed: true
  });
  logActivity(state, "Refund recorded", reason || "refund", { paymentId: original.id, now }, uid);
  return { ok: true, refund, payment: original, originalSnapshot: original.originalSnapshot, online };
}

export function createReversal(state, paymentId, { amount, reason = "", partial = false, user, uid, now } = {}) {
  ensurePaymentState(state);
  const original = paymentById(state, paymentId);
  const gate = assertMutableLink(original);
  if (!gate.ok) return gate;
  const already = (state.paymentReversals || []).filter((item) => item.paymentId === original.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const money = linkedAmount(original, amount, partial, already);
  if (money.error) return { ok: false, error: money.error };
  freezeOriginal(original);
  const snapshot = cloneFrozen(original.originalSnapshot);
  const reversal = {
    id: newId("prv", uid),
    paymentId: original.id,
    amount: money.amount,
    amountPesewas: money.amountPesewas,
    partial: Boolean(partial) && money.amount < Number(original.amount),
    reason,
    status: "completed",
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.paymentReversals.push(reversal);
  original.linkedReversalIds = [...(original.linkedReversalIds || []), reversal.id];
  const reversedTotal = (state.paymentReversals || []).filter((item) => item.paymentId === original.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const nextStatus = reversedTotal + 0.009 >= Number(original.amount) ? "fully_reversed" : "partially_reversed";
  const moved = applyStatus(state, original, nextStatus, { user, uid, now, reason: reason || "reversal" });
  if (!moved.ok) return moved;
  if (JSON.stringify(original.originalSnapshot) !== JSON.stringify(snapshot)) {
    original.originalSnapshot = snapshot;
  }
  auditPayment(state, "Payment reversal recorded", `${original.id} · GHS ${money.amount}`, user, {
    entityId: reversal.id,
    transactionId: original.id,
    correlationId: original.correlationId
  }, uid);
  logActivity(state, "Reversal recorded", reason || "reversal", { paymentId: original.id, now }, uid);
  return { ok: true, reversal, payment: original, originalSnapshot: original.originalSnapshot };
}

export function cancelPayment(state, paymentId, extras = {}) {
  ensurePaymentState(state);
  const payment = paymentById(state, paymentId);
  if (!payment) return { ok: false, error: "Payment not found" };
  return applyStatus(state, payment, "cancelled", extras);
}

export function expirePayment(state, paymentId, extras = {}) {
  ensurePaymentState(state);
  const payment = paymentById(state, paymentId);
  if (!payment) return { ok: false, error: "Payment not found" };
  return applyStatus(state, payment, "expired", extras);
}

export function recordSettlement(state, patch = {}, user, uid, now) {
  ensurePaymentState(state);
  const gross = Number(patch.grossAmount ?? patch.gross ?? 0);
  const fees = Number(patch.fees || 0);
  const taxes = Number(patch.taxes || 0);
  const net = Number(patch.netSettlement ?? patch.net ?? (gross - fees - taxes));
  const row = {
    id: newId("stl", uid),
    providerId: patch.providerId || "",
    grossAmount: gross,
    fees,
    taxes,
    netSettlement: net,
    settlementDate: patch.settlementDate || nowIso(now).slice(0, 10),
    settlementReference: patch.settlementReference || "",
    status: patch.status || "pending",
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.settlements.push(row);
  auditPayment(state, "Settlement recorded", `${row.settlementReference || row.id} · net GHS ${net}`, user, {
    entityId: row.id,
    entityType: "settlement"
  }, uid);
  return { ok: true, settlement: row };
}

export function reconcilePayments(state, { source = "provider", lines = [], user, uid, now } = {}) {
  ensurePaymentState(state);
  const matches = [];
  const exceptions = [];
  (lines || []).forEach((line) => {
    const ref = normalizeWebhookReference(line.reference || line.providerRef || "");
    const amount = Number(line.amount || 0);
    const payment = (state.paymentTransactions || []).find((item) =>
      normalizeMomoReference(item.paymentReference) === ref
      || normalizeMomoReference(item.providerRef) === ref
    );
    if (!payment) {
      exceptions.push({ ...line, reason: "unmatched_provider_line" });
      return;
    }
    if (Math.abs(Number(payment.amount) - amount) > 0.009) {
      exceptions.push({ ...line, paymentId: payment.id, reason: "amount_mismatch", internalAmount: payment.amount });
      return;
    }
    matches.push({ paymentId: payment.id, reference: ref, amount });
  });
  const row = {
    id: newId("rec", uid),
    source,
    matched: matches.length,
    exceptions: exceptions.length,
    lines: matches,
    exceptionLines: exceptions,
    createdBy: user?.id || "",
    createdAt: nowIso(now)
  };
  state.paymentReconciliation.push(row);
  auditPayment(state, "Payment reconciliation", `${matches.length} matched · ${exceptions.length} exceptions`, user, {
    entityId: row.id,
    entityType: "reconciliation"
  }, uid);
  return { ok: true, reconciliation: row, matches, exceptions };
}

export function upsertProvider(state, patch = {}, user, uid, now) {
  ensurePaymentState(state);
  if (!isSystemOwner(user) && user?.role !== ROLE.SUPER_ADMIN && user?.role !== ROLE.DEVELOPER && user?.role !== "KBA") {
    return { error: "Only privileged administrators can change payment providers" };
  }
  let row = providerById(state, patch.id);
  if (!row) {
    row = {
      id: patch.id || newId("prov", uid),
      name: patch.name || "Provider",
      methods: patch.methods || [],
      authMethod: patch.authMethod || "hmac",
      callbackUrl: patch.callbackUrl || "",
      timeoutMs: Number(patch.timeoutMs || 30000),
      retryPolicy: patch.retryPolicy || defaultRetryPolicy(),
      settlementRules: patch.settlementRules || "t-plus-1",
      currencies: patch.currencies || ["GHS"],
      status: patch.status || "active",
      priority: Number(patch.priority ?? 50),
      plugin: patch.plugin || "mtn",
      ipAllowlist: patch.ipAllowlist || []
    };
    if (row.callbackUrl && !isHttpsUrl(row.callbackUrl) && !row.callbackUrl.startsWith("/")) {
      return { error: "Callback URL must use TLS" };
    }
    state.paymentProviders.push(row);
  } else {
    Object.assign(row, {
      name: patch.name ?? row.name,
      methods: patch.methods ?? row.methods,
      status: patch.status ?? row.status,
      priority: patch.priority ?? row.priority,
      timeoutMs: patch.timeoutMs ?? row.timeoutMs,
      callbackUrl: patch.callbackUrl ?? row.callbackUrl,
      retryPolicy: patch.retryPolicy ?? row.retryPolicy
    });
  }
  auditPayment(state, "Payment provider updated", row.name, user, { entityId: row.id, entityType: "provider", category: "configuration" }, uid);
  return { ok: true, provider: row };
}

export function setPaymentMethodEnabled(state, methodId, enabled, user, uid) {
  ensurePaymentState(state);
  const row = methodRow(state, methodId);
  if (!row) return { error: "Unknown payment method" };
  row.enabled = Boolean(enabled);
  auditPayment(state, "Payment method updated", `${row.name} · ${row.enabled ? "enabled" : "disabled"}`, user, {
    entityId: row.id,
    entityType: "payment_method",
    category: "configuration"
  }, uid);
  return { ok: true, method: row };
}

export function upsertProviderCredential(state, { providerId, keyName = "secret", secret = "" } = {}, user, uid, now) {
  ensurePaymentState(state);
  if (!secret) return { error: "Secret is required" };
  const existing = (state.providerCredentials || []).find((item) => item.providerId === providerId && item.keyName === keyName);
  const stored = {
    id: existing?.id || newId("pcred", uid),
    providerId,
    keyName,
    secret,
    fingerprint: payloadHash(secret).slice(0, 8),
    rotatedAt: nowIso(now),
    clientForbidden: true
  };
  if (existing) Object.assign(existing, stored);
  else state.providerCredentials.push(stored);
  auditPayment(state, "Provider credential rotated", keyName, user, { entityId: providerId, category: "security" }, uid);
  return { ok: true, credential: { id: stored.id, providerId, keyName, fingerprint: stored.fingerprint, clientForbidden: true } };
}

export function addPaymentBlacklist(state, value, user, uid) {
  ensurePaymentState(state);
  const row = { id: newId("pbl", uid), value: String(value || "").trim(), createdBy: user?.id || "", createdAt: nowIso() };
  state.paymentBlacklist.push(row);
  return row;
}

export function searchPayments(state, query = {}) {
  ensurePaymentState(state);
  const q = String(query.q || "").trim().toLowerCase();
  return (state.paymentTransactions || []).filter((item) => {
    if (query.status && item.status !== query.status) return false;
    if (query.method && item.paymentMethod !== query.method) return false;
    if (query.providerId && item.providerId !== query.providerId) return false;
    if (query.paymentType && item.paymentType !== query.paymentType) return false;
    if (!q) return true;
    return [item.id, item.paymentReference, item.providerRef, item.correlationId, item.customerId, item.businessId]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function paymentDashboard(state, { date = "" } = {}) {
  ensurePaymentState(state);
  const day = date || nowIso().slice(0, 10);
  const rows = state.paymentTransactions || [];
  const todayRows = rows.filter((item) => String(item.createdAt || "").slice(0, 10) === day);
  const byMethod = {};
  todayRows.forEach((item) => {
    byMethod[item.paymentMethod] = (byMethod[item.paymentMethod] || 0) + Number(item.amount || 0);
  });
  const queue = state.paymentQueue || [];
  return {
    todayCount: todayRows.length,
    todayAmount: todayRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pending: rows.filter((item) => ["created", "initiated", "validated", "pending_provider", "pending_customer_authorization", "authorized", "processing"].includes(canonicalPaymentStatus(item.status))).length,
    failed: rows.filter((item) => item.status === "failed").length,
    completed: rows.filter((item) => item.status === "completed").length,
    refunds: (state.paymentRefunds || []).length,
    reversals: (state.paymentReversals || []).length,
    unmatchedCallbacks: (state.paymentCallbacks || []).length,
    deadLetters: queue.filter((item) => item.status === "dead_letter").length,
    queuePending: queue.filter((item) => ["pending", "awaiting_provider", "callback_pending", "retrying"].includes(item.status)).length,
    byMethod,
    providersDown: (state.providerHealth || []).filter((item) => item.status === "down").length
  };
}

export function paymentReports(state, reportId, range = {}) {
  ensurePaymentState(state);
  const from = range.from || "0000-01-01";
  const to = range.to || "9999-12-31";
  const inRange = (row) => {
    const day = String(row.createdAt || row.settlementDate || row.date || "").slice(0, 10);
    return day >= from && day <= to;
  };
  const payments = (state.paymentTransactions || []).filter(inRange);
  const table = (columns, rows) => ({ columns, rows, reportId });
  if (reportId === "payments_daily" || reportId === "payments_collections") {
    return table(["createdAt", "paymentMethod", "amount", "status", "paymentReference"], payments);
  }
  if (reportId === "payments_momo") {
    return table(["createdAt", "paymentMethod", "amount", "status", "paymentReference"], payments.filter((item) => isWalletPaymentMethod(item.paymentMethod)));
  }
  if (reportId === "payments_bank") {
    return table(["createdAt", "paymentMethod", "amount", "status", "paymentReference"], payments.filter((item) => /bank/i.test(item.paymentMethod)));
  }
  if (reportId === "payments_failed") {
    return table(["createdAt", "paymentMethod", "amount", "failureOwner", "paymentReference"], payments.filter((item) => item.status === "failed"));
  }
  if (reportId === "payments_refunds") {
    return table(["createdAt", "paymentId", "amount", "reason"], (state.paymentRefunds || []).filter(inRange));
  }
  if (reportId === "payments_reversals") {
    return table(["createdAt", "paymentId", "amount", "reason"], (state.paymentReversals || []).filter(inRange));
  }
  if (reportId === "payments_settlement") {
    return table(["settlementDate", "providerId", "grossAmount", "fees", "netSettlement", "status"], (state.settlements || []).filter(inRange));
  }
  if (reportId === "payments_outstanding_settlements") {
    return table(["settlementDate", "providerId", "netSettlement", "status"], (state.settlements || []).filter((item) => item.status !== "settled"));
  }
  if (reportId === "payments_reconciliation") {
    return table(["createdAt", "source", "matched", "exceptions"], (state.paymentReconciliation || []).filter(inRange));
  }
  if (reportId === "payments_provider") {
    return table(["providerId", "status", "consecutiveFailures", "lastError"], state.providerHealth || []);
  }
  if (reportId === "payments_methods") {
    const grouped = {};
    payments.forEach((item) => {
      grouped[item.paymentMethod] = grouped[item.paymentMethod] || { paymentMethod: item.paymentMethod, count: 0, amount: 0 };
      grouped[item.paymentMethod].count += 1;
      grouped[item.paymentMethod].amount += Number(item.amount || 0);
    });
    return table(["paymentMethod", "count", "amount"], Object.values(grouped));
  }
  return table(["id"], []);
}

export function exportPaymentCsv(report) {
  const columns = report.columns || [];
  const header = columns.join(",");
  const lines = (report.rows || []).map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function paymentDetail(state, id) {
  ensurePaymentState(state);
  const payment = paymentById(state, id);
  if (!payment) return null;
  return {
    payment,
    attempts: (state.paymentAttempts || []).filter((item) => item.paymentId === id),
    callbacks: (state.paymentCallbacks || []).filter((item) => normalizeWebhookReference(item.reference) === normalizeMomoReference(payment.paymentReference)),
    refunds: (state.paymentRefunds || []).filter((item) => item.paymentId === id),
    reversals: (state.paymentReversals || []).filter((item) => item.paymentId === id),
    queue: (state.paymentQueue || []).find((item) => item.paymentId === id) || null,
    history: (state.paymentStatusHistory || []).filter((item) => item.paymentId === id),
    events: (state.paymentWorkflowEvents || []).filter((item) => item.paymentId === id)
  };
}

export function assertEngineBoundary() {
  return {
    orchestrates: true,
    storesCustomerPins: false,
    simulatesProviderApproval: false,
    ownsBankLedgers: false,
    ownsMobileWallets: false,
    unsupported: UNSUPPORTED_RESPONSIBILITIES,
    trusted: TRUSTED_PAYMENT_BOUNDARY,
    external: EXTERNAL_PAYMENT_SYSTEMS
  };
}

export { isValidMomoReference };
