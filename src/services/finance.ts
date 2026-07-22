import type { Account, Budget, Transaction } from '@/types/domain';
import { percentage, sumMinor } from '@/lib/money';
export function transactionEffect(
  tx: Pick<Transaction, 'type' | 'amountMinor' | 'transferRole'>,
): number {
  if (tx.type === 'income' || tx.transferRole === 'destination') return tx.amountMinor;
  return -tx.amountMinor;
}
export function reverseEffect(
  tx: Pick<Transaction, 'type' | 'amountMinor' | 'transferRole'>,
): number {
  return -transactionEffect(tx);
}
export function accountBalance(opening: number, transactions: readonly Transaction[]): number {
  return sumMinor([opening, ...transactions.map(transactionEffect)]);
}
export function dashboardMetrics(transactions: readonly Transaction[]) {
  const income = sumMinor(
    transactions.filter((t) => t.type === 'income').map((t) => t.amountMinor),
  );
  const expenses = sumMinor(
    transactions.filter((t) => t.type === 'expense').map((t) => t.amountMinor),
  );
  return {
    income,
    expenses,
    net: income - expenses,
    savingsRate: income ? percentage(income - expenses, income) : 0,
  };
}
export function budgetStatus(budget: Budget, spent: number, carry = 0) {
  const effectiveLimit = budget.limitMinor + (budget.rollover ? Math.max(0, carry) : 0);
  const usage = percentage(spent, effectiveLimit);
  return {
    spent,
    effectiveLimit,
    remaining: effectiveLimit - spent,
    usage,
    state:
      spent > effectiveLimit
        ? 'exceeded'
        : usage >= budget.warningThreshold * 100
          ? 'warning'
          : 'ok',
  } as const;
}
export function recalculatePreview(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
) {
  return accounts.map((account) => {
    const expected = accountBalance(
      account.openingBalanceMinor,
      transactions.filter((t) => t.accountId === account.id),
    );
    return { account, expected, difference: expected - account.currentBalanceMinor };
  });
}

export function accountBalanceView(account: Account) {
  if (account.type !== 'credit-card') {
    return {
      label: 'Current balance',
      primaryMinor: account.currentBalanceMinor,
      owedMinor: undefined,
      availableMinor: undefined,
    };
  }
  const owedMinor = Math.max(0, -account.currentBalanceMinor);
  return {
    label: owedMinor > 0 ? 'Amount owed' : 'Credit balance',
    primaryMinor: owedMinor > 0 ? owedMinor : account.currentBalanceMinor,
    owedMinor,
    availableMinor:
      account.creditLimitMinor === undefined
        ? undefined
        : account.creditLimitMinor + account.currentBalanceMinor,
  };
}
