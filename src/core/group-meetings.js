/**
 * Group meeting attendance, contributions, loan repayments, fines, and welfare.
 */
import { toPesewas, fromPesewas, sumPesewas } from "./money.js";

export function createGroupMeeting(state, data, uid) {
  if (!data.susuGroupId) return { error: "Group is required" };
  const existing = (state.groupMeetings || []).find((item) =>
    item.susuGroupId === data.susuGroupId && item.date === data.date
  );
  if (existing) return { meeting: existing, existing: true };
  const meeting = {
    id: uid("mtg"),
    susuGroupId: data.susuGroupId,
    branchId: data.branchId || "",
    date: data.date,
    recordedBy: data.recordedBy || "",
    attendance: [],
    contributions: [],
    loanRepayments: [],
    fines: [],
    welfare: [],
    notes: String(data.notes || "").trim(),
    agenda: String(data.agenda || "").trim(),
    decisions: String(data.decisions || "").trim(),
    resolutions: String(data.resolutions || "").trim(),
    actionItems: String(data.actionItems || "").trim(),
    status: data.status || "Open",
    step: data.step || "attendance",
    meetingNo: Number(data.meetingNo || 0),
    createdAt: new Date().toISOString()
  };
  state.groupMeetings = state.groupMeetings || [];
  state.groupMeetings.push(meeting);
  return { meeting };
}

export function recordAttendance(meeting, customerId, present = true, note = "", status = "") {
  meeting.attendance = meeting.attendance || [];
  const resolved = status || (present ? "Present" : "Absent");
  const isPresent = ["Present", "Late", "Guest"].includes(resolved);
  const existing = meeting.attendance.find((item) => item.customerId === customerId);
  if (existing) {
    existing.present = isPresent;
    existing.status = resolved;
    existing.note = note;
    return existing;
  }
  const row = { customerId, present: isPresent, status: resolved, note };
  meeting.attendance.push(row);
  return row;
}

export function recordMeetingLine(meeting, bucket, data) {
  if (!["contributions", "loanRepayments", "fines", "welfare"].includes(bucket)) {
    return { error: "Unknown meeting collection type" };
  }
  const amount = Number(data.amount || 0);
  if (!data.customerId) return { error: "Member is required" };
  if (amount < 0) return { error: "Amount cannot be negative" };
  const line = {
    customerId: data.customerId,
    amount,
    amountPesewas: toPesewas(amount),
    receiptNo: data.receiptNo || "",
    method: data.method || "Cash",
    reason: data.reason || "",
    recordedAt: new Date().toISOString()
  };
  meeting[bucket] = meeting[bucket] || [];
  meeting[bucket].push(line);
  return { line };
}

export function meetingTotals(meeting) {
  const sumBucket = (bucket) => fromPesewas(sumPesewas((meeting[bucket] || []).map((item) => item.amountPesewas ?? toPesewas(item.amount))));
  const present = (meeting.attendance || []).filter((item) => item.present).length;
  const absent = (meeting.attendance || []).filter((item) => !item.present).length;
  return {
    present,
    absent,
    contributions: sumBucket("contributions"),
    loanRepayments: sumBucket("loanRepayments"),
    fines: sumBucket("fines"),
    welfare: sumBucket("welfare"),
    total: 0
  };
}

export function finalizeMeetingTotals(meeting) {
  const totals = meetingTotals(meeting);
  totals.total = +(totals.contributions + totals.loanRepayments + totals.fines + totals.welfare).toFixed(2);
  meeting.totals = totals;
  meeting.updatedAt = new Date().toISOString();
  return totals;
}

export function memberMeetingHistory(meetings = [], customerId) {
  return meetings
    .filter((meeting) =>
      (meeting.attendance || []).some((row) => row.customerId === customerId)
      || (meeting.contributions || []).some((row) => row.customerId === customerId)
      || (meeting.fines || []).some((row) => row.customerId === customerId)
    )
    .map((meeting) => ({
      meetingId: meeting.id,
      date: meeting.date,
      present: Boolean((meeting.attendance || []).find((row) => row.customerId === customerId)?.present),
      contribution: (meeting.contributions || []).filter((row) => row.customerId === customerId).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      fine: (meeting.fines || []).filter((row) => row.customerId === customerId).reduce((sum, row) => sum + Number(row.amount || 0), 0)
    }));
}
