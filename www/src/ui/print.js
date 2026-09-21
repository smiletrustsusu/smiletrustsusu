import { rt } from "../runtime.js";

export function openPrintWindow(html) {
  const popup = window.open("", "_blank");
  if (!popup) {
    toast("Pop-up blocked. Allow pop-ups to print.");
    return null;
  }
  popup.document.write(html);
  popup.document.close();
  return popup;
}

export function printReceipt(transactionId) {
  const tx = rt.state.transactions.find((item) => item.id === transactionId);
  if (!tx) return;
  const groupId = rt.state.customers.find((customer) => customer.id === tx.customerId)?.groupId;
  const receipt = `
    <html>
      <head><title>Receipt ${tx.ref}</title><style>body{font-family:Arial;padding:28px}h1{margin:0 0 12px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}</style></head>
      <body>
        <img src="assets/smile-trust-logo.png" style="width:64px;height:64px;object-fit:contain" />
        <h1>Smile Trust Susu Receipt</h1>
        <div class="row"><span>Date</span><strong>${tx.date}</strong></div>
        <div class="row"><span>Type</span><strong>${tx.type}</strong></div>
        <div class="row"><span>Member</span><strong>${escapeHtml(customerName(tx.customerId))}</strong></div>
        <div class="row"><span>Group</span><strong>${escapeHtml(groupName(groupId))}</strong></div>
        <div class="row"><span>Amount</span><strong>${money(tx.amount)}</strong></div>
        <div class="row"><span>Officer</span><strong>${escapeHtml(userName(tx.userId))}</strong></div>
        <div class="row"><span>Reference</span><strong>${tx.ref}</strong></div>
        <div style="margin-top:44px;display:flex;justify-content:space-between;gap:40px"><div>Officer signature: __________________</div><div>Member signature: __________________</div></div>
        <script>window.print();</script>
      </body>
    </html>
  `;
  openPrintWindow(receipt);
}

export function printMemberStatement(customerId) {
  const customer = rt.state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const txs = rt.state.transactions.filter((tx) => tx.customerId === customer.id);
  const sitting = memberSittingSummary(customer.id);
  const loans = rt.state.loans.filter((loan) => loan.customerId === customer.id);
  const html = `
    <html>
      <head><title>${escapeHtml(customer.name)} Statement</title><style>body{font-family:Arial;padding:28px;color:#17201d}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d8dedb;padding:8px;text-align:left}th{background:#eef4f1}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.box{border:1px solid #d8dedb;padding:10px}</style></head>
      <body>
        <img src="assets/smile-trust-logo.png" style="width:64px;height:64px;object-fit:contain" />
        <h1>Smile Trust Susu Member Statement</h1>
        <p><strong>${escapeHtml(customer.name)}</strong> - ${escapeHtml(groupName(customer.groupId))} - ${escapeHtml(customer.phone || "")}</p>
        <div class="grid">
          <div class="box">Total contribution<br><strong>${money(customerBalance(customer.id))}</strong></div>
          <div class="box">Sitting paid<br><strong>${sitting.paid} / ${sitting.target}</strong></div>
          <div class="box">Remaining sitting<br><strong>${sitting.remaining}</strong></div>
          <div class="box">Loan balance<br><strong>${money(loanBalanceForCustomer(customer.id))}</strong></div>
        </div>
        <h2>Transactions</h2>
        <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Officer</th></tr></thead><tbody>${txs.map((tx) => `<tr><td>${tx.date}</td><td>${tx.type}</td><td>${money(tx.amount)}</td><td>${escapeHtml(userName(tx.userId))}</td></tr>`).join("")}</tbody></table>
        <h2>Loans</h2>
        <table><thead><tr><th>Date</th><th>Principal</th><th>Total Due</th><th>Paid</th><th>Status</th></tr></thead><tbody>${loans.map((loan) => `<tr><td>${loan.date}</td><td>${money(loan.principal)}</td><td>${money(loan.totalDue)}</td><td>${money(loan.amountPaid)}</td><td>${loan.status}</td></tr>`).join("")}</tbody></table>
        <div style="margin-top:44px;display:flex;justify-content:space-between;gap:40px"><div>Officer signature: __________________</div><div>Member signature: __________________</div></div>
        <script>window.print();</script>
      </body>
    </html>
  `;
  openPrintWindow(html);
}

export function printDailyInputLog() {
  const selectedDate = sessionStorage.getItem("log_date") || today();
  const rows = dailyInputLogRows(selectedDate);
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const report = `
    <html>
      <head>
        <title>Daily Input Log ${selectedDate}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:28px;color:#17201d}
          h1{margin:0 0 4px;font-size:22px}
          p{margin:0 0 18px;color:#59645f}
          table{width:100%;border-collapse:collapse;font-size:12px}
          th,td{border:1px solid #d8dedb;padding:8px;text-align:left}
          th{background:#eef4f1}
          tfoot td{font-weight:700}
        </style>
      </head>
      <body>
        <h1>Smile Trust Susu Daily Input Log</h1>
        <p>Date: ${selectedDate}</p>
        <table>
          <thead><tr><th>Time</th><th>Group</th><th>Member</th><th>Input Type</th><th>Amount</th><th>Officer</th><th>Reference</th></tr></thead>
          <tbody>
            ${rows.map((row) => `<tr><td>${escapeHtml(row.time)}</td><td>${escapeHtml(row.group)}</td><td>${escapeHtml(row.member)}</td><td>${escapeHtml(row.type)}</td><td>${money(row.amount)}</td><td>${escapeHtml(row.officer)}</td><td>${escapeHtml(row.ref)}</td></tr>`).join("")}
          </tbody>
          <tfoot><tr><td colspan="4">Total received</td><td>${money(total)}</td><td colspan="2"></td></tr></tfoot>
        </table>
        <script>window.print();</script>
      </body>
    </html>
  `;
  openPrintWindow(report);
}

