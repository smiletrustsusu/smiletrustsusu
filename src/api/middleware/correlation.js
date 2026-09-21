/**
 * Correlation / request identity for Wave 3 API platform.
 */

export function newCorrelationId(uid) {
  if (typeof uid === "function") return uid("corr");
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveCorrelation(request = {}, { uid } = {}) {
  const correlationId =
    request.correlationId ||
    request.header?.correlationId ||
    request.headers?.["X-Correlation-Id"] ||
    newCorrelationId(uid);
  const requestId =
    request.requestId ||
    request.header?.requestId ||
    request.headers?.["X-Request-Id"] ||
    (typeof uid === "function" ? uid("req") : `req-${Date.now().toString(36)}`);
  return { correlationId, requestId };
}
