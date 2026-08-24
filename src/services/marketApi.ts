import { InvestmentAsset, MarketQuote } from '@/types';
import { getOrganizerApiHeaders, getOrganizerApiUrl } from './organizerApi';

const timeoutMs = 15_000;

export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('Add EXPO_PUBLIC_MEWMO_API_URL before refreshing market prices.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiUrl}/market-quotes`, { signal: controller.signal, headers: getOrganizerApiHeaders() });
    const body = await response.json() as { quotes?: Partial<Record<InvestmentAsset, { priceMinor: number; usdPriceMinor: number; usdPhp: number; asOf: string; source: string }>>; error?: string };
    if (!response.ok) throw new Error(body.error || 'Market prices are unavailable.');
    return (['BTC', 'VOO'] as InvestmentAsset[]).map((asset) => {
      const quote = body.quotes?.[asset];
      if (!quote || !Number.isSafeInteger(quote.priceMinor) || quote.priceMinor <= 0 || !Number.isSafeInteger(quote.usdPriceMinor) || quote.usdPriceMinor <= 0 || !Number.isFinite(quote.usdPhp) || quote.usdPhp <= 0 || !quote.asOf || !quote.source) throw new Error(`The server returned an invalid ${asset} price.`);
      return { asset, ...quote };
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Market price refresh timed out. Try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
