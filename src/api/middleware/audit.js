/**
 * Audit hooks for Wave 3 API invocations.
 */

import { recordAuditEvent } from "../../core/audit-ops.js";
import { logFoundation } from "../../core/foundation-logging.js";

export function auditApiInvocation(state, {
  operation,
  user,
  correlationId,
  requestId,
  ok,
  durationMs,
  errorCode = "",
  uid
} = {}) {
  const details = `${operation?.id || "unknown"} ${ok ? "ok" : "fail"} ${errorCode || ""}`.trim();
  recordAuditEvent(state, {
    action: ok ? "API.Invoke" : "API.Reject",
    details,
    userId: user?.id || "",
    username: user?.username,
    category: ok ? "operational" : "security",
    module: "20",
    correlationId,
    guarantee: operation?.posting ? "G1" : "G2",
    payload: {
      operationId: operation?.id,
      requestId,
      durationMs,
      errorCode: errorCode || undefined,
      domain: operation?.domain
    }
  }, uid);

  logFoundation(state, {
    category: "api",
    level: ok ? "info" : "warn",
    message: details,
    correlationId,
    meta: { operationId: operation?.id, durationMs, errorCode }
  });
}
