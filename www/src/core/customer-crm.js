/**
 * Customer CRM: duplicate checks, verification, notes, status history, analytics.
 * Works on existing customer records — does not invent a second customer store.
 */
import { nextCustomerNumber } from "./customer-kyc.js";

export const CRM_STATUSES = [
  "Active",
  "Pending Verification",
  "Suspended",
  "Closed",
  "Deceased",
  "Blacklisted"
];

export const ID_TYPES = ["Ghana Card", "Passport", "Driver's License", "Voter ID"];
export const CUSTOMER_CATEGORIES = ["Individual", "Business", "VIP", "Group Member"];
export const NOTE_TYPES = [
  "Visited customer",
  "Customer requested withdrawal",
  "Complaint received",
  "Loan discussion",
  "Address verification",
  "General"
];
export const KYC_VERIFICATION = ["Pending", "Verified", "Rejected"];

export function canChangeCustomerStatus(actor) {
  return ["SystemOwner", "KBA", "Admin", "CustomerService", "ManagingDirector", "OperationsManager"].includes(actor?.role);
}

export function canHardDeleteCustomers(actor) {
  return actor?.role === "SystemOwner" || actor?.systemOwner === true;
}

export function normalizePhoneKey(value) {
  return String(value || "").replace(/\D/g, "").slice(-9);
}

export function findDuplicateCustomers(customers = [], data = {}, excludeId = "") {
  const phone = normalizePhoneKey(data.phone);
  const alt = normalizePhoneKey(data.phoneAlt || data.whatsapp);
  const nationalId = String(data.nationalId || data.ghanaCard || data.idNumber || "").trim().toLowerCase();
  const email = String(data.email || "").trim().toLowerCase();
  const customerNumber = String(data.customerNumber || "").trim().toLowerCase();
  const accountNo = String(data.accountNo || "").trim().toLowerCase();
  return customers.filter((customer) => {
    if (!customer || customer.id === excludeId) return false;
    const samePhone = phone && (normalizePhoneKey(customer.phone) === phone || normalizePhoneKey(customer.phoneAlt) === phone || normalizePhoneKey(customer.whatsapp) === phone);
    const sameAlt = alt && (normalizePhoneKey(customer.phone) === alt || normalizePhoneKey(customer.phoneAlt) === alt);
    const sameId = nationalId && String(customer.nationalId || customer.ghanaCard || "").trim().toLowerCase() === nationalId;
    const sameEmail = email && String(customer.email || "").trim().toLowerCase() === email;
    const sameNumber = customerNumber && String(customer.customerNumber || "").trim().toLowerCase() === customerNumber;
    const sameAccount = accountNo && String(customer.accountNo || "").trim().toLowerCase() === accountNo;
    return samePhone || sameAlt || sameId || sameEmail || sameNumber || sameAccount;
  });
}

export function applyCustomerCrm(customer, data = {}) {
  customer.membershipNumber = String(data.membershipNumber || customer.membershipNumber || customer.customerNumber || "").trim();
  customer.email = String(data.email || customer.email || "").trim();
  customer.whatsapp = String(data.whatsapp || customer.whatsapp || data.phone || customer.phone || "").trim();
  customer.phoneSecondary = String(data.phoneSecondary || customer.phoneSecondary || "").trim();
  customer.postalAddress = String(data.postalAddress || customer.postalAddress || "").trim();
  customer.region = String(data.region || customer.region || "").trim();
  customer.district = String(data.district || customer.district || "").trim();
  customer.town = String(data.town || customer.town || "").trim();
  customer.employerAddress = String(data.employerAddress || customer.employerAddress || "").trim();
  customer.idType = String(data.idType || customer.idType || "Ghana Card").trim();
  customer.idNumber = String(data.idNumber || data.ghanaCard || customer.idNumber || customer.ghanaCard || "").trim();
  customer.idExpiry = data.idExpiry || customer.idExpiry || "";
  customer.idFrontImage = data.idFrontImage || customer.idFrontImage || "";
  customer.idBackImage = data.idBackImage || customer.idBackImage || "";
  customer.category = CUSTOMER_CATEGORIES.includes(data.category) ? data.category : (customer.category || "Individual");
  customer.collectionRoute = String(data.collectionRoute || customer.collectionRoute || "").trim();
  customer.kycStatus = KYC_VERIFICATION.includes(data.kycStatus) ? data.kycStatus : (customer.kycStatus || "Pending");
  customer.notes = Array.isArray(data.notes) ? data.notes : (customer.notes || []);
  customer.statusHistory = Array.isArray(data.statusHistory) ? data.statusHistory : (customer.statusHistory || []);
  customer.activityLog = Array.isArray(data.activityLog) ? data.activityLog : (customer.activityLog || []);
  customer.nextOfKinOccupation = String(data.nextOfKinOccupation || customer.nextOfKinOccupation || "").trim();
  if (CRM_STATUSES.includes(data.memberStatus)) customer.memberStatus = data.memberStatus;
  customer.active = !["Suspended", "Closed", "Deceased", "Blacklisted"].includes(customer.memberStatus);
  customer.updatedAt = new Date().toISOString();
  return customer;
}

