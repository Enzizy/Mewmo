import assert from 'node:assert/strict';
import test from 'node:test';
import { nextScheduledDate, parseMonthlyDays, scheduledDatesBetween, scheduledDatesThrough } from './recurrence.ts';

test('parses and normalizes customizable monthly days', () => {
  assert.deepEqual(parseMonthlyDays('30, 15'), [15, 30]);
  assert.equal(parseMonthlyDays('0, 15'), null);
  assert.equal(parseMonthlyDays('15, 15'), null);
});

test('salary schedule catches up without posting before its start date', () => {
  assert.deepEqual(scheduledDatesThrough({ days: [15, 30], startsOn: '2026-08-18' }, '2026-09-30'), ['2026-08-30', '2026-09-15', '2026-09-30']);
});

test('day 30 uses the last available day in a shorter month', () => {
  assert.deepEqual(scheduledDatesThrough({ days: [30], startsOn: '2027-01-01' }, '2027-02-28'), ['2027-01-30', '2027-02-28']);
  assert.equal(nextScheduledDate({ days: [30], startsOn: '2027-01-01' }, '2027-02-01'), '2027-02-28');
});

test('future ranges work even when a schedule started more than two years ago', () => {
  assert.deepEqual(scheduledDatesBetween({ days: [15, 30], startsOn: '2020-01-01' }, '2026-08-01', '2026-08-31'), ['2026-08-15', '2026-08-30']);
});
