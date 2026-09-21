/**
 * OpenAPI 3.1 document generator from Wave 3 route registry (facade docs only).
 */

import { listOperations } from "./route-registry.js";
import { API_PLATFORM_VERSION, SUPPORTED_API_VERSIONS } from "./versioning.js";

function httpMethodFor(kind) {
  if (kind === "query" || kind === "health") return "get";
  return "post";
}

function pathFor(operation) {
  return `/api/${operation.version}/${operation.domain}/${operation.action}`;
}

export function buildOpenApiDocument(options = {}) {
  const operations = options.operations || listOperations();
  const paths = {};
  const tags = new Map();

  for (const op of operations) {
    const path = pathFor(op);
    const method = httpMethodFor(op.kind);
    tags.set(op.domain, { name: op.domain, description: `${op.domain} domain contracts` });
    paths[path] = paths[path] || {};
    paths[path][method] = {
      operationId: op.id,
      summary: op.summary || op.id,
      description: [
        op.description || op.summary || "",
        "In-process invokeApi facade — not a live HTTP listener.",
        op.contractAlias ? `Contract alias: ${op.contractAlias}` : "",
        op.posting ? "Posting: JS ops SoT; optional Wave 2 RPC dual-write when postgresSourceOfTruth." : ""
      ].filter(Boolean).join(" "),
      tags: [...op.tags],
      deprecated: op.deprecated === true,
      security: op.public ? [] : [{ session: [] }],
      parameters: [
        {
          name: "X-Correlation-Id",
          in: "header",
          required: false,
          schema: { type: "string" }
        },
        {
          name: "X-API-Version",
          in: "header",
          required: false,
          schema: { type: "string", enum: [...SUPPORTED_API_VERSIONS] }
        }
      ],
      requestBody: method === "get" ? undefined : {
        required: true,
        content: {
          "application/json": {
            schema: op.schema || { type: "object", additionalProperties: true }
          }
        }
      },
      responses: {
        "200": {
          description: "Success envelope",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SuccessEnvelope" }
            }
          }
        },
        "400": { description: "Validation problem details", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        "401": { description: "Authentication problem details", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        "403": { description: "Authorization problem details", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        "429": { description: "Rate limit", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } }
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "SMILE TRUST SUSU — Wave 3 Backend API Platform",
      version: API_PLATFORM_VERSION,
      description: "In-process contract API platform. Call via invokeApi / createApiPlatform. No REST/GraphQL HTTP server. Money in integer pesewas; interest 15; collection days 31; cashier GHS 1000."
    },
    servers: [
      { url: "in-process://smile-trust/invokeApi", description: "In-process gateway (canonical)" }
    ],
    tags: [...tags.values()],
    paths,
    components: {
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "header",
          name: "X-Session-User",
          description: "SPA session actor passed to invokeApi({ user })"
        }
      },
      schemas: {
        SuccessEnvelope: {
          type: "object",
          required: ["ok", "operationId", "correlationId"],
          properties: {
            ok: { type: "boolean", const: true },
            http: { type: "integer" },
            operationId: { type: "string" },
            correlationId: { type: "string" },
            requestId: { type: "string" },
            data: { type: "object", additionalProperties: true },
            headers: { type: "object", additionalProperties: { type: "string" } },
            meta: { type: "object", additionalProperties: true }
          }
        },
        ProblemDetails: {
          type: "object",
          required: ["type", "title", "status"],
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            instance: { type: "string" },
            code: { type: "string" },
            correlationId: { type: "string" },
            errors: { type: "array", items: { type: "object" } },
            retryable: { type: "boolean" }
          }
        }
      }
    },
    "x-smile-trust": {
      invokeEntry: "invokeApi(state, request, { uid, now, user })",
      moneyUnit: "pesewas",
      loanInterestDefault: 15,
      collectionDaysDefault: 31,
      cashierLimitGhs: 1000,
      httpServer: false,
      graphqlServer: false
    }
  };
}

export function openApiJson(options = {}) {
  return JSON.stringify(buildOpenApiDocument(options), null, 2);
}
