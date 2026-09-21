/**
 * Mobile Money webhook helpers (browser-safe).
 * Callbacks are processed at most once inside the trusted boundary.
 * Gateway delivery itself is not exactly-once.
 * Provider adapters must call the payment engine; this helper is the MoMo matcher.
 * GAP-019: provider major-unit amounts convert to integer pesewas at this boundary only
 * (no live MoMo calls; SQL numeric columns remain freeze-gated — see docs/backlog/momo-gap-inventory.md).
 */
import { beginIdempotentRequest, completeIdempotentRequest, failIdempotentRequest } from "./idempotency.js";
import { isWalletPaymentMethod } from "./momo.js";
import { toPesewas, preferPesewasFromRow } from "./money.js";

export function normalizeWebhookReference(reference) {
  return String(reference || "").trim().toUpperCase();
}

/**
 * Convert provider major-unit GHS (or already-integer pesewas when unit=pesewas) to pesewas.
 * Does not call providers. Does not invent payment success.
 * @param {unknown} amount
 * @param {"ghs"|"pesewas"} [unit]
 * @returns {number}
 */
export function normalizeProviderAmountToPesewas(amount, unit = "ghs") {
  if (unit === "pesewas") {
    const n = Number(amount);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return toPesewas(amount);
}

export function parseMomoWebhookPayload(body = {}) {
  const reference = normalizeWebhookReference(
    body.reference || body.externalId || body.transactionId || body.TransactionID || ""
  );
  const unitHint = String(body.amountUnit || body.amount_unit || "ghs").toLowerCase();
  const rawAmount = body.amount ?? body.Amount ?? 0;
  const amount = Number(rawAmount || 0);
  const amountPesewas = normalizeProviderAmountToPesewas(
    rawAmount,
    unitHint === "pesewas" ? "pesewas" : "ghs"
  );
  const phone = String(body.phone || body.customerMsisdn || body.msisdn || "").trim();
  const provider = String(body.provider || body.network || "unknown").trim();
  const status = String(body.status || body.Status || "success").toLowerCase();
  return { reference, amount, amountPesewas, phone, provider, status, raw: body };
}

export function matchCollectionToWebhook(state, webhook) {
  if (!webhook.reference) return null;
  return (state.collections || []).find((item) =>
    !item.reversed
    && isWalletPaymentMethod(item.paymentMethod)
    && normalizeWebhookReference(item.paymentReference) === webhook.reference
  ) || null;
}

/**
 * Soft amount check (GAP-019). Skips when collection has no amount fields.
 * Does not post money or call providers.
 */
export function webhookAmountMatchesCollection(webhook, collection) {
  if (!collection) return { checked: false, ok: true };
  const hasCollectionMoney =
    (collection.amountPesewas != null && collection.amountPesewas !== "")
    || (collection.amount_pesewas != null && collection.amount_pesewas !== "")
    || (collection.amount != null && collection.amount !== "");
  if (!hasCollectionMoney) return { checked: false, ok: true };
  const webhookPesewas = webhook.amountPesewas != null
    ? Number(webhook.amountPesewas)
    : normalizeProviderAmountToPesewas(webhook.amount);
  if (!webhookPesewas) return { checked: false, ok: true };
  const collectionPesewas = preferPesewasFromRow(collection);
  return {
    checked: true,
    ok: webhookPesewas === collectionPesewas,
    webhookPesewas,
    collectionPesewas
  };
}

export function applyMomoWebhookVerification(state, webhook, { verifiedBy = "webhook" } = {}) {
  const collection = matchCollectionToWebhook(state, webhook);
  if (!collection) {
    return { ok: false, error: "No matching pending MoMo collection", webhook };
  }
  if (webhook.status && !["success", "successful", "completed", "paid"].includes(webhook.status)) {
    return { ok: false, error: "Webhook status not successful", webhook };
  }
  const amountCheck = webhookAmountMatchesCollection(webhook, collection);
  if (amountCheck.checked && !amountCheck.ok) {
    return {
      ok: false,
      error: "Webhook amount does not match collection",
      webhook,
      collection,
      amountCheck
    };
  }
  if (collection.verificationStatus === "Verified") {
    return { ok: true, duplicate: true, collection, webhook };
  }
  collection.verificationStatus = "Verified";
  collection.momoVerifiedAt = new Date().toISOString();
  collection.momoVerifiedBy = verifiedBy;
  return { ok: true, collection, webhook };
}

export function processMomoCallback(state, webhook, { verifiedBy = "webhook", uid, now } = {}) {
  const reference = webhook?.reference || "";
  const key = `momo:${normalizeWebhookReference(reference)}`;
  const gate = beginIdempotentRequest(state, {
    idempotencyKey: key,
    operationType: "webhook.momo",
    fingerprint: {
      externalReference: reference,
      amount: webhook?.amount,
      amountPesewas: webhook?.amountPesewas,
      operationType: "webhook.momo"
    },
    source: "momo-gateway",
    now
  }, uid);
  if (gate.duplicate) {
    const collection = (state.collections || []).find((item) => item.id === gate.record?.transactionId)
      || matchCollectionToWebhook(state, webhook);
    return { ok: true, duplicate: true, collection, webhook };
  }
  if (!gate.proceed) {
    return { ok: false, error: gate.error, duplicate: Boolean(gate.processing), webhook };
  }
  const result = applyMomoWebhookVerification(state, webhook, { verifiedBy });
  if (result.ok) {
    completeIdempotentRequest(state, key, {
      transactionId: result.collection?.id,
      responsePayload: { collectionId: result.collection?.id }
    }, { source: "momo-gateway", now });
  } else {
    failIdempotentRequest(state, key, {
      recoverable: /No matching/i.test(result.error || ""),
      error: result.error,
      now
    });
  }
  return result;
}
