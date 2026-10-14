import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyReview, weeklyReviewDue } from '../features/review/weekly-review.ts';

const now = new Date(2026, 9, 18, 18); // Sunday, Oct 18
const iso = (...parts) => new Date(...parts).toISOString();
const empty = { items: [], transactions: [], budgets: [], savingsGoals: [], goalSuggestions: [], projects: [], projectSessions: [], recurringRules: [], cards: [], activity: [] };
const expense = (id, amountMinor, category, date) => ({ id, type: 'expense', title: id, category, amountMinor, occurredAt: date });

test('covers the last seven days and labels them', () => {
  const review = buildWeeklyReview(empty, now);
  assert.deepEqual(review.start, new Date(2026, 9, 12));
  assert.equal(review.label, 'Oct 12 – 18');
  assert.equal(review.alreadyReviewed, false);
});

test('counts each completed task once and ignores ones undone since', () => {
  const items = [
    { id: 'a', category: 'task', title: 'Pay rent', dateLabel: '', completed: true },
    { id: 'b', category: 'task', title: 'Undone later', dateLabel: '', completed: false },
  ];
  const activity = [
    { id: '1', kind: 'item_completed', title: '', createdAt: iso(2026, 9, 13), sourceId: 'a' },
    { id: '2', kind: 'item_completed', title: '', createdAt: iso(2026, 9, 14), sourceId: 'a' },
    { id: '3', kind: 'item_completed', title: '', createdAt: iso(2026, 9, 14), sourceId: 'b' },
    { id: '4', kind: 'item_completed', title: '', createdAt: iso(2026, 9, 1), sourceId: 'a' },
  ];
  const review = buildWeeklyReview({ ...empty, items, activity }, now);
  assert.equal(review.tasks.completed, 1);
  assert.deepEqual(review.tasks.completedTitles, ['Pay rent']);
});

test('compares spending with the week before and ranks categories', () => {
  const transactions = [
    expense('lunch', 45_000, 'Food', iso(2026, 9, 15, 12)),
    expense('grab', 30_000, 'Transport', iso(2026, 9, 16, 9)),
    expense('dinner', 60_000, 'Food', iso(2026, 9, 17, 19)),
    expense('old', 100_000, 'Food', iso(2026, 9, 8, 12)),
    { id: 'pay', type: 'income', title: 'Salary', category: 'Income', amountMinor: 2_000_000, occurredAt: iso(2026, 9, 15, 8) },
  ];
  const { money } = buildWeeklyReview({ ...empty, transactions }, now);
  assert.equal(money.spentMinor, 135_000);
  assert.equal(money.previousSpentMinor, 100_000);
  assert.equal(money.spentChange, 0.35);
  assert.equal(money.incomeMinor, 2_000_000);
  assert.deepEqual(money.topCategories, [{ category: 'Food', amountMinor: 105_000 }, { category: 'Transport', amountMinor: 30_000 }]);
});

test('looks a week ahead at tasks, bills, and card payments in date order', () => {
  const items = [{ id: 't', category: 'task', title: 'Renew passport', dateLabel: '', dueAt: iso(2026, 9, 21, 10), completed: false }];
  const recurringRules = [{ id: 'r', kind: 'expense', title: 'Internet', category: 'Bills', amountMinor: 169_900, days: [20], active: true, startsOn: '2026-01-01', createdAt: iso(2026, 0, 1), updatedAt: iso(2026, 0, 1) }];
  const cards = [{ id: 'c', kind: 'credit', name: 'Gold', color: 'midnight', balanceMinor: 500_000, dueDay: 22, creditLimitMinor: 1_000_000, balanceUpdatedAt: iso(2026, 9, 1), createdAt: iso(2026, 9, 1), updatedAt: iso(2026, 9, 1) }];
  const review = buildWeeklyReview({ ...empty, items, recurringRules, cards }, now);
  assert.deepEqual(review.ahead.map((entry) => [entry.kind, entry.title]), [['bill', 'Internet'], ['task', 'Renew passport'], ['card', 'Gold payment']]);
  assert.equal(review.cards.highUsage.length, 1);
});

test('flags projects untouched for two weeks', () => {
  const projects = [
    { id: 'p1', name: 'Portfolio', status: 'active', createdAt: iso(2026, 8, 1), updatedAt: iso(2026, 8, 20) },
    { id: 'p2', name: 'Fresh', status: 'active', createdAt: iso(2026, 9, 10), updatedAt: iso(2026, 9, 16) },
  ];
  const { projects: summary } = buildWeeklyReview({ ...empty, projects }, now);
  assert.deepEqual(summary.stalled.map((project) => project.name), ['Portfolio']);
});

test('nudges on weekends and Monday until this week is reviewed', () => {
  assert.equal(weeklyReviewDue({ activity: [] }, now), true);
  assert.equal(weeklyReviewDue({ activity: [] }, new Date(2026, 9, 15)), false);
  assert.equal(weeklyReviewDue({ activity: [{ id: 'w', kind: 'weekly_review', title: '', createdAt: iso(2026, 9, 17) }] }, now), false);
});
