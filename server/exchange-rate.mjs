export const supportedCurrencies = ['PHP', 'USD', 'EUR', 'JPY', 'GBP'];

export function validateCurrencyPair(fromValue, toValue) {
  const from = typeof fromValue === 'string' ? fromValue.trim().toUpperCase() : '';
  const to = typeof toValue === 'string' ? toValue.trim().toUpperCase() : '';
  if (!supportedCurrencies.includes(from) || !supportedCurrencies.includes(to)) throw new Error('Choose a supported source and destination currency.');
  if (from === to) throw new Error('Source and destination currencies must be different.');
  return { from, to };
}

export async function loadTwelveDataExchangeRate({ apiKey, from, to, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Live currency conversion needs TWELVE_DATA_API_KEY on the server.');
  const pair = validateCurrencyPair(from, to);
  const url = new URL('https://api.twelvedata.com/exchange_rate');
  url.searchParams.set('symbol', `${pair.from}/${pair.to}`);
  url.searchParams.set('dp', '8');
  url.searchParams.set('apikey', apiKey);
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === 'error') throw new Error(body.message || 'Twelve Data could not load this exchange rate.');
  const rate = Number(body.rate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Twelve Data returned an invalid exchange rate.');
  const timestamp = Number(body.timestamp);
  const asOf = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000) : new Date();
  return { ...pair, rate, asOf: asOf.toISOString(), source: 'Twelve Data' };
}
