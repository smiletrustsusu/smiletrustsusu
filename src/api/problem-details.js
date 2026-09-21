/**
 * RFC 9457-style problem details for the in-process API platform.
 * Not an HTTP listener — objects travel inside invokeApi envelopes.
 */

export const PROBLEM_DETAILS_TYPE_BASE = "https://smiletrust.local/problems";

export function buildProblemDetails({
  type = "about:blank",
  title = "Error",
  status = 500,
  detail = "",
  instance = "",
  code = "",
  correlationId = "",
  errors = [],
  extras = {}
} = {}) {
  const problem = {
    type: type.startsWith("http") || type === "about:blank"
      ? type
      : `${PROBLEM_DETAILS_TYPE_BASE}/${type}`,
    title,
    status: Number(status) || 500,
    detail: detail || title,
    instance: instance || undefined,
    code: code || undefined,
    correlationId: correlationId || undefined,
    errors: Array.isArray(errors) && errors.length ? errors : undefined,
    ...extras
  };
  Object.keys(problem).forEach((key) => {
    if (problem[key] === undefined) delete problem[key];
  });
  return problem;
}

export function problemFromFoundation(errorLike, { correlationId = "", instance = "" } = {}) {
  return buildProblemDetails({
    type: errorLike?.category || "system",
    title: errorLike?.error || errorLike?.message || "Request failed",
    status: errorLike?.http || 500,
    detail: errorLike?.userMessage || errorLike?.error || "Request failed",
    code: errorLike?.errorCode || errorLike?.code || "API-ERROR",
    correlationId: correlationId || errorLike?.correlationId || "",
    instance,
    errors: errorLike?.details
      ? (Array.isArray(errorLike.details) ? errorLike.details : [errorLike.details])
      : [],
    extras: { retryable: errorLike?.retryable === true }
  });
}
