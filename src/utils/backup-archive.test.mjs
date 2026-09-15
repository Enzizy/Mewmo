import assert from 'node:assert/strict';
import test from 'node:test';
import { countRecords, describeBackup, parseBackupArchive } from './backup-archive.ts';

function archive(data) {
  return JSON.stringify({ version: 1, exportedAt: '2026-01-05T00:00:00.000Z', data });
}

const expense = {
  id: 'money-1',
  type: 'expense',
  title: 'Groceries',
  category: 'Groceries',
  amountMinor: 125050,
  occurredAt: '2026-01-04T04:00:00.000Z',
};

test('rejects files that are not LifeDesk backups', () => {
  assert.throws(() => parseBackupArchive('not json'), /not valid JSON/);
  assert.throws(() => parseBackupArchive('[]'), /does not contain a LifeDesk backup/);
  assert.throws(() => parseBackupArchive(JSON.stringify({ version: 1 })), /missing its data section/);
  assert.throws(() => parseBackupArchive(archive({ transactions: [] })), /no records to restore/);
});

test('refuses a backup written by a newer format than this build understands', () => {
  assert.throws(() => parseBackupArchive(JSON.stringify({ version: 99, data: { transactions: [expense] } })), /newer LifeDesk/);
});

test('restores a money record without altering its centavo amount', () => {
  const { archive: parsed, issues } = parseBackupArchive(archive({ transactions: [expense] }));
  assert.deepEqual(issues, {});
  assert.equal(parsed.data.transactions.length, 1);
  assert.equal(parsed.data.transactions[0].amountMinor, 125050);
  assert.equal(parsed.data.transactions[0].category, 'Groceries');
});

test('drops money records with amounts the ledger cannot represent', () => {
  const corrupt = [
    { ...expense, id: 'a', amountMinor: 12.5 },
    { ...expense, id: 'b', amountMinor: -100 },
    { ...expense, id: 'c', amountMinor: '500' },
    { ...expense, id: 'd', occurredAt: 'not a date' },
    { ...expense, id: 'e', type: 'gift' },
  ];
  const { archive: parsed, issues } = parseBackupArchive(archive({ transactions: [...corrupt, expense] }));
  assert.equal(parsed.data.transactions.length, 1);
  assert.equal(issues.transactions, 5);
});

test('keeps investment quantities exact and rejects over-precise ones', () => {
  const lot = { id: 'inv-1', asset: 'BTC', quantity: '0.00123456', unitPriceMinor: 100, amountMinor: 5000, feesMinor: 0, occurredAt: '2026-01-04T04:00:00.000Z' };
  const { archive: parsed, issues } = parseBackupArchive(archive({
    investments: [lot, { ...lot, id: 'inv-2', quantity: '0.000000001' }],
  }));
  assert.equal(parsed.data.investments.length, 1);
  assert.equal(parsed.data.investments[0].quantity, '0.00123456');
  assert.equal(issues.investments, 1);
});

test('clears notification ids so restored reminders do not point at dead schedules', () => {
  const { archive: parsed } = parseBackupArchive(archive({
    items: [{ id: 'r1', category: 'reminder', title: 'Pay rent', dateLabel: 'Today', notificationId: 'stale-id', dueAt: '2026-02-01T01:00:00.000Z' }],
  }));
  assert.equal(parsed.data.items[0].notificationId, undefined);
  assert.equal(parsed.data.items[0].dueAt, '2026-02-01T01:00:00.000Z');
});

test('caps restored goal progress at the goal target', () => {
  const { archive: parsed } = parseBackupArchive(archive({
    savingsGoals: [{ id: 'g1', name: 'Laptop', targetMinor: 5000000, savedMinor: 9999999, paydayContributionMinor: 100000 }],
  }));
  assert.equal(parsed.data.savingsGoals[0].savedMinor, 5000000);
});

test('repairs home preferences and counts what was restored', () => {
  const { archive: parsed, total } = parseBackupArchive(archive({
    transactions: [expense],
    homePreferences: { order: ['money', 'nonsense'], shortcuts: ['currency', 'bogus'] },
  }));
  assert.equal(parsed.data.homePreferences.order[0], 'money');
  assert.ok(parsed.data.homePreferences.order.includes('weather'));
  assert.deepEqual(parsed.data.homePreferences.shortcuts, ['currency']);
  assert.equal(total, countRecords(parsed.data));
  assert.equal(describeBackup(parsed.data), '1 money');
});

test('accepts a wallet starting point only when both halves are valid', () => {
  const good = parseBackupArchive(archive({ transactions: [expense], walletSetup: { openingBalanceMinor: 250000, startsOn: '2026-01-01' } }));
  assert.deepEqual(good.archive.data.walletSetup, { openingBalanceMinor: 250000, startsOn: '2026-01-01' });
  const bad = parseBackupArchive(archive({ transactions: [expense], walletSetup: { openingBalanceMinor: 250000, startsOn: 'January' } }));
  assert.equal(bad.archive.data.walletSetup, undefined);
});
