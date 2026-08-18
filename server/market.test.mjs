import assert from 'node:assert/strict';
import test from 'node:test';
import { marketResponseFromUsd } from './market.mjs';

test('converts BTC and VOO USD prices to integer PHP centavos', () => {
  const result = marketResponseFromUsd({ 'BTC/USD': 100_000, VOO: 500, 'USD/PHP': 58 }, new Date('2026-08-18T00:00:00.000Z'));
  assert.equal(result.quotes.BTC.priceMinor, 580_000_000);
  assert.equal(result.quotes.VOO.priceMinor, 2_900_000);
  assert.equal(result.quotes.BTC.usdPriceMinor, 10_000_000);
  assert.equal(result.quotes.VOO.usdPriceMinor, 50_000);
  assert.equal(result.usdPhp, 58);
});

test('rejects incomplete market input', () => {
  assert.throws(() => marketResponseFromUsd({ VOO: 500, 'USD/PHP': 58 }, new Date()), /missing/);
});
