import { AppDataSnapshot, InvestmentAsset } from '@/types';
import { estimatedValueMinor, sumDecimalQuantities } from '@/utils/money';

export function getWalletSummary(data: Pick<AppDataSnapshot, 'transactions' | 'investments' | 'quotes'>) {
  const now = new Date();
  const isThisMonth = (value: string) => { const date = new Date(value); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };
  const monthly = data.transactions.filter((item) => isThisMonth(item.occurredAt));
  const income = monthly.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountMinor, 0);
  const spent = monthly.filter((item) => item.type === 'expense' || item.type === 'investment').reduce((sum, item) => sum + item.amountMinor, 0);
  const balance = data.transactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amountMinor : item.type === 'expense' || item.type === 'investment' ? -item.amountMinor : 0), 0);
  const positions = (['BTC', 'VOO'] as InvestmentAsset[]).map((asset) => {
    const lots = data.investments.filter((item) => item.asset === asset);
    const quantity = sumDecimalQuantities(lots.map((item) => item.quantity)) ?? '0';
    const recorded = lots.reduce((sum, item) => sum + item.amountMinor + item.feesMinor, 0);
    const quote = data.quotes.find((item) => item.asset === asset);
    const estimated = quote ? estimatedValueMinor(quantity, quote.priceMinor) : null;
    return { asset, quantity, recorded, quote, estimated };
  });
  const valued = positions.filter((position) => position.estimated != null);
  const recordedInvestments = positions.reduce((sum, position) => sum + position.recorded, 0);
  const portfolio = valued.length ? valued.reduce((sum, position) => sum + (position.estimated ?? 0), 0) : recordedInvestments;
  const usdPhp = data.quotes.find((quote) => quote.usdPhp)?.usdPhp;
  return { balance, income, spent, positions, portfolio, recordedInvestments, hasLivePortfolio: valued.length > 0, usdPhp };
}
