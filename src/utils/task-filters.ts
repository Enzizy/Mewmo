import type { ThoughtItem } from '../types/index.ts';
import { nextReminderDate } from './reminders.ts';

export type TaskViewMode = 'focus' | 'upcoming' | 'inbox';

export function filterTaskItems(items: ThoughtItem[], mode: TaskViewMode, now = new Date()) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (mode === 'focus') {
    return items.filter((item) => {
      if (item.completed || (item.category !== 'task' && item.category !== 'reminder')) return false;
      const scheduled = taskViewDate(item, todayStart);
      if (item.category === 'reminder') return Boolean(scheduled && scheduled <= todayEnd);
      return !scheduled || scheduled <= todayEnd;
    });
  }

  if (mode === 'upcoming') {
    return items
      .map((item) => ({ item, date: taskViewDate(item, todayStart) }))
      .filter((entry): entry is { item: ThoughtItem; date: Date } => !entry.item.completed && Boolean(entry.date && entry.date > todayEnd))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => entry.item);
  }

  return items.filter((item) => item.category === 'idea' || item.category === 'note' || (!item.dueAt && item.category === 'reminder'));
}

function taskViewDate(item: ThoughtItem, todayStart: Date): Date | null {
  if (!item.dueAt) return null;
  if (item.category === 'reminder') {
    if (item.reminderEnabled === false) return null;
    if (item.recurrence) return nextReminderDate(item, todayStart);
  }
  const date = new Date(item.dueAt);
  return Number.isNaN(date.getTime()) ? null : date;
}
