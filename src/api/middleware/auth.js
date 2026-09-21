/**
 * Authentication middleware — session / actor required for protected ops.
 */

import { buildFoundationError } from "../../core/foundation-errors.js";
import { sessionStatus } from "../../core/auth-session-ops.js";

export function authenticateRequest(state, request = {}, operation = {}) {
  if (operation.authRequired === false || operation.public === true) {
    return { ok: true, user: request.user || null, method: "anonymous" };
  }
  const user = request.user || request.actor || null;
  if (!user) {
    return {
      ok: false,
      error: buildFoundationError("FND-001", { correlationId: request.correlationId || "" })
    };
  }
  if (user.active === false) {
    return {
      ok: false,
      error: buildFoundationError("FND-002", {
        message: "Account inactive",
        userMessage: "Your account is inactive.",
        correlationId: request.correlationId || ""
      })
    };
  }
  const status = sessionStatus(state.settings || {});
  if (status?.expired === true && operation.allowExpiredSession !== true) {
    return {
      ok: false,
      error: buildFoundationError("FND-001", { correlationId: request.correlationId || "" })
    };
  }
  return { ok: true, user, method: request.auth?.method || "session" };
}
