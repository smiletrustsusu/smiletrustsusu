/**
 * Wave 3 API platform bootstrap + public exports.
 */

import { createRepositories } from "../core/repositories/index.js";
import { createDomainServices } from "../core/services/domain-services.js";
import { registerAllControllers } from "./controllers/register-controllers.js";
import { clearOperationRegistry, listOperations, operationCountsByDomain } from "./route-registry.js";
import { invokeApi, apiPlatformCatalog } from "./gateway.js";
import { buildOpenApiDocument, openApiJson } from "./openapi.js";
import { API_PLATFORM_VERSION } from "./versioning.js";
import { configureRateLimit } from "./middleware/rate-limit.js";

let bootstrapped = false;

export function bootstrapApiPlatform(state = {}, { uid, now, actor, force = false } = {}) {
  // Always rebind controllers to the provided state (handlers close over services/repos).
  clearOperationRegistry();
  state.apiPlatform = state.apiPlatform || { invocations: [], rateLimits: {} };
  configureRateLimit(state, {
    default: { perMinute: 180, burst: 40 },
    "collections.command": { perMinute: 60, burst: 15 },
    "savings.command": { perMinute: 60, burst: 15 },
    "loans.command": { perMinute: 40, burst: 10 }
  });
  const repos = createRepositories(state);
  const services = createDomainServices(state, repos, { uid, now, user: actor });
  registerAllControllers(services);
  bootstrapped = true;
  return createApiPlatformHandle(state, { uid, now, actor, repos, services });
}

function createApiPlatformHandle(state, { uid, now, actor, repos, services } = {}) {
  const resolvedRepos = repos || createRepositories(state);
  const resolvedServices = services || createDomainServices(state, resolvedRepos, { uid, now, user: actor });
  return {
    version: API_PLATFORM_VERSION,
    wave: "WAVE-03",
    invoke: (request, ctx = {}) => invokeApi(state, request, {
      uid: ctx.uid || uid,
      now: ctx.now || now,
      user: ctx.user || actor
    }),
    catalog: () => apiPlatformCatalog(),
    operations: () => listOperations(),
    countsByDomain: () => operationCountsByDomain(),
    openapi: () => buildOpenApiDocument(),
    openapiJson: () => openApiJson(),
    repos: resolvedRepos,
    services: resolvedServices
  };
}

export function createApiPlatform(state, opts = {}) {
  return bootstrapApiPlatform(state, opts);
}

export function isApiPlatformBootstrapped() {
  return bootstrapped;
}

export function resetApiPlatformForTests() {
  bootstrapped = false;
  clearOperationRegistry();
}

export {
  invokeApi,
  apiPlatformCatalog,
  buildOpenApiDocument,
  openApiJson,
  API_PLATFORM_VERSION
};
