import assert from 'node:assert/strict';
import test from 'node:test';
import { getWalletSummary } from '../features/wallet/wallet-summary.ts';

const thisMonth = (day) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0).toISOString();
};

const base = { transactions: [], investments: [], quotes: [], walletSetup: undefined };

test('treats income as positive and expenses and investments as negative', () => {
  const summary = getWalletSummary({
    ...base,
    transactions: [
      { id: 'a', type: 'income', title: 'Salary', category: 'Income', amountMinor: 5000000, occurredAt: thisMonth(1) },
      { id: 'b', type: 'expense', title: 'Rent', category: 'Housing', amountMinor: 1500000, occurredAt: thisMonth(2) },
      { id: 'c', type: 'investment', title: 'BTC', category: 'Investment', amountMinor: 1000000, occurredAt: thisMonth(3) },
    ],
  });
  assert.equal(summary.balance, 2500000);
  assert.equal(summary.income, 5000000);
  assert.equal(summary.spent, 2500000);
});

test('ignores movements before the wallet tracking start date', () => {
  const startsOn = `${new Date().getFullYear()}-12-31`;
  const summary = getWalletSummary({
    ...base,
    walletSetup: { openingBalanceMinor: 100000, startsOn },
    transactions: [{ id: 'old', type: 'expense', title: 'Before tracking', category: 'General', amountMinor: 999999, occurredAt: '2020-01-01T04:00:00.000Z' }],
  });
  assert.equal(summary.balance, 100000);
});

test('sums fractional lots exactly and values them at the saved quote', () => {
  const summary = getWalletSummary({
    ...base,
    investments: [
      { id: 'i1', asset: 'BTC', quantity: '0.00100000', unitPriceMinor: 100, amountMinor: 500000, feesMinor: 0, occurredAt: thisMonth(4) },
      { id: 'i2', asset: 'BTC', quantity: '0.00050000', unitPriceMinor: 100, amountMinor: 300000, feesMinor: 5000, occurredAt: thisMonth(5) },
    ],
    quotes: [{ asset: 'BTC', priceMinor: 600000000, asOf: thisMonth(5), source: 'Test' }],
  });
  const btc = summary.positions.find((position) => position.asset === 'BTC');
  assert.equal(btc.quantity, '0.0015');
  // Cost basis includes fees: 500000 + 300000 + 5000.
  assert.equal(btc.recorded, 805000);
  // 0.0015 BTC at 6,000,000.00 PHP = 9,000.00 PHP.
  assert.equal(btc.estimated, 900000);
  assert.equal(btc.return.gainMinor, 95000);
});

test('reports no portfolio return while any held asset is missing a price', () => {
  const summary = getWalletSummary({
    ...base,
    investments: [
      { id: 'i1', asset: 'BTC', quantity: '0.001', unitPriceMinor: 100, amountMinor: 500000, feesMinor: 0, occurredAt: thisMonth(4) },
      { id: 'i2', asset: 'VOO', quantity: '2', unitPriceMinor: 100, amountMinor: 600000, feesMinor: 0, occurredAt: thisMonth(4) },
    ],
    quotes: [{ asset: 'BTC', priceMinor: 600000000, asOf: thisMonth(5), source: 'Test' }],
  });
  assert.equal(summary.hasCompleteLivePortfolio, false);
  assert.equal(summary.portfolioReturn, null);
  // 0.001 BTC at 6,000,000.00 PHP is 6,000.00; the unpriced VOO still
  // contributes what it cost, never zero.
  assert.equal(summary.portfolio, 600000 + 600000);
});

test('falls back to recorded cost when no quote exists at all', () => {
  const summary = getWalletSummary({
    ...base,
    investments: [{ id: 'i1', asset: 'VOO', quantity: '3', unitPriceMinor: 100, amountMinor: 900000, feesMinor: 0, occurredAt: thisMonth(4) }],
  });
  assert.equal(summary.portfolio, 900000);
  assert.equal(summary.hasLivePortfolio, false);
  assert.equal(summary.heldPositions.length, 1);
});

test('exposes the USD rate carried on any saved quote', () => {
  const summary = getWalletSummary({
    ...base,
    quotes: [{ asset: 'BTC', priceMinor: 600000000, usdPhp: 58.5, asOf: thisMonth(5), source: 'Test' }],
  });
  assert.equal(summary.usdPhp, 58.5);
});
