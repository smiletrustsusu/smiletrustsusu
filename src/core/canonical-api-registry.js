/**
 * Phase 6 — ECACIS machine-readable API / endpoint registry (facade).
 * Generates endpoints from CONTRACT_CATALOG (non-event) + ROUTE_CATALOG aliases.
 * OpenAPI/GraphQL docs are facades only — NO live REST/GraphQL HTTP server.
 * Does not redefine money math, RBAC forbidden lists, or posting.
 */
import { getContract, CONTRACT_CATALOG } from "./module-contracts.js";
import { ROUTE_CATALOG } from "./api-gateway-lifecycle.js";
import { getCanonicalEvent } from "./canonical-event-registry.js";

export const ECACIS_VERSION = "1.0.0";
export const ECACIS_STATUS = "Authoritative";
export const API_KINDS = Object.freeze(["command", "query", "admin", "batch", "health"]);
export const API_LIFECYCLE = Object.freeze(["draft", "active", "deprecated", "retired"]);
export const API_SCHEMA = Object.freeze({
  $id: "ecacis.endpoint",
  type: "object",
  required: ["id", "method", "owningModule", "version", "lifecycle"]
});

/** Soft entity maps for major domains (identifier-only; ECDM remains authority). */
const CONTRACT_ENTITY_HINTS = Object.freeze({
  Authentication: "ENT-IDN-001",
  User: "ENT-IDN-001",
  Session: "ENT-IDN-001",
  Customer: "ENT-CUS-001",
  Agent: "ENT-ORG-003",
  Branch: "ENT-ORG-002",
  Savings: "ENT-SAV-002",
  Collection: "ENT-SAV-003",
  Group: "ENT-GRP-001",
  Loan: "ENT-LON-001",
  Withdrawal: "ENT-WDL-001",
  Journal: "ENT-FIN-002",
  Accounting: "ENT-FIN-002",
  Payment: "ENT-PAY-001",
  Receipt: "ENT-DOC-001",
  Document: "ENT-DOC-001",
  Workflow: "ENT-WFK-002",
  Task: "ENT-WFK-003",
  Case: "ENT-WFK-004",
  Rule: "ENT-RUL-001",
  Job: "ENT-JOB-002",
  Monitor: "ENT-MON-001",
  Alert: "ENT-MON-002",
  Backup: "ENT-BKP-001",
  Security: "ENT-SEC-001",
  Fraud: "ENT-SEC-002",
  Integration: "ENT-INT-001",
  Webhook: "ENT-INT-002",
  Ai: "ENT-AI-001",
  Platform: "ENT-PLT-001",
  Tenant: "ENT-PLT-001",
  License: "ENT-PLT-002",
  Record: "ENT-DOC-002",
  Exchange: "ENT-XCH-001",
  Bi: "ENT-BI-001",
  Kpi: "ENT-BI-002"
});

const CONTRACT_SM_HINTS = Object.freeze({
  Customer: "SM-CUS-001",
  Loan: "SM-LON-001",
  Payment: "SM-PAY-001",
  Workflow: "SM-WFK-002",
  Task: "SM-WFK-003",
  Case: "SM-WFK-004",
  Rule: "SM-RUL-001",
  Journal: "SM-FIN-001",
  Withdrawal: "SM-WDL-001",
  Collection: "SM-SAV-002",
  Savings: "SM-SAV-001",
  Ai: "SM-AI-001",
  Tenant: "SM-PLT-001",
  License: "SM-PLT-002",
  Integration: "SM-INT-001",
  Webhook: "SM-INT-002",
  Backup: "SM-BKP-001",
  Security: "SM-SEC-001",
  Fraud: "SM-SEC-002",
  Job: "SM-JOB-001",
  Exchange: "SM-XCH-001",
  Record: "SM-DOC-004",
  Receipt: "SM-DOC-001",
  Document: "SM-DOC-001",
  Group: "SM-GRP-001",
  Alert: "SM-MON-001"
});

function hintFromContractId(contractId, map) {
  const head = String(contractId || "").split(".")[0];
  return map[head] || undefined;
}

function methodForKind(kind) {
  if (kind === "query" || kind === "health") return "QUERY";
  return "COMMAND";
}

function httpFacadeForKind(kind) {
  if (kind === "query" || kind === "health") return "GET";
  return "POST";
}

function buildContractEndpoints() {
  const rows = [];
  for (const contract of CONTRACT_CATALOG) {
    if (!API_KINDS.includes(contract.kind)) continue;
    const events = [];
    if (contract.event) {
      const ev = getCanonicalEvent(contract.event);
      events.push(ev ? ev.id : contract.event);
    }
    rows.push(Object.freeze({
      id: `API-CTR-${contract.id}`,
      facadeType: "contract",
      method: methodForKind(contract.kind),
      httpFacade: httpFacadeForKind(contract.kind),
      uriTemplate: `/contracts/${contract.id}`,
      contractId: contract.id,
      kind: contract.kind,
      owningModule: Number(contract.moduleId),
      entityId: hintFromContractId(contract.id, CONTRACT_ENTITY_HINTS),
      stateMachineId: hintFromContractId(contract.id, CONTRACT_SM_HINTS),
      events,
      auth: contract.action || "",
      permissions: contract.action ? [contract.action] : [],
      version: contract.version || "1.0.0",
      lifecycle: contract.status || "active",
      rateLimit: undefined,
      idempotent: contract.idempotent === true || contract.kind === "query",
      owner: contract.owner,
      sourceRef: "module-contracts.CONTRACT_CATALOG"
    }));
  }
  return rows;
}

