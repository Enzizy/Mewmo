import assert from 'node:assert/strict';
import test from 'node:test';
import { roundedTemperature, weatherIcon, weatherLabel } from './weather.ts';

test('maps standard WMO weather codes to readable conditions', () => {
  assert.equal(weatherLabel(0), 'Clear sky');
  assert.equal(weatherLabel(63), 'Rain');
  assert.equal(weatherLabel(95), 'Thunderstorms');
});

test('uses day and night icons for clear conditions', () => {
  assert.equal(weatherIcon(0, true), 'sun');
  assert.equal(weatherIcon(0, false), 'moon');
  assert.equal(roundedTemperature(28.6), '29°');
});
