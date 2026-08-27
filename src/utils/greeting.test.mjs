import assert from 'node:assert/strict';
import test from 'node:test';
import { timeGreeting } from './greeting.ts';

function atHour(hour) {
  const date = new Date(2026, 7, 27, hour, 0, 0, 0);
  return date;
}

test('uses a time-aware greeting across the day', () => {
  assert.equal(timeGreeting(atHour(5)), 'Good morning');
  assert.equal(timeGreeting(atHour(11)), 'Good morning');
  assert.equal(timeGreeting(atHour(12)), 'Good afternoon');
  assert.equal(timeGreeting(atHour(17)), 'Good afternoon');
  assert.equal(timeGreeting(atHour(18)), 'Good evening');
  assert.equal(timeGreeting(atHour(2)), 'Good evening');
});
