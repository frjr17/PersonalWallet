import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_CATEGORY_ICON, normalizeCategoryIcon } from '@/lib/categoryIcons';
import { monthRange } from '@/lib/dates';
import { categorySchema } from '@/lib/validation';
import { transactionEffect } from '@/services/finance';
import { advanceOccurrence, asDate } from '@/lib/dates';
import type {
  Account,
  Budget,
  Category,
  ImportRecord,
  ProfileSettings,
  RecurringTransaction,
  Transaction,
} from '@/types/domain';
const path = (uid: string, name: string) => collection(db, 'users', uid, name);
const withId = <T>(data: DocumentData, id: string) => ({ ...data, id }) as T;
export function subscribeCollection<T>(
  uid: string,
  name: string,
  callback: (items: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  return onSnapshot(query(path(uid, name), ...constraints), (snapshot) =>
    callback(snapshot.docs.map((item) => withId<T>(item.data(), item.id))),
  );
}
export const subscribeAccounts = (uid: string, cb: (v: Account[]) => void) =>
  subscribeCollection(uid, 'accounts', cb, orderBy('name'));
export const subscribeCategories = (uid: string, cb: (v: Category[]) => void) =>
  onSnapshot(query(path(uid, 'categories'), orderBy('name')), (snapshot) =>
    cb(snapshot.docs.map((item) => categorySchema.parse(withId(item.data(), item.id)) as Category)),
  );
export const subscribeBudgets = (uid: string, period: string, cb: (v: Budget[]) => void) =>
  subscribeCollection(uid, 'budgets', cb, where('period', '==', period));
export const subscribeRecurring = (uid: string, cb: (v: RecurringTransaction[]) => void) =>
  subscribeCollection(uid, 'recurringTransactions', cb, orderBy('nextOccurrence'), limit(100));
export function subscribeMonthTransactions(
  uid: string,
  date: Date,
  cb: (v: Transaction[]) => void,
) {
  const { start, end } = monthRange(date);
  return subscribeCollection(
    uid,
    'transactions',
    cb,
    where('occurredAt', '>=', Timestamp.fromDate(start)),
    where('occurredAt', '<', Timestamp.fromDate(end)),
    orderBy('occurredAt', 'desc'),
    limit(500),
  );
}
export async function saveAccount(
  uid: string,
  input: Pick<Account, 'name' | 'type' | 'currency' | 'openingBalanceMinor' | 'creditLimitMinor'>,
  id?: string,
) {
  const openingBalanceMinor = input.openingBalanceMinor === 0 ? 0 : input.openingBalanceMinor;
  const ref = id ? doc(path(uid, 'accounts'), id) : doc(path(uid, 'accounts'));
  const existing = id ? await getDoc(ref) : undefined;
  if (id && (!existing || !existing.exists())) throw new Error('Account not found');
  const existingData = existing?.data() as Partial<Account> | undefined;
  if (existingData) {
    if (existingData.type && existingData.type !== input.type) {
      throw new Error('Account type cannot be changed after creation.');
    }
    const openingDelta = openingBalanceMinor - (existingData.openingBalanceMinor ?? 0);
    await updateDoc(ref, {
      ...input,
      openingBalanceMinor,
      archived: existingData.archived ?? false,
      creditLimitMinor:
        input.type === 'credit-card' && input.creditLimitMinor !== undefined
          ? input.creditLimitMinor
          : deleteField(),
      currentBalanceMinor: increment(openingDelta),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await setDoc(ref, {
    ...input,
    openingBalanceMinor,
    currentBalanceMinor: openingBalanceMinor,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function archiveAccount(uid: string, id: string, archived = true) {
  await updateDoc(doc(path(uid, 'accounts'), id), { archived, updatedAt: serverTimestamp() });
}
export async function saveCategory(
  uid: string,
  input: Pick<Category, 'name' | 'type' | 'parentCategoryId'> & { icon?: unknown },
  id?: string,
) {
  const categorySnapshot = await getDocs(path(uid, 'categories'));
  const categories = categorySnapshot.docs.map((item) => withId<Category>(item.data(), item.id));
  const parentProblem = validateCategoryParent(categories, id, input.parentCategoryId, input.type);
  if (parentProblem) throw new Error(parentProblem);
  const duplicate = categories.some(
    (category) =>
      category.id !== id &&
      category.type === input.type &&
      (category.parentCategoryId ?? '') === (input.parentCategoryId ?? '') &&
      category.name.trim().toLocaleLowerCase('en-US') ===
        input.name.trim().toLocaleLowerCase('en-US'),
  );
  if (duplicate) throw new Error('A category with this name already exists at that level.');
  const ref = id ? doc(path(uid, 'categories'), id) : doc(path(uid, 'categories'));
  const existing = id ? await getDoc(ref) : undefined;
  if (id && (!existing || !existing.exists())) throw new Error('Category not found');
  const existingData = existing?.exists() ? (existing.data() as Partial<Category>) : undefined;
  if (
    id &&
    existingData?.type !== undefined &&
    existingData.type !== input.type &&
    categories.some((category) => category.parentCategoryId === id)
  )
    throw new Error('Move or archive nested categories before changing this category type.');
  await setDoc(
    ref,
    {
      ...input,
      icon: normalizeCategoryIcon(input.icon),
      parentCategoryId: input.parentCategoryId || deleteField(),
      archived: existingData?.archived ?? false,
      createdAt: existingData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function archiveCategory(uid: string, id: string, archived = true) {
  await updateDoc(doc(path(uid, 'categories'), id), { archived, updatedAt: serverTimestamp() });
}

export function validateCategoryParent(
  categories: readonly Category[],
  categoryId?: string,
  parentId?: string,
  categoryType?: Category['type'],
): string | null {
  if (!parentId) return null;
  if (categoryId === parentId) return 'A category cannot be its own parent.';
  const category = categoryId ? categories.find((item) => item.id === categoryId) : undefined;
  let parent = categories.find((item) => item.id === parentId);
  if (!parent) return 'Choose an existing parent category.';
  if (parent.archived) return 'Restore the parent category before using it.';
  const childType = category?.type ?? categoryType;
  if (childType && parent.type !== childType)
    return 'Parent and child categories must have the same type.';
  const visited = new Set<string>();
  while (parent) {
    if (parent.id === categoryId) return 'That parent would create a category loop.';
    if (visited.has(parent.id)) return 'The existing category tree contains a loop.';
    visited.add(parent.id);
    parent = parent.parentCategoryId
      ? categories.find((item) => item.id === parent?.parentCategoryId)
      : undefined;
  }
  return null;
}
export async function saveBudget(
  uid: string,
  input: Pick<Budget, 'categoryId' | 'period' | 'limitMinor' | 'warningThreshold' | 'rollover'>,
  id?: string,
) {
  const ref = id ? doc(path(uid, 'budgets'), id) : doc(path(uid, 'budgets'));
  await setDoc(
    ref,
    { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
export async function saveRecurring(
  uid: string,
  input: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
) {
  const ref = id
    ? doc(path(uid, 'recurringTransactions'), id)
    : doc(path(uid, 'recurringTransactions'));
  await setDoc(
    ref,
    {
      ...input,
      nextOccurrence: Timestamp.fromDate(input.nextOccurrence as Date),
      endDate: input.endDate ? Timestamp.fromDate(input.endDate as Date) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
export async function setRecurringActive(uid: string, id: string, active: boolean) {
  await updateDoc(doc(path(uid, 'recurringTransactions'), id), {
    active,
    updatedAt: serverTimestamp(),
  });
}
export async function deleteRecurring(uid: string, id: string) {
  await deleteDoc(doc(path(uid, 'recurringTransactions'), id));
}
export async function advanceRecurring(uid: string, item: RecurringTransaction) {
  const next = advanceOccurrence(
    asDate(item.nextOccurrence),
    item.frequency,
    item.interval,
    item.scheduleAnchorDay,
  );
  await updateDoc(doc(path(uid, 'recurringTransactions'), item.id), {
    nextOccurrence: Timestamp.fromDate(next),
    active: item.endDate ? next <= asDate(item.endDate) : true,
    updatedAt: serverTimestamp(),
  });
}
export interface TransactionInput {
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  amountMinor: number;
  currency: string;
  description: string;
  merchant?: string;
  notes?: string;
  tags: string[];
  occurredAt: Date;
  source: Transaction['source'];
  recurringTransactionId?: string;
  fingerprint: string;
}
async function validateTransactionReferences(uid: string, input: TransactionInput) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error('Amount must be greater than zero');
  const [account, category] = await Promise.all([
    getDoc(doc(path(uid, 'accounts'), input.accountId)),
    getDoc(doc(path(uid, 'categories'), input.categoryId)),
  ]);
  if (!account.exists() || account.data().archived === true)
    throw new Error('Select an active account');
  if (!category.exists() || category.data().archived === true)
    throw new Error('Select an active category');
  if (category.data().type !== input.type)
    throw new Error(
      input.type === 'income'
        ? 'Income requires an income category'
        : 'Expenses require an expense category',
    );
  if (account.data().currency !== input.currency)
    throw new Error('Account and transaction currencies must match');
  return account;
}
export async function createTransaction(uid: string, input: TransactionInput) {
  const accountRef = doc(path(uid, 'accounts'), input.accountId);
  await validateTransactionReferences(uid, input);
  const batch = writeBatch(db);
  const ref = doc(path(uid, 'transactions'));
  batch.set(ref, {
    ...input,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(accountRef, {
    currentBalanceMinor: increment(
      input.type === 'income' ? input.amountMinor : -input.amountMinor,
    ),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}
export async function confirmRecurring(
  uid: string,
  item: RecurringTransaction,
  fingerprintValue: string,
) {
  const batch = writeBatch(db),
    occurredAt = asDate(item.nextOccurrence),
    next = advanceOccurrence(occurredAt, item.frequency, item.interval, item.scheduleAnchorDay);
  batch.set(doc(path(uid, 'transactions')), {
    type: item.type,
    accountId: item.accountId,
    categoryId: item.categoryId,
    amountMinor: item.amountMinor,
    currency: item.currency,
    description: item.description,
    tags: [],
    occurredAt: Timestamp.fromDate(occurredAt),
    recurringTransactionId: item.id,
    source: 'recurring',
    fingerprint: fingerprintValue,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(path(uid, 'accounts'), item.accountId), {
    currentBalanceMinor: increment(item.type === 'income' ? item.amountMinor : -item.amountMinor),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(path(uid, 'recurringTransactions'), item.id), {
    nextOccurrence: Timestamp.fromDate(next),
    active: item.endDate ? next <= asDate(item.endDate) : true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function createTransfer(
  uid: string,
  input: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    description: string;
    occurredAt: Date;
    fingerprint: string;
  },
) {
  if (input.sourceAccountId === input.destinationAccountId)
    throw new Error('Transfer accounts must differ');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error('Amount must be greater than zero');
  const sourceRef = doc(path(uid, 'accounts'), input.sourceAccountId),
    destinationRef = doc(path(uid, 'accounts'), input.destinationAccountId);
  const accounts = await Promise.all([getDoc(sourceRef), getDoc(destinationRef)]);
  if (accounts.some((a) => !a.exists() || a.data().archived === true))
    throw new Error('Select two active accounts');
  if (accounts.some((account) => account.exists() && account.data().currency !== input.currency))
    throw new Error('Transfers require accounts in the same currency');
  const transferId = crypto.randomUUID(),
    batch = writeBatch(db),
    common = {
      type: 'transfer',
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.description,
      tags: [],
      occurredAt: Timestamp.fromDate(input.occurredAt),
      transferId,
      source: 'manual',
      fingerprint: input.fingerprint,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  batch.set(doc(path(uid, 'transactions')), {
    ...common,
    accountId: input.sourceAccountId,
    destinationAccountId: input.destinationAccountId,
    transferRole: 'source',
  });
  batch.set(doc(path(uid, 'transactions')), {
    ...common,
    accountId: input.destinationAccountId,
    destinationAccountId: input.sourceAccountId,
    transferRole: 'destination',
  });
  batch.update(sourceRef, {
    currentBalanceMinor: increment(-input.amountMinor),
    updatedAt: serverTimestamp(),
  });
  batch.update(destinationRef, {
    currentBalanceMinor: increment(input.amountMinor),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function deleteTransaction(
  uid: string,
  transaction: Transaction,
  all: readonly Transaction[],
) {
  const batch = writeBatch(db);
  const related = transaction.transferId
    ? all.filter((t) => t.transferId === transaction.transferId)
    : [transaction];
  for (const item of related) {
    batch.delete(doc(path(uid, 'transactions'), item.id));
    batch.update(doc(path(uid, 'accounts'), item.accountId), {
      currentBalanceMinor: increment(-transactionEffect(item)),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
export async function updateSimpleTransaction(
  uid: string,
  original: Transaction,
  input: TransactionInput,
) {
  if (original.type === 'transfer')
    throw new Error('Edit transfers by deleting and recreating them');
  await validateTransactionReferences(uid, input);
  const batch = writeBatch(db);
  batch.update(doc(path(uid, 'accounts'), original.accountId), {
    currentBalanceMinor: increment(-transactionEffect(original)),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(path(uid, 'accounts'), input.accountId), {
    currentBalanceMinor: increment(
      input.type === 'income' ? input.amountMinor : -input.amountMinor,
    ),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(path(uid, 'transactions'), original.id), {
    ...input,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function loadAll<T>(uid: string, name: string) {
  const snapshot = await getDocs(query(path(uid, name), orderBy(documentId())));
  return snapshot.docs.map((item) => withId<T>(item.data(), item.id));
}
export async function loadSettings(uid: string) {
  const snapshot = await getDoc(doc(db, 'users', uid, 'settings', 'profile'));
  return snapshot.exists() ? (snapshot.data() as ProfileSettings) : null;
}
export async function saveSettings(uid: string, value: ProfileSettings) {
  await setDoc(doc(db, 'users', uid, 'settings', 'profile'), value);
}
export async function writeImportRecord(
  uid: string,
  value: Omit<ImportRecord, 'id' | 'createdAt' | 'updatedAt'>,
) {
  await addDoc(path(uid, 'imports'), {
    ...value,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function ensureDefaultCategories(uid: string) {
  const target = path(uid, 'categories');
  const existing = await getDocs(query(target, limit(1)));
  if (!existing.empty) return;
  const batch = writeBatch(db);
  const expenses: ReadonlyArray<[string, Category['icon']]> = [
    ['Housing', 'home'],
    ['Groceries', 'groceries'],
    ['Restaurants', 'dining'],
    ['Transportation', 'transport'],
    ['Utilities', 'utilities'],
    ['Health', 'health'],
    ['Education', 'education'],
    ['Entertainment', 'entertainment'],
    ['Subscriptions', 'subscriptions'],
    ['Personal care', 'personal-care'],
    ['Gifts', 'gift'],
    ['Other', DEFAULT_CATEGORY_ICON],
  ];
  const incomes: ReadonlyArray<[string, Category['icon']]> = [
    ['Salary', 'salary'],
    ['Freelance', 'freelance'],
    ['Interest', 'interest'],
    ['Refund', 'refund'],
    ['Gift', 'gift'],
    ['Other income', DEFAULT_CATEGORY_ICON],
  ];
  for (const [name, icon] of expenses)
    batch.set(doc(target), {
      name,
      type: 'expense',
      icon,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  for (const [name, icon] of incomes)
    batch.set(doc(target), {
      name,
      type: 'income',
      icon,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  await batch.commit();
}
export async function importTransactions(
  uid: string,
  accountId: string,
  items: readonly TransactionInput[],
) {
  for (let start = 0; start < items.length; start += 399) {
    const chunk = items.slice(start, start + 399),
      batch = writeBatch(db);
    let delta = 0;
    for (const item of chunk) {
      batch.set(doc(path(uid, 'transactions')), {
        ...item,
        occurredAt: Timestamp.fromDate(item.occurredAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      delta += item.type === 'income' ? item.amountMinor : -item.amountMinor;
    }
    batch.update(doc(path(uid, 'accounts'), accountId), {
      currentBalanceMinor: increment(delta),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }
}
export async function restoreBackup(
  uid: string,
  data: {
    settings: Record<string, unknown>;
    accounts: Record<string, unknown>[];
    categories: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    budgets: Record<string, unknown>[];
    recurringTransactions: Record<string, unknown>[];
  },
  mode: 'merge' | 'replace',
) {
  const groups = [
    ['accounts', data.accounts],
    ['categories', data.categories],
    ['transactions', data.transactions],
    ['budgets', data.budgets],
    ['recurringTransactions', data.recurringTransactions],
  ] as const;
  if (mode === 'replace') {
    for (const [name] of groups) {
      const existing = await getDocs(path(uid, name));
      for (let i = 0; i < existing.docs.length; i += 400) {
        const batch = writeBatch(db);
        existing.docs.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }
    }
  }
  for (const [name, items] of groups) {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((item) => {
        const { id, ...value } = item;
        const normalized = Object.fromEntries(
          Object.entries(value).map(([key, v]) => [
            key,
            typeof v === 'string' &&
            /At$|Occurrence$|endDate$/.test(key) &&
            !Number.isNaN(Date.parse(v))
              ? Timestamp.fromDate(new Date(v))
              : v,
          ]),
        );
        batch.set(doc(path(uid, name), String(id)), normalized, { merge: mode === 'merge' });
      });
      await batch.commit();
    }
  }
  await setDoc(doc(db, 'users', uid, 'settings', 'profile'), data.settings, {
    merge: mode === 'merge',
  });
}
export async function applyBalanceCorrections(
  uid: string,
  items: readonly { id: string; expected: number }[],
) {
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach((item) =>
      batch.update(doc(path(uid, 'accounts'), item.id), {
        currentBalanceMinor: item.expected,
        updatedAt: serverTimestamp(),
      }),
    );
    await batch.commit();
  }
}
