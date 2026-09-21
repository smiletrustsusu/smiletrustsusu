import { rt } from "../runtime.js";
import { isSystemDeveloperAccount, listUsersForActor, displayUserNameForActor } from "../core/system-accounts.js";
import { currentUser } from "../core/auth.js";

export async function importFileRecords(file, kind, groupId) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return importWorkbook(file, groupId);
  }
  const text = await extractDocumentText(file);
  const rows = rowsFromText(text);
  if (!rows.length) throw new Error("No readable table rows were found.");
  if (kind === "savings") return importSavingsRows(rows, groupId, "PDF/DOCX savings import");
  if (kind === "loans") return importLoanRows(rows, groupId, "PDF/DOCX loan import");
  if (kind === "log") return importLogRows(rows, groupId, "PDF/DOCX log import");
  return importSavingsRows(rows, groupId, "Auto text import treated as savings");
}

export async function importWorkbook(file, groupId) {
  if (!window.XLSX) throw new Error("Excel parser is not ready.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const result = { savings: 0, loans: 0, logs: 0, note: "Excel sheets were detected by sheet name." };
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    const key = sheetName.toLowerCase();
    if (key.includes("loan")) {
      const imported = importLoanRows(rows, groupId, sheetName);
      result.loans += imported.loans;
    } else if (key.includes("log")) {
      const imported = importLogRows(rows, groupId, sheetName);
      result.logs += imported.logs;
    } else {
      const imported = importSavingsRows(rows, groupId, sheetName);
      result.savings += imported.savings;
    }
  });
  return result;
}

export async function extractDocumentText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    if (!window.mammoth) throw new Error("Word parser is not ready.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (name.endsWith(".pdf")) {
    if (!window.pdfjsLib) throw new Error("PDF parser is still loading. Try again.");
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n");
  }
  return file.text();
}

export function rowsFromText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitImportLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitImportLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

export function splitImportLine(line) {
  return line.split(/\t|,|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

export function importSavingsRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const amount = numberValue(row, ["amount", "contribution", "paid", "payment"]);
    const total = numberValue(row, ["total", "total amount", "total contributed", "balance"]);
    const value = amount || total;
    const name = textValue(row, ["name", "full name", "member", "customer"]);
    if (!name || !value) return;
    const customer = ensureCustomerFromRow(row, groupId, value);
    const date = dateValue(row) || today();
    const collection = {
      id: uid("col"),
      customerId: customer.id,
      groupId,
      contributionNo: nextContributionNo(customer.id),
      amount: value,
      date,
      status: "Paid",
      note: `Imported from ${source}`,
      userId: currentUser().id
    };
    rt.state.collections.push(collection);
    addTransaction("Susu Deposit", customer.id, value, collection.id, date);
    createPaymentMessage(customer.id, value, date);
    count += 1;
  });
  return { savings: count, loans: 0, logs: 0, note: `${count} savings rows imported.` };
}

export function importLoanRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const principal = numberValue(row, ["principal", "amount", "loan", "borrowed"]);
    const name = textValue(row, ["name", "full name", "member", "customer"]);
    if (!name || !principal) return;
    const customer = ensureCustomerFromRow(row, groupId, 0);
    const group = groupById(groupId);
    const interest = numberValue(row, ["interest", "rate", "percentage"]) || group?.interest || rt.state.settings.loanInterest;
    const interestMonths = numberValue(row, ["interest months", "months", "interest period"]) || 1;
    const totalDue = numberValue(row, ["total", "total due", "repay", "repayment"]) || principal + ((principal * interest) / 100) * interestMonths;
    const amountPaid = numberValue(row, ["paid", "amount paid", "repaid"]) || 0;
    const date = dateValue(row) || today();
    const loan = {
      id: uid("loan"),
      customerId: customer.id,
      groupId,
      principal,
      interest,
      termDays: interestMonths * 30,
      interestMonths,
      purpose: `Imported from ${source}`,
      totalDue,
      amountPaid,
      status: amountPaid >= totalDue ? "Completed" : "Active",
      date,
      approvedBy: currentUser().id
    };
    rt.state.loans.push(loan);
    addTransaction("Loan Disbursement", customer.id, principal, loan.id, date);
    if (amountPaid > 0) addTransaction("Loan Repayment", customer.id, amountPaid, loan.id, date);
    count += 1;
  });
  return { savings: 0, loans: count, logs: 0, note: `${count} loan rows imported.` };
}

export function importLogRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const action = textValue(row, ["action", "activity", "type", "log"]) || "Imported log";
    const details = textValue(row, ["details", "description", "note", "remarks"]) || textValue(row, ["name", "member", "customer"]);
    rt.state.audit.push({
      id: uid("audit"),
      action,
      details: `${details || ""} (${source})`,
      userId: currentUser().id,
      groupIds: [groupId],
      date: dateValue(row) || new Date().toLocaleString(),
      createdAt: new Date().toISOString()
    });
    count += 1;
  });
  return { savings: 0, loans: 0, logs: count, note: `${count} log rows imported.` };
}

