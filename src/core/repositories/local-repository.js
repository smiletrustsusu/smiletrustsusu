/**
 * Local persistence adapters over in-memory/localStorage state.
 * Money mutations reuse double-entry + collections arrays — no second math engine.
 */

import { guardMoneyWritePayload } from "../money.js";
import { postDoubleEntry } from "../double-entry.js";
import { validateCollectionDraft, customerBalanceBreakdown } from "../collection-ops.js";
import { personalSavingsSummary } from "../personal-savings.js";
import { findDuplicateCustomers } from "../customer-crm.js";
import { nextCustomerNumber } from "../customer-kyc.js";
import { createLoanApplication, allocateRepayment, outstandingLoanBalance, loanPortfolioSummary } from "../loans-workflow.js";
import { recordAuditEvent, searchAudit } from "../audit-ops.js";
import { ensureSyncState } from "../sync-ops.js";
import { enqueueOfflineOperation, pendingQueueItems } from "../../sync/offline-queue.js";

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  return now || new Date().toISOString();
}

function newId(prefix, uid) {
  return typeof uid === "function" ? uid(prefix) : `${prefix}-${Date.now().toString(36)}`;
}

export function createLocalRepository(state) {
  return {
    customers: {
      list: () => state.customers || [],
      getById: (id) => (state.customers || []).find((c) => c.id === id) || null,
      search: (q = "") => {
        const needle = String(q).toLowerCase();
        return (state.customers || []).filter((c) =>
          !needle ||
          String(c.name || "").toLowerCase().includes(needle) ||
          String(c.phone || "").includes(needle) ||
          String(c.accountNo || "").toLowerCase().includes(needle) ||
          String(c.customerNumber || "").toLowerCase().includes(needle)
        );
      },
      register: (payload = {}, { uid, now, actor } = {}) => {
        state.customers = state.customers || [];
        const dupes = findDuplicateCustomers(state.customers, payload);
        if (dupes.length) {
          return { ok: false, errorCode: "FND-016", error: "Duplicate customer", duplicates: dupes.map((d) => d.id) };
        }
        const customer = {
          id: newId("cus", uid),
          name: payload.name,
          phone: payload.phone || "",
          phoneAlt: payload.phoneAlt || "",
          email: payload.email || "",
          branchId: payload.branchId || payload.groupId || actor?.branchId || "",
          groupId: payload.groupId || payload.branchId || actor?.branchId || "",
          accountNo: payload.accountNo || `ACC-${Date.now().toString(36)}`,
          customerNumber: payload.customerNumber || nextCustomerNumber(state.customers) || newId("CN", uid),
          memberStatus: payload.memberStatus || "Active",
          active: true,
          accountType: payload.accountType || "personal",
          savingsProductId: payload.savingsProductId || "",
          collectorId: payload.collectorId || "",
          createdAt: nowIso(now),
          updatedAt: nowIso(now),
          createdBy: actor?.id || ""
        };
        state.customers.push(customer);
        return { ok: true, customer };
      },
      update: (id, patch = {}, { now, actor } = {}) => {
        const customer = (state.customers || []).find((c) => c.id === id);
        if (!customer) return { ok: false, errorCode: "FND-016", error: "Customer not found" };
        Object.assign(customer, patch, { updatedAt: nowIso(now), updatedBy: actor?.id || "" });
        return { ok: true, customer };
      }
    },

    collections: {
      list: () => state.collections || [],
      getById: (id) => (state.collections || []).find((c) => c.id === id) || null,
      record: (payload = {}, { uid, now, actor } = {}) => {
        state.collections = state.collections || [];
        const customer = (state.customers || []).find((c) => c.id === payload.customerId);
        const agent = (state.users || []).find((u) => u.id === (payload.collectorId || actor?.id));
        const branch = (state.branches || []).find((b) => b.id === (payload.branchId || customer?.groupId || customer?.branchId));
        const product = (state.savingsProducts || state.products || []).find((p) => p.id === customer?.savingsProductId);
        let amountGhs;
        let amountPesewas;
        try {
          const money = guardMoneyWritePayload(payload, "collection");
          amountGhs = money.amountGhs;
          amountPesewas = money.amountPesewas;
        } catch (err) {
          return { ok: false, errorCode: "FND-016", error: err?.message || String(err) };
        }
        const validation = validateCollectionDraft({
          customer,
          agent,
          branch,
          product,
          amount: amountGhs,
          date: payload.date || nowIso(now).slice(0, 10)
        });
        if (validation) {
          return { ok: false, errorCode: "FND-016", error: validation };
        }
        const collection = {
          id: newId("col", uid),
          customerId: customer.id,
          groupId: customer.groupId || branch?.id || "",
          branchId: branch?.id || customer.branchId || "",
          amount: amountGhs,
          amountPesewas,
          date: payload.date || nowIso(now).slice(0, 10),
          paymentMethod: payload.paymentMethod || "Cash",
          note: payload.note || "",
          status: payload.status || "Posted",
          userId: actor?.id || "",
          collectorId: payload.collectorId || actor?.id || "",
          idempotencyKey: payload.idempotencyKey || "",
          createdAt: nowIso(now),
          reversed: false
        };
        state.collections.push(collection);
        if (amountGhs > 0) {
          postDoubleEntry(state, {
            id: newId("led", uid),
            entryType: "Susu Deposit",
            customerId: customer.id,
            groupId: collection.groupId,
            collectorId: collection.collectorId,
            amount: amountGhs,
            direction: "credit",
            referenceId: collection.id,
            referenceType: "collection",
            receiptNo: collection.id,
            paymentMethod: collection.paymentMethod,
            createdBy: actor?.id || "",
            clientCreatedAt: collection.createdAt
          }, uid);
        }
        return { ok: true, collection };
      },
      balance: (customerId) => customerBalanceBreakdown(customerId, {
        collections: state.collections || [],
        transactions: state.transactions || []
      }),
      savingsSummary: (customerId) => {
        const customer = (state.customers || []).find((c) => c.id === customerId);
        const product = (state.savingsProducts || state.products || []).find((p) => p.id === customer?.savingsProductId);
        return personalSavingsSummary(customer, product, state.collections || []);
      }
    },

    loans: {
      list: () => state.loans || [],
      getById: (id) => (state.loans || []).find((l) => l.id === id) || null,
      apply: (payload, ctx) => createLoanApplication(state, payload, ctx?.uid),
      repay: (loanId, amount, { uid, actor } = {}) => {
        const loan = (state.loans || []).find((l) => l.id === loanId);
        if (!loan) return { ok: false, error: "Loan not found" };
        let amountGhs;
        let amountPesewas;
        try {
          const money = guardMoneyWritePayload(
            amount != null && typeof amount === "object" ? amount : { amount },
            "loanRepayment"
          );
          amountGhs = money.amountGhs;
          amountPesewas = money.amountPesewas;
        } catch (err) {
          return { ok: false, error: err?.message || String(err) };
        }
        const result = allocateRepayment(loan, amountGhs, { userId: actor?.id || "", role: actor?.role || "" });
        state.loanRepayments = state.loanRepayments || [];
        const repayment = {
          id: newId("lrp", uid),
          loanId,
          amount: amountGhs,
          amountPesewas,
          createdAt: new Date().toISOString(),
          userId: actor?.id || ""
        };
        state.loanRepayments.push(repayment);
        return { ok: true, loan, repayment, allocation: result, outstanding: outstandingLoanBalance(loan) };
      },
      portfolio: () => loanPortfolioSummary(state.loans || [])
    },

    audit: {
      record: (payload, uid) => recordAuditEvent(state, payload, uid),
      search: (filters) => searchAudit(state, filters)
    },

    sync: {
      ensure: () => ensureSyncState(state),
      pending: () => pendingQueueItems(state),
      enqueue: (op) => enqueueOfflineOperation(state, op),
      status: () => {
        ensureSyncState(state);
        const pending = pendingQueueItems(state);
        return {
          status: state.syncMeta?.status || "idle",
          pendingCount: pending.length,
          schemaVersion: state.syncMeta?.schemaVersion || "",
          serverSequence: state.syncMeta?.serverSequence || 0
        };
      }
    },

    config: {
      settings: () => state.settings || {},
      moneyDefaults: () => ({
        loanInterest: Number(state.settings?.loanInterest ?? 15),
        collectionDays: Number(state.settings?.collectionDays ?? 31),
        cashierLimitGhs: 1000,
        currency: state.settings?.currency || "GHS",
        moneyUnit: "pesewas"
      })
    }
  };
}
