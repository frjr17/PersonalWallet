import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const app = initializeApp({ projectId: 'personal-budget-demo' }),
  auth = getAuth(app),
  db = getFirestore(app),
  uid = 'YOUR_FIREBASE_OWNER_UID';
try {
  await auth.getUser(uid);
} catch {
  await auth.createUser({
    uid,
    email: 'owner@example.test',
    password: 'local-ledger-owner',
    displayName: 'Emulator Owner',
  });
}
const user = db.collection('users').doc(uid),
  batch = db.batch(),
  now = FieldValue.serverTimestamp();
const accounts = [
  { id: 'cash', name: 'Cash', type: 'cash', balance: 25000 },
  { id: 'checking', name: 'Checking', type: 'checking', balance: 235000 },
  { id: 'savings', name: 'Savings', type: 'savings', balance: 500000 },
  {
    id: 'everyday-card',
    name: 'Everyday card',
    type: 'credit-card',
    balance: -32000,
    creditLimitMinor: 250000,
  },
] as const;
for (const account of accounts)
  batch.set(user.collection('accounts').doc(account.id), {
    name: account.name,
    type: account.type,
    currency: 'USD',
    openingBalanceMinor: account.balance,
    currentBalanceMinor: account.balance,
    ...('creditLimitMinor' in account ? { creditLimitMinor: account.creditLimitMinor } : {}),
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
const categories = [
  ['groceries', 'Groceries', 'expense', 'groceries', undefined],
  ['dining', 'Dining out', 'expense', 'dining', undefined],
  ['coffee', 'Coffee', 'expense', 'dining', 'dining'],
  ['housing', 'Housing', 'expense', 'home', undefined],
  ['subscriptions', 'Subscriptions', 'expense', 'subscriptions', undefined],
  ['salary', 'Salary', 'income', 'salary', undefined],
  ['freelance', 'Freelance', 'income', 'freelance', undefined],
] as const;
for (const [id, name, type, icon, parentCategoryId] of categories)
  batch.set(user.collection('categories').doc(id), {
    name,
    type,
    icon,
    ...(parentCategoryId ? { parentCategoryId } : {}),
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
const date = new Date();
batch.set(user.collection('budgets').doc('groceries-current'), {
  categoryId: 'groceries',
  period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  limitMinor: 50000,
  warningThreshold: 0.8,
  rollover: false,
  createdAt: now,
  updatedAt: now,
});
batch.set(user.collection('recurringTransactions').doc('rent'), {
  type: 'expense',
  accountId: 'checking',
  categoryId: 'housing',
  amountMinor: 95000,
  currency: 'USD',
  description: 'Rent',
  frequency: 'monthly',
  interval: 1,
  nextOccurrence: Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), 1)),
  scheduleAnchorDay: 1,
  active: true,
  createdAt: now,
  updatedAt: now,
});
batch.set(user.collection('recurringTransactions').doc('salary'), {
  type: 'income',
  accountId: 'checking',
  categoryId: 'salary',
  amountMinor: 300000,
  currency: 'USD',
  description: 'Salary',
  frequency: 'monthly',
  interval: 1,
  nextOccurrence: Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), 25)),
  scheduleAnchorDay: 25,
  active: true,
  createdAt: now,
  updatedAt: now,
});
await batch.commit();
console.log('Seeded the emulator owner with accounts, categories, budget, and recurring items.');
