import type { AppDataSnapshot, RecurringRule } from '../../types/index.ts';
import { localDateKey, nextScheduledDate, scheduledDatesBetween } from '../../utils/recurrence.ts';

type ForecastData = Pick<AppDataSnapshot, 'transactions' | 'recurringRules' | 'financialOccurrences' | 'budgets' | 'investments' | 'quotes' | 'walletSetup' | 'savingsGoals'>;

export type FinancialForecast = {
  today: string;
  horizon: string;
  nextIncome: { title: string; date: string; amountMinor: number } | null;
  upcomingBillsMinor: number;
  upcomingInvestmentsMinor: number;
  remainingBudgetMinor: number;
  reservedGoalsMinor: number;
  projectedBalanceMinor: number;
  safeToSpendMinor: number;
  commitments: { id: string; title: string; kind: RecurringRule['kind']; date: string; amountMinor: number }[];
};

export function calculateFinancialForecast(data: ForecastData, balanceMinor: number, today = localDateKey(new Date())): FinancialForecast {
  const active = data.recurringRules.filter((rule) => rule.active);
  const nextIncome = active
    .filter((rule) => rule.kind === 'income')
    .map((rule) => ({ rule, date: nextScheduledDate(rule, today) }))
    .filter((entry): entry is { rule: RecurringRule; date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const horizon = nextIncome?.date ?? endOfMonth(today);
  const futureCommitments = active
    .filter((rule) => rule.kind === 'expense' || rule.kind === 'investment')
    .flatMap((rule) => scheduledDatesBetween(rule, today, horizon).map((date) => ({ id: `${rule.id}-${date}`, title: rule.title, kind: rule.kind, date, amountMinor: rule.amountMinor })));
  const pendingCommitments = (data.financialOccurrences ?? [])
    .filter((item) => item.status === 'pending' && (item.kind === 'expense' || item.kind === 'investment') && item.dueDate <= horizon)
    .map((item) => ({ id: item.id, title: item.title, kind: item.kind, date: item.dueDate, amountMinor: item.plannedAmountMinor }));
  const commitments = [...pendingCommitments, ...futureCommitments]
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingBillsMinor = commitments.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amountMinor, 0);
  const upcomingInvestmentsMinor = commitments.filter((item) => item.kind === 'investment').reduce((sum, item) => sum + item.amountMinor, 0);
  const remainingBudgetMinor = data.budgets.filter((budget) => budget.active).reduce((sum, budget) => {
    const spent = data.transactions.filter((item) => item.type === 'expense' && isSameMonth(item.occurredAt, today) && item.category.toLocaleLowerCase() === budget.category.toLocaleLowerCase()).reduce((total, item) => total + item.amountMinor, 0);
    return sum + Math.max(0, budget.limitMinor - spent);
  }, 0);
  const reservedGoalsMinor = (data.savingsGoals ?? []).filter((goal) => goal.active).reduce((sum, goal) => sum + goal.savedMinor, 0);
  const projectedBalanceMinor = balanceMinor - upcomingBillsMinor - upcomingInvestmentsMinor - remainingBudgetMinor - reservedGoalsMinor;
  return {
    today,
    horizon,
    nextIncome: nextIncome ? { title: nextIncome.rule.title, date: nextIncome.date, amountMinor: nextIncome.rule.amountMinor } : null,
    upcomingBillsMinor,
    upcomingInvestmentsMinor,
    remainingBudgetMinor,
    reservedGoalsMinor,
    projectedBalanceMinor,
    safeToSpendMinor: Math.max(0, projectedBalanceMinor),
    commitments,
  };
}

function endOfMonth(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number);
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isSameMonth(iso: string, dateKey: string) {
  const date = new Date(iso);
  const [year, month] = dateKey.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}
