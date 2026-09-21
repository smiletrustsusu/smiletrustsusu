/**
 * Wave 3 — Enterprise Backend Services & API Platform facade.
 * In-process SoT for versioned contract operations. No HTTP listeners.
 */

import {
  createApiPlatform,
  bootstrapApiPlatform,
  invokeApi,
  apiPlatformCatalog,
  buildOpenApiDocument,
  openApiJson,
  API_PLATFORM_VERSION,
  resetApiPlatformForTests,
  isApiPlatformBootstrapped
} from "../api/index.js";
import { operationCountsByDomain, listOperations } from "../api/route-registry.js";
import { cloudPersistenceEnabled } from "./repositories/index.js";

export const WAVE3_VERSION = API_PLATFORM_VERSION;
export const WAVE3_WAVE = "WAVE-03";

export {
  createApiPlatform,
  bootstrapApiPlatform,
  invokeApi,
  apiPlatformCatalog,
  buildOpenApiDocument,
  openApiJson,
  resetApiPlatformForTests,
  isApiPlatformBootstrapped,
  operationCountsByDomain,
  listOperations,
  cloudPersistenceEnabled
};

export function wave3SmokeChecklist(state, actor = null) {
  const platform = createApiPlatform(state, { actor });
  const counts = platform.countsByDomain();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    wave: WAVE3_WAVE,
    version: WAVE3_VERSION,
    httpServer: false,
    graphqlServer: false,
    operationCount: total,
    domains: counts,
    cloudPersistence: cloudPersistenceEnabled(state),
    moneyDefaults: platform.services.configuration.moneyDefaults(),
    openApiOperations: (platform.openapi().paths && Object.keys(platform.openapi().paths).length) || 0
  };
}
