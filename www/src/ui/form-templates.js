export function amountInWords(value) {
  const amount = Math.round(Number(value || 0) * 100);
  if (!Number.isFinite(amount) || amount < 0) return "";
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function chunk(num) {
    let text = "";
    if (num >= 100) {
      text += `${units[Math.floor(num / 100)]} Hundred`;
      num %= 100;
      if (num) text += " and ";
    }
    if (num >= 20) {
      text += tens[Math.floor(num / 10)];
      if (num % 10) text += ` ${units[num % 10]}`;
    } else if (num > 0) {
      text += units[num];
    }
    return text.trim();
  }

  const cedis = Math.floor(amount / 100);
  const pesewas = amount % 100;
  let words = "";
  if (cedis >= 1_000_000) {
    words += `${chunk(Math.floor(cedis / 1_000_000))} Million`;
    const rest = cedis % 1_000_000;
    if (rest) words += ` ${chunk(rest)}`;
  } else {
    words = chunk(cedis);
  }
  if (!words) words = "Zero";
  words += " Ghana Cedis";
  if (pesewas) words += ` and ${chunk(pesewas)} Pesewas`;
  return words;
}

export function formPrintStyles() {
  return `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 18px; font-size: 12px; }
    h1, h2, h3 { margin: 0; letter-spacing: 0.04em; text-transform: uppercase; }
    .brand { text-align: center; margin-bottom: 10px; }
    .brand h1 { font-size: 22px; }
    .brand h2 { font-size: 15px; margin-top: 4px; font-weight: 700; }
    .line { display: flex; gap: 8px; margin: 7px 0; align-items: baseline; }
    .line .label { white-space: nowrap; font-weight: 700; }
    .line .value { flex: 1; border-bottom: 1px solid #111; min-height: 16px; padding: 0 4px 2px; }
    table.sheet { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.sheet th, table.sheet td { border: 1px solid #111; padding: 6px 8px; text-align: left; vertical-align: top; }
    table.sheet th { text-transform: uppercase; font-size: 11px; }
    .section { margin-top: 16px; }
    .section-title { font-weight: 700; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #111; padding-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; }
    .sign-box { margin-top: 18px; }
    .triplicate { page-break-inside: avoid; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px dashed #777; }
    .triplicate:last-child { border-bottom: 0; }
    .office { margin-top: 18px; padding-top: 10px; border-top: 2px solid #111; }
    .paragraph { line-height: 1.55; margin: 12px 0; text-align: justify; }
  `;
}

export function wrapPrintDocument(title, body, autoPrint = true) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${formPrintStyles()}</style>
  </head>
  <body>${body}${autoPrint ? "<script>window.print();</script>" : ""}</body>
</html>`;
}

function brandBlock(subtitle) {
  return `
    <div class="brand">
      <h1>SMILE TRUST</h1>
      <h2>${subtitle}</h2>
    </div>
  `;
}

function fieldLine(label, value = "") {
  return `<div class="line"><span class="label">${label}</span><span class="value">${value ?? ""}</span></div>`;
}

function signatureBlock(rows) {
  return `<div class="sign-row">${rows.map((row) => `<div class="sign-box">${fieldLine(row.label)}</div>`).join("")}</div>`;
}

export function renderCollectorSheet({ date, rows = [] }) {
  const emptyRows = Array.from({ length: Math.max(0, 12 - rows.length) }, () => "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>").join("");
  const body = `
    ${brandBlock("Collector's Sheet")}
    ${fieldLine("DATE:", date)}
    <table class="sheet">
      <thead><tr><th>A/C</th><th>NAME</th><th>AMOUNT</th><th>BALANCE</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${row.accountNo || ""}</td><td>${row.name || ""}</td><td>${row.amount || ""}</td><td>${row.balance || ""}</td></tr>`).join("")}
        ${emptyRows}
      </tbody>
    </table>
  `;
  return wrapPrintDocument(`Collector's Sheet ${date}`, body);
}

function ledgerRows(transactions = []) {
  let balance = 0;
  return transactions.map((tx) => {
    const debit = tx.debit || "";
    const credit = tx.credit || "";
    if (credit) balance += Number(String(credit).replace(/[^\d.-]/g, "") || 0);
    if (debit) balance -= Number(String(debit).replace(/[^\d.-]/g, "") || 0);
    return { date: tx.date || "", details: tx.details || "", debit, credit, balance: tx.balance ?? balance.toFixed(2) };
  });
}

