/**
 * Wave 3 unified in-process API gateway.
 * Clients call invokeApi — NO live REST/GraphQL HTTP server.
 */

import { getOperation, getHandler, listOperations, operationCountsByDomain } from "./route-registry.js";
import { buildVersionHeaders, parseOperationId, API_PLATFORM_VERSION } from "./versioning.js";
import { buildProblemDetails, problemFromFoundation } from "./problem-details.js";
import { resolveCorrelation } from "./middleware/correlation.js";
import { authenticateRequest } from "./middleware/auth.js";
import { authorizeRequest } from "./middleware/authz.js";
import { validateRequest } from "./middleware/validation.js";
import { checkRateLimit } from "./middleware/rate-limit.js";
import { auditApiInvocation } from "./middleware/audit.js";
import { recordMetric } from "../core/monitoring-ops.js";

function nowMs(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function nowIso(now) {
  return new Date(nowMs(now)).toISOString();
}

export async function invokeApi(state, request = {}, { uid, now, user } = {}) {
  const started = nowMs(now);
  const { correlationId, requestId } = resolveCorrelation(request, { uid });
  const operationId = request.operationId || request.operation || request.contractId || "";
  const parsed = parseOperationId(operationId);
  const actor = user || request.user || null;

  const fail = (errorLike, http = 400) => {
    const problem = errorLike?.type && errorLike?.title
      ? errorLike
      : problemFromFoundation(errorLike, { correlationId, instance: operationId });
    const operation = getOperation(operationId);
    const headers = buildVersionHeaders(operation || { id: operationId, version: parsed.version || "v1" }, { now: nowIso(now) });
    headers["X-Correlation-Id"] = correlationId;
    headers["X-Request-Id"] = requestId;
    auditApiInvocation(state, {
      operation: operation || { id: operationId },
      user: actor,
      correlationId,
      requestId,
      ok: false,
      durationMs: Math.max(0, Date.now() - started),
      errorCode: problem.code || errorLike?.errorCode || "",
      uid
    });
    try {
      recordMetric(state, {
        name: "api.invoke.fail",
        value: 1,
        tags: { operation: operationId, code: problem.code || "" }
      }, uid, now);
    } catch {
      /* monitoring optional */
    }
    return {
      ok: false,
      http: problem.status || http,
      requestId,
      correlationId,
      operationId,
      error: errorLike,
      problem,
      headers,
      timestamp: nowIso(now)
    };
  };

  if (!parsed.ok) {
    return fail(buildProblemDetails({
      type: "validation",
      title: "Invalid operation id",
      status: 400,
      detail: `Expected vN/domain.action, got: ${operationId}`,
      code: "API-400",
      correlationId,
      instance: operationId
    }));
  }

  const operation = getOperation(parsed.id);
  if (!operation) {
    return fail(buildProblemDetails({
      type: "not-found",
      title: "Unknown operation",
      status: 404,
      detail: `No handler registered for ${parsed.id}`,
      code: "API-404",
      correlationId,
      instance: parsed.id
    }), 404);
  }

  const req = {
    ...request,
    user: actor,
    correlationId,
    requestId,
    payload: request.payload || request.body || {},
    query: request.query || {}
  };

  const auth = authenticateRequest(state, req, operation);
  if (!auth.ok) return fail(auth.error, auth.error?.http || 401);

  const authz = authorizeRequest(state, req, operation, auth.user);
  if (!authz.ok) return fail(authz.error, authz.error?.http || 403);

  const rate = checkRateLimit(state, {
    actorKey: auth.user?.id || request.auth?.apiKey || "anon",
    operation,
    now: started
  });
  if (!rate.ok) return fail(rate.error, 429);

  const validation = validateRequest(req, operation);
  if (!validation.ok) return fail(validation.error, 400);

  const handler = getHandler(operation.id);
  if (!handler) {
    return fail(buildProblemDetails({
      type: "not-implemented",
      title: "No handler",
      status: 501,
      detail: `Operation ${operation.id} has no handler`,
      code: "API-501",
      correlationId,
      instance: operation.id
    }), 501);
  }

  let result;
  try {
    result = await handler(state, {
      ...req.payload,
      ...req.query
    }, {
      uid,
      now,
      user: auth.user,
      correlationId,
      requestId,
      authz,
      operation,
      header: { correlationId, requestId }
    });
  } catch (err) {
    return fail(buildProblemDetails({
      type: "system",
      title: "Handler failed",
      status: 500,
      detail: err?.message || "Handler failed",
      code: "API-500",
      correlationId,
      instance: operation.id
    }), 500);
  }

  if (result && result.ok === false) {
    return fail(result, result.http || 422);
  }

  const durationMs = Math.max(0, Date.now() - started);
  const headers = {
    ...buildVersionHeaders(operation, { now: nowIso(now) }),
    "X-Correlation-Id": correlationId,
    "X-Request-Id": requestId,
    "X-RateLimit-Remaining": String(rate.remaining ?? ""),
    "X-Response-Time-Ms": String(durationMs)
  };

  auditApiInvocation(state, {
    operation,
    user: auth.user,
    correlationId,
    requestId,
    ok: true,
    durationMs,
    uid
  });

  try {
    recordMetric(state, {
      name: "api.invoke.ok",
      value: 1,
      tags: { operation: operation.id, domain: operation.domain }
    }, uid, now);
  } catch {
    /* optional */
  }

  state.apiPlatform = state.apiPlatform || {};
  state.apiPlatform.invocations = state.apiPlatform.invocations || [];
  state.apiPlatform.invocations.push({
    id: requestId,
    operationId: operation.id,
    ok: true,
    durationMs,
    at: nowIso(now)
  });
  if (state.apiPlatform.invocations.length > 2000) {
    state.apiPlatform.invocations.splice(0, state.apiPlatform.invocations.length - 2000);
  }

  return {
    ok: true,
    http: 200,
    requestId,
    correlationId,
    operationId: operation.id,
    data: result,
    headers,
    timestamp: nowIso(now),
    meta: {
      platformVersion: API_PLATFORM_VERSION,
      version: operation.version,
      domain: operation.domain,
      posting: operation.posting === true
    }
  };
}

export function apiPlatformCatalog() {
  return {
    version: API_PLATFORM_VERSION,
    operations: listOperations(),
    countsByDomain: operationCountsByDomain()
  };
}
