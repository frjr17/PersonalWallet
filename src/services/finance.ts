import {
  Timestamp,
  deleteField,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  createEntryDeltas,
  createTransferDeltas,
  deleteDeltas,
  editEntryDeltas,
  editTransferDeltas,
  legEffect,
  type BalanceDeltaMap,
} from '@/lib/ledger';
import { advanceOccurrence } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import type {
  Account,
  Category,
  RecurringTransaction,
  Transaction,
  TransactionSource,
} from '@/types/domain';
import {
  accountsCol,
  getTransferPair,
  importsCol,
  parseAccount,
  parseTransaction,
  recurringCol,
  transactionDocData,
  transactionsCol,
} from '@/services/repositories';

/**
 * Every write that moves money goes through this service as one atomic batch:
 * the transaction document(s) and the account balance increments commit together.
 * Validation uses the in-memory accounts/categories so writes stay offline-capable.
 * The delta math itself lives in lib/ledger.ts (pure, unit-tested).
 */

/** Firestore allows 500 ops per batch; stay below it with headroom for balance/meta writes. */
export const MAX_BATCH_OPS = 400;

export interface LedgerContext {
  uid: string;
  accounts: Account[];
  categories: Category[];
}

function requireAccount(
  ctx: LedgerContext,
  accountId: string,
  { allowArchived = false } = {},
): Account {
  const account = ctx.accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new AppError('That account does not exist.');
  if (account.archived && !allowArchived)
    throw new AppError(`"${account.name}" is archived and cannot receive new transactions.`);
  return account;
}

function requireCategory(
  ctx: LedgerContext,
  categoryId: string,
  type: 'income' | 'expense',
): Category {
  const category = ctx.categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new AppError('That category does not exist.');
  if (category.type !== type)
    throw new AppError(
      `"${category.name}" is a ${category.type} category and cannot be used here.`,
    );
  return category;
}

function assertPositiveAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0)
    throw new AppError('Amount must be greater than zero.');
}

/** One balance write per affected account, from a pure delta map. */
function applyDeltas(
  batch: ReturnType<typeof writeBatch>,
  uid: string,
  deltas: BalanceDeltaMap,
): void {
  for (const [accountId, delta] of deltas) {
    batch.update(doc(accountsCol(uid), accountId), {
      currentBalanceMinor: increment(delta),
      updatedAt: serverTimestamp(),
    });
  }
}

// --- Income & expense entries ---

export interface EntryInput {
  type: 'income' | 'expense';
  accountId: string;
  categoryId?: string;
  amountMinor: number;
  currency: string;
  merchant?: string;
  description: string;
  notes?: string;
  tags: string[];
  occurredAt: Date;
  source?: TransactionSource;
  recurringTransactionId?: string;
}

function validateEntry(ctx: LedgerContext, input: EntryInput): void {
  assertPositiveAmount(input.amountMinor);
  requireAccount(ctx, input.accountId);
  if (input.categoryId) requireCategory(ctx, input.categoryId, input.type);
}

export async function createEntry(ctx: LedgerContext, input: EntryInput): Promise<string> {
  validateEntry(ctx, input);
  const ref = doc(transactionsCol(ctx.uid));
  const batch = writeBatch(db);
  batch.set(ref, transactionDocData({ source: 'manual', ...input, tags: input.tags }));
  applyDeltas(batch, ctx.uid, createEntryDeltas(input));
  await batch.commit();
  return ref.id;
}

/** Reverse the original account effect, apply the new one, rewrite the document — atomically. */
export async function updateEntry(
  ctx: LedgerContext,
  original: Transaction,
  input: EntryInput,
): Promise<void> {
  if (original.type === 'transfer')
    throw new AppError('Transfers are edited through the transfer form.');
  validateEntry(ctx, input);
  const batch = writeBatch(db);
  batch.update(doc(transactionsCol(ctx.uid), original.id), {
    type: input.type,
    accountId: input.accountId,
    categoryId: input.categoryId ?? deleteField(),
    amountMinor: input.amountMinor,
    currency: input.currency,
    merchant: input.merchant ?? deleteField(),
    description: input.description,
    notes: input.notes ?? deleteField(),
    tags: input.tags,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    updatedAt: serverTimestamp(),
  });
  applyDeltas(batch, ctx.uid, editEntryDeltas(original, input));
  await batch.commit();
}

