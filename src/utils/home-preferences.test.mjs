import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HOME_PREFERENCES, normalizeHomePreferences } from '../features/home/home-preferences.ts';

test('keeps balances private on the Android widget by default', () => {
  assert.equal(DEFAULT_HOME_PREFERENCES.widgetBalancesVisible, false);
  assert.equal(normalizeHomePreferences().widgetBalancesVisible, false);
  assert.equal(normalizeHomePreferences({ balancesVisible: true }).widgetBalancesVisible, false);
});

test('only displays balances on the Android widget after explicit opt-in', () => {
  assert.equal(normalizeHomePreferences({ widgetBalancesVisible: true }).widgetBalancesVisible, true);
  assert.equal(normalizeHomePreferences({ widgetBalancesVisible: false }).widgetBalancesVisible, false);
});