function ledgerTable(rows = [], emptyRows = 10) {
  const filled = rows.map((row) => `<tr><td>${row.date}</td><td>${row.details}</td><td>${row.debit}</td><td>${row.credit}</td><td>${row.balance ?? ""}</td></tr>`).join("");
  const blanks = Array.from({ length: Math.max(0, emptyRows - rows.length) }, () => "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>").join("");
  return `<table class="sheet"><thead><tr><th>DATE</th><th>DETAILS</th><th>DEBIT</th><th>CREDIT</th><th>BALANCE</th></tr></thead><tbody>${filled}${blanks}</tbody></table>`;
}

export function renderAccountsSheet({ accountNo, transactions = [] }) {
  const rows = ledgerRows(transactions);
  const half = Math.ceil(Math.max(rows.length, 1) / 2);
  const body = `
    ${brandBlock("Accounts Sheet")}
    ${fieldLine("ACCOUNT NUMBER:", accountNo)}
    <div class="grid-2 section">
      <div>${ledgerTable(rows.slice(0, half))}</div>
      <div>${ledgerTable(rows.slice(half))}</div>
    </div>
  `;
  return wrapPrintDocument(`Accounts Sheet ${accountNo}`, body);
}

export function renderControlSheet({ date, transactions = [] }) {
  const body = `
    ${brandBlock("Control")}
    ${fieldLine("DATE:", date)}
    ${ledgerTable(ledgerRows(transactions), 16)}
  `;
  return wrapPrintDocument(`Control ${date}`, body);
}

function withdrawalCopy(data) {
  return `
    <div class="triplicate">
      ${brandBlock("Withdrawal Form")}
      ${fieldLine("Date:", data.date)}
      <div class="grid-2">
        ${fieldLine("ACCOUNT NUMBER:", data.accountNo)}
        ${fieldLine("ACCOUNT NAME:", data.accountName)}
      </div>
      ${fieldLine("Amount in words:", data.amountWords)}
      ${fieldLine("Amount in figures:", data.amountFigures)}
      ${fieldLine("Customer's Signature/Thumbprint:")}
      <div class="grid-2">
        ${fieldLine("Collector's Name:", data.collectorName)}
        ${fieldLine("Collector's Signature:")}
      </div>
      ${fieldLine("Manager's Signature:")}
    </div>
  `;
}

export function renderWithdrawalForm(data) {
  return wrapPrintDocument("Withdrawal Form", `${withdrawalCopy(data)}${withdrawalCopy(data)}${withdrawalCopy(data)}`);
}

export function renderLoanApplicationForm(data) {
  const body = `
    ${brandBlock("Loan Application Form")}
    <div class="section">
      <div class="section-title">Applicant's Biodata</div>
      ${fieldLine("NAME:", data.applicantName)}
      ${fieldLine("ACCOUNT NUMBER:", data.accountNo)}
      ${fieldLine("GHANA CARD:", data.ghanaCard)}
      ${fieldLine("TEL. NUMBER(S):", data.phone)}
      ${fieldLine("RESIDENTIAL ADDRESS:", data.address)}
      ${fieldLine("LOAN AMOUNT IN FIGURES:", data.amountFigures)}
      ${fieldLine("LOAN AMOUNT IN WORDS:", data.amountWords)}
      ${fieldLine("PURPOSE OF LOAN:", data.purpose)}
      ${fieldLine("REPAYMENT PERIOD:", data.repaymentPeriod)}
      ${fieldLine("REQUEST DATE:", data.requestDate)}
      ${fieldLine("SIGN/THUMBPRINT:")}
    </div>
    <div class="section">
      <div class="section-title">Guarantor's Biodata</div>
      ${fieldLine("NAME:", data.guarantorName)}
      ${fieldLine("GHANA CARD NUMBER:", data.guarantorGhanaCard)}
      ${fieldLine("ACCOUNT NUMBER:", data.guarantorAccountNo)}
      ${fieldLine("TEL. NUMBER(S):", data.guarantorPhone)}
      ${fieldLine("SIGN/THUMBPRINT:")}
    </div>
    <div class="office section">
      <div class="section-title">Office Use Only</div>
      ${fieldLine("Collector's Recommendation:", data.collectorRecommendation)}
      ${fieldLine("", "")}
      ${fieldLine("Managing's Recommendation:", data.managerRecommendation)}
      ${fieldLine("", "")}
      <div class="grid-2">
        ${fieldLine("AMOUNT APPROVED:", data.amountApproved)}
        ${fieldLine("PERIOD:", data.period)}
      </div>
      <div class="grid-2">
        ${fieldLine("PRINCIPAL:", data.principal)}
        ${fieldLine("INTEREST:", data.interest)}
      </div>
      ${fieldLine("APPROVED:", data.approvedDate)}
      <div class="grid-2">
        ${fieldLine("Collector's Signature:")}
        ${fieldLine("Manager's Signature:")}
      </div>
    </div>
  `;
  return wrapPrintDocument("Loan Application Form", body);
}

