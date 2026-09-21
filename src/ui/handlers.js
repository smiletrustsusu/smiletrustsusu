import { rt } from "../runtime.js";

export function attachHandlers() {
  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      rt.activeView = button.dataset.viewJump;
      render();
    });
  });

  const customerForm = document.querySelector("#customerForm");
  if (customerForm) customerForm.addEventListener("submit", handleCustomer);
  const cancelCustomerEdit = document.querySelector("#cancelCustomerEdit");
  if (cancelCustomerEdit) cancelCustomerEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_customer_id");
    render();
  });

  const groupForm = document.querySelector("#groupForm");
  if (groupForm) groupForm.addEventListener("submit", handleGroup);
  const cancelGroupEdit = document.querySelector("#cancelGroupEdit");
  if (cancelGroupEdit) cancelGroupEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_group_id");
    render();
  });

  const collectionForm = document.querySelector("#collectionForm");
  if (collectionForm) {
    collectionForm.addEventListener("submit", handleCollection);
    const customerPicker = collectionForm.querySelector('select[name="customerId"]');
    const amountInput = collectionForm.querySelector('input[name="amount"]');
    if (customerPicker && amountInput) {
      customerPicker.addEventListener("change", () => fillCollectionDefaultAmount(true));
      if (!amountInput.value) fillCollectionDefaultAmount(false);
    }
  }
  const cancelCollectionEdit = document.querySelector("#cancelCollectionEdit");
  if (cancelCollectionEdit) cancelCollectionEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_collection_id");
    render();
  });

  const withdrawForm = document.querySelector("#withdrawForm");
  if (withdrawForm) withdrawForm.addEventListener("submit", handleWithdrawal);

  const loanForm = document.querySelector("#loanForm");
  if (loanForm) loanForm.addEventListener("submit", handleLoan);
  const cancelLoanEdit = document.querySelector("#cancelLoanEdit");
  if (cancelLoanEdit) cancelLoanEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_loan_id");
    render();
  });

  const repaymentForm = document.querySelector("#repaymentForm");
  if (repaymentForm) repaymentForm.addEventListener("submit", handleRepayment);
  const cancelRepaymentEdit = document.querySelector("#cancelRepaymentEdit");
  if (cancelRepaymentEdit) cancelRepaymentEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_repayment_id");
    render();
  });

  const importForm = document.querySelector("#importForm");
  if (importForm) importForm.addEventListener("submit", handleImport);
  const closingForm = document.querySelector("#closingForm");
  if (closingForm) {
    closingForm.addEventListener("submit", handleClosing);
    closingForm.querySelector('input[name="date"]').addEventListener("change", (event) => {
      sessionStorage.setItem("closing_date", event.target.value || today());
      render();
    });
  }
  const printClosingBtn = document.querySelector("#printClosingBtn");
  if (printClosingBtn) printClosingBtn.addEventListener("click", () => printClosing(sessionStorage.getItem("closing_date") || today()));

  const settingsForm = document.querySelector("#settingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", handleSettings);
  const pushCloudButton = document.querySelector("#pushCloudBackup");
  if (pushCloudButton) pushCloudButton.addEventListener("click", pushCloudBackup);
  const pullCloudButton = document.querySelector("#pullCloudBackup");
  if (pullCloudButton) pullCloudButton.addEventListener("click", pullCloudBackup);
  const replaceCloudButton = document.querySelector("#replaceCloudBackup");
  if (replaceCloudButton) replaceCloudButton.addEventListener("click", replaceCloudBackup);

  const userForm = document.querySelector("#userForm");
  if (userForm) userForm.addEventListener("submit", handleUser);
  const cancelUserEdit = document.querySelector("#cancelUserEdit");
  if (cancelUserEdit) cancelUserEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_user_id");
    render();
  });

  const clearMessagesBtn = document.querySelector("#clearMessagesBtn");
  if (clearMessagesBtn) clearMessagesBtn.addEventListener("click", () => {
    const visibleIds = visibleMessages().map((message) => message.id);
    rt.state.messages = rt.state.messages.filter((message) => !visibleIds.includes(message.id));
    saveState();
    render();
  });
  const cancelPendingMessagesBtn = document.querySelector("#cancelPendingMessagesBtn");
  if (cancelPendingMessagesBtn) cancelPendingMessagesBtn.addEventListener("click", () => {
    const cancelled = cancelPendingMessages(false);
    if (cancelled) {
      saveState();
      pushCloudBackup(true);
    }
    toast(cancelled ? `${cancelled} pending message(s) cancelled` : "No pending messages to cancel");
    render();
  });
  const selectAllMessages = document.querySelector("#selectAllMessages");
  if (selectAllMessages) selectAllMessages.addEventListener("change", () => {
    document.querySelectorAll("[data-message-select]").forEach((input) => { input.checked = selectAllMessages.checked; });
  });
  const sendSelectedMessagesBtn = document.querySelector("#sendSelectedMessagesBtn");
  if (sendSelectedMessagesBtn) sendSelectedMessagesBtn.addEventListener("click", () => sendSelectedMessages());
  const markSelectedMessagesBtn = document.querySelector("#markSelectedMessagesBtn");
  if (markSelectedMessagesBtn) markSelectedMessagesBtn.addEventListener("click", () => markSelectedMessagesSent());
  const cancelSelectedMessagesBtn = document.querySelector("#cancelSelectedMessagesBtn");
  if (cancelSelectedMessagesBtn) cancelSelectedMessagesBtn.addEventListener("click", () => cancelSelectedMessages());

  const backupButton = document.querySelector("#backupBtn");
  if (backupButton) backupButton.addEventListener("click", exportBackup);
  const restoreInput = document.querySelector("#restoreInput");
  if (restoreInput) restoreInput.addEventListener("change", restoreBackup);
  const logDate = document.querySelector("#logDate");
  if (logDate) logDate.addEventListener("change", () => {
    sessionStorage.setItem("log_date", logDate.value || today());
    document.querySelector("#dailyInputLogTable").innerHTML = renderDailyInputLogTable(dailyInputLogRows(logDate.value || today()));
  });
  const todayLogBtn = document.querySelector("#todayLogBtn");
  if (todayLogBtn) todayLogBtn.addEventListener("click", () => {
    sessionStorage.setItem("log_date", today());
    render();
  });
  const printLogBtn = document.querySelector("#printLogBtn");
  if (printLogBtn) printLogBtn.addEventListener("click", printDailyInputLog);
  const reportFrom = document.querySelector("#reportFrom");
  const reportTo = document.querySelector("#reportTo");
  if (reportFrom) reportFrom.addEventListener("change", () => setReportRange(reportFrom.value, reportTo?.value || reportFrom.value));
  if (reportTo) reportTo.addEventListener("change", () => setReportRange(reportFrom?.value || reportTo.value, reportTo.value));
  document.querySelectorAll("[data-report-range]").forEach((button) => {
    button.addEventListener("click", () => setQuickReportRange(button.dataset.reportRange));
  });

  const search = document.querySelector("#customerSearch");
  if (search) search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const filtered = visibleCustomers().filter((c) => `${c.name} ${c.phone} ${c.nhis} ${c.accountNo} ${groupName(c.groupId)}`.toLowerCase().includes(q));
    document.querySelector("#customerTable").innerHTML = renderCustomerTable(filtered);
    attachToggleButtons();
  });

  const collectionSearch = document.querySelector("#collectionSearch");
  if (collectionSearch) collectionSearch.addEventListener("input", () => {
    const q = collectionSearch.value.trim().toLowerCase();
    const filtered = visibleCollections().filter((item) => `${item.date} ${customerName(item.customerId)} ${groupName(item.groupId)} ${item.amount} ${item.status}`.toLowerCase().includes(q));
    document.querySelector("#collectionTable").innerHTML = renderCollectionsTable(filtered);
    attachToggleButtons();
  });

  const memberSearch = document.querySelector("#collectionMemberSearch");
  if (memberSearch) memberSearch.addEventListener("input", () => {
    const q = memberSearch.value.trim().toLowerCase();
    const match = visibleCustomers().find((c) => `${c.name} ${c.phone} ${c.nhis} ${c.accountNo}`.toLowerCase().includes(q));
    const select = document.querySelector('#collectionForm select[name="customerId"]');
    if (match && select) {
      select.value = match.id;
      fillCollectionDefaultAmount(true);
    }
  });

  attachToggleButtons();

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCsv(button.dataset.export));
  });
  document.querySelectorAll("[data-receipt]").forEach((button) => {
    button.addEventListener("click", () => printReceipt(button.dataset.receipt));
  });
  document.querySelectorAll("[data-back-view]").forEach((button) => {
    button.addEventListener("click", () => {
      rt.activeView = button.dataset.backView;
      render();
    });
  });
}

