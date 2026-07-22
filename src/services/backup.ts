import { z } from 'zod';
import { categorySchema } from '@/lib/validation';
import { loadAll, loadSettings } from '@/services/repositories';
import type { Account, Budget, Category, RecurringTransaction, Transaction } from '@/types/domain';
const entity = z.object({ id: z.string().min(1) }).passthrough();
export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  settings: z.record(z.string(), z.unknown()),
  accounts: z.array(entity),
  categories: z.array(categorySchema),
  transactions: z.array(entity),
  budgets: z.array(entity),
  recurringTransactions: z.array(entity),
});
export type Backup = z.infer<typeof backupSchema>;
function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return (value as { toDate: () => Date }).toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}
export async function createBackup(uid: string): Promise<Backup> {
  const [settings, accounts, categories, transactions, budgets, recurringTransactions] =
    await Promise.all([
      loadSettings(uid),
      loadAll<Account>(uid, 'accounts'),
      loadAll<Category>(uid, 'categories'),
      loadAll<Transaction>(uid, 'transactions'),
      loadAll<Budget>(uid, 'budgets'),
      loadAll<RecurringTransaction>(uid, 'recurringTransactions'),
    ]);
  return backupSchema.parse(
    serialize({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: settings ?? {},
      accounts,
      categories,
      transactions,
      budgets,
      recurringTransactions,
    }),
  );
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export function parseBackup(text: string) {
  return backupSchema.parse(JSON.parse(text) as unknown);
}
export const backupEntityCount = (b: Backup) =>
  b.accounts.length +
  b.categories.length +
  b.transactions.length +
  b.budgets.length +
  b.recurringTransactions.length;
