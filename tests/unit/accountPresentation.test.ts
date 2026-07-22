import { describe, expect, it } from 'vitest';
import { accountTransactionPresentation } from '@/features/accounts/accountPresentation';

describe('account transaction presentation', () => {
  it.each([
    [{ type: 'expense' as const }, 'Charge', '+', 'increases amount owed by'],
    [
      { type: 'transfer' as const, transferRole: 'destination' as const },
      'Payment',
      '−',
      'reduces amount owed by',
    ],
    [
      { type: 'transfer' as const, transferRole: 'source' as const },
      'Transfer out',
      '+',
      'increases amount owed by',
    ],
    [{ type: 'income' as const }, 'Credit', '−', 'reduces amount owed by'],
  ])('describes credit-card liability effects for %#', (transaction, label, sign, effect) => {
    expect(accountTransactionPresentation('credit-card', transaction)).toMatchObject({
      label,
      sign,
      accessibleAmountEffect: effect,
    });
  });

  it('keeps asset-account signs balance-facing', () => {
    expect(accountTransactionPresentation('savings', { type: 'expense' })).toMatchObject({
      label: 'Expense',
      sign: '−',
      accessibleAmountEffect: 'subtracts',
    });
    expect(
      accountTransactionPresentation('savings', {
        type: 'transfer',
        transferRole: 'destination',
      }),
    ).toMatchObject({ label: 'Transfer in', sign: '+', accessibleAmountEffect: 'adds' });
  });
});
