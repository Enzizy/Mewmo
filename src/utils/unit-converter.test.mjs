import assert from 'node:assert/strict';
import test from 'node:test';
import { convertUnit, parseNumericInput } from './unit-converter.ts';

test('converts linear units using a stable base unit', () => {
  assert.equal(convertUnit('Length', 1, 'Kilometers', 'Meters'), 1000);
  assert.ok(Math.abs(convertUnit('Weight', 1, 'Pounds', 'Grams') - 453.59237) < 1e-9);
  assert.equal(convertUnit('Data', 1, 'GB', 'MB'), 1000);
});

test('converts temperature without treating it as a linear ratio', () => {
  assert.equal(convertUnit('Temperature', 0, 'Celsius', 'Fahrenheit'), 32);
  assert.equal(convertUnit('Temperature', 32, 'Fahrenheit', 'Celsius'), 0);
  assert.equal(convertUnit('Temperature', 0, 'Celsius', 'Kelvin'), 273.15);
});

test('parses forgiving numeric input and rejects unsafe values', () => {
  assert.equal(parseNumericInput('1,250.5'), 1250.5);
  assert.equal(parseNumericInput('-.5'), -0.5);
  assert.equal(parseNumericInput('12 pesos'), null);
  assert.equal(parseNumericInput(''), null);
});
