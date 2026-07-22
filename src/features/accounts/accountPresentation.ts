import type { AccountType, Transaction } from '@/types/domain';

interface AccountTransactionPresentation {
  label: string;
  sign: '+' | '−';
  explanation?: string;
  accessibleAmountEffect: string;
}

export function accountTransactionPresentation(
  accountType: AccountType,
  transaction: Pick<Transaction, 'type' | 'transferRole'>,
): AccountTransactionPresentation {
  const moneyEntersAccount =
    transaction.type === 'income' || transaction.transferRole === 'destination';

  if (accountType === 'credit-card') {
    if (transaction.type === 'expense') {
      return {
        label: 'Charge',
        sign: '+',
        explanation: 'Increases the amount owed',
        accessibleAmountEffect: 'increases amount owed by',
      };
    }
    if (transaction.transferRole === 'destination') {
      return {
        label: 'Payment',
        sign: '−',
        explanation: 'Reduces the amount owed',
        accessibleAmountEffect: 'reduces amount owed by',
      };
    }
    if (transaction.transferRole === 'source') {
      return {
        label: 'Transfer out',
        sign: '+',
        explanation: 'Increases the amount owed',
        accessibleAmountEffect: 'increases amount owed by',
      };
    }
    return {
      label: 'Credit',
      sign: '−',
      explanation: 'Reduces the amount owed',
      accessibleAmountEffect: 'reduces amount owed by',
    };
  }

  return {
    label:
      transaction.type === 'income'
        ? 'Income'
        : transaction.type === 'expense'
          ? 'Expense'
          : transaction.transferRole === 'destination'
            ? 'Transfer in'
            : 'Transfer out',
    sign: moneyEntersAccount ? '+' : '−',
    accessibleAmountEffect: moneyEntersAccount ? 'adds' : 'subtracts',
  };
}