export function addCustomerNote(customer, data, uid) {
  customer.notes = customer.notes || [];
  const note = {
    id: uid("note"),
    type: NOTE_TYPES.includes(data.type) ? data.type : "General",
    body: String(data.body || "").trim(),
    userId: data.userId || "",
    userName: data.userName || "",
    branchId: data.branchId || customer.groupId || "",
    createdAt: new Date().toISOString()
  };
  if (!note.body) return { error: "Note text is required" };
  customer.notes.unshift(note);
  appendCustomerActivity(customer, {
    action: "Note added",
    detail: note.type,
    userId: note.userId,
    uid
  });
  return { note };
}

export function setCustomerStatus(customer, status, actor, uid) {
  if (!CRM_STATUSES.includes(status)) return { error: "Invalid customer status" };
  if (!canChangeCustomerStatus(actor)) return { error: "You cannot change customer status" };
  const previous = customer.memberStatus || (customer.active === false ? "Closed" : "Active");
  customer.statusHistory = customer.statusHistory || [];
  customer.statusHistory.unshift({
    id: uid("cstat"),
    from: previous,
    to: status,
    userId: actor?.id || "",
    at: new Date().toISOString()
  });
  customer.memberStatus = status;
  customer.active = !["Suspended", "Closed", "Deceased", "Blacklisted"].includes(status);
  appendCustomerActivity(customer, {
    action: "Status changed",
    detail: `${previous} → ${status}`,
    userId: actor?.id || "",
    uid
  });
  return { customer };
}

export function setKycVerification(customer, status, actor, uid) {
  if (!KYC_VERIFICATION.includes(status)) return { error: "Invalid verification status" };
  customer.kycStatus = status;
  customer.kycVerifiedAt = status === "Verified" ? new Date().toISOString() : "";
  customer.kycVerifiedBy = status === "Verified" ? actor?.id || "" : "";
  appendCustomerActivity(customer, {
    action: status === "Verified" ? "KYC verified" : `KYC ${status.toLowerCase()}`,
    detail: status,
    userId: actor?.id || "",
    uid
  });
  return { customer };
}

export function appendCustomerActivity(customer, { action, detail = "", userId = "", uid }) {
  customer.activityLog = customer.activityLog || [];
  customer.activityLog.unshift({
    id: typeof uid === "function" ? uid("cact") : `cact-${Date.now()}`,
    action,
    detail,
    userId,
    at: new Date().toISOString()
  });
  customer.activityLog = customer.activityLog.slice(0, 80);
  return customer;
}

export function parseBeneficiariesFromForm(data = {}, uid) {
  const names = [].concat(data.benName || []).filter(Boolean);
  if (!names.length && data.beneficiaryName) names.push(data.beneficiaryName);
  return names.map((name, index) => {
    const list = (key) => [].concat(data[key] || []);
    return {
      id: uid ? uid("ben") : `ben-${index}`,
      name: String(name || "").trim(),
      relationship: String(list("benRelationship")[index] || data.beneficiaryRelationship || "").trim(),
      sharePercent: Number(list("benShare")[index] || data.beneficiaryShare || 0),
      phone: String(list("benPhone")[index] || data.beneficiaryPhone || "").trim(),
      address: String(list("benAddress")[index] || "").trim()
    };
  }).filter((item) => item.name);
}

export function searchCustomersAdvanced(customers = [], query = "", extras = {}) {
  const term = String(query || "").trim().toLowerCase();
  const { branchName = () => "", agentName = () => "" } = extras;
  if (!term) return customers;
  return customers.filter((customer) => {
    const hay = [
      customer.name,
      customer.customerNumber,
      customer.membershipNumber,
      customer.accountNo,
      customer.phone,
      customer.phoneAlt,
      customer.whatsapp,
      customer.email,
      customer.ghanaCard,
      customer.nationalId,
      customer.idNumber,
      branchName(customer),
      agentName(customer)
    ].map((value) => String(value || "").toLowerCase());
    return hay.some((value) => value.includes(term));
  });
}

