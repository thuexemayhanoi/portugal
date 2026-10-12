// Publishing pace for the content factory: how many NEW articles may still be published in the
// rolling 7-day window that ends today (updates of published articles do not count).
export function roomLeft(logEntries, cap, today) {
  if (!cap) return Infinity;
  const since = Date.parse(today) - 6 * 86400000;
  const recent = logEntries.filter((e) => e.type !== 'update' && Date.parse(e.date) >= since && Date.parse(e.date) <= Date.parse(today)).length;
  return Math.max(0, cap - recent);
}