export function ensureCustomerFromRow(row, groupId, amount) {
  const name = textValue(row, ["name", "full name", "member", "customer"]);
  const phone = textValue(row, ["phone", "telephone", "mobile", "contact"]);
  const nhis = textValue(row, ["nhis", "nhis number", "health insurance"]);
  let customer = rt.state.customers.find((item) => item.groupId === groupId && item.name.toLowerCase() === name.toLowerCase());
  if (!customer) {
    customer = {
      id: uid("cust"),
      accountNo: `ST-${String(rt.state.customers.length + 1).padStart(4, "0")}`,
      name,
      phone,
      nhis,
      address: "",
      groupId,
      dailyAmount: amount || groupById(groupId)?.defaultAmount || 0,
      collectorId: currentUser().id,
      active: true,
      createdAt: new Date().toISOString()
    };
    rt.state.customers.push(customer);
  }
  return customer;
}

export function textValue(row, names) {
  const match = Object.keys(row).find((key) => names.includes(normalizeHeader(key)));
  return match ? String(row[match]).trim() : "";
}

export function numberValue(row, names) {
  const raw = textValue(row, names).replace(/[^\d.-]/g, "");
  return Number(raw) || 0;
}

export function dateValue(row) {
  const raw = textValue(row, ["date", "day", "created", "payment date"]);
  if (!raw) return "";
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toISOString().slice(0, 10);
}

export function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function customerBalance(customerId) {
  const deposits = rt.state.transactions.filter((tx) => tx.customerId === customerId && tx.type === "Susu Deposit").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const withdrawals = rt.state.transactions.filter((tx) => tx.customerId === customerId && tx.type === "Withdrawal").reduce((sum, tx) => sum + Number(tx.amount), 0);
  return deposits - withdrawals;
}

export function visibleClosings() {
  if (isKBA()) return rt.state.closings || [];
  const groups = visibleGroupIds();
  return (rt.state.closings || []).filter((closing) => groups.includes(closing.groupId));
}

export function expectedCashForDate(date) {
  const types = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  return visibleTransactions()
    .filter((tx) => tx.date === date && types.includes(tx.type))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

export function backupDoneToday() {
  return String(rt.state.settings.lastBackupAt || "").slice(0, 10) === today();
}

export function groupById(id) {
  return rt.state.groups.find((group) => group.id === id);
}

export function groupName(id) {
  return groupById(id)?.name || "No group";
}

export function groupSummary(groupId) {
  const members = rt.state.customers.filter((customer) => customer.groupId === groupId);
  const contributed = rt.state.transactions
    .filter((tx) => tx.type === "Susu Deposit" && members.some((member) => member.id === tx.customerId))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const group = groupById(groupId);
  const target = group?.targetContributions || rt.state.settings.collectionDays;
  const expected = members.reduce((sum, member) => sum + perSittingAmount(member) * target, 0);
  return { members: members.length, contributed, expected };
}

export function memberProgress(customerId) {
  const summary = memberSittingSummary(customerId);
  return `${summary.paid} paid · ${summary.remaining} remaining`;
}

export function printClosingById(id) {
  const closing = rt.state.closings.find((item) => item.id === id);
  if (closing) printClosing(closing.date, closing);
}

export function printClosing(date, row = null) {
  const closing = row || visibleClosings().find((item) => item.date === date);
  const expected = closing?.expected ?? expectedCashForDate(date);
  const counted = Number(closing?.counted || 0);
  const html = `
    <html>
      <head><title>Daily Closing ${date}</title><style>body{font-family:Arial;padding:28px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}</style></head>
      <body>
        <img src="assets/smile-trust-logo.png" style="width:64px;height:64px;object-fit:contain" />
        <h1>Smile Trust Susu Daily Closing</h1>
        <div class="row"><span>Date</span><strong>${date}</strong></div>
        <div class="row"><span>Expected cash</span><strong>${money(expected)}</strong></div>
        <div class="row"><span>Cash counted</span><strong>${money(counted)}</strong></div>
        <div class="row"><span>Shortage / overage</span><strong>${money(counted - expected)}</strong></div>
        <div class="row"><span>Closed by</span><strong>${escapeHtml(closing?.closedByName || currentUser()?.name || "")}</strong></div>
        <p>${escapeHtml(closing?.note || "")}</p>
        <div style="margin-top:44px;display:flex;justify-content:space-between;gap:40px"><div>Money keeper: __________________</div><div>Money counter: __________________</div><div>Input officer: __________________</div></div>
        <script>window.print();</script>
      </body>
    </html>
  `;
  openPrintWindow(html);
}

export function memberSittingSummary(customerId) {
  const customer = rt.state.customers.find((item) => item.id === customerId);
  const group = groupById(customer?.groupId);
  const target = group?.targetContributions || rt.state.settings.collectionDays;
  const paid = rt.state.collections
    .filter((item) => item.customerId === customerId && Number(item.amount) > 0)
    .reduce((sum, item) => sum + Number(item.sittingsPaid || item.contributionNo || 0), 0);
  const perSitting = perSittingAmount(customer);
  const remaining = Math.max(0, target - paid);
  return {
    target,
    paid,
    remaining,
    perSitting,
    expectedAmount: target * perSitting,
    paidAmount: paid * perSitting,
    remainingAmount: remaining * perSitting
  };
}

export function nextContributionNo(customerId) {
  const paid = rt.state.collections
    .filter((item) => item.customerId === customerId && Number(item.amount) > 0)
    .reduce((sum, item) => sum + Number(item.sittingsPaid || item.contributionNo || 0), 0);
  return paid + 1;
}

export function calculateSittingsPaid(customer, amount) {
  const sitting = perSittingAmount(customer);
  if (!sitting) return 0;
  return Math.max(0, Math.floor(Number(amount || 0) / sitting));
}

export function groupSelect(name, selectedId = "") {
  const active = visibleGroups().filter((group) => group.active);
  if (!active.length) return `<select name="${name}" required><option value="">Create a susu location first</option></select>`;
  return `<select name="${name}" required>${active.map((group) => `<option value="${group.id}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(group.name)} · every ${group.intervalDays} day(s) · ${group.targetContributions} sitting</option>`).join("")}</select>`;
}

export function adminSelect(name, selectedId = "") {
  const admins = rt.state.users.filter((user) => user.active && ["Admin", "Input Officer", "Money Keeper", "Money Counter"].includes(user.role));
  if (!admins.length) return `<select name="${name}" required><option value="">Create a staff user first</option></select>`;
  return `<select name="${name}" required>${admins.map((user) => `<option value="${user.id}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${user.role}</option>`).join("")}</select>`;
}

export function customerSelect(name, selectedId = "") {
  const active = visibleCustomers().filter((c) => c.active);
  if (!active.length) return `<select name="${name}" required><option value="">No customers yet</option></select>`;
  return `<select name="${name}" required>${active.map((c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.accountNo)} · ${escapeHtml(c.name)} · ${escapeHtml(groupName(c.groupId))}</option>`).join("")}</select>`;
}

export function userSelect(name, includeBlank = false) {
  const staff = listUsersForActor(rt.state.users, currentUser()).filter((u) =>
    u.active
    && ["SystemOwner", "Admin", "Input Officer", "Money Keeper", "Money Counter", "Collector"].includes(u.role)
    && !isSystemDeveloperAccount(u)
  );
  return `<select name="${name}">${includeBlank ? `<option value="">Unassigned</option>` : ""}${staff.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} · ${u.role}</option>`).join("")}</select>`;
}

