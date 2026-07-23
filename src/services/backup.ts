import { Timestamp, doc, getDocs, writeBatch, type CollectionReference } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { AppError } from '@/lib/errors';
import {
  accountTypeSchema,
  categoryTypeSchema,
  periodSchema,
  recurrenceFrequencySchema,
  settingsSchema,
  transactionSourceSchema,
  transactionTypeSchema,
} from '@/types/domain';
import {
  accountsCol,
  budgetsCol,
  categoriesCol,
  parseAccount,
  parseBudget,
  parseCategory,
  parseRecurring,
  parseTransaction,
  recurringCol,
  settingsDoc,
  transactionsCol,
} from '@/services/repositories';
import { loadSettings } from '@/services/repositories';
import { MAX_BATCH_OPS } from '@/services/finance';

export const BACKUP_SCHEMA_VERSION = 1;

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

const accountBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string(),
  openingBalanceMinor: z.number().int(),
  currentBalanceMinor: z.number().int(),
  archived: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const categoryBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: categoryTypeSchema,
  icon: z.string(),
  parentCategoryId: z.string().optional(),
  archived: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const transactionBackupSchema = z.object({
  id: z.string(),
  type: transactionTypeSchema,
  accountId: z.string(),
  destinationAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  amountMinor: z.number().int().positive(),
  currency: z.string(),
  merchant: z.string().optional(),
  description: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
  occurredAt: isoDate,
  transferId: z.string().optional(),
  recurringTransactionId: z.string().optional(),
  source: transactionSourceSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const budgetBackupSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  period: periodSchema,
  limitMinor: z.number().int().positive(),
  warningThreshold: z.number().min(0).max(1),
  rollover: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const recurringBackupSchema = z.object({
  id: z.string(),
  type: z.enum(['income', 'expense']),
  accountId: z.string(),
  categoryId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string(),
  description: z.string(),
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().positive(),
  nextOccurrence: isoDate,
  anchorDay: z.number().int().min(1).max(31).optional(),
  endDate: isoDate.optional(),
  active: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const backupFileSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION, {
    error: 'Unsupported backup schema version',
  }),
  exportedAt: isoDate,
  settings: settingsSchema,
  accounts: z.array(accountBackupSchema),
  categories: z.array(categoryBackupSchema),
  transactions: z.array(transactionBackupSchema),
  budgets: z.array(budgetBackupSchema),
  recurringTransactions: z.array(recurringBackupSchema),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export function validateBackup(json: unknown): BackupFile {
  const result = backupFileSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(
      `This is not a valid backup file (${first?.path.join('.') || 'root'}: ${first?.message}).`,
    );
  }
  return result.data;
}

const iso = (date: Date) => date.toISOString();

export async function exportBackup(uid: string): Promise<BackupFile> {
  const [settings, accounts, categories, transactions, budgets, recurring] = await Promise.all([
    loadSettings(uid),
    getDocs(accountsCol(uid)),
    getDocs(categoriesCol(uid)),
    getDocs(transactionsCol(uid)),
    getDocs(budgetsCol(uid)),
    getDocs(recurringCol(uid)),
  ]);
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: iso(new Date()),
    settings,
    accounts: accounts.docs.map(parseAccount).map((account) => ({
      ...account,
      createdAt: iso(account.createdAt),
      updatedAt: iso(account.updatedAt),
    })),
    categories: categories.docs.map(parseCategory).map((category) => ({
      ...category,
      createdAt: iso(category.createdAt),
      updatedAt: iso(category.updatedAt),
    })),
    transactions: transactions.docs.map(parseTransaction).map((txn) => ({
      ...txn,
      occurredAt: iso(txn.occurredAt),
      createdAt: iso(txn.createdAt),
      updatedAt: iso(txn.updatedAt),
    })),
    budgets: budgets.docs.map(parseBudget).map((budget) => ({
      ...budget,
      createdAt: iso(budget.createdAt),
      updatedAt: iso(budget.updatedAt),
    })),
    recurringTransactions: recurring.docs.map(parseRecurring).map((item) => ({
      ...item,
      nextOccurrence: iso(item.nextOccurrence),
      endDate: item.endDate ? iso(item.endDate) : undefined,
      createdAt: iso(item.createdAt),
      updatedAt: iso(item.updatedAt),
    })),
  };
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  written: number;
  deleted: number;
}

function toTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(value));
}

