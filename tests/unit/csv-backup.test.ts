import { describe, expect, it } from 'vitest';
import { normalizeRows, parseCsv } from '@/services/csv';
import { backupSchema } from '@/services/backup';
import { categoryIconIdSchema, categorySchema } from '@/lib/validation';
describe('data mobility', () => {
  it('normalizes signed amount CSV rows', () => {
    const parsed = parseCsv('Date,Description,Amount\n2025-01-02,Coffee,-4.25');
    const [row] = normalizeRows(
      parsed.rows,
      { date: 'Date', description: 'Description', amount: 'Amount' },
      'yyyy-MM-dd',
    );
    expect(row).toMatchObject({ type: 'expense', amountMinor: 425, valid: true });
  });
  it('rejects unsupported backup versions', () => {
    expect(() => backupSchema.parse({ schemaVersion: 2 })).toThrow();
  });
  it('accepts an empty version one backup', () => {
    expect(
      backupSchema.parse({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        settings: {},
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
        recurringTransactions: [],
      }),
    ).toBeTruthy();
  });

  it('normalizes missing and legacy category icons in version one data', () => {
    const base = {
      id: 'food',
      name: 'Food',
      type: 'expense' as const,
      archived: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    expect(categorySchema.parse(base).icon).toBe('general');
    expect(categorySchema.parse({ ...base, icon: '🍽️' }).icon).toBe('dining');
    expect(categorySchema.parse({ ...base, icon: ' groceries ' }).icon).toBe('groceries');
    expect(categoryIconIdSchema.safeParse('🚀').success).toBe(false);

    const backup = backupSchema.parse({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: {},
      accounts: [],
      categories: [{ ...base, icon: 'circle' }],
      transactions: [],
      budgets: [],
      recurringTransactions: [],
    });
    expect(backup.categories[0]?.icon).toBe('general');
  });
});
