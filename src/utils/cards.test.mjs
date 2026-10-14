import assert from 'node:assert/strict';
import test from 'node:test';
import { availableCreditMinor, creditUtilization, daysUntil, expiryStatus, formatExpiry, nextDueDate, normalizeLast4, parseExpiry, summarizeCards, upcomingCardPayments } from '../features/wallet/cards.ts';

const base = { color: 'ocean', balanceUpdatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const debit = { ...base, id: 'd1', kind: 'debit', name: 'Payroll', balanceMinor: 1_250_000 };
const credit = { ...base, id: 'c1', kind: 'credit', name: 'Visa', balanceMinor: 1_245_000, creditLimitMinor: 5_000_000, dueDay: 28 };
const overLimit = { ...base, id: 'c2', kind: 'credit', name: 'Store card', balanceMinor: 210_000, creditLimitMinor: 200_000, dueDay: 31 };

test('never keeps more than the last four digits', () => {
  assert.equal(normalizeLast4('4111 1111 1111 4821'), '4821');
  assert.equal(normalizeLast4('48-2'), '482');
});

test('reads and writes expiry dates', () => {
  assert.deepEqual(parseExpiry('08/29'), { month: 8, year: 2029 });
  assert.deepEqual(parseExpiry('0829'), { month: 8, year: 2029 });
  assert.deepEqual(parseExpiry('8/2031'), { month: 8, year: 2031 });
  assert.equal(parseExpiry('13/29'), null);
  assert.equal(formatExpiry(8, 2029), '08/29');
});

test('a card stays valid through its expiry month', () => {
  const now = new Date(2026, 9, 14);
  assert.equal(expiryStatus({ expiryMonth: 10, expiryYear: 2026 }, now), 'soon');
  assert.equal(expiryStatus({ expiryMonth: 9, expiryYear: 2026 }, now), 'expired');
  assert.equal(expiryStatus({ expiryMonth: 8, expiryYear: 2029 }, now), 'ok');
  assert.equal(expiryStatus({}, now), null);
});

test('credit math reports headroom and overuse', () => {
  assert.equal(availableCreditMinor(credit), 3_755_000);
  assert.equal(availableCreditMinor(overLimit), -10_000);
  assert.equal(availableCreditMinor(debit), null);
  assert.equal(creditUtilization(credit), 0.249);
});

test('due dates roll forward and clamp to short months', () => {
  const today = new Date(2026, 9, 14);
  assert.deepEqual(nextDueDate(28, today), new Date(2026, 9, 28));
  assert.deepEqual(nextDueDate(5, today), new Date(2026, 10, 5));
  assert.deepEqual(nextDueDate(31, new Date(2026, 10, 2)), new Date(2026, 10, 30));
  assert.deepEqual(nextDueDate(14, today), new Date(2026, 9, 14));
  assert.equal(daysUntil(new Date(2026, 9, 28), today), 14);
  assert.equal(nextDueDate(undefined, today), null);
});

test('totals keep debit money and credit debt apart', () => {
  assert.deepEqual(summarizeCards([debit, credit, overLimit]), {
    debitCount: 1, creditCount: 2,
    debitBalanceMinor: 1_250_000,
    creditOwedMinor: 1_455_000,
    creditLimitMinor: 5_200_000,
    availableCreditMinor: 3_755_000,
  });
});

test('lists payments due soonest first', () => {
  const ids = upcomingCardPayments([overLimit, debit, credit], new Date(2026, 9, 14)).map((entry) => entry.card.id);
  assert.deepEqual(ids, ['c1', 'c2']);
});
