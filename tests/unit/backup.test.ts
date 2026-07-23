import { describe, expect, it } from 'vitest';
import { validateBackup, BACKUP_SCHEMA_VERSION } from '@/services/backup';
import { defaultSettings } from '@/types/domain';

const validBackup = {
  schemaVersion: BACKUP_SCHEMA_VERSION,
  exportedAt: '2026-07-23T12:00:00.000Z',
  settings: defaultSettings,
  accounts: [
    {
      id: 'a1',
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingBalanceMinor: 0,
      currentBalanceMinor: 1500,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  categories: [],
  transactions: [
    {
      id: 't1',
      type: 'expense',
      accountId: 'a1',
      amountMinor: 500,
      currency: 'USD',
      description: 'Coffee',
      tags: [],
      occurredAt: '2026-07-01T10:00:00.000Z',
      source: 'manual',
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
  ],
  budgets: [],
  recurringTransactions: [],
};

describe('validateBackup', () => {
  it('accepts a valid backup file', () => {
    const backup = validateBackup(validBackup);
    expect(backup.accounts).toHaveLength(1);
    expect(backup.transactions[0]!.amountMinor).toBe(500);
  });

  it('rejects unsupported schema versions', () => {
    expect(() => validateBackup({ ...validBackup, schemaVersion: 99 })).toThrow(/schema version/i);
  });

  it('rejects structurally invalid files', () => {
    expect(() => validateBackup({})).toThrow(/not a valid backup/i);
    expect(() =>
      validateBackup({
        ...validBackup,
        transactions: [{ ...validBackup.transactions[0], amountMinor: -5 }],
      }),
    ).toThrow(/transactions/i);
    expect(() =>
      validateBackup({
        ...validBackup,
        accounts: [{ ...validBackup.accounts[0], type: 'yacht' }],
      }),
    ).toThrow(/accounts/i);
  });

  it('rejects invalid dates', () => {
    expect(() => validateBackup({ ...validBackup, exportedAt: 'yesterday' })).toThrow();
  });
});
