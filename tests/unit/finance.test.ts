import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  accountBalanceView,
  budgetStatus,
  dashboardMetrics,
  reverseEffect,
  transactionEffect,
} from '@/services/finance';
import type { Budget, Transaction } from '@/types/domain';
const tx = (value: Partial<Transaction>): Transaction => ({
  id: 't',
  type: 'expense',
  accountId: 'a',
  categoryId: 'c',
  amountMinor: 100,
  currency: 'USD',
  description: 'x',
  tags: [],
  occurredAt: new Date(),
  source: 'manual',
  fingerprint: 'f',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...value,
});
describe('financial effects', () => {
  it('applies and reverses all transaction directions', () => {
    expect(transactionEffect(tx({ type: 'income' }))).toBe(100);
    expect(transactionEffect(tx({ type: 'expense' }))).toBe(-100);
    expect(transactionEffect(tx({ type: 'transfer', transferRole: 'destination' }))).toBe(100);
    expect(reverseEffect(tx({ type: 'expense' }))).toBe(100);
  });
  it('recalculates balances', () =>
    expect(
      accountBalance(1000, [tx({ type: 'income', amountMinor: 500 }), tx({ amountMinor: 200 })]),
    ).toBe(1300));
  it('excludes transfers from cash flow', () =>
    expect(
      dashboardMetrics([
        tx({ type: 'income', amountMinor: 500 }),
        tx({ type: 'expense', amountMinor: 200 }),
        tx({ type: 'transfer', amountMinor: 999 }),
      ]),
    ).toEqual({ income: 500, expenses: 200, net: 300, savingsRate: 60 }));
  it('reports budget thresholds and positive rollover', () => {
    const b = { limitMinor: 1000, warningThreshold: 0.8, rollover: true } as Budget;
    expect(budgetStatus(b, 1000, 200)).toMatchObject({
      effectiveLimit: 1200,
      remaining: 200,
      state: 'warning',
    });
  });
  it('presents credit cards as liabilities with available credit', () => {
    expect(
      accountBalanceView({
        id: 'card',
        name: 'Card',
        type: 'credit-card',
        currency: 'USD',
        openingBalanceMinor: -20_000,
        currentBalanceMinor: -25_000,
        creditLimitMinor: 100_000,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toMatchObject({
      label: 'Amount owed',
      primaryMinor: 25_000,
      owedMinor: 25_000,
      availableMinor: 75_000,
    });
  });
});
