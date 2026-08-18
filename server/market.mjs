const symbols = ['BTC/USD', 'VOO', 'USD/PHP'];

export async function loadTwelveDataQuotes({ apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Automatic market prices need TWELVE_DATA_API_KEY on the server.');
  const values = await Promise.all(symbols.map(async (symbol) => {
    const url = new URL('https://api.twelvedata.com/price');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', apiKey);
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.status === 'error') throw new Error(body.message || `Could not load ${symbol}.`);
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Twelve Data returned an invalid ${symbol} price.`);
    return [symbol, price];
  }));
  return marketResponseFromUsd(Object.fromEntries(values), new Date());
}

export function marketResponseFromUsd(values, asOf) {
  const btcUsd = Number(values['BTC/USD']);
  const vooUsd = Number(values.VOO);
  const usdPhp = Number(values['USD/PHP']);
  if (![btcUsd, vooUsd, usdPhp].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Market response is missing BTC, VOO, or USD/PHP.');
  return {
    usdPhp,
    quotes: {
      BTC: { priceMinor: toMinor(btcUsd * usdPhp), usdPriceMinor: toMinor(btcUsd), usdPhp, asOf: asOf.toISOString(), source: 'Twelve Data · BTC/USD × USD/PHP' },
      VOO: { priceMinor: toMinor(vooUsd * usdPhp), usdPriceMinor: toMinor(vooUsd), usdPhp, asOf: asOf.toISOString(), source: 'Twelve Data · VOO × USD/PHP' },
    },
  };
}

function toMinor(value) {
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error('Converted market price is outside the supported range.');
  return minor;
}
