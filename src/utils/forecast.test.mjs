import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinancialForecast } from '../features/wallet/financial-forecast.ts';

const base = { transactions: [], investments: [], quotes: [], budgets: [], savingsGoals: [], financialOccurrences: [], walletSetup: undefined };
const rule = (overrides) => ({ id: Math.random().toString(), kind: 'expense', title: 'Internet', category: 'Bills', amountMinor: 150000, days: [15], active: true, startsOn: '2026-01-01', createdAt: '', updatedAt: '', ...overrides });

test('reserves bills, investments, and remaining monthly budgets before next income', () => {
  const result = calculateFinancialForecast({ ...base, budgets: [{ id: 'b', category: 'Groceries', limitMinor: 500000, active: true, createdAt: '', updatedAt: '' }], recurringRules: [rule({ id: 'income', kind: 'income', amountMinor: 1000000, days: [30] }), rule({ id: 'bill', amountMinor: 150000, days: [28] }), rule({ id: 'investment', kind: 'investment', amountMinor: 200000, days: [29], asset: 'VOO', quantity: '0.04' })] }, 2000000, '2026-08-25');
  assert.equal(result.horizon, '2026-08-30');
  assert.equal(result.upcomingBillsMinor, 150000);
  assert.equal(result.upcomingInvestmentsMinor, 200000);
  assert.equal(result.remainingBudgetMinor, 500000);
  assert.equal(result.safeToSpendMinor, 1150000);
});

test('never reports a negative safe-to-spend amount', () => {
  const result = calculateFinancialForecast({ ...base, recurringRules: [rule({ amountMinor: 300000, days: [26] })] }, 100000, '2026-08-25');
  assert.equal(result.projectedBalanceMinor, -200000);
  assert.equal(result.safeToSpendMinor, 0);
});

test('reserves savings goals without changing the wallet balance', () => {
  const result = calculateFinancialForecast({ ...base, recurringRules: [], savingsGoals: [{ id: 'goal', name: 'Emergency fund', targetMinor: 1000000, savedMinor: 250000, paydayContributionMinor: 0, active: true, createdAt: '', updatedAt: '' }] }, 900000, '2026-08-25');
  assert.equal(result.reservedGoalsMinor, 250000);
  assert.equal(result.safeToSpendMinor, 650000);
});

test('reserves pending review items before they change the wallet', () => {
  const occurrence = { id: 'occurrence', ruleId: 'bill', kind: 'expense', title: 'Internet', category: 'Bills', plannedAmountMinor: 169900, scheduledDate: '2026-08-24', dueDate: '2026-08-26', status: 'pending', createdAt: '', updatedAt: '' };
  const result = calculateFinancialForecast({ ...base, recurringRules: [], financialOccurrences: [occurrence] }, 500000, '2026-08-25');
  assert.equal(result.upcomingBillsMinor, 169900);
  assert.equal(result.safeToSpendMinor, 330100);
});
