import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTwelveDataExchangeRate, validateCurrencyPair } from './exchange-rate.mjs';

test('normalizes and validates supported currency pairs', () => {
  assert.deepEqual(validateCurrencyPair('php', ' usd '), { from: 'PHP', to: 'USD' });
  assert.throws(() => validateCurrencyPair('PHP', 'PHP'), /different/);
  assert.throws(() => validateCurrencyPair('PHP', 'XYZ'), /supported/);
});

test('normalizes a Twelve Data exchange-rate response', async () => {
  const result = await loadTwelveDataExchangeRate({
    apiKey: 'test-key', from: 'USD', to: 'PHP',
    fetchImpl: async (url) => {
      assert.equal(url.searchParams.get('symbol'), 'USD/PHP');
      return { ok: true, json: async () => ({ rate: '58.25', timestamp: 1_787_000_000 }) };
    },
  });
  assert.equal(result.rate, 58.25);
  assert.equal(result.source, 'Twelve Data');
  assert.equal(result.asOf, new Date(1_787_000_000 * 1000).toISOString());
});

test('rejects provider errors and invalid rates', async () => {
  await assert.rejects(() => loadTwelveDataExchangeRate({ apiKey: 'test', from: 'USD', to: 'PHP', fetchImpl: async () => ({ ok: true, json: async () => ({ rate: 0 }) }) }), /invalid/);
});