export function loanSelect(name, selected = "") {
  const activeLoans = visibleLoans().filter((loan) => loan.status === "Active");
  const selectedLoan = selected ? visibleLoans().find((loan) => loan.id === selected) : null;
  const loans = selectedLoan && !activeLoans.some((loan) => loan.id === selectedLoan.id) ? [selectedLoan, ...activeLoans] : activeLoans;
  if (!loans.length) return `<select name="${name}" required><option value="">No active loans</option></select>`;
  return `<select name="${name}" required>${loans.map((loan) => `<option value="${loan.id}" ${selected === loan.id ? "selected" : ""}>${escapeHtml(customerName(loan.customerId))} - Balance ${money(loan.totalDue - loan.amountPaid)}</option>`).join("")}</select>`;
}

export function customerName(id) {
  return rt.state.customers.find((c) => c.id === id)?.name || "Unknown";
}

export function userName(id) {
  return displayUserNameForActor(rt.state.users, id, currentUser(), "Unassigned");
}

export function exportCsv(type) {
  const rows = {
    groups: visibleGroups(),
    collections: visibleCollections(),
    loans: visibleLoans(),
    repayments: visibleTransactions().filter((tx) => tx.type === "Loan Repayment"),
    transactions: visibleTransactions(),
    messages: visibleMessages(),
    audit: visibleAudit(),
    closings: visibleClosings(),
    arrears: arrearsRows(),
    dailyLog: dailyMoneyLogRows(),
    dailyInputs: dailyInputLogRows(),
    memberReport: memberFinancialReportRows(),
    distribution: distributionRows()
  }[type];
  if (!rows?.length) {
    toast("Nothing to export");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
  download(`${type}-${today()}.csv`, csv, "text/csv");
}

export function exportBackup() {
  rt.state.settings.lastBackupAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(rt.state));
  download(`smile-trust-backup-${today()}.json`, JSON.stringify(rt.state, null, 2), "application/json");
}

export function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      rt.state = normalizeState(mergeStates(state, JSON.parse(reader.result)));
      sessionStorage.removeItem("smile_trust_session_user");
      rt.sessionUserId = null;
      toast("Backup merged");
      render();
    } catch {
      toast("Could not restore this backup file");
    }
  };
  reader.readAsText(file);
}

