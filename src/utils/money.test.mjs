import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendDecimalPoint,
  calculateWalletBalance,
  decimalQuantityToScaled,
  estimatedValueMinor,
  formatMoney,
  normalizeDecimalQuantityInput,
  parsePesoToMinor,
  phpMinorToUsdMinor,
  quantityFromAmountAndUnitPrice,
  sumDecimalQuantities,
  unitPriceMinorFromTotal,
} from './money.ts';

test('starts wallet tracking from a chosen cash balance without deducting older holdings', () => {
  const transactions = [
    { type: 'investment', amountMinor: 600_000, occurredAt: '2026-08-10T12:00:00+08:00' },
    { type: 'investment', amountMinor: 200_000, occurredAt: '2026-08-25T12:00:00+08:00' },
    { type: 'income', amountMinor: 100_000, occurredAt: '2026-08-31T12:00:00+08:00' },
    { type: 'expense', amountMinor: 25_000, occurredAt: '2026-09-01T12:00:00+08:00' },
  ];

  assert.equal(calculateWalletBalance(transactions), -725_000);
  assert.equal(calculateWalletBalance(transactions, { openingBalanceMinor: 500_000, startsOn: '2026-08-31' }), 575_000);
});

test('parses Philippine peso input as integer centavos', () => {
  assert.equal(parsePesoToMinor('₱18,420.50'), 1_842_050);
  assert.equal(parsePesoToMinor('12.345'), null);
  assert.equal(parsePesoToMinor('-20'), null);
});

test('converts stored PHP centavos to display-only USD cents', () => {
  assert.equal(phpMinorToUsdMinor(5_800, 58), 100);
  assert.equal(formatMoney(5_800, 'USD', 58), '$1.00');
  assert.equal(formatMoney(5_800, 'USD'), '—');
});

test('stores BTC and VOO quantities with eight-decimal fixed precision', () => {
  assert.equal(decimalQuantityToScaled('0.01000000'), 1_000_000n);
  assert.equal(decimalQuantityToScaled('2.5'), 250_000_000n);
  assert.equal(decimalQuantityToScaled('0.000000001'), null);
});

test('normalizes fractional investment input from phone keyboards', () => {
  assert.equal(normalizeDecimalQuantityInput('0.04'), '0.04');
  assert.equal(normalizeDecimalQuantityInput('0,001472'), '0.001472');
  assert.equal(normalizeDecimalQuantityInput('.04'), '0.04');
  assert.equal(normalizeDecimalQuantityInput('000.040000000'), '0.04000000');
  assert.equal(appendDecimalPoint('0'), '0.');
  assert.equal(appendDecimalPoint('0.04'), '0.04');
});

test('derives and values investments without binary floating-point quantity math', () => {
  assert.equal(sumDecimalQuantities(['0.1', '0.2']), '0.3');
  assert.equal(sumDecimalQuantities(['2', '0.50000000']), '2.5');
  assert.equal(unitPriceMinorFromTotal('0.01', 300_000), 30_000_000);
  assert.equal(estimatedValueMinor('0.01', 3_684_210), 36_842);
  assert.equal(unitPriceMinorFromTotal('0', 300_000), null);
  assert.equal(estimatedValueMinor('0.001472', 477_812_776), 703_340);
  assert.equal(estimatedValueMinor('0.04', 4_343_708), 173_748);
});

test('derives fractional investment quantity from a fixed PHP budget and current unit price', () => {
  assert.equal(quantityFromAmountAndUnitPrice(100_000, 2_500_000), '0.04');
  assert.equal(quantityFromAmountAndUnitPrice(100_000, 500_000_000), '0.0002');
  assert.equal(quantityFromAmountAndUnitPrice(100_000, 3_000_000), '0.03333333');
  assert.equal(quantityFromAmountAndUnitPrice(1, Number.MAX_SAFE_INTEGER), null);
  assert.equal(quantityFromAmountAndUnitPrice(100_000, 0), null);
});
