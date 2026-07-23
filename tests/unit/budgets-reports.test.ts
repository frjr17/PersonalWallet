import { describe, expect, it } from 'vitest';
import { computeBudgetStatus } from '@/services/budgets';
import {
  balanceTrend,
  expenseTotal,
  foldTop,
  incomeTotal,
  monthlyCashFlow,
  monthsInRange,
  savingsRate,
  totalsByCategory,
} from '@/services/reports';
import type { Account, Budget, Category, Transaction } from '@/types/domain';

let counter = 0;
function txn(partial: Partial<Transaction>): Transaction {
  counter += 1;
  return {
    id: `t${counter}`,
    type: 'expense',
    accountId: 'a1',
    amountMinor: 1000,
    currency: 'USD',
    description: 'test',
    tags: [],
    occurredAt: new Date(2026, 6, 10),
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

const budget: Budget = {
  id: 'b1',
  categoryId: 'groceries',
  period: '2026-07',
  limitMinor: 10000,
  warningThreshold: 0.8,
  rollover: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('computeBudgetStatus', () => {
  it('counts only expenses in the budget category', () => {
    const status = computeBudgetStatus(budget, [
      txn({ categoryId: 'groceries', amountMinor: 3000 }),
      txn({ categoryId: 'groceries', amountMinor: 2000 }),
      txn({ categoryId: 'other', amountMinor: 5000 }),
      txn({ type: 'income', categoryId: 'groceries', amountMinor: 9000 }),
      txn({ type: 'transfer', destinationAccountId: 'a2', amountMinor: 9000 }),
    ]);
    expect(status.spentMinor).toBe(5000);
    expect(status.remainingMinor).toBe(5000);
    expect(status.ratio).toBe(0.5);
    expect(status.state).toBe('ok');
  });

  it('warns at the threshold and flags exceeded budgets', () => {
    expect(
      computeBudgetStatus(budget, [txn({ categoryId: 'groceries', amountMinor: 8000 })]).state,
    ).toBe('warning');
    expect(
      computeBudgetStatus(budget, [txn({ categoryId: 'groceries', amountMinor: 12000 })]).state,
    ).toBe('exceeded');
  });
});

describe('report aggregations', () => {
  const july = new Date(2026, 6, 15);
  const august = new Date(2026, 7, 3);
  const data = [
    txn({ type: 'income', amountMinor: 50000, occurredAt: july }),
    txn({ type: 'expense', amountMinor: 20000, occurredAt: july, categoryId: 'rent' }),
    txn({ type: 'expense', amountMinor: 5000, occurredAt: august, categoryId: 'food' }),
    txn({
      type: 'transfer',
      amountMinor: 99999,
      occurredAt: july,
      destinationAccountId: 'a2',
      transferId: 'x',
    }),
  ];

  it('builds monthly cash flow without transfers', () => {
    expect(monthlyCashFlow(data)).toEqual([
      { month: '2026-07', incomeMinor: 50000, expenseMinor: 20000, netMinor: 30000 },
      { month: '2026-08', incomeMinor: 0, expenseMinor: 5000, netMinor: -5000 },
    ]);
  });

  it('sums income and expenses excluding transfers', () => {
    expect(incomeTotal(data)).toBe(50000);
    expect(expenseTotal(data)).toBe(25000);
  });

  it('computes savings rate from income', () => {
    expect(savingsRate(data)).toBe(0.5);
    expect(savingsRate([])).toBe(0);
  });

  it('totals by category with uncategorized fallback', () => {
    const categories: Category[] = [
      {
        id: 'rent',
        name: 'Housing',
        type: 'expense',
        icon: 'housing',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const totals = totalsByCategory(data, categories, 'expense');
    expect(totals[0]).toMatchObject({ name: 'Housing', totalMinor: 20000 });
    expect(totals[1]).toMatchObject({ name: 'Uncategorized', totalMinor: 5000 });
  });

  it('folds the tail into Other', () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      name: `c${index}`,
      totalMinor: 700 - index * 100,
    }));
    const folded = foldTop(items, 5);
    expect(folded).toHaveLength(6);
    expect(folded[5]).toEqual({ name: 'Other', totalMinor: 300, isOther: true });
    expect(foldTop(items.slice(0, 4), 5)).toHaveLength(4);
  });

  it('lists months in a range inclusively', () => {
    expect(monthsInRange(new Date(2026, 4, 20), new Date(2026, 6, 2))).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
  });

  it('walks account balances backward through history', () => {
    const account: Account = {
      id: 'a1',
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingBalanceMinor: 0,
      currentBalanceMinor: 25000,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // current 25000 ← august expense 5000 ← july net +30000
    const points = balanceTrend(
      [account],
      data.filter((entry) => entry.type !== 'transfer'),
      ['2026-06', '2026-07', '2026-08'],
    );
    expect(points).toEqual([
      { month: '2026-06', balances: { a1: 0 } },
      { month: '2026-07', balances: { a1: 30000 } },
      { month: '2026-08', balances: { a1: 25000 } },
    ]);
  });
});