export function attachToggleButtons() {
  document.querySelectorAll("[data-toggle-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      const customer = rt.state.customers.find((c) => c.id === button.dataset.toggleCustomer);
      customer.active = !customer.active;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-edit-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_customer_id", button.dataset.editCustomer);
      render();
    });
  });
  document.querySelectorAll("[data-delete-customer]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomer(button.dataset.deleteCustomer));
  });
  document.querySelectorAll("[data-member-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("detail_customer_id", button.dataset.memberDetail);
      rt.activeView = "memberDetail";
      render();
    });
  });
  document.querySelectorAll("[data-toggle-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = rt.state.groups.find((item) => item.id === button.dataset.toggleGroup);
      group.active = !group.active;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-edit-group]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_group_id", button.dataset.editGroup);
      render();
    });
  });
  document.querySelectorAll("[data-delete-group]").forEach((button) => {
    button.addEventListener("click", () => deleteGroup(button.dataset.deleteGroup));
  });
  document.querySelectorAll("[data-group-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("detail_group_id", button.dataset.groupDetail);
      rt.activeView = "groupDetail";
      render();
    });
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = rt.state.users.find((u) => u.id === button.dataset.toggleUser);
      user.active = !user.active;
      if (user.active) {
        user.pending = false;
        ensureGroupForAdmin(user);
      }
      user.updatedAt = new Date().toISOString();
      saveState();
      logAudit(user.active ? "Admin activated" : "Admin disabled", user.username);
      pushCloudBackup(false);
      render();
    });
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_user_id", button.dataset.editUser);
      render();
    });
  });
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser));
  });
  document.querySelectorAll("[data-edit-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_collection_id", button.dataset.editCollection);
      render();
    });
  });
  document.querySelectorAll("[data-delete-collection]").forEach((button) => {
    button.addEventListener("click", () => deleteCollection(button.dataset.deleteCollection));
  });
  document.querySelectorAll("[data-edit-loan]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_loan_id", button.dataset.editLoan);
      render();
    });
  });
  document.querySelectorAll("[data-delete-loan]").forEach((button) => {
    button.addEventListener("click", () => deleteLoan(button.dataset.deleteLoan));
  });
  document.querySelectorAll("[data-edit-repayment]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_repayment_id", button.dataset.editRepayment);
      render();
    });
  });
  document.querySelectorAll("[data-delete-repayment]").forEach((button) => {
    button.addEventListener("click", () => deleteRepayment(button.dataset.deleteRepayment));
  });
  document.querySelectorAll("[data-send-collection-sms]").forEach((button) => {
    button.addEventListener("click", () => sendCollectionSms(button.dataset.sendCollectionSms));
  });
  document.querySelectorAll("[data-send-loan-sms]").forEach((button) => {
    button.addEventListener("click", () => sendLoanSms(button.dataset.sendLoanSms));
  });
  document.querySelectorAll("[data-send-message]").forEach((button) => {
    button.addEventListener("click", () => sendMessageSms(button.dataset.sendMessage));
  });
  document.querySelectorAll("[data-pay-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const [loanId, index] = button.dataset.payInterest.split("|");
      payInterest(loanId, Number(index));
    });
  });
  document.querySelectorAll("[data-undo-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const [loanId, index] = button.dataset.undoInterest.split("|");
      undoInterestPayment(loanId, Number(index));
    });
  });
  document.querySelectorAll("[data-print-statement]").forEach((button) => {
    button.addEventListener("click", () => printMemberStatement(button.dataset.printStatement));
  });
  document.querySelectorAll("[data-print-closing]").forEach((button) => {
    button.addEventListener("click", () => printClosingById(button.dataset.printClosing));
  });
}

export async function handleAdminRequest(event) {
  event.preventDefault();
  const data = formData(event.target);
  const notice = document.querySelector("#requestNotice");
  if (rt.state.users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) {
    notice.innerHTML = `<div class="notice">That username already exists.</div>`;
    return;
  }
  rt.state.deletedUsers = (rt.state.deletedUsers || []).filter((item) => String(item.username || "").toLowerCase() !== data.username.toLowerCase());
  rt.state.users.push({
    id: uid("user"),
    name: data.name,
    username: data.username,
    passwordHash: await hashPasswordForUser(data.password),
    role: "Admin",
    active: false,
    pending: true,
    requestedGroupName: data.groupName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveState();
  pushCloudBackup(false);
  notice.innerHTML = `<div class="notice">Request sent. The owner must activate this admin before login.</div>`;
  event.target.reset();
}

export function fillCollectionDefaultAmount(force = false) {
  const form = document.querySelector("#collectionForm");
  if (!form) return;
  const select = form.querySelector('select[name="customerId"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const sittingInput = form.querySelector('input[name="sittingsPaid"]');
  const customer = rt.state.customers.find((item) => item.id === select?.value);
  if (!customer || !amountInput) return;
  const amount = perSittingAmount(customer);
  if (force || !amountInput.value) amountInput.value = amount;
  if (sittingInput && (force || !sittingInput.value)) {
    sittingInput.value = calculateSittingsPaid(customer, amountInput.value) || 1;
  }
}

export function cancelPendingMessages(markMigration = false) {
  const user = currentUser();
  const groupIds = user ? visibleGroupIds() : [];
  let count = 0;
  rt.state.messages.forEach((message) => {
    const customer = rt.state.customers.find((item) => item.id === message.customerId);
    const canSee = markMigration || !user || isKBA() || groupIds.includes(customer?.groupId);
    if (!canSee || !isUnsentMessage(message)) return;
    message.status = "Cancelled";
    message.cancelledAt = new Date().toISOString();
    message.cancelledBy = currentUser()?.id || "system";
    count += 1;
  });
  if (markMigration) localStorage.setItem(CANCEL_PENDING_MESSAGES_KEY, "true");
  return count;
}

export function cancelPendingMessagesOnce() {
  if (localStorage.getItem(CANCEL_PENDING_MESSAGES_KEY) === "true") return 0;
  return cancelPendingMessages(true);
}

export function sendSelectedMessages() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  sendMessageSms(ids[0]);
}

export function markSelectedMessagesSent() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  rt.state.messages.forEach((message) => {
    if (ids.includes(message.id) && message.status !== "Cancelled") {
      message.status = "Sent";
      message.sentAt = new Date().toISOString();
      message.sentManually = true;
    }
  });
  saveState();
  toast(`${ids.length} message(s) marked sent`);
  render();
}

export function cancelSelectedMessages() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  rt.state.messages.forEach((message) => {
    if (ids.includes(message.id) && message.status !== "Sent") {
      message.status = "Cancelled";
      message.cancelledAt = new Date().toISOString();
      message.cancelledBy = currentUser()?.id || "system";
    }
  });
  saveState();
  toast(`${ids.length} message(s) cancelled`);
  render();
}

