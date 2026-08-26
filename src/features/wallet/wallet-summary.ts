import { AppDataSnapshot, InvestmentAsset } from '@/types';
import { calculateWalletBalance, estimatedValueMinor, isWalletTransactionTracked, sumDecimalQuantities } from '@/utils/money';

export function getWalletSummary(data: Pick<AppDataSnapshot, 'transactions' | 'investments' | 'quotes' | 'walletSetup'>) {
  const now = new Date();
  const isThisMonth = (value: string) => { const date = new Date(value); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };
  const trackedTransactions = data.walletSetup
    ? data.transactions.filter((item) => isWalletTransactionTracked(item, data.walletSetup))
    : data.transactions;
  const monthly = trackedTransactions.filter((item) => isThisMonth(item.occurredAt));
  const income = monthly.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountMinor, 0);
  const spent = monthly.filter((item) => item.type === 'expense' || item.type === 'investment').reduce((sum, item) => sum + item.amountMinor, 0);
  const balance = calculateWalletBalance(data.transactions, data.walletSetup);
  const positions = (['BTC', 'VOO'] as InvestmentAsset[]).map((asset) => {
    const lots = data.investments.filter((item) => item.asset === asset);
    const quantity = sumDecimalQuantities(lots.map((item) => item.quantity)) ?? '0';
    const recorded = lots.reduce((sum, item) => sum + item.amountMinor + item.feesMinor, 0);
    const quote = data.quotes.find((item) => item.asset === asset);
    const estimated = quote ? estimatedValueMinor(quantity, quote.priceMinor) : null;
    return { asset, quantity, recorded, quote, estimated };
  });
  const recordedInvestments = positions.reduce((sum, position) => sum + position.recorded, 0);
  const portfolio = positions.reduce((sum, position) => sum + (position.estimated ?? position.recorded), 0);
  const hasLivePortfolio = positions.some((position) => position.recorded > 0 && position.estimated != null);
  const usdPhp = data.quotes.find((quote) => quote.usdPhp)?.usdPhp;
  return { balance, income, spent, positions, portfolio, recordedInvestments, hasLivePortfolio, usdPhp, walletSetup: data.walletSetup };
}