export function customerProfileStats(customer, {
  collections = [],
  transactions = [],
  loans = [],
  withdrawals = [],
  susuGroups = [],
  savingsAccounts = [],
  date = ""
} = {}) {
  const today = date || new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const mineCols = collections.filter((item) => item.customerId === customer.id && !item.reversed);
  const mineTx = transactions.filter((item) => item.customerId === customer.id && !item.reversed);
  const deposits = mineTx.filter((item) => item.type === "Susu Deposit" || item.type === "Collection").reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + mineCols.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const withdrawalsTotal = mineTx.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const loanBalance = loans
    .filter((loan) => loan.customerId === customer.id && !["Completed", "Settled", "Rejected"].includes(loan.status))
    .reduce((sum, loan) => sum + Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0)), 0);
  return {
    totalSavings: +deposits.toFixed(2),
    todayContribution: +mineCols.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2),
    monthlyContribution: +mineCols.filter((item) => String(item.date || "").startsWith(month)).reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2),
    transactions: mineTx.length + mineCols.length,
    loanBalance: +loanBalance.toFixed(2),
    totalWithdrawals: +withdrawalsTotal.toFixed(2),
    activeAccounts: (savingsAccounts || []).filter((item) => item.customerId === customer.id && item.status !== "Closed").length || (customer.savingsProductId ? 1 : 0),
    groupCount: (susuGroups || []).filter((group) =>
      (group.memberships || []).some((member) => member.customerId === customer.id && member.active !== false)
      || group.id === customer.susuGroupId
    ).length
  };
}

export function customerTimeline(customer, {
  collections = [],
  loans = [],
  withdrawals = [],
  users = []
} = {}) {
  const userName = (id) => users.find((user) => user.id === id)?.name || "Staff";
  const rows = [];
  if (customer.createdAt) {
    rows.push({ at: customer.createdAt, action: "Customer Registered", detail: customer.name, user: userName(customer.collectorId) });
  }
  (customer.activityLog || []).forEach((item) => {
    rows.push({ at: item.at, action: item.action, detail: item.detail, user: userName(item.userId) });
  });
  collections.filter((item) => item.customerId === customer.id && !item.reversed).slice(-8).forEach((item) => {
    rows.push({ at: item.createdAt || `${item.date}T00:00:00`, action: "Savings Collected", detail: String(item.amount), user: userName(item.userId || item.collectorId) });
  });
  loans.filter((item) => item.customerId === customer.id).forEach((item) => {
    rows.push({ at: item.createdAt || `${item.date || ""}T00:00:00`, action: item.status === "Approved" || item.status === "Disbursed" ? "Loan Approved" : "Loan Application", detail: item.status, user: userName(item.approvedBy) });
  });
  withdrawals.filter((item) => item.customerId === customer.id).forEach((item) => {
    rows.push({ at: item.createdAt || `${item.date || ""}T00:00:00`, action: item.status === "Paid" ? "Withdrawal Processed" : "Withdrawal Requested", detail: item.status, user: userName(item.requestedBy) });
  });
  return rows
    .filter((row) => row.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 20);
}

