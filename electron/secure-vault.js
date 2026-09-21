/**
 * Wave 6 — Encrypted session/token vault for the Electron main process.
 * Uses Electron safeStorage when available; falls back to OS userData with a clear warning flag.
 * Never logs secret values.
 */

"use strict";

const fs = require("fs");
const path = require("path");

function vaultPath(userDataPath) {
  return path.join(userDataPath, "smile-trust-secure-vault.v1.json");
}

function readVaultFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { version: 1, entries: {} };
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!raw || typeof raw !== "object") return { version: 1, entries: {} };
    return { version: 1, entries: raw.entries && typeof raw.entries === "object" ? raw.entries : {} };
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeVaultFile(filePath, vault) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ version: 1, entries: vault.entries || {} }, null, 0), "utf8");
}

/**
 * @param {{ userDataPath: string, safeStorage?: { isEncryptionAvailable?: () => boolean, encryptString?: (s: string) => Buffer, decryptString?: (b: Buffer) => string } }} deps
 */
function createSecureVault(deps) {
  const filePath = vaultPath(deps.userDataPath);
  const safe = deps.safeStorage || null;

  function encryptionAvailable() {
    try {
      return Boolean(safe && typeof safe.isEncryptionAvailable === "function" && safe.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  function setItem(key, value) {
    const k = String(key || "").trim();
    if (!k) return { ok: false, error: "key required" };
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const vault = readVaultFile(filePath);
    if (encryptionAvailable()) {
      const buf = safe.encryptString(text);
      vault.entries[k] = {
        enc: true,
        payload: Buffer.from(buf).toString("base64"),
        updatedAt: new Date().toISOString()
      };
    } else {
      vault.entries[k] = {
        enc: false,
        payload: Buffer.from(text, "utf8").toString("base64"),
        updatedAt: new Date().toISOString(),
        warning: "safeStorage_unavailable"
      };
    }
    writeVaultFile(filePath, vault);
    return { ok: true, encrypted: encryptionAvailable() };
  }

  function getItem(key) {
    const k = String(key || "").trim();
    if (!k) return { ok: false, error: "key required", value: null };
    const vault = readVaultFile(filePath);
    const row = vault.entries[k];
    if (!row) return { ok: true, value: null };
    try {
      let text;
      if (row.enc && encryptionAvailable()) {
        text = safe.decryptString(Buffer.from(row.payload, "base64"));
      } else {
        text = Buffer.from(row.payload, "base64").toString("utf8");
      }
      try {
        return { ok: true, value: JSON.parse(text), encrypted: Boolean(row.enc) };
      } catch {
        return { ok: true, value: text, encrypted: Boolean(row.enc) };
      }
    } catch {
      return { ok: false, error: "decrypt_failed", value: null };
    }
  }

  function deleteItem(key) {
    const k = String(key || "").trim();
    if (!k) return { ok: false, error: "key required" };
    const vault = readVaultFile(filePath);
    delete vault.entries[k];
    writeVaultFile(filePath, vault);
    return { ok: true };
  }

  return {
    encryptionAvailable,
    setItem,
    getItem,
    deleteItem,
    path: filePath
  };
}

module.exports = { createSecureVault, vaultPath };
