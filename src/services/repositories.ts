import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { defaultCategorySeeds } from '@/lib/categories';
import { AppError } from '@/lib/errors';
import {
  accountTypeSchema,
  categoryTypeSchema,
  defaultSettings,
  periodSchema,
  recurrenceFrequencySchema,
  settingsSchema,
  transactionSourceSchema,
  transactionTypeSchema,
  type Account,
  type Budget,
  type Category,
  type ImportRecord,
  type RecurringTransaction,
  type Settings,
  type Transaction,
} from '@/types/domain';

/**
 * All Firestore access lives here. Documents are validated with Zod on read,
 * so a corrupt document fails loudly instead of silently breaking balances.
 */

const timestampSchema = z.instanceof(Timestamp);

export const accountsCol = (uid: string) => collection(db, 'users', uid, 'accounts');
export const categoriesCol = (uid: string) => collection(db, 'users', uid, 'categories');
export const transactionsCol = (uid: string) => collection(db, 'users', uid, 'transactions');
export const budgetsCol = (uid: string) => collection(db, 'users', uid, 'budgets');
export const recurringCol = (uid: string) => collection(db, 'users', uid, 'recurringTransactions');
export const importsCol = (uid: string) => collection(db, 'users', uid, 'imports');
export const settingsDoc = (uid: string) => doc(db, 'users', uid, 'settings', 'profile');

function data(snap: DocumentSnapshot | QueryDocumentSnapshot): Record<string, unknown> {
  const value = snap.data({ serverTimestamps: 'estimate' });
  if (!value) throw new AppError('Document is missing.');
  return value;
}

// --- Accounts ---

