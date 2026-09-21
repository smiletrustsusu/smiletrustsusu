/**
 * Wave 1 — Foundation error catalog & global handler.
 * Maps onto existing in-process contract / ops error patterns.
 * Does not introduce HTTP servers.
 */

export const FOUNDATION_ERROR_VERSION = "1.0.0";

export const ERROR_CATEGORIES = Object.freeze([
  "authentication",
  "authorization",
  "validation",
  "configuration",
  "sync",
  "storage",
  "security",
  "system",
  "performance",
  "business"
]);

/** @type {ReadonlyArray<{ code: string, category: string, message: string, userMessage: string, retryable: boolean, http: number }>} */
export const FOUNDATION_ERROR_CATALOG = Object.freeze([
  Object.freeze({ code: "FND-001", category: "authentication", message: "Session missing or expired", userMessage: "Please sign in again.", retryable: false, http: 401 }),
  Object.freeze({ code: "FND-002", category: "authentication", message: "Invalid credentials", userMessage: "Username or password is incorrect.", retryable: false, http: 401 }),
  Object.freeze({ code: "FND-003", category: "authentication", message: "Account locked", userMessage: "Account temporarily locked. Try again later.", retryable: true, http: 423 }),
  Object.freeze({ code: "FND-004", category: "authentication", message: "Password reset required", userMessage: "You must reset your password before continuing.", retryable: false, http: 403 }),
  Object.freeze({ code: "FND-005", category: "authorization", message: "Permission denied", userMessage: "You do not have permission for this action.", retryable: false, http: 403 }),
  Object.freeze({ code: "FND-006", category: "authorization", message: "SUPER_ADMIN_FORBIDDEN action", userMessage: "This action is reserved for the System Owner.", retryable: false, http: 403 }),
  Object.freeze({ code: "FND-007", category: "validation", message: "Invalid input", userMessage: "Please check the form and try again.", retryable: false, http: 400 }),
  Object.freeze({ code: "FND-008", category: "configuration", message: "Feature disabled", userMessage: "This feature is currently unavailable.", retryable: true, http: 503 }),
  Object.freeze({ code: "FND-009", category: "configuration", message: "Tenant or branch context missing", userMessage: "Select a valid branch before continuing.", retryable: false, http: 400 }),
  Object.freeze({ code: "FND-010", category: "sync", message: "Offline queue persist failed", userMessage: "Could not save offline work. Retry when storage is available.", retryable: true, http: 500 }),
  Object.freeze({ code: "FND-011", category: "sync", message: "Offline queue recovery failed", userMessage: "Offline queue could not be recovered. Contact support if this persists.", retryable: true, http: 500 }),
  Object.freeze({ code: "FND-012", category: "storage", message: "Secure storage unavailable", userMessage: "Secure storage is unavailable on this device.", retryable: true, http: 500 }),
  Object.freeze({ code: "FND-013", category: "security", message: "Secrets handling violation", userMessage: "A security rule blocked this operation.", retryable: false, http: 400 }),
  Object.freeze({ code: "FND-014", category: "system", message: "Unhandled application error", userMessage: "Something went wrong. Please try again.", retryable: true, http: 500 }),
  Object.freeze({ code: "FND-015", category: "performance", message: "Operation timed out", userMessage: "The operation took too long. Please retry.", retryable: true, http: 504 }),
  Object.freeze({ code: "FND-016", category: "business", message: "Business rule rejected", userMessage: "This action was rejected by a business rule.", retryable: false, http: 422 })
]);

const BY_CODE = Object.freeze(
  Object.fromEntries(FOUNDATION_ERROR_CATALOG.map((row) => [row.code, row]))
);

export function getFoundationError(code) {
  return BY_CODE[code] || null;
}

export function buildFoundationError(code, extras = {}) {
  const base = getFoundationError(code) || getFoundationError("FND-014");
  return {
    ok: false,
    errorCode: base.code,
    category: extras.category || base.category,
    error: extras.message || base.message,
    userMessage: extras.userMessage || base.userMessage,
    retryable: extras.retryable ?? base.retryable,
    http: extras.http ?? base.http,
    correlationId: extras.correlationId || "",
    details: extras.details || null,
    cause: extras.cause || null
  };
}

export function isRetryableError(errorLike) {
  if (!errorLike) return false;
  if (typeof errorLike.retryable === "boolean") return errorLike.retryable;
  const code = errorLike.errorCode || errorLike.code;
  const row = code ? getFoundationError(code) : null;
  return row ? row.retryable === true : false;
}

export function userFacingMessage(errorLike, fallback = "Something went wrong. Please try again.") {
  if (!errorLike) return fallback;
  if (errorLike.userMessage) return String(errorLike.userMessage);
  const code = errorLike.errorCode || errorLike.code;
  const row = code ? getFoundationError(code) : null;
  if (row) return row.userMessage;
  if (errorLike.error && typeof errorLike.error === "string") return errorLike.error;
  if (errorLike.message) return String(errorLike.message);
  return fallback;
}

export function normalizeThrown(err, { code = "FND-014", correlationId = "" } = {}) {
  if (err && err.errorCode && err.userMessage) {
    return { ...err, correlationId: err.correlationId || correlationId };
  }
  const message = err?.message || String(err || "Unknown error");
  return buildFoundationError(code, {
    message,
    details: err?.stack ? { name: err.name || "Error" } : null,
    correlationId,
    cause: err || null
  });
}

let globalHandler = null;
const recentErrors = [];
const MAX_RECENT = 100;

export function setGlobalErrorHandler(handler) {
  globalHandler = typeof handler === "function" ? handler : null;
  return globalHandler;
}

export function getGlobalErrorHandler() {
  return globalHandler;
}

export function listRecentFoundationErrors() {
  return recentErrors.slice();
}

export function clearRecentFoundationErrors() {
  recentErrors.length = 0;
}

export function handleFoundationError(err, context = {}) {
  const normalized = normalizeThrown(err, {
    code: context.code || "FND-014",
    correlationId: context.correlationId || ""
  });
  const entry = {
    ...normalized,
    source: context.source || "foundation",
    at: new Date().toISOString()
  };
  recentErrors.push(entry);
  if (recentErrors.length > MAX_RECENT) recentErrors.splice(0, recentErrors.length - MAX_RECENT);
  if (globalHandler) {
    try {
      globalHandler(entry, context);
    } catch {
      /* never throw from handler path */
    }
  }
  if (typeof context.onLog === "function") {
    try {
      context.onLog(entry);
    } catch {
      /* ignore */
    }
  }
  return entry;
}

export function withFoundationErrorBoundary(fn, context = {}) {
  return function foundationGuarded(...args) {
    try {
      const result = fn(...args);
      if (result && typeof result.then === "function") {
        return result.catch((err) => {
          const handled = handleFoundationError(err, context);
          if (context.rethrow) throw Object.assign(new Error(handled.userMessage), handled);
          return handled;
        });
      }
      return result;
    } catch (err) {
      const handled = handleFoundationError(err, context);
      if (context.rethrow) throw Object.assign(new Error(handled.userMessage), handled);
      return handled;
    }
  };
}
