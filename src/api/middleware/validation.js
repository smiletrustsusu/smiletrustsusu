/**
 * Input validation envelopes for registered operations.
 */

import { buildFoundationError } from "../../core/foundation-errors.js";

export function validatePayload(payload = {}, schema = {}) {
  const errors = [];
  const required = schema.required || [];
  for (const key of required) {
    const value = payload[key];
    if (value == null || value === "") {
      errors.push({ field: key, message: `${key} is required` });
    }
  }
  const props = schema.properties || {};
  for (const [key, rule] of Object.entries(props)) {
    if (!(key in payload) || payload[key] == null || payload[key] === "") continue;
    const value = payload[key];
    if (rule.type === "number" && !Number.isFinite(Number(value))) {
      errors.push({ field: key, message: `${key} must be a number` });
    }
    if (rule.type === "string" && typeof value !== "string") {
      errors.push({ field: key, message: `${key} must be a string` });
    }
    if (rule.type === "integer" || rule.format === "pesewas") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        errors.push({ field: key, message: `${key} must be a non-negative integer (pesewas)` });
      }
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({ field: key, message: `${key} is not an allowed value` });
    }
    if (rule.minLength != null && String(value).length < rule.minLength) {
      errors.push({ field: key, message: `${key} is too short` });
    }
    if (rule.minimum != null && Number(value) < rule.minimum) {
      errors.push({ field: key, message: `${key} is below minimum` });
    }
  }
  if (schema.pesewasFields) {
    for (const key of schema.pesewasFields) {
      if (payload[key] == null) continue;
      const n = Number(payload[key]);
      if (!Number.isInteger(n)) {
        errors.push({ field: key, message: `${key} must be integer pesewas` });
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateRequest(request = {}, operation = {}) {
  if (!operation.schema) return { ok: true, errors: [] };
  const payload = {
    ...(request.query || {}),
    ...(request.payload || {}),
    ...(request.body || {})
  };
  const result = validatePayload(payload, operation.schema);
  if (!result.ok) {
    return {
      ok: false,
      error: buildFoundationError("FND-007", {
        details: result.errors,
        correlationId: request.correlationId || ""
      }),
      errors: result.errors
    };
  }
  return result;
}
