import assert from 'node:assert/strict';
import test from 'node:test';

import { investmentPurchaseFromBudget, isMarketQuoteFresh, marketQuotesNeedRefresh } from './market.ts';

const now = Date.parse('2026-08-24T06:30:00.000Z');
const quote = (asset, asOf) => ({ asset, priceMinor: 100, usdPriceMinor: 2, usdPhp: 50, asOf, source: 'Test' });

test('refreshes market quotes when either supported asset is missing or stale', () => {
  assert.equal(marketQuotesNeedRefresh([], now), true);
  assert.equal(marketQuotesNeedRefresh([quote('BTC', '2026-08-24T06:29:00.000Z')], now), true);
  assert.equal(marketQuotesNeedRefresh([
    quote('BTC', '2026-08-24T06:00:00.000Z'),
    quote('VOO', '2026-08-24T06:29:00.000Z'),
  ], now), true);
});

test('keeps a complete recent market quote set', () => {
  assert.equal(marketQuotesNeedRefresh([
    quote('BTC', '2026-08-24T06:29:00.000Z'),
    quote('VOO', '2026-08-24T06:29:30.000Z'),
  ], now), false);
});

test('accepts only positive, recent quotes for automatic investment calculations', () => {
  assert.equal(isMarketQuoteFresh(quote('BTC', '2026-08-24T06:29:00.000Z'), now), true);
  assert.equal(isMarketQuoteFresh(quote('BTC', '2026-08-24T06:00:00.000Z'), now), false);
  assert.equal(isMarketQuoteFresh({ ...quote('BTC', '2026-08-24T06:29:00.000Z'), priceMinor: 0 }, now), false);
  assert.equal(isMarketQuoteFresh(quote('BTC', '2026-08-24T06:31:00.000Z'), now), false);
});

test('creates an estimated fractional purchase only when a current quote is available', () => {
  assert.deepEqual(investmentPurchaseFromBudget(100_000, { priceMinor: 2_500_000, asOf: '2026-08-24T06:29:00.000Z' }, now), {
    quantity: '0.04',
    unitPriceMinor: 2_500_000,
  });
  assert.equal(investmentPurchaseFromBudget(100_000, { priceMinor: 2_500_000, asOf: '2026-08-24T06:00:00.000Z' }, now), null);
  assert.equal(investmentPurchaseFromBudget(100_000, null, now), null);
});
