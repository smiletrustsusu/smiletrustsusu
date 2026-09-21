/**
 * Mobile Money reference validation and duplicate detection.
 * Server-side verification should confirm provider callbacks; this is client-side guard.
 */

export function normalizeMomoReference(reference) {
  return String(reference || "").trim().toUpperCase();
}

export function isValidMomoReference(reference) {
  const ref = normalizeMomoReference(reference);
  return ref.length >= 6 && ref.length <= 64 && /^[A-Z0-9-]+$/.test(ref);
}

export function isDuplicateMomoReference(state, reference, { excludeCollectionId = "" } = {}) {
  const ref = normalizeMomoReference(reference);
  if (!ref) return false;
  return (state.collections || []).some((item) =>
    item.id !== excludeCollectionId
    && !item.reversed
    && normalizeMomoReference(item.paymentReference) === ref
    && collectionPaymentMethod(item) !== "Cash"
  );
}

function collectionPaymentMethod(item) {
  return item?.paymentMethod || "Cash";
}

export function isWalletPaymentMethod(paymentMethod) {
  return /mobile money|mtn|telecel|airteltigo|momo/i.test(paymentMethod || "");
}

export function verifyMomoPaymentLocally(state, { paymentMethod, paymentReference, collectionId = "" }) {
  if (!isWalletPaymentMethod(paymentMethod)) return { ok: true };
  if (!isValidMomoReference(paymentReference)) {
    return { ok: false, error: "Invalid Mobile Money reference format" };
  }
  if (isDuplicateMomoReference(state, paymentReference, { excludeCollectionId: collectionId })) {
    return { ok: false, error: "This Mobile Money reference was already used" };
  }
  return { ok: true };
}
