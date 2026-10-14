import type { AppDataSnapshot, PaymentCard, ThoughtItem } from '../../types/index.ts';
import { reminderOccurrencesBetween } from '../../utils/reminders.ts';
import { localDateKey, scheduledDatesBetween } from '../../utils/recurrence.ts';
import { creditUtilization, nextDueDate, summarizeCards } from '../wallet/cards.ts';

type ReviewData = Pick<AppDataSnapshot, 'items' | 'transactions' | 'budgets' | 'savingsGoals' | 'goalSuggestions' | 'projects' | 'projectSessions' | 'recurringRules' | 'cards' | 'activity'>;

export type AheadEntry = { kind: 'task' | 'reminder' | 'bill' | 'income' | 'investment' | 'card'; title: string; date: Date; amountMinor?: number; id?: string };

export type WeeklyReview = {
  start: Date;
  end: Date;
  label: string;
  alreadyReviewed: boolean;
  tasks: { completed: number; completedTitles: string[]; overdue: ThoughtItem[] };
  money: {
    spentMinor: number;
    incomeMinor: number;
    previousSpentMinor: number;
    /** Change against the week before, as a fraction; null when there is nothing to compare. */
    spentChange: number | null;
    topCategories: { category: string; amountMinor: number }[];
  };
  budgets: { category: string; spentMinor: number; limitMinor: number; ratio: number }[];
  goals: { name: string; savedMinor: number; targetMinor: number; reservedThisWeekMinor: number }[];
  cards: { owedMinor: number; highUsage: PaymentCard[]; count: number };
  projects: { updates: number; stalled: { id: string; name: string; days: number }[] };
  ahead: AheadEntry[];
};

const DAY = 86_400_000;

/**
 * The last seven days ending today, compared with the seven before, and the
 * seven days ahead. Everything is read from confirmed records only.
 */