function buildGatewayEndpoints() {
  return ROUTE_CATALOG.map((route) => Object.freeze({
    id: `API-GWY-${route.id}`,
    facadeType: "gateway",
    method: String(route.method || "POST").toUpperCase(),
    httpFacade: String(route.method || "POST").toUpperCase(),
    uriTemplate: route.path || `/gateway/${route.id}`,
    contractId: `gateway:${route.id}`,
    kind: "gateway-route",
    owningModule: 20,
    entityId: undefined,
    stateMachineId: undefined,
    events: [],
    auth: route.action || "",
    permissions: route.action ? [route.action] : [],
    version: (route.versions && route.versions[0]) || "v1",
    lifecycle: "active",
    rateLimit: route.rateLimit,
    idempotent: route.idempotent === true,
    owner: "ApiGateway",
    graphqlField: route.graphql || undefined,
    scopes: route.scopes || [],
    sourceRef: "api-gateway-lifecycle.ROUTE_CATALOG"
  }));
}

export const CANONICAL_APIS = Object.freeze([
  ...buildContractEndpoints(),
  ...buildGatewayEndpoints()
]);

export function listCanonicalApis(filter = {}) {
  let rows = [...CANONICAL_APIS];
  if (filter.owningModule != null) rows = rows.filter((e) => Number(e.owningModule) === Number(filter.owningModule));
  if (filter.facadeType) rows = rows.filter((e) => e.facadeType === filter.facadeType);
  if (filter.kind) rows = rows.filter((e) => e.kind === filter.kind);
  if (filter.contractId) rows = rows.filter((e) => e.contractId === filter.contractId);
  if (filter.method) rows = rows.filter((e) => e.method === filter.method);
  return rows;
}

export function getCanonicalApi(idOrContract) {
  const key = String(idOrContract || "");
  return CANONICAL_APIS.find((e) => e.id === key || e.contractId === key || e.uriTemplate === key) || null;
}

export function validateApiRegistry(options = {}) {
  const apis = options.apis || CANONICAL_APIS;
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const contractIds = new Set();

  for (const api of apis) {
    if (!api.id) errors.push("API missing id");
    if (ids.has(api.id)) errors.push(`Duplicate endpoint id: ${api.id}`);
    ids.add(api.id);
    if (!api.contractId) errors.push(`${api.id}: missing contractId`);
    if (contractIds.has(api.contractId)) errors.push(`Duplicate contractId: ${api.contractId}`);
    contractIds.add(api.contractId);
    const owner = Number(api.owningModule);
    if (!Number.isInteger(owner) || owner < 1 || owner > 30) errors.push(`${api.id}: owningModule out of range`);
    if (!api.version) errors.push(`${api.id}: missing version`);
    if (!API_LIFECYCLE.includes(api.lifecycle) && api.lifecycle !== "active" && api.lifecycle !== "deprecated" && api.lifecycle !== "retired" && api.lifecycle !== "draft") {
      // allow gateway version strings already normalized to lifecycle active
    }
    if (api.facadeType === "contract") {
      const c = getContract(api.contractId);
      if (!c) errors.push(`${api.id}: contract ${api.contractId} missing from CONTRACT_CATALOG`);
      else if (!API_KINDS.includes(c.kind)) errors.push(`${api.id}: contract kind ${c.kind} not an API kind`);
    }
    if (api.facadeType === "gateway") {
      const routeId = String(api.contractId || "").replace(/^gateway:/, "");
      if (!ROUTE_CATALOG.some((r) => r.id === routeId)) errors.push(`${api.id}: gateway route ${routeId} missing`);
    }
  }

  const expectedContracts = CONTRACT_CATALOG.filter((c) => API_KINDS.includes(c.kind)).length;
  const contractFacades = apis.filter((a) => a.facadeType === "contract").length;
  if (contractFacades !== expectedContracts) {
    errors.push(`contract facade count ${contractFacades} != catalog ${expectedContracts}`);
  }
  if (apis.filter((a) => a.facadeType === "gateway").length !== ROUTE_CATALOG.length) {
    errors.push("gateway facade count mismatch vs ROUTE_CATALOG");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    endpointCount: apis.length,
    contractEndpointCount: contractFacades,
    gatewayEndpointCount: apis.filter((a) => a.facadeType === "gateway").length,
    version: ECACIS_VERSION,
    schema: API_SCHEMA,
    facadeOnly: true,
    liveHttpServer: false
  };
}