export function customerAnalytics(customers = [], { collections = [], users = [], groups = [], products = [] } = {}) {
  const month = new Date().toISOString().slice(0, 7);
  const by = (keyFn) => {
    const map = {};
    customers.forEach((customer) => {
      const key = keyFn(customer) || "Unassigned";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };
  const ageOf = (customer) => {
    if (!customer.dateOfBirth) return "Unknown";
    const years = Math.floor((Date.now() - Date.parse(customer.dateOfBirth)) / (365.25 * 86400000));
    if (years < 25) return "Under 25";
    if (years < 40) return "25–39";
    if (years < 55) return "40–54";
    return "55+";
  };
  return {
    total: customers.length,
    active: customers.filter((item) => item.memberStatus === "Active" || (item.active !== false && !item.memberStatus)).length,
    dormant: customers.filter((item) => item.dormant || item.memberStatus === "Suspended").length,
    newThisMonth: customers.filter((item) => String(item.createdAt || "").startsWith(month)).length,
    byBranch: by((item) => groups.find((group) => group.id === item.groupId)?.name),
    byAgent: by((item) => users.find((user) => user.id === item.collectorId)?.name),
    byProduct: by((item) => products.find((product) => product.id === item.savingsProductId)?.name),
    byGender: by((item) => item.gender),
    byAge: by(ageOf)
  };
}

export function exportCustomerRows(customers = [], extras = {}) {
  const { branchName = () => "", agentName = () => "", balance = () => 0 } = extras;
  return customers.map((customer) => ({
    customerNumber: customer.customerNumber || "",
    membershipNumber: customer.membershipNumber || customer.customerNumber || "",
    accountNo: customer.accountNo || "",
    name: customer.name || "",
    phone: customer.phone || "",
    ghanaCard: customer.ghanaCard || customer.nationalId || "",
    branch: branchName(customer),
    agent: agentName(customer),
    product: customer.savingsProductId || "",
    status: customer.memberStatus || (customer.active === false ? "Closed" : "Active"),
    kycStatus: customer.kycStatus || "Pending",
    balance: balance(customer)
  }));
}

export function membershipCardPayload(customer, { businessName = "SMILE TRUST SUSU MANAGEMENT SYSTEM", branch = "", agent = "" } = {}) {
  return {
    businessName,
    name: customer.name || "",
    photo: customer.passportPhoto || "",
    customerNumber: customer.customerNumber || nextCustomerNumber([customer]),
    accountNo: customer.accountNo || "",
    memberSince: (customer.createdAt || "").slice(0, 10),
    branch,
    agent,
    qrValue: `ST-CUST|${customer.customerNumber || customer.accountNo || customer.id}|${customer.name || ""}`
  };
}

export function statementRows(transactions = [], collections = [], customerId, { from = "", to = "" } = {}) {
  const rows = [
    ...transactions.filter((item) => item.customerId === customerId && !item.reversed).map((item) => ({
      date: item.date,
      type: item.type,
      amount: Number(item.amount || 0),
      id: item.id
    })),
    ...collections.filter((item) => item.customerId === customerId && !item.reversed).map((item) => ({
      date: item.date,
      type: "Savings Deposit",
      amount: Number(item.amount || 0),
      id: item.id
    }))
  ].filter((row) => (!from || row.date >= from) && (!to || row.date <= to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let running = 0;
  return rows.map((row) => {
    const signed = /withdraw|charge|penalty/i.test(row.type) ? -Math.abs(row.amount) : row.amount;
    running += signed;
    return { ...row, signed, balance: +running.toFixed(2) };
  });
}

export function ensureCustomerNumber(customer, customers = []) {
  if (!customer.customerNumber) customer.customerNumber = nextCustomerNumber(customers);
  if (!customer.membershipNumber) customer.membershipNumber = customer.customerNumber;
  return customer;
}

export const CRM_MESSAGE_TEMPLATES = [
  { id: "contribution_reminder", label: "Contribution Reminder", body: "Smile Trust: Please make your contribution today. Thank you for saving with us." },
  { id: "loan_reminder", label: "Loan Reminder", body: "Smile Trust: Your loan installment is due. Please pay your assigned agent." },
  { id: "birthday", label: "Birthday Message", body: "Smile Trust wishes you a happy birthday! Thank you for saving with us." },
  { id: "promo", label: "Promotional Message", body: "Smile Trust: Ask your agent about our holiday, education, and emergency savings products." },
  { id: "announcement", label: "Announcement", body: "Smile Trust: Please contact your branch for an important update." }
];

export function paginateList(items = [], page = 1, pageSize = 50) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pages, total };
}

export function whatsappLink(phone, text = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const intl = digits.startsWith("233") ? digits : digits.replace(/^0/, "233");
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function emailLink(email, subject = "", body = "") {
  if (!email) return "";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function parseCustomerImportRows(rows = []) {
  return rows.map((row) => ({
    name: String(row.name || row.Name || row.fullName || row["Full Name"] || "").trim(),
    phone: String(row.phone || row.Phone || row["Phone Number"] || "").trim(),
    ghanaCard: String(row.ghanaCard || row.nationalId || row["Ghana Card"] || row["National ID"] || "").trim(),
    accountNo: String(row.accountNo || row.Account || row["Account Number"] || "").trim(),
    email: String(row.email || row.Email || "").trim(),
    membershipNumber: String(row.membershipNumber || row["Membership Number"] || "").trim()
  })).filter((row) => row.name && row.phone);
}

export const CUSTOMER_DOC_MAX_BYTES = 2 * 1024 * 1024;
export const CUSTOMER_DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];
