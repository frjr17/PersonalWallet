import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';

const OWNER_UID = 'emulator-owner-uid';
const STRANGER_UID = 'someone-else';

let env: RulesTestEnvironment;

const validAccount = {
  name: 'Checking',
  type: 'checking',
  currency: 'USD',
  openingBalanceMinor: 0,
  currentBalanceMinor: 0,
  archived: false,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const validTransaction = {
  type: 'expense',
  accountId: 'a1',
  amountMinor: 1250,
  currency: 'USD',
  description: 'Coffee',
  tags: [],
  occurredAt: Timestamp.now(),
  source: 'manual',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'personal-budget-demo',
    firestore: {
      rules: readFileSync('firestore.emulator.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ownerDb = () => env.authenticatedContext(OWNER_UID).firestore();
const strangerDb = () => env.authenticatedContext(STRANGER_UID).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();

describe('firestore security rules', () => {
  it('denies all unauthenticated access', async () => {
    await assertFails(anonDb().collection(`users/${OWNER_UID}/accounts`).get());
    await assertFails(anonDb().doc(`users/${OWNER_UID}/accounts/a1`).set(validAccount));
    await assertFails(anonDb().doc(`users/${OWNER_UID}/settings/profile`).get());
  });

  it('denies other authenticated users, even under their own uid', async () => {
    // reading/writing the owner's data
    await assertFails(strangerDb().collection(`users/${OWNER_UID}/transactions`).get());
    await assertFails(strangerDb().doc(`users/${OWNER_UID}/accounts/a1`).set(validAccount));
    // a non-owner uid gets no ledger of their own either — single-owner app
    await assertFails(strangerDb().doc(`users/${STRANGER_UID}/accounts/a1`).set(validAccount));
    await assertFails(strangerDb().collection(`users/${STRANGER_UID}/accounts`).get());
  });

  it('allows the owner full access to their own data', async () => {
    await assertSucceeds(ownerDb().doc(`users/${OWNER_UID}/accounts/a1`).set(validAccount));
    await assertSucceeds(ownerDb().doc(`users/${OWNER_UID}/transactions/t1`).set(validTransaction));
    await assertSucceeds(ownerDb().collection(`users/${OWNER_UID}/accounts`).get());
    await assertSucceeds(
      ownerDb().doc(`users/${OWNER_UID}/settings/profile`).set({ currency: 'USD' }),
    );
    await assertSucceeds(ownerDb().doc(`users/${OWNER_UID}/accounts/a1`).delete());
  });

  it('denies the owner access outside users/{uid}', async () => {
    await assertFails(ownerDb().doc('other-collection/doc').get());
    await assertFails(ownerDb().doc('other-collection/doc').set({ anything: true }));
    await assertFails(ownerDb().doc(`users/${STRANGER_UID}/accounts/a1`).set(validAccount));
  });

  it('rejects invalid account documents', async () => {
    const path = `users/${OWNER_UID}/accounts/a1`;
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, type: 'yacht' }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, name: '' }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, currentBalanceMinor: 10.5 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, archived: 'no' }),
    );
    // credit limit must be a positive integer when present
    await assertSucceeds(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, type: 'credit-card', creditLimitMinor: 150000 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, type: 'credit-card', creditLimitMinor: 0 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validAccount, type: 'credit-card', creditLimitMinor: 1500.5 }),
    );
  });

  it('rejects invalid monetary values on transactions', async () => {
    const path = `users/${OWNER_UID}/transactions/t1`;
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validTransaction, amountMinor: 0 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validTransaction, amountMinor: -100 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validTransaction, amountMinor: 12.5 }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validTransaction, type: 'donation' }),
    );
    await assertFails(
      ownerDb()
        .doc(path)
        .set({ ...validTransaction, source: 'telepathy' }),
    );
  });

  it('rejects invalid budgets and recurring templates', async () => {
    const budget = {
      categoryId: 'c1',
      period: '2026-07',
      limitMinor: 10000,
      warningThreshold: 0.8,
      rollover: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await assertSucceeds(ownerDb().doc(`users/${OWNER_UID}/budgets/b1`).set(budget));
    await assertFails(
      ownerDb()
        .doc(`users/${OWNER_UID}/budgets/b2`)
        .set({ ...budget, period: 'july-2026' }),
    );
    await assertFails(
      ownerDb()
        .doc(`users/${OWNER_UID}/budgets/b3`)
        .set({ ...budget, limitMinor: 0 }),
    );
    await assertFails(
      ownerDb()
        .doc(`users/${OWNER_UID}/budgets/b4`)
        .set({ ...budget, warningThreshold: 1.5 }),
    );

    const recurring = {
      type: 'expense',
      accountId: 'a1',
      categoryId: 'c1',
      amountMinor: 9500,
      currency: 'USD',
      description: 'Rent',
      frequency: 'monthly',
      interval: 1,
      nextOccurrence: Timestamp.now(),
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await assertSucceeds(
      ownerDb().doc(`users/${OWNER_UID}/recurringTransactions/r1`).set(recurring),
    );
    await assertFails(
      ownerDb()
        .doc(`users/${OWNER_UID}/recurringTransactions/r2`)
        .set({ ...recurring, frequency: 'hourly' }),
    );
    await assertFails(
      ownerDb()
        .doc(`users/${OWNER_UID}/recurringTransactions/r3`)
        .set({ ...recurring, type: 'transfer' }),
    );
  });
});
