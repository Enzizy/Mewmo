import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decimalQuantityToScaled,
  estimatedValueMinor,
  formatMoney,
  parsePesoToMinor,
  phpMinorToUsdMinor,
  sumDecimalQuantities,
  unitPriceMinorFromTotal,
} from './money.ts';

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

test('derives and values investments without binary floating-point quantity math', () => {
  assert.equal(sumDecimalQuantities(['0.1', '0.2']), '0.3');
  assert.equal(sumDecimalQuantities(['2', '0.50000000']), '2.5');
  assert.equal(unitPriceMinorFromTotal('0.01', 300_000), 30_000_000);
  assert.equal(estimatedValueMinor('0.01', 3_684_210), 36_842);
  assert.equal(unitPriceMinorFromTotal('0', 300_000), null);
});
