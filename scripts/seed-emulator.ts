import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { defaultCategorySeeds } from '../src/lib/categories';

/**
 * Development seed for the Firebase Emulator Suite ONLY.
 * It refuses to run without emulator hosts, so production can never be seeded.
 */
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const OWNER = {
  uid: 'emulator-owner-uid',
  email: 'owner@example.test',
  password: 'local-ledger-owner',
  displayName: 'Emulator Owner',
};

const app = initializeApp({ projectId: 'personal-budget-demo' });
const auth = getAuth(app);
const db = getFirestore(app);

try {
  await auth.getUser(OWNER.uid);
} catch {
  await auth.createUser(OWNER);
}

const user = db.collection('users').doc(OWNER.uid);
const now = FieldValue.serverTimestamp();
const batch = db.batch();

batch.set(user.collection('settings').doc('profile'), {
  currency: 'USD',
  locale: 'en-US',
  timeZone: 'America/Panama',
  weekStartsOn: 1,
  offlineWarningAcknowledged: true,
  categoriesSeeded: true,
});

// Categories with the same deterministic ids the app's first-run seeding uses.
const categoryId = (seed: (typeof defaultCategorySeeds)[number]) =>
  `seed-${seed.type}-${seed.name.toLowerCase().replace(/\s+/g, '-')}`;
for (const seed of defaultCategorySeeds) {
  batch.set(user.collection('categories').doc(categoryId(seed)), {
    ...seed,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}
const groceriesId = 'seed-expense-groceries';
const salaryId = 'seed-income-salary';
const utilitiesId = 'seed-expense-utilities';

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const day = (dayOfMonth: number, hour = 12) =>
  Timestamp.fromDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), dayOfMonth, hour));

interface SeedTxn {
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  amountMinor: number;
  description: string;
  occurredAt: Timestamp;
  transferId?: string;
}

const transactions: SeedTxn[] = [
  {
    type: 'income',
    accountId: 'checking',
    categoryId: salaryId,
    amountMinor: 320000,
    description: 'Monthly salary',
    occurredAt: day(1, 9),
  },
  {
    type: 'expense',
    accountId: 'checking',
    categoryId: utilitiesId,
    amountMinor: 8950,
    description: 'Electricity bill',
    occurredAt: day(3),
  },
  {
    type: 'expense',
    accountId: 'cash',
    categoryId: groceriesId,
    amountMinor: 5230,
    description: 'Groceries run',
    occurredAt: day(4),
  },
  {
    type: 'expense',
    accountId: 'checking',
    categoryId: groceriesId,
    amountMinor: 7615,
    description: 'Supermarket',
    occurredAt: day(8),
  },
  {
    type: 'transfer',
    accountId: 'checking',
    destinationAccountId: 'savings',
    amountMinor: 50000,
    description: 'Transfer to Savings',
    occurredAt: day(5, 10),
    transferId: 'seed-transfer-1',
  },
  {
    type: 'transfer',
    accountId: 'savings',
    amountMinor: 50000,
    description: 'Transfer from Checking',
    occurredAt: day(5, 10),
    transferId: 'seed-transfer-1',
  },
];

for (const [index, txn] of transactions.entries()) {
  batch.set(user.collection('transactions').doc(`seed-txn-${index}`), {
    currency: 'USD',
    tags: [],
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    ...txn,
  });
}

// Balances derived from opening balance + the transactions above.
const effect = (txn: SeedTxn, accountId: string): number => {
  if (txn.accountId !== accountId) return 0;
  if (txn.type === 'income') return txn.amountMinor;
  if (txn.type === 'expense') return -txn.amountMinor;
  return txn.destinationAccountId ? -txn.amountMinor : txn.amountMinor;
};
const accounts = [
  { id: 'cash', name: 'Cash', type: 'cash', openingBalanceMinor: 25000 },
  { id: 'checking', name: 'Checking', type: 'checking', openingBalanceMinor: 180000 },
  { id: 'savings', name: 'Savings', type: 'savings', openingBalanceMinor: 500000 },
] as const;
for (const account of accounts) {
  const balance = transactions.reduce<number>(
    (total, txn) => total + effect(txn, account.id),
    account.openingBalanceMinor,
  );
  batch.set(user.collection('accounts').doc(account.id), {
    name: account.name,
    type: account.type,
    currency: 'USD',
    openingBalanceMinor: account.openingBalanceMinor,
    currentBalanceMinor: balance,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}

batch.set(user.collection('budgets').doc(`${monthKey(today)}_${groceriesId}`), {
  categoryId: groceriesId,
  period: monthKey(today),
  limitMinor: 40000,
  warningThreshold: 0.8,
  rollover: false,
  createdAt: now,
  updatedAt: now,
});

const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1, 9);
batch.set(user.collection('recurringTransactions').doc('seed-recurring-rent'), {
  type: 'expense',
  accountId: 'checking',
  categoryId: 'seed-expense-housing',
  amountMinor: 95000,
  currency: 'USD',
  description: 'Rent',
  frequency: 'monthly',
  interval: 1,
  nextOccurrence: Timestamp.fromDate(nextMonth),
  anchorDay: 1,
  active: true,
  createdAt: now,
  updatedAt: now,
});
batch.set(user.collection('recurringTransactions').doc('seed-recurring-salary'), {
  type: 'income',
  accountId: 'checking',
  categoryId: salaryId,
  amountMinor: 320000,
  currency: 'USD',
  description: 'Monthly salary',
  frequency: 'monthly',
  interval: 1,
  nextOccurrence: Timestamp.fromDate(nextMonth),
  anchorDay: 1,
  active: true,
  createdAt: now,
  updatedAt: now,
});

await batch.commit();
console.log(`Seeded emulator for ${OWNER.email} (uid ${OWNER.uid})`);

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
