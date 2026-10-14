import type { PaymentCard, PaymentCardNetwork } from '../../types/index.ts';

/** Card face colors. Fixed rather than themed: a card looks the same in light and dark mode, like the real one. */
export const CARD_COLORS = {
  midnight: '#17181C',
  ocean: '#1D4ED8',
  teal: '#0F766E',
  forest: '#166534',
  gold: '#9A5B06',
  crimson: '#B42318',
  rose: '#BE185D',
  slate: '#475569',
} as const;
export type CardColor = keyof typeof CARD_COLORS;

export const CARD_NETWORKS: { value: PaymentCardNetwork; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'Amex' },
  { value: 'jcb', label: 'JCB' },
  { value: 'unionpay', label: 'UnionPay' },
  { value: 'other', label: 'Other' },
];

export function cardColor(card: Pick<PaymentCard, 'color'>) {
  return CARD_COLORS[card.color as CardColor] ?? CARD_COLORS.midnight;
}

export function networkLabel(network?: PaymentCardNetwork) {
  return CARD_NETWORKS.find((entry) => entry.value === network)?.label ?? null;
}

/** Keeps only digits and at most the final four, so a pasted full number is never kept. */
export function normalizeLast4(value: string) {
  return value.replace(/\D/g, '').slice(-4);
}

/** Reads "MM/YY", "MM/YYYY", or "MMYY". Returns null for anything else. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^\s*(\d{1,2})\s*\/?\s*(\d{2}|\d{4})\s*$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { month, year };
}

export function formatExpiry(month?: number, year?: number) {
  if (!month || !year) return null;
  return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
}

/** A card is valid through the last day of its expiry month. */
export function expiryStatus(card: Pick<PaymentCard, 'expiryMonth' | 'expiryYear'>, now = new Date()): 'expired' | 'soon' | 'ok' | null {
  if (!card.expiryMonth || !card.expiryYear) return null;
  const lastValidDay = new Date(card.expiryYear, card.expiryMonth, 0, 23, 59, 59);
  if (lastValidDay < now) return 'expired';
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 60);
  return lastValidDay <= soon ? 'soon' : 'ok';
}

/** Limit minus owed. Negative means the card is over its limit. */
export function availableCreditMinor(card: Pick<PaymentCard, 'kind' | 'balanceMinor' | 'creditLimitMinor'>) {
  if (card.kind !== 'credit' || card.creditLimitMinor == null) return null;
  return card.creditLimitMinor - card.balanceMinor;
}

/** Share of the limit in use, from 0 upward; above 1 means over the limit. */
export function creditUtilization(card: Pick<PaymentCard, 'kind' | 'balanceMinor' | 'creditLimitMinor'>) {
  if (card.kind !== 'credit' || !card.creditLimitMinor) return null;
  return card.balanceMinor / card.creditLimitMinor;
}

/**
 * The next payment due date on or after today. A due day past the end of a
 * short month falls on that month's last day, as banks do.
 */
export function nextDueDate(dueDay: number | undefined, today = new Date()) {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let offset = 0; offset < 2; offset += 1) {
    const year = start.getFullYear();
    const month = start.getMonth() + offset;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(dueDay, lastDay));
    if (candidate >= start) return candidate;
  }
  return null;
}

export function daysUntil(date: Date, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function summarizeCards(cards: PaymentCard[]) {
  const debit = cards.filter((card) => card.kind === 'debit');
  const credit = cards.filter((card) => card.kind === 'credit');
  const limited = credit.filter((card) => card.creditLimitMinor != null);
  return {
    debitCount: debit.length,
    creditCount: credit.length,
    debitBalanceMinor: debit.reduce((sum, card) => sum + card.balanceMinor, 0),
    creditOwedMinor: credit.reduce((sum, card) => sum + card.balanceMinor, 0),
    creditLimitMinor: limited.reduce((sum, card) => sum + (card.creditLimitMinor ?? 0), 0),
    availableCreditMinor: limited.reduce((sum, card) => sum + Math.max(0, availableCreditMinor(card) ?? 0), 0),
  };
}

/** Credit cards with something owed, soonest due first. Cards without a due day go last. */
export function upcomingCardPayments(cards: PaymentCard[], today = new Date()) {
  return cards
    .filter((card) => card.kind === 'credit' && card.balanceMinor > 0)
    .map((card) => ({ card, due: nextDueDate(card.dueDay, today) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
}
