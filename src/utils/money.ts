export function formatPeso(minor: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(minor / 100);
}

export type DisplayCurrency = 'PHP' | 'USD';

type WalletTransaction = { type: string; amountMinor: number; occurredAt: string };
type WalletStartingPoint = { openingBalanceMinor: number; startsOn: string };

export function isWalletTransactionTracked(transaction: WalletTransaction, startingPoint?: WalletStartingPoint) {
  if (!startingPoint) return true;
  const date = new Date(transaction.occurredAt);
  if (Number.isNaN(date.getTime())) return false;
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return dateKey >= startingPoint.startsOn;
}

export function calculateWalletBalance(transactions: WalletTransaction[], startingPoint?: WalletStartingPoint) {
  return transactions
    .filter((transaction) => isWalletTransactionTracked(transaction, startingPoint))
    .reduce((sum, transaction) => sum + (transaction.type === 'income' ? transaction.amountMinor : transaction.type === 'expense' || transaction.type === 'investment' ? -transaction.amountMinor : 0), startingPoint?.openingBalanceMinor ?? 0);
}

export function phpMinorToUsdMinor(minor: number, usdPhp?: number) {
  if (!Number.isSafeInteger(minor) || !Number.isFinite(usdPhp) || !usdPhp || usdPhp <= 0) return null;
  const result = Math.round(minor / usdPhp);
  return Number.isSafeInteger(result) ? result : null;
}

export function formatMoney(minor: number, currency: DisplayCurrency, usdPhp?: number) {
  if (currency === 'PHP') return formatPeso(minor);
  const usdMinor = phpMinorToUsdMinor(minor, usdPhp);
  if (usdMinor == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(usdMinor / 100);
}

export function parsePesoToMinor(value: string) {
  const normalized = value.replace(/[₱,\s]/g, '');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
}

export function decimalQuantityToScaled(value: string, scale = 8) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > scale) return null;
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0');
}

export function normalizeDecimalQuantityInput(value: string, scale = 8) {
  const decimalNormalized = value.replace(/,/g, '.');
  const digitsAndSeparators = decimalNormalized.replace(/[^\d.]/g, '');
  if (!digitsAndSeparators) return '';

  const separatorIndex = digitsAndSeparators.indexOf('.');
  const rawWhole = separatorIndex === -1 ? digitsAndSeparators : digitsAndSeparators.slice(0, separatorIndex);
  const rawFraction = separatorIndex === -1 ? '' : digitsAndSeparators.slice(separatorIndex + 1).replace(/\./g, '');
  const whole = (rawWhole || '0').replace(/^0+(?=\d)/, '');
  return separatorIndex === -1 ? whole : `${whole}.${rawFraction.slice(0, scale)}`;
}

export function appendDecimalPoint(value: string, scale = 8) {
  const normalized = normalizeDecimalQuantityInput(value, scale);
  if (!normalized) return '0.';
  return normalized.includes('.') ? normalized : `${normalized}.`;
}

export function sumDecimalQuantities(values: string[], scale = 8) {
  let total = 0n;
  for (const value of values) {
    const scaled = decimalQuantityToScaled(value, scale);
    if (scaled == null) return null;
    total += scaled;
  }

  const divisor = 10n ** BigInt(scale);
  const whole = total / divisor;
  const fraction = (total % divisor).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function estimatedValueMinor(quantity: string, priceMinor: number) {
  const scaled = decimalQuantityToScaled(quantity);
  if (scaled == null || !Number.isSafeInteger(priceMinor)) return null;
  const value = scaled * BigInt(priceMinor) / 100_000_000n;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

export function calculateInvestmentReturn(currentMinor: number | null | undefined, costMinor: number) {
  if (currentMinor == null || !Number.isSafeInteger(currentMinor) || !Number.isSafeInteger(costMinor) || costMinor <= 0) return null;
  const gainMinor = currentMinor - costMinor;
  return { gainMinor, percent: (gainMinor / costMinor) * 100 };
}

export function unitPriceMinorFromTotal(quantity: string, totalMinor: number) {
  const scaled = decimalQuantityToScaled(quantity);
  if (scaled == null || scaled <= 0n || !Number.isSafeInteger(totalMinor) || totalMinor <= 0) return null;
  const numerator = BigInt(totalMinor) * 100_000_000n;
  const rounded = (numerator + scaled / 2n) / scaled;
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}

export function quantityFromAmountAndUnitPrice(amountMinor: number, unitPriceMinor: number, scale = 8) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor <= 0 || !Number.isInteger(scale) || scale < 0) return null;

  const divisor = 10n ** BigInt(scale);
  const scaled = (BigInt(amountMinor) * divisor + BigInt(unitPriceMinor) / 2n) / BigInt(unitPriceMinor);
  if (scaled <= 0n) return null;

  const whole = scaled / divisor;
  const fraction = (scaled % divisor).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
