/**
 * Wave 1 — Foundation platform facade.
 * Thin service/domain adapters over existing auth, RBAC, tenant/branch,
 * config, audit, logging, errors, monitoring, and offline foundation.
 * Does NOT replace Modules 1–30 engines or invent a second app.
 */

import { ensurePlatformState, evaluateFeatureFlag, getTenantConfig } from "./platform-ops.js";
import { DEFAULT_TENANT_ID } from "./platform-lifecycle.js";
import { filterBranchesForUser } from "./branches.js";
import { BRANCH_STATUSES, canManageBranches, applyBranchProfile } from "./branch-ops.js";
import { ensureSystemConfig, getConfigValue, isFeatureEnabled, FEATURE_FLAG_CATALOG } from "./system-config.js";
import { recordAuditEvent } from "./audit-ops.js";
import { canAction, SUPER_ADMIN_FORBIDDEN, dataScope } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import {
  ensureMonitoringState,
  recordMetric,
  overallHealth,
  monitoringDashboard
} from "./monitoring-ops.js";
import {
  buildFoundationError,
  handleFoundationError,
  setGlobalErrorHandler,
  withFoundationErrorBoundary
} from "./foundation-errors.js";
import { logFoundation, LOG_CATEGORIES } from "./foundation-logging.js";
import {
  ensureOfflineFoundationState,
  persistOfflineQueue,
  recoverOfflineQueue,
  offlineFoundationDashboard
} from "./offline-foundation.js";
import {
  ensureAuthFoundationState,
  authenticateLocal,
  logoutLocal,
  listAuthRoles,
  assertActionAllowed
} from "./auth-session-ops.js";
import { createSecureApiClient } from "./secure-storage.js";
import { invokeContract } from "./module-contracts.js";

export const FOUNDATION_VERSION = "1.0.0";
export const FOUNDATION_WAVE = "WAVE-01";

export {
  SUPER_ADMIN_FORBIDDEN,
  LOG_CATEGORIES,
  BRANCH_STATUSES,
  buildFoundationError,
  handleFoundationError,
  setGlobalErrorHandler,
  withFoundationErrorBoundary,
  authenticateLocal,
  logoutLocal,
  listAuthRoles,
  assertActionAllowed,
  persistOfflineQueue,
  recoverOfflineQueue
};

/**
 * Domain context adapter — tenant + branch + actor + feature flags.
 */
export function resolveFoundationContext(state, actor = null, extras = {}) {
  ensureSystemConfig(state);
  ensurePlatformState(state);
  ensureAuthFoundationState(state);
  ensureOfflineFoundationState(state);
  ensureMonitoringState(state);

  const tenantId = extras.tenantId || state.settings?.tenantId || DEFAULT_TENANT_ID;
  const branchId = extras.branchId || actor?.branchId || state.settings?.activeBranchId || "";
  const allBranches = state.branches || [];
  const branches = actor ? filterBranchesForUser(allBranches, actor) : allBranches;
  const activeBranch = branches.find((b) => b.id === branchId) || branches[0] || null;

  return {
    version: FOUNDATION_VERSION,
    wave: FOUNDATION_WAVE,
    tenantId,
    branchId: activeBranch?.id || branchId || "",
    branch: activeBranch,
    actor: actor || null,
    dataScope: dataScope(actor),
    isSystemOwner: isSystemOwner(actor),
    canManageBranches: canManageBranches(actor),
    featureFlags: Object.fromEntries(
      (FEATURE_FLAG_CATALOG || []).slice(0, 40).map((flag) => {
        const id = flag.id || flag.key || flag;
        return [id, isFeatureEnabled(state, id)];
      })
    )
  };
}

/**
 * Repository-style adapters over existing state arrays (no ORM rewrite).
 */