export function buildWeeklyReview(data: ReviewData, now = new Date()): WeeklyReview {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const end = now;
  const previousStart = new Date(start.getTime() - 7 * DAY);
  const inRange = (iso: string | undefined, from: Date, to: Date) => {
    if (!iso) return false;
    const time = Date.parse(iso);
    return !Number.isNaN(time) && time >= from.getTime() && time <= to.getTime();
  };
  const thisWeek = (iso?: string) => inRange(iso, start, end);

  // A task completed, undone, and completed again is one task; one undone since does not count.
  const itemsById = new Map(data.items.map((item) => [item.id, item]));
  const completedIds = new Set(data.activity.filter((event) => event.kind === 'item_completed' && thisWeek(event.createdAt) && event.sourceId && itemsById.get(event.sourceId)?.completed).map((event) => event.sourceId!));
  const completedTitles = [...completedIds].map((id) => itemsById.get(id)!.title);
  const overdue = data.items
    .filter((item) => item.category === 'task' && !item.completed && item.dueAt && Date.parse(item.dueAt) < now.getTime())
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));

  const spentIn = (from: Date, to: Date) => data.transactions.filter((item) => item.type === 'expense' && inRange(item.occurredAt, from, to)).reduce((sum, item) => sum + item.amountMinor, 0);
  const spentMinor = spentIn(start, end);
  const previousSpentMinor = spentIn(previousStart, new Date(start.getTime() - 1));
  const incomeMinor = data.transactions.filter((item) => item.type === 'income' && thisWeek(item.occurredAt)).reduce((sum, item) => sum + item.amountMinor, 0);
  const byCategory = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.type !== 'expense' || !thisWeek(item.occurredAt)) continue;
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amountMinor);
  }
  const topCategories = [...byCategory].map(([category, amountMinor]) => ({ category, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 4);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgets = data.budgets.filter((budget) => budget.active && budget.limitMinor > 0).map((budget) => {
    const key = budget.category.toLocaleLowerCase();
    const spent = data.transactions.filter((item) => item.type === 'expense' && item.category.toLocaleLowerCase() === key && inRange(item.occurredAt, monthStart, end)).reduce((sum, item) => sum + item.amountMinor, 0);
    return { category: budget.category, spentMinor: spent, limitMinor: budget.limitMinor, ratio: spent / budget.limitMinor };
  }).sort((a, b) => b.ratio - a.ratio);

  const goals = data.savingsGoals.filter((goal) => goal.active).map((goal) => ({
    name: goal.name,
    savedMinor: goal.savedMinor,
    targetMinor: goal.targetMinor,
    reservedThisWeekMinor: data.goalSuggestions.filter((suggestion) => suggestion.goalId === goal.id && suggestion.status === 'confirmed' && thisWeek(suggestion.resolvedAt)).reduce((sum, suggestion) => sum + suggestion.amountMinor, 0),
  }));

  const cardTotals = summarizeCards(data.cards);
  const highUsage = data.cards.filter((card) => (creditUtilization(card) ?? 0) > 0.3);

  const activeProjects = data.projects.filter((project) => project.status === 'active');
  const updates = data.projectSessions.filter((session) => thisWeek(session.createdAt)).length;
  const stalled = activeProjects
    .map((project) => ({ id: project.id, name: project.name, days: Math.floor((now.getTime() - Date.parse(project.updatedAt)) / DAY) }))
    .filter((project) => project.days >= 14)
    .sort((a, b) => b.days - a.days);

  const aheadEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  const ahead: AheadEntry[] = [];
  for (const item of data.items) {
    if (item.completed) continue;
    if (item.category === 'reminder' && item.reminderEnabled !== false) {
      for (const date of reminderOccurrencesBetween(item, now, aheadEnd).slice(0, 3)) ahead.push({ kind: 'reminder', title: item.title, date, id: item.id });
    } else if (item.category === 'task' && item.dueAt) {
      const date = new Date(item.dueAt);
      if (date >= now && date < aheadEnd) ahead.push({ kind: 'task', title: item.title, date, id: item.id });
    }
  }
  const todayKey = localDateKey(new Date(now.getTime() - DAY));
  const throughKey = localDateKey(new Date(aheadEnd.getTime() - DAY));
  for (const rule of data.recurringRules) {
    if (!rule.active) continue;
    for (const key of scheduledDatesBetween(rule, todayKey, throughKey)) {
      const [year, month, day] = key.split('-').map(Number);
      ahead.push({ kind: rule.kind === 'expense' ? 'bill' : rule.kind, title: rule.title, date: new Date(year, month - 1, day, 9), amountMinor: rule.amountMinor });
    }
  }
  for (const card of data.cards) {
    if (card.kind !== 'credit' || card.balanceMinor <= 0) continue;
    const due = nextDueDate(card.dueDay, now);
    if (due && due < aheadEnd) ahead.push({ kind: 'card', title: `${card.name} payment`, date: due, amountMinor: card.balanceMinor, id: card.id });
  }
  ahead.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    start,
    end,
    label: weekLabel(start, end),
    alreadyReviewed: data.activity.some((event) => event.kind === 'weekly_review' && thisWeek(event.createdAt)),
    tasks: { completed: completedIds.size, completedTitles, overdue },
    money: { spentMinor, incomeMinor, previousSpentMinor, spentChange: previousSpentMinor > 0 ? (spentMinor - previousSpentMinor) / previousSpentMinor : null, topCategories },
    budgets,
    goals,
    cards: { owedMinor: cardTotals.creditOwedMinor, highUsage, count: data.cards.length },
    projects: { updates, stalled },
    ahead,
  };
}

/** Whether to nudge for a review on Home: weekends and Monday, until this week's is done. */
export function weeklyReviewDue(data: Pick<AppDataSnapshot, 'activity'>, now = new Date()) {
  const day = now.getDay();
  if (day !== 0 && day !== 6 && day !== 1) return false;
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  return !data.activity.some((event) => event.kind === 'weekly_review' && Date.parse(event.createdAt) >= since);
}

function weekLabel(start: Date, end: Date) {
  const month = new Intl.DateTimeFormat('en-PH', { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month.format(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month.format(start)} ${start.getDate()} – ${month.format(end)} ${end.getDate()}`;
}
