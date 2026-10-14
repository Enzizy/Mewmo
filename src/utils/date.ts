export function dateLabelFor(dateInput: string | Date, now = new Date()) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'No date';
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((startDate.getTime() - startToday.getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === -1) return 'Yesterday';
  if (difference === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function timeLabelFor(dateInput: string | Date) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function relativeDateTimeLabel(dateInput: string | Date) {
  const date = new Date(dateInput);
  return `${dateLabelFor(date)}, ${timeLabelFor(date)}`;
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

/**
 * The "when" shown beside an item, computed at display time so it never goes
 * stale the way a stored "Today" label does. A due date wins; otherwise the
 * creation day is shown as such, without a time that could read as a deadline.
 */
export function itemWhenLabel(item: { dueAt?: string | null; createdAt?: string; dateLabel?: string }, now = new Date()) {
  if (item.dueAt && !Number.isNaN(Date.parse(item.dueAt))) return `${dateLabelFor(item.dueAt, now)}, ${timeLabelFor(item.dueAt)}`;
  if (item.createdAt && !Number.isNaN(Date.parse(item.createdAt))) {
    const day = dateLabelFor(item.createdAt, now);
    return `Added ${day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day}`;
  }
  return item.dateLabel ?? '';
}

export type QuickDue = 'today' | 'tomorrow' | 'next-week';

/**
 * A due time for a one-tap date choice. "Today" lands at 6 PM, or the next full
 * hour once it is later than that, so a new task is never born overdue.
 */
export function quickDueDate(choice: QuickDue, now = new Date()) {
  const due = new Date(now);
  due.setSeconds(0, 0);
  if (choice === 'today') {
    if (now.getHours() < 18) due.setHours(18, 0);
    else due.setHours(now.getHours() + 1, 0);
    return due;
  }
  due.setDate(due.getDate() + (choice === 'tomorrow' ? 1 : 7));
  due.setHours(9, 0);
  return due;
}

/** "today", "yesterday", "3 days ago", or a date once it is more than a month old. */
export function updatedAgoLabel(dateInput: string | Date, now = new Date()) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'at an unknown time';
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startNow.getTime() - startDate.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 30) return `${days} days ago`;
  return `on ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
}
