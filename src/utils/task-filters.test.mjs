import assert from 'node:assert/strict';
import test from 'node:test';
import { recurrenceForDate } from './reminders.ts';
import { filterTaskItems } from './task-filters.ts';

test('places a recurring reminder according to its next occurrence, not its original date', () => {
  const dueAt = new Date(2026, 0, 15, 9, 0).toISOString();
  const payday = { id: 'r1', category: 'reminder', title: 'Payday', dateLabel: '', dueAt, recurrence: recurrenceForDate('monthly', dueAt), reminderEnabled: true };
  const now = new Date(2026, 7, 20, 12, 0);
  assert.deepEqual(filterTaskItems([payday], 'focus', now), []);
  assert.deepEqual(filterTaskItems([payday], 'upcoming', now).map((item) => item.id), ['r1']);
});

test('keeps today recurring reminders in focus after their scheduled time', () => {
  const dueAt = new Date(2026, 7, 1, 9, 0).toISOString();
  const daily = { id: 'r1', category: 'reminder', title: 'Daily check-in', dateLabel: '', dueAt, recurrence: recurrenceForDate('daily', dueAt), reminderEnabled: true };
  assert.deepEqual(filterTaskItems([daily], 'focus', new Date(2026, 7, 20, 18, 0)).map((item) => item.id), ['r1']);
});

test('keeps paused reminders out of scheduled task views', () => {
  const dueAt = new Date(2026, 7, 25, 9, 0).toISOString();
  const paused = { id: 'r1', category: 'reminder', title: 'Paused', dateLabel: '', dueAt, reminderEnabled: false };
  const now = new Date(2026, 7, 20, 12, 0);
  assert.deepEqual(filterTaskItems([paused], 'focus', now), []);
  assert.deepEqual(filterTaskItems([paused], 'upcoming', now), []);
});
