/**
 * Customer KYC, beneficiaries, next of kin, and multiple savings accounts.
 */
export const GENDERS = ["Male", "Female"];
export const KYC_DOC_TYPES = ["Ghana Card", "Passport", "Voter ID", "Driver License", "Birth Certificate", "Proof of Address"];
export const ACCOUNT_STATUSES = ["Active", "Dormant", "Suspended", "Closed"];

export function nextCustomerNumber(customers = [], prefix = "ST") {
  const numbers = customers
    .map((customer) => Number(String(customer.customerNumber || "").replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export function validateKycProfile(data) {
  if (!String(data.name || "").trim()) return "Full name is required";
  if (!String(data.phone || "").trim()) return "Phone number is required";
  if (!String(data.nationalId || data.ghanaCard || "").trim()) return "National ID / Ghana Card is required";
  return "";
}

export function applyCustomerKyc(customer, data = {}) {
  customer.customerNumber = String(data.customerNumber || customer.customerNumber || "").trim();
  customer.dateOfBirth = data.dateOfBirth || customer.dateOfBirth || "";
  customer.occupation = String(data.occupation || customer.occupation || "").trim();
  customer.employer = String(data.employer || customer.employer || "").trim();
  customer.phoneAlt = String(data.phoneAlt || customer.phoneAlt || "").trim();
  customer.gpsAddress = String(data.gpsAddress || customer.gpsAddress || "").trim();
  customer.nationalId = String(data.nationalId || data.ghanaCard || customer.nationalId || customer.ghanaCard || "").trim();
  customer.ghanaCard = customer.nationalId;
  customer.signatureData = data.signatureData || customer.signatureData || "";
  customer.kycDocuments = Array.isArray(data.kycDocuments) ? data.kycDocuments : (customer.kycDocuments || []);
  customer.beneficiaries = Array.isArray(data.beneficiaries) ? data.beneficiaries : (customer.beneficiaries || []);
  customer.nextOfKinPhone = String(data.nextOfKinPhone || customer.nextOfKinPhone || "").trim();
  customer.nextOfKinAddress = String(data.nextOfKinAddress || customer.nextOfKinAddress || "").trim();
  customer.updatedAt = new Date().toISOString();
  return customer;
}

export function upsertBeneficiary(customer, data, uid) {
  customer.beneficiaries = customer.beneficiaries || [];
  const payload = {
    name: String(data.name || "").trim(),
    relationship: String(data.relationship || "").trim(),
    phone: String(data.phone || "").trim(),
    sharePercent: Number(data.sharePercent || 0),
    nationalId: String(data.nationalId || "").trim()
  };
  if (!payload.name) return { error: "Beneficiary name is required" };
  if (data.id) {
    const existing = customer.beneficiaries.find((item) => item.id === data.id);
    if (!existing) return { error: "Beneficiary not found" };
    Object.assign(existing, payload, { updatedAt: new Date().toISOString() });
    return { beneficiary: existing };
  }
  const beneficiary = {
    id: uid("ben"),
    ...payload,
    createdAt: new Date().toISOString()
  };
  customer.beneficiaries.push(beneficiary);
  return { beneficiary };
}

export function addKycDocument(customer, data, uid) {
  customer.kycDocuments = customer.kycDocuments || [];
  const doc = {
    id: uid("kyc"),
    type: KYC_DOC_TYPES.includes(data.type) ? data.type : "Ghana Card",
    reference: String(data.reference || "").trim(),
    fileName: String(data.fileName || "").trim(),
    dataUrl: data.dataUrl || "",
    uploadedAt: new Date().toISOString()
  };
  customer.kycDocuments.push(doc);
  return doc;
}

export function ensureSavingsAccount(state, customer, productId, uid) {
  state.savingsAccounts = state.savingsAccounts || [];
  const existing = state.savingsAccounts.find((item) =>
    item.customerId === customer.id && item.productId === productId && item.status !== "Closed"
  );
  if (existing) return existing;
  const account = {
    id: uid("sav"),
    customerId: customer.id,
    productId,
    branchId: customer.branchId || customer.groupId || "",
    agentId: customer.collectorId || "",
    status: "Active",
    openedAt: new Date().toISOString(),
    balancePesewas: 0
  };
  state.savingsAccounts.push(account);
  if (!customer.savingsProductId) customer.savingsProductId = productId;
  return account;
}

export function customerSavingsAccounts(state, customerId) {
  return (state.savingsAccounts || []).filter((item) => item.customerId === customerId);
}

export function markDormantCustomers(customers = [], collections = [], asOfDate, dormantDays = 30) {
  const cutoff = new Date(`${asOfDate}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - Number(dormantDays || 30));
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return customers.map((customer) => {
    if (customer.active === false || customer.memberStatus === "Closed") return customer;
    const last = collections
      .filter((item) => item.customerId === customer.id && !item.reversed)
      .map((item) => item.date)
      .sort()
      .pop();
    if (last && last < cutoffIso) {
      customer.dormant = true;
      if (customer.memberStatus === "Active") customer.memberStatus = "Active";
    } else {
      customer.dormant = false;
    }
    return customer;
  });
}

export function splitBeneficiariesValid(beneficiaries = []) {
  if (!beneficiaries.length) return true;
  const total = beneficiaries.reduce((sum, item) => sum + Number(item.sharePercent || 0), 0);
  return Math.abs(total - 100) < 0.01 || total === 0;
}