/** Delete any transaction. Transfer legs are removed in pairs. */
export async function deleteTransaction(uid: string, txn: Transaction): Promise<void> {
  const legs = txn.transferId ? await getTransferPair(uid, txn.transferId) : [txn];
  const batch = writeBatch(db);
  for (const leg of legs) batch.delete(doc(transactionsCol(uid), leg.id));
  applyDeltas(batch, uid, deleteDeltas(legs));
  await batch.commit();
}

// --- Transfers ---

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  description?: string;
  notes?: string;
  occurredAt: Date;
}

function validateTransfer(
  ctx: LedgerContext,
  input: TransferInput,
): { source: Account; destination: Account } {
  assertPositiveAmount(input.amountMinor);
  if (input.sourceAccountId === input.destinationAccountId)
    throw new AppError('A transfer needs two different accounts.');
  return {
    source: requireAccount(ctx, input.sourceAccountId),
    destination: requireAccount(ctx, input.destinationAccountId),
  };
}

function transferLegs(input: TransferInput, names: { source: string; destination: string }) {
  const shared = {
    type: 'transfer' as const,
    amountMinor: input.amountMinor,
    currency: input.currency,
    notes: input.notes,
    tags: [],
    occurredAt: input.occurredAt,
    source: 'manual' as const,
  };
  return {
    // The outgoing leg carries destinationAccountId; the incoming leg has none.
    sourceLeg: {
      ...shared,
      accountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      description: input.description || `Transfer to ${names.destination}`,
    },
    destinationLeg: {
      ...shared,
      accountId: input.destinationAccountId,
      description: input.description || `Transfer from ${names.source}`,
    },
  };
}

export async function createTransfer(ctx: LedgerContext, input: TransferInput): Promise<string> {
  const { source, destination } = validateTransfer(ctx, input);
  const sourceRef = doc(transactionsCol(ctx.uid));
  const destinationRef = doc(transactionsCol(ctx.uid));
  const transferId = sourceRef.id;
  const { sourceLeg, destinationLeg } = transferLegs(input, {
    source: source.name,
    destination: destination.name,
  });
  const batch = writeBatch(db);
  batch.set(sourceRef, transactionDocData({ ...sourceLeg, transferId }));
  batch.set(destinationRef, transactionDocData({ ...destinationLeg, transferId }));
  applyDeltas(batch, ctx.uid, createTransferDeltas(input));
  await batch.commit();
  return transferId;
}

export async function updateTransfer(
  ctx: LedgerContext,
  legs: Transaction[],
  input: TransferInput,
): Promise<void> {
  const sourceLegOld = legs.find((leg) => leg.destinationAccountId);
  const destinationLegOld = legs.find((leg) => !leg.destinationAccountId);
  if (!sourceLegOld || !destinationLegOld) throw new AppError('This transfer is incomplete.');
  const { source, destination } = validateTransfer(ctx, input);
  const { sourceLeg, destinationLeg } = transferLegs(input, {
    source: source.name,
    destination: destination.name,
  });
  const batch = writeBatch(db);
  for (const [legOld, legNew] of [
    [sourceLegOld, sourceLeg],
    [destinationLegOld, destinationLeg],
  ] as const) {
    batch.update(doc(transactionsCol(ctx.uid), legOld.id), {
      accountId: legNew.accountId,
      destinationAccountId:
        'destinationAccountId' in legNew ? legNew.destinationAccountId : deleteField(),
      amountMinor: legNew.amountMinor,
      currency: legNew.currency,
      description: legNew.description,
      notes: legNew.notes ?? deleteField(),
      occurredAt: Timestamp.fromDate(legNew.occurredAt),
      updatedAt: serverTimestamp(),
    });
  }
  applyDeltas(batch, ctx.uid, editTransferDeltas([sourceLegOld, destinationLegOld], input));
  await batch.commit();
}

// --- Recurring occurrences ---

function nextRecurringState(recurring: RecurringTransaction): {
  nextOccurrence: Date;
  active: boolean;
} {
  const nextOccurrence = advanceOccurrence(
    recurring.nextOccurrence,
    recurring.frequency,
    recurring.interval,
    recurring.anchorDay,
  );
  const active = recurring.endDate ? nextOccurrence <= recurring.endDate : true;
  return { nextOccurrence, active };
}

