import type { InvestmentAsset, MarketQuote } from '@/types';
import { quantityFromAmountAndUnitPrice } from './money.ts';

export const MARKET_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;

export function isMarketQuoteFresh(quote: Pick<MarketQuote, 'priceMinor' | 'asOf'> | null | undefined, now = Date.now()) {
  if (!quote || !Number.isSafeInteger(quote.priceMinor) || quote.priceMinor <= 0) return false;
  const timestamp = Date.parse(quote.asOf);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < MARKET_QUOTE_MAX_AGE_MS;
}

export function investmentPurchaseFromBudget(amountMinor: number, quote: Pick<MarketQuote, 'priceMinor' | 'asOf'> | null | undefined, now = Date.now()) {
  if (!quote || !isMarketQuoteFresh(quote, now)) return null;
  const quantity = quantityFromAmountAndUnitPrice(amountMinor, quote.priceMinor);
  return quantity ? { quantity, unitPriceMinor: quote.priceMinor } : null;
}

export function marketQuotesNeedRefresh(quotes: MarketQuote[], now = Date.now()) {
  return (['BTC', 'VOO'] as InvestmentAsset[]).some((asset) => {
    const quote = quotes.find((candidate) => candidate.asset === asset);
    return !isMarketQuoteFresh(quote, now);
  });
}