export function createFoundationRepositories(state) {
  return {
    users: {
      list: () => state.users || [],
      getById: (id) => (state.users || []).find((u) => u.id === id) || null
    },
    branches: {
      list: (actor) => filterBranchesForUser(state.branches || [], actor),
      getById: (id) => (state.branches || []).find((b) => b.id === id) || null,
      saveProfile: (branch, data) => applyBranchProfile(branch, data)
    },
    tenants: {
      list: () => state.platformTenants || [],
      getById: (id) => (state.platformTenants || []).find((t) => t.id === id) || null,
      getConfig: (id, user) => getTenantConfig(state, id, user)
    },
    audit: {
      list: () => state.audit || [],
      record: (payload, uid) => recordAuditEvent(state, payload, uid)
    },
    config: {
      get: (key) => getConfigValue(state, key),
      isEnabled: (flag) => isFeatureEnabled(state, flag)
    }
  };
}

/**
 * Service-layer adapter for Wave 1 cross-cutting operations.
 */
export function createFoundationServices(state, { uid, now, actor } = {}) {
  const repos = createFoundationRepositories(state);
  const context = () => resolveFoundationContext(state, actor);

  return {
    context,
    repos,
    auth: {
      login: (creds) => authenticateLocal(state, creds, uid, now),
      logout: (opts) => logoutLocal(state, opts, uid, now),
      roles: listAuthRoles,
      assert: (action) => assertActionAllowed(actor, action)
    },
    rbac: {
      can: (action) => canAction(actor, action) || isSystemOwner(actor),
      forbidden: SUPER_ADMIN_FORBIDDEN.slice()
    },
    monitoring: {
      health: () => {
        const domains = (state.monitoringServices || []).map((item) => ({
          domain: item.domain,
          score: item.score,
          status: item.status
        }));
        return overallHealth(domains);
      },
      dashboard: () => monitoringDashboard(state),
      metric: (metric) => recordMetric(state, metric, uid, now),
      log: (entry) => logFoundation(state, entry, uid, now)
    },
    flags: {
      evaluate: (flagId, subject = {}) => evaluateFeatureFlag(state, flagId, subject, now),
      enabled: (flagId) => isFeatureEnabled(state, flagId)
    },
    offline: {
      persist: (opts) => persistOfflineQueue(state, { ...opts, uid, now }),
      recover: (opts) => recoverOfflineQueue(state, { ...opts, uid, now }),
      dashboard: () => offlineFoundationDashboard(state)
    },
    api: createSecureApiClient({
      invoke: (contractId, input, ctx) => invokeContract(state, {
        contractId,
        ...(input && typeof input === "object" ? input : { payload: input })
      }, { ...ctx, user: actor, uid, now }),
      getToken: () => "",
      onAudit: (info) => recordAuditEvent(state, {
        action: "API contract invoke",
        details: info.contractName,
        category: "operational",
        module: "20",
        userId: actor?.id || ""
      }, uid)
    })
  };
}

/**
 * Wire global error handler into Module 19 logs + optional metric.
 */
export function installFoundationErrorBridge(state, { uid } = {}) {
  setGlobalErrorHandler((entry) => {
    ensureMonitoringState(state);
    logFoundation(state, {
      category: "error",
      level: "error",
      message: entry.error || entry.userMessage || "Foundation error",
      correlationId: entry.correlationId || "",
      payload: {
        errorCode: entry.errorCode,
        category: entry.category,
        retryable: entry.retryable === true
      }
    }, uid);
    recordMetric(state, {
      domain: "system",
      name: "foundation_errors",
      value: 1,
      unit: "count",
      source: "foundation-ops"
    }, uid);
  });
  return { ok: true, version: FOUNDATION_VERSION };
}

export function foundationSmokeChecklist(state, actor = null) {
  const ctx = resolveFoundationContext(state, actor);
  const offline = offlineFoundationDashboard(state);
  return {
    wave: FOUNDATION_WAVE,
    version: FOUNDATION_VERSION,
    tenantId: ctx.tenantId,
    branchReady: Boolean(ctx.branchId || (state.branches || []).length >= 0),
    rbacForbiddenCount: SUPER_ADMIN_FORBIDDEN.length,
    logCategories: LOG_CATEGORIES.slice(),
    offline,
    moneyDefaults: {
      loanInterest: getConfigValue(state, "finance.loanInterest") ?? 15,
      collectionDays: getConfigValue(state, "finance.collectionDays") ?? 31,
      cashierLimitGhs: getConfigValue(state, "approval.cashierLimitGhs") ?? 1000
    }
  };
}
