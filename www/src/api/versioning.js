/**
 * API versioning + deprecation metadata for Wave 3 platform.
 * Headers are response metadata on in-process envelopes (no HTTP server).
 */

export const API_PLATFORM_VERSION = "1.0.0";
export const SUPPORTED_API_VERSIONS = Object.freeze(["v1"]);
export const DEFAULT_API_VERSION = "v1";

export const VERSION_META = Object.freeze({
  v1: Object.freeze({
    id: "v1",
    status: "active",
    introduced: "2026-09-15",
    deprecated: false,
    sunset: null
  }),
  v2: Object.freeze({
    id: "v2",
    status: "preview",
    introduced: null,
    deprecated: false,
    sunset: null
  })
});

export function parseOperationId(operationId = "") {
  const raw = String(operationId || "").trim();
  const m = raw.match(/^(v\d+)\/([a-z0-9_-]+)\.([a-z0-9_.-]+)$/i);
  if (!m) {
    return { ok: false, version: "", domain: "", action: "", id: raw };
  }
  return {
    ok: true,
    version: m[1].toLowerCase(),
    domain: m[2].toLowerCase(),
    action: m[3],
    id: `${m[1].toLowerCase()}/${m[2].toLowerCase()}.${m[3]}`
  };
}

export function buildVersionHeaders(operation = {}, { now = new Date().toISOString() } = {}) {
  const version = operation.version || DEFAULT_API_VERSION;
  const meta = VERSION_META[version] || VERSION_META.v1;
  const headers = {
    "X-API-Version": version,
    "X-API-Platform-Version": API_PLATFORM_VERSION,
    "X-API-Operation": operation.id || "",
    "X-API-Generated-At": typeof now === "number" ? new Date(now).toISOString() : String(now)
  };
  if (operation.deprecated || meta.deprecated) {
    headers["Deprecation"] = "true";
    headers["Sunset"] = operation.sunset || meta.sunset || "";
    headers["Link"] = `</docs/openapi/wave3-api.openapi.json>; rel="deprecation"; type="application/json"`;
  }
  return headers;
}

export function isVersionSupported(version) {
  return SUPPORTED_API_VERSIONS.includes(String(version || "").toLowerCase());
}
