import type { ReminderFrequency, ReminderRecurrence, ThoughtItem } from '../types/index.ts';

export function recurrenceForDate(frequency: ReminderFrequency, dueAt: string): ReminderRecurrence {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) throw new Error('Choose a valid reminder date and time.');
  return {
    frequency,
    hour: date.getHours(),
    minute: date.getMinutes(),
    weekday: frequency === 'weekly' ? date.getDay() + 1 : undefined,
    day: frequency === 'monthly' || frequency === 'yearly' ? date.getDate() : undefined,
    month: frequency === 'yearly' ? date.getMonth() : undefined,
  };
}

export function nextReminderDate(item: ThoughtItem, after = new Date()): Date | null {
  if (item.category !== 'reminder' || item.completed || item.reminderEnabled === false || !item.dueAt) return null;
  const first = new Date(item.dueAt);
  if (Number.isNaN(first.getTime())) return null;
  if (!item.recurrence) return first.getTime() >= after.getTime() ? first : null;

  const { frequency, hour, minute } = item.recurrence;
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setHours(hour, minute, 0, 0);

  if (frequency === 'daily') {
    if (candidate < after) candidate.setDate(candidate.getDate() + 1);
  } else if (frequency === 'weekly') {
    const weekday = (item.recurrence.weekday ?? first.getDay() + 1) - 1;
    let days = (weekday - candidate.getDay() + 7) % 7;
    if (days === 0 && candidate < after) days = 7;
    candidate.setDate(candidate.getDate() + days);
  } else if (frequency === 'monthly') {
    const day = item.recurrence.day ?? first.getDate();
    setMonthlyCandidate(candidate, candidate.getFullYear(), candidate.getMonth(), day, hour, minute);
    if (candidate < after) setMonthlyCandidate(candidate, candidate.getFullYear(), candidate.getMonth() + 1, day, hour, minute);
  } else {
    const month = item.recurrence.month ?? first.getMonth();
    const day = item.recurrence.day ?? first.getDate();
    setMonthlyCandidate(candidate, candidate.getFullYear(), month, day, hour, minute);
    if (candidate < after) setMonthlyCandidate(candidate, candidate.getFullYear() + 1, month, day, hour, minute);
  }

  return candidate < first ? first : candidate;
}

function setMonthlyCandidate(target: Date, year: number, month: number, day: number, hour: number, minute: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  target.setFullYear(year, month, Math.min(day, lastDay));
  target.setHours(hour, minute, 0, 0);
}

export function upcomingReminders(items: ThoughtItem[], limit = 3, after = new Date()) {
  return items
    .map((item) => ({ item, date: nextReminderDate(item, after) }))
    .filter((entry): entry is { item: ThoughtItem; date: Date } => Boolean(entry.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}

export function reminderOccurrencesBetween(item: ThoughtItem, start: Date, endExclusive: Date): Date[] {
  if (endExclusive <= start) return [];
  const occurrences: Date[] = [];
  let cursor = new Date(start);

  while (occurrences.length < 400) {
    const occurrence = nextReminderDate(item, cursor);
    if (!occurrence || occurrence >= endExclusive) break;
    occurrences.push(occurrence);
    cursor = new Date(occurrence.getTime() + 1);
  }

  return occurrences;
}

export function reminderDateTime(dateText: string, timeText: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
  if (!match || !time) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(time[1]), Number(time[2]), 0, 0);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3]) || date.getHours() !== Number(time[1]) || date.getMinutes() !== Number(time[2])) return null;
  return date.toISOString();
}

export function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
