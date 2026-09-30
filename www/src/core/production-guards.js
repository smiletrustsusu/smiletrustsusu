/**
 * Production safety checks before using real customer money.
 * GAP-024: productionMode fail-closed when bootstrap passwords are distributed with the client.
 */

/** Generic example passwords that must never authorize live money. */
export const BOOTSTRAP_DEFAULT_PASSWORDS = Object.freeze([
  "change-me",
  "change-me-immediately",
  "password",
  "1234"
]);

/** Config keys that must never ship inside a client build. */
export const CLIENT_FORBIDDEN_CONFIG_KEYS = Object.freeze([
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

const PASSWORD_CONFIG_KEYS = CLIENT_FORBIDDEN_CONFIG_KEYS.filter((key) => /password/i.test(key));

function isWeakBootstrapPassword(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (BOOTSTRAP_DEFAULT_PASSWORDS.includes(text)) return true;
  return /^\d{1,7}$/.test(text);
}

/**
 * @param {object} [config]
 * @returns {boolean}
 */
export function hasBootstrapDefaultPassword(config = {}) {
  return PASSWORD_CONFIG_KEYS.some((key) => isWeakBootstrapPassword(config[key]));
}

/** Keys present in a client config that must be server-side only. */
export function forbiddenClientConfigKeys(config = {}) {
  return CLIENT_FORBIDDEN_CONFIG_KEYS.filter((key) => String(config?.[key] ?? "").trim() !== "");
}

export function isProductionBuild() {
  if (typeof navigator === "undefined") return false;
  return /Electron/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent);
}

export function productionWarnings(state = {}, config = {}) {
  const warnings = [];
  const settings = state.settings || {};

  if (isProductionBuild() && settings.allowDeveloperLogin === true) {
    warnings.push("Developer login is enabled in a production build.");
  }
  if (String(settings.syncAccessKey || "").trim()) {
    warnings.push("A legacy Cloud Access Key is still stored on this device. Sign in online so sync uses your staff session.");
  }
  if (settings.productionMode === true && !settings.relationalSync) {
    warnings.push("Production mode is on but relational PostgreSQL sync is disabled.");
  }
  if (settings.productionMode === true && !settings.postgresSourceOfTruth) {
    warnings.push("Production mode should use PostgreSQL as source of truth.");
  }
  const owner = (state.users || []).find((user) => user.role === "SystemOwner" || user.systemOwner === true || user.role === "KBA");
  if (settings.productionMode === true && owner && !owner.mfaEnabled) {
    warnings.push("Manager MFA is not enabled. Enable two-factor authentication in Settings.");
  }
  const forbidden = forbiddenClientConfigKeys(config);
  if (forbidden.length) {
    warnings.push(`Secrets must not be distributed in client config.json (${forbidden.join(", ")}).`);
  }
  if (settings.productionMode === true && hasBootstrapDefaultPassword(config)) {
    warnings.push(
      "Bootstrap default passwords remain in config while productionMode is on. Change them before live money."
    );
  }
  return warnings;
}

/**
 * Fail-closed financial write gate when productionMode is on.
 * Blocks relational misconfig, developer login on prod builds, and distributed secrets (GAP-024).
 */
export function blockFinancialWriteIfUnsafe(state, config = {}) {
  if (state.settings?.productionMode !== true) return { ok: true };
  const warnings = productionWarnings(state, config);
  const critical = warnings.filter((item) =>
    item.includes("relational")
    || item.includes("Developer login")
    || item.includes("Bootstrap default passwords")
    || item.includes("must not be distributed")
  );
  if (critical.length) return { ok: false, error: critical[0] };
  return { ok: true };
}

/**
 * Read-only assessor for scripts / Audit-Reports (never invents secrets).
 * @param {{ productionMode?: boolean, config?: object }} [opts]
 */
export function assessBootstrapPasswordGuard(opts = {}) {
  const productionMode = opts.productionMode === true
    || opts.config?.productionMode === true
    || opts.settings?.productionMode === true;
  const config = opts.config || {};
  const hasDefault = hasBootstrapDefaultPassword(config);
  if (!productionMode) {
    return {
      status: hasDefault ? "Partial" : "Ready",
      detail: hasDefault
        ? "Bootstrap defaults present in config sample/path — OK while productionMode is off"
        : "No known bootstrap defaults in supplied config; productionMode off",
      productionMode: false,
      hasBootstrapDefault: hasDefault,
      gap: "GAP-024"
    };
  }
  if (hasDefault) {
    return {
      status: "Blocked",
      detail: "productionMode on with bootstrap default passwords — fail-closed (GAP-024)",
      productionMode: true,
      hasBootstrapDefault: true,
      gap: "GAP-024"
    };
  }
  return {
    status: "Ready",
    detail: "productionMode on and bootstrap defaults not detected in supplied config",
    productionMode: true,
    hasBootstrapDefault: false,
    gap: "GAP-024"
  };
}
