/**
 * Wave 2 Supabase RPC adapters — used when postgresSourceOfTruth + relationalSync.
 * Does not replace JS posting SoT; dual-writes / cloud reads only.
 * Avoids importing relational-store (pulls DOM context via state.js).
 */

import { restFetch, tenantHeaders, supabaseConfigured } from "../../sync/supabase-rest.js";
import { pushCollectionToRelational, relationalSyncEnabled } from "../../sync/relational-sync.js";
import { guardMoneyWritePayload } from "../money.js";

function amountPesewasForRpc(payload, label) {
  return guardMoneyWritePayload(payload, label).amountPesewas;
}

export function postgresSourceEnabled(state) {
  return state.settings?.postgresSourceOfTruth === true
    && state.settings?.relationalSync === true
    && supabaseConfigured(state);
}

export function cloudPersistenceEnabled(state) {
  return postgresSourceEnabled(state) || relationalSyncEnabled(state);
}

export function createSupabaseRpcRepository(state) {
  const enabled = () => cloudPersistenceEnabled(state);

  async function rpc(name, body) {
    if (!supabaseConfigured(state)) return { ok: false, skipped: true, reason: "supabase_not_configured" };
    if (!enabled()) return { ok: false, skipped: true, reason: "postgres_sot_disabled" };
    try {
      const result = await restFetch(state, `rpc/${name}`, {
        method: "POST",
        body,
        prefer: "return=representation"
      });
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  }

  return {
    enabled,
    upsertCustomer: async (customer) => rpc("upsert_customer_from_client", {
      business_code: tenantHeaders(state).businessId,
      payload: customer
    }),
    recordCollection: async (collection) => {
      if (!enabled()) return { ok: true, skipped: true };
      return pushCollectionToRelational(state, collection);
    },
    recordDeposit: async (payload) => rpc("record_deposit_from_client", {
      business_code: tenantHeaders(state).businessId,
      amount_pesewas: amountPesewasForRpc(payload, "deposit"),
      customer_client_id: payload.customerId,
      idempotency_key: payload.idempotencyKey || payload.id,
      payload
    }),
    recordWithdrawal: async (payload) => rpc("record_withdrawal_from_client", {
      business_code: tenantHeaders(state).businessId,
      amount_pesewas: amountPesewasForRpc(payload, "withdrawal"),
      customer_client_id: payload.customerId,
      idempotency_key: payload.idempotencyKey || payload.id,
      payload
    }),
    recordLoanRepayment: async (payload) => rpc("record_loan_repayment_from_client", {
      business_code: tenantHeaders(state).businessId,
      amount_pesewas: amountPesewasForRpc(payload, "loanRepayment"),
      loan_client_id: payload.loanId,
      idempotency_key: payload.idempotencyKey || payload.id,
      payload
    }),
    /** GAP-005 — disbursement adapter; principal mapped to amount for write guard. */
    recordLoanDisbursement: async (payload) => rpc("record_loan_disbursement_from_client", {
      business_code: tenantHeaders(state).businessId,
      amount_pesewas: amountPesewasForRpc(
        {
          amount: payload.amount ?? payload.principal,
          amountPesewas: payload.amountPesewas ?? payload.principalPesewas ?? payload.principal_pesewas
        },
        "loanDisbursement"
      ),
      loan_client_id: payload.loanId,
      customer_client_id: payload.customerId,
      idempotency_key: payload.idempotencyKey || payload.id,
      payload
    }),
    recordEod: async (payload) => rpc("record_eod_snapshot", {
      business_code: tenantHeaders(state).businessId,
      payload
    }),
    fetchCashbook: async (payload = {}) => rpc("fetch_cashbook_summary", {
      business_code: tenantHeaders(state).businessId,
      ...payload
    }),
    fetchDashboardKpis: async (payload = {}) => rpc("fetch_dashboard_kpis", {
      business_code: tenantHeaders(state).businessId,
      ...payload
    }),
    enqueueOffline: async (item) => rpc("enqueue_offline_item", {
      business_code: tenantHeaders(state).businessId,
      payload: item
    }),
    ackSync: async (itemId, extras = {}) => rpc("ack_sync_queue_item", {
      business_code: tenantHeaders(state).businessId,
      item_id: itemId,
      ...extras
    }),
    appendAudit: async (event) => rpc("append_audit_event", {
      business_code: tenantHeaders(state).businessId,
      payload: event
    })
  };
}
