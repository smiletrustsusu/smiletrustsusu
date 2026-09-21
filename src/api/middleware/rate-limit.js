/**
 * In-process rate limiting hooks (configurable per operation / actor).
 */

const WINDOWS = new Map();

export const DEFAULT_RATE_LIMIT = Object.freeze({
  perMinute: 120,
  burst: 30
});

function windowKey(actorKey, operationId) {
  return `${actorKey}::${operationId}`;
}

export function configureRateLimit(state, limits = {}) {
  state.apiPlatform = state.apiPlatform || {};
  state.apiPlatform.rateLimits = {
    ...(state.apiPlatform.rateLimits || {}),
    ...limits
  };
  return state.apiPlatform.rateLimits;
}

export function checkRateLimit(state, { actorKey = "anon", operation = {}, now = Date.now() } = {}) {
  const configured = state.apiPlatform?.rateLimits?.[operation.rateLimitKey || operation.id]
    || state.apiPlatform?.rateLimits?.default
    || DEFAULT_RATE_LIMIT;
  if (configured.enabled === false) return { ok: true, remaining: Infinity };

  const perMinute = Number(configured.perMinute || DEFAULT_RATE_LIMIT.perMinute);
  const key = windowKey(actorKey, operation.id || "unknown");
  const bucket = WINDOWS.get(key) || { count: 0, resetAt: now + 60_000 };
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  WINDOWS.set(key, bucket);
  if (bucket.count > perMinute) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      error: {
        ok: false,
        errorCode: "API-429",
        category: "performance",
        error: "Rate limit exceeded",
        userMessage: "Too many requests. Please slow down and retry.",
        retryable: true,
        http: 429
      }
    };
  }
  return {
    ok: true,
    remaining: Math.max(0, perMinute - bucket.count),
    resetAt: bucket.resetAt
  };
}

export function resetRateLimitWindows() {
  WINDOWS.clear();
}
