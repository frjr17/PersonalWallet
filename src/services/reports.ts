import { sumMinor } from '@/lib/money';
import { monthKey } from '@/lib/dates';
import { legEffect } from '@/lib/ledger';
import type { Account, Category, Transaction } from '@/types/domain';

/**
 * Pure aggregations over an already-fetched transaction range.
 * Transfers never count as income or expense anywhere in here.
 */

export interface MonthlyFlow {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export function monthlyCashFlow(transactions: Transaction[]): MonthlyFlow[] {
  const months = new Map<string, { incomeMinor: number; expenseMinor: number }>();
  for (const txn of transactions) {
    if (txn.type === 'transfer') continue;
    const key = monthKey(txn.occurredAt);
    const entry = months.get(key) ?? { incomeMinor: 0, expenseMinor: 0 };
    if (txn.type === 'income') entry.incomeMinor += txn.amountMinor;
    else entry.expenseMinor += txn.amountMinor;
    months.set(key, entry);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => ({
      month,
      ...entry,
      netMinor: entry.incomeMinor - entry.expenseMinor,
    }));
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  totalMinor: number;
}

export function totalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  type: 'income' | 'expense',
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const txn of transactions) {
    if (txn.type !== type) continue;
    const key = txn.categoryId ?? 'uncategorized';
    totals.set(key, (totals.get(key) ?? 0) + txn.amountMinor);
  }
  return [...totals.entries()]
    .map(([categoryId, totalMinor]) => {
      const category = categories.find((candidate) => candidate.id === categoryId);
      return {
        categoryId,
        name: category?.name ?? 'Uncategorized',
        icon: category?.icon ?? 'other',
        totalMinor,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

/** Top N slots for a chart; the rest folds into "Other" (never a 6th hue). */
export function foldTop<T extends { totalMinor: number; name: string }>(
  items: T[],
  slots: number,
): { name: string; totalMinor: number; isOther?: boolean }[] {
  if (items.length <= slots) return items;
  const top = items.slice(0, slots);
  const restMinor = sumMinor(items.slice(slots).map((item) => item.totalMinor));
  return [...top, { name: 'Other', totalMinor: restMinor, isOther: true }];
}

export function incomeTotal(transactions: Transaction[]): number {
  return sumMinor(
    transactions.filter((txn) => txn.type === 'income').map((txn) => txn.amountMinor),
  );
}

export function expenseTotal(transactions: Transaction[]): number {
  return sumMinor(
    transactions.filter((txn) => txn.type === 'expense').map((txn) => txn.amountMinor),
  );
}

/** Net savings rate as a ratio of income (0 when there is no income). */
export function savingsRate(transactions: Transaction[]): number {
  const income = incomeTotal(transactions);
  if (income <= 0) return 0;
  return (income - expenseTotal(transactions)) / income;
}

export interface BalancePoint {
  month: string;
  balances: Record<string, number>;
}

/**
 * End-of-month balance per account, walking backward from current balances.
 * `transactions` must cover from `months[0]` through today for exact figures.
 */
export function balanceTrend(
  accounts: Account[],
  transactions: Transaction[],
  months: string[],
): BalancePoint[] {
  const running = new Map(accounts.map((account) => [account.id, account.currentBalanceMinor]));
  const sorted = [...transactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const points: BalancePoint[] = [];
  let cursor = 0;
  for (const month of [...months].sort().reverse()) {
    // Rewind all transactions that happened after this month's end.
    while (cursor < sorted.length && monthKey(sorted[cursor]!.occurredAt) > month) {
      const txn = sorted[cursor]!;
      if (running.has(txn.accountId)) {
        running.set(txn.accountId, running.get(txn.accountId)! - legEffect(txn));
      }
      cursor += 1;
    }
    points.push({ month, balances: Object.fromEntries(running) });
  }
  return points.reverse();
}

/** Month keys covering [start, end], inclusive. */
export function monthsInRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
