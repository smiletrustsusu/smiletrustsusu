/**
 * In-process read-through cache for safe read-only summaries.
 * Never caches money-posting or auth mutations.
 */

const STORE = new Map();

export function cacheKey(parts = []) {
  return parts.map((p) => String(p ?? "")).join("::");
}

export function cacheGet(key) {
  const row = STORE.get(key);
  if (!row) return null;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    STORE.delete(key);
    return null;
  }
  return row.value;
}

export function cacheSet(key, value, ttlMs = 15_000) {
  STORE.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0
  });
  return value;
}

export function cacheInvalidate(prefix = "") {
  if (!prefix) {
    STORE.clear();
    return;
  }
  for (const key of STORE.keys()) {
    if (String(key).startsWith(prefix)) STORE.delete(key);
  }
}

export function withReadCache(key, ttlMs, producer) {
  const hit = cacheGet(key);
  if (hit != null) return { ...hit, _cache: "hit" };
  const value = producer();
  cacheSet(key, value, ttlMs);
  return { ...value, _cache: "miss" };
}
