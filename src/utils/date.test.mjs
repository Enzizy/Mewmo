import assert from 'node:assert/strict';
import test from 'node:test';
import { itemWhenLabel, quickDueDate, updatedAgoLabel } from './date.ts';

const now = new Date(2026, 9, 14, 10, 30);

test('labels relative to the moment of display, not of creation', () => {
  const created = new Date(2026, 9, 13, 15, 4).toISOString();
  assert.equal(itemWhenLabel({ createdAt: created, dateLabel: 'Today' }, now), 'Added yesterday');
  assert.equal(itemWhenLabel({ createdAt: new Date(2026, 9, 14, 8).toISOString() }, now), 'Added today');
});

test('prefers the due date and includes its time', () => {
  const label = itemWhenLabel({ dueAt: new Date(2026, 9, 15, 9, 0).toISOString(), createdAt: now.toISOString() }, now);
  assert.match(label, /^Tomorrow, 9:00/);
});

test('falls back to the stored label when no dates are usable', () => {
  assert.equal(itemWhenLabel({ dateLabel: 'Someday' }, now), 'Someday');
});

test('quick due dates are never already past', () => {
  assert.equal(quickDueDate('today', now).getHours(), 18);
  const late = new Date(2026, 9, 14, 20, 15);
  const evening = quickDueDate('today', late);
  assert.equal(evening.getHours(), 21);
  assert.ok(evening > late);
  const tomorrow = quickDueDate('tomorrow', now);
  assert.deepEqual([tomorrow.getDate(), tomorrow.getHours(), tomorrow.getMinutes()], [15, 9, 0]);
  assert.equal(quickDueDate('next-week', now).getDate(), 21);
});

test('says how long ago a balance was updated', () => {
  assert.equal(updatedAgoLabel(new Date(2026, 9, 14, 8), now), 'today');
  assert.equal(updatedAgoLabel(new Date(2026, 9, 13, 22), now), 'yesterday');
  assert.equal(updatedAgoLabel(new Date(2026, 9, 11), now), '3 days ago');
  assert.match(updatedAgoLabel(new Date(2026, 6, 1), now), /^on /);
});