export function ensureGroupForAdmin(user) {
  if (!user || user.role !== "Admin") return null;
  const requestedName = String(user.requestedGroupName || "").trim();
  let group = rt.state.groups.find((item) => item.adminId === user.id);
  if (!group && requestedName) {
    group = rt.state.groups.find((item) => item.name.toLowerCase() === requestedName.toLowerCase());
  }
  if (group) {
    group.adminId = user.id;
    group.active = true;
    group.updatedAt = new Date().toISOString();
    return group;
  }
  if (!requestedName) return null;
  group = {
    id: uid("grp"),
    name: requestedName,
    adminId: user.id,
    moneyKeeper: "",
    moneyCounter: "",
    intervalDays: 1,
    targetContributions: 31,
    defaultAmount: 0,
    interest: rt.state.settings.loanInterest,
    note: "Created automatically from admin account request",
    active: true,
    createdBy: currentUser()?.id || user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  rt.state.groups.push(group);
  return group;
}

export function tombstoneRecord(collection, recordOrId) {
  const recordId = typeof recordOrId === "string" ? recordOrId : recordOrId?.id;
  if (!recordId) return;
  rt.state.deletedRecords = rt.state.deletedRecords || [];
  if (rt.state.deletedRecords.some((item) => item.collection === collection && item.recordId === recordId)) return;
  const timestamp = new Date().toISOString();
  rt.state.deletedRecords.push({
    id: uid("deleted-record"),
    collection,
    recordId,
    deletedBy: currentUser()?.id || "",
    deletedAt: timestamp,
    createdAt: timestamp
  });
}

export function tombstoneRecords(collection, rows) {
  rows.forEach((row) => tombstoneRecord(collection, row));
}

export function deleteGroup(groupId) {
  const group = rt.state.groups.find((item) => item.id === groupId);
  if (!group || !isKBA()) return;
  const hasMembers = rt.state.customers.some((customer) => customer.groupId === groupId);
  const hasLoans = rt.state.loans.some((loan) => loan.groupId === groupId);
  const hasCollections = rt.state.collections.some((item) => item.groupId === groupId);
  if (hasMembers || hasLoans || hasCollections) {
    toast("Location has records. Close it instead of deleting.");
    return;
  }
  if (!confirm(`Delete group "${group.name}"?`)) return;
  tombstoneRecord("groups", group);
  rt.state.groups = rt.state.groups.filter((item) => item.id !== groupId);
  sessionStorage.removeItem("edit_group_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Susu group deleted", group.name);
  render();
}

export function deleteUser(userId) {
  const user = rt.state.users.find((item) => item.id === userId);
  if (!user || user.role === "KBA" || !isKBA()) return;
  const ownsGroup = rt.state.groups.some((group) => group.adminId === userId);
  const hasTransactions = rt.state.transactions.some((tx) => tx.userId === userId);
  if (ownsGroup || hasTransactions) {
    toast("Admin has group or money records. Disable instead of deleting.");
    return;
  }
  if (!confirm(`Delete admin "${user.name}"?`)) return;
  rt.state.deletedUsers = rt.state.deletedUsers || [];
  rt.state.deletedUsers.push({
    id: uid("deleted-user"),
    userId: user.id,
    username: user.username,
    name: user.name,
    deletedBy: currentUser()?.id || "",
    deletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  rt.state.users = rt.state.users.filter((item) => item.id !== userId);
  sessionStorage.removeItem("edit_user_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Admin deleted", user.username);
  render();
}

export function deleteCustomer(customerId) {
  const customer = rt.state.customers.find((item) => item.id === customerId);
  if (!customer || !isAdmin() || !visibleGroupIds().includes(customer.groupId)) return;
  if (!confirm(`Delete member "${customer.name}" and all linked records?`)) return;
  const linkedCollections = rt.state.collections.filter((item) => item.customerId === customerId);
  const linkedLoans = rt.state.loans.filter((item) => item.customerId === customerId);
  const linkedTransactions = rt.state.transactions.filter((item) => item.customerId === customerId);
  const linkedMessages = rt.state.messages.filter((item) => item.customerId === customerId);
  tombstoneRecord("customers", customer);
  tombstoneRecords("collections", linkedCollections);
  tombstoneRecords("loans", linkedLoans);
  tombstoneRecords("transactions", linkedTransactions);
  tombstoneRecords("messages", linkedMessages);
  rt.state.customers = rt.state.customers.filter((item) => item.id !== customerId);
  rt.state.collections = rt.state.collections.filter((item) => item.customerId !== customerId);
  rt.state.loans = rt.state.loans.filter((item) => item.customerId !== customerId);
  rt.state.transactions = rt.state.transactions.filter((item) => item.customerId !== customerId);
  rt.state.messages = rt.state.messages.filter((item) => item.customerId !== customerId);
  sessionStorage.removeItem("edit_customer_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Member deleted", customer.name);
  render();
}

export function deleteCollection(collectionId) {
  const collection = rt.state.collections.find((item) => item.id === collectionId);
  if (!collection || !isAdmin() || !visibleGroupIds().includes(collection.groupId)) return;
  if (!confirm(`Delete collection for ${customerName(collection.customerId)} on ${collection.date}?`)) return;
  const linkedTransactions = rt.state.transactions.filter((item) => item.ref === collectionId);
  const linkedMessages = rt.state.messages.filter((item) => item.ref === collectionId);
  tombstoneRecord("collections", collection);
  tombstoneRecords("transactions", linkedTransactions);
  tombstoneRecords("messages", linkedMessages);
  rt.state.collections = rt.state.collections.filter((item) => item.id !== collectionId);
  rt.state.transactions = rt.state.transactions.filter((item) => item.ref !== collectionId);
  rt.state.messages = rt.state.messages.filter((item) => item.ref !== collectionId);
  sessionStorage.removeItem("edit_collection_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Collection deleted", `${customerName(collection.customerId)} · ${money(collection.amount)}`);
  render();
}

export function deleteLoan(loanId) {
  const loan = rt.state.loans.find((item) => item.id === loanId);
  if (!loan || !isAdmin() || !visibleGroupIds().includes(loan.groupId)) return;
  if (!confirm(`Delete loan for ${customerName(loan.customerId)} dated ${loan.date}?`)) return;
  const linkedTransactions = rt.state.transactions.filter((item) => item.ref === loanId);
  const linkedMessages = rt.state.messages.filter((item) => item.ref === loanId);
  tombstoneRecord("loans", loan);
  tombstoneRecords("transactions", linkedTransactions);
  tombstoneRecords("messages", linkedMessages);
  rt.state.loans = rt.state.loans.filter((item) => item.id !== loanId);
  rt.state.transactions = rt.state.transactions.filter((item) => item.ref !== loanId);
  rt.state.messages = rt.state.messages.filter((item) => item.ref !== loanId);
  sessionStorage.removeItem("edit_loan_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Loan deleted", `${customerName(loan.customerId)} · ${money(loan.principal)}`);
  render();
}

export function deleteRepayment(transactionId) {
  const tx = rt.state.transactions.find((item) => item.id === transactionId && item.type === "Loan Repayment");
  const loan = rt.state.loans.find((item) => item.id === tx?.ref);
  if (!tx || !loan || !isAdmin() || !visibleGroupIds().includes(loan.groupId)) return;
  if (!confirm(`Delete repayment for ${customerName(tx.customerId)} on ${tx.date}?`)) return;
  loan.amountPaid = Math.max(0, Number(loan.amountPaid || 0) - Number(tx.amount || 0));
  if (loan.amountPaid < loan.totalDue) loan.status = "Active";
  loan.updatedAt = new Date().toISOString();
  tombstoneRecord("transactions", tx);
  rt.state.transactions = rt.state.transactions.filter((item) => item.id !== transactionId);
  sessionStorage.removeItem("edit_repayment_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Loan repayment deleted", `${customerName(tx.customerId)} - ${money(tx.amount)}`);
  render();
}

export function handleGroup(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (isAdmin()) {
    if (!data.id) {
      if (currentUser().role !== "Admin") {
        toast("Only the assigned Admin can create a location");
        return;
      }
      if (primaryGroup()) {
        toast("This admin already has a location");
        return;
      }
      const group = {
        id: uid("grp"),
        name: data.name,
        adminId: currentUser().id,
        moneyKeeper: data.moneyKeeper,
        moneyCounter: data.moneyCounter,
        intervalDays: Number(data.intervalDays),
        targetContributions: Number(data.targetContributions),
        defaultAmount: Number(data.defaultAmount),
        interest: Number(data.interest),
        note: data.note,
        active: true,
        createdBy: currentUser().id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      rt.state.groups.push(group);
      saveState();
      logAudit("Admin susu location created", group.name);
      pushCloudBackup(false);
      toast("Location created");
      render();
      return;
    }
    const group = rt.state.groups.find((item) => item.id === data.id && userLinkedToGroup(currentUser(), item));
    if (!group || currentUser().role !== "Admin") {
      toast("This location is not assigned to you");
      return;
    }
    Object.assign(group, {
      moneyKeeper: data.moneyKeeper,
      moneyCounter: data.moneyCounter,
      intervalDays: Number(data.intervalDays),
      targetContributions: Number(data.targetContributions),
      defaultAmount: Number(data.defaultAmount),
      interest: Number(data.interest),
      note: data.note,
      updatedAt: new Date().toISOString()
    });
  saveState();
  logAudit("Location setup saved", group.name);
  toast("Location setup saved");
    render();
    return;
  }
  if (!isKBA()) {
    toast("Only the owner can create groups");
    return;
  }
  if (data.id) {
    const group = rt.state.groups.find((item) => item.id === data.id);
    if (!group) return;
    Object.assign(group, {
      name: data.name,
      adminId: data.adminId,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
    sessionStorage.removeItem("edit_group_id");
    saveState();
    logAudit("Susu group edited", data.name);
    toast("Location saved");
    render();
    return;
  }
  rt.state.groups.push({
    id: uid("grp"),
    name: data.name,
    adminId: data.adminId,
    moneyKeeper: "",
    moneyCounter: "",
    intervalDays: 1,
    targetContributions: 31,
    defaultAmount: 0,
    interest: rt.state.settings.loanInterest,
    note: data.note,
    active: true,
    createdBy: currentUser().id,
    createdAt: new Date().toISOString()
  });
  saveState();
  logAudit("Susu group created", data.name);
  toast("Susu group created");
  render();
}

export function handleCustomer(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (!isAdmin()) {
    toast("Only assigned admins can register members");
    return;
  }
  const group = groupById(data.groupId);
  if (!visibleGroupIds().includes(data.groupId)) {
    toast("This location is not assigned to you");
    return;
  }
  if (data.id) {
    const customer = rt.state.customers.find((item) => item.id === data.id && visibleGroupIds().includes(item.groupId));
    if (!customer) return;
    Object.assign(customer, {
      name: data.name,
      phone: data.phone,
      nhis: Number(data.nhis || 0),
      address: data.address,
      groupId: data.groupId,
      dailyAmount: Number(data.dailyAmount || group?.defaultAmount || 0),
      updatedAt: new Date().toISOString()
    });
    sessionStorage.removeItem("edit_customer_id");
    saveState();
    logAudit("Member edited", data.name);
    toast("Member saved");
    render();
    return;
  }
  rt.state.customers.push({
    id: uid("cust"),
    accountNo: `ST-${String(rt.state.customers.length + 1).padStart(4, "0")}`,
    name: data.name,
    phone: data.phone,
    nhis: Number(data.nhis || 0),
    address: data.address,
    groupId: data.groupId,
    dailyAmount: Number(data.dailyAmount || group?.defaultAmount || 0),
    collectorId: currentUser().id,
    active: true,
    createdAt: new Date().toISOString()
  });
  saveState();
  logAudit("Member registered", `${data.name} · ${groupName(data.groupId)}`);
  toast("Customer saved");
  render();
}

export function handleCollection(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (!isAdmin()) {
    toast("Only assigned admins can record collections");
    return;
  }
  const amount = Number(data.amount);
  const customer = rt.state.customers.find((item) => item.id === data.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) {
    toast("This member is not in your assigned location");
    return;
  }
  const sittingsPaid = Number(data.sittingsPaid || calculateSittingsPaid(customer, amount));
  const contributionNo = nextContributionNo(data.customerId);
  if (!data.id && rt.state.collections.some((item) => item.customerId === data.customerId && item.date === data.date && Number(item.amount || 0) > 0)) {
    if (!confirm(`${customer.name} already has a contribution on ${data.date}. Save another one?`)) return;
  }
  if (data.id) {
    const collection = rt.state.collections.find((item) => item.id === data.id && visibleGroupIds().includes(item.groupId));
    if (!collection) return;
    const before = { amount: collection.amount, date: collection.date, status: collection.status, customerId: collection.customerId };
    Object.assign(collection, {
      customerId: data.customerId,
      groupId: customer.groupId,
      contributionNo,
      sittingsPaid,
      amount,
      date: data.date,
      status: data.status,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
    const tx = rt.state.transactions.find((item) => item.ref === collection.id && item.type === "Susu Deposit");
    if (tx) {
      tx.customerId = data.customerId;
      tx.amount = amount;
      tx.date = data.date;
    }
    sessionStorage.removeItem("edit_collection_id");
    saveState();
    logAudit("Collection edited", `${customer.name} - ${JSON.stringify(before)} to amount ${money(amount)} on ${data.date}`);
    toast("Collection saved");
    render();
    return;
  }
  const collection = {
    id: uid("col"),
    customerId: data.customerId,
    groupId: customer?.groupId || "",
    contributionNo,
    sittingsPaid,
    amount,
    date: data.date,
    status: data.status,
    note: data.note,
    userId: currentUser().id
  };
  rt.state.collections.push(collection);
  if (amount > 0) {
    addTransaction("Susu Deposit", data.customerId, amount, collection.id, data.date);
    createPaymentMessage(data.customerId, amount, data.date, collection.id);
  }
  saveState();
  logAudit("Collection recorded", `${customer.name} · ${money(amount)}`);
  toast("Collection recorded. Message is ready in Messages.");
  render();
}

export function handleWithdrawal(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (!isAdmin()) {
    toast("Only assigned admins can record withdrawals");
    return;
  }
  const customer = rt.state.customers.find((item) => item.id === data.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) {
    toast("This member is not in your assigned location");
    return;
  }
  const amount = Number(data.amount);
  if (amount > customerBalance(data.customerId)) {
    toast("Withdrawal is more than savings balance");
    return;
  }
  addTransaction("Withdrawal", data.customerId, amount, uid("wd"), today());
  saveState();
  logAudit("Withdrawal recorded", `${customer.name} · ${money(amount)}`);
  toast("Withdrawal recorded");
  render();
}

export function handleLoan(event) {
  event.preventDefault();
  if (!isAdmin()) {
    toast("Only assigned admins can approve loans");
    return;
  }
  const data = formData(event.target);
  const principal = Number(data.principal);
  const customer = rt.state.customers.find((item) => item.id === data.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) {
    toast("This member is not in your assigned location");
    return;
  }
  if (!isValidPhone(customer.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    rt.activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer.id);
    render();
    return;
  }
  const group = groupById(customer?.groupId);
  const interest = Number(group?.interest ?? data.interest ?? rt.state.settings.loanInterest);
  const interestMonths = Number(data.interestMonths || 1);
  const loanDate = data.date || today();
  const interestSchedule = buildInterestSchedule(loanDate, principal, interest, interestMonths);
  const totalDue = principal + ((principal * interest) / 100) * interestMonths;
  if (data.id) {
    const loan = rt.state.loans.find((item) => item.id === data.id && visibleGroupIds().includes(item.groupId));
    if (!loan) return;
    const before = { principal: loan.principal, interest: loan.interest, interestMonths: loan.interestMonths, totalDue: loan.totalDue };
    Object.assign(loan, {
      customerId: data.customerId,
      groupId: customer?.groupId || "",
      principal,
      interest,
      termDays: interestMonths * 30,
      interestMonths,
      interestSchedule,
      purpose: data.purpose,
      totalDue,
      date: loanDate,
      status: loan.amountPaid >= totalDue ? "Completed" : "Active",
      updatedAt: new Date().toISOString()
    });
    const tx = rt.state.transactions.find((item) => item.ref === loan.id && item.type === "Loan Disbursement");
    if (tx) {
      tx.customerId = data.customerId;
      tx.amount = principal;
      tx.date = loanDate;
    }
    sessionStorage.removeItem("edit_loan_id");
    saveState();
    logAudit("Loan edited", `${customer.name} - ${JSON.stringify(before)} to principal ${money(principal)}, interest ${interest}%`);
    toast("Loan saved");
    render();
    return;
  }
  const loan = {
    id: uid("loan"),
    customerId: data.customerId,
    groupId: customer?.groupId || "",
    principal,
    interest,
    termDays: interestMonths * 30,
    interestMonths,
    interestSchedule,
    purpose: data.purpose,
    totalDue,
    amountPaid: 0,
    status: "Active",
    date: loanDate,
    approvedBy: currentUser().id
  };
  rt.state.loans.push(loan);
  addTransaction("Loan Disbursement", data.customerId, principal, loan.id, loan.date);
  createLoanMessage(loan);
  saveState();
  logAudit("Loan approved", `${customer.name} · ${money(principal)} · ${interest}% for ${interestMonths} month(s)`);
  toast("Loan approved. Message is ready in Messages.");
  render();
}

export function handleRepayment(event) {
  event.preventDefault();
  const data = formData(event.target);
  const loan = rt.state.loans.find((item) => item.id === data.loanId);
  if (!isAdmin() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const amount = Number(data.amount);
  if (data.id) {
    const tx = rt.state.transactions.find((item) => item.id === data.id && item.type === "Loan Repayment");
    const oldLoan = rt.state.loans.find((item) => item.id === tx?.ref);
    if (!tx || !oldLoan || !visibleGroupIds().includes(oldLoan.groupId)) return;
    oldLoan.amountPaid = Math.max(0, Number(oldLoan.amountPaid || 0) - Number(tx.amount || 0));
    loan.amountPaid = Number(loan.amountPaid || 0) + amount;
    oldLoan.status = oldLoan.amountPaid >= oldLoan.totalDue ? "Completed" : "Active";
    loan.status = loan.amountPaid >= loan.totalDue ? "Completed" : "Active";
    Object.assign(tx, {
      customerId: loan.customerId,
      amount,
      ref: loan.id,
      date: data.date,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
    sessionStorage.removeItem("edit_repayment_id");
    saveState();
    logAudit("Loan repayment edited", `${customerName(loan.customerId)} - ${money(amount)}`);
    toast("Repayment saved");
    render();
    return;
  }
  loan.amountPaid += amount;
  if (loan.amountPaid >= loan.totalDue) loan.status = "Completed";
  addTransaction("Loan Repayment", loan.customerId, amount, loan.id, data.date);
  saveState();
  logAudit("Loan repayment recorded", `${customerName(loan.customerId)} · ${money(amount)}`);
  toast("Repayment recorded");
  render();
}

export function payInterest(loanId, scheduleIndex) {
  const loan = rt.state.loans.find((item) => item.id === loanId);
  if (!isAdmin() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const schedule = ensureLoanInterestSchedule(loan);
  const entry = schedule[scheduleIndex];
  if (!entry) {
    toast("Interest schedule not found");
    return;
  }
  if (entry.status === "Paid") {
    toast("This interest has already been paid");
    return;
  }
  const amount = Number(entry.amount || 0);
  entry.status = "Paid";
  entry.paidAt = today();
  entry.paidBy = currentUser().id;
  loan.amountPaid = Number(loan.amountPaid || 0) + amount;
  if (loan.amountPaid >= loan.totalDue) loan.status = "Completed";
  addTransaction("Interest Payment", loan.customerId, amount, loan.id, entry.paidAt);
  saveState();
  logAudit("Interest payment recorded", `${customerName(loan.customerId)} - ${money(amount)} - month ${entry.month || scheduleIndex + 1}`);
  toast("Interest payment recorded");
  render();
}

export function undoInterestPayment(loanId, scheduleIndex) {
  const loan = rt.state.loans.find((item) => item.id === loanId);
  if (!isAdmin() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const entry = ensureLoanInterestSchedule(loan)[scheduleIndex];
  if (!entry || entry.status !== "Paid") return;
  if (!confirm(`Undo interest payment for ${customerName(loan.customerId)} month ${entry.month || scheduleIndex + 1}?`)) return;
  const amount = Number(entry.amount || 0);
  const txIndex = rt.state.transactions.findIndex((tx) => tx.type === "Interest Payment" && tx.ref === loan.id && tx.customerId === loan.customerId && Number(tx.amount || 0) === amount && tx.date === entry.paidAt);
  if (txIndex >= 0) rt.state.transactions.splice(txIndex, 1);
  entry.status = "Pending";
  delete entry.paidAt;
  delete entry.paidBy;
  loan.amountPaid = Math.max(0, Number(loan.amountPaid || 0) - amount);
  if (loan.amountPaid < loan.totalDue) loan.status = "Active";
  saveState();
  logAudit("Interest payment undone", `${customerName(loan.customerId)} - ${money(amount)} - month ${entry.month || scheduleIndex + 1}`);
  toast("Interest payment undone");
  render();
}

export async function handleImport(event) {
  event.preventDefault();
  const data = formData(event.target);
  const file = event.target.elements.file.files[0];
  const groupId = data.groupId;
  if (!file || !visibleGroupIds().includes(groupId)) {
    toast("Choose a file and assigned location");
    return;
  }
  const result = document.querySelector("#importResult");
  result.innerHTML = `<div class="empty">Reading ${escapeHtml(file.name)}...</div>`;
  try {
    const imported = await importFileRecords(file, data.kind, groupId);
    saveState();
    logAudit("Records imported", `${file.name}: ${imported.savings} savings, ${imported.loans} loans, ${imported.logs} logs`);
    result.innerHTML = `
      <div class="section-title"><h2>Import Complete</h2></div>
      <div class="grid three">
        <div class="stat"><small>Savings rows</small><strong>${imported.savings}</strong></div>
        <div class="stat"><small>Loan rows</small><strong>${imported.loans}</strong></div>
        <div class="stat"><small>Log rows</small><strong>${imported.logs}</strong></div>
      </div>
      <div class="notice">${escapeHtml(imported.note)}</div>
    `;
  } catch (error) {
    result.innerHTML = `<div class="notice">Import failed: ${escapeHtml(error.message)}</div>`;
  }
}

export function handleClosing(event) {
  event.preventDefault();
  const data = formData(event.target);
  const groupId = isKBA() ? visibleGroupIds()[0] || "" : primaryGroup()?.id || "";
  const expected = expectedCashForDate(data.date);
  const counted = Number(data.counted || 0);
  let closing = rt.state.closings.find((item) => item.date === data.date && item.groupId === groupId);
  if (closing) {
    Object.assign(closing, {
      expected,
      counted,
      difference: counted - expected,
      closedByName: data.closedByName,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
  } else {
    closing = {
      id: uid("close"),
      date: data.date,
      groupId,
      expected,
      counted,
      difference: counted - expected,
      closedByName: data.closedByName,
      note: data.note,
      userId: currentUser()?.id || "",
      createdAt: new Date().toISOString()
    };
    rt.state.closings.push(closing);
  }
  rt.state.settings.lastBackupAt = new Date().toISOString();
  saveState();
  logAudit("Daily closing saved", `${data.date} - expected ${money(expected)} - counted ${money(counted)}`);
  toast("Daily closing saved");
  render();
}

export function handleSettings(event) {
  event.preventDefault();
  const data = formData(event.target);
  Object.assign(rt.state.settings, {
    businessName: data.businessName,
    currency: data.currency,
    loanInterest: Number(data.loanInterest),
    cloudMode: data.cloudMode || "auto"
  });
  persistCloudSettings(rt.state, {
    cloudUrl: data.cloudUrl,
    cloudKey: data.cloudKey,
    localBackupUrl: data.localBackupUrl,
    syncToken: data.syncToken,
    businessId: data.businessId
  });
  saveState();
  toast("Settings saved");
  render();
}

export async function handleUser(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (data.id) {
    const user = rt.state.users.find((item) => item.id === data.id && item.role !== "KBA");
    if (!user) return;
    if (rt.state.users.some((item) => item.id !== data.id && item.username.toLowerCase() === data.username.toLowerCase())) {
      toast("Username already exists");
      return;
    }
    user.name = data.name;
    user.username = data.username;
    user.role = data.role;
    if (data.password) user.passwordHash = await hashPasswordForUser(data.password);
    if (user.active && user.role === "Admin") ensureGroupForAdmin(user);
    user.updatedAt = new Date().toISOString();
    sessionStorage.removeItem("edit_user_id");
    saveState();
    pushCloudBackup(false);
    logAudit("Admin edited", data.username);
    toast("Admin saved");
    render();
    return;
  }
  if (rt.state.users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) {
    toast("Username already exists");
    return;
  }
  rt.state.deletedUsers = (rt.state.deletedUsers || []).filter((item) => String(item.username || "").toLowerCase() !== data.username.toLowerCase());
  rt.state.users.push({
    id: uid("user"),
    name: data.name,
    username: data.username,
    passwordHash: await hashPasswordForUser(data.password),
    role: data.role,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveState();
  pushCloudBackup(false);
  logAudit("Admin created", data.username);
  toast("User created");
  render();
}

export function addTransaction(type, customerId, amount, ref, date) {
  rt.state.transactions.push({
    id: uid("tx"),
    type,
    customerId,
    amount,
    ref,
    date,
    userId: currentUser().id,
    createdAt: new Date().toISOString()
  });
}

export function createPaymentMessage(customerId, amountPaid, date, ref = "") {
  const customer = rt.state.customers.find((item) => item.id === customerId);
  const totalContributed = customerBalance(customerId);
  const group = groupById(customer?.groupId);
  const body = `Hello ${customer?.name || "member"}, your ${group?.name || "susu"} payment of ${money(amountPaid)} has been received on ${date}. Your total contributed amount is now ${money(totalContributed)}. Thank you.`;
  const message = {
    id: uid("msg"),
    kind: "Payment",
    ref,
    customerId,
    phone: customer?.phone || "",
    amountPaid,
    totalContributed,
    body,
    status: "Ready to send",
    date,
    createdAt: new Date().toISOString()
  };
  rt.state.messages.push(message);
  return message;
}

export function getOrCreateCollectionMessage(collection) {
  let message = rt.state.messages.find((item) => item.ref === collection.id && item.kind === "Payment");
  if (!message) {
    message = createPaymentMessage(collection.customerId, Number(collection.amount || 0), collection.date, collection.id);
    saveState();
  }
  return message;
}

export function createLoanMessage(loan) {
  const customer = rt.state.customers.find((item) => item.id === loan.customerId);
  const firstPayment = loan.interestSchedule?.[0];
  const body = `Hello ${customer?.name || "member"}, your loan of ${money(loan.principal)} has been recorded on ${loan.date}. Monthly interest is ${money(monthlyInterestAmount(loan))} for ${loan.interestMonths || 1} month(s). Total due is ${money(loan.totalDue)}.${firstPayment ? ` First interest date: ${firstPayment.date}.` : ""} Thank you.`;
  const message = {
    id: uid("msg"),
    kind: "Loan",
    ref: loan.id,
    customerId: loan.customerId,
    phone: customer?.phone || "",
    amountPaid: loan.principal,
    totalContributed: loan.totalDue,
    body,
    status: "Ready to send",
    date: loan.date,
    createdAt: new Date().toISOString()
  };
  rt.state.messages.push(message);
  return message;
}

export function messageLink(message) {
  const phone = String(message.phone || "").replace(/[^\d+]/g, "");
  return `sms:${phone}?&body=${encodeURIComponent(message.body)}`;
}

export function isValidPhone(phone) {
  const clean = String(phone || "").replace(/[^\d]/g, "");
  return clean.length >= 10 && clean.length <= 15;
}

export function gatewayPhone(message) {
  return String(message.phone || "").replace(/[^\d+]/g, "");
}

export function sendCollectionSms(collectionId) {
  const collection = rt.state.collections.find((item) => item.id === collectionId);
  if (!collection || !visibleGroupIds().includes(collection.groupId)) return;
  const customer = rt.state.customers.find((item) => item.id === collection.customerId);
  if (!isValidPhone(customer?.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    rt.activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  openMessageSender(getOrCreateCollectionMessage(collection), true);
}

export function sendLoanSms(loanId) {
  const loan = rt.state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) return;
  const customer = rt.state.customers.find((item) => item.id === loan.customerId);
  if (!isValidPhone(customer?.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    rt.activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  let message = rt.state.messages.find((item) => item.ref === loan.id && item.kind === "Loan");
  if (!message) {
    message = createLoanMessage(loan);
    saveState();
  }
  openMessageSender(message, true);
}

export function sendMessageSms(messageId) {
  const message = rt.state.messages.find((item) => item.id === messageId);
  if (!message || !visibleMessages().some((item) => item.id === message.id)) return;
  const customer = rt.state.customers.find((item) => item.id === message.customerId);
  if (!isValidPhone(customer?.phone || message.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    rt.activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  message.phone = customer?.phone || message.phone;
  openMessageSender(message, true);
}

export function openMessageSender(message, force = false) {
  if (!message?.phone) return;
  if (message.status === "Cancelled") {
    toast("This old message was cancelled. New entries will create new messages.");
    return;
  }
  if (window.KbaSmsGateway) {
    sendViaPhoneGateway(message);
    return;
  }
  if (/Electron/i.test(navigator.userAgent)) {
    queueSmsForPhone(message);
    return;
  }
  if (force || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    window.location.href = messageLink(message);
  }
}

export function queueSmsForPhone(message) {
  message.status = "Queued for phone";
  message.queuedAt = new Date().toISOString();
  saveState();
  pushCloudBackup(true);
  showDesktopSmsDialog(message);
  toast("Message queued. Open the APK on the phone to send it.");
}

export function sendViaPhoneGateway(message) {
  if (!window.KbaSmsGateway) return false;
  if (!window.KbaSmsGateway.hasPermission()) {
    message.status = "Waiting for SMS permission";
    saveState();
    window.KbaSmsGateway.requestPermission();
    toast("Allow SMS permission, then tap Send SMS again.");
    return false;
  }
  const result = window.KbaSmsGateway.sendSms(gatewayPhone(message), message.body);
  if (result === "SENT") {
    message.status = "Sent";
    message.sentAt = new Date().toISOString();
    saveState();
    pushCloudBackup(true);
    toast("SMS sent from phone");
    return true;
  }
  message.status = result || "Failed";
  saveState();
  pushCloudBackup(true);
  toast("SMS failed on phone");
  return false;
}

export async function processPhoneGatewayQueue() {
  if (!window.KbaSmsGateway || rt.syncBusy) return;
  try {
    const snapshot = await latestCloudSnapshot();
    if (snapshot?.payload) state = normalizeState(snapshot.payload);
  } catch {
    return;
  }
  const pending = rt.state.messages.filter((message) => ["Queued for phone", "Waiting for SMS permission"].includes(message.status));
  if (!pending.length) return;
  if (!window.KbaSmsGateway.hasPermission()) {
    window.KbaSmsGateway.requestPermission();
    toast(`${pending.length} SMS waiting. Allow SMS permission.`);
    return;
  }
  let sent = 0;
  pending.forEach((message) => {
    if (sendViaPhoneGateway(message)) sent += 1;
  });
  if (sent) {
    toast(`${sent} queued SMS sent`);
    render();
  }
}

export function showDesktopSmsDialog(message) {
  const existing = document.querySelector(".sms-dialog");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "sms-dialog";
  node.innerHTML = `
    <div class="sms-box">
      <div class="section-title">
        <h2>Message Queued</h2>
        <button class="btn ghost" type="button" data-close-sms>Close</button>
      </div>
      <div class="notice good">This computer has queued the SMS for the phone gateway. Open the APK on the phone with internet, allow SMS permission, and it will send through the phone SIM.</div>
      <div class="field"><label>Phone</label><input value="${escapeAttr(message.phone)}" readonly /></div>
      <div class="field"><label>Message</label><textarea readonly>${escapeHtml(message.body)}</textarea></div>
      <div class="row-actions" style="margin-top:14px">
        <button class="btn" type="button" data-copy-sms>Copy message</button>
      </div>
    </div>
  `;
  document.body.appendChild(node);
  node.querySelector("[data-close-sms]").addEventListener("click", () => node.remove());
  node.querySelector("[data-copy-sms]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      toast("Message copied");
    } catch {
      toast("Copy failed. Select and copy the message manually.");
    }
  });
}

export function monthlyInterestAmount(loan) {
  return (Number(loan.principal || 0) * Number(loan.interest || 0)) / 100;
}

export function ensureLoanInterestSchedule(loan) {
  if (!loan.interestSchedule?.length) {
    loan.interestSchedule = buildInterestSchedule(loan.date, loan.principal, loan.interest, loan.interestMonths || 1);
  }
  return loan.interestSchedule;
}

export function interestPaymentRows() {
  return visibleLoans().flatMap((loan) => ensureLoanInterestSchedule(loan).map((entry, index) => ({ loan, entry, index })));
}

export function interestPaymentStatus(entry) {
  if (entry.status === "Paid") return "Paid";
  return String(entry.date || "") < today() ? "Overdue" : "Pending";
}

export function buildInterestSchedule(startDate, principal, interest, months) {
  const count = Math.max(1, Number(months || 1));
  const monthlyAmount = (Number(principal || 0) * Number(interest || 0)) / 100;
  return Array.from({ length: count }, (_, index) => ({
    month: index + 1,
    date: addMonths(startDate || today(), index + 1),
    amount: monthlyAmount,
    status: "Pending"
  }));
}

export function addMonths(dateText, months) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return today();
  const day = date.getDate();
  date.setMonth(date.getMonth() + Number(months || 0));
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

export function logAudit(action, details = "") {
  rt.state.audit.push({
    id: uid("audit"),
    action,
    details,
    userId: currentUser()?.id || "",
    groupIds: visibleGroupIds(),
    date: new Date().toLocaleString(),
    createdAt: new Date().toISOString()
  });
  saveState();
}

export function visibleAudit() {
  if (isKBA()) return rt.state.audit;
  const groups = visibleGroupIds();
  return rt.state.audit.filter((row) => (row.groupIds || []).some((id) => groups.includes(id)));
}

export function loanBalanceForCustomer(customerId) {
  return rt.state.loans
    .filter((loan) => loan.customerId === customerId && loan.status === "Active")
    .reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0);
}

export function perSittingAmount(customer) {
  return Number(customer?.dailyAmount || 0) + Number(customer?.nhis || 0);
}

export function distributionRows() {
  return visibleCustomers().map((customer) => {
    const group = groupById(customer.groupId);
    const contributed = customerBalance(customer.id);
    const loanBalance = loanBalanceForCustomer(customer.id);
    const settingsPaid = rt.state.collections
      .filter((item) => item.customerId === customer.id && Number(item.amount) > 0)
      .reduce((sum, item) => sum + Number(item.sittingsPaid || item.contributionNo || 0), 0);
    return {
      group: groupName(customer.groupId),
      member: customer.name,
      contributed,
      loanBalance,
      finalPayout: Math.max(0, contributed - loanBalance),
      settingsPaid,
      settingsTarget: group?.targetContributions || rt.state.settings.collectionDays
    };
  });
}

export function dailyMoneyLogRows(from = "0000-01-01", to = "9999-12-31") {
  const moneyTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  const days = new Map();
  visibleTransactions().filter((tx) => moneyTypes.includes(tx.type) && tx.date >= from && tx.date <= to).forEach((tx) => {
    const row = days.get(tx.date) || { date: tx.date, contributions: 0, loanRepaid: 0, interestPaid: 0, totalReceived: 0 };
    const amount = Number(tx.amount || 0);
    if (tx.type === "Susu Deposit") row.contributions += amount;
    if (tx.type === "Loan Repayment") row.loanRepaid += amount;
    if (tx.type === "Interest Payment") row.interestPaid += amount;
    row.totalReceived += amount;
    days.set(tx.date, row);
  });
  return Array.from(days.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function dailyInputLogRows(date = sessionStorage.getItem("log_date") || today()) {
  const moneyTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  return visibleTransactions()
    .filter((tx) => moneyTypes.includes(tx.type) && tx.date === date)
    .map((tx) => {
      const customer = rt.state.customers.find((item) => item.id === tx.customerId);
      const created = tx.createdAt ? new Date(tx.createdAt) : null;
      return {
        date: tx.date,
        time: created && !Number.isNaN(created.getTime()) ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        group: groupName(customer?.groupId),
        member: customerName(tx.customerId),
        type: tx.type === "Susu Deposit" ? "Contribution" : tx.type,
        amount: Number(tx.amount || 0),
        officer: userName(tx.userId),
        ref: tx.ref || tx.id,
        createdAt: tx.createdAt || ""
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function memberFinancialReportRows() {
  return visibleCustomers().map((customer) => {
    const loans = rt.state.loans.filter((loan) => loan.customerId === customer.id);
    const totalContribution = customerBalance(customer.id);
    const totalLoan = loans.reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
    const loanRepaid = rt.state.transactions
      .filter((tx) => tx.customerId === customer.id && tx.type === "Loan Repayment")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const interestPaid = rt.state.transactions
      .filter((tx) => tx.customerId === customer.id && tx.type === "Interest Payment")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const interestRemaining = loans.reduce((sum, loan) => {
      return sum + ensureLoanInterestSchedule(loan)
        .filter((entry) => entry.status !== "Paid")
        .reduce((entrySum, entry) => entrySum + Number(entry.amount || 0), 0);
    }, 0);
    return {
      group: groupName(customer.groupId),
      member: customer.name,
      totalContribution,
      totalLoan,
      loanRepaid,
      interestPaid,
      interestRemaining,
      amountToReceive: totalContribution + loanRepaid - interestRemaining - totalLoan
    };
  });
}

export function arrearsRows() {
  return visibleCustomers()
    .map((customer) => {
      const summary = memberSittingSummary(customer.id);
      return {
        group: groupName(customer.groupId),
        member: customer.name,
        phone: customer.phone,
        paid: summary.paid,
        target: summary.target,
        remaining: summary.remaining,
        amountRemaining: summary.remainingAmount
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

export function renderArrearsTable(rows = arrearsRows()) {
  if (!rows.length) return `<div class="empty">No members are behind their sitting target.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Phone</th><th>Sitting Paid</th><th>Remaining Sitting</th><th>Amount Remaining</th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <td>${escapeHtml(row.group)}</td>
            <td>${escapeHtml(row.member)}</td>
            <td>${escapeHtml(row.phone || "")}</td>
            <td>${row.paid} / ${row.target}</td>
            <td>${row.remaining}</td>
            <td>${money(row.amountRemaining)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function reportDateRange() {
  return {
    from: sessionStorage.getItem("report_from") || today(),
    to: sessionStorage.getItem("report_to") || today()
  };
}

export function setReportRange(from, to) {
  sessionStorage.setItem("report_from", from || today());
  sessionStorage.setItem("report_to", to || from || today());
  render();
}

export function setQuickReportRange(kind) {
  const now = new Date(`${today()}T00:00:00`);
  if (kind === "yesterday") {
    now.setDate(now.getDate() - 1);
    const value = now.toISOString().slice(0, 10);
    setReportRange(value, value);
    return;
  }
  if (kind === "week") {
    const end = today();
    const start = new Date(`${today()}T00:00:00`);
    start.setDate(start.getDate() - 6);
    setReportRange(start.toISOString().slice(0, 10), end);
    return;
  }
  if (kind === "month") {
    const end = today();
    const start = `${today().slice(0, 8)}01`;
    setReportRange(start, end);
    return;
  }
  setReportRange(today(), today());
}