export function renderLoanAcceptanceForm(data) {
  const body = `
    ${brandBlock("Loan Acceptance Form")}
    <p class="paragraph">
      I, <strong>${data.applicantName || "................................"}</strong> on this <strong>${data.acceptanceDay || "...."}</strong> day of
      <strong>${data.acceptanceMonth || ".........."}</strong> 20<strong>${data.acceptanceYear || ".."}</strong>, do accept the loan offer of
      <strong>${data.amountFigures || "GHC ................"}</strong> (<strong>${data.amountWords || "................................"}</strong>) from SMILE TRUST for (purpose)
      <strong>${data.purpose || "................................"}</strong> to be repaid within a period of <strong>${data.repaymentMonths || "..."}</strong> months in
      <strong>${data.monthlyInstallment || "GHC .........."}</strong> monthly instalment at a rate of <strong>${data.interestRate || "15"}%</strong>, starting from
      <strong>${data.startDate || ".........."}</strong> to <strong>${data.endDate || ".........."}</strong>.
    </p>
    <p class="paragraph">
      I am aware that I am by this compelled to fulfill my obligation owed the Company (SMILE TRUST) and to repay within the stipulated time of
      <strong>${data.repaymentMonths || "..."}</strong> months. I hereby give the Company (SMILE TRUST) the go ahead to use any LEGAL MEANS at their disposal to retrieve the money after the stipulated period of
      <strong>${data.repaymentMonths || "..."}</strong> months.
    </p>
    ${signatureBlock([
      { label: "Customer Sign/Thumbprint" },
      { label: "Guarantor Sign/Thumbprint" }
    ])}
    <div class="grid-2">
      ${fieldLine("Collector's Signature:")}
      ${fieldLine("Manager's Signature:")}
    </div>
  `;
  return wrapPrintDocument("Loan Acceptance Form", body);
}

export function buildAccountLedgerTransactions(customer, transactions, moneyFn) {
  let balance = 0;
  return transactions.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((tx) => {
    const creditTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
    const debitTypes = ["Withdrawal", "Loan Disbursement"];
    const amount = Number(tx.amount || 0);
    const credit = creditTypes.includes(tx.type) ? moneyFn(amount) : "";
    const debit = debitTypes.includes(tx.type) ? moneyFn(amount) : "";
    if (credit) balance += amount;
    if (debit) balance -= amount;
    return {
      date: tx.date,
      details: tx.type + (tx.note ? ` - ${tx.note}` : ""),
      debit,
      credit,
      balance: moneyFn(balance)
    };
  });
}

export function buildCollectorRows(collections, customers, balanceFn, moneyFn, date) {
  return collections
    .filter((item) => item.date === date && Number(item.amount || 0) > 0)
    .map((item) => {
      const customer = customers.find((c) => c.id === item.customerId);
      return {
        accountNo: customer?.accountNo || "",
        name: customer?.name || "",
        amount: moneyFn(item.amount),
        balance: moneyFn(balanceFn(customer?.id))
      };
    });
}

export function buildControlRows(transactions, moneyFn, date) {
  return transactions
    .filter((tx) => tx.date === date)
    .map((tx) => {
      const creditTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
      const debitTypes = ["Withdrawal", "Loan Disbursement"];
      const amount = Number(tx.amount || 0);
      return {
        date: tx.date,
        details: tx.type,
        debit: debitTypes.includes(tx.type) ? moneyFn(amount) : "",
        credit: creditTypes.includes(tx.type) ? moneyFn(amount) : ""
      };
    });
}
