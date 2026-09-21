/**
 * Wave 3 operation route registry.
 * Versioned in-process contracts (e.g. v1/customers.register).
 */

import { parseOperationId } from "./versioning.js";

const OPERATIONS = new Map();
const HANDLERS = new Map();

export function registerOperation(def = {}, handler) {
  const parsed = parseOperationId(def.id);
  if (!parsed.ok) {
    throw new Error(`Invalid operation id: ${def.id}`);
  }
  const operation = Object.freeze({
    id: parsed.id,
    version: parsed.version,
    domain: parsed.domain,
    action: parsed.action,
    kind: def.kind || "command",
    permission: def.permission || "",
    authRequired: def.authRequired !== false && def.public !== true,
    public: def.public === true,
    tenantScoped: def.tenantScoped !== false,
    branchScoped: def.branchScoped === true,
    idempotent: def.idempotent === true || def.kind === "query",
    posting: def.posting === true,
    deprecated: def.deprecated === true,
    sunset: def.sunset || null,
    rateLimitKey: def.rateLimitKey || `${parsed.domain}.${def.kind || "command"}`,
    schema: def.schema || null,
    description: def.description || "",
    summary: def.summary || def.description || parsed.id,
    contractAlias: def.contractAlias || "",
    tags: Object.freeze([...(def.tags || [parsed.domain])]),
    cacheTtlMs: Number(def.cacheTtlMs || 0)
  });
  OPERATIONS.set(operation.id, operation);
  if (typeof handler === "function") HANDLERS.set(operation.id, handler);
  return operation;
}

export function registerHandler(operationId, handler) {
  const parsed = parseOperationId(operationId);
  const id = parsed.ok ? parsed.id : operationId;
  if (typeof handler !== "function") HANDLERS.delete(id);
  else HANDLERS.set(id, handler);
}

export function getOperation(operationId) {
  const parsed = parseOperationId(operationId);
  return OPERATIONS.get(parsed.ok ? parsed.id : operationId) || null;
}

export function getHandler(operationId) {
  const parsed = parseOperationId(operationId);
  return HANDLERS.get(parsed.ok ? parsed.id : operationId) || null;
}

export function listOperations(filter = {}) {
  let rows = [...OPERATIONS.values()];
  if (filter.domain) rows = rows.filter((o) => o.domain === filter.domain);
  if (filter.version) rows = rows.filter((o) => o.version === filter.version);
  if (filter.kind) rows = rows.filter((o) => o.kind === filter.kind);
  if (filter.tag) rows = rows.filter((o) => o.tags.includes(filter.tag));
  return rows;
}

export function operationsByDomain() {
  const out = {};
  for (const op of OPERATIONS.values()) {
    out[op.domain] = out[op.domain] || [];
    out[op.domain].push(op.id);
  }
  return out;
}

export function operationCountsByDomain() {
  const out = {};
  for (const op of OPERATIONS.values()) {
    out[op.domain] = (out[op.domain] || 0) + 1;
  }
  return out;
}

export function clearOperationRegistry() {
  OPERATIONS.clear();
  HANDLERS.clear();
}
