/**
 * Module 28 — Transformation engine (JSON↔XML, CSV, maps, currency, dates).
 * Lightweight in-process converters. Money stays integer pesewas in core.
 */

import { fromPesewas, toPesewas } from "./money.js";

export const TRANSFORM_ENGINE_VERSION = "1.0.0";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jsonToXml(value, root = "payload") {
  if (value == null) return `<${root}/>`;
  if (typeof value !== "object") return `<${root}>${escapeXml(value)}</${root}>`;
  if (Array.isArray(value)) {
    return `<${root}>${value.map((item, i) => jsonToXml(item, `item${i}`)).join("")}</${root}>`;
  }
  const inner = Object.entries(value)
    .map(([key, item]) => jsonToXml(item, String(key).replace(/[^A-Za-z0-9_]/g, "_")))
    .join("");
  return `<${root}>${inner}</${root}>`;
}

export function xmlToJson(xml = "") {
  const text = String(xml || "").trim();
  if (!text) return {};
  const tag = text.match(/^<([A-Za-z0-9_]+)>/);
  if (!tag) return { raw: text };
  const root = tag[1];
  const body = text.slice(root.length + 2, -(root.length + 3));
  if (!body.includes("<")) {
    const num = Number(body);
    return Number.isFinite(num) && String(num) === body ? num : body;
  }
  const result = {};
  const re = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = re.exec(body))) {
    result[match[1]] = xmlToJson(`<${match[1]}>${match[2]}</${match[1]}>`);
  }
  return result;
}

export function rowsToCsv(rows = [], columns = []) {
  const cols = columns.length ? columns : Object.keys(rows[0] || {});
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [cols.join(","), ...rows.map((row) => cols.map((col) => escape(row[col])).join(","))].join("\n");
}

export function csvToRows(csv = "") {
  const lines = String(csv || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (parts[i] || "").trim();
    });
    return row;
  });
}

export function mapFields(payload = {}, fieldMap = {}) {
  const out = {};
  Object.entries(fieldMap).forEach(([from, to]) => {
    if (Object.prototype.hasOwnProperty.call(payload, from)) out[to] = payload[from];
  });
  return out;
}

export function mapEnums(payload = {}, enumMap = {}) {
  const out = { ...payload };
  Object.entries(enumMap).forEach(([field, mapping]) => {
    if (Object.prototype.hasOwnProperty.call(out, field) && mapping && typeof mapping === "object") {
      const key = String(out[field]);
      if (Object.prototype.hasOwnProperty.call(mapping, key)) out[field] = mapping[key];
    }
  });
  return out;
}

export function convertCurrency(payload = {}, { field = "amount", mode = "pesewas_to_ghs" } = {}) {
  const out = { ...payload };
  const value = Number(out[field] || 0);
  if (mode === "pesewas_to_ghs") out[field] = fromPesewas(value);
  else if (mode === "ghs_to_pesewas") out[field] = toPesewas(value);
  out.currencyUnit = mode === "pesewas_to_ghs" ? "GHS" : "pesewas";
  return out;
}

export function convertDateTime(payload = {}, { field = "timestamp", to = "iso" } = {}) {
  const out = { ...payload };
  const raw = out[field];
  const ms = typeof raw === "number" ? raw : Date.parse(raw);
  if (!Number.isFinite(ms)) return out;
  if (to === "epoch_ms") out[field] = ms;
  else out[field] = new Date(ms).toISOString();
  return out;
}

export function convertEncoding(payload = {}, { field = "body", mode = "base64_encode" } = {}) {
  const out = { ...payload };
  const text = String(out[field] ?? "");
  if (mode === "base64_encode") {
    out[field] = typeof btoa === "function"
      ? btoa(text)
      : Buffer.from(text, "utf8").toString("base64");
  } else if (mode === "base64_decode") {
    out[field] = typeof atob === "function"
      ? atob(text)
      : Buffer.from(text, "base64").toString("utf8");
  }
  return out;
}

export function runTransformDefinition(definition = {}, payload) {
  const kind = definition.kind || definition.transformKind;
  try {
    if (kind === "json_xml") return { ok: true, result: jsonToXml(payload, definition.root || "payload") };
    if (kind === "xml_json") return { ok: true, result: xmlToJson(payload) };
    if (kind === "csv") {
      if (definition.direction === "from_csv") return { ok: true, result: csvToRows(payload) };
      return { ok: true, result: rowsToCsv(Array.isArray(payload) ? payload : [payload], definition.columns || []) };
    }
    if (kind === "field_map") return { ok: true, result: mapFields(payload, definition.fieldMap || {}) };
    if (kind === "enum_map") return { ok: true, result: mapEnums(payload, definition.enumMap || {}) };
    if (kind === "currency") return { ok: true, result: convertCurrency(payload, definition) };
    if (kind === "datetime") return { ok: true, result: convertDateTime(payload, definition) };
    if (kind === "encoding") return { ok: true, result: convertEncoding(payload, definition) };
    return { ok: false, error: "Unknown transform kind", errorCode: "INT-013", http: 400 };
  } catch (error) {
    return { ok: false, error: error.message || "Transform failed", errorCode: "INT-013", http: 422 };
  }
}

export function validateTransformDefinition(definition = {}) {
  const errors = [];
  if (!definition.code) errors.push({ path: "code", message: "required" });
  if (!definition.kind && !definition.transformKind) errors.push({ path: "kind", message: "required" });
  if (!definition.version) errors.push({ path: "version", message: "required" });
  return errors.length ? { ok: false, errors, errorCode: "INT-010" } : { ok: true };
}
