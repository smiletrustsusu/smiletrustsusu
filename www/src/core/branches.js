/**
 * First-class branch records. Existing susu locations (`groups`) remain the
 * operational unit; each location is linked to a branch.
 */
export function nextBranchCode(branches = []) {
  const numbers = branches
    .map((branch) => Number(String(branch.code || "").replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `BR${String(next).padStart(3, "0")}`;
}

export function validateBranchInput(data) {
  if (!String(data.name || "").trim()) return "Branch name is required";
  if (!String(data.code || "").trim()) return "Branch code is required";
  return "";
}

export function upsertBranch(state, data, uid) {
  const error = validateBranchInput(data);
  if (error) return { error };
  const code = String(data.code || "").trim().toUpperCase();
  const duplicate = (state.branches || []).find((item) => item.code === code && item.id !== data.id);
  if (duplicate) return { error: "Branch code already exists" };
  const payload = {
    name: String(data.name || "").trim(),
    code,
    managerId: data.managerId || "",
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim(),
    address: String(data.address || "").trim(),
    gpsAddress: String(data.gpsAddress || "").trim(),
    region: String(data.region || "").trim(),
    active: data.active !== false,
    updatedAt: new Date().toISOString()
  };
  state.branches = state.branches || [];
  if (data.id) {
    const existing = state.branches.find((item) => item.id === data.id);
    if (!existing) return { error: "Branch not found" };
    Object.assign(existing, payload);
    return { branch: existing };
  }
  const branch = {
    id: uid("br"),
    ...payload,
    createdAt: new Date().toISOString()
  };
  state.branches.push(branch);
  return { branch };
}

export function ensureBranchesFromLocations(state, uid) {
  state.branches = state.branches || [];
  (state.groups || []).forEach((group) => {
    if (group.branchId && state.branches.some((item) => item.id === group.branchId)) return;
    const existing = state.branches.find((item) => item.locationGroupId === group.id || item.name === group.name);
    if (existing) {
      group.branchId = existing.id;
      return;
    }
    const created = upsertBranch(state, {
      name: group.name || "Main Branch",
      code: group.collectorCode ? `BR-${String(group.collectorCode).toUpperCase()}` : nextBranchCode(state.branches),
      managerId: group.adminId || "",
      phone: group.phone || "",
      address: group.address || group.note || "",
      active: group.active !== false
    }, uid);
    if (created.branch) {
      created.branch.locationGroupId = group.id;
      group.branchId = created.branch.id;
    }
  });
  if (!state.branches.length) {
    upsertBranch(state, {
      name: "Head Office",
      code: "BR001",
      active: true
    }, uid);
  }
  return state.branches;
}

export function filterBranchesForUser(branches = [], user) {
  if (!user) return [];
  if (["SystemOwner", "KBA", "ManagingDirector", "OperationsManager", "Accountant", "Auditor", "Developer"].includes(user.role)) {
    return branches;
  }
  const branchId = user.branchId || "";
  if (branchId) return branches.filter((item) => item.id === branchId);
  if (user.groupId) {
    return branches.filter((item) => item.locationGroupId === user.groupId || item.managerId === user.id);
  }
  return branches;
}

export function branchById(branches = [], id) {
  return branches.find((item) => item.id === id) || null;
}

export function branchPerformance(branch, { collections = [], customers = [], groups = [], date = "" } = {}) {
  const locationIds = new Set(
    (groups || []).filter((group) => group.branchId === branch.id || group.id === branch.locationGroupId).map((group) => group.id)
  );
  if (branch.locationGroupId) locationIds.add(branch.locationGroupId);
  const scopedCustomers = customers.filter((customer) => locationIds.has(customer.groupId) || customer.branchId === branch.id);
  const scopedCollections = collections.filter((item) =>
    !item.reversed
    && (locationIds.has(item.groupId) || item.branchId === branch.id)
    && (!date || item.date === date)
  );
  const collected = scopedCollections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    branchId: branch.id,
    customers: scopedCustomers.length,
    activeCustomers: scopedCustomers.filter((item) => item.active !== false).length,
    collected,
    collections: scopedCollections.length
  };
}
