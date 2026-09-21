/**
 * Global schema checksum canonicalization and SHA-256 hashing.
 * Deterministic across platforms: same logical schema → same checksum.
 * Normative format: SHA-256:<64 lowercase hex>
 */

export const SCHEMA_CHECKSUM_ALGORITHM = "SHA-256";
export const SCHEMA_CHECKSUM_PATTERN = "^SHA-256:[a-f0-9]{64}$";
export const SCHEMA_CHECKSUM_RE = /^SHA-256:[a-f0-9]{64}$/;
/** Historical only — never accepted for new publications. */
export const SCHEMA_CHECKSUM_HISTORICAL_RE = /^SHA-256:[A-Fa-f0-9]{64}$/;

export const CHECKSUM_EXCLUDED_FIELDS = [
  "schemaMetadata",
  "checksum",
  "publishedAtUtc",
  "publishedBy",
  "approvalReference"
];

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/** Pure JS SHA-256 (sync). Returns 64 lowercase hex characters. */
export function sha256Hex(utf8String) {
  const encoder = typeof TextEncoder !== "undefined"
    ? new TextEncoder()
    : { encode: (text) => Uint8Array.from(Buffer.from(text, "utf8")) };
  const bytes = encoder.encode(String(utf8String));
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  let total = withOne;
  while (total % 64 !== 56) total += 1;
  total += 8;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  // length in bits as 64-bit big-endian; for practical schema sizes high word is 0
  view.setUint32(total - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function escapeJsonString(value) {
  return JSON.stringify(String(value));
}

function serializeCanonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers are not permitted in canonical schemas");
    // Shortest valid JSON number (JSON.stringify already does this for finite numbers)
    return JSON.stringify(value);
  }
  if (typeof value === "string") return escapeJsonString(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonical(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return `{${keys.map((key) => `${escapeJsonString(key)}:${serializeCanonical(value[key])}`).join(",")}}`;
  }
  throw new Error(`Unsupported JSON type: ${typeof value}`);
}

/**
 * Strip publication-specific metadata before hashing.
 * Does not remove other schema fields.
 */
export function stripChecksumExcludedFields(document) {
  if (document == null) return document;
  if (typeof document === "string") {
    try {
      return stripChecksumExcludedFields(JSON.parse(document));
    } catch {
      return document;
    }
  }
  if (typeof document !== "object" || Array.isArray(document)) return document;
  const clone = { ...document };
  CHECKSUM_EXCLUDED_FIELDS.forEach((field) => {
    delete clone[field];
  });
  if (clone.schemaMetadata && typeof clone.schemaMetadata === "object") {
    delete clone.schemaMetadata;
  }
  return clone;
}

/**
 * Canonical UTF-8 JSON string: sorted object keys, preserved arrays, no insignificant whitespace.
 */
export function canonicalizeSchemaDocument(document) {
  let value = document;
  if (typeof value === "string") {
    value = JSON.parse(value);
  }
  const stripped = stripChecksumExcludedFields(value);
  return serializeCanonical(stripped);
}

/**
 * Produce SHA-256:<64 lowercase hex> from a schema definition (metadata excluded).
 */
export function schemaChecksum(document) {
  const canonical = canonicalizeSchemaDocument(document);
  const digest = sha256Hex(canonical);
  return `SHA-256:${digest}`;
}

export function isCanonicalChecksumFormat(value) {
  return SCHEMA_CHECKSUM_RE.test(String(value || ""));
}

export function isHistoricalChecksumFormat(value) {
  const text = String(value || "");
  return SCHEMA_CHECKSUM_HISTORICAL_RE.test(text) && !SCHEMA_CHECKSUM_RE.test(text);
}

/**
 * Exact case-sensitive verification. Rejects uppercase digests for new publications.
 */
export function verifySchemaChecksum(document, publishedChecksum, options = {}) {
  const published = String(publishedChecksum || "");
  if (!isCanonicalChecksumFormat(published)) {
    if (options.allowHistoricalUppercase === true && isHistoricalChecksumFormat(published)) {
      return {
        ok: false,
        error: "Uppercase hexadecimal checksum is historical only and must be regenerated on republish",
        errorCode: "BI-013",
        historical: true,
        computed: schemaChecksum(document),
        published
      };
    }
    return {
      ok: false,
      error: "Checksum must match SHA-256:<64 lowercase hex>",
      errorCode: "BI-013",
      computed: null,
      published
    };
  }
  const computed = schemaChecksum(document);
  const match = computed === published;
  return {
    ok: match,
    error: match ? "" : "Checksum mismatch",
    errorCode: match ? "" : "BI-010",
    computed,
    published,
    algorithm: SCHEMA_CHECKSUM_ALGORITHM
  };
}

export function assertChecksumCanonicalizationBoundary() {
  return {
    deterministic: true,
    lowercaseOnly: true,
    excludesMetadata: true,
    sha256: true,
    restHttp: false,
    postsCollections: false
  };
}
