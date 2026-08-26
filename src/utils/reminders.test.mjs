import assert from 'node:assert/strict';
import test from 'node:test';
import { nextReminderDate, recurrenceForDate, reminderDateTime } from './reminders.ts';

test('finds the next monthly reminder occurrence', () => {
  const dueAt = new Date(2026, 7, 15, 9, 0).toISOString();
  const item = { id: 'r1', category: 'reminder', title: 'Payday', dateLabel: '', dueAt, recurrence: recurrenceForDate('monthly', dueAt), reminderEnabled: true };
  const next = nextReminderDate(item, new Date(2026, 7, 16, 8, 0));
  assert.equal(next?.getFullYear(), 2026);
  assert.equal(next?.getMonth(), 8);
  assert.equal(next?.getDate(), 15);
  assert.equal(next?.getHours(), 9);
});

test('paused and completed reminders are not upcoming', () => {
  const dueAt = new Date(2026, 7, 26, 9, 0).toISOString();
  assert.equal(nextReminderDate({ id: 'r1', category: 'reminder', title: 'Paused', dateLabel: '', dueAt, reminderEnabled: false }, new Date(2026, 7, 25)), null);
  assert.equal(nextReminderDate({ id: 'r2', category: 'reminder', title: 'Done', dateLabel: '', dueAt, completed: true }, new Date(2026, 7, 25)), null);
});

test('validates local date and time entry', () => {
  assert.ok(reminderDateTime('2026-08-30', '09:15'));
  assert.equal(reminderDateTime('2026-02-30', '09:15'), null);
  assert.equal(reminderDateTime('2026-08-30', '25:00'), null);
});