/** Confirm a due occurrence: create the real transaction and advance the schedule atomically. */
export async function confirmRecurring(
  ctx: LedgerContext,
  recurring: RecurringTransaction,
): Promise<string> {
  requireAccount(ctx, recurring.accountId);
  requireCategory(ctx, recurring.categoryId, recurring.type);
  const ref = doc(transactionsCol(ctx.uid));
  const batch = writeBatch(db);
  batch.set(
    ref,
    transactionDocData({
      type: recurring.type,
      accountId: recurring.accountId,
      categoryId: recurring.categoryId,
      amountMinor: recurring.amountMinor,
      currency: recurring.currency,
      description: recurring.description,
      tags: [],
      occurredAt: recurring.nextOccurrence,
      recurringTransactionId: recurring.id,
      source: 'recurring',
    }),
  );
  applyDeltas(
    batch,
    ctx.uid,
    createEntryDeltas({
      type: recurring.type,
      accountId: recurring.accountId,
      amountMinor: recurring.amountMinor,
    }),
  );
  const next = nextRecurringState(recurring);
  batch.update(doc(recurringCol(ctx.uid), recurring.id), {
    nextOccurrence: Timestamp.fromDate(next.nextOccurrence),
    active: next.active,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

/** Skip a due occurrence: advance the schedule without creating a transaction. */
export async function skipRecurring(uid: string, recurring: RecurringTransaction): Promise<void> {
  const next = nextRecurringState(recurring);
  const batch = writeBatch(db);
  batch.update(doc(recurringCol(uid), recurring.id), {
    nextOccurrence: Timestamp.fromDate(next.nextOccurrence),
    active: next.active,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// --- CSV import ---

export interface ImportMeta {
  fileName: string;
  accountId: string;
  rowCount: number;
  duplicateCount: number;
}

/**
 * Write imported rows in chunks below the Firestore batch limit. Each chunk
 * carries its own balance increment, so a failed chunk never desyncs balances.
 */
export async function importEntries(
  ctx: LedgerContext,
  rows: EntryInput[],
  meta: ImportMeta,
): Promise<void> {
  for (const row of rows) validateEntry(ctx, row);
  for (let index = 0; index < rows.length; index += MAX_BATCH_OPS) {
    const chunk = rows.slice(index, index + MAX_BATCH_OPS);
    const batch = writeBatch(db);
    const deltas: BalanceDeltaMap = new Map();
    for (const row of chunk) {
      batch.set(
        doc(transactionsCol(ctx.uid)),
        transactionDocData({ ...row, source: 'csv-import' }),
      );
      for (const [accountId, delta] of createEntryDeltas(row)) {
        deltas.set(accountId, (deltas.get(accountId) ?? 0) + delta);
      }
    }
    applyDeltas(batch, ctx.uid, deltas);
    await batch.commit();
  }
  await setDoc(doc(importsCol(ctx.uid)), {
    ...meta,
    importedCount: rows.length,
    createdAt: serverTimestamp(),
  });
}

// --- Balance recalculation (Settings maintenance action) ---

export interface RecalculationRow {
  account: Account;
  recordedMinor: number;
  computedMinor: number;
}

/** Recompute every balance from opening balance + transaction history. Read-only preview. */
export async function previewRecalculation(uid: string): Promise<RecalculationRow[]> {
  const [accountsSnap, transactionsSnap] = await Promise.all([
    getDocs(accountsCol(uid)),
    getDocs(transactionsCol(uid)),
  ]);
  const accounts = accountsSnap.docs.map(parseAccount);
  const computed = new Map<string, number>(
    accounts.map((account) => [account.id, account.openingBalanceMinor]),
  );
  for (const txnSnap of transactionsSnap.docs) {
    const txn = parseTransaction(txnSnap);
    if (computed.has(txn.accountId))
      computed.set(txn.accountId, (computed.get(txn.accountId) ?? 0) + legEffect(txn));
  }
  return accounts.map((account) => ({
    account,
    recordedMinor: account.currentBalanceMinor,
    computedMinor: computed.get(account.id) ?? account.openingBalanceMinor,
  }));
}

export async function applyRecalculation(uid: string, rows: RecalculationRow[]): Promise<void> {
  const drifted = rows.filter((row) => row.recordedMinor !== row.computedMinor);
  for (let index = 0; index < drifted.length; index += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    for (const row of drifted.slice(index, index + MAX_BATCH_OPS)) {
      batch.update(doc(accountsCol(uid), row.account.id), {
        currentBalanceMinor: row.computedMinor,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
