/**
 * Monetary values as integer pesewas (1 GHS = 100 pesewas).
 * Never store floats as authoritative amounts.
 * See docs/money-dual-model-plan.md (GAP-005).
 */

/** Cashier default float: GHS 1000 = 100000 pesewas (normative invariant). */
export const CASHIER_FLOAT_PESEWAS = 100_000;

/** Mapping constant: pesewas per Ghana Cedi. */
export const PESEWAS_PER_GHS = 100;

/** Product interest default (percent) — not a money unit. */
export const INTEREST_PERCENT_DEFAULT = 15;

/** Collection cycle days — normative invariant. */
export const COLLECTION_DAYS_DEFAULT = 31;

/**
 * Guard for write paths: authoritative money must be a finite integer pesewas value.
 * Does not coerce — callers must use toPesewas() at GHS boundaries first.
 * @param {unknown} pesewas
 * @param {string} [label]
 * @returns {number}
 */
export function assertPesewasInteger(pesewas, label = "amountPesewas") {
  const n = Number(pesewas);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new TypeError(`${label} must be a finite integer pesewas value`);
  }
  if (n < 0) {
    throw new RangeError(`${label} must be >= 0`);
  }
  return n;
}

/**
 * Prefer pesewas when both representations are present (SQL dual-column safety).
 * @param {{ amountPesewas?: unknown, amount?: unknown, amount_pesewas?: unknown }} row
 * @returns {number}
 */
export function preferPesewasFromRow(row = {}) {
  if (row.amountPesewas != null && row.amountPesewas !== "") {
    return assertPesewasInteger(row.amountPesewas, "amountPesewas");
  }
  if (row.amount_pesewas != null && row.amount_pesewas !== "") {
    return assertPesewasInteger(row.amount_pesewas, "amount_pesewas");
  }
  return toPesewas(row.amount);
}

/**
 * Dual-column invariant: when both pesewas and GHS are present, they must agree
 * within half a pesewa of rounding (GAP-005). Prefer pesewas as SoT; does not rewrite SQL.
 * @param {{ amountPesewas?: unknown, amount_pesewas?: unknown, amount?: unknown }} row
 * @returns {{ ok: boolean, pesewas: number, ghsPesewas: number | null, delta: number }}
 */
export function reconcileDualMoneyRow(row = {}) {
  const hasPesewas =
    (row.amountPesewas != null && row.amountPesewas !== "") ||
    (row.amount_pesewas != null && row.amount_pesewas !== "");
  const hasGhs = row.amount != null && row.amount !== "";
  const pesewas = preferPesewasFromRow(row);
  if (!hasGhs) {
    return { ok: true, pesewas, ghsPesewas: null, delta: 0 };
  }
  const ghsPesewas = toPesewas(row.amount);
  if (!hasPesewas) {
    return { ok: true, pesewas: ghsPesewas, ghsPesewas, delta: 0 };
  }
  const delta = pesewas - ghsPesewas;
  return { ok: delta === 0, pesewas, ghsPesewas, delta };
}

/**
 * Throw when dual columns disagree (use on write/recon paths; additive guard only).
 * @param {{ amountPesewas?: unknown, amount_pesewas?: unknown, amount?: unknown }} row
 * @param {string} [label]
 * @returns {number} authoritative pesewas
 */
export function assertDualMoneyConsistent(row = {}, label = "moneyRow") {
  const result = reconcileDualMoneyRow(row);
  if (!result.ok) {
    throw new RangeError(
      `${label} dual money drift: pesewas=${result.pesewas} vs GHS→pesewas=${result.ghsPesewas} (delta=${result.delta})`
    );
  }
  return result.pesewas;
}

/**
 * Additive write-path guard (GAP-005): normalize payload to integer pesewas + display GHS.
 * Rejects dual-column drift and non-integer pesewas. Does not rewrite SQL schemas.
 * @param {{ amountPesewas?: unknown, amount_pesewas?: unknown, amount?: unknown } | number | string} payload
 * @param {string} [label]
 * @returns {{ amountPesewas: number, amountGhs: number }}
 */
export function guardMoneyWritePayload(payload = {}, label = "moneyWrite") {
  const row =
    payload != null && typeof payload === "object"
      ? payload
      : { amount: payload };
  const amountPesewas = assertDualMoneyConsistent(row, label);
  return { amountPesewas, amountGhs: fromPesewas(amountPesewas) };
}

/**
 * Cashier float breach check (policy invariant GHS 1000 = 100000 pesewas).
 * @param {unknown} floatPesewas
 * @param {number} [limitPesewas]
 * @returns {{ ok: boolean, floatPesewas: number, limitPesewas: number }}
 */
export function assertCashierFloatWithinLimit(
  floatPesewas,
  limitPesewas = CASHIER_FLOAT_PESEWAS
) {
  const n = assertPesewasInteger(floatPesewas, "cashierFloatPesewas");
  const limit = assertPesewasInteger(limitPesewas, "cashierFloatLimitPesewas");
  if (n > limit) {
    throw new RangeError(
      `cashier float ${n} pesewas exceeds limit ${limit} (${fromPesewas(limit)} GHS)`
    );
  }
  return { ok: true, floatPesewas: n, limitPesewas: limit };
}

export function toPesewas(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PESEWAS_PER_GHS);
}

export function fromPesewas(pesewas) {
  return Number(pesewas || 0) / PESEWAS_PER_GHS;
}

export function formatGhs(pesewasOrAmount, { fromPesewas: isPesewas = false, currency = "GHS" } = {}) {
  const amount = isPesewas ? fromPesewas(pesewasOrAmount) : Number(pesewasOrAmount || 0);
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function addPesewas(a, b) {
  return Number(a || 0) + Number(b || 0);
}

export function sumPesewas(values = []) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}
