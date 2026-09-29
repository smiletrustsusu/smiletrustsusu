/**
 * Wave 3 domain services — orchestration only; reuse existing ops engines.
 */

import { wave4SyncDashboard } from "../../sync/offline-sync-engine.js";
import {
  authenticateLocal,
  logoutLocal,
  changePassword,
  requestPasswordReset,
  completePasswordReset,
  refreshSupabaseSession,
  sessionStatus,
  listAuthRoles,
  assertActionAllowed
} from "../auth-session-ops.js";
import { canAction, dataScope, SUPER_ADMIN_FORBIDDEN } from "../rbac.js";
import { isSystemOwner } from "../roles.js";
import {
  getUserForActor,
  listUsersForActor
} from "../system-accounts.js";
import { filterCollectionsForUser, filterCustomersForUser } from "../permissions.js";
import { reportDashboard, runReport, analyticsSeries } from "../report-ops.js";
import {
  branchTrialBalance,
  cashFlowSummary,
  closeAccountingPeriod,
  ghanaAccountingReady
} from "../accounting-ops.js";
import {
  processNotification,
  searchNotifications,
  scheduleNotification,
  cancelNotification
} from "../notification-ops.js";
import {
  ensureSystemConfig,
  getConfigValue,
  isFeatureEnabled,
  FEATURE_FLAG_CATALOG
} from "../system-config.js";
import {
  collectHealthSnapshot,
  monitoringDashboard,
  recordMetric,
  ensureMonitoringState
} from "../monitoring-ops.js";
import { overallHealth } from "../monitoring-lifecycle.js";
import { cacheInvalidate, withReadCache, cacheKey } from "../../api/helpers/cache.js";
import { applyFilters, filterByBranch } from "../../api/helpers/filtering.js";
import { applySort } from "../../api/helpers/sorting.js";
import { paginateRows } from "../../api/helpers/pagination.js";

function ctxParts(ctx = {}) {
  return { uid: ctx.uid, now: ctx.now, actor: ctx.user };
}

