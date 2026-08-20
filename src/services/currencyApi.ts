import { getOrganizerApiUrl } from './organizerApi';

export type CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'JPY' | 'GBP';
export type ExchangeRate = { from: CurrencyCode; to: CurrencyCode; rate: number; asOf: string; source: string };

export async function fetchExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRate> {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('Add EXPO_PUBLIC_MEWMO_API_URL before converting currencies.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const query = new URLSearchParams({ from, to });
    const response = await fetch(`${apiUrl}/exchange-rate?${query}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const body = await response.json() as Partial<ExchangeRate> & { error?: string };
    if (!response.ok) throw new Error(body.error || 'The exchange rate is unavailable.');
    if (body.from !== from || body.to !== to || !Number.isFinite(body.rate) || Number(body.rate) <= 0 || typeof body.asOf !== 'string' || Number.isNaN(Date.parse(body.asOf)) || typeof body.source !== 'string') throw new Error('The server returned an invalid exchange rate.');
    return body as ExchangeRate;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The exchange-rate request timed out. Try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the Mewmo server. Check that it is running and that the app API address is correct.');
    throw error;
  } finally { clearTimeout(timeout); }
}
