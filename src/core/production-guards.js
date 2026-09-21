/**
 * Production safety checks before using real customer money.
 * GAP-024: productionMode fail-closed when bootstrap default passwords remain.
 */

/** Known bootstrap / example passwords that must never authorize live money. */
export const BOOTSTRAP_DEFAULT_PASSWORDS = Object.freeze([
  "7049",
  "05491",
  "change-me",
  "change-me-immediately",
  "password",
  "1234"
]);

/**
 * @param {object} [config]
 * @returns {boolean}
 */
export function hasBootstrapDefaultPassword(config = {}) {
  const candidates = [
    config.defaultOwnerPassword,
    config.developerPassword,
    config.defaultKbaPassword,
    config.defaultSuperAdminPassword,
    config.defaultDeveloperPassword
  ];
  return candidates.some((value) =>
    BOOTSTRAP_DEFAULT_PASSWORDS.includes(String(value || "").trim())
  );
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
  if (String(settings.syncAccessKey || config.syncAccessKey || "").length < 24) {
    warnings.push("Cloud Access Key is missing or too short. Use a long random secret or enable relational auth.");
  }
  if (settings.productionMode === true && !settings.relationalSync) {
    warnings.push("Production mode is on but relational PostgreSQL sync is disabled.");
  }
  if (settings.productionMode === true && !settings.postgresSourceOfTruth) {
    warnings.push("Production mode should use PostgreSQL as source of truth.");
  }
  if (settings.productionMode === true && settings.supabaseAuthEnabled && String(settings.syncAccessKey || "").length >= 24) {
    warnings.push("Disable legacy syncAccessKey when Supabase Auth is enabled.");
  }
  const owner = (state.users || []).find((user) => user.role === "SystemOwner" || user.systemOwner === true || user.role === "KBA");
  if (settings.productionMode === true && owner && !owner.mfaEnabled) {
    warnings.push("Manager MFA is not enabled. Enable two-factor authentication in Settings.");
  }
  if (BOOTSTRAP_DEFAULT_PASSWORDS.includes(String(config.defaultOwnerPassword || "").trim())) {
    warnings.push("Default owner password is still in config.json. Change it immediately.");
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
 * Blocks relational misconfig, developer login on prod builds, and bootstrap default passwords (GAP-024).
 */
export function blockFinancialWriteIfUnsafe(state, config = {}) {
  if (state.settings?.productionMode !== true) return { ok: true };
  const warnings = productionWarnings(state, config);
  const critical = warnings.filter((item) =>
    item.includes("relational")
    || item.includes("Developer login")
    || item.includes("Bootstrap default passwords")
    || item.includes("Default owner password")
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
