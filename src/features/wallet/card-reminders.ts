import type { PaymentCard } from '../../types/index.ts';
import { formatPeso } from '../../utils/money.ts';
import { nextDueDate } from './cards.ts';

/** Every scheduled card reminder uses this prefix, so a resync can find and replace them all. */
export const CARD_REMINDER_PREFIX = 'lifedesk-card-due-';
export const CARD_REMINDER_HOUR = 9;
const LEAD_DAYS = [3, 0];

export type CardReminder = { identifier: string; cardId: string; date: Date; title: string; body: string };

/**
 * The payment reminders to schedule right now: 3 days before and on the due
 * day, at 9 AM, for each credit card that has something owed. Times already
 * past are skipped. The plan is rebuilt whenever cards change, so only the next
 * due date is scheduled; next month's is added once this one has passed.
 */
export function planCardReminders(cards: PaymentCard[], now = new Date(), options: { showAmounts: boolean } = { showAmounts: true }): CardReminder[] {
  const reminders: CardReminder[] = [];
  for (const card of cards) {
    if (card.kind !== 'credit' || card.balanceMinor <= 0 || !card.dueDay) continue;
    // Look from the start of today so a due date later today still counts.
    let due = nextDueDate(card.dueDay, now);
    // Today's due-day reminder has already fired once 9 AM has passed; plan next month's instead.
    if (due && atReminderTime(due, 0) <= now) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      due = nextDueDate(card.dueDay, tomorrow);
    }
    if (!due) continue;
    const dueKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    for (const lead of LEAD_DAYS) {
      const date = atReminderTime(due, lead);
      if (date <= now) continue;
      const amount = options.showAmounts ? `${formatPeso(card.balanceMinor)} ` : '';
      reminders.push({
        identifier: `${CARD_REMINDER_PREFIX}${card.id}-${dueKey}-${lead}`,
        cardId: card.id,
        date,
        title: lead === 0 ? `${card.name} payment due today` : `${card.name} payment due in ${lead} days`,
        body: `${amount}${options.showAmounts ? 'owed' : 'Payment'} · due ${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(due)}${card.last4 ? ` · card ending ${card.last4}` : ''}`,
      });
    }
  }
  return reminders.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function atReminderTime(due: Date, leadDays: number) {
  return new Date(due.getFullYear(), due.getMonth(), due.getDate() - leadDays, CARD_REMINDER_HOUR, 0, 0, 0);
}
