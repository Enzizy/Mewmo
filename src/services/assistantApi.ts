import { AppDataSnapshot } from '@/types';
import { calculateFinancialForecast } from '@/features/wallet/financial-forecast';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { getOrganizerApiHeaders, getOrganizerApiUrl } from './organizerApi';
import { loadSavedWeather } from './weather';

export type AssistantMessage = { role: 'user' | 'assistant'; text: string };

export async function askPersonalAssistant(message: string, history: AssistantMessage[], data: AppDataSnapshot) {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('Add EXPO_PUBLIC_MEWMO_API_URL before using the assistant.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${apiUrl}/chat`, {
      method: 'POST',
      headers: getOrganizerApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, history: history.slice(-8), context: await assistantContext(data) }),
      signal: controller.signal,
    });
    const body = await response.json() as { answer?: string; error?: string };
    if (!response.ok || !body.answer) throw new Error(body.error || 'The assistant could not answer.');
    return body.answer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The assistant took too long to answer. Try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function assistantContext(data: AppDataSnapshot) {
  const wallet = getWalletSummary(data);
  const forecast = calculateFinancialForecast(data, wallet.balance);
  const weather = await loadSavedWeather({ refresh: false });
  return {
    generatedAt: new Date().toISOString(),
    currencyStorage: 'All money fields ending in Minor are PHP centavos: 100 means ₱1.00.',
    tasksAndNotes: data.items.slice(0, 150).map(({ id, category, title, detail, dueAt, completed, reminderEnabled, recurrence, subtasks }) => ({ id, category, title, detail, dueAt, completed, reminderEnabled, recurrence, subtasks })),
    projects: data.projects.slice(0, 100),
    projectSessions: data.projectSessions.slice(0, 100),
    transactions: data.transactions.slice(0, 300),
    investments: data.investments.slice(0, 300),
    marketQuotes: data.quotes,
    recurringSchedules: data.recurringRules.map(({ quantity: _legacyQuantity, ...rule }) => ({
      ...rule,
      investmentQuantityCalculation: rule.kind === 'investment' ? 'Fractional quantity is calculated from amountMinor and the latest available market quote when the due entry is processed.' : undefined,
    })),
    monthlyBudgets: data.budgets,
    wallet: {
      trackingStart: wallet.walletSetup,
      availableBalanceMinor: wallet.balance,
      thisMonthIncomeMinor: wallet.income,
      thisMonthOutMinor: wallet.spent,
      recordedInvestmentCostMinor: wallet.recordedInvestments,
      estimatedPortfolioValueMinor: wallet.portfolio,
      positions: wallet.positions,
    },
    forecast: {
      safeToSpendMinor: forecast.safeToSpendMinor,
      projectedBalanceMinor: forecast.projectedBalanceMinor,
      through: forecast.horizon,
      nextIncome: forecast.nextIncome,
      upcomingBillsMinor: forecast.upcomingBillsMinor,
      upcomingInvestmentsMinor: forecast.upcomingInvestmentsMinor,
      remainingBudgetMinor: forecast.remainingBudgetMinor,
      commitments: forecast.commitments.slice(0, 100),
    },
    appCapabilities: {
      calendar: 'Tasks and reminders can have dates, notifications, and daily, weekly, monthly, or yearly recurrence.',
      finance: 'Wallet tracks cash, activity, BTC/VOO holdings, live or manual quotes, budgets, salary/investment automations, subscriptions and recurring bills, and safe-to-spend forecasts.',
      capture: 'Voice Capture can propose tasks, reminders, notes, projects, income, expenses, and investments for user confirmation.',
      tools: ['Weather forecast', 'Image conversion, compression, and resizing', 'PDF creation, merging, page extraction, and reordering', 'Currency conversion', 'Unit conversion', 'AR camera measurement'],
    },
    weather: weather.forecast,
  };
}
