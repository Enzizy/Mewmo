import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinancialForecast } from '../features/wallet/financial-forecast.ts';

const base = { transactions: [], investments: [], quotes: [], budgets: [], walletSetup: undefined };
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
