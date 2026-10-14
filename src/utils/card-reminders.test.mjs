import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_REMINDER_PREFIX, planCardReminders } from '../features/wallet/card-reminders.ts';

const base = { color: 'ocean', balanceUpdatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const gold = { ...base, id: 'c1', kind: 'credit', name: 'Gold Rewards', last4: '7302', balanceMinor: 1_245_000, dueDay: 28 };

test('reminds 3 days before and on the due day at 9 AM', () => {
  const plan = planCardReminders([gold], new Date(2026, 9, 14, 10));
  assert.deepEqual(plan.map((reminder) => reminder.date), [new Date(2026, 9, 25, 9), new Date(2026, 9, 28, 9)]);
  assert.equal(plan[0].title, 'Gold Rewards payment due in 3 days');
  assert.equal(plan[1].title, 'Gold Rewards payment due today');
  assert.match(plan[0].body, /₱12,450\.00 owed · due Oct 28 · card ending 7302/);
  assert.ok(plan.every((reminder) => reminder.identifier.startsWith(CARD_REMINDER_PREFIX)));
  assert.notEqual(plan[0].identifier, plan[1].identifier);
});

test('skips reminder times that have already passed', () => {
  const plan = planCardReminders([gold], new Date(2026, 9, 26, 8));
  assert.deepEqual(plan.map((reminder) => reminder.date), [new Date(2026, 9, 28, 9)]);
});

test('moves on to next month once the due-day reminder has fired', () => {
  const plan = planCardReminders([gold], new Date(2026, 9, 28, 10));
  assert.deepEqual(plan.map((reminder) => reminder.date), [new Date(2026, 10, 25, 9), new Date(2026, 10, 28, 9)]);
});

test('leaves out debit cards, paid-off cards, and cards with no due day', () => {
  const now = new Date(2026, 9, 14, 10);
  const cards = [
    { ...gold, id: 'd', kind: 'debit' },
    { ...gold, id: 'paid', balanceMinor: 0 },
    { ...gold, id: 'nodue', dueDay: undefined },
  ];
  assert.deepEqual(planCardReminders(cards, now), []);
});

test('hides the amount when balances are hidden', () => {
  const [first] = planCardReminders([gold], new Date(2026, 9, 14, 10), { showAmounts: false });
  assert.doesNotMatch(first.body, /₱/);
  assert.match(first.body, /^Payment · due Oct 28/);
});