async function commitChunks(
  operations: ((batch: ReturnType<typeof writeBatch>) => void)[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(index, index + MAX_BATCH_OPS)) operation(batch);
    try {
      await batch.commit();
    } catch (error) {
      throw new AppError(
        `Restore stopped after ${Math.min(index, operations.length)} of ${operations.length} writes. ` +
          'Nothing was silently overwritten — fix the connection and restore again.',
        { cause: error },
      );
    }
    onProgress?.(Math.min(index + MAX_BATCH_OPS, operations.length), operations.length);
  }
}

async function deleteAll(uid: string): Promise<number> {
  const collections: CollectionReference[] = [
    accountsCol(uid),
    categoriesCol(uid),
    transactionsCol(uid),
    budgetsCol(uid),
    recurringCol(uid),
  ];
  const operations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  for (const collection of collections) {
    const snap = await getDocs(collection);
    for (const docSnap of snap.docs) operations.push((batch) => batch.delete(docSnap.ref));
  }
  await commitChunks(operations);
  return operations.length;
}

/**
 * Restore a validated backup. `merge` upserts by id and keeps everything else;
 * `replace` deletes current data first. Callers must confirm replace explicitly
 * and download an automatic safety backup beforehand.
 */
export async function restoreBackup(
  uid: string,
  backup: BackupFile,
  mode: RestoreMode,
  onProgress?: (done: number, total: number) => void,
): Promise<RestoreResult> {
  const deleted = mode === 'replace' ? await deleteAll(uid) : 0;

  const operations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  operations.push((batch) => batch.set(settingsDoc(uid), backup.settings, { merge: true }));
  for (const { id, ...account } of backup.accounts) {
    operations.push((batch) =>
      batch.set(doc(accountsCol(uid), id), {
        ...account,
        createdAt: toTimestamp(account.createdAt),
        updatedAt: toTimestamp(account.updatedAt),
      }),
    );
  }
  for (const { id, ...category } of backup.categories) {
    operations.push((batch) =>
      batch.set(doc(categoriesCol(uid), id), {
        ...category,
        createdAt: toTimestamp(category.createdAt),
        updatedAt: toTimestamp(category.updatedAt),
      }),
    );
  }
  for (const { id, ...txn } of backup.transactions) {
    operations.push((batch) =>
      batch.set(doc(transactionsCol(uid), id), {
        ...txn,
        occurredAt: toTimestamp(txn.occurredAt),
        createdAt: toTimestamp(txn.createdAt),
        updatedAt: toTimestamp(txn.updatedAt),
      }),
    );
  }
  for (const { id, ...budget } of backup.budgets) {
    operations.push((batch) =>
      batch.set(doc(budgetsCol(uid), id), {
        ...budget,
        createdAt: toTimestamp(budget.createdAt),
        updatedAt: toTimestamp(budget.updatedAt),
      }),
    );
  }
  for (const { id, ...item } of backup.recurringTransactions) {
    operations.push((batch) =>
      batch.set(doc(recurringCol(uid), id), {
        ...item,
        nextOccurrence: toTimestamp(item.nextOccurrence),
        endDate: item.endDate ? toTimestamp(item.endDate) : undefined,
        createdAt: toTimestamp(item.createdAt),
        updatedAt: toTimestamp(item.updatedAt),
      }),
    );
  }

  await commitChunks(operations, onProgress);
  return { written: operations.length, deleted };
}