const accountDocSchema = z.object({
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string(),
  openingBalanceMinor: z.number().int(),
  currentBalanceMinor: z.number().int(),
  archived: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export function parseAccount(snap: DocumentSnapshot): Account {
  const parsed = accountDocSchema.parse(data(snap));
  return {
    ...parsed,
    id: snap.id,
    createdAt: parsed.createdAt.toDate(),
    updatedAt: parsed.updatedAt.toDate(),
  };
}

export interface AccountInput {
  name: string;
  type: Account['type'];
  currency: string;
  openingBalanceMinor: number;
}

export async function createAccount(uid: string, input: AccountInput): Promise<string> {
  const ref = doc(accountsCol(uid));
  await setDoc(ref, {
    ...input,
    currentBalanceMinor: input.openingBalanceMinor,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Editing the opening balance shifts the current balance by the same delta. */
export async function updateAccount(
  uid: string,
  account: Account,
  input: AccountInput,
): Promise<void> {
  const openingDelta = input.openingBalanceMinor - account.openingBalanceMinor;
  await updateDoc(doc(accountsCol(uid), account.id), {
    ...input,
    currentBalanceMinor: account.currentBalanceMinor + openingDelta,
    updatedAt: serverTimestamp(),
  });
}

export async function setAccountArchived(
  uid: string,
  account: Account,
  archived: boolean,
): Promise<void> {
  await updateDoc(doc(accountsCol(uid), account.id), { archived, updatedAt: serverTimestamp() });
}

// --- Categories ---

const categoryDocSchema = z.object({
  name: z.string(),
  type: categoryTypeSchema,
  icon: z.string().default('other'),
  parentCategoryId: z.string().optional(),
  archived: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export function parseCategory(snap: DocumentSnapshot): Category {
  const parsed = categoryDocSchema.parse(data(snap));
  return {
    ...parsed,
    id: snap.id,
    createdAt: parsed.createdAt.toDate(),
    updatedAt: parsed.updatedAt.toDate(),
  };
}

export interface CategoryInput {
  name: string;
  type: Category['type'];
  icon: string;
  parentCategoryId?: string;
}

export async function createCategory(uid: string, input: CategoryInput): Promise<string> {
  const ref = doc(categoriesCol(uid));
  await setDoc(ref, {
    ...input,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(
  uid: string,
  id: string,
  input: Partial<CategoryInput> & { archived?: boolean },
): Promise<void> {
  await updateDoc(doc(categoriesCol(uid), id), { ...input, updatedAt: serverTimestamp() });
}

/** Transactions that referenced it simply show as "Uncategorized". */
export async function deleteCategory(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(categoriesCol(uid), id));
}

// --- Transactions ---

const transactionDocSchema = z.object({
  type: transactionTypeSchema,
  accountId: z.string(),
  destinationAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  amountMinor: z.number().int().positive(),
  currency: z.string(),
  merchant: z.string().optional(),
  description: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  occurredAt: timestampSchema,
  transferId: z.string().optional(),
  recurringTransactionId: z.string().optional(),
  source: transactionSourceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export function parseTransaction(snap: DocumentSnapshot): Transaction {
  const parsed = transactionDocSchema.parse(data(snap));
  return {
    ...parsed,
    id: snap.id,
    occurredAt: parsed.occurredAt.toDate(),
    createdAt: parsed.createdAt.toDate(),
    updatedAt: parsed.updatedAt.toDate(),
  };
}

/** Firestore document payload for a transaction (used by finance service batches). */
export function transactionDocData(
  txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
  return {
    ...txn,
    occurredAt: Timestamp.fromDate(txn.occurredAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function transactionsInRange(uid: string, start: Date, end: Date): Query {
  return query(
    transactionsCol(uid),
    where('occurredAt', '>=', Timestamp.fromDate(start)),
    where('occurredAt', '<', Timestamp.fromDate(end)),
    orderBy('occurredAt', 'desc'),
  );
}

export function accountTransactionsPage(
  uid: string,
  accountId: string,
  pageSize: number,
  cursor?: QueryDocumentSnapshot,
): Query {
  const parts = [
    where('accountId', '==', accountId),
    orderBy('occurredAt', 'desc'),
    limit(pageSize),
  ];
  return cursor
    ? query(transactionsCol(uid), ...parts.slice(0, 2), startAfter(cursor), limit(pageSize))
    : query(transactionsCol(uid), ...parts);
}

export async function getTransaction(uid: string, id: string): Promise<Transaction> {
  const snap = await getDoc(doc(transactionsCol(uid), id));
  if (!snap.exists()) throw new AppError('That transaction no longer exists.');
  return parseTransaction(snap);
}

/** Both legs of a transfer, source leg first. */
export async function getTransferPair(uid: string, transferId: string): Promise<Transaction[]> {
  const snap = await getDocs(query(transactionsCol(uid), where('transferId', '==', transferId)));
  const legs = snap.docs.map(parseTransaction);
  return legs.sort((a, b) => (a.destinationAccountId ? -1 : 0) - (b.destinationAccountId ? -1 : 0));
}

// --- Budgets ---

const budgetDocSchema = z.object({
  categoryId: z.string(),
  period: periodSchema,
  limitMinor: z.number().int().positive(),
  warningThreshold: z.number().min(0).max(1),
  rollover: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export function parseBudget(snap: DocumentSnapshot): Budget {
  const parsed = budgetDocSchema.parse(data(snap));
  return {
    ...parsed,
    id: snap.id,
    createdAt: parsed.createdAt.toDate(),
    updatedAt: parsed.updatedAt.toDate(),
  };
}

export interface BudgetInput {
  categoryId: string;
  period: string;
  limitMinor: number;
  warningThreshold: number;
  rollover: boolean;
}

export async function saveBudget(uid: string, input: BudgetInput, id?: string): Promise<string> {
  // One budget per category per month: deterministic id prevents duplicates.
  const ref: DocumentReference = id
    ? doc(budgetsCol(uid), id)
    : doc(budgetsCol(uid), `${input.period}_${input.categoryId}`);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...input,
    createdAt: existing.exists() ? existing.get('createdAt') : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteBudget(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(budgetsCol(uid), id));
}

// --- Recurring transactions ---

const recurringDocSchema = z.object({
  type: z.enum(['income', 'expense']),
  accountId: z.string(),
  categoryId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string(),
  description: z.string(),
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().positive(),
  nextOccurrence: timestampSchema,
  anchorDay: z.number().int().min(1).max(31).optional(),
  endDate: timestampSchema.optional(),
  active: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export function parseRecurring(snap: DocumentSnapshot): RecurringTransaction {
  const parsed = recurringDocSchema.parse(data(snap));
  return {
    ...parsed,
    id: snap.id,
    nextOccurrence: parsed.nextOccurrence.toDate(),
    endDate: parsed.endDate?.toDate(),
    createdAt: parsed.createdAt.toDate(),
    updatedAt: parsed.updatedAt.toDate(),
  };
}

export interface RecurringInput {
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  amountMinor: number;
  currency: string;
  description: string;
  frequency: RecurringTransaction['frequency'];
  interval: number;
  nextOccurrence: Date;
  anchorDay?: number;
  endDate?: Date;
}

function recurringDocData(input: RecurringInput) {
  return {
    ...input,
    nextOccurrence: Timestamp.fromDate(input.nextOccurrence),
    endDate: input.endDate ? Timestamp.fromDate(input.endDate) : undefined,
    updatedAt: serverTimestamp(),
  };
}

export async function createRecurring(uid: string, input: RecurringInput): Promise<string> {
  const ref = doc(recurringCol(uid));
  await setDoc(ref, { ...recurringDocData(input), active: true, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateRecurring(
  uid: string,
  id: string,
  input: RecurringInput,
): Promise<void> {
  await updateDoc(doc(recurringCol(uid), id), recurringDocData(input));
}

export async function setRecurringActive(uid: string, id: string, active: boolean): Promise<void> {
  await updateDoc(doc(recurringCol(uid), id), { active, updatedAt: serverTimestamp() });
}

export async function deleteRecurring(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(recurringCol(uid), id));
}

// --- Imports ---

const importDocSchema = z.object({
  fileName: z.string(),
  accountId: z.string(),
  rowCount: z.number().int(),
  importedCount: z.number().int(),
  duplicateCount: z.number().int(),
  createdAt: timestampSchema,
});

export function parseImportRecord(snap: DocumentSnapshot): ImportRecord {
  const parsed = importDocSchema.parse(data(snap));
  return { ...parsed, id: snap.id, createdAt: parsed.createdAt.toDate() };
}

// --- Settings & first-run seeding ---

export async function loadSettings(uid: string): Promise<Settings> {
  const snap = await getDoc(settingsDoc(uid));
  if (!snap.exists()) return defaultSettings;
  return settingsSchema.parse(snap.data());
}

export async function saveSettings(uid: string, patch: Partial<Settings>): Promise<void> {
  await setDoc(settingsDoc(uid), patch, { merge: true });
}

/**
 * First-run setup: write default settings and seed default categories.
 * Seed ids are deterministic, so re-running is idempotent — and a ledger that
 * already has ANY categories (e.g. from an earlier install) is never seeded,
 * only marked as seeded, so defaults can't duplicate existing ones.
 */
export async function ensureDefaultData(uid: string, settings: Settings): Promise<void> {
  if (settings.categoriesSeeded) return;
  const existing = await getDocs(query(categoriesCol(uid), limit(1)));
  if (!existing.empty) {
    await saveSettings(uid, { categoriesSeeded: true });
    return;
  }
  const batch = writeBatch(db);
  for (const seed of defaultCategorySeeds) {
    const id = `seed-${seed.type}-${seed.name.toLowerCase().replace(/\s+/g, '-')}`;
    batch.set(doc(categoriesCol(uid), id), {
      ...seed,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(settingsDoc(uid), { ...settings, categoriesSeeded: true }, { merge: true });
  await batch.commit();
}
