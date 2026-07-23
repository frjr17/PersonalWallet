import { sumMinor, usageRatio } from '@/lib/money';
import type { Budget, Transaction } from '@/types/domain';

export type BudgetState = 'ok' | 'warning' | 'exceeded';

export interface BudgetStatus {
  budget: Budget;
  spentMinor: number;
  remainingMinor: number;
  ratio: number;
  state: BudgetState;
}

/**
 * Budget usage for one month. Counts only expense transactions in the budget's
 * category — transfers and income never touch a budget.
 */
export function computeBudgetStatus(
  budget: Budget,
  monthTransactions: Transaction[],
): BudgetStatus {
  const spentMinor = sumMinor(
    monthTransactions
      .filter((txn) => txn.type === 'expense' && txn.categoryId === budget.categoryId)
      .map((txn) => txn.amountMinor),
  );
  const ratio = usageRatio(spentMinor, budget.limitMinor);
  const state: BudgetState =
    ratio >= 1 ? 'exceeded' : ratio >= budget.warningThreshold ? 'warning' : 'ok';
  return {
    budget,
    spentMinor,
    remainingMinor: budget.limitMinor - spentMinor,
    ratio,
    state,
  };
}
