import { describe, expect, it } from 'vitest';
import {
  guessMapping,
  markDuplicates,
  normalizeCsvRow,
  parseCsvAmount,
  transactionFingerprint,
  emptyMapping,
} from '@/services/csv';
import type { Category, Transaction } from '@/types/domain';

const categories: Category[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'expense',
    icon: 'groceries',
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'salary',
    name: 'Salary',
    type: 'income',
    icon: 'salary',
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('parseCsvAmount', () => {
  it('parses plain, formatted, and negative amounts', () => {
    expect(parseCsvAmount('12.50')).toBe(1250);
    expect(parseCsvAmount('$1,234.56')).toBe(123456);
    expect(parseCsvAmount('-45')).toBe(-4500);
    expect(parseCsvAmount('(89.99)')).toBe(-8999);
  });

  it('handles European decimal commas', () => {
    expect(parseCsvAmount('1.234,56')).toBe(123456);
    expect(parseCsvAmount('12,50')).toBe(1250);
  });

  it('rejects garbage', () => {
    expect(parseCsvAmount('')).toBeNull();
    expect(parseCsvAmount('abc')).toBeNull();
    expect(parseCsvAmount('1.2.3.4')).toBeNull();
  });
});

describe('normalizeCsvRow', () => {
  const mapping = {
    ...emptyMapping,
    date: 'Date',
    description: 'Memo',
    amount: 'Amount',
    category: 'Category',
  };

  it('normalizes a signed-amount row', () => {
    const row = normalizeCsvRow(
      { Date: '2026-07-04', Memo: 'Groceries run', Amount: '-52.30', Category: 'groceries' },
      0,
      mapping,
      'yyyy-MM-dd',
      categories,
    );
    expect(row.error).toBeUndefined();
    expect(row.type).toBe('expense');
    expect(row.amountMinor).toBe(5230);
    expect(row.categoryId).toBe('groceries');
    expect(row.occurredAt).toEqual(new Date(2026, 6, 4));
  });

  it('respects the chosen date format', () => {
    const row = normalizeCsvRow(
      { Date: '04/07/2026', Memo: 'x', Amount: '1' },
      0,
      mapping,
      'dd/MM/yyyy',
      categories,
    );
    expect(row.occurredAt).toEqual(new Date(2026, 6, 4));
    const bad = normalizeCsvRow(
      { Date: '2026-07-04', Memo: 'x', Amount: '1' },
      0,
      mapping,
      'dd/MM/yyyy',
      categories,
    );
    expect(bad.error).toMatch(/Unreadable date/);
  });

  it('uses debit/credit columns when there is no amount column', () => {
    const dcMapping = {
      ...emptyMapping,
      date: 'Date',
      description: 'Memo',
      debit: 'Out',
      credit: 'In',
    };
    const debit = normalizeCsvRow(
      { Date: '2026-07-04', Memo: 'x', Out: '20.00', In: '' },
      0,
      dcMapping,
      'yyyy-MM-dd',
      categories,
    );
    expect(debit.type).toBe('expense');
    expect(debit.amountMinor).toBe(2000);
    const credit = normalizeCsvRow(
      { Date: '2026-07-04', Memo: 'x', Out: '', In: '99.00' },
      0,
      dcMapping,
      'yyyy-MM-dd',
      categories,
    );
    expect(credit.type).toBe('income');
    expect(credit.amountMinor).toBe(9900);
  });

  it('only matches categories of the right type', () => {
    const row = normalizeCsvRow(
      { Date: '2026-07-04', Memo: 'x', Amount: '-10', Category: 'Salary' },
      0,
      mapping,
      'yyyy-MM-dd',
      categories,
    );
    expect(row.categoryId).toBeUndefined();
    expect(row.categoryName).toBe('Salary');
  });

  it('flags invalid rows instead of dropping them', () => {
    const row = normalizeCsvRow({ Date: '', Memo: 'x', Amount: '5' }, 3, mapping, 'yyyy-MM-dd', []);
    expect(row.error).toBe('Missing date');
    expect(row.included).toBe(false);
    expect(row.index).toBe(3);
  });
});

describe('guessMapping', () => {
  it('maps common bank headers', () => {
    const mapping = guessMapping(['Transaction Date', 'Description', 'Debit', 'Credit', 'Payee']);
    expect(mapping.date).toBe('Transaction Date');
    expect(mapping.description).toBe('Description');
    expect(mapping.debit).toBe('Debit');
    expect(mapping.credit).toBe('Credit');
    expect(mapping.merchant).toBe('Payee');
  });
});

describe('fingerprints and duplicates', () => {
  const base = {
    accountId: 'a1',
    occurredAt: new Date(2026, 6, 4, 14, 30),
    amountMinor: 5230,
    type: 'expense',
    description: 'Groceries  Run',
  };

  it('is deterministic and normalizes whitespace/case, ignoring time of day', async () => {
    const one = await transactionFingerprint(base);
    const two = await transactionFingerprint({
      ...base,
      occurredAt: new Date(2026, 6, 4, 9, 0),
      description: 'groceries run',
    });
    expect(one).toBe(two);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any component changes', async () => {
    const one = await transactionFingerprint(base);
    expect(await transactionFingerprint({ ...base, amountMinor: 5231 })).not.toBe(one);
    expect(await transactionFingerprint({ ...base, accountId: 'a2' })).not.toBe(one);
  });

  it('marks existing and in-file duplicates for review without discarding', async () => {
    const existing: Transaction[] = [
      {
        id: 'e1',
        type: 'expense',
        accountId: 'a1',
        amountMinor: 5230,
        currency: 'USD',
        description: 'Groceries run',
        tags: [],
        occurredAt: new Date(2026, 6, 4),
        source: 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const rows = [
      {
        index: 0,
        occurredAt: new Date(2026, 6, 4),
        type: 'expense' as const,
        amountMinor: 5230,
        description: 'Groceries run',
        included: true,
      },
      {
        index: 1,
        occurredAt: new Date(2026, 6, 5),
        type: 'expense' as const,
        amountMinor: 900,
        description: 'Coffee',
        included: true,
      },
      {
        index: 2,
        occurredAt: new Date(2026, 6, 5),
        type: 'expense' as const,
        amountMinor: 900,
        description: 'Coffee',
        included: true,
      },
    ];
    const marked = await markDuplicates(rows, 'a1', existing);
    expect(marked[0]!.duplicate).toBe('existing');
    expect(marked[0]!.included).toBe(false);
    expect(marked[1]!.duplicate).toBeUndefined();
    expect(marked[1]!.included).toBe(true);
    expect(marked[2]!.duplicate).toBe('in-file');
    expect(marked[2]!.included).toBe(false);
    expect(marked).toHaveLength(3);
  });
});
