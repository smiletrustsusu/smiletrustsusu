/**
 * Authorization middleware — RBAC + tenant/branch scope on every operation.
 */

import { canAction, dataScope, SUPER_ADMIN_FORBIDDEN, isForbiddenForSuperAdmin } from "../../core/rbac.js";
import { isSystemOwner } from "../../core/roles.js";
import { buildFoundationError } from "../../core/foundation-errors.js";
import { DEFAULT_TENANT_ID } from "../../core/platform-lifecycle.js";

export function authorizeRequest(state, request = {}, operation = {}, user = null) {
  if (operation.authRequired === false || operation.public === true) {
    return { ok: true, scope: "public", tenantId: "", branchId: "" };
  }
  if (!user) {
    return { ok: false, error: buildFoundationError("FND-001") };
  }

  const permission = operation.permission || operation.action || "";
  if (permission) {
    if (isForbiddenForSuperAdmin(user, permission) && !isSystemOwner(user)) {
      return { ok: false, error: buildFoundationError("FND-006") };
    }
    if (!canAction(user, permission) && !isSystemOwner(user)) {
      return { ok: false, error: buildFoundationError("FND-005") };
    }
  }

  const tenantId =
    request.tenantId ||
    request.payload?.tenantId ||
    state.settings?.tenantId ||
    DEFAULT_TENANT_ID;
  const branchId =
    request.branchId ||
    request.payload?.branchId ||
    request.payload?.groupId ||
    user.branchId ||
    state.settings?.activeBranchId ||
    "";

  if (operation.tenantScoped !== false) {
    const actorTenant = user.tenantId || state.settings?.tenantId || DEFAULT_TENANT_ID;
    if (request.payload?.tenantId && String(request.payload.tenantId) !== String(actorTenant) && !isSystemOwner(user)) {
      return {
        ok: false,
        error: buildFoundationError("FND-005", {
          message: "Wrong tenant",
          userMessage: "You cannot access another tenant.",
          details: { tenantId: request.payload.tenantId }
        })
      };
    }
  }

  const scope = dataScope(user);
  if (operation.branchScoped === true && (scope === "branch" || scope === "assigned")) {
    const targetBranch =
      request.payload?.branchId ||
      request.payload?.groupId ||
      request.query?.branchId ||
      "";
    if (targetBranch && user.branchId && String(targetBranch) !== String(user.branchId)) {
      return {
        ok: false,
        error: buildFoundationError("FND-005", {
          message: "Wrong branch",
          userMessage: "You cannot access another branch.",
          details: { branchId: targetBranch }
        })
      };
    }
  }

  if (scope === "none" && operation.permission) {
    return { ok: false, error: buildFoundationError("FND-005") };
  }

  return {
    ok: true,
    scope,
    tenantId,
    branchId,
    forbiddenForSuperAdmin: SUPER_ADMIN_FORBIDDEN.slice()
  };
}
