export function buildInterestSchedule(startDate, principal, interest, months) {
  const schedule = [];
  let cursor = startDate;
  for (let index = 0; index < months; index += 1) {
    schedule.push({
      dueDate: cursor,
      amount: (Number(principal || 0) * Number(interest || 0)) / 100,
      status: "Pending"
    });
    const next = new Date(`${cursor}T00:00:00`);
    next.setMonth(next.getMonth() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return schedule;
}