export function createDomainServices(state, repos, baseCtx = {}) {
  const local = repos.local;
  const cloud = repos.supabase;

  return {
    auth: {
      login: async (payload) => authenticateLocal(state, payload, baseCtx.uid, baseCtx.now),
      logout: (payload = {}) => logoutLocal(state, payload, baseCtx.uid, baseCtx.now),
      refresh: async (payload) => refreshSupabaseSession(state, payload),
      changePassword: async (user, payload) => changePassword(state, user, payload, baseCtx.uid, baseCtx.now),
      requestPasswordReset: async (payload) => requestPasswordReset(state, payload, baseCtx.uid, baseCtx.now),
      completePasswordReset: async (payload) => completePasswordReset(state, payload, baseCtx.uid, baseCtx.now),
      session: () => sessionStatus(state.settings || {}),
      roles: () => listAuthRoles(),
      registerDevice: (payload = {}, ctx = {}) => {
        state.deviceAuthorizations = state.deviceAuthorizations || [];
        const device = {
          id: typeof ctx.uid === "function" ? ctx.uid("dev") : `dev-${Date.now()}`,
          fingerprint: payload.fingerprint || payload.deviceToken || "",
          label: payload.label || "",
          userId: ctx.user?.id || payload.userId || "",
          active: true,
          createdAt: new Date().toISOString()
        };
        state.deviceAuthorizations.push(device);
        return { ok: true, device };
      }
    },

    authorization: {
      can: (user, action) => canAction(user, action) || isSystemOwner(user),
      assert: (user, action) => assertActionAllowed(user, action),
      scope: (user) => dataScope(user),
      forbidden: () => SUPER_ADMIN_FORBIDDEN.slice(),
      checkTenantBranch: (user, { tenantId, branchId } = {}) => {
        const scope = dataScope(user);
        if (tenantId && user.tenantId && String(tenantId) !== String(user.tenantId) && !isSystemOwner(user)) {
          return { ok: false, errorCode: "FND-005", error: "Wrong tenant" };
        }
        if (branchId && scope === "branch" && user.branchId && String(branchId) !== String(user.branchId)) {
          return { ok: false, errorCode: "FND-005", error: "Wrong branch" };
        }
        return { ok: true, scope };
      }
    },

    users: {
      list: (query = {}, ctx = {}) => {
        let rows = listUsersForActor(state.users || [], ctx.user);
        rows = applyFilters(rows, query);
        rows = applySort(rows, query, { defaultField: "name", defaultDirection: "asc" });
        const page = paginateRows(rows, query);
        return {
          ok: true,
          ...page,
          users: (page.rows || []).map((user) => {
            const { passwordHash, password, ...safe } = user;
            return safe;
          })
        };
      },
      get: (payload = {}, ctx = {}) => {
        const user = getUserForActor(state.users || [], payload.id || payload.userId, ctx.user);
        if (!user) {
          return { ok: false, error: "User not found", errorCode: "FND-016", http: 404 };
        }
        const { passwordHash, password, ...safe } = user;
        return { ok: true, user: safe };
      }
    },

    customers: {
      register: async (payload, ctx) => {
        const result = local.customers.register(payload, ctxParts(ctx));
        if (result.ok && repos.cloudEnabled()) {
          result.cloud = await cloud.upsertCustomer(result.customer);
        }
        cacheInvalidate("customers:");
        return result;
      },
      update: (payload, ctx) => {
        const result = local.customers.update(payload.id || payload.customerId, payload, ctxParts(ctx));
        cacheInvalidate("customers:");
        return result;
      },
      get: (payload) => {
        const customer = local.customers.getById(payload.id || payload.customerId);
        return customer ? { ok: true, customer } : { ok: false, error: "Customer not found", errorCode: "FND-016" };
      },
      list: (query = {}, ctx = {}) => {
        let rows = local.customers.list();
        const scope = ctx.authz?.scope || dataScope(ctx.user);
        const groupIds = [ctx.authz?.branchId, ctx.user?.branchId, ctx.user?.groupId].filter(Boolean);
        if (scope === "assigned" || scope === "branch" || scope === "self") {
          rows = filterCustomersForUser(rows, ctx.user, { groupIds });
        } else if (ctx.authz?.scope === "branch" && ctx.authz.branchId) {
          rows = filterByBranch(rows, ctx.authz.branchId, "branchId");
          rows = rows.filter((r) => !r.groupId || r.groupId === ctx.authz.branchId || r.branchId === ctx.authz.branchId);
        }
        rows = applyFilters(rows, query);
        rows = applySort(rows, query, { defaultField: "name", defaultDirection: "asc" });
        return { ok: true, ...paginateRows(rows, query) };
      },
      search: (query = {}, ctx = {}) => {
        let rows = local.customers.search(query.q || query.search || "");
        const scope = ctx.authz?.scope || dataScope(ctx.user);
        const groupIds = [ctx.authz?.branchId, ctx.user?.branchId, ctx.user?.groupId].filter(Boolean);
        if (scope === "assigned" || scope === "branch" || scope === "self") {
          rows = filterCustomersForUser(rows, ctx.user, { groupIds });
        }
        return { ok: true, ...paginateRows(applySort(rows, query), query) };
      }
    },

    savings: {
      balance: (payload) => {
        const id = payload.customerId || payload.id;
        return { ok: true, customerId: id, balance: local.collections.balance(id), summary: local.collections.savingsSummary(id) };
      },
      statement: (payload = {}) => {
        const id = payload.customerId || payload.id;
        const rows = (state.collections || []).filter((c) => c.customerId === id && !c.reversed);
        return { ok: true, ...paginateRows(applySort(rows, payload), payload) };
      },
      collect: async (payload, ctx) => {
        const result = local.collections.record(payload, ctxParts(ctx));
        if (result.ok && repos.cloudEnabled()) {
          result.cloud = await cloud.recordDeposit(result.collection);
          result.collectionCloud = await cloud.recordCollection(result.collection);
        }
        cacheInvalidate("dashboard:");
        return result;
      }
    },

    collections: {
      record: async (payload, ctx) => {
        const result = local.collections.record(payload, ctxParts(ctx));
        if (result.ok && repos.cloudEnabled()) {
          result.cloud = await cloud.recordCollection(result.collection);
        }
        cacheInvalidate("dashboard:");
        return result;
      },
      list: (query = {}, ctx = {}) => {
        let rows = local.collections.list();
        const scope = ctx.authz?.scope || dataScope(ctx.user);
        const groupIds = [ctx.authz?.branchId, ctx.user?.branchId, ctx.user?.groupId].filter(Boolean);
        if (scope === "assigned" || scope === "branch" || scope === "self") {
          rows = filterCollectionsForUser(rows, ctx.user, {
            customers: state.customers || [],
            groupIds
          });
        } else if (ctx.authz?.scope === "branch" && ctx.authz.branchId) {
          rows = filterByBranch(rows, ctx.authz.branchId, "branchId");
        }
        rows = applyFilters(rows, query);
        rows = applySort(rows, query);
        return { ok: true, ...paginateRows(rows, query) };
      },
      get: (payload) => {
        const row = local.collections.getById(payload.id || payload.collectionId);
        return row ? { ok: true, collection: row } : { ok: false, error: "Collection not found" };
      },
      daily: (query = {}) => {
        const date = query.date || new Date().toISOString().slice(0, 10);
        const rows = (state.collections || []).filter((c) => c.date === date && !c.reversed);
        const totalPesewas = rows.reduce((sum, c) => sum + Number(c.amountPesewas ?? Math.round(Number(c.amount || 0) * 100)), 0);
        return { ok: true, date, count: rows.length, totalPesewas, ...paginateRows(rows, query) };
      }
    },

    loans: {
      apply: (payload, ctx) => {
        const result = local.loans.apply({ ...payload, interest: payload.interest ?? state.settings?.loanInterest ?? 15 }, ctx.uid);
        return result.error ? { ok: false, error: result.error } : { ok: true, ...result };
      },
      get: (payload) => {
        const loan = local.loans.getById(payload.id || payload.loanId);
        return loan ? { ok: true, loan } : { ok: false, error: "Loan not found" };
      },
      list: (query = {}) => ({
        ok: true,
        ...paginateRows(applySort(applyFilters(local.loans.list(), query), query), query)
      }),
      repay: async (payload, ctx) => {
        const result = local.loans.repay(payload.loanId || payload.id, payload, ctxParts(ctx));
        if (result.ok && repos.cloudEnabled()) {
          result.cloud = await cloud.recordLoanRepayment(result.repayment);
        }
        cacheInvalidate("dashboard:");
        return result;
      },
      portfolio: () => ({ ok: true, ...local.loans.portfolio() })
    },

    accounting: {
      trialBalance: (payload = {}) => ({
        ok: true,
        trialBalance: branchTrialBalance(state, payload.branchId || "", { from: payload.from, to: payload.to })
      }),
      cashFlow: (payload = {}) => ({ ok: true, cashFlow: cashFlowSummary(state, payload) }),
      closePeriod: (payload, ctx) => closeAccountingPeriod(state, { ...payload, user: ctx.user }),
      readiness: () => ({ ok: true, ...ghanaAccountingReady(state) }),
      cashbook: async (payload = {}) => {
        if (repos.cloudEnabled()) {
          const cloudResult = await cloud.fetchCashbook(payload);
          if (cloudResult.ok) return { ok: true, source: "supabase", ...cloudResult };
        }
        return { ok: true, source: "local", cashFlow: cashFlowSummary(state, payload) };
      }
    },

    reporting: {
      run: (payload, ctx) => {
        const result = runReport(state, payload.reportId || payload.id, { user: ctx.user, ...payload });
        return { ok: true, result };
      },
      dashboard: (payload = {}, ctx = {}) => ({
        ok: true,
        dashboard: reportDashboard(state, payload, ctx.user)
      }),
      analytics: (payload = {}, ctx = {}) => ({
        ok: true,
        series: analyticsSeries(state, payload, ctx.user)
      })
    },

    dashboards: {
      summary: (payload = {}, ctx = {}) => {
        const key = cacheKey(["dashboard", "summary", ctx.user?.id || "", payload.branchId || ""]);
        return withReadCache(key, 10_000, () => ({
          ok: true,
          summary: reportDashboard(state, payload, ctx.user),
          money: local.config.moneyDefaults()
        }));
      },
      kpis: async (payload = {}, ctx = {}) => {
        if (repos.cloudEnabled()) {
          const cloudResult = await cloud.fetchDashboardKpis(payload);
          if (cloudResult.ok) return { ok: true, source: "supabase", ...cloudResult };
        }
        const key = cacheKey(["dashboard", "kpis", ctx.user?.id || ""]);
        return withReadCache(key, 10_000, () => ({
          ok: true,
          source: "local",
          dashboard: reportDashboard(state, payload, ctx.user)
        }));
      }
    },

    sync: {
      upload: async (payload = {}, ctx = {}) => {
        local.sync.ensure();
        const item = local.sync.enqueue({
          id: typeof ctx.uid === "function" ? ctx.uid("sync") : undefined,
          kind: payload.kind || "generic",
          idempotencyKey: payload.idempotencyKey || `sync-${Date.now()}`,
          payload: payload.payload || payload,
          correlationId: ctx.correlationId || "",
          branchId: ctx.authz?.branchId || "",
          agentId: ctx.user?.id || ""
        });
        let cloudResult = null;
        if (repos.cloudEnabled()) {
          cloudResult = await cloud.enqueueOffline(item);
        }
        return { ok: true, item, cloud: cloudResult };
      },
      status: () => {
        const dash = wave4SyncDashboard(state, { online: true });
        return { ok: true, ...local.sync.status(), wave4: dash.collectorStatus, progress: dash.progress };
      },
      progress: () => {
        const pending = local.sync.pending();
        const progress = wave4SyncDashboard(state, { online: true }).progress;
        return {
          ok: true,
          pendingCount: pending.length,
          statuses: pending.reduce((acc, item) => {
            acc[item.status || "pending"] = (acc[item.status || "pending"] || 0) + 1;
            return acc;
          }, {}),
          ...progress
        };
      },
      ack: async (payload = {}) => {
        const id = payload.itemId || payload.id;
        const queue = state.offlineQueue || [];
        const item = queue.find((row) => row.id === id);
        if (item) {
          item.status = "applied";
          item.appliedAt = new Date().toISOString();
        }
        let cloudResult = null;
        if (repos.cloudEnabled() && id) {
          cloudResult = await cloud.ackSync(id, { status: "applied" });
        }
        return { ok: true, item: item || null, cloud: cloudResult };
      }
    },

    audit: {
      record: async (payload, ctx) => {
        const row = local.audit.record({
          ...payload,
          userId: ctx.user?.id || payload.userId || "",
          correlationId: ctx.correlationId || payload.correlationId || ""
        }, ctx.uid);
        if (repos.cloudEnabled()) {
          await cloud.appendAudit(payload);
        }
        return { ok: true, event: row };
      },
      search: (payload = {}) => ({ ok: true, ...paginateRows(local.audit.search(payload), payload) })
    },

    notifications: {
      send: (payload, ctx) => {
        state.notifications = state.notifications || [];
        const message = {
          id: typeof ctx.uid === "function" ? ctx.uid("ntf") : `ntf-${Date.now()}`,
          channel: payload.channel || "SMS",
          to: payload.to || payload.phone || "",
          body: payload.body || payload.message || "",
          status: "queued",
          createdAt: new Date().toISOString()
        };
        state.notifications.push(message);
        const processed = processNotification(state, message, { now: Date.now(), uid: ctx.uid });
        return { ok: true, message, processed };
      },
      schedule: (payload, ctx) => scheduleNotification(state, payload, ctx.user, ctx.uid),
      cancel: (payload, ctx) => {
        const message = (state.notifications || []).find((n) => n.id === (payload.id || payload.messageId));
        if (!message) return { ok: false, error: "Notification not found" };
        const result = cancelNotification(message, ctx.user);
        if (result.error) return { ok: false, error: result.error };
        return { ok: true, message: result.message || message };
      },
      history: (payload = {}) => ({
        ok: true,
        ...paginateRows(searchNotifications(state, payload), payload)
      })
    },

    configuration: {
      get: (payload = {}) => {
        ensureSystemConfig(state);
        if (payload.key) return { ok: true, key: payload.key, value: getConfigValue(state, payload.key) };
        return { ok: true, settings: local.config.settings(), money: local.config.moneyDefaults() };
      },
      flags: () => {
        ensureSystemConfig(state);
        const flags = (FEATURE_FLAG_CATALOG || []).slice(0, 50).map((flag) => {
          const id = flag.id || flag.key || flag;
          return { id, enabled: isFeatureEnabled(state, id) };
        });
        return { ok: true, flags };
      },
      moneyDefaults: () => ({ ok: true, ...local.config.moneyDefaults() })
    },

    monitoring: {
      health: (ctx = {}) => {
        ensureMonitoringState(state);
        const snapshot = collectHealthSnapshot(state, {
          uid: ctx.uid,
          now: ctx.now,
          user: ctx.user,
          online: true
        });
        return { ok: true, snapshot, overall: overallHealth(snapshot?.domains || []) };
      },
      metrics: () => {
        ensureMonitoringState(state);
        return { ok: true, dashboard: monitoringDashboard(state) };
      },
      recordMetric: (payload, ctx) => {
        recordMetric(state, payload, ctx.uid, ctx.now);
        return { ok: true };
      }
    }
  };
}
