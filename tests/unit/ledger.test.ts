import { describe, expect, it } from 'vitest';
import {
  createEntryDeltas,
  createTransferDeltas,
  deleteDeltas,
  editEntryDeltas,
  editTransferDeltas,
  legEffect,
} from '@/lib/ledger';

describe('legEffect', () => {
  it('credits income and debits expense documents', () => {
    expect(legEffect({ type: 'income', amountMinor: 900 })).toBe(900);
    expect(legEffect({ type: 'expense', amountMinor: 900 })).toBe(-900);
  });

  it('reads transfer direction from destinationAccountId presence', () => {
    expect(legEffect({ type: 'transfer', amountMinor: 500, destinationAccountId: 'b' })).toBe(-500);
    expect(legEffect({ type: 'transfer', amountMinor: 500 })).toBe(500);
  });
});

describe('entry deltas', () => {
  it('creates a single credit or debit', () => {
    expect(createEntryDeltas({ type: 'income', accountId: 'a', amountMinor: 1000 })).toEqual(
      new Map([['a', 1000]]),
    );
    expect(createEntryDeltas({ type: 'expense', accountId: 'a', amountMinor: 1000 })).toEqual(
      new Map([['a', -1000]]),
    );
  });

  it('edit reverses the original and applies the new amount on the same account', () => {
    const original = { type: 'expense' as const, accountId: 'a', amountMinor: 1000 };
    // was -1000, becomes -1500 → net -500
    expect(
      editEntryDeltas(original, { type: 'expense', accountId: 'a', amountMinor: 1500 }),
    ).toEqual(new Map([['a', -500]]));
  });

  it('edit moves the effect when the account changes', () => {
    const original = { type: 'expense' as const, accountId: 'a', amountMinor: 1000 };
    expect(
      editEntryDeltas(original, { type: 'expense', accountId: 'b', amountMinor: 1000 }),
    ).toEqual(
      new Map([
        ['a', 1000],
        ['b', -1000],
      ]),
    );
  });

  it('edit flipping income to expense reverses the sign fully', () => {
    const original = { type: 'income' as const, accountId: 'a', amountMinor: 1000 };
    expect(
      editEntryDeltas(original, { type: 'expense', accountId: 'a', amountMinor: 1000 }),
    ).toEqual(new Map([['a', -2000]]));
  });

  it('an unchanged edit produces no writes', () => {
    const original = { type: 'expense' as const, accountId: 'a', amountMinor: 1000 };
    expect(
      editEntryDeltas(original, { type: 'expense', accountId: 'a', amountMinor: 1000 }).size,
    ).toBe(0);
  });

  it('delete restores the balance', () => {
    expect(deleteDeltas([{ type: 'expense', accountId: 'a', amountMinor: 750 }])).toEqual(
      new Map([['a', 750]]),
    );
  });
});

describe('transfer deltas', () => {
  const legs = [
    { type: 'transfer' as const, accountId: 'a', destinationAccountId: 'b', amountMinor: 500 },
    { type: 'transfer' as const, accountId: 'b', amountMinor: 500 },
  ];

  it('debits the source and credits the destination', () => {
    expect(
      createTransferDeltas({ sourceAccountId: 'a', destinationAccountId: 'b', amountMinor: 500 }),
    ).toEqual(
      new Map([
        ['a', -500],
        ['b', 500],
      ]),
    );
  });

  it('deleting both legs restores both balances', () => {
    expect(deleteDeltas(legs)).toEqual(
      new Map([
        ['a', 500],
        ['b', -500],
      ]),
    );
  });

  it('editing the amount adjusts both accounts by the difference', () => {
    expect(
      editTransferDeltas(legs, {
        sourceAccountId: 'a',
        destinationAccountId: 'b',
        amountMinor: 800,
      }),
    ).toEqual(
      new Map([
        ['a', -300],
        ['b', 300],
      ]),
    );
  });

  it('editing the accounts moves both effects', () => {
    expect(
      editTransferDeltas(legs, {
        sourceAccountId: 'c',
        destinationAccountId: 'd',
        amountMinor: 500,
      }),
    ).toEqual(
      new Map([
        ['a', 500],
        ['b', -500],
        ['c', -500],
        ['d', 500],
      ]),
    );
  });

  it('reversing direction between the same accounts doubles the swing', () => {
    expect(
      editTransferDeltas(legs, {
        sourceAccountId: 'b',
        destinationAccountId: 'a',
        amountMinor: 500,
      }),
    ).toEqual(
      new Map([
        ['a', 1000],
        ['b', -1000],
      ]),
    );
  });
});
