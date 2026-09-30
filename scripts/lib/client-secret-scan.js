/**
 * Detects privileged secrets in client-distributed files (www/, unpacked APK, unpacked EXE).
 * Findings name the file and rule only; matched values are never returned or printed.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** SHA-256 of the default passwords that older builds shipped (values intentionally absent). */
const LEGACY_DEFAULT_PASSWORD_DIGESTS = Object.freeze([
  "f9a78464d1428b03ed04bcef318491614d11582986fa18447f72ae40b8a29d4d",
  "9c94ca721fcde41a66e566ac2eef3efc37ac72e9989f1e9f9120ed8900d8526a",
  "c08a3bce4b27c7ede12d109dff2bce22adec4d6d3bf9de819da1cf42916b09e8"
]);

const FORBIDDEN_CONFIG_KEYS = Object.freeze([
  "defaultOwnerPassword",
  "developerPassword",
  "defaultKbaPassword",
  "defaultSuperAdminPassword",
  "defaultDeveloperPassword",
  "syncAccessKey",
  "syncToken",
  "serviceRoleKey",
  "supabaseServiceRoleKey",
  "momoWebhookSecret"
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".json", ".html", ".htm", ".css", ".txt", ".xml",
  ".properties", ".map", ".webmanifest", ".md", ".env", ".yml", ".yaml", ".toml", ".ini"
]);
const SIGNING_FILE = /\.(jks|keystore|p12|pfx|pem|key)$|^keystore\.properties$|^\.env(\..+)?$/i;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;
const SUPABASE_SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{16,}/;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const STRING_LITERAL = /"((?:[^"\\\r\n]|\\.){1,128})"|'((?:[^'\\\r\n]|\\.){1,128})'|`([^`\\$\r\n]{1,128})`/g;
const PRIVILEGED_JWT_ROLES = new Set(["service_role", "supabase_admin", "postgres"]);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const SUPABASE_PROJECT_URL = /https?:\/\/([a-z]{20})\.supabase\.co/g;

function jwtClaims(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(part, "base64").toString("utf8")) || {};
  } catch {
    return {};
  }
}

function jwtRole(token) {
  return jwtClaims(token).role || "";
}

/** Supabase project refs a file points at: project URLs plus the ref claim of legacy API keys. */
function backendRefsInBuffer(buffer) {
  const text = buffer.toString("latin1");
  const refs = new Set();
  for (const match of text.matchAll(SUPABASE_PROJECT_URL)) refs.add(match[1]);
  for (const match of text.matchAll(JWT)) {
    const ref = jwtClaims(match[0]).ref;
    if (typeof ref === "string" && /^[a-z]{20}$/.test(ref)) refs.add(ref);
  }
  return refs;
}

/**
 * Values that must never appear in a client artifact, read from the local (git-ignored)
 * config.json and the environment at scan time. Short values are skipped to avoid noise.
 */
function localSecretValues(root, env = process.env) {
  const values = [];
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
    for (const key of FORBIDDEN_CONFIG_KEYS) {
      const value = String(config[key] ?? "").trim();
      if (value.length >= 8) values.push({ label: `config.json:${key}`, value });
    }
  } catch {
    // No local config.json.
  }
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SYNC_TOKEN", "MOMO_WEBHOOK_SECRET"]) {
    const value = String(env[key] || "").trim();
    if (value.length >= 8) values.push({ label: `env:${key}`, value });
  }
  return values;
}

function scanBuffer(relPath, buffer, { secretValues = [], legacyDigests = LEGACY_DEFAULT_PASSWORD_DIGESTS } = {}) {
  const findings = [];
  const base = path.basename(relPath);
  const ext = path.extname(base).toLowerCase();
  const add = (rule, detail) => findings.push({ file: relPath, rule, detail });

  if (SIGNING_FILE.test(base)) add("signing-material-file", `file type ${ext || base} must not ship`);

  for (const { label, value } of secretValues) {
    if (buffer.indexOf(value) !== -1) add("known-secret-value", `contains the value of ${label}`);
  }

  const text = buffer.toString("latin1");
  if (PRIVATE_KEY.test(text)) add("private-key", "PEM private key block");
  if (SUPABASE_SECRET_KEY.test(text)) add("supabase-secret-key", "Supabase secret API key");
  for (const match of text.matchAll(JWT)) {
    const role = jwtRole(match[0]);
    if (PRIVILEGED_JWT_ROLES.has(role)) add("privileged-jwt", `JWT with role ${role}`);
  }

  if (!TEXT_EXTENSIONS.has(ext)) return findings;
  const utf8 = buffer.toString("utf8");
  const legacy = new Set(legacyDigests);
  for (const match of utf8.matchAll(STRING_LITERAL)) {
    const literal = match[1] ?? match[2] ?? match[3] ?? "";
    if (literal.length >= 4 && legacy.has(sha256(literal))) {
      add("legacy-default-password", "string literal equals a default password shipped by older builds");
    }
  }
  if (ext === ".json") {
    try {
      const parsed = JSON.parse(utf8);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const key of FORBIDDEN_CONFIG_KEYS) {
          if (String(parsed[key] ?? "").trim()) add("forbidden-config-key", `non-empty "${key}"`);
        }
      }
    } catch {
      // Not a JSON object.
    }
  }
  return findings;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/**
 * `expectBackend`: the only Supabase project ref the artifact may reference. Any other ref is a
 * finding, and so is an app config.json that does not point at the expected project.
 */
function scanDirectory(dir, options = {}) {
  const findings = [];
  const backends = new Map();
  let files = 0;
  let expectedInConfig = false;
  for (const full of walk(dir)) {
    files += 1;
    const rel = path.relative(dir, full).split(path.sep).join("/");
    const buffer = fs.readFileSync(full);
    findings.push(...scanBuffer(rel, buffer, options));
    for (const ref of backendRefsInBuffer(buffer)) {
      if (!backends.has(ref)) backends.set(ref, []);
      backends.get(ref).push(rel);
    }
    if (options.expectBackend && path.basename(rel) === "config.json") {
      try {
        const url = String(JSON.parse(buffer.toString("utf8"))?.supabaseUrl || "");
        if (url === `https://${options.expectBackend}.supabase.co`) expectedInConfig = true;
      } catch {
        // Not a JSON object.
      }
    }
  }
  if (options.expectBackend) {
    for (const [ref, where] of backends) {
      if (ref !== options.expectBackend) {
        for (const file of where) findings.push({ file, rule: "unexpected-backend", detail: `references Supabase project ${ref}` });
      }
    }
    if (!expectedInConfig) {
      findings.push({ file: "config.json", rule: "expected-backend-missing", detail: `no app config.json points at ${options.expectBackend}` });
    }
  }
  return {
    files,
    findings,
    backends: [...backends].map(([ref, where]) => ({ ref, files: where.length, examples: where.slice(0, 3) }))
  };
}

module.exports = {
  FORBIDDEN_CONFIG_KEYS,
  LEGACY_DEFAULT_PASSWORD_DIGESTS,
  backendRefsInBuffer,
  localSecretValues,
  scanBuffer,
  scanDirectory
};
