export function normalizeMonthlyDays(days: number[]) {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))].sort((a, b) => a - b);
}

export function parseMonthlyDays(value: string) {
  if (!value.trim()) return null;
  const tokens = value.split(',').map((token) => Number(token.trim()));
  const days = normalizeMonthlyDays(tokens);
  return days.length === tokens.length && days.length > 0 ? days : null;
}

export function scheduledDatesThrough(rule: { days: number[]; startsOn: string }, through = localDateKey(new Date()), maxMonths = 24) {
  if (!isDateKey(rule.startsOn) || !isDateKey(through)) return [];
  const start = dateKeyParts(rule.startsOn);
  const end = dateKeyParts(through);
  const dates = new Set<string>();
  let year = start.year;
  let month = start.month;
  let scanned = 0;

  while ((year < end.year || (year === end.year && month <= end.month)) && scanned < maxMonths) {
    const lastDay = new Date(year, month, 0).getDate();
    for (const requestedDay of normalizeMonthlyDays(rule.days)) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`;
      if (date >= rule.startsOn && date <= through) dates.add(date);
    }
    month += 1;
    if (month === 13) { month = 1; year += 1; }
    scanned += 1;
  }
  return [...dates].sort();
}

export function nextScheduledDate(rule: { days: number[]; startsOn: string }, after = localDateKey(new Date())) {
  const cursor = dateKeyParts(after);
  for (let offset = 0; offset < 24; offset += 1) {
    const absoluteMonth = cursor.month - 1 + offset;
    const year = cursor.year + Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12 + 1;
    const lastDay = new Date(year, month, 0).getDate();
    for (const requestedDay of normalizeMonthlyDays(rule.days)) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`;
      if (date > after && date >= rule.startsOn) return date;
    }
  }
  return null;
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localNoonIso(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function dateKeyParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}
